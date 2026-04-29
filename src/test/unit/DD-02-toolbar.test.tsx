// @vitest-environment jsdom
// DD-02 Toolbar UT tests
// Trace: DD-02-005001

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toolbar } from "@webview/components/Toolbar.js";

describe("Toolbar", () => {
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

  // DDUT-02-005001-00001
  it("isRunning_executeButtonDisabled", () => {
    // Act
    render(<Toolbar {...defaultProps} isRunning={true} />);

    // Assert
    const executeBtn = screen.getByRole("button", { name: /execute|実行/i });
    expect(executeBtn).toBeDisabled();
  });

  // DDUT-02-005001-00002
  it("isDirtyFalse_saveButtonDisabled", () => {
    // Act
    render(<Toolbar {...defaultProps} isDirty={false} />);

    // Assert
    const saveBtn = screen.getByRole("button", { name: /save|保存/i });
    expect(saveBtn).toBeDisabled();
  });
});
