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
import {
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json";
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 62_304,
  sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
});
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-AUTHORING-ROUND-TRIP.md";
const T01_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const T02_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json";
const T03_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json";
const T04_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-content-edits.json";
const T05_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json";
const T06_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json";
const PROTOCOL_BASELINE_PATH = "packages/protocol/upstream/0.1.0/baseline.json";
const PROTOCOL_INTEGRITY_PATH = "scripts/lib/protocol-snapshot-integrity.mjs";
const SPEC_PATH = "packages/protocol/upstream/0.1.0/snapshot/SPEC.md";
const CHECKSUM_MANIFEST_PATH = "packages/protocol/upstream/0.1.0/snapshot/SHA256SUMS";
const SOURCE_SCHEMA_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const BUNDLE_SCHEMA_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";
const CATALOG_SCHEMA_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-catalog.schema.json";
const RETAINED_PUBLISHER_EVIDENCE = Object.freeze([
  Object.freeze({
    task: "M06-T07",
    path: "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
    bytes: 8_715,
    sha256: "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e",
    profile: "desen.publisher.source-normalization-proof.v1",
  }),
  Object.freeze({
    task: "M06-T08",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
    bytes: 10_688,
    sha256: "de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f",
    profile: "desen.publisher.catalog-pinning-proof.v1",
  }),
  Object.freeze({
    task: "M06-T09",
    path: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
    bytes: 17_320,
    sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
    profile: "desen.publisher.bundle-publication-proof.v1",
  }),
  Object.freeze({
    task: "M06-T10",
    path: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
    bytes: 13_179,
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
    profile: "desen.publisher.official-golden-proof.v1",
  }),
]);
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const INDEX_SOURCE_PATH = "packages/editor-core/src/index.ts";
const EVENT_ACTION_EDITS_SOURCE_PATH = "packages/editor-core/src/event-action-edits.ts";
const PERSISTENCE_SOURCE_PATH = "packages/editor-core/src/persistence.ts";
const PACKAGE_TEST_PATH = "packages/editor-core/test/authoring-round-trip.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/authoring-round-trip.types.ts";
const PERSISTENCE_TEST_PATH = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES_PATH = "packages/editor-core/test/persistence.types.ts";
const CONTINUOUS_VALIDATION_SOURCE_PATH = "packages/editor-core/src/continuous-validation.ts";
const CONTINUOUS_VALIDATION_TEST_PATH = "packages/editor-core/test/continuous-validation.test.ts";
const CONTINUOUS_VALIDATION_TYPES_PATH = "packages/editor-core/test/continuous-validation.types.ts";
const TERMINAL_INTEGRATION_TEST_PATH = "packages/editor-core/test/terminal-integration.test.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const ROOT_TEST_PATH = "tests/editor-core-authoring-round-trip.test.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-authoring-round-trip-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-authoring-round-trip-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-authoring-round-trip.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const DOCUMENT_LIMIT = 8_388_608;
const ACTION_OCCURRENCE_LIMIT = 25_000;

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
  PROTOCOL_BASELINE_PATH,
  PROTOCOL_INTEGRITY_PATH,
  SPEC_PATH,
  CHECKSUM_MANIFEST_PATH,
  SOURCE_SCHEMA_PATH,
  BUNDLE_SCHEMA_PATH,
  CATALOG_SCHEMA_PATH,
  ...RETAINED_PUBLISHER_EVIDENCE.map(({ path: artifactPath }) => artifactPath),
  FIXTURE_PATH,
  "tsconfig.base.json",
  PACKAGE_PATH,
  "packages/editor-core/README.md",
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  "packages/editor-core/src/structural-edits.ts",
  "packages/editor-core/src/content-edits.ts",
  "packages/editor-core/src/state-binding-edits.ts",
  EVENT_ACTION_EDITS_SOURCE_PATH,
  PERSISTENCE_SOURCE_PATH,
  CONTINUOUS_VALIDATION_SOURCE_PATH,
  INDEX_SOURCE_PATH,
  ...DIST_PATHS,
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  "packages/editor-core/test/structural-edits.test.ts",
  "packages/editor-core/test/structural-edits.types.ts",
  "packages/editor-core/test/content-edits.test.ts",
  "packages/editor-core/test/content-edits.types.ts",
  "packages/editor-core/test/state-binding-edits.test.ts",
  "packages/editor-core/test/state-binding-edits.types.ts",
  "packages/editor-core/test/event-action-edits.test.ts",
  "packages/editor-core/test/event-action-edits.types.ts",
  PACKAGE_TEST_PATH,
  PACKAGE_TYPES_PATH,
  PERSISTENCE_TEST_PATH,
  PERSISTENCE_TYPES_PATH,
  CONTINUOUS_VALIDATION_TEST_PATH,
  CONTINUOUS_VALIDATION_TYPES_PATH,
  TERMINAL_INTEGRATION_TEST_PATH,
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
const RETAINED_T07_RECEIPT_PATHS = Object.freeze(
  TRACKED_PATHS.filter(
    (relativePath) =>
      ![
        PACKAGE_PATH,
        "packages/editor-core/README.md",
        INDEX_SOURCE_PATH,
        PERSISTENCE_SOURCE_PATH,
        "packages/editor-core/dist/index.d.ts",
        "packages/editor-core/dist/index.d.ts.map",
        "packages/editor-core/dist/index.js",
        "packages/editor-core/dist/index.js.map",
        "packages/editor-core/dist/persistence.d.ts",
        "packages/editor-core/dist/persistence.d.ts.map",
        "packages/editor-core/dist/persistence.js",
        "packages/editor-core/dist/persistence.js.map",
        PERSISTENCE_TEST_PATH,
        PERSISTENCE_TYPES_PATH,
        CONTINUOUS_VALIDATION_SOURCE_PATH,
        "packages/editor-core/dist/continuous-validation.d.ts",
        "packages/editor-core/dist/continuous-validation.d.ts.map",
        "packages/editor-core/dist/continuous-validation.js",
        "packages/editor-core/dist/continuous-validation.js.map",
        CONTINUOUS_VALIDATION_TEST_PATH,
        CONTINUOUS_VALIDATION_TYPES_PATH,
        TERMINAL_INTEGRATION_TEST_PATH,
        PUBLIC_TEST_PATH,
        PUBLIC_TYPES_PATH,
        PROOF_LIBRARY_PATH,
        ROOT_TEST_PATH,
      ].includes(relativePath),
  ),
);
const RETAINED_T06_RUNTIME_RECEIPT_PATHS = Object.freeze([
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/content-edits.js",
  "packages/editor-core/dist/state-binding-edits.js",
  "packages/editor-core/dist/event-action-edits.js",
  ...DEPENDENCY_RUNTIME_PATHS,
]);

const RETAINED_CONTENT_RUNTIME_EXPORTS = Object.freeze(
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
const RETAINED_STATE_BINDING_RUNTIME_EXPORTS = Object.freeze(
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
const EVENT_ACTION_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorAction",
    "deleteDesenEditorEventHandler",
    "insertDesenEditorAction",
    "insertDesenEditorEventHandler",
    "reorderDesenEditorAction",
    "replaceDesenEditorAction",
  ].sort(compareText),
);
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "insertDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    ...RETAINED_CONTENT_RUNTIME_EXPORTS,
    ...RETAINED_STATE_BINDING_RUNTIME_EXPORTS,
    ...EVENT_ACTION_RUNTIME_EXPORTS,
  ].sort(compareText),
);
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
const EXPECTED_EVENT_ACTION_EXPORTS = Object.freeze(
  [
    ...EVENT_ACTION_RUNTIME_EXPORTS,
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
const PERSISTENCE_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorPersistencePort"]);
const PERSISTENCE_TYPE_EXPORTS = Object.freeze(
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
  [...PERSISTENCE_RUNTIME_EXPORTS, ...PERSISTENCE_TYPE_EXPORTS].sort(compareText),
);
const EXPECTED_CURRENT_RUNTIME_EXPORTS = Object.freeze(
  [
    ...EXPECTED_RUNTIME_EXPORTS,
    ...PERSISTENCE_RUNTIME_EXPORTS,
    ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_CURRENT_TYPE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_TYPE_EXPORTS,
    ...PERSISTENCE_TYPE_EXPORTS,
    ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID",
  "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
  "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
  "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
]);
const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "round-trips root authoring and all 16 Source extension locations without assigning semantics",
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
const EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES = Object.freeze([
  "composes all 32 command APIs with immutable snapshots and an exact stable-identity ledger",
  "replays two independent command runs byte-for-byte without sharing result identity",
  "ends T09-valid with retained obligations and distinguishes authoring fingerprints from digests",
  "round-trips the terminal document through an injected T08 persistence adapter",
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

const BUILD_OPTION_KEYS = Object.freeze([
  "beforeAuthorityRecheck",
  "fileOverrides",
  "t01PrerequisiteBytes",
  "t01PrerequisitePath",
  "t02PrerequisiteBytes",
  "t02PrerequisitePath",
  "t03PrerequisiteBytes",
  "t03PrerequisitePath",
  "t04PrerequisiteBytes",
  "t04PrerequisitePath",
  "t05PrerequisiteBytes",
  "t05PrerequisitePath",
  "t06PrerequisiteBytes",
  "t06PrerequisitePath",
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

export const EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M08-T01",
    path: T01_ARTIFACT_PATH,
    bytes: 23_270,
    sha256: "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
    proofId: "editor-core-source-document",
    profile: "desen.editor-core.source-document-proof.v1",
  }),
  Object.freeze({
    task: "M08-T02",
    path: T02_ARTIFACT_PATH,
    bytes: 19_561,
    sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
    proofId: "editor-core-stable-id-insert",
    profile: "desen.editor-core.stable-id-insert-proof.v1",
  }),
  Object.freeze({
    task: "M08-T03",
    path: T03_ARTIFACT_PATH,
    bytes: 22_402,
    sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
    proofId: "editor-core-structural-edits",
    profile: "desen.editor-core.structural-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T04",
    path: T04_ARTIFACT_PATH,
    bytes: 26_988,
    sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
    proofId: "editor-core-content-edits",
    profile: "desen.editor-core.content-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T05",
    path: T05_ARTIFACT_PATH,
    bytes: 30_014,
    sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
    proofId: "editor-core-state-binding-edits",
    profile: "desen.editor-core.state-binding-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T06",
    path: T06_ARTIFACT_PATH,
    bytes: 31_310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    proofId: "editor-core-event-action-edits",
    profile: "desen.editor-core.event-action-edits-proof.v1",
  }),
]);

export const EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact M08-T01 through T06 artifacts, frozen protocol bytes, and isolated runtime",
  "[determinism] two fresh M08-T07 builds are byte-identical",
  "[behavior] proves all 32 commands preserve authoring and all 16 unknown-extension locations",
  "[mutation] rejects runtime substitution and tracked boundary mutation",
  "[artifact] verifies exact artifact bytes and one exact final proof pin",
  "[writer] atomically commits exact bytes and preserves the previous destination on failure",
  "[writer-filesystem] rejects symlink, hard-link, and non-file destinations",
  "[filesystem] rejects linked artifact/proof and linked, replaced, or raced prerequisites",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[immutability] freezes evidence and states the exact nonclaim boundary",
]);

