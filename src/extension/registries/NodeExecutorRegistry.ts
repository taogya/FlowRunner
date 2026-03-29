// Trace: DD-03-002001, DD-03-002002, DD-03-002003
import type { INodeExecutor } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";

export class NodeExecutorRegistry implements INodeExecutorRegistry {
  private readonly executors = new Map<string, INodeExecutor>();

  register(nodeType: string, executor: INodeExecutor): void {
    if (this.executors.has(nodeType)) {
      throw new Error(`Executor already registered for nodeType: ${nodeType}`);
    }
    this.executors.set(nodeType, executor);
  }

  get(nodeType: string): INodeExecutor {
    const executor = this.executors.get(nodeType);
    if (!executor) {
      throw new Error(`No executor registered for nodeType: ${nodeType}`);
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
