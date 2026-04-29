/**
 * FEAT-00004: Flow Templates unit tests
 *
 * Tests for builtin template definitions, createFlowFromTemplate,
 * saveAsTemplate, and user template loading.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import {
  builtinTemplates,
  starterTemplates,
  type FlowTemplate,
} from "@extension/templates/builtinTemplates.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { FlowDefinition } from "@shared/types/flow.js";

// --- Mock factories ---

function createMockFlowService(): IFlowService {
  return {
    listFlows: vi.fn().mockResolvedValue([]),
    getFlow: vi.fn(),
    createFlow: vi.fn().mockImplementation(async (name: string) => ({
      id: `flow-${Date.now()}`,
      name,
      description: "",
      version: "1.0.0",
      nodes: [{ id: "default-trigger", type: "trigger", label: "Trigger", position: { x: 0, y: 0 }, properties: {} }],
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

describe("Flow Templates (FEAT-00004)", () => {
  let registry: CommandRegistry;
  let flowService: IFlowService;
  let flowEditorManager: IFlowEditorManager;
  let executionService: IExecutionService;
  let flowTreeProvider: IFlowTreeProvider;
  let outputChannel: vscode.OutputChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    flowService = createMockFlowService();
    flowEditorManager = createMockFlowEditorManager();
    executionService = createMockExecutionService();
    flowTreeProvider = createMockFlowTreeProvider();
    outputChannel = createMockOutputChannel();

    // Set up workspace folders for user template operations
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

  /** Retrieve registered handler by command name */
  function getHandler(commandName: string): (...args: unknown[]) => Promise<void> {
    const calls = (vscode.commands.registerCommand as Mock).mock.calls;
    const entry = calls.find((c: unknown[]) => c[0] === commandName);
    if (!entry) throw new Error(`Command not found: ${commandName}`);
    return entry[1] as (...args: unknown[]) => Promise<void>;
  }

  // FEAT-00004-003001-00001: ビルトインテンプレートが有効な構造を持つ
  describe("builtin template structure", () => {
    it("allTemplatesHaveValidStructure", () => {
      for (const t of builtinTemplates) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.category).toBe("builtin");
        expect(Array.isArray(t.nodes)).toBe(true);
        expect(t.nodes.length).toBeGreaterThan(0);
        expect(Array.isArray(t.edges)).toBe(true);
      }
    });
  });

  // FEAT-00004-003002-00001: 5種のビルトインテンプレートが定義されている
  describe("builtin template count", () => {
    it("fiveBuiltinTemplatesDefined", () => {
      expect(builtinTemplates).toHaveLength(5);
      const ids = builtinTemplates.map((t) => t.id);
      expect(ids).toContain("builtin-hello");
      expect(ids).toContain("builtin-condition");
      expect(ids).toContain("builtin-loop");
      expect(ids).toContain("builtin-http");
      expect(ids).toContain("builtin-file");
    });
  });

  // FEAT-00004-003005-00001: 2コマンドが登録されている
  describe("command registration", () => {
    it("templateCommandsRegistered", () => {
      const calls = (vscode.commands.registerCommand as Mock).mock.calls;
      const names = calls.map((c: unknown[]) => c[0]);
      expect(names).toContain("flowrunner.createFlowFromTemplate");
      expect(names).toContain("flowrunner.saveAsTemplate");
    });
  });

  // FEAT-00004-003003-00001: テンプレート選択→フロー名入力→フロー生成
  describe("createFlowFromTemplate", () => {
    it("selectTemplate_enterName_createsFlow", async () => {
      // Arrange
      const template = builtinTemplates[0]; // Hello World
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: template.name,
        description: "builtin",
        detail: template.description,
        template,
      } as any);
      vi.mocked(vscode.window.showInputBox).mockResolvedValue("My Hello Flow");
      vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(
        new Error("not found"),
      );

      // Act
      const handler = getHandler("flowrunner.createFlowFromTemplate");
      await handler();

      // Assert
      expect(flowService.createFlow).toHaveBeenCalledWith("My Hello Flow");
      expect(flowService.saveFlow).toHaveBeenCalled();
      expect(flowEditorManager.openEditor).toHaveBeenCalled();
      expect(flowTreeProvider.refresh).toHaveBeenCalled();
    });

    // FEAT-00004-003003-00002: ノードIDが新規UUIDで再割り当てされる
    it("nodeIds_areRegenerated", async () => {
      // Arrange
      const template = builtinTemplates[0];
      const originalNodeIds = template.nodes.map((n) => n.id);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: template.name,
        description: "builtin",
        detail: template.description,
        template,
      } as any);
      vi.mocked(vscode.window.showInputBox).mockResolvedValue("New Flow");
      vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(
        new Error("not found"),
      );

      // Act
      const handler = getHandler("flowrunner.createFlowFromTemplate");
      await handler();

      // Assert — saved flow should have different node IDs
      const savedFlow = (flowService.saveFlow as Mock).mock.calls[0][0] as FlowDefinition;
      for (const node of savedFlow.nodes) {
        expect(originalNodeIds).not.toContain(node.id);
      }
      // Edge sourceNodeId/targetNodeId should also be remapped
      for (const edge of savedFlow.edges) {
        expect(originalNodeIds).not.toContain(edge.sourceNodeId);
        expect(originalNodeIds).not.toContain(edge.targetNodeId);
      }
    });

    // FEAT-00004-003003-00003: キャンセル時にフローが作成されない
    it("cancelQuickPick_noFlowCreated", async () => {
      // Arrange — QuickPick returns undefined (cancelled)
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
      vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(
        new Error("not found"),
      );

      // Act
      const handler = getHandler("flowrunner.createFlowFromTemplate");
      await handler();

      // Assert
      expect(flowService.createFlow).not.toHaveBeenCalled();
    });

    it("cancelInputBox_noFlowCreated", async () => {
      // Arrange — QuickPick succeeds, InputBox cancelled
      const template = builtinTemplates[0];
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: template.name,
        description: "builtin",
        detail: template.description,
        template,
      } as any);
      vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
      vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(
        new Error("not found"),
      );

      // Act
      const handler = getHandler("flowrunner.createFlowFromTemplate");
      await handler();

      // Assert
      expect(flowService.createFlow).not.toHaveBeenCalled();
    });
  });

  // FEAT-00004-003004-00001: 既存フローをテンプレートとして保存できる
  describe("saveAsTemplate", () => {
    it("selectFlow_enterName_savesTemplate", async () => {
      // Arrange
      vi.mocked(flowService.listFlows).mockResolvedValue([
        { id: "flow-1", name: "My Flow", updatedAt: "2026-01-01" },
      ]);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: "My Flow",
        description: "flow-1",
        flowId: "flow-1",
      } as any);
      vi.mocked(flowService.getFlow).mockResolvedValue({
        id: "flow-1",
        name: "My Flow",
        description: "A test flow",
        version: "1.0.0",
        nodes: [{ id: "n1", type: "trigger", label: "Start", position: { x: 0, y: 0 }, properties: {} }],
        edges: [],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      });
      vi.mocked(vscode.window.showInputBox).mockResolvedValue("My Template");

      // Act
      const handler = getHandler("flowrunner.saveAsTemplate");
      await handler();

      // Assert
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();

      // Verify saved template content
      const writeCall = (vscode.workspace.fs.writeFile as Mock).mock.calls[0];
      const writtenData = JSON.parse(new TextDecoder().decode(writeCall[1])) as FlowTemplate;
      expect(writtenData.name).toBe("My Template");
      expect(writtenData.category).toBe("user");
      expect(writtenData.nodes).toHaveLength(1);
    });

    it("noFlows_showsInfoMessage", async () => {
      // Arrange — no flows exist
      vi.mocked(flowService.listFlows).mockResolvedValue([]);

      // Act
      const handler = getHandler("flowrunner.saveAsTemplate");
      await handler();

      // Assert
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  // FEAT-00004-003004-00002: ユーザーテンプレートがQuickPickに表示される
  describe("user template loading", () => {
    it("userTemplates_appearsInQuickPick", async () => {
      // Arrange — mock user template directory
      const userTemplate: FlowTemplate = {
        id: "user-abc",
        name: "My Custom Template",
        description: "Custom",
        category: "user",
        nodes: [{ id: "n1", type: "trigger", label: "Start", position: { x: 0, y: 0 }, properties: {} }],
        edges: [],
      };
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
        ["My_Custom_Template_user-abc.json", vscode.FileType.File],
      ] as any);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(userTemplate)),
      );
      // Cancel QuickPick so we just verify it was called with user template items
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      // Act
      const handler = getHandler("flowrunner.createFlowFromTemplate");
      await handler();

      // Assert — QuickPick should include builtin (5) + starter (5) + user (1) = 11 items
      const quickPickCall = (vscode.window.showQuickPick as Mock).mock.calls[0];
      const items = quickPickCall[0] as Array<{ label: string; description: string }>;
      expect(items).toHaveLength(builtinTemplates.length + starterTemplates.length + 1);
      const userItem = items.find((i) => i.description === "user");
      expect(userItem).toBeDefined();
      expect(userItem!.label).toContain("My Custom Template");
    });
  });
});
