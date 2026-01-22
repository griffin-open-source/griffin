/**
 * SQLite implementation of repositories using Drizzle ORM.
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
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { FrequencyUnit } from "@griffin-app/griffin-ts/schema";
import type { TestPlanDB } from "../../repositories.js";

// =============================================================================
// Plans Repository
// =============================================================================

export class SqlitePlansRepository implements PlansRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async create(data: Omit<TestPlanDB, "id">): Promise<TestPlanDB> {
    const now = new Date();
    const result = this.db
      .insert(schema.plansTable)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return {
      ...result,
      version: "1.0",
      locations: result.locations || [],
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
    const result = this.db
      .update(schema.plansTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.plansTable.id, id))
      .returning()
      .get();

    return {
      ...result,
      locations: result.locations || [],
      version: "1.0",
    };
  }

  async delete(id: string): Promise<void> {
    this.db.delete(schema.plansTable).where(eq(schema.plansTable.id, id)).run();
  }

  async count(where?: SQL): Promise<number> {
    const result = this.db
      .select({ count: count() })
      .from(schema.plansTable)
      .where(where)
      .get();

    return result?.count || 0;
  }

  async findDue(): Promise<TestPlanV1[]> {
    // SQLite query: find plans that are due based on their frequency
    // A plan is due if:
    // 1. It has a frequency defined AND
    // 2. Either it has never run OR its next scheduled run time has passed

    // SQLite doesn't support LATERAL joins like Postgres, so we use a correlated subquery

    const result = await this.findMany({
      where: sql`
        p.frequency IS NOT NULL
        AND (
          (SELECT MAX(started_at) FROM runs WHERE plan_id = p.id) IS NULL
          OR datetime(
            (SELECT MAX(started_at) FROM runs WHERE plan_id = p.id),
            '+' || json_extract(p.frequency, '$.every') || ' ' || 
            CASE json_extract(p.frequency, '$.unit')
              WHEN ${FrequencyUnit.MINUTE} THEN 'minutes'
              WHEN ${FrequencyUnit.HOUR} THEN 'hours'
              WHEN ${FrequencyUnit.DAY} THEN 'days'
            END
          ) <= datetime('now')
        )
      `,
    });
    return result.map((plan) => ({
      ...plan,
      // Parse JSON fields
      frequency: plan.frequency,
      locations: plan.locations || [],
      nodes: plan.nodes,
      edges: plan.edges,
      // Convert timestamps
      //createdAt: plan.createdAt,
      //updatedAt: plan.updatedAt,
      version: "1.0",
    }));
  }
}

// =============================================================================
// Runs Repository
// =============================================================================

export class SqliteRunsRepository implements RunsRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async create(data: Omit<JobRun, "id">): Promise<JobRun> {
    const now = new Date();
    const result = this.db
      .insert(schema.runsTable)
      .values({
        ...data,
        id: randomUUID(),
        startedAt: data.startedAt ? new Date(data.startedAt) : now,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return {
      ...result,
      duration_ms: result.duration_ms || undefined,
      completedAt: result.completedAt
        ? result.completedAt.toISOString()
        : undefined,
      startedAt: result.startedAt.toISOString(),
      success: result.success || undefined,
      errors: result.errors || undefined,
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
        updatedAt: new Date(),
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      })
      .where(eq(schema.runsTable.id, id))
      .returning()
      .get();

    return {
      ...result,
      duration_ms: result.duration_ms || undefined,
      completedAt: result.completedAt
        ? result.completedAt.toISOString()
        : undefined,
      startedAt: result.startedAt.toISOString(),
      success: result.success || undefined,
      errors: result.errors || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    this.db.delete(schema.runsTable).where(eq(schema.runsTable.id, id)).run();
  }

  async count(where?: SQL): Promise<number> {
    const result = await this.db.$count(schema.runsTable, where);

    return result || 0;
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

export class SqliteAgentsRepository implements AgentsRepository {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  async create(data: Omit<Agent, "id">): Promise<Agent> {
    const now = new Date();
    const result = this.db
      .insert(schema.agentsTable)
      .values({
        ...data,
        id: randomUUID(),
        lastHeartbeat: new Date(data.lastHeartbeat),
        registeredAt: new Date(data.registeredAt),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return {
      ...result,
      lastHeartbeat: result.lastHeartbeat.toISOString(),
      registeredAt: result.registeredAt.toISOString(),
      metadata: result.metadata || undefined,
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
    const result = this.db
      .update(schema.agentsTable)
      .set({
        ...data,
        updatedAt: new Date(),
        lastHeartbeat: data.lastHeartbeat
          ? new Date(data.lastHeartbeat)
          : undefined,
        registeredAt: data.registeredAt
          ? new Date(data.registeredAt)
          : undefined,
      })
      .where(eq(schema.agentsTable.id, id))
      .returning()
      .get();

    return {
      ...result,
      lastHeartbeat: result.lastHeartbeat.toISOString(),
      registeredAt: result.registeredAt.toISOString(),
      metadata: result.metadata || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    this.db
      .delete(schema.agentsTable)
      .where(eq(schema.agentsTable.id, id))
      .run();
  }

  async count(where?: SQL): Promise<number> {
    const result = this.db.$count(schema.agentsTable, where);

    return result || 0;
  }

  async findDistinctLocations(onlineOnly?: boolean): Promise<string[]> {
    const result = await this.db.query.agentsTable.findMany({
      where: onlineOnly
        ? eq(schema.agentsTable.status, "online" as AgentStatus)
        : undefined,
      orderBy: [asc(schema.agentsTable.location)],
    });

    return result.map((agent) => agent.location);
  }
}
