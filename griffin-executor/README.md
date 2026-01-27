# griffin Plan Executor

The griffin Plan Executor takes JSON test plans (output from the test system DSL) and executes them. It can run tests locally or remotely (e.g., in a Lambda function).

## Features

✅ **Currently Working**:

- Execute JSON test plans
- Support for HTTP endpoints (GET, POST, PUT, DELETE, PATCH)
- Support for wait nodes
- Graph-based execution following edges (topological sort)
- Secrets resolution at runtime (env, AWS Secrets Manager, HashiCorp Vault)
- Local execution mode
- Detailed error reporting with node-by-node results

🚧 **In Development**:

- Assertion evaluation (structure in place)
- Remote execution mode
- Advanced error handling and retries

## Installation

```bash
npm install
npm run build
```

## Usage

### Programmatic Usage

```typescript
import { executePlan } from "./dist/executor";
import type { TestPlan } from "./dist/test-plan-types";

const testPlan: TestPlan = {
  name: "my-test",
  endpoint_host: "http://localhost",
  nodes: [
    {
      id: "health",
      type: "endpoint",
      method: "GET",
      path: "/health",
      response_format: "JSON",
    },
  ],
  edges: [
    { from: "__START__", to: "health" },
    { from: "health", to: "__END__" },
  ],
};

const results = await executePlan(testPlan, {
  mode: "local",
  baseUrl: "http://localhost:3000",
  timeout: 30000,
  secretRegistry: secretRegistry, // Optional: for resolving secrets in test plans
});

console.log(results);
// {
//   success: true,
//   results: [
//     {
//       nodeId: "health",
//       success: true,
//       response: { status: "ok" },
//       duration_ms: 25
//     }
//   ],
//   errors: [],
//   totalDuration_ms: 25
// }
```

### Execution Options

```typescript
interface ExecutionOptions {
  mode: "local" | "remote"; // Currently only 'local' is fully supported
  baseUrl?: string; // Base URL for endpoints (overrides plan's endpoint_host)
  timeout?: number; // Request timeout in ms (default: 30000)
  secretRegistry?: SecretProviderRegistry; // Optional: for resolving secrets in test plans
}
```

## Execution Flow

1. **Parse the test plan JSON** - Validates structure and types
2. **Build execution graph** - Performs topological sort starting from `__START__`
3. **Execute nodes in order**:
   - **Endpoints**: Makes HTTP requests, stores responses
   - **Waits**: Sleeps for specified duration
   - **Assertions**: Evaluates assertions (currently structure only)
4. **Collect results** - Aggregates success/failure status for each node
5. **Return execution results** - Includes detailed node results, errors, and timing

## Node Types

### HttpRequest Nodes

- Makes HTTP requests using axios
- Supports all HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Parses JSON, XML, or TEXT responses
- Stores response for use in subsequent nodes

### Wait Nodes

- Pauses execution for specified duration
- Duration specified in milliseconds

### Assertion Nodes

- Currently structure is in place but evaluation needs implementation
- Will evaluate assertions with access to all previous endpoint responses

### Secrets Resolution

If a test plan contains secret references (created using the `secret()` function in the DSL), they are resolved before execution begins. Secrets can be used in endpoint headers and request bodies.

**Supported Providers:**

- **Environment Variables**: Read from process environment
- **AWS Secrets Manager**: Retrieve secrets from AWS Secrets Manager
- **HashiCorp Vault**: Retrieve secrets from Vault KV secrets engine

**Example test plan with secrets:**

```json
{
  "name": "authenticated-check",
  "nodes": [
    {
      "id": "api_call",
      "type": "endpoint",
      "headers": {
        "Authorization": {
          "$secret": {
            "provider": "env",
            "ref": "API_TOKEN"
          }
        }
      }
    }
  ]
}
```

The executor will resolve all secrets before executing the plan. If any secret cannot be resolved, execution fails immediately with a clear error message.
