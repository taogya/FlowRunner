// BD-01 Localization asset IT tests
// Trace: BD-01-005002 Contributes 設計

import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "fs";
import { extname, resolve } from "path";

interface PackageJson {
  description: string;
  l10n?: string;
  contributes: Record<string, unknown>;
}

const runtimeBundlePath = resolve(process.cwd(), "l10n", "bundle.l10n.json");
const japaneseRuntimeBundlePath = resolve(
  process.cwd(),
  "l10n",
  "bundle.l10n.ja.json",
);

const packageNlsPath = resolve(process.cwd(), "package.nls.json");
const packageNlsJaPath = resolve(process.cwd(), "package.nls.ja.json");

const sourceDirectories = [
  resolve(process.cwd(), "src", "extension"),
  resolve(process.cwd(), "src", "webview"),
];

const dynamicRuntimeKeys = ["high", "medium", "low", "beginner", "intermediate"];

let packageJson: PackageJson;
let packageNls: Record<string, string>;
let packageNlsJa: Record<string, string>;
let runtimeBundle: Record<string, string>;
let runtimeBundleJa: Record<string, string>;

beforeAll(() => {
  packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson;
  packageNls = JSON.parse(readFileSync(packageNlsPath, "utf8")) as Record<
    string,
    string
  >;
  packageNlsJa = JSON.parse(readFileSync(packageNlsJaPath, "utf8")) as Record<
    string,
    string
  >;
  runtimeBundle = JSON.parse(readFileSync(runtimeBundlePath, "utf8")) as Record<
    string,
    string
  >;
  runtimeBundleJa = JSON.parse(
    readFileSync(japaneseRuntimeBundlePath, "utf8"),
  ) as Record<string, string>;
});

function collectPlaceholderKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectPlaceholderKeys(item, keys);
    }
    return keys;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectPlaceholderKeys(item, keys);
    }
    return keys;
  }

  if (typeof value === "string") {
    const match = value.match(/^%(.+)%$/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return keys;
}

function collectLiteralL10nKeys(filePath: string, keys: Set<string>): void {
  const source = readFileSync(filePath, "utf8");
  const patterns = [
    /l10n\.t\(\s*"((?:\\.|[^"\\])*)"/gm,
    /l10n\.t\(\s*'((?:\\.|[^'\\])*)'/gm,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      keys.add(match[1]);
    }
  }
}

function walkSourceDirectory(dirPath: string, keys: Set<string>): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkSourceDirectory(fullPath, keys);
      continue;
    }

    if ([".ts", ".tsx"].includes(extname(entry.name))) {
      collectLiteralL10nKeys(fullPath, keys);
    }
  }
}

function findMissingKeys(keys: Iterable<string>, dictionary: Record<string, string>): string[] {
  return [...keys].filter(
    (key) => !Object.prototype.hasOwnProperty.call(dictionary, key),
  );
}

describe("Localization assets (BD-01-005002)", () => {
  // BDIT-01-005002-00007
  it("manifest_declaresRuntimeL10nDirectory", () => {
    expect(packageJson.l10n).toBe("./l10n");
  });

  // BDIT-01-005002-00008
  it("packageLocalizationPlaceholders_resolveInEnglishAndJapanese", () => {
    const placeholderKeys = collectPlaceholderKeys({
      description: packageJson.description,
      contributes: packageJson.contributes,
    });

    expect(findMissingKeys(placeholderKeys, packageNls)).toEqual([]);
    expect(findMissingKeys(placeholderKeys, packageNlsJa)).toEqual([]);
  });

  // BDIT-01-005002-00009
  it("runtimeBundles_existForDefaultAndJapanese", () => {
    expect(existsSync(runtimeBundlePath)).toBe(true);
    expect(existsSync(japaneseRuntimeBundlePath)).toBe(true);
  });

  // BDIT-01-005002-00010
  it("runtimeBundleKeys_matchAcrossLocales", () => {
    expect(Object.keys(runtimeBundleJa).sort()).toEqual(
      Object.keys(runtimeBundle).sort(),
    );
  });

  // BDIT-01-005002-00011
  it("runtimeBundle_coversLiteralL10nKeysUsedBySource", () => {
    const literalKeys = new Set<string>();
    for (const sourceDirectory of sourceDirectories) {
      walkSourceDirectory(sourceDirectory, literalKeys);
    }

    expect(findMissingKeys(literalKeys, runtimeBundle)).toEqual([]);
    expect(findMissingKeys(literalKeys, runtimeBundleJa)).toEqual([]);
  });

  // BDIT-01-005002-00012
  it("runtimeBundle_coversDynamicSeverityAndDifficultyKeys", () => {
    expect(findMissingKeys(dynamicRuntimeKeys, runtimeBundle)).toEqual([]);
    expect(findMissingKeys(dynamicRuntimeKeys, runtimeBundleJa)).toEqual([]);
  });
});