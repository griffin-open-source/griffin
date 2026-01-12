import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Discovers test files in __1test__ directories.
 */
export function findTestFiles(basePath: string = '.'): string[] {
  const absolutePath = path.resolve(basePath);
  
  // Find all __1test__ directories
  const testDirs = findTestDirectories(absolutePath);
  
  // Find all .ts files in those directories
  const testFiles: string[] = [];
  for (const testDir of testDirs) {
    const tsFiles = findTsFiles(testDir);
    testFiles.push(...tsFiles);
  }
  
  return testFiles;
}

function findTestDirectories(basePath: string): string[] {
  const pattern = path.join(basePath, '**', '__1test__');
  return glob.sync(pattern, { absolute: true });
}

function findTsFiles(testDir: string): string[] {
  const pattern = path.join(testDir, '*.ts');
  return glob.sync(pattern, { absolute: true });
}
