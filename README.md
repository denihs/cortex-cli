# Cortex CLI

A command-line tool to generate commit messages based on your repository changes.

## Installation

```bash
npm install -g @denyhs/cortex-cli
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

### Configuration File

You can also create a `.cortexrc` file in your project root to set default options:

```json
{
  "stageChanges": true,
  "include": ["src/**/*.js", "lib/**/*.js"],
  "exclude": ["test/**", "**/*.test.js"],
  "header": "feat: ",
  "commitStaged": true
}
```

#### IDE Support

To make your IDE treat `.cortexrc` as a JSON file:

**VS Code**
The repository includes `.vscode/settings.json` with the correct configuration:
```json
{
  "files.associations": {
    ".cortexrc": "json"
  }
}
```

**JetBrains IDEs (WebStorm, IntelliJ, etc.)**
The repository includes `.idea/fileTypes/cortexrc.xml` with the correct configuration. If you're not using the provided configuration:
1. Go to Preferences/Settings → Editor → File Types
2. Find "JSON" in the list
3. Add `cortexrc` pattern under "File name patterns"

**Vim/Neovim**
Add to your configuration:
```vim
autocmd BufNewFile,BufRead .cortexrc setfiletype json
```

### Configuration Priority

The CLI follows a strict priority order when applying configurations:

1. Command-line flags (highest priority)
2. `.cortexrc` file settings (lower priority)
3. Default values (lowest priority)

For example, if you have this `.cortexrc`:
```json
{
  "include": ["src/**/*.js"],
  "header": "feat: "
}
```
And run:
```bash
cortex commit-message --include "lib/**/*.js" --header "fix: "
```
The CLI will use:
- `include: ["lib/**/*.js"]` (from command line)
- `header: "fix: "` (from command line)

The values in `.cortexrc` are overridden by the command-line flags.

### Configuration Examples

Here are some common `.cortexrc` configurations:

```json
// Basic configuration for a JavaScript project
{
  "stageChanges": true,
  "include": ["src/**/*.js", "lib/**/*.js"],
  "exclude": ["**/*.test.js", "**/*.spec.js"],
  "header": "feat: "
}

// TypeScript project with automatic commit
{
  "stageChanges": true,
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["**/*.test.ts", "**/__tests__/**"],
  "commitStaged": true,
  "header": "fix: "
}

// Full-stack project configuration
{
  "stageChanges": true,
  "include": [
    "frontend/src/**/*.{js,jsx,ts,tsx}",
    "backend/src/**/*.js",
    "shared/**/*.js"
  ],
  "exclude": [
    "**/*.test.*",
    "**/*.spec.*",
    "**/dist/**",
    "**/build/**"
  ],
  "commitAndPush": true
}

// Configuration for documentation changes
{
  "stageChanges": true,
  "include": [
    "docs/**/*.md",
    "**/*.mdx",
    "**/README.md"
  ],
  "header": "docs: ",
  "commitStaged": true
}
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
- `--stageChanges`: Stage changes before generating the message
- `--include <patterns...>`: Include only files matching these patterns when staging (supports glob patterns)
- `--exclude <patterns...>`: Exclude files matching these patterns when staging (supports glob patterns)
- `--header <text>`: Add a custom header to the commit message (will be added above the generated message)
- `--commitStaged`: After generating the message, prompt to commit staged changes
- `--commitAndPush`: After generating the message, prompt to commit staged changes and push them to the remote repository

### Examples

```bash
# Generate message for staged changes
cortex commit-message

# Generate message for all changes
cortex commit-message --all

# Stage specific files and generate message
cortex commit-message --stageChanges --include "src/**/*.js" --exclude "**/*.test.js"

# Stage changes in specific directories
cortex commit-message --stageChanges --include "src/**" "lib/**" --exclude "test/**"

# Stage changes with patterns and commit
cortex commit-message --stageChanges --include "src/**/*.js" --header="feat: new feature" --commitStaged

# Stage filtered changes, generate message, and commit and push
cortex commit-message --stageChanges --include "src/**" --exclude "test/**" --commitAndPush

# Generate message with a custom header
cortex commit-message --header="feat: new feature implementation"

# Generate message, commit, and push with a custom header
cortex commit-message --commitAndPush --header="fix: resolve critical bug"
```

## Features

- Generates commit messages based on git diff
- Supports different scopes of changes (staged, unstaged, or all)
- Configurable via `.cortexrc` file or command-line options
- Pattern-based file inclusion/exclusion for staging
- Automatic staging of filtered changes
- Copies generated message to clipboard
- Optional custom header for commit messages
- Optional automatic commit after message generation
- Optional automatic push to remote after commit
- Environment variable validation
- Git repository validation
