// DD-03 Control Executors UT tests (Condition / Loop / SubFlow)
// Trace: DD-03-007001, DD-03-007002, DD-03-007003

import { describe, it, expect, vi } from "vitest";
import { ConditionExecutor } from "@extension/executors/ConditionExecutor.js";
import { LoopExecutor } from "@extension/executors/LoopExecutor.js";
import { SubFlowExecutor } from "@extension/executors/SubFlowExecutor.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

function createContext(overrides: Partial<IExecutionContext> = {}): IExecutionContext {
  return {
    nodeId: "n1",
    settings: {},
    inputs: {},
    flowId: "flow-1",
    signal: new AbortController().signal,
    ...overrides,
  };
}

// ============================
// ConditionExecutor
// ============================
describe("ConditionExecutor", () => {
  // DDUT-03-007001-00001
  it("validate_noExpression_returnsInvalid", () => {
    // Arrange
    const executor = new ConditionExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-007001-00002
  it("execute_truthyExpression_outputsTrueBranch", async () => {
    // Arrange
    const executor = new ConditionExecutor();
    const context = createContext({
      settings: { expression: "input > 0" },
      inputs: { in: 1 },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs["true"]).toBe(1);
  });

  // DDUT-03-007001-00003
  it("execute_falsyExpression_outputsFalseBranch", async () => {
    // Arrange
    const executor = new ConditionExecutor();
    const context = createContext({
      settings: { expression: "input > 0" },
      inputs: { in: -1 },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs["false"]).toBe(-1);
  });

  // DDUT-03-007001-00004
  it("execute_syntaxError_returnsError", async () => {
    // Arrange
    const executor = new ConditionExecutor();
    const context = createContext({
      settings: { expression: "(((" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("error");
  });
});

// ============================
// LoopExecutor
// ============================
describe("LoopExecutor", () => {
  // DDUT-03-007002-00001
  it("validate_noMode_returnsInvalid", () => {
    // Arrange
    const executor = new LoopExecutor();

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-007002-00002
  it("execute_countMode_returnsSuccess", async () => {
    // Arrange
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "count", count: 3 },
      inputs: { in: "data" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs.body).toEqual([
      { index: 0, input: "data" },
      { index: 1, input: "data" },
      { index: 2, input: "data" },
    ]);
    expect(result.outputs.done).toEqual({ iterations: 3, input: "data" });
  });

  // DDUT-03-007002-00003
  it("execute_listModeNonArray_returnsError", async () => {
    // Arrange
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "list" },
      inputs: { in: "not-an-array" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("error");
    expect(result.error?.message).toContain("not an array");
  });

  // DDUT-03-007002-00004
  it("validate_countNegative_returnsInvalid", () => {
    const executor = new LoopExecutor();
    const result = executor.validate({ loopType: "count", count: -1 });
    expect(result.valid).toBe(false);
  });

  // DDUT-03-007002-00005
  it("validate_conditionNoExpression_returnsInvalid", () => {
    const executor = new LoopExecutor();
    const result = executor.validate({ loopType: "condition" });
    expect(result.valid).toBe(false);
  });

  // DDUT-03-007002-00006
  it("execute_countZero_emptyBody", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "count", count: 0 },
      inputs: { in: "data" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.body).toEqual([]);
    expect(result.outputs.done).toEqual({ iterations: 0, input: "data" });
  });

  // DDUT-03-007002-00007
  it("execute_countSingle_bodyIsObject", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "count", count: 1 },
      inputs: { in: "x" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.body).toEqual({ index: 0, input: "x" });
  });

  // DDUT-03-007002-00008
  it("execute_listMode_iteratesArray", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "list" },
      inputs: { in: ["a", "b", "c"] },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.body).toEqual([
      { index: 0, item: "a" },
      { index: 1, item: "b" },
      { index: 2, item: "c" },
    ]);
    expect(result.outputs.done).toEqual({ iterations: 3, results: ["a", "b", "c"] });
  });

  // DDUT-03-007002-00009
  it("execute_conditionMode_loopsWhileTruthy", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "condition", expression: "index < 3" },
      inputs: { in: "data" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.done).toEqual({ iterations: 3, input: "data" });
  });

  // DDUT-03-007002-00010
  it("execute_conditionFalseImmediate_zeroIterations", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "condition", expression: "false" },
      inputs: { in: "data" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("success");
    expect(result.outputs.done).toEqual({ iterations: 0, input: "data" });
  });

  // DDUT-03-007002-00011
  it("execute_unknownLoopType_returnsError", async () => {
    const executor = new LoopExecutor();
    const context = createContext({
      settings: { loopType: "unknown" },
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("error");
  });

  // DDUT-03-007002-00012
  it("execute_cancelled_returnsCancelled", async () => {
    const executor = new LoopExecutor();
    const ac = new AbortController();
    ac.abort();
    const context = createContext({
      settings: { loopType: "count", count: 5 },
      signal: ac.signal,
    });
    const result = await executor.execute(context);
    expect(result.status).toBe("cancelled");
  });
});

