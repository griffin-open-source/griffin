import { loadState, resolveEnvironment } from "../../core/state.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { createSdk } from "../../core/sdk.js";
import { computeDiff, formatDiff, formatDiffJson } from "../../core/diff.js";
import { terminal } from "../../utils/terminal.js";

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

    // Create SDK clients
    const sdk = createSdk({
      baseUrl: state.runner?.baseUrl || "",
      apiToken: state.runner?.apiToken || "",
    });

    // Fetch remote plans for this project + environment
    const fetchSpinner = terminal
      .spinner("Fetching remote plans...")
      .start();
    const response = await sdk.getPlan({
      query: {
        projectId: state.projectId,
        environment: envName,
      },
    });
    const remotePlans = response?.data?.data!;
    fetchSpinner.succeed(`Found ${remotePlans.length} remote plan(s)`);

    // Compute diff (no deletions shown by default)
    const diff = computeDiff(
      plans.map((p) => p.plan),
      remotePlans,
      { includeDeletions: false },
    );

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
