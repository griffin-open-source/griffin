import type { AgentsApi, RunsApi } from "griffin-hub-sdk";
import type { QueueConsumer, ExecutionJobData } from "./queue/types.js";
//import type { HubClient } from "./hub-client.js";
import type { SecretProviderRegistry } from "griffin-plan-executor";
import { executePlanV1 } from "griffin-plan-executor";
import type {
  HttpClientAdapter,
  ExecutionOptions,
} from "griffin-plan-executor";
import { utcNow } from "./utils/dates.js";

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
 * Reports results back to the hub via HTTP API.
 */
export class WorkerService {
  private isRunning = false;
  private workerPromise?: Promise<void>;
  private emptyDelay: number;
  private maxEmptyDelay: number;
  private currentEmptyDelay: number;
  private httpClient: HttpClientAdapter;
  private timeout: number;
  private secretRegistry: SecretProviderRegistry | undefined;

  constructor(
    private location: string,
    private queueConsumer: QueueConsumer,
    private runsApi: RunsApi,
    config: WorkerConfig,
  ) {
    this.emptyDelay = config.emptyDelay ?? 1000;
    this.maxEmptyDelay = config.maxEmptyDelay ?? 30000;
    this.currentEmptyDelay = this.emptyDelay;
    this.httpClient = config.httpClient;
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
    while (this.isRunning) {
      try {
        const job = await this.queueConsumer.poll(this.location);

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
    try {
      const plan = data.plan;

      console.log(
        `Executing plan: ${plan.name} (${plan.id}) in environment: ${data.environment} from location: ${data.location}`,
      );

      // Get the organization from the plan (required for target resolution)
      if (!plan.organization) {
        throw new Error(`Plan ${plan.id} does not have an organization set`);
      }

      // Create target resolver function that fetches from hub API
      const targetResolver = async (
        targetKey: string,
      ): Promise<string | undefined> => {
        const {
          data: {
            data: { baseUrl },
          },
        } =
          await this.configApi.configOrganizationIdEnvironmentTargetsTargetKeyGet(
            plan.organization!,
            data.environment,
            targetKey,
          );
        return baseUrl;
      };

      // Execute the plan with status callbacks
      const executionOptions: ExecutionOptions = {
        mode: "remote",
        httpClient: this.httpClient,
        timeout: this.timeout,
        ...(this.secretRegistry && { secretRegistry: this.secretRegistry }),
        targetResolver,
        statusCallbacks: {
          onStart: async () => {
            await this.runsApi.runsIdPatch(data.jobRunId, {
              status: "running",
            });
          },
          onComplete: async (update) => {
            await this.runsApi.runsIdPatch(data.jobRunId, update);
          },
        },
      };

      const result = await executePlanV1(plan, plan.organization!, executionOptions);

      // Acknowledge the job
      await this.queueConsumer.acknowledge(jobId);

      console.log(
        `Plan execution ${result.success ? "succeeded" : "failed"}: ${plan.name} (${plan.id}) in ${result.totalDuration_ms}ms`,
      );
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      // Try to update JobRun to failed via hub API (in case executor didn't complete)
      try {
        await this.runsApi.runsIdPatch(data.jobRunId, {
          status: "failed",
          completedAt: utcNow(),
          errors: [error instanceof Error ? error.message : String(error)],
        });
      } catch (updateError) {
        console.error("Failed to update JobRun:", updateError);
      }

      // Fail the job (with retry)
      await this.queueConsumer.fail(
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
