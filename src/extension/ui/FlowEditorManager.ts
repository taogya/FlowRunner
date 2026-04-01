// Trace: DD-02-003002, DD-02-003003, DD-02-003004, DD-02-003005
import * as vscode from "vscode";
import * as crypto from "crypto";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";

type BrokerFactory = () => {
  handleMessage(message: unknown, panel: unknown): void;
  setupEventForwarding(panel: unknown): { dispose(): void };
  dispose(): void;
};

export class FlowEditorManager implements IFlowEditorManager {
  private readonly panels = new Map<
    string,
    { panel: vscode.WebviewPanel; broker: ReturnType<BrokerFactory> }
  >();
  private readonly extensionUri: vscode.Uri;
  private readonly brokerFactory: BrokerFactory;
  private activeFlowId: string | undefined;

  constructor(extensionUri: vscode.Uri, brokerFactory: BrokerFactory) {
    this.extensionUri = extensionUri;
    this.brokerFactory = brokerFactory;
  }

  // Trace: DD-02-003003
  openEditor(flowId: string, flowName?: string): void {
    const existing = this.panels.get(flowId);
    if (existing) {
      existing.panel.reveal();
      if (flowName) {
        existing.panel.title = flowName;
      }
      this.activeFlowId = flowId;
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "flowrunner.editor",
      flowName ?? `Flow: ${flowId.slice(0, 8)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // Trace: DD-02-003003 — BD-02-003004 localResourceRoots
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "dist"),
        ],
      },
    );

    if (!panel) {
      return;
    }

    // Trace: DD-02-003004
    panel.webview.html = this.getHtmlContent(panel);

    const broker = this.brokerFactory();
    broker.setupEventForwarding(panel);

    // Trace: DD-02-003003 — すべてのメッセージに flowId を自動注入
    panel.webview.onDidReceiveMessage((message: unknown) => {
      const msg = message as { type?: string; payload?: Record<string, unknown> };
      const enrichedPayload = { ...msg.payload, flowId };
      broker.handleMessage({ type: msg.type, payload: enrichedPayload }, panel);
    });

    panel.onDidDispose(() => {
      broker.dispose();
      this.panels.delete(flowId);
      if (this.activeFlowId === flowId) {
        this.activeFlowId = undefined;
      }
    });

    // Trace: DD-02-003005 — 可視性変更時に activeFlowId を更新
    // retainContextWhenHidden: true のため、WebView DOM は保持される
    // auto-save 機能によりデータは自動保存されるため、flow:load の再送信は不要
    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) {
        this.activeFlowId = flowId;
      }
    });

    this.panels.set(flowId, { panel, broker });
    this.activeFlowId = flowId;
  }

  closeEditor(flowId: string): void {
    const entry = this.panels.get(flowId);
    if (entry) {
      entry.broker.dispose();
      entry.panel.dispose();
      this.panels.delete(flowId);
    }
    if (this.activeFlowId === flowId) {
      this.activeFlowId = undefined;
    }
  }

  getActiveFlowId(): string | undefined {
    return this.activeFlowId;
  }

  // Trace: DD-02-003004
  private getHtmlContent(panel: vscode.WebviewPanel): string {
    const webviewUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js"),
    );
    const cssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.css"),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const cspSource = (panel.webview as any).cspSource ?? "";
    const nonce = crypto.randomBytes(16).toString("base64");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri.toString()}">
  <title>Flow Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${webviewUri.toString()}"></script>
</body>
</html>`;
  }

  // Trace: DD-02-003005
  dispose(): void {
    for (const { panel, broker } of this.panels.values()) {
      broker.dispose();
      panel.dispose();
    }
    this.panels.clear();
  }
}
