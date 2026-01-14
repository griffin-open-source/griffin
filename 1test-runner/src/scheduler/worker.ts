import type { RepositoryBackend, JobQueueBackend } from "../storage/ports.js";
import type { TestPlanV1, SecretProviderRegistry } from "1test-plan-executor";
import { JobRunStatus, type JobRun } from "../schemas/job-run.js";
import type { ExecutionJobData } from "./service.js";
import { executePlanV1 } from "1test-plan-executor";
import type { HttpClientAdapter, ExecutionOptions } from "1test-plan-executor";

export interface WorkerConfig {
  /**
   * Initial delay when queue is empty (ms).
   * Uses exponential backoff up to maxEmptyDelay.
   * Default: 1000 (1 second)
   */
  emptyDelay?: number;

  /**
   * Maximum delay when queue is empty (ms).
   * Default: 30000 (30 seconds)
   */
  maxEmptyDelay?: number;

  /**
   * HTTP client for plan execution.
   */
  httpClient: HttpClientAdapter;

  /**
   * Base URL override for plan execution.
   */
  baseUrl?: string;

  /**
   * Request timeout for plan execution (ms).
   * Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Secret provider registry for resolving secrets in plans.
   */
  secretRegistry?: SecretProviderRegistry;
}

/**
 * Worker service that processes execution jobs from the queue.
 */
export class WorkerService {
  private isRunning = false;
  private workerPromise?: Promise<void>;
  private emptyDelay: number;
  private maxEmptyDelay: number;
  private currentEmptyDelay: number;
  private httpClient: HttpClientAdapter;
  private baseUrl?: string;
  private timeout: number;
  private secretRegistry?: SecretProviderRegistry;

  constructor(
    private repository: RepositoryBackend,
    private jobQueue: JobQueueBackend,
    config: WorkerConfig,
  ) {
    this.emptyDelay = config.emptyDelay ?? 1000;
    this.maxEmptyDelay = config.maxEmptyDelay ?? 30000;
    this.currentEmptyDelay = this.emptyDelay;
    this.httpClient = config.httpClient;
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
    this.secretRegistry = config.secretRegistry;
  }

  /**
   * Start processing jobs from the queue.
   */
  start(): void {
    if (this.isRunning) {
      throw new Error("Worker is already running");
    }

    this.isRunning = true;
    this.workerPromise = this.runWorkerLoop();
  }

  /**
   * Stop the worker gracefully.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Wait for current job to complete
    if (this.workerPromise) {
      await this.workerPromise;
    }
  }

  private async runWorkerLoop(): Promise<void> {
    const queue = this.jobQueue.queue<ExecutionJobData>("plan-executions");

    while (this.isRunning) {
      try {
        const job = await queue.dequeue();

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
        await this.processJob(job.id, job.data);
      } catch (error) {
        console.error("Error in worker loop:", error);
        // Wait a bit before retrying to avoid tight error loops
        await this.sleep(1000);
      }
    }
  }

  private async processJob(
    jobId: string,
    data: ExecutionJobData,
  ): Promise<void> {
    const queue = this.jobQueue.queue<ExecutionJobData>("plan-executions");
    const jobRunRepo = this.repository.repository<JobRun>("job_runs");
    const planRepo = this.repository.repository<TestPlanV1>("plans");

    try {
      // Find the plan
      const plan = await planRepo.findById(data.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${data.planId}`);
      }

      // Find the corresponding JobRun
      const jobRuns = await jobRunRepo.findMany({
        filter: { planId: data.planId },
        sort: { field: "startedAt", order: "desc" },
        limit: 1,
      });

      const jobRun = jobRuns[0];
      if (!jobRun) {
        throw new Error(`JobRun not found for plan: ${data.planId}`);
      }

      // Update JobRun to running
      await jobRunRepo.update(jobRun.id, {
        status: JobRunStatus.RUNNING,
      });

      console.log(`Executing plan: ${plan.name} (${plan.id})`);

      // Execute the plan
      const startTime = Date.now();
      const executionOptions: ExecutionOptions = {
        mode: "remote",
        httpClient: this.httpClient,
        baseUrl: this.baseUrl,
        timeout: this.timeout,
        secretRegistry: this.secretRegistry,
      };

      const result = await executePlanV1(plan, executionOptions);
      const duration = Date.now() - startTime;

      // Update JobRun with results
      await jobRunRepo.update(jobRun.id, {
        status: result.success ? JobRunStatus.COMPLETED : JobRunStatus.FAILED,
        completedAt: new Date().toISOString(),
        duration_ms: duration,
        success: result.success,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });

      // Acknowledge the job
      await queue.acknowledge(jobId);

      console.log(
        `Plan execution ${result.success ? "succeeded" : "failed"}: ${plan.name} (${plan.id}) in ${duration}ms`,
      );
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      // Try to update JobRun to failed
      try {
        const jobRuns = await jobRunRepo.findMany({
          filter: { planId: data.planId },
          sort: { field: "startedAt", order: "desc" },
          limit: 1,
        });

        if (jobRuns[0]) {
          await jobRunRepo.update(jobRuns[0].id, {
            status: JobRunStatus.FAILED,
            completedAt: new Date().toISOString(),
            errors: [error instanceof Error ? error.message : String(error)],
          });
        }
      } catch (updateError) {
        console.error("Failed to update JobRun:", updateError);
      }

      // Fail the job (with retry)
      await queue.fail(
        jobId,
        error instanceof Error ? error : new Error(String(error)),
        true,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
