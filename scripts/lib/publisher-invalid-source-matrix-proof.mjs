import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

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
const PUBLISHER_DISTRIBUTION_IMPLEMENTATION = "packages/publisher/dist/bundle-publication.js";
const PUBLISHER_DISTRIBUTION_SOURCE_JSON = "packages/publisher/dist/source-json.js";
const PACKAGE_TEST = "packages/publisher/test/invalid-source-matrix.test.ts";
const PACKAGE_TEST_PIN = Object.freeze({
  bytes: 91_924,
  sha256: "959b366b99d304e217b51e89ff377b2c4bb09c61e5202bf454a09575c75b0a56",
});
const GENERATOR = "scripts/generate-publisher-invalid-source-matrix-proof.mjs";
const VERIFIER = "scripts/verify-publisher-invalid-source-matrix.mjs";
const PROOF_LIBRARY = "scripts/lib/publisher-invalid-source-matrix-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/publisher-invalid-source-matrix.test.mjs";
const ROOT_PACKAGE = "package.json";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_TEST = "scripts/test/ci-quality-gate.test.mjs";
const CATALOG_RESOLUTION_PROOF_LIBRARY = "scripts/lib/publisher-catalog-resolution-proof.mjs";
const CATALOG_PINNING_PROOF_LIBRARY = "scripts/lib/publisher-catalog-pinning-proof.mjs";
const CATALOG_PINNING_ROOT_TEST = "tests/publisher-catalog-pinning.test.mjs";
const BUNDLE_PUBLICATION_PROOF_LIBRARY = "scripts/lib/publisher-bundle-publication-proof.mjs";
const BUNDLE_PUBLICATION_ROOT_TEST = "tests/publisher-bundle-publication.test.mjs";
const OFFICIAL_GOLDEN_PROOF_LIBRARY = "scripts/lib/publisher-official-golden-proof.mjs";
const OFFICIAL_GOLDEN_ROOT_TEST = "tests/publisher-official-golden.test.mjs";
const PUBLISH_RESULT_SOURCE = "packages/publisher/src/publish-result.ts";
const CATALOG_RESOLUTION_SOURCE = "packages/publisher/src/catalog-resolution.ts";
const PUBLISH_RESULT_DISTRIBUTION = "packages/publisher/dist/publish-result.js";
const PUBLISH_RESULT_DECLARATION = "packages/publisher/dist/publish-result.d.ts";
const CATALOG_RESOLUTION_DISTRIBUTION = "packages/publisher/dist/catalog-resolution.js";
const CATALOG_RESOLUTION_DECLARATION = "packages/publisher/dist/catalog-resolution.d.ts";
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
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_STRING_INDEX_OF = String.prototype.indexOf;
const execFileAsync = promisify(execFile);
const RUNTIME_PROBE_NODE_ARGUMENTS = Object.freeze(["--no-warnings", "--input-type=module", "-"]);
const RUNTIME_PROBE_PROGRAM_LIMIT_BYTES = 2 * 1024 * 1024;
const RUNTIME_PROBE_STDOUT_LIMIT_BYTES = 8 * 1024 * 1024;
const RUNTIME_PROBE_STDERR_LIMIT_BYTES = 256 * 1024;
const RUNTIME_PROBE_TIMEOUT_MILLISECONDS = 180_000;
const RUNTIME_PROBE_TEST_TIMEOUT_MILLISECONDS = 20_000;
const RUNTIME_PROBE_ERROR_TAIL_BYTES = 4_096;
const DETACHED_CI_ENTRYPOINT_LOG_LIMIT_BYTES = 512 * 1024;
const DETACHED_CI_ENTRYPOINT_OUTPUT_LIMIT_BYTES = 2 * 1024 * 1024;
const DETACHED_CI_ENTRYPOINT_TIMEOUT_MILLISECONDS = 30_000;

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

export const PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES = Object.freeze(
  [
    [
      ROOT_PACKAGE,
      "workspace T11 registration",
      55_243,
      "57a70fff3ef1fd2f8a3665bb0f360e009225139f4f37c0ca1e5ff240acdc84f9",
    ],
    [
      PUBLISHER_PACKAGE,
      "Publisher focused-test registration",
      1_606,
      "f348c2e1a3ccfa4ce0a96575b3ee58c06b8ac35fd5fb6546a2c41b8510afedac",
    ],
    [
      CI_SOURCE,
      "single-pass quality-gate T11 tuple",
      45_961,
      "bd26364d95e79b7aa7278cabfdd97ff95cc6debbf0253a4d27a4a6fb6dbaea16",
    ],
    [
      CI_TEST,
      "single-pass quality-gate T11 receipt",
      24_068,
      "2be9f2207f966800a481064dab490cbe3f548c23853b34b2916be7d9d5512693",
    ],
    [
      CATALOG_RESOLUTION_PROOF_LIBRARY,
      "M06-T02 immutable-receipt compatibility reader",
      33_506,
      "29ee08e6924fb619a4f6828fe5b4ab19f656a994251cadb0bb5a7afd1e631495",
    ],
    [
      CATALOG_PINNING_PROOF_LIBRARY,
      "M06-T08 forward-compatible T11 reader",
      93_922,
      "9ea32c41d466aa14c7daa320a4775e9e34ae8ed4fecf27099f3e8317a9add94d",
    ],
    [
      CATALOG_PINNING_ROOT_TEST,
      "M06-T08 T11 successor mutations",
      30_614,
      "d245aa97bfe6d8879f4872b81f1e7b31cb30b9d84366ae71b7c10c615bc324dc",
    ],
    [
      BUNDLE_PUBLICATION_PROOF_LIBRARY,
      "M06-T09 forward-compatible T11 reader",
      89_602,
      "339cade1d676626653078fef299c99040c8d6757310f7e07cbbda09c63a013f6",
    ],
    [
      BUNDLE_PUBLICATION_ROOT_TEST,
      "M06-T09 T11 successor mutations",
      46_946,
      "52a19852972d31429ad7631de4e8338249eb9d6b894ccaa7b34dc68deb6b0b80",
    ],
    [
      OFFICIAL_GOLDEN_PROOF_LIBRARY,
      "M06-T10 forward-compatible T11 reader",
      56_040,
      "569f25138a3f8e9e36ca8a6dee348f3bdb486e999c83b0bc26054117e0f15207",
    ],
    [
      OFFICIAL_GOLDEN_ROOT_TEST,
      "M06-T10 T11 successor mutations",
      37_056,
      "f2c6c28956b21459caf3b6324100e4fd551e3b514b52f34ccbfa3d55445df9d0",
    ],
    [
      PUBLISH_RESULT_SOURCE,
      "complete Publisher diagnostic registry source",
      13_725,
      "0068cb1106eb4614fab640aef773d658e820148e5f2138f40aa616413e87fe9a",
    ],
    [
      CATALOG_RESOLUTION_SOURCE,
      "public Catalog diagnostic documentation source",
      37_846,
      "9faba3cee4dc34ac7787d52325a1675e547c72bbe74ee866319f49240a589c03",
    ],
    [
      PUBLISH_RESULT_DISTRIBUTION,
      "built Publisher diagnostic registry runtime",
      5_740,
      "c0bccb5a472f8fe1d480224d44af23d0156864f4dedc966e4209329bfd1029e6",
    ],
    [
      PUBLISH_RESULT_DECLARATION,
      "built Publisher diagnostic registry declaration",
      12_393,
      "1e273576488ee6d94cb8b02c264d4aec3c37c18e53e414a3057959221350d728",
    ],
    [
      CATALOG_RESOLUTION_DISTRIBUTION,
      "built Catalog resolution runtime",
      32_333,
      "b33ea4c7d3b7fef3dbf5dd4795a5f807644e4f16bf8112f78c1b6429b956d142",
    ],
    [
      CATALOG_RESOLUTION_DECLARATION,
      "built Catalog resolution declaration",
      5_773,
      "0774c6bf95d7e233727b57e3f3300e13581d02f33149e40f8bf27dfca6cc3b71",
    ],
  ].map(([pathName, role, bytes, sha256Value]) =>
    Object.freeze({ path: pathName, role, bytes, sha256: sha256Value }),
  ),
);

// M06-T11's artifact remains an immutable task-time receipt. Live compatibility authenticates
// the frozen CI prefix through M07-T01 semantically, so later proof tasks may append a suffix
// without rewriting any M06 evidence.
const CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE = Object.freeze({
  prefixSha256: "28dce22a08998f1a4bb199094ba081afccf074ab21aafecd10182d1c73d97d0e",
  proofEntries: 61,
  t11Index: 59,
  m07T01Index: 60,
});

const REQUIRED_M07_T01_SUCCESSOR_ROOT_TEST_NAMES = Object.freeze([
  "[successor] rejects removal of the exact M07-T01 CI successor",
  "[successor] rejects reordering the exact T11 to M07-T01 CI edge",
  "[successor] rejects drift in the exact M07-T01 CI tuple",
  "[successor] rejects exact M07-T01 root registration drift",
  "[successor] rejects removal of the aggregate M07-T01 successor",
  "[successor] rejects a non-immediate aggregate T11 to M07-T01 edge",
  "[successor] rejects a detached default gate with an empty execution plan",
  "[successor] rejects verifier-command drift despite a caller receipt",
]);
const HISTORICAL_ROOT_MUTATION_CASES = 67;

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

