import {
  Assertion,
  BinaryPredicate,
  UnaryPredicate,
  Assertions,
  Node,
  PlanV1,
  Wait,
  HttpRequest,
} from "@griffin-app/griffin-hub-sdk";

import type {
  ExecutionOptions,
  ExecutionResult,
  NodeResult,
  HttpRequestResult,
  WaitResult,
  JSONValue,
  NodeResponseData,
} from "./types.js";
import { START, END } from "./types.js";
import { createStateGraph, graphStore, StateGraphRegistry } from "ts-edge";
import type { ExecutionEvent, BaseEvent } from "./events/index.js";
import { randomUUID } from "crypto";
import {
  resolveSecretsInPlan,
  planHasSecrets,
  SecretResolutionError,
} from "./secrets/index.js";
import { utcNow } from "./utils/dates.js";

// Define context type that matches ts-edge's GraphNodeExecuteContext (not exported from library)
interface NodeExecuteContext {
  stream: (chunk: string) => void;
  metadata: Record<string, unknown>;
}

/**
 * Execution context that tracks event emission state throughout a plan execution.
 * Maintains sequence counter and provides event creation helpers.
 */
class ExecutionContext {
  private seq = 0;

  constructor(
    public readonly executionId: string,
    public readonly plan: PlanV1,
    public readonly organizationId: string,
    private readonly emitter?: ExecutionOptions["eventEmitter"],
  ) {}

  /**
   * Create base event properties with auto-incrementing sequence number.
   */
  private createBaseEvent(): BaseEvent {
    return {
      eventId: randomUUID(),
      seq: this.seq++,
      timestamp: Date.now(),
      planId: this.plan.id,
      executionId: this.executionId,
      organizationId: this.organizationId,
    };
  }

  /**
   * Emit an event (best-effort, non-blocking).
   * Accepts an event object without base properties (those are added automatically).
   */
  emit(event: Partial<ExecutionEvent>): void {
    if (!this.emitter) return;

    const fullEvent = {
      ...this.createBaseEvent(),
      ...event,
    } as ExecutionEvent;

    try {
      this.emitter.emit(fullEvent);
    } catch (error) {
      // Don't let event emission errors break execution
      console.error("Error emitting event:", error);
    }
  }

  /**
   * Emit an error event with proper error formatting.
   */
  emitError(error: unknown, context?: string): void {
    const errorName = error instanceof Error ? error.constructor.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    this.emit({
      type: "ERROR",
      errorName,
      message,
      context,
      // Only include stack in local mode (best-effort detection)
      ...(stack && { stack }),
    });
  }
}
// Dynamic state graph type for runtime-constructed graphs
// - ExecutionState: the shared state type
// - string: node names are arbitrary strings (not known at compile time)
// - never: no nodes are pre-marked as "connected" (having outgoing edges)
type DynamicStateGraph = StateGraphRegistry<ExecutionState, string, never>;

// State shared across all nodes during execution
interface ExecutionState {
  responses: Record<string, NodeResponseData>;
  results: NodeResult[];
  errors: string[];
  executionContext: ExecutionContext;
}

