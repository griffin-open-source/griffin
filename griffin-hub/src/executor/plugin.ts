import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { ExecutorService, ExecutionJobData } from "./service.js";
import { AxiosAdapter } from "@griffin-app/griffin-plan-executor";

// Extend Fastify's type system to include executor
declare module "fastify" {
  interface FastifyInstance {
    executor: ExecutorService;
  }
}

/**
 * Fastify plugin that initializes and manages the built-in executor service.
 * This plugin is NOT auto-loaded - it must be explicitly registered in server-standalone.ts.
 *
 * The executor:
 * - Polls the job queue for execution jobs
 * - Executes test plans using the plan executor
 * - Updates job runs via direct storage access (no HTTP)
 * - Uses the "local" location for job routing
 */
const executorPlugin: FastifyPluginAsync = async (fastify) => {
  const { worker: workerConfig, planExecution } = fastify.config;

  fastify.log.info("Initializing built-in executor service");

  // Get the plan-executions queue
  const queue = fastify.jobQueue.queue<ExecutionJobData>("plan-executions");

  // Create executor service
  const executor = new ExecutorService(queue, fastify.storage, {
    emptyDelay: workerConfig.emptyDelay,
    maxEmptyDelay: workerConfig.maxEmptyDelay,
    timeout: planExecution.timeout,
    httpClient: new AxiosAdapter(),
    secretRegistry: fastify.secretRegistry,
  });

  // Start executor when server is ready
  fastify.addHook("onReady", async () => {
    fastify.log.info("Starting built-in executor service");
    executor.start();
  });

  // Stop executor on shutdown
  fastify.addHook("onClose", async () => {
    fastify.log.info("Stopping built-in executor service");
    await executor.stop();
  });

  // Decorate Fastify instance
  fastify.decorate("executor", executor);
};

export default fp(executorPlugin, {
  name: "executor",
  dependencies: ["config", "storage", "secrets"],
});
