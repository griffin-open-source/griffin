/**
 * PostgreSQL implementation of repositories using Drizzle ORM.
 */

import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { TestPlanV1 } from "@griffin-app/griffin-ts/types";
import type { JobRun } from "../../../schemas/job-run.js";
import type { Agent, AgentStatus } from "../../../schemas/agent.js";
import type {
  PlansRepository,
  RunsRepository,
  AgentsRepository,
  QueryOptions,
} from "../../repositories.js";
import type { DrizzleDatabase } from "../../../plugins/storage.js";
import * as schema from "./schema.js";
import type { TestPlanDB } from "../../repositories.js";

// =============================================================================
// Plans Repository
// =============================================================================

export class PostgresPlansRepository implements PlansRepository {
  constructor(private db: DrizzleDatabase) {}

  async create(data: Omit<TestPlanDB, "id">): Promise<TestPlanDB> {
    const result = await this.db
      .insert(schema.plansTable)
      .values({
        ...data,
        id: randomUUID(),
      })
      .returning();

    const plan = result[0];
    return {
      ...plan,
      version: "1.0",
      locations: plan.locations || [],
    };
  }

  async findById(id: string): Promise<TestPlanDB | null> {
    const result = await this.db.query.plansTable.findFirst({
      where: eq(schema.plansTable.id, id),
    });

    if (!result) {
      return null;
    }

    return {
      ...result,
      locations: result.locations || [],
      version: "1.0",
    };
  }

  async findMany(options?: QueryOptions): Promise<TestPlanDB[]> {
    const result = await this.db.query.plansTable.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      limit: options?.limit,
      offset: options?.offset,
    });

    return result.map((plan) => ({
      ...plan,
      locations: plan.locations || [],
      version: "1.0",
    }));
  }

  async update(
    id: string,
    data: Partial<Omit<TestPlanDB, "id">>,
  ): Promise<TestPlanDB> {
    const result = await this.db
      .update(schema.plansTable)
      .set(data)
      .where(eq(schema.plansTable.id, id))
      .returning();

    return {
      ...result[0],
      locations: result[0].locations || [],
      version: "1.0",
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.plansTable).where(eq(schema.plansTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.plansTable)
      .where(where);

    return result[0]?.count || 0;
  }

  async findDue(): Promise<TestPlanV1[]> {
    // Complex query: find plans that are due based on their frequency
    // A plan is due if:
    // 1. It has a frequency defined AND
    // 2. Either it has never run OR its next scheduled run time has passed

    const result = await this.findMany({
      where: sql`
        frequency IS NOT NULL
        AND (
          (SELECT MAX(started_at) FROM runs WHERE plan_id = id) IS NULL
          OR (
            (SELECT MAX(started_at) FROM runs WHERE plan_id = id) + make_interval(
              mins := CASE WHEN (frequency->>'unit') = 'MINUTE' THEN (frequency->>'every')::int END,
              hours := CASE WHEN (frequency->>'unit') = 'HOUR' THEN (frequency->>'every')::int END,
              days := CASE WHEN (frequency->>'unit') = 'DAY' THEN (frequency->>'every')::int END
            ) <= NOW()
          )
        )
      `,
    });

    return result.map((plan) => ({
      ...plan,
      locations: plan.locations || [],
      version: "1.0",
    }));
  }
}

// =============================================================================
// Runs Repository
// =============================================================================

export class PostgresRunsRepository implements RunsRepository {
  constructor(private db: DrizzleDatabase) {}

  async create(data: Omit<JobRun, "id">): Promise<JobRun> {
    const result = await this.db
      .insert(schema.runsTable)
      .values({
        ...data,
        id: randomUUID(),
        startedAt: new Date(data.startedAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      })
      .returning();

    return {
      ...result[0],
      duration_ms: result[0].duration_ms || undefined,
      completedAt: result[0].completedAt
        ? result[0].completedAt.toISOString()
        : undefined,
      startedAt: result[0].startedAt.toISOString(),
      success: result[0].success || undefined,
      errors: result[0].errors || undefined,
    };
  }

  async findById(id: string): Promise<JobRun | null> {
    const result = await this.db.query.runsTable.findFirst({
      where: eq(schema.runsTable.id, id),
    });

    return result
      ? {
          ...result,
          duration_ms: result.duration_ms || undefined,
          completedAt: result.completedAt
            ? result.completedAt.toISOString()
            : undefined,
          startedAt: result.startedAt.toISOString(),
          success: result.success || undefined,
          errors: result.errors || undefined,
        }
      : null;
  }

  async findMany(options?: QueryOptions): Promise<JobRun[]> {
    const result = await this.db.query.runsTable.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      limit: options?.limit,
      offset: options?.offset,
    });

