import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-STRUCTURAL-EDITS.md";
const T02_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json";
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const INDEX_SOURCE_PATH = "packages/editor-core/src/index.ts";
const STRUCTURAL_EDITS_SOURCE_PATH = "packages/editor-core/src/structural-edits.ts";
const CONTENT_EDITS_SOURCE_PATH = "packages/editor-core/src/content-edits.ts";
const STATE_BINDING_EDITS_SOURCE_PATH = "packages/editor-core/src/state-binding-edits.ts";
const EVENT_ACTION_EDITS_SOURCE_PATH = "packages/editor-core/src/event-action-edits.ts";
const PERSISTENCE_SOURCE_PATH = "packages/editor-core/src/persistence.ts";
const CONTINUOUS_VALIDATION_SOURCE_PATH = "packages/editor-core/src/continuous-validation.ts";
const CONTENT_EDITS_TEST_PATH = "packages/editor-core/test/content-edits.test.ts";
const CONTENT_EDITS_TYPES_PATH = "packages/editor-core/test/content-edits.types.ts";
const PACKAGE_TEST_PATH = "packages/editor-core/test/structural-edits.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/structural-edits.types.ts";
const AUTHORING_ROUND_TRIP_TEST_PATH = "packages/editor-core/test/authoring-round-trip.test.ts";
const AUTHORING_ROUND_TRIP_TYPES_PATH = "packages/editor-core/test/authoring-round-trip.types.ts";
const PERSISTENCE_TEST_PATH = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES_PATH = "packages/editor-core/test/persistence.types.ts";
const CONTINUOUS_VALIDATION_TEST_PATH = "packages/editor-core/test/continuous-validation.test.ts";
const CONTINUOUS_VALIDATION_TYPES_PATH = "packages/editor-core/test/continuous-validation.types.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const ROOT_TEST_PATH = "tests/editor-core-structural-edits.test.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-structural-edits-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-structural-edits-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-structural-edits.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const DOCUMENT_LIMIT = 8_388_608;
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 22_402,
  sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
});

