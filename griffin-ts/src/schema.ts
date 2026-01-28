import { Type, type Static } from "typebox";
import { Ref, StringEnum } from "./shared.js";

// Version constants
export const CURRENT_PLAN_VERSION = "1.0";
export const SUPPORTED_PLAN_VERSIONS = ["1.0"] as const;

// Secret reference schema for values that may contain secrets
export const SecretRefDataSchema = Type.Object({
  provider: Type.String(),
  ref: Type.String(),
  version: Type.Optional(Type.String()),
  field: Type.Optional(Type.String()),
});

export const SecretRefSchema = Type.Object(
  {
    $secret: SecretRefDataSchema,
  },
  { $id: "SecretRef" },
);

export const VariableRefSchema = Type.Object(
  {
    $variable: Type.Object({
      key: Type.String(),
      template: Type.Optional(Type.String()),
    }),
  },
  { $id: "VariableRef" },
);

export const StringLiteralSchema = Type.Object(
  {
    $literal: Type.String(),
  },
  { $id: "StringLiteral" },
);
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
  //TEXT = "TEXT",
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
  HTTP_REQUEST = "HTTP_REQUEST",
  WAIT = "WAIT",
  ASSERTION = "ASSERTION",
}
export enum UnaryPredicateOperator {
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
  [ResponseFormat.JSON, ResponseFormat.XML],
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

export const HttpRequestDSLSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.HTTP_REQUEST),
    method: HttpMethodSchema,
    path: StringSchema,
    base: StringSchema,
    headers: Type.Optional(Type.Record(Type.String(), StringSchema)),
    body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
    response_format: ResponseFormatSchema,
  },
  { $id: "HttpRequest" },
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

export const UnaryPredicateOperatorSchema = StringEnum(
  [
    UnaryPredicateOperator.IS_NULL,
    UnaryPredicateOperator.IS_NOT_NULL,
    UnaryPredicateOperator.IS_TRUE,
    UnaryPredicateOperator.IS_FALSE,
    UnaryPredicateOperator.IS_EMPTY,
    UnaryPredicateOperator.IS_NOT_EMPTY,
  ],
  { $id: "UnaryPredicateOperator" },
);

export const UnaryPredicateSchema = Type.Object(
  {
    operator: Ref(UnaryPredicateOperatorSchema),
    type: Type.Literal("unary"),
  },
  { $id: "UnaryPredicate" },
);

export const BinaryPredicateOperatorSchema = StringEnum(
  [
    BinaryPredicateOperator.EQUAL,
    BinaryPredicateOperator.NOT_EQUAL,
    BinaryPredicateOperator.GREATER_THAN,
    BinaryPredicateOperator.LESS_THAN,
    BinaryPredicateOperator.GREATER_THAN_OR_EQUAL,
    BinaryPredicateOperator.LESS_THAN_OR_EQUAL,
    BinaryPredicateOperator.CONTAINS,
    BinaryPredicateOperator.NOT_CONTAINS,
    BinaryPredicateOperator.STARTS_WITH,
    BinaryPredicateOperator.ENDS_WITH,
    BinaryPredicateOperator.NOT_STARTS_WITH,
    BinaryPredicateOperator.NOT_ENDS_WITH,
  ],
  { $id: "BinaryPredicateOperator" },
);

export const BinaryPredicateSchema = Type.Object(
  {
    expected: Type.Any(),
    operator: Ref(BinaryPredicateOperatorSchema),
    type: Type.Literal("binary"),
  },
  { $id: "BinaryPredicate" },
);

export enum AssertionSubject {
  BODY = "body",
  HEADERS = "headers",
  STATUS = "status",
  LATENCY = "latency",
}
export const AssertionSubjectSchema = StringEnum([
  AssertionSubject.BODY,
  AssertionSubject.HEADERS,
  AssertionSubject.STATUS,
  AssertionSubject.LATENCY,
]);

// Base fields shared by all assertions
const AssertionBaseFields = {
  nodeId: Type.String(),
  //predicate: Type.Union([UnaryPredicateSchema, BinaryPredicateSchema]),
};

// Non-body assertions: no path or responseType
const StatusAssertionSchema = Type.Object({
  ...AssertionBaseFields,
  subject: Type.Literal(AssertionSubject.STATUS),
  predicate: Ref(BinaryPredicateSchema),
});

const HeadersAssertionSchema = Type.Object({
  ...AssertionBaseFields,
  subject: Type.Literal(AssertionSubject.HEADERS),
  headerName: Type.String(),
  predicate: Type.Union([
    Ref(UnaryPredicateSchema),
    Ref(BinaryPredicateSchema),
  ]),
});

const LatencyAssertionSchema = Type.Object({
  ...AssertionBaseFields,
  subject: Type.Literal(AssertionSubject.LATENCY),
  predicate: Ref(BinaryPredicateSchema),
});

