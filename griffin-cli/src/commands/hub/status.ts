import { loadState } from "../../core/state.js";

/**
 * Show hub connection status
 */
export async function executeStatus(): Promise<void> {
  try {
    const state = await loadState();

    if (!state.runner) {
      console.log("No hub connection configured.");
      console.log("");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      return;
    }

    console.log("Hub connection:");
    console.log(`  URL: ${state.runner.baseUrl}`);
    if (state.runner.apiToken) {
      console.log(`  API Token: ${state.runner.apiToken.substring(0, 8)}...`);
    } else {
      console.log("  API Token: (not set)");
    }
    console.log("");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
