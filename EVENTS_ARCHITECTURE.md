# Griffin Cloud Events Architecture

This document describes the event-driven architecture for Griffin Cloud's observability, usage tracking, and alerting systems.

## Overview

The executor emits structured events during test monitor execution. These events flow through a scalable pipeline that supports:

- **Usage metering** for billing (via Polar.sh)
- **Dashboard analytics** for API health metrics
- **Alerting** for test failures
- **Data lake** for long-term storage and ad-hoc analysis

## Architecture Diagram

```
┌─────────────┐
│  Executor   │
│  (emits)    │
└──────┬──────┘
       │ ExecutionEvent
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Kinesis Data Stream                        │
│                  (on-demand mode)                           │
│                  partition key: executionId                 │
└─────┬──────────────────┬──────────────────┬────────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌───────────┐    ┌───────────────┐    ┌───────────────┐
│ Firehose  │    │ Lambda        │    │ Lambda        │
│ → S3      │    │ (usage)       │    │ (alerts)      │
└─────┬─────┘    └───────┬───────┘    └───────┬───────┘
      │                  │                    │
      ▼                  ▼                    ▼
┌───────────┐    ┌───────────────┐    ┌───────────────┐
│ S3 Data   │    │ Polar.sh      │    │ SNS           │
│ Lake      │    │ (billing)     │    │ (webhooks)    │
└─────┬─────┘    └───────────────┘    └───────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│ Analytics Layer                         │
│ Phase 1: Athena (queries S3 directly)   │
│ Phase 2: ClickHouse Cloud               │
└─────────────────────────────────────────┘
```

## Components

### 1. Event Source: Executor

**Location:** `griffin-executor/src/events/`

The executor emits `ExecutionEvent` types defined in `types.ts`. All events include:

| Field | Purpose |
|-------|---------|
| `eventId` | Unique identifier for deduplication |
| `executionId` | Correlation ID for all events in one run |
| `organizationId` | Tenant isolation and partitioning |
| `monitorId` | Test monitor identifier |
| `seq` | Monotonic sequence for ordering |
| `timestamp` | Unix ms timestamp |

**Key event types for downstream consumers:**

| Event Type | Usage Metering | Dashboard Metrics | Alerting |
|------------|----------------|-------------------|----------|
| `MONITOR_START` | Count executions | - | - |
| `MONITOR_END` | Duration, success | Latency, success rate | Failures |
| `HTTP_REQUEST` | Request count | - | - |
| `HTTP_RESPONSE` | - | Latency by endpoint | - |
| `ASSERTION_RESULT` | - | Pass/fail rates | Failures |

### 2. Event Bus: Kinesis Data Stream

**Configuration:**

- **Mode:** On-demand (auto-scaling, no shard management)
- **Partition key:** `executionId` (maintains ordering within execution)
- **Retention:** 24 hours (default), extend if replay needed
- **Record format:** JSON with `eventType` as record-level attribute

**Why Kinesis over EventBridge:**

- Ordering guarantees within partition
- Replay capability for reprocessing
- Better suited for high-throughput event streams
- Existing adapter in `griffin-executor/src/events/adapters/kinesis.ts`

**Implementation note:** Add `eventType` as a Kinesis record attribute (not just in JSON body) to enable filtered consumers without parsing.

### 3. Data Lake: Firehose → S3

**Configuration:**

- **Source:** Kinesis Data Stream
- **Destination:** S3 bucket
- **Format:** Parquet (not JSON) for query efficiency
- **Partitioning:** Dynamic partitioning by `organizationId/year/month/day`
- **Buffer:** 5 minutes or 128 MB (whichever first)
- **Compression:** Snappy

**S3 structure:**

```
s3://griffin-events-{env}/
  └── events/
      └── organizationId={org_id}/
          └── year={YYYY}/
              └── month={MM}/
                  └── day={DD}/
                      └── {firehose-delivery-files}.parquet
```

