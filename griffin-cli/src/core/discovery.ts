import { glob } from "glob";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TestPlanV1 } from "griffin-hub-sdk";

export interface DiscoveredPlan {
  plan: TestPlanV1;
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

  console.log(`Found ${files.length} test file(s)`);

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
        throw new Error(
          `Default export is not a valid TestPlan. Got: ${typeof module.default}`,
        );
      }
    }

    // Check named exports
    for (const [name, value] of Object.entries(module)) {
      if (name === "default") continue;

      if (isPlan(value)) {
        plans.push({
          plan: value as TestPlanV1,
          filePath,
          exportName: name,
        });
      } else if (name !== "__esModule") {
        // Warn about non-plan exports (except __esModule from transpiled code)
        console.warn(
          `Warning: Export "${name}" in ${filePath} is not a TestPlan`,
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
 * Type guard to check if a value is a TestPlan
 */
function isPlan(value: unknown): value is TestPlanV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Record<string, unknown>;

  // Validate that project field is not set
  if ("project" in plan) {
    throw new Error(
      "Plans should not include 'project' field. Project is managed by the CLI and set during init.",
    );
  }

  return (
    typeof plan.id === "string" &&
    typeof plan.name === "string" &&
    plan.version === "1.0" &&
    typeof plan.endpoint_host === "string" &&
    Array.isArray(plan.nodes) &&
    Array.isArray(plan.edges)
  );
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
