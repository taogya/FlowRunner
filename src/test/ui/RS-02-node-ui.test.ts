// Trace: RSST-02 — RS-02（ノード定義）のWebView ノード表示テスト
// ノード付きフローをツリー経由で開き、WebView内のノード描画を検証する
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  SideBarView,
  InputBox,
  EditorView,
  Workbench,
  VSBrowser,
  WebView,
  By,
} from "vscode-extension-tester";
import type { WebElement } from "selenium-webdriver";
import { createBlankFlow } from "./helpers.js";

describe("RS-02: ノード表示（WebView UIテスト）", function () {
  this.timeout(120_000);

  let workspaceDir: string;
  let webView: WebView;

  before(async function () {
    this.timeout(120_000);
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowrunner-node-display-"),
    );

    await VSBrowser.instance.openResources(workspaceDir);
    // 拡張機能アクティベーション待ち
    await VSBrowser.instance.driver.sleep(10000);

    // 1. "Create Flow" でフローを作成（エディタが開く）
    const workbench = new Workbench();
    await createBlankFlow("Node Display Test");

    // 2. 作成されたフローファイルを読み取り ID を取得
    const flowrunnerDir = path.join(workspaceDir, ".flowrunner");
    const flowFiles = fs.readdirSync(flowrunnerDir).filter(f => f.endsWith(".json"));
    assert.ok(flowFiles.length > 0, "Flow file should be created");
    const flowFilePath = path.join(flowrunnerDir, flowFiles[0]);
    const existingFlow = JSON.parse(fs.readFileSync(flowFilePath, "utf-8"));

    // 3. フローファイルにノード・エッジを注入して上書き
    const now = new Date().toISOString();
    existingFlow.nodes = [
      {
        id: "n1",
        type: "trigger",
        label: "Trigger",
        enabled: true,
        position: { x: 50, y: 150 },
        settings: {},
      },
      {
        id: "n2",
        type: "command",
        label: "Run Command",
        enabled: true,
        position: { x: 250, y: 150 },
        settings: { command: "echo hello" },
      },
      {
        id: "n3",
        type: "log",
        label: "Log Output",
        enabled: true,
        position: { x: 450, y: 150 },
        settings: { message: "test", level: "info" },
      },
      {
        id: "n4",
        type: "comment",
        label: "My Comment",
        enabled: true,
        position: { x: 250, y: 300 },
        settings: { comment: "This is a comment node" },
      },
      {
        id: "n5",
        type: "condition",
        label: "Check Cond",
        enabled: false,
        position: { x: 450, y: 300 },
        settings: { expression: "true" },
      },
    ];
    existingFlow.edges = [
      {
        id: "e1",
        sourceNodeId: "n1",
        sourcePortId: "out",
        targetNodeId: "n2",
        targetPortId: "in",
      },
      {
        id: "e2",
        sourceNodeId: "n2",
        sourcePortId: "out",
        targetNodeId: "n3",
        targetPortId: "in",
      },
    ];
    existingFlow.updatedAt = now;
    fs.writeFileSync(flowFilePath, JSON.stringify(existingFlow, null, 2));

    // 4. エディタを閉じてツリーからフローを再度開く
    const editorView = new EditorView();
    try {
      await editorView.closeAllEditors();
    } catch {
      // ignore
    }
    await VSBrowser.instance.driver.sleep(1000);

    // ツリーでフローをクリックして再オープン
    await workbench.executeCommand("FlowRunner: Focus on Flow List View");
    await VSBrowser.instance.driver.sleep(3000);

    const sideBar = new SideBarView();
    const content = sideBar.getContent();
    const sections = await content.getSections();
    let opened = false;
    for (const section of sections) {
      try {
        const items = await section.getVisibleItems();
        if (items.length > 0) {
          await items[0].select();
          opened = true;
          break;
        }
      } catch {
        // ignore
      }
    }
    assert.ok(opened, "Should find and click a tree item to open flow");

    // WebView がロードされるまで十分待つ
    await VSBrowser.instance.driver.sleep(5000);

    // WebView をキャプチャしてフレームに切り替え
    webView = new WebView();
    await webView.switchToFrame();

    // ノードレンダリング完了をポーリング待機（最大 15 秒）
    await waitForElements(webView, ".react-flow__node", 1, 15000);
  });

  after(async function () {
    try {
      await webView.switchBack();
    } catch {
      // すでに切り替え済みの場合はスキップ
    }
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  /** 指定セレクタの要素が minCount 以上出現するまでポーリング待機 */
  async function waitForElements(
    wv: WebView,
    cssSelector: string,
    minCount: number,
    timeoutMs: number,
  ): Promise<WebElement[]> {
    const start = Date.now();
    let elements: WebElement[] = [];
    while (Date.now() - start < timeoutMs) {
      elements = await wv.findWebElements(By.css(cssSelector));
      if (elements.length >= minCount) return elements;
      await VSBrowser.instance.driver.sleep(500);
    }
    return elements;
  }

  // ---- RS-02-002002: ノード外観 ----

  // RSST-02-002002-00003
  it("ツリーアイテムクリックでフローが開きノードが表示される", async function () {
    const nodeElements = await webView.findWebElements(
      By.css(".react-flow__node"),
    );
    assert.ok(
      nodeElements.length >= 3,
      `At least 3 nodes should be rendered, got ${nodeElements.length}`,
    );
  });

  // RSST-02-002002-00004
  it("ノードラベルがWebView上に表示される", async function () {
    // 各ノードのラベルテキストが DOM 上にあることを確認
    const allText = await (
      await webView.findWebElement(By.css('[data-testid="flow-editor"]'))
    ).getText();
    assert.ok(
      allText.includes("Trigger"),
      "Trigger node label should be visible",
    );
    assert.ok(
      allText.includes("Run Command"),
      "Command node label should be visible",
    );
    assert.ok(
      allText.includes("Log Output"),
      "Log node label should be visible",
    );
  });

  // ---- RS-02-003001: ポート表示 ----

  // RSST-02-003001-00002
  it("入力ポート（Handle target）がノードの左側に表示される", async function () {
    // ハンドル描画を待機してから検索（node:typesLoaded 応答後にポートが描画されるため長めに待機）
    const handles = await waitForElements(webView, ".react-flow__handle", 1, 30000);
    let found = false;
    for (const h of handles) {
      const pos = await h.getAttribute("data-handlepos");
      if (pos === "left") { found = true; break; }
    }
    // data-handlepos が取得できない場合はクラス名にフォールバック
    if (!found) {
      const leftHandles = await webView.findWebElements(
        By.css('[class*="handle-left"], [class*="handle"][data-handlepos="left"]'),
      );
      found = leftHandles.length > 0;
    }
    assert.ok(found, `Input port handles (left) should exist, total handles found: ${handles.length}`);
  });

  // RSST-02-003001-00003
  it("出力ポート（Handle source）がノードの右側に表示される", async function () {
    const handles = await waitForElements(webView, ".react-flow__handle", 1, 30000);
    let found = false;
    for (const h of handles) {
      const pos = await h.getAttribute("data-handlepos");
      if (pos === "right") { found = true; break; }
    }
    if (!found) {
      const rightHandles = await webView.findWebElements(
        By.css('[class*="handle-right"], [class*="handle"][data-handlepos="right"]'),
      );
      found = rightHandles.length > 0;
    }
    assert.ok(found, `Output port handles (right) should exist, total handles found: ${handles.length}`);
  });

  // ---- RS-02-002002: 無効ノード表示 ----

  // RSST-02-003002-00002
  it("無効ノード（enabled:false）が半透明で表示される", async function () {
    // すべてのノードを取得し、opacity: 0.5 のものがあることを確認
    const nodeElements = await webView.findWebElements(
      By.css(".react-flow__node"),
    );
    let hasDisabledStyle = false;
    for (const el of nodeElements) {
      // ノード内の最初の div (CustomNodeComponent root) の style を検査
      const innerDivs = await el.findElements(By.css("div"));
      for (const div of innerDivs) {
        const opacity = await div.getCssValue("opacity");
        if (parseFloat(opacity) <= 0.5 && parseFloat(opacity) >= 0.4) {
          hasDisabledStyle = true;
          break;
        }
      }
      if (hasDisabledStyle) break;
    }
    assert.ok(
      hasDisabledStyle,
      "Disabled node should have opacity 0.5",
    );
  });

  // ---- RS-02-003004: トリガーノード ----

  // RSST-02-003004-00002
  it("トリガーノードのラベル「Trigger」が表示される", async function () {
    // trigger タイプのノードは .react-flow__node-trigger
    const triggerNodes = await webView.findWebElements(
      By.css(".react-flow__node-trigger"),
    );
    assert.ok(triggerNodes.length > 0, "Trigger node should be rendered");
    const text = await triggerNodes[0].getText();
    assert.ok(
      text.includes("Trigger"),
      `Trigger node should show label "Trigger", got: "${text}"`,
    );
  });

  // ---- RS-02-003010: コメントノード ----

  // RSST-02-003010-00002
  it("コメントノードのラベルが表示される", async function () {
    const commentNodes = await webView.findWebElements(
      By.css(".react-flow__node-comment"),
    );
    assert.ok(commentNodes.length > 0, "Comment node should be rendered");
    const text = await commentNodes[0].getText();
    assert.ok(
      text.includes("My Comment"),
      `Comment node should show label, got: "${text}"`,
    );
  });

  // ---- RS-02-002002: エッジ表示 ----

  // RSST-02-002002-00005
  it("ノード間のエッジ（接続線）が表示される", async function () {
    // ReactFlow はエッジを SVG 内に描画する（.react-flow__edge または g[class*="edge"]）
    let edgeElements = await waitForElements(webView, ".react-flow__edge", 1, 15000);
    // SVG 内の edge-path にフォールバック
    if (edgeElements.length === 0) {
      edgeElements = await waitForElements(webView, ".react-flow__edge-path", 1, 5000);
    }
    // さらにフォールバック: aria-label="edge" または data-testid
    if (edgeElements.length === 0) {
      edgeElements = await waitForElements(webView, '[class*="edge"]', 1, 5000);
    }
    assert.ok(
      edgeElements.length >= 1,
      `At least 1 edge should be rendered, got ${edgeElements.length}`,
    );
  });
});
