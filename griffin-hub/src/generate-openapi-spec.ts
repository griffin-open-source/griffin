import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import app from "./app.js";
import { PlanV1Schema } from "./schemas/plans.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate OpenAPI specification file without starting the server.
 * This script creates a Fastify instance, registers all plugins and routes,
 * and exports the OpenAPI spec to a JSON file.
 */
async function generateOpenAPISpec() {
  // Create a Fastify instance with TypeBox provider
  const fastify = Fastify({
    logger: false,
  }).withTypeProvider<TypeBoxTypeProvider>();

  try {
    // Register the app plugin (which includes swagger)
    await fastify.register(app);

    // Wait for all plugins to be loaded
    await fastify.ready();

    // Get the OpenAPI specification
    const spec = fastify.swagger();

    // Determine output path (root of the project)
    const outputPath = join(__dirname, "..", "openapi-spec.json");

    // Write the spec to a file
    await writeFile(outputPath, JSON.stringify(spec, null, 2), "utf-8");

    console.log(`✅ OpenAPI spec generated successfully: ${outputPath}`);
    console.log(
      `📊 Routes documented: ${Object.keys(spec.paths || {}).length}`,
    );
  } catch (error) {
    console.error("❌ Error generating OpenAPI spec:", error);
    process.exit(1);
  } finally {
    // Close the Fastify instance (without starting the server)
    await fastify.close();
  }
}

// Run the script
generateOpenAPISpec();
