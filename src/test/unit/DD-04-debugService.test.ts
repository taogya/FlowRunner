// DD-04 DebugService UT tests
// Trace: DD-04-003001 概要, DD-04-003002 クラス設計,
//        DD-04-003003 startDebug, DD-04-003004 step,
//        DD-04-003005 intermediateResults, DD-04-003006 condition/loop

import { describe, it, expect, vi } from "vitest";
import { DebugService } from "@extension/services/DebugService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { INodeExecutorRegistry, INodeExecutor } from "@extension/interfaces/INodeExecutor.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { NodeInstance, EdgeInstance, FlowDefinition } from "@shared/types/flow.js";
import type { DebugEvent } from "@shared/types/events.js";

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

function createMockExecutor(): INodeExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      status: "success" as const,
      outputs: { out: "result" },
      duration: 5,
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

// --- DD-04-003001: 概要（インスタンス生成） ---

describe("DebugService", () => {
  // DDUT-04-003001-00001
  it("canBeInstantiated", () => {
    // Arrange & Act
    const svc = new DebugService(
      createMockFlowService(),
      createMockExecutorRegistry(),
      createMockHistoryService(),
    );

    // Assert
    expect(svc).toBeInstanceOf(DebugService);
  });

  // --- DD-04-003002: クラス設計（IDebugService 準拠） ---

  // DDUT-04-003002-00001
  it("implementsIDebugService", () => {
    // Arrange
    const svc = new DebugService(
      createMockFlowService(),
      createMockExecutorRegistry(),
      createMockHistoryService(),
    );

    // Assert — verify all IDebugService methods exist
    const iface: IDebugService = svc;
    expect(typeof iface.startDebug).toBe("function");
    expect(typeof iface.step).toBe("function");
    expect(typeof iface.stopDebug).toBe("function");
    expect(typeof iface.isDebugging).toBe("function");
    expect(typeof iface.getIntermediateResults).toBe("function");
    expect(typeof iface.onDebugEvent).toBe("function");
  });

  // --- startDebug (DD-04-003003) ---
  describe("startDebug", () => {
    // DDUT-04-003003-00001
    it("validFlow_setsDebuggingState", async () => {
      // Arrange
      const flow = createFlow([node("A")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );

      // Act
      await svc.startDebug("flow-1");

      // Assert
      expect(svc.isDebugging()).toBe(true);
    });

    // DDUT-04-003003-00002
    it("alreadyDebugging_throwsError", async () => {
      // Arrange
      const flow = createFlow([node("A")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");

      // Act & Assert
      await expect(svc.startDebug("flow-1")).rejects.toThrow("Debug session is already active");
    });

    // DDUT-04-003003-00003
    it("unknownFlow_throwsError", async () => {
      // Arrange
      const svc = new DebugService(
        createMockFlowService(null),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );

      // Act & Assert
      await expect(svc.startDebug("unknown")).rejects.toThrow();
    });

    // DDUT-04-003003-00004
    it("validFlow_firesDebugPausedWithFirstNode", async () => {
      // Arrange
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );
      const events: DebugEvent[] = [];
      svc.onDebugEvent((e) => events.push(e));

      // Act
      await svc.startDebug("flow-1");

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("A");
    });
  });

  // --- step (DD-04-003004) ---

  describe("step", () => {
    // DDUT-04-003004-00001
    it("notDebugging_throwsError", async () => {
      // Arrange
      const svc = new DebugService(
        createMockFlowService(),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );

      // Act & Assert
      await expect(svc.step()).rejects.toThrow("No active debug session");
    });

    // DDUT-04-003004-00002
    it("validStep_executesCurrentNode", async () => {
      // Arrange
      const executor = createMockExecutor();
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");

      // Act
      await svc.step();

      // Assert
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });

    // DDUT-04-003004-00003
    it("disabledNode_skipsWithinSameStepAndAdvances", async () => {
      // Arrange
      const executor = createMockExecutor();
      const flow = createFlow(
        [node("A"), node("B", { enabled: false }), node("C")],
        [edge("A", "out", "B", "in"), edge("B", "out", "C", "in")],
      );
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");
      await svc.step(); // execute A and advance directly to C

      // Act
      await svc.step(); // execute C

      // Assert — B is skipped and C executes on the next step
      expect(executor.execute).toHaveBeenCalledTimes(2);
    });

    // DDUT-04-003004-00004
    it("validateFails_setsErrorAndEndsDebug", async () => {
      // Arrange
      const executor = createMockExecutor();
      (executor.validate as ReturnType<typeof vi.fn>).mockReturnValue({
        valid: false,
        errors: [{ field: "command", message: "required" }],
      });
      const flow = createFlow([node("A")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(executor),
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");

      // Act
      await svc.step();

      // Assert
      expect(svc.isDebugging()).toBe(false);
    });

    // DDUT-04-003004-00005
    it("lastNode_savesRecordAndEndsDebug", async () => {
      // Arrange
      const historyService = createMockHistoryService();
      const flow = createFlow([node("A")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        historyService,
      );
      await svc.startDebug("flow-1");

      // Act
      await svc.step(); // execute last (only) node

      // Assert
      expect(historyService.saveRecord).toHaveBeenCalled();
      expect(svc.isDebugging()).toBe(false);
    });
  });

  // --- getIntermediateResults (DD-04-003005) ---

  describe("getIntermediateResults", () => {
    // DDUT-04-003005-00001
    it("returnsCopyOfIntermediateResults", async () => {
      // Arrange
      const flow = createFlow([node("A"), node("B")], [edge("A", "out", "B", "in")]);
      const svc = new DebugService(
        createMockFlowService(flow),
        createMockExecutorRegistry(),
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");
      await svc.step();

      // Act
      const results1 = svc.getIntermediateResults();
      const results2 = svc.getIntermediateResults();

      // Assert — should return a copy, not the same reference
      expect(results1).toEqual(results2);
      expect(results1).not.toBe(results2);
    });
  });

  // --- 条件分岐 (DD-04-003006) ---

  describe("conditionBranching", () => {
    // DDUT-04-003006-00004
    it("conditionNode_skipsUnselectedPath", async () => {
      // Arrange — Condition → true → T, false → F
      const condExecutor = createMockExecutor();
      (condExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { true: "data" }, // selects true path
        duration: 1,
      });
      const trueExecutor = createMockExecutor();
      const falseExecutor = createMockExecutor();
      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "condition") return condExecutor;
        if (type === "trueNode") return trueExecutor;
        if (type === "falseNode") return falseExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("cond", { type: "condition" }),
          node("T", { type: "trueNode" }),
          node("F", { type: "falseNode" }),
        ],
        [
          edge("cond", "true", "T", "in"),
          edge("cond", "false", "F", "in"),
        ],
      );
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");

      // Act — step through condition and then true path
      await svc.step(); // execute condition
      await svc.step(); // should execute T, skip F

      // Assert
      expect(falseExecutor.execute).not.toHaveBeenCalled();
    });
  });

  // --- ループ (DD-04-003006) ---

  describe("loopHandling", () => {
    // DDUT-04-003006-00005
    it("loopNode_stepsPerIteration_thenAdvances", async () => {
      // Arrange — Loop(count=2) → BodyNode → PostLoop (via done)
      const loopExecutor = createMockExecutor();
      (loopExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: {
          body: [{ index: 0 }, { index: 1 }],
          done: { iterations: 2 },
        },
        duration: 1,
      });
      const bodyExecutor = createMockExecutor();
      (bodyExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { out: "bodyResult" },
        duration: 2,
      });
      const postLoopExecutor = createMockExecutor();

      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "loop") return loopExecutor;
        if (type === "bodyNode") return bodyExecutor;
        if (type === "postLoop") return postLoopExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("L", { type: "loop" }),
          node("B", { type: "bodyNode" }),
          node("P", { type: "postLoop" }),
        ],
        [
          edge("L", "body", "B", "in"),
          edge("L", "done", "P", "in"),
        ],
      );
      const events: DebugEvent[] = [];
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
      );
      svc.onDebugEvent((e) => events.push(e));
      await svc.startDebug("flow-1");
      events.length = 0; // clear start event

      // Act
      await svc.step(); // execute loop node → enters loop mode, pauses at B
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("B");

      events.length = 0;
      await svc.step(); // execute iteration 0 body nodes → pauses at B for iter 1
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("B");

      events.length = 0;
      await svc.step(); // execute iteration 1 body nodes → loop done, pauses at P
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("P");

      events.length = 0;
      await svc.step(); // execute post-loop → ends debug

      // Assert — body executor called twice (once per iteration), post-loop called once
      expect(bodyExecutor.execute).toHaveBeenCalledTimes(2);
      expect(postLoopExecutor.execute).toHaveBeenCalledTimes(1);
      expect(svc.isDebugging()).toBe(false);
    });

    // DDUT-04-003006-00006
    it("loopNode_noBodyNodes_advancesNormally", async () => {
      // Arrange — Loop → PostLoop (only via done, no body connection)
      const loopExecutor = createMockExecutor();
      (loopExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { body: [{ index: 0 }], done: { iterations: 1 } },
        duration: 1,
      });
      const postLoopExecutor = createMockExecutor();

      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "loop") return loopExecutor;
        if (type === "postLoop") return postLoopExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("L", { type: "loop" }),
          node("P", { type: "postLoop" }),
        ],
        [
          edge("L", "done", "P", "in"),
        ],
      );
      const events: DebugEvent[] = [];
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
      );
      svc.onDebugEvent((e) => events.push(e));
      await svc.startDebug("flow-1");
      events.length = 0;

      // Act — step on loop should advance directly to P (no body nodes)
      await svc.step(); // execute loop → no body nodes → advance to P

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("P");
    });

    // DDUT-04-003006-00007
    it("loopNode_bodyError_endsDebug", async () => {
      // Arrange — Loop(count=1) → BodyNode (errors)
      const loopExecutor = createMockExecutor();
      (loopExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { body: { index: 0 }, done: { iterations: 1 } },
        duration: 1,
      });
      const bodyExecutor = createMockExecutor();
      (bodyExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "error" as const,
        outputs: {},
        duration: 2,
        error: { message: "body failed" },
      });

      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "loop") return loopExecutor;
        if (type === "bodyNode") return bodyExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("L", { type: "loop" }),
          node("B", { type: "bodyNode" }),
          node("P", { type: "postLoop" }),
        ],
        [
          edge("L", "body", "B", "in"),
          edge("L", "done", "P", "in"),
        ],
      );
      const historyService = createMockHistoryService();
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        historyService,
      );
      await svc.startDebug("flow-1");

      // Act
      await svc.step(); // execute loop → enters loop mode
      await svc.step(); // execute iteration 0 → body errors → ends debug

      // Assert
      expect(svc.isDebugging()).toBe(false);
      expect(historyService.saveRecord).toHaveBeenCalled();
      const savedRecord = (historyService.saveRecord as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedRecord.status).toBe("error");
    });

    // DDUT-04-003006-00008
    it("loopNode_zeroIterations_skipsBodyNodes", async () => {
      // Arrange — Loop(count=0) → BodyNode → PostLoop
      const loopExecutor = createMockExecutor();
      (loopExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { body: [], done: { iterations: 0 } },
        duration: 1,
      });
      const bodyExecutor = createMockExecutor();
      const postLoopExecutor = createMockExecutor();

      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "loop") return loopExecutor;
        if (type === "bodyNode") return bodyExecutor;
        if (type === "postLoop") return postLoopExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("L", { type: "loop" }),
          node("B", { type: "bodyNode" }),
          node("P", { type: "postLoop" }),
        ],
        [
          edge("L", "body", "B", "in"),
          edge("L", "done", "P", "in"),
        ],
      );
      const events: DebugEvent[] = [];
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
      );
      svc.onDebugEvent((e) => events.push(e));
      await svc.startDebug("flow-1");
      events.length = 0;

      // Act — step on loop with 0 iterations → skip body, go to P
      await svc.step();

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0].nextNodeId).toBe("P");
      expect(bodyExecutor.execute).not.toHaveBeenCalled();
    });

    // DDUT-04-003006-00009
    it("loopNode_intermediateResults_updatedPerIteration", async () => {
      // Arrange
      const loopExecutor = createMockExecutor();
      (loopExecutor.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success" as const,
        outputs: { body: [{ index: 0 }, { index: 1 }], done: { iterations: 2 } },
        duration: 1,
      });
      let bodyCallCount = 0;
      const bodyExecutor = createMockExecutor();
      (bodyExecutor.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        bodyCallCount++;
        return { status: "success" as const, outputs: { out: `result-${bodyCallCount}` }, duration: 1 };
      });

      const registry = createMockExecutorRegistry();
      (registry.get as ReturnType<typeof vi.fn>).mockImplementation((type: string) => {
        if (type === "loop") return loopExecutor;
        if (type === "bodyNode") return bodyExecutor;
        return createMockExecutor();
      });

      const flow = createFlow(
        [
          node("L", { type: "loop" }),
          node("B", { type: "bodyNode" }),
        ],
        [
          edge("L", "body", "B", "in"),
        ],
      );
      const svc = new DebugService(
        createMockFlowService(flow),
        registry,
        createMockHistoryService(),
      );
      await svc.startDebug("flow-1");

      // Act
      await svc.step(); // execute loop → enters loop mode
      await svc.step(); // execute iteration 0

      // Assert — intermediate results should contain body node result
      const results = svc.getIntermediateResults();
      expect(results["B"]).toBeDefined();
      expect(results["B"].status).toBe("success");
    });
  });
});
