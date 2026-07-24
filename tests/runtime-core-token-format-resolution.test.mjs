import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreTokenFormatResolutionEvidenceError,
  buildRuntimeCoreTokenFormatResolutionEvidence,
  verifyRuntimeCoreTokenFormatResolutionEvidence,
  writeRuntimeCoreTokenFormatResolutionEvidence,
} from "../scripts/lib/runtime-core-token-format-resolution-proof.mjs";

const runtimeApi = await import("../packages/runtime-core/dist/index.js");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreTokenFormatResolutionEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T03 token/format evidence", async () => {
  const result = await verifyRuntimeCoreTokenFormatResolutionEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 1);
  assert.equal(result.typeExports, 4);
  assert.ok(result.packageTests >= 7);
  assert.ok(result.compilerNegativeCases > 0);
  assert.equal(result.rootMutationTests, 13);
  assert.equal(result.traceRules, 2);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.tokenProbes, 7);
  assert.equal(result.formatProbes, 8);
  assert.equal(result.safetyProbes, 4);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent token/format evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCoreTokenFormatResolutionEvidence({ verifyPrerequisite: false });
  const second = await buildRuntimeCoreTokenFormatResolutionEvidence({ verifyPrerequisite: false });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered token/format evidence", async () => {
  const pristine = await buildRuntimeCoreTokenFormatResolutionEvidence({
    verifyPrerequisite: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCoreTokenFormatResolutionEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisite: false },
    }),
    hasEvidenceCode("TOKEN_FORMAT_ARTIFACT_DRIFT"),
  );
});

