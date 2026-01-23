import "tsx";
import { Value } from "typebox/value";
import {
  executePlanV1,
  AxiosAdapter,
  ExecutionResult,
  EnvSecretProvider,
  SecretProviderRegistry,
} from "@griffin-app/griffin-plan-executor";
import { PlanDSLSchema } from "@griffin-app/griffin-ts/schema";
import { randomUUID } from "crypto";
import { loadVariables } from "./core/variables.js";
import { getProjectId } from "./core/state.js";
import { PlanDSL } from "@griffin-app/griffin-ts/types";
import { resolvePlan } from "./resolve.js";
import { terminal } from "./utils/terminal.js";

function validateDsl(plan: unknown): PlanDSL {
  const errors = Value.Errors(PlanDSLSchema, plan);
  if (errors.length > 0) {
    throw new Error(`Invalid plan: ${JSON.stringify([...errors], null, 2)}`);
  }
  return plan as PlanDSL;
}

/**
 * Runs a TypeScript test file and executes the resulting JSON plan.
 */
export async function runTestFile(
  filePath: string,
  envName: string,
): Promise<ExecutionResult> {
  const variables = await loadVariables(envName);
  const projectId = await getProjectId();
  const defaultExport = await import(filePath);
  const rawPlan = validateDsl(defaultExport.default);

  terminal.dim(`Project ID: ${projectId}`);
  const resolvedPlan = resolvePlan(rawPlan, projectId, envName, variables);
  const secretRegistry = new SecretProviderRegistry();
  secretRegistry.register(new EnvSecretProvider());

  try {
    const result = await executePlanV1(
      {
        ...resolvedPlan,
        id: randomUUID(),
      },
      "default-org",
      {
        mode: "local",
        httpClient: new AxiosAdapter(),
        secretRegistry: secretRegistry,
      },
    );
    return result;
  } catch (error) {
    throw new Error(
      `Error executing plan: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

//function findWorkspaceRoot(): string {
//  let current = process.cwd();
//  while (current !== path.dirname(current)) {
//    const testCliPath = path.join(current, "griffin-cli");
//    const testSystemPath = path.join(current, "griffin-ts");
//    if (fs.existsSync(testCliPath) && fs.existsSync(testSystemPath)) {
//      return current;
//    }
//    current = path.dirname(current);
//  }
//  return process.cwd();
//}
