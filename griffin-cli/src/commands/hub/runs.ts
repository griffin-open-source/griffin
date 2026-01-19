import { loadState } from "../../core/state.js";
import { createSdkClients } from "../../core/sdk.js";

export interface RunsOptions {
  plan?: string;
  limit?: number;
}

/**
 * Show recent runs from the hub
 */
export async function executeRuns(options: RunsOptions): Promise<void> {
  try {
    // Load state
    const state = await loadState();

    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    // Create SDK clients
    const { runsApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken || undefined,
    });

    console.log(`Hub: ${state.runner.baseUrl}`);
    console.log("");

    // Get recent runs
    const limit = options.limit || 10;
    const response = await runsApi.runsGet(options.plan, undefined, limit, 0);
    const runs = response.data as any;

    if (runs.total === 0) {
      console.log("No runs found.");
      return;
    }

    console.log(`Recent runs (${runs.total} total):`);
    console.log("");

    for (const run of runs.runs) {
      const statusIcon = getStatusIcon(run.status, run.success);
      const duration = run.duration_ms
        ? ` (${(run.duration_ms / 1000).toFixed(2)}s)`
        : "";

      console.log(`${statusIcon} ${run.planName}`);
      console.log(`  ID: ${run.id}`);
      console.log(`  Status: ${run.status}${duration}`);
      console.log(`  Started: ${new Date(run.startedAt).toLocaleString()}`);

      if (run.completedAt) {
        console.log(
          `  Completed: ${new Date(run.completedAt).toLocaleString()}`,
        );
      }

      if (run.errors && run.errors.length > 0) {
        console.log(`  Errors:`);
        for (const error of run.errors.slice(0, 3)) {
          console.log(`    - ${error}`);
        }
        if (run.errors.length > 3) {
          console.log(`    ... and ${run.errors.length - 3} more`);
        }
      }

      console.log("");
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

function getStatusIcon(status: string, success?: boolean): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "running":
      return "🏃";
    case "completed":
      return success ? "✓" : "✗";
    case "failed":
      return "✗";
    default:
      return "•";
  }
}
