// Trace: BD-04-003002 Mock implementation
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { Disposable } from "@extension/interfaces/IExecutionService.js";
import type { DebugEvent } from "@shared/types/events.js";
import type { NodeResultMap } from "@shared/types/execution.js";

/**
 * IDebugService の Mock 実装
 *
 * デバッグモードをシミュレートする。
 */
export class MockDebugService implements IDebugService {
  private debugging = false;
  private results: NodeResultMap = {};
  private handlers: Array<(event: DebugEvent) => void> = [];
  private stepCount = 0;

  async startDebug(_flowId: string): Promise<void> {
    this.debugging = true;
    this.results = {};
    this.stepCount = 0;
  }

  async step(): Promise<void> {
    if (!this.debugging) {
      throw new Error("Not in debug mode");
    }

    this.stepCount++;
    const nodeId = `node-${this.stepCount}`;

    this.results[nodeId] = {
      nodeId,
      nodeType: "mock",
      nodeLabel: `Mock Node ${this.stepCount}`,
      status: "success",
      inputs: {},
      outputs: {},
      duration: 1,
    };

    this.fireEvent({
      nextNodeId: `node-${this.stepCount + 1}`,
      intermediateResults: { ...this.results },
    });
  }

  stopDebug(): void {
    this.debugging = false;
    this.results = {};
    this.stepCount = 0;
  }

  isDebugging(): boolean {
    return this.debugging;
  }

  getIntermediateResults(): NodeResultMap {
    return { ...this.results };
  }

  onDebugEvent(handler: (event: DebugEvent) => void): Disposable {
    this.handlers.push(handler);
    return {
      dispose: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }

  private fireEvent(event: DebugEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
