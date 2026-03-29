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
        const flow = await this.flowService.getFlow(payload.flowId as string);
        return { type: "flow:loaded", payload: { flow } };
      }],
      ["flow:save", async (payload) => {
        // Trace: DD-01-005003 — FlowNode→NodeInstance / FlowEdge→EdgeInstance 変換
        const flow = await this.flowService.getFlow(payload.flowId as string);
        const rawNodes = (payload.nodes ?? []) as Array<Record<string, unknown>>;
        const rawEdges = (payload.edges ?? []) as Array<Record<string, unknown>>;
        flow.nodes = rawNodes.map((n: Record<string, unknown>) => {
          const data = (n.data ?? {}) as Record<string, unknown>;
          return {
            id: n.id as string,
            type: n.type as string,
            label: (data.label as string) ?? (n.type as string),
            enabled: (data.enabled as boolean) ?? true,
            position: n.position as { x: number; y: number },
            settings: (data.settings as Record<string, unknown>) ?? {},
          };
        });
        flow.edges = rawEdges.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          sourceNodeId: (e.sourceNodeId ?? e.source) as string,
          sourcePortId: (e.sourcePortId ?? e.sourceHandle ?? "out") as string,
          targetNodeId: (e.targetNodeId ?? e.target) as string,
          targetPortId: (e.targetPortId ?? e.targetHandle ?? "in") as string,
        }));
        await this.flowService.saveFlow(flow);
        return { type: "flow:saved", payload: {} };
      }],
      ["flow:execute", async (payload) => {
        await this.executionService.executeFlow(payload.flowId as string);
      }],
      ["flow:stop", async (payload) => {
        this.executionService.stopFlow(payload.flowId as string);
      }],
      ["debug:start", async (payload) => {
        await this.debugService.startDebug(payload.flowId as string);
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
            // Trace: BD-03-006003 - dynamically fetch model list for AIPromptExecutor
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if ("getMetadataAsync" in e && typeof (e as any).getMetadataAsync === "function") {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              return (e as any).getMetadataAsync();
            }
            return e.getMetadata();
          }),
        );
        return { type: "node:typesLoaded", payload: { nodeTypes: metadata } };
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
