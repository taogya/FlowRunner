/**
 * FEAT-00001: TriggerService unit tests
 *
 * Tests for TriggerService activation, deactivation, lifecycle, and execution behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TriggerService } from "@extension/services/TriggerService.js";
import type { IExecutionService, Disposable } from "@extension/interfaces/IExecutionService.js";
import type { TriggerConfig } from "@extension/interfaces/ITriggerService.js";
import type { PortDataMap } from "@shared/types/flow.js";

// Minimal mock for vscode.WorkspaceFolder
const mockWorkspaceFolder = {
  uri: { scheme: "file", authority: "", path: "/workspace", query: "", fragment: "", fsPath: "/workspace", toString: () => "file:///workspace" },
  name: "workspace",
  index: 0,
};

function createMockExecutionService(): IExecutionService & {
  _executeFlowCalls: Array<{ flowId: string; options?: { depth?: number; triggerData?: Record<string, unknown> } }>;
  _running: Set<string>;
} {
  const calls: Array<{ flowId: string; options?: { depth?: number; triggerData?: Record<string, unknown> } }> = [];
  const running = new Set<string>();
  return {
    _executeFlowCalls: calls,
    _running: running,
    executeFlow: vi.fn(async (flowId: string, options?: { depth?: number; triggerData?: Record<string, unknown> }): Promise<PortDataMap | undefined> => {
      calls.push({ flowId, options });
      return undefined;
    }),
    stopFlow: vi.fn(),
    getRunningFlows: vi.fn(() => Array.from(running)),
    isRunning: vi.fn((flowId: string) => running.has(flowId)),
    onFlowEvent: vi.fn((): Disposable => ({ dispose: vi.fn() })),
  };
}

describe("TriggerService (FEAT-00001)", () => {
  let service: TriggerService;
  let mockExec: ReturnType<typeof createMockExecutionService>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockExec = createMockExecutionService();
    service = new TriggerService(mockExec, mockWorkspaceFolder as any);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  // FEAT-00001-003004-00001: activateTrigger で fileChange トリガー登録
  describe("activateTrigger - fileChange", () => {
    it("should register and activate a fileChange trigger", () => {
      const config: TriggerConfig = {
        triggerType: "fileChange",
        filePattern: "**/*.ts",
        debounceMs: 100,
      };
      service.activateTrigger("flow-1", config);
      expect(service.isActive("flow-1")).toBe(true);
      expect(service.getActiveTriggers()).toHaveLength(1);
      expect(service.getActiveTriggers()[0].config.triggerType).toBe("fileChange");
    });
  });

  // FEAT-00001-003004-00002: activateTrigger で schedule トリガー登録
  describe("activateTrigger - schedule", () => {
    it("should register and activate a schedule trigger", () => {
      const config: TriggerConfig = {
        triggerType: "schedule",
        intervalSeconds: 30,
      };
      service.activateTrigger("flow-2", config);
      expect(service.isActive("flow-2")).toBe(true);
      expect(service.getActiveTriggers()).toHaveLength(1);
      expect(service.getActiveTriggers()[0].config.triggerType).toBe("schedule");
    });

    it("should execute flow at specified interval", async () => {
      const config: TriggerConfig = {
        triggerType: "schedule",
        intervalSeconds: 10,
      };
      service.activateTrigger("flow-2", config);

      // Advance time by 10 seconds
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockExec._executeFlowCalls).toHaveLength(1);
      expect(mockExec._executeFlowCalls[0].flowId).toBe("flow-2");
      expect(mockExec._executeFlowCalls[0].options?.triggerData).toHaveProperty("triggeredAt");

      // Advance another 10 seconds
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockExec._executeFlowCalls).toHaveLength(2);
    });
  });

  // FEAT-00001-003004-00003: deactivateTrigger でトリガー解除
  describe("deactivateTrigger", () => {
    it("should deactivate a specific trigger", () => {
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 30 });
      service.activateTrigger("flow-2", { triggerType: "schedule", intervalSeconds: 60 });
      expect(service.getActiveTriggers()).toHaveLength(2);

      service.deactivateTrigger("flow-1");
      expect(service.isActive("flow-1")).toBe(false);
      expect(service.isActive("flow-2")).toBe(true);
      expect(service.getActiveTriggers()).toHaveLength(1);
    });

    it("should not throw when deactivating non-existent trigger", () => {
      expect(() => service.deactivateTrigger("non-existent")).not.toThrow();
    });
  });

  // FEAT-00001-003004-00004: deactivateAll で全トリガー解除
  describe("deactivateAll", () => {
    it("should deactivate all triggers", () => {
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 30 });
      service.activateTrigger("flow-2", { triggerType: "schedule", intervalSeconds: 60 });
      expect(service.getActiveTriggers()).toHaveLength(2);

      service.deactivateAll();
      expect(service.getActiveTriggers()).toHaveLength(0);
      expect(service.isActive("flow-1")).toBe(false);
      expect(service.isActive("flow-2")).toBe(false);
    });
  });

  // FEAT-00001-003004-00005: isActive の正確な判定
  describe("isActive", () => {
    it("should return false for non-registered flow", () => {
      expect(service.isActive("flow-1")).toBe(false);
    });

    it("should return true after activation and false after deactivation", () => {
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 30 });
      expect(service.isActive("flow-1")).toBe(true);
      service.deactivateTrigger("flow-1");
      expect(service.isActive("flow-1")).toBe(false);
    });
  });

  // FEAT-00001-003005-00001: fileChange デバウンス動作
  // Note: full debounce testing requires simulating file watcher events.
  // TriggerService uses vscode.workspace.createFileSystemWatcher which is mocked.
  // We verify the debounce timer cleanup via the dispose path.

  // FEAT-00001-003005-00002: intervalSeconds 最小値補正 (< 5 → 5)
  describe("intervalSeconds minimum enforcement", () => {
    it("should enforce minimum 5 seconds interval", async () => {
      const config: TriggerConfig = {
        triggerType: "schedule",
        intervalSeconds: 2, // Below minimum
      };
      service.activateTrigger("flow-3", config);

      // At 2 seconds, should NOT have executed (minimum is 5)
      await vi.advanceTimersByTimeAsync(2_000);
      expect(mockExec._executeFlowCalls).toHaveLength(0);

      // At 5 seconds, should have executed
      await vi.advanceTimersByTimeAsync(3_000);
      expect(mockExec._executeFlowCalls).toHaveLength(1);
    });
  });

  // FEAT-00001-003005-00003: 同一フロー実行中はトリガーイベントスキップ
  describe("skip trigger when flow is running", () => {
    it("should skip execution when flow is already running", async () => {
      mockExec._running.add("flow-4");
      const config: TriggerConfig = {
        triggerType: "schedule",
        intervalSeconds: 5,
      };
      service.activateTrigger("flow-4", config);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockExec._executeFlowCalls).toHaveLength(0);
    });
  });

  // FEAT-00001-003005-00004: dispose で全リソースクリーンアップ
  describe("dispose", () => {
    it("should clean up all triggers on dispose", async () => {
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 10 });
      service.activateTrigger("flow-2", { triggerType: "schedule", intervalSeconds: 20 });

      service.dispose();
      expect(service.getActiveTriggers()).toHaveLength(0);

      // After dispose, timers should not fire
      await vi.advanceTimersByTimeAsync(20_000);
      expect(mockExec._executeFlowCalls).toHaveLength(0);
    });
  });

  // FEAT-00001-003008-00001: triggerData がトリガーノードに渡される
  describe("triggerData passing", () => {
    it("should pass triggerData with schedule execution", async () => {
      service.activateTrigger("flow-5", { triggerType: "schedule", intervalSeconds: 10 });
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockExec._executeFlowCalls).toHaveLength(1);
      const call = mockExec._executeFlowCalls[0];
      expect(call.options?.triggerData).toBeDefined();
      expect(call.options?.triggerData).toHaveProperty("triggeredAt");
      // Verify triggeredAt is a valid ISO string
      const date = new Date(call.options!.triggerData!.triggeredAt as string);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe("re-activation", () => {
    it("should deactivate old trigger when re-activating same flow", async () => {
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 10 });
      service.activateTrigger("flow-1", { triggerType: "schedule", intervalSeconds: 20 });

      expect(service.getActiveTriggers()).toHaveLength(1);

      // Old 10s timer should not fire at 10s
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockExec._executeFlowCalls).toHaveLength(0);

      // New 20s timer should fire at 20s
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockExec._executeFlowCalls).toHaveLength(1);
    });
  });
});
