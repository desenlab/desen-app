import { isAbsolute, relative, resolve } from "node:path";

import { defineConfig } from "vite";

import type { Plugin } from "vite";

type T09ProofGraph = "authoring" | "host";

const PACKAGE_ROOT = import.meta.dirname;
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, "../..");

function outputRoot(): string {
  const proofTemp = process.env.DESEN_M10A_T09_PROOF_TEMP;
  if (proofTemp === undefined) return resolve(PACKAGE_ROOT, "dist");
  if (!isAbsolute(proofTemp) || resolve(proofTemp) !== proofTemp || proofTemp.includes("\0")) {
    throw new TypeError("DESEN_M10A_T09_PROOF_TEMP must be a canonical absolute directory.");
  }
  return resolve(proofTemp, "dist");
}

function graphForMode(mode: string): T09ProofGraph {
  if (mode === "t09-proof-authoring") return "authoring";
  if (mode === "t09-proof-host") return "host";
  throw new TypeError(`Unsupported M10A-T09 proof build mode: ${mode}`);
}

function proofGraphReceipt(graph: T09ProofGraph): Plugin {
  return {
    name: `desen-starter-t09-${graph}-graph-receipt`,
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
      const hasT09Fixture = absoluteModules.some((id) => id.includes("/src/t09-shared/"));
      if (!hasStarterAdapters || !hasT09Fixture) {
        this.error(`${graph} graph omitted the reviewed T09 adapter fixture.`);
      }
      this.emitFile({
        type: "asset",
        fileName: `t09-${graph}-graph-proof.json`,
        source: `${JSON.stringify(
          {
            schemaVersion: 1,
            profile: "desen.m10a-t09.graph-proof.v1",
            graph,
            entry: `t09-${graph}.html`,
            result: "PASS",
            assertions: {
              exactStarterRegistryPresent: hasStarterAdapters,
              t09FixturePresent: hasT09Fixture,
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
      assetsDir: `t09-${graph}-assets`,
      emptyOutDir: true,
      outDir: resolve(outputRoot(), `t09-${graph}`),
      rollupOptions: { input: resolve(PACKAGE_ROOT, `t09-${graph}.html`) },
    },
  };
});
