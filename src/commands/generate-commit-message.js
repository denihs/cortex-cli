import chalk from "chalk";
import simpleGit from "simple-git";
import clipboardy from "clipboardy";
import fs from "fs/promises";
import path from "path";
import micromatch from "micromatch";
import inquirer from "inquirer";
import { logger } from "../logger.js";

const API_HOSTNAME =
  process.env.CORTEX_COMMIT_MESSAGES_API_HOSTNAME ||
  "https://commits.denyhs.com";
const API_URL = `${API_HOSTNAME}/api/generate-commit-message`;
const SAVE_COMMIT_LINK_URL = `${API_HOSTNAME}/api/save-commit-link`;

const git = simpleGit();

// File patterns that should be treated as binary or large files
const BINARY_FILE_PATTERNS = [
  "*.svg",
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.ico",
  "*.webp",
  "*.pdf",
  "*.mp4",
  "*.webm",
  "*.mov",
  "*.mp3",
  "*.wav",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

function handleFetch({ url, body, token, method = "POST" }) {
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function shouldExcludeContent(filePath) {
  return micromatch.isMatch(filePath, BINARY_FILE_PATTERNS, { basename: true });
}

async function getUserTemplates({ token }) {
  try {
    const response = await handleFetch({
      url: `${API_HOSTNAME}/api/templates-map`,
      method: "GET",
      token,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch user templates");
    }

    const { templates } = await response.json();
    return templates;
  } catch (error) {
    logger.error(
      chalk.yellow("Warning: Failed to fetch user templates:"),
      error.message,
    );
    return {};
  }
}

function getInitialTemplate({
  selectedTemplateName,
  templatesFromApi,
  templateFromConfig,
}) {
  if (
    !templateFromConfig ||
    !templateFromConfig.name ||
    !templatesFromApi[templateFromConfig.name]
  ) {
    return templatesFromApi[selectedTemplateName] || {};
  }

  const templateFromApi = templatesFromApi[templateFromConfig.name];

  const variables = templateFromConfig.variables
    ? templateFromApi.variables.filter(
        (variable) => !templateFromConfig.variables[variable],
      )
    : [];

  return {
    name: templateFromConfig.name,
    variables,
  };
}

async function handleTemplateChoices({ templates, mergedOptions }) {
  const { templateName, template: templateFromConfig = {} } = mergedOptions;

  let selectedTemplateName = templateName || templateFromConfig.name;
  let selectedTemplate = getInitialTemplate({
    selectedTemplateName,
    templatesFromApi: templates,
    templateFromConfig,
  });

  // If no template provided or provided template doesn't exist, show selection prompt
  logger.log("\n");
  if (!selectedTemplateName || !templates[selectedTemplateName]) {
    const templateChoices = [
      ...Object.keys(templates).map((name) => ({
        name,
        value: { name, variables: templates[name].variables },
      })),
      { name: "(none)", value: null },
    ];

    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Choose the template:",
        choices: templateChoices,
      },
    ]);

    if (!choice) {
      return {};
    }

    selectedTemplate = choice;
    selectedTemplateName = choice.name;
  } else {
    logger.log(
      chalk.green("Using the"),
      chalk.white(selectedTemplateName),
      chalk.green("template"),
    );
  }

  // Get variable values from user
  const variables = {};
  if (selectedTemplate.variables) {
    for (const variable of selectedTemplate.variables) {
      // eslint-disable-next-line no-await-in-loop
      const { value } = await inquirer.prompt([
        {
          type: "input",
          name: "value",
          message: `${variable}:`,
        },
      ]);
      variables[variable] = value;
    }
  }

  return {
    template: {
      name: selectedTemplateName,
      variables: {
        ...(templateFromConfig?.variables || {}),
        ...variables,
      },
    },
    ...(templates[selectedTemplateName]?.settings || {}),
  };
}

async function getTemplateOptions({ templates, mergedOptions }) {
  if (!Object.keys(templates).length) {
    logger.log(chalk.yellow("No templates found."));
    return {};
  }

  return handleTemplateChoices({ templates, mergedOptions });
}

