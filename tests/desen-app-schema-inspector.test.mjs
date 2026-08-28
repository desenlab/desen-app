import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS,
  DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES,
  DesenAppSchemaInspectorProofError,
  buildDesenAppSchemaInspectorEvidence,
  verifyDesenAppSchemaInspectorEvidence,
  verifyDesenAppSchemaInspectorSourcePolicy,
  writeDesenAppSchemaInspectorEvidence,
} from "../scripts/lib/desen-app-schema-inspector-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze([
  "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json",
  "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json",
  "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
]);
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  inspectorSource: "apps/desen-app/src/authoring-inspector.ts",
  previewSource: "apps/desen-app/src/authoring-preview.ts",
  selectionSource: "apps/desen-app/src/authoring-selection.ts",
  panelSource: "apps/desen-app/src/inspector-panel.tsx",
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  globalCss: "apps/desen-app/src/styles.css",
});
const temporaryDirectories = [];
let parentArtifactBytes;
let sourcePolicyInput;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppSchemaInspectorProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function replaceOnce(source, search, replacement) {
  assert.equal(source.includes(search), true, `Mutation anchor not found: ${search}`);
  return source.replace(search, replacement);
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App schema inspector",
      "",
      "Task: M09-T05",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
      "M09-T06: NOT_PROVEN",
      "M09-T08: NOT_PROVEN",
      "M09-T10: NOT_PROVEN",
      "M09-T12: NOT_PROVEN",
      "M09-T14: NOT_PROVEN",
      "",
      `Final artifact: \`sha256:${artifactSha256}\``,
      "",
    ].join("\n"),
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  const sourceEntries = await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
      key,
      await readFile(path.join(ROOT, relativePath), "utf8"),
    ]),
  );
  sourcePolicyInput = Object.fromEntries(sourceEntries);
  parentArtifactBytes = new Map(
    await Promise.all(
      PARENT_PATHS.map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  built = await buildDesenAppSchemaInspectorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-schema-inspector");
  assert.equal(built.artifact.profile, "desen.app.schema-inspector-proof.v1");
  assert.equal(built.artifact.task, "M09-T05");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[1], () => {
  const policy = verifyDesenAppSchemaInspectorSourcePolicy(sourcePolicyInput);
  assert.equal(policy.authoringData.publicCatalogSdkDerivation, true);
  assert.equal(policy.authoringData.inspectorPlanFrozenWithComponentSummary, true);
  assert.deepEqual(built.artifact.claim.controlKinds, [
    "boolean",
    "enum",
    "integer",
    "number",
    "string",
  ]);
  assert.deepEqual(built.artifact.authority.schema.referenceKinds, [
    "boolean",
    "enum",
    "number",
    "string",
  ]);
  assert.deepEqual(built.artifact.authority.schema.syntheticCoveredKinds, [
    "integer",
    "mixed-primitive-enum",
  ]);
  assert.equal(built.artifact.authority.schema.referenceControls.length, 5);
  assert.equal(built.artifact.authority.schema.schemaAuthority, "component.propsSchema");
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[2], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.deepEqual(inspector.editableKinds, ["boolean", "enum", "integer", "number", "string"]);
  assert.equal(inspector.mutationUsesPublicEditorCoreOnly, true);
  assert.equal(inspector.editCommandCapturedAsExactOwnEnumerableData, true);
  assert.equal(inspector.editAccessorsSymbolsAndUnknownFieldsRejected, true);
  assert.equal(inspector.proxyGetTrapNotRequired, true);
  assert.equal(inspector.completeDocumentRevalidatedAfterEveryMutation, true);
  assert.equal(inspector.noPartialDocumentOnFailure, true);
  assert.equal(built.artifact.claim.publicEditorCoreAtomicMutation, true);
  assert.equal(built.artifact.claim.exactOwnDataEditCommandCapture, true);
  assert.equal(built.artifact.claim.hostileAccessorsSymbolsAndExtraFieldsRejected, true);
  assert.equal(built.artifact.claim.continuousSchemaRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[3], () => {
  const inspector = built.artifact.authority.source.inspector;
  const panel = built.artifact.authority.source.panel;
  assert.equal(inspector.dynamicAndStructuredLockPrecedesMutation, true);
  assert.equal(inspector.routeAndSelectionReadmissionRequired, true);
  assert.equal(panel.dynamicInteractiveControls, 0);
  assert.equal(panel.structuredInteractiveControls, 0);
  assert.equal(built.artifact.claim.dynamicValuesLocked, true);
  assert.equal(built.artifact.claim.structuredValuesLocked, true);
  assert.equal(built.artifact.claim.staleRouteAndSelectionRejected, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[4], () => {
  const preview = built.artifact.authority.source.preview;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(preview.publicPublisherOnly, true);
  assert.equal(preview.sourceReadmittedBeforePublication, true);
  assert.equal(preview.immutableBundleAndRevisionReturned, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherRejectionPreservesPriorSession, true);
  assert.equal(adapter.revisionReplacementDisposesPreviousSession, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.publisherFailurePreservesPriorSession, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[5], () => {
  const panel = built.artifact.authority.source.panel;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(panel.owner, "Desen App");
  assert.equal(panel.managedAdapterImports, 0);
  assert.equal(application.inspectorInsideManagedSubtree, false);
  assert.equal(adapter.inspectorImports, 0);
  assert.equal(adapter.selectionOverlayRemainsAppOwnedSibling, true);
  assert.equal(built.artifact.authority.source.css.managedDescendantSelectors, 0);
  assert.equal(built.artifact.claim.inspectorOutsideManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.selectionOverlayBoundaryRetained, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[6], async () => {
  const second = await buildDesenAppSchemaInspectorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[7], () => {
  assert.equal(
    verifyDesenAppSchemaInspectorSourcePolicy(sourcePolicyInput).inspector
      .completeDocumentRevalidatedAfterEveryMutation,
    true,
  );

  const mutations = [
    {
      ...sourcePolicyInput,
      authoringDataSource: replaceOnce(
        sourcePolicyInput.authoringDataSource,
        "deriveComponentInspectorControls(",
        "deriveManualInspectorControls(",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "createDesenEditorContinuousValidator([catalogValue])",
        "createUncheckedValidator([catalogValue])",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        'field.value.kind === "dynamic" || field.value.kind === "structured"',
        'field.value.kind === "never"',
      ),
    },
    {
      ...sourcePolicyInput,
      previewSource: replaceOnce(
        sourcePolicyInput.previewSource,
        "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
        "publishUncheckedSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: `${sourcePolicyInput.panelSource}\nvoid document.querySelector('input');\n`,
    },
    {
      ...sourcePolicyInput,
      adapterSource: replaceOnce(
        sourcePolicyInput.adapterSource,
        "<SelectionOverlay projection={projection} />",
        "<div data-managed-selection-overlay />",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
        "setAuthoringSession(Object.freeze({ document: result.document, preview }))",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        ".inspectorPanel",
        "[data-managed-capability-subtree] .inspectorPanel",
      ),
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyDesenAppSchemaInspectorSourcePolicy(mutation),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[8], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppSchemaInspectorEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppSchemaInspectorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 3);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[9], async () => {
  const directory = await temporaryDirectory("desen-m09-t05-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppSchemaInspectorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppSchemaInspectorEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);

  const linkedDestination = path.join(directory, "linked-destination.json");
  await symlink(destination, linkedDestination);
  await assert.rejects(
    writeDesenAppSchemaInspectorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactPath: artifactLink,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
});
