// Trace: DD-01-004002, DD-01-004003, DD-01-004004, DD-01-004005
import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";

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

  // Trace: DD-01-004005
  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
  }
}