async function loadConfigFile() {
  try {
    const configPath = path.join(process.cwd(), ".cortexrc");
    const configExists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);

    if (!configExists) {
      return {};
    }

    const configContent = await fs.readFile(configPath, "utf-8");
    try {
      return JSON.parse(configContent);
    } catch (error) {
      logger.error(
        chalk.yellow(
          "Warning: .cortexrc file exists but is not valid JSON. Ignoring configuration file.",
        ),
      );
      return {};
    }
  } catch (error) {
    logger.error(
      chalk.yellow(
        "Warning: Error reading .cortexrc file. Ignoring configuration file.",
      ),
    );
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
    include:
      normalizedCliOptions.include.length > 0
        ? normalizedCliOptions.include
        : normalizedConfigOptions.include,
    exclude:
      normalizedCliOptions.exclude.length > 0
        ? normalizedCliOptions.exclude
        : normalizedConfigOptions.exclude,
  };
}

function getCommitOptions({ cliOptions, configOptions, defaultOptions }) {
  const getWithDefault = (options) => ({ ...defaultOptions, ...options });

  const { commitStaged, commitAndPushStaged } =
    cliOptions.commitStaged || cliOptions.commitAndPushStaged
      ? getWithDefault(cliOptions)
      : getWithDefault(configOptions);

  return { commitStaged, commitAndPushStaged };
}

function mergeOptions({ cliOptions, token }) {
  const defaultOptions = {
    stageAllChanges: false,
    commitStaged: false,
    commitAndPushStaged: false,
    header: "",
    include: [],
    exclude: [],
    verbose: false,
    preScript: "",
    withTemplates: false,
    templateName: "",
    template: {},
  };

  return async () => {
    const configOptions = await loadConfigFile();

    // Validate config options against default options
    const invalidOptions = Object.keys(configOptions).filter(
      (key) => !(key in defaultOptions),
    );
    if (invalidOptions.length > 0) {
      throw new Error(
        `Invalid configuration options found in .cortexrc: ${invalidOptions.join(", ")}`,
      );
    }

    const mergedOptionsWithoutTemplates = {
      ...defaultOptions,
      ...configOptions,
      ...cliOptions,
    };

    let templateOptions = {};
    if (
      mergedOptionsWithoutTemplates.withTemplates ||
      mergedOptionsWithoutTemplates.templateName
    ) {
      const templates = await getUserTemplates({ token });
      templateOptions = await getTemplateOptions({
        templates,
        mergedOptions: mergedOptionsWithoutTemplates,
      });
    }

    const { template, ...settingsFromTemplate } = templateOptions;

    const finalOptions = {
      ...defaultOptions,
      ...settingsFromTemplate,
      ...configOptions,
      ...cliOptions,
      ...getCommitOptions({ cliOptions, configOptions, defaultOptions }),
      ...getIncludeExcludeOptions({ cliOptions, configOptions }),
      template,
    };

    if (finalOptions.verbose) {
      logger.log(chalk.blue("\nConfiguration:"));
      logger.log(chalk.white(JSON.stringify(finalOptions, null, 2)));
      logger.log("");
    }

    return finalOptions;
  };
}

function validateEnvironment() {
  const token = process.env.CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN;
  if (!token) {
    logger.error(
      chalk.red(
        "Error: CORTEX_GENERATE_COMMIT_MESSAGE_TOKEN environment variable is not set",
      ),
    );
    logger.error(
      chalk.yellow("Please set it with your API token to use this command"),
    );
    process.exit(1);
  }
  return token;
}

async function validateGitRepository() {
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      logger.error(chalk.red("Error: Not a git repository"));
      logger.error(
        chalk.yellow("Please run this command from within a git repository"),
      );
      process.exit(1);
    }
  } catch (error) {
    logger.error(chalk.red("Error checking git repository:"), error.message);
    process.exit(1);
  }
}

