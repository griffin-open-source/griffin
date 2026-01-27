export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type ResponseFormat = "JSON" | "XML" | "TEXT";

export interface HttpRequest {
  id: string;
  type: "HTTP_REQUEST";
  method: HttpMethod;
  path: string;
  response_format: ResponseFormat;
  headers?: Record<string, string>;
  body?: any;
}

export interface WaitNode {
  id: string;
  type: "WAIT";
  duration_ms: number;
}

export interface AssertionNode {
  id: string;
  type: "ASSERTION";
  assertions: Assertion[];
}

export interface Assertion {
  type: string;
  expected?: any;
  actual?: any;
  message?: string;
}

export interface Edge {
  from: string;
  to: string;
}

export interface Frequency {
  every: number;
  unit: "minute" | "hour" | "day";
}

export interface TestPlan {
  name: string;
  endpoint_host: string;
  frequency?: Frequency;
  nodes: (HttpRequest | WaitNode | AssertionNode)[];
  edges: Edge[];
}
