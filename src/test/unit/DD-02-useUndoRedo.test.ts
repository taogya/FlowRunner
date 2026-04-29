// @vitest-environment jsdom
// DD-02 useUndoRedo UT tests
// Trace: DD-02-007005

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "@webview/hooks/useUndoRedo.js";

describe("useUndoRedo", () => {
  // DDUT-02-007005-00001
  it("initial_canUndoFalse", () => {
    // Act
    const { result } = renderHook(() => useUndoRedo());

    // Assert
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  // DDUT-02-007005-00002
  it("afterPush_canUndoTrue", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());

    // Act
    act(() => {
      result.current.pushState({ nodes: [], edges: [] });
    });

    // Assert
    expect(result.current.canUndo).toBe(true);
  });

  // DDUT-02-007005-00003
  it("afterUndo_canRedoTrue", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.pushState({ nodes: [], edges: [] });
    });

    // Act
    act(() => {
      result.current.undo({ nodes: [{ id: "current" }], edges: [] });
    });

    // Assert
    expect(result.current.canRedo).toBe(true);
  });

  // DDUT-02-007005-00004
  it("statePersistsAcrossReRenders", () => {
    // Arrange
    const { result, rerender } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.pushState({ nodes: [{ id: "1" }], edges: [] });
    });

    // Act — re-render should NOT reset state
    rerender();

    // Assert
    expect(result.current.canUndo).toBe(true);
  });

  // DDUT-02-007005-00005
  it("maxHistory_exceedsLimit_dropsOldest", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());

    // Act — push 51 states (max is 50)
    act(() => {
      for (let i = 0; i <= 50; i++) {
        result.current.pushState({ nodes: [{ id: String(i) }], edges: [] });
      }
    });

    // Undo 50 times should be possible, 51st should fail
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.undo({ nodes: [], edges: [] });
      }
    });

    // Assert — canUndo should be false after 50 undos (oldest was dropped)
    expect(result.current.canUndo).toBe(false);
  });

  // DDUT-02-007005-00006
  it("pushState_clearsRedoStack", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.pushState({ nodes: [], edges: [] });
      result.current.pushState({ nodes: [{ id: "1" }], edges: [] });
    });
    act(() => {
      result.current.undo({ nodes: [{ id: "1" }], edges: [] });
    });
    expect(result.current.canRedo).toBe(true);

    // Act — push new state should clear redo
    act(() => {
      result.current.pushState({ nodes: [{ id: "2" }], edges: [] });
    });

    // Assert
    expect(result.current.canRedo).toBe(false);
  });

  // DDUT-02-007005-00007
  it("undo_returnsCorrectState", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const state1 = { nodes: [{ id: "1" }], edges: [] };
    act(() => {
      result.current.pushState(state1);
    });

    // Act
    let returnedState: unknown;
    act(() => {
      returnedState = result.current.undo({ nodes: [{ id: "current" }], edges: [] });
    });

    // Assert
    expect(returnedState).toEqual(state1);
  });

  // DDUT-02-007005-00008
  it("redo_returnsCorrectState_afterUndo", () => {
    // Arrange
    const { result } = renderHook(() => useUndoRedo());
    const state1 = { nodes: [{ id: "1" }], edges: [] };
    const state2 = { nodes: [{ id: "1" }, { id: "2" }], edges: [] };
    act(() => {
      result.current.pushState(state1);
    });

    // Act — undo with current state2, then redo with state1
    let undoResult: unknown;
    let redoResult: unknown;
    act(() => {
      undoResult = result.current.undo(state2);
    });
    act(() => {
      redoResult = result.current.redo(state1);
    });

    // Assert — undo returns state1 (previous), redo returns state2 (the state at undo time)
    expect(undoResult).toEqual(state1);
    expect(redoResult).toEqual(state2);
  });
});
