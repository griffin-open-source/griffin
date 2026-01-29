import type { DiffAction, DiffResult } from "./diff.js";
import type { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import { loadVariables } from "./variables.js";
import { resolveMonitor } from "../resolve.js";
import { terminal } from "../utils/terminal.js";
import { withSDKErrorHandling } from "../utils/sdk-error.js";
export interface ApplyResult {
  success: boolean;
  applied: ApplyAction[];
  errors: ApplyError[];
}

export interface ApplyAction {
  type: "create" | "update" | "delete";
  monitorName: string;
  success: boolean;
  error?: string;
}

export interface ApplyError {
  action: DiffAction;
  error: Error;
}

/**
 * Apply diff actions to the hub.
 * CLI injects both project and environment into monitor payloads.
 */
export async function applyDiff(
  diff: DiffResult,
  sdk: GriffinHubSdk,
  options?: {
    dryRun?: boolean;
  },
): Promise<ApplyResult> {
  const applied: ApplyAction[] = [];
  const errors: ApplyError[] = [];

  // Filter out noop actions
  const actionsToApply = diff.actions.filter((a) => a.type !== "noop");

  if (actionsToApply.length === 0) {
    return { success: true, applied: [], errors: [] };
  }

  // Process each action
  for (const action of actionsToApply) {
    try {
      if (options?.dryRun) {
        terminal.dim(
          `[DRY RUN] Would ${action.type} monitor: ${action.monitor?.name || action.remoteMonitor?.name}`,
        );
        continue;
      }

      switch (action.type) {
        case "create":
          await applyCreate(action, sdk, applied);
          break;
        case "update":
          await applyUpdate(action, sdk, applied);
          break;
        case "delete":
          await applyDelete(action, sdk, applied);
          break;
      }
    } catch (error) {
      terminal.error((error as Error).message);
      errors.push({
        action,
        error: error as Error,
      });

      applied.push({
        type: action.type as "create" | "update" | "delete",
        monitorName: action.monitor?.name || action.remoteMonitor?.name || "unknown",
        success: false,
        error: (error as Error).message,
      });
    }
  }

  return {
    success: errors.length === 0,
    applied,
    errors,
  };
}

/**
 * Apply a create action
 */
async function applyCreate(
  action: DiffAction,
  sdk: GriffinHubSdk,
  applied: ApplyAction[],
): Promise<void> {
  const resolvedMonitor = action.monitor!;

  //const variables = await loadVariables(environment);
  //const resolvedMonitor = resolveMonitor(monitor, projectId, environment, variables);

  const { data: createdMonitor } = await sdk.postMonitor({
    body: resolvedMonitor,
  });

  applied.push({
    type: "create",
    monitorName: createdMonitor!.data.name,
    success: true,
  });

  terminal.success(`Created: ${terminal.colors.cyan(createdMonitor!.data.name)}`);
}

/**
 * Apply an update action
 */
async function applyUpdate(
  action: DiffAction,
  sdk: GriffinHubSdk,
  applied: ApplyAction[],
): Promise<void> {
  const resolvedMonitor = action.monitor!;
  //const remoteMonitor = action.remoteMonitor!;
  //const variables = await loadVariables(environment);
  //const resolvedMonitor = resolveMonitor(monitor, projectId, environment, variables);

  // Use the remote monitor's ID for the update
  await sdk.putMonitorById({
    path: {
      id: action.remoteMonitor!.id,
    },
    body: resolvedMonitor,
  });

  applied.push({
    type: "update",
    monitorName: action.remoteMonitor!.name,
    success: true,
  });

  terminal.success(`Updated: ${terminal.colors.cyan(action.remoteMonitor!.name)}`);
}

/**
 * Apply a delete action
 */
async function applyDelete(
  action: DiffAction,
  sdk: GriffinHubSdk,
  applied: ApplyAction[],
): Promise<void> {
  const remoteMonitor = action.remoteMonitor!;

  await withSDKErrorHandling(
    () =>
      sdk.deleteMonitorById({
        path: {
          id: remoteMonitor.id,
        },
      }),
    `Failed to delete monitor "${remoteMonitor.name}"`,
  );

  applied.push({
    type: "delete",
    monitorName: remoteMonitor.name,
    success: true,
  });

  terminal.success(`Deleted: ${terminal.colors.cyan(remoteMonitor.name)}`);
}

/**
 * Format apply result for display
 */
export function formatApplyResult(result: ApplyResult): string {
  const lines: string[] = [];

  if (result.applied.length === 0) {
    lines.push("No changes applied.");
    return lines.join("\n");
  }

  lines.push("Apply complete:");
  lines.push("");

  for (const action of result.applied) {
    const icon = action.success ? "✓" : "✗";
    const status = action.success ? action.type : `${action.type} (failed)`;
    lines.push(`  ${icon} ${action.monitorName} - ${status}`);
    if (action.error) {
      lines.push(`    Error: ${action.error}`);
    }
  }

  lines.push("");
  lines.push(`Success: ${result.applied.filter((a) => a.success).length}`);
  lines.push(`Failed: ${result.errors.length}`);

  return lines.join("\n");
}
