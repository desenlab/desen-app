import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTROL_PLANE_BUNDLE_VERIFICATION_PREREQUISITE_PINS,
  ControlPlaneBundleVerificationEvidenceError,
  buildControlPlaneBundleVerificationEvidence,
  verifyControlPlaneBundleVerificationEvidence,
  writeControlPlaneBundleVerificationEvidence,
} from "../scripts/lib/control-plane-bundle-verification-proof.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_PACKAGE = "apps/control-plane-api/package.json";
const APP_INDEX = "apps/control-plane-api/src/index.ts";
const APP_BUNDLE_VERIFICATION_INTERNAL =
  "apps/control-plane-api/src/bundle-verification-internal.ts";
const APP_RUNTIME_TEST = "apps/control-plane-api/test/bundle-verification.test.ts";
const APP_GUARD_TEST = "apps/control-plane-api/test/bundle-verification-guard.test.ts";
const APP_GUARD_CODEGEN =
  "apps/control-plane-api/scripts/lib/bundle-verification-guard-codegen.mjs";
const APP_GENERATED_GUARD =
  "apps/control-plane-api/src/generated/0.1.0/bundle-verification-guards.ts";
const GUARD_SCHEMAS = Object.freeze([
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json",
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json",
]);
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";

let built;
let proofDocument;
const temporaryDirectories = [];

function expectedError(code) {
  return (error) =>
    error instanceof ControlPlaneBundleVerificationEvidenceError && error.code === code;
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
    "# Test-only M07-T02 proof authority",
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

before(async () => {
  built = await buildControlPlaneBundleVerificationEvidence();
  proofDocument = exactProofDocument(built.artifactSha256);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact versioned M07-T02 artifact and golden receipt", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.profile, "desen.control-plane.bundle-verification-proof.v1");
  assert.equal(built.artifact.task, "M07-T02");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(
    built.artifact.claims.officialBundle.revision,
    "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601",
  );
  assert.equal(
    built.artifact.claims.officialBundle.sourceDigest,
    "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878",
  );
  assert.equal(built.artifact.claims.officialBundle.canonicalBytes, 2_173);
  assert.equal(built.artifact.claims.limits.maxSourceCanonicalUtf8Bytes, 8_388_608);
  assert.equal(built.artifact.claims.failFastStructuralGuard.generation.allErrors, false);
  assert.equal(
    built.artifact.claims.failFastStructuralGuard.generation.outputSha256,
    "96e9c9ed5912fb39879f9e49b15321cd1161878c67f9269d0fb41a5a3f58ff29",
  );
  assert.equal(built.artifact.claims.failFastStructuralGuard.runtime.exhaustiveBundleCalls, 0);
  assert.equal(built.artifact.tests.packageRuntimeCases, 17);
  assert.equal(built.artifact.tests.packageGuardCases, 6);
  assert.equal(built.artifact.tests.packageFocusedCases, 23);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds produce byte-identical artifacts", async () => {
  const second = await buildControlPlaneBundleVerificationEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeReceipt, built.runtimeReceipt);
});

test("[authority] verifies exact artifact bytes and one final proof-document pin", async () => {
  const result = await verifyControlPlaneBundleVerificationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.deepEqual(result, {
    task: "M07-T02",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    packageGuardCases: built.artifact.tests.packageGuardCases,
    packageFocusedCases: built.artifact.tests.packageFocusedCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
  });
  assert.ok(Object.isFrozen(result));
});

test("[artifact] rejects one changed evidence byte", async () => {
  await assert.rejects(
    verifyControlPlaneBundleVerificationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
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
      verifyControlPlaneBundleVerificationEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: candidate,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[prerequisites] rejects one changed byte in every direct prerequisite", async () => {
  for (const prerequisite of CONTROL_PLANE_BUNDLE_VERIFICATION_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(prerequisite.path);
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        prerequisiteBytes: { [prerequisite.path]: changedByte(bytes) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[implementation] rejects changed contract, parser, verifier, or type authority receipts", async () => {
  const taskSources = built.artifact.trackedFiles
    .map(({ path: relativePath }) => relativePath)
    .filter(
      (relativePath) =>
        relativePath.startsWith("apps/control-plane-api/src/bundle-verification") ||
        relativePath === "apps/control-plane-api/test/bundle-verification.types.ts",
    );
  assert.ok(taskSources.length >= 4);
  for (const relativePath of taskSources) {
    const bytes = await workspaceBytes(relativePath);
    if (relativePath.endsWith(".types.ts")) {
      await assert.rejects(
        buildControlPlaneBundleVerificationEvidence({
          trackedFileBytes: { [relativePath]: changedByte(bytes) },
          runtimeReceipt: built.runtimeReceipt,
        }),
        expectedError("TEST_AUTHORITY_DRIFT"),
      );
      continue;
    }
    if (relativePath === APP_BUNDLE_VERIFICATION_INTERNAL) {
      await assert.rejects(
        buildControlPlaneBundleVerificationEvidence({
          trackedFileBytes: { [relativePath]: changedByte(bytes) },
          runtimeReceipt: built.runtimeReceipt,
        }),
        expectedError("REGISTRATION_DRIFT"),
      );
      continue;
    }
    const changed = await buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [relativePath]: changedByte(bytes) },
      runtimeReceipt: built.runtimeReceipt,
    });
    assert.notEqual(changed.artifactSha256, built.artifactSha256);
  }

  const codegenSource = (await workspaceBytes(APP_GUARD_CODEGEN)).toString("utf8");
  const optionDrift = codegenSource.replace("allErrors: false", "allErrors: true");
  assert.notEqual(optionDrift, codegenSource);
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [APP_GUARD_CODEGEN]: Buffer.from(optionDrift) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("GUARD_CODEGEN_DRIFT"),
  );

  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: {
        [APP_GENERATED_GUARD]: changedByte(await workspaceBytes(APP_GENERATED_GUARD)),
      },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("GUARD_CODEGEN_DRIFT"),
  );

  for (const schemaPath of GUARD_SCHEMAS) {
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        trackedFileBytes: { [schemaPath]: changedByte(await workspaceBytes(schemaPath)) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("GUARD_CODEGEN_DRIFT"),
    );
  }
});