test("rejects token request, cache, and resolved-null semantic drift", async () => {
  const cacheDrift = {
    ...runtimeApi,
    materializeRuntimeValue(spec, snapshot, context) {
      if (
        Array.isArray(spec) &&
        spec.length === 2 &&
        spec.every((value) => value?.$token === "color.action.primary")
      ) {
        context.tokens.resolve({
          context: context.requestContext,
          token: "color.action.primary",
        });
      }
      return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
    },
  };
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      runtimeApi: cacheDrift,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
  );

  const nullDrift = {
    ...runtimeApi,
    materializeRuntimeValue(spec, snapshot, context) {
      if (spec?.$token === "value.null") {
        return {
          status: "unresolved",
          code: "REFERENCE_UNRESOLVED",
          pointer: "/$token",
          token: "value.null",
          reason: "missing-token",
        };
      }
      return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
    },
  };
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      runtimeApi: nullDrift,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects missing-token, provider-redaction, and inert-result semantic drift", async () => {
  const changedApis = [
    {
      ...runtimeApi,
      materializeRuntimeValue(spec, snapshot, context) {
        if (spec?.$token === "value.missing") {
          return { status: "resolved", value: null, usedFallback: false };
        }
        return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
      },
    },
    {
      ...runtimeApi,
      materializeRuntimeValue(spec, snapshot, context) {
        if (spec?.wrapper?.$token === "value.throw") {
          return {
            status: "failed",
            code: "ADAPTER_FAILURE",
            pointer: "/wrapper/$token",
            adapter: "token-provider",
            token: "value.throw",
            detail: "secret provider detail",
          };
        }
        return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
      },
    },
    {
      ...runtimeApi,
      materializeRuntimeValue(spec, snapshot, context) {
        if (spec?.$token === "value.inert") {
          return { status: "resolved", value: "Ada", usedFallback: false };
        }
        return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
      },
    },
  ];

  for (const changedApi of changedApis) {
    await assert.rejects(
      buildRuntimeCoreTokenFormatResolutionEvidence({
        runtimeApi: changedApi,
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
    );
  }
});

test("rejects PF-017 parsing and canonical JSON formatting drift", async () => {
  const changedApi = {
    ...runtimeApi,
    materializeRuntimeValue(spec, snapshot, context) {
      const result = runtimeApi.materializeRuntimeValue(spec, snapshot, context);
      if (
        spec?.$format?.template === "{raw}|{count}|{flag}|{none}|{data}|{raw}" &&
        result.status === "resolved"
      ) {
        return {
          ...result,
          value: "Ada|2|true|null|[object Object]|Ada",
        };
      }
      if (spec?.$format?.template === "{{name}}") {
        return { status: "resolved", value: "{Ada}", usedFallback: false };
      }
      return result;
    },
  };

  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      runtimeApi: changedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects partial results or removal of amplified-output bounds", async () => {
  const partialApi = {
    ...runtimeApi,
    materializeRuntimeValue(spec, snapshot, context) {
      if (Array.isArray(spec) && spec[0] === "visible-before-failure") {
        return { status: "resolved", value: [spec[0]], usedFallback: false };
      }
      return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
    },
  };
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      runtimeApi: partialApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
  );

  const unboundedApi = {
    ...runtimeApi,
    materializeRuntimeValue(spec, snapshot, context) {
      if (spec?.$format?.template?.length === 660_000) {
        return { status: "resolved", value: "x", usedFallback: false };
      }
      return runtimeApi.materializeRuntimeValue(spec, snapshot, context);
    },
  };
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      runtimeApi: unboundedApi,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects public export, TSDoc, platform-import, and declaration drift", async () => {
  const sourcePath = "packages/runtime-core/src/token-format-resolution.ts";
  const indexPath = "packages/runtime-core/src/index.ts";
  const declarationPath = "packages/runtime-core/dist/token-format-resolution.d.ts";
  const builtPath = "packages/runtime-core/dist/token-format-resolution.js";
  const source = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
  const index = await readFile(new URL(`../${indexPath}`, import.meta.url), "utf8");
  const declaration = await readFile(new URL(`../${declarationPath}`, import.meta.url), "utf8");
  const built = await readFile(new URL(`../${builtPath}`, import.meta.url), "utf8");

  for (const [fileOverrides, expectedCode] of [
    [{ [sourcePath]: source.replace("/**", "/*") }, "TOKEN_FORMAT_TSDOC_MISSING"],
    [
      { [sourcePath]: `import React from "react";\n${source}` },
      "TOKEN_FORMAT_IMPORT_BOUNDARY_DRIFT",
    ],
    [
      { [sourcePath]: `${source}\nvoid new Function("return 1");\n` },
      "TOKEN_FORMAT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      {
        [sourcePath]: `${source}\nconst DynamicFunction = Function;\nvoid DynamicFunction("return 1")();\n`,
      },
      "TOKEN_FORMAT_PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      { [indexPath]: index.replace("materializeRuntimeValue", "changedMaterializeRuntimeValue") },
      "TOKEN_FORMAT_INDEX_EXPORT_DRIFT",
    ],
    [
      {
        [declarationPath]: declaration.replace(
          "RuntimeTokenProviderFailure",
          "ChangedTokenProviderFailure",
        ),
      },
      "TOKEN_FORMAT_DECLARATION_DRIFT",
    ],
    [{ [builtPath]: `${built}\nvoid window;\n` }, "TOKEN_FORMAT_DISTRIBUTION_BOUNDARY_DRIFT"],
  ]) {
    await assert.rejects(
      buildRuntimeCoreTokenFormatResolutionEvidence({
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
  const packageTestsPath = "packages/runtime-core/test/token-format-resolution.test.ts";
  const typeTestsPath = "packages/runtime-core/test/token-format-resolution.types.ts";
  const rootTestsPath = "tests/runtime-core-token-format-resolution.test.mjs";
  const packageManifest = JSON.parse(
    await readFile(new URL(`../${packagePath}`, import.meta.url), "utf8"),
  );
  const rootManifest = JSON.parse(
    await readFile(new URL(`../${rootPath}`, import.meta.url), "utf8"),
  );
  const packageTests = await readFile(new URL(`../${packageTestsPath}`, import.meta.url), "utf8");
  const typeTests = await readFile(new URL(`../${typeTestsPath}`, import.meta.url), "utf8");
  const rootTests = await readFile(new URL(`../${rootTestsPath}`, import.meta.url), "utf8");

  packageManifest.scripts["test:token-format-resolution"] = "vitest run";
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      fileOverrides: { [packagePath]: `${JSON.stringify(packageManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_PACKAGE_CONTRACT_DRIFT"),
  );

  rootManifest.scripts["verify:runtime-core-token-format-resolution"] = "node changed.mjs";
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      fileOverrides: { [rootPath]: `${JSON.stringify(rootManifest)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_ROOT_SCRIPT_DRIFT"),
  );

  for (const [targetPath, changedSource] of [
    [
      packageTestsPath,
      packageTests.replace(
        'it("resolves each unique token once',
        'it.skip("resolves each unique token once',
      ),
    ],
    [typeTestsPath, typeTests.replace("@ts-expect-error", "@type-error")],
    [
      rootTestsPath,
      rootTests.replace(
        'test("two independent token/format evidence builds',
        'false && test("two independent token/format evidence builds',
      ),
    ],
  ]) {
    await assert.rejects(
      buildRuntimeCoreTokenFormatResolutionEvidence({
        fileOverrides: { [targetPath]: changedSource },
        verifyPrerequisite: false,
      }),
      hasEvidenceCode("TOKEN_FORMAT_TEST_INVENTORY_DRIFT"),
    );
  }
});

test("rejects direct trace ownership and PF-033 boundary drift", async () => {
  const tracePath = "docs/proof/protocol-0.1.0-traceability.json";
  const findingPath = "docs/plan/PROTOCOL-FINDINGS.md";
  const trace = JSON.parse(await readFile(new URL(`../${tracePath}`, import.meta.url), "utf8"));
  trace.proseRules.find((rule) => rule.id === "R-048").owners = ["M03-T07"];
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      fileOverrides: { [tracePath]: `${JSON.stringify(trace)}\n` },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_TRACE_DRIFT"),
  );

  const findings = await readFile(new URL(`../${findingPath}`, import.meta.url), "utf8");
  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      fileOverrides: {
        [findingPath]: findings.replace(
          "all other resolved JSON values use RFC 8785 canonical JSON",
          "all values use implicit string coercion",
        ),
      },
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_FINDING_DRIFT"),
  );
});

test("rejects stale injected M04-T02 prerequisite bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
    import.meta.url,
  );
  const original = await readFile(artifactPath);
  const tampered = Buffer.concat([original, Buffer.from(" ")]);

  await assert.rejects(
    buildRuntimeCoreTokenFormatResolutionEvidence({
      prerequisiteArtifactBytes: tampered,
      verifyPrerequisite: false,
    }),
    hasEvidenceCode("TOKEN_FORMAT_PREREQUISITE_DRIFT"),
  );
});

test("atomic token/format writer rejects symlink destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-token-format-symlink-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const target = path.join(directory, "target.json");
  const link = path.join(directory, "artifact.json");
  await writeFile(target, "{}\n");
  await symlink(target, link);
  const evidence = await buildRuntimeCoreTokenFormatResolutionEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCoreTokenFormatResolutionEvidence({
      artifactPath: link,
      preparedEvidence: evidence,
      buildOptions: { verifyPrerequisite: false },
    }),
    /regular file/u,
  );
});

test("atomic token/format writer detects temporary-byte tampering before rename", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m04-token-format-tamper-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const artifactPath = path.join(directory, "artifact.json");
  const evidence = await buildRuntimeCoreTokenFormatResolutionEvidence({
    verifyPrerequisite: false,
  });

  await assert.rejects(
    writeRuntimeCoreTokenFormatResolutionEvidence({
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
