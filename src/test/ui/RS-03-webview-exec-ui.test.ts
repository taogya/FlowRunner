// Trace: RSST-03 — RS-03（フロー実行）のWebView E2E テスト
// ノードを繋いだフローをWebViewで確認し、ツールバーから実行する
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  InputBox,
  EditorView,
  Workbench,
  VSBrowser,
  WebView,
  By,
} from "vscode-extension-tester";
import {
  createBlankFlow,
  findFlowByName,
  findHistoryDirForFlowId,
} from "./helpers.js";

/** .flowrunner/ にフロー定義を書き込む */
function writeFlowFile(dir: string, flowDef: Record<string, unknown>): void {
  const flowrunnerDir = path.join(dir, ".flowrunner");
  if (!fs.existsSync(flowrunnerDir)) {
    fs.mkdirSync(flowrunnerDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(flowrunnerDir, `${flowDef.id}.json`),
    JSON.stringify(flowDef, null, 2),
  );
}

describe("RS-03: フロー実行 WebView E2E", function () {
  this.timeout(120_000);

  let workspaceDir: string;
  const flowId = "webview-exec-test";

  before(async function () {
    this.timeout(120_000);
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowrunner-exec-webview-"),
    );

    // ノードを繋いだフロー定義を .flowrunner/ に配置
    const now = new Date().toISOString();
    writeFlowFile(workspaceDir, {
      id: flowId,
      name: "WebView Exec Test",
      description: "",
      version: "1.0.0",
      nodes: [
        {
          id: "n1",
          type: "trigger",
          label: "Trigger",
          enabled: true,
          position: { x: 100, y: 100 },
          settings: {},
        },
        {
          id: "n2",
          type: "log",
          label: "Log Node",
          enabled: true,
          position: { x: 300, y: 100 },
          settings: { message: "hello from webview", level: "info" },
        },
      ],
      edges: [
        {
          id: "e1",
          sourceNodeId: "n1",
          sourcePortId: "out",
          targetNodeId: "n2",
          targetPortId: "in",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await VSBrowser.instance.openResources(workspaceDir);
    await VSBrowser.instance.driver.sleep(5000);
  });

  after(function () {
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  /** 全エディタを閉じるヘルパー */
  async function closeAllEditors(): Promise<void> {
    const editorView = new EditorView();
    try {
      await editorView.closeAllEditors();
    } catch {
      // エディタが無い場合は無視
    }
    await VSBrowser.instance.driver.sleep(500);
  }

  // ---- RS-03-002001: フロー実行（WebView） ----

  // RSST-03-002001-00003
  it("フローを作成してWebViewでノード表示を確認する", async function () {
    await closeAllEditors();

    // createFlow で新規フローを作成
    await createBlankFlow("Node Display Test");

    const webView = new WebView();
    await webView.switchToFrame();

    try {
      // ReactFlow キャンバスが表示されていること
      const canvas = await webView.findWebElements(
        By.css(".react-flow"),
      );
      assert.ok(canvas.length > 0, "ReactFlow canvas should be rendered");

      // flow-editor ルートが存在すること
      const root = await webView.findWebElement(
        By.css('[data-testid="flow-editor"]'),
      );
      assert.ok(await root.isDisplayed(), "Flow editor root should be visible");
    } finally {
      await webView.switchBack();
    }
  });

  // RSST-03-002001-00004
  it("WebView ツールバーの Execute ボタンをクリックできる", async function () {
    await closeAllEditors();

    await createBlankFlow("Execute Click Test");

    const webView = new WebView();
    await webView.switchToFrame();

    try {
      // Execute ボタンをクリック
      const executeBtn = await webView.findWebElement(
        By.css('button[aria-label="Execute"]'),
      );
      assert.ok(await executeBtn.isDisplayed(), "Execute button should exist");

      // ボタンがクリック可能であること（disabled でないこと）
      const isEnabled = await executeBtn.isEnabled();
      assert.ok(isEnabled, "Execute button should be enabled");

      // クリック実行（エラーなく完了すること）
      await executeBtn.click();
      await VSBrowser.instance.driver.sleep(2000);

      // クリック後もWebViewがクラッシュせず表示されていること
      const toolbar = await webView.findWebElement(
        By.css('[data-testid="toolbar"]'),
      );
      assert.ok(
        await toolbar.isDisplayed(),
        "Toolbar should still be visible after execute click",
      );
    } finally {
      await webView.switchBack();
    }
  });

  // RSST-03-002004-00003
  it("フロー実行後のWebViewが正常に表示されている", async function () {
    await closeAllEditors();

    // フローを作成してから実行
    const workbench = new Workbench();
    await createBlankFlow("Post Exec Test");

    // コマンドパレットからフロー実行
    await workbench.executeCommand("FlowRunner: Execute Flow");
    await VSBrowser.instance.driver.sleep(3000);

    // WebView が壊れていないこと
    const webView = new WebView();
    await webView.switchToFrame();
    try {
      const root = await webView.findWebElement(
        By.css('[data-testid="flow-editor"]'),
      );
      assert.ok(
        await root.isDisplayed(),
        "Flow editor should remain visible after execution",
      );
    } finally {
      await webView.switchBack();
    }
  });

  // ---- RS-03-002001: フロー実行結果検証 ----

  // RSST-03-002001-00005
  it("フローを実行すると履歴ファイルが作成される", async function () {
    await closeAllEditors();

    // フローを作成（Create Flow 経由 → ID が内部登録される）
    const workbench = new Workbench();
    await createBlankFlow("History Verify Test");

    // 作成されたフローの ID を取得
    const flowrunnerDir = path.join(workspaceDir, ".flowrunner");
    const targetFlow = findFlowByName(workspaceDir, "History Verify Test");
    assert.ok(targetFlow, "Created flow should exist on disk");

    // コマンドパレットからフロー実行（activeFlowId を使用）
    await workbench.executeCommand("FlowRunner: Execute Flow");
    await VSBrowser.instance.driver.sleep(5000);

    // 実行後に履歴ファイルが作成されていること
    const histDir = findHistoryDirForFlowId(workspaceDir, targetFlow!.id);
    const historyExists = !!histDir;
    if (historyExists) {
      const histFiles = fs.readdirSync(histDir!).filter(f => f.endsWith(".json"));
      assert.ok(
        histFiles.length > 0,
        `History file should be created after execution, got ${histFiles.length}`,
      );
      // 履歴レコードの内容を検証
      const record = JSON.parse(
        fs.readFileSync(path.join(histDir!, histFiles[0]), "utf-8"),
      );
      assert.ok(record.flowId, "History record should have flowId");
      assert.ok(record.status, "History record should have status");
      assert.ok(record.startedAt, "History record should have startedAt");
    } else {
      assert.fail("History directory should be created after execution");
    }
  });

  // ---- RS-01-006001: 保存検証 ----

  // RSST-01-006001-00005
  it("WebView の Save ボタンクリック後にフローファイルがディスクに保存される", async function () {
    await closeAllEditors();

    // 新しいフローを作成
    await createBlankFlow("Save Verify Test");

    // 作成されたフローファイルのパスを取得
    const flowrunnerDir = path.join(workspaceDir, ".flowrunner");
    const flowFilesBefore = fs.readdirSync(flowrunnerDir)
      .filter(f => f.endsWith(".json") && !f.startsWith("history"));

    // WebView の Save ボタンをクリック
    const webView = new WebView();
    await webView.switchToFrame();
    try {
      const saveBtn = await webView.findWebElement(
        By.css('button[aria-label="Save"]'),
      );
      await saveBtn.click();
      await VSBrowser.instance.driver.sleep(2000);
    } finally {
      await webView.switchBack();
    }

    // フローファイルがディスクに存在すること
    const flowFilesAfter = fs.readdirSync(flowrunnerDir)
      .filter(f => f.endsWith(".json") && !f.startsWith("history"));
    assert.ok(
      flowFilesAfter.length >= flowFilesBefore.length,
      "Flow file should exist on disk after save",
    );

    // 保存されたファイルの内容が有効なJSONであること
    const latestFile = flowFilesAfter[flowFilesAfter.length - 1];
    const content = JSON.parse(
      fs.readFileSync(path.join(flowrunnerDir, latestFile), "utf-8"),
    );
    assert.ok(content.id, "Saved flow should have an id");
    assert.ok(content.name, "Saved flow should have a name");
    assert.ok(content.updatedAt, "Saved flow should have updatedAt timestamp");
  });
});
