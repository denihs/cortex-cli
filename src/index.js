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
  .option('--stageAllChanges', 'Stage all changes before generating the message')
  .option('--include <patterns...>', '<Used when stageAllChanges is active> Include only files matching these patterns when staging (supports glob patterns)')
  .option('--exclude <patterns...>', '<Used when stageAllChanges is active> Exclude files matching these patterns when staging (supports glob patterns)')
  .option('--header <text>', 'Add a custom header to the commit message')
  .option('--preScript <command>', 'Execute a command before generating the commit message')
  .option('--commitStaged', 'Commit staged changes with the generated message')
  .option('--commitAndPushStaged', 'Commit staged changes and push them to the remote repository with the generated message')
  .option('--verbose', 'Show detailed information about the current configuration and execution')
  .action(generateCommitMessage);

program.parse(); 