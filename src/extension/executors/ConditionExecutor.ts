// Trace: DD-03-007001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: BD-03-006004
export class ConditionExecutor implements INodeExecutor {
  // Trace: BD-03-006004
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "condition",
    label: "条件分岐",
    icon: "condition",
    category: "制御",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "true", label: "True", dataType: "any" },
      { id: "false", label: "False", dataType: "any" },
    ],
    settingsSchema: [
      { key: "expression", label: "条件式", type: "text", required: true },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    if (!settings.expression) {
      return { valid: false, errors: [{ field: "expression", message: "expression is required" }] };
    }
    return { valid: true };
  }

  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function("input", `return ${String(context.settings.expression)}`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = fn(context.inputs.in);
      const branch = result ? "true" : "false";
      return {
        status: "success",
        outputs: { [branch]: context.inputs.in },
        duration: 0,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "error",
        outputs: {},
        duration: 0,
        error: { message },
      };
    }
  }
}
