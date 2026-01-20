import { type TestPlanV1 } from "griffin-hub-sdk";
import objectHash from "object-hash";

/**
 * Compute a deterministic hash of a plan payload.
 * Used for change detection.
 */
export function hashPlanPayload(plan: TestPlanV1): string {
  return objectHash(plan);
}
