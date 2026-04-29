// DD-01 ExtensionMain UT tests
// Trace: DD-01-002001, DD-01-002002, DD-01-002003, DD-01-002004, DD-01-002005

import { describe, it, expect, beforeEach, vi } from "vitest";
import { workspace, window, Uri, commands } from "vscode";
import { activate, deactivate } from "@extension/core/extensionMain.js";

function createMockContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
    extensionUri: Uri.file("/test/extension"),
  } as unknown as import("vscode").ExtensionContext;
}

describe("ExtensionMain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- DD-01-002001: 概要 ---

  // DDUT-01-002001-00001
  it("activate_isExportedFunction", () => {
    // Assert
    expect(typeof activate).toBe("function");
  });

  // --- DD-01-002002: クラス設計 ---

  // DDUT-01-002002-00001
  it("deactivate_isExportedFunction", () => {
    // Assert
    expect(typeof deactivate).toBe("function");
  });

  // --- DD-01-002005: エラーハンドリング ---

  // DDUT-01-002005-00001
  it("activate_noWorkspace_showsErrorMessage", () => {
    // Arrange
    (workspace as any).workspaceFolders = undefined;
    const ctx = createMockContext();

    // Act
    activate(ctx);

    // Assert
    expect(window.showErrorMessage).toHaveBeenCalledOnce();
    expect(ctx.subscriptions).toHaveLength(0);
  });

  // DDUT-01-002004-00001
  it("deactivate_isEmptyFunction", () => {
    // Arrange — nothing

    // Act
    const result = deactivate();

    // Assert
    expect(result).toBeUndefined();
  });

  // --- activate (DD-01-002003) ---

  describe("activate — Phase 1: Infrastructure (DD-01-002003)", () => {
    // DDUT-01-002003-00001
    it("should show error and return early when no workspace is open", () => {
      // Arrange
      (workspace as any).workspaceFolders = undefined;
      const ctx = createMockContext();

      // Act
      activate(ctx);

      // Assert — DD-01-002005
      expect(window.showErrorMessage).toHaveBeenCalledOnce();
      expect(ctx.subscriptions).toHaveLength(0);
    });

    // DDUT-01-002003-00002
    it("should create OutputChannel named 'FlowRunner'", () => {
      // Arrange
      (workspace as any).workspaceFolders = [{ uri: Uri.file("/workspace") }];
      const ctx = createMockContext();

      // Act
      activate(ctx);

      // Assert
      expect(window.createOutputChannel).toHaveBeenCalledWith("FlowRunner", { log: true });
    });
  });

  describe("activate — Phase 3: UI & Communication (DD-01-002003)", () => {
    // DDUT-01-002003-00003
    it("should register tree data provider for flowrunner.flowList", () => {
      // Arrange
      (workspace as any).workspaceFolders = [{ uri: Uri.file("/workspace") }];
      const ctx = createMockContext();

      // Act
      activate(ctx);

      // Assert
      expect(window.registerTreeDataProvider).toHaveBeenCalledWith(
        "flowrunner.flowList",
        expect.anything(),
      );
    });
  });

  describe("activate — Phase 4: Commands (DD-01-002003)", () => {
    // DDUT-01-002003-00004
    it("should register commands via CommandRegistry", () => {
      // Arrange
      (workspace as any).workspaceFolders = [{ uri: Uri.file("/workspace") }];
      const ctx = createMockContext();

      // Act
      activate(ctx);

      // Assert — CommandRegistry.registerAll calls vscode.commands.registerCommand
      expect(commands.registerCommand).toHaveBeenCalled();
    });
  });

  describe("activate — Phase 5: Disposable registration (DD-01-002003)", () => {
    // DDUT-01-002003-00005
    it("should push disposables to context.subscriptions", () => {
      // Arrange
      (workspace as any).workspaceFolders = [{ uri: Uri.file("/workspace") }];
      const ctx = createMockContext();

      // Act
      activate(ctx);

      // Assert — at minimum: outputChannel, commandRegistry, messageBroker, flowEditorManager
      expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(4);
    });
  });
});
