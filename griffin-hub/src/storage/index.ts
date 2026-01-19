/**
 * Storage module - exports all storage-related types and functions.
 */

// Core interfaces
export * from "./ports.js";

// Factory functions
export * from "./factory.js";

// Adapters (if you need to import them directly for testing)
export {
  MemoryRepositoryBackend,
  MemoryJobQueueBackend,
} from "./adapters/memory/index.js";

export { SqliteRepositoryBackend } from "./adapters/sqlite/index.js";

export {
  PostgresRepositoryBackend,
  PostgresJobQueueBackend,
} from "./adapters/postgres/index.js";
