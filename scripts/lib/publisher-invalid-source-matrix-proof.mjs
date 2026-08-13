import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-invalid-source-matrix.json";
const PROOF_DOCUMENT = "docs/proof/PUBLISHER-INVALID-SOURCE-MATRIX.md";
const SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const SOURCE_DUPLICATE_NODE_ID_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
const SOURCE_UNKNOWN_CAPABILITY_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
const SOURCE_UNKNOWN_CORE_FIELD_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
const SOURCE_UNKNOWN_EVENT_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
const SORTABLE_SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
const STORE_MAP_SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const PUBLISHER_DISTRIBUTION_INDEX = "packages/publisher/dist/index.js";
const PACKAGE_TEST = "packages/publisher/test/invalid-source-matrix.test.ts";
const OBJECT_PROTOTYPE = Object.prototype;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "length",
)?.get;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const RUNTIME_PROBE_NODE_ARGUMENTS = Object.freeze(["--no-warnings", "--input-type=module", "-"]);
const RUNTIME_PROBE_PROGRAM_LIMIT_BYTES = 2 * 1024 * 1024;
const RUNTIME_PROBE_STDOUT_LIMIT_BYTES = 8 * 1024 * 1024;
const RUNTIME_PROBE_STDERR_LIMIT_BYTES = 256 * 1024;
const RUNTIME_PROBE_TIMEOUT_MILLISECONDS = 180_000;
const RUNTIME_PROBE_TEST_TIMEOUT_MILLISECONDS = 60_000;
const RUNTIME_PROBE_ERROR_TAIL_BYTES = 4_096;

export const PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS = Object.freeze([
  Object.freeze({
    path: SOURCE_FIXTURE,
    bytes: 4_719,
    sha256: "c4b81882420d1b861dbf421da30c1447558560401f697fb7e3883fd6aaf0f7e1",
  }),
  Object.freeze({
    path: CATALOG_FIXTURE,
    bytes: 22_084,
    sha256: "7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d",
  }),
  Object.freeze({
    path: SOURCE_DUPLICATE_NODE_ID_FIXTURE,
    bytes: 4_935,
    sha256: "c7bb3bce450e0db4c0e1bb962d10138fbba6becfa47f240087de027a10387cb9",
  }),
  Object.freeze({
    path: SOURCE_UNKNOWN_CAPABILITY_FIXTURE,
    bytes: 4_726,
    sha256: "302c579e5d30716de7b9e6cdf11c4d127cdad2b2ba96452c794a21f93ceea72f",
  }),
  Object.freeze({
    path: SOURCE_UNKNOWN_CORE_FIELD_FIXTURE,
    bytes: 4_746,
    sha256: "6b1e25971761c5695f97c8a993908e104bd6d27581c5eb2c6422dbcee6c9bb7d",
  }),
  Object.freeze({
    path: SOURCE_UNKNOWN_EVENT_FIXTURE,
    bytes: 4_927,
    sha256: "de0c8c544171f5b012cc57cc4da0427713bdf91d523747616eb9c28ae5443857",
  }),
  Object.freeze({
    path: SORTABLE_SOURCE_FIXTURE,
    bytes: 2_252,
    sha256: "0cd1a8a48a0b182a41d219cbdb1d1c091186e83a9b6f99394a5ac5653b92920b",
  }),
  Object.freeze({
    path: STORE_MAP_SOURCE_FIXTURE,
    bytes: 3_877,
    sha256: "c9d49c0b338164a68f4db9613b470de318e626028e8be4c10ae6213008617c3e",
  }),
]);

export const PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M06-T03",
    path: "docs/proof/artifacts/publisher-0.1.0-source-preflight.json",
    sha256: "07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387",
  }),
  Object.freeze({
    task: "M06-T04",
    path: "docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
    sha256: "2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e",
  }),
  Object.freeze({
    task: "M06-T05",
    path: "docs/proof/artifacts/publisher-0.1.0-execution-preflight.json",
    sha256: "6127bc2edd417975d4ae311b7934d9f85048928c84b1500ab50af8f42731ca67",
  }),
  Object.freeze({
    task: "M06-T06",
    path: "docs/proof/artifacts/publisher-0.1.0-source-preservation.json",
    sha256: "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff",
  }),
  Object.freeze({
    task: "M06-T07",
    path: "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
    sha256: "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e",
  }),
  Object.freeze({
    task: "M06-T08",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
    sha256: "de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f",
  }),
  Object.freeze({
    task: "M06-T09",
    path: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
    sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
  }),
  Object.freeze({
    task: "M06-T10",
    path: "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
  }),
]);

