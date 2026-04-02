// Trace: DD-02-003004 — WebView エントリポイント
import * as l10n from "@vscode/l10n";
import React from "react";
import ReactDOM from "react-dom/client";
import { FlowEditorApp } from "./components/FlowEditorApp.js";
import "@xyflow/react/dist/style.css";
import "./styles/flowrunner.css";

// Trace: WebView i18n — initialize l10n with bundle injected by extension
declare global {
  interface Window {
    __VSCODE_L10N_BUNDLE__?: Record<string, string>;
  }
}
if (window.__VSCODE_L10N_BUNDLE__ && Object.keys(window.__VSCODE_L10N_BUNDLE__).length > 0) {
  l10n.config({ contents: window.__VSCODE_L10N_BUNDLE__ });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlowEditorApp />
  </React.StrictMode>,
);
