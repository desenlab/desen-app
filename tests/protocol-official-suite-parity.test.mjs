import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ProtocolOfficialSuiteParityEvidenceError,
  buildProtocolOfficialSuiteParityEvidence,
  verifyProtocolOfficialSuiteParity,
  writeProtocolOfficialSuiteParityEvidence,
} from "../scripts/lib/protocol-official-suite-parity-proof.mjs";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolOfficialSuiteParityEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts exact deterministic M02-T12 official-suite parity evidence", async () => {
  const result = await verifyProtocolOfficialSuiteParity();

  assert.equal(result.result, "PASS");
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.cases, 14);
  assert.equal(result.conformanceVectors, 9);
  assert.equal(result.publicExamples, 5);
  assert.equal(result.valid, 8);
  assert.equal(result.invalid, 6);
  assert.equal(result.source, 8);
  assert.equal(result.bundle, 4);
  assert.equal(result.catalog, 2);
  assert.equal(result.semanticByteEqual, true);
  assert.equal(result.transcriptByteEqual, true);
  assert.equal(result.supplements, 2);
  assert.equal(
    result.artifactSha256,
    "efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae",
  );
});

test("default evidence writer preserves immutable task-time M02-T12 bytes", async () => {
  const artifactPath = new URL(
    "../docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json",
    import.meta.url,
  );
  const before = await readFile(artifactPath);
  const result = await writeProtocolOfficialSuiteParityEvidence();
  const after = await readFile(artifactPath);

  assert.deepEqual(after, before);
  assert.deepEqual(result.artifactBytes, before);
});

test("two independent parity builds are byte-identical", async () => {
  const first = await buildProtocolOfficialSuiteParityEvidence();
  const second = await buildProtocolOfficialSuiteParityEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects a current rebuild and one-byte-tampered historical parity artifact", async () => {
  const current = await buildProtocolOfficialSuiteParityEvidence();
  await assert.rejects(
    verifyProtocolOfficialSuiteParity({ artifactBytes: current.artifactBytes }),
    hasEvidenceCode("OFFICIAL_SUITE_ARTIFACT_DRIFT"),
  );

  const historical = await readFile(
    new URL("../docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json", import.meta.url),
  );
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolOfficialSuiteParity({ artifactBytes: tampered }),
    hasEvidenceCode("OFFICIAL_SUITE_ARTIFACT_DRIFT"),
  );
});

test("rejects frozen Python validation and checksum baseline drift", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-official-baseline-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const validation = await readFile(
    new URL("../docs/proof/baselines/protocol-0.1.0-validation.txt", import.meta.url),
    "utf8",
  );
  const validationBaselinePath = path.join(directory, "validation.txt");
  await writeFile(validationBaselinePath, validation.replace("14 cases", "15 cases"));
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({ validationBaselinePath, verifySnapshot: false }),
    hasEvidenceCode("OFFICIAL_SUITE_BASELINE_DRIFT"),
  );

  const checksums = await readFile(
    new URL("../docs/proof/baselines/protocol-0.1.0-checksums.txt", import.meta.url),
    "utf8",
  );
  const checksumBaselinePath = path.join(directory, "checksums.txt");
  await writeFile(
    checksumBaselinePath,
    checksums.replace("tools/validate.py: OK", "tools/validate.py: FAIL"),
  );
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({ checksumBaselinePath, verifySnapshot: false }),
    hasEvidenceCode("OFFICIAL_SUITE_CHECKSUM_BASELINE_DRIFT"),
  );
});

test("rejects official manifest removal, reorder, duplication, and expected-code drift", async (context) => {
  const source = new URL("../packages/protocol/upstream/0.1.0/snapshot/", import.meta.url);
  const mutations = [
    ["removal", (manifest) => manifest.vectors.pop()],
    ["reorder", (manifest) => manifest.vectors.reverse()],
    ["duplication", (manifest) => manifest.vectors.push(manifest.vectors[0])],
    [
      "expected-code",
      (manifest) => {
        manifest.vectors.find(({ code }) => code === "UNKNOWN_EVENT").code = "UNKNOWN_COMMAND";
      },
    ],
  ];

  for (const [id, mutate] of mutations) {
    const suiteRoot = await mkdtemp(path.join(os.tmpdir(), `desen-official-${id}-`));
    context.after(() => rm(suiteRoot, { force: true, recursive: true }));
    await cp(source, suiteRoot, { recursive: true });
    const manifestPath = path.join(suiteRoot, "conformance/vectors.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    mutate(manifest);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      buildProtocolOfficialSuiteParityEvidence({ suiteRoot, verifySnapshot: false }),
      hasEvidenceCode("OFFICIAL_SUITE_MANIFEST_DRIFT"),
      id,
    );
  }
});

