// Trace: DD-03-008003
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import { expandTemplate } from "./expandTemplate.js";
import { safeEval } from "./safeEval.js";

// Trace: BD-03-006009
export class TransformExecutor implements INodeExecutor {
  // Trace: BD-03-006009
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "transform",
    label: "データ変換",
    icon: "transform",
    category: "データ",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [
      { key: "transformType", label: "変換種別", type: "select", required: true, defaultValue: "jsonParse", options: [{ value: "jsonParse", label: "jsonParse" }, { value: "jsonStringify", label: "jsonStringify" }, { value: "textReplace", label: "textReplace" }, { value: "textSplit", label: "textSplit" }, { value: "textJoin", label: "textJoin" }, { value: "regex", label: "regex" }, { value: "template", label: "template" }, { value: "jsExpression", label: "jsExpression" }, { value: "setVar", label: "setVar" }, { value: "getVar", label: "getVar" }] },
      { key: "expression", label: "式/パラメータ", type: "text", required: false, description: "template: {{input}}, {{vars.xxx}} / jsExpression: jexl式 (input, vars.xxx)" },
      { key: "varName", label: "変数名", type: "text", required: false },
      { key: "defaultValue", label: "デフォルト値", type: "text", required: false },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    // Trace: DD-03-008003
    if (!settings.transformType) {
      return { valid: false, errors: [{ field: "transformType", message: "transformType is required" }] };
    }
    if (settings.transformType === "jsExpression" && !settings.expression) {
      return { valid: false, errors: [{ field: "expression", message: "expression is required for jsExpression" }] };
    }
    // Trace: FEAT-00002-003005
    if ((settings.transformType === "setVar" || settings.transformType === "getVar") && !settings.varName) {
      return { valid: false, errors: [{ field: "varName", message: "varName is required for setVar/getVar" }] };
    }
    return { valid: true };
  }

  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    const startMs = Date.now();
    try {
      const input = context.inputs.in;
      const expression = context.settings.expression as string;
      const transformType = (context.settings.transformType as string) ?? "jsExpression";
      let result: unknown;

      // Trace: DD-03-008003 — dispatch by transformType
      switch (transformType) {
        case "jsonParse":
          result = JSON.parse(String(input));
          break;
        case "jsonStringify":
          result = JSON.stringify(input, null, 2);
          break;
        case "textReplace": {
          const separatorIdx = expression.indexOf("|");
          const search = separatorIdx >= 0 ? expression.slice(0, separatorIdx) : expression;
          const replace = separatorIdx >= 0 ? expression.slice(separatorIdx + 1) : "";
          result = String(input).replace(search, replace);
          break;
        }
        case "textSplit":
          result = String(input).split(expression);
          break;
        case "textJoin":
          result = Array.isArray(input) ? input.join(expression) : String(input);
          break;
        case "regex":
          result = String(input).match(new RegExp(expression));
          break;
        case "template":
          result = expandTemplate(expression, input, context.variables);
          break;
        case "jsExpression": {
          // Trace: DD-03-008003 — safe expression evaluation via jexl
          // Trace: FEAT-00002 — pass shared variables for vars.xxx access
          result = await safeEval(expression, input, context.variables);
          break;
        }
        // Trace: FEAT-00002-003005
        case "setVar": {
          const varName = context.settings.varName as string;
          context.variables?.set(varName, input);
          result = input;
          break;
        }
        case "getVar": {
          const varName = context.settings.varName as string;
          const defaultValue = context.settings.defaultValue;
          result = context.variables?.get(varName) ?? defaultValue;
          break;
        }
        default:
          return {
            status: "error",
            outputs: {},
            duration: Date.now() - startMs,
            error: { message: `Unknown transform type: ${transformType}` },
          };
      }

      return { status: "success", outputs: { out: result }, duration: Date.now() - startMs };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", outputs: {}, duration: Date.now() - startMs, error: { message } };
    }
  }
}
