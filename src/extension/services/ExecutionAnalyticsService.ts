// Trace: FEAT-00019-003001, FEAT-00019-003002, FEAT-00019-003003, FEAT-00019-003004
import type { IExecutionAnalyticsService } from "@extension/interfaces/IExecutionAnalyticsService.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type {
  ExecutionAnalyticsFailureItem,
  ExecutionAnalyticsSnapshot,
  SlowestNodeSummary,
} from "@shared/types/analytics.js";
import type { ExecutionRecord, NodeResult } from "@shared/types/execution.js";

export const EXECUTION_ANALYTICS_SAMPLE_SIZE = 10;

interface SlowNodeAccumulator {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  totalDuration: number;
  count: number;
  maxDuration: number;
}

export class ExecutionAnalyticsService implements IExecutionAnalyticsService {
  constructor(private readonly historyService: IHistoryService) {}

  async buildSnapshot(flowId: string): Promise<ExecutionAnalyticsSnapshot | null> {
    const historyBatch = this.historyService.getRecordsWithDiagnostics
      ? await this.historyService.getRecordsWithDiagnostics(flowId)
      : {
          summaries: await this.historyService.getRecords(flowId),
          unreadableCount: 0,
        };
    const summaries = historyBatch.summaries.slice(0, EXECUTION_ANALYTICS_SAMPLE_SIZE);

    if (summaries.length === 0) {
      return null;
    }

    const successCount = summaries.filter((summary) => summary.status === "success").length;
    const failureCount = summaries.filter((summary) => summary.status === "error").length;
    const averageDurationMs = Math.round(
      summaries.reduce((total, summary) => total + summary.duration, 0) / summaries.length,
    );

    let unreadableCount = historyBatch.unreadableCount;
    const detailedRecords: ExecutionRecord[] = [];
    for (const summary of summaries) {
      try {
        detailedRecords.push(await this.historyService.getRecord(summary.id));
      } catch {
        unreadableCount += 1;
      }
    }

    return {
      sampleSize: summaries.length,
      successCount,
      failureCount,
      successRate: (successCount / summaries.length) * 100,
      averageDurationMs,
      latestExecutedAt: summaries[0]?.startedAt ?? null,
      unreadableCount,
      recentFailures: this.collectRecentFailures(detailedRecords),
      slowestNode: this.collectSlowestNode(detailedRecords),
    };
  }

  private collectRecentFailures(
    detailedRecords: ExecutionRecord[],
  ): ExecutionAnalyticsFailureItem[] {
    return detailedRecords
      .filter((record) => record.status === "error")
      .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
      .map((record) => ({
        startedAt: record.startedAt,
        durationMs: record.duration,
        errorMessage: record.error?.message ?? "Unknown error",
      }));
  }

  private collectSlowestNode(
    detailedRecords: ExecutionRecord[],
  ): SlowestNodeSummary | null {
    const durationsByNodeId = new Map<string, SlowNodeAccumulator>();

    for (const record of detailedRecords) {
      for (const nodeResult of record.nodeResults) {
        this.accumulateNodeDuration(durationsByNodeId, nodeResult);
      }
    }

    const slowestEntry = [...durationsByNodeId.values()]
      .map((entry) => ({
        ...entry,
        averageDurationMs: Math.round(entry.totalDuration / entry.count),
      }))
      .sort((left, right) => right.averageDurationMs - left.averageDurationMs)[0];

    if (!slowestEntry) {
      return null;
    }

    return {
      nodeId: slowestEntry.nodeId,
      nodeLabel: slowestEntry.nodeLabel,
      nodeType: slowestEntry.nodeType,
      averageDurationMs: slowestEntry.averageDurationMs,
      maxDurationMs: slowestEntry.maxDuration,
    };
  }

  private accumulateNodeDuration(
    durationsByNodeId: Map<string, SlowNodeAccumulator>,
    nodeResult: NodeResult,
  ): void {
    const existing = durationsByNodeId.get(nodeResult.nodeId);

    if (existing) {
      existing.totalDuration += nodeResult.duration;
      existing.count += 1;
      existing.maxDuration = Math.max(existing.maxDuration, nodeResult.duration);
      return;
    }

    durationsByNodeId.set(nodeResult.nodeId, {
      nodeId: nodeResult.nodeId,
      nodeLabel: nodeResult.nodeLabel,
      nodeType: nodeResult.nodeType,
      totalDuration: nodeResult.duration,
      count: 1,
      maxDuration: nodeResult.duration,
    });
  }
}