/**
 * Type-safe mapper for converting database plans to versioned plan contracts.
 *
 * The database stores plans with version as a string, but our API contracts
 * use literal types for type safety. This mapper validates versions and
 * returns the appropriate typed plan.
 */

import type { TestPlanDB } from "./repositories.js";
import type { PlanV1 } from "../schemas/plans.js";
import { SUPPORTED_PLAN_VERSIONS } from "@griffin-app/griffin-ts";

/**
 * Union type of all supported plan versions
 */
export type VersionedPlan = PlanV1;

/**
 * Error thrown when encountering an unsupported plan version
 */
export class UnsupportedPlanVersionError extends Error {
  constructor(version: string) {
    super(
      `Unsupported plan version: ${version}. Supported versions: ${SUPPORTED_PLAN_VERSIONS.join(", ")}`,
    );
    this.name = "UnsupportedPlanVersionError";
  }
}

/**
 * Convert a database plan to a typed plan contract.
 *
 * This function validates the version and returns the appropriate typed plan.
 * Excludes internal fields like 'organization' that should not be exposed in the API.
 * Throws UnsupportedPlanVersionError if the version is not supported.
 *
 * @param dbPlan - Raw plan from database with version as string
 * @returns Typed plan with literal version (excluding internal fields)
 * @throws UnsupportedPlanVersionError if version is not supported
 */
export function mapDbPlanToVersionedPlan(dbPlan: TestPlanDB): VersionedPlan {
  const version = dbPlan.version;

  // Validate version is supported
  if (!SUPPORTED_PLAN_VERSIONS.includes(version as any)) {
    throw new UnsupportedPlanVersionError(version);
  }

  // Destructure to exclude internal fields
  const { organization, ...publicFields } = dbPlan;

  // Switch on version to return properly typed plan
  switch (version) {
    case "1.0":
      return {
        ...publicFields,
        version: "1.0",
        locations: publicFields.locations || [],
      } as PlanV1;

    // Future versions would be added here:
    // case "2.0":
    //   return { ...publicFields, version: "2.0", ... } as PlanV2;

    default:
      // TypeScript should ensure this is unreachable if all cases are handled
      throw new UnsupportedPlanVersionError(version);
  }
}

/**
 * Map an array of database plans to typed plans.
 *
 * @param dbPlans - Array of raw plans from database
 * @returns Array of typed plans
 * @throws UnsupportedPlanVersionError if any plan has an unsupported version
 */
export function mapDbPlansToVersionedPlans(
  dbPlans: TestPlanDB[],
): VersionedPlan[] {
  return dbPlans.map(mapDbPlanToVersionedPlan);
}
