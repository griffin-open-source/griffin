# Configuration

The griffin-runner application uses a centralized configuration system based on environment variables. All configuration is validated at startup using a Typebox schema.

## Configuration Loading

Configuration is loaded automatically by the `config` plugin during application startup. If any required environment variables are missing or invalid, the application will fail to start with a clear error message.

## Accessing Configuration

In any Fastify plugin or route handler, you can access the configuration via:

```typescript
fastify.config.repository.backend;
fastify.config.scheduler.tickInterval;
// etc.
```

## Environment Variables

### Repository Configuration

| Variable                       | Type                               | Default    | Description                                                  |
| ------------------------------ | ---------------------------------- | ---------- | ------------------------------------------------------------ |
| `REPOSITORY_BACKEND`           | `memory` \| `sqlite` \| `postgres` | `memory`   | Storage backend for test runs and jobs                       |
| `REPOSITORY_CONNECTION_STRING` | string                             | -          | Connection string for the repository backend                 |
| `SQLITE_PATH`                  | string                             | `:memory:` | Alias for `REPOSITORY_CONNECTION_STRING` when using SQLite   |
| `POSTGRESQL_URL`               | string                             | -          | Alias for `REPOSITORY_CONNECTION_STRING` when using Postgres |

**Notes:**

- When `REPOSITORY_BACKEND=postgres`, either `REPOSITORY_CONNECTION_STRING` or `POSTGRESQL_URL` must be set
- When `REPOSITORY_BACKEND=sqlite`, defaults to `:memory:` if no connection string is provided

### Job Queue Configuration

| Variable                     | Type                   | Default  | Description                                                |
| ---------------------------- | ---------------------- | -------- | ---------------------------------------------------------- |
| `JOBQUEUE_BACKEND`           | `memory` \| `postgres` | `memory` | Backend for the job queue                                  |
| `JOBQUEUE_CONNECTION_STRING` | string                 | -        | Connection string for the job queue backend                |
| `POSTGRESQL_URL`             | string                 | -        | Alias for `JOBQUEUE_CONNECTION_STRING` when using Postgres |

**Notes:**

- SQLite is **not supported** as a job queue backend
- When `JOBQUEUE_BACKEND=postgres`, either `JOBQUEUE_CONNECTION_STRING` or `POSTGRESQL_URL` must be set

### Scheduler Configuration

| Variable                  | Type    | Default | Description                                         |
| ------------------------- | ------- | ------- | --------------------------------------------------- |
| `SCHEDULER_ENABLED`       | boolean | `true`  | Enable/disable the scheduler service on startup     |
| `SCHEDULER_TICK_INTERVAL` | number  | `30000` | Milliseconds between scheduler ticks (minimum: 100) |

**Boolean values:** `true`, `1`, `yes`, `on` (case-insensitive) = true; `false`, `0`, `no`, `off` = false

### Worker Configuration

| Variable                 | Type    | Default | Description                                           |
| ------------------------ | ------- | ------- | ----------------------------------------------------- |
| `WORKER_ENABLED`         | boolean | `true`  | Enable/disable the worker service on startup          |
| `WORKER_EMPTY_DELAY`     | number  | `1000`  | Initial delay in milliseconds when job queue is empty |
| `WORKER_MAX_EMPTY_DELAY` | number  | `30000` | Maximum delay in milliseconds when job queue is empty |

### Plan Execution Configuration

| Variable                  | Type   | Default | Description                                         |
| ------------------------- | ------ | ------- | --------------------------------------------------- |
| `PLAN_EXECUTION_BASE_URL` | string | -       | Base URL for plan execution (optional)              |
| `PLAN_EXECUTION_TIMEOUT`  | number | `30000` | Timeout in milliseconds for plan execution requests |

### Secrets Configuration

griffin supports multiple secret providers for securely managing API keys, tokens, and other credentials used in test plans. Secrets are referenced in test plans using the `secret()` function and resolved at runtime.

| Variable           | Type   | Default | Description                                                         |
| ------------------ | ------ | ------- | ------------------------------------------------------------------- |
| `SECRET_PROVIDERS` | string | `env`   | Comma-separated list of enabled providers (e.g., `"env,aws,vault"`) |

#### Environment Provider (always available)

The environment provider reads secrets from environment variables.

| Variable            | Type   | Default | Description                                   |
| ------------------- | ------ | ------- | --------------------------------------------- |
| `SECRET_ENV_PREFIX` | string | -       | Optional prefix for all environment variables |

**Example:**

