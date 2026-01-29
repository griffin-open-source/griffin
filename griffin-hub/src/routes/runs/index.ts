import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import {
  JobRunSchema,
  JobRunStatus,
  JobRunStatusSchema,
  TriggerType,
  type JobRun,
} from "../../schemas/job-run.js";
import { FastifyTypeBox } from "../../types.js";
import {
  ErrorResponseOpts,
  PaginatedResponseSchema,
  PaginationRequestOpts,
  SuccessResponseSchema,
} from "../../schemas/shared.js";
import { eq, and, desc } from "drizzle-orm";
import { runsTable } from "../../storage/adapters/postgres/schema.js";
import { utcNow } from "../../utils/dates.js";

// Query parameters for listing runs
const ListRunsQuerySchema = Type.Object({
  monitorId: Type.Optional(Type.String()),
  status: Type.Optional(JobRunStatusSchema),
  ...PaginationRequestOpts,
});

const GetRunResponseSchema = JobRunSchema;

const TriggerExecutionParamsSchema = Type.Object({
  monitorId: Type.String(),
});

const TriggerExecutionBodySchema = Type.Object({
  environment: Type.String({ minLength: 1 }),
});

export default function (fastify: FastifyTypeBox) {
  /**
   * GET /runs
   * List all job runs with optional filtering
   */
  fastify.get(
    "/",
    {
      schema: {
        querystring: ListRunsQuerySchema,
        tags: ["runs"],
        response: {
          200: PaginatedResponseSchema(JobRunSchema),
          ...ErrorResponseOpts,
        },
      },
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { monitorId, status, limit = 50, offset = 0 } = request.query;

      // Build filter conditions
      const conditions = [];
      if (monitorId) conditions.push(eq(runsTable.monitorId, monitorId));
      if (status) conditions.push(eq(runsTable.status, status));

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Get runs with pagination
      const runs = await fastify.storage.runs.findMany({
        where: whereClause,
        orderBy: [desc(runsTable.startedAt)],
        limit,
        offset,
      });

      // Get total count
      const total = await fastify.storage.runs.count(whereClause);

      return reply.send({
        data: runs,
        total,
        limit,
        page: offset / limit + 1,
      });
    },
  );

  /**
   * GET /runs/:id
   * Get a specific job run by ID
   */
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["runs"],
        params: Type.Object({
          id: Type.String(),
        }),
        response: {
          200: SuccessResponseSchema(JobRunSchema),
          ...ErrorResponseOpts,
        },
      },
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const jobRun = await fastify.storage.runs.findById(id);

      if (!jobRun) {
        return reply.code(404).send({
          error: `Job run not found: ${id}`,
        });
      }

      return reply.send({ data: jobRun });
    },
  );

  /**
   * PATCH /runs/:id
   * Update a job run (used by agents to report results)
   */
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["runs"],
        params: Type.Object({
          id: Type.String(),
        }),
        body: Type.Object({
          status: Type.Optional(JobRunStatusSchema),
          completedAt: Type.Optional(Type.String({ format: "date-time" })),
          duration_ms: Type.Optional(Type.Number()),
          success: Type.Optional(Type.Boolean()),
          errors: Type.Optional(Type.Array(Type.String())),
        }),
        response: {
          200: SuccessResponseSchema(JobRunSchema),
          ...ErrorResponseOpts,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      const jobRun = await fastify.storage.runs.findById(id);
      if (!jobRun) {
        return reply.code(404).send({
          error: `Job run not found: ${id}`,
        });
      }

      const updatedJobRun = await fastify.storage.runs.update(id, updates);

      return reply.send({ data: updatedJobRun });
    },
  );

  /**
   * POST /runs/trigger/:monitorId
   * Manually trigger a monitor execution
   */
  fastify.post(
    "/trigger/:monitorId",
    {
      schema: {
        tags: ["runs"],
        params: TriggerExecutionParamsSchema,
        body: TriggerExecutionBodySchema,
        response: {
          200: SuccessResponseSchema(JobRunSchema),
          ...ErrorResponseOpts,
        },
      },
      config: {
        auth: { required: true },
      },
    },
    async (request, reply) => {
      const { monitorId } = request.params;
      const { environment } = request.body;
      const queue = fastify.jobQueue.queue("monitor-executions");

      // Check if monitor exists
      const monitor = await fastify.storage.monitors.findById(monitorId);
      if (!monitor) {
        return reply.code(404).send({
          error: `Monitor not found: ${monitorId}`,
        });
      }

      // Create a JobRun record
      const now = utcNow();
      const executionGroupId = randomUUID();
      // TODO: Phase 2 - Resolve location from agent registry
      const location = "local";

      const jobRun = await fastify.storage.runs.create({
        monitorId: monitor.id,
        executionGroupId,
        location,
        environment,
        status: JobRunStatus.PENDING,
        triggeredBy: TriggerType.MANUAL,
        startedAt: now,
      });

      // Enqueue the job
      await queue.enqueue(
        {
          type: "execute-monitor",
          monitorId: monitor.id,
          jobRunId: jobRun.id,
          environment,
          scheduledAt: now,
        },
        {
          location,
          maxAttempts: 3,
        },
      );

      return reply.send({
        data: jobRun,
      });
    },
  );
}
