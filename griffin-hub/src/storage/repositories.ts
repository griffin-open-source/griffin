/**
 * Drizzle-centric repository interfaces.
 * Each repository is specific to a database table and uses drizzle SQL expressions for filtering.
 */

import type { SQL } from "drizzle-orm";
import * as schema from "./adapters/postgres/schema.js";
import type { JobRun } from "../schemas/job-run.js";
import type { Agent } from "../schemas/agent.js";
import type { VersionedMonitor } from "./monitor-mapper.js";

// =============================================================================
// Query Options
// =============================================================================

/**
 * Query options using drizzle SQL expressions for filtering
 */
export interface QueryOptions {
  where?: SQL;
  orderBy?: SQL[];
  limit?: number;
  offset?: number;
}
export type TestMonitorDB = typeof schema.monitorsTable.$inferInsert;

// =============================================================================
// Repository Interfaces
// =============================================================================

/**
 * Repository for test monitors
 */
export interface MonitorsRepository {
  create(data: Omit<TestMonitorDB, "id">): Promise<VersionedMonitor>;
  findById(id: string): Promise<VersionedMonitor | null>;
  findMany(options?: QueryOptions): Promise<VersionedMonitor[]>;
  update(
    id: string,
    data: Partial<Omit<TestMonitorDB, "id">>,
  ): Promise<VersionedMonitor>;
  delete(id: string): Promise<void>;
  count(where?: SQL): Promise<number>;

  /**
   * Find monitors that are due for execution based on their frequency.
   * Returns monitors that have never run or whose next run time has passed.
   */
  findDue(): Promise<VersionedMonitor[]>;
}

/**
 * Repository for job runs
 */
export interface RunsRepository {
  create(data: Omit<JobRun, "id">): Promise<JobRun>;
  findById(id: string): Promise<JobRun | null>;
  findMany(options?: QueryOptions): Promise<JobRun[]>;
  update(id: string, data: Partial<Omit<JobRun, "id">>): Promise<JobRun>;
  delete(id: string): Promise<void>;
  count(where?: SQL): Promise<number>;

  /**
   * Find the most recent run for a given monitor ID.
   * Returns null if no runs exist for the monitor.
   */
  findLatestForMonitor(monitorId: string): Promise<JobRun | null>;
}

/**
 * Repository for agents
 */
export interface AgentsRepository {
  create(data: Omit<Agent, "id">): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  findMany(options?: QueryOptions): Promise<Agent[]>;
  update(id: string, data: Partial<Omit<Agent, "id">>): Promise<Agent>;
  delete(id: string): Promise<void>;
  count(where?: SQL): Promise<number>;

  /**
   * Find all distinct location values across all agents.
   * Optionally filter to only online agents.
   */
  findDistinctLocations(onlineOnly?: boolean): Promise<string[]>;
}

// =============================================================================
// Storage Backend
// =============================================================================

/**
 * Unified storage interface providing typed access to all repositories.
 * Replaces the generic RepositoryBackend with specific, type-safe repository accessors.
 */
export interface Storage {
  monitors: MonitorsRepository;
  runs: RunsRepository;
  agents: AgentsRepository;

  /**
   * Connect to the storage backend.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the storage backend.
   */
  disconnect(): Promise<void>;

  /**
   * Execute a function within a transaction.
   * If the function throws, the transaction is rolled back.
   */
  transaction<R>(fn: (tx: Storage) => Promise<R>): Promise<R>;
}
