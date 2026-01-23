import { describe, it, expect } from "vitest";
import { computeDiff } from "./diff.js";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import type { PlanDSL } from "@griffin-app/griffin-ts/types";

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

describe("computeDiff", () => {
  describe("CREATE actions", () => {
    it("should create action when plan exists locally but not remotely", () => {
      const local = [createPlan("health-check")];
      const remote: PlanV1[] = [];

      const result = computeDiff(local as PlanDSL[], remote, {
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
        createPlan("health-check", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
      ];
      const remote = [
        createPlan("health-check", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
      ];

      const result = computeDiff(local as PlanDSL[], remote, {
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
      const plan = createPlan("health-check");
      const local = [plan];
      const remote = [{ ...plan }];

      const result = computeDiff(local as PlanDSL[], remote, {
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
      const local: PlanDSL[] = [];
      const remote = [createPlan("old-plan")];

      const result = computeDiff(local, remote, { includeDeletions: false });

      expect(result.actions).toHaveLength(0);
      expect(result.summary.deletes).toBe(0);
    });

    it("should create delete action when includeDeletions is true", () => {
      const local: PlanDSL[] = [];
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
        createPlan("new-plan"),
        createPlan("updated-plan", {
          frequency: { every: 10, unit: "MINUTE" },
        }),
        createPlan("unchanged-plan"),
      ];
      const remote = [
        createPlan("updated-plan", {
          frequency: { every: 5, unit: "MINUTE" },
        }),
        createPlan("unchanged-plan"),
        createPlan("deleted-plan"),
      ];

      const result = computeDiff(local as PlanDSL[], remote, {
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
      const local = [createPlan("health-check", { id: "local-id-123" })];
      const remote = [createPlan("health-check", { id: "remote-id-456" })];

      const result = computeDiff(local as PlanDSL[], remote, {
        includeDeletions: false,
      });

      // Should be NOOP because names match (IDs are ignored)
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("noop");
    });
  });
});
