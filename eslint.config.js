import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      ".wrangler",
      "playwright-report",
      "test-results",
      "hostwise-docs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "error",
      "no-warning-comments": ["error", { terms: ["todo", "fixme"], location: "anywhere" }],
      "react/no-danger": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "AI output must render as text only.",
        },
      ],
    },
  },
  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-*", "zustand", "zustand/*"] },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.property.name='env'][property.name=/GEMINI/]",
          message: "Gemini secrets must never be read in the browser bundle.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "AI output must render as text only.",
        },
      ],
    },
  },
);
