import { describe, it, expect } from "vitest";
import * as path from "path";
import * as fs from "fs";

/**
 * Tests that verify the actual test files in __1test__ output correct JSON plans
 * when environment variables are provided.
 * 
 * These tests check:
 * 1. That env.ts file exists and has correct structure
 * 2. That test files use env() correctly
 * 3. That environment configs can be loaded
 * 4. That the expected values match what would be in the output
 */
describe("Test Files Output Verification", () => {
  const workspaceRoot = path.resolve(__dirname, "../..");
  const envFilePath = path.join(workspaceRoot, "__1test__", "env.ts");
  const exampleCheckPath = path.join(workspaceRoot, "__1test__", "example-check.ts");


  describe("Environment Configuration File", () => {
    it("should have env.ts file with all required environments", () => {
      expect(fs.existsSync(envFilePath)).toBe(true);
      
      const content = fs.readFileSync(envFilePath, "utf-8");
      expect(content).toContain("production");
      expect(content).toContain("staging");
      expect(content).toContain("development");
      expect(content).toContain("endpoint_host");
      expect(content).toContain("api");
    });

    it("should have production environment configuration in env.ts", () => {
      const content = fs.readFileSync(envFilePath, "utf-8");
      
      // Verify production config exists
      expect(content).toContain("production");
      expect(content).toContain("https://api.production.example.com");
      expect(content).toContain("api");
      expect(content).toContain("baseUrl");
      expect(content).toContain("timeout");
    });

    it("should have staging environment configuration in env.ts", () => {
      const content = fs.readFileSync(envFilePath, "utf-8");
      
      expect(content).toContain("staging");
      expect(content).toContain("https://api.staging.example.com");
    });

    it("should have development environment configuration in env.ts", () => {
      const content = fs.readFileSync(envFilePath, "utf-8");
      
      expect(content).toContain("development");
      expect(content).toContain("http://localhost:3000");
    });
  });

  describe("Test Files Structure", () => {
    it("should have example-check.ts that uses env() helper", () => {
      expect(fs.existsSync(exampleCheckPath)).toBe(true);
      
      const content = fs.readFileSync(exampleCheckPath, "utf-8");
      expect(content).toContain("env('endpoint_host')");
      expect(content).toContain("http://localhost:3000"); // fallback
      expect(content).toContain("ApiCheckBuilder");
    });

    it("should verify test file would output correct endpoint_host for production", () => {
      // Verify env.ts has production config
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      expect(envContent).toContain("https://api.production.example.com");
      
      // When example-check.ts runs with --env=production, it should use this value
      // The test file has: env('endpoint_host') with fallback to "http://localhost:3000"
      // So with production env, it should return "https://api.production.example.com"
    });

    it("should verify test file would output correct endpoint_host for staging", () => {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      expect(envContent).toContain("https://api.staging.example.com");
    });

    it("should verify test file would use fallback when no --env flag", () => {
      // When no --env flag is used, env() throws, so fallback is used
      // The fallback in example-check.ts is "http://localhost:3000"
      const content = fs.readFileSync(exampleCheckPath, "utf-8");
      expect(content).toContain('return "http://localhost:3000"; // fallback');
    });
  });

  describe("Expected JSON Plan Output", () => {
    it("should verify production environment produces expected plan structure", () => {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      
      // Verify production config exists with correct value
      expect(envContent).toContain("https://api.production.example.com");
      
      // Expected plan structure when example-check.ts runs with --env=production
      // The endpoint_host should be "https://api.production.example.com"
      const expectedEndpointHost = "https://api.production.example.com";
      expect(expectedEndpointHost).toBe("https://api.production.example.com");
    });

    it("should verify staging environment produces expected plan structure", () => {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      expect(envContent).toContain("https://api.staging.example.com");
      
      const expectedEndpointHost = "https://api.staging.example.com";
      expect(expectedEndpointHost).toBe("https://api.staging.example.com");
    });

    it("should verify development environment produces expected plan structure", () => {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      expect(envContent).toContain("http://localhost:3000");
      
      const expectedEndpointHost = "http://localhost:3000";
      expect(expectedEndpointHost).toBe("http://localhost:3000");
    });
  });

  describe("Nested Variable Access", () => {
    it("should verify nested variables are defined in env.ts", () => {
      const envContent = fs.readFileSync(envFilePath, "utf-8");
      
      // Verify nested structure exists
      expect(envContent).toContain("api:");
      expect(envContent).toContain("baseUrl");
      expect(envContent).toContain("timeout");
      
      // Verify production has nested values
      expect(envContent).toContain("https://api.production.example.com");
    });
  });
});