test("rejects one-field-tampered M02-T04 and M02-T11 prerequisite artifacts", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-official-prerequisite-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const canonicalization = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-canonicalization.json", import.meta.url),
      "utf8",
    ),
  );
  canonicalization.profile = "weakened-canonicalization";
  const canonicalizationArtifactPath = path.join(directory, "canonicalization.json");
  await writeFile(canonicalizationArtifactPath, `${JSON.stringify(canonicalization)}\n`);
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({
      canonicalizationArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("OFFICIAL_SUITE_PREREQUISITE_DRIFT"),
  );

  const execution = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/protocol-0.1.0-execution-contracts.json", import.meta.url),
      "utf8",
    ),
  );
  execution.result = "FAIL";
  const executionContractsArtifactPath = path.join(directory, "execution-contracts.json");
  await writeFile(executionContractsArtifactPath, `${JSON.stringify(execution)}\n`);
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({
      executionContractsArtifactPath,
      verifySnapshot: false,
    }),
    hasEvidenceCode("OFFICIAL_SUITE_PREREQUISITE_DRIFT"),
  );
});

test("rejects APIs that change outcomes or diagnostic code/classification pairs", async () => {
  const api = await import("../packages/validator/dist/index.js");
  const rejectValid = {
    ...api,
    validateDesenSourceExecutionContracts(input, catalogSet) {
      const result = api.validateDesenSourceExecutionContracts(input, catalogSet);
      if (result.valid) {
        return Object.freeze({
          valid: false,
          target: "source",
          diagnostics: Object.freeze([Object.freeze({ code: "INJECTED_REJECTION" })]),
          obligations: Object.freeze([]),
        });
      }
      return result;
    },
  };
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({ validatorApi: rejectValid, verifySnapshot: false }),
    hasEvidenceCode("OFFICIAL_SUITE_OUTCOME_MISMATCH"),
  );

  const admitInvalid = {
    ...api,
    validateDesenSourceExecutionContracts(input, catalogSet) {
      const result = api.validateDesenSourceExecutionContracts(input, catalogSet);
      if (result.diagnostics?.some(({ code }) => code === "UNKNOWN_CORE_FIELD")) {
        return Object.freeze({
          valid: true,
          target: "source",
          value: Object.freeze({}),
          diagnostics: Object.freeze([]),
          obligations: Object.freeze([]),
        });
      }
      return result;
    },
  };
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({ validatorApi: admitInvalid, verifySnapshot: false }),
    hasEvidenceCode("OFFICIAL_SUITE_OUTCOME_MISMATCH"),
  );

  for (const [id, mutate] of [
    [
      "wrong-classification",
      (diagnostic) => Object.freeze({ ...diagnostic, classification: "semantic" }),
    ],
    [
      "missing-classification",
      (diagnostic) => {
        const changed = { ...diagnostic };
        delete changed.classification;
        return Object.freeze(changed);
      },
    ],
  ]) {
    const changedClassification = {
      ...api,
      validateDesenSourceExecutionContracts(input, catalogSet) {
        const result = api.validateDesenSourceExecutionContracts(input, catalogSet);
        if (!result.diagnostics?.some(({ code }) => code === "UNKNOWN_CORE_FIELD")) return result;
        return Object.freeze({
          ...result,
          diagnostics: Object.freeze(
            result.diagnostics.map((diagnostic) =>
              diagnostic.code === "UNKNOWN_CORE_FIELD" ? mutate(diagnostic) : diagnostic,
            ),
          ),
        });
      },
    };
    await assert.rejects(
      buildProtocolOfficialSuiteParityEvidence({
        validatorApi: changedClassification,
        verifySnapshot: false,
      }),
      hasEvidenceCode("OFFICIAL_SUITE_OUTCOME_MISMATCH"),
      id,
    );
  }
});

test("rejects weakened revision and catalog-digest supplements", async () => {
  const [protocolApi, validatorApi] = await Promise.all([
    import("../packages/protocol/dist/index.js"),
    import("../packages/validator/dist/index.js"),
  ]);
  const weakenedRevision = {
    ...protocolApi,
    calculateDesenBundleRevision(bundle) {
      return bundle.revision;
    },
  };
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({
      protocolApi: weakenedRevision,
      validatorApi,
      verifySnapshot: false,
    }),
    hasEvidenceCode("OFFICIAL_SUITE_OUTCOME_MISMATCH"),
  );

  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({
      protocolApi,
      validatorApi,
      catalogDigestMatches: () => true,
      verifySnapshot: false,
    }),
    hasEvidenceCode("OFFICIAL_SUITE_OUTCOME_MISMATCH"),
  );
});

test("rejects mutation of the transcript rendered from observed cases", async () => {
  await assert.rejects(
    buildProtocolOfficialSuiteParityEvidence({
      observedTranscriptTransform(observed, cases) {
        assert.equal(cases.length, 14);
        const lines = observed.toString("utf8").split("\n");
        [lines[0], lines[1]] = [lines[1], lines[0]];
        return Buffer.from(lines.join("\n"));
      },
      verifySnapshot: false,
    }),
    hasEvidenceCode("OFFICIAL_SUITE_TRANSCRIPT_PARITY_MISMATCH"),
  );
});

