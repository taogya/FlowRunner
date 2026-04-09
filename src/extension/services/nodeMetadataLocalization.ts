// Trace: DD-01-005003
import * as vscode from "vscode";
import type {
  INodeTypeMetadata,
  PortDefinition,
  SelectOption,
  SettingFieldDef,
} from "@shared/types/node.js";

const metadataLocalizationEntries = [
  ["Command Node", "コマンド実行"],
  ["Command", "コマンド"],
  ["Trigger", "トリガー"],
  ["Condition", "条件分岐"],
  ["Loop", "ループ"],
  ["Log", "ログ出力"],
  ["Comment", "コメント"],
  ["Parallel", "並列実行"],
  ["Try/Catch", "エラーハンドリング"],
  ["File", "ファイル操作"],
  ["HTTP", "HTTP リクエスト"],
  ["Transform", "データ変換"],
  ["AI Prompt", "AI プロンプト"],
  ["Subflow", "フロー連携"],
  ["Basic", "基本"],
  ["Control", "制御"],
  ["Data", "データ"],
  ["Other", "その他"],
  ["Input", "入力"],
  ["Output", "出力"],
  ["stdout", "標準出力"],
  ["stderr", "標準エラー"],
  ["Response", "応答"],
  ["Token Usage", "トークン使用量"],
  ["Loop Body", "ループ本体"],
  ["Done", "完了"],
  ["Branch 1", "ブランチ1"],
  ["Branch 2", "ブランチ2"],
  ["Branch 3", "ブランチ3"],
  ["Try Body", "Try 本体"],
  ["Response Body", "レスポンスボディ"],
  ["Status Code", "ステータスコード"],
  ["True", "True"],
  ["False", "False"],
  ["Working Directory", "作業ディレクトリ"],
  ["Shell", "シェル"],
  ["Environment Variables", "環境変数"],
  ["Timeout (seconds)", "タイムアウト（秒）"],
  ["Trigger Type", "トリガー種別"],
  ["Manual", "手動実行"],
  ["Watch file changes", "ファイル変更監視"],
  ["Run on schedule", "スケジュール実行"],
  ["Watch Pattern", "監視パターン"],
  ["Debounce (ms)", "デバウンス (ms)"],
  ["Interval (seconds)", "実行間隔 (秒)"],
  ["Expression", "条件式"],
  ["Loop Type", "ループ種別"],
  ["Count (N times)", "カウント（N回）"],
  ["Condition (while loop)", "条件式（whileループ）"],
  ["List (forEach loop)", "リスト（forEachループ）"],
  ["Count", "回数"],
  ["Message", "メッセージ"],
  ["Log Level", "ログレベル"],
  ["Operation", "操作種別"],
  ["File Path", "ファイルパス"],
  ["Encoding", "エンコーディング"],
  ["Method", "メソッド"],
  ["Headers", "ヘッダー"],
  ["Body", "ボディ"],
  ["Authentication", "認証"],
  ["Token", "トークン"],
  ["Transform Type", "変換種別"],
  ["Expression / Parameters", "式/パラメータ"],
  ["Variable Name", "変数名"],
  ["Default Value", "デフォルト値"],
  ["Prompt", "プロンプト"],
  ["Model", "モデル"],
  ["Flow", "フロー"],
  ["Output Node", "出力ノード"],
  [
    "Templates {{input}}, {{input.xxx}}, and {{vars.xxx}} are supported",
    "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能",
  ],
  [
    "Specify files to watch with a glob pattern",
    "glob パターンで監視対象ファイルを指定",
  ],
  [
    "Delay execution when changes happen in rapid succession (milliseconds)",
    "連続変更時の実行遅延（ミリ秒）",
  ],
  [
    "Interval between scheduled executions in seconds. Minimum: 5",
    "定期実行の間隔（秒）。最小値: 5",
  ],
  [
    "JEXL expression. input and vars.xxx are available",
    "jexl式。input, vars.xxx が使用可能",
  ],
  [
    "count: repeat a fixed number of times / condition: repeat while the expression returns true / list: repeat for each item in the input list",
    "count: 指定回数繰り返す / condition: 条件がtrueの間繰り返す / list: 入力リストの各要素で繰り返す",
  ],
  [
    "The body port receives the iteration index (0, 1, 2, ...)",
    "bodyポートに反復インデックス(0,1,2...)が渡されます",
  ],
  [
    "JEXL expression. input, index, and vars.xxx are available. The loop continues while the expression returns true",
    "jexl式。input, index, vars.xxx が使用可能。式がtrueを返す間ループ継続",
  ],
  [
    "Templates {{input}} and {{vars.xxx}} are supported",
    "テンプレート {{input}}, {{vars.xxx}} が使用可能",
  ],
  [
    "template: {{input}}, {{vars.xxx}} / jsExpression: JEXL expression (input, vars.xxx)",
    "template: {{input}}, {{vars.xxx}} / jsExpression: jexl式 (input, vars.xxx)",
  ],
  [
    "Templates {{input}}, {{input.xxx}}, and {{vars.xxx}} are supported. If none are used, input is appended automatically",
    "テンプレート {{input}}, {{input.xxx}}, {{vars.xxx}} が使用可能。未使用時はinputを自動付与",
  ],
  [
    "Node used as the subflow output (defaults to the last node if not selected)",
    "サブフローの出力に使用するノード（未選択時は最終ノード）",
  ],
  ["Input: {{input}}", "入力: {{input}}"],
] as const;

const metadataLocalizationMap = new Map<string, string>(
  metadataLocalizationEntries.flatMap(([key, ...aliases]) =>
    [key, ...aliases].map((alias) => [alias, key] as const),
  ),
);

function localizeMetadataText(text: string | undefined): string | undefined {
  if (text == null) {
    return text;
  }

  const key = metadataLocalizationMap.get(text);
  return key ? vscode.l10n.t(key) : text;
}

function localizePortDefinition(port: PortDefinition): PortDefinition {
  return {
    ...port,
    label: localizeMetadataText(port.label) ?? port.label,
  };
}

function localizeSelectOption(option: SelectOption): SelectOption {
  return {
    ...option,
    label: localizeMetadataText(option.label) ?? option.label,
  };
}

function localizeSettingField(field: SettingFieldDef): SettingFieldDef {
  return {
    ...field,
    label: localizeMetadataText(field.label) ?? field.label,
    description: localizeMetadataText(field.description),
    placeholder: localizeMetadataText(field.placeholder),
    options: field.options?.map(localizeSelectOption),
  };
}

export function localizeNodeMetadata(
  metadata: INodeTypeMetadata,
): INodeTypeMetadata {
  return {
    ...metadata,
    label: localizeMetadataText(metadata.label) ?? metadata.label,
    category: localizeMetadataText(metadata.category) ?? metadata.category,
    inputPorts: (metadata.inputPorts ?? []).map(localizePortDefinition),
    outputPorts: (metadata.outputPorts ?? []).map(localizePortDefinition),
    settingsSchema: (metadata.settingsSchema ?? []).map(localizeSettingField),
  };
}