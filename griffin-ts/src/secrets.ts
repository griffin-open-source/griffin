import type { SecretRef } from "./schema.js";

export interface SecretOptions {
  /** Pin to a specific version (provider-dependent) */
  version?: string;
  /** Extract a specific field from a JSON secret */
  field?: string;
}

/**
 * Create a secret reference for use in endpoint headers or body.
 *
 * @param path - Provider-qualified path in format "provider:path"
 *   Examples:
 *   - "env:API_KEY" - Environment variable
 *   - "aws:prod/api-key" - AWS Secrets Manager
 *   - "vault:secret/data/api" - HashiCorp Vault
 *   - "doppler:backend/prod/API_KEY" - Doppler
 *
 * @param options - Optional version pinning or field extraction
 *
 * @example
 * ```typescript
 * builder.addEndpoint("call", {
 *   method: GET,
 *   path: "/api/data",
 *   headers: {
 *     "Authorization": secret("aws:prod/api-key"),
 *     "X-API-Key": secret("env:LOCAL_API_KEY"),
 *   },
 * })
 * ```
 */
export function secret(path: string, options?: SecretOptions): SecretRef {
  const colonIndex = path.indexOf(":");

  if (colonIndex === -1) {
    throw new Error(
      `Secret path must include provider: "provider:path" (e.g., "aws:my-secret", "env:API_KEY"). Got: "${path}"`,
    );
  }

  if (colonIndex === 0) {
    throw new Error(
      `Secret path must have a provider name before the colon. Got: "${path}"`,
    );
  }

  if (colonIndex === path.length - 1) {
    throw new Error(
      `Secret path must have a reference after the colon. Got: "${path}"`,
    );
  }

  const provider = path.slice(0, colonIndex);
  const ref = path.slice(colonIndex + 1);

  return {
    $secret: {
      provider,
      ref,
      ...(options?.version !== undefined && { version: options.version }),
      ...(options?.field !== undefined && { field: options.field }),
    },
  };
}

/**
 * Type guard to check if a value is a secret reference.
 */
export function isSecretRef(value: unknown): value is SecretRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (
    !("$secret" in obj) ||
    typeof obj.$secret !== "object" ||
    obj.$secret === null
  ) {
    return false;
  }

  const secretData = obj.$secret as Record<string, unknown>;
  return (
    typeof secretData.provider === "string" &&
    typeof secretData.ref === "string"
  );
}

/**
 * Type that allows either a literal value or a secret reference.
 * Used for headers and other fields that may contain secrets.
 */
export type SecretOrValue<T> = T | SecretRef;
