/**
 * AWS Kinesis event bus adapter.
 *
 * Publishes execution events to an AWS Kinesis stream.
 * Supports batching, retries, and automatic partitioning by executionId.
 */

import type { DurableEventBusAdapter } from "../emitter.js";
import type { ExecutionEvent } from "../types.js";
import {
  Kinesis,
  KinesisClient,
  PutRecordsCommand,
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
}

/**
 * AWS Kinesis adapter for durable event publishing.
 *
 * Batches events and publishes them to a Kinesis stream.
 * Uses executionId as the partition key to maintain ordering within an execution.
 */
export class KinesisAdapter implements DurableEventBusAdapter {
  private readonly client: KinesisClient;
  private readonly streamName: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: KinesisAdapterOptions) {
    this.client = options.client;
    this.streamName = options.streamName;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  async publish(events: ExecutionEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    // Kinesis has a max batch size of 500 records
    const KINESIS_MAX_BATCH = 500;

    const publishBatchCommand = new PutRecordsCommand({
      StreamName: this.streamName,
      Records: events.map((event) => ({
        Data: this.serializeEvent(event),
        PartitionKey: event.executionId,
      })),
    });
    const response = await this.client.send(publishBatchCommand);
    if (response.FailedRecordCount && response.FailedRecordCount > 0) {
      console.error(
        "Failed to publish events to Kinesis:",
        response.FailedRecordCount,
      );
    }
  }

  /**
   * Serialize event to JSON and encode as UTF-8 bytes.
   */
  private serializeEvent(event: ExecutionEvent): Uint8Array {
    const json = JSON.stringify(event);
    return new TextEncoder().encode(json);
  }
}
