// BD-01 Contributes IT tests
// Trace: BD-01-005002 Contributes 設計

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

interface CommandDef {
  command: string;
  title: string;
  category: string;
}

interface MenuEntry {
  command: string;
  when?: string;
}

interface ConfigProperty {
  type: string;
  default: unknown;
  description: string;
}

interface ContributesDef {
  viewsContainers: {
    activitybar: Array<{ id: string; title: string }>;
  };
  views: Record<string, Array<{ id: string; name: string; type: string }>>;
  commands: CommandDef[];
  menus: Record<string, MenuEntry[]>;
  configuration: {
    properties: Record<string, ConfigProperty>;
  };
}

interface PackageJson {
  contributes: ContributesDef;
  dependencies: Record<string, string>;
}

let packageJson: PackageJson;

beforeAll(() => {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  packageJson = JSON.parse(raw) as PackageJson;
});

describe("Contributes (BD-01-005002)", () => {
  // BDIT-01-005002-00001
  it("viewsContainers_activitybar_containsFlowrunner", () => {
    const activitybar = packageJson.contributes.viewsContainers.activitybar;
    const entry = activitybar.find((v) => v.id === "flowrunner");

    expect(entry).toBeDefined();
    expect(entry!.title).toBe("FlowRunner");
  });

  // BDIT-01-005002-00002
  it("views_flowrunner_containsFlowListAsTree", () => {
    const views = packageJson.contributes.views["flowrunner"];

    expect(views).toBeDefined();
    const flowList = views.find((v) => v.id === "flowrunner.flowList");
    expect(flowList).toBeDefined();
    expect(flowList!.type).toBe("tree");
  });

  // BDIT-01-005002-00003
  it("commands_containsAllBDDefinedCommands", () => {
    const commands = packageJson.contributes.commands;
    const commandIds = commands.map((c) => c.command);

    const expectedCommands = [
      "flowrunner.createFlow",
      "flowrunner.openEditor",
      "flowrunner.deleteFlow",
      "flowrunner.executeFlow",
      "flowrunner.renameFlow",
      "flowrunner.debugFlow",
    ];

    for (const cmd of expectedCommands) {
      expect(commandIds).toContain(cmd);
    }

    // All commands should have FlowRunner category
    for (const cmd of commands) {
      expect(cmd.category).toBe("FlowRunner");
    }
  });

  // BDIT-01-005002-00004
  it("menus_matchesBDDesign", () => {
    const menus = packageJson.contributes.menus;

    // view/title should contain createFlow
    const titleMenus = menus["view/title"];
    expect(titleMenus).toBeDefined();
    expect(titleMenus.some((m) => m.command === "flowrunner.createFlow")).toBe(
      true
    );

    // view/item/context should contain 4 commands
    const contextMenus = menus["view/item/context"];
    expect(contextMenus).toBeDefined();

    const expectedContextCommands = [
      "flowrunner.openEditor",
      "flowrunner.deleteFlow",
      "flowrunner.executeFlow",
      "flowrunner.renameFlow",
    ];
    for (const cmd of expectedContextCommands) {
      expect(contextMenus.some((m) => m.command === cmd)).toBe(true);
    }
  });

  // BDIT-01-005002-00005
  it("configuration_hasNotificationAndHistorySettings", () => {
    const props = packageJson.contributes.configuration.properties;

    const autoSave = props["flowrunner.autoSave"];
    expect(autoSave).toBeDefined();
    expect(autoSave.type).toBe("boolean");
    expect(autoSave.default).toBe(false);

    const historyMaxCount = props["flowrunner.historyMaxCount"];
    expect(historyMaxCount).toBeDefined();
    expect(historyMaxCount.type).toBe("number");
    expect(historyMaxCount.default).toBe(10);

    const completionNotificationAutoHide = props["flowrunner.completionNotificationAutoHide"];
    expect(completionNotificationAutoHide).toBeDefined();
    expect(completionNotificationAutoHide.type).toBe("boolean");
    expect(completionNotificationAutoHide.default).toBe(true);

    const completionNotificationDurationSeconds = props["flowrunner.completionNotificationDurationSeconds"];
    expect(completionNotificationDurationSeconds).toBeDefined();
    expect(completionNotificationDurationSeconds.type).toBe("number");
    expect(completionNotificationDurationSeconds.default).toBe(3);
  });

  // BDIT-01-005002-00006
  it("dependencies_containsVscodeL10n", () => {
    expect(packageJson.dependencies["@vscode/l10n"]).toBeDefined();
  });
});
