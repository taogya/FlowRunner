// Trace: DD-01-002001, DD-01-002003, DD-01-002004, DD-01-002005
import * as vscode from "vscode";
import { FlowRepository } from "@extension/repositories/FlowRepository.js";
import { HistoryRepository } from "@extension/repositories/HistoryRepository.js";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { registerBuiltinExecutors } from "@extension/registries/registerBuiltinExecutors.js";
import { FlowService } from "@extension/services/FlowService.js";
import { HistoryService } from "@extension/services/HistoryService.js";
import { ExecutionAnalyticsService } from "@extension/services/ExecutionAnalyticsService.js";
import { FlowDependencyService } from "@extension/services/FlowDependencyService.js";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import { DebugService } from "@extension/services/DebugService.js";
import { FlowValidationService } from "@extension/services/FlowValidationService.js";
import { TriggerService } from "@extension/services/TriggerService.js";
import { FlowFilterState } from "@extension/ui/FlowFilterState.js";
import { FlowTreeProvider } from "@extension/ui/FlowTreeProvider.js";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import { FlowEditorManager } from "@extension/ui/FlowEditorManager.js";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import { createNotificationHandler } from "@extension/services/notificationHandler.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { TriggerConfig } from "@extension/interfaces/ITriggerService.js";

// Trace: DD-01-002003
export function activate(context: vscode.ExtensionContext): void {
  // Phase 1: Infrastructure
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    // Trace: DD-01-002005
    vscode.window.showErrorMessage(
      vscode.l10n.t("FlowRunner requires an open workspace folder."),
    );
    return;
  }

  const outputChannel = vscode.window.createOutputChannel("FlowRunner", { log: true });
  // vscode.workspace.fs returns Thenable; cast to satisfy local IFileSystem (Promise-based)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileSystem: any = vscode.workspace.fs;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const flowRepository = new FlowRepository(fileSystem, workspaceFolder.uri);
  const historyRepository = new HistoryRepository(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    fileSystem,
    workspaceFolder.uri,
  );

  // Phase 2: Core Services
  const nodeExecutorRegistry = new NodeExecutorRegistry();
  const flowService = new FlowService(flowRepository);
  const historyService = new HistoryService(
    historyRepository,
    () =>
      vscode.workspace
        .getConfiguration("flowrunner")
        .get("historyMaxCount", 10),
  );
  const executionService = new ExecutionService(
    flowService,
    nodeExecutorRegistry,
    historyService,
    outputChannel,
  );
  const executionAnalyticsService = new ExecutionAnalyticsService(historyService);
  const flowDependencyService = new FlowDependencyService(flowService);
  const debugService = new DebugService(
    flowService,
    nodeExecutorRegistry,
    historyService,
  );
  const flowValidationService = new FlowValidationService(
    flowService,
    nodeExecutorRegistry,
  );
  registerBuiltinExecutors(nodeExecutorRegistry, {
    outputChannel,
    flowRepository,
    executionService,
  });

  // Phase 3: UI & Communication
  const triggerService = new TriggerService(executionService, workspaceFolder);
  const flowFilterState = new FlowFilterState();
  const flowTreeProvider = new FlowTreeProvider(flowService, flowFilterState);
  vscode.window.registerTreeDataProvider(
    "flowrunner.flowList",
    flowTreeProvider,
  );
  let flowEditorManager: FlowEditorManager;
  flowEditorManager = new FlowEditorManager(
    context.extensionUri,
    () =>
      new MessageBroker(
        flowService,
        executionService,
        debugService,
        nodeExecutorRegistry,
        triggerService,
        flowValidationService,
        executionAnalyticsService,
        flowDependencyService,
        (targetFlowId, flowName) => flowEditorManager.openEditor(targetFlowId, flowName),
      ),
  );

  // Phase 4: Commands
  const commandRegistry = new CommandRegistry(
    flowService,
    flowEditorManager,
    executionService,
    flowTreeProvider as unknown as IFlowTreeProvider,
    outputChannel,
    debugService,
    flowValidationService,
    flowFilterState,
  );
  commandRegistry.registerAll();

  // Phase 5: Notification handler (Trace: DD-04-006001)
  const notificationHandler = createNotificationHandler();
  const notificationDisposable = executionService.onFlowEvent((event) => {
    if (event.type === "flowCompleted") {
      void notificationHandler({
        type: event.type,
        flowId: event.flowId,
        flowName: event.flowName ?? event.flowId,
        status: event.status ?? "success",
        error: event.error,
      });
    }
  });

  // Phase 6: FileSystemWatcher — .flowrunner/ の変更でツリーを自動更新
  const flowFileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, ".flowrunner/*.json"),
  );
  flowFileWatcher.onDidCreate(() => flowTreeProvider.refresh());
  flowFileWatcher.onDidChange(() => flowTreeProvider.refresh());
  flowFileWatcher.onDidDelete(() => flowTreeProvider.refresh());

  // Phase 6.5: Trigger commands & status bar (Trace: FEAT-00001-003007)
  const triggerStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  triggerStatusBar.command = "flowrunner.deactivateAllTriggers";
  const updateTriggerStatusBar = () => {
    const count = triggerService.getActiveTriggers().length;
    if (count > 0) {
      triggerStatusBar.text = `$(zap) ${count} trigger${count > 1 ? "s" : ""}`;
      triggerStatusBar.tooltip = vscode.l10n.t("Click to deactivate all triggers");
      triggerStatusBar.show();
    } else {
      triggerStatusBar.hide();
    }
  };

  // トリガーコマンド登録 (Trace: FEAT-00001-003006)
  const triggerActivateCmd = vscode.commands.registerCommand(
    "flowrunner.activateTrigger",
    async () => {
      const activeFlowId = flowEditorManager.getActiveFlowId?.();
      if (!activeFlowId) {
        void vscode.window.showWarningMessage(
          vscode.l10n.t("No flow is currently open."),
        );
        return;
      }
      const flow = await flowService.getFlow(activeFlowId);
      if (!flow) { return; }
      const triggerNode = flow.nodes.find((n) => n.type === "trigger");
      if (!triggerNode) { return; }
      const config: TriggerConfig = {
        triggerType: (triggerNode.settings.triggerType as TriggerConfig["triggerType"]) ?? "manual",
        filePattern: triggerNode.settings.filePattern as string | undefined,
        debounceMs: triggerNode.settings.debounceMs as number | undefined,
        intervalSeconds: triggerNode.settings.intervalSeconds as number | undefined,
      };
      if (config.triggerType === "manual") {
        void vscode.window.showInformationMessage(
          vscode.l10n.t("This flow uses manual trigger. No automatic trigger to activate."),
        );
        return;
      }
      triggerService.activateTrigger(activeFlowId, config);
      updateTriggerStatusBar();
      flowEditorManager.postMessageToFlow(activeFlowId, {
        type: "trigger:statusChanged",
        payload: { active: true },
      });
      void vscode.window.showInformationMessage(
        vscode.l10n.t("Trigger activated for this flow."),
      );
    },
  );

  const triggerDeactivateCmd = vscode.commands.registerCommand(
    "flowrunner.deactivateTrigger",
    () => {
      const activeFlowId = flowEditorManager.getActiveFlowId?.();
      if (!activeFlowId) {
        void vscode.window.showWarningMessage(
          vscode.l10n.t("No flow is currently open."),
        );
        return;
      }
      triggerService.deactivateTrigger(activeFlowId);
      updateTriggerStatusBar();
      flowEditorManager.postMessageToFlow(activeFlowId, {
        type: "trigger:statusChanged",
        payload: { active: false },
      });
      void vscode.window.showInformationMessage(
        vscode.l10n.t("Trigger deactivated for this flow."),
      );
    },
  );

  const triggerDeactivateAllCmd = vscode.commands.registerCommand(
    "flowrunner.deactivateAllTriggers",
    () => {
      const activeTriggers = triggerService.getActiveTriggers();
      triggerService.deactivateAll();
      updateTriggerStatusBar();
      for (const t of activeTriggers) {
        flowEditorManager.postMessageToFlow(t.flowId, {
          type: "trigger:statusChanged",
          payload: { active: false },
        });
      }
      void vscode.window.showInformationMessage(
        vscode.l10n.t("All triggers deactivated."),
      );
    },
  );

  // Phase 7: Disposable registration
  context.subscriptions.push(
    outputChannel,
    commandRegistry,
    flowEditorManager,
    notificationDisposable,
    flowFileWatcher,
    triggerService,
    triggerStatusBar,
    triggerActivateCmd,
    triggerDeactivateCmd,
    triggerDeactivateAllCmd,
  );
}

// Trace: DD-01-002004
export function deactivate(): void {
  // 空関数 — context.subscriptions が自動解放を担当
}