export const DEFAULT_EDITOR_CORE_AUTHORING_ROUND_TRIP_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCoreAuthoringRoundTripProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreAuthoringRoundTripProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreAuthoringRoundTripProofError(code, message, details);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytesEqual(left, right) {
  return (
    left.byteLength === right.byteLength &&
    Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0
  );
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
  const keys = [...EXPECTED_CURRENT_RUNTIME_EXPORTS];
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
  for (const taskNumber of ["01", "02", "03", "04", "05", "06"]) {
    const pathKey = `t${taskNumber}PrerequisitePath`;
    if (source[pathKey] !== undefined && typeof source[pathKey] !== "string") {
      fail("OPTIONS_INVALID", `buildOptions.${pathKey} must be a string.`);
    }
  }
  if (
    source.beforeAuthorityRecheck !== undefined &&
    (typeof source.beforeAuthorityRecheck !== "function" ||
      utilTypes.isProxy(source.beforeAuthorityRecheck))
  ) {
    fail("OPTIONS_INVALID", "buildOptions.beforeAuthorityRecheck must be a non-Proxy function.");
  }
  const prerequisites = Object.create(null);
  for (const taskNumber of ["01", "02", "03", "04", "05", "06"]) {
    const bytesKey = `t${taskNumber}PrerequisiteBytes`;
    const pathKey = `t${taskNumber}PrerequisitePath`;
    prerequisites[bytesKey] =
      source[bytesKey] === undefined
        ? undefined
        : captureByteInput(source[bytesKey], `buildOptions.${bytesKey}`);
    prerequisites[pathKey] = source[pathKey];
  }
  return Object.freeze({
    beforeAuthorityRecheck: source.beforeAuthorityRecheck,
    fileOverrides: captureFileOverrides(source.fileOverrides),
    ...prerequisites,
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
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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

function mutationCaseNames(source) {
  const start = source.indexOf("const mutationCases:");
  const end = source.indexOf("\ndescribe(", start);
  if (start < 0 || end < 0) return [];
  return [...source.slice(start, end).matchAll(/^ {4}name:\s*["']([^"']+)["']/gm)].map(
    (match) => match[1],
  );
}

function countTypeAssertions(source) {
  return [...source.matchAll(/@ts-expect-error/g)].length;
}

function verifyBoundary(files) {
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
    manifest.scripts?.["test:authoring-round-trip"] !==
      "vitest run test/authoring-round-trip.test.ts" ||
    manifest.scripts?.["test:persistence"] !== "vitest run test/persistence.test.ts" ||
    manifest.scripts?.["test:continuous-validation"] !==
      "vitest run test/continuous-validation.test.ts" ||
    manifest.scripts?.["test:terminal-integration"] !==
      "vitest run test/terminal-integration.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core manifest boundary drifted.");
  }

  const packageReadme = decodeUtf8(
    files.get("packages/editor-core/README.md"),
    "packages/editor-core/README.md",
  );
  const normalizedPackageReadme = packageReadme.replace(/\s+/gu, " ");
  for (const requiredGuidance of [
    "Extension keys **SHOULD** use a reverse-domain name",
    "This is guidance rather than a hard naming error",
    "a legal unknown non-namespaced key is also retained",
    "This remains an in-memory parsed-value round trip",
    "The M08-T08 persistence boundary owns storage I/O, save/open behavior, and adapter-defined durability",
  ]) {
    if (!normalizedPackageReadme.includes(requiredGuidance)) {
      fail("README_DRIFT", "The reviewed authoring/extension guidance drifted.");
    }
  }

  const sourceText = decodeUtf8(
    files.get(EVENT_ACTION_EDITS_SOURCE_PATH),
    EVENT_ACTION_EDITS_SOURCE_PATH,
  );
  const sourceExports = exportedNames(sourceText, EVENT_ACTION_EDITS_SOURCE_PATH);
  exactArray(
    sourceExports.names,
    EXPECTED_EVENT_ACTION_EXPORTS,
    "SOURCE_DRIFT",
    "Event/action source exports",
  );
  if (sourceExports.tsdocDeclarations !== EXPECTED_EVENT_ACTION_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public event-action-edit declaration must retain TSDoc.");
  }
  for (const literal of ["8_388_608", "25_000", "maxSourceTreeDepth: 64"]) {
    if (!sourceText.includes(literal)) fail("LIMIT_DRIFT", `Missing fixed limit: ${literal}`);
  }
  for (const code of EXPECTED_DIAGNOSTIC_CODES) {
    if (!sourceText.includes(`"${code}"`)) fail("DIAGNOSTIC_DRIFT", `Missing code: ${code}`);
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

  const continuousValidationSource = decodeUtf8(
    files.get(CONTINUOUS_VALIDATION_SOURCE_PATH),
    CONTINUOUS_VALIDATION_SOURCE_PATH,
  );
  const continuousValidationExports = exportedNames(
    continuousValidationSource,
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
    ["packages/editor-core/dist/structural-edits.js", ["@desen/protocol", "./source-document.js"]],
    ["packages/editor-core/dist/content-edits.js", ["@desen/protocol", "./source-document.js"]],
    [
      "packages/editor-core/dist/state-binding-edits.js",
      ["@desen/protocol", "./source-document.js"],
    ],
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

  const focusedSource = decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH);
  const focusedTests = testNames(focusedSource);
  exactArray(
    focusedTests,
    EXPECTED_PACKAGE_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Focused behavior inventory",
  );
  const focusedMutationCases = mutationCaseNames(focusedSource);
  exactArray(
    [...focusedMutationCases].sort(compareText),
    EXPECTED_RUNTIME_EXPORTS.filter((name) => name !== "createDesenEditorDocument"),
    "TEST_INVENTORY_DRIFT",
    "Focused cross-command matrix",
  );
  const focusedTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PACKAGE_TYPES_PATH), PACKAGE_TYPES_PATH),
  );
  if (focusedTypeAssertions !== 6) {
    fail("TEST_INVENTORY_DRIFT", "Focused compiler-negative inventory must remain six.");
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
  const terminalIntegrationTests = testNames(
    decodeUtf8(files.get(TERMINAL_INTEGRATION_TEST_PATH), TERMINAL_INTEGRATION_TEST_PATH),
  );
  exactArray(
    terminalIntegrationTests,
    EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Terminal-integration behavior inventory",
  );
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
  const rootTests = testNames(decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH));
  exactArray(
    rootTests,
    EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );

  return deepFreeze({
    runtimeExports: [...EXPECTED_RUNTIME_EXPORTS],
    typeExports: [...EXPECTED_TYPE_EXPORTS],
    sourceRuntimeExports: sourceIndex.runtime.filter((name) =>
      EXPECTED_RUNTIME_EXPORTS.includes(name),
    ),
    sourceTypeExports: sourceIndex.types.filter((name) => EXPECTED_TYPE_EXPORTS.includes(name)),
    emittedRuntimeExports: emittedIndex.runtime.filter((name) =>
      EXPECTED_RUNTIME_EXPORTS.includes(name),
    ),
    emittedDeclarationRuntimeExports: emittedIndexDeclaration.runtime.filter((name) =>
      EXPECTED_RUNTIME_EXPORTS.includes(name),
    ),
    emittedDeclarationTypeExports: emittedIndexDeclaration.types.filter((name) =>
      EXPECTED_TYPE_EXPORTS.includes(name),
    ),
    currentPackageRuntimeExports: [...sourceIndex.runtime],
    currentPackageTypeExports: [...sourceIndex.types],
    additiveRuntimeExports: [
      ...PERSISTENCE_RUNTIME_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
    ].sort(compareText),
    additiveTypeExports: [
      ...PERSISTENCE_TYPE_EXPORTS,
      ...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ].sort(compareText),
    additiveSuccessors: [
      {
        task: "M08-T08",
        sourcePath: PERSISTENCE_SOURCE_PATH,
        runtimePath: distPersistencePath,
        declarationPath: distPersistenceDeclarationPath,
        focusedTestPath: PERSISTENCE_TEST_PATH,
        focusedTypesPath: PERSISTENCE_TYPES_PATH,
        runtimeExports: [...PERSISTENCE_RUNTIME_EXPORTS],
        typeExports: [...PERSISTENCE_TYPE_EXPORTS],
        publicRuntimeCasesAdded: 3,
        publicCompilerNegativeAssertionsAdded: 21,
      },
      {
        task: "M08-T09",
        sourcePath: CONTINUOUS_VALIDATION_SOURCE_PATH,
        runtimePath: distContinuousValidationPath,
        declarationPath: distContinuousValidationDeclarationPath,
        focusedTestPath: CONTINUOUS_VALIDATION_TEST_PATH,
        focusedTypesPath: CONTINUOUS_VALIDATION_TYPES_PATH,
        runtimeExports: [...EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS],
        typeExports: [...EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS],
        publicRuntimeCasesAdded: 1,
        publicCompilerNegativeAssertionsAdded: 6,
        publicDeclarations:
          EXPECTED_CONTINUOUS_VALIDATION_RUNTIME_EXPORTS.length +
          EXPECTED_CONTINUOUS_VALIDATION_TYPE_EXPORTS.length,
        tsdocDeclarations: continuousValidationExports.tsdocDeclarations,
      },
    ],
    proofOnlySuccessor: {
      task: "M08-T07",
      focusedTestPath: PACKAGE_TEST_PATH,
      focusedTypesPath: PACKAGE_TYPES_PATH,
      runtimeExportsAdded: 0,
      typeExportsAdded: 0,
      publicRuntimeCasesAdded: 2,
      publicCompilerNegativeAssertionsAdded: 6,
    },
    terminalProofSuccessor: {
      task: "M08-T10",
      authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
      focusedTestPath: TERMINAL_INTEGRATION_TEST_PATH,
      runtimeExportsAdded: 0,
      typeExportsAdded: 0,
      focusedRuntimeCases: EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES.length,
      publicRuntimeCasesAdded: 0,
      publicCompilerNegativeAssertionsAdded: 0,
    },
    retainedEventActionPublicDeclarations: EXPECTED_EVENT_ACTION_EXPORTS.length,
    retainedEventActionTsdocDeclarations: sourceExports.tsdocDeclarations,
    emittedFiles: DIST_PATHS.length,
    staticEsmEdges: 24,
    unknownStaticEsmEdges: 0,
    platformNeutral: true,
    focusedBehaviorCases: EXPECTED_PACKAGE_TEST_NAMES.length + focusedMutationCases.length,
    focusedCompilerNegativeAssertions: focusedTypeAssertions,
    publicRuntimeAndRootCases: EXPECTED_PUBLIC_TEST_NAMES.length,
    publicCompilerNegativeAssertions: publicTypeAssertions,
    rootProofCases: EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES.length,
  });
}

function verifyPredecessorExportInvariance(boundary, t06Artifact) {
  const predecessorRuntimeExports = t06Artifact.publicApi?.runtimeExports;
  const predecessorTypeExports = t06Artifact.publicApi?.typeExports;
  if (
    !Array.isArray(predecessorRuntimeExports) ||
    predecessorRuntimeExports.length !== 33 ||
    !Array.isArray(predecessorTypeExports) ||
    predecessorTypeExports.length !== 69
  ) {
    fail("PREREQUISITE_DRIFT", "The frozen M08-T06 public export authority drifted.");
  }
  for (const [label, current, predecessor] of [
    ["source runtime", boundary.sourceRuntimeExports, predecessorRuntimeExports],
    ["source type", boundary.sourceTypeExports, predecessorTypeExports],
    ["emitted runtime", boundary.emittedRuntimeExports, predecessorRuntimeExports],
    [
      "emitted declaration runtime",
      boundary.emittedDeclarationRuntimeExports,
      predecessorRuntimeExports,
    ],
    ["emitted declaration type", boundary.emittedDeclarationTypeExports, predecessorTypeExports],
  ]) {
    exactArray(current, predecessor, "PUBLIC_API_DRIFT", `M08-T07 ${label} predecessor invariance`);
  }
  const currentRuntimeNames = new Set([
    ...boundary.sourceRuntimeExports,
    ...boundary.emittedRuntimeExports,
    ...boundary.emittedDeclarationRuntimeExports,
  ]);
  const currentTypeNames = new Set([
    ...boundary.sourceTypeExports,
    ...boundary.emittedDeclarationTypeExports,
  ]);
  const predecessorRuntimeNames = new Set(predecessorRuntimeExports);
  const predecessorTypeNames = new Set(predecessorTypeExports);
  const runtimeAdditions = [...currentRuntimeNames]
    .filter((name) => !predecessorRuntimeNames.has(name))
    .sort(compareText);
  const runtimeRemovals = [...predecessorRuntimeNames]
    .filter((name) => !currentRuntimeNames.has(name))
    .sort(compareText);
  const typeAdditions = [...currentTypeNames]
    .filter((name) => !predecessorTypeNames.has(name))
    .sort(compareText);
  const typeRemovals = [...predecessorTypeNames]
    .filter((name) => !currentTypeNames.has(name))
    .sort(compareText);
  return deepFreeze({
    predecessorTask: "M08-T06",
    predecessorRuntimeExports: predecessorRuntimeExports.length,
    predecessorTypeExports: predecessorTypeExports.length,
    sourceRuntimeExact: true,
    sourceTypeExact: true,
    emittedRuntimeExact: true,
    emittedDeclarationRuntimeExact: true,
    emittedDeclarationTypeExact: true,
    runtimeAdditions,
    runtimeRemovals,
    typeAdditions,
    typeRemovals,
    taskRuntimeExportsAdded: runtimeAdditions.length,
    taskTypeExportsAdded: typeAdditions.length,
  });
}