const PROTOCOL_RUNTIME_PATHS = Object.freeze([
  "packages/protocol/dist/canonicalization.js",
  "packages/protocol/dist/diagnostics.js",
  "packages/protocol/dist/index.js",
  "packages/protocol/dist/json-pointer.js",
]);
const VALIDATOR_RUNTIME_PATHS = Object.freeze([
  "packages/validator/dist/binding-contract-validation.js",
  "packages/validator/dist/component-contract-validation.js",
  "packages/validator/dist/embedded-schema-validation.js",
  "packages/validator/dist/execution-contract-validation.js",
  "packages/validator/dist/generated/0.1.0/structural-validators.js",
  "packages/validator/dist/index.js",
  "packages/validator/dist/interaction-contract-validation.js",
  "packages/validator/dist/schema-instance-validation.js",
  "packages/validator/dist/semantic-diagnostics.js",
  "packages/validator/dist/semantic-validation.js",
  "packages/validator/dist/standalone-runtime.js",
  "packages/validator/dist/structural-diagnostics.js",
  "packages/validator/dist/structural-validation.js",
  "packages/validator/dist/uri-reference.js",
  "packages/validator/dist/validation-internals.js",
]);
const DEPENDENCY_RUNTIME_PATHS = Object.freeze([
  "packages/protocol/package.json",
  "packages/validator/package.json",
  ...PROTOCOL_RUNTIME_PATHS,
  ...VALIDATOR_RUNTIME_PATHS,
]);
const CURRENT_EDITOR_RUNTIME_PATHS = Object.freeze([
  "packages/editor-core/package.json",
  "packages/editor-core/dist/index.js",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/content-edits.js",
  "packages/editor-core/dist/state-binding-edits.js",
  "packages/editor-core/dist/event-action-edits.js",
  "packages/editor-core/dist/persistence.js",
  "packages/editor-core/dist/continuous-validation.js",
]);
const RETAINED_EDITOR_RUNTIME_PATHS = Object.freeze([
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
]);
const ISOLATED_RUNTIME_PATHS = Object.freeze([
  ...CURRENT_EDITOR_RUNTIME_PATHS,
  ...DEPENDENCY_RUNTIME_PATHS,
]);
const DIST_PATHS = Object.freeze(
  [
    "index",
    "source-document",
    "stable-id-insert",
    "structural-edits",
    "content-edits",
    "state-binding-edits",
    "event-action-edits",
    "persistence",
    "continuous-validation",
  ].flatMap((name) => [
    `packages/editor-core/dist/${name}.d.ts`,
    `packages/editor-core/dist/${name}.d.ts.map`,
    `packages/editor-core/dist/${name}.js`,
    `packages/editor-core/dist/${name}.js.map`,
  ]),
);
const TRACKED_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  PACKAGE_PATH,
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  STRUCTURAL_EDITS_SOURCE_PATH,
  CONTENT_EDITS_SOURCE_PATH,
  STATE_BINDING_EDITS_SOURCE_PATH,
  EVENT_ACTION_EDITS_SOURCE_PATH,
  PERSISTENCE_SOURCE_PATH,
  CONTINUOUS_VALIDATION_SOURCE_PATH,
  INDEX_SOURCE_PATH,
  ...DIST_PATHS,
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  PACKAGE_TEST_PATH,
  PACKAGE_TYPES_PATH,
  CONTENT_EDITS_TEST_PATH,
  CONTENT_EDITS_TYPES_PATH,
  AUTHORING_ROUND_TRIP_TEST_PATH,
  AUTHORING_ROUND_TRIP_TYPES_PATH,
  PERSISTENCE_TEST_PATH,
  PERSISTENCE_TYPES_PATH,
  CONTINUOUS_VALIDATION_TEST_PATH,
  CONTINUOUS_VALIDATION_TYPES_PATH,
  PUBLIC_TEST_PATH,
  PUBLIC_TYPES_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
  PROOF_LIBRARY_PATH,
  GENERATOR_PATH,
  VERIFIER_PATH,
  ROOT_TEST_PATH,
]);
const TRACKED_PATH_SET = new Set(TRACKED_PATHS);
const RETAINED_T02_RECEIPT_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  "packages/editor-core/dist/source-document.d.ts",
  "packages/editor-core/dist/source-document.d.ts.map",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/source-document.js.map",
  "packages/editor-core/dist/stable-id-insert.d.ts",
  "packages/editor-core/dist/stable-id-insert.d.ts.map",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/stable-id-insert.js.map",
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
]);
const RETAINED_T03_RECEIPT_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  STRUCTURAL_EDITS_SOURCE_PATH,
  "packages/editor-core/dist/source-document.d.ts",
  "packages/editor-core/dist/source-document.d.ts.map",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/source-document.js.map",
  "packages/editor-core/dist/stable-id-insert.d.ts",
  "packages/editor-core/dist/stable-id-insert.d.ts.map",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/stable-id-insert.js.map",
  "packages/editor-core/dist/structural-edits.d.ts",
  "packages/editor-core/dist/structural-edits.d.ts.map",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/structural-edits.js.map",
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  PACKAGE_TEST_PATH,
  PACKAGE_TYPES_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
]);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "createDesenEditorDocument",
  "deleteDesenEditorNode",
  "insertDesenEditorNode",
  "moveDesenEditorNode",
  "reorderDesenEditorNode",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorDocument",
    "DesenEditorDocumentCreationFailure",
    "DesenEditorDocumentCreationResult",
    "DesenEditorDocumentCreationSuccess",
    "DesenEditorInsertDiagnostic",
    "DesenEditorInsertDiagnosticCode",
    "DesenEditorNodeDeleteCommand",
    "DesenEditorNodeInsertCommand",
    "DesenEditorNodeInsertFailure",
    "DesenEditorNodeInsertResult",
    "DesenEditorNodeInsertSuccess",
    "DesenEditorNodeMoveCommand",
    "DesenEditorNodeReorderCommand",
    "DesenEditorStructuralEditDiagnostic",
    "DesenEditorStructuralEditDiagnosticCode",
    "DesenEditorStructuralEditFailure",
    "DesenEditorStructuralEditResult",
    "DesenEditorStructuralEditSuccess",
  ].sort(compareText),
);
const EXPECTED_STRUCTURAL_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    "DesenEditorNodeDeleteCommand",
    "DesenEditorNodeMoveCommand",
    "DesenEditorNodeReorderCommand",
    "DesenEditorStructuralEditDiagnostic",
    "DesenEditorStructuralEditDiagnosticCode",
    "DesenEditorStructuralEditFailure",
    "DesenEditorStructuralEditResult",
    "DesenEditorStructuralEditSuccess",
  ].sort(compareText),
);
const EXPECTED_CONTENT_RUNTIME_EXPORTS = Object.freeze(
  [
    "clearDesenEditorNodeCondition",
    "deleteDesenEditorOwnerProp",
    "deleteDesenEditorOwnerStyleProperty",
    "deleteDesenEditorVariant",
    "deleteDesenEditorVariantProp",
    "deleteDesenEditorVariantStyleProperty",
    "insertDesenEditorVariant",
    "reorderDesenEditorVariant",
    "setDesenEditorNodeCondition",
    "setDesenEditorOwnerProp",
    "setDesenEditorOwnerStyleProperty",
    "setDesenEditorVariantCondition",
    "setDesenEditorVariantProp",
    "setDesenEditorVariantStyleProperty",
  ].sort(compareText),
);
const EXPECTED_CONTENT_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorContentEditDiagnostic",
    "DesenEditorContentEditDiagnosticCode",
    "DesenEditorContentEditFailure",
    "DesenEditorContentEditResult",
    "DesenEditorContentEditSuccess",
    "DesenEditorContentPredicate",
    "DesenEditorContentValue",
    "DesenEditorContentVariant",
    "DesenEditorNodeConditionClearCommand",
    "DesenEditorNodeConditionSetCommand",
    "DesenEditorOwnerPropDeleteCommand",
    "DesenEditorOwnerPropSetCommand",
    "DesenEditorOwnerStylePropertyDeleteCommand",
    "DesenEditorOwnerStylePropertySetCommand",
    "DesenEditorVariantConditionSetCommand",
    "DesenEditorVariantDeleteCommand",
    "DesenEditorVariantInsertCommand",
    "DesenEditorVariantPropDeleteCommand",
    "DesenEditorVariantPropSetCommand",
    "DesenEditorVariantReorderCommand",
    "DesenEditorVariantStylePropertyDeleteCommand",
    "DesenEditorVariantStylePropertySetCommand",
  ].sort(compareText),
);
const EXPECTED_CONTENT_EXPORTS = Object.freeze(
  [...EXPECTED_CONTENT_RUNTIME_EXPORTS, ...EXPECTED_CONTENT_TYPE_EXPORTS].sort(compareText),
);
const EXPECTED_STATE_BINDING_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorResourceInput",
    "deleteDesenEditorStateDeclaration",
    "insertDesenEditorStateDeclaration",
    "setDesenEditorNodeRepeatItems",
    "setDesenEditorNodeRepeatKey",
    "setDesenEditorResourceInput",
    "setDesenEditorStateInitial",
    "setDesenEditorStateSchema",
  ].sort(compareText),
);
const EXPECTED_STATE_BINDING_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorBindingValue",
    "DesenEditorNodeRepeatItemsSetCommand",
    "DesenEditorNodeRepeatKeySetCommand",
    "DesenEditorResourceInputDeleteCommand",
    "DesenEditorResourceInputSetCommand",
    "DesenEditorStateBindingEditDiagnostic",
    "DesenEditorStateBindingEditDiagnosticCode",
    "DesenEditorStateBindingEditFailure",
    "DesenEditorStateBindingEditResult",
    "DesenEditorStateBindingEditSuccess",
    "DesenEditorStateDeclaration",
    "DesenEditorStateDeclarationDeleteCommand",
    "DesenEditorStateDeclarationInsertCommand",
    "DesenEditorStateInitialSetCommand",
    "DesenEditorStateSchemaSetCommand",
  ].sort(compareText),
);
const EXPECTED_STATE_BINDING_EXPORTS = Object.freeze(
  [...EXPECTED_STATE_BINDING_RUNTIME_EXPORTS, ...EXPECTED_STATE_BINDING_TYPE_EXPORTS].sort(
    compareText,
  ),
);
const EXPECTED_EVENT_ACTION_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorAction",
    "deleteDesenEditorEventHandler",
    "insertDesenEditorAction",
    "insertDesenEditorEventHandler",
    "reorderDesenEditorAction",
    "replaceDesenEditorAction",
  ].sort(compareText),
);
const EXPECTED_EVENT_ACTION_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorAction",
    "DesenEditorActionDeleteCommand",
    "DesenEditorActionInsertCommand",
    "DesenEditorActionListPointer",
    "DesenEditorActionPointer",
    "DesenEditorActionReorderCommand",
    "DesenEditorActionReplaceCommand",
    "DesenEditorEventActionEditDiagnostic",
    "DesenEditorEventActionEditDiagnosticCode",
    "DesenEditorEventActionEditFailure",
    "DesenEditorEventActionEditResult",
    "DesenEditorEventActionEditSuccess",
    "DesenEditorEventHandlerDeleteCommand",
    "DesenEditorEventHandlerInsertCommand",
  ].sort(compareText),
);
const EXPECTED_EVENT_ACTION_EXPORTS = Object.freeze(
  [...EXPECTED_EVENT_ACTION_RUNTIME_EXPORTS, ...EXPECTED_EVENT_ACTION_TYPE_EXPORTS].sort(
    compareText,
  ),
);
const EXPECTED_PERSISTENCE_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorPersistencePort"]);
const EXPECTED_PERSISTENCE_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorPersistenceAdapter",
    "DesenEditorPersistenceAdapterFailureReason",
    "DesenEditorPersistenceAdapterReadResult",
    "DesenEditorPersistenceAdapterSourceRecord",
    "DesenEditorPersistenceAdapterWriteRequest",
    "DesenEditorPersistenceAdapterWriteResult",
    "DesenEditorPersistenceDiagnostic",
    "DesenEditorPersistenceDiagnosticCode",
    "DesenEditorPersistencePort",
    "DesenEditorSourceOpenResult",
    "DesenEditorSourceOpenSuccess",
    "DesenEditorSourceSaveRequest",
    "DesenEditorSourceSaveResult",
  ].sort(compareText),
);
const EXPECTED_PERSISTENCE_EXPORTS = Object.freeze(
  [...EXPECTED_PERSISTENCE_RUNTIME_EXPORTS, ...EXPECTED_PERSISTENCE_TYPE_EXPORTS].sort(compareText),
);
const EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS = Object.freeze([
  "createDesenEditorContinuousValidator",
]);
const EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorContinuousValidationReport",
    "DesenEditorContinuousValidator",
    "DesenEditorContinuousValidatorCreationFailure",
    "DesenEditorContinuousValidatorCreationResult",
    "DesenEditorContinuousValidatorCreationSuccess",
    "DesenEditorInvalidSubjectMapping",
  ].sort(compareText),
);
const EXPECTED_CURRENT_RUNTIME_EXPORTS = Object.freeze(
  [
    ...EXPECTED_RUNTIME_EXPORTS,
    ...EXPECTED_CONTENT_RUNTIME_EXPORTS,
    ...EXPECTED_STATE_BINDING_RUNTIME_EXPORTS,
    ...EXPECTED_EVENT_ACTION_RUNTIME_EXPORTS,
    ...EXPECTED_PERSISTENCE_RUNTIME_EXPORTS,
    ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_CURRENT_TYPE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_TYPE_EXPORTS,
    ...EXPECTED_CONTENT_TYPE_EXPORTS,
    ...EXPECTED_STATE_BINDING_TYPE_EXPORTS,
    ...EXPECTED_EVENT_ACTION_TYPE_EXPORTS,
    ...EXPECTED_PERSISTENCE_TYPE_EXPORTS,
    ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID",
  "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN",
  "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
  "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
  "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
  "run.desen.editor/STRUCTURAL_EDIT_TARGET_AMBIGUOUS",
  "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
]);
const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "deletes a complete node subtree while retaining the emptied source-slot key",
  "moves the exact subtree to a different owner slot without rewriting any identity",
  "moves to a behavior-owned slot and creates an absent destination only at index zero",
  "moves across slots of one owner and inserts at an existing destination boundary",
  "reorders by the post-removal final position and returns a fresh result for a no-op",
  "reorders a direct child inside a behavior-owned slot",
  "rejects deleting or moving a surface root and rejects same-slot move ambiguity",
  "rejects moving a node into itself, a descendant node, or a descendant behavior",
  "requires unique surface-wide target and owner identities without choosing a first match",
  "requires reorder membership and validates both move and reorder positions atomically",
  "rejects malformed commands, extra authority, symbols, prototypes, and active properties",
  "creates and addresses Object.prototype-named slots only as own data",
  "preserves structural diagnostics for a forged current Source",
  "accepts a resulting depth of 64 and rejects a move that would create depth 65",
  "admits exactly 25,000 surface identities and rejects the next occurrence",
  "admits an exact 8 MiB Source and rejects a one-byte crossing before mutation",
]);
const EXPECTED_PERSISTENCE_TEST_NAMES = Object.freeze([
  "captures an exact stable adapter and invokes both callbacks without a receiver",
  "re-admits found parsed values as detached frozen documents with authoring and extensions",
  "fails closed for malformed reads, invalid stored Source, and unexpected read rejection",
  "maps explicit adapter read and write failures without leaking platform detail",
  "sends fresh complete RFC 8785 bytes including unresolved authoring and extensions",
  "accepts only generation settlements that match the exact compare-and-set precondition",
  "treats rejected, explicitly uncertain, and malformed write settlements as indeterminate",
  "rejects malformed save/open requests and invalid documents before adapter invocation",
  "accepts an exact 8 MiB Source and rejects a one-byte crossing on both open and save",
  "preserves atomic compare-and-set behavior when two opened generations race",
]);
const EXPECTED_PUBLIC_TEST_NAMES = Object.freeze([
  "the package manifest keeps one exact root export and the declared runtime dependencies",
  "the emitted public module graph stays platform-neutral and execution-closed",
  "the built public package resolves through its export map and exposes the reviewed runtime exports",
  "the emitted factory returns the direct plain frozen Source without a hidden model",
  "the emitted factory detaches caller input and creates independent snapshots",
  "the emitted factory admits structurally valid unresolved capability use",
  "the emitted factory rejects an invalid Source root without a partial document",
  "the emitted factory rejects an invalid embedded schema at its exact pointer",
  "the emitted factory rejects executable non-JSON data without a partial document",
  "the emitted factory rejects getter and toJSON hooks without invoking caller code",
  "the emitted continuous validator snapshots Catalogs and maps explicit invalid subjects",
  "the emitted insert command allocates a stable id and returns one new direct Source",
  "the emitted insert command is deterministic and keeps identity allocation surface-local",
  "the emitted insert command creates Object.prototype-named slots as own data",
  "the emitted insert command rejects missing, ambiguous, and invalid positions atomically",
  "the emitted insert command rejects active or authority-expanding command input",
  "the emitted structural commands delete, move, and reorder without rewriting identities",
  "the emitted move command targets behavior slots and creates prototype-named own data",
  "the emitted structural commands reject roots, cycles, and invalid positions atomically",
  "the emitted structural commands reject active and authority-expanding command input",
  "the emitted base content commands edit component and behavior owners",
  "the emitted condition and variant lifecycle commands preserve ordered semantics",
  "the emitted delete and variant-update commands retain emptied own containers",
  "the emitted content commands reject missing, ambiguous, invalid, and structural paths atomically",
  "the emitted content commands enforce own-data shapes and contain Proxy reflection failures atomically",
  "the emitted content commands are deterministic, immutable, and Catalog-unresolved",
  "the emitted state declaration commands preserve exact lifecycle and whole schema-initial values",
  "the emitted repeat commands replace whole item and key bindings without changing coupled fields",
  "the emitted resource input commands create and delete own prototype-sensitive bindings",
  "the emitted state and binding commands reject missing, duplicate, ambiguous, and structural failures atomically",
  "the emitted state and binding commands enforce own-data shapes and contain Proxy reflection failures atomically",
  "the emitted state and binding commands are deterministic, immutable, and semantically unresolved",
  "the emitted event-handler commands edit node and behavior owners with all seven closed actions",
  "the emitted action insert command preserves root and nested settlement order",
  "the emitted replace, delete, and reorder commands address nested actions without collapsing arrays",
  "the emitted event and action commands preserve exact failure classes without partial authority",
  "the emitted event and action commands enforce exact own data and contain Proxy traps",
  "the emitted event and action commands are deterministic, immutable, and semantically unresolved",
  "the emitted factory isolates authoring and round-trips all Source extension locations",
  "all 32 emitted mutation commands isolate authoring and preserve extension parsed values",
  "the emitted persistence port re-admits reads and saves complete canonical Source bytes",
  "the emitted persistence port validates every compare-and-set settlement and uncertainty",
  "the emitted persistence port enforces structural readmission and the full 8 MiB Source bound",
  "[proof-core] two fresh final builds are byte-identical and preserve honest scope",
  "[proof-core] rejects a wrapper-returning or mutable public runtime",
  "[proof-core] rejects caller retention and partial failure authority",
  "[proof-core] rejects admission that becomes semantically too strict",
  "[proof-core] rejects source, TSDoc, import, distribution, and manifest drift",
  "[proof-core] rejects focused-test inventory drift",
  "[proof-core] rejects accessor, inherited, symbol, and Proxy options without hooks",
]);
const EXPECTED_T07_TEST_AUTHORITY_SHA256 = Object.freeze({
  [AUTHORING_ROUND_TRIP_TEST_PATH]:
    "7240bb77e558485e5b2a8c0645601fe7276c350e307d9dad11a00a2ac14dfaa2",
  [AUTHORING_ROUND_TRIP_TYPES_PATH]:
    "24c41948e51d59c31a342d391a84bd229d39123c8764c3385b2402e1535d0739",
});
const EXPECTED_T08_AUTHORITY_SHA256 = Object.freeze({
  [PERSISTENCE_SOURCE_PATH]: "075655fa60dcf9bcc9dcdf73684e77d605f23e164ddd13a1aee086d132cb7a25",
  "packages/editor-core/dist/persistence.d.ts":
    "7456015b5986feb042b26010ddf77ebf9f4a36973e29c2c06c55125089bca58f",
  "packages/editor-core/dist/persistence.d.ts.map":
    "a1464155dce24f26dedced82a570eb3307bba3c94d956750390b197ba4e3ed49",
  "packages/editor-core/dist/persistence.js":
    "97005521aaa3a9118ad868e846d7a3d5545380c3e78245fb9e9cc267d9c3a672",
  "packages/editor-core/dist/persistence.js.map":
    "8f3e4e5dc850a9f938062e4b0dd605fdd70af3ed598bd6fb348d4cd3ba721b3f",
  [PERSISTENCE_TEST_PATH]: "17d86804a38c243cbd75a97649b3e9f6716ea57206453851bd98216937b5bc54",
  [PERSISTENCE_TYPES_PATH]: "da5114ec835c91e02df73ef58fd3f2a3f8a85508eb0e939d1c1c845bcfbd87f2",
  [PUBLIC_TEST_PATH]: "1eb2d878c95ea3655e89afc97e7f72d4f8b134cbf8c7022a268597efe4ed7cf4",
  [PUBLIC_TYPES_PATH]: "04a7b314398424563b765f1de60105c775aa13485c4b8913250edd21bd0f632a",
  [ROOT_TEST_PATH]: "3adcd2326e9122130d782a5890ee31810fa17376146f283ecf08a94d90b1ae13",
});

