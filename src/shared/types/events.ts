// Trace: BD-04-002001, BD-04-003001

/**
 * 実行・デバッグイベント型定義
 */

import type { ExecutionStatus, NodeResult } from "./execution.js";
import type { PortDataMap } from "./flow.js";
import type { NodeResultMap } from "./execution.js";

// Trace: BD-04-002001
export interface FlowEvent {
  type: "nodeStarted" | "nodeCompleted" | "nodeError" | "flowCompleted";
  flowId: string;
  flowName?: string;
  status?: "success" | "error" | "cancelled";
  error?: string;
  nodeId?: string;
  nodeStatus?: ExecutionStatus;
  nodeOutput?: PortDataMap;
  result?: NodeResult;
  progress?: { current: number; total: number };
}

// Trace: BD-04-003001
export interface DebugEvent {
  nextNodeId: string | undefined;
  intermediateResults: NodeResultMap;
}
