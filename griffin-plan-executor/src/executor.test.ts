import { describe, it, expect, beforeEach } from "vitest";
import { executePlanV1 } from "./executor.js";
import { StubAdapter } from "./adapters/stub.js";
import { NodeType, HttpMethod, ResponseFormat } from "griffin/schema";
import { TestPlanV1 } from "griffin/types";
import { START, END, type ExecutionOptions } from "./types.js";
import { LocalEventEmitter, type ExecutionEvent } from "./events";
import { SecretProviderRegistry } from "./secrets/registry.js";
import { EnvSecretProvider } from "./secrets/providers/env.js";

describe("executePlanV1", () => {
  let stubClient: StubAdapter;
  let options: ExecutionOptions;

  beforeEach(() => {
    stubClient = new StubAdapter();
    const secretRegistry = new SecretProviderRegistry();
    secretRegistry.register(new EnvSecretProvider());
    options = {
      mode: "local",
      httpClient: stubClient,
      timeout: 5000,
      secretRegistry: secretRegistry,
    };
  });

  describe("Single Endpoint Execution", () => {
    it("should execute a simple GET request successfully", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-1",
        name: "Simple GET Test",
        environment: "default",
        version: "1.0",
        nodes: [
          {
            id: "get-users",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/users",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "get-users",
          },
          {
            from: "get-users",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "create-user",
            type: NodeType.ENDPOINT,
            method: HttpMethod.POST,
            base: "https://api.example.com",
            path: "/users",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer token123",
            },
            body: { name: "Bob", email: "bob@example.com" },
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "create-user",
          },
          {
            from: "create-user",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "get-data",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/data",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "get-data",
          },
          {
            from: "get-data",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "get-users",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            base: "https://api.example.com",
            path: "/users",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "get-users",
          },
          {
            from: "get-users",
            to: END,
          },
        ],
      };

      stubClient.addStub({
        match: "https://api.example.com/users",
        response: {
          status: 200,
          statusText: "OK",
          data: { users: [] },
        },
      });

      const result = await executePlanV1(plan, options);

      expect(result.success).toBe(true);
    });
  });

  describe("Multiple HTTP Methods", () => {
    it("should handle PUT requests", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-5",
        name: "PUT Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "update-user",
            type: NodeType.ENDPOINT,
            method: HttpMethod.PUT,
            path: "/users/1",
            base: "https://api.example.com",
            body: { name: "Updated Name" },
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "update-user",
          },
          {
            from: "update-user",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "delete-user",
            type: NodeType.ENDPOINT,
            method: HttpMethod.DELETE,
            path: "/users/1",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "delete-user",
          },
          {
            from: "delete-user",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "patch-user",
            type: NodeType.ENDPOINT,
            method: HttpMethod.PATCH,
            path: "/users/1",
            base: "https://api.example.com",
            body: { email: "newemail@example.com" },
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "patch-user",
          },
          {
            from: "patch-user",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "first",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/first",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "second",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/second",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "first",
          },
          {
            from: "first",
            to: "second",
          },
          {
            from: "second",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "step1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/step1",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "step2",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/step2",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "step3",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/step3",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "step4",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/step4",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "step1",
          },
          {
            from: "step1",
            to: "step2",
          },
          {
            from: "step2",
            to: "step3",
          },
          {
            from: "step3",
            to: "step4",
          },
          {
            from: "step4",
            to: END,
          },
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
        environment: "default",
        nodes: [
          {
            id: "wait-node",
            type: NodeType.WAIT,
            duration_ms: 100,
          },
        ],
        edges: [
          {
            from: START,
            to: "wait-node",
          },
          {
            from: "wait-node",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "first-request",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/first",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "wait",
            type: NodeType.WAIT,
            duration_ms: 50,
          },
          {
            id: "second-request",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/second",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "first-request",
          },
          {
            from: "first-request",
            to: "wait",
          },
          {
            from: "wait",
            to: "second-request",
          },
          {
            from: "second-request",
            to: END,
          },
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
        environment: "default",
        nodes: [
          {
            id: "get-data",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/data",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "assert",
            type: NodeType.ASSERTION,
            assertions: [],
          },
        ],
        edges: [
          {
            from: START,
            to: "get-data",
          },
          {
            from: "get-data",
            to: "assert",
          },
          {
            from: "assert",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "failing-request",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/fail",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "failing-request",
          },
          {
            from: "failing-request",
            to: END,
          },
        ],
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

    it("should handle disconnected nodes gracefully", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-14",
        name: "Disconnected Nodes Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "node1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/path",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "node2",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/path",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          { from: START, to: END }, // Direct path that skips nodes
          { from: "node1", to: "node2" }, // Circular - disconnected from main flow
          { from: "node2", to: "node1" },
        ],
      };

      stubClient.addStub({
        match: "https://api.example.com/path",
        response: {
          status: 200,
          statusText: "OK",
          data: {},
        },
      });

      const result = await executePlanV1(plan, options);

      // Graph can execute but disconnected nodes are not executed
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0); // No nodes executed
    });

    it("should continue execution after a failed node", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-15",
        name: "Continue After Failure Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "success-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/success",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "fail-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/fail",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "success-node",
          },
          {
            from: "success-node",
            to: "fail-node",
          },
          {
            from: "fail-node",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "get-user-id",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/user",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "get-profile",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/profile",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "get-user-id",
          },
          {
            from: "get-user-id",
            to: "get-profile",
          },
          {
            from: "get-profile",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "failing-endpoint",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/fail",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "failing-endpoint",
          },
          {
            from: "failing-endpoint",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "endpoint",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/data",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "endpoint",
          },
          {
            from: "endpoint",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "node1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/1",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "wait",
            type: NodeType.WAIT,
            duration_ms: 50,
          },
          {
            id: "node2",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/2",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "node1",
          },
          {
            from: "node1",
            to: "wait",
          },
          {
            from: "wait",
            to: "node2",
          },
          {
            from: "node2",
            to: END,
          },
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
        environment: "default",
        nodes: [],
        edges: [
          {
            from: START,
            to: END,
          },
        ],
      };

      const result = await executePlanV1(plan, options);

      // Empty plan with just START->END should succeed with no results
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle single node with no edges", async () => {
      const plan: TestPlanV1 = {
        id: "test-plan-21",
        name: "Single Node Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "only-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/single",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "only-node",
          },
          {
            from: "only-node",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "complex",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/complex",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "complex",
          },
          {
            from: "complex",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "node-1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/test",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "node-1",
          },
          {
            from: "node-1",
            to: END,
          },
        ],
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
        edgeCount: 2,
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
        environment: "default",
        nodes: [
          {
            id: "endpoint-1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/first",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
          {
            id: "wait-1",
            type: NodeType.WAIT,
            duration_ms: 10,
          },
          {
            id: "endpoint-2",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/second",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "endpoint-1",
          },
          {
            from: "endpoint-1",
            to: "wait-1",
          },
          {
            from: "wait-1",
            to: "endpoint-2",
          },
          {
            from: "endpoint-2",
            to: END,
          },
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
        environment: "default",
        nodes: [
          {
            id: "http-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.POST,
            path: "/create",
            base: "https://api.example.com",
            headers: { "Content-Type": "application/json" },
            body: { name: "test" },
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "http-node",
          },
          {
            from: "http-node",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "wait-node",
            type: NodeType.WAIT,
            duration_ms: 50,
          },
        ],
        edges: [
          {
            from: START,
            to: "wait-node",
          },
          {
            from: "wait-node",
            to: END,
          },
        ],
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

    it("should emit ERROR event on HTTP request failure", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-5",
        name: "Error Event Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "failing-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/fail",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "failing-node",
          },
          {
            from: "failing-node",
            to: END,
          },
        ],
      };

      // No stub - request will fail

      const result = await executePlanV1(plan, {
        ...options,
        eventEmitter: emitter,
      });

      result.errors;

      // Should emit error for the failed HTTP request
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should maintain monotonic sequence numbers", async () => {
      const plan: TestPlanV1 = {
        id: "event-test-6",
        name: "Sequence Test",
        version: "1.0",
        environment: "default",
        nodes: [
          {
            id: "node-1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/test",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "node-1",
          },
          {
            from: "node-1",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "node-1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/test",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "node-1",
          },
          {
            from: "node-1",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "node-1",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/test",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "node-1",
          },
          {
            from: "node-1",
            to: END,
          },
        ],
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
        environment: "default",
        nodes: [
          {
            id: "failing-node",
            type: NodeType.ENDPOINT,
            method: HttpMethod.GET,
            path: "/fail",
            base: "https://api.example.com",
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          {
            from: START,
            to: "failing-node",
          },
          {
            from: "failing-node",
            to: END,
          },
        ],
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
