/**
 * Target reference utilities for griffin DSL.
 *
 * Targets are resolved at runtime by the runner based on the execution environment.
 * This allows the same test to run against different environments (staging, production, etc.)
 * without changing the test code.
 */

import { TargetRef } from "./schema.js";

/**
 * Create a target reference for endpoint base URLs.
 *
 * The runner will resolve this to the appropriate base URL based on the
 * execution environment (passed as a per-run parameter).
 *
 * @param key - The target identifier (e.g., "billing-service", "api-gateway")
 * @returns A target reference object
 *
 * @example
 * ```typescript
 * builder.addNode("billing", Endpoint({
 *   method: GET,
 *   path: "/invoices",
 *   base: target("billing-service"),
 *   response_format: JSON
 * }));
 * ```
 */
export function target(key: string): TargetRef {
  if (!key || typeof key !== "string") {
    throw new Error(`Target key must be a non-empty string. Got: ${key}`);
  }

  if (key.trim() === "") {
    throw new Error("Target key cannot be empty or whitespace only");
  }

  return {
    type: "target",
    key: key.trim(),
  };
}

/**
 * Type guard to check if a value is a target reference.
 */
export function isTargetRef(value: unknown): value is TargetRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return obj.type === "target" && typeof obj.key === "string";
}
