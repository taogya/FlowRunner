// BD-04 IHistoryService IT tests
// Trace: BD-04-004001 概要, BD-04-004002 IHistoryService インターフェース,
//        BD-04-004003 ExecutionRecord, BD-04-004005 保持件数管理,
//        BD-04-004006 履歴参照 UI

import { describe, it, expect } from "vitest";
import type { ExecutionRecord } from "@shared/types/execution.js";
import { HistoryService } from "@extension/services/HistoryService.js";
import { MockHistoryRepository } from "@extension/mocks/MockHistoryRepository.js";

function createHistoryService(): HistoryService {
  return new HistoryService(new MockHistoryRepository(), () => 10);
}

function createSampleExecutionRecord(
  id: string = "record-1",
  flowId: string = "flow-1"
): ExecutionRecord {
  return {
    id,
    flowId,
    flowName: "Test Flow",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    duration: 1000,
    status: "success",
    nodeResults: [],
  };
}

describe("IHistoryService", () => {
  // BDIT-04-004001-00001
  it("saveRecord_withExecutionRecord_succeedsWithoutError", async () => {
    const service = createHistoryService();
    const record = createSampleExecutionRecord();

    await expect(service.saveRecord(record)).resolves.toBeUndefined();
  });

  // BDIT-04-004001-00002
  it("getRecord_afterSave_returnsExecutionRecord", async () => {
    const service = createHistoryService();
    const record = createSampleExecutionRecord();

    await service.saveRecord(record);
    const loaded = await service.getRecord("record-1");

    expect(loaded).toEqual(record);
  });

  // BDIT-04-004001-00003
  it("getRecords_withSavedRecords_returnsSummaries", async () => {
    const service = createHistoryService();

    await service.saveRecord(createSampleExecutionRecord("r-1", "flow-1"));
    await service.saveRecord(createSampleExecutionRecord("r-2", "flow-1"));

    const summaries = await service.getRecords("flow-1");

    expect(summaries.length).toBe(2);
  });

  // BDIT-04-004001-00004
  it("deleteRecord_withExistingRecordId_removesRecord", async () => {
    const service = createHistoryService();
    const record = createSampleExecutionRecord();

    await service.saveRecord(record);
    await service.deleteRecord("record-1");

    await expect(service.getRecord("record-1")).rejects.toThrow();
  });

  // BDIT-04-004001-00005
  it("cleanupOldRecords_withExcessRecords_removesOldest", async () => {
    const service = createHistoryService();

    // Save multiple records
    for (let i = 1; i <= 15; i++) {
      await service.saveRecord(
        createSampleExecutionRecord(`record-${i}`, "flow-1")
      );
    }

    await service.cleanupOldRecords("flow-1");

    const summaries = await service.getRecords("flow-1");
    // historyMaxCount default is 10
    expect(summaries.length).toBeLessThanOrEqual(10);
  });
});

// --- BD-04-004002: IHistoryService インターフェース ---

describe("IHistoryService Interface (BD-04-004002)", () => {
  // BDIT-04-004002-00001
  it("saveRecord_automaticallyRunsCleanup", async () => {
    const service = new HistoryService(new MockHistoryRepository(), () => 2);

    for (let i = 1; i <= 5; i++) {
      await service.saveRecord(
        createSampleExecutionRecord(`r-${i}`, "flow-1")
      );
    }

    const summaries = await service.getRecords("flow-1");
    expect(summaries.length).toBeLessThanOrEqual(2);
  });

  // BDIT-04-004002-00002
  it("getRecords_returnsSummariesNotFullRecords", async () => {
    const service = createHistoryService();
    await service.saveRecord(createSampleExecutionRecord());

    const summaries = await service.getRecords("flow-1");

    expect(summaries[0]).toHaveProperty("id");
    expect(summaries[0]).toHaveProperty("flowId");
    expect(summaries[0]).toHaveProperty("status");
  });
});

// --- BD-04-004003: ExecutionRecord ---

