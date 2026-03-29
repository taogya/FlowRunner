// Trace: BD-03-002004, BD-04-002001, BD-04-003001, BD-04-004001

/**
 * 実行関連の型定義
 */

import type { PortDataMap } from "./flow.js";

// Trace: BD-03-002004
export type ExecutionStatus = "success" | "error" | "skipped" | "cancelled";

// Trace: BD-03-002004
export interface ErrorInfo {
  message: string;
  code?: string;
  details?: unknown;
}

// Trace: BD-03-002005
export interface ValidationError {
  field: string;
  message: string;
}

// Trace: BD-03-002005
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

// Trace: BD-04-004002
export interface NodeResult {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: ExecutionStatus;
  inputs: PortDataMap;
  outputs: PortDataMap;
  duration: number;
  error?: ErrorInfo;
}

// Trace: BD-04-004002
export type NodeResultMap = Record<string, NodeResult>;

// Trace: BD-04-004001
export interface ExecutionRecord {
  id: string;
  flowId: string;
  flowName: string;
  startedAt: string; // ISO 8601
  completedAt: string; // ISO 8601
  duration: number;
  status: ExecutionStatus;
  nodeResults: NodeResult[];
  error?: ErrorInfo;
}

// Trace: BD-04-004003
export interface ExecutionSummary {
  id: string;
  flowId: string;
  flowName: string;
  startedAt: string;
  duration: number;
  status: ExecutionStatus;
}
