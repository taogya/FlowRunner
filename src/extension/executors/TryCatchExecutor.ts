// Trace: FEAT-00006-003001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: FEAT-00006-003001
export class TryCatchExecutor implements INodeExecutor {
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "tryCatch",
    label: "エラーハンドリング",
    icon: "error",
    category: "制御",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "try", label: "Try 本体", dataType: "any" },
      { id: "catch", label: "Catch", dataType: "any" },
      { id: "done", label: "完了", dataType: "any" },
    ],
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
    // Pass input directly to the try port; ExecutionService handles sub-graph execution
    return {
      status: "success",
      outputs: { try: context.inputs.in, done: context.inputs.in },
      duration: 0,
    };
  }
}
