// Trace: BD-02-002002 Mock implementation
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { FlowTreeItem } from "@shared/types/ui.js";
import { TreeItem, TreeItemCollapsibleState } from "vscode";

/**
 * IFlowTreeProvider の Mock 実装
 *
 * インメモリでフロー一覧を管理する。
 */
export class MockFlowTreeProvider implements IFlowTreeProvider {
  private items: FlowTreeItem[] = [];

  /** テスト用: アイテムを設定する */
  setItems(items: FlowTreeItem[]): void {
    this.items = items;
  }

  async getChildren(parentId?: string): Promise<FlowTreeItem[]> {
    if (parentId === undefined) {
      return this.items.filter((item) => item.parentId === undefined);
    }
    return this.items.filter((item) => item.parentId === parentId);
  }

  getTreeItem(item: FlowTreeItem): TreeItem {
    const treeItem = new TreeItem(
      item.label,
      item.type === "folder"
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None
    );
    treeItem.id = item.id;
    treeItem.description = item.description;
    treeItem.contextValue = item.type;
    return treeItem;
  }

  refresh(): void {
    // Mock: no-op (イベント発火は Real 実装で対応)
  }
}
