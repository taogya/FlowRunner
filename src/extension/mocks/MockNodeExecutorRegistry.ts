// Trace: BD-03-003002 Mock implementation
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { INodeExecutor } from "@extension/interfaces/INodeExecutor.js";

/**
 * INodeExecutorRegistry の Mock 実装
 *
 * インメモリで Executor を管理する。
 */
export class MockNodeExecutorRegistry implements INodeExecutorRegistry {
  private executors = new Map<string, INodeExecutor>();

  register(nodeType: string, executor: INodeExecutor): void {
    this.executors.set(nodeType, executor);
  }

  get(nodeType: string): INodeExecutor {
    const executor = this.executors.get(nodeType);
    if (!executor) {
      throw new Error(`Executor not found for node type: ${nodeType}`);
    }
    return executor;
  }

  getAll(): INodeExecutor[] {
    return Array.from(this.executors.values());
  }

  has(nodeType: string): boolean {
    return this.executors.has(nodeType);
  }
}
