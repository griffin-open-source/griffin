import { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
import { createClient } from "@griffin-app/griffin-hub-sdk/client";
import { getHubCredentials } from "./credentials.js";

/**
 * Create configured SDK API instances
 */
export function createSdk(config: {
  baseUrl: string;
  apiToken?: string;
}): GriffinHubSdk {
  const client = createClient({
    throwOnError: true,
    baseURL: config.baseUrl,
  });
  client.setConfig({
    auth() {
      return config.apiToken;
    },
  });
  const sdk = new GriffinHubSdk({
    client: client,
  });

  return sdk;
}

/**
 * Create SDK with credentials from user-level credentials file
 */
export async function createSdkWithCredentials(
  baseUrl: string,
): Promise<GriffinHubSdk> {
  const credentials = await getHubCredentials();

  return createSdk({
    baseUrl: baseUrl,
    apiToken: credentials?.token,
  });
}
