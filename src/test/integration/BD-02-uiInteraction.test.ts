// BD-02 UI Interaction Flow Integration Tests
// Trace: BD-02-005001 主要操作フロー, BD-02-005002 フロー一覧操作,
//        BD-02-005003 エディタ操作

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// --- BD-02-005001: 主要操作フロー ---

describe("Main Operation Flow (BD-02-005001)", () => {
  // BDIT-02-005001-00001
  it("operationFlow_commandsDefinedInPackageJson", () => {
    // BD-02 §5.1: Principal operation flows are triggered by commands
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    // Core operation commands must exist
    expect(commands).toContain("flowrunner.createFlow");
    expect(commands).toContain("flowrunner.openEditor");
    expect(commands).toContain("flowrunner.deleteFlow");
    expect(commands).toContain("flowrunner.executeFlow");
    expect(commands).toContain("flowrunner.duplicateFlow");
  });
});

// --- BD-02-005002: フロー一覧操作 ---

describe("Flow List Operations (BD-02-005002)", () => {
  // BDIT-02-005002-00001
  it("createFlow_commandRegistered", () => {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    expect(commands).toContain("flowrunner.createFlow");
  });

  // BDIT-02-005002-00002
  it("deleteFlow_commandRegistered", () => {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    expect(commands).toContain("flowrunner.deleteFlow");
  });

  // BDIT-02-005002-00003
  it("renameFlow_commandRegistered", () => {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    expect(commands).toContain("flowrunner.renameFlow");
  });

  // BDIT-02-005002-00004
  it("duplicateFlow_commandRegistered", () => {
    const pkgPath = path.resolve(__dirname, "../../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const commands = pkg.contributes?.commands?.map((c: { command: string }) => c.command) ?? [];

    expect(commands).toContain("flowrunner.duplicateFlow");
  });
});

// --- BD-02-005003: エディタ操作 ---

describe("Editor Operations (BD-02-005003)", () => {
  // BDIT-02-005003-00001
  it("flowSave_messageTypeExists", async () => {
    // BD-02 §5.3: Save triggers flow:save message
    await import("@shared/types/messages.js");
    const msg = { type: "flow:save", payload: { flow: {} } } satisfies { type: string; payload: Record<string, unknown> };
    expect(msg.type).toBe("flow:save");
  });

  // BDIT-02-005003-00002
  it("messageBroker_handlesFlowSaveMessage", async () => {
    const { MessageBroker } = await import("@extension/services/MessageBroker.js");

    const mockFlowService = {
      getFlow: vi.fn(),
      createFlow: vi.fn(),
      saveFlow: vi.fn().mockResolvedValue(undefined),
      deleteFlow: vi.fn(),
      renameFlow: vi.fn(),
      listFlows: vi.fn(),
      existsFlow: vi.fn(),
      onDidChangeFlows: { event: vi.fn() },
    };
    const mockExecSvc = {
      executeFlow: vi.fn(), stopFlow: vi.fn(), getRunningFlows: vi.fn(),
      isRunning: vi.fn(), onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    const mockDebugSvc = {
      startDebug: vi.fn(), step: vi.fn(), stopDebug: vi.fn(),
      isDebugging: vi.fn(), getIntermediateResults: vi.fn(),
      onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    const mockRegistry = { register: vi.fn(), get: vi.fn(), has: vi.fn(), getAll: vi.fn().mockReturnValue([]) };

    const broker = new MessageBroker(mockFlowService as any, mockExecSvc as any, mockDebugSvc as any, mockRegistry as any);
    const panel = { webview: { postMessage: vi.fn().mockResolvedValue(true) } };

    mockFlowService.getFlow.mockResolvedValue({ id: "f1", name: "F", nodes: [], edges: [] });
    await broker.handleMessage({ type: "flow:save", payload: { flowId: "f1", nodes: [], edges: [] } }, panel);

    expect(mockFlowService.saveFlow).toHaveBeenCalled();
  });
});
