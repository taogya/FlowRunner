import * as fs from "fs";
import * as path from "path";
import {
  InputBox,
  Workbench,
  VSBrowser,
} from "vscode-extension-tester";

export async function createBlankFlow(
  flowName: string,
  waitMs = 3000,
): Promise<void> {
  const workbench = new Workbench();
  await workbench.executeCommand("FlowRunner: Create Flow");

  const modePicker = await InputBox.create();
  await modePicker.selectQuickPick(0);

  const nameInput = await InputBox.create();
  await nameInput.setText(flowName);
  await nameInput.confirm();

  await VSBrowser.instance.driver.sleep(waitMs);
}

export function findFlowByName(
  workspaceDir: string,
  flowName: string,
): { id: string; name: string; file: string } | undefined {
  const flowrunnerDir = path.join(workspaceDir, ".flowrunner");
  if (!fs.existsSync(flowrunnerDir)) {
    return undefined;
  }

  const flowFiles = fs
    .readdirSync(flowrunnerDir)
    .filter((file) => file.endsWith(".json"));

  for (const file of flowFiles) {
    const content = JSON.parse(
      fs.readFileSync(path.join(flowrunnerDir, file), "utf-8"),
    ) as { id?: string; name?: string };
    if (content.name === flowName && content.id) {
      return { id: content.id, name: flowName, file };
    }
  }

  return undefined;
}

export function findHistoryDirForFlowId(
  workspaceDir: string,
  flowId: string,
): string | undefined {
  const historyBase = path.join(workspaceDir, ".flowrunner", "history");
  if (!fs.existsSync(historyBase)) {
    return undefined;
  }

  const shortId = flowId.slice(0, 8);
  const entries = fs.readdirSync(historyBase, { withFileTypes: true });
  const matched = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith(`_${shortId}`),
  );
  if (matched) {
    return path.join(historyBase, matched.name);
  }

  const legacyDir = path.join(historyBase, flowId);
  return fs.existsSync(legacyDir) ? legacyDir : undefined;
}