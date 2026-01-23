import type { DiffAction, DiffResult } from "./diff.js";
import type { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import { loadVariables } from "./variables.js";
import { resolvePlan } from "../resolve.js";

export interface ApplyResult {
  success: boolean;
  applied: ApplyAction[];
  errors: ApplyError[];
}

export interface ApplyAction {
  type: "create" | "update" | "delete";
  planName: string;
  success: boolean;
  error?: string;
}

export interface ApplyError {
  action: DiffAction;
  error: Error;
}

/**
 * Apply diff actions to the hub.
 * CLI injects both project and environment into plan payloads.
 */
export async function applyDiff(
  diff: DiffResult,
  sdk: GriffinHubSdk,
  projectId: string,
  environment: string,
  options?: {
    dryRun?: boolean;
  },
): Promise<ApplyResult> {
  const applied: ApplyAction[] = [];
  const errors: ApplyError[] = [];

  // Filter out noop actions
  const actionsToApply = diff.actions.filter((a) => a.type !== "noop");

  if (actionsToApply.length === 0) {
    console.log("No changes to apply.");
    return { success: true, applied: [], errors: [] };
  }

  console.log(`Applying ${actionsToApply.length} change(s)...`);

  // Process each action
  for (const action of actionsToApply) {
    try {
      if (options?.dryRun) {
        console.log(
          `[DRY RUN] Would ${action.type} plan: ${action.plan?.name || action.remotePlan?.name}`,
        );
        continue;
      }

      switch (action.type) {
        case "create":
          await applyCreate(action, sdk, projectId, environment, applied);
          break;
        case "update":
          await applyUpdate(action, sdk, projectId, environment, applied);
          break;
        case "delete":
          await applyDelete(action, sdk, applied);
          break;
      }
    } catch (error) {
      console.error(error);
      errors.push({
        action,
        error: error as Error,
      });

      applied.push({
        type: action.type as "create" | "update" | "delete",
        planName: action.plan?.name || action.remotePlan?.name || "unknown",
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
  projectId: string,
  environment: string,
  applied: ApplyAction[],
): Promise<void> {
  const plan = action.plan!;

  const variables = await loadVariables(environment);
  const resolvedPlan = resolvePlan(plan, projectId, environment, variables);

  console.log(`Creating plan: ${plan.name}`);

  const { data: createdPlan } = await sdk.postPlan({
    body: resolvedPlan,
  });

  applied.push({
    type: "create",
    planName: createdPlan!.data.name,
    success: true,
  });

  console.log(`✓ Created: ${createdPlan!.data.name}`);
}

/**
 * Apply an update action
 */
async function applyUpdate(
  action: DiffAction,
  sdk: GriffinHubSdk,
  projectId: string,
  environment: string,
  applied: ApplyAction[],
): Promise<void> {
  const plan = action.plan!;
  const remotePlan = action.remotePlan!;
  const variables = await loadVariables(environment);
  const resolvedPlan = resolvePlan(plan, projectId, environment, variables);

  console.log(`Updating plan: ${plan.name}`);

  // Use the remote plan's ID for the update
  await sdk.putPlanById({
    path: {
      id: remotePlan.id,
    },
    body: resolvedPlan,
  });

  applied.push({
    type: "update",
    planName: plan.name,
    success: true,
  });

  console.log(`✓ Updated: ${plan.name}`);
}

/**
 * Apply a delete action
 */
async function applyDelete(
  action: DiffAction,
  sdk: GriffinHubSdk,
  applied: ApplyAction[],
): Promise<void> {
  const remotePlan = action.remotePlan!;

  console.log(`Deleting plan: ${remotePlan.name}`);

  await sdk.deletePlanById({
    path: {
      id: remotePlan.id,
    },
  });

  applied.push({
    type: "delete",
    planName: remotePlan.name,
    success: true,
  });

  console.log(`✓ Deleted: ${remotePlan.name}`);
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
    lines.push(`  ${icon} ${action.planName} - ${status}`);
    if (action.error) {
      lines.push(`    Error: ${action.error}`);
    }
  }

  lines.push("");
  lines.push(`Success: ${result.applied.filter((a) => a.success).length}`);
  lines.push(`Failed: ${result.errors.length}`);

  return lines.join("\n");
}
