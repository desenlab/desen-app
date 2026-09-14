import { isAbsolute, relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

type T07ProofGraph = "authoring" | "host";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

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
      const modules = absoluteModules.map((id) => relative(WORKSPACE_ROOT, id));
      const hasStarterAdapters = absoluteModules.some(
        (id) => id.includes("/packages/starter-catalog-web/") && id.includes("react-adapters"),
      );
      const hasPublisher = absoluteModules.some((id) => id.includes("/packages/publisher/"));
      const hasEditor = absoluteModules.some((id) => id.includes("/packages/editor-core/"));
      const hasT07Fixture = absoluteModules.some((id) => id.includes("/src/t07-authoring/"));

      if (!hasStarterAdapters) {
        this.error(`${graph} graph omitted the reviewed starter adapter registry.`);
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

export default defineConfig(({ mode }) => {
  const graph = graphForMode(mode);
  return {
    root: PACKAGE_ROOT,
    plugins: [proofGraphReceipt(graph)],
    build: {
      assetsDir: `t07-${graph}-assets`,
      emptyOutDir: true,
      outDir: resolve(outputRoot(), `t07-${graph}`),
      rollupOptions: { input: resolve(PACKAGE_ROOT, `t07-${graph}.html`) },
    },
  };
});
