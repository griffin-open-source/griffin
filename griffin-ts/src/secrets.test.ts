import { describe, it, expect } from "vitest";
import { secret, isSecretRef } from "./secrets.js";

describe("Secret References", () => {
  describe("Basic Secret Creation", () => {
    it("should create environment variable secret", () => {
      const ref = secret("env:API_KEY");

      expect(ref).toEqual({
        $secret: {
          provider: "env",
          ref: "API_KEY",
        },
      });
    });

    it("should create AWS Secrets Manager secret", () => {
      const ref = secret("aws:prod/api-key");

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/api-key",
        },
      });
    });

    it("should create Vault secret", () => {
      const ref = secret("vault:secret/data/api");

      expect(ref).toEqual({
        $secret: {
          provider: "vault",
          ref: "secret/data/api",
        },
      });
    });

    it("should create Doppler secret", () => {
      const ref = secret("doppler:backend/prod/API_KEY");

      expect(ref).toEqual({
        $secret: {
          provider: "doppler",
          ref: "backend/prod/API_KEY",
        },
      });
    });
  });

  describe("Secret Options", () => {
    it("should include version when specified", () => {
      const ref = secret("aws:prod/api-key", { version: "v1.2.3" });

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/api-key",
          version: "v1.2.3",
        },
      });
    });

    it("should include field when specified", () => {
      const ref = secret("aws:prod/db-credentials", { field: "password" });

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/db-credentials",
          field: "password",
        },
      });
    });

    it("should include both version and field", () => {
      const ref = secret("aws:prod/db-credentials", {
        version: "latest",
        field: "username",
      });

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/db-credentials",
          version: "latest",
          field: "username",
        },
      });
    });
  });

  describe("Provider Formats", () => {
    it("should handle various provider names", () => {
      expect(secret("custom:my-secret")).toEqual({
        $secret: { provider: "custom", ref: "my-secret" },
      });

      expect(secret("gcp:my-secret")).toEqual({
        $secret: { provider: "gcp", ref: "my-secret" },
      });

      expect(secret("azure:my-secret")).toEqual({
        $secret: { provider: "azure", ref: "my-secret" },
      });
    });

    it("should handle refs with multiple slashes", () => {
      const ref = secret("aws:path/to/nested/secret");

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "path/to/nested/secret",
        },
      });
    });

    it("should handle refs with special characters", () => {
      const ref = secret("env:API_KEY_123");

      expect(ref).toEqual({
        $secret: {
          provider: "env",
          ref: "API_KEY_123",
        },
      });
    });

    it("should handle refs with hyphens and underscores", () => {
      const ref = secret("aws:prod/my-api_key-v2");

      expect(ref).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/my-api_key-v2",
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error when missing colon", () => {
      expect(() => secret("no-colon-here")).toThrow(
        'Secret path must include provider: "provider:path"',
      );
    });

    it("should throw error when provider is empty", () => {
      expect(() => secret(":my-secret")).toThrow(
        "Secret path must have a provider name before the colon",
      );
    });

    it("should throw error when ref is empty", () => {
      expect(() => secret("aws:")).toThrow(
        "Secret path must have a reference after the colon",
      );
    });
  });

  describe("Type Guard", () => {
    it("should identify valid secret refs", () => {
      const ref = secret("env:API_KEY");
      expect(isSecretRef(ref)).toBe(true);
    });

    it("should identify secret refs with options", () => {
      const ref = secret("aws:key", { version: "v1", field: "password" });
      expect(isSecretRef(ref)).toBe(true);
    });

    it("should reject non-objects", () => {
      expect(isSecretRef(null)).toBe(false);
      expect(isSecretRef(undefined)).toBe(false);
      expect(isSecretRef("string")).toBe(false);
      expect(isSecretRef(123)).toBe(false);
      expect(isSecretRef(true)).toBe(false);
    });

    it("should reject objects without $secret", () => {
      expect(isSecretRef({ foo: "bar" })).toBe(false);
      expect(isSecretRef({})).toBe(false);
    });

    it("should reject objects with invalid $secret", () => {
      expect(isSecretRef({ $secret: null })).toBe(false);
      expect(isSecretRef({ $secret: "string" })).toBe(false);
      expect(isSecretRef({ $secret: {} })).toBe(false);
      expect(isSecretRef({ $secret: { provider: "aws" } })).toBe(false);
      expect(isSecretRef({ $secret: { ref: "key" } })).toBe(false);
    });

    it("should accept valid $secret structure", () => {
      expect(
        isSecretRef({
          $secret: { provider: "aws", ref: "key" },
        }),
      ).toBe(true);

      expect(
        isSecretRef({
          $secret: { provider: "env", ref: "VAR", version: "v1" },
        }),
      ).toBe(true);

      expect(
        isSecretRef({
          $secret: { provider: "vault", ref: "path", field: "password" },
        }),
      ).toBe(true);
    });
  });

  describe("Integration Examples", () => {
    it("should work in header configurations", () => {
      const headers = {
        Authorization: secret("env:API_TOKEN"),
        "X-API-Key": secret("aws:prod/api-key"),
      };

      expect(headers["Authorization"]).toEqual({
        $secret: { provider: "env", ref: "API_TOKEN" },
      });
      expect(headers["X-API-Key"]).toEqual({
        $secret: { provider: "aws", ref: "prod/api-key" },
      });
    });

    it("should work in body configurations", () => {
      const body = {
        apiKey: secret("env:API_KEY"),
        dbPassword: secret("aws:prod/db-password", { field: "password" }),
      };

      expect(body.apiKey).toEqual({
        $secret: { provider: "env", ref: "API_KEY" },
      });
      expect(body.dbPassword).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/db-password",
          field: "password",
        },
      });
    });

    it("should work with nested objects", () => {
      const config = {
        database: {
          host: "localhost",
          credentials: {
            username: secret("vault:db/username"),
            password: secret("vault:db/password"),
          },
        },
      };

      expect(config.database.credentials.username).toEqual({
        $secret: { provider: "vault", ref: "db/username" },
      });
      expect(config.database.credentials.password).toEqual({
        $secret: { provider: "vault", ref: "db/password" },
      });
    });
  });

  describe("Real-world Provider Examples", () => {
    it("should handle AWS Secrets Manager paths", () => {
      expect(secret("aws:production/api/key")).toEqual({
        $secret: { provider: "aws", ref: "production/api/key" },
      });

      expect(secret("aws:prod/rds/credentials")).toEqual({
        $secret: { provider: "aws", ref: "prod/rds/credentials" },
      });
    });

    it("should handle HashiCorp Vault paths", () => {
      expect(secret("vault:secret/data/api")).toEqual({
        $secret: { provider: "vault", ref: "secret/data/api" },
      });

      expect(secret("vault:kv/prod/database")).toEqual({
        $secret: { provider: "vault", ref: "kv/prod/database" },
      });
    });

    it("should handle environment variables", () => {
      expect(secret("env:DATABASE_URL")).toEqual({
        $secret: { provider: "env", ref: "DATABASE_URL" },
      });

      expect(secret("env:API_KEY")).toEqual({
        $secret: { provider: "env", ref: "API_KEY" },
      });
    });
  });
});