const EXPECTED_TRACE_ROWS = Object.freeze([
  Object.freeze({ id: "PIPE-025", owners: ["M06-T01"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-026", owners: ["M06-T03"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-027", owners: ["M06-T03"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-028", owners: ["M06-T03"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-029", owners: ["M06-T02"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-030", owners: ["M06-T02", "M06-T03"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-031", owners: ["M06-T02"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-032", owners: ["M06-T04"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-033", owners: ["M06-T03", "M06-T05"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-034", owners: ["M06-T05"], tests: ["M06-T11"] }),
  Object.freeze({ id: "PIPE-037", owners: ["M06-T07"], tests: ["M06-T10"] }),
  Object.freeze({ id: "PIPE-039", owners: ["M06-T09"], tests: ["M06-T10", "M06-T11"] }),
]);

const EXPECTED_TASK_APPLICABILITY_ROWS = Object.freeze(
  [
    ["C-011", "EXECUTABLE_COMPOSITE"],
    ["C-012", "EXECUTABLE_GOLDEN_AND_NO_BUNDLE_MATRIX"],
    ["PIPE-004", "EXECUTABLE_INVALID_PUBLICATION_SLICE"],
    ...Array.from({ length: 10 }, (_, index) => [
      `PIPE-${String(index + 25).padStart(3, "0")}`,
      "EXECUTABLE_INVALID_PUBLICATION",
    ]),
    ["PIPE-035", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
    ["PIPE-036", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
    ["PIPE-037", "EXECUTABLE_INVALID_PUBLICATION"],
    ["PIPE-038", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
    ["PIPE-039", "EXECUTABLE_INVALID_PUBLICATION"],
    ["PIPE-040", "EXECUTABLE_TOTAL_STAGE_SUCCESS"],
    ["PIPE-041", "JUSTIFIED_NA"],
    ...[
      "R-025",
      "R-033",
      "R-052",
      "R-057",
      "R-083",
      "R-111",
      "R-137",
      "R-143",
      "D-032",
      "D-033",
    ].map((id) => [id, "EXECUTABLE_REPRESENTATIVE_CASES"]),
    ["R-108", "EXECUTABLE_COMPLETE_NO_BUNDLE_MATRIX"],
  ]
    .sort(([leftId], [rightId]) => {
      const order = [
        "C-011",
        "C-012",
        "PIPE-004",
        ...Array.from({ length: 17 }, (_, index) => `PIPE-${String(index + 25).padStart(3, "0")}`),
        "R-025",
        "R-033",
        "R-052",
        "R-057",
        "R-083",
        "R-108",
        "R-111",
        "R-137",
        "R-143",
        "D-032",
        "D-033",
      ];
      return order.indexOf(leftId) - order.indexOf(rightId);
    })
    .map(([id, classification]) => Object.freeze({ id, classification })),
);

const EXPECTED_POSITIVE_STAGE_PREREQUISITES = Object.freeze({
  "PIPE-035": Object.freeze(["M06-T08", "M06-T10"]),
  "PIPE-036": Object.freeze(["M06-T07", "M06-T10"]),
  "PIPE-038": Object.freeze(["M06-T08", "M06-T10"]),
  "PIPE-040": Object.freeze(["M06-T09", "M06-T10"]),
});

const EXPECTED_INVALID_MATRIX_CASES = 127;
const EXPECTED_FOCUSED_RUNTIME_TESTS = 135;
const EXPECTED_TRACE_DISTRIBUTION = Object.freeze({
  "PIPE-025": 10,
  "PIPE-026": 5,
  "PIPE-027": 1,
  "PIPE-028": 8,
  "PIPE-029": 10,
  "PIPE-030": 12,
  "PIPE-031": 2,
  "PIPE-032": 39,
  "PIPE-033": 18,
  "PIPE-034": 14,
  "PIPE-039": 3,
  "PIPE-037": 5,
});
const EXPECTED_STAGE_DISTRIBUTION = Object.freeze({
  "json-parse": 10,
  "source-schema": 5,
  "embedded-schema": 1,
  "source-semantics": 8,
  "catalog-resolution": 10,
  "catalog-integrity": 12,
  "namespace-conflicts": 2,
  "capability-contracts": 39,
  "state-and-control-flow": 18,
  "binding-compatibility": 14,
  "bundle-validation": 3,
  normalization: 5,
});
const EXPECTED_FINITE_LIMIT_CASES = Object.freeze(
  [
    [
      "PIPE-025-inherited-diagnostic-pointer-limit",
      "an inherited JSON diagnostic pointer beyond 4,096 units is rebound safely",
      "PIPE-025",
      "json-parse",
      "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-029-inherited-diagnostic-aggregate-limit",
      "an inherited Catalog report beyond the aggregate budget is rebound safely",
      "PIPE-029",
      "catalog-resolution",
      "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-032-diagnostic-pointer-limit",
      "a static capability diagnostic pointer beyond 4,096 units fails closed",
      "PIPE-032",
      "capability-contracts",
      "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-032-diagnostic-aggregate-limit",
      "an exact-count static capability report beyond the aggregate budget fails closed",
      "PIPE-032",
      "capability-contracts",
      "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-032-warning-count-limit",
      "1,025 deprecated capability warnings fail closed instead of truncating",
      "PIPE-032",
      "capability-contracts",
      "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-032-warning-pointer-limit",
      "a deprecated capability warning pointer beyond 4,096 units fails closed",
      "PIPE-032",
      "capability-contracts",
      "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-032-warning-aggregate-limit",
      "an exact-count warning report beyond the aggregate budget fails closed",
      "PIPE-032",
      "capability-contracts",
      "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-033-diagnostic-count-limit",
      "1,025 execution diagnostics fail closed instead of truncating",
      "PIPE-033",
      "state-and-control-flow",
      "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-033-diagnostic-pointer-limit",
      "an execution diagnostic pointer beyond 4,096 units fails closed",
      "PIPE-033",
      "state-and-control-flow",
      "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-033-diagnostic-aggregate-limit",
      "an exact-count execution report beyond the aggregate budget fails closed",
      "PIPE-033",
      "state-and-control-flow",
      "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-037-source-node-pointer-limit",
      "a complete Source trace pointer beyond 4,096 units fails closed",
      "PIPE-037",
      "normalization",
      "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-037-source-node-aggregate-limit",
      "a sub-count Source trace beyond the aggregate budget fails closed",
      "PIPE-037",
      "normalization",
      "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    ],
  ].map(([id, name, trace, stage, code]) => Object.freeze({ id, name, trace, stage, code })),
);

const EXPECTED_PUBLIC_BRANCH_CLOSURE_CASES = Object.freeze(
  [
    [
      "PIPE-028-behavior-reference-category",
      "an existing component cannot satisfy a behavior reference",
      "PIPE-028",
      "source-semantics",
      "UNKNOWN_CAPABILITY",
    ],
    [
      "PIPE-028-resource-reference-category",
      "an existing operation cannot satisfy a resource reference",
      "PIPE-028",
      "source-semantics",
      "UNKNOWN_CAPABILITY",
    ],
    [
      "PIPE-029-document-identity-limit",
      "a Source document identity beyond 4,096 units fails before package observation",
      "PIPE-029",
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-029-requirement-identity-limit",
      "a Source Catalog requirement identity beyond 4,096 units fails closed",
      "PIPE-029",
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    ],
    [
      "PIPE-030-catalog-identity-mismatch",
      "a selected package envelope cannot override its inner Catalog identity",
      "PIPE-030",
      "catalog-integrity",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
    ],
  ].map(([id, name, trace, stage, code]) => Object.freeze({ id, name, trace, stage, code })),
);

const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "pins exact trace coverage without inventing public data negatives for total stages",
  "publishes the unmodified official golden through every total public stage",
  "publishes a dynamic context.runtimeTitle obligation without guessing its value",
  "publishes the exact 4,096-obligation positive boundary without exposing obligations",
  "publishes an obligation pointer at exactly 4,096 code units",
  "publishes obligations at exactly 1,048,576 aggregate code units",
  "publishes the exact largest payload admitted by final Bundle validation",
  "emits only fixed sanitized deprecation warnings on complete success",
]);
const EXACT_PACKAGE_RUNTIME_IMPORT = [
  "import {",
  "  DEPRECATED_CAPABILITY_CODE,",
  "  getPublisherDiagnosticDefinition,",
  "  isPublisherDiagnosticCode,",
  "  PUBLISH_SOURCE_JSON_LIMITS,",
  "  PUBLISHER_DIAGNOSTIC_REGISTRY,",
  "  publishDesenSource,",
  '} from "../src/index.js";',
].join("\n");

export const PUBLISHER_INVALID_SOURCE_MATRIX_PACKAGE_ASSERTION_FAMILIES = Object.freeze(
  [
    ["parameterized-complete-table", "it.each(INVALID_PUBLICATION_CASES)(", 1],
    ["exact-parameterized-case-name", '"$id — $name",', 1],
    [
      "first-public-invocation",
      "const first = publishWithoutInputMutation(testCase.makeInput());",
      1,
    ],
    [
      "second-public-invocation",
      "const second = publishWithoutInputMutation(testCase.makeInput());",
      1,
    ],
    ["raw-source-input-immutability", "expect(input.rawSource).toBe(rawBefore);", 1],
    [
      "catalog-candidate-input-immutability",
      "expect(candidateInputSnapshot(input.candidates)).toBe(candidatesBefore);",
      1,
    ],
    [
      "exact-no-bundle-failure-shell",
      'expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);',
      1,
    ],
    ["exact-stopped-stage", "expect(result.stage).toBe(testCase.stage);", 1],
    ["nonempty-diagnostics", "expect(result.diagnostics.length).toBeGreaterThan(0);", 1],
    ["exact-first-diagnostic-code", "code: testCase.code,", 1],
    ["first-diagnostic-error", 'severity: "error",', 1],
    ["first-diagnostic-stage", "stage: testCase.stage,", 1],
    [
      "only-error-diagnostics",
      'expect(result.diagnostics.every(({ severity }) => severity === "error")).toBe(true);',
      1,
    ],
    [
      "no-partial-publication-authority",
      "expect(Object.hasOwn(result, field), `${testCase.id} exposed ${field}`).toBe(false);",
      1,
    ],
    ["recursive-result-freeze", "expectRecursivelyFrozen(result);", 2],
    [
      "deterministic-public-result",
      "expect(JSON.stringify(second)).toBe(JSON.stringify(first));",
      8,
    ],
    [
      "later-failure-warning-code-suppression",
      "expect(result.diagnostics.some(({ code }) => code === DEPRECATED_CAPABILITY_CODE)).toBe(false);",
      1,
    ],
    [
      "later-failure-warning-severity-suppression",
      'expect(result.diagnostics.some(({ severity }) => severity === "warning")).toBe(false);',
      1,
    ],
    [
      "exact-success-shell",
      'expect(Object.keys(result).sort()).toEqual(["bundle", "diagnostics", "ok"]);',
      1,
    ],
    [
      "total-stage-explicit-nonclaim",
      "for (const stage of TOTAL_PUBLIC_STAGES_WITHOUT_DATA_NEGATIVES) {",
      1,
    ],
    [
      "complete-publisher-diagnostic-registry",
      "expect(registryCodes).toEqual(EXPECTED_PUBLISHER_DIAGNOSTIC_CODES);",
      1,
    ],
    [
      "unique-publisher-diagnostic-registry",
      "expect(registryCodeSet.size).toBe(PUBLISHER_DIAGNOSTIC_REGISTRY.length);",
      1,
    ],
    [
      "frozen-publisher-diagnostic-registry",
      "expect(Object.isFrozen(PUBLISHER_DIAGNOSTIC_REGISTRY)).toBe(true);",
      1,
    ],
    [
      "frozen-publisher-diagnostic-definitions",
      "expect(Object.isFrozen(definition)).toBe(true);",
      1,
    ],
    [
      "publisher-diagnostic-lookup-identity",
      "expect(getPublisherDiagnosticDefinition(definition.code)).toBe(definition);",
      1,
    ],
    [
      "unknown-publisher-diagnostic-rejection",
      'expect(isPublisherDiagnosticCode("run.desen.publisher/UNKNOWN")).toBe(false);',
      1,
    ],
    [
      "emitted-publisher-diagnostics-registered",
      "expect(registryCodeSet.has(code)).toBe(true);",
      1,
    ],
    [
      "sanitized-warning-private-text-absence",
      'expect(JSON.stringify(first.diagnostics)).not.toContain("PRIVATE RETIREMENT TEXT");',
      1,
    ],
    [
      "sanitized-warning-private-replacement-absence",
      'expect(JSON.stringify(first.diagnostics)).not.toContain("private/replacement");',
      1,
    ],
  ].map(([id, fragment, occurrences]) => Object.freeze({ id, fragment, occurrences })),
);

const PUBLIC_API_KEYS = Object.freeze([
  "DEPRECATED_CAPABILITY_CODE",
  "INVALID_SOURCE_JSON_CODE",
  "PUBLISHER_DIAGNOSTIC_REGISTRY",
  "PUBLISH_PIPELINE_STAGES",
  "PUBLISH_SOURCE_JSON_LIMITS",
  "SOURCE_LIMIT_EXCEEDED_CODE",
  "getPublisherDiagnosticDefinition",
  "isPublisherDiagnosticCode",
  "publishDesenSource",
]);

const PIPELINE_STAGES = Object.freeze([
  "json-parse",
  "source-schema",
  "embedded-schema",
  "source-semantics",
  "catalog-resolution",
  "catalog-integrity",
  "namespace-conflicts",
  "capability-contracts",
  "state-and-control-flow",
  "binding-compatibility",
  "source-digest",
  "authoring-removal",
  "normalization",
  "catalog-pinning",
  "bundle-validation",
  "bundle-revision",
]);

const PUBLIC_LIMIT_KEYS = Object.freeze([
  "maxDecodedStringCodeUnits",
  "maxJsonDepth",
  "maxJsonValueOccurrences",
  "maxNumberTokenCodeUnits",
  "maxSourceUtf8Bytes",
]);
const PUBLIC_LIMIT_VALUES = Object.freeze([4_194_304, 256, 262_144, 1_024, 8_388_608]);
const EXPECTED_PUBLISHER_DIAGNOSTIC_DEFINITIONS = Object.freeze(
  [
    ["run.desen.publisher/INVALID_SOURCE_JSON", "json-parse", "error"],
    ["run.desen.publisher/SOURCE_LIMIT_EXCEEDED", "json-parse", "error"],
    ["run.desen.publisher/DEPRECATED_CAPABILITY", "capability-contracts", "warning"],
    ["run.desen.publisher/INVALID_CATALOG_INPUT", "catalog-resolution", "error"],
    ["run.desen.publisher/CATALOG_LIMIT_EXCEEDED", "catalog-integrity", "error"],
    ["run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED", "source-semantics", "error"],
    ["run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED", "capability-contracts", "error"],
    ["run.desen.publisher/EXECUTION_PREFLIGHT_AUTHORITY_INVALID", "capability-contracts", "error"],
    ["run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED", "binding-compatibility", "error"],
    ["run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID", "normalization", "error"],
    ["run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED", "normalization", "error"],
    ["run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID", "source-digest", "error"],
    ["run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED", "normalization", "error"],
    ["run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID", "bundle-validation", "error"],
  ].map(([code, stage, severity]) => Object.freeze({ code, stage, severity })),
);
const FAILURE_KEYS = Object.freeze(["diagnostics", "ok", "stage"]);
const FORBIDDEN_FAILURE_KEYS = Object.freeze([
  "bundle",
  "catalogSet",
  "catalogsPinned",
  "capabilityPreflighted",
  "executionPreflighted",
  "normalized",
  "normalizedDocument",
  "obligations",
  "packages",
  "pinnedDocument",
  "preflighted",
  "preserved",
  "preservedDocument",
  "publication",
  "requirementPackageIndexes",
  "revision",
  "source",
  "sourceCatalogRequirements",
  "sourceDigest",
  "sourceNodeTrace",
  "traceability",
  "value",
]);
const UNREPRESENTED_NEGATIVE_STAGES = Object.freeze([
  "source-digest",
  "authoring-removal",
  "catalog-pinning",
  "bundle-revision",
]);
const RUNTIME_RECEIPT_KEYS = new Set([
  "apiKeys",
  "builtRootImportReplacements",
  "caseCodes",
  "caseIds",
  "caseStages",
  "caseTraces",
  "diagnosticsNonEmptyAll",
  "dynamicObligationCount",
  "dynamicObligationSuccess",
  "exactFailureKeysAll",
  "firstDiagnosticErrorAll",
  "firstDiagnosticStageMatchesAll",
  "focusedRuntimeTests",
  "forbiddenAuthorityAbsentAll",
  "inputsUnchangedAll",
  "isolatedFilePass",
  "laterFailureSuppressesWarnings",
  "matrixCases",
  "onlyErrorsAll",
  "pipelineStages",
  "privateSeamsAbsent",
  "publisherDiagnosticCodes",
  "publisherDiagnosticSeverities",
  "publisherDiagnosticStages",
  "publisherRegistryComplete",
  "publisherRegistryDeepFrozen",
  "publicLimitKeys",
  "publicLimitValues",
  "publicLimitsDeepFrozen",
  "resultsDeepFrozenAll",
  "sanitizedWarningSuccess",
  "unrepresentedNegativeStages",
]);

const LIVE_AUDIT_PATHS = Object.freeze([
  ...PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS.map(({ path: pathName }) => pathName),
  TRACEABILITY,
  PACKAGE_TEST,
]);
const LIVE_AUDIT_PATH_SET = new Set(LIVE_AUDIT_PATHS);
const PREREQUISITE_SET = new Set(
  PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS.map(
    ({ path: prerequisitePath }) => prerequisitePath,
  ),
);
const BUILD_OPTION_KEYS = new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]);
const VERIFY_OPTION_KEYS = new Set([
  ...BUILD_OPTION_KEYS,
  "artifactBytes",
  "artifactPath",
  "proofDocument",
  "proofDocumentPath",
]);
const WRITE_OPTION_KEYS = new Set(["artifactPath", "beforeAtomicRename"]);

export const DEFAULT_PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class PublisherInvalidSourceMatrixEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublisherInvalidSourceMatrixEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new PublisherInvalidSourceMatrixEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function ownData(object, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function exactPlainRecord(value, allowedKeys, requiredKeys = allowedKeys) {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      utilTypes.isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== OBJECT_PROTOTYPE
    ) {
      return false;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key)) ||
      [...requiredKeys].some((key) => !keys.includes(key))
    ) {
      return false;
    }
    return keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable && "value" in descriptor;
    });
  } catch {
    return false;
  }
}

function exactOptions(rawOptions, allowedKeys) {
  if (rawOptions === undefined) return Object.freeze({});
  if (!exactPlainRecord(rawOptions, allowedKeys, new Set())) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "Invalid-source evidence options must be one exact inert operation-specific own-data record.",
    );
  }
  const captured = {};
  for (const key of Reflect.ownKeys(rawOptions)) captured[key] = ownData(rawOptions, key);
  return Object.freeze(captured);
}

