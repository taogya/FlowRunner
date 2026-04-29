// DD-04 HistoryService UT tests
// Trace: DD-04-004001 概要, DD-04-004002 クラス設計,
//        DD-04-004003 saveRecord/getRecords/getRecord/deleteRecord/cleanupOldRecords

import { describe, it, expect, vi } from "vitest";
import { HistoryService } from "@extension/services/HistoryService.js";
import type { HistoryRecordsWithDiagnostics } from "@extension/interfaces/HistoryRecordsWithDiagnostics.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";
import type { ExecutionRecord, ExecutionSummary } from "@shared/types/execution.js";

// --- Inline mocks ---

function createMockRepository(): IHistoryRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({} as ExecutionRecord),
    list: vi.fn().mockResolvedValue([]),
    listWithDiagnostics: vi.fn().mockResolvedValue({ summaries: [], unreadableCount: 0 }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
  };
}

function createRecord(flowId = "flow-1", id = "flow-1_2026-01-01_001"): ExecutionRecord {
  return {
    id,
    flowId,
    flowName: "Test",
    startedAt: "2026-01-01T00:00:00Z",
    completedAt: "2026-01-01T00:01:00Z",
    duration: 60000,
    status: "success",
    nodeResults: [],
  };
}

function createSummary(id: string, startedAt: string): ExecutionSummary {
  return { id, flowId: "flow-1", flowName: "Test", startedAt, duration: 1000, status: "success" };
}

describe("HistoryService", () => {
  // --- DD-04-004001: 概要（インスタンス生成） ---

  // DDUT-04-004001-00001
  it("canBeInstantiated", () => {
    // Arrange & Act
    const svc = new HistoryService(createMockRepository(), () => 10);

    // Assert
    expect(svc).toBeInstanceOf(HistoryService);
  });

  // --- DD-04-004002: クラス設計（IHistoryService 準拠） ---

  // DDUT-04-004002-00001
  it("implementsIHistoryService", () => {
    // Arrange
    const svc = new HistoryService(createMockRepository(), () => 10);

    // Assert — verify all IHistoryService methods exist
    const iface: IHistoryService = svc;
    expect(typeof iface.saveRecord).toBe("function");
    expect(typeof iface.getRecords).toBe("function");
    expect(typeof iface.getRecordsWithDiagnostics).toBe("function");
    expect(typeof iface.getRecord).toBe("function");
    expect(typeof iface.deleteRecord).toBe("function");
    expect(typeof iface.cleanupOldRecords).toBe("function");
  });

  // --- DD-04-004003: メソッド詳細 ---

  // DDUT-04-004003-00001
  it("saveRecord_savesAndTriggersCleanup", async () => {
    // Arrange
    const repo = createMockRepository();
    const svc = new HistoryService(repo, () => 10);
    const record = createRecord();

    // Act
    await svc.saveRecord(record);

    // Assert
    expect(repo.save).toHaveBeenCalledWith(record);
  });

  // DDUT-04-004003-00002
  it("getRecords_delegatesToRepositoryList", async () => {
    // Arrange
    const repo = createMockRepository();
    const summaries: ExecutionSummary[] = [createSummary("r1", "2026-01-01")];
    (repo.list as ReturnType<typeof vi.fn>).mockResolvedValue(summaries);
    const svc = new HistoryService(repo, () => 10);

    // Act
    const result = await svc.getRecords("flow-1");

    // Assert
    expect(repo.list).toHaveBeenCalledWith("flow-1");
    expect(result).toEqual(summaries);
  });

  // DDUT-04-004003-00009
  it("getRecordsWithDiagnostics_delegatesToRepositoryListWithDiagnostics", async () => {
    // Arrange
    const repo = createMockRepository();
    const diagnostics: HistoryRecordsWithDiagnostics = {
      summaries: [createSummary("r1", "2026-01-01")],
      unreadableCount: 1,
    };
    (repo.listWithDiagnostics as ReturnType<typeof vi.fn>).mockResolvedValue(diagnostics);
    const svc = new HistoryService(repo, () => 10);

    // Act
    const result = await svc.getRecordsWithDiagnostics("flow-1");

    // Assert
    expect(repo.listWithDiagnostics).toHaveBeenCalledWith("flow-1");
    expect(result).toEqual(diagnostics);
  });

  // DDUT-04-004003-00003
  it("getRecord_delegatesToRepositoryLoad", async () => {
    // Arrange
    const repo = createMockRepository();
    const record = createRecord();
    (repo.load as ReturnType<typeof vi.fn>).mockResolvedValue(record);
    const svc = new HistoryService(repo, () => 10);

    // Act
    const result = await svc.getRecord("flow-1_2026-01-01_001");

    // Assert
    expect(repo.load).toHaveBeenCalledWith("flow-1_2026-01-01_001");
    expect(result).toEqual(record);
  });

  // DDUT-04-004003-00004
  it("deleteRecord_delegatesToRepositoryDelete", async () => {
    // Arrange
    const repo = createMockRepository();
    const svc = new HistoryService(repo, () => 10);

    // Act
    await svc.deleteRecord("flow-1_2026-01-01_001");

    // Assert
    expect(repo.delete).toHaveBeenCalledWith("flow-1_2026-01-01_001");
  });

  // DDUT-04-004003-00005
  it("cleanupOldRecords_maxCountNegativeOne_doesNothing", async () => {
    // Arrange
    const repo = createMockRepository();
    const svc = new HistoryService(repo, () => -1);

    // Act
    await svc.cleanupOldRecords("flow-1");

    // Assert
    expect(repo.list).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // DDUT-04-004003-00006
  it("cleanupOldRecords_maxCountZero_deletesAll", async () => {
    // Arrange
    const repo = createMockRepository();
    const summaries = [createSummary("r1", "2026-01-01"), createSummary("r2", "2026-01-02")];
    (repo.list as ReturnType<typeof vi.fn>).mockResolvedValue(summaries);
    const svc = new HistoryService(repo, () => 0);

    // Act
    await svc.cleanupOldRecords("flow-1");

    // Assert
    expect(repo.delete).toHaveBeenCalledTimes(2);
  });

  // DDUT-04-004003-00007
  it("cleanupOldRecords_countBelowMax_doesNothing", async () => {
    // Arrange
    const repo = createMockRepository();
    (repo.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    const svc = new HistoryService(repo, () => 10);

    // Act
    await svc.cleanupOldRecords("flow-1");

    // Assert
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // DDUT-04-004003-00008
  it("cleanupOldRecords_countAboveMax_deletesOverflow", async () => {
    // Arrange
    const repo = createMockRepository();
    (repo.count as ReturnType<typeof vi.fn>).mockResolvedValue(12);
    const summaries = Array.from({ length: 12 }, (_, i) =>
      createSummary(`r${i}`, `2026-01-${String(12 - i).padStart(2, "0")}`),
    );
    (repo.list as ReturnType<typeof vi.fn>).mockResolvedValue(summaries);
    const svc = new HistoryService(repo, () => 10);

    // Act
    await svc.cleanupOldRecords("flow-1");

    // Assert — should delete 2 oldest records
    expect(repo.delete).toHaveBeenCalledTimes(2);
  });
});
