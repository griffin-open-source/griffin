import { findTestFiles } from '../test-discovery';
import { getRunnerHost } from './configure-runner-host';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export async function executeDeploy(): Promise<void> {
  const runnerHost = getRunnerHost();

  if (!runnerHost) {
    console.error('ERROR: No runner host configured. Run: 1test configure-runner-host <host>');
    process.exit(1);
  }

  console.log('Deploying tests to runner...');

  const testFiles = findTestFiles();
  const workspaceRoot = findWorkspaceRoot();
  const testSystemPath = path.join(workspaceRoot, '1test-test-system', 'dist');

  if (!fs.existsSync(testSystemPath)) {
    throw new Error(
      'Test system not built. Please run: cd 1test-test-system && npm install && npm run build'
    );
  }

  // TODO: Implement deployment logic
  // - Read each test file
  // - Execute it to get JSON plan
  // - Send to runner API
  // - Handle responses

  console.log('Deployed.');
}

function findWorkspaceRoot(): string {
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    const 1testCliPath = path.join(current, '1test-cli');
    const testSystemPath = path.join(current, '1test-test-system');
    if (fs.existsSync(1testCliPath) && fs.existsSync(testSystemPath)) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}
