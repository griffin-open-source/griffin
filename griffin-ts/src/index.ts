/**
 * Griffin DSL - Top-level exports for building API tests.
 *
 * Import schema values from "griffin/schema"
 * Import schema-derived types from "griffin/types"
 */

// ============================================================================
// DSL Builders
// ============================================================================

export { createGraphBuilder } from "./builder";
export type { TestBuilder } from "./builder";

export { createTestBuilder } from "./sequential-builder";
export type {
  SequentialTestBuilder,
  AssertionCallback,
} from "./sequential-builder";

// ============================================================================
// DSL Node Factories
// ============================================================================

export { Endpoint, Wait, Assertion } from "./builder";
export type {
  EndpointConfig,
  WaitDuration as WaitDurationType,
} from "./builder";

// ============================================================================
// DSL Helpers
// ============================================================================

export { Frequency } from "./frequency";
export { WaitDuration } from "./wait";
export { target, isTargetRef } from "./target";
export { secret, isSecretRef } from "./secrets";
export type { SecretRefData, SecretOptions } from "./secrets";

// ============================================================================
// DSL Constants
// ============================================================================

export { START, END } from "./constants";
export type { START as StartType, END as EndType } from "./constants";

export { GET, POST, PUT, DELETE, PATCH } from "./http-methods";
export { Json, Xml, Text } from "./response-formats";

// ============================================================================
// Assertion DSL
// ============================================================================

export {
  Assert,
  AssertBuilder,
  UnaryPredicate,
  BinaryPredicateOperator,
  createStateProxy,
} from "./assertions";

export type {
  SerializedAssertion,
  PathDescriptor,
  BinaryPredicate,
  StateProxy,
  NodeResultProxy,
  NestedProxy,
} from "./assertions";
