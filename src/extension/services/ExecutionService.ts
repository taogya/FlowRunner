// Trace: DD-04-002001, DD-04-002002, DD-04-002004, DD-04-002006, DD-04-002007, DD-04-002008, DD-04-002009, DD-04-003006
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";
import type { INodeExecutorRegistry } from "@extension/interfaces/INodeExecutorRegistry.js";
import type { IHistoryService } from "@extension/interfaces/IHistoryService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type { FlowEvent } from "@shared/types/events.js";
import type { NodeResult } from "@shared/types/execution.js";
import { topologicalSort, buildInputs, findBodyNodes, findTryCatchNodes, findParallelBranches } from "./executionHelpers.js";
import type { PortDataMap, NodeInstance, EdgeInstance } from "@shared/types/flow.js";
import { VariableStore } from "@extension/interfaces/IVariableStore.js";

const MAX_SUBFLOW_DEPTH = 10;

interface OutputChannel {
  appendLine(value: string): void;
  show?(preserveFocus?: boolean): void;
  info?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

type EventHandler = (event: FlowEvent) => void;

export class ExecutionService {
  private readonly flowService: IFlowService;
  private readonly executorRegistry: INodeExecutorRegistry;
  private readonly historyService: IHistoryService;
  private readonly outputChannel: OutputChannel;
  private readonly runningFlows = new Map<string, AbortController>();
  private readonly eventHandlers: EventHandler[] = [];
  // Trace: DD-04-002007
  private readonly errorPolicy = "stopOnError" as const;

