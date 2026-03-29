// Trace: DD-04-002001, DD-04-002002, DD-04-002004, DD-04-002006, DD-04-002007, DD-04-002008, DD-04-002009, DD-04-003006
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { FlowEvent } from "@shared/types/events.js";
import type { NodeResult } from "@shared/types/execution.js";
import { topologicalSort, buildInputs } from "./executionHelpers.js";
import type { PortDataMap, NodeInstance, EdgeInstance } from "@shared/types/flow.js";

const MAX_SUBFLOW_DEPTH = 10;

interface FlowService {
  getFlow(flowId: string): Promise<{
    id: string;
    name: string;
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      enabled?: boolean;
      position: { x: number; y: number };
      settings: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      sourceNodeId: string;
      sourcePortId: string;
      targetNodeId: string;
      targetPortId: string;
    }>;
  }>;
}

interface OutputChannel {
  appendLine(value: string): void;
  show?(preserveFocus?: boolean): void;
  info?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

type EventHandler = (event: FlowEvent) => void;

export class ExecutionService {
  private readonly flowService: FlowService;
  private readonly executorRegistry: INodeExecutorRegistry;
  private readonly historyService: IHistoryService;
  private readonly outputChannel: OutputChannel;
  private readonly runningFlows = new Map<string, AbortController>();
  private readonly eventHandlers: EventHandler[] = [];
  // Trace: DD-04-002007
  private readonly errorPolicy = "stopOnError" as const;

  constructor(
    flowService: FlowService,
    executorRegistry: INodeExecutorRegistry,
    historyService: IHistoryService,
    outputChannel: OutputChannel,
  ) {
    this.flowService = flowService;
    this.executorRegistry = executorRegistry;
    this.historyService = historyService;
    this.outputChannel = outputChannel;
  }

