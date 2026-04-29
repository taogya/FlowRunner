# FlowRunner

ノードベースのワークフローを VS Code 上で設計・実行する拡張機能。

## 機能

- **ビジュアルフローエディタ** — ドラッグ＆ドロップ、Auto Layout、Align、コピー / ペースト / 複製でフローを編集
- **13 種のビルトインノード** — Trigger, Command, Log, AI Prompt, Condition, Loop, SubFlow, File, HTTP, Transform, Comment, Try/Catch, Parallel
- **新規作成とテンプレート** — Blank Flow / Starter Template / Recent Template の導線でフローを作成し、テンプレート保存も可能
- **実行とデバッグ** — 実行前バリデーション、ワンクリック実行、ステップ実行デバッグに対応
- **右パネルの可視化** — Latest Execution Summary、Execution Analytics、Flow Dependencies、Settings / Output セクションを表示
- **フロー管理** — 作成、複製、リネーム、削除、インポート / エクスポート、トリガー有効化をサポート
- **実行履歴と多言語対応** — 実行履歴を保存し、日本語 / 英語 UI を提供

## インストール

### Marketplace から

VS Code の拡張機能マーケットプレイスで「FlowRunner」を検索してインストール。

### ソースからビルド

```bash
npm ci
npm run package
# 生成された .vsix を VS Code にインストール
code --install-extension taogya-flowrunner-*.vsix
```

## 使い方

1. サイドバーの **FlowRunner** アイコンをクリック
2. **＋** ボタンまたは **Create Flow** からフローを作成し、**Blank Flow** / **Starter Template** / **Recent Template** を選ぶ
3. エディタ上でノードを追加・接続してワークフローを構築
4. ツールバーの **Execute** / **Debug**、またはフロー右クリックメニューから実行する
5. 右パネルの **Latest Execution Summary**、**Execution Analytics**、**Flow Dependencies**、ノード **Output** セクションや、出力パネルの **FlowRunner** チャネルで結果を確認する

## 設定

| 設定キー | 型 | デフォルト | 説明 |
|---|---|---|---|
| `flowrunner.autoSave` | boolean | `false` | フロー定義の自動保存 |
| `flowrunner.historyMaxCount` | number | `10` | 保持する実行履歴の最大件数 |

## 開発

```bash
npm ci               # 依存インストール
npm run compile      # ビルド
npm run test:unit    # ユニットテスト (vitest)
npm run test:integration  # システムテスト (@vscode/test-electron)
npm run test:ui      # UI テスト (vscode-extension-tester)
npm test             # 全テスト実行
```

## Marketplace 公開までの作業手順

| # | ステップ | コマンド / 作業 |
|---|--------|-----------------|
| 1 | **コピースクリプト実行** | `npm run publish:copy` （dev ルートで実行） |
| 2 | **publish 側でビルド確認** | `cd publish/FlowRunner && npm ci && npm run compile && npm run build:webview` |
| 3 | **vsix パッケージング** | `cd publish/FlowRunner && npx vsce package` |
| 4 | **ローカル動作確認** | VS Code で `Extensions: Install from VSIX...` → 生成された .vsix を選択して動作確認 |
| 5 | **公開リポジトリへコミット** | `cd publish/FlowRunner && git add -A && git commit && git push` |
| 6 | **Marketplace 公開** | [Marketplace](https://marketplace.visualstudio.com/)にログインして、vsixファイルをアップロードしてOK |
| 7 | **公開確認** | Marketplace で FlowRunner を検索して表示確認 |


## ライセンス

BSD-3-Clause License. See [LICENSE](LICENSE).