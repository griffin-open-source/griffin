import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

/**
 * Discovers test files in __griffin__ directories.
 */
export function findTestFiles(basePath: string = "."): string[] {
  const absolutePath = path.resolve(basePath);

  // Find all __griffin__ directories
  const griffinDirs = findgriffinDirectories(absolutePath);

  // Find all .ts files in those directories
  const testFiles: string[] = [];
  for (const griffinDir of griffinDirs) {
    const tsFiles = findTsFiles(griffinDir);
    testFiles.push(...tsFiles);
  }

  return testFiles;
}

function findgriffinDirectories(basePath: string): string[] {
  const pattern = path.join(basePath, "**", "__griffin__");
  return glob.sync(pattern, { absolute: true });
}

function findTsFiles(griffinDir: string): string[] {
  const pattern = path.join(griffinDir, "*.ts");
  return glob.sync(pattern, { absolute: true });
}
