import fs from "node:fs/promises";
import path from "node:path";
import {
  initState,
  stateExists,
  getStateFilePath,
  addEnvironment,
} from "../core/state.js";
import { detectProjectId } from "../core/project.js";
import { terminal } from "../utils/terminal.js";

const VARIABLES_FILE = "variables.yaml";

const VARIABLES_TEMPLATE = `# Per-environment variables for test plans. Reference in plans with variable("key").
# Edit values below for each environment.
environments:
  dev:
    # api_key: "your-api-key"
  staging:
    # api_key: "your-staging-key"
  production:
    # api_key: "your-production-key"
`;

export interface InitOptions {
  project?: string;
}

/**
 * Initialize griffin in the current directory
 */
export async function executeInit(options: InitOptions): Promise<void> {
  const spinner = terminal.spinner("Initializing griffin...").start();

  // Check if already initialized
  if (await stateExists()) {
    spinner.fail("Already initialized");
    terminal.dim(`State file exists: ${getStateFilePath()}`);
    terminal.exit(1);
  }

  // Determine project ID
  let projectId = options.project;
  if (!projectId) {
    projectId = await detectProjectId();
  }

  spinner.succeed(`Project: ${terminal.colors.cyan(projectId)}`);

  // Initialize state file
  await initState(projectId);
  terminal.success(
    `Created state file: ${terminal.colors.dim(getStateFilePath())}`,
  );

  // Create default environments
  await addEnvironment("dev", {});
  await addEnvironment("staging", {});
  await addEnvironment("production", {});
  terminal.success("Created default environments (dev, staging, production)");

  // Create variables.yaml if it doesn't exist
  const variablesPath = path.join(process.cwd(), VARIABLES_FILE);
  try {
    await fs.access(variablesPath);
    terminal.dim(`variables.yaml already exists, skipping`);
  } catch {
    await fs.writeFile(variablesPath, VARIABLES_TEMPLATE, "utf-8");
    terminal.success(`Created ${terminal.colors.dim(VARIABLES_FILE)}`);
  }

  terminal.blank();
  terminal.success("Initialization complete!");
  terminal.blank();
  terminal.info("Next steps:");
  terminal.dim("  1. Edit variables.yaml to set api_host and other variables per environment");
  terminal.dim(
    "  2. Create test plans (*.ts files in __griffin__/ directories)",
  );
  terminal.dim("  3. Run tests locally (pass environment name):");
  terminal.dim("     griffin local run dev");
  terminal.dim("  4. Connect to hub (optional):");
  terminal.dim("     griffin hub connect --url <url> --token <token>");
  terminal.dim("  5. Deploy to hub:");
  terminal.dim("     griffin hub apply dev");
  terminal.blank();
}
