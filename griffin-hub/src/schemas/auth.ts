import { Type, Static } from "typebox";

/**
 * Auth context attached to request after authentication
 * Contains information about the authenticated request
 */
export const AuthContextSchema = Type.Object({
  mode: Type.Union([
    Type.Literal("none"),
    Type.Literal("api-key"),
    Type.Literal("oidc"),
  ]),
  authenticated: Type.Boolean(),
  // Only present in oidc mode
  userId: Type.Optional(Type.String()),
  organizationId: Type.Optional(Type.String()),
  roles: Type.Optional(Type.Array(Type.String())),
});

export type AuthContext = Static<typeof AuthContextSchema>;

/**
 * Route-level auth requirements (for route config)
 * Used to specify which routes require authentication
 */
export const RouteAuthConfigSchema = Type.Object({
  // If true, auth is required. If false/undefined, route is public
  required: Type.Optional(Type.Boolean()),
  // Roles that can access this route (oidc mode only)
  allowedRoles: Type.Optional(Type.Array(Type.String())),
});

export type RouteAuthConfig = Static<typeof RouteAuthConfigSchema>;
