# griffin Runner

The griffin Runner is the orchestration service responsible for scheduling and executing API tests. It ensures tests run according to their configured frequencies (e.g., every 15 minutes, every minute).

## Features

- Schedules tests based on frequency configuration
- Executes test plans using the plan executor
- Stores execution results and logs in PostgreSQL (or SQLite for development)
- Provides REST API for CLI interactions
- Supports multiple secret providers (env, AWS Secrets Manager, HashiCorp Vault)

## Prerequisites

- Node.js 20+
- PostgreSQL (optional, for production storage)
- AWS credentials (if using AWS Secrets Manager)
- Vault access (if using HashiCorp Vault)

## Installation

```bash
npm install
npm run build
```

## Configuration

The runner uses environment variables for configuration. See [CONFIG.md](./CONFIG.md) for complete configuration documentation.

### Quick Start Configuration

For local development with in-memory storage:

```bash
# No configuration needed - uses defaults
npm run dev
```

For production with PostgreSQL and secrets:

```bash
REPOSITORY_BACKEND=postgres
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:password@localhost:5432/griffin

SECRET_PROVIDERS=env,aws
AWS_SECRETS_REGION=us-east-1
AWS_SECRETS_PREFIX=griffin/

npm start
```

## Available Scripts

### `npm run dev`

Start the app in development mode with hot reloading.
Open [http://localhost:3000](http://localhost:3000) to view the API.

### `npm start`

Start the app in production mode.

### `npm run test`

Run the test suite.

## Secrets Management

The runner supports secure secret management for API keys, tokens, and other credentials used in test plans. Secrets are resolved at runtime before test execution.

**Supported Providers:**

- **Environment Variables** (always available)
- **AWS Secrets Manager** (requires AWS credentials)
- **HashiCorp Vault** (requires Vault configuration)

See [CONFIG.md](./CONFIG.md) for detailed secrets configuration.

## API

The runner provides a REST API for:

- Submitting test plans for execution
- Viewing execution results and logs
- Managing scheduled jobs

API documentation is available at `/swagger` when the server is running.

## Learn More

- [Configuration Guide](./CONFIG.md)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
