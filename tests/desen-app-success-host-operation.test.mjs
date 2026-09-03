import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  authenticateDesenAppEvergreenProductCompositionSuccessor,
  projectDesenAppHistoricalReaderPathInventory,
  readDesenAppHistoricalReaderTaskTimeFile,
} from "../scripts/lib/desen-app-evergreen-product-composition-proof.mjs";
import {
  DesenAppUserCreatedBlankProjectProofError,
  verifyDesenAppUserCreatedBlankProjectEvidence,
} from "../scripts/lib/desen-app-user-created-blank-project-proof.mjs";

import {
  DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN,
  DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN,
  DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES,
  DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN,
  DesenAppSuccessHostOperationProofError,
  authenticateDesenAppSuccessHostOperationSuccessor,
  buildDesenAppSuccessHostOperationEvidence,
  materializeDesenAppT03HistoricalReaderFileOverrides,
  projectDesenAppT03HistoricalReaderPathInventory,
  readDesenAppT03HistoricalReaderTaskTimeFile,
  verifyDesenAppSuccessHostOperationEvidence,
  verifyDesenAppSuccessHostOperationSourcePolicy,
  writeDesenAppSuccessHostOperationEvidence,
} from "../scripts/lib/desen-app-success-host-operation-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const READER_PATH = "scripts/lib/desen-app-success-host-operation-proof.mjs";
const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  main: "apps/desen-app/src/main.tsx",
  localWorkspaces: "apps/desen-app/src/local-workspaces.tsx",
  workspaceStyles: "apps/desen-app/src/local-workspaces.module.css",
  flowProfile: "apps/desen-app/src/reference-flow-workspace-profile.ts",
  runNavigation: "apps/desen-app/src/authoring-run-navigation.ts",
  integration: "apps/desen-app/src/authoring-integration.ts",
  localBinding: "apps/desen-app/src/local-operation-binding.ts",
  localHost: "apps/desen-app/dev/local-operation-host.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  eventActions: "apps/desen-app/src/authoring-event-actions.ts",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  operationLifecycle: "packages/runtime-core/src/operation-lifecycle.ts",
});
const BROWSER_SPEC_PATH = "apps/desen-app-browser-e2e/success-host-operation.pw.ts";
const INTEGRATION_TEST_PATH = "apps/desen-app/test/authoring-integration.test.ts";

