// Trace: DD-04-006001, DD-04-006002
import * as vscode from "vscode";
import * as l10n from "@vscode/l10n";

interface CompletionEvent {
  type: string;
  flowId: string;
  flowName: string;
  status: string;
  error?: string;
  errorNodeId?: string;
}

export function createNotificationHandler(): (event: CompletionEvent) => Promise<void> {
  return async (event: CompletionEvent) => {
    // Trace: DD-04-006001
    if (event.status === "success") {
      const action = await vscode.window.showInformationMessage(
        l10n.t('Flow "{0}" completed successfully', event.flowName),
        l10n.t("Show History"),
      );
      // Trace: DD-04-006002
      if (action === l10n.t("Show History")) {
        await vscode.commands.executeCommand(
          "flowrunner.showHistory",
          event.flowId,
        );
      }
    } else if (event.status === "error") {
      const action = await vscode.window.showErrorMessage(
        l10n.t('Flow "{0}" failed with error: {1}', event.flowName, event.error ?? "unknown error"),
        l10n.t("Show Details"),
      );
      // Trace: DD-04-006002
      if (action === l10n.t("Show Details")) {
        await vscode.commands.executeCommand(
          "flowrunner.selectNode",
          event.flowId,
          event.errorNodeId,
        );
      }
    } else if (event.status === "cancelled") {
      await vscode.window.showWarningMessage(
        l10n.t('Flow "{0}" was cancelled', event.flowName),
      );
    }
  };
}
