import { randomUUID } from "node:crypto";
import { JobQueue, Job, JobStatus, EnqueueOptions } from "../../ports.js";

/**
 * In-memory implementation of JobQueue.
 * Jobs are stored in memory and processed in order of priority and scheduledFor time.
 */
export class MemoryJobQueue<T = any> implements JobQueue<T> {
  private jobs: Map<string, Job<T>> = new Map();

  async enqueue(data: T, options: EnqueueOptions): Promise<string> {
    const id = randomUUID();
    const job: Job<T> = {
      id,
      data,
      location: options.location,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      priority: options.priority ?? 0,
      scheduledFor: options.runAt ?? new Date(),
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return id;
  }

  async dequeue(location?: string): Promise<Job<T> | null> {
    const now = new Date();

    // Find eligible jobs (PENDING or RETRYING, scheduled for now or earlier)
    const eligible = Array.from(this.jobs.values())
      .filter(
        (job) =>
          (job.status === JobStatus.PENDING ||
            job.status === JobStatus.RETRYING) &&
          job.scheduledFor <= now &&
          (!location || job.location === location),
      )
      .sort((a, b) => {
        // Sort by priority (higher first), then by scheduledFor (earlier first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.scheduledFor.getTime() - b.scheduledFor.getTime();
      });

    if (eligible.length === 0) {
      return null;
    }

    // Mark as running
    const job = eligible[0];
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    job.attempts++;

    return job;
  }

  async acknowledge(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    job.status = JobStatus.COMPLETED;
    job.completedAt = new Date();
  }

  async fail(
    jobId: string,
    error: Error,
    retry: boolean = true,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.error = error.message;

    if (retry && job.attempts < job.maxAttempts) {
      // Retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, job.attempts), 60000);
      job.status = JobStatus.RETRYING;
      job.scheduledFor = new Date(Date.now() + delayMs);
    } else {
      job.status = JobStatus.FAILED;
      job.completedAt = new Date();
    }
  }

  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    return job?.status ?? null;
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) ?? null;
  }

  /**
   * Clear all jobs (useful for testing).
   */
  clear(): void {
    this.jobs.clear();
  }

  /**
   * Get all jobs (useful for testing/debugging).
   */
  getAll(): Job<T>[] {
    return Array.from(this.jobs.values());
  }
}
