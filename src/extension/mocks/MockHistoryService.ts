// Trace: BD-04-004001 Mock implementation
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type {
  ExecutionRecord,
  ExecutionSummary,
} from "@shared/types/execution.js";

/**
 * IHistoryService の Mock 実装
 *
 * インメモリで実行履歴を管理する。
 */
export class MockHistoryService implements IHistoryService {
  private records = new Map<string, ExecutionRecord>();
  private maxCount = 10;

  async saveRecord(record: ExecutionRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async getRecords(flowId: string): Promise<ExecutionSummary[]> {
    return Array.from(this.records.values())
      .filter((r) => r.flowId === flowId)
      .map((r) => ({
        id: r.id,
        flowId: r.flowId,
        flowName: r.flowName,
        startedAt: r.startedAt,
        duration: r.duration,
        status: r.status,
      }));
  }

  async getRecord(recordId: string): Promise<ExecutionRecord> {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`Record not found: ${recordId}`);
    }
    return structuredClone(record);
  }

  async deleteRecord(recordId: string): Promise<void> {
    this.records.delete(recordId);
  }

  async cleanupOldRecords(flowId: string): Promise<void> {
    const flowRecords = Array.from(this.records.values())
      .filter((r) => r.flowId === flowId)
      .sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      );

    while (flowRecords.length > this.maxCount) {
      const oldest = flowRecords.shift()!;
      this.records.delete(oldest.id);
    }
  }
}
