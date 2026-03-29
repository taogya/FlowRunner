// Trace: DD-02-008001, DD-02-008002, DD-02-008003
import React, { useState, useEffect, useRef, useCallback } from "react";
import type { INodeTypeMetadata, SettingFieldDef } from "@shared/types/node.js";
import type { NodeResult } from "@shared/types/execution.js";
import type { NodeSettings } from "@shared/types/flow.js";

type KeyValuePair = { key: string; value: string };

interface SelectedNode {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  position: { x: number; y: number };
  settings: NodeSettings;
}

interface PropertyPanelProps {
  selectedNode: SelectedNode | null;
  executionOutput: NodeResult | null;
  nodeMetadata: INodeTypeMetadata | null;
  onSettingsChange: (nodeId: string, settings: NodeSettings) => void;
  onLabelChange?: (nodeId: string, label: string) => void;
  onEnabledChange?: (nodeId: string, enabled: boolean) => void;
  nodeType?: string;
}

// Trace: DD-02-008001
export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedNode,
  executionOutput,
  nodeMetadata,
  onSettingsChange,
  onLabelChange,
  onEnabledChange,
  nodeType,
}) => {
  const [activeTab, setActiveTab] = useState<"settings" | "output">("settings");

  if (!selectedNode) {
    return (
      <div data-testid="property-panel" className="fr-panel">
        <div className="fr-panel-empty">
          ノードを選択してください / Select a node
        </div>
      </div>
    );
  }

  return (
    <div data-testid="property-panel" className="fr-panel">
      <div role="tablist" className="fr-panel-tabs">
        <button
          role="tab"
          className={`fr-panel-tab ${activeTab === "settings" ? "fr-panel-tab--active" : ""}`}
          aria-selected={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
        <button
          role="tab"
          className={`fr-panel-tab ${activeTab === "output" ? "fr-panel-tab--active" : ""}`}
          aria-selected={activeTab === "output"}
          onClick={() => setActiveTab("output")}
        >
          Output
        </button>
      </div>
      <div className="fr-panel-content">
        {activeTab === "settings" && nodeMetadata && (
          <>
            {selectedNode.type !== "trigger" && selectedNode.type !== "comment" && (
              <div className="fr-setting-field" style={{ marginBottom: 8 }}>
                <label className="fr-setting-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedNode.enabled}
                    onChange={(e) => onEnabledChange?.(selectedNode.id, e.target.checked)}
                  />
                  有効 (Enabled)
                </label>
              </div>
            )}
            <SettingsTab
              nodeId={selectedNode.id}
              label={selectedNode.label}
              settings={selectedNode.settings}
              schema={nodeMetadata.settingsSchema}
              onSettingsChange={onSettingsChange}
              onLabelChange={onLabelChange}
            />
          </>
        )}
        {activeTab === "output" && (
          <OutputTab executionOutput={executionOutput} nodeType={nodeType ?? selectedNode?.type ?? "unknown"} />
        )}
      </div>
    </div>
  );
};

// Trace: DD-02-008002
interface SettingsTabProps {
  nodeId: string;
  label: string;
  settings: NodeSettings;
  schema: SettingFieldDef[];
  onSettingsChange: (nodeId: string, settings: NodeSettings) => void;
  onLabelChange?: (nodeId: string, label: string) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
  nodeId,
  label,
  settings,
  schema,
  onSettingsChange,
  onLabelChange,
}) => {
  const [localSettings, setLocalSettings] = useState<NodeSettings>({
    ...settings,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSettingsChangeRef = useRef(onSettingsChange);
  const nodeIdRef = useRef(nodeId);
  onSettingsChangeRef.current = onSettingsChange;
  nodeIdRef.current = nodeId;

  // Sync local settings when selected node changes
  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [nodeId, settings]);

  // Trace: DD-02-008002 — 300ms デバウンス
  const handleChange = useCallback(
    (key: string, value: unknown) => {
      setLocalSettings((prev) => {
        const next = { ...prev, [key]: value };
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          onSettingsChangeRef.current(nodeIdRef.current, next);
        }, 300);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div data-testid="settings-tab">
      <div className="fr-field">
        <label htmlFor="field-node-label">ノード名</label>
        <input
          id="field-node-label"
          type="text"
          value={label}
          placeholder="ノード名を入力"
          onChange={(e) => onLabelChange?.(nodeId, e.target.value)}
        />
      </div>
      <hr className="fr-settings-separator" />
      {schema.filter((field) => {
        if (!field.visibleWhen) return true;
        const dep = localSettings[field.visibleWhen.field];
        const allowed = field.visibleWhen.value;
        return Array.isArray(allowed) ? allowed.includes(dep as string) : dep === allowed;
      }).map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={localSettings[field.key]}
          onChange={(v) => handleChange(field.key, v)}
        />
      ))}
    </div>
  );
};

