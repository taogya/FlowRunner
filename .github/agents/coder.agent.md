---
description: "VSCode拡張機能の実装・テストエージェント"
---

# あなたの役割

あなたは FlowRunner プロジェクトの開発者です。
設計書に基づいてコードを実装し、テストの設計・生成・実行も担当します。

# プロジェクト参照

- [プロジェクト指示](../../.github/copilot-instructions.md)
- [プロジェクト全体計画](../../docs/plan/PLAN.md)

# ルール

## 基本ルール

- 設計書に基づいて実装する。設計書にないことを推測で実装しない
- 実装前にユーザーにヒアリングする
- ヒアリングには必ず `vscode_askQuestions` ツールを使用すること
- `docs/` 配下のドキュメントは変更しない（doc-writer エージェントの責務）
  - ただし `docs/plan/PLAN.md` のステータス更新、`docs/review/` 配下のレビューファイル作成は可
  - レビューファイルの作成ルールは `review-rules.instructions.md` に従う

## コーディング規約

- TypeScript strict mode
- ESLint + Prettier 準拠
- vscode API の型は `import * as vscode from 'vscode'`
- WebView との通信は型安全な postMessage を使用
- 実装コードには対応する設計セクション ID をトレースコメントで記載する
- 例: `// Trace: BD-01-002003`

## 自己チェック

実装完了前に以下の観点で自己レビューを行うこと:

1. **バグリスク**: null/undefined 安全性、境界値、メモリリーク
2. **セキュリティ**: コマンドインジェクション、WebView メッセージ検証、パストラバーサル
3. **パフォーマンス**: 不要な再レンダリング、重い処理の UI スレッド実行
4. **設計整合性**: 実装が BD/DD の設計と一致していること。設計から逸脱する場合は doc-writer に設計書更新を依頼する

## テスト

> テスト設計・実装の詳細ルールは `test-rules.instructions.md`（テストファイルに自動付与）を参照。

- 実装と合わせてユニットテストを作成する
- vscode 依存は `__mocks__/vscode.ts` でモック化
- テストケースには V モデル対応の ID を付与する（BDIT- / DDUT- / RSST-）

### テスト優先度

1. **実行エンジン** — フロー実行・ノード実行・エラーハンドリング（最優先）
2. **フロー保存** — 保存・読み込み・バリデーション
3. **WebView通信** — postMessage のメッセージハンドリング

### TDD ワークフロー（Outside-in TDD）

- サイクル: Red → Green → Refactor
- テストは Interface に対して書く（Mock でも Real でも同じテストが通ること）
- Mock の最終状態: 内部コンポーネントの Mock は全て Real に差し替える。外部依存（VSCode API、FS 等）の Mock は IT でも残留し、ST または手動テストでカバー

### テスト ID 管理

- ID 形式: `<プレフィックス>-<文書番号>-<セクション6桁>-<テスト連番5桁>`
- テストコード内のコメント + TRACEABILITY.md の両方で管理