test("[registration] rejects package-root, package-script, aggregate, or CI tuple drift", async () => {
  const appPackage = JSON.parse(await workspaceBytes(APP_PACKAGE));
  appPackage.scripts["test:bundle-verification"] = "vitest run test/not-the-proof.test.ts";
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [APP_PACKAGE]: Buffer.from(JSON.stringify(appPackage)) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );

  const toolDrift = JSON.parse(await workspaceBytes(APP_PACKAGE));
  toolDrift.devDependencies.ajv = "8.19.0";
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [APP_PACKAGE]: Buffer.from(JSON.stringify(toolDrift)) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );

  const rootPackage = JSON.parse(await workspaceBytes(ROOT_PACKAGE));
  rootPackage.scripts.check = rootPackage.scripts.check.replace(
    "pnpm verify:control-plane-bundle-verification",
    "pnpm verify:control-plane-bundle-verification-renamed",
  );
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [ROOT_PACKAGE]: Buffer.from(JSON.stringify(rootPackage)) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );

  for (const relativePath of [CI_SOURCE, CI_INVENTORY]) {
    const source = await workspaceBytes(relativePath);
    const changed = Buffer.from(
      source
        .toString("utf8")
        .replace("control-plane-bundle-verification", "control-plane-bundle-verification-x"),
    );
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        trackedFileBytes: { [relativePath]: changed },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("REGISTRATION_DRIFT"),
    );
  }

  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
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
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [APP_INDEX]: indexWithAppendedTail },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );

  const changedStagingExport = (await workspaceBytes(APP_INDEX))
    .toString("utf8")
    .replace(
      'export { stageBundleRuntime } from "./runtime-staging.js";',
      'export { stageBundleRuntime as stageBundleRuntimeChanged } from "./runtime-staging.js";',
    );
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [APP_INDEX]: Buffer.from(changedStagingExport) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("REGISTRATION_DRIFT"),
  );
});

test("[traceability] rejects owner or identity drift in all nine exact rows", async () => {
  const trace = JSON.parse(await workspaceBytes(TRACEABILITY));
  const ids = [
    "PIPE-010",
    "PIPE-011",
    "R-007",
    "R-031",
    "R-138",
    "D-030",
    "D-031",
    "D-034",
    "D-035",
  ];
  const walk = (value, target) => {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = walk(child, target);
        if (found !== undefined) return found;
      }
    } else if (value !== null && typeof value === "object") {
      if (value.id === target) return value;
      for (const child of Object.values(value)) {
        const found = walk(child, target);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  for (const id of ids) {
    const changed = structuredClone(trace);
    const row = walk(changed, id);
    assert.ok(row);
    row.owners = row.owners.filter((owner) => owner !== "M07-T02");
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(changed)) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TRACEABILITY_DRIFT"),
    );
  }
});

