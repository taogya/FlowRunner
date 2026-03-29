// Trace: BD-02-004007
import type { Disposable } from "@extension/interfaces/IExecutionService.js";

/**
 * Extension Host との postMessage 通信を抽象化するクライアント
 */
// Trace: BD-02-004007
export interface IMessageClient {
  /** メッセージを送信する */
  send(type: string, payload: Record<string, unknown>): void;

  /** メッセージ受信ハンドラを登録する */
  onMessage(
    handler: (msg: { type: string; payload: Record<string, unknown> }) => void
  ): Disposable;
}
