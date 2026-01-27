# Event Bus Adapters

This directory contains adapters for publishing execution events to various durable event buses. All adapters implement the `DurableEventBusAdapter` interface and can be used with `DurableEventEmitter` for batched event publishing.

## Available Adapters

### KinesisAdapter

Publishes events to AWS Kinesis streams. Uses executionId as the partition key to maintain ordering within an execution.

**Installation:**

```bash
npm install @aws-sdk/client-kinesis
```

**Usage:**

```typescript
import { KinesisClient } from "@aws-sdk/client-kinesis";
import {
  DurableEventEmitter,
  KinesisAdapter,
} from "@griffin-app/griffin-executor";

// Create Kinesis client
const kinesisClient = new KinesisClient({ region: "us-east-1" });

// Create adapter
const adapter = new KinesisAdapter({
  client: kinesisClient,
  streamName: "griffin-execution-events",
  maxRetries: 3,
  retryDelayMs: 1000,
});

// Create emitter with adapter
const emitter = new DurableEventEmitter(adapter, {
  batchSize: 50,
  flushIntervalMs: 100,
});

// Use with executor
const result = await executePlanV1(plan, {
  eventEmitter: emitter,
});

// Ensure all events are flushed
await emitter.flush();
emitter.destroy();
```

**Features:**

- Automatic batching up to 500 records (Kinesis limit)
- Retry logic with configurable attempts and delays
- Partition by executionId for ordering guarantees
- Handles partial failures gracefully

### InMemoryAdapter

Simple in-memory storage for testing and local development.

**Usage:**

```typescript
import {
  DurableEventEmitter,
  InMemoryAdapter,
} from "@griffin-app/griffin-executor";

const adapter = new InMemoryAdapter({
  latencyMs: 10, // Optional: simulate network latency
  failureProbability: 0.1, // Optional: simulate failures for testing
});

const emitter = new DurableEventEmitter(adapter, {
  batchSize: 10,
  flushIntervalMs: 50,
});

// Execute plan
await executePlanV1(plan, { eventEmitter: emitter });
await emitter.flush();

// Inspect events
const allEvents = adapter.getEvents();
const planStartEvents = adapter.getEventsByType("PLAN_START");
const executionEvents = adapter.getEventsForExecution("exec-123");
const publishCount = adapter.getPublishCount(); // Number of batches

// Clean up
adapter.clear();
emitter.destroy();
```

**Features:**

- Store events in memory for inspection
- Query by type or executionId
- Simulate latency and failures
- Track batch publish count

## Creating Custom Adapters

To create a new adapter, implement the `DurableEventBusAdapter` interface:

```typescript
import type {
  DurableEventBusAdapter,
  ExecutionEvent,
} from "@griffin-app/griffin-executor";

export class MyCustomAdapter implements DurableEventBusAdapter {
  async publish(events: ExecutionEvent[]): Promise<void> {
    // Serialize events
    const serialized = events.map((e) => JSON.stringify(e));

    // Publish to your event bus
    await myEventBus.send(serialized);
  }
}
```

**Best Practices:**

- Handle serialization internally
- Implement retry logic for transient failures
- Consider partitioning strategies for ordering
- Log errors without throwing (events are best-effort)
- Support batching for efficiency

## Adapter Comparison

| Adapter         | Use Case           | Ordering        | Durability       | Dependencies            |
| --------------- | ------------------ | --------------- | ---------------- | ----------------------- |
| InMemoryAdapter | Testing, local dev | None            | None (in-memory) | None                    |
| KinesisAdapter  | Production AWS     | Per executionId | High             | @aws-sdk/client-kinesis |

## Coming Soon

- SQS adapter (FIFO queues for ordering)
- Kafka adapter (for high-throughput scenarios)
- Redis Streams adapter (lightweight alternative)
