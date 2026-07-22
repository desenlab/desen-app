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

/** Absolute path to the deterministic M03-T01 evidence artifact. */
export const DEFAULT_CATALOG_MANIFEST_REGISTRATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/catalog-sdk-0.1.0-manifest-registration.json",
);

/** Absolute path to the reviewed protocol trace ledger used by M03-T01. */
export const DEFAULT_CATALOG_MANIFEST_REGISTRATION_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["createCatalogManifest", "registerComponent"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "ComponentManifest",
  "CreateCatalogManifestInput",
  "ImmutableJson",
  "JsonInput",
  "JsonPrimitive",
  "RegisterComponentInput",
  "RegisteredComponent",
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
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    id: "R-013",
    section: "6.1.3",
    owners: Object.freeze(["M03-T01", "M03-T10"]),
    tests: Object.freeze(["M03-T09", "M03-T10"]),
  }),
  Object.freeze({
    id: "R-084",
    section: "21.2",
    owners: Object.freeze(["M03-T01", "M03-T03"]),
    tests: Object.freeze(["M03-T09"]),
  }),
]);
const EXPECTED_SOURCE_PATHS = Object.freeze([
  "packages/catalog-sdk/src/catalog-manifest.ts",
  "packages/catalog-sdk/src/component-registration.ts",
  "packages/catalog-sdk/src/index.ts",
  "packages/catalog-sdk/src/inert-json.ts",
]);
const EXPECTED_DECLARATION_PATHS = Object.freeze([
  "packages/catalog-sdk/dist/catalog-manifest.d.ts",
  "packages/catalog-sdk/dist/component-registration.d.ts",
  "packages/catalog-sdk/dist/index.d.ts",
  "packages/catalog-sdk/dist/inert-json.d.ts",
]);
const EXPECTED_DISTRIBUTION_PATHS = Object.freeze([
  "packages/catalog-sdk/dist/catalog-manifest.d.ts",
  "packages/catalog-sdk/dist/catalog-manifest.js",
  "packages/catalog-sdk/dist/component-registration.d.ts",
  "packages/catalog-sdk/dist/component-registration.js",
  "packages/catalog-sdk/dist/index.d.ts",
  "packages/catalog-sdk/dist/index.js",
  "packages/catalog-sdk/dist/inert-json.d.ts",
  "packages/catalog-sdk/dist/inert-json.js",
]);
const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "packages/catalog-sdk/package.json",
  "packages/catalog-sdk/README.md",
  "tsconfig.base.json",
  "packages/catalog-sdk/tsconfig.json",
  "packages/catalog-sdk/tsconfig.build.json",
  "packages/catalog-sdk/test/catalog-manifest-registration.test.ts",
  "packages/catalog-sdk/test/public-api.types.ts",
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
  "builds the exact protocol root with empty later-category maps",
  "rejects duplicate ids even when their manifests are identical",
  "treats capability ids as exact, case-sensitive strings",
  "rejects unknown Catalog builder fields and forged registration records",
]);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T01 evidence",
  "two independent Catalog registration evidence builds are byte-identical",
  "rejects stale or one-byte-tampered evidence",
  "rejects direct protocol trace ownership drift",
  "rejects a forged mutable registration implementation",
  "checks every successful registration output for deep immutability",
  "rejects descriptor-only mutation of caller-owned nested input",
  "rejects an implementation that accepts distinct objects with a duplicate id",
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
]);
const EXPECTED_TYPE_NEGATIVE_CASES = Object.freeze(
  Array.from({ length: 21 }, (_, index) => `M03-T01-N${String(index + 1).padStart(2, "0")}`),
);
const EXPECTED_COMMANDS = Object.freeze({
  generate: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "node scripts/generate-catalog-manifest-registration-proof.mjs",
  ]),
  verify: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "node scripts/verify-catalog-manifest-registration.mjs",
  ]),
  test: Object.freeze([
    "pnpm --filter @desen/validator... build",
    "pnpm --filter @desen/catalog-sdk... build",
    "pnpm --filter @desen/catalog-sdk test:manifest-registration",
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

/** Stable failure raised by M03-T01 evidence generation and verification. */
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

function runContractVectors(catalogApi, validatorApi) {
  const preservedInputs = [];
  const frozenOutputs = [];
  const detachedOutputs = [];
  let successfulRegistrations = 0;
  let successfulCatalogs = 0;

  function registerObserved(input, label) {
    const graphBefore = captureObjectGraph(input);
    const canonicalBefore = canonicalizeJson(input);
    const output = catalogApi.registerComponent(input);
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

  function composeObserved(input, label) {
    const graphBefore = captureObjectGraph(input);
    const canonicalBefore = canonicalizeJson(input);
    const output = catalogApi.createCatalogManifest(input);
    const expectedComponents = Object.create(null);
    for (const registration of input.components) {
      expectedComponents[registration.id] = registration.manifest;
    }
    const expected = {
      kind: "desen.catalog",
      desen: "0.1.0",
      id: input.id,
      version: input.version,
      target: input.target,
      packageDigest: input.packageDigest,
      components: expectedComponents,
      behaviors: {},
      operations: {},
      resources: {},
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

  assertEqual(canonicalizeJson(first), canonicalizeJson(second), "insertion-order normalization");
  assertJsonEqual(
    Object.keys(first.manifest).sort(),
    EXPECTED_COMPONENT_FIELDS,
    "complete component contract fields",
  );

  const frozenRegistrationText = canonicalizeJson(first);
  mutableInput.manifest.description = "Caller mutation";
  mutableInput.manifest.propsSchema.properties.label.type = "number";
  mutableInput.manifest.visualStates.push("pressed");
  assertEqual(canonicalizeJson(first), frozenRegistrationText, "post-registration isolation");

  const catalogInput = {
    id: "com.example.catalog",
    version: "1.0.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    description: "M03-T01 proof Catalog.",
    components: [first],
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
  assertJsonEqual(catalog.behaviors, {}, "M03-T02 behavior scope fence");
  assertJsonEqual(catalog.operations, {}, "M03-T02 operation scope fence");
  assertJsonEqual(catalog.resources, {}, "M03-T02 resource scope fence");
  const validation = validatorApi.validateDesenCatalogSemantics(catalog);
  if (validation.valid !== true || validation.diagnostics.length !== 0) {
    fail("CATALOG_REGISTRATION_VALIDATOR_REJECTED", "The proof Catalog failed G02 validation.", {
      diagnostics: validation.diagnostics,
    });
  }

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
  expectTypeError(
    () => catalogApi.registerComponent({ ...richComponentInput(), production: null }),
    "executable wrapper field",
    /expected only id, manifest/u,
  );

  let accessorInvoked = false;
  const accessor = Object.defineProperty({}, "danger", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return "changed";
    },
  });
  expectTypeError(
    () =>
      catalogApi.registerComponent({
        id: "com.example.ui/Hostile",
        manifest: { propsSchema: {}, extensions: accessor },
      }),
    "accessor value",
  );
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
  const hostileResults = hostileValues.map(([id, value]) => {
    expectTypeError(
      () =>
        catalogApi.registerComponent({
          id: "com.example.ui/Hostile",
          manifest: { propsSchema: {}, extensions: { value } },
        }),
      `hostile ${id}`,
    );
    return Object.freeze({ id, result: "REJECTED" });
  });

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

  const upper = registerObserved(
    { id: "com.example.ui/Text", manifest: { propsSchema: {} } },
    "uppercase id registration",
  );
  const lower = registerObserved(
    { id: "com.example.ui/text", manifest: { propsSchema: {} } },
    "lowercase id registration",
  );
  const caseCatalog = composeObserved(
    { ...catalogInput, id: "com.example.case-catalog", components: [upper, lower] },
    "case-sensitive Catalog",
  );
  assertJsonEqual(
    Object.keys(caseCatalog.components),
    ["com.example.ui/Text", "com.example.ui/text"],
    "case-sensitive component ids",
  );

  const protoKey = registerObserved(
    { id: "__proto__", manifest: { propsSchema: {} } },
    "prototype-key registration",
  );
  const constructorKey = registerObserved(
    { id: "constructor", manifest: { propsSchema: {} } },
    "constructor-key registration",
  );
  const dangerousKeyCatalog = composeObserved(
    {
      ...catalogInput,
      id: "com.example.dangerous-key-catalog",
      components: [protoKey, constructorKey],
    },
    "dangerous-key Catalog",
  );
  if (
    !Object.hasOwn(dangerousKeyCatalog.components, "__proto__") ||
    !Object.hasOwn(dangerousKeyCatalog.components, "constructor") ||
    {}.polluted !== undefined
  ) {
    fail("CATALOG_REGISTRATION_COMPONENT_KEY_DRIFT", "Component map keys were not data-safe.");
  }

  return Object.freeze({
    catalog,
    transcript: Object.freeze({
      componentFields: EXPECTED_COMPONENT_FIELDS,
      registrationCanonicalSha256: sha256(Buffer.from(canonicalizeJson(first))),
      catalogCanonicalSha256: sha256(Buffer.from(canonicalizeJson(catalog))),
      deterministicRuns: 2,
      successfulRegistrations,
      successfulCatalogs,
      callerInputsPreserved: preservedInputs.length,
      deeplyFrozenOutputs: frozenOutputs.length,
      detachedOutputs: detachedOutputs.length,
      recognizedExoticOutputs: "REJECTED",
      duplicateId: Object.freeze({ result: "REJECTED", message: duplicateMessage }),
      accessor: Object.freeze({ result: "REJECTED", invoked: accessorInvoked }),
      hostileValues: Object.freeze(hostileResults),
      opaquePrototypeKeys: Object.freeze(["__proto__", "constructor", "prototype"]),
      componentMapKeys: Object.freeze(["__proto__", "constructor"]),
      caseSensitiveIds: Object.freeze(["com.example.ui/Text", "com.example.ui/text"]),
      validator: Object.freeze({ valid: true, diagnostics: 0 }),
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
  function visit(node) {
    if (ts.isCallExpression(node)) {
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
        const statement = node.parent;
        if (!ts.isExpressionStatement(statement)) {
          fail("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT", "A test is conditionally wrapped.", {
            path: relativePath,
            title: title.text,
          });
        }
        if (functionName === "test") {
          if (!ts.isSourceFile(statement.parent)) {
            fail("CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT", "A root test is not top-level.", {
              path: relativePath,
              title: title.text,
            });
          }
        } else {
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
              { path: relativePath, title: title.text },
            );
          }
        }
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
      const match = /@ts-expect-error\s+(M03-T01-N\d{2})\b/u.exec(directive);
      if (match === null) {
        fail(
          "CATALOG_REGISTRATION_TEST_INVENTORY_DRIFT",
          "Every compiler-recognized expect-error directive needs a stable M03-T01 case id.",
          { path: relativePath },
        );
      }
      return match[1];
    });
}

async function verifyTestInventory(workspaceRoot, fileOverrides) {
  const packageTestPath = "packages/catalog-sdk/test/catalog-manifest-registration.test.ts";
  const typeTestPath = "packages/catalog-sdk/test/public-api.types.ts";
  const rootTestPath = "tests/catalog-manifest-registration.test.mjs";
  const [packageText, typeText, rootText] = await Promise.all(
    [packageTestPath, typeTestPath, rootTestPath].map(async (relativePath) =>
      (await readWorkspaceBytes(workspaceRoot, relativePath, fileOverrides)).toString("utf8"),
    ),
  );
  const packageTitles = testTitles(packageText, packageTestPath, "it");
  const rootTitles = testTitles(rootText, rootTestPath, "test");
  const negativeCases = negativeCaseLabels(typeText, typeTestPath);
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
    const actual = trace.proseRules?.find(({ id }) => id === expected.id);
    if (actual === undefined) {
      fail("CATALOG_REGISTRATION_TRACE_DRIFT", `Trace rule ${expected.id} is missing.`);
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
      id: actual.id,
      section: actual.section,
      summary: actual.summary,
      owners: Object.freeze([...actual.owners]),
      finalTestOwners: Object.freeze([...actual.tests]),
    });
  });
  return Object.freeze(rules);
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
        "The M03-T01 artifact destination must be absent or a regular file.",
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
      "The M03-T01 artifact parent must be a real directory.",
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
    "Could not reserve a temporary M03-T01 artifact.",
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

/** Builds deterministic M03-T01 component-registration evidence in memory. */
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
  const [prerequisite, traceRules, platformBoundary, testInventory, commandWiring] =
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
    profile: "desen-catalog-manifest-registration-proof-v1",
    task: "M03-T01",
    result: "PASS",
    protocol: Object.freeze({ version: "0.1.0", documentKind: "desen.catalog" }),
    prerequisite,
    claim: {
      summary:
        "Component contracts register as detached, immutable, deterministic JSON and compose into a framework-neutral Catalog manifest.",
      directTraceRules: traceRules,
      proofClaimStatusChanges: Object.freeze([]),
    },
    publicApi: {
      runtimeExports: Object.freeze(runtimeExports),
      typeExports: platformBoundary.typeExports,
      componentManifestAuthority: 'DesenCatalog["components"][string]',
      registryApiExported: false,
      registrationWrapperFields: Object.freeze(["id", "manifest"]),
      manifestRuntimeValidation: "@desen/validator",
      targetAdapters: "deferred to M05",
    },
    vectors: vectors.transcript,
    catalogGolden: vectors.catalog,
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
        "complete Catalog root composition with empty later-category maps",
        "duplicate component-id rejection",
        "detached canonical-key-ordered deep-frozen JSON snapshots",
        "built declaration and production-source platform audit",
      ]),
      deferred: Object.freeze([
        "M03-T02 behavior, operation, and resource registration",
        "M03-T03 schema-authoritative TypeScript and inspector-control derivation",
        "M03-T04 deterministic Web-React package digest profile",
        "M03-T05 and M03-T06 reference components",
        "M03-T09 manifest-to-implementation parity",
        "M03-T10 final package artifact and exact tuple",
        "M05 target renderer adapter registration",
      ]),
    },
    limitations: Object.freeze([
      "The SDK accepts programmatic object input; duplicate members already lost by an external JSON parser cannot be detected here.",
      "A general JavaScript Proxy cannot be classified without allowing its traps to run; callers must not use proxies as authoring input.",
      "Promise, generator, iterator, and host-exotic internal slots have no universal side-effect-free ECMAScript brand probe; if their prototypes are deliberately replaced with Object.prototype, their observable enumerable data shape is what gets snapshotted.",
      "TypeScript may erase extra-property information when a structural union member absorbs another member; runtime exact-key checks remain authoritative for that language-level edge case.",
      "The atomic writer assumes its real parent directory is not concurrently controlled by an attacker during the final verified rename window.",
      "TypeScript projections and inert snapshotting do not replace Catalog structural or semantic validation.",
      "packageDigest is caller-supplied until M03-T04 defines the deterministic Web-React package profile.",
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

/** Verifies the tracked M03-T01 artifact against a fresh deterministic rebuild. */
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
      "The tracked M03-T01 artifact differs from a fresh evidence build.",
      { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
    typeExports: EXPECTED_TYPE_EXPORTS.length,
    hostileValues: expected.artifact.vectors.hostileValues.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes deterministic M03-T01 evidence through a same-directory atomic rename. */
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
        "M03-T01 evidence failed and its temporary file could not be removed.",
        {
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}
