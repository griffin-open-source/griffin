import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { SchedulerService, WorkerService } from "../scheduler/index.js";
import type { HttpClientAdapter } from "1test-plan-executor";

// Extend Fastify's type system to include scheduler
declare module "fastify" {
  interface FastifyInstance {
    scheduler: SchedulerService;
    worker: WorkerService;
  }
}

/**
 * Simple HTTP client adapter for plan execution.
 * Uses native fetch API available in Node.js 18+.
 */
class FetchHttpClient implements HttpClientAdapter {
  async request(req: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      req.timeout || 30000,
    );

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });

      const data = await response.text();
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data: parsedData,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Fastify plugin that initializes and manages the scheduler and worker services.
 * Configuration is loaded from fastify.config (provided by the config plugin).
 */
const schedulerPlugin: FastifyPluginAsync = async (fastify) => {
  const {
    scheduler: schedulerConfig,
    worker: workerConfig,
    planExecution,
    repository,
  } = fastify.config;

  fastify.log.info(
    {
      schedulerEnabled: schedulerConfig.enabled,
      workerEnabled: workerConfig.enabled,
    },
    "Initializing scheduler and worker services",
  );

  // Create scheduler service
  const scheduler = new SchedulerService(fastify.repository, fastify.jobQueue, {
    tickInterval: schedulerConfig.tickInterval,
    backendType: repository.backend,
  });

  // Create worker service
  const worker = new WorkerService(fastify.repository, fastify.jobQueue, {
    emptyDelay: workerConfig.emptyDelay,
    maxEmptyDelay: workerConfig.maxEmptyDelay,
    httpClient: new FetchHttpClient(),
    baseUrl: planExecution.baseUrl,
    timeout: planExecution.timeout,
    secretRegistry: fastify.secretRegistry,
  });

  // Start services when server is ready
  fastify.addHook("onReady", async () => {
    if (schedulerConfig.enabled) {
      fastify.log.info("Starting scheduler service");
      scheduler.start();
    }

    if (workerConfig.enabled) {
      fastify.log.info("Starting worker service");
      worker.start();
    }
  });

  // Stop services on shutdown
  fastify.addHook("onClose", async () => {
    fastify.log.info("Stopping scheduler and worker services");
    await Promise.all([scheduler.stop(), worker.stop()]);
  });

  // Decorate Fastify instance
  fastify.decorate("scheduler", scheduler);
  fastify.decorate("worker", worker);
};

export default fp(schedulerPlugin, {
  name: "scheduler",
  dependencies: ["config", "storage", "secrets"], // Requires config, storage, and secrets plugins to be loaded first
});
