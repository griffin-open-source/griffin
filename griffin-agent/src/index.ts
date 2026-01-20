import { loadAgentConfigFromEnv } from "./config.js";
import { PostgresQueueConsumer } from "./queue/postgres-consumer.js";
import { AgentsApi, ConfigApi, Configuration, RunsApi } from "griffin-hub-sdk";
import { WorkerService } from "./worker.js";
import {
  AxiosAdapter,
  SecretProviderRegistry,
  EnvSecretProvider,
  AwsSecretsManagerProvider,
} from "griffin-plan-executor";

/**
 * Main entry point for the Griffin Agent.
 *
 * The agent:
 * 1. Registers with the hub
 * 2. Starts a heartbeat loop
 * 3. Polls the queue for jobs
 * 4. Executes plans and reports results to the hub
 */
async function main() {
  console.log("Starting Griffin Agent...");

  // Load configuration from environment
  const config = loadAgentConfigFromEnv();

  console.log(`Agent location: ${config.agent.location}`);
  console.log(`Hub URL: ${config.hub.url}`);
  console.log(`Queue backend: ${config.queue.backend}`);

  // Create hub client
  //const hubClient = new HubClient(config.hub.url, config.hub.apiKey);

  // Register with hub
  console.log("Registering with hub...");
  const agentApi = new AgentsApi(
    new Configuration({ basePath: config.hub.url }),
  );
  const configApi = new ConfigApi(
    new Configuration({ basePath: config.hub.url }),
  );
  const runsApi = new RunsApi(new Configuration({ basePath: config.hub.url }));

  const { data: agent } = await agentApi.agentsRegisterPost({
    location: config.agent.location,
    metadata: config.agent.metadata ?? {},
  });
  console.log(`Registered as agent ${agent.id} at location ${agent.location}`);

  // Create queue consumer based on backend
  let queueConsumer;
  if (config.queue.backend === "postgres") {
    if (!config.queue.connectionString) {
      throw new Error(
        "Queue connection string is required for Postgres backend",
      );
    }
    queueConsumer = new PostgresQueueConsumer(
      config.queue.connectionString,
      config.queue.queueName,
    );
  } else {
    throw new Error(`Unsupported queue backend: ${config.queue.backend}`);
  }

  // Connect to queue
  console.log("Connecting to queue...");
  await queueConsumer.connect();
  console.log("Connected to queue");

  // Create secret provider registry
  const secretRegistry = new SecretProviderRegistry();

  // Always register env provider
  secretRegistry.register(new EnvSecretProvider(config.secrets.env));

  // Register AWS provider if enabled
  if (config.secrets.providers.includes("aws") && config.secrets.aws) {
    // Note: AwsSecretsManagerProvider expects a client to be passed, not region config
    // For now, skip AWS support - can be added in later phase with proper client setup
    console.warn("AWS Secrets Manager provider not yet supported in agent");
  }

  // Note: Vault provider will be added in a future phase if needed

  // Create worker
  const worker = new WorkerService(
    config.agent.location,
    queueConsumer,
    runsApi,
    configApi,
    {
      httpClient: new AxiosAdapter(),
      timeout: config.planExecution.timeout,
      emptyDelay: config.queue.pollInterval,
      maxEmptyDelay: config.queue.maxPollInterval,
      secretRegistry,
    },
  );

  // Start heartbeat loop if enabled
  let heartbeatInterval: NodeJS.Timeout | undefined;
  if (config.heartbeat.enabled) {
    console.log(
      `Starting heartbeat loop (interval: ${config.heartbeat.interval}s)`,
    );
    heartbeatInterval = setInterval(async () => {
      try {
        await agentApi.agentsIdHeartbeatPost(agent.id);
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, config.heartbeat.interval * 1000);
  }

  // Start worker
  console.log("Starting worker...");
  worker.start();
  console.log("Worker started. Polling for jobs...");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down gracefully...");

    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Stop worker (waits for current job to complete)
    await worker.stop();
    console.log("Worker stopped");

    // Disconnect from queue
    await queueConsumer.disconnect();
    console.log("Disconnected from queue");

    // Deregister from hub
    await agentApi.agentsIdDelete(agent.id);
    console.log("Deregistered from hub");

    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
