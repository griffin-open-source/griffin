import { Type, type Static } from "typebox";
import { StringEnum } from "./shared.js";

export const TEST_PLAN_VERSION = "1.0";

// Secret reference schema for values that may contain secrets
export const SecretRefDataSchema = Type.Object({
  provider: Type.String(),
  ref: Type.String(),
  version: Type.Optional(Type.String()),
  field: Type.Optional(Type.String()),
});

export const SecretRefSchema = Type.Object({
  $secret: SecretRefDataSchema,
}, { $id: "SecretRef" });

export const VariableRefSchema = Type.Object({
  $variable: Type.Object({
    key: Type.String(),
    template: Type.Optional(Type.String()),
  }),
}, { $id: "VariableRef" });

export const StringLiteralSchema = Type.Object({
  $literal: Type.String(),
}, { $id: "StringLiteral" });
// Union type for values that can be either a literal or a secret reference
export const StringSchema = Type.Union([
  StringLiteralSchema,
  SecretRefSchema,
  VariableRefSchema,
]);

export enum FrequencyUnit {
  MINUTE = "MINUTE",
  HOUR = "HOUR",
  DAY = "DAY",
}

export enum ResponseFormat {
  JSON = "JSON",
  XML = "XML",
  TEXT = "TEXT",
}

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
  CONNECT = "CONNECT",
  TRACE = "TRACE",
}
export enum NodeType {
  ENDPOINT = "ENDPOINT",
  WAIT = "WAIT",
  ASSERTION = "ASSERTION",
}
export enum UnaryPredicate {
  IS_NULL = "IS_NULL",
  IS_NOT_NULL = "IS_NOT_NULL",
  IS_TRUE = "IS_TRUE",
  IS_FALSE = "IS_FALSE",
  IS_EMPTY = "IS_EMPTY",
  IS_NOT_EMPTY = "IS_NOT_EMPTY",
}
export enum BinaryPredicateOperator {
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  GREATER_THAN = "GREATER_THAN",
  LESS_THAN = "LESS_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  ENDS_WITH = "ENDS_WITH",
  NOT_STARTS_WITH = "NOT_STARTS_WITH",
  NOT_ENDS_WITH = "NOT_ENDS_WITH",
}
export enum JSONAccessor {
  BODY = "body",
  HEADERS = "headers",
  STATUS = "status",
}

export const ResponseFormatSchema = StringEnum(
  [ResponseFormat.JSON, ResponseFormat.XML, ResponseFormat.TEXT],
  { $id: "ResponseFormat" },
);

export const HttpMethodSchema = StringEnum(
  [
    HttpMethod.GET,
    HttpMethod.POST,
    HttpMethod.PUT,
    HttpMethod.DELETE,
    HttpMethod.PATCH,
    HttpMethod.HEAD,
    HttpMethod.OPTIONS,
    HttpMethod.CONNECT,
    HttpMethod.TRACE,
  ],
  { $id: "HttpMethod" },
);

export const EndpointDSLSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.ENDPOINT),
    method: HttpMethodSchema,
    path: StringSchema,
    base: StringSchema,
    headers: Type.Optional(Type.Record(Type.String(), StringSchema)),
    body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
    response_format: ResponseFormatSchema,
  },
  { $id: "Endpoint" },
);


export const FrequencyUnitSchema = StringEnum(
  [FrequencyUnit.MINUTE, FrequencyUnit.HOUR, FrequencyUnit.DAY],
  { $id: "FrequencyUnit" },
);
export const FrequencySchema = Type.Object(
  {
    every: Type.Number(),
    unit: FrequencyUnitSchema,
  },
  { $id: "Frequency" },
);


export const WaitSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.WAIT),
    duration_ms: Type.Number(),
  },
  { $id: "Wait" },
);
export type Wait = Static<typeof WaitSchema>;

export const JSONPathSchema = Type.Array(Type.String());
export const XMLPathSchema = Type.Array(Type.String());
export const TextPathSchema = Type.String(); // Is there a regex to validate regex ????

export const UnaryPredicateSchema = StringEnum(
  [
    UnaryPredicate.IS_NULL,
    UnaryPredicate.IS_NOT_NULL,
    UnaryPredicate.IS_TRUE,
    UnaryPredicate.IS_FALSE,
    UnaryPredicate.IS_EMPTY,
    UnaryPredicate.IS_NOT_EMPTY,
  ],
  { $id: "UnaryPredicate" },
);

