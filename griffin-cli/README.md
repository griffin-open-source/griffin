# Griffin CLI

Command-line interface for managing API monitoring tests as code.

## Overview

Griffin CLI enables monitoring-as-code with support for both local test execution and hub-based orchestration. It provides a declarative workflow:

1. Write test plans in TypeScript/JavaScript
2. Run tests locally against configured targets
3. Preview changes with `griffin hub plan`
4. Apply changes to hub with `griffin hub apply`
5. Monitor execution with `griffin hub runs`

## Installation

```bash
npm install -g griffin-cli
```

## Quick Start

### 1. Initialize

```bash
griffin init
```

This creates `.griffin/state.json` which tracks:

- Project ID (auto-detected from package.json or directory name)
- Environment configurations with their targets
- Synced plan state
- Hub connection settings (optional)

Override project ID with `--project <name>`.

### 2. View Environments

View configured environments:

```bash
griffin env list
```

### 3. Create Test Plans

Create test files in `__griffin__/` directories. These files export test plans that can be run locally or synced to the hub.

### 4. Run Tests Locally

```bash
griffin local run local
```

Executes tests locally using variables from `variables.yaml` for the specified environment.

### 5. Connect to Hub (Optional)

```bash
griffin hub connect --url https://hub.example.com --token <token>
```

### 6. Preview Hub Changes

```bash
griffin hub plan
griffin hub plan production
```

Shows what will be created, updated, or deleted on the hub for the specified environment.

### 7. Apply to Hub

```bash
griffin hub apply
griffin hub apply production
```

Syncs plans to the hub for the specified environment.

### 8. Trigger Hub Run

```bash
griffin hub run production --plan <name>
```

Triggers a plan execution on the hub in the specified environment.

## Commands

Commands are organized into four groups:

- **Top-level**: Project initialization and utilities
- **env**: Environment management
- **local**: Local test execution
- **hub**: Hub operations (plan sync, remote execution)

### Top-Level Commands

#### `griffin init`

Initialize Griffin in the current directory.

**Options:**

- `--project <name>` - Project ID (defaults to package.json name or directory name)

**Example:**

```bash
griffin init
griffin init --project my-service
```

#### `griffin validate`

Validate test plan files without syncing.

**Example:**

```bash
griffin validate
```

#### `griffin generate-key`

Generate a cryptographically secure API key for authentication.

**Example:**

```bash
griffin generate-key
```

### Environment Commands

#### `griffin env list`

List all available environments.

**Example:**

```bash
griffin env list
```

Shows all configured environments with an asterisk (*) marking the default environment.

### Local Commands

#### `griffin local run [env]`

Run tests locally against an environment. Environment can be specified as a positional argument, or uses the default environment if omitted.

**Example:**

```bash
griffin local run
griffin local run staging
```

Variables are loaded from `variables.yaml` for the specified environment.

### Hub Commands

#### `griffin hub connect`

Configure hub connection settings.

**Options:**

- `--url <url>` - Hub URL (required)
- `--token <token>` - API authentication token

**Example:**

```bash
griffin hub connect --url https://hub.example.com --token abc123
```

#### `griffin hub status`

Show hub connection status.

**Example:**

```bash
griffin hub status
```

#### `griffin hub runs`

Show recent runs from the hub.

**Options:**

- `--plan <name>` - Filter by plan name
- `--limit <number>` - Number of runs to show (default: 10)

**Example:**

```bash
griffin hub runs
griffin hub runs --plan health-check --limit 5
```

#### `griffin hub plan [env]`

Show what changes would be applied to the hub. Environment can be specified as a positional argument, or uses the default environment if omitted.

**Options:**

- `--json` - Output in JSON format

**Example:**

```bash
griffin hub plan
griffin hub plan production
griffin hub plan staging --json
```

**Exit codes:**

- `0` - No changes
- `1` - Error
- `2` - Changes pending

#### `griffin hub apply [env]`

Apply changes to the hub. Environment can be specified as a positional argument, or uses the default environment if omitted.

**Options:**

