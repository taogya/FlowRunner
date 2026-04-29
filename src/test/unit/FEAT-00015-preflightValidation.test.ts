/**
 * FEAT-00015: Preflight validation unit tests
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import * as vscode from "vscode";
import { FlowValidationService } from "@extension/services/FlowValidationService.js";
import { CommandRegistry } from "@extension/core/CommandRegistry.js";
import { MessageBroker } from "@extension/services/MessageBroker.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { INodeExecutor } from "@extension/interfaces/INodeExecutor.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IFlowTreeProvider } from "@extension/interfaces/IFlowTreeProvider.js";
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";
import type {
  FlowValidationIssue,
  IFlowValidationService,
} from "@extension/interfaces/IFlowValidationService.js";
import type {
  FlowDefinition,
  NodeInstance,
  EdgeInstance,
} from "@shared/types/flow.js";
import type { INodeTypeMetadata } from "@shared/types/node.js";
import type { ValidationResult, NodeResultMap } from "@shared/types/execution.js";

function createNode(
  id: string,
  type: string,
  settings: Record<string, unknown> = {},
): NodeInstance {
  return {
    id,
    type,
    label: `${type}-${id}`,
    enabled: true,
    position: { x: 0, y: 0 },
    settings,
  };
}

function createFlow(
  nodes: NodeInstance[],
  edges: EdgeInstance[] = [],
): FlowDefinition {
  return {
    id: "flow-1",
    name: "Validation Flow",
    description: "",
    version: "1.0.0",
    nodes,
    edges,
    createdAt: "2026-04-04T00:00:00.000Z",
    updatedAt: "2026-04-04T00:00:00.000Z",
  };
}

function createExecutor(
  nodeType: string,
  outputPorts: string[],
  validate: (settings: Record<string, unknown>) => ValidationResult,
): INodeExecutor {
  const metadata: INodeTypeMetadata = {
    nodeType,
    label: nodeType,
    icon: nodeType,
    category: "test",
    inputPorts: [],
    outputPorts: outputPorts.map((portId) => ({
      id: portId,
      label: portId,
      dataType: "any",
    })),
    settingsSchema: [],
  };

  return {
    getMetadata: () => metadata,
    validate,
    execute: vi.fn(),
  } as unknown as INodeExecutor;
}

function createMockRegistry(): INodeExecutorRegistry {
  const executors = new Map<string, INodeExecutor>([
    [
      "command",
      createExecutor("command", ["stdout", "stderr"], (settings) => {
        if (!settings.command) {
          return {
            valid: false,
            errors: [{ field: "command", message: "command is required" }],
          };
        }
        return { valid: true };
      }),
    ],
    [
      "aiPrompt",
      createExecutor("aiPrompt", ["out"], (settings) => {
        if (!settings.model) {
          return {
            valid: false,
            errors: [{ field: "model", message: "model is required" }],
          };
        }
        return { valid: true };
      }),
    ],
    [
      "subFlow",
      createExecutor("subFlow", ["out"], (settings) => {
        if (!settings.flowId) {
          return {
            valid: false,
            errors: [{ field: "flowId", message: "flowId is required" }],
          };
        }
        return { valid: true };
      }),
    ],
    [
      "trigger",
      createExecutor("trigger", ["out"], () => ({ valid: true })),
    ],
    [
      "condition",
      createExecutor("condition", ["true", "false"], (settings) => {
        if (!settings.expression) {
          return {
            valid: false,
            errors: [{ field: "expression", message: "expression is required" }],
          };
        }
        return { valid: true };
      }),
    ],
    [
      "file",
      createExecutor("file", ["out"], (settings) => {
        if (!settings.operation) {
          return {
            valid: false,
            errors: [{ field: "operation", message: "operation is required" }],
          };
        }
        if (!settings.path) {
          return {
            valid: false,
            errors: [{ field: "path", message: "path is required" }],
          };
        }
        return { valid: true };
      }),
    ],
    [
      "tryCatch",
      createExecutor("tryCatch", ["try", "catch", "done"], () => ({ valid: true })),
    ],
  ]);

  return {
    register: vi.fn(),
    get: vi.fn((nodeType: string) => {
      const executor = executors.get(nodeType);
      if (!executor) {
        throw new Error(`Unknown node type: ${nodeType}`);
      }
      return executor;
    }),
    getAll: vi.fn().mockReturnValue([...executors.values()]),
    has: vi.fn((nodeType: string) => executors.has(nodeType)),
  };
}

function createMockFlowService(flow?: FlowDefinition): IFlowService {
  return {
    createFlow: vi.fn(),
    getFlow: vi.fn().mockResolvedValue(flow ?? createFlow([])),
    saveFlow: vi.fn(),
    deleteFlow: vi.fn(),
    renameFlow: vi.fn(),
    listFlows: vi.fn().mockResolvedValue([]),
    existsFlow: vi.fn().mockResolvedValue(true),
    onDidChangeFlows: { event: vi.fn() } as any,
  };
}

function createMockExecutionService(): IExecutionService {
  return {
    executeFlow: vi.fn().mockResolvedValue(undefined),
    stopFlow: vi.fn(),
    getRunningFlows: vi.fn().mockReturnValue([]),
    isRunning: vi.fn().mockReturnValue(false),
    onFlowEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockDebugService(): IDebugService {
  return {
    startDebug: vi.fn().mockResolvedValue(undefined),
    step: vi.fn().mockResolvedValue(undefined),
    stopDebug: vi.fn(),
    isDebugging: vi.fn().mockReturnValue(false),
    getIntermediateResults: vi.fn().mockReturnValue({} as NodeResultMap),
    onDebugEvent: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
}

function createMockFlowEditorManager(): IFlowEditorManager {
  return {
    openEditor: vi.fn(),
    closeEditor: vi.fn(),
    closeAllEditors: vi.fn(),
    getActiveFlowId: vi.fn().mockReturnValue("flow-1"),
    updateFlow: vi.fn(),
    postMessageToFlow: vi.fn(),
    onDidRequestSave: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestExecute: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidRequestDebug: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  };
}

function createMockFlowTreeProvider(): IFlowTreeProvider {
  return {
    refresh: vi.fn(),
    getTreeItem: vi.fn(),
    getChildren: vi.fn(),
  };
}

function createMockValidationService(
  issues: FlowValidationIssue[],
): IFlowValidationService {
  return {
    validateFlow: vi.fn().mockResolvedValue(issues),
    validateDefinition: vi.fn().mockResolvedValue(issues),
  };
}

function createMockOutputChannel(): vscode.OutputChannel {
  return {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: "FlowRunner",
    replace: vi.fn(),
  };
}

function getRegisteredHandler(commandName: string): (...args: unknown[]) => Promise<void> {
  const calls = (vscode.commands.registerCommand as Mock).mock.calls;
  const entry = calls.find((call: unknown[]) => call[0] === commandName);
  if (!entry) {
    throw new Error(`Command not found: ${commandName}`);
  }
  return entry[1] as (...args: unknown[]) => Promise<void>;
}

describe("Preflight Validation (FEAT-00015)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) =>
        args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          message,
        ),
    );
  });

  // FEAT-00015-003001-00001, FEAT-00015-003002-00001
  it("validatorReturnsStructuredHighSeverityIssues", async () => {
    // Arrange
    const flow = createFlow([
      createNode("cmd", "command", {}),
      createNode("ai", "aiPrompt", { prompt: "hello" }),
      createNode("sub", "subFlow", { flowId: "missing-flow" }),
    ]);
    const flowService = createMockFlowService(flow);
    vi.mocked(flowService.existsFlow).mockResolvedValue(false);
    const registry = createMockRegistry();
    const service = new FlowValidationService(flowService, registry);

    // Act
    const issues = await service.validateFlow("flow-1", "execute");

    // Assert
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "high",
          category: "required-setting",
          nodeId: "cmd",
          field: "command",
        }),
        expect.objectContaining({
          severity: "high",
          category: "ai-model-missing",
          nodeId: "ai",
          field: "model",
        }),
        expect.objectContaining({
          severity: "high",
          category: "unresolved-subflow",
          nodeId: "sub",
          field: "flowId",
        }),
      ]),
    );
    expect(issues.every((issue) => issue.message && issue.severity && issue.nodeId)).toBe(true);
  });

  // FEAT-00015-003002-00002
  it("validatorReturnsMediumIssuesForTriggerAndImportantPorts", async () => {
    // Arrange
    const flow = createFlow(
      [
        createNode("trigger", "trigger", { triggerType: "schedule", intervalSeconds: 3 }),
        createNode("condition", "condition", { expression: "true" }),
      ],
      [
        {
          id: "e1",
          sourceNodeId: "condition",
          sourcePortId: "true",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    );
    const service = new FlowValidationService(
      createMockFlowService(flow),
      createMockRegistry(),
    );

    // Act
    const issues = await service.validateFlow("flow-1", "execute");

    // Assert
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "medium",
          category: "trigger-configuration",
          nodeId: "trigger",
        }),
        expect.objectContaining({
          severity: "medium",
          category: "important-port-unconnected",
          nodeId: "condition",
          field: "false",
        }),
      ]),
    );
  });

  // FEAT-00015-003002-00003
  it("validatorDistinguishesDangerousEmptyAndFileConfiguration", async () => {
    // Arrange
    const flow = createFlow([
      createNode("blankPath", "file", { operation: "read", path: "   " }),
      createNode("badOperation", "file", { path: "./README.md" }),
    ]);
    const service = new FlowValidationService(
      createMockFlowService(flow),
      createMockRegistry(),
    );

    // Act
    const issues = await service.validateFlow("flow-1", "execute");

    // Assert
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "medium",
          category: "dangerous-empty",
          nodeId: "blankPath",
        }),
        expect.objectContaining({
          severity: "high",
          category: "file-configuration",
          nodeId: "badOperation",
          field: "operation",
        }),
      ]),
    );
  });

  // FEAT-00015-003003-00001
  it("highSeverityBlocksExecuteCommand", async () => {
    // Arrange
    const registry = new CommandRegistry(
      createMockFlowService(createFlow([])),
      createMockFlowEditorManager(),
      createMockExecutionService(),
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService([
        {
          severity: "high",
          category: "required-setting",
          message: "command is required",
          nodeId: "cmd",
          nodeLabel: "cmd",
        },
      ]),
    );
    registry.registerAll();

    // Act
    const handler = getRegisteredHandler("flowrunner.executeFlow");
    await handler();

    // Assert
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect((registry as unknown as { executionService: IExecutionService }).executionService.executeFlow).not.toHaveBeenCalled();
  });

  // FEAT-00015-003003-00002
  it("mediumWarningsRequireConfirmationBeforeExecute", async () => {
    // Arrange
    const executionService = createMockExecutionService();
    const validationService = createMockValidationService([
      {
        severity: "medium",
        category: "important-port-unconnected",
        message: "done port is not connected",
        nodeId: "loop",
        nodeLabel: "loop",
      },
    ]);
    vi.mocked(vscode.window.showWarningMessage)
      .mockResolvedValueOnce("Continue execution" as never)
      .mockResolvedValueOnce(undefined);

    const registry = new CommandRegistry(
      createMockFlowService(createFlow([])),
      createMockFlowEditorManager(),
      executionService,
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      createMockDebugService(),
      validationService,
    );
    registry.registerAll();
    const handler = getRegisteredHandler("flowrunner.executeFlow");

    // Act
    await handler();
    await handler();

    // Assert
    expect(executionService.executeFlow).toHaveBeenCalledTimes(1);
    expect(vi.mocked(vscode.window.showWarningMessage).mock.calls[0]).toHaveLength(3);
  });

  // FEAT-00015-003003-00003
  it("preflightDialogsUseVscodeL10nTranslations", async () => {
    // Arrange
    const translations: Record<string, string> = {
      Execution: "実行",
      Debug: "デバッグ",
      Flow: "フロー",
      high: "高",
      medium: "中",
      "Preflight warnings found.": "事前バリデーションで警告が見つかりました。",
      "Continue execution": "このまま実行する",
      "{0} blocked by preflight validation.": "事前バリデーションにより {0} を開始できません。",
      "command is required": "コマンドが未設定です",
    };
    vi.mocked(vscode.l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) => {
        const template = translations[message] ?? message;
        return args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          template,
        );
      },
    );

    const executionService = createMockExecutionService();
    const mediumValidationService = createMockValidationService([
      {
        severity: "medium",
        category: "important-port-unconnected",
        message: "False ポートが未接続です",
        nodeId: "condition",
        nodeLabel: "Condition",
      },
    ]);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce(
      "このまま実行する" as never,
    );

    const warningRegistry = new CommandRegistry(
      createMockFlowService(createFlow([])),
      createMockFlowEditorManager(),
      executionService,
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      createMockDebugService(),
      mediumValidationService,
    );
    warningRegistry.registerAll();

    // Act
    await getRegisteredHandler("flowrunner.executeFlow")();

    // Assert
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("事前バリデーションで警告が見つかりました。"),
      { modal: true },
      "このまま実行する",
    );

    // Arrange
    vi.clearAllMocks();
    vi.mocked(vscode.l10n.t).mockImplementation(
      (message: string, ...args: unknown[]) => {
        const template = translations[message] ?? message;
        return args.reduce(
          (text, value, index) => text.replace(`{${index}}`, String(value)),
          template,
        );
      },
    );

    const highRegistry = new CommandRegistry(
      createMockFlowService(createFlow([])),
      createMockFlowEditorManager(),
      createMockExecutionService(),
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      createMockDebugService(),
      createMockValidationService([
        {
          severity: "high",
          category: "required-setting",
          message: "コマンドが未設定です",
          nodeId: "cmd",
          nodeLabel: "Missing Command",
        },
      ]),
    );
    highRegistry.registerAll();

    // Act
    await getRegisteredHandler("flowrunner.executeFlow")();

    // Assert
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("事前バリデーションにより 実行 を開始できません。"),
      { modal: true },
    );
  });

  // FEAT-00015-003004-00001
  it("messageBrokerDebugStartUsesSameValidationService", async () => {
    // Arrange
    const flowService = createMockFlowService(createFlow([]));
    const executionService = createMockExecutionService();
    const debugService = createMockDebugService();
    const validationService = createMockValidationService([]);
    const broker = new MessageBroker(
      flowService,
      executionService,
      debugService,
      createMockRegistry(),
      undefined,
      validationService,
    );
    const panel = {
      webview: { postMessage: vi.fn().mockResolvedValue(true) },
    } as any;

    // Act
    await broker.handleMessage(
      { type: "debug:start", payload: { flowId: "flow-1" } } as any,
      panel,
    );

    // Assert
    expect(validationService.validateFlow).toHaveBeenCalledWith("flow-1", "debug");
    expect(debugService.startDebug).toHaveBeenCalledWith("flow-1");
  });

  // FEAT-00015-003004-00001
  it("debugCommandValidatesAndStartsDebug", async () => {
    // Arrange
    const flowService = createMockFlowService(createFlow([]));
    const editorManager = createMockFlowEditorManager();
    const debugService = createMockDebugService();
    const validationService = createMockValidationService([]);
    const registry = new CommandRegistry(
      flowService,
      editorManager,
      createMockExecutionService(),
      createMockFlowTreeProvider(),
      createMockOutputChannel(),
      debugService,
      validationService,
    );
    registry.registerAll();

    // Act
    const handler = getRegisteredHandler("flowrunner.debugFlow");
    await handler();

    // Assert
    expect(validationService.validateFlow).toHaveBeenCalledWith("flow-1", "debug");
    expect(editorManager.openEditor).toHaveBeenCalledWith("flow-1", "Validation Flow");
    expect(debugService.startDebug).toHaveBeenCalledWith("flow-1");
  });
});