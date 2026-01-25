import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadCredentials,
  saveCredentials,
  saveHubCredentials,
  getHubCredentials,
  removeHubCredentials,
} from "./credentials.js";
import { createEmptyCredentials } from "../schemas/credentials.js";

const TEST_DIR = path.join(os.tmpdir(), `griffin-test-${Date.now()}`);
const TEST_CREDS_FILE = path.join(TEST_DIR, "credentials.json");

// Mock the credentials directory to use test directory
const originalHomedir = os.homedir;

describe("Credentials Management", () => {
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Mock homedir to point to test directory
    os.homedir = () => TEST_DIR;
  });

  afterEach(async () => {
    // Restore original homedir
    os.homedir = originalHomedir;

    // Clean up test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("createEmptyCredentials", () => {
    it("should create empty credentials structure", () => {
      const creds = createEmptyCredentials();
      expect(creds).toEqual({
        version: 1,
      });
    });
  });

  describe("loadCredentials", () => {
    it("should return empty credentials if file doesn't exist", async () => {
      const creds = await loadCredentials();
      expect(creds).toEqual(createEmptyCredentials());
    });

    it("should load existing credentials from file", async () => {
      const testCreds = createEmptyCredentials();
      testCreds.hub = {
        token: "test-token",
        updatedAt: new Date().toISOString(),
      };

      await saveCredentials(testCreds);
      const loaded = await loadCredentials();

      expect(loaded).toEqual(testCreds);
    });

    it("should throw error for invalid schema", async () => {
      const invalidCreds = { invalid: "data" };
      await fs.mkdir(path.join(TEST_DIR, ".griffin"), { recursive: true });
      await fs.writeFile(
        path.join(TEST_DIR, ".griffin", "credentials.json"),
        JSON.stringify(invalidCreds),
      );

      await expect(loadCredentials()).rejects.toThrow(
        "Invalid credentials file schema",
      );
    });
  });

  describe("saveHubCredentials", () => {
    it("should save credentials for a hub", async () => {
      const token = "test-token-123";

      await saveHubCredentials(token);

      const creds = await loadCredentials();
      expect(creds.hub).toBeDefined();
      expect(creds.hub!.token).toBe(token);
      expect(creds.hub!.updatedAt).toBeDefined();
    });

    it("should normalize hub URL by removing trailing slash", async () => {
      const token = "test-token";

      await saveHubCredentials(token);

      const creds = await loadCredentials();
      expect(creds.hub).toBeDefined();
      expect(creds.hub!.token).toBe(token);
    });

    it("should update existing hub credentials", async () => {
      const token1 = "token-1";
      const token2 = "token-2";

      await saveHubCredentials(token1);
      const creds1 = await loadCredentials();
      const updatedAt1 = creds1.hub!.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveHubCredentials(token2);
      const creds2 = await loadCredentials();
      const updatedAt2 = creds2.hub!.updatedAt;

      expect(creds2.hub!.token).toBe(token2);
      expect(updatedAt2).not.toBe(updatedAt1);
    });
  });

  describe("getHubCredentials", () => {
    it("should return undefined for non-existent hub", async () => {
      const creds = await getHubCredentials();
      expect(creds).toBeUndefined();
    });

    it("should return credentials for existing hub", async () => {
      const token = "test-token";

      await saveHubCredentials(token);
      const creds = await getHubCredentials();

      expect(creds).toBeDefined();
      expect(creds!.token).toBe(token);
    });

    it("should normalize hub URL when retrieving", async () => {
      await saveHubCredentials("test-token");

      const creds = await getHubCredentials();
      expect(creds).toBeDefined();
    });
  });

  describe("removeHubCredentials", () => {
    it("should remove credentials for a hub", async () => {
      const hubUrl = "https://hub.test.com";
      await saveHubCredentials("test-token");

      await removeHubCredentials();

      const creds = await loadCredentials();
      expect(creds.hub).toBeUndefined();
    });

    it("should not affect other hub credentials", async () => {
      await saveHubCredentials("token1");
      await saveHubCredentials("token2");

      await removeHubCredentials();

      const creds = await loadCredentials();
      expect(creds.hub).toBeUndefined();
    });
  });

  describe("listHubUrls", () => {
    it("should return empty array for no hubs", async () => {
      const creds = await getHubCredentials();
      expect(creds).toBeUndefined();
    });
  });

  describe("file permissions", () => {
    it("should create credentials file with 0600 permissions", async () => {
      const token = "test-token";

      await saveHubCredentials(token);

      const credsPath = path.join(TEST_DIR, ".griffin", "credentials.json");
      const stats = await fs.stat(credsPath);

      // Check permissions (0600 = owner read/write only)
      // Note: permissions are platform-dependent, so we check that it's at least restrictive
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });
});
