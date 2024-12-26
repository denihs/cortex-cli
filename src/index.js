#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import { generateCommitMessage } from './commands/generate-commit-message.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json')));

program
  .name('cortex')
  .description('CLI tool to generate commit messages based on repository changes')
  .version(packageJson.version);

program
  .command('commit-message')
  .description('Generate a commit message based on staged changes')
  .option('--onlyStaged <value>', 'Generate message only for staged changes (default behavior)')
  .option('--onlyUnstaged <value>', 'Generate message only for unstaged changes')
  .option('--all <value>', 'Generate message for all changes (staged and unstaged)')
  .option('--stageChanges <value>', 'Stage changes before generating the message')
  .option('--header <text>', 'Add a custom header to the commit message')
  .option('--commitStaged <value>', 'Commit staged changes with the generated message')
  .option('--commitAndPush <value>', 'Commit staged changes and push them to the remote repository')
  .option('--include <patterns...>', 'Include only files matching these patterns when staging (supports glob patterns)')
  .option('--exclude <patterns...>', 'Exclude files matching these patterns when staging (supports glob patterns)')
  .option('--verbose <value>', 'Show detailed information about the current configuration and execution')
  .action(generateCommitMessage);

program.parse(); 