  // Trace: DD-04-002004
  async executeFlow(
    flowId: string,
    options?: { depth?: number },
  ): Promise<PortDataMap | undefined> {
    // Trace: DD-04-002009
    const depth = options?.depth ?? 0;
    if (depth > MAX_SUBFLOW_DEPTH) {
      throw new Error(`SubFlow execution depth exceeded (max: ${MAX_SUBFLOW_DEPTH})`);
    }

    if (this.runningFlows.has(flowId)) {
      throw new Error("Flow is already running");
    }

    const abortController = new AbortController();
    this.runningFlows.set(flowId, abortController);

    try {
      const flow = await this.flowService.getFlow(flowId);
      if (!flow) {
        throw new Error(`Flow not found: ${flowId}`);
      }
      const sorted = topologicalSort(flow.nodes as NodeInstance[], flow.edges as EdgeInstance[]);
      const outputMap = new Map<string, PortDataMap>();
      const nodeResults: NodeResult[] = [];
      const total = sorted.length;

      // Show OutputChannel and log flow start
      this.outputChannel.show?.(true);
      this.logLine(`▶ Flow "${flow.name}" started (${total} nodes)`);

      // Trace: DD-04-003006 — track nodes already executed inside loop bodies
      const loopExecutedNodes = new Set<string>();
      // Trace: REV-012 #1 — track skipped nodes for chain-skip propagation
      const skippedNodes = new Set<string>();

      for (let i = 0; i < sorted.length; i++) {
        if (abortController.signal.aborted) {
          break;
        }

        const node = sorted[i];

        // Skip nodes already executed as part of a loop body
        if (loopExecutedNodes.has(node.id)) {
          continue;
        }

        // Trace: DD-04-002004 — disabled node handling
        if (node.enabled === false) {
          skippedNodes.add(node.id);
          continue;
        }

        // Trace: REV-012 #1 — chain-skip: skip node if ALL incoming edges originate from skipped nodes
        if (this.shouldChainSkip(node.id, flow.edges as EdgeInstance[], skippedNodes)) {
          skippedNodes.add(node.id);
          continue;
        }

        const executor = this.executorRegistry.get(node.type);

        // Validate
        const validation = executor.validate(node.settings);
        if (!validation.valid) {
          const validationMsg = `Validation failed for node ${node.id}: ${validation.errors?.map((e: { message: string }) => e.message).join(", ")}`;
          this.logError(`✖ ${validationMsg}`);
          nodeResults.push({
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label,
            status: "error",
            inputs: {},
            outputs: {},
            duration: 0,
            error: { message: validationMsg },
          });
          this.fireEvent({ type: "nodeError", flowId, nodeId: node.id });
          this.fireEvent({
            type: "flowCompleted",
            flowId,
            flowName: flow.name,
            status: "error",
            error: validationMsg,
          });
          await this.historyService.saveRecord({
            id: `${flowId}_${Date.now()}`,
            flowId,
            flowName: flow.name,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 0,
            status: "error",
            nodeResults,
          });
          return;
        }

        // Trace: DD-04-002008 — fire nodeStarted
        this.fireEvent({
          type: "nodeStarted",
          flowId,
          nodeId: node.id,
          progress: { current: i + 1, total },
        });

        this.logTrace(`  ┌ [${node.type}] "${node.label}" (${node.id}) — executing...`);

        const inputs = buildInputs(node.id, flow.edges as EdgeInstance[], outputMap);
        const context: IExecutionContext = {
          nodeId: node.id,
          settings: node.settings,
          inputs,
          flowId,
          signal: abortController.signal,
        };

        const startMs = Date.now();
        const result = await executor.execute(context);
        if (!result) break;
        const elapsed = result.duration ?? Date.now() - startMs;
        outputMap.set(node.id, result.outputs);
        this.logLine(`  └ [${node.type}] "${node.label}" (${node.id}) — ${result.status} (${elapsed}ms)`);

        // Trace: REV-012 #4 — node-type-specific log details
        this.logNodeDetails(node.type, node.id, node.settings, result);

        nodeResults.push({
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: node.label,
          status: result.status,
          inputs,
          outputs: result.outputs,
          duration: result.duration,
          error: result.error,
        });

        // Trace: DD-04-002007 — handle node error via errorPolicy
        if (result.status === "error" && this.handleNodeError(flowId, node.id, new Error(result.error?.message ?? "Node execution error"))) {
          // Trace: DD-04-002008 — fire nodeError
          this.fireEvent({
            type: "nodeError",
            flowId,
            nodeId: node.id,
          });
          this.fireEvent({
            type: "flowCompleted",
            flowId,
            flowName: flow.name,
            status: "error",
            error: result.error?.message,
          });
          this.logError(`✖ Flow "${flow.name}" failed at node "${node.label}": ${result.error?.message ?? "unknown error"}`);
          await this.historyService.saveRecord({
            id: `${flowId}_${Date.now()}`,
            flowId,
            flowName: flow.name,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 0,
            status: "error",
            nodeResults,
          });
          return;
        }

        // Trace: DD-04-002008 — fire nodeCompleted
        this.fireEvent({
          type: "nodeCompleted",
          flowId,
          nodeId: node.id,
          nodeStatus: result.status,
          nodeOutput: result.outputs,
          result: nodeResults[nodeResults.length - 1],
        });

        // Trace: DD-04-003006 — loop sub-flow iteration
        if (node.type === "loop" && result.status === "success") {
          const bodyNodeIds = this.findBodyNodes(node.id, flow.edges as EdgeInstance[], sorted);
          if (bodyNodeIds.size > 0) {
            const bodyNodes = sorted.filter(n => bodyNodeIds.has(n.id));
            const bodyData = result.outputs.body;
            const iterations = Array.isArray(bodyData) ? bodyData : bodyData != null ? [bodyData] : [];

            this.logDebug(`  ↻ Loop: ${iterations.length} iteration(s), ${bodyNodes.length} body node(s)`);

            for (let iter = 0; iter < iterations.length; iter++) {
              if (abortController.signal.aborted) break;

              // Set loop output to current iteration's body data
              outputMap.set(node.id, { body: iterations[iter] });
              this.logDebug(`  ↻ Iteration ${iter + 1}/${iterations.length}`);

              // Execute each body node
              for (const bodyNode of bodyNodes) {
                if (abortController.signal.aborted) break;
                if (bodyNode.enabled === false) continue;

                const bodyExecutor = this.executorRegistry.get(bodyNode.type);
                const bodyInputs = buildInputs(bodyNode.id, flow.edges as EdgeInstance[], outputMap);
                const bodyContext: IExecutionContext = {
                  nodeId: bodyNode.id,
                  settings: bodyNode.settings,
                  inputs: bodyInputs,
                  flowId,
                  signal: abortController.signal,
                };

                this.fireEvent({ type: "nodeStarted", flowId, nodeId: bodyNode.id, progress: { current: i + 1, total } });
                this.logTrace(`    ┌ [${bodyNode.type}] "${bodyNode.label}" (${bodyNode.id}) — executing (iter ${iter + 1})...`);

                const bodyResult = await bodyExecutor.execute(bodyContext);
                if (!bodyResult) break;
                outputMap.set(bodyNode.id, bodyResult.outputs);
                this.logDebug(`    └ [${bodyNode.type}] "${bodyNode.label}" (${bodyNode.id}) — ${bodyResult.status} (${bodyResult.duration ?? 0}ms)`);

                nodeResults.push({
                  nodeId: bodyNode.id,
                  nodeType: bodyNode.type,
                  nodeLabel: bodyNode.label,
                  status: bodyResult.status,
                  inputs: bodyInputs,
                  outputs: bodyResult.outputs,
                  duration: bodyResult.duration,
                  error: bodyResult.error,
                });

                this.fireEvent({
                  type: "nodeCompleted",
                  flowId,
                  nodeId: bodyNode.id,
                  nodeStatus: bodyResult.status,
                  nodeOutput: bodyResult.outputs,
                  result: nodeResults[nodeResults.length - 1],
                });

                if (bodyResult.status === "error" && this.handleNodeError(flowId, bodyNode.id, new Error(bodyResult.error?.message ?? "Node execution error"))) {
                  this.fireEvent({ type: "nodeError", flowId, nodeId: bodyNode.id });
                  this.fireEvent({ type: "flowCompleted", flowId, flowName: flow.name, status: "error", error: bodyResult.error?.message });
                  this.logError(`✖ Flow "${flow.name}" failed in loop body at "${bodyNode.label}" (${bodyNode.id}): ${bodyResult.error?.message ?? "unknown error"}`);
                  await this.historyService.saveRecord({
                    id: `${flowId}_${Date.now()}`, flowId, flowName: flow.name,
                    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
                    duration: 0, status: "error", nodeResults,
                  });
                  return;
                }
              }
            }

            // Restore done output for downstream done-connected nodes
            outputMap.set(node.id, { body: bodyData, done: result.outputs.done });

            // Mark body nodes so the main loop skips them
            for (const id of bodyNodeIds) {
              loopExecutedNodes.add(id);
            }
          }
        }
      }

      this.logLine(`✔ Flow "${flow.name}" completed successfully`);

      // Trace: DD-04-002008 — fire flowCompleted
      this.fireEvent({
        type: "flowCompleted",
        flowId,
        flowName: flow.name,
        status: "success",
      });

      // Save to history
      await this.historyService.saveRecord({
        id: `${flowId}_${Date.now()}`,
        flowId,
        flowName: flow.name,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
        status: "success",
        nodeResults,
      });

      // Trace: DD-04-002009 — return last executed node's output for sub-flow callers
      for (let j = sorted.length - 1; j >= 0; j--) {
        const lastOutput = outputMap.get(sorted[j].id);
        if (lastOutput !== undefined) {
          return lastOutput;
        }
      }
      return undefined;
    } catch (err) {
      if (abortController.signal.aborted) {
        this.fireEvent({
          type: "flowCompleted",
          flowId,
          status: "cancelled",
        });
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.fireEvent({
          type: "flowCompleted",
          flowId,
          status: "error",
          error: errorMessage,
        });
        throw err;
      }
    } finally {
      this.runningFlows.delete(flowId);
    }
  }

