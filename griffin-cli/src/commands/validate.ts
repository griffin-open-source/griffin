import { loadState } from "../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../core/discovery.js";

/**
 * Validate test plan files without syncing
 */
export async function executeValidate(): Promise<void> {
  console.log("Validating test plans...");
  console.log("");

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
      console.error(formatDiscoveryErrors(errors));
      console.error("");
      console.error(`✗ Validation failed with ${errors.length} error(s)`);
      process.exit(1);
    }

    // Report success
    console.log(`✓ Found ${plans.length} valid plan(s):`);
    console.log("");

    for (const { plan, filePath, exportName } of plans) {
      const shortPath = filePath.replace(process.cwd(), ".");
      const exportInfo = exportName === "default" ? "" : ` (${exportName})`;
      console.log(`  • ${plan.name}${exportInfo}`);
      console.log(`    ${shortPath}`);
      console.log(`    ID: ${plan.id}`);
      console.log(
        `    Nodes: ${plan.nodes.length}, Edges: ${plan.edges.length}`,
      );
      if (plan.frequency) {
        console.log(
          `    Schedule: Every ${plan.frequency.every} ${plan.frequency.unit}`,
        );
      }
      console.log("");
    }

    console.log("✓ All plans are valid");
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
