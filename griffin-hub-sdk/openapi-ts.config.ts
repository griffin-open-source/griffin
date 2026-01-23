import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../griffin-hub/openapi-spec.json", // sign up at app.heyapi.dev
  output: {
    path: "src",
    importFileExtension: ".js",
  },
  plugins: [
    {
      name: "@hey-api/sdk",
      operations: {
        containerName: "GriffinHubSdk",
        strategy: "single",
      },
    },
    "@hey-api/client-axios",
  ],
});
