// TODO: import from executor
import { Type, type Static } from "typebox";

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

export const Endpoint = Type.Object({
  method: HttpMethodSchema,
  path: Type.String(),
  response_format: ResponseFormatSchema,
});

export const Frequency = Type.Object({
  every: Type.Number(),
  unit: Type.Union([
    Type.Literal(FrequencyUnit.MINUTE),
    Type.Literal(FrequencyUnit.HOUR),
    Type.Literal(FrequencyUnit.DAY),
  ]),
});

export const Wait = Type.Object({
  duration_ms: Type.Number(),
});

export const JSONPathSchema = Type.Array(Type.String());
export const XMLPathSchema = Type.Array(Type.String());
export const TextPathSchema = Type.String(); // Is there a regex to validate regex ????

export const JSONAssertion = Type.Object({
  path: JSONPathSchema,
  expected: Type.Any(),
});

export const XMLAssertion = Type.Object({
  path: XMLPathSchema,
  expected: Type.Any(),
});

export const TextAssertion = Type.Object({
  path: TextPathSchema,
  expected: Type.Any(),
});

export const Assertions = Type.Array(
  Type.Union([JSONAssertion, XMLAssertion, TextAssertion]),
);

export enum NodeType {
  ENDPOINT,
  WAIT,
  ASSERTION,
}

export const NodeTypeSchema = Type.Union([
  Type.Literal(NodeType.ENDPOINT),
  Type.Literal(NodeType.WAIT),
  Type.Literal(NodeType.ASSERTION),
]);

export const NodeSchema = Type.Object({
  id: Type.String(),
  type: NodeTypeSchema,
  data: Type.Union([Endpoint, Wait, Assertions]),
});

export const TestPlanV1Schema = Type.Object({
  id: Type.Readonly(Type.String()),
  name: Type.String(),
  version: Type.Literal("1.0"),
  endpoint_host: Type.String(),
  frequency: Type.Optional(Frequency),
  nodes: Type.Array(NodeSchema),
  edges: Type.Array(
    Type.Object({
      from: Type.String(),
      to: Type.String(),
    }),
  ),
});

export type TestPlanV1 = Static<typeof TestPlanV1Schema>;
