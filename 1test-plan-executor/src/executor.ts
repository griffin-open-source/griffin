import {
  type Node,
  NodeType,
  type TestPlanV1,
  type Endpoint,
  ResponseFormat,
  type Wait,
  type Assertions,
  HttpMethod,
} from "./schemas.js";
import type {
  ExecutionOptions,
  ExecutionResult,
  NodeResult,
  EndpointResult,
  WaitResult,
  JSONValue,
} from "./types.js";
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
  responses: Record<string, JSONValue>;
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
  switch (node.data.type) {
    case NodeType.ENDPOINT: {
      const endpointData = node.data;
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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
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
            endpointData,
            plan.endpoint_host,
            options,
            executionContext,
          );

          // Store successful response for downstream nodes
          if (result.success && result.response !== undefined) {
            responses[node.id] = result.response;
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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
            error: result.error,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case NodeType.WAIT: {
      const waitData = node.data;
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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
          });

          const result = await executeWait(node.id, waitData, executionContext);

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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
            success: result.success,
            duration_ms: Date.now() - nodeStartTime,
          });

          return { responses, results, errors, executionContext };
        },
      };
    }
    case NodeType.ASSERTION: {
      const assertionData = node.data;
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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
          });

          const result = await executeAssertions(
            node.id,
            assertionData,
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
            nodeType: ExecutionContext.nodeTypeToString(node.data.type),
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

  const graph: DynamicStateGraph = createStateGraph(store) as DynamicStateGraph;

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
          { provider: "unknown", ref: "unknown" }
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
    const app = graph.compile("__START__", "__END__");
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
  baseHost: string,
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

  // Use baseUrl from options if provided, otherwise use the plan's endpoint_host
  const host = options.baseUrl || baseHost;
  const url = `${host}${endpoint.path}`;

  // TODO: Add retry configuration from plan (node-level or plan-level)
  // For now, we always attempt once (attempt: 1)
  const attempt = 1;

  // After secret resolution, headers are guaranteed to be plain strings
  // Cast is safe because resolveSecretsInPlan substitutes all SecretRefs
  const resolvedHeaders = endpoint.headers as Record<string, string> | undefined;

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

async function executeAssertions(
  nodeId: string,
  assertionNode: Assertions,
  responses: Record<string, JSONValue>,
  context: ExecutionContext,
): Promise<NodeResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // TODO: implement assertions
  // Each assertion in assertionNode.assertions should be evaluated against responses
  // When implemented, emit ASSERTION_RESULT events like:
  // context.emit({
  //   type: 'ASSERTION_RESULT',
  //   nodeId,
  //   assertionIndex: i,
  //   passed: true/false,
  //   message: 'assertion message'
  // });

  return {
    nodeId,
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join("; ") : undefined,
    duration_ms: Date.now() - startTime,
  };
}
