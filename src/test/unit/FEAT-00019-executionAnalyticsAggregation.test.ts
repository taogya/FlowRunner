/**
 * FEAT-00019: Execution analytics aggregation
 */
// Trace: FEAT-00019-003001, FEAT-00019-003002, FEAT-00019-003003, FEAT-00019-003004

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionAnalyticsService } from "@extension/services/ExecutionAnalyticsService.js";
import type { HistoryRecordsWithDiagnostics } from "@extension/interfaces/HistoryRecordsWithDiagnostics.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { ExecutionRecord, ExecutionSummary, NodeResult } from "@shared/types/execution.js";

function createNodeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "node-1",
    nodeType: "command",
    nodeLabel: "Run Command",
    status: "success",
    inputs: {},
    outputs: {},
    duration: 100,
    ...overrides,
  };
}

function createSummary(
  id: string,
  startedAt: string,
  duration: number,
  status: ExecutionSummary["status"] = "success",
): ExecutionSummary {
  return {
    id,
    flowId: "flow-1",
    flowName: "Flow 1",
    startedAt,
    duration,
    status,
  };
}

function createRecord(
  summary: ExecutionSummary,
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    id: summary.id,
    flowId: summary.flowId,
    flowName: summary.flowName,
    startedAt: summary.startedAt,
    completedAt: summary.startedAt,
    duration: summary.duration,
    status: summary.status,
    nodeResults: [createNodeResult()],
    ...overrides,
  };
}

function createHistoryService(
  summaries: ExecutionSummary[],
  records: Record<string, ExecutionRecord>,
  brokenRecordIds: string[] = [],
  unreadableCount = 0,
): IHistoryService {
  return {
    saveRecord: vi.fn(),
    getRecords: vi.fn().mockResolvedValue(summaries),
    getRecordsWithDiagnostics: vi.fn().mockResolvedValue({
      summaries,
      unreadableCount,
    } satisfies HistoryRecordsWithDiagnostics),
    getRecord: vi.fn().mockImplementation(async (recordId: string) => {
      if (brokenRecordIds.includes(recordId)) {
        throw new Error(`Broken record: ${recordId}`);
      }

      const record = records[recordId];
      if (!record) {
        throw new Error(`Record not found: ${recordId}`);
      }

      return record;
    }),
    deleteRecord: vi.fn(),
    cleanupOldRecords: vi.fn(),
  };
}

describe("FEAT-00019 execution analytics aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FEAT-00019-003001-00001
  it("buildSnapshot_limitsAggregationToLatestTenRecords", async () => {
    const summaries = Array.from({ length: 12 }, (_, index) =>
      createSummary(
        `record-${index}`,
        `2026-04-${String(12 - index).padStart(2, "0")}T00:00:00.000Z`,
        100 + index,
      ),
    );
    const records = Object.fromEntries(
      summaries.map((summary) => [summary.id, createRecord(summary)]),
    );
    const historyService = createHistoryService(summaries, records);
    const service = new ExecutionAnalyticsService(historyService);

    const snapshot = await service.buildSnapshot("flow-1");

    expect(snapshot?.sampleSize).toBe(10);
    expect(historyService.getRecord).toHaveBeenCalledTimes(10);
  });

  // FEAT-00019-003002-00001
  it("buildSnapshot_calculatesSummaryMetricsFromReadableRecords", async () => {
    const summaries = [
      createSummary("record-1", "2026-04-08T10:00:00.000Z", 100, "success"),
      createSummary("record-2", "2026-04-08T09:00:00.000Z", 300, "error"),
    ];
    const records = {
      "record-1": createRecord(summaries[0]),
      "record-2": createRecord(summaries[1], { error: { message: "command failed" } }),
    };
    const service = new ExecutionAnalyticsService(
      createHistoryService(summaries, records),
    );

    const snapshot = await service.buildSnapshot("flow-1");

    expect(snapshot).toEqual(
      expect.objectContaining({
        successCount: 1,
        failureCount: 1,
        successRate: 50,
        averageDurationMs: 200,
        latestExecutedAt: "2026-04-08T10:00:00.000Z",
      }),
    );
  });

  // FEAT-00019-003002-00002
  it("buildSnapshot_countsUnreadableRecords_withoutFailingWholeAggregation", async () => {
    const summaries = [
      createSummary("record-1", "2026-04-08T10:00:00.000Z", 100, "success"),
      createSummary("record-2", "2026-04-08T09:00:00.000Z", 300, "error"),
    ];
    const records = {
      "record-1": createRecord(summaries[0]),
      "record-2": createRecord(summaries[1], { error: { message: "command failed" } }),
    };
    const service = new ExecutionAnalyticsService(
      createHistoryService(summaries, records, ["record-2"], 1),
    );

    const snapshot = await service.buildSnapshot("flow-1");

    expect(snapshot?.unreadableCount).toBe(2);
    expect(snapshot?.recentFailures).toEqual([]);
  });

  // FEAT-00019-003003-00001
  it("buildSnapshot_collectsRecentFailuresInDescendingOrder", async () => {
    const summaries = [
      createSummary("record-1", "2026-04-08T11:00:00.000Z", 100, "success"),
      createSummary("record-2", "2026-04-08T10:00:00.000Z", 300, "error"),
      createSummary("record-3", "2026-04-08T09:00:00.000Z", 250, "error"),
    ];
    const records = {
      "record-1": createRecord(summaries[0]),
      "record-2": createRecord(summaries[1], { error: { message: "second" } }),
      "record-3": createRecord(summaries[2], { error: { message: "third" } }),
    };
    const service = new ExecutionAnalyticsService(
      createHistoryService(summaries, records),
    );

    const snapshot = await service.buildSnapshot("flow-1");

    expect(snapshot?.recentFailures.map((item) => item.errorMessage)).toEqual([
      "second",
      "third",
    ]);
  });

  // FEAT-00019-003004-00001
  it("buildSnapshot_extractsSlowestNodeFromAverageDuration", async () => {
    const summaries = [
      createSummary("record-1", "2026-04-08T10:00:00.000Z", 100, "success"),
      createSummary("record-2", "2026-04-08T09:00:00.000Z", 300, "success"),
    ];
    const records = {
      "record-1": createRecord(summaries[0], {
        nodeResults: [
          createNodeResult({ nodeId: "node-a", nodeLabel: "A", nodeType: "log", duration: 100 }),
          createNodeResult({ nodeId: "node-b", nodeLabel: "B", nodeType: "http", duration: 220 }),
        ],
      }),
      "record-2": createRecord(summaries[1], {
        nodeResults: [
          createNodeResult({ nodeId: "node-a", nodeLabel: "A", nodeType: "log", duration: 140 }),
          createNodeResult({ nodeId: "node-b", nodeLabel: "B", nodeType: "http", duration: 280 }),
        ],
      }),
    };
    const service = new ExecutionAnalyticsService(
      createHistoryService(summaries, records),
    );

    const snapshot = await service.buildSnapshot("flow-1");

    expect(snapshot?.slowestNode).toEqual(
      expect.objectContaining({
        nodeId: "node-b",
        nodeLabel: "B",
        nodeType: "http",
        averageDurationMs: 250,
        maxDurationMs: 280,
      }),
    );
  });
});