    return result.map((run) => ({
      ...run,
      duration_ms: run.duration_ms || undefined,
      completedAt: run.completedAt ? run.completedAt.toISOString() : undefined,
      startedAt: run.startedAt.toISOString(),
      success: run.success || undefined,
      errors: run.errors || undefined,
    }));
  }

  async update(id: string, data: Partial<Omit<JobRun, "id">>): Promise<JobRun> {
    const result = await this.db
      .update(schema.runsTable)
      .set({
        ...data,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      })
      .where(eq(schema.runsTable.id, id))
      .returning();

    return {
      ...result[0],
      duration_ms: result[0].duration_ms || undefined,
      completedAt: result[0].completedAt
        ? result[0].completedAt.toISOString()
        : undefined,
      startedAt: result[0].startedAt.toISOString(),
      success: result[0].success || undefined,
      errors: result[0].errors || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(schema.runsTable).where(eq(schema.runsTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.runsTable)
      .where(where);

    return result[0]?.count || 0;
  }

  async findLatestForPlan(planId: string): Promise<JobRun | null> {
    const result = await this.db.query.runsTable.findFirst({
      where: eq(schema.runsTable.planId, planId),
      orderBy: [desc(schema.runsTable.startedAt)],
    });

    return result
      ? {
          ...result,
          duration_ms: result.duration_ms || undefined,
          completedAt: result.completedAt
            ? result.completedAt.toISOString()
            : undefined,
          startedAt: result.startedAt.toISOString(),
          success: result.success || undefined,
          errors: result.errors || undefined,
        }
      : null;
  }
}

// =============================================================================
// Agents Repository
// =============================================================================

export class PostgresAgentsRepository implements AgentsRepository {
  constructor(private db: DrizzleDatabase) {}

  async create(data: Omit<Agent, "id">): Promise<Agent> {
    const result = await this.db
      .insert(schema.agentsTable)
      .values({
        ...data,
        id: randomUUID(),
        lastHeartbeat: new Date(data.lastHeartbeat),
        registeredAt: new Date(data.registeredAt),
      })
      .returning();

    return {
      ...result[0],
      lastHeartbeat: result[0].lastHeartbeat.toISOString(),
      registeredAt: result[0].registeredAt.toISOString(),
      metadata: result[0].metadata || undefined,
    };
  }

  async findById(id: string): Promise<Agent | null> {
    const result = await this.db.query.agentsTable.findFirst({
      where: eq(schema.agentsTable.id, id),
    });

    return result
      ? {
          ...result,
          lastHeartbeat: result.lastHeartbeat.toISOString(),
          registeredAt: result.registeredAt.toISOString(),
          metadata: result.metadata || undefined,
        }
      : null;
  }

  async findMany(options?: QueryOptions): Promise<Agent[]> {
    const result = await this.db.query.agentsTable.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      limit: options?.limit,
      offset: options?.offset,
    });

    return result.map((agent) => ({
      ...agent,
      lastHeartbeat: agent.lastHeartbeat.toISOString(),
      registeredAt: agent.registeredAt.toISOString(),
      metadata: agent.metadata || undefined,
    }));
  }

  async update(id: string, data: Partial<Omit<Agent, "id">>): Promise<Agent> {
    const result = await this.db
      .update(schema.agentsTable)
      .set({
        ...data,
        lastHeartbeat: data.lastHeartbeat
          ? new Date(data.lastHeartbeat)
          : undefined,
        registeredAt: data.registeredAt
          ? new Date(data.registeredAt)
          : undefined,
      })
      .where(eq(schema.agentsTable.id, id))
      .returning();

    return {
      ...result[0],
      lastHeartbeat: result[0].lastHeartbeat.toISOString(),
      registeredAt: result[0].registeredAt.toISOString(),
      metadata: result[0].metadata || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(schema.agentsTable)
      .where(eq(schema.agentsTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.agentsTable)
      .where(where);

    return result[0]?.count || 0;
  }

  async findDistinctLocations(onlineOnly?: boolean): Promise<string[]> {
    const whereClause = onlineOnly
      ? eq(schema.agentsTable.status, "online" as AgentStatus)
      : undefined;

    const result = await this.db
      .selectDistinct({ location: schema.agentsTable.location })
      .from(schema.agentsTable)
      .where(whereClause)
      .orderBy(asc(schema.agentsTable.location));

    return result.map((row) => row.location);
  }
}
