import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "./in-memory.js";
import type { ExecutionEvent } from "../types.js";

describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  const createMockEvent = (
    type: ExecutionEvent["type"],
    executionId: string,
    seq: number,
  ): ExecutionEvent =>
    ({
      type,
      eventId: `event-${seq}`,
      seq,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId,
      organizationId: "org-1",
      planName: "Test Plan",
      planVersion: "1.0.0",
      nodeCount: 1,
      edgeCount: 1,
    }) as ExecutionEvent;

  describe("publish", () => {
    it("should store events", async () => {
      const events = [
        createMockEvent("PLAN_START", "exec-1", 0),
        createMockEvent("PLAN_END", "exec-1", 1),
      ];

      await adapter.publish(events);

      const stored = adapter.getEvents();
      expect(stored).toHaveLength(2);
      expect(stored[0].type).toBe("PLAN_START");
      expect(stored[1].type).toBe("PLAN_END");
    });

    it("should track publish count", async () => {
      await adapter.publish([createMockEvent("PLAN_START", "exec-1", 0)]);
      await adapter.publish([createMockEvent("PLAN_END", "exec-1", 1)]);

      expect(adapter.getPublishCount()).toBe(2);
    });

    it("should append events across multiple publishes", async () => {
      await adapter.publish([createMockEvent("PLAN_START", "exec-1", 0)]);
      await adapter.publish([createMockEvent("PLAN_END", "exec-1", 1)]);

      const events = adapter.getEvents();
      expect(events).toHaveLength(2);
    });
  });

  describe("getEventsByType", () => {
    it("should filter events by type", async () => {
      const events = [
        createMockEvent("PLAN_START", "exec-1", 0),
        createMockEvent("PLAN_END", "exec-1", 1),
        createMockEvent("PLAN_START", "exec-2", 2),
      ];

      await adapter.publish(events);

      const planStartEvents = adapter.getEventsByType("PLAN_START");
      expect(planStartEvents).toHaveLength(2);
      expect(planStartEvents.every((e) => e.type === "PLAN_START")).toBe(true);
    });
  });

  describe("getEventsForExecution", () => {
    it("should filter events by executionId", async () => {
      const events = [
        createMockEvent("PLAN_START", "exec-1", 0),
        createMockEvent("PLAN_END", "exec-1", 1),
        createMockEvent("PLAN_START", "exec-2", 2),
      ];

      await adapter.publish(events);

      const exec1Events = adapter.getEventsForExecution("exec-1");
      expect(exec1Events).toHaveLength(2);
      expect(exec1Events.every((e) => e.executionId === "exec-1")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear all events and reset counters", async () => {
      await adapter.publish([createMockEvent("PLAN_START", "exec-1", 0)]);

      adapter.clear();

      expect(adapter.getEvents()).toHaveLength(0);
      expect(adapter.getPublishCount()).toBe(0);
    });
  });

  describe("latency simulation", () => {
    it("should simulate latency", async () => {
      const adapterWithLatency = new InMemoryAdapter({ latencyMs: 50 });
      const start = Date.now();

      await adapterWithLatency.publish([
        createMockEvent("PLAN_START", "exec-1", 0),
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe("failure simulation", () => {
    it("should simulate failures", async () => {
      const adapterWithFailures = new InMemoryAdapter({
        failureProbability: 1.0, // Always fail
      });

      await expect(
        adapterWithFailures.publish([
          createMockEvent("PLAN_START", "exec-1", 0),
        ]),
      ).rejects.toThrow("Simulated publish failure");
    });

    it("should succeed when failure probability is 0", async () => {
      const adapterNoFailures = new InMemoryAdapter({
        failureProbability: 0.0,
      });

      await expect(
        adapterNoFailures.publish([createMockEvent("PLAN_START", "exec-1", 0)]),
      ).resolves.not.toThrow();
    });
  });
});
