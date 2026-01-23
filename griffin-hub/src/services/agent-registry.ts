import type { Storage } from "../storage/index.js";
import type { Agent } from "../schemas/agent.js";
import { AgentStatus } from "../schemas/agent.js";
import { randomUUID } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import { agentsTable } from "../storage/adapters/postgres/schema.js";
import { utcNow } from "../utils/dates.js";

export interface RegisterAgentOptions {
  location: string;
  metadata?: Record<string, string>;
}

/**
 * Service for managing agent registration, heartbeats, and health monitoring.
 * Agents register with the hub and send periodic heartbeats to maintain their online status.
 */
export class AgentRegistry {
  private heartbeatTimeoutMs: number;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(
    private storage: Storage,
    heartbeatTimeoutSeconds = 60,
  ) {
    this.heartbeatTimeoutMs = heartbeatTimeoutSeconds * 1000;
  }

  /**
   * Register a new agent with the hub.
   * Returns the agent record with generated ID.
   */
  async register(options: RegisterAgentOptions): Promise<Agent> {
    const now = utcNow();
    const agent = await this.storage.agents.create({
      location: options.location,
      status: AgentStatus.ONLINE,
      lastHeartbeat: now,
      registeredAt: now,
      metadata: options.metadata,
    });

    console.log(`Agent registered: ${agent.id} at location ${agent.location}`);
    return agent;
  }

  /**
   * Record a heartbeat from an agent, updating its lastHeartbeat timestamp.
   * Returns true if successful, false if agent not found.
   */
  async heartbeat(agentId: string): Promise<boolean> {
    try {
      const agent = await this.storage.agents.findById(agentId);
      if (!agent) {
        return false;
      }

      await this.storage.agents.update(agentId, {
        lastHeartbeat: utcNow(),
        status: AgentStatus.ONLINE,
      });

      return true;
    } catch (error) {
      console.error(`Failed to record heartbeat for agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Deregister an agent from the hub.
   * This is typically called when an agent shuts down gracefully.
   */
  async deregister(agentId: string): Promise<void> {
    const agent = await this.storage.agents.findById(agentId);
    if (agent) {
      await this.storage.agents.delete(agentId);
      console.log(
        `Agent deregistered: ${agentId} at location ${agent.location}`,
      );
    }
  }

  /**
   * Get all agents, optionally filtered by location and/or status.
   */
  async listAgents(location?: string, status?: AgentStatus): Promise<Agent[]> {
    const conditions = [];
    if (location) {
      conditions.push(eq(agentsTable.location, location));
    }
    if (status) {
      conditions.push(eq(agentsTable.status, status));
    }

    return this.storage.agents.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [asc(agentsTable.registeredAt)],
    });
  }

  /**
   * Get a list of all registered locations (distinct location values).
   * Only returns locations with at least one online agent.
   */
  async getRegisteredLocations(): Promise<string[]> {
    return await this.storage.agents.findDistinctLocations(true);
  }

  /**
   * Get a list of all locations (including those with only offline agents).
   */
  async getAllLocations(): Promise<string[]> {
    return await this.storage.agents.findDistinctLocations(false);
  }

  /**
   * Check if a location has at least one online agent.
   */
  async hasOnlineAgents(location: string): Promise<boolean> {
    const agents = await this.listAgents(location, AgentStatus.ONLINE);
    return agents.length > 0;
  }

  /**
   * Start background monitoring to mark stale agents as offline.
   * This should be called when the hub starts up.
   */
  startMonitoring(intervalSeconds = 30): void {
    if (this.isMonitoring) {
      console.warn("Agent monitoring is already running");
      return;
    }

    this.isMonitoring = true;
    console.log(
      `Starting agent heartbeat monitoring (interval: ${intervalSeconds}s, timeout: ${this.heartbeatTimeoutMs / 1000}s)`,
    );

    this.monitoringInterval = setInterval(() => {
      this.checkStaleAgents().catch((error) => {
        console.error("Error checking stale agents:", error);
      });
    }, intervalSeconds * 1000);

    // Run an initial check
    this.checkStaleAgents().catch((error) => {
      console.error("Error checking stale agents:", error);
    });
  }

  /**
   * Stop background monitoring.
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.isMonitoring = false;
      console.log("Agent heartbeat monitoring stopped");
    }
  }

  /**
   * Check for agents whose heartbeat has exceeded the timeout threshold
   * and mark them as offline.
   */
  private async checkStaleAgents(): Promise<void> {
    // Get all online agents
    const onlineAgents = await this.listAgents(undefined, AgentStatus.ONLINE);

    const now = Date.now();
    const staleThreshold = now - this.heartbeatTimeoutMs;

    for (const agent of onlineAgents) {
      const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();

      if (lastHeartbeat < staleThreshold) {
        console.warn(
          `Marking agent ${agent.id} (${agent.location}) as offline - last heartbeat was ${Math.round((now - lastHeartbeat) / 1000)}s ago`,
        );

        await this.storage.agents.update(agent.id, {
          status: AgentStatus.OFFLINE,
        });
      }
    }
  }
}
