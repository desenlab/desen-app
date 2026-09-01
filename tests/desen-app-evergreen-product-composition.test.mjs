import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile as readLiveFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN,
  DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES,
  DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN,
  DesenAppEvergreenProductCompositionProofError,
  authenticateDesenAppEvergreenProductCompositionSuccessor,
  buildDesenAppEvergreenProductCompositionEvidence,
  materializeDesenAppHistoricalReaderFileOverrides,
  projectDesenAppHistoricalReaderPathInventory,
  readDesenAppHistoricalReaderProjection,
  readDesenAppHistoricalReaderTaskTimeFile,
  verifyDesenAppEvergreenProductCompositionEvidence,
  verifyDesenAppEvergreenProductCompositionSourcePolicy,
  writeDesenAppEvergreenProductCompositionEvidence,
} from "../scripts/lib/desen-app-evergreen-product-composition-proof.mjs";
import { createDesenAppT01cHistoricalReaderReadFile } from "./desen-app-t01c-historical-reader-fixture.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const readFile = createDesenAppT01cHistoricalReaderReadFile({
  workspaceRoot: ROOT,
  liveReadFile: readLiveFile,
});
const SOURCE_PATHS = Object.freeze({
  referenceBrowserHarness: "apps/desen-app-browser-e2e/proof-application.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  authoringData: "apps/desen-app/src/authoring-data.ts",
  authoringEventActions: "apps/desen-app/src/authoring-event-actions.ts",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringPersistence: "apps/desen-app/src/authoring-persistence.ts",
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringPublication: "apps/desen-app/src/authoring-publication.ts",
  authoringScenarios: "apps/desen-app/src/authoring-scenarios.ts",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  main: "apps/desen-app/src/main.tsx",
  previewFidelity: "apps/desen-app/src/preview-fidelity.ts",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  projectData: "apps/desen-app/src/project-data.ts",
  publicationControls: "apps/desen-app/src/publication-controls.tsx",
  projectInventoryFixture: "apps/desen-app/src/project-inventory-fixture.ts",
  projectWorkspaceProfile: "apps/desen-app/src/project-workspace-profile.ts",
  referenceAuthoringProfile: "apps/desen-app/src/reference-authoring-profile.ts",
  referenceProjectFixtures: "apps/desen-app/src/reference-project-fixtures.ts",
  referenceWorkspaceProfile: "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
});

