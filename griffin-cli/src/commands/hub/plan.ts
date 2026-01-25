import { loadState, resolveEnvironment } from "../../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { createSdkWithCredentials } from "../../core/sdk.js";
import { computeDiff, formatDiff, formatDiffJson } from "../../core/diff.js";
import { terminal } from "../../utils/terminal.js";
import { withSDKErrorHandling } from "../../utils/sdk-error.js";
import { loadVariables } from "../../core/variables.js";
import { resolvePlan } from "../../resolve.js";

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

    if (!state.hub?.baseUrl) {
      terminal.error("Hub connection not configured.");
      terminal.dim("Connect with:");
      terminal.dim("  griffin hub connect --url <url> --token <token>");
      terminal.exit(1);
    }

    // Discover local plans
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    const spinner = terminal.spinner("Discovering local plans...").start();
    const { plans, errors } = await discoverPlans(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      spinner.fail("Discovery failed");
      terminal.error(formatDiscoveryErrors(errors));
      terminal.exit(1);
    }

    spinner.succeed(`Found ${plans.length} local plan(s)`);

    // Create SDK clients with credentials
    const sdk = await createSdkWithCredentials(state.hub!.baseUrl);

    // Fetch remote plans for this project + environment
    const fetchSpinner = terminal.spinner("Fetching remote plans...").start();
    const response = await withSDKErrorHandling(
      () =>
        sdk.getPlan({
          query: {
            projectId: state.projectId,
            environment: envName,
          },
        }),
      "Failed to fetch remote plans",
    );
    const remotePlans = response?.data?.data!;
    fetchSpinner.succeed(`Found ${remotePlans.length} remote plan(s)`);

    // Load variables and resolve local plans before computing diff
    const variables = await loadVariables(envName);
    const resolvedPlans = plans.map((p) =>
      resolvePlan(p.plan, state.projectId, envName, variables),
    );

    // Compute diff (no deletions shown by default)
    const diff = computeDiff(resolvedPlans, remotePlans, {
      includeDeletions: false,
    });

    terminal.blank();

    // Output
    if (options.json) {
      terminal.log(formatDiffJson(diff));
    } else {
      terminal.log(formatDiff(diff));
    }

    // Exit with error code if there are changes
    if (
      diff.summary.creates + diff.summary.updates + diff.summary.deletes >
      0
    ) {
      terminal.exit(2); // Exit code 2 indicates changes pending
    }
  } catch (error) {
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