```bash
SECRET_PROVIDERS=env
SECRET_ENV_PREFIX=GRIFFIN_  # Optional: prefix all env var names
```

**Usage in test plans:**

```typescript
secret("env:API_KEY"); // Reads from API_KEY environment variable
secret("env:GRIFFIN_API_KEY"); // Or with prefix: GRIFFIN_API_KEY
```

#### AWS Secrets Manager Provider

The AWS provider retrieves secrets from AWS Secrets Manager. Requires AWS credentials configured via IAM role, environment variables, or AWS credentials file.

| Variable                  | Type   | Default     | Description                                                         |
| ------------------------- | ------ | ----------- | ------------------------------------------------------------------- |
| `AWS_SECRETS_REGION`      | string | `us-east-1` | AWS region for Secrets Manager (falls back to `AWS_REGION`)         |
| `AWS_SECRETS_PREFIX`      | string | -           | Optional prefix for all secret names                                |
| `AWS_SECRETS_ROLE_ARN`    | string | -           | IAM role ARN to assume (for multi-tenant scenarios)                 |
| `AWS_SECRETS_EXTERNAL_ID` | string | -           | External ID for role assumption (optional, for additional security) |

**Prerequisites:**

- `@aws-sdk/client-secrets-manager` package installed
- `@aws-sdk/client-sts` package installed (if using role assumption)
- AWS credentials configured (IAM role, environment variables, or credentials file)

**Example:**

```bash
SECRET_PROVIDERS=env,aws
AWS_SECRETS_REGION=us-east-1
AWS_SECRETS_PREFIX=myapp/  # Optional: prefix all secret names
# Optional: for multi-tenant scenarios
AWS_SECRETS_ROLE_ARN=arn:aws:iam::123456789012:role/griffin-secrets-role
AWS_SECRETS_EXTERNAL_ID=unique-external-id
```

**Usage in test plans:**

```typescript
secret("aws:prod/api-key"); // Retrieves secret named "myapp/prod/api-key" (with prefix)
secret("aws:prod/api-key", { field: "apiKey" }); // Extract field from JSON secret
secret("aws:prod/api-key", { version: "AWSPREVIOUS" }); // Pin to specific version
```

#### HashiCorp Vault Provider

The Vault provider retrieves secrets from HashiCorp Vault using the KV secrets engine.

| Variable           | Type       | Default | Description                                                                  |
| ------------------ | ---------- | ------- | ---------------------------------------------------------------------------- |
| `VAULT_ADDR`       | string     | -       | **Required** - Vault server address (e.g., `https://vault.example.com:8200`) |
| `VAULT_TOKEN`      | string     | -       | Vault authentication token                                                   |
| `VAULT_NAMESPACE`  | string     | -       | Vault Enterprise namespace (optional)                                        |
| `VAULT_KV_VERSION` | `1` \| `2` | `2`     | KV secrets engine version                                                    |
| `VAULT_PREFIX`     | string     | -       | Optional prefix for all secret paths                                         |

**Example:**

```bash
SECRET_PROVIDERS=env,vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=hvs.xxxxxxxxxxxxx
VAULT_NAMESPACE=myteam  # Optional: for Vault Enterprise
VAULT_KV_VERSION=2  # Optional: defaults to 2
VAULT_PREFIX=griffin/  # Optional: prefix all secret paths
```

**Usage in test plans:**

```typescript
secret("vault:secret/data/api"); // KV v2 path
secret("vault:secret/data/api", { field: "apiKey" }); // Extract field from secret data
secret("vault:secret/data/api", { version: "2" }); // Pin to specific version
```

**Note:** The Vault provider validates the connection at startup. If validation fails, the runner will not start.

### Authentication Configuration

griffin-runner supports three authentication modes to protect API endpoints:

| Variable             | Type                          | Default | Description                                                        |
| -------------------- | ----------------------------- | ------- | ------------------------------------------------------------------ |
| `AUTH_MODE`          | `none` \| `api-key` \| `oidc` | `none`  | Authentication mode                                                |
| `AUTH_API_KEYS`      | string                        | -       | Comma-separated list of valid API keys (api-key mode)              |
| `AUTH_OIDC_ISSUER`   | string                        | -       | OIDC issuer URL with /.well-known/openid-configuration (oidc mode) |
| `AUTH_OIDC_AUDIENCE` | string                        | -       | Expected JWT audience claim (oidc mode, optional)                  |

#### Authentication Modes

**`none` (default)** - No authentication required. Suitable for:

- Local development
- Trusted internal networks
- Environments with network-level security

