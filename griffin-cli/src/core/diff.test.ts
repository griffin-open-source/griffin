import { describe, it, expect } from "vitest";
import { computeDiff, type ResolvedPlan } from "./diff.js";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";

// Helper to create a minimal test plan
function createPlan(name: string, overrides?: Partial<PlanV1>): PlanV1 {
  return {
    id: `plan-${name}`,
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

// Helper to create a resolved plan (without id)
function createResolvedPlan(
  name: string,
  overrides?: Partial<ResolvedPlan>,
): ResolvedPlan {
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
    it("should create action when plan exists locally but not remotely", () => {
      const local = [createResolvedPlan("health-check")];
      const remote: PlanV1[] = [];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("create");
      expect(result.actions[0].plan?.name).toBe("health-check");
      expect(result.actions[0].remotePlan).toBeNull();
      expect(result.summary.creates).toBe(1);
      expect(result.summary.updates).toBe(0);
      expect(result.summary.deletes).toBe(0);
    });
  });

  describe("UPDATE actions", () => {
    it("should create update action when plan content differs", () => {
      const local = [
        createResolvedPlan("health-check", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
      ];
      const remote = [
        createPlan("health-check", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
      ];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("update");
      expect(result.actions[0].plan?.name).toBe("health-check");
      expect(result.actions[0].remotePlan?.name).toBe("health-check");
      expect(result.summary.creates).toBe(0);
      expect(result.summary.updates).toBe(1);
      expect(result.summary.deletes).toBe(0);
    });
  });

  describe("NOOP actions", () => {
    it("should create noop action when plan content matches", () => {
      const resolvedPlan = createResolvedPlan("health-check");
      const remotePlan = createPlan("health-check");
      const local = [resolvedPlan];
      const remote = [remotePlan];

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
      const local: ResolvedPlan[] = [];
      const remote = [createPlan("old-plan")];

      const result = computeDiff(local, remote, { includeDeletions: false });

      expect(result.actions).toHaveLength(0);
      expect(result.summary.deletes).toBe(0);
    });

    it("should create delete action when includeDeletions is true", () => {
      const local: ResolvedPlan[] = [];
      const remote = [createPlan("old-plan")];

      const result = computeDiff(local, remote, { includeDeletions: true });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("delete");
      expect(result.actions[0].plan).toBeNull();
      expect(result.actions[0].remotePlan?.name).toBe("old-plan");
      expect(result.summary.deletes).toBe(1);
    });
  });

  describe("Mixed scenarios", () => {
    it("should handle multiple plans with different actions", () => {
      const local = [
        createResolvedPlan("new-plan"),
        createResolvedPlan("updated-plan", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
        createResolvedPlan("unchanged-plan"),
      ];
      const remote = [
        createPlan("updated-plan", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
        createPlan("unchanged-plan"),
        createPlan("deleted-plan"),
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
    it("should match plans by name, not by ID", () => {
      // Local plans don't have IDs after resolution
      const local = [createResolvedPlan("health-check")];
      const remote = [createPlan("health-check", { id: "remote-id-456" })];

      const result = computeDiff(local, remote, {
        includeDeletions: false,
      });

      // Should be NOOP because names match (IDs are ignored)
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("noop");
    });
  });
});
