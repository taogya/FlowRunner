// Trace: DD-03-008001
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { expandTemplate } from "./expandTemplate.js";

// Trace: BD-03-006007
export class FileExecutor implements INodeExecutor {
  // Trace: BD-03-006007
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "file",
    label: "ファイル操作",
    icon: "file",
    category: "データ",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [{ id: "out", label: "出力", dataType: "any" }],
    settingsSchema: [
      { key: "operation", label: "操作種別", type: "select", required: true, defaultValue: "read", options: [{ value: "read", label: "read" }, { value: "write", label: "write" }, { value: "append", label: "append" }, { value: "delete", label: "delete" }, { value: "exists", label: "exists" }, { value: "listDir", label: "listDir" }] },
      { key: "path", label: "ファイルパス", type: "string", required: true },
      { key: "encoding", label: "エンコーディング", type: "select", required: false, defaultValue: "utf-8", options: [{ value: "utf-8", label: "utf-8" }, { value: "ascii", label: "ascii" }, { value: "base64", label: "base64" }] },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    const filePath = settings.path as string | undefined;
    if (!filePath) {
      return { valid: false, errors: [{ field: "path", message: "path is required" }] };
    }
    if (!settings.operation) {
      return { valid: false, errors: [{ field: "operation", message: "operation is required" }] };
    }
    // Trace: DD-03-008001, REV-012 #2 — path security validation
    // Absolute paths are allowed; traversal check applies only to relative paths
    if (!path.isAbsolute(filePath)) {
      const normalized = path.normalize(filePath);
      if (normalized.startsWith("..")) {
        return { valid: false, errors: [{ field: "path", message: "path traversal is not allowed" }] };
      }
    }
    return { valid: true };
  }

  // Trace: DD-03-008001, REV-012 #2
  private validatePath(filePath: string): string {
    // Absolute paths are returned as-is; relative paths are resolved against workspace root
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    const normalized = path.normalize(filePath);
    if (normalized.startsWith("..")) {
      throw new Error("path traversal is not allowed");
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error("no workspace folder is open");
    }
    return path.join(workspaceRoot, normalized);
  }

  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }

    const startMs = Date.now();
    try {
      const rawPath = expandTemplate(context.settings.path as string, context.inputs.in);
      // REV-013 #6: expandTemplate 後のパスに対してトラバーサル再検証
      const absPath = this.validatePath(rawPath);
      const encoding = (context.settings.encoding as BufferEncoding) ?? "utf-8";
      const operation = context.settings.operation as string;
      let output: unknown;

      // Trace: DD-03-008001 — operation dispatch
      switch (operation) {
        case "read":
          output = await fs.promises.readFile(absPath, encoding);
          break;
        case "write":
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          await fs.promises.writeFile(absPath, String(context.inputs.in ?? ""), encoding);
          output = { success: true };
          break;
        case "append":
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          await fs.promises.appendFile(absPath, String(context.inputs.in ?? ""), encoding);
          output = { success: true };
          break;
        case "delete":
          await fs.promises.unlink(absPath);
          output = { success: true };
          break;
        case "exists":
          try {
            await fs.promises.access(absPath);
            output = true;
          } catch {
            output = false;
          }
          break;
        case "listDir":
          output = await fs.promises.readdir(absPath);
          break;
        default:
          return {
            status: "error",
            outputs: {},
            duration: Date.now() - startMs,
            error: { message: `Unknown operation: ${operation}` },
          };
      }

      return { status: "success", outputs: { out: output }, duration: Date.now() - startMs };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", outputs: {}, duration: Date.now() - startMs, error: { message } };
    }
  }
}
