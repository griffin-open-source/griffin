import { describe, it, expect } from "vitest";
import { createGraphBuilder, HttpRequest, Wait, Assertion } from "./builder.js";
import { START, END } from "./constants.js";
import { Frequency } from "./frequency.js";
import { secret } from "./secrets.js";
import { variable } from "./variable.js";
import { Assert } from "./assertions.js";
import {
  HttpMethod,
  ResponseFormat,
  NodeType,
  TEST_PLAN_VERSION,
  BinaryPredicateOperator,
  AssertionSubject,
  UnaryPredicateOperator,
} from "./schema.js";

describe("Graph Builder", () => {
  describe("Basic Test Plans", () => {
    it("should build a minimal test plan with single endpoint", () => {
      const plan = createGraphBuilder({
        name: "health-check",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "health",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "health")
        .addEdge("health", END)
        .build();

      expect(plan).toEqual({
        name: "health-check",
        version: TEST_PLAN_VERSION,
        frequency: { every: 5, unit: "MINUTE" },
        locations: undefined,
        nodes: [
          {
            id: "health",
            type: NodeType.HTTP_REQUEST,
            method: HttpMethod.GET,
            path: { $literal: "/health" },
            base: { $literal: "http://localhost:3000" },
            response_format: ResponseFormat.JSON,
          },
        ],
        edges: [
          { from: START, to: "health" },
          { from: "health", to: END },
        ],
      });
    });

    it("should build test plan with multiple HTTP methods", () => {
      const plan = createGraphBuilder({
        name: "crud-test",
        frequency: Frequency.every(1).hour(),
      })
        .addNode(
          "create",
          HttpRequest({
            method: "POST",
            path: "/api/users",
            base: "http://localhost:3000",
            response_format: "JSON",
            body: { name: "Test User" },
          }),
        )
        .addNode(
          "read",
          HttpRequest({
            method: "GET",
            path: "/api/users/1",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "update",
          HttpRequest({
            method: "PUT",
            path: "/api/users/1",
            base: "http://localhost:3000",
            response_format: "JSON",
            body: { name: "Updated User" },
          }),
        )
        .addNode(
          "delete",
          HttpRequest({
            method: "DELETE",
            path: "/api/users/1",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "create")
        .addEdge("create", "read")
        .addEdge("read", "update")
        .addEdge("update", "delete")
        .addEdge("delete", END)
        .build();

      expect(plan.nodes).toHaveLength(4);
      expect(plan.nodes[0].type).toBe(NodeType.HTTP_REQUEST);
      expect((plan.nodes[0] as any).method).toBe(HttpMethod.POST);
      expect((plan.nodes[1] as any).method).toBe(HttpMethod.GET);
      expect((plan.nodes[2] as any).method).toBe(HttpMethod.PUT);
      expect((plan.nodes[3] as any).method).toBe(HttpMethod.DELETE);
    });

    it("should include locations when specified", () => {
      const plan = createGraphBuilder({
        name: "distributed-test",
        frequency: Frequency.every(10).minutes(),
        locations: ["us-east-1", "eu-west-1", "ap-south-1"],
      })
        .addNode(
          "check",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "check")
        .addEdge("check", END)
        .build();

      expect(plan.locations).toEqual(["us-east-1", "eu-west-1", "ap-south-1"]);
    });
  });

  describe("Endpoints with Headers", () => {
    it("should build endpoint with literal headers", () => {
      const plan = createGraphBuilder({
        name: "auth-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "protected",
          HttpRequest({
            method: "GET",
            path: "/api/protected",
            base: "http://localhost:3000",
            response_format: "JSON",
            headers: {
              Authorization: "Bearer token123",
              "Content-Type": "application/json",
              "X-Custom-Header": "custom-value",
            },
          }),
        )
        .addEdge(START, "protected")
        .addEdge("protected", END)
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.headers).toBeDefined();
      expect(endpoint.headers["Authorization"]).toBe("Bearer token123");
      expect(endpoint.headers["Content-Type"]).toBe("application/json");
      expect(endpoint.headers["X-Custom-Header"]).toBe("custom-value");
    });

    it("should build endpoint with secret headers", () => {
      const plan = createGraphBuilder({
        name: "secret-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "secured",
          HttpRequest({
            method: "GET",
            path: "/api/data",
            base: "http://localhost:3000",
            response_format: "JSON",
            headers: {
              Authorization: secret("env:API_TOKEN"),
              "X-API-Key": secret("aws:prod/api-key"),
            },
          }),
        )
        .addEdge(START, "secured")
        .addEdge("secured", END)
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.headers["Authorization"]).toEqual({
        $secret: {
          provider: "env",
          ref: "API_TOKEN",
        },
      });
      expect(endpoint.headers["X-API-Key"]).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/api-key",
        },
      });
    });
  });

  describe("Endpoints with Variables", () => {
    it("should build endpoint with variable base URL", () => {
      const plan = createGraphBuilder({
        name: "variable-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "check",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: variable("api-host"),
            response_format: "JSON",
          }),
        )
        .addEdge(START, "check")
        .addEdge("check", END)
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.base).toEqual({
        $variable: {
          key: "api-host",
        },
      });
    });

    it("should build endpoint with templated path", () => {
      const plan = createGraphBuilder({
        name: "template-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "versioned",
          HttpRequest({
            method: "GET",
            path: variable("api-version", "/api/${api-version}/health"),
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "versioned")
        .addEdge("versioned", END)
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

  describe("Wait Nodes", () => {
    it("should build wait node with milliseconds", () => {
      const plan = createGraphBuilder({
        name: "wait-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode("pause", Wait(2000))
        .addEdge(START, "pause")
        .addEdge("pause", END)
        .build();

      expect(plan.nodes[0]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 2000,
      });
    });

    it("should build wait node with seconds", () => {
      const plan = createGraphBuilder({
        name: "wait-seconds",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode("pause", Wait({ seconds: 5 }))
        .addEdge(START, "pause")
        .addEdge("pause", END)
        .build();

      expect(plan.nodes[0]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 5000,
      });
    });

    it("should build wait node with minutes", () => {
      const plan = createGraphBuilder({
        name: "wait-minutes",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode("pause", Wait({ minutes: 2 }))
        .addEdge(START, "pause")
        .addEdge("pause", END)
        .build();

      expect(plan.nodes[0]).toEqual({
        id: "pause",
        type: NodeType.WAIT,
        duration_ms: 120000,
      });
    });
  });

  describe("Assertion Nodes", () => {
    it("should build status assertion", () => {
      const plan = createGraphBuilder({
        name: "status-assertion",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "call",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "checks",
          Assertion([
            {
              nodeId: "call",
              subject: AssertionSubject.STATUS,
              predicate: {
                operator: BinaryPredicateOperator.EQUAL,
                expected: 200,
                type: "binary",
              },
            },
          ]),
        )
        .addEdge(START, "call")
        .addEdge("call", "checks")
        .addEdge("checks", END)
        .build();

      const assertionNode = plan.nodes[1] as any;
      expect(assertionNode.type).toBe(NodeType.ASSERTION);
      expect(assertionNode.assertions).toHaveLength(1);
      expect(assertionNode.assertions[0]).toEqual({
        nodeId: "call",
        subject: AssertionSubject.STATUS,
        predicate: {
          type: "binary",
          operator: BinaryPredicateOperator.EQUAL,
          expected: 200,
        },
      });
    });

    it("should build JSON body assertion", () => {
      const plan = createGraphBuilder({
        name: "body-assertion",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "call",
          HttpRequest({
            method: "GET",
            path: "/api/data",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "checks",
          Assertion([
            {
              nodeId: "call",
              subject: AssertionSubject.BODY,
              responseType: ResponseFormat.JSON,
              path: ["data", "status"],
              predicate: {
                operator: BinaryPredicateOperator.EQUAL,
                expected: "success",
                type: "binary",
              },
            },
          ]),
        )
        .addEdge(START, "call")
        .addEdge("call", "checks")
        .addEdge("checks", END)
        .build();

      const assertionNode = plan.nodes[1] as any;
      expect(assertionNode.assertions[0]).toEqual({
        nodeId: "call",
        subject: AssertionSubject.BODY,
        responseType: ResponseFormat.JSON,
        path: ["data", "status"],
        predicate: {
          type: "binary",
          operator: BinaryPredicateOperator.EQUAL,
          expected: "success",
        },
      });
    });

    it("should build multiple assertions", () => {
      const plan = createGraphBuilder({
        name: "multi-assertion",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "call",
          HttpRequest({
            method: "GET",
            path: "/api/user",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "checks",
          Assertion([
            {
              nodeId: "call",
              subject: AssertionSubject.STATUS,
              predicate: {
                operator: BinaryPredicateOperator.EQUAL,
                expected: 200,
                type: "binary",
              },
            },
            {
              nodeId: "call",
              subject: AssertionSubject.BODY,
              responseType: ResponseFormat.JSON,
              path: ["name"],
              predicate: {
                operator: UnaryPredicateOperator.IS_NOT_NULL,
                type: "unary",
              },
            },
            {
              nodeId: "call",
              subject: AssertionSubject.HEADERS,
              headerName: "content-type",
              predicate: {
                operator: UnaryPredicateOperator.IS_NOT_EMPTY,
                type: "unary",
              },
            },
          ]),
        )
        .addEdge(START, "call")
        .addEdge("call", "checks")
        .addEdge("checks", END)
        .build();

      const assertionNode = plan.nodes[1] as any;
      expect(assertionNode.assertions).toHaveLength(3);
    });
  });

  describe("Complex Flows", () => {
    it("should build sequential flow with waits and assertions", () => {
      const plan = createGraphBuilder({
        name: "complex-flow",
        frequency: Frequency.every(15).minutes(),
      })
        .addNode(
          "create",
          HttpRequest({
            method: "POST",
            path: "/api/job",
            base: "http://localhost:3000",
            response_format: "JSON",
            body: { task: "process" },
          }),
        )
        .addNode("wait1", Wait({ seconds: 5 }))
        .addNode(
          "poll",
          HttpRequest({
            method: "GET",
            path: "/api/job/1",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "check",
          Assertion([
            {
              nodeId: "poll",
              subject: AssertionSubject.STATUS,
              predicate: {
                operator: BinaryPredicateOperator.EQUAL,
                expected: 200,
                type: "binary",
              },
            },
          ]),
        )
        .addEdge(START, "create")
        .addEdge("create", "wait1")
        .addEdge("wait1", "poll")
        .addEdge("poll", "check")
        .addEdge("check", END)
        .build();

      expect(plan.nodes).toHaveLength(4);
      expect(plan.edges).toHaveLength(5);
      expect(plan.nodes.map((n) => n.id)).toEqual([
        "create",
        "wait1",
        "poll",
        "check",
      ]);
    });

    it("should build test with different response formats", () => {
      const plan = createGraphBuilder({
        name: "format-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "json",
          HttpRequest({
            method: "GET",
            path: "/api/json",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "xml",
          HttpRequest({
            method: "GET",
            path: "/api/xml",
            base: "http://localhost:3000",
            response_format: "XML",
          }),
        )
        .addEdge(START, "json")
        .addEdge("json", "xml")
        .addEdge("xml", END)
        .build();

      expect((plan.nodes[0] as any).response_format).toBe(ResponseFormat.JSON);
      expect((plan.nodes[1] as any).response_format).toBe(ResponseFormat.XML);
    });
  });

  describe("Edge Configuration", () => {
    it("should create correct edges for linear flow", () => {
      const plan = createGraphBuilder({
        name: "linear",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "step1",
          HttpRequest({
            method: "GET",
            path: "/1",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "step2",
          HttpRequest({
            method: "GET",
            path: "/2",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addNode(
          "step3",
          HttpRequest({
            method: "GET",
            path: "/3",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "step1")
        .addEdge("step1", "step2")
        .addEdge("step2", "step3")
        .addEdge("step3", END)
        .build();

      expect(plan.edges).toEqual([
        { from: START, to: "step1" },
        { from: "step1", to: "step2" },
        { from: "step2", to: "step3" },
        { from: "step3", to: END },
      ]);
    });
  });

  describe("Frequency Configurations", () => {
    it("should support minute frequency", () => {
      const plan = createGraphBuilder({
        name: "test",
        frequency: Frequency.every(1).minute(),
      })
        .addNode(
          "check",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "check")
        .addEdge("check", END)
        .build();

      expect(plan.frequency).toEqual({ every: 1, unit: "MINUTE" });
    });

    it("should support hour frequency", () => {
      const plan = createGraphBuilder({
        name: "test",
        frequency: Frequency.every(2).hours(),
      })
        .addNode(
          "check",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "check")
        .addEdge("check", END)
        .build();

      expect(plan.frequency).toEqual({ every: 2, unit: "HOUR" });
    });

    it("should support day frequency", () => {
      const plan = createGraphBuilder({
        name: "test",
        frequency: Frequency.every(1).day(),
      })
        .addNode(
          "check",
          HttpRequest({
            method: "GET",
            path: "/health",
            base: "http://localhost:3000",
            response_format: "JSON",
          }),
        )
        .addEdge(START, "check")
        .addEdge("check", END)
        .build();

      expect(plan.frequency).toEqual({ every: 1, unit: "DAY" });
    });
  });

  describe("Request Body", () => {
    it("should include request body in POST request", () => {
      const plan = createGraphBuilder({
        name: "post-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "create",
          HttpRequest({
            method: "POST",
            path: "/api/users",
            base: "http://localhost:3000",
            response_format: "JSON",
            body: {
              name: "John Doe",
              email: "john@example.com",
              metadata: {
                role: "admin",
                permissions: ["read", "write"],
              },
            },
          }),
        )
        .addEdge(START, "create")
        .addEdge("create", END)
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.body).toEqual({
        name: "John Doe",
        email: "john@example.com",
        metadata: {
          role: "admin",
          permissions: ["read", "write"],
        },
      });
    });

    it("should support secrets in request body", () => {
      const plan = createGraphBuilder({
        name: "secret-body-test",
        frequency: Frequency.every(5).minutes(),
      })
        .addNode(
          "create",
          HttpRequest({
            method: "POST",
            path: "/api/auth",
            base: "http://localhost:3000",
            response_format: "JSON",
            body: {
              apiKey: secret("env:API_KEY"),
              password: secret("aws:prod/db-password", { field: "password" }),
            },
          }),
        )
        .addEdge(START, "create")
        .addEdge("create", END)
        .build();

      const endpoint = plan.nodes[0] as any;
      expect(endpoint.body.apiKey).toEqual({
        $secret: {
          provider: "env",
          ref: "API_KEY",
        },
      });
      expect(endpoint.body.password).toEqual({
        $secret: {
          provider: "aws",
          ref: "prod/db-password",
          field: "password",
        },
      });
    });
  });
});
