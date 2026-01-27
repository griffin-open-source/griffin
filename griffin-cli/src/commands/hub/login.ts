// CLI implementation
import { createAuthClient } from "better-auth/client";
import {
  deviceAuthorizationClient,
  jwtClient,
} from "better-auth/client/plugins";
import { getProjectId, loadState, saveState } from "../../core/state.js";
import { saveHubCredentials } from "../../core/credentials.js";
import { terminal } from "../../utils/terminal.js";
import { randomBytes } from "crypto";
import { createEmptyState, StateFile } from "../../schemas/state.js";
const baseURL = "http://localhost:4000/api/auth";
const hubBaseUrl = "http://localhost:3000";
//const baseURL = "https://cloud.griffin.app"
const oauthGrant = "urn:ietf:params:oauth:grant-type:device_code";

const authClient = createAuthClient({
  baseURL: baseURL,
  plugins: [
    deviceAuthorizationClient(),
    jwtClient(),
  ],
});
async function pollForToken(
  clientId: string,
  deviceCode: string,
  interval: number,
) {
  const { data, error } = await authClient.device.token({
    grant_type: oauthGrant,
    device_code: deviceCode,
    client_id: clientId,
    fetchOptions: {
      headers: {
        "user-agent": `griffin-cli`,
      },
    },
  });
  if (data?.access_token) return data.access_token;
  switch (error?.error) {
    case "slow_down":
      await new Promise((resolve) => setTimeout(resolve, interval * 2));
      return pollForToken(clientId, deviceCode, interval * 2);
    case "authorization_pending":
      await new Promise((resolve) => setTimeout(resolve, interval));
      return pollForToken(clientId, deviceCode, interval);
    default:
      throw new Error(error?.error_description || "Unknown error");
  }
}


export async function executeLogin(): Promise<void> {
  let state: StateFile | undefined;
  let clientId: string | undefined;
  try {
    state = await loadState();
    clientId = state.hub?.clientId;
  } catch (error) {
  }
  if (!clientId) {
    clientId = randomBytes(16).toString("hex");
  }

  const { data } = await authClient.device.code({
    client_id: clientId,
  });
  terminal.info(`Go to: ${data?.verification_uri_complete}`);
  terminal.info(`Or enter code: ${data?.user_code}`);

  // 2. Poll for authorization
  const sessionToken = await pollForToken(
    clientId,
    data?.device_code!,
    (data?.interval ?? 5) * 1000,
  );
  const { data: jwtData } = await authClient.token({
    fetchOptions: {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    },
  });

  // Save token to user-level credentials file
  if (jwtData?.token) {
    await saveHubCredentials(jwtData.token);
    terminal.success("Login successful");
    terminal.log(`  Token saved to user credentials`);
  }
  if (!state) {
    const projectId = await getProjectId();
    state = createEmptyState(projectId);
  }

  // Save hub config to project state (without token)
  await saveState({
    ...state,
    hub: {
      ...state.hub!,
      clientId: clientId,
      baseUrl: hubBaseUrl,
    },
  });
}
