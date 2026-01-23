//import type { TestPlanV1 } from "griffin-hub-sdk";
import type {
  PlanDSL,
  NodeDSL,
  Edge,
  EndpointDSL,
} from "@griffin-app/griffin-ts/types";
import {
  PlanV1,
  Node,
  Endpoint,
  Wait,
  Assertions,
} from "@griffin-app/griffin-hub-sdk";
import objectHash from "object-hash";
import { NodeType } from "@griffin-app/griffin-ts/schema";

/**
 * Represents a change to a single field
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Represents a change to a node (add/remove/modify)
 */
export interface NodeChange {
  type: "add" | "remove" | "modify";
  nodeId: string;
  nodeType: NodeType.ASSERTION | NodeType.ENDPOINT | NodeType.WAIT;
  summary: string; // e.g., "GET /health" or "wait 5000ms"
  fieldChanges: FieldChange[]; // Empty for add/remove, populated for modify
}

/**
 * Represents a change to an edge (add/remove)
 */
export interface EdgeChange {
  type: "add" | "remove";
  from: string;
  to: string;
}

/**
 * Complete set of changes between local and remote plans
 */
export interface PlanChanges {
  hasChanges: boolean;
  nodes: NodeChange[];
  edges: EdgeChange[];
  topLevel: FieldChange[]; // frequency, version, locations
}

/**
 * Compare two test plans and return granular changes
 */
export function comparePlans(local: PlanDSL, remote: PlanV1): PlanChanges {
  const nodeChanges = compareNodes(local.nodes, remote.nodes);
  const edgeChanges = compareEdges(local.edges, remote.edges);
  const topLevelChanges = compareTopLevel(local, remote);

  const hasChanges =
    nodeChanges.length > 0 ||
    edgeChanges.length > 0 ||
    topLevelChanges.length > 0;

  return {
    hasChanges,
    nodes: nodeChanges,
    edges: edgeChanges,
    topLevel: topLevelChanges,
  };
}

/**
 * Compare nodes between local and remote plans
 */
function compareNodes(
  localNodes: NodeDSL[],
  remoteNodes: Node[],
): NodeChange[] {
  const changes: NodeChange[] = [];

  // Build map of remote nodes by id
  const remoteByID = new Map<string, Node>();
  for (const node of remoteNodes) {
    remoteByID.set(node.id, node);
  }

  const localIDs = new Set<string>();
  for (const node of localNodes) {
    localIDs.add(node.id);
  }

  // Check local nodes
  for (const local of localNodes) {
    const remote = remoteByID.get(local.id);

    if (!remote) {
      // Node added
      changes.push({
        type: "add",
        nodeId: local.id,
        nodeType: local.type,
        summary: getNodeSummary(local),
        fieldChanges: [],
      });
    } else {
      // Node exists - check for modifications
      const fieldChanges = compareNodeFields(local, remote);
      if (fieldChanges.length > 0) {
        changes.push({
          type: "modify",
          nodeId: local.id,
          nodeType: local.type,
          summary: getNodeSummary(local),
          fieldChanges,
        });
      }
    }
  }

  // Check for removed nodes
  for (const remote of remoteNodes) {
    if (!localIDs.has(remote.id)) {
      changes.push({
        type: "remove",
        nodeId: remote.id,
        nodeType: remote.type as NodeType,
        summary: getNodeSummary(remote),
        fieldChanges: [],
      });
    }
  }

  return changes;
}

/**
 * Get a human-readable summary of a node
 */
function getNodeSummary(node: Node | NodeDSL): string {
  switch (node.type) {
    case "ENDPOINT":
      return `${node.method} ${formatValue(node.path)}`;
    case "WAIT":
      return `wait ${node.duration_ms}ms`;
    case "ASSERTION":
      return `${node.assertions.length} assertion(s)`;
    default:
      return node.type;
  }
}

/**
 * Format a value for display (handle VariableRef objects)
 */
