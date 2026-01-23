import { GriffinHubSdk } from "@griffin-app/griffin-hub-sdk";
import { createClient } from "@griffin-app/griffin-hub-sdk/client";
/**
 * Create configured SDK API instances
 */
export function createSdk(config: {
  baseUrl: string;
  apiToken?: string;
}): GriffinHubSdk {
  const client = createClient({
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
