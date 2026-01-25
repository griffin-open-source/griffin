import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Value } from "typebox/value";
import {
  CredentialsFileSchema,
  type CredentialsFile,
  createEmptyCredentials,
  HubCredentials,
} from "../schemas/credentials.js";

export const CREDENTIALS_DIR = ".griffin";
export const CREDENTIALS_FILE = "credentials.json";

/**
 * Get the user-level credentials directory path (~/.griffin)
 */
export function getCredentialsDirPath(): string {
  return path.join(os.homedir(), CREDENTIALS_DIR);
}

/**
 * Get the credentials file path
 */
export function getCredentialsFilePath(): string {
  return path.join(getCredentialsDirPath(), CREDENTIALS_FILE);
}

/**
 * Check if credentials file exists
 */
export async function credentialsExist(): Promise<boolean> {
  try {
    await fs.access(getCredentialsFilePath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Load credentials file from disk
 * Returns empty credentials if file doesn't exist
 */
export async function loadCredentials(): Promise<CredentialsFile> {
  const credentialsFilePath = getCredentialsFilePath();

  try {
    const content = await fs.readFile(credentialsFilePath, "utf-8");
    const data = JSON.parse(content);

    // Validate schema
    if (Value.Check(CredentialsFileSchema, data)) {
      return data;
    }

    // Invalid schema
    const errors = [...Value.Errors(CredentialsFileSchema, data)];
    throw new Error(
      `Invalid credentials file schema:\n${errors.map((e) => `  - ${(e as any).path || "unknown"}: ${e.message}`).join("\n")}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist, return empty credentials
      return createEmptyCredentials();
    }
    throw error;
  }
}

/**
 * Save credentials file to disk with restricted permissions
 */
export async function saveCredentials(
  credentials: CredentialsFile,
): Promise<void> {
  const credentialsDirPath = getCredentialsDirPath();
  const credentialsFilePath = getCredentialsFilePath();

  // Ensure directory exists
  await fs.mkdir(credentialsDirPath, { recursive: true });

  // Validate before saving
  if (!Value.Check(CredentialsFileSchema, credentials)) {
    const errors = [...Value.Errors(CredentialsFileSchema, credentials)];
    throw new Error(
      `Invalid credentials data:\n${errors.map((e) => `  - ${(e as any).path || "unknown"}: ${e.message}`).join("\n")}`,
    );
  }

  // Write with pretty formatting and restricted permissions (0600 - read/write for owner only)
  await fs.writeFile(
    credentialsFilePath,
    JSON.stringify(credentials, null, 2),
    { encoding: "utf-8", mode: 0o600 },
  );
}

/**
 * Save hub credentials (token from login or API key from connect)
 */
export async function saveHubCredentials(token: string): Promise<void> {
  const credentials = await loadCredentials();

  credentials.hub = {
    token,
    updatedAt: new Date().toISOString(),
  };

  await saveCredentials(credentials);
}

/**
 * Get credentials for a specific hub URL
 */
export async function getHubCredentials(): Promise<HubCredentials | undefined> {
  const credentials = await loadCredentials();
  return credentials.hub;
}

/**
 * Remove credentials for a specific hub URL
 */
export async function removeHubCredentials(): Promise<void> {
  const credentials = await loadCredentials();
  delete credentials.hub;
  await saveCredentials(credentials);
}
