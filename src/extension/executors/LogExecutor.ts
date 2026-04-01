// Trace: DD-03-005003
import type * as vscode from "vscode";
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import { expandTemplate } from "./expandTemplate.js";

// Trace: BD-03-006006
export class LogExecutor implements INodeExecutor {
  // Trace: DD-03-005003
  private readonly outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  // Trace: BD-03-006006
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "log",
    label: "ログ出力",
    icon: "log",
    category: "基本",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [
      { key: "message", label: "メッセージ", type: "text", required: false, defaultValue: "{{input}}", placeholder: "{{input}}", description: "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能" },
      { key: "level", label: "ログレベル", type: "select", required: false, defaultValue: "info", options: [{ value: "info", label: "info" }, { value: "warn", label: "warn" }, { value: "error", label: "error" }] },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  // Trace: DD-03-005003
  validate(_settings: NodeSettings): ValidationResult {
    return { valid: true };
  }

  // Trace: DD-03-005003
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    const message = context.settings.message
      ? expandTemplate(context.settings.message as string, context.inputs.in, context.variables)
      : expandTemplate("{{input}}", context.inputs.in, context.variables);
    const level = (context.settings.level as string) || "info";
    // Use LogOutputChannel methods for colored output if available
    const nodeId = context.nodeId;
    const tagged = `(${nodeId}) ${message}`;
    const ch = this.outputChannel as { info?: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void };
    if (level === "warn" && typeof ch.warn === "function") {
      ch.warn(tagged);
    } else if (level === "error" && typeof ch.error === "function") {
      ch.error(tagged);
    } else if (typeof ch.info === "function") {
      ch.info(tagged);
    } else {
      const prefix = level.toUpperCase();
      this.outputChannel.appendLine(`[${prefix}] ${tagged}`);
    }
    return {
      status: "success",
      outputs: { out: context.inputs.in },
      duration: 0,
    };
  }
}
