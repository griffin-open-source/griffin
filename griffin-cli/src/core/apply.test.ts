import { describe, it, expect, vi } from "vitest";
import { applyDiff } from "./apply.js";
import type { DiffResult } from "./diff.js";
import type { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import type { PlanDSL } from "@griffin-app/griffin-ts/types";
import type { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
// Helper to create a minimal test plan
function createPlan(name: string): PlanV1 {
  return {
    id: `plan-${name}`,
    name,
    project: "test-project",
    environment: "test",
    version: "1.0",
    frequency: { every: 5, unit: "MINUTE" },
    nodes: [],
    edges: [],
  };
}

describe("applyDiff", () => {
  it("should handle empty diff with no changes", async () => {
    const diff: DiffResult = {
      actions: [],
      summary: { creates: 0, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {} as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip noop actions", async () => {
    const plan = createPlan("health-check");
    const diff: DiffResult = {
      actions: [
        {
          type: "noop",
          plan: plan,
          remotePlan: plan,
          reason: "unchanged",
        },
      ],
      summary: { creates: 0, updates: 0, deletes: 0, noops: 1 },
    };

    const mockPlanApi = {} as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
  });

  it("should apply create action", async () => {
    const plan = createPlan("new-plan");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          plan: plan,
          remotePlan: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      postPlan: vi.fn().mockResolvedValue({
        data: { data: { ...plan, id: "created-id" } },
      }),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("create");
    expect(result.applied[0].planName).toBe("new-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with injected project and environment
    expect(mockPlanApi.postPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "new-plan",
          project: "test-project",
          environment: "test",
        }),
      }),
    );
  });

  it("should apply update action", async () => {
    const localPlan = createPlan("existing-plan");
    const remotePlan = { ...localPlan, id: "remote-id" };
    const diff: DiffResult = {
      actions: [
        {
          type: "update",
          plan: localPlan,
          remotePlan: remotePlan,
          reason: "changed",
        },
      ],
      summary: { creates: 0, updates: 1, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      putPlanById: vi.fn().mockResolvedValue({
        data: { data: remotePlan },
      }),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("update");
    expect(result.applied[0].planName).toBe("existing-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote plan's ID
    expect(mockPlanApi.putPlanById).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "existing-plan",
          project: "test-project",
          environment: "test",
        }),
        path: {
          id: "remote-id",
        },
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
      deletePlanById: vi.fn().mockResolvedValue({}),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("delete");
    expect(result.applied[0].planName).toBe("old-plan");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote plan's ID
    expect(mockPlanApi.deletePlanById).toHaveBeenCalledWith({
      path: {
        id: remotePlan.id,
      },
    });
  });

  it("should handle errors gracefully", async () => {
    const plan = createPlan("failing-plan");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          plan: plan,
          remotePlan: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      postPlan: vi.fn().mockRejectedValue(new Error("API Error")),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].success).toBe(false);
    expect(result.applied[0].error).toBe("API Error");
  });

  it("should skip actions in dry-run mode", async () => {
    const plan = createPlan("dry-run-plan");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          plan: plan,
          remotePlan: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockPlanApi = {
      postPlan: vi.fn(),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockPlanApi, {
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(mockPlanApi.postPlan).not.toHaveBeenCalled();
  });
});
