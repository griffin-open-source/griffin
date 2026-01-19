# Griffin Hub/Agent Architecture

**Status:** In Progress - Phase 2 Complete ✅  
**Date:** 2026-01-18  
**Updated:** 2026-01-18  
**Context:** Refactoring griffin-runner to support distributed execution with location-based routing

**Implementation Progress:**
- ✅ Phase 1: Schema & Data Model (Complete)
- ✅ Phase 2: Hub - Agent Registry (Complete)
- ⏳ Phase 3: Hub - Scheduler Updates (Pending)
- ⏳ Phase 4: Agent Package (Complete - merged with Phase 2)
- ⏳ Phase 5: Combined Mode (Pending)
- ⏳ Phase 6: DSL & CLI (Pending)
- ⏳ Phase 7: Testing & Polish (Pending)

---

## Executive Summary

This document outlines the architectural evolution of Griffin from a monolithic runner service to a distributed hub-and-agent model. This change enables:

- **Multi-location execution**: Run tests from multiple geographic regions, network zones, or on-premises locations
- **Flexible deployment**: Deploy agents as persistent services, Lambda functions, or on-demand processes
- **Simple dev experience**: Maintain an easy-to-deploy combined mode for local development

---

## Terminology

### Current (griffin-runner)
- Combines control plane (scheduling, API) and execution (worker) in a single service
- Worker consumes jobs and executes plans using griffin-plan-executor

### New Model

| Component | Description | Former Name |
|-----------|-------------|-------------|
| **Hub** | Control plane service managing plans, schedules, runs, and agent registry | "Orchestrator" or "Server" |
| **Agent** | Execution component that runs in a specific location and consumes execution jobs | "Executor" or "Worker" |
| **Combined Mode** | Hub + Agent colocated in a single process for simple deployments | "griffin-runner" |

**Why "Hub/Agent"?**
- Clear mental model (centralized hub, distributed agents)
- Common in monitoring/observability tools (familiar to operators)
- Avoids confusion with existing "worker" and "executor" terms in the codebase
- Works well for both technical and marketing contexts

---

## Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             griffin-hub                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────────┐   │
│  │ API Routes    │  │ Scheduler     │  │ Agent Registry             │   │
│  │ /plan         │  │ Service       │  │ - register/heartbeat       │   │
│  │ /runs         │  │               │  │ - location tracking        │   │
│  │ /config       │  │               │  │ - health monitoring        │   │
│  │ /agents       │◄─┤               │  │                            │   │
│  └───────────────┘  └───────────────┘  └────────────────────────────┘   │
│                            │                                             │
│  ┌─────────────────────────▼──────────────────────────────────────────┐  │
│  │                    JobQueueBackend                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│  │  │ Postgres     │  │ SQS          │  │ Redis        │             │  │
│  │  │ (default)    │  │ (AWS)        │  │ (optional)   │             │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
         │                              │                        │
         │ queue: us-east-1             │ queue: eu-west-1       │ queue: on-prem
         ▼                              ▼                        ▼
┌──────────────────┐           ┌──────────────────┐     ┌──────────────────┐
│  griffin-agent   │           │  griffin-agent   │     │  griffin-agent   │
│  location:       │           │  location:       │     │  location:       │
│  us-east-1       │           │  eu-west-1       │     │  on-prem         │
│  (EC2/ECS/Lambda)│           │  (EC2/ECS/Lambda)│     │  (VM/container)  │
└──────────────────┘           └──────────────────┘     └──────────────────┘
```

### Combined Mode (Development/Simple Deployments)

```
┌────────────────────────────────────────────────────────────────────┐
│                    griffin-runner (combined)                        │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐   │
│  │      griffin-hub         │  │      griffin-agent           │   │
│  │  (scheduler, API)        │  │  (worker, location: local)   │   │
│  └────────────┬─────────────┘  └─────────────┬────────────────┘   │
│               │                              │                    │
│  ┌────────────▼──────────────────────────────▼─────────────────┐  │
│  │            Postgres (Repository + JobQueue)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │    PostgreSQL    │
                    └──────────────────┘
