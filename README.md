# griffin

griffin is an open-source API testing platform that allows developers to create TypeScript-based API tests and run those tests against their production APIs. It's like Datadog Synthetics, but it lives in your codebase.

## Project Structure

griffin is a monorepo containing multiple TypeScript packages:

### 1. [griffin-ts](./griffin-ts/)
The TypeScript DSL library for defining API tests. Tests are written in TypeScript and output JSON test plans that can be executed by the plan executor.

**Key Features:**
- Sequential and graph-based builder patterns for test creation
- Support for endpoints, waits, assertions, and edges
- Secrets management using `secret("provider:path")` syntax
- Frequency-based test scheduling
- Outputs JSON test plans for execution

### 2. [griffin-plan-executor](./griffin-plan-executor/)
The core execution library that takes JSON test plans and executes them using graph-based execution (powered by ts-edge).

**Key Features:**
- Graph-based execution engine
- Support for endpoints, waits, and assertions
- Multiple secret providers (env, AWS Secrets Manager, HashiCorp Vault)
- HTTP adapter abstraction (Axios, stub)
- Event emitter for execution lifecycle hooks

### 3. [griffin-hub](./griffin-hub/)
The control plane service responsible for scheduling tests, managing test plans, and coordinating agent execution.

**Key Features:**
- REST API for plan management (`/plan`, `/runs`, `/agents`, `/config`)
- Scheduler service for frequency-based test execution
- Agent registry with heartbeat monitoring
- Support for multiple storage backends (Postgres, SQLite, memory)
- Multi-location execution support

### 4. [griffin-agent](./griffin-agent/)
The execution component that runs in specific locations and executes test plans from the job queue.

**Key Features:**
- Location-based job consumption
- Automatic registration and heartbeat with hub
- Graceful shutdown with job completion
- Queue consumer abstraction (Postgres, SQS, Redis)
- Independent deployment (communicates with hub via HTTP)

### 5. [griffin-cli](./griffin-cli/)
The CLI tool for running tests locally, managing test plans, and interacting with the hub.

**Key Features:**
- Discovers `.ts` test files in `__griffin__` subdirectories
- Runs tests locally against development servers
- Plan validation and deployment to hub
- Hub connectivity management
- Test execution and log viewing

### 6. [griffin-hub-sdk](./griffin-hub-sdk/)
Auto-generated TypeScript SDK for communicating with griffin-hub API. Generated from OpenAPI specifications.

**Key Features:**
- Type-safe API client for hub endpoints
- Auto-generated from OpenAPI spec
- Used by agent and CLI for hub communication

### 7. [sample-apis](./sample-apis/)
A simple JSON API server for testing griffin functionality during development.

**Key Features:**
- Health check endpoint
- Basic CRUD operations
- JSON responses
- Development testing target

## Getting Started

> 📖 **Detailed Setup Instructions**: See [SETUP.md](./SETUP.md) for step-by-step setup guide.

### Quick Start

1. **Build the TypeScript projects** (in dependency order):
   ```bash
   # Build DSL library (required first)
   cd griffin-ts && npm install && npm run build
   
   # Build plan executor (depends on griffin-ts)
   cd ../griffin-plan-executor && npm install && npm run build
   
   # Build CLI (depends on plan executor)
   cd ../griffin-cli && npm install && npm run build
   ```

2. **Start the sample API server** (optional, for testing):
   ```bash
   cd sample-apis && npm install && npm run dev
   ```

3. **Create a test file** in a `__griffin__` directory:
   ```typescript
   // __griffin__/my-test.ts
   import { createTestBuilder, GET, Json, Frequency, target } from "../griffin-ts/src/index";
   
   const plan = createTestBuilder({
     name: "health-check",
     frequency: Frequency.every(1).minute(),
   })
     .request("health", {
       method: GET,
       base: target("sample-api"),
       path: "/health",
       response_format: Json,
     })
     .build();
   ```