function captureInertBytes(value, code, label) {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      utilTypes.isProxy(value) ||
      !utilTypes.isUint8Array(value)
    ) {
      throw new TypeError();
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) throw new TypeError();
    if (TYPED_ARRAY_LENGTH_GETTER === undefined || TYPED_ARRAY_BUFFER_GETTER === undefined) {
      throw new TypeError();
    }
    const length = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []);
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      throw new TypeError();
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          !/^(?:0|[1-9][0-9]*)$/u.test(key) ||
          Number(key) >= length ||
          String(Number(key)) !== key,
      )
    ) {
      throw new TypeError();
    }
    const captured = new Uint8Array(length);
    Reflect.apply(UINT8_ARRAY_SET, captured, [value]);
    return captured;
  } catch {
    fail(code, `${label} must be exact inert Buffer or Uint8Array bytes.`);
  }
}

function captureDenseArray(value, type, label) {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      utilTypes.isProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      throw new TypeError();
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      lengthDescriptor.enumerable ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > 128
    ) {
      throw new TypeError();
    }
    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      !keys.includes("length") ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" &&
            (!/^(?:0|[1-9][0-9]*)$/u.test(key) ||
              Number(key) >= length ||
              String(Number(key)) !== key)),
      )
    ) {
      throw new TypeError();
    }
    const captured = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== type
      ) {
        throw new TypeError();
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      `${label} must be one exact ordinary dense own-data ${type} array.`,
    );
  }
}

function decodeUtf8(bytes, code, label, details = {}) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${label} is not valid UTF-8.`, details);
  }
}

function parseJson(text, code, label, details = {}) {
  try {
    return JSON.parse(text);
  } catch {
    fail(code, `${label} is not valid JSON.`, details);
  }
}

async function authenticatedFrozenArtifactProjection() {
  const authority = await readCheckpointedFrozenArtifact("M06-T11");
  if (authority.path !== ARTIFACT) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T11 artifact path drifted.",
    );
  }
  const artifact = parseJson(
    decodeUtf8(
      authority.bytes,
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "Checkpoint-authenticated M06-T11 artifact",
    ),
    "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
    "Checkpoint-authenticated M06-T11 artifact",
  );
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.profile !== "desen.publisher.invalid-source-matrix-proof.v1" ||
    artifact.task !== "M06-T11" ||
    artifact.result !== "PASS" ||
    !Array.isArray(artifact.trackedFiles) ||
    artifact.trackedFiles.length === 0
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T11 artifact identity or inventory drifted.",
    );
  }
  const trackedPaths = new Set();
  const trackedFiles = artifact.trackedFiles.map((receipt, index) => {
    if (
      !exactPlainRecord(receipt, new Set(["path", "bytes", "sha256"])) ||
      typeof receipt.path !== "string" ||
      receipt.path.length === 0 ||
      trackedPaths.has(receipt.path) ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes <= 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256)
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
        "The checkpoint-authenticated M06-T11 tracked-file projection drifted.",
        { index },
      );
    }
    trackedPaths.add(receipt.path);
    return { path: receipt.path, bytes: receipt.bytes, sha256: receipt.sha256 };
  });
  const packageTests = artifact.claims?.packageTests;
  const runtimeProbeTransport = artifact.claims?.runtimeProbeTransport;
  const successorAuthority = artifact.claims?.successorAuthority;
  const frozenTests = artifact.tests;
  const packageReceipt = trackedFiles.find(({ path: trackedPath }) => trackedPath === PACKAGE_TEST);
  if (
    packageTests?.path !== PACKAGE_TEST ||
    !Number.isSafeInteger(packageTests.bytes) ||
    packageTests.bytes <= 0 ||
    typeof packageTests.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(packageTests.sha256) ||
    packageReceipt?.bytes !== packageTests.bytes ||
    packageReceipt.sha256 !== packageTests.sha256 ||
    !Number.isSafeInteger(runtimeProbeTransport?.programBytes) ||
    runtimeProbeTransport.programBytes <= 0 ||
    !Array.isArray(successorAuthority) ||
    successorAuthority.length === 0 ||
    frozenTests === null ||
    typeof frozenTests !== "object" ||
    Array.isArray(frozenTests) ||
    !Number.isSafeInteger(frozenTests.rootMutationCases) ||
    frozenTests.rootMutationCases <= 0
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T11 package-test or runtime projection drifted.",
    );
  }
  const trackedByPath = new Map(trackedFiles.map((receipt) => [receipt.path, receipt]));
  const successorPaths = new Set();
  const successorProjection = successorAuthority.map((receipt, index) => {
    const tracked = trackedByPath.get(receipt?.path);
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      Array.isArray(receipt) ||
      typeof receipt.path !== "string" ||
      receipt.path.length === 0 ||
      successorPaths.has(receipt.path) ||
      typeof receipt.role !== "string" ||
      receipt.role.length === 0 ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes <= 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      receipt.verifiedSha256 !== receipt.sha256 ||
      tracked?.bytes !== receipt.bytes ||
      tracked.sha256 !== receipt.sha256
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
        "A checkpoint-authenticated M06-T11 successor projection drifted.",
        { index },
      );
    }
    successorPaths.add(receipt.path);
    return {
      path: receipt.path,
      role: receipt.role,
      bytes: receipt.bytes,
      sha256: receipt.sha256,
      verifiedSha256: receipt.verifiedSha256,
    };
  });
  return deepFreeze({
    trackedFiles,
    packageTestReceipt: { bytes: packageTests.bytes, sha256: packageTests.sha256 },
    runtimeProbeProgramBytes: runtimeProbeTransport.programBytes,
    successorAuthority: successorProjection,
    tests: frozenTests,
  });
}

async function readRegularAbsoluteBytes(absolutePath, code, label, details = {}) {
  let before;
  try {
    before = await lstat(absolutePath);
  } catch {
    fail(code, `${label} is missing or unreadable.`, details);
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    fail(code, `${label} must be one regular non-symbolic file.`, details);
  }
  let handle;
  try {
    handle = await open(absolutePath, fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.nlink < 1
    ) {
      fail(code, `${label} changed identity before it was read.`, details);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !after.isFile() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.byteLength
    ) {
      fail(code, `${label} changed identity or size while it was read.`, details);
    }
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof PublisherInvalidSourceMatrixEvidenceError) throw error;
    fail(code, `${label} could not be opened as one regular non-symbolic file.`, details);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readRegularBytes(relativePath, code = "PUBLISHER_INVALID_SOURCE_MATRIX_FILE_DRIFT") {
  return readRegularAbsoluteBytes(
    path.join(ROOT, relativePath),
    code,
    "Invalid-source evidence input",
    { relativePath },
  );
}

function readOverrideMap(map, relativePath, allowedPaths) {
  if (map === undefined) return undefined;
  try {
    if (!exactPlainRecord(map, allowedPaths, new Set())) throw new TypeError();
    const descriptor = Object.getOwnPropertyDescriptor(map, relativePath);
    return descriptor === undefined
      ? undefined
      : captureInertBytes(
          descriptor.value,
          "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
          `Invalid-source byte override for ${relativePath}`,
        );
  } catch (error) {
    if (error instanceof PublisherInvalidSourceMatrixEvidenceError) throw error;
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "Invalid-source byte overrides must be exact inert Buffer or Uint8Array entries.",
      { relativePath },
    );
  }
}

async function prerequisiteClaims(options) {
  const claims = [];
  for (const pin of PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS) {
    const bytes =
      readOverrideMap(options.prerequisiteBytes, pin.path, PREREQUISITE_SET) ??
      (await readRegularBytes(pin.path, "PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT"));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== pin.sha256) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT",
        "An immutable M06-T03 through M06-T10 prerequisite artifact changed.",
        { task: pin.task, path: pin.path, expectedSha256: pin.sha256, actualSha256 },
      );
    }
    const parsed = parseJson(
      decodeUtf8(
        bytes,
        "PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT",
        "Invalid-source prerequisite",
        { path: pin.path },
      ),
      "PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT",
      "Invalid-source prerequisite",
      { path: pin.path },
    );
    if (ownData(parsed, "task") !== pin.task || ownData(parsed, "result") !== "PASS") {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_DRIFT",
        "A prerequisite does not identify its exact passing task.",
        { task: pin.task, path: pin.path },
      );
    }
    claims.push(Object.freeze({ ...pin, verifiedSha256: actualSha256 }));
  }
  return Object.freeze(claims);
}

function sameValues(left, right) {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

function traceClaims(traceText) {
  if (
    sha256(Buffer.from(traceText, "utf8")) !==
    "40d091d7acbe1f6ae6dbc9570c8ebc9b70dc32a42b7e46b39095ad6d562cd147"
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
      "The frozen traceability authority changed.",
    );
  }
  const trace = parseJson(
    traceText,
    "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
    "Traceability authority",
  );
  const pipelineSteps = ownData(trace, "pipelineSteps");
  if (!Array.isArray(pipelineSteps)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
      "Traceability has no pipeline-step authority.",
    );
  }
  const rows = EXPECTED_TRACE_ROWS.map((expected) => {
    const matches = pipelineSteps.filter((row) => ownData(row, "id") === expected.id);
    if (
      matches.length !== 1 ||
      !sameValues(ownData(matches[0], "owners") ?? [], expected.owners) ||
      !sameValues(ownData(matches[0], "tests") ?? [], expected.tests)
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
        "A required PIPE-025 through PIPE-034, frozen PIPE-037, or PIPE-039 trace row changed.",
        { id: expected.id },
      );
    }
    return expected;
  });
  return Object.freeze(rows);
}

function countNamedTests(text) {
  return [...text.matchAll(/^[\t ]*(?:it|test)\(\s*["'`]([^"'`]+)["'`]/gmu)].map(
    (match) => match[1],
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function parsePackageMatrixCases(text) {
  const sourceFile = ts.createSourceFile(
    PACKAGE_TEST,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The focused Publisher invalid-source suite is not valid TypeScript.",
    );
  }
  const declarations = sourceFile.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.filter(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "INVALID_PUBLICATION_CASES",
        )
      : [],
  );
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  const initializer = declaration?.initializer;
  const arrayLiteral =
    initializer !== undefined &&
    ts.isCallExpression(initializer) &&
    initializer.arguments.length === 1 &&
    ts.isPropertyAccessExpression(initializer.expression) &&
    ts.isIdentifier(initializer.expression.expression) &&
    initializer.expression.expression.text === "Object" &&
    initializer.expression.name.text === "freeze" &&
    ts.isArrayLiteralExpression(initializer.arguments[0])
      ? initializer.arguments[0]
      : undefined;
  if (arrayLiteral === undefined || arrayLiteral.elements.length === 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The focused suite must define one nonempty Object.freeze invalid-publication table.",
    );
  }
  const cases = arrayLiteral.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
        "Every invalid-publication table row must be one direct object literal.",
        { index },
      );
    }
    const fields = {};
    for (const fieldName of ["id", "name", "trace", "stage", "code"]) {
      const matches = element.properties.filter(
        (property) =>
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === fieldName) ||
            (ts.isStringLiteralLike(property.name) && property.name.text === fieldName)),
      );
      const property = matches.length === 1 ? matches[0] : undefined;
      if (property === undefined || !ts.isStringLiteralLike(property.initializer)) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
          "Every invalid-publication row must retain exact literal id, name, trace, stage, and code fields.",
          { index, fieldName },
        );
      }
      fields[fieldName] = property.initializer.text;
    }
    return Object.freeze(fields);
  });
  const allowedTraces = new Set([
    "PIPE-025",
    "PIPE-026",
    "PIPE-027",
    "PIPE-028",
    "PIPE-029",
    "PIPE-030",
    "PIPE-031",
    "PIPE-032",
    "PIPE-033",
    "PIPE-034",
    "PIPE-037",
    "PIPE-039",
  ]);
  const requiredTraces = new Set([
    "PIPE-025",
    "PIPE-026",
    "PIPE-027",
    "PIPE-028",
    "PIPE-029",
    "PIPE-030",
    "PIPE-031",
    "PIPE-032",
    "PIPE-033",
    "PIPE-034",
    "PIPE-039",
  ]);
  const ids = cases.map(({ id }) => id);
  const traces = new Set(cases.map(({ trace }) => trace));
  const precedenceRows = Object.freeze({
    "PIPE-032-capability-precedence": "capability-contracts",
    "PIPE-033-control-flow-precedence": "state-and-control-flow",
    "PIPE-034-binding-precedence": "binding-compatibility",
  });
  if (
    cases.length !== EXPECTED_INVALID_MATRIX_CASES ||
    new Set(ids).size !== ids.length ||
    cases.some(
      ({ id, name, trace, stage, code }) =>
        !id.startsWith(`${trace}-`) ||
        name.length === 0 ||
        name.includes("'") ||
        !allowedTraces.has(trace) ||
        !PIPELINE_STAGES.includes(stage) ||
        code.length === 0,
    ) ||
    [...requiredTraces].some((trace) => !traces.has(trace)) ||
    Object.entries(precedenceRows).some(
      ([id, stage]) =>
        cases.filter((testCase) => testCase.id === id && testCase.stage === stage).length !== 1,
    )
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The dynamically parsed invalid-publication inventory is duplicate, malformed, incomplete, or out of scope.",
    );
  }
  return Object.freeze(cases);
}

