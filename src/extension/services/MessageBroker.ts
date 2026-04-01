// Trace: DD-01-005002, DD-01-005003, DD-01-005004, DD-01-005005, DD-01-005006
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { IExecutionService } from "@extension/interfaces/IExecutionService.js";
import type { IDebugService } from "@extension/interfaces/IDebugService.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
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

export class MessageBroker {
  private readonly handlerMap: Map<string, MessageHandler>;
  private readonly eventDisposables: Disposable[] = [];
  private readonly flowService: IFlowService;
  private readonly executionService: IExecutionService;
  private readonly debugService: IDebugService;
  private readonly nodeExecutorRegistry: INodeExecutorRegistry;

  constructor(
    flowService: IFlowService,
    executionService: IExecutionService,
    debugService: IDebugService,
    nodeExecutorRegistry: INodeExecutorRegistry,
  ) {
    this.flowService = flowService;
    this.executionService = executionService;
    this.debugService = debugService;
    this.nodeExecutorRegistry = nodeExecutorRegistry;

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
        await this.executionService.executeFlow(flowId);
      }],
      ["flow:stop", async (payload) => {
        const flowId = requireString(payload, "flowId");
        this.executionService.stopFlow(flowId);
      }],
      ["debug:start", async (payload) => {
        const flowId = requireString(payload, "flowId");
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
        const metadata = await Promise.all(
          executors.map(async (e) => {
            // Trace: BD-03-006003, DD-03-002003 — use optional interface method
            if (e.getMetadataAsync) {
              return e.getMetadataAsync();
            }
            return e.getMetadata();
          }),
        );
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
        return { type: "node:metadataLoaded", payload: { nodeType, metadata: meta } };
      }],
    ]);
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

    return {
      dispose: () => {
        flowEventDisposable.dispose();
        debugEventDisposable.dispose();
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
