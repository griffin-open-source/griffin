# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Griffin is an open-source API testing platform for creating TypeScript-based API tests that run against production APIs. It's a monorepo with multiple TypeScript packages following a hub-and-agent architecture.

## Packages

| Package | Purpose |
|---------|---------|
| **griffin-ts** | TypeScript DSL for defining API tests |
| **griffin-executor** | Execution engine for JSON test plans |
| **griffin-cli** | Command-line tool for test management |
| **griffin-hub** | Control plane & REST API service |
| **griffin-hub-sdk** | Auto-generated OpenAPI client for hub |
| **sample-apis** | Sample JSON API for testing |

## Build Commands

The projects must be built in dependency order:

```bash
# Build DSL library (required first)
cd griffin-ts && npm install && npm run build

# Build plan executor (depends on griffin-ts)
cd ../griffin-executor && npm install && npm run build

# Build hub SDK (auto-generated OpenAPI client)
cd ../griffin-hub-sdk && npm install && npm run build

# Build CLI (depends on griffin-ts, executor, hub-sdk)
cd ../griffin-cli && npm install && npm run build

# Build hub (depends on griffin-ts, executor, cli)
cd ../griffin-hub && npm install && npm run build

```

## Running Tests

```bash
# Plan executor tests
cd griffin-executor && npm test           # single run
cd griffin-executor && npm run test:watch # watch mode

# CLI tests
cd griffin-cli && npm test
```

Both projects use Vitest.

## Running the CLI

```bash
# Run tests locally
griffin local run                   # use default environment
griffin local run production        # use production environment

# Environment commands
griffin env list                    # list available environments

# Hub operations
griffin hub connect --url https://hub.example.com --token <token>
griffin hub status
griffin hub login                   # authenticate with OIDC device flow
griffin hub logout                  # clear OIDC credentials
griffin hub plan                    # show planned changes for default environment
griffin hub plan production         # show planned changes for production
griffin hub apply                   # apply changes for default environment
griffin hub apply production --prune # apply and delete removed plans
griffin hub runs --limit 20         # show recent runs
griffin hub run production --plan my-test # trigger run in production

# Other commands
griffin init                        # initialize griffin in directory
griffin validate                    # validate test files
griffin generate-key                # generate API key
```

## Running the Hub Service

```bash
cd griffin-hub

# Control plane only (requires separate agents)
npm run dev      # development with hot reload
npm start        # production mode

# Standalone mode (built-in executor, no separate agents needed)
npm run dev:standalone      # development with hot reload
npm run start:standalone    # production mode

# Database migrations (PostgreSQL)
npm run db:generate   # generate new migrations
npm run db:push       # apply schema to database
```

## Sample API Server

```bash
cd sample-apis && npm run dev   # starts on port 3000
```

## Architecture

### Deployment Modes

Griffin supports two deployment architectures:

#### 1. Standalone Mode (Built-in Executor)
- **griffin-hub-standalone** - Combined control plane + executor in single process
- Scheduler enqueues jobs, built-in executor processes them directly
- Uses `"local"` location for all job routing
- Simpler deployment for single-instance usage
- Entrypoint: `src/server-standalone.ts`

#### 2. Distributed Mode (Hub + Agents)
- **griffin-hub** - Control plane: stores plans, schedules runs, tracks agents
- Agents register with hub and receive jobs via PostgreSQL-backed queue
- Hub monitors agent health via heartbeat protocol
- Enables geographic distribution and horizontal scaling
- Entrypoint: `src/server.ts`

### Execution Flow
1. **griffin-ts** (DSL) - Builder pattern creates test definitions in TypeScript
2. Test files serialize to JSON test plans
3. **griffin-executor** - Executes JSON plans using graph-based execution (ts-edge)
4. **griffin-hub** - Schedules jobs and enqueues them
5. **Executor** (built-in or agent) - Polls queue, executes plans, reports results

### Key Patterns
- **Graph-based execution**: Uses `ts-edge` for node/edge state management. Tests are graphs with nodes (endpoints, waits, assertions) and edges defining execution flow.
- **Builder patterns**: Two builder APIs available:
  - `createGraphBuilder()` - Type-safe graph builder with explicit edges
  - `createTestBuilder()` - Sequential builder with auto-generated edges (simpler for linear flows)
- **Fastify plugins**: Hub uses autoload plugin system with plugins in `src/plugins/` and routes in `src/routes/`
- **Ports and adapters**: Storage layer uses interfaces for PostgreSQL (via Drizzle ORM)

### Test File Structure
Test files go in `__griffin__/` directories and export JSON plans:

