import { loadState } from "../../core/state.js";
import { createSdk } from "../../core/sdk.js";
import { terminal } from "../../utils/terminal.js";

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
      terminal.error("Hub connection not configured.");
      terminal.dim("Connect with:");
      terminal.dim("  griffin hub connect --url <url> --token <token>");
      terminal.exit(1);
    }

    // Create SDK clients
    const sdk = createSdk({
      baseUrl: state.runner!.baseUrl,
      apiToken: state.runner!.apiToken || undefined,
    });

    terminal.info(`Hub: ${terminal.colors.cyan(state.runner!.baseUrl)}`);
    terminal.blank();

    // Get recent runs
    const limit = options.limit || 10;
    const spinner = terminal.spinner("Fetching runs...").start();
    const response = await sdk.getRuns({
      query: {
        planId: options.plan,
        limit: limit,
        offset: 0,
      },
    });
    const runsData = response?.data!;

    if (!runsData || runsData.total === 0) {
      spinner.info("No runs found.");
      return;
    }

    if (!Array.isArray(runsData.data)) {
      spinner.fail("Invalid response format");
      terminal.error(`Expected data array but got: ${typeof runsData.data}`);
      terminal.exit(1);
    }

    spinner.succeed(`Found ${runsData.total} run(s)`);
    terminal.blank();

    // Create table
    const table = terminal.table({
      head: ["Status", "Plan", "Duration", "Started"],
    });

    for (const run of runsData.data) {
      try {
        const statusIcon = getStatusIcon(run.status, run.success);
        const duration = run.duration_ms
          ? `${(run.duration_ms / 1000).toFixed(2)}s`
          : "-";
        const started = new Date(run.startedAt).toLocaleString();

        table.push([
          statusIcon,
          run.planId || "-",
          duration,
          started,
        ]);
      } catch (error) {
        terminal.error(`Error processing run ${run.id}: ${(error as Error).message}`);
      }
    }

    try {
      terminal.log(table.toString());
    } catch (error) {
      terminal.error(`Error rendering table: ${(error as Error).message}`);
      terminal.error((error as Error).stack || "");
      terminal.exit(1);
    }

    // Show detailed errors if any
    const runsWithErrors = runsData.data.filter(
      (run) => Array.isArray(run.errors) && run.errors.length > 0,
    );

    if (runsWithErrors.length > 0) {
      terminal.blank();
      terminal.warn("Runs with errors:");
      terminal.blank();

      for (const run of runsWithErrors) {
        terminal.log(
          `${terminal.colors.red("✗")} ${terminal.colors.cyan(run.planId || run.id)}`,
        );
        if (Array.isArray(run.errors) && run.errors.length > 0) {
          const errorsToShow = run.errors.slice(0, 3);
          for (const error of errorsToShow) {
            terminal.dim(`  - ${String(error)}`);
          }
          if (run.errors.length > 3) {
            terminal.dim(`  ... and ${run.errors.length - 3} more`);
          }
        }
        terminal.blank();
      }
    }
  } catch (error) {
    terminal.error((error as Error).message);
    terminal.exit(1);
  }
}

function getStatusIcon(status: string, success?: boolean): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "running":
      return "🏃";
    case "completed":
      return success ? "✅" : "❌";
    case "failed":
      return "❌";
    default:
      return "•";
  }
}
