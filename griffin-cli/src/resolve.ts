import { MonitorV1 } from "@griffin-app/griffin-hub-sdk";
import {
  MonitorDSL,
  migrateToLatest,
  CURRENT_MONITOR_VERSION,
} from "@griffin-app/griffin-ts";
import { resolveVariablesInMonitor } from "./core/variables.js";

export function resolveMonitor(
  monitor: MonitorDSL,
  projectId: string,
  envName: string,
  variables: Record<string, string>,
): Omit<MonitorV1, "id"> {
  // Migrate DSL monitor to latest version before resolving
  const migratedMonitor =
    monitor.version === CURRENT_MONITOR_VERSION
      ? monitor
      : (migrateToLatest(monitor) as MonitorDSL);

  const resolvedMonitor = resolveVariablesInMonitor(migratedMonitor, variables) as Omit<
    MonitorV1,
    "id" | "project" | "environment"
  >;
  return {
    ...resolvedMonitor,
    project: projectId,
    environment: envName,
  };
}
