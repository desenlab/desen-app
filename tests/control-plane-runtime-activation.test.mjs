import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS,
  ControlPlaneRuntimeActivationEvidenceError,
  buildControlPlaneRuntimeActivationEvidence,
  verifyControlPlaneRuntimeActivationEvidence,
  writeControlPlaneRuntimeActivationEvidence,
} from "../scripts/lib/control-plane-runtime-activation-proof.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const NORMATIVE_COVERAGE = "docs/proof/NORMATIVE-COVERAGE.md";
const PROOF_MATRIX = "docs/proof/PROOF-MATRIX.md";
const FINDINGS = "docs/plan/PROTOCOL-FINDINGS.md";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/runtime-activation-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/runtime-activation-internal.ts";
const APP_REPOSITORY = "apps/control-plane-api/src/runtime-activation-repository-internal.ts";
const APP_SQLITE = "apps/control-plane-api/src/runtime-activation-sqlite-internal.ts";
const APP_FACTORY = "apps/control-plane-api/src/runtime-activation.ts";
const APP_STAGING_INTERNAL = "apps/control-plane-api/src/runtime-staging-internal.ts";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/runtime-activation.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/runtime-activation.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const ROOT_TEST = "tests/control-plane-runtime-activation.test.mjs";
const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";

let built;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneRuntimeActivationEvidenceError && error.code === code;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

function changedByte(bytes) {
  const copy = Uint8Array.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

function exactProofDocument(artifactSha256) {
  return [
    "# Test-only M07-T07 proof authority",
    "",
    `Artifact: \`${ARTIFACT}\``,
    "",
    `Final receipt: \`sha256:${artifactSha256}\``,
    "",
  ].join("\n");
}

async function makeTemporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

async function trackedMutation(relativePath, transform) {
  const source = await workspaceBytes(relativePath);
  const current = source.toString("utf8");
  const transformed = transform(current);
  assert.notEqual(transformed, current);
  return {
    trackedFileBytes: { [relativePath]: Buffer.from(transformed, "utf8") },
    runtimeReceipt: built.runtimeReceipt,
  };
}

function mutateTraceOwner(value, traceId) {
  if (Array.isArray(value)) {
    for (const child of value) mutateTraceOwner(child, traceId);
    return;
  }
  if (value !== null && typeof value === "object") {
    if (value.id === traceId && Array.isArray(value.owners)) {
      value.owners = value.owners.filter((owner) => owner !== "M07-T07");
    }
    for (const child of Object.values(value)) mutateTraceOwner(child, traceId);
  }
}

before(async () => {
  built = await buildControlPlaneRuntimeActivationEvidence();
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T07 artifact and activation receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.runtime-activation-proof.v1");
  assert.equal(built.artifact.task, "M07-T07");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.claims.officialFirstActivation.record, {
    activeRevision: EXPECTED_REVISION,
    previousGoodRevision: null,
    generation: 0,
  });
  assert.equal(built.artifact.claims.authorityJoin.exactPrivateLineage, true);
  assert.equal(built.artifact.claims.authorityJoin.successfulCandidateConsumed, true);
  assert.equal(built.artifact.claims.authorityJoin.mismatchedCandidateNotConsumed, true);
  assert.equal(built.artifact.claims.authorityJoin.busyCandidateNotConsumed, true);
  assert.equal(built.artifact.claims.durableTransitions.aToB.generation, 1);
  assert.equal(built.artifact.claims.durableTransitions.sameB.generation, 2);
  assert.equal(built.artifact.claims.durableTransitions.bToA.generation, 3);
  assert.equal(built.artifact.claims.durableTransitions.staleNoWrite, true);
  assert.equal(built.artifact.claims.durableTransitions.exhaustedNoWrite, true);
  assert.equal(
    built.artifact.claims.implementation.transitions.authenticatedBaselineDriftRequiresRecovery,
    true,
  );
  assert.equal(
    built.artifact.claims.implementation.sqlite.liveSchemaReauthenticatedUnderWriterLock,
    true,
  );
  assert.equal(built.artifact.claims.rollbackAndRecovery.precommitRollbackStatus, "missing");
  assert.equal(built.artifact.claims.rollbackAndRecovery.indeterminateStatus, "recovery-required");
  assert.equal(
    built.artifact.claims.rollbackAndRecovery.preexistingRawRecord.directDeletionStatus,
    "recovery-required",
  );
  assert.equal(
    built.artifact.claims.rollbackAndRecovery.preexistingRawRecord.directDeletionDurableStatus,
    "missing",
  );
  assert.equal(built.artifact.claims.lazyNativeImport.beforeOpen, 0);
  assert.equal(built.artifact.claims.lazyNativeImport.loadedByPublicFactory, true);
  assert.equal(built.artifact.tests.packageRuntimeCases, 21);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 25);
  assert.equal(built.artifact.tests.rootMutationCases, 18);
  assert.equal(built.artifact.prerequisites.length, 3);
  assert.equal(built.artifact.claims.traceRows.length, 8);
  assert.deepEqual(built.artifact.claims.coverageTransitions, {
    proofMatrixP12: "NOT_PROVEN",
    normativeN004: "PLANNED",
    normativeN004Contribution:
      "M07-T07 proves one exact preflight-joined, complete-Bundle-reclosed atomic record transition; M07-T09 still owns every precommit fault boundary before N-004 can advance.",
    normativeN038: "PLANNED",
    normativeN041: "PLANNED",
    findingPF075: "OPEN",
    findingPF076: "OPEN",
  });
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlaneRuntimeActivationEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlaneRuntimeActivationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.deepEqual(result, {
    task: "M07-T07",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: 21,
    compileTimeNegativeCases: 25,
    rootMutationCases: 18,
    prerequisiteArtifacts: 3,
    traceRows: 8,
  });
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlaneRuntimeActivationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
});

