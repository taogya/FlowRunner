// Trace: DD-03-006001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import * as vscode from "vscode";
import { expandTemplate } from "./expandTemplate.js";

// Trace: BD-03-006003
export class AIPromptExecutor implements INodeExecutor {
  // Trace: BD-03-006003
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "aiPrompt",
    label: "AI プロンプト",
    icon: "aiPrompt",
    category: "AI",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "out", label: "応答", dataType: "string" },
      { id: "_tokenUsage", label: "トークン使用量", dataType: "object" },
    ],
    settingsSchema: [
      { key: "prompt", label: "プロンプト", type: "text", required: true, placeholder: "入力: {{input}}", description: "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能。未使用時はinputを自動付与" },
      {
        key: "model",
        label: "モデル",
        type: "select",
        required: false,
        options: [],
      },
    ],
  };

  // Trace: DD-03-006001 - dynamically fetch available models
  async getMetadataAsync(): Promise<INodeTypeMetadata> {
    try {
      const allModels = await vscode.lm.selectChatModels();
      const modelField = this.metadata.settingsSchema.find(f => f.key === "model");
      if (modelField && allModels.length > 0) {
        // Deduplicate by model id (multiple providers may expose same model)
        const seen = new Set<string>();
        const models = allModels.filter(m => {
          if (seen.has(m.id)) { return false; }
          seen.add(m.id);
          return true;
        });
        const sorted = [...models].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        modelField.options = sorted.map(m => {
          const maxK = Math.round(m.maxInputTokens / 1000);
          const detail = maxK > 0 ? ` (${m.family}, ${maxK}K)` : m.family ? ` (${m.family})` : "";
          return {
            value: m.id,
            label: `${m.name || m.id}${detail}`,
          };
        });
      }
    } catch {
      // LM API unavailable - keep empty options
    }
    return this.metadata;
  }

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    const errors: { field: string; message: string }[] = [];
    if (!settings.prompt) {
      errors.push({ field: "prompt", message: "prompt is required" });
    }
    if (!settings.model) {
      errors.push({ field: "model", message: "AIノードのモデルを選択してください" });
    }
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  }

  // Trace: DD-03-006001
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    const start = Date.now();

    try {
      // Trace: DD-03-006001 step 1 - expand prompt template
      const rawPrompt = context.settings.prompt as string;
      const inputData = context.inputs.in;
      let prompt = expandTemplate(rawPrompt, inputData, context.variables);
      // Auto-append input if template has no {{input}} placeholders and input exists
      if (!rawPrompt.includes("{{input") && inputData != null && inputData !== "") {
        const inputStr = typeof inputData === "string" ? inputData : JSON.stringify(inputData, null, 2);
        prompt = `${inputStr}\n\n${prompt}`;
      }

      // Trace: DD-03-006001 step 2-3 - select model
      const modelId = context.settings.model as string | undefined;
      if (!modelId) {
        return {
          status: "error",
          outputs: {},
          duration: Date.now() - start,
          error: { message: "AIノードのモデルを選択してください" },
        };
      }
      const models = await vscode.lm.selectChatModels({ id: modelId });

      if (models.length === 0) {
        return {
          status: "error",
          outputs: {},
          duration: Date.now() - start,
          error: { message: "No language model available" },
        };
      }

      const model = models[0];

      // Trace: DD-03-006001 step 5 - send request
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      // REV-013 #11: CancellationTokenSource を保持し、abort 時に cancel
      const cts = new vscode.CancellationTokenSource();
      const abortHandler = () => cts.cancel();
      context.signal.addEventListener("abort", abortHandler, { once: true });
      let response: vscode.LanguageModelChatResponse;
      try {
        response = await model.sendRequest(messages, {}, cts.token);
      } finally {
        context.signal.removeEventListener("abort", abortHandler);
      }

      // Trace: DD-03-006001 step 6 - collect response text
      let responseText = "";
      for await (const fragment of response.text) {
        if (context.signal.aborted) {
          return { status: "cancelled", outputs: {}, duration: Date.now() - start };
        }
        responseText += fragment;
      }

      // Count tokens for cost visibility
      let tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number; model: string } | undefined;
      try {
        const [inputTokens, outputTokens] = await Promise.all([
          model.countTokens(prompt),
          model.countTokens(responseText),
        ]);
        tokenUsage = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          model: model.id,
        };
      } catch {
        // countTokens not supported by this model — skip
      }

      return {
        status: "success",
        outputs: { out: responseText, ...(tokenUsage && { _tokenUsage: tokenUsage }) },
        duration: Date.now() - start,
      };
    } catch (err: unknown) {
      if (context.signal.aborted) {
        return { status: "cancelled", outputs: {}, duration: Date.now() - start };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - start,
        error: { message },
      };
    }
  }
}
