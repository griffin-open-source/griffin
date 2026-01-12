import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency, Wait, env } from "../1test-ts/src/index";

const endpointHost = (() => {
  try {
    return env('endpoint_host');
  } catch {
    return "http://localhost:3000"; // fallback
  }
})();

const builder = new ApiCheckBuilder({
  name: "example-check",
  endpoint_host: endpointHost
});

const plan = builder
  .addEndpoint("health_check", {
    method: GET,
    response_format: JSON,
    path: "/health"
  })
  .addWait("wait_1", Wait.seconds(1))
  .addEdge(START, "health_check")
  .addEdge("health_check", "wait_1")
  .addEdge("wait_1", END);

plan.create({
  frequency: Frequency.every(1).minute(),
});
