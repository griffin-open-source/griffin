/**
 * Secret resolution utilities for test plans.
 */

//import { TestPlanV1, Node } from "@griffin-app/griffin-ts/types";
//import { NodeType } from "@griffin-app/griffin-ts/schema";
import {
  type PlanV1,
} from "@griffin-app/griffin-hub-sdk";
//import { NodeType}
import type { SecretProviderRegistry } from "./registry.js";
import type { SecretRef, SecretRefData } from "./types.js";
import { isSecretRef } from "./types.js";

/**
 * Collected secret references from a plan.
 */
interface CollectedSecrets {
  /** All unique secret references found */
  refs: SecretRefData[];
  /** Paths where secrets were found (for substitution) */
  paths: Array<{
    path: (string | number)[];
    secretRef: SecretRefData;
  }>;
}

/**
 * Recursively collect all secret references from a value.
 * @param value - The value to scan
 * @param currentPath - Current path in the object tree
 * @param collected - Accumulator for found secrets
 */
function collectSecretsFromValue(
  value: unknown,
  currentPath: (string | number)[],
  collected: CollectedSecrets,
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (isSecretRef(value)) {
    collected.refs.push(value.$secret);
    collected.paths.push({
      path: [...currentPath],
      secretRef: value.$secret,
    });
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectSecretsFromValue(value[i], [...currentPath, i], collected);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      collectSecretsFromValue(val, [...currentPath, key], collected);
    }
  }
}

/**
 * Collect all secret references from a test plan.
 * Scans endpoint headers and bodies for $secret markers.
 */
export function collectSecretsFromPlan(plan: PlanV1): CollectedSecrets {
  const collected: CollectedSecrets = {
    refs: [],
    paths: [],
  };

  for (let nodeIndex = 0; nodeIndex < plan.nodes.length; nodeIndex++) {
    const node = plan.nodes[nodeIndex];

    // Only endpoints can have secrets (in headers and body)
    if (node.type !== "ENDPOINT") {
      continue;
    }

    //const endpoint = node;

    // Scan headers
    if (node.headers) {
      for (const [headerKey, headerValue] of Object.entries(node.headers)) {
        collectSecretsFromValue(
          headerValue,
          ["nodes", nodeIndex, "headers", headerKey],
          collected,
        );
      }
    }

    // Scan body
    if (node.body !== undefined) {
      collectSecretsFromValue(
        node.body,
        ["nodes", nodeIndex, "body"],
        collected,
      );
    }
  }

  // Deduplicate refs by creating a unique key
  const seen = new Set<string>();
  const uniqueRefs: SecretRefData[] = [];

  for (const ref of collected.refs) {
    const key = `${ref.provider}:${ref.ref}:${ref.version || ""}:${ref.field || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(ref);
    }
  }

  collected.refs = uniqueRefs;
  return collected;
}

/**
 * Set a value at a path in an object.
 * Creates intermediate objects/arrays as needed.
 */
function setAtPath(
  obj: unknown,
  path: (string | number)[],
  value: unknown,
): void {
  if (path.length === 0) {
    return;
  }

  let current: any = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined) {
      // Create intermediate object or array based on next key type
      current[key] = typeof path[i + 1] === "number" ? [] : {};
    }
    current = current[key];
  }

  current[path[path.length - 1]] = value;
}

/**
 * Deep clone a value.
 */
function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Resolve all secrets in a plan and return a new plan with substituted values.
 * The original plan is not modified.
 *
 * @param plan - The test plan containing secret references
 * @param registry - The secret provider registry
 * @returns A new plan with all secrets resolved to their values
 * @throws SecretResolutionError if any secret cannot be resolved (fail-fast)
 */
export async function resolveSecretsInPlan(
  plan: PlanV1,
  registry: SecretProviderRegistry,
): Promise<PlanV1> {
  // Collect all secret references
  const collected = collectSecretsFromPlan(plan);

  if (collected.refs.length === 0) {
    // No secrets to resolve
    return plan;
  }

  // Resolve all secrets (fail-fast on any error)
  const resolved = await registry.resolveMany(collected.refs);

  // Clone the plan for modification
  const resolvedPlan = deepClone(plan);

  // Substitute resolved values at each path
  for (const { path, secretRef } of collected.paths) {
    const key = registry.makeKey(secretRef);
    const value = resolved.get(key);

    if (value === undefined) {
      // This shouldn't happen if resolveMany worked correctly
      throw new Error(
        `Internal error: resolved value not found for secret "${secretRef.provider}:${secretRef.ref}"`,
      );
    }

    setAtPath(resolvedPlan, path, value);
  }

  return resolvedPlan;
}

/**
 * Check if a plan contains any secret references.
 * Useful for short-circuiting resolution when no secrets are present.
 */
export function planHasSecrets(plan: PlanV1): boolean {
  for (const node of plan.nodes) {
    if (node.type !== "ENDPOINT") {
      continue;
    }

    // Check headers
    if (node.headers) {
      for (const headerValue of Object.values(node.headers)) {
        if (isSecretRef(headerValue)) {
          return true;
        }
      }
    }

    // Check body (recursive check)
    if (node.body !== undefined && containsSecretRef(node.body)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively check if a value contains any secret references.
 */
function containsSecretRef(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (isSecretRef(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(containsSecretRef);
  }

  if (typeof value === "object") {
    return Object.values(value).some(containsSecretRef);
  }

  return false;
}
