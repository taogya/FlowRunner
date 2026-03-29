// Trace: BD-04-003001, BD-04-003002
import type { DebugEvent } from "@shared/types/events.js";
import type { NodeResultMap } from "@shared/types/execution.js";
import type { Disposable } from "./IExecutionService.js";

/**
 * デバッグモードの管理
 *
 * ステップ実行の制御と中間結果の提供。
 */
// Trace: BD-04-003002
export interface IDebugService {
  /** デバッグモードを開始する */
  startDebug(flowId: string): Promise<void>;

  /** 1ステップ実行する */
  step(): Promise<void>;

  /** デバッグモードを停止する */
  stopDebug(): void;

  /** デバッグ中かどうか */
  isDebugging(): boolean;

  /** 中間結果を取得する */
  getIntermediateResults(): NodeResultMap;

  /** デバッグイベントをリッスンする */
  onDebugEvent(handler: (event: DebugEvent) => void): Disposable;
}
