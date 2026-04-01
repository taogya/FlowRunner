// Trace: FEAT-00001-003004
import type { Disposable } from "./IExecutionService.js";

/**
 * トリガー設定
 */
export interface TriggerConfig {
  triggerType: "manual" | "fileChange" | "schedule";
  filePattern?: string;
  debounceMs?: number;
  intervalSeconds?: number;
}

/**
 * アクティブトリガー情報
 */
export interface TriggerInfo {
  flowId: string;
  config: TriggerConfig;
  active: boolean;
}

/**
 * トリガーサービス — フローの自動実行トリガーを管理する
 */
// Trace: FEAT-00001-003004
export interface ITriggerService extends Disposable {
  /** トリガーを有効化する */
  activateTrigger(flowId: string, config: TriggerConfig): void;

  /** トリガーを無効化する */
  deactivateTrigger(flowId: string): void;

  /** 全トリガーを無効化する */
  deactivateAll(): void;

  /** アクティブなトリガー一覧を返す */
  getActiveTriggers(): TriggerInfo[];

  /** 指定フローのトリガーがアクティブか */
  isActive(flowId: string): boolean;
}
