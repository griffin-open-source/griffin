import { loadState, resolveEnvironment } from "../../core/state.js";
import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import { discoverMonitors, formatDiscoveryErrors } from "../../core/discovery.js";
import { computeDiff, formatDiff } from "../../core/diff.js";
import { applyDiff, formatApplyResult } from "../../core/apply.js";
import { createSdkWithCredentials } from "../../core/sdk.js";
import { terminal } from "../../utils/terminal.js";
import { withSDKErrorHandling } from "../../utils/sdk-error.js";
import { loadVariables } from "../../core/variables.js";
import { resolveMonitor } from "../../resolve.js";

export interface ApplyOptions {
  autoApprove?: boolean;
  dryRun?: boolean;
  env: string;
  prune?: boolean; // If true, delete remote monitors not in local
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
    if (!state.hub?.baseUrl) {
      terminal.error("Hub connection not configured.");
      terminal.dim("Connect with:");
      terminal.dim("  griffin hub connect --url <url> --token <token>");
      terminal.exit(1);
    }

    terminal.info(`Applying to ${terminal.colors.cyan(envName)} environment`);
    terminal.blank();

    // Create SDK clients with credentials
    const sdk = await createSdkWithCredentials(state.hub!.baseUrl);

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

    // Compute diff (include deletions if --prune)
    const diff = computeDiff(resolvedMonitors, remoteMonitors, {
      includeDeletions: options.prune || false,
    });

    // Show monitor
    terminal.blank();
    terminal.log(formatDiff(diff));
    terminal.blank();

    // Check if there are changes
    if (
      diff.summary.creates + diff.summary.updates + diff.summary.deletes ===
      0
    ) {
      terminal.success("No changes to apply.");
      return;
    }

    // Show deletions warning if --prune
    if (options.prune && diff.summary.deletes > 0) {
      terminal.warn(
        `--prune will DELETE ${diff.summary.deletes} monitor(s) from the hub`,
      );
      terminal.blank();
    }

    // Ask for confirmation unless auto-approved
    if (!options.autoApprove && !options.dryRun) {
      const confirmed = await terminal.confirm(
        "Do you want to perform these actions?",
      );
      if (!confirmed) {
        terminal.warn("Apply cancelled.");
        return;
      }
    }

    // Apply changes with environment injection
    const applySpinner = terminal.spinner("Applying changes...").start();
    const result = await applyDiff(diff, sdk, {
      dryRun: options.dryRun,
    });

    if (result.success) {
      applySpinner.succeed("Changes applied successfully");
    } else {
      applySpinner.fail("Apply failed");
    }

    terminal.blank();
    terminal.log(formatApplyResult(result));

    if (!result.success) {
      terminal.exit(1);
    }
  } catch (error) {
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
