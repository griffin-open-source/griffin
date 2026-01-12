import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// We'll import these dynamically to handle relative paths
type TestPlan = any;
type ExecutionResult = any;

/**
 * Runs a TypeScript test file and executes the resulting JSON plan.
 */
export async function runTestFile(
  filePath: string,
  envConfig?: Record<string, any>
): Promise<{ success: boolean; output: string; result?: any }> {
  const absoluteFilePath = path.resolve(filePath);
  
  // Check if test system and executor are built
  const workspaceRoot = findWorkspaceRoot();
  const testSystemPath = path.join(workspaceRoot, '1test-ts', 'dist');
  const executorPath = path.join(workspaceRoot, '1test-plan-executor', 'dist');
  
  if (!fs.existsSync(testSystemPath)) {
    throw new Error(
      'Test system not built. Please run: cd 1test-ts && npm install && npm run build'
    );
  }
  
  if (!fs.existsSync(executorPath)) {
    throw new Error(
      'Plan executor not built. Please run: cd 1test-plan-executor && npm install && npm run build'
    );
  }
  
  try {
    // Try to use tsx if available, otherwise use npx tsx
    let tsxCmd = 'tsx';
    try {
      execSync('which tsx', { stdio: 'ignore' });
    } catch {
      tsxCmd = 'npx tsx';
    }
    
    // Prepare environment variables
    const envVars: Record<string, string> = {
      ...process.env,
      NODE_PATH: `${testSystemPath}:${process.env.NODE_PATH || ''}`,
    };
    
    // If envConfig is provided, serialize it and pass via _1TEST_ENV_VARS
    if (envConfig) {
      envVars._1TEST_ENV_VARS = JSON.stringify(envConfig);
    }
    
    // Run the test file and capture output
    const output = execSync(`${tsxCmd} "${absoluteFilePath}"`, {
      encoding: 'utf-8',
      cwd: path.dirname(absoluteFilePath),
      env: envVars,
    });
    
    // Parse JSON from output (the test system outputs JSON via console.log)
    const lines = output.trim().split('\n');
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('{')) {
        jsonStart = i;
        break;
      }
    }
    
    if (jsonStart === -1) {
      throw new Error('No JSON output found from test file');
    }
    
    const jsonStr = lines.slice(jsonStart).join('\n');
    const plan: TestPlan = JSON.parse(jsonStr);
    
    // Execute the plan using the executor
    // Use the endpoint_host from the plan itself
    const executorModule = require(path.join(executorPath, 'executor.js'));
    const { executePlan } = executorModule;
    
    const result = await executePlan(plan, {
      mode: 'local',
      // Don't override baseUrl - use the plan's endpoint_host
    });
    
    return {
      success: result.success,
      output: JSON.stringify(result, null, 2),
      result,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.message || String(error),
    };
  }
}

function findWorkspaceRoot(): string {
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    const testCliPath = path.join(current, '1test-cli');
    const testSystemPath = path.join(current, '1test-ts');
    if (fs.existsSync(testCliPath) && fs.existsSync(testSystemPath)) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}
