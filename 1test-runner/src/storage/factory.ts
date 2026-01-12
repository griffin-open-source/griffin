import {
  RepositoryBackend,
  JobQueueBackend,
  MigrationRunner,
} from "./ports.js";
import {
  MemoryRepositoryBackend,
  MemoryJobQueueBackend,
} from "./adapters/memory/index.js";
import { SqliteRepositoryBackend } from "./adapters/sqlite/index.js";
import {
  PostgresRepositoryBackend,
  PostgresJobQueueBackend,
} from "./adapters/postgres/index.js";
// TODO: Uncomment when implementing migration runners
// import { SqliteMigrationRunner } from './adapters/sqlite/migrations/runner.js';
// import { PostgresMigrationRunner } from './adapters/postgres/migrations/runner.js';

// =============================================================================
// Backend types and configs
// =============================================================================

export type RepositoryBackendType = "memory" | "sqlite" | "postgres";
export type JobQueueBackendType = "memory" | "postgres"; // Note: SQLite omitted intentionally

export interface RepositoryConfig {
  backend: RepositoryBackendType;

  /**
   * For SQLite: file path or ':memory:'
   * For Postgres: connection string
   */
  connectionString?: string;
}

export interface JobQueueConfig {
  backend: JobQueueBackendType;

  /**
   * For Postgres: connection string
   */
  connectionString?: string;
}

// =============================================================================
// Factory functions
// =============================================================================

/**
 * Create a repository backend based on configuration.
 */
export function createRepositoryBackend(
  config: RepositoryConfig,
): RepositoryBackend {
  switch (config.backend) {
    case "memory":
      return new MemoryRepositoryBackend();

    case "sqlite":
      return new SqliteRepositoryBackend(config.connectionString || ":memory:");

    case "postgres":
      if (!config.connectionString) {
        throw new Error("Connection string required for Postgres backend");
      }
      return new PostgresRepositoryBackend(config.connectionString);

    default:
      throw new Error(`Unknown repository backend: ${config.backend}`);
  }
}

/**
 * Create a job queue backend based on configuration.
 */
export function createJobQueueBackend(config: JobQueueConfig): JobQueueBackend {
  switch (config.backend) {
    case "memory":
      return new MemoryJobQueueBackend();

    case "postgres":
      if (!config.connectionString) {
        throw new Error("Connection string required for Postgres backend");
      }
      return new PostgresJobQueueBackend(config.connectionString);

    default:
      throw new Error(`Unknown job queue backend: ${config.backend}`);
  }
}

/**
 * Create a migration runner for a repository backend.
 * Returns null for in-memory storage (no migrations needed).
 */
export function createMigrationRunner(
  backend: RepositoryBackend,
  backendType: RepositoryBackendType,
): MigrationRunner | null {
  switch (backendType) {
    case "memory":
      return null; // No migrations needed for in-memory storage

    case "sqlite":
      // TODO: Extract db from SqliteRepositoryBackend
      throw new Error("SQLite migration runner not yet implemented");
    // return new SqliteMigrationRunner(db);

    case "postgres":
      // TODO: Extract pool from PostgresRepositoryBackend
      throw new Error("Postgres migration runner not yet implemented");
    // return new PostgresMigrationRunner(pool);

    default:
      throw new Error(`Unknown repository backend: ${backendType}`);
  }
}

// =============================================================================
// Config loaders
// =============================================================================

/**
 * Load repository configuration from environment variables.
 *
 * Environment variables:
 * - REPOSITORY_BACKEND: 'memory' | 'sqlite' | 'postgres' (default: 'memory')
 * - REPOSITORY_CONNECTION_STRING: connection string for the backend
 * - SQLITE_PATH: (alias for REPOSITORY_CONNECTION_STRING when using SQLite)
 * - POSTGRESQL_URL: (alias for REPOSITORY_CONNECTION_STRING when using Postgres)
 */
export function loadRepositoryConfig(): RepositoryConfig {
  const backend = (process.env.REPOSITORY_BACKEND ||
    "memory") as RepositoryBackendType;

  let connectionString: string | undefined;

  if (backend === "sqlite") {
    connectionString =
      process.env.REPOSITORY_CONNECTION_STRING ||
      process.env.SQLITE_PATH ||
      ":memory:";
  } else if (backend === "postgres") {
    connectionString =
      process.env.REPOSITORY_CONNECTION_STRING || process.env.POSTGRESQL_URL;
    if (!connectionString) {
      throw new Error(
        "REPOSITORY_CONNECTION_STRING or POSTGRESQL_URL environment variable required for Postgres backend",
      );
    }
  }

  return { backend, connectionString };
}

/**
 * Load job queue configuration from environment variables.
 *
 * Environment variables:
 * - JOBQUEUE_BACKEND: 'memory' | 'postgres' (default: 'memory')
 * - JOBQUEUE_CONNECTION_STRING: connection string for the backend
 * - POSTGRESQL_URL: (alias for JOBQUEUE_CONNECTION_STRING when using Postgres)
 */
export function loadJobQueueConfig(): JobQueueConfig {
  const backendRaw = process.env.JOBQUEUE_BACKEND || "memory";

  // Validate that it's a valid job queue backend (no sqlite)
  if (backendRaw === "sqlite") {
    throw new Error(
      'SQLite is not supported as a job queue backend. Use "memory" or "postgres" instead.',
    );
  }

  const backend = backendRaw as JobQueueBackendType;

  let connectionString: string | undefined;

  if (backend === "postgres") {
    connectionString =
      process.env.JOBQUEUE_CONNECTION_STRING || process.env.POSTGRESQL_URL;
    if (!connectionString) {
      throw new Error(
        "JOBQUEUE_CONNECTION_STRING or POSTGRESQL_URL environment variable required for Postgres backend",
      );
    }
  }

  return { backend, connectionString };
}
