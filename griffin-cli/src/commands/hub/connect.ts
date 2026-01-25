import { randomBytes } from "crypto";
import { loadState, saveState } from "../../core/state.js";
import { saveHubCredentials } from "../../core/credentials.js";
import { terminal } from "../../utils/terminal.js";

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

    // Save token to user-level credentials file if provided
    if (options.token) {
      await saveHubCredentials(options.token);
    }

    // Update hub config in project state (without token)
    state.hub = {
      baseUrl: options.url,
      clientId: randomBytes(16).toString("hex"),
    };

    await saveState(state);

    terminal.success("Hub connection configured");
    terminal.log(`  URL: ${terminal.colors.cyan(options.url)}`);
    if (options.token) {
      terminal.log(
        `  API Token: ${terminal.colors.dim("***")} (saved to user credentials)`,
      );
    }
    terminal.blank();
  } catch (error: any) {
    terminal.error(error.message);
    terminal.exit(1);
  }
}
