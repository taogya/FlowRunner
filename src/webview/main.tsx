// Trace: DD-02-003004 — WebView エントリポイント
import React from "react";
import ReactDOM from "react-dom/client";
import { FlowEditorApp } from "./components/FlowEditorApp.js";
import "@xyflow/react/dist/style.css";
import "./styles/flowrunner.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlowEditorApp />
  </React.StrictMode>,
);
