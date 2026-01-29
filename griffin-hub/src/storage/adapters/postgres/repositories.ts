/**
 * PostgreSQL implementation of repositories using Drizzle ORM.
 */

import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { MonitorV1 } from "../../../schemas/monitors.js";
import type { JobRun } from "../../../schemas/job-run.js";
import type { Agent, AgentStatus } from "../../../schemas/agent.js";
import type {
  MonitorsRepository,
  RunsRepository,
  AgentsRepository,
  QueryOptions,
} from "../../repositories.js";
import type { DrizzleDatabase } from "../../../plugins/storage.js";
import { agentsTable, monitorsTable, runsTable } from "./schema.js";
import type { TestMonitorDB } from "../../repositories.js";
import {
  mapDbMonitorToVersionedMonitor,
  mapDbMonitorsToVersionedMonitors,
  type VersionedMonitor,
} from "../../monitor-mapper.js";

// =============================================================================
// Monitors Repository
// =============================================================================

export class PostgresMonitorsRepository implements MonitorsRepository {
  constructor(private db: DrizzleDatabase) {}

  async create(data: Omit<TestMonitorDB, "id">): Promise<VersionedMonitor> {
    const result = await this.db
      .insert(monitorsTable)
      .values({
        ...data,
        id: randomUUID(),
      })
      .returning();

    return mapDbMonitorToVersionedMonitor(result[0]);
  }

  async findById(id: string): Promise<VersionedMonitor | null> {
    const result = await this.db.query.monitorsTable.findFirst({
      where: eq(monitorsTable.id, id),
    });

    if (!result) {
      return null;
    }

    return mapDbMonitorToVersionedMonitor(result);
  }

  async findMany(options?: QueryOptions): Promise<VersionedMonitor[]> {
    const result = await this.db.query.monitorsTable.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
      limit: options?.limit,
      offset: options?.offset,
    });

    return mapDbMonitorsToVersionedMonitors(result);
  }

  async update(
    id: string,
    data: Partial<Omit<TestMonitorDB, "id">>,
  ): Promise<VersionedMonitor> {
    const result = await this.db
      .update(monitorsTable)
      .set(data)
      .where(eq(monitorsTable.id, id))
      .returning();

    return mapDbMonitorToVersionedMonitor(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(monitorsTable).where(eq(monitorsTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    return this.db.$count(monitorsTable, where);
  }

  async findDue(): Promise<VersionedMonitor[]> {
    // Complex query: find monitors that are due based on their frequency
    // A monitor is due if:
    // 1. It has a frequency defined AND
    // 2. Either it has never run OR its next scheduled run time has passed
    //
    // NOTE: We must use "monitors.id" (not just "id") in the correlated subquery
    // because the runs table also has an "id" column. Without the table qualifier,
    // PostgreSQL resolves "id" to runs.id, making the subquery always return NULL.

    const subquery = this.db
      .select({ startedAt: runsTable.startedAt })
      .from(runsTable)
      .where(eq(runsTable.monitorId, monitorsTable.id))
      .orderBy(desc(runsTable.startedAt))
      .limit(1)
      .as("latest_run");
    const result = await this.db
      .select({
        monitors: monitorsTable,
      })
      .from(monitorsTable)
      .leftJoinLateral(subquery, sql`true`).where(sql`
        frequency IS NOT NULL
        AND (
          (SELECT MAX(started_at) FROM ${runsTable} WHERE ${runsTable.monitorId} = ${monitorsTable.id}) IS NULL
          OR (
            (SELECT MAX(started_at) FROM ${runsTable} WHERE ${runsTable.monitorId} = ${monitorsTable.id}) + make_interval(
              mins => CASE WHEN (frequency->>'unit') = 'MINUTE' THEN (frequency->>'every')::int ELSE 0 END,
              hours => CASE WHEN (frequency->>'unit') = 'HOUR' THEN (frequency->>'every')::int ELSE 0 END,
              days => CASE WHEN (frequency->>'unit') = 'DAY' THEN (frequency->>'every')::int ELSE 0 END
            ) <= NOW()
          )
        )
      `);

    return mapDbMonitorsToVersionedMonitors(result.map((r) => r.monitors));
  }
}

// =============================================================================
// Runs Repository
// =============================================================================

export class PostgresRunsRepository implements RunsRepository {
  constructor(private db: DrizzleDatabase) {}

  async create(data: Omit<JobRun, "id">): Promise<JobRun> {
    const result = await this.db
      .insert(runsTable)
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
      where: eq(runsTable.id, id),
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
      .update(runsTable)
      .set({
        ...data,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      })
      .where(eq(runsTable.id, id))
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
    await this.db.delete(runsTable).where(eq(runsTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    return this.db.$count(runsTable, where);
  }

  async findLatestForMonitor(monitorId: string): Promise<JobRun | null> {
    const result = await this.db.query.runsTable.findFirst({
      where: eq(runsTable.monitorId, monitorId),
      orderBy: [desc(runsTable.startedAt)],
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
      .insert(agentsTable)
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
      where: eq(agentsTable.id, id),
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
      .update(agentsTable)
      .set({
        ...data,
        lastHeartbeat: data.lastHeartbeat
          ? new Date(data.lastHeartbeat)
          : undefined,
        registeredAt: data.registeredAt
          ? new Date(data.registeredAt)
          : undefined,
      })
      .where(eq(agentsTable.id, id))
      .returning();

    return {
      ...result[0],
      lastHeartbeat: result[0].lastHeartbeat.toISOString(),
      registeredAt: result[0].registeredAt.toISOString(),
      metadata: result[0].metadata || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(agentsTable).where(eq(agentsTable.id, id));
  }

  async count(where?: SQL): Promise<number> {
    return this.db.$count(agentsTable, where);
  }

  async findDistinctLocations(onlineOnly?: boolean): Promise<string[]> {
    const whereClause = onlineOnly
      ? eq(agentsTable.status, "online" as AgentStatus)
      : undefined;

    const result = await this.db
      .selectDistinct({ location: agentsTable.location })
      .from(agentsTable)
      .where(whereClause)
      .orderBy(asc(agentsTable.location));

    return result.map((row) => row.location);
  }
}
