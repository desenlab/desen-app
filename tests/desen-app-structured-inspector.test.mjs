import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN,
  DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES,
  DesenAppStructuredInspectorProofError,
  buildDesenAppStructuredInspectorEvidence,
  verifyDesenAppStructuredInspectorEvidence,
  verifyDesenAppStructuredInspectorSourcePolicy,
  writeDesenAppStructuredInspectorEvidence,
} from "../scripts/lib/desen-app-structured-inspector-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  inspectorSource: "apps/desen-app/src/authoring-inspector.ts",
  structuredJsonSource: "apps/desen-app/src/structured-json.ts",
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
  return (error) => error instanceof DesenAppStructuredInspectorProofError && error.code === code;
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
      "# Desen App structured inspector",
      "",
      "Task: M09-T06",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
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
  sourcePolicyInput = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  parentArtifactBytes = await readFile(path.join(ROOT, PARENT_PATH));
  built = await buildDesenAppStructuredInspectorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-structured-inspector");
  assert.equal(built.artifact.profile, "desen.app.structured-inspector-proof.v1");
  assert.equal(built.artifact.task, "M09-T06");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN]);
  assert.equal(built.artifact.boundary.parentArtifacts, 1);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[1], () => {
  const policy = verifyDesenAppStructuredInspectorSourcePolicy(sourcePolicyInput);
  assert.equal(policy.authoringData.publicCatalogSdkDerivation, true);
  assert.equal(policy.authoringData.recursiveControlPlanRetained, true);
  assert.equal(policy.authoringData.validationDocumentSnapshotRetained, true);
  assert.equal(policy.inspector.recursiveGroupProjection, true);
  assert.equal(policy.inspector.canonicalValuePointerReadmission, true);
  assert.equal(policy.inspector.accessibleQualifiedNameDisambiguation, true);
  assert.equal(policy.panel.recursiveGroupPresentation, true);
  assert.equal(policy.panel.semanticNestedGroupFieldsets, true);
  assert.deepEqual(policy.panel.fallbackReasons, [
    "array",
    "open-object",
    "multi-type",
    "reference",
    "combinator",
    "conditional",
    "pattern",
    "unsupported-schema",
    "derivation-limit",
  ]);
  assert.equal(built.artifact.claim.recursiveClosedObjectControls, true);
  assert.equal(built.artifact.claim.canonicalRfc6901Pointers, true);
  assert.equal(built.artifact.claim.completeFallbackReasonMatrix, true);
  assert.equal(built.artifact.claim.structuredJsonFallbackVisibleAndEditable, true);
  assert.equal(built.artifact.claim.accessibleDuplicateAndEmptyPropertyNames, true);
  assert.equal(built.artifact.claim.semanticNestedGroupFieldsets, true);
  assert.equal(built.artifact.authority.fallback.referenceCatalogHasNestedFallbackFixture, false);
  assert.equal(built.artifact.authority.fallback.syntheticAppTestsRequired, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[2], () => {
  const structured = built.artifact.authority.source.structuredJson;
  assert.equal(structured.parserProfile, "strict-bounded-json");
  assert.equal(structured.malformedAndNonFiniteRejected, true);
  assert.equal(structured.duplicateDecodedMembersRejected, true);
  assert.equal(structured.invalidUnicodeRejected, true);
  assert.deepEqual(structured.publisherLimitsEnforced, [
    "maxSourceUtf8Bytes",
    "maxDecodedStringCodeUnits",
    "maxNumberTokenCodeUnits",
    "maxJsonDepth",
    "maxJsonValueOccurrences",
  ]);
  assert.equal(structured.dynamicMemberNamesRejected, true);
  assert.equal(structured.detachedRecursivelyFrozenResult, true);
  assert.equal(structured.deterministicPrettyFormatting, true);
  assert.equal(structured.canonicalCompactFallbackForPrettyLimit, true);
  assert.equal(structured.boundedPrettyFormattingConstruction, true);
  assert.equal(built.artifact.claim.strictBoundedStructuredJsonCapture, true);
  assert.equal(built.artifact.claim.publisherJsonLimitsEnforced, true);
  assert.equal(built.artifact.claim.admittedStructuredJsonRemainsEditableAtPrettyLimit, true);
  assert.equal(built.artifact.claim.boundedPrettyFormattingConstruction, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[3], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.equal(inspector.nestedTopOwnerRebuild, true);
  assert.equal(inspector.deterministicWholePropsTransition, true);
  assert.equal(inspector.rootDeleteBeforeSetTransition, true);
  assert.equal(inspector.rootReducingSetsBeforeGrowth, true);
  assert.equal(inspector.unchangedRootPropsSkipped, true);
  assert.equal(inspector.rootTransitionCountLimit, 256);
  assert.equal(inspector.rootTransitionWorkByteLimit, 32 * 1024 * 1024);
  assert.equal(inspector.rootTransitionBudgetBeforeEditorCoreLoop, true);
  assert.equal(inspector.semanticRootNoOpReturnsValidatedDocument, true);
  assert.equal(inspector.validatedSourceSnapshotMutation, true);
  assert.equal(inspector.publicEditorCoreOnly, true);
  assert.equal(inspector.completeSourceRevalidation, true);
  assert.equal(inspector.noPartialDocumentOnFailure, true);
  assert.equal(built.artifact.claim.publicEditorCoreNestedMutation, true);
  assert.equal(built.artifact.claim.completeTopLevelOwnerRebuild, true);
  assert.equal(built.artifact.claim.rootPropsDeleteBeforeSet, true);
  assert.equal(built.artifact.claim.rootPropsShrinkBeforeGrowth, true);
  assert.equal(built.artifact.claim.unchangedRootPropsSkipped, true);
  assert.equal(built.artifact.claim.boundedSynchronousRootTransitions, true);
  assert.equal(built.artifact.claim.semanticRootNoOpSucceedsWithValidatedDocument, true);
  assert.equal(built.artifact.claim.validatedSourceSnapshotMutation, true);
  assert.equal(built.artifact.claim.continuousSchemaRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[4], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.equal(inspector.exactOwnDataEditCapture, true);
  assert.equal(inspector.exactOwnDataRouteAndSelectionCapture, true);
  assert.equal(inspector.detachedJsonCapture, true);
  assert.equal(inspector.dynamicLockBeforeMutation, true);
  assert.equal(inspector.dynamicAncestorLockBeforeMutation, true);
  assert.equal(inspector.routeSelectionAndControlReadmission, true);
  assert.equal(built.artifact.claim.dynamicValuesLocked, true);
  assert.equal(built.artifact.claim.dynamicAncestorGroupsLocked, true);
  assert.equal(built.artifact.claim.exactOwnDataRouteAndSelectionCapture, true);
  assert.equal(built.artifact.claim.controlHintsRemainOpaque, true);
  assert.equal(built.artifact.claim.staleRouteSelectionAndPointerRejected, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[5], () => {
  const preview = built.artifact.authority.source.preview;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(preview.publicPublisherOnly, true);
  assert.equal(preview.sourceReadmittedBeforePublication, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherFailurePreservesPriorSession, true);
  assert.equal(adapter.revisionReplacementDisposesPreviousSession, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.publisherFailurePreservesPriorSession, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[6], () => {
  const panel = built.artifact.authority.source.panel;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(panel.owner, "Desen App");
  assert.equal(panel.managedAdapterImports, 0);
  assert.equal(panel.accessibleErrorAndStatusFeedback, true);
  assert.equal(panel.memoizedStructuredFormatting, true);
  assert.equal(panel.canonicalNumericDraftAfterCommit, true);
  assert.equal(panel.singleInlineValidationAlertPerDraft, true);
  assert.equal(panel.helpDescriptionRetainedWithInlineError, true);
  assert.equal(panel.dynamicAncestorUnsetHidden, true);
  assert.equal(panel.stableInspectorFieldIdentity, true);
  assert.equal(panel.valueKindFocusHandoff, true);
  assert.equal(panel.semanticReplacementFocusTargets, true);
  assert.equal(application.inspectorInsideManagedSubtree, false);
  assert.equal(adapter.inspectorImports, 0);
  assert.equal(adapter.selectionOverlayRemainsAppOwnedSibling, true);
  assert.equal(built.artifact.authority.source.css.managedDescendantSelectors, 0);
  assert.equal(built.artifact.claim.inspectorOutsideManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.selectionOverlayBoundaryRetained, true);
  assert.equal(built.artifact.claim.memoizedStructuredFormatting, true);
  assert.equal(built.artifact.claim.canonicalNumericDraftWithInlineErrors, true);
  assert.equal(built.artifact.claim.describedHelpRetainedWithInlineErrors, true);
  assert.equal(built.artifact.claim.valueKindReplacementFocusHandoff, true);
  assert.equal(built.artifact.claim.stableInspectorFieldIdentity, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[7], async () => {
  const second = await buildDesenAppStructuredInspectorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[8], () => {
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
      authoringDataSource: replaceOnce(
        sourcePolicyInput.authoringDataSource,
        "validationDocument: sourceResult.value",
        "validationDocument: sourceValue",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        'captureExactOwnData(route, ["projectId", "surfaceId"])',
        'captureLooseOwnData(route, ["projectId", "surfaceId"])',
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "captureExactOwnData(selection, [",
        "captureLooseOwnData(selection, [",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "parseJsonPointer(capturedEdit.valuePointer)",
        "[]",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
        "createUncheckedValidator(prepared.model.validationCatalogs)",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "prepared.model.validationDocument",
        "document",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "for (const property of deletions)",
        "for (const property of sets)",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const MAX_ROOT_PROP_TRANSITIONS = 256",
        "const MAX_ROOT_PROP_TRANSITIONS = 2_560",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const MAX_ROOT_TRANSITION_WORK_BYTES = 32 * 1024 * 1024",
        "const MAX_ROOT_TRANSITION_WORK_BYTES = 320 * 1024 * 1024",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "canonicalizeJson(currentValue) === canonicalizeJson(nextPropertyValue)",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const sets = [...reducingSets.sort(), ...growingSets.sort()]",
        "const sets = [...growingSets.sort(), ...reducingSets.sort()]",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "transitionCount > MAX_ROOT_PROP_TRANSITIONS",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "if (transitionCount === 0) return document;",
        "if (transitionCount === 0) return undefined;",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "snapshotBytes > Math.floor(MAX_ROOT_TRANSITION_WORK_BYTES / transitionCount)",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        'field.control.kind === "group" && field.containsDynamicValue',
        'field.control.kind === "group" && false',
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        '? `${label} (${control.valuePointer || "/"})` : label',
        "? label : label",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        '? "Unnamed property"',
        '? ""',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'return "duplicate-member"',
        'return "invalid-json"',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'key.value.startsWith("$")',
        'key.value.endsWith("$")',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'measureUtf8Bytes(formatted) === "limit-exceeded" ? canonicalizeJson(value) : formatted',
        "formatted",
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        "state.codeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        "if (state.limitExceeded) return canonicalizeJson(value);",
        "if (false) return canonicalizeJson(value);",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        '"open-object": "Open object schema"',
        '"open-object-disabled": "Open object schema"',
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        replaceOnce(sourcePolicyInput.panelSource, "<fieldset", "<div"),
        "</fieldset>",
        "</div>",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "<legend className={styles.visuallyHidden}>{field.qualifiedLabel} group</legend>",
        "<span className={styles.visuallyHidden}>{field.qualifiedLabel} group</span>",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "const current = useMemo(",
        "const current = noMemo(",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "setDraft(String(value));",
        "setDraft(draft);",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        'id={errorId} role="alert"',
        'id={errorId} role="status"',
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        ") : null}\n      {field.description === undefined ? null : (",
        ") : field.description === undefined ? null : (",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "field.containsDynamicValue ||",
        "false ||",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "useLayoutEffect(() => {",
        "useEffect(() => {",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "previousValueKind.current !== field.value.kind",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "focusTarget.current?.focus()",
        "void focusTarget.current",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}`}",
        "key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}:${field.value.kind}`}",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(sourcePolicyInput.panelSource, "tabIndex={-1}", "tabIndex={0}"),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "ref={focusTargetRef}",
        "ref={undefined}",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: `${sourcePolicyInput.panelSource}\nvoid document.querySelector('textarea');\n`,
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
        ".structuredTextarea",
        "[data-managed-capability-subtree] .structuredTextarea",
      ),
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => verifyDesenAppStructuredInspectorSourcePolicy(mutation),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[9], async () => {
  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
      parentArtifactBytes: changedByte(parentArtifactBytes),
    }),
    expectedError("PARENT_DRIFT"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppStructuredInspectorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 1);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t06-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppStructuredInspectorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppStructuredInspectorEvidence({
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
    writeDesenAppStructuredInspectorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
      artifactPath: artifactLink,
      proofDocument,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
});
