// Trace: DD-01-004002, DD-01-004003, DD-01-004004, DD-01-004005
import * as crypto from "crypto";
import * as vscode from "vscode";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowValidationService } from "@extension/interfaces/IFlowValidationService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import {
  builtinTemplates,
  starterTemplates,
  type FlowTemplate,
} from "@extension/templates/builtinTemplates.js";
import { confirmFlowValidationIssues } from "@extension/services/flowValidationDialog.js";
import {
  FlowFilterEvaluator,
  type EvaluatedFlowSummary,
} from "@extension/ui/FlowFilterEvaluator.js";
import { FlowFilterState } from "@extension/ui/FlowFilterState.js";
import type { NodeInstance, EdgeInstance } from "@shared/types/flow.js";

type CreateFlowMode = "blank" | "starter" | "recent";

interface CreateFlowModeItem extends vscode.QuickPickItem {
  mode: CreateFlowMode;
}

interface TemplatePickItem extends vscode.QuickPickItem {
  template: FlowTemplate;
}

type FlowSearchOptionId = "requiresTrigger" | "requiresSubFlow" | "updatedAtDesc";

interface FlowSearchOptionItem extends vscode.QuickPickItem {
  optionId: FlowSearchOptionId;
}

interface FlowSearchResultItem extends vscode.QuickPickItem {
  flowId: string;
  flowName: string;
}

// Trace: DD-01-004002
export class CommandRegistry {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly flowService: IFlowService;
  private readonly flowEditorManager: IFlowEditorManager;
  private readonly executionService: IExecutionService;
  private readonly flowTreeProvider: IFlowTreeProvider;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly debugService?: IDebugService;
  private readonly flowValidationService?: IFlowValidationService;
  private readonly flowFilterState: FlowFilterState;
  private readonly flowFilterEvaluator: FlowFilterEvaluator;
  private recentTemplateIds: string[] = [];

