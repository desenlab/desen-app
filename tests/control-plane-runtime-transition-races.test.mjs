import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  CONTROL_PLANE_RUNTIME_TRANSITION_RACES_EXPECTED_SUITE_RECEIPT,
  CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS,
  ControlPlaneRuntimeTransitionRacesEvidenceError,
  buildControlPlaneRuntimeTransitionRacesEvidence,
  summarizeControlPlaneRuntimeTransitionRacesSuiteFailure,
  verifyControlPlaneRuntimeTransitionRacesEvidence,
  writeControlPlaneRuntimeTransitionRacesEvidence,
} from "../scripts/lib/control-plane-runtime-transition-races-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_SQLITE = "apps/control-plane-api/src/runtime-activation-sqlite-internal.ts";
const APP_TEST = "apps/control-plane-api/test/runtime-transition-races.test.ts";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json";
const RECEIPT_ONLY_TRACKED_FILES = Object.freeze([
  "scripts/generate-control-plane-runtime-transition-races-proof.mjs",
  "scripts/verify-control-plane-runtime-transition-races.mjs",
  "scripts/lib/control-plane-runtime-transition-races-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
]);

let built;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneRuntimeTransitionRacesEvidenceError && error.code === code;
}

function suiteReceipt() {
  return structuredClone(CONTROL_PLANE_RUNTIME_TRANSITION_RACES_EXPECTED_SUITE_RECEIPT);
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nArtifact: \`${ARTIFACT}\`\n\nFinal receipt: \`sha256:${artifactSha256}\`\n`;
}

function changedByte(bytes) {
  const copy = Uint8Array.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function findTraceRow(value, id) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findTraceRow(child, id);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  if (value.id === id) return value;
  for (const child of Object.values(value)) {
    const found = findTraceRow(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

function findUnassignedTraceRow(value) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findUnassignedTraceRow(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  if (
    typeof value.id === "string" &&
    Array.isArray(value.tests) &&
    !value.tests.includes("M07-T10") &&
    !value.owners?.includes?.("M07-T10")
  ) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findUnassignedTraceRow(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function removeFirstAfter(source, marker, needle) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1);
  const needleIndex = source.indexOf(needle, markerIndex + marker.length);
  assert.notEqual(needleIndex, -1);
  return `${source.slice(0, needleIndex)}${source.slice(needleIndex + needle.length)}`;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  // Byte outputs are detached copies and JavaScript cannot freeze typed-array elements.
  if (ArrayBuffer.isView(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

before(async () => {
  built = await buildControlPlaneRuntimeTransitionRacesEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact M07-T10 ordered-transition and two-way race artifact", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "control-plane-runtime-transition-races");
  assert.equal(built.artifact.profile, "desen.control-plane.runtime-transition-races-proof.v1");
  assert.equal(built.artifact.task, "M07-T10");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.prerequisites.length, 9);
  assert.deepEqual(
    built.artifact.prerequisites.map(({ task }) => task),
    [
      "M07-T01",
      "M07-T02",
      "M07-T03",
      "M07-T04",
      "M07-T05",
      "M07-T06",
      "M07-T07",
      "M07-T08",
      "M07-T09",
    ],
  );
  assert.equal(built.artifact.claims.transitionMatrix.closed, true);
  assert.equal(built.artifact.claims.transitionMatrix.duplicateFree, true);
  assert.equal(built.artifact.claims.transitionMatrix.caseCount, 15);
  assert.equal(built.artifact.claims.transitionMatrix.executableTestCount, 16);
  assert.equal(
    built.artifact.claims.orderedSequenceInvariant.invalidBNeverChangesDurableAuthority,
    true,
  );
  assert.equal(
    built.artifact.claims.orderedSequenceInvariant.validCBecomesActiveWithPreviousGoodA,
    true,
  );
  assert.equal(built.artifact.claims.concurrencyInvariant.sameCandidateHasOneDurableWinner, true);
  assert.equal(
    built.artifact.claims.concurrencyInvariant.differentCandidatesHaveOneDurableWinner,
    true,
  );
  assert.equal(
    built.artifact.claims.concurrencyInvariant.recoveryBeforeActivationCannotKeepStaleA,
    true,
  );
  assert.equal(
    built.artifact.claims.concurrencyInvariant.activationBeforeRecoveryCannotPublishStaleA,
    true,
  );
  assert.equal(
    built.artifact.claims.storageProfileDecision
      .completeProfileReauthenticatedInsideWriterTransactionBeforeDml,
    true,
  );
  assert.equal(
    built.artifact.claims.storageProfileDecision.profileDriftIsNeverSilentlyRepaired,
    true,
  );
  assert.equal(built.artifact.claims.publicBoundary.exports.count, 105);
  assert.equal(
    built.artifact.claims.publicBoundary.exports.sha256,
    "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43",
  );
  assert.equal(built.artifact.claims.publicBoundary.runtimeModuleKeys.length, 36);
  assert.equal(built.artifact.claims.publicBoundary.noRaceOrSqliteSurfaceAdded, true);
  assert.equal(built.artifact.claims.traceRows.length, 15);
  assert.equal(built.artifact.tests.packageRuntimeCases, 16);
  assert.equal(built.artifact.tests.compilerNegativeCases, 9);
  assert.equal(built.artifact.tests.rootMutationCases, 12);
  assert.equal(built.artifact.claims.coverageTruth.normativeN038, "TESTED");
  assert.equal(built.artifact.claims.coverageTruth.proofMatrixP12, "NOT_PROVEN");
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds are byte-identical", async () => {
  const second = await buildControlPlaneRuntimeTransitionRacesEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeSuiteReceipt, built.runtimeSuiteReceipt);
});

test("[prerequisites] rejects drift in every immutable M07-T01 through M07-T09 artifact", async () => {
  for (const prerequisite of CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS) {
    await assert.rejects(
      buildControlPlaneRuntimeTransitionRacesEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeSuiteReceipt: suiteReceipt(),
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[runtime] rejects case-inventory drift and a changed executable suite receipt", async () => {
  const changed = suiteReceipt();
  changed.tests[0].status = "failed";
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({ runtimeSuiteReceipt: changed }),
    expectedError("RUNTIME_SUITE_MISMATCH"),
  );

  const testSource = (await workspaceBytes(APP_TEST)).toString("utf8");
  assert.match(testSource, /"ordered-unsupported-protocol"/u);
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [APP_TEST]: Buffer.from(testSource.replace('  "ordered-unsupported-protocol",\n', "")),
      },
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );

  const secretPath = "/private/diagnostic-path-must-not-escape";
  const failure = summarizeControlPlaneRuntimeTransitionRacesSuiteFailure({
    code: 1,
    stderr: `Access to this API has been restricted. Use --allow-fs-read. ${secretPath}`,
    stdout: JSON.stringify({
      numFailedTestSuites: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            {
              status: "failed",
              title: suiteReceipt().tests[0].title,
              failureMessages: [secretPath],
            },
          ],
        },
      ],
    }),
  });
  assert.equal(failure.category, "ACCESS_DENIED");
  assert.equal(failure.deniedAuthority, "FS_READ");
  assert.deepEqual(failure.failedCaseIds, ["ordered-unsupported-protocol"]);
  assert.equal(JSON.stringify(failure).includes(secretPath), false);
});

