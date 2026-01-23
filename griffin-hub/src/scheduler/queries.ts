import type { PlanV1 } from "../schemas/plans.js";
import { FrequencyUnit } from "@griffin-app/griffin-ts/schema";
import type { JobRun } from "../schemas/job-run.js";

/**
 * Calculate the next run time for a plan based on its frequency.
 */
export function calculateNextRun(
  frequency: { every: number; unit: FrequencyUnit },
  fromTime: Date,
): Date {
  const next = new Date(fromTime);

  switch (frequency.unit) {
    case FrequencyUnit.MINUTE:
      next.setMinutes(next.getMinutes() + frequency.every);
      break;
    case FrequencyUnit.HOUR:
      next.setHours(next.getHours() + frequency.every);
      break;
    case FrequencyUnit.DAY:
      next.setDate(next.getDate() + frequency.every);
      break;
  }

  return next;
}
