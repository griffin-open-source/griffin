import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import type { MonitorDSL } from "@griffin-app/griffin-ts/types";
import { compareMonitors, type MonitorChanges } from "./monitor-diff.js";

export type DiffActionType = "create" | "update" | "delete" | "noop";

// Type for resolved monitors (DSL monitors with variables resolved)
export type ResolvedMonitor = Omit<MonitorV1, "id">;

export interface DiffAction {
  type: DiffActionType;
  monitor: ResolvedMonitor | null; // Local monitor (null for delete actions)
  remoteMonitor: MonitorV1 | null; // Hub monitor (null for create actions)
  reason: string;
  changes?: MonitorChanges; // Granular changes for 'update' actions
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
 * Compute diff between local monitors and remote monitors (hub is source of truth).
 * Local monitors should be resolved (variables replaced with actual values) before calling this.
 * Monitors are matched by name.
 *
 * Rules:
 * - CREATE: Monitor exists locally but not on hub
 * - UPDATE: Monitor exists in both, but content differs
 * - DELETE: Monitor exists on hub but not locally (only if includeDeletions is true)
 * - NOOP: Monitor exists in both with same content
 */
export function computeDiff(
  localMonitors: ResolvedMonitor[],
  remoteMonitors: MonitorV1[],
  options: DiffOptions,
): DiffResult {
  const actions: DiffAction[] = [];

  // Build lookup: remote monitors by name
  const remoteByName = new Map<string, MonitorV1>();
  for (const monitor of remoteMonitors) {
    remoteByName.set(monitor.name, monitor);
  }

  const localNames = new Set<string>();
  for (const monitor of localMonitors) {
    localNames.add(monitor.name);
  }

  // Check local monitors against remote
  for (const local of localMonitors) {
    const remote = remoteByName.get(local.name);

    if (!remote) {
      // Monitor not on hub -> CREATE
      actions.push({
        type: "create",
        monitor: local,
        remoteMonitor: null,
        reason: `Monitor "${local.name}" does not exist on hub`,
      });
    } else {
      // Monitor exists in both - compute granular changes
      const changes = compareMonitors(local as MonitorV1, remote);

      if (changes.hasChanges) {
        // Monitor on hub but differs -> UPDATE
        actions.push({
          type: "update",
          monitor: local,
          remoteMonitor: remote,
          reason: `Monitor "${local.name}" has local changes`,
          changes,
        });
      } else {
        // Monitor matches -> NOOP
        actions.push({
          type: "noop",
          monitor: local,
          remoteMonitor: remote,
          reason: `Monitor "${local.name}" is up to date`,
        });
      }
    }
  }

  // Check for monitors on hub not present locally -> DELETE (only if --prune)
  if (options.includeDeletions) {
    for (const remote of remoteMonitors) {
      if (!localNames.has(remote.name)) {
        actions.push({
          type: "delete",
          monitor: null,
          remoteMonitor: remote,
          reason: `Monitor "${remote.name}" no longer exists locally`,
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

  lines.push("Monitor:");
  lines.push("");

  for (const action of diff.actions) {
    if (action.type === "create") {
      lines.push(`  + ${action.monitor!.name} (create)`);
    } else if (action.type === "update") {
      lines.push(`  ~ ${action.monitor!.name} (update)`);

      // Show granular changes for updates
      if (action.changes) {
        formatMonitorChanges(action.changes, lines);
      }
    } else if (action.type === "delete") {
      lines.push(`  - ${action.remoteMonitor!.name} (delete)`);
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
 * Format granular monitor changes in terraform style
 */
function formatMonitorChanges(changes: MonitorChanges, lines: string[]): void {
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
