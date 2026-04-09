// Trace: FEAT-00020-003002, FEAT-00020-003003, FEAT-00020-003004, FEAT-00020-003005
import React, { useMemo, useState } from "react";
import * as l10n from "@vscode/l10n";
import type {
  FlowDependencyEntry,
  FlowDependencySnapshot,
  FlowDependencyWarning,
} from "@shared/types/dependencies.js";

interface FlowDependencyPanelProps {
  snapshot: FlowDependencySnapshot | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onOpenFlow?: (targetFlowId: string) => void;
}

function renderNodeLabels(entry: FlowDependencyEntry): string {
  return entry.nodeReferences.map((nodeRef) => nodeRef.nodeLabel).join(", ");
}

function renderWarningMessage(warning: FlowDependencyWarning): string {
  if (warning.kind === "emptyTarget") {
    return l10n.t("Empty subflow target");
  }
  return l10n.t("Missing target flow: {0}", warning.referencedFlowId ?? "-");
}

export const FlowDependencyPanel: React.FC<FlowDependencyPanelProps> = ({
  snapshot,
  isLoading = false,
  onRefresh,
  onOpenFlow,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isEmpty = useMemo(() => {
    if (!snapshot) {
      return true;
    }
    return (
      snapshot.outgoing.length === 0
      && snapshot.incoming.length === 0
      && snapshot.warnings.length === 0
    );
  }, [snapshot]);

  return (
    <section className="fr-dependency" aria-label={l10n.t("Flow Dependencies")}>
      <div className="fr-dependency-header">
        <button
          type="button"
          className="fr-dependency-toggle"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? l10n.t("Collapse") : l10n.t("Expand")}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span className={`fr-dependency-chevron ${isExpanded ? "fr-dependency-chevron--expanded" : ""}`}>
            ▾
          </span>
          <span className="fr-dependency-title">{l10n.t("Flow Dependencies")}</span>
        </button>
        {onRefresh ? (
          <button type="button" className="fr-dependency-refresh" onClick={onRefresh}>
            {l10n.t("Refresh")}
          </button>
        ) : null}
      </div>

      {!isExpanded ? null : isLoading ? (
        <div className="fr-dependency-empty">{l10n.t("Loading dependencies...")}</div>
      ) : isEmpty ? (
        <div className="fr-dependency-empty">
          {l10n.t("This flow has no subflow dependencies or warnings.")}
        </div>
      ) : (
        <div className="fr-dependency-body">
          <div className="fr-dependency-section">
            <div className="fr-dependency-section-title">{l10n.t("Outgoing dependencies")}</div>
            {snapshot && snapshot.outgoing.length > 0 ? (
              <div className="fr-dependency-list">
                {snapshot.outgoing.map((entry) => (
                  <button
                    key={`outgoing-${entry.flowId}`}
                    type="button"
                    className="fr-dependency-item"
                    onClick={() => onOpenFlow?.(entry.flowId)}
                    disabled={!onOpenFlow}
                  >
                    <div className="fr-dependency-item-top">
                      <span className="fr-dependency-flow-name">{entry.flowName}</span>
                      <span className="fr-dependency-flow-id">{entry.flowId}</span>
                    </div>
                    <div className="fr-dependency-meta">{l10n.t("References: {0}", entry.nodeCount)}</div>
                    <div className="fr-dependency-meta">{l10n.t("Nodes: {0}", renderNodeLabels(entry))}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="fr-dependency-empty fr-dependency-empty--compact">
                {l10n.t("No outgoing dependencies")}
              </div>
            )}
          </div>

          <div className="fr-dependency-section">
            <div className="fr-dependency-section-title">{l10n.t("Incoming dependencies")}</div>
            {snapshot && snapshot.incoming.length > 0 ? (
              <div className="fr-dependency-list">
                {snapshot.incoming.map((entry) => (
                  <button
                    key={`incoming-${entry.flowId}`}
                    type="button"
                    className="fr-dependency-item"
                    onClick={() => onOpenFlow?.(entry.flowId)}
                    disabled={!onOpenFlow}
                  >
                    <div className="fr-dependency-item-top">
                      <span className="fr-dependency-flow-name">{entry.flowName}</span>
                      <span className="fr-dependency-flow-id">{entry.flowId}</span>
                    </div>
                    <div className="fr-dependency-meta">{l10n.t("References: {0}", entry.nodeCount)}</div>
                    <div className="fr-dependency-meta">{l10n.t("Nodes: {0}", renderNodeLabels(entry))}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="fr-dependency-empty fr-dependency-empty--compact">
                {l10n.t("No incoming dependencies")}
              </div>
            )}
          </div>

          <div className="fr-dependency-section">
            <div className="fr-dependency-section-title">{l10n.t("Warnings")}</div>
            {snapshot && snapshot.warnings.length > 0 ? (
              <div className="fr-dependency-list">
                {snapshot.warnings.map((warning) => (
                  <div
                    key={`warning-${warning.nodeId}-${warning.kind}-${warning.referencedFlowId ?? "empty"}`}
                    className="fr-dependency-warning"
                  >
                    <div className="fr-dependency-warning-title">{warning.nodeLabel}</div>
                    <div className="fr-dependency-meta">{renderWarningMessage(warning)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fr-dependency-empty fr-dependency-empty--compact">
                {l10n.t("No dependency warnings")}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};