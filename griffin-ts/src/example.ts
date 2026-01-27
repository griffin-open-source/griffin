/**
 * Example usage of the griffin Test System DSL
 *
 * This file demonstrates how to create a test plan using the DSL.
 * In practice, test files would be placed in __griffin__ subdirectories
 * and discovered by the CLI tool.
 */

import {
  GET,
  POST,
  createGraphBuilder,
  HttpRequest,
  Wait,
  Assertion,
  Json,
  START,
  END,
  Frequency,
  WaitDuration,
  variable,
} from "./index.js";

const plan = createGraphBuilder({
  name: "foo-bar-check",
  frequency: Frequency.every(1).minute(),
})
  .addNode(
    "create_foo",
    HttpRequest({
      method: POST,
      base: variable("api-service"),
      response_format: Json,
      path: "/api/v1/foo",
    }),
  )
  .addNode(
    "get_foo",
    HttpRequest({
      method: GET,
      base: variable("api-service"),
      response_format: Json,
      path: "/api/v1/foo",
    }),
  )
  .addNode("first_wait", Wait(WaitDuration.minutes(1)))
  // Note: Assertion nodes with the rich DSL are best used with the Sequential Builder
  // For graph builder, assertions can be manually constructed with SerializedAssertion format
  .addEdge(START, "create_foo")
  .addEdge("create_foo", "get_foo")
  .addEdge("get_foo", "first_wait")
  .addEdge("first_wait", END)
  .build();

console.log(JSON.stringify(plan, null, 2));
