import { loadState } from "../core/state.js";
import { discoverMonitors, formatDiscoveryErrors } from "../core/discovery.js";
import { terminal } from "../utils/terminal.js";

/**
 * Validate test monitor files without syncing
 */
export async function executeValidate(): Promise<void> {
  const spinner = terminal.spinner("Validating test monitors...").start();

  try {
    // Load state for discovery settings
    const state = await loadState();
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    // Discover monitors
    const { monitors, errors } = await discoverMonitors(
      discoveryPattern,
      discoveryIgnore,
    );

    // Report errors
    if (errors.length > 0) {
      spinner.fail(`Validation failed with ${errors.length} error(s)`);
      terminal.blank();
      terminal.error(formatDiscoveryErrors(errors));
      terminal.exit(1);
    }

    // Report success
    spinner.succeed(
      `Found ${terminal.colors.bold(monitors.length.toString())} valid monitor(s)`,
    );
    terminal.blank();

    for (const { monitor, filePath, exportName } of monitors) {
      const shortPath = filePath.replace(process.cwd(), ".");
      const exportInfo =
        exportName === "default" ? "" : terminal.colors.dim(` (${exportName})`);
      terminal.log(
        `  ${terminal.colors.green("●")} ${terminal.colors.cyan(monitor.name)}${exportInfo}`,
      );
      terminal.dim(`    ${shortPath}`);
      terminal.dim(
        `    Nodes: ${monitor.nodes.length}, Edges: ${monitor.edges.length}`,
      );
      if (monitor.frequency) {
        terminal.dim(
          `    Schedule: Every ${monitor.frequency.every} ${monitor.frequency.unit}`,
        );
      }
      terminal.blank();
    }

    terminal.success("All monitors are valid");
  } catch (error) {
    spinner.fail("Validation failed");
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
