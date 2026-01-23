import { randomBytes } from "node:crypto";
import { terminal } from "../utils/terminal.js";

/**
 * Generate a cryptographically secure API key for griffin-runner authentication.
 *
 * The key format is: grfn_sk_<48-character-hex-string>
 * - grfn: Griffin prefix
 * - sk: Secret Key
 * - 48 hex chars: 24 random bytes = 192 bits of entropy
 */
export async function executeGenerateKey(): Promise<void> {
  // Generate 24 random bytes (192 bits of entropy)
  const keyBytes = randomBytes(24);

  // Convert to hex string
  const keySecret = keyBytes.toString("hex");

  // Add prefix following the pattern: grfn_sk_<secret>
  const apiKey = `grfn_sk_${keySecret}`;

  terminal.blank();
  terminal.success("Generated API key:");
  terminal.blank();
  terminal.log(`  ${terminal.colors.cyan(apiKey)}`);
  terminal.blank();
  terminal.warn("Store this key securely - it cannot be retrieved later.");
  terminal.blank();
  terminal.info("To use this key:");
  terminal.dim(
    "  1. Add it to your runner's AUTH_API_KEYS environment variable:",
  );
  terminal.dim(`     AUTH_API_KEYS=${apiKey}`);
  terminal.dim("  2. Or add it to your .griffinrc.json:");
  terminal.dim(`     { "runner": { "apiToken": "${apiKey}" } }`);
  terminal.dim("  3. Or pass it via environment variable:");
  terminal.dim(`     GRIFFIN_API_TOKEN=${apiKey}`);
  terminal.blank();
}
