# Event System

The `1test-plan-executor` includes a rich event system for observability during test plan execution. Events can be consumed locally (in-memory) or routed to durable event buses for distributed systems.

## Event Types

All events include a base envelope with:

- `eventId`: Unique identifier for the event
- `seq`: Monotonic sequence number (0-indexed) within the execution
- `timestamp`: Unix timestamp in milliseconds
- `planId`: ID of the test plan being executed
- `executionId`: Unique identifier for this execution run

### Plan-Level Events

- **`PLAN_START`**: Emitted when plan execution begins
- **`PLAN_END`**: Emitted when plan execution completes (success or failure)

### Node-Level Events

- **`NODE_START`**: Emitted when a node begins execution
- **`NODE_END`**: Emitted when a node completes execution

### HTTP Events (Endpoint Nodes)

- **`HTTP_REQUEST`**: Emitted before making an HTTP request
- **`HTTP_RESPONSE`**: Emitted after receiving an HTTP response
- **`HTTP_RETRY`**: Emitted when an HTTP request is retried (TODO: retry configuration)

### Other Events

- **`WAIT_START`**: Emitted when a wait node begins
- **`ASSERTION_RESULT`**: Emitted for each assertion evaluated (TODO: assertion implementation)
- **`NODE_STREAM`**: Emitted for streaming progress updates from nodes
- **`ERROR`**: Emitted for system-level errors (not node failures)

## Usage

### Local Development (In-Memory)

```typescript
import { executePlanV1, LocalEventEmitter } from "1test-plan-executor";

const emitter = new LocalEventEmitter();

// Subscribe to all events
emitter.subscribe((event) => {
  console.log(`[${event.type}] seq=${event.seq}`, event);
});

// Execute with event emission
const result = await executePlanV1(testPlan, {
  mode: "local",
  httpClient: axiosAdapter,
  eventEmitter: emitter,
});
```

### Filtering Events

```typescript
emitter.subscribe((event) => {
  // Only log HTTP events
  if (event.type === "HTTP_REQUEST" || event.type === "HTTP_RESPONSE") {
    console.log(`HTTP ${event.type}:`, event);
  }
});
```

### Hosted/Distributed Context (Durable Event Bus)

Implement a custom adapter for your event bus:

```typescript
import {
  executePlanV1,
  DurableEventEmitter,
  type DurableEventBusAdapter,
} from "1test-plan-executor";

// Example: SQS adapter (user-provided)
class SQSEventBusAdapter implements DurableEventBusAdapter {
  constructor(private queueUrl: string) {}

  async publish(events: ExecutionEvent[]): Promise<void> {
    // Batch publish to SQS
    const params = {
      QueueUrl: this.queueUrl,
      Entries: events.map((event, i) => ({
        Id: String(i),
        MessageBody: JSON.stringify(event),
        MessageAttributes: {
          eventType: { DataType: "String", StringValue: event.type },
          executionId: { DataType: "String", StringValue: event.executionId },
        },
      })),
    };

    await this.sqsClient.sendMessageBatch(params);
  }
}

// Use durable emitter
const emitter = new DurableEventEmitter(
  new SQSEventBusAdapter(process.env.EVENT_QUEUE_URL),
  {
    batchSize: 20, // Flush after 20 events
    flushIntervalMs: 50, // Or flush every 50ms
  },
);

const result = await executePlanV1(testPlan, {
  mode: "remote",
  httpClient: axiosAdapter,
  eventEmitter: emitter,
});

// Ensure all events are flushed before process exit
await emitter.flush();
emitter.destroy(); // Clean up timers
```

## Event Ordering and Correlation

### Sequence Numbers

Events include a `seq` field that is monotonically increasing (starting at 0) within a single execution. This ensures events can be properly ordered even if the transport reorders them or if clock skew occurs.

### Execution ID

All events from a single execution share the same `executionId`. You can provide a custom execution ID or let the system generate one:

```typescript
const result = await executePlanV1(testPlan, {
  httpClient: axiosAdapter,
  eventEmitter: emitter,
  executionId: "my-custom-execution-id-123", // Optional
});
```

### Deduplication

Events include a unique `eventId` (UUID) for deduplication in at-least-once delivery systems. Your event consumer should track processed `eventId`s to avoid duplicate processing.

## Event Bus Adapter Requirements

Custom adapters must implement the `DurableEventBusAdapter` interface:

```typescript
interface DurableEventBusAdapter {
  publish(events: ExecutionEvent[]): Promise<void>;
}
```

Key considerations:

- **Batching**: Adapters receive batches of events for efficiency
- **Serialization**: All events are JSON-serializable (no Error objects, circular refs, etc.)
- **Error Handling**: Adapter should handle retries internally; errors are logged but won't block execution
- **Ordering**: If ordering matters, use `seq` and/or partition by `executionId`

## Best Practices

### Local Development

- Use `LocalEventEmitter` for synchronous, in-process event handling
- Subscribe to specific event types for focused logging/debugging
- Events are delivered synchronously to all listeners

### Production/Hosted

- Use `DurableEventEmitter` with a custom adapter for your event bus
- Tune `batchSize` and `flushIntervalMs` based on your workload and latency requirements
- Always call `flush()` before process termination to ensure events are delivered
- Implement idempotency in consumers using `eventId`
- Use `executionId` for correlation across distributed systems

### Security

- Response bodies are intentionally **not** included in events to avoid leaking sensitive data
- Events only include metadata (status codes, durations, presence of body)
- If you need response data for debugging, correlate by `nodeId` with the actual execution results

## Future Enhancements (TODOs)

- [ ] **Retry Configuration**: Plan-based retry policies with `HTTP_RETRY` events
- [ ] **Assertion Events**: Detailed `ASSERTION_RESULT` events when assertions are implemented
- [ ] **Conditional Events**: Event filtering/sampling configuration (e.g., only emit on errors)
- [ ] **Event Schemas**: Versioned event schemas for backward compatibility