async function authenticatePrerequisites(options) {
  const artifacts = Object.create(null);
  for (const [index, pin] of EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.entries()) {
    const taskNumber = String(index + 1).padStart(2, "0");
    const bytesKey = `t${taskNumber}PrerequisiteBytes`;
    const pathKey = `t${taskNumber}PrerequisitePath`;
    const authorityPath = options[pathKey] ?? pin.path;
    const bytes =
      options[bytesKey] ??
      (await readNoFollow(
        authorityPath,
        `frozen ${pin.task} prerequisite`,
        MAX_AUTHORITY_BYTES,
        options.beforeAuthorityRecheck,
      ));
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The exact frozen ${pin.task} artifact receipt did not match.`);
    }
    const artifact = parseJson(bytes, `frozen ${pin.task} prerequisite`);
    if (
      artifact.schemaVersion !== 1 ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.task !== pin.task ||
      artifact.result !== "PASS" ||
      artifact.claim?.taskStatus !== "DONE"
    ) {
      fail("PREREQUISITE_DRIFT", `The frozen ${pin.task} artifact lost its reviewed PASS profile.`);
    }
    artifacts[pin.task] = deepFreeze(artifact);
  }
  if (
    Object.keys(options).some(
      (key) => /^t0[1-6]Prerequisite(?:Bytes|Path)$/u.test(key) && options[key] !== undefined,
    )
  ) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "Caller-supplied prerequisite bytes cannot issue PASS.");
  }
  const t06Artifact = artifacts["M08-T06"];
  const receipts = t06Artifact.trackedBoundary?.receipts;
  if (
    t06Artifact.claim?.immutableEventActionEditCommands !== true ||
    t06Artifact.trackedBoundary?.files !== 81 ||
    !Array.isArray(receipts) ||
    receipts.length !== 81 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    t06Artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    t06Artifact.executionAuthority?.runtimeFiles !== 29 ||
    t06Artifact.executionAuthority?.editorFiles !== 8 ||
    t06Artifact.executionAuthority?.dependencyFiles !== 21 ||
    t06Artifact.testAuthority?.focusedBehaviorCases !== 16 ||
    t06Artifact.testAuthority?.publicRuntimeAndRootCases !== 44 ||
    t06Artifact.testAuthority?.publicCompilerNegativeAssertions !== 69 ||
    t06Artifact.testAuthority?.rootProofCases !== 10
  ) {
    fail("PREREQUISITE_DRIFT", "The frozen M08-T06 runtime authority drifted.");
  }
  return Object.freeze({
    artifacts: deepFreeze(artifacts),
    t06Artifact,
    evidence: deepFreeze(
      EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map((pin) => ({
        task: pin.task,
        path: pin.path,
        bytes: pin.bytes,
        sha256: pin.sha256,
        result: "PASS",
        authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
        liveProofReaderInput: false,
        checkpointHeadInput: false,
      })),
    ),
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

function authenticateRuntimeClosure(prerequisiteArtifact, prerequisiteEvidence, files) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(prerequisiteArtifact, relativePath, "dependencyReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Dependency byte drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  for (const relativePath of RETAINED_T06_RUNTIME_RECEIPT_PATHS.filter(
    (candidate) =>
      candidate.startsWith("packages/editor-core/dist/") &&
      candidate !== "packages/editor-core/dist/index.js",
  )) {
    const authority = prerequisiteReceipt(prerequisiteArtifact, relativePath, "editorReceipts");
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
    retainedPredecessorEditorFiles: 6,
    dependencyFiles: dependencyReceipts.length,
    dependencyModules: PROTOCOL_RUNTIME_PATHS.length + VALIDATOR_RUNTIME_PATHS.length,
    dependencyManifests: 2,
    prerequisites: prerequisiteEvidence.map(({ task, path: artifactPath, sha256: digest }) => ({
      task,
      path: artifactPath,
      sha256: digest,
    })),
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t07-runtime-"));
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
          'import { calculateDesenSourceDigest, canonicalizeJsonBytes } from "@desen/protocol";',
          "export { calculateDesenSourceDigest, canonicalizeJsonBytes, editorCore };",
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
    if (
      typeof imported.canonicalizeJsonBytes !== "function" ||
      typeof imported.calculateDesenSourceDigest !== "function"
    ) {
      fail("PUBLIC_API_DRIFT", "The isolated runtime lost canonical or Source-digest authority.");
    }
    return Object.freeze({
      calculateDesenSourceDigest: imported.calculateDesenSourceDigest,
      canonicalizeJsonBytes: imported.canonicalizeJsonBytes,
      editorCore: Object.freeze(
        Object.fromEntries(
          EXPECTED_RUNTIME_EXPORTS.map((name) => [name, imported.editorCore[name]]),
        ),
      ),
    });
  } catch (error) {
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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

function schemaPointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function collectDeclaredExtensionPoints(schema) {
  const points = [];
  function visit(value, pointer) {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, pointer + "/" + index));
      return;
    }
    if (
      value.properties !== null &&
      typeof value.properties === "object" &&
      Object.hasOwn(value.properties, "extensions")
    ) {
      points.push(pointer + "/properties/extensions");
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, pointer + "/" + schemaPointerToken(key));
    }
  }
  visit(schema, "");
  return Object.freeze(points.sort(compareText));
}

function resolveSchemaPointer(schema, reference) {
  if (!reference.startsWith("#/")) return undefined;
  let current = schema;
  for (const token of reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, token)) {
      return undefined;
    }
    current = current[token];
  }
  return current;
}

function collectReachableExtensionPoints(schema) {
  const points = new Set();
  const visited = new Set();
  function visit(value, pointer) {
    if (value === null || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, pointer + "/" + index));
      return;
    }
    if (
      value.properties !== null &&
      typeof value.properties === "object" &&
      Object.hasOwn(value.properties, "extensions")
    ) {
      points.add(pointer + "/properties/extensions");
    }
    if (typeof value.$ref === "string") {
      const resolved = resolveSchemaPointer(schema, value.$ref);
      if (resolved === undefined) {
        fail("PROTOCOL_SCHEMA_DRIFT", "A frozen schema contains an unresolved local reference.");
      }
      visit(resolved, value.$ref.slice(1));
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "$defs" || key === "$ref") continue;
      visit(child, pointer + "/" + schemaPointerToken(key));
    }
  }
  visit(schema, "");
  return Object.freeze([...points].sort(compareText));
}

async function authenticateFrozenProtocol(files) {
  const exactFiles = Object.freeze([
    Object.freeze({
      path: PROTOCOL_BASELINE_PATH,
      bytes: 1_459,
      sha256: "8b4c7c6ab462a90314bc4fa54a01de8b3d262b367d2e197efba83b3a698314c9",
    }),
    Object.freeze({
      path: CHECKSUM_MANIFEST_PATH,
      bytes: 2_940,
      sha256: "92e1c817d75ddc71e993de0dcf42ad7003738b6a59dc57905b879f872828c2cd",
    }),
    Object.freeze({
      path: SPEC_PATH,
      bytes: 77_981,
      sha256: "6443aed035cdced68e688402863ae3b7cc77f6dd75c8ad610831483d54b35d9c",
    }),
    Object.freeze({
      path: SOURCE_SCHEMA_PATH,
      bytes: 19_588,
      sha256: "5ce5d541991940676ce0d3705e5b0658cd60f31025be8bfb96aec21a3116dba3",
    }),
    Object.freeze({
      path: BUNDLE_SCHEMA_PATH,
      bytes: 20_001,
      sha256: "19ac16176289ce03e8997eba1101e121e42f170bf8fe1934a3fb440e64d994b1",
    }),
    Object.freeze({
      path: CATALOG_SCHEMA_PATH,
      bytes: 15_654,
      sha256: "51014ab088b6a483502fd6aee5eed9fc4451be55556b6bd6220a5a6a1b610555",
    }),
  ]);
  for (const pin of exactFiles) {
    const bytes = files.get(pin.path);
    if (bytes?.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PROTOCOL_SCHEMA_DRIFT", "A frozen protocol/schema byte receipt drifted: " + pin.path);
    }
  }
  const baseline = parseJson(files.get(PROTOCOL_BASELINE_PATH), PROTOCOL_BASELINE_PATH);
  if (
    baseline.protocol !== EXPECTED_PROTOCOL_SNAPSHOT.protocol ||
    baseline.commit !== EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit ||
    baseline.tree !== EXPECTED_PROTOCOL_SNAPSHOT.sourceTree ||
    baseline.snapshotFiles !== EXPECTED_PROTOCOL_SNAPSHOT.snapshotFiles ||
    baseline.snapshotBytes !== EXPECTED_PROTOCOL_SNAPSHOT.totalBytes ||
    baseline.manifestEntries !== EXPECTED_PROTOCOL_SNAPSHOT.manifestEntries ||
    baseline.sha256Manifest !== EXPECTED_PROTOCOL_SNAPSHOT.manifestSha256 ||
    baseline.aggregateSha256 !== EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256
  ) {
    fail("PROTOCOL_SCHEMA_DRIFT", "The frozen protocol baseline facts drifted.");
  }
  const snapshot = await verifyProtocolSnapshot();
  const spec = decodeUtf8(files.get(SPEC_PATH), SPEC_PATH);
  for (const normativeText of [
    "Extension keys **SHOULD** use reverse-domain names",
    "An implementation that does not understand an extension **MUST** preserve it when round-tripping a source document and **MUST NOT** assign it core semantics.",
    "MUST NOT** be copied into a production bundle.",
  ]) {
    if (!spec.includes(normativeText)) {
      fail("PROTOCOL_SCHEMA_DRIFT", "The frozen authoring/extension protocol wording drifted.");
    }
  }
  const sourceSchema = parseJson(files.get(SOURCE_SCHEMA_PATH), SOURCE_SCHEMA_PATH);
  const bundleSchema = parseJson(files.get(BUNDLE_SCHEMA_PATH), BUNDLE_SCHEMA_PATH);
  parseJson(files.get(CATALOG_SCHEMA_PATH), CATALOG_SCHEMA_PATH);
  const sourceDeclared = collectDeclaredExtensionPoints(sourceSchema);
  const bundleDeclared = collectDeclaredExtensionPoints(bundleSchema);
  const sourceReachable = collectReachableExtensionPoints(sourceSchema);
  const bundleReachable = collectReachableExtensionPoints(bundleSchema);
  if (
    sourceDeclared.length !== 17 ||
    bundleDeclared.length !== 17 ||
    JSON.stringify(sourceDeclared) !== JSON.stringify(bundleDeclared) ||
    sourceReachable.length !== 16 ||
    bundleReachable.length !== 16
  ) {
    fail("PROTOCOL_SCHEMA_DRIFT", "Frozen extension declarations or reachability drifted.");
  }
  return deepFreeze({
    snapshot,
    exactFiles,
    sourceAndBundleDeclaredExtensionPoints: sourceDeclared.length,
    sourceReachableExtensionPoints: sourceReachable.length,
    bundleReachableExtensionPoints: bundleReachable.length,
    sourceReachableSchemaPointers: sourceReachable,
    normativeRoundTripMustPreserve: true,
    normativeUnknownMustRemainInert: true,
    reverseDomainNamesRemainGuidance: true,
    rootAuthoringExcludedFromSourceDigestAndBundle: true,
  });
}

function authenticateRetainedPublisherEvidence(files) {
  const authenticated = RETAINED_PUBLISHER_EVIDENCE.map((pin) => {
    const bytes = files.get(pin.path);
    if (bytes?.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("RETAINED_EVIDENCE_DRIFT", "A frozen publisher receipt drifted: " + pin.path);
    }
    const artifact = parseJson(bytes, pin.path);
    if (
      artifact.schemaVersion !== 1 ||
      artifact.profile !== pin.profile ||
      artifact.task !== pin.task ||
      artifact.result !== "PASS"
    ) {
      fail("RETAINED_EVIDENCE_DRIFT", "A frozen publisher PASS profile drifted: " + pin.path);
    }
    return Object.freeze({
      task: pin.task,
      path: pin.path,
      bytes: pin.bytes,
      sha256: pin.sha256,
      profile: pin.profile,
      result: "PASS",
    });
  });
  const sourceNormalization = parseJson(
    files.get(RETAINED_PUBLISHER_EVIDENCE[0].path),
    RETAINED_PUBLISHER_EVIDENCE[0].path,
  );
  const catalogPinning = parseJson(
    files.get(RETAINED_PUBLISHER_EVIDENCE[1].path),
    RETAINED_PUBLISHER_EVIDENCE[1].path,
  );
  const bundlePublication = parseJson(
    files.get(RETAINED_PUBLISHER_EVIDENCE[2].path),
    RETAINED_PUBLISHER_EVIDENCE[2].path,
  );
  const officialGolden = parseJson(
    files.get(RETAINED_PUBLISHER_EVIDENCE[3].path),
    RETAINED_PUBLISHER_EVIDENCE[3].path,
  );
  if (
    sourceNormalization.claims?.sourceDigestCalculatedBeforeNormalization !== true ||
    sourceNormalization.claims?.sourceDigestMatchesExactAuthenticatedSourceProjection !== true ||
    sourceNormalization.claims?.rootAuthoringIndependent !== true ||
    catalogPinning.claims?.sourceDigestReauthenticatedFromExactSource !== true ||
    catalogPinning.claims?.sourceDigestNeverSilentlyReplaced !== true ||
    bundlePublication.claims?.singleOfficialInputPublicRuntimeProbe?.authoringAbsent !== true ||
    officialGolden.claims?.publicDoublePublication?.authoringAbsentFromBothOutputs !== true ||
    officialGolden.claims?.publicDoublePublication?.comparisons
      ?.sourceDigestsExactAcrossAllThree !== true
  ) {
    fail("RETAINED_EVIDENCE_DRIFT", "The frozen N-018 publisher evidence chain drifted.");
  }
  return deepFreeze({
    artifacts: authenticated,
    rootAuthoringExcludedFromDigest: true,
    rootAuthoringExcludedFromTerminalBundle: true,
    officialPublicPublicationAuthenticated: true,
  });
}

const NAMESPACED_EXTENSION_KEY = "com.example.editor-roundtrip";
const NON_NAMESPACED_EXTENSION_KEY = "legacy-marker";

function extensionPayload(kind) {
  const extensions = JSON.parse(`{
    "${NAMESPACED_EXTENSION_KEY}": {
      "kind": "",
      "ordered": ["first", {"middle": true}, "first", null, [], {}],
      "apparentCore": {
        "id": "sign-in.inserted",
        "use": "com.example.invalid/ExtensionMustRemainInert",
        "$ref": "state.extensionMustRemainInert",
        "on": {"press": [{"type": "event.emit", "name": "extension.fake"}]}
      },
      "identityProbe": {"id": ""},
      "__proto__": {"retainedAsOwnData": true},
      "constructor": {"retainedAsOwnData": true},
      "prototype": {"retainedAsOwnData": true},
      "unicode": ["İstanbul", "e\\u0301", "雪", "\\ud83d\\ude00"],
      "nullValue": null,
      "emptyObject": {},
      "emptyArray": []
    },
    "${NON_NAMESPACED_EXTENSION_KEY}": {
      "kind": "",
      "retainedAlthoughNotReverseDomainNamed": true
    },
    "__proto__": {"retainedAsOwnExtensionKey": true},
    "constructor": {"retainedAsOwnExtensionKey": true},
    "prototype": {"retainedAsOwnExtensionKey": true}
  }`);
  extensions[NAMESPACED_EXTENSION_KEY].kind = kind;
  extensions[NAMESPACED_EXTENSION_KEY].identityProbe.id = "extension-" + kind;
  extensions[NON_NAMESPACED_EXTENSION_KEY].kind = kind;
  return extensions;
}

function authoringPayload(label) {
  return JSON.parse(
    '{"canvas":{"sign-in":{"x":17,"y":23}},"selection":{"surfaceId":"sign-in","nodeId":"sign-in.title"},"viewport":{"label":"' +
      label +
      '","zoom":1.25},"__proto__":{"retained":true},"constructor":{"retained":true},"prototype":{"retained":true},"apparentCore":{"id":"sign-in.inserted","identityProbe":{"id":"authoring.fake-node.' +
      label +
      '"},"use":"com.example.invalid/AuthoringMustRemainInert","on":{"press":[{"type":"event.emit","name":"authoring.fake.' +
      label +
      '"}]}},"fakeInventory":[{"id":"sign-in.inserted"},{"type":"event.emit","name":"authoring.inventory.' +
      label +
      '"}]}',
  );
}

function allExtensionActions() {
  return [
    {
      type: "state.set",
      path: "future.value",
      value: { $ref: "state.future", fallback: null },
      extensions: extensionPayload("action.state.set"),
    },
    {
      type: "state.toggle",
      path: "future.enabled",
      extensions: extensionPayload("action.state.toggle"),
    },
    {
      type: "navigate",
      surface: "future-surface",
      params: { tab: { $ref: "state.future" } },
      extensions: extensionPayload("action.navigate"),
    },
    {
      type: "operation.invoke",
      operation: "com.example.future/Save",
      as: "futureSave",
      input: { value: { $ref: "state.future" } },
      concurrency: "queue",
      onSuccess: [{ type: "event.emit", name: "future.saved" }],
      onFailure: [{ type: "resource.refresh", resource: "futureResource" }],
      extensions: extensionPayload("action.operation.invoke"),
    },
    {
      type: "resource.refresh",
      resource: "futureResource",
      extensions: extensionPayload("action.resource.refresh"),
    },
    {
      type: "component.command",
      target: "future.component",
      command: "futureCommand",
      input: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.component.command"),
    },
    {
      type: "event.emit",
      name: "future.event",
      payload: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.event.emit"),
    },
  ];
}

function preservationInput(validSource, authoringLabel) {
  const input = clone(validSource);
  const surface = input.surfaces["sign-in"];
  const root = surface.root;
  const children = root.slots.default;
  const title = children[0];

  input.authoring = authoringPayload(authoringLabel);
  input.extensions = extensionPayload("document");
  input.catalogs[0].extensions = extensionPayload("source-catalog-requirement");
  surface.extensions = extensionPayload("surface");
  surface.state.email.extensions = extensionPayload("state");
  surface.state.deleteMe = { schema: { type: "boolean" }, initial: false };
  surface.resources.proof = {
    use: "com.example.data/Proof",
    input: {
      existing: { $ref: "state.email" },
      removeMe: { $ref: "state.password" },
    },
    policy: "manual",
    extensions: extensionPayload("resource-instance"),
  };

  root.extensions = extensionPayload("node");
  root.behaviors = [
    {
      id: "sign-in.behavior",
      use: "com.example.interactions/Preview",
      props: { removeMe: true },
      style: { base: { root: { removeMe: true } } },
      slots: { holding: [] },
      extensions: extensionPayload("behavior"),
    },
  ];
  root.on = { preservation: allExtensionActions() };

  title.props = { ...title.props, removeMe: true };
  title.style = { base: { root: { removeMe: true } } };
  title.when = { op: "truthy", args: [true] };
  title.repeat = {
    items: { $ref: "resource.proof.value", fallback: [] },
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 10,
    extensions: extensionPayload("repeat"),
  };
  title.variants = [
    {
      when: { op: "truthy", args: [true] },
      props: { removeMe: true },
      style: { base: { root: { removeMe: true } } },
      extensions: extensionPayload("variant"),
    },
    { when: { op: "truthy", args: [false] }, props: { removable: true } },
  ];
  title.on = {
    edit: [
      { type: "state.toggle", path: "future.edit" },
      { type: "navigate", surface: "future-edit" },
    ],
    deleteMe: [{ type: "event.emit", name: "future.delete" }],
  };
  children.push(
    { id: "sign-in.delete-me", use: "com.example.ui/Text" },
    { id: "sign-in.move-me", use: "com.example.ui/Text" },
    { id: "sign-in.reorder-me", use: "com.example.ui/Text" },
  );
  return input;
}

function extensionProjection(root, canonicalizeJsonBytes, expectedLocations = 16) {
  const found = new Map();
  const pending = [{ pointer: "", value: root }];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    const value = current.value;
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (!Array.isArray(value) && Object.hasOwn(value, "extensions")) {
      const extensions = value.extensions;
      const namespaced = extensions?.[NAMESPACED_EXTENSION_KEY];
      const nonNamespaced = extensions?.[NON_NAMESPACED_EXTENSION_KEY];
      const kind = namespaced?.kind;
      const carriesProofMarker =
        Object.hasOwn(extensions ?? {}, NAMESPACED_EXTENSION_KEY) ||
        Object.hasOwn(extensions ?? {}, NON_NAMESPACED_EXTENSION_KEY);
      if (carriesProofMarker) {
        if (typeof kind !== "string" || nonNamespaced?.kind !== kind || found.has(kind)) {
          fail("BEHAVIOR_DRIFT", "An extension location lost its two exact marker forms.");
        }
        found.set(
          kind,
          Object.freeze({
            kind,
            pointer: current.pointer + "/extensions",
            valueSha256: sha256(canonicalizeJsonBytes(extensions)),
          }),
        );
      }
    }
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ pointer: current.pointer + "/" + index, value: value[index] });
      }
    } else {
      const keys = Object.keys(value);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        pending.push({
          pointer: current.pointer + "/" + schemaPointerToken(key),
          value: value[key],
        });
      }
    }
  }
  const entries = [...found.values()].sort((left, right) => compareText(left.kind, right.kind));
  if (expectedLocations !== undefined && entries.length !== expectedLocations) {
    fail(
      "BEHAVIOR_DRIFT",
      `The fixture exposed ${entries.length} extension locations instead of ${expectedLocations}.`,
    );
  }
  return Object.freeze(entries);
}

function extensionReceipt(root, kind, canonicalizeJsonBytes, expectedLocations) {
  const matches = extensionProjection(root, canonicalizeJsonBytes, expectedLocations).filter(
    (entry) => entry.kind === kind,
  );
  if (matches.length !== 1) {
    fail("BEHAVIOR_DRIFT", "Expected one exact extension marker: " + kind);
  }
  return matches[0];
}

function extensionValueDigest(entries) {
  return sha256(
    Buffer.from(
      entries.map((entry) => entry.kind + "\0" + entry.valueSha256 + "\n").join(""),
      "utf8",
    ),
  );
}

function withoutAuthoring(document) {
  const projection = clone(document);
  delete projection.authoring;
  return projection;
}

function mutationCases(runtime) {
  return Object.freeze([
    [
      "insertDesenEditorNode",
      (document) =>
        runtime.insertDesenEditorNode(document, {
          surfaceId: "sign-in",
          parentId: "sign-in.layout",
          slot: "default",
          index: 0,
          idBase: "sign-in.inserted",
          use: "com.example.future/Unknown",
        }),
    ],
    [
      "deleteDesenEditorNode",
      (document) =>
        runtime.deleteDesenEditorNode(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.delete-me",
        }),
    ],
    [
      "moveDesenEditorNode",
      (document) =>
        runtime.moveDesenEditorNode(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.move-me",
          parentId: "sign-in.behavior",
          slot: "holding",
          index: 0,
        }),
    ],
    [
      "reorderDesenEditorNode",
      (document) =>
        runtime.reorderDesenEditorNode(document, {
          surfaceId: "sign-in",
          parentId: "sign-in.layout",
          slot: "default",
          nodeId: "sign-in.reorder-me",
          index: 0,
        }),
    ],
    [
      "setDesenEditorOwnerProp",
      (document) =>
        runtime.setDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          name: "futureProp",
          value: { $ref: "state.future" },
        }),
    ],
    [
      "deleteDesenEditorOwnerProp",
      (document) =>
        runtime.deleteDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          name: "removeMe",
        }),
    ],
    [
      "setDesenEditorOwnerStyleProperty",
      (document) =>
        runtime.setDesenEditorOwnerStyleProperty(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          state: "future",
          part: "root",
          property: "color",
          value: { $token: "color.future" },
        }),
    ],
    [
      "deleteDesenEditorOwnerStyleProperty",
      (document) =>
        runtime.deleteDesenEditorOwnerStyleProperty(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          state: "base",
          part: "root",
          property: "removeMe",
        }),
    ],
    [
      "setDesenEditorNodeCondition",
      (document) =>
        runtime.setDesenEditorNodeCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          when: { op: "truthy", args: [false] },
        }),
    ],
    [
      "clearDesenEditorNodeCondition",
      (document) =>
        runtime.clearDesenEditorNodeCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
        }),
    ],
    [
      "insertDesenEditorVariant",
      (document) =>
        runtime.insertDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 1,
          variant: { when: { op: "truthy", args: [true] }, props: { inserted: true } },
        }),
    ],
    [
      "deleteDesenEditorVariant",
      (document) =>
        runtime.deleteDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 1,
        }),
    ],
    [
      "reorderDesenEditorVariant",
      (document) =>
        runtime.reorderDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          variantIndex: 1,
          index: 0,
        }),
    ],
    [
      "setDesenEditorVariantCondition",
      (document) =>
        runtime.setDesenEditorVariantCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          when: { op: "truthy", args: [false] },
        }),
    ],
    [
      "setDesenEditorVariantProp",
      (document) =>
        runtime.setDesenEditorVariantProp(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          name: "future",
          value: true,
        }),
    ],
    [
      "deleteDesenEditorVariantProp",
      (document) =>
        runtime.deleteDesenEditorVariantProp(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          name: "removeMe",
        }),
    ],
    [
      "setDesenEditorVariantStyleProperty",
      (document) =>
        runtime.setDesenEditorVariantStyleProperty(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          state: "future",
          part: "root",
          property: "color",
          value: "purple",
        }),
    ],
    [
      "deleteDesenEditorVariantStyleProperty",
      (document) =>
        runtime.deleteDesenEditorVariantStyleProperty(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          state: "base",
          part: "root",
          property: "removeMe",
        }),
    ],
    [
      "insertDesenEditorStateDeclaration",
      (document) =>
        runtime.insertDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "inserted",
          declaration: { schema: { type: "string" }, initial: "" },
        }),
    ],
    [
      "deleteDesenEditorStateDeclaration",
      (document) =>
        runtime.deleteDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "deleteMe",
        }),
    ],
    [
      "setDesenEditorStateSchema",
      (document) =>
        runtime.setDesenEditorStateSchema(document, {
          surfaceId: "sign-in",
          name: "email",
          schema: { type: "number", minimum: 0 },
        }),
    ],
    [
      "setDesenEditorStateInitial",
      (document) =>
        runtime.setDesenEditorStateInitial(document, {
          surfaceId: "sign-in",
          name: "email",
          initial: { inert: true },
        }),
    ],
    [
      "setDesenEditorNodeRepeatItems",
      (document) =>
        runtime.setDesenEditorNodeRepeatItems(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          items: { $ref: "state.futureRows" },
        }),
    ],
    [
      "setDesenEditorNodeRepeatKey",
      (document) =>
        runtime.setDesenEditorNodeRepeatKey(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          key: { $ref: "item.row.futureId" },
        }),
    ],
    [
      "setDesenEditorResourceInput",
      (document) =>
        runtime.setDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "proof",
          name: "inserted",
          value: { $ref: "state.future" },
        }),
    ],
    [
      "deleteDesenEditorResourceInput",
      (document) =>
        runtime.deleteDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "proof",
          name: "removeMe",
        }),
    ],
    [
      "insertDesenEditorEventHandler",
      (document) =>
        runtime.insertDesenEditorEventHandler(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          event: "inserted",
          actions: [{ type: "event.emit", name: "future.inserted" }],
        }),
    ],
    [
      "deleteDesenEditorEventHandler",
      (document) =>
        runtime.deleteDesenEditorEventHandler(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          event: "deleteMe",
        }),
    ],
    [
      "insertDesenEditorAction",
      (document) =>
        runtime.insertDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          actionListPointer: "/on/edit",
          index: 1,
          action: { type: "resource.refresh", resource: "futureResource" },
        }),
    ],
    [
      "replaceDesenEditorAction",
      (document) =>
        runtime.replaceDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          actionPointer: "/on/edit/0",
          action: { type: "event.emit", name: "future.replaced" },
        }),
    ],
    [
      "deleteDesenEditorAction",
      (document) =>
        runtime.deleteDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          actionPointer: "/on/edit/0",
        }),
    ],
    [
      "reorderDesenEditorAction",
      (document) =>
        runtime.reorderDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          actionPointer: "/on/edit/0",
          index: 1,
        }),
    ],
  ]);
}

function lifecycleInput(validSource) {
  const input = clone(validSource);
  const root = input.surfaces["sign-in"].root;
  const children = root.slots.default;
  const title = children.find((node) => node.id === "sign-in.title");
  root.behaviors = [
    {
      id: "lifecycle.behavior",
      use: "com.example.interactions/Lifecycle",
      slots: { holding: [] },
    },
  ];
  children.push(
    {
      id: "lifecycle.delete",
      use: "com.example.ui/Text",
      extensions: extensionPayload("lifecycle.delete"),
    },
    {
      id: "lifecycle.move",
      use: "com.example.ui/Text",
      extensions: extensionPayload("lifecycle.move"),
    },
    {
      id: "lifecycle.reorder",
      use: "com.example.ui/Text",
      extensions: extensionPayload("lifecycle.reorder"),
    },
    {
      id: "lifecycle.unrelated",
      use: "com.example.ui/Text",
      extensions: extensionPayload("lifecycle.unrelated"),
    },
  );
  title.on = {
    lifecycle: [
      {
        type: "event.emit",
        name: "lifecycle.old",
        extensions: extensionPayload("lifecycle.action.old"),
      },
      {
        type: "event.emit",
        name: "lifecycle.unrelated",
        extensions: extensionPayload("lifecycle.action.unrelated"),
      },
    ],
  };
  return input;
}

function projectionWithoutKinds(entries, kinds) {
  const excluded = new Set(kinds);
  return Object.freeze(entries.filter((entry) => !excluded.has(entry.kind)));
}

function verifyExtensionLifecycle(runtime, validSource, canonicalizeJsonBytes) {
  const baselineInput = lifecycleInput(validSource);
  const baselineDocument = createDocument(runtime, baselineInput, baselineInput);
  const baselineBytes = canonicalizeJsonBytes(baselineDocument);
  const baseline = extensionProjection(baselineDocument, canonicalizeJsonBytes, 6);
  const unrelatedKinds = ["lifecycle.unrelated", "lifecycle.action.unrelated"];
  const unrelatedDigest = extensionValueDigest(
    baseline.filter((entry) => unrelatedKinds.includes(entry.kind)),
  );

  const insertedExtensions = extensionPayload("lifecycle.inserted");
  const inserted = expectSuccess(
    runtime.insertDesenEditorAction(baselineDocument, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      actionListPointer: "/on/lifecycle",
      index: 1,
      action: {
        type: "event.emit",
        name: "lifecycle.inserted",
        extensions: insertedExtensions,
      },
    }),
    "extension lifecycle insert",
  ).document;
  const insertedProjection = extensionProjection(inserted, canonicalizeJsonBytes, 7);
  const insertedReceipt = extensionReceipt(
    inserted,
    "lifecycle.inserted",
    canonicalizeJsonBytes,
    7,
  );
  if (
    insertedReceipt.valueSha256 !== sha256(canonicalizeJsonBytes(insertedExtensions)) ||
    extensionValueDigest(projectionWithoutKinds(insertedProjection, ["lifecycle.inserted"])) !==
      extensionValueDigest(baseline)
  ) {
    fail("BEHAVIOR_DRIFT", "An inserted extension marker was not carried as supplied.");
  }

  const moveBefore = extensionReceipt(baselineDocument, "lifecycle.move", canonicalizeJsonBytes, 6);
  const moved = expectSuccess(
    runtime.moveDesenEditorNode(baselineDocument, {
      surfaceId: "sign-in",
      nodeId: "lifecycle.move",
      parentId: "lifecycle.behavior",
      slot: "holding",
      index: 0,
    }),
    "extension lifecycle move",
  ).document;
  const moveAfter = extensionReceipt(moved, "lifecycle.move", canonicalizeJsonBytes, 6);
  if (
    moveAfter.pointer === moveBefore.pointer ||
    moveAfter.valueSha256 !== moveBefore.valueSha256 ||
    extensionValueDigest(extensionProjection(moved, canonicalizeJsonBytes, 6)) !==
      extensionValueDigest(baseline)
  ) {
    fail("BEHAVIOR_DRIFT", "A moved owner did not carry its exact extension marker.");
  }

  const reorderBefore = extensionReceipt(
    baselineDocument,
    "lifecycle.reorder",
    canonicalizeJsonBytes,
    6,
  );
  const reordered = expectSuccess(
    runtime.reorderDesenEditorNode(baselineDocument, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "lifecycle.reorder",
      index: 0,
    }),
    "extension lifecycle reorder",
  ).document;
  const reorderAfter = extensionReceipt(reordered, "lifecycle.reorder", canonicalizeJsonBytes, 6);
  if (
    reorderAfter.pointer === reorderBefore.pointer ||
    reorderAfter.valueSha256 !== reorderBefore.valueSha256 ||
    extensionValueDigest(extensionProjection(reordered, canonicalizeJsonBytes, 6)) !==
      extensionValueDigest(baseline)
  ) {
    fail("BEHAVIOR_DRIFT", "A reordered owner did not carry its exact extension marker.");
  }

  const deleted = expectSuccess(
    runtime.deleteDesenEditorNode(baselineDocument, {
      surfaceId: "sign-in",
      nodeId: "lifecycle.delete",
    }),
    "extension lifecycle delete",
  ).document;
  const deletedProjection = extensionProjection(deleted, canonicalizeJsonBytes, 5);
  if (
    deletedProjection.some((entry) => entry.kind === "lifecycle.delete") ||
    extensionValueDigest(deletedProjection) !==
      extensionValueDigest(projectionWithoutKinds(baseline, ["lifecycle.delete"]))
  ) {
    fail("BEHAVIOR_DRIFT", "Delete did not remove exactly its target extension owner.");
  }

  const replacementExtensions = extensionPayload("lifecycle.action.replacement");
  const replaced = expectSuccess(
    runtime.replaceDesenEditorAction(baselineDocument, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      actionPointer: "/on/lifecycle/0",
      action: {
        type: "event.emit",
        name: "lifecycle.replacement",
        extensions: replacementExtensions,
      },
    }),
    "extension lifecycle whole replacement",
  ).document;
  const replacedProjection = extensionProjection(replaced, canonicalizeJsonBytes, 6);
  const replacementReceipt = extensionReceipt(
    replaced,
    "lifecycle.action.replacement",
    canonicalizeJsonBytes,
    6,
  );
  if (
    replacedProjection.some((entry) => entry.kind === "lifecycle.action.old") ||
    replacementReceipt.valueSha256 !== sha256(canonicalizeJsonBytes(replacementExtensions)) ||
    extensionValueDigest(
      projectionWithoutKinds(replacedProjection, ["lifecycle.action.replacement"]),
    ) !== extensionValueDigest(projectionWithoutKinds(baseline, ["lifecycle.action.old"]))
  ) {
    fail("BEHAVIOR_DRIFT", "Whole replacement did not replace exactly its target extension.");
  }

  for (const candidate of [inserted, moved, reordered, deleted, replaced]) {
    const projection = extensionProjection(
      candidate,
      canonicalizeJsonBytes,
      candidate === inserted ? 7 : candidate === deleted ? 5 : 6,
    );
    if (
      extensionValueDigest(projection.filter((entry) => unrelatedKinds.includes(entry.kind))) !==
      unrelatedDigest
    ) {
      fail("BEHAVIOR_DRIFT", "An unrelated extension marker changed during lifecycle editing.");
    }
    assertDeepFrozen(candidate, "extension lifecycle result");
  }
  if (!bytesEqual(canonicalizeJsonBytes(baselineDocument), baselineBytes)) {
    fail("BEHAVIOR_DRIFT", "Extension lifecycle commands mutated their shared input.");
  }

  return deepFreeze({
    baselineLocations: baseline.length,
    insertCarriesSuppliedMarker: true,
    insertMarkerReceipt: insertedReceipt,
    moveCarriesMarkerToNewPointer: true,
    move: { before: moveBefore, after: moveAfter },
    reorderCarriesMarkerToNewPointer: true,
    reorder: { before: reorderBefore, after: reorderAfter },
    deleteRemovesOnlyTargetOwnerMarker: true,
    wholeReplacementReplacesOldMarkerWithSuppliedMarker: true,
    replacementMarkerReceipt: replacementReceipt,
    unrelatedMarkersPreserved: unrelatedKinds.length,
    deliberatelyDeletedOrWholeReplacedOwnerMarkerSurvives: false,
  });
}

function fakeActionValues() {
  return Array.from({ length: ACTION_OCCURRENCE_LIMIT + 1 }, () => ({
    type: "event.emit",
    name: "fake.scan.action",
  }));
}

const NESTED_SCANNER_ACTION_POINTER =
  "/surfaces/sign-in/root/on/preservation/3/onSuccess/0/extensions";

function nestedScannerAction(input) {
  const action = input.surfaces?.["sign-in"]?.root?.on?.preservation?.[3]?.onSuccess?.[0];
  if (action?.type !== "event.emit") {
    fail("BEHAVIOR_DRIFT", "The nested action extension scanner fixture drifted.");
  }
  return action;
}

function verifyScannerIsolation(runtime, validSource, canonicalizeJsonBytes) {
  const input = preservationInput(validSource, "alpha");
  const document = createDocument(runtime, input, input);
  const insert = expectSuccess(
    runtime.insertDesenEditorNode(document, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 0,
      idBase: "sign-in.inserted",
      use: "com.example.future/Unknown",
    }),
    "fake-id stable allocation",
  );
  if (insert.insertedNodeId !== "sign-in.inserted") {
    fail("BEHAVIOR_DRIFT", "Apparent authoring/extension IDs affected stable allocation.");
  }
  const ownerProbeReceipts = [];
  for (const fakeOwnerId of ["authoring.fake-node.alpha", "extension-document"]) {
    expectFailure(
      runtime.setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: fakeOwnerId,
        name: "mustRemainInert",
        value: true,
      }),
      "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
      "fake owner identity " + fakeOwnerId,
    );
    ownerProbeReceipts.push(
      Object.freeze({
        location: fakeOwnerId.startsWith("authoring.") ? "authoring" : "root-extension",
        fakeOwnerId,
        diagnosticCode: "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
      }),
    );
  }

  const actionProbeReceipts = [];
  for (const location of ["authoring", "extensions"]) {
    const scanInput = clone(validSource);
    const actions = fakeActionValues();
    if (location === "authoring") {
      scanInput.authoring = { apparentCore: { on: { scan: actions } } };
    } else {
      scanInput.extensions = {
        [NAMESPACED_EXTENSION_KEY]: { apparentCore: { on: { scan: actions } } },
      };
    }
    const scanDocument = createDocument(runtime, scanInput, scanInput);
    const scanResult = expectSuccess(
      runtime.insertDesenEditorEventHandler(scanDocument, {
        surfaceId: "sign-in",
        ownerId: "sign-in.layout",
        event: "scannerProbe",
        actions: [],
      }),
      location + " fake-action scan isolation",
    );
    actionProbeReceipts.push(
      Object.freeze({
        location,
        fakeActionShapedValues: actions.length,
        canonicalSourceBytes: canonicalizeJsonBytes(scanDocument).byteLength,
        commandSucceededAboveCoreActionLimit: true,
      }),
    );
    assertDeepFrozen(scanResult, location + " fake-action result");
  }

  const nestedActionScanInput = preservationInput(validSource, "nested-action-scan");
  const nestedAction = nestedScannerAction(nestedActionScanInput);
  const nestedFakeActions = fakeActionValues();
  nestedAction.extensions = {
    [NAMESPACED_EXTENSION_KEY]: {
      apparentCore: { on: { scan: nestedFakeActions } },
    },
  };
  const nestedActionScanDocument = createDocument(
    runtime,
    nestedActionScanInput,
    nestedActionScanInput,
  );
  const nestedActionScanResult = expectSuccess(
    runtime.insertDesenEditorEventHandler(nestedActionScanDocument, {
      surfaceId: "sign-in",
      ownerId: "sign-in.layout",
      event: "nestedExtensionScannerProbe",
      actions: [],
    }),
    "nested action extension fake-action scan isolation",
  );
  actionProbeReceipts.push(
    Object.freeze({
      location: "nested-action-extension",
      pointer: NESTED_SCANNER_ACTION_POINTER,
      fakeActionShapedValues: nestedFakeActions.length,
      canonicalSourceBytes: canonicalizeJsonBytes(nestedActionScanDocument).byteLength,
      commandSucceededAboveCoreActionLimit: true,
    }),
  );
  assertDeepFrozen(nestedActionScanResult, "nested action extension fake-action result");

  const nestedOwnerId = "nested-extension.fake-owner";
  const nestedOwnerScanInput = preservationInput(validSource, "nested-owner-scan");
  nestedScannerAction(nestedOwnerScanInput).extensions = {
    [NAMESPACED_EXTENSION_KEY]: {
      apparentCore: {
        id: nestedOwnerId,
        use: "com.example.invalid/NestedExtensionMustRemainInert",
        props: { mustRemainInert: true },
      },
    },
  };
  const nestedOwnerScanDocument = createDocument(
    runtime,
    nestedOwnerScanInput,
    nestedOwnerScanInput,
  );
  expectFailure(
    runtime.setDesenEditorOwnerProp(nestedOwnerScanDocument, {
      surfaceId: "sign-in",
      ownerId: nestedOwnerId,
      name: "mustRemainInert",
      value: true,
    }),
    "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
    "nested action extension fake owner identity",
  );
  ownerProbeReceipts.push(
    Object.freeze({
      location: "nested-action-extension",
      pointer: NESTED_SCANNER_ACTION_POINTER,
      fakeOwnerId: nestedOwnerId,
      canonicalSourceBytes: canonicalizeJsonBytes(nestedOwnerScanDocument).byteLength,
      diagnosticCode: "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
    }),
  );

  return deepFreeze({
    stableAllocatorIgnoresApparentIds: true,
    exactAllocatedId: insert.insertedNodeId,
    ownerIdentityScansIgnoreApparentIds: true,
    fakeOwnerIdsRejectedAsNotFound: [
      "authoring.fake-node.alpha",
      "extension-document",
      nestedOwnerId,
    ],
    ownerProbeReceipts,
    actionScansIgnoreApparentActions: true,
    coreActionOccurrenceLimit: ACTION_OCCURRENCE_LIMIT,
    actionProbeReceipts,
    nestedActionExtensionActionScanProbed: true,
    nestedActionExtensionOwnerScanProbed: true,
  });
}

function verifyAuthoringInclusiveByteLimit(runtime, validSource, canonicalizeJsonBytes) {
  const oversizedInput = clone(validSource);
  oversizedInput.authoring = { padding: "" };
  const emptyPaddingBytes = canonicalizeJsonBytes(oversizedInput).byteLength;
  oversizedInput.authoring.padding = "x".repeat(DOCUMENT_LIMIT + 1 - emptyPaddingBytes);
  const withAuthoringBytes = canonicalizeJsonBytes(oversizedInput).byteLength;
  if (withAuthoringBytes !== DOCUMENT_LIMIT + 1) {
    fail("BEHAVIOR_DRIFT", "The authoring-inclusive over-by-one fixture drifted.");
  }
  const oversizedDocument = createDocument(runtime, oversizedInput, oversizedInput);
  expectFailure(
    runtime.deleteDesenEditorNode(oversizedDocument, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
    }),
    "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
    "authoring-inclusive Source byte limit",
  );

  const withoutAuthoring = clone(oversizedDocument);
  delete withoutAuthoring.authoring;
  const withoutAuthoringBytes = canonicalizeJsonBytes(withoutAuthoring).byteLength;
  const admittedWithoutAuthoring = createDocument(runtime, withoutAuthoring, withoutAuthoring);
  expectSuccess(
    runtime.deleteDesenEditorNode(admittedWithoutAuthoring, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
    }),
    "same Source without root authoring",
  );
  if (withoutAuthoringBytes >= DOCUMENT_LIMIT) {
    fail("BEHAVIOR_DRIFT", "The authoring-excluded control unexpectedly reached the limit.");
  }

  return deepFreeze({
    canonicalSourceByteLimit: DOCUMENT_LIMIT,
    withRootAuthoringCanonicalBytes: withAuthoringBytes,
    withoutRootAuthoringCanonicalBytes: withoutAuthoringBytes,
    rootAuthoringCanonicalByteContribution: withAuthoringBytes - withoutAuthoringBytes,
    overByOneRejected: true,
    authoringExcludedControlSucceeded: true,
    limitCoversCompleteSourceIncludingRootAuthoring: true,
  });
}

function reopenParsedSource(runtime, document, canonicalizeJsonBytes, label) {
  const serialized = Buffer.from(JSON.stringify(document), "utf8");
  const parsed = JSON.parse(serialized.toString("utf8"));
  const reopened = createDocument(runtime, parsed, parsed);
  if (!bytesEqual(canonicalizeJsonBytes(document), canonicalizeJsonBytes(reopened))) {
    fail("BEHAVIOR_DRIFT", label + " changed parsed Source values during JSON re-admission.");
  }
  assertDeepFrozen(reopened, label + " reopened Source");
  return Object.freeze({
    canonicalSha256: sha256(canonicalizeJsonBytes(reopened)),
    document: reopened,
    serializedInputBytes: serialized.byteLength,
  });
}

function verifyBehavior(runtime, validSource, canonicalizeJsonBytes, calculateDesenSourceDigest) {
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    if (typeof runtime?.[name] !== "function") {
      fail("BEHAVIOR_DRIFT", "The isolated runtime lost " + name + ".");
    }
  }
  const cases = mutationCases(runtime);
  const expectedCommands = EXPECTED_RUNTIME_EXPORTS.filter(
    (name) => name !== "createDesenEditorDocument",
  );
  exactArray(
    cases.map(([name]) => name).sort(compareText),
    expectedCommands,
    "BEHAVIOR_DRIFT",
    "All 32 mutation commands",
  );

  const baselineInput = preservationInput(validSource, "alpha");
  const baselineDocument = createDocument(runtime, baselineInput, baselineInput);
  const baselineAuthoring = canonicalizeJsonBytes(baselineDocument.authoring);
  const baselineExtensions = extensionProjection(baselineDocument, canonicalizeJsonBytes);
  const baselineExtensionDigest = extensionValueDigest(baselineExtensions);
  const alternateInput = preservationInput(validSource, "omega");
  const alternateDocument = createDocument(runtime, alternateInput, alternateInput);
  const alternateAuthoring = canonicalizeJsonBytes(alternateDocument.authoring);
  if (
    calculateDesenSourceDigest(baselineDocument) !==
      calculateDesenSourceDigest(alternateDocument) ||
    !bytesEqual(
      canonicalizeJsonBytes(withoutAuthoring(baselineDocument)),
      canonicalizeJsonBytes(withoutAuthoring(alternateDocument)),
    ) ||
    bytesEqual(canonicalizeJsonBytes(baselineDocument), canonicalizeJsonBytes(alternateDocument))
  ) {
    fail("BEHAVIOR_DRIFT", "Root authoring did not remain isolated from production Source data.");
  }
  const extensionChangedInput = preservationInput(validSource, "alpha");
  extensionChangedInput.extensions[NAMESPACED_EXTENSION_KEY].changed = true;
  const extensionChangedDocument = createDocument(
    runtime,
    extensionChangedInput,
    extensionChangedInput,
  );
  if (
    calculateDesenSourceDigest(extensionChangedDocument) ===
    calculateDesenSourceDigest(baselineDocument)
  ) {
    fail("BEHAVIOR_DRIFT", "An extension change failed to affect the Source digest.");
  }
  const reopenedBaseline = reopenParsedSource(
    runtime,
    baselineDocument,
    canonicalizeJsonBytes,
    "factory baseline",
  );
  const reopenedAlternate = reopenParsedSource(
    runtime,
    alternateDocument,
    canonicalizeJsonBytes,
    "factory alternate",
  );
  const reopenedExtensionChanged = reopenParsedSource(
    runtime,
    extensionChangedDocument,
    canonicalizeJsonBytes,
    "factory extension change",
  );
  if (
    !bytesEqual(canonicalizeJsonBytes(reopenedBaseline.document.authoring), baselineAuthoring) ||
    !bytesEqual(canonicalizeJsonBytes(reopenedAlternate.document.authoring), alternateAuthoring) ||
    calculateDesenSourceDigest(reopenedBaseline.document) !==
      calculateDesenSourceDigest(reopenedAlternate.document) ||
    calculateDesenSourceDigest(reopenedExtensionChanged.document) ===
      calculateDesenSourceDigest(reopenedBaseline.document)
  ) {
    fail("BEHAVIOR_DRIFT", "Factory JSON re-admission changed the authoring/digest boundary.");
  }

  const receipts = [];
  for (const [name, run] of cases) {
    const leftInput = preservationInput(validSource, "alpha");
    const rightInput = preservationInput(validSource, "omega");
    const leftDocument = createDocument(runtime, leftInput, leftInput);
    const rightDocument = createDocument(runtime, rightInput, rightInput);
    const leftBefore = canonicalizeJsonBytes(leftDocument);
    const rightBefore = canonicalizeJsonBytes(rightDocument);
    const left = expectSuccess(run(leftDocument), name + " left").document;
    const right = expectSuccess(run(rightDocument), name + " right").document;
    if (
      !bytesEqual(canonicalizeJsonBytes(left.authoring), baselineAuthoring) ||
      !bytesEqual(canonicalizeJsonBytes(right.authoring), alternateAuthoring) ||
      extensionValueDigest(extensionProjection(left, canonicalizeJsonBytes)) !==
        baselineExtensionDigest ||
      extensionValueDigest(extensionProjection(right, canonicalizeJsonBytes)) !==
        baselineExtensionDigest ||
      calculateDesenSourceDigest(left) !== calculateDesenSourceDigest(right) ||
      !bytesEqual(
        canonicalizeJsonBytes(withoutAuthoring(left)),
        canonicalizeJsonBytes(withoutAuthoring(right)),
      ) ||
      !bytesEqual(canonicalizeJsonBytes(leftDocument), leftBefore) ||
      !bytesEqual(canonicalizeJsonBytes(rightDocument), rightBefore)
    ) {
      fail("BEHAVIOR_DRIFT", name + " violated authoring or extension preservation.");
    }
    const reopenedLeft = reopenParsedSource(runtime, left, canonicalizeJsonBytes, name + " left");
    const reopenedRight = reopenParsedSource(
      runtime,
      right,
      canonicalizeJsonBytes,
      name + " right",
    );
    if (
      extensionValueDigest(extensionProjection(reopenedLeft.document, canonicalizeJsonBytes)) !==
        baselineExtensionDigest ||
      extensionValueDigest(extensionProjection(reopenedRight.document, canonicalizeJsonBytes)) !==
        baselineExtensionDigest ||
      !bytesEqual(canonicalizeJsonBytes(reopenedLeft.document.authoring), baselineAuthoring) ||
      !bytesEqual(canonicalizeJsonBytes(reopenedRight.document.authoring), alternateAuthoring)
    ) {
      fail("BEHAVIOR_DRIFT", name + " lost parsed authoring or extension values on reopen.");
    }
    receipts.push(
      Object.freeze({
        command: name,
        leftCanonicalSha256: reopenedLeft.canonicalSha256,
        leftSerializedInputBytes: reopenedLeft.serializedInputBytes,
        rightCanonicalSha256: reopenedRight.canonicalSha256,
        rightSerializedInputBytes: reopenedRight.serializedInputBytes,
      }),
    );
  }

  const scannerIsolation = verifyScannerIsolation(runtime, validSource, canonicalizeJsonBytes);
  const extensionLifecycle = verifyExtensionLifecycle(runtime, validSource, canonicalizeJsonBytes);
  const authoringInclusiveByteLimit = verifyAuthoringInclusiveByteLimit(
    runtime,
    validSource,
    canonicalizeJsonBytes,
  );

  return deepFreeze({
    commands: {
      runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
      mutationCommands: cases.length,
      eachCommandExecutedAgainstTwoAuthoringVariants: true,
      commandReceipts: receipts,
    },
    authoringIsolation: {
      rootAuthoringPreservedAcrossAllCommands: true,
      authoringDifferencesDoNotChangeProductionProjection: true,
      authoringDifferencesDoNotChangeSourceDigest: true,
      authoringApparentCoreDataRemainsInert: true,
      scannerIsolation,
      canonicalByteLimit: authoringInclusiveByteLimit,
      baselineSourceDigest: calculateDesenSourceDigest(baselineDocument),
      alternateAuthoringSourceDigest: calculateDesenSourceDigest(alternateDocument),
    },
    unknownExtensions: {
      sourceReachableLocations: baselineExtensions.length,
      locations: baselineExtensions,
      valuesPreservedAcrossFactoryAndAllCommands: true,
      valuesPreservedAcrossJsonSerializationParseAndReadmission: true,
      extensionChangesAffectSourceDigest: true,
      extensionChangedSourceDigest: calculateDesenSourceDigest(extensionChangedDocument),
      coreSemanticsAssigned: false,
      namespacedRecommendedMarker: NAMESPACED_EXTENSION_KEY,
      legalNonNamespacedMarker: NON_NAMESPACED_EXTENSION_KEY,
      reverseDomainNamingIsGuidanceNotValidation: true,
      lifecycle: extensionLifecycle,
    },
    roundTrip: {
      boundary: "JSON.stringify -> JSON.parse -> createDesenEditorDocument",
      parsedValuesAndCanonicalBytesPreserved: true,
      lexicalMemberOrderOrWhitespacePreservationClaimed: false,
      storagePortOrDurabilityClaimed: false,
      readmissionCycles: cases.length * 2 + 3,
    },
    ownershipAndImmutability: {
      callerInputsUnchanged: true,
      commandResultsFreshAndRecursivelyFrozen: true,
      reopenedSourcesRecursivelyFrozen: true,
    },
  });
}

async function authenticateFrozenArtifact() {
  const bytes = await readNoFollow(ARTIFACT_PATH, "frozen M08-T07 proof artifact");
  const digest = sha256(bytes);
  if (bytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes || digest !== FROZEN_ARTIFACT_PIN.sha256) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T07 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(bytes, "frozen M08-T07 proof artifact");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-authoring-round-trip" ||
    artifact.profile !== "desen.editor-core.authoring-round-trip-proof.v1" ||
    artifact.task !== "M08-T07" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.proofOnlyNoRuntimeOrTypeExportAdded !== true ||
    artifact.claim?.rootAuthoringIsolation !== true ||
    artifact.claim?.parsedUnknownExtensionPreservation !== true ||
    artifact.publicApi?.runtimeExports?.length !== 33 ||
    artifact.publicApi?.typeExports?.length !== 69 ||
    artifact.trackedBoundary?.files !== 95 ||
    !Array.isArray(receipts) ||
    receipts.length !== 95 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    artifact.executionAuthority?.runtimeFiles !== 29 ||
    artifact.executionAuthority?.editorFiles !== 8 ||
    artifact.executionAuthority?.dependencyFiles !== 21 ||
    artifact.testAuthority?.focusedBehaviorCases !== 33 ||
    artifact.testAuthority?.focusedCompilerNegativeAssertions !== 6 ||
    artifact.testAuthority?.publicRuntimeAndRootCases !== 46 ||
    artifact.testAuthority?.publicCompilerNegativeAssertions !== 75 ||
    artifact.testAuthority?.rootProofCases !==
      EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES.length
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T07 artifact identity or retained claim drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(bytes),
    artifactSha256: digest,
  });
}

function assertRetainedT07Receipts(frozenArtifact, files) {
  const receipts = new Map(
    frozenArtifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T07_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T07 receipt drifted: ${relativePath}`);
    }
  }
}

