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

### Basic Example

```typescript
import { GET, ApiCheckBuilder, JSON, START, END, Frequency } from "../griffin-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "health-check",
  endpoint_host: "http://localhost"
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

### Advanced Example with Waits

```typescript
import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, Wait } from "../griffin-ts/src/index";

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

### Using Secrets

griffin supports secure secret management for API keys, tokens, and other credentials. Secrets are referenced in your test plans and resolved at runtime by the configured secret providers.

```typescript
import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, secret } from "../griffin-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "authenticated-check",
  endpoint_host: "https://api.example.com"
});

const plan = builder
  .addEndpoint("authenticated_request", {
    method: GET,
    response_format: JSON,
    path: "/api/protected",
    headers: {
      // Use environment variable
      "X-API-Key": secret("env:API_KEY"),
      // Use AWS Secrets Manager
      "Authorization": secret("aws:prod/api-token"),
      // Extract field from JSON secret
      "X-Custom-Header": secret("aws:prod/config", { field: "customHeader" }),
    },
    body: {
      // Secrets can also be used in request bodies
      apiKey: secret("env:API_KEY"),
    }
  })
  .addEdge(START, "authenticated_request")
  .addEdge("authenticated_request", END);

plan.create({
  frequency: Frequency.every(5).minute()
});
```

#### Secret Providers

**Environment Variables** (always available):
```typescript
secret("env:VARIABLE_NAME")
```

**AWS Secrets Manager** (requires AWS configuration):
```typescript
secret("aws:secret-name")
secret("aws:secret-name", { field: "key" })  // Extract field from JSON secret
secret("aws:secret-name", { version: "AWSPREVIOUS" })  // Pin to specific version
```

**HashiCorp Vault** (requires Vault configuration):
```typescript
secret("vault:secret/data/path")
secret("vault:secret/data/path", { field: "key" })
secret("vault:secret/data/path", { version: "2" })
```

See the [griffin-runner CONFIG.md](../griffin-runner/CONFIG.md) for configuration details.

### Notes

- **Frequency**: Use `Frequency.every(n).minute()`, `.hour()`, or `.day()` (note the parentheses)
- **Waits**: Use `Wait.seconds(n)` or `Wait.minutes(n)`
- **Secrets**: Use `secret("provider:path")` to reference secrets that are resolved at runtime
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
