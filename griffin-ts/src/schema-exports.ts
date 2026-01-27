/**
 * TypeBox schemas and enums for griffin test plans.
 * Import from "griffin/schema" to access validation schemas.
 */

export {
  // Schema values
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

  // Enums (runtime values)
  FrequencyUnit,
  ResponseFormat,
  HttpMethod,
  NodeType,
  UnaryPredicate,
  BinaryPredicateOperator,

  // Constants
  TEST_PLAN_VERSION,
} from "./schema.js";
