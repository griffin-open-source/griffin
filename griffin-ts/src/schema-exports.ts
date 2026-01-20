/**
 * TypeBox schemas and enums for griffin test plans.
 * Import from "griffin/schema" to access validation schemas.
 */

export {
  // Schema values
  SecretRefDataSchema,
  SecretRefSchema,
  SecretOrStringSchema,
  ResponseFormatSchema,
  HttpMethodSchema,
  EndpointSchema,
  FrequencySchema,
  WaitSchema,
  JSONPathSchema,
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
  NodeTypeSchema,
  NodeSchema,
  EdgeSchema,
  TestPlanV1Schema,

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
