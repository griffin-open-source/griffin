import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import bearerAuth from "@fastify/bearer-auth";
import jwt from "@fastify/jwt";
import buildGetJwks from "get-jwks";
import type { AuthContext } from "../schemas/auth.js";

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
      keys: new Set(config.auth.apiKeys || []),
      addHook: false, // We'll call it manually based on route config
    });
  }

  // Register JWT plugin for OIDC mode
  if (config.auth.mode === "oidc" && config.auth.oidc) {
    const getJwks = buildGetJwks({
      max: 100,
      ttl: 60 * 1000, // Cache keys for 60 seconds
    });

    const verifyOptions: any = {};
    if (config.auth.oidc.audience) {
      verifyOptions.audience = config.auth.oidc.audience;
    }

    await fastify.register(jwt, {
      decode: { complete: true },
      secret: async (request: any, token: any) => {
        const decodedToken = token as any;
        const { kid, alg } = decodedToken.header;
        const { iss } = decodedToken.payload;

        // Validate issuer matches config
        if (iss !== config.auth.oidc?.issuer) {
          throw new Error("Invalid token issuer");
        }

        // Fetch public key from JWKS endpoint
        const publicKey = await getJwks.getPublicKey({
          kid,
          domain: iss,
          alg: alg as string,
        });

        return publicKey;
      },
      verify: verifyOptions,
    });
  }

  // Add onRequest hook to handle authentication
  fastify.addHook("onRequest", async (request, reply) => {
    const routeAuth = request.routeOptions.config?.auth;

    // 1. If auth mode is "none", skip auth but mark as unauthenticated
    if (config.auth.mode === "none") {
      request.auth = { mode: "none", authenticated: false };
      return;
    }

    // 2. If route doesn't require auth, skip validation
    if (!routeAuth?.required) {
      request.auth = { mode: config.auth.mode, authenticated: false };
      return;
    }

    // 3. Validate credentials based on mode
    try {
      if (config.auth.mode === "api-key") {
        // Validate bearer token against API_KEYS
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
          const decoded = await request.jwtVerify();
          const payload = decoded as any;

          request.auth = {
            mode: "oidc",
            authenticated: true,
            userId: payload.sub,
            organizationId: payload.org_id || payload.organization_id,
            roles: payload.roles || [],
          };
        } catch (err) {
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
