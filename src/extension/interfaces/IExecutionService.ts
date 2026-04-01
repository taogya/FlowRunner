// Trace: BD-04-002001, BD-04-002002, BD-04-002003, BD-04-002005
import type { FlowEvent } from "@shared/types/events.js";
import type { PortDataMap } from "@shared/types/flow.js";

/**
 * Disposable インターフェース（VSCode API 非依存）
 */
export interface Disposable {
  dispose(): void;
}

/**
 * フロー実行のオーケストレーション
 *
 * トポロジカル順序でノードを実行し、データを伝播する。
 */
// Trace: BD-04-002002
export interface IExecutionService {
  /** フローを実行する（サブフロー呼び出し時は最終ノード出力を返す） */
  executeFlow(flowId: string, options?: { depth?: number; triggerData?: Record<string, unknown>; outputNodeId?: string }): Promise<PortDataMap | undefined>;

  /** 実行中のフローを停止する */
  stopFlow(flowId: string): void;

  /** 実行中のフロー ID 一覧を返す */
  getRunningFlows(): string[];

  /** 指定フローが実行中かどうか */
  isRunning(flowId: string): boolean;

  /** フロー実行イベントをリッスンする */
  onFlowEvent(handler: (event: FlowEvent) => void): Disposable;
}
