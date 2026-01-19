import { Type, type Static } from "typebox";
import { StringEnum } from "./shared.js";

export enum JobRunStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum TriggerType {
  SCHEDULE = "schedule",
  MANUAL = "manual",
  API = "api",
}

export const JobRunStatusSchema = StringEnum(
  [
    JobRunStatus.PENDING,
    JobRunStatus.RUNNING,
    JobRunStatus.COMPLETED,
    JobRunStatus.FAILED,
  ],
  { $id: "JobRunStatus" },
);

export const TriggerTypeSchema = StringEnum(
  [TriggerType.SCHEDULE, TriggerType.MANUAL, TriggerType.API],
  { $id: "TriggerType" },
);

export const JobRunSchema = Type.Object({
  id: Type.Readonly(Type.String()),
  planId: Type.String(),
  executionGroupId: Type.String(),
  location: Type.String(),
  environment: Type.String(),
  status: JobRunStatusSchema,
  triggeredBy: TriggerTypeSchema,
  startedAt: Type.String({ format: "date-time" }),
  completedAt: Type.Optional(Type.String({ format: "date-time" })),
  duration_ms: Type.Optional(Type.Number()),
  success: Type.Optional(Type.Boolean()),
  errors: Type.Optional(Type.Array(Type.String())),
});

export type JobRun = Static<typeof JobRunSchema>;
