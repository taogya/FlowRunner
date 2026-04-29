# FEAT-00022: 実行履歴ビュー

- 対応する RD 参照: 会話要望（2026-04-10）
- 関連: FEAT-00016（最新実行サマリー）, FEAT-00019（実行分析ダッシュボード）

## 概要

過去のフロー実行結果を一覧で参照し、選択した実行レコードの詳細 `nodeResults` を辿れるビューを追加する。最新 1 回の結果確認を担う最新実行サマリーと、集計指標を担う実行分析の間を補完し、過去実行の追跡と原因確認を行いやすくする。

## スコープ (FEAT-00022-002000)

### 実装する範囲

- 右パネルまたは専用ビューで、過去の `ExecutionRecord` 一覧を表示する
- 一覧行に実行日時、flow 名、status、duration を表示する
- レコード選択で詳細 `nodeResults` を表示する
- 詳細項目からノード選択・キャンバスジャンプを行う
- 最新実行サマリー、実行分析との役割分担と再読込契約を定義する
- 既存の `HistoryRepository` / `HistoryService` / `ExecutionRecord` / `ExecutionSummary` / analytics 読み込み導線を再利用する

### スコープ外

- v0.3.0 での実装着手
- 履歴全文検索、タグ付け、比較表示
- 履歴の外部同期や共有
- 履歴専用の分析ロジック再実装

- 現行の v0.3.0 では、最新実行サマリーと実行分析で直近確認要件を満たす
- 本機能は protocol 追加、UI 設計、詳細テストが別途必要なため、v0.3.0 の対象外とする

## 仕様

### §3.1 履歴データアクセス再利用 (FEAT-00022-003001)

- 履歴一覧は `HistoryService` の `ExecutionSummary` 取得導線を利用する
- レコード詳細は `HistoryService` / `HistoryRepository` の `ExecutionRecord` 読み出しを利用する
- 一覧表示用に別ストレージを持たず、既存の `ExecutionSummary` / `ExecutionRecord` 型をそのまま扱う
- analytics と同様に、履歴ファイルの一部が読めない場合でも読める範囲で表示継続できる設計を優先する

### §3.2 メッセージプロトコル拡張 (FEAT-00022-003002)

- 現状の `history:analyticsLoad` / `history:analyticsLoaded` は集計結果専用であり、履歴一覧用途には別 protocol を追加する
- 履歴一覧取得用に `history:listLoad` / `history:listLoaded` を追加する
- レコード詳細取得用に `history:recordLoad` / `history:recordLoaded` を追加する
- `history:listLoaded` payload は `id`, `flowName`, `startedAt`, `status`, `duration` を含む `ExecutionSummary[]` 相当とする
- `history:recordLoaded` payload は選択中レコードの `ExecutionRecord` とし、`nodeResults` を含む
- 既存 analytics 導線との後方互換性を維持し、履歴一覧追加によって `history:analyticsLoad` の意味を変えない

### §3.3 履歴一覧 UI (FEAT-00022-003003)

- 第一候補は右パネル内の追加セクションとし、情報密度や操作性に課題がある場合は専用ビューへ分離してよい
- 一覧は新しい実行順で並べ、各行に実行日時、flow 名、status、duration を表示する
- フロー切替時と実行完了時に一覧を再読込する
- 空状態では「履歴なし」を明示し、analytics の空状態と競合しない文言にする

### §3.4 レコード詳細と `nodeResults` 連携 (FEAT-00022-003004)

- レコード選択時に `nodeResults` を実行順で表示し、各項目に node 名、status、duration、出力要約またはエラー要約を表示する
- `nodeResults` 項目選択で対応ノードを選択し、必要に応じてキャンバスを該当位置へ移動する
- 対応ノードが現在のキャンバスに存在しない場合は、詳細表示を維持したままジャンプのみ安全に無視する
- 最新実行サマリーは最新 1 回の簡易ビューのまま維持し、履歴ビューは過去レコードの詳細確認を担う

### §3.5 実行分析との関係 (FEAT-00022-003005)

- 実行分析は既存の `history:analyticsLoad` 導線で recent history を集計し続ける
- 履歴ビューは個票参照、実行分析は集計参照とし、同じ履歴ソースを共有するが UI の責務は分離する
- フロー読込、実行完了、デバッグ完了など analytics を再読込する契機では、履歴一覧も同じ契機で再読込できるようにする
- 将来的に analytics の recent failure から履歴レコードを開く導線を追加できるよう、record ID を UI 状態で保持可能にする

## 影響範囲 (FEAT-00022-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| `HistoryRepository` / `HistoryService` | 既存の一覧・詳細取得導線を履歴ビューから再利用 | 中 |
| `src/shared/types/messages.ts` | 履歴一覧・詳細取得用 protocol 追加 | 中 |
| `MessageBroker` | 履歴一覧・詳細読込ハンドラ追加 | 中 |
| WebView 右パネルまたは専用ビュー | 履歴一覧、詳細、空状態、ローディング表示追加 | 高 |
| `FlowEditorApp` 相当の状態管理 | 選択レコード、選択 nodeResult、再読込契機の管理追加 | 高 |

## テスト方針 (FEAT-00022-005000)

- 履歴一覧と詳細取得が既存 `HistoryService` / `ExecutionRecord` / `ExecutionSummary` を再利用していることを検証する
- 履歴一覧に実行日時、flow 名、status、duration が表示されることを検証する
- レコード選択で `nodeResults` 詳細が表示されることを検証する
- `nodeResults` 選択でノード選択・ジャンプが行われ、存在しないノードでも安全に扱えることを検証する
- 最新実行サマリーと実行分析の責務分離、および再読込契機の整合性を検証する

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00022-003001 | 履歴データアクセス再利用 | FEAT-00022-003001-00001 | 履歴一覧と詳細取得が既存 `HistoryService` / `ExecutionRecord` / `ExecutionSummary` を再利用する | ☐ |
| FEAT-00022-003002 | メッセージプロトコル拡張 | FEAT-00022-003002-00001 | `history:listLoad` / `history:listLoaded` / `history:recordLoad` / `history:recordLoaded` の契約が守られる | ☐ |
| FEAT-00022-003003 | 履歴一覧 UI | FEAT-00022-003003-00001 | 履歴一覧に実行日時、flow 名、status、duration が表示される | ☐ |
| FEAT-00022-003003 | 履歴一覧 UI | FEAT-00022-003003-00002 | 履歴がない場合に空状態が表示され、フロー切替や実行完了で再読込される | ☐ |
| FEAT-00022-003004 | レコード詳細と `nodeResults` 連携 | FEAT-00022-003004-00001 | レコード選択で `nodeResults` 詳細が表示される | ☐ |
| FEAT-00022-003004 | レコード詳細と `nodeResults` 連携 | FEAT-00022-003004-00002 | `nodeResults` 項目選択でノード選択・ジャンプが行われ、存在しないノードでも安全に扱える | ☐ |
| FEAT-00022-003005 | 実行分析との関係 | FEAT-00022-003005-00001 | 最新実行サマリー、履歴ビュー、実行分析が責務分離を保ったまま同じ再読込契機で同期する | ☐ |