const BUILD_OPTION_KEYS = Object.freeze([
  "beforeAuthorityRecheck",
  "fileOverrides",
  "prerequisiteBytes",
  "prerequisitePath",
  "runtime",
]);
const VERIFY_OPTION_KEYS = Object.freeze([
  "artifactBytes",
  "artifactPath",
  "buildOptions",
  "proofDocumentBytes",
  "proofDocumentPath",
]);
const WRITE_OPTION_KEYS = Object.freeze(["beforeAtomicRename", "destinationPath"]);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_VIEW_INTRINSICS = Object.freeze({
  buffer: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get,
  byteLength: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get,
  byteOffset: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset")?.get,
});

export const EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN = Object.freeze({
  task: "M08-T02",
  path: T02_ARTIFACT_PATH,
  bytes: 19_561,
  sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
});

export const EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M08-T02 artifact and isolated runtime graph",
  "[determinism] two fresh M08-T03 builds are byte-identical",
  "[behavior] proves delete, move, reorder, stable identity, limits, and atomic diagnostics",
  "[mutation] rejects runtime substitution and tracked boundary mutation",
  "[artifact] verifies exact artifact bytes and one exact final proof pin",
  "[writer] atomically commits exact bytes and preserves the previous destination on failure",
  "[writer-filesystem] rejects symlink, hard-link, and non-file destinations",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[immutability] freezes evidence and states the exact nonclaim boundary",
]);

export const DEFAULT_EDITOR_CORE_STRUCTURAL_EDITS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCoreStructuralEditsProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreStructuralEditsProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreStructuralEditsProofError(code, message, details);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return value;
  }
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function assertDeepFrozen(value, label) {
  const pending = [value];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (!Object.isFrozen(current)) fail("BEHAVIOR_DRIFT", `${label} must be recursively frozen.`);
    pending.push(...Object.values(current));
  }
}

function captureByteInput(value, label) {
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
    fail("OPTIONS_INVALID", `${label} must be a non-shared byte view or string.`);
  }
  for (const key of ["buffer", "byteLength", "byteOffset", "length"]) {
    if (Object.hasOwn(value, key)) fail("OPTIONS_INVALID", `${label} shadows byte authority.`);
  }
  const buffer = BYTE_VIEW_INTRINSICS.buffer?.call(value);
  const byteLength = BYTE_VIEW_INTRINSICS.byteLength?.call(value);
  const byteOffset = BYTE_VIEW_INTRINSICS.byteOffset?.call(value);
  if (utilTypes.isSharedArrayBuffer(buffer)) {
    fail("OPTIONS_INVALID", `${label} cannot alias shared mutable memory.`);
  }
  return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
}

function captureExactObject(raw, allowedKeys, label) {
  if (raw === undefined) return Object.create(null);
  if (typeof raw !== "object" || raw === null || utilTypes.isProxy(raw)) {
    fail("OPTIONS_INVALID", `${label} must be a plain non-Proxy object.`);
  }
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== null && prototype !== Object.prototype) {
    fail("OPTIONS_INVALID", `${label} cannot carry inherited authority.`);
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      fail("OPTIONS_INVALID", `${label} contains unknown authority.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${key} must be an own enumerable data property.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureFileOverrides(raw) {
  if (raw === undefined) return new Map();
  const source = captureExactObject(raw, TRACKED_PATHS, "fileOverrides");
  const captured = new Map();
  for (const [relativePath, value] of Object.entries(source)) {
    if (!TRACKED_PATH_SET.has(relativePath)) {
      fail("OPTIONS_INVALID", `Untracked file override: ${relativePath}`);
    }
    captured.set(relativePath, captureByteInput(value, `fileOverrides.${relativePath}`));
  }
  return captured;
}

function captureRuntime(raw) {
  if (raw === undefined) return undefined;
  const keys = [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
  ];
  const source = captureExactObject(raw, keys, "buildOptions.runtime");
  for (const key of keys) {
    if (typeof source[key] !== "function" || utilTypes.isProxy(source[key])) {
      fail("OPTIONS_INVALID", `buildOptions.runtime.${key} must be a non-Proxy function.`);
    }
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, source[key]])));
}

function captureBuildOptions(raw) {
  const source = captureExactObject(raw, BUILD_OPTION_KEYS, "buildOptions");
  if (source.prerequisitePath !== undefined && typeof source.prerequisitePath !== "string") {
    fail("OPTIONS_INVALID", "buildOptions.prerequisitePath must be a string.");
  }
  if (
    source.beforeAuthorityRecheck !== undefined &&
    (typeof source.beforeAuthorityRecheck !== "function" ||
      utilTypes.isProxy(source.beforeAuthorityRecheck))
  ) {
    fail("OPTIONS_INVALID", "buildOptions.beforeAuthorityRecheck must be a non-Proxy function.");
  }
  return Object.freeze({
    beforeAuthorityRecheck: source.beforeAuthorityRecheck,
    fileOverrides: captureFileOverrides(source.fileOverrides),
    prerequisiteBytes:
      source.prerequisiteBytes === undefined
        ? undefined
        : captureByteInput(source.prerequisiteBytes, "buildOptions.prerequisiteBytes"),
    prerequisitePath: source.prerequisitePath,
    runtime: captureRuntime(source.runtime),
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

async function openCanonicalDirectory(directoryPath, label) {
  let handle;
  try {
    const canonical = await realpath(directoryPath);
    const named = await lstat(directoryPath);
    if (canonical !== directoryPath || !named.isDirectory() || named.isSymbolicLink()) {
      fail("FILESYSTEM_UNSAFE", `${label} is not one canonical named directory.`);
    }
    handle = await open(directoryPath, DIRECTORY_READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isDirectory() || !sameIdentity(named, opened)) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while opening.`);
    }
    return Object.freeze({ directoryPath, handle, label, opened });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be opened safely.`, String(error));
  }
}

async function assertCanonicalDirectoryUnchanged(capture) {
  try {
    const [handleAfter, namedAfter, canonicalAfter] = await Promise.all([
      capture.handle.stat(),
      lstat(capture.directoryPath),
      realpath(capture.directoryPath),
    ]);
    if (
      !handleAfter.isDirectory() ||
      !sameIdentity(capture.opened, handleAfter) ||
      !namedAfter.isDirectory() ||
      namedAfter.isSymbolicLink() ||
      !sameIdentity(capture.opened, namedAfter) ||
      canonicalAfter !== capture.directoryPath
    ) {
      fail("FILESYSTEM_UNSAFE", `${capture.label} changed identity during the authority read.`);
    }
  } catch (error) {
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${capture.label} became unavailable during the authority read.`);
  }
}