// Body assertions: path + responseType must be present and match
const BodyJsonAssertionSchema = Type.Object({
  ...AssertionBaseFields,
  subject: Type.Literal(AssertionSubject.BODY),
  responseType: Type.Literal(ResponseFormat.JSON),
  path: JSONPathSchema,
  predicate: Type.Union([
    Ref(UnaryPredicateSchema),
    Ref(BinaryPredicateSchema),
  ]),
});

const BodyXmlAssertionSchema = Type.Object({
  ...AssertionBaseFields,
  subject: Type.Literal(AssertionSubject.BODY),
  responseType: Type.Literal(ResponseFormat.XML),
  path: XMLPathSchema,
  predicate: Type.Union([
    Ref(UnaryPredicateSchema),
    Ref(BinaryPredicateSchema),
  ]),
});

//const BodyTextAssertionSchema = Type.Object({
//  ...AssertionBaseFields,
//  subject: Type.Literal(AssertionSubject.BODY),
//  responseType: Type.Literal(ResponseFormat.TEXT),
//  path: TextPathSchema,
//});

// Discriminated union of all assertion types
export const AssertionSchema = Type.Union(
  [
    StatusAssertionSchema,
    HeadersAssertionSchema,
    LatencyAssertionSchema,
    BodyJsonAssertionSchema,
    BodyXmlAssertionSchema,
    //BodyTextAssertionSchema,
  ],
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
  [HttpRequestDSLSchema, WaitSchema, AssertionsSchema],
  { $id: "NodeDSL" },
);

export const EdgeSchema = Type.Object(
  {
    from: Type.String(),
    to: Type.String(),
  },
  { $id: "Edge" },
);

// Version-specific DSL schemas
export const PlanDSLSchemaV1 = Type.Object(
  {
    locations: Type.Optional(Type.Array(Type.String())),
    name: Type.String(),
    version: Type.Literal("1.0"),
    frequency: FrequencySchema,
    nodes: Type.Array(NodeDSLSchema),
    edges: Type.Array(EdgeSchema),
  },
  {
    $id: "PlanDSLV1",
  },
);

// Union schema for validation (accepts any supported version)
export const PlanDSLSchema = PlanDSLSchemaV1; // Currently only v1.0, will become union when v2.0 is added

// Type extraction
export type PlanDSLV1 = Static<typeof PlanDSLSchemaV1>;
export type PlanDSL = PlanDSLV1; // Currently only v1.0, will become union when v2.0 is added
export type VariableRef = Static<typeof VariableRefSchema>;
export type NodeDSL = Static<typeof NodeDSLSchema>;
export type Edge = Static<typeof EdgeSchema>;
export type HttpRequestDSL = Static<typeof HttpRequestDSLSchema>;

export type Assertions = Static<typeof AssertionsSchema>;
export type Assertion = Static<typeof AssertionSchema>;

export type BinaryPredicate = Static<typeof BinaryPredicateSchema>;
export type UnaryPredicate = Static<typeof UnaryPredicateSchema>;

export type SecretRef = Static<typeof SecretRefSchema>;
export type SecretRefData = Static<typeof SecretRefDataSchema>;
export type StringLiteral = Static<typeof StringLiteralSchema>;
export type String = Static<typeof StringSchema>;
export type Frequency = Static<typeof FrequencySchema>;

// ============================================================================
// Resolved Plan Schemas (after variable resolution, used by hub/executor)
// ============================================================================

// Union type for resolved values (variables are resolved, only secrets/literals remain)
export const ResolvedStringSchema = Type.Union([
  StringLiteralSchema,
  SecretRefSchema,
]);

export const HttpRequestResolvedSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.HTTP_REQUEST),
    method: HttpMethodSchema,
    path: Type.String(),
    base: Type.String(),
    headers: Type.Optional(Type.Record(Type.String(), ResolvedStringSchema)),
    body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
    response_format: ResponseFormatSchema,
  },
  { $id: "HttpRequestResolved" },
);

export const NodeResolvedSchema = Type.Union(
  [HttpRequestResolvedSchema, WaitSchema, AssertionsSchema],
  { $id: "NodeResolved" },
);

// Version-specific resolved plan schemas
export const ResolvedPlanV1Schema = Type.Object(
  {
    project: Type.String(),
    locations: Type.Optional(Type.Array(Type.String())),
    id: Type.Readonly(Type.String()),
    name: Type.String(),
    version: Type.Literal("1.0"),
    frequency: FrequencySchema,
    environment: Type.String({ default: "default" }),
    nodes: Type.Array(NodeResolvedSchema),
    edges: Type.Array(EdgeSchema),
  },
  {
    $id: "ResolvedPlanV1",
  },
);

// Union of all supported resolved plan versions
export const ResolvedPlanSchema = ResolvedPlanV1Schema;

// Type exports for resolved plans
export type ResolvedPlanV1 = Static<typeof ResolvedPlanV1Schema>;
export type ResolvedPlan = ResolvedPlanV1;
export type HttpRequestResolved = Static<typeof HttpRequestResolvedSchema>;
export type NodeResolved = Static<typeof NodeResolvedSchema>;
