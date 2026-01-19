import type { QueueConsumer, Job, ExecutionJobData } from "./types.js";
import pg, { type Pool } from "pg";

/**
 * PostgreSQL queue consumer implementation for agents.
 * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent job consumption.
 */
export class PostgresQueueConsumer implements QueueConsumer {
  private pool: Pool | null = null;

  constructor(
    private connectionString: string,
    private queueName: string = "plan-executions",
  ) {}

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new pg.Pool({
      connectionString: this.connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async poll(location: string): Promise<Job<ExecutionJobData> | null> {
    if (!this.pool) {
      throw new Error("Not connected. Call connect() first.");
    }

    const result = await this.pool.query(
      `
      UPDATE jobs 
      SET 
        status = 'running',
        started_at = NOW(),
        attempts = attempts + 1,
        updated_at = NOW()
      WHERE id = (
        SELECT id 
        FROM jobs 
        WHERE queue_name = $1
          AND location = $2
          AND status = 'pending'
          AND scheduled_for <= NOW()
        ORDER BY priority DESC, scheduled_for ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING 
        id, 
        data, 
        location, 
        attempts, 
        max_attempts as "maxAttempts",
        scheduled_for as "scheduledFor"
      `,
      [this.queueName, location],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      data: row.data,
      location: row.location,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      scheduledFor: new Date(row.scheduledFor),
    };
  }

  async acknowledge(jobId: string): Promise<void> {
    if (!this.pool) {
      throw new Error("Not connected. Call connect() first.");
    }

    await this.pool.query(
      `
      UPDATE jobs 
      SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [jobId],
    );
  }

  async fail(
    jobId: string,
    error: Error,
    retry: boolean = true,
  ): Promise<void> {
    if (!this.pool) {
      throw new Error("Not connected. Call connect() first.");
    }

    // Get the job to check attempts
    const result = await this.pool.query(
      `SELECT attempts, max_attempts as "maxAttempts" FROM jobs WHERE id = $1`,
      [jobId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const { attempts, maxAttempts } = result.rows[0];
    const shouldRetry = retry && attempts < maxAttempts;

    if (shouldRetry) {
      // Exponential backoff: 1 min, 5 min, 15 min, etc.
      const backoffMinutes = Math.min(Math.pow(2, attempts) * 1, 60);
      await this.pool.query(
        `
        UPDATE jobs 
        SET 
          status = 'retrying',
          error = $2,
          scheduled_for = NOW() + INTERVAL '${backoffMinutes} minutes',
          updated_at = NOW()
        WHERE id = $1
        `,
        [jobId, error.message],
      );
    } else {
      // Final failure
      await this.pool.query(
        `
        UPDATE jobs 
        SET 
          status = 'failed',
          error = $2,
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [jobId, error.message],
      );
    }
  }
}