const TRACKED = Object.freeze([
  ...PUBLISHER_INVALID_SOURCE_MATRIX_FIXTURE_PINS.map(({ path: pathName }) => pathName),
  TRACEABILITY,
  PUBLISHER_DISTRIBUTION_INDEX,
  PUBLISHER_DISTRIBUTION_IMPLEMENTATION,
  PUBLISHER_DISTRIBUTION_SOURCE_JSON,
  PACKAGE_TEST,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ...PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES.map(({ path: pathName }) => pathName),
]);
const TRACKED_SET = new Set(TRACKED);
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 103_404,
    sha256: "95b3ecb5e2f9ec98bd689e3d5fa1be4e5e6fc75627fcfd4a67301f5ffcfbda46",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 44_979,
    sha256: "84c95f15747d461225918fca3ff590babbb8d1bc30288be4044d96929e0ef247",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 55_243,
    sha256: "57a70fff3ef1fd2f8a3665bb0f360e009225139f4f37c0ca1e5ff240acdc84f9",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 45_961,
    sha256: "bd26364d95e79b7aa7278cabfdd97ff95cc6debbf0253a4d27a4a6fb6dbaea16",
  }),
  [CI_TEST]: Object.freeze({
    bytes: 24_068,
    sha256: "2be9f2207f966800a481064dab490cbe3f548c23853b34b2916be7d9d5512693",
  }),
  [CATALOG_PINNING_PROOF_LIBRARY]: Object.freeze({
    bytes: 93_922,
    sha256: "9ea32c41d466aa14c7daa320a4775e9e34ae8ed4fecf27099f3e8317a9add94d",
  }),
  [CATALOG_PINNING_ROOT_TEST]: Object.freeze({
    bytes: 30_614,
    sha256: "d245aa97bfe6d8879f4872b81f1e7b31cb30b9d84366ae71b7c10c615bc324dc",
  }),
  [BUNDLE_PUBLICATION_PROOF_LIBRARY]: Object.freeze({
    bytes: 89_602,
    sha256: "339cade1d676626653078fef299c99040c8d6757310f7e07cbbda09c63a013f6",
  }),
  [BUNDLE_PUBLICATION_ROOT_TEST]: Object.freeze({
    bytes: 46_946,
    sha256: "52a19852972d31429ad7631de4e8338249eb9d6b894ccaa7b34dc68deb6b0b80",
  }),
  [OFFICIAL_GOLDEN_PROOF_LIBRARY]: Object.freeze({
    bytes: 56_040,
    sha256: "569f25138a3f8e9e36ca8a6dee348f3bdb486e999c83b0bc26054117e0f15207",
  }),
  [OFFICIAL_GOLDEN_ROOT_TEST]: Object.freeze({
    bytes: 37_056,
    sha256: "f2c6c28956b21459caf3b6324100e4fd551e3b514b52f34ccbfa3d55445df9d0",
  }),
});
const APPROVED_CURRENT_T09_SUCCESSOR_PATHS = Object.freeze([
  BUNDLE_PUBLICATION_PROOF_LIBRARY,
  BUNDLE_PUBLICATION_ROOT_TEST,
]);
const APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY = Object.freeze({
  [BUNDLE_PUBLICATION_PROOF_LIBRARY]: Object.freeze([
    Object.freeze({
      task: "M06-T09",
      bytes: 89_602,
      sha256: "339cade1d676626653078fef299c99040c8d6757310f7e07cbbda09c63a013f6",
    }),
    Object.freeze({
      task: "M07-T03",
      bytes: 136_184,
      sha256: "6cd1b727f102c46ef546a00d4c5eb85a94a8d8727831f6ec577cc8576a5a5bd1",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 137_548,
      sha256: "d154e49af93f1f6193c429709f81e5e8e7601e999c13f3a023a510e302fc2b19",
    }),
  ]),
  [BUNDLE_PUBLICATION_ROOT_TEST]: Object.freeze([
    Object.freeze({
      task: "M06-T09",
      bytes: 46_946,
      sha256: "52a19852972d31429ad7631de4e8338249eb9d6b894ccaa7b34dc68deb6b0b80",
    }),
    Object.freeze({
      task: "M07-T03",
      bytes: 62_818,
      sha256: "0469709b05c9ad61fd0dc64fb76c8758dcf21d540592a0aa6c201877286df784",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 63_899,
      sha256: "c3050c09f4d74177de07dabc0bd4339cf1ac055a40074676f70029c5e09d114f",
    }),
  ]),
});
const APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS = Object.freeze({
  [BUNDLE_PUBLICATION_PROOF_LIBRARY]:
    APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY[BUNDLE_PUBLICATION_PROOF_LIBRARY][2],
  [BUNDLE_PUBLICATION_ROOT_TEST]:
    APPROVED_T09_SUCCESSOR_RECEIPT_HISTORY[BUNDLE_PUBLICATION_ROOT_TEST][2],
});
const APPROVED_CURRENT_T10_SUCCESSOR_PATHS = Object.freeze([
  OFFICIAL_GOLDEN_PROOF_LIBRARY,
  OFFICIAL_GOLDEN_ROOT_TEST,
]);
const APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS = Object.freeze({
  [OFFICIAL_GOLDEN_PROOF_LIBRARY]: Object.freeze({
    bytes: 58_144,
    sha256: "ec9d5f0901a89c6026bf209dea2de82315c753d57e3046aea3a35f7180e1d245",
  }),
  [OFFICIAL_GOLDEN_ROOT_TEST]: Object.freeze({
    bytes: 37_617,
    sha256: "760e7d282423b81dc5c2658e80901475c7ce0e7df41aa7237a4009e775090ea9",
  }),
});
const REQUIRED_CURRENT_T09_PROOF_MARKERS = Object.freeze([
  "EXECUTION_PREFLIGHT_COMPATIBILITY_READER",
  "APPROVED_CURRENT_COMPATIBILITY_RECEIPTS",
  "APPROVED_CURRENT_COMPATIBILITY_PATHS",
  "assertApprovedCurrentCompatibilityBytes",
  "authenticateCurrentCompatibilityReaders",
  "APPROVED_REQUIRED_CI_WORKFLOW_RECEIPT",
  "authenticateRequiredCiWorkflow",
  "04429211188d351ee720c1e64802d48e34e425348b397c4bb835ba5c1fe4ccf5",
  "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT",
  "live-worktree",
  "tracked-byte-override",
  "tracked-candidate",
  "bytes: 62_112",
  "e49e83e2edc9836bf42b98d05545391d23763c886bb90beae96826c6171cd4db",
  "bytes: 70_038",
  "b203eb295bc4056f185416b8616c541f9d2cdebbfe74ed4ccb84e328d4da9c02",
  "EXECUTION_PREFLIGHT_COMPATIBILITY_ROOT_TEST",
  "APPROVED_COMPATIBILITY_RECEIPT_HISTORY",
  "bytes: 70_789",
  "6c0d2fc7169a0ee7b3f13d65b6e97db17d14e67f1f4b480dc1d083e7ef37a9ee",
  "bytes: 17_767",
  "ad3cfb227f61ffcbb9ece035b4a04d2d1f5b7b6c54c19f72cb61431e5e82e4af",
]);
const REQUIRED_CURRENT_T09_TEST_MARKERS = Object.freeze([
  'test("[compatibility] detects tamper in each externally anchored T02 through T08 reader"',
  'test("[compatibility] admits only the exact current execution-preflight root reader"',
  'test("[ci] admits only the exact required-workflow successor into frozen T09 evidence"',
  "// unreviewed compatibility successor",
  "const originalObjectFreeze = Object.freeze;",
  "const originalObjectEntries = Object.entries;",
  "const originalArrayFilter = Array.prototype.filter;",
  "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT",
]);
const PREREQUISITE_SET = new Set(
  PUBLISHER_INVALID_SOURCE_MATRIX_PREREQUISITE_PINS.map(
    ({ path: prerequisitePath }) => prerequisitePath,
  ),
);
const BUILD_OPTION_KEYS = new Set([
  "ciReceipt",
  "prerequisiteBytes",
  "runtimeReceipt",
  "trackedFileBytes",
]);
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

function safeStringIncludes(value, search) {
  return SAFE_REFLECT_APPLY(SAFE_STRING_INDEX_OF, value, [search]) >= 0;
}

function currentT09SuccessorReceipt(relativePath) {
  if (relativePath === BUNDLE_PUBLICATION_PROOF_LIBRARY) {
    return APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS[BUNDLE_PUBLICATION_PROOF_LIBRARY];
  }
  if (relativePath === BUNDLE_PUBLICATION_ROOT_TEST) {
    return APPROVED_CURRENT_T09_SUCCESSOR_RECEIPTS[BUNDLE_PUBLICATION_ROOT_TEST];
  }
  return undefined;
}

function exactByteLength(bytes) {
  if (TYPED_ARRAY_LENGTH_GETTER === undefined) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The runtime cannot establish current T09 byte authority.",
    );
  }
  try {
    return SAFE_REFLECT_APPLY(TYPED_ARRAY_LENGTH_GETTER, bytes, []);
  } catch {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "A current T09 successor is not an exact byte view.",
    );
  }
}

function assertCurrentT09SuccessorBytes(bytes, relativePath, authority) {
  const approved = currentT09SuccessorReceipt(relativePath);
  const actualBytes = exactByteLength(bytes);
  const actualSha256 = sha256(bytes);
  if (
    approved === undefined ||
    actualBytes !== approved.bytes ||
    actualSha256 !== approved.sha256
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "A current T09 successor differs from its exact approved receipt.",
      {
        relativePath,
        authority,
        expectedBytes: approved?.bytes,
        expectedSha256: approved?.sha256,
        actualBytes,
        actualSha256,
      },
    );
  }
}

function exactCurrentT09BytesEqual(left, right) {
  const leftLength = exactByteLength(left);
  const rightLength = exactByteLength(right);
  if (leftLength !== rightLength) return false;
  let index = 0;
  while (index < leftLength) {
    if (left[index] !== right[index]) return false;
    index += 1;
  }
  return true;
}

