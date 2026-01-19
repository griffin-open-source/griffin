import {
  TestPlanV1,
  HttpMethod,
  ResponseFormat,
  NodeType,
  FrequencyUnit,
  BinaryPredicateOperator,
} from "griffin-plan-executor";

/**
 * Example: Basic API health check
 *
 * This plan checks if an API is responding and returns
 * the expected status field in the JSON response.
 */
export const healthCheck: TestPlanV1 = {
  id: "example-health-check",
  name: "API Health Check",
  version: "1.0",
  endpoint_host: "https://api.example.com",

  // Run every 5 minutes
  frequency: {
    every: 5,
    unit: FrequencyUnit.MINUTE,
  },

  nodes: [
    // Step 1: Make HTTP request
    {
      id: "health-request",
      data: {
        type: NodeType.ENDPOINT,
        method: HttpMethod.GET,
        path: "/health",
        response_format: ResponseFormat.JSON,
      },
    },

    // Step 2: Assert response status is "ok"
    {
      id: "check-status",
      data: {
        type: NodeType.ASSERTION,
        assertions: [
          {
            path: ["status"],
            predicate: {
              expected: "ok",
              operator: BinaryPredicateOperator.EQUAL,
            },
          },
        ],
      },
    },
  ],

  edges: [{ from: "health-request", to: "check-status" }],
};

/**
 * Example: Multiple checks in one file
 *
 * You can export multiple plans from the same file.
 */
export const databaseHealth: TestPlanV1 = {
  id: "example-database-health",
  name: "Database Health Check",
  version: "1.0",
  endpoint_host: "https://api.example.com",

  frequency: {
    every: 10,
    unit: FrequencyUnit.MINUTE,
  },

  nodes: [
    {
      id: "db-health-request",
      data: {
        type: NodeType.ENDPOINT,
        method: HttpMethod.GET,
        path: "/health/database",
        response_format: ResponseFormat.JSON,
      },
    },
    {
      id: "check-db-connected",
      data: {
        type: NodeType.ASSERTION,
        assertions: [
          {
            path: ["database", "connected"],
            predicate: {
              expected: true,
              operator: BinaryPredicateOperator.EQUAL,
            },
          },
        ],
      },
    },
  ],

  edges: [{ from: "db-health-request", to: "check-db-connected" }],
};