async function readNoFollow(
  relativeOrAbsolutePath,
  label,
  maxBytes = MAX_AUTHORITY_BYTES,
  beforeAuthorityRecheck = undefined,
) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.join(WORKSPACE_ROOT, relativeOrAbsolutePath);
  const parent = path.dirname(absolutePath);
  let rootCapture;
  let parentCapture;
  let handle;
  try {
    rootCapture = await openCanonicalDirectory(WORKSPACE_ROOT, "Proof workspace root");
    parentCapture = await openCanonicalDirectory(parent, `${label} parent`);
    const before = await lstat(absolutePath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", `${label} must be one unlinked regular file.`);
    }
    if (before.size > maxBytes) fail("AUTHORITY_LIMIT", `${label} exceeds the read bound.`);
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while opening.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    await beforeAuthorityRecheck?.(Object.freeze({ absolutePath, label }));
    const namedAfter = await lstat(absolutePath);
    if (
      bytes.byteLength !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mode !== before.mode ||
      after.nlink !== 1 ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      namedAfter.nlink !== 1 ||
      !sameIdentity(opened, namedAfter) ||
      namedAfter.size !== opened.size
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while reading.`);
    }
    await assertCanonicalDirectoryUnchanged(parentCapture);
    await assertCanonicalDirectoryUnchanged(rootCapture);
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be read safely.`, String(error));
  } finally {
    await handle?.close().catch(() => undefined);
    await parentCapture?.handle.close().catch(() => undefined);
    await rootCapture?.handle.close().catch(() => undefined);
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`, String(error));
  }
}

async function trackedBytes(relativePath, options) {
  const live = await readNoFollow(
    relativePath,
    relativePath,
    MAX_AUTHORITY_BYTES,
    options.beforeAuthorityRecheck,
  );
  const override = options.fileOverrides.get(relativePath);
  if (override === undefined) return live;
  if (!override.equals(live)) fail("BOUNDARY_DRIFT", `${relativePath} mutation was rejected.`);
  return override;
}

function receipt(relativePath, bytes) {
  return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
}

function exactArray(actual, expected, code, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} drifted.`, { actual, expected });
  }
}

function staticModuleSpecifiers(source) {
  return [
    ...source.matchAll(/^\s*(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/gm),
  ].map((match) => match[1]);
}

function exportedNames(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_DRIFT", `${fileName} contains parse diagnostics.`);
  }
  const names = [];
  let tsdocDeclarations = 0;
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (
      !ts.isTypeAliasDeclaration(statement) &&
      !ts.isInterfaceDeclaration(statement) &&
      !ts.isFunctionDeclaration(statement)
    ) {
      continue;
    }
    const name = statement.name?.text;
    if (name !== undefined) names.push(name);
    const leading = sourceText.slice(statement.getFullStart(), statement.getStart(sourceFile));
    if (/\/\*\*[\s\S]*?\*\//u.test(leading)) tsdocDeclarations += 1;
  }
  return Object.freeze({ names: names.sort(compareText), tsdocDeclarations });
}

function reexportedNames(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_DRIFT", `${fileName} contains parse diagnostics.`);
  }
  const runtime = [];
  const types = [];
  const modules = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail("SOURCE_DRIFT", `${fileName} may contain only explicit named re-exports.`);
    }
    modules.push(statement.moduleSpecifier.text);
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail("SOURCE_DRIFT", `${fileName} must not alias public exports.`);
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    runtime: Object.freeze(runtime.sort(compareText)),
    types: Object.freeze(types.sort(compareText)),
    modules: Object.freeze(modules.sort(compareText)),
  });
}