  // Trace: DD-04-002006
  stopFlow(flowId: string): void {
    const controller = this.runningFlows.get(flowId);
    if (controller) {
      controller.abort();
    }
  }

  getRunningFlows(): string[] {
    return Array.from(this.runningFlows.keys());
  }

  isRunning(flowId: string): boolean {
    return this.runningFlows.has(flowId);
  }

  onFlowEvent(handler: EventHandler): { dispose(): void } {
    this.eventHandlers.push(handler);
    return {
      dispose: () => {
        const idx = this.eventHandlers.indexOf(handler);
        if (idx >= 0) this.eventHandlers.splice(idx, 1);
      },
    };
  }

  private fireEvent(event: FlowEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  private logLine(message: string): void {
    if (typeof this.outputChannel.info === "function") {
      this.outputChannel.info(message);
    } else {
      const now = new Date();
      const ts = now.toLocaleTimeString("ja-JP", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
        + "." + String(now.getMilliseconds()).padStart(3, "0");
      this.outputChannel.appendLine(`[${ts}] ${message}`);
    }
  }

  private logTrace(message: string): void {
    const ch = this.outputChannel as { trace?: (...args: unknown[]) => void };
    if (typeof ch.trace === "function") {
      ch.trace(message);
    } else {
      this.logLine(message);
    }
  }

  private logDebug(message: string): void {
    const ch = this.outputChannel as { debug?: (...args: unknown[]) => void };
    if (typeof ch.debug === "function") {
      ch.debug(message);
    } else {
      this.logLine(message);
    }
  }

  private logError(message: string): void {
    if (typeof this.outputChannel.error === "function") {
      this.outputChannel.error(message);
    } else {
      this.logLine(message);
    }
  }

  private logWarn(message: string): void {
    if (typeof this.outputChannel.warn === "function") {
      this.outputChannel.warn(message);
    } else {
      this.logLine(message);
    }
  }

  // Trace: DD-04-002007
  private handleNodeError(_flowId: string, _nodeId: string, _error: Error): boolean {
    if (this.errorPolicy === "stopOnError") {
      return true;
    }
    return false;
  }

  // Trace: DD-04-003006 — find nodes in the loop body sub-graph
  // Returns node IDs reachable from the "body" port but NOT from the "done" port
  private findBodyNodes(
    loopNodeId: string,
    edges: EdgeInstance[],
    _sortedNodes: Array<{ id: string }>,
  ): Set<string> {
    const reachableFrom = (portId: string): Set<string> => {
      const visited = new Set<string>();
      const queue: string[] = [];
      for (const edge of edges) {
        if (edge.sourceNodeId === loopNodeId && edge.sourcePortId === portId) {
          queue.push(edge.targetNodeId);
        }
      }
      while (queue.length > 0) {
        const nid = queue.shift()!;
        if (visited.has(nid)) continue;
        visited.add(nid);
        for (const edge of edges) {
          if (edge.sourceNodeId === nid && !visited.has(edge.targetNodeId)) {
            queue.push(edge.targetNodeId);
          }
        }
      }
      return visited;
    };

    const bodyReachable = reachableFrom("body");
    const doneReachable = reachableFrom("done");

    // Body-only: reachable from body but not from done
    for (const id of doneReachable) {
      bodyReachable.delete(id);
    }
    return bodyReachable;
  }

  // Trace: REV-012 #1 — chain-skip: returns true if ALL incoming edges originate from skipped nodes
  private shouldChainSkip(
    nodeId: string,
    edges: EdgeInstance[],
    skippedNodes: Set<string>,
  ): boolean {
    const incomingEdges = edges.filter(e => e.targetNodeId === nodeId);
    if (incomingEdges.length === 0) {
      return false; // root node — never chain-skip
    }
    return incomingEdges.every(e => skippedNodes.has(e.sourceNodeId));
  }

  // Trace: REV-012 #4 — node-type-specific detailed log output
  private logNodeDetails(
    nodeType: string,
    nodeId: string,
    settings: Record<string, unknown>,
    result: { status: string; outputs: PortDataMap },
  ): void {
    if (result.status !== "success") return;

    switch (nodeType) {
      case "command": {
        const stdout = result.outputs.stdout as string | undefined;
        const stderr = result.outputs.stderr as string | undefined;
        if (stdout) {
          const preview = stdout.length > 200 ? stdout.slice(0, 200) + "..." : stdout;
          this.logDebug(`    stdout: ${preview}`);
        }
        if (stderr) {
          this.logWarn(`    stderr: ${stderr.length > 200 ? stderr.slice(0, 200) + "..." : stderr}`);
        }
        break;
      }
      case "http": {
        const status = result.outputs.status as number | undefined;
        const body = result.outputs.body as string | undefined;
        if (status !== undefined) {
          this.logDebug(`    HTTP ${status}`);
        }
        if (body) {
          const preview = body.length > 200 ? body.slice(0, 200) + "..." : body;
          this.logDebug(`    body: ${preview}`);
        }
        break;
      }
      case "transform": {
        const expression = settings.expression as string | undefined;
        const out = result.outputs.out;
        const outStr = typeof out === "string" ? out : JSON.stringify(out);
        const preview = outStr && outStr.length > 200 ? outStr.slice(0, 200) + "..." : outStr;
        if (expression) {
          this.logDebug(`    expr: ${expression}`);
        }
        if (preview) {
          this.logDebug(`    result: ${preview}`);
        }
        break;
      }
      case "file": {
        const operation = settings.operation as string | undefined;
        const filePath = settings.path as string | undefined;
        this.logDebug(`    ${operation ?? "unknown"}: ${filePath ?? "(no path)"}`);
        break;
      }
      case "condition": {
        const branch = result.outputs.true !== undefined ? "true" : "false";
        this.logDebug(`    branch: ${branch}`);
        break;
      }
      case "aiPrompt": {
        const responseText = result.outputs.out as string | undefined;
        if (responseText) {
          const preview = responseText.length > 200 ? responseText.slice(0, 200) + "..." : responseText;
          this.logDebug(`    AI (${nodeId}): ${preview}`);
        }
        const tokenUsage = result.outputs._tokenUsage as { inputTokens: number; outputTokens: number; totalTokens: number; model: string } | undefined;
        if (tokenUsage) {
          this.logDebug(`    Tokens: ⬆${tokenUsage.inputTokens} ⬇${tokenUsage.outputTokens} Σ${tokenUsage.totalTokens} (${tokenUsage.model})`);
        }
        break;
      }
      default:
        break;
    }
  }
}
