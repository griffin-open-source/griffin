import fp from "fastify-plugin";
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import jwt, { TokenOrHeader } from "@fastify/jwt";
import { jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose'
import type { AuthContext } from "../schemas/auth.js";
import path from "node:path";

export async function validateToken(token: string): Promise<any> {
  try {
    // use path.join to join the issuer and the jwks path
    const {iss, aud} = decodeJwt(token);
    if (!iss || !aud) {
      throw new Error("Invalid token");
    }
    const jwksPath = path.join(iss, '/api/auth/jwks')
    const JWKS = createRemoteJWKSet(new URL(jwksPath))
    const { payload } = await jwtVerify(token, JWKS, { issuer: iss, audience: aud })
    return payload
  } catch (error) {
    console.error('Token validation failed:', error)
    throw error
  }
}

/**
 * Fastify plugin that provides authentication based on the configured mode.
 *
 * Supports three modes:
 * - none: No authentication (request.auth.authenticated = false)
 * - api-key: Bearer token validated against configured API keys
 * - oidc: JWT validated against OIDC provider's JWKS endpoint
 *
 * Routes can specify auth requirements using config.auth:
 * - { required: true } - Requires authentication
 * - { required: true, allowedRoles: ["admin"] } - Requires specific roles (oidc only)
 * - undefined or { required: false } - Public route
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  const config = fastify.config;

  // Register bearer-auth for both api-key and oidc modes
  // We use addHook: false because we'll handle the auth check manually in onRequest
  if (config.auth.mode === "api-key") {
    await fastify.register(bearerAuth, {
      keys: new Set(config.auth.apiKeys),
      addHook: false,
    });
  }

  // Add onRequest hook to handle authentication
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const routeAuth = request.routeOptions.config?.auth;

    if (config.auth.mode === "none") {
      request.auth = { mode: "none", authenticated: false };
      return;
    }

    if (!routeAuth?.required) {
      request.auth = { mode: config.auth.mode, authenticated: false };
      return;
    }

    try {
      if (config.auth.mode === "api-key") {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({
            error: "Unauthorized",
            message: "Missing or invalid Authorization header",
          });
        }

        const token = authHeader.substring(7);
        const keys = new Set(config.auth.apiKeys || []);

        if (!keys.has(token)) {
          return reply.code(401).send({
            error: "Unauthorized",
            message: "Invalid API key",
          });
        }

        request.auth = {
          mode: "api-key",
          authenticated: true,
        };
      } else if (config.auth.mode === "oidc") {
        // Validate JWT
        try {
          const authorization = request.headers.authorization;
          if (!authorization || !authorization.startsWith("Bearer ")) {
            return reply.code(401).send({
              error: "Unauthorized",
              message: "Missing or invalid Authorization header",
            });
          }
          const token = authorization.substring(7);
          const payload = await validateToken(token);
          console.log("PAYLOAD", payload);

          request.auth = {
            mode: "oidc",
            authenticated: true,
            userId: payload.sub,
            organizationId: payload.org_id || payload.organization_id,
            roles: payload.roles || [],
          };
        } catch (err) {
          console.log("ERROR", err);
          return reply.code(401).send({
            error: "Unauthorized",
            message: "Invalid or expired token",
          });
        }
      }
    } catch (err) {
      fastify.log.error(err, "Authentication error");
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Authentication failed",
      });
    }

    // 4. Check role requirements if specified (OIDC mode only)
    if (routeAuth.allowedRoles && routeAuth.allowedRoles.length > 0) {
      if (config.auth.mode !== "oidc") {
        fastify.log.warn(
          { route: request.url, mode: config.auth.mode },
          "Route specifies allowedRoles but auth mode is not oidc",
        );
        return reply.code(403).send({
          error: "Forbidden",
          message: "Insufficient permissions",
        });
      }

      const userRoles = request.auth.roles || [];
      const hasRole = routeAuth.allowedRoles.some((role) =>
        userRoles.includes(role),
      );

      if (!hasRole) {
        return reply.code(403).send({
          error: "Forbidden",
          message: "Insufficient permissions",
        });
      }
    }
  });

  fastify.log.info(
    { mode: config.auth.mode },
    "Authentication plugin registered",
  );
};

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["config"],
});
