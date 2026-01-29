/**
 * Type-safe mapper for converting database monitors to versioned monitor contracts.
 *
 * The database stores monitors with version as a string, but our API contracts
 * use literal types for type safety. This mapper validates versions and
 * returns the appropriate typed monitor.
 */

import type { TestMonitorDB } from "./repositories.js";
import type { MonitorV1 } from "../schemas/monitors.js";
import { SUPPORTED_MONITOR_VERSIONS } from "@griffin-app/griffin-ts";

/**
 * Union type of all supported monitor versions
 */
export type VersionedMonitor = MonitorV1;

/**
 * Error thrown when encountering an unsupported monitor version
 */
export class UnsupportedMonitorVersionError extends Error {
  constructor(version: string) {
    super(
      `Unsupported monitor version: ${version}. Supported versions: ${SUPPORTED_MONITOR_VERSIONS.join(", ")}`,
    );
    this.name = "UnsupportedMonitorVersionError";
  }
}

/**
 * Convert a database monitor to a typed monitor contract.
 *
 * This function validates the version and returns the appropriate typed monitor.
 * Excludes internal fields like 'organization' that should not be exposed in the API.
 * Throws UnsupportedMonitorVersionError if the version is not supported.
 *
 * @param dbMonitor - Raw monitor from database with version as string
 * @returns Typed monitor with literal version (excluding internal fields)
 * @throws UnsupportedMonitorVersionError if version is not supported
 */
export function mapDbMonitorToVersionedMonitor(dbMonitor: TestMonitorDB): VersionedMonitor {
  const version = dbMonitor.version;

  // Validate version is supported
  if (!SUPPORTED_MONITOR_VERSIONS.includes(version as any)) {
    throw new UnsupportedMonitorVersionError(version);
  }

  // Destructure to exclude internal fields
  const { organization, ...publicFields } = dbMonitor;

  // Switch on version to return properly typed monitor
  switch (version) {
    case "1.0":
      return {
        ...publicFields,
        version: "1.0",
        locations: publicFields.locations || [],
      } as MonitorV1;

    // Future versions would be added here:
    // case "2.0":
    //   return { ...publicFields, version: "2.0", ... } as MonitorV2;

    default:
      // TypeScript should ensure this is unreachable if all cases are handled
      throw new UnsupportedMonitorVersionError(version);
  }
}

/**
 * Map an array of database monitors to typed monitors.
 *
 * @param dbMonitors - Array of raw monitors from database
 * @returns Array of typed monitors
 * @throws UnsupportedMonitorVersionError if any monitor has an unsupported version
 */
export function mapDbMonitorsToVersionedMonitors(
  dbMonitors: TestMonitorDB[],
): VersionedMonitor[] {
  return dbMonitors.map(mapDbMonitorToVersionedMonitor);
}
