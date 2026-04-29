/**
 * FEAT-00002: ExecutionService & DebugService variable store integration tests
 *
 * Verifies that variable stores are created and shared across all nodes
 * during flow execution and debug sessions.
 */
import { describe, it, expect, vi } from "vitest";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import { DebugService } from "@extension/services/DebugService.js";
import type { INodeExecutor, IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IVariableStore } from "@extension/interfaces/IVariableStore.js";
import type { FlowDefinition, NodeInstance, EdgeInstance } from "@shared/types/flow.js";

// --- Helpers ---

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

function createMockHistoryService(): IHistoryService {
  return {
    saveRecord: vi.fn().mockResolvedValue(undefined),
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    deleteRecord: vi.fn(),
    cleanupOldRecords: vi.fn(),
  };
}

// FEAT-00002-003003-00001: フロー実行中に全ノードが同一ストアを共有する
describe("ExecutionService variable sharing (FEAT-00002)", () => {
  it("should pass the same VariableStore instance to all nodes", async () => {
    const capturedVariables: (IVariableStore | undefined)[] = [];

    const mockExecutor: INodeExecutor = {
      execute: vi.fn().mockImplementation(async (ctx: IExecutionContext) => {
        capturedVariables.push(ctx.variables);
        return { status: "success" as const, outputs: { out: "ok" }, duration: 1 };
      }),
      validate: vi.fn().mockReturnValue({ valid: true }),
      getMetadata: vi.fn(),
    };

    const registry: INodeExecutorRegistry = {
      get: vi.fn().mockReturnValue(mockExecutor),
      register: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      has: vi.fn().mockReturnValue(true),
    };

    const flow = createFlow(
      [node("n1"), node("n2"), node("n3")],
      [edge("n1", "out", "n2", "in"), edge("n2", "out", "n3", "in")],
    );

    const flowService: IFlowService = {
      getFlow: vi.fn().mockResolvedValue(flow),
      createFlow: vi.fn(),
      saveFlow: vi.fn(),
      deleteFlow: vi.fn(),
      renameFlow: vi.fn(),
      listFlows: vi.fn(),
      existsFlow: vi.fn(),
      onDidChangeFlows: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };

    const outputChannel = { appendLine: vi.fn() };

    const service = new ExecutionService(flowService, registry, createMockHistoryService(), outputChannel);
    const events: unknown[] = [];
    service.onFlowEvent((e) => events.push(e));

    await service.executeFlow("flow-1");

    // All 3 nodes should have received variables
    expect(capturedVariables).toHaveLength(3);
    expect(capturedVariables[0]).toBeDefined();
    // All should be the same instance
    expect(capturedVariables[0]).toBe(capturedVariables[1]);
    expect(capturedVariables[1]).toBe(capturedVariables[2]);
  });
});

// FEAT-00002-003004-00001: デバッグ実行で変数ストアが利用可能
describe("DebugService variable sharing (FEAT-00002)", () => {
  it("should pass VariableStore to step contexts", async () => {
    const capturedVariables: (IVariableStore | undefined)[] = [];

    const mockExecutor: INodeExecutor = {
      execute: vi.fn().mockImplementation(async (ctx: IExecutionContext) => {
        capturedVariables.push(ctx.variables);
        return { status: "success" as const, outputs: { out: "ok" }, duration: 1 };
      }),
      validate: vi.fn().mockReturnValue({ valid: true }),
      getMetadata: vi.fn(),
    };

    const registry: INodeExecutorRegistry = {
      get: vi.fn().mockReturnValue(mockExecutor),
      register: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      has: vi.fn().mockReturnValue(true),
    };

    const flow = createFlow(
      [node("n1"), node("n2")],
      [edge("n1", "out", "n2", "in")],
    );

    const flowService = {
      getFlow: vi.fn().mockResolvedValue(flow),
    };

    const debugService = new DebugService(
      flowService,
      registry,
      createMockHistoryService(),
    );

    await debugService.startDebug("flow-1");

    // Step through both nodes
    await debugService.step(); // executes n1
    await debugService.step(); // executes n2

    // Both should have received variables and be the same instance
    expect(capturedVariables).toHaveLength(2);
    expect(capturedVariables[0]).toBeDefined();
    expect(capturedVariables[0]).toBe(capturedVariables[1]);
  });
});