/** Captures own-data options and rebuilds M08-T07 from freshly authenticated inputs. */
export async function buildEditorCoreAuthoringRoundTripEvidence(rawOptions = undefined) {
  return buildCapturedEvidence(captureBuildOptions(rawOptions));
}

async function buildCapturedEvidence(options) {
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const frozen = await authenticateFrozenArtifact();
  const authenticatedPrerequisites = await authenticatePrerequisites(options);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const boundary = verifyBoundary(files);
  assertRetainedT07Receipts(frozen.artifact, files);
  const predecessorExportInvariance = verifyPredecessorExportInvariance(
    {
      sourceRuntimeExports: frozen.artifact.publicApi.runtimeExports,
      sourceTypeExports: frozen.artifact.publicApi.typeExports,
      emittedRuntimeExports: frozen.artifact.publicApi.runtimeExports,
      emittedDeclarationRuntimeExports: frozen.artifact.publicApi.runtimeExports,
      emittedDeclarationTypeExports: frozen.artifact.publicApi.typeExports,
    },
    authenticatedPrerequisites.t06Artifact,
  );
  if (
    JSON.stringify(predecessorExportInvariance) !==
    JSON.stringify(frozen.artifact.publicApi.predecessorExportInvariance)
  ) {
    fail("ARTIFACT_DRIFT", "The retained M08-T07 predecessor export proof drifted.");
  }
  const frozenProtocol = await authenticateFrozenProtocol(files);
  const retainedPublisherEvidence = authenticateRetainedPublisherEvidence(files);
  if (
    JSON.stringify(frozenProtocol) !== JSON.stringify(frozen.artifact.frozenProtocol) ||
    JSON.stringify(retainedPublisherEvidence) !==
      JSON.stringify(frozen.artifact.retainedNormativeEvidence)
  ) {
    fail("ARTIFACT_DRIFT", "The retained M08-T07 protocol or publisher authority drifted.");
  }
  const executionAuthority = authenticateRuntimeClosure(
    authenticatedPrerequisites.t06Artifact,
    authenticatedPrerequisites.evidence,
    files,
  );
  const isolatedRuntime = await importReceiptedRuntime(files);
  const validSource = parseJson(files.get(FIXTURE_PATH), FIXTURE_PATH);
  const behavior = verifyBehavior(
    isolatedRuntime.editorCore,
    validSource,
    isolatedRuntime.canonicalizeJsonBytes,
    isolatedRuntime.calculateDesenSourceDigest,
  );
  if (JSON.stringify(behavior) !== JSON.stringify(frozen.artifact.behavior)) {
    fail("BEHAVIOR_DRIFT", "The retained M08-T07 runtime behavior left its frozen claim.");
  }
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue authoring-round-trip evidence.");
  }
  if (options.beforeAuthorityRecheck !== undefined) {
    fail(
      "AUTHORITY_HOOK_REJECTED",
      "A caller-supplied authority-read hook cannot issue authoring-round-trip evidence.",
    );
  }
  const currentReceipts = [...files.entries()]
    .map(([relativePath, bytes]) => receipt(relativePath, bytes))
    .sort((left, right) => compareText(left.path, right.path));
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-authoring-round-trip",
    profile: "desen.editor-core.authoring-round-trip-proof.v1",
    task: "M08-T07",
    result: "PASS",
    prerequisites: authenticatedPrerequisites.evidence,
    retainedNormativeEvidence: retainedPublisherEvidence,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      proofOnlyNoRuntimeOrTypeExportAdded:
        predecessorExportInvariance.taskRuntimeExportsAdded === 0 &&
        predecessorExportInvariance.taskTypeExportsAdded === 0,
      factoryAndAllMutationCommandsCovered: true,
      immutableMutationCommands: behavior.commands.mutationCommands,
      rootAuthoringIsolation: true,
      parsedUnknownExtensionPreservation: true,
      lifecycleAwareExtensionPreservation: true,
      unknownExtensionsReceiveNoCoreSemantics: true,
      authoringAndExtensionApparentCoreScannersRemainInert: true,
      rootAuthoringIncludedInCompleteSourceByteLimit: true,
      jsonSerializationParseAndFactoryReadmission: true,
      taskStatus: "DONE",
      prerequisiteTasks: EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map(({ task }) => task),
      prerequisiteStatuses: EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map(() => "DONE"),
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      currentPackageRuntimeExports: boundary.currentPackageRuntimeExports,
      currentPackageTypeExports: boundary.currentPackageTypeExports,
      additiveRuntimeExports: boundary.additiveRuntimeExports,
      additiveTypeExports: boundary.additiveTypeExports,
      additiveSuccessors: boundary.additiveSuccessors,
      taskRuntimeExportsAdded: predecessorExportInvariance.taskRuntimeExportsAdded,
      taskTypeExportsAdded: predecessorExportInvariance.taskTypeExportsAdded,
      predecessorExportInvariance,
      proofOnlySuccessor: boundary.proofOnlySuccessor,
      terminalProofSuccessor: boundary.terminalProofSuccessor,
      retainedEventActionPublicDeclarations: boundary.retainedEventActionPublicDeclarations,
      retainedEventActionTsdocDeclarations: boundary.retainedEventActionTsdocDeclarations,
    },
    behavior,
    frozenProtocol,
    executionAuthority,
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
      terminalIntegrationRuntimeCases: EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES.length,
    },
    trackedBoundary: { files: currentReceipts.length, receipts: currentReceipts },
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      retainedTaskTimeReceipts: RETAINED_T07_RECEIPT_PATHS.length,
    },
    normativeCoverage: frozen.artifact.normativeCoverage,
    nonclaims: [
      "LEXICAL_JSON_BYTES_WHITESPACE_OR_OBJECT_MEMBER_ORDER_PRESERVATION",
      "M08_T08_PERSISTENCE_SUCCESSOR_BYTES_ARE_COMPATIBILITY_ONLY_NOT_T07_CLAIM_AUTHORITY",
      "M08_T09_CONTINUOUS_VALIDATION_SUCCESSOR_BYTES_ARE_COMPATIBILITY_ONLY_NOT_T07_CLAIM_AUTHORITY",
      "UNKNOWN_EXTENSION_DEFINED_CORE_SEMANTICS",
      "DELIBERATELY_DELETED_OR_WHOLE_REPLACED_OWNER_EXTENSION_SURVIVAL",
      "ACTION_EXECUTION_AND_RUNTIME_TURNS",
      "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
      "M08_T10_TERMINAL_BYTES_ARE_COMPATIBILITY_ONLY_NOT_T07_CLAIM_AUTHORITY",
      "REACT_RENDERER_COMPONENT_OR_DOM_BEHAVIOR",
      "HOSTILE_JAVASCRIPT_SANDBOX",
      "NO_PROXY_TRAP_EXECUTION_MEMBRANE",
      "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
      "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
      "P18_OR_G08_ADVANCEMENT",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:authoring-round-trip",
      "pnpm --filter @desen/editor-core test:public-package",
      "pnpm --filter @desen/editor-core test:terminal-integration",
      "node scripts/generate-editor-core-authoring-round-trip-proof.mjs",
      "node scripts/verify-editor-core-authoring-round-trip.mjs",
      "node --test tests/editor-core-authoring-round-trip.test.mjs",
    ],
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    task: "M08-T07",
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

