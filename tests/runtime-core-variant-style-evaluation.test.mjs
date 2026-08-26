import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ARTIFACT_PATH,
  RuntimeCoreVariantStyleEvaluationEvidenceError,
  buildRuntimeCoreVariantStyleEvaluationEvidence,
  verifyRuntimeCoreVariantStyleEvaluationEvidence,
  writeRuntimeCoreVariantStyleEvaluationEvidence,
} from "../scripts/lib/runtime-core-variant-style-evaluation-proof.mjs";

const runtimeApi = await import("../packages/runtime-core/dist/index.js");
const sourcePath = path.resolve(
  import.meta.dirname,
  "../packages/runtime-core/src/variant-style-evaluation.ts",
);
const packageTestPath = path.resolve(
  import.meta.dirname,
  "../packages/runtime-core/test/variant-style-evaluation.test.ts",
);
const tokenArtifactPath = path.resolve(
  import.meta.dirname,
  "../docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
);
const predicateArtifactPath = path.resolve(
  import.meta.dirname,
  "../docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json",
);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreVariantStyleEvaluationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts tracked deterministic M04-T05 variant/style evidence", async () => {
  const result = await verifyRuntimeCoreVariantStyleEvaluationEvidence();

  assert.equal(result.result, "PASS");
  assert.equal(result.runtimeExports, 1);
  assert.equal(result.typeExports, 9);
  assert.equal(result.tsdocDeclarations, 10);
  assert.equal(result.packageTests, 30);
  assert.equal(result.compilerNegativeCases, 25);
  assert.equal(result.rootMutationTests, 14);
  assert.equal(result.traceRules, 2);
  assert.equal(result.trackedFiles, 11);
  assert.equal(result.orderProbes, 2);
  assert.equal(result.mergeProbes, 8);
  assert.equal(result.tokenSessionProbes, 3);
  assert.equal(result.positionPairingProbes, 2);
  assert.equal(result.missingOperandProbes, 2);
  assert.equal(result.providerFailureProbes, 1);
  assert.equal(result.structuralRejectionProbes, 2);
  assert.equal(result.hostileInputProbes, 1);
  assert.equal(result.diagnosticProbes, 2);
  assert.equal(result.matchingVariantProbes, 3);
  assert.equal(result.rawValueSpecValidationProbes, 1);
  assert.equal(result.numericPropNameProbes, 1);
  assert.equal(result.canonicalSerializationProbes, 2);
  assert.equal(result.predicatePrevalidationProbes, 1);
  assert.equal(result.nestedFormatPrecedenceProbes, 1);
  assert.equal(result.platformEffects, 0);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("two independent variant/style evidence builds are byte-identical", async () => {
  const first = await buildRuntimeCoreVariantStyleEvaluationEvidence({
    verifyPrerequisites: false,
  });
  const second = await buildRuntimeCoreVariantStyleEvaluationEvidence({
    verifyPrerequisites: false,
  });

  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects stale or one-byte-tampered variant/style evidence", async () => {
  const pristine = await buildRuntimeCoreVariantStyleEvaluationEvidence({
    verifyPrerequisites: false,
  });
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyRuntimeCoreVariantStyleEvaluationEvidence({
      artifactBytes: tampered,
      buildOptions: { verifyPrerequisites: false },
    }),
    hasEvidenceCode("VARIANT_STYLE_ARTIFACT_DRIFT"),
  );
});

test("rejects base-first, document-order, whole-prop, and style-leaf semantic drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimeVariantOverrides(input, snapshot, context) {
      const result = runtimeApi.evaluateRuntimeVariantOverrides(input, snapshot, context);
      if (result.status === "evaluated" && result.effectiveProps.label === "Second") {
        return {
          ...result,
          effectiveProps: { ...result.effectiveProps, label: "first-wins" },
        };
      }
      return result;
    },
  };

  await assert.rejects(
    buildRuntimeCoreVariantStyleEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisites: false,
    }),
    hasEvidenceCode("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects token-session, operand-position, missing, and provider-failure semantic drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimeVariantOverrides(input, snapshot, context) {
      const result = runtimeApi.evaluateRuntimeVariantOverrides(input, snapshot, context);
      if (
        result.status === "evaluated" &&
        result.effectiveProps.left === true &&
        result.effectiveProps.right === true
      ) {
        return {
          ...result,
          matchingVariantIndices: [1, 0],
        };
      }
      return result;
    },
  };

  await assert.rejects(
    buildRuntimeCoreVariantStyleEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisites: false,
    }),
    hasEvidenceCode("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects structural widening, mutable output, and fail-closed boundary drift", async () => {
  const changedApi = {
    ...runtimeApi,
    evaluateRuntimeVariantOverrides(input, snapshot, context) {
      if (Object.hasOwn(input, "slots")) {
        return {
          status: "evaluated",
          effectiveProps: {},
          effectiveStyle: {},
          sources: { props: {}, style: {} },
          matchingVariantIndices: [],
          diagnostics: [],
        };
      }
      return runtimeApi.evaluateRuntimeVariantOverrides(input, snapshot, context);
    },
  };

  await assert.rejects(
    buildRuntimeCoreVariantStyleEvaluationEvidence({
      runtimeApi: changedApi,
      verifyPrerequisites: false,
    }),
    hasEvidenceCode("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT"),
  );
});

