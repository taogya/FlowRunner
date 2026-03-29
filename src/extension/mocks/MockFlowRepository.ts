// Trace: BD-03-005005 Mock implementation
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";

/**
 * IFlowRepository の Mock 実装
 *
 * インメモリでフロー定義を管理する。
 */
export class MockFlowRepository implements IFlowRepository {
  private flows = new Map<string, FlowDefinition>();

  async save(flow: FlowDefinition): Promise<void> {
    this.flows.set(flow.id, structuredClone(flow));
  }

  async load(flowId: string): Promise<FlowDefinition> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    return structuredClone(flow);
  }

  async delete(flowId: string): Promise<void> {
    this.flows.delete(flowId);
  }

  async list(_parentId?: string): Promise<FlowSummary[]> {
    return Array.from(this.flows.values()).map((flow) => ({
      id: flow.id,
      name: flow.name,
      updatedAt: flow.updatedAt,
    }));
  }

  async exists(flowId: string): Promise<boolean> {
    return this.flows.has(flowId);
  }
}
