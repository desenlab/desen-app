import assert from "node:assert/strict";
import { link, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_EXPECTED_SUITE_RECEIPT,
  REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS,
  ReferenceHostWebChannelConsumptionEvidenceError,
  buildReferenceHostWebChannelConsumptionEvidence,
  summarizeReferenceHostWebChannelConsumptionSuiteFailure,
  verifyReferenceHostWebChannelConsumptionEvidence,
  writeReferenceHostWebChannelConsumptionEvidence,
} from "../scripts/lib/reference-host-web-channel-consumption-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json";
const SERVER_PACKAGE = "apps/reference-host-web-server/package.json";
const SERVER_CONTROLLER = "apps/reference-host-web-server/src/channel-activation-controller.ts";
const SERVER_INVENTORY = "apps/reference-host-web-server/src/installed-package-inventory.ts";
const SERVER_HTTP = "apps/reference-host-web-server/src/server.ts";
const SERVER_TEST = "apps/reference-host-web-server/test/server.test.ts";
const CLIENT_DELIVERY = "apps/reference-host-web/src/channel-delivery.ts";
const CLIENT_MAIN = "apps/reference-host-web/src/main.tsx";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const RECEIPT_ONLY_TRACKED_FILES = Object.freeze([
  "scripts/generate-reference-host-web-channel-consumption-proof.mjs",
  "scripts/verify-reference-host-web-channel-consumption.mjs",
  "scripts/lib/reference-host-web-channel-consumption-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
]);

let built;
const temporaryDirectories = [];

function suiteReceipt() {
  return structuredClone(REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_EXPECTED_SUITE_RECEIPT);
}

function expectedError(code) {
  return (error) =>
    error instanceof ReferenceHostWebChannelConsumptionEvidenceError && error.code === code;
}

function changedByte(bytes) {
  const copy = Uint8Array.from(bytes);
  if (copy.byteLength === 0) return Uint8Array.of(1);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nArtifact: \`${ARTIFACT}\`\n\nFinal receipt: \`sha256:${artifactSha256}\`\n`;
}

async function workspaceBytes(relativePath) {
  return readFile(path.join(ROOT, relativePath));
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function findTraceRow(value, predicate) {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findTraceRow(child, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  if (predicate(value)) return value;
  for (const child of Object.values(value)) {
    const found = findTraceRow(child, predicate);
    if (found !== undefined) return found;
  }
  return undefined;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  if (ArrayBuffer.isView(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

before(async () => {
  built = await buildReferenceHostWebChannelConsumptionEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] builds the exact M07-T11 separately built channel-consumption artifact", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "reference-host-web-channel-consumption");
  assert.equal(built.artifact.profile, "desen.reference-host-web.channel-consumption-proof.v1");
  assert.equal(built.artifact.task, "M07-T11");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.prerequisites.length, 13);
  assert.equal(built.artifact.claims.compositionBoundary.serverAndBrowserBuiltSeparately, true);
  assert.equal(built.artifact.claims.channelConsumption.realLoopbackBearerHttp, true);
  assert.equal(built.artifact.claims.channelConsumption.channelSnapshotIsDiscoveryOnly, true);
  assert.equal(
    built.artifact.claims.channelConsumption.exactBundleBytesEmbeddedWithoutReencoding,
    true,
  );
  assert.equal(
    built.artifact.claims.channelConsumption.exactControlPlaneAndHostMediaTypesRequired,
    true,
  );
  assert.deepEqual(built.artifact.claims.sequence.order, ["valid A", "invalid B", "valid C"]);
  assert.equal(built.artifact.claims.sequence.invalidBPreservesExactAResponseAndEtag, true);
  assert.equal(built.artifact.claims.lifecycle.restartRecoversBeforeDelivery, true);
  assert.equal(built.artifact.claims.lifecycle.staleRefreshCannotPublish, true);
  assert.equal(built.artifact.claims.lifecycle.lateRefreshAfterCloseCannotPublish, true);
  assert.equal(
    built.artifact.claims.browser.failedOrUnavailableRefreshPreservesLastKnownGoodSurface,
    true,
  );
  assert.equal(built.artifact.claims.browser.productionEntryRefreshAndLifecycleWiringTested, true);
  assert.equal(built.artifact.claims.browser.homeDeepLinkServesTheBuiltEntry, true);
  assert.equal(
    built.artifact.claims.installedPackageInventory.symbolicLinksAndSpecialFilesRejected,
    true,
  );
  assert.equal(built.artifact.claims.installedPackageInventory.hardLinksRejected, true);
  assert.equal(built.artifact.claims.traceRows[0].id, "PIPE-009");
  assert.equal(built.artifact.tests.runtimeCaseCount, 9);
  assert.equal(built.artifact.tests.runtimeTestCount, 46);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("POST /api/sign-in backend")));
  assert.equal(built.artifact.tests.rootMutationCaseCount, 13);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[determinism] two independent evidence builds are byte-identical", async () => {
  const second = await buildReferenceHostWebChannelConsumptionEvidence({
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.runtimeSuiteReceipt, built.runtimeSuiteReceipt);
});

test("[prerequisites] rejects drift in every immutable M05 and M07 artifact", async () => {
  for (const prerequisite of REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        prerequisiteBytes: {
          [prerequisite.path]: changedByte(await workspaceBytes(prerequisite.path)),
        },
        runtimeSuiteReceipt: suiteReceipt(),
      }),
      expectedError("PREREQUISITE_DRIFT"),
    );
  }
});

