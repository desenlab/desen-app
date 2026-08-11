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
  CONTROL_PLANE_REFERENCE_PREFLIGHT_PREREQUISITE_PINS,
  ControlPlaneReferencePreflightEvidenceError,
  buildControlPlaneReferencePreflightEvidence,
  verifyControlPlaneReferencePreflightEvidence,
  writeControlPlaneReferencePreflightEvidence,
} from "../scripts/lib/control-plane-reference-preflight-proof.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/reference-preflight-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/reference-preflight-internal.ts";
const APP_IMPLEMENTATION = "apps/control-plane-api/src/reference-preflight.ts";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/reference-preflight.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/reference-preflight.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const ROOT_TEST = "tests/control-plane-reference-preflight.test.mjs";

let built;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneReferencePreflightEvidenceError && error.code === code;
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
    "# Test-only M07-T04 proof authority",
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
      value.owners = value.owners.filter((owner) => owner !== "M07-T04");
    }
    for (const child of Object.values(value)) mutateTraceOwner(child, traceId);
  }
}

before(async () => {
  built = await buildControlPlaneReferencePreflightEvidence();
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T04 artifact and official reference receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.reference-preflight-proof.v1");
  assert.equal(built.artifact.task, "M07-T04");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.claims.officialSuccess.surfaces, [
    {
      id: "home",
      sourceNodeCount: 2,
      maximumMaterializedNodeCount: 2,
      sourceTreeDepth: 1,
      capabilityReferenceCount: 2,
      actionCount: 0,
      predicateNodeCount: 0,
      settlementDepth: 0,
    },
    {
      id: "sign-in",
      sourceNodeCount: 6,
      maximumMaterializedNodeCount: 6,
      sourceTreeDepth: 1,
      capabilityReferenceCount: 7,
      actionCount: 4,
      predicateNodeCount: 1,
      settlementDepth: 1,
    },
  ]);
  assert.equal(built.artifact.claims.semanticAgreement.executionContractsPrepared, false);
  assert.equal(built.artifact.claims.semanticAgreement.runtimeObligationsRetained, false);
  assert.equal(built.artifact.tests.packageRuntimeCases, 22);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 12);
  assert.equal(built.artifact.tests.rootMutationCases, 16);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlaneReferencePreflightEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlaneReferencePreflightEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.deepEqual(result, {
    task: "M07-T04",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: 22,
    compileTimeNegativeCases: 12,
    rootMutationCases: 16,
    surfaces: 2,
  });
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlaneReferencePreflightEvidence({
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
      verifyControlPlaneReferencePreflightEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in every direct prerequisite", async () => {
  for (const prerequisite of CONTROL_PLANE_REFERENCE_PREFLIGHT_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(prerequisite.path);
    await assert.rejects(
      buildControlPlaneReferencePreflightEvidence({
        prerequisiteBytes: { [prerequisite.path]: changedByte(bytes) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects changed authority, traversal, limit, or public-entry receipts", async () => {
  const mutations = [
    [
      APP_CONTRACT,
      (source) => source.replace("readonly maxSourceTreeDepth: number;", "readonly depth: number;"),
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
        source.replace(
          "validateBundleSemantics: validateDesenBundleSemantics",
          '["validateBundleSemantics"]: validateDesenBundleSemantics',
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences",
          "BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodes",
        ),
    ],
    [
      APP_IMPLEMENTATION,
      (source) =>
        source.replace(
          "preflightBundleReferencesInternal(authority)",
          "preflightBundleReferencesInternal(Object(authority))",
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlaneReferencePreflightEvidence(await trackedMutation(relativePath, transform)),
      expectedError("IMPLEMENTATION_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, or CI tuple drift", async () => {
  const mutations = [
    [
      APP_PACKAGE,
      (source) => source.replace('"test:reference-preflight":', '"test:reference-preflight-old":'),
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
        source.replace("preflightBundleReferences }", "preflightBundleReferences as run }"),
    ],
    [
      APP_INDEX,
      (source) =>
        source.replace(
          'export { stageBundleRuntime } from "./runtime-staging.js";',
          'export { stageBundleRuntime as stageBundleRuntimeChanged } from "./runtime-staging.js";',
        ),
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
      ROOT_PACKAGE,
      (source) =>
        source.replace(
          "pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-local-api",
          "pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-decoy && pnpm verify:control-plane-local-api",
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
          "pnpm verify:control-plane-local-api && pnpm verify:control-plane-runtime-staging",
          "pnpm verify:control-plane-local-api && pnpm verify:control-plane-runtime-staging-decoy",
        ),
    ],
    [
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-reference-preflight",',
          '      "removed-reference-preflight",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-reference-preflight",',
          '    "removed-reference-preflight",',
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
      CI_SOURCE,
      (source) =>
        source.replace(
          '      "control-plane-runtime-fault-injection",',
          '      "control-plane-runtime-fault-injection-decoy",',
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
      buildControlPlaneReferencePreflightEvidence(await trackedMutation(relativePath, transform)),
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
    buildControlPlaneReferencePreflightEvidence({
      trackedFileBytes: { [APP_PACKAGE]: Buffer.from(historicalAppPackage, "utf8") },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects owner or identity drift in all five exact rows", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const traceIds = built.artifact.claims.traceRows.map(({ id }) => id);
  assert.equal(traceIds.length, 5);
  for (const traceId of traceIds) {
    const changed = structuredClone(trace);
    mutateTraceOwner(changed, traceId);
    await assert.rejects(
      buildControlPlaneReferencePreflightEvidence({
        trackedFileBytes: {
          [TRACEABILITY]: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`, "utf8"),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }
});

test("[runtime] rejects changed success, reference, precedence, or internal-failure receipts", async () => {
  const mutations = [
    (receipt) => {
      receipt.exactSuccess.authenticated = false;
    },
    (receipt) => {
      receipt.exactSuccess.surfaces[0].sourceNodeCount = 3;
    },
    (receipt) => {
      receipt.unknownComponent.codes = ["ENTRY_NOT_FOUND"];
    },
    (receipt) => {
      receipt.forgedAuthority.observations = 1;
    },
    (receipt) => {
      receipt.internalFailure.stage = "surface-capability-references";
    },
    (receipt) => {
      receipt.limits.maxSourceTreeDepth = 65;
    },
    (receipt) => {
      receipt.publicModuleKeys.push("unreviewedRuntimeSuccessor");
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneReferencePreflightEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  const runtimeSource = (await workspaceBytes(APP_RUNTIME_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneReferencePreflightEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(runtimeSource.replaceAll("it(", "it.skip(")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const typeSource = (await workspaceBytes(APP_TYPE_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneReferencePreflightEvidence({
      trackedFileBytes: {
        [APP_TYPE_TEST]: Buffer.from(typeSource.replaceAll("// @ts-expect-error", "// removed")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const rootSource = (await workspaceBytes(ROOT_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlaneReferencePreflightEvidence({
      trackedFileBytes: {
        [ROOT_TEST]: Buffer.from(rootSource.replaceAll('test("[', 'test.skip("[')),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t04-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlaneReferencePreflightEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneReferencePreflightEvidence({
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
    verifyControlPlaneReferencePreflightEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t04-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneReferencePreflightEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t04-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneReferencePreflightEvidence({
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
    buildControlPlaneReferencePreflightEvidence({ unknown: true }),
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
    buildControlPlaneReferencePreflightEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneReferencePreflightEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(1));
  await assert.rejects(
    verifyControlPlaneReferencePreflightEvidence({
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
  const verified = await verifyControlPlaneReferencePreflightEvidence({
    artifactBytes: hostileBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(hookObservations, 0);
});

test("[immutability] freezes the evidence graph and preserves honest later-task nonclaims", () => {
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.artifact));
  assert.ok(Object.isFrozen(built.artifact.claims));
  assert.ok(Object.isFrozen(built.artifact.claims.officialSuccess.surfaces));
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.runtimeReceipt));
  assert.equal(built.artifact.nonclaims.length, 8);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T05")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T06")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T07")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M12-T05")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("native targets")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
