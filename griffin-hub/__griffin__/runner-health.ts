import {
  GET,
  createGraphBuilder,
  Endpoint,
  Json,
  START,
  END,
  Frequency,
  target,
} from "griffin";

const plan = createGraphBuilder({
  name: "runner-health-check",
  frequency: Frequency.every(1).minute(),
})
  .addNode(
    "root",
    Endpoint({
      method: GET,
      base: target("runner-api"),
      response_format: Json,
      path: "/",
    }),
  )
  .addEdge(START, "root")
  .addEdge("root", END)
  .build();

export default plan;
