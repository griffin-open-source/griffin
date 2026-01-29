import { Type } from "typebox";
import { FastifyTypeBox } from "../../types.js";
import { PlanV1Schema } from "../../schemas/plans.js";
import {
  Ref,
  ErrorResponseOpts,
  PaginatedResponseSchema,
  PaginationRequestOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";
import { eq, and } from "drizzle-orm";
import { plansTable } from "../../storage/adapters/postgres/schema.js";
import {
  AssertionSchema,
  BinaryPredicateOperatorSchema,
  BinaryPredicateSchema,
  UnaryPredicateOperatorSchema,
  UnaryPredicateSchema,
} from "@griffin-app/griffin-ts/schema";
import { migrateToLatest, CURRENT_PLAN_VERSION } from "@griffin-app/griffin-ts";

export const CreatePlanEndpoint = {
  tags: ["plan"],
  body: Type.Omit(PlanV1Schema, ["id"]),
  response: {
    201: SuccessResponseSchema(Ref(PlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const ListPlansEndpoint = {
  tags: ["plan"],
  querystring: Type.Object({
    projectId: Type.Optional(Type.String()),
    environment: Type.Optional(Type.String()),
    ...PaginationRequestOpts,
  }),
  response: {
    200: PaginatedResponseSchema(Ref(PlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const UpdatePlanEndpoint = {
  tags: ["plan"],
  params: Type.Object({
    id: Type.String(),
  }),
  body: Type.Omit(PlanV1Schema, ["id"]),
  response: {
    200: SuccessResponseSchema(Ref(PlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const DeletePlanEndpoint = {
  tags: ["plan"],
  params: Type.Object({
    id: Type.String(),
  }),
  response: {
    204: Type.Null(),
    ...ErrorResponseOpts,
  },
};

export const GetPlanByNameEndpoint = {
  tags: ["plan"],
  querystring: Type.Object({
    projectId: Type.String(),
    environment: Type.String(),
    name: Type.String(),
    version: Type.Optional(Type.Union([Type.Literal("latest"), Type.String()])),
  }),
  response: {
    200: SuccessResponseSchema(Ref(PlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export default function (fastify: FastifyTypeBox) {
  fastify.addSchema(PlanV1Schema);
  fastify.addSchema(BinaryPredicateSchema);
  fastify.addSchema(BinaryPredicateOperatorSchema);
  fastify.addSchema(UnaryPredicateSchema);
  fastify.addSchema(UnaryPredicateOperatorSchema);

  fastify.post(
    "/",
    {
      schema: CreatePlanEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const organizationId = request.auth.organizationId;
      if (!organizationId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const planData = request.body;

      // Validate locations if specified
      if (planData.locations && planData.locations.length > 0) {
        const registeredLocations =
          await fastify.agentRegistry.getAllLocations();

        const invalidLocations = planData.locations.filter(
          (loc) => !registeredLocations.includes(loc),
        );

        if (invalidLocations.length > 0) {
          return reply.code(400).send({
            error: `Invalid location(s): ${invalidLocations.join(", ")}. Available locations: ${registeredLocations.length > 0 ? registeredLocations.join(", ") : "none"}`,
          });
        }
      }

      // Store the plan using the repository
      const savedPlan = await fastify.storage.plans.create({
        ...planData,
        organization: organizationId,
      });

      return reply.code(201).send({
        data: {
          ...savedPlan,
          locations: savedPlan.locations || [],
        },
      });
    },
  );
  fastify.get(
    "/",
    {
      schema: ListPlansEndpoint,
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
      if (projectId) whereConditions.push(eq(plansTable.project, projectId));
      if (environment)
        whereConditions.push(eq(plansTable.environment, environment));
      if (organizationId)
        whereConditions.push(eq(plansTable.organization, organizationId));

      const plans = await fastify.storage.plans.findMany({
        where: and(...whereConditions),
        limit,
        offset,
      });
      const total = await fastify.storage.plans.count(and(...whereConditions));

      return reply.send({
        data: plans.map((plan) => ({
          ...plan,
          locations: plan.locations || [],
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
      schema: UpdatePlanEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const planData = request.body;

      // TODO: Retrieve organization from token once auth is fully implemented
      const organizationId = request.auth.organizationId;
      if (!organizationId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      // Verify plan exists
      const existing = await fastify.storage.plans.findById(id);
      if (!existing) {
        return reply.code(404).send({ error: "Plan not found" });
      }

      // Validate locations if specified
      if (planData.locations && planData.locations.length > 0) {
        const registeredLocations =
          await fastify.agentRegistry.getAllLocations();

        const invalidLocations = planData.locations.filter(
          (loc) => !registeredLocations.includes(loc),
        );

        if (invalidLocations.length > 0) {
          return reply.code(400).send({
            error: `Invalid location(s): ${invalidLocations.join(", ")}. Available locations: ${registeredLocations.length > 0 ? registeredLocations.join(", ") : "none"}`,
          });
        }
      }

      // Update the plan
      const updated = await fastify.storage.plans.update(id, {
        ...planData,
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
      schema: DeletePlanEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.storage.plans.findById(id);
      if (!existing) {
        return reply.code(404).send({ error: "Plan not found" });
      }

      await fastify.storage.plans.delete(id);
      return reply.code(204).send(null);
    },
  );

  fastify.get(
    "/by-name",
    {
      schema: GetPlanByNameEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { projectId, environment, name, version } = request.query;

      const plans = await fastify.storage.plans.findMany({
        where: and(
          eq(plansTable.project, projectId),
          eq(plansTable.environment, environment),
          eq(plansTable.name, name),
        ),
        limit: 1,
      });

      if (plans.length === 0) {
        return reply.code(404).send({ error: "Plan not found" });
      }

      let plan = plans[0];

      // Migrate to latest if requested
      if (version === "latest" && plan.version !== CURRENT_PLAN_VERSION) {
        plan = migrateToLatest(plan as any) as typeof plan;
      }

      return reply.send({
        data: {
          ...plan,
          locations: plan.locations || [],
        },
      });
    },
  );
}
