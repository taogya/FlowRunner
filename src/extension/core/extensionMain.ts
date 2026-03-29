// Trace: DD-01-002001, DD-01-002003, DD-01-002004, DD-01-002005
import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";
import { FlowRepository } from "@extension/repositories/FlowRepository.js";
import { HistoryRepository } from "@extension/repositories/HistoryRepository.js";
import { NodeExecutorRegistry } from "@extension/registries/NodeExecutorRegistry.js";
import { registerBuiltinExecutors } from "@extension/registries/registerBuiltinExecutors.js";
import { FlowService } from "@extension/services/FlowService.js";
import { HistoryService } from "@extension/services/HistoryService.js";
import { ExecutionService } from "@extension/services/ExecutionService.js";
import { DebugService } from "@extension/services/DebugService.js";
import { FlowTreeProvider } from "@extension/ui/FlowTreeProvider.js";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import { FlowEditorManager } from "@extension/ui/FlowEditorManager.js";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import { createNotificationHandler } from "@extension/services/notificationHandler.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";

// Trace: DD-01-002003
export function activate(context: vscode.ExtensionContext): void {
  // Phase 1: Infrastructure
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    // Trace: DD-01-002005
    vscode.window.showErrorMessage(
      l10n.t("FlowRunner requires an open workspace folder."),
    );
    return;
  }

  const outputChannel = vscode.window.createOutputChannel("FlowRunner", { log: true });
  // vscode.workspace.fs returns Thenable; cast to satisfy local IFileSystem (Promise-based)
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
  const debugService = new DebugService(
    flowService,
    nodeExecutorRegistry,
    historyService,
  );
  registerBuiltinExecutors(nodeExecutorRegistry, {
    outputChannel,
    flowRepository,
    executionService,
  });

  // Phase 3: UI & Communication
  const flowTreeProvider = new FlowTreeProvider(flowService);
  vscode.window.registerTreeDataProvider(
    "flowrunner.flowList",
    flowTreeProvider,
  );
  const flowEditorManager = new FlowEditorManager(
    context.extensionUri,
    () =>
      new MessageBroker(
        flowService,
        executionService,
        debugService,
        nodeExecutorRegistry,
      ),
  );

  // Phase 4: Commands
  const commandRegistry = new CommandRegistry(
    flowService,
    flowEditorManager,
    executionService,
    flowTreeProvider as unknown as IFlowTreeProvider,
    outputChannel,
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

  // Phase 7: Disposable registration
  context.subscriptions.push(
    outputChannel,
    commandRegistry,
    flowEditorManager,
    notificationDisposable,
    flowFileWatcher,
  );
}

// Trace: DD-01-002004
export function deactivate(): void {
  // 空関数 — context.subscriptions が自動解放を担当
}
