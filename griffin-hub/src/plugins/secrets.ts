import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import {
  SecretProviderRegistry,
  EnvSecretProvider,
  AwsSecretsManagerProvider,
  VaultProvider,
  type AwsSecretsManagerClient,
  type VaultHttpClient,
} from "griffin-plan-executor";
import axios from "axios";

// Extend Fastify's type system to include secretRegistry
declare module "fastify" {
  interface FastifyInstance {
    secretRegistry: SecretProviderRegistry;
  }
}

/**
 * Create an axios-based HTTP client for Vault.
 */
function createVaultHttpClient(): VaultHttpClient {
  return {
    async get(url: string, options: { headers: Record<string, string> }) {
      const response = await axios.get(url, {
        headers: options.headers,
        validateStatus: () => true, // Don't throw on non-2xx
      });
      return {
        status: response.status,
        data: response.data,
      };
    },
  };
}

/**
 * Fastify plugin that initializes the secret provider registry
 * based on configuration.
 *
 * This plugin:
 * - Creates a SecretProviderRegistry
 * - Registers enabled providers (env, aws, vault)
 * - Makes the registry available on the Fastify instance
 *
 * Usage:
 *   const resolvedPlan = await resolveSecretsInPlan(plan, fastify.secretRegistry);
 */
const secretsPlugin: FastifyPluginAsync = async (fastify) => {
  const config = fastify.config.secrets;
  const registry = new SecretProviderRegistry();

  // Always register env provider (it's always available)
  if (config.providers.includes("env")) {
    const envProvider = new EnvSecretProvider({
      prefix: config.env.prefix,
    });
    registry.register(envProvider);
    fastify.log.info("Registered env secret provider");
  }

  // Register AWS provider if configured
  if (config.providers.includes("aws") && config.aws) {
    try {
      // Dynamically import AWS SDK to avoid requiring it when not used
      // This will fail if @aws-sdk packages are not installed
      let SecretsManagerClient: any;
      let GetSecretValueCommand: any;

      try {
        const smModule = await import("@aws-sdk/client-secrets-manager");
        SecretsManagerClient = smModule.SecretsManagerClient;
        GetSecretValueCommand = smModule.GetSecretValueCommand;
      } catch {
        throw new Error(
          "AWS Secrets Manager provider is enabled but @aws-sdk/client-secrets-manager is not installed. " +
            "Install it with: npm install @aws-sdk/client-secrets-manager",
        );
      }

      const clientConfig: { region: string; credentials?: any } = {
        region: config.aws.region,
      };

      // If roleArn is provided, use STS to assume the role
      if (config.aws.roleArn) {
        let STSClient: any;
        let AssumeRoleCommand: any;

        try {
          const stsModule = await import("@aws-sdk/client-sts");
          STSClient = stsModule.STSClient;
          AssumeRoleCommand = stsModule.AssumeRoleCommand;
        } catch {
          throw new Error(
            "AWS role assumption is configured but @aws-sdk/client-sts is not installed. " +
              "Install it with: npm install @aws-sdk/client-sts",
          );
        }

        const stsClient = new STSClient({ region: config.aws.region });
        const assumeRoleResponse = await stsClient.send(
          new AssumeRoleCommand({
            RoleArn: config.aws.roleArn,
            RoleSessionName: "griffin-runner",
            ExternalId: config.aws.externalId,
          }),
        );

        if (assumeRoleResponse.Credentials) {
          clientConfig.credentials = {
            accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
            secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
            sessionToken: assumeRoleResponse.Credentials.SessionToken,
          };
        }
      }

      const smClient = new SecretsManagerClient(clientConfig);

      // Create adapter that implements AwsSecretsManagerClient
      const awsClient: AwsSecretsManagerClient = {
        async getSecretValue(params: {
          SecretId: string;
          VersionStage?: string;
        }) {
          const command = new GetSecretValueCommand({
            SecretId: params.SecretId,
            VersionStage: params.VersionStage,
          });
          const response = await smClient.send(command);
          return {
            SecretString: response.SecretString,
            SecretBinary: response.SecretBinary,
          };
        },
      };

      const awsProvider = new AwsSecretsManagerProvider({
        client: awsClient,
        prefix: config.aws.prefix,
      });
      registry.register(awsProvider);
      fastify.log.info(
        { region: config.aws.region, hasRoleArn: !!config.aws.roleArn },
        "Registered AWS Secrets Manager provider",
      );
    } catch (error) {
      fastify.log.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to initialize AWS Secrets Manager provider",
      );
      throw error;
    }
  }

  // Register Vault provider if configured
  if (config.providers.includes("vault") && config.vault) {
    const vaultProvider = new VaultProvider({
      address: config.vault.address,
      token: config.vault.token || "",
      httpClient: createVaultHttpClient(),
      namespace: config.vault.namespace,
      kvVersion: config.vault.kvVersion,
      prefix: config.vault.prefix,
    });

    // Validate Vault connection
    try {
      await vaultProvider.validate();
      registry.register(vaultProvider);
      fastify.log.info(
        {
          address: config.vault.address,
          hasNamespace: !!config.vault.namespace,
        },
        "Registered Vault secret provider",
      );
    } catch (error) {
      fastify.log.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to validate Vault connection",
      );
      throw error;
    }
  }

  fastify.log.info(
    { providers: registry.getProviderNames() },
    "Secret provider registry initialized",
  );

  // Decorate Fastify instance with the registry
  fastify.decorate("secretRegistry", registry);
};

export default fp(secretsPlugin, {
  name: "secrets",
  dependencies: ["config"],
});
