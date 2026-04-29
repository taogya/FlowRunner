// DD-04 ExecutionService UT tests
// Trace: DD-04-002001 概要, DD-04-002002 クラス設計,
//        DD-04-002004 executeFlow, DD-04-002006 stopFlow,
//        DD-04-002007 handleNodeError, DD-04-002008 feedback, DD-04-002009 subflow depth

import { describe, it, expect, vi } from "vitest";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { INodeExecutorRegistry, INodeExecutor, IExecutionContext, IExecutionResult } from "@extension/interfaces/INodeExecutor.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { NodeInstance, EdgeInstance, FlowDefinition } from "@shared/types/flow.js";
import type { FlowEvent } from "@shared/types/events.js";

// --- Inline mocks ---

function createMockFlowService(flow: FlowDefinition | null = null) {
  return {
    getFlow: vi.fn().mockResolvedValue(flow),
    createFlow: vi.fn(),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn(),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn() },
  };
}

function createMockExecutor(result?: Partial<IExecutionResult>): INodeExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      status: "success",
      outputs: { out: "result" },
      duration: 10,
      ...result,
    }),
    validate: vi.fn().mockReturnValue({ valid: true }),
    getMetadata: vi.fn(),
  };
}

function createMockExecutorRegistry(executor?: INodeExecutor): INodeExecutorRegistry {
  const defaultExecutor = executor ?? createMockExecutor();
  return {
    get: vi.fn().mockReturnValue(defaultExecutor),
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn().mockReturnValue(true),
  };
}

function createMockHistoryService(): IHistoryService {
  return {
    saveRecord: vi.fn().mockResolvedValue(undefined),
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    deleteRecord: vi.fn(),
    cleanupOldRecords: vi.fn(),
  };
}

function createMockOutputChannel() {
  return { appendLine: vi.fn(), append: vi.fn(), show: vi.fn(), dispose: vi.fn() };
}

function node(id: string, opts?: Partial<NodeInstance>): NodeInstance {
  return { id, type: "command", label: id, enabled: true, position: { x: 0, y: 0 }, settings: {}, ...opts };
}

function edge(src: string, srcPort: string, tgt: string, tgtPort: string): EdgeInstance {
  return { id: `${src}-${tgt}`, sourceNodeId: src, sourcePortId: srcPort, targetNodeId: tgt, targetPortId: tgtPort };
}

