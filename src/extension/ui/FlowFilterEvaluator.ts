// Trace: FEAT-00018-003002, FEAT-00018-003003

import type { IFlowService } from "@extension/interfaces/IFlowService.js";
import type {
  FlowFilterAuxiliaryFlags,
  FlowFilterSortOrder,
} from "@extension/ui/FlowFilterState.js";
import { FlowFilterState } from "@extension/ui/FlowFilterState.js";
import type { FlowSummary } from "@shared/types/flow.js";

export interface EvaluatedFlowSummary {
  summary: FlowSummary;
  auxiliaryFlags?: FlowFilterAuxiliaryFlags;
}

export class FlowFilterEvaluator {
  constructor(
    private readonly flowService: IFlowService,
    private readonly flowFilterState: FlowFilterState,
  ) {}

  async filterSummaries(summaries: FlowSummary[]): Promise<FlowSummary[]> {
    return (await this.evaluateSummaries(summaries)).map((entry) => entry.summary);
  }

  async evaluateSummaries(
    summaries: FlowSummary[],
  ): Promise<EvaluatedFlowSummary[]> {
    const snapshot = this.flowFilterState.getSnapshot();
    const normalizedQuery = snapshot.query.trim().toLowerCase();
    const sortedSummaries = this.sortSummaries(summaries, snapshot.sortBy);
    const queryFilteredSummaries = !normalizedQuery
      ? sortedSummaries
      : sortedSummaries.filter((summary) =>
          summary.name.trim().toLowerCase().includes(normalizedQuery),
        );

    if (!snapshot.requiresTrigger && !snapshot.requiresSubFlow) {
      return queryFilteredSummaries.map((summary) => ({ summary }));
    }

    const entries = await Promise.all(
      queryFilteredSummaries.map(async (summary) => ({
        summary,
        auxiliaryFlags: await this.resolveAuxiliaryFlags(summary.id),
      })),
    );

    return entries.filter(
      ({ auxiliaryFlags }) =>
        (!snapshot.requiresTrigger || auxiliaryFlags?.hasTrigger) &&
        (!snapshot.requiresSubFlow || auxiliaryFlags?.hasSubFlow),
    );
  }

  private sortSummaries(
    summaries: FlowSummary[],
    sortBy: FlowFilterSortOrder,
  ): FlowSummary[] {
    if (sortBy !== "updatedAtDesc") {
      return summaries;
    }

    return [...summaries].sort(
      (left, right) =>
        Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""),
    );
  }

  private async resolveAuxiliaryFlags(
    flowId: string,
  ): Promise<FlowFilterAuxiliaryFlags> {
    const cachedFlags = this.flowFilterState.getAuxiliaryFlags(flowId);
    if (cachedFlags) {
      return cachedFlags;
    }

    const flow = await this.flowService.getFlow(flowId);
    const resolvedFlags = {
      hasTrigger: flow.nodes.some((node) => node.type === "trigger"),
      hasSubFlow: flow.nodes.some((node) => node.type === "subFlow"),
    };
    this.flowFilterState.setAuxiliaryFlags(flowId, resolvedFlags);
    return resolvedFlags;
  }
}