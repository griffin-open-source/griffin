import { loadState } from "../../core/state.js";
import { terminal } from "../../utils/terminal.js";

/**
 * Show hub connection status
 */
export async function executeStatus(): Promise<void> {
  try {
    const state = await loadState();

    if (!state.runner) {
      terminal.warn("No hub connection configured.");
      terminal.blank();
      terminal.dim("Connect with:");
      terminal.dim("  griffin hub connect --url <url> --token <token>");
      return;
    }

    terminal.info("Hub connection:");
    terminal.log(`  URL: ${terminal.colors.cyan(state.runner.baseUrl)}`);
    if (state.runner.apiToken) {
      terminal.log(
        `  API Token: ${terminal.colors.dim(state.runner.apiToken.substring(0, 8) + "...")}`,
      );
    } else {
      terminal.log(`  API Token: ${terminal.colors.dim("(not set)")}`);
    }
    terminal.blank();
  } catch (error: any) {
    terminal.error(error.message);
    terminal.exit(1);
  }
}
