// Trace: DD-02-007005
import { useRef, useCallback, useMemo } from "react";

interface FlowState {
  nodes: unknown[];
  edges: unknown[];
}

interface UndoRedoResult {
  canUndo: boolean;
  canRedo: boolean;
  pushState: (state: FlowState) => void;
  undo: () => FlowState | undefined;
  redo: () => FlowState | undefined;
}

const MAX_HISTORY = 50;

// Trace: DD-02-007005
export function useUndoRedo(): UndoRedoResult {
  const undoStackRef = useRef<FlowState[]>([]);
  const redoStackRef = useRef<FlowState[]>([]);

  const pushState = useCallback((state: FlowState) => {
    undoStackRef.current.push(state);
    redoStackRef.current.length = 0;
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
  }, []);

  const undo = useCallback(() => {
    const state = undoStackRef.current.pop();
    if (state) {
      redoStackRef.current.push(state);
    }
    return state;
  }, []);

  const redo = useCallback(() => {
    const state = redoStackRef.current.pop();
    if (state) {
      undoStackRef.current.push(state);
    }
    return state;
  }, []);

  return useMemo(() => ({
    get canUndo() {
      return undoStackRef.current.length > 0;
    },
    get canRedo() {
      return redoStackRef.current.length > 0;
    },
    pushState,
    undo,
    redo,
  }), [pushState, undo, redo]);
}
