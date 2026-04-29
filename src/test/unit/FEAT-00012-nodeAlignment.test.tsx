// @vitest-environment jsdom
// FEAT-00012 Node Alignment UT tests
// Trace: FEAT-00012-002001, FEAT-00012-002002

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Toolbar } from "@webview/components/Toolbar.js";
import { getSelectedNodes } from "@webview/services/clipboardHelpers.js";
import type { FlowNode } from "@webview/components/FlowEditorApp.js";

function makeNode(id: string, x: number, y: number, selected = false): FlowNode & { selected: boolean } {
  return { id, type: "command", position: { x, y }, data: { label: id }, selected };
}

// Alignment algorithm mirroring FlowEditorApp handleAlignX / handleAlignY
function computeAlignX(nodes: (FlowNode & { selected?: boolean })[]): FlowNode[] {
  const selected = getSelectedNodes(nodes);
  if (selected.length < 2) return nodes;
  const avgX = selected.reduce((sum, n) => sum + (n as FlowNode).position.x, 0) / selected.length;
  const selectedIds = new Set(selected.map(n => n.id));
  return nodes.map(n =>
    selectedIds.has(n.id) ? { ...n, position: { ...n.position, x: avgX } } : n,
  );
}

function computeAlignY(nodes: (FlowNode & { selected?: boolean })[]): FlowNode[] {
  const selected = getSelectedNodes(nodes);
  if (selected.length < 2) return nodes;
  const avgY = selected.reduce((sum, n) => sum + (n as FlowNode).position.y, 0) / selected.length;
  const selectedIds = new Set(selected.map(n => n.id));
  return nodes.map(n =>
    selectedIds.has(n.id) ? { ...n, position: { ...n.position, y: avgY } } : n,
  );
}

// ========================================
// §2.1 Alignment Logic (FEAT-00012-002001)
// ========================================
describe("Alignment Logic", () => {
  // FEAT-00012-002001-00001
  it("alignX_selectedNodesXUnifiedToAverage", () => {
    // Arrange
    const nodes = [
      makeNode("n1", 0, 10, true),
      makeNode("n2", 100, 20, true),
      makeNode("n3", 200, 30, false),
    ];

    // Act
    const result = computeAlignX(nodes);

    // Assert
    expect(result[0].position.x).toBe(50);
    expect(result[1].position.x).toBe(50);
    expect(result[2].position.x).toBe(200);
  });

  // FEAT-00012-002001-00002
  it("alignY_selectedNodesYUnifiedToAverage", () => {
    // Arrange
    const nodes = [
      makeNode("n1", 0, 10, true),
      makeNode("n2", 100, 30, true),
      makeNode("n3", 200, 50, false),
    ];

    // Act
    const result = computeAlignY(nodes);

    // Assert
    expect(result[0].position.y).toBe(20);
    expect(result[1].position.y).toBe(20);
    expect(result[2].position.y).toBe(50);
  });

  // FEAT-00012-002001-00003
  it("alignX_lessThan2Selected_noChange", () => {
    // Arrange
    const nodes = [
      makeNode("n1", 0, 10, true),
      makeNode("n2", 100, 20, false),
    ];

    // Act
    const result = computeAlignX(nodes);

    // Assert — same reference returned (no-op)
    expect(result).toBe(nodes);
  });
});

// ========================================
// §2.2 UI Integration (FEAT-00012-002002)
// ========================================
describe("Alignment UI", () => {
  const defaultProps = {
    isRunning: false,
    isDebugMode: false,
    isDirty: false,
    onExecute: vi.fn(),
    onStop: vi.fn(),
    onDebugStart: vi.fn(),
    onDebugStep: vi.fn(),
    onSave: vi.fn(),
  };

  // FEAT-00012-002002-00001
  it("alignButtons_noSelection_disabled", () => {
    // Arrange & Act
    render(
      <Toolbar
        {...defaultProps}
        onAlignX={vi.fn()}
        onAlignY={vi.fn()}
        hasSelection={false}
      />,
    );

    // Assert
    const alignXBtn = screen.getByRole("button", { name: /align x/i });
    const alignYBtn = screen.getByRole("button", { name: /align y/i });
    expect(alignXBtn).toBeDisabled();
    expect(alignYBtn).toBeDisabled();
  });
});
