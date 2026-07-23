import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import {
  buildCatalogManifestRegistrationEvidence,
  verifyCatalogManifestRegistration,
} from "./catalog-manifest-registration-proof.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const PROFILE_MAGIC = "DESEN-WEB-REACT-PACKAGE-DIGEST-V1\n";
const PLACEHOLDER = `sha256:${"0".repeat(64)}`;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const TYPED_ARRAY_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "length",
)?.get;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;
const UINT8_ARRAY_FILL = Uint8Array.prototype.fill;

/** Absolute path to the deterministic M03-T04 evidence artifact. */
export const DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-package-digest-v1.json",
);

const DEFAULT_TRACE_PATH = path.join(WORKSPACE_ROOT, "docs/proof/protocol-0.1.0-traceability.json");
const DEFAULT_PROFILE_DOCUMENT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/profiles/WEB-REACT-PACKAGE-DIGEST-V1.md",
);
const DEFAULT_PROFILE_API_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/package-consumer.mjs",
);
const DEFAULT_CATALOG_API_PATH = path.join(WORKSPACE_ROOT, "packages/catalog-sdk/dist/index.js");
const DEFAULT_PROTOCOL_API_PATH = path.join(WORKSPACE_ROOT, "packages/protocol/dist/index.js");
const DEFAULT_VALIDATOR_API_PATH = path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js");
const PROFILE_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/package-digest-profile.ts",
);
const PROFILE_INDEX_PATH = path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/src/index.ts");
const PROFILE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/package-digest-profile.test.ts",
);
const PROFILE_TYPE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/public-api.types.ts",
);
const ROOT_TEST_PATH = path.join(WORKSPACE_ROOT, "tests/web-react-package-digest.test.mjs");
const PROFILE_DECLARATION_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/dist/index.d.ts",
);
const PROFILE_MODULE_DECLARATION_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/dist/package-digest-profile.d.ts",
);
const PROFILE_DISTRIBUTION_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/dist/package-digest-profile.js",
);
const PROFILE_DISTRIBUTION_INDEX_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/dist/index.js",
);
const ROOT_PACKAGE_PATH = path.join(WORKSPACE_ROOT, "package.json");
const PROFILE_PACKAGE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/package.json",
);
const PROFILE_TSCONFIG_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/tsconfig.json",
);
const PROFILE_BUILD_TSCONFIG_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/tsconfig.build.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER",
  "WEB_REACT_PACKAGE_DIGEST_PROFILE",
  "createWebReactPackageDigest",
  "encodeWebReactPackageDigestPreimage",
  "verifyWebReactPackageDigest",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "WebReactPackageArtifactInput",
  "WebReactPackageDigestCalculationInput",
  "WebReactPackageDigest",
  "WebReactPackageDigestEntry",
  "WebReactPackageDigestVerificationInput",
]);
const REQUIRED_RUNTIME_EXPORT_SIGNATURES = Object.freeze(
  EXPECTED_RUNTIME_EXPORTS.map((name) => `runtime:${name}@./package-digest-profile.js`).sort(),
);
const REQUIRED_TYPE_EXPORT_SIGNATURES = Object.freeze(
  EXPECTED_TYPE_EXPORTS.map((name) => `type:${name}@./package-digest-profile.js`).sort(),
);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({ collection: "conformanceRules", id: "C-021", owners: ["M03-T04", "M03-T10"] }),
  Object.freeze({
    collection: "proseRules",
    id: "R-018",
    owners: ["M03-T04", "M06-T08", "M07-T03"],
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-021",
    owners: ["M03-T04", "M07-T03", "M12-T07"],
  }),
  Object.freeze({ collection: "proseRules", id: "R-030", owners: ["M03-T04", "M03-T10"] }),
  Object.freeze({
    collection: "proseRules",
    id: "R-136",
    owners: ["M03-T04", "M03-T10", "M06-T08"],
  }),
]);
const EXPECTED_PACKAGE_TESTS = 18;
const EXPECTED_ROOT_TESTS = 16;
const EXPECTED_TYPE_NEGATIVE_CASES = 5;
const GOLDEN_PREIMAGE_BYTES = 1_640;
const GOLDEN_PACKAGE_DIGEST =
  "sha256:bb22ecc7a2849fe7466d9b5cba7d2c99dc7f8c3bd17b7c505244b2c308359589";
const EXPECTED_MUTATION_VECTORS = 269;
const EXPECTED_PROFILE_METADATA = Object.freeze({
  id: "desen.web-react.package-digest",
  version: 1,
  target: "web-react",
  catalogPath: "catalog.json",
  catalogDigestPlaceholder: PLACEHOLDER,
  catalogDigestProjection: "replace-top-level-packageDigest-with-placeholder",
  pathOrdering: "lowercase-ascii-ascending",
  framing:
    "magic + uint32be(entry-count) + repeated uint16be(path-bytes), path, uint32be(content-bytes), content",
  limits: Object.freeze({
    artifacts: 1_024,
    catalogDepth: 128,
    catalogNodes: 100_000,
    entryBytes: 16 * 1_024 * 1_024,
    pathBytes: 240,
    preimageBytes: 64 * 1_024 * 1_024,
  }),
});
const EXPECTED_PACKAGE_TEST_TITLES = Object.freeze([
  "exposes a deeply frozen, bounded, target-specific profile",
  "matches the fixed framing and package digest golden",
  "is independent of Catalog key insertion order and artifact-list order",
  "verifies a published Catalog without mutating its self-referential digest field",
  "changes the package digest for every exact content, path, or Catalog change",
  "returns detached fresh bytes and deeply frozen byte-free audit metadata",
  "reads the exact Uint8Array subview rather than adjacent backing-buffer bytes",
  "does not mutate caller-owned Catalogs, lists, records, or bytes",
  "accepts an empty target-artifact inventory while still fingerprinting the Catalog",
  "rejects the wrong Catalog identity, protocol, target, or digest preimage value",
  "rejects reserved, duplicate, nonportable, ambiguous, and overlong paths",
  "accepts the maximum portable path length",
  "enforces byte-view and deterministic resource limits",
  "rejects sparse or decorated artifact arrays and the count above the profile limit",
  "rejects unknown wrapper or artifact fields",
  "rejects accessors without invoking them and snapshots Catalog identity once",
  "retains byte-level distinctions such as line endings and UTF-8 spelling",
  "separates entry boundaries even when concatenated path and content bytes look alike",
]);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T04 evidence",
  "two independent package-digest evidence builds are byte-identical",
  "rejects stale or one-byte-tampered evidence",
  "accepts exact Uint8Array bytes created in another JavaScript realm",
  "matches an independent Node SHA-256 oracle over the exact returned preimage",
  "rejects forged mutable, profile, or audit metadata",
  "rejects a forged encoder that changes the profile framing",
  "rejects a forged verifier that accepts a wrong published self-digest",
  "rejects a forged implementation that mutates caller-owned bytes",
  "rejects direct package-digest trace ownership drift",
  "rejects an incomplete package-digest profile document",
  "rejects Node or framework behavior injected into the shipped digest module",
  "rejects skipped package tests and fake compiler-negative inventory",
  "rejects runtime and declaration public-surface drift",
  "rejects missing root verifier, generator, test, or quality-gate wiring",
  "writes exact bytes atomically and rejects destination or temporary substitution",
]);
const EXPECTED_TYPE_NEGATIVE_LABELS = Object.freeze([
  "M03-T04-N01",
  "M03-T04-N02",
  "M03-T04-N03",
  "M03-T04-N04",
  "M03-T04-N05",
]);
const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm --filter @desen/validator... build && pnpm --filter @desen/catalog-sdk... build && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:package-digest-profile && node scripts/generate-web-react-package-digest-proof.mjs",
  verify:
    "pnpm --filter @desen/validator... build && pnpm --filter @desen/catalog-sdk... build && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:package-digest-profile && node scripts/verify-web-react-package-digest.mjs",
  test: "pnpm --filter @desen/validator... build && pnpm --filter @desen/catalog-sdk... build && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:package-digest-profile && node --test tests/web-react-package-digest.test.mjs",
});
const REQUIRED_PROFILE_DOCUMENT_TEXT = Object.freeze([
  "desen.web-react.package-digest",
  "version = 1",
  "target  = web-react",
  "DESEN-WEB-REACT-PACKAGE-DIGEST-V1",
  "## Catalog self-reference projection",
  "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "## Artifact paths",
  "Windows device names",
  "## Canonical entry order",
  "## Byte framing",
  "uint16be",
  "uint32be",
  "## Digest",
  'packageDigest = "sha256:" + lowercase_hex(SHA-256(complete_framed_preimage))',
  "## Immutability and limits",
  "1,024",
  "128",
  "100,000",
  "16 MiB",
  "64 MiB",
  "SharedArrayBuffer",
  "## Verification and non-claims",
  "not a universal DESEN archive",
]);
const FORBIDDEN_DISTRIBUTION_PATTERNS = Object.freeze([
  Object.freeze({ id: "node-buffer", pattern: /\bBuffer\b/u }),
  Object.freeze({ id: "network", pattern: /\b(?:fetch|WebSocket|XMLHttpRequest)\b/u }),
]);
const NODE_BUILTIN_SPECIFIERS = new Set(
  builtinModules.flatMap((specifier) => {
    const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
    return [bare, `node:${bare}`];
  }),
);
const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "packages/reference-catalog-web/src/package-digest-profile.ts",
  "packages/reference-catalog-web/test/package-digest-profile.test.ts",
  "packages/reference-catalog-web/test/public-api.types.ts",
  "packages/reference-catalog-web/test/package-consumer.mjs",
  "packages/reference-catalog-web/tsconfig.json",
  "packages/reference-catalog-web/tsconfig.build.json",
  "tsconfig.react-web.json",
  "tsconfig.base.json",
  "docs/profiles/WEB-REACT-PACKAGE-DIGEST-V1.md",
  "docs/proof/WEB-REACT-PACKAGE-DIGEST.md",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/web-react-package-digest-proof.mjs",
  "scripts/generate-web-react-package-digest-proof.mjs",
  "scripts/verify-web-react-package-digest.mjs",
  "tests/web-react-package-digest.test.mjs",
]);
const GOLDEN_ARTIFACTS = Object.freeze([
  Object.freeze({
    path: "adapters/authoring.js",
    text: 'export const authoringAdapter = Object.freeze({ id: "authoring" });\n',
  }),
  Object.freeze({
    path: "adapters/production.js",
    text: 'export const productionAdapter = Object.freeze({ id: "production" });\n',
  }),
  Object.freeze({
    path: "host/bindings.js",
    text: 'export const hostBindings = Object.freeze(["operation", "resource"]);\n',
  }),
  Object.freeze({
    path: "tokens/provider.json",
    text: '{"tokens":{"color.primary":"#3366ff","space.md":16}}\n',
  }),
]);

