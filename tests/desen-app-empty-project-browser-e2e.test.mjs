import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN,
  DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES,
  DesenAppEmptyProjectBrowserE2eProofError,
  buildDesenAppEmptyProjectBrowserE2eEvidence,
  verifyDesenAppEmptyProjectBrowserE2eEvidence,
  verifyDesenAppEmptyProjectBrowserE2eSourcePolicy,
  writeDesenAppEmptyProjectBrowserE2eEvidence,
} from "../scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  applicationTest: "apps/desen-app/test/application.test.tsx",
  browserSpec: "apps/desen-app/e2e/empty-project-to-sign-in.pw.ts",
  proofApplication: "apps/desen-app/e2e/proof-application.tsx",
  playwrightConfig: "apps/desen-app/e2e/playwright.config.ts",
  viteConfig: "apps/desen-app/e2e/vite.config.ts",
  e2eTsconfig: "apps/desen-app/e2e/tsconfig.json",
  e2eHtml: "apps/desen-app/e2e/index.html",
});
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const temporaryDirectories = [];
let sourcePolicyInput;
let packageBytes;
let built;

function expectedError(code) {
  return (error) =>
    error instanceof DesenAppEmptyProjectBrowserE2eProofError && error.code === code;
}

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, `Missing mutation marker ${search}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App empty-project browser E2E",
      "",
      "Task: M10-T01",
      "",
      "Status: DONE",
      "",
      "P-08: PROVEN",
      "",
      "T02+: NOT_PROVEN",
      "",
      `Final artifact: \`sha256:${artifactSha256}\``,
      "",
    ].join("\n"),
  );
}

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  sourcePolicyInput = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  packageBytes = new Map(
    await Promise.all(
      [ROOT_PACKAGE_PATH, APP_PACKAGE_PATH, LOCKFILE_PATH].map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  built = await buildDesenAppEmptyProjectBrowserE2eEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-empty-project-browser-e2e");
  assert.equal(built.artifact.profile, "desen.app.empty-project-browser-e2e-proof.v1");
  assert.equal(built.artifact.task, "M10-T01");
  assert.equal(built.artifact.gate, null);
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN]);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppEmptyProjectBrowserE2eSourcePolicy(sourcePolicyInput);
  assert.equal(source.explicitEmptyBootstrap, true);
  assert.equal(source.admittedBeforeExport, true);
  assert.equal(source.exactCatalogIdentity, "run.desen.reference.sign-in@0.1.0#web-react");
  assert.equal(source.initialNodes, 1);
  assert.equal(source.initialLocalStateEntries, 0);
  assert.equal(source.initialBindings, 0);
  assert.equal(source.initialEventsAndActions, 0);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.tests.browserTestDeclarations, 1);
  assert.equal(
    built.artifact.tests.browserTestName,
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  );
  assert.equal(built.artifact.claim.beginsFromExplicitlyEmptySource, true);
  assert.equal(built.artifact.claim.visualAuthoringCovered, true);
  assert.equal(built.artifact.claim.authoredDeletionCovered, true);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[3], () => {
  assert.equal(built.artifact.authority.source.nativeDragCalls, 2);
  assert.equal(built.artifact.claim.nativeComponentDragCovered, true);
  assert.equal(built.artifact.claim.nativeLayerDragCovered, true);
  assert.equal(built.artifact.claim.forgedDataTransferRejected, true);
  assert.match(built.artifact.authority.execution.nativeGestureAuthority, /locator\.dragTo/u);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.authority.source.persistencePortReal, true);
  assert.equal(built.artifact.authority.source.canonicalSavedSourceReadBack, true);
  assert.equal(built.artifact.authority.source.structuralReadmission, true);
  assert.equal(built.artifact.claim.exactSourceSavedAndReadBack, true);
  assert.equal(built.artifact.claim.savedSourceStructurallyAdmitted, true);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[5], () => {
  assert.equal(built.artifact.authority.source.designRunStaticParity, true);
  assert.deepEqual(built.artifact.authority.source.frame, {
    preset: "portrait",
    width: 420,
    height: 720,
  });
  assert.equal(built.artifact.claim.designRunStaticParityCovered, true);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.authority.package.playwrightPackage, "@playwright/test");
  assert.equal(built.artifact.authority.package.playwrightVersion, "1.62.1");
  assert.deepEqual(built.artifact.tests.configuredProjects, ["chromium"]);
  assert.equal(built.artifact.tests.workers, 1);
  assert.equal(built.artifact.tests.retries, 0);
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.claim.p08Status, "PROVEN");
  assert.equal(built.artifact.claim.runtimeInputAndPendingCovered, false);
  assert.equal(built.artifact.claim.invalidCredentialsAndPublicFailureCovered, false);
  assert.equal(built.artifact.claim.successNavigationAndHostOperationCovered, false);
  assert.equal(built.artifact.claim.remoteDeploymentCovered, false);
  assert.equal(built.artifact.claim.g10Closed, false);
  assert.equal(built.artifact.nonclaims.length, 7);
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppEmptyProjectBrowserE2eEvidence();
  assert.deepEqual(second.artifact, built.artifact);
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.equal(
    built.artifact.boundary.trackedReceipts.length,
    built.artifact.boundary.trackedFiles,
  );
  assert.deepEqual(
    built.artifact.boundary.trackedReceipts.map(({ path: relativePath }) => relativePath),
    built.artifact.boundary.trackedReceipts
      .map(({ path: relativePath }) => relativePath)
      .toSorted((left, right) => left.localeCompare(right, "en-US")),
  );
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[9], async () => {
  assert.throws(
    () =>
      verifyDesenAppEmptyProjectBrowserE2eSourcePolicy({
        ...sourcePolicyInput,
        browserSpec: replaceOnce(
          sourcePolicyInput.browserSpec,
          'componentDragHandle(page, "Text").dragTo(placementTarget(page))',
          'componentDragHandle(page, "Text").click()',
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppEmptyProjectBrowserE2eSourcePolicy({
        ...sourcePolicyInput,
        emptyProject: replaceOnce(
          sourcePolicyInput.emptyProject,
          "resources: Object.freeze({}),",
          "resources: Object.freeze({}), slots: Object.freeze({}),",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const rootPackage = JSON.parse(packageBytes.get(ROOT_PACKAGE_PATH).toString("utf8"));
  rootPackage.devDependencies["@playwright/test"] = "^1.62.1";
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({
      fileOverrides: new Map([
        [ROOT_PACKAGE_PATH, Buffer.from(`${JSON.stringify(rootPackage, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({
      fileOverrides: new Map([[LOCKFILE_PATH, Buffer.from("lockfileVersion: '9.0'\n")]]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({
      fileOverrides: new Map([
        [DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN.path, Buffer.from("{}\n")],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
});

test(DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES[10], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppEmptyProjectBrowserE2eEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.p08Status, "PROVEN");
  await assert.rejects(
    verifyDesenAppEmptyProjectBrowserE2eEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppEmptyProjectBrowserE2eEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Task: M10-T01\nStatus: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppEmptyProjectBrowserE2eEvidence({ unknown: true }),
    expectedError("OPTIONS_INVALID"),
  );

  const directory = await temporaryDirectory("desen-m10-t01-writer-");
  const target = path.join(directory, "artifact.json");
  const linkedTarget = path.join(directory, "linked.json");
  await symlink(target, linkedTarget);
  await assert.rejects(
    writeDesenAppEmptyProjectBrowserE2eEvidence({ artifactPath: linkedTarget }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
