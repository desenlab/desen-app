import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile as readLiveFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN,
  DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES,
  DesenAppUserCreatedBlankProjectProofError,
  buildDesenAppUserCreatedBlankProjectEvidence,
  verifyDesenAppUserCreatedBlankProjectEvidence,
  verifyDesenAppUserCreatedBlankProjectSourcePolicy,
  writeDesenAppUserCreatedBlankProjectEvidence,
} from "../scripts/lib/desen-app-user-created-blank-project-proof.mjs";
import { createDesenAppHistoricalReaderReadFile } from "./desen-app-historical-reader-fixture.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const readFile = createDesenAppHistoricalReaderReadFile({
  workspaceRoot: ROOT,
  liveReadFile: readLiveFile,
});
const SOURCE_PATHS = Object.freeze({
  main: "apps/desen-app/src/main.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  localPersistence: "apps/desen-app/src/local-runtime-persistence.ts",
  application: "apps/desen-app/src/application.tsx",
  projectData: "apps/desen-app/src/project-data.ts",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  localDevLauncher: "apps/desen-app/dev/local-dev.mjs",
  productSpec: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  productServer: "apps/desen-app-browser-e2e/product-proof-server.mjs",
  productPlaywright: "apps/desen-app-browser-e2e/product-playwright.config.ts",
});
const BOUNDARY_AUTHORITY_PATHS = Object.freeze(
  [
    ".gitignore",
    "dependency-cruiser.config.cjs",
    "package.json",
    "scripts/verify-boundary-fixtures.mjs",
    "tests/boundaries/README.md",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/control-plane-api/dist/index.js",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/control-plane-api/dist/index.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/desen-app-browser-e2e/proof-application.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app-browser-e2e/product-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app/src/application.js",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);
const temporaryDirectories = [];
let built;
let sourcePolicyInput;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppUserCreatedBlankProjectProofError);
    assert.equal(error.code, code);
    return true;
  };
}