  constructor(
    flowService: IFlowService,
    flowEditorManager: IFlowEditorManager,
    executionService: IExecutionService,
    flowTreeProvider: IFlowTreeProvider,
    outputChannel: vscode.OutputChannel,
    debugService?: IDebugService,
    flowValidationService?: IFlowValidationService,
    flowFilterState: FlowFilterState = new FlowFilterState(),
  ) {
    this.flowService = flowService;
    this.flowEditorManager = flowEditorManager;
    this.executionService = executionService;
    this.flowTreeProvider = flowTreeProvider;
    this.outputChannel = outputChannel;
    this.debugService = debugService;
    this.flowValidationService = flowValidationService;
    this.flowFilterState = flowFilterState;
    this.flowFilterEvaluator = new FlowFilterEvaluator(
      this.flowService,
      this.flowFilterState,
    );
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
        "flowrunner.duplicateFlow",
        this.wrapHandler((arg: unknown) => this.handleDuplicateFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.debugFlow",
        this.wrapHandler((arg: unknown) => this.handleDebugFlow(arg)),
      ),
      vscode.commands.registerCommand(
        "flowrunner.refreshFlowList",
        this.wrapHandler(() => this.handleRefreshFlowList()),
      ),
      vscode.commands.registerCommand(
        "flowrunner.searchFlows",
        this.wrapHandler(() => this.handleSearchFlows()),
      ),
      vscode.commands.registerCommand(
        "flowrunner.clearFlowFilter",
        this.wrapHandler(() => this.handleClearFlowFilter()),
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

    void this.syncFlowFilterContext();
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
    const selection = await vscode.window.showQuickPick<CreateFlowModeItem>(
      [
        {
          label: `$(file) ${vscode.l10n.t("Blank Flow")}`,
          description: vscode.l10n.t("Start from an empty canvas"),
          mode: "blank",
        },
        {
          label: `$(rocket) ${vscode.l10n.t("Starter Template")}`,
          description: vscode.l10n.t("Use a guided starter flow"),
          mode: "starter",
        },
        {
          label: `$(history) ${vscode.l10n.t("Recent Template")}`,
          description: vscode.l10n.t("Reuse one of the templates you used recently"),
          mode: "recent",
        },
      ],
      {
        placeHolder: vscode.l10n.t("How would you like to create a flow?"),
      },
    );
    if (!selection) {
      return;
    }

    switch (selection.mode) {
      case "blank":
        await this.handleCreateBlankFlow();
        return;
      case "starter":
        await this.handleCreateFlowFromStarterTemplate();
        return;
      case "recent":
        await this.handleCreateFlowFromRecentTemplate();
        return;
    }
  }

  private async handleCreateBlankFlow(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter flow name"),
    });
    if (!name) {
      return;
    }
    const flow = await this.flowService.createFlow(name);
    this.flowEditorManager.openEditor(flow.id, name);
    this.flowTreeProvider.refresh();
  }

  private async handleCreateFlowFromStarterTemplate(): Promise<void> {
    await this.promptAndCreateFromTemplates(
      starterTemplates,
      vscode.l10n.t("Select a starter template"),
    );
  }

  private async handleCreateFlowFromRecentTemplate(): Promise<void> {
    const recentTemplates = this.resolveRecentTemplates(
      await this.loadAllTemplates(),
    );
    if (recentTemplates.length === 0) {
      vscode.window.showInformationMessage(
        vscode.l10n.t("No recent templates yet. Choose a starter template instead."),
      );
      await this.handleCreateFlowFromStarterTemplate();
      return;
    }

    await this.promptAndCreateFromTemplates(
      recentTemplates,
      vscode.l10n.t("Select a recent template"),
    );
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
      vscode.l10n.t("Are you sure you want to delete this flow?"),
      { modal: true },
      vscode.l10n.t("Delete"),
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
      vscode.window.showWarningMessage(vscode.l10n.t("No active flow to execute"));
      return;
    }
    if (!(await this.canStartFlow(targetFlowId, "execute"))) {
      return;
    }
    await this.executionService.executeFlow(targetFlowId);
  }

  private async handleRenameFlow(arg: unknown): Promise<void> {
    const flowId = this.resolveFlowId(arg);
    if (!flowId) return;
    const newName = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter new flow name"),
    });
    if (!newName) {
      return;
    }
    await this.flowService.renameFlow(flowId, newName);
    this.flowTreeProvider.refresh();
  }

  // Trace: FEAT-00021 — フロー一覧からの複製導線
  private async handleDuplicateFlow(arg: unknown): Promise<void> {
    const targetFlowId = this.resolveFlowId(arg) ?? this.flowEditorManager.getActiveFlowId();
    if (!targetFlowId) {
      vscode.window.showWarningMessage(vscode.l10n.t("No active flow to duplicate"));
      return;
    }

    const sourceFlow = await this.flowService.getFlow(targetFlowId);
    const now = new Date().toISOString();
    const duplicatedFlow = {
      ...structuredClone(sourceFlow),
      id: crypto.randomUUID(),
      name: `${sourceFlow.name} Copy`,
      createdAt: now,
      updatedAt: now,
    };

    await this.flowService.saveFlow(duplicatedFlow);
    this.flowEditorManager.openEditor(duplicatedFlow.id, duplicatedFlow.name);
    this.flowTreeProvider.refresh();
  }

  private async handleDebugFlow(arg: unknown): Promise<void> {
    const targetFlowId = this.resolveFlowId(arg) ?? this.flowEditorManager.getActiveFlowId();
    if (!targetFlowId) {
      vscode.window.showWarningMessage(vscode.l10n.t("No active flow to debug"));
      return;
    }
    if (!(await this.canStartFlow(targetFlowId, "debug"))) {
      return;
    }
    if (!this.debugService) {
      await vscode.window.showInformationMessage(
        vscode.l10n.t("Debug feature is planned for future release"),
      );
      return;
    }

    const flow = await this.flowService.getFlow(targetFlowId);
    this.flowEditorManager.openEditor(targetFlowId, flow.name);
    await this.debugService.startDebug(targetFlowId);
  }

  private async canStartFlow(
    flowId: string,
    mode: "execute" | "debug",
  ): Promise<boolean> {
    if (!this.flowValidationService) {
      return true;
    }
    const issues = await this.flowValidationService.validateFlow(flowId, mode);
    return confirmFlowValidationIssues(issues, mode);
  }

  private handleRefreshFlowList(): void {
    this.flowFilterState.clearAuxiliaryCache();
    this.flowTreeProvider.refresh();
  }

  // Trace: FEAT-00018-003001, FEAT-00018-003002, FEAT-00018-003003, FEAT-00018-003005
  private async handleSearchFlows(): Promise<void> {
    const currentFilter = this.flowFilterState.getSnapshot();
    const input = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter a flow name to filter the sidebar"),
      placeHolder: vscode.l10n.t("Filter flow list by name"),
      value: currentFilter.query,
    });
    if (input === undefined) {
      return;
    }

    const selectedOptions = await vscode.window.showQuickPick<FlowSearchOptionItem>(
      this.buildFlowSearchOptionItems(
        currentFilter.requiresTrigger,
        currentFilter.requiresSubFlow,
        currentFilter.sortBy,
      ),
      {
        canPickMany: true,
        placeHolder: vscode.l10n.t("Select additional filters and sorting"),
      },
    );
    if (selectedOptions === undefined) {
      return;
    }

    this.flowFilterState.update({
      query: input,
      requiresTrigger: selectedOptions.some(
        (option) => option.optionId === "requiresTrigger",
      ),
      requiresSubFlow: selectedOptions.some(
        (option) => option.optionId === "requiresSubFlow",
      ),
      sortBy: selectedOptions.some((option) => option.optionId === "updatedAtDesc")
        ? "updatedAtDesc"
        : "default",
    });
    await this.syncFlowFilterContext();
    this.flowTreeProvider.refresh();

    const filteredResults = await this.flowFilterEvaluator.evaluateSummaries(
      await this.flowService.listFlows(),
    );
    if (filteredResults.length === 0) {
      vscode.window.showInformationMessage(vscode.l10n.t("No matching flows"));
      return;
    }

    const selectedFlow = await vscode.window.showQuickPick<FlowSearchResultItem>(
      this.buildFlowSearchResultItems(filteredResults),
      {
        placeHolder: vscode.l10n.t("Open a filtered flow"),
        matchOnDescription: true,
        matchOnDetail: true,
      },
    );
    if (!selectedFlow) {
      return;
    }

    this.flowEditorManager.openEditor(selectedFlow.flowId, selectedFlow.flowName);
  }

  // Trace: FEAT-00018-003001, FEAT-00018-003004
  private async handleClearFlowFilter(): Promise<void> {
    this.flowFilterState.clear();
    await this.syncFlowFilterContext();
    this.flowTreeProvider.refresh();
  }

  // Trace: FEAT-00004-003003
  private async handleCreateFlowFromTemplate(): Promise<void> {
    await this.promptAndCreateFromTemplates(
      await this.loadAllTemplates(),
      vscode.l10n.t("Select a template"),
    );
  }

  private async loadAllTemplates(): Promise<FlowTemplate[]> {
    return [
      ...builtinTemplates,
      ...starterTemplates,
      ...(await this.loadUserTemplates()),
    ];
  }

  private async promptAndCreateFromTemplates(
    templates: FlowTemplate[],
    placeHolder: string,
  ): Promise<void> {
    if (templates.length === 0) {
      vscode.window.showInformationMessage(vscode.l10n.t("No templates available"));
      return;
    }

    const selected = await vscode.window.showQuickPick<TemplatePickItem>(
      this.buildTemplatePickItems(templates),
      {
        placeHolder,
        matchOnDescription: true,
        matchOnDetail: true,
      },
    );
    if (!selected) {
      return;
    }

    await this.createFlowFromTemplateDefinition(selected.template);
  }

  private buildTemplatePickItems(
    templates: FlowTemplate[],
  ): TemplatePickItem[] {
    return templates.map((template) => ({
      label: `${this.getTemplateIcon(template)} ${template.name}`,
      description: this.getTemplateDescription(template),
      detail: this.getTemplateDetail(template),
      template,
    }));
  }

  private getTemplateIcon(template: FlowTemplate): string {
    if (template.category === "user") {
      return "$(account)";
    }
    if (template.isStarter) {
      return "$(rocket)";
    }
    return "$(extensions)";
  }

  private getTemplateDescription(template: FlowTemplate): string {
    const badges: string[] = [];
    badges.push(template.isStarter ? vscode.l10n.t("starter") : template.category);
    if (template.difficulty) {
      badges.push(vscode.l10n.t(template.difficulty));
    }
    return badges.join(" / ");
  }

  private getTemplateDetail(template: FlowTemplate): string {
    const details = [template.description];
    if (template.recommendedUseCase) {
      details.push(
        vscode.l10n.t("Use case: {0}", template.recommendedUseCase),
      );
    }
    if (template.tags && template.tags.length > 0) {
      details.push(vscode.l10n.t("Tags: {0}", template.tags.join(", ")));
    }
    details.push(vscode.l10n.t("Nodes: {0}", this.describeTemplateNodes(template)));
    return details.join(" | ");
  }

  private describeTemplateNodes(template: FlowTemplate): string {
    const counts = new Map<string, number>();
    for (const node of template.nodes) {
      if (node.type === "comment") {
        continue;
      }
      counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([nodeType, count]) => `${nodeType}×${count}`)
      .join(", ");
  }

  private async createFlowFromTemplateDefinition(
    template: FlowTemplate,
  ): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter flow name"),
      value: template.name,
    });
    if (!name) {
      return;
    }

    const flow = await this.flowService.createFlow(name);
    // Replace default nodes/edges with template content, assigning new UUIDs
    const idMap = new Map<string, string>();
    flow.nodes = template.nodes.map((n) => {
      const newId = crypto.randomUUID();
      idMap.set(n.id, newId);
      return { ...n, id: newId };
    });
    flow.edges = template.edges.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      sourceNodeId: idMap.get(e.sourceNodeId) ?? e.sourceNodeId,
      targetNodeId: idMap.get(e.targetNodeId) ?? e.targetNodeId,
    }));
    await this.flowService.saveFlow(flow);
    this.recordRecentTemplate(template.id);

    this.flowEditorManager.openEditor(flow.id, name);
    this.flowTreeProvider.refresh();
  }

  private resolveRecentTemplates(
    templates: FlowTemplate[],
  ): FlowTemplate[] {
    const byId = new Map(templates.map((template) => [template.id, template]));
    return this.recentTemplateIds
      .map((templateId) => byId.get(templateId))
      .filter((template): template is FlowTemplate => Boolean(template));
  }

  private recordRecentTemplate(templateId: string): void {
    this.recentTemplateIds = [
      templateId,
      ...this.recentTemplateIds.filter((existingId) => existingId !== templateId),
    ].slice(0, 5);
  }

  // Trace: FEAT-00004-003004
  private async handleSaveAsTemplate(arg: unknown): Promise<void> {
    let flowId = this.resolveFlowId(arg);
    if (!flowId) {
      const flows = await this.flowService.listFlows();
      if (flows.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("No flows to save as template"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        flows.map((f) => ({ label: f.name, description: f.id, flowId: f.id })),
        { placeHolder: vscode.l10n.t("Select a flow to save as template") },
      );
      if (!picked) return;
      flowId = picked.flowId;
    }

    const flow = await this.flowService.getFlow(flowId);
    const templateName = await vscode.window.showInputBox({
      prompt: vscode.l10n.t("Enter template name"),
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
      vscode.l10n.t("Template '{0}' saved successfully", templateName),
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
        vscode.window.showInformationMessage(vscode.l10n.t("No flows to export"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        flows.map((f) => ({ label: f.name, description: f.id, flowId: f.id })),
        { placeHolder: vscode.l10n.t("Select a flow to export") },
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
      vscode.l10n.t("Flow '{0}' exported successfully", flow.name),
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
      vscode.window.showErrorMessage(vscode.l10n.t("Invalid JSON file"));
      return;
    }

    const obj = parsed as Record<string, unknown>;
    if (!obj.name || !Array.isArray(obj.nodes)) {
      vscode.window.showErrorMessage(vscode.l10n.t("Invalid flow file: missing name or nodes"));
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
      vscode.l10n.t("Flow '{0}' imported successfully", flow.name),
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

  // Trace: FEAT-00018-003003, FEAT-00018-003005
  private buildFlowSearchOptionItems(
    requiresTrigger: boolean,
    requiresSubFlow: boolean,
    sortBy: FlowFilterState["getSnapshot"] extends () => infer T
      ? T extends { sortBy: infer S }
        ? S
        : never
      : never,
  ): FlowSearchOptionItem[] {
    return [
      {
        label: vscode.l10n.t("Flows with trigger nodes"),
        description: vscode.l10n.t(
          "Keep flows that contain at least one trigger node",
        ),
        picked: requiresTrigger,
        optionId: "requiresTrigger",
      },
      {
        label: vscode.l10n.t("Flows with subflow nodes"),
        description: vscode.l10n.t(
          "Keep flows that contain at least one subflow node",
        ),
        picked: requiresSubFlow,
        optionId: "requiresSubFlow",
      },
      {
        label: vscode.l10n.t("Recently updated first"),
        description: vscode.l10n.t("Sort the filtered list by newest update"),
        picked: sortBy === "updatedAtDesc",
        optionId: "updatedAtDesc",
      },
    ];
  }

  // Trace: FEAT-00018-003005
  private buildFlowSearchResultItems(
    filteredResults: EvaluatedFlowSummary[],
  ): FlowSearchResultItem[] {
    const snapshot = this.flowFilterState.getSnapshot();

    return filteredResults.map(({ summary, auxiliaryFlags }) => {
      const detailParts = [vscode.l10n.t("Updated: {0}", summary.updatedAt)];
      const matchedFilters: string[] = [];

      if (snapshot.requiresTrigger && auxiliaryFlags?.hasTrigger) {
        matchedFilters.push(vscode.l10n.t("Trigger"));
      }
      if (snapshot.requiresSubFlow && auxiliaryFlags?.hasSubFlow) {
        matchedFilters.push(vscode.l10n.t("Subflow"));
      }
      if (matchedFilters.length > 0) {
        detailParts.push(
          vscode.l10n.t("Matched filters: {0}", matchedFilters.join(", ")),
        );
      }

      return {
        label: summary.name,
        description: summary.id,
        detail: detailParts.join(" | "),
        flowId: summary.id,
        flowName: summary.name,
      };
    });
  }

  private async syncFlowFilterContext(): Promise<void> {
    await vscode.commands.executeCommand(
      "setContext",
      "flowrunner.hasActiveFlowFilter",
      this.flowFilterState.isActive(),
    );
  }

  // Trace: DD-01-004005
  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
