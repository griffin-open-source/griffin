import { PlanV1 } from "@griffin-app/griffin-hub-sdk";
import {
  PlanDSL,
  migrateToLatest,
  CURRENT_PLAN_VERSION,
} from "@griffin-app/griffin-ts";
import { resolveVariablesInPlan } from "./core/variables.js";

export function resolvePlan(
  plan: PlanDSL,
  projectId: string,
  envName: string,
  variables: Record<string, string>,
): Omit<PlanV1, "id"> {
  // Migrate DSL plan to latest version before resolving
  const migratedPlan =
    plan.version === CURRENT_PLAN_VERSION
      ? plan
      : (migrateToLatest(plan) as PlanDSL);

  const resolvedPlan = resolveVariablesInPlan(migratedPlan, variables) as Omit<
    PlanV1,
    "id" | "project" | "environment"
  >;
  return {
    ...resolvedPlan,
    project: projectId,
    environment: envName,
  };
}
