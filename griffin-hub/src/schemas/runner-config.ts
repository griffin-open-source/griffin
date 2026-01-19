import { Type, Static } from "typebox";

/**
 * Target entry schema (key-value pair for target key to base URL)
 */
export const TargetEntrySchema = Type.Record(Type.String(), Type.String());

/**
 * Runner config schema for responses
 */
export const RunnerConfigSchema = Type.Object({
  id: Type.String(),
  organizationId: Type.String(),
  environment: Type.String(),
  targets: TargetEntrySchema,
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export type RunnerConfig = Static<typeof RunnerConfigSchema>;

/**
 * Create runner config request body
 */
export const CreateRunnerConfigBodySchema = Type.Object({
  organizationId: Type.String({ minLength: 1 }),
  environment: Type.String({ minLength: 1 }),
  targets: TargetEntrySchema,
});

export type CreateRunnerConfigBody = Static<
  typeof CreateRunnerConfigBodySchema
>;

/**
 * Update runner config request body
 */
export const UpdateRunnerConfigBodySchema = Type.Object({
  targets: Type.Optional(TargetEntrySchema),
});

export type UpdateRunnerConfigBody = Static<
  typeof UpdateRunnerConfigBodySchema
>;

/**
 * Query parameters for listing runner configs
 */
export const RunnerConfigQuerySchema = Type.Object({
  organizationId: Type.Optional(Type.String()),
  environment: Type.Optional(Type.String()),
});

export type RunnerConfigQuery = Static<typeof RunnerConfigQuerySchema>;

/**
 * Query parameters for setting a single target
 */
export const SetTargetBodySchema = Type.Object({
  baseUrl: Type.String({ minLength: 1, format: "uri" }),
});

export type SetTargetBody = Static<typeof SetTargetBodySchema>;

/**
 * URL parameters for target operations
 */
export const TargetParamsSchema = Type.Object({
  organizationId: Type.String(),
  environment: Type.String(),
  targetKey: Type.String(),
});

export type TargetParams = Static<typeof TargetParamsSchema>;
