import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
  DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN,
  DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN,
  DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES,
  DesenAppEmptyProjectBrowserE2eProofError,
  buildDesenAppEmptyProjectBrowserE2eEvidence,
  verifyDesenAppEmptyProjectBrowserE2eEvidence,
  writeDesenAppEmptyProjectBrowserE2eEvidence,
} from "../scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_DOCUMENT_PATH = path.join(ROOT, "docs/proof/DESEN-APP-EMPTY-PROJECT-BROWSER-E2E.md");
const PROOF_DOCUMENT_BYTES = 3_338;
const PROOF_DOCUMENT_SHA256 = "e48cd45ae61700754b4d71f5bbd2b9f3a84dc0cb224f551e4af0bee79080244f";
const temporaryDirectories = [];

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppEmptyProjectBrowserE2eProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactLengthText(text, byteLength) {
  const bytes = Buffer.from(text);
  assert.ok(bytes.byteLength <= byteLength);
  return Buffer.concat([bytes, Buffer.alloc(byteLength - bytes.byteLength, 0x20)]);
}

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[0], async () => {
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence();
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-empty-project-browser-e2e");
  assert.equal(built.artifact.profile, "desen.app.empty-project-browser-e2e-proof.v1");
  assert.equal(built.artifact.task, "M10-T01");
  assert.equal(built.artifact.gate, null);
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN]);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[1], async () => {
  const source = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact.authority.source;
  assert.equal(source.explicitEmptyBootstrap, true);
  assert.equal(source.admittedBeforeExport, true);
  assert.equal(source.exactCatalogIdentity, "run.desen.reference.sign-in@0.1.0#web-react");
  assert.equal(source.initialNodes, 1);
  assert.equal(source.initialLocalStateEntries, 0);
  assert.equal(source.initialBindings, 0);
  assert.equal(source.initialEventsAndActions, 0);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[2], async () => {
  const artifact = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact;
  assert.equal(artifact.tests.browserTestDeclarations, 1);
  assert.equal(
    artifact.tests.browserTestName,
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  );
  assert.equal(artifact.claim.visualAuthoringCovered, true);
  assert.equal(artifact.claim.authoredDeletionCovered, true);
  assert.equal(artifact.tests.browserExecutedByVerifier, false);
  assert.equal(artifact.authority.execution.browserRerunOwnedByProofReader, false);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[3], async () => {
  const artifact = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact;
  assert.equal(artifact.authority.source.nativeDragCalls, 2);
  assert.equal(artifact.claim.nativeComponentDragCovered, true);
  assert.equal(artifact.claim.nativeLayerDragCovered, true);
  assert.equal(artifact.claim.forgedDataTransferRejected, true);
  assert.match(artifact.authority.execution.nativeGestureAuthority, /locator\.dragTo/u);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[4], async () => {
  const artifact = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact;
  assert.equal(artifact.authority.source.persistencePortReal, true);
  assert.equal(artifact.authority.source.canonicalSavedSourceReadBack, true);
  assert.equal(artifact.authority.source.structuralReadmission, true);
  assert.equal(artifact.claim.exactSourceSavedAndReadBack, true);
  assert.equal(artifact.claim.savedSourceStructurallyAdmitted, true);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[5], async () => {
  const artifact = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact;
  assert.equal(artifact.authority.source.designRunStaticParity, true);
  assert.deepEqual(artifact.authority.source.frame, {
    preset: "portrait",
    width: 420,
    height: 720,
  });
  assert.equal(artifact.claim.designRunStaticParityCovered, true);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[6], async () => {
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence();
  const artifact = built.artifact;
  assert.equal(built.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(artifact.authority.package.playwrightPackage, "@playwright/test");
  assert.equal(artifact.authority.package.playwrightVersion, "1.62.1");
  assert.deepEqual(artifact.tests.configuredProjects, ["chromium"]);
  assert.equal(artifact.tests.workers, 1);
  assert.equal(artifact.tests.retries, 0);
  assert.equal(artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[7], async () => {
  const claim = (await buildDesenAppEmptyProjectBrowserE2eEvidence()).artifact.claim;
  assert.equal(claim.p08Status, "PROVEN");
  assert.equal(claim.runtimeInputAndPendingCovered, false);
  assert.equal(claim.invalidCredentialsAndPublicFailureCovered, false);
  assert.equal(claim.successNavigationAndHostOperationCovered, false);
  assert.equal(claim.remoteDeploymentCovered, false);
  assert.equal(claim.g10Closed, false);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[8], async () => {
  const [first, second] = await Promise.all([
    buildDesenAppEmptyProjectBrowserE2eEvidence(),
    buildDesenAppEmptyProjectBrowserE2eEvidence(),
  ]);
  assert.equal(
    first.artifactBytes.byteLength,
    DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
  );
  assert.equal(first.artifactSha256, DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.sha256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.boundary.trackedReceipts), true);
  assert.equal(Object.isFrozen(first.artifact.boundary.trackedReceipts[0]), true);

  const receipts = first.artifact.boundary.trackedReceipts;
  const paths = receipts.map(({ path: relativePath }) => relativePath);
  assert.equal(receipts.length, first.artifact.boundary.trackedFiles);
  assert.equal(new Set(paths).size, receipts.length);
  assert.deepEqual(
    paths,
    paths.toSorted((left, right) => left.localeCompare(right, "en-US")),
  );
  assert.deepEqual(
    receipts.find(
      ({ path: relativePath }) =>
        relativePath === "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
    ),
    {
      path: "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
      bytes: 32_299,
      sha256: "4e6028de6295368ca28ee78c16224e8f1fc5d0cd47c22ab7e444ed98e80e0993",
    },
  );
  assert.deepEqual(
    receipts.find(
      ({ path: relativePath }) =>
        relativePath === "tests/desen-app-empty-project-browser-e2e.test.mjs",
    ),
    {
      path: "tests/desen-app-empty-project-browser-e2e.test.mjs",
      bytes: 10_946,
      sha256: "700f250e90848eb9eace69a4472de0afbe06690e3bc9aec982d1d0e54431b296",
    },
  );
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[9], async () => {
  const historical = await readFile(DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH);
  const schemaMutation = Buffer.from(
    historical.toString("utf8").replace('"schemaVersion": 1', '"schemaVersion": 2'),
  );
  const claimMutation = Buffer.from(
    historical.toString("utf8").replace('"p08Status": "PROVEN"', '"p08Status": "BROKEN"'),
  );
  const receiptMutation = Buffer.from(
    historical
      .toString("utf8")
      .replace(
        "1f13768de1b0c0e05eba68263b7457c16d66ce2c491134b4118661031f9cb808",
        "0f13768de1b0c0e05eba68263b7457c16d66ce2c491134b4118661031f9cb808",
      ),
  );
  const duplicateJson = exactLengthText(
    '{"schemaVersion":1,"schemaVersion":1}',
    DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
  );
  const malformedJson = Buffer.alloc(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes, 0x7b);
  for (const artifactBytes of [
    changedByte(historical),
    historical.subarray(0, historical.byteLength - 1),
    schemaMutation,
    claimMutation,
    receiptMutation,
    duplicateJson,
    malformedJson,
  ]) {
    await assert.rejects(
      buildDesenAppEmptyProjectBrowserE2eEvidence({ artifactBytes }),
      expectedError("ARTIFACT_DRIFT"),
    );
  }

  for (const options of [
    { unknown: true },
    { workspaceRoot: ROOT },
    { fileOverrides: new Map() },
    { buildOptions: {} },
    { runtimeApi: {} },
  ]) {
    await assert.rejects(
      buildDesenAppEmptyProjectBrowserE2eEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    verifyDesenAppEmptyProjectBrowserE2eEvidence({ buildOptions: {} }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeDesenAppEmptyProjectBrowserE2eEvidence({ buildOptions: {} }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({
      artifactPath: DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
      artifactBytes: historical,
    }),
    expectedError("OPTIONS_INVALID"),
  );

  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const options of [
    accessor,
    Object.create({ artifactPath: "ignored" }),
    Object.defineProperty({}, "artifactPath", { value: "ignored" }),
    { [Symbol("artifactPath")]: "ignored" },
    proxy,
    revoked.proxy,
  ]) {
    await assert.rejects(
      buildDesenAppEmptyProjectBrowserE2eEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);

  class BytesSubclass extends Uint8Array {}
  const hostileBytes = [
    "not bytes",
    new Proxy(new Uint8Array(historical), {}),
    new BytesSubclass(historical),
  ];
  if (typeof SharedArrayBuffer === "function") {
    hostileBytes.push(new Uint8Array(new SharedArrayBuffer(historical.byteLength)));
  }
  for (const artifactBytes of hostileBytes) {
    await assert.rejects(
      buildDesenAppEmptyProjectBrowserE2eEvidence({ artifactBytes }),
      expectedError("OPTIONS_INVALID"),
    );
  }
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[10], async () => {
  const [historical, proofDocument] = await Promise.all([
    readFile(DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH),
    readFile(PROOF_DOCUMENT_PATH),
  ]);
  const verified = await verifyDesenAppEmptyProjectBrowserE2eEvidence({
    artifactBytes: new Uint8Array(historical),
    proofDocument: new Uint8Array(proofDocument),
  });
  assert.equal(verified.artifactBytes, 10_259);
  assert.equal(verified.artifactSha256, DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.sha256);
  assert.equal(verified.proofDocumentBytes, PROOF_DOCUMENT_BYTES);
  assert.equal(verified.proofDocumentSha256, PROOF_DOCUMENT_SHA256);
  assert.equal(verified.browserExecutedByVerifier, false);

  const duplicateReport = Buffer.from(proofDocument);
  const duplicateMarker = Buffer.from(
    `\nFinal artifact: \`sha256:${DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.sha256}\`\n`,
  );
  duplicateMarker.copy(duplicateReport, duplicateReport.byteLength - duplicateMarker.byteLength);
  const malformedReport = Buffer.from(proofDocument);
  malformedReport[Math.floor(malformedReport.byteLength / 2)] = 0xff;
  for (const candidate of [
    changedByte(proofDocument),
    proofDocument.subarray(0, proofDocument.byteLength - 1),
    duplicateReport,
    malformedReport,
  ]) {
    await assert.rejects(
      verifyDesenAppEmptyProjectBrowserE2eEvidence({
        artifactBytes: historical,
        proofDocument: candidate,
      }),
      expectedError("PROOF_DOCUMENT_DRIFT"),
    );
  }
  await assert.rejects(
    verifyDesenAppEmptyProjectBrowserE2eEvidence({
      proofDocumentPath: PROOF_DOCUMENT_PATH,
      proofDocument,
    }),
    expectedError("OPTIONS_INVALID"),
  );

  const directory = await temporaryDirectory("desen-m10-t01-reader-");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const reportTarget = path.join(directory, "report-target.md");
  const artifactLink = path.join(directory, "artifact-link.json");
  const reportLink = path.join(directory, "report-link.md");
  const destinationLink = path.join(directory, "destination-link.json");
  await Promise.all([
    writeFile(artifactTarget, historical),
    writeFile(reportTarget, proofDocument),
  ]);
  await Promise.all([
    symlink(artifactTarget, artifactLink),
    symlink(reportTarget, reportLink),
    symlink(path.join(directory, "missing-target.json"), destinationLink),
  ]);
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({ artifactPath: artifactLink }),
    expectedError("ARTIFACT_UNSAFE"),
  );
  await assert.rejects(
    verifyDesenAppEmptyProjectBrowserE2eEvidence({ proofDocumentPath: reportLink }),
    expectedError("PROOF_DOCUMENT_UNSAFE"),
  );
  await assert.rejects(
    writeDesenAppEmptyProjectBrowserE2eEvidence({ artifactPath: destinationLink }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const before = await stat(DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH);
  const preserved = await writeDesenAppEmptyProjectBrowserE2eEvidence();
  const after = await stat(DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH);
  assert.equal(preserved.preserved, true);
  assert.equal(before.ino, after.ino);
  assert.equal(before.mtimeMs, after.mtimeMs);

  const copiedPath = path.join(directory, "copied.json");
  const copied = await writeDesenAppEmptyProjectBrowserE2eEvidence({ artifactPath: copiedPath });
  assert.equal(copied.preserved, false);
  assert.deepEqual(await readFile(copiedPath), historical);

  const protectedPath = path.join(directory, "protected.json");
  const protectedBytes = Buffer.from("preserve-me");
  await writeFile(protectedPath, protectedBytes);
  await assert.rejects(
    writeDesenAppEmptyProjectBrowserE2eEvidence({
      artifactPath: protectedPath,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(protectedPath), protectedBytes);
});
