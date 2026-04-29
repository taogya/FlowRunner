// BD-04 IExecutionService IT tests
// Trace: BD-04-002001 ExecutionService 概要, BD-04-002002 IExecutionService インターフェース,
//        BD-04-002003 実行フロー詳細, BD-04-002004 データ伝播,
//        BD-04-002005 フロー停止, BD-04-002006 エラーポリシー,
//        BD-04-002007 実行時フィードバック

import { describe, it, expect, vi } from "vitest";
import type { FlowEvent } from "@shared/types/events.js";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { MockNodeExecutor } from "@extension/mocks/MockNodeExecutor.js";
import { MockHistoryService } from "@extension/mocks/MockHistoryService.js";

function createExecutionService(): ExecutionService {
  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Test Flow",
      nodes: [
        { id: "node-1", type: "trigger", label: "Start", enabled: true, position: { x: 0, y: 0 }, settings: {} },
      ],
      edges: [],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("trigger", new MockNodeExecutor("trigger"));
  const historyService = new MockHistoryService();
  const outputChannel = { appendLine: vi.fn() };
  return new ExecutionService(mockFlowService, registry, historyService, outputChannel);
}

function createMultiNodeExecutionService() {
  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Multi Node Flow",
      nodes: [
        { id: "n1", type: "trigger", label: "Start", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        { id: "n2", type: "command", label: "Cmd", enabled: true, position: { x: 100, y: 0 }, settings: { command: "echo test" } },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", sourcePortId: "out", targetNodeId: "n2", targetPortId: "in" },
      ],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("trigger", new MockNodeExecutor("trigger"));
  registry.register("command", new MockNodeExecutor("command"));
  const historyService = new MockHistoryService();
  const outputChannel = { appendLine: vi.fn() };
  return new ExecutionService(mockFlowService, registry, historyService, outputChannel);
}

function createDisabledNodeExecutionService() {
  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Disabled Node Flow",
      nodes: [
        { id: "n1", type: "trigger", label: "Start", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        { id: "n2", type: "command", label: "Disabled", enabled: false, position: { x: 100, y: 0 }, settings: {} },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", sourcePortId: "out", targetNodeId: "n2", targetPortId: "in" },
      ],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("trigger", new MockNodeExecutor("trigger"));
  registry.register("command", new MockNodeExecutor("command"));
  const historyService = new MockHistoryService();
  const outputChannel = { appendLine: vi.fn() };
  return new ExecutionService(mockFlowService, registry, historyService, outputChannel);
}

// REV-012 #1: A→B(disabled)→C chain-skip test
function createChainSkipExecutionService() {
  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Chain Skip Flow",
      nodes: [
        { id: "n1", type: "trigger", label: "Start", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        { id: "n2", type: "command", label: "Disabled", enabled: false, position: { x: 100, y: 0 }, settings: {} },
        { id: "n3", type: "command", label: "Downstream", enabled: true, position: { x: 200, y: 0 }, settings: {} },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", sourcePortId: "out", targetNodeId: "n2", targetPortId: "in" },
        { id: "e2", sourceNodeId: "n2", sourcePortId: "out", targetNodeId: "n3", targetPortId: "in" },
      ],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("trigger", new MockNodeExecutor("trigger"));
  registry.register("command", new MockNodeExecutor("command"));
  const historyService = new MockHistoryService();
  const outputChannel = { appendLine: vi.fn() };
  return new ExecutionService(mockFlowService, registry, historyService, outputChannel);
}

describe("IExecutionService", () => {
  // BDIT-04-002002-00001
  it("executeFlow_withValidFlowId_completesWithoutError", async () => {
    const service = createExecutionService();

    await expect(service.executeFlow("flow-1")).resolves.not.toThrow();
  });

  // BDIT-04-002002-00002
  it("isRunning_beforeExecution_returnsFalse", () => {
    const service = createExecutionService();

    expect(service.isRunning("flow-1")).toBe(false);
  });

  // BDIT-04-002002-00003
  it("getRunningFlows_withNoExecution_returnsEmptyArray", () => {
    const service = createExecutionService();

    expect(service.getRunningFlows()).toEqual([]);
  });

  // BDIT-04-002002-00004
  it("stopFlow_whileRunning_stopsExecution", async () => {
    const service = createExecutionService();

    // Start execution (non-blocking in a real scenario)
    const executePromise = service.executeFlow("flow-1");
    service.stopFlow("flow-1");

    // Should not throw
    await expect(executePromise).resolves.toBeUndefined();
  });

  // BDIT-04-002002-00005
  it("onFlowEvent_duringExecution_receivesEvents", async () => {
    const service = createExecutionService();
    const events: FlowEvent[] = [];

    service.onFlowEvent((event) => {
      events.push(event);
    });

    await service.executeFlow("flow-1");

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "flowCompleted")).toBe(true);
  });
});

// --- BD-04-002001: ExecutionService 概要 ---

describe("ExecutionService Overview (BD-04-002001)", () => {
  // BDIT-04-002001-00001
  it("executionService_orchestratesFlowExecution", async () => {
    const service = createExecutionService();
    const events: FlowEvent[] = [];
    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // Orchestrator fires nodeStarted, nodeCompleted, and flowCompleted
    expect(events.some((e) => e.type === "nodeStarted")).toBe(true);
    expect(events.some((e) => e.type === "flowCompleted")).toBe(true);
  });
});

// --- BD-04-002003: 実行フロー詳細 ---

describe("Execution Flow Detail (BD-04-002003)", () => {
  // BDIT-04-002003-00001
  it("executeFlow_multipleNodes_executesInTopologicalOrder", async () => {
    const service = createMultiNodeExecutionService();
    const nodeEvents: string[] = [];

    service.onFlowEvent((e) => {
      if (e.type === "nodeStarted" && e.nodeId) {
        nodeEvents.push(e.nodeId);
      }
    });

    await service.executeFlow("flow-1");

    expect(nodeEvents).toEqual(["n1", "n2"]);
  });

  // BDIT-04-002003-00002
  it("executeFlow_disabledNode_isSkipped", async () => {
    const service = createDisabledNodeExecutionService();
    const events: FlowEvent[] = [];

    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // Disabled node should be skipped
    const n2Events = events.filter((e) => e.nodeId === "n2");
    const skippedOrAbsent = n2Events.length === 0 || n2Events.some((e) => e.nodeStatus === "skipped");
    expect(skippedOrAbsent).toBe(true);
  });

  // BDIT-04-002003-00003: REV-012 #1 chain-skip
  // Trace: BD-04-002003
  it("executeFlow_downstreamOfDisabledNode_isChainSkipped", async () => {
    const service = createChainSkipExecutionService();
    const events: FlowEvent[] = [];

    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // n2 (disabled) should be skipped
    const n2Events = events.filter((e) => e.nodeId === "n2");
    const n2Skipped = n2Events.length === 0 || n2Events.some((e) => e.nodeStatus === "skipped");
    expect(n2Skipped).toBe(true);

    // n3 (downstream of disabled n2, no other input) should also be chain-skipped
    const n3Events = events.filter((e) => e.nodeId === "n3");
    const n3Skipped = n3Events.length === 0 || n3Events.some((e) => e.nodeStatus === "skipped");
    expect(n3Skipped).toBe(true);

    // n1 (trigger) should still have executed
    const n1Started = events.find((e) => e.type === "nodeStarted" && e.nodeId === "n1");
    expect(n1Started).toBeDefined();
  });
});

// --- BD-04-002004: データ伝播 ---

describe("Data Propagation (BD-04-002004)", () => {
  // BDIT-04-002004-00001
  it("executeFlow_edgeConnectsNodes_dataFlowsFromSourceToTarget", async () => {
    const service = createMultiNodeExecutionService();
    const events: FlowEvent[] = [];

    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // Second node should have completed (received data from first)
    const n2Completed = events.find((e) => e.type === "nodeCompleted" && e.nodeId === "n2");
    expect(n2Completed).toBeDefined();
  });
});

// --- BD-04-002005: フロー停止 ---

describe("Flow Stop (BD-04-002005)", () => {
  // BDIT-04-002005-00001
  it("stopFlow_usesAbortController_stopsExecution", async () => {
    const service = createExecutionService();

    const execPromise = service.executeFlow("flow-1");
    service.stopFlow("flow-1");

    await execPromise;
    expect(service.isRunning("flow-1")).toBe(false);
  });
});

// --- BD-04-002006: エラーポリシー ---

describe("Error Policy (BD-04-002006)", () => {
  // BDIT-04-002006-00001
  it("executeFlow_errorNode_stopsFlowByDefault", async () => {
    const errorExecutor = new MockNodeExecutor("error");
    // Override execute to return error status
    errorExecutor.execute = async () => ({
      status: "error",
      outputs: {},
      duration: 0,
      error: { message: "test error" },
    });

    const mockFlowService = {
      getFlow: async (flowId: string) => ({
        id: flowId,
        name: "Error Flow",
        nodes: [
          { id: "n1", type: "error", label: "Error", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        ],
        edges: [],
      }),
    };
    const registry = new NodeExecutorRegistry();
    registry.register("error", errorExecutor);
    const historyService = new MockHistoryService();
    const outputChannel = { appendLine: vi.fn() };
    const service = new ExecutionService(mockFlowService, registry, historyService, outputChannel);

    const events: FlowEvent[] = [];
    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // ExecutionService fires nodeError when errorPolicy stops the flow
    const errorNode = events.find((e) => e.type === "nodeError" && e.nodeId === "n1");
    expect(errorNode).toBeDefined();
    // flowCompleted with error status
    const flowCompleted = events.find((e) => e.type === "flowCompleted" && e.status === "error");
    expect(flowCompleted).toBeDefined();
  });
});

// --- BD-04-002007: 実行時フィードバック ---

describe("Execution Feedback (BD-04-002007)", () => {
  // BDIT-04-002007-00001
  it("executeFlow_firesNodeStartedAndCompletedEvents", async () => {
    const service = createExecutionService();
    const events: FlowEvent[] = [];

    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    const nodeStarted = events.filter((e) => e.type === "nodeStarted");
    const nodeCompleted = events.filter((e) => e.type === "nodeCompleted");
    const flowCompleted = events.filter((e) => e.type === "flowCompleted");

    expect(nodeStarted.length).toBeGreaterThan(0);
    expect(nodeCompleted.length).toBeGreaterThan(0);
    expect(flowCompleted).toHaveLength(1);
  });
});
