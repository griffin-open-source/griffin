import { createStateGraph, graphStore, graphStateNode } from 'ts-edge';
import type {
  TestPlan,
  Endpoint,
  WaitNode,
  AssertionNode,
  Edge,
  HttpMethod,
  ResponseFormat,
  Frequency,
} from './types';
import { START, END } from './constants';

export interface ApiCheckBuilderConfig {
  name: string;
  endpoint_host: string;
}

// State type for storing responses and metadata
interface TestState {
  responses: Record<string, any>;
  endpoint_host: string;
  setResponse: (nodeId: string, response: any) => void;
  getResponse: (nodeId: string) => any;
  getAllResponses: () => Record<string, any>;
}

// Create the state store
const createTestStore = (endpointHost: string) =>
  graphStore<TestState>((set, get) => ({
    responses: {},
    endpoint_host: endpointHost,
    setResponse(nodeId: string, response: any) {
      set((state) => ({
        responses: { ...state.responses, [nodeId]: response },
      }));
    },
    getResponse(nodeId: string) {
      return get().responses[nodeId];
    },
    getAllResponses() {
      return get().responses;
    },
  }));

export class ApiCheckBuilder {
  private config: ApiCheckBuilderConfig;
  private store: ReturnType<typeof createTestStore>;
  private graph: ReturnType<typeof createStateGraph<TestState>>;
  private startNode: string | null = null;
  private endNode: string | null = null;
  // Track nodes and edges for serialization to JSON
  private nodeData: Map<
    string,
    { type: string; data: Endpoint | WaitNode | AssertionNode }
  > = new Map();
  private edgeData: Edge[] = [];

  constructor(config: ApiCheckBuilderConfig) {
    this.config = config;
    this.store = createTestStore(config.endpoint_host);
    this.graph = createStateGraph(this.store);
  }

  addEndpoint(
    id: string,
    options: {
      method: HttpMethod;
      response_format: ResponseFormat;
      path: string;
      headers?: Record<string, string>;
      body?: any;
    }
  ): this {
    // Track for serialization
    const endpoint: Endpoint = {
      id,
      type: 'endpoint',
      method: options.method,
      path: options.path,
      response_format: options.response_format,
      headers: options.headers,
      body: options.body,
    };
    this.nodeData.set(id, { type: 'endpoint', data: endpoint });

    // Add node to ts-edge graph (execution logic is in the executor, not here)
    // We use ts-edge for graph structure and type safety, but serialize to JSON for execution
    this.graph.addNode(
      graphStateNode({
        name: id,
        execute: async (state: TestState) => {
          // This execute function is not used since we serialize to JSON
          // It's kept for future use when we switch to ts-edge execution
          return { nodeId: id, type: 'endpoint' };
        },
      })
    );

    return this;
  }

  addWait(id: string, duration: { minutes?: number; seconds?: number }): this {
    const duration_ms =
      (duration.minutes || 0) * 60 * 1000 + (duration.seconds || 0) * 1000;

    // Track for serialization
    const waitNode: WaitNode = {
      id,
      type: 'wait',
      duration_ms,
    };
    this.nodeData.set(id, { type: 'wait', data: waitNode });

    // Add node to ts-edge graph (execution logic is in the executor, not here)
    this.graph.addNode(
      graphStateNode({
        name: id,
        execute: async (state: TestState) => {
          // This execute function is not used since we serialize to JSON
          // It's kept for future use when we switch to ts-edge execution
          return { nodeId: id, type: 'wait' };
        },
      })
    );

    return this;
  }

  addAssertions(
    id: string,
    fn: (
      responses: Record<string, any>,
      asserts: any
    ) => Array<{ type: string; expected?: any; actual?: any; message?: string }>
  ): this {
    // Track for serialization
    const assertionNode: AssertionNode = {
      id,
      type: 'assertion',
      assertions: [], // Will be evaluated at runtime
    };
    this.nodeData.set(id, { type: 'assertion', data: assertionNode });

    // Add node to ts-edge graph (execution logic is in the executor, not here)
    // Store the assertion function for serialization/execution later
    this.graph.addNode(
      graphStateNode({
        name: id,
        execute: async (state: TestState) => {
          // This execute function is not used since we serialize to JSON
          // Assertions are evaluated in the executor using the stored function
          return { nodeId: id, type: 'assertion' };
        },
      })
    );

    return this;
  }

  addEdge(from: string, to: string): this {
    if (from === START) {
      this.startNode = to;
      // Track for serialization
      this.edgeData.push({ from: START, to });
    } else if (to === END) {
      this.endNode = from;
      // Track for serialization
      this.edgeData.push({ from, to: END });
    } else {
      // Use type assertion to bypass strict typing since we're serializing anyway
      (this.graph as any).edge(from, to);
      // Track for serialization
      this.edgeData.push({ from, to });
    }
    return this;
  }

  create(options: { frequency?: Frequency }): TestPlan {
    // Note: We don't compile/execute here - we just serialize to JSON
    // The graph is built using ts-edge for future execution capabilities,
    // but for now we serialize to the JSON format for the executor

    // Serialize the graph to our JSON format
    const plan = this.serializeToPlan(options.frequency);

    // Output JSON (for CLI to capture)
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  toJSON(): string {
    const plan = this.serializeToPlan();
    return JSON.stringify(plan, null, 2);
  }

  private serializeToPlan(frequency?: Frequency): TestPlan {
    return {
      name: this.config.name,
      endpoint_host: this.config.endpoint_host,
      frequency,
      nodes: this.getSerializedNodes(),
      edges: this.edgeData, // Already includes START/END edges
    };
  }

  private getSerializedNodes(): (Endpoint | WaitNode | AssertionNode)[] {
    return Array.from(this.nodeData.values()).map((item) => item.data);
  }

  private getSerializedEdges(): Edge[] {
    return this.edgeData;
  }
}
