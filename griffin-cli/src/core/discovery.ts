import { glob } from "glob";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MonitorDSLSchema } from "@griffin-app/griffin-ts/schema";
import type { MonitorDSL } from "@griffin-app/griffin-ts/types";
import { Value } from "typebox/value";

export interface DiscoveredMonitor {
  monitor: MonitorDSL;
  filePath: string;
  exportName: string;
}

export interface DiscoveryResult {
  monitors: DiscoveredMonitor[];
  errors: DiscoveryError[];
}

export interface DiscoveryError {
  filePath: string;
  error: Error;
}

/**
 * Discover and load test monitor files from the filesystem
 */
export async function discoverMonitors(
  pattern: string,
  ignore: string[],
): Promise<DiscoveryResult> {
  const monitors: DiscoveredMonitor[] = [];
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
      const loaded = await loadMonitorsFromFile(filePath);
      monitors.push(...loaded);
    } catch (error) {
      errors.push({
        filePath,
        error: error as Error,
      });
    }
  }

  return { monitors, errors };
}

function isMonitor(value: unknown): value is MonitorDSL {
  return Value.Check(MonitorDSLSchema, value);
}

/**
 * Load monitors from a single file
 * Supports both default and named exports
 */
async function loadMonitorsFromFile(filePath: string): Promise<DiscoveredMonitor[]> {
  const monitors: DiscoveredMonitor[] = [];

  // Convert to file URL for dynamic import (works with both ESM and CJS)
  const fileUrl = pathToFileURL(filePath).href;

  try {
    const module = await import(fileUrl);

    // Check default export
    if (module.default) {
      if (isMonitor(module.default)) {
        monitors.push({
          monitor: module.default,
          filePath,
          exportName: "default",
        });
      } else {
        const errors = Value.Errors(MonitorDSLSchema, module.default);
        throw new Error(
          `Default export is not a valid TestMonitor. Got: ${JSON.stringify(errors, null, 2)}`,
        );
      }
    }

    if (monitors.length === 0) {
      throw new Error("No valid TestMonitor exports found in file");
    }
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${(error as Error).message}`);
  }

  return monitors;
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