test("[proof] rejects pending, wrong, duplicate, or missing final pins", async () => {
  const variants = [
    proofDocument.replace(`sha256:${built.artifactSha256}`, "sha256:PENDING"),
    proofDocument.replace(built.artifactSha256, "0".repeat(64)),
    `${proofDocument}\n${proofDocument}`,
    "# no final pin\n",
  ];
  for (const candidate of variants) {
    await assert.rejects(
      verifyControlPlaneRuntimeActivationEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in all three direct immutable artifacts", async () => {
  assert.deepEqual(
    CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS.map(({ task }) => task),
    ["M07-T01", "M07-T04", "M07-T06"],
  );
  for (const prerequisite of CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS) {
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects authority-join, consume, reclosure, CAS, or recovery drift", async () => {
  const mutations = [
    [
      APP_CONTRACT,
      (source) => source.replace("expectedGeneration: number | null", "expected: number | null"),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "referenceRecord.packageRecord !== observedStagingRecord.packageRecord",
          "referenceRecord.packageRecord === observedStagingRecord.packageRecord",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          'Object.hasOwn(value, "expectedGeneration")',
          '"expectedGeneration" in value',
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "attempt.expectedGeneration,\n      authenticatedCurrent,\n      revision,",
          "attempt.expectedGeneration,\n      null,\n      revision,",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "consumeBundleRuntimeStagingAuthority(stagingAuthority)",
          "readBundleRuntimeStagingAuthority(stagingAuthority)",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "await options.bundleStore.getBundle(revision)",
          'await Promise.resolve({ status: "missing" })',
        ),
    ],
    [
      APP_REPOSITORY,
      (source) =>
        source.replace(
          "current.activeRevision === candidateRevision",
          "current.activeRevision !== candidateRevision",
        ),
    ],
    [
      APP_REPOSITORY,
      (source) =>
        source.replace(
          "if (!sameRecord(current, capturedAuthenticatedCurrent))",
          "if (sameRecord(current, capturedAuthenticatedCurrent))",
        ),
    ],
    [
      APP_SQLITE,
      (source) =>
        source.replace('openDatabase.exec("BEGIN IMMEDIATE")', 'openDatabase.exec("BEGIN")'),
    ],
    [
      APP_SQLITE,
      (source) =>
        source.replace(
          'openDatabase.exec("BEGIN IMMEDIATE");\n      assertExactSchema(openDatabase);',
          'openDatabase.exec("BEGIN IMMEDIATE");',
        ),
    ],
    [
      APP_SQLITE,
      (source) =>
        source.replace(
          "if (!sameRecord(current, capturedAuthenticatedCurrent))",
          "if (sameRecord(current, capturedAuthenticatedCurrent))",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          'if (!canCommit()) return Object.freeze({ status: "recovery-required" });',
          'if (canCommit()) return Object.freeze({ status: "recovery-required" });',
        ),
    ],
    [
      APP_FACTORY,
      (source) =>
        source.replace(
          'await import("./runtime-activation-sqlite-internal.js")',
          'await import("./runtime-activation-repository-internal.js")',
        ),
    ],
    [
      APP_STAGING_INTERNAL,
      (source) =>
        source.replace("AUTHORITIES.delete(stagingAuthority)", "AUTHORITIES.has(stagingAuthority)"),
    ],
    [APP_REPOSITORY, (source) => source.replace("STORAGE_ERRORS.add(this);", "void this;")],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "if (operational !== undefined) throw operational;",
          "if (operational !== undefined) return bundleReclosureRejection();",
        ),
    ],
    [
      APP_FACTORY,
      (source) =>
        source.replace(
          "createOwnedBundleRuntimeActivationInternal(bundleStore, repository)",
          "createBundleRuntimeActivationInternal({ bundleStore, repository })",
        ),
    ],
  ];
  for (const [mutationIndex, [relativePath, transform]] of mutations.entries()) {
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence(await trackedMutation(relativePath, transform)),
      expectedError("IMPLEMENTATION_DRIFT"),
      `Implementation mutation ${String(mutationIndex)} in ${relativePath} escaped detection.`,
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, CI, or policy drift", async () => {
  const mutations = [
    [
      APP_PACKAGE,
      (source) => source.replace('"test:runtime-activation":', '"test:runtime-activation-old":'),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          "export { openBundleRuntimeActivation }",
          "export { openBundleRuntimeActivation as openActivation }",
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          "  INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE,",
          "  INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE as INVALID_RECOVERY_AUTHORITY_CODE,",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery",
          "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-activation",
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace('      "control-plane-runtime-activation",', '      "removed-activation",'),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace('    "control-plane-runtime-activation",', '    "removed-activation",'),
    ],
    [
      SHARED_STATE_AUTHORITY,
      (source) =>
        source.replace(
          'CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE"',
          'CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE: "NONE"',
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence(await trackedMutation(relativePath, transform)),
      expectedError("REGISTRATION_DRIFT"),
    );
  }
});

test("[traceability] rejects exact activation trace-owner drift", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const ids = built.artifact.claims.traceRows.map(({ id }) => id);
  assert.deepEqual(ids, [
    "PIPE-007",
    "PIPE-016",
    "PIPE-017",
    "R-008",
    "R-102",
    "R-126",
    "A-008",
    "A-009",
  ]);
  for (const traceId of ids) {
    const changed = structuredClone(trace);
    mutateTraceOwner(changed, traceId);
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence({
        trackedFileBytes: {
          [TRACEABILITY]: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`, "utf8"),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }
});

test("[coverage] rejects P-12, N-004/N-038/N-041, or PF-075/PF-076 truth drift", async () => {
  const mutations = [
    [
      NORMATIVE_COVERAGE,
      (source) => source.replace(/^(\| N-004 \|.*)\| PLANNED\s+\|/mu, "$1| TESTED |"),
    ],
    [
      NORMATIVE_COVERAGE,
      (source) => source.replace(/^(\| N-038 \|.*)\| PLANNED\s+\|/mu, "$1| TESTED |"),
    ],
    [
      NORMATIVE_COVERAGE,
      (source) => source.replace(/^(\| N-041 \|.*)\| PLANNED\s+\|/mu, "$1| TESTED |"),
    ],
    [
      PROOF_MATRIX,
      (source) => source.replace(/^(\| P-12 \|.*)\| NOT_PROVEN\s+\|/mu, "$1| PROVEN |"),
    ],
    [
      FINDINGS,
      (source) => {
        const start = source.indexOf("## PF-075 —");
        return `${source.slice(0, start)}${source.slice(start).replace("- Status: OPEN", "- Status: CLOSED")}`;
      },
    ],
    [
      FINDINGS,
      (source) => {
        const start = source.indexOf("## PF-076 —");
        return `${source.slice(0, start)}${source.slice(start).replace("- Status: OPEN", "- Status: CLOSED")}`;
      },
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence(await trackedMutation(relativePath, transform)),
      expectedError("COVERAGE_DRIFT"),
    );
  }
});

test("[runtime] rejects changed join, transition, rollback, recovery, or native-load receipts", async () => {
  const mutations = [
    (receipt) => {
      receipt.officialActivation.exactPrivateJoin = false;
    },
    (receipt) => {
      receipt.officialActivation.stagedConsumed = false;
    },
    (receipt) => {
      receipt.lifetime.mismatchDidNotConsume = false;
    },
    (receipt) => {
      receipt.transitions.sameB.previousGoodRevision = null;
    },
    (receipt) => {
      receipt.transitions.staleNoWrite = false;
    },
    (receipt) => {
      receipt.durability.precommitRollbackStatus = "found";
    },
    (receipt) => {
      receipt.durability.indeterminateStatus = "activated";
    },
    (receipt) => {
      receipt.durability.statementAcquisitionFailureCode = null;
    },
    (receipt) => {
      receipt.recovery.activeAuthorityAbsent = false;
    },
    (receipt) => {
      receipt.recovery.vanishedStatus = "empty";
    },
    (receipt) => {
      receipt.nativeImport.beforeOpen = 1;
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  const runtimeSource = (await workspaceBytes(APP_RUNTIME_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(runtimeSource.replaceAll("it(", "it.skip(")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const typeSource = (await workspaceBytes(APP_TYPE_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence({
      trackedFileBytes: {
        [APP_TYPE_TEST]: Buffer.from(typeSource.replaceAll("// @ts-expect-error", "// removed")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const rootSource = (await workspaceBytes(ROOT_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence({
      trackedFileBytes: {
        [ROOT_TEST]: Buffer.from(rootSource.replaceAll('test("[', 'test.skip("[')),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[platform] rejects public-export, TSDoc, private-export, or native-import drift", async () => {
  const cases = [
    [
      APP_CONTRACT,
      (source) => source.replace("/** One complete durable", "/* One complete durable"),
      "PLATFORM_DRIFT",
    ],
    [
      APP_INDEX,
      (source) =>
        `${source}\nexport { createBundleRuntimeActivationInternal } from "./runtime-activation-internal.js";\n`,
      "REGISTRATION_DRIFT",
    ],
    [
      APP_FACTORY,
      (source) => `import Database from "better-sqlite3";\n${source}`,
      "IMPLEMENTATION_DRIFT",
    ],
  ];
  for (const [relativePath, transform, code] of cases) {
    await assert.rejects(
      buildControlPlaneRuntimeActivationEvidence(await trackedMutation(relativePath, transform)),
      expectedError(code),
    );
  }
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t07-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlaneRuntimeActivationEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeActivationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofLink,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  const realParent = path.join(directory, "real-parent");
  const linkedParent = path.join(directory, "linked-parent");
  await mkdir(realParent);
  await writeFile(path.join(realParent, "artifact.json"), built.artifactBytes);
  await symlink(realParent, linkedParent);
  await assert.rejects(
    verifyControlPlaneRuntimeActivationEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t07-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneRuntimeActivationEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t07-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneRuntimeActivationEvidence({
      artifactPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, Buffer.from("tampered\n"));
      },
    }),
    expectedError("ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), oldBytes);
  assert.deepEqual(await readdir(directory), ["artifact.json"]);
});

test("[options] rejects unknown, accessor-backed, shared-memory, or hostile authority", async () => {
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence({ unknown: true }),
    expectedError("INVALID_OPTIONS"),
  );
  const active = {};
  Object.defineProperty(active, "runtimeReceipt", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeActivationEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeActivationEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(1)),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("INVALID_OPTIONS"),
  );
  let observations = 0;
  const hostileBytes = Uint8Array.from(built.artifactBytes);
  for (const key of ["buffer", "byteLength", "byteOffset", Symbol.iterator]) {
    Object.defineProperty(hostileBytes, key, {
      configurable: true,
      get() {
        observations += 1;
        throw new Error("caller hook must stay inert");
      },
    });
  }
  const verified = await verifyControlPlaneRuntimeActivationEvidence({
    artifactBytes: hostileBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(observations, 0);
});

test("[immutability] freezes the evidence graph and preserves T08-T11 nonclaims", () => {
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.artifact));
  assert.ok(Object.isFrozen(built.artifact.claims));
  assert.ok(Object.isFrozen(built.artifact.claims.durableTransitions));
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.runtimeReceipt));
  assert.equal(built.artifact.nonclaims.length, 10);
  for (const task of ["M07-T08", "M07-T09", "M07-T10", "M07-T11"]) {
    assert.ok(built.artifact.nonclaims.some((claim) => claim.includes(task)));
  }
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("N-004")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("N-038")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("PF-075")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("Android")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
