// Trace: FEAT-00016-003002, FEAT-00016-003003, FEAT-00016-003004
import React, { useMemo, useState } from "react";
import * as l10n from "@vscode/l10n";
import type { LatestExecutionSummaryItem } from "@webview/services/executionSummary.js";

type SummaryFilter = "all" | "errors";

interface LatestExecutionSummaryProps {
  items: LatestExecutionSummaryItem[];
  onSelectNode?: (nodeId: string) => void;
}

function getStatusLabel(status: LatestExecutionSummaryItem["status"]): string {
  switch (status) {
    case "success":
      return l10n.t("Success");
    case "error":
      return l10n.t("Error");
    case "cancelled":
      return l10n.t("Cancelled");
    case "skipped":
      return l10n.t("Skipped");
    default:
      return status;
  }
}

export const LatestExecutionSummary: React.FC<LatestExecutionSummaryProps> = ({
  items,
  onSelectNode,
}) => {
  const [filter, setFilter] = useState<SummaryFilter>("all");
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredItems = useMemo(() => {
    const ordered = [...items].sort(
      (left, right) => left.executionOrder - right.executionOrder,
    );
    return filter === "errors"
      ? ordered.filter((item) => item.hasError)
      : ordered;
  }, [filter, items]);

  const emptyMessage =
    items.length === 0
      ? l10n.t("No execution summary yet")
      : l10n.t("No error nodes in the latest execution");

  return (
    <section className="fr-summary" aria-label={l10n.t("Latest Execution Summary")}>
      <div className="fr-summary-header">
        <button
          type="button"
          className="fr-summary-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? l10n.t("Collapse") : l10n.t("Expand")}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span className={`fr-summary-chevron ${isExpanded ? "fr-summary-chevron--expanded" : ""}`}>
            ▾
          </span>
          <span className="fr-summary-title">{l10n.t("Latest Execution Summary")}</span>
        </button>
        {isExpanded && (
          <div
            className="fr-summary-filter"
            role="tablist"
            aria-label={l10n.t("Summary Filters")}
          >
          <button
            type="button"
            className={`fr-summary-filter-btn ${filter === "all" ? "fr-summary-filter-btn--active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {l10n.t("All")}
          </button>
          <button
            type="button"
            className={`fr-summary-filter-btn ${filter === "errors" ? "fr-summary-filter-btn--active" : ""}`}
            onClick={() => setFilter("errors")}
          >
            {l10n.t("Errors Only")}
          </button>
          </div>
        )}
      </div>

      {!isExpanded ? null : filteredItems.length === 0 ? (
        <div className="fr-summary-empty">{emptyMessage}</div>
      ) : (
        <div className="fr-summary-list">
          {filteredItems.map((item) => (
            <button
              key={`${item.executionOrder}-${item.nodeId}`}
              type="button"
              className={`fr-summary-item ${item.hasError ? "fr-summary-item--error" : ""}`}
              onClick={() => onSelectNode?.(item.nodeId)}
            >
              <div className="fr-summary-item-top">
                <div className="fr-summary-item-order">#{item.executionOrder}</div>
                <div className="fr-summary-item-label">{item.label}</div>
                <div className={`fr-summary-item-status fr-summary-item-status--${item.status}`}>
                  {getStatusLabel(item.status)}
                </div>
                <div className="fr-summary-item-duration">{item.durationMs}ms</div>
              </div>
              <div className="fr-summary-item-text">
                {item.summaryText || l10n.t("No output")}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};