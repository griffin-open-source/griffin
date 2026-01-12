import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { RepositoryBackend, JobQueueBackend } from "../storage/ports.js";
import {
  createRepositoryBackend,
  createJobQueueBackend,
  loadRepositoryConfig,
  loadJobQueueConfig,
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
 *
 * Repository backend is configured via environment variables:
 * - REPOSITORY_BACKEND: 'memory' | 'sqlite' | 'postgres' (default: 'memory')
 * - REPOSITORY_CONNECTION_STRING: connection string for the backend
 * - SQLITE_PATH: (alias for SQLite)
 * - POSTGRESQL_URL: (alias for Postgres)
 *
 * Job queue backend is configured via environment variables:
 * - JOBQUEUE_BACKEND: 'memory' | 'postgres' (default: 'memory')
 * - JOBQUEUE_CONNECTION_STRING: connection string for the backend
 * - POSTGRESQL_URL: (alias for Postgres)
 */
const storagePlugin: FastifyPluginAsync = async (fastify) => {
  // Load configurations from environment
  const repoConfig = loadRepositoryConfig();
  const queueConfig = loadJobQueueConfig();

  fastify.log.info(
    {
      repositoryBackend: repoConfig.backend,
      jobQueueBackend: queueConfig.backend,
    },
    "Initializing storage backends",
  );

  // Create backends
  const repository = createRepositoryBackend(repoConfig);
  const jobQueue = createJobQueueBackend(queueConfig);

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
});
