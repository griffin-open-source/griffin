/**
 * Tests for the migration framework
 */

import { describe, it, expect } from "vitest";
import {
  migrateMonitor,
  migrateToLatest,
  isSupportedVersion,
  getSupportedVersions,
} from "./migrations.js";
import { CURRENT_MONITOR_VERSION, SUPPORTED_MONITOR_VERSIONS } from "./schema.js";
import type { ResolvedMonitorV1 } from "./schema.js";

describe("migrations", () => {
  describe("isSupportedVersion", () => {
    it("should return true for supported versions", () => {
      expect(isSupportedVersion("1.0")).toBe(true);
    });

    it("should return false for unsupported versions", () => {
      expect(isSupportedVersion("99.0")).toBe(false);
      expect(isSupportedVersion("invalid")).toBe(false);
    });
  });

  describe("getSupportedVersions", () => {
    it("should return all supported versions", () => {
      const versions = getSupportedVersions();
      expect(versions).toEqual(SUPPORTED_MONITOR_VERSIONS);
      expect(versions).toContain("1.0");
    });
  });

  describe("migrateToLatest", () => {
    it("should return monitor unchanged if already at latest version", () => {
      const monitor: ResolvedMonitorV1 = {
        project: "test",
        id: "test-id",
        name: "test-monitor",
        version: "1.0",
        frequency: { every: 1, unit: "MINUTE" as any },
        environment: "default",
        nodes: [],
        edges: [],
      };

      const migrated = migrateToLatest(monitor);
      expect(migrated).toEqual(monitor);
      expect(migrated.version).toBe(CURRENT_MONITOR_VERSION);
    });

    it("should preserve all monitor properties", () => {
      const monitor: ResolvedMonitorV1 = {
        project: "test-project",
        id: "monitor-123",
        name: "my-test",
        version: "1.0",
        frequency: { every: 5, unit: "MINUTE" as any },
        environment: "production",
        locations: ["us-east-1", "eu-west-1"],
        nodes: [
          {
            id: "node1",
            type: "WAIT" as any,
            duration_ms: 1000,
          },
        ],
        edges: [
          { from: "START", to: "node1" },
          { from: "node1", to: "END" },
        ],
      };

      const migrated = migrateToLatest(monitor);
      expect(migrated.project).toBe(monitor.project);
      expect(migrated.id).toBe(monitor.id);
      expect(migrated.name).toBe(monitor.name);
      expect(migrated.frequency).toEqual(monitor.frequency);
      expect(migrated.environment).toBe(monitor.environment);
      expect(migrated.locations).toEqual(monitor.locations);
      expect(migrated.nodes).toEqual(monitor.nodes);
      expect(migrated.edges).toEqual(monitor.edges);
    });

    it("should throw error for unsupported version", () => {
      const monitor = {
        version: "99.0",
        name: "test",
      };

      expect(() => migrateToLatest(monitor)).toThrow("Unsupported monitor version");
    });
  });

  describe("migrateMonitor", () => {
    it("should migrate to specific target version", () => {
      const monitor: ResolvedMonitorV1 = {
        project: "test",
        id: "test-id",
        name: "test-monitor",
        version: "1.0",
        frequency: { every: 1, unit: "MINUTE" as any },
        environment: "default",
        nodes: [],
        edges: [],
      };

      const migrated = migrateMonitor(monitor, "1.0");
      expect(migrated).toEqual(monitor);
    });

    it("should throw error if no migration path exists", () => {
      const monitor = {
        version: "1.0",
        name: "test",
      };

      // Trying to migrate to a non-existent version
      expect(() => migrateMonitor(monitor, "99.0")).toThrow();
    });
  });

  describe("future version migration (when v2.0 is added)", () => {
    it("should document expected behavior for v1 to v2 migration", () => {
      // This test documents the expected behavior when v2.0 is added
      // Uncomment and update when v2.0 is implemented:
      //
      // const v1Monitor: ResolvedMonitorV1 = {
      //   project: "test",
      //   id: "test-id",
      //   name: "test-monitor",
      //   version: "1.0",
      //   frequency: { every: 1, unit: "MINUTE" },
      //   environment: "default",
      //   nodes: [],
      //   edges: [],
      // };
      //
      // const v2Monitor = migrateMonitor<ResolvedMonitorV2>(v1Monitor, "2.0");
      // expect(v2Monitor.version).toBe("2.0");
      // expect(v2Monitor.name).toBe(v1Monitor.name);
      // // Add assertions for new v2 fields

      expect(true).toBe(true); // Placeholder
    });
  });
});
