// DD-02 FlowEditorManager UT tests
// Trace: DD-02-003001, DD-02-003002, DD-02-003003, DD-02-003004, DD-02-003005

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowEditorManager } from "@extension/ui/FlowEditorManager.js";
import * as vscode from "vscode";

function createMockBrokerFactory() {
  return vi.fn().mockReturnValue({
    handleMessage: vi.fn(),
    setupEventForwarding: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  });
}

describe("FlowEditorManager", () => {
  let extensionUri: vscode.Uri;
  let brokerFactory: ReturnType<typeof createMockBrokerFactory>;
  let manager: FlowEditorManager;

  beforeEach(() => {
    vi.clearAllMocks();
    extensionUri = vscode.Uri.file("/test/extension");
    brokerFactory = createMockBrokerFactory();
    manager = new FlowEditorManager(extensionUri, brokerFactory);
  });

  // --- DD-02-003001: 概要 ---

  // DDUT-02-003001-00001
  it("canBeInstantiated", () => {
    // Assert
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(FlowEditorManager);
  });

  // --- DD-02-003002: クラス設計 ---

  // DDUT-02-003002-00001
  it("hasOpenEditorCloseEditorAndDispose", () => {
    // Assert
    expect(typeof manager.openEditor).toBe("function");
    expect(typeof manager.closeEditor).toBe("function");
    expect(typeof manager.dispose).toBe("function");
  });

  // DDUT-02-003003-00001
  it("openEditor_newFlow_createsWebviewPanel", async () => {
    // Act
    await manager.openEditor("flow-1");

    // Assert
    expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
  });

  // DDUT-02-003003-00002
  it("openEditor_existingFlow_revealsPanel", async () => {
    // Arrange
    const mockPanel = {
      webview: { html: "", onDidReceiveMessage: vi.fn(), asWebviewUri: vi.fn().mockReturnValue("") },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(),
      dispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel as any);
    await manager.openEditor("flow-1");

    // Act
    await manager.openEditor("flow-1");

    // Assert
    expect(mockPanel.reveal).toHaveBeenCalled();
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(1);
  });

  // DDUT-02-003004-00001
  it("openEditor_setsHtmlWithCsp", async () => {
    // Arrange
    const mockPanel = {
      webview: {
        html: "",
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn().mockReturnValue("https://webview-uri"),
        cspSource: "https://csp-source",
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(),
      dispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel as any);

    // Act
    await manager.openEditor("flow-1");

    // Assert
    expect(mockPanel.webview.html).toContain("Content-Security-Policy");
  });

  // DDUT-02-003005-00001
  it("dispose_disposesAllPanels", async () => {
    // Arrange
    const mockPanel = {
      webview: { html: "", onDidReceiveMessage: vi.fn(), asWebviewUri: vi.fn().mockReturnValue("") },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      onDidChangeViewState: vi.fn(),
      dispose: vi.fn(),
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(mockPanel as any);
    await manager.openEditor("flow-1");

    // Act
    manager.dispose();

    // Assert
    expect(mockPanel.dispose).toHaveBeenCalled();
  });
});
