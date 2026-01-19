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
import { GET, createTestBuilder, JSON, Frequency } from "griffin-ts";

const plan = createTestBuilder({
  name: "health-check",
  frequency: Frequency.every(1).minute(),
})
  .request({
    method: GET,
    response_format: JSON,
    path: "/health",
  })
  .assert([
    { type: "status", expected: 200 },
    { type: "body", expected: { status: "ok" } },
  ])
  .build();

export default plan;
```

#### Sequential Example with Waits

```typescript
import {
  GET,
  POST,
  createTestBuilder,
  JSON,
  Frequency,
  Wait,
} from "griffin-ts";

const plan = createTestBuilder({
  name: "create-and-verify-user",
  frequency: Frequency.every(5).minute(),
})
  .request({
    method: POST,
    response_format: JSON,
    path: "/api/v1/users",
    body: { name: "Test User", email: "test@example.com" },
  })
  .assert([{ type: "status", expected: 201 }])
  .wait(Wait.seconds(2))
  .request({
    method: GET,
    response_format: JSON,
    path: "/api/v1/users/test@example.com",
  })
  .assert([
    { type: "status", expected: 200 },
    { type: "body.name", expected: "Test User" },
  ])
  .build();

export default plan;
```

### Graph Builder (For Complex Workflows)

The graph builder gives you full control over the test graph, enabling parallel execution and complex branching.

```typescript
import {
  GET,
  POST,
  createGraphBuilder,
  Endpoint,
  Assertion,
  WaitNode,
  JSON,
  START,
  END,
  Frequency,
  Wait,
} from "griffin-ts";

const plan = createGraphBuilder({
  name: "foo-bar-check",
  frequency: Frequency.every(1).minute(),
})
  .addNode(
    "create_foo",
    Endpoint({
      method: POST,
      response_format: JSON,
      path: "/api/v1/foo",
      body: { name: "test", value: 42 },
    }),
  )
  .addNode(
    "get_foo",
    Endpoint({
      method: GET,
      response_format: JSON,
      path: "/api/v1/foo/1",
    }),
  )
  .addNode("wait_between", WaitNode(Wait.seconds(2)))
  .addNode("check_status", Assertion([{ type: "status", expected: 200 }]))
  .addEdge(START, "create_foo")
  .addEdge("create_foo", "wait_between")
  .addEdge("wait_between", "get_foo")
  .addEdge("get_foo", "check_status")
  .addEdge("check_status", END)
  .build();

export default plan;
```

### Using Secrets

griffin supports secure secret management for API keys, tokens, and other credentials. Secrets are referenced in your test plans and resolved at runtime by the configured secret providers.

#### With Sequential Builder

```typescript
import { GET, createTestBuilder, JSON, Frequency, secret } from "griffin-ts";

const plan = createTestBuilder({
  name: "authenticated-check",
  frequency: Frequency.every(5).minute(),
})
  .request({
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
  .assert([{ type: "status", expected: 200 }])
  .build();

export default plan;
```

#### With Graph Builder

```typescript
import {
  GET,
  createGraphBuilder,
  Endpoint,
  Assertion,
  JSON,
  START,
  END,
  Frequency,
  secret,
} from "griffin-ts";

const plan = createGraphBuilder({
  name: "authenticated-check",
  frequency: Frequency.every(5).minute(),
})
  .addNode(
    "authenticated_request",
    Endpoint({
      method: GET,
      response_format: JSON,
      path: "/api/protected",
      headers: {
        "X-API-Key": secret("env:API_KEY"),
        Authorization: secret("aws:prod/api-token"),
      },
    }),
  )
  .addNode("verify", Assertion([{ type: "status", expected: 200 }]))
  .addEdge(START, "authenticated_request")
  .addEdge("authenticated_request", "verify")
  .addEdge("verify", END)
  .build();

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

- **`.request(config)`**: Add an HTTP endpoint request
- **`.wait(duration)`**: Add a delay (use `Wait.seconds(n)` or `Wait.minutes(n)`)
- **`.assert(assertions)`**: Add assertions to validate responses
- **`.build()`**: Generate the final test plan

#### Graph Builder Methods

- **`.addNode(name, node)`**: Add a node to the graph using `Endpoint()`, `WaitNode()`, or `Assertion()`
- **`.addEdge(from, to)`**: Connect two nodes (use `START` and `END` constants for entry/exit)
- **`.build()`**: Generate the final test plan (validates all nodes are connected)

#### General

- **Frequency**: Use `Frequency.every(n).minute()`, `.hour()`, or `.day()` (note the parentheses)
- **Secrets**: Use `secret("provider:path")` to reference secrets that are resolved at runtime
- **Assertions**: Currently in development - assertion functions are stored but not yet evaluated during execution

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
