import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactAdapterRegistryEvidenceError,
  buildRuntimeReactAdapterRegistryEvidence,
  verifyRuntimeReactAdapterRegistryEvidence,
  writeRuntimeReactAdapterRegistryEvidence,
} from "../scripts/lib/runtime-react-adapter-registry-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactAdapterRegistryEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M05-T01 React adapter-registry evidence", async () => {
  const result = await verifyRuntimeReactAdapterRegistryEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 5);
  assert.equal(result.typeExports, 28);
  assert.equal(result.sourceDeclarations, 35);
  assert.equal(result.tsdocDeclarations, 35);
  assert.equal(result.packageTests, 10);
  assert.equal(result.compilerNegativeCases, 4);
  assert.equal(result.rootMutationTests, 11);
  assert.equal(result.trackedFiles, 25);
  assert.equal(result.failureCodes, 12);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent React adapter-registry builds are byte-identical", async () => {
  const first = await buildRuntimeReactAdapterRegistryEvidence({ verifyPrerequisite: false });
  const second = await buildRuntimeReactAdapterRegistryEvidence({ verifyPrerequisite: false });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered React adapter-registry evidence", async () => {
  const pristine = await buildRuntimeReactAdapterRegistryEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeReactAdapterRegistryEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("RUNTIME_REACT_ARTIFACT_DRIFT"),
  );
});

test("rejects missing, eager, or fallback-producing built runtime APIs", async () => {
  const runtimeApi = await import("../packages/runtime-react/dist/index.js");
  const missing = { ...runtimeApi };
  delete missing.createRuntimeReactAdapterRegistry;
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      runtimeApi: missing,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_RUNTIME_EXPORT_DRIFT"),
  );

  const eager = {
    ...runtimeApi,
    createRuntimeReactAdapterRegistry(input) {
      input.components[0]?.component({});
      return runtimeApi.createRuntimeReactAdapterRegistry(input);
    },
  };
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      runtimeApi: eager,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_RUNTIME_PROBE_FAILED"),
  );

  const fallback = {
    ...runtimeApi,
    renderRuntimeReactSurface(input) {
      const result = runtimeApi.renderRuntimeReactSurface(input);
      return result.status === "failed"
        ? {
            status: "rendered",
            surface: {
              documentId: "forged",
              surfaceId: "forged",
              element: {},
              nodeCount: 0,
              behaviorCount: 0,
            },
          }
        : result;
    },
  };
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      runtimeApi: fallback,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_RUNTIME_PROBE_FAILED"),
  );
});

test("rejects TSDoc, root export, import, dynamic loading, and platform-authority drift", async () => {
  const registryPath = "packages/runtime-react/src/registry.ts";
  const rendererPath = "packages/runtime-react/src/render-plan.tsx";
  const indexPath = "packages/runtime-react/src/index.ts";
  const registry = await readFile(new URL(`../${registryPath}`, import.meta.url), "utf8");
  const renderer = await readFile(new URL(`../${rendererPath}`, import.meta.url), "utf8");
  const index = await readFile(new URL(`../${indexPath}`, import.meta.url), "utf8");
  const cases = [
    [
      {
        [registryPath]: registry.replace(
          "/** Reference ceilings for one immutable React adapter registry.",
          "/* Reference ceilings for one immutable React adapter registry.",
        ),
      },
      "RUNTIME_REACT_TSDOC_MISSING",
    ],
    [{ [registryPath]: `import "react-dom";\n${registry}` }, "RUNTIME_REACT_IMPORT_BOUNDARY_DRIFT"],
    [
      { [rendererPath]: `${renderer}\nvoid import("rea" + "ct");\n` },
      "RUNTIME_REACT_EXECUTABLE_LOADING_DRIFT",
    ],
    [
      { [rendererPath]: `${renderer}\nvoid globalThis.document;\n` },
      "RUNTIME_REACT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [registryPath]: registry.replace("{0,127}", "{0,255}") },
      "RUNTIME_REACT_CAPABILITY_MATCHER_DRIFT",
    ],
    [
      { [indexPath]: `${index}\nexport const unexpectedRootAuthority = 1;\n` },
      "RUNTIME_REACT_INDEX_EXPORT_DRIFT",
    ],
  ];
  for (const [fileOverrides, code] of cases) {
    await assert.rejects(
      buildRuntimeReactAdapterRegistryEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(code),
    );
  }
});

