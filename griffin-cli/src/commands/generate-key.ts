import { randomBytes } from "node:crypto";

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

  console.log("\n✓ Generated API key:\n");
  console.log(`  ${apiKey}\n`);
  console.log("⚠️  Store this key securely - it cannot be retrieved later.\n");
  console.log("To use this key:");
  console.log(
    "  1. Add it to your runner's AUTH_API_KEYS environment variable:",
  );
  console.log(`     AUTH_API_KEYS=${apiKey}`);
  console.log("  2. Or add it to your .griffinrc.json:");
  console.log(`     { "runner": { "apiToken": "${apiKey}" } }`);
  console.log("  3. Or pass it via environment variable:");
  console.log(`     GRIFFIN_API_TOKEN=${apiKey}\n`);
}
