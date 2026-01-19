import {
  RepositoryBackend,
  JobQueueBackend,
  Repository,
  JobQueue,
} from "../../ports.js";
import { PostgresRepository } from "./repository.js";
import { PostgresJobQueue } from "./job-queue.js";
import { Pool } from "pg";

/**
 * PostgreSQL repository backend.
 *
 * TODO: Implement using 'pg' (node-postgres)
 *
 * Connection options to consider:
 * - Connection string from environment variable
 * - Pool configuration (max connections, idle timeout, etc.)
 * - SSL settings for production
 * - Statement timeout for safety
 *
 * You already have a Pool setup in griffin-runner-old/src/database.ts
 * that can be used as a reference.
 */
export class PostgresRepositoryBackend implements RepositoryBackend {
  private pool: Pool | null = null;
  private repositories: Map<string, PostgresRepository<any>> = new Map();

  constructor(private connectionString: string) {}

  repository<T extends { id: string }>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(
        collection,
        new PostgresRepository<T>(this.pool, collection),
      );
    }
    return this.repositories.get(collection)!;
  }

  async connect(): Promise<void> {
    throw new Error("PostgresRepositoryBackend.connect not yet implemented");
    // TODO:
    // const { Pool } = require('pg');
    // this.pool = new Pool({ connectionString: this.connectionString });
    // await this.pool.query('SELECT NOW()'); // Test connection
  }

  async disconnect(): Promise<void> {
    throw new Error("PostgresRepositoryBackend.disconnect not yet implemented");
    // TODO:
    // if (this.pool) {
    //   await this.pool.end();
    // }
  }

  async transaction<R>(fn: (tx: RepositoryBackend) => Promise<R>): Promise<R> {
    throw new Error(
      "PostgresRepositoryBackend.transaction not yet implemented",
    );
    // TODO: Get a client from pool, BEGIN/COMMIT/ROLLBACK
    // Create a transactional RepositoryBackend that uses the same client
    // Pass it to fn()
  }

  async execute<T = unknown>(
    query: string | Function,
    params?: unknown[],
  ): Promise<T[]> {
    if (typeof query === "function") {
      throw new Error(
        "Postgres backend execute() requires a SQL string, not a function",
      );
    }

    // TODO: When pg pool is properly implemented, use it to execute the query
    // const result = await this.pool.query(query, params);
    // return result.rows as T[];
    throw new Error("PostgresRepositoryBackend.execute not yet implemented");
  }
}

/**
 * PostgreSQL job queue backend.
 * Provides high-performance, durable job queues using Postgres.
 *
 * TODO: Implement using 'pg' (node-postgres)
 *
 * Connection options to consider:
 * - Connection string from environment variable
 * - Pool configuration (max connections, idle timeout, etc.)
 * - SSL settings for production
 * - Statement timeout for safety
 */
export class PostgresJobQueueBackend implements JobQueueBackend {
  private pool: any; // TODO: Type this as Pool from 'pg'
  private queues: Map<string, PostgresJobQueue<any>> = new Map();

  constructor(private connectionString: string) {}

  queue<T = any>(name: string = "default"): JobQueue<T> {
    if (!this.queues.has(name)) {
      this.queues.set(name, new PostgresJobQueue<T>(this.pool, name));
    }
    return this.queues.get(name)!;
  }

  async connect(): Promise<void> {
    throw new Error("PostgresJobQueueBackend.connect not yet implemented");
    // TODO:
    // const { Pool } = require('pg');
    // this.pool = new Pool({ connectionString: this.connectionString });
    // await this.pool.query('SELECT NOW()'); // Test connection
  }

  async disconnect(): Promise<void> {
    throw new Error("PostgresJobQueueBackend.disconnect not yet implemented");
    // TODO:
    // if (this.pool) {
    //   await this.pool.end();
    // }
  }
}
