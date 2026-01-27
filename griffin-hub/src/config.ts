import { Type, Static } from "typebox";
import { Value } from "typebox/value";

/**
 * Configuration schema for the griffin-runner application.
 * All environment variables are centralized here with their defaults.
 */
export const ConfigSchema = Type.Object({
  // Repository configuration
  repository: Type.Object({
    backend: Type.Union([Type.Literal("postgres")]),
    connectionString: Type.Optional(Type.String()),
  }),

  // Job queue configuration
  jobQueue: Type.Union([
    Type.Object({
      backend: Type.Literal("postgres"),
      connectionString: Type.String(),
    }),
    Type.Object({
      backend: Type.Literal("sqs"),
      queueInfo: Type.Array(
        Type.Object({
          region: Type.String(),
          url: Type.String(),
        }),
      ),
    }),
  ]),

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

  // Agent configuration
  agent: Type.Object({
    monitoringEnabled: Type.Boolean({ default: true }),
    monitoringInterval: Type.Number({ default: 30, minimum: 1 }),
    heartbeatTimeout: Type.Number({ default: 60, minimum: 1 }),
  }),

  // Plan execution configuration
  planExecution: Type.Object({
    baseUrl: Type.Optional(Type.String()),
    timeout: Type.Number({ default: 30000, minimum: 0 }),
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
        // For multi-tenant: roleArn to assume
        roleArn: Type.Optional(Type.String()),
        externalId: Type.Optional(Type.String()),
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

  // Auth configuration
  auth: Type.Object({
    mode: Type.Union([Type.Literal("api-key"), Type.Literal("oidc")], {
      default: "api-key",
    }),

    // API key mode config
    apiKeys: Type.Optional(Type.Array(Type.String())),

    // OIDC mode config
    oidc: Type.Optional(
      Type.Object({
        issuer: Type.String(),
        audience: Type.Optional(Type.String()),
      }),
    ),
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
  const repositoryBackend = process.env.REPOSITORY_BACKEND as "postgres";

  // Determine repository connection string
  let repositoryConnectionString = process.env.DATABASE_URL;
  if (!repositoryConnectionString) {
    throw new Error("DATABASE_URL is required");
  }

  // Parse job queue configuration
  const jobQueueBackend = (process.env.JOBQUEUE_BACKEND || "postgres") as
    | "postgres"
    | "sqs";

  let jobQueueConfig: Config["jobQueue"];

  if (jobQueueBackend === "postgres") {
    const jobQueueConnectionString = process.env.DATABASE_URL;
    if (!jobQueueConnectionString) {
      throw new Error(
        "JOBQUEUE_CONNECTION_STRING or DATABASE_URL is required for postgres job queue backend",
      );
    }
    jobQueueConfig = {
      backend: "postgres",
      connectionString: jobQueueConnectionString,
    };
  } else if (jobQueueBackend === "sqs") {
    // Parse SQS queue configuration from environment
    // Format: JOBQUEUE_SQS_QUEUES=region1:url1,region2:url2
    const sqsQueuesEnv = process.env.JOBQUEUE_SQS_QUEUES;
    if (!sqsQueuesEnv) {
      throw new Error(
        "JOBQUEUE_SQS_QUEUES is required for sqs job queue backend. Format: region1:url1,region2:url2",
      );
    }

    const queueInfo = sqsQueuesEnv.split(",").map((entry) => {
      const [region, url] = entry.split(":");
      if (!region || !url) {
        throw new Error(
          `Invalid SQS queue configuration: ${entry}. Expected format: region:url`,
        );
      }
      return { region: region.trim(), url: url.trim() };
    });

    jobQueueConfig = {
      backend: "sqs",
      queueInfo,
    };
  } else {
    throw new Error(
      `Invalid JOBQUEUE_BACKEND: ${jobQueueBackend}. Must be one of: postgres, sqs`,
    );
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
        prefix: process.env.AWS_SECRETS_PREFIX,
        roleArn: process.env.AWS_SECRETS_ROLE_ARN,
        externalId: process.env.AWS_SECRETS_EXTERNAL_ID,
      }
    : undefined;

  // Vault config (only if "vault" is in providers)
  const vaultConfig = secretProviders.includes("vault")
    ? {
        address: process.env.VAULT_ADDR || "",
        token: process.env.VAULT_TOKEN,
        namespace: process.env.VAULT_NAMESPACE,
        kvVersion: (process.env.VAULT_KV_VERSION === "1" ? 1 : 2) as 1 | 2,
        prefix: process.env.VAULT_PREFIX,
      }
    : undefined;

  // Validate required config for enabled providers
  if (secretProviders.includes("vault") && !vaultConfig?.address) {
    throw new Error(
      "VAULT_ADDR is required when vault secret provider is enabled",
    );
  }

  // Parse auth configuration
  const authMode = process.env.AUTH_MODE as "api-key" | "oidc";

  // Validate auth mode
  if (!["api-key", "oidc"].includes(authMode)) {
    throw new Error(
      `Invalid AUTH_MODE: ${authMode}. Must be one of: api-key, oidc`,
    );
  }

  // Parse API keys (only if "api-key" mode)
  const apiKeys =
    authMode === "api-key" && process.env.AUTH_API_KEYS
      ? process.env.AUTH_API_KEYS.split(",").map((k) => k.trim())
      : undefined;

  // Validate API keys if in api-key mode
  if (authMode === "api-key" && (!apiKeys || apiKeys.length === 0)) {
    throw new Error("AUTH_API_KEYS is required when AUTH_MODE=api-key");
  }

  // Parse OIDC config (only if "oidc" mode)
  const oidcConfig =
    authMode === "oidc"
      ? {
          issuer: process.env.AUTH_OIDC_ISSUER || "",
          audience: process.env.AUTH_OIDC_AUDIENCE,
        }
      : undefined;

  // Validate OIDC config if in oidc mode
  if (authMode === "oidc" && !oidcConfig?.issuer) {
    throw new Error("AUTH_OIDC_ISSUER is required when AUTH_MODE=oidc");
  }

  const config: Config = {
    repository: {
      backend: repositoryBackend,
      connectionString: repositoryConnectionString,
    },
    jobQueue: jobQueueConfig,
    scheduler: {
      enabled: parseBoolean(process.env.SCHEDULER_ENABLED, true),
      tickInterval: parseInteger(process.env.SCHEDULER_TICK_INTERVAL, 30000),
    },
    worker: {
      enabled: parseBoolean(process.env.WORKER_ENABLED, true),
      emptyDelay: parseInteger(process.env.WORKER_EMPTY_DELAY, 1000),
      maxEmptyDelay: parseInteger(process.env.WORKER_MAX_EMPTY_DELAY, 30000),
    },
    agent: {
      monitoringEnabled: parseBoolean(
        process.env.AGENT_MONITORING_ENABLED,
        true,
      ),
      monitoringInterval: parseInteger(
        process.env.AGENT_MONITORING_INTERVAL_SECONDS,
        30,
      ),
      heartbeatTimeout: parseInteger(
        process.env.AGENT_HEARTBEAT_TIMEOUT_SECONDS,
        60,
      ),
    },
    planExecution: {
      baseUrl: process.env.PLAN_EXECUTION_BASE_URL,
      timeout: parseInteger(process.env.PLAN_EXECUTION_TIMEOUT, 30000),
    },
    secrets: {
      providers: secretProviders,
      env: {
        prefix: process.env.SECRET_ENV_PREFIX,
      },
      aws: awsConfig,
      vault: vaultConfig,
    },
    auth: {
      mode: authMode,
      apiKeys: apiKeys,
      oidc: oidcConfig,
    },
  };

  // Validate the config against the schema
  if (!Value.Check(ConfigSchema, config)) {
    const errors = [...Value.Errors(ConfigSchema, config)];
    console.error(JSON.stringify(errors, null, 2));
    throw new Error(
      `Invalid configuration: ${errors.map((e) => JSON.stringify(e, null, 2)).join("\n")}`,
    );
  }

  return config;
}
