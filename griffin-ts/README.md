# griffin Test System

The griffin Test System provides a TypeScript DSL for defining API tests. Tests are written in TypeScript and output JSON test plans that can be executed by the plan executor.

## Features

- TypeScript DSL for defining API checks
- Chainable API for building test plans
- Support for endpoints, waits, assertions, and edges
- Outputs JSON test plans for execution

## Installation

```bash
npm install griffin
```

## Installation

```bash
npm install
npm run build
```

## Usage

Create test files in `__griffin__` directories. When executed, they output JSON test plans.

griffin provides two builder APIs:

- **`createTestBuilder`**: Simple sequential tests (recommended for most use cases)
- **`createGraphBuilder`**: Complex graphs with parallel execution and branching

### Sequential Builder (Recommended for Simple Tests)

The sequential builder automatically connects steps in order - no need to manage edges manually.

```typescript
import { GET, createTestBuilder, JSON, Frequency, Assert } from "griffin-ts";

const plan = createTestBuilder({
  name: "health-check",
  endpoint_host: "https://api.example.com",
})
  .endpoint("health", {
    method: GET,
    response_format: JSON,
    path: "/health",
  })
  .assert((state) => [
    Assert(state["health"].status).equals(200),
    Assert(state["health"].body["status"]).equals("ok"),
  ])
  .build({ frequency: Frequency.every(1).minute() });

export default plan;
```

#### Sequential Example with Waits and Assertions

```typescript
import {
  GET,
  POST,
  createTestBuilder,
  JSON,
  Frequency,
  Wait,
  Assert,
} from "griffin-ts";

const plan = createTestBuilder({
  name: "create-and-verify-user",
  endpoint_host: "https://api.example.com",
})
  .endpoint("create_user", {
    method: POST,
    response_format: JSON,
    path: "/api/v1/users",
    body: { name: "Test User", email: "test@example.com" },
  })
  .assert((state) => [
    Assert(state["create_user"].status).equals(201),
    Assert(state["create_user"].body["id"]).not.isNull(),
  ])
  .wait(Wait.seconds(2))
  .endpoint("get_user", {
    method: GET,
    response_format: JSON,
    path: "/api/v1/users/test@example.com",
  })
  .assert((state) => [
    Assert(state["get_user"].status).equals(200),
    Assert(state["get_user"].body["name"]).equals("Test User"),
    Assert(state["get_user"].latency).lessThan(500),
  ])
  .build({ frequency: Frequency.every(5).minute() });

export default plan;
```

### Graph Builder (For Complex Workflows)

The graph builder gives you full control over the test graph, enabling parallel execution and complex branching.

```typescript
import {
  GET,
  POST,
  createGraphBuilder,
  JSON,
  START,
  END,
  Frequency,
  Wait,
  Assert,
} from "griffin-ts";

const plan = createGraphBuilder({
  name: "foo-bar-check",
  endpoint_host: "https://api.example.com",
})
  .addHttpRequest("create_foo", {
    method: POST,
    response_format: JSON,
    path: "/api/v1/foo",
    body: { name: "test", value: 42 },
  })
  .addWait("wait_between", Wait.seconds(2))
  .addHttpRequest("get_foo", {
    method: GET,
    response_format: JSON,
    path: "/api/v1/foo/1",
  })
  .addAssertion("check_response", (state) => [
    Assert(state["get_foo"].status).equals(200),
    Assert(state["get_foo"].body["value"]).equals(42),
    Assert(state["get_foo"].latency).lessThan(1000),
  ])
  .addEdge(START, "create_foo")
  .addEdge("create_foo", "wait_between")
  .addEdge("wait_between", "get_foo")
  .addEdge("get_foo", "check_response")
  .addEdge("check_response", END)
  .build({ frequency: Frequency.every(1).minute() });

export default plan;
```

### Using Secrets

griffin supports secure secret management for API keys, tokens, and other credentials. Secrets are referenced in your test plans and resolved at runtime by the configured secret providers.

#### With Sequential Builder

