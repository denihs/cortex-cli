# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.3] - 2025-01-15
### Changed
- Improved handling of binary files (SVGs, images, videos, etc.) in diffs to prevent excessive token usage
- Modified how binary files are reported in diffs to only show their status (added/modified/deleted) without content

## [2.1.2] - 2025-01-09
### Changed
- Changed when the message is saved in the app

## [2.1.1] - 2025-01-08
### Changed
- Renamed `stageChanges` to `stageAllChanges` for better clarity
- Renamed `commitAndPush` to `commitAndPushStaged` for consistency with other staged-related flags
- Removed support for different change scopes (`--onlyStaged`, `--onlyUnstaged`, `--all` flags)

### Added
- Validation for configuration options in `.cortexrc` file - now throws an error if unknown options are found

## [2.0.7] - 2025-01-03
### Added
- Log usage message from API

## [2.0.6] - 2024-12-26
### Fixed
- enhances diff accuracy by ignoring unnecessary whitespace and blank lines, improving the quality of commit messages.

## [2.0.5] - 2024-12-26
### Fixed
- Fixed command version by getting it from package.json
- Showing commit link only if shouldPush is true

## [2.0.4] - 2024-12-23
### Fixed
- Fixed boolean CLI options handling to properly accept true/false values
- Improved configuration merging to correctly prioritize CLI boolean options over config file
- Added proper type definitions for boolean flags in Commander.js options

## [2.0.0] - 2024-12-23
### Added
- New `.cortexrc` configuration file support for setting default options
- Pattern-based file filtering with `--include` and `--exclude` options
- Support for glob patterns in file inclusion/exclusion

### Changed
- Renamed `--stageAll` flag to `--stageChanges` for clarity
- Staging behavior now supports selective file inclusion/exclusion
- Improved error handling and user feedback for file staging

### Breaking Changes
- The `--stageAll` flag has been replaced with `--stageChanges`
- Staging behavior now requires explicit patterns when using include/exclude options

## [1.0.6] - 2024-12-20
### Changed
- Updated default API hostname from localhost to production URL (https://commit-messages-production-denihs.svc-us5.zcloud.ws)

## [1.0.5] - 2024-12-19

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