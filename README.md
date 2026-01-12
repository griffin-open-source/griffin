# 1test

1test is an open-source project that allows developers to create API tests with code and run those tests against their production APIs. It's like Datadog Synthetics, but it lives in your codebase.

## Project Structure

1test consists of four separate repositories:

### 1. [1test-cli](./1test-cli/)
The CLI tool written in TypeScript that allows developers to run tests locally and manage test configurations. Can be used with `npx` for easy installation and execution.

**Key Features:**
- Discovers `.ts` test files in `__1test__` subdirectories
- Runs tests locally against development servers
- Configures runner hosts for remote execution
- Deploys tests to remote runners (coming soon)
- Views logs and executes tests remotely (coming soon)

### 2. [1test-runner](./1test-runner/)
The orchestration service responsible for scheduling and executing tests. Ensures tests run according to their configured frequencies (e.g., every 15 minutes, every minute).

**Key Features:**
- Schedules tests based on frequency configuration
- Executes test plans using the plan executor
- Stores execution results and logs in PostgreSQL
- Provides REST API for CLI interactions

### 3. [1test-test-system](./1test-test-system/)
The TypeScript DSL library for defining API tests. Tests are written in TypeScript and output JSON test plans that can be executed by the plan executor.

**Key Features:**
- Chainable API for building test plans
- Support for endpoints, waits, assertions, and edges
- Outputs JSON test plans for execution

### 4. [1test-plan-executor](./1test-plan-executor/)
The executor that takes JSON test plans (output from the test system DSL) and executes them. Can run tests locally or remotely (e.g., in a Lambda function).

**Key Features:**
- Executes JSON test plans
- Graph-based execution following edges
- Support for endpoints, waits, and assertions
- Local and remote execution modes

### 5. [sample-apis](./sample-apis/)
A simple JSON API server for testing 1test functionality. Provides basic CRUD operations and can be extended for testing different scenarios.

**Key Features:**
- Health check endpoint
- CRUD operations for items
- JSON responses
- Easy to extend for additional test scenarios

## Getting Started

> 📖 **Detailed Setup Instructions**: See [SETUP.md](./SETUP.md) for step-by-step setup guide.

### Quick Start

1. **Build the TypeScript projects**:
   ```bash
   cd 1test-test-system && npm install && npm run build
   cd ../1test-plan-executor && npm install && npm run build
   cd ../1test-cli && npm install && npm run build
   ```

2. **Start the sample API server** (optional, for testing):
   ```bash
   cd ../sample-apis && npm install && npm run dev
   ```

2. **Create a test file** in a `__1test__` directory:
   ```typescript
   // __1test__/my-test.ts
   import { GET, ApiCheckBuilder, JSON, START, END, Frequency } from "../1test-test-system/src/index";
   
   const builder = new ApiCheckBuilder({
     name: "my-check",
     endpoint_host: "http://localhost"
   });
   
   const plan = builder
     .addEndpoint("health", { method: GET, response_format: JSON, path: "/health" })
     .addEdge(START, "health")
     .addEdge("health", END);
   
   plan.create({ frequency: Frequency.every(1).minute() });
   ```

3. **Run tests locally**:
   ```bash
   # Using the built CLI
   node 1test-cli/dist/cli.js run-local
   
   # Or using npx (once published)
   npx 1test-cli run-local
   ```
   
   **Note**: The port is specified in each test file's `endpoint_host` configuration, not as a CLI argument.

## Current Status

✅ **Working**:
- CLI test discovery and execution
- TypeScript DSL for creating test plans
- JSON plan execution with endpoints and waits
- Local test execution against development servers

🚧 **In Development**:
- Assertion evaluation (structure in place, needs implementation)
- Remote runner deployment
- Test scheduling and orchestration
- Log viewing and remote execution

## Workflow

1. **Write Tests**: Create `.ts` files in `__1test__` subdirectories using the test system DSL. Each test specifies its own `endpoint_host` (including port) in the `ApiCheckBuilder` configuration.
2. **Run Locally**: Use `node 1test-cli/dist/cli.js run-local` or `npx 1test-cli run-local` to run all tests using their configured endpoint hosts
3. **Configure Runner** (coming soon): Use `npx 1test-cli configure-runner-host <host>` to set up remote execution
4. **Deploy** (coming soon): Use `npx 1test-cli deploy` to deploy tests to a runner
5. **Monitor** (coming soon): Use `npx 1test-cli logs <check-name>` to view execution logs

## License

MIT
