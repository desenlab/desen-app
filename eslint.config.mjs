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
  "packages/design-system-core/**/*.{ts,tsx}",
  "packages/design-system-authoring/**/*.{ts,tsx}",
  "packages/design-system-release/**/*.{ts,tsx}",
];

const browserFiles = [
  "apps/desen-app/**/*.{ts,tsx}",
  "apps/starter-catalog-web-proof/src/**/*.{ts,tsx}",
  "apps/design-system-workbench-proof/src/**/*.{ts,tsx}",
  "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  "apps/desen-app-browser-e2e/proof-application.tsx",
  "apps/desen-run/**/*.{ts,tsx}",
  "apps/reference-host-web/**/*.{ts,tsx}",
  "packages/runtime-web/**/*.{ts,tsx}",
  "packages/editor-web/**/*.{ts,tsx}",
  "packages/reference-catalog-web/**/*.{ts,tsx}",
  "packages/starter-catalog-web/**/*.{ts,tsx}",
];

const nodeFiles = [
  "apps/control-plane-api/**/*.{ts,tsx}",
  "apps/desen-app/dev/**/*.{js,mjs,ts}",
  "apps/desen-app-browser-e2e/*.config.ts",
  "apps/desen-app-browser-e2e/*.pw.ts",
  "apps/starter-catalog-web-proof/*.config.ts",
  "apps/starter-catalog-web-proof/*.pw.ts",
  "apps/starter-catalog-web-proof/*.mjs",
  "apps/starter-catalog-web-proof/scripts/*.mjs",
  "apps/design-system-workbench-proof/*.config.ts",
  "apps/design-system-workbench-proof/*.pw.ts",
  "apps/design-system-workbench-proof/*.mjs",
  "scripts/**/*.{js,cjs,mjs,ts}",
  "packages/starter-catalog-web/scripts/*.mjs",
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
      "**/dist-e2e/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.desen/**",
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
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
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