function testNames(source) {
  return [...source.matchAll(/^\s*(?:it|test)\(\s*["']([^"']+)["']/gm)].map((match) => match[1]);
}

function countTypeAssertions(source) {
  return [...source.matchAll(/@ts-expect-error/g)].length;
}

function verifyBoundary(files) {
  for (const [relativePath, expectedSha256] of Object.entries(EXPECTED_T08_AUTHORITY_SHA256)) {
    if (sha256(files.get(relativePath)) !== expectedSha256) {
      fail(
        relativePath.includes("/test/") || relativePath === ROOT_TEST_PATH
          ? "TEST_INVENTORY_DRIFT"
          : "BOUNDARY_DRIFT",
        `The exact M08-T08 successor authority drifted: ${relativePath}.`,
      );
    }
  }
  const manifest = parseJson(files.get(PACKAGE_PATH), PACKAGE_PATH);
  if (
    manifest.name !== "@desen/editor-core" ||
    manifest.private !== true ||
    manifest.type !== "module" ||
    manifest.sideEffects !== false ||
    JSON.stringify(manifest.files) !== JSON.stringify(["dist"]) ||
    JSON.stringify(manifest.exports) !==
      JSON.stringify({ ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } }) ||
    JSON.stringify(manifest.dependencies) !==
      JSON.stringify({ "@desen/protocol": "workspace:*", "@desen/validator": "workspace:*" }) ||
    manifest.scripts?.["test:structural-edits"] !== "vitest run test/structural-edits.test.ts" ||
    manifest.scripts?.["test:content-edits"] !== "vitest run test/content-edits.test.ts" ||
    manifest.scripts?.["test:state-binding-edits"] !==
      "vitest run test/state-binding-edits.test.ts" ||
    manifest.scripts?.["test:event-action-edits"] !==
      "vitest run test/event-action-edits.test.ts" ||
    manifest.scripts?.["test:authoring-round-trip"] !==
      "vitest run test/authoring-round-trip.test.ts" ||
    manifest.scripts?.["test:persistence"] !== "vitest run test/persistence.test.ts" ||
    manifest.scripts?.["test:continuous-validation"] !==
      "vitest run test/continuous-validation.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core manifest boundary drifted.");
  }

  const sourceText = decodeUtf8(
    files.get(STRUCTURAL_EDITS_SOURCE_PATH),
    STRUCTURAL_EDITS_SOURCE_PATH,
  );
  const sourceExports = exportedNames(sourceText, STRUCTURAL_EDITS_SOURCE_PATH);
  exactArray(
    sourceExports.names,
    EXPECTED_STRUCTURAL_EXPORTS,
    "SOURCE_DRIFT",
    "Structural-edit source exports",
  );
  if (sourceExports.tsdocDeclarations !== EXPECTED_STRUCTURAL_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public structural-edit declaration must retain TSDoc.");
  }
  for (const literal of ["8_388_608", "25_000", "maxSourceTreeDepth: 64"]) {
    if (!sourceText.includes(literal)) fail("LIMIT_DRIFT", `Missing fixed limit: ${literal}`);
  }
  for (const code of EXPECTED_DIAGNOSTIC_CODES) {
    if (!sourceText.includes(`"${code}"`)) fail("DIAGNOSTIC_DRIFT", `Missing code: ${code}`);
  }

  const contentText = decodeUtf8(files.get(CONTENT_EDITS_SOURCE_PATH), CONTENT_EDITS_SOURCE_PATH);
  const contentExports = exportedNames(contentText, CONTENT_EDITS_SOURCE_PATH);
  exactArray(
    contentExports.names,
    EXPECTED_CONTENT_EXPORTS,
    "SOURCE_DRIFT",
    "Content-edit source exports",
  );
  if (contentExports.tsdocDeclarations !== EXPECTED_CONTENT_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public content-edit declaration must retain TSDoc.");
  }

  const stateBindingText = decodeUtf8(
    files.get(STATE_BINDING_EDITS_SOURCE_PATH),
    STATE_BINDING_EDITS_SOURCE_PATH,
  );
  const stateBindingExports = exportedNames(stateBindingText, STATE_BINDING_EDITS_SOURCE_PATH);
  exactArray(
    stateBindingExports.names,
    EXPECTED_STATE_BINDING_EXPORTS,
    "SOURCE_DRIFT",
    "State/binding-edit source exports",
  );
  if (stateBindingExports.tsdocDeclarations !== EXPECTED_STATE_BINDING_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public state/binding-edit declaration must retain TSDoc.");
  }

  const eventActionText = decodeUtf8(
    files.get(EVENT_ACTION_EDITS_SOURCE_PATH),
    EVENT_ACTION_EDITS_SOURCE_PATH,
  );
  const eventActionExports = exportedNames(eventActionText, EVENT_ACTION_EDITS_SOURCE_PATH);
  exactArray(
    eventActionExports.names,
    EXPECTED_EVENT_ACTION_EXPORTS,
    "SOURCE_DRIFT",
    "Event/action-edit source exports",
  );
  if (eventActionExports.tsdocDeclarations !== EXPECTED_EVENT_ACTION_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public event/action-edit declaration must retain TSDoc.");
  }

  const persistenceText = decodeUtf8(files.get(PERSISTENCE_SOURCE_PATH), PERSISTENCE_SOURCE_PATH);
  const persistenceExports = exportedNames(persistenceText, PERSISTENCE_SOURCE_PATH);
  exactArray(
    persistenceExports.names,
    EXPECTED_PERSISTENCE_EXPORTS,
    "SOURCE_DRIFT",
    "Persistence source exports",
  );
  if (persistenceExports.tsdocDeclarations !== EXPECTED_PERSISTENCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public persistence declaration must retain TSDoc.");
  }

  const continuousValidationText = decodeUtf8(
    files.get(CONTINUOUS_VALIDATION_SOURCE_PATH),
    CONTINUOUS_VALIDATION_SOURCE_PATH,
  );
  const continuousValidationExports = exportedNames(
    continuousValidationText,
    CONTINUOUS_VALIDATION_SOURCE_PATH,
  );
  exactArray(
    continuousValidationExports.names,
    [
      ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ].sort(compareText),
    "SOURCE_DRIFT",
    "Continuous-validation source exports",
  );
  if (
    continuousValidationExports.tsdocDeclarations !==
    EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS.length +
      EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Every public continuous-validation declaration must retain TSDoc.");
  }

  const sourceIndex = reexportedNames(
    decodeUtf8(files.get(INDEX_SOURCE_PATH), INDEX_SOURCE_PATH),
    INDEX_SOURCE_PATH,
  );
  exactArray(
    sourceIndex.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "SOURCE_DRIFT",
    "Runtime exports",
  );
  exactArray(sourceIndex.types, EXPECTED_CURRENT_TYPE_EXPORTS, "SOURCE_DRIFT", "Type exports");
  exactArray(
    sourceIndex.modules,
    [
      "./content-edits.js",
      "./content-edits.js",
      "./continuous-validation.js",
      "./continuous-validation.js",
      "./event-action-edits.js",
      "./event-action-edits.js",
      "./persistence.js",
      "./persistence.js",
      "./source-document.js",
      "./source-document.js",
      "./stable-id-insert.js",
      "./stable-id-insert.js",
      "./state-binding-edits.js",
      "./state-binding-edits.js",
      "./structural-edits.js",
      "./structural-edits.js",
    ],
    "SOURCE_DRIFT",
    "Source index edges",
  );

  const distIndexPath = "packages/editor-core/dist/index.js";
  const distIndexDeclarationPath = "packages/editor-core/dist/index.d.ts";
  const distStructuralPath = "packages/editor-core/dist/structural-edits.js";
  const distStructuralDeclarationPath = "packages/editor-core/dist/structural-edits.d.ts";
  const distContentPath = "packages/editor-core/dist/content-edits.js";
  const distContentDeclarationPath = "packages/editor-core/dist/content-edits.d.ts";
  const distStateBindingPath = "packages/editor-core/dist/state-binding-edits.js";
  const distStateBindingDeclarationPath = "packages/editor-core/dist/state-binding-edits.d.ts";
  const distEventActionPath = "packages/editor-core/dist/event-action-edits.js";
  const distEventActionDeclarationPath = "packages/editor-core/dist/event-action-edits.d.ts";
  const distPersistencePath = "packages/editor-core/dist/persistence.js";
  const distPersistenceDeclarationPath = "packages/editor-core/dist/persistence.d.ts";
  const distContinuousValidationPath = "packages/editor-core/dist/continuous-validation.js";
  const distContinuousValidationDeclarationPath =
    "packages/editor-core/dist/continuous-validation.d.ts";
  const distIndex = decodeUtf8(files.get(distIndexPath), distIndexPath);
  const emittedIndex = reexportedNames(distIndex, distIndexPath);
  const emittedIndexDeclaration = reexportedNames(
    decodeUtf8(files.get(distIndexDeclarationPath), distIndexDeclarationPath),
    distIndexDeclarationPath,
  );
  exactArray(
    emittedIndex.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted exports",
  );
  exactArray(
    emittedIndexDeclaration.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Declaration runtime exports",
  );
  exactArray(
    emittedIndexDeclaration.types,
    EXPECTED_CURRENT_TYPE_EXPORTS,
    "EMITTED_DRIFT",
    "Declaration type exports",
  );
  const emittedStructural = exportedNames(
    decodeUtf8(files.get(distStructuralDeclarationPath), distStructuralDeclarationPath),
    distStructuralDeclarationPath,
  );
  exactArray(
    emittedStructural.names,
    EXPECTED_STRUCTURAL_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted structural declarations",
  );
  if (emittedStructural.tsdocDeclarations !== EXPECTED_STRUCTURAL_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted structural declarations lost TSDoc.");
  }
  const emittedContent = exportedNames(
    decodeUtf8(files.get(distContentDeclarationPath), distContentDeclarationPath),
    distContentDeclarationPath,
  );
  exactArray(
    emittedContent.names,
    EXPECTED_CONTENT_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted content declarations",
  );
  if (emittedContent.tsdocDeclarations !== EXPECTED_CONTENT_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted content declarations lost TSDoc.");
  }
  const emittedStateBinding = exportedNames(
    decodeUtf8(files.get(distStateBindingDeclarationPath), distStateBindingDeclarationPath),
    distStateBindingDeclarationPath,
  );
  exactArray(
    emittedStateBinding.names,
    EXPECTED_STATE_BINDING_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted state/binding declarations",
  );
  if (emittedStateBinding.tsdocDeclarations !== EXPECTED_STATE_BINDING_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted state/binding declarations lost TSDoc.");
  }
  const emittedEventAction = exportedNames(
    decodeUtf8(files.get(distEventActionDeclarationPath), distEventActionDeclarationPath),
    distEventActionDeclarationPath,
  );
  exactArray(
    emittedEventAction.names,
    EXPECTED_EVENT_ACTION_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted event/action declarations",
  );
  if (emittedEventAction.tsdocDeclarations !== EXPECTED_EVENT_ACTION_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted event/action declarations lost TSDoc.");
  }
  const emittedPersistence = exportedNames(
    decodeUtf8(files.get(distPersistenceDeclarationPath), distPersistenceDeclarationPath),
    distPersistenceDeclarationPath,
  );
  exactArray(
    emittedPersistence.names,
    EXPECTED_PERSISTENCE_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted persistence declarations",
  );
  if (emittedPersistence.tsdocDeclarations !== EXPECTED_PERSISTENCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted persistence declarations lost TSDoc.");
  }
  const emittedContinuousValidation = exportedNames(
    decodeUtf8(
      files.get(distContinuousValidationDeclarationPath),
      distContinuousValidationDeclarationPath,
    ),
    distContinuousValidationDeclarationPath,
  );
  exactArray(
    emittedContinuousValidation.names,
    [
      ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ].sort(compareText),
    "EMITTED_DRIFT",
    "Emitted continuous-validation declarations",
  );
  if (
    emittedContinuousValidation.tsdocDeclarations !==
    EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS.length +
      EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Emitted continuous-validation declarations lost TSDoc.");
  }

  const emittedModules = [
    [
      distIndexPath,
      [
        "./source-document.js",
        "./stable-id-insert.js",
        "./structural-edits.js",
        "./content-edits.js",
        "./state-binding-edits.js",
        "./event-action-edits.js",
        "./persistence.js",
        "./continuous-validation.js",
      ],
    ],
    ["packages/editor-core/dist/source-document.js", ["@desen/validator"]],
    ["packages/editor-core/dist/stable-id-insert.js", ["@desen/protocol", "./source-document.js"]],
    [distStructuralPath, ["@desen/protocol", "./source-document.js"]],
    [distContentPath, ["@desen/protocol", "./source-document.js"]],
    [distStateBindingPath, ["@desen/protocol", "./source-document.js"]],
    [distEventActionPath, ["@desen/protocol", "./source-document.js"]],
    [distPersistencePath, ["@desen/protocol", "./source-document.js"]],
    [distContinuousValidationPath, ["@desen/protocol", "@desen/validator", "./source-document.js"]],
  ];
  for (const [relativePath, expected] of emittedModules) {
    exactArray(
      staticModuleSpecifiers(decodeUtf8(files.get(relativePath), relativePath)),
      expected,
      "EMITTED_DRIFT",
      `${relativePath} static edges`,
    );
  }
  const emittedGraph = emittedModules
    .map(([relativePath]) => decodeUtf8(files.get(relativePath), relativePath))
    .join("\n");
  for (const forbidden of [
    /\bimport\s*\(/u,
    /\beval\s*\(/u,
    /\bReact(?:DOM)?\b/u,
    /\b(?:window|navigator|HTMLElement|customElements|MutationObserver|XMLHttpRequest|WebSocket)\b/u,
    /\b(?:globalThis\.)?document\s*\.\s*(?:body|head|createElement|querySelector|getElementById|addEventListener)\b/u,
  ]) {
    if (forbidden.test(emittedGraph)) {
      fail("PLATFORM_DRIFT", `Forbidden emitted authority: ${forbidden}`);
    }
  }

  const focusedTests = testNames(decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH));
  exactArray(
    focusedTests,
    EXPECTED_PACKAGE_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Focused behavior inventory",
  );
  const focusedTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PACKAGE_TYPES_PATH), PACKAGE_TYPES_PATH),
  );
  if (focusedTypeAssertions !== 10) {
    fail("TEST_INVENTORY_DRIFT", "Focused compiler-negative inventory must remain ten.");
  }
  const persistenceTests = testNames(
    decodeUtf8(files.get(PERSISTENCE_TEST_PATH), PERSISTENCE_TEST_PATH),
  );
  exactArray(
    persistenceTests,
    EXPECTED_PERSISTENCE_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Persistence behavior inventory",
  );
  const persistenceTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PERSISTENCE_TYPES_PATH), PERSISTENCE_TYPES_PATH),
  );
  if (persistenceTypeAssertions !== 21) {
    fail("TEST_INVENTORY_DRIFT", "Persistence compiler-negative inventory must remain twenty-one.");
  }
  const publicTests = testNames(decodeUtf8(files.get(PUBLIC_TEST_PATH), PUBLIC_TEST_PATH));
  exactArray(
    publicTests,
    EXPECTED_PUBLIC_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Public runtime/root inventory",
  );
  const publicTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PUBLIC_TYPES_PATH), PUBLIC_TYPES_PATH),
  );
  if (publicTypeAssertions !== 102) {
    fail("TEST_INVENTORY_DRIFT", "Public compiler-negative inventory must remain one hundred two.");
  }
  for (const [relativePath, expectedSha256] of Object.entries(EXPECTED_T07_TEST_AUTHORITY_SHA256)) {
    if (sha256(files.get(relativePath)) !== expectedSha256) {
      fail("TEST_INVENTORY_DRIFT", `The M08-T07 focused authority drifted: ${relativePath}.`);
    }
  }
  const rootTests = testNames(decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH));
  exactArray(
    rootTests,
    EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );

  return deepFreeze({
    runtimeExports: [...EXPECTED_RUNTIME_EXPORTS],
    typeExports: [...EXPECTED_TYPE_EXPORTS],
    currentPackageRuntimeExports: [...EXPECTED_CURRENT_RUNTIME_EXPORTS],
    currentPackageTypeExports: [...EXPECTED_CURRENT_TYPE_EXPORTS],
    additiveRuntimeExports: [
      ...EXPECTED_CONTENT_RUNTIME_EXPORTS,
      ...EXPECTED_STATE_BINDING_RUNTIME_EXPORTS,
      ...EXPECTED_EVENT_ACTION_RUNTIME_EXPORTS,
      ...EXPECTED_PERSISTENCE_RUNTIME_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
    ].sort(compareText),
    additiveTypeExports: [
      ...EXPECTED_CONTENT_TYPE_EXPORTS,
      ...EXPECTED_STATE_BINDING_TYPE_EXPORTS,
      ...EXPECTED_EVENT_ACTION_TYPE_EXPORTS,
      ...EXPECTED_PERSISTENCE_TYPE_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ].sort(compareText),
    additiveSuccessor: {
      task: "M08-T08",
      sourcePath: PERSISTENCE_SOURCE_PATH,
      runtimePath: distPersistencePath,
      declarationPath: distPersistenceDeclarationPath,
      focusedTestPath: PERSISTENCE_TEST_PATH,
      focusedTypesPath: PERSISTENCE_TYPES_PATH,
      runtimeExports: [...EXPECTED_PERSISTENCE_RUNTIME_EXPORTS],
      typeExports: [...EXPECTED_PERSISTENCE_TYPE_EXPORTS],
      publicRuntimeCasesAdded: 3,
      publicCompilerNegativeAssertionsAdded: 21,
    },
    proofOnlySuccessor: {
      task: "M08-T07",
      runtimeExports: [],
      typeExports: [],
      focusedTestPath: AUTHORING_ROUND_TRIP_TEST_PATH,
      focusedTypesPath: AUTHORING_ROUND_TRIP_TYPES_PATH,
      publicRuntimeCasesAdded: 2,
      publicCompilerNegativeAssertionsAdded: 6,
    },
    structuralPublicDeclarations: EXPECTED_STRUCTURAL_EXPORTS.length,
    structuralTsdocDeclarations: sourceExports.tsdocDeclarations,
    emittedFiles: DIST_PATHS.length,
    staticEsmEdges: 24,
    unknownStaticEsmEdges: 0,
    platformNeutral: true,
    focusedBehaviorCases: EXPECTED_PACKAGE_TEST_NAMES.length,
    focusedCompilerNegativeAssertions: focusedTypeAssertions,
    publicRuntimeAndRootCases: EXPECTED_PUBLIC_TEST_NAMES.length,
    publicCompilerNegativeAssertions: publicTypeAssertions,
    rootProofCases: EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES.length,
  });
}

