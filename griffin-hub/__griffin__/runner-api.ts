import {
  GET,
  createGraphBuilder,
  Endpoint,
  Json,
  START,
  END,
  Frequency,
  secret,
  variable,
} from "@griffin-app/griffin-ts";

const plan = createGraphBuilder({
  name: "runner-api-check",
  frequency: Frequency.every(5).minute(),
})
  .addNode(
    "list_plans",
    Endpoint({
      method: GET,
      base: variable("griffin-hub"),
      response_format: Json,
      path: "/plan",
      headers: { "X-API-Key": secret("env:RUNNER_API_KEY") },
    }),
  )
  .addNode(
    "list_runs",
    Endpoint({
      method: GET,
      base: variable("griffin-hub"),
      response_format: Json,
      path: "/runs",
      headers: { "X-API-Key": secret("env:RUNNER_API_KEY") },
    }),
  )
  .addEdge(START, "list_plans")
  .addEdge("list_plans", "list_runs")
  .addEdge("list_runs", END)
  .build();

export default plan;
