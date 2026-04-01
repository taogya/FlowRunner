// Trace: DD-03-005002
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import * as vscode from "vscode";
import { spawn } from "child_process";
import { expandTemplate } from "./expandTemplate.js";

interface OutputChannel {
  appendLine(value: string): void;
}

// Trace: BD-03-006002
export class CommandExecutor implements INodeExecutor {
  private readonly outputChannel?: OutputChannel;

  constructor(outputChannel?: OutputChannel) {
    this.outputChannel = outputChannel;
  }
  // Trace: BD-03-006002
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "command",
    label: "コマンド実行",
    icon: "command",
    category: "基本",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "stdout", label: "標準出力", dataType: "string" },
      { id: "stderr", label: "標準エラー", dataType: "string" },
    ],
    settingsSchema: [
      { key: "command", label: "コマンド", type: "text", required: true, placeholder: "echo {{input}}", description: "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能" },
      { key: "cwd", label: "作業ディレクトリ", type: "string", required: false, defaultValue: "" },
      { key: "shell", label: "シェル", type: "select", required: false, defaultValue: "default", options: [{ value: "default", label: "default" }, { value: "bash", label: "bash" }, { value: "zsh", label: "zsh" }, { value: "sh", label: "sh" }, { value: "cmd", label: "cmd" }, { value: "pwsh", label: "pwsh" }] },
      { key: "env", label: "環境変数", type: "keyValue", required: false },
      { key: "timeout", label: "タイムアウト（秒）", type: "number", required: false, defaultValue: 0 },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    if (!settings.command) {
      return { valid: false, errors: [{ field: "command", message: "command is required" }] };
    }
    return { valid: true };
  }

  // Trace: DD-03-005002
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }
    const start = Date.now();

    // Trace: DD-03-005002 - cwd: settings.cwd or workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const cwd = (context.settings.cwd as string) || workspaceRoot || process.cwd();

    // Trace: DD-03-005002 - shell option
    const shellSetting = context.settings.shell as string | undefined;
    const shell: string | boolean = (!shellSetting || shellSetting === "default") ? true : shellSetting;

    // Trace: DD-03-005002 - env: merge process.env + user env + FLOW_INPUT
    const rawEnv = context.settings.env;
    const userEnv: Record<string, string> = Array.isArray(rawEnv)
      ? (rawEnv as Array<{ key: string; value: string }>).reduce((acc, p) => { if (p.key?.trim()) acc[p.key] = p.value; return acc; }, {} as Record<string, string>)
      : (rawEnv as Record<string, string>) ?? {};
    const env = {
      ...process.env,
      ...userEnv,
      FLOW_INPUT: JSON.stringify(context.inputs),
    };

    // Trace: DD-03-005002 - timeout handling
    const timeoutSec = Number(context.settings.timeout) || 0;
    const rawCommand = context.settings.command as string;
    const command = expandTemplate(rawCommand, context.inputs.in, context.variables);
    const oc = this.outputChannel;

    return new Promise<IExecutionResult>((resolve) => {
      const args = typeof shell === "string"
        ? [shell === "cmd" ? "/c" : "-c", command]
        : ["-c", command];
      const shellBin = typeof shell === "string" ? shell : undefined;

      const child = spawn(shellBin ?? process.env.SHELL ?? "/bin/sh", args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const nodeId = context.nodeId;
      child.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdout += text;
        if (oc) {
          for (const line of text.split("\n").filter((l: string) => l)) {
            oc.appendLine(`  │ (${nodeId}) ${line}`);
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        if (oc) {
          for (const line of text.split("\n").filter((l: string) => l)) {
            oc.appendLine(`  │ (${nodeId}) [stderr] ${line}`);
          }
        }
      });

      const finish = (status: "success" | "error" | "cancelled", errorMsg?: string) => {
        if (settled) return;
        settled = true;
        const result: IExecutionResult = {
          status,
          outputs: { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() },
          duration: Date.now() - start,
        };
        if (errorMsg) result.error = { message: errorMsg };
        resolve(result);
      };

      child.on("close", (code) => {
        if (context.signal.aborted) {
          finish("cancelled");
        } else if (code === 0) {
          finish("success");
        } else {
          finish("error", `Process exited with code ${code}`);
        }
      });

      child.on("error", (err) => {
        finish("error", err.message);
      });

      // Abort handling
      const onAbort = () => {
        child.kill("SIGTERM");
        finish("cancelled");
      };
      context.signal.addEventListener("abort", onAbort, { once: true });

      // Timeout handling
      if (timeoutSec > 0) {
        setTimeout(() => {
          if (!settled) {
            child.kill("SIGTERM");
            finish("error", `Command timed out after ${timeoutSec}s`);
          }
        }, timeoutSec * 1000);
      }
    });
  }
}
