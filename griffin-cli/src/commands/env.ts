import { loadState } from "../core/state.js";
import { terminal } from "../utils/terminal.js";

/**
 * List all available environments
 */
export async function executeEnvList(): Promise<void> {
  try {
    const state = await loadState();

    const environments = Object.keys(state.environments);

    if (environments.length === 0) {
      terminal.warn("No environments configured.");
      terminal.blank();
      terminal.dim("Run 'griffin init' to set up your project.");
      return;
    }

    terminal.info("Available environments:");
    terminal.blank();

    for (const envName of environments) {
      const isDefault = state.defaultEnvironment === envName;
      const marker = isDefault
        ? terminal.colors.green("●")
        : terminal.colors.dim("○");
      const envDisplay = isDefault
        ? terminal.colors.cyan(envName) + terminal.colors.dim(" (default)")
        : envName;
      terminal.log(`  ${marker} ${envDisplay}`);
    }

    terminal.blank();
  } catch (error) {
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