**Purpose:** Permanent record for compliance, ad-hoc analysis, and backfill operations.

### 4. Usage Metering: Lambda → Polar.sh

**Trigger:** Kinesis Data Stream (event source mapping)

**Logic:**

1. Filter for `MONITOR_START` and `MONITOR_END` events
2. Aggregate by `organizationId` within batch window
3. Emit usage records to Polar.sh API:
   - Execution count
   - Total execution duration (ms)
   - Endpoint call count (from `HTTP_REQUEST` events)

**Configuration:**

- **Batch size:** 100 records
- **Batch window:** 60 seconds
- **Parallelization factor:** 1 (per shard)
- **Retry:** 3 attempts with exponential backoff

**Idempotency:** Use `executionId` + `eventType` as deduplication key. Polar.sh should handle duplicate submissions gracefully.

### 5. Failure Alerting: Lambda → SNS

**Trigger:** Kinesis Data Stream (event source mapping)

**Logic:**

1. Filter for `MONITOR_END` events where `success === false`
2. Filter for `ERROR` events
3. Enrich with monitor metadata (name, organization)
4. Publish to SNS topic

**SNS fanout targets:**

- Email (for organization admins)
- Webhook (Slack, PagerDuty, etc.)
- Future: EventBridge for complex routing

**Message format:**

```json
{
  "alertType": "TEST_FAILURE",
  "organizationId": "org_xxx",
  "monitorId": "monitor_xxx",
  "monitorName": "health-check",
  "executionId": "exec_xxx",
  "timestamp": 1706000000000,
  "errors": ["Assertion failed: expected 200, got 500"],
  "dashboardUrl": "https://app.griffin.dev/runs/{executionId}"
}
```

### 6. Analytics Layer

#### Phase 1: Athena (MVP)

**Configuration:**

- Glue Data Catalog table pointing to S3 data lake
- Partition projection enabled for automatic partition discovery
- Workgroup with query result location and cost controls

**Example dashboard queries:**

```sql
-- Success rate by monitor (last 7 days)
SELECT 
  monitord,
  COUNT(*) as total_runs,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM griffin_events
WHERE type = 'MONITOR_END'
  AND organizationId = ?
  AND year = ? AND month = ? AND day >= ?
GROUP BY monitorId;

-- P95 latency by monitor
SELECT 
  monitorId,
  approx_percentile(totalDuration_ms, 0.95) as p95_latency
FROM griffin_events
WHERE type = 'MONITOR_END'
  AND organizationId = ?
  AND timestamp > (CURRENT_TIMESTAMP - INTERVAL '24' HOUR)
GROUP BY monitorId;
```

**Latency:** 2-30 seconds per query (acceptable for MVP)

#### Phase 2: ClickHouse Cloud

**Trigger to migrate:** Dashboard latency complaints, >1M events/day, or need for sub-second queries.

**Configuration:**

- Tier: Basic (start), Scale (production)
- Idling: Enabled (pause when inactive)
- Ingestion: ClickPipes from Kinesis OR scheduled S3 import

**Schema:**

```sql
CREATE TABLE execution_events (
  eventId String,
  executionId String,
  organizationId String,
  monitorId String,
  type LowCardinality(String),
  timestamp DateTime64(3),
  seq UInt32,
  -- MONITOR_END fields
  success Nullable(Bool),
  totalDuration_ms Nullable(UInt32),
  errorCount Nullable(UInt16),
  -- HTTP_RESPONSE fields  
  status Nullable(UInt16),
  duration_ms Nullable(UInt32),
  -- Other fields as needed
)
ENGINE = MergeTree()
PARTITION BY (organizationId, toYYYYMM(timestamp))
ORDER BY (organizationId, monitorId, timestamp, executionId)
TTL timestamp + INTERVAL 90 DAY;
```

## Implementation Phases

### Phase 1: Foundation (MVP)

