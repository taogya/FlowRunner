# FEAT-00019: 実行分析ダッシュボード

- 対応する RD 参照: REV-010 #6, #11（実行結果の把握効率と分析補助）

## 概要

選択中フローの直近実行履歴を集約し、失敗傾向や遅いノードを短時間で把握できる分析ビューを追加する。既存の HistoryService と実行記録を再利用し、最新 N 件の傾向を軽量に可視化する。

## スコープ (FEAT-00019-002000)

### 実装する範囲

- 選択中フローを対象にした実行分析パネルまたはダッシュボード表示
- 最新 N 件に対する成功件数、失敗件数、平均実行時間の集計
- recent failure trend の表示
- slowest node の抽出
- 実行履歴が存在しない場合の空状態表示
- 既存の HistoryService / ExecutionRecord を使った集計

### スコープ外

- 外部サービス連携を含む本格的な observability 基盤
- 実行中データのリアルタイムストリーミング分析
- フロー横断の全体ダッシュボード
- AI トークンコスト専用の詳細集計パネル

## 仕様

### §3.1 分析対象データと集計窓 (FEAT-00019-003001)

- 分析対象は選択中フローの最新 N 件の実行履歴とする
- 初期実装の N は 10 件固定とし、履歴保持件数または読める履歴件数が 10 未満の場合は取得可能な件数までを対象とする
- 一覧取得には HistoryService.getRecords(flowId) を使い、最新順に返る summary の先頭 N 件だけを分析候補とする
- 詳細集計が必要な項目のみ getRecord(recordId) で補完し、全履歴の詳細ロードは行わない
- 集計処理は Extension 側の専用集計モジュールが担当し、WebView は history:analyticsLoad 要求と history:analyticsLoaded 応答を通じて集計済み DTO を受け取る
- 読み出せない履歴は unreadable count として除外し、読めたレコードだけを対象に集計を継続する
- 分析のために別の長期保存領域は追加しない
- 履歴 0 件の場合は集計を行わず空状態へ遷移する

### §3.2 サマリ指標 (FEAT-00019-003002)

- 少なくとも success count、failure count、success rate、average duration、latest executed at を表示する
- average duration は最新 N 件の flow duration 平均値を利用する
- latest executed at は最新の readable summary.startedAt を表示基準とする
- 指標表示は selected flow 切替に追随し、別フローの値を混在させない
- 集計不能な破損レコードが存在する場合でも、読めるレコードだけで指標を表示し、必要に応じて unreadable count を補助表示してよい

### §3.3 recent failure trend (FEAT-00019-003003)

- 最新 N 件の成功 / 失敗の推移を、右パネル内で完結できる軽量な行リストまたは記号列で表示する
- 表示順は最新実行が先頭になる降順とする
- 失敗した実行については startedAt、duration、error message 先頭を確認できるようにする
- 直近に失敗がない場合は「最近の失敗なし」を明示する
- 重いチャートライブラリは前提とせず、既存 UI で表現可能な範囲にとどめる

### §3.4 slowest node 抽出 (FEAT-00019-003004)

- 最新 N 件の readable detailed record だけを対象に nodeResults を nodeId 単位で集計し、平均 duration が最大のノードを slowest node として表示する
- 同一 nodeId が現行フローに存在しない場合でも、履歴に残る nodeLabel と nodeType を表示対象に使う
- 補助情報として、対象ノードの平均 duration と最大 duration を表示してよい
- nodeResults が存在しないレコードと、詳細ロードに失敗したレコードは slowest node 集計から除外する

### §3.5 ダッシュボード表示と空状態 (FEAT-00019-003005)

- 表示場所はフローエディタ右パネル内の独立した Analytics セクションとし、LatestExecutionSummary と PropertyPanel の間に配置する
- PropertyPanel の Settings / Output タブは維持し、Analytics は PropertyPanel 内の新規タブにはしない
- 対象フロー切替時は前回集計結果を破棄し、新しい flowId に対して再集計する
- 再集計の契機は少なくとも flow:loaded、execution:flowCompleted、デバッグ終了時の履歴更新反映とする
- 履歴が存在しない場合は分析指標の代わりに空状態メッセージを表示する
- 単一レコードの読み込み失敗でダッシュボード全体を壊さず、読めない件数だけを補助表示してよい

## 影響範囲 (FEAT-00019-004000)

| コンポーネント | 変更内容 | 影響度 |
|---|---|---|
| HistoryService / HistoryRepository 利用層 | 最新 N 件の取得、破損レコードの劣化許容、詳細ロードによる集計処理追加 | 高 |
| 実行分析集計モジュール | 指標、傾向、slowest node、unreadable count 算出の新設 | 高 |
| MessageBroker / メッセージ型 | history:analyticsLoad / history:analyticsLoaded の追加 | 高 |
| FlowEditorApp / 右パネル UI | Analytics セクション、空状態、指標表示、再集計契機の追加 | 高 |
| NLS / テスト | 表示文言、集計ロジック検証の追加 | 中 |

## テスト方針 (FEAT-00019-005000)

- 最新 N 件の履歴から集計指標が正しく計算されることを検証する
- 履歴なしの空状態と、破損レコード混在時の劣化動作を検証する
- recent failure trend が成功 / 失敗の時系列を正しく反映することを検証する
- slowest node が nodeResults から正しく抽出されることを検証する
- 右パネル Analytics セクションが flow 切替と実行完了に追随して再集計されることを検証する

## テストチェックリスト

| セクション ID | セクション概要 | テスト ID | テスト概要 | 状態 |
|---|---|---|---|---|
| FEAT-00019-003001 | 分析対象データと集計窓 | FEAT-00019-003001-00001 | 対象フローの最新 N 件だけが集計対象になる | ☑ |
| FEAT-00019-003002 | サマリ指標 | FEAT-00019-003002-00001 | success count、failure count、average duration が履歴から正しく算出される | ☑ |
| FEAT-00019-003002 | サマリ指標 | FEAT-00019-003002-00002 | 破損レコード混在時も読めるレコードだけで指標が表示される | ☑ |
| FEAT-00019-003003 | recent failure trend | FEAT-00019-003003-00001 | 最新 N 件の成功 / 失敗推移が表示に反映される | ☑ |
| FEAT-00019-003003 | recent failure trend | FEAT-00019-003003-00002 | 最近の失敗がない場合に空ではなく明示メッセージが表示される | ☑ |
| FEAT-00019-003004 | slowest node 抽出 | FEAT-00019-003004-00001 | nodeResults の平均 duration から slowest node が抽出される | ☑ |
| FEAT-00019-003005 | ダッシュボード表示と空状態 | FEAT-00019-003005-00001 | 履歴 0 件のフローで空状態が表示される | ☑ |
| FEAT-00019-003005 | ダッシュボード表示と空状態 | FEAT-00019-003005-00002 | flow 切替と実行完了に応じて Analytics セクションが再集計される | ☑ |