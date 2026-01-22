import { PlanApi, RunsApi, Configuration } from "@griffin-app/griffin-hub-sdk";
import type { TestPlanV1 } from "@griffin-app/griffin-ts/types";
/**
 * Create configured SDK API instances
 */
export function createSdkClients(config: {
  baseUrl: string;
  apiToken?: string;
}): {
  planApi: PlanApi;
  runsApi: RunsApi;
} {
  const configuration = new Configuration({
    basePath: config.baseUrl.replace(/\/$/, ""), // Remove trailing slash
    accessToken: config.apiToken,
  });

  return {
    planApi: new PlanApi(configuration),
    runsApi: new RunsApi(configuration),
  };
}

/**
 * Inject projectId into a plan payload before sending to runner
 */
export function injectProjectId(
  plan: Omit<TestPlanV1, "project">,
  projectId: string,
): TestPlanV1 {
  return {
    ...plan,
    project: projectId,
  };
}
