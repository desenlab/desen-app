import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  CONTROL_PLANE_RUNTIME_FAULT_INJECTION_EXPECTED_SUITE_RECEIPT,
  CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS,
  ControlPlaneRuntimeFaultInjectionEvidenceError,
  buildControlPlaneRuntimeFaultInjectionEvidence,
  summarizeControlPlaneRuntimeFaultInjectionSuiteFailure,
  verifyControlPlaneRuntimeFaultInjectionEvidence,
  writeControlPlaneRuntimeFaultInjectionEvidence,
} from "../scripts/lib/control-plane-runtime-fault-injection-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_TEST = "apps/control-plane-api/test/runtime-fault-injection.test.ts";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json";

let built;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneRuntimeFaultInjectionEvidenceError && error.code === code;
}

function suiteReceipt() {
  return structuredClone(CONTROL_PLANE_RUNTIME_FAULT_INJECTION_EXPECTED_SUITE_RECEIPT);
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
    !value.tests.includes("M07-T09") &&
    !value.owners?.includes?.("M07-T09")
  ) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findUnassignedTraceRow(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  // Uint8Array/Buffer evidence copies cannot be frozen by JavaScript; they are detached output
  // bytes rather than mutable members of the recursively frozen JSON authority graph.
  if (ArrayBuffer.isView(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

before(async () => {
  built = await buildControlPlaneRuntimeFaultInjectionEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact M07-T09 boundary-fault artifact from the executable suite", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "control-plane-runtime-fault-injection");
  assert.equal(built.artifact.profile, "desen.control-plane.runtime-fault-injection-proof.v1");
  assert.equal(built.artifact.task, "M07-T09");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.prerequisites.length, 8);
  assert.deepEqual(
    built.artifact.prerequisites.map(({ task }) => task),
    ["M07-T01", "M07-T02", "M07-T03", "M07-T04", "M07-T05", "M07-T06", "M07-T07", "M07-T08"],
  );
  assert.equal(built.artifact.claims.boundaryMatrix.closed, true);
  assert.equal(built.artifact.claims.boundaryMatrix.duplicateFree, true);
  assert.equal(built.artifact.claims.boundaryMatrix.caseCount, 19);
  assert.equal(built.artifact.claims.boundaryMatrix.executableTestCount, 20);
  assert.deepEqual(built.artifact.claims.boundaryMatrix.stages, [
    "channel-discovery",
    "immutable-fetch",
    "integrity",
    "package-resolution",
    "reference-preflight",
    "runtime-staging",
    "durable-commit",
    "restart-recovery",
  ]);
  assert.deepEqual(built.artifact.claims.failureInvariant, {
    rejectedPrecommitCandidateNeverActive: true,
    authenticatedBaselineRemainsCurrent: true,
    durableBaselineRemainsUnchanged: true,
    definiteCommitFailureRollsBack: true,
    indeterminateCommitPublishesNoAuthority: true,
    indeterminateCommitRequiresCompleteWinnerRecovery: true,
    failedTwoLineageRecoveryPublishesNeitherRole: true,
    finalDurableObservationWins: true,
  });
  assert.equal(built.artifact.claims.publicBoundary.exports.count, 105);
  assert.equal(
    built.artifact.claims.publicBoundary.exports.sha256,
    "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43",
  );
  assert.equal(built.artifact.claims.publicBoundary.runtimeModuleKeys.length, 36);
  assert.equal(built.artifact.claims.publicBoundary.noFaultHookExported, true);
  assert.equal(built.artifact.claims.traceRows.length, 22);
  assert.equal(built.artifact.tests.packageRuntimeCases, 20);
  assert.equal(built.artifact.tests.compilerNegativeCases, 10);
  assert.equal(built.artifact.tests.rootMutationCases, 11);
  assert.equal(built.artifact.claims.coverageTruth.normativeN004, "TESTED");
  assert.equal(built.artifact.claims.coverageTruth.proofMatrixP12, "NOT_PROVEN");
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds are byte-identical", async () => {
  const second = await buildControlPlaneRuntimeFaultInjectionEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeSuiteReceipt, built.runtimeSuiteReceipt);
});

test("[checkpoint] reconstructs only the centrally authenticated immutable M07-T09 artifact", async () => {
  const committedArtifact = await workspaceBytes(ARTIFACT);
  assert.equal(
    createHash("sha256").update(committedArtifact).digest("hex"),
    "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
  );
  assert.equal(
    built.artifactSha256,
    "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
  );
  assert.deepEqual(built.artifactBytes, committedArtifact);
});

test("[prerequisites] rejects drift in every immutable M07-T01 through M07-T08 artifact", async () => {
  for (const prerequisite of CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS) {
    await assert.rejects(
      buildControlPlaneRuntimeFaultInjectionEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeSuiteReceipt: suiteReceipt(),
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[runtime] rejects one changed executable fault-suite receipt field", async () => {
  const changed = suiteReceipt();
  changed.tests[0].status = "failed";
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({ runtimeSuiteReceipt: changed }),
    expectedError("RUNTIME_SUITE_MISMATCH"),
  );

  const secretPath = "/private/diagnostic-path-must-not-escape";
  const failedTitle = suiteReceipt().tests[0].title;
  const failure = summarizeControlPlaneRuntimeFaultInjectionSuiteFailure({
    code: 1,
    killed: false,
    signal: null,
    stderr: `Access to this API has been restricted. Use --allow-fs-read. ${secretPath}`,
    stdout: JSON.stringify({
      numFailedTestSuites: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            {
              failureMessages: [`ERR_ACCESS_DENIED ${secretPath}`],
              status: "failed",
              title: failedTitle,
            },
          ],
          message: `arbitrary reporter text ${secretPath}`,
          status: "failed",
        },
      ],
    }),
  });
  assert.equal(failure.category, "ACCESS_DENIED");
  assert.equal(failure.deniedAuthority, "FS_READ");
  assert.deepEqual(failure.failedCaseIds, ["channel-invalid-discovery"]);
  assert.equal(failure.failedSuiteCount, 1);
  assert.equal(failure.failedTestCount, 1);
  assert.equal(failure.reportObserved, true);
  assert.equal(JSON.stringify(failure).includes(secretPath), false);

  const unknown = summarizeControlPlaneRuntimeFaultInjectionSuiteFailure({
    code: 1,
    signal: secretPath,
    stdout: secretPath,
  });
  assert.equal(unknown.category, "CHILD_PROCESS_FAILED");
  assert.deepEqual(unknown.failedCaseIds, []);
  assert.equal(unknown.reportObserved, false);
  assert.equal(unknown.signal, null);
  assert.equal(JSON.stringify(unknown).includes(secretPath), false);

  const knownSignal = summarizeControlPlaneRuntimeFaultInjectionSuiteFailure({
    code: 1,
    signal: "SIGTERM",
  });
  assert.equal(knownSignal.signal, "SIGTERM");

  const missingBuildOutput = summarizeControlPlaneRuntimeFaultInjectionSuiteFailure({
    code: 1,
    stdout: JSON.stringify({
      numFailedTestSuites: 1,
      numFailedTests: 0,
      testResults: [
        {
          assertionResults: [],
          message: 'Failed to resolve entry for package "@desen/protocol".',
          status: "failed",
        },
      ],
    }),
  });
  assert.equal(missingBuildOutput.category, "MODULE_RESOLUTION_FAILED");
  assert.equal(missingBuildOutput.failedSuiteCount, 1);
  assert.equal(missingBuildOutput.failedTestCount, 0);
  assert.equal(missingBuildOutput.reportObserved, true);
});

