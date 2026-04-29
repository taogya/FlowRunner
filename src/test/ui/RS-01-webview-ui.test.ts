// Trace: RSST-01 — RS-01（WebView レイアウト・操作）の WebView UI 自動テスト
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  InputBox,
  Workbench,
  VSBrowser,
  WebView,
  By,
} from "vscode-extension-tester";
import { createBlankFlow } from "./helpers.js";

describe("RS-01: WebView レイアウト・操作（WebView UIテスト）", function () {
  this.timeout(90_000);

  let workspaceDir: string;
  let webView: WebView;

  before(async function () {
    this.timeout(120_000);
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowrunner-webview-ui-"),
    );
    await VSBrowser.instance.openResources(workspaceDir);
    await VSBrowser.instance.driver.sleep(5000);

    // フローを作成して WebView エディタを開く
    await createBlankFlow("WebView Test Flow");

    // WebView を取得してフレームに切り替え
    webView = new WebView();
    await webView.switchToFrame();
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

  // ---- RS-01-004001: WebView レイアウト ----

  // RSST-01-004001-00003
  it("WebView に flow-editor ルートコンテナが表示される", async function () {
    const root = await webView.findWebElement(
      By.css('[data-testid="flow-editor"]'),
    );
    assert.ok(await root.isDisplayed(), "flow-editor root should be displayed");
  });

  // RSST-01-004001-00004
  it("WebView に 3 ペイン構成が表示される（Toolbar, NodePalette, PropertyPanel）", async function () {
    const toolbar = await webView.findWebElement(
      By.css('[data-testid="toolbar"]'),
    );
    assert.ok(await toolbar.isDisplayed(), "Toolbar should be displayed");

    // NodePalette はノードタイプ未読込時に内容が空のため要素存在で検証
    const palettes = await webView.findWebElements(
      By.css('[data-testid="node-palette"]'),
    );
    assert.ok(palettes.length > 0, "NodePalette element should exist in DOM");

    const panel = await webView.findWebElement(
      By.css('[data-testid="property-panel"]'),
    );
    assert.ok(await panel.isDisplayed(), "PropertyPanel should be displayed");
  });

  // ---- RS-01-004005: ツールバー ----

  // RSST-01-004005-00002
  it("ツールバーに Execute ボタンが配置されている", async function () {
    const btn = await webView.findWebElement(
      By.css('[data-testid="toolbar"] button[aria-label="Execute"]'),
    );
    assert.ok(await btn.isDisplayed(), "Execute button should be displayed");
    const text = await btn.getText();
    assert.ok(text.includes("Execute"), `Execute button text should contain 'Execute', got: "${text}"`);
  });

  // RSST-01-004005-00003
  it("ツールバーに Debug ボタンが配置されている", async function () {
    const btn = await webView.findWebElement(
      By.css('[data-testid="toolbar"] button[aria-label="Debug"]'),
    );
    assert.ok(await btn.isDisplayed(), "Debug button should be displayed");
  });

  // RSST-01-004005-00004
  it("ツールバーに Save ボタンが配置されている", async function () {
    const btn = await webView.findWebElement(
      By.css('[data-testid="toolbar"] button[aria-label="Save"]'),
    );
    assert.ok(await btn.isDisplayed(), "Save button should be displayed");
  });

  // ---- RS-01-005001: プロパティパネル ----

  // RSST-01-005001-00002
  it("ノード未選択時にプロパティパネルにプレースホルダが表示される", async function () {
    const panel = await webView.findWebElement(
      By.css('[data-testid="property-panel"]'),
    );
    const text = await panel.getText();
    assert.ok(
      text.includes("Select a node") || text.includes("ノードを選択してください"),
      `PropertyPanel should show placeholder, got: "${text}"`,
    );
  });

  // ---- RS-01-005002: 右パネル切り替え要素 ----
  // セクション切り替え要素はノード選択時のみ表示されるため、ノード未選択では存在しないことを確認

  // RSST-01-005002-00002
  it("ノード未選択時にセクショントグルが表示されない", async function () {
    const toggles = await webView.findWebElements(
      By.css('[data-testid="property-panel"] button[aria-expanded]'),
    );
    assert.strictEqual(toggles.length, 0, "No section toggles should be displayed when no node is selected");
  });
});
