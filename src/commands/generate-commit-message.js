import chalk from 'chalk';
import simpleGit from 'simple-git';

const git = simpleGit();

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

async function getDiff(options) {
  try {
    const status = await git.status();
    
    // Check if there are any changes according to the options
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
      // Default: only staged changes
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
    const response = await fetch('http://localhost:5000/api/generate-commit-message', {
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

async function commitChanges(message) {
  try {
    const answer = await new Promise(resolve => {
      process.stdout.write(chalk.yellow('Do you want to commit the staged changes with this message? (y/yes): '));
      process.stdin.once('data', data => {
        resolve(data.toString().trim().toLowerCase());
      });
    });

    if (answer === 'y' || answer === 'yes') {
      await git.commit(message);
      console.log(chalk.green('Changes committed successfully!'));
    }
  } catch (error) {
    console.error(chalk.red('Error committing changes:'), error.message);
    process.exit(1);
  }
}

export async function generateCommitMessage(options) {
  // Validate environment and repository
  const token = validateEnvironment();
  await validateGitRepository();

  // Get the diff based on options
  const diff = await getDiff(options);

  // Call the API to generate the commit message
  const message = await callCommitMessageAPI(diff, token);

  // Show the generated message
  console.log(chalk.green('\nGenerated commit message:\n'));
  console.log(chalk.white(message));
  console.log(chalk.yellow('\nPlease copy the message above to use it.\n'));

  // Handle commit if requested
  if (options.commitStaged) {
    await commitChanges(message);
  }
} 