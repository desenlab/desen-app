import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN,
  DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES,
  DesenAppBrowserE2eWorkspaceCompatibilityProofError,
  buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
  verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
  verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy,
  writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence,
} from "../scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  applicationTest: "apps/desen-app/test/application.test.tsx",
  browserSpec: "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  proofApplication: "apps/desen-app-browser-e2e/proof-application.tsx",
  playwrightConfig: "apps/desen-app-browser-e2e/playwright.config.ts",
  viteConfig: "apps/desen-app-browser-e2e/vite.config.ts",
  e2eTsconfig: "apps/desen-app-browser-e2e/tsconfig.json",
  e2eHtml: "apps/desen-app-browser-e2e/index.html",
});
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const BROWSER_PACKAGE_PATH = "apps/desen-app-browser-e2e/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const BOUNDARY_PATHS = Object.freeze({
  configuration: "dependency-cruiser.config.cjs",
  fixtureVerifier: "scripts/verify-boundary-fixtures.mjs",
  documentation: "tests/boundaries/README.md",
  allowedFixture:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
  allowedApplicationStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/application.tsx",
  allowedEmptyProjectStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-empty-project.ts",
  allowedStylesStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/styles.css",
  allowedEditorCoreStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/packages/editor-core/src/index.ts",
  forbiddenPackageFixture:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/apps/desen-app-browser-e2e/proof-application.ts",
  forbiddenPublisherStub:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/packages/publisher/src/index.ts",
  forbiddenAppSourceFixture:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app-browser-e2e/proof-application.ts",
  forbiddenAppMainStub:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app/src/main.ts",
});
const temporaryDirectories = [];
let sourcePolicyInput;
let packageBytes;
let built;