test("[runtime] rejects changed official authority or diagnostic receipts", async () => {
  const mutations = [
    (receipt) => {
      receipt.official.revision = `sha256:${"0".repeat(64)}`;
    },
    (receipt) => {
      receipt.official.matchedAuthority.authenticated = false;
    },
    (receipt) => {
      receipt.sourceMismatch.codes[0] = "REVISION_MISMATCH";
    },
    (receipt) => {
      receipt.revisionMismatch.status = "verified";
    },
    (receipt) => {
      receipt.unsupported.codes[0] = "SCHEMA_INVALID";
    },
    (receipt) => {
      receipt.rawBundleLimit.verification.diagnosticsFrozen = false;
    },
    (receipt) => {
      receipt.sourceRawLimit.verification.stage = "bundle-size";
    },
    (receipt) => {
      receipt.schemaInvalid.pointers[0] = "";
    },
    (receipt) => {
      receipt.exactSourceCanonicalLimit.verification.status = "rejected";
    },
    (receipt) => {
      receipt.sourceCanonicalExpansion.canonicalBytes = 8_388_608;
    },
    (receipt) => {
      receipt.failFastStructuralGuard.exhaustiveBundleCalls = 1;
    },
    (receipt) => {
      receipt.publicModuleKeys.push("unreviewedRuntimeSuccessor");
    },
    (receipt) => {
      receipt.packageSelfReference.keys.push("unreviewedRuntimeSuccessor");
    },
  ];
  for (const mutate of mutations) {
    const receipt = structuredClone(built.runtimeReceipt);
    mutate(receipt);
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({ runtimeReceipt: receipt }),
      expectedError("RUNTIME_PROBE_MISMATCH"),
    );
  }
});

test("[tests] rejects skipped focused cases or removed compile-time negatives", async () => {
  for (const testPath of [APP_RUNTIME_TEST, APP_GUARD_TEST]) {
    const source = (await workspaceBytes(testPath)).toString("utf8");
    const skipped = source.replace(/\bit\(/u, "it.skip(");
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        trackedFileBytes: { [testPath]: Buffer.from(skipped) },
        runtimeReceipt: built.runtimeReceipt,
      }),
      expectedError("TEST_AUTHORITY_DRIFT"),
    );
  }

  const typePath = "apps/control-plane-api/test/bundle-verification.types.ts";
  const typeSource = (await workspaceBytes(typePath)).toString("utf8");
  const removed = typeSource.replace("// @ts-expect-error", "// negative removed");
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      trackedFileBytes: { [typePath]: Buffer.from(removed) },
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[filesystem] rejects symlinked artifact and proof-document authority", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t02-symlink-");
  const realArtifact = path.join(directory, "artifact.real.json");
  const artifactLink = path.join(directory, "artifact.json");
  const realProof = path.join(directory, "proof.real.md");
  const proofLink = path.join(directory, "proof.md");
  await writeFile(realArtifact, built.artifactBytes);
  await writeFile(realProof, proofDocument);
  await symlink(realArtifact, artifactLink);
  await symlink(realProof, proofLink);
  await assert.rejects(
    verifyControlPlaneBundleVerificationEvidence({
      artifactPath: artifactLink,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyControlPlaneBundleVerificationEvidence({
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
    verifyControlPlaneBundleVerificationEvidence({
      artifactPath: path.join(linkedParent, "artifact.json"),
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
});

test("[writer] atomically writes exact deterministic evidence bytes", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t02-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const result = await writeControlPlaneBundleVerificationEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  assert.ok(Object.isFrozen(result));
});

test("[writer] preserves the old destination and removes a tampered temporary", async () => {
  const directory = await makeTemporaryDirectory("desen-m07-t02-writer-tamper-");
  const artifactPath = path.join(directory, "artifact.json");
  const oldBytes = Buffer.from("old-authority\n");
  await writeFile(artifactPath, oldBytes);
  await assert.rejects(
    writeControlPlaneBundleVerificationEvidence({
      artifactPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, Buffer.from("tampered\n"));
      },
    }),
    expectedError("ARTIFACT_WRITE_FAILED"),
  );
  assert.deepEqual(await readFile(artifactPath), oldBytes);
});

test("[options] rejects unknown, accessor-backed, shared-memory, or hostile authority", async () => {
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({ unknown: true }),
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
    buildControlPlaneBundleVerificationEvidence(active),
    expectedError("INVALID_OPTIONS"),
  );
  const shared = new Uint8Array(new SharedArrayBuffer(1));
  await assert.rejects(
    verifyControlPlaneBundleVerificationEvidence({
      artifactBytes: shared,
      proofDocument,
      runtimeReceipt: built.runtimeReceipt,
    }),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence(new Proxy({}, {})),
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
  const verified = await verifyControlPlaneBundleVerificationEvidence({
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
  assert.ok(Object.isFrozen(built.artifact.trackedFiles));
  assert.ok(Object.isFrozen(built.artifact.distribution));
  assert.ok(
    built.artifact.nonclaims.some((claim) => claim.includes("M07-T03")),
    "package resolution must remain an explicit later-task nonclaim",
  );
  assert.ok(
    built.artifact.nonclaims.some((claim) => claim.includes("M07-T05")),
    "Source persistence and channels must remain explicit later-task nonclaims",
  );
  assert.ok(
    built.artifact.nonclaims.some((claim) => claim.includes("signatures")),
    "publication signatures must remain an explicit nonclaim",
  );
  assert.ok(
    built.artifact.nonclaims.some((claim) => claim.includes("activation")),
    "activation and LKG authority must remain explicit nonclaims",
  );
});
