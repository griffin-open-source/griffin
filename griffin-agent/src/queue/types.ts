import type { TestPlanV1 } from "griffin/types";

/**
 * NOTE: This is duplicated from griffin-hub to avoid cross-dependencies.
 * If these types grow significantly, consider creating a shared package.
 */

/**
 * Execution job data that agents consume from the queue.
 * Contains everything needed to execute a plan and report results.
 */
export interface ExecutionJobData {
  type: "execute-plan";
  planId: string;
  jobRunId: string;
  environment: string;
  location: string;
  executionGroupId: string;
  plan: TestPlanV1; // Full plan included for agent self-sufficiency
  scheduledAt: string;
}

/**
 * Job wrapper with metadata.
 */
export interface Job<T = ExecutionJobData> {
  id: string;
  data: T;
  location: string;
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date;
}

/**
 * Queue consumer interface.
 * Agents use this to consume jobs from the queue backend.
 */
export interface QueueConsumer<T = ExecutionJobData> {
  /**
   * Poll for the next available job for this agent's location.
   * Returns null if no jobs are available.
   * Automatically marks the job as in-progress.
   */
  poll(location: string): Promise<Job<T> | null>;

  /**
   * Acknowledge successful completion of a job.
   */
  acknowledge(jobId: string): Promise<void>;

  /**
   * Mark a job as failed.
   * If retry is true and attempts < maxAttempts, the job will be retried.
   */
  fail(jobId: string, error: Error, retry?: boolean): Promise<void>;

  /**
   * Connect to the queue backend.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the queue backend.
   */
  disconnect(): Promise<void>;
}
