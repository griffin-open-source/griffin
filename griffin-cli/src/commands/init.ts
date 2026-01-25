import {
  initState,
  stateExists,
  getStateFilePath,
  addEnvironment,
} from "../core/state.js";
import { detectProjectId } from "../core/project.js";
import { terminal } from "../utils/terminal.js";

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

  terminal.blank();
  terminal.success("Initialization complete!");
  terminal.blank();
  terminal.info("Next steps:");
  terminal.dim("  1. Create a variables.yaml file in the project root:");
  terminal.dim("     environments:");
  terminal.dim("       dev:");
  terminal.dim("         api-service: http://localhost:3000");
  terminal.dim("       staging:");
  terminal.dim("         api-service: https://staging.api.com");
  terminal.dim("       production:");
  terminal.dim("         api-service: https://api.example.com");
  terminal.dim(
    "  2. Create test plans (*.griffin.ts files in __griffin__/ directories)",
  );
  terminal.dim("  3. Run tests locally:");
  terminal.dim("     griffin local run");
  terminal.dim("  4. Connect to hub (optional):");
  terminal.dim("     griffin hub connect --url <url> --token <token>");
  terminal.dim("  5. Deploy to hub:");
  terminal.dim("     griffin hub apply");
  terminal.blank();
}
