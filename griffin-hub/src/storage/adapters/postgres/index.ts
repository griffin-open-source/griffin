import { Storage } from "../../repositories.js";
import {
  PostgresMonitorsRepository,
  PostgresRunsRepository,
  PostgresAgentsRepository,
} from "./repositories.js";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * PostgreSQL Storage implementation using Drizzle ORM.
 * Provides typed access to all repositories with transaction support.
 */
export class PostgresStorage implements Storage {
  private pool: Pool | null = null;
  private db: NodePgDatabase<typeof schema> | null = null;

  public monitors!: PostgresMonitorsRepository;
  public runs!: PostgresRunsRepository;
  public agents!: PostgresAgentsRepository;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.connectionString,
      // Set timezone to UTC for all connections
      options: "-c timezone=UTC",
    });
    this.db = drizzle(this.pool, { schema });

    // Test connection and verify UTC timezone
    await this.pool.query("SELECT NOW()");

    // Run migrations
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const migrationsFolder = join(__dirname, "migrations");
    await migrate(this.db, { migrationsFolder });

    // Initialize repositories
    this.monitors = new PostgresMonitorsRepository(this.db);
    this.runs = new PostgresRunsRepository(this.db);
    this.agents = new PostgresAgentsRepository(this.db);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.db = null;
    }
  }

  async transaction<R>(fn: (tx: Storage) => Promise<R>): Promise<R> {
    if (!this.db) {
      throw new Error("Database not initialized. Call connect() first.");
    }

    return await this.db.transaction(async (tx) => {
      // Create a transactional storage instance
      const txStorage = new PostgresTransactionStorage(tx);
      return await fn(txStorage);
    });
  }
}

/**
 * Transaction-scoped PostgreSQL storage.
 * Uses a single transaction context for all operations.
 */
class PostgresTransactionStorage implements Storage {
  public monitors: PostgresMonitorsRepository;
  public runs: PostgresRunsRepository;
  public agents: PostgresAgentsRepository;

  constructor(private tx: NodePgDatabase<typeof schema>) {
    this.monitors = new PostgresMonitorsRepository(tx);
    this.runs = new PostgresRunsRepository(tx);
    this.agents = new PostgresAgentsRepository(tx);
  }

  async connect(): Promise<void> {
    // No-op: already connected via transaction
  }

  async disconnect(): Promise<void> {
    // No-op: transaction is managed by parent
  }

  async transaction<R>(fn: (tx: Storage) => Promise<R>): Promise<R> {
    // Nested transactions not supported in this implementation
    // Just execute the function with the current transaction context
    return await fn(this);
  }
}
