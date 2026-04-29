// BD-04 IHistoryRepository IT tests
// Trace: BD-04-004004 IHistoryRepository インターフェース

import { describe, it, expect } from "vitest";
import type { ExecutionRecord } from "@shared/types/execution.js";
import { HistoryRepository } from "@extension/repositories/HistoryRepository.js";
import { Uri } from "vscode";

function createInMemoryFileSystem() {
  const files = new Map<string, Uint8Array>();
  return {
    writeFile: async (uri: unknown, content: Uint8Array) => {
      files.set(String(uri), content);
    },
    readFile: async (uri: unknown) => {
      const data = files.get(String(uri));
      if (!data) throw new Error("File not found");
      return data;
    },
    delete: async (uri: unknown) => {
      if (!files.has(String(uri))) throw new Error("File not found");
      files.delete(String(uri));
    },
    readDirectory: async (uri: unknown) => {
      const dirStr = String(uri);
      const prefix = dirStr.endsWith("/") ? dirStr : dirStr + "/";
      const result: [string, number][] = [];
      const seenDirs = new Set<string>();
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.substring(prefix.length);
          if (!rest.includes("/")) {
            result.push([rest, 1]); // file
          } else {
            const dirName = rest.split("/")[0];
            if (!seenDirs.has(dirName)) {
              seenDirs.add(dirName);
              result.push([dirName, 2]); // directory
            }
          }
        }
      }
      return result;
    },
    createDirectory: async () => {},
    stat: async (uri: unknown) => {
      if (files.has(String(uri))) return { type: 1 };
      throw new Error("Not found");
    },
  };
}

function createHistoryRepository(): HistoryRepository {
  const fs = createInMemoryFileSystem();
  const root = Uri.file("/test");
  return new HistoryRepository(fs, root);
}

function createSampleExecutionRecord(
  id: string = "flow-1_001",
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

describe("IHistoryRepository", () => {
  // BDIT-04-004004-00001
  it("save_withExecutionRecord_succeedsWithoutError", async () => {
    const repo = createHistoryRepository();
    const record = createSampleExecutionRecord();

    await expect(repo.save(record)).resolves.toBeUndefined();
  });

  // BDIT-04-004004-00002
  it("load_afterSave_returnsExecutionRecord", async () => {
    const repo = createHistoryRepository();
    const record = createSampleExecutionRecord();

    await repo.save(record);
    const loaded = await repo.load("flow-1_001");

    expect(loaded).toEqual(record);
  });

  // BDIT-04-004004-00003
  it("list_afterSave_returnsSummaries", async () => {
    const repo = createHistoryRepository();

    await repo.save(createSampleExecutionRecord("flow-1_001", "flow-1"));
    await repo.save(createSampleExecutionRecord("flow-1_002", "flow-1"));

    const summaries = await repo.list("flow-1");

    expect(summaries.length).toBe(2);
  });

  // BDIT-04-004004-00004
  it("delete_withExistingRecordId_removesRecord", async () => {
    const repo = createHistoryRepository();
    const record = createSampleExecutionRecord();

    await repo.save(record);
    await repo.delete("flow-1_001");

    await expect(repo.load("flow-1_001")).rejects.toThrow();
  });

  // BDIT-04-004004-00005
  it("count_withSavedRecords_returnsCorrectCount", async () => {
    const repo = createHistoryRepository();

    await repo.save(createSampleExecutionRecord("flow-1_001", "flow-1"));
    await repo.save(createSampleExecutionRecord("flow-1_002", "flow-1"));

    const count = await repo.count("flow-1");

    expect(count).toBe(2);
  });
});
