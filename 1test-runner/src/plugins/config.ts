import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { loadConfigFromEnv, Config } from "../config.js";

// Extend Fastify's type system to include config
declare module "fastify" {
  interface FastifyInstance {
    config: Config;
  }
}

/**
 * Fastify plugin that loads configuration from environment variables
 * and makes it available on the Fastify instance.
 *
 * This plugin validates all required environment variables at startup
 * and throws an error if any are missing or invalid.
 *
 * Usage:
 *   fastify.config.repository.backend
 *   fastify.config.scheduler.tickInterval
 *   etc.
 */
const configPlugin: FastifyPluginAsync = async (fastify) => {
  // Load and validate configuration
  const config = loadConfigFromEnv();

  // Log loaded configuration (excluding sensitive data)
  fastify.log.info(
    {
      repository: { backend: config.repository.backend },
      jobQueue: { backend: config.jobQueue.backend },
      scheduler: config.scheduler,
      worker: config.worker,
      planExecution: {
        hasBaseUrl: !!config.planExecution.baseUrl,
        timeout: config.planExecution.timeout,
      },
    },
    "Configuration loaded",
  );

  // Decorate Fastify instance with config
  fastify.decorate("config", config);
};

export default fp(configPlugin, {
  name: "config",
});