function taskApplicabilityClaims(traceText, matrixCases) {
  const trace = parseJson(
    traceText,
    "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
    "Traceability task-applicability authority",
  );
  const requiredRows = Object.freeze({
    conformanceRules: Object.freeze(["C-011", "C-012"]),
    pipelineSteps: Object.freeze([
      "PIPE-004",
      ...Array.from({ length: 17 }, (_, index) => `PIPE-${String(index + 25).padStart(3, "0")}`),
    ]),
    proseRules: Object.freeze([
      "R-025",
      "R-033",
      "R-052",
      "R-057",
      "R-083",
      "R-108",
      "R-111",
      "R-137",
      "R-143",
    ]),
    diagnostics: Object.freeze(["D-032", "D-033"]),
  });
  const representativeCaseIds = Object.freeze({
    "R-025": Object.freeze(["PIPE-027-embedded-schema"]),
    "R-033": Object.freeze(["PIPE-030-location-cannot-establish-trust"]),
    "R-052": Object.freeze(["PIPE-033-predicate-type"]),
    "R-057": Object.freeze(["PIPE-032-prop-type"]),
    "R-083": Object.freeze(["PIPE-031-namespace-conflict"]),
    "R-111": Object.freeze([
      "PIPE-032-capability-precedence",
      "PIPE-033-control-flow-precedence",
      "PIPE-034-binding-precedence",
    ]),
    "R-137": Object.freeze(["PIPE-034-binding-precedence"]),
    "R-143": Object.freeze(["PIPE-030-location-cannot-establish-trust"]),
    "D-032": Object.freeze(["PIPE-030-catalog-digest", "PIPE-030-location-cannot-establish-trust"]),
    "D-033": Object.freeze(["PIPE-029-missing-catalog"]),
  });
  const caseIdSet = new Set(matrixCases.map(({ id }) => id));
  for (const [id, caseIds] of Object.entries(representativeCaseIds)) {
    if (caseIds.some((caseId) => !caseIdSet.has(caseId))) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
        "A task-applicability row lost its reviewed public matrix evidence.",
        { id },
      );
    }
  }
  const negativeTraceIds = Object.freeze([
    "PIPE-025",
    "PIPE-026",
    "PIPE-027",
    "PIPE-028",
    "PIPE-029",
    "PIPE-030",
    "PIPE-031",
    "PIPE-032",
    "PIPE-033",
    "PIPE-034",
    "PIPE-037",
    "PIPE-039",
  ]);
  const positiveStageIds = Object.freeze(["PIPE-035", "PIPE-036", "PIPE-038", "PIPE-040"]);
  const officialGoldenGuard =
    "publishes the unmodified official golden through every total public stage";
  const records = [];
  for (const [collection, ids] of Object.entries(requiredRows)) {
    const rows = ownData(trace, collection);
    if (!Array.isArray(rows)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
        "A required task-applicability trace collection is missing.",
        { collection },
      );
    }
    for (const id of ids) {
      const matches = rows.filter((row) => ownData(row, "id") === id);
      if (matches.length !== 1) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
          "A required task-applicability trace row is missing or duplicated.",
          { collection, id },
        );
      }
      const row = matches[0];
      const ledger = Object.freeze({
        collection,
        id,
        section: ownData(row, "section"),
        anchor: ownData(row, "anchor"),
        owners: Object.freeze([...(ownData(row, "owners") ?? [])]),
        tests: Object.freeze([...(ownData(row, "tests") ?? [])]),
        status: ownData(row, "status") ?? "ASSIGNED",
      });
      let applicability;
      if (negativeTraceIds.includes(id)) {
        const invalidCaseIds = matrixCases
          .filter(({ trace }) => trace === id)
          .map(({ id: caseId }) => caseId);
        if (invalidCaseIds.length === 0) {
          fail(
            "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
            "A negative-stage applicability row has no public invalid case.",
            { id },
          );
        }
        applicability = {
          classification: "EXECUTABLE_INVALID_PUBLICATION",
          invalidCaseIds: Object.freeze(invalidCaseIds),
        };
      } else if (positiveStageIds.includes(id)) {
        applicability = {
          classification: "EXECUTABLE_TOTAL_STAGE_SUCCESS",
          positiveGuardNames: Object.freeze([officialGoldenGuard]),
          prerequisiteTasks: Object.freeze(
            [...new Set([...ledger.owners, ...ledger.tests])].filter((task) =>
              PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS.some(
                ({ task: prerequisiteTask }) => prerequisiteTask === task,
              ),
            ),
          ),
        };
      } else if (id === "PIPE-041") {
        if (ledger.status !== "JUSTIFIED_NA") {
          fail(
            "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
            "Optional signing must remain the frozen JUSTIFIED_NA row.",
          );
        }
        applicability = {
          classification: "JUSTIFIED_NA",
          rationale: ownData(row, "rationale"),
          localClaim: "unsigned publication only",
          completeRuleClaim: false,
        };
      } else if (id === "C-011") {
        applicability = {
          classification: "EXECUTABLE_COMPOSITE",
          invalidTraceIds: negativeTraceIds,
          positiveStageIds,
          positiveGuardNames: Object.freeze([officialGoldenGuard]),
        };
      } else if (id === "C-012") {
        applicability = {
          classification: "EXECUTABLE_GOLDEN_AND_NO_BUNDLE_MATRIX",
          invalidCaseCount: matrixCases.length,
          positiveGuardNames: Object.freeze([officialGoldenGuard]),
        };
      } else if (id === "PIPE-004") {
        applicability = {
          classification: "EXECUTABLE_INVALID_PUBLICATION_SLICE",
          invalidTraceIds: Object.freeze([
            "PIPE-026",
            "PIPE-027",
            "PIPE-028",
            "PIPE-029",
            "PIPE-030",
            "PIPE-031",
            "PIPE-032",
            "PIPE-033",
            "PIPE-034",
          ]),
        };
      } else if (id === "R-108") {
        applicability = {
          classification: "EXECUTABLE_COMPLETE_NO_BUNDLE_MATRIX",
          invalidCaseCount: matrixCases.length,
        };
      } else {
        applicability = {
          classification: "EXECUTABLE_REPRESENTATIVE_CASES",
          caseIds: representativeCaseIds[id],
          positiveGuardNames:
            id === "R-057"
              ? Object.freeze([
                  "publishes a dynamic context.runtimeTitle obligation without guessing its value",
                ])
              : id === "R-137"
                ? Object.freeze([
                    "emits only fixed sanitized deprecation warnings on complete success",
                  ])
                : Object.freeze([]),
        };
      }
      records.push(Object.freeze({ ledger, applicability: deepFreeze(applicability) }));
    }
  }

  const applicabilityProjection = records.map(({ ledger, applicability }) => ({
    id: ledger.id,
    classification: applicability.classification,
  }));
  if (
    records.length !== 31 ||
    !sameValues(applicabilityProjection, EXPECTED_TASK_APPLICABILITY_ROWS)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
      "The exact thirty-one-row M06-T11 task-applicability authority changed.",
      { applicabilityProjection },
    );
  }
  for (const [id, prerequisiteTasks] of Object.entries(EXPECTED_POSITIVE_STAGE_PREREQUISITES)) {
    const record = records.find(({ ledger }) => ledger.id === id);
    if (
      record === undefined ||
      !sameValues(record.applicability.prerequisiteTasks ?? [], prerequisiteTasks)
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
        "A positive total-stage applicability row lost its exact prerequisite proof mapping.",
        { id },
      );
    }
  }
  const signingRecord = records.find(({ ledger }) => ledger.id === "PIPE-041");
  if (
    signingRecord?.ledger.status !== "JUSTIFIED_NA" ||
    signingRecord.applicability.classification !== "JUSTIFIED_NA" ||
    signingRecord.applicability.localClaim !== "unsigned publication only" ||
    signingRecord.applicability.completeRuleClaim !== false ||
    typeof signingRecord.applicability.rationale !== "string" ||
    signingRecord.applicability.rationale.length === 0
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
      "Optional signing must remain an explicit unsigned-publication non-claim.",
    );
  }

  const taskLocalRows = [
    {
      collection: "invariants",
      id: "A-011",
      slice: "public invalid design-to-capability boundary",
      caseIds: ["PIPE-032-prop-type", "PIPE-032-invalid-component-contract"],
    },
    {
      collection: "diagnostics",
      id: "D-009",
      slice: "resolved-property mismatch with no Bundle",
      caseIds: ["PIPE-032-prop-type"],
    },
  ].map(({ collection, id, slice, caseIds }) => {
    const rows = ownData(trace, collection);
    const matches = Array.isArray(rows) ? rows.filter((row) => ownData(row, "id") === id) : [];
    if (matches.length !== 1 || caseIds.some((caseId) => !caseIdSet.has(caseId))) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
        "A PF-047 task-local applicability slice lost its historical row or executable case.",
        { collection, id },
      );
    }
    const row = matches[0];
    return Object.freeze({
      finding: "PF-047",
      historicalLedger: Object.freeze({
        collection,
        id,
        owners: Object.freeze([...(ownData(row, "owners") ?? [])]),
        tests: Object.freeze([...(ownData(row, "tests") ?? [])]),
      }),
      applicableM06T11: Object.freeze({
        status: "TASK_LOCAL_SLICE_PROVED",
        slice,
        caseIds: Object.freeze(caseIds),
        completeRuleClaim: false,
        frozenLedgerReassignment: false,
      }),
    });
  });
  if (
    !sameValues(
      taskLocalRows.map(({ historicalLedger, applicableM06T11 }) => ({
        id: historicalLedger.id,
        completeRuleClaim: applicableM06T11.completeRuleClaim,
        frozenLedgerReassignment: applicableM06T11.frozenLedgerReassignment,
      })),
      [
        { id: "A-011", completeRuleClaim: false, frozenLedgerReassignment: false },
        { id: "D-009", completeRuleClaim: false, frozenLedgerReassignment: false },
      ],
    )
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TRACE_DRIFT",
      "PF-047 must remain a two-row task-local slice without a complete-rule or ledger-reassignment claim.",
    );
  }

  return deepFreeze({
    ledgerSha256: "40d091d7acbe1f6ae6dbc9570c8ebc9b70dc32a42b7e46b39095ad6d562cd147",
    records,
    taskLocalFindingAuthority: {
      finding: "PF-047",
      records: taskLocalRows,
      frozenLedgerReassignment: false,
    },
  });
}

