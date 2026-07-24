import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreHostPortsEvidenceError,
  buildRuntimeCoreHostPortsEvidence,
  verifyRuntimeCoreHostPortsEvidence,
  writeRuntimeCoreHostPortsEvidence,
} from "../scripts/lib/runtime-core-host-ports-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreHostPortsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T01 host-port evidence", async () => {
  const result = await verifyRuntimeCoreHostPortsEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.ports, 9);
  assert.equal(result.callbacks, 14);
  assert.equal(result.runtimeExports, 1);
  assert.equal(result.typeExports, 30);
  assert.equal(result.packageTests, 10);
  assert.equal(result.compilerNegativeCases, 9);
  assert.equal(result.rootMutationTests, 10);
  assert.equal(result.traceRules, 7);
  assert.equal(result.trackedFiles, 11);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent host-port evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });
  const second = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered evidence", async () => {
  const pristine = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCoreHostPortsEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("HOST_PORTS_ARTIFACT_DRIFT"),
  );
});

test("rejects missing, eager, mutable, or identity-changing factories", async () => {
  const factories = [
    {},
    {
      createRuntimeHostPorts(input) {
        input.clock.now();
        return input;
      },
    },
    {
      createRuntimeHostPorts(input) {
        return { ...input };
      },
    },
    {
      createRuntimeHostPorts(input) {
        return Object.freeze({
          ...input,
          navigation: Object.freeze({ navigate: (...args) => input.navigation.navigate(...args) }),
        });
      },
    },
  ];

  for (const runtimeApi of factories) {
    await assert.rejects(
      buildRuntimeCoreHostPortsEvidence({ runtimeApi, verifyPrerequisite: false }),
      (error) =>
        error instanceof RuntimeCoreHostPortsEvidenceError &&
        [
          "HOST_PORTS_RUNTIME_EXPORT_MISSING",
          "HOST_PORTS_RUNTIME_EXPORT_DRIFT",
          "HOST_PORTS_FACTORY_EAGER_OR_MUTABLE",
          "HOST_PORTS_CALLBACK_IDENTITY_DRIFT",
        ].includes(error.code),
    );
  }
});

test("rejects public export, TSDoc, platform-import, and declaration drift", async () => {
  const sourcePath = "packages/runtime-core/src/host-ports.ts";
  const indexPath = "packages/runtime-core/src/index.ts";
  const declarationPath = "packages/runtime-core/dist/host-ports.d.ts";
  const indexDeclarationPath = "packages/runtime-core/dist/index.d.ts";
  const source = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
  const index = await readFile(new URL(`../${indexPath}`, import.meta.url), "utf8");
  const declaration = await readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8");
  const indexDeclaration = await readFile(
    new URL(`../${indexDeclarationPath}`, import.meta.url),
    "utf8",
  );

  for (const [fileOverrides, expectedCode] of [
    [
      { [sourcePath]: source.replace("/** A JSON primitive", "/* A JSON primitive") },
      "HOST_PORTS_TSDOC_MISSING",
    ],
    [{ [sourcePath]: `import React from "react";\n${source}` }, "HOST_PORTS_IMPORT_BOUNDARY_DRIFT"],
    [
      { [sourcePath]: `${source}\nvoid import("rea" + "ct");\n` },
      "HOST_PORTS_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid new Function("return 1");\n` },
      "HOST_PORTS_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [indexPath]: index.replace('export { createRuntimeHostPorts } from "./host-ports.js";', ""),
      },
      "HOST_PORTS_INDEX_EXPORT_DRIFT",
    ],
    [
      { [indexPath]: `${index}\nexport const unexpectedPublicRuntimeApi = globalThis;\n` },
      "HOST_PORTS_INDEX_EXPORT_DRIFT",
    ],
    [
      { [declarationPath]: declaration.replace("RuntimeTokenPort", "ChangedTokenPort") },
      "HOST_PORTS_DECLARATION_DRIFT",
    ],
    [
      {
        [indexDeclarationPath]: `${indexDeclaration}\nexport declare const unexpectedPublicApi: unknown;\n`,
      },
      "HOST_PORTS_INDEX_EXPORT_DRIFT",
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCoreHostPortsEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(expectedCode),
    );
  }
});

