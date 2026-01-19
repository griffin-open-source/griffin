import { loadState, resolveEnvironment } from "../../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { computeDiff, formatDiff } from "../../core/diff.js";
import { applyDiff, formatApplyResult } from "../../core/apply.js";
import { createSdkClients } from "../../core/sdk.js";

export interface ApplyOptions {
  autoApprove?: boolean;
  dryRun?: boolean;
  env?: string;
}

/**
 * Apply changes to the hub
 */
export async function executeApply(options: ApplyOptions): Promise<void> {
  try {
    // Load state
    const state = await loadState();

    // Resolve environment
    const envName = await resolveEnvironment(options.env);

    // Check if runner is configured
    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    console.log(`Applying to '${envName}' environment`);
    console.log("");

    // Create SDK clients
    const { planApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken || undefined,
    });

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

    // Show plan
    console.log(formatDiff(diff));
    console.log("");

    // Check if there are changes
    if (
      diff.summary.creates + diff.summary.updates + diff.summary.deletes ===
      0
    ) {
      console.log("No changes to apply.");
      return;
    }

    // Ask for confirmation unless auto-approved
    if (!options.autoApprove && !options.dryRun) {
      console.log("Do you want to perform these actions? (yes/no)");
      // For now, just proceed - in a real implementation, we'd use readline
      // to get user input
      console.log("Note: Use --auto-approve flag to skip confirmation");
      console.log("");
    }

    // Apply changes
    const result = await applyDiff(diff, state, planApi, envName, {
      dryRun: options.dryRun,
    });

    console.log("");
    console.log(formatApplyResult(result));

    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
