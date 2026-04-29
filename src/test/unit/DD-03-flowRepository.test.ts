// DD-03 FlowRepository UT tests
// Trace: DD-03-003001, DD-03-003002, DD-03-003003, DD-03-003004, DD-03-003005

import { describe, it, expect, vi } from "vitest";
import { FlowRepository } from "@extension/repositories/FlowRepository.js";
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { FlowDefinition } from "@shared/types/flow.js";
import { Uri } from "vscode";

// --- IFileSystem inline mock ---

function createMockFs() {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(new Uint8Array()),
    delete: vi.fn().mockResolvedValue(undefined),
    readDirectory: vi.fn().mockResolvedValue([]),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ type: 1 }),
  };
}

function createFlow(id = "flow-1"): FlowDefinition {
  return {
    id, name: "Test", description: "", version: "1.0.0",
    nodes: [], edges: [],
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z",
  };
}

describe("FlowRepository", () => {
  // --- DD-03-003001: 概要 ---

  // DDUT-03-003001-00001
  it("canBeInstantiated", () => {
    // Arrange
    const fs = createMockFs();

    // Act
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Assert
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FlowRepository);
  });

  // --- DD-03-003002: クラス設計 ---

  // DDUT-03-003002-00001
  it("implementsIFlowRepository", () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Assert
    const iface: IFlowRepository = repo;
    expect(typeof iface.save).toBe("function");
    expect(typeof iface.load).toBe("function");
    expect(typeof iface.delete).toBe("function");
    expect(typeof iface.list).toBe("function");
    expect(typeof iface.exists).toBe("function");
  });

  // DDUT-03-003003-00001
  it("save_writesJsonFile", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));
    const flow = createFlow();

    // Act
    await repo.save(flow);

    // Assert
    expect(fs.writeFile).toHaveBeenCalled();
  });

  // DDUT-03-003003-00002
  it("load_existingFlow_returnsFlowDefinition", async () => {
    // Arrange
    const fs = createMockFs();
    const flow = createFlow();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      ["Test_flow-1.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(flow)),
    );
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load("flow-1");

    // Assert
    expect(result).toEqual(flow);
  });

  // DDUT-03-003003-00003
  it("load_nonExistentFlow_throwsError", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.load("nonexistent")).rejects.toThrow("Flow not found");
  });

  // DDUT-03-003003-00004
  it("delete_existingFlow_deletesFile", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      ["Test_flow-1.json", 1],
    ]);
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    await repo.delete("flow-1");

    // Assert
    expect(fs.delete).toHaveBeenCalled();
  });

  // DDUT-03-003003-00005
  it("delete_nonExistentFlow_throwsError", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.delete("nonexistent")).rejects.toThrow("Flow not found");
  });

  // DDUT-03-003003-00006
  it("list_returnsSortedByNameAsc", async () => {
    // Arrange
    const fs = createMockFs();
    const f1 = createFlow("f1");
    f1.name = "Bravo";
    f1.updatedAt = "2026-01-02T00:00:00Z";
    const f2 = createFlow("f2");
    f2.name = "Alpha";
    f2.updatedAt = "2026-01-01T00:00:00Z";
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      ["f1.json", 1],
      ["f2.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(f1)))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(f2)));
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.list();

    // Assert — alphabetical ascending
    expect(result[0].id).toBe("f2"); // Alpha
    expect(result[1].id).toBe("f1"); // Bravo
  });

  // DDUT-03-003003-00007
  it("exists_existingFlow_returnsTrue", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      ["Test_flow-1.json", 1],
    ]);
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.exists("flow-1");

    // Assert
    expect(result).toBe(true);
  });

  // DDUT-03-003003-00008
  it("exists_nonExistentFlow_returnsFalse", async () => {
    // Arrange
    const fs = createMockFs();
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.exists("nonexistent");

    // Assert
    expect(result).toBe(false);
  });

  // DDUT-03-003004-00001
  it("flowIdWithDotDot_throwsError", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.load("../evil")).rejects.toThrow();
  });

  // DDUT-03-003004-00002
  it("flowIdWithSlash_throwsError", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.load("path/traversal")).rejects.toThrow();
  });

  // DDUT-03-003004-00003
  it("ensureBaseDir_createsDirectoryIfNotExists", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    await repo.save(createFlow());

    // Assert
    expect(fs.createDirectory).toHaveBeenCalled();
  });

  // --- DD-03-003005: セキュリティ考慮事項 ---

  // DDUT-03-003005-00001
  it("rejectsFlowIdWithDotDot", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.load("../malicious")).rejects.toThrow("Invalid flow ID");
  });

  // DDUT-03-003005-00002
  it("rejectsFlowIdWithBackslash", async () => {
    // Arrange
    const fs = createMockFs();
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act & Assert
    await expect(repo.load("..\\malicious")).rejects.toThrow("Invalid flow ID");
  });

  // --- 3-tier findFlowFile lookup tests ---

  // DDUT-03-003003-00009
  it("load_fullFlowIdMatch_loadsCorrectFile", async () => {
    // Arrange — file named with full flowId
    const fs = createMockFs();
    const flowId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const flow = createFlow(flowId);
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      [`Test_${flowId}.json`, 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(flow)),
    );
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load(flowId);

    // Assert
    expect(result.id).toBe(flowId);
  });

  // DDUT-03-003003-00010
  it("load_legacyShortIdMatch_loadsCorrectFile", async () => {
    // Arrange — file named with old shortId convention (first 8 chars)
    const fs = createMockFs();
    const flowId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const shortId = flowId.slice(0, 8);
    const flow = createFlow(flowId);
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      [`OldName_${shortId}.json`, 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(flow)),
    );
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load(flowId);

    // Assert
    expect(result.id).toBe(flowId);
  });

  // DDUT-03-003003-00011
  it("load_shortIdAmbiguous_fallsBackToContentScan", async () => {
    // Arrange — two files with same shortId prefix, content scan resolves
    const fs = createMockFs();
    const flowId1 = "aaaaaaaa-1111-cccc-dddd-eeeeeeeeeeee";
    const flowId2 = "aaaaaaaa-2222-cccc-dddd-eeeeeeeeeeee";
    const shortId = "aaaaaaaa";
    const flow1 = createFlow(flowId1);
    const flow2 = createFlow(flowId2);
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      [`Name1_${shortId}.json`, 1],
      [`Name2_${shortId}.json`, 1],
    ]);
    // readFile calls: content scan (Name1, Name2), then load reads matched file again
    (fs.readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(flow1)))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(flow2)))
      .mockResolvedValueOnce(new TextEncoder().encode(JSON.stringify(flow2)));
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act — load flowId2 (not the first file)
    const result = await repo.load(flowId2);

    // Assert
    expect(result.id).toBe(flowId2);
  });

  // DDUT-03-003003-00012
  it("load_contentFallback_readsJsonToMatchFlowId", async () => {
    // Arrange — filename does not contain flowId at all
    const fs = createMockFs();
    const flowId = "xxxxxxxx-yyyy-zzzz-1111-222222222222";
    const flow = createFlow(flowId);
    (fs.readDirectory as ReturnType<typeof vi.fn>).mockResolvedValue([
      ["random-name.json", 1],
    ]);
    (fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify(flow)),
    );
    const repo = new FlowRepository(fs, Uri.file("/workspace"));

    // Act
    const result = await repo.load(flowId);

    // Assert
    expect(result.id).toBe(flowId);
  });
});
