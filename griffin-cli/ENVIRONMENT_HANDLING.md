# Environment Handling Design

## Problem Statement

Griffin tests use symbolic target references via `target("key")` to allow the same test code to run against different environments (local, staging, production). However, we need to support two conflicting requirements:

1. **Team collaboration**: Runner stores environment configs (org/env → target mappings) as the operational source of truth
2. **Local development**: Developers need to test locally without a runner, and without interfering with production configs

The challenge: How do we allow local environment configuration while ensuring it interacts sanely with runner-based environments?

---

## Design Principles

1. **Runner is the operational source of truth** for team/shared environments
2. **`run` never modifies the runner** - it's a read-only consumer
3. **Local state supports standalone targets** for pure local development
4. **Overrides are explicit and local-only** - no accidental production changes
5. **Clear command semantics** - execution location and config source are obvious
6. **Convention over configuration** - sensible defaults to minimize setup

---

## Mental Model

### Environment Types

**1. Local-only environments**

- Defined entirely in `.griffin/state.json`
- No runner connection required
- Used for pure local development

**2. Runner-backed environments**

- Source of truth lives on the runner
- CLI can fetch and use them for local execution
- CLI never modifies runner config through these environments

**3. Runner-backed with local overrides**

- Fetches target config from runner
- Applies developer-specific overrides for local testing
- Allows testing "staging with my local billing-service"

---

## State File Schema

### Current Schema (v2)

```typescript
{
  "environments": {
    "local": {
      "baseUrl": "http://localhost:3000"  // Single URL per environment
    }
  }
}
```

### New Schema (v3)

```typescript
export const EnvironmentConfigSchema = Type.Object({
  // For local-only environments: explicit target mappings
  targets: Type.Optional(Type.Record(Type.String(), Type.String())),

  // For runner-backed environments: indicates config lives on runner
  source: Type.Optional(Type.Literal("runner")),

  // Local overrides applied when running locally against runner envs
  overrides: Type.Optional(Type.Record(Type.String(), Type.String())),
});

export const StateFileSchema = Type.Object({
  stateVersion: Type.Literal(3), // Increment version
  projectId: Type.String(),

  environments: Type.Record(Type.String(), EnvironmentConfigSchema),
  defaultEnvironment: Type.Optional(Type.String()),

  runner: Type.Optional(RunnerConfigSchema),
  discovery: Type.Optional(DiscoveryConfigSchema),
  plans: Type.Record(Type.String(), Type.Array(PlanStateEntrySchema)),
});
```

### Example State File (Created by `griffin init`)

```json
{
  "stateVersion": 3,
  "projectId": "my-project",
  "environments": {
    "local": {
      "targets": {}
    },
    "staging": {
      "source": "runner"
    },
    "production": {
      "source": "runner"
    }
  },
  "defaultEnvironment": "local",
  "plans": {
    "local": [],
    "staging": [],
    "production": []
  }
}
```

**Notes:**

- `init` creates three standard environments: `local`, `staging`, `production`
- `local` starts with empty targets - users add them as needed
- `staging` and `production` are runner-backed (requires runner configuration)
- Default environment is `local` for immediate local testing

### Example with User Configuration

```json
{
  "stateVersion": 3,
  "projectId": "my-project",
  "environments": {
    "local": {
      "targets": {
        "sample-api": "http://localhost:3000",
        "billing-service": "http://localhost:3001"
      }
    },
    "staging": {
      "source": "runner",
      "overrides": {
        "billing-service": "http://localhost:3001"
      }
    },
    "production": {
      "source": "runner"
    }
  },
  "defaultEnvironment": "local",
  "runner": {
    "baseUrl": "https://runner.example.com",
    "apiToken": "..."
  },
  "plans": {
    "local": [],
    "staging": [],
    "production": []
  }
}
```

---

## Target Resolution Logic

### For `run --env <name>`

```
1. Load environment config from state file
2. If config has `source: "runner"`:
   a. Fetch target mappings from runner's <name> environment
   b. Apply local `overrides` on top
3. Else:
   a. Use local `targets` directly
4. For each target reference in test plan:
   a. Resolve to base URL using merged config
   b. Error if target not found
5. Execute tests locally using resolved URLs
```

