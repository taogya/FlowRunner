// Trace: BD-03-005005
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";

/**
 * フロー定義 JSON の永続化インターフェース
 */
// Trace: BD-03-005005
export interface IFlowRepository {
  /** フロー定義を保存する */
  save(flow: FlowDefinition): Promise<void>;

  /** フロー定義を読み込む */
  load(flowId: string): Promise<FlowDefinition>;

  /** フロー定義を削除する */
  delete(flowId: string): Promise<void>;

  /** フロー一覧を取得する */
  list(parentId?: string): Promise<FlowSummary[]>;

  /** フローが存在するか確認する */
  exists(flowId: string): Promise<boolean>;
}