async function authenticateLiveCurrentT09Successors() {
  const authenticated = [];
  let pathIndex = 0;
  while (pathIndex < APPROVED_CURRENT_T09_SUCCESSOR_PATHS.length) {
    const relativePath = APPROVED_CURRENT_T09_SUCCESSOR_PATHS[pathIndex];
    const bytes = await readRegularBytes(
      relativePath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    );
    assertCurrentT09SuccessorBytes(bytes, relativePath, "live-worktree");
    authenticated[pathIndex] = SAFE_OBJECT_FREEZE({ relativePath, bytes });
    pathIndex += 1;
  }
  return SAFE_OBJECT_FREEZE(authenticated);
}

function currentT10SuccessorReceipt(relativePath) {
  if (relativePath === OFFICIAL_GOLDEN_PROOF_LIBRARY) {
    return APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS[OFFICIAL_GOLDEN_PROOF_LIBRARY];
  }
  if (relativePath === OFFICIAL_GOLDEN_ROOT_TEST) {
    return APPROVED_CURRENT_T10_SUCCESSOR_RECEIPTS[OFFICIAL_GOLDEN_ROOT_TEST];
  }
  return undefined;
}

function assertCurrentT10SuccessorBytes(bytes, relativePath, authority) {
  const approved = currentT10SuccessorReceipt(relativePath);
  const actualBytes = exactByteLength(bytes);
  const actualSha256 = sha256(bytes);
  if (
    approved === undefined ||
    actualBytes !== approved.bytes ||
    actualSha256 !== approved.sha256
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "A current T10 successor differs from its exact approved receipt.",
      {
        relativePath,
        authority,
        expectedBytes: approved?.bytes,
        expectedSha256: approved?.sha256,
        actualBytes,
        actualSha256,
      },
    );
  }
}

async function authenticateLiveCurrentT10Successors() {
  const authenticated = [];
  let pathIndex = 0;
  while (pathIndex < APPROVED_CURRENT_T10_SUCCESSOR_PATHS.length) {
    const relativePath = APPROVED_CURRENT_T10_SUCCESSOR_PATHS[pathIndex];
    const bytes = await readRegularBytes(
      relativePath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    );
    assertCurrentT10SuccessorBytes(bytes, relativePath, "live-worktree");
    authenticated[pathIndex] = SAFE_OBJECT_FREEZE({ relativePath, bytes });
    pathIndex += 1;
  }
  return SAFE_OBJECT_FREEZE(authenticated);
}

function authenticateCurrentT10TrackedInputs(liveInputs, trackedPairs, options) {
  let pathIndex = 0;
  while (pathIndex < APPROVED_CURRENT_T10_SUCCESSOR_PATHS.length) {
    const relativePath = APPROVED_CURRENT_T10_SUCCESSOR_PATHS[pathIndex];
    const liveInput = liveInputs[pathIndex];
    if (liveInput?.relativePath !== relativePath) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The fixed current T10 live authority order changed.",
        { relativePath },
      );
    }
    let matched;
    let matches = 0;
    let trackedIndex = 0;
    while (trackedIndex < trackedPairs.length) {
      const tracked = trackedPairs[trackedIndex];
      if (tracked.relativePath === relativePath) {
        matched = tracked;
        matches += 1;
      }
      trackedIndex += 1;
    }
    if (matched === undefined || matches !== 1) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "A current T10 successor tracked candidate is missing or ambiguous.",
        { relativePath, matches },
      );
    }
    assertCurrentT10SuccessorBytes(matched.bytes, relativePath, "tracked-candidate");
    if (!exactCurrentT09BytesEqual(liveInput.bytes, matched.bytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "A current T10 tracked candidate differs from its authenticated live authority.",
        { relativePath },
      );
    }
    const override = readOverrideMap(options.trackedFileBytes, relativePath, TRACKED_SET);
    if (override !== undefined) {
      assertCurrentT10SuccessorBytes(override, relativePath, "tracked-byte-override");
      if (!exactCurrentT09BytesEqual(liveInput.bytes, override)) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
          "A current T10 caller override differs from its authenticated live authority.",
          { relativePath },
        );
      }
    }
    pathIndex += 1;
  }
}

function authenticateCurrentT09TrackedInputs(liveInputs, trackedPairs, options) {
  let pathIndex = 0;
  while (pathIndex < APPROVED_CURRENT_T09_SUCCESSOR_PATHS.length) {
    const relativePath = APPROVED_CURRENT_T09_SUCCESSOR_PATHS[pathIndex];
    const liveInput = liveInputs[pathIndex];
    if (liveInput?.relativePath !== relativePath) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The fixed current T09 live authority order changed.",
        { relativePath },
      );
    }
    let matched;
    let matches = 0;
    let trackedIndex = 0;
    while (trackedIndex < trackedPairs.length) {
      const tracked = trackedPairs[trackedIndex];
      if (tracked.relativePath === relativePath) {
        matched = tracked;
        matches += 1;
      }
      trackedIndex += 1;
    }
    if (matched === undefined || matches !== 1) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "A current T09 successor tracked candidate is missing or ambiguous.",
        { relativePath, matches },
      );
    }
    assertCurrentT09SuccessorBytes(matched.bytes, relativePath, "tracked-candidate");
    if (!exactCurrentT09BytesEqual(liveInput.bytes, matched.bytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "A current T09 tracked candidate differs from its authenticated live authority.",
        { relativePath },
      );
    }
    const override = readOverrideMap(options.trackedFileBytes, relativePath, TRACKED_SET);
    if (override !== undefined) {
      assertCurrentT09SuccessorBytes(override, relativePath, "tracked-byte-override");
      if (!exactCurrentT09BytesEqual(liveInput.bytes, override)) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
          "A current T09 caller override differs from its authenticated live authority.",
          { relativePath },
        );
      }
    }
    pathIndex += 1;
  }
}

function assertCurrentT09CompatibilityMarkers(proofText, rootTestText) {
  const authorities = SAFE_OBJECT_FREEZE([
    SAFE_OBJECT_FREEZE({
      relativePath: BUNDLE_PUBLICATION_PROOF_LIBRARY,
      text: proofText,
      markers: REQUIRED_CURRENT_T09_PROOF_MARKERS,
    }),
    SAFE_OBJECT_FREEZE({
      relativePath: BUNDLE_PUBLICATION_ROOT_TEST,
      text: rootTestText,
      markers: REQUIRED_CURRENT_T09_TEST_MARKERS,
    }),
  ]);
  let authorityIndex = 0;
  while (authorityIndex < authorities.length) {
    const authority = authorities[authorityIndex];
    let markerIndex = 0;
    while (markerIndex < authority.markers.length) {
      if (!safeStringIncludes(authority.text, authority.markers[markerIndex])) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
          "A current T09 successor lost an exact M06-T05 compatibility marker.",
          {
            relativePath: authority.relativePath,
            marker: authority.markers[markerIndex],
          },
        );
      }
      markerIndex += 1;
    }
    authorityIndex += 1;
  }
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

function packageTestClaims(text, bytes) {
  const packageTestSha256 = sha256(bytes);
  if (
    bytes.byteLength !== PACKAGE_TEST_PIN.bytes ||
    packageTestSha256 !== PACKAGE_TEST_PIN.sha256
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The exact reviewed focused package-test bytes changed.",
      {
        actualBytes: bytes.byteLength,
        actualSha256: packageTestSha256,
        expectedBytes: PACKAGE_TEST_PIN.bytes,
        expectedSha256: PACKAGE_TEST_PIN.sha256,
      },
    );
  }
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
    bytes: PACKAGE_TEST_PIN.bytes,
    sha256: PACKAGE_TEST_PIN.sha256,
    assertionFamilies: Object.freeze(assertionFamilies),
    invalidCases: matrixCases.length,
    caseInventory: matrixCases,
    finiteLimitClosure: Object.freeze(finiteLimitClosure),
    publicBranchClosure: Object.freeze(publicBranchClosure),
    traceDistribution,
    stageDistribution,
  });
}

const CI_SUCCESSOR_AUTHORITY_BINDINGS = new Set([
  "PROOF_ENTRIES",
  "QUALITY_GATE_PLAN_SHA256",
  "createQualityGateSteps",
  "executeDefaultQualityGate",
  "executeQualityGate",
  "main",
  "validateQualityGatePlan",
]);

function collectAssignedCiIdentifiers(node, names = []) {
  if (ts.isIdentifier(node)) {
    names.push(node.text);
    return names;
  }
  if (ts.isParenthesizedExpression(node)) {
    return collectAssignedCiIdentifiers(node.expression, names);
  }
  if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind)) {
    return collectAssignedCiIdentifiers(node.left, names);
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (ts.isOmittedExpression(element)) continue;
      collectAssignedCiIdentifiers(
        ts.isSpreadElement(element) ? element.expression : element,
        names,
      );
    }
    return names;
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        names.push(property.name.text);
      } else if (ts.isPropertyAssignment(property)) {
        collectAssignedCiIdentifiers(property.initializer, names);
      } else if (ts.isSpreadAssignment(property)) {
        collectAssignedCiIdentifiers(property.expression, names);
      }
    }
  }
  return names;
}

function assertNoCiSuccessorAuthorityRebinding(sourceFile) {
  const writes = [];
  let directEvalCalls = 0;

  function recordTarget(target, kind) {
    for (const name of collectAssignedCiIdentifiers(target)) {
      if (CI_SUCCESSOR_AUTHORITY_BINDINGS.has(name)) {
        writes.push(Object.freeze({ name, kind, position: target.getStart(sourceFile) }));
      }
    }
  }

  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind)) {
      recordTarget(node.left, ts.tokenToString(node.operatorToken.kind) ?? "assignment");
    } else if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    ) {
      recordTarget(node.operand, ts.tokenToString(node.operator) ?? "update");
    } else if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      !ts.isVariableDeclarationList(node.initializer)
    ) {
      recordTarget(node.initializer, ts.isForInStatement(node) ? "for-in" : "for-of");
    }

    if (ts.isCallExpression(node)) {
      let callee = node.expression;
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
      if (ts.isIdentifier(callee) && callee.text === "eval") directEvalCalls += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (writes.length > 0 || directEvalCalls > 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Single-pass CI must not reassign its validated default-plan authority or use direct eval.",
      { writes, directEvalCalls },
    );
  }
}

