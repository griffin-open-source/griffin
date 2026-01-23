import { JobQueue, Job, JobStatus, EnqueueOptions } from "../../ports.js";
import { sql, and, eq, desc } from "drizzle-orm";
import { DrizzleDatabase } from "../../../plugins/storage.js";
import { jobsTable } from "./schema.js";
import { fromUTC } from "../../../utils/dates.js";

/**
 * PostgreSQL implementation of JobQueue.
 *
 * Uses a 'jobs' table with:
 * - SELECT FOR UPDATE SKIP LOCKED for safe concurrent dequeue
 * - Index on (status, scheduledFor, priority) for efficient queries
 * - Support for named queues via 'queue_name' column
 */
export class PostgresJobQueue<T = any> implements JobQueue<T> {
  constructor(
    private db: DrizzleDatabase,
    private queueName: string,
  ) {}

  async enqueue(data: T, options: EnqueueOptions): Promise<string> {
    const now = new Date();
    const scheduledFor = options.runAt || now;
    const priority = options.priority ?? 0;
    const maxAttempts = options.maxAttempts ?? 3;
    const result = await this.db
      .insert(jobsTable)
      .values({
        queueName: this.queueName,
        data: JSON.stringify(data),
        location: options.location,
        status: JobStatus.PENDING,
        attempts: 0,
        maxAttempts: maxAttempts,
        priority: priority,
        scheduledFor: scheduledFor,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return result[0].id;
  }

  async dequeue(location?: string): Promise<Job<T> | null> {
    const now = new Date();
    const subquery = this.db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.queueName, this.queueName),
          eq(jobsTable.status, JobStatus.PENDING),
          location ? eq(jobsTable.location, location) : undefined,
        ),
      )
      .orderBy(desc(jobsTable.priority))
      .limit(1)
      .for("update", { skipLocked: true });

    const result = await this.db
      .update(jobsTable)
      .set({
        status: JobStatus.RUNNING,
        startedAt: now,
        attempts: sql`attempts + 1`,
        updatedAt: now,
      })
      .where(eq(jobsTable.id, sql`(${subquery})`))
      .returning();
    if (result.length === 0) {
      return null;
    }
    const job = result[0];
    return {
      ...job,
      data: job.data as T,
      startedAt: job.startedAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      error: job.error ?? undefined,
    };
  }

  async acknowledge(jobId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(jobsTable)
      .set({
        status: JobStatus.COMPLETED,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(jobsTable.id, jobId));
  }

  async fail(
    jobId: string,
    error: Error,
    retry: boolean = true,
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const shouldRetry = retry && job.attempts < job.maxAttempts;
    const newStatus = shouldRetry ? JobStatus.RETRYING : JobStatus.FAILED;

    //let query: string;
    //let params: unknown[];

    if (shouldRetry) {
      // Calculate exponential backoff: 2^attempts seconds
      const backoffSeconds = Math.pow(2, job.attempts);
      const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);
      const now = new Date();

      await this.db
        .update(jobsTable)
        .set({
          status: newStatus,
          error: error.message,
          scheduledFor: nextRunAt,
          updatedAt: now,
        })
        .where(eq(jobsTable.id, jobId));
    } else {
      const now = new Date();
      await this.db
        .update(jobsTable)
        .set({
          status: newStatus,
          error: error.message,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(jobsTable.id, jobId));
    }
  }

  async getStatus(jobId: string): Promise<JobStatus | null> {
    const result = await this.db.query.jobsTable.findFirst({
      where: eq(jobsTable.id, jobId),
    });
    if (!result) {
      return null;
    }
    return result.status;
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    const result = await this.db.query.jobsTable.findFirst({
      where: eq(jobsTable.id, jobId),
    });
    if (!result) {
      return null;
    }
    return {
      ...result,
      data: result.data as T,
      startedAt: result.startedAt ?? undefined,
      completedAt: result.completedAt ?? undefined,
      error: result.error ?? undefined,
    };
  }
}
