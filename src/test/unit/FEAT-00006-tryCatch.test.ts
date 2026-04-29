/**
 * FEAT-00006: Error Handling Node (TryCatch) unit tests
 *
 * Tests for TryCatchExecutor, findTryCatchNodes helper,
 * ExecutionService tryCatch integration, and registry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TryCatchExecutor } from "@extension/executors/TryCatchExecutor.js";
import { findTryCatchNodes } from "@extension/services/executionHelpers.js";
import type { EdgeInstance } from "@shared/types/flow.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

describe("TryCatchExecutor (FEAT-00006)", () => {
  let executor: TryCatchExecutor;

  beforeEach(() => {
    executor = new TryCatchExecutor();
  });

  // FEAT-00006-003001-00003: metadata が正しいポート構成を持つ
  describe("metadata", () => {
    it("hasCorrectPorts", () => {
      const meta = executor.getMetadata();
      expect(meta.nodeType).toBe("tryCatch");
      expect(meta.inputPorts).toHaveLength(1);
      expect(meta.inputPorts[0].id).toBe("in");
      expect(meta.outputPorts).toHaveLength(3);
      const portIds = meta.outputPorts.map(p => p.id);
      expect(portIds).toContain("try");
      expect(portIds).toContain("catch");
      expect(portIds).toContain("done");
    });
  });

  // FEAT-00006-003001-00002: validate が正常に通過する
  describe("validate", () => {
    it("alwaysValid", () => {
      const result = executor.validate({});
      expect(result.valid).toBe(true);
    });
  });

  // FEAT-00006-003001-00001: try ポートに入力を出力する
  describe("execute", () => {
    it("passesInputToTryPort", async () => {
      const context: IExecutionContext = {
        nodeId: "tc-1",
        settings: {},
        inputs: { in: { data: "test" } },
        flowId: "f1",
        signal: new AbortController().signal,
      };

      const result = await executor.execute(context);

      expect(result.status).toBe("success");
      expect(result.outputs.try).toEqual({ data: "test" });
      expect(result.outputs.done).toEqual({ data: "test" });
    });

    it("returnsCancelledWhenAborted", async () => {
      const ac = new AbortController();
      ac.abort();
      const context: IExecutionContext = {
        nodeId: "tc-1",
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

// FEAT-00006-003002-00001: findTryCatchNodes が正しく try/catch ノードを分類する
describe("findTryCatchNodes (FEAT-00006)", () => {
  it("separatesTryAndCatchNodes", () => {
    const edges: EdgeInstance[] = [
      { id: "e1", sourceNodeId: "tc", sourcePortId: "try", targetNodeId: "a", targetPortId: "in" },
      { id: "e2", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" },
      { id: "e3", sourceNodeId: "tc", sourcePortId: "catch", targetNodeId: "c", targetPortId: "in" },
      { id: "e4", sourceNodeId: "tc", sourcePortId: "done", targetNodeId: "d", targetPortId: "in" },
    ];

    const { tryNodes, catchNodes } = findTryCatchNodes("tc", edges);

    expect(tryNodes.has("a")).toBe(true);
    expect(tryNodes.has("b")).toBe(true);
    expect(tryNodes.has("c")).toBe(false);
    expect(tryNodes.has("d")).toBe(false);

    expect(catchNodes.has("c")).toBe(true);
    expect(catchNodes.has("a")).toBe(false);
    expect(catchNodes.has("d")).toBe(false);
  });

  it("returnsEmptySetsWhenNoPorts", () => {
    const { tryNodes, catchNodes } = findTryCatchNodes("tc", []);
    expect(tryNodes.size).toBe(0);
    expect(catchNodes.size).toBe(0);
  });
});

// FEAT-00006-003004-00001: tryCatch が NodeExecutorRegistry に登録されている
describe("TryCatch registration (FEAT-00006)", () => {
  it("registeredInBuiltins", async () => {
    // Verify the import/registration compiles and executor exists
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

    expect(registered.has("tryCatch")).toBe(true);
  });
});
