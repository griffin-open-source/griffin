# Storage Module

This module provides a unified interface for persistent storage across different backends. It follows the **Ports & Adapters** (Hexagonal Architecture) pattern to allow swapping storage implementations without changing business logic.

**Key Design:** Repository and Job Queue backends are **separate and independent**, allowing you to mix implementations (e.g., SQLite for data persistence + Postgres for job queues).

## Architecture

```
storage/
  ├── ports.ts                    # Core interfaces (contracts)
  ├── factory.ts                  # Creates storage backends
  ├── index.ts                    # Public API exports
  └── adapters/                   # Storage implementations
      ├── memory/                 # ✅ In-memory (complete)
      │   ├── index.ts            # MemoryRepositoryBackend + MemoryJobQueueBackend
      │   ├── repository.ts
      │   └── job-queue.ts
      ├── sqlite/                 # 🚧 SQLite (stub, repository only)
      │   ├── index.ts            # SqliteRepositoryBackend
      │   ├── repository.ts
      │   └── migrations/
      │       └── runner.ts
      └── postgres/               # 🚧 PostgreSQL (stub)
          ├── index.ts            # PostgresRepositoryBackend + PostgresJobQueueBackend
          ├── repository.ts
          ├── job-queue.ts
          └── migrations/
              └── runner.ts
```

## Core Concepts

### 1. Repository<T>

Generic CRUD interface for entities with an `id` field.

```typescript
interface Repository<T extends { id: string }> {
  create(data: Omit<T, "id">): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(options?: QueryOptions<T>): Promise<T[]>;
  update(id: string, data: Partial<Omit<T, "id">>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filter?: Filter<T>): Promise<number>;
}
```

### 2. JobQueue<T>

Durable background job queue with retry logic.

```typescript
interface JobQueue<T> {
  enqueue(data: T, options?: EnqueueOptions): Promise<string>;
  dequeue(): Promise<Job<T> | null>;
  acknowledge(jobId: string): Promise<void>;
  fail(jobId: string, error: Error, retry?: boolean): Promise<void>;
}
```

### 3. RepositoryBackend

Backend interface for data persistence.

```typescript
interface RepositoryBackend {
  repository<T extends { id: string }>(collection: string): Repository<T>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<R>(fn: (tx: RepositoryBackend) => Promise<R>): Promise<R>;
}
```

### 4. JobQueueBackend

Backend interface for background job queues.

```typescript
interface JobQueueBackend {
  queue<T = any>(name?: string): JobQueue<T>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

## Usage

### In Routes

```typescript
// routes/plan/index.ts
export default function (fastify: FastifyTypeBox) {
  fastify.post(
    "/plan",
    { schema: CreatePlanEndpoint },
    async (request, reply) => {
      const planRepo = fastify.repository.repository<TestPlanV1>("plans");
      const savedPlan = await planRepo.create(request.body);
      return reply.code(201).send(savedPlan);
    },
  );

  fastify.get("/plan/:id", async (request, reply) => {
    const planRepo = fastify.repository.repository<TestPlanV1>("plans");
    const plan = await planRepo.findById(request.params.id);

    if (!plan) {
      return reply.code(404).send({ error: "Plan not found" });
    }

    return reply.send(plan);
  });
}
```

### In Background Jobs

```typescript
// Enqueue a job
const queue = fastify.jobQueue.queue<ExecutePlanJob>();
await queue.enqueue(
  { planId: "plan-123", executionId: "exec-456" },
  { runAt: new Date(Date.now() + 60000) }, // Run in 1 minute
);

// Process jobs
async function processJobs() {
  const queue = fastify.jobQueue.queue<ExecutePlanJob>();

  while (true) {
    const job = await queue.dequeue();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    try {
      await executePlan(job.data);
      await queue.acknowledge(job.id);
    } catch (error) {
      await queue.fail(job.id, error, true); // Retry on failure
    }
  }
}
```

## Configuration

Storage backends are configured independently via environment variables:

### Repository Backend

```bash
# Use in-memory repository (default, good for dev/testing)
REPOSITORY_BACKEND=memory

# Use SQLite (good for single-node production)
REPOSITORY_BACKEND=sqlite
REPOSITORY_CONNECTION_STRING=/var/lib/1test/1test.db  # or ':memory:'
# Alternatively:
SQLITE_PATH=/var/lib/1test/1test.db

# Use PostgreSQL (good for multi-node production)
REPOSITORY_BACKEND=postgres
REPOSITORY_CONNECTION_STRING=postgresql://user:pass@localhost:5432/1test
# Alternatively:
POSTGRESQL_URL=postgresql://user:pass@localhost:5432/1test
```

### Job Queue Backend

```bash
# Use in-memory queue (default, good for dev/testing)
JOBQUEUE_BACKEND=memory