function assertDirectCiSuccessorPlanValidation(createStepsFunction) {
  const statements = createStepsFunction.body?.statements;
  const declaration = statements?.[0];
  const validation = statements?.[1];
  const returned = statements?.[2];
  const declarationEntry =
    declaration && ts.isVariableStatement(declaration)
      ? declaration.declarationList.declarations[0]
      : undefined;
  const validationCall =
    validation && ts.isExpressionStatement(validation) && ts.isCallExpression(validation.expression)
      ? validation.expression
      : undefined;
  const returnCall =
    returned && ts.isReturnStatement(returned) && ts.isCallExpression(returned.expression)
      ? returned.expression
      : undefined;

  if (
    statements?.length !== 3 ||
    declaration === undefined ||
    !ts.isVariableStatement(declaration) ||
    declaration.declarationList.declarations.length !== 1 ||
    declarationEntry === undefined ||
    !ts.isIdentifier(declarationEntry.name) ||
    declarationEntry.name.text !== "steps" ||
    !ts.isArrayLiteralExpression(declarationEntry.initializer) ||
    validationCall === undefined ||
    !ts.isIdentifier(validationCall.expression) ||
    validationCall.expression.text !== "validateQualityGatePlan" ||
    validationCall.arguments.length !== 1 ||
    !ts.isIdentifier(validationCall.arguments[0]) ||
    validationCall.arguments[0].text !== "steps" ||
    returnCall === undefined ||
    !ts.isPropertyAccessExpression(returnCall.expression) ||
    !ts.isIdentifier(returnCall.expression.expression) ||
    returnCall.expression.expression.text !== "Object" ||
    returnCall.expression.name.text !== "freeze" ||
    returnCall.arguments.length !== 1 ||
    !ts.isIdentifier(returnCall.arguments[0]) ||
    returnCall.arguments[0].text !== "steps"
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Single-pass CI must validate its exact constructed plan unconditionally before returning it.",
    );
  }
}

function assertCiSuccessorDefaultGateBinding(defaultGateFunction, mainFunction) {
  const parameter = defaultGateFunction.parameters[0];
  const statements = defaultGateFunction.body?.statements;
  const returned = statements?.[0];
  const call =
    returned && ts.isReturnStatement(returned) && ts.isCallExpression(returned.expression)
      ? returned.expression
      : undefined;
  const optionsObject = call?.arguments[0];
  const properties = ts.isObjectLiteralExpression(optionsObject) ? optionsObject.properties : [];
  const spread = properties[0];
  const steps = properties[1];
  const stepsInitializer = steps && ts.isPropertyAssignment(steps) ? steps.initializer : undefined;
  const isExported = defaultGateFunction.modifiers?.some(
    ({ kind }) => kind === ts.SyntaxKind.ExportKeyword,
  );

  if (
    !isExported ||
    defaultGateFunction.parameters.length !== 1 ||
    !ts.isIdentifier(parameter?.name) ||
    parameter.name.text !== "options" ||
    statements?.length !== 1 ||
    call === undefined ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== "executeQualityGate" ||
    call.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(optionsObject) ||
    properties.length !== 2 ||
    !ts.isSpreadAssignment(spread) ||
    !ts.isIdentifier(spread.expression) ||
    spread.expression.text !== "options" ||
    !ts.isIdentifier(steps?.name) ||
    steps.name.text !== "steps" ||
    !ts.isCallExpression(stepsInitializer) ||
    !ts.isIdentifier(stepsInitializer.expression) ||
    stepsInitializer.expression.text !== "createQualityGateSteps" ||
    stepsInitializer.arguments.length !== 0
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Default CI execution must place its own validated plan after all caller options.",
    );
  }

  const tryStatements = mainFunction.body?.statements.filter((statement) =>
    ts.isTryStatement(statement),
  );
  const directReceiptAssignments = (tryStatements ?? []).flatMap((tryStatement) =>
    tryStatement.tryBlock.statements.filter((statement) => {
      if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) {
        return false;
      }
      const assignment = statement.expression;
      const awaited = assignment.right;
      const defaultCall =
        ts.isAwaitExpression(awaited) && ts.isCallExpression(awaited.expression)
          ? awaited.expression
          : undefined;
      const callOptions = defaultCall?.arguments[0];
      const optionNames = ts.isObjectLiteralExpression(callOptions)
        ? callOptions.properties.map((property) => {
            if (ts.isSpreadAssignment(property)) return "...";
            if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
              return property.name.text;
            }
            return "";
          })
        : [];
      return (
        assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(assignment.left) &&
        assignment.left.text === "receipt" &&
        defaultCall !== undefined &&
        ts.isIdentifier(defaultCall.expression) &&
        defaultCall.expression.text === "executeDefaultQualityGate" &&
        defaultCall.arguments.length === 1 &&
        JSON.stringify(optionNames) === JSON.stringify(["runStep", "assertCanContinue"])
      );
    }),
  );
  let defaultReferences = 0;
  let forbiddenExecutionReferences = 0;
  let forbiddenPlanReferences = 0;
  let returnStatements = 0;
  function visitMain(node) {
    if (node !== mainFunction && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) returnStatements += 1;
    if (ts.isIdentifier(node)) {
      if (node.text === "executeDefaultQualityGate") defaultReferences += 1;
      if (node.text === "executeQualityGate") forbiddenExecutionReferences += 1;
      if (node.text === "createQualityGateSteps") forbiddenPlanReferences += 1;
    }
    ts.forEachChild(node, visitMain);
  }
  visitMain(mainFunction);
  if (
    directReceiptAssignments.length !== 1 ||
    defaultReferences !== 1 ||
    forbiddenExecutionReferences !== 0 ||
    forbiddenPlanReferences !== 0 ||
    returnStatements !== 0
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "CI main must reach one direct awaited validated default-plan execution.",
      {
        directReceiptAssignments: directReceiptAssignments.length,
        defaultReferences,
        forbiddenExecutionReferences,
        forbiddenPlanReferences,
        returnStatements,
      },
    );
  }
}

function ciSuccessorClaims(ciSourceText) {
  const sourceFile = ts.createSourceFile(
    CI_SOURCE,
    ciSourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The single-pass CI source no longer parses.",
    );
  }

  const proofDeclarations = [];
  const planDeclarations = [];
  const createStepsFunctions = [];
  const defaultGateFunctions = [];
  const mainFunctions = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "PROOF_ENTRIES") proofDeclarations.push(node);
      if (node.name.text === "QUALITY_GATE_PLAN_SHA256") planDeclarations.push(node);
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "createQualityGateSteps") {
      createStepsFunctions.push(node);
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "executeDefaultQualityGate") {
      defaultGateFunctions.push(node);
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "main") {
      mainFunctions.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assertNoCiSuccessorAuthorityRebinding(sourceFile);

  const proofInitializer =
    proofDeclarations.length === 1 ? proofDeclarations[0].initializer : undefined;
  const planInitializer =
    planDeclarations.length === 1 ? planDeclarations[0].initializer : undefined;
  const frozenInventory =
    proofInitializer !== undefined &&
    ts.isCallExpression(proofInitializer) &&
    ts.isPropertyAccessExpression(proofInitializer.expression) &&
    ts.isIdentifier(proofInitializer.expression.expression) &&
    proofInitializer.expression.expression.text === "Object" &&
    proofInitializer.expression.name.text === "freeze" &&
    proofInitializer.arguments.length === 1
      ? proofInitializer.arguments[0]
      : undefined;
  const mappedCall =
    frozenInventory !== undefined &&
    ts.isCallExpression(frozenInventory) &&
    ts.isPropertyAccessExpression(frozenInventory.expression) &&
    frozenInventory.expression.name.text === "map"
      ? frozenInventory
      : undefined;
  const mappedInventory = mappedCall === undefined ? undefined : mappedCall.expression.expression;
  const tupleProjection =
    mappedCall !== undefined && mappedCall.arguments.length === 1
      ? mappedCall.arguments[0]
      : undefined;
  const projectionParameter =
    tupleProjection !== undefined &&
    ts.isArrowFunction(tupleProjection) &&
    tupleProjection.parameters.length === 1
      ? tupleProjection.parameters[0]
      : undefined;
  const projectionBindings =
    projectionParameter !== undefined && ts.isArrayBindingPattern(projectionParameter.name)
      ? projectionParameter.name.elements.map((element) =>
          ts.isBindingElement(element) &&
          element.dotDotDotToken === undefined &&
          element.initializer === undefined &&
          ts.isIdentifier(element.name)
            ? element.name.text
            : undefined,
        )
      : undefined;
  const projectionBody =
    tupleProjection !== undefined && ts.isArrowFunction(tupleProjection)
      ? tupleProjection.body
      : undefined;
  const projectionObject =
    projectionBody !== undefined &&
    ts.isCallExpression(projectionBody) &&
    ts.isPropertyAccessExpression(projectionBody.expression) &&
    ts.isIdentifier(projectionBody.expression.expression) &&
    projectionBody.expression.expression.text === "Object" &&
    projectionBody.expression.name.text === "freeze" &&
    projectionBody.arguments.length === 1
      ? projectionBody.arguments[0]
      : undefined;
  const projectionProperties = ts.isObjectLiteralExpression(projectionObject)
    ? projectionObject.properties.map((property) =>
        ts.isShorthandPropertyAssignment(property) ? property.name.text : undefined,
      )
    : undefined;
  if (
    !ts.isArrayLiteralExpression(mappedInventory) ||
    JSON.stringify(projectionBindings) !== JSON.stringify(["id", "verifierFile", "rootTestFile"]) ||
    JSON.stringify(projectionProperties) !==
      JSON.stringify(["id", "verifierFile", "rootTestFile"]) ||
    !ts.isStringLiteral(planInitializer) ||
    !/^[0-9a-f]{64}$/u.test(planInitializer.text) ||
    createStepsFunctions.length !== 1 ||
    createStepsFunctions[0].body === undefined ||
    defaultGateFunctions.length !== 1 ||
    defaultGateFunctions[0].body === undefined ||
    mainFunctions.length !== 1 ||
    mainFunctions[0].body === undefined
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The single-pass CI inventory or reviewed plan authority changed shape.",
    );
  }
  assertDirectCiSuccessorPlanValidation(createStepsFunctions[0]);
  assertCiSuccessorDefaultGateBinding(defaultGateFunctions[0], mainFunctions[0]);

  const entries = mappedInventory.elements.map((element) => {
    if (
      !ts.isArrayLiteralExpression(element) ||
      element.elements.length !== 3 ||
      !element.elements.every((field) => ts.isStringLiteral(field))
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The single-pass CI contains a nonliteral proof tuple.",
      );
    }
    return Object.freeze({
      id: element.elements[0].text,
      verifierFile: element.elements[1].text,
      rootTestFile: element.elements[2].text,
    });
  });
  const t11Indexes = entries.flatMap(({ id }, index) =>
    id === "publisher-invalid-source-matrix" ? [index] : [],
  );
  const m07T01Indexes = entries.flatMap(({ id }, index) =>
    id === "control-plane-bundle-store" ? [index] : [],
  );
  const t11 = t11Indexes.length === 1 ? entries[t11Indexes[0]] : undefined;
  const m07T01 = m07T01Indexes.length === 1 ? entries[m07T01Indexes[0]] : undefined;
  const prefixSha256 = sha256(
    Buffer.from(
      JSON.stringify(
        entries.slice(0, CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.proofEntries),
      ),
      "utf8",
    ),
  );
  if (
    entries.length < CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.proofEntries ||
    t11Indexes.length !== 1 ||
    m07T01Indexes.length !== 1 ||
    t11Indexes[0] !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.t11Index ||
    m07T01Indexes[0] !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.m07T01Index ||
    m07T01Indexes[0] !== t11Indexes[0] + 1 ||
    t11?.verifierFile !== "scripts/verify-publisher-invalid-source-matrix.mjs" ||
    t11?.rootTestFile !== "tests/publisher-invalid-source-matrix.test.mjs" ||
    m07T01?.verifierFile !== "scripts/verify-control-plane-bundle-store.mjs" ||
    m07T01?.rootTestFile !== "tests/control-plane-bundle-store.test.mjs" ||
    prefixSha256 !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.prefixSha256
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The exact append-only T11 to M07-T01 CI prefix changed.",
      { t11Indexes, m07T01Indexes, prefixSha256 },
    );
  }
  for (const field of ["id", "verifierFile", "rootTestFile"]) {
    const values = entries.map((entry) => entry[field]);
    if (new Set(values).size !== values.length) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The append-only CI suffix contains duplicate proof authority.",
        { field },
      );
    }
  }

  const createStepsText = createStepsFunctions[0].body.getText(sourceFile);
  if (
    (createStepsText.match(/\bPROOF_ENTRIES\b/gu) ?? []).length !== 2 ||
    (createStepsText.match(/\bvalidateQualityGatePlan\s*\(/gu) ?? []).length !== 1
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The single-pass CI no longer maps both proof phases through one plan validation.",
    );
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    planSha256: planInitializer.text,
    proofEntries: entries.length,
    stepCount: 8 + entries.length * 2,
  });
}

