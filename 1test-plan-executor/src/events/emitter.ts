import type { ExecutionEvent } from "./types.js";

/**
 * Pluggable event emitter interface for execution observability.
 *
 * Implementations can be synchronous (local) or asynchronous (durable bus).
 * The executor treats emission as best-effort and non-blocking.
 */
export interface ExecutionEventEmitter {
  /**
   * Emit a single event. May be synchronous or asynchronous depending on implementation.
   * Errors during emission should not propagate to the executor.
   */
  emit(event: ExecutionEvent): void | Promise<void>;

  /**
   * Optional: flush any buffered events (for batching implementations).
   * Called at the end of execution to ensure all events are delivered.
   */
  flush?(): Promise<void>;

  /**
   * Optional: cleanup resources (timers, connections, etc.).
   */
  destroy?(): void;
}

/**
 * In-memory event emitter for local/development use.
 * Events are delivered synchronously to all subscribers.
 */
export class LocalEventEmitter implements ExecutionEventEmitter {
  private listeners: Array<(event: ExecutionEvent) => void> = [];

  /**
   * Subscribe to all execution events.
   * @returns Unsubscribe function
   */
  subscribe(listener: (event: ExecutionEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: ExecutionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // Don't let listener errors break execution
        console.error("Error in event listener:", error);
      }
    }
  }
}

/**
 * Adapter interface for durable event buses (SQS, Kafka, Redis Streams, etc.).
 * Implementations provided by callers based on their infrastructure.
 */
export interface DurableEventBusAdapter {
  /**
   * Publish a batch of events to the durable bus.
   * Should handle serialization, retries, and error handling internally.
   */
  publish(events: ExecutionEvent[]): Promise<void>;
}

/**
 * Event emitter that batches events for efficient delivery to durable event buses.
 * Flushes on interval and when batch size is reached.
 */
export class DurableEventEmitter implements ExecutionEventEmitter {
  private buffer: ExecutionEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(
    private adapter: DurableEventBusAdapter,
    private options: {
      /** Number of events to batch before auto-flushing (default: 50) */
      batchSize?: number;
      /** Milliseconds between auto-flushes (default: 100) */
      flushIntervalMs?: number;
    } = {},
  ) {
    const intervalMs = options.flushIntervalMs ?? 100;
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        console.error("Error flushing events:", error);
      });
    }, intervalMs);
  }

  emit(event: ExecutionEvent): void {
    if (this.isDestroyed) {
      console.warn("Cannot emit event: emitter is destroyed");
      return;
    }

    this.buffer.push(event);

    // Auto-flush when batch size is reached
    if (this.buffer.length >= (this.options.batchSize ?? 50)) {
      this.flush().catch((error) => {
        console.error("Error auto-flushing events:", error);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer;
    this.buffer = [];

    try {
      await this.adapter.publish(events);
    } catch (error) {
      console.error("Failed to publish events:", error);
      // Events are lost on failure - caller adapter should implement retries if needed
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}
