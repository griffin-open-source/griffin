import type { TestPlanV1 } from "@griffin-app/griffin-ts/types";
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

/**
 * Memory backend query function to find plans that are due for execution.
 * This function is passed to the execute() method.
 */
export function findDuePlansMemory(
  collections: Map<string, any[]>,
  params?: unknown[],
): TestPlanV1[] {
  const now = new Date();
  const plans = collections.get("plans") || [];
  const jobRuns = collections.get("job_runs") || [];

  // Filter to plans with a frequency defined
  const scheduledPlans = plans.filter((plan: TestPlanV1) => plan.frequency);

  const duePlans: TestPlanV1[] = [];

  for (const plan of scheduledPlans) {
    // Find the most recent job run for this plan
    const planRuns = jobRuns
      .filter((run: JobRun) => run.planId === plan.id)
      .sort(
        (a: JobRun, b: JobRun) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

    const lastRun = planRuns[0];

    // Determine when this plan is next due
    let nextRunAt: Date;
    if (lastRun) {
      nextRunAt = calculateNextRun(
        plan.frequency!,
        new Date(lastRun.startedAt),
      );
    } else {
      // Never run before - due immediately
      nextRunAt = new Date(0);
    }

    // Check if it's due now
    if (nextRunAt <= now) {
      duePlans.push(plan);
    }
  }

  return duePlans;
}

/**
 * PostgreSQL query to find plans that are due for execution.
 * Returns SQL string and parameters.
 */
export function findDuePlansPostgres(): { sql: string; params: unknown[] } {
  return {
    sql: `
      SELECT p.*
      FROM plans p
      LEFT JOIN LATERAL (
        SELECT started_at 
        FROM job_runs 
        WHERE plan_id = p.id 
        ORDER BY started_at DESC 
        LIMIT 1
      ) last_run ON true
      WHERE 
        p.frequency IS NOT NULL
        AND (
          last_run.started_at IS NULL
          OR (
            last_run.started_at + make_interval(
              mins := CASE WHEN (p.frequency->>'unit')::int = 0 THEN (p.frequency->>'every')::int END,
              hours := CASE WHEN (p.frequency->>'unit')::int = 1 THEN (p.frequency->>'every')::int END,
              days := CASE WHEN (p.frequency->>'unit')::int = 2 THEN (p.frequency->>'every')::int END
            )
          ) <= NOW()
        )
    `,
    params: [],
  };
}

/**
 * SQLite query to find plans that are due for execution.
 * SQLite doesn't have LATERAL joins, so we use a correlated subquery.
 */
export function findDuePlansSqlite(): { sql: string; params: unknown[] } {
  return {
    sql: `
      SELECT p.*
      FROM plans p
      WHERE 
        p.frequency IS NOT NULL
        AND (
          (SELECT MAX(started_at) FROM job_runs WHERE plan_id = p.id) IS NULL
          OR datetime(
            (SELECT MAX(started_at) FROM job_runs WHERE plan_id = p.id),
            '+' || json_extract(p.frequency, '$.every') || ' ' || 
            CASE json_extract(p.frequency, '$.unit')
              WHEN 0 THEN 'minutes'
              WHEN 1 THEN 'hours'
              WHEN 2 THEN 'days'
            END
          ) <= datetime('now')
        )
    `,
    params: [],
  };
}
