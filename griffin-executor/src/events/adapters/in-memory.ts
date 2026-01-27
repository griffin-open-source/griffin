/**
 * In-memory event bus adapter for testing and local development.
 *
 * Stores events in memory and provides access for inspection.
 * Useful for testing the DurableEventEmitter batching behavior without
 * requiring actual infrastructure.
 */

import type { DurableEventBusAdapter } from "../emitter.js";
import type { ExecutionEvent } from "../types.js";

/**
 * In-memory adapter that stores events for inspection.
 *
 * Primarily useful for testing and development.
 * Can simulate failures and latency.
 */
export class InMemoryAdapter implements DurableEventBusAdapter {
  private readonly events: ExecutionEvent[] = [];
  private publishCount = 0;

  constructor(
    private options: {
      /** Simulate latency in milliseconds */
      latencyMs?: number;
      /** Probability of failure (0-1) for testing error handling */
      failureProbability?: number;
    } = {},
  ) {}

  async publish(events: ExecutionEvent[]): Promise<void> {
    // Simulate latency
    if (this.options.latencyMs) {
      await this.sleep(this.options.latencyMs);
    }

    // Simulate failures
    if (
      this.options.failureProbability &&
      Math.random() < this.options.failureProbability
    ) {
      throw new Error("Simulated publish failure");
    }

    this.events.push(...events);
    this.publishCount++;
  }

  /**
   * Get all published events.
   */
  getEvents(): ExecutionEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type.
   */
  getEventsByType<T extends ExecutionEvent["type"]>(
    type: T,
  ): Array<Extract<ExecutionEvent, { type: T }>> {
    return this.events.filter((e) => e.type === type) as Array<
      Extract<ExecutionEvent, { type: T }>
    >;
  }

  /**
   * Get events for a specific execution.
   */
  getEventsForExecution(executionId: string): ExecutionEvent[] {
    return this.events.filter((e) => e.executionId === executionId);
  }

  /**
   * Get the number of times publish() was called.
   * Useful for verifying batching behavior.
   */
  getPublishCount(): number {
    return this.publishCount;
  }

  /**
   * Clear all stored events.
   */
  clear(): void {
    this.events.length = 0;
    this.publishCount = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
