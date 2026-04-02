// Trace: BD-02-003002 Mock implementation
import type { IFlowEditorManager } from "@extension/interfaces/IFlowEditorManager.js";

/**
 * IFlowEditorManager の Mock 実装
 *
 * インメモリでパネル状態を管理する。
 */
export class MockFlowEditorManager implements IFlowEditorManager {
  private openPanels = new Map<string, boolean>();
  private activeFlowId: string | undefined;

  openEditor(flowId: string, _flowName?: string): void {
    this.openPanels.set(flowId, true);
    this.activeFlowId = flowId;
  }

  closeEditor(flowId: string): void {
    this.openPanels.delete(flowId);
    if (this.activeFlowId === flowId) {
      this.activeFlowId = undefined;
    }
  }

  getActiveFlowId(): string | undefined {
    return this.activeFlowId;
  }

  postMessageToFlow(_flowId: string, _message: unknown): void {
    // no-op in mock
  }

  dispose(): void {
    this.openPanels.clear();
    this.activeFlowId = undefined;
  }
}
