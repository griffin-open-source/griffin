/**
 * Variable reference utilities for griffin DSL.
 *
 * Variables are resolved at evaluation time (when the CLI imports test files)
 * by reading from variables.yaml. The resolved values are baked into the plan.
 */

/**
 * A variable reference that will be resolved at evaluation time.
 */
export interface VariableRef {
  $variable: {
    key: string;
    template?: string;
  };
}

/**
 * Create a variable reference that will be resolved from variables.yaml.
 *
 * Variables are resolved when the CLI evaluates the test file, so the final
 * plan contains resolved string values rather than variable references.
 *
 * @param key - The variable key to look up in variables.yaml
 * @returns A variable reference object
 *
 * @example
 * ```typescript
 * // Simple variable reference
 * builder.addNode("check", HttpRequest({
 *   method: GET,
 *   path: "/health",
 *   base: variable("api-service"),
 *   response_format: JSON
 * }));
 * ```
 */
export function variable(key: string): VariableRef;

/**
 * Create a variable reference with a template for string interpolation.
 *
 * The template uses ${key} syntax where 'key' is the variable name.
 *
 * @param key - The variable key to look up in variables.yaml
 * @param template - Template string with ${key} placeholders
 * @returns A variable reference object
 *
 * @example
 * ```typescript
 * // Template interpolation
 * builder.addNode("versioned", Endpoint({
 *   method: GET,
 *   path: variable("api-version", "/api/${api-version}/health"),
 *   base: variable("api-service"),
 *   response_format: JSON
 * }));
 * ```
 */
export function variable(key: string, template: string): VariableRef;

export function variable(key: string, template?: string): VariableRef {
  if (!key || typeof key !== "string") {
    throw new Error(`Variable key must be a non-empty string. Got: ${key}`);
  }

  if (key.trim() === "") {
    throw new Error("Variable key cannot be empty or whitespace only");
  }

  if (template !== undefined) {
    if (typeof template !== "string") {
      throw new Error(
        `Variable template must be a string. Got: ${typeof template}`,
      );
    }

    if (template.trim() === "") {
      throw new Error("Variable template cannot be empty or whitespace only");
    }

    // Validate that template contains the variable key
    const placeholder = `\${${key}}`;
    if (!template.includes(placeholder)) {
      throw new Error(
        `Variable template must contain \${${key}} placeholder. Got: ${template}`,
      );
    }
  }

  return {
    $variable: {
      key: key.trim(),
      ...(template && { template }),
    },
  };
}

/**
 * Type guard to check if a value is a variable reference.
 */
export function isVariableRef(value: unknown): value is VariableRef {
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
