import type { DiffAction, DiffResult } from "./diff.js";
import type { StateFile, PlanStateEntry } from "../schemas/state.js";
import type { PlanApi } from "griffin-hub-sdk";
import { hashPlanPayload } from "../schemas/payload.js";
import { saveState } from "./state.js";
import { injectProjectId } from "./sdk.js";

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
 * Apply diff actions to the runner and update state file for a specific environment
 */
export async function applyDiff(
  diff: DiffResult,
  state: StateFile,
  planApi: PlanApi,
  envName: string,
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
          `[DRY RUN] Would ${action.type} plan: ${action.plan?.name || action.stateEntry?.planName}`,
        );
        continue;
      }

      switch (action.type) {
        case "create":
          await applyCreate(action, state, planApi, envName, applied);
          break;
        case "update":
          await applyUpdate(action, state, planApi, envName, applied);
          break;
        case "delete":
          await applyDelete(action, state, planApi, envName, applied);
          break;
      }
    } catch (error) {
      errors.push({
        action,
        error: error as Error,
      });

      applied.push({
        type: action.type as "create" | "update" | "delete",
        planName: action.plan?.name || action.stateEntry?.planName || "unknown",
        success: false,
        error: (error as Error).message,
      });
    }
  }

  // Save updated state if not a dry run and there were no errors
  if (!options?.dryRun && errors.length === 0) {
    await saveState(state);
    console.log("State file updated.");
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
  state: StateFile,
  planApi: PlanApi,
  envName: string,
  applied: ApplyAction[],
): Promise<void> {
  const plan = action.plan!;

  console.log(`Creating plan: ${plan.name}`);

  // Inject projectId from state
  const payload = injectProjectId(plan, state.projectId);
  const { data: createdPlan } = await planApi.planPost(payload);

  // Add to state for this environment
  const entry: PlanStateEntry = {
    localPath: "", // TODO: Track source file path
    exportName: "default", // TODO: Track export name
    planName: createdPlan.data.name,
    planId: createdPlan.data.id,
    lastAppliedHash: hashPlanPayload(plan),
    lastAppliedAt: new Date().toISOString(),
  };

  // Initialize environment plans array if needed
  if (!state.plans[envName]) {
    state.plans[envName] = [];
  }

  state.plans[envName].push(entry);

  applied.push({
    type: "create",
    planName: createdPlan.data.name,
    success: true,
  });

  console.log(`✓ Created: ${createdPlan.data.name}`);
}

/**
 * Apply an update action
 */
async function applyUpdate(
  action: DiffAction,
  state: StateFile,
  planApi: PlanApi,
  envName: string,
  applied: ApplyAction[],
): Promise<void> {
  const plan = action.plan!;

  console.log(`Updating plan: ${plan.name}`);

  // Inject projectId from state
  const payload = injectProjectId(plan, state.projectId);
  const { data: updatedPlan } = await planApi.planPost(payload);

  // Update state entry for this environment
  const envPlans = state.plans[envName] || [];
  const stateEntry = envPlans.find((e) => e.planId === updatedPlan.data.id);
  if (stateEntry) {
    stateEntry.lastAppliedHash = hashPlanPayload(plan);
    stateEntry.lastAppliedAt = new Date().toISOString();
    stateEntry.planName = updatedPlan.data.name; // Update name in case it changed
  }

  applied.push({
    type: "update",
    planName: updatedPlan.data.name,
    success: true,
  });

  console.log(`✓ Updated: ${updatedPlan.data.name}`);
}

/**
 * Apply a delete action
 */
async function applyDelete(
  action: DiffAction,
  state: StateFile,
  planApi: PlanApi,
  envName: string,
  applied: ApplyAction[],
): Promise<void> {
  const stateEntry = action.stateEntry!;

  console.log(`Deleting plan: ${stateEntry.planName}`);

  // TODO: Implement DELETE endpoint in runner API
  // For now, warn that delete is not supported
  console.warn(
    `Warning: DELETE not yet supported by runner API (${stateEntry.planId})`,
  );

  // Remove from state for this environment (local cleanup)
  if (state.plans[envName]) {
    state.plans[envName] = state.plans[envName].filter(
      (e) => e.planId !== stateEntry.planId,
    );
  }

  applied.push({
    type: "delete",
    planName: stateEntry.planName,
    success: true,
  });

  console.log(`✓ Removed from state: ${stateEntry.planName}`);
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
