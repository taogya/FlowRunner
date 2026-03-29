// Trace: BD-04-002002 Mock implementation
import type { IExecutionService, Disposable } from "@extension/interfaces/IExecutionService.js";
import type { FlowEvent } from "@shared/types/events.js";
import type { PortDataMap } from "@shared/types/flow.js";

/**
 * IExecutionService の Mock 実装
 *
 * フロー実行をシミュレートする。
 */
export class MockExecutionService implements IExecutionService {
  private running = new Set<string>();
  private handlers: Array<(event: FlowEvent) => void> = [];

  async executeFlow(flowId: string): Promise<PortDataMap | undefined> {
    this.running.add(flowId);

    // Simulate node execution events
    this.fireEvent({
      type: "nodeStarted",
      flowId,
      nodeId: "node-1",
      progress: { current: 0, total: 1 },
    });

    this.fireEvent({
      type: "nodeCompleted",
      flowId,
      nodeId: "node-1",
      nodeStatus: "success",
      nodeOutput: {},
      progress: { current: 1, total: 1 },
    });

    this.running.delete(flowId);

    this.fireEvent({
      type: "flowCompleted",
      flowId,
      progress: { current: 1, total: 1 },
    });

    return undefined;
  }

  stopFlow(flowId: string): void {
    this.running.delete(flowId);
  }

  getRunningFlows(): string[] {
    return Array.from(this.running);
  }

  isRunning(flowId: string): boolean {
    return this.running.has(flowId);
  }

  onFlowEvent(handler: (event: FlowEvent) => void): Disposable {
    this.handlers.push(handler);
    return {
      dispose: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }

  private fireEvent(event: FlowEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
