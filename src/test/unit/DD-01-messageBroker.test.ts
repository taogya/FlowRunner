// DD-01 MessageBroker UT tests
// Trace: DD-01-005001, DD-01-005002, DD-01-005003, DD-01-005004, DD-01-005005, DD-01-005006

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IExecutionAnalyticsService } from "@extension/interfaces/IExecutionAnalyticsService.js";
import type { IFlowDependencyService } from "@extension/interfaces/IFlowDependencyService.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { FlowRunnerMessage } from "@shared";
import { l10n } from "vscode";

function createMockFlowService(): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn(),
    saveFlow: vi.fn().mockResolvedValue(undefined),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn(),
    existsFlow: vi.fn(),
    onDidChangeFlows: { event: vi.fn().mockReturnValue({ dispose: vi.fn() }) } as any,
  };
}

function createMockExecutionService(): IExecutionService {
  return {
    executeFlow: vi.fn().mockResolvedValue(undefined),
    stopFlow: vi.fn(),
    onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockDebugService(): IDebugService {
  return {
    startDebug: vi.fn().mockResolvedValue(undefined),
    step: vi.fn().mockResolvedValue(undefined),
    stopDebug: vi.fn(),
    onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockRegistry(): INodeExecutorRegistry {
  return {
    register: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    has: vi.fn(),
  };
}

function createMockExecutionAnalyticsService(): IExecutionAnalyticsService {
  return {
    buildSnapshot: vi.fn().mockResolvedValue(null),
  };
}

function createMockFlowDependencyService(): IFlowDependencyService {
  return {
    buildSnapshot: vi.fn().mockResolvedValue(null),
  };
}

function createMockTriggerService() {
  return {
    activateTrigger: vi.fn(),
    deactivateTrigger: vi.fn(),
    isActive: vi.fn().mockReturnValue(false),
  };
}

function createMockPanel() {
  return {
    webview: {
      postMessage: vi.fn().mockResolvedValue(true),
    },
    onDidDispose: vi.fn(),
  } as any;
}

describe("MessageBroker", () => {
  let flowService: IFlowService;
  let executionService: IExecutionService;
  let debugService: IDebugService;
  let executionAnalyticsService: IExecutionAnalyticsService;
  let flowDependencyService: IFlowDependencyService;
  let registry: INodeExecutorRegistry;
  let triggerService: ReturnType<typeof createMockTriggerService>;
  let openFlowEditor: ReturnType<typeof vi.fn>;
  let broker: MessageBroker;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );
    flowService = createMockFlowService();
    executionService = createMockExecutionService();
    debugService = createMockDebugService();
    executionAnalyticsService = createMockExecutionAnalyticsService();
    flowDependencyService = createMockFlowDependencyService();
    registry = createMockRegistry();
    triggerService = createMockTriggerService();
    openFlowEditor = vi.fn();
    broker = new MessageBroker(
      flowService,
      executionService,
      debugService,
      registry,
      triggerService as any,
      undefined,
      executionAnalyticsService,
      flowDependencyService,
      openFlowEditor,
    );
  });

  // --- DD-01-005001: 概要 ---

  // DDUT-01-005001-00001
  it("canBeInstantiated", () => {
    // Assert
    expect(broker).toBeDefined();
    expect(broker).toBeInstanceOf(MessageBroker);
  });

  // --- DD-01-005002: クラス設計 ---

  // DDUT-01-005002-00001
  it("hasHandleMessageAndSetupEventForwarding", () => {
    // Assert
    expect(typeof broker.handleMessage).toBe("function");
    expect(typeof broker.setupEventForwarding).toBe("function");
    expect(typeof broker.dispose).toBe("function");
  });

  // --- DD-01-005003: ハンドラ登録 ---

  // DDUT-01-005003-00001
  it("handlesAll17MessageTypes", async () => {
    // Arrange
    const panel = createMockPanel();
    vi.mocked(flowService.getFlow).mockImplementation(async (flowId: string) => ({
      id: flowId,
      name: `Flow ${flowId}`,
      nodes: [],
      edges: [],
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    } as any));
    vi.mocked(registry.getAll).mockReturnValue([]);

    const messages: FlowRunnerMessage[] = [
      { type: "flow:load", payload: { flowId: "f1" } },
      { type: "flow:save", payload: { flowId: "f1", nodes: [], edges: [] } },
      { type: "flow:execute", payload: { flowId: "f1" } },
      { type: "flow:stop", payload: { flowId: "f1" } },
      { type: "clipboard:set", payload: { nodes: [], edges: [] } },
      { type: "clipboard:get", payload: {} },
      { type: "history:analyticsLoad", payload: { flowId: "f1" } },
      { type: "dependency:load", payload: { flowId: "f1" } },
      { type: "dependency:openFlow", payload: { targetFlowId: "f2" } },
      { type: "debug:start", payload: { flowId: "f1" } },
      { type: "debug:step", payload: {} },
      { type: "debug:stop", payload: {} },
      { type: "node:getTypes", payload: {} },
      { type: "node:getMetadata", payload: { nodeType: "subFlow", settings: {} } },
      { type: "trigger:activate", payload: { flowId: "f1" } },
      { type: "trigger:deactivate", payload: { flowId: "f1" } },
      { type: "trigger:getStatus", payload: { flowId: "f1" } },
    ];

    for (const message of messages) {
      // Act
      await broker.handleMessage(message, panel);
    }

    // Assert — none of the known types should trigger error:general
    const errorCalls = vi.mocked(panel.webview.postMessage).mock.calls.filter(
      (call: any[]) => call[0]?.type === "error:general",
    );
    expect(errorCalls).toHaveLength(0);
  });

  // DDUT-01-005004-00006
  // FEAT-00021-003002-00001
  it("handleMessage_clipboardGet_returnsClipboardLoaded", async () => {
    // Arrange
    const panel = createMockPanel();

    // Act
    await broker.handleMessage(
      {
        type: "clipboard:set",
        payload: {
          nodes: [{ id: "n1", type: "command", position: { x: 0, y: 0 }, data: { label: "A" } }],
          edges: [],
        },
      } as any,
      panel,
    );
    await broker.handleMessage(
      { type: "clipboard:get", payload: {} } as any,
      panel,
    );

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "clipboard:loaded",
        payload: expect.objectContaining({
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
      }),
    );
  });

  // DDUT-01-005004-00001
  it("handleMessage_flowLoad_callsGetFlow", async () => {
    // Arrange
    const flow = { id: "f1", name: "Test" };
    vi.mocked(flowService.getFlow).mockResolvedValue(flow as any);
    const panel = createMockPanel();
    const msg: FlowRunnerMessage = {
      type: "flow:load",
      payload: { flowId: "f1" },
    } as any;

    // Act
    await broker.handleMessage(msg, panel);

    // Assert
    expect(flowService.getFlow).toHaveBeenCalledWith("f1");
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "flow:loaded" }),
    );
  });

  // DDUT-01-005004-00002
  it("handleMessage_flowSave_callsSaveFlow", async () => {
    // Arrange
    const panel = createMockPanel();
    const existingFlow = { id: "f1", name: "Test", nodes: [], edges: [], createdAt: "2024-01-01", updatedAt: "2024-01-01" };
    vi.mocked(flowService.getFlow).mockResolvedValue(existingFlow as any);
    const nodes = [
      { id: "n1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Trigger", enabled: true, settings: {} } },
    ];
    const edges = [
      { id: "e1", source: "n1", target: "n2" },
    ];
    const msg: FlowRunnerMessage = {
      type: "flow:save",
      payload: { flowId: "f1", nodes, edges },
    } as any;

    // Act
    await broker.handleMessage(msg, panel);

    // Assert
    expect(flowService.getFlow).toHaveBeenCalledWith("f1");
    expect(flowService.saveFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "f1",
        name: "Test",
        nodes: [{ id: "n1", type: "trigger", label: "Trigger", enabled: true, position: { x: 0, y: 0 }, settings: {} }],
        edges: [{ id: "e1", sourceNodeId: "n1", sourcePortId: "out", targetNodeId: "n2", targetPortId: "in" }],
      }),
    );
  });

  // DDUT-01-005004-00003
  it("handleMessage_flowExecute_callsExecuteFlow", async () => {
    // Arrange
    const panel = createMockPanel();
    const msg: FlowRunnerMessage = {
      type: "flow:execute",
      payload: { flowId: "f1" },
    } as any;

    // Act
    await broker.handleMessage(msg, panel);

    // Assert
    expect(executionService.executeFlow).toHaveBeenCalledWith("f1");
  });

  // DDUT-01-005004-00004
  it("handleMessage_unknownType_sendsError", async () => {
    // Arrange
    const panel = createMockPanel();
    const msg: FlowRunnerMessage = {
      type: "unknown:type",
      payload: {},
    } as any;

    // Act
    await broker.handleMessage(msg, panel);

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error:general" }),
    );
  });

  // FEAT-00019-003005-00003
  it("handleMessage_historyAnalyticsLoad_callsAnalyticsService", async () => {
    // Arrange
    const panel = createMockPanel();
    vi.mocked(executionAnalyticsService.buildSnapshot).mockResolvedValue({
      sampleSize: 1,
      successCount: 1,
      failureCount: 0,
      successRate: 100,
      averageDurationMs: 120,
      latestExecutedAt: "2026-04-08T10:00:00.000Z",
      unreadableCount: 0,
      recentFailures: [],
      slowestNode: null,
    });

    // Act
    await broker.handleMessage(
      { type: "history:analyticsLoad", payload: { flowId: "f1" } } as any,
      panel,
    );

    // Assert
    expect(executionAnalyticsService.buildSnapshot).toHaveBeenCalledWith("f1");
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "history:analyticsLoaded",
        payload: expect.objectContaining({ flowId: "f1" }),
      }),
    );
  });

  // FEAT-00020-003005-00002
  it("handleMessage_dependencyLoad_callsDependencyService", async () => {
    // Arrange
    const panel = createMockPanel();
    vi.mocked(flowDependencyService.buildSnapshot).mockResolvedValue({
      flowId: "f1",
      flowName: "Main Flow",
      outgoing: [],
      incoming: [],
      warnings: [],
    });

    // Act
    await broker.handleMessage(
      { type: "dependency:load", payload: { flowId: "f1" } } as any,
      panel,
    );

    // Assert
    expect(flowDependencyService.buildSnapshot).toHaveBeenCalledWith("f1");
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dependency:loaded",
        payload: expect.objectContaining({ flowId: "f1" }),
      }),
    );
  });

  // FEAT-00020-003004-00002
  it("handleMessage_dependencyOpenFlow_callsOpenFlowEditor", async () => {
    // Arrange
    const panel = createMockPanel();
    vi.mocked(flowService.getFlow).mockResolvedValue({
      id: "f2",
      name: "Child Flow",
      nodes: [],
      edges: [],
      createdAt: "2026-04-08T00:00:00.000Z",
      updatedAt: "2026-04-08T00:00:00.000Z",
    } as any);

    // Act
    await broker.handleMessage(
      { type: "dependency:openFlow", payload: { targetFlowId: "f2" } } as any,
      panel,
    );

    // Assert
    expect(openFlowEditor).toHaveBeenCalledWith("f2", "Child Flow");
  });

  // DDUT-01-005004-00005
  it("handleMessage_handlerThrows_sendsError", async () => {
    // Arrange
    vi.mocked(flowService.getFlow).mockRejectedValue(
      new Error("Load failed"),
    );
    const panel = createMockPanel();
    const msg: FlowRunnerMessage = {
      type: "flow:load",
      payload: { flowId: "f1" },
    } as any;

    // Act
    await broker.handleMessage(msg, panel);

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error:general" }),
    );
  });

  // DDUT-01-005005-00001
  it("setupEventForwarding_forwardsExecutionEvent", () => {
    // Arrange
    const panel = createMockPanel();
    let eventCallback: (...args: unknown[]) => void = () => {};
    vi.mocked(executionService.onFlowEvent).mockImplementation(
      (cb: (...args: unknown[]) => void) => {
        eventCallback = cb;
        return { dispose: vi.fn() };
      },
    );

    // Re-create broker so it picks up the new mock
    broker = new MessageBroker(
      flowService,
      executionService,
      debugService,
      registry,
      triggerService as any,
      undefined,
      executionAnalyticsService,
      flowDependencyService,
      openFlowEditor,
    );

    // Act
    broker.setupEventForwarding(panel);
    eventCallback({ type: "nodeStarted", nodeId: "n1" });

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "execution:nodeStarted" }),
    );
  });

  // DDUT-01-005006-00001
  it("dispose_cleansUpEventDisposables", () => {
    // Arrange — broker created in beforeEach

    // Act
    broker.dispose();

    // Assert — should not throw
    expect(() => broker.dispose()).not.toThrow();
  });

  // FEAT-00020-003005-00003
  it("setupEventForwarding_flowIndexChange_sendsFlowIndexChanged", () => {
    // Arrange
    const panel = createMockPanel();
    let flowIndexChanged: (() => void) | undefined;
    (flowService.onDidChangeFlows.event as ReturnType<typeof vi.fn>).mockImplementation(
      (handler: () => void) => {
        flowIndexChanged = handler;
        return { dispose: vi.fn() };
      },
    );

    // Act
    broker.setupEventForwarding(panel);
    flowIndexChanged?.();

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "flow:indexChanged" }),
    );
  });

  // --- FEAT-00011-002005: node:getMetadata handler ---

  // FEAT-00011-002005-00001 — executor with getMetadataAsync
  it("nodeGetMetadata_executorWithAsync_callsGetMetadataAsync", async () => {
    // Arrange
    const panel = createMockPanel();
    const asyncMeta = { nodeType: "subFlow", label: "Dynamic", settingsSchema: [] };
    const mockExecutor = {
      getMetadata: vi.fn().mockReturnValue({ nodeType: "subFlow", label: "Static", settingsSchema: [] }),
      getMetadataAsync: vi.fn().mockResolvedValue(asyncMeta),
    };
    vi.mocked(registry.getAll).mockReturnValue([mockExecutor as any]);

    // Act
    await broker.handleMessage(
      { type: "node:getMetadata", payload: { nodeType: "subFlow", settings: { flowId: "f1" } } } as any,
      panel,
    );

    // Assert
    expect(mockExecutor.getMetadataAsync).toHaveBeenCalledWith({ flowId: "f1" });
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "node:metadataLoaded",
        payload: expect.objectContaining({
          nodeType: "subFlow",
          metadata: expect.objectContaining(asyncMeta),
        }),
      }),
    );
  });

  // FEAT-00011-002005-00002 — executor without getMetadataAsync
  it("nodeGetMetadata_executorWithoutAsync_callsGetMetadata", async () => {
    // Arrange
    const panel = createMockPanel();
    const staticMeta = { nodeType: "command", label: "Command", settingsSchema: [] };
    const mockExecutor = {
      getMetadata: vi.fn().mockReturnValue(staticMeta),
      // no getMetadataAsync
    };
    vi.mocked(registry.getAll).mockReturnValue([mockExecutor as any]);

    // Act
    await broker.handleMessage(
      { type: "node:getMetadata", payload: { nodeType: "command", settings: {} } } as any,
      panel,
    );

    // Assert
    expect(mockExecutor.getMetadata).toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "node:metadataLoaded",
        payload: expect.objectContaining({
          nodeType: "command",
          metadata: expect.objectContaining(staticMeta),
        }),
      }),
    );
  });

  // FEAT-00011-002005-00003 — executor not found
  it("nodeGetMetadata_executorNotFound_noPostMessage", async () => {
    // Arrange
    const panel = createMockPanel();
    vi.mocked(registry.getAll).mockReturnValue([]);

    // Act
    await broker.handleMessage(
      { type: "node:getMetadata", payload: { nodeType: "nonexistent", settings: {} } } as any,
      panel,
    );

    // Assert — no response should be sent
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
  });

  // DDUT-01-005003-00007
  it("nodeGetTypes_localizesUserVisibleMetadataBeforePosting", async () => {
    // Arrange
    vi.mocked(l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        `localized:${args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        )}`,
    );
    const panel = createMockPanel();
    const metadata = {
      nodeType: "command",
      label: "コマンド実行",
      icon: "command",
      category: "基本",
      inputPorts: [{ id: "in", label: "入力", dataType: "any" }],
      outputPorts: [{ id: "stdout", label: "標準出力", dataType: "string" }],
      settingsSchema: [
        {
          key: "command",
          label: "コマンド",
          type: "text",
          required: true,
          placeholder: "入力: {{input}}",
          description: "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能",
        },
        {
          key: "custom",
          label: "Custom Label",
          type: "text",
          required: false,
        },
      ],
    };
    const mockExecutor = {
      getMetadata: vi.fn().mockReturnValue(metadata),
    };
    vi.mocked(registry.getAll).mockReturnValue([mockExecutor as any]);

    // Act
    await broker.handleMessage(
      { type: "node:getTypes", payload: {} } as any,
      panel,
    );

    // Assert
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "node:typesLoaded",
        payload: {
          nodeTypes: [
            expect.objectContaining({
              label: "localized:Command Node",
              category: "localized:Basic",
              inputPorts: [
                expect.objectContaining({ label: "localized:Input" }),
              ],
              outputPorts: [
                expect.objectContaining({ label: "localized:stdout" }),
              ],
              settingsSchema: [
                expect.objectContaining({
                  label: "localized:Command",
                  placeholder: "localized:Input: {{input}}",
                  description: "localized:Templates {{input}}, {{input.xxx}}, and {{vars.xxx}} are supported",
                }),
                expect.objectContaining({ label: "Custom Label" }),
              ],
            }),
          ],
        },
      }),
    );
  });

  // DDUT-01-005003-00008
  it("nodeGetTypes_executorWithAsync_usesStaticMetadataOnly", async () => {
    // Arrange
    const panel = createMockPanel();
    const staticMeta = {
      nodeType: "aiPrompt",
      label: "AI Prompt",
      icon: "aiPrompt",
      category: "Other",
      inputPorts: [{ id: "in", label: "Input", dataType: "any" }],
      outputPorts: [{ id: "out", label: "Output", dataType: "string" }],
      settingsSchema: [],
    };
    const dynamicMeta = {
      ...staticMeta,
      label: "Dynamic AI Prompt",
    };
    const mockExecutor = {
      getMetadata: vi.fn().mockReturnValue(staticMeta),
      getMetadataAsync: vi.fn().mockResolvedValue(dynamicMeta),
    };
    vi.mocked(registry.getAll).mockReturnValue([mockExecutor as any]);

    // Act
    await broker.handleMessage(
      { type: "node:getTypes", payload: {} } as any,
      panel,
    );

    // Assert
    expect(mockExecutor.getMetadata).toHaveBeenCalledTimes(1);
    expect(mockExecutor.getMetadataAsync).not.toHaveBeenCalled();
    expect(panel.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "node:typesLoaded",
        payload: {
          nodeTypes: [
            expect.objectContaining({ label: "AI Prompt" }),
          ],
        },
      }),
    );
  });

  // --- Trigger handler tests ---

  describe("trigger handlers", () => {
    function createMockTriggerService() {
      return {
        activateTrigger: vi.fn(),
        deactivateTrigger: vi.fn(),
        deactivateAll: vi.fn(),
        getActiveTriggers: vi.fn().mockReturnValue([]),
        isActive: vi.fn().mockReturnValue(false),
        dispose: vi.fn(),
      };
    }

    // DDUT-01-005003-00002
    it("triggerActivate_scheduleType_returnsStatusActive", async () => {
      // Arrange
      const triggerService = createMockTriggerService();
      const brokerWithTrigger = new MessageBroker(
        flowService,
        executionService,
        debugService,
        registry,
        triggerService,
      );
      const panel = createMockPanel();
      const flow = {
        id: "f1",
        nodes: [{ id: "t1", type: "trigger", settings: { triggerType: "schedule", intervalSeconds: 10 } }],
        edges: [],
      };
      vi.mocked(flowService.getFlow).mockResolvedValue(flow as any);

      // Act
      await brokerWithTrigger.handleMessage(
        { type: "trigger:activate", payload: { flowId: "f1" } } as any,
        panel,
      );

      // Assert
      expect(triggerService.activateTrigger).toHaveBeenCalledWith("f1", expect.objectContaining({
        triggerType: "schedule",
        intervalSeconds: 10,
      }));
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trigger:statusChanged",
          payload: { active: true },
        }),
      );
    });

    // DDUT-01-005003-00003
    it("triggerActivate_manualType_returnsStatusFalse", async () => {
      // Arrange
      const triggerService = createMockTriggerService();
      const brokerWithTrigger = new MessageBroker(
        flowService,
        executionService,
        debugService,
        registry,
        triggerService,
      );
      const panel = createMockPanel();
      const flow = {
        id: "f1",
        nodes: [{ id: "t1", type: "trigger", settings: { triggerType: "manual" } }],
        edges: [],
      };
      vi.mocked(flowService.getFlow).mockResolvedValue(flow as any);

      // Act
      await brokerWithTrigger.handleMessage(
        { type: "trigger:activate", payload: { flowId: "f1" } } as any,
        panel,
      );

      // Assert — manual trigger should not activate
      expect(triggerService.activateTrigger).not.toHaveBeenCalled();
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trigger:statusChanged",
          payload: { active: false, reason: "manual" },
        }),
      );
    });

    // DDUT-01-005003-00004
    it("triggerDeactivate_callsDeactivateAndReturnsInactive", async () => {
      // Arrange
      const triggerService = createMockTriggerService();
      const brokerWithTrigger = new MessageBroker(
        flowService,
        executionService,
        debugService,
        registry,
        triggerService,
      );
      const panel = createMockPanel();

      // Act
      await brokerWithTrigger.handleMessage(
        { type: "trigger:deactivate", payload: { flowId: "f1" } } as any,
        panel,
      );

      // Assert
      expect(triggerService.deactivateTrigger).toHaveBeenCalledWith("f1");
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trigger:statusChanged",
          payload: { active: false },
        }),
      );
    });

    // DDUT-01-005003-00005
    it("triggerGetStatus_returnsCurrentActiveState", async () => {
      // Arrange
      const triggerService = createMockTriggerService();
      triggerService.isActive.mockReturnValue(true);
      const brokerWithTrigger = new MessageBroker(
        flowService,
        executionService,
        debugService,
        registry,
        triggerService,
      );
      const panel = createMockPanel();

      // Act
      await brokerWithTrigger.handleMessage(
        { type: "trigger:getStatus", payload: { flowId: "f1" } } as any,
        panel,
      );

      // Assert
      expect(triggerService.isActive).toHaveBeenCalledWith("f1");
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "trigger:statusChanged",
          payload: { active: true },
        }),
      );
    });

    // DDUT-01-005003-00006
    it("noTriggerService_triggerMessagesReturnError", async () => {
      // Arrange
      const brokerWithoutTrigger = new MessageBroker(
        flowService,
        executionService,
        debugService,
        registry,
        undefined,
        undefined,
        executionAnalyticsService,
        flowDependencyService,
        openFlowEditor,
      );
      const panel = createMockPanel();

      // Act
      await brokerWithoutTrigger.handleMessage(
        { type: "trigger:activate", payload: { flowId: "f1" } } as any,
        panel,
      );

      // Assert — unknown message type → error:general
      expect(panel.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error:general" }),
      );
    });
  });
});
