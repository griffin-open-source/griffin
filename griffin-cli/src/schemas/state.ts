import { Type, type Static } from "typebox";

/**
 * State file schema for tracking project configuration
 * Stored in .griffin/state.json
 *
 * Note: The hub is now the source of truth for plans.
 * This file only stores configuration (project, environments, runner connection).
 */

export const EnvironmentConfigSchema = Type.Object({

});

export type EnvironmentConfig = Static<typeof EnvironmentConfigSchema>;

export const RunnerConfigSchema = Type.Object({
  baseUrl: Type.String(),
  apiToken: Type.Optional(Type.String()),
});

export type RunnerConfig = Static<typeof RunnerConfigSchema>;

export const DiscoveryConfigSchema = Type.Object({
  pattern: Type.Optional(Type.String()),
  ignore: Type.Optional(Type.Array(Type.String())),
});

export type DiscoveryConfig = Static<typeof DiscoveryConfigSchema>;

// State schema (hub is source of truth for plans)
export const StateFileSchema = Type.Object({
  stateVersion: Type.Literal(1),
  projectId: Type.String(),

  // Environment configuration
  environments: Type.Record(Type.String(), EnvironmentConfigSchema),
  defaultEnvironment: Type.Optional(Type.String()),

  // Runner connection (for remote execution)
  runner: Type.Optional(RunnerConfigSchema),

  // Discovery settings
  discovery: Type.Optional(DiscoveryConfigSchema),
});

export type StateFile = Static<typeof StateFileSchema>;

/**
 * Create an empty state file
 */
export function createEmptyState(projectId: string): StateFile {
  return {
    stateVersion: 1,
    projectId,
    environments: {},
  };
}

/**
 * Create state file with a default local environment
 */
export function createStateWithDefaultEnv(projectId: string): StateFile {
  return {
    stateVersion: 1,
    projectId,
    environments: {
      local: {},
    },
    defaultEnvironment: "local",
  };
}
