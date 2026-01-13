/**
 * AWS Secrets Manager secret provider.
 *
 * Reads secrets from AWS Secrets Manager. Supports JSON secrets
 * with field extraction and version staging.
 *
 * Usage in DSL:
 *   secret("aws:my-secret")
 *   secret("aws:prod/api-keys", { field: "stripe" })
 *   secret("aws:my-secret", { version: "AWSPREVIOUS" })
 */

import type { SecretProvider, SecretResolveOptions } from "../types.js";
import { SecretResolutionError } from "../types.js";

/**
 * Interface for AWS Secrets Manager client.
 * This allows dependency injection of the actual AWS SDK client.
 */
export interface AwsSecretsManagerClient {
  getSecretValue(params: {
    SecretId: string;
    VersionStage?: string;
  }): Promise<{
    SecretString?: string;
    SecretBinary?: Uint8Array;
  }>;
}

export interface AwsSecretsManagerProviderOptions {
  /**
   * AWS Secrets Manager client instance.
   * Should be pre-configured with region and credentials.
   */
  client: AwsSecretsManagerClient;

  /**
   * Optional prefix for secret names.
   * For example, if prefix is "myapp/", then secret("aws:api-key")
   * will look for "myapp/api-key" in Secrets Manager.
   */
  prefix?: string;

  /**
   * Default version stage to use if not specified.
   * Defaults to "AWSCURRENT".
   */
  defaultVersionStage?: string;
}

export class AwsSecretsManagerProvider implements SecretProvider {
  readonly name = "aws";
  private readonly client: AwsSecretsManagerClient;
  private readonly prefix: string;
  private readonly defaultVersionStage: string;

  // Simple in-memory cache with TTL
  private cache = new Map<string, { value: string; expires: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(options: AwsSecretsManagerProviderOptions) {
    this.client = options.client;
    this.prefix = options.prefix ?? "";
    this.defaultVersionStage = options.defaultVersionStage ?? "AWSCURRENT";
  }

  async resolve(ref: string, options?: SecretResolveOptions): Promise<string> {
    const secretId = this.prefix + ref;
    const versionStage = options?.version ?? this.defaultVersionStage;
    const cacheKey = `${secretId}:${versionStage}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return this.extractField(cached.value, options?.field, ref);
    }

    try {
      const response = await this.client.getSecretValue({
        SecretId: secretId,
        VersionStage: versionStage,
      });

      if (!response.SecretString) {
        throw new SecretResolutionError(
          `Secret "${secretId}" does not contain a string value (binary secrets are not supported)`,
          { provider: this.name, ref }
        );
      }

      // Cache the raw value
      this.cache.set(cacheKey, {
        value: response.SecretString,
        expires: Date.now() + this.cacheTtlMs,
      });

      return this.extractField(response.SecretString, options?.field, ref);
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        throw error;
      }

      // Handle common AWS errors
      const awsError = error as { name?: string; message?: string };
      let message = `Failed to retrieve secret "${secretId}"`;

      if (awsError.name === "ResourceNotFoundException") {
        message = `Secret "${secretId}" not found in AWS Secrets Manager`;
      } else if (awsError.name === "AccessDeniedException") {
        message = `Access denied to secret "${secretId}". Check IAM permissions.`;
      } else if (awsError.message) {
        message = `${message}: ${awsError.message}`;
      }

      throw new SecretResolutionError(message, {
        provider: this.name,
        ref,
        cause: error,
      });
    }
  }

  /**
   * Extract a field from a JSON secret string.
   */
  private extractField(
    secretValue: string,
    field: string | undefined,
    ref: string
  ): string {
    if (!field) {
      return secretValue;
    }

    try {
      const parsed = JSON.parse(secretValue);

      if (typeof parsed !== "object" || parsed === null) {
        throw new SecretResolutionError(
          `Secret "${ref}" is not a JSON object, cannot extract field "${field}"`,
          { provider: this.name, ref }
        );
      }

      const value = parsed[field];

      if (value === undefined) {
        throw new SecretResolutionError(
          `Field "${field}" not found in secret "${ref}"`,
          { provider: this.name, ref }
        );
      }

      // Convert to string if not already
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        throw error;
      }

      throw new SecretResolutionError(
        `Failed to parse secret "${ref}" as JSON for field extraction: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { provider: this.name, ref, cause: error }
      );
    }
  }

  async validate(): Promise<void> {
    // Try a simple operation to verify credentials
    // This is a no-op if the client is properly configured
    // The actual validation happens on first secret access
  }

  /**
   * Clear the cache. Useful for testing or forced refresh.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
