import { randomUUID } from "node:crypto";
import type { Storage } from "../storage/index.js";
import type { JobQueueBackend } from "../job-queue/index.js";
import type { MonitorV1 } from "../schemas/monitors.js";
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
  type: "execute-monitor";
  monitorId: string;
  jobRunId: string;
  environment: string;
  location: string;
  executionGroupId: string;
  monitor: MonitorV1; // Full monitor included for executor/agent self-sufficiency
  scheduledAt: string; // ISO timestamp
}

/**
 * Scheduler service that finds monitors due for execution and enqueues them.
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
   * Find monitors that are due and enqueue execution jobs for them.
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
      // Find monitors that are due
      const dueMonitors = await this.findDueMonitors();

      // Enqueue execution jobs for each due monitor
      for (const monitor of dueMonitors) {
        await this.enqueueMonitorExecution(monitor);
      }

      if (dueMonitors.length > 0) {
        console.log(`Scheduled ${dueMonitors.length} monitor(s) for execution`);
      }
    } catch (error) {
      console.error("Error in scheduler tick:", error);
      throw error;
    }
  }

  private async findDueMonitors(): Promise<MonitorV1[]> {
    return await this.storage.monitors.findDue();
  }

  private async enqueueMonitorExecution(monitor: MonitorV1): Promise<void> {
    const now = utcNow();
    const queue = this.jobQueue.queue<ExecutionJobData>("monitor-executions");

    const environment = monitor.environment ?? "default";
    const executionGroupId = randomUUID();
    // TODO: Phase 2 - Resolve location from agent registry or monitor.locations
    const location = "local";

    // Create a JobRun record
    const jobRun = await this.storage.runs.create({
      monitorId: monitor.id,
      executionGroupId,
      location,
      environment: monitor.environment,
      status: JobRunStatus.PENDING,
      triggeredBy: TriggerType.SCHEDULE,
      startedAt: now,
    });

    // Enqueue the job
    await queue.enqueue(
      {
        type: "execute-monitor",
        monitorId: monitor.id,
        jobRunId: jobRun.id,
        environment,
        location,
        executionGroupId,
        monitor, // Include full monitor for executor/agent
        scheduledAt: now,
      },
      {
        location,
        maxAttempts: 3,
      },
    );

    console.log(
      `Enqueued monitor execution: ${monitor.name} (${monitor.id}), jobRun: ${jobRun.id}, environment: ${environment}`,
    );
  }
}