// ============================
// SubFlowExecutor
// ============================
describe("SubFlowExecutor", () => {
  function createMockFlowRepository() {
    return {
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      exists: vi.fn(),
    };
  }

  function createMockExecutionService() {
    return {
      executeFlow: vi.fn().mockResolvedValue({ out: "sub-flow-result" }),
      stopFlow: vi.fn(),
      getRunningFlows: vi.fn().mockReturnValue([]),
      isRunning: vi.fn().mockReturnValue(false),
      onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
  }

  // DDUT-03-007003-00001
  it("validate_noFlowId_returnsInvalid", () => {
    // Arrange
    const executor = new SubFlowExecutor(
      createMockFlowRepository() as any,
      createMockExecutionService() as any,
    );

    // Act
    const result = executor.validate({});

    // Assert
    expect(result.valid).toBe(false);
  });

  // DDUT-03-007003-00002
  it("execute_callsExecutionServiceWithFlowId", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(true);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "sub-flow-1" },
    });

    // Act
    await executor.execute(context);

    // Assert
    expect(execService.executeFlow).toHaveBeenCalledWith("sub-flow-1", expect.objectContaining({ depth: 1 }));
  });

  // DDUT-03-007003-00003
  it("execute_flowNotExists_returnsError", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(false);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "nonexistent" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("error");
  });

  // DDUT-03-007003-00004
  it("execute_passesDepthPlusOne", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(true);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "sub-flow-1" },
      depth: 3,
    });

    // Act
    await executor.execute(context);

    // Assert
    expect(execService.executeFlow).toHaveBeenCalledWith("sub-flow-1", expect.objectContaining({ depth: 4 }));
  });

  // DDUT-03-007003-00005
  it("execute_returnsSubFlowOutput", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(true);
    execService.executeFlow.mockResolvedValue({ out: "sub-result" });
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "sub-flow-1" },
      inputs: { in: "data" },
    });

    // Act
    const result = await executor.execute(context);

    // Assert
    expect(result.status).toBe("success");
    expect(result.outputs?.out).toBe("sub-result");
  });

  // FEAT-00011-002003-00001 — outputNodeId specified → passed to executeFlow
  it("execute_outputNodeIdSpecified_passedToExecuteFlow", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(true);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "sub-flow-1", outputNodeId: "node-x" },
    });

    // Act
    await executor.execute(context);

    // Assert
    expect(execService.executeFlow).toHaveBeenCalledWith(
      "sub-flow-1",
      expect.objectContaining({ outputNodeId: "node-x" }),
    );
  });

  // FEAT-00011-002003-00002 — outputNodeId not specified → undefined in options (backward compat)
  it("execute_outputNodeIdNotSpecified_notPassedToExecuteFlow", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.exists.mockResolvedValue(true);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);
    const context = createContext({
      settings: { flowId: "sub-flow-1" },
    });

    // Act
    await executor.execute(context);

    // Assert
    expect(execService.executeFlow).toHaveBeenCalledWith(
      "sub-flow-1",
      expect.objectContaining({ outputNodeId: undefined }),
    );
  });

  // FEAT-00011-002002-00001 — getMetadataAsync detects terminal nodes
  it("getMetadataAsync_detectsTerminalNodes", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.list.mockResolvedValue([
      { id: "flow-a", name: "Flow A" },
    ]);
    flowRepo.load.mockResolvedValue({
      id: "flow-a",
      name: "Flow A",
      nodes: [
        { id: "n1", type: "trigger", label: "Start" },
        { id: "n2", type: "command", label: "Cmd" },
        { id: "n3", type: "log", label: "End Log" },
      ],
      edges: [
        { sourceNodeId: "n1", targetNodeId: "n2" },
        { sourceNodeId: "n2", targetNodeId: "n3" },
      ],
    });
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);

    // Act
    const meta = await executor.getMetadataAsync({ flowId: "flow-a" });

    // Assert — only n3 is terminal (n1→n2, n2→n3, n3 has no outgoing)
    const outputNodeSetting = meta.settingsSchema.find(s => s.key === "outputNodeId");
    expect(outputNodeSetting?.options).toEqual([
      { value: "n3", label: "End Log" },
    ]);
  });

  // FEAT-00011-002002-00002 — flowId not selected → empty options
  it("getMetadataAsync_noFlowId_emptyOutputOptions", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.list.mockResolvedValue([{ id: "flow-a", name: "Flow A" }]);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);

    // Act
    const meta = await executor.getMetadataAsync({});

    // Assert
    const outputNodeSetting = meta.settingsSchema.find(s => s.key === "outputNodeId");
    expect(outputNodeSetting?.options).toEqual([]);
  });

  // FEAT-00011-002002-00003 — load error → empty options
  it("getMetadataAsync_loadError_emptyOutputOptions", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.list.mockResolvedValue([{ id: "flow-a", name: "Flow A" }]);
    flowRepo.load.mockRejectedValue(new Error("not found"));
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);

    // Act
    const meta = await executor.getMetadataAsync({ flowId: "flow-a" });

    // Assert
    const outputNodeSetting = meta.settingsSchema.find(s => s.key === "outputNodeId");
    expect(outputNodeSetting?.options).toEqual([]);
  });

  // FEAT-00011-002002-00004 — flow list appears in flowId options
  it("getMetadataAsync_flowListPopulatesFlowIdOptions", async () => {
    // Arrange
    const flowRepo = createMockFlowRepository();
    const execService = createMockExecutionService();
    flowRepo.list.mockResolvedValue([
      { id: "flow-a", name: "Flow A" },
      { id: "flow-b", name: "Flow B" },
    ]);
    const executor = new SubFlowExecutor(flowRepo as any, execService as any);

    // Act
    const meta = await executor.getMetadataAsync({});

    // Assert
    const flowIdSetting = meta.settingsSchema.find(s => s.key === "flowId");
    expect(flowIdSetting?.options).toEqual([
      { value: "flow-a", label: "Flow A" },
      { value: "flow-b", label: "Flow B" },
    ]);
  });
});
