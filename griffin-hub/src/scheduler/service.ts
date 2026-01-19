import { randomUUID } from "node:crypto";
import type { RepositoryBackend, JobQueueBackend } from "../storage/ports.js";
import type { TestPlanV1 } from "griffin/types";
import { JobRunStatus, TriggerType, type JobRun } from "../schemas/job-run.js";
import { findDuePlansMemory } from "./queries.js";

export interface SchedulerConfig {
  /**
   * Interval between scheduler ticks in milliseconds.
   * Default: 30000 (30 seconds)
   */
  tickInterval?: number;

  /**
   * Repository backend type for determining query strategy.
   * Default: 'memory'
   */
  backendType?: "memory" | "postgres" | "sqlite";
}

export interface ExecutionJobData {
  type: "execute-plan";
  planId: string;
  jobRunId?: string;
  environment: string;
  scheduledAt: string; // ISO timestamp
}

/**
 * Scheduler service that finds plans due for execution and enqueues them.
 */
export class SchedulerService {
  private tickInterval: number;
  private backendType: "memory" | "postgres" | "sqlite";
  private intervalHandle?: NodeJS.Timeout;
  private isRunning = false;
  private currentTickPromise?: Promise<void>;

  constructor(
    private repository: RepositoryBackend,
    private jobQueue: JobQueueBackend,
    config: SchedulerConfig = {},
  ) {
    this.tickInterval = config.tickInterval ?? 30000;
    this.backendType = config.backendType ?? "memory";
  }

  /**
   * Start the scheduler ticker.
   */
  start(): void {
    if (this.isRunning) {
      throw new Error("Scheduler is already running");
    }

    this.isRunning = true;

    // Run immediately on start
    this.tick().catch((error) => {
      console.error("Error in initial scheduler tick:", error);
    });

    // Then run on interval
    this.intervalHandle = setInterval(() => {
      this.tick().catch((error) => {
        console.error("Error in scheduler tick:", error);
      });
    }, this.tickInterval);
  }

  /**
   * Stop the scheduler and wait for current tick to complete.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    // Wait for current tick to complete if one is running
    if (this.currentTickPromise) {
      await this.currentTickPromise;
    }
  }

  /**
   * Find plans that are due and enqueue execution jobs for them.
   */
  async tick(): Promise<void> {
    if (this.currentTickPromise) {
      // Already ticking, skip this interval
      return;
    }

    this.currentTickPromise = this._tick();

    try {
      await this.currentTickPromise;
    } finally {
      this.currentTickPromise = undefined;
    }
  }

  private async _tick(): Promise<void> {
    try {
      // Find plans that are due
      const duePlans = await this.findDuePlans();

      // Enqueue execution jobs for each due plan
      for (const plan of duePlans) {
        await this.enqueuePlanExecution(plan);
      }

      if (duePlans.length > 0) {
        console.log(`Scheduled ${duePlans.length} plan(s) for execution`);
      }
    } catch (error) {
      console.error("Error in scheduler tick:", error);
      throw error;
    }
  }

  private async findDuePlans(): Promise<TestPlanV1[]> {
    switch (this.backendType) {
      case "memory":
        return this.repository.execute<TestPlanV1>(findDuePlansMemory);

      case "postgres":
        // TODO: Use findDuePlansPostgres() when postgres backend is implemented
        throw new Error("Postgres scheduler not yet implemented");

      case "sqlite":
        // TODO: Use findDuePlansSqlite() when sqlite backend is implemented
        throw new Error("SQLite scheduler not yet implemented");

      default:
        throw new Error(`Unknown backend type: ${this.backendType}`);
    }
  }

  private async enqueuePlanExecution(plan: TestPlanV1): Promise<void> {
    const now = new Date();
    const jobRunRepo = this.repository.repository<JobRun>("job_runs");
    const queue = this.jobQueue.queue<ExecutionJobData>("plan-executions");

    const environment = plan.environment ?? "default";
    const executionGroupId = randomUUID();
    // TODO: Phase 2 - Resolve location from agent registry or plan.locations
    const location = "local";

    // Create a JobRun record
    const jobRun = await jobRunRepo.create({
      planId: plan.id,
      executionGroupId,
      location,
      environment: plan.environment,
      status: JobRunStatus.PENDING,
      triggeredBy: TriggerType.SCHEDULE,
      startedAt: now.toISOString(),
    });

    // Enqueue the job
    await queue.enqueue(
      {
        type: "execute-plan",
        planId: plan.id,
        jobRunId: jobRun.id,
        environment,
        scheduledAt: now.toISOString(),
      },
      {
        location,
        runAt: now,
        priority: 0,
        maxAttempts: 3,
      },
    );

    console.log(
      `Enqueued plan execution: ${plan.name} (${plan.id}), jobRun: ${jobRun.id}, environment: ${environment}`,
    );
  }
}
