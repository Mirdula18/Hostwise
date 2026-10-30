import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";

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
  {
    // Production code only: small, simple functions with named constants.
    files: ["src/**/*.{ts,tsx}", "functions/**/*.ts"],
    plugins: { "import-x": importX },
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, -1, 100],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          enforceConst: true,
        },
      ],
      "import-x/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    // A React component is one function; 150 lines is the component budget.
    files: ["src/**/*.tsx"],
    rules: {
      "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Every exported function, class and type in the pure core is documented.
    files: ["src/lib/**/*.ts", "functions/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"],
        },
      ],
    },
  },
);
