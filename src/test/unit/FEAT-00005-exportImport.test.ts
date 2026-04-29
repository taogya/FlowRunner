/**
 * FEAT-00005: Flow Export/Import unit tests
 *
 * Tests for export flow to JSON and import flow from JSON.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
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

describe("Flow Export/Import (FEAT-00005)", () => {
  let registry: CommandRegistry;
  let flowService: IFlowService;
  let flowEditorManager: IFlowEditorManager;

  beforeEach(() => {
    vi.clearAllMocks();
    flowService = createMockFlowService();
    flowEditorManager = createMockFlowEditorManager();

    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file("/test-workspace") },
    ];
    vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(new Error("not found"));

    registry = new CommandRegistry(
      flowService,
      flowEditorManager,
      createMockExecutionService(),
      createMockFlowTreeProvider(),
      { appendLine: vi.fn(), append: vi.fn(), clear: vi.fn(), show: vi.fn(), hide: vi.fn(), dispose: vi.fn(), name: "FlowRunner", replace: vi.fn() },
    );
    registry.registerAll();
  });

  function getHandler(commandName: string): (...args: unknown[]) => Promise<void> {
    const calls = (vscode.commands.registerCommand as Mock).mock.calls;
    const entry = calls.find((c: unknown[]) => c[0] === commandName);
    if (!entry) throw new Error(`Command not found: ${commandName}`);
    return entry[1] as (...args: unknown[]) => Promise<void>;
  }

  // FEAT-00005-003003-00001: 2コマンドが登録されている
  describe("command registration", () => {
    it("exportImportCommandsRegistered", () => {
      const calls = (vscode.commands.registerCommand as Mock).mock.calls;
      const names = calls.map((c: unknown[]) => c[0]);
      expect(names).toContain("flowrunner.exportFlow");
      expect(names).toContain("flowrunner.importFlow");
    });
  });

  // FEAT-00005-003001-00001: フローをJSONファイルとしてエクスポートできる
  describe("exportFlow", () => {
    it("selectFlow_saveDialog_exportsJson", async () => {
      // Arrange
      vi.mocked(flowService.listFlows).mockResolvedValue([
        { id: "f1", name: "Test Flow", updatedAt: "2026-01-01" },
      ]);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: "Test Flow", description: "f1", flowId: "f1",
      } as any);
      vi.mocked(flowService.getFlow).mockResolvedValue({
        id: "f1", name: "Test Flow", description: "desc", version: "1.0.0",
        nodes: [{ id: "n1", type: "trigger", label: "T", position: { x: 0, y: 0 }, properties: {} }],
        edges: [], createdAt: "2026-01-01", updatedAt: "2026-01-01",
      });
      const saveUri = vscode.Uri.file("/tmp/Test_Flow.json");
      vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(saveUri);

      // Act
      await getHandler("flowrunner.exportFlow")();

      // Assert
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
        saveUri,
        expect.any(Uint8Array),
      );
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    // FEAT-00005-003001-00002: エクスポートキャンセル時にファイルが作成されない
    it("cancelSaveDialog_noFileCreated", async () => {
      vi.mocked(flowService.listFlows).mockResolvedValue([
        { id: "f1", name: "Test Flow", updatedAt: "2026-01-01" },
      ]);
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue({
        label: "Test Flow", description: "f1", flowId: "f1",
      } as any);
      vi.mocked(flowService.getFlow).mockResolvedValue({
        id: "f1", name: "Test Flow", description: "", version: "1.0.0",
        nodes: [], edges: [], createdAt: "2026-01-01", updatedAt: "2026-01-01",
      });
      vi.mocked(vscode.window.showSaveDialog).mockResolvedValue(undefined);

      await getHandler("flowrunner.exportFlow")();

      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  // FEAT-00005-003002-00001: JSONファイルからフローをインポートできる
  describe("importFlow", () => {
    it("selectFile_importsFlow", async () => {
      const fileUri = vscode.Uri.file("/tmp/flow.json");
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri]);
      const flowData = {
        name: "Imported Flow",
        description: "desc",
        version: "1.0.0",
        nodes: [{ id: "n1", type: "log", label: "Log", position: { x: 0, y: 0 }, properties: {} }],
        edges: [],
      };
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(flowData)),
      );

      await getHandler("flowrunner.importFlow")();

      expect(flowService.createFlow).toHaveBeenCalledWith("Imported Flow");
      expect(flowService.saveFlow).toHaveBeenCalled();
      expect(flowEditorManager.openEditor).toHaveBeenCalled();

      // Verify nodes have new IDs (not original "n1")
      const saved = (flowService.saveFlow as Mock).mock.calls[0][0] as FlowDefinition;
      expect(saved.nodes[0].id).not.toBe("n1");
    });

    // FEAT-00005-003002-00002: 不正なJSONでエラーメッセージが表示される
    it("invalidJson_showsError", async () => {
      const fileUri = vscode.Uri.file("/tmp/bad.json");
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode("not valid json {{{"),
      );

      await getHandler("flowrunner.importFlow")();

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(flowService.createFlow).not.toHaveBeenCalled();
    });

    it("missingNameOrNodes_showsError", async () => {
      const fileUri = vscode.Uri.file("/tmp/bad.json");
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([fileUri]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        new TextEncoder().encode(JSON.stringify({ foo: "bar" })),
      );

      await getHandler("flowrunner.importFlow")();

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(flowService.createFlow).not.toHaveBeenCalled();
    });

    // FEAT-00005-003002-00003: インポートキャンセル時にフローが作成されない
    it("cancelOpenDialog_noFlowCreated", async () => {
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(undefined);

      await getHandler("flowrunner.importFlow")();

      expect(flowService.createFlow).not.toHaveBeenCalled();
    });
  });
});
