import { findTestFiles } from '../test-discovery';
import { runTestFile } from '../test-runner';

export async function executeRunLocal(): Promise<void> {
  console.log('Running tests locally');
  console.log('');

  const testFiles = findTestFiles();

  if (testFiles.length === 0) {
    console.error('No test files found. Looking for .ts files in __1test__ directories.');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test file(s):`);
  testFiles.forEach((file) => console.log(`  - ${file}`));
  console.log('');

  const results = await Promise.all(
    testFiles.map(async (file) => {
      const fileName = require('path').basename(file);
      console.log(`Running ${fileName}`);
      const result = await runTest(file);
      return result;
    })
  );

  // Print summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  console.log('');
  console.log(`Summary: ${successful} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function runTest(file: string): Promise<{ success: boolean }> {
  try {
    const result = await runTestFile(file);
    const testSuccess = displayResults(result.result);
    // Use the actual test execution result, not just whether the file ran
    return { success: testSuccess };
  } catch (error: any) {
    console.error('ERROR: Failed to run test');
    console.error(error.message || String(error));
    return { success: false };
  }
}

function displayResults(result: any): boolean {
  if (!result) return false;

  const success = result.success || false;
  const nodeResults = result.results || [];
  const errors = result.errors || [];

  nodeResults.forEach((nodeResult: any) => {
    const nodeId = nodeResult.nodeId || 'unknown';
    const nodeSuccess = nodeResult.success || false;

    const status = nodeSuccess ? '.' : 'E';
    process.stdout.write(status);

    if (!nodeSuccess) {
      const error = nodeResult.error || 'Unknown error';
      console.log('');
      console.log(`ERROR in ${nodeId}: ${error}`);
    }
  });

  console.log('');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach((error: string) => console.log(`  - ${error}`));
  }

  // Check if any node failed or if there are errors
  const anyFailed =
    nodeResults.some((nodeResult: any) => !nodeResult.success) || errors.length > 0;

  const testPassed = success && !anyFailed;
  
  if (testPassed) {
    console.log('✓ Test passed');
  } else {
    console.log('✗ Test failed');
  }
  
  return testPassed;
}
