import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import { preflightPublishCapabilities } from "../../packages/publisher/dist/capability-preflight.js";
import {
  EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
} from "../../packages/publisher/dist/execution-preflight.js";
import * as validatorPublicApi from "../../packages/validator/dist/index.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-execution-preflight.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-EXECUTION-PREFLIGHT.md";
const PUBLISHER_PACKAGE_RELATIVE_PATH = "packages/publisher/package.json";
const EXECUTION_SOURCE_RELATIVE_PATH = "packages/publisher/src/execution-preflight.ts";
const EXECUTION_BUILD_RELATIVE_PATH = "packages/publisher/dist/execution-preflight.js";
const EXECUTION_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/execution-preflight.d.ts";
const PUBLIC_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/index.d.ts";
const M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH =
  "scripts/lib/reference-host-web-source-audit-proof.mjs";
const M05_SOURCE_AUDIT_TEST_RELATIVE_PATH = "tests/reference-host-web-source-audit.test.mjs";

const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_REFLECT_OWN_KEYS = Reflect.ownKeys;
const SAFE_ARRAY_IS_ARRAY = Array.isArray;
const SAFE_OBJECT_CREATE = Object.create;
const SAFE_OBJECT_FREEZE = Object.freeze;
const SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;
const SAFE_OBJECT_GET_PROTOTYPE_OF = Object.getPrototypeOf;
const SAFE_OBJECT_HAS_OWN = Object.hasOwn;
const SAFE_OBJECT_PROTOTYPE = Object.prototype;
const SAFE_SET = Set;
const SAFE_SET_HAS = Set.prototype.has;
const SAFE_UINT8_ARRAY = Uint8Array;
const SAFE_UINT8_ARRAY_SET = Uint8Array.prototype.set;
const SAFE_FUNCTION_HAS_INSTANCE = Function.prototype[Symbol.hasInstance];
const SAFE_SHARED_ARRAY_BUFFER =
  typeof SharedArrayBuffer === "undefined" ? undefined : SharedArrayBuffer;
const TYPED_ARRAY_PROTOTYPE = SAFE_OBJECT_GET_PROTOTYPE_OF(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_TAG_GETTER = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const PUBLISHER_EXECUTION_OPTION_KEYS = new SAFE_SET([
  "artifactBytes",
  "artifactPath",
  "beforeAtomicRename",
  "compatibilitySourceBytes",
  "executionDeclaration",
  "executionSource",
  "fixtures",
  "preflight",
  "prerequisiteBytes",
  "proofDocument",
  "publicApi",
  "publicDeclaration",
  "publisherPackage",
  "validatorApi",
  "verifyPrerequisites",
]);

const FIXTURE_PATHS = Object.freeze({
  validSource: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  validCatalog: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
  exampleSortable:
    "packages/protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json",
  exampleStoreMap: "packages/protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json",
  exampleCatalog: "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
});

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M02-T10",
    path: "docs/proof/artifacts/protocol-0.1.0-binding-contracts.json",
    sha256: "2ffa1b874bae23df8ba3e0e0334b3f0b6739ec4dfd6acc9e2aabf1c87ce9c39c",
    claim: "state, predicate, repeat, lexical-reference, and binding compatibility contracts",
  }),
  Object.freeze({
    task: "M02-T11",
    path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
    claim: "resource, operation, action, lifecycle, and resolved receiving contracts",
  }),
  Object.freeze({
    task: "M06-T04",
    path: "docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
    sha256: "2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e",
    claim: "exact Source, execution-independent Catalog, package, alignment, and warning authority",
  }),
]);

const TRACKED_PATHS = Object.freeze([
  ...Object.values(FIXTURE_PATHS),
  "package.json",
  "packages/publisher/README.md",
  PUBLISHER_PACKAGE_RELATIVE_PATH,
  "packages/publisher/src/capability-preflight.ts",
  EXECUTION_SOURCE_RELATIVE_PATH,
  "packages/publisher/src/index.ts",
  "packages/publisher/src/publish-diagnostics.ts",
  "packages/publisher/src/publish-result.ts",
  "packages/publisher/src/source-preflight.ts",
  "packages/publisher/test/execution-preflight.test.ts",
  "packages/publisher/test/execution-preflight.types.ts",
  EXECUTION_BUILD_RELATIVE_PATH,
  EXECUTION_DECLARATION_RELATIVE_PATH,
  PUBLIC_DECLARATION_RELATIVE_PATH,
  "packages/validator/README.md",
  "packages/validator/src/binding-contract-validation.ts",
  "packages/validator/src/execution-contract-validation.ts",
  "packages/validator/src/index.ts",
  "packages/validator/test/binding-contracts.test.ts",
  "packages/validator/test/execution-contracts.test.ts",
  "packages/validator/test/execution-publication-contracts.types.ts",
  M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH,
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-execution-preflight-proof.mjs",
  "scripts/generate-publisher-execution-preflight-proof.mjs",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "scripts/verify-publisher-execution-preflight.mjs",
  "tests/publisher-execution-preflight.test.mjs",
  M05_SOURCE_AUDIT_TEST_RELATIVE_PATH,
]);

const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  "package.json": Object.freeze({
    bytes: 52_201,
    sha256: "46852fb9bc0f4f7a636e3d9b4bc7d26d280416432a0d24d48c44cfb9d081d06a",
  }),
  "packages/publisher/README.md": Object.freeze({
    bytes: 24_702,
    sha256: "437239aa443ba63829624de67263037e677f547c676c45e5213d32047cca416c",
  }),
  [PUBLISHER_PACKAGE_RELATIVE_PATH]: Object.freeze({
    bytes: 1_375,
    sha256: "7bc7e90e6c435323ca987d1648e100d773b3067ec09ee16a7e148cbee6fa25c7",
  }),
  "packages/publisher/src/index.ts": Object.freeze({
    bytes: 911,
    sha256: "0d8d411f78a8f75c2ef65821da17cfa22fae77dba1c855b3c442146076f62e30",
  }),
  "packages/publisher/src/publish-result.ts": Object.freeze({
    bytes: 10_665,
    sha256: "9f3a47ad28229cbc172527f5e005c240132f0aa524f5075f83b4662c0f3daa00",
  }),
  [PUBLIC_DECLARATION_RELATIVE_PATH]: Object.freeze({
    bytes: 902,
    sha256: "8286119f1873ad9fcef182b91af323be6cc1cf46f2e33475c140953d7ca67954",
  }),
  "packages/validator/README.md": Object.freeze({
    bytes: 63_186,
    sha256: "cc3084bee297f75453723705b1e0bd99857fe92613ba2f6f0cb3cb11372a7718",
  }),
  "scripts/run-ci-quality-gate.mjs": Object.freeze({
    bytes: 45_050,
    sha256: "e025a54e4eb7d3d7bed45e0ccbab86c9005221e95e8e2332eda1ee5c7b112360",
  }),
  "scripts/test/ci-quality-gate.test.mjs": Object.freeze({
    bytes: 24_068,
    sha256: "b4cc04a78d642da4a42d64657ed04343056d39d47c026a24b9054290bf32f0cf",
  }),
  "scripts/lib/publisher-execution-preflight-proof.mjs": Object.freeze({
    bytes: 59_307,
    sha256: "d7673e27909b5b6fdaf0268c539867deec6049e80e3eba21c3b50b7cd07247ab",
  }),
  [M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH]: Object.freeze({
    bytes: 228_873,
    sha256: "5f3ee52f48e19e8ccefc6f64b07e73e2fe04aa8edb17deb389f0bfbaf4def2d1",
  }),
  "tests/publisher-execution-preflight.test.mjs": Object.freeze({
    bytes: 12_361,
    sha256: "bd40e0d124504caabf172b4bba6143dad519b30af026a7dcf96e4b4bcf2cd9e0",
  }),
  [M05_SOURCE_AUDIT_TEST_RELATIVE_PATH]: Object.freeze({
    bytes: 70_344,
    sha256: "268d8ccec567fb05f07a24746d227ddd76d672525768c2b92faff747a870575f",
  }),
});

const APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY = Object.freeze({
  [M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH]: Object.freeze([
    Object.freeze({
      task: "M07-T03",
      bytes: 246_554,
      sha256: "2bf728948372d8366f7badc7f2d7a36f6b8799b0dcc45baef92c29c90bdd2114",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 252_188,
      sha256: "94d1d9f02af9d564ebe4dd2c5b36fc0f7bab4d28cad87ca144ddb41756dd1c17",
    }),
    Object.freeze({
      task: "M07-T05",
      bytes: 255_778,
      sha256: "63dda01b718dc75feb12e006cece2ada5c75f951f306c3265f3e1dcf745f164f",
    }),
    Object.freeze({
      task: "M07-T06",
      bytes: 257_943,
      sha256: "927201fd9e9067a1d03ca1b274724bb065ca97f47755348338a979e4c2f2f74a",
    }),
    Object.freeze({
      task: "M07-T07",
      bytes: 261_145,
      sha256: "a9e58b3f4c6aa70421121b285e9c576bc0d71dfcaa1ff90a2c37667b9a86cabe",
    }),
  ]),
  [M05_SOURCE_AUDIT_TEST_RELATIVE_PATH]: Object.freeze([
    Object.freeze({
      task: "M07-T03",
      bytes: 81_283,
      sha256: "499888c12d43b62d81a0cdaaf0c6248bfb0b7956eca9cce3c478d0ab7f39b5cd",
    }),
    Object.freeze({
      task: "M07-T04",
      bytes: 83_937,
      sha256: "1690d26b0a301b2528413b4bcfa9fc2e3f32171db284e6fced82726669c16840",
    }),
    Object.freeze({
      task: "M07-T05",
      bytes: 85_044,
      sha256: "4d07f2cd62be4f47fd2bad5090ef620e380abb9f822d20889896fb85e0066979",
    }),
    Object.freeze({
      task: "M07-T06",
      bytes: 86_740,
      sha256: "ec7aabd8e3446f58ca397e55f0b4580bee193e21e692c46fe89c3f4a60902ac9",
    }),
    Object.freeze({
      task: "M07-T07",
      bytes: 87_748,
      sha256: "62103dfff978ce2a40e5e46875e0b4087d8998d38efd8100da6e009684abd37f",
    }),
  ]),
});

const APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS = Object.freeze({
  [M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH]:
    APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY[M05_SOURCE_AUDIT_PROOF_RELATIVE_PATH][4],
  [M05_SOURCE_AUDIT_TEST_RELATIVE_PATH]:
    APPROVED_M05_COMPATIBILITY_RECEIPT_HISTORY[M05_SOURCE_AUDIT_TEST_RELATIVE_PATH][4],
});

const HISTORICAL_ROOT_RUNTIME_EXPORTS = Object.freeze([
  "DEPRECATED_CAPABILITY_CODE",
  "INVALID_SOURCE_JSON_CODE",
  "PUBLISHER_DIAGNOSTIC_REGISTRY",
  "PUBLISH_PIPELINE_STAGES",
  "PUBLISH_SOURCE_JSON_LIMITS",
  "SOURCE_LIMIT_EXCEEDED_CODE",
  "getPublisherDiagnosticDefinition",
  "isPublisherDiagnosticCode",
]);

const SUCCESSOR_ROOT_RUNTIME_EXPORTS = Object.freeze([
  ...HISTORICAL_ROOT_RUNTIME_EXPORTS,
  "publishDesenSource",
]);

const ALLOWED_SOURCE_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./capability-preflight.js",
  "./catalog-resolution.js",
  "./publish-diagnostics.js",
  "./publish-result.js",
  "./source-preflight.js",
]);
const ALLOWED_DECLARATION_IMPORTS = Object.freeze([
  "@desen/validator",
  "./catalog-resolution.js",
  "./publish-result.js",
  "./source-preflight.js",
]);
const FORBIDDEN_PLATFORM_IDENTIFIERS = new Set([
  "Buffer",
  "Bun",
  "Deno",
  "EventSource",
  "SharedWorker",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "__dirname",
  "__filename",
  "caches",
  "chrome",
  "document",
  "fetch",
  "frames",
  "global",
  "globalThis",
  "indexedDB",
  "localStorage",
  "location",
  "module",
  "navigator",
  "parent",
  "process",
  "self",
  "sessionStorage",
  "top",
  "window",
]);
const FORBIDDEN_PARTIAL_FIELDS = Object.freeze([
  "bundle",
  "capabilityPreflighted",
  "catalogSet",
  "executionPreflighted",
  "obligations",
  "packages",
  "phase",
  "preflighted",
  "requirementPackageIndexes",
  "resolved",
  "source",
  "value",
]);
const EXACT_OBLIGATION_KINDS = Object.freeze([
  "behavior-prop",
  "behavior-style-part-property",
  "component-command-input",
  "component-prop",
  "operation-input",
  "resource-input",
  "state-write",
  "style-part-property",
]);
const EXACT_OFFICIAL_OBLIGATIONS = Object.freeze([
  Object.freeze({
    kind: "state-write",
    pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/value",
  }),
  Object.freeze({
    kind: "component-prop",
    pointer: "/surfaces/sign-in/root/slots/default/1/props/value",
  }),
  Object.freeze({
    kind: "state-write",
    pointer: "/surfaces/sign-in/root/slots/default/2/on/change/0/value",
  }),
  Object.freeze({
    kind: "component-prop",
    pointer: "/surfaces/sign-in/root/slots/default/2/props/value",
  }),
  Object.freeze({
    kind: "operation-input",
    pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/input/email",
  }),
  Object.freeze({
    kind: "operation-input",
    pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/input/password",
  }),
  Object.freeze({
    kind: "component-prop",
    pointer: "/surfaces/sign-in/root/slots/default/4/props/loading",
  }),
]);
const EXECUTION_STAGES = Object.freeze([
  "capability-contracts",
  "state-and-control-flow",
  "binding-compatibility",
]);

