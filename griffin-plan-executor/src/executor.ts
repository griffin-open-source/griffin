import {
  TestPlanV1,
  Node,
  Endpoint,
  Wait,
  Assertions,
  JSONAssertion,
  Assertion,
} from "griffin/types";

import { HttpMethod, ResponseFormat, NodeType } from "griffin/schema";

import { UnaryPredicate, BinaryPredicateOperator } from "griffin";

import type {
  ExecutionOptions,
  ExecutionResult,
  NodeResult,
  EndpointResult,
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
    public readonly plan: TestPlanV1,
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

  /**
   * Convert NodeType enum to string for events.
   */
  static nodeTypeToString(type: NodeType): "endpoint" | "wait" | "assertion" {
    switch (type) {
      case NodeType.ENDPOINT:
        return "endpoint";
      case NodeType.WAIT:
        return "wait";
      case NodeType.ASSERTION:
        return "assertion";
    }
  }
}
// Dynamic state graph type for runtime-constructed graphs
// - ExecutionState: the shared state type
// - string: node names are arbitrary strings (not known at compile time)
// - never: no nodes are pre-marked as "connected" (having outgoing edges)
type DynamicStateGraph = StateGraphRegistry<ExecutionState, string, never>;

function httpMethodToString(method: HttpMethod): string {
  const methodMap: Record<HttpMethod, string> = {
    [HttpMethod.GET]: "GET",
    [HttpMethod.POST]: "POST",
    [HttpMethod.PUT]: "PUT",
    [HttpMethod.DELETE]: "DELETE",
    [HttpMethod.PATCH]: "PATCH",
    [HttpMethod.HEAD]: "HEAD",
    [HttpMethod.OPTIONS]: "OPTIONS",
    [HttpMethod.CONNECT]: "CONNECT",
    [HttpMethod.TRACE]: "TRACE",
  };
  return methodMap[method];
}

// State shared across all nodes during execution
interface ExecutionState {
  responses: Record<string, NodeResponseData>;
  results: NodeResult[];
  errors: string[];
  executionContext: ExecutionContext;
}

