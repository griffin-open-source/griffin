import { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import { PlanDSL } from "@griffin-app/griffin-ts/types";
import { resolveVariablesInPlan } from "./core/variables.js";

export function resolvePlan(
  plan: PlanDSL,
  projectId: string,
  envName: string,
  variables: Record<string, string>,
): Omit<PlanV1, "id"> {
  const resolvedPlan = resolveVariablesInPlan(plan, variables) as Omit<
    PlanV1,
    "id" | "project" | "environment"
  >;
  return {
    ...resolvedPlan,
    project: projectId,
    environment: envName,
  };
}
