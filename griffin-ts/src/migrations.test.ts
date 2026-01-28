/**
 * Tests for the migration framework
 */

import { describe, it, expect } from "vitest";
import {
  migratePlan,
  migrateToLatest,
  isSupportedVersion,
  getSupportedVersions,
} from "./migrations.js";
import { CURRENT_PLAN_VERSION, SUPPORTED_PLAN_VERSIONS } from "./schema.js";
import type { ResolvedPlanV1 } from "./schema.js";

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
      expect(versions).toEqual(SUPPORTED_PLAN_VERSIONS);
      expect(versions).toContain("1.0");
    });
  });

  describe("migrateToLatest", () => {
    it("should return plan unchanged if already at latest version", () => {
      const plan: ResolvedPlanV1 = {
        project: "test",
        id: "test-id",
        name: "test-plan",
        version: "1.0",
        frequency: { every: 1, unit: "MINUTE" as any },
        environment: "default",
        nodes: [],
        edges: [],
      };

      const migrated = migrateToLatest(plan);
      expect(migrated).toEqual(plan);
      expect(migrated.version).toBe(CURRENT_PLAN_VERSION);
    });

    it("should preserve all plan properties", () => {
      const plan: ResolvedPlanV1 = {
        project: "test-project",
        id: "plan-123",
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

      const migrated = migrateToLatest(plan);
      expect(migrated.project).toBe(plan.project);
      expect(migrated.id).toBe(plan.id);
      expect(migrated.name).toBe(plan.name);
      expect(migrated.frequency).toEqual(plan.frequency);
      expect(migrated.environment).toBe(plan.environment);
      expect(migrated.locations).toEqual(plan.locations);
      expect(migrated.nodes).toEqual(plan.nodes);
      expect(migrated.edges).toEqual(plan.edges);
    });

    it("should throw error for unsupported version", () => {
      const plan = {
        version: "99.0",
        name: "test",
      };

      expect(() => migrateToLatest(plan)).toThrow("Unsupported plan version");
    });
  });

  describe("migratePlan", () => {
    it("should migrate to specific target version", () => {
      const plan: ResolvedPlanV1 = {
        project: "test",
        id: "test-id",
        name: "test-plan",
        version: "1.0",
        frequency: { every: 1, unit: "MINUTE" as any },
        environment: "default",
        nodes: [],
        edges: [],
      };

      const migrated = migratePlan(plan, "1.0");
      expect(migrated).toEqual(plan);
    });

    it("should throw error if no migration path exists", () => {
      const plan = {
        version: "1.0",
        name: "test",
      };

      // Trying to migrate to a non-existent version
      expect(() => migratePlan(plan, "99.0")).toThrow();
    });
  });

  describe("future version migration (when v2.0 is added)", () => {
    it("should document expected behavior for v1 to v2 migration", () => {
      // This test documents the expected behavior when v2.0 is added
      // Uncomment and update when v2.0 is implemented:
      //
      // const v1Plan: ResolvedPlanV1 = {
      //   project: "test",
      //   id: "test-id",
      //   name: "test-plan",
      //   version: "1.0",
      //   frequency: { every: 1, unit: "MINUTE" },
      //   environment: "default",
      //   nodes: [],
      //   edges: [],
      // };
      //
      // const v2Plan = migratePlan<ResolvedPlanV2>(v1Plan, "2.0");
      // expect(v2Plan.version).toBe("2.0");
      // expect(v2Plan.name).toBe(v1Plan.name);
      // // Add assertions for new v2 fields

      expect(true).toBe(true); // Placeholder
    });
  });
});
