import { loadState, resolveEnvironment } from "../../core/state.js";
import { discoverMonitors, formatDiscoveryErrors } from "../../core/discovery.js";
import { createSdkWithCredentials } from "../../core/sdk.js";
import { computeDiff, formatDiff, formatDiffJson } from "../../core/diff.js";
import { terminal } from "../../utils/terminal.js";
import { withSDKErrorHandling } from "../../utils/sdk-error.js";
import { loadVariables } from "../../core/variables.js";
import { resolveMonitor } from "../../resolve.js";

export interface MonitorOptions {
  json?: boolean;
  env: string;
}

/**
 * Show what changes would be applied
 */
export async function executeMonitor(options: MonitorOptions): Promise<void> {
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

    // Discover local monitors
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    const spinner = terminal.spinner("Discovering local monitors...").start();
    const { monitors, errors } = await discoverMonitors(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      spinner.fail("Discovery failed");
      terminal.error(formatDiscoveryErrors(errors));
      terminal.exit(1);
    }

    spinner.succeed(`Found ${monitors.length} local monitor(s)`);

    // Create SDK clients with credentials
    const sdk = await createSdkWithCredentials(state.hub!.baseUrl);

    // Fetch remote monitors for this project + environment
    const fetchSpinner = terminal.spinner("Fetching remote monitors...").start();
    const response = await withSDKErrorHandling(
      () =>
        sdk.getMonitor({
          query: {
            projectId: state.projectId,
            environment: envName,
          },
        }),
      "Failed to fetch remote monitors",
    );
    const remoteMonitors = response?.data?.data!;
    fetchSpinner.succeed(`Found ${remoteMonitors.length} remote monitor(s)`);

    // Load variables and resolve local monitors before computing diff
    const variables = await loadVariables(envName);
    const resolvedMonitors = monitors.map((p) =>
      resolveMonitor(p.monitor, state.projectId, envName, variables),
    );

    // Compute diff (no deletions shown by default)
    const diff = computeDiff(resolvedMonitors, remoteMonitors, {
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
