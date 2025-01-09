import chalk from 'chalk';
import simpleGit from 'simple-git';
import clipboardy from 'clipboardy';
import fs from 'fs/promises';
import path from 'path';
import micromatch from 'micromatch';

const API_HOSTNAME = process.env.CORTEX_COMMIT_MESSAGES_API_HOSTNAME || 'https://commit-messages-production-denihs.svc-us5.zcloud.ws';
const API_URL = `${API_HOSTNAME}/api/generate-commit-message`;
const SAVE_COMMIT_LINK_URL = `${API_HOSTNAME}/api/save-commit-link`;

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

function getNormalizedArrayOption(option) {
  return {
    include: normalizeArrayOption(option.include),
    exclude: normalizeArrayOption(option.exclude),
  };
}

function getIncludeExcludeOptions({ cliOptions, configOptions }) {
  const normalizedCliOptions = getNormalizedArrayOption(cliOptions);
  const normalizedConfigOptions = getNormalizedArrayOption(configOptions);
  return {
    include: normalizedCliOptions.include.length > 0 ? normalizedCliOptions.include : normalizedConfigOptions.include,
    exclude: normalizedCliOptions.exclude.length > 0 ? normalizedCliOptions.exclude : normalizedConfigOptions.exclude,
  };
}

function getCommitOptions({ cliOptions, configOptions, defaultOptions }) {
  const getWithDefault = (options) => ({ ...defaultOptions, ...options });

  const { commitStaged, commitAndPushStaged } = cliOptions.commitStaged || cliOptions.commitAndPushStaged 
    ? getWithDefault(cliOptions) 
    : getWithDefault(configOptions);

  return { commitStaged, commitAndPushStaged };
}