function visibleHtmlSegments(line, containers) {
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);
  const tagPattern = /<\s*(\/?)\s*([A-Za-z][\w:-]*)([^>]*)>/gu;
  let cursor = 0;
  let visible = "";
  let excluded = "";
  for (const match of line.matchAll(tagPattern)) {
    if (containers.length === 0) visible += line.slice(cursor, match.index);
    else excluded += line.slice(cursor, match.index);
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const attributes = match[3];
    if (closing) {
      const matchingIndex = containers.findLastIndex((container) => container.name === name);
      if (matchingIndex >= 0) containers.splice(matchingIndex);
    } else if (!attributes.trimEnd().endsWith("/") && !voidElements.has(name)) {
      containers.push({ name });
    }
    cursor = match.index + match[0].length;
  }
  if (containers.length === 0) visible += line.slice(cursor);
  else excluded += line.slice(cursor);
  return { visible, excluded };
}

function visibleProofDocumentLines(document) {
  const visible = [];
  const htmlAuthority = [];
  const rawAuthority = [];
  let fence;
  let insideComment = false;
  const htmlContainers = [];
  for (const rawLine of document.split(/\r?\n/u)) {
    if (fence !== undefined) {
      const fenceMatch = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (
        fenceMatch !== null &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    let remainder = rawLine;
    let line = "";
    while (remainder.length > 0) {
      if (insideComment) {
        const commentEnd = remainder.indexOf("-->");
        if (commentEnd < 0) {
          remainder = "";
        } else {
          insideComment = false;
          remainder = remainder.slice(commentEnd + 3);
        }
        continue;
      }
      const commentStart = remainder.indexOf("<!--");
      if (commentStart < 0) {
        line += remainder;
        remainder = "";
      } else {
        line += remainder.slice(0, commentStart);
        insideComment = true;
        remainder = remainder.slice(commentStart + 4);
      }
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const htmlSegments = visibleHtmlSegments(line, htmlContainers);
    const htmlVisibleLine = htmlSegments.visible;
    if (htmlSegments.excluded.trim() !== "") htmlAuthority.push(htmlSegments.excluded);
    const fenceMatch = htmlVisibleLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fenceMatch !== null) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    rawAuthority.push(line);
    visible.push(htmlVisibleLine.trimEnd());
  }
  return {
    visible,
    htmlAuthority,
    rawHtml: /<\s*\/?\s*[A-Za-z][\s\S]*?>/u.test(rawAuthority.join("\n")),
  };
}

function proofDocumentHasContradictoryStatus(visibleLines) {
  for (const line of visibleLines) {
    const normalized = line
      .replace(/\\([`*_~])/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const field = normalized.match(/\b(?:result|status)\s*:\s*(.*)$/iu);
    if (field === null) continue;
    const value = field[1].trim();
    if (
      !/^(?:PASS|DONE)\b/iu.test(value) ||
      /\b(?:BLOCKED|ERROR|FAIL(?:ED|URE)?|INCOMPLETE|IN[ _-]?PROGRESS|NOT[ _-]?STARTED|PENDING|SKIPPED|TODO|UNKNOWN)\b/iu.test(
        value,
      )
    ) {
      return true;
    }
  }
  return false;
}

function readProofDocumentPin(proof) {
  const { visible: visibleLines, htmlAuthority, rawHtml } = visibleProofDocumentLines(proof);
  const visiblePinLines = visibleLines.filter((line) => line.startsWith("Final artifact:"));
  if (
    visiblePinLines.length !== 1 ||
    !/^Final artifact: `sha256:[0-9a-f]{64}`$/u.test(visiblePinLines[0]) ||
    rawHtml ||
    proofDocumentHasContradictoryStatus([...visibleLines, ...htmlAuthority]) ||
    visibleLines.join("\n").includes("sha256:PENDING")
  ) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  return visiblePinLines[0];
}

/**
 * Rejects malformed proof envelopes early; PASS still requires a complete fresh build,
 * exact artifact bytes, and the final independently reacquired proof pin.
 */
export async function verifyEditorCoreAuthoringRoundTripEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const buildOptions = captureBuildOptions(options.buildOptions);
  if (buildOptions.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const preflightProofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T07 proof document",
    ));
  // Envelope admission rejects invalid candidates; only the complete fresh build can issue PASS.
  readProofDocumentPin(decodeUtf8(preflightProofBytes, "M08-T07 proof document"));
  const built = await buildCapturedEvidence(buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T07 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T07 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T07 proof document",
    ));
  const proof = decodeUtf8(proofBytes, "M08-T07 proof document");
  const exactPin = `Final artifact: \`sha256:${built.artifactSha256}\``;
  if (readProofDocumentPin(proof) !== exactPin) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    directPredecessorSha256: EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.at(-1).sha256,
    prerequisiteSha256s: EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map(
      (prerequisite) => prerequisite.sha256,
    ),
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
    if (error instanceof EditorCoreAuthoringRoundTripProofError) throw error;
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

/** Rejects unsafe destinations before building and rechecks them before the exact atomic write. */
export async function writeEditorCoreAuthoringRoundTripEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_AUTHORING_ROUND_TRIP_ARTIFACT_PATH,
  );
  const built = await buildEditorCoreAuthoringRoundTripEvidence();
  await assertSafeDestination(destinationPath);
  await writeAtomicProofArtifact({
    artifactPath: destinationPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  const committed = await readNoFollow(destinationPath, "committed M08-T07 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T07 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
