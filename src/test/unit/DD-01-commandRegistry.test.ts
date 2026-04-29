// DD-01 CommandRegistry UT tests
// Trace: DD-01-004001, DD-01-004002, DD-01-004003, DD-01-004004, DD-01-004005

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import * as vscode from "vscode";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";

function createMockFlowService(): IFlowService {
  return {
    createFlow: vi.fn().mockResolvedValue({ id: "new-flow", name: "New" }),
    getFlow: vi.fn().mockResolvedValue({
      id: "flow-1",
      name: "Source Flow",
      description: "",
      version: "1.0.0",
      nodes: [],
      edges: [],
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    }),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn().mockResolvedValue(undefined),
    renameFlow: vi.fn().mockResolvedValue(undefined),
    listFlows: vi.fn().mockResolvedValue([]),
    existsFlow: vi.fn().mockResolvedValue(true),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

function createMockFlowEditorManager(): IFlowEditorManager {
  return {
    openEditor: vi.fn().mockResolvedValue(undefined),
    closeEditor: vi.fn(),
    getActiveFlowId: vi.fn().mockReturnValue(undefined),
    postMessageToFlow: vi.fn(),
    dispose: vi.fn(),
  };
}

function createMockExecutionService(): IExecutionService {
  return {
    executeFlow: vi.fn().mockResolvedValue(undefined),
    stopFlow: vi.fn(),
    onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockFlowTreeProvider(): IFlowTreeProvider {
  return {
    refresh: vi.fn(),
    getTreeItem: vi.fn(),
    getChildren: vi.fn(),
  };
}

describe("CommandRegistry", () => {
  let flowService: IFlowService;
  let editorManager: IFlowEditorManager;
  let executionService: IExecutionService;
  let treeProvider: IFlowTreeProvider;
  let outputChannel: vscode.OutputChannel;
  let registry: CommandRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    flowService = createMockFlowService();
    editorManager = createMockFlowEditorManager();
    executionService = createMockExecutionService();
    treeProvider = createMockFlowTreeProvider();
    outputChannel = vscode.window.createOutputChannel("test") as unknown as vscode.OutputChannel;
    registry = new CommandRegistry(
      flowService,
      editorManager,
      executionService,
      treeProvider,
      outputChannel,
    );
  });

  // --- DD-01-004001: 概要 ---

  // DDUT-01-004001-00001
  it("canBeInstantiated", () => {
    // Assert
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(CommandRegistry);
  });

  // --- DD-01-004002: クラス設計 ---

  // DDUT-01-004002-00001
  it("hasRegisterAllAndDispose", () => {
    // Assert
    expect(typeof registry.registerAll).toBe("function");
    expect(typeof registry.dispose).toBe("function");
  });

  // DDUT-01-004003-00001
  it("registerAll_registers14Commands", () => {
    // Act
    registry.registerAll();

    // Assert
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(14);
  });

  // DDUT-01-004003-00002
  it("registerAll_registersCreateFlowCommand", () => {
    // Act
    registry.registerAll();

    // Assert
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "flowrunner.createFlow",
      expect.any(Function),
    );
  });

  // DDUT-01-004003-00003
  it("registerAll_registersOpenEditorCommand", () => {
    // Act
    registry.registerAll();

    // Assert
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "flowrunner.openEditor",
      expect.any(Function),
    );
  });

  // DDUT-01-004003-00004
  it("registerAll_registersExecuteFlowCommand", () => {
    // Act
    registry.registerAll();

    // Assert
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "flowrunner.executeFlow",
      expect.any(Function),
    );
  });

  // DDUT-01-004003-00005
  it("registerAll_registersDuplicateFlowCommand", () => {
    // Act
    registry.registerAll();

    // Assert
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "flowrunner.duplicateFlow",
      expect.any(Function),
    );
  });

  // FEAT-00021-003001-00001
  it("duplicateFlow_createsCopyWithNewIdAndOpensEditor", async () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00.000Z"));
    registry.registerAll();

    try {
      // Act
      const calls = vi.mocked(vscode.commands.registerCommand).mock.calls;
      const duplicateFlowHandler = calls.find(
        (call) => call[0] === "flowrunner.duplicateFlow",
      )?.[1] as (arg?: unknown) => Promise<void>;
      await duplicateFlowHandler("flow-1");

      // Assert
      expect(flowService.getFlow).toHaveBeenCalledWith("flow-1");
      const duplicatedFlow = vi.mocked(flowService.saveFlow).mock.calls[0]?.[0] as {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(duplicatedFlow.id).not.toBe("flow-1");
      expect(duplicatedFlow.name).toBe("Source Flow Copy");
      expect(duplicatedFlow.createdAt).toBe("2026-04-09T12:00:00.000Z");
      expect(duplicatedFlow.updatedAt).toBe("2026-04-09T12:00:00.000Z");
      expect(editorManager.openEditor).toHaveBeenCalledWith(duplicatedFlow.id, "Source Flow Copy");
      expect(treeProvider.refresh).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  // DDUT-01-004004-00001
  it("wrapHandler_catchesAndShowsError", async () => {
    // Arrange
    vi.mocked(flowService.createFlow).mockRejectedValue(
      new Error("Creation failed"),
    );
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
      label: "Blank Flow",
      mode: "blank",
    } as any);
    vi.mocked(vscode.window.showInputBox).mockResolvedValue("Test");
    registry.registerAll();

    // Act — invoke the createFlow handler
    const calls = vi.mocked(vscode.commands.registerCommand).mock.calls;
    const createFlowHandler = calls.find(
      (c) => c[0] === "flowrunner.createFlow",
    )?.[1] as (...args: unknown[]) => Promise<void>;
    await createFlowHandler();

    // Assert
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  // DDUT-01-004005-00001
  it("dispose_disposesAllRegisteredCommands", () => {
    // Arrange
    const mockDisposable = { dispose: vi.fn() };
    vi.mocked(vscode.commands.registerCommand).mockReturnValue(
      mockDisposable as any,
    );
    registry.registerAll();

    // Act
    registry.dispose();

    // Assert
    expect(mockDisposable.dispose).toHaveBeenCalledTimes(14);
  });
});