test("records exact composition, routing, categories, responsibilities, and non-claims", async () => {
  const { artifact } = await buildProtocolOfficialSuiteParityEvidence();

  assert.deepEqual(artifact.suite.composition, {
    cases: 14,
    conformanceVectors: 9,
    publicExamples: 5,
    valid: 8,
    invalid: 6,
  });
  assert.deepEqual(artifact.suite.targets, { source: 8, bundle: 4, catalog: 2 });
  assert.deepEqual(artifact.suite.negativeCategories, {
    schema_error: 1,
    semantic_error: 1,
    catalog_error: 2,
    integrity_error: 1,
    activation_error: 1,
  });
  assert.deepEqual(artifact.traceability.ownership, {
    schemaFamilies: 0,
    invariants: 0,
    diagnostics: 0,
  });
  assert.deepEqual(artifact.traceability.tests, {
    proseRules: ["R-001", "R-032", "R-035", "R-082", "R-142"],
    conformanceRules: ["C-016", "C-024"],
    schemaNonConstraintDecisions: ["SN-003"],
    schemaRegistry: ["SR-001", "SR-002", "SR-003"],
  });
  assert.deepEqual(
    artifact.suite.cases.filter(({ outcome }) => outcome === "invalid").map(({ code }) => code),
    [
      "UNKNOWN_CORE_FIELD",
      "DUPLICATE_NODE_ID",
      "UNKNOWN_CAPABILITY",
      "UNKNOWN_EVENT",
      "REVISION_MISMATCH",
      "CATALOG_DIGEST_MISMATCH",
    ],
  );
  assert.deepEqual(
    artifact.suite.cases
      .filter(({ outcome }) => outcome === "invalid")
      .map(({ diagnostics }) => diagnostics),
    [
      [
        {
          code: "UNKNOWN_CORE_FIELD",
          classification: "schema",
          category: "schema_error",
          pointer: "/script",
        },
      ],
      [
        {
          code: "DUPLICATE_NODE_ID",
          classification: "semantic",
          category: "semantic_error",
          pointer: "/surfaces/home/root/slots/default/1/id",
        },
      ],
      [
        {
          code: "UNKNOWN_CAPABILITY",
          classification: "catalog",
          category: "catalog_error",
          pointer: "/surfaces/home/root/slots/default/0/use",
        },
      ],
      [
        {
          code: "UNKNOWN_EVENT",
          classification: "catalog",
          category: "catalog_error",
          pointer: "/surfaces/home/root/slots/default/0/on/teleport",
        },
      ],
      [
        {
          code: "REVISION_MISMATCH",
          classification: null,
          category: "integrity_error",
          pointer: "/revision",
        },
      ],
      [
        {
          code: "CATALOG_DIGEST_MISMATCH",
          classification: null,
          category: "activation_error",
          pointer: "/requires/catalogs/0/digest",
        },
      ],
    ],
  );
  assert.ok(
    artifact.implementation.trackedFiles.some(
      ({ path: trackedPath }) => trackedPath === "docs/proof/PROTOCOL-OFFICIAL-SUITE-PARITY.md",
    ),
  );
  assert.ok(artifact.limitations.some((entry) => entry.includes("M02-T13")));
  assert.ok(artifact.limitations.some((entry) => entry.includes("complete P-02 result")));
});

test("writes atomically and rejects unsafe artifact destinations", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-official-writer-"));
  context.after(() => rm(directory, { force: true, recursive: true }));

  const artifactPath = path.join(directory, "parity.json");
  const written = await writeProtocolOfficialSuiteParityEvidence({ artifactPath });
  assert.deepEqual(await readFile(artifactPath), written.artifactBytes);

  const target = path.join(directory, "outside.json");
  const symlinkPath = path.join(directory, "symlink.json");
  await symlink(target, symlinkPath);
  await assert.rejects(
    writeProtocolOfficialSuiteParityEvidence({ artifactPath: symlinkPath }),
    hasEvidenceCode("OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const directoryPath = path.join(directory, "directory.json");
  await mkdir(directoryPath);
  await assert.rejects(
    writeProtocolOfficialSuiteParityEvidence({ artifactPath: directoryPath }),
    hasEvidenceCode("OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const racePath = path.join(directory, "race.json");
  await assert.rejects(
    writeProtocolOfficialSuiteParityEvidence({
      artifactPath: racePath,
      beforeAtomicRename: async () => symlink(target, racePath),
    }),
    hasEvidenceCode("OFFICIAL_SUITE_ARTIFACT_UNSUPPORTED_ENTRY"),
  );

  const cleanupPath = path.join(directory, "cleanup.json");
  await assert.rejects(
    writeProtocolOfficialSuiteParityEvidence({
      artifactPath: cleanupPath,
      beforeAtomicRename() {
        throw new Error("injected writer failure");
      },
    }),
    /injected writer failure/u,
  );
  assert.deepEqual(
    (await readdir(directory)).filter((entry) => entry.includes(".tmp")),
    [],
  );
});
