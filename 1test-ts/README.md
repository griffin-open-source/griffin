# 1test Test System

The 1test Test System provides a TypeScript DSL for defining API tests. Tests are written in TypeScript and output JSON test plans that can be executed by the plan executor.

## Features

- TypeScript DSL for defining API checks
- Chainable API for building test plans
- Support for endpoints, waits, assertions, and edges
- Environment variable injection via `env()` and `envString()` helpers
- Outputs JSON test plans for execution

## Installation

```bash
npm install 1test-test-system
```

## Installation

```bash
npm install
npm run build
```

## Usage

Create test files in `__1test__` directories. When executed, they output JSON test plans.

### Basic Example

```typescript
import { GET, ApiCheckBuilder, JSON, START, END, Frequency } from "../1test-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "health-check",
  endpoint_host: "http://localhost:3000"
});

const plan = builder
  .addEndpoint("health", {
    method: GET,
    response_format: JSON,
    path: "/health"
  })
  .addEdge(START, "health")
  .addEdge("health", END);

plan.create({
  frequency: Frequency.every(1).minute()
});
```

### Example with Environment Variables

```typescript
import { GET, ApiCheckBuilder, JSON, START, END, Frequency, env } from "../1test-ts/src/index";

// Use environment variables with fallback
const endpointHost = (() => {
  try {
    return env('endpoint_host');
  } catch {
    return "http://localhost:3000"; // fallback when --env is not used
  }
})();

const builder = new ApiCheckBuilder({
  name: "health-check",
  endpoint_host: endpointHost
});

const plan = builder
  .addEndpoint("health", {
    method: GET,
    response_format: JSON,
    path: "/health"
  })
  .addEdge(START, "health")
  .addEdge("health", END);

plan.create({
  frequency: Frequency.every(1).minute()
});
```

### Environment Variable Helpers

The test system provides two helper functions for accessing environment variables:

- **`env(key: string)`**: Returns any value from the environment configuration. Supports dot notation for nested access.
- **`envString(key: string)`**: Returns a string value from the environment configuration, throwing an error if the value is not a string.

**Dot Notation Support**: Access nested values using dot notation:
```typescript
const baseUrl = env('api.baseUrl');        // Accesses api.baseUrl
const timeout = env('api.timeout');        // Accesses api.timeout
const endpoint = envString('endpoint_host'); // Ensures string type
```

**Error Handling**: If an environment variable is not found, `env()` throws an error. Always wrap in try-catch when using fallbacks:
```typescript
try {
  const host = env('endpoint_host');
} catch {
  // Environment not available, use fallback
  const host = "http://localhost:3000";
}
```

### Advanced Example with Waits

```typescript
import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, Wait } from "../1test-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "foo-bar-check",
  endpoint_host: "https://foobar.com"
});

const plan = builder
  .addEndpoint("create_foo", {
    method: POST,
    response_format: JSON,
    path: "/api/v1/foo",
    body: { name: "test", value: 42 }
  })
  .addEndpoint("get_foo", {
    method: GET,
    response_format: JSON,
    path: "/api/v1/foo/1"
  })
  .addWait("wait_between", Wait.seconds(2))
  .addEdge(START, "create_foo")
  .addEdge("create_foo", "wait_between")
  .addEdge("wait_between", "get_foo")
  .addEdge("get_foo", END);

plan.create({
  frequency: Frequency.every(1).minute()
});
```

### Notes

- **Frequency**: Use `Frequency.every(n).minute()`, `.hour()`, or `.day()` (note the parentheses)
- **Waits**: Use `Wait.seconds(n)` or `Wait.minutes(n)`
- **Assertions**: Currently in development - assertion functions are stored but not yet evaluated during execution
- **Output**: The `plan.create()` call outputs JSON to stdout, which is captured by the CLI

## Output

The test system outputs a JSON test plan to stdout when `plan.create()` is called. This JSON is consumed by the plan executor. Example output:

```json
{
  "name": "health-check",
  "endpoint_host": "http://localhost",
  "frequency": {
    "every": 1,
    "unit": "minute"
  },
  "nodes": [
    {
      "id": "health",
      "type": "endpoint",
      "method": "GET",
      "path": "/health",
      "response_format": "JSON"
    }
  ],
  "edges": [
    { "from": "__START__", "to": "health" },
    { "from": "health", "to": "__END__" }
  ]
}
```
