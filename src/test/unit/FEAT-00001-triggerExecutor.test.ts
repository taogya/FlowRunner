/**
 * FEAT-00001: TriggerExecutor unit tests
 *
 * Tests for TriggerExecutor settings schema, validation, and output data.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TriggerExecutor } from "@extension/executors/TriggerExecutor.js";
import type { IExecutionContext } from "@extension/interfaces/INodeExecutor.js";

describe("TriggerExecutor (FEAT-00001)", () => {
  let executor: TriggerExecutor;

  beforeEach(() => {
    executor = new TriggerExecutor();
  });

  // FEAT-00001-003001-00001: manual トリガーで既存動作維持
  describe("manual trigger", () => {
    it("should output empty object when triggerData is not set", async () => {
      const context: IExecutionContext = {
        nodeId: "trigger-1",
        settings: { triggerType: "manual" },
        inputs: {},
        flowId: "flow-1",
        signal: new AbortController().signal,
      };
      const result = await executor.execute(context);
      expect(result.status).toBe("success");
      expect(result.outputs).toEqual({ out: {} });
    });
  });

  // FEAT-00001-003002-00001: settingsSchema に全フィールド定義あり
  describe("settings schema", () => {
    it("should contain all required fields in settingsSchema", () => {
      const meta = executor.getMetadata();
      const keys = meta.settingsSchema.map((f) => f.key);
      expect(keys).toContain("triggerType");
      expect(keys).toContain("filePattern");
      expect(keys).toContain("debounceMs");
      expect(keys).toContain("intervalSeconds");
    });

    // FEAT-00001-003002-00002: visibleWhen が正しく設定されている
    it("should have correct visibleWhen conditions", () => {
      const meta = executor.getMetadata();
      const filePattern = meta.settingsSchema.find((f) => f.key === "filePattern");
      const debounceMs = meta.settingsSchema.find((f) => f.key === "debounceMs");
      const intervalSeconds = meta.settingsSchema.find((f) => f.key === "intervalSeconds");

      expect(filePattern?.visibleWhen).toEqual({ field: "triggerType", value: "fileChange" });
      expect(debounceMs?.visibleWhen).toEqual({ field: "triggerType", value: "fileChange" });
      expect(intervalSeconds?.visibleWhen).toEqual({ field: "triggerType", value: "schedule" });
    });
  });

  // FEAT-00001-003003-00001: fileChange トリガーの出力データ形式
  describe("trigger output data", () => {
    it("should pass triggerData for fileChange trigger", async () => {
      const triggerData = { filePath: "file:///test.ts", changeType: "changed" };
      const context: IExecutionContext = {
        nodeId: "trigger-1",
        settings: { triggerType: "fileChange", filePattern: "**/*.ts" },
        inputs: {},
        flowId: "flow-1",
        signal: new AbortController().signal,
        triggerData,
      };
      const result = await executor.execute(context);
      expect(result.status).toBe("success");
      expect(result.outputs).toEqual({ out: triggerData });
    });

    // FEAT-00001-003003-00002: schedule トリガーの出力データ形式
    it("should pass triggerData for schedule trigger", async () => {
      const triggerData = { triggeredAt: "2026-01-01T00:00:00.000Z" };
      const context: IExecutionContext = {
        nodeId: "trigger-1",
        settings: { triggerType: "schedule", intervalSeconds: 60 },
        inputs: {},
        flowId: "flow-1",
        signal: new AbortController().signal,
        triggerData,
      };
      const result = await executor.execute(context);
      expect(result.status).toBe("success");
      expect(result.outputs).toEqual({ out: triggerData });
    });

    // FEAT-00001-003003-00003: triggerData 未設定時の manual フォールバック
    it("should fallback to empty object when triggerData is not provided", async () => {
      const context: IExecutionContext = {
        nodeId: "trigger-1",
        settings: {},
        inputs: {},
        flowId: "flow-1",
        signal: new AbortController().signal,
      };
      const result = await executor.execute(context);
      expect(result.status).toBe("success");
      expect(result.outputs).toEqual({ out: {} });
    });
  });

  describe("validation", () => {
    it("should accept manual trigger with no extra settings", () => {
      const result = executor.validate({ triggerType: "manual" });
      expect(result.valid).toBe(true);
    });

    it("should reject fileChange trigger without filePattern", () => {
      const result = executor.validate({ triggerType: "fileChange" });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]?.field).toBe("filePattern");
    });

    it("should accept fileChange trigger with filePattern", () => {
      const result = executor.validate({ triggerType: "fileChange", filePattern: "**/*.ts" });
      expect(result.valid).toBe(true);
    });

    it("should reject schedule trigger without intervalSeconds", () => {
      const result = executor.validate({ triggerType: "schedule" });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]?.field).toBe("intervalSeconds");
    });

    it("should accept schedule trigger with intervalSeconds", () => {
      const result = executor.validate({ triggerType: "schedule", intervalSeconds: 30 });
      expect(result.valid).toBe(true);
    });
  });

  describe("cancellation", () => {
    it("should return cancelled when signal is aborted", async () => {
      const ac = new AbortController();
      ac.abort();
      const context: IExecutionContext = {
        nodeId: "trigger-1",
        settings: { triggerType: "manual" },
        inputs: {},
        flowId: "flow-1",
        signal: ac.signal,
      };
      const result = await executor.execute(context);
      expect(result.status).toBe("cancelled");
    });
  });
});
