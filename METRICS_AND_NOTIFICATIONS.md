# Griffin Metrics and Notifications Architecture

This document describes the architecture for metrics aggregation, reporting, and notifications across Griffin's standalone (open-source) and cloud deployment modes.

## Goals

1. **Unified API surface**: Both standalone and cloud expose identical metrics and notification APIs
2. **Standalone simplicity**: Open-source users get core functionality without external dependencies
3. **Cloud scalability**: Paid version leverages event streaming for high-volume, multi-tenant workloads
4. **Integration flexibility**: Users can connect Griffin to their existing monitoring stack via webhooks or native integrations

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Griffin Hub                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  Metrics API    │    │  Notifications  │    │  Integrations   │         │
│  │  /metrics/*     │    │  Rules Engine   │    │  (Cloud only)   │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│  ┌────────┴──────────────────────┴──────────────────────┴────────┐         │
│  │                      Metrics Service                          │         │
│  │  - Aggregation queries                                        │         │
│  │  - Time-series computation                                    │         │
│  │  - Notification rule evaluation                               │         │
│  └────────┬──────────────────────────────────────────────────────┘         │
│           │                                                                 │
├───────────┼─────────────────────────────────────────────────────────────────┤
│           │                                                                 │
│  ┌────────┴────────┐                    ┌─────────────────┐                │
│  │   STANDALONE    │                    │      CLOUD      │                │
│  │   PostgreSQL    │                    │  ClickHouse /   │                │
│  │   Aggregation   │                    │  Athena + S3    │                │
│  └─────────────────┘                    └─────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Metrics System

### Core Metrics

| Category | Metric | Description | Computation |
|----------|--------|-------------|-------------|
| **Reliability** | `success_rate` | Percentage of successful runs | `successful_runs / total_runs * 100` |
| **Reliability** | `failure_count` | Number of failed runs in period | `COUNT WHERE success = false` |
| **Reliability** | `error_distribution` | Breakdown of error types | Group by error message patterns |
| **Latency** | `p50_duration_ms` | Median execution time | 50th percentile of `duration_ms` |
| **Latency** | `p95_duration_ms` | 95th percentile execution time | 95th percentile of `duration_ms` |
| **Latency** | `p99_duration_ms` | 99th percentile execution time | 99th percentile of `duration_ms` |
| **Latency** | `avg_duration_ms` | Average execution time | `AVG(duration_ms)` |
| **Availability** | `uptime_percent` | Ratio of passing scheduled runs | `scheduled_passing / scheduled_total * 100` |
| **Volume** | `run_count` | Total runs in period | `COUNT(*)` |
| **Volume** | `runs_per_hour` | Average runs per hour | `run_count / hours_in_period` |

### Metrics API

All endpoints return metrics scoped to the authenticated organization.

#### GET /metrics/summary

Returns high-level health summary across all monitors.

**Query Parameters:**
- `environment` (optional): Filter by environment name
- `period` (optional): Time window - `1h`, `6h`, `24h`, `7d`, `30d` (default: `24h`)

**Response:**
```json
{
  "period": "24h",
  "period_start": "2026-01-27T12:00:00Z",
  "period_end": "2026-01-28T12:00:00Z",
  "monitors": {
    "total": 25,
    "passing": 23,
    "failing": 2,
    "no_recent_runs": 0
  },
  "runs": {
    "total": 1200,
    "successful": 1176,
    "failed": 24,
    "success_rate": 98.0
  },
  "latency": {
    "p50_duration_ms": 450,
    "p95_duration_ms": 1200,
    "p99_duration_ms": 2100
  },
  "uptime_percent": 98.0,
  "failing_plans": [
    {
      "monitor_id": "monitor_abc123",
      "monitor_name": "checkout-flow",
      "last_failure_at": "2026-01-28T11:30:00Z",
      "consecutive_failures": 3
    }
  ]
}
```

#### GET /metrics/monitors

Returns metrics for all monitors with pagination.

**Query Parameters:**
- `environment` (optional): Filter by environment
- `period` (optional): Time window (default: `24h`)
- `status` (optional): Filter by health status - `healthy`, `degraded`, `failing`
- `sort` (optional): Sort field - `name`, `success_rate`, `p95_duration_ms`, `run_count` (default: `name`)
- `order` (optional): Sort order - `asc`, `desc` (default: `asc`)
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "data": [
    {
      "monitor_id": "monitor_abc123",
      "monitor_name": "checkout-flow",
      "environment": "production",
      "status": "healthy",
      "success_rate": 99.5,
      "run_count": 48,
      "p50_duration_ms": 320,
      "p95_duration_ms": 890,
      "last_run_at": "2026-01-28T11:45:00Z",
      "last_success_at": "2026-01-28T11:45:00Z",
      "last_failure_at": "2026-01-27T08:15:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

**Health Status Logic:**
- `healthy`: success_rate >= 95% AND no failures in last 3 runs
- `degraded`: success_rate >= 80% OR (success_rate >= 95% AND failure in last 3 runs)
- `failing`: success_rate < 80% OR last run failed

#### GET /metrics/monitors/:monitorId

Returns detailed metrics for a specific monitor.

**Query Parameters:**
- `environment` (optional): Filter by environment
- `period` (optional): Time window (default: `24h`)

**Response:**
```json
{
  "monitor_id": "monitor_abc123",
  "monitor_name": "checkout-flow",
  "environment": "production",
  "period": "24h",
  "period_start": "2026-01-27T12:00:00Z",
  "period_end": "2026-01-28T12:00:00Z",
  "status": "healthy",
  "runs": {
    "total": 48,
    "successful": 47,
    "failed": 1,
    "success_rate": 97.9
  },
  "latency": {
    "min_duration_ms": 210,
    "avg_duration_ms": 345,
    "p50_duration_ms": 320,
    "p95_duration_ms": 890,
    "p99_duration_ms": 1100,
    "max_duration_ms": 1250
  },
  "uptime_percent": 97.9,
  "last_run": {
    "id": "run_xyz789",
    "status": "completed",
    "success": true,
    "duration_ms": 315,
    "started_at": "2026-01-28T11:45:00Z"
  },
  "recent_failures": [
    {
      "id": "run_fail123",
      "started_at": "2026-01-27T18:30:00Z",
      "errors": ["Assertion failed: expected status 200, got 503"]
    }
  ],
  "error_distribution": {
    "assertion_failed": 1,
    "timeout": 0,
    "connection_error": 0
  }
}
```

#### GET /metrics/monitors/:monitorId/history

Returns time-series metrics for trend visualization.

**Query Parameters:**
- `environment` (optional): Filter by environment
- `period` (required): Time window - `24h`, `7d`, `30d`, `90d`
- `resolution` (optional): Data point granularity - `5m`, `1h`, `1d` (default: auto-selected based on period)

**Response:**
```json
{
  "monitor_id": "monitor_abc123",
  "monitor_name": "checkout-flow",
  "period": "7d",
  "resolution": "1h",
  "data_points": [
    {
      "timestamp": "2026-01-21T12:00:00Z",
      "run_count": 2,
      "success_rate": 100.0,
      "p50_duration_ms": 310,
      "p95_duration_ms": 450
    },
    {
      "timestamp": "2026-01-21T13:00:00Z",
      "run_count": 2,
      "success_rate": 50.0,
      "p50_duration_ms": 890,
      "p95_duration_ms": 1200
    }
  ]
}
```

**Resolution Defaults:**
- `24h` → `5m` (288 data points)
- `7d` → `1h` (168 data points)
- `30d` → `1d` (30 data points)
- `90d` → `1d` (90 data points)

### Metrics Storage

#### Standalone (PostgreSQL)

Metrics are computed on-demand by aggregating the `runs` table. For performance, we add materialized views or summary tables that are refreshed periodically.

**New tables:**

```sql
-- Hourly aggregates, refreshed every 5 minutes
CREATE TABLE run_metrics_hourly (
  monitor_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  hour TIMESTAMPTZ NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  -- Store sorted durations for percentile calculation
  duration_values INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (monitor_id, environment, hour)
);

-- Daily aggregates, refreshed every hour
CREATE TABLE run_metrics_daily (
  monitor_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  day DATE NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  p50_duration_ms INTEGER,
  p95_duration_ms INTEGER,
  p99_duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (monitor_id, environment, day)
);

-- Index for efficient time-range queries
CREATE INDEX idx_run_metrics_hourly_time ON run_metrics_hourly (hour DESC);
CREATE INDEX idx_run_metrics_daily_time ON run_metrics_daily (day DESC);
```

**Aggregation strategy:**
1. On run completion, update the current hour's `run_metrics_hourly` row
2. Background job rolls up hourly data to daily at the start of each hour
3. Queries for periods <= 24h use hourly table; longer periods use daily table
4. Raw `runs` table used for "recent runs" queries and real-time data

**Data retention:**
- `runs` table: 30 days (configurable via `RUNS_RETENTION_DAYS`)
- `run_metrics_hourly`: 7 days
- `run_metrics_daily`: 90 days (configurable via `METRICS_RETENTION_DAYS`)

#### Cloud (ClickHouse/Athena)

Metrics are computed from the S3 data lake populated by the Kinesis pipeline (see `EVENTS_ARCHITECTURE.md`).

**Query routing:**
- Real-time queries (last 1h): PostgreSQL `runs` table
- Historical queries (>1h): ClickHouse/Athena
- The metrics service abstracts this routing from API consumers

**ClickHouse materialized views:**

```sql
-- Aggregated metrics view, updated continuously
CREATE MATERIALIZED VIEW run_metrics_mv
ENGINE = SummingMergeTree()
PARTITION BY (organizationId, toYYYYMM(timestamp))
ORDER BY (organizationId, monitorId, environment, toStartOfHour(timestamp))
AS SELECT
  organizationId,
  monitorId,
  environment,
  toStartOfHour(timestamp) as hour,
  count() as run_count,
  countIf(success = true) as success_count,
  countIf(success = false) as failure_count,
  sum(totalDuration_ms) as total_duration_ms,
  min(totalDuration_ms) as min_duration_ms,
  max(totalDuration_ms) as max_duration_ms,
  quantileState(0.5)(totalDuration_ms) as p50_state,
  quantileState(0.95)(totalDuration_ms) as p95_state,
  quantileState(0.99)(totalDuration_ms) as p99_state
FROM execution_events
WHERE type = 'MONITOR_END'
GROUP BY organizationId, monitorId, environment, hour;
```

---

## Notification System

### Concepts

**Notification Rule**: A configuration that defines when to send a notification and where to send it.

**Notification Channel**: A destination for notifications (webhook, email, SNS topic, or native integration).

**Notification Event**: A triggered notification based on a rule match.

### Notification Rules

#### Rule Schema

```typescript
interface NotificationRule {
  id: string;
  organization_id: string;
  name: string;
  enabled: boolean;
  
  // Scope (all optional - null means "all")
  monitor_id?: string;
  environment?: string;
  location?: string;
  
  // Trigger condition
  trigger: NotificationTrigger;
  
  // Destinations
  channels: NotificationChannel[];
  
  // Behavior
  cooldown_minutes: number;  // Minimum time between notifications (default: 15)
  
  created_at: string;
  updated_at: string;
}

type NotificationTrigger = 
  | { type: "run_failed" }
  | { type: "run_recovered" }  // First success after failure
  | { type: "consecutive_failures"; threshold: number }
  | { type: "success_rate_below"; threshold: number; window_minutes: number }
  | { type: "latency_above"; threshold_ms: number; percentile: "p50" | "p95" | "p99"; window_minutes: number }
  | { type: "uptime_below"; threshold: number; window_hours: number };

type NotificationChannel =
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "email"; address: string }  // Cloud only
  | { type: "sns"; topic_arn: string }  // Cloud only
  | { type: "integration"; integration_id: string };  // Cloud only
```

#### Database Schema

```sql
CREATE TABLE notification_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Scope filters (NULL = all)
  monitor_id TEXT REFERENCES monitors(id) ON DELETE CASCADE,
  environment TEXT,
  location TEXT,
  
  -- Trigger configuration (JSONB)
  trigger JSONB NOT NULL,
  
  -- Channels configuration (JSONB array)
  channels JSONB NOT NULL DEFAULT '[]',
  
  -- Behavior
  cooldown_minutes INTEGER NOT NULL DEFAULT 15,
  
  -- Tracking
  last_triggered_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_rules_org ON notification_rules (organization_id);
CREATE INDEX idx_notification_rules_plan ON notification_rules (monitor_id) WHERE monitor_id IS NOT NULL;

-- Track sent notifications for cooldown logic
CREATE TABLE notification_events (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  
  trigger_reason TEXT NOT NULL,
  channels_notified JSONB NOT NULL,  -- Which channels received the notification
  
  -- Delivery status per channel
  delivery_status JSONB NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_events_rule ON notification_events (rule_id, created_at DESC);
```

### Notification API

#### POST /notifications/rules

Create a new notification rule.

**Request:**
```json
{
  "name": "Checkout failures",
  "monitor_id": "plan_abc123",
  "environment": "production",
  "trigger": {
    "type": "consecutive_failures",
    "threshold": 3
  },
  "channels": [
    {
      "type": "webhook",
      "url": "https://hooks.slack.com/services/xxx",
      "headers": { "Content-Type": "application/json" }
    }
  ],
  "cooldown_minutes": 30
}
```

**Response:** Created `NotificationRule` object

#### GET /notifications/rules

List notification rules.

**Query Parameters:**
- `monitor_id` (optional): Filter by monitor
- `enabled` (optional): Filter by enabled status

**Response:** Array of `NotificationRule` objects

#### GET /notifications/rules/:id

Get a specific notification rule.

#### PATCH /notifications/rules/:id

Update a notification rule.

#### DELETE /notifications/rules/:id

Delete a notification rule.

#### GET /notifications/events

List recent notification events.

**Query Parameters:**
- `rule_id` (optional): Filter by rule
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "evt_123",
      "rule_id": "rule_abc",
      "rule_name": "Checkout failures",
      "run_id": "run_xyz",
      "trigger_reason": "3 consecutive failures",
      "channels_notified": ["webhook"],
      "delivery_status": {
        "webhook": { "status": "delivered", "response_code": 200 }
      },
      "created_at": "2026-01-28T11:30:00Z"
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

#### POST /notifications/test

Send a test notification to verify channel configuration.

**Request:**
```json
{
  "channel": {
    "type": "webhook",
    "url": "https://hooks.slack.com/services/xxx"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test notification delivered successfully"
}
```

### Notification Payload

All notification channels receive a standardized payload:

```json
{
  "event_type": "test_failure",
  "timestamp": "2026-01-28T11:30:00Z",
  "organization_id": "org_xxx",
  
  "monitor": {
    "id": "plan_abc123",
    "name": "checkout-flow"
  },
  "environment": "production",
  "location": "us-east-1",
  
  "run": {
    "id": "run_xyz789",
    "started_at": "2026-01-28T11:29:55Z",
    "duration_ms": 1234,
    "success": false,
    "errors": [
      "Assertion failed: expected status 200, got 503"
    ]
  },
  
  "context": {
    "consecutive_failures": 3,
    "last_success_at": "2026-01-28T10:30:00Z"
  },
  
  "links": {
    "run_details": "https://app.griffin.dev/runs/run_xyz789",
    "monitor_metrics": "https://app.griffin.dev/monitors/monitor_abc123/metrics"
  }
}
```

**Event types:**
- `test_failure`: A test run failed
- `test_recovered`: First successful run after failures
- `threshold_breach`: A metric threshold was exceeded (latency, success rate, uptime)

### Notification Dispatch

#### Standalone Implementation

Notifications are evaluated and dispatched synchronously after run completion.

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Executor   │────▶│ NotificationSvc │────▶│   Webhook    │
│ (run ends)  │     │ (evaluate rules)│     │   Dispatch   │
└─────────────┘     └─────────────────┘     └──────────────┘
```

**Location:** `griffin-hub/src/services/notifications.ts`

**Behavior:**
- Runs after each monitor execution completes
- Evaluates all applicable rules
- Dispatches to webhook channels only (email/SNS require cloud infra)
- Best-effort delivery with 3 retries, exponential backoff
- Webhook timeout: 10 seconds
- Failures logged but don't affect run status

**Configuration:**
- `NOTIFICATIONS_ENABLED`: Enable/disable notifications (default: true)
- `NOTIFICATIONS_WEBHOOK_TIMEOUT_MS`: Webhook timeout (default: 10000)
- `NOTIFICATIONS_MAX_RETRIES`: Max retry attempts (default: 3)

#### Cloud Implementation

Notifications are processed asynchronously via the Kinesis event stream.

```
┌─────────────┐     ┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│  Executor   │────▶│   Kinesis   │────▶│ Notification  │────▶│ SNS / SES /  │
│  (events)   │     │   Stream    │     │    Lambda     │     │  Webhooks    │
└─────────────┘     └─────────────┘     └───────────────┘     └──────────────┘
```

**Lambda logic:**
1. Filter for `MONITOR_END` events
2. Load applicable notification rules from PostgreSQL (cached)
3. Evaluate trigger conditions
4. Check cooldown period
5. Dispatch to configured channels
6. Record notification event

**Additional channels:**
- **Email (SES)**: Formatted HTML email with run details
- **SNS**: JSON payload to SNS topic for fan-out
- **Native integrations**: Transformed payloads for PagerDuty, Datadog, etc.

---

## Native Integrations (Cloud Only)

For common monitoring platforms, Griffin provides native integrations that handle payload transformation and authentication.

### Supported Integrations

| Integration | Notification Type | Metrics Export |
|-------------|-------------------|----------------|
| PagerDuty | ✅ Incidents | ❌ |
| Slack | ✅ Messages | ❌ |
| Datadog | ✅ Events | ✅ Metrics |
| New Relic | ✅ Events | ✅ Metrics |
| Opsgenie | ✅ Alerts | ❌ |

### Integration API

#### POST /integrations

Create a new integration.

**Request (PagerDuty example):**
```json
{
  "type": "pagerduty",
  "name": "Production Alerts",
  "config": {
    "routing_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Request (Datadog example):**
```json
{
  "type": "datadog",
  "name": "Datadog Monitoring",
  "config": {
    "api_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "site": "datadoghq.com",
    "metrics_enabled": true,
    "metrics_prefix": "griffin"
  }
}
```

**Response:** Created integration object with `id`

#### GET /integrations

List configured integrations.

#### DELETE /integrations/:id

Remove an integration.

### Integration Behavior

**PagerDuty:**
- Creates incidents on `test_failure` events
- Auto-resolves incidents on `test_recovered` events
- Deduplication key: `griffin-{monitor_id}-{environment}`

**Datadog:**
- Sends events for test failures/recoveries
- Pushes metrics every minute (if enabled):
  - `griffin.runs.count`
  - `griffin.runs.success_rate`
  - `griffin.runs.duration_p95`
  - Tags: `monitor`, `environment`, `location`

**Slack:**
- Posts formatted messages with run details
- Includes action buttons for "View Run" and "View Metrics"

---

## CLI Commands

### griffin hub status

Display high-level health summary.

```bash
$ griffin hub status

Griffin Hub Status (last 24h)
═══════════════════════════════════════════════════════════════

  Monitors:     25 total, 23 passing, 2 failing
  Runs:      1,200 total (98.0% success rate)
  Uptime:    98.0%
  Latency:   p50: 450ms, p95: 1.2s

Failing Monitors:
  ✗ checkout-flow (production)     3 consecutive failures
    Last failure: 30 minutes ago
    Error: Assertion failed: expected status 200, got 503

  ✗ inventory-sync (production)    1 failure in last 10 runs
    Last failure: 2 hours ago
    Error: Timeout after 30000ms

Run 'griffin hub metrics checkout-flow' for detailed metrics.
```

**Options:**
- `--environment <env>`: Filter by environment
- `--json`: Output as JSON

### griffin hub metrics

Display detailed metrics for a monitor.

```bash
$ griffin hub metrics checkout-flow

Metrics for checkout-flow (production, last 24h)
═══════════════════════════════════════════════════════════════

  Status:        healthy
  Success Rate:  97.9% (47/48 runs)
  Uptime:        97.9%

Latency Distribution:
  min     p50     p95     p99     max
  210ms   320ms   890ms   1.1s    1.25s

Recent Failures (1):
  ┌──────────────────────┬────────────────────────────────────────┐
  │ 2026-01-27 18:30 UTC │ Assertion failed: expected 200, got 503│
  └──────────────────────┴────────────────────────────────────────┘

Run History (last 12 hours):
  ████████████████████████████████████████████░░░░ 97.9%
  └─ 6h ago                                       now
```

**Options:**
- `--environment <env>`: Environment (default: from config)
- `--period <period>`: Time period: `1h`, `6h`, `24h`, `7d` (default: `24h`)
- `--json`: Output as JSON

### griffin hub metrics --all

Display metrics summary for all monitors.

```bash
$ griffin hub metrics --all

Monitor Metrics (production, last 24h)
═══════════════════════════════════════════════════════════════

Monitor                  Status    Success   Runs    p95 Latency
────────────────────  ────────  ────────  ──────  ───────────
checkout-flow         healthy   97.9%     48      890ms
inventory-sync        failing   80.0%     10      2.1s
user-auth             healthy   100.0%    24      450ms
payment-gateway       healthy   99.2%     120     1.5s
search-api            degraded  92.0%     50      3.2s

Summary: 3 healthy, 1 degraded, 1 failing
```

**Options:**
- `--environment <env>`: Environment filter
- `--period <period>`: Time period
- `--status <status>`: Filter by status: `healthy`, `degraded`, `failing`
- `--sort <field>`: Sort by: `name`, `success_rate`, `latency`, `runs`
- `--json`: Output as JSON

### griffin hub notifications

Manage notification rules.

```bash
# List rules
$ griffin hub notifications list

Notification Rules
═══════════════════════════════════════════════════════════════

ID          Name                 Scope              Trigger              Channels
──────────  ───────────────────  ─────────────────  ───────────────────  ─────────
rule_abc    Checkout alerts      checkout-flow      3 consecutive fails  webhook
rule_def    All failures         all monitors (prod)   run_failed           webhook
rule_ghi    Latency warnings     payment-gateway    p95 > 2000ms         webhook

# Create rule
$ griffin hub notifications add \
    --name "Checkout alerts" \
    --monitor checkout-flow \
    --trigger consecutive_failures:3 \
    --webhook https://hooks.slack.com/services/xxx

Created notification rule: rule_abc

# Test webhook
$ griffin hub notifications test --webhook https://hooks.slack.com/services/xxx

✓ Test notification delivered successfully

# Delete rule
$ griffin hub notifications delete rule_abc

Deleted notification rule: rule_abc
```

---

## Standalone vs Cloud Comparison

| Feature | Standalone | Cloud |
|---------|------------|-------|
| **Metrics API** | ✅ Full API | ✅ Full API |
| **PostgreSQL aggregation** | ✅ | ✅ (real-time only) |
| **ClickHouse/Athena** | ❌ | ✅ (historical) |
| **CLI commands** | ✅ Full CLI | ✅ Full CLI |
| **Notification rules** | ✅ | ✅ |
| **Webhook dispatch** | ✅ Synchronous | ✅ Async (Lambda) |
| **Email notifications** | ❌ | ✅ (SES) |
| **SNS notifications** | ❌ | ✅ |
| **Native integrations** | ❌ | ✅ (PagerDuty, Datadog, etc.) |
| **Metrics history** | 90 days | Unlimited (S3) |
| **Multi-tenant** | Single-tenant | ✅ Multi-tenant |

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Enable metrics aggregation |
| `METRICS_AGGREGATION_INTERVAL_MS` | `60000` | Interval for updating hourly aggregates |
| `METRICS_RETENTION_DAYS` | `90` | Days to retain daily metrics |
| `RUNS_RETENTION_DAYS` | `30` | Days to retain raw runs |
| `NOTIFICATIONS_ENABLED` | `true` | Enable notification system |
| `NOTIFICATIONS_WEBHOOK_TIMEOUT_MS` | `10000` | Webhook request timeout |
| `NOTIFICATIONS_MAX_RETRIES` | `3` | Max retry attempts for webhooks |
| `NOTIFICATIONS_DEFAULT_COOLDOWN_MINUTES` | `15` | Default cooldown between notifications |

### Cloud-Only Variables

| Variable | Description |
|----------|-------------|
| `CLICKHOUSE_HOST` | ClickHouse endpoint |
| `CLICKHOUSE_PASSWORD` | ClickHouse credentials |
| `SES_FROM_ADDRESS` | Email sender address |
| `INTEGRATIONS_ENCRYPTION_KEY` | Key for encrypting integration credentials |

---

## Implementation Phases

### Phase 1: Metrics API + CLI (Standalone)

**Scope:**
- Add metrics aggregation tables to PostgreSQL
- Implement `/metrics/*` endpoints
- Add `griffin hub status` and `griffin hub metrics` commands
- Background job for hourly → daily rollup

**Files to create/modify:**
- `griffin-hub/src/storage/adapters/postgres/schema.ts` - Add metrics tables
- `griffin-hub/src/services/metrics.ts` - Metrics computation service
- `griffin-hub/src/routes/metrics/index.ts` - API routes
- `griffin-hub/src/jobs/metrics-aggregation.ts` - Background aggregation
- `griffin-cli/src/commands/hub/status.ts` - Status command
- `griffin-cli/src/commands/hub/metrics.ts` - Metrics command

**Estimated effort:** Medium

### Phase 2: Notification System (Standalone)

**Scope:**
- Notification rules table
- Rules API endpoints
- Synchronous webhook dispatch
- CLI for managing rules

**Files to create/modify:**
- `griffin-hub/src/storage/adapters/postgres/schema.ts` - Add notification tables
- `griffin-hub/src/services/notifications.ts` - Rule evaluation and dispatch
- `griffin-hub/src/routes/notifications/index.ts` - API routes
- `griffin-hub/src/executor/service.ts` - Hook notification dispatch
- `griffin-cli/src/commands/hub/notifications.ts` - CLI commands

**Estimated effort:** Medium

### Phase 3: Cloud Metrics Pipeline

**Scope:**
- ClickHouse schema and materialized views
- Metrics service routing (PostgreSQL vs ClickHouse)
- Athena fallback queries

**Prerequisites:** Kinesis pipeline from `EVENTS_ARCHITECTURE.md`

**Estimated effort:** Medium-High

### Phase 4: Cloud Notifications

**Scope:**
- Notification Lambda consuming Kinesis
- SNS integration
- Email via SES
- Native integrations API

**Estimated effort:** High

### Phase 5: Native Integrations

**Scope:**
- PagerDuty integration
- Datadog integration (events + metrics push)
- Slack integration
- Opsgenie integration

**Estimated effort:** Medium per integration

---

## Open Questions

1. **Metrics granularity**: Should we support per-endpoint latency metrics (from `HTTP_RESPONSE` events), or is monitor-level sufficient for MVP?

2. **Alerting thresholds**: Should we provide default notification rules for new monitors, or require explicit configuration?

3. **Metrics export**: Should we support Prometheus `/metrics` endpoint for users who want to scrape metrics into their own systems?

4. **Historical data migration**: When users upgrade from standalone to cloud, should we migrate their PostgreSQL metrics to the data lake?

5. **Rate limiting**: Should notification webhooks have configurable rate limits beyond cooldown periods?
