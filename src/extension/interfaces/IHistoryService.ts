// Trace: BD-04-004001, BD-04-004003
import type { HistoryRecordsWithDiagnostics } from "@extension/interfaces/HistoryRecordsWithDiagnostics.js";
import type { ExecutionRecord, ExecutionSummary } from "@shared/types/execution.js";

/**
 * 実行履歴のビジネスロジック
 *
 * 保持件数管理を含む。
 */
// Trace: BD-04-004001
export interface IHistoryService {
  /** 実行記録を保存する */
  saveRecord(record: ExecutionRecord): Promise<void>;

  /** 指定フローの実行履歴サマリ一覧を取得する */
  getRecords(flowId: string): Promise<ExecutionSummary[]>;

  /** 指定フローの実行履歴サマリ一覧と unreadable 件数を取得する */
  getRecordsWithDiagnostics?(flowId: string): Promise<HistoryRecordsWithDiagnostics>;

  /** 実行記録の詳細を取得する */
  getRecord(recordId: string): Promise<ExecutionRecord>;

  /** 実行記録を削除する */
  deleteRecord(recordId: string): Promise<void>;

  /** 古い履歴を削除する（保持件数超過分） */
  cleanupOldRecords(flowId: string): Promise<void>;
}
