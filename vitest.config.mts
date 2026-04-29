import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    include: ['src/test/unit/**/*.test.{ts,tsx}', 'src/test/integration/**/*.test.{ts,tsx}', 'src/test/system/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@extension': path.resolve(__dirname, 'src/extension'),
      '@webview': path.resolve(__dirname, 'src/webview'),
      'vscode': path.resolve(__dirname, 'src/test/unit/__mocks__/vscode.ts'),
    },
  },
});
