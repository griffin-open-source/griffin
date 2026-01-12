# 1test

1test is an open-source project that allows developers to create API tests with code and run those tests against their production APIs. It's like Datadog Synthetics, but it lives in your codebase.

## Project Structure

1test consists of four separate repositories:

### 1. [1test-cli](./1test-cli/)
The CLI tool written in TypeScript that allows developers to run tests locally and manage test configurations. Can be used with `npx` for easy installation and execution.

**Key Features:**
- Discovers `.ts` test files in `__1test__` subdirectories
- Runs tests locally against development servers
- Environment injection & parity - run production tests locally with `--env` flag
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

### 3. [1test-ts](./1test-ts/) (formerly 1test-test-system)
The TypeScript DSL library for defining API tests. Tests are written in TypeScript and output JSON test plans that can be executed by the plan executor.

**Key Features:**
- Chainable API for building test plans
- Support for endpoints, waits, assertions, and edges
- Environment variable injection via `env()` helper
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
   cd 1test-ts && npm install && npm run build
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
   import { GET, ApiCheckBuilder, JSON, START, END, Frequency, env } from "../1test-ts/src/index";
   
   // Use environment variables with fallback
   const endpointHost = (() => {
     try {
       return env('endpoint_host');
     } catch {
       return "http://localhost:3000"; // fallback
     }
   })();
   
   const builder = new ApiCheckBuilder({
     name: "my-check",
     endpoint_host: endpointHost
   });
   
   const plan = builder
     .addEndpoint("health", { method: GET, response_format: JSON, path: "/health" })
     .addEdge(START, "health")
     .addEdge("health", END);
   
   plan.create({ frequency: Frequency.every(1).minute() });
   ```
   
   **Optional**: Create `__1test__/env.ts` for environment configurations:
   ```typescript
   export default {
     production: {
       endpoint_host: "https://api.production.example.com",
       api: { baseUrl: "https://api.production.example.com" }
     },
     staging: {
       endpoint_host: "https://api.staging.example.com",
       api: { baseUrl: "https://api.staging.example.com" }
     },
     development: {
       endpoint_host: "http://localhost:3000",
       api: { baseUrl: "http://localhost:3000" }
     }
   };
   ```

3. **Run tests locally**:
   ```bash
   # Using the built CLI (without environment - uses fallbacks)
   node 1test-cli/dist/cli.js run-local
   
   # With environment configuration
   node 1test-cli/dist/cli.js run-local --env=production
   node 1test-cli/dist/cli.js run-local --env=staging
   node 1test-cli/dist/cli.js run-local --env=development
   
   # Or using npx (once published)
   npx 1test-cli run-local --env=production
   ```
   
   **Note**: The `--env` flag loads environment variables from `__1test__/env.ts`. If not specified, tests will use fallback values or throw errors if `env()` is called without a fallback.

## Current Status

✅ **Working**:
- CLI test discovery and execution
- TypeScript DSL for creating test plans
- JSON plan execution with endpoints and waits
- Local test execution against development servers
- Environment injection & parity - run production tests locally with environment configurations
- Comprehensive test suite for environment injection feature

🚧 **In Development**:
- Assertion evaluation (structure in place, needs implementation)
- Remote runner deployment
- Test scheduling and orchestration
- Log viewing and remote execution

## Workflow

1. **Write Tests**: Create `.ts` files in `__1test__` subdirectories using the test system DSL. Each test specifies its own `endpoint_host` (including port) in the `ApiCheckBuilder` configuration. Use `env()` helper to inject environment variables.
2. **Configure Environments** (optional): Create `__1test__/env.ts` with environment configurations for production, staging, development, etc.
3. **Run Locally**: Use `node 1test-cli/dist/cli.js run-local` or `npx 1test-cli run-local` to run all tests. Add `--env=<environment>` to use environment-specific configurations.
3. **Configure Runner** (coming soon): Use `npx 1test-cli configure-runner-host <host>` to set up remote execution
4. **Deploy** (coming soon): Use `npx 1test-cli deploy` to deploy tests to a runner
5. **Monitor** (coming soon): Use `npx 1test-cli logs <check-name>` to view execution logs

## License

MIT
