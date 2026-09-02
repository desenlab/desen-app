import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  DESEN_APP_FAILURE_FIXTURE_PARENT_PIN,
  DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES,
  DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN,
  DesenAppFailureFixtureProofError,
  authenticateDesenAppFailureFixtureSuccessor,
  buildDesenAppFailureFixtureEvidence,
  materializeDesenAppT02HistoricalReaderFileOverrides,
  readDesenAppT02HistoricalReaderTaskTimeFile,
  verifyDesenAppFailureFixtureEvidence,
  verifyDesenAppFailureFixtureSourcePolicy,
  writeDesenAppFailureFixtureEvidence,
} from "../scripts/lib/desen-app-failure-fixture-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const READER_PATH = "scripts/lib/desen-app-failure-fixture-proof.mjs";
const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  behaviorProjection: "apps/desen-app/src/authoring-behavior-projection.ts",
  conditions: "apps/desen-app/src/authoring-conditions.ts",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  behaviorControls: "apps/desen-app/src/behavior-controls.tsx",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  alert: "packages/reference-catalog-web/src/components/alert.tsx",
  textField: "packages/reference-catalog-web/src/components/text-field.tsx",
  button: "packages/reference-catalog-web/src/components/button.tsx",
  headlessSession: "packages/runtime-core/src/headless-session.ts",
  operationLifecycle: "packages/runtime-core/src/operation-lifecycle.ts",
});
const BROWSER_SPEC_PATH = "apps/desen-app-browser-e2e/failure-fixture.pw.ts";
const AUTHORING_CONNECTION_TEST_PATH = "apps/desen-app/test/authoring-connections.test.ts";

