import { loadState, resolveEnvironment } from "../../core/state.js";
import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import { createSdkWithCredentials } from "../../core/sdk.js";
import { discoverMonitors, formatDiscoveryErrors } from "../../core/discovery.js";
import { computeDiff } from "../../core/diff.js";
import { terminal } from "../../utils/terminal.js";
import { withSDKErrorHandling } from "../../utils/sdk-error.js";
import { loadVariables } from "../../core/variables.js";
import { resolveMonitor } from "../../resolve.js";

export interface RunOptions {
  monitor: string;
  env: string;
  wait?: boolean;
  force?: boolean;
}

/**
 * Trigger a monitor run on the hub
 */
export async function executeRun(options: RunOptions): Promise<void> {
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
    const { monitors: discoveredMonitors, errors } = await discoverMonitors(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      spinner.fail("Discovery failed");
      terminal.error(formatDiscoveryErrors(errors));
      terminal.exit(1);
    }

    // Find local monitor by name
    const localMonitor = discoveredMonitors.find((p) => p.monitor.name === options.monitor);
    if (!localMonitor) {
      spinner.fail(`Monitor "${options.monitor}" not found locally`);
      terminal.blank();
      terminal.info("Available monitors:");
      for (const p of discoveredMonitors) {
        terminal.dim(`  - ${p.monitor.name}`);
      }
      terminal.exit(1);
    }
    spinner.succeed(`Found local monitor: ${terminal.colors.cyan(options.monitor)}`);

    // Fetch remote monitors for this project + environment
    const fetchSpinner = terminal.spinner("Checking hub...").start();
    const response = await withSDKErrorHandling(
      () =>
        sdk.getMonitor({
          query: {
            projectId: state.projectId,
            environment: envName,
          },
        }),
      "Failed to fetch monitors from hub",
    );
    const remoteMonitors = response?.data?.data!;

    // Find remote monitor by name
    const remoteMonitor = remoteMonitors.find((p) => p.name === options.monitor);
    if (!remoteMonitor) {
      fetchSpinner.fail(`Monitor "${options.monitor}" not found on hub`);
      terminal.dim("Run 'griffin hub apply' to sync your monitors first");
      terminal.exit(1);
    }
    fetchSpinner.succeed("Monitor found on hub");

    // Load variables and resolve local monitor before computing diff
    const variables = await loadVariables(envName);
    const resolvedLocalMonitor = resolveMonitor(
      localMonitor!.monitor,
      state.projectId,
      envName,
      variables,
    );

    // Compute diff to check if local monitor differs from remote
    const diff = computeDiff([resolvedLocalMonitor], [remoteMonitor!] as MonitorV1[], {
      includeDeletions: false,
    });

    const hasDiff =
      diff.actions.length > 0 &&
      diff.actions.some((a) => a.type === "update" || a.type === "create");

    if (hasDiff && !options.force) {
      terminal.error(`Local monitor "${options.monitor}" differs from hub`);
      terminal.blank();
      terminal.warn(
        "The monitor on the hub is different from your local version.",
      );
      terminal.dim(
        "Run 'griffin hub apply' to sync, or use --force to run anyway.",
      );
      terminal.exit(1);
    }

    // Trigger the run
    terminal.blank();
    terminal.info(
      `Triggering run for monitor: ${terminal.colors.cyan(options.monitor)}`,
    );
    terminal.log(`Target environment: ${terminal.colors.cyan(envName)}`);

    if (hasDiff && options.force) {
      terminal.warn("Running with --force (local changes not applied)");
    }

    const triggerSpinner = terminal.spinner("Triggering run...").start();
    const runResponse = await withSDKErrorHandling(
      () =>
        sdk.postRunsTriggerByMonitorId({
          path: {
            monitorId: remoteMonitor!.id,
          },
          body: {
            environment: envName,
          },
        }),
      "Failed to trigger run",
    );
    const run = runResponse?.data?.data!;
    triggerSpinner.succeed("Run triggered");

    terminal.blank();
    terminal.log(`Run ID: ${terminal.colors.dim(run.id)}`);
    terminal.log(`Status: ${terminal.colors.cyan(run.status)}`);
    terminal.log(
      `Started: ${terminal.colors.dim(new Date(run.startedAt).toLocaleString())}`,
    );

    // Wait for completion if requested
    if (options.wait) {
      terminal.blank();
      const waitSpinner = terminal
        .spinner("Waiting for run to complete...")
        .start();

      const runId = run.id;
      let completed = false;

      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds

        const runStatusResponse = await withSDKErrorHandling(
          () =>
            sdk.getRunsById({
              path: {
                id: runId,
              },
            }),
          "Failed to fetch run status",
        );
        const run = runStatusResponse?.data?.data!;

        if (run.status === "completed" || run.status === "failed") {
          completed = true;

          if (run.success) {
            waitSpinner.succeed(`Run ${run.status}`);
          } else {
            waitSpinner.fail(`Run ${run.status}`);
          }

          terminal.blank();
          if (run.duration_ms) {
            terminal.log(
              `Duration: ${terminal.colors.dim((run.duration_ms / 1000).toFixed(2) + "s")}`,
            );
          }

          if (run.success !== undefined) {
            const successText = run.success
              ? terminal.colors.green("Yes")
              : terminal.colors.red("No");
            terminal.log(`Success: ${successText}`);
          }

          if (run.errors && run.errors.length > 0) {
            terminal.blank();
            terminal.error("Errors:");
            for (const error of run.errors) {
              terminal.dim(`  - ${error}`);
            }
          }

          if (!run.success) {
            terminal.exit(1);
          }
        }
      }
    } else {
      terminal.blank();
      terminal.dim("Run started. Use 'griffin hub runs' to check progress.");
    }
  } catch (error) {
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}
