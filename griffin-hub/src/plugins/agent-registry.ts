import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { AgentRegistry } from "../services/agent-registry.js";

declare module "fastify" {
  interface FastifyInstance {
    agentRegistry: AgentRegistry;
  }
}

/**
 * Plugin that initializes the AgentRegistry service and attaches it to the Fastify instance.
 * Depends on the storage plugin being loaded first.
 */
const agentRegistryPlugin: FastifyPluginAsync = async (fastify) => {
  const { config, repository } = fastify;

  // Initialize the agent registry
  const agentRegistry = new AgentRegistry(
    repository,
    config.agent.heartbeatTimeout,
  );

  // Start heartbeat monitoring if enabled
  if (config.agent.monitoringEnabled) {
    const monitoringInterval = config.agent.monitoringInterval;
    agentRegistry.startMonitoring(monitoringInterval);

    // Stop monitoring on shutdown
    fastify.addHook("onClose", async () => {
      agentRegistry.stopMonitoring();
    });

    fastify.log.info(
      `Agent heartbeat monitoring enabled (interval: ${monitoringInterval}s)`,
    );
  }

  // Decorate fastify instance
  fastify.decorate("agentRegistry", agentRegistry);
};

export default fp(agentRegistryPlugin, {
  name: "agent-registry",
  dependencies: ["storage"],
});