function replaceOnce(source, marker, replacement) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `Missing mutation marker ${marker}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + marker.length)}`;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App user-created blank project",
      "",
      "Task: M10-T01A",
      "",
      "Status: DONE",
      "",
      "P-08: PROVEN",
      "",
      "T02+: NOT_PROVEN",
      "",
      `Predecessor artifact: \`sha256:${DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN.sha256}\``,
      "",
      `Final artifact: \`sha256:${artifactSha256}\``,
      "",
      "## Scope",
      "",
      "Mutation-test report authority.",
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
  built = await buildDesenAppUserCreatedBlankProjectEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-user-created-blank-project");
  assert.equal(built.artifact.profile, "desen.app.user-created-blank-project-proof.v1");
  assert.equal(built.artifact.task, "M10-T01A");
  assert.equal(built.artifact.gate, null);
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN]);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppUserCreatedBlankProjectSourcePolicy(sourcePolicyInput);
  assert.equal(source.normalProductEntry, true);
  assert.equal(source.productEntryInjectsDocument, false);
  assert.equal(source.localRuntimeProfile, "desen.app.local-runtime.v1");
  assert.equal(built.artifact.authority.execution.injectedDocumentOrRouteAuthority, false);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[2], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.initialProjectCount, 0);
  assert.equal(source.visibleNewProjectControl, true);
  assert.equal(source.visibleBlankTemplate, true);
  assert.equal(source.exactProjectId, "account-app");
  assert.equal(source.exactSurfaceId, "sign-in");
  assert.deepEqual(source.frame, { preset: "portrait", width: 420, height: 720 });
  assert.equal(built.artifact.claim.fixtureBootstrapBypassed, true);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[3], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.fixedLoopbackOnly, true);
  assert.equal(source.freshBearerSecret, true);
  assert.equal(source.durableControlPlaneStore, true);
  assert.equal(source.productionBundlePreview, true);
  assert.equal(built.artifact.authority.execution.realControlPlaneAdapter, true);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[4], () => {
  assert.equal(
    built.artifact.tests.browserTestName,
    "creates, authors, persists, reloads, and reopens a blank sign-in project through the normal product UI",
  );
  assert.equal(built.artifact.tests.browserTestDeclarations, 1);
  assert.deepEqual(built.artifact.tests.configuredProjects, ["product-chromium"]);
  assert.equal(built.artifact.authority.source.browserRuntimeErrorsAllowed, 0);
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[5], () => {
  assert.equal(built.artifact.authority.source.nativeDragCalls, 2);
  assert.equal(built.artifact.claim.nativeComponentDragCovered, true);
  assert.equal(built.artifact.claim.nativeLayerDragCovered, true);
  assert.equal(built.artifact.claim.forgedDataTransferRejected, true);
  assert.equal(built.artifact.claim.authoredDeletionCovered, true);
  assert.deepEqual(built.artifact.authority.authoredOutcome.statePaths, ["email", "password"]);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.authority.source.creationGeneration, 1);
  assert.equal(built.artifact.authority.source.authoredGeneration, 2);
  assert.equal(built.artifact.claim.generationOneCreationCovered, true);
  assert.equal(built.artifact.claim.generationTwoSaveCovered, true);
  assert.equal(built.artifact.claim.hardReloadCovered, true);
  assert.equal(built.artifact.claim.exactSourceReadBackCovered, true);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.authority.source.visibleProjectReopenCovered, true);
  assert.equal(built.artifact.claim.visibleProjectReopenCovered, true);
  assert.equal(built.artifact.authority.authoredOutcome.projectId, "account-app");
  assert.equal(built.artifact.authority.authoredOutcome.surfaceId, "sign-in");
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[8], () => {
  const authority = built.artifact.authority.package;
  assert.equal(authority.appPackageName, "@desen/app-web");
  assert.equal(authority.browserPackageName, "@desen/app-browser-e2e");
  assert.equal(authority.appOwnsPlaywright, false);
  assert.equal(authority.dedicatedBrowserWorkspace, true);
  assert.equal(authority.playwrightVersion, "1.62.1");
  assert.equal(authority.exactHeadBrowserExecution, true);
  const boundary = built.artifact.authority.boundary;
  assert.equal(built.artifact.claim.productServerControlPlaneBoundaryCovered, true);
  assert.equal(boundary.command, "pnpm boundaries");
  assert.equal(boundary.dependencyCruiserVersion, "18.1.0");
  assert.equal(boundary.exactFixtureFiles, 8);
  assert.equal(boundary.authorityFiles, 13);
  assert.equal(boundary.durableStateIgnored, true);
  assert.equal(boundary.ignoredDistFixturesReadmitted, true);
  assert.equal(boundary.executionPerformedByReader, false);
  assert.deepEqual(boundary.rules, [
    "desen-app-browser-e2e-reviewed-app-source-only",
    "desen-app-browser-e2e-product-server-control-plane-public-root-only",
    "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
  ]);
  assert.equal(built.artifact.tests.boundaryCommand, "pnpm boundaries");
  assert.equal(built.artifact.tests.boundaryExecutedByVerifier, false);
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[9], async () => {
  const second = await buildDesenAppUserCreatedBlankProjectEvidence();
  assert.deepEqual(second.artifact, built.artifact);
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  const receipts = built.artifact.boundary.trackedReceipts;
  const paths = receipts.map(({ path: relativePath }) => relativePath);
  assert.equal(receipts.length, built.artifact.boundary.trackedFiles);
  assert.equal(receipts.length, 43);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(
    paths,
    paths.toSorted((left, right) => left.localeCompare(right, "en-US")),
  );
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(receipts), true);
  assert.equal(built.artifact.boundary.boundaryAuthorityFiles, 13);
  assert.deepEqual(built.artifact.boundary.boundaryAuthorityPaths, BOUNDARY_AUTHORITY_PATHS);
  for (const boundaryPath of BOUNDARY_AUTHORITY_PATHS) {
    assert.equal(paths.includes(boundaryPath), true);
  }
  const verified = await verifyDesenAppUserCreatedBlankProjectEvidence();
  assert.equal(
    verified.artifactSha256,
    "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
  );
  assert.equal(verified.compatibilityReceipt, "M10-T01A-SECURE-SCROLL-COMPAT");
  assert.equal(verified.compatibilityReceipts, 4);
  assert.equal(verified.checkpointResealedReaders, 2);
  assert.equal(verified.correctiveReceiptOnly, true);
  assert.equal(verified.immutableTaskArtifactPreserved, true);
  assert.equal(verified.retainedHistoricalReceipts, 39);
});