export const BinaryPredicateOperatorSchema = Type.Union(
  [
    Type.Literal(BinaryPredicateOperator.EQUAL),
    Type.Literal(BinaryPredicateOperator.NOT_EQUAL),
    Type.Literal(BinaryPredicateOperator.GREATER_THAN),
    Type.Literal(BinaryPredicateOperator.LESS_THAN),
    Type.Literal(BinaryPredicateOperator.GREATER_THAN_OR_EQUAL),
    Type.Literal(BinaryPredicateOperator.LESS_THAN_OR_EQUAL),
    Type.Literal(BinaryPredicateOperator.CONTAINS),
    Type.Literal(BinaryPredicateOperator.NOT_CONTAINS),
    Type.Literal(BinaryPredicateOperator.STARTS_WITH),
    Type.Literal(BinaryPredicateOperator.ENDS_WITH),
    Type.Literal(BinaryPredicateOperator.NOT_STARTS_WITH),
    Type.Literal(BinaryPredicateOperator.NOT_ENDS_WITH),
  ],
  { $id: "BinaryPredicateOperator" },
);

export const BinaryPredicateSchema = Type.Object(
  {
    expected: Type.Any(),
    operator: BinaryPredicateOperatorSchema,
  },
  { $id: "BinaryPredicate" },
);

export const JSONAccessorSchema = StringEnum(
  [JSONAccessor.BODY, JSONAccessor.HEADERS, JSONAccessor.STATUS],
  { $id: "JSONAccessor" },
);

export const JSONAssertionSchema = Type.Object(
  {
    nodeId: Type.String(),
    accessor: JSONAccessorSchema,
    path: JSONPathSchema,
    predicate: Type.Union([
      UnaryPredicateSchema,
      BinaryPredicateSchema,
    ]),
    assertionType: Type.Literal(ResponseFormat.JSON),
  },
  { $id: "JSONAssertion" },
);

export const XMLAssertionSchema = Type.Object(
  {
    nodeId: Type.String(),
    path: XMLPathSchema,
    expected: Type.Any(),
    assertionType: Type.Literal(ResponseFormat.XML),
  },
  { $id: "XMLAssertion" },
);

export const TextAssertionSchema = Type.Object(
  {
    nodeId: Type.String(),
    path: TextPathSchema,
    expected: Type.Any(),
    assertionType: Type.Literal(ResponseFormat.TEXT),
  },
  { $id: "TextAssertion" },
);

export const AssertionSchema = Type.Union(
  [JSONAssertionSchema, XMLAssertionSchema, TextAssertionSchema],
  { $id: "Assertion" },
);

export const AssertionsSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.ASSERTION),
    assertions: Type.Array(AssertionSchema),
  },
  { $id: "Assertions" },
);

export const NodeDSLSchema = Type.Union(
  [EndpointDSLSchema, WaitSchema, AssertionsSchema],
  { $id: "NodeDSL" },
);

export const EdgeSchema = Type.Object(
  {
    from: Type.String(),
    to: Type.String(),
  },
  { $id: "Edge" },
);

export const PlanDSLSchema = Type.Object(
  {
    locations: Type.Optional(Type.Array(Type.String())),
    name: Type.String(),
    version: Type.Literal(TEST_PLAN_VERSION),
    frequency: FrequencySchema,
    nodes: Type.Array(NodeDSLSchema),
    edges: Type.Array(EdgeSchema),
  },
  {
    $id: "TestPlanV1",
  },
);

export type PlanDSL = Static<typeof PlanDSLSchema>;
export type VariableRef = Static<typeof VariableRefSchema>;
export type NodeDSL = Static<typeof NodeDSLSchema>;
export type Edge = Static<typeof EdgeSchema>;
export type EndpointDSL = Static<typeof EndpointDSLSchema>;

export type Assertions = Static<typeof AssertionsSchema>;
export type Assertion = Static<typeof AssertionSchema>;

export type TextAssertion = Static<typeof TextAssertionSchema>;
export type JSONAssertion = Static<typeof JSONAssertionSchema>;
export type XMLAssertion = Static<typeof XMLAssertionSchema>;

export type BinaryPredicate = Static<typeof BinaryPredicateSchema>;

export type SecretRef = Static<typeof SecretRefSchema>;
export type SecretRefData = Static<typeof SecretRefDataSchema>;
export type StringLiteral = Static<typeof StringLiteralSchema>;
export type String = Static<typeof StringSchema>;
export type Frequency = Static<typeof FrequencySchema>;