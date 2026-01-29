# Griffin CLI

Command-line interface for managing API monitoring tests as code.

## Overview

Griffin CLI enables monitoring-as-code with support for both local test execution and hub-based orchestration. It provides a declarative workflow:

1. Write test monitors in TypeScript/JavaScript
2. Run tests locally against configured targets
3. Preview changes with `griffin hub monitor`
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
- Synced monitor state
- Hub connection settings (optional)

Override project ID with `--project <name>`.

### 2. View Environments

View configured environments:

```bash
griffin env list
```

### 3. Create Test Monitors

Create test files in `__griffin__/` directories. These files export test monitors that can be run locally or synced to the hub.

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
griffin hub monitor
griffin hub monitor production
```

Shows what will be created, updated, or deleted on the hub for the specified environment.

### 7. Apply to Hub

```bash
griffin hub apply
griffin hub apply production
```

Syncs monitors to the hub for the specified environment.

### 8. Trigger Hub Run

```bash
griffin hub run production --monitor <name>
```

Triggers a monitor execution on the hub in the specified environment.

## Commands

Commands are organized into four groups:

- **Top-level**: Project initialization and utilities
- **env**: Environment management
- **local**: Local test execution
- **hub**: Hub operations (monitor sync, remote execution)

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

Validate test monitor files without syncing.

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

Shows all configured environments with an asterisk (\*) marking the default environment.

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

Configure hub connection settings. When a token is provided, it is stored in the user-level credentials file (`~/.griffin/credentials.json`) for secure, cross-project authentication.

**Options:**

- `--url <url>` - Hub URL (required)
- `--token <token>` - API authentication token (optional)

**Example:**

```bash
griffin hub connect --url https://hub.example.com --token abc123
```

#### `griffin hub login`

Authenticate with the hub using device authorization flow. The received token is stored in the user-level credentials file (`~/.griffin/credentials.json`) for secure access across all projects.

**Example:**

```bash
griffin hub login
```

After running this command, you'll be provided with a URL to complete authentication in your browser. Once authenticated, the token will be automatically saved.

#### `griffin hub logout`

Remove stored credentials for the currently configured hub or all hubs.

**Options:**

- `--all` - Remove credentials for all hubs

**Example:**

```bash
griffin hub logout
griffin hub logout --all
```

#### `griffin hub status`

Show hub connection status, including whether credentials are configured.

**Example:**

```bash
griffin hub status
```

#### `griffin hub runs`

Show recent runs from the hub.

**Options:**

- `--monitor <name>` - Filter by monitor name
- `--limit <number>` - Number of runs to show (default: 10)

**Example:**

```bash
griffin hub runs
griffin hub runs --monitor health-check --limit 5
```

#### `griffin hub monitor [env]`

Show what changes would be applied to the hub. Environment can be specified as a positional argument, or uses the default environment if omitted.

**Options:**

- `--json` - Output in JSON format

**Example:**

```bash
griffin hub monitor
griffin hub monitor production
griffin hub monitor staging --json
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
- `--prune` - Delete monitors on hub that don't exist locally

**Example:**

```bash
griffin hub apply
griffin hub apply production --auto-approve
griffin hub apply staging --dry-run
griffin hub apply production --prune
```

#### `griffin hub run <env>`

Trigger a monitor run on the hub in the specified environment.

**Options:**

- `--monitor <name>` - Monitor name to run (required)
- `--wait` - Wait for run to complete
- `--force` - Run even if local monitor differs from hub

**Example:**

```bash
griffin hub run production --monitor health-check
griffin hub run staging --monitor health-check --wait
griffin hub run production --monitor api-check --force
```

## Configuration

### Environment Variables

- `GRIFFIN_ENV` - Default environment to use for commands

### State File

Griffin stores project configuration in `.griffin/state.json`:

```json
{
  "stateVersion": 1,
  "projectId": "my-project",
  "environments": {
    "local": {}
  },
  "defaultEnvironment": "local",
  "hub": {
    "baseUrl": "https://hub.example.com",
    "clientId": "..."
  },
  "discovery": {
    "pattern": "**/__griffin__/*.{ts,js}",
    "ignore": ["node_modules/**", "dist/**"]
  }
}
```

**Important:** Add `.griffin/` to `.gitignore` as it contains local project state.

### Credentials File

Griffin stores user-level authentication credentials in `~/.griffin/credentials.json`:

```json
{
  "version": 1,
  "hubs": {
    "https://hub.example.com": {
      "token": "...",
      "updatedAt": "2024-01-24T12:00:00.000Z"
    }
  }
}
```

This file is automatically created and managed by the CLI when you use `griffin hub login` or `griffin hub connect --token <token>`. Credentials are stored per-hub URL and are available across all projects on your system.

**Security:** The credentials file is created with restricted permissions (0600) to ensure only the owner can read/write.

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

## Test Monitor Discovery

By default, Griffin discovers test monitors from files in `__griffin__/` directories matching `**/__griffin__/*.{ts,js}`.

Test files should be TypeScript or JavaScript files that export test monitor objects.

## Diff Rules

Griffin computes changes using:

- **CREATE**: Monitor exists locally but not in state
- **UPDATE**: Monitor exists in both, but hash differs
- **DELETE**: Monitor exists in state but not locally
- **NOOP**: Monitor exists in both with same hash

Change detection uses a SHA-256 hash of the normalized monitor payload.

## Hub API Compatibility

Griffin CLI is compatible with Griffin Hub API v1.

Required endpoints:

- `POST /monitor` - Create/update monitor
- `GET /monitor` - List monitors
- `GET /runs` - List runs
- `GET /runs/:id` - Get run details
- `POST /runs/trigger/:monitorId` - Trigger run

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
│   │   │   ├── monitor.ts
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
│   │   ├── discovery.ts   # Monitor discovery
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
