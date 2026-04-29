import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { runTests } from "@vscode/test-electron";

async function main() {
  // ST 用の一時ワークスペースを作成
  const tmpWorkspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "flowrunner-st-"),
  );

  try {
    // out/test/src/test/e2e/ → 5階層上がプロジェクトルート
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../../../");

    // テストランナー（index.ts）のパス
    const extensionTestsPath = path.resolve(__dirname, "./index");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        "--disable-extensions", // 他の拡張機能を無効化
        tmpWorkspace,
      ],
    });
  } catch (err) {
    console.error("Failed to run tests:", err);
    process.exit(1);
  } finally {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  }
}

main();
