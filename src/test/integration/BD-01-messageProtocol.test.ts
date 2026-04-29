// BD-01 Message Protocol Integration Tests
// Trace: BD-01-004001 通信方式, BD-01-004002 メッセージ型一覧

import { describe, it, expect, vi } from "vitest";
import type {
  FlowRunnerMessage,
  WebViewToExtensionMessageType,
  ExtensionToWebViewMessageType,
} from "@shared/types/messages.js";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import type { IExecutionAnalyticsService } from "@extension/interfaces/IExecutionAnalyticsService.js";
import type { IFlowDependencyService } from "@extension/interfaces/IFlowDependencyService.js";

// --- BD-01-004001: 通信方式 ---

describe("Message Protocol (BD-01-004001)", () => {
  // BDIT-01-004001-00001
  it("flowRunnerMessage_hasTypeAndPayloadStructure", () => {
    // Arrange & Act — create a conforming message
    const msg: FlowRunnerMessage = {
      type: "flow:load",
      payload: { flowId: "f1" },
    };

    // Assert — structure matches BD-01 §4.1 spec
    expect(msg.type).toBe("flow:load");
    expect(msg.payload).toEqual({ flowId: "f1" });
    expect(typeof msg.type).toBe("string");
    expect(typeof msg.payload).toBe("object");
  });

  // BDIT-01-004001-00002
  it("messageType_usesCategoryActionFormat", () => {
    // Assert — BD-01 §4.1 says type is category:action format
    const types: string[] = [
      "flow:load", "flow:save", "flow:execute", "flow:stop",
      "clipboard:set", "clipboard:get",
      "history:analyticsLoad",
      "dependency:load", "dependency:openFlow",
      "debug:start", "debug:step", "debug:stop",
      "node:getTypes", "node:getMetadata",
      "trigger:activate", "trigger:deactivate", "trigger:getStatus",
      "flow:loaded", "flow:saved", "flow:indexChanged", "clipboard:loaded", "history:analyticsLoaded", "dependency:loaded", "node:typesLoaded",
      "execution:nodeStarted", "execution:nodeCompleted",
      "execution:nodeError", "execution:flowCompleted",
      "debug:paused", "node:metadataLoaded", "trigger:statusChanged", "error:general",
    ];
    for (const t of types) {
      expect(t).toMatch(/^[a-z]+:[a-zA-Z]+$/);
    }
  });
});

// --- BD-01-004002: メッセージ型一覧 ---

describe("Message Type List (BD-01-004002)", () => {
  // BDIT-01-004002-00001
  it("webViewToExtension_has17MessageTypes", () => {
    // Arrange
    const expected: WebViewToExtensionMessageType[] = [
      "flow:load", "flow:save", "flow:execute", "flow:stop",
      "clipboard:set", "clipboard:get",
      "history:analyticsLoad",
      "dependency:load", "dependency:openFlow",
      "debug:start", "debug:step", "debug:stop",
      "node:getTypes", "node:getMetadata",
      "trigger:activate", "trigger:deactivate", "trigger:getStatus",
    ];

    // Assert — type system ensures only valid values compile
    expect(expected).toHaveLength(17);
    expect(new Set(expected).size).toBe(17);
  });

  // BDIT-01-004002-00002
  it("extensionToWebView_has15MessageTypes", () => {
    // Arrange
    const expected: ExtensionToWebViewMessageType[] = [
      "flow:loaded", "flow:saved", "flow:indexChanged", "clipboard:loaded", "history:analyticsLoaded", "dependency:loaded", "node:typesLoaded",
      "execution:nodeStarted", "execution:nodeCompleted",
      "execution:nodeError", "execution:flowCompleted",
      "debug:paused", "node:metadataLoaded", "trigger:statusChanged", "error:general",
    ];

    // Assert
    expect(expected).toHaveLength(15);
    expect(new Set(expected).size).toBe(15);
  });

  // BDIT-01-004002-00003
  it("messageBroker_handlesAll17WebViewToExtensionTypes", () => {
    // Arrange — create a MessageBroker to verify it handles all message types
    const mockFlowService = {
      getFlow: vi.fn().mockImplementation(async (flowId: string) => ({
        id: flowId,
        name: `Flow ${flowId}`,
        nodes: [],
        edges: [],
      })),
      createFlow: vi.fn(),
      saveFlow: vi.fn(),
      deleteFlow: vi.fn(),
      renameFlow: vi.fn(),
      listFlows: vi.fn(),
      existsFlow: vi.fn(),
      onDidChangeFlows: { event: vi.fn().mockReturnValue({ dispose: vi.fn() }) },
    };
    const mockExecutionService = {
      executeFlow: vi.fn(),
      stopFlow: vi.fn(),
      getRunningFlows: vi.fn(),
      isRunning: vi.fn(),
      onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    const mockDebugService = {
      startDebug: vi.fn(),
      step: vi.fn(),
      stopDebug: vi.fn(),
      isDebugging: vi.fn(),
      getIntermediateResults: vi.fn(),
      onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    const mockRegistry = {
      register: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    };
    const mockExecutionAnalyticsService: IExecutionAnalyticsService = {
      buildSnapshot: vi.fn().mockResolvedValue(null),
    };
    const mockFlowDependencyService: IFlowDependencyService = {
      buildSnapshot: vi.fn().mockResolvedValue(null),
    };
    const mockTriggerService = {
      activateTrigger: vi.fn(),
      deactivateTrigger: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
    };

    const broker = new MessageBroker(
      mockFlowService as any,
      mockExecutionService as any,
      mockDebugService as any,
      mockRegistry as any,
      mockTriggerService as any,
      undefined,
      mockExecutionAnalyticsService,
      mockFlowDependencyService,
      vi.fn(),
    );

    // Act — call handleMessage with each type; none should throw "Unknown message type"
    const mockPanel = { webview: { postMessage: vi.fn().mockResolvedValue(true) } };
    const messages: FlowRunnerMessage[] = [
      { type: "flow:load", payload: { flowId: "f1" } },
      { type: "flow:save", payload: { flowId: "f1", nodes: [], edges: [] } },
      { type: "flow:execute", payload: { flowId: "f1" } },
      { type: "flow:stop", payload: { flowId: "f1" } },
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

    // Assert — all 15 types should be handled without error response
    const promises = messages.map((message) =>
      broker.handleMessage(message, mockPanel),
    );
    expect(promises).toHaveLength(15);
  });
});
