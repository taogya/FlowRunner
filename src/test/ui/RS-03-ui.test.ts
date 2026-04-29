// Trace: RSST-03 — RS-03（実行エンジン）の UI 自動テスト
import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  InputBox,
  Workbench,
  VSBrowser,
  BottomBarPanel,
  OutputView,
} from "vscode-extension-tester";
import { createBlankFlow } from "./helpers.js";

describe("RS-03: 実行エンジン（UIテスト）", function () {
  this.timeout(90_000);

  let workspaceDir: string;

  before(async function () {
    this.timeout(120_000);
    workspaceDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "flowrunner-ui-exec-"),
    );
    await VSBrowser.instance.openResources(workspaceDir);
    await VSBrowser.instance.driver.sleep(5000);

    // フローを作成して実行しておく
    const workbench = new Workbench();
    await createBlankFlow("Exec Test Flow");

    // フロー実行
    await workbench.executeCommand("FlowRunner: Execute Flow");
    await VSBrowser.instance.driver.sleep(5000);
  });

  after(function () {
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  // ---- RS-03-002004: 実行時フィードバック ----

  // RSST-03-002004-00002
  it("OutputView に FlowRunner チャネルが存在する", async function () {
    const bottomBar = new BottomBarPanel();
    await bottomBar.toggle(true);
    await VSBrowser.instance.driver.sleep(1000);
    const outputView = await bottomBar.openOutputView();
    await VSBrowser.instance.driver.sleep(1000);
    assert.ok(outputView instanceof OutputView, "OutputView should be accessible");

    const channelNames = await outputView.getChannelNames();
    assert.ok(
      channelNames.some((name: string) => name.includes("FlowRunner")),
      `OutputView should have FlowRunner channel, found: ${channelNames.join(", ")}`,
    );
  });
});
