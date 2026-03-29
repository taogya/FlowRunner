// Trace: BD-02-002002
import type { FlowTreeItem } from "@shared/types/ui.js";
import type * as vscode from "vscode";

/**
 * サイドバーのフロー一覧ツリービュー
 *
 * VSCode の TreeDataProvider を実装する。
 */
export interface IFlowTreeProvider {
  /** 指定フォルダ配下のフロー・フォルダ一覧を返す。引数なしでルート一覧 */
  getChildren(parentId?: string): Promise<FlowTreeItem[]>;

  /** FlowTreeItem を VSCode の TreeItem に変換する */
  getTreeItem(item: FlowTreeItem): vscode.TreeItem;

  /** ツリービュー全体を再描画する。内部で onDidChangeTreeData イベントを発火する */
  refresh(): void;
}