test("rejects package, compiler-profile, and built declaration boundary drift", async () => {
  const packagePath = "packages/runtime-react/package.json";
  const tsconfigPath = "packages/runtime-react/tsconfig.json";
  const declarationPath = "packages/runtime-react/dist/index.d.ts";
  const manifest = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  const tsconfig = JSON.parse(
    await readFile(new URL(`../${tsconfigPath}`, import.meta.url), "utf8"),
  );
  const declaration = await readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8");

  manifest.dependencies["remote-loader"] = "1.0.0";
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(manifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_PACKAGE_CONTRACT_DRIFT"),
  );

  tsconfig.extends = "../../tsconfig.browser.json";
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      fileOverrides: { [tsconfigPath]: `${JSON.stringify(tsconfig)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_PACKAGE_CONTRACT_DRIFT"),
  );

  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      fileOverrides: {
        [declarationPath]: `${declaration}\nexport declare const unexpectedPublicApi: unknown;\n`,
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_INDEX_EXPORT_DRIFT"),
  );
});

test("rejects hidden, skipped, renamed, or untyped focused evidence cases", async () => {
  const packageTestsPath = "packages/runtime-react/test/adapter-registry.test.tsx";
  const compilerCasesPath = "packages/runtime-react/test/adapter-registry.types.ts";
  const rootTestsPath = "tests/runtime-react-adapter-registry.test.mjs";
  const packageTests = await readFile(new URL(`../${packageTestsPath}`, import.meta.url), "utf8");
  const compilerCases = await readFile(new URL(`../${compilerCasesPath}`, import.meta.url), "utf8");
  const rootTests = await readFile(new URL(`../${rootTestsPath}`, import.meta.url), "utf8");
  const cases = [
    {
      [packageTestsPath]: packageTests.replace("  it(", "  it.skip("),
    },
    {
      [compilerCasesPath]: compilerCases.replace("@ts-expect-error", "@removed-error"),
    },
    {
      [rootTestsPath]: rootTests.replace(
        'test("two independent React adapter-registry builds',
        'renamedTest("two independent React adapter-registry builds',
      ),
    },
  ];
  for (const fileOverrides of cases) {
    await assert.rejects(
      buildRuntimeReactAdapterRegistryEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("RUNTIME_REACT_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects prerequisite artifact tampering even when chained semantic verification is disabled", async () => {
  const prerequisite = await readFile(
    new URL("../docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json", import.meta.url),
  );
  const tampered = Buffer.from(prerequisite);
  tampered[0] ^= 1;

  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      prerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("RUNTIME_REACT_PREREQUISITE_DRIFT"),
  );
});

test("rejects moved, duplicated, indented, pending, or mismatched proof pins", async () => {
  const built = await buildRuntimeReactAdapterRegistryEvidence({ verifyPrerequisite: false });
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  const valid = proof.replace(/sha256:(?:PENDING|[0-9a-f]{64})/u, `sha256:${built.artifactSha256}`);
  const validMatrix = matrix.replace(
    /(`runtime-react-0\.1\.0-adapter-registry\.json`\n`sha256:)(?:PENDING|[0-9a-f]{64})(`\.)/u,
    `$1${built.artifactSha256}$2`,
  );
  const cases = [
    valid.replace("## Evidence artifact", "## Moved artifact"),
    `${valid}\n\`docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json\`\n`,
    valid.replace(
      "`docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json`",
      "  `docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json`",
    ),
    valid.replace(`sha256:${built.artifactSha256}`, "sha256:PENDING"),
    valid.replace(built.artifactSha256, "0".repeat(64)),
  ];
  for (const proofDocumentText of cases) {
    await assert.rejects(
      verifyRuntimeReactAdapterRegistryEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentText,
        proofMatrixText: validMatrix,
        buildOptions: { verifyPrerequisite: false },
      }),
      hasEvidenceCode("RUNTIME_REACT_PROOF_PIN_DRIFT"),
    );
  }

  const matrixCases = [
    validMatrix.replace("## M05-T01", "## Moved M05-T01"),
    `${validMatrix}\n\`runtime-react-0.1.0-adapter-registry.json\`\n`,
    validMatrix.replace(
      "`runtime-react-0.1.0-adapter-registry.json`",
      "  `runtime-react-0.1.0-adapter-registry.json`",
    ),
    validMatrix.replace(`sha256:${built.artifactSha256}`, "sha256:PENDING"),
    validMatrix.replace(built.artifactSha256, "0".repeat(64)),
  ];
  for (const proofMatrixText of matrixCases) {
    await assert.rejects(
      verifyRuntimeReactAdapterRegistryEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentText: valid,
        proofMatrixText,
        buildOptions: { verifyPrerequisite: false },
      }),
      hasEvidenceCode("RUNTIME_REACT_PROOF_MATRIX_PIN_DRIFT"),
    );
  }
});

test("atomic evidence writer rejects an existing symlink destination", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-proof-"));
  const target = path.join(temporaryDirectory, "target.json");
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactAdapterRegistryEvidence({
        artifactPath: destination,
        buildOptions: { verifyPrerequisite: false },
      }),
      TypeError,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("atomic evidence writer rejects temporary-byte tampering before rename", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-proof-"));
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactAdapterRegistryEvidence({
        artifactPath: destination,
        buildOptions: { verifyPrerequisite: false },
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      TypeError,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
