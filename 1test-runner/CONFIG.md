# Configuration

The 1test-runner application uses a centralized configuration system based on environment variables. All configuration is validated at startup using a Typebox schema.

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

## Example Configurations

### Development (In-Memory)

```bash
# Everything uses defaults
# No environment variables needed
```

### Development (SQLite)

```bash
REPOSITORY_BACKEND=sqlite
SQLITE_PATH=./data/1test.db
```

### Production (PostgreSQL)

```bash
REPOSITORY_BACKEND=postgres
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:password@localhost:5432/1test

SCHEDULER_TICK_INTERVAL=60000
WORKER_EMPTY_DELAY=2000
WORKER_MAX_EMPTY_DELAY=60000

PLAN_EXECUTION_BASE_URL=https://api.example.com
PLAN_EXECUTION_TIMEOUT=60000
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
