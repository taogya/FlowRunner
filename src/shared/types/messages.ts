// Trace: BD-01-004001, BD-01-004002

/**
 * Extension ↔ WebView 間メッセージプロトコル型定義
 */

/**
 * メッセージ共通構造
 */
export interface FlowRunnerMessage {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * WebView → Extension メッセージ型
 */
// Trace: BD-01-004002
export type WebViewToExtensionMessageType =
  | "flow:load"
  | "flow:save"
  | "flow:execute"
  | "flow:stop"
  | "debug:start"
  | "debug:step"
  | "debug:stop"
  | "node:getTypes"
  | "node:getMetadata"
  | "trigger:activate"
  | "trigger:deactivate"
  | "trigger:getStatus";

/**
 * Extension → WebView メッセージ型
 */
// Trace: BD-01-004002
export type ExtensionToWebViewMessageType =
  | "flow:loaded"
  | "flow:saved"
  | "node:typesLoaded"
  | "execution:nodeStarted"
  | "execution:nodeCompleted"
  | "execution:nodeError"
  | "execution:flowCompleted"
  | "debug:paused"
  | "node:metadataLoaded"
  | "trigger:statusChanged"
  | "error:general";
