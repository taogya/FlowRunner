// Trace: FEAT-00001-003005
import * as vscode from "vscode";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type {
  ITriggerService,
  TriggerConfig,
  TriggerInfo,
} from "@extension/interfaces/ITriggerService.js";

const MIN_INTERVAL_SECONDS = 5;

interface TriggerRegistration {
  config: TriggerConfig;
  disposables: vscode.Disposable[];
  timerId?: ReturnType<typeof setInterval>;
  debounceTimerId?: ReturnType<typeof setTimeout>;
}

// Trace: FEAT-00001-003005
export class TriggerService implements ITriggerService {
  private readonly executionService: IExecutionService;
  private readonly workspaceFolder: vscode.WorkspaceFolder;
  private readonly triggers = new Map<string, TriggerRegistration>();

  constructor(
    executionService: IExecutionService,
    workspaceFolder: vscode.WorkspaceFolder,
  ) {
    this.executionService = executionService;
    this.workspaceFolder = workspaceFolder;
  }

  // Trace: FEAT-00001-003004
  activateTrigger(flowId: string, config: TriggerConfig): void {
    // 既存のトリガーがある場合は先に解除
    if (this.triggers.has(flowId)) {
      this.deactivateTrigger(flowId);
    }

    const registration: TriggerRegistration = {
      config,
      disposables: [],
    };

    if (config.triggerType === "fileChange") {
      this.setupFileChangeTrigger(flowId, config, registration);
    } else if (config.triggerType === "schedule") {
      this.setupScheduleTrigger(flowId, config, registration);
    }

    this.triggers.set(flowId, registration);
  }

  // Trace: FEAT-00001-003004
  deactivateTrigger(flowId: string): void {
    const registration = this.triggers.get(flowId);
    if (!registration) {
      return;
    }
    this.cleanupRegistration(registration);
    this.triggers.delete(flowId);
  }

  // Trace: FEAT-00001-003004
  deactivateAll(): void {
    for (const [, registration] of this.triggers) {
      this.cleanupRegistration(registration);
    }
    this.triggers.clear();
  }

  // Trace: FEAT-00001-003004
  getActiveTriggers(): TriggerInfo[] {
    const result: TriggerInfo[] = [];
    for (const [flowId, registration] of this.triggers) {
      result.push({
        flowId,
        config: registration.config,
        active: true,
      });
    }
    return result;
  }

  // Trace: FEAT-00001-003004
  isActive(flowId: string): boolean {
    return this.triggers.has(flowId);
  }

  dispose(): void {
    this.deactivateAll();
  }

  // Trace: FEAT-00001-003005
  private setupFileChangeTrigger(
    flowId: string,
    config: TriggerConfig,
    registration: TriggerRegistration,
  ): void {
    const pattern = config.filePattern ?? "**/*";
    const debounceMs = config.debounceMs ?? 500;

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceFolder, pattern),
    );

    const fireWithDebounce = (
      filePath: string,
      changeType: "created" | "changed" | "deleted",
    ) => {
      if (registration.debounceTimerId !== undefined) {
        clearTimeout(registration.debounceTimerId);
      }
      registration.debounceTimerId = setTimeout(() => {
        registration.debounceTimerId = undefined;
        void this.executeIfNotRunning(flowId, {
          filePath,
          changeType,
        });
      }, debounceMs);
    };

    watcher.onDidCreate((uri) => fireWithDebounce(uri.toString(), "created"));
    watcher.onDidChange((uri) => fireWithDebounce(uri.toString(), "changed"));
    watcher.onDidDelete((uri) => fireWithDebounce(uri.toString(), "deleted"));

    registration.disposables.push(watcher);
  }

  // Trace: FEAT-00001-003005
  private setupScheduleTrigger(
    flowId: string,
    config: TriggerConfig,
    registration: TriggerRegistration,
  ): void {
    // Trace: FEAT-00001-003005 — intervalSeconds 最小値補正
    const intervalSeconds = Math.max(
      config.intervalSeconds ?? 60,
      MIN_INTERVAL_SECONDS,
    );
    const intervalMs = intervalSeconds * 1000;

    registration.timerId = setInterval(() => {
      void this.executeIfNotRunning(flowId, {
        triggeredAt: new Date().toISOString(),
      });
    }, intervalMs);
  }

  // Trace: FEAT-00001-003005
  private async executeIfNotRunning(
    flowId: string,
    triggerData: Record<string, unknown>,
  ): Promise<void> {
    // 同一フロー実行中はスキップ
    if (this.executionService.isRunning(flowId)) {
      return;
    }
    try {
      await this.executionService.executeFlow(flowId, { triggerData });
    } catch {
      // トリガーからの自動実行エラーはログに委ね、例外を握りつぶす
    }
  }

  private cleanupRegistration(registration: TriggerRegistration): void {
    if (registration.debounceTimerId !== undefined) {
      clearTimeout(registration.debounceTimerId);
    }
    if (registration.timerId !== undefined) {
      clearInterval(registration.timerId);
    }
    for (const d of registration.disposables) {
      d.dispose();
    }
  }
}
