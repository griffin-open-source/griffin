import type { ExecutionEventEmitter } from "./events/index.js";
import type { SecretProviderRegistry } from "./secrets/index.js";

export const START = "__START__" as const;
export const END = "__END__" as const;

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

/**
 * Complete response data from an endpoint execution
 */
export interface NodeResponseData {
  body: JSONValue;
  headers: Record<string, string>;
  status: number;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers?: Record<string, string>;
}

export interface HttpClientAdapter {
  request(req: HttpRequest): Promise<HttpResponse>;
}

export interface ExecutionOptions {
  mode: "local" | "remote";
  timeout?: number;
  httpClient: HttpClientAdapter;

  /** Optional event emitter for execution observability */
  eventEmitter?: ExecutionEventEmitter;

  /** Unique execution ID for correlating events (generated if not provided) */
  executionId?: string;

  secretRegistry: SecretProviderRegistry;
}

export interface NodeResult {
  nodeId: string;
  success: boolean;
  response?: JSONValue;
  error?: string;
  duration_ms: number;
}

export interface ExecutionResult {
  success: boolean;
  results: NodeResult[];
  errors: string[];
  totalDuration_ms: number;
}

export interface EndpointResult {
  success: boolean;
  response?: JSONValue;
  headers?: Record<string, string>;
  status?: number;
  error?: string;
  duration_ms: number;
}

export interface WaitResult {
  success: boolean;
  duration_ms: number;
}
