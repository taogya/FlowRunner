// Trace: DD-04-006001
import * as vscode from "vscode";

interface CompletionEvent {
  type: string;
  flowId: string;
  flowName: string;
  status: string;
  error?: string;
  errorNodeId?: string;
}

const DEFAULT_COMPLETION_NOTIFICATION_AUTO_HIDE = true;
const DEFAULT_COMPLETION_NOTIFICATION_DURATION_SECONDS = 3;

type CompletionStatus = "success" | "error" | "cancelled";

interface CompletionNotificationSettings {
  autoHide: boolean;
  durationMs: number;
}

function getCompletionNotificationSettings(): CompletionNotificationSettings {
  const configuration = vscode.workspace.getConfiguration("flowrunner");
  const autoHide = configuration.get<boolean>(
    "completionNotificationAutoHide",
    DEFAULT_COMPLETION_NOTIFICATION_AUTO_HIDE,
  );
  const rawDurationSeconds = configuration.get<number>(
    "completionNotificationDurationSeconds",
    DEFAULT_COMPLETION_NOTIFICATION_DURATION_SECONDS,
  );
  const durationSeconds =
    typeof rawDurationSeconds === "number"
    && Number.isFinite(rawDurationSeconds)
    && rawDurationSeconds >= 1
      ? rawDurationSeconds
      : DEFAULT_COMPLETION_NOTIFICATION_DURATION_SECONDS;

  return {
    autoHide,
    durationMs: durationSeconds * 1000,
  };
}

function getCompletionMessage(
  event: CompletionEvent,
): { status: CompletionStatus; message: string } | null {
  if (event.status === "success") {
    return {
      status: "success",
      message: vscode.l10n.t('Flow "{0}" completed successfully', event.flowName),
    };
  }

  if (event.status === "error") {
    return {
      status: "error",
      message: vscode.l10n.t(
        'Flow "{0}" failed with error: {1}',
        event.flowName,
        event.error ?? "unknown error",
      ),
    };
  }

  if (event.status === "cancelled") {
    return {
      status: "cancelled",
      message: vscode.l10n.t('Flow "{0}" was cancelled', event.flowName),
    };
  }

  return null;
}

function showAutoHideCompletionMessage(
  status: CompletionStatus,
  message: string,
  durationMs: number,
): void {
  const icon = status === "success"
    ? "$(check)"
    : status === "error"
      ? "$(error)"
      : "$(warning)";
  vscode.window.setStatusBarMessage(`${icon} ${message}`, durationMs);
}

export function createNotificationHandler(): (event: CompletionEvent) => Promise<void> {
  return async (event: CompletionEvent) => {
    const notification = getCompletionMessage(event);
    if (!notification) {
      return;
    }

    const settings = getCompletionNotificationSettings();
    if (settings.autoHide) {
      showAutoHideCompletionMessage(
        notification.status,
        notification.message,
        settings.durationMs,
      );
      return;
    }

    if (notification.status === "success") {
      await vscode.window.showInformationMessage(notification.message);
    } else if (notification.status === "error") {
      await vscode.window.showErrorMessage(notification.message);
    } else {
      await vscode.window.showWarningMessage(notification.message);
    }
  };
}
