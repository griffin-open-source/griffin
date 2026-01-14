# griffin CLI

The griffin CLI tool allows developers to run API tests locally and manage their test configurations. It scans for `.ts` files in `__griffin__` subdirectories and executes them using the test system.

## Features

✅ **Currently Working**:
- Scan and discover test files in `__griffin__` subdirectories
- Run tests locally against development servers
- Execute TypeScript test files and run JSON test plans
- Display test execution results with detailed error reporting
- Configure runner hosts for remote execution

🚧 **Coming Soon**:
- Deploy tests to remote runners
- View logs from remote test executions
- Execute tests remotely on demand

## Prerequisites

- Node.js 20+
- `tsx` installed globally or available via `npx` (for executing TypeScript files)
- Built `griffin-ts` and `griffin-plan-executor` projects (see main README)

## Installation

### Local Development

```bash
cd griffin-cli
npm install
npm run build
```

### Using with npx (Recommended)

Once published, you can use the CLI directly with npx:

```bash
npx griffin-cli run-local 3000
```

### Local Development Usage

After building, you can use the CLI in several ways:

```bash
# Using the built executable directly
node dist/cli.js run-local 3000

# Or using npm scripts
npm run dev run-local 3000

# Or after linking (npm link), use globally
griffin run-local 3000
```

## Usage

### Run Tests Locally

```bash
npx griffin-cli run-local
# or
node dist/cli.js run-local
```

The CLI will:
1. Discover all `.ts` files in `__griffin__` directories
2. Execute each test file (which outputs JSON)
3. Run the JSON test plan using the `endpoint_host` specified in each test file
4. Display results with pass/fail status

**Note**: Each test file specifies its own `endpoint_host` (including port) in the `ApiCheckBuilder` configuration. For example:
```typescript
const builder = new ApiCheckBuilder({
  name: "my-check",
  endpoint_host: "http://localhost:3000"  // Port is specified here
});
```

**Secrets**: If your test plans use secrets (via the `secret()` function), they will be resolved using environment variables when running locally. For AWS Secrets Manager or Vault, configure the appropriate environment variables or credentials. See [griffin-runner CONFIG.md](../griffin-runner/CONFIG.md) for details.

**Example Output**:
```
Running tests locally

Found 1 test file(s):
  - /path/to/__griffin__/example-check.ts

Running example-check.ts
..
✓ Test passed

Summary: 1 passed, 0 failed
```

### Configure Runner Host

```bash
npx griffin-cli configure-runner-host "https://runner-host.com"
```

This saves the runner host configuration to `~/.griffin/config.json`.

### Other Commands (Coming Soon)

```bash
# Deploy tests to the configured runner
npx griffin-cli deploy

# View logs for a specific check
npx griffin-cli logs foo-bar-check

# Execute a check remotely
npx griffin-cli execute-remote foo-bar-check
```

## How It Works

1. **Discovery**: The CLI scans the current directory (and subdirectories) for `__griffin__` folders containing `.ts` files
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

**"Test system not built"**: Make sure you've built `griffin-ts`:
```bash
cd ../griffin-ts && npm install && npm run build
```

**"Plan executor not built"**: Make sure you've built `griffin-plan-executor`:
```bash
cd ../griffin-plan-executor && npm install && npm run build
```

**"tsx is not available"**: Install tsx globally:
```bash
npm install -g tsx
```

Or ensure `npx` is available (it will use `npx tsx` as a fallback).
