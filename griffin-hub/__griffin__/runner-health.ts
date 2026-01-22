import {
  GET,
  createGraphBuilder,
  Endpoint,
  Json,
  START,
  END,
  Frequency,
  variable,
} from "@griffin-app/griffin-ts";

const plan = createGraphBuilder({
  name: "runner-health-check",
  frequency: Frequency.every(1).minute(),
})
  .addNode(
    "root",
    Endpoint({
      method: GET,
      base: variable("griffin-hub"),
      response_format: Json,
      path: "/",
    }),
  )
  .addEdge(START, "root")
  .addEdge("root", END)
  .build();

export default plan;