const temporaryDirectories = [];
let built;
let sourcePolicyInput;
let successor;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppFailureFixtureProofError);
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
      "# Desen App failure fixture",
      "",
      "Task: M10-T03",
      "",
      "Status: DONE",
      "",
      "P-09: PARTIAL",
      "",
      "P-10: PARTIAL",
      "",
      `Predecessor artifact: \`sha256:${DESEN_APP_FAILURE_FIXTURE_PARENT_PIN.sha256}\``,
      "",
      `Historical bridge: \`sha256:${DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.sha256}\``,
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
  built = await buildDesenAppFailureFixtureEvidence();
  successor = await authenticateDesenAppFailureFixtureSuccessor();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[0], async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-failure-fixture");
  assert.equal(built.artifact.profile, "desen.app.failure-fixture-proof.v1");
  assert.equal(built.artifact.task, "M10-T03");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_FAILURE_FIXTURE_PARENT_PIN]);
  const readerSource = await readFile(path.join(ROOT, READER_PATH), "utf8");
  assert.doesNotMatch(readerSource, /from\s+["'].+desen-app-input-pending-fixture-proof/u);
  assert.doesNotMatch(readerSource, /import\(["'].+desen-app-input-pending-fixture-proof/u);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[1], () => {
  const source = verifyDesenAppFailureFixtureSourcePolicy(sourcePolicyInput);
  const browser = built.artifact.authority.browser;
  assert.equal(source.criticalAlertSemanticsPreserved, true);
  assert.equal(source.conditionalRuntimeReevaluationPreserved, true);
  assert.equal(browser.authoredCriticalAlertCovered, true);
  assert.equal(browser.authoredFailedPredicateCovered, true);
  assert.equal(browser.idleAlertAbsent, true);
  assert.equal(built.artifact.claim.authoredCriticalAlertCovered, true);
  assert.equal(built.artifact.claim.authoredFailedPredicateCovered, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[2], () => {
  const source = built.artifact.authority.source;
  const packageAuthority = built.artifact.authority.package;
  assert.equal(source.catalogErrorFixtureProjectionGeneric, true);
  assert.equal(source.fixtureRequestInputOpaque, true);
  assert.deepEqual(packageAuthority.exactFixtureErrorCodes, ["invalidCredentials"]);
  assert.equal(packageAuthority.unavailableDeclaredButNotFixtureBacked, true);
  assert.equal(built.artifact.authority.browser.catalogOutcomeInventoryExact, true);
  assert.equal(built.artifact.authority.browser.undeclaredUnavailableFixtureAbsent, true);
  assert.equal(built.artifact.claim.catalogDeclaredPublicFailureCovered, true);
  assert.equal(built.artifact.claim.undeclaredUnavailableFixtureRejected, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[3], () => {
  const source = built.artifact.authority.source;
  const focused = built.artifact.authority.focusedTests;
  const browser = built.artifact.authority.browser;
  assert.equal(source.declaredPublicErrorOnly, true);
  assert.equal(source.technicalFailureRedactionPreserved, true);
  assert.equal(focused.declaredFailureAndTechnicalRedactionCovered, true);
  assert.equal(focused.conditionalAlertRemoveRestoreCovered, true);
  assert.equal(browser.realRuntimePendingBeforeFailure, true);
  assert.equal(browser.pendingAlertAbsent, true);
  assert.equal(browser.firstFailureAlertVisible, true);
  assert.equal(browser.visibleFailureStateAsserted, true);
  assert.equal(built.artifact.claim.realRuntimeFailureCovered, true);
  assert.equal(built.artifact.claim.visibleFailureStateCovered, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[4], () => {
  const browser = built.artifact.authority.browser;
  assert.equal(browser.retryCleanupCovered, true);
  assert.equal(browser.secondFailureAlertVisible, true);
  assert.equal(browser.postSettlementDoubleAnimationFrameObserved, true);
  assert.equal(browser.loadingCleanupCovered, true);
  assert.equal(built.artifact.claim.retryCleanupCovered, true);
  assert.equal(built.artifact.claim.firstAndRetryFailureVisibilityCovered, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[5], () => {
  const browser = built.artifact.authority.browser;
  assert.equal(browser.controlledInputPersistenceCovered, true);
  assert.equal(browser.routeContinuityCovered, true);
  assert.equal(browser.frameGeometryStable, true);
  assert.equal(browser.horizontalGeometryStable, true);
  assert.equal(browser.directNetworkOrDomMutationUsed, false);
  assert.equal(built.artifact.claim.controlledInputPersistenceCovered, true);
  assert.equal(built.artifact.claim.routeContinuityCovered, true);
  assert.equal(built.artifact.claim.frameGeometryStabilityCovered, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[6], () => {
  const source = built.artifact.authority.source;
  const focused = built.artifact.authority.focusedTests;
  assert.equal(source.referenceErrorCodeAbsentFromGenericSources, true);
  assert.equal(focused.genericReferenceErrorGuardCovered, true);
  assert.equal(built.artifact.claim.genericReferenceErrorAssumptionRejected, true);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[7], () => {
  const claim = built.artifact.claim;
  const browser = built.artifact.authority.browser;
  assert.equal(claim.p09Status, "PARTIAL");
  assert.equal(claim.p10Status, "PARTIAL");
  assert.equal(claim.m10T03Closed, true);
  assert.equal(claim.m10T04Closed, false);
  assert.equal(claim.successNavigationCovered, false);
  assert.equal(claim.realHostOperationCovered, false);
  assert.equal(claim.productionOperationCovered, false);
  assert.equal(claim.n036Closed, false);
  assert.equal(claim.g10Closed, false);
  assert.equal(browser.successNavigationAsserted, false);
  assert.equal(browser.realHostOperationAsserted, false);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppFailureFixtureEvidence();
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
    path: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.path,
    bytes: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.bytes,
    sha256: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.sha256,
    uncompressedBytes: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.uncompressedBytes,
    baseCommit: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.baseCommit,
    fileEntries: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.fileEntries,
    predecessorGapFiles: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.predecessorGapFiles,
    successorAddedPaths: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.successorAddedPaths,
    projections: DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.projections,
    canonicalDenseManifest: true,
    boundedGzip: true,
    parentProjectionAuthenticated: true,
  });

  const taskTimePath = "apps/desen-app/src/application.tsx";
  const firstCopy = readDesenAppT02HistoricalReaderTaskTimeFile(successor, taskTimePath);
  const secondCopy = readDesenAppT02HistoricalReaderTaskTimeFile(successor, taskTimePath);
  firstCopy[0] ^= 1;
  assert.notDeepEqual(firstCopy, secondCopy);
  const callerMutation = Buffer.from("exact caller mutation", "utf8");
  const materialized = materializeDesenAppT02HistoricalReaderFileOverrides(
    successor,
    new Map([[taskTimePath, callerMutation]]),
  );
  assert.deepEqual(materialized.get(taskTimePath), callerMutation);
  callerMutation[0] ^= 1;
  assert.notDeepEqual(materialized.get(taskTimePath), callerMutation);
  assert.equal(materialized.size, DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.fileEntries);
});

test(DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES[9], async () => {
  const sourceMutations = [
    [
      "authoringConnections",
      'readonly concurrency: "queue" | "reject" | "replace";',
      'readonly concurrency: "replace";',
    ],
    [
      "authoringConnections",
      'if (operationIndexes.length > 1) return failure("connection-conflict");',
      'if (operationIndexes.length > 2) return failure("connection-conflict");',
    ],
    ["behaviorControls", 'current?.concurrency ?? "reject"', 'current?.concurrency ?? "replace"'],
    [
      "behaviorControls",
      'const selected = compatible.find(({ value }) => value === field.value)?.value ?? "";',
      'const selected = compatible[0]?.value ?? "";',
    ],
    [
      "behaviorControls",
      "const reserved = new Set(reservedAliases.filter((alias) => alias !== currentAlias));",
      "const reserved = new Set();",
    ],
    [
      "behaviorControls",
      'if (!Object.hasOwn(current.input, field.value)) return [field.value, ""];',
      'if (!Object.hasOwn(current.input, field.value)) return [field.value, compatible[0]?.value ?? ""];',
    ],
    [
      "behaviorControls",
      "Object.keys(current.input).filter((inputName) => !declaredInputNames.has(inputName))",
      "Object.keys(current.input).filter(() => false)",
    ],
    [
      "behaviorControls",
      "const aliasAvailable = alias === current?.as || !reservedAliases.includes(alias);",
      "const aliasAvailable = true;",
    ],
    [
      "application",
      "onConnect={connectSelectedOperation}",
      'onConnect={() => ({ ok: false, reason: "edit-rejected" })}',
    ],
    ["textField", "event.currentTarget.value", "event.currentTarget.value.slice(-1)"],
    ["button", "const inactive = disabled || loading;", "const inactive = disabled;"],
    [
      "operationLifecycle",
      'record.lifecycle = Object.freeze({ status: "pending", pending: true });',
      'record.lifecycle = Object.freeze({ status: "idle", pending: false });',
    ],
    [
      "authoringFixtures",
      "Request input is deliberately never read or retained.",
      "Request input may be retained.",
    ],
    [
      "authoringFixtures",
      'deepFreezeProjection({ status: "failed", errorCode: outcome.errorCode as string })',
      'deepFreezeProjection({ status: "succeeded", value: outcome.fixtureValue })',
    ],
    ["alert", 'critical: "alert"', 'critical: "status"'],
    [
      "operationLifecycle",
      "if (!record.publicErrors.has(result.errorCode))",
      "if (record.publicErrors.has(result.errorCode))",
    ],
    [
      "headlessSession",
      "subscribeRuntimeActionTurnSettlements",
      "subscribeRuntimeActionTurnSettlements /* invalidCredentials */",
    ],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppFailureFixtureSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  const parentBytes = await readFile(path.join(ROOT, DESEN_APP_FAILURE_FIXTURE_PARENT_PIN.path));
  await assert.rejects(
    buildDesenAppFailureFixtureEvidence({
      fileOverrides: new Map([
        [DESEN_APP_FAILURE_FIXTURE_PARENT_PIN.path, changedByte(parentBytes)],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );

  const connectionTestBytes = await readFile(path.join(ROOT, AUTHORING_CONNECTION_TEST_PATH));
  await assert.rejects(
    buildDesenAppFailureFixtureEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_CONNECTION_TEST_PATH,
          Buffer.from(
            replaceOnce(
              connectionTestBytes.toString("utf8"),
              "rejects multiple ambiguous root invocations without exposing a candidate",
              "accepts multiple ambiguous root invocations",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );

  const browserBytes = await readFile(path.join(ROOT, BROWSER_SPEC_PATH));
  await assert.rejects(
    buildDesenAppFailureFixtureEvidence({
      fileOverrides: new Map([
        [
          BROWSER_SPEC_PATH,
          Buffer.from(
            replaceOnce(
              browserBytes.toString("utf8"),
              'await outcome.selectOption("error:invalidCredentials");',
              'await outcome.selectOption("success");',
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );

  const bridgeBytes = await readFile(
    path.join(ROOT, DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.path),
  );
  const inflatedBridge = gunzipSync(bridgeBytes);
  const bridgeManifest = JSON.parse(inflatedBridge.toString("utf8"));
  const baseMutation = structuredClone(bridgeManifest);
  baseMutation.baseCommit = "0".repeat(40);
  const pathMutation = structuredClone(bridgeManifest);
  const [firstBridgePath] = Object.keys(pathMutation.files);
  pathMutation.files["../escape"] = pathMutation.files[firstBridgePath];
  const projectionMutation = structuredClone(bridgeManifest);
  projectionMutation.projections["desen-app-input-pending-fixture"].result = "FAIL";
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
      buildDesenAppFailureFixtureEvidence({
        fileOverrides: new Map([[DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.path, bridgeMutation]]),
      }),
      expectedError("HISTORICAL_BRIDGE_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppFailureFixtureEvidence({ unexpected: true }),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "workspaceRoot", { get: () => ROOT, enumerable: true });
  await assert.rejects(
    buildDesenAppFailureFixtureEvidence(accessorOptions),
    expectedError("OPTIONS_INVALID"),
  );
  assert.throws(
    () => materializeDesenAppT02HistoricalReaderFileOverrides(Object.freeze({}), new Map()),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  class HostileMap extends Map {}
  assert.throws(
    () => materializeDesenAppT02HistoricalReaderFileOverrides(successor, new HostileMap()),
    expectedError("OPTIONS_INVALID"),
  );
  const accessorMap = new Map();
  Object.defineProperty(accessorMap, "entries", { get: () => Map.prototype.entries });
  assert.throws(
    () => materializeDesenAppT02HistoricalReaderFileOverrides(successor, accessorMap),
    expectedError("OPTIONS_INVALID"),
  );
  if (typeof SharedArrayBuffer !== "undefined") {
    assert.throws(
      () =>
        materializeDesenAppT02HistoricalReaderFileOverrides(
          successor,
          new Map([
            ["apps/desen-app/src/application.tsx", new Uint8Array(new SharedArrayBuffer(4))],
          ]),
        ),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.throws(
    () => readDesenAppT02HistoricalReaderTaskTimeFile(successor, "../escape"),
    expectedError("OPTIONS_INVALID"),
  );

  const artifactDirectory = await temporaryDirectory("desen-failure-artifact-");
  const artifactPath = path.join(artifactDirectory, "artifact.json");
  const written = await writeDesenAppFailureFixtureEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  const canonicalArtifactPath = await realpath(artifactPath);
  await verifyDesenAppFailureFixtureEvidence({
    artifactPath: canonicalArtifactPath,
    proofDocument: exactProofDocument(built.artifactSha256),
  });
  await assert.rejects(
    verifyDesenAppFailureFixtureEvidence({
      artifactBytes: changedByte(await readFile(artifactPath)),
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppFailureFixtureEvidence({
      artifactPath: canonicalArtifactPath,
      proofDocument: Buffer.from("Task: M10-T03\nsha256:PENDING\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const unsafeDirectory = await temporaryDirectory("desen-failure-unsafe-");
  const missingParentPath = path.join(unsafeDirectory, "missing", "artifact.json");
  await assert.rejects(
    writeDesenAppFailureFixtureEvidence({ artifactPath: missingParentPath }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
});
