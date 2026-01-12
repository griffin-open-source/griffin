import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, Wait } from "../1test-test-system/src/index";

const builder = new ApiCheckBuilder({
  name: "sample-api-test",
  endpoint_host: "http://localhost:3000"
});

const plan = builder
  .addEndpoint("health", {
    method: GET,
    response_format: JSON,
    path: "/health"
  })
  .addEndpoint("get_items", {
    method: GET,
    response_format: JSON,
    path: "/api/items"
  })
  .addEndpoint("create_item", {
    method: POST,
    response_format: JSON,
    path: "/api/items",
    body: { name: "Test Item", value: 42 }
  })
  .addWait("wait_1", Wait.seconds(1))
  .addEdge(START, "health")
  .addEdge("health", "get_items")
  .addEdge("get_items", "create_item")
  .addEdge("create_item", "wait_1")
  .addEdge("wait_1", END);

plan.create({
  frequency: Frequency.every(1).minute(),
});
