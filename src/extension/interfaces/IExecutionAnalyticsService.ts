// Trace: FEAT-00019-003001, FEAT-00019-003005
import type { ExecutionAnalyticsSnapshot } from "@shared/types/analytics.js";

export interface IExecutionAnalyticsService {
  buildSnapshot(flowId: string): Promise<ExecutionAnalyticsSnapshot | null>;
}