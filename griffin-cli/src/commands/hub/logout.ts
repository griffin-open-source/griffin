import { loadState } from "../../core/state.js";
import { removeHubCredentials } from "../../core/credentials.js";
import { terminal } from "../../utils/terminal.js";

export interface LogoutOptions {}

/**
 * Remove stored credentials for hub
 */
export async function executeLogout(options: LogoutOptions): Promise<void> {
  try {
    await removeHubCredentials();
    terminal.success("Credentials removed.");
    terminal.blank();
  } catch (error: any) {
    terminal.error(error.message);
    terminal.exit(1);
  }
}
