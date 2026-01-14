import type { SecretRef, SecretOrValue } from './secrets';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type ResponseFormat = 'JSON' | 'XML' | 'TEXT';

export interface Endpoint {
  id: string;
  type: 'endpoint';
  method: HttpMethod;
  path: string;
  response_format: ResponseFormat;
  headers?: Record<string, SecretOrValue<string>>;
  body?: any; // Body can contain nested SecretRefs
}

export type { SecretRef, SecretOrValue };

export interface WaitNode {
  id: string;
  type: 'wait';
  duration_ms: number;
}

export interface AssertionNode {
  id: string;
  type: 'assertion';
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
  unit: 'minute' | 'hour' | 'day';
}

export interface TestPlan {
  name: string;
  endpoint_host: string;
  frequency?: Frequency;
  nodes: (Endpoint | WaitNode | AssertionNode)[];
  edges: Edge[];
}
