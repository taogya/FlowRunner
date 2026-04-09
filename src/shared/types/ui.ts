// Trace: BD-02-002003

/**
 * UI 関連の型定義
 */

// Trace: BD-02-002003
export interface FlowTreeItem {
  id: string;
  label: string;
  type: "flow" | "folder" | "history" | "emptyState";
  description: string;
  parentId?: string;
}