test("[implementation] rejects profile-guard removal and public-export growth", async () => {
  const sqliteSource = (await workspaceBytes(APP_SQLITE)).toString("utf8");
  const withoutWriterGuard = removeFirstAfter(
    sqliteSource,
    'openDatabase.exec("BEGIN IMMEDIATE");',
    "      assertConnectionProfile(openDatabase);\n",
  );
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: { [APP_SQLITE]: Buffer.from(withoutWriterGuard) },
    }),
    expectedError("IMPLEMENTATION_DRIFT"),
  );

  const indexBytes = await workspaceBytes(APP_INDEX);
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [APP_INDEX]: Buffer.concat([
          indexBytes,
          Buffer.from(
            '\nexport { openRuntimeActivationSqliteRepository } from "./runtime-activation-sqlite-internal.js";\n',
          ),
        ]),
      },
    }),
    expectedError("PUBLIC_EXPORT_DRIFT"),
  );

  const packageManifest = JSON.parse((await workspaceBytes(APP_PACKAGE)).toString("utf8"));
  packageManifest.exports["./runtime-sqlite"] = {
    types: "./dist/runtime-activation-sqlite-internal.d.ts",
    import: "./dist/runtime-activation-sqlite-internal.js",
  };
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [APP_PACKAGE]: Buffer.from(`${JSON.stringify(packageManifest, null, 2)}\n`),
      },
    }),
    expectedError("PUBLIC_EXPORT_DRIFT"),
  );
});

