import { describe, it, expect, vi } from "vitest";
import { applyDiff } from "./apply.js";
import type { DiffResult } from "./diff.js";
import type { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import type { MonitorDSL } from "@griffin-app/griffin-ts/types";
import type { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
// Helper to create a minimal test monitor
function createMonitor(name: string): MonitorV1 {
  return {
    id: `monitor-${name}`,
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

    const mockMonitorApi = {} as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip noop actions", async () => {
    const monitor = createMonitor("health-check");
    const diff: DiffResult = {
      actions: [
        {
          type: "noop",
          monitor: monitor,
          remoteMonitor: monitor,
          reason: "unchanged",
        },
      ],
      summary: { creates: 0, updates: 0, deletes: 0, noops: 1 },
    };

    const mockMonitorApi = {} as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
  });

  it("should apply create action", async () => {
    const monitor = createMonitor("new-monitor");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          monitor: monitor,
          remoteMonitor: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockMonitorApi = {
      postMonitor: vi.fn().mockResolvedValue({
        data: { data: { ...monitor, id: "created-id" } },
      }),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("create");
    expect(result.applied[0].monitorName).toBe("new-monitor");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with injected project and environment
    expect(mockMonitorApi.postMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "new-monitor",
          project: "test-project",
          environment: "test",
        }),
      }),
    );
  });

  it("should apply update action", async () => {
    const localMonitor = createMonitor("existing-monitor");
    const remoteMonitor = { ...localMonitor, id: "remote-id" };
    const diff: DiffResult = {
      actions: [
        {
          type: "update",
          monitor: localMonitor,
          remoteMonitor: remoteMonitor,
          reason: "changed",
        },
      ],
      summary: { creates: 0, updates: 1, deletes: 0, noops: 0 },
    };

    const mockMonitorApi = {
      putMonitorById: vi.fn().mockResolvedValue({
        data: { data: remoteMonitor },
      }),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("update");
    expect(result.applied[0].monitorName).toBe("existing-monitor");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote monitor's ID
    expect(mockMonitorApi.putMonitorById).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "existing-monitor",
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
    const remoteMonitor = createMonitor("old-monitor");
    const diff: DiffResult = {
      actions: [{ type: "delete", monitor: null, remoteMonitor, reason: "removed" }],
      summary: { creates: 0, updates: 0, deletes: 1, noops: 0 },
    };

    const mockMonitorApi = {
      deleteMonitorById: vi.fn().mockResolvedValue({}),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].type).toBe("delete");
    expect(result.applied[0].monitorName).toBe("old-monitor");
    expect(result.applied[0].success).toBe(true);

    // Verify the API was called with the remote monitor's ID
    expect(mockMonitorApi.deleteMonitorById).toHaveBeenCalledWith({
      path: {
        id: remoteMonitor.id,
      },
    });
  });

  it("should handle errors gracefully", async () => {
    const monitor = createMonitor("failing-monitor");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          monitor: monitor,
          remoteMonitor: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockMonitorApi = {
      postMonitor: vi.fn().mockRejectedValue(new Error("API Error")),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].success).toBe(false);
    expect(result.applied[0].error).toBe("API Error");
  });

  it("should skip actions in dry-run mode", async () => {
    const monitor = createMonitor("dry-run-monitor");
    const diff: DiffResult = {
      actions: [
        {
          type: "create",
          monitor: monitor,
          remoteMonitor: null,
          reason: "new",
        },
      ],
      summary: { creates: 1, updates: 0, deletes: 0, noops: 0 },
    };

    const mockMonitorApi = {
      postMonitor: vi.fn(),
    } as unknown as GriffinHubSdk;

    const result = await applyDiff(diff, mockMonitorApi, {
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.applied).toHaveLength(0);
    expect(mockMonitorApi.postMonitor).not.toHaveBeenCalled();
  });
});
