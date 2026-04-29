---
name: "テストルール"
description: "TDD ワークフロー・テスト規約・テスト ID 管理ルール"
applyTo: "**/*.test.ts,**/*.spec.ts,**/*.test.tsx,**/*.spec.tsx"
---

# テストルール

## フレームワーク・規約

- UT / IT: vitest + vscode mock
- IT（結合試験）: @vscode/test-electron
- テスト命名: `describe('<対象>') > it('<条件>_<期待結果>')` (英語)
- AAA パターン: Arrange（準備） / Act（実行） / Assert（検証）
- 1テストメソッドにつき 1アサーション（論理的に関連するものは許容）
- `expect().toBe()`, `expect().toEqual()`, `expect().toThrow()` 等の具体的なアサートを使用

## V モデル対応（テスト ↔ 設計工程）

| テスト種別 | 対応設計工程 | テスト ID プレフィックス | テストフレームワーク |
|---|---|---|---|
| UT（単体試験） | DD（詳細設計） | `DDUT-` | vitest |
| IT（結合試験） | BD（基本設計） | `BDIT-` | @vscode/test-electron |
| ST（システム試験） | RS（要件定義） | `RSST-` | @vscode/test-electron |

## テスト ID

- **形式:** `<テストプレフィックス>-<文書番号>-<セクション6桁>-<テスト連番5桁>`
- **例:**
  - BD-01 §2.3 の IT テストケース #1 → `BDIT-01-002003-00001`
  - DD-01 §3.1 の UT テストケース #3 → `DDUT-01-003001-00003`
  - RS-02 §4.2 の ST テストケース #1 → `RSST-02-004002-00001`
- **記載場所:** テストの `describe` または `it` ブロックのコメントに記載
- **採番:** 同一セクション内でテスト連番の最大値 + 1
- **管理:** テストコード内のコメント + TRACEABILITY.md

## Mock / Stub

- BD 段階の Mock は Interface に対して作成する
- テスト固有の Mock が必要な場合はテストファイル内に定義する
- テスト時は DI コンテナを経由せず、Mock を直接注入する
- **Mock の最終状態:** 内部コンポーネントの Mock は IMPL 完了後に全て Real に差し替える。外部依存（VSCode API、ファイルシステム等）の Mock は IT でも残留し、ST または手動テストでカバーする
