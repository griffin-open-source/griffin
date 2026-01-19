import {
  addTarget,
  removeTarget,
  listEnvironments,
  setDefaultEnvironment,
} from "../../core/state.js";

export interface ConfigAddTargetOptions {
  env: string;
  key: string;
  url: string;
}

export interface ConfigRemoveTargetOptions {
  env: string;
  key: string;
}

export interface ConfigSetDefaultEnvOptions {
  env: string;
}

/**
 * List all local environments and their targets
 */
export async function executeConfigList(): Promise<void> {
  try {
    const environments = await listEnvironments();
    const envNames = Object.keys(environments);

    if (envNames.length === 0) {
      console.log("No environments configured.");
      console.log("");
      console.log("Add a target to create an environment:");
      console.log(
        "  griffin local config add-target --env <name> --key <key> --url <url>",
      );
      return;
    }

    console.log("Local environments:");
    console.log("");

    for (const envName of envNames) {
      const env = environments[envName];
      const marker = env.isDefault ? " (default)" : "";
      console.log(`  ${envName}${marker}`);

      const targetKeys = Object.keys(env.targets);
      if (targetKeys.length === 0) {
        console.log("    (no targets)");
      } else {
        for (const [key, url] of Object.entries(env.targets)) {
          console.log(`    ${key}: ${url}`);
        }
      }
      console.log("");
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Add a target to a local environment
 */
export async function executeConfigAddTarget(
  options: ConfigAddTargetOptions,
): Promise<void> {
  try {
    await addTarget(options.env, options.key, options.url);

    console.log(`✓ Target added to '${options.env}' environment`);
    console.log(`  ${options.key}: ${options.url}`);
    console.log("");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Remove a target from a local environment
 */
export async function executeConfigRemoveTarget(
  options: ConfigRemoveTargetOptions,
): Promise<void> {
  try {
    await removeTarget(options.env, options.key);

    console.log(`✓ Target removed from '${options.env}' environment`);
    console.log(`  Key: ${options.key}`);
    console.log("");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Set the default environment
 */
export async function executeConfigSetDefaultEnv(
  options: ConfigSetDefaultEnvOptions,
): Promise<void> {
  try {
    await setDefaultEnvironment(options.env);

    console.log(`✓ Set '${options.env}' as default environment`);
    console.log("");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
