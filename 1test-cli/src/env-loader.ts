import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Loads environment configuration from __1test__/env.ts file.
 * Executes the TypeScript file using tsx to get the exported object.
 */
export function loadEnvironmentConfig(
  workspaceRoot: string,
  environment: string
): Record<string, any> {
  const envFilePath = path.join(workspaceRoot, '__1test__', 'env.ts');

  if (!fs.existsSync(envFilePath)) {
    throw new Error(
      `Environment file not found: ${envFilePath}\n` +
        `Please create __1test__/env.ts with environment configurations.`
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

    // Create a temporary script that loads and exports the env config
    // Use absolute path for the import, converting to forward slashes for cross-platform compatibility
    // Escape single quotes in the path for the template string
    const absoluteEnvPath = path.resolve(envFilePath).replace(/\\/g, '/').replace(/'/g, "\\'");
    const tempScript = `import envConfig from '${absoluteEnvPath}';\nconsole.log(JSON.stringify(envConfig));\n`;

    // Write temp script to a file
    const tempScriptPath = path.join(workspaceRoot, '.1test-env-loader-temp.ts');
    fs.writeFileSync(tempScriptPath, tempScript);

    try {
      // Execute the temp script to get the config
      let output: string;
      try {
        output = execSync(`${tsxCmd} "${tempScriptPath}"`, {
          encoding: 'utf-8',
          cwd: workspaceRoot,
          stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        });
      } catch (execError: any) {
        // Capture stderr if available
        const stderr = execError.stderr?.toString() || execError.message || String(execError);
        throw new Error(
          `Failed to execute env.ts file: ${stderr}\n` +
            `Make sure the file exports a default object with environment configurations.`
        );
      }

      // Parse the JSON output
      let allConfigs: Record<string, any>;
      try {
        const jsonOutput = output.trim();
        // Find the JSON in the output (might have other console.log statements)
        const jsonMatch = jsonOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in output');
        }
        allConfigs = JSON.parse(jsonMatch[0]);
      } catch (parseError: any) {
        throw new Error(
          `Failed to parse environment configuration: ${parseError.message}\n` +
            `Output was: ${output.substring(0, 200)}`
        );
      }

      // Check if the requested environment exists
      if (!allConfigs[environment]) {
        const availableEnvs = Object.keys(allConfigs).join(', ');
        throw new Error(
          `Environment "${environment}" not found in env.ts.\n` +
            `Available environments: ${availableEnvs || 'none'}`
        );
      }

      return allConfigs[environment];
    } finally {
      // Clean up temp script
      if (fs.existsSync(tempScriptPath)) {
        fs.unlinkSync(tempScriptPath);
      }
    }
  } catch (error: any) {
    if (error.message.includes('not found in env.ts')) {
      throw error;
    }
    throw new Error(
      `Failed to load environment configuration: ${error.message || String(error)}`
    );
  }
}
