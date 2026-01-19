/**
 * Secret provider types for griffin plan executor.
 */

/**
 * Data structure for a secret reference as it appears in a plan.
 */
export interface SecretRefData {
  provider: string;
  ref: string;
  version?: string;
  field?: string;
}

/**
 * Secret reference marker in plan JSON.
 */
export interface SecretRef {
  $secret: SecretRefData;
}

/**
 * Options passed to secret resolution.
 */
export interface SecretResolveOptions {
  version?: string;
  field?: string;
}

/**
 * Interface that all secret providers must implement.
 */
export interface SecretProvider {
  /** Unique name of the provider (e.g., "env", "aws", "vault") */
  readonly name: string;

  /**
   * Resolve a single secret reference.
   * @param ref - The secret path/identifier within this provider
   * @param options - Optional version or field extraction
   * @returns The resolved secret value
   * @throws Error if secret cannot be resolved
   */
  resolve(ref: string, options?: SecretResolveOptions): Promise<string>;

  /**
   * Optional batch resolution for efficiency.
   * Default implementation calls resolve() for each ref.
   */
  resolveMany?(
    refs: Array<{ ref: string; options?: SecretResolveOptions }>,
  ): Promise<Map<string, string>>;

  /**
   * Optional validation/health check.
   * Called during provider initialization.
   */
  validate?(): Promise<void>;
}

/**
 * Error thrown when secret resolution fails.
 */
export class SecretResolutionError extends Error {
  public readonly provider: string;
  public readonly ref: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    details: { provider: string; ref: string; cause?: unknown },
  ) {
    super(message);
    this.name = "SecretResolutionError";
    this.provider = details.provider;
    this.ref = details.ref;
    if (details.cause instanceof Error) {
      this.cause = details.cause;
    }
  }
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
