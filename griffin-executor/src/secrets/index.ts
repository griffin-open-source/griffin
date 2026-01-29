/**
 * Secret management for griffin monitor executor.
 *
 * This module provides:
 * - SecretProvider interface for implementing custom providers
 * - SecretProviderRegistry for managing multiple providers
 * - Secret resolution utilities for test monitors
 * - Built-in providers: env, aws, vault
 */

// Core types
export {
  type SecretProvider,
  type SecretRef,
  type SecretRefData,
  type SecretResolveOptions,
  SecretResolutionError,
  isSecretRef,
  isStringLiteral,
} from "./types.js";

// Registry
export { SecretProviderRegistry } from "./registry.js";

// Resolution utilities
export {
  resolveSecretsInMonitor,
  collectSecretsFromMonitor,
  planHasSecrets,
} from "./resolver.js";

// Providers
export {
  EnvSecretProvider,
  type EnvSecretProviderOptions,
  AwsSecretsManagerProvider,
  type AwsSecretsManagerProviderOptions,
  type AwsSecretsManagerClient,
  VaultProvider,
  type VaultProviderOptions,
  type VaultHttpClient,
} from "./providers/index.js";
