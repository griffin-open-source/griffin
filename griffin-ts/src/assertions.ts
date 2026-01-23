/**
 * Rich assertion DSL for constructing type-safe test assertions with JSONPath support.
 *
 * This module provides:
 * - StateProxy: Tracks node access patterns and converts them to JSONPath
 * - Assert: Builder for creating assertions with fluent API
 * - Support for unary and binary predicates with negation
 */

import { JSONAccessor } from "./schema.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Identifies which node and which part of its result we're asserting on
 */
export interface PathDescriptor {
  nodeId: string;
  accessor: JSONAccessor;
  path: string[]; // JSONPath segments (e.g., ["data", "id"])
}

/**
 * Unary predicates that check a property without comparing to a value
 */
export enum UnaryPredicate {
  IS_NULL = "IS_NULL",
  IS_NOT_NULL = "IS_NOT_NULL",
  IS_TRUE = "IS_TRUE",
  IS_FALSE = "IS_FALSE",
  IS_EMPTY = "IS_EMPTY",
  IS_NOT_EMPTY = "IS_NOT_EMPTY",
}

/**
 * Binary predicate operators that compare against an expected value
 */
export enum BinaryPredicateOperator {
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  GREATER_THAN = "GREATER_THAN",
  LESS_THAN = "LESS_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  NOT_STARTS_WITH = "NOT_STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  NOT_ENDS_WITH = "NOT_ENDS_WITH",
}

/**
 * Binary predicate with operator and expected value
 */
export interface BinaryPredicate {
  operator: BinaryPredicateOperator;
  expected: unknown;
}

/**
 * Serialized assertion ready for execution
 */
export interface SerializedAssertion {
  nodeId: string;
  accessor: JSONAccessor;
  path: string[];
  predicate: UnaryPredicate | BinaryPredicate;
}

// ============================================================================
// State Proxy
// ============================================================================

/**
 * Symbol used to store path metadata in proxy objects
 */
const PATH_SYMBOL = Symbol("__path__");

/**
 * Internal interface for proxy objects that carry path information
 */
interface ProxyWithPath {
  [PATH_SYMBOL]: PathDescriptor;
}

/**
 * Proxy for accessing nested properties within a node result accessor (body, headers, status)
 * Note: The 'at' method is available at runtime but typed as NestedProxy for simplicity
 */
export type NestedProxy = ProxyWithPath & {
  [key: string]: NestedProxy;
};

/**
 * Proxy for a node result with body, headers, and status accessors
 */
export type NodeResultProxy = {
  body: NestedProxy;
  headers: NestedProxy;
  status: NestedProxy;
};

/**
 * State proxy that maps node names to their result proxies
 */
export type StateProxy<NodeNames extends string = string> = {
  [K in NodeNames]: NodeResultProxy;
};

/**
 * Creates a nested proxy that accumulates path segments
 */
function createNestedProxy(descriptor: PathDescriptor): NestedProxy {
  return new Proxy({} as NestedProxy, {
    get(_, prop: string | symbol) {
      if (prop === PATH_SYMBOL) {
        return descriptor;
      }
      if (prop === "at") {
        return (index: number) => {
          return createNestedProxy({
            ...descriptor,
            path: [...descriptor.path, String(index)],
          });
        };
      }
      // Accumulate string property access
      return createNestedProxy({
        ...descriptor,
        path: [...descriptor.path, String(prop)],
      });
    },
  });
}

/**
 * Creates a proxy for a node result with body, headers, and status accessors
 */
function createNodeResultProxy(nodeId: string): NodeResultProxy {
  return {
    body: createNestedProxy({ nodeId, accessor: JSONAccessor.BODY, path: [] }),
    headers: createNestedProxy({ nodeId, accessor: JSONAccessor.HEADERS, path: [] }),
    status: createNestedProxy({ nodeId, accessor: JSONAccessor.STATUS, path: [] }),
  };
}

/**
 * Creates a state proxy for the given node names
 */
export function createStateProxy<NodeNames extends string>(
  nodeNames: NodeNames[],
): StateProxy<NodeNames> {
  const proxy = new Proxy(
    {},
    {
      get(_, nodeName: string | symbol) {
        if (typeof nodeName === "symbol") {
          return undefined;
        }
        return createNodeResultProxy(nodeName);
      },
    },
  );
  return proxy as StateProxy<NodeNames>;
}

