import chalk from 'chalk';
import simpleGit from 'simple-git';
import clipboardy from 'clipboardy';
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';

const API_HOSTNAME = process.env.CORTEX_COMMIT_MESSAGES_API_HOSTNAME || 'https://commit-messages-production-denihs.svc-us5.zcloud.ws';
const API_URL = `${API_HOSTNAME}/api/generate-commit-message`;

const git = simpleGit();

async function loadConfigFile() {
  try {
    const configPath = path.join(process.cwd(), '.cortexrc');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    
    if (!configExists) {
      return {};
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    try {
      return JSON.parse(configContent);
    } catch (error) {
      console.error(chalk.yellow('Warning: .cortexrc file exists but is not valid JSON. Ignoring configuration file.'));
      return {};
    }
  } catch (error) {
    console.error(chalk.yellow('Warning: Error reading .cortexrc file. Ignoring configuration file.'));
    return {};
  }
}
function normalizeArrayOption(option) {
  return Array.isArray(option) ? option : option ? [option] : [];
}

function mergeOptions(cliOptions) {
  const defaultOptions = {
    onlyStaged: false,
    onlyUnstaged: false,
    all: false,
    stageChanges: false,
    commitStaged: false,
    commitAndPush: false,
    header: '',
    include: [],
    exclude: [],
  };

  return async () => {
    const configOptions = await loadConfigFile();
    
    const normalizedConfigOptions = {
      ...configOptions,
      include: normalizeArrayOption(configOptions.include),
      exclude: normalizeArrayOption(configOptions.exclude),
    };

    const normalizedCliOptions = {
      ...cliOptions,
      include: normalizeArrayOption(cliOptions.include),
      exclude: normalizeArrayOption(cliOptions.exclude),
    };

    return {
      ...defaultOptions,
      ...normalizedConfigOptions,
      ...normalizedCliOptions,
    };
  };
}

function validateEnvironment() {
  const token = process.env.CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN;
  if (!token) {
    console.error(chalk.red('Error: CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN environment variable is not set'));
    console.error(chalk.yellow('Please set it with your API token to use this command'));
    process.exit(1);
  }
  return token;
}

async function validateGitRepository() {
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.error(chalk.red('Error: Not a git repository'));
      console.error(chalk.yellow('Please run this command from within a git repository'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error checking git repository:'), error.message);
    process.exit(1);
  }
}

async function getModifiedFiles() {
  const status = await git.status();
  return [
    ...status.not_added,
    ...status.modified,
    ...status.deleted,
    ...status.renamed.map(file => file.to),
  ];
}

async function stageAllChanges(options) {
  try {
    const modifiedFiles = await getModifiedFiles();
    
    if (modifiedFiles.length === 0) {
      console.log(chalk.yellow('No changes found to stage.'));
      return;
    }

    let filesToStage = modifiedFiles;

    if (options.include.length > 0) {
      filesToStage = micromatch(filesToStage, options.include);
    }

    if (options.exclude.length > 0) {
      filesToStage = micromatch.not(filesToStage, options.exclude);
    }

    if (filesToStage.length === 0) {
      console.log(chalk.yellow('No files match the include/exclude patterns.'));
      return;
    }

    for (const file of filesToStage) {
      await git.add(file);
    }

    console.log(chalk.green(`Staged ${filesToStage.length} files:`));
    filesToStage.forEach(file => console.log(chalk.white(`  - ${file}`)));
  } catch (error) {
    console.error(chalk.red('Error staging changes:'), error.message);
    process.exit(1);
  }
}

async function getDiff(options) {
  try {
    if (options.stageChanges) {
      await stageAllChanges(options);
    }

    const status = await git.status();
    
    if (!options.onlyUnstaged && !options.all && status.staged.length === 0) {
      console.error(chalk.yellow('No staged changes found.'));
      process.exit(0);
    }

    let diff = '';
    
    if (options.all) {
      diff = await git.diff();
    } else if (options.onlyUnstaged) {
      diff = await git.diff();
    } else {
      diff = await git.diff(['--cached']);
    }

    if (!diff) {
      console.error(chalk.yellow('No changes found to generate commit message.'));
      process.exit(0);
    }

    return diff;
  } catch (error) {
    console.error(chalk.red('Error getting git diff:'), error.message);
    process.exit(1);
  }
}

async function callCommitMessageAPI(diff, token) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${token}`,
      },
      body: JSON.stringify({ diff }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate commit message');
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error(chalk.red('Error calling API:'), error.message);
    process.exit(1);
  }
}

function formatCommitMessage(header, apiMessage) {
  if (!header) return apiMessage;
  return `${header}\n\n${apiMessage}`;
}

async function commitChanges(message, shouldPush = false) {
  try {
    const answer = await new Promise(resolve => {
      const action = shouldPush ? 'commit and push' : 'commit';
      process.stdout.write(chalk.yellow(`Do you want to ${action} the staged changes with this message? (y/yes): `));
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (answer === 'y' || answer === 'yes') {
      await git.commit(message);
      console.log(chalk.green('Changes committed successfully!'));

      if (shouldPush) {
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        await git.push('origin', currentBranch);
        console.log(chalk.green(`Changes pushed to origin/${currentBranch} successfully!`));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red(`Error ${error.message.includes('push') ? 'pushing' : 'committing'} changes:`), error.message);
    process.exit(1);
  }
}

export async function generateCommitMessage(cliOptions) {
  try {
    const token = validateEnvironment();
    await validateGitRepository();

    const options = await mergeOptions(cliOptions)();

    const diff = await getDiff(options);

    const apiMessage = await callCommitMessageAPI(diff, token);

    const message = formatCommitMessage(options.header, apiMessage);

    await clipboardy.write(message);
    console.log(chalk.green('\nGenerated commit message (copied to clipboard):\n'));
    console.log(chalk.white(message));

    if (options.commitAndPush) {
      await commitChanges(message, true);
    } else if (options.commitStaged) {
      await commitChanges(message, false);
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
} 