### For `run --from <env>`

```
1. Fetch target mappings from runner's <env>
2. Apply CLI flag overrides (--override key=url)
3. Execute tests locally
4. Do not save anything to state file
```

### For `run-remote --plan-name <name> --target-env <target>`

```
1. Trigger remote execution on runner
2. Runner resolves targets using its own config for <target>
3. CLI polls for results
4. Local state not involved in target resolution
```

---

## Command Reference

### Local Execution Commands

| Command                                                           | Config Source                | Modifies Runner? | Use Case                               |
| ----------------------------------------------------------------- | ---------------------------- | ---------------- | -------------------------------------- |
| `griffin run`                                                     | Default local env from state | No               | Quick local testing                    |
| `griffin run --env local`                                         | Local `targets`              | No               | Explicit local dev                     |
| `griffin run --env staging`                                       | Runner + local overrides     | No               | Test against staging with local tweaks |
| `griffin run --from staging`                                      | Runner (fresh fetch)         | No               | One-off test against staging targets   |
| `griffin run --from staging --override api=http://localhost:8080` | Runner + CLI overrides       | No               | Quick override without state changes   |

### Remote Execution Commands

| Command                                                                                       | Config Source           | Modifies Runner? | Use Case                        |
| --------------------------------------------------------------------------------------------- | ----------------------- | ---------------- | ------------------------------- |
| `griffin run-remote --plan-name health --target-env staging`                                  | Runner's staging config | No               | Trigger scheduled run           |
| `griffin config set --org acme --env staging --target api --base-url https://api.staging.com` | N/A                     | **Yes**          | Update runner config (explicit) |

### Environment Target Management

Manage targets within the three standard environments (local/staging/production):

```bash
# Add a target to local environment
griffin env add-target local sample-api http://localhost:3000

# Add multiple targets
griffin env add-target local billing-service http://localhost:3001

# Add local override to runner-backed environment (staging/production)
griffin env set-override staging billing-service http://localhost:3001

# Remove override
griffin env remove-override staging billing-service

# List all environments and their configuration
griffin env list

# Show specific environment details
griffin env show local
```

---

## Initial Setup: `griffin init`

The `init` command creates a state file with three pre-configured environments:

```bash
griffin init

✓ Initialized griffin project: my-project
✓ Created .griffin/state.json

Environments configured:
  * local (default) - For local development

  staging - Requires runner configuration
  production - Requires runner configuration

Next steps:
  1. Add local targets:
     griffin env add-target local my-api http://localhost:3000

  2. Create your first test in __griffin__/

  3. Run tests locally:
     griffin run

  4. (Optional) Configure runner for staging/production:
     griffin runner set --base-url <url> --api-token <token>
```

### Managing Targets

**Add targets to local environment:**

```bash
griffin env add-target local sample-api http://localhost:3000
griffin env add-target local billing-service http://localhost:3001
```

**Add local overrides for runner-backed environments:**

```bash
# Override staging's billing-service to point to local
griffin env set-override staging billing-service http://localhost:3001

# Remove override when done
griffin env remove-override staging billing-service
```

**View configuration:**

```bash
# List all environments
griffin env list

# Show specific environment
griffin env show local
```

---

## Edge Cases & Error Handling

### Missing Target References

```bash
# Test uses target("billing-service") but it's not configured
Error: Target "billing-service" not found in environment "local"

Available targets:
  - sample-api: http://localhost:3000

Add it with:
  griffin env add-target local billing-service <url>
```

### Runner Connection Failures

```bash
# Environment is runner-backed but runner is unreachable
griffin run --env staging

Warning: Failed to fetch targets from runner (connection refused)
Falling back to local overrides only.

Override targets:
  - billing-service: http://localhost:3001

If this is not what you want, check runner connection with:
  griffin runner check
```

### Conflicting Commands

