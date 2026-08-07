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
  CONTROL_PLANE_PACKAGE_PREFLIGHT_PREREQUISITE_PINS,
  ControlPlanePackagePreflightEvidenceError,
  buildControlPlanePackagePreflightEvidence,
  verifyControlPlanePackagePreflightEvidence,
  writeControlPlanePackagePreflightEvidence,
} from "../scripts/lib/control-plane-package-preflight-proof.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_CONTRACT = "apps/control-plane-api/src/package-preflight-contract.ts";
const APP_INTERNAL = "apps/control-plane-api/src/package-preflight-internal.ts";
const APP_SCHEMA_GUARD = "apps/control-plane-api/src/package-preflight-schema-guard.ts";
const APP_WEB_REACT = "apps/control-plane-api/src/package-preflight-web-react.ts";
const APP_IMPLEMENTATION = "apps/control-plane-api/src/package-preflight.ts";
const APP_GUARD_CODEGEN =
  "apps/control-plane-api/scripts/lib/package-preflight-catalog-guard-codegen.mjs";
const APP_GENERATED_CATALOG_GUARD =
  "apps/control-plane-api/src/generated/0.1.0/package-preflight-catalog-guard.ts";
const CATALOG_SCHEMA =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-catalog.schema.json";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/package-preflight.test.ts";
const APP_GUARD_TEST = "apps/control-plane-api/test/package-preflight-schema-guard.test.ts";
const APP_TYPE_TEST = "apps/control-plane-api/test/package-preflight.types.ts";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";

let built;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlanePackagePreflightEvidenceError && error.code === code;
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
    "# Test-only M07-T03 proof authority",
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
      value.owners = value.owners.filter((owner) => owner !== "M07-T03");
    }
    for (const child of Object.values(value)) mutateTraceOwner(child, traceId);
  }
}

