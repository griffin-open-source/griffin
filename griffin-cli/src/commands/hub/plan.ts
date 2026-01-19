import { loadState, resolveEnvironment } from "../../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { createSdkClients } from "../../core/sdk.js";
import { computeDiff, formatDiff, formatDiffJson } from "../../core/diff.js";

export interface PlanOptions {
  json?: boolean;
  env?: string;
}

/**
 * Show what changes would be applied
 */
export async function executePlan(options: PlanOptions): Promise<void> {
  try {
    // Load state
    const state = await loadState();

    // Resolve environment
    const envName = await resolveEnvironment(options.env);

    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    // Discover local plans
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    const { plans, errors } = await discoverPlans(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      console.error(formatDiscoveryErrors(errors));
      process.exit(1);
    }

    // Create SDK clients
    const { planApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken || undefined,
    });

    // Fetch remote plans for this project
    const response = await planApi.planGet(state.projectId);
    const remotePlans = response.data.data.map((p: any) => p);

    // Compute diff for this environment
    const diff = computeDiff(
      plans.map((p) => p.plan),
      state,
      remotePlans,
      envName,
    );

    // Output
    if (options.json) {
      console.log(formatDiffJson(diff));
    } else {
      console.log(formatDiff(diff));
    }

    // Exit with error code if there are changes
    if (
      diff.summary.creates + diff.summary.updates + diff.summary.deletes >
      0
    ) {
      process.exit(2); // Exit code 2 indicates changes pending
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
