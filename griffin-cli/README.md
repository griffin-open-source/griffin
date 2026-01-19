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

### 2. Configure Targets

Add targets to your local environment:

```bash
griffin local config add-target --env local --key api --url http://localhost:3000
```

View configured environments:

```bash
griffin local config list
```

### 3. Create Test Plans

Create test files in `__griffin__/` directories. These files export test plans that can be run locally or synced to the hub.

### 4. Run Tests Locally

```bash
griffin local run --env local
```

Executes tests locally against configured targets.

### 5. Connect to Hub (Optional)

```bash
griffin hub connect --url https://hub.example.com --token <token>
```

### 6. Preview Hub Changes

```bash
griffin hub plan
```

Shows what will be created, updated, or deleted on the hub.

### 7. Apply to Hub

```bash
griffin hub apply
```

Syncs plans to the hub.

### 8. Trigger Hub Run

```bash
griffin hub run --plan <name> --env production
```

Triggers a plan execution on the hub.

## Commands

Commands are organized into three groups:

- **Top-level**: Project initialization and utilities
- **local**: Local test execution and configuration
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

### Local Commands

#### `griffin local run`

Run tests locally against configured targets.

**Options:**

- `--env <name>` - Environment to run against (uses default if not specified)

**Example:**

```bash
griffin local run
griffin local run --env staging
```

#### `griffin local config list`

List all local environments and their targets.

**Example:**

```bash
griffin local config list
```

#### `griffin local config add-target`

Add a target to a local environment.

**Options:**

- `--env <name>` - Environment name (required)
- `--key <key>` - Target key (required)
- `--url <url>` - Target URL (required)

**Example:**

```bash
griffin local config add-target --env local --key api --url http://localhost:3000
griffin local config add-target --env staging --key billing --url http://localhost:3001
```

#### `griffin local config remove-target`

Remove a target from a local environment.

**Options:**

- `--env <name>` - Environment name (required)
- `--key <key>` - Target key (required)

**Example:**

```bash
griffin local config remove-target --env local --key api
```

#### `griffin local config set-default-env`

Set the default environment for local runs.

**Options:**

- `--env <name>` - Environment name (required)

**Example:**

```bash
griffin local config set-default-env --env local
```

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

#### `griffin hub plan`

Show what changes would be applied to the hub.

**Options:**

- `--env <name>` - Environment to plan for (uses default if not specified)
- `--json` - Output in JSON format

**Example:**

```bash
griffin hub plan
griffin hub plan --env production --json
```

**Exit codes:**

- `0` - No changes
- `1` - Error
- `2` - Changes pending

#### `griffin hub apply`

Apply changes to the hub.

**Options:**

- `--env <name>` - Environment to apply to (uses default if not specified)
- `--auto-approve` - Skip confirmation prompt
- `--dry-run` - Show what would be done without making changes

**Example:**

```bash
griffin hub apply
griffin hub apply --env production --auto-approve
griffin hub apply --dry-run
```

#### `griffin hub run`

Trigger a plan run on the hub.

**Options:**

- `--plan <name>` - Plan name to run (required)
- `--env <name>` - Target environment (required)
- `--wait` - Wait for run to complete

**Example:**

```bash
griffin hub run --plan health-check --env production
griffin hub run --plan health-check --env staging --wait
```

#### `griffin hub config list`

List all hub target configurations.

**Options:**

- `--org <id>` - Filter by organization ID
- `--env <name>` - Filter by environment name

**Example:**

```bash
griffin hub config list
griffin hub config list --org acme --env production
```

#### `griffin hub config add-target`

Add a target to hub configuration.

**Options:**

- `--org <id>` - Organization ID (required)
- `--env <name>` - Environment name (required)
- `--key <key>` - Target key (required)
- `--url <url>` - Target URL (required)

**Example:**

```bash
griffin hub config add-target --org acme --env production --key api --url https://api.example.com
```

#### `griffin hub config remove-target`

Remove a target from hub configuration.

**Options:**

- `--org <id>` - Organization ID (required)
- `--env <name>` - Environment name (required)
- `--key <key>` - Target key (required)

**Example:**

```bash
griffin hub config remove-target --org acme --env production --key api
```

## Configuration

### Environment Variables

- `GRIFFIN_ENV` - Default environment to use for commands

### State File

Griffin stores configuration in `.griffin/state.json`:

```json
{
  "stateVersion": 3,
  "projectId": "my-project",
  "environments": {
    "local": {
      "targets": {
        "api": "http://localhost:3000",
        "billing": "http://localhost:3001"
      }
    }
  },
  "defaultEnvironment": "local",
  "runner": {
    "baseUrl": "https://hub.example.com",
    "apiToken": "..."
  },
  "discovery": {
    "pattern": "**/__griffin__/*.{ts,js}",
    "ignore": ["node_modules/**", "dist/**"]
  },
  "plans": {
    "local": []
  }
}
```

**Important:** Add `.griffin/` to `.gitignore` as it contains local state and potentially sensitive tokens.

## Environments and Targets

Griffin uses environments to organize target configurations. Each environment contains multiple named targets (key-value pairs of target keys to URLs).

**Local environments:**

- Defined in `.griffin/state.json`
- Used for local test execution
- Managed via `griffin local config` commands

**Example workflow:**

```bash
# Create local environment with targets
griffin local config add-target --env local --key api --url http://localhost:3000
griffin local config add-target --env local --key billing --url http://localhost:3001

# Set default environment
griffin local config set-default-env --env local

# Run tests using default environment
griffin local run
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
- `POST /runs/trigger/:id` - Trigger run
- `GET /config` - List configurations
- `PUT /config/:org/:env/targets/:key` - Set target
- `DELETE /config/:org/:env/targets/:key` - Delete target

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
│   │   │   ├── run.ts
│   │   │   └── config.ts
│   │   ├── hub/            # Hub operation commands
│   │   │   ├── connect.ts
│   │   │   ├── status.ts
│   │   │   ├── runs.ts
│   │   │   ├── plan.ts
│   │   │   ├── apply.ts
│   │   │   ├── run.ts
│   │   │   └── config.ts
│   │   ├── init.ts
│   │   ├── validate.ts
│   │   └── generate-key.ts
│   ├── core/              # Core logic
│   │   ├── sdk.ts         # Hub SDK client
│   │   ├── apply.ts       # Apply engine
│   │   ├── diff.ts        # Diff computation
│   │   ├── discovery.ts   # Plan discovery
│   │   ├── state.ts       # State management
│   │   └── project.ts     # Project detection
│   ├── schemas/           # Type definitions
│   │   ├── payload.ts     # Plan payload schemas
│   │   └── state.ts       # State file schemas
│   ├── cli.ts             # CLI entry point
│   └── index.ts           # Public API exports
└── package.json
```

## License

MIT
