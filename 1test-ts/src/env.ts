/**
 * Environment variable helper functions for test files.
 * Reads from process.env._1TEST_ENV_VARS which contains a JSON string
 * of the environment configuration.
 */

let envCache: Record<string, any> | null = null;

/**
 * Initialize the environment cache from process.env._1TEST_ENV_VARS
 */
function initializeEnvCache(): void {
  if (envCache !== null) {
    return;
  }

  const envVarsStr = process.env._1TEST_ENV_VARS;
  if (!envVarsStr) {
    envCache = {};
    return;
  }

  try {
    envCache = JSON.parse(envVarsStr);
  } catch (error) {
    throw new Error(
      `Failed to parse _1TEST_ENV_VARS: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a value from the environment configuration using dot notation.
 * @param key - The key to access, supports dot notation (e.g., 'api.baseUrl')
 * @returns The value from the environment configuration
 * @throws Error if the key is not found
 */
export function env(key: string): any {
  initializeEnvCache();

  // Check if envCache is empty (no environment variables provided)
  if (envCache === null || (typeof envCache === 'object' && Object.keys(envCache).length === 0)) {
    throw new Error(
      `Environment variable "${key}" not found. ` +
        `Environment variables are not available. ` +
        `Make sure to run tests with --env flag.`
    );
  }

  const keys = key.split('.');
  let value: any = envCache;

  for (const k of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      throw new Error(
        `Environment variable "${key}" not found. ` +
          `Path "${keys.slice(0, keys.indexOf(k) + 1).join('.')}" does not exist.`
      );
    }
    value = value[k];
    if (value === undefined) {
      throw new Error(
        `Environment variable "${key}" not found. ` +
          `Key "${k}" does not exist in "${keys.slice(0, keys.indexOf(k)).join('.') || 'root'}".`
      );
    }
  }

  return value;
}

/**
 * Get a string value from the environment configuration using dot notation.
 * Convenience method that ensures the result is a string.
 * @param key - The key to access, supports dot notation (e.g., 'api.baseUrl')
 * @returns The string value from the environment configuration
 * @throws Error if the key is not found or value is not a string
 */
export function envString(key: string): string {
  const value = env(key);
  if (typeof value !== 'string') {
    throw new Error(
      `Environment variable "${key}" is not a string. Got type: ${typeof value}`
    );
  }
  return value;
}
