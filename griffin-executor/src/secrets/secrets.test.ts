import { describe, it, expect, beforeEach } from "vitest";
import { isSecretRef, isStringLiteral } from "./types.js";
import { SecretProviderRegistry } from "./registry.js";
import { EnvSecretProvider } from "./providers/env.js";
import {
  resolveSecretsInMonitor,
  collectSecretsFromMonitor,
  planHasSecrets,
} from "./resolver.js";
import { MonitorV1 } from "@griffin-app/griffin-hub-sdk";

// Helper to create a secret ref (mirrors the DSL's secret function)
function createSecretRef(path: string) {
  const colonIndex = path.indexOf(":");
  const provider = path.slice(0, colonIndex);
  const ref = path.slice(colonIndex + 1);
  return { $secret: { provider, ref } };
}

// Helper to create a string literal (mirrors the schema's StringLiteral)
function createStringLiteral(value: string) {
  return { $literal: value };
}

describe("Secret Types", () => {
  describe("isSecretRef", () => {
    it("should return true for valid secret refs", () => {
      expect(
        isSecretRef({ $secret: { provider: "env", ref: "API_KEY" } }),
      ).toBe(true);
      expect(
        isSecretRef({
          $secret: { provider: "aws", ref: "my-secret", version: "1" },
        }),
      ).toBe(true);
    });

    it("should return false for non-secret values", () => {
      expect(isSecretRef("string")).toBe(false);
      expect(isSecretRef(123)).toBe(false);
      expect(isSecretRef(null)).toBe(false);
      expect(isSecretRef(undefined)).toBe(false);
      expect(isSecretRef({})).toBe(false);
      expect(isSecretRef({ secret: { provider: "env", ref: "KEY" } })).toBe(
        false,
      ); // wrong key
      expect(isSecretRef({ $literal: "value" })).toBe(false); // string literal
    });
  });

  describe("isStringLiteral", () => {
    it("should return true for valid string literals", () => {
      expect(isStringLiteral({ $literal: "application/json" })).toBe(true);
      expect(isStringLiteral({ $literal: "" })).toBe(true);
      expect(isStringLiteral({ $literal: "Bearer token-123" })).toBe(true);
    });

    it("should return false for non-literal values", () => {
      expect(isStringLiteral("string")).toBe(false);
      expect(isStringLiteral(123)).toBe(false);
      expect(isStringLiteral(null)).toBe(false);
      expect(isStringLiteral(undefined)).toBe(false);
      expect(isStringLiteral({})).toBe(false);
      expect(isStringLiteral({ literal: "value" })).toBe(false); // wrong key
      expect(
        isStringLiteral({ $secret: { provider: "env", ref: "KEY" } }),
      ).toBe(false); // secret ref
    });
  });
});

describe("SecretProviderRegistry", () => {
  let registry: SecretProviderRegistry;

  beforeEach(() => {
    registry = new SecretProviderRegistry();
  });

  it("should register and retrieve providers", () => {
    const envProvider = new EnvSecretProvider();
    registry.register(envProvider);

    expect(registry.has("env")).toBe(true);
    expect(registry.get("env")).toBe(envProvider);
    expect(registry.getProviderNames()).toEqual(["env"]);
  });

  it("should throw when getting unregistered provider", () => {
    expect(() => registry.get("unknown")).toThrow(/not configured/);
  });

  it("should throw when registering duplicate provider", () => {
    const envProvider = new EnvSecretProvider();
    registry.register(envProvider);
    expect(() => registry.register(envProvider)).toThrow(/already registered/);
  });

  it("should resolve secrets using the correct provider", async () => {
    const envProvider = new EnvSecretProvider({
      env: { TEST_SECRET: "secret-value" },
    });
    registry.register(envProvider);

    const result = await registry.resolve({
      provider: "env",
      ref: "TEST_SECRET",
    });

    expect(result).toBe("secret-value");
  });
});

describe("EnvSecretProvider", () => {
  it("should resolve environment variables", async () => {
    const provider = new EnvSecretProvider({
      env: { MY_API_KEY: "test-key-123" },
    });

    const result = await provider.resolve("MY_API_KEY");
    expect(result).toBe("test-key-123");
  });

  it("should throw for missing environment variables", async () => {
    const provider = new EnvSecretProvider({ env: {} });

    await expect(provider.resolve("MISSING_VAR")).rejects.toThrow(/not set/);
  });

  it("should support prefix", async () => {
    const provider = new EnvSecretProvider({
      env: { APP_API_KEY: "prefixed-value" },
      prefix: "APP_",
    });

    const result = await provider.resolve("API_KEY");
    expect(result).toBe("prefixed-value");
  });
});

