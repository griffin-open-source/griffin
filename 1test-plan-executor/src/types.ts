import type { ExecutionEventEmitter } from "./events/index.js";
import type { SecretProviderRegistry } from "./secrets/index.js";

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

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
  baseUrl?: string;
  timeout?: number;
  httpClient: HttpClientAdapter;

  /** Optional event emitter for execution observability */
  eventEmitter?: ExecutionEventEmitter;

  /** Unique execution ID for correlating events (generated if not provided) */
  executionId?: string;

  /**
   * Optional secret provider registry for resolving secret references.
   * If provided, secrets in the plan will be resolved before execution.
   * If not provided, any secret references in the plan will cause an error.
   */
  secretRegistry?: SecretProviderRegistry;
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
  error?: string;
  duration_ms: number;
}

export interface WaitResult {
  success: boolean;
  duration_ms: number;
}
