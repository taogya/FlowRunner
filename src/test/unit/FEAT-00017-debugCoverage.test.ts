/**
 * FEAT-00017: Step debugging command and control-flow coverage
 */
// Trace: FEAT-00017-003001, FEAT-00017-003006

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import * as vscode from "vscode";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import { DebugService } from "@extension/services/DebugService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { IFlowValidationService } from "@extension/interfaces/IFlowValidationService.js";
import type { INodeExecutor } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { NodeResultMap } from "@shared/types/execution.js";
import type { DebugEvent } from "@shared/types/events.js";
import type { EdgeInstance, FlowDefinition, NodeInstance } from "@shared/types/flow.js";

function createNode(id: string, type: string, overrides: Partial<NodeInstance> = {}): NodeInstance {
  return {
    id,
    type,
    label: `${type}-${id}`,
    enabled: true,
    position: { x: 0, y: 0 },
    settings: {},
    ...overrides,
  };
}

function createEdge(
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): EdgeInstance {
  return {
    id: `${sourceNodeId}-${targetNodeId}-${sourcePortId}-${targetPortId}`,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
  };
}

function createFlow(nodes: NodeInstance[], edges: EdgeInstance[] = []): FlowDefinition {
  return {
    id: "flow-1",
    name: "Step Debug Flow",
    description: "",
    version: "1.0.0",
    nodes,
    edges,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
  };
}

function createMockFlowService(flow: FlowDefinition): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn().mockResolvedValue(flow),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn().mockResolvedValue([]),
    existsFlow: vi.fn().mockResolvedValue(true),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

function createMockExecutionService(): IExecutionService {
  return {
    executeFlow: vi.fn().mockResolvedValue(undefined),
    stopFlow: vi.fn(),
    getRunningFlows: vi.fn().mockReturnValue([]),
    isRunning: vi.fn().mockReturnValue(false),
    onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockDebugService(): IDebugService {
  return {
    startDebug: vi.fn().mockResolvedValue(undefined),
    step: vi.fn().mockResolvedValue(undefined),
    stopDebug: vi.fn(),
    isDebugging: vi.fn().mockReturnValue(false),
    getIntermediateResults: vi.fn().mockReturnValue({} as NodeResultMap),
    onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockFlowEditorManager(activeFlowId = "flow-1"): IFlowEditorManager {
  return {
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    closeAllEditors: vi.fn(),
    getActiveFlowId: vi.fn().mockReturnValue(activeFlowId),
    updateFlow: vi.fn(),
    postMessageToFlow: vi.fn(),
    onDidRequestSave: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestExecute: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestDebug: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  };
}

function createMockFlowTreeProvider(): IFlowTreeProvider {
  return {
    refresh: vi.fn(),
    getTreeItem: vi.fn(),
    getChildren: vi.fn(),
  };
}

function createMockValidationService(): IFlowValidationService {
  return {
    validateFlow: vi.fn().mockResolvedValue([]),
    validateDefinition: vi.fn().mockResolvedValue([]),
  };
}

function createMockOutputChannel(): vscode.OutputChannel {
  return {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: "FlowRunner",
    replace: vi.fn(),
  };
}

function getRegisteredHandler(commandName: string): (...args: unknown[]) => Promise<void> {
  const calls = (vscode.commands.registerCommand as Mock).mock.calls;
  const entry = calls.find((call: unknown[]) => call[0] === commandName);
  if (!entry) {
    throw new Error(`Command not found: ${commandName}`);
  }
  return entry[1] as (...args: unknown[]) => Promise<void>;
}

function createExecutor(
  outputs: Record<string, unknown>,
  overrides: Partial<INodeExecutor> = {},
): INodeExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      status: "success" as const,
      outputs,
      duration: 1,
    }),
    validate: vi.fn().mockReturnValue({ valid: true }),
    getMetadata: vi.fn(),
    ...overrides,
  } as unknown as INodeExecutor;
}

function createExecutorRegistry(executors: Record<string, INodeExecutor>): INodeExecutorRegistry {
  return {
    get: vi.fn((nodeType: string) => {
      const executor = executors[nodeType];
      if (!executor) {
        throw new Error(`Unknown node type: ${nodeType}`);
      }
      return executor;
    }),
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn((nodeType: string) => nodeType in executors),
  };
}

