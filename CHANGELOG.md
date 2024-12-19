# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.2] - 2024-12-19

### Added
- New `--stageAll` flag to automatically stage all changes before generating the commit message

## [1.0.0-beta.1] - 2024-12-19

### Added

- Initial release of the Cortex CLI tool
- Core command `cortex commit-message` to generate commit messages
- Support for different change scopes:
  - Staged changes (default)
  - Unstaged changes via `--onlyUnstaged`
  - All changes via `--all`
- Custom commit message header support via `--header` option
- Automatic clipboard integration for generated messages
- Git integration features:
  - Automatic commit via `--commitStaged`
  - Automatic commit and push via `--commitAndPush`
- Environment configuration:
  - Support for API token via environment variable
  - Support for `.env` file configuration
- Validation features:
  - Git repository validation
  - Environment variable validation
  - Changes validation (staged/unstaged)
- Error handling and user feedback:
  - Colored console output
  - Clear error messages
  - Operation status feedback

### Dependencies

- chalk: ^5.3.0 - For colored console output
- clipboardy: ^4.0.0 - For clipboard integration
- commander: ^11.1.0 - For CLI argument parsing
- dotenv: ^16.3.1 - For environment variable management
- simple-git: ^3.22.0 - For git operations 