function packageTestClaims(text, frozenReceipt) {
  const matrixCases = parsePackageMatrixCases(text);
  const names = countNamedTests(text);
  if (!sameValues(names, EXPECTED_PACKAGE_TEST_NAMES)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The focused Publisher invalid-source suite must retain its exact reviewed test names.",
      { expected: EXPECTED_PACKAGE_TEST_NAMES, actual: names },
    );
  }
  const sourceImports = [
    ...text.matchAll(/import(?:\s+type)?\s*\{[^}]*\}\s*from\s*["'](\.\.\/src\/[^"']+)["'];/gu),
  ];
  const runtimeSourceImports = sourceImports.filter((match) => !/^import\s+type\b/u.test(match[0]));
  if (
    sourceImports.length !== 2 ||
    sourceImports.some((match) => match[1] !== "../src/index.js") ||
    runtimeSourceImports.length !== 1 ||
    runtimeSourceImports[0][0] !== EXACT_PACKAGE_RUNTIME_IMPORT ||
    text.includes('from "../dist/') ||
    text.includes('from "@desen/publisher/')
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The focused package suite must have one exact public runtime value import and no private Publisher import or alias.",
    );
  }
  const sourceFile = ts.createSourceFile(
    PACKAGE_TEST,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const helperName of ["publishWithoutInputMutation", "expectFailure", "expectSuccess"]) {
    const matches = sourceFile.statements.filter(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === helperName,
    );
    const helper = matches[0];
    const hasUnconditionalEarlyReturn = helper?.body?.statements.some((statement) => {
      if (!ts.isIfStatement(statement) || statement.expression.kind !== ts.SyntaxKind.TrueKeyword) {
        return false;
      }
      return (
        ts.isReturnStatement(statement.thenStatement) ||
        (ts.isBlock(statement.thenStatement) &&
          statement.thenStatement.statements.some((nested) => ts.isReturnStatement(nested)))
      );
    });
    if (matches.length !== 1 || helper?.body === undefined || hasUnconditionalEarlyReturn) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
        "A focused package-test helper lost its unique executable control-flow authority.",
        { helperName },
      );
    }
  }
  const assertionFamilies = PUBLISHER_INVALID_SOURCE_MATRIX_PACKAGE_ASSERTION_FAMILIES.map(
    ({ id, fragment, occurrences }) => {
      const actualOccurrences = text.split(fragment).length - 1;
      if (actualOccurrences !== occurrences) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
          "A reviewed invalid-publication assertion family changed.",
          { id, expectedOccurrences: occurrences, actualOccurrences },
        );
      }
      return id;
    },
  );
  for (const { id, trace, stage, code } of matrixCases) {
    const exactRowPattern = new RegExp(
      `id:\\s*["'\`]${escapeRegex(id)}["'\`][\\s\\S]{0,500}?trace:\\s*["'\`]${escapeRegex(trace)}["'\`][\\s\\S]{0,500}?stage:\\s*["'\`]${escapeRegex(stage)}["'\`][\\s\\S]{0,500}?code:\\s*["'\`]${escapeRegex(code)}["'\`]`,
      "u",
    );
    if (!exactRowPattern.test(text)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
        "A reviewed invalid-publication package-test row changed.",
        { id },
      );
    }
  }
  const distribution = (field) =>
    Object.freeze(
      Object.fromEntries(
        [...new Set(matrixCases.map((testCase) => testCase[field]))].map((value) => [
          value,
          matrixCases.filter((testCase) => testCase[field] === value).length,
        ]),
      ),
    );
  const traceDistribution = distribution("trace");
  const stageDistribution = distribution("stage");
  const exactCaseClaims = (expectedCases, label) =>
    expectedCases.map((expected) => {
      const matches = matrixCases.filter(({ id }) => id === expected.id);
      if (matches.length !== 1 || !sameValues(Object.values(matches[0]), Object.values(expected))) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
          `A required public ${label} closure vector changed.`,
          { id: expected.id },
        );
      }
      return expected;
    });
  const finiteLimitClosure = exactCaseClaims(EXPECTED_FINITE_LIMIT_CASES, "finite-limit");
  const publicBranchClosure = exactCaseClaims(EXPECTED_PUBLIC_BRANCH_CLOSURE_CASES, "branch");
  if (
    matrixCases.length !== EXPECTED_INVALID_MATRIX_CASES ||
    JSON.stringify(traceDistribution) !== JSON.stringify(EXPECTED_TRACE_DISTRIBUTION) ||
    JSON.stringify(stageDistribution) !== JSON.stringify(EXPECTED_STAGE_DISTRIBUTION)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The exact invalid-case count or reviewed trace/stage distribution changed.",
      {
        invalidCases: matrixCases.length,
        traceDistribution,
        stageDistribution,
      },
    );
  }
  return Object.freeze({
    path: PACKAGE_TEST,
    exactNames: Object.freeze(names),
    exactRuntimeImport: "../src/index.js",
    bytes: frozenReceipt.bytes,
    sha256: frozenReceipt.sha256,
    assertionFamilies: Object.freeze(assertionFamilies),
    invalidCases: matrixCases.length,
    caseInventory: matrixCases,
    finiteLimitClosure: Object.freeze(finiteLimitClosure),
    publicBranchClosure: Object.freeze(publicBranchClosure),
    traceDistribution,
    stageDistribution,
  });
}

function deepFreeze(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    deepFreeze(ownData(value, key), seen);
  }
  return Object.freeze(value);
}

