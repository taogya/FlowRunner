// Trace: DD-01-005002, DD-01-005003, DD-01-005004, DD-01-005005, DD-01-005006
import { EventEmitter } from "vscode";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { IExecutionAnalyticsService } from "@extension/interfaces/IExecutionAnalyticsService.js";
import type { IFlowDependencyService } from "@extension/interfaces/IFlowDependencyService.js";
import type { IFlowValidationService } from "@extension/interfaces/IFlowValidationService.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { ITriggerService, TriggerConfig } from "@extension/interfaces/ITriggerService.js";
import { confirmFlowValidationIssues } from "@extension/services/flowValidationDialog.js";
import { localizeNodeMetadata } from "@extension/services/nodeMetadataLocalization.js";
import type { FlowRunnerMessage } from "@shared/types/messages.js";
import type { FlowEvent } from "@shared/types/events.js";
import type { DebugEvent } from "@shared/types/events.js";

// Trace: DD-01-005002
type MessageHandler = (
  payload: Record<string, unknown>,
) => Promise<FlowRunnerMessage | void>;

interface Panel {
  webview: { postMessage(message: unknown): Thenable<boolean> };
}

interface Disposable {
  dispose(): void;
}

// Trace: DD-01-005004 — payload type guards
function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid payload field: ${key}`);
  }
  return value;
}

function optionalArray(payload: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const value = payload[key];
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`Invalid payload field (expected array): ${key}`);
  }
  return value as Array<Record<string, unknown>>;
}

// Trace: FEAT-00021 — WebView をまたいで共有するクリップボード
type SharedClipboardPayload = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

const sharedClipboardEmitter = new EventEmitter<SharedClipboardPayload | null>();
let sharedClipboard: SharedClipboardPayload | null = null;

function getSharedClipboard(): SharedClipboardPayload | null {
  return sharedClipboard ? structuredClone(sharedClipboard) as SharedClipboardPayload : null;
}

function setSharedClipboard(payload: SharedClipboardPayload | null): void {
  sharedClipboard = payload ? structuredClone(payload) as SharedClipboardPayload : null;
  sharedClipboardEmitter.fire(getSharedClipboard());
}

export class MessageBroker {
  private readonly handlerMap: Map<string, MessageHandler>;
  private readonly eventDisposables: Disposable[] = [];
  private readonly flowService: IFlowService;
  private readonly executionService: IExecutionService;
  private readonly debugService: IDebugService;
  private readonly nodeExecutorRegistry: INodeExecutorRegistry;
  private readonly executionAnalyticsService?: IExecutionAnalyticsService;
  private readonly flowDependencyService?: IFlowDependencyService;
  private readonly triggerService?: ITriggerService;
  private readonly flowValidationService?: IFlowValidationService;
  private readonly openFlowEditor?: (targetFlowId: string, flowName?: string) => void;

  constructor(
    flowService: IFlowService,
    executionService: IExecutionService,
    debugService: IDebugService,
    nodeExecutorRegistry: INodeExecutorRegistry,
    triggerService?: ITriggerService,
    flowValidationService?: IFlowValidationService,
    executionAnalyticsService?: IExecutionAnalyticsService,
    flowDependencyService?: IFlowDependencyService,
    openFlowEditor?: (targetFlowId: string, flowName?: string) => void,
  ) {
    this.flowService = flowService;
    this.executionService = executionService;
    this.debugService = debugService;
    this.nodeExecutorRegistry = nodeExecutorRegistry;
    this.executionAnalyticsService = executionAnalyticsService;
    this.flowDependencyService = flowDependencyService;
    this.triggerService = triggerService;
    this.flowValidationService = flowValidationService;
    this.openFlowEditor = openFlowEditor;

    // Trace: DD-01-005003
    this.handlerMap = new Map<string, MessageHandler>([
      ["flow:load", async (payload) => {
        const flowId = requireString(payload, "flowId");
        const flow = await this.flowService.getFlow(flowId);
        return { type: "flow:loaded", payload: { flow } };
      }],
      ["flow:save", async (payload) => {
        // Trace: DD-01-005003 — FlowNode→NodeInstance / FlowEdge→EdgeInstance 変換
        const flowId = requireString(payload, "flowId");
        const flow = await this.flowService.getFlow(flowId);
        const rawNodes = optionalArray(payload, "nodes");
        const rawEdges = optionalArray(payload, "edges");
        flow.nodes = rawNodes.map((n) => {
          const data = (n.data ?? {}) as Record<string, unknown>;
          return {
            id: String(n.id),
            type: String(n.type),
            label: (data.label as string) ?? String(n.type),
            enabled: (data.enabled as boolean) ?? true,
            position: n.position as { x: number; y: number },
            settings: (data.settings as Record<string, unknown>) ?? {},
          };
        });
        flow.edges = rawEdges.map((e) => ({
          id: String(e.id),
          sourceNodeId: String(e.sourceNodeId ?? e.source),
          sourcePortId: String((e.sourcePortId ?? e.sourceHandle ?? "out") as string),
          targetNodeId: String(e.targetNodeId ?? e.target),
          targetPortId: String((e.targetPortId ?? e.targetHandle ?? "in") as string),
        }));
        await this.flowService.saveFlow(flow);
        return { type: "flow:saved", payload: {} };
      }],
      ["flow:execute", async (payload) => {
        const flowId = requireString(payload, "flowId");
        if (!(await this.canStartFlow(flowId, "execute"))) {
          return;
        }
        await this.executionService.executeFlow(flowId);
      }],
      ["flow:stop", async (payload) => {
        const flowId = requireString(payload, "flowId");
        this.executionService.stopFlow(flowId);
      }],
      // Trace: FEAT-00021 — 共有クリップボードの保存と取得
      ["clipboard:set", async (payload) => {
        setSharedClipboard({
          nodes: optionalArray(payload, "nodes"),
          edges: optionalArray(payload, "edges"),
        });
      }],
      ["clipboard:get", async () => ({
        type: "clipboard:loaded",
        payload: getSharedClipboard() ?? { nodes: [], edges: [] },
      })],
      ["history:analyticsLoad", async (payload) => {
        const flowId = requireString(payload, "flowId");
        const snapshot = this.executionAnalyticsService
          ? await this.executionAnalyticsService.buildSnapshot(flowId)
          : null;
        return {
          type: "history:analyticsLoaded",
          payload: { flowId, snapshot },
        };
      }],
      ["dependency:load", async (payload) => {
        const flowId = requireString(payload, "flowId");
        const snapshot = this.flowDependencyService
          ? await this.flowDependencyService.buildSnapshot(flowId)
          : null;
        return {
          type: "dependency:loaded",
          payload: { flowId, snapshot },
        };
      }],
      ["dependency:openFlow", async (payload) => {
        const targetFlowId = requireString(payload, "targetFlowId");
        const targetFlow = await this.flowService.getFlow(targetFlowId);
        this.openFlowEditor?.(targetFlowId, targetFlow.name);
      }],
      ["debug:start", async (payload) => {
        const flowId = requireString(payload, "flowId");
        if (!(await this.canStartFlow(flowId, "debug"))) {
          return;
        }
        await this.debugService.startDebug(flowId);
      }],
      ["debug:step", async () => {
        await this.debugService.step();
      }],
      ["debug:stop", async () => {
        this.debugService.stopDebug();
      }],
      ["node:getTypes", async () => {
        const executors = this.nodeExecutorRegistry.getAll();
        // Keep palette/canvas bootstrap deterministic; dynamic options load via node:getMetadata.
        const metadata = executors.map((executor) => localizeNodeMetadata(executor.getMetadata()));
        return { type: "node:typesLoaded", payload: { nodeTypes: metadata } };
      }],
      // Trace: REV-016 #12 — dynamic metadata for a specific node type with current settings
      ["node:getMetadata", async (payload) => {
        const nodeType = payload.nodeType as string;
        const currentSettings = (payload.settings ?? {}) as Record<string, unknown>;
        const executor = this.nodeExecutorRegistry.getAll().find(e => e.getMetadata().nodeType === nodeType);
        if (!executor) return;
        let meta;
        if (executor.getMetadataAsync) {
          meta = await executor.getMetadataAsync(currentSettings);
        } else {
          meta = executor.getMetadata();
        }
        return {
          type: "node:metadataLoaded",
          payload: { nodeType, metadata: localizeNodeMetadata(meta) },
        };
      }],
    ]);

    // Trigger handlers (registered only when triggerService is provided)
    if (this.triggerService) {
      const ts = this.triggerService;
      this.handlerMap.set("trigger:activate", async (payload) => {
        const flowId = requireString(payload, "flowId");
        const flow = await this.flowService.getFlow(flowId);
        if (!flow) return;
        const triggerNode = flow.nodes.find((n) => n.type === "trigger");
        if (!triggerNode) return;
        const config: TriggerConfig = {
          triggerType: (triggerNode.settings.triggerType as TriggerConfig["triggerType"]) ?? "manual",
          filePattern: triggerNode.settings.filePattern as string | undefined,
          debounceMs: triggerNode.settings.debounceMs as number | undefined,
          intervalSeconds: triggerNode.settings.intervalSeconds as number | undefined,
        };
        if (config.triggerType === "manual") {
          return { type: "trigger:statusChanged", payload: { active: false, reason: "manual" } };
        }
        ts.activateTrigger(flowId, config);
        return { type: "trigger:statusChanged", payload: { active: true } };
      });
      this.handlerMap.set("trigger:deactivate", async (payload) => {
        const flowId = requireString(payload, "flowId");
        ts.deactivateTrigger(flowId);
        return { type: "trigger:statusChanged", payload: { active: false } };
      });
      this.handlerMap.set("trigger:getStatus", async (payload) => {
        const flowId = requireString(payload, "flowId");
        const active = ts.isActive(flowId);
        return { type: "trigger:statusChanged", payload: { active } };
      });
    }
  }

  private async canStartFlow(
    flowId: string,
    mode: "execute" | "debug",
  ): Promise<boolean> {
    if (!this.flowValidationService) {
      return true;
    }
    const issues = await this.flowValidationService.validateFlow(flowId, mode);
    return confirmFlowValidationIssues(issues, mode);
  }

  // Trace: DD-01-005004
  async handleMessage(message: FlowRunnerMessage, panel: Panel): Promise<void> {
    const handler = this.handlerMap.get(message.type);
    if (!handler) {
      await panel.webview.postMessage({
        type: "error:general",
        payload: { message: `Unknown message type: ${message.type}` },
      });
      return;
    }
    try {
      const response = await handler(message.payload);
      if (response) {
        await panel.webview.postMessage(response);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await panel.webview.postMessage({
        type: "error:general",
        payload: { message: errorMessage },
      });
    }
  }

  // Trace: DD-01-005005
  setupEventForwarding(panel: Panel): Disposable {
    const eventTypeMap: Record<string, string> = {
      nodeStarted: "execution:nodeStarted",
      nodeCompleted: "execution:nodeCompleted",
      nodeError: "execution:nodeError",
      flowCompleted: "execution:flowCompleted",
    };

    const flowEventDisposable = this.executionService.onFlowEvent(
      (event: FlowEvent) => {
        const type = eventTypeMap[event.type];
        if (type) {
          panel.webview.postMessage({ type, payload: event });
        }
      },
    );
    this.eventDisposables.push(flowEventDisposable);

    const debugEventDisposable = this.debugService.onDebugEvent(
      (event: DebugEvent) => {
        panel.webview.postMessage({ type: "debug:paused", payload: event });
      },
    );
    this.eventDisposables.push(debugEventDisposable);

    const flowIndexDisposable = this.flowService.onDidChangeFlows.event(() => {
      void panel.webview.postMessage({ type: "flow:indexChanged", payload: {} });
    });
    this.eventDisposables.push(flowIndexDisposable);

    // Trace: FEAT-00021 — どのエディタから更新しても他の WebView に即時反映
    const clipboardDisposable = sharedClipboardEmitter.event((payload) => {
      void panel.webview.postMessage({
        type: "clipboard:loaded",
        payload: payload ?? { nodes: [], edges: [] },
      });
    });
    this.eventDisposables.push(clipboardDisposable);

    return {
      dispose: () => {
        flowEventDisposable.dispose();
        debugEventDisposable.dispose();
        flowIndexDisposable.dispose();
        clipboardDisposable.dispose();
      },
    };
  }

  // Trace: DD-01-005006
  dispose(): void {
    for (const d of this.eventDisposables) {
      d.dispose();
    }
    this.eventDisposables.length = 0;
  }
}