const CI_SUCCESSOR_RECEIPT_KEYS = new Set(["planSha256", "proofEntries", "stepCount"]);
const DETACHED_CI_SUCCESSOR_PROBE_PREFIX = "DESEN_T11_CANDIDATE_CI_PLAN:";
const DETACHED_CI_SUCCESSOR_PROBE_SOURCE = [
  "const candidate = await import(process.argv[2]);",
  "const steps = candidate.createQualityGateSteps();",
  "const validation = candidate.validateQualityGatePlan(steps);",
  "const payload = JSON.stringify({ entries: candidate.PROOF_ENTRIES, steps, validation });",
  `process.stdout.write(${JSON.stringify(DETACHED_CI_SUCCESSOR_PROBE_PREFIX)} + Buffer.from(payload, "utf8").toString("base64"));`,
].join("\n");

function validateCiSuccessorReceipt(receipt, expected) {
  if (
    !exactPlainRecord(receipt, CI_SUCCESSOR_RECEIPT_KEYS) ||
    ownData(receipt, "planSha256") !== expected.planSha256 ||
    ownData(receipt, "proofEntries") !== expected.proofEntries ||
    ownData(receipt, "stepCount") !== expected.stepCount
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The executable CI receipt does not match the authenticated append-only inventory.",
    );
  }
  return Object.freeze({
    planSha256: ownData(receipt, "planSha256"),
    proofEntries: ownData(receipt, "proofEntries"),
    stepCount: ownData(receipt, "stepCount"),
  });
}

function validateDetachedCiSuccessorPlan(candidate, expected) {
  const candidateKeys = new Set(["entries", "steps", "validation"]);
  const validationKeys = new Set(["planSha256", "stepCount"]);
  const stepKeys = new Set(["args", "command", "id", "label"]);
  if (
    !exactPlainRecord(candidate, candidateKeys) ||
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.steps) ||
    !exactPlainRecord(candidate.validation, validationKeys) ||
    JSON.stringify(candidate.entries) !== JSON.stringify(expected.entries)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI candidate returned a malformed or mismatched executable-plan receipt.",
    );
  }
  if (
    !candidate.steps.every(
      (step) =>
        exactPlainRecord(step, stepKeys) &&
        typeof step.id === "string" &&
        typeof step.label === "string" &&
        typeof step.command === "string" &&
        Array.isArray(step.args) &&
        step.args.every((argument) => typeof argument === "string"),
    )
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI candidate produced a malformed executable step.",
    );
  }

  const actualVerifierSteps = candidate.steps
    .filter(({ id }) => id.startsWith("verify-"))
    .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`);
  const expectedVerifierSteps = expected.entries.map(
    ({ id, verifierFile }) => `verify-${id}\0node\0${verifierFile}`,
  );
  const actualRootTestSteps = candidate.steps
    .filter(({ id }) => id.startsWith("test-"))
    .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`);
  const expectedRootTestSteps = expected.entries.map(
    ({ id, rootTestFile }) => `test-${id}\0node\0--test\0--test-concurrency=1\0${rootTestFile}`,
  );
  const normalizedPlan = candidate.steps.map(({ id, command, args }) => ({
    id,
    command,
    args,
  }));
  const independentlyCalculatedPlanSha256 = sha256(
    Buffer.from(JSON.stringify(normalizedPlan), "utf8"),
  );
  if (
    JSON.stringify(actualVerifierSteps) !== JSON.stringify(expectedVerifierSteps) ||
    JSON.stringify(actualRootTestSteps) !== JSON.stringify(expectedRootTestSteps) ||
    candidate.steps.length !== expected.stepCount ||
    ownData(candidate.validation, "stepCount") !== candidate.steps.length ||
    ownData(candidate.validation, "planSha256") !== independentlyCalculatedPlanSha256 ||
    independentlyCalculatedPlanSha256 !== expected.planSha256
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI candidate does not commit and execute the exact append-only proof plan.",
    );
  }

  return Object.freeze({
    planSha256: independentlyCalculatedPlanSha256,
    proofEntries: expected.entries.length,
    stepCount: candidate.steps.length,
  });
}

function detachedCiInventoryPath(relativePath, kind) {
  const pattern =
    kind === "verifier" ? /^scripts\/verify-[a-z0-9-]+\.mjs$/u : /^tests\/[a-z0-9-]+\.test\.mjs$/u;
  if (typeof relativePath !== "string" || !pattern.test(relativePath)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      `Detached CI ${kind} inventory contains an unsafe path.`,
      { relativePath },
    );
  }
  return relativePath;
}

async function writeAuthenticatedDetachedCiFile(filePath, bytes, label, mode = 0o600) {
  await writeFile(filePath, bytes, { flag: "wx", mode });
  const authenticated = await readRegularAbsoluteBytes(
    filePath,
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    label,
  );
  if (!byteEqual(Buffer.from(bytes), authenticated)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      `${label} bytes changed while the detached CI workspace was prepared.`,
    );
  }
}