test("rejects source ordering, shared-session, and leaf-merge implementation drift", async () => {
  const source = await readFile(sourcePath, "utf8");
  for (const changedSource of [
    source.replace(
      "const session = createTokenSession(capturedContext);",
      "const session = createTokenSession(capturedContext as never);",
    ),
    source.replace(
      "materializeRuntimeValue(operand.spec, snapshot, session.context)",
      "materializeRuntimeValue(operand.spec, snapshot, context)",
    ),
    source.replace(
      "for (let index = 0; index < preparation.prepared.variants.length; index += 1)",
      "for (let index = preparation.prepared.variants.length - 1; index >= 0; index -= 1)",
    ),
    source.replace(
      "return validateValueSpecShape(value, pointer) ?? validateFormatProfiles(value, pointer);",
      "return validateFormatProfiles(value, pointer) ?? validateValueSpecShape(value, pointer);",
    ),
  ]) {
    await assert.rejects(
      buildRuntimeCoreVariantStyleEvaluationEvidence({
        fileOverrides: {
          "packages/runtime-core/src/variant-style-evaluation.ts": changedSource,
        },
        verifyPrerequisites: false,
      }),
      hasEvidenceCode("VARIANT_STYLE_SOURCE_ORDER_DRIFT"),
    );
  }
});

test("rejects public export, TSDoc, platform, and distribution drift", async () => {
  const source = await readFile(sourcePath, "utf8");
  const mutations = [
    {
      path: "packages/runtime-core/src/variant-style-evaluation.ts",
      value: `${source}\n/** Drift. */\nexport function leakedVariantApi() {}\n`,
      code: "VARIANT_STYLE_SOURCE_EXPORT_DRIFT",
    },
    {
      path: "packages/runtime-core/src/variant-style-evaluation.ts",
      value: source.replace(
        "/** String-keyed component property ValueSpecs before consumer-schema validation. */",
        "",
      ),
      code: "VARIANT_STYLE_TSDOC_MISSING",
    },
    {
      path: "packages/runtime-core/src/variant-style-evaluation.ts",
      value: `${source}\nconst platformLeak = window;\nvoid platformLeak;\n`,
      code: "VARIANT_STYLE_PLATFORM_BOUNDARY_DRIFT",
    },
    {
      path: "packages/runtime-core/dist/variant-style-evaluation.js",
      value: "export function wrongBuiltVariantApi() {}\n",
      code: "VARIANT_STYLE_DISTRIBUTION_DRIFT",
    },
  ];
  for (const mutation of mutations) {
    await assert.rejects(
      buildRuntimeCoreVariantStyleEvaluationEvidence({
        fileOverrides: { [mutation.path]: mutation.value },
        verifyPrerequisites: false,
      }),
      hasEvidenceCode(mutation.code),
    );
  }
});

test("rejects package, root wiring, skipped tests, and conditional test registration drift", async () => {
  const packageTests = await readFile(packageTestPath, "utf8");
  const rootTests = await readFile(new URL(import.meta.url), "utf8");
  const packageManifest = JSON.parse(
    await readFile(
      path.resolve(import.meta.dirname, "../packages/runtime-core/package.json"),
      "utf8",
    ),
  );
  packageManifest.scripts["test:variant-style-evaluation"] =
    "vitest run test/predicate-evaluation.test.ts";
  const rootManifest = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
  );
  rootManifest.scripts["verify:runtime-core-variant-style-evaluation"] =
    "node scripts/verify-runtime-core-variant-style-evaluation.mjs";

  for (const fileOverrides of [
    { "packages/runtime-core/package.json": JSON.stringify(packageManifest) },
    { "package.json": JSON.stringify(rootManifest) },
    {
      "packages/runtime-core/test/variant-style-evaluation.test.ts": packageTests.replace(
        'it("applies base values first',
        'it.skip("applies base values first',
      ),
    },
    {
      "tests/runtime-core-variant-style-evaluation.test.mjs": rootTests.replace(
        'test("accepts tracked deterministic',
        'test.skip("accepts tracked deterministic',
      ),
    },
  ]) {
    await assert.rejects(
      buildRuntimeCoreVariantStyleEvaluationEvidence({
        fileOverrides,
        verifyPrerequisites: false,
      }),
      (error) =>
        error instanceof RuntimeCoreVariantStyleEvaluationEvidenceError &&
        [
          "VARIANT_STYLE_PACKAGE_CONTRACT_DRIFT",
          "VARIANT_STYLE_ROOT_SCRIPT_DRIFT",
          "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
        ].includes(error.code),
    );
  }
});

