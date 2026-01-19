import { loadState, saveState } from "../../core/state.js";

export interface ConnectOptions {
  url: string;
  token?: string;
}

/**
 * Configure hub connection settings
 */
export async function executeConnect(options: ConnectOptions): Promise<void> {
  try {
    const state = await loadState();

    // Update runner config
    state.runner = {
      baseUrl: options.url,
      apiToken: options.token,
    };

    await saveState(state);

    console.log("✓ Hub connection configured");
    console.log(`  URL: ${options.url}`);
    if (options.token) {
      console.log("  API Token: ***");
    }
    console.log("");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
