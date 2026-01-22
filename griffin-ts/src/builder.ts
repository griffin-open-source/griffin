import {
  TestPlanV1,
  Node,
  Edge,
  Frequency,
  HttpMethod,
  ResponseFormat,
  Endpoint,
  NodeType,
  Wait,
  Assertions,
  TEST_PLAN_VERSION,
  JSONAssertion,
} from "./schema.js";
import { type START as StartType, type END as EndType } from "./constants.js";

type RawPlan = Omit<
  TestPlanV1,
  "id" | "environment" | "organization" | "project"
>;

/**
 * A node definition without the id field.
 * The id is provided separately to addNode for cleaner separation of concerns.
 */
export type NodeWithoutId = Omit<Node, "id">;

/**
 * TestBuilder provides a type-safe DSL for constructing test plans with compile-time graph validation.
 *
 * Type parameters track the state of the graph during construction:
 * @template NodeName - Union of all registered node names
 * @template HasOutput - Union of nodes that have outgoing edges
 * @template HasInput - Union of nodes that have incoming edges
 */
export interface TestBuilder<
  NodeName extends string = never,
  HasOutput extends string = never,
  HasInput extends string = never,
> {
  /**
   * Adds a node to the test graph.
   *
   * @param name - Unique identifier for this node in the graph
   * @param node - Node definition (Endpoint, WaitNode, Assertion)
   * @returns Updated builder with the node registered in NodeName
   *
   * @example
   * ```typescript
   * builder.addNode("health", Endpoint({ method: GET, path: "/health", response_format: JSON }))
   * ```
   */
  addNode<Name extends string>(
    name: Name,
    node: NodeWithoutId,
  ): TestBuilder<NodeName | Name, HasOutput, HasInput>;

  /**
   * Adds a directed edge between two nodes in the graph.
   *
   * Compile-time constraints:
   * - `from` must be START or a node that doesn't already have an outgoing edge
   * - `to` must be END or a node that isn't the same as `from`
   * - Both nodes must exist (be registered via addNode)
   *
   * @param from - Source node name or START constant
   * @param to - Target node name or END constant
   * @returns Updated builder with edge tracking updated
   *
   * @example
   * ```typescript
   * builder
   *   .addEdge(START, "health")
   *   .addEdge("health", "wait")
   *   .addEdge("wait", END)
   * ```
   */
  addEdge<
    From extends StartType | Exclude<NodeName, HasOutput>,
    To extends EndType | Exclude<NodeName, From>,
  >(
    from: From,
    to: To,
  ): TestBuilder<
    NodeName,
    From extends StartType ? HasOutput : HasOutput | From,
    To extends EndType ? HasInput : HasInput | To
  >;

  /**
   * Builds the final test plan.
   *
   * This method is only callable when all graph constraints are satisfied:
   * - All nodes must have at least one outgoing edge
   * - All nodes must have at least one incoming edge
   *
   * If constraints aren't met, the return type becomes `never`, causing a compile error.
   */
  build: [Exclude<NodeName, HasOutput>] extends [never]
    ? [Exclude<NodeName, HasInput>] extends [never]
      ? () => TestPlanV1
      : {
          error: "Some nodes have no incoming edges";
          unconnected: Exclude<NodeName, HasInput>;
        }
    : {
        error: "Some nodes have no outgoing edges";
        unconnected: Exclude<NodeName, HasOutput>;
      };
}

/**
 * Internal implementation class for TestBuilder.
 * Uses explicit type assertions at method boundaries to maintain phantom type tracking.
 */
class TestBuilderImpl<
  NodeName extends string = never,
  HasOutput extends string = never,
  HasInput extends string = never,
> {
  private nodes: Node[] = [];
  private edges: Edge[] = [];

  constructor(
    private config: {
      name: string;
      frequency: Frequency;
      locations?: string[];
    },
  ) {}

  addNode<Name extends string>(
    name: Name,
    node: NodeWithoutId,
  ): TestBuilder<NodeName | Name, HasOutput, HasInput> {
    // Merge the name into the node to create a complete Node
    // Type assertion required: spreading Omit<Node, 'id'> + id produces a valid Node at runtime
    this.nodes.push({ ...node, id: name } as unknown as Node);
    // Type assertion: we've added Name to NodeName union
    return this as unknown as TestBuilder<NodeName | Name, HasOutput, HasInput>;
  }

  addEdge<
    From extends StartType | Exclude<NodeName, HasOutput>,
    To extends EndType | Exclude<NodeName, From>,
  >(
    from: From,
    to: To,
  ): TestBuilder<
    NodeName,
    From extends StartType ? HasOutput : HasOutput | From,
    To extends EndType ? HasInput : HasInput | To
  > {
    this.edges.push({ from, to });
    // Type assertion: we've updated HasOutput and HasInput based on edge direction
    return this as unknown as TestBuilder<
      NodeName,
      From extends StartType ? HasOutput : HasOutput | From,
      To extends EndType ? HasInput : HasInput | To
    >;
  }

  get build(): TestBuilder<NodeName, HasOutput, HasInput>["build"] {
    const { name, frequency, locations } = this.config;
    const nodes = this.nodes;
    const edges = this.edges;

    const buildFn = (): RawPlan => {
      return {
        name,
        version: TEST_PLAN_VERSION,
        frequency,
        locations,
        nodes,
        edges,
      };
    };

    // Type assertion: build is only callable when graph constraints are satisfied
    // The conditional type in TestBuilder['build'] enforces this at the call site
    return buildFn as TestBuilder<NodeName, HasOutput, HasInput>["build"];
  }
}

