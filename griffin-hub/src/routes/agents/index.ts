import type { FastifyPluginAsync } from "fastify";
import { Type } from "typebox";
import { AgentSchema, AgentStatusSchema } from "../../schemas/agent.js";
import { FastifyTypeBox } from "../../types.js";

export const RegisterEndpoint = {
  description: "Register a new agent with the hub",
  tags: ["agents"],
  body: Type.Object({
    location: Type.String(),
    metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
  }),
  response: {
    200: AgentSchema,
  },
};
export const HeartbeatEndpoint = {
  description: "Record a heartbeat from an agent",
  tags: ["agents"],
  params: Type.Object({
    id: Type.String({ description: "Agent ID" }),
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
    }),
    404: Type.Object({
      error: Type.String(),
    }),
  },
};

export const DeregisterEndpoint = {
  description: "Deregister an agent",
  tags: ["agents"],
  params: Type.Object({
    id: Type.String({ description: "Agent ID" }),
  }),
  response: {
    200: Type.Object({
      success: Type.Boolean(),
    }),
  },
};
export const ListAgentsEndpoint = {
  description: "List all agents with optional filtering",
  tags: ["agents"],
  querystring: Type.Object({
    location: Type.Optional(Type.String({ description: "Filter by location" })),
    status: Type.Optional(
      Type.String({
        description: "Filter by status",
        enum: ["online", "offline"],
      }),
    ),
  }),
  response: {
    200: Type.Object({
      data: Type.Array(AgentSchema),
      total: Type.Number(),
    }),
  },
};
export const GetRegisteredLocationsEndpoint = {
  description: "Get all registered locations (with at least one online agent)",
  tags: ["agents"],
  response: {
    200: Type.Object({
      locations: Type.Array(Type.String()),
    }),
  },
};
const agentsRoute: FastifyPluginAsync = async (fastify: FastifyTypeBox) => {
  const agentRegistry = fastify.agentRegistry;
  // POST /agents/register - Register a new agent
  fastify.post(
    "/register",
    {
      schema: RegisterEndpoint,
    },
    async (request, reply) => {
      const { location, metadata } = request.body;

      const agent = await agentRegistry.register({
        location,
        metadata,
      });

      return reply.code(200).send(agent);
    },
  );

  // POST /agents/:id/heartbeat - Record heartbeat from an agent
  fastify.post(
    "/:id/heartbeat",
    {
      schema: HeartbeatEndpoint,
    },
    async (request, reply) => {
      const { id } = request.params;

      const success = await agentRegistry.heartbeat(id);

      if (!success) {
        return reply.code(404).send({
          error: `Agent not found: ${id}`,
        });
      }

      return reply.code(200).send({ success: true });
    },
  );

  // DELETE /agents/:id - Deregister an agent
  fastify.delete(
    "/:id",
    {
      schema: DeregisterEndpoint,
    },
    async (request, reply) => {
      const { id } = request.params;

      await agentRegistry.deregister(id);

      return reply.code(200).send({ success: true });
    },
  );

  // GET /agents - List all agents
  fastify.get(
    "/",
    {
      schema: ListAgentsEndpoint,
    },
    async (request, reply) => {
      const { location, status } = request.query as {
        location?: string;
        status?: "online" | "offline";
      };

      const agents = await agentRegistry.listAgents(location, status as any);

      return reply.code(200).send({
        data: agents,
        total: agents.length,
      });
    },
  );

  // GET /agents/locations - Get all registered locations
  fastify.get(
    "/locations",
    {
      schema: GetRegisteredLocationsEndpoint,
    },
    async (request, reply) => {
      const locations = await agentRegistry.getRegisteredLocations();

      return reply.code(200).send({
        locations,
      });
    },
  );
};

export default agentsRoute;
