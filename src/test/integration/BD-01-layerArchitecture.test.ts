// BD-01 Layer Architecture Integration Tests
// Trace: BD-01-002001 レイヤー構成, BD-01-002002 レイヤー間の責務分離

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../..");

// --- BD-01-002001: レイヤー構成 ---

describe("Layer Architecture (BD-01-002001)", () => {
  // BDIT-01-002001-00001
  it("presentationLayer_existsAsWebViewDirectory", () => {
    expect(fs.existsSync(path.join(ROOT, "src/webview"))).toBe(true);
  });

  // BDIT-01-002001-00002
  it("applicationLayer_existsAsExtensionDirectory", () => {
    expect(fs.existsSync(path.join(ROOT, "src/extension"))).toBe(true);
  });

  // BDIT-01-002001-00003
  it("infrastructureLayer_existsAsRepositoriesDirectory", () => {
    expect(fs.existsSync(path.join(ROOT, "src/extension/repositories"))).toBe(true);
  });

  // BDIT-01-002001-00004
  it("sharedLayer_existsForCrossLayerTypes", () => {
    expect(fs.existsSync(path.join(ROOT, "src/shared"))).toBe(true);
  });
});

// --- BD-01-002002: レイヤー間の責務分離 ---

describe("Layer Separation (BD-01-002002)", () => {
  function getImportsFromDir(dir: string): string[] {
    const imports: string[] = [];
    if (!fs.existsSync(dir)) return imports;
    const files = fs.readdirSync(dir, { recursive: true }) as string[];
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const matches = content.matchAll(/from\s+["'](@\w+\/[^"']+|\.\.\/[^"']+)["']/g);
      for (const m of matches) {
        imports.push(m[1]);
      }
    }
    return imports;
  }

  // BDIT-01-002002-00001
  it("webView_doesNotImportFromExtensionServices", () => {
    // BD-01 allows type-only imports from @extension/interfaces/ (for Disposable etc.)
    // but forbids importing concrete services/core
    const webviewImports = getImportsFromDir(path.join(ROOT, "src/webview"));
    const violations = webviewImports.filter(
      (i) => i.startsWith("@extension/") && !i.startsWith("@extension/interfaces/"),
    );
    expect(violations).toEqual([]);
  });

  // BDIT-01-002002-00002
  it("shared_doesNotImportFromExtensionOrWebview", () => {
    const sharedImports = getImportsFromDir(path.join(ROOT, "src/shared"));
    const violations = sharedImports.filter(
      (i) => i.startsWith("@extension/") || i.startsWith("@webview/"),
    );
    expect(violations).toEqual([]);
  });

  // BDIT-01-002002-00003
  it("infrastructure_usesInterfacesNotConcreteServices", () => {
    // Infrastructure (repositories) should depend on interfaces, not concrete services
    const repoImports = getImportsFromDir(path.join(ROOT, "src/extension/repositories"));
    const serviceImports = repoImports.filter((i) => i.includes("/services/"));
    expect(serviceImports).toEqual([]);
  });
});