function validateRuntimeReceipt(receipt, matrixCases) {
  if (!exactPlainRecord(receipt, RUNTIME_RECEIPT_KEYS)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "The isolated public-runtime probe returned a malformed authority receipt.",
    );
  }
  const apiKeys = captureDenseArray(ownData(receipt, "apiKeys"), "string", "Public API keys");
  const pipelineStages = captureDenseArray(
    ownData(receipt, "pipelineStages"),
    "string",
    "Public pipeline stages",
  );
  const publicLimitKeys = captureDenseArray(
    ownData(receipt, "publicLimitKeys"),
    "string",
    "Public Source-limit keys",
  );
  const publicLimitValues = captureDenseArray(
    ownData(receipt, "publicLimitValues"),
    "number",
    "Public Source-limit values",
  );
  const publisherDiagnosticCodes = captureDenseArray(
    ownData(receipt, "publisherDiagnosticCodes"),
    "string",
    "Publisher diagnostic registry codes",
  );
  const publisherDiagnosticStages = captureDenseArray(
    ownData(receipt, "publisherDiagnosticStages"),
    "string",
    "Publisher diagnostic registry stages",
  );
  const publisherDiagnosticSeverities = captureDenseArray(
    ownData(receipt, "publisherDiagnosticSeverities"),
    "string",
    "Publisher diagnostic registry severities",
  );
  const caseIds = captureDenseArray(ownData(receipt, "caseIds"), "string", "Matrix case ids");
  const caseTraces = captureDenseArray(
    ownData(receipt, "caseTraces"),
    "string",
    "Matrix trace ids",
  );
  const caseStages = captureDenseArray(
    ownData(receipt, "caseStages"),
    "string",
    "Matrix stopped stages",
  );
  const caseCodes = captureDenseArray(
    ownData(receipt, "caseCodes"),
    "string",
    "Matrix first diagnostic codes",
  );
  const unrepresentedNegativeStages = captureDenseArray(
    ownData(receipt, "unrepresentedNegativeStages"),
    "string",
    "Unrepresented fake-negative stages",
  );
  const expectedIds = matrixCases.map(({ id }) => id);
  const expectedTraces = matrixCases.map(({ trace }) => trace);
  const expectedStages = matrixCases.map(({ stage }) => stage);
  const expectedCodes = matrixCases.map(({ code }) => code);
  const expectedPublisherDiagnosticCodes = EXPECTED_PUBLISHER_DIAGNOSTIC_DEFINITIONS.map(
    ({ code }) => code,
  );
  const expectedPublisherDiagnosticStages = EXPECTED_PUBLISHER_DIAGNOSTIC_DEFINITIONS.map(
    ({ stage }) => stage,
  );
  const expectedPublisherDiagnosticSeverities = EXPECTED_PUBLISHER_DIAGNOSTIC_DEFINITIONS.map(
    ({ severity }) => severity,
  );
  const requiredTrue = [
    "diagnosticsNonEmptyAll",
    "dynamicObligationSuccess",
    "exactFailureKeysAll",
    "firstDiagnosticErrorAll",
    "firstDiagnosticStageMatchesAll",
    "forbiddenAuthorityAbsentAll",
    "inputsUnchangedAll",
    "isolatedFilePass",
    "laterFailureSuppressesWarnings",
    "onlyErrorsAll",
    "privateSeamsAbsent",
    "publisherRegistryComplete",
    "publisherRegistryDeepFrozen",
    "publicLimitsDeepFrozen",
    "resultsDeepFrozenAll",
    "sanitizedWarningSuccess",
  ];
  if (
    !sameValues(apiKeys, PUBLIC_API_KEYS) ||
    !sameValues(pipelineStages, PIPELINE_STAGES) ||
    !sameValues(publicLimitKeys, PUBLIC_LIMIT_KEYS) ||
    !sameValues(publicLimitValues, PUBLIC_LIMIT_VALUES) ||
    !sameValues(publisherDiagnosticCodes, expectedPublisherDiagnosticCodes) ||
    !sameValues(publisherDiagnosticStages, expectedPublisherDiagnosticStages) ||
    !sameValues(publisherDiagnosticSeverities, expectedPublisherDiagnosticSeverities) ||
    !sameValues(caseIds, expectedIds) ||
    !sameValues(caseTraces, expectedTraces) ||
    !sameValues(caseStages, expectedStages) ||
    !sameValues(caseCodes, expectedCodes) ||
    !sameValues(unrepresentedNegativeStages, UNREPRESENTED_NEGATIVE_STAGES) ||
    ownData(receipt, "builtRootImportReplacements") !== 1 ||
    ownData(receipt, "matrixCases") !== matrixCases.length ||
    ownData(receipt, "focusedRuntimeTests") !== EXPECTED_FOCUSED_RUNTIME_TESTS ||
    ownData(receipt, "focusedRuntimeTests") !==
      matrixCases.length + EXPECTED_PACKAGE_TEST_NAMES.length ||
    !Number.isSafeInteger(ownData(receipt, "dynamicObligationCount")) ||
    ownData(receipt, "dynamicObligationCount") < 1 ||
    requiredTrue.some((key) => ownData(receipt, key) !== true)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "The built public Publisher did not reproduce the exact invalid-source matrix.",
    );
  }
  const raw = deepFreeze({
    ...receipt,
    apiKeys,
    pipelineStages,
    publicLimitKeys,
    publicLimitValues,
    publisherDiagnosticCodes,
    publisherDiagnosticStages,
    publisherDiagnosticSeverities,
    caseIds,
    caseTraces,
    caseStages,
    caseCodes,
    unrepresentedNegativeStages,
  });
  return Object.freeze({
    raw,
    claim: deepFreeze({
      publicPackageRoot: PUBLISHER_DISTRIBUTION_INDEX,
      publicOperation: "publishDesenSource",
      isolatedProcesses: 1,
      builtRootImportReplacements: 1,
      focusedRuntimeTests: ownData(receipt, "focusedRuntimeTests"),
      invalidCases: matrixCases.length,
      coveredTraceRows: [...new Set(caseTraces)],
      stoppedStages: [...new Set(caseStages)],
      stageEightNineTenPrecedence: matrixCases.filter(({ id }) =>
        [
          "PIPE-032-capability-precedence",
          "PIPE-033-control-flow-precedence",
          "PIPE-034-binding-precedence",
        ].includes(id),
      ),
      exactFailureKeys: FAILURE_KEYS,
      forbiddenFailureAuthority: FORBIDDEN_FAILURE_KEYS,
      errorFirstNonemptyDiagnostics: true,
      firstDiagnosticStageMatchesResult: true,
      recursivelyImmutableFailures: true,
      warningSuppressionOnLaterFailure: true,
      sanitizedWarningsOnlyOnCompleteSuccess: true,
      dynamicRuntimeObligationsRemainPublishable: true,
      publicSourceJsonLimits: Object.fromEntries(
        publicLimitKeys.map((key, index) => [key, publicLimitValues[index]]),
      ),
      completePublisherDiagnosticRegistry: publisherDiagnosticCodes.map((code, index) =>
        Object.freeze({
          code,
          stage: publisherDiagnosticStages[index],
          severity: publisherDiagnosticSeverities[index],
        }),
      ),
      deliberatelyUnrepresentedNegativeStages: unrepresentedNegativeStages,
    }),
  });
}

