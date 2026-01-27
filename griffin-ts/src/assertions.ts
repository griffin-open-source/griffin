/**
 * Rich assertion DSL for constructing type-safe test assertions with JSONPath support.
 *
 * This module provides:
 * - StateProxy: Tracks node access patterns and converts them to JSONPath
 * - Assert: Builder for creating assertions with fluent API
 * - Support for unary and binary predicates with negation
 */

import {
  type Assertion,
  AssertionSubject,
  BinaryPredicateOperator,
  ResponseFormat,
  UnaryPredicate,
  UnaryPredicateOperator,
} from "./schema.js";

//type Assertion = Assertion;

// ============================================================================
// Types
// ============================================================================

/**
 * Descriptor for body assertions - supports nested JSONPath access
 */
export interface BodyDescriptor {
  nodeId: string;
  subject: AssertionSubject.BODY;
  path: string[]; // JSONPath segments (e.g., ["data", "id"])
  responseType: ResponseFormat;
}

/**
 * Descriptor for header assertions - single header name, no nesting
 */
export interface HeaderDescriptor {
  nodeId: string;
  subject: AssertionSubject.HEADERS;
  headerName: string;
}

/**
 * Descriptor for status assertions - no path needed
 */
export interface StatusDescriptor {
  nodeId: string;
  subject: AssertionSubject.STATUS;
}

/**
 * Descriptor for latency assertions - no path needed
 */
export interface LatencyDescriptor {
  nodeId: string;
  subject: AssertionSubject.LATENCY;
}

/**
 * Union of all assertion descriptors
 */
export type AssertionDescriptor =
  | BodyDescriptor
  | HeaderDescriptor
  | StatusDescriptor
  | LatencyDescriptor;

/**
 * Binary predicate with operator and expected value
 */
//export interface BinaryPredicate {
//  operator: BinaryPredicateOperator;
//  expected: unknown;
//}

// ============================================================================
// State Proxy
// ============================================================================

/**
 * Symbol used to store descriptor metadata in proxy objects
 */
const DESCRIPTOR_SYMBOL = Symbol("__descriptor__");

/**
 * Internal interface for proxy objects that carry a body descriptor
 */
interface ProxyWithBodyDescriptor {
  [DESCRIPTOR_SYMBOL]: BodyDescriptor;
}

/**
 * Internal interface for proxy objects that carry a header descriptor
 */
interface ProxyWithHeaderDescriptor {
  [DESCRIPTOR_SYMBOL]: HeaderDescriptor;
}

/**
 * Internal interface for proxy objects that carry a status descriptor
 */
interface ProxyWithStatusDescriptor {
  [DESCRIPTOR_SYMBOL]: StatusDescriptor;
}

/**
 * Internal interface for proxy objects that carry a latency descriptor
 */
interface ProxyWithLatencyDescriptor {
  [DESCRIPTOR_SYMBOL]: LatencyDescriptor;
}

/**
 * Proxy for accessing nested properties within a body.
 * Supports arbitrary depth: body["data"]["users"][0]["name"]
 */
export type BodyProxy = ProxyWithBodyDescriptor & {
  [key: string]: BodyProxy;
};

/**
 * Terminal proxy for a single header value. No further nesting allowed.
 */
export type HeaderValueProxy = ProxyWithHeaderDescriptor;

/**
 * Proxy for accessing header values. Only allows one level of access.
 * e.g., headers["content-type"] returns a HeaderValueProxy
 */
export type HeadersProxy = {
  [key: string]: HeaderValueProxy;
};

/**
 * Terminal proxy for status. No further nesting allowed.
 */
export type StatusProxy = ProxyWithStatusDescriptor;

/**
 * Terminal proxy for latency. No further nesting allowed.
 */
export type LatencyProxy = ProxyWithLatencyDescriptor;

/**
 * Proxy for a node result with body, headers, status, and latency accessors
 */
