// Trace: DD-03-005001, FEAT-00001-003002
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";

// Trace: BD-03-006001, FEAT-00001-003002
export class TriggerExecutor implements INodeExecutor {
  // Trace: BD-03-006001, FEAT-00001-003002
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "trigger",
    label: "トリガー",
    icon: "trigger",
    category: "基本",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [
      {
        key: "triggerType",
        label: "トリガー種別",
        type: "select",
        required: true,
        defaultValue: "manual",
        options: [
          { value: "manual", label: "手動実行" },
          { value: "fileChange", label: "ファイル変更監視" },
          { value: "schedule", label: "スケジュール実行" },
        ],
      },
      {
        key: "filePattern",
        label: "監視パターン",
        type: "string",
        required: true,
        placeholder: "**/*.ts",
        description: "glob パターンで監視対象ファイルを指定",
        visibleWhen: { field: "triggerType", value: "fileChange" },
      },
      {
        key: "debounceMs",
        label: "デバウンス (ms)",
        type: "number",
        required: false,
        defaultValue: 500,
        description: "連続変更時の実行遅延（ミリ秒）",
        visibleWhen: { field: "triggerType", value: "fileChange" },
      },
      {
        key: "intervalSeconds",
        label: "実行間隔 (秒)",
        type: "number",
        required: true,
        defaultValue: 60,
        description: "定期実行の間隔（秒）。最小値: 5",
        visibleWhen: { field: "triggerType", value: "schedule" },
      },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  // Trace: FEAT-00001-003002
  validate(settings: NodeSettings): ValidationResult {
    const triggerType = settings.triggerType as string | undefined;
    if (triggerType === "fileChange") {
      const filePattern = settings.filePattern as string | undefined;
      if (!filePattern || filePattern.trim() === "") {
        return {
          valid: false,
          errors: [{ field: "filePattern", message: "監視パターンは必須です" }],
        };
      }
    }
    if (triggerType === "schedule") {
      const interval = settings.intervalSeconds as number | undefined;
      if (interval === undefined || interval === null) {
        return {
          valid: false,
          errors: [{ field: "intervalSeconds", message: "実行間隔は必須です" }],
        };
      }
    }
    return { valid: true };
  }

  // Trace: FEAT-00001-003003
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    // triggerData が設定されている場合はそのまま出力へ渡す
    const out = context.triggerData ?? {};
    return { status: "success", outputs: { out }, duration: 0 };
  }
}
