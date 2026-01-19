#!/bin/bash

set -e  # Exit on error

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$(cd "$SCRIPT_DIR/../" && pwd)"
PROJECT_ROOT="$(cd "$SDK_DIR/.." && pwd)"
RUNNER_DIR="$PROJECT_ROOT/griffin-hub"

echo "🚀 Starting SDK generation..."
echo "📁 Runner directory: $RUNNER_DIR"
echo "📁 SDK target directory: $SDK_DIR"

# Ensure the SDK directory exists at the top level
echo "📂 Ensuring SDK directory exists..."
mkdir -p "$SDK_DIR"

# Generate the OpenAPI specification
echo "📝 Generating OpenAPI specification..."
cd "$RUNNER_DIR"
npm run generate:openapi

# Check if the spec was generated
SPEC_FILE="$RUNNER_DIR/openapi-spec.json"
if [ ! -f "$SPEC_FILE" ]; then
    echo "❌ Error: OpenAPI spec not found at $SPEC_FILE"
    exit 1
fi

echo "✅ OpenAPI spec generated at $SPEC_FILE"

## Update .components.schemas.Node to use oneOf instead of anyOf
# Use jq to replace anyOf with oneOf in .components.schemas.Node in the OpenAPI spec
TMP_SPEC_FILE="$RUNNER_DIR/openapi-spec.tmp.json"
jq 'if .components.schemas.Node.anyOf then .components.schemas.Node |= (del(.anyOf) + {oneOf: .anyOf}) else . end' "$SPEC_FILE" > "$TMP_SPEC_FILE"
mv "$TMP_SPEC_FILE" "$SPEC_FILE"
echo "🔄 Patched .components.schemas.Node to use oneOf"


# Generate the SDK using openapi-generator
echo "🔨 Generating TypeScript SDK with openapi-generator..."
find "$SDK_DIR/docs" -type f -delete || true
npx @openapitools/openapi-generator-cli generate \
    -i "$SPEC_FILE" \
    -g typescript-axios \
    -o "$SDK_DIR" \
    --additional-properties=npmName=griffin-hub-sdk,supportsES6=true,typescriptThreePlus=true

(cd $SDK_DIR && npm run build)
#echo "🔨 Generating TypeScript SDK with hey-api/openapi-ts..."
#npx @hey-api/openapi-ts

echo "✅ SDK generated successfully at $SDK_DIR"
echo "🎉 Done!"
