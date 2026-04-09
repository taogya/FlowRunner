// Trace: FEAT-00019-003001, FEAT-00019-003002, FEAT-00019-003003, FEAT-00019-003004

export interface ExecutionAnalyticsFailureItem {
  startedAt: string;
  durationMs: number;
  errorMessage: string;
}

export interface SlowestNodeSummary {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  averageDurationMs: number;
  maxDurationMs: number;
}

export interface ExecutionAnalyticsSnapshot {
  sampleSize: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  latestExecutedAt: string | null;
  unreadableCount: number;
  recentFailures: ExecutionAnalyticsFailureItem[];
  slowestNode: SlowestNodeSummary | null;
}