function buildNode(
  plan: TestPlanV1,
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
    case NodeType.ENDPOINT: {
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
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

          const result = await executeEndpoint(
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
            error: result.error,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case NodeType.WAIT: {
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case NodeType.ASSERTION: {
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
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
            nodeType: ExecutionContext.nodeTypeToString(node.type),
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
  plan: TestPlanV1,
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
  plan: TestPlanV1,
  options: ExecutionOptions,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Generate or use provided executionId
  const executionId = options.executionId || randomUUID();

  // Create execution context for event emission
  const executionContext = new ExecutionContext(
    executionId,
    plan,
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
        nodeType: "endpoint", // Using endpoint as closest match
      });

      try {
        resolvedPlan = await resolveSecretsInPlan(plan, options.secretRegistry);

        executionContext.emit({
          type: "NODE_END",
          nodeId: "__SECRETS__",
          nodeType: "endpoint",
          success: true,
          duration_ms: Date.now() - startTime,
        });
      } catch (error) {
        executionContext.emit({
          type: "NODE_END",
          nodeId: "__SECRETS__",
          nodeType: "endpoint",
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

    // Emit PLAN_END event
    executionContext.emit({
      type: "PLAN_END",
      success,
      totalDuration_ms: Date.now() - startTime,
      nodeResultCount: finalState.results.length,
      errorCount: finalState.errors.length,
      errors: finalState.errors,
    });

    // Flush events before returning
    await options.eventEmitter?.flush?.();

    return {
      success,
      results: finalState.results,
      errors: finalState.errors,
      totalDuration_ms: Date.now() - startTime,
    };
  } catch (error: unknown) {
    // Catch any unexpected errors
    executionContext.emitError(error, "unexpected_error");

    // Emit PLAN_END event
    executionContext.emit({
      type: "PLAN_END",
      success: false,
      totalDuration_ms: Date.now() - startTime,
      nodeResultCount: 0,
      errorCount: 1,
      errors: [error instanceof Error ? error.message : String(error)],
    });

    // Flush events before throwing
    await options.eventEmitter?.flush?.();

    throw error;
  }
}

async function executeEndpoint(
  nodeId: string,
  endpoint: Endpoint,
  options: ExecutionOptions,
  context: ExecutionContext,
): Promise<EndpointResult> {
  const startTime = Date.now();

  // Only JSON response format is currently supported
  if (endpoint.response_format !== ResponseFormat.JSON) {
    throw new Error(
      `Unsupported response format: ${ResponseFormat[endpoint.response_format]}. Only JSON is currently supported.`,
    );
  }

  const baseUrl = await options.targetResolver(endpoint.base.key);
  if (!baseUrl) {
    throw new Error(
      `Failed to resolve target "${endpoint.base.key}". Target not found in runner configuration.`,
    );
  }

  const url = `${baseUrl}${endpoint.path}`;

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
    method: httpMethodToString(endpoint.method),
    url,
    headers: resolvedHeaders,
    hasBody: endpoint.body !== undefined,
  });

  try {
    const response = await options.httpClient.request({
      method: httpMethodToString(endpoint.method),
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
function extractValue(
  responses: Record<string, NodeResponseData>,
  nodeId: string,
  accessor: "body" | "headers" | "status",
  path: string[],
): unknown {
  const nodeData = responses[nodeId];
  if (!nodeData) {
    throw new Error(`No response data found for node: ${nodeId}`);
  }

  let value: unknown;
  switch (accessor) {
    case "body":
      value = nodeData.body;
      break;
    case "headers":
      value = nodeData.headers;
      break;
    case "status":
      value = nodeData.status;
      break;
  }

  // Navigate JSONPath
  for (const segment of path) {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (
      typeof value === "object" &&
      segment in (value as Record<string, unknown>)
    ) {
      value = (value as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return value;
}

function evaluateAssertion(
  assertion: Assertion,
  responses: Record<string, NodeResponseData>,
): { passed: boolean; message: string } {
  switch (assertion.assertionType) {
    case ResponseFormat.JSON:
      return evaluateJSONAssertion(assertion, responses);
    case ResponseFormat.XML:
      throw new Error(`XML assertions are not supported yet`);
    case ResponseFormat.TEXT:
      throw new Error(`Text assertions are not supported yet`);
  }
}

/**
 * Evaluate a single assertion
 */
function evaluateJSONAssertion(
  assertion: JSONAssertion,
  responses: Record<string, NodeResponseData>,
): { passed: boolean; message: string } {
  const { nodeId, accessor, path, predicate } = assertion;

  const value = extractValue(responses, nodeId, accessor, path);
  const pathStr = path.length > 0 ? path.join(".") : accessor;

  // Check if predicate is unary or binary
  if (typeof predicate === "string" || typeof predicate === "number") {
    // Unary predicate (enum value)
    return evaluateUnaryPredicate(
      value,
      predicate as UnaryPredicate,
      nodeId,
      accessor,
      pathStr,
    );
  } else {
    // Binary predicate (object with operator and expected)
    return evaluateBinaryPredicate(value, predicate, nodeId, accessor, pathStr);
  }
}

/**
 * Evaluate unary predicates
 */
function evaluateUnaryPredicate(
  value: unknown,
  predicate: UnaryPredicate,
  nodeId: string,
  accessor: string,
  pathStr: string,
): { passed: boolean; message: string } {
  switch (predicate) {
    case UnaryPredicate.IS_NULL:
      return {
        passed: value === null,
        message:
          value === null
            ? `${nodeId}.${accessor}.${pathStr} is null`
            : `Expected ${nodeId}.${accessor}.${pathStr} to be null, got ${JSON.stringify(value)}`,
      };

    case UnaryPredicate.IS_NOT_NULL:
      return {
        passed: value !== null && value !== undefined,
        message:
          value !== null && value !== undefined
            ? `${nodeId}.${accessor}.${pathStr} is not null`
            : `Expected ${nodeId}.${accessor}.${pathStr} to not be null`,
      };

    case UnaryPredicate.IS_TRUE:
      return {
        passed: value === true,
        message:
          value === true
            ? `${nodeId}.${accessor}.${pathStr} is true`
            : `Expected ${nodeId}.${accessor}.${pathStr} to be true, got ${JSON.stringify(value)}`,
      };

    case UnaryPredicate.IS_FALSE:
      return {
        passed: value === false,
        message:
          value === false
            ? `${nodeId}.${accessor}.${pathStr} is false`
            : `Expected ${nodeId}.${accessor}.${pathStr} to be false, got ${JSON.stringify(value)}`,
      };

    case UnaryPredicate.IS_EMPTY: {
      const isEmpty =
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" &&
          value !== null &&
          Object.keys(value).length === 0);
      return {
        passed: isEmpty,
        message: isEmpty
          ? `${nodeId}.${accessor}.${pathStr} is empty`
          : `Expected ${nodeId}.${accessor}.${pathStr} to be empty, got ${JSON.stringify(value)}`,
      };
    }

    case UnaryPredicate.IS_NOT_EMPTY: {
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
          ? `${nodeId}.${accessor}.${pathStr} is not empty`
          : `Expected ${nodeId}.${accessor}.${pathStr} to not be empty`,
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
  predicate: { operator: BinaryPredicateOperator; expected: unknown },
  nodeId: string,
  accessor: string,
  pathStr: string,
): { passed: boolean; message: string } {
  const { operator, expected } = predicate;

  switch (operator) {
    case BinaryPredicateOperator.EQUAL: {
      const isEqual = JSON.stringify(value) === JSON.stringify(expected);
      return {
        passed: isEqual,
        message: isEqual
          ? `${nodeId}.${accessor}.${pathStr} equals ${JSON.stringify(expected)}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to equal ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`,
      };
    }

    case BinaryPredicateOperator.NOT_EQUAL: {
      const isNotEqual = JSON.stringify(value) !== JSON.stringify(expected);
      return {
        passed: isNotEqual,
        message: isNotEqual
          ? `${nodeId}.${accessor}.${pathStr} does not equal ${JSON.stringify(expected)}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to not equal ${JSON.stringify(expected)}`,
      };
    }

    case BinaryPredicateOperator.GREATER_THAN: {
      const isGT = typeof value === "number" && value > (expected as number);
      return {
        passed: isGT,
        message: isGT
          ? `${nodeId}.${accessor}.${pathStr} (${value}) > ${expected}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to be greater than ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case BinaryPredicateOperator.LESS_THAN: {
      const isLT = typeof value === "number" && value < (expected as number);
      return {
        passed: isLT,
        message: isLT
          ? `${nodeId}.${accessor}.${pathStr} (${value}) < ${expected}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to be less than ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case BinaryPredicateOperator.GREATER_THAN_OR_EQUAL: {
      const isGTE = typeof value === "number" && value >= (expected as number);
      return {
        passed: isGTE,
        message: isGTE
          ? `${nodeId}.${accessor}.${pathStr} (${value}) >= ${expected}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to be >= ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case BinaryPredicateOperator.LESS_THAN_OR_EQUAL: {
      const isLTE = typeof value === "number" && value <= (expected as number);
      return {
        passed: isLTE,
        message: isLTE
          ? `${nodeId}.${accessor}.${pathStr} (${value}) <= ${expected}`
          : `Expected ${nodeId}.${accessor}.${pathStr} to be <= ${expected}, got ${JSON.stringify(value)}`,
      };
    }

    case BinaryPredicateOperator.CONTAINS: {
      const contains =
        typeof value === "string" && value.includes(expected as string);
      return {
        passed: contains,
        message: contains
          ? `${nodeId}.${accessor}.${pathStr} contains "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to contain "${expected}", got "${value}"`,
      };
    }

    case BinaryPredicateOperator.NOT_CONTAINS: {
      const notContains =
        typeof value === "string" && !value.includes(expected as string);
      return {
        passed: notContains,
        message: notContains
          ? `${nodeId}.${accessor}.${pathStr} does not contain "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to not contain "${expected}", got "${value}"`,
      };
    }

    case BinaryPredicateOperator.STARTS_WITH: {
      const startsWith =
        typeof value === "string" && value.startsWith(expected as string);
      return {
        passed: startsWith,
        message: startsWith
          ? `${nodeId}.${accessor}.${pathStr} starts with "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to start with "${expected}", got "${value}"`,
      };
    }

    case BinaryPredicateOperator.NOT_STARTS_WITH: {
      const notStartsWith =
        typeof value === "string" && !value.startsWith(expected as string);
      return {
        passed: notStartsWith,
        message: notStartsWith
          ? `${nodeId}.${accessor}.${pathStr} does not start with "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to not start with "${expected}", got "${value}"`,
      };
    }

    case BinaryPredicateOperator.ENDS_WITH: {
      const endsWith =
        typeof value === "string" && value.endsWith(expected as string);
      return {
        passed: endsWith,
        message: endsWith
          ? `${nodeId}.${accessor}.${pathStr} ends with "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to end with "${expected}", got "${value}"`,
      };
    }

    case BinaryPredicateOperator.NOT_ENDS_WITH: {
      const notEndsWith =
        typeof value === "string" && !value.endsWith(expected as string);
      return {
        passed: notEndsWith,
        message: notEndsWith
          ? `${nodeId}.${accessor}.${pathStr} does not end with "${expected}"`
          : `Expected ${nodeId}.${accessor}.${pathStr} to not end with "${expected}", got "${value}"`,
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
