export { executePlanV1 } from "./executor.js";
export type {
  ExecutionOptions,
  ExecutionResult,
  NodeResult,
  HttpClientAdapter,
  HttpRequest,
  HttpResponse,
} from "./types.js";
export type {
  TestPlan,
  Endpoint,
  WaitNode,
  AssertionNode,
  Edge,
} from "./test-plan-types.js";
export {
  AxiosAdapter,
  StubAdapter,
  type StubResponse,
} from "./adapters/index.js";

// Export schema types and enums
export {
  FrequencyUnit,
  ResponseFormat,
  HttpMethod,
  NodeType,
  UnaryPredicate,
  BinaryPredicateOperator,
  TestPlanV1Schema,
  SecretRefSchema,
  SecretRefDataSchema,
  SecretOrStringSchema,
  type TestPlanV1,
  type Node,
  type Assertions,
  type Wait,
} from "./schemas.js";

// Export event system
export {
  LocalEventEmitter,
  DurableEventEmitter,
  type ExecutionEventEmitter,
  type DurableEventBusAdapter,
} from "./events/emitter.js";
export type {
  ExecutionEvent,
  BaseEvent,
  PlanStartEvent,
  PlanEndEvent,
  NodeStartEvent,
  NodeEndEvent,
  HttpRequestEvent,
  HttpResponseEvent,
  HttpRetryEvent,
  AssertionResultEvent,
  WaitStartEvent,
  NodeStreamEvent,
  ErrorEvent,
} from "./events/types.js";

// Export secrets system
export {
  // Core types and utilities
  type SecretProvider,
  type SecretRef,
  type SecretRefData,
  type SecretResolveOptions,
  SecretResolutionError,
  isSecretRef,
  // Registry
  SecretProviderRegistry,
  // Resolution utilities
  resolveSecretsInPlan,
  collectSecretsFromPlan,
  planHasSecrets,
  // Providers
  EnvSecretProvider,
  type EnvSecretProviderOptions,
  AwsSecretsManagerProvider,
  type AwsSecretsManagerProviderOptions,
  type AwsSecretsManagerClient,
  VaultProvider,
  type VaultProviderOptions,
  type VaultHttpClient,
} from "./secrets/index.js";
