import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

interface VariablesConfig {
  environments: Record<string, Record<string, string>>;
}

interface VariableRef {
  $variable: {
    key: string;
    template?: string;
  };
}

/**
 * Load variables from variables.yaml for a specific environment.
 *
 * @param envName - The environment name to load variables for
 * @returns Record of variable key-value pairs
 * @throws Error if variables.yaml doesn't exist or environment not found
 */
export async function loadVariables(
  envName: string,
): Promise<Record<string, string>> {
  const yamlPath = path.join(process.cwd(), "variables.yaml");

  try {
    const content = await fs.readFile(yamlPath, "utf-8");
    const config: VariablesConfig = parse(content);

    if (!config.environments) {
      throw new Error(
        `Invalid variables.yaml: missing "environments" key.\nExpected format:\nenvironments:\n  ${envName}:\n    key: value`,
      );
    }

    if (!config.environments[envName]) {
      const availableEnvs = Object.keys(config.environments);
      throw new Error(
        `Environment "${envName}" not found in variables.yaml.\nAvailable environments: ${availableEnvs.join(", ")}`,
      );
    }

    return config.environments[envName];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `variables.yaml not found in ${process.cwd()}.\nCreate one with:\nenvironments:\n  ${envName}:\n    my-variable: my-value`,
      );
    }
    throw error;
  }
}

/**
 * Check if a value is a variable reference.
 */
function isVariableRef(value: unknown): value is VariableRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (
    !("$variable" in obj) ||
    typeof obj.$variable !== "object" ||
    obj.$variable === null
  ) {
    return false;
  }

  const varData = obj.$variable as Record<string, unknown>;
  return (
    typeof varData.key === "string" &&
    (varData.template === undefined || typeof varData.template === "string")
  );
}

/**
 * Resolve a single variable reference to its string value.
 *
 * @param varRef - Variable reference to resolve
 * @param variables - Map of variable key-value pairs
 * @returns Resolved string value
 */
function resolveVariable(
  varRef: VariableRef,
  variables: Record<string, string>,
): string {
  const { key, template } = varRef.$variable;

  const value = variables[key];
  if (value === undefined) {
    const availableKeys = Object.keys(variables);
    throw new Error(
      `Variable "${key}" not found.\nAvailable variables: ${availableKeys.join(", ")}`,
    );
  }

  // If no template, return the value directly
  if (!template) {
    return value;
  }

  // Replace ${key} with the value in the template
  const placeholder = `\${${key}}`;
  return template.replace(placeholder, value);
}

/**
 * Recursively walk a plan object and resolve all variable references.
 *
 * This function deeply traverses the plan structure, replacing any
 * { $variable: { key, template? } } objects with resolved string values.
 *
 * @param obj - The plan object or value to resolve
 * @param variables - Map of variable key-value pairs
 * @returns The plan with all variables resolved to strings
 */
export function resolveVariablesInPlan(
  obj: unknown,
  variables: Record<string, string>,
): unknown {
  // Check if this is a variable reference
  if (isVariableRef(obj)) {
    return resolveVariable(obj, variables);
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariablesInPlan(item, variables));
  }

  // Recursively process objects
  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveVariablesInPlan(value, variables);
    }
    return result;
  }

  // Return primitives as-is
  return obj;
}