// ============================================================================
// Assert Builder
// ============================================================================

export class AssertBuilder {
  private negated = false;

  constructor(private descriptor: PathDescriptor) {}

  /**
   * Negation modifier - flips the meaning of the subsequent predicate
   *
   * @example
   * Assert(state["node"].body["id"]).not.isNull()  // IS_NOT_NULL
   * Assert(state["node"].body["name"]).not.equals("") // NOT_EQUAL
   */
  get not(): this {
    const negatedBuilder = new AssertBuilder(this.descriptor);
    negatedBuilder.negated = !this.negated;
    return negatedBuilder as this;
  }

  // Unary predicates

  isNull(): SerializedAssertion {
    return this.createAssertion(
      this.negated ? UnaryPredicate.IS_NOT_NULL : UnaryPredicate.IS_NULL,
    );
  }

  isDefined(): SerializedAssertion {
    return this.createAssertion(
      this.negated ? UnaryPredicate.IS_NULL : UnaryPredicate.IS_NOT_NULL,
    );
  }

  isTrue(): SerializedAssertion {
    return this.createAssertion(
      this.negated ? UnaryPredicate.IS_FALSE : UnaryPredicate.IS_TRUE,
    );
  }

  isFalse(): SerializedAssertion {
    return this.createAssertion(
      this.negated ? UnaryPredicate.IS_TRUE : UnaryPredicate.IS_FALSE,
    );
  }

  isEmpty(): SerializedAssertion {
    return this.createAssertion(
      this.negated ? UnaryPredicate.IS_NOT_EMPTY : UnaryPredicate.IS_EMPTY,
    );
  }

  // Binary predicates

  equals(expected: unknown): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.NOT_EQUAL
        : BinaryPredicateOperator.EQUAL,
      expected,
    });
  }

  greaterThan(expected: number): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.LESS_THAN_OR_EQUAL
        : BinaryPredicateOperator.GREATER_THAN,
      expected,
    });
  }

  lessThan(expected: number): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.GREATER_THAN_OR_EQUAL
        : BinaryPredicateOperator.LESS_THAN,
      expected,
    });
  }

  greaterThanOrEqual(expected: number): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.LESS_THAN
        : BinaryPredicateOperator.GREATER_THAN_OR_EQUAL,
      expected,
    });
  }

  lessThanOrEqual(expected: number): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.GREATER_THAN
        : BinaryPredicateOperator.LESS_THAN_OR_EQUAL,
      expected,
    });
  }

  contains(expected: string): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.NOT_CONTAINS
        : BinaryPredicateOperator.CONTAINS,
      expected,
    });
  }

  startsWith(expected: string): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.NOT_STARTS_WITH
        : BinaryPredicateOperator.STARTS_WITH,
      expected,
    });
  }

  endsWith(expected: string): SerializedAssertion {
    return this.createAssertion({
      operator: this.negated
        ? BinaryPredicateOperator.NOT_ENDS_WITH
        : BinaryPredicateOperator.ENDS_WITH,
      expected,
    });
  }

  private createAssertion(
    predicate: UnaryPredicate | BinaryPredicate,
  ): SerializedAssertion {
    return {
      nodeId: this.descriptor.nodeId,
      accessor: this.descriptor.accessor,
      path: this.descriptor.path,
      predicate,
    };
  }
}

/**
 * Creates an assertion builder from a state proxy reference
 *
 * @param proxyRef - A reference obtained from the state proxy (e.g., state["node"].body["id"])
 * @returns An AssertBuilder for constructing the assertion
 *
 * @example
 * Assert(state["create_user"].body["data"]["id"]).not.isNull()
 * Assert(state["create_user"].status).equals(201)
 * Assert(state["create_user"].headers["content-type"]).contains("application/json")
 */
export function Assert(proxyRef: NestedProxy): AssertBuilder {
  const descriptor = (proxyRef as ProxyWithPath)[PATH_SYMBOL];
  if (!descriptor) {
    throw new Error(
      "Assert() must be called with a reference from the state proxy",
    );
  }
  return new AssertBuilder(descriptor);
}
