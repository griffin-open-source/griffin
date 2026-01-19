import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { RepositoryBackend, JobQueueBackend } from "../storage/ports.js";
import {
  createRepositoryBackend,
  createJobQueueBackend,
} from "../storage/factory.js";

// Extend Fastify's type system to include storage
declare module "fastify" {
  interface FastifyInstance {
    repository: RepositoryBackend;
    jobQueue: JobQueueBackend;
  }
}

/**
 * Fastify plugin that initializes and registers the storage backends.
 * Configuration is loaded from fastify.config (provided by the config plugin).
 */
const storagePlugin: FastifyPluginAsync = async (fastify) => {
  const { repository: repoConfig, jobQueue: queueConfig } = fastify.config;

  fastify.log.info(
    {
      repositoryBackend: repoConfig.backend,
      jobQueueBackend: queueConfig.backend,
    },
    "Initializing storage backends",
  );

  // Create backends
  const repository = createRepositoryBackend({
    backend: repoConfig.backend,
    connectionString: repoConfig.connectionString,
  });
  const jobQueue = createJobQueueBackend({
    backend: queueConfig.backend,
    connectionString: queueConfig.connectionString,
  });

  // Connect to backends
  await repository.connect();
  await jobQueue.connect();

  // Register cleanup on shutdown
  fastify.addHook("onClose", async () => {
    fastify.log.info("Disconnecting storage backends");
    await Promise.all([repository.disconnect(), jobQueue.disconnect()]);
  });

  // Decorate Fastify instance with backends
  fastify.decorate("repository", repository);
  fastify.decorate("jobQueue", jobQueue);
};

export default fp(storagePlugin, {
  name: "storage",
  dependencies: ["config"],
});