async function authenticatePrerequisite(options) {
  const prerequisitePath = options.prerequisitePath ?? T02_ARTIFACT_PATH;
  const bytes =
    options.prerequisiteBytes ??
    (await readNoFollow(
      prerequisitePath,
      "frozen M08-T02 prerequisite",
      MAX_AUTHORITY_BYTES,
      options.beforeAuthorityRecheck,
    ));
  const pin = EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PREREQUISITE_DRIFT", "The exact frozen M08-T02 artifact receipt did not match.");
  }
  const artifact = parseJson(bytes, "frozen M08-T02 prerequisite");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-stable-id-insert" ||
    artifact.profile !== "desen.editor-core.stable-id-insert-proof.v1" ||
    artifact.task !== "M08-T02" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableInsertCommand !== true ||
    artifact.trackedBoundary?.files !== 53 ||
    !Array.isArray(receipts) ||
    receipts.length !== 53 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    artifact.executionAuthority?.runtimeFiles !== 25 ||
    artifact.executionAuthority?.editorFiles !== 4 ||
    artifact.executionAuthority?.dependencyFiles !== 21 ||
    artifact.testAuthority?.focusedBehaviorCases !== 16 ||
    artifact.testAuthority?.publicRuntimeCases !== 22 ||
    artifact.testAuthority?.rootProofCases !== 10
  ) {
    fail("PREREQUISITE_DRIFT", "The frozen M08-T02 artifact is not its reviewed PASS profile.");
  }
  if (options.prerequisiteBytes !== undefined || options.prerequisitePath !== undefined) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "A caller-supplied prerequisite cannot issue PASS.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    evidence: deepFreeze({
      ...pin,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      liveProofReaderInput: false,
      sequence30HeadInput: false,
    }),
  });
}

function prerequisiteReceipt(prerequisite, relativePath, collection) {
  const candidates = prerequisite.executionAuthority?.[collection];
  const matches = Array.isArray(candidates)
    ? candidates.filter((candidate) => candidate?.path === relativePath)
    : [];
  if (matches.length !== 1) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Missing predecessor receipt: ${relativePath}`);
  }
  const candidate = matches[0];
  if (
    JSON.stringify(Reflect.ownKeys(candidate)) !== JSON.stringify(["path", "bytes", "sha256"]) ||
    !Number.isSafeInteger(candidate.bytes) ||
    candidate.bytes < 0 ||
    typeof candidate.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidate.sha256)
  ) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Malformed predecessor receipt: ${relativePath}`);
  }
  return candidate;
}

function assertRetainedT02Receipts(prerequisite, files) {
  const receipts = new Map(
    prerequisite.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T02_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T02 receipt drifted: ${relativePath}`);
    }
  }
}

function assertRetainedT03Receipts(frozenArtifact, files) {
  const receipts = new Map(
    frozenArtifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T03_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T03 receipt drifted: ${relativePath}`);
    }
  }
}

