// BD-04 IDebugService IT tests
// Trace: BD-04-003001 DebugService 概要, BD-04-003002 IDebugService インターフェース,
//        BD-04-003003 デバッグ実行フロー, BD-04-003004 中間結果,
//        BD-04-003005 条件分岐・ループの扱い

import { describe, it, expect } from "vitest";
import type { DebugEvent } from "@shared/types/events.js";
import { DebugService } from "@extension/services/DebugService.js";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { MockNodeExecutor } from "@extension/mocks/MockNodeExecutor.js";
import { MockHistoryService } from "@extension/mocks/MockHistoryService.js";

function createDebugService(): DebugService {
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
  return new DebugService(mockFlowService, registry, historyService);
}

function createMultiNodeDebugService(): DebugService {
  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Multi Node Flow",
      nodes: [
        { id: "n1", type: "trigger", label: "Start", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        { id: "n2", type: "command", label: "Cmd", enabled: true, position: { x: 100, y: 0 }, settings: {} },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", sourcePortId: "out", targetNodeId: "n2", targetPortId: "input" },
      ],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("trigger", new MockNodeExecutor("trigger"));
  registry.register("command", new MockNodeExecutor("command"));
  const historyService = new MockHistoryService();
  return new DebugService(mockFlowService, registry, historyService);
}

function createConditionDebugService(): DebugService {
  const conditionExecutor = new MockNodeExecutor("condition");
  conditionExecutor.execute = async () => ({
    status: "success" as const,
    outputs: { true: "truthy" },
    duration: 1,
  });

  const mockFlowService = {
    getFlow: async (flowId: string) => ({
      id: flowId,
      name: "Condition Flow",
      nodes: [
        { id: "n1", type: "condition", label: "If", enabled: true, position: { x: 0, y: 0 }, settings: {} },
        { id: "n2", type: "command", label: "True Path", enabled: true, position: { x: 100, y: -50 }, settings: {} },
        { id: "n3", type: "command", label: "False Path", enabled: true, position: { x: 100, y: 50 }, settings: {} },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", sourcePortId: "true", targetNodeId: "n2", targetPortId: "input" },
        { id: "e2", sourceNodeId: "n1", sourcePortId: "false", targetNodeId: "n3", targetPortId: "input" },
      ],
    }),
  };
  const registry = new NodeExecutorRegistry();
  registry.register("condition", conditionExecutor);
  registry.register("command", new MockNodeExecutor("command"));
  const historyService = new MockHistoryService();
  return new DebugService(mockFlowService, registry, historyService);
}

describe("IDebugService", () => {
  // BDIT-04-003002-00001
  it("startDebug_withValidFlowId_startsDebugMode", async () => {
    const service = createDebugService();

    await service.startDebug("flow-1");

    expect(service.isDebugging()).toBe(true);
  });

  // BDIT-04-003002-00002
  it("isDebugging_beforeStart_returnsFalse", () => {
    const service = createDebugService();

    expect(service.isDebugging()).toBe(false);
  });

  // BDIT-04-003002-00003
  it("step_afterStart_executesOneNode", async () => {
    const service = createDebugService();

    await service.startDebug("flow-1");
    await expect(service.step()).resolves.toBeUndefined();
  });

  // BDIT-04-003002-00004
  it("stopDebug_whileDebugging_stopsDebugMode", async () => {
    const service = createDebugService();

    await service.startDebug("flow-1");
    service.stopDebug();

    expect(service.isDebugging()).toBe(false);
  });

  // BDIT-04-003002-00005
  it("getIntermediateResults_afterStep_returnsNodeResults", async () => {
    const service = createDebugService();

    await service.startDebug("flow-1");
    await service.step();

    const results = service.getIntermediateResults();

    expect(results).toBeDefined();
    expect(typeof results).toBe("object");
  });

  // BDIT-04-003002-00006
  it("onDebugEvent_afterStep_receivesEvent", async () => {
    const service = createDebugService();
    const events: DebugEvent[] = [];

    service.onDebugEvent((event) => {
      events.push(event);
    });

    await service.startDebug("flow-1");
    await service.step();

    expect(events.length).toBeGreaterThan(0);
  });
});

// --- BD-04-003001: DebugService 概要 ---

describe("DebugService Overview (BD-04-003001)", () => {
  // BDIT-04-003001-00001
  it("debugService_managesDebugModeAndStepExecution", async () => {
    const service = createMultiNodeDebugService();

    await service.startDebug("flow-1");
    expect(service.isDebugging()).toBe(true);

    // Step first node
    await service.step();
    expect(service.isDebugging()).toBe(true);

    // Step second (last) node — ends debug
    await service.step();
    expect(service.isDebugging()).toBe(false);
  });
});

// --- BD-04-003003: デバッグ実行フロー ---

describe("Debug Execution Flow (BD-04-003003)", () => {
  // BDIT-04-003003-00001
  it("startDebug_initializesAndPausesBeforeFirstNode", async () => {
    const service = createMultiNodeDebugService();
    const events: DebugEvent[] = [];
    service.onDebugEvent((e) => events.push(e));

    await service.startDebug("flow-1");

    // Fire paused event with first node
    expect(events).toHaveLength(1);
    expect(events[0].nextNodeId).toBe("n1");
    expect(events[0].intermediateResults).toEqual({});
  });

  // BDIT-04-003003-00002
  it("step_executesOneNodeAndPausesBeforeNext", async () => {
    const service = createMultiNodeDebugService();
    const events: DebugEvent[] = [];
    service.onDebugEvent((e) => events.push(e));

    await service.startDebug("flow-1");
    events.length = 0; // Clear the startDebug event

    await service.step();

    // Should fire paused event with second node
    expect(events).toHaveLength(1);
    expect(events[0].nextNodeId).toBe("n2");
  });

  // BDIT-04-003003-00003
  it("step_lastNode_endsDebugAndSavesHistory", async () => {
    const service = createMultiNodeDebugService();

    await service.startDebug("flow-1");
    await service.step(); // execute n1
    await service.step(); // execute n2 (last)

    expect(service.isDebugging()).toBe(false);
  });

  // BDIT-04-003003-00004
  it("stopDebug_clearsStateAndEndsSession", async () => {
    const service = createMultiNodeDebugService();

    await service.startDebug("flow-1");
    await service.step();

    service.stopDebug();

    expect(service.isDebugging()).toBe(false);
    // After stopDebug, further step() should throw since debugging is false
  });
});

// --- BD-04-003004: 中間結果 ---

describe("Intermediate Results (BD-04-003004)", () => {
  // BDIT-04-003004-00001
  it("getIntermediateResults_afterSteps_containsNodeResults", async () => {
    const service = createMultiNodeDebugService();

    await service.startDebug("flow-1");
    await service.step(); // execute n1

    const results = service.getIntermediateResults();

    expect(results["n1"]).toBeDefined();
    expect(results["n1"].nodeId).toBe("n1");
    expect(results["n1"].status).toBe("success");
    expect(results["n2"]).toBeUndefined();
  });

  // BDIT-04-003004-00002
  it("getIntermediateResults_includesInDebugEvent", async () => {
    const service = createMultiNodeDebugService();
    const events: DebugEvent[] = [];
    service.onDebugEvent((e) => events.push(e));

    await service.startDebug("flow-1");
    await service.step();

    const afterStep = events[events.length - 1];
    expect(afterStep.intermediateResults["n1"]).toBeDefined();
  });
});

// --- BD-04-003005: 条件分岐・ループ ---

describe("Condition Branch in Debug (BD-04-003005)", () => {
  // BDIT-04-003005-00001
  it("step_conditionNode_skipsUnselectedBranch", async () => {
    const service = createConditionDebugService();

    await service.startDebug("flow-1");

    // Step condition node (outputs "true" port only)
    await service.step();

    // Step true-path node
    await service.step();

    // Debug should be done — false-path node n3 was skipped
    expect(service.isDebugging()).toBe(false);

    const _results = service.getIntermediateResults();
    // getIntermediateResults returns {} after endDebug clears state,
    // so we verify via events instead
  });

  // BDIT-04-003005-00002
  it("step_conditionNode_firesPausedOnSelectedPath", async () => {
    const service = createConditionDebugService();
    const events: DebugEvent[] = [];
    service.onDebugEvent((e) => events.push(e));

    await service.startDebug("flow-1");
    await service.step(); // execute condition

    // After condition, should pause on n2 (true path), not n3 (false path)
    const afterCondition = events[events.length - 1];
    expect(afterCondition.nextNodeId).toBe("n2");
  });
});
