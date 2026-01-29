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
  CURRENT_MONITOR_VERSION,
} from "./schema.js";

describe("Sequential Test Builder", () => {
  describe("Basic Sequential Tests", () => {
    it("should build a minimal sequential test", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.name).toBe("simple-check");
      expect(monitor.version).toBe(CURRENT_MONITOR_VERSION);
      expect(monitor.frequency).toEqual({ every: 5, unit: "MINUTE" });
      expect(monitor.nodes).toHaveLength(1);
      expect(monitor.edges).toEqual([
        { from: START, to: "health" },
        { from: "health", to: END },
      ]);
    });

    it("should auto-generate edges for multiple requests", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(3);
      expect(monitor.edges).toEqual([
        { from: START, to: "step1" },
        { from: "step1", to: "step2" },
        { from: "step2", to: "step3" },
        { from: "step3", to: END },
      ]);
    });

    it("should build empty test with no nodes", () => {
      const monitor = createTestBuilder({
        name: "empty-test",
        frequency: Frequency.every(1).hour(),
      }).build();

      expect(monitor.nodes).toHaveLength(0);
      expect(monitor.edges).toEqual([{ from: START, to: END }]);
    });

    it("should include locations when specified", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.locations).toEqual(["us-east-1", "eu-west-1"]);
    });
  });

  describe("Request Methods", () => {
    it("should support all HTTP methods", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(5);
      expect((monitor.nodes[0] as any).method).toBe(HttpMethod.GET);
      expect((monitor.nodes[1] as any).method).toBe(HttpMethod.POST);
      expect((monitor.nodes[2] as any).method).toBe(HttpMethod.PUT);
      expect((monitor.nodes[3] as any).method).toBe(HttpMethod.PATCH);
      expect((monitor.nodes[4] as any).method).toBe(HttpMethod.DELETE);
    });

    it("should include headers in requests", () => {
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
      expect(endpoint.headers).toEqual({
        Authorization: "Bearer token123",
        "X-Custom": "value",
      });
    });

    it("should include body in requests", () => {
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
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
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(3);
      expect(monitor.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 2000,
      });
      expect(monitor.edges).toEqual([
        { from: START, to: "step1" },
        { from: "step1", to: "pause" },
        { from: "pause", to: "step2" },
        { from: "step2", to: END },
      ]);
    });

    it("should add wait with seconds", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 5000,
      });
    });

    it("should add wait with minutes", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes[1]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 120000,
      });
    });
  });

  describe("Assertions", () => {
    it("should add assertions with auto-generated node name", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(2);
      expect(monitor.nodes[1].type).toBe(NodeType.ASSERTION);
      expect(monitor.nodes[1].id).toMatch(/^step_\d+$/);
    });

    it("should create assertions with type-safe state access", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(4);
      expect(monitor.nodes[0].id).toBe("create_user");
      expect(monitor.nodes[1].type).toBe(NodeType.ASSERTION);
      expect(monitor.nodes[2].id).toBe("get_user");
      expect(monitor.nodes[3].type).toBe(NodeType.ASSERTION);
    });

    it("should properly chain assertions with requests and waits", () => {
      const monitor = createTestBuilder({
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

      expect(monitor.nodes).toHaveLength(5);
      expect(monitor.edges).toEqual([
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
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
      expect(endpoint.headers.Authorization).toEqual({
        $secret: {
          provider: "env",
          ref: "API_TOKEN",
        },
      });
    });

    it("should support secrets in body", () => {
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
      expect(endpoint.body.apiKey).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/api-key",
        },
      });
    });

    it("should support variables for base URL", () => {
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
      expect(endpoint.base).toEqual({
        $variable: {
          key: "api-host",
        },
      });
    });

    it("should support templated variable paths", () => {
      const monitor = createTestBuilder({
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

      const endpoint = monitor.nodes[0] as any;
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
      const monitor = createTestBuilder({
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

      expect((monitor.nodes[0] as any).response_format).toBe(ResponseFormat.JSON);
    });

    it("should support XML response format", () => {
      const monitor = createTestBuilder({
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

      expect((monitor.nodes[0] as any).response_format).toBe(ResponseFormat.XML);
    });
  });

  describe("Frequency Configurations", () => {
    it("should support different frequency units", () => {
      const minuteMonitor = createTestBuilder({
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

      const hourMonitor = createTestBuilder({
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

      const dayMonitor = createTestBuilder({
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

      expect(minuteMonitor.frequency).toEqual({ every: 5, unit: "MINUTE" });
      expect(hourMonitor.frequency).toEqual({ every: 2, unit: "HOUR" });
      expect(dayMonitor.frequency).toEqual({ every: 1, unit: "DAY" });
    });
  });
});