```typescript
import {
  GET,
  createTestBuilder,
  JSON,
  Frequency,
  secret,
  Assert,
} from "griffin-ts";

const plan = createTestBuilder({
  name: "authenticated-check",
  endpoint_host: "https://api.example.com",
})
  .endpoint("protected", {
    method: GET,
    response_format: JSON,
    path: "/api/protected",
    headers: {
      // Use environment variable
      "X-API-Key": secret("env:API_KEY"),
      // Use AWS Secrets Manager
      Authorization: secret("aws:prod/api-token"),
      // Extract field from JSON secret
      "X-Custom-Header": secret("aws:prod/config", { field: "customHeader" }),
    },
    body: {
      // Secrets can also be used in request bodies
      apiKey: secret("env:API_KEY"),
    },
  })
  .assert((state) => [Assert(state["protected"].status).equals(200)])
  .build({ frequency: Frequency.every(5).minute() });

export default plan;
```

#### With Graph Builder

```typescript
import {
  GET,
  createGraphBuilder,
  JSON,
  START,
  END,
  Frequency,
  secret,
  Assert,
} from "griffin-ts";

const plan = createGraphBuilder({
  name: "authenticated-check",
  endpoint_host: "https://api.example.com",
})
  .addHttpRequest("authenticated_request", {
    method: GET,
    response_format: JSON,
    path: "/api/protected",
    headers: {
      "X-API-Key": secret("env:API_KEY"),
      Authorization: secret("aws:prod/api-token"),
    },
  })
  .addAssertion("verify", (state) => [
    Assert(state["authenticated_request"].status).equals(200),
  ])
  .addEdge(START, "authenticated_request")
  .addEdge("authenticated_request", "verify")
  .addEdge("verify", END)
  .build({ frequency: Frequency.every(5).minute() });

export default plan;
```

#### Secret Providers

**Environment Variables** (always available):

```typescript
secret("env:VARIABLE_NAME");
```

**AWS Secrets Manager** (requires AWS configuration):

```typescript
secret("aws:secret-name");
secret("aws:secret-name", { field: "key" }); // Extract field from JSON secret
secret("aws:secret-name", { version: "AWSPREVIOUS" }); // Pin to specific version
```

**HashiCorp Vault** (requires Vault configuration):

```typescript
secret("vault:secret/data/path");
secret("vault:secret/data/path", { field: "key" });
secret("vault:secret/data/path", { version: "2" });
```

See the [griffin-runner CONFIG.md](../griffin-runner/CONFIG.md) for configuration details.

### API Reference

#### Sequential Builder Methods

- **`.endpoint(id, config)`**: Add an HTTP endpoint request with a unique identifier
- **`.wait(duration)`**: Add a delay (use `Wait.seconds(n)`, `Wait.minutes(n)`, or `Wait.milliseconds(n)`)
- **`.assert(fn)`**: Add assertions using a function that receives the state proxy and returns an array of assertions
- **`.build(options)`**: Generate the final test plan with frequency configuration

#### Graph Builder Methods

- **`.addHttpRequest(id, config)`**: Add an endpoint node to the graph
- **`.addWait(id, duration)`**: Add a wait node to the graph
- **`.addAssertion(id, fn)`**: Add an assertion node using a function that receives the state proxy
- **`.addEdge(from, to)`**: Connect two nodes (use `START` and `END` constants for entry/exit)
- **`.build(options)`**: Generate the final test plan (validates all nodes are connected)

#### Assertions

Use the `Assert()` function with the state proxy to create type-safe assertions:

```typescript
.assert((state) => [
  // Status checks
  Assert(state["node"].status).equals(200),

  // Latency checks
  Assert(state["node"].latency).lessThan(500),

  // Body assertions (JSONPath automatically detected)
  Assert(state["node"].body["id"]).not.isNull(),
  Assert(state["node"].body["name"]).equals("test"),

  // Header assertions
  Assert(state["node"].headers["content-type"]).contains("json"),
])
```

See [ASSERTIONS_QUICK_REF.md](./ASSERTIONS_QUICK_REF.md) for the complete assertion API.

#### General

- **Frequency**: Use `Frequency.every(n).minute()`, `.hour()`, or `.day()` in the `build()` options
- **Secrets**: Use `secret("provider:path")` to reference secrets that are resolved at runtime
- **Response Types**: JSON (default), XML, and TEXT response formats are supported

## Output

The test system outputs a JSON test plan to stdout when `plan.create()` is called. This JSON is consumed by the plan executor. Example output:

```json
{
  "name": "health-check",
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
