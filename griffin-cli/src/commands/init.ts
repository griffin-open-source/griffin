import {
  initState,
  stateExists,
  getStateFilePath,
  addEnvironment,
} from "../core/state.js";
import { detectProjectId } from "../core/project.js";

export interface InitOptions {
  project?: string;
}

/**
 * Initialize griffin in the current directory
 */
export async function executeInit(options: InitOptions): Promise<void> {
  console.log("Initializing griffin...");

  // Check if already initialized
  if (await stateExists()) {
    console.error(
      `Error: Already initialized (state file exists: ${getStateFilePath()})`,
    );
    process.exit(1);
  }

  // Determine project ID
  let projectId = options.project;
  if (!projectId) {
    projectId = await detectProjectId();
  }

  console.log(`Project: ${projectId}`);
  console.log("");

  // Initialize state file
  await initState(projectId);
  console.log(`✓ Created state file: ${getStateFilePath()}`);

  // Create a default local environment with a default target
  await addEnvironment("local", {
    targets: { default: "http://localhost:3000" },
  });
  console.log(`✓ Created default 'local' environment`);
  console.log(`  default: http://localhost:3000`);

  console.log("");
  console.log("Initialization complete!");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Add targets to local environment:");
  console.log(
    "     griffin local config add-target --env local --key api --url http://localhost:3000",
  );
  console.log(
    "  2. Create test plans (*.griffin.ts files in __griffin__/ directories)",
  );
  console.log("  3. Run tests locally:");
  console.log("     griffin local run");
  console.log("  4. Connect to hub (optional):");
  console.log("     griffin hub connect --url <url> --token <token>");
  console.log("  5. Deploy to hub:");
  console.log("     griffin hub apply");
}
