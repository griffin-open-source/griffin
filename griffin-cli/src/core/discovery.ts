import { glob } from "glob";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PlanDSLSchema } from "@griffin-app/griffin-ts/schema";
import type { PlanDSL } from "@griffin-app/griffin-ts/types";
import { Value } from "typebox/value";

export interface DiscoveredPlan {
  plan: PlanDSL;
  filePath: string;
  exportName: string;
}

export interface DiscoveryResult {
  plans: DiscoveredPlan[];
  errors: DiscoveryError[];
}

export interface DiscoveryError {
  filePath: string;
  error: Error;
}

/**
 * Discover and load test plan files from the filesystem
 */
export async function discoverPlans(
  pattern: string,
  ignore: string[],
): Promise<DiscoveryResult> {
  const plans: DiscoveredPlan[] = [];
  const errors: DiscoveryError[] = [];

  // Find all matching files
  const files = await glob(pattern, {
    ignore,
    absolute: true,
    cwd: process.cwd(),
  });

  // Load each file
  for (const filePath of files) {
    try {
      const loaded = await loadPlansFromFile(filePath);
      plans.push(...loaded);
    } catch (error) {
      errors.push({
        filePath,
        error: error as Error,
      });
    }
  }

  return { plans, errors };
}

function isPlan(value: unknown): value is PlanDSL {
  return Value.Check(PlanDSLSchema, value);
}

/**
 * Load plans from a single file
 * Supports both default and named exports
 */
async function loadPlansFromFile(filePath: string): Promise<DiscoveredPlan[]> {
  const plans: DiscoveredPlan[] = [];

  // Convert to file URL for dynamic import (works with both ESM and CJS)
  const fileUrl = pathToFileURL(filePath).href;

  try {
    const module = await import(fileUrl);

    // Check default export
    if (module.default) {
      if (isPlan(module.default)) {
        plans.push({
          plan: module.default,
          filePath,
          exportName: "default",
        });
      } else {
        const errors = Value.Errors(PlanDSLSchema, module.default);
        throw new Error(
          `Default export is not a valid TestPlan. Got: ${JSON.stringify(errors, null, 2)}`,
        );
      }
    }

    if (plans.length === 0) {
      throw new Error("No valid TestPlan exports found in file");
    }
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${(error as Error).message}`);
  }

  return plans;
}

/**
 * Format discovery errors for display
 */
export function formatDiscoveryErrors(errors: DiscoveryError[]): string {
  if (errors.length === 0) return "";

  const lines: string[] = ["Errors during discovery:"];
  for (const { filePath, error } of errors) {
    const relativePath = path.relative(process.cwd(), filePath);
    lines.push(`  ❌ ${relativePath}`);
    lines.push(`     ${error.message}`);
  }

  return lines.join("\n");
}
