import { GET, POST, createTestBuilder, Json, START, END, Frequency, Wait, Assert, target } from "../griffin-ts/src/index";

const plan = createTestBuilder({
  name: "example-check",
  frequency: Frequency.every(1).minute(),
})
  .request("health_check", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/health"
  })
  .assert((state) => [
    Assert(state["health_check"].status).equals(200),
  ])
  .wait("wait_1", Wait.seconds(1))
  .build();

console.log(JSON.stringify(plan, null, 2));
