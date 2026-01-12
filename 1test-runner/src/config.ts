import { Type, Static } from "typebox";
import { Value } from "typebox/value";

/**
 * Configuration schema for the 1test-runner application.
 * All environment variables are centralized here with their defaults.
 */
export const ConfigSchema = Type.Object({
  // Repository configuration
  repository: Type.Object({
    backend: Type.Union(
      [
        Type.Literal("memory"),
        Type.Literal("sqlite"),
        Type.Literal("postgres"),
      ],
      { default: "memory" },
    ),
    connectionString: Type.Optional(Type.String()),
  }),

  // Job queue configuration
  jobQueue: Type.Object({
    backend: Type.Union([Type.Literal("memory"), Type.Literal("postgres")], {
      default: "memory",
    }),
    connectionString: Type.Optional(Type.String()),
  }),

  // Scheduler configuration
  scheduler: Type.Object({
    enabled: Type.Boolean({ default: true }),
    tickInterval: Type.Number({ default: 30000, minimum: 100 }),
  }),

  // Worker configuration
  worker: Type.Object({
    enabled: Type.Boolean({ default: true }),
    emptyDelay: Type.Number({ default: 1000, minimum: 0 }),
    maxEmptyDelay: Type.Number({ default: 30000, minimum: 0 }),
  }),

  // Plan execution configuration
  planExecution: Type.Object({
    baseUrl: Type.Optional(Type.String()),
    timeout: Type.Number({ default: 30000, minimum: 0 }),
  }),
});

export type Config = Static<typeof ConfigSchema>;

/**
 * Parse a boolean from an environment variable string.
 * Returns true for: 'true', '1', 'yes', 'on' (case insensitive)
 * Returns false for: 'false', '0', 'no', 'off' (case insensitive)
 * Returns the default value for undefined/empty
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase().trim();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

/**
 * Parse an integer from an environment variable string.
 * Returns the default value if the variable is undefined or cannot be parsed.
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load configuration from environment variables.
 * Throws an error if required environment variables are missing.
 */
export function loadConfigFromEnv(): Config {
  const repositoryBackend = (process.env.REPOSITORY_BACKEND || "memory") as
    | "memory"
    | "sqlite"
    | "postgres";

  // Determine repository connection string
  let repositoryConnectionString: string | undefined;
  if (repositoryBackend === "sqlite") {
    repositoryConnectionString =
      process.env.REPOSITORY_CONNECTION_STRING ||
      process.env.SQLITE_PATH ||
      ":memory:";
  } else if (repositoryBackend === "postgres") {
    repositoryConnectionString =
      process.env.REPOSITORY_CONNECTION_STRING || process.env.POSTGRESQL_URL;
    if (!repositoryConnectionString) {
      throw new Error(
        "REPOSITORY_CONNECTION_STRING or POSTGRESQL_URL is required when REPOSITORY_BACKEND=postgres",
      );
    }
  }

  const jobQueueBackend = (process.env.JOBQUEUE_BACKEND || "memory") as
    | "memory"
    | "postgres";

  // Validate job queue backend
  if (process.env.JOBQUEUE_BACKEND === "sqlite") {
    throw new Error(
      'SQLite is not supported as a job queue backend. Use "memory" or "postgres" instead.',
    );
  }

  // Determine job queue connection string
  let jobQueueConnectionString: string | undefined;
  if (jobQueueBackend === "postgres") {
    jobQueueConnectionString =
      process.env.JOBQUEUE_CONNECTION_STRING || process.env.POSTGRESQL_URL;
    if (!jobQueueConnectionString) {
      throw new Error(
        "JOBQUEUE_CONNECTION_STRING or POSTGRESQL_URL is required when JOBQUEUE_BACKEND=postgres",
      );
    }
  }

  const config: Config = {
    repository: {
      backend: repositoryBackend,
      connectionString: repositoryConnectionString,
    },
    jobQueue: {
      backend: jobQueueBackend,
      connectionString: jobQueueConnectionString,
    },
    scheduler: {
      enabled: parseBoolean(process.env.SCHEDULER_ENABLED, true),
      tickInterval: parseInteger(process.env.SCHEDULER_TICK_INTERVAL, 30000),
    },
    worker: {
      enabled: parseBoolean(process.env.WORKER_ENABLED, true),
      emptyDelay: parseInteger(process.env.WORKER_EMPTY_DELAY, 1000),
      maxEmptyDelay: parseInteger(process.env.WORKER_MAX_EMPTY_DELAY, 30000),
    },
    planExecution: {
      baseUrl: process.env.PLAN_EXECUTION_BASE_URL,
      timeout: parseInteger(process.env.PLAN_EXECUTION_TIMEOUT, 30000),
    },
  };

  // Validate the config against the schema
  if (!Value.Check(ConfigSchema, config)) {
    const errors = [...Value.Errors(ConfigSchema, config)];
    throw new Error(
      `Invalid configuration: ${errors.map((e) => e.message).join(", ")}`,
    );
  }

  return config;
}
