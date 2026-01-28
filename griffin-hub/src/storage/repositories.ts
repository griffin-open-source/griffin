/**
 * Drizzle-centric repository interfaces.
 * Each repository is specific to a database table and uses drizzle SQL expressions for filtering.
 */

import type { SQL } from "drizzle-orm";
import * as schema from "./adapters/postgres/schema.js";
import type { JobRun } from "../schemas/job-run.js";
import type { Agent } from "../schemas/agent.js";
import type { VersionedPlan } from "./plan-mapper.js";

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
export type TestPlanDB = typeof schema.plansTable.$inferInsert;

// =============================================================================
// Repository Interfaces
// =============================================================================

/**
 * Repository for test plans
 */
export interface PlansRepository {
  create(data: Omit<TestPlanDB, "id">): Promise<VersionedPlan>;
  findById(id: string): Promise<VersionedPlan | null>;
  findMany(options?: QueryOptions): Promise<VersionedPlan[]>;
  update(
    id: string,
    data: Partial<Omit<TestPlanDB, "id">>,
  ): Promise<VersionedPlan>;
  delete(id: string): Promise<void>;
  count(where?: SQL): Promise<number>;

  /**
   * Find plans that are due for execution based on their frequency.
   * Returns plans that have never run or whose next run time has passed.
   */
  findDue(): Promise<VersionedPlan[]>;
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
   * Find the most recent run for a given plan ID.
   * Returns null if no runs exist for the plan.
   */
  findLatestForPlan(planId: string): Promise<JobRun | null>;
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
  plans: PlansRepository;
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
