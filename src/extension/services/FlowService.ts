// Trace: DD-01-003003, DD-01-003004, DD-01-003005
import { EventEmitter } from "vscode";
import type { IFlowRepository } from "@extension/interfaces/IFlowRepository.js";
import type { FlowDefinition, FlowSummary } from "@shared/types/flow.js";

// Trace: DD-01-003003
export class FlowService {
  private readonly flowRepository: IFlowRepository;
  private readonly _onDidChangeFlows = new EventEmitter<void>();
  readonly onDidChangeFlows = this._onDidChangeFlows;

  constructor(flowRepository: IFlowRepository) {
    this.flowRepository = flowRepository;
  }

  // Trace: DD-01-003004
  async createFlow(name: string): Promise<FlowDefinition> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Trace: DD-01-003005
    const triggerNode = {
      id: crypto.randomUUID(),
      type: "trigger",
      label: "Trigger",
      enabled: true,
      position: { x: 250, y: 50 },
      settings: {},
    };
    const flow: FlowDefinition = {
      id,
      name,
      description: "",
      version: "1.0.0",
      nodes: [triggerNode],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.flowRepository.save(flow);
    this._onDidChangeFlows.fire();
    return flow;
  }

  // Trace: DD-01-003004
  async getFlow(flowId: string): Promise<FlowDefinition> {
    return this.flowRepository.load(flowId);
  }

  // Trace: DD-01-003004
  async saveFlow(flow: FlowDefinition): Promise<void> {
    flow.updatedAt = new Date().toISOString();
    await this.flowRepository.save(flow);
    this._onDidChangeFlows.fire();
  }

  // Trace: DD-01-003004
  async deleteFlow(flowId: string): Promise<void> {
    await this.flowRepository.delete(flowId);
    this._onDidChangeFlows.fire();
  }

  // Trace: DD-01-003004
  async renameFlow(flowId: string, newName: string): Promise<void> {
    const flow = await this.flowRepository.load(flowId);
    flow.name = newName;
    flow.updatedAt = new Date().toISOString();
    await this.flowRepository.save(flow);
    this._onDidChangeFlows.fire();
  }

  // Trace: DD-01-003004
  async listFlows(_parentId?: string): Promise<FlowSummary[]> {
    return this.flowRepository.list();
  }

  // Trace: DD-01-003004
  async existsFlow(flowId: string): Promise<boolean> {
    return this.flowRepository.exists(flowId);
  }
}
