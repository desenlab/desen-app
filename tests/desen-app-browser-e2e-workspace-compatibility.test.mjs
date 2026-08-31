import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import {
  DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN,
  DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN,
  DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES,
  DesenAppBrowserE2eWorkspaceCompatibilityProofError,
  buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
  verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
  verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy,
  writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
} from "../scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_DOCUMENT_PATH = path.join(
  ROOT,
  "docs/proof/DESEN-APP-BROWSER-E2E-WORKSPACE-COMPATIBILITY.md",
);
const temporaryDirectories = [];

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
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

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[0], async () => {
  const artifact = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact;
  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.proofId, "desen-app-browser-e2e-workspace-compatibility");
  assert.equal(artifact.profile, "desen.app.browser-e2e-workspace-compatibility-proof.v1");
  assert.equal(artifact.task, "M10-T01");
  assert.equal(artifact.compatibilityReceipt, "M10-T01-COMPAT");
  assert.equal(artifact.result, "PASS");
  assert.deepEqual(artifact.prerequisites, [
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN,
  ]);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[1], async () => {
  const source = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact.authority
    .source;
  assert.equal(source.explicitEmptyBootstrap, true);
  assert.equal(source.admittedBeforeExport, true);
  assert.equal(source.exactCatalogIdentity, "run.desen.reference.sign-in@0.1.0#web-react");
  assert.equal(source.initialNodes, 1);
  assert.equal(source.initialLocalStateEntries, 0);
  assert.equal(source.initialBindings, 0);
  assert.equal(source.initialEventsAndActions, 0);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[2], async () => {
  const artifact = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact;
  assert.equal(artifact.tests.browserTestDeclarations, 1);
  assert.equal(
    artifact.tests.browserTestName,
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  );
  assert.equal(artifact.claim.visualAuthoringCovered, true);
  assert.equal(artifact.claim.authoredDeletionCovered, true);
  assert.equal(artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[3], async () => {
  const artifact = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact;
  assert.equal(artifact.authority.source.nativeDragCalls, 2);
  assert.equal(artifact.claim.nativeComponentDragCovered, true);
  assert.equal(artifact.claim.nativeLayerDragCovered, true);
  assert.equal(artifact.claim.forgedDataTransferRejected, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[4], async () => {
  const artifact = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact;
  assert.equal(artifact.authority.source.persistencePortReal, true);
  assert.equal(artifact.authority.source.canonicalSavedSourceReadBack, true);
  assert.equal(artifact.authority.source.structuralReadmission, true);
  assert.equal(artifact.claim.exactSourceSavedAndReadBack, true);
  assert.equal(artifact.claim.savedSourceStructurallyAdmitted, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[5], async () => {
  const artifact = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact;
  assert.deepEqual(artifact.authority.source.frame, {
    preset: "portrait",
    width: 420,
    height: 720,
  });
  assert.equal(artifact.claim.designRunStaticParityCovered, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[6], async () => {
  const built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence();
  const packageAuthority = built.artifact.authority.package;
  assert.equal(built.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(packageAuthority.browserPackageName, "@desen/app-browser-e2e");
  assert.equal(packageAuthority.dedicatedWorkspaceOwnership, true);
  assert.equal(packageAuthority.playwrightVersion, "1.62.1");
  assert.equal(built.artifact.claim.dedicatedBoundaryPolicyCovered, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[7], async () => {
  const claim = (await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence()).artifact.claim;
  assert.equal(claim.p08Status, "PROVEN");
  assert.equal(claim.runtimeInputAndPendingCovered, false);
  assert.equal(claim.invalidCredentialsAndPublicFailureCovered, false);
  assert.equal(claim.successNavigationAndHostOperationCovered, false);
  assert.equal(claim.remoteDeploymentCovered, false);
  assert.equal(claim.g10Closed, false);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[8], async () => {
  const [first, second] = await Promise.all([
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(),
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(),
  ]);
  assert.equal(
    first.artifactBytes.byteLength,
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
  );
  assert.equal(
    first.artifactSha256,
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256,
  );
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(first.artifact.boundary.trackedReceipts.length, 32);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[9], async () => {
  const historical = await readFile(
    DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactBytes: changedByte(historical),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactBytes: historical.subarray(0, historical.byteLength - 1),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  for (const options of [
    { unknown: true },
    { workspaceRoot: ROOT },
    { fileOverrides: new Map() },
    { buildOptions: {} },
  ]) {
    await assert.rejects(
      buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.throws(
    () => verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy({}),
    expectedError("HISTORICAL_READER_ONLY"),
  );

  const directory = await temporaryDirectory("desen-compat-symlink-");
  const target = path.join(directory, "artifact-target.json");
  const alias = path.join(directory, "artifact.json");
  await writeFile(target, historical, { flag: "wx" });
  await symlink(target, alias);
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({ artifactPath: alias }),
    expectedError("ARTIFACT_UNSAFE"),
  );
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[10], async () => {
  const verified = await verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence();
  assert.equal(verified.result, "PASS");
  assert.equal(verified.compatibilityMode, "immutable-task-time-artifact");

  const report = await readFile(PROOF_DOCUMENT_PATH);
  await assert.rejects(
    verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      proofDocument: changedByte(report),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({ buildOptions: {} }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence({ buildOptions: {} }),
    expectedError("OPTIONS_INVALID"),
  );

  const directory = await temporaryDirectory("desen-compat-copy-");
  const copyPath = path.join(directory, "copy.json");
  const copied = await writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
    artifactPath: copyPath,
  });
  assert.equal(copied.preserved, false);
  assert.deepEqual(
    await readFile(copyPath),
    await readFile(DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH),
  );

  const interrupted = path.join(directory, "interrupted.json");
  await assert.rejects(
    writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactPath: interrupted,
      beforeAtomicRename() {
        throw new Error("interrupted before rename");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