const temporaryDirectories = [];
let built;
let sourcePolicyInput;
let successor;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppEvergreenProductCompositionProofError);
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
      "# Desen App evergreen product composition",
      "",
      "Task: M10-T01C",
      "",
      "Status: DONE",
      "",
      "P-08: PROVEN",
      "",
      "P-09: PARTIAL",
      "",
      `Predecessor artifact: \`sha256:${DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN.sha256}\``,
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
  built = await buildDesenAppEvergreenProductCompositionEvidence();
  successor = await authenticateDesenAppEvergreenProductCompositionSuccessor();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-evergreen-product-composition");
  assert.equal(built.artifact.profile, "desen.app.evergreen-product-composition-proof.v1");
  assert.equal(built.artifact.task, "M10-T01C");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN,
  ]);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppEvergreenProductCompositionSourcePolicy(sourcePolicyInput);
  assert.equal(source.authenticatedWorkspaceProfile, true);
  assert.equal(source.exactOwnDataAdmission, true);
  assert.equal(source.packageCatalogBijection, true);
  assert.equal(source.runtimeAuthorityHostOwned, true);
  assert.equal(source.syntheticRunHostCallbacksIsolated, true);
  assert.equal(source.exactDocumentAdmissionShared, true);
  assert.equal(source.publicationControllerProfileBound, true);
  assert.equal(source.opaqueFixtureInventoryAuthority, true);
  assert.equal(source.fixtureInventoryAuthorityExclusive, true);
  assert.equal(source.fixtureInventoryCarriesNoWorkspaceAuthority, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.authority.source.genericReferenceResidueRejected, true);
  assert.equal(built.artifact.authority.source.explicitReferenceCompositionOnly, true);
  assert.equal(built.artifact.claim.referenceSignInPreservedAsExplicitComposition, true);
  assert.equal(built.artifact.authority.boundary.reviewedBrowserHarnessImportOnly, true);
  assert.equal(built.artifact.authority.boundary.explicitReferenceProfileEdgeAllowed, true);
  assert.equal(built.artifact.authority.boundary.unrelatedAppSourceStillDenied, true);
  assert.equal(built.artifact.authority.boundary.positiveBoundaryFixtureCovered, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[3], () => {
  assert.equal(built.artifact.authority.source.fullCatalogSetValidated, true);
  assert.equal(built.artifact.authority.focusedTests.multiCatalogProfile, true);
  assert.equal(built.artifact.authority.focusedTests.nonEntrySurfacePreview, true);
  assert.equal(
    built.artifact.authority.focusedTests.nonEntrySaveAndPublishBaseAuthorityCovered,
    true,
  );
  assert.equal(built.artifact.claim.multiCatalogSetCovered, true);
  assert.equal(built.artifact.claim.nonEntrySurfacePreviewCovered, true);
  assert.equal(built.artifact.claim.nonEntrySaveAndPublishBaseAuthorityCovered, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.authority.source.routeAndSourceIdentitySeparated, true);
  assert.equal(built.artifact.authority.source.storageIdentityHostOwned, true);
  assert.equal(built.artifact.authority.source.publicationBindingOptional, true);
  assert.equal(built.artifact.claim.exactDocumentAdmissionCovered, true);
  assert.equal(built.artifact.claim.publicationControllerProfileBindingCovered, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[5], () => {
  assert.equal(built.artifact.authority.focusedTests.nonAuthFullAppRender, true);
  assert.equal(built.artifact.authority.focusedTests.routeSlugDiffersFromSourceId, true);
  assert.equal(built.artifact.claim.nonAuthFullAppCompositionCovered, true);
  assert.equal(built.artifact.claim.syntheticRunHostIsolationCovered, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[6], () => {
  const coverage = built.artifact.authority.focusedTests;
  assert.equal(coverage.multiSurfaceProfile, true);
  assert.equal(coverage.wrongSurfaceRejected, true);
  assert.equal(coverage.missingCatalogPackageRejected, true);
  assert.equal(coverage.forgedRegistryRejected, true);
  assert.equal(coverage.forgedHandleRejected, true);
  assert.equal(coverage.opaqueFixtureInventoryCovered, true);
  assert.equal(coverage.fixtureAccessorAndHostileInputRejected, true);
  assert.equal(coverage.applicationFixtureAuthorityLifecycleCovered, true);
  assert.equal(coverage.fixtureRequestInputRemainsOpaque, true);
  assert.equal(coverage.fullAppSyntheticHostIsolationCovered, true);
  assert.equal(coverage.productAgnosticBrowserCanvasNameCovered, true);
  assert.equal(built.artifact.claim.opaqueFixtureInventoryCovered, true);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.claim.p08Status, "PROVEN");
  assert.equal(built.artifact.claim.p09Status, "PARTIAL");
  assert.equal(built.artifact.claim.m10T02Closed, false);
  assert.equal(built.artifact.claim.m10T03Closed, false);
  assert.equal(built.artifact.claim.m10T04Closed, false);
  assert.equal(built.artifact.claim.productionIntegrationCovered, false);
  assert.equal(built.artifact.claim.remoteDeploymentCovered, false);
  assert.equal(built.artifact.claim.g10Closed, false);
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppEvergreenProductCompositionEvidence();
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
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(receipts), true);
  assert.deepEqual(built.artifact.authority.historicalReaderBridge, {
    path: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.path,
    bytes: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.bytes,
    sha256: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.sha256,
    baseCommit: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.baseCommit,
    fileEntries: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.fileEntries,
    successorAddedPaths: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.successorAddedPaths,
    projections: DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.projections,
    canonicalDenseManifest: true,
    boundedGzip: true,
  });
});

test(DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_ROOT_TEST_NAMES[9], async () => {
  const sourceMutations = [
    [
      "projectWorkspaceProfile",
      "const PROFILE_AUTHORITIES = new WeakMap",
      "const PROFILE_AUTHORITIES = new Map",
    ],
    [
      "projectWorkspaceProfile",
      "packages.length !== catalogs.length",
      "packages.length < catalogs.length",
    ],
    [
      "projectInventoryFixture",
      "const FIXTURE_AUTHORITIES = new WeakMap",
      "const FIXTURE_AUTHORITIES = new Map",
    ],
    [
      "projectWorkspaceProfile",
      "document.entry !== profile.initialDocument.entry",
      "document.entry !== profile.sourceSurfaceId",
    ],
    [
      "application",
      "readProjectWorkspaceProfileAuthority(props.workspaceProfile)",
      "readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE)",
    ],
    [
      "application",
      'tokens: { resolve: () => Object.freeze({ status: "missing" }) }',
      "tokens: _baseHostPorts.tokens",
    ],
    [
      "referenceBrowserHarness",
      "workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}",
      "workspaceProfile={Object.freeze({})}",
    ],
    [
      "adapterCanvas",
      "Catalog, registry, ports and token authorities are mandatory and never inferred from examples.",
      "Catalog authority may be inferred from examples.",
    ],
    ["authoringPersistence", "profile.sourceKey", '"account-app-source"'],
    [
      "authoringPublication",
      "portDestination.hostId !== profile.publication.hostId",
      'portDestination.hostId !== "reference-host-web"',
    ],
    [
      "authoringPublication",
      "const AUTHORING_PUBLICATION_PORT_DESTINATIONS = new WeakMap",
      "const AUTHORING_PUBLICATION_PORT_DESTINATIONS = new Map",
    ],
    [
      "productBootstrap",
      "readProjectWorkspaceProfileAuthority(workspaceProfile)",
      "readProjectWorkspaceProfileAuthority(REFERENCE_SIGN_IN_WORKSPACE_PROFILE)",
    ],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppEvergreenProductCompositionSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  const parentBytes = await readFile(
    path.join(ROOT, DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN.path),
  );
  await assert.rejects(
    buildDesenAppEvergreenProductCompositionEvidence({
      fileOverrides: new Map([
        [DESEN_APP_EVERGREEN_PRODUCT_COMPOSITION_PARENT_PIN.path, changedByte(parentBytes)],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppEvergreenProductCompositionEvidence({ unexpected: true }),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "workspaceRoot", { get: () => ROOT, enumerable: true });
  await assert.rejects(
    buildDesenAppEvergreenProductCompositionEvidence(accessorOptions),
    expectedError("OPTIONS_INVALID"),
  );

  assert.throws(
    () => readDesenAppHistoricalReaderProjection(Object.freeze({}), "desen-app-design-run-modes"),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const projection = readDesenAppHistoricalReaderProjection(
    successor,
    "desen-app-design-run-modes",
  );
  assert.equal(projection.proofId, "desen-app-design-run-modes");
  assert.equal(Object.isFrozen(projection), true);

  const taskTimePath = "apps/desen-app/src/application.tsx";
  const firstTaskTimeCopy = readDesenAppHistoricalReaderTaskTimeFile(successor, taskTimePath);
  const secondTaskTimeCopy = readDesenAppHistoricalReaderTaskTimeFile(successor, taskTimePath);
  firstTaskTimeCopy[0] ^= 1;
  assert.notDeepEqual(firstTaskTimeCopy, secondTaskTimeCopy);
  const callerMutation = Buffer.from("exact caller mutation", "utf8");
  const materialized = materializeDesenAppHistoricalReaderFileOverrides(
    successor,
    new Map([[taskTimePath, callerMutation]]),
  );
  assert.deepEqual(materialized.get(taskTimePath), callerMutation);
  callerMutation[0] ^= 1;
  assert.notDeepEqual(materialized.get(taskTimePath), callerMutation);

  class HostileMap extends Map {}
  assert.throws(
    () => materializeDesenAppHistoricalReaderFileOverrides(successor, new HostileMap()),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorMap = new Map();
  Object.defineProperty(accessorMap, "entries", { get: () => Map.prototype.entries });
  assert.throws(
    () => materializeDesenAppHistoricalReaderFileOverrides(successor, accessorMap),
    expectedError("OPTIONS_INVALID"),
  );
  if (typeof SharedArrayBuffer !== "undefined") {
    assert.throws(
      () =>
        materializeDesenAppHistoricalReaderFileOverrides(
          successor,
          new Map([[taskTimePath, new Uint8Array(new SharedArrayBuffer(4))]]),
        ),
      expectedError("OPTIONS_INVALID"),
    );
  }

  const sparseInventory = new Array(1);
  assert.throws(
    () => projectDesenAppHistoricalReaderPathInventory(successor, sparseInventory),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorInventory = ["apps/desen-app/src/application.tsx"];
  Object.defineProperty(accessorInventory, "0", {
    get: () => "apps/desen-app/src/application.tsx",
    enumerable: true,
  });
  assert.throws(
    () => projectDesenAppHistoricalReaderPathInventory(successor, accessorInventory),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => projectDesenAppHistoricalReaderPathInventory(successor, new Proxy([], {})),
    expectedError("OPTIONS_INVALID"),
  );
  assert.deepEqual(
    projectDesenAppHistoricalReaderPathInventory(successor, [
      "apps/desen-app/src/application.tsx",
      "apps/desen-app/src/project-inventory-fixture.ts",
    ]),
    ["apps/desen-app/src/application.tsx"],
  );

  const bridgeBytes = await readFile(
    path.join(ROOT, DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.path),
  );
  const inflatedBridge = gunzipSync(bridgeBytes);
  const bridgeManifest = JSON.parse(inflatedBridge.toString("utf8"));
  const canonicalBridgeBytes = (manifest) => Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
  const baseCommitMutation = structuredClone(bridgeManifest);
  baseCommitMutation.baseCommit = "0".repeat(40);
  const pathMutation = structuredClone(bridgeManifest);
  const [firstBridgePath] = Object.keys(pathMutation.files);
  pathMutation.files["../escape"] = pathMutation.files[firstBridgePath];
  const base64Mutation = structuredClone(bridgeManifest);
  base64Mutation.files[firstBridgePath] = "*";
  const bridgeMutations = [
    changedByte(bridgeBytes),
    bridgeBytes.subarray(0, bridgeBytes.byteLength - 1),
    gzipSync(Buffer.concat([inflatedBridge, Buffer.from(" ")])),
    gzipSync(canonicalBridgeBytes(baseCommitMutation)),
    gzipSync(canonicalBridgeBytes(pathMutation)),
    gzipSync(canonicalBridgeBytes(base64Mutation)),
    gzipSync(Buffer.alloc(8 * 1_024 * 1_024 + 1)),
  ];
  for (const bridgeMutation of bridgeMutations) {
    await assert.rejects(
      buildDesenAppEvergreenProductCompositionEvidence({
        fileOverrides: new Map([
          [DESEN_APP_T01B_HISTORICAL_READER_BRIDGE_PIN.path, bridgeMutation],
        ]),
      }),
      expectedError("HISTORICAL_BRIDGE_DRIFT"),
    );
  }

  const artifactDirectory = await temporaryDirectory("desen-evergreen-artifact-");
  const artifactPath = path.join(artifactDirectory, "artifact.json");
  const written = await writeDesenAppEvergreenProductCompositionEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  const canonicalArtifactPath = await realpath(artifactPath);
  await verifyDesenAppEvergreenProductCompositionEvidence({
    artifactPath: canonicalArtifactPath,
    proofDocument: exactProofDocument(built.artifactSha256),
  });
  await assert.rejects(
    verifyDesenAppEvergreenProductCompositionEvidence({
      artifactBytes: changedByte(await readFile(artifactPath)),
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppEvergreenProductCompositionEvidence({
      artifactPath: canonicalArtifactPath,
      proofDocument: Buffer.from("Task: M10-T01C\nsha256:PENDING\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const unsafeDirectory = await temporaryDirectory("desen-evergreen-unsafe-");
  const missingParentPath = path.join(unsafeDirectory, "missing", "artifact.json");
  await assert.rejects(
    writeDesenAppEvergreenProductCompositionEvidence({ artifactPath: missingParentPath }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
