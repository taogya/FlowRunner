// Trace: DD-03-007002
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: DD-03-007002
const MAX_ITERATIONS = 10000;

// Trace: BD-03-006005
export class LoopExecutor implements INodeExecutor {
  // Trace: BD-03-006005
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "loop",
    label: "ループ",
    icon: "loop",
    category: "制御",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "body", label: "ループ本体", dataType: "any" },
      { id: "done", label: "完了", dataType: "any" },
    ],
    settingsSchema: [
      { key: "loopType", label: "ループ種別", type: "select", required: true, defaultValue: "count", description: "count: 指定回数繰り返す / condition: 条件がtrueの間繰り返す / list: 入力リストの各要素で繰り返す", options: [{ value: "count", label: "カウント（N回）" }, { value: "condition", label: "条件式（whileループ）" }, { value: "list", label: "リスト（forEachループ）" }] },
      { key: "count", label: "回数", type: "number", required: false, defaultValue: 1, description: "bodyポートに反復インデックス(0,1,2...)が渡されます", visibleWhen: { field: "loopType", value: "count" } },
      { key: "expression", label: "条件式", type: "text", required: false, description: "式がtrueを返す間ループ継続。変数 input で入力データを参照", placeholder: "input.length > 0", visibleWhen: { field: "loopType", value: ["condition", "list"] } },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  // Trace: DD-03-007002
  validate(settings: NodeSettings): ValidationResult {
    const loopType = settings.loopType ?? settings.mode;
    if (!loopType) {
      return { valid: false, errors: [{ field: "loopType", message: "loopType is required" }] };
    }
    if (loopType === "count") {
      const count = settings.count as number | undefined;
      if (count != null && (!Number.isInteger(count) || count < 0)) {
        return { valid: false, errors: [{ field: "count", message: "count must be a non-negative integer" }] };
      }
    }
    if (loopType === "condition") {
      if (!settings.expression) {
        return { valid: false, errors: [{ field: "expression", message: "expression is required for condition loop" }] };
      }
    }
    return { valid: true };
  }

  // Trace: DD-03-007002
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    const start = Date.now();
    const mode = (context.settings.loopType ?? context.settings.mode) as string;
    const input = context.inputs.in;

    try {
      if (mode === "count") {
        return this.executeCount(context, input, start);
      }
      if (mode === "condition") {
        return this.executeCondition(context, input, start);
      }
      if (mode === "list") {
        return this.executeList(context, input, start);
      }
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - start,
        error: { message: `Unknown loopType: ${mode}` },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - start,
        error: { message },
      };
    }
  }

  // Trace: DD-03-007002 — count ループ
  private executeCount(
    context: IExecutionContext,
    input: unknown,
    start: number,
  ): IExecutionResult {
    const count = (context.settings.count as number) ?? 0;
    const bodyResults: Array<{ index: number; input: unknown }> = [];
    for (let i = 0; i < count; i++) {
      if (context.signal.aborted) {
        return { status: "cancelled", outputs: {}, duration: Date.now() - start };
      }
      bodyResults.push({ index: i, input });
    }
    return {
      status: "success",
      outputs: {
        body: bodyResults.length === 1 ? bodyResults[0] : bodyResults,
        done: { iterations: count, input },
      },
      duration: Date.now() - start,
    };
  }

  // Trace: DD-03-007002 — condition ループ
  private executeCondition(
    context: IExecutionContext,
    input: unknown,
    start: number,
  ): IExecutionResult {
    const expression = context.settings.expression as string;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function("input", "index", `return ${expression}`);
    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
      if (context.signal.aborted) {
        return { status: "cancelled", outputs: {}, duration: Date.now() - start };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = fn(input, iterations);
      if (!result) {
        break;
      }
      iterations++;
    }

    if (iterations >= MAX_ITERATIONS) {
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - start,
        error: { message: `Loop exceeded maximum iterations (${MAX_ITERATIONS})` },
      };
    }

    return {
      status: "success",
      outputs: {
        body: { index: iterations - 1, input },
        done: { iterations, input },
      },
      duration: Date.now() - start,
    };
  }

  // Trace: DD-03-007002 — list ループ
  private executeList(
    context: IExecutionContext,
    input: unknown,
    start: number,
  ): IExecutionResult {
    const list = Array.isArray(input) ? input : context.inputs.list;
    if (!Array.isArray(list)) {
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - start,
        error: { message: "Input data is not an array for list loop" },
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const bodyResults = list.map((item, index) => ({ index, item }));
    return {
      status: "success",
      outputs: {
        body: bodyResults,
        done: { iterations: list.length, results: list },
      },
      duration: Date.now() - start,
    };
  }
}
