import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import fastify, { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import fp from "fastify-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppOptions
  extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const appPlugin: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  // Place here your custom code!
  const fastifyWithTypes = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastifyWithTypes.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastifyWithTypes.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });
  await fastify.register(cors, {
    origin: [
      "*", // TODO: tighten this up later
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true, // Required for cookie-based auth
  });
};

// Wrap with fastify-plugin to break encapsulation
// This allows decorators (like swagger) to be accessible at the root level
const app = fp(appPlugin);

export default app;
export { app, options };
