import {
  RepositoryBackend,
  JobQueueBackend,
  Repository,
  JobQueue,
} from "../../ports.js";
import { MemoryRepository } from "./repository.js";
import { MemoryJobQueue } from "./job-queue.js";

/**
 * In-memory repository backend.
 * All data is stored in memory and lost when the process exits.
 * Perfect for testing and development.
 */
export class MemoryRepositoryBackend implements RepositoryBackend {
  private repositories: Map<string, MemoryRepository<any>> = new Map();

  repository<T extends { id: string }>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(collection, new MemoryRepository<T>());
    }
    return this.repositories.get(collection)!;
  }

  async connect(): Promise<void> {
    // No-op for memory storage
  }

  async disconnect(): Promise<void> {
    // No-op for memory storage
  }

  async transaction<R>(fn: (tx: RepositoryBackend) => Promise<R>): Promise<R> {
    // For memory storage, we don't have real transactions
    // Just execute the function directly
    // In a real implementation, you'd clone the data and rollback on error
    return fn(this);
  }

  async execute<T = unknown>(
    query: string | Function,
    params?: unknown[],
  ): Promise<T[]> {
    if (typeof query !== "function") {
      throw new Error(
        "Memory backend execute() requires a function, not a string query",
      );
    }

    // Pass all repositories to the query function for complex queries
    const collections = new Map<string, any[]>();
    for (const [name, repo] of this.repositories.entries()) {
      collections.set(name, (repo as any).getAll());
    }

    return query(collections, params);
  }

  /**
   * Clear all data (useful for testing).
   */
  clear(): void {
    for (const repo of this.repositories.values()) {
      repo.clear();
    }
  }
}

/**
 * In-memory job queue backend.
 * All jobs are stored in memory and lost when the process exits.
 * Perfect for testing and development.
 */
export class MemoryJobQueueBackend implements JobQueueBackend {
  private queues: Map<string, MemoryJobQueue<any>> = new Map();

  queue<T = any>(name: string = "default"): JobQueue<T> {
    if (!this.queues.has(name)) {
      this.queues.set(name, new MemoryJobQueue<T>());
    }
    return this.queues.get(name)!;
  }

  async connect(): Promise<void> {
    // No-op for memory storage
  }

  async disconnect(): Promise<void> {
    // No-op for memory storage
  }

  /**
   * Clear all queues (useful for testing).
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }
}
