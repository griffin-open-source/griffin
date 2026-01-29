import { Type } from "typebox";
import { FastifyTypeBox } from "../../types.js";
import { MonitorV1Schema } from "../../schemas/monitors.js";
import {
  Ref,
  ErrorResponseOpts,
  PaginatedResponseSchema,
  PaginationRequestOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";
import { eq, and } from "drizzle-orm";
import { monitorsTable } from "../../storage/adapters/postgres/schema.js";
import {
  AssertionSchema,
  BinaryPredicateOperatorSchema,
  BinaryPredicateSchema,
  UnaryPredicateOperatorSchema,
  UnaryPredicateSchema,
} from "@griffin-app/griffin-ts/schema";
import { migrateToLatest, CURRENT_MONITOR_VERSION } from "@griffin-app/griffin-ts";

export const CreateMonitorEndpoint = {
  tags: ["monitor"],
  body: Type.Omit(MonitorV1Schema, ["id"]),
  response: {
    201: SuccessResponseSchema(Ref(MonitorV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const ListMonitorsEndpoint = {
  tags: ["monitor"],
  querystring: Type.Object({
    projectId: Type.Optional(Type.String()),
    environment: Type.Optional(Type.String()),
    ...PaginationRequestOpts,
  }),
  response: {
    200: PaginatedResponseSchema(Ref(MonitorV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const UpdateMonitorEndpoint = {
  tags: ["monitor"],
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Omit(MonitorV1Schema, ["id"]),
  response: {
    200: SuccessResponseSchema(Ref(MonitorV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const DeleteMonitorEndpoint = {
  tags: ["monitor"],
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    204: Type.Null(),
    ...ErrorResponseOpts,
  },
};

export const GetMonitorByNameEndpoint = {
  tags: ["monitor"],
  querystring: Type.Object({
    projectId: Type.String(),
    environment: Type.String(),
    name: Type.String(),
    version: Type.Optional(Type.Union([Type.Literal("latest"), Type.String()])),
  }),
  response: {
    200: SuccessResponseSchema(Ref(MonitorV1Schema)),
    ...ErrorResponseOpts,
  },
};

export default function (fastify: FastifyTypeBox) {
  fastify.addSchema(MonitorV1Schema);
  fastify.addSchema(BinaryPredicateSchema);
  fastify.addSchema(BinaryPredicateOperatorSchema);
  fastify.addSchema(UnaryPredicateSchema);
  fastify.addSchema(UnaryPredicateOperatorSchema);

  fastify.post(
    "/",
    {
      schema: CreateMonitorEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const organizationId = request.auth.organizationId;
      if (!organizationId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const monitorData = request.body;

      // Validate locations if specified
      if (monitorData.locations && monitorData.locations.length > 0) {
        const registeredLocations =
          await fastify.agentRegistry.getAllLocations();

        const invalidLocations = monitorData.locations.filter(
          (loc) => !registeredLocations.includes(loc),
        );

        if (invalidLocations.length > 0) {
          return reply.code(400).send({
            error: `Invalid location(s): ${invalidLocations.join(", ")}. Available locations: ${registeredLocations.length > 0 ? registeredLocations.join(", ") : "none"}`,
          });
        }
      }

      // Store the monitor using the repository
      const savedMonitor = await fastify.storage.monitors.create({
        ...monitorData,
        organization: organizationId,
      });

      return reply.code(201).send({
        data: {
          ...savedMonitor,
          locations: savedMonitor.locations || [],
        },
      });
    },
  );
  fastify.get(
    "/",
    {
      schema: ListMonitorsEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const organizationId = request.auth.organizationId;
      if (!organizationId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const { projectId, environment, limit = 50, offset = 0 } = request.query;

      // Build where clause with optional filters
      const whereConditions = [];
      if (projectId) whereConditions.push(eq(monitorsTable.project, projectId));
      if (environment)
        whereConditions.push(eq(monitorsTable.environment, environment));
      if (organizationId)
        whereConditions.push(eq(monitorsTable.organization, organizationId));

      const monitors = await fastify.storage.monitors.findMany({
        where: and(...whereConditions),
        limit,
        offset,
      });
      const total = await fastify.storage.monitors.count(and(...whereConditions));

      return reply.send({
        data: monitors.map((monitor) => ({
          ...monitor,
          locations: monitor.locations || [],
        })),
        total,
        limit,
        page: offset / limit + 1,
      });
    },
  );

  fastify.put(
    "/:id",
    {
      schema: UpdateMonitorEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const monitorData = request.body;

      // TODO: Retrieve organization from token once auth is fully implemented
      const organizationId = request.auth.organizationId;
      if (!organizationId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      // Verify monitor exists
      const existing = await fastify.storage.monitors.findById(id);
      if (!existing) {
        return reply.code(404).send({ error: "Monitor not found" });
      }

      // Validate locations if specified
      if (monitorData.locations && monitorData.locations.length > 0) {
        const registeredLocations =
          await fastify.agentRegistry.getAllLocations();

        const invalidLocations = monitorData.locations.filter(
          (loc) => !registeredLocations.includes(loc),
        );

        if (invalidLocations.length > 0) {
          return reply.code(400).send({
            error: `Invalid location(s): ${invalidLocations.join(", ")}. Available locations: ${registeredLocations.length > 0 ? registeredLocations.join(", ") : "none"}`,
          });
        }
      }

      // Update the monitor
      const updated = await fastify.storage.monitors.update(id, {
        ...monitorData,
        organization: organizationId,
      });

      return reply.send({
        data: {
          ...updated,
          locations: updated.locations || [],
        },
      });
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: DeleteMonitorEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.storage.monitors.findById(id);
      if (!existing) {
        return reply.code(404).send({ error: "Monitor not found" });
      }

      await fastify.storage.monitors.delete(id);
      return reply.code(204).send(null);
    },
  );

  fastify.get(
    "/by-name",
    {
      schema: GetMonitorByNameEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { projectId, environment, name, version } = request.query;

      const monitors = await fastify.storage.monitors.findMany({
        where: and(
          eq(monitorsTable.project, projectId),
          eq(monitorsTable.environment, environment),
          eq(monitorsTable.name, name),
        ),
        limit: 1,
      });

      if (monitors.length === 0) {
        return reply.code(404).send({ error: "Monitor not found" });
      }

      let monitor = monitors[0];

      // Migrate to latest if requested
      if (version === "latest" && monitor.version !== CURRENT_MONITOR_VERSION) {
        monitor = migrateToLatest(monitor as any) as typeof monitor;
      }

      return reply.send({
        data: {
          ...monitor,
          locations: monitor.locations || [],
        },
      });
    },
  );
}
