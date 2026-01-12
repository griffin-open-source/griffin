import { getRunnerHost } from './configure-runner-host';
const axios = require('axios');
import * as readline from 'readline';

export async function executeExecuteRemote(checkName: string): Promise<void> {
  const runnerHost = getRunnerHost();

  if (!runnerHost) {
    console.error('ERROR: No runner host configured. Run: 1test configure-runner-host <host>');
    process.exit(1);
  }

  console.log('WARNING: Your local checks will be deployed and executed remotely.');
  console.log('Do you want to continue? (y/n)');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('', async (answer) => {
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Cancelled.');
      process.exit(0);
    }

    try {
      // TODO: Implement remote execution
      const response = await axios.post(`${runnerHost}/api/tests/${checkName}/execute`);
      console.log(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      console.error('ERROR: Failed to execute remotely');
      console.error(error.message || String(error));
      process.exit(1);
    }
  });
}
