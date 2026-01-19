/**
 * Example usage of the Sequential Test Builder
 *
 * This demonstrates the simplified createTestBuilder API for straightforward
 * linear test flows. Use this when you don't need complex branching.
 *
 * For more complex graphs with parallel execution or conditional flows,
 * see example.ts which uses createGraphBuilder.
 */

import {
  GET,
  POST,
  createTestBuilder,
  Json,
  Frequency,
  WaitDuration,
  Assert,
  target,
} from "./index";

// ============================================================================
// Example 1: Simple health check with new assertion API
// ============================================================================

const healthCheck = createTestBuilder({
  name: "health-check",
  frequency: Frequency.every(1).minute(),
})
  .request("health", {
    method: GET,
    base: target("api-service"),
    response_format: Json,
    path: "/health",
  })
  .assert((state) => [
    Assert(state["health"].status).equals(200),
    Assert(state["health"].body["status"]).equals("ok"),
    Assert(state["health"].headers["content-type"]).contains(
      "application/json",
    ),
  ])
  .build();

console.log("Health Check Plan:");
console.log(JSON.stringify(healthCheck, null, 2));

// ============================================================================
// Example 2: Complex sequential flow with rich assertions
// ============================================================================

const userJourney = createTestBuilder({
  name: "create-and-verify-user",
  frequency: Frequency.every(5).minute(),
})
  .request("create_user", {
    method: POST,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/users",
    body: {
      name: "Test User",
      email: "test@example.com",
    },
  })
  .assert((state) => [
    // Status code assertions
    Assert(state["create_user"].status).equals(201),

    // Body assertions with JSONPath
    Assert(state["create_user"].body["data"]["id"]).not.isNull(),
    Assert(state["create_user"].body["data"]["name"]).equals("Test User"),
    Assert(state["create_user"].body["data"]["email"]).equals(
      "test@example.com",
    ),
    Assert(state["create_user"].body["data"]["created_at"]).isDefined(),

    // Header assertions
    Assert(state["create_user"].headers["content-type"]).contains(
      "application/json",
    ),
    Assert(state["create_user"].headers["location"]).startsWith(
      "/api/v1/users/",
    ),
  ])
  .wait("pause", WaitDuration.seconds(2))
  .request("get_user", {
    method: GET,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/users/test@example.com",
  })
  .assert((state) => [
    Assert(state["get_user"].status).equals(200),
    Assert(state["get_user"].body["data"]["name"]).equals("Test User"),
    Assert(state["get_user"].body["data"]["active"]).isTrue(),
    Assert(state["get_user"].body["data"]["deleted"]).not.isTrue(),
  ])
  .build();

console.log("\nUser Journey Plan:");
console.log(JSON.stringify(userJourney, null, 2));

// ============================================================================
// Example 3: Advanced assertions with comparisons
// ============================================================================

const performanceCheck = createTestBuilder({
  name: "performance-check",
  frequency: Frequency.every(10).minute(),
})
  .request("api_call", {
    method: GET,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/metrics",
  })
  .assert((state) => [
    // Numeric comparisons
    Assert(state["api_call"].body["response_time_ms"]).lessThan(500),
    Assert(state["api_call"].body["error_rate"]).lessThanOrEqual(0.01),
    Assert(state["api_call"].body["success_count"]).greaterThan(0),
    Assert(state["api_call"].body["memory_usage_mb"]).lessThan(1024),

    // String assertions
    Assert(state["api_call"].body["version"]).startsWith("v2."),
    Assert(state["api_call"].body["deployment"]).not.equals(""),
    Assert(state["api_call"].body["environment"]).contains("prod"),

    // Array/collection assertions
    Assert(state["api_call"].body["endpoints"]).not.isEmpty(),
  ])
  .build();

console.log("\nPerformance Check Plan:");
console.log(JSON.stringify(performanceCheck, null, 2));

// ============================================================================
// Example 4: Multi-step API test with state dependencies
// ============================================================================

const orderWorkflow = createTestBuilder({
  name: "order-workflow",
  frequency: Frequency.every(30).minute(),
})
  .request("create_order", {
    method: POST,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/orders",
    body: {
      items: [{ product_id: "ABC123", quantity: 2 }],
      customer_email: "customer@example.com",
    },
  })
  .assert((state) => [
    Assert(state["create_order"].status).equals(201),
    Assert(state["create_order"].body["order_id"]).isDefined(),
    Assert(state["create_order"].body["status"]).equals("pending"),
    Assert(state["create_order"].body["total"]).greaterThan(0),
  ])
  .request("confirm_order", {
    method: POST,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/orders/confirm",
    body: {
      order_id: "${create_order.body.order_id}", // Future: template interpolation
    },
  })
  .assert((state) => [
    Assert(state["confirm_order"].status).equals(200),
    Assert(state["confirm_order"].body["status"]).equals("confirmed"),
    Assert(state["confirm_order"].body["confirmed_at"]).not.isNull(),
  ])
  .wait("processing_time", WaitDuration.seconds(5))
  .request("check_order", {
    method: GET,
    base: target("api-service"),
    response_format: Json,
    path: "/api/v1/orders/${create_order.body.order_id}",
  })
  .assert((state) => [
    Assert(state["check_order"].status).equals(200),
    Assert(state["check_order"].body["status"]).not.equals("pending"),
    Assert(state["check_order"].body["processed"]).isTrue(),
  ])
  .build();

console.log("\nOrder Workflow Plan:");
console.log(JSON.stringify(orderWorkflow, null, 2));