async function getModifiedFiles() {
  const status = await git.status();
  const files = [
    ...status.not_added,
    ...status.modified,
    ...status.deleted,
    ...status.renamed.map((file) => file.to),
    ...status.created,
  ];

  // Normalize paths to use forward slashes and remove any leading/trailing whitespace
  const normalizedFiles = files.map((file) => file.trim().replace(/\\/g, "/"));

  // Get the current directory name
  const currentDir = process.cwd().split(path.sep).pop();

  // Remove redundant directory prefix if it matches current directory
  return normalizedFiles.map((file) => {
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
      logger.log(chalk.yellow("No changes found to stage."));
      return;
    }

    logger.log(chalk.blue("\nFound modified files:"));
    modifiedFiles.forEach((file) => logger.log(chalk.gray(`  - ${file}`)));

    let filesToStage = modifiedFiles;

    if (options.include.length > 0) {
      filesToStage = micromatch(filesToStage, options.include);
      logger.log(
        chalk.blue("\nFiles matching include patterns:"),
        options.include,
      );
      filesToStage.forEach((file) => logger.log(chalk.gray(`  - ${file}`)));
    }

    if (options.exclude.length > 0) {
      filesToStage = micromatch.not(filesToStage, options.exclude);
      logger.log(
        chalk.blue("\nFiles after applying exclude patterns:"),
        options.exclude,
      );
      filesToStage.forEach((file) => logger.log(chalk.gray(`  - ${file}`)));
    }

    if (filesToStage.length === 0) {
      logger.log(
        chalk.yellow("\nNo files match the include/exclude patterns."),
      );
      return;
    }

    // Stage files one by one and handle errors for each file
    const stagedFiles = [];
    const failedFiles = [];

    logger.log(chalk.blue("\nAttempting to stage files..."));
    for (const file of filesToStage) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await git.add([file]);
        stagedFiles.push(file);
      } catch (error) {
        failedFiles.push({ file, error: error.message });
      }
    }

    // Report success
    if (stagedFiles.length > 0) {
      logger.log(
        chalk.green(`\nSuccessfully staged ${stagedFiles.length} files:`),
      );
      stagedFiles.forEach((file) => logger.log(chalk.white(`  ✓ ${file}`)));
    }

    // Report failures
    if (failedFiles.length > 0) {
      logger.log(
        chalk.yellow(`\nFailed to stage ${failedFiles.length} files:`),
      );
      failedFiles.forEach(({ file, error }) => {
        logger.log(chalk.red(`  ✗ ${file}`));
        logger.log(chalk.gray(`    Error: ${error}`));
        logger.log(chalk.gray(`    Working directory: ${process.cwd()}`));
      });
    }

    // If no files were staged successfully, exit
    if (stagedFiles.length === 0) {
      logger.error(chalk.red("\nNo files were staged successfully."));
      process.exit(1);
    }
  } catch (error) {
    logger.error(chalk.red("Error staging changes:"), error.message);
    logger.error(chalk.gray(`Working directory: ${process.cwd()}`));
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
      logger.error(chalk.yellow("No staged changes found."));
      process.exit(0);
    }

    // Get list of staged files
    const stagedFiles = status.staged;

    // For binary/large files, we'll create a custom diff that only shows the file was modified
    const customDiffs = [];

    for (const file of stagedFiles) {
      if (shouldExcludeContent(file)) {
        const action = status.created.includes(file)
          ? "added"
          : status.deleted.includes(file)
            ? "deleted"
            : "modified";
        customDiffs.push(
          `diff --git a/${file} b/${file}`,
          `--- a/${file}`,
          `+++ b/${file}`,
          `@@ -1 +1 @@`,
          `${action === "deleted" ? "-" : "+"} Binary file ${file} was ${action}`,
        );
      }
    }

    // Get the regular diff for non-binary files
    const diffOptions = [
      "--minimal",
      "--ignore-all-space",
      "--ignore-blank-lines",
    ];

    // Add binary file exclusion patterns
    const excludePatterns = BINARY_FILE_PATTERNS.map(
      (pattern) => `:!${pattern}`,
    );
    const diff = await git.diff([
      "--cached",
      ...diffOptions,
      "--",
      ...excludePatterns,
    ]);

    if (!diff && customDiffs.length === 0) {
      logger.error(
        chalk.yellow("No changes found to generate commit message."),
      );
      process.exit(0);
    }

    // Combine regular diff with custom diffs for binary files
    return [...customDiffs, diff].filter(Boolean).join("\n");
  } catch (error) {
    logger.error(chalk.red("Error getting git diff:"), error.message);
    return process.exit(1);
  }
}

function convertSshToHttps(url, service) {
  return url
    .replace(new RegExp(`^git@${service}:`), `https://${service}/`)
    .replace(/\.git$/, "")
    .replace(/\/$/, ""); // Remove trailing slash if present
}

