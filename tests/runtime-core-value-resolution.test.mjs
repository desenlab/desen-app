import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreValueResolutionEvidenceError,
  buildRuntimeCoreValueResolutionEvidence,
  verifyRuntimeCoreValueResolutionEvidence,
  writeRuntimeCoreValueResolutionEvidence,
} from "../scripts/lib/runtime-core-value-resolution-proof.mjs";

const runtimeApi = await import("../packages/runtime-core/dist/index.js");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreValueResolutionEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T02 value-resolution evidence", async () => {
  const result = await verifyRuntimeCoreValueResolutionEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.namespaces, 7);
  assert.equal(result.runtimeExports, 3);
  assert.equal(result.typeExports, 17);
  assert.equal(result.packageTests, 34);
  assert.equal(result.compilerNegativeCases, 10);
  assert.equal(result.rootMutationTests, 13);
  assert.equal(result.traceRules, 9);
  assert.equal(result.trackedFiles, 11);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent value-resolution evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCoreValueResolutionEvidence({ verifyPrerequisite: false });
  const second = await buildRuntimeCoreValueResolutionEvidence({ verifyPrerequisite: false });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered value-resolution evidence", async () => {
  const pristine = await buildRuntimeCoreValueResolutionEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCoreValueResolutionEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("VALUE_RESOLUTION_ARTIFACT_DRIFT"),
  );
});

test("rejects a resolver that treats JSON null as missing and selects fallback", async () => {
  const changedApi = {
    ...runtimeApi,
    resolveRuntimeValue(spec, snapshot) {
      if (spec?.$ref === "state.profile.nullable") {
        return { status: "resolved", value: spec.fallback, usedFallback: true };
      }
      return runtimeApi.resolveRuntimeValue(spec, snapshot);
    },
  };

  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects a resolver that lets fallback create an unknown root", async () => {
  const changedApi = {
    ...runtimeApi,
    resolveRuntimeValue(spec, snapshot) {
      if (spec?.$ref === "state.unknown") {
        return { status: "resolved", value: spec.fallback, usedFallback: true };
      }
      return runtimeApi.resolveRuntimeValue(spec, snapshot);
    },
  };

  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects array traversal or second-pass evaluation of reference-shaped scope data", async () => {
  const changedApis = [
    {
      ...runtimeApi,
      resolveRuntimeValue(spec, snapshot) {
        if (spec?.$ref === "state.list.length") {
          return { status: "resolved", value: 2, usedFallback: false };
        }
        return runtimeApi.resolveRuntimeValue(spec, snapshot);
      },
    },
    {
      ...runtimeApi,
      resolveRuntimeValue(spec, snapshot) {
        if (spec?.$ref === "state.indirect") {
          return { status: "resolved", value: "second-pass", usedFallback: false };
        }
        return runtimeApi.resolveRuntimeValue(spec, snapshot);
      },
    },
  ];

  for (const changedApi of changedApis) {
    await assert.rejects(
      buildRuntimeCoreValueResolutionEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }
});

test("rejects removal or widening of the bounded JSON safety profile", async () => {
  const changedApi = {
    ...runtimeApi,
    RUNTIME_VALUE_SAFETY_LIMITS: Object.freeze({
      ...runtimeApi.RUNTIME_VALUE_SAFETY_LIMITS,
      maxJsonNodes: runtimeApi.RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes + 1,
    }),
  };

  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_SAFETY_LIMIT_DRIFT"),
  );

  const amplificationApi = {
    ...runtimeApi,
    resolveRuntimeValue(spec, snapshot) {
      const result = runtimeApi.resolveRuntimeValue(spec, snapshot);
      if (result.status === "invalid" && Array.isArray(spec) && spec.length === 5) {
        return { status: "resolved", value: null, usedFallback: false };
      }
      return result;
    },
  };
  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      runtimeApi: amplificationApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects public export, TSDoc, platform-import, and declaration drift", async () => {
  const sourcePath = "packages/runtime-core/src/value-resolution.ts";
  const indexPath = "packages/runtime-core/src/index.ts";
  const declarationPath = "packages/runtime-core/dist/value-resolution.d.ts";
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
      { [sourcePath]: source.replace("/** A DESEN reference form", "/* A DESEN reference form") },
      "VALUE_RESOLUTION_TSDOC_MISSING",
    ],
    [
      { [sourcePath]: `import React from "react";\n${source}` },
      "VALUE_RESOLUTION_IMPORT_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid import("rea" + "ct");\n` },
      "VALUE_RESOLUTION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid new Function("return 1");\n` },
      "VALUE_RESOLUTION_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [indexPath]: index.replace("  createRuntimeResolutionSnapshot,\n", ""),
      },
      "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
    ],
    [
      {
        [indexPath]: `${index}\nexport { createRuntimeResolutionSnapshot } from "./host-ports.js";\n`,
      },
      "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
    ],
    [
      {
        [declarationPath]: declaration.replace(
          "RuntimeReferenceFailureReason",
          "ChangedReferenceFailureReason",
        ),
      },
      "VALUE_RESOLUTION_DECLARATION_DRIFT",
    ],
    [
      {
        [indexDeclarationPath]: `${indexDeclaration}\nexport declare const leakedPlatform: typeof window;\n`,
      },
      "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCoreValueResolutionEvidence({
        fileOverrides,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode(expectedCode),
    );
  }
});

