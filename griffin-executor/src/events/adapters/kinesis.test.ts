import { describe, it, expect, beforeEach, vi } from "vitest";
import { KinesisAdapter } from "./kinesis.js";
import type { ExecutionEvent } from "../types.js";
import type { KinesisClient } from "@aws-sdk/client-kinesis";

describe("KinesisAdapter", () => {
  const createMockEvent = (
    type: ExecutionEvent["type"],
    executionId: string,
    organizationId: string,
    seq: number,
  ): ExecutionEvent =>
    ({
      type,
      eventId: `event-${seq}`,
      seq,
      timestamp: Date.now(),
      planId: "plan-1",
      executionId,
      organizationId,
      planName: "Test Plan",
      planVersion: "1.0.0",
      nodeCount: 1,
      edgeCount: 1,
    }) as ExecutionEvent;

  describe("publish", () => {
    it("should publish events successfully", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [{ SequenceNumber: "seq-1", ShardId: "shard-1" }],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
      });

      const events = [createMockEvent("PLAN_START", "exec-1", "org-1", 0)];

      await adapter.publish(events);

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.StreamName).toBe("test-stream");
      expect(command.input.Records).toHaveLength(1);
    });

    it("should handle empty event array", async () => {
      const mockSend = vi.fn();
      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
      });

      await adapter.publish([]);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should batch events into chunks of 500", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
      });

      // Create 1250 events (should result in 3 batches: 500, 500, 250)
      const events = Array.from({ length: 1250 }, (_, i) =>
        createMockEvent("PLAN_START", "exec-1", "org-1", i),
      );

      await adapter.publish(events);

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend.mock.calls[0][0].input.Records).toHaveLength(500);
      expect(mockSend.mock.calls[1][0].input.Records).toHaveLength(500);
      expect(mockSend.mock.calls[2][0].input.Records).toHaveLength(250);
    });
  });

  describe("partition key strategies", () => {
    it("should use executionId as partition key by default", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
      });

      const events = [createMockEvent("PLAN_START", "exec-123", "org-456", 0)];

      await adapter.publish(events);

      const records = mockSend.mock.calls[0][0].input.Records;
      expect(records[0].PartitionKey).toBe("exec-123");
    });

    it("should use organizationId as partition key when configured", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        partitionKeyStrategy: "organizationId",
      });

      const events = [createMockEvent("PLAN_START", "exec-123", "org-456", 0)];

      await adapter.publish(events);

      const records = mockSend.mock.calls[0][0].input.Records;
      expect(records[0].PartitionKey).toBe("org-456");
    });

    it("should use composite partition key when configured", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        partitionKeyStrategy: "composite",
      });

      const events = [createMockEvent("PLAN_START", "exec-123", "org-456", 0)];

      await adapter.publish(events);

      const records = mockSend.mock.calls[0][0].input.Records;
      expect(records[0].PartitionKey).toBe("org-456:exec-123");
    });
  });

  describe("retry logic", () => {
    it("should retry failed records with exponential backoff", async () => {
      let callCount = 0;
      const mockSend = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: one record fails
          return Promise.resolve({
            FailedRecordCount: 1,
            Records: [
              { ErrorCode: "ProvisionedThroughputExceededException" },
            ],
          });
        }
        // Second call: success
        return Promise.resolve({
          FailedRecordCount: 0,
          Records: [{ SequenceNumber: "seq-1", ShardId: "shard-1" }],
        });
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        maxRetries: 3,
        retryDelayMs: 10, // Short delay for testing
      });

      const events = [createMockEvent("PLAN_START", "exec-1", "org-1", 0)];

      await adapter.publish(events);

      expect(mockSend).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it("should stop retrying after max attempts", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "ProvisionedThroughputExceededException" },
        ],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        maxRetries: 2,
        retryDelayMs: 10,
      });

      const events = [createMockEvent("PLAN_START", "exec-1", "org-1", 0)];

      // Should not throw, but log errors
      await adapter.publish(events);

      expect(mockSend).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should retry on client errors", async () => {
      let callCount = 0;
      const mockSend = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          FailedRecordCount: 0,
          Records: [{ SequenceNumber: "seq-1", ShardId: "shard-1" }],
        });
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        maxRetries: 3,
        retryDelayMs: 10,
      });

      const events = [createMockEvent("PLAN_START", "exec-1", "org-1", 0)];

      await adapter.publish(events);

      expect(mockSend).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it("should throw after max retries on client errors", async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error("Network error"));

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
        maxRetries: 2,
        retryDelayMs: 10,
      });

      const events = [createMockEvent("PLAN_START", "exec-1", "org-1", 0)];

      await expect(adapter.publish(events)).rejects.toThrow("Network error");
      expect(mockSend).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe("event serialization", () => {
    it("should serialize events as JSON", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        FailedRecordCount: 0,
        Records: [],
      });

      const mockClient = {
        send: mockSend,
      } as unknown as KinesisClient;

      const adapter = new KinesisAdapter({
        client: mockClient,
        streamName: "test-stream",
      });

      const event = createMockEvent("PLAN_START", "exec-1", "org-1", 0);
      await adapter.publish([event]);

      const records = mockSend.mock.calls[0][0].input.Records;
      const data = records[0].Data;
      
      // Decode the Uint8Array back to JSON
      const decoder = new TextDecoder();
      const json = decoder.decode(data);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe("PLAN_START");
      expect(parsed.executionId).toBe("exec-1");
      expect(parsed.organizationId).toBe("org-1");
    });
  });
});
