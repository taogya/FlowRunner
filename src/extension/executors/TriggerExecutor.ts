// Trace: DD-03-005001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: BD-03-006001
export class TriggerExecutor implements INodeExecutor {
  // Trace: BD-03-006001
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "trigger",
    label: "トリガー",
    icon: "trigger",
    category: "基本",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(_settings: NodeSettings): ValidationResult {
    return { valid: true };
  }

  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    return { status: "success", outputs: { out: {} }, duration: 0 };
  }
}
