/**
 * FEAT-00018: Flow search and filter foundation
 */
// Trace: FEAT-00018-003001, FEAT-00018-003002, FEAT-00018-003003, FEAT-00018-003004
// Trace: FEAT-00018-003005

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import * as vscode from "vscode";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { IFlowValidationService } from "@extension/interfaces/IFlowValidationService.js";
import { FlowFilterState } from "@extension/ui/FlowFilterState.js";
import { FlowTreeProvider } from "@extension/ui/FlowTreeProvider.js";
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";

function createSummaries(): FlowSummary[] {
  return [
    { id: "alpha", name: "Alpha Flow", updatedAt: "2026-04-06T00:00:00.000Z" },
    { id: "beta", name: "Beta Trigger Flow", updatedAt: "2026-04-07T00:00:00.000Z" },
    { id: "gamma", name: "Archive", updatedAt: "2026-04-05T00:00:00.000Z" },
  ];
}

function createMockFlowService(
  summaries: FlowSummary[] = createSummaries(),
  flows: Record<string, FlowDefinition> = {},
): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn().mockImplementation(async (flowId: string) => {
      const flow = flows[flowId];
      if (!flow) {
        throw new Error(`Flow not found: ${flowId}`);
      }
      return flow;
    }),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn().mockResolvedValue(summaries),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

