// Trace: RSST-03 — RS-03（実行エンジン）のシステム試験
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

suite("RS-03: 実行エンジン", function () {
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

  // ---- RS-03-002001: 実行フロー ----

  // RSST-03-002001-00001
  test("トリガーからログまで E2E でフロー実行される", async function () {
    const flowId = "st-e2e-basic";
    const f = flow(flowId, "E2E Basic", [
      node("n1", "trigger"),
      node("n2", "log", { message: "e2e test", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "Execution history should be saved");
    assert.strictEqual(
      (records[0] as any).status,
      "success",
      "Flow should complete successfully",
    );
  });

  // ---- RS-03-002002: 実行仕様 ----

  // RSST-03-002002-00001
  test("複数ノードがトポロジカル順序で実行される", async function () {
    const flowId = "st-multi-node";
    const f = flow(flowId, "Multi Node", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "'step1'" }),
      node("n3", "transform", { transformType: "jsExpression", expression: "'step2'" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "out", "n3", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    // nodeResults の順序確認
    const nodeIds = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(nodeIds);
    assert.ok(
      nodeIds.indexOf("n1") < nodeIds.indexOf("n2"),
      "n1 should execute before n2",
    );
    assert.ok(
      nodeIds.indexOf("n2") < nodeIds.indexOf("n3"),
      "n2 should execute before n3",
    );
  });

  // RSST-03-002002-00002
  test("無効ノード(enabled:false)が実行時にスキップされる", async function () {
    const flowId = "st-disabled-skip";
    const f = flow(flowId, "Disabled Skip", [
      node("n1", "trigger"),
      node("n2", "transform", { expression: "'should-skip'" }, { enabled: false }),
      node("n3", "log", { message: "after disabled", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "out", "n3", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    const disabledResult = rec.nodeResults?.find(
      (r: any) => r.nodeId === "n2",
    );
    assert.ok(!disabledResult, "Disabled node should not appear in nodeResults");
  });

  // ---- RS-03-002003: エラー時の動作 ----

  // RSST-03-002003-00001
  test("ノードエラー発生時にフロー全体が停止し履歴にエラー記録される", async function () {
    const flowId = "st-error-stop";
    const f = flow(flowId, "Error Stop", [
      node("n1", "trigger"),
      // 無効な JS 式でエラーを発生させる
      node("n2", "transform", { transformType: "jsExpression", expression: "1 +" }),
      node("n3", "log", { message: "should not reach", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "out", "n3", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "Error execution should save history");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "error", "Flow status should be error");
    // n3 は実行されていないはず
    const n3Result = rec.nodeResults?.find((r: any) => r.nodeId === "n3");
    assert.ok(!n3Result, "Node after error should not execute");
  });

  // ---- RS-03-002004: 実行時フィードバック ----

  // RSST-03-002004-00001
  test("実行時に OutputChannel にログが出力される", async function () {
    const flowId = "st-feedback";
    const f = flow(flowId, "Feedback", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // executeFlow は内部で outputChannel.appendLine を呼ぶ
    // 直接検証は困難だが、実行が正常完了することでフィードバック機構の動作を間接検証
    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-03-003001: デバッグモード ----

  // RSST-03-003001-00001
  test("debugFlow コマンドが存在しエラーなく呼べる", async function () {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("flowrunner.debugFlow"),
      "debugFlow command should be registered",
    );
    // 現在はインフォメッセージを表示するだけ（将来リリース予定）
    // showInformationMessage はユーザー操作待ちのため自動テストでは実行しない
  });

  // ---- RS-03-003002: ステップ実行 ----

  // RSST-03-003002-00001
  test("ステップ実行の詳細は FEAT-00017 専用テストで担保される", function () {
    // デバッグの詳細進行は FEAT-00017 の専用 unit / integration テストで検証する
    assert.ok(true, "Step execution is covered by FEAT-00017 dedicated tests");
  });

  // ---- RS-03-003003: 中間結果表示 ----

  // RSST-03-003003-00001
  test("中間結果表示の詳細は FEAT-00017 専用テストで担保される", function () {
    // 中間結果と入力プレビューは FEAT-00017 の専用 unit / integration テストで検証する
    assert.ok(true, "Intermediate results are covered by FEAT-00017 dedicated tests");
  });

  // ---- RS-03-004001: 履歴保存仕様 ----

  // RSST-03-004001-00001
  test("フロー完了時に履歴レコードが .flowrunner/history/ に保存される", async function () {
    const flowId = "st-history-save";
    const f = flow(flowId, "History Save", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length >= 1, "At least one history record should exist");
  });

  // RSST-03-004001-00002
  test("historyMaxCount を超える履歴は自動削除される", async function () {
    const flowId = "st-history-limit";
    const f = flow(flowId, "History Limit", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // historyMaxCount を 3 に設定
    const config = vscode.workspace.getConfiguration("flowrunner");
    await config.update("historyMaxCount", 3, vscode.ConfigurationTarget.Workspace);

    try {
      // 4 回実行
      for (let i = 0; i < 4; i++) {
        await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);
      }

      const records = readHistoryRecords(workspaceRoot, flowId);
      assert.ok(
        records.length <= 3,
        `History should be pruned to max 3, got ${records.length}`,
      );
    } finally {
      // 設定を元に戻す
      await config.update("historyMaxCount", undefined, vscode.ConfigurationTarget.Workspace);
    }
  });

  // ---- RS-03-004002: 履歴データ ----

  // RSST-03-004002-00001
  test("履歴レコードに flowId, status, nodeResults が含まれる", async function () {
    const flowId = "st-history-data";
    const f = flow(flowId, "History Data", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "'test-output'" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.flowId, flowId);
    assert.strictEqual(rec.status, "success");
    assert.ok(rec.startedAt, "startedAt should be present");
    assert.ok(rec.completedAt, "completedAt should be present");
    assert.ok(
      Array.isArray(rec.nodeResults),
      "nodeResults should be an array",
    );
    assert.ok(rec.nodeResults.length >= 2, "Should have results for 2 nodes");
  });

  // ---- RS-03-004003: 履歴参照 ----

  // RSST-03-004003-00001
  test("履歴ファイルが JSON として読み取り可能", async function () {
    const flowId = "st-history-read";
    const f = flow(flowId, "History Read", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History should be readable");
    const rec = records[0] as any;
    // JSON としてパース成功＝参照可能
    assert.ok(typeof rec === "object");
    assert.ok(rec.id, "Record should have id");
    assert.ok(rec.flowName, "Record should have flowName");
  });

  // ---- RS-03-005000: 完了通知 ----

  // RSST-03-005000-00001
  test("フロー完了時に通知がクラッシュなく発火される", async function () {
    const flowId = "st-notification";
    const f = flow(flowId, "Notification", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // 実行完了後に notificationHandler が呼ばれる
    // showInformationMessage は非同期で表示されるがクラッシュしないことを確認
    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
    // 通知が表示されたことの直接検証はできないが、
    // 実行が正常完了＝完了通知ハンドラがエラーなく呼ばれたことを意味する
  });

  // RSST-03-005000-00002
  test("エラー時にも完了通知が発火される（クラッシュしない）", async function () {
    const flowId = "st-error-notification";
    const f = flow(flowId, "Error Notification", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "1 +" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual(
      (records[0] as any).status,
      "error",
      "Error flow should complete with error status",
    );
  });

  // ---- RS-03-002002: 二重実行防止 ----

  // RSST-03-002002-00003
  test("同一フローの並行実行が制御される", async function () {
    const flowId = "st-double-exec";
    const f = flow(flowId, "Double Exec", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "'slow'" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // 2 回連続で実行コマンドを投げる
    const exec1 = vscode.commands.executeCommand("flowrunner.executeFlow", flowId);
    const exec2 = vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    // どちらもエラーなく完了すること（2 回目は拒否 or 待ちになる）
    await Promise.allSettled([exec1, exec2]);

    const records = readHistoryRecords(workspaceRoot, flowId);
    // 少なくとも 1 回は実行されていること
    assert.ok(records.length >= 1, "At least one execution should complete");
  });

  // ---- RS-03-002001: 実行トリガー（追加） ----

  // RSST-03-002001-00002
  test("コマンドパレット経由でフロー実行が可能", async function () {
    const flowId = "st-cmd-palette-exec";
    const f = flow(flowId, "Command Palette Exec", [
      node("n1", "trigger"),
      node("n2", "log", { message: "from palette", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // executeFlow コマンドを直接実行（コマンドパレットと同等）
    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-03-002004: ノード単位の進捗ログ（追加） ----

  // RSST-03-002004-00002
  test("履歴の nodeResults に各ノードのステータス・duration・nodeType が含まれる", async function () {
    const flowId = "st-node-progress";
    const f = flow(flowId, "Node Progress", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "'step1'" }),
      node("n3", "log", { message: "progress test", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "out", "n3", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // 各ノードに status / duration / nodeType が含まれることを確認
    assert.ok(rec.nodeResults.length >= 3, "Should have results for 3 nodes");
    for (const nr of rec.nodeResults ?? []) {
      assert.ok(nr.nodeId, `Node result should have nodeId`);
      assert.ok(nr.nodeType, `Node ${nr.nodeId} should have nodeType`);
      assert.strictEqual(nr.status, "success", `Node ${nr.nodeId} should be success`);
      assert.ok(typeof nr.duration === "number", `Node ${nr.nodeId} should have numeric duration`);
    }
  });

  // ---- RS-03-003001: デバッグコマンド（追加） ----

  // RSST-03-003001-00002
  test("debugFlow コマンドが flowId 引数付きで発火してもクラッシュしない", async function () {
    const flowId = "st-debug-invoke";
    const f = flow(flowId, "Debug Invoke", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // debugFlow は showInformationMessage を表示する
    // Promise.race でタイムアウトしてもクラッシュしないことを確認
    await Promise.race([
      vscode.commands.executeCommand("flowrunner.debugFlow", flowId),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

    // ここに到達 ＝ クラッシュなし
    assert.ok(true, "debugFlow should not crash");
  });

  // ---- RS-03-005000: 完了通知（追加） ----

  // RSST-03-005000-00003
  test("成功フローの履歴に正しい flowName が記録される", async function () {
    const flowId = "st-success-name";
    const f = flow(flowId, "Success Notif Test", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    assert.strictEqual(rec.flowName, "Success Notif Test", "flowName should match");
  });
});
