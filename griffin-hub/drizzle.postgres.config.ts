import { defineConfig } from "drizzle-kit";

/**
 * Drizzle configuration for PostgreSQL backend.
 *
 * Usage:
 * - Generate migrations: drizzle-kit generate --config=drizzle.postgres.config.ts
 * - Push schema (dev): drizzle-kit push --config=drizzle.postgres.config.ts
 *
 * For push operations, set POSTGRESQL_URL or REPOSITORY_CONNECTION_STRING environment variable.
 */

const connectionString = process.env.DATABASE_URL;

export default defineConfig({
  out: "./src/storage/adapters/postgres/migrations",
  schema: "./src/storage/adapters/postgres/schema.ts",
  dialect: "postgresql",
  // dbCredentials only needed for push/pull operations
  ...(connectionString && {
    dbCredentials: {
      url: connectionString,
    },
  }),
});
