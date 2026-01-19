import { GET, POST, createTestBuilder, Json, START, END, Frequency, Wait, Assert, target} from "../griffin-ts/src/index";

const builder = createTestBuilder({
  name: "sample-api-test",
  frequency: Frequency.every(1).minute(),
});

const plan = builder
  .request("health", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/health"
  })
  .request("get_items", {
    method: GET,
    base: target("sample-api"),
    response_format: Json,
    path: "/api/items"
  })
  .request("create_item", {
    method: POST,
    base: target("sample-api"),
    response_format: Json,
    path: "/api/items",
    body: { name: "Test Item", value: 42 }
  })
  .wait("wait_1", Wait.seconds(1))
  .assert((state) => [
    Assert(state["health"].status).equals(200),
    Assert(state["get_items"].status).equals(200),
    Assert(state["create_item"].status).equals(201),
  ])
  .build();

console.log(JSON.stringify(plan, null, 2));
