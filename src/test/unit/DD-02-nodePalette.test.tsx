// @vitest-environment jsdom
// DD-02 NodePalette UT tests
// Trace: DD-02-006001, DD-02-006002

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodePalette } from "@webview/components/NodePalette.js";

describe("NodePalette", () => {
  // DDUT-02-006001-00001
  it("renderNodeTypes_groupedByCategory", () => {
    // Arrange
    const nodeTypes = [
      { type: "trigger", label: "Trigger", category: "basic" },
      { type: "command", label: "Command", category: "basic" },
      { type: "condition", label: "Condition", category: "control" },
    ];

    // Act
    render(<NodePalette nodeTypes={nodeTypes} />);

    // Assert
    expect(screen.getByText("Trigger")).toBeDefined();
    expect(screen.getByText("Command")).toBeDefined();
    expect(screen.getByText("Condition")).toBeDefined();
  });

  // --- DD-02-006002: ドラッグ&ドロップ ---

  // DDUT-02-006002-00001
  it("onDragStart_setsNodeTypeInDataTransfer", () => {
    // Arrange
    const nodeTypes = [
      { type: "command", label: "Command", category: "basic" },
    ];
    render(<NodePalette nodeTypes={nodeTypes} />);
    const item = screen.getByText("Command");

    // Act
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(item, { dataTransfer });

    // Assert
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      "application/flowrunner-node-type",
      "command",
    );
  });

  // DDUT-02-006002-00002
  it("onDragStart_setsEffectAllowedToMove", () => {
    // Arrange
    const nodeTypes = [
      { type: "trigger", label: "Trigger", category: "basic" },
    ];
    render(<NodePalette nodeTypes={nodeTypes} />);
    const item = screen.getByText("Trigger");

    // Act
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(item, { dataTransfer });

    // Assert
    expect(dataTransfer.effectAllowed).toBe("move");
  });
});
