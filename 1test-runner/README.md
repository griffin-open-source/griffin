# 1test Runner

The 1test Runner is an orchestration service responsible for scheduling and executing API tests. It ensures tests run according to their configured frequencies (e.g., every 15 minutes, every minute, etc.).

## Status

🚧 **In Development** - The runner service structure is in place, but full implementation is pending.

## Planned Features

- Schedule tests based on frequency configuration
- Execute test plans using the plan executor
- Store execution results and logs in PostgreSQL
- Provide REST API for CLI to deploy tests and retrieve logs
- Support for multiple test plans with different frequencies

## Architecture

The runner will:
1. Accept test plan deployments from the CLI
2. Store test plans in PostgreSQL
3. Schedule test executions using cron jobs (node-cron)
4. Execute tests using the plan executor
5. Store results and logs for retrieval

## Running with Docker (Coming Soon)

```bash
docker run -it -e POSTGRESQL_URL=postgresql://some-db-instance.aws.com 1test:runner
```

## Development

```bash
npm install
npm run build
npm run dev
```

## API Endpoints (Planned)

- `POST /api/tests/deploy` - Deploy a test plan
- `GET /api/tests/:name/logs` - Get logs for a test
- `POST /api/tests/:name/execute` - Execute a test immediately
- `GET /health` - Health check endpoint

## Environment Variables

- `POSTGRESQL_URL` - PostgreSQL connection string for storing test results and logs (required)
- `PORT` - Server port (default: 3000)
