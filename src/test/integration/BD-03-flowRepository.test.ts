// BD-03 IFlowRepository IT tests
// Trace: BD-03-005005 IFlowRepository インターフェース

import { describe, it, expect } from "vitest";
import type { FlowDefinition } from "@shared/types/flow.js";
import { FlowRepository } from "@extension/repositories/FlowRepository.js";
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
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.substring(prefix.length);
          if (!rest.includes("/")) {
            result.push([rest, 1]);
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

function createFlowRepository(): FlowRepository {
  const fs = createInMemoryFileSystem();
  const root = Uri.file("/test");
  return new FlowRepository(fs, root);
}

function createSampleFlowDefinition(id: string = "flow-1"): FlowDefinition {
  return {
    id,
    name: "Test Flow",
    description: "A test flow definition",
    version: "1.0.0",
    nodes: [
      {
        id: "node-1",
        type: "trigger",
        label: "Start",
        enabled: true,
        position: { x: 0, y: 0 },
        settings: {},
      },
    ],
    edges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("IFlowRepository", () => {
  // BDIT-03-005005-00001
  it("save_withFlowDefinition_succeedsWithoutError", async () => {
    const repo = createFlowRepository();
    const flow = createSampleFlowDefinition();

    await expect(repo.save(flow)).resolves.toBeUndefined();
  });

  // BDIT-03-005005-00002
  it("load_afterSave_returnsFlowDefinition", async () => {
    const repo = createFlowRepository();
    const flow = createSampleFlowDefinition();

    await repo.save(flow);
    const loaded = await repo.load("flow-1");

    expect(loaded).toEqual(flow);
  });

  // BDIT-03-005005-00003
  it("delete_withExistingFlowId_removesFlow", async () => {
    const repo = createFlowRepository();
    const flow = createSampleFlowDefinition();

    await repo.save(flow);
    await repo.delete("flow-1");
    const exists = await repo.exists("flow-1");

    expect(exists).toBe(false);
  });

  // BDIT-03-005005-00004
  it("list_withSavedFlows_returnsFlowSummaries", async () => {
    const repo = createFlowRepository();
    await repo.save(createSampleFlowDefinition("flow-1"));
    await repo.save(createSampleFlowDefinition("flow-2"));

    const summaries = await repo.list();

    expect(summaries.length).toBe(2);
  });

  // BDIT-03-005005-00005
  it("exists_withExistingFlowId_returnsTrue", async () => {
    const repo = createFlowRepository();
    await repo.save(createSampleFlowDefinition());

    const result = await repo.exists("flow-1");

    expect(result).toBe(true);
  });

  // BDIT-03-005005-00006
  it("exists_withNonExistingFlowId_returnsFalse", async () => {
    const repo = createFlowRepository();

    const result = await repo.exists("non-existent");

    expect(result).toBe(false);
  });
});
