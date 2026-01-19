import { Type } from "typebox";
import { FastifyTypeBox } from "../../types.js";
import {
  RunnerConfigSchema,
  CreateRunnerConfigBodySchema,
  UpdateRunnerConfigBodySchema,
  RunnerConfigQuerySchema,
  SetTargetBodySchema,
  TargetParamsSchema,
} from "../../schemas/runner-config.js";
import {
  ErrorResponseOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";
import { RunnerConfigService } from "../../services/runner-config.js";
import type { RunnerConfig } from "../../schemas/runner-config.js";

export const SetTargetEndpoint = {
  tags: ["config"],
  params: TargetParamsSchema,
  body: SetTargetBodySchema,
  response: {
    200: SuccessResponseSchema(RunnerConfigSchema),
    ...ErrorResponseOpts,
  },
};

export const GetTargetEndpoint = {
  tags: ["config"],
  params: TargetParamsSchema,
  response: {
    200: SuccessResponseSchema(Type.Object({ baseUrl: Type.String() })),
    ...ErrorResponseOpts,
  },
};

export const DeleteTargetEndpoint = {
  tags: ["config"],
  params: TargetParamsSchema,
  response: {
    204: Type.Null(),
    ...ErrorResponseOpts,
  },
};

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
   * Set a target for an organization and environment
   * PUT /config/:organizationId/:environment/targets/:targetKey
   */
  fastify.put(
    "/:organizationId/:environment/targets/:targetKey",
    {
      schema: SetTargetEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { organizationId, environment, targetKey } = request.params;
      const { baseUrl } = request.body;

      const config = await configService.setTarget(
        organizationId,
        environment,
        targetKey,
        baseUrl,
      );

      return reply.send({ data: config });
    },
  );

  /**
   * Get a target for an organization and environment
   * GET /config/:organizationId/:environment/targets/:targetKey
   */
  fastify.get(
    "/:organizationId/:environment/targets/:targetKey",
    {
      schema: GetTargetEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { organizationId, environment, targetKey } = request.params;

      const baseUrl = await configService.getTarget(
        organizationId,
        environment,
        targetKey,
      );

      if (!baseUrl) {
        return reply.code(404).send({
          error: "Not Found",
        });
      }

      return reply.send({ data: { baseUrl } });
    },
  );

  /**
   * Delete a target from an organization and environment
   * DELETE /config/:organizationId/:environment/targets/:targetKey
   */
  fastify.delete(
    "/:organizationId/:environment/targets/:targetKey",
    {
      schema: DeleteTargetEndpoint,
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { organizationId, environment, targetKey } = request.params;

      const deleted = await configService.deleteTarget(
        organizationId,
        environment,
        targetKey,
      );

      if (!deleted) {
        return reply.notFound(
          `Target "${targetKey}" not found for organization "${organizationId}" in environment "${environment}"`,
        );
      }

      return reply.code(204).send();
    },
  );

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