test("[M10-T01B successor] authenticates exact visual authoring evidence and current receipts", async () => {
  const verified = await verifyDesenAppUserCreatedBlankProjectEvidence();
  const successor = verified.visualBehaviorAuthoringSuccessor;
  assert.deepEqual(
    {
      task: successor.task,
      artifact: successor.artifact,
      predecessorTask: successor.predecessor.task,
      relationship: successor.currentProjection.relationship,
      currentReceipts: successor.currentProjection.currentReceipts.length,
      p08Status: successor.p08Status,
      p09Status: successor.p09Status,
      visualInputConnectionCovered: successor.visualInputConnectionCovered,
      visualOperationActionCovered: successor.visualOperationActionCovered,
      visualConditionalPresenceCovered: successor.visualConditionalPresenceCovered,
      catalogDerivedRunControlsCovered: successor.catalogDerivedRunControlsCovered,
      advancedJsonRetained: successor.advancedJsonRetained,
      authoredBrowserSmokeCovered: successor.authoredBrowserSmokeCovered,
      m10T02Closed: successor.m10T02Closed,
      g10Closed: successor.g10Closed,
    },
    {
      task: "M10-T01B",
      artifact: {
        path: "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
        bytes: 10_962,
        sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
        immutable: true,
      },
      predecessorTask: "M10-T01A",
      relationship: "EXACT_M10_T01B_ARTIFACT_OWNED_LIVE_RECEIPTS",
      currentReceipts: 31,
      p08Status: "PROVEN",
      p09Status: "PARTIAL",
      visualInputConnectionCovered: true,
      visualOperationActionCovered: true,
      visualConditionalPresenceCovered: true,
      catalogDerivedRunControlsCovered: true,
      advancedJsonRetained: true,
      authoredBrowserSmokeCovered: true,
      m10T02Closed: false,
      g10Closed: false,
    },
  );
  assert.deepEqual(successor.currentProjection.hostedBrowserCompatibility, {
    compatibilityReceipt: "M10-T01B-HOSTED-BROWSER-COMPAT",
    correctiveReceiptOnly: true,
    overriddenHistoricalPaths: ["apps/desen-app-browser-e2e/user-created-blank-project.pw.ts"],
    trackedReceipts: [
      {
        path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
        bytes: 15_143,
        sha256: "5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b",
      },
    ],
  });

  const hostedBrowserPath = "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts";
  for (const [relativePath, bytes] of [
    [successor.artifact.path, await readFile(path.join(ROOT, successor.artifact.path))],
    [
      "apps/desen-app/src/behavior-controls.tsx",
      await readFile(path.join(ROOT, "apps/desen-app/src/behavior-controls.tsx")),
    ],
    [hostedBrowserPath, await readFile(path.join(ROOT, hostedBrowserPath))],
  ]) {
    const mutations =
      relativePath === hostedBrowserPath
        ? [Buffer.concat([bytes, Buffer.from("\n")])]
        : [Buffer.alloc(0), changedByte(bytes)];
    for (const mutation of mutations) {
      await assert.rejects(
        verifyDesenAppUserCreatedBlankProjectEvidence({
          buildOptions: { fileOverrides: new Map([[relativePath, mutation]]) },
        }),
        expectedError("SUCCESSOR_POLICY_VIOLATION"),
      );
    }
  }
});

