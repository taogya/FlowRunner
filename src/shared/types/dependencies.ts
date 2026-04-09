// Trace: FEAT-00020-003001, FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003004

export interface FlowDependencyNodeReference {
  nodeId: string;
  nodeLabel: string;
}

export interface FlowDependencyEntry {
  flowId: string;
  flowName: string;
  nodeCount: number;
  nodeReferences: FlowDependencyNodeReference[];
}

export interface FlowDependencyWarning {
  sourceFlowId: string;
  sourceFlowName: string;
  nodeId: string;
  nodeLabel: string;
  referencedFlowId: string | null;
  kind: "emptyTarget" | "missingTarget";
}

export interface FlowDependencySnapshot {
  flowId: string;
  flowName: string;
  outgoing: FlowDependencyEntry[];
  incoming: FlowDependencyEntry[];
  warnings: FlowDependencyWarning[];
}