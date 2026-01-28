/**
 * AWS Kinesis event bus adapter.
 *
 * Publishes execution events to an AWS Kinesis stream.
 * Supports batching, retries, and automatic partitioning by executionId.
 *
 * Features:
 * - Automatic batching (max 500 records per PutRecords call)
 * - Retry logic for failed records with exponential backoff
 * - Partition key strategies for optimal shard distribution
 * - EventType included in data for Lambda filtering
 */

import type { DurableEventBusAdapter } from "../emitter.js";
import type { ExecutionEvent } from "../types.js";
import {
  Kinesis,
  KinesisClient,
  PutRecordsCommand,
  type PutRecordsRequestEntry,
} from "@aws-sdk/client-kinesis";

export interface KinesisAdapterOptions {
  /**
   * AWS Kinesis client instance.
   * Should be pre-configured with region and credentials.
   *
   * Example:
   *   import { KinesisClient } from "@aws-sdk/client-kinesis";
   *   const client = new KinesisClient({ region: "us-east-1" });
   */
  client: KinesisClient;

  /**
   * Name of the Kinesis stream to publish to.
   */
  streamName: string;

  /**
   * Maximum number of retries for failed records.
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Milliseconds to wait between retries.
   * Default: 1000
   */
  retryDelayMs?: number;

  /**
   * Partition key strategy.
   * - "executionId": Use executionId as partition key (maintains ordering within execution)
   * - "organizationId": Use organizationId as partition key (better shard distribution for multi-tenant)
   * - "composite": Use "orgId:executionId" for balanced distribution with execution ordering
   * Default: "executionId"
   */
  partitionKeyStrategy?: "executionId" | "organizationId" | "composite";
}

/**
 * AWS Kinesis adapter for durable event publishing.
 *
 * Batches events and publishes them to a Kinesis stream.
 * Implements retry logic for failed records and respects Kinesis batch limits.
 */
export class KinesisAdapter implements DurableEventBusAdapter {
  private readonly client: KinesisClient;
  private readonly streamName: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly partitionKeyStrategy: "executionId" | "organizationId" | "composite";
  private static readonly KINESIS_MAX_BATCH = 500;

  constructor(options: KinesisAdapterOptions) {
    this.client = options.client;
    this.streamName = options.streamName;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.partitionKeyStrategy = options.partitionKeyStrategy ?? "executionId";
  }

  async publish(events: ExecutionEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Convert events to Kinesis records
    const records = events.map((event) => this.eventToRecord(event));

    // Process in batches of 500 (Kinesis limit)
    const batches = this.chunkArray(records, KinesisAdapter.KINESIS_MAX_BATCH);

    for (const batch of batches) {
      await this.publishBatchWithRetry(batch);
    }
  }

  /**
   * Publish a single batch with retry logic for failed records.
   */
  private async publishBatchWithRetry(
    records: PutRecordsRequestEntry[],
    attempt = 0,
  ): Promise<void> {
    try {
      const command = new PutRecordsCommand({
        StreamName: this.streamName,
        Records: records,
      });

      const response = await this.client.send(command);

      // Check for failed records
      if (response.FailedRecordCount && response.FailedRecordCount > 0) {
        const failedRecords = records.filter((_, idx) => {
          const result = response.Records?.[idx];
          return result?.ErrorCode !== undefined;
        });

        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(
            `Retrying ${failedRecords.length} failed records (attempt ${attempt + 1}/${this.maxRetries}) after ${delay}ms`,
          );
          
          await this.sleep(delay);
          await this.publishBatchWithRetry(failedRecords, attempt + 1);
        } else {
          console.error(
            `Failed to publish ${failedRecords.length} records after ${this.maxRetries} attempts`,
          );
          // Events are lost after max retries - caller should implement dead letter queue if needed
        }
      }
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        console.warn(
          `Kinesis publish error, retrying (attempt ${attempt + 1}/${this.maxRetries}) after ${delay}ms:`,
          error,
        );
        
        await this.sleep(delay);
        await this.publishBatchWithRetry(records, attempt + 1);
      } else {
        console.error(
          `Failed to publish batch after ${this.maxRetries} attempts:`,
          error,
        );
        throw error;
      }
    }
  }

  /**
   * Convert ExecutionEvent to Kinesis record format.
   */
  private eventToRecord(event: ExecutionEvent): PutRecordsRequestEntry {
    return {
      Data: this.serializeEvent(event),
      PartitionKey: this.getPartitionKey(event),
    };
  }

  /**
   * Get partition key based on configured strategy.
   */
  private getPartitionKey(event: ExecutionEvent): string {
    switch (this.partitionKeyStrategy) {
      case "executionId":
        return event.executionId;
      case "organizationId":
        return event.organizationId;
      case "composite":
        return `${event.organizationId}:${event.executionId}`;
    }
  }

  /**
   * Serialize event to JSON and encode as UTF-8 bytes.
   * Events are structured to enable efficient Lambda filtering by including
   * type as a top-level field in the JSON payload.
   */
  private serializeEvent(event: ExecutionEvent): Uint8Array {
    const json = JSON.stringify(event);
    return new TextEncoder().encode(json);
  }

  /**
   * Split array into chunks of specified size.
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