  constructor(
    flowService: IFlowService,
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
    options?: { depth?: number; triggerData?: Record<string, unknown>; outputNodeId?: string },
  ): Promise<PortDataMap | undefined> {
    // Trace: DD-04-002009
    const depth = options?.depth ?? 0;
    const triggerData = options?.triggerData;
    const outputNodeId = options?.outputNodeId;
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
      const sorted = topologicalSort(flow.nodes, flow.edges);
      const outputMap = new Map<string, PortDataMap>();
      const nodeResults: NodeResult[] = [];
      const total = sorted.length;

      // Trace: FEAT-00002-003003 — create shared variable store for this execution
      const variableStore = new VariableStore();

      // Show OutputChannel and log flow start
      this.outputChannel.show?.(true);
      this.logLine(`▶ Flow "${flow.name}" started (${total} nodes)`);

      // Trace: DD-04-003006 — track nodes already executed inside loop/tryCatch bodies
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
        if (this.shouldChainSkip(node.id, flow.edges, skippedNodes)) {
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
          this.fireEvent({ type: "nodeError", flowId, nodeId: node.id, result: nodeResults[nodeResults.length - 1] });
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

        const inputs = buildInputs(node.id, flow.edges, outputMap);
        const context: IExecutionContext = {
          nodeId: node.id,
          nodeLabel: node.label,
          settings: node.settings,
          inputs,
          flowId,
          signal: abortController.signal,
          // Trace: FEAT-00001-003008
          ...(node.type === "trigger" && triggerData ? { triggerData } : {}),
          // Trace: FEAT-00002-003003
          variables: variableStore,
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
            result: nodeResults[nodeResults.length - 1],
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
          const loopResult = await this.executeLoopBody({
            loopNode: node,
            loopResult: result,
            flowId,
            flowName: flow.name,
            edges: flow.edges,
            sortedNodes: sorted,
            outputMap,
            nodeResults,
            abortController,
            progressIndex: i,
            progressTotal: total,
            variableStore,
          });
          if (loopResult === "error") {
            return;
          }
          if (loopResult) {
            for (const id of loopResult) {
              loopExecutedNodes.add(id);
            }
          }
        }

        // Trace: FEAT-00006-003003 — tryCatch sub-graph execution
        if (node.type === "tryCatch" && result.status === "success") {
          const tryCatchResult = await this.executeTryCatch({
            tryCatchNode: node,
            flowId,
            flowName: flow.name,
            edges: flow.edges,
            sortedNodes: sorted,
            outputMap,
            nodeResults,
            abortController,
            variableStore,
          });
          if (tryCatchResult) {
            for (const id of tryCatchResult) {
              loopExecutedNodes.add(id);
            }
          }
        }

        // Trace: FEAT-00007-003003 — parallel sub-graph execution
        if (node.type === "parallel" && result.status === "success") {
          const parallelResult = await this.executeParallel({
            parallelNode: node,
            flowId,
            flowName: flow.name,
            edges: flow.edges,
            sortedNodes: sorted,
            outputMap,
            nodeResults,
            abortController,
            variableStore,
          });
          if (parallelResult) {
            for (const id of parallelResult) {
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

      // Trace: DD-04-002009, REV-016 #12 — return specified or last executed node's output
      if (outputNodeId) {
        return outputMap.get(outputNodeId);
      }
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

  // Trace: DD-04-003006 — extracted loop body execution logic
  private async executeLoopBody(params: {
    loopNode: NodeInstance;
    loopResult: { outputs: PortDataMap };
    flowId: string;
    flowName: string;
    edges: EdgeInstance[];
    sortedNodes: NodeInstance[];
    outputMap: Map<string, PortDataMap>;
    nodeResults: NodeResult[];
    abortController: AbortController;
    progressIndex: number;
    progressTotal: number;
    variableStore: VariableStore;
  }): Promise<Set<string> | "error" | null> {
    const { loopNode, loopResult, flowId, flowName, edges, sortedNodes, outputMap, nodeResults, abortController, progressIndex, progressTotal, variableStore } = params;
    const bodyNodeIds = findBodyNodes(loopNode.id, edges);
    if (bodyNodeIds.size === 0) {
      return null;
    }

    const bodyNodes = sortedNodes.filter(n => bodyNodeIds.has(n.id));
    const bodyData = loopResult.outputs.body;
    const iterations = Array.isArray(bodyData) ? bodyData : bodyData != null ? [bodyData] : [];

    this.logDebug(`  ↻ Loop: ${iterations.length} iteration(s), ${bodyNodes.length} body node(s)`);

    for (let iter = 0; iter < iterations.length; iter++) {
      if (abortController.signal.aborted) break;

      outputMap.set(loopNode.id, { body: iterations[iter] });
      this.logDebug(`  ↻ Iteration ${iter + 1}/${iterations.length}`);

      for (const bodyNode of bodyNodes) {
        if (abortController.signal.aborted) break;
        if (bodyNode.enabled === false) continue;

        const bodyExecutor = this.executorRegistry.get(bodyNode.type);
        const bodyInputs = buildInputs(bodyNode.id, edges, outputMap);
        const bodyContext: IExecutionContext = {
          nodeId: bodyNode.id,
          nodeLabel: bodyNode.label,
          settings: bodyNode.settings,
          inputs: bodyInputs,
          flowId,
          signal: abortController.signal,
          // Trace: FEAT-00002-003003
          variables: variableStore,
        };

        this.fireEvent({ type: "nodeStarted", flowId, nodeId: bodyNode.id, progress: { current: progressIndex + 1, total: progressTotal } });
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
          this.fireEvent({ type: "nodeError", flowId, nodeId: bodyNode.id, result: nodeResults[nodeResults.length - 1] });
          this.fireEvent({ type: "flowCompleted", flowId, flowName, status: "error", error: bodyResult.error?.message });
          this.logError(`✖ Flow "${flowName}" failed in loop body at "${bodyNode.label}" (${bodyNode.id}): ${bodyResult.error?.message ?? "unknown error"}`);
          await this.historyService.saveRecord({
            id: `${flowId}_${Date.now()}`, flowId, flowName,
            startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
            duration: 0, status: "error", nodeResults,
          });
          return "error";
        }
      }
    }

    // Restore done output for downstream done-connected nodes
    outputMap.set(loopNode.id, { body: bodyData, done: loopResult.outputs.done });

    return bodyNodeIds;
  }

  // Trace: FEAT-00006-003003 — tryCatch sub-graph execution
  private async executeTryCatch(params: {
    tryCatchNode: NodeInstance;
    flowId: string;
    flowName: string;
    edges: EdgeInstance[];
    sortedNodes: NodeInstance[];
    outputMap: Map<string, PortDataMap>;
    nodeResults: NodeResult[];
    abortController: AbortController;
    variableStore: VariableStore;
  }): Promise<Set<string> | null> {
    const { tryCatchNode, flowId, edges, sortedNodes, outputMap, nodeResults, abortController, variableStore } = params;
    const { tryNodes, catchNodes } = findTryCatchNodes(tryCatchNode.id, edges);

    const allNodes = new Set([...tryNodes, ...catchNodes]);
    if (allNodes.size === 0) return null;

    const tryBodyNodes = sortedNodes.filter(n => tryNodes.has(n.id));
    const catchBodyNodes = sortedNodes.filter(n => catchNodes.has(n.id));

    this.logDebug(`  ⚡ TryCatch: ${tryBodyNodes.length} try node(s), ${catchBodyNodes.length} catch node(s)`);

    // Execute try body
    let tryError: string | undefined;
    for (const bodyNode of tryBodyNodes) {
      if (abortController.signal.aborted) break;
      if (bodyNode.enabled === false) continue;

      const executor = this.executorRegistry.get(bodyNode.type);
      const inputs = buildInputs(bodyNode.id, edges, outputMap);
      const context: IExecutionContext = {
        nodeId: bodyNode.id,
        nodeLabel: bodyNode.label,
        settings: bodyNode.settings,
        inputs,
        flowId,
        signal: abortController.signal,
        variables: variableStore,
      };

      this.fireEvent({ type: "nodeStarted", flowId, nodeId: bodyNode.id });
      const result = await executor.execute(context);
      if (!result) break;
      outputMap.set(bodyNode.id, result.outputs);

      nodeResults.push({
        nodeId: bodyNode.id,
        nodeType: bodyNode.type,
        nodeLabel: bodyNode.label,
        status: result.status,
        inputs,
        outputs: result.outputs,
        duration: result.duration,
        error: result.error,
      });

      this.fireEvent({
        type: "nodeCompleted", flowId, nodeId: bodyNode.id,
        nodeStatus: result.status, nodeOutput: result.outputs,
        result: nodeResults[nodeResults.length - 1],
      });

      if (result.status === "error") {
        tryError = result.error?.message ?? "Unknown error";
        this.logDebug(`  ⚡ TryCatch: try failed at "${bodyNode.label}" — entering catch`);
        break;
      }
    }

    // Execute catch body if try failed
    if (tryError && catchBodyNodes.length > 0) {
      // Provide error info to catch path via the tryCatch node's catch output
      outputMap.set(tryCatchNode.id, {
        ...outputMap.get(tryCatchNode.id),
        catch: { error: tryError },
      });

      for (const catchNode of catchBodyNodes) {
        if (abortController.signal.aborted) break;
        if (catchNode.enabled === false) continue;

        const executor = this.executorRegistry.get(catchNode.type);
        const inputs = buildInputs(catchNode.id, edges, outputMap);
        const context: IExecutionContext = {
          nodeId: catchNode.id,
          nodeLabel: catchNode.label,
          settings: catchNode.settings,
          inputs,
          flowId,
          signal: abortController.signal,
          variables: variableStore,
        };

        this.fireEvent({ type: "nodeStarted", flowId, nodeId: catchNode.id });
        const result = await executor.execute(context);
        if (!result) break;
        outputMap.set(catchNode.id, result.outputs);

        nodeResults.push({
          nodeId: catchNode.id,
          nodeType: catchNode.type,
          nodeLabel: catchNode.label,
          status: result.status,
          inputs,
          outputs: result.outputs,
          duration: result.duration,
          error: result.error,
        });

        this.fireEvent({
          type: "nodeCompleted", flowId, nodeId: catchNode.id,
          nodeStatus: result.status, nodeOutput: result.outputs,
          result: nodeResults[nodeResults.length - 1],
        });

        if (result.status === "error") {
          this.logDebug(`  ⚡ TryCatch: catch also failed at "${catchNode.label}"`);
          break;
        }
      }
    }

    // Update done output
    outputMap.set(tryCatchNode.id, {
      ...outputMap.get(tryCatchNode.id),
      done: tryError ? { error: tryError, handled: true } : outputMap.get(tryCatchNode.id)?.try,
    });

    return allNodes;
  }

  // Trace: FEAT-00007-003003 — parallel sub-graph execution
  private async executeParallel(params: {
    parallelNode: NodeInstance;
    flowId: string;
    flowName: string;
    edges: EdgeInstance[];
    sortedNodes: NodeInstance[];
    outputMap: Map<string, PortDataMap>;
    nodeResults: NodeResult[];
    abortController: AbortController;
    variableStore: VariableStore;
  }): Promise<Set<string> | null> {
    const { parallelNode, flowId, edges, sortedNodes, outputMap, nodeResults, abortController, variableStore } = params;
    const branchMap = findParallelBranches(parallelNode.id, edges);

    const allBranchNodeIds = new Set<string>();
    for (const nodeIds of branchMap.values()) {
      for (const id of nodeIds) {
        allBranchNodeIds.add(id);
      }
    }
    if (allBranchNodeIds.size === 0) return null;

    const branchEntries = Array.from(branchMap.entries());
    this.logDebug(`  ∥ Parallel: ${branchEntries.length} branch(es), ${allBranchNodeIds.size} total node(s)`);

    // Execute all branches concurrently with Promise.all
    const branchResults = await Promise.all(
      branchEntries.map(async ([branchPort, branchNodeIds]) => {
        const branchNodes = sortedNodes.filter(n => branchNodeIds.has(n.id));
        const branchOutputMap = new Map(outputMap);
        const branchNodeResults: NodeResult[] = [];

        for (const bodyNode of branchNodes) {
          if (abortController.signal.aborted) break;
          if (bodyNode.enabled === false) continue;

          const executor = this.executorRegistry.get(bodyNode.type);
          const inputs = buildInputs(bodyNode.id, edges, branchOutputMap);
          const context: IExecutionContext = {
            nodeId: bodyNode.id,
            nodeLabel: bodyNode.label,
            settings: bodyNode.settings,
            inputs,
            flowId,
            signal: abortController.signal,
            variables: variableStore,
          };

          this.fireEvent({ type: "nodeStarted", flowId, nodeId: bodyNode.id });
          this.logTrace(`    ┌ [${bodyNode.type}] "${bodyNode.label}" (${bodyNode.id}) — executing (${branchPort})...`);

          const result = await executor.execute(context);
          if (!result) break;
          branchOutputMap.set(bodyNode.id, result.outputs);
          // Also update shared outputMap so downstream done-connected nodes can read branch outputs
          outputMap.set(bodyNode.id, result.outputs);
          this.logDebug(`    └ [${bodyNode.type}] "${bodyNode.label}" (${bodyNode.id}) — ${result.status} (${result.duration ?? 0}ms)`);

          const nodeResult: NodeResult = {
            nodeId: bodyNode.id,
            nodeType: bodyNode.type,
            nodeLabel: bodyNode.label,
            status: result.status,
            inputs,
            outputs: result.outputs,
            duration: result.duration,
            error: result.error,
          };
          branchNodeResults.push(nodeResult);

          this.fireEvent({
            type: "nodeCompleted", flowId, nodeId: bodyNode.id,
            nodeStatus: result.status, nodeOutput: result.outputs,
            result: nodeResult,
          });

          if (result.status === "error") {
            this.logDebug(`  ∥ Parallel: branch "${branchPort}" failed at "${bodyNode.label}"`);
            break;
          }
        }

        return { branchPort, branchNodeResults };
      }),
    );

    // Merge branch node results into main nodeResults
    for (const { branchNodeResults } of branchResults) {
      nodeResults.push(...branchNodeResults);
    }

    // Update done output with branch results summary
    const branchSummary: Record<string, unknown> = {};
    for (const { branchPort, branchNodeResults } of branchResults) {
      const lastResult = branchNodeResults[branchNodeResults.length - 1];
      branchSummary[branchPort] = lastResult ? lastResult.outputs : {};
    }
    outputMap.set(parallelNode.id, {
      ...outputMap.get(parallelNode.id),
      done: branchSummary,
    });

    return allBranchNodeIds;
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
