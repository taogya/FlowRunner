// DD-04 Notification UT tests
// Trace: DD-04-006001 通知ハンドラ, DD-04-006002 通知モード切替

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationHandler } from "@extension/services/notificationHandler.js";
import { window, workspace, l10n } from "vscode";

function mockNotificationConfig(values: Record<string, unknown> = {}): void {
  vi.mocked(workspace.getConfiguration).mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => (
      Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : defaultValue
    )),
    update: vi.fn(),
  } as ReturnType<typeof workspace.getConfiguration>);
}

describe("notificationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );
    mockNotificationConfig();
  });

  // DDUT-04-006001-00001
  it("successStatus_autoHideEnabled_showsStatusBarMessage", async () => {
    // Arrange
    const handler = createNotificationHandler();

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "success" });

    // Assert
    expect(window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining("My Flow"),
      3000,
    );
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  // DDUT-04-006001-00002
  it("errorStatus_autoHideEnabled_usesConfiguredDuration", async () => {
    // Arrange
    mockNotificationConfig({ completionNotificationDurationSeconds: 5 });
    const handler = createNotificationHandler();

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "error", error: "failed" });

    // Assert
    expect(window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining("failed"),
      5000,
    );
    expect(window.showErrorMessage).not.toHaveBeenCalled();
  });

  // DDUT-04-006001-00003
  it("cancelledStatus_autoHideDisabled_showsWarningMessage", async () => {
    // Arrange
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();
    (window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "cancelled" });

    // Assert
    expect(window.showWarningMessage).toHaveBeenCalled();
    expect(window.setStatusBarMessage).not.toHaveBeenCalled();
  });
});

describe("notificationMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );
    mockNotificationConfig();
  });

  // DDUT-04-006002-00001
  it("autoHideDisabled_successStatus_usesInformationMessage", async () => {
    // Arrange
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();
    (window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "success" });

    // Assert
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'Flow "My Flow" completed successfully',
    );
    expect(window.setStatusBarMessage).not.toHaveBeenCalled();
  });

  // DDUT-04-006002-00002
  it("autoHideDisabled_errorStatus_usesErrorMessage", async () => {
    // Arrange
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();
    (window.showErrorMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "error", error: "failed", errorNodeId: "node-5" });

    // Assert
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'Flow "My Flow" failed with error: failed',
    );
    expect(window.setStatusBarMessage).not.toHaveBeenCalled();
  });

  // DDUT-04-006002-00003
  it("invalidDuration_fallsBackToDefaultTimeout", async () => {
    // Arrange
    mockNotificationConfig({ completionNotificationDurationSeconds: 0 });
    const handler = createNotificationHandler();

    // Act
    await handler({ type: "flowCompleted", flowId: "flow-1", flowName: "My Flow", status: "success" });

    // Assert
    expect(window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.any(String),
      3000,
    );
  });
});
