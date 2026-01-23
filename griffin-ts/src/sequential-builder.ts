import {
  Endpoint,
  Wait,
  Assertion,
  type EndpointConfig,
  type WaitDuration,
} from "./builder.js";
import { START, END } from "./constants.js";
import {
  TEST_PLAN_VERSION,
  Edge,
  NodeDSL,
  Frequency,
  PlanDSL,
  ResponseFormat,
} from "./schema.js";
import {
  createStateProxy,
  type SerializedAssertion,
  type StateProxy,
} from "./assertions.js";

/**
 * Callback type for building assertions with type-safe state access
 */
export type AssertionCallback<NodeNames extends string> = (
  state: StateProxy<NodeNames>,
) => SerializedAssertion[];

/**
 * SequentialTestBuilder provides a simplified DSL for creating linear test flows.
 * Edges are automatically created based on the order nodes are added.
 * No manual edge management required - just add steps in sequence.
 *
 * @template NodeNames - Union of all registered node names for type-safe state access
 */
export interface SequentialTestBuilder<NodeNames extends string = never> {
  /**
   * Adds an endpoint request to the sequence.
   *
   * @param name - Unique name for this node
   * @param config - Endpoint configuration
   * @returns Updated builder with node name registered
   *
   * @example
   * ```typescript
   * builder.request("create_user", {
   *   method: POST,
   *   path: "/api/v1/users",
   *   response_format: Json,
   *   body: { name: "Test User" }
   * })
   * ```
   */
  request<Name extends string>(
    name: Name,
    config: EndpointConfig,
  ): SequentialTestBuilder<NodeNames | Name>;

  /**
   * Adds a wait/delay to the sequence.
   *
   * @param name - Unique name for this node
   * @param duration - How long to wait
   * @returns Updated builder with node name registered
   *
   * @example
   * ```typescript
   * builder.wait("pause", Wait.seconds(5))
   * // or with raw milliseconds:
   * builder.wait("pause", 5000)
   * ```
   */
  wait<Name extends string>(
    name: Name,
    duration: WaitDuration,
  ): SequentialTestBuilder<NodeNames | Name>;

  /**
   * Adds assertions to the sequence using a callback with type-safe state access.
   *
   * The callback receives a state proxy that provides autocomplete for all registered
   * node names and allows building rich JsonPath-based assertions.
   *
   * @param callback - Function that receives state proxy and returns assertions
   * @returns Updated builder (no new node name registered - uses auto-generated name)
   *
   * @example
   * ```typescript
   * builder.assert((state) => [
   *   Assert(state["create_user"].status).equals(201),
   *   Assert(state["create_user"].body["data"]["id"]).not.isNull(),
   *   Assert(state["create_user"].headers["content-type"]).contains("application/json"),
   * ])
   * ```
   */
  assert(
    callback: AssertionCallback<NodeNames>,
  ): SequentialTestBuilder<NodeNames>;

  /**
   * Builds the final test plan.
   * Automatically connects all nodes in sequence: START → node1 → node2 → ... → END
   *
   * @returns The completed TestPlan
   */
  build(): PlanDSL;
}

/**
 * Internal implementation class for SequentialTestBuilder.
 */
class SequentialTestBuilderImpl<
  NodeNames extends string = never,
> implements SequentialTestBuilder<NodeNames> {
  private nodes: NodeDSL[] = [];
  private nodeNames: string[] = [];
  private nodeCounter = 0;

  constructor(
    private config: {
      name: string;
      frequency: Frequency;
      locations?: string[];
    },
  ) {}

  /**
   * Generates a unique auto-generated node name
   */
  private generateNodeName(): string {
    return `step_${this.nodeCounter++}`;
  }

  request<Name extends string>(
    name: Name,
    config: EndpointConfig,
  ): SequentialTestBuilder<NodeNames | Name> {
    const node = Endpoint(config);
    this.nodes.push({ ...node, id: name } as NodeDSL);
    this.nodeNames.push(name);
    return this as unknown as SequentialTestBuilder<NodeNames | Name>;
  }

  wait<Name extends string>(
    name: Name,
    duration: WaitDuration,
  ): SequentialTestBuilder<NodeNames | Name> {
    const node = Wait(duration);
    this.nodes.push({ ...node, id: name } as NodeDSL);
    this.nodeNames.push(name);
    return this as unknown as SequentialTestBuilder<NodeNames | Name>;
  }

  assert(
    callback: AssertionCallback<NodeNames>,
  ): SequentialTestBuilder<NodeNames> {
    const stateProxy = createStateProxy(this.nodeNames as NodeNames[]);
    const serializedAssertions = callback(stateProxy);

    const nodeName = this.generateNodeName();
    const node = Assertion(serializedAssertions.map((assertion) => ({
      ...assertion,
      assertionType: ResponseFormat.JSON,
    })));
    this.nodes.push({ ...node, id: nodeName } as NodeDSL);
    this.nodeNames.push(nodeName);
    return this as unknown as SequentialTestBuilder<NodeNames>;
  }

  build(): PlanDSL {
    const { name, frequency, locations } = this.config;
    const edges: Edge[] = [];

    // If no nodes, return empty plan with just START->END
    if (this.nodes.length === 0) {
      return {
        name,
        frequency,
        locations,
        version: TEST_PLAN_VERSION,
        nodes: [],
        edges: [{ from: START, to: END }],
      };
    }

    // Connect START to first node
    edges.push({ from: START, to: this.nodes[0].id });

    // Connect consecutive nodes
    for (let i = 0; i < this.nodes.length - 1; i++) {
      edges.push({
        from: this.nodes[i].id,
        to: this.nodes[i + 1].id,
      });
    }

    // Connect last node to END
    edges.push({ from: this.nodes[this.nodes.length - 1].id, to: END });

    return {
      name,
      version: TEST_PLAN_VERSION,
      frequency,
      locations,
      nodes: this.nodes,
      edges,
    };
  }
}

/**
 * Creates a sequential test builder for simple linear test flows.
 *
 * Unlike createGraphBuilder, this builder automatically manages edges
 * based on the order in which nodes are added. Perfect for straightforward
 * sequential tests where you don't need complex branching logic.
 *
 * @param config - Test configuration
 * @param config.name - Name of the test
 * @param config.frequency - Optional frequency for scheduled execution
 * @param config.locations - Optional array of location identifiers where this test should run
 * @returns A new SequentialTestBuilder instance
 *
 * @example
 * ```typescript
 * import { createTestBuilder, POST, GET, Json, Frequency, Assert } from "griffin-ts";
 *
 * const plan = createTestBuilder({
 *   name: "create-and-verify-user",
 *   frequency: Frequency.every(5).minute(),
 *   locations: ["us-east-1", "eu-west-1"]
 * })
 *   .request("create_user", {
 *     method: POST,
 *     path: "/api/v1/users",
 *     response_format: Json,
 *     body: { name: "Test User", email: "test@example.com" }
 *   })
 *   .assert((state) => [
 *     Assert(state["create_user"].status).equals(201),
 *     Assert(state["create_user"].body["data"]["id"]).not.isNull(),
 *   ])
 *   .request("get_user", {
 *     method: GET,
 *     path: "/api/v1/users/123",
 *     response_format: Json
 *   })
 *   .assert((state) => [
 *     Assert(state["get_user"].status).equals(200),
 *     Assert(state["get_user"].body["data"]["name"]).equals("Test User"),
 *   ])
 *   .build();
 * ```
 */
export function createTestBuilder(config: {
  name: string;
  frequency: Frequency;
  locations?: string[];
}): SequentialTestBuilder {
  return new SequentialTestBuilderImpl(config);
}
