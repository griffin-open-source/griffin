import {
  TestPlanV1Schema,
  NodeSchema,
  EdgeSchema,
  FrequencySchema,
  EndpointSchema,
  WaitSchema,
  AssertionSchema,
  AssertionsSchema,
  HttpMethodSchema,
  ResponseFormatSchema,
  BinaryPredicateOperatorSchema,
} from "griffin/schema";
import { TestPlanV1 } from "griffin/types";
import { Type } from "typebox";
import { FastifyTypeBox } from "../../types.js";
import {
  Ref,
  ErrorResponseOpts,
  PaginatedResponseSchema,
  PaginationRequestOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";

export const CreatePlanEndpoint = {
  tags: ["plan"],
  body: Ref(TestPlanV1Schema),
  response: {
    201: SuccessResponseSchema(Ref(TestPlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export const ListPlansEndpoint = {
  tags: ["plan"],
  querystring: Type.Object({
    projectId: Type.Optional(Type.String()),
    ...PaginationRequestOpts,
  }),
  response: {
    200: PaginatedResponseSchema(Ref(TestPlanV1Schema)),
    ...ErrorResponseOpts,
  },
};

export default function (fastify: FastifyTypeBox) {
  fastify.addSchema(TestPlanV1Schema);
  fastify.addSchema(NodeSchema);
  fastify.addSchema(EdgeSchema);
  fastify.addSchema(FrequencySchema);
  fastify.addSchema(EndpointSchema);
  fastify.addSchema(HttpMethodSchema);
  fastify.addSchema(ResponseFormatSchema);
  fastify.addSchema(WaitSchema);
  fastify.addSchema(AssertionsSchema);
  fastify.addSchema(AssertionSchema);

  //fastify.addSchema(UnaryPredicateSchema);
  fastify.addSchema(BinaryPredicateOperatorSchema);
  //fastify.addSchema(AssertionsSchema);
  //fastify.addSchema(EdgeSchema);

  fastify.post(
    "/",
    {
      schema: CreatePlanEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
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
      } else {
        // If no locations specified, ensure at least one agent exists
        const allLocations = await fastify.agentRegistry.getAllLocations();
        if (allLocations.length === 0) {
          return reply.code(400).send({
            error:
              "No agent locations registered. Register at least one agent before applying plans.",
          });
        }
      }

      // Store the plan using the repository
      const planRepo = fastify.repository.repository<TestPlanV1>("plans");
      const savedPlan = await planRepo.create(planData);

      return reply.code(201).send({ data: savedPlan });
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
      const { projectId, limit = 50, offset = 0 } = request.query;

      const planRepo = fastify.repository.repository<TestPlanV1>("plans");
      const plans = await planRepo.findMany({
        filter: { project: projectId },
        limit,
        offset,
      });
      const total = await planRepo.count({ project: projectId });
      return reply.send({
        data: plans,
        total,
        limit,
        page: offset / limit + 1,
      });
    },
  );
}
