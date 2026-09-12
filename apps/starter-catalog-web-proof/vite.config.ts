import { isAbsolute, relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

type ProofGraph = "authoring" | "host";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

function outputRoot(): string {
  const proofTemp = process.env.DESEN_M10A_T05_PROOF_TEMP;
  if (proofTemp === undefined) return resolve(PACKAGE_ROOT, "dist");
  if (!isAbsolute(proofTemp) || resolve(proofTemp) !== proofTemp || proofTemp.includes("\0")) {
    throw new TypeError("DESEN_M10A_T05_PROOF_TEMP must be a canonical absolute directory.");
  }
  return resolve(proofTemp, "dist");
}

function graphForMode(mode: string): ProofGraph {
  if (mode === "proof-authoring") return "authoring";
  if (mode === "proof-host") return "host";
  throw new TypeError(`Unsupported starter proof build mode: ${mode}`);
}

function proofGraphReceipt(graph: ProofGraph): Plugin {
  return {
    name: `desen-starter-${graph}-graph-receipt`,
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
      const hasStarterAdapters = absoluteModules.some(
        (id) => id.includes("/packages/starter-catalog-web/") && id.includes("react-adapters"),
      );
      const hasPublisher = absoluteModules.some((id) => id.includes("/packages/publisher/"));
      const hasEditor = absoluteModules.some((id) => id.includes("/packages/editor-core/"));

      if (!hasStarterAdapters)
        this.error(`${graph} graph omitted the reviewed starter adapter registry.`);
      if (graph === "authoring" && !hasPublisher) {
        this.error("authoring graph did not execute the Source-to-Publisher boundary.");
      }
      if (graph === "host" && (hasPublisher || hasEditor)) {
        this.error("host graph crossed into Publisher or Editor authority.");
      }

      this.emitFile({
        type: "asset",
        fileName: `${graph}-graph-proof.json`,
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            graph,
            entry: `${graph}.html`,
            result: "PASS",
            assertions: {
              exactStarterRegistryPresent: hasStarterAdapters,
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

export default defineConfig(({ mode }) => {
  const graph = graphForMode(mode);
  return {
    root: PACKAGE_ROOT,
    plugins: [proofGraphReceipt(graph)],
    build: {
      assetsDir: `${graph}-assets`,
      emptyOutDir: true,
      outDir: resolve(outputRoot(), graph),
      rollupOptions: { input: resolve(PACKAGE_ROOT, `${graph}.html`) },
    },
  };
});