```

---

## Key Concepts

### 1. Locations

**Location** is the primary routing dimension for test execution. A location represents where an agent runs and can mean:

- Geographic region (e.g., `us-east-1`, `eu-west-1`, `ap-southeast-1`)
- Network zone (e.g., `internal`, `dmz`, `external`)
- Logical environment (e.g., `prod-vpc`, `staging-vpc`)
- Custom deployment (e.g., `on-prem-datacenter-a`, `customer-vpc-acme`)

**Key Decisions:**
- Locations are simple string identifiers (no hierarchy or special meaning)
- All agents at a location are assumed to have equal capabilities
- Plans can target specific locations or all locations (default)

### 2. Multi-Location Execution

**Default Behavior:**  
Tests run from **ALL registered agent locations** unless explicitly restricted.

```typescript
import { createTestBuilder, GET, Json, Frequency, target } from "griffin-ts";

// Runs from ALL registered locations (default)
const globalHealthCheck = createTestBuilder({
  name: "global-api-health",
  frequency: Frequency.every(5).minutes(),
})
  .request("health", {
    method: GET,
    base: target("api-gateway"),
    path: "/health",
    response_format: Json,
  })
  .build();
```

**Targeted Execution:**  
Tests can specify specific locations.

```typescript
// Runs from specific locations only
const regionalCheck = createTestBuilder({
  name: "us-api-health",
  frequency: Frequency.every(1).minute(),
  locations: ["us-east-1", "us-west-2"],  // NEW: locations field
})
  .request("health", {
    method: GET,
    base: target("api-gateway"),
    path: "/health",
    response_format: Json,
  })
  .build();
```

**Simultaneous Multi-Location:**  
When a plan targets multiple locations, it executes from all of them simultaneously.

```typescript
// Runs from 3 locations at the same time
const latencyTest = createTestBuilder({
  name: "global-latency-check",
  frequency: Frequency.every(10).minutes(),
  locations: ["us-east-1", "eu-west-1", "ap-southeast-1"],
})
  .request("ping", {
    method: GET,
    base: target("api-gateway"),
    path: "/ping",
    response_format: Json,
  })
  .build();
```

### 3. Execution Groups

When a plan executes from multiple locations, all resulting JobRuns share an **executionGroupId** for correlation.

```
Scheduled at: 2026-01-18T10:00:00Z
Plan: "global-latency-check" (locations: ["us-east-1", "eu-west-1"])
executionGroupId: "550e8400-e29b-41d4-a716-446655440000"

Created JobRuns:
  - id: "job-1", location: "us-east-1", status: "completed", executionGroupId: "550e..."
  - id: "job-2", location: "eu-west-1", status: "completed", executionGroupId: "550e..."
```

This allows queries like:
- "Show me all runs from execution group X"
- "Did all locations pass for this execution?"
- "What was the latency distribution across locations?"

---

## Data Model

### Agent Registry

```typescript
interface Agent {
  id: string;                      // Unique agent identifier
  location: string;                // Location identifier (e.g., "us-east-1")
  status: "online" | "offline";    // Current health status
  lastHeartbeat: Date;             // Last heartbeat timestamp
  registeredAt: Date;              // Initial registration time
  metadata?: Record<string, string>; // Optional labels for display/filtering
}
```

**Agent Lifecycle:**
1. Agent starts up and registers with hub via `POST /agents/register`
2. Agent sends periodic heartbeats via `POST /agents/:id/heartbeat`
3. Hub marks agents offline if heartbeat exceeds threshold (e.g., 60 seconds)
4. Agent can explicitly deregister via `DELETE /agents/:id` on shutdown

### TestPlanV1 (Updated)

```typescript
interface TestPlanV1 {
  id: string;
  name: string;
  organization?: string;
  environment?: string;
  // ... existing fields ...
  locations?: string[];  // NEW: undefined = all locations
  frequency?: Frequency;
  nodes: Node[];
  edges: Edge[];
}
```

### JobRun (Updated)

```typescript
interface JobRun {
  id: string;
  planId: string;
  executionGroupId: string;   // NEW: groups runs from same trigger
  location: string;            // NEW: which location this run is for
  environment: string;
  status: JobRunStatus;
  triggeredBy: TriggerType;
  startedAt: string;
  completedAt?: string;
  duration_ms?: number;
  success?: boolean;
  errors?: string[];
}
```

### Job Queue (Updated)

The JobQueueBackend abstraction already exists. We extend it to support location-based filtering.

```typescript
interface Job<T> {
  id: string;
  data: T;
  location: string;  // NEW: routing dimension
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  priority: number;
  scheduledFor: Date;
  // ... other fields ...
}

