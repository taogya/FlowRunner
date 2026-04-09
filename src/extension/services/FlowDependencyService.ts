// Trace: FEAT-00020-003001, FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003005
import type { IFlowDependencyService } from "@extension/interfaces/IFlowDependencyService.js";
import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type {
  FlowDependencyEntry,
  FlowDependencyNodeReference,
  FlowDependencySnapshot,
  FlowDependencyWarning,
} from "@shared/types/dependencies.js";
import type { FlowDefinition, NodeInstance } from "@shared/types/flow.js";

function getNodeReference(node: NodeInstance): FlowDependencyNodeReference {
  return {
    nodeId: node.id,
    nodeLabel: node.label,
  };
}

function getReferencedFlowId(node: NodeInstance): string {
  const rawFlowId = node.settings.flowId;
  return typeof rawFlowId === "string" ? rawFlowId.trim() : "";
}

function sortEntries(entries: Iterable<FlowDependencyEntry>): FlowDependencyEntry[] {
  return [...entries].sort((left, right) => left.flowName.localeCompare(right.flowName, "ja"));
}

export class FlowDependencyService implements IFlowDependencyService {
  constructor(private readonly flowService: IFlowService) {}

  async buildSnapshot(flowId: string): Promise<FlowDependencySnapshot | null> {
    const summaries = await this.flowService.listFlows();
    const flowNames = new Map(summaries.map((summary) => [summary.id, summary.name]));
    const loadedFlows = await Promise.all(
      summaries.map(async (summary) => {
        try {
          return await this.flowService.getFlow(summary.id);
        } catch {
          return null;
        }
      }),
    );
    const flowsById = new Map<string, FlowDefinition>();
    for (const flow of loadedFlows) {
      if (flow) {
        flowsById.set(flow.id, flow);
        flowNames.set(flow.id, flow.name);
      }
    }

    let currentFlow = flowsById.get(flowId) ?? null;
    if (!currentFlow) {
      try {
        currentFlow = await this.flowService.getFlow(flowId);
      } catch {
        return null;
      }
      flowsById.set(currentFlow.id, currentFlow);
      flowNames.set(currentFlow.id, currentFlow.name);
    }

    const outgoingByFlowId = new Map<string, FlowDependencyEntry>();
    const incomingByFlowId = new Map<string, FlowDependencyEntry>();
    const warnings: FlowDependencyWarning[] = [];

    for (const node of currentFlow.nodes) {
      if (node.type !== "subFlow") {
        continue;
      }

      const referencedFlowId = getReferencedFlowId(node);
      if (!referencedFlowId) {
        warnings.push({
          sourceFlowId: currentFlow.id,
          sourceFlowName: currentFlow.name,
          nodeId: node.id,
          nodeLabel: node.label,
          referencedFlowId: null,
          kind: "emptyTarget",
        });
        continue;
      }

      const targetFlowName = flowNames.get(referencedFlowId);
      if (!targetFlowName) {
        warnings.push({
          sourceFlowId: currentFlow.id,
          sourceFlowName: currentFlow.name,
          nodeId: node.id,
          nodeLabel: node.label,
          referencedFlowId,
          kind: "missingTarget",
        });
        continue;
      }

      const existingEntry = outgoingByFlowId.get(referencedFlowId);
      if (existingEntry) {
        existingEntry.nodeReferences.push(getNodeReference(node));
        existingEntry.nodeCount = existingEntry.nodeReferences.length;
        continue;
      }

      outgoingByFlowId.set(referencedFlowId, {
        flowId: referencedFlowId,
        flowName: targetFlowName,
        nodeCount: 1,
        nodeReferences: [getNodeReference(node)],
      });
    }

    for (const flow of flowsById.values()) {
      if (flow.id === currentFlow.id) {
        continue;
      }

      for (const node of flow.nodes) {
        if (node.type !== "subFlow") {
          continue;
        }

        if (getReferencedFlowId(node) !== currentFlow.id) {
          continue;
        }

        const existingEntry = incomingByFlowId.get(flow.id);
        if (existingEntry) {
          existingEntry.nodeReferences.push(getNodeReference(node));
          existingEntry.nodeCount = existingEntry.nodeReferences.length;
          continue;
        }

        incomingByFlowId.set(flow.id, {
          flowId: flow.id,
          flowName: flow.name,
          nodeCount: 1,
          nodeReferences: [getNodeReference(node)],
        });
      }
    }

    return {
      flowId: currentFlow.id,
      flowName: currentFlow.name,
      outgoing: sortEntries(outgoingByFlowId.values()),
      incoming: sortEntries(incomingByFlowId.values()),
      warnings,
    };
  }
}