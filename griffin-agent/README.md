# griffin-agent

Execution agent for distributed Griffin test execution.

## Overview

The Griffin Agent is a worker process that:

- Registers with the Griffin Hub
- Polls a job queue for execution tasks
- Executes test plans using `griffin-plan-executor`
- Reports results back to the Hub via HTTP API
- Sends periodic heartbeats to maintain online status

Agents enable distributed, multi-location test execution. Each agent runs in a specific **location** (e.g., `us-east-1`, `eu-west-1`, `on-prem`) and only processes jobs for that location.

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Configuration

Configure via environment variables:

```bash
# Required
export AGENT_LOCATION="us-east-1"
export HUB_URL="https://griffin-hub.example.com"
export POSTGRESQL_URL="postgresql://user:pass@localhost/griffin"

# Optional
export HUB_API_KEY="your-api-key"
export AGENT_METADATA='{"region":"us-east","az":"us-east-1a"}'
export QUEUE_BACKEND="postgres"  # default: postgres
export QUEUE_NAME="plan-executions"  # default: plan-executions
export HEARTBEAT_ENABLED="true"  # default: true
export HEARTBEAT_INTERVAL_SECONDS="30"  # default: 30
```

### Running

```bash
npm start
```

## Architecture

### Agent Lifecycle

1. **Startup**: Agent registers with the Hub, receives an agent ID
2. **Heartbeat Loop**: Sends periodic heartbeats to Hub (every 30s by default)
3. **Worker Loop**: Polls queue for jobs matching agent's location
4. **Job Execution**: Executes plan, reports results to Hub via API
5. **Shutdown**: Stops accepting jobs, completes current job, deregisters from Hub

### Queue Backends

The agent consumes jobs from a queue backend:

- **Postgres** (default): Uses `SELECT FOR UPDATE SKIP LOCKED` for safe concurrent consumption
- **SQS**: (planned) AWS SQS queue consumer
- **Redis**: (planned) Redis queue consumer

### Communication with Hub

The agent communicates with the Hub via HTTP API:

- `POST /agents/register` - Register on startup
- `POST /agents/:id/heartbeat` - Send periodic heartbeats
- `DELETE /agents/:id` - Deregister on shutdown
- `PATCH /runs/:id` - Update job run status and results
- `GET /config/:org/:env/targets/:key` - Fetch target configuration

## Configuration Reference

### Required Variables

| Variable         | Description                              | Example                                    |
| ---------------- | ---------------------------------------- | ------------------------------------------ |
| `AGENT_LOCATION` | Location identifier for this agent       | `us-east-1`, `eu-west-1`, `on-prem`        |
| `HUB_URL`        | Griffin Hub API base URL                 | `https://griffin-hub.example.com`          |
| `POSTGRESQL_URL` | PostgreSQL connection string (for queue) | `postgresql://user:pass@localhost/griffin` |

### Optional Variables

| Variable                     | Default           | Description                                        |
| ---------------------------- | ----------------- | -------------------------------------------------- |
| `HUB_API_KEY`                | -                 | Optional API key for Hub authentication            |
| `AGENT_METADATA`             | -                 | Optional JSON metadata for agent display/filtering |
| `QUEUE_BACKEND`              | `postgres`        | Queue backend (`postgres`, `sqs`, `redis`)         |
| `QUEUE_NAME`                 | `plan-executions` | Queue name to consume from                         |
| `QUEUE_POLL_INTERVAL`        | `1000`            | Initial poll interval (ms)                         |
| `QUEUE_MAX_POLL_INTERVAL`    | `30000`           | Max poll interval with backoff (ms)                |
| `HEARTBEAT_ENABLED`          | `true`            | Enable heartbeat loop                              |
| `HEARTBEAT_INTERVAL_SECONDS` | `30`              | Heartbeat interval (seconds)                       |
| `PLAN_EXECUTION_TIMEOUT`     | `30000`           | HTTP request timeout for plan execution (ms)       |

### Secret Provider Configuration

| Variable             | Default | Description                                         |
| -------------------- | ------- | --------------------------------------------------- |
| `SECRET_PROVIDERS`   | `env`   | Comma-separated list of providers (`env,aws,vault`) |
| `SECRET_ENV_PREFIX`  | -       | Optional prefix for env var secrets                 |
| `AWS_SECRETS_REGION` | -       | AWS region for Secrets Manager                      |
| `AWS_SECRETS_PREFIX` | -       | Optional prefix for AWS secrets                     |
| `VAULT_ADDR`         | -       | HashiCorp Vault address                             |
| `VAULT_TOKEN`        | -       | Vault authentication token                          |
| `VAULT_NAMESPACE`    | -       | Vault namespace                                     |
| `VAULT_KV_VERSION`   | `2`     | Vault KV version (1 or 2)                           |
| `VAULT_PREFIX`       | -       | Optional prefix for Vault secrets                   |

## Deployment

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

```bash
docker build -t griffin-agent .
docker run -e AGENT_LOCATION=us-east-1 \
           -e HUB_URL=https://hub.example.com \
           -e POSTGRESQL_URL=postgresql://... \
           griffin-agent
```

### AWS ECS

```json
{
  "family": "griffin-agent",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/griffin-agent",
  "containerDefinitions": [
    {
      "name": "agent",
      "image": "griffin-agent:latest",
      "environment": [
        { "name": "AGENT_LOCATION", "value": "us-east-1" },
        { "name": "HUB_URL", "value": "https://hub.example.com" }
      ],
      "secrets": [
        { "name": "POSTGRESQL_URL", "valueFrom": "arn:aws:secretsmanager:..." }
      ]
    }
  ]
}
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: griffin-agent-us-east-1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: griffin-agent
      location: us-east-1
  template:
    metadata:
      labels:
        app: griffin-agent
        location: us-east-1
    spec:
      containers:
        - name: agent
          image: griffin-agent:latest
          env:
            - name: AGENT_LOCATION
              value: "us-east-1"
            - name: HUB_URL
              value: "https://griffin-hub.example.com"
            - name: POSTGRESQL_URL
              valueFrom:
                secretKeyRef:
                  name: griffin-db
                  key: connection-string
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run locally
npm start
```

## Monitoring

The agent logs key events to stdout:

- Agent registration/deregistration
- Job polling and execution
- Heartbeat failures
- Errors and warnings

Recommended log aggregation: Datadog, CloudWatch Logs, ELK Stack

## Troubleshooting

### Agent fails to register

- Check `HUB_URL` is correct and accessible
- Verify Hub is running and healthy
- Check network connectivity and firewall rules

### No jobs being processed

- Verify `AGENT_LOCATION` matches the location in job queue
- Check queue contains jobs for this location
- Ensure PostgreSQL connection is healthy

### Heartbeat failures

- Check network connectivity to Hub
- Verify Hub is responding to heartbeat requests
- Increase `HEARTBEAT_INTERVAL_SECONDS` if needed

## License

ISC
