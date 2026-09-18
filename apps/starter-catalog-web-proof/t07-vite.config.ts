import { isAbsolute, relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

type T07ProofGraph = "authoring" | "host";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");
const STARTER_CATALOG_SPECIFIER = "@desen/starter-catalog-web/catalog.json";
const VIRTUAL_STARTER_CATALOG_ID = "\u0000desen-m10a-t07-current-starter-catalog";

interface CurrentStarterCatalogProofModule {
  readonly buildM10AT01PackageIdentity: () => Promise<{
    readonly catalogBytes: Uint8Array;
  }>;
}

function outputRoot(): string {
  const proofTemp = process.env.DESEN_M10A_T07_PROOF_TEMP;
  if (proofTemp === undefined) return resolve(PACKAGE_ROOT, "dist");
  if (!isAbsolute(proofTemp) || resolve(proofTemp) !== proofTemp || proofTemp.includes("\0")) {
    throw new TypeError("DESEN_M10A_T07_PROOF_TEMP must be a canonical absolute directory.");
  }
  return resolve(proofTemp, "dist");
}

function graphForMode(mode: string): T07ProofGraph {
  if (mode === "t07-proof-authoring") return "authoring";
  if (mode === "t07-proof-host") return "host";
  throw new TypeError(`Unsupported M10A-T07 proof build mode: ${mode}`);
}

/**
 * Binds this historical browser journey to the current compiled starter package without
 * rewriting the task-owned Catalog source. The source import remains an ordinary JSON import for
 * application code; only this isolated Vite capture receives the freshly derived bytes.
 */
async function currentStarterCatalogModule(): Promise<Plugin> {
  const proofModuleUrl = new URL("../../scripts/lib/m10a-t01-proof.mjs", import.meta.url).href;
  const proofModule = (await import(proofModuleUrl)) as CurrentStarterCatalogProofModule;
  const identity = await proofModule.buildM10AT01PackageIdentity();
  const catalogSource = new TextDecoder("utf-8", { fatal: true }).decode(identity.catalogBytes);
  try {
    JSON.parse(catalogSource);
  } catch {
    throw new TypeError("The current starter Catalog must remain valid UTF-8 JSON.");
  }
  return {
    name: "desen-m10a-t07-current-starter-catalog",
    enforce: "pre",
    resolveId(source) {
      return source === STARTER_CATALOG_SPECIFIER ? VIRTUAL_STARTER_CATALOG_ID : null;
    },
    load(id) {
      return id === VIRTUAL_STARTER_CATALOG_ID
        ? `export default JSON.parse(${JSON.stringify(catalogSource)});\n`
        : null;
    },
  };
}

function proofGraphReceipt(graph: T07ProofGraph): Plugin {
  return {
    name: `desen-starter-t07-${graph}-graph-receipt`,
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
      const hasCurrentStarterCatalog = absoluteModules.includes(VIRTUAL_STARTER_CATALOG_ID);
      const modules = absoluteModules
        .filter((id) => id !== VIRTUAL_STARTER_CATALOG_ID)
        .map((id) => relative(WORKSPACE_ROOT, id));
      const hasStarterAdapters = absoluteModules.some(
        (id) => id.includes("/packages/starter-catalog-web/") && id.includes("react-adapters"),
      );
      const hasPublisher = absoluteModules.some((id) => id.includes("/packages/publisher/"));
      const hasEditor = absoluteModules.some((id) => id.includes("/packages/editor-core/"));
      const hasT07Fixture = absoluteModules.some((id) => id.includes("/src/t07-authoring/"));

      if (!hasStarterAdapters || !hasCurrentStarterCatalog) {
        this.error(`${graph} graph omitted the reviewed starter Catalog authority.`);
      }
      if (graph === "authoring" && (!hasPublisher || !hasT07Fixture)) {
        this.error("T07 authoring graph did not execute its Source-to-Publisher boundary.");
      }
      if (graph === "host" && (hasPublisher || hasEditor || hasT07Fixture)) {
        this.error("T07 host graph crossed into authoring, Publisher, or Editor authority.");
      }

      this.emitFile({
        type: "asset",
        fileName: `t07-${graph}-graph-proof.json`,
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            profile: "desen.m10a-t07.graph-proof.v1",
            graph,
            entry: `t07-${graph}.html`,
            result: "PASS",
            assertions: {
              currentStarterCatalogPresent: hasCurrentStarterCatalog,
              exactStarterRegistryPresent: hasStarterAdapters,
              t07FixturePresent: graph === "authoring" ? hasT07Fixture : null,
              publisherPresent: hasPublisher,
              editorPresent: hasEditor,
              independentHostAuthority: graph === "host" ? !hasPublisher && !hasEditor : null,
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

export default defineConfig(async ({ mode }) => {
  const graph = graphForMode(mode);
  const currentCatalog = await currentStarterCatalogModule();
  return {
    root: PACKAGE_ROOT,
    plugins: [currentCatalog, proofGraphReceipt(graph)],
    build: {
      assetsDir: `t07-${graph}-assets`,
      emptyOutDir: true,
      outDir: resolve(outputRoot(), `t07-${graph}`),
      rollupOptions: { input: resolve(PACKAGE_ROOT, `t07-${graph}.html`) },
    },
  };
});
