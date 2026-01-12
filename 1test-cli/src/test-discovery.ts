import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Discovers test files in __1test__ directories.
 */
export function findTestFiles(basePath: string = '.'): string[] {
  const absolutePath = path.resolve(basePath);
  
  // Find all __1test__ directories
  const 1testDirs = find1testDirectories(absolutePath);
  
  // Find all .ts files in those directories
  const testFiles: string[] = [];
  for (const 1testDir of 1testDirs) {
    const tsFiles = findTsFiles(1testDir);
    testFiles.push(...tsFiles);
  }
  
  return testFiles;
}

function find1testDirectories(basePath: string): string[] {
  const pattern = path.join(basePath, '**', '__1test__');
  return glob.sync(pattern, { absolute: true });
}

function findTsFiles(1testDir: string): string[] {
  const pattern = path.join(1testDir, '*.ts');
  return glob.sync(pattern, { absolute: true });
}
