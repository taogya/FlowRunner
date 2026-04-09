import * as vscode from "vscode";
import type {
  FlowValidationIssue,
  FlowValidationMode,
} from "@extension/interfaces/IFlowValidationService.js";
import { sortFlowValidationIssues } from "./FlowValidationService.js";

function getModeLabel(mode: FlowValidationMode): string {
  return mode === "execute" ? vscode.l10n.t("Execution") : vscode.l10n.t("Debug");
}

function getSeverityLabel(issue: FlowValidationIssue): string {
  return vscode.l10n.t(issue.severity);
}

function formatIssues(issues: FlowValidationIssue[]): string {
  return sortFlowValidationIssues(issues)
    .map((issue, index) => {
      const target = issue.nodeLabel ?? issue.nodeId ?? vscode.l10n.t("Flow");
      return `${index + 1}. [${getSeverityLabel(issue)}] ${target}: ${issue.message}`;
    })
    .join("\n");
}

export async function confirmFlowValidationIssues(
  issues: FlowValidationIssue[],
  mode: FlowValidationMode,
): Promise<boolean> {
  if (issues.length === 0) {
    return true;
  }

  const formatted = formatIssues(issues);
  if (issues.some((issue) => issue.severity === "high")) {
    await vscode.window.showErrorMessage(
      `${vscode.l10n.t("{0} blocked by preflight validation.", getModeLabel(mode))}\n\n${formatted}`,
      { modal: true },
    );
    return false;
  }

  const continueLabel =
    mode === "execute"
      ? vscode.l10n.t("Continue execution")
      : vscode.l10n.t("Continue debug");
  const selection = await vscode.window.showWarningMessage(
    `${vscode.l10n.t("Preflight warnings found.")}\n\n${formatted}`,
    { modal: true },
    continueLabel,
  );
  return selection === continueLabel;
}