function expectedError(code) {
  return (error) =>
    error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError && error.code === code;
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

function insertAtBrowserTestStart(source, insertion) {
  const declaration = source.indexOf(
    'test("authors and saves a valid sign-in Source from the empty project in a real browser"',
  );
  assert.notEqual(declaration, -1, "Missing browser test declaration");
  const body = source.indexOf("}) => {", declaration);
  assert.notEqual(body, -1, "Missing browser test callback body");
  const insertionPoint = body + "}) => {".length;
  return `${source.slice(0, insertionPoint)}\n  ${insertion}${source.slice(insertionPoint)}`;
}

function conditionalizeBrowserTest(source, condition) {
  const guarded = insertAtBrowserTestStart(source, `if (${condition}) {`);
  const end = guarded.lastIndexOf("});");
  assert.notEqual(end, -1, "Missing browser test callback end");
  return `${guarded.slice(0, end)}  }\n${guarded.slice(end)}`;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App browser E2E workspace compatibility",
      "",
      "Task: M10-T01",
      "",
      "Compatibility receipt: M10-T01-COMPAT",
      "",
      "Status: DONE",
      "",
      "P-08: PROVEN",
      "",
      "T02+: NOT_PROVEN",
      "",
      `Historical artifact: \`sha256:${DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN.sha256}\``,
      "",
      `Compatibility artifact: \`sha256:${artifactSha256}\``,
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
      [
        ROOT_PACKAGE_PATH,
        APP_PACKAGE_PATH,
        BROWSER_PACKAGE_PATH,
        LOCKFILE_PATH,
        WORKFLOW_PATH,
        ...Object.values(BOUNDARY_PATHS),
      ].map(async (relativePath) => [relativePath, await readFile(path.join(ROOT, relativePath))]),
    ),
  );
  built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-browser-e2e-workspace-compatibility");
  assert.equal(built.artifact.profile, "desen.app.browser-e2e-workspace-compatibility-proof.v1");
  assert.equal(built.artifact.task, "M10-T01");
  assert.equal(built.artifact.compatibilityReceipt, "M10-T01-COMPAT");
  assert.equal(built.artifact.gate, null);
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN,
  ]);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy(sourcePolicyInput);
  assert.equal(source.explicitEmptyBootstrap, true);
  assert.equal(source.admittedBeforeExport, true);
  assert.equal(source.exactCatalogIdentity, "run.desen.reference.sign-in@0.1.0#web-react");
  assert.equal(source.initialNodes, 1);
  assert.equal(source.initialLocalStateEntries, 0);
  assert.equal(source.initialBindings, 0);
  assert.equal(source.initialEventsAndActions, 0);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.tests.browserTestDeclarations, 1);
  assert.deepEqual(built.artifact.authority.source.browserSpecReceipt, {
    path: SOURCE_PATHS.browserSpec,
    bytes: 12_756,
    sha256: "662b617e335d9ff2e5c15f8cd43b03ca2b4a5dca0a471f8f053334fa5c57a0b0",
  });
  assert.equal(
    built.artifact.tests.browserTestName,
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  );
  assert.equal(built.artifact.claim.beginsFromExplicitlyEmptySource, true);
  assert.equal(built.artifact.claim.visualAuthoringCovered, true);
  assert.equal(built.artifact.claim.authoredDeletionCovered, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[3], () => {
  assert.equal(built.artifact.authority.source.nativeDragCalls, 2);
  assert.equal(built.artifact.claim.nativeComponentDragCovered, true);
  assert.equal(built.artifact.claim.nativeLayerDragCovered, true);
  assert.equal(built.artifact.claim.forgedDataTransferRejected, true);
  assert.match(built.artifact.authority.execution.nativeGestureAuthority, /locator\.dragTo/u);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.authority.source.persistencePortReal, true);
  assert.equal(built.artifact.authority.source.canonicalSavedSourceReadBack, true);
  assert.equal(built.artifact.authority.source.structuralReadmission, true);
  assert.equal(built.artifact.claim.exactSourceSavedAndReadBack, true);
  assert.equal(built.artifact.claim.savedSourceStructurallyAdmitted, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[5], () => {
  assert.equal(built.artifact.authority.source.designRunStaticParity, true);
  assert.deepEqual(built.artifact.authority.source.frame, {
    preset: "portrait",
    width: 420,
    height: 720,
  });
  assert.equal(built.artifact.claim.designRunStaticParityCovered, true);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.authority.package.browserPackageName, "@desen/app-browser-e2e");
  assert.equal(built.artifact.authority.package.dedicatedWorkspaceOwnership, true);
  assert.equal(built.artifact.authority.package.rootOwnsBrowserE2e, false);
  assert.equal(built.artifact.authority.package.appOwnsBrowserE2e, false);
  assert.deepEqual(built.artifact.authority.boundary.dedicatedInternalPackageAllowlist, [
    "editor-core",
  ]);
  assert.deepEqual(built.artifact.authority.boundary.reviewedAppSourceEntries, [
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/src/reference-empty-project.ts",
    "apps/desen-app/src/styles.css",
  ]);
  assert.equal(
    built.artifact.authority.boundary.positiveFixture,
    BOUNDARY_PATHS.allowedFixture.split("/")[3],
  );
  assert.equal(built.artifact.authority.boundary.negativeFixtures.length, 2);
  assert.equal(built.artifact.claim.dedicatedBoundaryPolicyCovered, true);
  assert.equal(built.artifact.authority.package.playwrightPackage, "@playwright/test");
  assert.equal(built.artifact.authority.package.playwrightVersion, "1.62.1");
  assert.equal(
    built.artifact.tests.browserCommand,
    "pnpm --filter @desen/app-browser-e2e test:e2e",
  );
  assert.deepEqual(built.artifact.tests.configuredProjects, ["chromium"]);
  assert.equal(built.artifact.tests.workers, 1);
  assert.equal(built.artifact.tests.retries, 0);
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.claim.p08Status, "PROVEN");
  assert.equal(built.artifact.claim.runtimeInputAndPendingCovered, false);
  assert.equal(built.artifact.claim.invalidCredentialsAndPublicFailureCovered, false);
  assert.equal(built.artifact.claim.successNavigationAndHostOperationCovered, false);
  assert.equal(built.artifact.claim.remoteDeploymentCovered, false);
  assert.equal(built.artifact.claim.g10Closed, false);
  assert.equal(built.artifact.nonclaims.length, 8);
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence();
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

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[9], async () => {
  assert.throws(
    () =>
      verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy({
        ...sourcePolicyInput,
        browserSpec: conditionalizeBrowserTest(
          sourcePolicyInput.browserSpec,
          'process.env.CI === "never"',
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy({
        ...sourcePolicyInput,
        browserSpec: insertAtBrowserTestStart(
          sourcePolicyInput.browserSpec,
          'if (process.env.CI === "true") return;',
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
  assert.throws(
    () =>
      verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy({
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
      verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy({
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
  rootPackage.devDependencies["@playwright/test"] = "1.62.1";
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [ROOT_PACKAGE_PATH, Buffer.from(`${JSON.stringify(rootPackage, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );

  const appPackage = JSON.parse(packageBytes.get(APP_PACKAGE_PATH).toString("utf8"));
  appPackage.scripts["test:e2e"] = "playwright test";
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [APP_PACKAGE_PATH, Buffer.from(`${JSON.stringify(appPackage, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );

  const browserPackage = JSON.parse(packageBytes.get(BROWSER_PACKAGE_PATH).toString("utf8"));
  browserPackage.devDependencies["@playwright/test"] = "^1.62.1";
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [BROWSER_PACKAGE_PATH, Buffer.from(`${JSON.stringify(browserPackage, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );

  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          BOUNDARY_PATHS.configuration,
          Buffer.from(
            replaceOnce(
              packageBytes.get(BOUNDARY_PATHS.configuration).toString("utf8"),
              '"desen-app-browser-e2e": ["editor-core"]',
              '"desen-app-browser-e2e": ["editor-core", "publisher"]',
            ),
          ),
        ],
      ]),
    }),
    expectedError("BOUNDARY_CONTRACT_DRIFT"),
  );

  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          BOUNDARY_PATHS.allowedFixture,
          Buffer.from(
            replaceOnce(
              packageBytes.get(BOUNDARY_PATHS.allowedFixture).toString("utf8"),
              'from "../desen-app/src/application.js"',
              'from "../desen-app/src/main.js"',
            ),
          ),
        ],
      ]),
    }),
    expectedError("BOUNDARY_CONTRACT_DRIFT"),
  );

  const workflowSource = packageBytes.get(WORKFLOW_PATH).toString("utf8");
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          WORKFLOW_PATH,
          Buffer.from(
            replaceOnce(
              workflowSource,
              "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
              "node scripts/verify-desen-app-empty-project-browser-e2e.mjs",
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          WORKFLOW_PATH,
          Buffer.from(
            replaceOnce(
              workflowSource,
              [
                "      - name: Run browser E2E proof",
                "        run: pnpm --filter @desen/app-browser-e2e test:e2e",
              ].join("\n"),
              [
                "      - name: Run browser E2E proof",
                "        if: ${{ false }}",
                "        run: pnpm --filter @desen/app-browser-e2e test:e2e",
              ].join("\n"),
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          WORKFLOW_PATH,
          Buffer.from(
            replaceOnce(
              workflowSource,
              [
                "      - name: Run browser E2E proof",
                "        run: pnpm --filter @desen/app-browser-e2e test:e2e",
              ].join("\n"),
              [
                "      - name: Run browser E2E proof",
                "        continue-on-error: true",
                "        run: pnpm --filter @desen/app-browser-e2e test:e2e",
              ].join("\n"),
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          WORKFLOW_PATH,
          Buffer.from(
            replaceOnce(
              workflowSource,
              [
                "  browser-e2e:",
                "    if: ${{ github.event_name != 'workflow_dispatch' || inputs.mode == 'required' }}",
              ].join("\n"),
              ["  browser-e2e:", "    if: ${{ false }}"].join("\n"),
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  const runStep = [
    "      - name: Run browser E2E proof",
    "        run: pnpm --filter @desen/app-browser-e2e test:e2e",
  ].join("\n");
  const verifyStep = [
    "      - name: Verify frozen browser-proof evidence",
    "        run: |",
    "          node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
    "          node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
  ].join("\n");
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [
          WORKFLOW_PATH,
          Buffer.from(
            replaceOnce(
              workflowSource,
              `${runStep}\n\n${verifyStep}`,
              `${verifyStep}\n\n${runStep}`,
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );

  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([[LOCKFILE_PATH, Buffer.from("lockfileVersion: '9.0'\n")]]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      fileOverrides: new Map([
        [DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN.path, Buffer.from("{}\n")],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
});

test(DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES[10], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.equal(verified.p08Status, "PROVEN");
  await assert.rejects(
    verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Task: M10-T01\nStatus: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  const proofText = proofDocument.toString("utf8");
  for (const contradictoryLine of [
    "Status: DONE",
    "Status: FAILED",
    "P-08: NOT_PROVEN",
    "Historical artifact: `sha256:0000000000000000000000000000000000000000000000000000000000000000`",
    "Compatibility artifact: `sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`",
  ]) {
    await assert.rejects(
      verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument: Buffer.from(`${proofText}${contradictoryLine}\n`),
      }),
      expectedError("PROOF_DOCUMENT_DRIFT"),
    );
  }
  await assert.rejects(
    verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from(
        proofText.replace("Status: DONE\n\nP-08: PROVEN", "P-08: PROVEN\n\nStatus: DONE"),
      ),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({ unknown: true }),
    expectedError("OPTIONS_INVALID"),
  );

  const directory = await temporaryDirectory("desen-m10-t01-compat-writer-");
  const target = path.join(directory, "artifact.json");
  const linkedTarget = path.join(directory, "linked.json");
  await symlink(target, linkedTarget);
  await assert.rejects(
    writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence({ artifactPath: linkedTarget }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