describe("ExecutionRecord Structure (BD-04-004003)", () => {
  // BDIT-04-004003-00001
  it("executionRecord_containsAllRequiredFields", () => {
    const record = createSampleExecutionRecord();

    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("flowId");
    expect(record).toHaveProperty("flowName");
    expect(record).toHaveProperty("startedAt");
    expect(record).toHaveProperty("completedAt");
    expect(record).toHaveProperty("duration");
    expect(record).toHaveProperty("status");
    expect(record).toHaveProperty("nodeResults");
  });

  // BDIT-04-004003-00002
  it("getRecord_afterSave_returnsCompleteExecutionRecord", async () => {
    const service = createHistoryService();
    const record: ExecutionRecord = {
      id: "rec-full",
      flowId: "flow-1",
      flowName: "Full Record",
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:00:01.000Z",
      duration: 1000,
      status: "success",
      nodeResults: [
        {
          nodeId: "n1",
          nodeType: "trigger",
          nodeLabel: "Start",
          status: "success",
          inputs: {},
          outputs: { out: "data" },
          duration: 500,
        },
      ],
    };

    await service.saveRecord(record);
    const loaded = await service.getRecord("rec-full");

    expect(loaded.nodeResults).toHaveLength(1);
    expect(loaded.nodeResults[0].nodeId).toBe("n1");
    expect(loaded.nodeResults[0].outputs).toEqual({ out: "data" });
  });
});

// --- BD-04-004005: 保持件数管理 ---

describe("Retention Management (BD-04-004005)", () => {
  // BDIT-04-004005-00001
  it("cleanupOldRecords_configMaxCount_respectsConfigValue", async () => {
    const service = new HistoryService(new MockHistoryRepository(), () => 3);

    for (let i = 1; i <= 5; i++) {
      await service.saveRecord(
        createSampleExecutionRecord(`r-${i}`, "flow-1")
      );
    }

    const summaries = await service.getRecords("flow-1");
    expect(summaries.length).toBeLessThanOrEqual(3);
  });

  // BDIT-04-004005-00002
  it("cleanupOldRecords_negativeMaxCount_keepsAllRecords", async () => {
    const service = new HistoryService(new MockHistoryRepository(), () => -1);

    for (let i = 1; i <= 15; i++) {
      await service.saveRecord(
        createSampleExecutionRecord(`r-${i}`, "flow-1")
      );
    }

    const summaries = await service.getRecords("flow-1");
    expect(summaries.length).toBe(15);
  });

  // BDIT-04-004005-00003
  it("cleanupOldRecords_zeroMaxCount_deletesAllRecords", async () => {
    const service = new HistoryService(new MockHistoryRepository(), () => 0);

    for (let i = 1; i <= 5; i++) {
      await service.saveRecord(
        createSampleExecutionRecord(`r-${i}`, "flow-1")
      );
    }

    const summaries = await service.getRecords("flow-1");
    expect(summaries.length).toBe(0);
  });
});

// --- BD-04-004006: 履歴参照 UI ---

describe("History UI Reference (BD-04-004006)", () => {
  // BDIT-04-004006-00001
  it("getRecords_returnsSummariesForTreeView", async () => {
    const service = createHistoryService();

    await service.saveRecord(createSampleExecutionRecord("r-1", "flow-1"));
    await service.saveRecord(createSampleExecutionRecord("r-2", "flow-1"));

    const summaries = await service.getRecords("flow-1");

    // TreeView uses summaries with id, flowId, status, startedAt
    expect(summaries.length).toBe(2);
    for (const s of summaries) {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("flowId");
      expect(s).toHaveProperty("status");
    }
  });

  // BDIT-04-004006-00002
  it("getRecord_returnsFullDetailForDetailView", async () => {
    const service = createHistoryService();
    await service.saveRecord(createSampleExecutionRecord("r-detail", "flow-1"));

    const detail = await service.getRecord("r-detail");

    // Detail view needs full ExecutionRecord with nodeResults
    expect(detail.nodeResults).toBeDefined();
    expect(detail.flowName).toBe("Test Flow");
  });
});
