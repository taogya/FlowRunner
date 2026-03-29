// Trace: BD-02-004007
import type { IMessageClient } from "@webview/interfaces/IMessageClient.js";
import type { Disposable } from "@extension/interfaces/IExecutionService.js";

/**
 * IMessageClient のモック実装
 * テスト用に送信メッセージの記録と受信シミュレーションを提供する
 */
export class MockMessageClient implements IMessageClient {
  private handlers: Array<
    (msg: { type: string; payload: Record<string, unknown> }) => void
  > = [];
  private sentMessages: Array<{
    type: string;
    payload: Record<string, unknown>;
  }> = [];

  send(type: string, payload: Record<string, unknown>): void {
    this.sentMessages.push({ type, payload });
  }

  onMessage(
    handler: (msg: { type: string; payload: Record<string, unknown> }) => void
  ): Disposable {
    this.handlers.push(handler);
    return {
      dispose: () => {
        this.handlers = this.handlers.filter((h) => h !== handler);
      },
    };
  }

  // --- Test helpers ---

  /** テスト用: 送信済みメッセージ一覧を返す */
  getSentMessages(): Array<{
    type: string;
    payload: Record<string, unknown>;
  }> {
    return [...this.sentMessages];
  }

  /** テスト用: メッセージ受信をシミュレートする */
  simulateMessage(type: string, payload: Record<string, unknown>): void {
    for (const handler of this.handlers) {
      handler({ type, payload });
    }
  }
}
