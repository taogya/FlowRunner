---
name: "アジャイル拡張開発ルール"
description: "将来拡張機能（B系タスク）のアジャイル開発ルール。仕様は docs/additional-spec/ に配置"
applyTo: "docs/additional-spec/**,src/**/FEAT-*"
---

# アジャイル拡張開発ルール

## 概要

将来拡張機能（RD-01 §10）はアジャイル形式で開発する。コア機能（v1.0）のウォーターフォール工程とは異なり、簡易仕様 → 実装 → テストを素早く回す。

> **注意:** 基盤改善（A系タスク: REF-XX）は既存 DD/BD セクション ID をそのまま使用する。本ルールは将来拡張（B系タスク: FEAT-XXX）にのみ適用される。

## ディレクトリ構造

- `docs/additional-spec/` — アジャイル拡張仕様
- `docs/additional-spec/FEAT-SUMMARY.md` — 全 FEAT の進捗管理（一元管理）
- `docs/additional-spec/FEAT-<連番5桁>_<英語スネークケース名>.md` — 機能別仕様

## 仕様ドキュメントのテンプレート

> **注意:** 仕様ドキュメントに進捗情報（ステータス等）を含めないこと。進捗管理は `FEAT-SUMMARY.md` で一元管理する。

```markdown
# FEAT-XXXXX: <機能名>

- 対応する RD 参照: RD-01 §10 #N

## 概要
<1-3文で機能の目的を記述>

## スコープ
<実装する範囲と明示的にスコープ外とするもの>

## 仕様
<インターフェース、メッセージ、データ型、動作仕様を記述>
（各小セクションにセクション ID を付与: FEAT-XXXXX-YYYZZZ）

## 影響範囲
<既存コンポーネントへの変更点を列挙>

## テスト方針
<テスト方針と主要テストケースの概要>

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-XXXXX-002001 | インターフェース設計 | FEAT-XXXXX-002001-00001 | 基本動作確認 | ☐ |
```

## ID 体系

### FEAT プレフィックス

`FEAT-` はアジャイル拡張仕様の ID プレフィックスであり、`copilot-instructions.md` のプレフィックス一覧には含まれない独立体系として運用する。

- **仕様ID:** `FEAT-XXXXX`（XXXXX は5桁連番）
- **セクションID:** `FEAT-XXXXX-YYYZZZ`（YYY は大セクション3桁、ZZZ は小セクション3桁）
- **テストID:** `FEAT-XXXXX-YYYZZZ-NNNNN`（NNNNN は5桁テスト連番）
- **トレースコメント:** `// Trace: FEAT-XXXXX` または `// Trace: FEAT-XXXXX-YYYZZZ`
- **採番:** 既存 FEAT ID の最大値 + 1。欠番は許容する

### ドキュメント構造

- B系タスク1つにつき原則1ドキュメント
- 大規模な場合は `FEAT-XXXXXa_xxx.md`, `FEAT-XXXXXb_xxx.md` で分割可

### TRACEABILITY.md との関係

FEAT テストは `TRACEABILITY.md` に追加しない。理由:
- FEAT 仕様は `docs/additional-spec/` に自己完結し、既存 spec 工程（RD/RS/BD/DD）の対応関係に含まれない
- トレーサビリティは FEAT 仕様ドキュメント末尾の**テストチェックリスト**で管理する
- テストチェックリストにセクション ID → テスト ID の対応表を記載し、実装漏れ・テスト漏れを防止する

### 基盤改善（A系）との違い

| 項目 | A系（REF-XX） | B系（FEAT-XXX） |
|---|---|---|
| トレースID | 既存 DD/BD セクション ID | FEAT-XXX |
| TRACEABILITY.md | 既存エントリを利用 | 追加不要 |
| 設計書 | 既存 docs/spec/ を参照 | docs/additional-spec/ に新規作成 |

## 開発ルール

### 既存 spec ドキュメントとの関係

- 既存 `docs/spec/` のドキュメント（RD/RS/BD/DD）は直接編集しない
- 既存設計に影響する変更が必要な場合は `docs/review/REV-XXX` ファイルを作成し、後から doc-writer が設計書を更新する
- 影響が軽微（型の追加、インターフェースへのオプショナルメソッド追加など）な場合は、FEAT 仕様内に変更内容を記載し、実装と同時に対応してよい

### コード品質

- 既存のコーディング規約（TypeScript strict, ESLint + Prettier）に準拠
- トレースコメントは `// Trace: FEAT-XXX` 形式で記載
- 既存インターフェース（INodeExecutor, IFlowService 等）の後方互換性を維持すること
- 新規インターフェースは `src/extension/interfaces/` に配置

### テスト

- 各 FEAT に対応するテストファイルを作成
- テスト ID は `FEAT-XXXXX-YYYZZZ-NNNNN` 形式
- テストコード内にコメントでテスト ID を記載
- FEAT ドキュメントのテストチェックリストを更新し、テスト漏れがないことを確認
- 既存テストが壊れていないことを `vitest run` で確認

### 計画管理

- `docs/plan/` に `plan_FEAT-XXXXX_<name>.md` を作成
- PLAN.md にエントリを追加

### サンプルフロー

- ノード追加・機能拡張を含む FEAT 実装時は `.flowrunner/` にサンプルフローを追加すること
- ファイル名: `FEAT-XXXXX_<日本語名>_<短縮ID>.json`
- サンプルには使い方を記載したコメントノードを含めること
- 複数のトリガー種別や設定パターンがある場合は、パターン別にサンプルを分割する
