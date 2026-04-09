// Trace: FEAT-00019-003002
import type { ExecutionSummary } from "@shared/types/execution.js";

export interface HistoryRecordsWithDiagnostics {
  summaries: ExecutionSummary[];
  unreadableCount: number;
}