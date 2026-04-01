// Trace: DD-02-005001
import React from "react";

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
}) => {
  return (
    <div data-testid="toolbar" className="fr-toolbar">
      {!isDebugMode && (
        <button className="fr-toolbar-btn fr-toolbar-btn--primary" onClick={onExecute} disabled={isRunning} aria-label="Execute">
          ▶ Execute
        </button>
      )}
      {(isRunning || isDebugMode) && (
        <button className="fr-toolbar-btn fr-toolbar-btn--danger" onClick={onStop} aria-label="Stop">
          ■ Stop
        </button>
      )}
      <span className="fr-toolbar-separator" />
      {!isRunning && (
        <button className="fr-toolbar-btn" onClick={onDebugStart} disabled={isDebugMode} aria-label="Debug">
          ⏯ Debug
        </button>
      )}
      {isDebugMode && (
        <button className="fr-toolbar-btn" onClick={onDebugStep} aria-label="Step">
          ⏭ Step
        </button>
      )}
      <span className="fr-toolbar-separator" />
      <button className="fr-toolbar-btn" onClick={onSave} disabled={!isDirty} aria-label="Save">
        💾 Save
      </button>
      <span className="fr-toolbar-separator" />
      {onToggleLeftPanel && (
        <button
          className={`fr-toolbar-btn ${leftPanelOpen ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleLeftPanel}
          aria-label="Toggle Node Palette"
          title="ノード一覧"
        >
          ☰
        </button>
      )}
      {onToggleMiniMap && (
        <button
          className={`fr-toolbar-btn ${showMiniMap ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleMiniMap}
          aria-label="Toggle MiniMap"
          title="ミニマップ"
        >
          🗺
        </button>
      )}
      {onToggleRightPanel && (
        <button
          className={`fr-toolbar-btn ${rightPanelOpen ? "fr-toolbar-btn--active" : ""}`}
          onClick={onToggleRightPanel}
          aria-label="Toggle Properties"
          title="プロパティ"
        >
          ⚙
        </button>
      )}
      {onAutoLayout && (
        <button
          className="fr-toolbar-btn"
          onClick={onAutoLayout}
          aria-label="Auto Layout"
          title="自動整列"
        >
          ⇶
        </button>
      )}
      <span className="fr-toolbar-status">
        {isRunning ? "Running..." : isDebugMode ? "Debug Mode" : isDirty ? "Unsaved changes" : ""}
      </span>
    </div>
  );
};