# Use PostgreSQL (good for production)
JOBQUEUE_BACKEND=postgres
JOBQUEUE_CONNECTION_STRING=postgresql://user:pass@localhost:5432/1test
# Alternatively:
POSTGRESQL_URL=postgresql://user:pass@localhost:5432/1test
```

### Common Configurations

**Development:**

```bash
REPOSITORY_BACKEND=memory
JOBQUEUE_BACKEND=memory
```

**Single-node production:**

```bash
REPOSITORY_BACKEND=sqlite
SQLITE_PATH=/var/lib/1test/1test.db
JOBQUEUE_BACKEND=memory  # or postgres if using Postgres elsewhere
```

**Multi-node production:**

```bash
REPOSITORY_BACKEND=postgres
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:pass@localhost:5432/1test
```

**Mixed (SQLite for data, Postgres for queue):**

```bash
REPOSITORY_BACKEND=sqlite
SQLITE_PATH=/var/lib/1test/1test.db
JOBQUEUE_BACKEND=postgres
POSTGRESQL_URL=postgresql://user:pass@localhost:5432/1test
```

## Backends

### ✅ In-Memory (Complete)

Fully functional implementation for testing and development.

**Backends:**

- `MemoryRepositoryBackend` - Repository implementation
- `MemoryJobQueueBackend` - Job queue implementation

**Pros:**

- No external dependencies
- Fast
- Perfect for tests
- Supports multiple named queues

**Cons:**

- Data lost on restart
- Not suitable for production
- No persistence

### 🚧 SQLite (Repository Only)

**Backends:**

- `SqliteRepositoryBackend` - Repository implementation ⚠️ NOT YET IMPLEMENTED
- ❌ No job queue backend (SQLite lacks proper row-level locking)

**When to use:**

- Single-node deployments
- Simple setup requirements
- File-based persistence needed

**Recommended library:** `better-sqlite3`

**TODO:**

- Implement repository with JSON serialization
- Create migration runner
- Add migrations for data tables

**Note:** For job queues, use `MemoryJobQueueBackend` or `PostgresJobQueueBackend` instead.

### 🚧 PostgreSQL (Stub)

**Backends:**

- `PostgresRepositoryBackend` - Repository implementation ⚠️ NOT YET IMPLEMENTED
- `PostgresJobQueueBackend` - Job queue implementation ⚠️ NOT YET IMPLEMENTED

**When to use:**

- Multi-node deployments
- Existing PostgreSQL infrastructure
- Need for advanced querying
- Production-grade job queue with proper concurrency

**Recommended library:** `pg` (node-postgres)

**TODO:**

- Implement repository with JSONB storage
- Implement job queue with `SELECT FOR UPDATE SKIP LOCKED`
- Create migration runner
- Add migrations for data and job tables
- Support multiple named queues

## Design Decisions

### Why Split Repository and Job Queue?

**Problem:** Not all databases are suitable for both use cases.

- **SQLite** is great for simple file-based persistence but lacks proper row-level locking for reliable job queues
- **Postgres** excels at both but may be overkill if you only need simple data storage
- **Dedicated queue systems** (SQS, Redis) are optimized for high-throughput queuing

**Solution:** Separate backends allow mixing implementations based on your needs:

- Development: Memory + Memory (simple, fast)
- Production: SQLite + Memory (if single-node, low queue volume)
- Production: Postgres + Postgres (if multi-node or high reliability needed)
- Production: Postgres + SQS (if using AWS infrastructure)

### Why Generic Repository?

Without generics, you'd need:

```typescript
interface PlanRepository { ... }
interface ExecutionRepository { ... }
interface LogRepository { ... }
```

With generics, you get one interface for all entities:

```typescript
Repository<Plan>;
Repository<Execution>;
Repository<Log>;
```

### Why Separate Migrations?

TypeBox schemas define **API contracts** (validation, types).  
Migrations define **database structure** (tables, columns, indexes).

These are separate concerns:

- Schemas change when your API changes
- Migrations change when your storage needs change
- They don't always align (e.g., you might denormalize for performance)

## Testing

The in-memory adapters are perfect for testing:

```typescript
import { MemoryRepositoryBackend, MemoryJobQueueBackend } from './storage';

describe('Plan Routes', () => {
  let repository: MemoryRepositoryBackend;
  let jobQueue: MemoryJobQueueBackend;

  beforeEach(async () => {
    repository = new MemoryRepositoryBackend();
    jobQueue = new MemoryJobQueueBackend();
    await repository.connect();
    await jobQueue.connect();
  });

  afterEach(async () => {
    await repository.disconnect();
    await jobQueue.disconnect();
  });

  it('should create a plan', async () => {
    const repo = repository.repository<TestPlanV1>('plans');
    const plan = await repo.create({ name: 'Test Plan', ... });
    expect(plan.id).toBeDefined();
  });

  it('should enqueue and process jobs', async () => {
    const queue = jobQueue.queue<ExecutePlanJob>();
    const jobId = await queue.enqueue({ planId: 'test' });

    const job = await queue.dequeue();
    expect(job).not.toBeNull();
    expect(job!.data.planId).toBe('test');

    await queue.acknowledge(job!.id);
    const status = await queue.getStatus(job!.id);
    expect(status).toBe(JobStatus.COMPLETED);
  });
});
```

## Future Enhancements

### Repository Backends

1. **Implement SQLite**: Complete the SQLiteRepositoryBackend implementation
2. **Implement Postgres**: Complete the PostgresRepositoryBackend implementation
3. **Query Builder**: Add a fluent API for complex queries
4. **Migrations**: Implement migration runners for SQLite/Postgres
5. **Indexes**: Add support for declaring indexes on repositories
6. **Caching**: Add optional caching layer for frequently-accessed data

### Job Queue Backends

1. **Implement Postgres**: Complete the PostgresJobQueueBackend with proper locking
2. **SQS Backend**: Add AWS SQS support for serverless deployments
3. **Redis Backend**: Add Redis support for high-throughput queues
4. **Dead Letter Queues**: Add DLQ support for failed jobs
5. **Job Priorities**: Enhance priority handling and scheduling

### Observability

1. Add metrics for repository/queue operations
2. Add tracing support
3. Add health checks for backends
