import { describe, it, expect } from "vitest";
import { variable, isVariableRef } from "./variable.js";

describe("Variable References", () => {
  describe("Basic Variable Creation", () => {
    it("should create simple variable reference", () => {
      const ref = variable("api-host");

      expect(ref).toEqual({
        $variable: {
          key: "api-host",
        },
      });
    });

    it("should create variable with different key names", () => {
      expect(variable("base-url")).toEqual({
        $variable: { key: "base-url" },
      });

      expect(variable("api_version")).toEqual({
        $variable: { key: "api_version" },
      });

      expect(variable("API_KEY")).toEqual({
        $variable: { key: "API_KEY" },
      });
    });

    it("should trim whitespace from keys", () => {
      const ref = variable("  api-host  ");

      expect(ref).toEqual({
        $variable: {
          key: "api-host",
        },
      });
    });
  });

  describe("Templated Variables", () => {
    it("should create variable with template", () => {
      const ref = variable("api-version", "/api/${api-version}/health");

      expect(ref).toEqual({
        $variable: {
          key: "api-version",
          template: "/api/${api-version}/health",
        },
      });
    });

    it("should support templates with single placeholder", () => {
      const ref = variable("user-id", "/users/${user-id}");

      expect(ref).toEqual({
        $variable: {
          key: "user-id",
          template: "/users/${user-id}",
        },
      });
    });

    it("should support templates with text before placeholder", () => {
      const ref = variable("version", "v${version}");

      expect(ref).toEqual({
        $variable: {
          key: "version",
          template: "v${version}",
        },
      });
    });

    it("should support templates with text after placeholder", () => {
      const ref = variable("format", "${format}.json");

      expect(ref).toEqual({
        $variable: {
          key: "format",
          template: "${format}.json",
        },
      });
    });

    it("should support complex templates", () => {
      const ref = variable("env", "https://${env}.api.example.com/v1");

      expect(ref).toEqual({
        $variable: {
          key: "env",
          template: "https://${env}.api.example.com/v1",
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error when key is empty string", () => {
      expect(() => variable("")).toThrow(
        "Variable key must be a non-empty string",
      );
    });

    it("should throw error when key is whitespace only", () => {
      expect(() => variable("   ")).toThrow(
        "Variable key cannot be empty or whitespace only",
      );
    });

    it("should throw error when key is not a string", () => {
      expect(() => variable(null as any)).toThrow(
        "Variable key must be a non-empty string",
      );

      expect(() => variable(undefined as any)).toThrow(
        "Variable key must be a non-empty string",
      );

      expect(() => variable(123 as any)).toThrow(
        "Variable key must be a non-empty string",
      );
    });

    it("should throw error when template is not a string", () => {
      expect(() => variable("key", 123 as any)).toThrow(
        "Variable template must be a string",
      );
    });

    it("should throw error when template is empty", () => {
      expect(() => variable("key", "")).toThrow(
        "Variable template cannot be empty or whitespace only",
      );

      expect(() => variable("key", "   ")).toThrow(
        "Variable template cannot be empty or whitespace only",
      );
    });

    it("should throw error when template doesn't contain key placeholder", () => {
      expect(() => variable("api-version", "/api/v1/health")).toThrow(
        "Variable template must contain ${api-version} placeholder",
      );
    });

    it("should throw error when template has wrong placeholder", () => {
      expect(() => variable("api-version", "/api/${wrong-key}/health")).toThrow(
        "Variable template must contain ${api-version} placeholder",
      );
    });
  });

  describe("Type Guard", () => {
    it("should identify valid variable refs", () => {
      const ref = variable("api-host");
      expect(isVariableRef(ref)).toBe(true);
    });

    it("should identify variable refs with templates", () => {
      const ref = variable("version", "v${version}");
      expect(isVariableRef(ref)).toBe(true);
    });

    it("should reject non-objects", () => {
      expect(isVariableRef(null)).toBe(false);
      expect(isVariableRef(undefined)).toBe(false);
      expect(isVariableRef("string")).toBe(false);
      expect(isVariableRef(123)).toBe(false);
      expect(isVariableRef(true)).toBe(false);
    });

    it("should reject objects without $variable", () => {
      expect(isVariableRef({ foo: "bar" })).toBe(false);
      expect(isVariableRef({})).toBe(false);
    });

    it("should reject objects with invalid $variable", () => {
      expect(isVariableRef({ $variable: null })).toBe(false);
      expect(isVariableRef({ $variable: "string" })).toBe(false);
      expect(isVariableRef({ $variable: {} })).toBe(false);
      expect(isVariableRef({ $variable: { key: 123 } })).toBe(false);
      expect(isVariableRef({ $variable: { template: "value" } })).toBe(false);
    });

    it("should accept valid $variable structure", () => {
      expect(
        isVariableRef({
          $variable: { key: "api-host" },
        }),
      ).toBe(true);

      expect(
        isVariableRef({
          $variable: { key: "version", template: "v${version}" },
        }),
      ).toBe(true);
    });

    it("should reject $variable with invalid template type", () => {
      expect(
        isVariableRef({
          $variable: { key: "test", template: 123 },
        }),
      ).toBe(false);
    });
  });

  describe("Integration Examples", () => {
    it("should work for base URLs", () => {
      const baseUrl = variable("api-host");

      expect(baseUrl).toEqual({
        $variable: { key: "api-host" },
      });
    });

    it("should work for paths", () => {
      const path = variable("user-id", "/users/${user-id}/profile");

      expect(path).toEqual({
        $variable: {
          key: "user-id",
          template: "/users/${user-id}/profile",
        },
      });
    });

    it("should work in endpoint configurations", () => {
      const config = {
        base: variable("api-gateway"),
        path: variable("api-version", "/api/${api-version}/health"),
      };

      expect(config.base).toEqual({
        $variable: { key: "api-gateway" },
      });
      expect(config.path).toEqual({
        $variable: {
          key: "api-version",
          template: "/api/${api-version}/health",
        },
      });
    });
  });

  describe("Common Use Cases", () => {
    it("should handle environment-specific URLs", () => {
      expect(variable("environment", "https://${environment}.api.com")).toEqual(
        {
          $variable: {
            key: "environment",
            template: "https://${environment}.api.com",
          },
        },
      );
    });

    it("should handle versioned API paths", () => {
      expect(variable("version", "/api/${version}/users")).toEqual({
        $variable: {
          key: "version",
          template: "/api/${version}/users",
        },
      });
    });

    it("should handle resource IDs in paths", () => {
      expect(variable("resource-id", "/resources/${resource-id}")).toEqual({
        $variable: {
          key: "resource-id",
          template: "/resources/${resource-id}",
        },
      });
    });

    it("should handle tenant-specific URLs", () => {
      expect(variable("tenant", "https://${tenant}.service.com/api")).toEqual({
        $variable: {
          key: "tenant",
          template: "https://${tenant}.service.com/api",
        },
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle keys with numbers", () => {
      expect(variable("api-v2")).toEqual({
        $variable: { key: "api-v2" },
      });
    });

    it("should handle keys with underscores", () => {
      expect(variable("api_base_url")).toEqual({
        $variable: { key: "api_base_url" },
      });
    });

    it("should handle uppercase keys", () => {
      expect(variable("API_HOST")).toEqual({
        $variable: { key: "API_HOST" },
      });
    });

    it("should handle mixed case keys", () => {
      expect(variable("ApiHost")).toEqual({
        $variable: { key: "ApiHost" },
      });
    });

    it("should handle templates with multiple text segments", () => {
      const ref = variable("id", "prefix-${id}-suffix");

      expect(ref).toEqual({
        $variable: {
          key: "id",
          template: "prefix-${id}-suffix",
        },
      });
    });

    it("should handle templates with special characters", () => {
      const ref = variable("path", "/api/${path}?query=value");

      expect(ref).toEqual({
        $variable: {
          key: "path",
          template: "/api/${path}?query=value",
        },
      });
    });
  });
});