function createFlowDefinition(id: string, nodeTypes: string[]): FlowDefinition {
  return {
    id,
    name: `${id}-flow`,
    description: "",
    version: "1.0.0",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    nodes: nodeTypes.map((type, index) => ({
      id: `${id}-${type}-${index}`,
      type,
      label: `${type}-${index}`,
      enabled: true,
      position: { x: 0, y: 0 },
      settings: {},
    })),
    edges: [],
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
    getIntermediateResults: vi.fn().mockReturnValue({}),
    onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockFlowEditorManager(): IFlowEditorManager {
  return {
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    closeAllEditors: vi.fn(),
    getActiveFlowId: vi.fn().mockReturnValue("alpha"),
    updateFlow: vi.fn(),
    postMessageToFlow: vi.fn(),
    onDidRequestSave: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestExecute: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestDebug: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
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

describe("FEAT-00018 flow search filter", () => {
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

  // FEAT-00018-003001-00001
  it("searchCommand_updatesSharedFilterState_andClearRestoresAllFlows", async () => {
    const flowService = createMockFlowService();
    const filterState = new FlowFilterState();
    const provider = new FlowTreeProvider(flowService, filterState);
    const refreshSpy = vi.spyOn(provider, "refresh");
    const registry = new CommandRegistry(
      flowService,
      createMockFlowEditorManager(),
      createMockExecutionService(),
      provider as unknown as IFlowTreeProvider,
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService(),
      filterState,
    );

    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(" beta ");
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(undefined);

    registry.registerAll();
    const searchHandler = getRegisteredHandler("flowrunner.searchFlows");
    const clearHandler = getRegisteredHandler("flowrunner.clearFlowFilter");

    await searchHandler();
    const filteredItems = await provider.getChildren();

    await clearHandler();
    const restoredItems = await provider.getChildren();

    expect(filteredItems.map((item) => item.id)).toEqual(["beta"]);
    expect(restoredItems.map((item) => item.id)).toEqual(["alpha", "beta", "gamma"]);
    expect(refreshSpy).toHaveBeenCalledTimes(2);
    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(2);
    expect(vscode.commands.executeCommand).toHaveBeenLastCalledWith(
      "setContext",
      "flowrunner.hasActiveFlowFilter",
      false,
    );
  });

  // FEAT-00018-003003-00002
  it("searchCommand_recentlyUpdatedSort_ordersNewestFirst", async () => {
    const flowService = createMockFlowService();
    const filterState = new FlowFilterState();
    const provider = new FlowTreeProvider(flowService, filterState);
    const registry = new CommandRegistry(
      flowService,
      createMockFlowEditorManager(),
      createMockExecutionService(),
      provider as unknown as IFlowTreeProvider,
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService(),
      filterState,
    );

    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce("");
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce([
        {
          label: "Recently updated first",
          optionId: "updatedAtDesc",
        },
      ])
      .mockResolvedValueOnce(undefined);

    registry.registerAll();
    const searchHandler = getRegisteredHandler("flowrunner.searchFlows");

    await searchHandler();
    const items = await provider.getChildren();

    expect(items.map((item) => item.id)).toEqual(["beta", "alpha", "gamma"]);
  });

  // FEAT-00018-003003-00001
  it("auxiliaryFilters_useCandidateScopedDetailLoad_andResetCacheOnConditionChange", async () => {
    const summaries: FlowSummary[] = [
      { id: "alpha", name: "Beta Trigger Flow", updatedAt: "2026-04-06T00:00:00.000Z" },
      { id: "beta", name: "Beta Trigger SubFlow", updatedAt: "2026-04-07T00:00:00.000Z" },
      { id: "gamma", name: "Archive", updatedAt: "2026-04-05T00:00:00.000Z" },
    ];
    const flows = {
      alpha: createFlowDefinition("alpha", ["trigger", "comment"]),
      beta: createFlowDefinition("beta", ["trigger", "subFlow"]),
      gamma: createFlowDefinition("gamma", ["subFlow"]),
    };
    const flowService = createMockFlowService(summaries, flows);
    const filterState = new FlowFilterState();
    const provider = new FlowTreeProvider(flowService, filterState);
    const registry = new CommandRegistry(
      flowService,
      createMockFlowEditorManager(),
      createMockExecutionService(),
      provider as unknown as IFlowTreeProvider,
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService(),
      filterState,
    );

    vi.mocked(vscode.window.showInputBox)
      .mockResolvedValueOnce("beta")
      .mockResolvedValueOnce("beta");
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce([
        {
          label: "Flows with trigger nodes",
          optionId: "requiresTrigger",
        },
        {
          label: "Flows with subflow nodes",
          optionId: "requiresSubFlow",
        },
      ])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          label: "Flows with trigger nodes",
          optionId: "requiresTrigger",
        },
      ])
      .mockResolvedValueOnce(undefined);

    registry.registerAll();
    const searchHandler = getRegisteredHandler("flowrunner.searchFlows");

    await searchHandler();
    const firstItems = await provider.getChildren();
    const cachedItems = await provider.getChildren();

    await searchHandler();
    const secondItems = await provider.getChildren();

    expect(firstItems.map((item) => item.id)).toEqual(["beta"]);
    expect(cachedItems.map((item) => item.id)).toEqual(["beta"]);
    expect(secondItems.map((item) => item.id)).toEqual(["alpha", "beta"]);
    expect(flowService.getFlow).toHaveBeenCalledTimes(4);
    expect(flowService.getFlow).not.toHaveBeenCalledWith("gamma");
  });

  // FEAT-00018-003005-00001
  it("searchCommand_reusesCurrentCriteria_andOpensSelectedFilteredFlow", async () => {
    const flowService = createMockFlowService(createSummaries(), {
      beta: createFlowDefinition("beta", ["trigger"]),
    });
    const filterState = new FlowFilterState();
    filterState.update({
      query: "beta",
      requiresTrigger: true,
      sortBy: "updatedAtDesc",
    });
    const editorManager = createMockFlowEditorManager();
    const provider = new FlowTreeProvider(flowService, filterState);
    const registry = new CommandRegistry(
      flowService,
      editorManager,
      createMockExecutionService(),
      provider as unknown as IFlowTreeProvider,
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService(),
      filterState,
    );

    vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce("beta");
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce([
        {
          label: "Flows with trigger nodes",
          optionId: "requiresTrigger",
        },
        {
          label: "Recently updated first",
          optionId: "updatedAtDesc",
        },
      ])
      .mockResolvedValueOnce({
        label: "Beta Trigger Flow",
        description: "beta",
        detail: "Updated: 2026-04-07T00:00:00.000Z | Matched filters: Trigger",
        flowId: "beta",
        flowName: "Beta Trigger Flow",
      });

    registry.registerAll();
    const searchHandler = getRegisteredHandler("flowrunner.searchFlows");

    await searchHandler();

    expect(vscode.window.showInputBox).toHaveBeenCalledWith(
      expect.objectContaining({ value: "beta" }),
    );
    expect(vscode.window.showQuickPick).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({ optionId: "requiresTrigger", picked: true }),
        expect.objectContaining({ optionId: "updatedAtDesc", picked: true }),
      ]),
      expect.objectContaining({ canPickMany: true }),
    );
    expect(editorManager.openEditor).toHaveBeenCalledWith(
      "beta",
      "Beta Trigger Flow",
    );
  });

  // FEAT-00018-003002-00001
  it("getChildren_partialCaseInsensitiveMatch_returnsOnlyMatchingFlows", async () => {
    const flowService = createMockFlowService();
    const filterState = new FlowFilterState();
    const provider = new FlowTreeProvider(flowService, filterState);

    filterState.update({ query: "flow" });

    const items = await provider.getChildren();

    expect(items.map((item) => item.id)).toEqual(["alpha", "beta"]);
  });

  // FEAT-00018-003004-00001
  it("getChildren_noMatches_returnsEmptyStateItem_withClearCommand", async () => {
    const flowService = createMockFlowService();
    const filterState = new FlowFilterState();
    const provider = new FlowTreeProvider(flowService, filterState);

    filterState.update({ query: "zzz" });

    const items = await provider.getChildren();
    const treeItem = provider.getTreeItem(items[0]);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("emptyState");
    expect(treeItem.command?.command).toBe("flowrunner.clearFlowFilter");
  });
});