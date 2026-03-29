// Trace: DD-01-003002
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";
import type { Disposable } from "./IExecutionService.js";

/**
 * フロー定義の CRUD ビジネスロジック
 */
export interface IFlowService {
  /** 新規フロー作成。トリガーノードを自動配置する */
  createFlow(name: string): Promise<FlowDefinition>;

  /** フロー定義を取得 */
  getFlow(flowId: string): Promise<FlowDefinition>;

  /** フロー定義を保存（更新） */
  saveFlow(flow: FlowDefinition): Promise<void>;

  /** フロー定義を削除 */
  deleteFlow(flowId: string): Promise<void>;

  /** フロー名を変更 */
  renameFlow(flowId: string, newName: string): Promise<void>;

  /** フロー一覧取得（サマリのみ） */
  listFlows(parentId?: string): Promise<FlowSummary[]>;

  /** フロー存在確認 */
  existsFlow(flowId: string): Promise<boolean>;

  /** フロー変更通知イベント */
  readonly onDidChangeFlows: {
    event: (handler: () => void) => Disposable;
  };
}