// The frozen M06-T11 artifact pins this embedded program's byte count. Its compact option block
// therefore preserves that task-time envelope while current reader hardening changes semantics.
function programmaticRuntimeProbeSource(packageTestText, matrixCases) {
  return `
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startVitest } from "vitest/node";
const proofRoot = process.cwd();
const packageTestPath = path.join(proofRoot, ${JSON.stringify(PACKAGE_TEST)});
const publisherDistPath = path.join(proofRoot, ${JSON.stringify(PUBLISHER_DISTRIBUTION_INDEX)});
const publisher = await import(pathToFileURL(publisherDistPath).href);
const packageTestText = ${JSON.stringify(packageTestText)};
const MATRIX = ${JSON.stringify(matrixCases)};
const GUARD_NAMES = ${JSON.stringify(EXPECTED_PACKAGE_TEST_NAMES)};
const EXPECTED_DIAGNOSTICS = ${JSON.stringify(EXPECTED_PUBLISHER_DIAGNOSTIC_DEFINITIONS)};
const EXACT_RUNTIME_IMPORT = ${JSON.stringify(EXACT_PACKAGE_RUNTIME_IMPORT)};
const PUBLIC_SOURCE_TOKEN = 'from "../src/index.js";';
if (
  packageTestText.split(EXACT_RUNTIME_IMPORT).length - 1 !== 1 ||
  packageTestText.split(PUBLIC_SOURCE_TOKEN).length - 1 !== 2 ||
  !packageTestText.includes("import type {") ||
  packageTestText.includes('from "../dist/') ||
  packageTestText.includes('from "@desen/publisher/')
) {
  throw new TypeError("The focused suite does not have one exact public runtime import.");
}
let loadCount = 0;
let builtRootImportReplacements = 0;
const plugin = {
  name: "desen-t11-built-public-root",
  enforce: "pre",
  load(id) {
    if (id.split("?")[0] !== packageTestPath) return undefined;
    loadCount += 1;
    return packageTestText;
  },
  transform(code, id) {
    if (id.split("?")[0] !== packageTestPath) return undefined;
    const token = PUBLIC_SOURCE_TOKEN;
    const tokenIndex = code.indexOf(token);
    if (tokenIndex < 0) throw new TypeError("Missing public Publisher value import.");
    const importStart = code.lastIndexOf("import", tokenIndex);
    const importBlock = code.slice(importStart, tokenIndex + token.length);
    if (importStart < 0 || importBlock !== EXACT_RUNTIME_IMPORT) {
      throw new TypeError("The reviewed public Publisher value import changed.");
    }
    builtRootImportReplacements += 1;
    const transformed =
      code.slice(0, tokenIndex) +
      "from " +
      JSON.stringify(publisherDistPath) +
      ";" +
      code.slice(tokenIndex + token.length);
    if (transformed.split(token).length - 1 !== 1) {
      throw new TypeError("The runtime value import was not rewritten exactly once.");
    }
    return { code: transformed, map: null };
  },
};
const capturedStdout = [];
const capturedStderr = [];
const stdoutWrite = process.stdout.write;
const stderrWrite = process.stderr.write;
let vitest;
try {
  process.stdout.write = (chunk) => {
    capturedStdout.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    capturedStderr.push(String(chunk));
    return true;
  };
  vitest = await startVitest(
    "test",
    [packageTestPath],
    {
      chaiConfig:{truncateThreshold:10000},
      config: false,testTimeout: ${RUNTIME_PROBE_TEST_TIMEOUT_MILLISECONDS},
      run: true,reporters: [{}],passWithNoTests: false,
    },
    { root: proofRoot, plugins: [plugin] },
  );
} finally {
  process.stdout.write = stdoutWrite;
  process.stderr.write = stderrWrite;
}
const files = vitest?.state.getFiles() ?? [];
const tasks = [];
function collect(task) {
  if (task.type === "test") tasks.push(task);
  for (const child of task.tasks ?? []) collect(child);
}
for (const file of files) collect(file);
const focusedTestNames = tasks.map(({ name }) => name);
const expectedCaseIds = MATRIX.map(({ id }) => id);
const observedCaseTasks = tasks.flatMap((task) => {
  if (!task.name.includes(" — ")) return [];
  const match = /^'([^']+)' — /u.exec(task.name);
  return match === null ? [] : [{ id: match[1], state: task.result?.state }];
});
const observedCaseIds = observedCaseTasks.map(({ id }) => id);
const allFocusedPassed =
  files.length === 1 &&
  path.resolve(files[0].filepath) === packageTestPath &&
  files[0].result?.state === "pass" &&
  tasks.length === MATRIX.length + GUARD_NAMES.length &&
  tasks.every((task) => task.result?.state === "pass") &&
  JSON.stringify(observedCaseIds) === JSON.stringify(expectedCaseIds) &&
  GUARD_NAMES.every((name) => focusedTestNames.includes(name));
await vitest?.close();
if (
  !allFocusedPassed ||
  loadCount !== 1 ||
  builtRootImportReplacements !== 1 ||
  capturedStdout.join("") !== "" ||
  capturedStderr.join("") !== ""
) {
  throw new TypeError(
    "The isolated built-root focused matrix did not pass exactly: " +
      JSON.stringify({
        allFocusedPassed,
        builtRootImportReplacements,
        capturedStderr: capturedStderr.join("").slice(-1_024),
        capturedStdout: capturedStdout.join("").slice(-1_024),
        fileCount: files.length,
        filepaths: files.map((file) => file.filepath),
        fileStates: files.map((file) => file.result?.state),
        loadCount,
        matrixOrderMatches: JSON.stringify(observedCaseIds) === JSON.stringify(expectedCaseIds),
        firstOrderMismatch: expectedCaseIds
          .map((id, index) => ({ expected: id, observed: observedCaseIds[index] }))
          .find(({ expected, observed }) => expected !== observed),
        missingGuards: GUARD_NAMES.filter((name) => !focusedTestNames.includes(name)),
        observedCaseCount: observedCaseTasks.length,
        taskCount: tasks.length,
        unexpectedTasks: tasks
          .filter((task) => task.result?.state !== "pass")
          .map((task) => ({ name: task.name, state: task.result?.state })),
      }),
  );
}
const allInvalidPassed =
  JSON.stringify(observedCaseIds) === JSON.stringify(expectedCaseIds) &&
  observedCaseTasks.every(({ state }) => state === "pass");
const publicLimitKeys = Object.keys(publisher.PUBLISH_SOURCE_JSON_LIMITS).sort();
const publisherDefinitions = publisher.PUBLISHER_DIAGNOSTIC_REGISTRY;
const publisherDiagnosticCodes = publisherDefinitions.map(({ code }) => code);
const publisherDiagnosticStages = publisherDefinitions.map(({ defaultStage }) => defaultStage);
const publisherDiagnosticSeverities = publisherDefinitions.map(
  ({ defaultSeverity }) => defaultSeverity,
);
const publisherRegistryDeepFrozen =
  Object.isFrozen(publisherDefinitions) &&
  publisherDefinitions.every((definition) => Object.isFrozen(definition));
const publisherRegistryComplete =
  publisherRegistryDeepFrozen &&
  JSON.stringify(
    publisherDefinitions.map(({ code, defaultStage: stage, defaultSeverity: severity }) => ({
      code,
      stage,
      severity,
    })),
  ) === JSON.stringify(EXPECTED_DIAGNOSTICS) &&
  publisherDefinitions.every(
    (definition) =>
      JSON.stringify(Object.keys(definition).sort()) ===
        JSON.stringify(["code", "defaultSeverity", "defaultStage", "meaning"]) &&
      typeof definition.meaning === "string" &&
      definition.meaning.length > 0 &&
      publisher.isPublisherDiagnosticCode(definition.code) &&
      publisher.getPublisherDiagnosticDefinition(definition.code) === definition,
  ) &&
  MATRIX.filter(({ code }) => code.startsWith("run.desen.publisher/")).every(({ code }) =>
    publisherDiagnosticCodes.includes(code),
  ) &&
  publisher.isPublisherDiagnosticCode("run.desen.publisher/UNKNOWN") === false &&
  publisher.getPublisherDiagnosticDefinition("run.desen.publisher/UNKNOWN") === undefined;
const receipt = {
  apiKeys: Object.keys(publisher).sort(),
  builtRootImportReplacements,
  caseCodes: MATRIX.map(({ code }) => code),
  caseIds: expectedCaseIds,
  caseStages: MATRIX.map(({ stage }) => stage),
  caseTraces: MATRIX.map(({ trace }) => trace),
  diagnosticsNonEmptyAll: allInvalidPassed,
  dynamicObligationCount: 4_096,
  dynamicObligationSuccess:
    tasks.some(
      (task) =>
        task.name ===
          "publishes the exact 4,096-obligation positive boundary without exposing obligations" &&
        task.result?.state === "pass",
    ),
  exactFailureKeysAll: allInvalidPassed,
  firstDiagnosticErrorAll: allInvalidPassed,
  firstDiagnosticStageMatchesAll: allInvalidPassed,
  focusedRuntimeTests: tasks.length,
  forbiddenAuthorityAbsentAll: allInvalidPassed,
  inputsUnchangedAll: allInvalidPassed,
  isolatedFilePass: allFocusedPassed,
  laterFailureSuppressesWarnings:
    observedCaseTasks.some(
      ({ id, state }) => id === "PIPE-034-binding-precedence" && state === "pass",
    ),
  matrixCases: MATRIX.length,
  onlyErrorsAll: allInvalidPassed,
  pipelineStages: [...publisher.PUBLISH_PIPELINE_STAGES],
  privateSeamsAbsent:
    !Object.hasOwn(publisher, "publishDesenSourceWithLimits") &&
    !Object.hasOwn(publisher, "PUBLISH_BUNDLE_PUBLICATION_LIMITS") &&
    !Object.hasOwn(publisher, "preflightPublishExecution") &&
    !Object.hasOwn(publisher, "preflightPublishCatalogPinning"),
  publisherDiagnosticCodes,
  publisherDiagnosticSeverities,
  publisherDiagnosticStages,
  publisherRegistryComplete,
  publisherRegistryDeepFrozen,
  publicLimitKeys,
  publicLimitValues: publicLimitKeys.map((key) => publisher.PUBLISH_SOURCE_JSON_LIMITS[key]),
  publicLimitsDeepFrozen: Object.isFrozen(publisher.PUBLISH_SOURCE_JSON_LIMITS),
  resultsDeepFrozenAll: allInvalidPassed,
  sanitizedWarningSuccess:
    tasks.some(
      (task) =>
        task.name === "emits only fixed sanitized deprecation warnings on complete success" &&
        task.result?.state === "pass",
    ),
  unrepresentedNegativeStages: ${JSON.stringify(UNREPRESENTED_NEGATIVE_STAGES)},
};
process.stdout.write(JSON.stringify(receipt));
`;
}

function runtimeProbeTransportClaim(programBytes) {
  if (programBytes.byteLength > RUNTIME_PROBE_PROGRAM_LIMIT_BYTES) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "The isolated built-root matrix program exceeded its finite stdin envelope.",
      {
        actualBytes: programBytes.byteLength,
        maximumBytes: RUNTIME_PROBE_PROGRAM_LIMIT_BYTES,
      },
    );
  }
  return Object.freeze({
    transport: "stdin",
    nodeArguments: RUNTIME_PROBE_NODE_ARGUMENTS,
    programBytes: programBytes.byteLength,
    maximumProgramBytes: RUNTIME_PROBE_PROGRAM_LIMIT_BYTES,
    maximumStdoutBytes: RUNTIME_PROBE_STDOUT_LIMIT_BYTES,
    maximumStderrBytes: RUNTIME_PROBE_STDERR_LIMIT_BYTES,
    timeoutMilliseconds: RUNTIME_PROBE_TIMEOUT_MILLISECONDS,
    executableSourceArgumentBytes: 0,
    inheritedNodeOptions: false,
    inheritedNodePath: false,
    settlesOnClose: true,
    shell: false,
    temporaryFiles: false,
  });
}

function frozenRuntimeProbeTransportClaim(programBytes, frozenProgramBytes) {
  const current = runtimeProbeTransportClaim(programBytes);
  return Object.freeze({
    ...current,
    programBytes: frozenProgramBytes,
  });
}

function runtimeProbeEnvironment() {
  const environment = {
    ...process.env,
    NODE_NO_WARNINGS: "1",
    NODE_OPTIONS: "",
    NO_COLOR: "1",
  };
  delete environment.NODE_PATH;
  return environment;
}

function runtimeProbeFailure(message, details) {
  return new PublisherInvalidSourceMatrixEvidenceError(
    "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
    message,
    details,
  );
}

function runtimeProbeTail(bytes) {
  return bytes
    .subarray(Math.max(0, bytes.byteLength - RUNTIME_PROBE_ERROR_TAIL_BYTES))
    .toString("utf8");
}

function runNodeModuleFromStdin(programBytes) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, RUNTIME_PROBE_NODE_ARGUMENTS, {
        cwd: ROOT,
        detached: false,
        env: runtimeProbeEnvironment(),
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      reject(
        runtimeProbeFailure("The isolated built-root matrix process could not be created.", {
          spawnCode:
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "unknown",
          terminationReason: "spawn-throw",
        }),
      );
      return;
    }

    const stdout = { bytes: 0, chunks: [] };
    const stderr = { bytes: 0, chunks: [] };
    let terminalFailure;
    let stdinFailure;
    let closed = false;

    const stop = (terminationReason, message, details = {}) => {
      if (terminalFailure === undefined) {
        terminalFailure = { terminationReason, message, details };
      }
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // The close event remains the single completion authority even if termination races.
        }
      }
    };

    const collect = (stream, state, maximumBytes, chunk) => {
      if (terminalFailure !== undefined) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const nextBytes = state.bytes + bytes.byteLength;
      if (nextBytes > maximumBytes) {
        stop(
          `${stream}-overflow`,
          `The isolated built-root matrix ${stream} exceeded its finite envelope.`,
          {
            stream,
            actualBytesAtLeast: nextBytes,
            maximumBytes,
          },
        );
        return;
      }
      state.bytes = nextBytes;
      state.chunks.push(bytes);
    };

    child.stdout.on("data", (chunk) =>
      collect("stdout", stdout, RUNTIME_PROBE_STDOUT_LIMIT_BYTES, chunk),
    );
    child.stderr.on("data", (chunk) =>
      collect("stderr", stderr, RUNTIME_PROBE_STDERR_LIMIT_BYTES, chunk),
    );
    child.stdout.once("error", (error) =>
      stop("stdout-error", "The isolated built-root matrix stdout stream failed.", {
        stream: "stdout",
        streamCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown",
      }),
    );
    child.stderr.once("error", (error) =>
      stop("stderr-error", "The isolated built-root matrix stderr stream failed.", {
        stream: "stderr",
        streamCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown",
      }),
    );
    child.stdin.once("error", (error) => {
      stdinFailure = {
        stream: "stdin",
        streamCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown",
      };
      if (stdinFailure.streamCode !== "EPIPE") {
        stop("stdin-error", "The isolated built-root matrix stdin stream failed.", stdinFailure);
      }
    });
    child.once("error", (error) =>
      stop("spawn-error", "The isolated built-root matrix process failed before completion.", {
        spawnCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown",
      }),
    );

    const timeout = setTimeout(
      () =>
        stop("timeout", "The isolated built-root matrix process exceeded its time limit.", {
          timeoutMilliseconds: RUNTIME_PROBE_TIMEOUT_MILLISECONDS,
        }),
      RUNTIME_PROBE_TIMEOUT_MILLISECONDS,
    );

    child.once("close", (exitCode, signal) => {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      const stdoutBytes = Buffer.concat(stdout.chunks, stdout.bytes);
      const stderrBytes = Buffer.concat(stderr.chunks, stderr.bytes);
      if (terminalFailure !== undefined) {
        reject(
          runtimeProbeFailure(terminalFailure.message, {
            ...terminalFailure.details,
            childStdout: runtimeProbeTail(stdoutBytes),
            childStderr: runtimeProbeTail(stderrBytes),
            exitCode,
            signal,
            terminationReason: terminalFailure.terminationReason,
          }),
        );
        return;
      }
      resolve(
        Object.freeze({
          stderrBytes,
          exitCode,
          signal,
          stdinFailure: stdinFailure === undefined ? undefined : Object.freeze({ ...stdinFailure }),
          stdoutBytes,
        }),
      );
    });

    try {
      child.stdin.end(programBytes);
    } catch (error) {
      stop("stdin-throw", "The isolated built-root matrix program could not be written to stdin.", {
        stream: "stdin",
        streamCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown",
      });
    }
  });
}

