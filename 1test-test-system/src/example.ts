/**
 * Example usage of the 1test Test System DSL
 * 
 * This file demonstrates how to create a test plan using the DSL.
 * In practice, test files would be placed in __1test__ subdirectories
 * and discovered by the CLI tool.
 */

import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, Wait } from "./index";

const builder = new ApiCheckBuilder({
  name: "foo-bar-check",
  endpoint_host: "https://foobar.com"
});

const plan = builder
  .addEndpoint("create_foo", {
    method: POST,
    response_format: JSON,
    path: "/api/v1/foo",
  })
  .addEndpoint("get_foo", {
    method: GET,
    response_format: JSON,
    path: "/api/v1/foo"
  })
  .addWait("first_wait", Wait.minutes(1))
  .addAssertions("first_asserts", ({get_foo: get_response, create_foo: post_response}, asserts) => [
    // Note: In the actual implementation, the assertion function would be evaluated
    // during execution with access to the actual responses
    // This is a placeholder showing the intended API
  ])
  .addEdge(START, "create_foo")
  .addEdge("create_foo", "get_foo")
  .addEdge("get_foo", "first_wait")
  .addEdge("first_wait", "first_asserts")
  .addEdge("first_asserts", END);

plan.create({
  frequency: Frequency.every(1).minute(),
});
