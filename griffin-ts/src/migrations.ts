/**
 * Migration framework for test monitor versioning.
 * Provides functions to migrate monitors between different schema versions.
 */

import { CURRENT_MONITOR_VERSION, SUPPORTED_MONITOR_VERSIONS } from "./schema.js";
import type { ResolvedMonitor, ResolvedMonitorV1 } from "./schema.js";

/**
 * Type representing a migration function from one version to another
 */
type MigrationFn<From = unknown, To = unknown> = (monitor: From) => To;

/**
 * Registry of all available migrations between versions
 * Key format: "fromVersion->toVersion"
 */
const migrations: Record<string, MigrationFn<any, any>> = {
  // Future migrations will be added here
  // Example: "1.0->2.0": migrateV1ToV2,
};

/**
 * Get the next version in the supported versions list
 */
function getNextVersion(currentVersion: string): string {
  const versions = SUPPORTED_MONITOR_VERSIONS as readonly string[];
  const currentIndex = versions.indexOf(currentVersion);

  if (currentIndex === -1) {
    throw new Error(`Unsupported monitor version: ${currentVersion}`);
  }

  if (currentIndex === versions.length - 1) {
    throw new Error(
      `No migration path available from version ${currentVersion}`,
    );
  }

  return versions[currentIndex + 1];
}

/**
 * Migrate a monitor from its current version to a target version
 *
 * @param monitor - Monitor to migrate (must have a version field)
 * @param targetVersion - Target version to migrate to
 * @returns Migrated monitor at target version
 * @throws Error if no migration path exists
 */
export function migrateMonitor<T>(
  monitor: { version: string },
  targetVersion: string,
): T {
  let current: any = monitor;

  // Already at target version
  if (current.version === targetVersion) {
    return current as T;
  }

  // Migrate step by step through versions
  while (current.version !== targetVersion) {
    const nextVersion = getNextVersion(current.version);
    const migrationKey = `${current.version}->${nextVersion}`;
    const migrate = migrations[migrationKey];

    if (!migrate) {
      throw new Error(
        `No migration path from version ${current.version} to ${nextVersion}`,
      );
    }

    current = migrate(current);
  }

  return current as T;
}

/**
 * Migrate a monitor to the latest supported version
 *
 * @param monitor - Monitor to migrate (must have a version field)
 * @returns Monitor migrated to latest version
 */
export function migrateToLatest(monitor: { version: string }): ResolvedMonitor {
  return migrateMonitor<ResolvedMonitor>(monitor, CURRENT_MONITOR_VERSION);
}

/**
 * Check if a monitor version is supported
 *
 * @param version - Version string to check
 * @returns True if version is supported
 */
export function isSupportedVersion(version: string): boolean {
  return SUPPORTED_MONITOR_VERSIONS.includes(version as any);
}

/**
 * Get all supported monitor versions
 */
export function getSupportedVersions(): readonly string[] {
  return SUPPORTED_MONITOR_VERSIONS;
}

/**
 * Example migration function template (for future use)
 *
 * Uncomment and modify when creating v2.0:
 *
 * function migrateV1ToV2(monitor: ResolvedMonitorV1): ResolvedMonitorV2 {
 *   return {
 *     ...monitor,
 *     version: "2.0",
 *     // Add/modify fields as needed for v2.0
 *     newField: "default value",
 *   };
 * }
 */
