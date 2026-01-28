/**
 * TypeBox schemas and enums for griffin test plans.
 * Import from "griffin/schema" to access validation schemas.
 */

export {
  // Schema values - DSL (what users write)
  SecretRefDataSchema,
  SecretRefSchema,
  StringLiteralSchema,
  VariableRefSchema,
  ResponseFormatSchema,
  HttpMethodSchema,
  HttpRequestDSLSchema,
  FrequencySchema,
  WaitSchema,
  JSONPathSchema,
  FrequencyUnitSchema,
  XMLPathSchema,
  TextPathSchema,
  UnaryPredicateSchema,
  BinaryPredicateOperatorSchema,
  BinaryPredicateSchema,
  AssertionSchema,
  AssertionsSchema,
  NodeDSLSchema,
  EdgeSchema,
  PlanDSLSchema,
  PlanDSLSchemaV1,

  // Schema values - Resolved (what hub/executor use)
  ResolvedStringSchema,
  HttpRequestResolvedSchema,
  NodeResolvedSchema,
  ResolvedPlanV1Schema,
  ResolvedPlanSchema,

  // Enums (runtime values)
  FrequencyUnit,
  ResponseFormat,
  HttpMethod,
  NodeType,
  UnaryPredicate,
  BinaryPredicateOperator,

  // Constants
  CURRENT_PLAN_VERSION,
  SUPPORTED_PLAN_VERSIONS,
} from "./schema.js";

// Type exports
export type {
  PlanDSL,
  PlanDSLV1,
  NodeDSL,
  HttpRequestDSL,
  Edge,
  Frequency,
  Assertion,
  Assertions,
  SecretRef,
  VariableRef,
  ResolvedPlan,
  ResolvedPlanV1,
  NodeResolved,
  HttpRequestResolved,
} from "./schema.js";
