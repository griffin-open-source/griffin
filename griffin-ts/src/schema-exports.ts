/**
 * TypeBox schemas and enums for griffin test monitors.
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
  UnaryPredicateOperatorSchema,
  BinaryPredicateOperatorSchema,
  BinaryPredicateSchema,
  AssertionSchema,
  AssertionsSchema,
  NodeDSLSchema,
  EdgeSchema,
  MonitorDSLSchema,
  MonitorDSLSchemaV1,

  // Schema values - Resolved (what hub/executor use)
  ResolvedStringSchema,
  HttpRequestResolvedSchema,
  NodeResolvedSchema,
  ResolvedMonitorV1Schema,
  ResolvedMonitorSchema,

  // Enums (runtime values)
  FrequencyUnit,
  ResponseFormat,
  HttpMethod,
  NodeType,
  UnaryPredicate,
  BinaryPredicateOperator,

  // Constants
  CURRENT_MONITOR_VERSION,
  SUPPORTED_MONITOR_VERSIONS,
} from "./schema.js";

// Type exports
export type {
  MonitorDSL,
  MonitorDSLV1,
  NodeDSL,
  HttpRequestDSL,
  Edge,
  Frequency,
  Assertion,
  Assertions,
  SecretRef,
  VariableRef,
  ResolvedMonitor,
  ResolvedMonitorV1,
  NodeResolved,
  HttpRequestResolved,
} from "./schema.js";
