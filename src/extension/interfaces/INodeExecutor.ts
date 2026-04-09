// Trace: BD-03-002001, BD-03-002002, BD-03-002003, BD-03-002004, BD-03-002005
import type { NodeSettings, PortDataMap } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import type { IVariableStore } from "./IVariableStore.js";

/**
 * ノード実行時のコンテキスト情報
 */
// Trace: BD-03-002003
export interface IExecutionContext {
  nodeId: string;
  nodeLabel?: string;
  settings: NodeSettings;
  inputs: PortDataMap;
  flowId: string;
  signal: AbortSignal;
  // Trace: DD-04-002009
  depth?: number;
  // Trace: FEAT-00001-003008
  triggerData?: Record<string, unknown>;
  // Trace: FEAT-00002-003002
  variables?: IVariableStore;
}

/**
 * ノード実行結果
 */
// Trace: BD-03-002004
export interface IExecutionResult {
  status: import("@shared/types/execution.js").ExecutionStatus;
  outputs: PortDataMap;
  error?: import("@shared/types/execution.js").ErrorInfo;
  duration: number;
}

/**
 * 各ノード種類の実行ロジックを定義するインターフェース
 *
 * ビルトインノード11種がこれを実装する。
 */
// Trace: BD-03-002002
export interface INodeExecutor {
  /** ノードの実行ロジック */
  execute(context: IExecutionContext): Promise<IExecutionResult>;

  /** 設定値のバリデーション */
  validate(settings: NodeSettings): ValidationResult;

  /** ノード種別のメタデータを返す */
  getMetadata(): INodeTypeMetadata;

  /** ノード種別のメタデータを非同期で返す（動的メタデータが必要な場合のみ実装） */
  // Trace: DD-03-002003, REV-016 #12
  getMetadataAsync?(currentSettings?: NodeSettings): Promise<INodeTypeMetadata>;
}
