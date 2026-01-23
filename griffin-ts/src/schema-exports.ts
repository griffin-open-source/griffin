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
  EndpointDSLSchema,
  FrequencySchema,
  WaitSchema,
  JSONPathSchema,
  JSONAccessorSchema,
  FrequencyUnitSchema,
  XMLPathSchema,
  TextPathSchema,
  UnaryPredicateSchema,
  BinaryPredicateOperatorSchema,
  BinaryPredicateSchema,
  JSONAssertionSchema,
  XMLAssertionSchema,
  TextAssertionSchema,
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