/** Stable internal failure raised by M03-T04 evidence generation and verification. */
export class WebReactPackageDigestEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "WebReactPackageDigestEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new WebReactPackageDigestEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Digest(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function ascii(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

function assertEqual(actual, expected, code, message, details = {}) {
  if (actual !== expected) fail(code, message, { expected, actual, ...details });
}

function assertArrayEqual(actual, expected, code, message) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(code, message, { expected, actual });
  }
}

function assertArrayContains(actual, expected, code, message) {
  const actualSet = new Set(actual);
  if (!expected.every((value) => actualSet.has(value))) {
    fail(code, message, { actual, expected });
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function assertExactFrozenData(actual, expected, dataPath = "/") {
  if (expected === null || typeof expected !== "object") {
    assertEqual(
      actual,
      expected,
      "WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT",
      `Digest audit data differs at ${dataPath}.`,
    );
    return;
  }
  if (
    actual === null ||
    typeof actual !== "object" ||
    Array.isArray(actual) !== Array.isArray(expected)
  ) {
    fail("WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT", `Digest audit shape differs at ${dataPath}.`);
  }
  if (!Object.isFrozen(actual)) {
    fail("WEB_REACT_PACKAGE_DIGEST_OUTPUT_MUTABLE", `Digest output is mutable at ${dataPath}.`);
  }

  const expectedPrototype = Array.isArray(expected) ? Array.prototype : Object.prototype;
  if (Object.getPrototypeOf(actual) !== expectedPrototype) {
    fail("WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT", `Digest audit prototype differs at ${dataPath}.`);
  }
  const actualKeys = Reflect.ownKeys(actual);
  const expectedKeys = Reflect.ownKeys(expected);
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !actualKeys.includes(key))
  ) {
    fail("WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT", `Digest audit keys differ at ${dataPath}.`);
  }

  for (const key of expectedKeys) {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key);
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key);
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      (key !== "length" && !actualDescriptor.enumerable)
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT",
        `Digest audit property differs at ${dataPath}${String(key)}.`,
      );
    }
    if (key !== "length") {
      assertExactFrozenData(
        actualDescriptor.value,
        expectedDescriptor.value,
        `${dataPath === "/" ? "/" : `${dataPath}/`}${String(key)}`,
      );
    } else {
      assertEqual(
        actualDescriptor.value,
        expectedDescriptor.value,
        "WEB_REACT_PACKAGE_DIGEST_AUDIT_DRIFT",
        `Digest audit array length differs at ${dataPath}.`,
      );
    }
  }
}

function captureStableProfileApi(api, runtimeNames) {
  const values = Object.create(null);
  for (const name of runtimeNames) {
    const descriptor = Object.getOwnPropertyDescriptor(api, name);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
        `Runtime export ${name} is not an enumerable data binding.`,
      );
    }
    values[name] = descriptor.value;
  }
  assertArrayContains(
    runtimeNames,
    EXPECTED_RUNTIME_EXPORTS,
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "The public runtime omits a required M03-T04 digest export.",
  );
  for (const name of [
    "createWebReactPackageDigest",
    "encodeWebReactPackageDigestPreimage",
    "verifyWebReactPackageDigest",
  ]) {
    if (typeof values[name] !== "function") {
      fail("WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT", `Runtime export ${name} is not callable.`);
    }
  }

  function assertStable() {
    assertArrayEqual(
      Object.keys(api).sort(),
      runtimeNames,
      "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
      "Runtime exports changed during proof execution.",
    );
    for (const name of runtimeNames) {
      const descriptor = Object.getOwnPropertyDescriptor(api, name);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        descriptor.value !== values[name]
      ) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PROFILE_SURFACE_MUTATED",
          `Runtime export ${name} changed during proof execution.`,
        );
      }
    }
  }

  function stableCall(name, input) {
    try {
      return Reflect.apply(values[name], undefined, [input]);
    } finally {
      assertStable();
    }
  }

  assertStable();
  return Object.freeze({
    WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER: values.WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
    WEB_REACT_PACKAGE_DIGEST_PROFILE: values.WEB_REACT_PACKAGE_DIGEST_PROFILE,
    createWebReactPackageDigest: (input) => stableCall("createWebReactPackageDigest", input),
    encodeWebReactPackageDigestPreimage: (input) =>
      stableCall("encodeWebReactPackageDigestPreimage", input),
    verifyWebReactPackageDigest: (input) => stableCall("verifyWebReactPackageDigest", input),
  });
}

function inspectByteOutput(value, label) {
  if (
    Buffer.isBuffer(value) ||
    !ArrayBuffer.isView(value) ||
    Object.getPrototypeOf(value) !== Uint8Array.prototype ||
    TYPED_ARRAY_TAG_GETTER === undefined ||
    TYPED_ARRAY_LENGTH_GETTER === undefined ||
    TYPED_ARRAY_BUFFER_GETTER === undefined ||
    TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
    TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
    ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_OUTPUT_BYTE_VIEW",
      `${label} is not a plain authentic Uint8Array.`,
    );
  }

  try {
    const tag = Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []);
    const length = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []);
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    if (tag !== "Uint8Array" || length !== byteLength) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_OUTPUT_BYTE_VIEW",
        `${label} is not an exact Uint8Array byte view.`,
      );
    }
    if (SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER !== undefined) {
      try {
        Reflect.apply(SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, []);
        fail(
          "WEB_REACT_PACKAGE_DIGEST_OUTPUT_BYTE_VIEW",
          `${label} uses shared mutable backing memory.`,
        );
      } catch (error) {
        if (error instanceof WebReactPackageDigestEvidenceError) throw error;
      }
    }
    Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, []);
    return Object.freeze({ buffer, byteOffset, byteLength });
  } catch (error) {
    if (error instanceof WebReactPackageDigestEvidenceError) throw error;
    return fail(
      "WEB_REACT_PACKAGE_DIGEST_OUTPUT_BYTE_VIEW",
      `${label} is detached or not ArrayBuffer-backed.`,
    );
  }
}

function assertFreshByteOutputs(left, leftView, right, rightView) {
  if (left === right || leftView.buffer === rightView.buffer) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_OUTPUT_ALIAS",
      "Independent encodings reused a byte view or backing ArrayBuffer.",
    );
  }
}