interface SettingsFieldProps {
  field: SettingFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

const SettingsField: React.FC<SettingsFieldProps> = ({
  field,
  value,
  onChange,
}) => {
  const id = `field-${field.key}`;
  const descEl = field.description ? (
    <span className="fr-field-description">{field.description}</span>
  ) : null;

  switch (field.type) {
    case "string":
      return (
        <div className="fr-field">
          <label htmlFor={id}>{field.label}</label>
          {descEl}
          <input
            id={id}
            type="text"
            value={(value as string) ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "number":
      return (
        <div className="fr-field">
          <label htmlFor={id}>{field.label}</label>
          {descEl}
          <input
            id={id}
            type="number"
            value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
      );
    case "boolean":
      return (
        <div className="fr-field">
          {descEl}
          <div className="fr-field-checkbox">
            <input
              id={id}
              type="checkbox"
              checked={(value as boolean) ?? false}
              onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={id}>{field.label}</label>
          </div>
        </div>
      );
    case "text":
      return (
        <div className="fr-field">
          <label htmlFor={id}>{field.label}</label>
          {descEl}
          <textarea
            id={id}
            value={(value as string) ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
      return (
        <div className="fr-field">
          <label htmlFor={id}>{field.label}</label>
          {descEl}
          <select
            id={id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">-- 選択 --</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "keyValue": {
      const pairs: KeyValuePair[] = (() => {
        if (Array.isArray(value)) return value as KeyValuePair[];
        if (value && typeof value === "object") {
          return Object.entries(value as Record<string, string>).map(([k, v]) => ({ key: k, value: String(v) }));
        }
        return [{ key: "", value: "" }];
      })();
      const updatePairs = (updated: KeyValuePair[]) => {
        const obj: Record<string, string> = {};
        for (const p of updated) {
          if (p.key.trim()) obj[p.key] = p.value;
        }
        onChange(obj);
      };
      return (
        <div className="fr-field">
          <label>{field.label}</label>
          {pairs.map((pair, i) => (
            <div key={i} className="fr-kv-row">
              <input
                type="text"
                placeholder="Key"
                value={pair.key}
                onChange={(e) => {
                  const next = [...pairs];
                  next[i] = { ...next[i], key: e.target.value };
                  updatePairs(next);
                }}
              />
              <input
                type="text"
                placeholder="Value"
                value={pair.value}
                onChange={(e) => {
                  const next = [...pairs];
                  next[i] = { ...next[i], value: e.target.value };
                  updatePairs(next);
                }}
              />
              <button
                type="button"
                className="fr-kv-remove"
                onClick={() => {
                  const next = pairs.filter((_, j) => j !== i);
                  updatePairs(next.length ? next : [{ key: "", value: "" }]);
                }}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="fr-kv-add"
            onClick={() => updatePairs([...pairs, { key: "", value: "" }])}
          >
            + Add
          </button>
        </div>
      );
    }
    default:
      return null;
  }
};

// Trace: DD-02-008003
interface OutputTabProps {
  executionOutput: NodeResult | null;
  nodeType: string;
}

// Trace: DD-02-008003 — ターミナル風出力（command ノード用）
const TerminalOutput: React.FC<{ outputs: Record<string, unknown> }> = ({ outputs }) => {
  const stdout = String(outputs.stdout ?? "");
  const stderr = String(outputs.stderr ?? "");
  return (
    <div className="fr-output-terminal">
      {stdout && (
        <pre className="fr-output-terminal-content">{stdout}</pre>
      )}
      {stderr && (
        <div className="fr-output-terminal-stderr">
          <div className="fr-output-terminal-stderr-label">stderr</div>
          <pre className="fr-output-terminal-content">{stderr}</pre>
        </div>
      )}
      {!stdout && !stderr && (
        <div className="fr-output-empty">出力なし / No output</div>
      )}
    </div>
  );
};

// Trace: DD-02-008003 — Markdown 風出力（aiPrompt ノード用）
const MarkdownOutput: React.FC<{ outputs: Record<string, unknown> }> = ({ outputs }) => {
  const text = String(outputs.out ?? "");
  const tokenUsage = outputs._tokenUsage as { inputTokens: number; outputTokens: number; totalTokens: number; model: string } | undefined;
  return (
    <div className="fr-output-markdown">
      {tokenUsage && (
        <div className="fr-output-token-usage">
          <span title={tokenUsage.model}>🔤 {tokenUsage.model}</span>
          <span>⬆ {tokenUsage.inputTokens}</span>
          <span>⬇ {tokenUsage.outputTokens}</span>
          <span>Σ {tokenUsage.totalTokens}</span>
        </div>
      )}
      <pre className="fr-output-markdown-content">{text}</pre>
    </div>
  );
};

// Trace: DD-02-008003 — JSON 整形出力（http / transform ノード用）
const JsonOutput: React.FC<{ outputs: Record<string, unknown> }> = ({ outputs }) => {
  const formatted = (() => {
    try {
      // http: body + status
      if ("body" in outputs && "status" in outputs) {
        return `HTTP ${outputs.status}\n\n${typeof outputs.body === "string" ? outputs.body : JSON.stringify(outputs.body, null, 2)}`;
      }
      // single "out" port
      if ("out" in outputs) {
        const v = outputs.out;
        return typeof v === "string" ? v : JSON.stringify(v, null, 2);
      }
      return JSON.stringify(outputs, null, 2);
    } catch {
      return String(outputs);
    }
  })();
  return (
    <div className="fr-output-result">
      <pre className="fr-output-pre">{formatted}</pre>
    </div>
  );
};

// Trace: DD-02-008003 — テキスト出力（file / log / 汎用）
const TextOutput: React.FC<{ outputs: Record<string, unknown> }> = ({ outputs }) => {
  const text = "out" in outputs ? String(outputs.out ?? "") : JSON.stringify(outputs, null, 2);
  return (
    <div className="fr-output-result">
      <pre className="fr-output-pre">{text}</pre>
    </div>
  );
};

// Trace: DD-02-008003 — 条件分岐出力
const ConditionOutput: React.FC<{ outputs: Record<string, unknown> }> = ({ outputs }) => {
  const branch = "true" in outputs ? "true" : "false" in outputs ? "false" : null;
  return (
    <div className="fr-output-result">
      <div className="fr-output-condition-badge" data-branch={branch}>
        Branch: <strong>{branch ?? "N/A"}</strong>
      </div>
      <pre className="fr-output-pre">{JSON.stringify(outputs, null, 2)}</pre>
    </div>
  );
};

const OutputTab: React.FC<OutputTabProps> = ({ executionOutput, nodeType }) => {
  if (!executionOutput) {
    return <div className="fr-output-empty">ノードは未実行です / Not executed</div>;
  }

  if (executionOutput.status === "error") {
    return (
      <div className="fr-output-error">
        {executionOutput.error?.message ?? "Unknown error"}
      </div>
    );
  }

  const outputs = executionOutput.outputs as Record<string, unknown>;

  switch (nodeType) {
    case "command":
      return <TerminalOutput outputs={outputs} />;
    case "aiPrompt":
      return <MarkdownOutput outputs={outputs} />;
    case "http":
    case "transform":
      return <JsonOutput outputs={outputs} />;
    case "condition":
      return <ConditionOutput outputs={outputs} />;
    case "trigger":
    case "comment":
      return <div className="fr-output-empty">出力なし / No output</div>;
    default:
      return <TextOutput outputs={outputs} />;
  }
};
