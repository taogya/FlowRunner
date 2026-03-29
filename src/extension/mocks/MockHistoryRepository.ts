// Trace: BD-04-004004 Mock implementation
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";
import type {
  ExecutionRecord,
  ExecutionSummary,
} from "@shared/types/execution.js";

/**
 * IHistoryRepository の Mock 実装
 *
 * インメモリで実行履歴を管理する。
 */
export class MockHistoryRepository implements IHistoryRepository {
  private records = new Map<string, ExecutionRecord>();

  async save(record: ExecutionRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async load(recordId: string): Promise<ExecutionRecord> {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`Record not found: ${recordId}`);
    }
    return structuredClone(record);
  }

  async list(flowId: string): Promise<ExecutionSummary[]> {
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

  async delete(recordId: string): Promise<void> {
    this.records.delete(recordId);
  }

  async count(flowId: string): Promise<number> {
    return Array.from(this.records.values()).filter(
      (r) => r.flowId === flowId
    ).length;
  }
}
