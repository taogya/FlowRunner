// Trace: BD-03-002002 Mock implementation
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

/**
 * INodeExecutor の Mock 実装
 *
 * テスト用の汎用ノード Executor。
 */
export class MockNodeExecutor implements INodeExecutor {
  constructor(
    private nodeType: string,
    private requiredSettings: string[] = []
  ) {}

  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    return {
      status: "success",
      outputs: { out: context.inputs },
      duration: 1,
    };
  }

  validate(settings: NodeSettings): ValidationResult {
    const errors = this.requiredSettings
      .filter((key) => settings[key] === undefined || settings[key] === "")
      .map((key) => ({ field: key, message: `${key} is required` }));

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getMetadata(): INodeTypeMetadata {
    return {
      nodeType: this.nodeType,
      label: this.nodeType,
      icon: "default",
      category: "basic",
      inputPorts: [{ id: "in", label: "Input", dataType: "any" }],
      outputPorts: [{ id: "out", label: "Output", dataType: "any" }],
      settingsSchema: this.requiredSettings.map((key) => ({
        key,
        label: key,
        type: "string" as const,
        required: true,
      })),
    };
  }
}
