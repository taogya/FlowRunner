// BD-01 Activation Events IT tests
// Trace: BD-01-005001 Activation Events

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

interface PackageJson {
  activationEvents: string[];
}

let packageJson: PackageJson;

beforeAll(() => {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  packageJson = JSON.parse(raw) as PackageJson;
});

describe("Activation Events (BD-01-005001)", () => {
  // BDIT-01-005001-00001
  it("activationEvents_containsOnViewFlowList", () => {
    expect(packageJson.activationEvents).toContain(
      "onView:flowrunner.flowList"
    );
  });

  // BDIT-01-005001-00002
  it("activationEvents_containsOnCommandCreateFlow", () => {
    expect(packageJson.activationEvents).toContain(
      "onCommand:flowrunner.createFlow"
    );
  });

  // BDIT-01-005001-00003
  it("activationEvents_containsOnCommandOpenEditor", () => {
    expect(packageJson.activationEvents).toContain(
      "onCommand:flowrunner.openEditor"
    );
  });
});
