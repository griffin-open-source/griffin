import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * This plugin sets up Swagger/OpenAPI documentation for the API.
 * It generates documentation from the route schemas and provides a UI to explore the API.
 *
 * @see https://github.com/fastify/fastify-swagger
 *
 * Endpoints:
 * - /documentation - Swagger UI interface
 * - /documentation/json - OpenAPI spec in JSON format
 * - /documentation/yaml - OpenAPI spec in YAML format
 */
export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "griffin-runner API",
        description: "API for managing and running test plans",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Local development server",
        },
      ],
      tags: [
        { name: "plans", description: "Test plan management endpoints" },
        { name: "runs", description: "Test run management endpoints" },
      ],
      components: {
        securitySchemes: {
          // Add security schemes here if needed in the future
        },
      },
    },
    refResolver: {
      buildLocalReference(json, baseUri, fragment, i) {
        if (!json.title && json.$id) {
          json.title = json.$id;
        }
        // Fallback if no $id is present
        if (!json.$id) {
          return `def-${i}`;
        }
        return `${json.$id}`;
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
    transformSpecificationClone: true,
  });
});