interface ExecutionJobData {
  type: "execute-plan";
  planId: string;
  jobRunId: string;
  environment: string;
  location: string;     // NEW: which location this job targets
  plan: TestPlanV1;     // Full plan included in job for agent self-sufficiency
  scheduledAt: string;
}
```

**Queue Partitioning:**

Agents filter jobs by their location when dequeueing:

```sql
-- Postgres backend dequeue with location filtering
UPDATE jobs 
SET status = 'running', started_at = NOW()
WHERE id = (
  SELECT id FROM jobs 
  WHERE queue_name = 'plan-executions'
    AND location = $1              -- Agent's location
    AND status = 'pending' 
    AND scheduled_for <= NOW()
  ORDER BY priority DESC, scheduled_for ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

For SQS, this would be separate queues per location or message attributes with filtering.

---

## Scheduling & Execution Flow

### Scheduler Tick

```
1. Find due plans (scheduled plans where next_run <= NOW)

2. For each due plan:
   a. Determine target locations:
      - If plan.locations is defined → use those
      - If plan.locations is undefined → query all registered locations
   
   b. Validate locations:
      - Ensure all target locations have at least one online agent
      - Skip plan if no agents available (log warning)
   
   c. Generate executionGroupId (UUID)
   
   d. For each target location:
      - Create JobRun record:
        * planId, location, executionGroupId, environment, status=PENDING
      - Enqueue job to location's queue partition:
        * Include full plan in job data for agent self-sufficiency
        * Set location field for routing
        * Include jobRunId for result reporting

3. Update plan.last_run and plan.next_run timestamps
```

### Agent Execution Loop

```
1. On startup:
   - Register with hub: POST /agents/register { location, metadata }
   - Start heartbeat timer (e.g., every 30 seconds)

2. Worker loop:
   a. Dequeue job from queue (filtered by agent's location)
   b. If no job available → wait with exponential backoff
   c. If job received:
      - Update JobRun status to RUNNING
      - Execute plan using griffin-plan-executor
      - Update JobRun with results (status, duration, success, errors)
      - Acknowledge job in queue
      - Continue to next job

3. On shutdown:
   - Stop accepting new jobs
   - Wait for current job to complete
   - Deregister: DELETE /agents/:id
```

---

## Validation

### Plan Validation on Apply

When a plan is applied via CLI (`griffin apply`) or API (`POST /plan`), the hub validates location references:

```typescript
async function validatePlan(plan: TestPlanV1): Promise<ValidationResult> {
  const errors: string[] = [];
  
  // If plan specifies locations, ensure they're all registered
  if (plan.locations && plan.locations.length > 0) {
    const registeredLocations = await agentRegistry.getRegisteredLocations();
    
    for (const location of plan.locations) {
      if (!registeredLocations.includes(location)) {
        errors.push(
          `Location "${location}" is not registered. ` +
          `Available locations: ${registeredLocations.join(", ")}`
        );
      }
    }
  }
  
  // If no locations specified, ensure at least one agent exists
  if (!plan.locations || plan.locations.length === 0) {
    const registeredLocations = await agentRegistry.getRegisteredLocations();
    if (registeredLocations.length === 0) {
      errors.push(
        "No agent locations registered. " +
        "Register at least one agent before applying plans."
      );
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

**Error Behavior:**
- CLI rejects plan with clear error message listing available locations
- API returns 400 Bad Request with error details

### Runtime Handling

**If agent goes offline after plan is applied:**
- Scheduler detects no agents available for location
- Logs warning: "No agents available for location X, skipping plan Y"
- Does not create JobRun for that location
- Continues scheduling for other locations if multi-location plan

**This is acceptable because:**
- It's observable (logs, metrics)
- It's temporary (agent comes back → scheduling resumes)
- It doesn't fail silently (monitoring can alert on skipped plans)

---

## API Surface

### Agent Management Routes

```
POST   /agents/register
  Body: { location: string, metadata?: Record<string, string> }
  Response: { id: string, location: string, status: "online" }

POST   /agents/:id/heartbeat
  Response: { success: boolean }

DELETE /agents/:id
  Response: { success: boolean }

GET    /agents
  Query: ?location=<string>, ?status=<"online"|"offline">
  Response: { data: Agent[], total: number }

GET    /agents/locations
  Response: { locations: string[] }
```

### Updated Runs Routes

```
GET    /runs
  Query: ?planId=<string>, ?location=<string>, ?executionGroupId=<string>, 
         ?status=<status>, ?limit=<n>, ?offset=<n>
  Response: { data: JobRun[], total: number, page: number }

GET    /runs/:id
  Response: { data: JobRun }

GET    /runs/groups/:executionGroupId
  Response: { data: JobRun[], executionGroupId: string }

POST   /runs/trigger/:planId
  Body: { environment: string }
  Response: { 
    executionGroupId: string, 
    runs: JobRun[],  // One per location
    locations: string[] 
  }
```

---

## Package Structure

### Proposed Reorganization

```
griffin/
├── griffin-ts/              # DSL (unchanged)
├── griffin-plan-executor/   # Core execution library (unchanged)
├── griffin-hub/             # NEW: Control plane service
│   ├── src/
│   │   ├── routes/          # API endpoints (/plan, /runs, /agents, /config)
│   │   ├── scheduler/       # SchedulerService (finds due plans, enqueues jobs)
│   │   ├── registry/        # AgentRegistry (agent registration, health)
│   │   ├── storage/         # Repository & JobQueue backends
│   │   ├── config.ts        # Environment-based configuration
│   │   └── app.ts           # Fastify app setup
├── griffin-agent/           # NEW: Execution agent
│   ├── src/
│   │   ├── worker.ts        # Job consumption & plan execution
│   │   ├── registry.ts      # Registration & heartbeat logic
│   │   ├── adapters/        # Queue consumers (postgres, sqs, redis)
│   │   └── config.ts        # Agent-specific configuration
├── griffin-runner/          # NEW: Combined deployment
│   ├── src/
│   │   └── index.ts         # Imports hub + agent, wires together
│   └── docker/              # Dockerfile for easy deployment
├── griffin-cli/             # CLI (updated for location validation)
```

**Migration Notes:**
- Most code from `griffin-runner/src/` moves to `griffin-hub/src/`
- `griffin-runner/src/scheduler/worker.ts` becomes `griffin-agent/src/worker.ts`
- New `griffin-runner` package includes wiring of hub + agent

---

## DSL Changes

### Current DSL (Sequential Builder)

```typescript
import { createTestBuilder, GET, Json, Frequency, target } from "griffin-ts";

const plan = createTestBuilder({
  name: "example-check",
  frequency: Frequency.every(1).minute(),
})
  .request("health_check", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/health",
  })
  .build();
