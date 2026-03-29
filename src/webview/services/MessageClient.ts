// Trace: DD-02-009001, DD-02-009002
import type { IMessageClient } from "@webview/interfaces/IMessageClient.js";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

export class MessageClient implements IMessageClient {
  private readonly vsCodeApi: VsCodeApi;

  constructor(vsCodeApi: VsCodeApi) {
    this.vsCodeApi = vsCodeApi;
  }

  send(type: string, payload: Record<string, unknown>): void {
    this.vsCodeApi.postMessage({ type, payload });
  }

  onMessage(handler: (message: { type: string; payload: Record<string, unknown> }) => void): { dispose(): void } {
    const listener = (event: MessageEvent) => {
      handler(event.data);
    };
    globalThis.addEventListener("message", listener as EventListener);
    return {
      dispose: () => {
        globalThis.removeEventListener("message", listener as EventListener);
      },
    };
  }
}

// Trace: DD-02-009001 — WebView コンテキスト用シングルトン
declare function acquireVsCodeApi(): VsCodeApi;
export const messageClient: IMessageClient = new MessageClient(acquireVsCodeApi());