function captureCallerGraph(root) {
  const seen = new WeakSet();
  const records = [];

  function visit(value, valuePath) {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    const descriptors = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
          `Caller property disappeared while capturing ${valuePath}.`,
        );
      }
      return Object.freeze({ key, descriptor });
    });
    let byteHex;
    if (ArrayBuffer.isView(value) && TYPED_ARRAY_TAG_GETTER !== undefined) {
      try {
        if (Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) === "Uint8Array") {
          const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
          const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
          const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
          byteHex = Buffer.from(buffer, byteOffset, byteLength).toString("hex");
        }
      } catch {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
          `Caller bytes are detached at ${valuePath}.`,
        );
      }
    }
    records.push(
      Object.freeze({
        value,
        valuePath,
        prototype: Object.getPrototypeOf(value),
        extensible: Object.isExtensible(value),
        sealed: Object.isSealed(value),
        frozen: Object.isFrozen(value),
        keys: Object.freeze(keys),
        descriptors: Object.freeze(descriptors),
        byteHex,
      }),
    );
    for (const { key, descriptor } of descriptors) {
      if ("value" in descriptor) {
        visit(descriptor.value, `${valuePath === "/" ? "/" : `${valuePath}/`}${String(key)}`);
      }
    }
  }

  visit(root, "/");
  return Object.freeze(records);
}

function assertCallerGraphPreserved(records, phase) {
  for (const record of records) {
    const { value, valuePath, prototype, extensible, sealed, frozen, keys, descriptors, byteHex } =
      record;
    const currentKeys = Reflect.ownKeys(value);
    if (
      Object.getPrototypeOf(value) !== prototype ||
      Object.isExtensible(value) !== extensible ||
      Object.isSealed(value) !== sealed ||
      Object.isFrozen(value) !== frozen ||
      currentKeys.length !== keys.length ||
      keys.some((key, index) => currentKeys[index] !== key)
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
        `Caller structure changed at ${valuePath} during ${phase}.`,
      );
    }
    for (const { key, descriptor } of descriptors) {
      const current = Object.getOwnPropertyDescriptor(value, key);
      if (
        current === undefined ||
        current.enumerable !== descriptor.enumerable ||
        current.configurable !== descriptor.configurable ||
        "value" in current !== "value" in descriptor ||
        ("writable" in current &&
          "writable" in descriptor &&
          current.writable !== descriptor.writable) ||
        ("value" in current &&
          "value" in descriptor &&
          !Object.is(current.value, descriptor.value)) ||
        ("get" in current &&
          "get" in descriptor &&
          (current.get !== descriptor.get || current.set !== descriptor.set))
      ) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
          `Caller property changed at ${valuePath}/${String(key)} during ${phase}.`,
        );
      }
    }
    if (byteHex !== undefined) {
      try {
        const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
        const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
        const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
        if (Buffer.from(buffer, byteOffset, byteLength).toString("hex") !== byteHex) {
          fail(
            "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
            `Caller bytes changed at ${valuePath} during ${phase}.`,
          );
        }
      } catch (error) {
        if (error instanceof WebReactPackageDigestEvidenceError) throw error;
        fail(
          "WEB_REACT_PACKAGE_DIGEST_CALLER_MUTATED",
          `Caller bytes detached at ${valuePath} during ${phase}.`,
        );
      }
    }
  }
}

function buildCatalogFixture(catalogApi, packageDigest = PLACEHOLDER) {
  const component = catalogApi.registerComponent({
    id: "com.example.ui/Button",
    manifest: {
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: {
          label: { type: "string" },
        },
      },
    },
  });
  const behavior = catalogApi.registerBehavior({
    id: "com.example.interactions/Pressable",
    manifest: {
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          disabled: { type: "boolean" },
        },
      },
      attachTo: { capabilities: ["com.example.ui/Button"] },
    },
  });
  const operation = catalogApi.registerOperation({
    id: "com.example.auth/signIn",
    manifest: {
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["email"],
        properties: { email: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["userId"],
        properties: { userId: { type: "string" } },
      },
      errors: [],
      effect: "network",
    },
  });
  const resource = catalogApi.registerResource({
    id: "com.example.stores/list",
    manifest: {
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { region: { type: "string" } },
      },
      outputSchema: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
      errors: [],
      policies: ["manual"],
    },
  });
  return catalogApi.createCatalogManifest({
    id: "com.example.reference",
    version: "1.0.0",
    target: "web-react",
    packageDigest,
    components: [component],
    behaviors: [behavior],
    operations: [operation],
    resources: [resource],
  });
}

function createGoldenInput(catalog) {
  return {
    catalog,
    artifacts: GOLDEN_ARTIFACTS.map(({ path: artifactPath, text }) => ({
      path: artifactPath,
      bytes: ascii(text),
    })),
  };
}

function uint16BigEndian(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(value);
  return bytes;
}

function uint32BigEndian(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function buildIndependentOracleBytes(catalog, artifacts, protocolApi) {
  const entries = [
    {
      path: "catalog.json",
      bytes: Buffer.from(protocolApi.canonicalizeJsonBytes(catalog)),
    },
    ...artifacts.map(({ path: artifactPath, bytes }) => ({
      path: artifactPath,
      bytes: Buffer.from(bytes),
    })),
  ].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

  const chunks = [Buffer.from(PROFILE_MAGIC, "ascii"), uint32BigEndian(entries.length)];
  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path, "ascii");
    chunks.push(
      uint16BigEndian(pathBytes.length),
      pathBytes,
      uint32BigEndian(entry.bytes.length),
      entry.bytes,
    );
  }
  return Object.freeze({ bytes: Buffer.concat(chunks), entries });
}

function parseSourceFile(text, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_SOURCE_PARSE_FAILED",
      `TypeScript could not parse ${relativePath}.`,
      {
        diagnostics: sourceFile.parseDiagnostics.map(({ code, messageText }) => ({
          code,
          message: ts.flattenDiagnosticMessageText(messageText, "\n"),
        })),
      },
    );
  }
  return sourceFile;
}

function hasExportModifier(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)
  );
}

function digestIndexExports(indexText, relativePath, includeTypes) {
  const sourceFile = parseSourceFile(indexText, relativePath);
  const runtime = new Set();
  const types = new Set();
  const signatures = new Set();
  const modules = new Set();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.length === 0 ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.attributes !== undefined
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
        `${relativePath} may contain only non-empty named re-exports from explicit modules.`,
        { syntaxKind: ts.SyntaxKind[statement.kind] },
      );
    }
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (!/^\.\/[a-z][a-z0-9-]*\.js$/u.test(moduleSpecifier)) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
        `${relativePath} uses an unreviewed re-export module specifier.`,
        { moduleSpecifier },
      );
    }
    modules.add(moduleSpecifier);
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
          `${relativePath} contains an aliased named export.`,
        );
      }
      const isType = statement.isTypeOnly || element.isTypeOnly;
      if (isType && !includeTypes) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
          `${relativePath} unexpectedly contains a runtime type export.`,
        );
      }
      const kind = isType ? "type" : "runtime";
      const target = isType ? types : runtime;
      const signature = `${kind}:${element.name.text}@${moduleSpecifier}`;
      if (target.has(element.name.text) || signatures.has(signature)) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
          `${relativePath} repeats ${kind} export ${element.name.text}.`,
        );
      }
      target.add(element.name.text);
      signatures.add(signature);
    }
  }
  return Object.freeze({
    runtime: Object.freeze([...runtime].sort()),
    types: Object.freeze([...types].sort()),
    signatures: Object.freeze([...signatures].sort()),
    modules: Object.freeze([...modules].sort()),
  });
}

function verifyProfileSourceSurface(
  sourceText,
  relativePath = "packages/reference-catalog-web/src/package-digest-profile.ts",
) {
  const sourceFile = parseSourceFile(sourceText, relativePath);
  const runtime = [];
  const types = [];
  const constantExports = [];
  const functionExports = [];
  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
          "Profile runtime values must use immutable const bindings.",
        );
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          fail(
            "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
            "Profile exports may not use binding patterns.",
          );
        }
        runtime.push(declaration.name.text);
        constantExports.push(declaration.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      runtime.push(statement.name.text);
      functionExports.push(statement.name.text);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      types.push(statement.name.text);
    } else {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
        "The digest profile module contains an unreviewed exported declaration.",
        { syntaxKind: ts.SyntaxKind[statement.kind] },
      );
    }
  }
  assertArrayEqual(
    runtime.sort(),
    EXPECTED_RUNTIME_EXPORTS,
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "Profile source runtime exports differ.",
  );
  assertArrayEqual(
    types.sort(),
    [...EXPECTED_TYPE_EXPORTS].sort(),
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "Profile source type exports differ.",
  );
  assertArrayEqual(
    constantExports.sort(),
    ["WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER", "WEB_REACT_PACKAGE_DIGEST_PROFILE"],
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "Profile source constants differ.",
  );
  assertArrayEqual(
    functionExports.sort(),
    [
      "createWebReactPackageDigest",
      "encodeWebReactPackageDigestPreimage",
      "verifyWebReactPackageDigest",
    ],
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "Profile source functions differ.",
  );
}