```bash
# Trying to add targets to a runner-backed environment
griffin env add-target staging api-gateway http://localhost:8080

Error: Environment "staging" is backed by runner (source: "runner")
Use overrides for local testing:
  griffin env set-override staging api-gateway http://localhost:8080

Or create a separate local environment:
  griffin env add staging-local --target api-gateway=http://localhost:8080
```

---

## Security Considerations

1. **Runner API tokens** in state file should be stored securely
   - State file is in `.gitignore` by default
   - Consider environment variable fallback: `GRIFFIN_RUNNER_TOKEN`

2. **Target URLs** may contain sensitive information
   - Document that state file should not be committed
   - Consider a `.griffin/state.local.json` pattern for overrides

3. **Runner config mutations** only via explicit `config set` command
   - Never implicit writes during `run`
   - Require confirmation for production environment changes

---

## Future Enhancements

### 1. Custom Environments

Add ability to create custom environments beyond the default three:

```bash
# Create new environments
griffin env add qa --from-runner
griffin env add local-debug --clone local

# Delete custom environments
griffin env delete qa
```

**Note:** The standard three environments (local/staging/production) cannot be deleted.

### 2. Target Groups

For complex microservices architectures:

```json
{
  "environments": {
    "local": {
      "targetGroups": {
        "core-services": {
          "api-gateway": "http://localhost:8000",
          "auth-service": "http://localhost:8001"
        },
        "data-services": {
          "user-db": "http://localhost:5432",
          "cache": "http://localhost:6379"
        }
      }
    }
  }
}
```

### 3. Environment Inheritance

```json
{
  "environments": {
    "staging": {
      "source": "runner"
    },
    "staging-local": {
      "inherits": "staging",
      "overrides": {
        "billing-service": "http://localhost:3001"
      }
    }
  }
}
```

### 4. Dynamic Target Resolution

Support environment variable interpolation:

```json
{
  "targets": {
    "sample-api": "http://localhost:${PORT:-3000}"
  }
}
```

### 5. Runner Target Sync

Optional command to sync runner config to local state for offline use:

```bash
griffin env sync staging
# Fetches runner's staging targets and caches locally
```

### 6. Shared Environment Configs

Allow teams to share base environment configurations:

```bash
# .griffin/environments/shared.json
{
  "local": {
    "targets": {
      "api-gateway": "http://localhost:8000",
      "auth-service": "http://localhost:8001"
    }
  }
}

# Can be committed to git, merged with personal state.json
```

---

## FAQ

**Q: What happens if I use `run` without any environments configured?**

A: The CLI will prompt you to run `griffin init` or `griffin env add local` to create your first environment.

**Q: Can I use the same state file with multiple runner instances?**

A: No, the state file references a single runner. For multiple runners, use separate project directories or a project-specific runner field.

**Q: How do I test a PR that changes a service?**

A: Use `run --from staging --override my-service=http://localhost:8080` to test against staging's config with your local version of one service.

**Q: What's the difference between `run --env staging` and `run --from staging`?**

A: `--env staging` uses the environment configuration saved in your state file (including any persistent overrides). `--from staging` fetches fresh from the runner and doesn't save anything.

**Q: Can I share my local environment config with my team?**

A: The state file (`.griffin/state.json`) can be committed to share the standard three environments (local/staging/production). Local target URLs and overrides are typically developer-specific. For team environments, use the runner as the source of truth.

**Q: Can I add more environments beyond local/staging/production?**

A: Not in the initial version. We're starting with three standard environments to keep things simple. You can manage targets within these environments, but can't create new environments. Future versions will add the ability to create custom environments.

---

## Summary

This design maintains a clear separation:

- **Runner** = operational source of truth for team environments
- **Local state** = personal development configuration
- **`run`** = local execution, never modifies runner
- **`run-remote`** = remote execution, uses runner's config
- **Overrides** = explicit and local-only
- **Standard environments** = convention over configuration (local/staging/production)

The result is a system where:

1. Developers get started quickly with sensible defaults
2. Local experimentation doesn't interfere with production
3. Teams have a shared source of truth via the runner
4. The learning curve is minimal - just edit the state file to add targets
