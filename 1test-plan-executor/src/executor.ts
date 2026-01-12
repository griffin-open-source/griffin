import axios from 'axios';
import type { TestPlan, Endpoint, WaitNode, AssertionNode } from './test-plan-types';
import type { ExecutionOptions, ExecutionResult, NodeResult } from './types';

export async function executePlan(
  plan: TestPlan,
  options: ExecutionOptions
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const results: NodeResult[] = [];
  const errors: string[] = [];
  const responses: Record<string, any> = {};

  // Build execution graph
  const executionOrder = buildExecutionOrder(plan);
  
  // Execute nodes in order
  for (const nodeId of executionOrder) {
    const node = plan.nodes.find((n) => n.id === nodeId);
    if (!node) {
      errors.push(`Node ${nodeId} not found`);
      continue;
    }

    const nodeStartTime = Date.now();
    let nodeResult: NodeResult;

    try {
      if (node.type === 'endpoint') {
        // Use the plan's endpoint_host (baseUrl can override if needed)
        const host = options.baseUrl || plan.endpoint_host;
        nodeResult = await executeEndpoint(node, host, options);
        responses[node.id] = nodeResult.response;
      } else if (node.type === 'wait') {
        nodeResult = await executeWait(node);
      } else if (node.type === 'assertion') {
        nodeResult = await executeAssertions(node, responses);
        if (!nodeResult.success) {
          errors.push(...(nodeResult.error ? [nodeResult.error] : []));
        }
      } else {
        const unknownNode = node as { id: string; type: string };
        nodeResult = {
          nodeId: unknownNode.id,
          success: false,
          error: `Unknown node type: ${unknownNode.type}`,
          duration_ms: Date.now() - nodeStartTime,
        };
      }

      results.push(nodeResult);
    } catch (error: any) {
      nodeResult = {
        nodeId: node.id,
        success: false,
        error: error.message || String(error),
        duration_ms: Date.now() - nodeStartTime,
      };
      results.push(nodeResult);
      errors.push(`Error executing ${node.id}: ${error.message || String(error)}`);
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    totalDuration_ms: Date.now() - startTime,
  };
}

function buildExecutionOrder(plan: TestPlan): string[] {
  // Simple topological sort starting from START
  const order: string[] = [];
  const visited = new Set<string>();
  const START = '__START__';

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Find all edges starting from this node
    const outgoingEdges = plan.edges.filter((e) => e.from === nodeId);
    for (const edge of outgoingEdges) {
      visit(edge.to);
    }

    if (nodeId !== START && nodeId !== '__END__') {
      order.push(nodeId);
    }
  }

  visit(START);
  return order;
}

async function executeEndpoint(
  endpoint: Endpoint,
  baseHost: string,
  options: ExecutionOptions
): Promise<NodeResult> {
  const startTime = Date.now();
  // Use baseUrl from options if provided, otherwise use the plan's endpoint_host
  const host = options.baseUrl || baseHost;
  const url = `${host}${endpoint.path}`;

  try {
    const response = await axios({
      method: endpoint.method,
      url,
      headers: endpoint.headers,
      data: endpoint.body,
      timeout: options.timeout || 30000,
    });

    let parsedResponse = response.data;
    if (endpoint.response_format === 'JSON' && typeof response.data === 'string') {
      parsedResponse = JSON.parse(response.data);
    }

    return {
      nodeId: endpoint.id,
      success: true,
      response: parsedResponse,
      duration_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    // Provide more detailed error messages
    let errorMessage = 'Unknown error';
    if (error.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused - is the server running on ${url}?`;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Request timed out after ${options.timeout || 30000}ms`;
    } else if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else if (error.message) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    
    return {
      nodeId: endpoint.id,
      success: false,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    };
  }
}

async function executeWait(waitNode: WaitNode): Promise<NodeResult> {
  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, waitNode.duration_ms));
  return {
    nodeId: waitNode.id,
    success: true,
    duration_ms: Date.now() - startTime,
  };
}

async function executeAssertions(
  assertionNode: AssertionNode,
  responses: Record<string, any>
): Promise<NodeResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  for (const assertion of assertionNode.assertions) {
    switch (assertion.type) {
      case 'isEqual':
        if (assertion.expected !== assertion.actual) {
          errors.push(
            assertion.message ||
              `Expected ${assertion.expected}, but got ${assertion.actual}`
          );
        }
        break;
      case 'notNull':
        if (assertion.actual === null || assertion.actual === undefined) {
          errors.push(assertion.message || 'Expected value to not be null');
        }
        break;
      case 'isTrue':
        if (assertion.actual !== true) {
          errors.push(assertion.message || 'Expected value to be true');
        }
        break;
      case 'isFalse':
        if (assertion.actual !== false) {
          errors.push(assertion.message || 'Expected value to be false');
        }
        break;
      default:
        errors.push(`Unknown assertion type: ${assertion.type}`);
    }
  }

  return {
    nodeId: assertionNode.id,
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    duration_ms: Date.now() - startTime,
  };
}