test("[registration] binds every captured CI byte source to its executable authority", async () => {
  for (const relativePath of [CI_SOURCE, CI_INVENTORY, SHARED_STATE_AUTHORITY]) {
    await assert.rejects(
      buildControlPlaneRuntimeTransitionRacesEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [relativePath]: changedByte(await workspaceBytes(relativePath)) },
      }),
      expectedError("REGISTRATION_DRIFT"),
    );
  }
});

test("[traceability] rejects every missing M07-T10 assignment and one extra assignment", async () => {
  const original = JSON.parse((await workspaceBytes(TRACEABILITY)).toString("utf8"));
  for (const { id } of built.artifact.claims.traceRows) {
    const changed = structuredClone(original);
    const row = findTraceRow(changed, id);
    assert.notEqual(row, undefined);
    if (row.owners?.includes("M07-T10")) {
      row.owners = row.owners.filter((task) => task !== "M07-T10");
    } else {
      row.tests = row.tests.filter((task) => task !== "M07-T10");
    }
    await assert.rejects(
      buildControlPlaneRuntimeTransitionRacesEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(changed)) },
      }),
      expectedError("TRACE_DRIFT"),
    );
  }

  const extra = structuredClone(original);
  const extraRow = findUnassignedTraceRow(extra);
  assert.notEqual(extraRow, undefined);
  extraRow.tests.push("M07-T10");
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(extra)) },
    }),
    expectedError("TRACE_DRIFT"),
  );
});

test("[artifact] verifies exact bytes and rejects one changed byte", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyControlPlaneRuntimeTransitionRacesEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.transitionCases, 15);
  assert.equal(verified.packageRuntimeCases, 16);
  assert.equal(verified.compileTimeNegativeCases, 9);
  assert.equal(verified.rootMutationCases, 12);
  assert.equal(verified.prerequisiteArtifacts, 9);
  assert.equal(verified.traceRows, 15);
  await assert.rejects(
    verifyControlPlaneRuntimeTransitionRacesEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
});

test("[writer] atomically writes deterministic evidence and preserves the destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m07-t10-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeControlPlaneRuntimeTransitionRacesEvidence({
    artifactPath,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = Buffer.from("preserve-existing-destination\n");
  await writeFile(artifactPath, sentinel);
  await assert.rejects(
    writeControlPlaneRuntimeTransitionRacesEvidence({
      artifactPath,
      runtimeSuiteReceipt: suiteReceipt(),
      beforeAtomicRename: () => {
        throw new Error("controlled pre-rename failure");
      },
    }),
    expectedError("ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), sentinel);
});

test("[options] rejects unknown, accessor, proxy, cyclic, and shared-memory inputs", async () => {
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      unexpected: true,
    }),
    expectedError("INVALID_OPTIONS"),
  );
  const accessor = {};
  Object.defineProperty(accessor, "runtimeSuiteReceipt", {
    enumerable: true,
    get: () => suiteReceipt(),
  });
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence(accessor),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const cyclic = suiteReceipt();
  cyclic.tests[0].ancestorTitles.push(cyclic);
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({ runtimeSuiteReceipt: cyclic }),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  await assert.rejects(
    buildControlPlaneRuntimeTransitionRacesEvidence({
      prerequisiteBytes: {
        [CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS[0].path]: shared,
      },
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("INVALID_OPTIONS"),
  );
  for (const relativePath of RECEIPT_ONLY_TRACKED_FILES) {
    await assert.rejects(
      buildControlPlaneRuntimeTransitionRacesEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [relativePath]: Buffer.from("forged receipt-only authority\n") },
      }),
      expectedError("INVALID_OPTIONS"),
    );
  }
});

test("[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority", async () => {
  const directory = await temporaryDirectory("desen-m07-t10-authority-");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  const invalidProof = path.join(directory, "invalid-proof.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await writeFile(invalidProof, Uint8Array.of(0xff));
  await symlink(artifactTarget, artifactLink);
  await symlink(proofTarget, proofLink);

  await assert.rejects(
    verifyControlPlaneRuntimeTransitionRacesEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeTransitionRacesEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofLink,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeTransitionRacesEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: invalidProof,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("SOURCE_DRIFT"),
  );
});

test("[immutability] recursively freezes the graph and preserves later-scope nonclaims", () => {
  assertDeepFrozen(built);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("M07-T11")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("G07")));
  assert.equal(built.artifact.claims.coverageTruth.normativeN041, "PLANNED");
  assert.equal(built.artifact.claims.coverageTruth.gateG07, "NOT_STARTED");
});
