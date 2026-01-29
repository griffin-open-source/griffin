import "tsx";
import { Value } from "typebox/value";
import {
  executeMonitorV1,
  AxiosAdapter,
  ExecutionResult,
  EnvSecretProvider,
  SecretProviderRegistry,
} from "@griffin-app/griffin-plan-executor";
import { MonitorDSLSchema } from "@griffin-app/griffin-ts/schema";
import { randomUUID } from "crypto";
import { loadVariables } from "./core/variables.js";
import { getProjectId } from "./core/state.js";
import { MonitorDSL } from "@griffin-app/griffin-ts/types";
import { resolveMonitor } from "./resolve.js";
import { terminal } from "./utils/terminal.js";

function validateDsl(monitor: unknown): MonitorDSL {
  const errors = Value.Errors(MonitorDSLSchema, monitor);
  if (errors.length > 0) {
    throw new Error(`Invalid monitor: ${JSON.stringify([...errors], null, 2)}`);
  }
  return monitor as MonitorDSL;
}

/**
 * Runs a TypeScript test file and executes the resulting JSON monitor.
 */
export async function runTestFile(
  filePath: string,
  envName: string,
): Promise<ExecutionResult> {
  const variables = await loadVariables(envName);
  const projectId = await getProjectId();
  const defaultExport = await import(filePath);
  const rawMonitor = validateDsl(defaultExport.default);

  terminal.dim(`Project ID: ${projectId}`);
  const resolvedMonitor = resolveMonitor(rawMonitor, projectId, envName, variables);
  const secretRegistry = new SecretProviderRegistry();
  secretRegistry.register(new EnvSecretProvider());

  try {
    const result = await executeMonitorV1(
      {
        ...resolvedMonitor,
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
      `Error executing monitor: ${error instanceof Error ? error.message : String(error)}`,
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
