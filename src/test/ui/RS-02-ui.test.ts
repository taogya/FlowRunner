// Trace: RSST-02 — RS-02（ノード定義）の UI 自動テスト
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

describe("RS-02: ノード定義（UIテスト）", function () {
  this.timeout(90_000);

  let workspaceDir: string;
  let webView: WebView;

  before(async function () {
    this.timeout(120_000);
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowrunner-node-ui-"),
    );
    await VSBrowser.instance.openResources(workspaceDir);
    await VSBrowser.instance.driver.sleep(5000);

    // フローを作成してエディタを開く
    await createBlankFlow("Node UI Test Flow");

    webView = new WebView();
    await webView.switchToFrame();
  });

  after(async function () {
    try {
      await webView.switchBack();
    } catch {
      // すでに切り替え済み
    }
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  // ---- RS-02-002002: ノード外観 ----

  // RSST-02-002002-00002
  it("ReactFlow キャンバスがレンダリングされている", async function () {
    const canvas = await webView.findWebElements(
      By.css(".react-flow"),
    );
    assert.ok(canvas.length > 0, "ReactFlow canvas should be rendered");
  });
});
