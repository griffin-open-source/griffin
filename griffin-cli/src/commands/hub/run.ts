import { loadState, resolveEnvironment } from "../../core/state.js";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import { createSdk } from "../../core/sdk.js";
import { discoverPlans, formatDiscoveryErrors } from "../../core/discovery.js";
import { computeDiff } from "../../core/diff.js";

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
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    // Create SDK clients
    const sdk = createSdk({
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

    const { plans: discoveredPlans, errors } = await discoverPlans(
      discoveryPattern,
      discoveryIgnore,
    );

    if (errors.length > 0) {
      console.error(formatDiscoveryErrors(errors));
      process.exit(1);
    }

    // Find local plan by name
    const localPlan = discoveredPlans.find((p) => p.plan.name === options.plan);
    if (!localPlan) {
      console.error(`Error: Plan "${options.plan}" not found locally`);
      console.error("Available plans:");
      for (const p of discoveredPlans) {
        console.error(`  - ${p.plan.name}`);
      }
      process.exit(1);
    }

    // Fetch remote plans for this project + environment
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
      console.error(`Error: Plan "${options.plan}" not found on hub`);
      console.error("Run 'griffin hub apply' to sync your plans first");
      process.exit(1);
    }

    // Compute diff to check if local plan differs from remote
    const diff = computeDiff([localPlan.plan], [remotePlan] as PlanV1[], {
      includeDeletions: false,
    });

    const hasDiff =
      diff.actions.length > 0 &&
      diff.actions.some((a) => a.type === "update" || a.type === "create");

    if (hasDiff && !options.force) {
      console.error(`Error: Local plan "${options.plan}" differs from hub`);
      console.error("");
      console.error(
        "The plan on the hub is different from your local version.",
      );
      console.error(
        "Run 'griffin hub apply' to sync, or use --force to run anyway.",
      );
      process.exit(1);
    }

    // Trigger the run
    console.log(`Triggering run for plan: ${options.plan}`);
    console.log(`Target environment: ${envName}`);

    if (hasDiff && options.force) {
      console.log("⚠️  Running with --force (local changes not applied)");
    }

    const runResponse = await sdk.postRunsTriggerByPlanId({
      path: {
        planId: remotePlan.id,
      },
      body: {
        environment: envName,
      },
    });
    const run = runResponse?.data?.data!;
    console.log(`Run ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Started: ${new Date(run.startedAt).toLocaleString()}`);

    // Wait for completion if requested
    if (options.wait) {
      console.log("");
      console.log("Waiting for run to complete...");

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

          console.log("");
          console.log(`✓ Run ${run.status}`);

          if (run.duration_ms) {
            console.log(`Duration: ${(run.duration_ms / 1000).toFixed(2)}s`);
          }

          if (run.success !== undefined) {
            console.log(`Success: ${run.success ? "Yes" : "No"}`);
          }

          if (run.errors && run.errors.length > 0) {
            console.log("");
            console.log("Errors:");
            for (const error of run.errors) {
              console.log(`  - ${error}`);
            }
          }

          if (!run.success) {
            process.exit(1);
          }
        } else {
          process.stdout.write(".");
        }
      }
    } else {
      console.log("");
      console.log("Run started. Use 'griffin hub runs' to check progress.");
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
