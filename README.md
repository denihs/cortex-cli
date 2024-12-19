# Cortex CLI

A command-line tool to generate commit messages based on your repository changes.

## Installation

```bash
npm install -g cortex-cli
```

## Configuration

Before using the CLI, you need to set your API token as an environment variable:

```bash
export CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN=your_token_here
```

Or create a `.env` file in your project root:

```
CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN=your_token_here
```

## Usage

```bash
cortex commit-message [options]
```

### Options

- No flags: Generate message for staged changes only (default)
- `--onlyStaged`: Same as default, generate message for staged changes
- `--onlyUnstaged`: Generate message for unstaged changes
- `--all`: Generate message for all changes (staged and unstaged)
- `--header <text>`: Add a custom header to the commit message (will be added above the generated message)
- `--commitStaged`: After generating the message, prompt to commit staged changes
- `--commitAndPush`: After generating the message, prompt to commit staged changes and push them to the remote repository

### Examples

```bash
# Generate message for staged changes
cortex commit-message

# Generate message for all changes
cortex commit-message --all

# Generate message with a custom header
cortex commit-message --header="feat: new feature implementation"

# Generate message, commit, and push with a custom header
cortex commit-message --commitAndPush --header="fix: resolve critical bug"

# Generate message and commit if approved
cortex commit-message --commitStaged
```

## Features

- Generates commit messages based on git diff
- Supports different scopes of changes (staged, unstaged, or all)
- Copies generated message to clipboard
- Optional custom header for commit messages
- Optional automatic commit after message generation
- Optional automatic push to remote after commit
- Environment variable validation
- Git repository validation
