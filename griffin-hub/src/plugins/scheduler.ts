import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { SchedulerService } from "../scheduler/index.js";

// Extend Fastify's type system to include scheduler
declare module "fastify" {
  interface FastifyInstance {
    scheduler: SchedulerService;
  }
}

/**
 * Fastify plugin that initializes and manages the scheduler service.
 * Configuration is loaded from fastify.config (provided by the config plugin).
 *
 * The scheduler finds plans due for execution and enqueues them.
 * Jobs are executed by either:
 * - Built-in executor (server-standalone.ts)
 * - Remote agents (griffin-agent)
 */
const schedulerPlugin: FastifyPluginAsync = async (fastify) => {
  const { scheduler: schedulerConfig } = fastify.config;

  fastify.log.info(
    {
      schedulerEnabled: schedulerConfig.enabled,
    },
    "Initializing scheduler service",
  );

  // Create scheduler service
  const scheduler = new SchedulerService(fastify.storage, fastify.jobQueue, {
    tickInterval: schedulerConfig.tickInterval,
  });

  // Start scheduler when server is ready
  fastify.addHook("onReady", async () => {
    if (schedulerConfig.enabled) {
      fastify.log.info("Starting scheduler service");
      scheduler.start();
    }
  });

  // Stop scheduler on shutdown
  fastify.addHook("onClose", async () => {
    fastify.log.info("Stopping scheduler service");
    await scheduler.stop();
  });

  // Decorate Fastify instance
  fastify.decorate("scheduler", scheduler);
};

export default fp(schedulerPlugin, {
  name: "scheduler",
  dependencies: ["config", "storage", "agent-registry"],
});
