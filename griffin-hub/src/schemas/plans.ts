import { Type, type Static } from "typebox";
//import { StringEnum, Ref } from "./shared.js";
import {
  AssertionsSchema,
  FrequencySchema,
  WaitSchema,
  EdgeSchema,
  NodeType,
  HttpMethodSchema,
  ResponseFormatSchema,
  TEST_PLAN_VERSION,
  JSONAssertionSchema,
  XMLAssertionSchema,
  TextAssertionSchema,
  AssertionSchema,
  SecretRefSchema,
  StringLiteralSchema,
} from "@griffin-app/griffin-ts/schema";
//export {
//  EdgeSchema,
//  WaitSchema,
//  AssertionsSchema,
//  AssertionSchema,
//  JSONAssertionSchema,
//  XMLAssertionSchema,
//  TextAssertionSchema,
//  JSONAccessorSchema,
//  FrequencyUnitSchema,
//  HttpMethodSchema,
//  ResponseFormatSchema,
//  SecretRefSchema,
//  StringLiteralSchema,
//} from "@griffin-app/griffin-ts/schema";

// Union type for values that can be either a literal or a secret reference
export const SecretOrStringSchema = Type.Union(
  [SecretRefSchema, StringLiteralSchema],
  { $id: "SecretOrString" },
);

export const EndpointSchema = Type.Object(
  {
    id: Type.String(),
    type: Type.Literal(NodeType.ENDPOINT),
    method: HttpMethodSchema,
    path: Type.String(),
    base: Type.String(),
    headers: Type.Optional(
      Type.Record(Type.String(), SecretOrStringSchema),
    ),
    body: Type.Optional(Type.Any()), // Body can contain nested SecretRefs
    response_format: ResponseFormatSchema,
  },
  { $id: "Endpoint" },
);

export const NodeSchema = Type.Union(
  [EndpointSchema, WaitSchema, AssertionsSchema],
  { $id: "Node" },
);

export const PlanV1Schema = Type.Object(
  {
    project: Type.String(),
    locations: Type.Optional(Type.Array(Type.String())),
    id: Type.Readonly(Type.String()),
    name: Type.String(),
    version: Type.Literal(TEST_PLAN_VERSION),
    frequency: FrequencySchema,
    environment: Type.String({ default: "default" }),
    nodes: Type.Array(NodeSchema),
    edges: Type.Array(EdgeSchema),
  },
  {
    $id: "PlanV1",
  },
);

export type JSONAssertion = Static<typeof JSONAssertionSchema>;
export type XMLAssertion = Static<typeof XMLAssertionSchema>;
export type TextAssertion = Static<typeof TextAssertionSchema>;
export type Assertion = Static<typeof AssertionSchema>;
export type Assertions = Static<typeof AssertionsSchema>;
export type Node = Static<typeof NodeSchema>;
export type PlanV1 = Static<typeof PlanV1Schema>;

export type Frequency = Static<typeof FrequencySchema>;
export type Wait = Static<typeof WaitSchema>;
export type Endpoint = Static<typeof EndpointSchema>;
