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
import { type Edge, type Node, type Frequency } from "griffin/types";
import { JobStatus } from "../../ports.js";
import { TriggerType } from "../../../schemas/job-run.js";
import { AgentStatus } from "../../../schemas/agent.js";

export const triggerTypeEnum = pgEnum("trigger_type", [
  TriggerType.SCHEDULE,
  TriggerType.MANUAL,
  TriggerType.API,
]);
export const statusEnum = pgEnum("status", [
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

export const plansTable = pgTable("plans", {
  organization: text("organization").notNull(),
  project: text("project").notNull(),
  id: text("id").primaryKey(),
  version: text("version").notNull(),
  frequency: jsonb("frequency").$type<Frequency>().notNull(),
  locations: jsonb("locations").$type<string[]>(),
  nodes: jsonb("nodes").$type<Node>().notNull(),
  edges: jsonb("edges").$type<Edge>().notNull(),
  environment: text("environment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const runsTable = pgTable("runs", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .references(() => plansTable.id)
    .notNull(),
  executionGroupId: text("execution_group_id").notNull(),
  location: text("location").notNull(),
  environment: text("environment").notNull(),
  triggeredBy: triggerTypeEnum("triggered_by").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  status: statusEnum("status").notNull(),
  duration_ms: integer("duration_ms"),
  success: boolean("success"),
  errors: jsonb("errors").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const runnerConfigsTable = pgTable("runner_configs", {
  organization: text("organization").notNull(),
  project: text("project").notNull(),
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  location: text("location").notNull(),
  status: agentStatusEnum("status").notNull(),
  lastHeartbeat: timestamp("last_heartbeat").notNull(),
  registeredAt: timestamp("registered_at").notNull(),
  metadata: jsonb("metadata").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  queueName: text("queue_name").notNull().default("default"),
  data: jsonb("data").notNull(),
  location: text("location").notNull(),
  status: statusEnum("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  priority: integer("priority").notNull().default(0),
  scheduledFor: timestamp("scheduled_for").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
