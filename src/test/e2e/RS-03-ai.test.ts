// Trace: RSST-03 — RS-03（実行エンジン）AI プロンプトノード自動テスト
// RS10: モデル選択済み・モデル未選択を分離テスト
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

suite("RS-03: AI プロンプトノード実行シナリオ (RS10)", function () {
  this.timeout(120_000); // AI 応答は時間がかかるため長めに設定

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
  // RS10-A: AI モデル選択済み — 正常系
  // ========================================================================

  // RSST-03-002002-00017
  test("RS10-A: AI プロンプトノードがモデル選択済みで正常実行される", async function () {
    // AI モデルが利用可能か事前チェック（--disable-extensions 環境では不可）
    const models = await vscode.lm.selectChatModels({ family: "oswe-vscode-prime" });
    if (models.length === 0) {
      this.skip(); // AI モデル未利用可の環境ではスキップ
      return;
    }

    const flowId = "st-rs10-ai-ok";
    const f = flow(flowId, "RS10 AI OK", [
      node("trigger", "trigger"),
      node("ai", "aiPrompt", {
        model: "oswe-vscode-prime",
        prompt: "「Hello」と返答してください。",
        systemPrompt: "あなたは簡潔に回答するアシスタントです。",
        temperature: 0.3,
        maxTokens: 100,
      }),
      node("log_out", "log", { message: "AI応答: {{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "ai", "in"),
      edge("e2", "ai", "out", "log_out", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "history record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "flow should succeed");

    // AI ノードが実行され、out にレスポンスが含まれる
    const aiResult = rec.nodeResults?.find((r: any) => r.nodeId === "ai");
    assert.ok(aiResult, "ai node should execute");
    assert.strictEqual(aiResult.status, "success", "ai node should succeed");
    assert.ok(aiResult.outputs?.out, "ai node should produce output on 'out' port");
    assert.ok(
      typeof aiResult.outputs.out === "string" && aiResult.outputs.out.length > 0,
      "ai output should be a non-empty string",
    );
  });

  // RSST-03-002002-00018
  test("RS10-A: AI プロンプトノードが _tokenUsage ポートにトークン使用量を出力する", async function () {
    // AI モデルが利用可能か事前チェック
    const models = await vscode.lm.selectChatModels({ family: "oswe-vscode-prime" });
    if (models.length === 0) {
      this.skip(); // AI モデル未利用可の環境ではスキップ
      return;
    }

    const flowId = "st-r10tk-ai-token";
    const f = flow(flowId, "RS10 AI Token", [
      node("trigger", "trigger"),
      node("ai", "aiPrompt", {
        model: "oswe-vscode-prime",
        prompt: "「Hello」と返答してください。",
        systemPrompt: "あなたは簡潔に回答するアシスタントです。",
        temperature: 0.3,
        maxTokens: 100,
      }),
      node("log_token", "log", { message: "Token: {{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "ai", "in"),
      edge("e2", "ai", "_tokenUsage", "log_token", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0, "history record should exist");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success", "flow should succeed");

    // _tokenUsage ポートにオブジェクトが出力される
    const aiResult = rec.nodeResults?.find((r: any) => r.nodeId === "ai");
    assert.ok(aiResult, "ai node should execute");
    assert.ok(aiResult.outputs?._tokenUsage, "_tokenUsage port should have output");
    assert.strictEqual(
      typeof aiResult.outputs._tokenUsage,
      "object",
      "_tokenUsage should be an object",
    );
  });

  // ========================================================================
  // RS10-B: AI モデル未選択 — エラー系
  // ========================================================================

  // RSST-03-002002-00019
  test("RS10-B: AI プロンプトノードがモデル未選択で実行前バリデーションにより停止する", async function () {
    const flowId = "st-r10er-ai-err";
    const f = flow(flowId, "RS10 AI Error", [
      node("trigger", "trigger"),
      node("ai-no-model", "aiPrompt", {
        // model は意図的に未設定
        prompt: "テスト用プロンプト",
        temperature: 0.7,
        maxTokens: 1024,
      }),
    ], [
      edge("e1", "trigger", "out", "ai-no-model", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    // 少し待機（モーダル処理反映待ち）
    await new Promise((r) => setTimeout(r, 500));

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.strictEqual(
      records.length,
      0,
      "preflight validation should block execution before history is written",
    );
  });
});
