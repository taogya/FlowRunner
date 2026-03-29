// Trace: BD-02-003002

/**
 * WebviewPanel のライフサイクル管理
 */
export interface IFlowEditorManager {
  /** 指定フローのエディタを開く。既存パネルがあればアクティブ化、なければ新規作成 */
  openEditor(flowId: string, flowName?: string): void;

  /** 指定フローのエディタパネルを閉じる */
  closeEditor(flowId: string): void;

  /** 現在アクティブなエディタのフロー ID を返す。エディタ未表示なら undefined */
  getActiveFlowId(): string | undefined;

  /** 全パネルを破棄する。deactivate() 時に呼ばれる */
  dispose(): void;
}
