/**
 * Environment variable secret provider.
 *
 * Reads secrets from process.env. Useful for local development
 * and simple deployments where secrets are injected as environment variables.
 *
 * Usage in DSL:
 *   secret("env:MY_API_KEY")
 *   secret("env:DATABASE_URL")
 */

import type { SecretProvider, SecretResolveOptions } from "../types.js";
import { SecretResolutionError } from "../types.js";

export interface EnvSecretProviderOptions {
  /**
   * Custom environment object to read from.
   * Defaults to process.env.
   */
  env?: Record<string, string | undefined>;

  /**
   * Prefix to strip from secret refs.
   * For example, if prefix is "APP_", then secret("env:API_KEY")
   * will look for "APP_API_KEY" in the environment.
   */
  prefix?: string;
}

export class EnvSecretProvider implements SecretProvider {
  readonly name = "env";
  private readonly env: Record<string, string | undefined>;
  private readonly prefix: string;

  constructor(options: EnvSecretProviderOptions = {}) {
    this.env = options.env ?? process.env;
    this.prefix = options.prefix ?? "";
  }

  async resolve(ref: string, _options?: SecretResolveOptions): Promise<string> {
    const envKey = this.prefix + ref;
    const value = this.env[envKey];

    if (value === undefined) {
      throw new SecretResolutionError(
        `Environment variable "${envKey}" is not set`,
        { provider: this.name, ref },
      );
    }

    return value;
  }

  async resolveMany(
    refs: Array<{ ref: string; options?: SecretResolveOptions }>,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const { ref } of refs) {
      const value = await this.resolve(ref);
      results.set(ref, value);
    }

    return results;
  }
}
