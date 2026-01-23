/**
 * Date utility functions for consistent UTC handling.
 *
 * All dates should be stored and transmitted as UTC (ISO 8601 strings with Z suffix).
 */

/**
 * Get the current time as a UTC ISO 8601 string.
 * @returns ISO 8601 string with Z suffix (e.g., "2024-01-23T12:34:56.789Z")
 */
export function utcNow(): string {
  return new Date().toISOString();
}
