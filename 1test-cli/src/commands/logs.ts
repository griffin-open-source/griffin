import { getRunnerHost } from './configure-runner-host';
const axios = require('axios');

export async function executeLogs(checkName: string): Promise<void> {
  const runnerHost = getRunnerHost();

  if (!runnerHost) {
    console.error('ERROR: No runner host configured. Run: 1test configure-runner-host <host>');
    process.exit(1);
  }

  console.log(`Fetching logs for: ${checkName}`);

  try {
    // TODO: Implement log fetching from runner API
    const response = await axios.get(`${runnerHost}/api/tests/${checkName}/logs`);
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('ERROR: Failed to fetch logs');
    console.error(error.message || String(error));
    process.exit(1);
  }
}
