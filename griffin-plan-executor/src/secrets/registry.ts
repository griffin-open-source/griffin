/**
 * Secret provider registry for managing multiple secret providers.
 */

import type {
  SecretProvider,
  SecretRefData,
  SecretResolveOptions,
} from "./types.js";
import { SecretResolutionError } from "./types.js";

/**
 * Registry for managing and accessing secret providers.
 * Supports multiple providers simultaneously (e.g., env + aws + vault).
 */
export class SecretProviderRegistry {
  private providers = new Map<string, SecretProvider>();

  /**
   * Register a secret provider.
   * @param provider - The provider to register
   * @throws Error if a provider with the same name is already registered
   */
  register(provider: SecretProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(
        `Secret provider "${provider.name}" is already registered`,
      );
    }
    this.providers.set(provider.name, provider);
  }

  /**
   * Unregister a secret provider by name.
   * @param name - The provider name to remove
   * @returns true if the provider was removed, false if it wasn't registered
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Get a registered provider by name.
   * @param name - The provider name
   * @throws Error if the provider is not registered
   */
  get(name: string): SecretProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      const available = [...this.providers.keys()];
      throw new SecretResolutionError(
        `Secret provider "${name}" is not configured. Available providers: ${
          available.length > 0 ? available.join(", ") : "(none)"
        }`,
        { provider: name, ref: "" },
      );
    }
    return provider;
  }

  /**
   * Check if a provider is registered.
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get all registered provider names.
   */
  getProviderNames(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Resolve a secret reference using the appropriate provider.
   * @param secretRef - The secret reference data
   * @returns The resolved secret value
   * @throws SecretResolutionError if resolution fails
   */
  async resolve(secretRef: SecretRefData): Promise<string> {
    const provider = this.get(secretRef.provider);

    try {
      return await provider.resolve(secretRef.ref, {
        version: secretRef.version,
        field: secretRef.field,
      });
    } catch (error) {
      if (error instanceof SecretResolutionError) {
        throw error;
      }
      throw new SecretResolutionError(
        `Failed to resolve secret "${secretRef.provider}:${secretRef.ref}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          provider: secretRef.provider,
          ref: secretRef.ref,
          cause: error,
        },
      );
    }
  }

  /**
   * Resolve multiple secrets, grouped by provider for efficiency.
   * @param refs - Array of secret reference data
   * @returns Map of "provider:ref" to resolved value
   * @throws SecretResolutionError if any resolution fails (fail-fast)
   */
  async resolveMany(refs: SecretRefData[]): Promise<Map<string, string>> {
    if (refs.length === 0) {
      return new Map();
    }

    // Group refs by provider
    const byProvider = new Map<
      string,
      Array<{ ref: string; options?: SecretResolveOptions; key: string }>
    >();

    for (const secretRef of refs) {
      const key = this.makeKey(secretRef);
      const group = byProvider.get(secretRef.provider) || [];
      group.push({
        ref: secretRef.ref,
        options: {
          version: secretRef.version,
          field: secretRef.field,
        },
        key,
      });
      byProvider.set(secretRef.provider, group);
    }

    // Resolve each provider's secrets
    const results = new Map<string, string>();

    for (const [providerName, providerRefs] of byProvider) {
      const provider = this.get(providerName);

      // Use batch resolution if available, otherwise resolve individually
      if (provider.resolveMany) {
        const batchRefs = providerRefs.map((r) => ({
          ref: r.ref,
          options: r.options,
        }));

        try {
          const batchResults = await provider.resolveMany(batchRefs);

          for (const providerRef of providerRefs) {
            const value = batchResults.get(providerRef.ref);
            if (value === undefined) {
              throw new SecretResolutionError(
                `Secret "${providerName}:${providerRef.ref}" not found in batch results`,
                { provider: providerName, ref: providerRef.ref },
              );
            }
            results.set(providerRef.key, value);
          }
        } catch (error) {
          if (error instanceof SecretResolutionError) {
            throw error;
          }
          throw new SecretResolutionError(
            `Batch resolution failed for provider "${providerName}": ${
              error instanceof Error ? error.message : String(error)
            }`,
            {
              provider: providerName,
              ref: providerRefs[0]?.ref || "",
              cause: error,
            },
          );
        }
      } else {
        // Resolve individually (fail-fast on first error)
        for (const providerRef of providerRefs) {
          try {
            const value = await provider.resolve(
              providerRef.ref,
              providerRef.options,
            );
            results.set(providerRef.key, value);
          } catch (error) {
            if (error instanceof SecretResolutionError) {
              throw error;
            }
            throw new SecretResolutionError(
              `Failed to resolve secret "${providerName}:${providerRef.ref}": ${
                error instanceof Error ? error.message : String(error)
              }`,
              { provider: providerName, ref: providerRef.ref, cause: error },
            );
          }
        }
      }
    }

    return results;
  }

  /**
   * Validate all registered providers.
   * @throws Error if any provider validation fails
   */
  async validateAll(): Promise<void> {
    for (const [name, provider] of this.providers) {
      if (provider.validate) {
        try {
          await provider.validate();
        } catch (error) {
          throw new Error(
            `Provider "${name}" validation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
  }

  /**
   * Create a unique key for a secret reference (for caching/deduplication).
   */
  makeKey(secretRef: SecretRefData): string {
    const parts = [secretRef.provider, secretRef.ref];
    if (secretRef.version) parts.push(`v:${secretRef.version}`);
    if (secretRef.field) parts.push(`f:${secretRef.field}`);
    return parts.join(":");
  }
}