- `--auto-approve` - Skip confirmation prompt
- `--dry-run` - Show what would be done without making changes
- `--prune` - Delete plans on hub that don't exist locally

**Example:**

```bash
griffin hub apply
griffin hub apply production --auto-approve
griffin hub apply staging --dry-run
griffin hub apply production --prune
```

#### `griffin hub run <env>`

Trigger a plan run on the hub in the specified environment.

**Options:**

- `--plan <name>` - Plan name to run (required)
- `--wait` - Wait for run to complete
- `--force` - Run even if local plan differs from hub

**Example:**

```bash
griffin hub run production --plan health-check
griffin hub run staging --plan health-check --wait
griffin hub run production --plan api-check --force
```


## Configuration

### Environment Variables

- `GRIFFIN_ENV` - Default environment to use for commands

### State File

Griffin stores configuration in `.griffin/state.json`:

```json
{
  "stateVersion": 1,
  "projectId": "my-project",
  "environments": {
    "local": {}
  },
  "defaultEnvironment": "local",
  "runner": {
    "baseUrl": "https://hub.example.com",
    "apiToken": "..."
  },
  "discovery": {
    "pattern": "**/__griffin__/*.{ts,js}",
    "ignore": ["node_modules/**", "dist/**"]
  }
}
```

**Important:** Add `.griffin/` to `.gitignore` as it contains local state and potentially sensitive tokens.

## Environments and Variables

Griffin uses environments to organize test configurations. Each environment maps to a section in `variables.yaml` which contains environment-specific variable values.

**Example `variables.yaml`:**

```yaml
environments:
  local:
    api_host: "localhost:3000"
    api_key: "local-test-key"
  staging:
    api_host: "staging.example.com"
    api_key: "staging-key"
  production:
    api_host: "api.example.com"
    api_key: "prod-key"
```

**Example workflow:**

```bash
# List available environments
griffin env list

# Run tests against different environments
griffin local run local
griffin local run staging

# Sync to hub for specific environment
griffin hub apply production
```

## Test Plan Discovery

By default, Griffin discovers test plans from files in `__griffin__/` directories matching `**/__griffin__/*.{ts,js}`.

Test files should be TypeScript or JavaScript files that export test plan objects.

## Diff Rules

Griffin computes changes using:

- **CREATE**: Plan exists locally but not in state
- **UPDATE**: Plan exists in both, but hash differs
- **DELETE**: Plan exists in state but not locally
- **NOOP**: Plan exists in both with same hash

Change detection uses a SHA-256 hash of the normalized plan payload.

## Hub API Compatibility

Griffin CLI is compatible with Griffin Hub API v1.

Required endpoints:

- `POST /plan` - Create/update plan
- `GET /plan` - List plans
- `GET /runs` - List runs
- `GET /runs/:id` - Get run details
- `POST /runs/trigger/:planId` - Trigger run

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev -- <command>

# Example
npm run dev -- validate
```

## Architecture

```
griffin-cli/
├── src/
│   ├── commands/           # Command implementations
│   │   ├── local/          # Local execution commands
│   │   │   └── run.ts
│   │   ├── hub/            # Hub operation commands
│   │   │   ├── connect.ts
│   │   │   ├── status.ts
│   │   │   ├── runs.ts
│   │   │   ├── plan.ts
│   │   │   ├── apply.ts
│   │   │   └── run.ts
│   │   ├── env.ts          # Environment commands
│   │   ├── init.ts
│   │   ├── validate.ts
│   │   └── generate-key.ts
│   ├── core/              # Core logic
│   │   ├── sdk.ts         # Hub SDK client
│   │   ├── apply.ts       # Apply engine
│   │   ├── diff.ts        # Diff computation
│   │   ├── discovery.ts   # Plan discovery
│   │   ├── state.ts       # State management
│   │   ├── variables.ts   # Variable resolution
│   │   └── project.ts     # Project detection
│   ├── schemas/           # Type definitions
│   │   └── state.ts       # State file schemas
│   ├── cli.ts             # CLI entry point
│   └── index.ts           # Public API exports
└── package.json
```

## License

MIT
