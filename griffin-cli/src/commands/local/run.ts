import { findTestFiles } from "../../test-discovery.js";
import { runTestFile } from "../../test-runner.js";
import { resolveEnvironment } from "../../core/state.js";
import { terminal } from "../../utils/terminal.js";
import { basename } from "path";

export interface RunLocalOptions {
  env: string;
}

export async function executeRunLocal(options: RunLocalOptions): Promise<void> {
  try {
    // Resolve environment
    const envName = await resolveEnvironment(options.env);

    terminal.info(
      `Running tests locally against ${terminal.colors.cyan(envName)} environment`,
    );
    terminal.dim(
      `Variables will be loaded from variables.yaml for environment: ${envName}`,
    );
    terminal.blank();

    const spinner = terminal.spinner("Discovering test files...").start();
    const testFiles = findTestFiles();

    if (testFiles.length === 0) {
      spinner.fail("No test files found");
      terminal.dim("Looking for .ts files in __griffin__ directories.");
      terminal.exit(1);
    }

    spinner.succeed(
      `Found ${terminal.colors.bold(testFiles.length.toString())} test file(s)`,
    );
    testFiles.forEach((file) => terminal.dim(`  - ${file}`));
    terminal.blank();

    const results = await Promise.all(
      testFiles.map(async (file) => {
        const fileName = basename(file);
        const testSpinner = terminal
          .spinner(`Running ${terminal.colors.cyan(fileName)}`)
          .start();
        const result = await runTest(file, envName);

        if (result.success) {
          testSpinner.succeed(`${terminal.colors.cyan(fileName)} passed`);
        } else {
          testSpinner.fail(`${terminal.colors.cyan(fileName)} failed`);
        }

        return result;
      }),
    );

    // Print summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    terminal.blank();
    if (failed === 0) {
      terminal.success(
        `All tests passed (${terminal.colors.bold(successful.toString())} / ${results.length})`,
      );
    } else {
      terminal.error(
        `${terminal.colors.bold(failed.toString())} test(s) failed, ${terminal.colors.bold(successful.toString())} passed`,
      );
      terminal.exit(1);
    }
  } catch (error: any) {
    terminal.error(error.message);
    terminal.exit(1);
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
    terminal.error(error.message || String(error));
    return { success: false };
  }
}
