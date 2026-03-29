// Trace: DD-03-008002
import type {
  INodeExecutor,
  IExecutionContext,
  IExecutionResult,
} from "@extension/interfaces/INodeExecutor.js";
import type { NodeSettings } from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult } from "@shared/types/execution.js";
import { expandTemplate } from "./expandTemplate.js";

interface OutputChannel {
  appendLine(value: string): void;
  warn?(...args: unknown[]): void;
}

// Trace: DD-03-008002 — private network CIDR ranges
const PRIVATE_HOSTS = ["127.0.0.1", "localhost", "::1", "0.0.0.0"];

function isPrivateIP(hostname: string): boolean {
  if (PRIVATE_HOSTS.includes(hostname)) {
    return true;
  }
  // Check 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

// Trace: BD-03-006008
export class HttpExecutor implements INodeExecutor {
  private readonly outputChannel?: OutputChannel;

  constructor(outputChannel?: OutputChannel) {
    this.outputChannel = outputChannel;
  }

  // Trace: BD-03-006008
  private readonly metadata: INodeTypeMetadata = {
    nodeType: "http",
    label: "HTTP リクエスト",
    icon: "http",
    category: "データ",
    inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
    outputPorts: [
      { id: "body", label: "レスポンスボディ", dataType: "string" },
      { id: "status", label: "ステータスコード", dataType: "number" },
    ],
    settingsSchema: [
      { key: "url", label: "URL", type: "string", required: true },
      { key: "method", label: "メソッド", type: "select", required: false, defaultValue: "GET", options: [{ value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" }, { value: "PATCH", label: "PATCH" }] },
      { key: "headers", label: "ヘッダー", type: "keyValue", required: false },
      { key: "body", label: "ボディ", type: "text", required: false },
      { key: "auth", label: "認証", type: "select", required: false, defaultValue: "none", options: [{ value: "none", label: "none" }, { value: "bearer", label: "bearer" }] },
      { key: "authToken", label: "トークン", type: "string", required: false },
      { key: "timeout", label: "タイムアウト（秒）", type: "number", required: false, defaultValue: 30 },
    ],
  };

  getMetadata(): INodeTypeMetadata {
    return this.metadata;
  }

  validate(settings: NodeSettings): ValidationResult {
    if (!settings.url) {
      return { valid: false, errors: [{ field: "url", message: "url is required" }] };
    }
    return { valid: true };
  }

  // Trace: DD-03-008002
  async execute(context: IExecutionContext): Promise<IExecutionResult> {
    if (context.signal.aborted) {
      return { status: "cancelled", outputs: {}, duration: 0 };
    }

    const startMs = Date.now();
    try {
      // Trace: DD-03-008002 — template expansion for URL and body
      const url = expandTemplate(context.settings.url as string, context.inputs.in);
      const bodyTemplate = context.settings.body as string | undefined;
      const requestBody = bodyTemplate ? expandTemplate(bodyTemplate, context.inputs.in) : undefined;

      // Trace: DD-03-008002 — private network check (warn only, don't block)
      try {
        const parsedUrl = new URL(url);
        if (isPrivateIP(parsedUrl.hostname)) {
          const warnMsg = `[HttpExecutor] Warning: request to private network address ${parsedUrl.hostname}`;
          if (this.outputChannel?.warn) {
            this.outputChannel.warn(warnMsg);
          } else {
            this.outputChannel?.appendLine(warnMsg);
          }
        }
      } catch {
        // URL parse failed — will be caught by fetch below
      }

      // Trace: DD-03-008002 — build headers with optional auth
      const headers: Record<string, string> = {};
      const settingsHeaders = context.settings.headers as Record<string, string> | undefined;
      if (settingsHeaders) {
        Object.assign(headers, settingsHeaders);
      }
      if (context.settings.auth === "bearer" && context.settings.authToken) {
        headers["Authorization"] = `Bearer ${context.settings.authToken as string}`;
      }

      // Trace: DD-03-008002 — compose abort signals (user cancel + timeout)
      const timeoutSec = (context.settings.timeout as number) ?? 30;
      const timeoutSignal = AbortSignal.timeout(timeoutSec * 1000);
      const combinedSignal = AbortSignal.any([context.signal, timeoutSignal]);

      const method = (context.settings.method as string) ?? "GET";
      const hasBody = ["POST", "PUT", "PATCH"].includes(method) && requestBody !== undefined;

      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? requestBody : undefined,
        signal: combinedSignal,
      });

      const responseBody = await response.text();

      return {
        status: "success",
        outputs: { body: responseBody, status: response.status },
        duration: Date.now() - startMs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "error",
        outputs: {},
        duration: Date.now() - startMs,
        error: { message },
      };
    }
  }
}
