import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

/**
 * Configuration schema for the griffin-agent.
 * Agents consume jobs from queues and report results to the hub.
 */
export const AgentConfigSchema = Type.Object({
  // Agent identification
  agent: Type.Object({
    location: Type.String({
      description: "Location identifier for this agent",
    }),
    metadata: Type.Optional(
      Type.Record(Type.String(), Type.String(), {
        description: "Optional metadata for display/filtering",
      }),
    ),
  }),

  // Hub connection
  hub: Type.Object({
    url: Type.String({ description: "Hub API base URL" }),
    apiKey: Type.Optional(
      Type.String({ description: "Optional API key for authentication" }),
    ),
  }),

  // Queue consumer configuration
  queue: Type.Object({
    backend: Type.Union(
      [Type.Literal("postgres"), Type.Literal("sqs"), Type.Literal("redis")],
      { default: "postgres" },
    ),
    connectionString: Type.Optional(Type.String()),
    queueName: Type.String({ default: "plan-executions" }),
    pollInterval: Type.Number({
      default: 1000,
      minimum: 100,
      description: "Initial poll interval in ms",
    }),
    maxPollInterval: Type.Number({
      default: 30000,
      minimum: 1000,
      description: "Maximum poll interval in ms (with backoff)",
    }),
  }),

  // Heartbeat configuration
  heartbeat: Type.Object({
    enabled: Type.Boolean({ default: true }),
    interval: Type.Number({
      default: 30,
      minimum: 1,
      description: "Heartbeat interval in seconds",
    }),
  }),

  // Plan execution configuration
  planExecution: Type.Object({
    timeout: Type.Number({
      default: 30000,
      minimum: 0,
      description: "Request timeout in ms",
    }),
  }),

  // Secret provider configuration
  secrets: Type.Object({
    // Comma-separated list of enabled providers (e.g., "env,aws,vault")
    providers: Type.Array(Type.String(), { default: ["env"] }),

    // Environment provider config (always available)
    env: Type.Object({
      prefix: Type.Optional(Type.String()),
    }),

    // AWS Secrets Manager config
    aws: Type.Optional(
      Type.Object({
        region: Type.String(),
        prefix: Type.Optional(Type.String()),
      }),
    ),

    // HashiCorp Vault config
    vault: Type.Optional(
      Type.Object({
        address: Type.String(),
        token: Type.Optional(Type.String()),
        namespace: Type.Optional(Type.String()),
        kvVersion: Type.Optional(
          Type.Union([Type.Literal(1), Type.Literal(2)]),
        ),
        prefix: Type.Optional(Type.String()),
      }),
    ),
  }),
});

export type AgentConfig = Static<typeof AgentConfigSchema>;

/**
 * Parse a boolean from an environment variable string.
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
 */
function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load agent configuration from environment variables.
 */
