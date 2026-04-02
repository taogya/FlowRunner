// Trace: DD-02-006001, DD-02-006002
import React from "react";
import * as l10n from "@vscode/l10n";

interface NodeTypeItem {
  type: string;
  label: string;
  category: string;
}

interface NodePaletteProps {
  nodeTypes: NodeTypeItem[];
}

const nodeTypeAbbrevs: Record<string, string> = {
  trigger: "T",
  command: "C",
  condition: "?",
  loop: "L",
  subFlow: "S",
  log: "O",
  file: "F",
  comment: "#",
  http: "H",
  aiPrompt: "AI",
  transform: "X",
  tryCatch: "TC",
  parallel: "P",
};

export const NodePalette: React.FC<NodePaletteProps> = ({ nodeTypes }) => {
  const grouped = nodeTypes.reduce<Record<string, NodeTypeItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {},
  );

  // Trace: DD-02-006002
  const handleDragStart = (
    event: React.DragEvent<HTMLLIElement>,
    nodeType: string,
  ) => {
    event.dataTransfer.setData(
      "application/flowrunner-node-type",
      nodeType,
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div data-testid="node-palette" className="fr-palette">
      <div className="fr-palette-title">{l10n.t("Nodes")}</div>
      {Object.entries(grouped).map(([category, items]) => (
        <details key={category} open>
          <summary>{category}</summary>
          <ul>
            {items.map((item) => (
              <li
                key={item.type}
                className="fr-palette-item"
                draggable
                onDragStart={(e) => handleDragStart(e, item.type)}
              >
                <span className={`fr-palette-icon fr-node-type-badge`} style={{ background: `var(--fr-node-${item.type}-badge, #555)` }}>
                  {nodeTypeAbbrevs[item.type] ?? item.type[0]?.toUpperCase()}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
};