async function saveCommitLink({ token, messageId }) {
  const commitHash = await git.revparse(["HEAD"]);

  // Get the remote URL and parse it to construct the commit link
  const remotes = await git.remote(["get-url", "origin"]);
  const remoteUrl = remotes.trim();

  let commitLink = "";

  if (remoteUrl) {
    // Handle different git hosting services
    if (remoteUrl.includes("github.com")) {
      const httpsUrl = convertSshToHttps(remoteUrl, "github.com");
      commitLink = `${httpsUrl}/commit/${commitHash}`;
    } else if (remoteUrl.includes("gitlab.com")) {
      const httpsUrl = convertSshToHttps(remoteUrl, "gitlab.com");
      commitLink = `${httpsUrl}/-/commit/${commitHash}`;
    } else if (remoteUrl.includes("bitbucket.org")) {
      const httpsUrl = convertSshToHttps(remoteUrl, "bitbucket.org");
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
    logger.error(
      chalk.yellow("Warning: Failed to save commit link:"),
      error.message,
    );
  }

  return commitLink;
}

async function callCommitMessageAPI({ diff, token, options }) {
  try {
    const response = await handleFetch({
      url: API_URL,
      body: { diff, header: options.header, template: options.template },
      token,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate commit message");
    }

    const data = await response.json();

    if (data.usageMessage) {
      logger.log(`\n${chalk.yellow(data.usageMessage)}`);
    }

    return { message: data.message, id: data.id };
  } catch (error) {
    logger.error(chalk.red("Error calling API:"), error.message);
    return process.exit(1);
  }
}

async function commitChanges({
  message,
  shouldPush = false,
  token,
  messageId,
}) {
  try {
    // Create a new readline interface for this prompt
    const readline = (await import("readline")).default.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      const action = shouldPush ? "COMMIT AND PUSH" : "COMMIT";
      readline.question(
        chalk.yellow(
          `Do you want to ${action} the staged changes with this message? (y/yes): `,
        ),
        (data) => {
          resolve(data.toString().trim().toLowerCase());
          readline.close();
        },
      );
    });

    if (answer === "y" || answer === "yes") {
      await git.commit(message);
      logger.log(chalk.green("Changes committed successfully!"));

      if (shouldPush) {
        const commitLink = await saveCommitLink({ token, messageId });

        const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
        await git.push("origin", currentBranch);
        logger.log(
          chalk.green(
            `Changes pushed to origin/${currentBranch} successfully!`,
          ),
        );
        if (commitLink) {
          logger.log(chalk.green(`Commit link: ${commitLink}`));
        }
      }
    }

    process.exit(0);
  } catch (error) {
    logger.error(
      chalk.red(
        `Error ${error.message.includes("push") ? "pushing" : "committing"} changes:`,
      ),
      error.message,
    );
    process.exit(1);
  }
}

async function executePreScript(command) {
  try {
    logger.log(
      chalk.blue("\nExecuting pre-script command:"),
      chalk.white(command),
    );
    const { execSync } = await import("child_process");
    execSync(command, { stdio: "inherit" });
    logger.log(chalk.green("Pre-script executed successfully!"));
  } catch (error) {
    logger.error(chalk.red("Error executing pre-script:"), error.message);
    process.exit(1);
  }
}

export async function generateCommitMessage(cliOptions) {
  try {
    const token = validateEnvironment();
    await validateGitRepository();

    const options = await mergeOptions({ cliOptions, token })();

    if (options.preScript) {
      await executePreScript(options.preScript);
    }

    const diff = await getDiff(options);

    const { message, id } = await callCommitMessageAPI({
      diff,
      token,
      options,
    });

    await clipboardy.write(message);
    logger.log(
      chalk.green("\nGenerated commit message (copied to clipboard):\n"),
    );
    logger.log(chalk.white(message));

    if (options.commitAndPushStaged) {
      await commitChanges({ message, shouldPush: true, token, messageId: id });
    } else if (options.commitStaged) {
      await commitChanges({ message, shouldPush: false, token });
    }

    process.exit(0);
  } catch (error) {
    logger.error(chalk.red("Unexpected error:"), error.message);
    process.exit(1);
  }
}