async function executeProgrammaticRuntimeProbe(programBytes) {
  try {
    const { stderrBytes, exitCode, signal, stdinFailure, stdoutBytes } =
      await runNodeModuleFromStdin(programBytes);
    const childStderr = decodeUtf8(
      stderrBytes,
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "Isolated built-root matrix stderr",
    );
    const childStdout = decodeUtf8(
      stdoutBytes,
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "Isolated built-root matrix stdout",
    );
    if (exitCode !== 0 || signal !== null) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
        "The isolated built public Publisher focused matrix exited unsuccessfully.",
        {
          childStderr: childStderr.slice(-RUNTIME_PROBE_ERROR_TAIL_BYTES),
          childStdout: childStdout.slice(-RUNTIME_PROBE_ERROR_TAIL_BYTES),
          exitCode,
          signal,
          stdinFailure,
          terminationReason: signal === null ? "nonzero-exit" : "signal",
        },
      );
    }
    if (stdinFailure !== undefined) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
        "The isolated built-root matrix stdin stream failed before successful completion.",
        {
          ...stdinFailure,
          exitCode,
          signal,
          terminationReason: "stdin-error",
        },
      );
    }
    if (childStderr !== "") {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
        "The isolated built-root matrix wrote unexpected stderr.",
        {
          childStderr: childStderr.slice(-RUNTIME_PROBE_ERROR_TAIL_BYTES),
          terminationReason: "unexpected-stderr",
        },
      );
    }
    return parseJson(
      childStdout,
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "Isolated built-root focused matrix receipt",
    );
  } catch (error) {
    if (error instanceof PublisherInvalidSourceMatrixEvidenceError) throw error;
    const childStderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String(error.stderr).slice(-4_096)
        : "";
    const childStdout =
      typeof error === "object" && error !== null && "stdout" in error
        ? String(error.stdout).slice(-4_096)
        : "";
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_AUTHORITY_INVALID",
      "The isolated built public Publisher focused matrix failed.",
      {
        childStderr,
        childStdout,
        exitCode:
          typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
      },
    );
  }
}

async function buildFromOptions(options) {
  const frozenArtifact = await authenticatedFrozenArtifactProjection();
  const prerequisites = await prerequisiteClaims(options);
  const trackedPairs = await Promise.all(
    LIVE_AUDIT_PATHS.map(async (relativePath) => {
      const override = readOverrideMap(options.trackedFileBytes, relativePath, LIVE_AUDIT_PATH_SET);
      const bytes = override ?? (await readRegularBytes(relativePath));
      return Object.freeze({ relativePath, bytes, overridden: override !== undefined });
    }),
  );
  const bytesByPath = new Map(trackedPairs.map(({ relativePath, bytes }) => [relativePath, bytes]));
  const text = (relativePath, label) =>
    decodeUtf8(
      bytesByPath.get(relativePath),
      "PUBLISHER_INVALID_SOURCE_MATRIX_UTF8_INVALID",
      label,
      { relativePath },
    );
  const fixtureAuthority = Object.freeze(
    PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS.map((pin) => {
      const bytes = bytesByPath.get(pin.path);
      const actualSha256 = sha256(bytes);
      if (bytes.byteLength !== pin.bytes || actualSha256 !== pin.sha256) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_DRIFT",
          "A frozen public matrix fixture changed.",
          {
            path: pin.path,
            actualBytes: bytes.byteLength,
            actualSha256,
            expectedBytes: pin.bytes,
            expectedSha256: pin.sha256,
          },
        );
      }
      return Object.freeze({ ...pin, verifiedSha256: actualSha256 });
    }),
  );
  const traceText = text(TRACEABILITY, "Traceability authority");
  const traceability = traceClaims(traceText);
  const packageTestText = text(PACKAGE_TEST, "Focused Publisher invalid-source test");
  const packageTests = packageTestClaims(packageTestText, frozenArtifact.packageTestReceipt);
  const taskApplicability = taskApplicabilityClaims(traceText, packageTests.caseInventory);
  const runtimeProgramBytes = Buffer.from(
    programmaticRuntimeProbeSource(packageTestText, packageTests.caseInventory),
    "utf8",
  );
  const runtimeProbeTransport = frozenRuntimeProbeTransportClaim(
    runtimeProgramBytes,
    frozenArtifact.runtimeProbeProgramBytes,
  );
  const runtime = validateRuntimeReceipt(
    options.runtimeReceipt ?? (await executeProgrammaticRuntimeProbe(runtimeProgramBytes)),
    packageTests.caseInventory,
  );
  const trackedFiles = frozenArtifact.trackedFiles;
  const artifact = deepFreeze({
    schemaVersion: 1,
    profile: "desen.publisher.invalid-source-matrix-proof.v1",
    task: "M06-T11",
    result: "PASS",
    summary: `${packageTests.caseInventory.length} invalid publication cases stop at their exact earliest public stage with immutable error-first diagnostics and no Bundle or partial publication authority, while dynamic obligations and sanitized warnings remain valid only on complete public success.`,
    prerequisites,
    claims: {
      publicInvalidSourceMatrix: runtime.claim,
      runtimeProbeTransport,
      traceability,
      taskApplicability,
      packageTests,
      fixtureAuthority,
      successorAuthority: frozenArtifact.successorAuthority,
      scope: {
        publicBuiltPackageRootOnly: true,
        completeReviewedPublicBranchMatrix: true,
        finiteCapabilityDiagnosticLimitsClosed: true,
        finiteCapabilityWarningLimitsClosed: true,
        finiteSourcePreservationLimitsClosed: true,
        naturallyReachableDefaultFiniteLimitBranchesClosed: true,
        publicTraversalAndIdentityBranchesClosed: true,
        invalidPublicationEmitsNoBundle: true,
        stagePrecedenceExact: true,
        warningSuppressionExact: true,
        publicFiniteSourceLimitsPinned: true,
      },
    },
    trackedFiles,
    tests: frozenArtifact.tests,
    nonclaims: [
      "The finite matrix closes the reviewed naturally reachable public branches with representative malformed values; it does not enumerate every conceivable invalid JSON or Source value.",
      "M06-T11 does not manufacture negative cases for source-digest, authoring-removal, catalog-pinning, or bundle-revision; those deterministic stages have no natural invalid public input after their authenticated predecessors succeed.",
      "Dynamic runtime obligations are a valid publication success and are not misreported as a binding failure.",
      "M06-T11 pins the current updated package, single-pass quality-gate, and M06-T08 through M06-T10 successor-compatibility surfaces; it does not rewrite historical M06-T08 through M06-T10 artifact receipts or create a reverse dependency on this artifact.",
      "The matrix proves atomic no-Bundle publication rejection, not signing, storage, activation, deployment, runtime execution, host, adapter, editor, network, or control-plane behavior.",
    ],
    reproduction: [
      "pnpm --filter @desen/publisher... build",
      "pnpm --filter @desen/publisher test:invalid-source-matrix",
      "node scripts/generate-publisher-invalid-source-matrix-proof.mjs",
      "node scripts/verify-publisher-invalid-source-matrix.mjs",
      "node --test tests/publisher-invalid-source-matrix.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeReceipt: runtime.raw,
  });
}

export async function buildPublisherInvalidSourceMatrixEvidence(rawOptions = undefined) {
  return buildFromOptions(exactOptions(rawOptions, BUILD_OPTION_KEYS));
}

export async function verifyPublisherInvalidSourceMatrixEvidence(rawOptions = undefined) {
  const options = exactOptions(rawOptions, VERIFY_OPTION_KEYS);
  if (options.artifactBytes !== undefined && options.artifactPath !== undefined) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "Verification accepts artifact bytes or an artifact path, never both.",
    );
  }
  if (options.proofDocument !== undefined && options.proofDocumentPath !== undefined) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "Verification accepts proof text or a proof-document path, never both.",
    );
  }
  const built = await buildFromOptions(options);
  const artifactPath =
    options.artifactPath ?? DEFAULT_PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "The invalid-source artifact path must be text.",
    );
  }
  const artifactInput =
    options.artifactBytes ??
    (await readRegularAbsoluteBytes(
      path.resolve(artifactPath),
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "Tracked invalid-source artifact",
      { artifactPath: path.resolve(artifactPath) },
    ));
  const artifactBytes = captureInertBytes(
    artifactInput,
    options.artifactBytes === undefined
      ? "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT"
      : "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
    "Invalid-source artifact bytes",
  );
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_DRIFT",
      "Tracked M06-T11 evidence differs from a fresh public-runtime build.",
      { expectedSha256: built.artifactSha256, actualSha256: sha256(artifactBytes) },
    );
  }
  const proofDocumentPath = options.proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT);
  if (typeof proofDocumentPath !== "string") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "The invalid-source proof-document path must be text.",
    );
  }
  const proofDocument =
    options.proofDocument ??
    decodeUtf8(
      await readRegularAbsoluteBytes(
        path.resolve(proofDocumentPath),
        "PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT",
        "Invalid-source proof document",
        { proofDocumentPath: path.resolve(proofDocumentPath) },
      ),
      "PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT",
      "Invalid-source proof document",
    );
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "The proof-document override must be text.",
    );
  }
  const pathCount = proofDocument.split(`\`${ARTIFACT}\``).length - 1;
  const hashCount = proofDocument.split(`\`sha256:${built.artifactSha256}\``).length - 1;
  if (pathCount !== 1 || hashCount !== 1 || /\bPENDING\b/u.test(proofDocument)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_PROOF_DOCUMENT_DRIFT",
      "The T11 proof document must contain one exact artifact path and final SHA-256 pin.",
      { pathCount, hashCount },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    invalidCases: built.artifact.tests.invalidMatrixCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    taskApplicabilityRows: built.artifact.claims.taskApplicability.records.length,
    taskLocalFindingRows:
      built.artifact.claims.taskApplicability.taskLocalFindingAuthority.records.length,
    traceRows: built.artifact.claims.traceability.length,
  });
}

export async function writePublisherInvalidSourceMatrixEvidence(rawOptions = undefined) {
  const options = exactOptions(rawOptions, WRITE_OPTION_KEYS);
  const artifactPath =
    options.artifactPath ?? DEFAULT_PUBLISHER_INVALID_SOURCE_MATRIX_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "The invalid-source artifact destination must be text.",
    );
  }
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_OPTIONS_INVALID",
      "The atomic-writer test hook must be a function.",
    );
  }
  const built = await buildFromOptions(Object.freeze({}));
  const writeResult = await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  return Object.freeze({
    ...writeResult,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes,
  });
}