test("[implementation] rejects public-export growth and removal of one fault boundary", async () => {
  const indexBytes = await workspaceBytes(APP_INDEX);
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [APP_INDEX]: Buffer.concat([
          indexBytes,
          Buffer.from(
            '\nexport { createBundleRuntimeActivationInternal } from "./runtime-activation-internal.js";\n',
          ),
        ]),
      },
    }),
    expectedError("PUBLIC_EXPORT_DRIFT"),
  );

  const testSource = (await workspaceBytes(APP_TEST)).toString("utf8");
  assert.match(testSource, /"channel-invalid-discovery"/u);
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [APP_TEST]: Buffer.from(testSource.replace('  "channel-invalid-discovery",\n', "")),
      },
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[traceability] rejects every M07-T09 assignment mutation and one extra assignment", async () => {
  const original = JSON.parse((await workspaceBytes(TRACEABILITY)).toString("utf8"));
  for (const { id } of built.artifact.claims.traceRows) {
    const changed = structuredClone(original);
    const row = findTraceRow(changed, id);
    assert.notEqual(row, undefined);
    if (row.owners?.includes("M07-T09")) {
      row.owners = row.owners.filter((task) => task !== "M07-T09");
    } else {
      row.tests = row.tests.filter((task) => task !== "M07-T09");
    }
    await assert.rejects(
      buildControlPlaneRuntimeFaultInjectionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(changed)) },
      }),
      expectedError("TRACE_DRIFT"),
    );
  }

  const extra = structuredClone(original);
  const extraRow = findUnassignedTraceRow(extra);
  assert.notEqual(extraRow, undefined);
  extraRow.tests.push("M07-T09");
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(extra)) },
    }),
    expectedError("TRACE_DRIFT"),
  );
});

test("[artifact] verifies exact bytes and rejects one changed byte", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyControlPlaneRuntimeFaultInjectionEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.faultCases, 19);
  assert.equal(verified.packageRuntimeCases, 20);
  assert.equal(verified.compileTimeNegativeCases, 10);
  assert.equal(verified.rootMutationCases, 11);
  assert.equal(verified.prerequisiteArtifacts, 8);
  assert.equal(verified.traceRows, 22);
  await assert.rejects(
    verifyControlPlaneRuntimeFaultInjectionEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
});

test("[writer] atomically writes deterministic evidence and preserves the destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m07-t09-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeControlPlaneRuntimeFaultInjectionEvidence({
    artifactPath,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = Buffer.from("preserve-existing-destination\n");
  await writeFile(artifactPath, sentinel);
  await assert.rejects(
    writeControlPlaneRuntimeFaultInjectionEvidence({
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

test("[options] rejects unknown, accessor, proxy, and shared-memory inputs", async () => {
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({
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
    buildControlPlaneRuntimeFaultInjectionEvidence(accessor),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  await assert.rejects(
    buildControlPlaneRuntimeFaultInjectionEvidence({
      prerequisiteBytes: {
        [CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS[0].path]: shared,
      },
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("INVALID_OPTIONS"),
  );
});

test("[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority", async () => {
  const directory = await temporaryDirectory("desen-m07-t09-authority-");
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
    verifyControlPlaneRuntimeFaultInjectionEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeFaultInjectionEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofLink,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeFaultInjectionEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: invalidProof,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("SOURCE_DRIFT"),
  );
});

test("[immutability] freezes the full graph and preserves M07-T10, M07-T11, and G07 nonclaims", () => {
  assertDeepFrozen(built);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("M07-T10")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("M07-T11")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("G07")));
  assert.equal(built.artifact.claims.coverageTruth.normativeN038, "PLANNED");
  assert.equal(built.artifact.claims.coverageTruth.normativeN041, "PLANNED");
  assert.equal(built.artifact.claims.coverageTruth.gateG07, "NOT_STARTED");
});
