// Trace: DD-02-005001
import React from "react";
import * as l10n from "@vscode/l10n";

interface ToolbarProps {
  isRunning: boolean;
  isDebugMode: boolean;
  isDirty: boolean;
  onExecute: () => void;
  onStop: () => void;
  onDebugStart: () => void;
  onDebugStep: () => void;
  onSave: () => void;
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
  leftPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onAutoLayout?: () => void;
  onAutoLayoutVertical?: () => void;
  onAlignX?: () => void;
  onAlignY?: () => void;
  hasSelection?: boolean;
  isTriggerActive?: boolean;
  hasTriggerNode?: boolean;
  onTriggerActivate?: () => void;
  onTriggerDeactivate?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isRunning,
  isDebugMode,
  isDirty,
  onExecute,
  onStop,
  onDebugStart,
  onDebugStep,
  onSave,
  showMiniMap,
  onToggleMiniMap,
  leftPanelOpen,
  onToggleLeftPanel,
  rightPanelOpen,
  onToggleRightPanel,
  onAutoLayout,
  onAutoLayoutVertical,
  onAlignX,
  onAlignY,
  hasSelection,
  isTriggerActive,
  hasTriggerNode,
  onTriggerActivate,
  onTriggerDeactivate,
}) => {
  return (
    <div data-testid="toolbar" className="fr-toolbar">
      {!isDebugMode && (
        <button className="fr-toolbar-btn fr-toolbar-btn--primary" onClick={onExecute} disabled={isRunning} aria-label={l10n.t("Execute")}>
          ▶ {l10n.t("Execute")}
        </button>
      )}
      {(isRunning || isDebugMode) && (
        <button className="fr-toolbar-btn fr-toolbar-btn--danger" onClick={onStop} aria-label={l10n.t("Stop")}>
          ■ {l10n.t("Stop")}
        </button>
      )}
      <span className="fr-toolbar-separator" />
      {!isRunning && (
        <button className="fr-toolbar-btn" onClick={onDebugStart} disabled={isDebugMode} aria-label={l10n.t("Debug")}>
          ⏯ {l10n.t("Debug")}
        </button>
      )}
      {isDebugMode && (
        <button className="fr-toolbar-btn" onClick={onDebugStep} aria-label={l10n.t("Step")}>
          ⏭ {l10n.t("Step")}
        </button>
      )}
      <span className="fr-toolbar-separator" />
      <button className="fr-toolbar-btn" onClick={onSave} disabled={!isDirty} aria-label={l10n.t("Save")}>
        💾 {l10n.t("Save")}
      </button>
      {hasTriggerNode && onTriggerActivate && onTriggerDeactivate && (
        <>
          <span className="fr-toolbar-separator" />
          {!isTriggerActive ? (
            <button
              className="fr-toolbar-btn"
              onClick={onTriggerActivate}
              disabled={isRunning}
              aria-label={l10n.t("Activate Trigger")}
              title={l10n.t("Activate Trigger")}
            >
              ⚡ {l10n.t("Trigger")}
            </button>
          ) : (
            <button
              className="fr-toolbar-btn fr-toolbar-btn--danger"
              onClick={onTriggerDeactivate}
              aria-label={l10n.t("Deactivate Trigger")}
              title={l10n.t("Deactivate Trigger")}
            >
              ⚡ {l10n.t("Stop Trigger")}
            </button>
          )}
        </>
      )}
      <span className="fr-toolbar-separator" />
      {onToggleLeftPanel && (
        <button
          className={`fr-toolbar-btn ${leftPanelOpen ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleLeftPanel}
          aria-label={l10n.t("Toggle Node Palette")}
          title={l10n.t("Node Palette")}
        >
          ☰
        </button>
      )}
      {onToggleMiniMap && (
        <button
          className={`fr-toolbar-btn ${showMiniMap ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleMiniMap}
          aria-label={l10n.t("Toggle MiniMap")}
          title={l10n.t("MiniMap")}
        >
          🗺
        </button>
      )}
      {onToggleRightPanel && (
        <button
          className={`fr-toolbar-btn ${rightPanelOpen ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleRightPanel}
          aria-label={l10n.t("Toggle Properties")}
          title={l10n.t("Properties")}
        >
          ⚙
        </button>
      )}
      {onAutoLayout && (
        <button
          className="fr-toolbar-btn"
          onClick={onAutoLayout}
          aria-label={l10n.t("Auto Layout (Horizontal)")}
          title={l10n.t("Auto Layout (Left → Right)")}
        >
          ⇶
        </button>
      )}
      {onAutoLayoutVertical && (
        <button
          className="fr-toolbar-btn"
          onClick={onAutoLayoutVertical}
          aria-label={l10n.t("Auto Layout (Vertical)")}
          title={l10n.t("Auto Layout (Top → Bottom)")}
        >
          ⇵
        </button>
      )}
      {onAlignX && (
        <button
          className="fr-toolbar-btn"
          onClick={onAlignX}
          disabled={!hasSelection}
          aria-label={l10n.t("Align X")}
          title={l10n.t("Align X (unify X coordinate)")}
        >
          ┃
        </button>
      )}
      {onAlignY && (
        <button
          className="fr-toolbar-btn"
          onClick={onAlignY}
          disabled={!hasSelection}
          aria-label={l10n.t("Align Y")}
          title={l10n.t("Align Y (unify Y coordinate)")}
        >
          ━
        </button>
      )}
      <span className="fr-toolbar-status">
        {isRunning ? l10n.t("Running...") : isDebugMode ? l10n.t("Debug Mode") : isDirty ? l10n.t("Unsaved changes") : ""}
      </span>
    </div>
  );
};
