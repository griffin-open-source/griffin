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
});

// Union type for values that can be either a literal or a secret reference
export const SecretOrStringSchema = Type.Union([
  Type.String(),
  SecretRefSchema,
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

export const VariableRefSchema = Type.Object({
  $variable: Type.Object({
    key: Type.String(),
    template: Type.Optional(Type.String()),
  }),
});
export type VariableRef = Static<typeof VariableRefSchema>;

export const EndpointSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.ENDPOINT),
    method: HttpMethodSchema,
    path: Type.Union([Type.String(), VariableRefSchema]),
    base: Type.Union([Type.String(), VariableRefSchema]),
    headers: Type.Optional(Type.Record(Type.String(), SecretOrStringSchema)),
    body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
    response_format: ResponseFormatSchema,
  },
  { $id: "Endpoint" },
);

export type Endpoint = Static<typeof EndpointSchema>;

export const FrequencySchema = Type.Object(
  {
    every: Type.Number(),
    unit: Type.Union([
      Type.Literal(FrequencyUnit.MINUTE),
      Type.Literal(FrequencyUnit.HOUR),
      Type.Literal(FrequencyUnit.DAY),
    ]),
  },
  { $id: "Frequency" },
);

export type Frequency = Static<typeof FrequencySchema>;

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

export enum UnaryPredicate {
  IS_NULL = "IS_NULL",
  IS_NOT_NULL = "IS_NOT_NULL",
  IS_TRUE = "IS_TRUE",
  IS_FALSE = "IS_FALSE",
  IS_EMPTY = "IS_EMPTY",
  IS_NOT_EMPTY = "IS_NOT_EMPTY",
}
export const UnaryPredicateSchema = Type.Union(
  [
    Type.Literal(UnaryPredicate.IS_NULL),
    Type.Literal(UnaryPredicate.IS_NOT_NULL),
    Type.Literal(UnaryPredicate.IS_TRUE),
    Type.Literal(UnaryPredicate.IS_FALSE),
    Type.Literal(UnaryPredicate.IS_EMPTY),
    Type.Literal(UnaryPredicate.IS_NOT_EMPTY),
  ],
  { $id: "UnaryPredicate" },
);

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

export type BinaryPredicate = Static<typeof BinaryPredicateSchema>;
export const JSONAssertionSchema = Type.Object(
  {
    nodeId: Type.String(),
    accessor: Type.Union([
      Type.Literal("body"),
      Type.Literal("headers"),
      Type.Literal("status"),
    ]),
    path: JSONPathSchema,
    predicate: Type.Union([UnaryPredicateSchema, BinaryPredicateSchema]),
  },
  { $id: "JSONAssertion" },
);
export type JSONAssertion = Static<typeof JSONAssertionSchema>;

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
export const AssertionSchema = Type.Union(
  [
    Type.Intersect([
      Type.Object({
        assertionType: Type.Literal(ResponseFormat.JSON),
      }),
      JSONAssertionSchema,
    ]),
    Type.Intersect([
      Type.Object({
        assertionType: Type.Literal(ResponseFormat.XML),
      }),
      XMLAssertionSchema,
    ]),
    Type.Intersect([
      Type.Object({
        assertionType: Type.Literal(ResponseFormat.TEXT),
      }),
      TextAssertionSchema,
    ]),
  ],
  { $id: "Assertion" },
);
export type Assertion = Static<typeof AssertionSchema>;

export const AssertionsSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.ASSERTION),
    assertions: Type.Array(AssertionSchema),
  },
  { $id: "Assertions" },
);
export type Assertions = Static<typeof AssertionsSchema>;

export const NodeSchema = Type.Union(
  [EndpointSchema, WaitSchema, AssertionsSchema],
  { $id: "Node" },
);

export const EdgeSchema = Type.Object(
  {
    from: Type.String(),
    to: Type.String(),
  },
  { $id: "Edge" },
);
export type Node = Static<typeof NodeSchema>;
export type Edge = Static<typeof EdgeSchema>;

export const TestPlanV1Schema = Type.Object(
  {
    project: Type.String(),
    locations: Type.Optional(Type.Array(Type.String())),
    id: Type.Readonly(Type.String()),
    name: Type.String(),
    version: Type.Literal("1.0"),
    frequency: FrequencySchema,
    environment: Type.String({ default: "default" }),
    nodes: Type.Array(NodeSchema),
    edges: Type.Array(EdgeSchema),
  },
  {
    $id: "TestPlanV1",
  },
);
export type TestPlanV1 = Static<typeof TestPlanV1Schema>;
