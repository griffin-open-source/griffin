import "tsx";
import { Value } from "typebox/value";
import {
  executePlanV1,
  AxiosAdapter,
  ExecutionResult,
  EnvSecretProvider,
  SecretProviderRegistry,
} from "@griffin-app/griffin-plan-executor";
import { TestPlanV1Schema } from "@griffin-app/griffin-ts/schema";
import { Type } from "typebox";
import { randomUUID } from "crypto";
import { loadVariables, resolveVariablesInPlan } from "./core/variables.js";
import { getProjectId } from "./core/state.js";

const RawTestSchema = Type.Omit(TestPlanV1Schema, [
  "id",
  "environment",
  "project",
]);

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
  const rawPlan = defaultExport.default;

  console.log(`Project ID: ${projectId}`);
  // Resolve all variable references in the plan
  const resolvedPlan = resolveVariablesInPlan(rawPlan, variables);

  const secretRegistry = new SecretProviderRegistry();
  secretRegistry.register(new EnvSecretProvider());

  try {
    const parsedPlan = Value.Parse(RawTestSchema, resolvedPlan);
    const syntheticPlan = {
      ...parsedPlan,
      id: randomUUID(),
      project: projectId,
      environment: envName,
    };
    const result = await executePlanV1(syntheticPlan, "default-org", {
      mode: "local",
      httpClient: new AxiosAdapter(),
      secretRegistry: secretRegistry,
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    const errors = Value.Errors(RawTestSchema, resolvedPlan);
    throw new Error(
      `Invalid plan: ${JSON.stringify([...errors], null, 2)}: ${error}`,
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
