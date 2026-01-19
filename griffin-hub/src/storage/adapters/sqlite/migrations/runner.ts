import { MigrationRunner } from "../../../ports.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * SQLite migration runner.
 *
 * TODO: Implement migration tracking using a 'migrations' table:
 * CREATE TABLE migrations (
 *   version TEXT PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   applied_at TEXT NOT NULL
 * );
 *
 * The runner should:
 * 1. Scan the migrations/ directory for migration files
 * 2. Check which migrations have been applied
 * 3. Run pending migrations in order
 * 4. Track applied migrations in the table
 *
 * Consider using or learning from: node-pg-migrate, umzug, or knex migrations
 */
export class SqliteMigrationRunner implements MigrationRunner {
  constructor(private db: any) {} // TODO: Type this as Database from better-sqlite3

  async migrate(): Promise<void> {
    throw new Error("SqliteMigrationRunner.migrate not yet implemented");
  }

  async rollback(count?: number): Promise<void> {
    throw new Error("SqliteMigrationRunner.rollback not yet implemented");
  }

  async version(): Promise<string | null> {
    throw new Error("SqliteMigrationRunner.version not yet implemented");
  }

  async applied(): Promise<string[]> {
    throw new Error("SqliteMigrationRunner.applied not yet implemented");
  }
}