async function createDetachedCiShadowWorkspace(
  generatedDirectory,
  ciSourceBytes,
  rootPackageBytes,
  expected,
) {
  const workspaceRoot = path.join(generatedDirectory, "workspace");
  await mkdir(workspaceRoot, { mode: 0o700 });
  for (const directory of ["apps", "packages", "scripts", "tests"]) {
    await mkdir(path.join(workspaceRoot, directory), { mode: 0o700 });
  }

  await writeAuthenticatedDetachedCiFile(
    path.join(workspaceRoot, ROOT_PACKAGE),
    rootPackageBytes,
    "Detached CI root package manifest",
  );
  await writeAuthenticatedDetachedCiFile(
    path.join(workspaceRoot, "pnpm-workspace.yaml"),
    await readRegularBytes("pnpm-workspace.yaml"),
    "Detached CI workspace manifest",
  );

  for (const workspaceDirectory of ["apps", "packages"]) {
    const actualDirectory = path.join(ROOT, workspaceDirectory);
    const entries = await readdir(actualDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(actualDirectory, entry.name, "package.json");
      let manifestStats;
      try {
        manifestStats = await lstat(manifestPath);
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
        fail(
          "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
          "Detached CI encountered a non-regular workspace package manifest.",
          { workspaceDirectory, packageDirectory: entry.name },
        );
      }
      const shadowPackageDirectory = path.join(workspaceRoot, workspaceDirectory, entry.name);
      await mkdir(shadowPackageDirectory, { mode: 0o700 });
      await writeAuthenticatedDetachedCiFile(
        path.join(shadowPackageDirectory, "package.json"),
        await readRegularAbsoluteBytes(
          manifestPath,
          "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
          "Detached CI workspace package manifest",
          { workspaceDirectory, packageDirectory: entry.name },
        ),
        "Detached CI shadow package manifest",
      );
    }
  }

  for (const entry of expected.entries) {
    const verifierFile = detachedCiInventoryPath(entry.verifierFile, "verifier");
    const rootTestFile = detachedCiInventoryPath(entry.rootTestFile, "root test");
    await writeAuthenticatedDetachedCiFile(
      path.join(workspaceRoot, verifierFile),
      Buffer.alloc(0),
      "Detached CI verifier inventory placeholder",
    );
    await writeAuthenticatedDetachedCiFile(
      path.join(workspaceRoot, rootTestFile),
      Buffer.alloc(0),
      "Detached CI root-test inventory placeholder",
    );
  }

  const candidatePath = path.join(workspaceRoot, CI_SOURCE);
  await writeAuthenticatedDetachedCiFile(
    candidatePath,
    ciSourceBytes,
    "Detached single-pass CI candidate",
  );
  const canonicalCandidatePath = await realpath(candidatePath);
  if (canonicalCandidatePath !== candidatePath) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached single-pass CI candidate must not resolve through a path alias.",
    );
  }
  return Object.freeze({ candidatePath, canonicalCandidatePath, workspaceRoot });
}

function createDetachedCiEntrypointWrapper(command, logPath, nodePath) {
  const gitArguments = ["ls-files", "--stage", "-z"];
  const gitRecord = `100644 ${"0".repeat(40)} 0\tpackage.json\0`;
  return [
    `#!${nodePath} --allow-fs-write=${logPath}`,
    '"use strict";',
    'const fs = require("node:fs");',
    `const logPath = ${JSON.stringify(logPath)};`,
    `const command = ${JSON.stringify(command)};`,
    "const args = process.argv.slice(2);",
    'const bytes = Buffer.from(`${JSON.stringify({ command, args })}\\n`, "utf8");',
    "const descriptor = fs.openSync(",
    "  logPath,",
    "  fs.constants.O_WRONLY | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW ?? 0),",
    ");",
    "try {",
    "  let offset = 0;",
    "  while (offset < bytes.byteLength) {",
    "    offset += fs.writeSync(descriptor, bytes, offset, bytes.byteLength - offset);",
    "  }",
    "} finally {",
    "  fs.closeSync(descriptor);",
    "}",
    ...(command === "git"
      ? [
          `if (JSON.stringify(args) !== ${JSON.stringify(JSON.stringify(gitArguments))}) {`,
          "  process.exit(64);",
          "}",
          `process.stdout.write(Buffer.from(${JSON.stringify(gitRecord)}, "utf8"));`,
        ]
      : []),
    "",
  ].join("\n");
}

function parseDetachedCiEntrypointReceipt(stdout, expectedSteps, expectedProofCount) {
  const receiptStart = stdout.lastIndexOf('\n{\n  "status":');
  if (receiptStart < 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint did not print its terminal receipt.",
    );
  }
  const receipt = parseJson(
    stdout.slice(receiptStart + 1),
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Detached CI CLI entrypoint receipt",
  );
  const expectedSectionIds = ["frozen-inventory", ...expectedSteps.map(({ id }) => id)];
  const sectionKeys = new Set(["duration", "id", "status"]);
  const actualSectionIds = Array.isArray(receipt.sections)
    ? receipt.sections.map((section) =>
        exactPlainRecord(section, sectionKeys) && section.status === "PASS"
          ? section.id
          : undefined,
      )
    : [];
  if (
    !exactPlainRecord(
      receipt,
      new Set(["duration", "proofs", "revision", "sections", "status", "trackedFiles"]),
    ) ||
    receipt.status !== "PASS" ||
    receipt.proofs !== expectedProofCount ||
    receipt.trackedFiles !== 1 ||
    JSON.stringify(actualSectionIds) !== JSON.stringify(expectedSectionIds)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint did not complete the exact validated default plan.",
      {
        status: receipt?.status,
        proofCount: receipt?.proofs,
        sectionIds: actualSectionIds,
      },
    );
  }
}

async function executeDetachedCiEntrypoint(
  shadow,
  generatedDirectory,
  authenticatedSourceBytes,
  expectedSteps,
  expectedProofCount,
) {
  if (process.platform === "win32") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint probe requires POSIX executable wrappers.",
    );
  }
  const inheritedPath = process.env.PATH;
  if (typeof inheritedPath !== "string" || inheritedPath.length === 0) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint probe requires the reviewed host executable path.",
    );
  }
  const nodePath = await realpath(process.execPath);
  const logPath = path.join(generatedDirectory, "commands.log");
  if (/\s/u.test(nodePath) || /\s/u.test(logPath)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint probe requires whitespace-free executable and log paths.",
      { logPath, nodePath },
    );
  }

  await writeAuthenticatedDetachedCiFile(logPath, Buffer.alloc(0), "Detached CI CLI command log");
  const wrapperBytesByPath = new Map();
  for (const command of ["git", "node", "pnpm"]) {
    const wrapperPath = path.join(generatedDirectory, command);
    const wrapperBytes = Buffer.from(
      createDetachedCiEntrypointWrapper(command, logPath, nodePath),
      "utf8",
    );
    await writeAuthenticatedDetachedCiFile(
      wrapperPath,
      wrapperBytes,
      "Detached CI CLI executable wrapper",
      0o700,
    );
    await chmod(wrapperPath, 0o700);
    const wrapperStats = await lstat(wrapperPath);
    if (
      !wrapperStats.isFile() ||
      wrapperStats.isSymbolicLink() ||
      wrapperStats.nlink !== 1 ||
      (wrapperStats.mode & 0o111) === 0
    ) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "Detached CI CLI wrapper must be one private executable regular file.",
        { command, links: wrapperStats.nlink },
      );
    }
    wrapperBytesByPath.set(wrapperPath, wrapperBytes);
  }

  let stdout;
  let stderr;
  let executionError;
  try {
    const childEnvironment = {
      ...process.env,
      GITHUB_ACTIONS: "false",
      NODE_NO_WARNINGS: "1",
      NODE_OPTIONS: "",
      NO_COLOR: "1",
      PATH: `${generatedDirectory}${path.delimiter}${inheritedPath}`,
    };
    delete childEnvironment.GITHUB_STEP_SUMMARY;
    delete childEnvironment.NODE_PATH;
    ({ stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        "--max-old-space-size=128",
        "--no-warnings",
        "--permission",
        `--allow-fs-read=${shadow.workspaceRoot}`,
        `--allow-fs-read=${generatedDirectory}`,
        "--allow-child-process",
        shadow.canonicalCandidatePath,
      ],
      {
        cwd: shadow.workspaceRoot,
        detached: false,
        encoding: "utf8",
        env: childEnvironment,
        killSignal: "SIGKILL",
        maxBuffer: DETACHED_CI_ENTRYPOINT_OUTPUT_LIMIT_BYTES,
        timeout: DETACHED_CI_ENTRYPOINT_TIMEOUT_MILLISECONDS,
      },
    ));
  } catch (error) {
    executionError = error;
  }

  const sourceAfter = await readRegularAbsoluteBytes(
    shadow.candidatePath,
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Detached single-pass CI candidate",
  );
  if (!byteEqual(authenticatedSourceBytes, sourceAfter)) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached CI source bytes changed while its real CLI entrypoint was observed.",
    );
  }
  for (const [wrapperPath, expectedBytes] of wrapperBytesByPath) {
    const actualBytes = await readRegularAbsoluteBytes(
      wrapperPath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached CI CLI executable wrapper",
    );
    if (!byteEqual(expectedBytes, actualBytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "Detached CI CLI wrapper bytes changed during execution.",
        { wrapperPath },
      );
    }
  }
  const logStats = await lstat(logPath);
  if (
    !logStats.isFile() ||
    logStats.isSymbolicLink() ||
    logStats.size > DETACHED_CI_ENTRYPOINT_LOG_LIMIT_BYTES
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached CI CLI command log exceeded its authenticated bounded-file profile.",
      { actualBytes: logStats.size, maximumBytes: DETACHED_CI_ENTRYPOINT_LOG_LIMIT_BYTES },
    );
  }
  const logBytes = await readRegularAbsoluteBytes(
    logPath,
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Detached CI CLI command log",
  );

  if (executionError !== undefined) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI source could not execute its real CLI entrypoint.",
      {
        exitCode:
          typeof executionError === "object" &&
          executionError !== null &&
          Object.hasOwn(executionError, "code")
            ? String(executionError.code)
            : "unknown",
        signal:
          typeof executionError === "object" &&
          executionError !== null &&
          Object.hasOwn(executionError, "signal")
            ? String(executionError.signal)
            : "none",
      },
    );
  }
  if (typeof stdout !== "string" || typeof stderr !== "string" || stderr !== "") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint emitted an unexpected process stream.",
    );
  }

  const logText = decodeUtf8(
    logBytes,
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Detached CI CLI command log",
  );
  const lines = logText.endsWith("\n") ? logText.slice(0, -1).split("\n") : [];
  const actualCommands = lines.map((line) =>
    parseJson(
      line,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached CI CLI command record",
    ),
  );
  const gitCommand = Object.freeze({
    command: "git",
    args: Object.freeze(["ls-files", "--stage", "-z"]),
  });
  const expectedCommands = [
    gitCommand,
    ...expectedSteps.map(({ command, args }) => ({ command, args: [...args] })),
    gitCommand,
  ];
  const commandKeys = new Set(["args", "command"]);
  const recordsAreExact = actualCommands.every(
    (record) =>
      exactPlainRecord(record, commandKeys) &&
      ["git", "node", "pnpm"].includes(record.command) &&
      Array.isArray(record.args) &&
      record.args.every((argument) => typeof argument === "string"),
  );
  if (
    lines.some((line) => line.length === 0) ||
    !recordsAreExact ||
    JSON.stringify(actualCommands) !== JSON.stringify(expectedCommands)
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The detached CI CLI entrypoint did not spawn every validated plan command exactly once.",
      { actualCount: actualCommands.length, expectedCount: expectedCommands.length },
    );
  }
  parseDetachedCiEntrypointReceipt(stdout, expectedSteps, expectedProofCount);
}