test("rejects trace, PF-035, N-014, and proof-document boundary drift", async () => {
  const mutations = [
    {
      path: "docs/proof/protocol-0.1.0-traceability.json",
      mutate: (text) => text.replace('"M04-T04", "M04-T05", "M04-T07"', '"M04-T04", "M04-T07"'),
      code: "VARIANT_STYLE_TRACE_DRIFT",
    },
    {
      path: "docs/plan/PROTOCOL-FINDINGS.md",
      mutate: (text) => text.replace("one turn-scoped token session", "one changing token session"),
      code: "VARIANT_STYLE_FINDING_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) => text.replace(/^(\| N-014 \|.*?\| )TESTED(\s+\|)/mu, "$1PLANNED$2"),
      code: "VARIANT_STYLE_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) => text.replace(/^(\| N-014 \|.*?M06-T06–M06-T07), M08-T03(\s+\|)/mu, "$1$2"),
      code: "VARIANT_STYLE_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) =>
        text.replace(
          "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
          "docs/proof/artifacts/editor-core-0.1.0-structural-edits-drift.json",
        ),
      code: "VARIANT_STYLE_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) =>
        text.replace(
          "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
          "0".repeat(64),
        ),
      code: "VARIANT_STYLE_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/NORMATIVE-COVERAGE.md",
      mutate: (text) => text.replace(/^(\| N-014 \|.*)$/mu, "$1\n$1"),
      code: "VARIANT_STYLE_NORMATIVE_DRIFT",
    },
    {
      path: "docs/proof/RUNTIME-CORE-VARIANT-STYLE-EVALUATION.md",
      mutate: (text) => text.replace("evaluateRuntimeVariantOverrides", "evaluateUnknownVariants"),
      code: "VARIANT_STYLE_DOCUMENTATION_DRIFT",
    },
  ];
  for (const mutation of mutations) {
    const original = await readFile(path.resolve(import.meta.dirname, "..", mutation.path), "utf8");
    const mutated = mutation.mutate(original);
    assert.notEqual(mutated, original);
    await assert.rejects(
      buildRuntimeCoreVariantStyleEvaluationEvidence({
        fileOverrides: { [mutation.path]: mutated },
        verifyPrerequisites: false,
      }),
      hasEvidenceCode(mutation.code),
    );
  }
});

test("rejects stale injected M04-T03 prerequisite bytes", async () => {
  const bytes = await readFile(tokenArtifactPath);
  const tampered = Buffer.from(bytes);
  tampered[0] ^= 1;
  await assert.rejects(
    buildRuntimeCoreVariantStyleEvaluationEvidence({
      tokenFormatPrerequisiteArtifactBytes: tampered,
      verifyPrerequisites: false,
    }),
    hasEvidenceCode("VARIANT_STYLE_PREREQUISITE_DRIFT"),
  );
});

test("rejects stale injected M04-T04 prerequisite bytes", async () => {
  const bytes = await readFile(predicateArtifactPath);
  const tampered = Buffer.from(bytes);
  tampered[0] ^= 1;
  await assert.rejects(
    buildRuntimeCoreVariantStyleEvaluationEvidence({
      predicatePrerequisiteArtifactBytes: tampered,
      verifyPrerequisites: false,
    }),
    hasEvidenceCode("VARIANT_STYLE_PREREQUISITE_DRIFT"),
  );
});

test("atomic variant/style writer rejects symlink destinations", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-variant-proof-symlink-"));
  try {
    const target = path.join(directory, "target.json");
    const destination = path.join(directory, "artifact.json");
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    const evidence = await buildRuntimeCoreVariantStyleEvaluationEvidence({
      verifyPrerequisites: false,
    });

    await assert.rejects(
      writeRuntimeCoreVariantStyleEvaluationEvidence({
        artifactPath: destination,
        preparedEvidence: evidence,
        buildOptions: { verifyPrerequisites: false },
      }),
      /regular file/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic variant/style writer detects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-variant-proof-tamper-"));
  try {
    const destination = path.join(directory, "artifact.json");
    const evidence = await buildRuntimeCoreVariantStyleEvaluationEvidence({
      verifyPrerequisites: false,
    });

    await assert.rejects(
      writeRuntimeCoreVariantStyleEvaluationEvidence({
        artifactPath: destination,
        preparedEvidence: evidence,
        buildOptions: { verifyPrerequisites: false },
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      /temporary bytes changed/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

assert.equal(
  path.basename(DEFAULT_RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ARTIFACT_PATH),
  "runtime-core-0.1.0-variant-style-evaluation.json",
);