test("[runtime] rejects missing, duplicate, failed, and additional case identities", async () => {
  const variants = [];
  const missing = suiteReceipt();
  missing.caseIds.pop();
  missing.caseCount -= 1;
  variants.push(missing);
  const duplicate = suiteReceipt();
  duplicate.caseIds[1] = duplicate.caseIds[0];
  variants.push(duplicate);
  const failed = suiteReceipt();
  failed.status = "FAIL";
  variants.push(failed);
  const additional = suiteReceipt();
  additional.caseIds.push("unexpected-case");
  additional.caseCount += 1;
  variants.push(additional);
  for (const receipt of variants) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({ runtimeSuiteReceipt: receipt }),
      (error) => error instanceof ReferenceHostWebChannelConsumptionEvidenceError,
    );
  }

  const secretPath = "/private/diagnostic-path-must-not-escape";
  const failure = summarizeReferenceHostWebChannelConsumptionSuiteFailure({
    code: 1,
    stderr: `permission denied ${secretPath}`,
    stdout: JSON.stringify({
      numFailedTestSuites: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            {
              status: "failed",
              title: `[valid-a-activation-delivery] controlled failure ${secretPath}`,
            },
          ],
        },
      ],
    }),
  });
  assert.equal(failure.category, "ACCESS_DENIED");
  assert.deepEqual(failure.failedCaseIds, ["valid-a-activation-delivery"]);
  assert.equal(JSON.stringify(failure).includes(secretPath), false);

  const serverTest = (await workspaceBytes(SERVER_TEST)).toString("utf8");
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [SERVER_TEST]: Buffer.from(
          serverTest.replace(
            "serves the exact active envelope and keeps server authorities out of the response",
            "serves an active envelope",
          ),
        ),
      },
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );
});

test("[server-boundary] rejects private imports and weakened static or CSP guards", async () => {
  const packageManifest = JSON.parse((await workspaceBytes(SERVER_PACKAGE)).toString("utf8"));
  packageManifest.dependencies["@desen/desen-app"] = "workspace:*";
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [SERVER_PACKAGE]: Buffer.from(`${JSON.stringify(packageManifest, null, 2)}\n`),
      },
    }),
    expectedError("DEPENDENCY_BOUNDARY_DRIFT"),
  );

  const controller = await workspaceBytes(SERVER_CONTROLLER);
  for (const injected of [
    "@desen/control-plane-api/src/runtime-activation-internal.js",
    "arbitrary-server-package",
    "../../control-plane-api/src/runtime-activation-sqlite-internal.js",
  ]) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: {
          [SERVER_CONTROLLER]: Buffer.concat([Buffer.from(`import "${injected}";\n`), controller]),
        },
      }),
      expectedError("SERVER_BOUNDARY_DRIFT"),
    );
  }

  const server = (await workspaceBytes(SERVER_HTTP)).toString("utf8");
  for (const signal of [
    "MAX_STATIC_DIRECTORIES",
    "MAX_STATIC_ENTRIES",
    "opendir(directory, { bufferSize: 32 })",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "script-src 'self'",
  ]) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: {
          [SERVER_HTTP]: Buffer.from(server.replaceAll(signal, "REMOVED_SERVER_GUARD")),
        },
      }),
      expectedError("SERVER_BOUNDARY_DRIFT"),
    );
  }
});

test("[client-boundary] rejects control-plane, secret, editor, testkit, and manual-tree authority", async () => {
  const delivery = await workspaceBytes(CLIENT_DELIVERY);
  for (const mutation of [
    Buffer.concat([Buffer.from('import "@desen/control-plane-api";\n'), delivery]),
    Buffer.concat([Buffer.from('import "arbitrary-browser-package";\n'), delivery]),
    Buffer.concat([Buffer.from('import "../../control-plane-api/src/private.js";\n'), delivery]),
    Buffer.concat([Buffer.from("const lazy = import(channelSelectedModule);\n"), delivery]),
    Buffer.concat([delivery, Buffer.from("\nconst forbiddenManualTree = <Injected />;\n")]),
  ]) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [CLIENT_DELIVERY]: mutation },
      }),
      expectedError("CLIENT_GRAPH_DRIFT"),
    );
  }
  const main = (await workspaceBytes(CLIENT_MAIN)).toString("utf8");
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: {
        [CLIENT_MAIN]: Buffer.from(
          main.replaceAll(
            "void refreshReferenceHostChannel(channelDelivery);",
            "void channelDelivery;",
          ),
        ),
      },
    }),
    expectedError("CLIENT_GRAPH_DRIFT"),
  );
});

