import fs from "node:fs/promises";
import path from "node:path";
import { Value } from "typebox/value";
import {
  StateFileSchema,
  type StateFile,
  createEmptyState,
  type EnvironmentConfig,
} from "../schemas/state.js";

export const STATE_DIR = ".griffin";
export const STATE_FILE = "state.json";

/**
 * Get the state directory path (in current working directory)
 */
export function getStateDirPath(): string {
  return path.join(process.cwd(), STATE_DIR);
}

/**
 * Get the state file path
 */
export function getStateFilePath(): string {
  return path.join(getStateDirPath(), STATE_FILE);
}

/**
 * Check if state file exists
 */
export async function stateExists(): Promise<boolean> {
  try {
    await fs.access(getStateFilePath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Load state file from disk
 * Throws if file doesn't exist or is invalid
 */
export async function loadState(): Promise<StateFile> {
  const stateFilePath = getStateFilePath();

  try {
    const content = await fs.readFile(stateFilePath, "utf-8");
    const data = JSON.parse(content);

    // Check if it's v1
    if (Value.Check(StateFileSchema, data)) {
      return data;
    }

    // Invalid schema
    const errors = [...Value.Errors(StateFileSchema, data)];
    throw new Error(
      `Invalid state file schema:\n${errors.map((e) => `  - ${(e as any).path || "unknown"}: ${e.message}`).join("\n")}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `State file not found. Run 'griffin init' first.\nExpected: ${stateFilePath}`,
      );
    }
    throw error;
  }
}

/**
 * Save state file to disk
 */
export async function saveState(state: StateFile): Promise<void> {
  const stateDirPath = getStateDirPath();
  const stateFilePath = getStateFilePath();

  // Ensure directory exists
  await fs.mkdir(stateDirPath, { recursive: true });

  // Validate before saving
  if (!Value.Check(StateFileSchema, state)) {
    const errors = [...Value.Errors(StateFileSchema, state)];
    throw new Error(
      `Invalid state data:\n${errors.map((e) => `  - ${(e as any).path || "unknown"}: ${e.message}`).join("\n")}`,
    );
  }

  // Write with pretty formatting
  await fs.writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Initialize a new state file
 */
export async function initState(projectId: string): Promise<void> {
  if (await stateExists()) {
    throw new Error(
      `State file already exists: ${getStateFilePath()}\nUse 'griffin plan' to see current state.`,
    );
  }

  const state = createEmptyState(projectId);
  await saveState(state);
}

/**
 * Add or update an environment
 */
export async function addEnvironment(
  name: string,
  config: EnvironmentConfig,
): Promise<void> {
  const state = await loadState();

  state.environments[name] = config;

  // Set as default if it's the first environment
  if (Object.keys(state.environments).length === 1) {
    state.defaultEnvironment = name;
  }

  await saveState(state);
}

/**
 * Remove an environment
 */
export async function removeEnvironment(name: string): Promise<void> {
  const state = await loadState();

  if (!(name in state.environments)) {
    throw new Error(`Environment '${name}' does not exist`);
  }

  delete state.environments[name];

  // Update default if we removed it
  if (state.defaultEnvironment === name) {
    const remaining = Object.keys(state.environments);
    state.defaultEnvironment = remaining.length > 0 ? remaining[0] : undefined;
  }

  await saveState(state);
}

/**
 * Set the default environment
 */
export async function setDefaultEnvironment(name: string): Promise<void> {
  const state = await loadState();

  if (!(name in state.environments)) {
    throw new Error(`Environment '${name}' does not exist`);
  }

  state.defaultEnvironment = name;
  await saveState(state);
}

/**
 * Get the current environment name (from flag, env var, or default)
 */
export async function resolveEnvironment(envFlag?: string): Promise<string> {
  const state = await loadState();

  // Priority: CLI flag > ENV var > default > error
  const envName =
    envFlag || process.env.GRIFFIN_ENV || state.defaultEnvironment;

  if (!envName) {
    throw new Error(
      "No environment specified. Pass the environment name as the first argument (e.g. griffin hub apply production). You can also set GRIFFIN_ENV or a default with 'griffin env default <name>'.",
    );
  }

  if (!(envName in state.environments)) {
    throw new Error(
      `Environment '${envName}' not found. Available: ${Object.keys(state.environments).join(", ")}`,
    );
  }

  return envName;
}

/**
 * Get environment configuration
 */
export async function getEnvironment(name: string): Promise<EnvironmentConfig> {
  const state = await loadState();

  if (!(name in state.environments)) {
    throw new Error(`Environment '${name}' does not exist`);
  }

  return state.environments[name];
}

/**
 * Get the project ID
 */
export async function getProjectId(): Promise<string> {
  const state = await loadState();
  return state.projectId;
}