function createHistoryService(): IHistoryService {
  return {
    saveRecord: vi.fn().mockResolvedValue(undefined),
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    deleteRecord: vi.fn(),
    cleanupOldRecords: vi.fn(),
  };
}

describe("FEAT-00017 debug coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );
  });

  // FEAT-00017-003001-00001
  it("debugCommand_startsDebugForResolvedFlow", async () => {
    const flow = createFlow([createNode("trigger", "trigger")]);
    const flowService = createMockFlowService(flow);
    const editorManager = createMockFlowEditorManager();
    const debugService = createMockDebugService();
    const validationService = createMockValidationService();
    const registry = new CommandRegistry(
      flowService,
      editorManager,
      createMockExecutionService(),
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      debugService,
      validationService,
    );

    registry.registerAll();

    const handler = getRegisteredHandler("flowrunner.debugFlow");
    await handler();

    expect(validationService.validateFlow).toHaveBeenCalledWith("flow-1", "debug");
    expect(editorManager.openEditor).toHaveBeenCalledWith("flow-1", "Step Debug Flow");
    expect(debugService.startDebug).toHaveBeenCalledWith("flow-1");
  });

  // FEAT-00017-003006-00001
  it("debugService_skipsDisabledAndUnselectedBranchPauses", async () => {
    const triggerExecutor = createExecutor({ out: "triggered" });
    const conditionExecutor = createExecutor({ true: "take-true" });
    const commandExecutor = createExecutor({ out: "done" });
    const flow = createFlow(
      [
        createNode("A", "trigger"),
        createNode("B", "command", { enabled: false }),
        createNode("C", "condition"),
        createNode("D", "command"),
        createNode("E", "command"),
      ],
      [
        createEdge("A", "out", "B", "input"),
        createEdge("B", "out", "C", "input"),
        createEdge("C", "true", "D", "input"),
        createEdge("C", "false", "E", "input"),
      ],
    );
    const service = new DebugService(
      createMockFlowService(flow),
      createExecutorRegistry({
        trigger: triggerExecutor,
        command: commandExecutor,
        condition: conditionExecutor,
      }),
      createHistoryService(),
    );
    const events: DebugEvent[] = [];
    service.onDebugEvent((event) => events.push(event));

    await service.startDebug("flow-1");
    await service.step();
    await service.step();
    await service.step();

    expect(events.map((event) => event.nextNodeId)).toEqual(["A", "C", "D", undefined]);
    expect(commandExecutor.execute).toHaveBeenCalledTimes(1);
    expect(service.isDebugging()).toBe(false);
  });

  // FEAT-00017-003006-00002
  it("debugService_handlesLoopAndSubflowWithoutBreaking", async () => {
    const loopExecutor = createExecutor({
      body: [{ index: 0 }, { index: 1 }],
      done: { finished: true },
    });
    const bodyExecutor = createExecutor({ out: "body-result" });
    const subFlowExecutor = createExecutor({ out: "subflow-result" });
    const tailExecutor = createExecutor({ out: "tail-result" });
    const flow = createFlow(
      [
        createNode("L", "loop"),
        createNode("B", "bodyNode"),
        createNode("S", "subFlow", { settings: { flowId: "child-flow" } }),
        createNode("T", "command"),
      ],
      [
        createEdge("L", "body", "B", "input"),
        createEdge("L", "done", "S", "input"),
        createEdge("S", "out", "T", "input"),
      ],
    );
    const service = new DebugService(
      createMockFlowService(flow),
      createExecutorRegistry({
        loop: loopExecutor,
        bodyNode: bodyExecutor,
        subFlow: subFlowExecutor,
        command: tailExecutor,
      }),
      createHistoryService(),
    );
    const events: DebugEvent[] = [];
    service.onDebugEvent((event) => events.push(event));

    await service.startDebug("flow-1");
    await service.step();
    await service.step();
    await service.step();
    await service.step();
    await service.step();

    expect(events.map((event) => event.nextNodeId)).toEqual(["L", "B", "B", "S", "T", undefined]);
    expect(bodyExecutor.execute).toHaveBeenCalledTimes(2);
    expect(subFlowExecutor.execute).toHaveBeenCalledTimes(1);
    expect(tailExecutor.execute).toHaveBeenCalledTimes(1);
    expect(service.isDebugging()).toBe(false);
  });
});