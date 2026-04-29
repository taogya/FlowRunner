// Trace: RSST-03 — RS-03（実行エンジン）RSフロー実行シナリオの自動テスト
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

suite("RS-03: RSフロー実行シナリオ", function () {
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
  // RS01: 基本チェーン（Trigger → Command → Log）
  // ========================================================================

  // RSST-03-002002-00004
  test("RS01: trigger→command→log の基本チェーンが正常実行される", async function () {
    const flowId = "st-rs01-basic";
    const f = flow(flowId, "RS01 Basic Chain", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: "echo Hello" }),
      node("log1", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "log1", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // trigger → cmd → log1 の 3 ノードが実行される
    const executed = rec.nodeResults?.map((r: any) => r.nodeId);
    assert.ok(executed.includes("trigger"), "trigger should execute");
    assert.ok(executed.includes("cmd"), "cmd should execute");
    assert.ok(executed.includes("log1"), "log1 should execute");

    // command stdout が "Hello" を含む
    const cmdResult = rec.nodeResults?.find((r: any) => r.nodeId === "cmd");
    assert.ok(cmdResult?.outputs?.stdout?.includes("Hello"), "stdout should contain Hello");
  });

  // ========================================================================
  // RS02: stdout/stderr 分離
  // ========================================================================

  // RSST-03-002002-00005
  test("RS02: command の stdout と stderr が分離して出力される", async function () {
    const flowId = "st-rs02-stdio";
    const f = flow(flowId, "RS02 stdio", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: "echo STDOUT_DATA; echo STDERR_DATA >&2" }),
      node("log_out", "log", { message: "{{input}}", level: "info" }),
      node("log_err", "log", { message: "{{input}}", level: "warn" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "log_out", "in"),
      edge("e3", "cmd", "stderr", "log_err", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    const cmdResult = rec.nodeResults?.find((r: any) => r.nodeId === "cmd");
    assert.ok(cmdResult?.outputs?.stdout?.includes("STDOUT_DATA"), "stdout should contain STDOUT_DATA");
    assert.ok(cmdResult?.outputs?.stderr?.includes("STDERR_DATA"), "stderr should contain STDERR_DATA");
  });

  // ========================================================================
  // RS03: 条件分岐
  // ========================================================================

  // RSST-03-002002-00006
  test("RS03: condition ノードが true/false 分岐を正しくルーティングする", async function () {
    const flowId = "st-rs03-cond";
    const f = flow(flowId, "RS03 Condition", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: "echo test_value" }),
      node("cond", "condition", { expression: "input != null && input !== ''" }),
      node("log_true", "log", { message: "TRUE: {{input}}", level: "info" }),
      node("log_false", "log", { message: "FALSE: {{input}}", level: "warn" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "cond", "in"),
      edge("e3", "cond", "true", "log_true", "in"),
      edge("e4", "cond", "false", "log_false", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // condition ノードの出力に true が含まれること
    const condResult = rec.nodeResults?.find((r: any) => r.nodeId === "cond");
    assert.ok(condResult, "condition node should execute");
    assert.ok(condResult.outputs?.true !== undefined, "true output should exist");
  });

  // ========================================================================
  // RS04: ループ（カウント）
  // ========================================================================

  // RSST-03-002002-00007
  test("RS04: loop count モードが指定回数だけ実行される", async function () {
    const flowId = "st-rs04-loop";
    const f = flow(flowId, "RS04 Loop Count", [
      node("trigger", "trigger"),
      node("loop", "loop", { mode: "count", count: 3 }),
      node("log_body", "log", { message: "body: {{input}}", level: "info" }),
      node("log_done", "log", { message: "done: {{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "loop", "in"),
      edge("e2", "loop", "body", "log_body", "in"),
      edge("e3", "loop", "done", "log_done", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // loop ノードの出力に body と done が含まれること
    const loopResult = rec.nodeResults?.find((r: any) => r.nodeId === "loop");
    assert.ok(loopResult, "loop node should execute");
  });

  // ========================================================================
  // RS05: ループ（条件式）
  // ========================================================================

  // RSST-03-002002-00008
  test("RS05: loop condition モードが条件を満たす間実行される", async function () {
    const flowId = "st-rs05-cond-loop";
    const f = flow(flowId, "RS05 Loop Condition", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: 'echo "[1,2,3]"' }),
      node("transform", "transform", { transformType: "jsonParse" }),
      node("loop", "loop", {
        mode: "condition",
        expression: "index < input|length",
      }),
      node("log_body", "log", { message: "body: {{input}}", level: "info" }),
      node("log_done", "log", { message: "done: {{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "transform", "in"),
      edge("e3", "transform", "out", "loop", "in"),
      edge("e4", "loop", "body", "log_body", "in"),
      edge("e5", "loop", "done", "log_done", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");
  });

  // ========================================================================
  // RS06: ループ（リスト）
  // ========================================================================

  // RSST-03-002002-00009
  test("RS06: loop list モードが各要素に対して実行される", async function () {
    const flowId = "st-rs06-list-loop";
    const f = flow(flowId, "RS06 Loop List", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: 'echo \'["apple","banana","cherry"]\'' }),
      node("transform", "transform", { transformType: "jsonParse" }),
      node("loop", "loop", { mode: "list" }),
      node("log_body", "log", { message: "item: {{input}}", level: "info" }),
      node("log_done", "log", { message: "done: {{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "transform", "in"),
      edge("e3", "transform", "out", "loop", "in"),
      edge("e4", "loop", "body", "log_body", "in"),
      edge("e5", "loop", "done", "log_done", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // loop が実行済みであること
    const loopResult = rec.nodeResults?.find((r: any) => r.nodeId === "loop");
    assert.ok(loopResult, "loop should execute");
  });

  // ========================================================================
  // RS07: データ変換（JSON解析 / テンプレート / JS式）
  // ========================================================================

  // RSST-03-002002-00010
  test("RS07: transform ノードが jsonParse/template/jsExpression を正しく処理する", async function () {
    const flowId = "st-rs07-transform";
    const f = flow(flowId, "RS07 Transform", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: 'echo \'{"key":"value"}\'' }),
      node("t_json", "transform", { transformType: "jsonParse" }),
      node("t_template", "transform", {
        expression: "結果: {{input.key}}",
        transformType: "template",
      }),
      node("t_js", "transform", { transformType: "jsExpression", expression: "input.key" }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "t_json", "in"),
      edge("e3", "t_json", "out", "t_template", "in"),
      edge("e4", "t_template", "out", "log", "in"),
      edge("e5", "t_json", "out", "t_js", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // JSON.parse 結果がオブジェクトであること
    const jsonResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_json");
    assert.ok(jsonResult, "t_json should execute");
    assert.strictEqual(typeof jsonResult.outputs?.out, "object", "JSON.parse should return object");

    // template が展開されていること
    const templateResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_template");
    assert.ok(templateResult, "t_template should execute");
    assert.ok(
      String(templateResult.outputs?.out).includes("value"),
      "template should expand {{input.key}} to 'value'",
    );

    // jsExpression が input.key を返すこと
    const jsResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_js");
    assert.ok(jsResult, "t_js should execute");
    assert.strictEqual(jsResult.outputs?.out, "value", "jsExpression should evaluate input.key to 'value'");
  });

  // ========================================================================
  // RS08: コマンドテンプレート（{{input}}展開）
  // ========================================================================

  // RSST-03-002002-00011
  test("RS08: command の {{input}} テンプレートが正しく展開される", async function () {
    const flowId = "st-rs08-cmd-tmpl";
    const f = flow(flowId, "RS08 Command Template", [
      node("trigger", "trigger"),
      node("cmd1", "command", { command: "echo hello_world" }),
      node("cmd2", "command", { command: "echo received: {{input}}" }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd1", "in"),
      edge("e2", "cmd1", "stdout", "cmd2", "in"),
      edge("e3", "cmd2", "stdout", "log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // cmd2 の stdout に "received: hello_world" が含まれる
    const cmd2Result = rec.nodeResults?.find((r: any) => r.nodeId === "cmd2");
    assert.ok(
      cmd2Result?.outputs?.stdout?.includes("received: hello_world"),
      "cmd2 should expand {{input}} from cmd1 stdout",
    );
  });

  // ========================================================================
  // RS09: 無効ノードとコメントノードのスキップ
  // ========================================================================

  // RSST-03-002002-00012
  test("RS09: disabled ノードとコメントノードが実行時にスキップされる", async function () {
    const flowId = "st-rs09-skip";
    const f = flow(flowId, "RS09 Disabled Skip", [
      node("comment", "comment", { comment: "このノードはスキップされる" }),
      node("trigger", "trigger"),
      node("disabled", "transform", { expression: "'should-not-run'" }, { enabled: false }),
      node("active", "log", { message: "active", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "disabled", "in"),
      edge("e2", "trigger", "out", "active", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // disabled ノードが nodeResults に含まれないこと
    const disabledResult = rec.nodeResults?.find((r: any) => r.nodeId === "disabled");
    assert.ok(!disabledResult, "disabled node should not appear in nodeResults");

    // comment ノードがスキップされること
    const commentResult = rec.nodeResults?.find((r: any) => r.nodeId === "comment");
    const isCommentSkipped = !commentResult || commentResult.status === "skipped";
    assert.ok(isCommentSkipped, "comment node should be skipped");
  });

  // ========================================================================
  // RS11: サブフロー連携
  // ========================================================================

  // RSST-03-002002-00013
  test("RS11: subFlow ノードが別フローを呼び出して結果を返す", async function () {
    // まずサブフロー（呼出先）を作成
    // 注意: FlowRepository は flowId.slice(0,8) でファイルをマッチするため、
    // メインとサブで先頭8文字が異なる ID を使用する
    const subFlowId = "st-r11tg-target";
    const subF = flow(subFlowId, "RS11 Target", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: "echo sub_result" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
    ]);
    writeFlowFile(workspaceRoot, subF);

    // メインフローを作成
    const mainFlowId = "st-r11mn-main";
    const mainF = flow(mainFlowId, "RS11 Main", [
      node("trigger", "trigger"),
      node("sub", "subFlow", { flowId: subFlowId }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "sub", "in"),
      edge("e2", "sub", "out", "log", "in"),
    ]);
    writeFlowFile(workspaceRoot, mainF);

    await vscode.commands.executeCommand("flowrunner.executeFlow", mainFlowId);

    const records = readHistoryRecords(workspaceRoot, mainFlowId);
    assert.ok(records.length > 0, "main flow should have history records");
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // subFlow ノードが実行されていること
    const subResult = rec.nodeResults?.find((r: any) => r.nodeId === "sub");
    assert.ok(subResult, "subFlow node should execute");
    assert.strictEqual(subResult.status, "success");
  });

  // ========================================================================
  // RS12: ファイル読み書き
  // ========================================================================

  // RSST-03-002002-00014
  test("RS12: file ノードが書込→読取で正常動作する", async function () {
    const flowId = "st-rs12-file";
    const testFile = "st-rs12-test.txt";

    const f = flow(flowId, "RS12 File", [
      node("trigger", "trigger"),
      node("cmd", "command", { command: "echo file_test_data" }),
      node("file-write", "file", { operation: "write", path: testFile }),
      node("file-read", "file", { operation: "read", path: testFile }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "file-write", "in"),
      edge("e3", "file-write", "out", "file-read", "in"),
      edge("e4", "file-read", "out", "log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // file-write が成功していること
    const writeResult = rec.nodeResults?.find((r: any) => r.nodeId === "file-write");
    assert.ok(writeResult, "file-write should execute");
    assert.strictEqual(writeResult.status, "success");

    // file-read が成功し、書込データを読み取れること
    const readResult = rec.nodeResults?.find((r: any) => r.nodeId === "file-read");
    assert.ok(readResult, "file-read should execute");
    assert.strictEqual(readResult.status, "success");
    assert.ok(
      String(readResult.outputs?.out).includes("file_test_data"),
      "read output should contain written data",
    );

    // クリーンアップ
    const absPath = path.join(workspaceRoot, testFile);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  });

  // ========================================================================
  // RS13: Log レベル設定
  // ========================================================================

  // RSST-03-002002-00015
  test("RS13: log ノードが info/warn/error レベルで正常実行される", async function () {
    const flowId = "st-rs13-log";
    const f = flow(flowId, "RS13 Log Levels", [
      node("trigger", "trigger"),
      node("log_info", "log", { message: "info msg", level: "info" }),
      node("log_warn", "log", { message: "warn msg", level: "warn" }),
      node("log_error", "log", { message: "error msg", level: "error" }),
    ], [
      edge("e1", "trigger", "out", "log_info", "in"),
      edge("e2", "trigger", "out", "log_warn", "in"),
      edge("e3", "trigger", "out", "log_error", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // 3つの log ノードが全て成功していること
    for (const nodeId of ["log_info", "log_warn", "log_error"]) {
      const result = rec.nodeResults?.find((r: any) => r.nodeId === nodeId);
      assert.ok(result, `${nodeId} should execute`);
      assert.strictEqual(result.status, "success", `${nodeId} should succeed`);
    }
  });

  // ========================================================================
  // RS14: Command 詳細設定（cwd, env, timeout）
  // ========================================================================

  // RSST-03-002002-00016
  test("RS14: command ノードが cwd/env オプション付きで実行される", async function () {
    const flowId = "st-rs14-cmd-detail";
    const f = flow(flowId, "RS14 Command Detail", [
      node("trigger", "trigger"),
      node("cmd_env", "command", {
        command: "echo $MY_VAR",
        env: { MY_VAR: "env_test_value" },
      }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd_env", "in"),
      edge("e2", "cmd_env", "stdout", "log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // env で設定した値が stdout に反映される
    const cmdResult = rec.nodeResults?.find((r: any) => r.nodeId === "cmd_env");
    assert.ok(
      cmdResult?.outputs?.stdout?.includes("env_test_value"),
      "env variable should be expanded in stdout",
    );
  });

  // ========================================================================
  // RS07b: データ変換（textReplace / textSplit / textJoin / regex / jsonStringify）
  // ========================================================================

  // RSST-03-002002-00020
  test("RS07b: transform ノードが textReplace/textSplit/textJoin/regex/jsonStringify を正しく処理する", async function () {
    const flowId = "st-r07b-xform";
    const f = flow(flowId, "RS07b Transform New", [
      node("trigger", "trigger"),
      // textReplace チェーン: echo → replace → split → join
      node("cmd", "command", { command: "echo hello world" }),
      node("t_replace", "transform", { transformType: "textReplace", expression: "hello|goodbye" }),
      node("t_split", "transform", { transformType: "textSplit", expression: " " }),
      node("t_join", "transform", { transformType: "textJoin", expression: "-" }),
      // regex チェーン
      node("t_regex", "transform", { transformType: "regex", expression: "\\w+" }),
      // jsonStringify チェーン
      node("cmd2", "command", { command: 'echo \'{"a":1}\'' }),
      node("t_parse", "transform", { transformType: "jsonParse" }),
      node("t_stringify", "transform", { transformType: "jsonStringify" }),
      node("log", "log", { message: "{{input}}", level: "info" }),
    ], [
      edge("e1", "trigger", "out", "cmd", "in"),
      edge("e2", "cmd", "stdout", "t_replace", "in"),
      edge("e3", "t_replace", "out", "t_split", "in"),
      edge("e4", "t_split", "out", "t_join", "in"),
      edge("e5", "cmd", "stdout", "t_regex", "in"),
      edge("e6", "trigger", "out", "cmd2", "in"),
      edge("e7", "cmd2", "stdout", "t_parse", "in"),
      edge("e8", "t_parse", "out", "t_stringify", "in"),
      edge("e9", "t_stringify", "out", "log", "in"),
    ]);
    writeFlowFile(workspaceRoot, f);

    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const records = readHistoryRecords(workspaceRoot, flowId);
    assert.ok(records.length > 0);
    const rec = records[0] as any;
    assert.strictEqual(rec.status, "success");

    // textReplace: "hello world\n" の最初の hello が goodbye に
    const replaceResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_replace");
    assert.ok(replaceResult, "t_replace should execute");
    assert.ok(
      String(replaceResult.outputs?.out).includes("goodbye"),
      "textReplace should replace 'hello' with 'goodbye'",
    );

    // textSplit: 空白で分割 → 配列
    const splitResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_split");
    assert.ok(splitResult, "t_split should execute");
    assert.ok(Array.isArray(splitResult.outputs?.out), "textSplit should return array");

    // textJoin: 配列をハイフンで結合
    const joinResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_join");
    assert.ok(joinResult, "t_join should execute");
    assert.ok(
      typeof joinResult.outputs?.out === "string" && joinResult.outputs.out.includes("-"),
      "textJoin should join with hyphen",
    );

    // regex: \w+ マッチ結果が配列
    const regexResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_regex");
    assert.ok(regexResult, "t_regex should execute");
    assert.ok(regexResult.outputs?.out, "regex should have match output");

    // jsonStringify: オブジェクト → JSON 文字列
    const stringifyResult = rec.nodeResults?.find((r: any) => r.nodeId === "t_stringify");
    assert.ok(stringifyResult, "t_stringify should execute");
    assert.ok(
      typeof stringifyResult.outputs?.out === "string" && stringifyResult.outputs.out.includes('"a"'),
      "jsonStringify should produce JSON string",
    );
  });
});
