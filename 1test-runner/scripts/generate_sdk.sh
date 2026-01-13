#!/bin/bash

set -e  # Exit on error

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$RUNNER_DIR/.." && pwd)"
SDK_DIR="$PROJECT_ROOT/1test-runner-sdk"

echo "🚀 Starting SDK generation..."
echo "📁 Runner directory: $RUNNER_DIR"
echo "📁 SDK target directory: $SDK_DIR"

# Ensure the SDK directory exists at the top level
echo "📂 Ensuring SDK directory exists..."
mkdir -p "$SDK_DIR"

# Check if @hey-api/openapi-ts is installed, if not install it
echo "🔍 Checking for @hey-api/openapi-ts..."
if ! command -v openapi-ts &> /dev/null && ! npx --no @hey-api/openapi-ts --version &> /dev/null 2>&1; then
    echo "📦 Installing @hey-api/openapi-ts..."
    cd "$RUNNER_DIR"
    npm install --save-dev @hey-api/openapi-ts
else
    echo "✅ @hey-api/openapi-ts is accessible"
fi

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

# Generate the SDK using @hey-api/openapi-ts
echo "🔨 Generating TypeScript SDK..."
npx @hey-api/openapi-ts \
    --input "$SPEC_FILE" \
    --output "$SDK_DIR" \
    --client @hey-api/client-fetch
    

echo "✅ SDK generated successfully at $SDK_DIR"
echo "🎉 Done!"
