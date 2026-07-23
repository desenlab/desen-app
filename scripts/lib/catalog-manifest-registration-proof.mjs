import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as nodeTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { canonicalizeJson } from "../../packages/protocol/src/canonicalization.ts";
import {
  DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
  verifyProtocolValidatorDiagnosticMicroVectors,
} from "./protocol-validator-diagnostic-micro-vectors-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CATALOG_API_URL = new URL("../../packages/catalog-sdk/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the cumulative deterministic M03-T01 through M03-T03 evidence artifact. */
export const DEFAULT_CATALOG_MANIFEST_REGISTRATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json",
);

/** Absolute path to the reviewed protocol trace ledger used by M03-T01 through M03-T03. */
export const DEFAULT_CATALOG_MANIFEST_REGISTRATION_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "createCatalogManifest",
  "deriveComponentInspectorControls",
  "registerBehavior",
  "registerComponent",
  "registerOperation",
  "registerResource",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "BehaviorManifest",
  "ComponentInspectorControl",
  "ComponentInspectorControlKind",
  "ComponentInspectorControlPlan",
  "ComponentInspectorFallbackReason",
  "ComponentManifest",
  "ComponentPropsOf",
  "CreateCatalogManifestInput",
  "ImmutableJson",
  "JsonInput",
  "JsonPrimitive",
  "JsonSchemaValue",
  "JsonValue",
  "OperationManifest",
  "RegisterBehaviorInput",
  "RegisterComponentInput",
  "RegisterOperationInput",
  "RegisterResourceInput",
  "RegisteredBehavior",
  "RegisteredComponent",
  "RegisteredOperation",
  "RegisteredResource",
  "ResourceManifest",
]);
const EXPECTED_COMPONENT_FIELDS = Object.freeze([
  "authoring",
  "category",
  "commands",
  "deprecated",
  "description",
  "events",
  "extensions",
  "propsSchema",
  "replacement",
  "slots",
  "styleParts",
  "visualStates",
]);
const EXPECTED_BEHAVIOR_FIELDS = Object.freeze([
  "attachTo",
  "authoring",
  "category",
  "commands",
  "composition",
  "deprecated",
  "description",
  "events",
  "extensions",
  "propsSchema",
  "replacement",
  "slots",
  "styleParts",
  "visualStates",
]);
const EXPECTED_OPERATION_FIELDS = Object.freeze([
  "authoring",
  "deprecated",
  "description",
  "effect",
  "errors",
  "extensions",
  "inputSchema",
  "outputSchema",
  "replacement",
]);
const EXPECTED_RESOURCE_FIELDS = Object.freeze([
  "authoring",
  "cacheHints",
  "deprecated",
  "description",
  "errors",
  "extensions",
  "inputSchema",
  "outputSchema",
  "policies",
  "replacement",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "conformanceRules",
    id: "C-006",
    section: "7.2",
    owners: Object.freeze(["M03-T03", "M09-T02"]),
    tests: Object.freeze(["M03-T09", "M10-T01"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-013",
    section: "6.1.3",
    owners: Object.freeze(["M03-T01", "M03-T10"]),
    tests: Object.freeze(["M03-T09", "M03-T10"]),
  }),
  Object.freeze({
    collection: "conformanceRules",
    id: "C-018",
    section: "7.4",
    owners: Object.freeze(["M03-T02", "M03-T08"]),
    tests: Object.freeze(["M03-T09", "M10-T04"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-071",
    section: "19.3",
    owners: Object.freeze(["M02-T09", "M03-T02"]),
    tests: Object.freeze(["M02-T13", "M11-T14"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-072",
    section: "19.4",
    owners: Object.freeze(["M03-T02", "M05-T04"]),
    tests: Object.freeze(["M03-T09", "M11-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-084",
    section: "21.2",
    owners: Object.freeze(["M03-T01", "M03-T03"]),
    tests: Object.freeze(["M03-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-087",
    section: "21.7",
    owners: Object.freeze(["M03-T03", "M09-T05", "M09-T06"]),
    tests: Object.freeze(["M03-T09", "M10-T06"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-089",
    section: "22.1",
    owners: Object.freeze(["M03-T02", "M04-T01", "M04-T09"]),
    tests: Object.freeze(["M03-T09", "M04-T16"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-090",
    section: "22.2",
    owners: Object.freeze(["M03-T02", "M04-T08", "M12-T03"]),
    tests: Object.freeze(["M03-T09", "M12-T03"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-092",
    section: "22.4",
    owners: Object.freeze(["M03-T02", "M03-T08", "M12-T03"]),
    tests: Object.freeze(["M10-T04", "M12-T03"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-096",
    section: "23.4",
    owners: Object.freeze(["M03-T03", "M09-T05", "M09-T06"]),
    tests: Object.freeze(["M09-T06"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-149",
    section: "19",
    owners: Object.freeze(["M03-T02", "M05-T04"]),
    tests: Object.freeze(["M11-T12"]),
  }),
]);
const EXPECTED_SCHEMA_FAMILIES = Object.freeze([
  Object.freeze({
    id: "SC-033",
    summary: "Catalog authoring metadata",
    expectedConstraints: 1,
    semanticOwners: Object.freeze(["M03-T03"]),
  }),
  Object.freeze({
    id: "SC-056",
    summary: "Catalog authoring contract",
    expectedConstraints: 33,
    semanticOwners: Object.freeze(["M03-T03"]),
  }),
]);
const EXPECTED_SOURCE_PATHS = Object.freeze([
  "packages/catalog-sdk/src/behavior-registration.ts",
  "packages/catalog-sdk/src/catalog-manifest.ts",
  "packages/catalog-sdk/src/component-inspector-control.ts",
  "packages/catalog-sdk/src/component-registration.ts",
  "packages/catalog-sdk/src/index.ts",
  "packages/catalog-sdk/src/inert-json.ts",
  "packages/catalog-sdk/src/operation-registration.ts",
  "packages/catalog-sdk/src/registration-core.ts",
  "packages/catalog-sdk/src/resource-registration.ts",
  "packages/catalog-sdk/src/schema-type-derivation.ts",
]);
const EXPECTED_DECLARATION_PATHS = Object.freeze([
  "packages/catalog-sdk/dist/behavior-registration.d.ts",
  "packages/catalog-sdk/dist/catalog-manifest.d.ts",
  "packages/catalog-sdk/dist/component-inspector-control.d.ts",
  "packages/catalog-sdk/dist/component-registration.d.ts",
  "packages/catalog-sdk/dist/index.d.ts",
  "packages/catalog-sdk/dist/inert-json.d.ts",
  "packages/catalog-sdk/dist/operation-registration.d.ts",
  "packages/catalog-sdk/dist/registration-core.d.ts",
  "packages/catalog-sdk/dist/resource-registration.d.ts",
  "packages/catalog-sdk/dist/schema-type-derivation.d.ts",
]);
const EXPECTED_DISTRIBUTION_PATHS = Object.freeze([
  "packages/catalog-sdk/dist/behavior-registration.d.ts",
  "packages/catalog-sdk/dist/behavior-registration.js",
  "packages/catalog-sdk/dist/catalog-manifest.d.ts",
  "packages/catalog-sdk/dist/catalog-manifest.js",
  "packages/catalog-sdk/dist/component-inspector-control.d.ts",
  "packages/catalog-sdk/dist/component-inspector-control.js",
  "packages/catalog-sdk/dist/component-registration.d.ts",
  "packages/catalog-sdk/dist/component-registration.js",
  "packages/catalog-sdk/dist/index.d.ts",
  "packages/catalog-sdk/dist/index.js",
  "packages/catalog-sdk/dist/inert-json.d.ts",
  "packages/catalog-sdk/dist/inert-json.js",
  "packages/catalog-sdk/dist/operation-registration.d.ts",
  "packages/catalog-sdk/dist/operation-registration.js",
  "packages/catalog-sdk/dist/registration-core.d.ts",
  "packages/catalog-sdk/dist/registration-core.js",
  "packages/catalog-sdk/dist/resource-registration.d.ts",
  "packages/catalog-sdk/dist/resource-registration.js",
  "packages/catalog-sdk/dist/schema-type-derivation.d.ts",
  "packages/catalog-sdk/dist/schema-type-derivation.js",
]);
const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "docs/plan/PROTOCOL-FINDINGS.md",
  "packages/catalog-sdk/package.json",
  "packages/catalog-sdk/README.md",
  "tsconfig.base.json",
  "packages/catalog-sdk/tsconfig.json",
  "packages/catalog-sdk/tsconfig.build.json",
  "packages/catalog-sdk/test/catalog-manifest-registration.test.ts",
  "packages/catalog-sdk/test/component-inspector-control.test.ts",
  "packages/catalog-sdk/test/public-api.types.ts",
  "packages/catalog-sdk/test/schema-type-derivation.types.ts",
  "scripts/lib/catalog-manifest-registration-proof.mjs",
  "scripts/generate-catalog-manifest-registration-proof.mjs",
  "scripts/verify-catalog-manifest-registration.mjs",
  "scripts/verify-boundary-fixtures.mjs",
  "tests/catalog-manifest-registration.test.mjs",
  "tests/boundaries/README.md",
  "tests/boundaries/fixtures/catalog-sdk-imports-runtime-react/packages/catalog-sdk/src/index.ts",
  "tests/boundaries/fixtures/catalog-sdk-imports-runtime-react/packages/runtime-react/src/index.ts",
]);
const EXPECTED_PACKAGE_TEST_TITLES = Object.freeze([
  "preserves the complete manifest as detached, deeply frozen JSON data",
  "normalizes object key order deterministically while preserving array order",
  "rejects unknown wrapper fields and non-JSON values without invoking accessors",
  "preserves dangerous-looking extension keys as opaque JSON members",
  "preserves every category contract as detached, deeply frozen JSON data",
  "normalizes object key order while preserving behavior, error, and policy array order",
  "rejects executable wrapper fields for every new manifest category",
  "rejects non-JSON nested values without invoking accessors",
  "preserves every schema-authoritative field without executable bindings",
  "preserves the component-only call shape with empty optional-category maps",
  "builds all four exact capability maps without retaining registrations",
  "rejects duplicate ids even when their manifests are identical",
  "rejects duplicate ids within every new category",
  "rejects capability ids reused across different Catalog categories",
  "treats capability ids as exact, case-sensitive strings",
  "stores prototype-looking map keys as inert data in every category",
  "rejects unknown Catalog builder fields and forged registration records",
  "derives canonical primitive controls, requiredness, pointers, and enum order",
  "derives recursively closed object groups and RFC 6901-escaped pointers",
  "retains complete authoring data while treating misleading hints as opaque sidecars",
  "keeps every unsupported schema subtree visible through a reasoned fallback",
  "retains supported constraint metadata in the authoritative schema snapshot",
  "does not drop supported siblings when one child requires structured JSON",
  "uses canonical property order even for integer-like names",
  "keeps a whole-object enum visible through the root fallback",
  "falls back instead of hiding required names that have no declared property",
  "uses one root fallback when the root schema is not an explicit closed object",
  "accepts exactly 16 control levels and replaces deeper output with a root limit fallback",
  "accepts exactly 512 controls and returns no partial output at 513",
  "returns an exact detached and deeply frozen snapshot without changing the caller",
  "rejects accessors and hostile non-JSON values without invoking getters",
  "handles prototype-like property and hint names without prototype pollution",
  "is deterministic across object insertion order while preserving semantic array order",
]);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T01 through M03-T03 evidence",
  "two independent Catalog registration evidence builds are byte-identical",
  "rejects stale or one-byte-tampered evidence",
  "rejects direct prose and conformance trace ownership drift",
  "rejects a forged mutable registration implementation",
  "checks every successful registration output for deep immutability",
  "checks every new-category registration output for deep immutability",
  "rejects descriptor-only mutation of caller-owned nested input",
  "rejects caller-owned manifest aliases in every new category map",
  "rejects identity-based duplicate checks in every category",
  "rejects a forged composer that drops any new category map",
  "rejects a forged composer that accepts cross-category duplicate ids",
  "rejects Catalog field substitution by a forged composer",
  "rejects noncanonical property storage order in registration output",
  "rejects a prototype-laundered exotic registration output",
  "rejects a framework import injected into neutral catalog source",
  "rejects a dynamic implementation import injected into neutral catalog source",
  "rejects a computed dynamic import injected into neutral catalog source",
  "rejects an undeclared public type export in source and declarations",
  "rejects an exported namespace or ambient declaration",
  "rejects triple-slash ambient reference directives",
  "rejects an unaudited source file added to the shipped package",
  "derives and enforces the executable test inventory",
  "rejects skipped package suites in the test inventory",
  "rejects option-skipped root tests in the test inventory",
  "rejects fake negative-case labels outside compiler directives",
  "rejects missing root command wiring",
  "rejects early-exit command wiring",
  "writes byte-identical evidence through the safe atomic writer",
  "rejects a symlinked evidence destination before writing",
  "rejects replacement of the reserved temporary file",
  "rejects symlink replacement of the reserved temporary file",
  "rejects same-inode overwrite of the reserved temporary file",
  "rejects schema-authority drift in inspector controls",
  "rejects omission of structured-JSON inspector fallbacks",
  "rejects mutable inspector plans",
  "rejects inspector retention of caller-owned manifest aliases",
  "rejects inspector pointer substitution",
  "rejects partial inspector output beyond derivation limits",
  "rejects hostile inspector input acceptance",
  "rejects M03-T03 schema-family trace drift",
  "rejects skipped inspector fallback matrix",
  "rejects fake M03-T03 negative-case labels outside compiler directives",
]);
const EXPECTED_TYPE_NEGATIVE_CASES = Object.freeze([
  ...Array.from({ length: 21 }, (_, index) => `M03-T01-N${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 32 }, (_, index) => `M03-T02-N${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 18 }, (_, index) => `M03-T03-N${String(index + 1).padStart(2, "0")}`),
]);
const EXPECTED_COMMANDS = Object.freeze({
  generate: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "pnpm --filter @desen/catalog-sdk typecheck",
    "node scripts/generate-catalog-manifest-registration-proof.mjs",
  ]),
  verify: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "pnpm --filter @desen/catalog-sdk typecheck",
    "node scripts/verify-catalog-manifest-registration.mjs",
  ]),
  test: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "pnpm --filter @desen/catalog-sdk typecheck",
    "pnpm --filter @desen/catalog-sdk test:manifest-registration",
    "pnpm --filter @desen/catalog-sdk test:manifest-derivation",
    "node --test tests/catalog-manifest-registration.test.mjs",
  ]),
});
const EXPECTED_ROOT_TEST_COMMAND = Object.freeze([
  "pnpm test:protocol-snapshot",
  "pnpm test:protocol-traceability",
  "pnpm test:protocol-types",
  "pnpm test:protocol-canonicalization",
  "pnpm test:protocol-diagnostics",
  "pnpm test:protocol-structural-validation",
  "pnpm test:protocol-semantic-foundation",
  "pnpm test:protocol-component-contracts",
  "pnpm test:protocol-interaction-contracts",
  "pnpm test:protocol-binding-contracts",
  "pnpm test:protocol-execution-contracts",
  "pnpm test:protocol-official-suite-parity",
  "pnpm test:protocol-validator-diagnostic-micro-vectors",
  "pnpm test:catalog-manifest-registration",
  "pnpm test:web-react-package-digest",
  "turbo run test",
]);
const EXPECTED_ROOT_CHECK_COMMAND = Object.freeze([
  "pnpm format:check",
  "pnpm verify:protocol-snapshot",
  "pnpm verify:protocol-traceability",
  "pnpm verify:protocol-types",
  "pnpm verify:protocol-canonicalization",
  "pnpm verify:protocol-diagnostics",
  "pnpm verify:protocol-structural-validation",
  "pnpm verify:protocol-semantic-foundation",
  "pnpm verify:protocol-component-contracts",
  "pnpm verify:protocol-interaction-contracts",
  "pnpm verify:protocol-binding-contracts",
  "pnpm verify:protocol-execution-contracts",
  "pnpm verify:protocol-official-suite-parity",
  "pnpm verify:protocol-validator-diagnostic-micro-vectors",
  "pnpm verify:catalog-manifest-registration",
  "pnpm verify:web-react-package-digest",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm build",
  "pnpm test",
  "pnpm boundaries",
]);
const EXPECTED_BOUNDARY_COMMAND = Object.freeze([
  "depcruise --config dependency-cruiser.config.cjs apps packages",
  "node scripts/verify-boundary-fixtures.mjs",
]);
const PLATFORM_PATTERNS = Object.freeze([
  Object.freeze({
    label: "React import or package",
    pattern: /(?:from\s+["']react(?:-dom|-native)?(?:["'/])|\bReactNode\b|\bComponentType\b)/u,
  }),
  Object.freeze({ label: "JSX namespace", pattern: /\bJSX\b/u }),
  Object.freeze({
    label: "DOM type",
    pattern:
      /\b(?:Blob|Document|Element|EventTarget|File|FormData|Headers|HTMLElement|HTMLInputElement|KeyboardEvent|MouseEvent|Navigator|Request|Response|ShadowRoot|URL|URLSearchParams|WebSocket|Window|XMLHttpRequest)\b/u,
  }),
  Object.freeze({
    label: "Node platform type",
    pattern: /\b(?:NodeJS|Buffer)\b|from\s+["']node:/u,
  }),
  Object.freeze({
    label: "native framework type",
    pattern: /\b(?:SwiftUI|Compose|UIView|ViewGroup)\b/u,
  }),
]);

/** Stable failure raised by cumulative M03-T01 through M03-T03 evidence generation and verification. */
export class CatalogManifestRegistrationEvidenceError extends Error {
  /**
   * @param {string} code stable evidence failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CatalogManifestRegistrationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CatalogManifestRegistrationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertEqual(actual, expected, label, code = "CATALOG_REGISTRATION_GOLDEN_MISMATCH") {
  if (actual !== expected)
    fail(code, `${label} differs from its fixed value.`, { actual, expected });
}

function assertJsonEqual(actual, expected, label, code = "CATALOG_REGISTRATION_GOLDEN_MISMATCH") {
  assertEqual(canonicalizeJson(actual), canonicalizeJson(expected), label, code);
}

function assertDeeplyFrozen(value, pathLabel = "$") {
  if (value === null || typeof value !== "object") return;
  if (!Object.isFrozen(value)) {
    fail("CATALOG_REGISTRATION_OUTPUT_MUTABLE", "A registration output is not deeply frozen.", {
      path: pathLabel,
    });
  }
  for (const key of Object.keys(value)) {
    assertDeeplyFrozen(value[key], `${pathLabel}.${key}`);
  }
}

function assertCanonicalStorageOrder(value, label) {
  assertEqual(
    JSON.stringify(value),
    canonicalizeJson(value),
    `${label} property order`,
    "CATALOG_REGISTRATION_OUTPUT_ORDER_DRIFT",
  );
}

const OUTPUT_EXOTIC_PREDICATES = Object.freeze([
  nodeTypes.isAnyArrayBuffer,
  nodeTypes.isArgumentsObject,
  nodeTypes.isArrayBufferView,
  nodeTypes.isBoxedPrimitive,
  nodeTypes.isCryptoKey,
  nodeTypes.isDate,
  nodeTypes.isExternal,
  nodeTypes.isKeyObject,
  nodeTypes.isMap,
  nodeTypes.isMapIterator,
  nodeTypes.isModuleNamespaceObject,
  nodeTypes.isNativeError,
  nodeTypes.isPromise,
  nodeTypes.isProxy,
  nodeTypes.isRegExp,
  nodeTypes.isSet,
  nodeTypes.isSetIterator,
  nodeTypes.isWeakMap,
  nodeTypes.isWeakSet,
]);
const OUTPUT_SLOT_SENTINEL = Object.freeze({});
const OUTPUT_WEAK_REF_DEREF = typeof WeakRef === "undefined" ? undefined : WeakRef.prototype.deref;
const OUTPUT_FINALIZATION_UNREGISTER =
  typeof FinalizationRegistry === "undefined"
    ? undefined
    : FinalizationRegistry.prototype.unregister;

function hasAdditionalOutputInternalSlot(value) {
  for (const [intrinsic, arguments_] of [
    [OUTPUT_WEAK_REF_DEREF, []],
    [OUTPUT_FINALIZATION_UNREGISTER, [OUTPUT_SLOT_SENTINEL]],
  ]) {
    if (intrinsic === undefined) continue;
    try {
      Reflect.apply(intrinsic, value, arguments_);
      return true;
    } catch {
      // The intrinsic rejects ordinary JSON containers without reading caller properties.
    }
  }
  return false;
}

function assertNoExoticOutput(value, pathLabel = "$") {
  if (value === null || typeof value !== "object") return;
  if (
    OUTPUT_EXOTIC_PREDICATES.some((predicate) => predicate(value)) ||
    hasAdditionalOutputInternalSlot(value)
  ) {
    fail(
      "CATALOG_REGISTRATION_OUTPUT_EXOTIC",
      "A registration output contains a recognized non-JSON internal-slot object.",
      { path: pathLabel },
    );
  }
  for (const key of Object.keys(value)) assertNoExoticOutput(value[key], `${pathLabel}.${key}`);
}

function captureObjectGraph(value) {
  const records = [];
  const visited = new WeakSet();

  function visit(candidate) {
    if (candidate === null || typeof candidate !== "object" || visited.has(candidate)) return;
    visited.add(candidate);
    const descriptors = Reflect.ownKeys(candidate).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
      if (descriptor === undefined) {
        fail("CATALOG_REGISTRATION_CALLER_MUTATED", "A caller descriptor disappeared mid-audit.");
      }
      if ("value" in descriptor) visit(descriptor.value);
      return Object.freeze({
        key,
        configurable: descriptor.configurable ?? false,
        enumerable: descriptor.enumerable ?? false,
        kind: "value" in descriptor ? "data" : "accessor",
        writable: "value" in descriptor ? (descriptor.writable ?? false) : undefined,
        value: "value" in descriptor ? descriptor.value : undefined,
        get: "get" in descriptor ? descriptor.get : undefined,
        set: "set" in descriptor ? descriptor.set : undefined,
      });
    });
    records.push(
      Object.freeze({
        value: candidate,
        prototype: Object.getPrototypeOf(candidate),
        extensible: Object.isExtensible(candidate),
        sealed: Object.isSealed(candidate),
        frozen: Object.isFrozen(candidate),
        descriptors: Object.freeze(descriptors),
      }),
    );
  }

  visit(value);
  return Object.freeze(records);
}

function assertObjectGraphPreserved(records, label) {
  for (const record of records) {
    if (
      Object.getPrototypeOf(record.value) !== record.prototype ||
      Object.isExtensible(record.value) !== record.extensible ||
      Object.isSealed(record.value) !== record.sealed ||
      Object.isFrozen(record.value) !== record.frozen
    ) {
      fail("CATALOG_REGISTRATION_CALLER_MUTATED", `${label} object state changed.`);
    }
    const keys = Reflect.ownKeys(record.value);
    if (
      keys.length !== record.descriptors.length ||
      keys.some((key, index) => !Object.is(key, record.descriptors[index]?.key))
    ) {
      fail("CATALOG_REGISTRATION_CALLER_MUTATED", `${label} object keys changed.`);
    }
    for (const expected of record.descriptors) {
      const actual = Object.getOwnPropertyDescriptor(record.value, expected.key);
      if (
        actual === undefined ||
        ("value" in actual ? "data" : "accessor") !== expected.kind ||
        (actual.configurable ?? false) !== expected.configurable ||
        (actual.enumerable ?? false) !== expected.enumerable ||
        ("value" in actual &&
          ((actual.writable ?? false) !== expected.writable ||
            !Object.is(actual.value, expected.value))) ||
        ("get" in actual && (actual.get !== expected.get || actual.set !== expected.set))
      ) {
        fail("CATALOG_REGISTRATION_CALLER_MUTATED", `${label} property descriptors changed.`);
      }
    }
  }
}

function assertDetachedGraph(output, inputRecords, label) {
  const callerObjects = new Set(inputRecords.map(({ value }) => value));
  for (const { value } of captureObjectGraph(output)) {
    if (callerObjects.has(value)) {
      fail("CATALOG_REGISTRATION_CALLER_ALIAS", `${label} retained caller-owned object identity.`);
    }
  }
}

function expectTypeError(operation, label, messagePattern) {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof TypeError)) {
      fail("CATALOG_REGISTRATION_REJECTION_DRIFT", `${label} raised a non-TypeError failure.`, {
        error: String(error),
      });
    }
    if (messagePattern !== undefined && !messagePattern.test(error.message)) {
      fail("CATALOG_REGISTRATION_REJECTION_DRIFT", `${label} raised an unexpected message.`, {
        message: error.message,
      });
    }
    return error.message;
  }
  fail("CATALOG_REGISTRATION_REJECTION_MISSING", `${label} was unexpectedly accepted.`);
}

function richComponentInput() {
  return {
    id: "com.example.ui/Button",
    manifest: {
      description: "Accessible action button.",
      category: "action",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: {
          label: { type: "string" },
          disabled: { type: "boolean" },
        },
      },
      slots: {
        leading: { maxItems: 1, acceptsCategories: ["content"] },
      },
      events: {
        press: { payloadSchema: { type: "object", additionalProperties: false } },
      },
      commands: {
        focus: { inputSchema: { type: "object", additionalProperties: false } },
      },
      styleParts: {
        root: { propertiesSchema: { type: "object", additionalProperties: false } },
      },
      visualStates: ["focus", "disabled"],
      authoring: {
        displayName: "Button",
        category: "Actions",
        defaultProps: { label: "Continue", disabled: false },
        adapterFidelity: "same",
      },
      deprecated: false,
      replacement: "com.example.ui/PrimaryButton",
      extensions: { "com.example.audit/owner": "design-system" },
    },
  };
}

function reorderedComponentInput() {
  return {
    manifest: {
      visualStates: ["focus", "disabled"],
      styleParts: {
        root: { propertiesSchema: { additionalProperties: false, type: "object" } },
      },
      slots: { leading: { acceptsCategories: ["content"], maxItems: 1 } },
      replacement: "com.example.ui/PrimaryButton",
      propsSchema: {
        properties: {
          disabled: { type: "boolean" },
          label: { type: "string" },
        },
        required: ["label"],
        additionalProperties: false,
        type: "object",
      },
      extensions: { "com.example.audit/owner": "design-system" },
      events: {
        press: { payloadSchema: { additionalProperties: false, type: "object" } },
      },
      description: "Accessible action button.",
      deprecated: false,
      commands: {
        focus: { inputSchema: { additionalProperties: false, type: "object" } },
      },
      category: "action",
      authoring: {
        adapterFidelity: "same",
        defaultProps: { disabled: false, label: "Continue" },
        category: "Actions",
        displayName: "Button",
      },
    },
    id: "com.example.ui/Button",
  };
}

function richBehaviorInput() {
  return {
    id: "com.example.interactions/Sortable",
    manifest: {
      description: "Adds sortable interaction mechanics.",
      category: "interaction",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { axis: { enum: ["vertical", "horizontal"] } },
      },
      attachTo: {
        capabilities: ["com.example.ui/Button"],
        categories: ["action"],
      },
      slots: {
        preview: { maxItems: 1, acceptsCategories: ["content"] },
      },
      events: {
        reorder: {
          payloadSchema: {
            type: "object",
            required: ["ids"],
            properties: { ids: { type: "array", items: { type: "string" } } },
          },
        },
      },
      commands: {
        cancel: { inputSchema: { type: "object", additionalProperties: false } },
      },
      styleParts: {
        indicator: { propertiesSchema: { type: "object", additionalProperties: false } },
      },
      visualStates: ["dragging", "invalid-target"],
      composition: {
        exclusiveChannels: ["pointer-drag"],
        compatibleWith: ["com.example.interactions/KeyboardSortable"],
      },
      authoring: {
        displayName: "Sortable",
        category: "Interaction",
        defaultProps: { axis: "vertical" },
        adapterFidelity: "equivalent",
      },
      deprecated: false,
      replacement: "com.example.interactions/SortableV2",
      extensions: { "com.example.audit/owner": "interaction-team" },
    },
  };
}

function richOperationInput() {
  return {
    id: "com.example.auth/signIn",
    manifest: {
      description: "Authenticates through a trusted host implementation.",
      inputSchema: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        required: ["userId"],
        properties: { userId: { type: "string" } },
      },
      errors: [
        { code: "INVALID_CREDENTIALS", description: "Credentials were rejected." },
        { code: "UNAVAILABLE", extensions: { retryable: true } },
      ],
      effect: "network",
      authoring: {
        fixtures: {
          success: { userId: "synthetic-user" },
          invalid: { code: "INVALID_CREDENTIALS" },
        },
        extensions: { "com.example/scenario": "sign-in" },
      },
      deprecated: false,
      replacement: "com.example.auth/signInV2",
      extensions: { "com.example.audit/owner": "identity-team" },
    },
  };
}

function richResourceInput() {
  return {
    id: "com.example.stores/list",
    manifest: {
      description: "Reads a host-provided store list.",
      inputSchema: {
        type: "object",
        properties: { region: { type: "string" } },
      },
      outputSchema: {
        type: "array",
        items: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
      errors: [
        { code: "OFFLINE", description: "The host is offline." },
        { code: "UNAVAILABLE", extensions: { retryable: true } },
      ],
      policies: ["mount", "manual", "once"],
      cacheHints: {
        ttlSeconds: 60,
        staleWhileRevalidateSeconds: 300,
      },
      authoring: {
        fixtures: { default: [{ id: "synthetic-store" }] },
        extensions: { "com.example/scenario": "store-list" },
      },
      deprecated: false,
      replacement: "com.example.stores/listV2",
      extensions: { "com.example.audit/owner": "store-team" },
    },
  };
}

function reverseObjectStorageOrder(value) {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectStorageOrder(entry));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, nested]) => [key, reverseObjectStorageOrder(nested)]),
  );
}

function createNestedControlSchema(depth) {
  let schema = { type: "string" };
  for (let index = 1; index < depth; index += 1) {
    schema = {
      type: "object",
      additionalProperties: false,
      properties: { child: schema },
    };
  }
  return schema;
}

function runInspectorControlVectors(catalogApi, hostileValues) {
  let registrationSequence = 0;
  const registerForDerivation = (manifest) =>
    catalogApi.registerComponent({
      id: `com.example.ui/InspectorProof${registrationSequence++}`,
      manifest,
    });
  const deriveManifest = (manifest) =>
    catalogApi.deriveComponentInspectorControls(registerForDerivation(manifest));

  const manifest = {
    propsSchema: {
      type: "object",
      additionalProperties: false,
      required: ["tone", "profile/name~raw", "count"],
      properties: {
        tone: { type: "string", enum: ["warning", "info"] },
        title: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        ratio: { type: "number" },
        "profile/name~raw": {
          type: "object",
          additionalProperties: false,
          required: ["display/name~raw"],
          properties: {
            score: { type: "number" },
            "display/name~raw": { type: "string" },
          },
        },
        count: { type: "integer" },
        config: { type: "object", properties: { enabled: { type: "boolean" } } },
        active: { type: "boolean" },
      },
    },
    authoring: {
      displayName: "Proof component",
      category: "Evidence",
      icon: "proof",
      defaultProps: { active: true, count: 1, title: "Evidence", tone: "info" },
      controls: {
        tone: {
          kind: "number",
          options: ["invented"],
          required: false,
          presentation: "segmented",
        },
        title: { presentation: "multiline" },
        phantom: { kind: "boolean" },
      },
      scenarios: {
        warning: {
          props: { tone: "warning" },
          fixtures: { message: "Synthetic warning" },
          state: { expanded: true },
          description: "Warning preview.",
          extensions: { "com.example/scenario": true },
        },
      },
      resize: { horizontal: "fill", vertical: "hug" },
      adapterFidelity: "approximate",
      differences: ["Animation is omitted."],
      extensions: { "com.example/owner": "proof" },
    },
  };
  const registration = registerForDerivation(manifest);
  const graphBefore = captureObjectGraph(registration);
  const canonicalBefore = canonicalizeJson(registration);
  const plan = catalogApi.deriveComponentInspectorControls(registration);
  assertEqual(
    canonicalizeJson(registration),
    canonicalBefore,
    "inspector derivation caller value",
    "CATALOG_REGISTRATION_INSPECTOR_CALLER_MUTATED",
  );
  assertObjectGraphPreserved(graphBefore, "inspector derivation caller input");
  assertDeeplyFrozen(plan, "inspector plan");
  assertNoExoticOutput(plan, "inspector plan");
  assertCanonicalStorageOrder(plan, "inspector plan");
  assertDetachedGraph(plan, graphBefore, "inspector plan");
  assertJsonEqual(
    plan.propsSchema,
    manifest.propsSchema,
    "inspector authoritative props schema",
    "CATALOG_REGISTRATION_INSPECTOR_GOLDEN_DRIFT",
  );
  assertJsonEqual(
    plan.authoring,
    manifest.authoring,
    "inspector complete authoring sidecar",
    "CATALOG_REGISTRATION_INSPECTOR_GOLDEN_DRIFT",
  );

  const expectedControls = [
    {
      kind: "boolean",
      property: "active",
      required: false,
      schemaPointer: "/propsSchema/properties/active",
      valuePointer: "/active",
    },
    {
      fallbackReason: "open-object",
      kind: "structured-json",
      property: "config",
      required: false,
      schemaPointer: "/propsSchema/properties/config",
      valuePointer: "/config",
    },
    {
      kind: "integer",
      property: "count",
      required: true,
      schemaPointer: "/propsSchema/properties/count",
      valuePointer: "/count",
    },
    {
      children: [
        {
          kind: "string",
          property: "display/name~raw",
          required: true,
          schemaPointer: "/propsSchema/properties/profile~1name~0raw/properties/display~1name~0raw",
          valuePointer: "/profile~1name~0raw/display~1name~0raw",
        },
        {
          kind: "number",
          property: "score",
          required: false,
          schemaPointer: "/propsSchema/properties/profile~1name~0raw/properties/score",
          valuePointer: "/profile~1name~0raw/score",
        },
      ],
      kind: "group",
      property: "profile/name~raw",
      required: true,
      schemaPointer: "/propsSchema/properties/profile~1name~0raw",
      valuePointer: "/profile~1name~0raw",
    },
    {
      kind: "number",
      property: "ratio",
      required: false,
      schemaPointer: "/propsSchema/properties/ratio",
      valuePointer: "/ratio",
    },
    {
      fallbackReason: "array",
      kind: "structured-json",
      property: "tags",
      required: false,
      schemaPointer: "/propsSchema/properties/tags",
      valuePointer: "/tags",
    },
    {
      hint: { presentation: "multiline" },
      hintPointer: "/authoring/controls/title",
      kind: "string",
      property: "title",
      required: false,
      schemaPointer: "/propsSchema/properties/title",
      valuePointer: "/title",
    },
    {
      hint: {
        kind: "number",
        options: ["invented"],
        presentation: "segmented",
        required: false,
      },
      hintPointer: "/authoring/controls/tone",
      kind: "enum",
      options: ["warning", "info"],
      property: "tone",
      required: true,
      schemaPointer: "/propsSchema/properties/tone",
      valuePointer: "/tone",
    },
  ];
  assertJsonEqual(
    plan.controls,
    expectedControls,
    "schema-authoritative inspector controls",
    "CATALOG_REGISTRATION_INSPECTOR_GOLDEN_DRIFT",
  );

  const reorderedPlan = deriveManifest(reverseObjectStorageOrder(manifest));
  assertEqual(
    canonicalizeJson(reorderedPlan),
    canonicalizeJson(plan),
    "inspector insertion-order determinism",
    "CATALOG_REGISTRATION_INSPECTOR_ORDER_DRIFT",
  );

  const fallbackCases = [
    ["array", { type: "array", items: { type: "string" } }, "array"],
    ["open-object", { type: "object", properties: {} }, "open-object"],
    ["multi-type", { type: ["string", "null"] }, "multi-type"],
    ["reference", { $ref: "#/$defs/value" }, "reference"],
    ["dynamic-reference", { $dynamicRef: "#value" }, "reference"],
    ["recursive-reference", { $recursiveRef: "#" }, "reference"],
    ["all-of", { allOf: [{ type: "string" }] }, "combinator"],
    ["any-of", { anyOf: [{ type: "string" }] }, "combinator"],
    ["one-of", { oneOf: [{ type: "string" }] }, "combinator"],
    ["not", { not: { type: "string" } }, "combinator"],
    ["conditional", { if: { type: "string" }, then: { minLength: 1 } }, "conditional"],
    ["dependent-schema", { type: "object", dependentSchemas: {} }, "conditional"],
    ["dependent-required", { type: "object", dependentRequired: {} }, "conditional"],
    ["pattern", { type: "string", pattern: "^[a-z]+$" }, "pattern"],
    [
      "pattern-properties",
      { type: "object", additionalProperties: false, properties: {}, patternProperties: {} },
      "pattern",
    ],
    ["empty-enum", { type: "string", enum: [] }, "unsupported-schema"],
    ["structured-enum", { enum: [{ mode: "fixed" }] }, "unsupported-schema"],
    ["type-mismatched-enum", { type: "string", enum: ["valid", 1] }, "unsupported-schema"],
    ["unknown-keyword", { type: "string", "x-example-control": true }, "unsupported-schema"],
    ["untyped", { minLength: 1 }, "unsupported-schema"],
    ["boolean-schema", false, "unsupported-schema"],
  ];
  const fallbackResults = fallbackCases.map(([id, schema, expectedReason]) => {
    const fallbackPlan = deriveManifest({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { value: schema },
      },
    });
    const [control] = fallbackPlan.controls;
    if (
      fallbackPlan.controls.length !== 1 ||
      control?.kind !== "structured-json" ||
      control.fallbackReason !== expectedReason
    ) {
      fail(
        "CATALOG_REGISTRATION_INSPECTOR_FALLBACK_DRIFT",
        `${id} did not produce its honest structured-JSON fallback.`,
        { expectedReason, control },
      );
    }
    assertDeeplyFrozen(fallbackPlan, `inspector ${id} fallback`);
    return Object.freeze({ id, reason: expectedReason, result: "STRUCTURED_JSON" });
  });
  const undeclaredRequiredRootPlan = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      required: ["missing"],
      properties: {},
    },
  });
  assertJsonEqual(
    undeclaredRequiredRootPlan.controls,
    [
      {
        fallbackReason: "unsupported-schema",
        kind: "structured-json",
        property: null,
        required: true,
        schemaPointer: "/propsSchema",
        valuePointer: "",
      },
    ],
    "undeclared required root fallback",
    "CATALOG_REGISTRATION_INSPECTOR_FALLBACK_DRIFT",
  );
  assertDeeplyFrozen(undeclaredRequiredRootPlan, "undeclared required root fallback");

  const undeclaredRequiredSubtreePlan = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        group: {
          type: "object",
          additionalProperties: false,
          required: ["missing"],
          properties: {},
        },
      },
    },
  });
  assertJsonEqual(
    undeclaredRequiredSubtreePlan.controls,
    [
      {
        fallbackReason: "unsupported-schema",
        kind: "structured-json",
        property: "group",
        required: false,
        schemaPointer: "/propsSchema/properties/group",
        valuePointer: "/group",
      },
    ],
    "undeclared required subtree fallback",
    "CATALOG_REGISTRATION_INSPECTOR_FALLBACK_DRIFT",
  );
  assertDeeplyFrozen(undeclaredRequiredSubtreePlan, "undeclared required subtree fallback");

  const wholeObjectEnumPlan = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      enum: [{ mode: "fixed" }],
      properties: { mode: { type: "string" } },
    },
  });
  assertJsonEqual(
    wholeObjectEnumPlan.controls,
    [
      {
        fallbackReason: "unsupported-schema",
        kind: "structured-json",
        property: null,
        required: true,
        schemaPointer: "/propsSchema",
        valuePointer: "",
      },
    ],
    "whole-object enum root fallback",
    "CATALOG_REGISTRATION_INSPECTOR_FALLBACK_DRIFT",
  );
  assertDeeplyFrozen(wholeObjectEnumPlan, "whole-object enum root fallback");

  const integerLikePropertyPlan = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        2: { type: "string" },
        10: {
          type: "object",
          additionalProperties: false,
          properties: {
            2: { type: "boolean" },
            10: { type: "boolean" },
          },
        },
      },
    },
  });
  assertJsonEqual(
    integerLikePropertyPlan.controls.map(({ property }) => property),
    ["10", "2"],
    "integer-like root property order",
    "CATALOG_REGISTRATION_INSPECTOR_ORDER_DRIFT",
  );
  assertJsonEqual(
    integerLikePropertyPlan.controls[0]?.children?.map(({ property }) => property),
    ["10", "2"],
    "integer-like nested property order",
    "CATALOG_REGISTRATION_INSPECTOR_ORDER_DRIFT",
  );

  const completeFallbackResults = Object.freeze([
    ...fallbackResults,
    Object.freeze({
      id: "undeclared-required-root",
      reason: "unsupported-schema",
      result: "STRUCTURED_JSON",
    }),
    Object.freeze({
      id: "undeclared-required-subtree",
      reason: "unsupported-schema",
      result: "STRUCTURED_JSON",
    }),
    Object.freeze({
      id: "whole-object-enum",
      reason: "unsupported-schema",
      result: "STRUCTURED_JSON",
    }),
  ]);

  const acceptedDepth = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { root: createNestedControlSchema(16) },
    },
  });
  const rejectedDepth = deriveManifest({
    propsSchema: {
      type: "object",
      additionalProperties: false,
      properties: { root: createNestedControlSchema(17) },
    },
  });
  assertEqual(
    acceptedDepth.controls[0]?.kind,
    "group",
    "inspector depth boundary accepted",
    "CATALOG_REGISTRATION_INSPECTOR_LIMIT_DRIFT",
  );
  assertEqual(
    rejectedDepth.controls[0]?.fallbackReason,
    "derivation-limit",
    "inspector depth boundary rejected",
    "CATALOG_REGISTRATION_INSPECTOR_LIMIT_DRIFT",
  );

  const createWideManifest = (count) => {
    const properties = {};
    for (let index = 0; index < count; index += 1) {
      properties[`property-${String(index).padStart(3, "0")}`] = { type: "string" };
    }
    return { propsSchema: { type: "object", additionalProperties: false, properties } };
  };
  const acceptedWidth = deriveManifest(createWideManifest(512));
  const rejectedWidth = deriveManifest(createWideManifest(513));
  assertEqual(
    acceptedWidth.controls.length,
    512,
    "inspector control-count boundary accepted",
    "CATALOG_REGISTRATION_INSPECTOR_LIMIT_DRIFT",
  );
  assertEqual(
    rejectedWidth.controls[0]?.fallbackReason,
    "derivation-limit",
    "inspector control-count boundary rejected",
    "CATALOG_REGISTRATION_INSPECTOR_LIMIT_DRIFT",
  );

  let accessorInvoked = false;
  const accessorHint = Object.defineProperty({}, "danger", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return "changed";
    },
  });
  expectTypeError(
    () =>
      catalogApi.deriveComponentInspectorControls({
        id: "com.example.ui/InspectorAccessor",
        manifest: {
          propsSchema: {
            type: "object",
            additionalProperties: false,
            properties: { value: { type: "string" } },
          },
          authoring: { controls: { value: accessorHint } },
        },
      }),
    "inspector accessor hint",
  );
  if (accessorInvoked) {
    fail(
      "CATALOG_REGISTRATION_ACCESSOR_INVOKED",
      "Inspector derivation invoked a caller accessor.",
    );
  }

  const hostileResults = hostileValues.map(([id, value]) => {
    expectTypeError(
      () =>
        catalogApi.deriveComponentInspectorControls({
          id: "com.example.ui/InspectorHostile",
          manifest: {
            propsSchema: {
              type: "object",
              additionalProperties: false,
              properties: { value: { type: "string" } },
            },
            authoring: { controls: { value } },
          },
        }),
      `inspector hostile ${id}`,
    );
    return Object.freeze({ id, result: "REJECTED" });
  });

  return Object.freeze({
    plan,
    transcript: Object.freeze({
      authoringFields: Object.freeze(Object.keys(manifest.authoring).sort()),
      scenarioFields: Object.freeze(Object.keys(manifest.authoring.scenarios.warning).sort()),
      controlKinds: Object.freeze([
        "boolean",
        "enum",
        "group",
        "integer",
        "number",
        "string",
        "structured-json",
      ]),
      canonicalSha256: sha256(Buffer.from(canonicalizeJson(plan))),
      deterministicRuns: 2,
      propertyControls: plan.controls.length,
      fallbackCases: completeFallbackResults,
      hostileValues: Object.freeze(hostileResults),
      accessor: Object.freeze({ result: "REJECTED", invoked: accessorInvoked }),
      misleadingHintAuthority: Object.freeze({
        createsProperties: false,
        changesKind: false,
        changesRequiredness: false,
        changesOptions: false,
      }),
      pointerProfile: "RFC 6901",
      limits: Object.freeze({
        maxDepth: 16,
        maxControls: 512,
        overLimit: "ROOT_STRUCTURED_JSON_FALLBACK",
      }),
      deeplyFrozen: true,
      detached: true,
    }),
  });
}

function runContractVectors(catalogApi, validatorApi) {
  const preservedInputs = [];
  const frozenOutputs = [];
  const detachedOutputs = [];
  let successfulRegistrations = 0;
  let successfulCatalogs = 0;

  function observeRegistration(register, input, label) {
    const graphBefore = captureObjectGraph(input);
    const canonicalBefore = canonicalizeJson(input);
    const output = register(input);
    assertEqual(canonicalizeJson(output), canonicalBefore, `${label} value preservation`);
    assertObjectGraphPreserved(graphBefore, `${label} caller input`);
    assertDeeplyFrozen(output, `${label} output`);
    assertNoExoticOutput(output, `${label} output`);
    assertCanonicalStorageOrder(output, `${label} output`);
    assertDetachedGraph(output, graphBefore, `${label} output`);
    preservedInputs.push(label);
    frozenOutputs.push(label);
    detachedOutputs.push(label);
    successfulRegistrations += 1;
    return output;
  }

  const registerObserved = (input, label) =>
    observeRegistration(catalogApi.registerComponent, input, label);
  const registerBehaviorObserved = (input, label) =>
    observeRegistration(catalogApi.registerBehavior, input, label);
  const registerOperationObserved = (input, label) =>
    observeRegistration(catalogApi.registerOperation, input, label);
  const registerResourceObserved = (input, label) =>
    observeRegistration(catalogApi.registerResource, input, label);

  function composeObserved(input, label) {
    const graphBefore = captureObjectGraph(input);
    const canonicalBefore = canonicalizeJson(input);
    const output = catalogApi.createCatalogManifest(input);
    const expectedMaps = {};
    for (const category of ["components", "behaviors", "operations", "resources"]) {
      const expectedMap = Object.create(null);
      for (const registration of input[category] ?? []) {
        expectedMap[registration.id] = registration.manifest;
      }
      expectedMaps[category] = expectedMap;
    }
    const expected = {
      kind: "desen.catalog",
      desen: "0.1.0",
      id: input.id,
      version: input.version,
      target: input.target,
      packageDigest: input.packageDigest,
      components: expectedMaps.components,
      behaviors: expectedMaps.behaviors,
      operations: expectedMaps.operations,
      resources: expectedMaps.resources,
    };
    for (const optionalKey of ["description", "authoring", "extensions"]) {
      if (Object.hasOwn(input, optionalKey)) expected[optionalKey] = input[optionalKey];
    }
    assertJsonEqual(output, expected, `${label} exact composition`);
    assertEqual(canonicalizeJson(input), canonicalBefore, `${label} caller value`);
    assertObjectGraphPreserved(graphBefore, `${label} caller input`);
    assertDeeplyFrozen(output, `${label} output`);
    assertNoExoticOutput(output, `${label} output`);
    assertCanonicalStorageOrder(output, `${label} output`);
    assertDetachedGraph(output, graphBefore, `${label} output`);
    preservedInputs.push(label);
    frozenOutputs.push(label);
    detachedOutputs.push(label);
    successfulCatalogs += 1;
    return output;
  }

  const mutableInput = richComponentInput();
  const first = registerObserved(mutableInput, "rich registration");
  const second = registerObserved(reorderedComponentInput(), "reordered registration");
  const mutableBehaviorInput = richBehaviorInput();
  const behavior = registerBehaviorObserved(mutableBehaviorInput, "rich behavior registration");
  const reorderedBehavior = registerBehaviorObserved(
    reverseObjectStorageOrder(richBehaviorInput()),
    "reordered behavior registration",
  );
  const mutableOperationInput = richOperationInput();
  const operation = registerOperationObserved(mutableOperationInput, "rich operation registration");
  const reorderedOperation = registerOperationObserved(
    reverseObjectStorageOrder(richOperationInput()),
    "reordered operation registration",
  );
  const mutableResourceInput = richResourceInput();
  const resource = registerResourceObserved(mutableResourceInput, "rich resource registration");
  const reorderedResource = registerResourceObserved(
    reverseObjectStorageOrder(richResourceInput()),
    "reordered resource registration",
  );

  assertEqual(canonicalizeJson(first), canonicalizeJson(second), "insertion-order normalization");
  assertEqual(
    canonicalizeJson(behavior),
    canonicalizeJson(reorderedBehavior),
    "behavior insertion-order normalization",
  );
  assertEqual(
    canonicalizeJson(operation),
    canonicalizeJson(reorderedOperation),
    "operation insertion-order normalization",
  );
  assertEqual(
    canonicalizeJson(resource),
    canonicalizeJson(reorderedResource),
    "resource insertion-order normalization",
  );
  assertJsonEqual(
    Object.keys(first.manifest).sort(),
    EXPECTED_COMPONENT_FIELDS,
    "complete component contract fields",
  );
  assertJsonEqual(
    Object.keys(behavior.manifest).sort(),
    EXPECTED_BEHAVIOR_FIELDS,
    "complete behavior contract fields",
  );
  assertJsonEqual(
    Object.keys(operation.manifest).sort(),
    EXPECTED_OPERATION_FIELDS,
    "complete operation contract fields",
  );
  assertJsonEqual(
    Object.keys(resource.manifest).sort(),
    EXPECTED_RESOURCE_FIELDS,
    "complete resource contract fields",
  );

  const frozenRegistrationTexts = [
    canonicalizeJson(first),
    canonicalizeJson(behavior),
    canonicalizeJson(operation),
    canonicalizeJson(resource),
  ];
  mutableInput.manifest.description = "Caller mutation";
  mutableInput.manifest.propsSchema.properties.label.type = "number";
  mutableInput.manifest.visualStates.push("pressed");
  mutableBehaviorInput.manifest.description = "Caller mutation";
  mutableBehaviorInput.manifest.visualStates.push("caller-state");
  mutableOperationInput.manifest.errors[0].description = "Caller mutation";
  mutableOperationInput.manifest.authoring.fixtures.success.userId = "caller-user";
  mutableResourceInput.manifest.policies.reverse();
  mutableResourceInput.manifest.cacheHints.ttlSeconds = 999;
  for (const [index, registration] of [first, behavior, operation, resource].entries()) {
    assertEqual(
      canonicalizeJson(registration),
      frozenRegistrationTexts[index],
      `post-registration isolation ${index}`,
    );
  }

  const catalogInput = {
    id: "com.example.catalog",
    version: "1.0.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    description: "M03-T02 proof Catalog.",
    components: [first],
    behaviors: [behavior],
    operations: [operation],
    resources: [resource],
    authoring: { publisher: "proof" },
    extensions: { "com.example/proof": true },
  };
  const catalog = composeObserved(catalogInput, "primary Catalog");
  assertJsonEqual(
    Object.keys(catalog),
    [
      "authoring",
      "behaviors",
      "components",
      "description",
      "desen",
      "extensions",
      "id",
      "kind",
      "operations",
      "packageDigest",
      "resources",
      "target",
      "version",
    ],
    "Catalog root fields",
  );
  assertJsonEqual(catalog.components, { [first.id]: first.manifest }, "component Catalog map");
  assertJsonEqual(catalog.behaviors, { [behavior.id]: behavior.manifest }, "behavior Catalog map");
  assertJsonEqual(
    catalog.operations,
    { [operation.id]: operation.manifest },
    "operation Catalog map",
  );
  assertJsonEqual(catalog.resources, { [resource.id]: resource.manifest }, "resource Catalog map");
  if (
    "production" in catalog.behaviors[behavior.id] ||
    "execute" in catalog.operations[operation.id] ||
    "read" in catalog.resources[resource.id]
  ) {
    fail(
      "CATALOG_REGISTRATION_EXECUTABLE_BINDING_LEAK",
      "A manifest registration exposed executable binding metadata.",
    );
  }
  const validation = validatorApi.validateDesenCatalogSemantics(catalog);
  if (validation.valid !== true || validation.diagnostics.length !== 0) {
    fail("CATALOG_REGISTRATION_VALIDATOR_REJECTED", "The proof Catalog failed G02 validation.", {
      diagnostics: validation.diagnostics,
    });
  }
  const componentOnlyCatalog = composeObserved(
    {
      id: "com.example.component-only",
      version: catalogInput.version,
      target: catalogInput.target,
      packageDigest: catalogInput.packageDigest,
      description: "M03-T01 compatibility Catalog.",
      components: [first],
      authoring: catalogInput.authoring,
      extensions: catalogInput.extensions,
    },
    "component-only Catalog",
  );
  assertJsonEqual(componentOnlyCatalog.behaviors, {}, "component-only behavior map");
  assertJsonEqual(componentOnlyCatalog.operations, {}, "component-only operation map");
  assertJsonEqual(componentOnlyCatalog.resources, {}, "component-only resource map");

  const differentDuplicate = registerObserved(
    {
      id: first.id,
      manifest: { propsSchema: {}, description: "A distinct duplicate registration." },
    },
    "distinct duplicate registration",
  );
  const duplicateMessage = expectTypeError(
    () =>
      catalogApi.createCatalogManifest({
        ...catalogInput,
        components: [first, differentDuplicate],
      }),
    "distinct duplicate component id",
    /duplicate component id/u,
  );
  const distinctBehaviorDuplicateInput = richBehaviorInput();
  distinctBehaviorDuplicateInput.manifest.description =
    "A distinct behavior registration with the same id.";
  const distinctBehaviorDuplicate = registerBehaviorObserved(
    distinctBehaviorDuplicateInput,
    "distinct duplicate behavior registration",
  );
  const distinctOperationDuplicateInput = richOperationInput();
  distinctOperationDuplicateInput.manifest.description =
    "A distinct operation registration with the same id.";
  const distinctOperationDuplicate = registerOperationObserved(
    distinctOperationDuplicateInput,
    "distinct duplicate operation registration",
  );
  const distinctResourceDuplicateInput = richResourceInput();
  distinctResourceDuplicateInput.manifest.description =
    "A distinct resource registration with the same id.";
  const distinctResourceDuplicate = registerResourceObserved(
    distinctResourceDuplicateInput,
    "distinct duplicate resource registration",
  );
  const categoryDuplicateMessages = {};
  for (const [category, registration, duplicateRegistration] of [
    ["behaviors", behavior, distinctBehaviorDuplicate],
    ["operations", operation, distinctOperationDuplicate],
    ["resources", resource, distinctResourceDuplicate],
  ]) {
    categoryDuplicateMessages[category] = expectTypeError(
      () =>
        catalogApi.createCatalogManifest({
          ...catalogInput,
          [category]: [registration, duplicateRegistration],
        }),
      `duplicate ${category} id`,
      new RegExp(`duplicate ${category.slice(0, -1)} id`, "u"),
    );
  }
  const sharedCapabilityId = "com.example.shared/Collision";
  const collisionRegistrations = Object.freeze([
    Object.freeze({
      category: "components",
      registration: Object.freeze({ id: sharedCapabilityId, manifest: first.manifest }),
    }),
    Object.freeze({
      category: "behaviors",
      registration: Object.freeze({ id: sharedCapabilityId, manifest: behavior.manifest }),
    }),
    Object.freeze({
      category: "operations",
      registration: Object.freeze({ id: sharedCapabilityId, manifest: operation.manifest }),
    }),
    Object.freeze({
      category: "resources",
      registration: Object.freeze({ id: sharedCapabilityId, manifest: resource.manifest }),
    }),
  ]);
  const crossCategoryDuplicateMessages = [];
  for (let leftIndex = 0; leftIndex < collisionRegistrations.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < collisionRegistrations.length;
      rightIndex += 1
    ) {
      const left = collisionRegistrations[leftIndex];
      const right = collisionRegistrations[rightIndex];
      const message = expectTypeError(
        () =>
          catalogApi.createCatalogManifest({
            ...catalogInput,
            components: [],
            behaviors: [],
            operations: [],
            resources: [],
            [left.category]: [left.registration],
            [right.category]: [right.registration],
          }),
        `cross-category ${left.category}/${right.category} id`,
        /duplicate capability id/u,
      );
      crossCategoryDuplicateMessages.push(
        Object.freeze({
          categories: Object.freeze([left.category, right.category]),
          message,
        }),
      );
    }
  }
  expectTypeError(
    () => catalogApi.registerComponent({ ...richComponentInput(), production: null }),
    "component executable wrapper field",
    /expected only id, manifest/u,
  );
  expectTypeError(
    () => catalogApi.registerBehavior({ ...richBehaviorInput(), production: null }),
    "behavior executable wrapper field",
    /expected only id, manifest/u,
  );
  expectTypeError(
    () => catalogApi.registerOperation({ ...richOperationInput(), execute: null }),
    "operation executable wrapper field",
    /expected only id, manifest/u,
  );
  expectTypeError(
    () => catalogApi.registerResource({ ...richResourceInput(), read: null }),
    "resource executable wrapper field",
    /expected only id, manifest/u,
  );

  let accessorInvoked = false;
  const createAccessor = () =>
    Object.defineProperty({}, "danger", {
      enumerable: true,
      get() {
        accessorInvoked = true;
        return "changed";
      },
    });
  const registrationProfiles = Object.freeze([
    Object.freeze({
      category: "component",
      register: catalogApi.registerComponent,
      hostileInput: (value) => ({
        id: "com.example.ui/Hostile",
        manifest: { propsSchema: {}, extensions: { value } },
      }),
      accessorInput: () => ({
        id: "com.example.ui/Accessor",
        manifest: { propsSchema: {}, extensions: createAccessor() },
      }),
    }),
    Object.freeze({
      category: "behavior",
      register: catalogApi.registerBehavior,
      hostileInput: (value) => ({
        id: "com.example.interactions/Hostile",
        manifest: {
          propsSchema: {},
          attachTo: { capabilities: [] },
          extensions: { value },
        },
      }),
      accessorInput: () => ({
        id: "com.example.interactions/Accessor",
        manifest: {
          propsSchema: {},
          attachTo: { capabilities: [] },
          extensions: createAccessor(),
        },
      }),
    }),
    Object.freeze({
      category: "operation",
      register: catalogApi.registerOperation,
      hostileInput: (value) => ({
        id: "com.example.operations/Hostile",
        manifest: {
          inputSchema: {},
          outputSchema: {},
          errors: [],
          effect: "none",
          extensions: { value },
        },
      }),
      accessorInput: () => ({
        id: "com.example.operations/Accessor",
        manifest: {
          inputSchema: {},
          outputSchema: {},
          errors: [],
          effect: "none",
          extensions: createAccessor(),
        },
      }),
    }),
    Object.freeze({
      category: "resource",
      register: catalogApi.registerResource,
      hostileInput: (value) => ({
        id: "com.example.resources/Hostile",
        manifest: {
          inputSchema: {},
          outputSchema: {},
          errors: [],
          policies: ["manual"],
          extensions: { value },
        },
      }),
      accessorInput: () => ({
        id: "com.example.resources/Accessor",
        manifest: {
          inputSchema: {},
          outputSchema: {},
          errors: [],
          policies: ["manual"],
          extensions: createAccessor(),
        },
      }),
    }),
  ]);
  for (const profile of registrationProfiles) {
    expectTypeError(
      () => profile.register(profile.accessorInput()),
      `${profile.category} accessor value`,
    );
  }
  if (accessorInvoked) {
    fail("CATALOG_REGISTRATION_ACCESSOR_INVOKED", "Registration invoked a caller accessor.");
  }

  class CustomValue {
    value = true;
  }
  const sparse = new Array(1);
  const extraArray = Object.assign([], { extra: true });
  const cycle = {};
  cycle.self = cycle;
  const hidden = { visible: true };
  Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
  const symbolProperty = { visible: true };
  Object.defineProperty(symbolProperty, Symbol("hidden"), { value: true });
  const launderPrototype = (value) => {
    Object.setPrototypeOf(value, Object.prototype);
    return value;
  };
  const hostileValues = [
    ["undefined", undefined],
    ["function", () => true],
    ["symbol", Symbol("value")],
    ["bigint", 1n],
    ["nan", Number.NaN],
    ["infinity", Infinity],
    ["date", new Date(0)],
    ["map", new Map([["key", "value"]])],
    ["set", new Set(["value"])],
    ["regexp", /value/u],
    ["custom-class", new CustomValue()],
    ["frozen-date", Object.freeze(new Date(0))],
    ["frozen-map", Object.freeze(new Map([["key", "value"]]))],
    ["sparse-array", sparse],
    ["extra-array-property", extraArray],
    ["cycle", cycle],
    ["non-enumerable-property", hidden],
    ["symbol-property", symbolProperty],
    ["laundered-date", launderPrototype(new Date(0))],
    ["laundered-map", launderPrototype(new Map([["key", "value"]]))],
    ["laundered-set", launderPrototype(new Set(["value"]))],
    ["laundered-weak-map", launderPrototype(new WeakMap([[{}, "value"]]))],
    ["laundered-weak-set", launderPrototype(new WeakSet([{}]))],
    ["laundered-uint8-array", launderPrototype(new Uint8Array([1, 2, 3]))],
    ["laundered-array-buffer", launderPrototype(new ArrayBuffer(4))],
    ["laundered-shared-array-buffer", launderPrototype(new SharedArrayBuffer(4))],
    ["laundered-data-view", launderPrototype(new DataView(new ArrayBuffer(4)))],
    ["laundered-boolean", launderPrototype(new Boolean(true))],
    ["laundered-number", launderPrototype(new Number(1))],
    ["laundered-string", launderPrototype(new String("value"))],
    ["laundered-bigint", launderPrototype(Object(1n))],
    ["laundered-symbol", launderPrototype(Object(Symbol("value")))],
    ["laundered-regexp", launderPrototype(/value/u)],
    ["laundered-weak-ref", launderPrototype(new WeakRef({}))],
    [
      "laundered-finalization-registry",
      launderPrototype(new FinalizationRegistry(() => undefined)),
    ],
  ];
  const hostileResults = registrationProfiles.flatMap((profile) =>
    hostileValues.map(([id, value]) => {
      expectTypeError(
        () => profile.register(profile.hostileInput(value)),
        `${profile.category} hostile ${id}`,
      );
      return Object.freeze({ category: profile.category, id, result: "REJECTED" });
    }),
  );
  const inspector = runInspectorControlVectors(catalogApi, hostileValues);

  const opaqueExtensions = JSON.parse(
    '{"__proto__":{"polluted":false},"constructor":"data","prototype":"data"}',
  );
  const opaque = registerObserved(
    {
      id: "com.example.ui/Opaque",
      manifest: { propsSchema: {}, extensions: opaqueExtensions },
    },
    "opaque extension registration",
  );
  if (!Object.hasOwn(opaque.manifest.extensions, "__proto__") || {}.polluted !== undefined) {
    fail("CATALOG_REGISTRATION_OPAQUE_EXTENSION_DRIFT", "Opaque extension keys were not safe.");
  }

  const componentUpper = registerObserved(
    { id: "com.example.ui/Text", manifest: { propsSchema: {} } },
    "uppercase component id registration",
  );
  const componentLower = registerObserved(
    { id: "com.example.ui/text", manifest: { propsSchema: {} } },
    "lowercase component id registration",
  );
  const behaviorUpper = registerBehaviorObserved(
    {
      id: "com.example.interactions/Sortable",
      manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
    },
    "uppercase behavior id registration",
  );
  const behaviorLower = registerBehaviorObserved(
    {
      id: "com.example.interactions/sortable",
      manifest: { propsSchema: {}, attachTo: { categories: ["content"] } },
    },
    "lowercase behavior id registration",
  );
  const operationUpper = registerOperationObserved(
    {
      id: "com.example.operations/Save",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    },
    "uppercase operation id registration",
  );
  const operationLower = registerOperationObserved(
    {
      id: "com.example.operations/save",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    },
    "lowercase operation id registration",
  );
  const resourceUpper = registerResourceObserved(
    {
      id: "com.example.resources/Stores",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    },
    "uppercase resource id registration",
  );
  const resourceLower = registerResourceObserved(
    {
      id: "com.example.resources/stores",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    },
    "lowercase resource id registration",
  );
  const componentCaseCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.component-case-catalog",
      components: [componentUpper, componentLower],
      behaviors: [],
      operations: [],
      resources: [],
    },
    "case-sensitive component Catalog",
  );
  const behaviorCaseCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.behavior-case-catalog",
      components: [],
      behaviors: [behaviorUpper, behaviorLower],
      operations: [],
      resources: [],
    },
    "case-sensitive behavior Catalog",
  );
  const operationCaseCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.operation-case-catalog",
      components: [],
      behaviors: [],
      operations: [operationUpper, operationLower],
      resources: [],
    },
    "case-sensitive operation Catalog",
  );
  const resourceCaseCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.resource-case-catalog",
      components: [],
      behaviors: [],
      operations: [],
      resources: [resourceUpper, resourceLower],
    },
    "case-sensitive resource Catalog",
  );
  assertJsonEqual(
    Object.keys(componentCaseCatalog.components),
    ["com.example.ui/Text", "com.example.ui/text"],
    "case-sensitive component ids",
  );
  assertJsonEqual(
    Object.keys(behaviorCaseCatalog.behaviors),
    ["com.example.interactions/Sortable", "com.example.interactions/sortable"],
    "case-sensitive behavior ids",
  );
  assertJsonEqual(
    Object.keys(operationCaseCatalog.operations),
    ["com.example.operations/Save", "com.example.operations/save"],
    "case-sensitive operation ids",
  );
  assertJsonEqual(
    Object.keys(resourceCaseCatalog.resources),
    ["com.example.resources/Stores", "com.example.resources/stores"],
    "case-sensitive resource ids",
  );

  const protoKey = registerObserved(
    { id: "__proto__", manifest: { propsSchema: {} } },
    "prototype-key registration",
  );
  const constructorKey = registerObserved(
    { id: "constructor", manifest: { propsSchema: {} } },
    "constructor-key registration",
  );
  const behaviorProtoKey = registerBehaviorObserved(
    {
      id: "behavior.__proto__",
      manifest: { propsSchema: {}, attachTo: { capabilities: [] } },
    },
    "behavior prototype-key registration",
  );
  const operationConstructorKey = registerOperationObserved(
    {
      id: "operation.constructor",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], effect: "none" },
    },
    "operation constructor-key registration",
  );
  const resourcePrototypeKey = registerResourceObserved(
    {
      id: "resource.prototype",
      manifest: { inputSchema: {}, outputSchema: {}, errors: [], policies: ["manual"] },
    },
    "resource prototype-key registration",
  );
  const dangerousKeyCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.dangerous-key-catalog",
      components: [protoKey, constructorKey],
      behaviors: [behaviorProtoKey],
      operations: [operationConstructorKey],
      resources: [resourcePrototypeKey],
    },
    "dangerous-key Catalog",
  );
  if (
    !Object.hasOwn(dangerousKeyCatalog.components, "__proto__") ||
    !Object.hasOwn(dangerousKeyCatalog.components, "constructor") ||
    !Object.hasOwn(dangerousKeyCatalog.behaviors, "behavior.__proto__") ||
    !Object.hasOwn(dangerousKeyCatalog.operations, "operation.constructor") ||
    !Object.hasOwn(dangerousKeyCatalog.resources, "resource.prototype") ||
    {}.polluted !== undefined
  ) {
    fail("CATALOG_REGISTRATION_CAPABILITY_KEY_DRIFT", "Capability map keys were not data-safe.");
  }

  return Object.freeze({
    catalog,
    inspectorPlan: inspector.plan,
    transcript: Object.freeze({
      componentFields: EXPECTED_COMPONENT_FIELDS,
      behaviorFields: EXPECTED_BEHAVIOR_FIELDS,
      operationFields: EXPECTED_OPERATION_FIELDS,
      resourceFields: EXPECTED_RESOURCE_FIELDS,
      registrationCanonicalSha256: sha256(Buffer.from(canonicalizeJson(first))),
      behaviorCanonicalSha256: sha256(Buffer.from(canonicalizeJson(behavior))),
      operationCanonicalSha256: sha256(Buffer.from(canonicalizeJson(operation))),
      resourceCanonicalSha256: sha256(Buffer.from(canonicalizeJson(resource))),
      catalogCanonicalSha256: sha256(Buffer.from(canonicalizeJson(catalog))),
      deterministicRuns: 2,
      successfulRegistrations,
      successfulCatalogs,
      callerInputsPreserved: preservedInputs.length,
      deeplyFrozenOutputs: frozenOutputs.length,
      detachedOutputs: detachedOutputs.length,
      recognizedExoticOutputs: "REJECTED",
      duplicateId: Object.freeze({ result: "REJECTED", message: duplicateMessage }),
      categoryDuplicateIds: Object.freeze({
        behaviors: Object.freeze({
          result: "REJECTED",
          message: categoryDuplicateMessages.behaviors,
        }),
        operations: Object.freeze({
          result: "REJECTED",
          message: categoryDuplicateMessages.operations,
        }),
        resources: Object.freeze({
          result: "REJECTED",
          message: categoryDuplicateMessages.resources,
        }),
      }),
      crossCategoryDuplicateIds: Object.freeze(
        crossCategoryDuplicateMessages.map(({ categories, message }) =>
          Object.freeze({ categories, result: "REJECTED", message }),
        ),
      ),
      accessor: Object.freeze({ result: "REJECTED", invoked: accessorInvoked }),
      hostileValues: Object.freeze(hostileResults),
      executableBindingFields: Object.freeze({
        behaviorProduction: "ABSENT",
        operationExecute: "ABSENT",
        resourceRead: "ABSENT",
      }),
      opaquePrototypeKeys: Object.freeze(["__proto__", "constructor", "prototype"]),
      componentMapKeys: Object.freeze(["__proto__", "constructor"]),
      behaviorMapKeys: Object.freeze(["behavior.__proto__"]),
      operationMapKeys: Object.freeze(["operation.constructor"]),
      resourceMapKeys: Object.freeze(["resource.prototype"]),
      caseSensitiveIds: Object.freeze({
        components: Object.freeze(["com.example.ui/Text", "com.example.ui/text"]),
        behaviors: Object.freeze([
          "com.example.interactions/Sortable",
          "com.example.interactions/sortable",
        ]),
        operations: Object.freeze(["com.example.operations/Save", "com.example.operations/save"]),
        resources: Object.freeze(["com.example.resources/Stores", "com.example.resources/stores"]),
      }),
      validator: Object.freeze({ valid: true, diagnostics: 0 }),
      inspectorControls: inspector.transcript,
    }),
  });
}

async function loadPublicApis() {
  const [catalogApi, validatorApi] = await Promise.all([
    import(CATALOG_API_URL.href),
    import(VALIDATOR_API_URL.href),
  ]);
  return Object.freeze({ catalogApi, validatorApi });
}

function verifyPublicRuntimeApis(catalogApi, validatorApi) {
  const runtimeExports = Object.keys(catalogApi).sort();
  assertJsonEqual(
    runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "catalog-sdk runtime exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    if (typeof catalogApi[name] !== "function") {
      fail("CATALOG_REGISTRATION_PUBLIC_API_DRIFT", `${name} is not a runtime function.`);
    }
  }
  if (typeof validatorApi.validateDesenCatalogSemantics !== "function") {
    fail("CATALOG_REGISTRATION_PREREQUISITE_API_DRIFT", "Catalog semantic validator is missing.");
  }
  return runtimeExports;
}

async function readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) return Buffer.isBuffer(override) ? override : Buffer.from(override);
  const absolutePath = path.join(workspaceRoot, relativePath);
  const entry = await lstat(absolutePath);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("CATALOG_REGISTRATION_TRACKED_FILE_INVALID", "A proof input is not a regular file.", {
      path: relativePath,
    });
  }
  return readFile(absolutePath);
}

async function discoverCatalogFiles(workspaceRoot, relativeDirectory, pattern, fileOverrides) {
  const discovered = new Set();
  const absoluteDirectory = path.join(workspaceRoot, relativeDirectory);

  async function walk(absolutePath, relativePath) {
    for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
      const childAbsolute = path.join(absolutePath, entry.name);
      const childRelative = path.posix.join(relativePath, entry.name);
      if (entry.isSymbolicLink()) {
        fail("CATALOG_REGISTRATION_TRACKED_FILE_INVALID", "Catalog source contains a symlink.", {
          path: childRelative,
        });
      } else if (entry.isDirectory()) {
        await walk(childAbsolute, childRelative);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        discovered.add(childRelative);
      }
    }
  }

  await walk(absoluteDirectory, relativeDirectory);
  for (const relativePath of Object.keys(fileOverrides ?? {})) {
    if (
      relativePath.startsWith(`${relativeDirectory}/`) &&
      pattern.test(path.basename(relativePath))
    ) {
      discovered.add(relativePath);
    }
  }
  return [...discovered].sort();
}

function parseTypescript(text, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".js") || relativePath.endsWith(".mjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("CATALOG_REGISTRATION_SOURCE_PARSE_DRIFT", "A proof input is not valid TypeScript.", {
      path: relativePath,
      diagnostic: sourceFile.parseDiagnostics[0]?.messageText,
    });
  }
  return sourceFile;
}

function exportedNames(text, relativePath) {
  const sourceFile = parseTypescript(text, relativePath);
  const runtime = new Set();
  const types = new Set();
  const hasExportModifier = (node) =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

  for (const statement of sourceFile.statements) {
    if (ts.isModuleDeclaration(statement) || ts.isNamespaceExportDeclaration(statement)) {
      fail(
        "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
        "Namespaces, ambient globals, and module augmentations are forbidden in catalog-sdk.",
        { path: relativePath },
      );
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
        fail("CATALOG_REGISTRATION_PUBLIC_API_DRIFT", "Wildcard exports are not allowed.", {
          path: relativePath,
        });
      }
      for (const element of statement.exportClause.elements) {
        const target = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
        target.add(element.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      runtime.add("default");
      continue;
    }
    if (!hasExportModifier(statement)) continue;
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      types.add(statement.name.text);
    } else if (ts.isFunctionDeclaration(statement)) {
      runtime.add(statement.name?.text ?? "default");
    } else if (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
      const name = statement.name?.text ?? "default";
      runtime.add(name);
      types.add(name);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) runtime.add(declaration.name.text);
        else runtime.add("<binding-pattern>");
      }
    } else {
      fail(
        "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
        "An unrecognized exported declaration crossed the public audit.",
        { path: relativePath, syntaxKind: ts.SyntaxKind[statement.kind] },
      );
    }
  }
  return Object.freeze({ runtime: [...runtime].sort(), types: [...types].sort() });
}

function moduleSpecifiers(text, relativePath) {
  const sourceFile = parseTypescript(text, relativePath);
  if (
    sourceFile.libReferenceDirectives.length > 0 ||
    sourceFile.typeReferenceDirectives.length > 0 ||
    sourceFile.referencedFiles.length > 0
  ) {
    fail(
      "CATALOG_REGISTRATION_PLATFORM_LEAK",
      "Triple-slash library, type, and path references are forbidden in catalog-sdk.",
      { path: relativePath },
    );
  }
  const specifiers = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(Object.freeze({ kind: "static", specifier: node.moduleSpecifier.text }));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) {
        fail(
          "CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT",
          "Dynamic imports must not use computed module specifiers.",
          { path: relativePath },
        );
      }
      specifiers.push(Object.freeze({ kind: "dynamic", specifier: node.arguments[0].text }));
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      fail(
        "CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT",
        "CommonJS runtime loading is forbidden in the neutral package.",
        { path: relativePath },
      );
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(Object.freeze({ kind: "type", specifier: node.argument.literal.text }));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function testTitles(text, relativePath, functionName) {
  const sourceFile = parseTypescript(text, relativePath);
  const titles = [];

  function assertPlacement(node, title) {
    const statement = node.parent;
    if (!ts.isExpressionStatement(statement)) {
      fail("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT", "A test is conditionally wrapped.", {
        path: relativePath,
        title,
      });
    }
    if (functionName === "test") {
      if (!ts.isSourceFile(statement.parent)) {
        fail("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT", "A root test is not top-level.", {
          path: relativePath,
          title,
        });
      }
      return;
    }

    const block = statement.parent;
    const suiteCallback = ts.isBlock(block) ? block.parent : undefined;
    const describeCall =
      suiteCallback !== undefined &&
      (ts.isArrowFunction(suiteCallback) || ts.isFunctionExpression(suiteCallback))
        ? suiteCallback.parent
        : undefined;
    const describeStatement =
      describeCall !== undefined && ts.isCallExpression(describeCall)
        ? describeCall.parent
        : undefined;
    if (
      !ts.isBlock(block) ||
      suiteCallback === undefined ||
      (!ts.isArrowFunction(suiteCallback) && !ts.isFunctionExpression(suiteCallback)) ||
      !ts.isCallExpression(describeCall) ||
      !ts.isIdentifier(describeCall.expression) ||
      describeCall.expression.text !== "describe" ||
      describeCall.arguments.length !== 2 ||
      !ts.isStringLiteral(describeCall.arguments[0]) ||
      describeCall.arguments[1] !== suiteCallback ||
      !ts.isExpressionStatement(describeStatement) ||
      !ts.isSourceFile(describeStatement.parent)
    ) {
      fail(
        "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
        "A package test is not a direct statement in a top-level describe callback.",
        { path: relativePath, title },
      );
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const eachFactory = ts.isCallExpression(node.expression) ? node.expression : undefined;
      const eachAccess =
        eachFactory !== undefined && ts.isPropertyAccessExpression(eachFactory.expression)
          ? eachFactory.expression
          : undefined;
      if (
        functionName === "it" &&
        eachFactory !== undefined &&
        eachAccess !== undefined &&
        ts.isIdentifier(eachAccess.expression) &&
        eachAccess.expression.text === "it" &&
        eachAccess.name.text === "each"
      ) {
        const table = eachFactory.arguments[0];
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (
          eachFactory.arguments.length !== 1 ||
          table === undefined ||
          !ts.isArrayLiteralExpression(table) ||
          node.arguments.length !== 2 ||
          title === undefined ||
          !ts.isStringLiteral(title) ||
          callback === undefined ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
          table.elements.some((row) => !ts.isArrayLiteralExpression(row))
        ) {
          fail(
            "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
            "A parameterized package test must use one static array table.",
            { path: relativePath },
          );
        }
        assertPlacement(node, title.text);
        table.elements.forEach((_row, index) => {
          titles.push(`${title.text} [case ${index + 1}]`);
        });
        return;
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === functionName) {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (
          node.arguments.length !== 2 ||
          title === undefined ||
          !ts.isStringLiteral(title) ||
          callback === undefined ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
        ) {
          fail("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT", "A test shape is not executable.", {
            path: relativePath,
          });
        }
        assertPlacement(node, title.text);
        titles.push(title.text);
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ["describe", "it", "suite", "test"].includes(node.expression.expression.text)
      ) {
        fail(
          "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
          "Skipped or modified tests are forbidden.",
          {
            path: relativePath,
            modifier: node.expression.name.text,
          },
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return titles;
}

function negativeCaseLabels(text, relativePath) {
  const sourceFile = parseTypescript(text, relativePath);
  return (sourceFile.commentDirectives ?? [])
    .filter(({ type }) => type === ts.CommentDirectiveType.ExpectError)
    .map(({ range }) => {
      const directive = text.slice(range.pos, range.end);
      const match = /@ts-expect-error\s+(M03-T0[123]-N\d{2})\b/u.exec(directive);
      if (match === null) {
        fail(
          "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
          "Every compiler-recognized expect-error directive needs a stable M03-T01, M03-T02, or M03-T03 case id.",
          { path: relativePath },
        );
      }
      return match[1];
    });
}

async function verifyTestInventory(workspaceRoot, fileOverrides) {
  const packageTestPaths = [
    "packages/catalog-sdk/test/catalog-manifest-registration.test.ts",
    "packages/catalog-sdk/test/component-inspector-control.test.ts",
  ];
  const typeTestPaths = [
    "packages/catalog-sdk/test/public-api.types.ts",
    "packages/catalog-sdk/test/schema-type-derivation.types.ts",
  ];
  const rootTestPath = "tests/catalog-manifest-registration.test.mjs";
  const allPaths = [...packageTestPaths, ...typeTestPaths, rootTestPath];
  const texts = await Promise.all(
    allPaths.map(async (relativePath) =>
      (await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides)).toString("utf8"),
    ),
  );
  const textByPath = new Map(allPaths.map((relativePath, index) => [relativePath, texts[index]]));
  const packageTitles = packageTestPaths.flatMap((relativePath) =>
    testTitles(textByPath.get(relativePath), relativePath, "it"),
  );
  const rootTitles = testTitles(textByPath.get(rootTestPath), rootTestPath, "test");
  const negativeCases = typeTestPaths.flatMap((relativePath) =>
    negativeCaseLabels(textByPath.get(relativePath), relativePath),
  );
  assertJsonEqual(
    packageTitles,
    EXPECTED_PACKAGE_TEST_TITLES,
    "package test inventory",
    "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
  );
  assertJsonEqual(
    rootTitles,
    EXPECTED_ROOT_TEST_TITLES,
    "root test inventory",
    "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
  );
  assertJsonEqual(
    negativeCases,
    EXPECTED_TYPE_NEGATIVE_CASES,
    "compile-time negative inventory",
    "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
  );
  return Object.freeze({
    packageTests: packageTitles.length,
    compileTimeNegativeCases: negativeCases.length,
    rootEvidenceTests: rootTitles.length,
  });
}

function commandSegments(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail("CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT", `${label} is missing.`);
  }
  return value.split(/\s*&&\s*/u);
}

function assertExactCommandSegments(actual, expected, label) {
  assertJsonEqual(
    commandSegments(actual, label),
    expected,
    label,
    "CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT",
  );
}

async function verifyCommandWiring(workspaceRoot, fileOverrides) {
  const rootPackage = JSON.parse(
    (await readWorkspaceBytes(workspaceRoot, "package.json", fileOverrides)).toString("utf8"),
  );
  const catalogPackage = JSON.parse(
    (
      await readWorkspaceBytes(workspaceRoot, "packages/catalog-sdk/package.json", fileOverrides)
    ).toString("utf8"),
  );
  assertExactCommandSegments(
    rootPackage.scripts?.["generate:catalog-manifest-registration"],
    EXPECTED_COMMANDS.generate,
    "generate command",
  );
  assertExactCommandSegments(
    rootPackage.scripts?.["verify:catalog-manifest-registration"],
    EXPECTED_COMMANDS.verify,
    "verify command",
  );
  assertExactCommandSegments(
    rootPackage.scripts?.["test:catalog-manifest-registration"],
    EXPECTED_COMMANDS.test,
    "test command",
  );
  assertExactCommandSegments(
    rootPackage.scripts?.test,
    EXPECTED_ROOT_TEST_COMMAND,
    "root test command",
  );
  assertExactCommandSegments(
    rootPackage.scripts?.check,
    EXPECTED_ROOT_CHECK_COMMAND,
    "root check command",
  );
  assertExactCommandSegments(
    rootPackage.scripts?.boundaries,
    EXPECTED_BOUNDARY_COMMAND,
    "boundary command",
  );
  const expectedPackageScripts = {
    build: "tsc -p tsconfig.build.json",
    typecheck: "tsc -p tsconfig.json --noEmit",
    "test:manifest-derivation": "vitest run test/component-inspector-control.test.ts",
    "test:manifest-registration": "vitest run test/catalog-manifest-registration.test.ts",
  };
  for (const [name, expected] of Object.entries(expectedPackageScripts)) {
    assertEqual(
      catalogPackage.scripts?.[name],
      expected,
      `catalog-sdk ${name}`,
      "CATALOG_REGISTRATION_COMMAND_WIRING_DRIFT",
    );
  }
  return Object.freeze({
    generate: Object.freeze([...EXPECTED_COMMANDS.generate]),
    verify: Object.freeze([...EXPECTED_COMMANDS.verify]),
    test: Object.freeze([...EXPECTED_COMMANDS.test]),
    rootTest: Object.freeze([...EXPECTED_ROOT_TEST_COMMAND]),
    rootCheck: Object.freeze([...EXPECTED_ROOT_CHECK_COMMAND]),
    boundaries: Object.freeze([...EXPECTED_BOUNDARY_COMMAND]),
  });
}

async function verifyPlatformBoundary(workspaceRoot, fileOverrides) {
  const sourcePaths = await discoverCatalogFiles(
    workspaceRoot,
    "packages/catalog-sdk/src",
    /\.tsx?$/u,
    fileOverrides,
  );
  const declarationPaths = await discoverCatalogFiles(
    workspaceRoot,
    "packages/catalog-sdk/dist",
    /\.d\.ts$/u,
    fileOverrides,
  );
  const distributionPaths = await discoverCatalogFiles(
    workspaceRoot,
    "packages/catalog-sdk/dist",
    /(?:\.d\.ts|\.js)$/u,
    fileOverrides,
  );
  assertJsonEqual(
    sourcePaths,
    EXPECTED_SOURCE_PATHS,
    "catalog-sdk source inventory",
    "CATALOG_REGISTRATION_SOURCE_INVENTORY_DRIFT",
  );
  assertJsonEqual(
    declarationPaths,
    EXPECTED_DECLARATION_PATHS,
    "catalog-sdk declaration inventory",
    "CATALOG_REGISTRATION_DISTRIBUTION_INVENTORY_DRIFT",
  );
  assertJsonEqual(
    distributionPaths,
    EXPECTED_DISTRIBUTION_PATHS,
    "catalog-sdk distribution inventory",
    "CATALOG_REGISTRATION_DISTRIBUTION_INVENTORY_DRIFT",
  );
  const sourceEntries = await Promise.all(
    sourcePaths.map(async (relativePath) => ({
      relativePath,
      text: (await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides)).toString("utf8"),
    })),
  );
  const declarationEntries = await Promise.all(
    declarationPaths.map(async (relativePath) => ({
      relativePath,
      text: (await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides)).toString("utf8"),
    })),
  );
  const javascriptEntries = await Promise.all(
    distributionPaths
      .filter((relativePath) => relativePath.endsWith(".js"))
      .map(async (relativePath) => ({
        relativePath,
        text: (await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides)).toString(
          "utf8",
        ),
      })),
  );
  const auditedEntries = [...sourceEntries, ...declarationEntries, ...javascriptEntries];
  for (const { relativePath, text } of auditedEntries) {
    for (const { label, pattern } of PLATFORM_PATTERNS) {
      if (pattern.test(text)) {
        fail("CATALOG_REGISTRATION_PLATFORM_LEAK", `${label} crossed the neutral boundary.`, {
          path: relativePath,
        });
      }
    }
  }

  for (const { relativePath, text } of auditedEntries) {
    for (const { kind, specifier } of moduleSpecifiers(text, relativePath)) {
      if (kind === "dynamic") {
        fail(
          "CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT",
          "Dynamic runtime imports are forbidden in the neutral package.",
          { path: relativePath, specifier },
        );
      }
      if (specifier !== "@desen/protocol" && !specifier.startsWith("./")) {
        fail(
          "CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT",
          "catalog-sdk source imported an undeclared implementation dependency.",
          { path: relativePath, specifier },
        );
      }
      if (specifier.startsWith("./")) {
        const expectedRoot = relativePath.includes("/src/")
          ? "packages/catalog-sdk/src/"
          : "packages/catalog-sdk/dist/";
        const resolved = path.posix.normalize(
          path.posix.join(path.posix.dirname(relativePath), specifier),
        );
        if (!resolved.startsWith(expectedRoot)) {
          fail(
            "CATALOG_REGISTRATION_IMPORT_BOUNDARY_DRIFT",
            "A relative import escaped the catalog-sdk source or distribution root.",
            { path: relativePath, specifier },
          );
        }
      }
    }
  }

  const indexSource = sourceEntries.find(({ relativePath }) => relativePath.endsWith("/index.ts"));
  const indexDeclaration = declarationEntries.find(({ relativePath }) =>
    relativePath.endsWith("/index.d.ts"),
  );
  if (indexSource === undefined || indexDeclaration === undefined) {
    fail("CATALOG_REGISTRATION_PUBLIC_API_DRIFT", "The public entrypoint is missing.");
  }
  for (const { relativePath, text } of declarationEntries) exportedNames(text, relativePath);
  const sourceExports = exportedNames(indexSource.text, indexSource.relativePath);
  const declarationExports = exportedNames(indexDeclaration.text, indexDeclaration.relativePath);
  assertJsonEqual(
    sourceExports.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "catalog-sdk source runtime exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  assertJsonEqual(
    declarationExports.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "catalog-sdk declaration runtime exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  assertJsonEqual(
    sourceExports.types,
    EXPECTED_TYPE_EXPORTS,
    "catalog-sdk source type exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  assertJsonEqual(
    declarationExports.types,
    EXPECTED_TYPE_EXPORTS,
    "catalog-sdk declaration type exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );

  const packageJson = JSON.parse(
    (
      await readWorkspaceBytes(workspaceRoot, "packages/catalog-sdk/package.json", fileOverrides)
    ).toString("utf8"),
  );
  assertJsonEqual(
    packageJson.dependencies,
    { "@desen/protocol": "workspace:*" },
    "catalog-sdk runtime dependencies",
    "CATALOG_REGISTRATION_DEPENDENCY_DRIFT",
  );
  assertEqual(
    packageJson.type,
    "module",
    "catalog-sdk package type",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  assertJsonEqual(
    packageJson.files,
    ["dist"],
    "catalog-sdk package files",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  assertJsonEqual(
    packageJson.exports,
    { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    "catalog-sdk package exports",
    "CATALOG_REGISTRATION_PUBLIC_API_DRIFT",
  );
  const tsconfig = JSON.parse(
    (
      await readWorkspaceBytes(workspaceRoot, "packages/catalog-sdk/tsconfig.json", fileOverrides)
    ).toString("utf8"),
  );
  assertJsonEqual(
    tsconfig.compilerOptions?.types,
    [],
    "catalog-sdk ambient types",
    "CATALOG_REGISTRATION_PLATFORM_LEAK",
  );
  const baseTsconfig = JSON.parse(
    (await readWorkspaceBytes(workspaceRoot, "tsconfig.base.json", fileOverrides)).toString("utf8"),
  );
  assertJsonEqual(
    tsconfig.compilerOptions?.lib ?? baseTsconfig.compilerOptions?.lib,
    ["ES2023"],
    "catalog-sdk effective libraries",
    "CATALOG_REGISTRATION_PLATFORM_LEAK",
  );

  return Object.freeze({
    sourceFiles: sourcePaths.length,
    declarationFiles: declarationPaths.length,
    sourcePaths: Object.freeze(sourcePaths),
    declarationPaths: Object.freeze(declarationPaths),
    distributionPaths: Object.freeze(distributionPaths),
    runtimeDependencies: Object.freeze(["@desen/protocol"]),
    typeExports: Object.freeze(sourceExports.types),
    ambientTypes: Object.freeze([]),
    forbiddenProfiles: Object.freeze(PLATFORM_PATTERNS.map(({ label }) => label)),
  });
}

async function verifyTrace(tracePath) {
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  const rules = EXPECTED_TRACE_RULES.map((expected) => {
    const actual = trace[expected.collection]?.find(({ id }) => id === expected.id);
    if (actual === undefined) {
      fail(
        "CATALOG_REGISTRATION_TRACE_DRIFT",
        `Trace rule ${expected.id} is missing from ${expected.collection}.`,
      );
    }
    assertEqual(
      actual.section,
      expected.section,
      `${expected.id} section`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    assertJsonEqual(
      actual.owners,
      expected.owners,
      `${expected.id} owners`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    assertJsonEqual(
      actual.tests,
      expected.tests,
      `${expected.id} tests`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    return Object.freeze({
      collection: expected.collection,
      id: actual.id,
      section: actual.section,
      summary: actual.summary,
      owners: Object.freeze([...actual.owners]),
      finalTestOwners: Object.freeze([...actual.tests]),
    });
  });
  const schemaFamilies = EXPECTED_SCHEMA_FAMILIES.map((expected) => {
    const actual = trace.schemaFamilies?.find(({ id }) => id === expected.id);
    if (actual === undefined) {
      fail("CATALOG_REGISTRATION_TRACE_DRIFT", `Trace schema family ${expected.id} is missing.`);
    }
    assertEqual(
      actual.summary,
      expected.summary,
      `${expected.id} summary`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    assertEqual(
      actual.expectedConstraints,
      expected.expectedConstraints,
      `${expected.id} constraint count`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    assertJsonEqual(
      actual.semanticOwners,
      expected.semanticOwners,
      `${expected.id} semantic owners`,
      "CATALOG_REGISTRATION_TRACE_DRIFT",
    );
    return Object.freeze({
      id: actual.id,
      summary: actual.summary,
      expectedConstraints: actual.expectedConstraints,
      semanticOwners: Object.freeze([...actual.semanticOwners]),
    });
  });
  const schemaConstraints = schemaFamilies.reduce(
    (total, family) => total + family.expectedConstraints,
    0,
  );
  assertEqual(
    schemaConstraints,
    34,
    "M03-T03 schema constraint total",
    "CATALOG_REGISTRATION_TRACE_DRIFT",
  );
  return Object.freeze({
    rules: Object.freeze(rules),
    schemaFamilies: Object.freeze(schemaFamilies),
    schemaConstraints,
  });
}

async function verifyPrerequisite(verify) {
  const bytes = await readFile(DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH);
  const artifact = JSON.parse(bytes.toString("utf8"));
  if (artifact.result !== "PASS" || artifact.task !== "M02-T13") {
    fail("CATALOG_REGISTRATION_PREREQUISITE_DRIFT", "The G02 closing artifact is not passing.");
  }
  if (verify) await verifyProtocolValidatorDiagnosticMicroVectors();
  return Object.freeze({
    gate: "G02",
    closingTask: "M02-T13",
    artifact: path.relative(
      WORKSPACE_ROOT,
      DEFAULT_PROTOCOL_VALIDATOR_DIAGNOSTIC_MICRO_VECTORS_ARTIFACT_PATH,
    ),
    sha256: sha256(bytes),
    result: "PASS",
  });
}

async function fileInventory(workspaceRoot, relativePaths, fileOverrides) {
  return Promise.all(
    [...relativePaths].sort().map(async (relativePath) => {
      const bytes = await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

async function assertArtifactDestinationEntry(artifactPath) {
  try {
    const entry = await lstat(artifactPath);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "CATALOG_REGISTRATION_ARTIFACT_UNSUPPORTED_ENTRY",
        "The cumulative M03-T01 through M03-T03 artifact destination must be absent or a regular file.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function resolveWritableArtifactPath(artifactPath) {
  const absolute = path.resolve(artifactPath);
  const parent = path.dirname(absolute);
  const parentEntry = await lstat(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    fail(
      "CATALOG_REGISTRATION_ARTIFACT_UNSUPPORTED_ENTRY",
      "The cumulative M03-T01 through M03-T03 artifact parent must be a real directory.",
    );
  }
  const resolvedParent = await realpath(parent);
  const resolvedArtifactPath = path.join(resolvedParent, path.basename(absolute));
  await assertArtifactDestinationEntry(resolvedArtifactPath);
  return Object.freeze({ resolvedArtifactPath, resolvedParent });
}

async function openExclusiveTemporary(parent, basename) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const temporaryPath = path.join(
      parent,
      `.${basename}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      return { handle: await open(temporaryPath, "wx+", 0o600), temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail(
    "CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CREATE_FAILED",
    "Could not reserve a temporary cumulative M03-T01 through M03-T03 artifact.",
  );
}

async function readHandleBytes(handle, byteLength) {
  const bytes = Buffer.alloc(byteLength);
  let offset = 0;
  while (offset < byteLength) {
    const { bytesRead } = await handle.read(bytes, offset, byteLength - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  const extra = Buffer.alloc(1);
  const { bytesRead: extraBytes } = await handle.read(extra, 0, 1, byteLength);
  if (offset !== byteLength || extraBytes !== 0) {
    fail("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED", "Temporary evidence length changed.");
  }
  return bytes;
}

async function verifyTemporaryIdentityAndBytes(handle, temporaryPath, expectedBytes) {
  let pathEntry;
  try {
    pathEntry = await lstat(temporaryPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED", "Temporary evidence disappeared.");
    }
    throw error;
  }
  const handleEntry = await handle.stat();
  if (
    !handleEntry.isFile() ||
    !pathEntry.isFile() ||
    pathEntry.isSymbolicLink() ||
    handleEntry.dev !== pathEntry.dev ||
    handleEntry.ino !== pathEntry.ino ||
    handleEntry.nlink !== 1 ||
    pathEntry.nlink !== 1
  ) {
    fail("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED", "Temporary evidence identity changed.");
  }
  const actualBytes = await readHandleBytes(handle, expectedBytes.length);
  if (!actualBytes.equals(expectedBytes)) {
    fail("CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CHANGED", "Temporary evidence bytes changed.");
  }
  return handleEntry;
}

async function verifyCommittedEvidence(artifactPath, expectedEntry, expectedBytes) {
  const entry = await lstat(artifactPath);
  if (
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    entry.dev !== expectedEntry.dev ||
    entry.ino !== expectedEntry.ino
  ) {
    fail("CATALOG_REGISTRATION_ARTIFACT_COMMIT_CHANGED", "Committed evidence identity changed.");
  }
  const actualBytes = await readFile(artifactPath);
  if (!actualBytes.equals(expectedBytes)) {
    fail("CATALOG_REGISTRATION_ARTIFACT_COMMIT_CHANGED", "Committed evidence bytes changed.");
  }
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds cumulative deterministic M03-T01 through M03-T03 Catalog SDK evidence in memory. */
export async function buildCatalogManifestRegistrationEvidence({
  workspaceRoot = WORKSPACE_ROOT,
  tracePath = DEFAULT_CATALOG_MANIFEST_REGISTRATION_TRACE_PATH,
  catalogApi,
  validatorApi,
  fileOverrides,
  verifyG02 = true,
} = {}) {
  const loadedApis =
    catalogApi === undefined || validatorApi === undefined ? await loadPublicApis() : undefined;
  const activeCatalogApi = catalogApi ?? loadedApis.catalogApi;
  const activeValidatorApi = validatorApi ?? loadedApis.validatorApi;
  const runtimeExports = verifyPublicRuntimeApis(activeCatalogApi, activeValidatorApi);
  const [prerequisite, traceEvidence, platformBoundary, testInventory, commandWiring] =
    await Promise.all([
      verifyPrerequisite(verifyG02),
      verifyTrace(tracePath),
      verifyPlatformBoundary(workspaceRoot, fileOverrides),
      verifyTestInventory(workspaceRoot, fileOverrides),
      verifyCommandWiring(workspaceRoot, fileOverrides),
    ]);
  const [trackedFiles, distributionFiles] = await Promise.all([
    fileInventory(
      workspaceRoot,
      [...TRACKED_IMPLEMENTATION_PATHS, ...platformBoundary.sourcePaths],
      fileOverrides,
    ),
    fileInventory(workspaceRoot, platformBoundary.distributionPaths, fileOverrides),
  ]);
  const vectors = runContractVectors(activeCatalogApi, activeValidatorApi);

  const artifact = {
    schemaVersion: 1,
    profile: "desen-catalog-manifest-registration-proof-v3",
    task: "M03-T03",
    result: "PASS",
    protocol: Object.freeze({ version: "0.1.0", documentKind: "desen.catalog" }),
    prerequisite,
    claim: {
      summary:
        "Schema-authoritative capability manifests register as detached immutable JSON, component prop types derive from their literal schema, and deterministic inspector plans retain unsupported properties through explicit structured-JSON fallbacks.",
      directTraceRules: traceEvidence.rules,
      directSchemaFamilies: traceEvidence.schemaFamilies,
      directSchemaConstraints: traceEvidence.schemaConstraints,
      proofClaimStatusChanges: Object.freeze([]),
    },
    publicApi: {
      runtimeExports: Object.freeze(runtimeExports),
      typeExports: platformBoundary.typeExports,
      manifestAuthorities: Object.freeze({
        component: 'DesenCatalog["components"][string]',
        behavior: 'DesenCatalog["behaviors"][string]',
        operation: 'DesenCatalog["operations"][string]',
        resource: 'DesenCatalog["resources"][string]',
      }),
      componentPropsAuthority:
        'ComponentPropsOf<RegisteredComponent> derives from registration["manifest"]["propsSchema"]',
      inspectorAuthority:
        "propsSchema selects control kind, requiredness, enum options, and honest fallback",
      authoringControlHints: "detached opaque sidecars without schema authority",
      globalRegistryExported: false,
      executableBindingApiExported: false,
      registrationWrapperFields: Object.freeze(["id", "manifest"]),
      manifestRuntimeValidation: "@desen/validator",
      hostOperationAndResourceBindings: "deferred to M03-T08 and runtime layers",
      targetAdapters: "deferred to M05",
    },
    vectors: vectors.transcript,
    catalogGolden: vectors.catalog,
    inspectorControlGolden: vectors.inspectorPlan,
    platformBoundary,
    evidence: {
      ...testInventory,
      trackedFiles: Object.freeze(trackedFiles),
      distributionFiles: Object.freeze(distributionFiles),
      commandWiring,
      artifactWriter: Object.freeze({
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        temporaryVerification: "open-handle identity and exact bytes",
        commit: "atomic rename",
        postCommitVerification: "same inode and exact bytes",
        failureCleanup: "temporary file removed",
      }),
    },
    scope: {
      included: Object.freeze([
        "component manifest registration",
        "behavior manifest registration",
        "operation manifest registration",
        "resource manifest registration",
        "complete four-category Catalog composition",
        "component-only caller compatibility with empty optional-category maps",
        "same-category and cross-category duplicate capability-id rejection",
        "detached canonical-key-ordered deep-frozen JSON snapshots",
        "manifest-only API boundary without executable host bindings",
        "manifest-authoritative component prop TypeScript projection",
        "deterministic platform-neutral component inspector-control derivation",
        "RFC 6901 value, schema, and hint pointers",
        "opaque non-authoritative authoring control hints",
        "explicit structured-JSON fallback for unsupported or over-budget schema subtrees",
        "built declaration and production-source platform audit",
      ]),
      deferred: Object.freeze([
        "M03-T04 deterministic Web-React package digest profile",
        "M03-T05 and M03-T06 reference components",
        "M03-T08 host operation binding and M04 host operation/resource ports",
        "M03-T09 manifest-to-implementation parity",
        "M03-T10 final package artifact and exact tuple",
        "M05 target renderer adapter registration",
        "M09 concrete inspector widgets, binding editors, and hint-profile interpretation",
      ]),
    },
    limitations: Object.freeze([
      "The SDK accepts programmatic object input; duplicate members already lost by an external JSON parser cannot be detected here.",
      "A general JavaScript Proxy cannot be classified without allowing its traps to run; callers must not use proxies as authoring input.",
      "Promise, generator, iterator, and host-exotic internal slots have no universal side-effect-free ECMAScript brand probe; if their prototypes are deliberately replaced with Object.prototype, their observable enumerable data shape is what gets snapshotted.",
      "TypeScript may erase extra-property information when a structural union member absorbs another member; Catalog structural validation remains authoritative for nested manifest shape in that language-level edge case.",
      "The atomic writer assumes its real parent directory is not concurrently controlled by an attacker during the final verified rename window.",
      "TypeScript projections and inert snapshotting do not replace Catalog structural or semantic validation.",
      "JsonSchemaValue is a conservative TypeScript projection; unsupported Draft 2020-12 features fall back to JsonValue rather than pretending to be exact.",
      "DESEN 0.1.0 defines no authoring.controls vocabulary; PF-025 keeps hints opaque and non-authoritative.",
      "The component inspector plan is framework-neutral metadata, not a concrete editor widget tree.",
      "packageDigest is caller-supplied until M03-T04 defines the deterministic Web-React package profile.",
      "Manifest registration intentionally does not carry executable behavior production, operation execute, or resource read functions; host bindings remain a later runtime responsibility recorded by PF-024.",
      "Direct trace ownership confirms registration and derivation primitives only; concrete editor widgets, authorization, host execution, read-only resource behavior, adapter integration, and final parity remain assigned to later tasks.",
      "No P-* claim changes status and G03 remains open.",
    ]),
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Verifies the tracked cumulative M03-T01 through M03-T03 artifact against a fresh rebuild. */
export async function verifyCatalogManifestRegistration({
  artifactPath = DEFAULT_CATALOG_MANIFEST_REGISTRATION_ARTIFACT_PATH,
  artifactBytes,
  ...buildOptions
} = {}) {
  const expected = await buildCatalogManifestRegistrationEvidence(buildOptions);
  const actualBytes = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail(
      "CATALOG_REGISTRATION_ARTIFACT_DRIFT",
      "The tracked M03-T01 through M03-T03 artifact differs from a fresh evidence build.",
      { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
    typeExports: EXPECTED_TYPE_EXPORTS.length,
    hostileValues: expected.artifact.vectors.hostileValues.length,
    inspectorHostileValues: expected.artifact.vectors.inspectorControls.hostileValues.length,
    inspectorFallbacks: expected.artifact.vectors.inspectorControls.fallbackCases.length,
    packageTests: expected.artifact.evidence.packageTests,
    schemaConstraints: expected.artifact.claim.directSchemaConstraints,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes cumulative M03-T01 through M03-T03 evidence through a same-directory atomic rename. */
export async function writeCatalogManifestRegistrationEvidence({
  artifactPath = DEFAULT_CATALOG_MANIFEST_REGISTRATION_ARTIFACT_PATH,
  beforeAtomicRename,
  buildOptions = {},
} = {}) {
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildCatalogManifestRegistrationEvidence(buildOptions);
  const { handle, temporaryPath } = await openExclusiveTemporary(
    resolvedParent,
    path.basename(resolvedArtifactPath),
  );
  let openHandle = handle;
  try {
    await openHandle.writeFile(result.artifactBytes);
    await openHandle.sync();
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({ artifactPath: resolvedArtifactPath, temporaryPath }),
      );
    }
    const temporaryEntry = await verifyTemporaryIdentityAndBytes(
      openHandle,
      temporaryPath,
      result.artifactBytes,
    );
    await assertArtifactDestinationEntry(resolvedArtifactPath);
    await rename(temporaryPath, resolvedArtifactPath);
    await verifyCommittedEvidence(resolvedArtifactPath, temporaryEntry, result.artifactBytes);
    await openHandle.close();
    openHandle = undefined;
    return result;
  } catch (error) {
    if (openHandle !== undefined) {
      try {
        await openHandle.close();
      } catch {
        // Preserve the primary writer failure.
      }
    }
    try {
      await removeTemporary(temporaryPath);
    } catch (cleanupError) {
      fail(
        "CATALOG_REGISTRATION_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
        "Cumulative M03-T01 through M03-T03 evidence failed and its temporary file could not be removed.",
        {
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}