async function executeDetachedCiSuccessorProbe(ciSourceBytes, rootPackageBytes, expected) {
  const generatedTemporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "desen-t11-ci-candidate-"),
  );
  const generatedDirectory = await realpath(generatedTemporaryDirectory);
  try {
    const shadow = await createDetachedCiShadowWorkspace(
      generatedDirectory,
      ciSourceBytes,
      rootPackageBytes,
      expected,
    );
    const authenticatedBytes = await readRegularAbsoluteBytes(
      shadow.canonicalCandidatePath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached single-pass CI candidate",
    );
    if (!byteEqual(ciSourceBytes, authenticatedBytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "Detached single-pass CI candidate bytes changed before executable observation.",
      );
    }

    const candidateUrl = pathToFileURL(shadow.canonicalCandidatePath);
    candidateUrl.searchParams.set("desen-proof-sha256", sha256(authenticatedBytes));
    let stdout;
    try {
      ({ stdout } = await execFileAsync(
        process.execPath,
        [
          "--max-old-space-size=128",
          "--permission",
          `--allow-fs-read=${shadow.canonicalCandidatePath}`,
          "--input-type=module",
          "--eval",
          DETACHED_CI_SUCCESSOR_PROBE_SOURCE,
          "desen-t11-ci-plan-probe",
          candidateUrl.href,
        ],
        {
          cwd: ROOT,
          detached: process.platform !== "win32",
          encoding: "utf8",
          env: {},
          maxBuffer: 1_048_576,
          timeout: 5_000,
        },
      ));
    } catch (error) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The detached CI candidate could not derive and validate its executable plan.",
        {
          exitCode:
            typeof error === "object" && error !== null && Object.hasOwn(error, "code")
              ? String(error.code)
              : "unknown",
          signal:
            typeof error === "object" && error !== null && Object.hasOwn(error, "signal")
              ? String(error.signal)
              : "none",
        },
      );
    }

    const afterBytes = await readRegularAbsoluteBytes(
      shadow.canonicalCandidatePath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached single-pass CI candidate",
    );
    if (!byteEqual(authenticatedBytes, afterBytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "Detached single-pass CI candidate bytes changed during executable observation.",
      );
    }
    if (typeof stdout !== "string" || !stdout.startsWith(DETACHED_CI_SUCCESSOR_PROBE_PREFIX)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The detached CI candidate did not return one isolated executable plan.",
      );
    }
    const encoded = stdout.slice(DETACHED_CI_SUCCESSOR_PROBE_PREFIX.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The detached CI candidate returned a malformed executable-plan receipt.",
      );
    }
    const candidate = parseJson(
      Buffer.from(encoded, "base64").toString("utf8"),
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Detached CI candidate executable-plan receipt",
    );
    const receipt = validateDetachedCiSuccessorPlan(candidate, expected);
    await executeDetachedCiEntrypoint(
      shadow,
      generatedDirectory,
      authenticatedBytes,
      candidate.steps,
      expected.entries.length,
    );
    return receipt;
  } finally {
    await rm(generatedTemporaryDirectory, { recursive: true, force: true });
  }
}

let cachedCiSuccessorReceipt;

async function executeLiveCiSuccessorProbe(expectedBytes) {
  const cacheKey = sha256(expectedBytes);
  if (cachedCiSuccessorReceipt?.key === cacheKey) return cachedCiSuccessorReceipt.promise;
  const promise = (async () => {
    const ciPath = path.join(ROOT, CI_SOURCE);
    const before = await readRegularAbsoluteBytes(
      ciPath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Single-pass CI executable source",
      { relativePath: CI_SOURCE },
    );
    if (!byteEqual(before, expectedBytes)) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The executable CI source differs from the authenticated tracked bytes.",
      );
    }
    const ciUrl = pathToFileURL(ciPath);
    ciUrl.searchParams.set("desen-proof-sha256", cacheKey);
    const probe = [
      `const ci = await import(${JSON.stringify(ciUrl.href)});`,
      "const steps = ci.createQualityGateSteps();",
      "const validation = ci.validateQualityGatePlan(steps);",
      "process.stdout.write(JSON.stringify({",
      "  planSha256: validation.planSha256,",
      "  proofEntries: ci.PROOF_ENTRIES.length,",
      "  stepCount: validation.stepCount,",
      "}));",
    ].join("\n");
    let stdout;
    let stderr;
    try {
      ({ stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          "--max-old-space-size=128",
          "--permission",
          `--allow-fs-read=${ciPath}`,
          "--input-type=module",
          "--eval",
          probe,
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          env: { NODE_NO_WARNINGS: "1" },
          maxBuffer: 1_048_576,
          timeout: 10_000,
        },
      ));
    } catch (error) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The authenticated CI source could not derive and validate its executable plan.",
        {
          exitCode:
            typeof error === "object" && error !== null && Object.hasOwn(error, "code")
              ? String(error.code)
              : "unknown",
        },
      );
    }
    const after = await readRegularAbsoluteBytes(
      ciPath,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Single-pass CI executable source",
      { relativePath: CI_SOURCE },
    );
    if (!byteEqual(before, after) || stderr !== "") {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "The authenticated CI source changed during observation or emitted unexpected stderr.",
      );
    }
    return parseJson(
      stdout,
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "Single-pass CI executable receipt",
    );
  })();
  cachedCiSuccessorReceipt = Object.freeze({ key: cacheKey, promise });
  try {
    return await promise;
  } catch (error) {
    if (cachedCiSuccessorReceipt?.promise === promise) cachedCiSuccessorReceipt = undefined;
    throw error;
  }
}

function assertImmediateSingleRootScriptEdge(script, predecessor, current, label) {
  if (typeof script !== "string") {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      `${label} aggregate script is missing.`,
    );
  }
  const commands = script.split(" && ").map((command) => command.trim());
  const predecessorIndexes = commands.flatMap((command, index) =>
    command === predecessor ? [index] : [],
  );
  const currentIndexes = commands.flatMap((command, index) => (command === current ? [index] : []));
  if (
    predecessorIndexes.length !== 1 ||
    currentIndexes.length !== 1 ||
    currentIndexes[0] !== predecessorIndexes[0] + 1
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      `${label} must retain one exact immediate predecessor to successor edge.`,
      { predecessorIndexes, currentIndexes },
    );
  }
}

