// Trace: DD-03-009001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: BD-03-006010
export class CommentExecutor implements INodeExecutor {
  // Trace: BD-03-006010
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "comment",
    label: "コメント",
    icon: "comment",
    category: "その他",
    inputPorts: [],
    outputPorts: [],
    settingsSchema: [
      { key: "comment", label: "コメント", type: "text", required: false, defaultValue: "" },
    ],
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
    return { status: "skipped", outputs: {}, duration: 0 };
  }
}
