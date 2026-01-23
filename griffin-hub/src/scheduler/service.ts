import { randomUUID } from "node:crypto";
import type { Storage, JobQueueBackend } from "../storage/index.js";
import type { PlanV1 } from "../schemas/plans.js";
import { JobRunStatus, TriggerType, type JobRun } from "../schemas/job-run.js";
import { utcNow } from "../utils/dates.js";
export interface SchedulerConfig {
  /**
   * Interval between scheduler ticks in milliseconds.
   * Default: 30000 (30 seconds)
   */
  tickInterval?: number;
}

export interface ExecutionJobData {
  type: "execute-plan";
  planId: string;
  jobRunId: string;
  environment: string;
  location: string;
  executionGroupId: string;
  plan: PlanV1; // Full plan included for executor/agent self-sufficiency
  scheduledAt: string; // ISO timestamp
}

/**
 * Scheduler service that finds plans due for execution and enqueues them.
 */
export class SchedulerService {
  private tickInterval: number;
  private intervalHandle?: NodeJS.Timeout;
  private isRunning = false;
  private currentTickPromise?: Promise<void>;

  constructor(
    private storage: Storage,
    private jobQueue: JobQueueBackend,
    config: SchedulerConfig = {},
  ) {
    this.tickInterval = config.tickInterval ?? 30000;
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

  private async findDuePlans(): Promise<PlanV1[]> {
    return await this.storage.plans.findDue();
  }

  private async enqueuePlanExecution(plan: PlanV1): Promise<void> {
    const now = utcNow();
    const queue = this.jobQueue.queue<ExecutionJobData>("plan-executions");

    const environment = plan.environment ?? "default";
    const executionGroupId = randomUUID();
    // TODO: Phase 2 - Resolve location from agent registry or plan.locations
    const location = "local";

    // Create a JobRun record
    const jobRun = await this.storage.runs.create({
      planId: plan.id,
      executionGroupId,
      location,
      environment: plan.environment,
      status: JobRunStatus.PENDING,
      triggeredBy: TriggerType.SCHEDULE,
      startedAt: now,
    });

    // Enqueue the job
    await queue.enqueue(
      {
        type: "execute-plan",
        planId: plan.id,
        jobRunId: jobRun.id,
        environment,
        location,
        executionGroupId,
        plan, // Include full plan for executor/agent
        scheduledAt: now,
      },
      {
        location,
        runAt: new Date(now),
        priority: 0,
        maxAttempts: 3,
      },
    );

    console.log(
      `Enqueued plan execution: ${plan.name} (${plan.id}), jobRun: ${jobRun.id}, environment: ${environment}`,
    );
  }
}
