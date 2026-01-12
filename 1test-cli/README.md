# 1test CLI

The 1test CLI tool allows developers to run API tests locally and manage their test configurations. It scans for `.ts` files in `__1test__` subdirectories and executes them using the test system.

## Features

✅ **Currently Working**:
- Scan and discover test files in `__1test__` subdirectories
- Run tests locally against development servers
- Execute TypeScript test files and run JSON test plans
- Display test execution results with detailed error reporting
- Environment injection & parity via `--env` flag
- Configure runner hosts for remote execution

🚧 **Coming Soon**:
- Deploy tests to remote runners
- View logs from remote test executions
- Execute tests remotely on demand

## Prerequisites

- Node.js 20+
- `tsx` installed globally or available via `npx` (for executing TypeScript files)
- Built `1test-ts` and `1test-plan-executor` projects (see main README)

## Installation

### Local Development

```bash
cd 1test-cli
npm install
npm run build
```

### Using with npx (Recommended)

Once published, you can use the CLI directly with npx:

```bash
npx 1test-cli run-local 3000
```

### Local Development Usage

After building, you can use the CLI in several ways:

```bash
# Using the built executable directly
node dist/cli.js run-local 3000

# Or using npm scripts
npm run dev run-local 3000

# Or after linking (npm link), use globally
1test run-local 3000
```

## Usage

### Run Tests Locally

```bash
# Run without environment (uses fallbacks in test files)
npx 1test-cli run-local
# or
node dist/cli.js run-local

# Run with environment configuration
npx 1test-cli run-local --env=production
npx 1test-cli run-local --env=staging
npx 1test-cli run-local --env=development
```

The CLI will:
1. Discover all `.ts` files in `__1test__` directories
2. Load environment configuration from `__1test__/env.ts` if `--env` flag is provided
3. Execute each test file (which outputs JSON) with environment variables injected
4. Run the JSON test plan using the `endpoint_host` specified in each test file
5. Display results with pass/fail status

**Environment Configuration**: Create `__1test__/env.ts` to define environment-specific variables:

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

**Note**: Each test file can use the `env()` helper to access environment variables. If `--env` is not specified, tests should provide fallback values:

```typescript
import { env, ApiCheckBuilder } from "../1test-ts/src/index";

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
```

**Example Output**:
```
Running tests locally

Found 1 test file(s):
  - /path/to/__1test__/example-check.ts

Running example-check.ts
..
✓ Test passed

Summary: 1 passed, 0 failed
```

### Configure Runner Host

```bash
npx 1test-cli configure-runner-host "https://runner-host.com"
```

This saves the runner host configuration to `~/.1test/config.json`.

### Other Commands (Coming Soon)

```bash
# Deploy tests to the configured runner
npx 1test-cli deploy

# View logs for a specific check
npx 1test-cli logs foo-bar-check

# Execute a check remotely
npx 1test-cli execute-remote foo-bar-check
```

## How It Works

1. **Discovery**: The CLI scans the current directory (and subdirectories) for `__1test__` folders containing `.ts` files
2. **Execution**: For each test file:
   - Runs the TypeScript file using `tsx` (or `npx tsx`)
   - Captures the JSON output from the test system
   - Executes the JSON plan using the plan executor
   - Displays results with node-by-node status

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode (with tsx)
npm run dev run-local 3000
```

## Troubleshooting

**"Test system not built"**: Make sure you've built `1test-ts`:
```bash
cd ../1test-ts && npm install && npm run build
```

**"Environment file not found"**: If using `--env` flag, make sure `__1test__/env.ts` exists:
```bash
# Create the file with your environment configurations
touch __1test__/env.ts
```

**"Environment not found in env.ts"**: Make sure the environment name specified in `--env` exists in your `env.ts` file. Available environments are shown in the error message.

**"Plan executor not built"**: Make sure you've built `1test-plan-executor`:
```bash
cd ../1test-plan-executor && npm install && npm run build
```

**"tsx is not available"**: Install tsx globally:
```bash
npm install -g tsx
```

Or ensure `npx` is available (it will use `npx tsx` as a fallback).
