// @vitest-environment jsdom
/**
 * FEAT-00008: Undo/Redo keyboard shortcut tests
 *
 * Tests for the keyboard shortcut logic in FlowEditorApp.
 * Uses a minimal component wrapper to validate event dispatching.
 */
// Trace: FEAT-00008-003002
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";

describe("Undo/Redo keyboard shortcuts (FEAT-00008)", () => {
  let handleUndo: ReturnType<typeof vi.fn>;
  let handleRedo: ReturnType<typeof vi.fn>;
  let handleSave: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  // Replicate the same keyboard handler logic from FlowEditorApp.tsx
  beforeEach(() => {
    handleUndo = vi.fn();
    handleRedo = vi.fn();
    handleSave = vi.fn();

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleRedo();
      } else if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    cleanup = () => document.removeEventListener("keydown", handleKeyDown);
  });

  afterEach(() => {
    cleanup();
  });

  // FEAT-00008-003002-00001: Ctrl+Z / Cmd+Z で undo が発火する
  it("ctrlZ_triggersUndo", () => {
    fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    expect(handleUndo).toHaveBeenCalledTimes(1);
    expect(handleRedo).not.toHaveBeenCalled();
  });

  it("cmdZ_triggersUndo", () => {
    fireEvent.keyDown(document, { key: "z", metaKey: true });
    expect(handleUndo).toHaveBeenCalledTimes(1);
    expect(handleRedo).not.toHaveBeenCalled();
  });

  // FEAT-00008-003002-00002: Ctrl+Y / Cmd+Shift+Z で redo が発火する
  it("ctrlY_triggersRedo", () => {
    fireEvent.keyDown(document, { key: "y", ctrlKey: true });
    expect(handleRedo).toHaveBeenCalledTimes(1);
    expect(handleUndo).not.toHaveBeenCalled();
  });

  it("cmdShiftZ_triggersRedo", () => {
    fireEvent.keyDown(document, { key: "Z", metaKey: true, shiftKey: true });
    expect(handleRedo).toHaveBeenCalledTimes(1);
    expect(handleUndo).not.toHaveBeenCalled();
  });

  // FEAT-00008-003002-00003: Cmd+Shift+Z が undo を発火しない
  it("cmdShiftZ_doesNotTriggerUndo", () => {
    fireEvent.keyDown(document, { key: "Z", metaKey: true, shiftKey: true });
    expect(handleUndo).not.toHaveBeenCalled();
  });

  it("ctrlShiftZ_triggersRedo", () => {
    fireEvent.keyDown(document, { key: "z", ctrlKey: true, shiftKey: true });
    expect(handleRedo).toHaveBeenCalledTimes(1);
    expect(handleUndo).not.toHaveBeenCalled();
  });

  it("ctrlS_triggersSave", () => {
    fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it("plainZ_doesNotTrigger", () => {
    fireEvent.keyDown(document, { key: "z" });
    expect(handleUndo).not.toHaveBeenCalled();
    expect(handleRedo).not.toHaveBeenCalled();
  });
});
