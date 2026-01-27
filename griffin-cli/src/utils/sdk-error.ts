import { terminal } from "./terminal.js";

/**
 * Error type from the OpenAPI SDK client
 */
interface SDKError extends Error {
  status?: number;
  statusText?: string;
  body?: any;
  url?: string;
}

/**
 * Handle SDK errors with user-friendly messaging
 */
export function handleSDKError(error: unknown, context?: string): never {
  const sdkError = error as SDKError;
  const contextMsg = context ? `${context}: ` : "";
  terminal.blank();

  // Handle network/connection errors
  if (sdkError.message?.includes("ECONNREFUSED")) {
    terminal.error(`${contextMsg}Unable to connect to Griffin Hub`);
    terminal.dim("Make sure the hub is running and the URL is correct.");
    return terminal.exit(1) as never;
  }

  if (sdkError.message?.includes("ENOTFOUND")) {
    terminal.error(`${contextMsg}Hub host not found`);
    terminal.dim("Check your hub URL configuration.");
    return terminal.exit(1) as never;
  }

  if (sdkError.message?.includes("ETIMEDOUT")) {
    terminal.error(`${contextMsg}Connection to hub timed out`);
    terminal.dim("The hub may be unresponsive or the network is slow.");
    return terminal.exit(1) as never;
  }

  // Handle HTTP status codes
  if (sdkError.status) {
    switch (sdkError.status) {
      case 401:
        terminal.error(`${contextMsg}Authentication failed`);
        terminal.dim("Your API token may be invalid or expired.");
        terminal.dim("Run 'griffin hub login' to authenticate again.");
        return terminal.exit(1) as never;

      case 403:
        terminal.error(`${contextMsg}Access denied`);
        terminal.dim("You don't have permission to perform this action.");
        return terminal.exit(1) as never;

      case 404:
        terminal.error(`${contextMsg}Resource not found`);
        if (sdkError.url) {
          terminal.dim(`URL: ${sdkError.url}`);
        }
        terminal.dim("The requested resource may not exist on the hub.");
        return terminal.exit(1) as never;

      case 409:
        terminal.error(`${contextMsg}Conflict`);
        if (sdkError.body?.message) {
          terminal.dim(sdkError.body.message);
        } else {
          terminal.dim("The operation conflicts with the current state.");
        }
        return terminal.exit(1) as never;

      case 422:
        terminal.error(`${contextMsg}Validation error`);
        if (sdkError.body?.message) {
          terminal.dim(sdkError.body.message);
        } else if (sdkError.body?.errors) {
          terminal.dim("Validation failed:");
          for (const err of sdkError.body.errors) {
            terminal.dim(`  - ${err.message || err}`);
          }
        } else {
          terminal.dim("The request data is invalid.");
        }
        return terminal.exit(1) as never;

      case 429:
        terminal.error(`${contextMsg}Rate limit exceeded`);
        terminal.dim("Too many requests. Please wait and try again.");
        return terminal.exit(1) as never;

      case 500:
      case 502:
      case 503:
      case 504:
        terminal.error(`${contextMsg}Hub server error`);
        terminal.dim(`Status: ${sdkError.status} ${sdkError.statusText || ""}`);
        if (sdkError.body?.message) {
          terminal.dim(sdkError.body.message);
        } else {
          terminal.dim("The hub encountered an internal error.");
        }
        return terminal.exit(1) as never;

      default:
        terminal.error(`${contextMsg}Request failed`);
        terminal.dim(`Status: ${sdkError.status} ${sdkError.statusText || ""}`);
        if (sdkError.body?.message) {
          terminal.dim(sdkError.body.message);
        } else if (sdkError.message) {
          terminal.dim(sdkError.message);
        }
        return terminal.exit(1) as never;
    }
  }

  // Fallback for unknown errors
  terminal.error(
    `${contextMsg}${sdkError.message || "An unexpected error occurred"}`,
  );
  if (sdkError.stack) {
    terminal.dim("Run with DEBUG=* for more details.");
  }
  return terminal.exit(1) as never;
}

/**
 * Wrap an SDK call with error handling
 */
export async function withSDKErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleSDKError(error, context);
  }
}
