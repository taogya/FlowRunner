// Trace: FEAT サンプルフロー実行の自動テスト
// FEAT-00001(トリガー), FEAT-00002(共有変数) の .flowrunner サンプルフローが正常実行されることを検証する
import * as vscode from "vscode";
import * as assert from "assert";
import {
  writeFlowFile,
  cleanupFlowrunnerDir,
  readHistoryRecords,
  node,
  edge,
  flow,
} from "./helpers.js";

const EXT_ID = "Taogya.taogya-flowrunner";

suite("FEAT: サンプルフロー実行テスト", function () {
  this.timeout(60_000);

  let workspaceRoot: string;

  suiteSetup(async function () {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, "Workspace folder is required");
    workspaceRoot = folders[0].uri.fsPath;

    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, "Extension must be installed");
    if (!ext.isActive) {
      await ext.activate();
    }
  });

  suiteTeardown(function () {
    cleanupFlowrunnerDir(workspaceRoot);
  });

  // ========================================================================
  // FEAT-00001: イベント/スケジュールトリガー
  // ========================================================================

  // FEAT-00001-003003-00010
  test("FEAT-00001: ファイル変更トリガーフローが手動実行で正常完了する", async function () {
    const flowId = "feat01ft-trigger";
    const f = flow(flowId, "FEAT-00001 ファイル変更トリガー", [
      node("trigger", "trigger", {
        triggerType: "fileChange",
        filePattern: "**/*.txt",
        debounceMs: 500,
      }),
      node("log1", "log", { level: "info" }),
    ], [
      edge("e1", "trigger", "out", "log1", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("log1"), "log1 should execute");
  });

  // FEAT-00001-003003-00011
  test("FEAT-00001: スケジュールトリガーフローが手動実行で正常完了する", async function () {
    const flowId = "feat01sc-trigger";
    const f = flow(flowId, "FEAT-00001 スケジュールトリガー", [
      node("trigger", "trigger", {
        triggerType: "schedule",
        intervalSeconds: 10,
      }),
      node("log1", "log", { level: "info" }),
    ], [
      edge("e1", "trigger", "out", "log1", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("log1"), "log1 should execute");
  });

  // ========================================================================
  // FEAT-00002: 共有変数ストア
  // ========================================================================

  // FEAT-00002-003001-00010
  test("FEAT-00002: setVar → getVar で共有変数の読み書きが動作する", async function () {
    const flowId = "feat02rw-setget";
    const f = flow(flowId, "FEAT-00002 共有変数", [
      node("trigger", "trigger", { triggerType: "manual" }),
      node("set-var", "transform", {
        transformType: "setVar",
        varName: "counter",
      }),
      node("log1", "log", { level: "info" }),
      node("get-var", "transform", {
        transformType: "getVar",
        varName: "counter",
        defaultValue: 0,
      }),
      node("log2", "log", { level: "info" }),
    ], [
      edge("e1", "trigger", "out", "set-var", "in"),
      edge("e2", "set-var", "out", "log1", "in"),
      edge("e3", "log1", "out", "get-var", "in"),
      edge("e4", "get-var", "out", "log2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    // 5 ノード全てが実行される
    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("set-var"), "set-var should execute");
    assert.ok(executed.includes("log1"), "log1 should execute");
    assert.ok(executed.includes("get-var"), "get-var should execute");
    assert.ok(executed.includes("log2"), "log2 should execute");
    assert.strictEqual(executed.length, 5, "All 5 nodes should execute");
  });

  // FEAT-00002-003001-00011
  test("FEAT-00002: getVar で未設定変数はデフォルト値を返す", async function () {
    const flowId = "feat02dv-defval";
    const f = flow(flowId, "FEAT-00002 デフォルト値", [
      node("trigger", "trigger", { triggerType: "manual" }),
      node("get-var", "transform", {
        transformType: "getVar",
        varName: "nonexistent",
        defaultValue: 99,
      }),
      node("log1", "log", { level: "info" }),
    ], [
      edge("e1", "trigger", "out", "get-var", "in"),
      edge("e2", "get-var", "out", "log1", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    // getVar の出力がデフォルト値 99 であることを確認
    const getVarResult = rec.nodeResults?.find(
      (r: any) => r.nodeId === "get-var",
    );
    assert.ok(getVarResult, "get-var result should exist");
    assert.strictEqual(
      getVarResult.outputs?.out,
      99,
      "should return default value for unset variable",
    );
  });

  // ========================================================================
  // FEAT-00006: エラーハンドリングノード (TryCatch)
  // ========================================================================

  // FEAT-00006-003003-00010
  test("FEAT-00006: tryCatch ノードが try パスを正常実行する", async function () {
    const flowId = "feat06ok-trycatch";
    const f = flow(flowId, "FEAT-00006 TryCatch正常系", [
      node("trigger", "trigger", { triggerType: "manual" }),
      node("tc", "tryCatch", {}),
      node("try-log", "log", { level: "info" }),
      node("catch-log", "log", { level: "error" }),
      node("done-log", "log", { level: "info" }),
    ], [
      edge("e1", "trigger", "out", "tc", "in"),
      edge("e2", "tc", "try", "try-log", "in"),
      edge("e3", "tc", "catch", "catch-log", "in"),
      edge("e4", "tc", "done", "done-log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("tc"), "tryCatch should execute");
    assert.ok(executed.includes("try-log"), "try-log should execute");
    assert.ok(executed.includes("done-log"), "done-log should execute");
  });

  // ========================================================================
  // FEAT-00007: 並列実行 (Parallel)
  // ========================================================================

  // FEAT-00007-003003-00010
  test("FEAT-00007: parallel ノードが全ブランチを実行する", async function () {
    const flowId = "feat07pa-parallel";
    const f = flow(flowId, "FEAT-00007 並列実行", [
      node("trigger", "trigger", { triggerType: "manual" }),
      node("par", "parallel", {}),
      node("b1-log", "log", { level: "info", label: "Branch1 Log" }),
      node("b2-log", "log", { level: "info", label: "Branch2 Log" }),
      node("done-log", "log", { level: "info", label: "Done Log" }),
    ], [
      edge("e1", "trigger", "out", "par", "in"),
      edge("e2", "par", "branch1", "b1-log", "in"),
      edge("e3", "par", "branch2", "b2-log", "in"),
      edge("e4", "par", "done", "done-log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("par"), "parallel should execute");
    assert.ok(executed.includes("b1-log"), "branch1 log should execute");
    assert.ok(executed.includes("b2-log"), "branch2 log should execute");
    assert.ok(executed.includes("done-log"), "done-log should execute");
  });

  // FEAT-00007-003003-00011
  test("FEAT-00007: parallel ノードで未接続ブランチがあっても正常動作する", async function () {
    const flowId = "feat07sb-parallel";
    const f = flow(flowId, "FEAT-00007 並列実行 単一ブランチ", [
      node("trigger", "trigger", { triggerType: "manual" }),
      node("par", "parallel", {}),
      node("b1-log", "log", { level: "info", label: "Branch1 Log" }),
      node("done-log", "log", { level: "info", label: "Done Log" }),
    ], [
      edge("e1", "trigger", "out", "par", "in"),
      edge("e2", "par", "branch1", "b1-log", "in"),
      // branch2, branch3 is not connected
      edge("e3", "par", "done", "done-log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "Flow should succeed");

    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("par"), "parallel should execute");
    assert.ok(executed.includes("b1-log"), "branch1 log should execute");
    assert.ok(executed.includes("done-log"), "done-log should execute");
  });
});
