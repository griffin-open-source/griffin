import { Type, type Static, type TSchema } from "typebox";

// Secret reference schema for values that may contain secrets
export const SecretRefDataSchema = Type.Object({
  provider: Type.String(),
  ref: Type.String(),
  version: Type.Optional(Type.String()),
  field: Type.Optional(Type.String()),
});

export const SecretRefSchema = Type.Object({
  $secret: SecretRefDataSchema,
});

// Union type for values that can be either a literal or a secret reference
export const SecretOrStringSchema = Type.Union([
  Type.String(),
  SecretRefSchema,
]);

export enum FrequencyUnit {
  MINUTE,
  HOUR,
  DAY,
}

export enum ResponseFormat {
  JSON,
  XML,
  TEXT,
}

export enum HttpMethod {
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  HEAD,
  OPTIONS,
  CONNECT,
  TRACE,
}
export enum NodeType {
  ENDPOINT,
  WAIT,
  ASSERTION,
}
export const ResponseFormatSchema = Type.Union([
  Type.Literal(ResponseFormat.JSON),
  Type.Literal(ResponseFormat.XML),
  Type.Literal(ResponseFormat.TEXT),
]);

export const HttpMethodSchema = Type.Union([
  Type.Literal(HttpMethod.GET),
  Type.Literal(HttpMethod.POST),
  Type.Literal(HttpMethod.PUT),
  Type.Literal(HttpMethod.DELETE),
  Type.Literal(HttpMethod.PATCH),
  Type.Literal(HttpMethod.HEAD),
  Type.Literal(HttpMethod.OPTIONS),
  Type.Literal(HttpMethod.CONNECT),
  Type.Literal(HttpMethod.TRACE),
]);

export const EndpointSchema = Type.Object({
  type: Type.Literal(NodeType.ENDPOINT),
  method: HttpMethodSchema,
  path: Type.String(),
  headers: Type.Optional(Type.Record(Type.String(), SecretOrStringSchema)),
  body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
  response_format: ResponseFormatSchema,
});
export type Endpoint = Static<typeof EndpointSchema>;

export const FrequencySchema = Type.Object({
  every: Type.Number(),
  unit: Type.Union([
    Type.Literal(FrequencyUnit.MINUTE),
    Type.Literal(FrequencyUnit.HOUR),
    Type.Literal(FrequencyUnit.DAY),
  ]),
});

export const WaitSchema = Type.Object({
  type: Type.Literal(NodeType.WAIT),
  duration_ms: Type.Number(),
});
export type Wait = Static<typeof WaitSchema>;

export const JSONPathSchema = Type.Array(Type.String());
export const XMLPathSchema = Type.Array(Type.String());
export const TextPathSchema = Type.String(); // Is there a regex to validate regex ????

export enum UnaryPredicate {
  IS_NULL,
  IS_NOT_NULL,
  IS_TRUE,
  IS_FALSE,
}
export const UnaryPredicateSchema = Type.Union([
  Type.Literal(UnaryPredicate.IS_NULL),
  Type.Literal(UnaryPredicate.IS_NOT_NULL),
  Type.Literal(UnaryPredicate.IS_TRUE),
  Type.Literal(UnaryPredicate.IS_FALSE),
]);

export enum BinaryPredicateOperator {
  EQUAL,
  NOT_EQUAL,
  GREATER_THAN,
  LESS_THAN,
  GREATER_THAN_OR_EQUAL,
  LESS_THAN_OR_EQUAL,
  CONTAINS,
  NOT_CONTAINS,
  STARTS_WITH,
  ENDS_WITH,
  IS_EMPTY,
  IS_NOT_EMPTY,
}
export const BinaryPredicateOperatorSchema = Type.Union([
  Type.Literal(BinaryPredicateOperator.EQUAL),
  Type.Literal(BinaryPredicateOperator.NOT_EQUAL),
  Type.Literal(BinaryPredicateOperator.GREATER_THAN),
  Type.Literal(BinaryPredicateOperator.LESS_THAN),
  Type.Literal(BinaryPredicateOperator.GREATER_THAN_OR_EQUAL),
  Type.Literal(BinaryPredicateOperator.LESS_THAN_OR_EQUAL),
  Type.Literal(BinaryPredicateOperator.CONTAINS),
  Type.Literal(BinaryPredicateOperator.NOT_CONTAINS),
]);

export const BinaryPredicateSchema = Type.Object({
  expected: Type.Any(),
  operator: BinaryPredicateOperatorSchema,
});

export type BinaryPredicate = Static<typeof BinaryPredicateSchema>;
export const JSONAssertionSchema = Type.Object({
  path: JSONPathSchema,
  predicate: Type.Union([UnaryPredicateSchema, BinaryPredicateSchema]),
});

export const XMLAssertionSchema = Type.Object({
  path: XMLPathSchema,
  expected: Type.Any(),
});

export type XMLAssertion = Static<typeof XMLAssertionSchema>;
export const TextAssertionSchema = Type.Object({
  path: TextPathSchema,
  expected: Type.Any(),
});
export type TextAssertion = Static<typeof TextAssertionSchema>;

export const AssertionsSchema = Type.Object({
  type: Type.Literal(NodeType.ASSERTION),
  assertions: Type.Array(
    Type.Union([JSONAssertionSchema, XMLAssertionSchema, TextAssertionSchema]),
  ),
});
export type Assertions = Static<typeof AssertionsSchema>;

export const NodeTypeSchema = Type.Union([
  Type.Literal(NodeType.ENDPOINT),
  Type.Literal(NodeType.WAIT),
  Type.Literal(NodeType.ASSERTION),
]);

export const NodeSchema = Type.Object({
  id: Type.String(),
  //type: NodeTypeSchema,
  data: Type.Union([EndpointSchema, WaitSchema, AssertionsSchema]),
});

export type Node = Static<typeof NodeSchema>;

export const TestPlanV1Schema = Type.Object({
  id: Type.Readonly(Type.String()),
  name: Type.String(),
  version: Type.Literal("1.0"),
  endpoint_host: Type.String(),
  frequency: Type.Optional(FrequencySchema),
  nodes: Type.Array(NodeSchema),
  edges: Type.Array(
    Type.Object({
      from: Type.String(),
      to: Type.String(),
    }),
  ),
});

export type TestPlanV1 = Static<typeof TestPlanV1Schema>;
