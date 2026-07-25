import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const neutralFiles = [
  "packages/protocol/**/*.{ts,tsx}",
  "packages/validator/**/*.{ts,tsx}",
  "packages/publisher/**/*.{ts,tsx}",
  "packages/catalog-sdk/**/*.{ts,tsx}",
  "packages/runtime-core/**/*.{ts,tsx}",
  "packages/editor-core/**/*.{ts,tsx}",
];

const browserFiles = [
  "apps/desen-app/**/*.{ts,tsx}",
  "apps/desen-run/**/*.{ts,tsx}",
  "apps/reference-host-web/**/*.{ts,tsx}",
  "packages/runtime-web/**/*.{ts,tsx}",
  "packages/editor-web/**/*.{ts,tsx}",
  "packages/reference-catalog-web/**/*.{ts,tsx}",
];

const nodeFiles = [
  "apps/control-plane-api/**/*.{ts,tsx}",
  "scripts/**/*.{js,cjs,mjs,ts}",
  "tests/**/*.{js,cjs,mjs,ts}",
  "*.config.{js,cjs,mjs,ts}",
];

const neutralRestrictedGlobals = [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch",
  "Request",
  "Response",
  "Headers",
  "WebSocket",
  "EventSource",
  "Worker",
  "HTMLElement",
  "Element",
  "Node",
  "CSSStyleSheet",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "crypto",
  "performance",
  "process",
  "Buffer",
  "require",
  "module",
  "__dirname",
  "__filename",
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
].map((name) => ({
  name,
  message: `${name} is platform-owned; inject an explicit host port instead.`,
}));

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "packages/protocol/upstream/**",
      "tests/boundaries/fixtures/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["packages/validator/schema-contract-syntax.d.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: browserFiles,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: neutralFiles,
    rules: {
      "no-restricted-globals": ["error", ...neutralRestrictedGlobals],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*"],
              message: "Node built-ins are forbidden in platform-neutral packages.",
            },
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "react-native",
                "react-native/*",
                "@react-native/*",
                "expo",
                "expo/*",
                "next",
                "next/*",
              ],
              message: "Framework imports belong in target-specific adapter packages.",
            },
            {
              group: ["*.css", "*.scss", "*.sass", "*.less", "*.styl"],
              message: "Stylesheets belong in Web-facing packages.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Inject deterministic identity or entropy instead of using Math.random().",
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Read time through the host clock port instead of Date.now().",
        },
      ],
    },
  },
  prettier,
);
