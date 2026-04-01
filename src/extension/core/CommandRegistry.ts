// Trace: DD-01-004002, DD-01-004003, DD-01-004004, DD-01-004005
import * as crypto from "crypto";
import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import { builtinTemplates, type FlowTemplate } from "@extension/templates/builtinTemplates.js";
import type { NodeInstance, EdgeInstance } from "@shared/types/flow.js";

// Trace: DD-01-004002
export class CommandRegistry {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly flowService: IFlowService;
  private readonly flowEditorManager: IFlowEditorManager;
  private readonly executionService: IExecutionService;
  private readonly flowTreeProvider: IFlowTreeProvider;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    flowService: IFlowService,
    flowEditorManager: IFlowEditorManager,
    executionService: IExecutionService,
    flowTreeProvider: IFlowTreeProvider,
    outputChannel: vscode.OutputChannel,
  ) {
    this.flowService = flowService;
    this.flowEditorManager = flowEditorManager;
    this.executionService = executionService;
    this.flowTreeProvider = flowTreeProvider;
    this.outputChannel = outputChannel;
  }

  // Trace: DD-01-004003
  registerAll(): void {
    this.disposables.push(
      vscode.commands.registerCommand(
        "flowrunner.createFlow",
        this.wrapHandler(() => this.handleCreateFlow()),
      ),
      vscode.commands.registerCommand(
        "flowrunner.openEditor",
        this.wrapHandler((arg: unknown) => this.handleOpenEditor(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.deleteFlow",
        this.wrapHandler((arg: unknown) => this.handleDeleteFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.executeFlow",
        this.wrapHandler((arg: unknown) => this.handleExecuteFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.renameFlow",
        this.wrapHandler((arg: unknown) => this.handleRenameFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.debugFlow",
        this.wrapHandler((arg: unknown) => this.handleDebugFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.refreshFlowList",
        this.wrapHandler(() => this.handleRefreshFlowList()),
      ),
      // Trace: FEAT-00004-003005
      vscode.commands.registerCommand(
        "flowrunner.createFlowFromTemplate",
        this.wrapHandler(() => this.handleCreateFlowFromTemplate()),
      ),
      vscode.commands.registerCommand(
        "flowrunner.saveAsTemplate",
        this.wrapHandler((arg: unknown) => this.handleSaveAsTemplate(arg)),
      ),
      // Trace: FEAT-00005-003003
      vscode.commands.registerCommand(
        "flowrunner.exportFlow",
        this.wrapHandler((arg: unknown) => this.handleExportFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.importFlow",
        this.wrapHandler(() => this.handleImportFlow()),
      ),
    );
  }

  // Trace: DD-01-004004
  private wrapHandler<T extends unknown[]>(handler: (...args: T) => Promise<void> | void) {
    return async (...args: T) => {
      try {
        await handler(...args);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(message);
        const ch = this.outputChannel as { error?: (...args: unknown[]) => void };
        if (typeof ch.error === "function") {
          ch.error(message);
          if (error instanceof Error && error.stack) {
            ch.error(error.stack);
          }
        } else {
          this.outputChannel.appendLine(`[ERROR] ${message}`);
          if (error instanceof Error && error.stack) {
            this.outputChannel.appendLine(error.stack);
          }
        }
      }
    };
  }

  private async handleCreateFlow(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: l10n.t("Enter flow name"),
    });
    if (!name) {
      return;
    }
    const flow = await this.flowService.createFlow(name);
    this.flowEditorManager.openEditor(flow.id, name);
    this.flowTreeProvider.refresh();
  }

  // Trace: DD-01-004004 — コンテキストメニューから呼ばれた場合、引数は FlowTreeItem オブジェクト
  private resolveFlowId(arg: unknown): string | undefined {
    if (typeof arg === "string") return arg;
    if (arg && typeof arg === "object" && "id" in arg) return (arg as { id: string }).id;
    return undefined;
  }

  private handleOpenEditor(arg: unknown): void {
    const flowId = this.resolveFlowId(arg);
    if (!flowId) return;
    const flowName = (arg && typeof arg === "object" && "label" in arg)
      ? String((arg as { label: unknown }).label)
      : undefined;
    this.flowEditorManager.openEditor(flowId, flowName);
  }

  private async handleDeleteFlow(arg: unknown): Promise<void> {
    const flowId = this.resolveFlowId(arg);
    if (!flowId) return;
    const confirm = await vscode.window.showWarningMessage(
      l10n.t("Are you sure you want to delete this flow?"),
      { modal: true },
      l10n.t("Delete"),
    );
    if (!confirm) {
      return;
    }
    await this.flowService.deleteFlow(flowId);
    this.flowEditorManager.closeEditor(flowId);
    this.flowTreeProvider.refresh();
  }

  private async handleExecuteFlow(arg: unknown): Promise<void> {
    const targetFlowId = this.resolveFlowId(arg) ?? this.flowEditorManager.getActiveFlowId();
    if (!targetFlowId) {
      vscode.window.showWarningMessage(l10n.t("No active flow to execute"));
      return;
    }
    await this.executionService.executeFlow(targetFlowId);
  }

  private async handleRenameFlow(arg: unknown): Promise<void> {
    const flowId = this.resolveFlowId(arg);
    if (!flowId) return;
    const newName = await vscode.window.showInputBox({
      prompt: l10n.t("Enter new flow name"),
    });
    if (!newName) {
      return;
    }
    await this.flowService.renameFlow(flowId, newName);
    this.flowTreeProvider.refresh();
  }

  private async handleDebugFlow(arg: unknown): Promise<void> {
    const _targetFlowId = this.resolveFlowId(arg) ?? this.flowEditorManager.getActiveFlowId();
    await vscode.window.showInformationMessage(l10n.t("Debug feature is planned for future release"));
  }

  private handleRefreshFlowList(): void {
    this.flowTreeProvider.refresh();
  }

  // Trace: FEAT-00004-003003
  private async handleCreateFlowFromTemplate(): Promise<void> {
    const allTemplates = [...builtinTemplates, ...(await this.loadUserTemplates())];
    const items = allTemplates.map((t) => ({
      label: t.category === "builtin" ? `$(extensions) ${t.name}` : `$(account) ${t.name}`,
      description: t.category === "builtin" ? "builtin" : "user",
      detail: t.description,
      template: t,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: l10n.t("Select a template"),
      matchOnDetail: true,
    });
    if (!selected) return;

    const name = await vscode.window.showInputBox({
      prompt: l10n.t("Enter flow name"),
      value: selected.template.name,
    });
    if (!name) return;

    const flow = await this.flowService.createFlow(name);
    // Replace default nodes/edges with template content, assigning new UUIDs
    const idMap = new Map<string, string>();
    flow.nodes = selected.template.nodes.map((n) => {
      const newId = crypto.randomUUID();
      idMap.set(n.id, newId);
      return { ...n, id: newId };
    });
    flow.edges = selected.template.edges.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      sourceNodeId: idMap.get(e.sourceNodeId) ?? e.sourceNodeId,
      targetNodeId: idMap.get(e.targetNodeId) ?? e.targetNodeId,
    }));
    await this.flowService.saveFlow(flow);

    this.flowEditorManager.openEditor(flow.id, name);
    this.flowTreeProvider.refresh();
  }

  // Trace: FEAT-00004-003004
  private async handleSaveAsTemplate(arg: unknown): Promise<void> {
    let flowId = this.resolveFlowId(arg);
    if (!flowId) {
      const flows = await this.flowService.listFlows();
      if (flows.length === 0) {
        vscode.window.showInformationMessage(l10n.t("No flows to save as template"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        flows.map((f) => ({ label: f.name, description: f.id, flowId: f.id })),
        { placeHolder: l10n.t("Select a flow to save as template") },
      );
      if (!picked) return;
      flowId = picked.flowId;
    }

    const flow = await this.flowService.getFlow(flowId);
    const templateName = await vscode.window.showInputBox({
      prompt: l10n.t("Enter template name"),
      value: flow.name,
    });
    if (!templateName) return;

    const template: FlowTemplate = {
      id: `user-${crypto.randomUUID()}`,
      name: templateName,
      description: flow.description || `Template from ${flow.name}`,
      category: "user",
      nodes: flow.nodes,
      edges: flow.edges,
    };

    await this.saveUserTemplate(template);
    vscode.window.showInformationMessage(
      l10n.t("Template '{0}' saved successfully", templateName),
    );
  }

  // Trace: FEAT-00004-003004
  private getTemplatesDir(): vscode.Uri | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return undefined;
    return vscode.Uri.joinPath(folders[0].uri, ".flowrunner", "templates");
  }

  // Trace: FEAT-00005-003001
  private async handleExportFlow(arg: unknown): Promise<void> {
    let flowId = this.resolveFlowId(arg);
    if (!flowId) {
      const flows = await this.flowService.listFlows();
      if (flows.length === 0) {
        vscode.window.showInformationMessage(l10n.t("No flows to export"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        flows.map((f) => ({ label: f.name, description: f.id, flowId: f.id })),
        { placeHolder: l10n.t("Select a flow to export") },
      );
      if (!picked) return;
      flowId = picked.flowId;
    }

    const flow = await this.flowService.getFlow(flowId);
    const defaultName = flow.name.replace(/[/\\:*?"<>|]/g, "_");
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${defaultName}.json`),
      filters: { "JSON Files": ["json"] },
    });
    if (!uri) return;

    const exportData = {
      name: flow.name,
      description: flow.description,
      version: flow.version,
      nodes: flow.nodes,
      edges: flow.edges,
    };
    const data = new TextEncoder().encode(JSON.stringify(exportData, null, 2));
    await vscode.workspace.fs.writeFile(uri, data);
    vscode.window.showInformationMessage(
      l10n.t("Flow '{0}' exported successfully", flow.name),
    );
  }

  // Trace: FEAT-00005-003002
  private async handleImportFlow(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { "JSON Files": ["json"] },
    });
    if (!uris || uris.length === 0) return;

    const fileData = await vscode.workspace.fs.readFile(uris[0]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(fileData));
    } catch {
      vscode.window.showErrorMessage(l10n.t("Invalid JSON file"));
      return;
    }

    const obj = parsed as Record<string, unknown>;
    if (!obj.name || !Array.isArray(obj.nodes)) {
      vscode.window.showErrorMessage(l10n.t("Invalid flow file: missing name or nodes"));
      return;
    }

    const flow = await this.flowService.createFlow(obj.name as string);
    const idMap = new Map<string, string>();
    flow.nodes = (obj.nodes as Array<Record<string, unknown>>).map((n) => {
      const newId = crypto.randomUUID();
      idMap.set(String(n.id), newId);
      return { ...n, id: newId } as NodeInstance;
    });
    flow.edges = (Array.isArray(obj.edges) ? obj.edges as Array<Record<string, unknown>> : []).map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      sourceNodeId: idMap.get(String(e.sourceNodeId)) ?? String(e.sourceNodeId),
      targetNodeId: idMap.get(String(e.targetNodeId)) ?? String(e.targetNodeId),
    } as EdgeInstance));
    await this.flowService.saveFlow(flow);

    this.flowEditorManager.openEditor(flow.id, flow.name);
    this.flowTreeProvider.refresh();
    vscode.window.showInformationMessage(
      l10n.t("Flow '{0}' imported successfully", flow.name),
    );
  }

  private async loadUserTemplates(): Promise<FlowTemplate[]> {
    const dir = this.getTemplatesDir();
    if (!dir) return [];
    try {
      const entries = await vscode.workspace.fs.readDirectory(dir);
      const templates: FlowTemplate[] = [];
      for (const [name, type] of entries) {
        if (type !== vscode.FileType.File || !name.endsWith(".json")) continue;
        try {
          const uri = vscode.Uri.joinPath(dir, name);
          const data = await vscode.workspace.fs.readFile(uri);
          const parsed = JSON.parse(new TextDecoder().decode(data)) as FlowTemplate;
          if (parsed.name && parsed.nodes) {
            parsed.category = "user";
            templates.push(parsed);
          }
        } catch {
          // Skip invalid template files
        }
      }
      return templates;
    } catch {
      return []; // Directory doesn't exist yet
    }
  }

  private async saveUserTemplate(template: FlowTemplate): Promise<void> {
    const dir = this.getTemplatesDir();
    if (!dir) return;
    await vscode.workspace.fs.createDirectory(dir);
    const sanitized = template.name
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 60);
    const shortId = template.id.slice(0, 8);
    const fileName = `${sanitized}_${shortId}.json`;
    const uri = vscode.Uri.joinPath(dir, fileName);
    const data = new TextEncoder().encode(JSON.stringify(template, null, 2));
    await vscode.workspace.fs.writeFile(uri, data);
  }

  // Trace: DD-01-004005
  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
