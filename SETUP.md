# Setup Guide for griffin

This guide will help you set up and test compile the griffin CLI with sample tests.

## Prerequisites

1. **Node.js** (20+)
2. **npm** or **yarn**
3. **tsx** (install globally: `npm install -g tsx` or use `npx tsx`)

## Setup Steps

### 1. Install TypeScript Dependencies

First, install dependencies for the test system and monitor executor:

```bash
# Install test system dependencies
cd griffin-ts
npm install
npm run build

# Install monitor executor dependencies
cd ../griffin-executor
npm install
npm run build

cd ..
```

### 2. Build the CLI

```bash
cd griffin-cli
npm install
npm run build
```

This creates the compiled TypeScript in the `dist/` directory.

### 4. Create Sample Test

A sample test file has been created at `__griffin__/example-check.ts`. This test:
- Makes a GET request to `/health`
- Waits 1 second
- Outputs a JSON test monitor

You can create additional tests by:
1. Creating a `__griffin__` directory anywhere in your project
2. Adding `.ts` files that use the test system DSL
3. The CLI will automatically discover and run them

### 5. Run Tests Locally

The CLI will automatically discover all test files in `__griffin__` directories. Each test file specifies its own `endpoint_host` (including port):

```bash
# Using the built CLI
node griffin-cli/dist/cli.js run-local

# Or using npm scripts (development mode)
cd griffin-cli
npm run dev run-local

# The CLI will:
# - Discover all .ts files in __griffin__ directories
# - Execute each test file (which outputs JSON)
# - Run the JSON test monitor using the endpoint_host from each test file
# - Display results with pass/fail status
```

**Note**: Make sure you have servers running on the ports specified in your test files' `endpoint_host` configurations, or the endpoint requests will fail (which is expected behavior for testing).

**Future**: Once published to npm, you'll be able to use:
```bash
npx griffin-cli run-local
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

Make sure you've built both `griffin-ts` and `griffin-executor`:

```bash
cd griffin-ts && npm install && npm run build
cd ../griffin-executor && npm install && npm run build
```

### "Monitor executor not found" error

Same as above - ensure both TypeScript projects are built.

### Test execution fails

- Check that your test file outputs valid JSON (the test system should handle this automatically)
- Verify the server is running on the specified port
- Check that endpoint paths in your test match your server's API routes

## Project Structure

```
griffin/
├── griffin-cli/          # TypeScript CLI tool
├── griffin-runner/       # TypeScript orchestration service
├── griffin-ts/           # TypeScript DSL library
├── griffin-executor/# TypeScript monitor executor
└── __griffin__/          # Test files directory
    └── example-check.ts
```
