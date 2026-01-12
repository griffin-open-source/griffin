import { describe, it, expect, beforeEach } from "vitest";
import { executePlanV1 } from "./executor.js";
import { StubAdapter } from "./adapters/stub.js";
import {
  NodeType,
  HttpMethod,
  ResponseFormat,
  type TestPlanV1,
} from "./schemas.js";
import type { ExecutionOptions } from "./types.js";
import { LocalEventEmitter, type ExecutionEvent } from "./events/index.js";

describe("executePlanV1", () => {
  let stubClient: StubAdapter;
  let options: ExecutionOptions;

  beforeEach(() => {
    stubClient = new StubAdapter();
    options = {
      mode: "local",
      httpClient: stubClient,
      timeout: 5000,
    };
  });

  describe("Single Endpoint Execution", () => {
    it("should execute a simple GET request successfully", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-1",
        name: "Simple GET Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "get-users",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/users",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/users",
        response: {
          status: 200,
          statusText: "OK",
          data: { users: [{ id: 1, name: "Alice" }] },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].nodeId).toBe("get-users");
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].response).toEqual({
        users: [{ id: 1, name: "Alice" }],
      });
      expect(result.results[0].duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("should execute a POST request with body and headers", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-2",
        name: "POST Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "create-user",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.POST,
              path: "/users",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer token123",
              },
              body: { name: "Bob", email: "bob@example.com" },
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: (req) =>
          req.url === "https://api.example.com/users" && req.method === "POST",
        response: {
          status: 201,
          statusText: "Created",
          data: { id: 2, name: "Bob", email: "bob@example.com" },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toEqual({
        id: 2,
        name: "Bob",
        email: "bob@example.com",
      });
    });

    it("should handle JSON string responses by parsing them", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-3",
        name: "JSON String Response Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "get-data",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/data",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/data",
        response: {
          status: 200,
          statusText: "OK",
          data: '{"message":"hello"}',
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toEqual({ message: "hello" });
    });

    it("should override endpoint_host with baseUrl option", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-4",
        name: "BaseUrl Override Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "get-users",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/users",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://localhost:3000/users",
        response: {
          status: 200,
          statusText: "OK",
          data: { users: [] },
        },
      });

      const result = await executePlanV1(plan, {
        ...options,
        baseUrl: "https://localhost:3000",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Multiple HTTP Methods", () => {
    it("should handle PUT requests", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-5",
        name: "PUT Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "update-user",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.PUT,
              path: "/users/1",
              body: { name: "Updated Name" },
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/users/1",
        response: {
          status: 200,
          statusText: "OK",
          data: { id: 1, name: "Updated Name" },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toEqual({
        id: 1,
        name: "Updated Name",
      });
    });

    it("should handle DELETE requests", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-6",
        name: "DELETE Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "delete-user",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.DELETE,
              path: "/users/1",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/users/1",
        response: {
          status: 204,
          statusText: "No Content",
          data: null,
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toBeNull();
    });

    it("should handle PATCH requests", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-7",
        name: "PATCH Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "patch-user",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.PATCH,
              path: "/users/1",
              body: { email: "newemail@example.com" },
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/users/1",
        response: {
          status: 200,
          statusText: "OK",
          data: { id: 1, email: "newemail@example.com" },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
    });
  });

  describe("Sequential Execution", () => {
    it("should execute two endpoints in sequence", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-8",
        name: "Sequential Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "first",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/first",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "second",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/second",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [{ from: "first", to: "second" }],
      };

      stubClient
        .addStub({
          match: "https://api.example.com/first",
          response: {
            status: 200,
            statusText: "OK",
            data: { step: 1 },
          },
        })
        .addStub({
          match: "https://api.example.com/second",
          response: {
            status: 200,
            statusText: "OK",
            data: { step: 2 },
          },
        });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].nodeId).toBe("first");
      expect(result.results[1].nodeId).toBe("second");
      expect(result.results[0].response).toEqual({ step: 1 });
      expect(result.results[1].response).toEqual({ step: 2 });
    });

    it("should execute a linear chain of multiple endpoints", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-9",
        name: "Multi-Step Linear Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "step1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/step1",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "step2",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/step2",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "step3",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/step3",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "step4",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/step4",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "step1", to: "step2" },
          { from: "step2", to: "step3" },
          { from: "step3", to: "step4" },
        ],
      };

      stubClient
        .addStub({
          match: /\/step1$/,
          response: { status: 200, statusText: "OK", data: { step: 1 } },
        })
        .addStub({
          match: /\/step2$/,
          response: { status: 200, statusText: "OK", data: { step: 2 } },
        })
        .addStub({
          match: /\/step3$/,
          response: { status: 200, statusText: "OK", data: { step: 3 } },
        })
        .addStub({
          match: /\/step4$/,
          response: { status: 200, statusText: "OK", data: { step: 4 } },
        });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(4);
      expect(result.results[0].response).toEqual({ step: 1 });
      expect(result.results[1].response).toEqual({ step: 2 });
      expect(result.results[2].response).toEqual({ step: 3 });
      expect(result.results[3].response).toEqual({ step: 4 });
    });
  });

  describe("Wait Node", () => {
    it("should execute a wait node successfully", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-10",
        name: "Wait Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "wait-node",
            data: {
              type: NodeType.WAIT,
              duration_ms: 100,
            },
          },
        ],
        edges: [],
      };

      const startTime = Date.now();
      const result = await executePlanV1(plan, options);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].nodeId).toBe("wait-node");
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].duration_ms).toBeGreaterThanOrEqual(100);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it("should execute endpoints with waits in between", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-11",
        name: "Endpoint-Wait-Endpoint Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "first-request",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/first",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "wait",
            data: {
              type: NodeType.WAIT,
              duration_ms: 50,
            },
          },
          {
            id: "second-request",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/second",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "first-request", to: "wait" },
          { from: "wait", to: "second-request" },
        ],
      };

      stubClient
        .addStub({
          match: /\/first$/,
          response: { status: 200, statusText: "OK", data: { step: 1 } },
        })
        .addStub({
          match: /\/second$/,
          response: { status: 200, statusText: "OK", data: { step: 2 } },
        });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[1].nodeId).toBe("wait");
      expect(result.results[1].duration_ms).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Assertion Node", () => {
    it("should execute an assertion node (currently no-op)", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-12",
        name: "Assertion Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "get-data",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/data",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "assert",
            data: {
              type: NodeType.ASSERTION,
              assertions: [],
            },
          },
        ],
        edges: [{ from: "get-data", to: "assert" }],
      };

      stubClient.addStub({
        match: "https://api.example.com/data",
        response: {
          status: 200,
          statusText: "OK",
          data: { value: 42 },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[1].nodeId).toBe("assert");
      expect(result.results[1].success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle failed HTTP requests gracefully", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-13",
        name: "Failed Request Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "failing-request",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/fail",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      // Don't add a stub - this will cause the request to fail

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("failing-request");
      expect(result.errors[0]).toContain("No stub matched request");
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBeDefined();
    });

    it("should return error when no start node can be determined", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-14",
        name: "No Start Node Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/path",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "node2",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/path",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "node1", to: "node2" },
          { from: "node2", to: "node1" }, // Circular - both have incoming edges
        ],
      };

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Could not determine start or end node from plan",
      );
    });

    it("should continue execution after a failed node", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-15",
        name: "Continue After Failure Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "success-node",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/success",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "fail-node",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/fail",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [{ from: "success-node", to: "fail-node" }],
      };

      stubClient.addStub({
        match: /\/success$/,
        response: { status: 200, statusText: "OK", data: { ok: true } },
      });
      // No stub for /fail - it will fail

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe("Response Storage", () => {
    it("should store successful responses for downstream nodes", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-16",
        name: "Response Storage Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "get-user-id",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/user",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "get-profile",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/profile",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [{ from: "get-user-id", to: "get-profile" }],
      };

      stubClient
        .addStub({
          match: /\/user$/,
          response: {
            status: 200,
            statusText: "OK",
            data: { userId: 123 },
          },
        })
        .addStub({
          match: /\/profile$/,
          response: {
            status: 200,
            statusText: "OK",
            data: { name: "John Doe", age: 30 },
          },
        });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toEqual({ userId: 123 });
      expect(result.results[1].response).toEqual({ name: "John Doe", age: 30 });
    });

    it("should not store failed responses", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-17",
        name: "Failed Response Not Stored Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "failing-endpoint",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/fail",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      // No stub configured - will fail

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(false);
      expect(result.results[0].response).toBeUndefined();
    });
  });

  describe("Timing and Performance", () => {
    it("should track total execution duration", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-18",
        name: "Timing Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "endpoint",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/data",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/data",
        response: {
          status: 200,
          statusText: "OK",
          data: { test: true },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.totalDuration_ms).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration_ms).toBeGreaterThanOrEqual(
        result.results[0].duration_ms,
      );
    });

    it("should track individual node durations", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-19",
        name: "Node Duration Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/1",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "wait",
            data: {
              type: NodeType.WAIT,
              duration_ms: 50,
            },
          },
          {
            id: "node2",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/2",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "node1", to: "wait" },
          { from: "wait", to: "node2" },
        ],
      };

      stubClient
        .addStub({
          match: /\/1$/,
          response: { status: 200, statusText: "OK", data: {} },
        })
        .addStub({
          match: /\/2$/,
          response: { status: 200, statusText: "OK", data: {} },
        });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      result.results.forEach((nodeResult) => {
        expect(nodeResult.duration_ms).toBeGreaterThanOrEqual(0);
      });
      expect(result.results[1].duration_ms).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty plan (no nodes)", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-20",
        name: "Empty Plan Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [],
        edges: [],
      };

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Could not determine start or end node from plan",
      );
    });

    it("should handle single node with no edges", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-21",
        name: "Single Node Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "only-node",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/single",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/single",
        response: {
          status: 200,
          statusText: "OK",
          data: { alone: true },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it("should handle complex response data types", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-22",
        name: "Complex Data Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "complex",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/complex",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      const complexData = {
        string: "test",
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: {
          deep: {
            value: "nested",
          },
        },
      };

      stubClient.addStub({
        match: "https://api.example.com/complex",
        response: {
          status: 200,
          statusText: "OK",
          data: complexData,
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
      expect(result.results[0].response).toEqual(complexData);
    });
  });

  describe("Event Emission", () => {
    let emitter: LocalEventEmitter;
    let events: ExecutionEvent[];

    beforeEach(() => {
      emitter = new LocalEventEmitter();
      events = [];
      emitter.subscribe((event) => events.push(event));
    });

    it("should emit PLAN_START and PLAN_END events", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-1",
        name: "Event Test Plan",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/test",
        response: { status: 200, statusText: "OK", data: { ok: true } },
      });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const planStartEvents = events.filter((e) => e.type === "PLAN_START");
      const planEndEvents = events.filter((e) => e.type === "PLAN_END");

      expect(planStartEvents).toHaveLength(1);
      expect(planEndEvents).toHaveLength(1);

      const planStart = planStartEvents[0];
      expect(planStart).toMatchObject({
        type: "PLAN_START",
        planId: "event-test-1",
        planName: "Event Test Plan",
        planVersion: "1.0",
        nodeCount: 1,
        edgeCount: 0,
      });

      const planEnd = planEndEvents[0];
      expect(planEnd).toMatchObject({
        type: "PLAN_END",
        success: true,
        nodeResultCount: 1,
        errorCount: 0,
      });
    });

    it("should emit NODE_START and NODE_END events for each node", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-2",
        name: "Multi-Node Event Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "endpoint-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/first",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "wait-1",
            data: {
              type: NodeType.WAIT,
              duration_ms: 10,
            },
          },
          {
            id: "endpoint-2",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/second",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "endpoint-1", to: "wait-1" },
          { from: "wait-1", to: "endpoint-2" },
        ],
      };

      stubClient
        .addStub({
          match: /\/first$/,
          response: { status: 200, statusText: "OK", data: { step: 1 } },
        })
        .addStub({
          match: /\/second$/,
          response: { status: 200, statusText: "OK", data: { step: 2 } },
        });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const nodeStartEvents = events.filter((e) => e.type === "NODE_START");
      const nodeEndEvents = events.filter((e) => e.type === "NODE_END");

      expect(nodeStartEvents).toHaveLength(3);
      expect(nodeEndEvents).toHaveLength(3);

      // Check node types
      expect(nodeStartEvents[0]).toMatchObject({
        nodeId: "endpoint-1",
        nodeType: "endpoint",
      });
      expect(nodeStartEvents[1]).toMatchObject({
        nodeId: "wait-1",
        nodeType: "wait",
      });
      expect(nodeStartEvents[2]).toMatchObject({
        nodeId: "endpoint-2",
        nodeType: "endpoint",
      });
    });

    it("should emit HTTP_REQUEST and HTTP_RESPONSE events for endpoint nodes", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-3",
        name: "HTTP Event Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "http-node",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.POST,
              path: "/create",
              headers: { "Content-Type": "application/json" },
              body: { name: "test" },
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/create",
        response: { status: 201, statusText: "Created", data: { id: 123 } },
      });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const httpRequestEvents = events.filter((e) => e.type === "HTTP_REQUEST");
      const httpResponseEvents = events.filter(
        (e) => e.type === "HTTP_RESPONSE",
      );

      expect(httpRequestEvents).toHaveLength(1);
      expect(httpResponseEvents).toHaveLength(1);

      const httpRequest = httpRequestEvents[0];
      expect(httpRequest).toMatchObject({
        type: "HTTP_REQUEST",
        nodeId: "http-node",
        attempt: 1,
        method: "POST",
        url: "https://api.example.com/create",
        hasBody: true,
      });
      expect(httpRequest.headers).toEqual({
        "Content-Type": "application/json",
      });

      const httpResponse = httpResponseEvents[0];
      expect(httpResponse).toMatchObject({
        type: "HTTP_RESPONSE",
        nodeId: "http-node",
        attempt: 1,
        status: 201,
        statusText: "Created",
        hasBody: true,
      });
      expect(httpResponse.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("should emit WAIT_START event for wait nodes", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-4",
        name: "Wait Event Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "wait-node",
            data: {
              type: NodeType.WAIT,
              duration_ms: 50,
            },
          },
        ],
        edges: [],
      };

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const waitStartEvents = events.filter((e) => e.type === "WAIT_START");

      expect(waitStartEvents).toHaveLength(1);
      expect(waitStartEvents[0]).toMatchObject({
        type: "WAIT_START",
        nodeId: "wait-node",
        duration_ms: 50,
      });
    });

    it("should emit ERROR event on plan validation failure", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-5",
        name: "Error Event Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
          {
            id: "node-2",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [
          { from: "node-1", to: "node-2" },
          { from: "node-2", to: "node-1" }, // Circular - causes validation error
        ],
      };

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const errorEvents = events.filter((e) => e.type === "ERROR");

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0]).toMatchObject({
        type: "ERROR",
        context: "plan_validation",
        message: "Could not determine start or end node from plan",
      });
    });

    it("should maintain monotonic sequence numbers", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-6",
        name: "Sequence Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/test",
        response: { status: 200, statusText: "OK", data: {} },
      });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      // Check that all events have the same executionId
      const executionIds = [...new Set(events.map((e) => e.executionId))];
      expect(executionIds).toHaveLength(1);

      // Check that sequence numbers are monotonically increasing
      const seqs = events.map((e) => e.seq);
      for (let i = 0; i < seqs.length - 1; i++) {
        expect(seqs[i + 1]).toBe(seqs[i] + 1);
      }

      // First event should be seq 0
      expect(seqs[0]).toBe(0);
    });

    it("should use provided executionId if given", async () => {
      const customExecutionId = "custom-exec-id-123";

      const plan: TestPlanV1 = {
        id: "event-test-7",
        name: "Custom Execution ID Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/test",
        response: { status: 200, statusText: "OK", data: {} },
      });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
        executionId: customExecutionId,
      });

      // All events should have the custom executionId
      events.forEach((event) => {
        expect(event.executionId).toBe(customExecutionId);
      });
    });

    it("should emit events in correct order", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-8",
        name: "Event Order Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "node-1",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/test",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      stubClient.addStub({
        match: "https://api.example.com/test",
        response: { status: 200, statusText: "OK", data: {} },
      });

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const eventTypes = events.map((e) => e.type);

      // Expected order: PLAN_START, NODE_START, HTTP_REQUEST, HTTP_RESPONSE, NODE_END, PLAN_END
      expect(eventTypes[0]).toBe("PLAN_START");
      expect(eventTypes[1]).toBe("NODE_START");
      expect(eventTypes[2]).toBe("HTTP_REQUEST");
      expect(eventTypes[3]).toBe("HTTP_RESPONSE");
      expect(eventTypes[4]).toBe("NODE_END");
      expect(eventTypes[5]).toBe("PLAN_END");
    });

    it("should handle failed HTTP requests correctly", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-9",
        name: "Failed Request Event Test",
        version: "1.0",
        endpoint_host: "https://api.example.com",
        nodes: [
          {
            id: "failing-node",
            data: {
              type: NodeType.ENDPOINT,
              method: HttpMethod.GET,
              path: "/fail",
              response_format: ResponseFormat.JSON,
            },
          },
        ],
        edges: [],
      };

      // No stub - request will fail

      await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      const httpResponseEvents = events.filter(
        (e) => e.type === "HTTP_RESPONSE",
      );
      const nodeEndEvents = events.filter((e) => e.type === "NODE_END");

      expect(httpResponseEvents).toHaveLength(1);
      expect(httpResponseEvents[0]).toMatchObject({
        status: 0,
        statusText: "Error",
        hasBody: false,
      });

      expect(nodeEndEvents[0]).toMatchObject({
        success: false,
      });
      expect(nodeEndEvents[0].error).toBeDefined();
    });
  });
});
