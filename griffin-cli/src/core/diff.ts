import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import type { PlanDSL } from "@griffin-app/griffin-ts/types";
import { comparePlans, type PlanChanges } from "./plan-diff.js";

export type DiffActionType = "create" | "update" | "delete" | "noop";

export interface DiffAction {
  type: DiffActionType;
  plan: PlanDSL | null; // Local plan (null for delete actions)
  remotePlan: PlanV1 | null; // Hub plan (null for create actions)
  reason: string;
  changes?: PlanChanges; // Granular changes for 'update' actions
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

export interface DiffOptions {
  includeDeletions: boolean;
}

/**
 * Compute diff between local plans and remote plans (hub is source of truth).
 * Plans are matched by name. The CLI injects environment at apply time.
 *
 * Rules:
 * - CREATE: Plan exists locally but not on hub
 * - UPDATE: Plan exists in both, but content differs
 * - DELETE: Plan exists on hub but not locally (only if includeDeletions is true)
 * - NOOP: Plan exists in both with same content
 */
export function computeDiff(
  localPlans: PlanDSL[],
  remotePlans: PlanV1[],
  options: DiffOptions,
): DiffResult {
  const actions: DiffAction[] = [];

  // Build lookup: remote plans by name
  const remoteByName = new Map<string, PlanV1>();
  for (const plan of remotePlans) {
    remoteByName.set(plan.name, plan);
  }

  const localNames = new Set<string>();
  for (const plan of localPlans) {
    localNames.add(plan.name);
  }

  // Check local plans against remote
  for (const local of localPlans) {
    const remote = remoteByName.get(local.name);

    if (!remote) {
      // Plan not on hub -> CREATE
      actions.push({
        type: "create",
        plan: local,
        remotePlan: null,
        reason: `Plan "${local.name}" does not exist on hub`,
      });
    } else {
      // Plan exists in both - compute granular changes
      const changes = comparePlans(local, remote);

      if (changes.hasChanges) {
        // Plan on hub but differs -> UPDATE
        actions.push({
          type: "update",
          plan: local,
          remotePlan: remote,
          reason: `Plan "${local.name}" has local changes`,
          changes,
        });
      } else {
        // Plan matches -> NOOP
        actions.push({
          type: "noop",
          plan: local,
          remotePlan: remote,
          reason: `Plan "${local.name}" is up to date`,
        });
      }
    }
  }

  // Check for plans on hub not present locally -> DELETE (only if --prune)
  if (options.includeDeletions) {
    for (const remote of remotePlans) {
      if (!localNames.has(remote.name)) {
        actions.push({
          type: "delete",
          plan: null,
          remotePlan: remote,
          reason: `Plan "${remote.name}" no longer exists locally`,
        });
      }
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
 * Format diff result as human-readable text with granular changes
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

      // Show granular changes for updates
      if (action.changes) {
        formatPlanChanges(action.changes, lines);
      }
    } else if (action.type === "delete") {
      lines.push(`  - ${action.remotePlan!.name} (delete)`);
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
 * Format granular plan changes in terraform style
 */
function formatPlanChanges(changes: PlanChanges, lines: string[]): void {
  // Nodes section
  if (changes.nodes.length > 0) {
    lines.push("      Nodes:");
    for (const node of changes.nodes) {
      if (node.type === "add") {
        lines.push(
          `        + ${node.nodeId}  (${node.nodeType} ${node.summary})`,
        );
      } else if (node.type === "remove") {
        lines.push(
          `        - ${node.nodeId}  (${node.nodeType} ${node.summary})`,
        );
      } else if (node.type === "modify") {
        lines.push(
          `        ~ ${node.nodeId}  (${node.nodeType} ${node.summary})`,
        );
        for (const field of node.fieldChanges) {
          const oldVal = formatFieldValue(field.oldValue);
          const newVal = formatFieldValue(field.newValue);
          lines.push(`            ~ ${field.field}: ${oldVal} → ${newVal}`);
        }
      }
    }
  }

  // Edges section
  if (changes.edges.length > 0) {
    lines.push("      Edges:");
    for (const edge of changes.edges) {
      if (edge.type === "add") {
        lines.push(`        + ${edge.from} → ${edge.to}`);
      } else if (edge.type === "remove") {
        lines.push(`        - ${edge.from} → ${edge.to}`);
      }
    }
  }

  // Top-level fields section
  if (changes.topLevel.length > 0) {
    lines.push("      Fields:");
    for (const field of changes.topLevel) {
      const oldVal = formatFieldValue(field.oldValue);
      const newVal = formatFieldValue(field.newValue);
      lines.push(`        ~ ${field.field}: ${oldVal} → ${newVal}`);
    }
  }

  // If there were no changes in any category (shouldn't happen, but just in case)
  if (
    changes.nodes.length === 0 &&
    changes.edges.length === 0 &&
    changes.topLevel.length === 0
  ) {
    lines.push("      (no changes detected)");
  }
}

/**
 * Format a field value for display
 */
function formatFieldValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.length <= 3) {
      return `[${value.map((v) => formatFieldValue(v)).join(", ")}]`;
    }
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    // Handle frequency object specially
    if ("every" in value && "unit" in value) {
      return `every ${(value as { every: number }).every} ${(value as { unit: string }).unit.toLowerCase()}`;
    }
    // For other objects, show a compact representation
    const keys = Object.keys(value);
    if (keys.length <= 2) {
      return JSON.stringify(value);
    }
    return `{${keys.length} fields}`;
  }
  return String(value);
}

/**
 * Format diff result as JSON
 */
export function formatDiffJson(diff: DiffResult): string {
  return JSON.stringify(diff, null, 2);
}
