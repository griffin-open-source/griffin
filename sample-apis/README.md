# Sample APIs

A simple JSON API server for testing griffin functionality. This server provides basic CRUD operations and can be extended as needed for testing different scenarios.

## Features

- Health check endpoint
- CRUD operations for items
- JSON responses
- In-memory data store (resets on server restart)

## Installation

```bash
npm install
npm run build
```

## Running

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

The server will run on port 3000 by default, or the port specified in the `PORT` environment variable.

## API Endpoints

### Health Check
- **GET** `/health`
- Returns: `{ status: "ok", timestamp: "..." }`

### Get All Items
- **GET** `/api/items`
- Returns: `{ items: [...] }`

### Get Item by ID
- **GET** `/api/items/:id`
- Returns: `{ id: number, name: string, value: number }`
- 404 if not found

### Create Item
- **POST** `/api/items`
- Body: `{ name: string, value: number }`
- Returns: Created item with generated ID

### Update Item
- **PUT** `/api/items/:id`
- Body: `{ name?: string, value?: number }`
- Returns: Updated item
- 404 if not found

### Delete Item
- **DELETE** `/api/items/:id`
- Returns: 204 No Content
- 404 if not found

## Example Usage

```bash
# Start the server
npm run dev

# In another terminal, test the API
curl http://localhost:3000/health
curl http://localhost:3000/api/items
curl -X POST http://localhost:3000/api/items -H "Content-Type: application/json" -d '{"name":"Test","value":42}'
```

## Testing with griffin

Create a test file in `__griffin__/` directory:

```typescript
import { GET, POST, ApiCheckBuilder, JSON, START, END, Frequency } from "../griffin-ts/src/index";

const builder = new ApiCheckBuilder({
  name: "sample-api-test",
  endpoint_host: "http://localhost:3000"
});

const monitor = builder
  .addEndpoint("health", {
    method: GET,
    response_format: JSON,
    path: "/health"
  })
  .addEndpoint("get_items", {
    method: GET,
    response_format: JSON,
    path: "/api/items"
  })
  .addEdge(START, "health")
  .addEdge("health", "get_items")
  .addEdge("get_items", END);

monitor.create({
  frequency: Frequency.every(1).minute()
});
```

Then run:
```bash
node griffin-cli/dist/cli.js run-local
```