export type NodeResultProxy = {
  body: BodyProxy;
  headers: HeadersProxy;
  status: StatusProxy;
  latency: LatencyProxy;
};

/**
 * State proxy that maps node names to their result proxies
 */
export type StateProxy<NodeNames extends string = string> = {
  [K in NodeNames]: NodeResultProxy;
};

/**
 * Creates a body proxy that accumulates JSONPath segments
 */
function createBodyProxy(descriptor: BodyDescriptor): BodyProxy {
  return new Proxy({} as BodyProxy, {
    get(_, prop: string | symbol) {
      if (prop === DESCRIPTOR_SYMBOL) {
        return descriptor;
      }
      if (prop === "at") {
        return (index: number) => {
          return createBodyProxy({
            ...descriptor,
            path: [...descriptor.path, String(index)],
          });
        };
      }
      // Accumulate string property access
      return createBodyProxy({
        ...descriptor,
        path: [...descriptor.path, String(prop)],
      });
    },
  });
}

/**
 * Creates a header value proxy (terminal - no further nesting)
 */
function createHeaderValueProxy(
  descriptor: HeaderDescriptor,
): HeaderValueProxy {
  return new Proxy({} as HeaderValueProxy, {
    get(_, prop: string | symbol) {
      if (prop === DESCRIPTOR_SYMBOL) {
        return descriptor;
      }
      return undefined;
    },
  });
}

/**
 * Creates a headers proxy that only allows one level of property access.
 * e.g., headers["content-type"] returns a HeaderValueProxy
 */
function createHeadersProxy(nodeId: string): HeadersProxy {
  return new Proxy({} as HeadersProxy, {
    get(_, prop: string | symbol) {
      if (typeof prop === "symbol") {
        return undefined;
      }
      return createHeaderValueProxy({
        nodeId,
        subject: AssertionSubject.HEADERS,
        headerName: prop,
      });
    },
  });
}

/**
 * Creates a status proxy (terminal - no further nesting)
 */
function createStatusProxy(descriptor: StatusDescriptor): StatusProxy {
  return new Proxy({} as StatusProxy, {
    get(_, prop: string | symbol) {
      if (prop === DESCRIPTOR_SYMBOL) {
        return descriptor;
      }
      return undefined;
    },
  });
}

/**
 * Creates a latency proxy (terminal - no further nesting)
 */
function createLatencyProxy(descriptor: LatencyDescriptor): LatencyProxy {
  return new Proxy({} as LatencyProxy, {
    get(_, prop: string | symbol) {
      if (prop === DESCRIPTOR_SYMBOL) {
        return descriptor;
      }
      return undefined;
    },
  });
}

/**
 * Creates a proxy for a node result with body, headers, status, and latency accessors
 */
