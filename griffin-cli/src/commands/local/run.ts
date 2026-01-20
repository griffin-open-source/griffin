import { findTestFiles } from "../../test-discovery.js";
import { runTestFile } from "../../test-runner.js";
import { resolveEnvironment } from "../../core/state.js";
import { basename } from "path";

export interface RunLocalOptions {
  env?: string;
}

export async function executeRunLocal(
  options: RunLocalOptions = {},
): Promise<void> {
  try {
    // Resolve environment
    const envName = await resolveEnvironment(options.env);

    console.log(`Running tests locally against '${envName}' environment`);
    console.log(
      `Variables will be loaded from variables.yaml for environment: ${envName}`,
    );
    console.log("");

    const testFiles = findTestFiles();
    if (testFiles.length === 0) {
      console.error(
        "No test files found. Looking for .ts files in __griffin__ directories.",
      );
      process.exit(1);
    }

    console.log(`Found ${testFiles.length} test file(s):`);
    testFiles.forEach((file) => console.log(`  - ${file}`));
    console.log("");

    const results = await Promise.all(
      testFiles.map(async (file) => {
        const fileName = basename(file);
        console.log(`Running ${fileName}`);
        const result = await runTest(file, envName);
        return result;
      }),
    );

    // Print summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    console.log("");
    console.log(`Summary: ${successful} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function runTest(
  file: string,
  envName: string,
): Promise<{ success: boolean }> {
  try {
    const result = await runTestFile(file, envName);
    return { success: result.success };
  } catch (error: any) {
    console.error(error.message || String(error));
    return { success: false };
  }
}
