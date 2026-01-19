/**
 * Event types for test plan execution.
 *
 * All events are JSON-serializable for compatibility with various event buses.
 * Events include stable identifiers (executionId, eventId) and monotonic sequence
 * numbers for deduplication and ordering.
 */

/** Base event envelope with correlation and ordering metadata */
export interface BaseEvent {
  /** Unique identifier for this specific event */
  eventId: string;
  /** Monotonic sequence number within this execution (0-indexed) */
  seq: number;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** ID of the test plan being executed */
  planId: string;
  /** Unique identifier for this execution run */
  executionId: string;
}

/** Plan-level events */
export interface PlanStartEvent extends BaseEvent {
  type: "PLAN_START";
  planName: string;
  planVersion: string;
  nodeCount: number;
  edgeCount: number;
}

export interface PlanEndEvent extends BaseEvent {
  type: "PLAN_END";
  success: boolean;
  totalDuration_ms: number;
  nodeResultCount: number;
  errorCount: number;
  errors: string[];
}

/** Node-level events (domain-enriched from ts-edge events) */
export interface NodeStartEvent extends BaseEvent {
  type: "NODE_START";
  nodeId: string;
  nodeType: "endpoint" | "wait" | "assertion";
}

export interface NodeEndEvent extends BaseEvent {
  type: "NODE_END";
  nodeId: string;
  nodeType: "endpoint" | "wait" | "assertion";
  success: boolean;
  duration_ms: number;
  error?: string;
}

/** HTTP-specific events (for endpoint nodes) */
export interface HttpRequestEvent extends BaseEvent {
  type: "HTTP_REQUEST";
  nodeId: string;
  attempt: number;
  method: string;
  url: string;
  headers?: Record<string, string>;
  hasBody: boolean;
}

export interface HttpResponseEvent extends BaseEvent {
  type: "HTTP_RESPONSE";
  nodeId: string;
  attempt: number;
  status: number;
  statusText: string;
  duration_ms: number;
  hasBody: boolean;
}

export interface HttpRetryEvent extends BaseEvent {
  type: "HTTP_RETRY";
  nodeId: string;
  attempt: number;
  maxAttempts: number;
  reason: string;
  nextRetryDelayMs?: number;
}

/** Assertion events */
export interface AssertionResultEvent extends BaseEvent {
  type: "ASSERTION_RESULT";
  nodeId: string;
  assertionIndex: number;
  passed: boolean;
  message: string;
}

/** Wait events */
export interface WaitStartEvent extends BaseEvent {
  type: "WAIT_START";
  nodeId: string;
  duration_ms: number;
}

/** Streaming/progress events from nodes */
export interface NodeStreamEvent extends BaseEvent {
  type: "NODE_STREAM";
  nodeId: string;
  chunk: string;
}

/** System/executor-level errors (not node failures) */
export interface ErrorEvent extends BaseEvent {
  type: "ERROR";
  errorName: string;
  message: string;
  context?: string;
  /** Only included in local/development mode */
  stack?: string;
}

/** Union type of all execution events */
export type ExecutionEvent =
  | PlanStartEvent
  | PlanEndEvent
  | NodeStartEvent
  | NodeEndEvent
  | HttpRequestEvent
  | HttpResponseEvent
  | HttpRetryEvent
  | AssertionResultEvent
  | WaitStartEvent
  | NodeStreamEvent
  | ErrorEvent;
