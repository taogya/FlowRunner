# FlowRunner

Visual Studio Code 向けのノードベース ワークフロー実行拡張機能です。

## 特徴

- **ビジュアルフローエディタ** — ドラッグ＆ドロップ編集、Auto Layout、整列、コピー / ペースト / 複製に対応
- **13 種のビルトインノード** — Trigger, Command, Log, AI Prompt, Condition, Loop, SubFlow, File, HTTP, Transform, Comment, Try/Catch, Parallel を搭載
- **作成導線の選択** — Blank Flow、Starter Template、Recent Template から開始可能
- **実行とデバッグ** — 実行前バリデーションとステップ実行デバッグに対応
- **右パネルの可視化** — Latest Execution Summary、Execution Analytics、Flow Dependencies、ノード Settings / Output を集約表示
- **フロー管理と履歴** — 複製、リネーム、インポート / エクスポート、トリガー管理、実行履歴保持をサポート
- **多言語対応** — 日本語・英語をサポート

![flow_executed](./docs/resources/flow_executed.png)

## はじめに

1. アクティビティバーから **FlowRunner** パネルを開く
2. **Create Flow** をクリックし、**Blank Flow** / **Starter Template** / **Recent Template** から開始方法を選ぶ
3. ビジュアルエディタでノードを追加・接続
4. **Execute Flow** コマンドでフローを実行

## 動作要件

- VS Code 1.99.0 以降

## ドキュメント

- [ユーザーガイド（日本語）](docs/user-guide.ja.md)
- [User Guide (English)](docs/user-guide.md)

## ライセンス

[BSD-3-Clause](LICENSE)
