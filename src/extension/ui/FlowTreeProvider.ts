// Trace: DD-02-002002, DD-02-002003, DD-02-002004, DD-02-002005
import * as vscode from "vscode";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import { FlowFilterEvaluator } from "@extension/ui/FlowFilterEvaluator.js";
import { FlowFilterState } from "@extension/ui/FlowFilterState.js";
import type { FlowTreeItem } from "@shared/types/ui.js";

export class FlowTreeProvider implements vscode.TreeDataProvider<FlowTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private readonly flowFilterEvaluator: FlowFilterEvaluator;

  constructor(
    private readonly flowService: IFlowService,
    private readonly flowFilterState: FlowFilterState = new FlowFilterState(),
  ) {
    this.flowFilterEvaluator = new FlowFilterEvaluator(
      this.flowService,
      this.flowFilterState,
    );
  }

  // Trace: DD-02-002003, FEAT-00018-003002, FEAT-00018-003004
  async getChildren(_element?: FlowTreeItem): Promise<FlowTreeItem[]> {
    const summaries = await this.flowService.listFlows();
    const filteredSummaries = await this.flowFilterEvaluator.filterSummaries(
      summaries,
    );

    if (filteredSummaries.length === 0 && this.flowFilterState.isActive()) {
      return [this.createEmptyStateItem()];
    }

    return filteredSummaries.map((s) => ({
      id: s.id,
      label: s.name,
      type: "flow" as const,
      description: s.updatedAt,
    }));
  }

  // Trace: DD-02-002004, FEAT-00018-003004
  getTreeItem(element: FlowTreeItem): vscode.TreeItem {
    if (element.type === "emptyState") {
      const treeItem = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.None,
      );
      treeItem.id = element.id;
      treeItem.description = element.description;
      treeItem.contextValue = "flowFilterEmptyState";
      treeItem.command = {
        command: "flowrunner.clearFlowFilter",
        title: vscode.l10n.t("Clear flow filter"),
      };
      return treeItem;
    }

    const treeItem = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.id = element.id;
    treeItem.description = element.description;
    treeItem.contextValue = "flowItem";
    treeItem.command = {
      command: "flowrunner.openEditor",
      title: "Open Flow Editor",
      arguments: [element],
    };
    return treeItem;
  }

  // Trace: DD-02-002005
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private createEmptyStateItem(): FlowTreeItem {
    return {
      id: "flow-filter-empty-state",
      label: vscode.l10n.t("No matching flows"),
      type: "emptyState",
      description: vscode.l10n.t("Select to clear the current filter"),
    };
  }
}
