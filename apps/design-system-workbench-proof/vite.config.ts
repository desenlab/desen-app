import { relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

function workbenchGraphReceipt(): Plugin {
  return {
    name: "desen-theme-workbench-graph-receipt",
    generateBundle(_options, output) {
      const absoluteModules = [
        ...new Set(
          Object.values(output).flatMap((entry) =>
            entry.type === "chunk"
              ? Object.keys(entry.modules).map((id) => id.split("?", 1)[0] ?? id)
              : [],
          ),
        ),
      ].sort();
      const modules = absoluteModules.map((id) => relative(WORKSPACE_ROOT, id));
      const hasAuthoring = absoluteModules.some((id) =>
        id.includes("/packages/design-system-authoring/"),
      );
      const forbiddenAuthorities = Object.freeze({
        desenApp: absoluteModules.some((id) => id.includes("/apps/desen-app/")),
        editor: absoluteModules.some(
          (id) => id.includes("/packages/editor-core/") || id.includes("/packages/editor-web/"),
        ),
        publisher: absoluteModules.some((id) => id.includes("/packages/publisher/")),
        runtime: absoluteModules.some(
          (id) =>
            id.includes("/packages/runtime-core/") ||
            id.includes("/packages/runtime-react/") ||
            id.includes("/packages/runtime-web/"),
        ),
        starterCatalog: absoluteModules.some((id) => id.includes("/packages/starter-catalog-web/")),
      });
      const isolated = Object.values(forbiddenAuthorities).every((present) => !present);

      if (!hasAuthoring) {
        this.error("workbench graph omitted @desen/design-system-authoring.");
      }
      if (!isolated) {
        this.error(
          "workbench graph crossed a forbidden App, Editor, Publisher, Runtime, or starter boundary.",
        );
      }

      this.emitFile({
        type: "asset",
        fileName: "workbench-graph-proof.json",
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            graph: "theme-workbench",
            entry: "index.html",
            result: "PASS",
            assertions: {
              designSystemAuthoringPresent: hasAuthoring,
              isolatedProofGraph: isolated,
              forbiddenAuthorities,
            },
            modules,
          },
          null,
          2,
        )}\n`,
      });
    },
  };
}

export default defineConfig({
  root: PACKAGE_ROOT,
  plugins: [workbenchGraphReceipt()],
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: resolve(PACKAGE_ROOT, "dist"),
    rollupOptions: { input: resolve(PACKAGE_ROOT, "index.html") },
  },
  preview: {
    host: "127.0.0.1",
    port: 4188,
    strictPort: true,
  },
});