test("[inventory] rejects weakened bounded and symlink-safe package inventory guards", async () => {
  const inventory = (await workspaceBytes(SERVER_INVENTORY)).toString("utf8");
  assert.match(inventory, /realpath/gu);
  for (const signal of [
    "realpath",
    "opendir(directory, { bufferSize: 32 })",
    "MAX_PACKAGE_ENTRIES",
    "entryCount += 1;",
  ]) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: {
          [SERVER_INVENTORY]: Buffer.from(inventory.replaceAll(signal, "REMOVED_INVENTORY_GUARD")),
        },
      }),
      expectedError("INVENTORY_GUARD_DRIFT"),
    );
  }
});

test("[traceability] accepts only the exact PIPE-009 assignment", async () => {
  const original = JSON.parse((await workspaceBytes(TRACEABILITY)).toString("utf8"));
  const missing = structuredClone(original);
  const pipe009 = findTraceRow(missing, (row) => row.id === "PIPE-009");
  assert.notEqual(pipe009, undefined);
  pipe009.owners = pipe009.owners.filter((task) => task !== "M07-T11");
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(missing)) },
    }),
    expectedError("TRACE_DRIFT"),
  );

  const extra = structuredClone(original);
  const unassigned = findTraceRow(
    extra,
    (row) =>
      typeof row.id === "string" &&
      Array.isArray(row.tests) &&
      !row.tests.includes("M07-T11") &&
      !row.owners?.includes?.("M07-T11"),
  );
  assert.notEqual(unassigned, undefined);
  unassigned.tests.push("M07-T11");
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence({
      runtimeSuiteReceipt: suiteReceipt(),
      trackedFileBytes: { [TRACEABILITY]: Buffer.from(JSON.stringify(extra)) },
    }),
    expectedError("TRACE_DRIFT"),
  );
});

test("[artifact] verifies exact bytes and rejects one changed byte", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const receipt = await verifyReferenceHostWebChannelConsumptionEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(receipt.result, "PASS");
  assert.equal(receipt.runtimeCases, 9);
  assert.equal(receipt.rootMutationCases, 13);
  assert.equal(receipt.prerequisiteArtifacts, 13);
  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
});

test("[writer] atomically writes evidence and preserves the destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m07-t11-writer-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeReferenceHostWebChannelConsumptionEvidence({
    artifactPath,
    runtimeSuiteReceipt: suiteReceipt(),
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = Buffer.from("preserve-existing-destination\n");
  await writeFile(artifactPath, sentinel);
  await assert.rejects(
    writeReferenceHostWebChannelConsumptionEvidence({
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
    buildReferenceHostWebChannelConsumptionEvidence({
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
    buildReferenceHostWebChannelConsumptionEvidence(accessor),
    expectedError("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence(new Proxy({}, {})),
    expectedError("INVALID_OPTIONS"),
  );
  const cyclic = {};
  cyclic.trackedFileBytes = cyclic;
  await assert.rejects(
    buildReferenceHostWebChannelConsumptionEvidence(cyclic),
    expectedError("INVALID_OPTIONS"),
  );
  if (typeof SharedArrayBuffer === "function") {
    const shared = new Uint8Array(new SharedArrayBuffer(8));
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        prerequisiteBytes: {
          [REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS[0].path]: shared,
        },
        runtimeSuiteReceipt: suiteReceipt(),
      }),
      expectedError("INVALID_OPTIONS"),
    );
  }
  for (const relativePath of RECEIPT_ONLY_TRACKED_FILES) {
    await assert.rejects(
      buildReferenceHostWebChannelConsumptionEvidence({
        runtimeSuiteReceipt: suiteReceipt(),
        trackedFileBytes: { [relativePath]: Buffer.from("forged receipt-only authority\n") },
      }),
      expectedError("INVALID_OPTIONS"),
    );
  }
});

test("[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority", async () => {
  const directory = await temporaryDirectory("desen-m07-t11-authority-");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  const artifactHardLink = path.join(directory, "artifact-hard-link.json");
  const proofHardLink = path.join(directory, "proof-hard-link.md");
  const invalidProof = path.join(directory, "invalid-proof.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await writeFile(invalidProof, Uint8Array.of(0xff));
  await symlink(artifactTarget, artifactLink);
  await symlink(proofTarget, proofLink);
  await link(artifactTarget, artifactHardLink);
  await link(proofTarget, proofHardLink);

  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactPath: artifactHardLink,
      proofDocumentPath: proofTarget,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofHardLink,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofLink,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("UNSAFE_AUTHORITY"),
  );
  await assert.rejects(
    verifyReferenceHostWebChannelConsumptionEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: invalidProof,
      runtimeSuiteReceipt: suiteReceipt(),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[immutability] recursively freezes the graph and preserves later-scope nonclaims", () => {
  assertDeepFrozen(built);
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("P-12")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("N-041")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.startsWith("G07")));
  assert.ok(built.artifact.nonclaims.some((claim) => claim.includes("Android")));
  assert.equal(built.artifact.claims.coverageTruth.proofMatrixP12, "NOT_PROVEN");
  assert.equal(built.artifact.claims.coverageTruth.normativeN041, "PLANNED");
  assert.equal(built.artifact.claims.coverageTruth.gateG07, "OPEN_PENDING_I07_04");
});
