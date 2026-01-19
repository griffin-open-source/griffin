import { RepositoryBackend, Repository } from "../../ports.js";
import { SqliteRepository } from "./repository.js";

/**
 * SQLite repository backend.
 *
 * Note: SQLite is NOT suitable for job queues due to lack of proper row-level
 * locking (SELECT FOR UPDATE SKIP LOCKED). Use Postgres or an in-memory queue instead.
 *
 * TODO: Implement using better-sqlite3 (sync) or sql.js (async)
 *
 * Recommended: better-sqlite3
 * - Much faster than async alternatives
 * - Simpler API (no callback/promise overhead)
 * - Works great for single-node deployments
 * - Enable WAL mode for better concurrency: PRAGMA journal_mode=WAL
 *
 * Connection options to consider:
 * - File path or ':memory:' for in-memory DB
 * - Enable foreign keys: PRAGMA foreign_keys=ON
 * - Set busy timeout for lock handling
 */
export class SqliteRepositoryBackend implements RepositoryBackend {
  private db: any; // TODO: Type this as Database from better-sqlite3
  private repositories: Map<string, SqliteRepository<any>> = new Map();

  constructor(private dbPath: string = ":memory:") {}

  repository<T extends { id: string }>(collection: string): Repository<T> {
    if (!this.repositories.has(collection)) {
      this.repositories.set(
        collection,
        new SqliteRepository<T>(this.db, collection),
      );
    }
    return this.repositories.get(collection)!;
  }

  async connect(): Promise<void> {
    throw new Error("SqliteRepositoryBackend.connect not yet implemented");
    // TODO:
    // const Database = require('better-sqlite3');
    // this.db = new Database(this.dbPath);
    // this.db.pragma('journal_mode = WAL');
    // this.db.pragma('foreign_keys = ON');
  }

  async disconnect(): Promise<void> {
    throw new Error("SqliteRepositoryBackend.disconnect not yet implemented");
    // TODO:
    // if (this.db) {
    //   this.db.close();
    // }
  }

  async transaction<R>(fn: (tx: RepositoryBackend) => Promise<R>): Promise<R> {
    throw new Error("SqliteRepositoryBackend.transaction not yet implemented");
    // TODO: Wrap in BEGIN/COMMIT/ROLLBACK
    // better-sqlite3 has: db.transaction(() => { ... })
  }

  async execute<T = unknown>(
    query: string | Function,
    params?: unknown[],
  ): Promise<T[]> {
    if (typeof query === "function") {
      throw new Error(
        "SQLite backend execute() requires a SQL string, not a function",
      );
    }

    // TODO: When better-sqlite3 db is properly implemented, use it to execute the query
    // const stmt = this.db.prepare(query);
    // return stmt.all(params) as T[];
    throw new Error("SqliteRepositoryBackend.execute not yet implemented");
  }
}
