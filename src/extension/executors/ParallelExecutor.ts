// Trace: FEAT-00007-003001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: FEAT-00007-003001
export class ParallelExecutor implements INodeExecutor {
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "parallel",
    label: "並列実行",
    icon: "split-horizontal",
    category: "制御",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "branch1", label: "ブランチ1", dataType: "any" },
      { id: "branch2", label: "ブランチ2", dataType: "any" },
      { id: "branch3", label: "ブランチ3", dataType: "any" },
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
    // Pass input to all branch ports; ExecutionService handles parallel execution
    return {
      status: "success",
      outputs: {
        branch1: context.inputs.in,
        branch2: context.inputs.in,
        branch3: context.inputs.in,
        done: context.inputs.in,
      },
      duration: 0,
    };
  }
}
