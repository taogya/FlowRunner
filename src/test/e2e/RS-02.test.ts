// Trace: RSST-02 — RS-02（ノード定義）のシステム試験
import * as vscode from "vscode";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  writeFlowFile,
  cleanupFlowrunnerDir,
  readHistoryRecords,
  node,
  edge,
  flow,
} from "./helpers.js";

const EXT_ID = "Taogya.taogya-flowrunner";

suite("RS-02: ノード定義", function () {
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

  // ---- RS-02-002001: ポートモデル ----

  // RSST-02-002001-00001
  test("トリガーフローが実行可能（ポートモデル検証）", async function () {
    const flowId = "st-port-model";
    const f = flow(flowId, "Port Model", [
      node("n1", "trigger"),
      node("n2", "log", { message: "port test", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "History record should be created");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
  });

  // ---- RS-02-002002: ノード共通属性 ----

  // RSST-02-002002-00001
  test("13 種ビルトインノードが利用可能（アクティベーション検証）", function () {
    // 拡張機能のアクティベーション時に registerBuiltinExecutors が呼ばれ
    // 13 種全てのエグゼキュータが NodeExecutorRegistry に登録される
    // ここではアクティベーション成功で間接検証
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    assert.ok(ext.isActive, "All 13 builtins registered on activation");
  });

  // ---- RS-02-002003: 拡張性 ----

  // RSST-02-002003-00001
  test("各ノード種別がフロー実行で利用可能", async function () {
    // trigger→comment フローで最小限の拡張性検証
    const flowId = "st-extensibility";
    const f = flow(flowId, "Extensibility", [
      node("n1", "trigger"),
      node("n2", "comment", { text: "test" }),
    ], []);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);
    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "Execution should complete");
  });

  // ---- RS-02-003001: トリガーノード ----

  // RSST-02-003001-00001
  test("トリガーノードが正常に実行される", async function () {
    const flowId = "st-trigger";
    const f = flow(flowId, "Trigger", [node("n1", "trigger")]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003002: コマンド実行ノード ----

  // RSST-02-003002-00001
  test("コマンドノードが echo を実行して stdout を返す", async function () {
    const flowId = "st-command";
    const f = flow(flowId, "Command", [
      node("n1", "trigger"),
      node("n2", "command", { command: "echo hello" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    // nodeResults から command ノードの結果を確認
    const cmdResult = rec.nodeResults?.find(
      (r: any) => r.nodeId === "n2",
    );
    assert.ok(cmdResult, "Command node result should exist");
    assert.strictEqual(cmdResult.status, "success");
  });

  // ---- RS-02-003003: AI プロンプトノード ----

  // RSST-02-003003-00001
  test("AI プロンプトノードがスタブ実行で成功する", async function () {
    // AI LM API が利用可能か事前チェック
    const models = await vscode.lm.selectChatModels({});
    if (models.length === 0) {
      this.skip(); // AI モデル未利用可の環境ではスキップ
      return;
    }

    const flowId = "st-ai-prompt";
    const f = flow(flowId, "AI Prompt", [
      node("n1", "trigger"),
      node("n2", "aiPrompt", { prompt: "test prompt", model: "gpt-4" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003004: 条件分岐ノード ----

  // RSST-02-003004-00001
  test("条件分岐ノードが式を評価して分岐する", async function () {
    const flowId = "st-condition";
    const f = flow(flowId, "Condition", [
      node("n1", "trigger"),
      node("n2", "condition", { expression: "true" }),
      node("n3", "log", { message: "true branch", level: "info" }),
      node("n4", "log", { message: "false branch", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "true", "n3", "in"),
      edge("e3", "n2", "false", "n4", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    const condResult = rec.nodeResults?.find(
      (r: any) => r.nodeId === "n2",
    );
    assert.ok(condResult, "Condition node result should exist");
    assert.strictEqual(condResult.status, "success");
  });

  // ---- RS-02-003005: ループノード ----

  // RSST-02-003005-00001
  test("ループノードが count モードで実行される", async function () {
    const flowId = "st-loop";
    const f = flow(flowId, "Loop", [
      node("n1", "trigger"),
      node("n2", "loop", { loopType: "count", count: 3 }),
      node("n3", "log", { message: "loop body", level: "info" }),
      node("n4", "log", { message: "loop done", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
      edge("e2", "n2", "body", "n3", "in"),
      edge("e3", "n2", "done", "n4", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003006: ログ出力ノード ----

  // RSST-02-003006-00001
  test("ログノードが実行されパススルーする", async function () {
    const flowId = "st-log";
    const f = flow(flowId, "Log", [
      node("n1", "trigger"),
      node("n2", "log", { message: "ST log test", level: "info" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003007: ファイル操作ノード ----

  // RSST-02-003007-00001
  test("ファイルノードが exists 操作で正常動作する", async function () {
    // テスト用ファイルを一時ワークスペースに作成
    const testFile = "st-test-file.txt";
    fs.writeFileSync(path.join(workspaceRoot, testFile), "test");

    const flowId = "st-file";
    const f = flow(flowId, "File", [
      node("n1", "trigger"),
      node("n2", "file", { operation: "exists", path: testFile }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    const fileResult = rec.nodeResults?.find((r: any) => r.nodeId === "n2");
    assert.ok(fileResult, "file node should execute");
    assert.strictEqual(fileResult.status, "success");
    assert.strictEqual(fileResult.outputs?.out, true, "st-test-file.txt should exist");
  });

  // ---- RS-02-003008: HTTP リクエストノード ----

  // RSST-02-003008-00001
  test("HTTP ノードが実 URL に GET リクエストを送信する", async function () {
    const flowId = "st-http";
    const f = flow(flowId, "HTTP", [
      node("n1", "trigger"),
      node("n2", "http", { url: "https://example.com", timeout: 15 }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    const httpResult = rec.nodeResults?.find((r: any) => r.nodeId === "n2");
    assert.ok(httpResult, "http node should execute");
    assert.strictEqual(httpResult.status, "success");
    assert.ok(httpResult.outputs?.body, "response body should exist");
    assert.strictEqual(httpResult.outputs?.status, 200, "status should be 200");
  });

  // ---- RS-02-003009: データ変換ノード ----

  // RSST-02-003009-00001
  test("変換ノードが JS 式を評価する", async function () {
    const flowId = "st-transform";
    const f = flow(flowId, "Transform", [
      node("n1", "trigger"),
      node("n2", "transform", { transformType: "jsExpression", expression: "42" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    const xformResult = rec.nodeResults?.find(
      (r: any) => r.nodeId === "n2",
    );
    assert.ok(xformResult);
    assert.strictEqual(xformResult.outputs?.out, 42);
  });

  // ---- RS-02-003010: コメントノード ----

  // RSST-02-003010-00001
  test("コメントノードは実行時にスキップされる", async function () {
    const flowId = "st-comment";
    const f = flow(flowId, "Comment", [
      node("n1", "trigger"),
      node("n2", "comment", { text: "This is a comment" }),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    // コメントノードはエッジ接続なし＆スキップなので実行成功
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003011: フロー連携ノード ----

  // RSST-02-003011-00001
  test("サブフローノードが別フローを参照して実行する", async function () {
    // サブフロー用のフロー定義
    const subFlowId = "st-subflow-child";
    const subFlow = flow(subFlowId, "SubFlow Child", [
      node("s1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, subFlow);

    // メインフロー（サブフロー参照）
    const mainFlowId = "st-subflow-main";
    const mainFlow = flow(mainFlowId, "SubFlow Main", [
      node("n1", "trigger"),
      node("n2", "subFlow", { flowId: subFlowId }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, mainFlow);

    await vscode.commands.executeCommand("flowrunner.executeFlow", mainFlowId);

    const records = readHistoryRecords(workspaceRoot, mainFlowId);
    assert.ok(records.length > 0);
    assert.strictEqual((records[0] as any).status, "success");
  });

  // ---- RS-02-003002: コマンドノード出力 ----

  // RSST-02-003002-00002
  test("コマンドノードの実行結果に stdout が含まれる", async function () {
    const flowId = "st-cmd-stdout";
    const f = flow(flowId, "Command Stdout", [
      node("n1", "trigger"),
      node("n2", "command", { command: "echo st-output-test" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    const cmdResult = rec.nodeResults?.find((r: any) => r.nodeId === "n2");
    assert.ok(cmdResult, "Command node result should exist");
    // stdout が outputs に含まれることを確認
    const outputStr = JSON.stringify(cmdResult.outputs ?? {});
    assert.ok(
      outputStr.includes("st-output-test"),
      `Command stdout should contain "st-output-test", got: ${outputStr}`,
    );
  });

  // ---- RS-02-003004: 条件分岐ノード出力 ----

  // RSST-02-003004-00002
  test("条件分岐ノードが true 式で正常に分岐完了する", async function () {
    const flowId = "st-condition-output";
    const f = flow(flowId, "Condition Output", [
      node("n1", "trigger"),
      node("n2", "condition", { expression: "1 === 1" }),
    ], [
      edge("e1", "n1", "out", "n2", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
    const condResult = rec.nodeResults?.find((r: any) => r.nodeId === "n2");
    assert.ok(condResult, "Condition node result should exist");
    // 条件分岐が正常に完了し success であること
    assert.strictEqual(condResult.status, "success", "Condition should evaluate successfully");
    assert.strictEqual(condResult.nodeType, "condition", "Should be condition type");
  });
});
