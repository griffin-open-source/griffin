import { describe, it, expect, vi } from "vitest";
import { applyDiff } from "./apply.js";
import type { DiffResult } from "./diff.js";
import type { PlanApi } from "@griffin-app/griffin-hub-sdk";
import type { TestPlanV1 } from "@griffin-app/griffin-ts/types";

// Helper to create a minimal test plan
function createPlan(name: string): TestPlanV1 {
  return {
    id: `plan-${name}`,
    name,
    project: "test-project",
    environment: "test",
    version: "1.0",
    frequency: { every: 5, unit: "MINUTE" },
    nodes: [],
    edges: [],
  } as TestPlanV1;
}

describe("applyDiff", () => {
  it("should handle empty diff with no changes", async () => {
    const diff: DiffResult = {
      actions: [],
      summary: { creates: 0, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {} as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "test");

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip noop actions", async () => {
    const plan = createPlan("health-check");
    const diff: DiffResult = {
      actions: [{ type: "noop", plan, remotePlan: plan, reason: "unchanged" }],
      summary: { creates: 0, updates: 0, deletes: 0, noops: 1 },
    };

    const mockPlanApi = {} as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "test");

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
  });

  it("should apply create action", async () => {
    const plan = createPlan("new-plan");
    const diff: DiffResult = {
      actions: [{ type: "create", plan, remotePlan: null, reason: "new" }],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      planPost: vi.fn().mockResolvedValue({
        data: { data: { ...plan, id: "created-id" } },
      }),
    } as unknown as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "staging");

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("create");
    expect(result.applied[0].planName).toBe("new-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with injected project and environment
    expect(mockPlanApi.planPost).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "new-plan",
        project: "project-id",
        environment: "staging",
      }),
    );
  });

  it("should apply update action", async () => {
    const localPlan = createPlan("existing-plan");
    const remotePlan = { ...localPlan, id: "remote-id" };
    const diff: DiffResult = {
      actions: [
        { type: "update", plan: localPlan, remotePlan, reason: "changed" },
      ],
      summary: { creates: 0, updates: 1, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      planIdPut: vi.fn().mockResolvedValue({
        data: { data: remotePlan },
      }),
    } as unknown as PlanApi;

    const result = await applyDiff(
      diff,
      mockPlanApi,
      "project-id",
      "production",
    );

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("update");
    expect(result.applied[0].planName).toBe("existing-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote plan's ID
    expect(mockPlanApi.planIdPut).toHaveBeenCalledWith(
      "remote-id",
      expect.objectContaining({
        name: "existing-plan",
        project: "project-id",
        environment: "production",
      }),
    );
  });

  it("should apply delete action", async () => {
    const remotePlan = createPlan("old-plan");
    const diff: DiffResult = {
      actions: [{ type: "delete", plan: null, remotePlan, reason: "removed" }],
      summary: { creates: 0, updates: 0, deletes: 1, noops: 0 },
    };

    const mockPlanApi = {
      planIdDelete: vi.fn().mockResolvedValue({}),
    } as unknown as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "test");

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("delete");
    expect(result.applied[0].planName).toBe("old-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote plan's ID
    expect(mockPlanApi.planIdDelete).toHaveBeenCalledWith(remotePlan.id);
  });

  it("should handle errors gracefully", async () => {
    const plan = createPlan("failing-plan");
    const diff: DiffResult = {
      actions: [{ type: "create", plan, remotePlan: null, reason: "new" }],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      planPost: vi.fn().mockRejectedValue(new Error("API Error")),
    } as unknown as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "test");

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].success).toBe(false);
    expect(result.applied[0].error).toBe("API Error");
  });

  it("should skip actions in dry-run mode", async () => {
    const plan = createPlan("dry-run-plan");
    const diff: DiffResult = {
      actions: [{ type: "create", plan, remotePlan: null, reason: "new" }],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      planPost: vi.fn(),
    } as unknown as PlanApi;

    const result = await applyDiff(diff, mockPlanApi, "project-id", "test", {
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(mockPlanApi.planPost).not.toHaveBeenCalled();
  });
});