test("rejects package, root wiring, skipped tests, and conditional test registration drift", async () => {
  const packagePath = "packages/runtime-core/package.json";
  const rootPath = "package.json";
  const packageTestsPath = "packages/runtime-core/test/value-resolution.test.ts";
  const compilerCasesPath = "packages/runtime-core/test/value-resolution.types.ts";
  const rootTestsPath = "tests/runtime-core-value-resolution.test.mjs";
  const packageManifest = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  const rootManifest = JSON.parse(
    await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"),
  );
  const packageTests = await readFile(new URL(`../${packageTestsPath}`, import.meta.url), "utf8");
  const compilerCases = await readFile(new URL(`../${compilerCasesPath}`, import.meta.url), "utf8");
  const rootTests = await readFile(new URL(`../${rootTestsPath}`, import.meta.url), "utf8");

  packageManifest.scripts["test:value-resolution"] = "vitest run";
  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(packageManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_PACKAGE_CONTRACT_DRIFT"),
  );

  rootManifest.scripts["verify:runtime-core-value-resolution"] = "node changed.mjs";
  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      fileOverrides: { [rootPath]: `${JSON.stringify(rootManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_ROOT_SCRIPT_DRIFT"),
  );

  for (const [targetPath, changedSource] of [
    [
      packageTestsPath,
      packageTests.replace(
        'it("copies all seven namespaces',
        'it.skip("copies all seven namespaces',
      ),
    ],
    [
      packageTestsPath,
      packageTests.replace(
        'it("copies all seven namespaces',
        'false && it("copies all seven namespaces',
      ),
    ],
    [compilerCasesPath, compilerCases.replace("@ts-expect-error", "@type-error")],
    [
      rootTestsPath,
      rootTests.replace(
        'test("two independent value-resolution evidence builds',
        'false && test("two independent value-resolution evidence builds',
      ),
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCoreValueResolutionEvidence({
        fileOverrides: { [targetPath]: changedSource },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("VALUE_RESOLUTION_TEST_INVENTORY_DRIFT"),
    );
  }

  const futureRoot = JSON.parse(await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"));
  futureRoot.scripts["future:m04-task"] = "node future.mjs";
  const baseline = await buildRuntimeCoreValueResolutionEvidence({
    verifyPrerequisite: false,
  });
  const future = await buildRuntimeCoreValueResolutionEvidence({
    fileOverrides: { [rootPath]: `${JSON.stringify(futureRoot)}\n` },
    verifyPrerequisite: false,
  });
  assert.deepEqual(baseline.artifactBytes, future.artifactBytes);
});

test("rejects direct trace ownership and PF-032 boundary drift", async () => {
  const tracePath = "docs/proof/protocol-0.1.0-traceability.json";
  const findingPath = "docs/plan/PROTOCOL-FINDINGS.md";
  const trace = JSON.parse(await readFile(new URL(`../${tracePath}`, import.meta.url), "utf8"));
  trace.proseRules.find((rule) => rule.id === "R-047").owners = ["M02-T10"];
  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      fileOverrides: { [tracePath]: `${JSON.stringify(trace)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_TRACE_DRIFT"),
  );

  const findings = await readFile(new URL(`../${findingPath}`, import.meta.url), "utf8");
  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      fileOverrides: {
        [findingPath]: findings.replace(
          "JSON null remains resolved and never selects fallback",
          "JSON null selects fallback",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_FINDING_DRIFT"),
  );
});

test("rejects stale injected M04-T01 prerequisite bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/runtime-core-0.1.0-host-ports.json",
    import.meta.url,
  );
  const original = await readFile(artifactPath);
  const tampered = Buffer.concat([original, Buffer.from(" ")]);

  await assert.rejects(
    buildRuntimeCoreValueResolutionEvidence({
      prerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("VALUE_RESOLUTION_PREREQUISITE_DRIFT"),
  );
});

test("atomic value-resolution writer rejects symlink destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-value-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "artifact.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  const evidence = await buildRuntimeCoreValueResolutionEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCoreValueResolutionEvidence({
      artifactPath: link,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
    }),
    /regular file/u,
  );
});

test("atomic value-resolution writer detects temporary-byte tampering before rename", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-value-tamper-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "artifact.json");
  const evidence = await buildRuntimeCoreValueResolutionEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCoreValueResolutionEvidence({
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