function buildNode(
  plan: PlanV1,
  node: Node,
  options: ExecutionOptions,
): {
  name: string;
  execute: (
    state: ExecutionState,
    context: NodeExecuteContext,
  ) => Promise<ExecutionState>;
} {
  switch (node.type) {
    case "HTTP_REQUEST": {
      return {
        name: node.id,
        execute: async (
          state: ExecutionState,
          tsEdgeContext: NodeExecuteContext,
        ): Promise<ExecutionState> => {
          const { responses, results, errors, executionContext } = state;
          const nodeStartTime = Date.now();

          // Emit NODE_START event
          executionContext.emit({
            type: "NODE_START",
            nodeId: node.id,
            nodeType: node.type,
          });

          // Handle NODE_STREAM events from ts-edge
          const originalStream = tsEdgeContext.stream;
          tsEdgeContext.stream = (chunk: string) => {
            executionContext.emit({
              type: "NODE_STREAM",
              nodeId: node.id,
              chunk,
            });
            originalStream(chunk);
          };

          const result = await executeHttpRequest(
            node.id,
            node,
            options,
            executionContext,
          );

          // Store complete response data for downstream assertions
          if (result.success && result.response !== undefined) {
            responses[node.id] = {
              body: result.response,
              headers: result.headers || {},
              status: result.status || 0,
              duration_ms: result.duration_ms || 0,
            };
          }

          // Record result in state
          results.push({
            nodeId: node.id,
            success: result.success,
            response: result.response,
            error: result.error,
            duration_ms: result.duration_ms,
          });

          // Track errors
          if (!result.success && result.error) {
            errors.push(`${node.id}: ${result.error}`);
          }

          // Emit NODE_END event
          executionContext.emit({
            type: "NODE_END",
            nodeId: node.id,
            nodeType: node.type,
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
            error: result.error,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case "WAIT": {
      return {
        name: node.id,
        execute: async (
          state: ExecutionState,
          tsEdgeContext: NodeExecuteContext,
        ): Promise<ExecutionState> => {
          const { responses, results, errors, executionContext } = state;
          const nodeStartTime = Date.now();

          // Emit NODE_START event
          executionContext.emit({
            type: "NODE_START",
            nodeId: node.id,
            nodeType: node.type,
          });

          const result = await executeWait(node.id, node, executionContext);

          // Record result in state
          results.push({
            nodeId: node.id,
            success: result.success,
            duration_ms: result.duration_ms,
          });

          // Emit NODE_END event
          executionContext.emit({
            type: "NODE_END",
            nodeId: node.id,
            nodeType: node.type,
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case "ASSERTION": {
      return {
        name: node.id,
        execute: async (
          state: ExecutionState,
          tsEdgeContext: NodeExecuteContext,
        ): Promise<ExecutionState> => {
          const { responses, results, errors, executionContext } = state;
          const nodeStartTime = Date.now();

          // Emit NODE_START event
          executionContext.emit({
            type: "NODE_START",
            nodeId: node.id,
            nodeType: node.type,
          });

          const result = await executeAssertions(
            node.id,
            node,
            responses,
            executionContext,
          );

          // Record result in state
          results.push(result);

          // Track errors
          if (!result.success && result.error) {
            errors.push(`${node.id}: ${result.error}`);
          }

          // Emit NODE_END event
          executionContext.emit({
            type: "NODE_END",
            nodeId: node.id,
            nodeType: node.type,
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
            error: result.error,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
  }
}

function buildGraph(
  plan: PlanV1,
  options: ExecutionOptions,
  executionContext: ExecutionContext,
): DynamicStateGraph {
  // Create a state store for execution
  const store = graphStore<ExecutionState>(() => ({
    responses: {},
    results: [],
    errors: [],
    executionContext,
  }));

  const graph: DynamicStateGraph = createStateGraph(store)
    .addNode({
      name: START,
      execute: () => ({}),
    })
    .addNode({
      name: END,
      execute: () => ({}),
    }) as DynamicStateGraph;

  // Add all nodes - cast back to DynamicStateGraph to maintain our dynamic type
  const graphWithNodes = plan.nodes.reduce<DynamicStateGraph>(
    (g, node) => g.addNode(buildNode(plan, node, options)) as DynamicStateGraph,
    graph,
  );

  // Add all edges
  // Cast the edge method to accept string arguments since ts-edge expects literal types
  // but we have runtime strings from the plan
  const graphWithEdges = plan.edges.reduce<DynamicStateGraph>((g, edge) => {
    const addEdge = g.edge as (from: string, to: string) => DynamicStateGraph;
    return addEdge(edge.from, edge.to);
  }, graphWithNodes);

  return graphWithEdges;
}
export async function executePlanV1(
  plan: PlanV1,
  organizationId: string,
  options: ExecutionOptions,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Generate or use provided executionId
  const executionId = options.executionId || randomUUID();

  // Create execution context for event emission
  const executionContext = new ExecutionContext(
    executionId,
    plan,
    organizationId,
    options.eventEmitter,
  );

  try {
    // Resolve secrets if the plan contains any
    let resolvedPlan = plan;
    if (planHasSecrets(plan)) {
      if (!options.secretRegistry) {
        throw new SecretResolutionError(
          "Plan contains secret references but no secret registry was provided",
          { provider: "unknown", ref: "unknown" },
        );
      }

      executionContext.emit({
        type: "NODE_START",
        nodeId: "__SECRETS__",
        nodeType: "HTTP_REQUEST",
      });

      try {
        resolvedPlan = await resolveSecretsInPlan(plan, options.secretRegistry);

        executionContext.emit({
          type: "NODE_END",
          nodeId: "__SECRETS__",
          nodeType: "HTTP_REQUEST",
          success: true,
          duration_ms: Date.now() - startTime,
        });
      } catch (error) {
        executionContext.emit({
          type: "NODE_END",
          nodeId: "__SECRETS__",
          nodeType: "HTTP_REQUEST",
          success: false,
          duration_ms: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Emit PLAN_START event
    executionContext.emit({
      type: "PLAN_START",
      planName: resolvedPlan.name,
      planVersion: resolvedPlan.version,
      nodeCount: resolvedPlan.nodes.length,
      edgeCount: resolvedPlan.edges.length,
    });

    // Call onStart callback if provided
    if (options.statusCallbacks?.onStart) {
      try {
        await options.statusCallbacks.onStart();
      } catch (error) {
        console.error("Error in onStart callback:", error);
        // Don't fail execution due to callback errors
      }
    }

    // Build execution graph (state-based)
    const graph = buildGraph(resolvedPlan, options, executionContext);

    // Compile and run the state graph
    const app = graph.compile(START, END);
    const graphResult = await app.run();

    // Extract final state - the output is the ExecutionState
    if (!graphResult.isOk) {
      const errorMessage = graphResult.error.message;
      executionContext.emitError(graphResult.error, "graph_execution");

      const finalResults = graphResult.output?.results || [];
      const finalErrors = graphResult.output?.errors || [errorMessage];

      // Emit PLAN_END event
      executionContext.emit({
        type: "PLAN_END",
        success: false,
        totalDuration_ms: Date.now() - startTime,
        nodeResultCount: finalResults.length,
        errorCount: finalErrors.length,
        errors: finalErrors,
      });

      // Call onComplete callback if provided
      if (options.statusCallbacks?.onComplete) {
        try {
          await options.statusCallbacks.onComplete({
            status: "failed",
            completedAt: utcNow(),
            duration_ms: Date.now() - startTime,
            success: false,
            errors: finalErrors,
          });
        } catch (error) {
          console.error("Error in onComplete callback:", error);
          // Don't fail execution due to callback errors
        }
      }

      // Flush events before returning
      await options.eventEmitter?.flush?.();

      return {
        success: false,
        results: finalResults,
        errors: finalErrors,
        totalDuration_ms: Date.now() - startTime,
      };
    }

    const finalState = graphResult.output;
    const success = finalState.errors.length === 0;
    const duration = Date.now() - startTime;

    // Emit PLAN_END event
    executionContext.emit({
      type: "PLAN_END",
      success,
      totalDuration_ms: duration,
      nodeResultCount: finalState.results.length,
      errorCount: finalState.errors.length,
      errors: finalState.errors,
    });

    // Call onComplete callback if provided
    if (options.statusCallbacks?.onComplete) {
      try {
        await options.statusCallbacks.onComplete({
          status: success ? "completed" : "failed",
          completedAt: utcNow(),
          duration_ms: duration,
          success,
          ...(finalState.errors.length > 0 && { errors: finalState.errors }),
        });
      } catch (error) {
        console.error("Error in onComplete callback:", error);
        // Don't fail execution due to callback errors
      }
    }

    // Flush events before returning
    await options.eventEmitter?.flush?.();

    return {
      success,
      results: finalState.results,
      errors: finalState.errors,
      totalDuration_ms: duration,
    };
  } catch (error: unknown) {
    // Catch any unexpected errors
    executionContext.emitError(error, "unexpected_error");

    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    // Emit PLAN_END event
    executionContext.emit({
      type: "PLAN_END",
      success: false,
      totalDuration_ms: duration,
      nodeResultCount: 0,
      errorCount: 1,
      errors: [errorMessage],
    });

    // Call onComplete callback if provided
    if (options.statusCallbacks?.onComplete) {
      try {
        await options.statusCallbacks.onComplete({
          status: "failed",
          completedAt: utcNow(),
          duration_ms: duration,
          success: false,
          errors: [errorMessage],
        });
      } catch (callbackError) {
        console.error("Error in onComplete callback:", callbackError);
        // Don't fail execution due to callback errors
      }
    }

    // Flush events before throwing
    await options.eventEmitter?.flush?.();

    throw error;
  }
}

async function executeHttpRequest(
  nodeId: string,
  endpoint: HttpRequest,
  options: ExecutionOptions,
  context: ExecutionContext,
): Promise<HttpRequestResult> {
  const startTime = Date.now();

  // Only JSON response format is currently supported
  if (endpoint.response_format !== "JSON") {
    throw new Error(
      `Unsupported response format: ${endpoint.response_format}. Only JSON is currently supported.`,
    );
  }

  // endpoint.base and endpoint.path are already resolved strings
  const baseUrl = endpoint.base;
  const path = endpoint.path;
  const url = `${baseUrl}${path}`;

  // TODO: Add retry configuration from plan (node-level or plan-level)
  // For now, we always attempt once (attempt: 1)
  const attempt = 1;

  // After secret resolution, headers are guaranteed to be plain strings
  // Cast is safe because resolveSecretsInPlan substitutes all SecretRefs
  const resolvedHeaders = endpoint.headers as
    | Record<string, string>
    | undefined;

  // Emit HTTP_REQUEST event before making the call
  context.emit({
    type: "HTTP_REQUEST",
    nodeId,
    attempt,
    method: endpoint.method,
    url,
    headers: resolvedHeaders,
    hasBody: endpoint.body !== undefined,
  });

  try {
    const response = await options.httpClient.request({
      method: endpoint.method,
      url,
      headers: resolvedHeaders,
      body: endpoint.body,
      timeout: options.timeout || 30000,
    });

    const duration_ms = Date.now() - startTime;

    // Emit HTTP_RESPONSE event after receiving response
    context.emit({
      type: "HTTP_RESPONSE",
      nodeId,
      attempt,
      status: response.status,
      statusText: response.statusText,
      duration_ms,
      hasBody: response.data !== undefined,
    });

    // Parse JSON response if it's a string, otherwise use as-is
    const parsedResponse: JSONValue =
      typeof response.data === "string"
        ? JSON.parse(response.data)
        : response.data;

    return {
      success: true,
      response: parsedResponse,
      headers: response.headers || {},
      status: response.status,
      duration_ms,
    };
  } catch (error: unknown) {
    const duration_ms = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Emit failed HTTP_RESPONSE event
    context.emit({
      type: "HTTP_RESPONSE",
      nodeId,
      attempt,
      status: 0,
      statusText: "Error",
      duration_ms,
      hasBody: false,
    });

    return {
      success: false,
      error: errorMessage,
      duration_ms,
    };
  }
}

async function executeWait(
  nodeId: string,
  waitNode: Wait,
  context: ExecutionContext,
): Promise<WaitResult> {
  const startTime = Date.now();

  context.emit({
    type: "WAIT_START",
    nodeId,
    duration_ms: waitNode.duration_ms,
  });

  await new Promise((resolve) => setTimeout(resolve, waitNode.duration_ms));
  return {
    success: true,
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Extract value from response data using JSONPath
 */
function extractJsonValue(json: JSONValue, path: string[]): unknown {
  // TODO: Implement JSONPath extraction
  // If no path, return the top-level object
  if (!path || path.length === 0) {
    return json;
  }

  let current: unknown = json;

  for (const segment of path) {
    if (typeof current === "object" && current !== null) {
      if (Array.isArray(current)) {
        // Try to interpret the segment as an array index
        const idx = Number(segment);
        if (!isNaN(idx) && idx >= 0 && idx < current.length) {
          current = current[idx];
        } else {
          // If not a valid index, return undefined
          return undefined;
        }
      } else {
        // Plain object: access property by key
        if (Object.prototype.hasOwnProperty.call(current, segment)) {
          current = (current as Record<string, unknown>)[segment];
        } else {
          return undefined;
        }
      }
    } else {
      // Cannot traverse further - path goes too deep
      return undefined;
    }
  }
  return current;
}

function evaluateStatusAssertion(
  assertion: { subject: "status"; predicate: BinaryPredicate; nodeId: string },
  responses: Record<string, NodeResponseData>,
) {
  const { nodeId, predicate } = assertion;
  const value = responses[nodeId].status;
  return evaluateBinaryPredicate(value, predicate, `${nodeId}.status`);
}

function evaluateHeadersAssertion(
  assertion: {
    subject: "headers";
    predicate: UnaryPredicate | BinaryPredicate;
    nodeId: string;
    headerName: string;
  },
  responses: Record<string, NodeResponseData>,
) {
  const { nodeId, headerName, predicate } = assertion;
  const value = responses[nodeId].headers[headerName];
  switch (predicate.type) {
    case "unary":
      return evaluateUnaryPredicate(
        value,
        predicate.operator,
        `${nodeId}.headers.${headerName}`,
      );
    case "binary":
      return evaluateBinaryPredicate(
        value,
        predicate,
        `${nodeId}.headers.${headerName}`,
      );
  }
}
function evaluateLatencyAssertion(
  assertion: { subject: "latency"; predicate: BinaryPredicate; nodeId: string },
  responses: Record<string, NodeResponseData>,
) {
  const { nodeId, predicate } = assertion;
  const value = responses[nodeId].duration_ms;
  return evaluateBinaryPredicate(value, predicate, `${nodeId}.duration_ms`);
}
function evaluateBodyAssertion(
  assertion: {
    subject: "body";
    predicate: UnaryPredicate | BinaryPredicate;
    nodeId: string;
    responseType: "JSON" | "XML";
    path: string[];
  },
  responses: Record<string, NodeResponseData>,
) {
  const { nodeId, responseType, path, predicate } = assertion;
  let value: unknown;
  switch (responseType) {
    case "JSON":
      value = extractJsonValue(responses[nodeId].body, path);
      break;
    case "XML":
      // TODO: Implement XML extraction
      throw new Error(`XML assertions are not supported yet`);
      break;
    default:
      throw new Error(`Unsupported response type: ${responseType}`);
  }
  switch (predicate.type) {
    case "unary":
      return evaluateUnaryPredicate(
        value,
        predicate.operator,
        `${nodeId}.body.${path.join(".")}`,
      );
    case "binary":
      return evaluateBinaryPredicate(
        value,
        predicate,
        `${nodeId}.body.${path.join(".")}`,
      );
  }
}

function evaluateAssertion(
  assertion: Assertion,
  responses: Record<string, NodeResponseData>,
): { passed: boolean; message: string } {
  switch (assertion.subject) {
    case "status":
      return evaluateStatusAssertion(assertion, responses);
    case "headers":
      return evaluateHeadersAssertion(assertion, responses);
    case "latency":
      return evaluateLatencyAssertion(assertion, responses);
    case "body":
      return evaluateBodyAssertion(assertion, responses);
  }
}

/**
 * Evaluate a single assertion
 */
//function evaluateJSONAssertion(
//  assertion: JsonAssertion,
//  responses: Record<string, NodeResponseData>,
//): { passed: boolean; message: string } {
//  const { nodeId, accessor, path, predicate } = assertion;
//
//  const value = extractValue(responses, nodeId, accessor, path);
//  const pathStr = path.length > 0 ? path.join(".") : accessor;
//
//  // Check if predicate is unary or binary
//  if (typeof predicate === "string" || typeof predicate === "number") {
//    // Unary predicate (enum value)
//    return evaluateUnaryPredicate(value, predicate, `${nodeId}.${accessor}.${pathStr}`);
//  } else {
//    // Binary predicate (object with operator and expected)
//    return evaluateBinaryPredicate(value, predicate, nodeId, accessor, pathStr);
//  }
//}

/**
 * Evaluate unary predicates
 */
function evaluateUnaryPredicate(
  value: unknown,
  predicate:
    | "IS_NULL"
    | "IS_NOT_NULL"
    | "IS_TRUE"
    | "IS_FALSE"
    | "IS_EMPTY"
    | "IS_NOT_EMPTY",
  prefix: string,
  //nodeId: string,
  //accessor: string,
  //pathStr: string,
): { passed: boolean; message: string } {
  switch (predicate) {
    case "IS_NULL":
      return {
        passed: value === null,
        message:
          value === null
            ? `${prefix} is null`
            : `Expected ${prefix} to be null, got ${JSON.stringify(value)}`,
      };

    case "IS_NOT_NULL":
      return {
        passed: value !== null && value !== undefined,
        message:
          value !== null && value !== undefined
            ? `${prefix} is not null`
            : `Expected ${prefix} to not be null`,
      };

    case "IS_TRUE":
      return {
        passed: value === true,
        message:
          value === true
            ? `${prefix} is true`
            : `Expected ${prefix} to be true, got ${JSON.stringify(value)}`,
      };

    case "IS_FALSE":
      return {
        passed: value === false,
        message:
          value === false
            ? `${prefix} is false`
            : `Expected ${prefix} to be false, got ${JSON.stringify(value)}`,
      };

    case "IS_EMPTY": {
      const isEmpty =
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" &&
          value !== null &&
          Object.keys(value).length === 0);
      return {
        passed: isEmpty,
        message: isEmpty
          ? `${prefix} is empty`
          : `Expected ${prefix} to be empty, got ${JSON.stringify(value)}`,
      };
    }

    case "IS_NOT_EMPTY": {
      const isNotEmpty =
        value !== "" &&
        !(Array.isArray(value) && value.length === 0) &&
        !(
          typeof value === "object" &&
          value !== null &&
          Object.keys(value).length === 0
        );
      return {
        passed: isNotEmpty,
        message: isNotEmpty
          ? `${prefix} is not empty`
          : `Expected ${prefix} to not be empty`,
      };
    }

    default:
      throw new Error(`Unknown unary predicate: ${predicate}`);
  }
}

/**
 * Evaluate binary predicates
 */
function evaluateBinaryPredicate(
  value: unknown,
  predicate: BinaryPredicate,
  //nodeId: string,
  //accessor: string,
  //pathStr: string,
  prefix: string,
): { passed: boolean; message: string } {
  const { operator, expected } = predicate;

  switch (operator) {
    case "EQUAL": {
      const isEqual = JSON.stringify(value) === JSON.stringify(expected);
      return {
        passed: isEqual,
        message: isEqual
          ? `${prefix} equals ${JSON.stringify(expected)}`
          : `Expected ${prefix} to equal ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`,
      };
    }

    case "NOT_EQUAL": {
      const isNotEqual = JSON.stringify(value) !== JSON.stringify(expected);
      return {
        passed: isNotEqual,
        message: isNotEqual
          ? `${prefix} does not equal ${JSON.stringify(expected)}`
          : `Expected ${prefix} to not equal ${JSON.stringify(expected)}`,
      };
    }

    case "GREATER_THAN": {
      const isGT = typeof value === "number" && value > (expected as number);
      return {
        passed: isGT,
        message: isGT
          ? `${prefix} (${value}) > ${expected}`
          : `Expected ${prefix} to be greater than ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case "LESS_THAN": {
      const isLT = typeof value === "number" && value < (expected as number);
      return {
        passed: isLT,
        message: isLT
          ? `${prefix} (${value}) < ${expected}`
          : `Expected ${prefix} to be less than ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case "GREATER_THAN_OR_EQUAL": {
      const isGTE = typeof value === "number" && value >= (expected as number);
      return {
        passed: isGTE,
        message: isGTE
          ? `${prefix} (${value}) >= ${expected}`
          : `Expected ${prefix} to be >= ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case "LESS_THAN_OR_EQUAL": {
      const isLTE = typeof value === "number" && value <= (expected as number);
      return {
        passed: isLTE,
        message: isLTE
          ? `${prefix} (${value}) <= ${expected}`
          : `Expected ${prefix} to be <= ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case "CONTAINS": {
      const contains =
        typeof value === "string" && value.includes(expected as string);
      return {
        passed: contains,
        message: contains
          ? `${prefix} contains "${expected}"`
          : `Expected ${prefix} to contain "${expected}", got "${value}"`,
      };
    }

    case "NOT_CONTAINS": {
      const notContains =
        typeof value === "string" && !value.includes(expected as string);
      return {
        passed: notContains,
        message: notContains
          ? `${prefix} does not contain "${expected}"`
          : `Expected ${prefix} to not contain "${expected}", got "${value}"`,
      };
    }

    case "STARTS_WITH": {
      const startsWith =
        typeof value === "string" && value.startsWith(expected as string);
      return {
        passed: startsWith,
        message: startsWith
          ? `${prefix} starts with "${expected}"`
          : `Expected ${prefix} to start with "${expected}", got "${value}"`,
      };
    }

    case "NOT_STARTS_WITH": {
      const notStartsWith =
        typeof value === "string" && !value.startsWith(expected as string);
      return {
        passed: notStartsWith,
        message: notStartsWith
          ? `${prefix} does not start with "${expected}"`
          : `Expected ${prefix} to not start with "${expected}", got "${value}"`,
      };
    }

    case "ENDS_WITH": {
      const endsWith =
        typeof value === "string" && value.endsWith(expected as string);
      return {
        passed: endsWith,
        message: endsWith
          ? `${prefix} ends with "${expected}"`
          : `Expected ${prefix} to end with "${expected}", got "${value}"`,
      };
    }

    case "NOT_ENDS_WITH": {
      const notEndsWith =
        typeof value === "string" && !value.endsWith(expected as string);
      return {
        passed: notEndsWith,
        message: notEndsWith
          ? `${prefix} does not end with "${expected}"`
          : `Expected ${prefix} to not end with "${expected}", got "${value}"`,
      };
    }

    default:
      throw new Error(`Unknown binary predicate operator: ${operator}`);
  }
}

async function executeAssertions(
  nodeId: string,
  assertionNode: Assertions,
  responses: Record<string, NodeResponseData>,
  context: ExecutionContext,
): Promise<NodeResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  for (let i = 0; i < assertionNode.assertions.length; i++) {
    const assertion = assertionNode.assertions[i];

    try {
      const result = evaluateAssertion(assertion, responses);

      context.emit({
        type: "ASSERTION_RESULT",
        nodeId,
        assertionIndex: i,
        passed: result.passed,
        message: result.message,
      });

      if (!result.passed) {
        errors.push(result.message);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Assertion ${i} failed: ${message}`);

      context.emit({
        type: "ASSERTION_RESULT",
        nodeId,
        assertionIndex: i,
        passed: false,
        message,
      });
    }
  }

  return {
    nodeId,
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    duration_ms: Date.now() - startTime,
  };
}