1. **Update Kinesis adapter** to include `eventType` as record attribute
2. **Deploy Kinesis stream** in on-demand mode
3. **Deploy Firehose** with Parquet output to S3
4. **Create Glue table** for Athena queries
5. **Build basic dashboard** using Athena queries

### Phase 2: Usage Metering

1. **Deploy usage Lambda** with Kinesis trigger
2. **Integrate with Polar.sh** API for usage reporting
3. **Add monitoring** for Lambda errors and Polar.sh API failures

### Phase 3: Alerting

1. **Deploy alerting Lambda** with Kinesis trigger
2. **Create SNS topic** with subscription management
3. **Build webhook integration** for Slack/PagerDuty

### Phase 4: Analytics Upgrade (when needed)

1. **Provision ClickHouse Cloud** Basic tier
2. **Configure ClickPipes** or S3 import
3. **Migrate dashboard queries** to ClickHouse
4. **Enable idling** to minimize costs

## Configuration Reference

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `KINESIS_STREAM_NAME` | Executor, Lambdas | Event stream name |
| `KINESIS_STREAM_ARN` | Lambdas | Stream ARN for IAM |
| `S3_EVENTS_BUCKET` | Firehose | Data lake bucket |
| `POLAR_API_KEY` | Usage Lambda | Polar.sh API credentials |
| `POLAR_ORGANIZATION_ID` | Usage Lambda | Polar.sh org for metering |
| `ALERTS_SNS_TOPIC_ARN` | Alerts Lambda | SNS topic for failures |
| `CLICKHOUSE_HOST` | Hub/Dashboard | ClickHouse endpoint (Phase 2) |
| `CLICKHOUSE_PASSWORD` | Hub/Dashboard | ClickHouse credentials (Phase 2) |

### IAM Permissions

**Executor role:**
- `kinesis:PutRecords` on event stream

**Usage Lambda role:**
- `kinesis:GetRecords`, `kinesis:GetShardIterator`, `kinesis:DescribeStream`
- Network access to Polar.sh API

**Alerts Lambda role:**
- `kinesis:GetRecords`, `kinesis:GetShardIterator`, `kinesis:DescribeStream`
- `sns:Publish` on alerts topic

**Firehose role:**
- `kinesis:GetRecords`, `kinesis:GetShardIterator`, `kinesis:DescribeStream`
- `s3:PutObject` on events bucket
- `glue:GetTableVersions` (for Parquet schema)

## Cost Estimates

### Low volume (~10k events/day)

| Component | Monthly Cost |
|-----------|--------------|
| Kinesis (on-demand) | ~$5 |
| Firehose | ~$1 |
| S3 storage | ~$1 |
| Lambda | ~$0 (free tier) |
| Athena | ~$5 |
| **Total** | **~$12/month** |

### Medium volume (~1M events/day)

| Component | Monthly Cost |
|-----------|--------------|
| Kinesis (on-demand) | ~$50 |
| Firehose | ~$30 |
| S3 storage | ~$10 |
| Lambda | ~$10 |
| ClickHouse Basic | ~$100 |
| **Total** | **~$200/month** |

## Key Design Decisions

1. **Kinesis over EventBridge:** Ordering guarantees and replay capability outweigh EventBridge's simpler routing.

2. **Parquet over JSON in S3:** 10x storage savings, 10x faster Athena queries.

3. **Athena before ClickHouse:** Zero idle cost, acceptable latency for MVP, easy migration path.

4. **Lambda over Kinesis Data Analytics:** Simpler, cheaper for filtering/routing logic.

5. **SNS over direct integrations:** Fanout capability, managed retries, easy to add new targets.

## References

- Event types: `griffin-executor/src/events/types.ts`
- Kinesis adapter: `griffin-executor/src/events/adapters/kinesis.ts`
- Emitter abstraction: `griffin-executor/src/events/emitter.ts`