4. **Run tests locally**:
   ```bash
   # Using the built CLI
   node griffin-cli/dist/cli.js run-local
   
   # Or in development mode
   cd griffin-cli && npm run dev run-local
   ```

## Architecture

griffin uses a **hub-and-agent architecture** for distributed test execution:

- **Hub**: Control plane that manages plans, schedules tests, and coordinates agents
- **Agent**: Execution component that runs tests from specific locations
- **Multi-location execution**: Tests can run from multiple geographic regions or network zones simultaneously

See [ARCHITECTURE_HUB_AGENT.md](./ARCHITECTURE_HUB_AGENT.md) for detailed architecture documentation.

### Secrets Management

griffin includes a flexible secrets system that resolves credentials at runtime:

```typescript
import { secret } from "griffin-ts";

// Reference secrets using provider:path syntax
.request("api-call", {
  headers: {
    "Authorization": secret("env:API_KEY"),           // Environment variable
    "X-API-Key": secret("aws:prod/api-key"),         // AWS Secrets Manager
    "X-Token": secret("vault:secret/data/app"),      // HashiCorp Vault
  },
})
```

**Supported Providers:**
- `env` - Environment variables (always available)
- `aws` - AWS Secrets Manager (requires `@aws-sdk/client-secrets-manager`)
- `vault` - HashiCorp Vault

See [griffin-plan-executor README](./griffin-plan-executor/README.md) for detailed secrets documentation.

## Current Status

✅ **Working**:
- TypeScript DSL with sequential and graph-based builders
- Graph-based test execution engine (powered by ts-edge)
- Secrets system with multiple providers (env, AWS, Vault)
- Agent registry with heartbeat monitoring
- CLI test discovery and local execution
- Plan validation with location support
- Hub REST API for plans, runs, and agent management

🚧 **In Development** (Hub/Agent Refactoring):
- Scheduler updates for multi-location execution (Phase 3)
- Combined deployment mode (Phase 5)
- CLI updates for location management (Phase 6)
- Integration testing and deployment guides (Phase 7)

## Workflow

### Local Development
1. **Write Tests**: Create `.ts` files in `__griffin__` subdirectories using the griffin DSL
2. **Run Locally**: Use the CLI to execute tests against local development servers
   ```bash
   node griffin-cli/dist/cli.js run-local
   ```

### Hub-Based Execution
1. **Deploy Hub**: Deploy griffin-hub service with database backend
2. **Deploy Agents**: Deploy griffin-agent instances in target locations
3. **Apply Plans**: Use CLI to deploy test plans to the hub
   ```bash
   griffin-cli hub apply
   ```
4. **Monitor**: View execution results via hub API or CLI
   ```bash
   griffin-cli hub runs --plan <plan-name>
   ```

## Running Services

### Hub (Control Plane)
```bash
cd griffin-hub
npm install
npm run build

# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

### Agent (Execution Worker)
```bash
cd griffin-agent
npm install
npm run build

# Configure location
export AGENT_LOCATION=us-east-1
export HUB_URL=http://localhost:3000

# Start agent
npm start
```

### Combined Mode (Coming Soon)
For simple deployments, griffin-runner will combine hub and agent in a single process.

## Testing

```bash
# Plan executor tests
cd griffin-plan-executor
npm test              # single run
npm run test:watch    # watch mode

# Hub tests (coming soon)
cd griffin-hub
npm test
```

## Additional Resources

- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [ARCHITECTURE_HUB_AGENT.md](./ARCHITECTURE_HUB_AGENT.md) - Hub/Agent architecture documentation
- [griffin-ts README](./griffin-ts/README.md) - DSL documentation and examples
- [griffin-plan-executor README](./griffin-plan-executor/README.md) - Executor and secrets documentation
- [griffin-cli README](./griffin-cli/README.md) - CLI commands and usage

## License

MIT
