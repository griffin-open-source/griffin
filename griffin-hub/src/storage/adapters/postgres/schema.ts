import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { type Frequency, type Node } from "../../../schemas/monitors.js";
import { type Edge } from "@griffin-app/griffin-ts/types";
import { JobStatus } from "../../../job-queue/ports.js";
import { JobRunStatus, TriggerType } from "../../../schemas/job-run.js";
import { AgentStatus } from "../../../schemas/agent.js";

export const triggerTypeEnum = pgEnum("trigger_type", [
  TriggerType.SCHEDULE,
  TriggerType.MANUAL,
  TriggerType.API,
]);
export const jobRunStatusEnum = pgEnum("job_run_status", [
  JobRunStatus.PENDING,
  JobRunStatus.RUNNING,
  JobRunStatus.COMPLETED,
  JobRunStatus.FAILED,
]);
export const jobQueueStatusEnum = pgEnum("job_queue_status", [
  JobStatus.PENDING,
  JobStatus.RUNNING,
  JobStatus.COMPLETED,
  JobStatus.FAILED,
  JobStatus.RETRYING,
]);
export const agentStatusEnum = pgEnum("agent_status", [
  AgentStatus.ONLINE,
  AgentStatus.OFFLINE,
]);

export const monitorsTable = pgTable("monitors", {
  organization: text("organization").notNull(),
  project: text("project").notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  frequency: jsonb("frequency").$type<Frequency>().notNull(),
  locations: jsonb("locations").$type<string[]>(),
  nodes: jsonb("nodes").$type<Node[]>().notNull(),
  edges: jsonb("edges").$type<Edge[]>().notNull(),
  environment: text("environment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runsTable = pgTable("runs", {
  id: text("id").primaryKey(),
  monitorId: text("monitor_id")
    .references(() => monitorsTable.id)
    .notNull(),
  executionGroupId: text("execution_group_id").notNull(),
  location: text("location").notNull(),
  environment: text("environment").notNull(),
  triggeredBy: triggerTypeEnum("triggered_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: jobRunStatusEnum("status").notNull(),
  duration_ms: integer("duration_ms"),
  success: boolean("success"),
  errors: jsonb("errors").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueName: text("queue_name").notNull().default("default"),
  data: jsonb("data").$type<unknown>().notNull(),
  location: text("location").notNull(),
  status: jobQueueStatusEnum("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  priority: integer("priority").notNull().default(0),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  location: text("location").notNull(),
  status: agentStatusEnum("status").notNull(),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }).notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
