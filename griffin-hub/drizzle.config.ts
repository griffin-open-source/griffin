import "dotenv/config";
import { defineConfig, Config } from "drizzle-kit";
// Needs to refer to dist because running via npx
import { loadConfigFromEnv } from "./dist/config.js";

const config = loadConfigFromEnv();
let drizzleConfig: Config | null = null;
switch (config.repository.backend) {
  case "postgres":
    drizzleConfig = defineConfig({
      out: "./src/storage/adapters/postgres/migrations/",
      schema: "./dist/storage/adapters/postgres/schema.js",
      dialect: "postgresql",
      dbCredentials: {
        url: config.repository.connectionString!,
      },
    });
  case "sqlite":
    break;
  case "memory":
    break;
}
if (!drizzleConfig) {
  throw new Error("No drizzle config found");
}

export default drizzleConfig;
