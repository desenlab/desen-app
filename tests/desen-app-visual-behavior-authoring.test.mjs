import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile as readLiveFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN,
  DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES,
  DesenAppVisualBehaviorAuthoringProofError,
  buildDesenAppVisualBehaviorAuthoringEvidence,
  verifyDesenAppVisualBehaviorAuthoringEvidence,
  verifyDesenAppVisualBehaviorAuthoringSourcePolicy,
  writeDesenAppVisualBehaviorAuthoringEvidence,
} from "../scripts/lib/desen-app-visual-behavior-authoring-proof.mjs";
import { createDesenAppHistoricalReaderReadFile } from "./desen-app-historical-reader-fixture.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const readFile = createDesenAppHistoricalReaderReadFile({
  workspaceRoot: ROOT,
  liveReadFile: readLiveFile,
});
const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  behaviorProjection: "apps/desen-app/src/authoring-behavior-projection.ts",
  conditions: "apps/desen-app/src/authoring-conditions.ts",
  connections: "apps/desen-app/src/authoring-connections.ts",
  eventActions: "apps/desen-app/src/authoring-event-actions.ts",
  fixtures: "apps/desen-app/src/authoring-fixtures.ts",
  behaviorControls: "apps/desen-app/src/behavior-controls.tsx",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  browserSpec: "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
});

const temporaryDirectories = [];
let built;
let sourcePolicyInput;

function expectedError(code) {
  return (error) => {
    assert.ok(error instanceof DesenAppVisualBehaviorAuthoringProofError);
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
      "# Desen App visual behavior authoring",
      "",
      "Task: M10-T01B",
      "",
      "Status: DONE",
      "",
      "P-08: PROVEN",
      "",
      "P-09: PARTIAL",
      "",
      `Predecessor artifact: \`sha256:${DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN.sha256}\``,
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
  built = await buildDesenAppVisualBehaviorAuthoringEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-visual-behavior-authoring");
  assert.equal(built.artifact.profile, "desen.app.visual-behavior-authoring-proof.v1");
  assert.equal(built.artifact.task, "M10-T01B");
  assert.equal(built.artifact.gate, null);
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN]);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[1], () => {
  assert.equal(built.artifact.authority.source.atomicInputConnection, true);
  assert.equal(built.artifact.authority.source.operationTriggerBoundary, true);
  assert.equal(built.artifact.claim.visualInputConnectionCovered, true);
  assert.equal(built.artifact.authority.source.requestInputRetained, false);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.authority.source.visualActionComposer, true);
  assert.equal(built.artifact.authority.source.advancedJsonRetained, true);
  assert.equal(built.artifact.claim.visualOperationActionCovered, true);
  assert.equal(built.artifact.authority.package.operationId, "com.example.auth/signIn");
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[3], () => {
  assert.equal(built.artifact.authority.source.visualConditionalPresence, true);
  assert.equal(built.artifact.claim.visualConditionalPresenceCovered, true);
  assert.equal(built.artifact.authority.source.genericRunControls, true);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.authority.source.sourceAndCatalogDerivedFixtures, true);
  assert.equal(built.artifact.authority.package.catalogId, "run.desen.reference.sign-in");
  assert.equal(built.artifact.authority.package.operationEffect, "network");
  assert.equal(built.artifact.authority.package.catalogFixtureOnly, true);
  assert.equal(built.artifact.claim.realHostOperationCovered, false);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[5], () => {
  assert.equal(
    built.artifact.authority.execution.browserTestName,
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  );
  assert.equal(built.artifact.authority.execution.browserTestDeclarations, 1);
  assert.equal(built.artifact.authority.execution.browserExecutedByVerifier, false);
  assert.equal(built.artifact.claim.authoredBrowserSmokeCovered, true);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.claim.p08Status, "PROVEN");
  assert.equal(built.artifact.claim.p09Status, "PARTIAL");
  assert.equal(built.artifact.claim.m10T02Closed, false);
  assert.equal(built.artifact.claim.m10T03Closed, false);
  assert.equal(built.artifact.claim.m10T04Closed, false);
  assert.equal(built.artifact.claim.remoteDeploymentCovered, false);
  assert.equal(built.artifact.claim.g10Closed, false);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[7], async () => {
  const second = await buildDesenAppVisualBehaviorAuthoringEvidence();
  assert.deepEqual(second.artifact, built.artifact);
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  const receipts = built.artifact.boundary.trackedReceipts;
  const paths = receipts.map(({ path: relativePath }) => relativePath);
  assert.equal(receipts.length, built.artifact.boundary.trackedFiles);
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(
    paths,
    paths.toSorted((left, right) => left.localeCompare(right, "en-US")),
  );
  assert.equal(Object.isFrozen(built.artifact), true);
  assert.equal(Object.isFrozen(receipts), true);
  const verified = await verifyDesenAppVisualBehaviorAuthoringEvidence();
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.equal(verified.rootTests, 9);
  assert.equal(verified.browserExecutedByVerifier, false);
});

test(DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_ROOT_TEST_NAMES[8], async () => {
  const sourceMutations = [
    [
      "connections",
      'value: Object.freeze({ $ref: "event.value" })',
      'value: Object.freeze({ $ref: "state.email" })',
    ],
    [
      "conditions",
      "export function applyAuthoringConditionEdit(",
      "function applyAuthoringConditionEdit(",
    ],
    ["behaviorProjection", 'action.type !== "operation.invoke"', 'action.type !== "state.set"'],
    [
      "behaviorControls",
      'aria-label="Visibility predicate JSON"',
      'aria-label="Hidden predicate JSON"',
    ],
    ["eventActionPanel", "No code or JSON is required.", "JSON is required."],
    [
      "fixtures",
      "Request input is deliberately never read or retained.",
      "Request input may be retained.",
    ],
    ["previewControls", "Next outcome for {operation.alias}", "Next sign-in outcome"],
    ["browserSpec", 'pressSequentially("designer@example.test")', 'press("d")'],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppVisualBehaviorAuthoringSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  const parentBytes = await readFile(
    path.join(ROOT, DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN.path),
  );
  await assert.rejects(
    buildDesenAppVisualBehaviorAuthoringEvidence({
      fileOverrides: new Map([
        [DESEN_APP_VISUAL_BEHAVIOR_AUTHORING_PARENT_PIN.path, changedByte(parentBytes)],
      ]),
    }),
    expectedError("PARENT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppVisualBehaviorAuthoringEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppVisualBehaviorAuthoringEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("# substituted report\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppVisualBehaviorAuthoringEvidence({ unknown: true }),
    expectedError("OPTIONS_INVALID"),
  );

  const temporaryRoot = await temporaryDirectory("desen-m10-t01b-proof-");
  const destination = path.join(temporaryRoot, "artifact.json");
  const written = await writeDesenAppVisualBehaviorAuthoringEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const guardedDestination = path.join(temporaryRoot, "guarded.json");
  await assert.rejects(
    writeDesenAppVisualBehaviorAuthoringEvidence({
      artifactPath: guardedDestination,
      beforeAtomicRename: () => {
        throw new Error("stop before rename");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  await assert.rejects(readFile(guardedDestination));
});
