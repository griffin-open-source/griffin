/**
 * Storage module - exports all storage-related types and functions.
 */

// Core interfaces - New Storage interface
export * from "./repositories.js";

// Legacy interfaces - JobQueue (still used) and old Repository (being phased out)
export type {
  JobQueue,
  JobQueueBackend,
  Job,
  JobStatus,
  EnqueueOptions,
  MigrationRunner,
} from "./ports.js";

// Factory functions
export * from "./factory.js";

export {
  PostgresStorage,
  PostgresJobQueueBackend,
} from "./adapters/postgres/index.js";