async function successorSurfaceClaims(bytesByPath, text, options, ciOverridden) {
  const rootManifest = parseJson(
    text(ROOT_PACKAGE, "Workspace package manifest"),
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Workspace package manifest",
  );
  const publisherManifest = parseJson(
    text(PUBLISHER_PACKAGE, "Publisher package manifest"),
    "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
    "Publisher package manifest",
  );
  const rootScripts = ownData(rootManifest, "scripts");
  const publisherScripts = ownData(publisherManifest, "scripts");
  assertCurrentT09CompatibilityMarkers(
    text(BUNDLE_PUBLICATION_PROOF_LIBRARY, "Current T09 compatibility reader"),
    text(BUNDLE_PUBLICATION_ROOT_TEST, "Current T09 compatibility regression suite"),
  );
  const predecessor =
    "pnpm verify:publisher-official-golden && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:invalid-source-matrix && ";
  const expectedRootScripts = Object.freeze({
    "generate:publisher-invalid-source-matrix": `${predecessor}node scripts/generate-publisher-invalid-source-matrix-proof.mjs`,
    "verify:publisher-invalid-source-matrix": `${predecessor}node scripts/verify-publisher-invalid-source-matrix.mjs`,
    "test:publisher-invalid-source-matrix": `${predecessor}node --test tests/publisher-invalid-source-matrix.test.mjs`,
  });
  const bundleStorePredecessor =
    "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && ";
  const expectedBundleStoreRootScripts = Object.freeze({
    "generate:control-plane-bundle-store": `${bundleStorePredecessor}node scripts/generate-control-plane-bundle-store-proof.mjs`,
    "verify:control-plane-bundle-store": `${bundleStorePredecessor}node scripts/verify-control-plane-bundle-store.mjs`,
    "test:control-plane-bundle-store": `${bundleStorePredecessor}node --test tests/control-plane-bundle-store.test.mjs`,
  });
  if (
    typeof rootScripts !== "object" ||
    rootScripts === null ||
    typeof publisherScripts !== "object" ||
    publisherScripts === null ||
    Object.entries(expectedRootScripts).some(
      ([name, command]) => ownData(rootScripts, name) !== command,
    ) ||
    Object.entries(expectedBundleStoreRootScripts).some(
      ([name, command]) => ownData(rootScripts, name) !== command,
    ) ||
    ownData(publisherScripts, "test:invalid-source-matrix") !==
      "vitest run test/invalid-source-matrix.test.ts"
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
      "The exact M06-T10 to M06-T11 to M07-T01 package registration changed.",
    );
  }
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "test"),
    "pnpm test:publisher-official-golden",
    "pnpm test:publisher-invalid-source-matrix",
    "Aggregate test T11 edge",
  );
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "check"),
    "pnpm verify:publisher-official-golden",
    "pnpm verify:publisher-invalid-source-matrix",
    "Aggregate check T11 edge",
  );
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "test"),
    "pnpm test:publisher-invalid-source-matrix",
    "pnpm test:control-plane-bundle-store",
    "Aggregate test M07-T01 edge",
  );
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "check"),
    "pnpm verify:publisher-invalid-source-matrix",
    "pnpm verify:control-plane-bundle-store",
    "Aggregate check M07-T01 edge",
  );

  const ciSourceText = text(CI_SOURCE, "Single-pass quality-gate source");
  const ciClaims = ciSuccessorClaims(ciSourceText);
  const observedCiReceipt = ciOverridden
    ? await executeDetachedCiSuccessorProbe(
        bytesByPath.get(CI_SOURCE),
        bytesByPath.get(ROOT_PACKAGE),
        ciClaims,
      )
    : await executeLiveCiSuccessorProbe(bytesByPath.get(CI_SOURCE));
  validateCiSuccessorReceipt(observedCiReceipt, ciClaims);
  if (ciOverridden && options.ciReceipt !== undefined) {
    validateCiSuccessorReceipt(options.ciReceipt, ciClaims);
  }

  const requiredFragments = new Map([
    [
      CI_TEST,
      [
        'test("the current repository exactly matches the reviewed live proof inventory"',
        'test("the exact single-pass plan rejects command removal and duplicate root coverage"',
      ],
    ],
    [
      CATALOG_PINNING_PROOF_LIBRARY,
      [
        "CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE",
        '"publisher-invalid-source-matrix"',
        '"control-plane-bundle-store"',
        '"scripts/verify-publisher-invalid-source-matrix.mjs"',
        '"scripts/verify-control-plane-bundle-store.mjs"',
        '"tests/publisher-invalid-source-matrix.test.mjs"',
        '"tests/control-plane-bundle-store.test.mjs"',
        '"test:invalid-source-matrix"',
      ],
    ],
    [
      CATALOG_PINNING_ROOT_TEST,
      [
        'test("rejects removal of the exact T11 CI successor"',
        'test("rejects exact T11 package registration drift"',
        'test("rejects removal of the exact M07-T01 CI successor"',
        'test("rejects exact M07-T01 root registration drift"',
      ],
    ],
    [
      BUNDLE_PUBLICATION_PROOF_LIBRARY,
      [
        "CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE",
        "INVALID_SOURCE_MATRIX_SUCCESSOR_CI_PROFILE",
        '"scripts/verify-control-plane-bundle-store.mjs"',
        '"scripts/verify-publisher-invalid-source-matrix.mjs"',
        '"test:invalid-source-matrix"',
      ],
    ],
    [
      BUNDLE_PUBLICATION_ROOT_TEST,
      [
        'test("[ci] rejects removal of the exact T11 CI successor"',
        'test("[ci] rejects exact T11 package registration drift"',
        'test("[ci] rejects removal of the exact M07-T01 CI successor"',
        'test("[ci] rejects exact M07-T01 root registration drift"',
      ],
    ],
    [
      OFFICIAL_GOLDEN_PROOF_LIBRARY,
      [
        '"publisher-invalid-source-matrix"',
        "successorPrerequisites",
        '"test:invalid-source-matrix"',
      ],
    ],
    [
      OFFICIAL_GOLDEN_ROOT_TEST,
      [
        'test("[registration] rejects removal of the exact T11 successor package script"',
        'test("[ci] rejects tampering with the exact T11 successor tuple"',
      ],
    ],
    [
      PUBLISH_RESULT_SOURCE,
      [
        "const PUBLISHER_DIAGNOSTIC_DATA = [",
        '"run.desen.publisher/INVALID_CATALOG_INPUT"',
        '"run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID"',
        "export const PUBLISHER_DIAGNOSTIC_REGISTRY",
      ],
    ],
    [
      CATALOG_RESOLUTION_SOURCE,
      [
        "export const PUBLISH_CATALOG_DIAGNOSTIC_REGISTRY",
        "observedPackageDigest",
        "target-specific package-byte verifier",
      ],
    ],
    [
      PUBLISH_RESULT_DISTRIBUTION,
      [
        "const PUBLISHER_DIAGNOSTIC_DATA = [",
        '"run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID"',
        "export const PUBLISHER_DIAGNOSTIC_REGISTRY",
      ],
    ],
    [
      PUBLISH_RESULT_DECLARATION,
      [
        "declare const PUBLISHER_DIAGNOSTIC_DATA:",
        '"run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID"',
        "export declare const PUBLISHER_DIAGNOSTIC_REGISTRY",
      ],
    ],
    [
      CATALOG_RESOLUTION_DISTRIBUTION,
      [
        "export const PUBLISH_CATALOG_DIAGNOSTIC_REGISTRY",
        "export function resolvePublishCatalogs",
      ],
    ],
    [
      CATALOG_RESOLUTION_DECLARATION,
      [
        "export declare const PUBLISH_CATALOG_DIAGNOSTIC_REGISTRY",
        "target-specific package-byte verifier",
        "export declare function resolvePublishCatalogs",
      ],
    ],
  ]);
  for (const [relativePath, fragments] of requiredFragments) {
    const surfaceText = text(relativePath, "M06-T11 successor compatibility surface");
    if (fragments.some((fragment) => !surfaceText.includes(fragment))) {
      fail(
        "PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_DRIFT",
        "An updated predecessor or quality-gate surface lost its exact M06-T11 successor semantics.",
        { relativePath },
      );
    }
  }

  return Object.freeze(
    PUBLISHER_INVALID_SOURCE_MATRIX_SUCCESSOR_SURFACES.map((pin) =>
      Object.freeze({ ...pin, verifiedSha256: pin.sha256 }),
    ),
  );
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
  const liveCurrentT09Successors = await authenticateLiveCurrentT09Successors();
  const liveCurrentT10Successors = await authenticateLiveCurrentT10Successors();
  const prerequisites = await prerequisiteClaims(options);
  const trackedPairs = await Promise.all(
    TRACKED.map(async (relativePath) => {
      const override = readOverrideMap(options.trackedFileBytes, relativePath, TRACKED_SET);
      const bytes = override ?? (await readRegularBytes(relativePath));
      return Object.freeze({ relativePath, bytes, overridden: override !== undefined });
    }),
  );
  const bytesByPath = new Map(trackedPairs.map(({ relativePath, bytes }) => [relativePath, bytes]));
  authenticateCurrentT09TrackedInputs(liveCurrentT09Successors, trackedPairs, options);
  authenticateCurrentT10TrackedInputs(liveCurrentT10Successors, trackedPairs, options);
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
  const ciTrackedPair = trackedPairs.find(({ relativePath }) => relativePath === CI_SOURCE);
  const successorAuthority = await successorSurfaceClaims(
    bytesByPath,
    text,
    options,
    ciTrackedPair?.overridden === true,
  );
  const packageTestText = text(PACKAGE_TEST, "Focused Publisher invalid-source test");
  const packageTests = packageTestClaims(packageTestText, bytesByPath.get(PACKAGE_TEST));
  const taskApplicability = taskApplicabilityClaims(traceText, packageTests.caseInventory);
  const runtimeProgramBytes = Buffer.from(
    programmaticRuntimeProbeSource(packageTestText, packageTests.caseInventory),
    "utf8",
  );
  const runtimeProbeTransport = runtimeProbeTransportClaim(runtimeProgramBytes);
  const runtime = validateRuntimeReceipt(
    options.runtimeReceipt ?? (await executeProgrammaticRuntimeProbe(runtimeProgramBytes)),
    packageTests.caseInventory,
  );
  const rootTestNames = countNamedTests(text(ROOT_TEST, "Invalid-source root evidence test"));
  const requiredRootCategories = [
    "[authority]",
    "[artifact]",
    "[bytes]",
    "[options]",
    "[prerequisite]",
    "[runtime]",
    "[symlink]",
    "[writer]",
  ];
  if (
    rootTestNames.length < 32 ||
    requiredRootCategories.some(
      (category) => !rootTestNames.some((testName) => testName.startsWith(category)),
    ) ||
    REQUIRED_M07_T01_SUCCESSOR_ROOT_TEST_NAMES.some(
      (requiredName) => !rootTestNames.includes(requiredName),
    )
  ) {
    fail(
      "PUBLISHER_INVALID_SOURCE_MATRIX_TEST_INVENTORY_DRIFT",
      "The hostile root suite must retain at least thirty-two cases and every reviewed category.",
      { cases: rootTestNames.length },
    );
  }
  const trackedFiles = Object.freeze(
    trackedPairs.map(({ relativePath, bytes, overridden }) => {
      const currentT09HistoricalReceipt =
        relativePath === BUNDLE_PUBLICATION_PROOF_LIBRARY ||
        relativePath === BUNDLE_PUBLICATION_ROOT_TEST
          ? HISTORICAL_TRACKED_RECEIPTS[relativePath]
          : undefined;
      const currentT10HistoricalReceipt =
        relativePath === OFFICIAL_GOLDEN_PROOF_LIBRARY || relativePath === OFFICIAL_GOLDEN_ROOT_TEST
          ? HISTORICAL_TRACKED_RECEIPTS[relativePath]
          : undefined;
      const historical =
        currentT09HistoricalReceipt ??
        currentT10HistoricalReceipt ??
        (overridden === false || [CI_SOURCE, ROOT_PACKAGE].includes(relativePath)
          ? HISTORICAL_TRACKED_RECEIPTS[relativePath]
          : undefined);
      return SAFE_OBJECT_FREEZE({
        path: relativePath,
        bytes: historical?.bytes ?? bytes.byteLength,
        sha256: historical?.sha256 ?? sha256(bytes),
      });
    }),
  );
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
      successorAuthority,
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
    tests: {
      focusedPackageCases: packageTests.exactNames.length,
      focusedRuntimeCases: runtime.claim.focusedRuntimeTests,
      invalidMatrixCases: packageTests.caseInventory.length,
      rootMutationCases: HISTORICAL_ROOT_MUTATION_CASES,
      requiredRootCategories,
    },
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
