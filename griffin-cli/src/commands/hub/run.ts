import { loadState, resolveEnvironment } from "../../core/state.js";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import { createSdk } from "../../core/sdk.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { computeDiff } from "../../core/diff.js";
import { terminal } from "../../utils/terminal.js";

export interface RunOptions {
  plan: string;
  env: string;
  wait?: boolean;
  force?: boolean;
}

/**
 * Trigger a plan run on the hub
 */
export async function executeRun(options: RunOptions): Promise<void> {
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

    // Create SDK clients
    const sdk = createSdk({
      baseUrl: state.runner?.baseUrl || "",
      apiToken: state.runner?.apiToken || "",
    });

    // Discover local plans
    const discoveryPattern =
      state.discovery?.pattern || "**/__griffin__/*.{ts,js}";
    const discoveryIgnore = state.discovery?.ignore || [
      "node_modules/**",
      "dist/**",
    ];

    const spinner = terminal.spinner("Discovering local plans...").start();
    const { plans: discoveredPlans, errors } = await discoverPlans(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      spinner.fail("Discovery failed");
      terminal.error(formatDiscoveryErrors(errors));
      terminal.exit(1);
    }

    // Find local plan by name
    const localPlan = discoveredPlans.find((p) => p.plan.name === options.plan);
    if (!localPlan) {
      spinner.fail(`Plan "${options.plan}" not found locally`);
      terminal.blank();
      terminal.info("Available plans:");
      for (const p of discoveredPlans) {
        terminal.dim(`  - ${p.plan.name}`);
      }
      terminal.exit(1);
    }
    spinner.succeed(`Found local plan: ${terminal.colors.cyan(options.plan)}`);

    // Fetch remote plans for this project + environment
    const fetchSpinner = terminal.spinner("Checking hub...").start();
    const response = await sdk.getPlan({
      query: {
        projectId: state.projectId,
        environment: envName,
      },
    });
    const remotePlans = response?.data?.data!;

    // Find remote plan by name
    const remotePlan = remotePlans.find((p) => p.name === options.plan);
    if (!remotePlan) {
      fetchSpinner.fail(`Plan "${options.plan}" not found on hub`);
      terminal.dim("Run 'griffin hub apply' to sync your plans first");
      terminal.exit(1);
    }
    fetchSpinner.succeed("Plan found on hub");

    // Compute diff to check if local plan differs from remote
    const diff = computeDiff([localPlan!.plan], [remotePlan!] as PlanV1[], {
      includeDeletions: false,
    });

    const hasDiff =
      diff.actions.length > 0 &&
      diff.actions.some((a) => a.type === "update" || a.type === "create");

    if (hasDiff && !options.force) {
      terminal.error(`Local plan "${options.plan}" differs from hub`);
      terminal.blank();
      terminal.warn("The plan on the hub is different from your local version.");
      terminal.dim("Run 'griffin hub apply' to sync, or use --force to run anyway.");
      terminal.exit(1);
    }

    // Trigger the run
    terminal.blank();
    terminal.info(`Triggering run for plan: ${terminal.colors.cyan(options.plan)}`);
    terminal.log(`Target environment: ${terminal.colors.cyan(envName)}`);

    if (hasDiff && options.force) {
      terminal.warn("Running with --force (local changes not applied)");
    }

    const triggerSpinner = terminal.spinner("Triggering run...").start();
    const runResponse = await sdk.postRunsTriggerByPlanId({
      path: {
        planId: remotePlan!.id,
      },
      body: {
        environment: envName,
      },
    });
    const run = runResponse?.data?.data!;
    triggerSpinner.succeed("Run triggered");
    
    terminal.blank();
    terminal.log(`Run ID: ${terminal.colors.dim(run.id)}`);
    terminal.log(`Status: ${terminal.colors.cyan(run.status)}`);
    terminal.log(`Started: ${terminal.colors.dim(new Date(run.startedAt).toLocaleString())}`);

    // Wait for completion if requested
    if (options.wait) {
      terminal.blank();
      const waitSpinner = terminal.spinner("Waiting for run to complete...").start();

      const runId = run.id;
      let completed = false;

      while (!completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds

        const runStatusResponse = await sdk.getRunsById({
          path: {
            id: runId,
          },
        });
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
            terminal.log(`Duration: ${terminal.colors.dim((run.duration_ms / 1000).toFixed(2) + "s")}`);
          }

          if (run.success !== undefined) {
            const successText = run.success ? terminal.colors.green("Yes") : terminal.colors.red("No");
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