```

### Updated DSL with Locations

```typescript
import { createTestBuilder, GET, Json, Frequency, target } from "griffin-ts";

// Runs from all registered locations (default)
const globalPlan = createTestBuilder({
  name: "example-check",
  frequency: Frequency.every(1).minute(),
})
  .request("health_check", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/health",
  })
  .build();

// Runs from specific locations
const regionalPlan = createTestBuilder({
  name: "us-only-check",
  frequency: Frequency.every(1).minute(),
  locations: ["us-east-1", "us-west-2"],  // NEW
})
  .request("health_check", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/health",
  })
  .build();
```

### Schema Changes Required

**griffin-ts/src/types.ts:**

```typescript
export interface TestPlan {
  name: string;
  frequency?: Frequency;
  locations?: string[];  // NEW: undefined = all locations
  nodes: Node[];
  edges: Edge[];
}
```

**griffin-ts/src/builder.ts & sequential-builder.ts:**

```typescript
export function createTestBuilder(config: {
  name: string;
  frequency?: Frequency;
  locations?: string[];  // NEW
}): SequentialTestBuilder {
  return new SequentialTestBuilderImpl(config);
}

export function createGraphBuilder(config: {
  name: string;
  frequency?: Frequency;
  locations?: string[];  // NEW
}): TestBuilder {
  return new TestBuilderImpl(config);
}
```

---

## Deployment Modes

### Mode 1: Combined (Development/Simple Production)

**Use Case:** Local development, small deployments, simple production setups

**Deployment:**
```yaml
services:
  griffin-runner:
    image: griffin/runner:latest
    environment:
      DATABASE_URL: postgres://...
      SCHEDULER_ENABLED: true
      WORKER_ENABLED: true
      AGENT_LOCATION: local
    ports:
      - "3000:3000"
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: griffin
```

**Characteristics:**
- Single process runs both hub and agent
- Postgres serves as both repository and job queue
- Agent registers as location `"local"` (or configurable)
- Simple to deploy, minimal infrastructure

### Mode 2: Distributed (Production)

**Use Case:** Multi-region deployments, high availability, scale

**Hub Deployment:**
```yaml
services:
  griffin-hub:
    image: griffin/hub:latest
    environment:
      DATABASE_URL: postgres://...
      SCHEDULER_ENABLED: true
      WORKER_ENABLED: false  # No local agent
      JOBQUEUE_BACKEND: postgres  # or sqs, redis
    ports:
      - "3000:3000"