/** Absolute destination of the deterministic M06-T05 evidence artifact. */
export const DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Controlled failure emitted by the M06-T05 evidence builder and verifier. */
export class PublisherExecutionPreflightEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherExecutionPreflightEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherExecutionPreflightEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function captureOptions(value) {
  if (value === undefined) return SAFE_OBJECT_FREEZE({});
  let prototype;
  if (value === null || typeof value !== "object" || SAFE_ARRAY_IS_ARRAY(value)) {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  let keys;
  try {
    prototype = SAFE_OBJECT_GET_PROTOTYPE_OF(value);
    keys = SAFE_REFLECT_APPLY(SAFE_REFLECT_OWN_KEYS, Reflect, [value]);
  } catch {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", "Evidence options could not be inspected safely.");
  }
  if (prototype !== SAFE_OBJECT_PROTOTYPE && prototype !== null) {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  const captured = SAFE_OBJECT_CREATE(null);
  for (const key of keys) {
    if (
      typeof key !== "string" ||
      !SAFE_REFLECT_APPLY(SAFE_SET_HAS, PUBLISHER_EXECUTION_OPTION_KEYS, [key])
    ) {
      fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", "Evidence options contain an unknown field.");
    }
    let descriptor;
    try {
      descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    } catch {
      fail(
        "PUBLISHER_EXECUTION_OPTIONS_INVALID",
        `Evidence option ${key} could not be inspected safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_EXECUTION_OPTIONS_INVALID",
        `Evidence option ${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return SAFE_OBJECT_FREEZE(captured);
}

function copyExactUint8Array(value, label) {
  if (
    TYPED_ARRAY_BUFFER_GETTER === undefined ||
    TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
    TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
    TYPED_ARRAY_TAG_GETTER === undefined
  ) {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "The runtime cannot establish exact byte-view authority.",
    );
  }
  let buffer;
  let byteLength;
  let byteOffset;
  let tag;
  try {
    buffer = SAFE_REFLECT_APPLY(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = SAFE_REFLECT_APPLY(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = SAFE_REFLECT_APPLY(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    tag = SAFE_REFLECT_APPLY(TYPED_ARRAY_TAG_GETTER, value, []);
  } catch {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", `${label} must be an exact Uint8Array byte view.`);
  }
  if (tag !== "Uint8Array") {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", `${label} must be an exact Uint8Array byte view.`);
  }
  if (
    SAFE_SHARED_ARRAY_BUFFER !== undefined &&
    SAFE_REFLECT_APPLY(SAFE_FUNCTION_HAS_INSTANCE, SAFE_SHARED_ARRAY_BUFFER, [buffer])
  ) {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", `${label} must not use shared mutable memory.`);
  }
  const copied = new SAFE_UINT8_ARRAY(byteLength);
  SAFE_REFLECT_APPLY(SAFE_UINT8_ARRAY_SET, copied, [
    new SAFE_UINT8_ARRAY(buffer, byteOffset, byteLength),
  ]);
  return copied;
}

function captureCompatibilitySourceBytes(value) {
  if (value === undefined) return SAFE_OBJECT_FREEZE(SAFE_OBJECT_CREATE(null));
  if (value === null || typeof value !== "object" || SAFE_ARRAY_IS_ARRAY(value)) {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "Compatibility source overrides must be an own-data path map.",
    );
  }
  let prototype;
  let keys;
  try {
    prototype = SAFE_OBJECT_GET_PROTOTYPE_OF(value);
    keys = SAFE_REFLECT_APPLY(SAFE_REFLECT_OWN_KEYS, Reflect, [value]);
  } catch {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "Compatibility source overrides could not be inspected safely.",
    );
  }
  if (prototype !== SAFE_OBJECT_PROTOTYPE && prototype !== null) {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "Compatibility source overrides must be a plain own-data path map.",
    );
  }
  const captured = SAFE_OBJECT_CREATE(null);
  for (const key of keys) {
    if (
      typeof key !== "string" ||
      !SAFE_OBJECT_HAS_OWN(APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS, key)
    ) {
      fail(
        "PUBLISHER_EXECUTION_OPTIONS_INVALID",
        "Compatibility source overrides contain an unknown path.",
      );
    }
    let descriptor;
    try {
      descriptor = SAFE_OBJECT_GET_OWN_PROPERTY_DESCRIPTOR(value, key);
    } catch {
      fail(
        "PUBLISHER_EXECUTION_OPTIONS_INVALID",
        `Compatibility source override ${key} could not be inspected safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_EXECUTION_OPTIONS_INVALID",
        `Compatibility source override ${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = copyExactUint8Array(descriptor.value, key);
  }
  return SAFE_OBJECT_FREEZE(captured);
}

function rejectAuthoritativeCompatibilityOverride(options) {
  if (SAFE_OBJECT_HAS_OWN(options, "compatibilitySourceBytes")) {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "Authoritative verification and writing must authenticate live M05 compatibility sources.",
    );
  }
}

async function readRegularBytes(relativePath) {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("PUBLISHER_EXECUTION_FILE_MISSING", `Required file is missing: ${relativePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail(
      "PUBLISHER_EXECUTION_FILE_INVALID",
      `Required path is not a regular file: ${relativePath}`,
    );
  }
  return readFile(absolutePath);
}

async function readJson(relativePath) {
  const bytes = await readRegularBytes(relativePath);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PUBLISHER_EXECUTION_JSON_INVALID", `Required JSON is invalid: ${relativePath}`);
  }
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function candidateFor(catalog) {
  return {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
  };
}

function callPreflight(preflight, source, catalog, limits = undefined) {
  try {
    const rawSource = JSON.stringify(source);
    const candidates = [candidateFor(catalog)];
    return limits === undefined
      ? preflight(rawSource, candidates)
      : preflight(rawSource, candidates, limits);
  } catch (error) {
    fail("PUBLISHER_EXECUTION_PREFLIGHT_THROW", "Execution preflight threw in a proof vector.", {
      cause: String(error),
    });
  }
}

function assertNoPartial(result, label) {
  for (const key of FORBIDDEN_PARTIAL_FIELDS) {
    if (Object.hasOwn(result, key)) {
      fail(
        "PUBLISHER_EXECUTION_PARTIAL_FAILURE",
        `${label} exposed forbidden partial field ${key}.`,
      );
    }
  }
  if (JSON.stringify(Object.keys(result).sort()) !== '["diagnostics","ok","stage"]') {
    fail(
      "PUBLISHER_EXECUTION_PARTIAL_FAILURE",
      `${label} did not retain the exact closed failure shell.`,
    );
  }
}

function findDiagnostic(result, expected) {
  return result.diagnostics?.find(
    (entry) =>
      entry?.code === expected.code &&
      entry?.pointer === expected.pointer &&
      entry?.stage === expected.stage &&
      entry?.severity === "error",
  );
}

function assertFailure(result, expected, label) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.ok !== false ||
    result.stage !== expected.stage ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length === 0 ||
    findDiagnostic(result, expected) === undefined
  ) {
    fail(expected.failureCode, `${label} did not return the expected stopped-stage failure.`);
  }
  assertNoPartial(result, label);
  if (!isDeepFrozen(result)) {
    fail(expected.failureCode, `${label} did not return recursively immutable failure data.`);
  }
  return Object.freeze({
    stage: result.stage,
    code: expected.code,
    pointer: expected.pointer,
    diagnosticCount: result.diagnostics.length,
    noPartial: true,
    deeplyFrozen: true,
  });
}

function obligationCodeUnits(obligation) {
  const context = obligation.context;
  return (
    obligation.kind.length +
    obligation.pointer.length +
    (context.documentId?.length ?? 0) +
    (context.surfaceId?.length ?? 0) +
    (context.subject?.kind.length ?? 0) +
    (context.subject?.id.length ?? 0) +
    (context.capabilityId?.length ?? 0)
  );
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareObligations(left, right) {
  for (const [leftValue, rightValue] of [
    [left.pointer, right.pointer],
    [left.kind, right.kind],
    [left.context.documentId, right.context.documentId],
    [left.context.surfaceId, right.context.surfaceId],
    [left.context.subject?.kind, right.context.subject?.kind],
    [left.context.subject?.id, right.context.subject?.id],
    [left.context.capabilityId, right.context.capabilityId],
  ]) {
    const order = compareText(leftValue ?? "", rightValue ?? "");
    if (order !== 0) return order;
  }
  return 0;
}

function assertCompleteObligations(obligations, label) {
  if (!Array.isArray(obligations) || !isDeepFrozen(obligations)) {
    fail(
      "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
      `${label} did not expose an immutable obligation array.`,
    );
  }
  let prior;
  for (const obligation of obligations) {
    if (
      obligation === null ||
      typeof obligation !== "object" ||
      !EXACT_OBLIGATION_KINDS.includes(obligation.kind) ||
      typeof obligation.pointer !== "string" ||
      obligation.context === null ||
      typeof obligation.context !== "object"
    ) {
      fail(
        "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
        `${label} exposed an unknown or malformed runtime obligation.`,
      );
    }
    if (prior !== undefined && compareObligations(prior, obligation) >= 0) {
      fail(
        "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
        `${label} obligations were duplicated or not in exact normalized order.`,
      );
    }
    prior = obligation;
  }
  return obligations;
}

function assertExecutionSuccess(result, label, expectedWarnings = undefined) {
  const exactKeys = [
    "catalogSet",
    "diagnostics",
    "executionPreflighted",
    "obligations",
    "packages",
    "requirementPackageIndexes",
    "source",
  ];
  if (
    result === null ||
    typeof result !== "object" ||
    result.executionPreflighted !== true ||
    JSON.stringify(Object.keys(result).sort()) !== JSON.stringify(exactKeys) ||
    !Array.isArray(result.catalogSet) ||
    !Array.isArray(result.packages) ||
    !Array.isArray(result.requirementPackageIndexes) ||
    !Array.isArray(result.diagnostics) ||
    (expectedWarnings !== undefined && result.diagnostics.length !== expectedWarnings) ||
    Object.hasOwn(result, "ok") ||
    Object.hasOwn(result, "bundle") ||
    Object.hasOwn(result, "capabilityPreflighted") ||
    !isDeepFrozen(result)
  ) {
    fail(
      "PUBLISHER_EXECUTION_SUCCESS_VECTOR_FAILED",
      `${label} did not return complete immutable nonterminal execution authority.`,
    );
  }
  if (
    result.packages.length !== result.catalogSet.length ||
    result.packages.some((entry, index) => entry.catalog !== result.catalogSet[index]) ||
    result.requirementPackageIndexes.some(
      (index) => !Number.isSafeInteger(index) || index < 0 || index >= result.packages.length,
    )
  ) {
    fail(
      "PUBLISHER_EXECUTION_AUTHORITY_FAILED",
      `${label} broke selected-package, Catalog, or requirement-alignment identity.`,
    );
  }
  assertCompleteObligations(result.obligations, label);
  return result;
}

function directCapabilityResult(source, catalog) {
  const result = preflightPublishCapabilities(JSON.stringify(source), [candidateFor(catalog)]);
  if (result?.capabilityPreflighted !== true) {
    fail(
      "PUBLISHER_EXECUTION_T04_PREREQUISITE_FAILED",
      "A proof fixture no longer passes the exact M06-T04 predecessor.",
    );
  }
  return result;
}

function exactAuthorityEvidence(preflight, validatorApi, source, catalog) {
  const sourceInput = cloneJson(source);
  const catalogInput = cloneJson(catalog);
  const predecessor = directCapabilityResult(cloneJson(source), cloneJson(catalog));
  const result = assertExecutionSuccess(
    callPreflight(preflight, sourceInput, catalogInput),
    "frozen valid sign-in",
    0,
  );
  const catalogsReauthenticated = validatorApi.validateDesenExecutionCatalogSet(result.catalogSet);
  const sourceReauthenticated = validatorApi.validatePreparedDesenSourceReferences(
    result.source,
    result.catalogSet,
  );
  const publicationReauthenticated = validatorApi.validateDesenPreparedSourcePublicationContracts(
    result.source,
    result.catalogSet,
  );
  if (
    catalogsReauthenticated?.valid !== true ||
    catalogsReauthenticated.value !== result.catalogSet ||
    sourceReauthenticated?.valid !== true ||
    sourceReauthenticated.value !== result.source ||
    publicationReauthenticated?.valid !== true ||
    publicationReauthenticated.value !== result.source ||
    result.source === sourceInput ||
    result.catalogSet[0] === catalogInput
  ) {
    fail(
      "PUBLISHER_EXECUTION_AUTHORITY_FAILED",
      "Execution preflight did not retain detached, runtime-authenticated exact T04 authority.",
    );
  }
  if (
    JSON.stringify(publicationReauthenticated.obligations) !== JSON.stringify(result.obligations)
  ) {
    fail(
      "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
      "Execution preflight changed or dropped the public Validator obligation projection.",
    );
  }

  for (const key of [
    "source",
    "catalogSet",
    "packages",
    "requirementPackageIndexes",
    "diagnostics",
  ]) {
    if (JSON.stringify(result[key]) !== JSON.stringify(predecessor[key])) {
      fail(
        "PUBLISHER_EXECUTION_T04_PREREQUISITE_FAILED",
        `Execution preflight changed the inert M06-T04 ${key} projection.`,
      );
    }
  }
  const officialProjection = result.obligations.map(({ kind, pointer }) => ({ kind, pointer }));
  if (JSON.stringify(officialProjection) !== JSON.stringify(EXACT_OFFICIAL_OBLIGATIONS)) {
    fail(
      "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
      "The frozen sign-in Source no longer emits its exact seven-obligation projection.",
    );
  }

  const repeated = assertExecutionSuccess(
    callPreflight(preflight, cloneJson(source), cloneJson(catalog)),
    "repeated frozen valid sign-in",
    0,
  );
  if (JSON.stringify(repeated) !== JSON.stringify(result)) {
    fail(
      "PUBLISHER_EXECUTION_DETERMINISM_FAILED",
      "Repeated execution preflight did not return byte-identical inert JSON.",
    );
  }

  sourceInput.entry = "caller-mutated";
  catalogInput.description = "caller-mutated";
  if (
    result.source.entry !== source.entry ||
    result.catalogSet[0]?.description !== catalog.description
  ) {
    fail(
      "PUBLISHER_EXECUTION_DETACHMENT_FAILED",
      "Caller mutation changed prepared Source or Catalog execution authority.",
    );
  }

  const warningCatalog = cloneJson(catalog);
  warningCatalog.components["com.example.ui/Stack"].deprecated = "PRIVATE RETIREMENT EXPLANATION";
  warningCatalog.components["com.example.ui/Stack"].replacement = "private/replacement";
  const warningPredecessor = directCapabilityResult(cloneJson(source), cloneJson(warningCatalog));
  const warningSuccess = assertExecutionSuccess(
    callPreflight(preflight, cloneJson(source), warningCatalog),
    "T04 warning preservation",
    2,
  );
  if (
    JSON.stringify(warningSuccess.diagnostics) !== JSON.stringify(warningPredecessor.diagnostics) ||
    JSON.stringify(warningSuccess.diagnostics).includes("PRIVATE RETIREMENT EXPLANATION") ||
    JSON.stringify(warningSuccess.diagnostics).includes("private/replacement")
  ) {
    fail(
      "PUBLISHER_EXECUTION_T04_PREREQUISITE_FAILED",
      "Execution preflight changed or disclosed data through inherited T04 warnings.",
    );
  }

  return Object.freeze({
    sourceId: result.source.id,
    catalogs: result.catalogSet.length,
    selectedPackages: result.packages.length,
    requirementPackageIndexes: Object.freeze([...result.requirementPackageIndexes]),
    t04ProjectionByteEqual: true,
    t04WarningProjectionByteEqual: true,
    executionCatalogAuthorityReauthenticatedByIdentity: true,
    sourceReferenceAuthorityReauthenticatedByIdentity: true,
    publicationAuthorityReauthenticatedByIdentity: true,
    sourceDetached: true,
    catalogDetached: true,
    obligationCount: result.obligations.length,
    exactOfficialObligations: Object.freeze(officialProjection),
    terminalOkAbsent: true,
    bundleAbsent: true,
    deeplyFrozen: true,
    repeatedJsonByteIdentical: true,
  });
}

function dynamicBehaviorAndResourceFixture(fixtures) {
  const source = cloneJson(fixtures.exampleSortable);
  const catalog = cloneJson(fixtures.exampleCatalog);
  const surface = source.surfaces.tasks;
  surface.state = {
    axis: {
      schema: { type: "string", enum: ["vertical", "horizontal", "both"] },
      initial: "vertical",
    },
  };
  surface.root.behaviors[0].props.axis = { $ref: "state.axis" };
  surface.root.behaviors[0].style = {
    base: {
      dropIndicator: {
        color: { $token: "color.drag.indicator" },
      },
    },
  };
  surface.resources.tasks.input = {
    filter: { $ref: "context.taskFilter" },
  };
  catalog.behaviors["com.example.interactions/Sortable"].styleParts.dropIndicator = {
    propertiesSchema: {
      type: "object",
      additionalProperties: false,
      properties: { color: { type: "string" } },
    },
  };
  catalog.resources["com.example.tasks/list"].inputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["filter"],
    properties: { filter: { type: "string" } },
  };
  return Object.freeze({ source, catalog });
}

function publicPublicationResult(validatorApi, source, catalog, label) {
  const predecessor = directCapabilityResult(cloneJson(source), cloneJson(catalog));
  let executionCatalogs;
  try {
    executionCatalogs = validatorApi.validateDesenExecutionCatalogSet(predecessor.catalogSet);
  } catch (error) {
    fail(
      "PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED",
      `${label} execution-Catalog preparation threw.`,
      { cause: String(error) },
    );
  }
  if (executionCatalogs?.valid !== true || !isDeepFrozen(executionCatalogs)) {
    return Object.freeze({ catalogFailure: executionCatalogs });
  }
  let publication;
  try {
    publication = validatorApi.validateDesenPreparedSourcePublicationContracts(
      predecessor.source,
      executionCatalogs.value,
    );
  } catch (error) {
    fail(
      "PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED",
      `${label} publication-contract validation threw.`,
      { cause: String(error) },
    );
  }
  if (!isDeepFrozen(publication)) {
    fail(
      "PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED",
      `${label} publication-contract validation was not deeply immutable.`,
    );
  }
  return Object.freeze({ publication });
}

function fixtureAndObligationEvidence(preflight, validatorApi, fixtures) {
  const dynamic = dynamicBehaviorAndResourceFixture(fixtures);
  const pairs = [
    ["frozen valid sign-in", fixtures.validSource, fixtures.validCatalog],
    ["frozen example sortable list", fixtures.exampleSortable, fixtures.exampleCatalog],
    ["frozen example store map", fixtures.exampleStoreMap, fixtures.exampleCatalog],
    ["dynamic behavior and resource coverage", dynamic.source, dynamic.catalog],
  ];
  const kinds = new Set();
  const accepted = [];
  for (const [id, source, catalog] of pairs) {
    const publisher = assertExecutionSuccess(
      callPreflight(preflight, cloneJson(source), cloneJson(catalog)),
      id,
      0,
    );
    const publicResult = publicPublicationResult(validatorApi, source, catalog, id).publication;
    if (
      publicResult?.valid !== true ||
      JSON.stringify(publicResult.obligations) !== JSON.stringify(publisher.obligations)
    ) {
      fail(
        "PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED",
        `${id} did not match the public phase-aware Validator obligation projection.`,
      );
    }
    for (const obligation of publisher.obligations) kinds.add(obligation.kind);
    accepted.push(
      Object.freeze({
        id,
        sourceId: publisher.source.id,
        publisherAccepted: true,
        publicValidatorAccepted: true,
        obligations: publisher.obligations.length,
        kinds: Object.freeze([...new Set(publisher.obligations.map(({ kind }) => kind))].sort()),
      }),
    );
  }
  const sortedKinds = [...kinds].sort();
  if (JSON.stringify(sortedKinds) !== JSON.stringify(EXACT_OBLIGATION_KINDS)) {
    fail(
      "PUBLISHER_EXECUTION_OBLIGATION_FAILED",
      "The proof corpus did not cover every exact runtime-obligation kind.",
      { expected: EXACT_OBLIGATION_KINDS, actual: sortedKinds },
    );
  }
  return Object.freeze({
    accepted: Object.freeze(accepted),
    exactKinds: Object.freeze(sortedKinds),
    allEightKindsCovered: true,
    normalizedAndDeduplicated: true,
    operationOutputNotEmitted: !kinds.has("operation-output"),
    resourceOutputNotEmitted: !kinds.has("resource-output"),
  });
}

function failureCases(fixtures) {
  const unsafeOperationCatalog = cloneJson(fixtures.validCatalog);
  unsafeOperationCatalog.operations["com.example.auth/signIn"].outputSchema = {
    $ref: "#/$defs/missing",
  };

  const resourcePolicySource = cloneJson(fixtures.exampleSortable);
  const resourcePolicyCatalog = cloneJson(fixtures.exampleCatalog);
  resourcePolicyCatalog.resources["com.example.tasks/list"].policies = ["manual"];

  const predicate = cloneJson(fixtures.validSource);
  predicate.surfaces["sign-in"].root.when = { op: "gt", args: [true, 1] };

  const navigation = cloneJson(fixtures.validSource);
  navigation.surfaces["sign-in"].root.slots.default[4].on.press.unshift({
    type: "navigate",
    surface: "missing",
  });

  const missingState = cloneJson(fixtures.validSource);
  missingState.surfaces["sign-in"].root.slots.default[1].props.value = {
    $ref: "state.missing",
  };

  const format = cloneJson(fixtures.exampleStoreMap);
  format.surfaces.stores.root.slots.default[0].slots.popup[0].props.text.$format.template =
    "Selected store: {missing}";

  return Object.freeze([
    Object.freeze({
      id: "unsafe-operation-contract",
      source: fixtures.validSource,
      catalog: unsafeOperationCatalog,
      stage: "capability-contracts",
      code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
      pointer: "/0/operations/com.example.auth~1signIn/outputSchema/$ref",
      catalogPreparationFailure: true,
    }),
    Object.freeze({
      id: "resource-policy",
      source: resourcePolicySource,
      catalog: resourcePolicyCatalog,
      stage: "capability-contracts",
      code: "RESOURCE_INPUT_INVALID",
      pointer: "/surfaces/tasks/resources/tasks/policy",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "predicate-type",
      source: predicate,
      catalog: fixtures.validCatalog,
      stage: "state-and-control-flow",
      code: "PREDICATE_TYPE_MISMATCH",
      pointer: "/surfaces/sign-in/root/when/args/0",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "navigation-target",
      source: navigation,
      catalog: fixtures.validCatalog,
      stage: "state-and-control-flow",
      code: "ENTRY_NOT_FOUND",
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/surface",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "missing-state-binding",
      source: missingState,
      catalog: fixtures.validCatalog,
      stage: "binding-compatibility",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
      catalogPreparationFailure: false,
    }),
    Object.freeze({
      id: "format-placeholder",
      source: format,
      catalog: fixtures.exampleCatalog,
      stage: "binding-compatibility",
      code: "run.desen.validator/INVALID_BINDING_CONTRACT",
      pointer: "/surfaces/stores/root/slots/default/0/slots/popup/0/props/text/$format/template",
      catalogPreparationFailure: false,
    }),
  ]);
}

function stageFailureEvidence(preflight, validatorApi, fixtures) {
  return Object.freeze(
    failureCases(fixtures).map((testCase) => {
      const publicResult = publicPublicationResult(
        validatorApi,
        testCase.source,
        testCase.catalog,
        testCase.id,
      );
      const validatorFailure = testCase.catalogPreparationFailure
        ? publicResult.catalogFailure
        : publicResult.publication;
      const publicDiagnostic = validatorFailure?.diagnostics?.find(
        ({ code, pointer }) => code === testCase.code && pointer === testCase.pointer,
      );
      if (
        validatorFailure?.valid !== false ||
        publicDiagnostic === undefined ||
        (!testCase.catalogPreparationFailure && validatorFailure.phase !== testCase.stage)
      ) {
        fail(
          "PUBLISHER_EXECUTION_VALIDATOR_PREREQUISITE_FAILED",
          `${testCase.id} did not retain the expected Validator emission-site phase.`,
        );
      }

      const publisher = assertFailure(
        callPreflight(preflight, cloneJson(testCase.source), cloneJson(testCase.catalog)),
        {
          stage: testCase.stage,
          code: testCase.code,
          pointer: testCase.pointer,
          failureCode: "PUBLISHER_EXECUTION_STAGE_FAILED",
        },
        testCase.id,
      );
      return Object.freeze({
        id: testCase.id,
        validatorPhase: testCase.catalogPreparationFailure
          ? "capability-contracts"
          : validatorFailure.phase,
        publisherStage: publisher.stage,
        code: publisher.code,
        pointer: publisher.pointer,
        noPartial: publisher.noPartial,
      });
    }),
  );
}

function simultaneousPrecedenceEvidence(preflight, validatorApi, fixtures) {
  const allThree = cloneJson(fixtures.exampleSortable);
  const capabilityCatalog = cloneJson(fixtures.exampleCatalog);
  capabilityCatalog.resources["com.example.tasks/list"].policies = ["manual"];
  allThree.surfaces.tasks.root.slots.default[0].repeat.items = 42;
  allThree.surfaces.tasks.root.slots.default[0].props.text = { $ref: "state.missing" };

  const stateAndBinding = cloneJson(fixtures.exampleSortable);
  stateAndBinding.surfaces.tasks.root.slots.default[0].repeat.items = 42;
  stateAndBinding.surfaces.tasks.root.slots.default[0].props.text = {
    $ref: "state.missing",
  };

  const cases = [
    {
      id: "capability-before-state-before-binding",
      source: allThree,
      catalog: capabilityCatalog,
      stage: "capability-contracts",
      code: "RESOURCE_INPUT_INVALID",
      pointer: "/surfaces/tasks/resources/tasks/policy",
    },
    {
      id: "state-before-binding",
      source: stateAndBinding,
      catalog: fixtures.exampleCatalog,
      stage: "state-and-control-flow",
      code: "REPEAT_ITEMS_INVALID",
      pointer: "/surfaces/tasks/root/slots/default/0/repeat/items",
    },
  ];
  return Object.freeze(
    cases.map((testCase) => {
      const publicResult = publicPublicationResult(
        validatorApi,
        testCase.source,
        testCase.catalog,
        testCase.id,
      ).publication;
      if (
        publicResult?.valid !== false ||
        publicResult.phase !== testCase.stage ||
        publicResult.diagnostics?.some(({ code }) => code === "REFERENCE_UNRESOLVED")
      ) {
        fail(
          "PUBLISHER_EXECUTION_PRECEDENCE_FAILED",
          `${testCase.id} did not stop at the earliest independent Validator phase.`,
        );
      }
      const publisher = assertFailure(
        callPreflight(preflight, cloneJson(testCase.source), cloneJson(testCase.catalog)),
        {
          stage: testCase.stage,
          code: testCase.code,
          pointer: testCase.pointer,
          failureCode: "PUBLISHER_EXECUTION_PRECEDENCE_FAILED",
        },
        testCase.id,
      );
      return Object.freeze({
        id: testCase.id,
        expectedStage: testCase.stage,
        validatorPhase: publicResult.phase,
        publisherStage: publisher.stage,
        laterPhaseDiagnosticsSuppressed: true,
        noPartial: publisher.noPartial,
      });
    }),
  );
}

function exactExecutionLimits(overrides) {
  return Object.freeze({ ...PUBLISH_EXECUTION_PREFLIGHT_LIMITS, ...overrides });
}

function finiteObligationEvidence(preflight, fixtures) {
  const baseline = assertExecutionSuccess(
    callPreflight(preflight, cloneJson(fixtures.validSource), cloneJson(fixtures.validCatalog)),
    "finite obligation baseline",
    0,
  );
  const count = baseline.obligations.length;
  const pointerCodeUnits = Math.max(...baseline.obligations.map(({ pointer }) => pointer.length));
  const aggregateCodeUnits = baseline.obligations.reduce(
    (total, obligation) => total + obligationCodeUnits(obligation),
    0,
  );
  const exactCases = [
    ["count", exactExecutionLimits({ maxRuntimeValidationObligations: count })],
    ["pointer", exactExecutionLimits({ maxRuntimeObligationPointerCodeUnits: pointerCodeUnits })],
    [
      "aggregate",
      exactExecutionLimits({ maxAggregateRuntimeObligationCodeUnits: aggregateCodeUnits }),
    ],
  ];
  for (const [label, limits] of exactCases) {
    const result = assertExecutionSuccess(
      callPreflight(
        preflight,
        cloneJson(fixtures.validSource),
        cloneJson(fixtures.validCatalog),
        limits,
      ),
      `exact ${label} obligation ceiling`,
      0,
    );
    if (JSON.stringify(result.obligations) !== JSON.stringify(baseline.obligations)) {
      fail(
        "PUBLISHER_EXECUTION_LIMIT_VECTOR_FAILED",
        `Exact ${label} ceiling changed or truncated the complete obligation set.`,
      );
    }
  }

  const overCases = [
    ["count", exactExecutionLimits({ maxRuntimeValidationObligations: count - 1 })],
    [
      "pointer",
      exactExecutionLimits({ maxRuntimeObligationPointerCodeUnits: pointerCodeUnits - 1 }),
    ],
    [
      "aggregate",
      exactExecutionLimits({ maxAggregateRuntimeObligationCodeUnits: aggregateCodeUnits - 1 }),
    ],
  ];
  for (const [label, limits] of overCases) {
    const failure = assertFailure(
      callPreflight(
        preflight,
        cloneJson(fixtures.validSource),
        cloneJson(fixtures.validCatalog),
        limits,
      ),
      {
        stage: "binding-compatibility",
        code: EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        pointer: "",
        failureCode: "PUBLISHER_EXECUTION_LIMIT_VECTOR_FAILED",
      },
      `one-below ${label} obligation ceiling`,
    );
    if (failure.diagnosticCount !== 1) {
      fail(
        "PUBLISHER_EXECUTION_LIMIT_VECTOR_FAILED",
        `One-below ${label} ceiling did not replace the complete result with one redacted error.`,
      );
    }
  }

  return Object.freeze({
    defaults: PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
    exactAccepted: Object.freeze({
      obligations: count,
      pointerCodeUnits,
      aggregateCodeUnits,
    }),
    oneBelowExactRejected: Object.freeze(["count", "pointer", "aggregate"]),
    overBudgetCode: EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    overBudgetStage: "binding-compatibility",
    overBudgetPointer: "",
    obligationsNeverTruncated: true,
    failuresExposeNoPartialAuthorityOrBundle: true,
  });
}

function assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration) {
  const forbidden = [
    "EXECUTION_PREFLIGHT_AUTHORITY_INVALID_CODE",
    "EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE",
    "PUBLISH_EXECUTION_PREFLIGHT_LIMITS",
    "PublishExecutionPreflightLimits",
    "PublishExecutionPreflightResult",
    "PublishExecutionPreflightSuccess",
    "normalizePublishExecutionPreflightLimits",
    "preflightPublishExecution",
  ];
  const runtimeExports = Object.keys(publicApi).sort();
  if (
    JSON.stringify(runtimeExports) !== JSON.stringify(HISTORICAL_ROOT_RUNTIME_EXPORTS) &&
    JSON.stringify(runtimeExports) !== JSON.stringify(SUCCESSOR_ROOT_RUNTIME_EXPORTS)
  ) {
    fail(
      "PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED",
      "Publisher root runtime API is neither the task-time surface nor its approved publication successor.",
      {
        historical: HISTORICAL_ROOT_RUNTIME_EXPORTS,
        successor: SUCCESSOR_ROOT_RUNTIME_EXPORTS,
        actual: runtimeExports,
      },
    );
  }
  if (
    forbidden.some((name) => runtimeExports.includes(name)) ||
    forbidden.some((name) => publicDeclaration.includes(name))
  ) {
    fail(
      "PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED",
      "Package-private execution preflight leaked through the Publisher root API.",
    );
  }
  if (
    publisherPackage?.exports === null ||
    typeof publisherPackage?.exports !== "object" ||
    Object.keys(publisherPackage.exports).some((key) => key !== ".")
  ) {
    fail(
      "PUBLISHER_EXECUTION_PUBLIC_API_EXPOSED",
      "Publisher package exports expose a partial execution-preflight subpath.",
    );
  }
  return Object.freeze({
    rootRuntimeExports: HISTORICAL_ROOT_RUNTIME_EXPORTS,
    preflightRuntimeExported: false,
    preflightTypeExported: false,
    preflightSubpathExported: false,
    packagePrivateDistImportUsedByProof: EXECUTION_BUILD_RELATIVE_PATH,
  });
}

function auditTypeScriptBoundary(source, relativePath, allowedImports, kind) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    kind === "declaration" ? ts.ScriptKind.TS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT",
      `${kind} no longer parses as TypeScript for target-boundary inspection.`,
      {
        diagnostics: sourceFile.parseDiagnostics.map(({ messageText }) => String(messageText)),
      },
    );
  }

  const imports = [];
  const ambientRuntimeDeclarations = new Set();
  const diagnosticSuppressions = new Set();
  const forbiddenIdentifiers = new Set();
  const tripleSlashReferences = new Set();
  const directLoaderForms = new Set();

  for (const directive of sourceFile.commentDirectives ?? []) {
    diagnosticSuppressions.add(
      directive.type === ts.CommentDirectiveType.ExpectError ? "@ts-expect-error" : "@ts-ignore",
    );
  }
  if (sourceFile.checkJsDirective?.enabled === false) diagnosticSuppressions.add("@ts-nocheck");
  if (sourceFile.referencedFiles.length > 0) tripleSlashReferences.add("path");
  if (sourceFile.typeReferenceDirectives.length > 0) tripleSlashReferences.add("types");
  if (sourceFile.libReferenceDirectives.length > 0) tripleSlashReferences.add("lib");
  if (sourceFile.amdDependencies.length > 0 || sourceFile.amdModuleName !== undefined) {
    tripleSlashReferences.add("amd");
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        directLoaderForms.add("non-literal static module specifier");
      } else {
        imports.push(node.moduleSpecifier.text);
      }
    }
    if (ts.isImportEqualsDeclaration(node)) directLoaderForms.add("import-equals");
    if (ts.isImportTypeNode(node)) directLoaderForms.add("import-type-expression");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      directLoaderForms.add("dynamic import");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "require" || node.expression.text === "eval")
    ) {
      directLoaderForms.add(node.expression.text);
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      directLoaderForms.add("Function");
    }
    if (
      (ts.isPropertyAccessExpression(node) && node.name.text === "constructor") ||
      (ts.isElementAccessExpression(node) &&
        (ts.isStringLiteral(node.argumentExpression) ||
          ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) &&
        node.argumentExpression.text === "constructor")
    ) {
      directLoaderForms.add("dynamic constructor access");
    }
    if (
      kind === "source" &&
      node.modifiers?.some(
        ({ kind: modifierKind }) => modifierKind === ts.SyntaxKind.DeclareKeyword,
      )
    ) {
      if (ts.isVariableStatement(node)) ambientRuntimeDeclarations.add("variable");
      if (ts.isFunctionDeclaration(node)) ambientRuntimeDeclarations.add("function");
      if (ts.isClassDeclaration(node)) ambientRuntimeDeclarations.add("class");
      if (ts.isEnumDeclaration(node)) ambientRuntimeDeclarations.add("enum");
      if (ts.isModuleDeclaration(node)) ambientRuntimeDeclarations.add("module");
    }
    if (ts.isIdentifier(node) && FORBIDDEN_PLATFORM_IDENTIFIERS.has(node.text)) {
      forbiddenIdentifiers.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  imports.sort();

  if (
    imports.some((specifier) => !allowedImports.includes(specifier)) ||
    ambientRuntimeDeclarations.size > 0 ||
    diagnosticSuppressions.size > 0 ||
    forbiddenIdentifiers.size > 0 ||
    tripleSlashReferences.size > 0 ||
    directLoaderForms.size > 0
  ) {
    fail(
      "PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT",
      `${kind} acquired a disallowed static edge or direct platform/loader form.`,
      {
        ambientRuntimeDeclarations: [...ambientRuntimeDeclarations].sort(),
        diagnosticSuppressions: [...diagnosticSuppressions].sort(),
        directLoaderForms: [...directLoaderForms].sort(),
        forbiddenIdentifiers: [...forbiddenIdentifiers].sort(),
        imports,
        tripleSlashReferences: [...tripleSlashReferences].sort(),
      },
    );
  }
  return Object.freeze({
    kind,
    imports: Object.freeze(imports),
    unexpectedStaticImports: Object.freeze([]),
    enumeratedPlatformIdentifiersObserved: Object.freeze([]),
    directLoaderFormsObserved: Object.freeze([]),
    ambientRuntimeDeclarationsObserved: Object.freeze([]),
    diagnosticSuppressionDirectivesObserved: Object.freeze([]),
    tripleSlashReferenceDirectivesObserved: Object.freeze([]),
  });
}

function assertTargetNeutralBoundary(executionSource, executionDeclaration, publisherPackage) {
  const sourceAudit = auditTypeScriptBoundary(
    executionSource,
    EXECUTION_SOURCE_RELATIVE_PATH,
    ALLOWED_SOURCE_IMPORTS,
    "source",
  );
  const declarationAudit = auditTypeScriptBoundary(
    executionDeclaration,
    EXECUTION_DECLARATION_RELATIVE_PATH,
    ALLOWED_DECLARATION_IMPORTS,
    "declaration",
  );
  const dependencies = Object.keys(publisherPackage?.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(["@desen/protocol", "@desen/validator"])) {
    fail(
      "PUBLISHER_EXECUTION_TARGET_BOUNDARY_DRIFT",
      "Publisher production dependencies are no longer target-neutral.",
    );
  }
  return Object.freeze({
    source: sourceAudit,
    declaration: declarationAudit,
    productionDependencies: Object.freeze(dependencies),
    inspectionMethod: "TypeScript AST direct-form source/declaration audit",
    inspectionScope: Object.freeze([
      "static import and re-export specifiers",
      "exact production dependency names",
      "enumerated direct platform identifiers",
      "direct dynamic-loader and constructor forms",
      "ambient runtime value declarations",
      "TypeScript diagnostic-suppression directives",
      "triple-slash reference directives",
    ]),
    exhaustiveJavaScriptSandboxClaim: false,
  });
}

async function verifyPrerequisitePins(enabled, prerequisiteBytes) {
  if (
    prerequisiteBytes !== undefined &&
    (prerequisiteBytes === null ||
      typeof prerequisiteBytes !== "object" ||
      Array.isArray(prerequisiteBytes))
  ) {
    fail(
      "PUBLISHER_EXECUTION_OPTIONS_INVALID",
      "Prerequisite byte overrides must be a path-keyed object.",
    );
  }
  const evidence = [];
  for (const prerequisite of PREREQUISITES) {
    const injected = prerequisiteBytes?.[prerequisite.path];
    const bytes =
      injected === undefined ? await readRegularBytes(prerequisite.path) : Buffer.from(injected);
    const actual = sha256(bytes);
    if (enabled && actual !== prerequisite.sha256) {
      fail(
        "PUBLISHER_EXECUTION_PREREQUISITE_DRIFT",
        `Pinned prerequisite drifted: ${prerequisite.task}`,
        { expected: prerequisite.sha256, actual },
      );
    }
    evidence.push(
      Object.freeze({
        ...prerequisite,
        verifiedSha256: actual,
        matchesPin: actual === prerequisite.sha256,
      }),
    );
  }
  return Object.freeze(evidence);
}

async function fileInventory(compatibilitySourceBytes) {
  const inventory = [];
  for (const relativePath of [...new Set(TRACKED_PATHS)].sort()) {
    const historical = HISTORICAL_TRACKED_RECEIPTS[relativePath];
    const approvedCurrent = APPROVED_CURRENT_M05_COMPATIBILITY_RECEIPTS[relativePath];
    if (approvedCurrent !== undefined) {
      const currentBytes = SAFE_OBJECT_HAS_OWN(compatibilitySourceBytes, relativePath)
        ? compatibilitySourceBytes[relativePath]
        : await readRegularBytes(relativePath);
      const currentSha256 = sha256(currentBytes);
      if (
        currentBytes.byteLength !== approvedCurrent.bytes ||
        currentSha256 !== approvedCurrent.sha256
      ) {
        fail(
          "PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT",
          "The current M05 compatibility source is not the exact approved successor.",
          {
            path: relativePath,
            expectedBytes: approvedCurrent.bytes,
            expectedSha256: approvedCurrent.sha256,
            actualBytes: currentBytes.byteLength,
            actualSha256: currentSha256,
          },
        );
      }
      if (historical === undefined) {
        fail(
          "PUBLISHER_EXECUTION_COMPATIBILITY_DRIFT",
          "The approved M05 successor lost its task-time historical projection.",
          { path: relativePath },
        );
      }
      inventory.push(Object.freeze({ path: relativePath, ...historical }));
      continue;
    }
    if (historical !== undefined) {
      inventory.push(Object.freeze({ path: relativePath, ...historical }));
      continue;
    }
    const bytes = await readRegularBytes(relativePath);
    inventory.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }),
    );
  }
  return Object.freeze(inventory);
}

async function testInventory() {
  const [publisherTest, typeTest, validatorBindingTest, validatorExecutionTest, rootTest] =
    await Promise.all([
      readRegularBytes("packages/publisher/test/execution-preflight.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/publisher/test/execution-preflight.types.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/validator/test/binding-contracts.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("packages/validator/test/execution-contracts.test.ts").then((bytes) =>
        bytes.toString("utf8"),
      ),
      readRegularBytes("tests/publisher-execution-preflight.test.mjs").then((bytes) =>
        bytes.toString("utf8"),
      ),
    ]);
  return Object.freeze({
    publisherRuntimeCases: (publisherTest.match(/^\s*it\("/gmu) ?? []).length,
    compilerNegativeCases: (typeTest.match(/@ts-expect-error/gu) ?? []).length,
    validatorBindingCases: (validatorBindingTest.match(/^\s*it\("/gmu) ?? []).length,
    validatorExecutionCases: (validatorExecutionTest.match(/^\s*it\("/gmu) ?? []).length,
    rootMutationCases: (rootTest.match(/^test\("/gmu) ?? []).length,
  });
}

function countExactOccurrences(text, value) {
  return text.split(value).length - 1;
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_EXECUTION_PROOF_DOCUMENT_INVALID",
      "The execution-preflight proof document must be text.",
    );
  }
  const expectedHash = `sha256:${artifactSha256}`;
  const digestPins = proofDocument.match(/sha256:[0-9a-f]{64}/gu) ?? [];
  if (
    countExactOccurrences(proofDocument, `\`${ARTIFACT_RELATIVE_PATH}\``) !== 1 ||
    countExactOccurrences(proofDocument, `\`${expectedHash}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expectedHash ||
    proofDocument.includes("PENDING_M06_T05_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_EXECUTION_PROOF_DOCUMENT_DRIFT",
      "The execution-preflight proof document does not uniquely pin the artifact and hash.",
      { expectedArtifactPath: ARTIFACT_RELATIVE_PATH, expectedHash },
    );
  }
}

async function defaultFixtures() {
  return Object.freeze(
    Object.fromEntries(
      await Promise.all(
        Object.entries(FIXTURE_PATHS).map(async ([key, relativePath]) => [
          key,
          await readJson(relativePath),
        ]),
      ),
    ),
  );
}

function assertFixtureIdentity(fixtures) {
  for (const [source, catalog] of [
    [fixtures.validSource, fixtures.validCatalog],
    [fixtures.exampleSortable, fixtures.exampleCatalog],
    [fixtures.exampleStoreMap, fixtures.exampleCatalog],
  ]) {
    const requirement = source?.catalogs?.[0];
    if (
      !source?.id ||
      !requirement ||
      requirement.id !== catalog?.id ||
      requirement.version !== catalog?.version ||
      requirement.target !== catalog?.target ||
      typeof catalog?.packageDigest !== "string"
    ) {
      fail(
        "PUBLISHER_EXECUTION_FIXTURE_DRIFT",
        "A tracked Source/Catalog pair no longer carries the expected exact tuple.",
      );
    }
  }
}

/**
 * Builds deterministic M06-T05 evidence from the exact T04, T10, and T11 prerequisites and the
 * shipped package-private Publisher execution preflight.
 */
export async function buildPublisherExecutionPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const compatibilitySourceBytes = captureCompatibilitySourceBytes(
    options.compatibilitySourceBytes,
  );
  const [
    fixturesDefault,
    publisherPackageDefault,
    executionSourceDefault,
    executionDeclarationDefault,
    publicDeclarationDefault,
  ] = await Promise.all([
    defaultFixtures(),
    readJson(PUBLISHER_PACKAGE_RELATIVE_PATH),
    readRegularBytes(EXECUTION_SOURCE_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(EXECUTION_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PUBLIC_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
  ]);

  const fixtures = cloneJson(options.fixtures ?? fixturesDefault);
  const publisherPackage = cloneJson(options.publisherPackage ?? publisherPackageDefault);
  const executionSource = options.executionSource ?? executionSourceDefault;
  const executionDeclaration = options.executionDeclaration ?? executionDeclarationDefault;
  const publicDeclaration = options.publicDeclaration ?? publicDeclarationDefault;
  const preflight = options.preflight ?? preflightPublishExecution;
  const validatorApi = options.validatorApi ?? validatorPublicApi;
  const publicApi = options.publicApi ?? publisherPublicApi;
  if (
    typeof preflight !== "function" ||
    typeof executionSource !== "string" ||
    typeof executionDeclaration !== "string" ||
    typeof publicDeclaration !== "string" ||
    typeof validatorApi?.validateDesenExecutionCatalogSet !== "function" ||
    typeof validatorApi?.validatePreparedDesenSourceReferences !== "function" ||
    typeof validatorApi?.validateDesenPreparedSourcePublicationContracts !== "function"
  ) {
    fail("PUBLISHER_EXECUTION_OPTIONS_INVALID", "Evidence overrides have invalid types.");
  }

  assertFixtureIdentity(fixtures);
  const prerequisites = await verifyPrerequisitePins(
    options.verifyPrerequisites !== false,
    options.prerequisiteBytes,
  );
  const exactAuthority = exactAuthorityEvidence(
    preflight,
    validatorApi,
    fixtures.validSource,
    fixtures.validCatalog,
  );
  const obligationEvidence = fixtureAndObligationEvidence(preflight, validatorApi, fixtures);
  const stageFailures = stageFailureEvidence(preflight, validatorApi, fixtures);
  const simultaneousPrecedence = simultaneousPrecedenceEvidence(preflight, validatorApi, fixtures);
  const finiteProfile = finiteObligationEvidence(preflight, fixtures);
  const apiPrivacy = assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration);
  const targetNeutralBoundary = assertTargetNeutralBoundary(
    executionSource,
    executionDeclaration,
    publisherPackage,
  );

  for (const fragment of [
    "PublishExecutionPreflightSuccess",
    "DesenValidatedExecutionCatalogSet",
    "DesenExecutionContractObligation",
    "PublishExecutionPreflightResult",
    "PublishWarningDiagnostic",
  ]) {
    if (!executionDeclaration.includes(fragment)) {
      fail(
        "PUBLISHER_EXECUTION_DECLARATION_DRIFT",
        "Built package-private declarations no longer document exact execution authority.",
        { missing: fragment },
      );
    }
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.execution-preflight-proof.v1",
    task: "M06-T05",
    result: "PASS",
    summary:
      "The built package-private Publisher execution preflight retains exact M06-T04 authority, stops static publication failures at stages 8, 9, or 10 by Validator emission-site provenance, and hands off the complete bounded eight-kind runtime-obligation vocabulary without emitting a Bundle.",
    prerequisites,
    fixtures: Object.freeze({
      paths: FIXTURE_PATHS,
      accepted: obligationEvidence.accepted,
    }),
    claims: Object.freeze({
      exactNonterminalAuthority: exactAuthority,
      phaseAwareFailureMatrix: stageFailures,
      simultaneousErrorPrecedence: simultaneousPrecedence,
      runtimeObligations: Object.freeze({
        exactKinds: obligationEvidence.exactKinds,
        allEightKindsCovered: obligationEvidence.allEightKindsCovered,
        normalizedAndDeduplicated: obligationEvidence.normalizedAndDeduplicated,
        operationOutputNotEmitted: obligationEvidence.operationOutputNotEmitted,
        resourceOutputNotEmitted: obligationEvidence.resourceOutputNotEmitted,
        completeNotSampled: true,
      }),
      exactAndOverObligationCeilings: finiteProfile,
      failuresExposeNoPartialAuthorityOrBundle: true,
      rootApiPrivacy: apiPrivacy,
      targetNeutralDependencyBoundary: targetNeutralBoundary,
      deterministicEvidenceBuild: Object.freeze({
        canonicalJsonFormatting: "Prettier JSON parser, LF",
        trackedFileInventorySortedAndUnique: true,
        builtJavaScriptByteTracked: EXECUTION_BUILD_RELATIVE_PATH,
        builtDeclarationByteTracked: EXECUTION_DECLARATION_RELATIVE_PATH,
        repeatedBuildCheckedByRootEvidence: true,
        atomicWriter: "scripts/lib/atomic-proof-artifact.mjs",
      }),
    }),
    pipelineOwnership: Object.freeze({
      traces: Object.freeze(["PIPE-032", "PIPE-033", "PIPE-034"]),
      publicationStages: Object.freeze([
        Object.freeze({ ordinal: 8, stage: "capability-contracts", status: "COMPLETE" }),
        Object.freeze({ ordinal: 9, stage: "state-and-control-flow", status: "COMPLETE" }),
        Object.freeze({ ordinal: 10, stage: "binding-compatibility", status: "COMPLETE" }),
      ]),
      exactPrecedence: EXECUTION_STAGES,
      includes: Object.freeze([
        "resource and operation schema safety plus statically known receiving contracts",
        "state, predicate, repeat, action target, and control-flow compatibility",
        "lexical, format, resource-lifecycle, and operation-lifecycle binding compatibility",
        "complete finite runtime-obligation handoff for eight exact kinds",
      ]),
      rationale:
        "Validator diagnostics retain emission-site provenance, so the Publisher selects the earliest normative phase without inferring a stage from diagnostic code or pointer text.",
    }),
    nonclaims: Object.freeze([
      "M06-T05 remains package-private and nonterminal; it does not expose a public publish function or emit a Bundle.",
      "Runtime obligations record future receiving-schema checks; M06-T05 does not resolve, execute, or discharge dynamic values.",
      "Operation outputs, resource outputs, public errors, and host settlements are validated by their owning runtime boundaries rather than emitted as Source obligations.",
      "The finite Publisher output check does not claim a shared incremental allocation budget inside the cumulative Validator walk.",
      "M06-T05 does not preserve extensions or source-node trace identity, normalize Source data, remove authoring data, calculate digests, pin Bundle tuples, validate a Bundle, calculate a revision, or emit a Bundle.",
      "The target-boundary source/declaration audit is not a JavaScript sandbox and does not claim exhaustive detection of intentionally obfuscated reflection, metaprogramming, or runtime code generation.",
      "M06-T05 performs no network discovery, package download, activation, rendering, signing, npm publication, or deployment.",
    ]),
    tests: await testInventory(),
    trackedFiles: await fileInventory(compatibilitySourceBytes),
    reproduction: Object.freeze([
      "pnpm --filter @desen/validator build",
      "pnpm --filter @desen/validator test:binding-contracts",
      "pnpm --filter @desen/validator test:execution-contracts",
      "pnpm --filter @desen/publisher build",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:execution-preflight",
      "node scripts/generate-publisher-execution-preflight-proof.mjs",
      "node scripts/verify-publisher-execution-preflight.mjs",
      "node --test tests/publisher-execution-preflight.test.mjs",
    ]),
  });

  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
    endOfLine: "lf",
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

/** Verifies tracked or injected evidence against a fresh deterministic build. */
export async function verifyPublisherExecutionPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  rejectAuthoritativeCompatibilityOverride(options);
  const built = await buildPublisherExecutionPreflightEvidence(options);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularBytes(ARTIFACT_RELATIVE_PATH)
      : Buffer.from(options.artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail(
      "PUBLISHER_EXECUTION_ARTIFACT_DRIFT",
      "Tracked execution-preflight evidence differs from a fresh deterministic build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256: sha256(artifactBytes),
      },
    );
  }
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularBytes(PROOF_DOCUMENT_RELATIVE_PATH).then((bytes) => bytes.toString("utf8"))
      : options.proofDocument;
  assertProofDocumentPin(proofDocument, built.artifactSha256);
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    acceptedFixtures: built.artifact.fixtures.accepted.length,
    obligationKinds: built.artifact.claims.runtimeObligations.exactKinds.length,
    stageFailureVectors: built.artifact.claims.phaseAwareFailureMatrix.length,
    simultaneousPrecedenceVectors: built.artifact.claims.simultaneousErrorPrecedence.length,
    finiteLimitVectors: 6,
    trackedFiles: built.artifact.trackedFiles.length,
    tests: built.artifact.tests,
    proofDocumentPinned: true,
  });
}

/** Atomically writes exact deterministic M06-T05 evidence bytes. */
export async function writePublisherExecutionPreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  rejectAuthoritativeCompatibilityOverride(options);
  const built = await buildPublisherExecutionPreflightEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_EXECUTION_PREFLIGHT_ARTIFACT_PATH;
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    ...(options.beforeAtomicRename === undefined
      ? {}
      : { beforeAtomicRename: options.beforeAtomicRename }),
  });
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes,
  });
}
