import { test, expect, afterEach } from "vitest";
import Fastify from "fastify";
import App from "../../dist/app.js";

let app: Awaited<ReturnType<typeof Fastify>>;

afterEach(async () => {
  if (app) {
    await app.close();
  }
});

test("default root route", async () => {
  app = Fastify();
  await app.register(App);

  const res = await app.inject({
    url: "/",
  });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ root: true });
});
