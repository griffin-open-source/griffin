import type { JobQueue, Job } from "../storage/ports.js";
import type { Storage } from "../storage/repositories.js";
import type { SecretProviderRegistry } from "@griffin-app/griffin-plan-executor";
import { executePlanV1 } from "@griffin-app/griffin-plan-executor";
import type {
  HttpClientAdapter,
  ExecutionOptions,
} from "@griffin-app/griffin-plan-executor";
import { JobRunStatus } from "../schemas/job-run.js";
import { utcNow } from "../utils/dates.js";

/**
 * Execution job data structure.
 * Must match the format used by the scheduler when enqueueing jobs.
 */
export interface ExecutionJobData {
  type: "execute-plan";
  planId: string;
  jobRunId: string;
  environment: string;
  location: string;
  executionGroupId: string;
  plan: any; // TestPlanV1 - Full plan included for self-sufficiency
  scheduledAt: string;
}

export interface ExecutorConfig {
  /**
   * Initial delay when queue is empty (ms).
   * Uses exponential backoff up to maxEmptyDelay.
   */
  emptyDelay: number;

  /**
   * Maximum delay when queue is empty (ms).
   */
  maxEmptyDelay: number;

  /**
   * HTTP client for plan execution.
   */
  httpClient: HttpClientAdapter;

  /**
   * Request timeout for plan execution (ms).
   */
  timeout: number;

  /**
   * Secret provider registry for resolving secrets in plans.
   */
  secretRegistry: SecretProviderRegistry;
}

/**
 * Executor service that processes execution jobs from the queue.
 * Uses direct storage access instead of HTTP API calls (unlike remote agents).
 */
export class ExecutorService {
  private isRunning = false;
  private executorPromise?: Promise<void>;
  private emptyDelay: number;
  private maxEmptyDelay: number;
  private currentEmptyDelay: number;
  private httpClient: HttpClientAdapter;
  private timeout: number;
  private secretRegistry: SecretProviderRegistry;
  private location = "local"; // Built-in executor always uses "local" location

  constructor(
    private jobQueue: JobQueue<ExecutionJobData>,
    private storage: Storage,
    config: ExecutorConfig,
  ) {
    this.emptyDelay = config.emptyDelay;
    this.maxEmptyDelay = config.maxEmptyDelay;
    this.currentEmptyDelay = this.emptyDelay;
    this.httpClient = config.httpClient;
    this.timeout = config.timeout;
    this.secretRegistry = config.secretRegistry;
  }

  /**
   * Start processing jobs from the queue.
   */
  start(): void {
    if (this.isRunning) {
      throw new Error("Executor is already running");
    }

    this.isRunning = true;
    this.executorPromise = this.runExecutorLoop();
  }

  /**
   * Stop the executor gracefully.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Wait for current job to complete
    if (this.executorPromise) {
      await this.executorPromise;
    }
  }

  private async runExecutorLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = await this.jobQueue.dequeue(this.location);

        if (!job) {
          // No jobs available, wait with exponential backoff
          await this.sleep(this.currentEmptyDelay);
          this.currentEmptyDelay = Math.min(
            this.currentEmptyDelay * 2,
            this.maxEmptyDelay,
          );
          continue;
        }

        // Reset backoff on successful dequeue
        this.currentEmptyDelay = this.emptyDelay;

        // Process the job
        await this.processJob(job);
      } catch (error) {
        console.error("Error in executor loop:", error);
        // Wait a bit before retrying to avoid tight error loops
        await this.sleep(1000);
      }
    }
  }

  private async processJob(job: Job<ExecutionJobData>): Promise<void> {
    const data = job.data;

    try {
      const plan = data.plan;

      console.log(
        `Executing plan: ${plan.name} (${plan.id}) in environment: ${data.environment} from location: ${data.location}`,
      );

      // Get the organization from the plan
      if (!plan.organization) {
        throw new Error(`Plan ${plan.id} does not have an organization set`);
      }

      // Execute the plan with status callbacks
      const executionOptions: ExecutionOptions = {
        mode: "local",
        httpClient: this.httpClient,
        timeout: this.timeout,
        secretRegistry: this.secretRegistry,
        statusCallbacks: {
          onStart: async () => {
            await this.storage.runs.update(data.jobRunId, {
              status: JobRunStatus.RUNNING,
            });
          },
          onComplete: async (update) => {
            // Map the executor's status strings to JobRunStatus enum
            const status =
              update.status === "running"
                ? JobRunStatus.RUNNING
                : update.status === "completed"
                  ? JobRunStatus.COMPLETED
                  : JobRunStatus.FAILED;

            await this.storage.runs.update(data.jobRunId, {
              status,
              completedAt: update.completedAt,
              duration_ms: update.duration_ms,
              success: update.success,
              errors: update.errors,
            });
          },
        },
      };

      const result = await executePlanV1(
        plan,
        plan.organization!,
        executionOptions,
      );

      // Acknowledge the job
      await this.jobQueue.acknowledge(job.id);

      console.log(
        `Plan execution ${result.success ? "succeeded" : "failed"}: ${plan.name} (${plan.id}) in ${result.totalDuration_ms}ms`,
      );
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);

      // Try to update JobRun to failed via storage (in case executor didn't complete)
      try {
        await this.storage.runs.update(data.jobRunId, {
          status: JobRunStatus.FAILED,
          completedAt: utcNow(),
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (updateError) {
        console.error("Failed to update JobRun:", updateError);
      }

      // Fail the job (with retry)
      await this.jobQueue.fail(
        job.id,
        error instanceof Error ? error : new Error(String(error)),
        true,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
