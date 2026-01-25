// Export core types and utilities
export type { StateFile, HubConfig } from "./schemas/state.js";
export type { CredentialsFile, HubCredentials } from "./schemas/credentials.js";
export type {
  DiscoveredPlan,
  DiscoveryResult,
  DiscoveryError,
} from "./core/discovery.js";
export type { DiffAction, DiffResult } from "./core/diff.js";
export type { ApplyResult, ApplyAction, ApplyError } from "./core/apply.js";

// Export core functions
export {
  createEmptyState,
  StateFileSchema,
  HubConfigSchema,
} from "./schemas/state.js";

export {
  createEmptyCredentials,
  CredentialsFileSchema,
  HubCredentialsSchema,
} from "./schemas/credentials.js";

export {
  getStateDirPath,
  getStateFilePath,
  stateExists,
  loadState,
  saveState,
  initState,
  addEnvironment,
  removeEnvironment,
  setDefaultEnvironment,
  resolveEnvironment,
  getEnvironment,
} from "./core/state.js";

export {
  getCredentialsDirPath,
  getCredentialsFilePath,
  credentialsExist,
  loadCredentials,
  saveCredentials,
  saveHubCredentials,
  getHubCredentials,
  removeHubCredentials,
} from "./core/credentials.js";

export { discoverPlans, formatDiscoveryErrors } from "./core/discovery.js";

export { computeDiff, formatDiff, formatDiffJson } from "./core/diff.js";

export { applyDiff, formatApplyResult } from "./core/apply.js";

export { createSdk, createSdkWithCredentials } from "./core/sdk.js";

export { detectProjectId } from "./core/project.js";

// Export command executors (for programmatic use)
export { executeInit } from "./commands/init.js";
export { executeValidate } from "./commands/validate.js";
export { executeGenerateKey } from "./commands/generate-key.js";

// Local commands
export { executeRunLocal } from "./commands/local/run.js";

// Hub commands
export { executeConnect } from "./commands/hub/connect.js";
export { executeStatus } from "./commands/hub/status.js";
export { executeRuns } from "./commands/hub/runs.js";
export { executePlan } from "./commands/hub/plan.js";
export { executeApply } from "./commands/hub/apply.js";
export { executeRun } from "./commands/hub/run.js";
export { executeLogin } from "./commands/hub/login.js";
export { executeLogout } from "./commands/hub/logout.js";
