// Trace: FEAT-00016-003001, FEAT-00016-003003
import type { ExecutionStatus, NodeResult } from "@shared/types/execution.js";

export interface LatestExecutionSummaryItem {
  nodeId: string;
  label: string;
  status: ExecutionStatus;
  durationMs: number;
  summaryText: string;
  hasError: boolean;
  executionOrder: number;
}

const SUMMARY_TEXT_LIMIT = 96;

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSummary(value: string): string {
  if (value.length <= SUMMARY_TEXT_LIMIT) {
    return value;
  }
  return `${value.slice(0, SUMMARY_TEXT_LIMIT - 1)}…`;
}

function stringifyValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractOutputSummary(outputs: Record<string, unknown>): string {
  if (typeof outputs.stdout === "string" && outputs.stdout.trim()) {
    return outputs.stdout;
  }

  if (typeof outputs.stderr === "string" && outputs.stderr.trim()) {
    return outputs.stderr;
  }

  if (typeof outputs.out === "string" && outputs.out.trim()) {
    return outputs.out;
  }

  if (outputs.status !== undefined && outputs.body !== undefined) {
    return `HTTP ${String(outputs.status)} ${stringifyValue(outputs.body)}`;
  }

  if (outputs.out !== undefined) {
    return stringifyValue(outputs.out);
  }

  const firstOutput = Object.values(outputs).find((value) => value != null);
  return stringifyValue(firstOutput);
}

export function summarizeNodeResult(result: NodeResult): string {
  const rawText =
    result.status === "error"
      ? result.error?.message ?? ""
      : extractOutputSummary(result.outputs as Record<string, unknown>);

  return truncateSummary(toSingleLine(rawText));
}

export function createExecutionSummaryItem(
  result: NodeResult,
  executionOrder: number,
): LatestExecutionSummaryItem {
  return {
    nodeId: result.nodeId,
    label: result.nodeLabel,
    status: result.status,
    durationMs: Math.max(0, Math.round(result.duration ?? 0)),
    summaryText: summarizeNodeResult(result),
    hasError: result.status === "error",
    executionOrder,
  };
}

function createNodeResultSummarySignature(result: NodeResult): string {
  return JSON.stringify({
    status: result.status,
    durationMs: Math.max(0, Math.round(result.duration ?? 0)),
    summaryText: summarizeNodeResult(result),
  });
}

export function appendDebugExecutionSummaryItems(
  previousResults: Map<string, NodeResult>,
  nextResults: Map<string, NodeResult>,
  previousItems: LatestExecutionSummaryItem[],
): LatestExecutionSummaryItem[] {
  const nextItems = [...previousItems];

  for (const [nodeId, result] of nextResults) {
    const previousResult = previousResults.get(nodeId);
    const hasChanged =
      !previousResult ||
      createNodeResultSummarySignature(previousResult) !==
        createNodeResultSummarySignature(result);

    if (hasChanged) {
      nextItems.push(createExecutionSummaryItem(result, nextItems.length + 1));
    }
  }

  return nextItems;
}