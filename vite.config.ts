import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "ES2022",
    cssTarget: "chrome120",
    rollupOptions: {
      input: path.resolve(__dirname, "src/webview/main.tsx"),
      output: {
        format: "iife",
        entryFileNames: "webview.js",
        assetFileNames: "webview.[ext]",
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@webview": path.resolve(__dirname, "src/webview"),
    },
  },
});
