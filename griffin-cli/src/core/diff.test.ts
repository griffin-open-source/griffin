import { describe, it, expect } from "vitest";
import { computeDiff, type ResolvedMonitor } from "./diff.js";
import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";

// Helper to create a minimal test monitor
function createMonitor(name: string, overrides?: Partial<MonitorV1>): MonitorV1 {
  return {
    id: `monitor-${name}`,
    name,
    project: "test-project",
    environment: "test",
    version: "1.0",
    frequency: { every: 5, unit: "MINUTE" },
    nodes: [],
    edges: [],
    ...overrides,
  };
}

// Helper to create a resolved monitor (without id)
function createResolvedMonitor(
  name: string,
  overrides?: Partial<ResolvedMonitor>,
): ResolvedMonitor {
  return {
    name,
    project: "test-project",
    environment: "test",
    version: "1.0",
    frequency: { every: 5, unit: "MINUTE" },
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe("computeDiff", () => {
  describe("CREATE actions", () => {
    it("should create action when monitor exists locally but not remotely", () => {
      const local = [createResolvedMonitor("health-check")];
      const remote: MonitorV1[] = [];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("create");
      expect(result.actions[0].monitor?.name).toBe("health-check");
      expect(result.actions[0].remoteMonitor).toBeNull();
      expect(result.summary.creates).toBe(1);
      expect(result.summary.updates).toBe(0);
      expect(result.summary.deletes).toBe(0);
    });
  });

  describe("UPDATE actions", () => {
    it("should create update action when monitor content differs", () => {
      const local = [
        createResolvedMonitor("health-check", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
      ];
      const remote = [
        createMonitor("health-check", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
      ];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("update");
      expect(result.actions[0].monitor?.name).toBe("health-check");
      expect(result.actions[0].remoteMonitor?.name).toBe("health-check");
      expect(result.summary.creates).toBe(0);
      expect(result.summary.updates).toBe(1);
      expect(result.summary.deletes).toBe(0);
    });
  });

  describe("NOOP actions", () => {
    it("should create noop action when monitor content matches", () => {
      const resolvedMonitor = createResolvedMonitor("health-check");
      const remoteMonitor = createMonitor("health-check");
      const local = [resolvedMonitor];
      const remote = [remoteMonitor];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("noop");
      expect(result.summary.creates).toBe(0);
      expect(result.summary.updates).toBe(0);
      expect(result.summary.deletes).toBe(0);
      expect(result.summary.noops).toBe(1);
    });
  });

  describe("DELETE actions", () => {
    it("should not create delete action when includeDeletions is false", () => {
      const local: ResolvedMonitor[] = [];
      const remote = [createMonitor("old-monitor")];

      const result = computeDiff(local, remote, { includeDeletions: false });

      expect(result.actions).toHaveLength(0);
      expect(result.summary.deletes).toBe(0);
    });

    it("should create delete action when includeDeletions is true", () => {
      const local: ResolvedMonitor[] = [];
      const remote = [createMonitor("old-monitor")];

      const result = computeDiff(local, remote, { includeDeletions: true });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("delete");
      expect(result.actions[0].monitor).toBeNull();
      expect(result.actions[0].remoteMonitor?.name).toBe("old-monitor");
      expect(result.summary.deletes).toBe(1);
    });
  });

  describe("Mixed scenarios", () => {
    it("should handle multiple monitors with different actions", () => {
      const local = [
        createResolvedMonitor("new-monitor"),
        createResolvedMonitor("updated-monitor", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
        createResolvedMonitor("unchanged-monitor"),
      ];
      const remote = [
        createMonitor("updated-monitor", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
        createMonitor("unchanged-monitor"),
        createMonitor("deleted-monitor"),
      ];

      const result = computeDiff(local, remote, {
        includeDeletions: true,
      });

      expect(result.actions).toHaveLength(4);
      expect(result.summary.creates).toBe(1);
      expect(result.summary.updates).toBe(1);
      expect(result.summary.deletes).toBe(1);
      expect(result.summary.noops).toBe(1);
    });
  });

  describe("Matching by name", () => {
    it("should match monitors by name, not by ID", () => {
      // Local monitors don't have IDs after resolution
      const local = [createResolvedMonitor("health-check")];
      const remote = [createMonitor("health-check", { id: "remote-id-456" })];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      // Should be NOOP because names match (IDs are ignored)
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("noop");
    });
  });
});
