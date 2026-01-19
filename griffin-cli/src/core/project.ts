import fs from "node:fs/promises";
import path from "node:path";

/**
 * Auto-detect project ID from the environment
 *
 * Priority:
 * 1. package.json name field
 * 2. Directory name
 */
export async function detectProjectId(): Promise<string> {
  try {
    // Try to find package.json walking up from current directory
    const packageJsonPath = await findPackageJson(process.cwd());

    if (packageJsonPath) {
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);

      if (pkg.name && typeof pkg.name === "string") {
        return pkg.name;
      }
    }
  } catch (error) {
    // Fall through to directory name
  }

  // Fallback to directory name
  return path.basename(process.cwd());
}

/**
 * Find package.json by walking up the directory tree
 */
async function findPackageJson(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, "package.json");

    try {
      await fs.access(packageJsonPath);
      return packageJsonPath;
    } catch {
      // Not found, go up one level
      currentDir = path.dirname(currentDir);
    }
  }

  return null;
}