function authenticateRuntimeClosure(prerequisite, files) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(prerequisite, relativePath, "dependencyReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Dependency byte drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  for (const relativePath of RETAINED_EDITOR_RUNTIME_PATHS) {
    const authority = prerequisiteReceipt(prerequisite, relativePath, "editorReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Retained editor runtime drifted: ${relativePath}`);
    }
  }
  const editorReceipts = CURRENT_EDITOR_RUNTIME_PATHS.map((relativePath) =>
    receipt(relativePath, files.get(relativePath)),
  ).sort((left, right) => compareText(left.path, right.path));
  return deepFreeze({
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: ISOLATED_RUNTIME_PATHS.length,
    editorFiles: editorReceipts.length,
    retainedPredecessorEditorFiles: RETAINED_EDITOR_RUNTIME_PATHS.length,
    dependencyFiles: dependencyReceipts.length,
    dependencyModules: PROTOCOL_RUNTIME_PATHS.length + VALIDATOR_RUNTIME_PATHS.length,
    dependencyManifests: 2,
    prerequisite: {
      task: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.task,
      path: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.path,
      sha256: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.sha256,
    },
    editorReceipts,
    dependencyReceipts,
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
}

function isolatedDestination(directory, relativePath) {
  const match = relativePath.match(/^packages\/(editor-core|protocol|validator)\/(.+)$/u);
  if (match === null) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Path outside isolated package graph: ${relativePath}`);
  }
  return path.join(directory, "node_modules", "@desen", match[1], match[2]);
}

async function importReceiptedRuntime(files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t03-runtime-"));
  try {
    const copies = ISOLATED_RUNTIME_PATHS.map((relativePath) => ({
      bytes: files.get(relativePath),
      destination: isolatedDestination(directory, relativePath),
    }));
    const entryPath = path.join(directory, "entry.mjs");
    copies.push({
      bytes: Buffer.from(
        [
          'import * as editorCore from "@desen/editor-core";',
          'import { canonicalizeJsonBytes } from "@desen/protocol";',
          "export { canonicalizeJsonBytes, editorCore };",
          "",
        ].join("\n"),
      ),
      destination: entryPath,
    });
    await Promise.all(
      copies.map(async ({ bytes, destination }) => {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }),
    );
    const imported = await import(pathToFileURL(entryPath).href);
    exactArray(
      Object.keys(imported.editorCore).sort(compareText),
      EXPECTED_CURRENT_RUNTIME_EXPORTS,
      "PUBLIC_API_DRIFT",
      "Isolated runtime exports",
    );
    if (typeof imported.canonicalizeJsonBytes !== "function") {
      fail("PUBLIC_API_DRIFT", "The isolated runtime lost canonical byte authority.");
    }
    return Object.freeze({
      canonicalizeJsonBytes: imported.canonicalizeJsonBytes,
      editorCore: Object.freeze(
        Object.fromEntries(
          EXPECTED_CURRENT_RUNTIME_EXPORTS.map((name) => [name, imported.editorCore[name]]),
        ),
      ),
    });
  } catch (error) {
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      "The exact receipted editor runtime graph could not be imported in isolation.",
      String(error),
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function createDocument(runtime, validSource, input = clone(validSource)) {
  const result = runtime.createDesenEditorDocument(input);
  if (!result?.ok) fail("BEHAVIOR_DRIFT", "The isolated runtime rejected a valid Source fixture.");
  return result.document;
}

function expectSuccess(result, label) {
  if (!result?.ok || result.diagnostics?.length !== 0 || !Object.hasOwn(result, "document")) {
    fail("BEHAVIOR_DRIFT", `${label} did not return an exact success.`);
  }
  assertDeepFrozen(result, label);
  return result;
}

function expectFailure(result, code, label) {
  if (
    result?.ok !== false ||
    result.diagnostics?.[0]?.code !== code ||
    Object.hasOwn(result, "document")
  ) {
    fail("BEHAVIOR_DRIFT", `${label} did not fail atomically with ${code}.`);
  }
  assertDeepFrozen(result, label);
  return result;
}

function surfaceIdentities(editorDocument, surfaceId = "sign-in") {
  const surface = editorDocument.surfaces[surfaceId];
  const identities = [];
  const pending = [{ kind: "node", value: surface.root }];
  while (pending.length > 0) {
    const owner = pending.pop();
    identities.push(owner.value.id);
    for (const children of Object.values(owner.value.slots ?? {})) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ kind: "node", value: children[index] });
      }
    }
    if (owner.kind === "node") {
      for (let index = (owner.value.behaviors?.length ?? 0) - 1; index >= 0; index -= 1) {
        pending.push({ kind: "behavior", value: owner.value.behaviors[index] });
      }
    }
  }
  return identities.sort(compareText);
}

function sourceWithDestinationDepth(validSource, depth) {
  const input = clone(validSource);
  const root = input.surfaces["sign-in"].root;
  const target = { id: "depth.target", use: "com.example.ui/Text" };
  const chainRoot = { id: "depth.1", use: "com.example.ui/Stack", slots: {} };
  root.slots = { target: [target], chain: [chainRoot] };
  let parent = chainRoot;
  for (let index = 2; index <= depth; index += 1) {
    const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
    parent.slots = { default: [child] };
    parent = child;
  }
  return { input, parentId: parent.id };
}

function sourceWithIdentityCount(validSource, count) {
  const input = clone(validSource);
  input.surfaces["sign-in"].root.slots = {
    default: Array.from({ length: count - 1 }, (_, index) => ({
      id: `item.${index}`,
      use: "com.example.ui/Text",
    })),
  };
  return input;
}

function sizedSource(validSource, canonicalizeJsonBytes, extraBytes) {
  const input = clone(validSource);
  input.authoring = { padding: "" };
  const baseLength = canonicalizeJsonBytes(input).byteLength;
  input.authoring.padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
  return input;
}

function verifyBehavior(runtime, validSource, canonicalizeJsonBytes) {
  for (const name of [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
  ]) {
    if (typeof runtime?.[name] !== "function") {
      fail("BEHAVIOR_DRIFT", `The isolated runtime lost ${name}.`);
    }
  }

  const deletionInput = clone(validSource);
  deletionInput.surfaces["sign-in"].root.slots = {
    disposable: [
      {
        id: "delete.target",
        use: "com.example.ui/Stack",
        behaviors: [{ id: "delete.behavior", use: "com.example.interactions/Sortable" }],
        slots: { nested: [{ id: "delete.child", use: "com.example.unresolved/Unknown" }] },
      },
    ],
  };
  const deletionDocument = createDocument(runtime, validSource, deletionInput);
  const deletionBefore = canonicalizeJsonBytes(deletionDocument);
  const deleted = expectSuccess(
    runtime.deleteDesenEditorNode(deletionDocument, {
      surfaceId: "sign-in",
      nodeId: "delete.target",
    }),
    "subtree deletion",
  );
  const deletedSlots = deleted.document.surfaces["sign-in"].root.slots;
  if (
    !Object.hasOwn(deletedSlots, "disposable") ||
    deletedSlots.disposable.length !== 0 ||
    JSON.stringify(surfaceIdentities(deleted.document)) !== JSON.stringify(["sign-in.layout"]) ||
    !canonicalizeJsonBytes(deletionDocument).every((byte, index) => byte === deletionBefore[index])
  ) {
    fail("BEHAVIOR_DRIFT", "Subtree deletion or empty-slot retention drifted.");
  }

  const moveInput = clone(validSource);
  moveInput.surfaces["sign-in"].root.slots = {
    source: [
      {
        id: "move.target",
        use: "com.example.ui/Stack",
        behaviors: [{ id: "move.behavior", use: "com.example.interactions/Sortable" }],
        slots: { nested: [{ id: "move.child", use: "com.example.ui/Text" }] },
      },
    ],
    owners: [{ id: "move.destination", use: "com.example.ui/Stack" }],
    unrelated: [
      { id: "unrelated.first", use: "com.example.ui/Text" },
      { id: "unrelated.last", use: "com.example.ui/Text" },
    ],
  };
  const moveDocument = createDocument(runtime, validSource, moveInput);
  const moveIds = surfaceIdentities(moveDocument);
  const moveCommand = {
    surfaceId: "sign-in",
    nodeId: "move.target",
    parentId: "move.destination",
    slot: "unresolvedSlot",
    index: 0,
  };
  const moved = expectSuccess(
    runtime.moveDesenEditorNode(moveDocument, moveCommand),
    "cross-owner move",
  );
  moveCommand.parentId = "caller.changed";
  const movedRoot = moved.document.surfaces["sign-in"].root;
  if (
    movedRoot.slots.source.length !== 0 ||
    movedRoot.slots.owners[0].slots.unresolvedSlot[0].id !== "move.target" ||
    movedRoot.slots.owners[0].slots.unresolvedSlot[0].slots.nested[0].id !== "move.child" ||
    JSON.stringify(movedRoot.slots.unrelated.map((node) => node.id)) !==
      JSON.stringify(["unrelated.first", "unrelated.last"]) ||
    JSON.stringify(surfaceIdentities(moved.document)) !== JSON.stringify(moveIds)
  ) {
    fail("BEHAVIOR_DRIFT", "Cross-owner subtree move or stable identity drifted.");
  }

  const behaviorInput = clone(validSource);
  behaviorInput.surfaces["sign-in"].root.behaviors = [
    { id: "sign-in.sortable", use: "com.example.interactions/Sortable", slots: {} },
  ];
  const behaviorDocument = createDocument(runtime, validSource, behaviorInput);
  const behaviorMove = expectSuccess(
    runtime.moveDesenEditorNode(behaviorDocument, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      parentId: "sign-in.sortable",
      slot: "constructor",
      index: 0,
    }),
    "behavior prototype-slot move",
  );
  const behaviorSlots = behaviorMove.document.surfaces["sign-in"].root.behaviors[0].slots;
  if (
    !Object.hasOwn(behaviorSlots, "constructor") ||
    behaviorSlots.constructor[0].id !== "sign-in.title" ||
    Object.prototype.constructor !== Object
  ) {
    fail("BEHAVIOR_DRIFT", "Behavior-owned prototype-named slot handling drifted.");
  }

  const baseline = createDocument(runtime, validSource);
  const baselineBytes = canonicalizeJsonBytes(baseline);
  const reordered = expectSuccess(
    runtime.reorderDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "sign-in.title",
      index: 4,
    }),
    "post-removal reorder",
  );
  exactArray(
    reordered.document.surfaces["sign-in"].root.slots.default.map((node) => node.id),
    ["sign-in.email", "sign-in.password", "sign-in.error", "sign-in.submit", "sign-in.title"],
    "BEHAVIOR_DRIFT",
    "Post-removal final order",
  );
  const noOp = expectSuccess(
    runtime.reorderDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "sign-in.submit",
      index: 4,
    }),
    "reorder no-op",
  );
  if (
    JSON.stringify(noOp.document) !== JSON.stringify(baseline) ||
    noOp.document === baseline ||
    noOp.document.surfaces === baseline.surfaces
  ) {
    fail("BEHAVIOR_DRIFT", "The reorder no-op did not return a fresh detached Source.");
  }

  expectFailure(
    runtime.deleteDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
    }),
    "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
    "root delete",
  );
  expectFailure(
    runtime.moveDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.layout",
      parentId: "sign-in.title",
      slot: "content",
      index: 0,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
    "root move",
  );
  expectFailure(
    runtime.reorderDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "sign-in.layout",
      index: 0,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
    "root reorder",
  );
  expectFailure(
    runtime.moveDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      parentId: "sign-in.title",
      slot: "content",
      index: 0,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN",
    "self cycle",
  );
  const cycleInput = clone(validSource);
  cycleInput.surfaces["sign-in"].root.slots = {
    default: [
      {
        id: "cycle.target",
        use: "com.example.ui/Stack",
        behaviors: [{ id: "cycle.behavior", use: "com.example.interactions/Sortable" }],
        slots: { default: [{ id: "cycle.child", use: "com.example.ui/Stack" }] },
      },
    ],
  };
  const cycleDocument = createDocument(runtime, validSource, cycleInput);
  for (const parentId of ["cycle.child", "cycle.behavior"]) {
    expectFailure(
      runtime.moveDesenEditorNode(cycleDocument, {
        surfaceId: "sign-in",
        nodeId: "cycle.target",
        parentId,
        slot: "content",
        index: 0,
      }),
      "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN",
      `descendant cycle ${parentId}`,
    );
  }
  expectFailure(
    runtime.moveDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      parentId: "sign-in.layout",
      slot: "default",
      index: 1,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
    "same-slot separation",
  );
  expectFailure(
    runtime.deleteDesenEditorNode(baseline, { surfaceId: "sign-in", nodeId: "missing.node" }),
    "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
    "missing target",
  );
  const ambiguousInput = clone(validSource);
  ambiguousInput.surfaces["sign-in"].root.slots.default[1].id = "sign-in.title";
  expectFailure(
    runtime.deleteDesenEditorNode(createDocument(runtime, validSource, ambiguousInput), {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
    }),
    "run.desen.editor/STRUCTURAL_EDIT_TARGET_AMBIGUOUS",
    "ambiguous target",
  );
  expectFailure(
    runtime.deleteDesenEditorNode(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      recursive: true,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID",
    "extra command authority",
  );

  const exactDepth = sourceWithDestinationDepth(validSource, 63);
  expectSuccess(
    runtime.moveDesenEditorNode(createDocument(runtime, validSource, exactDepth.input), {
      surfaceId: "sign-in",
      nodeId: "depth.target",
      parentId: exactDepth.parentId,
      slot: "content",
      index: 0,
    }),
    "exact depth ceiling",
  );
  const crossingDepth = sourceWithDestinationDepth(validSource, 64);
  expectFailure(
    runtime.moveDesenEditorNode(createDocument(runtime, validSource, crossingDepth.input), {
      surfaceId: "sign-in",
      nodeId: "depth.target",
      parentId: crossingDepth.parentId,
      slot: "content",
      index: 0,
    }),
    "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
    "depth crossing",
  );

  expectSuccess(
    runtime.reorderDesenEditorNode(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 25_000)),
      {
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        nodeId: "item.24998",
        index: 24_998,
      },
    ),
    "exact identity ceiling",
  );
  expectFailure(
    runtime.deleteDesenEditorNode(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 25_001)),
      { surfaceId: "sign-in", nodeId: "item.24999" },
    ),
    "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
    "identity crossing",
  );

  const exactByteDocument = createDocument(
    runtime,
    validSource,
    sizedSource(validSource, canonicalizeJsonBytes, 0),
  );
  if (canonicalizeJsonBytes(exactByteDocument).byteLength !== DOCUMENT_LIMIT) {
    fail("BEHAVIOR_DRIFT", "The exact canonical byte fixture is not 8 MiB.");
  }
  expectSuccess(
    runtime.reorderDesenEditorNode(exactByteDocument, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "sign-in.submit",
      index: 4,
    }),
    "exact canonical-byte ceiling",
  );
  expectFailure(
    runtime.reorderDesenEditorNode(
      createDocument(runtime, validSource, sizedSource(validSource, canonicalizeJsonBytes, 1)),
      {
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        nodeId: "sign-in.submit",
        index: 4,
      },
    ),
    "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
    "canonical-byte crossing",
  );

  const forged = clone(validSource);
  forged.kind = "desen.bundle";
  expectFailure(
    runtime.deleteDesenEditorNode(forged, { surfaceId: "sign-in", nodeId: "sign-in.title" }),
    "SCHEMA_INVALID",
    "structural diagnostic pass-through",
  );
  if (!canonicalizeJsonBytes(baseline).every((byte, index) => byte === baselineBytes[index])) {
    fail("BEHAVIOR_DRIFT", "A failed structural edit mutated the current Source.");
  }

  return deepFreeze({
    deletion: {
      completeSubtree: true,
      emptiedSourceSlotRetained: true,
      remainingIdentities: surfaceIdentities(deleted.document),
    },
    movement: {
      crossOwner: true,
      crossSlot: true,
      subtreePreserved: true,
      behaviorOwnerTarget: true,
      prototypeNamedSlotOwnData: true,
      absentDestinationAtZero: true,
      sameOwnerSameSlotReservedForReorder: true,
      cyclesRejected: true,
    },
    reorder: {
      indexSemantics: "POST_REMOVAL_FINAL_POSITION",
      finalOrder: reordered.document.surfaces["sign-in"].root.slots.default.map((node) => node.id),
      noOpReturnsFreshSnapshot: true,
    },
    identityAndOrder: {
      nodeAndBehaviorIdsUnchangedByMove: true,
      targetSubtreeOrderPreserved: true,
      unrelatedOrderPreserved: true,
    },
    limits: {
      capabilityIdCodeUnits: 4_096,
      capabilityCommandInput: "NOT_APPLICABLE_TO_STRUCTURAL_COMMANDS",
      canonicalDocumentBytes: DOCUMENT_LIMIT,
      identitiesPerTargetSurface: 25_000,
      sourceTreeDepth: 64,
      rootDepth: 0,
      exactCeilingsPass: true,
      oneUnitCrossingsFail: true,
    },
    diagnostics: {
      editorCodes: [...EXPECTED_DIAGNOSTIC_CODES],
      structuralPassThrough: "SCHEMA_INVALID",
      missingAndAmbiguousFailClosed: true,
      failuresExposeNoDocument: true,
    },
    immutability: {
      inputDocumentsUnchanged: true,
      commandsNotRetained: true,
      freshDetachedSuccess: true,
      recursivelyFrozenResults: true,
      atomicFailure: true,
    },
  });
}

async function authenticateFrozenArtifact() {
  const bytes = await readNoFollow(ARTIFACT_PATH, "frozen M08-T03 proof artifact");
  if (
    bytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(bytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T03 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(bytes, "frozen M08-T03 proof artifact");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-structural-edits" ||
    artifact.profile !== "desen.editor-core.structural-edits-proof.v1" ||
    artifact.task !== "M08-T03" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableDeleteMoveReorderCommands !== true ||
    artifact.trackedBoundary?.files !== 60 ||
    !Array.isArray(receipts) ||
    receipts.length !== 60 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    artifact.executionAuthority?.runtimeFiles !== 26 ||
    artifact.executionAuthority?.editorFiles !== 5 ||
    artifact.executionAuthority?.dependencyFiles !== 21 ||
    artifact.testAuthority?.focusedBehaviorCases !== 16 ||
    artifact.testAuthority?.focusedCompilerNegativeAssertions !== 10 ||
    artifact.testAuthority?.publicRuntimeAndRootCases !== 26 ||
    artifact.testAuthority?.publicCompilerNegativeAssertions !== 18 ||
    artifact.testAuthority?.rootProofCases !== EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES.length
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T03 artifact identity or retained claim drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(bytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

export async function buildEditorCoreStructuralEditsEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const frozen = await authenticateFrozenArtifact();
  const authenticatedPrerequisite = await authenticatePrerequisite(options);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const boundary = verifyBoundary(files);
  assertRetainedT02Receipts(authenticatedPrerequisite.artifact, files);
  assertRetainedT03Receipts(frozen.artifact, files);
  const executionAuthority = authenticateRuntimeClosure(authenticatedPrerequisite.artifact, files);
  const isolatedRuntime = await importReceiptedRuntime(files);
  const validSource = parseJson(files.get(FIXTURE_PATH), FIXTURE_PATH);
  const behavior = verifyBehavior(
    isolatedRuntime.editorCore,
    validSource,
    isolatedRuntime.canonicalizeJsonBytes,
  );
  if (JSON.stringify(behavior) !== JSON.stringify(frozen.artifact.behavior)) {
    fail("BEHAVIOR_DRIFT", "The retained M08-T03 runtime behavior left its frozen claim.");
  }
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue structural-edit evidence.");
  }
  if (options.beforeAuthorityRecheck !== undefined) {
    fail(
      "AUTHORITY_HOOK_REJECTED",
      "A caller-supplied authority-read hook cannot issue structural-edit evidence.",
    );
  }
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-structural-edits",
    profile: "desen.editor-core.structural-edits-proof.v1",
    task: "M08-T03",
    result: "PASS",
    prerequisite: authenticatedPrerequisite.evidence,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      immutableDeleteMoveReorderCommands: true,
      stableIdentityPreserved: true,
      taskStatus: "DONE",
      prerequisiteTask: "M08-T02",
      prerequisiteStatus: "DONE",
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      structuralPublicDeclarations: boundary.structuralPublicDeclarations,
      structuralTsdocDeclarations: boundary.structuralTsdocDeclarations,
    },
    behavior,
    executionAuthority,
    boundary,
    packageBoundary: {
      currentEmittedFiles: boundary.emittedFiles,
      staticEsmEdges: boundary.staticEsmEdges,
      unknownStaticEsmEdges: boundary.unknownStaticEsmEdges,
      platformNeutral: boundary.platformNeutral,
      manifestExportRoots: ["."],
      productionDependencies: ["@desen/protocol", "@desen/validator"],
    },
    testAuthority: {
      focusedBehaviorCases: boundary.focusedBehaviorCases,
      focusedCompilerNegativeAssertions: boundary.focusedCompilerNegativeAssertions,
      publicRuntimeAndRootCases: boundary.publicRuntimeAndRootCases,
      publicCompilerNegativeAssertions: boundary.publicCompilerNegativeAssertions,
      rootProofCases: boundary.rootProofCases,
    },
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      retainedTaskTimeReceipts: RETAINED_T03_RECEIPT_PATHS.length,
    },
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    task: "M08-T03",
  });
}

function captureVerifyOptions(raw) {
  const source = captureExactObject(raw, VERIFY_OPTION_KEYS, "verifyOptions");
  for (const key of ["artifactPath", "proofDocumentPath"]) {
    if (source[key] !== undefined && typeof source[key] !== "string") {
      fail("OPTIONS_INVALID", `verifyOptions.${key} must be a string.`);
    }
  }
  return Object.freeze({
    artifactBytes:
      source.artifactBytes === undefined
        ? undefined
        : captureByteInput(source.artifactBytes, "verifyOptions.artifactBytes"),
    artifactPath: source.artifactPath,
    buildOptions: source.buildOptions,
    proofDocumentBytes:
      source.proofDocumentBytes === undefined
        ? undefined
        : captureByteInput(source.proofDocumentBytes, "verifyOptions.proofDocumentBytes"),
    proofDocumentPath: source.proofDocumentPath,
  });
}

function visibleProofAuthority(document) {
  const visible = [];
  const rawAuthority = [];
  let fence;
  let insideComment = false;
  for (const rawLine of document.split(/\r?\n/u)) {
    if (fence !== undefined) {
      const closing = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (
        closing !== null &&
        closing[1][0] === fence.marker &&
        closing[1].length >= fence.length &&
        closing[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    let remainder = rawLine;
    let line = "";
    while (remainder.length > 0) {
      if (insideComment) {
        const end = remainder.indexOf("-->");
        if (end < 0) remainder = "";
        else {
          insideComment = false;
          remainder = remainder.slice(end + 3);
        }
        continue;
      }
      const start = remainder.indexOf("<!--");
      if (start < 0) {
        line += remainder;
        remainder = "";
      } else {
        line += remainder.slice(0, start);
        insideComment = true;
        remainder = remainder.slice(start + 4);
      }
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (opening !== null) {
      fence = { marker: opening[1][0], length: opening[1].length };
      continue;
    }
    rawAuthority.push(line);
    visible.push(line.trimEnd());
  }
  return {
    visible,
    rawHtml: /<\s*\/?\s*[A-Za-z][\s\S]*?>/u.test(rawAuthority.join("\n")),
  };
}

function proofDocumentHasContradictoryStatus(visibleLines) {
  return visibleLines.some((line) => {
    const normalized = line
      .replace(/\\([`*_~])/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const field = normalized.match(/\b(?:result|status)\s*:\s*(.*)$/iu);
    if (field === null) return false;
    const value = field[1].trim();
    return (
      !/^(?:PASS|DONE)\b/iu.test(value) ||
      /\b(?:BLOCKED|ERROR|FAIL(?:ED|URE)?|INCOMPLETE|IN[ _-]?PROGRESS|NOT[ _-]?STARTED|PENDING|SKIPPED|TODO|UNKNOWN)\b/iu.test(
        value,
      )
    );
  });
}

export async function verifyEditorCoreStructuralEditsEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCoreStructuralEditsEvidence(options.buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T03 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T03 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T03 proof document",
    ));
  const proof = decodeUtf8(proofBytes, "M08-T03 proof document");
  const exactPin = `Final artifact: \`sha256:${built.artifactSha256}\``;
  const { visible, rawHtml } = visibleProofAuthority(proof);
  const pinLines = visible.filter((line) => line.startsWith("Final artifact:"));
  if (
    pinLines.length !== 1 ||
    pinLines[0] !== exactPin ||
    rawHtml ||
    proofDocumentHasContradictoryStatus(visible) ||
    visible.join("\n").includes("sha256:PENDING")
  ) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisiteSha256: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.sha256,
  });
}

async function assertSafeDestination(destinationPath) {
  const absolutePath = path.resolve(destinationPath);
  const parent = path.dirname(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(parent);
  } catch (error) {
    fail("FILESYSTEM_UNSAFE", "Artifact destination parent cannot be resolved.", String(error));
  }
  if (canonicalParent !== parent) fail("FILESYSTEM_UNSAFE", "Artifact parent is not canonical.");
  try {
    const status = await lstat(absolutePath);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", "Existing artifact destination must be one regular file.");
    }
  } catch (error) {
    if (error instanceof EditorCoreStructuralEditsProofError) throw error;
    if (error?.code !== "ENOENT") {
      fail("FILESYSTEM_UNSAFE", "Artifact destination cannot be inspected.", String(error));
    }
  }
  return absolutePath;
}

function captureWriteOptions(raw) {
  const source = captureExactObject(raw, WRITE_OPTION_KEYS, "writeOptions");
  if (source.destinationPath !== undefined && typeof source.destinationPath !== "string") {
    fail("OPTIONS_INVALID", "writeOptions.destinationPath must be a string.");
  }
  if (
    source.beforeAtomicRename !== undefined &&
    (typeof source.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(source.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "writeOptions.beforeAtomicRename must be a non-Proxy function.");
  }
  return Object.freeze(source);
}

export async function writeEditorCoreStructuralEditsEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreStructuralEditsEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_STRUCTURAL_EDITS_ARTIFACT_PATH,
  );
  await writeAtomicProofArtifact({
    artifactPath: destinationPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  const committed = await readNoFollow(destinationPath, "committed M08-T03 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T03 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
