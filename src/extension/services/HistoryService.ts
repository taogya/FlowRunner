// Trace: DD-04-004001, DD-04-004002, DD-04-004003
import type { IHistoryRepository } from "@extension/interfaces/IHistoryRepository.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { ExecutionRecord, ExecutionSummary } from "@shared/types/execution.js";

type ConfigProvider = () => number; // returns maxCount

export class HistoryService implements IHistoryService {
  private readonly repository: IHistoryRepository;
  private readonly configProvider: ConfigProvider;

  constructor(repository: IHistoryRepository, configProvider: ConfigProvider) {
    this.repository = repository;
    this.configProvider = configProvider;
  }

  async saveRecord(record: ExecutionRecord): Promise<void> {
    await this.repository.save(record);
    await this.cleanupOldRecords(record.flowId);
  }

  async getRecords(flowId: string): Promise<ExecutionSummary[]> {
    return this.repository.list(flowId);
  }

  async getRecord(recordId: string): Promise<ExecutionRecord> {
    return this.repository.load(recordId);
  }

  async deleteRecord(recordId: string): Promise<void> {
    await this.repository.delete(recordId);
  }

  async cleanupOldRecords(flowId: string): Promise<void> {
    const maxCount = this.configProvider();

    // -1 means unlimited
    if (maxCount < 0) {
      return;
    }

    // 0 means delete all
    if (maxCount === 0) {
      const records = await this.repository.list(flowId);
      for (const record of records) {
        await this.repository.delete(record.id);
      }
      return;
    }

    // Check count
    const count = await this.repository.count(flowId);
    if (count <= maxCount) {
      return;
    }

    // Delete overflow (oldest first)
    const records = await this.repository.list(flowId);
    const overflow = records.slice(maxCount);
    for (const record of overflow) {
      await this.repository.delete(record.id);
    }
  }
}
