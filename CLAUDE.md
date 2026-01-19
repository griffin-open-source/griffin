# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

griffin is an open-source API testing platform for creating TypeScript-based API tests that run against production APIs. It's a monorepo with multiple TypeScript packages.

## Build Commands

The projects must be built in dependency order:

```bash
# Build DSL library (required first)
cd griffin-ts && npm install && npm run build

# Build plan executor (depends on ts-edge)
cd ../griffin-plan-executor && npm install && npm run build

# Build CLI (depends on plan executor)
cd ../griffin-cli && npm install && npm run build

# Build runner (depends on plan executor)
cd ../griffin-runner && npm install && npm run build:ts
```

## Running Tests

```bash
# Plan executor tests
cd griffin-plan-executor && npm test           # single run
cd griffin-plan-executor && npm run test:watch # watch mode

# Runner tests
cd griffin-runner && npm test                  # single run (builds first)
cd griffin-runner && npm run test:watch        # watch mode
```

Both projects use Vitest.

## Running the CLI

```bash
# Run tests locally (discovers __griffin__/*.ts files)
node griffin-cli/dist/cli.js run-local

# Development mode
cd griffin-cli && npm run dev run-local
```

## Running the Runner Service

```bash
cd griffin-runner
npm run dev      # development with hot reload
npm start        # production mode
```

## Sample API Server

```bash
cd sample-apis && npm run dev   # starts on port 3000
```

## Architecture

### Execution Flow
1. **griffin-ts** (DSL) - Builder pattern creates test definitions in TypeScript
2. Test files serialize to JSON test plans
3. **griffin-plan-executor** - Executes JSON plans using graph-based execution (ts-edge)
4. **griffin-runner** - Fastify service for scheduling and orchestrating test runs

### Key Patterns
- **Graph-based execution**: Uses `ts-edge` for node/edge state management. Tests are graphs with nodes (endpoints, waits, assertions) and edges defining execution flow.
- **Builder pattern**: `ApiCheckBuilder` provides chainable API for test definitions
- **Fastify plugins**: Runner uses autoload plugin system with plugins in `src/plugins/` and routes in `src/routes/`

### Test File Structure
Test files go in `__griffin__/` directories and export JSON plans:
```typescript
import { GET, ApiCheckBuilder, JSON, START, END, Frequency, Wait } from "../griffin-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "test-name",
  endpoint_host: "http://localhost:3000"
});

builder
  .addEndpoint("check", { method: GET, response_format: JSON, path: "/health" })
  .addEdge(START, "check")
  .addEdge("check", END);

plan.create({ frequency: Frequency.every(1).minute() });
```

### Runner Configuration
Environment-based config via Typebox schema. Key variables:
- `REPOSITORY_BACKEND`: memory | sqlite | postgres
- `JOBQUEUE_BACKEND`: memory | postgres
- `SCHEDULER_ENABLED`, `WORKER_ENABLED`: boolean
- See `griffin-runner/CONFIG.md` for full reference

### Secrets System
Secrets are referenced in test files using `secret("provider:path")` and resolved at runtime:

```typescript
import { secret } from "../griffin-ts/src/index";

builder.addEndpoint("call", {
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

**Runner config:**
- `SECRET_PROVIDERS`: Comma-separated list of enabled providers (default: "env")
- `AWS_SECRETS_REGION`, `VAULT_ADDR`, `VAULT_TOKEN`: Provider-specific config

**Key files:**
- `griffin-ts/src/secrets.ts` - DSL secret() function
- `griffin-plan-executor/src/secrets/` - Provider implementations and resolution
- `griffin-runner/src/plugins/secrets.ts` - Runner integration

## Key Entry Points

| Path | Purpose |
|------|---------|
| `griffin-cli/src/cli.ts` | CLI entry point |
| `griffin-ts/src/builder.ts` | ApiCheckBuilder class |
| `griffin-ts/src/secrets.ts` | secret() function for DSL |
| `griffin-plan-executor/src/executor.ts` | Plan execution engine |
| `griffin-plan-executor/src/secrets/` | Secret providers and resolution |
| `griffin-runner/src/app.ts` | Fastify app setup |
| `griffin-runner/src/config.ts` | Configuration schema |
| `griffin-runner/src/plugins/secrets.ts` | Secret registry initialization |