before(async () => {
  built = await buildControlPlanePackagePreflightEvidence();
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T03 artifact and current Web-React receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.package-preflight-proof.v1");
  assert.equal(built.artifact.task, "M07-T03");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.claims.currentPackage, {
    id: "run.desen.reference.sign-in",
    version: "0.1.0",
    target: "web-react",
    packageDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
    digestProfile: "desen.web-react.package-digest",
    digestProfileVersion: 1,
    artifactCount: 80,
    framedEntryCount: 81,
    framedByteLength: 252_072,
    distributionByteLength: 243_175,
    publicProfile: built.runtimeReceipt.packageInput.publicProfile,
  });
  assert.equal(built.artifact.claims.exactResolution.newestOrBestMatch, false);
  assert.equal(
    built.artifact.claims.authority.forgedAuthorityRejectedBeforeInventoryObservation,
    true,
  );
  assert.equal(built.artifact.claims.digestClosure.exactSuccess.authenticated, true);
  assert.equal(built.artifact.tests.packageRuntimeCases, 34);
  assert.equal(built.artifact.tests.packageGuardCases, 5);
  assert.equal(built.artifact.tests.packageFocusedCases, 39);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 9);
  assert.equal(built.artifact.tests.rootMutationCases, 16);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlanePackagePreflightEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlanePackagePreflightEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeReceipt: built.runtimeReceipt,
  });
  assert.deepEqual(result, {
    task: "M07-T03",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: 34,
    packageGuardCases: 5,
    packageFocusedCases: 39,
    compileTimeNegativeCases: 9,
    rootMutationCases: 16,
    installedArtifacts: 80,
  });
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlanePackagePreflightEvidence({
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
      verifyControlPlanePackagePreflightEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in every direct prerequisite", async () => {
  for (const prerequisite of CONTROL_PLANE_PACKAGE_PREFLIGHT_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(prerequisite.path);
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence({
        prerequisiteBytes: { [prerequisite.path]: changedByte(bytes) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects changed contract, matcher, digest, guard, or type authority receipts", async () => {
  const mutations = [
    [
      APP_CONTRACT,
      (source) =>
        source.replace(
          "readonly requirementPackageIndexes: readonly number[]",
          "readonly requirementIndexes: readonly number[]",
        ),
    ],
    [
      APP_INTERNAL,
      (source) =>
        source.replace(
          "readBundleIntegrityAuthority(integrityAuthority)",
          "readBundleIntegrityAuthority(Object(integrityAuthority))",
        ),
    ],
    [
      APP_SCHEMA_GUARD,
      (source) =>
        source.replace(
          "validatePackagePreflightCatalogGuard as GeneratedGuard",
          "validatePackagePreflightCatalogGuard as unknown as GeneratedGuard",
        ),
    ],
    [
      APP_WEB_REACT,
      (source) =>
        source.replace(
          'asciiBytes("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\\n")',
          'asciiBytes("DESEN-WEB-REACT-PACKAGE-DIGEST-V2\\n")',
        ),
    ],
    [
      APP_IMPLEMENTATION,
      (source) =>
        source.replace(
          "preflightBundlePackagesInternal(authority, installedPackages)",
          "preflightBundlePackagesInternal(authority, [...installedPackages])",
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence(await trackedMutation(relativePath, transform)),
      expectedError("IMPLEMENTATION_DRIFT"),
    );
  }

  const codegenSource = (await workspaceBytes(APP_GUARD_CODEGEN)).toString("utf8");
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: {
        [APP_GUARD_CODEGEN]: Buffer.from(
          codegenSource.replace("allErrors: false", "allErrors: true"),
        ),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("GUARD_CODEGEN_DRIFT"),
  );
  for (const relativePath of [APP_GENERATED_CATALOG_GUARD, CATALOG_SCHEMA]) {
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence({
        trackedFileBytes: { [relativePath]: changedByte(await workspaceBytes(relativePath)) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("GUARD_CODEGEN_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, or CI tuple drift", async () => {
  const mutations = [
    [
      APP_PACKAGE,
      (source) => source.replace('"test:package-preflight":', '"test:package-preflight-old":'),
    ],
    [
      APP_INDEX,
      (source) => source.replace("preflightBundlePackages }", "preflightBundlePackages as run }"),
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
          "pnpm verify:control-plane-package-preflight && pnpm verify:control-plane-reference-preflight",
          "pnpm verify:control-plane-reference-preflight",
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
          "pnpm verify:control-plane-reference-preflight && pnpm verify:control-plane-local-api",
          "pnpm verify:control-plane-reference-preflight",
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
          '      "control-plane-package-preflight",',
          '      "removed-package-preflight",',
        ),
    ],
    [
      CI_INVENTORY,
      (source) =>
        source.replace(
          '    "control-plane-package-preflight",',
          '    "removed-package-preflight",',
        ),
    ],
  ];
  for (const [relativePath, transform] of mutations) {
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence(await trackedMutation(relativePath, transform)),
      expectedError("REGISTRATION_DRIFT"),
    );
  }

  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: { [APP_PACKAGE]: changedByte(await workspaceBytes(APP_PACKAGE)) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );

  const indexWithAppendedTail = Buffer.concat([
    await workspaceBytes(APP_INDEX),
    Buffer.from("\n/* unreviewed successor tail */\n", "utf8"),
  ]);
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: { [APP_INDEX]: indexWithAppendedTail },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects owner or identity drift in all fifteen exact rows", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const traceIds = built.artifact.claims.traceRows.map(({ id }) => id);
  assert.equal(traceIds.length, 15);
  for (const traceId of traceIds) {
    const changed = structuredClone(trace);
    mutateTraceOwner(changed, traceId);
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence({
        trackedFileBytes: {
          [TRACEABILITY]: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`, "utf8"),
        },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }
});

test("[runtime] rejects changed exact-match, digest, precedence, or authority receipts", async () => {
  const mutations = [
    (receipt) => {
      receipt.exactSuccess.authenticated = false;
    },
    (receipt) => {
      receipt.packageInput.publicProfile.packageDigest = `sha256:${"0".repeat(64)}`;
    },
    (receipt) => {
      receipt.missing.codes = ["CATALOG_DIGEST_MISMATCH"];
    },
    (receipt) => {
      receipt.changedArtifact.stage = "package-catalog";
    },
    (receipt) => {
      receipt.duplicateRequirements.requirementPackageIndexes = [0];
    },
    (receipt) => {
      receipt.forgedAuthority.inventoryObservations = 1;
    },
    (receipt) => {
      receipt.orderedExtraAfter.packages[0].version = "0.1.1";
    },
    (receipt) => {
      receipt.publicModuleKeys.push("unreviewedRuntimeSuccessor");
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlanePackagePreflightEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  const runtimeSource = (await workspaceBytes(APP_RUNTIME_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: {
        [APP_RUNTIME_TEST]: Buffer.from(runtimeSource.replaceAll("it(", "it.skip(")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const guardSource = (await workspaceBytes(APP_GUARD_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: {
        [APP_GUARD_TEST]: Buffer.from(guardSource.replaceAll("it(", "it.skip(")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const typeSource = (await workspaceBytes(APP_TYPE_TEST)).toString("utf8");
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: {
        [APP_TYPE_TEST]: Buffer.from(typeSource.replaceAll("// @ts-expect-error", "// removed")),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
  const rootSource = (
    await workspaceBytes("tests/control-plane-package-preflight.test.mjs")
  ).toString("utf8");
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      trackedFileBytes: {
        "tests/control-plane-package-preflight.test.mjs": Buffer.from(
          rootSource.replaceAll('test("[', 'test.skip("['),
        ),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t03-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlanePackagePreflightEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlanePackagePreflightEvidence({
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
    verifyControlPlanePackagePreflightEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t03-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlanePackagePreflightEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t03-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlanePackagePreflightEvidence({
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
    buildControlPlanePackagePreflightEvidence({ unknown: true }),
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
    buildControlPlanePackagePreflightEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(1));
  await assert.rejects(
    verifyControlPlanePackagePreflightEvidence({
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
  const verified = await verifyControlPlanePackagePreflightEvidence({
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
  assert.ok(Object.isFrozen(built.artifact.claims.currentPackage.publicProfile.entries));
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.runtimeReceipt));
  assert.equal(built.artifact.nonclaims.length, 7);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T04")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M07-T06")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("M12-T12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("native targets")));
  assert.equal(JSON.stringify(built.artifact).includes("function"), false);
});