function mergeOptions(cliOptions) {
  const defaultOptions = {
    stageAllChanges: false,
    commitStaged: false,
    commitAndPushStaged: false,
    header: '',
    include: [],
    exclude: [],
    verbose: false,
  };

  return async () => {
    const configOptions = await loadConfigFile();

    // Validate config options against default options
    const invalidOptions = Object.keys(configOptions).filter(key => !(key in defaultOptions));
    if (invalidOptions.length > 0) {
      throw new Error(`Invalid configuration options found in .cortexrc: ${invalidOptions.join(', ')}`);
    }

    const finalOptions = {
      ...defaultOptions,
      ...configOptions,
      ...cliOptions,
      ...getCommitOptions({ cliOptions, configOptions, defaultOptions }),
      ...getIncludeExcludeOptions({ cliOptions, configOptions }),
    };

    if (finalOptions.verbose) {
      console.log(chalk.blue('\nConfiguration:'));
      console.log(chalk.white(JSON.stringify(finalOptions, null, 2)));
      console.log('');
    }

    return finalOptions;
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
  const files = [
    ...status.not_added,
    ...status.modified,
    ...status.deleted,
    ...status.renamed.map(file => file.to),
    ...status.created
  ];

  // Normalize paths to use forward slashes and remove any leading/trailing whitespace
  const normalizedFiles = files.map(file => file.trim().replace(/\\/g, '/'));

  // Get the current directory name
  const currentDir = process.cwd().split(path.sep).pop();

  // Remove redundant directory prefix if it matches current directory
  return normalizedFiles.map(file => {
    if (file.startsWith(`${currentDir}/`)) {
      return file.substring(currentDir.length + 1);
    }
    return file;
  });
}

async function stageAllChanges(options) {
  try {
    const modifiedFiles = await getModifiedFiles();
    
    if (modifiedFiles.length === 0) {
      console.log(chalk.yellow('No changes found to stage.'));
      return;
    }

    console.log(chalk.blue('\nFound modified files:'));
    modifiedFiles.forEach(file => console.log(chalk.gray(`  - ${file}`)));

    let filesToStage = modifiedFiles;

    if (options.include.length > 0) {
      filesToStage = micromatch(filesToStage, options.include);
      console.log(chalk.blue('\nFiles matching include patterns:'), options.include);
      filesToStage.forEach(file => console.log(chalk.gray(`  - ${file}`)));
    }

    if (options.exclude.length > 0) {
      filesToStage = micromatch.not(filesToStage, options.exclude);
      console.log(chalk.blue('\nFiles after applying exclude patterns:'), options.exclude);
      filesToStage.forEach(file => console.log(chalk.gray(`  - ${file}`)));
    }

    if (filesToStage.length === 0) {
      console.log(chalk.yellow('\nNo files match the include/exclude patterns.'));
      return;
    }

    // Stage files one by one and handle errors for each file
    const stagedFiles = [];
    const failedFiles = [];

    console.log(chalk.blue('\nAttempting to stage files...'));
    for (const file of filesToStage) {
      try {
        await git.add([file]);
        stagedFiles.push(file);
      } catch (error) {
        failedFiles.push({ file, error: error.message });
      }
    }

    // Report success
    if (stagedFiles.length > 0) {
      console.log(chalk.green(`\nSuccessfully staged ${stagedFiles.length} files:`));
      stagedFiles.forEach(file => console.log(chalk.white(`  ✓ ${file}`)));
    }

    // Report failures
    if (failedFiles.length > 0) {
      console.log(chalk.yellow(`\nFailed to stage ${failedFiles.length} files:`));
      failedFiles.forEach(({ file, error }) => {
        console.log(chalk.red(`  ✗ ${file}`));
        console.log(chalk.gray(`    Error: ${error}`));
        console.log(chalk.gray(`    Working directory: ${process.cwd()}`));
      });
    }

    // If no files were staged successfully, exit
    if (stagedFiles.length === 0) {
      console.error(chalk.red('\nNo files were staged successfully.'));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error staging changes:'), error.message);
    console.error(chalk.gray(`Working directory: ${process.cwd()}`));
    process.exit(1);
  }
}

async function getDiff(options) {
  try {
    if (options.stageAllChanges) {
      await stageAllChanges(options);
    }

    const status = await git.status();
    
    if (status.staged.length === 0) {
      console.error(chalk.yellow('No staged changes found.'));
      process.exit(0);
    }

    const diffOptions = ['--minimal', '--ignore-all-space', '--ignore-blank-lines']
    const diff = await git.diff(['--cached', ...diffOptions]);

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

function convertSshToHttps(url, service) {
  return url
    .replace(new RegExp(`^git@${service}:`), `https://${service}/`)
    .replace(/\.git$/, '')
    .replace(/\/$/, ''); // Remove trailing slash if present
}

function handleFetch({ url, body, token, method = 'POST' }) {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function saveCommitLink({ token, messageId }) {
  const commitHash = await git.revparse(['HEAD']);
    
    // Get the remote URL and parse it to construct the commit link
    const remotes = await git.remote(['get-url', 'origin']);
    const remoteUrl = remotes.trim();
    
    let commitLink = '';

    if (remoteUrl) {
      // Handle different git hosting services
      if (remoteUrl.includes('github.com')) {
        const httpsUrl = convertSshToHttps(remoteUrl, 'github.com');
        commitLink = `${httpsUrl}/commit/${commitHash}`;
      } else if (remoteUrl.includes('gitlab.com')) {
        const httpsUrl = convertSshToHttps(remoteUrl, 'gitlab.com');
        commitLink = `${httpsUrl}/-/commit/${commitHash}`;
      } else if (remoteUrl.includes('bitbucket.org')) {
        const httpsUrl = convertSshToHttps(remoteUrl, 'bitbucket.org');
        commitLink = `${httpsUrl}/commits/${commitHash}`;
      } else {
        commitLink = commitHash;
      }
    } else {
      commitLink = commitHash;
    }

    try {
      await handleFetch({ 
        url: SAVE_COMMIT_LINK_URL, 
        body: { commitLink, messageId }, 
        token,
      });
    } catch (error) {
      console.error(chalk.yellow('Warning: Failed to save commit link:'), error.message);
    }

    return commitLink;
}

async function callCommitMessageAPI({ diff, token, options }) {
  try {
    const response = await handleFetch({ 
      url: API_URL, 
      body: { diff, header: options.header }, 
      token
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate commit message');
    }

    const data = await response.json();

    if (data.usageMessage) {
      console.log(`\n${chalk.yellow(data.usageMessage)}`);
    }

    return { message: data.message, id: data.id };
  } catch (error) {
    console.error(chalk.red('Error calling API:'), error.message);
    process.exit(1);
  }
}

async function commitChanges({ message, shouldPush = false, token, messageId }) {
  try {
    const answer = await new Promise(resolve => {
      const action = shouldPush ? 'COMMIT AND PUSH' : 'COMMIT';
      process.stdout.write(chalk.yellow(`Do you want to ${action} the staged changes with this message? (y/yes): `));
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (answer === 'y' || answer === 'yes') {
      await git.commit(message);
      console.log(chalk.green('Changes committed successfully!'));

      if (shouldPush) {  
        const commitLink = await saveCommitLink({ token, messageId });

        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        await git.push('origin', currentBranch);
        console.log(chalk.green(`Changes pushed to origin/${currentBranch} successfully!`));
        if (commitLink) {
          console.log(chalk.green(`Commit link: ${commitLink}`));
        }
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

    const { message, id } = await callCommitMessageAPI({ diff, token, options });

    await clipboardy.write(message);
    console.log(chalk.green('\nGenerated commit message (copied to clipboard):\n'));
    console.log(chalk.white(message));

    if (options.commitAndPushStaged) {
      await commitChanges({ message, shouldPush: true, token, messageId: id });
    } else if (options.commitStaged) {
      await commitChanges({ message, shouldPush: false, token });
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Unexpected error:'), error.message);
    process.exit(1);
  }
} 