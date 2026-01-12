# Setup Guide for 1test

This guide will help you set up and test compile the 1test CLI with sample tests.

## Prerequisites

1. **Node.js** (20+)
2. **npm** or **yarn**
3. **tsx** (install globally: `npm install -g tsx` or use `npx tsx`)

## Setup Steps

### 1. Install TypeScript Dependencies

First, install dependencies for the test system and plan executor:

```bash
# Install test system dependencies
cd 1test-ts
npm install
npm run build

# Install plan executor dependencies
cd ../1test-plan-executor
npm install
npm run build

cd ..
```

### 2. Build the CLI

```bash
cd 1test-cli
npm install
npm run build
```

This creates the compiled TypeScript in the `dist/` directory.

### 4. Create Sample Test

A sample test file has been created at `__1test__/example-check.ts`. This test:
- Makes a GET request to `/health`
- Waits 1 second
- Outputs a JSON test plan

You can create additional tests by:
1. Creating a `__1test__` directory anywhere in your project
2. Adding `.ts` files that use the test system DSL
3. The CLI will automatically discover and run them

### 4a. Configure Environment Variables (Optional)

Create `__1test__/env.ts` to define environment-specific configurations:

```typescript
export default {
  production: {
    endpoint_host: "https://api.production.example.com",
    api: {
      baseUrl: "https://api.production.example.com",
      timeout: 30000,
    },
  },
  staging: {
    endpoint_host: "https://api.staging.example.com",
    api: {
      baseUrl: "https://api.staging.example.com",
      timeout: 30000,
    },
  },
  development: {
    endpoint_host: "http://localhost:3000",
    api: {
      baseUrl: "http://localhost:3000",
      timeout: 10000,
    },
  },
};
```

Then use the `env()` helper in your test files to access these values. See the test system README for more details.

### 5. Run Tests Locally

The CLI will automatically discover all test files in `__1test__` directories. Each test file specifies its own `endpoint_host` (including port):

```bash
# Using the built CLI (without environment - uses fallbacks)
node 1test-cli/dist/cli.js run-local

# With environment configuration
node 1test-cli/dist/cli.js run-local --env=production
node 1test-cli/dist/cli.js run-local --env=staging
node 1test-cli/dist/cli.js run-local --env=development

# Or using npm scripts (development mode)
cd 1test-cli
npm run dev run-local
npm run dev run-local -- --env=production
```

The CLI will:
- Discover all `.ts` files in `__1test__` directories
- Load environment configuration from `__1test__/env.ts` if `--env` flag is provided
- Execute each test file (which outputs JSON) with environment variables injected
- Run the JSON test plan using the `endpoint_host` from each test file
- Display results with pass/fail status

**Note**: Make sure you have servers running on the ports specified in your test files' `endpoint_host` configurations, or the endpoint requests will fail (which is expected behavior for testing).

**Future**: Once published to npm, you'll be able to use:
```bash
npx 1test-cli run-local
```

## Troubleshooting

### npm install fails

If you encounter permission errors with npm, try:
- Using `nvm` to manage Node.js versions
- Running with `sudo` (not recommended)
- Checking npm permissions

### tsx not found

The test runner requires `tsx` to run TypeScript files. Install it globally:

```bash
npm install -g tsx
```

Or the script will automatically try to use `npx tsx` as a fallback.

### "Test system not built" error

Make sure you've built both `1test-ts` and `1test-plan-executor`:

```bash
cd 1test-ts && npm install && npm run build
cd ../1test-plan-executor && npm install && npm run build
```

### "Environment file not found" error

If using the `--env` flag, make sure `__1test__/env.ts` exists. Create it with your environment configurations (see step 4a above).

### "Environment not found in env.ts" error

Make sure the environment name you specified with `--env` exists in your `__1test__/env.ts` file. The error message will show available environments.

### "Plan executor not found" error

Same as above - ensure both TypeScript projects are built.

### Test execution fails

- Check that your test file outputs valid JSON (the test system should handle this automatically)
- Verify the server is running on the specified port
- Check that endpoint paths in your test match your server's API routes

### Running CLI Tests

The CLI includes a test suite to verify environment injection functionality:

```bash
cd 1test-cli
npm install  # Installs vitest
npm test     # Run all tests
```

The test suite verifies:
- Environment configuration loading
- Test files output expected JSON plans
- Environment variable substitution works correctly

## Project Structure

```
bastion/
├── 1test-cli/          # TypeScript CLI tool
├── 1test-runner/       # TypeScript orchestration service
├── 1test-ts/           # TypeScript DSL library (formerly 1test-test-system)
├── 1test-plan-executor/ # TypeScript plan executor
└── __1test__/          # Test files directory
    ├── example-check.ts
    └── env.ts           # Environment configurations (optional)
```
