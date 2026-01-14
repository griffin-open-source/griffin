/**
 * Example test file demonstrating secrets usage in 1test.
 *
 * This example shows how to use the `secret()` function to reference
 * secrets that will be resolved at runtime by the configured secret providers.
 *
 * To run this test with secrets:
 * 1. Set the required environment variables:
 *    export MY_API_KEY="your-api-key-here"
 *    export AUTH_TOKEN="your-auth-token"
 *
 * 2. Run the test:
 *    node 1test-cli/dist/cli.js run-local
 */

import {
  GET,
  POST,
  ApiCheckBuilder,
  JSON,
  START,
  END,
  Frequency,
  Wait,
  secret,
} from "../1test-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "example-with-secrets",
  endpoint_host: "http://localhost:3000",
});

const plan = builder
  // Example: GET request with API key in header
  .addEndpoint("authenticated_get", {
    method: GET,
    response_format: JSON,
    path: "/api/protected",
    headers: {
      // Use env provider to get API key from environment variable
      "X-API-Key": secret("env:MY_API_KEY"),
      "Content-Type": "application/json",
    },
  })
  .addWait("wait_between_requests", Wait.seconds(1))
  // Example: POST request with auth token in body
  .addEndpoint("authenticated_post", {
    method: POST,
    response_format: JSON,
    path: "/api/data",
    headers: {
      "Content-Type": "application/json",
      // Multiple secrets can be used in the same request
      Authorization: secret("env:AUTH_TOKEN"),
    },
    body: {
      action: "create",
      // Secrets can also be used in request bodies
      apiKey: secret("env:MY_API_KEY"),
    },
  })
  .addEdge(START, "authenticated_get")
  .addEdge("authenticated_get", "wait_between_requests")
  .addEdge("wait_between_requests", "authenticated_post")
  .addEdge("authenticated_post", END);

plan.create({
  frequency: Frequency.every(5).minute(),
});

/**
 * Secret Provider Reference:
 *
 * Environment Variables (always available):
 *   secret("env:VARIABLE_NAME")
 *
 * AWS Secrets Manager (requires AWS credentials):
 *   secret("aws:secret-name")
 *   secret("aws:secret-name", { field: "key" })  // Extract field from JSON secret
 *   secret("aws:secret-name", { version: "AWSPREVIOUS" })  // Specific version
 *
 * HashiCorp Vault (requires Vault configuration):
 *   secret("vault:secret/data/path")
 *   secret("vault:secret/data/path", { field: "key" })
 *   secret("vault:secret/data/path", { version: "2" })
 *
 * Runner Configuration (environment variables):
 *   SECRET_PROVIDERS=env,aws,vault  # Comma-separated list of enabled providers
 *
 *   # AWS provider config
 *   AWS_SECRETS_REGION=us-east-1
 *   AWS_SECRETS_PREFIX=myapp/      # Optional prefix for all secret names
 *
 *   # Vault provider config
 *   VAULT_ADDR=https://vault.example.com:8200
 *   VAULT_TOKEN=hvs.xxx
 *   VAULT_NAMESPACE=myteam         # Optional Vault Enterprise namespace
 */
