// BD-04 Notification IT tests
// Trace: BD-04-005001 通知設計, BD-04-005002 通知モード切替

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationHandler } from "@extension/services/notificationHandler.js";
import * as vscode from "vscode";

function mockNotificationConfig(values: Record<string, unknown> = {}): void {
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => (
      Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : defaultValue
    )),
    update: vi.fn(),
  } as ReturnType<typeof vscode.workspace.getConfiguration>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vscode.l10n.t).mockImplementation(
    (message: string, ...args: unknown[]) =>
      args.reduce(
        (text, value, index) => text.replace(`{${index}}`, String(value)),
        message,
      ),
  );
  mockNotificationConfig();
});

// --- BD-04-005001: 通知設計 ---

describe("Notification Design (BD-04-005001)", () => {
  // BDIT-04-005001-00001
  it("success_defaultSetting_showsTimedStatusBarMessage", async () => {
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "success",
    });

    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledTimes(1);
    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining("My Flow"),
      3000,
    );
  });

  // BDIT-04-005001-00002
  it("error_defaultSetting_showsTimedStatusBarMessage", async () => {
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "error",
      error: "something went wrong",
    });

    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledTimes(1);
    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.stringContaining("My Flow"),
      3000,
    );
  });

  // BDIT-04-005001-00003
  it("cancelled_autoHideDisabled_showsWarningMessage", async () => {
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "cancelled",
    });

    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("My Flow"),
    );
  });
});

// --- BD-04-005002: 通知アクション ---

describe("Notification Actions (BD-04-005002)", () => {
  // BDIT-04-005002-00001
  it("success_autoHideDisabled_usesInformationMessage", async () => {
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "success",
    });

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Flow "My Flow" completed successfully',
    );
  });

  // BDIT-04-005002-00002
  it("error_autoHideDisabled_usesErrorMessage", async () => {
    mockNotificationConfig({ completionNotificationAutoHide: false });
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "error",
      error: "fail",
    });

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Flow "My Flow" failed with error: fail',
    );
  });

  // BDIT-04-005002-00003
  it("customDuration_changesStatusBarTimeout", async () => {
    mockNotificationConfig({ completionNotificationDurationSeconds: 7 });
    const handler = createNotificationHandler();

    await handler({
      type: "flowCompleted",
      flowId: "flow-1",
      flowName: "My Flow",
      status: "success",
    });

    expect(vscode.window.setStatusBarMessage).toHaveBeenCalledWith(
      expect.any(String),
      7000,
    );
  });
});
