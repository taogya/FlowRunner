// Trace: FEAT-00020-003001, FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003005
import type { FlowDependencySnapshot } from "@shared/types/dependencies.js";

export interface IFlowDependencyService {
  buildSnapshot(flowId: string): Promise<FlowDependencySnapshot | null>;
}