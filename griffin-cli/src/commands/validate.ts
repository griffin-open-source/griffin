import { loadState } from "../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../core/discovery.js";
import { terminal } from "../utils/terminal.js";

/**
 * Validate test plan files without syncing
 */
export async function executeValidate(): Promise<void> {
  const spinner = terminal.spinner("Validating test plans...").start();

  try {
    // Load state for discovery settings
    const state = await loadState();
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    // Discover plans
    const { plans, errors } = await discoverPlans(
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
      `Found ${terminal.colors.bold(plans.length.toString())} valid plan(s)`,
    );
    terminal.blank();

    for (const { plan, filePath, exportName } of plans) {
      const shortPath = filePath.replace(process.cwd(), ".");
      const exportInfo =
        exportName === "default" ? "" : terminal.colors.dim(` (${exportName})`);
      terminal.log(
        `  ${terminal.colors.green("●")} ${terminal.colors.cyan(plan.name)}${exportInfo}`,
      );
      terminal.dim(`    ${shortPath}`);
      terminal.dim(
        `    Nodes: ${plan.nodes.length}, Edges: ${plan.edges.length}`,
      );
      if (plan.frequency) {
        terminal.dim(
          `    Schedule: Every ${plan.frequency.every} ${plan.frequency.unit}`,
        );
      }
      terminal.blank();
    }

    terminal.success("All plans are valid");
  } catch (error) {
    spinner.fail("Validation failed");
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
