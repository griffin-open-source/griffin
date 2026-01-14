import { describe, it, expect, beforeEach } from "vitest";
import { secret, isSecretRef } from "./types.js";
import { SecretProviderRegistry } from "./registry.js";
import { EnvSecretProvider } from "./providers/env.js";
import {
  resolveSecretsInPlan,
  collectSecretsFromPlan,
  planHasSecrets,
} from "./resolver.js";
import { NodeType, ResponseFormat, HttpMethod, type TestPlanV1 } from "../schemas.js";

// Helper to create a secret ref (mirrors the DSL's secret function)
function createSecretRef(path: string) {
  const colonIndex = path.indexOf(":");
  const provider = path.slice(0, colonIndex);
  const ref = path.slice(colonIndex + 1);
  return { $secret: { provider, ref } };
}

describe("Secret Types", () => {
  describe("isSecretRef", () => {
    it("should return true for valid secret refs", () => {
      expect(isSecretRef({ $secret: { provider: "env", ref: "API_KEY" } })).toBe(true);
      expect(isSecretRef({ $secret: { provider: "aws", ref: "my-secret", version: "1" } })).toBe(true);
    });

    it("should return false for non-secret values", () => {
      expect(isSecretRef("string")).toBe(false);
      expect(isSecretRef(123)).toBe(false);
      expect(isSecretRef(null)).toBe(false);
      expect(isSecretRef(undefined)).toBe(false);
      expect(isSecretRef({})).toBe(false);
      expect(isSecretRef({ secret: { provider: "env", ref: "KEY" } })).toBe(false); // wrong key
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

describe("Plan Secret Resolution", () => {
  const createTestPlan = (headers?: Record<string, any>, body?: any): TestPlanV1 => ({
    id: "test-plan-1",
    name: "Test Plan",
    version: "1.0",
    endpoint_host: "http://localhost:3000",
    nodes: [
      {
        id: "endpoint-1",
        data: {
          type: NodeType.ENDPOINT,
          method: HttpMethod.GET,
          path: "/api/test",
          response_format: ResponseFormat.JSON,
          headers,
          body,
        },
      },
    ],
    edges: [
      { from: "__START__", to: "endpoint-1" },
      { from: "endpoint-1", to: "__END__" },
    ],
  });

  describe("planHasSecrets", () => {
    it("should return false for plans without secrets", () => {
      const plan = createTestPlan({ "Content-Type": "application/json" });
      expect(planHasSecrets(plan)).toBe(false);
    });

    it("should return true for plans with secret refs in headers", () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:API_KEY"),
      });
      expect(planHasSecrets(plan)).toBe(true);
    });

    it("should return true for plans with secret refs in body", () => {
      const plan = createTestPlan(undefined, {
        token: createSecretRef("env:TOKEN"),
      });
      expect(planHasSecrets(plan)).toBe(true);
    });
  });

  describe("collectSecretsFromPlan", () => {
    it("should collect secrets from headers", () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:API_KEY"),
        "X-Custom": createSecretRef("aws:custom-secret"),
      });

      const collected = collectSecretsFromPlan(plan);

      expect(collected.refs).toHaveLength(2);
      expect(collected.refs).toContainEqual({ provider: "env", ref: "API_KEY" });
      expect(collected.refs).toContainEqual({ provider: "aws", ref: "custom-secret" });
    });

    it("should collect secrets from nested body", () => {
      const plan = createTestPlan(undefined, {
        auth: {
          token: createSecretRef("env:TOKEN"),
        },
        items: [{ key: createSecretRef("env:ITEM_KEY") }],
      });

      const collected = collectSecretsFromPlan(plan);

      expect(collected.refs).toHaveLength(2);
      expect(collected.refs).toContainEqual({ provider: "env", ref: "TOKEN" });
      expect(collected.refs).toContainEqual({ provider: "env", ref: "ITEM_KEY" });
    });

    it("should deduplicate secret refs", () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:API_KEY"),
        "X-Backup-Auth": createSecretRef("env:API_KEY"),
      });

      const collected = collectSecretsFromPlan(plan);

      expect(collected.refs).toHaveLength(1);
      expect(collected.paths).toHaveLength(2);
    });
  });

  describe("resolveSecretsInPlan", () => {
    it("should resolve secrets in headers", async () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:API_KEY"),
        "Content-Type": "application/json",
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { API_KEY: "Bearer secret-token" },
        })
      );

      const resolved = await resolveSecretsInPlan(plan, registry);

      const endpoint = resolved.nodes[0].data as any;
      expect(endpoint.headers.Authorization).toBe("Bearer secret-token");
      expect(endpoint.headers["Content-Type"]).toBe("application/json");
    });

    it("should resolve secrets in body", async () => {
      const plan = createTestPlan(undefined, {
        token: createSecretRef("env:TOKEN"),
        data: "plain-value",
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { TOKEN: "resolved-token" },
        })
      );

      const resolved = await resolveSecretsInPlan(plan, registry);

      const endpoint = resolved.nodes[0].data as any;
      expect(endpoint.body.token).toBe("resolved-token");
      expect(endpoint.body.data).toBe("plain-value");
    });

    it("should not modify original plan", async () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:API_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(
        new EnvSecretProvider({
          env: { API_KEY: "secret" },
        })
      );

      const resolved = await resolveSecretsInPlan(plan, registry);

      // Original should still have secret ref
      const originalEndpoint = plan.nodes[0].data as any;
      expect(originalEndpoint.headers.Authorization).toEqual(
        createSecretRef("env:API_KEY")
      );

      // Resolved should have string
      const resolvedEndpoint = resolved.nodes[0].data as any;
      expect(resolvedEndpoint.headers.Authorization).toBe("secret");
    });

    it("should throw for unregistered provider", async () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("unknown:API_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(new EnvSecretProvider({ env: {} }));

      await expect(resolveSecretsInPlan(plan, registry)).rejects.toThrow(
        /not configured/
      );
    });

    it("should throw for missing secret", async () => {
      const plan = createTestPlan({
        Authorization: createSecretRef("env:MISSING_KEY"),
      });

      const registry = new SecretProviderRegistry();
      registry.register(new EnvSecretProvider({ env: {} }));

      await expect(resolveSecretsInPlan(plan, registry)).rejects.toThrow(
        /not set/
      );
    });
  });
});
