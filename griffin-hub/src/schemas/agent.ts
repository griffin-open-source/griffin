import { Type, type Static } from "typebox";
import { StringEnum } from "./shared.js";

export enum AgentStatus {
  ONLINE = "online",
  OFFLINE = "offline",
}

export const AgentStatusSchema = StringEnum(
  [AgentStatus.ONLINE, AgentStatus.OFFLINE],
  { $id: "AgentStatus" },
);

export const AgentSchema = Type.Object({
  id: Type.Readonly(Type.String()),
  location: Type.String(),
  status: AgentStatusSchema,
  lastHeartbeat: Type.String({ format: "date-time" }),
  registeredAt: Type.String({ format: "date-time" }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.String())),
});

export type Agent = Static<typeof AgentSchema>;
