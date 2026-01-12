import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadEnvironmentConfig } from "./env-loader";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

// Mock execSync to avoid actual tsx execution in tests
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("loadEnvironmentConfig", () => {
  let tempDir: string;
  let envFilePath: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "1test-env-test-"));
    envFilePath = path.join(tempDir, "__1test__", "env.ts");
    fs.mkdirSync(path.dirname(envFilePath), { recursive: true });
    
    // Mock which tsx to return success
    vi.mocked(execSync).mockImplementation((command: string, options?: any) => {
      if (command === "which tsx") {
        return Buffer.from("/usr/local/bin/tsx");
      }
      // Mock tsx execution - return JSON stringified config as string
      if (command.includes("tsx") && command.includes(".1test-env-loader-temp.ts")) {
        const envContent = fs.readFileSync(envFilePath, "utf-8");
        // Extract the default export object
        const cleaned = envContent
          .replace(/export default\s*/, "")
          .replace(/;?\s*$/, "")
          .trim();
        try {
          // Use Function constructor to safely evaluate
          const configObj = new Function(`return ${cleaned}`)();
          // Return as string (execSync with encoding: 'utf-8' returns string)
          return JSON.stringify(configObj);
        } catch (e: any) {
          throw new Error(`Failed to parse env.ts: ${e.message}`);
        }
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it("should load production environment configuration", () => {
    // Create env.ts file
    const envContent = `export default {
      production: {
        endpoint_host: "https://api.production.example.com",
        api: {
          baseUrl: "https://api.production.example.com",
          timeout: 30000,
        },
        var1: "production-value-1",
      },
      staging: {
        endpoint_host: "https://api.staging.example.com",
      },
      development: {
        endpoint_host: "http://localhost:3000",
      },
    };`;

    fs.writeFileSync(envFilePath, envContent);

    const config = loadEnvironmentConfig(tempDir, "production");

    expect(config).toBeDefined();
    expect(config.endpoint_host).toBe("https://api.production.example.com");
    expect(config.api.baseUrl).toBe("https://api.production.example.com");
    expect(config.api.timeout).toBe(30000);
    expect(config.var1).toBe("production-value-1");
  });

  it("should load staging environment configuration", () => {
    const envContent = `export default {
      production: {
        endpoint_host: "https://api.production.example.com",
      },
      staging: {
        endpoint_host: "https://api.staging.example.com",
        api: {
          baseUrl: "https://api.staging.example.com",
        },
      },
      development: {
        endpoint_host: "http://localhost:3000",
      },
    };`;

    fs.writeFileSync(envFilePath, envContent);

    const config = loadEnvironmentConfig(tempDir, "staging");

    expect(config).toBeDefined();
    expect(config.endpoint_host).toBe("https://api.staging.example.com");
    expect(config.api.baseUrl).toBe("https://api.staging.example.com");
  });

  it("should load development environment configuration", () => {
    const envContent = `export default {
      production: {
        endpoint_host: "https://api.production.example.com",
      },
      staging: {
        endpoint_host: "https://api.staging.example.com",
      },
      development: {
        endpoint_host: "http://localhost:3000",
        api: {
          baseUrl: "http://localhost:3000",
          timeout: 10000,
        },
      },
    };`;

    fs.writeFileSync(envFilePath, envContent);

    const config = loadEnvironmentConfig(tempDir, "development");

    expect(config).toBeDefined();
    expect(config.endpoint_host).toBe("http://localhost:3000");
    expect(config.api.baseUrl).toBe("http://localhost:3000");
    expect(config.api.timeout).toBe(10000);
  });

  it("should throw error when env.ts file does not exist", () => {
    expect(() => {
      loadEnvironmentConfig(tempDir, "production");
    }).toThrow("Environment file not found");
  });

  it("should throw error when environment does not exist", () => {
    const envContent = `export default {
      production: {
        endpoint_host: "https://api.production.example.com",
      },
      staging: {
        endpoint_host: "https://api.staging.example.com",
      },
    };`;

    fs.writeFileSync(envFilePath, envContent);

    expect(() => {
      loadEnvironmentConfig(tempDir, "nonexistent");
    }).toThrow("Environment \"nonexistent\" not found in env.ts");
  });

  it("should throw error with available environments listed", () => {
    const envContent = `export default {
      production: {
        endpoint_host: "https://api.production.example.com",
      },
      staging: {
        endpoint_host: "https://api.staging.example.com",
      },
    };`;

    fs.writeFileSync(envFilePath, envContent);

    try {
      loadEnvironmentConfig(tempDir, "nonexistent");
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.message).toContain("Environment \"nonexistent\" not found");
      expect(error.message).toContain("Available environments");
      expect(error.message).toContain("production");
      expect(error.message).toContain("staging");
    }
  });
});
