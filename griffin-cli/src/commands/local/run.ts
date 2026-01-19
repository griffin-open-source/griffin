import { findTestFiles } from "../../test-discovery.js";
import { runTestFile } from "../../test-runner.js";
import { resolveEnvironment, getTargets } from "../../core/state.js";
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
    const targets = await getTargets(envName);

    console.log(`Running tests locally against '${envName}' environment`);

    // Show targets
    const targetKeys = Object.keys(targets);
    if (targetKeys.length === 0) {
      console.error(
        `Error: Environment '${envName}' has no configured targets`,
      );
      console.log("");
      console.log("Add a target with:");
      console.log(
        `  griffin local config add-target --env ${envName} --key <key> --url <url>`,
      );
      process.exit(1);
    }

    console.log("Targets:");
    for (const [key, url] of Object.entries(targets)) {
      console.log(`  ${key}: ${url}`);
    }
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

    // For v1: use "default" target if available, otherwise use first target
    const baseUrl = targets.default || Object.values(targets)[0];

    const results = await Promise.all(
      testFiles.map(async (file) => {
        const fileName = basename(file);
        console.log(`Running ${fileName}`);
        const result = await runTest(file, baseUrl);
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
  baseUrl: string,
): Promise<{ success: boolean }> {
  try {
    const result = await runTestFile(file, baseUrl);
    return { success: result.success };
  } catch (error: any) {
    console.error(error.message || String(error));
    return { success: false };
  }
}