```typescript
// Graph-based builder (explicit edges)
import { createGraphBuilder, GET, JSON, START, END, Frequency } from "griffin-ts";

const builder = createGraphBuilder({
  name: "test-name",
  endpoint_host: "http://localhost:3000"
});

builder
  .addEndpoint("check", { method: GET, response_format: JSON, path: "/health" })
  .addEdge(START, "check")
  .addEdge("check", END)
  .build({ frequency: Frequency.every(1).minute() });
```

```typescript
// Sequential builder (auto-edges, simpler for linear flows)
import { createTestBuilder, GET, JSON, Frequency } from "griffin-ts";

const builder = createTestBuilder({
  name: "test-name",
  endpoint_host: "http://localhost:3000"
});

builder
  .endpoint("check", { method: GET, response_format: JSON, path: "/health" })
  .build({ frequency: Frequency.every(1).minute() });
```

### Hub Configuration
Environment-based config via Typebox schema. Key variables:
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JOBQUEUE_BACKEND`: postgres | sqs (default: postgres)
- `SCHEDULER_ENABLED`: Enable scheduler (default: true)
- `SCHEDULER_TICK_INTERVAL`: Scheduler polling interval in ms (default: 30000)
- `WORKER_EMPTY_DELAY`: Executor initial empty queue delay in ms (default: 1000)
- `WORKER_MAX_EMPTY_DELAY`: Executor max empty queue delay in ms (default: 30000)
- `PLAN_EXECUTION_TIMEOUT`: Execution timeout in ms (default: 30000)
- `AUTH_MODE`: none | api-key | oidc (default: none)
- `AUTH_API_KEYS`: Comma-separated API keys (required if AUTH_MODE=api-key)
- `AUTH_OIDC_ISSUER`: OIDC issuer URL (required if AUTH_MODE=oidc)

### Agent Configuration
- `AGENT_LOCATION`: Location identifier (required)
- `HUB_URL`: Hub API endpoint (required)
- `QUEUE_BACKEND`: postgres | sqs | redis (default: postgres)
- `QUEUE_CONNECTION_STRING`: Backend-specific connection
- `HEARTBEAT_ENABLED`, `HEARTBEAT_INTERVAL_SECONDS`: Heartbeat settings

### Secrets System
Secrets are referenced in test files using `secret("provider:path")` and resolved at runtime:

```typescript
import { secret } from "griffin-ts";

builder.endpoint("call", {
  headers: {
    "Authorization": secret("env:API_KEY"),      // Environment variable
    "X-API-Key": secret("aws:prod/api-key"),     // AWS Secrets Manager
    "X-Token": secret("vault:secret/data/app"),  // HashiCorp Vault
  },
});
```

**Providers:**
- `env` - Environment variables (always available)
- `aws` - AWS Secrets Manager (optional, requires `@aws-sdk/client-secrets-manager`)
- `vault` - HashiCorp Vault (optional)

**Hub/Agent config:**
- `SECRET_PROVIDERS`: Comma-separated list of enabled providers (default: "env")
- `AWS_SECRETS_REGION`, `VAULT_ADDR`, `VAULT_TOKEN`: Provider-specific config

**Key files:**
- `griffin-ts/src/secrets.ts` - DSL secret() function
- `griffin-executor/src/secrets/` - Provider implementations and resolution
- `griffin-hub/src/plugins/secrets.ts` - Hub integration

## Key Entry Points

| Path | Purpose |
|------|---------|
| `griffin-cli/src/cli.ts` | CLI entry point |
| `griffin-ts/src/builder.ts` | Graph-based TestBuilder |
| `griffin-ts/src/sequential-builder.ts` | Sequential TestBuilder |
| `griffin-ts/src/secrets.ts` | secret() function for DSL |
| `griffin-executor/src/executor.ts` | Plan execution engine |
| `griffin-executor/src/secrets/` | Secret providers and resolution |
| `griffin-hub/src/app.ts` | Fastify app setup |
| `griffin-hub/src/server.ts` | Hub-only entry point (control plane) |
| `griffin-hub/src/server-standalone.ts` | Standalone entry point (hub + executor) |
| `griffin-hub/src/config.ts` | Hub configuration schema |
| `griffin-hub/src/executor/service.ts` | Built-in executor service |
| `griffin-hub/src/executor/plugin.ts` | Executor Fastify plugin |
| `griffin-hub/src/plugins/secrets.ts` | Secret registry initialization |

## Updating PR Descriptions

The `gh pr edit` command may fail with GraphQL errors. Use the REST API instead:

```bash
# Write body to temp file first
cat > /tmp/pr-body.md << 'PREOF'
Your PR description here...
PREOF

# Update via REST API
gh api repos/OWNER/REPO/pulls/PR_NUMBER -X PATCH -f body="$(cat /tmp/pr-body.md)"
```
