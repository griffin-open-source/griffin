/**
 * Griffin DSL - Top-level exports for building API tests.
 *
 * Import schema values from "griffin/schema"
 * Import schema-derived types from "griffin/types"
 */

// ============================================================================
// DSL Builders
// ============================================================================

export { createGraphBuilder } from "./builder.js";
export type { TestBuilder } from "./builder.js";

export { createTestBuilder } from "./sequential-builder.js";
export type {
  SequentialTestBuilder,
  AssertionCallback,
} from "./sequential-builder.js";

// ============================================================================
// DSL Node Factories
// ============================================================================

export { Endpoint, Wait, Assertion } from "./builder.js";
export type {
  EndpointConfig,
  WaitDuration as WaitDurationType,
} from "./builder.js";

// ============================================================================
// DSL Helpers
// ============================================================================

export { Frequency } from "./frequency.js";
export { WaitDuration } from "./wait.js";
export { variable, isVariableRef } from "./variable.js";
export type { VariableRef } from "./variable.js";
export { secret, isSecretRef } from "./secrets.js";
export type { SecretOptions } from "./secrets.js";

// ============================================================================
// DSL Constants
// ============================================================================

export { START, END } from "./constants.js";
export type { START as StartType, END as EndType } from "./constants.js";

export { GET, POST, PUT, DELETE, PATCH } from "./http-methods.js";
export { Json, Xml, Text } from "./response-formats.js";

// ============================================================================
// Assertion DSL
// ============================================================================

export {
  Assert,
  AssertBuilder,
  UnaryPredicate,
  BinaryPredicateOperator,
  createStateProxy,
} from "./assertions.js";

export type {
  SerializedAssertion,
  PathDescriptor,
  BinaryPredicate,
  StateProxy,
  NodeResultProxy,
  NestedProxy,
} from "./assertions.js";