function verifyDigestIndexWiring(indexText, relativePath, includeTypes) {
  const surface = digestIndexExports(indexText, relativePath, includeTypes);
  assertArrayContains(
    surface.signatures,
    REQUIRED_RUNTIME_EXPORT_SIGNATURES,
    "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
    `${relativePath} omits or remaps a required M03-T04 runtime export.`,
  );
  if (includeTypes) {
    assertArrayContains(
      surface.signatures,
      REQUIRED_TYPE_EXPORT_SIGNATURES,
      "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
      `${relativePath} omits or remaps a required M03-T04 type export.`,
    );
  }
  return surface;
}

function bindingNames(name, names = []) {
  if (ts.isIdentifier(name)) names.push(name.text);
  else {
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) bindingNames(element.name, names);
    }
  }
  return names;
}

function verifyTestFrameworkBinding(sourceFile, relativePath, functionName) {
  if (functionName === "it") {
    const imports = sourceFile.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "vitest",
    );
    const clause = imports.length === 1 ? imports[0].importClause : undefined;
    const bindings =
      clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements
        : [];
    const names = bindings.map(({ name }) => name.text).sort();
    if (
      imports.length !== 1 ||
      clause === undefined ||
      clause.name !== undefined ||
      bindings.some(
        (binding) =>
          binding.propertyName !== undefined && binding.propertyName.text !== binding.name.text,
      ) ||
      names.join(",") !== "describe,expect,it"
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
        `${relativePath} must bind describe, expect, and it directly from vitest.`,
      );
    }
  } else {
    const imports = sourceFile.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "node:test",
    );
    const clause = imports.length === 1 ? imports[0].importClause : undefined;
    if (
      imports.length !== 1 ||
      clause === undefined ||
      clause.name?.text !== "test" ||
      clause.namedBindings !== undefined
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
        `${relativePath} must bind test directly from node:test.`,
      );
    }
  }

  const protectedNames = new Set(functionName === "it" ? ["describe", "expect", "it"] : ["test"]);
  function visit(node) {
    let declaredNames = [];
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      declaredNames = bindingNames(node.name);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name !== undefined
    ) {
      declaredNames = [node.name.text];
    } else if (ts.isCatchClause(node) && node.variableDeclaration !== undefined) {
      declaredNames = bindingNames(node.variableDeclaration.name);
    }
    if (declaredNames.some((name) => protectedNames.has(name))) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
        `${relativePath} shadows a test-framework binding.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function testTitles(testText, relativePath, functionName) {
  const sourceFile = parseSourceFile(testText, relativePath);
  verifyTestFrameworkBinding(sourceFile, relativePath, functionName);
  const titles = [];

  function assertPlacement(node, title) {
    const statement = node.parent;
    if (!ts.isExpressionStatement(statement)) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
        `Test ${JSON.stringify(title)} is conditionally wrapped.`,
      );
    }
    if (functionName === "test") {
      if (!ts.isSourceFile(statement.parent)) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
          `Root test ${JSON.stringify(title)} is not top-level.`,
        );
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
        "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
        `Package test ${JSON.stringify(title)} is not directly inside one top-level describe.`,
      );
    }
  }

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
          fail(
            "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
            `A ${functionName} call is not a static executable test.`,
          );
        }
        assertPlacement(node, title.text);
        titles.push(title.text);
      } else {
        const modifiedBase =
          ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)
            ? node.expression.expression
            : undefined;
        if (
          modifiedBase !== undefined &&
          ts.isIdentifier(modifiedBase) &&
          ["describe", "it", "suite", "test"].includes(modifiedBase.text)
        ) {
          fail(
            "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
            `Modified or skipped ${modifiedBase.text} calls are forbidden.`,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return titles;
}

function negativeCaseLabels(typeTestText) {
  const sourceFile = parseSourceFile(
    typeTestText,
    "packages/reference-catalog-web/test/public-api.types.ts",
  );
  return (sourceFile.commentDirectives ?? [])
    .filter(({ type }) => type === ts.CommentDirectiveType.ExpectError)
    .map(({ range }) => {
      const directive = typeTestText.slice(range.pos, range.end);
      const match = /@ts-expect-error\s+(M03-T04-N[0-9]{2})\b/u.exec(directive);
      if (match === null) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_TYPE_INVENTORY_DRIFT",
          "Every compiler-recognized expect-error needs a stable M03-T04 case id.",
        );
      }
      return match[1];
    });
}

function verifyTestInventory(testText, typeTestText, rootTestText) {
  const packageTitles = testTitles(
    testText,
    "packages/reference-catalog-web/test/package-digest-profile.test.ts",
    "it",
  );
  const rootTitles = testTitles(rootTestText, "tests/web-react-package-digest.test.mjs", "test");
  const labels = negativeCaseLabels(typeTestText);
  assertArrayEqual(
    packageTitles,
    EXPECTED_PACKAGE_TEST_TITLES,
    "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
    "Focused package test titles differ.",
  );
  assertArrayEqual(
    rootTitles,
    EXPECTED_ROOT_TEST_TITLES,
    "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
    "Root evidence test titles differ.",
  );
  assertArrayEqual(
    labels,
    EXPECTED_TYPE_NEGATIVE_LABELS,
    "WEB_REACT_PACKAGE_DIGEST_TYPE_INVENTORY_DRIFT",
    "Compiler-negative case ids differ.",
  );
  assertEqual(
    packageTitles.length,
    EXPECTED_PACKAGE_TESTS,
    "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
    "Focused package test count differs.",
  );
  assertEqual(
    rootTitles.length,
    EXPECTED_ROOT_TESTS,
    "WEB_REACT_PACKAGE_DIGEST_TEST_INVENTORY_DRIFT",
    "Root evidence test count differs.",
  );
  assertEqual(
    labels.length,
    EXPECTED_TYPE_NEGATIVE_CASES,
    "WEB_REACT_PACKAGE_DIGEST_TYPE_INVENTORY_DRIFT",
    "Compiler-negative case count differs.",
  );
  return Object.freeze({
    packageTests: packageTitles.length,
    rootTests: rootTitles.length,
    typeNegativeCases: labels.length,
  });
}

function verifyTrace(trace) {
  return EXPECTED_TRACE_RULES.map(({ collection, id, owners }) => {
    const rule = trace[collection]?.find((candidate) => candidate.id === id);
    if (rule === undefined) {
      fail("WEB_REACT_PACKAGE_DIGEST_TRACE_DRIFT", `Trace rule ${id} is missing.`);
    }
    assertArrayEqual(
      rule.owners,
      owners,
      "WEB_REACT_PACKAGE_DIGEST_TRACE_DRIFT",
      `Trace owners for ${id} differ.`,
    );
    return deepFreeze(structuredClone(rule));
  });
}

function verifyProfileDocument(profileText) {
  for (const requiredText of REQUIRED_PROFILE_DOCUMENT_TEXT) {
    if (!profileText.includes(requiredText)) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PROFILE_DOCUMENT_DRIFT",
        `Profile document is missing ${JSON.stringify(requiredText)}.`,
      );
    }
  }
}

function verifyPortableModuleSyntax(moduleText, relativePath, allowedRelativeSpecifiers = []) {
  const sourceFile = parseSourceFile(moduleText, relativePath);
  if (
    sourceFile.libReferenceDirectives.length > 0 ||
    sourceFile.typeReferenceDirectives.length > 0 ||
    sourceFile.referencedFiles.length > 0
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
      `${relativePath} contains a triple-slash platform reference.`,
    );
  }

  function verifySpecifier(specifier) {
    const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
    const bareRoot = bare.split("/")[0];
    if (
      NODE_BUILTIN_SPECIFIERS.has(specifier) ||
      NODE_BUILTIN_SPECIFIERS.has(bare) ||
      NODE_BUILTIN_SPECIFIERS.has(bareRoot)
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
        `${relativePath} imports Node.js builtin ${JSON.stringify(specifier)}.`,
      );
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      if (!allowedRelativeSpecifiers.includes(specifier)) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
          `${relativePath} reaches unaudited relative module ${JSON.stringify(specifier)}.`,
        );
      }
      return;
    }
    if (specifier !== "@desen/protocol") {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
        `${relativePath} imports non-portable dependency ${JSON.stringify(specifier)}.`,
      );
    }
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      verifySpecifier(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      verifySpecifier(node.moduleReference.expression.text);
    } else if (ts.isImportTypeNode(node)) {
      if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteral(node.argument.literal)) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
          `${relativePath} contains a computed import type.`,
        );
      }
      verifySpecifier(node.argument.literal.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
        `${relativePath} contains dynamic module loading.`,
      );
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require"
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
        `${relativePath} contains CommonJS runtime loading.`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function verifyDistributionAudit({
  sourceText,
  indexText,
  declarationText,
  moduleDeclarationText,
  distributionText,
  distributionIndexText,
}) {
  verifyProfileSourceSurface(sourceText);
  verifyProfileSourceSurface(
    moduleDeclarationText,
    "packages/reference-catalog-web/dist/package-digest-profile.d.ts",
  );
  const sourceIndex = verifyDigestIndexWiring(
    indexText,
    "packages/reference-catalog-web/src/index.ts",
    true,
  );
  const declarationIndex = verifyDigestIndexWiring(
    declarationText,
    "packages/reference-catalog-web/dist/index.d.ts",
    true,
  );
  const distributionIndex = verifyDigestIndexWiring(
    distributionIndexText,
    "packages/reference-catalog-web/dist/index.js",
    false,
  );
  assertArrayEqual(
    sourceIndex.signatures,
    declarationIndex.signatures,
    "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
    "The root source and declaration named export maps differ.",
  );
  assertArrayEqual(
    sourceIndex.signatures.filter((signature) => signature.startsWith("runtime:")),
    distributionIndex.signatures,
    "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
    "The root source and runtime distribution named export maps differ.",
  );
  verifyPortableModuleSyntax(
    sourceText,
    "packages/reference-catalog-web/src/package-digest-profile.ts",
  );
  verifyPortableModuleSyntax(
    indexText,
    "packages/reference-catalog-web/src/index.ts",
    sourceIndex.modules,
  );
  verifyPortableModuleSyntax(
    declarationText,
    "packages/reference-catalog-web/dist/index.d.ts",
    declarationIndex.modules,
  );
  verifyPortableModuleSyntax(
    moduleDeclarationText,
    "packages/reference-catalog-web/dist/package-digest-profile.d.ts",
  );
  verifyPortableModuleSyntax(
    distributionText,
    "packages/reference-catalog-web/dist/package-digest-profile.js",
  );
  verifyPortableModuleSyntax(
    distributionIndexText,
    "packages/reference-catalog-web/dist/index.js",
    distributionIndex.modules,
  );
  const combined = [
    sourceText,
    indexText,
    declarationText,
    moduleDeclarationText,
    distributionText,
    distributionIndexText,
  ].join("\n");
  for (const { id, pattern } of FORBIDDEN_DISTRIBUTION_PATTERNS) {
    if (pattern.test(combined)) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_PLATFORM_BOUNDARY_DRIFT",
        `Web-React package digest production code violates ${id}.`,
      );
    }
  }
  return Object.freeze({ sourceIndex, declarationIndex, distributionIndex });
}

function verifyRootCommandWiring(rootPackage) {
  for (const [name, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const scriptName = `${name}:web-react-package-digest`;
    assertEqual(
      rootPackage.scripts?.[scriptName],
      expected,
      "WEB_REACT_PACKAGE_DIGEST_COMMAND_WIRING_DRIFT",
      `Root command ${scriptName} differs.`,
    );
  }
  if (
    !rootPackage.scripts?.check?.includes("pnpm verify:web-react-package-digest") ||
    !rootPackage.scripts?.test?.includes("pnpm test:web-react-package-digest")
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_COMMAND_WIRING_DRIFT",
      "The root quality gate does not execute the M03-T04 verifier and tests.",
    );
  }
}

function verifyPackageManifest(packageJson, packageConsumerText) {
  const dotExport = packageJson.exports?.["."];
  if (
    packageJson.name !== "@desen/reference-catalog-web" ||
    packageJson.private !== true ||
    packageJson.type !== "module" ||
    packageJson.sideEffects !== false ||
    !Array.isArray(packageJson.files) ||
    !packageJson.files.includes("dist") ||
    dotExport === null ||
    typeof dotExport !== "object" ||
    Array.isArray(dotExport) ||
    Reflect.ownKeys(dotExport).length !== 2 ||
    dotExport.types !== "./dist/index.d.ts" ||
    dotExport.import !== "./dist/index.js" ||
    packageJson.dependencies?.["@desen/protocol"] !== "workspace:*" ||
    packageJson.devDependencies?.vitest !== "4.1.10" ||
    packageJson.scripts?.build !== "tsc -p tsconfig.build.json" ||
    packageJson.scripts?.typecheck !== "tsc -p tsconfig.json --noEmit" ||
    packageJson.scripts?.test !== "vitest run" ||
    packageJson.scripts?.["test:package-digest-profile"] !==
      "vitest run test/package-digest-profile.test.ts"
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
      "The reference package manifest no longer exposes the reviewed package contract.",
    );
  }
  if (packageConsumerText.trim() !== 'export * from "@desen/reference-catalog-web";') {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_PACKAGE_BOUNDARY_DRIFT",
      "The package-specifier consumer fixture no longer exercises the public export map.",
    );
  }
}

function verifyTypecheckConfiguration(
  tsconfigText,
  buildTsconfigText,
  tsconfigPath,
  buildTsconfigPath,
) {
  const tsconfig = JSON.parse(tsconfigText);
  const buildTsconfig = JSON.parse(buildTsconfigText);
  const expectedIncludes = ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"];
  const expectedBuildIncludes = ["src/**/*.ts", "src/**/*.tsx"];
  const expectedBuildExcludes = ["test/**/*", "**/*.test.ts", "**/*.test.tsx"];
  if (
    tsconfig.extends !== "../../tsconfig.react-web.json" ||
    !Array.isArray(tsconfig.compilerOptions?.types) ||
    tsconfig.compilerOptions.types.length !== 0 ||
    tsconfig.compilerOptions.noCheck === true ||
    !Array.isArray(tsconfig.include) ||
    tsconfig.include.join("\n") !== expectedIncludes.join("\n") ||
    buildTsconfig.extends !== "./tsconfig.json" ||
    buildTsconfig.compilerOptions?.noEmit !== false ||
    buildTsconfig.compilerOptions?.rootDir !== "src" ||
    buildTsconfig.compilerOptions?.outDir !== "dist" ||
    buildTsconfig.compilerOptions?.declaration !== true ||
    buildTsconfig.compilerOptions?.declarationMap !== true ||
    !Array.isArray(buildTsconfig.include) ||
    buildTsconfig.include.join("\n") !== expectedBuildIncludes.join("\n") ||
    !Array.isArray(buildTsconfig.exclude) ||
    buildTsconfig.exclude.join("\n") !== expectedBuildExcludes.join("\n")
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_TYPECHECK_BOUNDARY_DRIFT",
      "Reference package TypeScript projects no longer enforce the reviewed source/test boundary.",
    );
  }

  if (
    path.resolve(tsconfigPath) === path.resolve(PROFILE_TSCONFIG_PATH) &&
    path.resolve(buildTsconfigPath) === path.resolve(PROFILE_BUILD_TSCONFIG_PATH)
  ) {
    const loaded = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (loaded.error !== undefined) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TYPECHECK_BOUNDARY_DRIFT",
        "TypeScript could not read the reference package typecheck project.",
      );
    }
    const parsed = ts.parseJsonConfigFileContent(
      loaded.config,
      ts.sys,
      path.dirname(tsconfigPath),
      undefined,
      tsconfigPath,
    );
    if (
      parsed.errors.length > 0 ||
      parsed.options.noCheck === true ||
      parsed.options.noEmit !== true ||
      parsed.options.strict !== true
    ) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_TYPECHECK_BOUNDARY_DRIFT",
        "The resolved reference package typecheck project is not strict and emitting-disabled.",
        {
          diagnostics: parsed.errors.map(({ code, messageText }) => ({
            code,
            message: ts.flattenDiagnosticMessageText(messageText, "\n"),
          })),
        },
      );
    }
    const rootNames = new Set(parsed.fileNames.map((fileName) => path.resolve(fileName)));
    for (const requiredPath of [
      PROFILE_SOURCE_PATH,
      PROFILE_INDEX_PATH,
      PROFILE_TEST_PATH,
      PROFILE_TYPE_TEST_PATH,
    ]) {
      if (!rootNames.has(path.resolve(requiredPath))) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_TYPECHECK_BOUNDARY_DRIFT",
          `The typecheck project excludes ${path.relative(WORKSPACE_ROOT, requiredPath)}.`,
        );
      }
    }
  }
}

async function trackedFileHashes() {
  return Promise.all(
    TRACKED_IMPLEMENTATION_PATHS.map(async (relativePath) => {
      const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

async function loadModule(modulePath) {
  return import(pathToFileURL(modulePath).href);
}

function collectBuildOverrides({
  profileApi,
  catalogApi,
  protocolApi,
  validatorApi,
  tracePath,
  profileDocumentPath,
  sourcePath,
  indexPath,
  testPath,
  typeTestPath,
  rootTestPath,
  declarationPath,
  distributionPath,
  rootPackagePath,
  packageManifestPath,
  packageConsumerPath,
  tsconfigPath,
  buildTsconfigPath,
  verifyPrerequisite,
}) {
  const overrides = [];
  for (const [name, value] of Object.entries({
    profileApi,
    catalogApi,
    protocolApi,
    validatorApi,
  })) {
    if (value !== undefined) overrides.push(name);
  }
  for (const [name, actual, expected] of [
    ["tracePath", tracePath, DEFAULT_TRACE_PATH],
    ["profileDocumentPath", profileDocumentPath, DEFAULT_PROFILE_DOCUMENT_PATH],
    ["sourcePath", sourcePath, PROFILE_SOURCE_PATH],
    ["indexPath", indexPath, PROFILE_INDEX_PATH],
    ["testPath", testPath, PROFILE_TEST_PATH],
    ["typeTestPath", typeTestPath, PROFILE_TYPE_TEST_PATH],
    ["rootTestPath", rootTestPath, ROOT_TEST_PATH],
    ["declarationPath", declarationPath, PROFILE_DECLARATION_PATH],
    ["distributionPath", distributionPath, PROFILE_DISTRIBUTION_PATH],
    ["rootPackagePath", rootPackagePath, ROOT_PACKAGE_PATH],
    ["packageManifestPath", packageManifestPath, PROFILE_PACKAGE_PATH],
    ["packageConsumerPath", packageConsumerPath, DEFAULT_PROFILE_API_PATH],
    ["tsconfigPath", tsconfigPath, PROFILE_TSCONFIG_PATH],
    ["buildTsconfigPath", buildTsconfigPath, PROFILE_BUILD_TSCONFIG_PATH],
  ]) {
    if (path.resolve(actual) !== path.resolve(expected)) overrides.push(name);
  }
  if (!verifyPrerequisite) overrides.push("verifyPrerequisite");
  return Object.freeze(overrides);
}

async function canonicalArtifactTarget(artifactPath) {
  const absolutePath = path.resolve(artifactPath);
  const parent = await realpath(path.dirname(absolutePath));
  return path.join(parent, path.basename(absolutePath));
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

function verifyGoldenBehavior({ profileApi, catalogApi, protocolApi, validatorApi }) {
  assertEqual(
    profileApi.WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
    PLACEHOLDER,
    "WEB_REACT_PACKAGE_DIGEST_PROFILE_DRIFT",
    "The exported Catalog digest placeholder differs.",
  );
  assertExactFrozenData(profileApi.WEB_REACT_PACKAGE_DIGEST_PROFILE, EXPECTED_PROFILE_METADATA);

  const catalog = buildCatalogFixture(catalogApi);
  const validation = validatorApi.validateDesenCatalogSemantics(catalog);
  if (!validation.valid || validation.diagnostics.length !== 0) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_CATALOG_INVALID",
      "The fixed M03-T04 Catalog template is not validator-accepted.",
      { diagnostics: validation.diagnostics },
    );
  }

  const input = createGoldenInput(catalog);
  const inputGraph = captureCallerGraph(input);
  const preimage = profileApi.encodeWebReactPackageDigestPreimage(input);
  assertCallerGraphPreserved(inputGraph, "first encoding");
  const secondInput = createGoldenInput(buildCatalogFixture(catalogApi));
  const secondInputGraph = captureCallerGraph(secondInput);
  const secondPreimage = profileApi.encodeWebReactPackageDigestPreimage(secondInput);
  assertCallerGraphPreserved(secondInputGraph, "second encoding");
  const preimageView = inspectByteOutput(preimage, "First encoded preimage");
  const secondPreimageView = inspectByteOutput(secondPreimage, "Second encoded preimage");
  assertFreshByteOutputs(preimage, preimageView, secondPreimage, secondPreimageView);
  const oracle = buildIndependentOracleBytes(catalog, input.artifacts, protocolApi);
  if (!Buffer.from(preimage).equals(oracle.bytes)) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_FRAMING_MISMATCH",
      "Profile preimage differs from the independent Node framing oracle.",
    );
  }
  if (!Buffer.from(secondPreimage).equals(oracle.bytes)) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_NONDETERMINISTIC",
      "Two equivalent package builds produced different preimage bytes.",
    );
  }

  const description = profileApi.createWebReactPackageDigest(input);
  assertCallerGraphPreserved(inputGraph, "digest calculation");
  const oracleDigest = sha256Digest(oracle.bytes);
  assertEqual(
    description.packageDigest,
    oracleDigest,
    "WEB_REACT_PACKAGE_DIGEST_ORACLE_MISMATCH",
    "Profile digest differs from Node crypto.",
  );
  assertEqual(
    description.byteLength,
    oracle.bytes.length,
    "WEB_REACT_PACKAGE_DIGEST_FRAMING_MISMATCH",
    "Reported preimage length differs.",
  );
  assertEqual(
    oracle.bytes.length,
    GOLDEN_PREIMAGE_BYTES,
    "WEB_REACT_PACKAGE_DIGEST_GOLDEN_DRIFT",
    "The fixed package preimage length changed.",
  );
  assertEqual(
    description.packageDigest,
    GOLDEN_PACKAGE_DIGEST,
    "WEB_REACT_PACKAGE_DIGEST_GOLDEN_DRIFT",
    "The fixed package digest changed.",
  );
  const expectedDescription = {
    profile: "desen.web-react.package-digest",
    profileVersion: 1,
    target: "web-react",
    packageDigest: oracleDigest,
    byteLength: oracle.bytes.length,
    entries: oracle.entries.map((entry) => ({
      path: entry.path,
      byteLength: entry.bytes.length,
      contentDigest: sha256Digest(entry.bytes),
    })),
  };
  assertExactFrozenData(description, expectedDescription);
  Reflect.apply(UINT8_ARRAY_FILL, preimage, [0]);
  if (!Buffer.from(secondPreimage).equals(oracle.bytes)) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_OUTPUT_ALIAS",
      "Mutating one returned preimage changed an earlier independent encoding.",
    );
  }
  const afterOutputMutation = profileApi.encodeWebReactPackageDigestPreimage(input);
  assertCallerGraphPreserved(inputGraph, "post-output-mutation encoding");
  const afterOutputMutationView = inspectByteOutput(
    afterOutputMutation,
    "Post-mutation encoded preimage",
  );
  assertFreshByteOutputs(preimage, preimageView, afterOutputMutation, afterOutputMutationView);
  assertFreshByteOutputs(
    secondPreimage,
    secondPreimageView,
    afterOutputMutation,
    afterOutputMutationView,
  );
  if (!Buffer.from(afterOutputMutation).equals(oracle.bytes)) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_OUTPUT_ALIAS",
      "Mutating a returned preimage changed a later encoding.",
    );
  }

  const publishedCatalog = JSON.parse(JSON.stringify(catalog));
  publishedCatalog.packageDigest = description.packageDigest;
  const publishedInput = createGoldenInput(publishedCatalog);
  const publishedInputGraph = captureCallerGraph(publishedInput);
  const publishedValidation = validatorApi.validateDesenCatalogSemantics(publishedCatalog);
  if (!publishedValidation.valid || publishedValidation.diagnostics.length !== 0) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_CATALOG_INVALID",
      "The fixed published Catalog is not validator-accepted.",
      { diagnostics: publishedValidation.diagnostics },
    );
  }
  const verified = profileApi.verifyWebReactPackageDigest(publishedInput);
  assertCallerGraphPreserved(publishedInputGraph, "published verification");
  assertEqual(
    verified.packageDigest,
    description.packageDigest,
    "WEB_REACT_PACKAGE_DIGEST_VERIFICATION_MISMATCH",
    "Published Catalog verification returned another digest.",
  );
  assertExactFrozenData(verified, expectedDescription);

  const mutatedPublishedCatalog = JSON.parse(JSON.stringify(publishedCatalog));
  mutatedPublishedCatalog.packageDigest = `sha256:${"f".repeat(64)}`;
  let mismatchRejected = false;
  try {
    profileApi.verifyWebReactPackageDigest(createGoldenInput(mutatedPublishedCatalog));
  } catch (error) {
    mismatchRejected = error instanceof TypeError;
  }
  if (!mismatchRejected) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_VERIFICATION_MISSING",
      "A wrong published Catalog digest was not rejected.",
    );
  }

  return Object.freeze({
    catalog,
    input,
    oracle,
    description,
    publishedCatalog,
    verified,
  });
}

function verifyMutationSensitivity({ profileApi, catalogApi, golden }) {
  const baseline = golden.description.packageDigest;
  let singleArtifactByteMutations = 0;
  for (const [artifactIndex, artifact] of golden.input.artifacts.entries()) {
    for (let byteIndex = 0; byteIndex < artifact.bytes.length; byteIndex += 1) {
      const artifacts = golden.input.artifacts.map(({ path: artifactPath, bytes }) => ({
        path: artifactPath,
        bytes: new Uint8Array(bytes),
      }));
      artifacts[artifactIndex].bytes[byteIndex] ^= 1;
      const mutated = profileApi.createWebReactPackageDigest({
        catalog: buildCatalogFixture(catalogApi),
        artifacts,
      });
      if (mutated.packageDigest === baseline) {
        fail(
          "WEB_REACT_PACKAGE_DIGEST_MUTATION_UNDETECTED",
          "An artifact byte mutation retained the package digest.",
          { artifactIndex, byteIndex },
        );
      }
      singleArtifactByteMutations += 1;
    }
  }

  let pathMutations = 0;
  for (const [artifactIndex, artifact] of golden.input.artifacts.entries()) {
    const artifacts = golden.input.artifacts.map(({ path: artifactPath, bytes }) => ({
      path: artifactPath,
      bytes: new Uint8Array(bytes),
    }));
    artifacts[artifactIndex].path = artifact.path.replace(/(\.[a-z]+)$/u, "-v2$1");
    const mutated = profileApi.createWebReactPackageDigest({
      catalog: buildCatalogFixture(catalogApi),
      artifacts,
    });
    if (mutated.packageDigest === baseline) {
      fail(
        "WEB_REACT_PACKAGE_DIGEST_MUTATION_UNDETECTED",
        "An artifact path mutation retained the package digest.",
        { artifactIndex },
      );
    }
    pathMutations += 1;
  }

  const catalogMutation = profileApi.createWebReactPackageDigest({
    catalog: buildCatalogFixture(catalogApi, PLACEHOLDER),
    artifacts: golden.input.artifacts,
  });
  assertEqual(
    catalogMutation.packageDigest,
    baseline,
    "WEB_REACT_PACKAGE_DIGEST_NONDETERMINISTIC",
    "An equivalent rebuilt Catalog changed the package digest.",
  );
  const changedCatalog = JSON.parse(JSON.stringify(buildCatalogFixture(catalogApi)));
  changedCatalog.version = "1.0.1";
  if (
    profileApi.createWebReactPackageDigest({
      catalog: changedCatalog,
      artifacts: golden.input.artifacts,
    }).packageDigest === baseline
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_MUTATION_UNDETECTED",
      "A Catalog version mutation retained the package digest.",
    );
  }

  const removed = profileApi.createWebReactPackageDigest({
    catalog: buildCatalogFixture(catalogApi),
    artifacts: golden.input.artifacts.slice(1),
  });
  const added = profileApi.createWebReactPackageDigest({
    catalog: buildCatalogFixture(catalogApi),
    artifacts: [
      ...golden.input.artifacts,
      { path: "assets/addition.bin", bytes: Uint8Array.of(0) },
    ],
  });
  if (removed.packageDigest === baseline || added.packageDigest === baseline) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_MUTATION_UNDETECTED",
      "An inventory mutation retained the package digest.",
    );
  }

  const mutations = Object.freeze({
    singleArtifactByteMutations,
    pathMutations,
    catalogMutations: 1,
    inventoryMutations: 2,
    declaredDigestMismatches: 1,
    total: singleArtifactByteMutations + pathMutations + 1 + 2 + 1,
  });
  assertEqual(
    mutations.total,
    EXPECTED_MUTATION_VECTORS,
    "WEB_REACT_PACKAGE_DIGEST_MUTATION_INVENTORY_DRIFT",
    "The exhaustive mutation-vector inventory changed.",
  );
  return mutations;
}

/** Builds deterministic M03-T04 evidence entirely from tracked sources and built public APIs. */
export async function buildWebReactPackageDigestEvidence({
  profileApi,
  catalogApi,
  protocolApi,
  validatorApi,
  tracePath = DEFAULT_TRACE_PATH,
  profileDocumentPath = DEFAULT_PROFILE_DOCUMENT_PATH,
  sourcePath = PROFILE_SOURCE_PATH,
  indexPath = PROFILE_INDEX_PATH,
  testPath = PROFILE_TEST_PATH,
  typeTestPath = PROFILE_TYPE_TEST_PATH,
  rootTestPath = ROOT_TEST_PATH,
  declarationPath = PROFILE_DECLARATION_PATH,
  distributionPath = PROFILE_DISTRIBUTION_PATH,
  rootPackagePath = ROOT_PACKAGE_PATH,
  packageManifestPath = PROFILE_PACKAGE_PATH,
  packageConsumerPath = DEFAULT_PROFILE_API_PATH,
  tsconfigPath = PROFILE_TSCONFIG_PATH,
  buildTsconfigPath = PROFILE_BUILD_TSCONFIG_PATH,
  verifyPrerequisite = true,
} = {}) {
  const buildOverrides = collectBuildOverrides({
    profileApi,
    catalogApi,
    protocolApi,
    validatorApi,
    tracePath,
    profileDocumentPath,
    sourcePath,
    indexPath,
    testPath,
    typeTestPath,
    rootTestPath,
    declarationPath,
    distributionPath,
    rootPackagePath,
    packageManifestPath,
    packageConsumerPath,
    tsconfigPath,
    buildTsconfigPath,
    verifyPrerequisite,
  });
  const prerequisite = verifyPrerequisite
    ? await verifyCatalogManifestRegistration()
    : await buildCatalogManifestRegistrationEvidence({ verifyG02: false });
  const [
    resolvedProfileApi,
    resolvedCatalogApi,
    resolvedProtocolApi,
    resolvedValidatorApi,
    traceBytes,
    profileDocumentBytes,
    sourceBytes,
    indexBytes,
    testBytes,
    typeTestBytes,
    rootTestBytes,
    declarationBytes,
    moduleDeclarationBytes,
    distributionBytes,
    distributionIndexBytes,
    rootPackageBytes,
    packageManifestBytes,
    packageConsumerBytes,
    tsconfigBytes,
    buildTsconfigBytes,
  ] = await Promise.all([
    profileApi ?? loadModule(packageConsumerPath),
    catalogApi ?? loadModule(DEFAULT_CATALOG_API_PATH),
    protocolApi ?? loadModule(DEFAULT_PROTOCOL_API_PATH),
    validatorApi ?? loadModule(DEFAULT_VALIDATOR_API_PATH),
    readFile(tracePath),
    readFile(profileDocumentPath),
    readFile(sourcePath),
    readFile(indexPath),
    readFile(testPath),
    readFile(typeTestPath),
    readFile(rootTestPath),
    readFile(declarationPath),
    readFile(PROFILE_MODULE_DECLARATION_PATH),
    readFile(distributionPath),
    readFile(PROFILE_DISTRIBUTION_INDEX_PATH),
    readFile(rootPackagePath),
    readFile(packageManifestPath),
    readFile(packageConsumerPath),
    readFile(tsconfigPath),
    readFile(buildTsconfigPath),
  ]);

  const distributionAudit = verifyDistributionAudit({
    sourceText: sourceBytes.toString("utf8"),
    indexText: indexBytes.toString("utf8"),
    declarationText: declarationBytes.toString("utf8"),
    moduleDeclarationText: moduleDeclarationBytes.toString("utf8"),
    distributionText: distributionBytes.toString("utf8"),
    distributionIndexText: distributionIndexBytes.toString("utf8"),
  });
  const runtimeNames = Object.keys(resolvedProfileApi).sort();
  assertArrayContains(
    runtimeNames,
    EXPECTED_RUNTIME_EXPORTS,
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "The public runtime omits a required M03-T04 digest export.",
  );
  assertArrayEqual(
    runtimeNames,
    distributionAudit.sourceIndex.runtime,
    "WEB_REACT_PACKAGE_DIGEST_PUBLIC_API_DRIFT",
    "The loaded package runtime differs from its reviewed root source exports.",
  );
  const stableProfileApi = captureStableProfileApi(resolvedProfileApi, runtimeNames);

  const inventory = verifyTestInventory(
    testBytes.toString("utf8"),
    typeTestBytes.toString("utf8"),
    rootTestBytes.toString("utf8"),
  );
  const trace = JSON.parse(traceBytes.toString("utf8"));
  const directTrace = verifyTrace(trace);
  const profileDocumentText = profileDocumentBytes.toString("utf8");
  verifyProfileDocument(profileDocumentText);
  verifyRootCommandWiring(JSON.parse(rootPackageBytes.toString("utf8")));
  verifyPackageManifest(
    JSON.parse(packageManifestBytes.toString("utf8")),
    packageConsumerBytes.toString("utf8"),
  );
  verifyTypecheckConfiguration(
    tsconfigBytes.toString("utf8"),
    buildTsconfigBytes.toString("utf8"),
    tsconfigPath,
    buildTsconfigPath,
  );

  const golden = verifyGoldenBehavior({
    profileApi: stableProfileApi,
    catalogApi: resolvedCatalogApi,
    protocolApi: resolvedProtocolApi,
    validatorApi: resolvedValidatorApi,
  });
  const mutations = verifyMutationSensitivity({
    profileApi: stableProfileApi,
    catalogApi: resolvedCatalogApi,
    golden,
  });
  const artifact = {
    schemaVersion: 1,
    task: "M03-T04",
    result: "PASS",
    profile: EXPECTED_PROFILE_METADATA,
    claim: {
      summary:
        "The Web-React reference ecosystem has a documented deterministic package byte and digest profile.",
      target: "web-react",
      protocol: "0.1.0",
      directTraceRules: directTrace.map(({ id }) => id),
      normativeCoverage: {
        tested: ["N-015"],
        partial: ["N-010", "N-011"],
      },
      proofMatrix: { claim: "P-05", status: "PARTIAL" },
    },
    prerequisites: {
      catalogManifestRegistration: {
        result: "PASS",
        artifactSha256: prerequisite.artifactSha256,
      },
      protocolCanonicalization: {
        primitive: "RFC 8785-compatible canonical JSON plus SHA-256",
        task: "M02-T04",
      },
    },
    publicApi: {
      runtimeExports: EXPECTED_RUNTIME_EXPORTS,
      typeExports: EXPECTED_TYPE_EXPORTS,
      package: "@desen/reference-catalog-web",
      packageSpecifierConsumer: path.relative(WORKSPACE_ROOT, packageConsumerPath),
      catalogSdkRemainsFrameworkNeutral: true,
    },
    golden: {
      catalog: {
        id: golden.catalog.id,
        version: golden.catalog.version,
        target: golden.catalog.target,
        digestProjection: "replace-top-level-packageDigest-with-placeholder",
        projectedBytes:
          golden.description.entries.find(({ path: entryPath }) => entryPath === "catalog.json")
            ?.byteLength ?? 0,
        projectedContentDigest:
          golden.description.entries.find(({ path: entryPath }) => entryPath === "catalog.json")
            ?.contentDigest ?? "",
      },
      entries: golden.description.entries,
      preimageBytes: golden.oracle.bytes.length,
      preimageSha256: sha256Digest(golden.oracle.bytes),
      packageDigest: golden.description.packageDigest,
      independentNodeCryptoAgreement: true,
      publishedCatalogVerification: true,
    },
    vectors: {
      mutations,
      hostileProfileCategories: [
        "Catalog identity and self-field",
        "path portability, reservation, duplication, and limits",
        "byte view brand, exact subview, size, detachment, and shared memory",
        "wrapper, record, array density, descriptors, and unknown fields",
        "caller ownership, output aliasing, and deep immutability",
      ],
      callerOwnership: {
        inputsMutated: false,
        aliasesRetained: false,
        outputAuditDeepFrozen: true,
        freshPreimageBytes: true,
        sharedMemoryRejected: true,
      },
    },
    trace: directTrace,
    evidence: {
      provenance: {
        mode: buildOverrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides: buildOverrides,
      },
      packageTests: inventory.packageTests,
      rootTests: inventory.rootTests,
      typeNegativeCases: inventory.typeNegativeCases,
      trackedFiles: await trackedFileHashes(),
      profileDocument: {
        path: path.relative(WORKSPACE_ROOT, profileDocumentPath),
        bytes: profileDocumentBytes.length,
        sha256: sha256(profileDocumentBytes),
      },
      commandWiring: Object.keys(EXPECTED_ROOT_SCRIPTS).map(
        (name) => `${name}:web-react-package-digest`,
      ),
      platformAudit: {
        source: path.relative(WORKSPACE_ROOT, PROFILE_SOURCE_PATH),
        distributions: [
          {
            path: path.relative(WORKSPACE_ROOT, PROFILE_DECLARATION_PATH),
            bytes: declarationBytes.length,
            sha256: sha256(declarationBytes),
          },
          {
            path: path.relative(WORKSPACE_ROOT, PROFILE_MODULE_DECLARATION_PATH),
            bytes: moduleDeclarationBytes.length,
            sha256: sha256(moduleDeclarationBytes),
          },
          {
            path: path.relative(WORKSPACE_ROOT, PROFILE_DISTRIBUTION_PATH),
            bytes: distributionBytes.length,
            sha256: sha256(distributionBytes),
          },
          {
            path: path.relative(WORKSPACE_ROOT, PROFILE_DISTRIBUTION_INDEX_PATH),
            bytes: distributionIndexBytes.length,
            sha256: sha256(distributionIndexBytes),
          },
        ],
        forbiddenPatterns: [
          "node-builtins",
          "non-protocol-bare-dependencies",
          "dynamic-import",
          "commonjs-require",
          ...FORBIDDEN_DISTRIBUTION_PATTERNS.map(({ id }) => id),
        ],
      },
    },
    included: [
      "versioned Web-React domain separation",
      "projected canonical Catalog bytes",
      "portable exact path validation and canonical ordering",
      "unambiguous big-endian length framing",
      "exact target artifact bytes",
      "independent Node SHA-256 oracle",
      "published Catalog self-digest verification",
      "detached fresh bytes and immutable audit metadata",
    ],
    deferred: [
      "M03-T05 and M03-T06 real accessible reference components",
      "M03-T08 host operation binding and synthetic fixtures",
      "M03-T09 manifest-to-implementation parity",
      "M03-T10 final reproducible artifact inventory and exact tuple",
      "M06 publication and M07 distributor, retention, resolution, and activation",
      "signatures, authenticity, release archives, npm publication, and native profiles",
    ],
    limitations: [
      "This project profile is not a universal DESEN 0.1.0 archive rule.",
      "The digest preimage is not an executable npm, tar, or zip archive.",
      "Catalog structural and semantic validity is independently checked by the validator.",
      "An empty adapter inventory can be fingerprinted but is not a conforming complete package.",
      "SHA-256 integrity does not establish publisher identity or authenticity.",
      "P-05 remains PARTIAL and G03 remains open until the final package and lifecycle tasks.",
    ],
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

/** Verifies the tracked M03-T04 artifact against a fresh deterministic rebuild. */
export async function verifyWebReactPackageDigestEvidence({
  artifactPath = DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH,
  artifactBytes,
  ...buildOptions
} = {}) {
  if (
    artifactBytes === undefined &&
    Object.keys(buildOptions).length > 0 &&
    (await targetsTrackedArtifact(artifactPath))
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T04 artifact can only be verified against fixed production defaults.",
    );
  }
  const expected = await buildWebReactPackageDigestEvidence(buildOptions);
  const actualBytes = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_ARTIFACT_DRIFT",
      "The tracked M03-T04 artifact differs from a fresh evidence build.",
      { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
    typeExports: EXPECTED_TYPE_EXPORTS.length,
    packageTests: expected.artifact.evidence.packageTests,
    rootTests: expected.artifact.evidence.rootTests,
    typeNegativeCases: expected.artifact.evidence.typeNegativeCases,
    directTraceRules: expected.artifact.trace.length,
    goldenEntries: expected.artifact.golden.entries.length,
    mutationVectors: expected.artifact.vectors.mutations.total,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes deterministic M03-T04 evidence through the shared safe atomic writer. */
export async function writeWebReactPackageDigestEvidence({
  artifactPath = DEFAULT_WEB_REACT_PACKAGE_DIGEST_ARTIFACT_PATH,
  beforeAtomicRename,
  buildOptions,
} = {}) {
  if (
    (await targetsTrackedArtifact(artifactPath)) &&
    (beforeAtomicRename !== undefined || buildOptions !== undefined)
  ) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T04 artifact can only be generated from fixed production defaults.",
    );
  }
  const result = await buildWebReactPackageDigestEvidence(buildOptions ?? {});
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "WEB_REACT_PACKAGE_DIGEST_ARTIFACT_WRITE_FAILED",
      "The M03-T04 evidence artifact could not be committed safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}