**`api-key`** - Static API key validation via Bearer token. Suitable for:

- Self-hosted deployments
- Simple authentication needs
- Internal tools and automation

**Example:**

```bash
AUTH_MODE=api-key
AUTH_API_KEYS=grfn_sk_abc123,grfn_sk_xyz789
```

**Client usage:**

```bash
curl -H "Authorization: Bearer grfn_sk_abc123" http://localhost:3000/plan/plan
```

**`oidc`** - JWT validation against an OIDC provider. Suitable for:

- Multi-tenant cloud deployments
- Integration with identity providers (Auth0, Keycloak, etc.)
- Role-based access control

**Example:**

```bash
AUTH_MODE=oidc
AUTH_OIDC_ISSUER=https://auth.example.com
AUTH_OIDC_AUDIENCE=griffin-api
```

The runner will fetch public keys from the OIDC provider's JWKS endpoint and validate JWTs. User identity and organization information is extracted from token claims (`sub`, `org_id`, `roles`).

#### Route-Level Auth Configuration

Routes can specify auth requirements using the `config.auth` property:

```typescript
// Requires authentication
fastify.post(
  "/plan",
  {
    schema: CreatePlanEndpoint,
    config: {
      auth: { required: true },
    },
  },
  handler,
);

// Public route (no auth)
fastify.get(
  "/",
  {
    config: {
      auth: { required: false },
    },
  },
  handler,
);

// Role-restricted route (OIDC mode only)
fastify.delete(
  "/plan/:id",
  {
    config: {
      auth: {
        required: true,
        allowedRoles: ["admin", "editor"],
      },
    },
  },
  handler,
);
```

#### Protected Routes

| Route                     | Auth Required | Notes              |
| ------------------------- | ------------- | ------------------ |
| `GET /`                   | No            | Health check       |
| `GET /documentation/*`    | No            | Swagger UI         |
| `POST /plan/plan`         | Yes           | Create/update plan |
| `GET /plan/plan`          | Yes           | List plans         |
| `GET /runs/runs`          | Yes           | List runs          |
| `GET /runs/runs/:id`      | Yes           | Get run details    |
| `POST /runs/plan/:id/run` | Yes           | Trigger execution  |

## Example Configurations

### Development (In-Memory)

```bash
# Everything uses defaults
# No environment variables needed
```

### Development (SQLite)

```bash
REPOSITORY_BACKEND=sqlite
SQLITE_PATH=./data/griffin.db
```

### Production (PostgreSQL with API Key Auth)

```bash
REPOSITORY_BACKEND=postgres
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:password@localhost:5432/griffin

SCHEDULER_TICK_INTERVAL=60000
WORKER_EMPTY_DELAY=2000
WORKER_MAX_EMPTY_DELAY=60000

PLAN_EXECUTION_BASE_URL=https://api.example.com
PLAN_EXECUTION_TIMEOUT=60000

# Authentication
AUTH_MODE=api-key
AUTH_API_KEYS=grfn_sk_prod_key1,grfn_sk_prod_key2

# Secrets configuration
SECRET_PROVIDERS=env,aws
AWS_SECRETS_REGION=us-east-1
AWS_SECRETS_PREFIX=griffin/
```

### Cloud/Multi-Tenant (OIDC Auth)

```bash
REPOSITORY_BACKEND=postgres
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:password@localhost:5432/griffin

# Authentication with OIDC
AUTH_MODE=oidc
AUTH_OIDC_ISSUER=https://auth.griffin.dev
AUTH_OIDC_AUDIENCE=griffin-api

# Secrets configuration
SECRET_PROVIDERS=env,aws
AWS_SECRETS_REGION=us-east-1
```

### Disable Services

```bash
# Disable scheduler (useful for worker-only instances)
SCHEDULER_ENABLED=false

# Disable worker (useful for API-only instances)
WORKER_ENABLED=false
```

## Implementation Details

The configuration system consists of:

1. **`src/config.ts`**: Typebox schema and config loader
2. **`src/plugins/config.ts`**: Fastify plugin that loads and decorates config
3. Plugin dependencies ensure `config` loads before other plugins that need it

### Adding New Configuration

To add new configuration values:

1. Add the field to the `ConfigSchema` in `src/config.ts`
2. Add environment variable parsing logic in `loadConfigFromEnv()`
3. Document the new variable in this file
4. Use the config in your plugin via `fastify.config.yourField`

### Type Safety

All configuration is fully typed. TypeScript will provide autocomplete and type checking when accessing `fastify.config`.