test("rejects package and root command wiring drift without owning future unrelated scripts", async () => {
  const packagePath = "packages/runtime-core/package.json";
  const rootPath = "package.json";
  const packageManifest = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  const rootManifest = JSON.parse(
    await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"),
  );

  packageManifest.scripts["test:host-ports"] = "vitest run";
  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(packageManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_PACKAGE_CONTRACT_DRIFT"),
  );

  const packageWithBackdoor = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  packageWithBackdoor.exports["./backdoor"] = "./dist/host-ports.js";
  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(packageWithBackdoor)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_PACKAGE_CONTRACT_DRIFT"),
  );

  rootManifest.scripts["verify:runtime-core-host-ports"] = "node changed.mjs";
  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      fileOverrides: { [rootPath]: `${JSON.stringify(rootManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_ROOT_SCRIPT_DRIFT"),
  );

  const futureRoot = JSON.parse(await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"));
  futureRoot.scripts["future:m04-task"] = "node future.mjs";
  const baseline = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });
  const future = await buildRuntimeCoreHostPortsEvidence({
    fileOverrides: { [rootPath]: `${JSON.stringify(futureRoot)}\n` },
    verifyPrerequisite: false,
  });
  assert.deepEqual(baseline.artifactBytes, future.artifactBytes);

  const packageTestsPath = "packages/runtime-core/test/host-ports.test.ts";
  const compilerCasesPath = "packages/runtime-core/test/host-ports.types.ts";
  const rootTestsPath = "tests/runtime-core-host-ports.test.mjs";
  const packageTests = await readFile(new URL(`../${packageTestsPath}`, import.meta.url), "utf8");
  const compilerCases = await readFile(new URL(`../${compilerCasesPath}`, import.meta.url), "utf8");
  const rootTests = await readFile(new URL(`../${rootTestsPath}`, import.meta.url), "utf8");
  for (const [targetPath, changedSource] of [
    [
      packageTestsPath,
      packageTests.replace(
        'it("keeps the captured boundary stable',
        'untrackedScenario("keeps the captured boundary stable',
      ),
    ],
    [
      packageTestsPath,
      packageTests.replace(
        'it("keeps the captured boundary stable',
        'false && it("keeps the captured boundary stable',
      ),
    ],
    [compilerCasesPath, compilerCases.replace("@ts-expect-error", "@type-error")],
    [
      rootTestsPath,
      rootTests.replace(
        'test("two independent host-port evidence builds',
        'untrackedScenario("two independent host-port evidence builds',
      ),
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCoreHostPortsEvidence({
        fileOverrides: { [targetPath]: changedSource },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("HOST_PORTS_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects direct trace ownership and PF-031 boundary drift", async () => {
  const tracePath = "docs/proof/protocol-0.1.0-traceability.json";
  const findingPath = "docs/plan/PROTOCOL-FINDINGS.md";
  const trace = JSON.parse(await readFile(new URL(`../${tracePath}`, import.meta.url), "utf8"));
  trace.proseRules.find((rule) => rule.id === "R-105").owners = ["M04-T10"];
  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      fileOverrides: { [tracePath]: `${JSON.stringify(trace)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_TRACE_DRIFT"),
  );

  const findings = await readFile(new URL(`../${findingPath}`, import.meta.url), "utf8");
  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      fileOverrides: {
        [findingPath]: findings.replace(
          "TypeScript is not a trust boundary",
          "TypeScript is the trust boundary",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_FINDING_DRIFT"),
  );
});

test("rejects stale injected M03-T10 prerequisite bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/reference-catalog-web-capability-artifact.json",
    import.meta.url,
  );
  const original = await readFile(artifactPath);
  const tampered = Buffer.concat([original, Buffer.from(" ")]);

  await assert.rejects(
    buildRuntimeCoreHostPortsEvidence({
      prerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("HOST_PORTS_PREREQUISITE_DRIFT"),
  );
});

test("atomic writer rejects symlink destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-host-ports-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "artifact.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  const evidence = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });

  await assert.rejects(
    writeRuntimeCoreHostPortsEvidence({
      artifactPath: link,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
    }),
    /regular file/u,
  );
});

test("atomic writer detects temporary-byte tampering before rename", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-host-ports-tamper-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "artifact.json");
  const evidence = await buildRuntimeCoreHostPortsEvidence({ verifyPrerequisite: false });

  await assert.rejects(
    writeRuntimeCoreHostPortsEvidence({
      artifactPath,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "{}\n");
      },
    }),
    /temporary bytes changed/u,
  );
});
