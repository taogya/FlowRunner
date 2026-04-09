import type { FlowDefinition } from "@shared/types/flow.js";

export type FlowValidationSeverity = "high" | "medium" | "low";

export type FlowValidationCategory =
  | "required-setting"
  | "dangerous-empty"
  | "unresolved-subflow"
  | "ai-model-missing"
  | "file-configuration"
  | "important-port-unconnected"
  | "trigger-configuration"
  | "unknown-node";

export type FlowValidationMode = "execute" | "debug";

export interface FlowValidationIssue {
  severity: FlowValidationSeverity;
  category: FlowValidationCategory;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  field?: string;
}

export interface IFlowValidationService {
  validateFlow(
    flowId: string,
    mode: FlowValidationMode,
  ): Promise<FlowValidationIssue[]>;

  validateDefinition(
    flow: FlowDefinition,
    mode: FlowValidationMode,
  ): Promise<FlowValidationIssue[]>;
}