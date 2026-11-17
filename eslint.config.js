// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/dist-test/**", "**/dist-formal-gw/**", "**/node_modules/**", "coverage/**", ".local-assets/**", "docs/**", "reports/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { projectService: { allowDefaultProject: ["*.js", "vitest.config.ts", "tools/e2e/*.mjs"] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/core-sim/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng; Math.random must not decide simulation outcomes." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "core-sim must not read wall-clock time." },
        { name: "performance", message: "core-sim must not read wall-clock time." },
        { name: "document", message: "core-sim has no DOM." },
        { name: "window", message: "core-sim has no DOM." },
      ],
    },
  },
  { files: ["**/*.js", "**/*.mjs"], ...tseslint.configs.disableTypeChecked },
);
