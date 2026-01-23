import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  LocalEventEmitter,
  DurableEventEmitter,
  type DurableEventBusAdapter,
} from "./emitter.js";
import type { ExecutionEvent } from "./types.js";

describe("LocalEventEmitter", () => {
  let emitter: LocalEventEmitter;

  beforeEach(() => {
    emitter = new LocalEventEmitter();
  });

  it("should deliver events to subscribers synchronously", () => {
    const events: ExecutionEvent[] = [];
    emitter.subscribe((event) => events.push(event));

    const testEvent: ExecutionEvent = {
      type: "PLAN_START",
      eventId: "123",
      seq: 0,
      timestamp: Date.now(),
      organizationId: "test-org",
      planId: "plan-1",
      executionId: "exec-1",
      planName: "Test Plan",
      planVersion: "1.0",
      nodeCount: 2,
      edgeCount: 1,
    };

    emitter.emit(testEvent);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(testEvent);
  });

  it("should deliver events to multiple subscribers", () => {
    const events1: ExecutionEvent[] = [];
    const events2: ExecutionEvent[] = [];

    emitter.subscribe((event) => events1.push(event));
    emitter.subscribe((event) => events2.push(event));

    const testEvent: ExecutionEvent = {
      type: "NODE_START",
      eventId: "456",
      seq: 1,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-1",
      nodeType: "ENDPOINT",
    };

    emitter.emit(testEvent);

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect(events1[0]).toEqual(testEvent);
    expect(events2[0]).toEqual(testEvent);
  });

  it("should allow unsubscribing", () => {
    const events: ExecutionEvent[] = [];
    const unsubscribe = emitter.subscribe((event) => events.push(event));

    const testEvent: ExecutionEvent = {
      type: "NODE_END",
      eventId: "789",
      seq: 2,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-1",
      nodeType: "ENDPOINT",
      success: true,
      duration_ms: 100,
    };

    emitter.emit(testEvent);
    expect(events).toHaveLength(1);

    unsubscribe();

    emitter.emit(testEvent);
    expect(events).toHaveLength(1); // Still 1, not 2
  });

  it("should not propagate listener errors to other listeners", () => {
    const events: ExecutionEvent[] = [];
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    emitter.subscribe(() => {
      throw new Error("Listener error");
    });
    emitter.subscribe((event) => events.push(event));

    const testEvent: ExecutionEvent = {
      type: "PLAN_END",
      eventId: "abc",
      seq: 3,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      success: true,
      totalDuration_ms: 1000,
      nodeResultCount: 2,
      errorCount: 0,
      errors: [],
    };

    emitter.emit(testEvent);

    expect(events).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("DurableEventEmitter", () => {
  let adapter: DurableEventBusAdapter;
  let publishSpy: ReturnType<
    typeof vi.fn<(events: ExecutionEvent[]) => Promise<void>>
  >;
  let emitter: DurableEventEmitter;

  beforeEach(() => {
    publishSpy = vi
      .fn<(events: ExecutionEvent[]) => Promise<void>>()
      .mockResolvedValue(undefined);
    adapter = { publish: publishSpy };
  });

  afterEach(() => {
    emitter?.destroy();
  });

  it("should batch events and flush on batch size", async () => {
    emitter = new DurableEventEmitter(adapter, {
      batchSize: 3,
      flushIntervalMs: 10000,
    });

    const event1: ExecutionEvent = {
      type: "NODE_START",
      eventId: "1",
      seq: 0,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-1",
      nodeType: "ENDPOINT",
    };

    const event2: ExecutionEvent = {
      type: "NODE_START",
      eventId: "2",
      seq: 1,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-2",
      nodeType: "WAIT",
    };

    const event3: ExecutionEvent = {
      type: "NODE_START",
      eventId: "3",
      seq: 2,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-3",
      nodeType: "ASSERTION",
    };

    emitter.emit(event1);
    emitter.emit(event2);
    expect(publishSpy).not.toHaveBeenCalled();

    emitter.emit(event3); // Should trigger auto-flush

    // Wait for async flush
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(publishSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledWith([event1, event2, event3]);
  });

  it("should flush on interval", async () => {
    emitter = new DurableEventEmitter(adapter, {
      batchSize: 100,
      flushIntervalMs: 50,
    });

    const event: ExecutionEvent = {
      type: "HTTP_REQUEST",
      eventId: "1",
      seq: 0,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-1",
      attempt: 1,
      method: "GET",
      url: "https://api.example.com/test",
      hasBody: false,
    };

    emitter.emit(event);

    // Wait for interval flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(publishSpy).toHaveBeenCalledWith([event]);
  });

  it("should flush manually when requested", async () => {
    emitter = new DurableEventEmitter(adapter, {
      batchSize: 100,
      flushIntervalMs: 10000,
    });

    const event: ExecutionEvent = {
      type: "HTTP_RESPONSE",
      eventId: "1",
      seq: 0,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "node-1",
      attempt: 1,
      status: 200,
      statusText: "OK",
      duration_ms: 100,
      hasBody: true,
    };

    emitter.emit(event);
    await emitter.flush();

    expect(publishSpy).toHaveBeenCalledWith([event]);
  });

  it("should not emit after being destroyed", async () => {
    emitter = new DurableEventEmitter(adapter, {
      batchSize: 100,
      flushIntervalMs: 50,
    });

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    emitter.destroy();

    const event: ExecutionEvent = {
      type: "ERROR",
      eventId: "1",
      seq: 0,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      errorName: "TestError",
      message: "Test error message",
    };

    emitter.emit(event);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(publishSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Cannot emit event: emitter is destroyed",
    );

    consoleWarnSpy.mockRestore();
  });

  it("should handle publish failures gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    publishSpy.mockRejectedValueOnce(new Error("Publish failed"));

    emitter = new DurableEventEmitter(adapter, {
      batchSize: 1,
      flushIntervalMs: 10000,
    });

    const event: ExecutionEvent = {
      type: "WAIT_START",
      eventId: "1",
      seq: 0,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId: "exec-1",
      organizationId: "test-org",
      nodeId: "wait-1",
      duration_ms: 1000,
    };

    emitter.emit(event);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(publishSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
