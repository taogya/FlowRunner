// Trace: FEAT-00019-003002, FEAT-00019-003003, FEAT-00019-003004, FEAT-00019-003005
import React, { useState } from "react";
import * as l10n from "@vscode/l10n";
import type { ExecutionAnalyticsSnapshot } from "@shared/types/analytics.js";

interface ExecutionAnalyticsPanelProps {
  snapshot: ExecutionAnalyticsSnapshot | null;
  isLoading?: boolean;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export const ExecutionAnalyticsPanel: React.FC<ExecutionAnalyticsPanelProps> = ({
  snapshot,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="fr-analytics" aria-label={l10n.t("Execution Analytics")}>
      <div className="fr-analytics-header">
        <button
          type="button"
          className="fr-analytics-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? l10n.t("Collapse") : l10n.t("Expand")}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span className={`fr-analytics-chevron ${isExpanded ? "fr-analytics-chevron--expanded" : ""}`}>
            ▾
          </span>
          <span className="fr-analytics-title">{l10n.t("Execution Analytics")}</span>
        </button>
      </div>

      {!isExpanded ? null : isLoading ? (
        <div className="fr-analytics-empty">{l10n.t("Loading analytics...")}</div>
      ) : !snapshot || snapshot.sampleSize === 0 ? (
        <div className="fr-analytics-empty">{l10n.t("No execution analytics yet")}</div>
      ) : (
        <>
          <div className="fr-analytics-metrics">
            <div className="fr-analytics-metric">
              <span className="fr-analytics-metric-label">{l10n.t("Successes")}</span>
              <strong>{snapshot.successCount}</strong>
            </div>
            <div className="fr-analytics-metric">
              <span className="fr-analytics-metric-label">{l10n.t("Failures")}</span>
              <strong>{snapshot.failureCount}</strong>
            </div>
            <div className="fr-analytics-metric">
              <span className="fr-analytics-metric-label">{l10n.t("Success rate")}</span>
              <strong>{formatPercent(snapshot.successRate)}</strong>
            </div>
            <div className="fr-analytics-metric">
              <span className="fr-analytics-metric-label">{l10n.t("Average duration")}</span>
              <strong>{snapshot.averageDurationMs}ms</strong>
            </div>
            <div className="fr-analytics-metric fr-analytics-metric--wide">
              <span className="fr-analytics-metric-label">{l10n.t("Latest executed at")}</span>
              <strong>{snapshot.latestExecutedAt ?? l10n.t("No execution analytics yet")}</strong>
            </div>
          </div>

          {snapshot.unreadableCount > 0 ? (
            <div className="fr-analytics-warning">
              {l10n.t("Unreadable records: {0}", snapshot.unreadableCount)}
            </div>
          ) : null}

          <div className="fr-analytics-section">
            <div className="fr-analytics-section-title">{l10n.t("Recent failures")}</div>
            {snapshot.recentFailures.length === 0 ? (
              <div className="fr-analytics-empty fr-analytics-empty--compact">
                {l10n.t("No recent failures")}
              </div>
            ) : (
              <div className="fr-analytics-failure-list">
                {snapshot.recentFailures.map((failure) => (
                  <div
                    key={`${failure.startedAt}-${failure.durationMs}-${failure.errorMessage}`}
                    className="fr-analytics-failure-item"
                  >
                    <div className="fr-analytics-failure-top">
                      <span>{failure.startedAt}</span>
                      <span>{failure.durationMs}ms</span>
                    </div>
                    <div className="fr-analytics-failure-message">{failure.errorMessage}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="fr-analytics-section">
            <div className="fr-analytics-section-title">{l10n.t("Slowest node")}</div>
            {!snapshot.slowestNode ? (
              <div className="fr-analytics-empty fr-analytics-empty--compact">
                {l10n.t("No node timing data")}
              </div>
            ) : (
              <div className="fr-analytics-slowest">
                <div className="fr-analytics-slowest-name">{snapshot.slowestNode.nodeLabel}</div>
                <div className="fr-analytics-slowest-meta">
                  {l10n.t("Type: {0}", snapshot.slowestNode.nodeType)}
                </div>
                <div className="fr-analytics-slowest-meta">
                  {l10n.t(
                    "Average {0}ms / Max {1}ms",
                    snapshot.slowestNode.averageDurationMs,
                    snapshot.slowestNode.maxDurationMs,
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};