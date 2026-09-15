import { isAbsolute, relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

type T08ProofGraph = "authoring" | "host";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

function outputRoot(): string {
  const proofTemp = process.env.DESEN_M10A_T08_PROOF_TEMP;
  if (proofTemp === undefined) return resolve(PACKAGE_ROOT, "dist");
  if (!isAbsolute(proofTemp) || resolve(proofTemp) !== proofTemp || proofTemp.includes("\0")) {
    throw new TypeError("DESEN_M10A_T08_PROOF_TEMP must be a canonical absolute directory.");
  }
  return resolve(proofTemp, "dist");
}

function graphForMode(mode: string): T08ProofGraph {
  if (mode === "t08-proof-authoring") return "authoring";
  if (mode === "t08-proof-host") return "host";
  throw new TypeError(`Unsupported M10A-T08 proof build mode: ${mode}`);
}

function proofGraphReceipt(graph: T08ProofGraph): Plugin {
  return {
    name: `desen-starter-t08-${graph}-graph-receipt`,
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
      const hasT08Fixture = absoluteModules.some((id) => id.includes("/src/t08-shared/"));
      if (!hasStarterAdapters || !hasT08Fixture) {
        this.error(`${graph} graph omitted the reviewed T08 adapter fixture.`);
      }
      this.emitFile({
        type: "asset",
        fileName: `t08-${graph}-graph-proof.json`,
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            profile: "desen.m10a-t08.graph-proof.v1",
            graph,
            entry: `t08-${graph}.html`,
            result: "PASS",
            assertions: {
              exactStarterRegistryPresent: hasStarterAdapters,
              t08FixturePresent: hasT08Fixture,
              independentHostAuthority: graph === "host",
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
      assetsDir: `t08-${graph}-assets`,
      emptyOutDir: true,
      outDir: resolve(outputRoot(), `t08-${graph}`),
      rollupOptions: { input: resolve(PACKAGE_ROOT, `t08-${graph}.html`) },
    },
  };
});