test(DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES[10], async () => {
  const sourceMutations = [
    [
      "main",
      "<DesenAppProduct persistencePort={persistencePort} />",
      "<div>fixture bootstrap</div>",
    ],
    ["productBootstrap", "controller.save()", "Promise.resolve({ status: 'created' })"],
    ["localPersistence", "127\\.0\\.0\\.1", "localhost"],
    [
      "localDevHost",
      "controlPlane = await openControlPlane({",
      "controlPlane = await Promise.resolve({",
    ],
    ["productSpec", 'await page.goto("/")', 'await page.goto("/injected")'],
    ["productServer", "await build({", "await Promise.resolve({"],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppUserCreatedBlankProjectSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  await assert.rejects(
    buildDesenAppUserCreatedBlankProjectEvidence({
      fileOverrides: new Map([
        [
          "apps/desen-app-browser-e2e/package.json",
          Buffer.from(
            (
              await readFile(path.join(ROOT, "apps/desen-app-browser-e2e/package.json"), "utf8")
            ).replace("product-playwright.config.ts", "substituted.config.ts"),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_CONTRACT_DRIFT"),
  );

  for (const [relativePath, marker, replacement] of [
    [
      "package.json",
      "depcruise --config dependency-cruiser.config.cjs apps packages",
      "depcruise apps packages",
    ],
    [
      ".gitignore",
      "!tests/boundaries/fixtures/*/apps/control-plane-api/dist/**",
      "tests/boundaries/fixtures/*/apps/control-plane-api/dist/**",
    ],
    [
      "dependency-cruiser.config.cjs",
      "pathNot: controlPlanePublicBuildEntryPath",
      "pathNot: desenAppBrowserProductProofServerPath",
    ],
    [
      "scripts/verify-boundary-fixtures.mjs",
      'expectedRule: "desen-app-browser-e2e-product-server-control-plane-public-root-only"',
      "expectedRule: null",
    ],
    [
      "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/desen-app-browser-e2e/product-proof-server.mjs",
      "../control-plane-api/dist/index.js",
      "../control-plane-api/dist/private.js",
    ],
  ]) {
    const source = await readFile(path.join(ROOT, relativePath), "utf8");
    await assert.rejects(
      buildDesenAppUserCreatedBlankProjectEvidence({
        fileOverrides: new Map([
          [relativePath, Buffer.from(replaceOnce(source, marker, replacement))],
        ]),
      }),
      expectedError("BOUNDARY_CONTRACT_DRIFT"),
    );
  }

  await assert.rejects(
    verifyDesenAppUserCreatedBlankProjectEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      buildOptions: {},
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppUserCreatedBlankProjectEvidence({
      artifactBytes: built.artifactBytes,
      buildOptions: {},
      proofDocument: changedByte(exactProofDocument(built.artifactSha256)),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  const immutableArtifactBytes = await readFile(
    path.join(ROOT, "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json"),
  );
  await assert.rejects(
    verifyDesenAppUserCreatedBlankProjectEvidence({
      artifactBytes: immutableArtifactBytes,
      buildOptions: {},
      proofDocument: changedByte(
        exactProofDocument("6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e"),
      ),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  for (const relativePath of [
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
    "apps/desen-app/src/inspector-panel.tsx",
    "apps/desen-app/src/styles.css",
  ]) {
    const authorityBytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      verifyDesenAppUserCreatedBlankProjectEvidence({
        artifactBytes: immutableArtifactBytes,
        buildOptions: {
          fileOverrides: new Map([
            [relativePath, Buffer.concat([authorityBytes, Buffer.from("\n")])],
          ]),
        },
        proofDocument: exactProofDocument(
          "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
        ),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  for (const options of [
    { unknown: true },
    { artifactPath: "" },
    { buildOptions: { unknown: true } },
    { buildOptions: { fileOverrides: new Map([["unknown", Buffer.from("x")]]) } },
  ]) {
    await assert.rejects(
      verifyDesenAppUserCreatedBlankProjectEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }

  const directory = await temporaryDirectory("desen-user-created-proof-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppUserCreatedBlankProjectEvidence({
    artifactPath: destination,
  });
  assert.equal(
    written.artifactSha256,
    "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
  );
  assert.equal(written.preserved, false);
  assert.deepEqual(await readFile(destination), immutableArtifactBytes);

  const trackedBefore = await readFile(
    path.join(ROOT, "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json"),
  );
  let trackedRenameAttempted = false;
  const preserved = await writeDesenAppUserCreatedBlankProjectEvidence({
    beforeAtomicRename() {
      trackedRenameAttempted = true;
    },
  });
  assert.equal(preserved.preserved, true);
  assert.equal(trackedRenameAttempted, false);
  assert.deepEqual(
    await readFile(
      path.join(ROOT, "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json"),
    ),
    trackedBefore,
  );

  const interrupted = path.join(directory, "interrupted.json");
  await assert.rejects(
    writeDesenAppUserCreatedBlankProjectEvidence({
      artifactPath: interrupted,
      beforeAtomicRename() {
        throw new Error("interrupted before rename");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