describe("Monitor Secret Resolution", () => {
  const createTestMonitor = (
    headers?: Record<string, any>,
    body?: any,
  ): MonitorV1 => ({
    id: "test-monitor-1",
    name: "Test Monitor",
    version: "1.0",
    environment: "default",
    project: "test-project",
    frequency: { every: 1, unit: "MINUTE" },
    nodes: [
      {
        id: "endpoint-1",
        type: "HTTP_REQUEST",
        method: "GET",
        path: "/api/test",
        base: "https://api.example.com",
        response_format: "JSON",
        headers,
        body,
      },
    ],
    edges: [
      { from: "__START__", to: "endpoint-1" },
      { from: "endpoint-1", to: "__END__" },
    ],
  });

  describe("planHasSecrets", () => {
    it("should return false for monitors without secrets or literals", () => {
      const monitor = createTestMonitor({ "Content-Type": "application/json" });
      expect(planHasSecrets(monitor)).toBe(false);
    });

    it("should return true for monitors with secret refs in headers", () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
      });
      expect(planHasSecrets(monitor)).toBe(true);
    });

    it("should return true for monitors with secret refs in body", () => {
      const monitor = createTestMonitor(undefined, {
        token: createSecretRef("env:TOKEN"),
      });
      expect(planHasSecrets(monitor)).toBe(true);
    });

    it("should return true for monitors with string literals in headers", () => {
      const monitor = createTestMonitor({
        "Content-Type": createStringLiteral("application/json"),
      });
      expect(planHasSecrets(monitor)).toBe(true);
    });

    it("should return true for monitors with string literals in body", () => {
      const monitor = createTestMonitor(undefined, {
        type: createStringLiteral("test"),
      });
      expect(planHasSecrets(monitor)).toBe(true);
    });
  });

  describe("collectSecretsFromMonitor", () => {
    it("should collect secrets from headers", () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
        "X-Custom": createSecretRef("aws:custom-secret"),
      });

      const collected = collectSecretsFromMonitor(monitor);

      expect(collected.refs).toHaveLength(2);
      expect(collected.refs).toContainEqual({
        provider: "env",
        ref: "API_KEY",
      });
      expect(collected.refs).toContainEqual({
        provider: "aws",
        ref: "custom-secret",
      });
    });

    it("should collect secrets from nested body", () => {
      const monitor = createTestMonitor(undefined, {
        auth: {
          token: createSecretRef("env:TOKEN"),
        },
        items: [{ key: createSecretRef("env:ITEM_KEY") }],
      });

      const collected = collectSecretsFromMonitor(monitor);

      expect(collected.refs).toHaveLength(2);
      expect(collected.refs).toContainEqual({ provider: "env", ref: "TOKEN" });
      expect(collected.refs).toContainEqual({
        provider: "env",
        ref: "ITEM_KEY",
      });
    });

    it("should deduplicate secret refs", () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
        "X-Backup-Auth": createSecretRef("env:API_KEY"),
      });

      const collected = collectSecretsFromMonitor(monitor);

      expect(collected.refs).toHaveLength(1);
      expect(collected.paths).toHaveLength(2);
    });

    it("should collect string literals from headers", () => {
      const monitor = createTestMonitor({
        "Content-Type": createStringLiteral("application/json"),
        Accept: createStringLiteral("application/xml"),
      });

      const collected = collectSecretsFromMonitor(monitor);

      expect(collected.refs).toHaveLength(0);
      expect(collected.literalPaths).toHaveLength(2);
      expect(collected.literalPaths).toContainEqual({
        path: ["nodes", 0, "headers", "Content-Type"],
        value: "application/json",
      });
      expect(collected.literalPaths).toContainEqual({
        path: ["nodes", 0, "headers", "Accept"],
        value: "application/xml",
      });
    });

    it("should collect both secrets and literals", () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
        "Content-Type": createStringLiteral("application/json"),
      });

      const collected = collectSecretsFromMonitor(monitor);

      expect(collected.refs).toHaveLength(1);
      expect(collected.refs).toContainEqual({
        provider: "env",
        ref: "API_KEY",
      });
      expect(collected.literalPaths).toHaveLength(1);
      expect(collected.literalPaths).toContainEqual({
        path: ["nodes", 0, "headers", "Content-Type"],
        value: "application/json",
      });
    });
  });

  describe("resolveSecretsInMonitor", () => {
    it("should resolve secrets in headers", async () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
        "Content-Type": "application/json",
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { API_KEY: "Bearer secret-token" },
        }),
      );

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      const endpoint = resolved.nodes[0];
      if (endpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(endpoint.headers?.Authorization).toBe("Bearer secret-token");
      expect(endpoint.headers?.["Content-Type"]).toBe("application/json");
    });

    it("should resolve secrets in body", async () => {
      const monitor = createTestMonitor(undefined, {
        token: createSecretRef("env:TOKEN"),
        data: "plain-value",
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { TOKEN: "resolved-token" },
        }),
      );

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      const endpoint = resolved.nodes[0];
      if (endpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect((endpoint.body as { token: string }).token).toBe("resolved-token");
      expect((endpoint.body as { data: string }).data).toBe("plain-value");
    });

    it("should not modify original monitor", async () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { API_KEY: "secret" },
        }),
      );

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      // Original should still have secret ref
      const originalEndpoint = monitor.nodes[0];
      if (originalEndpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(originalEndpoint.headers?.Authorization).toEqual(
        createSecretRef("env:API_KEY"),
      );

      // Resolved should have string
      const resolvedEndpoint = resolved.nodes[0];
      if (resolvedEndpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(resolvedEndpoint.headers?.Authorization).toBe("secret");
    });

    it("should throw for unregistered provider", async () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("unknown:API_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(new EnvSecretProvider({ env: {} }));

      await expect(resolveSecretsInMonitor(monitor, registry)).rejects.toThrow(
        /not configured/,
      );
    });

    it("should throw for missing secret", async () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:MISSING_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(new EnvSecretProvider({ env: {} }));

      await expect(resolveSecretsInMonitor(monitor, registry)).rejects.toThrow(
        /not set/,
      );
    });

    it("should unwrap string literals in headers", async () => {
      const monitor = createTestMonitor({
        "Content-Type": createStringLiteral("application/json"),
        Accept: createStringLiteral("application/xml"),
      });

      const registry = new SecretProviderRegistry();

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      const endpoint = resolved.nodes[0];
      if (endpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(endpoint.headers?.["Content-Type"]).toBe("application/json");
      expect(endpoint.headers?.Accept).toBe("application/xml");
    });

    it("should unwrap string literals in body", async () => {
      const monitor = createTestMonitor(undefined, {
        type: createStringLiteral("test-type"),
        data: "plain-value",
      });

      const registry = new SecretProviderRegistry();

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      const endpoint = resolved.nodes[0];
      if (endpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect((endpoint.body as { type: string }).type).toBe("test-type");
      expect((endpoint.body as { data: string }).data).toBe("plain-value");
    });

    it("should resolve both secrets and literals", async () => {
      const monitor = createTestMonitor({
        Authorization: createSecretRef("env:API_KEY"),
        "Content-Type": createStringLiteral("application/json"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { API_KEY: "Bearer secret-token" },
        }),
      );

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      const endpoint = resolved.nodes[0];
      if (endpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(endpoint.headers?.Authorization).toBe("Bearer secret-token");
      expect(endpoint.headers?.["Content-Type"]).toBe("application/json");
    });

    it("should not modify original monitor with literals", async () => {
      const monitor = createTestMonitor({
        "Content-Type": createStringLiteral("application/json"),
      });

      const registry = new SecretProviderRegistry();

      const resolved = await resolveSecretsInMonitor(monitor, registry);

      // Original should still have literal wrapper
      const originalEndpoint = monitor.nodes[0];
      if (originalEndpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(originalEndpoint.headers?.["Content-Type"]).toEqual(
        createStringLiteral("application/json"),
      );

      // Resolved should have unwrapped string
      const resolvedEndpoint = resolved.nodes[0];
      if (resolvedEndpoint.type !== "HTTP_REQUEST") {
        throw new Error("HttpRequest not found");
      }
      expect(resolvedEndpoint.headers?.["Content-Type"]).toBe(
        "application/json",
      );
    });
  });
});
