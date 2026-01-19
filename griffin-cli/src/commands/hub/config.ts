import { loadState } from "../../core/state.js";
import { createSdkClients } from "../../core/sdk.js";

interface RunnerConfig {
  id: string;
  organizationId: string;
  environment: string;
  targets: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigAddTargetOptions {
  org: string;
  env: string;
  key: string;
  url: string;
}

export interface ConfigRemoveTargetOptions {
  org: string;
  env: string;
  key: string;
}

export interface ConfigListOptions {
  org?: string;
  env?: string;
}

/**
 * Add a target to hub configuration
 */
export async function executeConfigAddTarget(
  options: ConfigAddTargetOptions,
): Promise<void> {
  try {
    const state = await loadState();

    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    const { configApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken,
    });

    const result =
      await configApi.configOrganizationIdEnvironmentTargetsTargetKeyPut(
        options.org,
        options.env,
        options.key,
        {
          baseUrl: options.url,
        },
      );

    console.log(`✓ Target "${options.key}" set to ${options.url}`);
    console.log(`  Organization: ${options.org}`);
    console.log(`  Environment: ${options.env}`);
    console.log(
      `  Updated at: ${new Date(result.data.data.updatedAt).toLocaleString()}`,
    );
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * Remove a target from hub configuration
 */
export async function executeConfigRemoveTarget(
  options: ConfigRemoveTargetOptions,
): Promise<void> {
  try {
    const state = await loadState();

    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }
    const { configApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken,
    });

    await configApi.configOrganizationIdEnvironmentTargetsTargetKeyDelete(
      options.org,
      options.env,
      options.key,
    );
    console.log(`✓ Target "${options.key}" deleted`);
    console.log(`  Organization: ${options.org}`);
    console.log(`  Environment: ${options.env}`);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

/**
 * List all hub configurations
 */
export async function executeConfigList(
  options: ConfigListOptions,
): Promise<void> {
  try {
    const state = await loadState();

    if (!state.runner?.baseUrl) {
      console.error("Error: Hub connection not configured.");
      console.log("Connect with:");
      console.log("  griffin hub connect --url <url> --token <token>");
      process.exit(1);
    }

    const { configApi } = createSdkClients({
      baseUrl: state.runner.baseUrl,
      apiToken: state.runner.apiToken,
    });

    const result = await configApi.configGet(options.org, options.env);

    if (result.data.data.length === 0 || !result.data.data) {
      console.log("No hub configurations found.");
      return;
    }

    console.log(`Found ${result.data.data.length} configuration(s):`);
    console.log("");

    for (const config of result.data.data) {
      console.log(`Organization: ${config.organizationId}`);
      console.log(`Environment: ${config.environment}`);
      console.log(`Targets:`);

      const targetCount = Object.keys(config.targets).length;
      if (targetCount === 0) {
        console.log("  (none)");
      } else {
        for (const [key, baseUrl] of Object.entries(config.targets)) {
          console.log(`  ${key}: ${baseUrl}`);
        }
      }

      console.log(`Updated: ${new Date(config.updatedAt).toLocaleString()}`);
      console.log("");
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
