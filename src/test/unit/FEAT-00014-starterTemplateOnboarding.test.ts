/**
 * FEAT-00014: Starter template onboarding unit tests
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import {
  starterTemplates,
  type FlowTemplate,
} from "@extension/templates/builtinTemplates.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { FlowDefinition } from "@shared/types/flow.js";

function createMockFlowService(): IFlowService {
  return {
    listFlows: vi.fn().mockResolvedValue([]),
    getFlow: vi.fn(),
    createFlow: vi.fn().mockImplementation(async (name: string) => ({
      id: `flow-${Date.now()}`,
      name,
      description: "",
      version: "1.0.0",
      nodes: [
        {
          id: "default-trigger",
          type: "trigger",
          label: "Trigger",
          position: { x: 0, y: 0 },
          properties: {},
        },
      ],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies FlowDefinition)),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn() },
  };
}

function createMockFlowEditorManager(): IFlowEditorManager {
  return {
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    closeAllEditors: vi.fn(),
    getActiveFlowId: vi.fn().mockReturnValue(undefined),
    updateFlow: vi.fn(),
    postMessageToFlow: vi.fn(),
    onDidRequestSave: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestExecute: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestDebug: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  };
}

function createMockExecutionService(): IExecutionService {
  return {
    executeFlow: vi.fn(),
    stopFlow: vi.fn(),
    getRunningFlows: vi.fn().mockReturnValue([]),
    isRunning: vi.fn().mockReturnValue(false),
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

describe("Starter Template Onboarding (FEAT-00014)", () => {
  let registry: CommandRegistry;
  let flowService: IFlowService;
  let flowEditorManager: IFlowEditorManager;
  let executionService: IExecutionService;
  let flowTreeProvider: IFlowTreeProvider;
  let outputChannel: vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );

    flowService = createMockFlowService();
    flowEditorManager = createMockFlowEditorManager();
    executionService = createMockExecutionService();
    flowTreeProvider = createMockFlowTreeProvider();
    outputChannel = createMockOutputChannel();

    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file("/test-workspace") },
    ];

    registry = new CommandRegistry(
      flowService,
      flowEditorManager,
      executionService,
      flowTreeProvider,
      outputChannel,
    );
    registry.registerAll();
  });

  function getHandler(commandName: string): (...args: unknown[]) => Promise<void> {
    const calls = (vscode.commands.registerCommand as Mock).mock.calls;
    const entry = calls.find((call: unknown[]) => call[0] === commandName);
    if (!entry) {
      throw new Error(`Command not found: ${commandName}`);
    }
    return entry[1] as (...args: unknown[]) => Promise<void>;
  }

  // FEAT-00014-003001-00001
  it("starterTemplatesHaveMetadata", () => {
    expect(starterTemplates).toHaveLength(5);
    for (const template of starterTemplates) {
      expect(template.category).toBe("builtin");
      expect(template.isStarter).toBe(true);
      expect(template.difficulty).toBeTruthy();
      expect(template.recommendedUseCase).toBeTruthy();
      expect(template.tags && template.tags.length).toBeGreaterThan(0);
    }
  });

  // FEAT-00014-003002-00001
  it("createFlowShowsBlankStarterRecentOptions", async () => {
    // Arrange
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    // Act
    const handler = getHandler("flowrunner.createFlow");
    await handler();

    // Assert
    const firstCallItems = (vscode.window.showQuickPick as Mock).mock.calls[0][0] as Array<{
      label: string;
    }>;
    const labels = firstCallItems.map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Blank Flow"),
        expect.stringContaining("Starter Template"),
        expect.stringContaining("Recent Template"),
      ]),
    );
  });

  // FEAT-00014-003002-00002
  it("recentSelectionWithoutHistoryFallsBackToStarterTemplates", async () => {
    // Arrange
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce({
        label: "Recent Template",
        mode: "recent",
      } as any)
      .mockResolvedValueOnce(undefined);

    // Act
    const handler = getHandler("flowrunner.createFlow");
    await handler();

    // Assert
    const calls = (vscode.window.showQuickPick as Mock).mock.calls;
    const starterItems = calls[1][0] as Array<{ template: FlowTemplate }>;
    expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    expect(starterItems).toHaveLength(starterTemplates.length);
    expect(starterItems.every((item) => item.template.isStarter)).toBe(true);
  });

  // FEAT-00014-003003-00001
  it("templateQuickPickShowsUseCaseDifficultyAndTags", async () => {
    // Arrange
    vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(
      new Error("not found"),
    );
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

    // Act
    const handler = getHandler("flowrunner.createFlowFromTemplate");
    await handler();

    // Assert
    const items = (vscode.window.showQuickPick as Mock).mock.calls[0][0] as Array<{
      description: string;
      detail: string;
      template: FlowTemplate;
    }>;
    const starterItem = items.find(
      (item) => item.template.id === "starter-command-runner",
    );
    expect(starterItem).toMatchObject({
      description: expect.stringContaining("starter / beginner"),
      detail: expect.stringContaining(
        "Use case: CLI コマンドを 1 つ実行して結果を確認したいとき",
      ),
    });
    expect(starterItem?.detail).toContain("Tags: command, starter, log");
  });

  // FEAT-00014-003003-00002, FEAT-00014-003004-00001
  it("starterTemplateCreationReassignsIdsAndKeepsTutorialComments", async () => {
    // Arrange
    const template = starterTemplates[0];
    const originalNodeIds = template.nodes.map((node) => node.id);
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce({
        label: "Starter Template",
        mode: "starter",
      } as any)
      .mockResolvedValueOnce({
        label: template.name,
        description: "starter / beginner",
        detail: template.description,
        template,
      } as any);
    vi.mocked(vscode.window.showInputBox).mockResolvedValue("Starter Flow");

    // Act
    const handler = getHandler("flowrunner.createFlow");
    await handler();

    // Assert
    const savedFlow = (flowService.saveFlow as Mock).mock.calls[0][0] as FlowDefinition;
    expect(savedFlow.nodes.some((node) => node.type === "comment")).toBe(true);
    for (const node of savedFlow.nodes) {
      expect(originalNodeIds).not.toContain(node.id);
    }
  });
});