function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "$variable" in value &&
    typeof (value as { $variable?: { key?: string } }).$variable === "object"
  ) {
    return `$\{${(value as { $variable: { key: string } }).$variable.key}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compare fields within two nodes of the same type
 */
function compareNodeFields(local: NodeDSL, remote: Node): FieldChange[] {
  const changes: FieldChange[] = [];

  // Type should match, but check anyway
  if (local.type !== remote.type) {
    changes.push({
      field: "type",
      oldValue: remote.type,
      newValue: local.type,
    });
    return changes;
  }

  switch (local.type) {
    case NodeType.ENDPOINT:
      compareEndpointFields(local, remote as Endpoint, changes);
      break;
    case NodeType.WAIT:
      compareWaitFields(local, remote as Wait, changes);
      break;
    case NodeType.ASSERTION:
      compareAssertionFields(
        local as Assertions,
        remote as Assertions,
        changes,
      );
      break;
  }

  return changes;
}

/**
 * Compare fields specific to Endpoint nodes
 */
function compareEndpointFields(
  local: EndpointDSL,
  remote: Endpoint,
  changes: FieldChange[],
): void {
  const fields = [
    "method",
    "path",
    "base",
    "headers",
    "body",
    "response_format",
  ] as const;

  for (const field of fields) {
    const localVal = local[field];
    const remoteVal = remote[field];

    if (!deepEqual(localVal, remoteVal)) {
      changes.push({
        field: field as string,
        oldValue: remoteVal,
        newValue: localVal,
      });
    }
  }
}

/**
 * Compare fields specific to Wait nodes
 */
function compareWaitFields(
  local: Wait,
  remote: Wait,
  changes: FieldChange[],
): void {
  if (local.duration_ms !== remote.duration_ms) {
    changes.push({
      field: "duration_ms",
      oldValue: remote.duration_ms,
      newValue: local.duration_ms,
    });
  }
}

/**
 * Compare fields specific to Assertion nodes
 */
function compareAssertionFields(
  local: Assertions,
  remote: Assertions,
  changes: FieldChange[],
): void {
  if (!deepEqual(local.assertions, remote.assertions)) {
    changes.push({
      field: "assertions",
      oldValue: remote.assertions,
      newValue: local.assertions,
    });
  }
}

/**
 * Compare edges between local and remote plans
 */
function compareEdges(localEdges: Edge[], remoteEdges: Edge[]): EdgeChange[] {
  const changes: EdgeChange[] = [];

  // Build map of remote edges by "from:to" key
  const remoteByKey = new Map<string, Edge>();
  for (const edge of remoteEdges) {
    remoteByKey.set(`${edge.from}:${edge.to}`, edge);
  }

  const localKeys = new Set<string>();
  for (const edge of localEdges) {
    localKeys.add(`${edge.from}:${edge.to}`);
  }

  // Check local edges
  for (const local of localEdges) {
    const key = `${local.from}:${local.to}`;
    if (!remoteByKey.has(key)) {
      changes.push({
        type: "add",
        from: local.from,
        to: local.to,
      });
    }
  }

  // Check for removed edges
  for (const remote of remoteEdges) {
    const key = `${remote.from}:${remote.to}`;
    if (!localKeys.has(key)) {
      changes.push({
        type: "remove",
        from: remote.from,
        to: remote.to,
      });
    }
  }

  return changes;
}

/**
 * Compare top-level fields: frequency, version, locations
 */
function compareTopLevel(local: PlanDSL, remote: PlanV1): FieldChange[] {
  const changes: FieldChange[] = [];

  // Compare frequency
  if (!deepEqual(local.frequency, remote.frequency)) {
    changes.push({
      field: "frequency",
      oldValue: remote.frequency,
      newValue: local.frequency,
    });
  }

  // Compare version
  if (local.version !== remote.version) {
    changes.push({
      field: "version",
      oldValue: remote.version,
      newValue: local.version,
    });
  }

  // Compare locations (normalize empty array to undefined)
  const localLocations = local.locations;
  const remoteLocations =
    remote.locations && remote.locations.length > 0
      ? remote.locations
      : undefined;

  if (!deepEqual(localLocations, remoteLocations)) {
    changes.push({
      field: "locations",
      oldValue: remoteLocations,
      newValue: localLocations,
    });
  }

  return changes;
}

/**
 * Deep equality check using object-hash
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return objectHash(a ?? null) === objectHash(b ?? null);
}
