import { Type, type Static } from "typebox";

/**
 * Credentials file schema for storing user-level authentication
 * Stored in ~/.griffin/credentials.json
 *
 * This file stores tokens and API keys scoped to the user across all projects.
 */

export const HubCredentialsSchema = Type.Object({
  token: Type.String(),
  updatedAt: Type.String(), // ISO timestamp
});

export type HubCredentials = Static<typeof HubCredentialsSchema>;

export const CredentialsFileSchema = Type.Object({
  version: Type.Literal(1),
  hub: Type.Optional(HubCredentialsSchema),
});

export type CredentialsFile = Static<typeof CredentialsFileSchema>;

/**
 * Create an empty credentials file
 */
export function createEmptyCredentials(): CredentialsFile {
  return {
    version: 1,
  };
}