const temporaryDirectories = [];
let built;
let sourcePolicyInput;
let successor;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppSuccessHostOperationProofError);
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
      "# Desen App success and local host operation",
      "",
      "Task: M10-T04",
      "",
      "Status: DONE",
      "",
      "P-09: PROVEN",
      "",
      "P-10: PROVEN",
      "",
      `Predecessor artifact: \`sha256:${DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN.sha256}\``,
      "",
      `Host binding artifact: \`sha256:${DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN.sha256}\``,
      "",
      `Historical bridge: \`sha256:${DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.sha256}\``,
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
  built = await buildDesenAppSuccessHostOperationEvidence();
  successor = await authenticateDesenAppSuccessHostOperationSuccessor();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[0], async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-success-host-operation");
  assert.equal(built.artifact.profile, "desen.app.success-host-operation-proof.v1");
  assert.equal(built.artifact.task, "M10-T04");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN,
    DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN,
  ]);
  const readerSource = await readFile(path.join(ROOT, READER_PATH), "utf8");
  assert.doesNotMatch(readerSource, /(?:from\s+|import\()["'].+desen-app-failure-fixture-proof/u);
  assert.doesNotMatch(
    readerSource,
    /(?:from\s+|import\()["'].+reference-sign-in-fixtures-and-host-binding-proof/u,
  );
  assert.equal(built.artifact.tests.browserExecutedByVerifier, false);
  assert.equal(built.artifact.tests.deterministicReaderStartsListener, false);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppSuccessHostOperationSourcePolicy(sourcePolicyInput);
  assert.equal(source.additiveAuthenticatedTwoSurfaceWorkspace, true);
  assert.equal(source.legacySourceAndStorageIdentityPreserved, true);
  assert.equal(source.guardedWorkspaceNavigation, true);
  assert.equal(
    built.artifact.authority.focusedTests.workspaceCreationLegacyPreservationAndDirtyGuard,
    true,
  );
  assert.equal(built.artifact.authority.browser.emptyTwoSurfaceWorkspaceCreation, true);
  assert.equal(built.artifact.claim.additiveWorkspacePreservesLegacySource, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[2], () => {
  const browser = built.artifact.authority.browser;
  assert.equal(browser.normalVisibleProductFlow, true);
  assert.equal(browser.destinationContentAuthoredVisibly, true);
  assert.equal(browser.designerChosenNonDefaultOperationAlias, true);
  assert.equal(browser.successSubactionNavigateAuthoredVisibly, true);
  assert.equal(browser.proofOnlyRouteUsed, false);
  assert.equal(browser.directNetworkOrDomMutationUsed, false);
  assert.equal(built.artifact.claim.visibleNoCodeSuccessNavigation, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[3], () => {
  const source = built.artifact.authority.source;
  const browser = built.artifact.authority.browser;
  assert.equal(source.catalogFixtureAndActualLocalHostResultDistinct, true);
  assert.equal(browser.syntheticCatalogSuccessNavigation, true);
  assert.equal(browser.syntheticRealHttpCallCount, 0);
  assert.equal(browser.sourceWriteCountAndBytesUnchangedByRun, true);
  assert.equal(built.artifact.claim.catalogSyntheticSuccessWithNoHostIo, true);
  assert.equal(built.artifact.claim.runSourceGenerationAndBytesUnchanged, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[4], () => {
  const source = built.artifact.authority.source;
  const browser = built.artifact.authority.browser;
  assert.equal(source.explicitInactiveIntegrationAuthority, true);
  assert.equal(source.exactProfileDocumentRevisionAliasCapabilityEffect, true);
  assert.equal(source.explicitTrustedHostOperationBinding, true);
  assert.equal(source.fixedLoopbackEndpointOutsideSource, true);
  assert.equal(source.separateBearerOriginAndHostAuthorization, true);
  assert.equal(source.boundedRequestsResponsesAndTimeouts, true);
  assert.deepEqual(built.artifact.authority.dependencyBoundary.cases, [
    {
      name: "allowed-desen-app-browser-e2e-product-server-local-operation-host",
      expectedRule: null,
    },
    {
      name: "desen-app-browser-e2e-product-server-imports-unreviewed-dev-module",
      expectedRule: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
    },
    {
      name: "desen-app-browser-e2e-non-product-server-imports-local-operation-host",
      expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
    },
  ]);
  assert.equal(built.artifact.authority.dependencyBoundary.authorityFiles, 9);
  assert.equal(
    built.artifact.authority.dependencyBoundary.exactAnchoredProductServerImporter,
    true,
  );
  assert.equal(built.artifact.authority.dependencyBoundary.exactAnchoredLocalListenerTarget, true);
  assert.equal(built.artifact.authority.dependencyBoundary.neighboringDevModulesRemainDenied, true);
  assert.equal(built.artifact.authority.dependencyBoundary.otherBrowserImportersRemainDenied, true);
  assert.equal(built.artifact.tests.boundaryExecutedByVerifier, false);
  assert.equal(browser.explicitIntegrationSelection, true);
  assert.equal(browser.integrationFixtureControlsAbsent, true);
  assert.equal(browser.productionRemainsDisabled, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[5], () => {
  const browser = built.artifact.authority.browser;
  const claim = built.artifact.claim;
  assert.equal(browser.actualLocalHttpSuccessStatus, 200);
  assert.deepEqual(browser.actualLocalHttpSuccessOutput, { userId: "local-host-user" });
  assert.deepEqual(browser.catalogFixtureSuccessOutput, { userId: "user-1" });
  assert.notDeepEqual(browser.actualLocalHttpSuccessOutput, browser.catalogFixtureSuccessOutput);
  assert.equal(browser.successfulRetryNavigatesManagedDestination, true);
  assert.equal(browser.browserUrlRemainsOnDesignOrigin, true);
  assert.equal(browser.exactFrameGeometryStable, true);
  assert.equal(browser.restartRunAndDesignRestoreOrigin, true);
  assert.equal(browser.reloadReopensAuthoredSourceWithoutRunValues, true);
  assert.equal(browser.runInputAndHostOutputAbsentFromSavedSource, true);
  assert.equal(claim.p09Status, "PROVEN");
  assert.equal(claim.p10Status, "PROVEN");
  assert.equal(claim.m10T04Closed, true);
  for (const key of [
    "productionAuthenticationCovered",
    "productionOperationCovered",
    "remoteDeploymentCovered",
    "multiUserPersistenceCovered",
    "n036Closed",
    "n040Closed",
    "g10Closed",
  ]) {
    assert.equal(claim[key], false, key);
  }
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[6], () => {
  const source = built.artifact.authority.source;
  const browser = built.artifact.authority.browser;
  assert.equal(source.publicFailureRedactionAndNoCredentialPersistence, true);
  assert.equal(source.runtimeOwnsOutputAndPublicErrorValidation, true);
  assert.equal(browser.actualLocalHttpPublicFailureStatus, 401);
  assert.equal(browser.publicFailurePreservesOriginAndInput, true);
  assert.equal(browser.successfulRetryNavigatesManagedDestination, true);
  assert.equal(browser.actualLocalHttpCalls, 2);
  assert.equal(
    built.artifact.authority.focusedTests.runtimeOutputValidationAndFailureRedaction,
    true,
  );
  assert.equal(built.artifact.claim.localHostFailureAndSuccessfulRetry, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[7], () => {
  const source = built.artifact.authority.source;
  const focused = built.artifact.authority.focusedTests;
  assert.equal(source.boundedReplayAndDetachedInput, true);
  assert.equal(source.revocationAbortAndLateSettlementFencing, true);
  assert.equal(source.localManagedNavigationNotBrowserNavigation, true);
  assert.equal(source.runDoesNotGrantStorageResourcesOrProduction, true);
  assert.equal(source.genericEditorNotSignInSpecific, true);
  assert.equal(focused.genericNonAuthIntegrationAndExactIdentityNegatives, true);
  assert.equal(focused.sourceRevisionAndAliasEffectMismatchNegatives, true);
  assert.equal(focused.cancellationLateResultAndReplayNegatives, true);
  assert.equal(focused.managedNavigationInertModeAndReentryNegatives, true);
  assert.equal(built.artifact.claim.forgedStaleInactiveAndUnboundRequestsRejected, true);
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppSuccessHostOperationEvidence();
  assert.deepEqual(second.artifact, built.artifact);
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  const receipts = built.artifact.boundary.trackedReceipts;
  assert.equal(receipts.length, built.artifact.boundary.trackedFiles);
  assert.equal(
    new Set(receipts.map(({ path: relativePath }) => relativePath)).size,
    receipts.length,
  );
  assert.deepEqual(
    receipts.map(({ path: relativePath }) => relativePath),
    receipts
      .map(({ path: relativePath }) => relativePath)
      .toSorted((left, right) => left.localeCompare(right, "en-US")),
  );
  for (const receipt of receipts) {
    const bytes = await readFile(path.join(ROOT, receipt.path));
    assert.equal(bytes.byteLength, receipt.bytes, receipt.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256, receipt.path);
  }
  assert.equal(receipts.length, 51);
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(receipts), true);
  assert.deepEqual(built.artifact.authority.historicalReaderBridge, {
    path: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.path,
    bytes: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.bytes,
    sha256: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.sha256,
    uncompressedBytes: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.uncompressedBytes,
    baseCommit: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.baseCommit,
    fileEntries: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.fileEntries,
    predecessorGapFiles: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.predecessorGapFiles,
    successorAddedPaths: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.successorAddedPaths,
    projections: DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.projections,
    canonicalDenseManifest: true,
    boundedGzip: true,
    parentProjectionAuthenticated: true,
  });

  const taskTimePath = "apps/desen-app/src/application.tsx";
  const firstCopy = readDesenAppT03HistoricalReaderTaskTimeFile(successor, taskTimePath);
  const secondCopy = readDesenAppT03HistoricalReaderTaskTimeFile(successor, taskTimePath);
  firstCopy[0] ^= 1;
  assert.notDeepEqual(firstCopy, secondCopy);
  const callerMutation = Buffer.from("exact caller mutation", "utf8");
  const materialized = materializeDesenAppT03HistoricalReaderFileOverrides(
    successor,
    new Map([[taskTimePath, callerMutation]]),
  );
  assert.deepEqual(materialized.get(taskTimePath), callerMutation);
  callerMutation[0] ^= 1;
  assert.notDeepEqual(materialized.get(taskTimePath), callerMutation);
  assert.equal(materialized.size, DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.fileEntries);

  const historicalSuccessor = await authenticateDesenAppEvergreenProductCompositionSuccessor();
  const manifest = JSON.parse(
    gunzipSync(await readFile(path.join(ROOT, DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.path))),
  );
  const retainedPaths = [
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/src/unreviewed-new-source.tsx",
  ];
  const inventory = [...manifest.successorAddedPaths, ...retainedPaths];
  for (const relativePath of manifest.successorAddedPaths) {
    assert.ok(
      receipts.some((receipt) => receipt.path === relativePath),
      relativePath,
    );
  }
  const changedSuccessorPath = manifest.successorAddedPaths[0];
  await assert.rejects(
    verifyDesenAppSuccessHostOperationEvidence({
      buildOptions: {
        fileOverrides: new Map([
          [
            changedSuccessorPath,
            Buffer.concat([
              await readFile(path.join(ROOT, changedSuccessorPath)),
              Buffer.from("\n"),
            ]),
          ],
        ]),
      },
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  assert.deepEqual(
    projectDesenAppT03HistoricalReaderPathInventory(successor, inventory),
    retainedPaths,
  );
  assert.deepEqual(
    projectDesenAppHistoricalReaderPathInventory(historicalSuccessor, inventory),
    retainedPaths,
  );
  assert.equal(inventory.length, 18);
  assert.throws(
    () => projectDesenAppT03HistoricalReaderPathInventory({}, inventory),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  let inventoryGetterCalls = 0;
  const accessorInventory = Object.defineProperty([], "0", {
    get() {
      inventoryGetterCalls += 1;
      return retainedPaths[0];
    },
  });
  for (const malformed of [
    new Proxy(inventory, {}),
    accessorInventory,
    [retainedPaths[0], retainedPaths[0]],
    ["../outside"],
  ]) {
    assert.throws(
      () => projectDesenAppT03HistoricalReaderPathInventory(successor, malformed),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.equal(inventoryGetterCalls, 0);
  const gapPaths = [
    "apps/desen-app-browser-e2e/product-proof-server.mjs",
    "apps/desen-app/dev/local-dev-host.mjs",
    "apps/desen-app/dev/local-dev-host.test.mjs",
    "apps/desen-app/src/preview-controls.tsx",
    "apps/desen-app/test/main-lifecycle.test.tsx",
    "apps/desen-app/tsconfig.local-dev.json",
    "scripts/verify-boundary-fixtures.mjs",
    "tests/boundaries/README.md",
  ];
  const exactGapOverrides = new Map(
    gapPaths.map((relativePath) => {
      const bytes = readDesenAppT03HistoricalReaderTaskTimeFile(successor, relativePath);
      assert.deepEqual(
        readDesenAppHistoricalReaderTaskTimeFile(historicalSuccessor, relativePath),
        bytes,
        relativePath,
      );
      return [relativePath, bytes];
    }),
  );
  assert.equal(
    exactGapOverrides.size,
    DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.predecessorGapFiles,
  );
  // A positive unchanged override must pass before negative probes can establish which authority
  // was rejected. Otherwise unrelated live successor bytes can make every mutation falsely green.
  const unchangedLegacy = await verifyDesenAppUserCreatedBlankProjectEvidence({
    buildOptions: { fileOverrides: exactGapOverrides },
  });
  assert.equal(unchangedLegacy.result, "PASS");
  for (const [relativePath, message] of [
    [
      "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
      "The exact immutable M10-T01B visual-behavior artifact drifted.",
    ],
    [
      "apps/desen-app/src/behavior-controls.tsx",
      "The exact current M10-T01B receipt drifted: apps/desen-app/src/behavior-controls.tsx.",
    ],
    [
      "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
      "The exact M10-T01B hosted-browser compatibility receipt drifted.",
    ],
  ]) {
    const bytes = relativePath.endsWith(".json")
      ? await readFile(path.join(ROOT, relativePath))
      : readDesenAppHistoricalReaderTaskTimeFile(historicalSuccessor, relativePath);
    await assert.rejects(
      verifyDesenAppUserCreatedBlankProjectEvidence({
        buildOptions: {
          fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
        },
      }),
      (error) => {
        assert.ok(error instanceof DesenAppUserCreatedBlankProjectProofError);
        assert.equal(error.code, "SUCCESSOR_POLICY_VIOLATION");
        assert.equal(error.message, message);
        return true;
      },
    );
  }
});

test(DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES[9], async () => {
  const sourceMutations = [
    [
      "localWorkspaces",
      "readProjectWorkspaceProfileAuthority(profileDescriptor.value)",
      "profileDescriptor.value",
    ],
    ["localWorkspaces", "sourceKeys.has(profile.sourceKey)", "false"],
    [
      "localWorkspaces",
      "navigateDesenApp(target.profile.surfacePath)",
      "window.location.assign(target.profile.surfacePath)",
    ],
    ["flowProfile", 'sourceKey: "flow-app-source"', 'sourceKey: "account-app-source"'],
    ["flowProfile", 'id: "result.layout"', 'id: "start.layout"'],
    ["integration", "let active = false;", "let active = true;"],
    ["integration", "authority.profile !== captured.profile", "false"],
    ["integration", "preview.revision !== revision", "false"],
    ["integration", "request.context.surfaceId !== surfaceId", "false"],
    ["integration", "states.get(request.invocationAlias)", "states.values().next().value"],
    ["integration", "state.effect !== request.effect", "false"],
    ["integration", "seenRequestIds.has(request.context.requestId)", "false"],
    ["integration", "if (!stillPending(state, pending)) return", "if (false) return"],
    ["integration", "pending.abort.abort()", "void pending.abort"],
    ["runNavigation", "!isRunActive()", "false"],
    ["runNavigation", "epoch !== requestEpoch", "false"],
    ["runNavigation", "surfaceIds.has(captured.targetSurfaceId)", "true"],
    ["localBinding", 'credentials: "omit"', 'credentials: "include"'],
    ["localBinding", "Promise.race([execute(), interruption])", "execute()"],
    ["localHost", "timingSafeEqual(candidate, expected)", "true"],
    [
      "localHost",
      'respond(200, { userId: "local-host-user" });',
      'respond(200, { userId: "user-1" });',
    ],
    ["localDevHost", "if (operationApiToken === apiToken)", "if (false)"],
    ["application", "integrationController.activate()", "void integrationController"],
    ["operationLifecycle", "if (!record.publicErrors.has(result.errorCode))", "if (false)"],
    [
      "previewControls",
      "Explicit host connection · no fixture substitution.",
      "com.example.auth/signIn",
    ],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.ok(sourcePolicyInput[key].includes(marker), marker);
    assert.throws(
      () =>
        verifyDesenAppSuccessHostOperationSourcePolicy({
          ...sourcePolicyInput,
          [key]: sourcePolicyInput[key].replaceAll(marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
      `${key}: ${marker}`,
    );
  }

  const boundaryMutations = [
    [
      "dependency-cruiser.config.cjs",
      'const desenAppLocalOperationHostPath = "^apps/desen-app/dev/local-operation-host\\\\.mjs$";',
      'const desenAppLocalOperationHostPath = "^apps/desen-app/dev/.*$";',
    ],
    [
      "scripts/verify-boundary-fixtures.mjs",
      'name: "allowed-desen-app-browser-e2e-product-server-local-operation-host",\n    expectedRule: null,',
      'name: "allowed-desen-app-browser-e2e-product-server-local-operation-host",\n    expectedRule: "wrong",',
    ],
    [
      "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/product-proof-server.mjs",
      'from "../desen-app/dev/local-operation-private.mjs";',
      'from "../desen-app/dev/local-operation-host.mjs";',
    ],
    ["tests/boundaries/README.md", "All 26", "All 25"],
  ];
  for (const [relativePath, marker, replacement] of boundaryMutations) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppSuccessHostOperationEvidence({
        fileOverrides: new Map([
          [relativePath, Buffer.from(replaceOnce(bytes.toString("utf8"), marker, replacement))],
        ]),
      }),
      expectedError("BOUNDARY_POLICY_VIOLATION"),
      relativePath,
    );
  }

  for (const pin of [
    DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN,
    DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN,
  ]) {
    const parentBytes = await readFile(path.join(ROOT, pin.path));
    await assert.rejects(
      buildDesenAppSuccessHostOperationEvidence({
        fileOverrides: new Map([[pin.path, changedByte(parentBytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  const integrationTestBytes = await readFile(path.join(ROOT, INTEGRATION_TEST_PATH));
  await assert.rejects(
    buildDesenAppSuccessHostOperationEvidence({
      fileOverrides: new Map([
        [
          INTEGRATION_TEST_PATH,
          Buffer.from(
            replaceOnce(
              integrationTestBytes.toString("utf8"),
              "requires every request's exact authored alias, capability, effect and context",
              "accepts any alias",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );

  const browserBytes = await readFile(path.join(ROOT, BROWSER_SPEC_PATH));
  await assert.rejects(
    buildDesenAppSuccessHostOperationEvidence({
      fileOverrides: new Map([
        [
          BROWSER_SPEC_PATH,
          Buffer.from(
            replaceOnce(
              browserBytes.toString("utf8"),
              "expect(hostCalls).toBe(0)",
              "expect(hostCalls).toBe(1)",
            ),
          ),
        ],
      ]),
    }),
    expectedError("BROWSER_POLICY_VIOLATION"),
  );

  const bridgeBytes = await readFile(
    path.join(ROOT, DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.path),
  );
  const inflatedBridge = gunzipSync(bridgeBytes);
  const bridgeManifest = JSON.parse(inflatedBridge.toString("utf8"));
  const baseMutation = structuredClone(bridgeManifest);
  baseMutation.baseCommit = "0".repeat(40);
  const pathMutation = structuredClone(bridgeManifest);
  const [firstBridgePath] = Object.keys(pathMutation.files);
  pathMutation.files["../escape"] = pathMutation.files[firstBridgePath];
  const projectionMutation = structuredClone(bridgeManifest);
  projectionMutation.projections["desen-app-failure-fixture"].result = "FAIL";
  const canonicalBridgeBytes = (manifest) => Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
  const bridgeMutations = [
    changedByte(bridgeBytes),
    bridgeBytes.subarray(0, bridgeBytes.byteLength - 1),
    gzipSync(Buffer.concat([inflatedBridge, Buffer.from(" ")])),
    gzipSync(canonicalBridgeBytes(baseMutation)),
    gzipSync(canonicalBridgeBytes(pathMutation)),
    gzipSync(canonicalBridgeBytes(projectionMutation)),
    gzipSync(Buffer.alloc(8 * 1_024 * 1_024 + 1)),
  ];
  for (const bridgeMutation of bridgeMutations) {
    await assert.rejects(
      buildDesenAppSuccessHostOperationEvidence({
        fileOverrides: new Map([[DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.path, bridgeMutation]]),
      }),
      expectedError("HISTORICAL_BRIDGE_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppSuccessHostOperationEvidence({ unexpected: true }),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "workspaceRoot", { get: () => ROOT, enumerable: true });
  await assert.rejects(
    buildDesenAppSuccessHostOperationEvidence(accessorOptions),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => materializeDesenAppT03HistoricalReaderFileOverrides(Object.freeze({}), new Map()),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  class HostileMap extends Map {}
  assert.throws(
    () => materializeDesenAppT03HistoricalReaderFileOverrides(successor, new HostileMap()),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorMap = new Map();
  Object.defineProperty(accessorMap, "entries", { get: () => Map.prototype.entries });
  assert.throws(
    () => materializeDesenAppT03HistoricalReaderFileOverrides(successor, accessorMap),
    expectedError("OPTIONS_INVALID"),
  );
  if (typeof SharedArrayBuffer !== "undefined") {
    assert.throws(
      () =>
        materializeDesenAppT03HistoricalReaderFileOverrides(
          successor,
          new Map([
            ["apps/desen-app/src/application.tsx", new Uint8Array(new SharedArrayBuffer(4))],
          ]),
        ),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.throws(
    () => readDesenAppT03HistoricalReaderTaskTimeFile(successor, "../escape"),
    expectedError("OPTIONS_INVALID"),
  );

  const artifactDirectory = await temporaryDirectory("desen-success-host-artifact-");
  const artifactPath = path.join(artifactDirectory, "artifact.json");
  const written = await writeDesenAppSuccessHostOperationEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  const canonicalArtifactPath = await realpath(artifactPath);
  await verifyDesenAppSuccessHostOperationEvidence({
    artifactPath: canonicalArtifactPath,
    proofDocument: exactProofDocument(built.artifactSha256),
  });
  await assert.rejects(
    verifyDesenAppSuccessHostOperationEvidence({
      artifactBytes: changedByte(await readFile(artifactPath)),
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppSuccessHostOperationEvidence({
      artifactPath: canonicalArtifactPath,
      proofDocument: Buffer.from("Task: M10-T04\nsha256:PENDING\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const symlinkPath = path.join(artifactDirectory, "linked.json");
  await symlink(artifactPath, symlinkPath);
  await assert.rejects(
    writeDesenAppSuccessHostOperationEvidence({ artifactPath: symlinkPath }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  await assert.rejects(
    verifyDesenAppSuccessHostOperationEvidence({
      artifactPath: symlinkPath,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const unsafeDirectory = await temporaryDirectory("desen-success-host-unsafe-");
  const missingParentPath = path.join(unsafeDirectory, "missing", "artifact.json");
  await assert.rejects(
    writeDesenAppSuccessHostOperationEvidence({ artifactPath: missingParentPath }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
