import { Type, Static } from "typebox";

/**
 * Runner config schema for responses
 */
export const RunnerConfigSchema = Type.Object({
  id: Type.String(),
  organizationId: Type.String(),
  environment: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export type RunnerConfig = Static<typeof RunnerConfigSchema>;

/**
 * Query parameters for listing runner configs
 */
export const RunnerConfigQuerySchema = Type.Object({
  organizationId: Type.Optional(Type.String()),
  environment: Type.Optional(Type.String()),
});

export type RunnerConfigQuery = Static<typeof RunnerConfigQuerySchema>;
