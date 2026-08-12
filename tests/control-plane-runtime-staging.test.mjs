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
  CONTROL_PLANE_RUNTIME_STAGING_PREREQUISITE_PINS,
  ControlPlaneRuntimeStagingEvidenceError,
  buildControlPlaneRuntimeStagingEvidence,
  verifyControlPlaneRuntimeStagingEvidence,
  writeControlPlaneRuntimeStagingEvidence,
} from "../scripts/lib/control-plane-runtime-staging-proof.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const NORMATIVE_COVERAGE = "docs/proof/NORMATIVE-COVERAGE.md";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/runtime-staging-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/runtime-staging-internal.ts";
const APP_IMPLEMENTATION = "apps/control-plane-api/src/runtime-staging.ts";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/runtime-staging.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/runtime-staging.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const ROOT_TEST = "tests/control-plane-runtime-staging.test.mjs";

let built;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) => error instanceof ControlPlaneRuntimeStagingEvidenceError && error.code === code;
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
    "# Test-only M07-T06 proof authority",
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
  const transformed = transform(source.toString("utf8"));
  assert.notEqual(transformed, source.toString("utf8"));
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
      value.owners = value.owners.filter((owner) => owner !== "M07-T06");
    }
    for (const child of Object.values(value)) mutateTraceOwner(child, traceId);
  }
}

