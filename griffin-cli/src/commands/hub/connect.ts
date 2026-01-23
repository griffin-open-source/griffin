import { loadState, saveState } from "../../core/state.js";
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

    // Update runner config
    state.runner = {
      baseUrl: options.url,
      apiToken: options.token,
    };

    await saveState(state);

    terminal.success("Hub connection configured");
    terminal.log(`  URL: ${terminal.colors.cyan(options.url)}`);
    if (options.token) {
      terminal.log(`  API Token: ${terminal.colors.dim("***")}`);
    }
    terminal.blank();
  } catch (error: any) {
    terminal.error(error.message);
    terminal.exit(1);
  }
}