```

**Agent Deployment (per location):**
```yaml
# us-east-1 agent
services:
  griffin-agent-us-east-1:
    image: griffin/agent:latest
    environment:
      HUB_URL: https://griffin-hub.example.com
      AGENT_LOCATION: us-east-1
      JOBQUEUE_BACKEND: postgres
      DATABASE_URL: postgres://...  # Same DB as hub
    restart: always

# eu-west-1 agent
services:
  griffin-agent-eu-west-1:
    image: griffin/agent:latest
    environment:
      HUB_URL: https://griffin-hub.example.com
      AGENT_LOCATION: eu-west-1
      JOBQUEUE_BACKEND: postgres
      DATABASE_URL: postgres://...
    restart: always
```

### Mode 3: Serverless Agents (AWS Lambda)

**Use Case:** AWS-native deployments, auto-scaling agents

**Hub:** Standard deployment (ECS/Fargate/EC2)

**Agent:** Lambda function triggered by SQS

```typescript
// lambda-agent/handler.ts
import { executePlanV1, type TestPlanV1 } from "griffin-plan-executor";
import { AxiosAdapter } from "griffin-plan-executor";

export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    const job: ExecutionJobData = JSON.parse(record.body);
    
    // Execute the plan
    const result = await executePlanV1(job.plan, {
      mode: "remote",
      httpClient: new AxiosAdapter(),
      targetResolver: async (key) => {
        // Fetch target from hub API
        const response = await fetch(
          `${HUB_URL}/config/${job.environment}/targets/${key}`
        );
        return response.json();
      },
    });
    
    // Report results back to hub
    await fetch(`${HUB_URL}/runs/${job.jobRunId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: result.success ? "completed" : "failed",
        duration_ms: result.totalDuration_ms,
        errors: result.errors,
      }),
    });
  }
}
```

**Infrastructure:**
- Hub enqueues jobs to SQS queue per location
- Lambda functions subscribe to their location's queue
- No agent registration needed (serverless = ephemeral)
- Hub tracks execution via JobRun records

---

## Implementation Roadmap

### Phase 1: Schema & Data Model ✅ COMPLETE
- [x] Add `locations?: string[]` to TestPlan schema (griffin-ts)
- [x] Add `location` and `executionGroupId` to JobRun schema
- [x] Add `location` to Job schema in JobQueue interface
- [x] Create Agent schema and repository
- [x] Update Postgres migrations for new fields

**Implementation Notes:**
- Added `locations` field to TestPlan in `griffin-ts/src/types.ts`
- Updated both `createGraphBuilder()` and `createTestBuilder()` to accept locations config
- Added `executionGroupId` and `location` fields to JobRun schema
- Made `EnqueueOptions.location` required for job routing
- Created `Agent` schema with status, heartbeat tracking, and metadata
- Updated Postgres schema with new tables: `agentsTable`, `jobsTable`
- Added location and executionGroupId fields to `runsTable` and `plansTable`
- Updated memory job queue implementation to support location filtering
- Added temporary "local" default location in scheduler and runs routes (will be properly resolved in Phase 2)
- All packages build successfully with no linter errors

### Phase 2: Hub - Agent Registry ✅ COMPLETE
- [x] Implement AgentRegistry service
- [x] Add `/agents/*` API routes
- [x] Add heartbeat monitoring
- [x] Add location validation to plan apply

**Implementation Notes:**
- Created `AgentRegistry` service in `griffin-hub/src/services/agent-registry.ts`
- Implemented full agent lifecycle: register, heartbeat, deregister
- Added background monitoring to mark stale agents offline (configurable timeout)
- Added `/agents/register`, `/agents/:id/heartbeat`, `/agents/:id` (DELETE), `/agents` (GET), `/agents/locations` (GET) routes
- Plan creation now validates locations against registered agents
- Added `PATCH /runs/:id` route for agents to report execution results
- Added agent configuration to hub config schema (monitoring interval, heartbeat timeout)
- **Note:** Merged Phase 4 (Agent Package) implementation into Phase 2 for efficiency

### Phase 3: Hub - Scheduler Updates
- [ ] Update scheduler to resolve locations (plan.locations ?? allRegistered)
- [ ] Update scheduler to create N JobRuns per execution (one per location)
- [ ] Update scheduler to generate executionGroupId
- [ ] Update job enqueue to include location

### Phase 4: Agent Package ✅ COMPLETE (merged with Phase 2)
- [x] Extract WorkerService to griffin-agent package
- [x] Add agent registration on startup
- [x] Add heartbeat loop
- [x] Add graceful shutdown with deregistration
- [x] Update job dequeue to filter by location

**Implementation Notes:**
- Created new `griffin-agent` package with complete structure
- Implemented `AgentConfig` schema with environment variable loading
- Created queue consumer interface (`QueueConsumer`) for consuming jobs
- Implemented `PostgresQueueConsumer` using `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent consumption
- Created `HubClient` for HTTP communication with hub (registration, heartbeat, result reporting, config fetching)
- Rewrote `WorkerService` to use queue consumer and HTTP client (no direct DB access)
- Created main entry point (`src/index.ts`) with full lifecycle management
- Added graceful shutdown handling (completes current job, deregisters from hub)
- **Architecture Decision:** Agent is fully independent - only communicates with hub via HTTP API
- **Architecture Decision:** No shared package - types duplicated to avoid cross-dependencies
- **Architecture Decision:** Queue consumers belong in agent; hub only produces jobs
- Package builds successfully with proper TypeScript configuration
- Created comprehensive README with deployment examples (Docker, ECS, Kubernetes)

### Phase 5: Combined Mode
- [ ] Create griffin-runner package
- [ ] Wire hub + agent together
- [ ] Add Docker compose example
- [ ] Update documentation

### Phase 6: DSL & CLI
- [x] Update griffin-ts builders to accept locations config (Completed in Phase 1)
- [ ] Update griffin-cli apply command to validate locations
- [ ] Add CLI command to list agents/locations
- [ ] Update documentation with examples

### Phase 7: Testing & Polish
- [ ] Integration tests for multi-location execution
- [ ] Agent failover testing
- [ ] Load testing with multiple agents
- [ ] Documentation: deployment guides, examples
- [ ] Migration guide from griffin-runner

---

## Open Questions & Future Considerations

**Decision:** Start with queue-based random selection (simplest, built into Postgres SKIP LOCKED). Optimize later if needed.

### Cross-Location Assertions
**Question:** Can assertions compare results across locations?

**Example:** "Assert that us-east-1 latency < eu-west-1 latency"

**Current Approach:** No. Each location's run is independent.

**Future Enhancement:** Could support via:
- Aggregation node that waits for all location runs
- New assertion type that queries JobRuns via executionGroupId
- Post-execution analysis pipeline

**Decision:** Defer to future. Current model supports per-location pass/fail.

### Plan Versioning & Hot Reload
**Question:** If a plan is updated while executions are in progress, what happens?

**Current Approach:** Jobs include full plan in job data (snapshot at enqueue time)

**Implication:** In-flight executions use old plan version, new executions use new version

**Decision:** This is acceptable. Explicit versioning can be added later if needed.

---

## References

- **Job Queue Patterns:** Postgres `FOR UPDATE SKIP LOCKED` pattern for distributed workers
- **Agent Registration:** Similar to Prometheus service discovery, Kubernetes node registration
- **Location Routing:** Inspired by CloudFlare Workers, AWS Lambda@Edge routing models
- **Existing Abstractions:** griffin-runner/src/storage/ports.ts (RepositoryBackend, JobQueueBackend)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-18 | Initial design document |
| 1.1 | 2026-01-18 | Phase 1 implementation complete - Schema & Data Model updates |
| 1.2 | 2026-01-18 | Phase 2 implementation complete - Agent Registry & Agent Package |
