import { loadState } from "../../core/state.js";
import { getHubCredentials } from "../../core/credentials.js";
import { terminal } from "../../utils/terminal.js";

/**
 * Show hub connection status
 */
export async function executeStatus(): Promise<void> {
  try {
    const state = await loadState();

    if (!state.hub) {
      terminal.warn("No hub connection configured.");
      terminal.blank();
      terminal.dim("Connect with:");
      terminal.dim("  griffin hub connect --url <url> --token <token>");
      return;
    }

    // Read credentials from user-level credentials file
    const credentials = await getHubCredentials();

    terminal.info("Hub connection:");
    terminal.log(`  URL: ${terminal.colors.cyan(state.hub.baseUrl)}`);
    if (credentials?.token) {
      terminal.log(
        `  API Token: ${terminal.colors.dim(credentials.token.substring(0, 8) + "...")}`,
      );
      terminal.log(
        `  Updated: ${terminal.colors.dim(new Date(credentials.updatedAt).toLocaleString())}`,
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