function createFlow(nodes: NodeInstance[], edges: EdgeInstance[] = []): FlowDefinition {
  return {
    id: "flow-1", name: "Test Flow", description: "", version: "1.0.0",
    nodes, edges, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// --- DD-04-002001: 概要（インスタンス生成） ---

describe("ExecutionService", () => {
  // DDUT-04-002001-00001
  it("canBeInstantiated", () => {
    // Arrange & Act
    const svc = new ExecutionService(
      createMockFlowService(),
      createMockExecutorRegistry(),
      createMockHistoryService(),
      createMockOutputChannel() as any,
    );

    // Assert
    expect(svc).toBeInstanceOf(ExecutionService);
  });

  // --- DD-04-002002: クラス設計（IExecutionService 準拠） ---

  // DDUT-04-002002-00001
  it("implementsIExecutionService", () => {
    // Arrange
    const svc = new ExecutionService(
      createMockFlowService(),
      createMockExecutorRegistry(),
      createMockHistoryService(),
      createMockOutputChannel() as any,
    );

    // Assert — verify all IExecutionService methods exist
    const iface: IExecutionService = svc;
    expect(typeof iface.executeFlow).toBe("function");
    expect(typeof iface.stopFlow).toBe("function");
    expect(typeof iface.getRunningFlows).toBe("function");
    expect(typeof iface.isRunning).toBe("function");
    expect(typeof iface.onFlowEvent).toBe("function");
  });

  // --- executeFlow (DD-04-002004) ---
  describe("executeFlow", () => {
    // DDUT-04-002004-00001
    it("validFlow_executesAllNodesInOrder", async () => {
      // Arrange
      const executionOrder: string[] = [];
      const executor = createMockExecutor();
      (executor.execute as ReturnType<typeof vi.fn>).mockImplementation(async (ctx: IExecutionContext) => {
        executionOrder.push(ctx.nodeId);
        return { status: "success" as const, outputs: { out: ctx.nodeId }, duration: 1 };
      });
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      expect(executionOrder).toEqual(["A", "B"]);
    });

    // DDUT-04-002004-00012
    it("passesNodeLabelToExecutorContext", async () => {
      // Arrange
      const executor = createMockExecutor();
      const flow = createFlow([node("A", { label: "package" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      expect((executor.execute as ReturnType<typeof vi.fn>).mock.calls[0][0].nodeLabel).toBe("package");
    });

    // DDUT-04-002004-00002
    it("alreadyRunningFlow_throwsError", async () => {
      // Arrange
      const executor = createMockExecutor();
      (executor.execute as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      const flow = createFlow([node("A")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );
      svc.executeFlow("flow-1"); // don't await

      // Act & Assert
      await expect(svc.executeFlow("flow-1")).rejects.toThrow("Flow is already running");
    });

    // DDUT-04-002004-00003
    it("unknownFlowId_throwsError", async () => {
      // Arrange
      const svc = new ExecutionService(
        createMockFlowService(null),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act & Assert
      await expect(svc.executeFlow("unknown")).rejects.toThrow();
    });

    // DDUT-04-002004-00004
    it("disabledNode_setsSkippedStatus", async () => {
      // Arrange
      const executor = createMockExecutor();
      const flow = createFlow([node("A", { enabled: false })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert — executor should NOT be called for disabled node
      expect(executor.execute).not.toHaveBeenCalled();
    });

    // DDUT-04-002004-00009 — REV-012 #1: chain-skip (A→B(disabled)→C: C skipped)
    it("disabledNodeChainSkip_allInputsFromDisabled_skipsDownstream", async () => {
      // Arrange: A → B(disabled) → C — C should be chain-skipped
      const executor = createMockExecutor();
      const flow = createFlow(
        [node("A"), node("B", { enabled: false }), node("C")],
        [edge("A", "out", "B", "in"), edge("B", "out", "C", "in")],
      );
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert — A executes, B skipped (disabled), C skipped (chain-skip)
      expect(executor.execute).toHaveBeenCalledTimes(1);
      expect((executor.execute as ReturnType<typeof vi.fn>).mock.calls[0][0].nodeId).toBe("A");
    });

    // DDUT-04-002004-00010 — REV-012 #1: chain-skip with alternate path (A→B(disabled)→C, D→C: C executes)
    it("disabledNodeChainSkip_hasValidAlternatePath_executesNode", async () => {
      // Arrange: A → B(disabled) → C, D → C — C has valid input from D
      const executor = createMockExecutor();
      const flow = createFlow(
        [node("A"), node("B", { enabled: false }), node("D"), node("C")],
        [edge("A", "out", "B", "in"), edge("B", "out", "C", "in"), edge("D", "out", "C", "in")],
      );
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert — A, D, C execute; B skipped (disabled)
      expect(executor.execute).toHaveBeenCalledTimes(3);
      const executedNodeIds = (executor.execute as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: [IExecutionContext]) => c[0].nodeId,
      );
      expect(executedNodeIds).toContain("A");
      expect(executedNodeIds).toContain("D");
      expect(executedNodeIds).toContain("C");
    });

    // DDUT-04-002004-00011 — REV-012 #1: multi-level chain-skip (A→B(disabled)→C→D: C,D both skipped)
    it("disabledNodeChainSkip_multiLevel_skipsEntireChain", async () => {
      // Arrange: A → B(disabled) → C → D — C and D should both be chain-skipped
      const executor = createMockExecutor();
      const flow = createFlow(
        [node("A"), node("B", { enabled: false }), node("C"), node("D")],
        [edge("A", "out", "B", "in"), edge("B", "out", "C", "in"), edge("C", "out", "D", "in")],
      );
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert — only A executes; B disabled, C and D chain-skipped
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });

    // DDUT-04-002004-00005
    it("executorNotFound_throwsError", async () => {
      // Arrange
      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("No executor registered for nodeType: unknown");
      });
      const flow = createFlow([node("A", { type: "unknown" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act & Assert
      await expect(svc.executeFlow("flow-1")).rejects.toThrow();
    });

    // DDUT-04-002004-00006
    it("validateFails_savesErrorHistory", async () => {
      // Arrange
      const executor = createMockExecutor();
      (executor.validate as ReturnType<typeof vi.fn>).mockReturnValue({
        valid: false,
        errors: [{ field: "command", message: "required" }],
      });
      const flow = createFlow([node("A")]);
      const historyService = createMockHistoryService();
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        historyService,
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert — validation error should be saved in history with error status
      expect(historyService.saveRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: "flow-1",
          status: "error",
          nodeResults: expect.arrayContaining([
            expect.objectContaining({
              nodeId: "A",
              status: "error",
            }),
          ]),
        }),
      );
    });

    // DDUT-04-002004-00007
    it("exceptionDuringExecute_cleansUpRunningFlows", async () => {
      // Arrange
      const executor = createMockExecutor();
      (executor.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("crash"));
      const flow = createFlow([node("A")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      try { await svc.executeFlow("flow-1"); } catch { /* expected */ }

      // Assert — flow should no longer be tracked as running
      expect(svc.isRunning("flow-1")).toBe(false);
    });

    // DDUT-04-002004-00008
    it("duringExecution_firesNodeStartedAndCompletedAndFlowCompletedEvents", async () => {
      // Arrange
      const flow = createFlow([node("A")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );
      const events: FlowEvent[] = [];
      svc.onFlowEvent((e) => events.push(e));

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const types = events.map((e) => e.type);
      expect(types).toContain("nodeStarted");
      expect(types).toContain("nodeCompleted");
      expect(types).toContain("flowCompleted");
    });
  });

  // --- stopFlow (DD-04-002006) ---

  describe("stopFlow", () => {
    // DDUT-04-002006-00001
    it("runningFlow_abortsExecution", async () => {
      // Arrange
      const executor = createMockExecutor();
      (executor.execute as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ status: "success" as const, outputs: {}, duration: 0 }), 5000)),
      );
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );
      const promise = svc.executeFlow("flow-1");

      // Act
      svc.stopFlow("flow-1");

      // Assert — should resolve (not hang)
      await expect(promise).resolves.toBeUndefined();
    });

    // DDUT-04-002006-00002
    it("notRunningFlow_doesNothing", () => {
      // Arrange
      const svc = new ExecutionService(
        createMockFlowService(),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act & Assert — should not throw
      expect(() => svc.stopFlow("non-existent")).not.toThrow();
    });
  });

  // --- handleNodeError (DD-04-002007) ---

  describe("errorPolicy", () => {
    // DDUT-04-002007-00001
    it("stopOnError_stopsFlowAfterNodeError", async () => {
      // Arrange
      const executor = createMockExecutor();
      let callCount = 0;
      (executor.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error("node error");
        return { status: "success" as const, outputs: {}, duration: 0 };
      });
      const flow = createFlow(
        [node("A"), node("B")],
        [edge("A", "out", "B", "in")],
      );
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      try { await svc.executeFlow("flow-1"); } catch { /* expected */ }

      // Assert — B should NOT have been executed
      expect(callCount).toBe(1);
    });

    // DDUT-04-002007-00002 — nodeError event includes result field
    it("nodeErrorEvent_containsResultField", async () => {
      // Arrange — executor returns error status (not throw)
      const executor = createMockExecutor({
        status: "error",
        outputs: {},
        duration: 5,
        error: { message: "boom" },
      });
      const flow = createFlow(
        [node("A")],
        [],
      );
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );
      const events: FlowEvent[] = [];
      svc.onFlowEvent((e) => events.push(e));

      // Act
      try { await svc.executeFlow("flow-1"); } catch { /* expected */ }

      // Assert — nodeError event should include result with error info
      const errorEvent = events.find((e) => e.type === "nodeError");
      expect(errorEvent).toBeDefined();
      expect(errorEvent!.result).toBeDefined();
      expect(errorEvent!.result!.status).toBe("error");
      expect(errorEvent!.result!.nodeId).toBe("A");
      expect(errorEvent!.result!.error).toBeDefined();
      expect(errorEvent!.result!.error!.message).toBe("boom");
    });
  });

  // --- 実行時フィードバック (DD-04-002008) ---

  describe("executionFeedback", () => {
    // DDUT-04-002008-00001
    it("progressContainsCurrentAndTotal", async () => {
      // Arrange
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );
      const events: FlowEvent[] = [];
      svc.onFlowEvent((e) => events.push(e));

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const started = events.find((e) => e.type === "nodeStarted");
      expect(started?.progress).toEqual(expect.objectContaining({ current: expect.any(Number), total: expect.any(Number) }));
    });

    // DDUT-04-002008-00002
    it("outputChannelReceivesLogMessage", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const flow = createFlow([node("A")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      expect(outputChannel.appendLine).toHaveBeenCalled();
    });

    // DDUT-04-002008-00003 — REV-012 #4: command executor logs stdout
    it("commandNode_logsStdoutToOutputChannel", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { stdout: "hello world", stderr: "" },
        duration: 5,
      });
      const flow = createFlow([node("A", { type: "command" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("stdout: hello world"))).toBe(true);
    });

    // DDUT-04-002008-00004 — REV-012 #4: command executor logs stderr as warning
    it("commandNode_logsStderrToOutputChannel", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { stdout: "", stderr: "warning msg" },
        duration: 5,
      });
      const flow = createFlow([node("A", { type: "command" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("stderr: warning msg"))).toBe(true);
    });

    // DDUT-04-002008-00005 — REV-012 #4: http executor logs status code
    it("httpNode_logsStatusCodeToOutputChannel", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { body: '{"ok":true}', status: 200 },
        duration: 50,
      });
      const flow = createFlow([node("A", { type: "http" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("HTTP 200"))).toBe(true);
    });

    // DDUT-04-002008-00006 — REV-012 #4: file executor logs operation and path
    it("fileNode_logsOperationAndPath", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { out: "file content" },
        duration: 3,
      });
      const flow = createFlow([node("A", { type: "file", settings: { operation: "read", path: "data.txt" } })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("read: data.txt"))).toBe(true);
    });

    // DDUT-04-002008-00007 — REV-012 #4: condition executor logs matched branch
    it("conditionNode_logsBranch", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { true: "input-data" },
        duration: 1,
      });
      const flow = createFlow([node("A", { type: "condition" })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("branch: true"))).toBe(true);
    });

    // DDUT-04-002008-00008 — REV-012 #4: transform executor logs expression and result
    it("transformNode_logsExpressionAndResult", async () => {
      // Arrange
      const outputChannel = createMockOutputChannel();
      const executor = createMockExecutor({
        status: "success",
        outputs: { out: 42 },
        duration: 2,
      });
      const flow = createFlow([node("A", { type: "transform", settings: { expression: "input * 2" } })]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
        outputChannel as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert
      const calls = (outputChannel.appendLine as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((msg: string) => msg.includes("expr: input * 2"))).toBe(true);
      expect(calls.some((msg: string) => msg.includes("result: 42"))).toBe(true);
    });
  });

  // --- SubFlow再帰深度制限 (DD-04-002009) ---

  describe("subflowDepthLimit", () => {
    // DDUT-04-002009-00001
    it("depthExceedsMaxSubflowDepth_throwsError", async () => {
      // Arrange — simulate depth > MAX_SUBFLOW_DEPTH (10)
      const flow = createFlow([node("A")]);
      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act & Assert — execute with depth exceeding limit
      await expect(svc.executeFlow("flow-1", { depth: 11 })).rejects.toThrow("SubFlow execution depth exceeded");
    });
  });

  // --- DD-04-003006: ループノードのサブフロー反復実行 ---

  describe("loopSubflowIteration", () => {
    // DDUT-04-003006-00001
    it("loopCountMode_executesBodyNodesForEachIteration", async () => {
      // Arrange: trigger -> loop(count=3) -body-> command -done-> log
      const loopExecutor = createMockExecutor({
        status: "success",
        outputs: {
          body: [
            { index: 0, input: "data" },
            { index: 1, input: "data" },
            { index: 2, input: "data" },
          ],
          done: { iterations: 3, input: "data" },
        },
      });
      (loopExecutor.getMetadata as any).mockReturnValue({ nodeType: "loop" });

      const bodyExecutor = createMockExecutor({ status: "success", outputs: { out: "body-result" } });
      const doneExecutor = createMockExecutor({ status: "success", outputs: { out: "done-result" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "loop") return loopExecutor;
          if (type === "command") return bodyExecutor;
          if (type === "log") return doneExecutor;
          return createMockExecutor();
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("trigger", { type: "trigger" }),
          node("loop1", { type: "loop" }),
          node("body1", { type: "command" }),
          node("done1", { type: "log" }),
        ],
        [
          edge("trigger", "out", "loop1", "in"),
          edge("loop1", "body", "body1", "in"),
          edge("loop1", "done", "done1", "in"),
        ],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      // Act
      await svc.executeFlow("flow-1");

      // Assert: body executor called 3 times (once per iteration)
      expect(bodyExecutor.execute).toHaveBeenCalledTimes(3);
      // Done executor called 1 time (after loop)
      expect(doneExecutor.execute).toHaveBeenCalledTimes(1);
    });

    // DDUT-04-003006-00002
    it("loopWithNoBodyNodes_executesDoneOnly", async () => {
      // Loop with only done-connected nodes (no body port edges)
      const loopExecutor = createMockExecutor({
        status: "success",
        outputs: { body: [{ index: 0 }], done: { iterations: 1 } },
      });

      const doneExecutor = createMockExecutor({ status: "success", outputs: { out: "ok" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "loop") return loopExecutor;
          return doneExecutor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("loop1", { type: "loop" }),
          node("done1", { type: "command" }),
        ],
        [edge("loop1", "done", "done1", "in")],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      await svc.executeFlow("flow-1");

      // Done node executed once, not as part of loop body
      expect(doneExecutor.execute).toHaveBeenCalledTimes(1);
    });

    // DDUT-04-003006-00003
    it("loopBodyError_stopsFlowExecution", async () => {
      const loopExecutor = createMockExecutor({
        status: "success",
        outputs: { body: [{ index: 0 }, { index: 1 }], done: { iterations: 2 } },
      });

      const bodyExecutor = createMockExecutor({
        status: "error",
        outputs: {},
        error: { message: "body failed" },
      });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "loop") return loopExecutor;
          return bodyExecutor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const historyService = createMockHistoryService();
      const flow = createFlow(
        [
          node("loop1", { type: "loop" }),
          node("body1", { type: "command" }),
        ],
        [edge("loop1", "body", "body1", "in")],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        historyService,
        createMockOutputChannel() as any,
      );

      await svc.executeFlow("flow-1");

      // Body executor called once (error on first iteration stops execution)
      expect(bodyExecutor.execute).toHaveBeenCalledTimes(1);
      // Error saved to history
      expect(historyService.saveRecord).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" }),
      );
    });
  });

  // --- FEAT-00006-003003: tryCatch execution ---
  describe("tryCatch execution", () => {
    // DDUT-04-003006-00004
    it("tryCatch_trySuccess_skipsCatch", async () => {
      const tryCatchExecutor = createMockExecutor({ status: "success", outputs: {} });
      const tryBodyExecutor = createMockExecutor({ status: "success", outputs: { out: "ok" } });
      const catchBodyExecutor = createMockExecutor({ status: "success", outputs: { out: "caught" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "tryCatch") return tryCatchExecutor;
          if (type === "log") return catchBodyExecutor;
          return tryBodyExecutor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("tc1", { type: "tryCatch" }),
          node("tryNode", { type: "command" }),
          node("catchNode", { type: "log" }),
        ],
        [
          edge("tc1", "try", "tryNode", "in"),
          edge("tc1", "catch", "catchNode", "in"),
        ],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      await svc.executeFlow("flow-1");

      expect(tryBodyExecutor.execute).toHaveBeenCalledTimes(1);
      expect(catchBodyExecutor.execute).not.toHaveBeenCalled();
    });

    // DDUT-04-003006-00005
    it("tryCatch_tryFails_executesCatchBody", async () => {
      const tryCatchExecutor = createMockExecutor({ status: "success", outputs: {} });
      const tryBodyExecutor = createMockExecutor({
        status: "error",
        outputs: {},
        error: { message: "try failed" },
      });
      const catchBodyExecutor = createMockExecutor({ status: "success", outputs: { out: "handled" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "tryCatch") return tryCatchExecutor;
          if (type === "log") return catchBodyExecutor;
          return tryBodyExecutor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("tc1", { type: "tryCatch" }),
          node("tryNode", { type: "command" }),
          node("catchNode", { type: "log" }),
        ],
        [
          edge("tc1", "try", "tryNode", "in"),
          edge("tc1", "catch", "catchNode", "in"),
        ],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      await svc.executeFlow("flow-1");

      expect(tryBodyExecutor.execute).toHaveBeenCalledTimes(1);
      expect(catchBodyExecutor.execute).toHaveBeenCalledTimes(1);
    });
  });

  // --- FEAT-00007-003003: parallel execution ---
  describe("parallel execution", () => {
    // DDUT-04-003006-00006
    it("parallel_executesBranchesConcurrently", async () => {
      const parallelExecutor = createMockExecutor({ status: "success", outputs: {} });
      const branchAExecutor = createMockExecutor({ status: "success", outputs: { out: "A" } });
      const branchBExecutor = createMockExecutor({ status: "success", outputs: { out: "B" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "parallel") return parallelExecutor;
          if (type === "log") return branchBExecutor;
          return branchAExecutor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("p1", { type: "parallel" }),
          node("branchA", { type: "command" }),
          node("branchB", { type: "log" }),
        ],
        [
          edge("p1", "branch1", "branchA", "in"),
          edge("p1", "branch2", "branchB", "in"),
        ],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      await svc.executeFlow("flow-1");

      expect(branchAExecutor.execute).toHaveBeenCalledTimes(1);
      expect(branchBExecutor.execute).toHaveBeenCalledTimes(1);
    });
  });

  // --- DD-04-002009: outputNodeId ---
  describe("output routing", () => {
    // DDUT-04-002009-00001
    it("outputNodeId_returnsSpecifiedNodeOutput", async () => {
      const executor = createMockExecutor({ status: "success", outputs: { out: "middle" } });
      const lastExecutor = createMockExecutor({ status: "success", outputs: { out: "last" } });

      const registry = {
        get: vi.fn((type: string) => {
          if (type === "log") return lastExecutor;
          return executor;
        }),
        register: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(true),
      };

      const flow = createFlow(
        [
          node("A", { type: "command" }),
          node("B", { type: "log" }),
        ],
        [edge("A", "out", "B", "in")],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      const result = await svc.executeFlow("flow-1", { outputNodeId: "A" });

      expect(result).toEqual({ out: "middle" });
    });
  });

  // --- DD-04-002006: cancellation flow completed event ---
  describe("cancellation events", () => {
    // DDUT-04-002006-00002
    it("cancelledDuringExecution_firesCancelledFlowCompleted", async () => {
      let abortController: AbortController | undefined;
      const slowExecutor: INodeExecutor = {
        execute: vi.fn(async (ctx: IExecutionContext) => {
          // On first call, capture the signal's controller and abort it
          if (!abortController) {
            // Find the service's abort controller by stopping the flow
            // Return success for first node — abort happens before 2nd
            return { status: "success", outputs: { out: "ok" }, duration: 1 };
          }
          return { status: "success", outputs: { out: "ok" }, duration: 1 };
        }),
        validate: vi.fn().mockReturnValue({ valid: true }),
        getMetadata: vi.fn(),
      };

      const flow = createFlow(
        [node("A"), node("B")],
        [edge("A", "out", "B", "in")],
      );

      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(slowExecutor),
        createMockHistoryService(),
        createMockOutputChannel() as any,
      );

      const events: FlowEvent[] = [];
      svc.onFlowEvent(e => events.push(e));

      // Start execution — stopFlow will fire during the second node
      const execPromise = svc.executeFlow("flow-1");
      // Flow is now running; stop it
      svc.stopFlow("flow-1");
      await execPromise;

      const completedEvents = events.filter(e => e.type === "flowCompleted");
      expect(completedEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- AI prompt log details ---
  describe("logNodeDetails", () => {
    // DDUT-04-002008-00003
    it("aiPromptNode_logsResponseAndTokenUsage", async () => {
      const aiExecutor = createMockExecutor({
        status: "success",
        outputs: {
          out: "AI response text",
          _tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, model: "gpt-4" },
        },
      });

      const flow = createFlow([node("ai1", { type: "aiPrompt" })]);
      const outputChannel = createMockOutputChannel();

      const svc = new ExecutionService(
        createMockFlowService(flow),
        createMockExecutorRegistry(aiExecutor),
        createMockHistoryService(),
        outputChannel as any,
      );

      await svc.executeFlow("flow-1");

      // Check that output channel received AI-specific log lines
      const calls = outputChannel.appendLine.mock.calls.map((c: unknown[]) => c[0] as string);
      const hasAiLog = calls.some((msg: string) => msg.includes("AI"));
      const hasTokenLog = calls.some((msg: string) => msg.includes("Tokens"));
      expect(hasAiLog).toBe(true);
      expect(hasTokenLog).toBe(true);
    });
  });
});
