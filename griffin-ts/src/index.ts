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

export { HttpRequest, Wait, Assertion } from "./builder.js";
export type {
  HttpRequestConfig,
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

export { Assert, AssertBuilder, createStateProxy } from "./assertions.js";

export type {
  BodyDescriptor,
  HeaderDescriptor,
  StatusDescriptor,
  LatencyDescriptor,
  AssertionDescriptor,
  StateProxy,
  NodeResultProxy,
  BodyProxy,
  HeaderValueProxy,
  HeadersProxy,
  StatusProxy,
  LatencyProxy,
  AssertableProxy,
} from "./assertions.js";

// ============================================================================
// Schema Exports (for validation and type generation)
// ============================================================================

export {
  CURRENT_PLAN_VERSION,
  SUPPORTED_PLAN_VERSIONS,
} from "./schema-exports.js";

// ============================================================================
// Migration Functions
// ============================================================================

export {
  migratePlan,
  migrateToLatest,
  isSupportedVersion,
  getSupportedVersions,
} from "./migrations.js";

export type {
  PlanDSL,
  ResolvedPlan,
  ResolvedPlanV1,
  NodeDSL,
  NodeResolved,
  HttpRequestDSL,
  HttpRequestResolved,
  Edge,
  Frequency as FrequencyType,
  Assertion as AssertionType,
  Assertions as AssertionsType,
  SecretRef as SecretRefType,
  VariableRef as VariableRefType,
} from "./schema-exports.js";
