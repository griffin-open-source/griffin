import { describe, it, expect } from "vitest";
import { createTestBuilder } from "./sequential-builder.js";
import { START, END } from "./constants.js";
import { Frequency } from "./frequency.js";
import { secret } from "./secrets.js";
import { variable } from "./variable.js";
import { Assert } from "./assertions.js";
import {
  HttpMethod,
  ResponseFormat,
  NodeType,
  CURRENT_PLAN_VERSION,
} from "./schema.js";

describe("Sequential Test Builder", () => {
  describe("Basic Sequential Tests", () => {
    it("should build a minimal sequential test", () => {
      const plan = createTestBuilder({
        name: "simple-check",
        frequency: Frequency.every(5).minutes(),
      })
        .request("health", {
          method: "GET",
          path: "/health",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.name).toBe("simple-check");
      expect(plan.version).toBe(CURRENT_PLAN_VERSION);
      expect(plan.frequency).toEqual({ every: 5, unit: "MINUTE" });
      expect(plan.nodes).toHaveLength(1);
      expect(plan.edges).toEqual([
        { from: START, to: "health" },
        { from: "health", to: END },
      ]);
    });

    it("should auto-generate edges for multiple requests", () => {
      const plan = createTestBuilder({
        name: "multi-step",
        frequency: Frequency.every(10).minutes(),
      })
        .request("step1", {
          method: "GET",
          path: "/step1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .request("step2", {
          method: "GET",
          path: "/step2",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .request("step3", {
          method: "GET",
          path: "/step3",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.nodes).toHaveLength(3);
      expect(plan.edges).toEqual([
        { from: START, to: "step1" },
        { from: "step1", to: "step2" },
        { from: "step2", to: "step3" },
        { from: "step3", to: END },
      ]);
    });

    it("should build empty test with no nodes", () => {
      const plan = createTestBuilder({
        name: "empty-test",
        frequency: Frequency.every(1).hour(),
      }).build();

      expect(plan.nodes).toHaveLength(0);
      expect(plan.edges).toEqual([{ from: START, to: END }]);
    });

    it("should include locations when specified", () => {
      const plan = createTestBuilder({
        name: "distributed-test",
        frequency: Frequency.every(5).minutes(),
        locations: ["us-east-1", "eu-west-1"],
      })
        .request("check", {
          method: "GET",
          path: "/health",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.locations).toEqual(["us-east-1", "eu-west-1"]);
    });
  });

  describe("Request Methods", () => {
    it("should support all HTTP methods", () => {
      const plan = createTestBuilder({
        name: "http-methods",
        frequency: Frequency.every(5).minutes(),
      })
        .request("get", {
          method: "GET",
          path: "/get",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .request("post", {
          method: "POST",
          path: "/post",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: { data: "test" },
        })
        .request("put", {
          method: "PUT",
          path: "/put",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: { data: "update" },
        })
        .request("patch", {
          method: "PATCH",
          path: "/patch",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: { data: "partial" },
        })
        .request("delete", {
          method: "DELETE",
          path: "/delete",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.nodes).toHaveLength(5);
      expect((plan.nodes[0] as any).method).toBe(HttpMethod.GET);
      expect((plan.nodes[1] as any).method).toBe(HttpMethod.POST);
      expect((plan.nodes[2] as any).method).toBe(HttpMethod.PUT);
      expect((plan.nodes[3] as any).method).toBe(HttpMethod.PATCH);
      expect((plan.nodes[4] as any).method).toBe(HttpMethod.DELETE);
    });

    it("should include headers in requests", () => {
      const plan = createTestBuilder({
        name: "with-headers",
        frequency: Frequency.every(5).minutes(),
      })
        .request("auth", {
          method: "GET",
          path: "/protected",
          base: "http://localhost:3000",
          response_format: "JSON",
          headers: {
            Authorization: "Bearer token123",
            "X-Custom": "value",
          },
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.headers).toEqual({
        Authorization: "Bearer token123",
        "X-Custom": "value",
      });
    });

    it("should include body in requests", () => {
      const plan = createTestBuilder({
        name: "with-body",
        frequency: Frequency.every(5).minutes(),
      })
        .request("create", {
          method: "POST",
          path: "/api/users",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: {
            name: "Test User",
            email: "test@example.com",
            metadata: {
              role: "user",
            },
          },
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.body).toEqual({
        name: "Test User",
        email: "test@example.com",
        metadata: {
          role: "user",
        },
      });
    });
  });

  describe("Wait Nodes", () => {
    it("should add wait with milliseconds", () => {
      const plan = createTestBuilder({
        name: "with-wait",
        frequency: Frequency.every(5).minutes(),
      })
        .request("step1", {
          method: "GET",
          path: "/step1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .wait("pause", 2000)
        .request("step2", {
          method: "GET",
          path: "/step2",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.nodes).toHaveLength(3);
      expect(plan.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 2000,
      });
      expect(plan.edges).toEqual([
        { from: START, to: "step1" },
        { from: "step1", to: "pause" },
        { from: "pause", to: "step2" },
        { from: "step2", to: END },
      ]);
    });

    it("should add wait with seconds", () => {
      const plan = createTestBuilder({
        name: "with-wait-seconds",
        frequency: Frequency.every(5).minutes(),
      })
        .request("step1", {
          method: "GET",
          path: "/step1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .wait("pause", { seconds: 5 })
        .request("step2", {
          method: "GET",
          path: "/step2",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 5000,
      });
    });

    it("should add wait with minutes", () => {
      const plan = createTestBuilder({
        name: "with-wait-minutes",
        frequency: Frequency.every(5).minutes(),
      })
        .request("step1", {
          method: "GET",
          path: "/step1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .wait("pause", { minutes: 2 })
        .request("step2", {
          method: "GET",
          path: "/step2",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(plan.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 120000,
      });
    });
  });

  describe("Assertions", () => {
    it("should add assertions with auto-generated node name", () => {
      const plan = createTestBuilder({
        name: "with-assertions",
        frequency: Frequency.every(5).minutes(),
      })
        .request("call", {
          method: "GET",
          path: "/api/data",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .assert((state) => [Assert(state.call.status).equals(200)])
        .build();

      expect(plan.nodes).toHaveLength(2);
      expect(plan.nodes[1].type).toBe(NodeType.ASSERTION);
      expect(plan.nodes[1].id).toMatch(/^step_\d+$/);
    });

    it("should create assertions with type-safe state access", () => {
      const plan = createTestBuilder({
        name: "typed-assertions",
        frequency: Frequency.every(5).minutes(),
      })
        .request("create_user", {
          method: "POST",
          path: "/api/users",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: { name: "Test User" },
        })
        .assert((state) => [
          Assert(state.create_user.status).equals(201),
          Assert(state.create_user.body.id).not.isNull(),
          Assert(state.create_user.body.name).equals("Test User"),
        ])
        .request("get_user", {
          method: "GET",
          path: "/api/users/1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .assert((state) => [
          Assert(state.get_user.status).equals(200),
          Assert(state.get_user.body.id).not.isNull(),
        ])
        .build();

      expect(plan.nodes).toHaveLength(4);
      expect(plan.nodes[0].id).toBe("create_user");
      expect(plan.nodes[1].type).toBe(NodeType.ASSERTION);
      expect(plan.nodes[2].id).toBe("get_user");
      expect(plan.nodes[3].type).toBe(NodeType.ASSERTION);
    });

    it("should properly chain assertions with requests and waits", () => {
      const plan = createTestBuilder({
        name: "complex-chain",
        frequency: Frequency.every(15).minutes(),
      })
        .request("create", {
          method: "POST",
          path: "/api/job",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: { task: "process" },
        })
        .assert((state) => [Assert(state.create.status).equals(201)])
        .wait("pause", { seconds: 5 })
        .request("poll", {
          method: "GET",
          path: "/api/job/1",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .assert((state) => [
          Assert(state.poll.status).equals(200),
          Assert(state.poll.body.status).equals("complete"),
        ])
        .build();

      expect(plan.nodes).toHaveLength(5);
      expect(plan.edges).toEqual([
        { from: START, to: "create" },
        { from: "create", to: "step_0" },
        { from: "step_0", to: "pause" },
        { from: "pause", to: "poll" },
        { from: "poll", to: "step_1" },
        { from: "step_1", to: END },
      ]);
    });
  });

  describe("Secrets and Variables", () => {
    it("should support secrets in headers", () => {
      const plan = createTestBuilder({
        name: "secret-headers",
        frequency: Frequency.every(5).minutes(),
      })
        .request("secured", {
          method: "GET",
          path: "/api/data",
          base: "http://localhost:3000",
          response_format: "JSON",
          headers: {
            Authorization: secret("env:API_TOKEN"),
          },
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.headers.Authorization).toEqual({
        $secret: {
          provider: "env",
          ref: "API_TOKEN",
        },
      });
    });

    it("should support secrets in body", () => {
      const plan = createTestBuilder({
        name: "secret-body",
        frequency: Frequency.every(5).minutes(),
      })
        .request("auth", {
          method: "POST",
          path: "/api/auth",
          base: "http://localhost:3000",
          response_format: "JSON",
          body: {
            apiKey: secret("aws:prod/api-key"),
          },
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.body.apiKey).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/api-key",
        },
      });
    });

    it("should support variables for base URL", () => {
      const plan = createTestBuilder({
        name: "variable-base",
        frequency: Frequency.every(5).minutes(),
      })
        .request("call", {
          method: "GET",
          path: "/health",
          base: variable("api-host"),
          response_format: "JSON",
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.base).toEqual({
        $variable: {
          key: "api-host",
        },
      });
    });

    it("should support templated variable paths", () => {
      const plan = createTestBuilder({
        name: "template-path",
        frequency: Frequency.every(5).minutes(),
      })
        .request("versioned", {
          method: "GET",
          path: variable("api-version", "/api/${api-version}/health"),
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.path).toEqual({
        $variable: {
          key: "api-version",
          template: "/api/${api-version}/health",
        },
      });
    });
  });

  describe("Response Formats", () => {
    it("should support JSON response format", () => {
      const plan = createTestBuilder({
        name: "json-response",
        frequency: Frequency.every(5).minutes(),
      })
        .request("api", {
          method: "GET",
          path: "/api/json",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect((plan.nodes[0] as any).response_format).toBe(ResponseFormat.JSON);
    });

    it("should support XML response format", () => {
      const plan = createTestBuilder({
        name: "xml-response",
        frequency: Frequency.every(5).minutes(),
      })
        .request("api", {
          method: "GET",
          path: "/api/xml",
          base: "http://localhost:3000",
          response_format: "XML",
        })
        .build();

      expect((plan.nodes[0] as any).response_format).toBe(ResponseFormat.XML);
    });
  });

  describe("Frequency Configurations", () => {
    it("should support different frequency units", () => {
      const minutePlan = createTestBuilder({
        name: "minute-freq",
        frequency: Frequency.every(5).minutes(),
      })
        .request("check", {
          method: "GET",
          path: "/health",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      const hourPlan = createTestBuilder({
        name: "hour-freq",
        frequency: Frequency.every(2).hours(),
      })
        .request("check", {
          method: "GET",
          path: "/health",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      const dayPlan = createTestBuilder({
        name: "day-freq",
        frequency: Frequency.every(1).day(),
      })
        .request("check", {
          method: "GET",
          path: "/health",
          base: "http://localhost:3000",
          response_format: "JSON",
        })
        .build();

      expect(minutePlan.frequency).toEqual({ every: 5, unit: "MINUTE" });
      expect(hourPlan.frequency).toEqual({ every: 2, unit: "HOUR" });
      expect(dayPlan.frequency).toEqual({ every: 1, unit: "DAY" });
    });
  });
});
