import type { StateFile, PlanStateEntry } from "../schemas/state.js";
import type { TestPlanV1 } from "griffin-hub-sdk";
import { hashPlanPayload } from "../schemas/payload.js";

export type DiffActionType = "create" | "update" | "delete" | "noop";

export interface DiffAction {
  type: DiffActionType;
  plan: TestPlanV1 | null; // null for delete actions
  stateEntry: PlanStateEntry | null; // null for create actions
  reason: string;
}

export interface DiffResult {
  actions: DiffAction[];
  summary: {
    creates: number;
    updates: number;
    deletes: number;
    noops: number;
  };
}

/**
 * Compute diff between local plans and state file for a specific environment.
 *
 * Rules:
 * - CREATE: Plan exists locally but not in state
 * - UPDATE: Plan exists in both, but hash differs
 * - DELETE: Plan exists in state but not locally (drift cleanup)
 * - NOOP: Plan exists in both with same hash
 */
export function computeDiff(
  localPlans: TestPlanV1[],
  state: StateFile,
  remotePlans: TestPlanV1[],
  envName: string,
): DiffResult {
  const actions: DiffAction[] = [];

  // Get plans for this environment
  const envPlans = state.plans[envName] || [];

  // Build lookup maps
  const stateByPlanId = new Map<string, PlanStateEntry>();
  for (const entry of envPlans) {
    stateByPlanId.set(entry.planId, entry);
  }

  const remotePlanById = new Map<string, TestPlanV1>();
  for (const plan of remotePlans) {
    remotePlanById.set(plan.id, plan);
  }

  const localPlanById = new Map<string, TestPlanV1>();
  for (const plan of localPlans) {
    localPlanById.set(plan.id, plan);
  }

  // Check local plans against state
  for (const plan of localPlans) {
    const stateEntry = stateByPlanId.get(plan.id);
    const currentHash = hashPlanPayload(plan);

    if (!stateEntry) {
      // Plan not in state -> CREATE
      actions.push({
        type: "create",
        plan,
        stateEntry: null,
        reason: `Plan "${plan.name}" does not exist on runner`,
      });
    } else if (stateEntry.lastAppliedHash !== currentHash) {
      // Plan in state but hash differs -> UPDATE
      actions.push({
        type: "update",
        plan,
        stateEntry,
        reason: `Plan "${plan.name}" has local changes`,
      });
    } else {
      // Plan in state with same hash -> NOOP
      actions.push({
        type: "noop",
        plan,
        stateEntry,
        reason: `Plan "${plan.name}" is up to date`,
      });
    }
  }

  // Check state entries not present locally -> DELETE
  for (const stateEntry of envPlans) {
    if (!localPlanById.has(stateEntry.planId)) {
      actions.push({
        type: "delete",
        plan: null,
        stateEntry,
        reason: `Plan "${stateEntry.planName}" no longer exists locally`,
      });
    }
  }

  // Compute summary
  const summary = {
    creates: actions.filter((a) => a.type === "create").length,
    updates: actions.filter((a) => a.type === "update").length,
    deletes: actions.filter((a) => a.type === "delete").length,
    noops: actions.filter((a) => a.type === "noop").length,
  };

  return { actions, summary };
}

/**
 * Format diff result as human-readable text
 */
export function formatDiff(diff: DiffResult): string {
  const lines: string[] = [];

  if (
    diff.summary.creates === 0 &&
    diff.summary.updates === 0 &&
    diff.summary.deletes === 0
  ) {
    lines.push("No changes. Infrastructure is up to date.");
    return lines.join("\n");
  }

  lines.push("Plan:");
  lines.push("");

  for (const action of diff.actions) {
    if (action.type === "create") {
      lines.push(`  + ${action.plan!.name} (create)`);
    } else if (action.type === "update") {
      lines.push(`  ~ ${action.plan!.name} (update)`);
    } else if (action.type === "delete") {
      lines.push(`  - ${action.stateEntry!.planName} (delete)`);
    }
  }

  lines.push("");
  lines.push("Summary:");
  lines.push(`  Creates: ${diff.summary.creates}`);
  lines.push(`  Updates: ${diff.summary.updates}`);
  lines.push(`  Deletes: ${diff.summary.deletes}`);

  return lines.join("\n");
}

/**
 * Format diff result as JSON
 */
export function formatDiffJson(diff: DiffResult): string {
  return JSON.stringify(diff, null, 2);
}
