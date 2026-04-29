// FEAT-00020 flow dependency service unit tests
// Trace: FEAT-00020-003001, FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003005

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowDependencyService } from "@extension/services/FlowDependencyService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { FlowDefinition } from "@shared/types/flow.js";

function createFlow(
  id: string,
  name: string,
  nodes: FlowDefinition["nodes"] = [],
): FlowDefinition {
  return {
    id,
    name,
    description: "",
    version: "1.0.0",
    nodes,
    edges: [],
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  };
}

function createFlowService(flows: FlowDefinition[]): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn().mockImplementation(async (flowId: string) => {
      const flow = flows.find((candidate) => candidate.id === flowId);
      if (!flow) {
        throw new Error(`Flow not found: ${flowId}`);
      }
      return flow;
    }),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn().mockResolvedValue(
      flows.map((flow) => ({
        id: flow.id,
        name: flow.name,
        updatedAt: flow.updatedAt,
      })),
    ),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

describe("FEAT-00020 flow dependency service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // FEAT-00020-003001-00001
  it("buildSnapshot_aggregatesOutgoingDependenciesByTargetFlow", async () => {
    const mainFlow = createFlow("main", "Main Flow", [
      { id: "sub-1", type: "subFlow", label: "Call Child A", enabled: true, position: { x: 0, y: 0 }, settings: { flowId: "child-a" } },
      { id: "sub-2", type: "subFlow", label: "Call Child A Again", enabled: true, position: { x: 0, y: 0 }, settings: { flowId: "child-a" } },
    ]);
    const childFlow = createFlow("child-a", "Child Flow A");
    const service = new FlowDependencyService(createFlowService([mainFlow, childFlow]));

    const snapshot = await service.buildSnapshot("main");

    expect(snapshot?.outgoing).toEqual([
      expect.objectContaining({
        flowId: "child-a",
        flowName: "Child Flow A",
        nodeCount: 2,
      }),
    ]);
  });

  // FEAT-00020-003002-00001
  it("buildSnapshot_collectsIncomingAndOutgoingDependencies", async () => {
    const mainFlow = createFlow("main", "Main Flow", [
      { id: "sub-out", type: "subFlow", label: "Call Child", enabled: true, position: { x: 0, y: 0 }, settings: { flowId: "child" } },
    ]);
    const parentFlow = createFlow("parent", "Parent Flow", [
      { id: "sub-in", type: "subFlow", label: "Call Main", enabled: true, position: { x: 0, y: 0 }, settings: { flowId: "main" } },
    ]);
    const childFlow = createFlow("child", "Child Flow");
    const service = new FlowDependencyService(createFlowService([mainFlow, parentFlow, childFlow]));

    const snapshot = await service.buildSnapshot("main");

    expect(snapshot).toEqual(
      expect.objectContaining({
        outgoing: [expect.objectContaining({ flowId: "child" })],
        incoming: [expect.objectContaining({ flowId: "parent" })],
      }),
    );
  });

  // FEAT-00020-003003-00001
  it("buildSnapshot_reportsMissingAndEmptyTargetsAsWarnings", async () => {
    const mainFlow = createFlow("main", "Main Flow", [
      { id: "sub-empty", type: "subFlow", label: "Empty Target", enabled: true, position: { x: 0, y: 0 }, settings: {} },
      { id: "sub-missing", type: "subFlow", label: "Missing Target", enabled: true, position: { x: 0, y: 0 }, settings: { flowId: "ghost" } },
    ]);
    const service = new FlowDependencyService(createFlowService([mainFlow]));

    const snapshot = await service.buildSnapshot("main");

    expect(snapshot?.warnings).toEqual([
      expect.objectContaining({ nodeId: "sub-empty", kind: "emptyTarget", referencedFlowId: null }),
      expect.objectContaining({ nodeId: "sub-missing", kind: "missingTarget", referencedFlowId: "ghost" }),
    ]);
  });

  // FEAT-00020-003005-00001
  it("buildSnapshot_withoutDependencies_returnsEmptySections", async () => {
    const mainFlow = createFlow("main", "Main Flow");
    const service = new FlowDependencyService(createFlowService([mainFlow]));

    const snapshot = await service.buildSnapshot("main");

    expect(snapshot).toEqual({
      flowId: "main",
      flowName: "Main Flow",
      outgoing: [],
      incoming: [],
      warnings: [],
    });
  });
});