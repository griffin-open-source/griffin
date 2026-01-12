import { TestPlanV1Schema, type TestPlanV1 } from "../../schemas/plan.js";
import { FastifyTypeBox } from "../../types.js";

export const CreatePlanEndpoint = {
  body: TestPlanV1Schema,
  response: {
    201: TestPlanV1Schema,
  },
};

export default function (fastify: FastifyTypeBox) {
  fastify.post(
    "/plan",
    {
      schema: CreatePlanEndpoint,
    },
    async (request, reply) => {
      const planData = request.body;

      // Store the plan using the repository
      const planRepo = fastify.repository.repository<TestPlanV1>("plans");
      const savedPlan = await planRepo.create(planData);

      return reply.code(201).send(savedPlan);
    },
  );
}
