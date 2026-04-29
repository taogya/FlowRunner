// DD-04 HistoryRepository UT tests
// Trace: DD-04-005001 概要, DD-04-005002 クラス設計,
//        DD-04-005003 ファイルシステム構造, DD-04-005004 メソッド詳細

import { describe, it, expect, vi } from "vitest";
import { HistoryRepository } from "@extension/repositories/HistoryRepository.js";
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";
import type { ExecutionRecord } from "@shared/types/execution.js";
import { Uri } from "vscode";

// --- IFileSystem inline mock ---

interface IFileSystem {
  writeFile(uri: unknown, content: Uint8Array): Promise<void>;
  readFile(uri: unknown): Promise<Uint8Array>;
  delete(uri: unknown): Promise<void>;
  readDirectory(uri: unknown): Promise<[string, number][]>;
  createDirectory(uri: unknown): Promise<void>;
  stat(uri: unknown): Promise<{ type: number }>;
}

function createMockFs(): IFileSystem {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
    delete: vi.fn().mockResolvedValue(undefined),
    readDirectory: vi.fn().mockResolvedValue([]),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ type: 1 }),
  };
}

function createRecord(flowId = "flow-1", id = "flow-1_20260101_001"): ExecutionRecord {
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

// Helper: mock readDirectory to return history base entries then sub-dir entries
function mockDirEntries(
  fs: IFileSystem,
  baseDirEntries: [string, number][],
  subDirEntries?: [string, number][],
) {
  const readDir = fs.readDirectory as ReturnType<typeof vi.fn>;
  if (subDirEntries) {
    readDir
      .mockResolvedValueOnce(baseDirEntries) // findHistoryDir scans history base
      .mockResolvedValueOnce(subDirEntries); // list/count scans sub-dir
  } else {
    readDir.mockResolvedValueOnce(baseDirEntries);
  }
}

describe("HistoryRepository", () => {
  // --- DD-04-005001: 概要（インスタンス生成） ---

  // DDUT-04-005001-00001
  it("canBeInstantiated", () => {
    // Arrange & Act
    const repo = new HistoryRepository(createMockFs(), Uri.file("/workspace"));

    // Assert
    expect(repo).toBeInstanceOf(HistoryRepository);
  });

  // --- DD-04-005002: クラス設計（IHistoryRepository 準拠） ---

  // DDUT-04-005002-00001
  it("implementsIHistoryRepository", () => {
    // Arrange
    const repo = new HistoryRepository(createMockFs(), Uri.file("/workspace"));

    // Assert — verify all IHistoryRepository methods exist
    const iface: IHistoryRepository = repo;
    expect(typeof iface.save).toBe("function");
    expect(typeof iface.load).toBe("function");
    expect(typeof iface.list).toBe("function");
    expect(typeof iface.delete).toBe("function");
    expect(typeof iface.count).toBe("function");
  });

  // --- DD-04-005003/005004: メソッド詳細 ---

  // DDUT-04-005004-00001
  it("save_createsDirectoryWithFlowNameAndWritesJsonFile", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));
    const record = createRecord();

    // Act
    await repo.save(record);

    // Assert — new-format dir: Test_flow-1 (sanitizedName_shortId)
    expect(fs.createDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining("Test_flow-1") }),
    );
    expect(fs.writeFile).toHaveBeenCalled();
  });

  // DDUT-04-005004-00002
  it("load_readsAndParsesJsonFile", async () => {
    // Arrange
    const fs = createMockFs();
    const record = createRecord();
    const encoded = new TextEncoder().encode(JSON.stringify(record));
    // findHistoryDir scans base, finds new-format dir
    mockDirEntries(fs, [["Test_flow-1", 2]]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encoded);
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load("flow-1_20260101_001");

    // Assert
    expect(result).toEqual(record);
  });

  // DDUT-04-005004-00003
  it("list_returnsSortedSummaries", async () => {
    // Arrange
    const fs = createMockFs();
    const r1 = createRecord("flow-1", "flow-1_20260101_001");
    const r2 = createRecord("flow-1", "flow-1_20260102_002");
    r2.startedAt = "2026-01-02T00:00:00Z";

    // findHistoryDir returns new-format dir, then list scans sub-dir
    mockDirEntries(fs, [["Test_flow-1", 2]], [
      ["flow-1_20260101_001.json", 1],
      ["flow-1_20260102_002.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(r1)))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(r2)));
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.list("flow-1");

    // Assert — newest first
    expect(result[0].startedAt).toBe("2026-01-02T00:00:00Z");
  });

  // DDUT-04-005004-00007
  it("list_withUnreadableJson_skipsBrokenRecordAndReturnsReadableSummaries", async () => {
    // Arrange
    const fs = createMockFs();
    const readable = createRecord("flow-1", "flow-1_20260102_002");
    readable.startedAt = "2026-01-02T00:00:00Z";

    mockDirEntries(fs, [["Test_flow-1", 2]], [
      ["flow-1_20260101_001.json", 1],
      ["flow-1_20260102_002.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new TextEncoder().encode("{broken json"))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(readable)));
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.list("flow-1");

    // Assert
    expect(result).toEqual([
      {
        id: readable.id,
        flowId: readable.flowId,
        flowName: readable.flowName,
        startedAt: readable.startedAt,
        duration: readable.duration,
        status: readable.status,
      },
    ]);
  });

  // DDUT-04-005004-00008
  it("listWithDiagnostics_countsUnreadableJsonAlongsideReadableSummaries", async () => {
    // Arrange
    const fs = createMockFs();
    const readable = createRecord("flow-1", "flow-1_20260102_002");
    readable.startedAt = "2026-01-02T00:00:00Z";

    mockDirEntries(fs, [["Test_flow-1", 2]], [
      ["flow-1_20260101_001.json", 1],
      ["flow-1_20260102_002.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new TextEncoder().encode("{broken json"))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(readable)));
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.listWithDiagnostics("flow-1");

    // Assert
    expect(result.unreadableCount).toBe(1);
    expect(result.summaries).toEqual([
      {
        id: readable.id,
        flowId: readable.flowId,
        flowName: readable.flowName,
        startedAt: readable.startedAt,
        duration: readable.duration,
        status: readable.status,
      },
    ]);
  });

  // DDUT-04-005004-00004
  it("delete_removesFileByRecordId", async () => {
    // Arrange
    const fs = createMockFs();
    mockDirEntries(fs, [["Test_flow-1", 2]]);
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    await repo.delete("flow-1_20260101_001");

    // Assert
    expect(fs.delete).toHaveBeenCalled();
  });

  // DDUT-04-005004-00005
  it("count_returnsNumberOfJsonFiles", async () => {
    // Arrange
    const fs = createMockFs();
    mockDirEntries(fs, [["Test_flow-1", 2]], [
      ["record1.json", 1],
      ["record2.json", 1],
      ["record3.json", 1],
    ]);
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.count("flow-1");

    // Assert
    expect(result).toBe(3);
  });

  // DDUT-04-005004-00006
  it("count_nonExistentDirectory_returnsZero", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("FileNotFound"),
    );
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.count("flow-1");

    // Assert
    expect(result).toBe(0);
  });

  // DDUT-04-005003-00001
  it("flowIdWithPathTraversal_throwsError", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.save(createRecord("../evil"))).rejects.toThrow();
  });

  // DDUT-04-005003-00002 — backward compat: old-format directory (bare flowId)
  it("load_fallbackToOldFormatDir", async () => {
    // Arrange
    const fs = createMockFs();
    const record = createRecord();
    const encoded = new TextEncoder().encode(JSON.stringify(record));
    // No new-format match, but old-format "flow-1" dir exists
    mockDirEntries(fs, [["flow-1", 2]]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encoded);
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load("flow-1_20260101_001");

    // Assert
    expect(result).toEqual(record);
  });

  // DDUT-04-005003-00003 — list returns empty when no history dir found
  it("list_noHistoryDir_returnsEmptyArray", async () => {
    // Arrange
    const fs = createMockFs();
    mockDirEntries(fs, []); // empty history base
    const repo = new HistoryRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.list("flow-1");

    // Assert
    expect(result).toEqual([]);
  });
});
