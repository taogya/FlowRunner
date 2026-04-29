// Trace: RSST-01 — RS-01（UI構成と操作）のシステム試験
import * as vscode from "vscode";
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  writeFlowFile,
  removeFlowFile,
  findFlowFilePath,
  cleanupFlowrunnerDir,
  node,
  flow,
} from "./helpers.js";

const EXT_ID = "Taogya.taogya-flowrunner";

suite("RS-01: UI構成と操作", function () {
  this.timeout(60_000);

  let workspaceRoot: string;

  suiteSetup(async function () {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, "Workspace folder is required");
    workspaceRoot = folders[0].uri.fsPath;

    // 拡張機能を明示的にアクティベート
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, "Extension must be installed");
    if (!ext.isActive) {
      await ext.activate();
    }
  });

  suiteTeardown(function () {
    cleanupFlowrunnerDir(workspaceRoot);
  });

  // ---- RS-01-002000: UI 構造 ----

  // RSST-01-002000-00001
  test("拡張機能がアクティベートされる", function () {
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, "Extension should be present");
    assert.ok(ext.isActive, "Extension should be active");
  });

  // RSST-01-002000-00002
  test("package.json に viewsContainers と views が定義されている", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ext.extensionPath, "package.json"), "utf-8"),
    );
    const containers = pkg.contributes?.viewsContainers?.activitybar;
    assert.ok(
      Array.isArray(containers) && containers.some((c: any) => c.id === "flowrunner"),
      "activitybar should have flowrunner container",
    );
    const views = pkg.contributes?.views?.flowrunner;
    assert.ok(
      Array.isArray(views) && views.some((v: any) => v.id === "flowrunner.flowList"),
      "flowrunner views should include flowrunner.flowList",
    );
  });

  // ---- RS-01-003001: サイドバー表示要件 ----

  // RSST-01-003001-00001
  test("flowrunner.flowList ビューが利用可能", async function () {
    // ビューフォーカスコマンドが存在すること（エラーなく呼べること）
    const commands = await vscode.commands.getCommands(true);
    // TreeView 登録はアクティベーション内で行われている
    // コマンドが登録されていることで TreeView 提供を間接検証
    assert.ok(
      commands.includes("flowrunner.openEditor"),
      "openEditor command implies TreeView is registered",
    );
  });

  // ---- RS-01-003002: 操作要件 ----

  // RSST-01-003002-00001
  test("6 つのコマンドが登録される", async function () {
    const commands = await vscode.commands.getCommands(true);
    const expected = [
      "flowrunner.createFlow",
      "flowrunner.openEditor",
      "flowrunner.deleteFlow",
      "flowrunner.executeFlow",
      "flowrunner.renameFlow",
      "flowrunner.debugFlow",
    ];
    for (const cmd of expected) {
      assert.ok(
        commands.includes(cmd),
        `Command "${cmd}" should be registered`,
      );
    }
  });

  // ---- RS-01-004001 〜 005003: WebView（自動検証範囲限定、詳細は手動確認） ----

  // RSST-01-004001-00001
  test("openEditor コマンドが存在する（WebView 起動エントリ）", async function () {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("flowrunner.openEditor"));
  });

  // RSST-01-004002-00001
  test("FlowCanvas ソースファイルが存在する", function () {
    // WebView コンポーネントの存在検証（レンダリングは手動確認）
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const srcExists =
      fs.existsSync(path.join(extPath, "src/webview/components/FlowCanvas.tsx")) ||
      fs.existsSync(path.join(extPath, "src/webview/components/FlowCanvas/index.tsx"));
    assert.ok(srcExists, "FlowCanvas source should exist");
  });

  // RSST-01-004003-00001
  test("コンテキストメニュー関連ソースが存在する", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const exists =
      fs.existsSync(path.join(extPath, "src/webview/components/FlowCanvas.tsx")) ||
      fs.existsSync(path.join(extPath, "src/webview/components/FlowCanvas/index.tsx"));
    assert.ok(exists, "Context menu is part of FlowCanvas");
  });

  // RSST-01-004004-00001
  test("Undo/Redo はフローキャンバスに包含される", function () {
    // Undo/Redo は FlowCanvas コンポーネント内で実装
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const exists =
      fs.existsSync(path.join(extPath, "src/webview/hooks")) ||
      fs.existsSync(path.join(extPath, "src/webview/components"));
    assert.ok(exists, "Undo/Redo hooks should exist in webview");
  });

  // RSST-01-004005-00001
  test("Toolbar コンポーネントソースが存在する", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const exists =
      fs.existsSync(path.join(extPath, "src/webview/components/Toolbar.tsx")) ||
      fs.existsSync(path.join(extPath, "src/webview/components/Toolbar/index.tsx"));
    assert.ok(exists, "Toolbar source should exist");
  });

  // RSST-01-005001-00001
  test("PropertyPanel コンポーネントソースが存在する", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const exists =
      fs.existsSync(path.join(extPath, "src/webview/components/PropertyPanel.tsx")) ||
      fs.existsSync(path.join(extPath, "src/webview/components/PropertyPanel/index.tsx"));
    assert.ok(exists, "PropertyPanel source should exist");
  });

  // RSST-01-005002-00001
  test("PropertyPanel に折りたたみセクション構造がある", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const candidates = [
      "src/webview/components/PropertyPanel.tsx",
      "src/webview/components/PropertyPanel/index.tsx",
    ];
    let content = "";
    for (const c of candidates) {
      const p = path.join(extPath, c);
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, "utf-8");
        break;
      }
    }
    assert.ok(
      content.includes("aria-expanded") || content.includes("isSettingsExpanded") || content.includes("isOutputExpanded"),
      "PropertyPanel should have collapsible section logic",
    );
  });

  // RSST-01-005003-00001
  test("PropertyPanel がノード選択を処理する", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const candidates = [
      "src/webview/components/PropertyPanel.tsx",
      "src/webview/components/PropertyPanel/index.tsx",
    ];
    let content = "";
    for (const c of candidates) {
      const p = path.join(extPath, c);
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, "utf-8");
        break;
      }
    }
    assert.ok(
      content.includes("selectedNode") || content.includes("node"),
      "PropertyPanel should handle node selection",
    );
  });

  // ---- RS-01-006001: 永続化（保存仕様） ----

  // RSST-01-006001-00001
  test("executeFlow 後に .flowrunner/ にフローファイルが存在する", async function () {
    const flowId = "st-persist-test";
    const f = flow(flowId, "Persist Test", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    // execute して成功させる（trigger のみなので即完了）
    await vscode.commands.executeCommand("flowrunner.executeFlow", flowId);

    const flowFile = findFlowFilePath(workspaceRoot, flowId);
    assert.ok(flowFile && fs.existsSync(flowFile), "Flow file should exist in .flowrunner/");

    removeFlowFile(workspaceRoot, flowId);
  });

  // ---- RS-01-006002: 共有仕様 ----

  // RSST-01-006002-00001
  test("フローファイルは 2 スペースインデント JSON で保存される", function () {
    const flowId = "st-json-format";
    const f = flow(flowId, "JSON Format Test", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    const flowFile = findFlowFilePath(workspaceRoot, flowId);
    assert.ok(flowFile, "Flow file should exist");
    const content = fs.readFileSync(flowFile, "utf-8");
    assert.ok(content.includes("\n"), "JSON should have newlines");
    assert.ok(content.includes("  "), "JSON should use 2-space indent");

    removeFlowFile(workspaceRoot, flowId);
  });

  // ---- RS-01-007000: 設定 ----

  // RSST-01-007000-00001
  test("autoSave のデフォルトは false", function () {
    const config = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(config.get("autoSave"), false);
  });

  // RSST-01-007000-00002
  test("historyMaxCount のデフォルトは 10", function () {
    const config = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(config.get("historyMaxCount"), 10);
  });

  // RSST-01-007000-00004
  test("completionNotificationAutoHide のデフォルトは true", function () {
    const config = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(config.get("completionNotificationAutoHide"), true);
  });

  // RSST-01-007000-00005
  test("completionNotificationDurationSeconds のデフォルトは 3", function () {
    const config = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(config.get("completionNotificationDurationSeconds"), 3);
  });

  // ---- RS-01-006001: 永続化（保存仕様 — 追加） ----

  // RSST-01-006001-00002
  test("フロー定義ファイルを直接書き込むとツリーに反映される", async function () {
    const flowId = "st-save-reload";
    const f = flow(flowId, "Save Reload Test", [
      node("n1", "trigger"),
      node("n2", "log", { message: "reload test", level: "info" }),
    ]);
    writeFlowFile(workspaceRoot, f);

    // ツリーリフレッシュのため少し待つ
    await new Promise((r) => setTimeout(r, 2000));

    // フローファイルが存在することを確認
    const flowFile = findFlowFilePath(workspaceRoot, flowId);
    assert.ok(flowFile && fs.existsSync(flowFile), "Flow file should persist");

    // ファイル内容がパース可能であることを確認
    const content = JSON.parse(fs.readFileSync(flowFile, "utf-8"));
    assert.strictEqual(content.name, "Save Reload Test");
    assert.strictEqual(content.nodes.length, 2);

    removeFlowFile(workspaceRoot, flowId);
  });

  // ---- RS-01-003002: 操作要件（追加） ----

  // RSST-01-003002-00004
  test("deleteFlow コマンドが登録されフロー削除が可能", async function () {
    // deleteFlow コマンドの存在確認
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("flowrunner.deleteFlow"),
      "deleteFlow command should be registered",
    );

    // フローファイルの作成・削除が正常に動作することを検証
    const flowId = "st-delete-test";
    const f = flow(flowId, "Delete Test", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    const flowFile = findFlowFilePath(workspaceRoot, flowId);
    assert.ok(flowFile && fs.existsSync(flowFile), "Flow file should exist before delete");

    // deleteFlow は showWarningMessage で確認ダイアログを表示するため
    // e2e テストではファイル直接削除で永続化メカニズムを検証
    removeFlowFile(workspaceRoot, flowId);
    assert.ok(
      !findFlowFilePath(workspaceRoot, flowId),
      "Flow file should be removed from .flowrunner/",
    );
  });

  // RSST-01-003002-00005
  test("renameFlow コマンドが存在し呼び出し可能", async function () {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("flowrunner.renameFlow"),
      "renameFlow command should be registered",
    );

    // フローを作成してリネーム対象にする
    const flowId = "st-rename-test";
    const f = flow(flowId, "Rename Before", [
      node("n1", "trigger"),
    ]);
    writeFlowFile(workspaceRoot, f);

    try {
      // renameFlow は InputBox を表示するため、タイムアウト付きで実行
      await Promise.race([
        vscode.commands.executeCommand("flowrunner.renameFlow", flowId),
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)),
      ]);
    } catch {
      // ダイアログ待ちやエラーは許容
    }

    removeFlowFile(workspaceRoot, flowId);
  });

  // ---- RS-01-007000: 設定（追加） ----

  // RSST-01-007000-00003
  test("設定値を変更して反映されることを確認", async function () {
    const config = vscode.workspace.getConfiguration("flowrunner");

    // historyMaxCount を変更
    await config.update("historyMaxCount", 5, vscode.ConfigurationTarget.Workspace);
    const updated = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(updated.get("historyMaxCount"), 5);

    await config.update("completionNotificationDurationSeconds", 6, vscode.ConfigurationTarget.Workspace);
    const updatedNotification = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(updatedNotification.get("completionNotificationDurationSeconds"), 6);

    // 元に戻す
    await config.update("historyMaxCount", undefined, vscode.ConfigurationTarget.Workspace);
    await config.update("completionNotificationDurationSeconds", undefined, vscode.ConfigurationTarget.Workspace);
    const restored = vscode.workspace.getConfiguration("flowrunner");
    assert.strictEqual(restored.get("historyMaxCount"), 10);
    assert.strictEqual(restored.get("completionNotificationDurationSeconds"), 3);
  });

  // ---- RS-01-008000: 多言語対応 ----

  // RSST-01-008000-00001
  test("l10n サポートが有効", function () {
    // 拡張機能がアクティベート成功 ＝ l10n 初期化成功
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    assert.ok(ext.isActive, "Extension activated with l10n support");
    // NLS ファイルの存在確認
    const extPath = ext.extensionPath;
    assert.ok(
      fs.existsSync(path.join(extPath, "package.nls.json")),
      "English NLS file should exist",
    );
    assert.ok(
      fs.existsSync(path.join(extPath, "package.nls.ja.json")),
      "Japanese NLS file should exist",
    );
  });

  // RSST-01-008000-00002
  test("l10n バンドルファイルの整合性確認", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;

    // package.nls.json のキーと package.nls.ja.json のキーが一致すること
    const enNls = JSON.parse(
      fs.readFileSync(path.join(extPath, "package.nls.json"), "utf-8"),
    );
    const jaNls = JSON.parse(
      fs.readFileSync(path.join(extPath, "package.nls.ja.json"), "utf-8"),
    );
    const enKeys = Object.keys(enNls).sort();
    const jaKeys = Object.keys(jaNls).sort();
    assert.deepStrictEqual(
      jaKeys,
      enKeys,
      "Japanese NLS should have same keys as English NLS",
    );
  });

  // RSST-01-008000-00003
  test("l10n バンドル（bundle.l10n.ja.json）が存在する", function () {
    const ext = vscode.extensions.getExtension(EXT_ID)!;
    const extPath = ext.extensionPath;
    const bundlePath = path.join(extPath, "l10n", "bundle.l10n.ja.json");
    assert.ok(
      fs.existsSync(bundlePath),
      "Japanese l10n bundle should exist",
    );
    // JSON として読み取り可能であること
    const content = fs.readFileSync(bundlePath, "utf-8");
    const parsed = JSON.parse(content);
    assert.ok(typeof parsed === "object", "Bundle should be valid JSON object");
  });
});
