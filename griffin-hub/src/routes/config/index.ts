import { Type } from "typebox";
import { FastifyTypeBox } from "../../types.js";
import {
  RunnerConfigSchema,
  RunnerConfigQuerySchema,
} from "../../schemas/runner-config.js";
import {
  ErrorResponseOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";
import { RunnerConfigService } from "../../services/runner-config.js";
import type { RunnerConfig } from "../../schemas/runner-config.js";

export const ListConfigsEndpoint = {
  tags: ["config"],
  querystring: RunnerConfigQuerySchema,
  response: {
    200: SuccessResponseSchema(Type.Array(RunnerConfigSchema)),
    ...ErrorResponseOpts,
  },
};

export const GetConfigEndpoint = {
  tags: ["config"],
  querystring: Type.Object({
    organizationId: Type.String(),
    environment: Type.String(),
  }),
  response: {
    200: SuccessResponseSchema(RunnerConfigSchema),
    ...ErrorResponseOpts,
  },
};

export default function (fastify: FastifyTypeBox) {
  const configRepo =
    fastify.repository.repository<RunnerConfig>("runner_configs");
  const configService = new RunnerConfigService(configRepo);

  /**
   * List all runner configs with optional filtering
   * GET /config
   */
  fastify.get(
    "/",
    {
      schema: ListConfigsEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { organizationId, environment } = request.query;

      const configs = await configService.list({
        organizationId,
        environment,
      });

      return reply.send({ data: configs });
    },
  );

  /**
   * Get a specific runner config by organization and environment
   * GET /config/single
   */
  fastify.get(
    "/single",
    {
      schema: GetConfigEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { organizationId, environment } = request.query;

      const config = await configService.findOne(organizationId, environment);

      if (!config) {
        return reply.notFound(
          `Runner config not found for organization "${organizationId}" in environment "${environment}"`,
        );
      }

      return reply.send({ data: config });
    },
  );
}
