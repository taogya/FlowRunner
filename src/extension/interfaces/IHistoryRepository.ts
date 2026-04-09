// Trace: BD-04-004004
import type { HistoryRecordsWithDiagnostics } from "@extension/interfaces/HistoryRecordsWithDiagnostics.js";
import type { ExecutionRecord, ExecutionSummary } from "@shared/types/execution.js";

/**
 * 実行履歴 JSON の永続化インターフェース
 */
// Trace: BD-04-004004
export interface IHistoryRepository {
  /** 実行記録を保存する */
  save(record: ExecutionRecord): Promise<void>;

  /** 実行記録を読み込む */
  load(recordId: string): Promise<ExecutionRecord>;

  /** 指定フローの実行履歴サマリ一覧を取得する */
  list(flowId: string): Promise<ExecutionSummary[]>;

  /** 指定フローの実行履歴サマリ一覧と unreadable 件数を取得する */
  listWithDiagnostics?(flowId: string): Promise<HistoryRecordsWithDiagnostics>;

  /** 実行記録を削除する */
  delete(recordId: string): Promise<void>;

  /** 指定フローの履歴件数を返す */
  count(flowId: string): Promise<number>;
}
