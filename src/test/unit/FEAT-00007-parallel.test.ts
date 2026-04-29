/**
 * FEAT-00007: Parallel Execution unit tests
 *
 * Tests for ParallelExecutor, findParallelBranches helper,
 * ExecutionService parallel integration, and registry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ParallelExecutor } from "@extension/executors/ParallelExecutor.js";
import { findParallelBranches } from "@extension/services/executionHelpers.js";
import type { EdgeInstance } from "@shared/types/flow.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

describe("ParallelExecutor (FEAT-00007)", () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor();
  });

  // FEAT-00007-003001-00002: metadata が正しいポート構成を持つ
  describe("metadata", () => {
    it("hasCorrectPorts", () => {
      const meta = executor.getMetadata();
      expect(meta.nodeType).toBe("parallel");
      expect(meta.inputPorts).toHaveLength(1);
      expect(meta.inputPorts[0].id).toBe("in");
      expect(meta.outputPorts).toHaveLength(4);
      const portIds = meta.outputPorts.map(p => p.id);
      expect(portIds).toContain("branch1");
      expect(portIds).toContain("branch2");
      expect(portIds).toContain("branch3");
      expect(portIds).toContain("done");
    });
  });

  // FEAT-00007-003001-00001: 全ブランチポートに入力を出力する
  describe("execute", () => {
    it("passesInputToAllBranchPorts", async () => {
      const context: IExecutionContext = {
        nodeId: "p-1",
        settings: {},
        inputs: { in: { data: "test" } },
        flowId: "f1",
        signal: new AbortController().signal,
      };

      const result = await executor.execute(context);

      expect(result.status).toBe("success");
      expect(result.outputs.branch1).toEqual({ data: "test" });
      expect(result.outputs.branch2).toEqual({ data: "test" });
      expect(result.outputs.branch3).toEqual({ data: "test" });
      expect(result.outputs.done).toEqual({ data: "test" });
    });

    it("returnsCancelledWhenAborted", async () => {
      const ac = new AbortController();
      ac.abort();
      const context: IExecutionContext = {
        nodeId: "p-1",
        settings: {},
        inputs: { in: null },
        flowId: "f1",
        signal: ac.signal,
      };

      const result = await executor.execute(context);

      expect(result.status).toBe("cancelled");
    });
  });
});

// FEAT-00007-003002-00001: findParallelBranches が正しくブランチノードを分類する
describe("findParallelBranches (FEAT-00007)", () => {
  it("separatesBranchNodes", () => {
    const edges: EdgeInstance[] = [
      { id: "e1", sourceNodeId: "p", sourcePortId: "branch1", targetNodeId: "a1", targetPortId: "in" },
      { id: "e2", sourceNodeId: "a1", sourcePortId: "out", targetNodeId: "a2", targetPortId: "in" },
      { id: "e3", sourceNodeId: "p", sourcePortId: "branch2", targetNodeId: "b1", targetPortId: "in" },
      { id: "e4", sourceNodeId: "p", sourcePortId: "done", targetNodeId: "d", targetPortId: "in" },
    ];

    const branches = findParallelBranches("p", edges);

    expect(branches.has("branch1")).toBe(true);
    expect(branches.get("branch1")!.has("a1")).toBe(true);
    expect(branches.get("branch1")!.has("a2")).toBe(true);
    expect(branches.has("branch2")).toBe(true);
    expect(branches.get("branch2")!.has("b1")).toBe(true);
    // done node should not be in any branch
    expect(branches.get("branch1")!.has("d")).toBe(false);
    expect(branches.get("branch2")!.has("d")).toBe(false);
  });

  it("excludesDoneReachableNodes", () => {
    const edges: EdgeInstance[] = [
      { id: "e1", sourceNodeId: "p", sourcePortId: "branch1", targetNodeId: "a", targetPortId: "in" },
      { id: "e2", sourceNodeId: "p", sourcePortId: "done", targetNodeId: "a", targetPortId: "in" },
    ];

    const branches = findParallelBranches("p", edges);

    // "a" is reachable from both branch1 and done, so it should be excluded from branch1
    expect(branches.has("branch1")).toBe(false);
  });

  it("returnsEmptyMapWhenNoEdges", () => {
    const branches = findParallelBranches("p", []);
    expect(branches.size).toBe(0);
  });

  it("handlesUnconnectedBranches", () => {
    const edges: EdgeInstance[] = [
      { id: "e1", sourceNodeId: "p", sourcePortId: "branch1", targetNodeId: "a", targetPortId: "in" },
      // branch2 and branch3 not connected
      { id: "e2", sourceNodeId: "p", sourcePortId: "done", targetNodeId: "d", targetPortId: "in" },
    ];

    const branches = findParallelBranches("p", edges);

    expect(branches.has("branch1")).toBe(true);
    expect(branches.has("branch2")).toBe(false);
    expect(branches.has("branch3")).toBe(false);
  });
});

// FEAT-00007-003004-00001: parallel が NodeExecutorRegistry に登録されている
describe("Parallel registration (FEAT-00007)", () => {
  it("registeredInBuiltins", async () => {
    const { registerBuiltinExecutors } = await import("@extension/registries/registerBuiltinExecutors.js");
    const registered = new Map<string, unknown>();
    const mockRegistry = {
      register: vi.fn((type: string, exec: unknown) => registered.set(type, exec)),
      get: vi.fn(),
      getAll: vi.fn(),
    };
    const mockDeps = {
      outputChannel: { appendLine: vi.fn(), show: vi.fn() },
      flowRepository: {},
      executionService: {},
    };

    registerBuiltinExecutors(mockRegistry as any, mockDeps as any);

    expect(registered.has("parallel")).toBe(true);
  });
});
