/**
 * Date utility functions for consistent UTC handling across the application.
 *
 * All dates in the system should be stored and transmitted as UTC (ISO 8601 strings with Z suffix).
 * Display formatting to local timezones happens only in UI/CLI layers.
 */

/**
 * Get the current time as a UTC ISO 8601 string.
 * @returns ISO 8601 string with Z suffix (e.g., "2024-01-23T12:34:56.789Z")
 */
export function utcNow(): string {
  return new Date().toISOString();
}

/**
 * Convert a Date or ISO string to UTC ISO 8601 string.
 * @param date Date object or ISO string
 * @returns ISO 8601 string with Z suffix
 */
export function toUTC(date: Date | string): string {
  return typeof date === "string" ? date : date.toISOString();
}

/**
 * Parse a UTC ISO 8601 string to a Date object.
 * @param isoString ISO 8601 string
 * @returns Date object
 */
export function fromUTC(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Calculate duration in milliseconds between two ISO timestamps.
 * @param start Start time (ISO string)
 * @param end End time (ISO string)
 * @returns Duration in milliseconds
 */
export function durationMs(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}