function createNodeResultProxy(
  nodeId: string,
  responseType: ResponseFormat = ResponseFormat.JSON,
): NodeResultProxy {
  return {
    body: createBodyProxy({
      nodeId,
      subject: AssertionSubject.BODY,
      path: [],
      responseType,
    }),
    headers: createHeadersProxy(nodeId),
    status: createStatusProxy({
      nodeId,
      subject: AssertionSubject.STATUS,
    }),
    latency: createLatencyProxy({
      nodeId,
      subject: AssertionSubject.LATENCY,
    }),
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

  constructor(private descriptor: AssertionDescriptor) {}

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

  isNull(): Assertion {
    return this.createUnaryAssertion(
      this.negated
        ? UnaryPredicateOperator.IS_NOT_NULL
        : UnaryPredicateOperator.IS_NULL,
    );
  }

  isDefined(): Assertion {
    return this.createUnaryAssertion(
      this.negated
        ? UnaryPredicateOperator.IS_NULL
        : UnaryPredicateOperator.IS_NOT_NULL,
    );
  }

  isTrue(): Assertion {
    return this.createUnaryAssertion(
      this.negated
        ? UnaryPredicateOperator.IS_FALSE
        : UnaryPredicateOperator.IS_TRUE,
    );
  }

  isFalse(): Assertion {
    return this.createUnaryAssertion(
      this.negated
        ? UnaryPredicateOperator.IS_TRUE
        : UnaryPredicateOperator.IS_FALSE,
    );
  }

  isEmpty(): Assertion {
    return this.createUnaryAssertion(
      this.negated
        ? UnaryPredicateOperator.IS_NOT_EMPTY
        : UnaryPredicateOperator.IS_EMPTY,
    );
  }

  // Binary predicates

  equals(expected: unknown): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.NOT_EQUAL
        : BinaryPredicateOperator.EQUAL,
      expected,
    );
  }

  greaterThan(expected: number): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.LESS_THAN_OR_EQUAL
        : BinaryPredicateOperator.GREATER_THAN,
      expected,
    );
  }

  lessThan(expected: number): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.GREATER_THAN_OR_EQUAL
        : BinaryPredicateOperator.LESS_THAN,
      expected,
    );
  }

  greaterThanOrEqual(expected: number): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.LESS_THAN
        : BinaryPredicateOperator.GREATER_THAN_OR_EQUAL,
      expected,
    );
  }

  lessThanOrEqual(expected: number): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.GREATER_THAN
        : BinaryPredicateOperator.LESS_THAN_OR_EQUAL,
      expected,
    );
  }

  contains(expected: string): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.NOT_CONTAINS
        : BinaryPredicateOperator.CONTAINS,
      expected,
    );
  }

  startsWith(expected: string): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.NOT_STARTS_WITH
        : BinaryPredicateOperator.STARTS_WITH,
      expected,
    );
  }

  endsWith(expected: string): Assertion {
    return this.createBinaryAssertion(
      this.negated
        ? BinaryPredicateOperator.NOT_ENDS_WITH
        : BinaryPredicateOperator.ENDS_WITH,
      expected,
    );
  }

  private createUnaryAssertion(operator: UnaryPredicateOperator): Assertion {
    const descriptor = this.descriptor;
    switch (descriptor.subject) {
      case AssertionSubject.HEADERS:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          headerName: descriptor.headerName,
          predicate: { operator, type: "unary" },
        };
      case AssertionSubject.BODY:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          responseType: descriptor.responseType,
          path: descriptor.path,
          predicate: { operator, type: "unary" },
        };
      default:
        throw new Error(`Unsupported subject: ${descriptor.subject}`);
    }
  }
  private createBinaryAssertion(
    operator: BinaryPredicateOperator,
    expected: unknown,
  ): Assertion {
    const descriptor = this.descriptor;
    switch (descriptor.subject) {
      case AssertionSubject.BODY:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          responseType: descriptor.responseType,
          path: descriptor.path,
          predicate: { operator, expected, type: "binary" },
        };
      case AssertionSubject.STATUS:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          predicate: { operator, expected, type: "binary" },
        };
      case AssertionSubject.HEADERS:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          headerName: descriptor.headerName,
          predicate: { operator, expected, type: "binary" },
        };
      case AssertionSubject.LATENCY:
        return {
          nodeId: descriptor.nodeId,
          subject: descriptor.subject,
          predicate: { operator, expected, type: "binary" },
        };
    }
  }
}

/**
 * Union of all assertable proxy types
 */
export type AssertableProxy =
  | BodyProxy
  | HeaderValueProxy
  | StatusProxy
  | LatencyProxy;

/**
 * Internal interface for extracting descriptor from any proxy type
 */
interface ProxyWithDescriptor {
  [DESCRIPTOR_SYMBOL]: AssertionDescriptor;
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
export function Assert(proxyRef: AssertableProxy): AssertBuilder {
  const descriptor = (proxyRef as ProxyWithDescriptor)[DESCRIPTOR_SYMBOL];
  if (!descriptor) {
    throw new Error(
      "Assert() must be called with a reference from the state proxy",
    );
  }
  return new AssertBuilder(descriptor);
}
