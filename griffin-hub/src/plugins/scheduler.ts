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
 * NOTE: The worker service has been moved to griffin-agent.
 * The hub only schedules jobs; agents execute them.
 */
const schedulerPlugin: FastifyPluginAsync = async (fastify) => {
  const {
    scheduler: schedulerConfig,
    worker: workerConfig,
    repository,
  } = fastify.config;

  fastify.log.info(
    {
      schedulerEnabled: schedulerConfig.enabled,
    },
    "Initializing scheduler service",
  );

  // Warn if worker is enabled (deprecated)
  if (workerConfig.enabled) {
    fastify.log.warn(
      "WORKER_ENABLED=true is deprecated. The hub no longer runs workers. " +
        "Deploy griffin-agent separately to execute plans.",
    );
  }

  // Create scheduler service
  const scheduler = new SchedulerService(fastify.repository, fastify.jobQueue, {
    tickInterval: schedulerConfig.tickInterval,
    backendType: repository.backend,
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
