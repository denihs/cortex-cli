#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import { generateCommitMessage } from './commands/generate-commit-message.js';

// Load environment variables
dotenv.config();

program
  .name('cortex')
  .description('CLI tool to generate commit messages based on repository changes')
  .version('1.0.0');

program
  .command('commit-message')
  .description('Generate a commit message based on staged changes')
  .option('--onlyStaged', 'Generate message only for staged changes (default behavior)')
  .option('--onlyUnstaged', 'Generate message only for unstaged changes')
  .option('--all', 'Generate message for all changes (staged and unstaged)')
  .option('--stageAll', 'Stage all changes before generating the message')
  .option('--header <text>', 'Add a custom header to the commit message')
  .option('--commitStaged', 'Commit staged changes with the generated message')
  .option('--commitAndPush', 'Commit staged changes and push them to the remote repository')
  .action(generateCommitMessage);

program.parse(); 