/**
 * Creates a new test builder for constructing a test plan.
 *
 * @param config - Configuration for the test plan
 * @param config.name - Name of the test
 * @param config.frequency - frequency for scheduled execution
 * @param config.locations - Optional array of location identifiers where this test should run
 * @returns A new TestBuilder instance
 *
 * @example
 * ```typescript
 * const plan = createGraphBuilder({
 *   name: "health-check",
 *   frequency: Frequency.every(5).minute(),
 *   locations: ["us-east-1", "eu-west-1"]
 * })
 *   .addNode("health", Endpoint({ method: GET, path: "/health", response_format: JSON }))
 *   .addEdge(START, "health")
 *   .addEdge("health", END)
 *   .build();
 * ```
 */
export function createGraphBuilder(config: {
  name: string;
  frequency: Frequency;
  locations?: string[];
}): TestBuilder {
  return new TestBuilderImpl(config);
}

// ============================================================================
// Node Factory Functions
// ============================================================================

/**
 * Configuration for an Endpoint node
 * Accepts DSL-friendly literal types which are converted to schema enums internally
 */
export interface EndpointConfig {
  method:
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"
    | "CONNECT"
    | "TRACE";
  path: string | Endpoint["path"];
  base: string | Endpoint["base"];
  response_format: "JSON" | "XML" | "TEXT";
  headers?: Record<string, any>;
  body?: any;
}

/**
 * Creates an Endpoint node for making HTTP requests.
 *
 * @param config - Endpoint configuration (method, path, base, headers, etc.)
 * @returns An Endpoint node (without id) ready to be added to a TestBuilder
 *
 * @example
 * ```typescript
 * import { variable } from './variable';
 *
 * builder.addNode("health", Endpoint({
 *   method: GET,
 *   path: "/health",
 *   base: variable("api-gateway"),
 *   response_format: JSON
 * }));
 * ```
 */
export function Endpoint(config: EndpointConfig): Omit<Endpoint, "id"> {
  return {
    type: NodeType.ENDPOINT,
    method: config.method as HttpMethod,
    path: config.path,
    base: config.base,
    response_format: config.response_format as ResponseFormat,
    headers: config.headers,
    body: config.body,
  };
}

/**
 * Duration specification for Wait nodes.
 * Accepts either milliseconds directly or an object with seconds/minutes.
 */
export type WaitDuration = number | { seconds: number } | { minutes: number };

/**
 * Converts a WaitDuration to milliseconds.
 */
function toMilliseconds(duration: WaitDuration): number {
  if (typeof duration === "number") {
    return duration;
  }
  if ("seconds" in duration) {
    return duration.seconds * 1000;
  }
  if ("minutes" in duration) {
    return duration.minutes * 60 * 1000;
  }
  throw new Error("Invalid duration format");
}

/**
 * Creates a Wait node that pauses execution for a specified duration.
 *
 * @param duration - Duration to wait (milliseconds, or {seconds: n}, or {minutes: n})
 * @returns A Wait node (without id) ready to be added to a TestBuilder
 *
 * @example
 * ```typescript
 * import { Wait, WaitDuration } from './index';
 *
 * builder.addNode("pause", Wait(WaitDuration.seconds(2)));
 * // or with raw milliseconds:
 * builder.addNode("pause", Wait(2000));
 * ```
 */
export function Wait(duration: WaitDuration): Omit<Wait, "id"> {
  return {
    type: NodeType.WAIT,
    duration_ms: toMilliseconds(duration),
  };
}

/**
 * Creates an Assertion node that validates test conditions.
 *
 * @param assertions - Array of SerializedAssertions to evaluate
 * @returns An Assertion node (without id) ready to be added to a TestBuilder
 *
 * @example
 * ```typescript
 * import { Assert } from './assertions';
 *
 * builder.addNode("checks", Assertion([
 *   Assert(state["node"].status).equals(200),
 *   Assert(state["node"].body["status"]).equals("ok")
 * ]));
 * ```
 */
export function Assertion(assertions: JSONAssertion[]): Omit<Assertions, "id"> {
  return {
    type: NodeType.ASSERTION,
    assertions: assertions.map((assertion) => ({
      assertionType: ResponseFormat.JSON,
      ...assertion,
    })),
  };
}
