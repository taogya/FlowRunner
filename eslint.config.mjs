// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // --- Global ignores ---
  {
    ignores: [
      "out/**",
      "dist/**",
      "node_modules/**",
      "demo/**",
      "ref/**",
      "*.config.*",
      "esbuild.config.mjs",
      "vitest.setup.ts",
    ],
  },

  // --- Base recommended rules ---
  eslint.configs.recommended,

  // --- TypeScript strict rules for extension code ---
  {
    files: ["src/extension/**/*.ts", "src/shared/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/require-await": "off",
    },
  },

  // --- WebView (React/TSX) ---
  {
    files: ["src/webview/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // --- Test files (relaxed) ---
  {
    files: ["src/test/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // --- Prettier compat (must be last) ---
  eslintConfigPrettier,
);
