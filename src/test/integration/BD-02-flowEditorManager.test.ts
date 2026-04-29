// BD-02 FlowEditorManager IT tests
// Trace: BD-02-003001 概要, BD-02-003002 IFlowEditorManager インターフェース,
//        BD-02-003003 パネルライフサイクル, BD-02-003004 WebviewPanel オプション,
//        BD-02-003005 MessageBroker 連携

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowEditorManager } from "@extension/ui/FlowEditorManager.js";
import { Uri, window } from "vscode";

function createMockWebviewPanel() {
  const disposeHandlers: (() => void)[] = [];
  return {
    webview: {
      html: "",
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      asWebviewUri: vi.fn((uri: unknown) => uri),
      cspSource: "mock-csp",
    },
    reveal: vi.fn(),
    onDidDispose: vi.fn((handler: () => void) => {
      disposeHandlers.push(handler);
      return { dispose: vi.fn() };
    }),
    onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(() => {
      disposeHandlers.forEach((h) => h());
    }),
  };
}

function createFlowEditorManager(): FlowEditorManager {
  vi.mocked(window.createWebviewPanel).mockReturnValue(
    createMockWebviewPanel() as any,
  );
  const extensionUri = Uri.file("/test-extension");
  const brokerFactory = () => ({
    handleMessage: vi.fn(),
    setupEventForwarding: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  });
  return new FlowEditorManager(extensionUri, brokerFactory);
}

describe("IFlowEditorManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BDIT-02-003002-00001
  it("openEditor_withNewFlowId_createsPanel", () => {
    const manager = createFlowEditorManager();

    expect(() => manager.openEditor("flow-1")).not.toThrow();
  });

  // BDIT-02-003002-00002
  it("openEditor_withExistingFlowId_activatesExistingPanel", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");
    expect(() => manager.openEditor("flow-1")).not.toThrow();
  });

  // BDIT-02-003002-00003
  it("closeEditor_withOpenFlowId_closesPanel", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");
    expect(() => manager.closeEditor("flow-1")).not.toThrow();
  });

  // BDIT-02-003002-00004
  it("getActiveFlowId_withNoEditor_returnsUndefined", () => {
    const manager = createFlowEditorManager();

    const activeId = manager.getActiveFlowId();

    expect(activeId).toBeUndefined();
  });

  // BDIT-02-003002-00005
  it("getActiveFlowId_withOpenEditor_returnsFlowId", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");
    const activeId = manager.getActiveFlowId();

    expect(activeId).toBe("flow-1");
  });

  // BDIT-02-003002-00006
  it("dispose_withOpenPanels_closesAll", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");
    manager.openEditor("flow-2");
    expect(() => manager.dispose()).not.toThrow();
  });
});

// --- BD-02-003001: 概要 ---

describe("FlowEditorManager Overview (BD-02-003001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BDIT-02-003001-00001
  it("manager_hasAllRequiredMethods", () => {
    const manager = createFlowEditorManager();

    expect(typeof manager.openEditor).toBe("function");
    expect(typeof manager.closeEditor).toBe("function");
    expect(typeof manager.getActiveFlowId).toBe("function");
    expect(typeof manager.dispose).toBe("function");
  });
});

// --- BD-02-003003: パネルライフサイクル ---

describe("Panel Lifecycle (BD-02-003003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BDIT-02-003003-00001
  it("openEditor_createsNewPanel", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");

    expect(window.createWebviewPanel).toHaveBeenCalled();
  });

  // BDIT-02-003003-00002
  it("closeEditor_disposesPanel", () => {
    const panel = createMockWebviewPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const mgr = new FlowEditorManager(Uri.file("/ext"), () => ({
      handleMessage: vi.fn(),
      setupEventForwarding: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    }));

    mgr.openEditor("flow-1");
    mgr.closeEditor("flow-1");

    expect(panel.dispose).toHaveBeenCalled();
  });

  // BDIT-02-003003-00003
  it("panelDispose_removesEntryFromMap", () => {
    const panel = createMockWebviewPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const mgr = new FlowEditorManager(Uri.file("/ext"), () => ({
      handleMessage: vi.fn(),
      setupEventForwarding: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    }));

    mgr.openEditor("flow-1");
    panel.dispose(); // simulate user closing the panel

    // After dispose, opening same flow should create a new panel
    mgr.openEditor("flow-1");
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });
});

// --- BD-02-003004: WebviewPanel のオプション設計 ---

describe("WebviewPanel Options (BD-02-003004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BDIT-02-003004-00001
  it("createWebviewPanel_calledWithScriptsEnabled", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");

    const callArgs = vi.mocked(window.createWebviewPanel).mock.calls[0];
    const options = callArgs[3] as { enableScripts?: boolean };
    expect(options.enableScripts).toBe(true);
  });

  // BDIT-02-003004-00002
  it("createWebviewPanel_calledWithRetainContextWhenHidden", () => {
    const manager = createFlowEditorManager();

    manager.openEditor("flow-1");

    const callArgs = vi.mocked(window.createWebviewPanel).mock.calls[0];
    const options = callArgs[3] as { retainContextWhenHidden?: boolean };
    expect(options.retainContextWhenHidden).toBe(true);
  });
});

// --- BD-02-003005: MessageBroker との連携 ---

describe("MessageBroker Integration (BD-02-003005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BDIT-02-003005-00001
  it("openEditor_setsUpMessageListener", () => {
    const panel = createMockWebviewPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const mgr = new FlowEditorManager(Uri.file("/ext"), () => ({
      handleMessage: vi.fn(),
      setupEventForwarding: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    }));

    mgr.openEditor("flow-1");

    expect(panel.webview.onDidReceiveMessage).toHaveBeenCalled();
  });

  // BDIT-02-003005-00002
  it("openEditor_callsBrokerFactoryForEachPanel", () => {
    const brokerFactory = vi.fn(() => ({
      handleMessage: vi.fn(),
      setupEventForwarding: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    }));
    const panel = createMockWebviewPanel();
    vi.mocked(window.createWebviewPanel).mockReturnValue(panel as any);
    const mgr = new FlowEditorManager(Uri.file("/ext"), brokerFactory);

    mgr.openEditor("flow-1");

    expect(brokerFactory).toHaveBeenCalled();
  });
});
