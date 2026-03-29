// Trace: DD-02-002002, DD-02-002003, DD-02-002004, DD-02-002005
import * as vscode from "vscode";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { FlowTreeItem } from "@shared/types/ui.js";

export class FlowTreeProvider implements vscode.TreeDataProvider<FlowTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly flowService: IFlowService) {}

  // Trace: DD-02-002003
  async getChildren(_element?: FlowTreeItem): Promise<FlowTreeItem[]> {
    const summaries = await this.flowService.listFlows();
    return summaries.map((s) => ({
      id: s.id,
      label: s.name,
      type: "flow" as const,
      description: s.updatedAt,
    }));
  }

  // Trace: DD-02-002004
  getTreeItem(element: FlowTreeItem): vscode.TreeItem {
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
}
