/**
 * HashiCorp Vault secret provider.
 *
 * Reads secrets from HashiCorp Vault KV secrets engine (v1 and v2).
 * Supports field extraction from JSON secrets.
 *
 * Usage in DSL:
 *   secret("vault:secret/data/myapp/config")
 *   secret("vault:secret/data/myapp/config", { field: "api_key" })
 *   secret("vault:secret/data/myapp/config", { version: "2" })
 */

import type { SecretProvider, SecretResolveOptions } from "../types.js";
import { SecretResolutionError } from "../types.js";

/**
 * HTTP client interface for Vault API calls.
 * This allows dependency injection without requiring a specific HTTP library.
 */
export interface VaultHttpClient {
  get(
    url: string,
    options: { headers: Record<string, string> }
  ): Promise<{
    status: number;
    data: unknown;
  }>;
}

export interface VaultProviderOptions {
  /**
   * Vault server address (e.g., "https://vault.example.com:8200").
   */
  address: string;

  /**
   * Authentication token.
   */
  token: string;

  /**
   * HTTP client for making requests to Vault.
   */
  httpClient: VaultHttpClient;

  /**
   * Optional namespace for Vault Enterprise.
   */
  namespace?: string;

  /**
   * KV secrets engine version (1 or 2).
   * Defaults to 2.
   */
  kvVersion?: 1 | 2;

  /**
   * Optional prefix for secret paths.
   */
  prefix?: string;
}

export class VaultProvider implements SecretProvider {
  readonly name = "vault";
  private readonly address: string;
  private readonly token: string;
  private readonly httpClient: VaultHttpClient;
  private readonly namespace?: string;
  private readonly kvVersion: 1 | 2;
  private readonly prefix: string;

  // Simple in-memory cache with TTL
  private cache = new Map<string, { value: Record<string, unknown>; expires: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(options: VaultProviderOptions) {
    this.address = options.address.replace(/\/$/, ""); // Remove trailing slash
    this.token = options.token;
    this.httpClient = options.httpClient;
    this.namespace = options.namespace;
    this.kvVersion = options.kvVersion ?? 2;
    this.prefix = options.prefix ?? "";
  }

  async resolve(ref: string, options?: SecretResolveOptions): Promise<string> {
    const secretPath = this.prefix + ref;
    const version = options?.version;
    const cacheKey = `${secretPath}:${version ?? "latest"}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return this.extractField(cached.value, options?.field, ref);
    }

    try {
      // Build request URL
      let url = `${this.address}/v1/${secretPath}`;
      if (this.kvVersion === 2 && version) {
        url += `?version=${version}`;
      }

      // Build headers
      const headers: Record<string, string> = {
        "X-Vault-Token": this.token,
      };
      if (this.namespace) {
        headers["X-Vault-Namespace"] = this.namespace;
      }

      const response = await this.httpClient.get(url, { headers });

      if (response.status === 404) {
        throw new SecretResolutionError(
          `Secret "${secretPath}" not found in Vault`,
          { provider: this.name, ref }
        );
      }

      if (response.status === 403) {
        throw new SecretResolutionError(
          `Access denied to secret "${secretPath}". Check Vault policies.`,
          { provider: this.name, ref }
        );
      }

      if (response.status !== 200) {
        throw new SecretResolutionError(
          `Vault returned status ${response.status} for secret "${secretPath}"`,
          { provider: this.name, ref }
        );
      }

      // Parse response based on KV version
      const data = response.data as {
        data?: Record<string, unknown> | { data?: Record<string, unknown> };
      };

      let secretData: Record<string, unknown>;

      if (this.kvVersion === 2) {
        // KV v2 wraps data in an extra "data" object
        const kvData = data?.data as { data?: Record<string, unknown> } | undefined;
        if (!kvData?.data) {
          throw new SecretResolutionError(
            `Invalid KV v2 response structure for secret "${secretPath}"`,
            { provider: this.name, ref }
          );
        }
        secretData = kvData.data;
      } else {
        // KV v1 has data directly
        if (!data?.data || typeof data.data !== "object") {
          throw new SecretResolutionError(
            `Invalid KV v1 response structure for secret "${secretPath}"`,
            { provider: this.name, ref }
          );
        }
        secretData = data.data as Record<string, unknown>;
      }

      // Cache the secret data
      this.cache.set(cacheKey, {
        value: secretData,
        expires: Date.now() + this.cacheTtlMs,
      });

      return this.extractField(secretData, options?.field, ref);
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        throw error;
      }

      throw new SecretResolutionError(
        `Failed to retrieve secret "${secretPath}" from Vault: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { provider: this.name, ref, cause: error }
      );
    }
  }

  /**
   * Extract a field from the secret data.
   * If no field is specified, returns the entire data as JSON string.
   */
  private extractField(
    secretData: Record<string, unknown>,
    field: string | undefined,
    ref: string
  ): string {
    if (!field) {
      // Return entire secret as JSON if no field specified
      return JSON.stringify(secretData);
    }

    const value = secretData[field];

    if (value === undefined) {
      throw new SecretResolutionError(
        `Field "${field}" not found in secret "${ref}"`,
        { provider: this.name, ref }
      );
    }

    // Convert to string if not already
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  async validate(): Promise<void> {
    // Verify we can authenticate with Vault
    try {
      const headers: Record<string, string> = {
        "X-Vault-Token": this.token,
      };
      if (this.namespace) {
        headers["X-Vault-Namespace"] = this.namespace;
      }

      const response = await this.httpClient.get(
        `${this.address}/v1/auth/token/lookup-self`,
        { headers }
      );

      if (response.status === 403) {
        throw new Error("Invalid or expired Vault token");
      }

      if (response.status !== 200) {
        throw new Error(`Vault authentication check failed with status ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Vault")) {
        throw error;
      }
      throw new Error(
        `Failed to connect to Vault at ${this.address}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clear the cache. Useful for testing or forced refresh.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