export function loadAgentConfigFromEnv(): AgentConfig {
  // Agent identification
  const location = process.env.AGENT_LOCATION;
  if (!location) {
    throw new Error("AGENT_LOCATION is required");
  }

  // Parse metadata (JSON object or empty)
  let metadata: Record<string, string> | undefined;
  if (process.env.AGENT_METADATA) {
    try {
      metadata = JSON.parse(process.env.AGENT_METADATA);
    } catch (error) {
      throw new Error(`Invalid AGENT_METADATA JSON: ${error}`);
    }
  }

  // Hub connection
  const hubUrl = process.env.HUB_URL;
  if (!hubUrl) {
    throw new Error("HUB_URL is required");
  }

  // Queue backend
  const queueBackend = (process.env.QUEUE_BACKEND || "postgres") as
    | "postgres"
    | "sqs"
    | "redis";

  // Validate queue backend
  if (!["postgres", "sqs", "redis"].includes(queueBackend)) {
    throw new Error(
      `Invalid QUEUE_BACKEND: ${queueBackend}. Must be one of: postgres, sqs, redis`,
    );
  }

  // Determine queue connection string
  let queueConnectionString: string | undefined;
  if (queueBackend === "postgres") {
    queueConnectionString =
      process.env.QUEUE_CONNECTION_STRING || process.env.POSTGRESQL_URL;
    if (!queueConnectionString) {
      throw new Error(
        "QUEUE_CONNECTION_STRING or POSTGRESQL_URL is required when QUEUE_BACKEND=postgres",
      );
    }
  } else if (queueBackend === "sqs") {
    queueConnectionString = process.env.QUEUE_CONNECTION_STRING;
    // SQS queue URL is required
    if (!queueConnectionString) {
      throw new Error(
        "QUEUE_CONNECTION_STRING (SQS queue URL) is required when QUEUE_BACKEND=sqs",
      );
    }
  } else if (queueBackend === "redis") {
    queueConnectionString =
      process.env.QUEUE_CONNECTION_STRING || process.env.REDIS_URL;
    if (!queueConnectionString) {
      throw new Error(
        "QUEUE_CONNECTION_STRING or REDIS_URL is required when QUEUE_BACKEND=redis",
      );
    }
  }

  // Parse secret providers configuration
  const secretProviders = process.env.SECRET_PROVIDERS
    ? process.env.SECRET_PROVIDERS.split(",").map((p) => p.trim().toLowerCase())
    : ["env"];

  // AWS config (only if "aws" is in providers)
  const awsConfig = secretProviders.includes("aws")
    ? {
        region:
          process.env.AWS_SECRETS_REGION ||
          process.env.AWS_REGION ||
          "us-east-1",
        ...(process.env.AWS_SECRETS_PREFIX && {
          prefix: process.env.AWS_SECRETS_PREFIX,
        }),
      }
    : undefined;

  // Vault config (only if "vault" is in providers)
  const vaultConfig = secretProviders.includes("vault")
    ? {
        address: process.env.VAULT_ADDR || "",
        ...(process.env.VAULT_TOKEN && { token: process.env.VAULT_TOKEN }),
        ...(process.env.VAULT_NAMESPACE && {
          namespace: process.env.VAULT_NAMESPACE,
        }),
        ...(process.env.VAULT_KV_VERSION && {
          kvVersion: (process.env.VAULT_KV_VERSION === "1" ? 1 : 2) as 1 | 2,
        }),
        ...(process.env.VAULT_PREFIX && { prefix: process.env.VAULT_PREFIX }),
      }
    : undefined;

  // Validate required config for enabled providers
  if (secretProviders.includes("vault") && !vaultConfig?.address) {
    throw new Error(
      "VAULT_ADDR is required when vault secret provider is enabled",
    );
  }

  const config: AgentConfig = {
    agent: {
      location,
      ...(metadata && { metadata }),
    },
    hub: {
      url: hubUrl,
      ...(process.env.HUB_API_KEY && { apiKey: process.env.HUB_API_KEY }),
    },
    queue: {
      backend: queueBackend,
      ...(queueConnectionString && { connectionString: queueConnectionString }),
      queueName: process.env.QUEUE_NAME || "plan-executions",
      pollInterval: parseInteger(process.env.QUEUE_POLL_INTERVAL, 1000),
      maxPollInterval: parseInteger(process.env.QUEUE_MAX_POLL_INTERVAL, 30000),
    },
    heartbeat: {
      enabled: parseBoolean(process.env.HEARTBEAT_ENABLED, true),
      interval: parseInteger(process.env.HEARTBEAT_INTERVAL_SECONDS, 30),
    },
    planExecution: {
      timeout: parseInteger(process.env.PLAN_EXECUTION_TIMEOUT, 30000),
    },
    secrets: {
      providers: secretProviders,
      env: {
        ...(process.env.SECRET_ENV_PREFIX && {
          prefix: process.env.SECRET_ENV_PREFIX,
        }),
      },
      ...(awsConfig && { aws: awsConfig }),
      ...(vaultConfig && { vault: vaultConfig }),
    },
  };

  // Validate the config against the schema
  if (!Value.Check(AgentConfigSchema, config)) {
    const errors = [...Value.Errors(AgentConfigSchema, config)];
    throw new Error(
      `Invalid configuration: ${errors.map((e) => e.message).join(", ")}`,
    );
  }

  return config;
}
