import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.1test');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function executeConfigureRunnerHost(host: string): Promise<void> {
  console.log(`Configuring runner host: ${host}`);

  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Read existing config or create new one
  let config: any = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      config = JSON.parse(configData);
    } catch (error) {
      console.warn('Warning: Could not read existing config, creating new one');
    }
  }

  // Update runner host
  config.runnerHost = host;

  // Write config
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`Configuration saved to ${CONFIG_FILE}`);
}

export function getRunnerHost(): string | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    return config.runnerHost || null;
  } catch {
    return null;
  }
}
