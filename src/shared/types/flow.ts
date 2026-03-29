// Trace: BD-03-005001, BD-03-005002, BD-03-005003, BD-03-005004

/**
 * フロー定義データモデル
 */

// Trace: BD-03-005003
export interface Position {
  x: number;
  y: number;
}

// Trace: BD-03-005003
export type NodeSettings = Record<string, unknown>;

// Trace: BD-03-005003
export interface NodeInstance {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  position: Position;
  settings: NodeSettings;
}

// Trace: BD-03-005004
export interface EdgeInstance {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

// Trace: BD-03-005002
export interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: NodeInstance[];
  edges: EdgeInstance[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// Trace: BD-03-005005
export interface FlowSummary {
  id: string;
  name: string;
  updatedAt: string;
}

// Trace: BD-03-002003, BD-03-002004
export type PortDataMap = Record<string, unknown>;