before(async () => {
  built = await buildControlPlaneRuntimeStagingEvidence();
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T06 artifact and official staging receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.runtime-staging-proof.v1");
  assert.equal(built.artifact.task, "M07-T06");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(
    built.artifact.claims.officialSuccess.stagedRevision,
    "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
  );
  assert.equal(built.artifact.claims.officialSuccess.packages.length, 1);
  assert.equal(built.artifact.claims.officialSuccess.surfaces.length, 2);
  assert.equal(built.artifact.claims.officialSuccess.runtimeObligationCount, 7);
  assert.equal(built.artifact.tests.packageRuntimeCases, 13);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 13);
  assert.equal(built.artifact.tests.rootMutationCases, 17);
  assert.equal(built.artifact.tests.executableLimitFieldCount, 14);
  assert.deepEqual(built.artifact.tests.executableLimitFields, [
    "maxPackages",
    "maxArtifactEntries",
    "maxArtifactBytes",
    "maxCapabilityEntries",
    "maxSurfaces",
    "maxSourceNodes",
    "maxStateEntries",
    "maxBehaviors",
    "maxHandlerPrograms",
    "maxResourceAliases",
    "maxOperationAliases",
    "maxRuntimeValidationObligations",
    "maxRuntimeObligationPointerCodeUnits",
    "maxAggregateRuntimeObligationCodeUnits",
  ]);
  assert.equal(
    built.artifact.tests.nonzeroBehaviorResourceIndexCaseName,
    "indexes nonzero behavior and resource contracts, instances, handlers, and aliases exactly",
  );
  assert.equal(
    built.artifact.claims.activeStagedSeparation.durableActiveRecordObservedOrMutated,
    false,
  );
  assert.equal(built.artifact.claims.stagedPreparation.executableModuleLoaderPrepared, false);
  assert.deepEqual(built.artifact.claims.coverageTransitions, {
    proofMatrixP12: "NOT_PROVEN",
    normativeN038: "PLANNED",
    normativeN041: "PLANNED",
    authenticatedRows: [
      {
        id: "N-038",
        owner: "M07-T06",
        status: "PLANNED",
        contribution:
          "M07-T06 authenticates the exact immutable M07-T03 Catalog identity and exact T03 Bundle input, retains only a canonically and revision-identical execution-validated Bundle snapshot, re-closes copied artifact bytes, and builds bounded callback-free staged indexes without active-state mutation.",
        evidencePath: ARTIFACT,
      },
      {
        id: "N-041",
        owner: "M07-T06",
        status: "PLANNED",
        contribution:
          "M07-T06 adds one immutable 14-field Runtime Staging Profile with exact-boundary or executable dominance coverage for every field; overflow rejects the complete candidate without truncation or partial authority.",
        evidencePath: ARTIFACT,
      },
    ],
  });
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlaneRuntimeStagingEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlaneRuntimeStagingEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.deepEqual(result, {
    task: "M07-T06",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: 13,
    compileTimeNegativeCases: 13,
    rootMutationCases: 17,
    packages: 1,
    surfaces: 2,
    runtimeObligations: 7,
  });
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlaneRuntimeStagingEvidence({
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
      verifyControlPlaneRuntimeStagingEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in all five direct prerequisite artifacts", async () => {
  for (const prerequisite of CONTROL_PLANE_RUNTIME_STAGING_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(prerequisite.path);
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence({
        prerequisiteBytes: { [prerequisite.path]: changedByte(bytes) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects staging authority, snapshot, index, or delegation drift", async () => {
  const mutations = [
    [
      APP_CONTRACT,
      (source) => source.replace("readonly stagedRevision: string;", "readonly revision: string;"),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "readBundlePackagePreflightAuthority(packageAuthority)",
          "readBundlePackagePreflightAuthority(Object(packageAuthority))",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace("new Uint8Array(artifact.bytes)", "Uint8Array.from(artifact.bytes)"),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "prepareActionProgram: prepareRuntimeActionProgram",
          "prepareActionProgram: (actions) => prepareRuntimeActionProgram([...actions])",
        ),
    ],
    [
      APP_IMPLEMENTATION,
      (source) =>
        source.replace(
          "stageBundleRuntimeInternal(authority)",
          "stageBundleRuntimeInternal(Object(authority))",
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence(await trackedMutation(relativePath, transform)),
      expectedError("IMPLEMENTATION_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, or CI tuple drift", async () => {
  const mutations = [
    [
      APP_PACKAGE,
      (source) => source.replace('"test:runtime-staging":', '"test:runtime-staging-old":'),
    ],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"test:runtime-fault-injection": "vitest run test/runtime-fault-injection.test.ts"',
          '"test:runtime-fault-injection": "vitest run test/runtime-fault-injection-decoy.test.ts"',
        ),
    ],
    [
      APP_PACKAGE,
      (source) =>
        source.replace(
          '"test:runtime-transition-races": "vitest run test/runtime-transition-races.test.ts"',
          '"test:runtime-transition-races": "vitest run test/runtime-transition-races-decoy.test.ts"',
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace("export { stageBundleRuntime }", "export { stageBundleRuntime as stage }"),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { openBundleRuntimeActivation } from "./runtime-activation.js";',
          'export { openBundleRuntimeActivation as openBundleRuntimeActivationChanged } from "./runtime-activation.js";',
        ),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE,",
          "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE as INVALID_RUNTIME_RECOVERY_AUTHORITY_CODE_CHANGED,",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-local-api && pnpm verify:control-plane-runtime-staging",
          "pnpm verify:control-plane-local-api && pnpm verify:control-plane-decoy && pnpm verify:control-plane-runtime-staging",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-fault-injection && pnpm verify:control-plane-runtime-transition-races",
          "pnpm verify:control-plane-runtime-fault-injection && pnpm verify:control-plane-runtime-transition-races-decoy",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-transition-races && pnpm verify:reference-host-web-channel-consumption",
          "pnpm verify:reference-host-web-channel-consumption && pnpm verify:control-plane-runtime-transition-races",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-fault-injection",
          "pnpm verify:control-plane-runtime-recovery && pnpm verify:control-plane-runtime-fault-injection-decoy",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-staging && pnpm verify:control-plane-runtime-activation",
          "pnpm verify:control-plane-runtime-staging && pnpm verify:control-plane-runtime-activation-decoy",
        ),
    ],
    [
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery",
          "pnpm verify:control-plane-runtime-activation && pnpm verify:control-plane-runtime-recovery-decoy",
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-staging",',
          '      "removed-runtime-staging",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace('    "control-plane-runtime-staging",', '    "removed-runtime-staging",'),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-fault-injection",',
          '      "control-plane-runtime-fault-injection-decoy",',
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-transition-races",',
          '      "control-plane-runtime-transition-races-decoy",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-runtime-transition-races",',
          '    "control-plane-runtime-transition-races-decoy",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-runtime-fault-injection",',
          '    "control-plane-runtime-fault-injection-decoy",',
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence(await trackedMutation(relativePath, transform)),
      expectedError("REGISTRATION_DRIFT"),
    );
  }

  const currentAppPackage = (await workspaceBytes(APP_PACKAGE)).toString("utf8");
  const historicalAppPackage = currentAppPackage.replace(
    '    "test:runtime-transition-races": "vitest run test/runtime-transition-races.test.ts",\n',
    "",
  );
  assert.notEqual(historicalAppPackage, currentAppPackage);
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence({
      trackedFileBytes: { [APP_PACKAGE]: Buffer.from(historicalAppPackage, "utf8") },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects exact trace owners and normative coverage rows", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const traceIds = built.artifact.claims.traceRows.map(({ id }) => id);
  assert.deepEqual(traceIds, ["PIPE-006", "PIPE-015", "R-124", "R-126", "R-127"]);
  for (const traceId of traceIds) {
    const changed = structuredClone(trace);
    mutateTraceOwner(changed, traceId);
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence({
        trackedFileBytes: {
          [TRACEABILITY]: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`, "utf8"),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }

  const normative = (await workspaceBytes(NORMATIVE_COVERAGE)).toString("utf8");
  for (const normativeId of ["N-038", "N-041"]) {
    const mutations = [
      (line) => line.replace("M07-T06", "M07-T99"),
      (line) =>
        normativeId === "N-038"
          ? line.replace(/\| TESTED\s+\|/u, "| IMPLEMENTED |")
          : line.replace(/\| PLANNED\s+\|/u, "| TESTED |"),
      (line) =>
        normativeId === "N-038"
          ? line.replace("M07-T10 completes", "M07-T10 claims")
          : line.replace("M07-T09 executes", "M07-T09 claims"),
      (line) => line.replace(ARTIFACT, "docs/proof/artifacts/removed-runtime-staging.json"),
    ];
    for (const mutate of mutations) {
      const lines = normative.split("\n");
      const index = lines.findIndex((line) => line.startsWith(`| ${normativeId} |`));
      assert.notEqual(index, -1);
      const changedLine = mutate(lines[index]);
      assert.notEqual(changedLine, lines[index]);
      lines[index] = changedLine;
      await assert.rejects(
        buildControlPlaneRuntimeStagingEvidence({
          trackedFileBytes: {
            [NORMATIVE_COVERAGE]: Buffer.from(lines.join("\n"), "utf8"),
          },
          runtimeReceipt: built.runtimeReceipt,
        }),
        expectedError("NORMATIVE_COVERAGE_DRIFT"),
      );
    }
  }

  const staleLines = normative.split("\n");
  for (const normativeId of ["N-038", "N-041"]) {
    const index = staleLines.findIndex((line) => line.startsWith(`| ${normativeId} |`));
    staleLines[index] = staleLines[index].replace(
      new RegExp("(`" + ARTIFACT.replaceAll(".", "\\.") + "` `sha256:)[0-9a-f]{64}(`)", "u"),
      `$1${"0".repeat(64)}$2`,
    );
  }
  const staleNormativeBytes = Buffer.from(staleLines.join("\n"), "utf8");
  const staleBuild = await buildControlPlaneRuntimeStagingEvidence({
    trackedFileBytes: { [NORMATIVE_COVERAGE]: staleNormativeBytes },
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.deepEqual(staleBuild.artifactBytes, built.artifactBytes);
  await assert.rejects(
    verifyControlPlaneRuntimeStagingEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument,
      trackedFileBytes: { [NORMATIVE_COVERAGE]: staleNormativeBytes },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("NORMATIVE_COVERAGE_DRIFT"),
  );
});

test("[runtime] rejects changed identity, index, active-separation, or mutation receipts", async () => {
  const activationSuccessorReceipt = structuredClone(built.runtimeReceipt);
  activationSuccessorReceipt.publicModuleKeys = [
    ...activationSuccessorReceipt.publicModuleKeys,
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RuntimeActivationError",
    "openBundleRuntimeActivation",
  ].sort();
  const activationSuccessorBuild = await buildControlPlaneRuntimeStagingEvidence({
    runtimeReceipt: activationSuccessorReceipt,
  });
  assert.deepEqual(activationSuccessorBuild.artifactBytes, built.artifactBytes);
  assert.equal(
    activationSuccessorBuild.runtimeReceipt.publicModuleKeys.includes(
      "openBundleRuntimeActivation",
    ),
    false,
  );
  const recoverySuccessorReceipt = structuredClone(activationSuccessorReceipt);
  recoverySuccessorReceipt.publicModuleKeys = [
    ...recoverySuccessorReceipt.publicModuleKeys,
    "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  ].sort();
  const recoverySuccessorBuild = await buildControlPlaneRuntimeStagingEvidence({
    runtimeReceipt: recoverySuccessorReceipt,
  });
  assert.deepEqual(recoverySuccessorBuild.artifactBytes, built.artifactBytes);
  assert.equal(
    recoverySuccessorBuild.runtimeReceipt.publicModuleKeys.includes(
      "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    ),
    false,
  );
  for (const mutateKeys of [
    (keys) => keys.filter((key) => key !== "openBundleRuntimeActivation"),
    (keys) => [...keys, "unreviewedRuntimeSuccessor"].sort(),
  ]) {
    const receipt = structuredClone(activationSuccessorReceipt);
    receipt.publicModuleKeys = mutateKeys(receipt.publicModuleKeys);
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
  for (const mutateKeys of [
    (keys) => keys.filter((key) => key !== "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE"),
    (keys) => [...keys, "unreviewedRecoverySuccessor"].sort(),
  ]) {
    const receipt = structuredClone(recoverySuccessorReceipt);
    receipt.publicModuleKeys = mutateKeys(receipt.publicModuleKeys);
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
  const mutations = [
    (receipt) => {
      receipt.exactSuccess.authenticated = false;
    },
    (receipt) => {
      receipt.exactSuccess.packages[0].artifactCount = 79;
    },
    (receipt) => {
      receipt.exactSuccess.privateSurfaceIds = ["sign-in"];
    },
    (receipt) => {
      receipt.exactSuccess.artifactByPathIdentity = false;
    },
    (receipt) => {
      receipt.exactSuccess.privateHandlerSelectors.pop();
    },
    (receipt) => {
      receipt.nonzeroIndexes.resourceIdentityExact = false;
    },
    (receipt) => {
      receipt.exactSuccess.publicForbiddenAuthorityAbsent = false;
    },
    (receipt) => {
      receipt.independentCandidates.authorityIdentityDistinct = false;
    },
    (receipt) => {
      receipt.callerMutation.status = "rejected";
    },
    (receipt) => {
      receipt.activeSeparation.unchanged = false;
    },
    (receipt) => {
      receipt.forgedAuthority.observations = 1;
    },
    (receipt) => {
      receipt.snapshotDrift.codes = ["wrong"];
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  const runtimeSource = (await workspaceBytes(APP_RUNTIME_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(runtimeSource.replaceAll("it(", "it.skip(")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(
          runtimeSource.replace('"maxPackages"', '"removedMaxPackages"'),
        ),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const typeSource = (await workspaceBytes(APP_TYPE_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence({
      trackedFileBytes: {
        [APP_TYPE_TEST]: Buffer.from(typeSource.replaceAll("// @ts-expect-error", "// removed")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const rootSource = (await workspaceBytes(ROOT_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence({
      trackedFileBytes: {
        [ROOT_TEST]: Buffer.from(rootSource.replaceAll('test("[', 'test.skip("[')),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[platform] rejects public-export, TSDoc, platform-boundary, or loader-authority drift", async () => {
  const cases = [
    [APP_INTERNAL, (source) => `import "react";\n${source}`, "PLATFORM_BOUNDARY_DRIFT"],
    [
      APP_CONTRACT,
      (source) => source.replace("/** Project-owned diagnostic", "/* Project-owned diagnostic"),
      "PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      APP_CONTRACT,
      (source) =>
        source.replace(
          "readonly stagedRevision: string;",
          "readonly stagedRevision: string;\n  readonly activeRevision: string;",
        ),
      "PLATFORM_BOUNDARY_DRIFT",
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          "export { stageBundleRuntime }",
          "export { stageBundleRuntime, stageBundleRuntimeInternal }",
        ),
      "REGISTRATION_DRIFT",
    ],
  ];
  for (const [relativePath, transform, code] of cases) {
    await assert.rejects(
      buildControlPlaneRuntimeStagingEvidence(await trackedMutation(relativePath, transform)),
      expectedError(code),
    );
  }
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t06-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlaneRuntimeStagingEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneRuntimeStagingEvidence({
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
    verifyControlPlaneRuntimeStagingEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t06-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneRuntimeStagingEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t06-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneRuntimeStagingEvidence({
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
    buildControlPlaneRuntimeStagingEvidence({ unknown: true }),
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
    buildControlPlaneRuntimeStagingEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneRuntimeStagingEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(1));
  await assert.rejects(
    verifyControlPlaneRuntimeStagingEvidence({
      artifactBytes: shared,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("INVALID_OPTIONS"),
  );
  let hookObservations = 0;
  const hostileBytes = Uint8Array.from(built.artifactBytes);
  for (const key of ["buffer", "byteLength", "byteOffset", Symbol.iterator]) {
    Object.defineProperty(hostileBytes, key, {
      configurable: true,
      get() {
        hookObservations += 1;
        throw new Error("caller hook must stay inert");
      },
    });
  }
  const verified = await verifyControlPlaneRuntimeStagingEvidence({
    artifactBytes: hostileBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(hookObservations, 0);
});

test("[immutability] freezes the evidence graph and preserves honest activation nonclaims", () => {
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.artifact));
  assert.ok(Object.isFrozen(built.artifact.claims));
  assert.ok(Object.isFrozen(built.artifact.claims.officialSuccess.packages));
  assert.ok(Object.isFrozen(built.artifact.claims.officialSuccess.surfaces));
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.runtimeReceipt));
  assert.equal(built.artifact.nonclaims.length, 7);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T07")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T08")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("cannot load")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("N-038")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("native targets")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
