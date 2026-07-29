import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import {
  calculateDesenSourceDigest,
  canonicalizeJson,
  canonicalizeJsonBytes,
  isSha256Digest,
  parseJsonPointer,
} from "../../packages/protocol/dist/index.js";
import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
  preflightPublishSourceNormalization,
} from "../../packages/publisher/dist/source-normalization.js";
import { preflightPublishSourcePreservation } from "../../packages/publisher/dist/source-preservation.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-source-normalization.json";
const PROOF_DOCUMENT = "docs/proof/PUBLISHER-SOURCE-NORMALIZATION.md";
const SOURCE = "packages/publisher/src/source-normalization.ts";
const DISTRIBUTION = "packages/publisher/dist/source-normalization.js";
const DECLARATION = "packages/publisher/dist/source-normalization.d.ts";
const PUBLIC_DECLARATION = "packages/publisher/dist/index.d.ts";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const RUNTIME_TEST = "packages/publisher/test/source-normalization.test.ts";
const TYPE_TEST = "packages/publisher/test/source-normalization.types.ts";
const ROOT_TEST = "tests/publisher-source-normalization.test.mjs";
const SOURCE_SCHEMA = "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const BUNDLE_SCHEMA = "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const FIXTURES = Object.freeze({
  source: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  catalog: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
});

/** Exact predecessor pins; update T06 here after any intentional predecessor cascade. */
export const PUBLISHER_SOURCE_NORMALIZATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M02-T04",
    path: "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    sha256: "8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6",
  }),
  Object.freeze({
    task: "M06-T06",
    path: "docs/proof/artifacts/publisher-0.1.0-source-preservation.json",
    sha256: "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff",
  }),
]);

const TRACKED = Object.freeze([
  ...Object.values(FIXTURES),
  SOURCE_SCHEMA,
  BUNDLE_SCHEMA,
  TRACEABILITY,
  SOURCE,
  "packages/publisher/src/publish-result.ts",
  "packages/publisher/src/source-preservation.ts",
  RUNTIME_TEST,
  TYPE_TEST,
  DISTRIBUTION,
  DECLARATION,
  PUBLIC_DECLARATION,
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-source-normalization-proof.mjs",
  "scripts/generate-publisher-source-normalization-proof.mjs",
  "scripts/verify-publisher-source-normalization.mjs",
  ROOT_TEST,
]);
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  "packages/publisher/src/publish-result.ts": Object.freeze({
    sha256: "9f3a47ad28229cbc172527f5e005c240132f0aa524f5075f83b4662c0f3daa00",
  }),
  [PUBLIC_DECLARATION]: Object.freeze({
    sha256: "8286119f1873ad9fcef182b91af323be6cc1cf46f2e33475c140953d7ca67954",
  }),
  "scripts/lib/publisher-source-normalization-proof.mjs": Object.freeze({
    sha256: "088c89780561a3ed2c20f2a76e60b4009e80a880efdf3ed4e05fb8e51c19504d",
  }),
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
const PARTIALS = Object.freeze([
  "bundle",
  "value",
  "source",
  "catalogSet",
  "packages",
  "requirementPackageIndexes",
  "obligations",
  "preservedDocument",
  "sourceCatalogRequirements",
  "traceability",
  "normalizedDocument",
  "sourceNormalized",
  "preservationPrepared",
  "sourceDigest",
  "requires",
  "revision",
  "publication",
]);
const AUTHORITY_FIELDS = Object.freeze([
  "source",
  "catalogSet",
  "packages",
  "requirementPackageIndexes",
  "diagnostics",
  "obligations",
  "preservedDocument",
  "sourceCatalogRequirements",
  "traceability",
]);
const ALLOWED_IMPORTS = new Set([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./publish-diagnostics.js",
  "./publish-result.js",
  "./source-preservation.js",
]);
const ALLOWED_DECLARATION_IMPORTS = new Set([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./publish-result.js",
  "./source-preservation.js",
]);
const PLATFORM = new Set([
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
const OWNED_TRACE_ROWS = Object.freeze([
  "SN-005",
  "C-005",
  "C-015",
  "PIPE-036",
  "PIPE-037",
  "R-034",
  "R-099",
  "R-107",
  "R-124",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "accepts the real deterministic M06-T07 normalization evidence",
  "two independent evidence builds are byte-identical",
  "rejects one-byte artifact tampering",
  "rejects one-byte drift in each exact prerequisite",
  "rejects a normalizer whose output depends on root authoring",
  "rejects a forged or authoring-dependent Source digest",
  "rejects recursive over-deletion of nested authoring",
  "rejects semantic extension-array reordering",
  "rejects schema-default injection and empty-member rewriting",
  "rejects a normalizer that ignores canonical-byte ceilings",
  "rejects partial authority leaked from a later failure",
  "rejects remapping of an inherited failure",
  "rejects cloning of an exact predecessor authority in production source",
  "rejects target-platform and unreviewed imports in production source",
  "rejects private declaration or package-root API leakage",
  "rejects a private package-subpath export",
  "rejects missing private declaration contract fields",
  "rejects package and root registration drift",
  "rejects focused or independent test-inventory erosion",
  "rejects single-pass CI proof-tuple drift",
  "rejects protocol traceability ownership drift",
  "rejects proof-document path, semantic marker, or hash drift",
  "accepts an injected exact proof-document pin",
  "atomic writer rejects a symlink destination",
  "atomic writer rejects temporary-byte tampering before rename",
  "rejects unknown or accessor-backed evidence options",
]);
const REVIEWED_TEST_SOURCE_SHA256 = Object.freeze({
  runtime: "9648619beda688c7598b0d68a5773e0c7ff4063a64b1656c4a897fd5c134de02",
  types: "a91afdc1c8ad1b7518e5eda138321b7bf1e3734342e5b4ff219ab4bb3edb5213",
  root: "f4a69cb9f7c21d9499fe0c1ce3000b18eb0199a8752c70511318ba4c2ba4378a",
});

export const DEFAULT_PUBLISHER_SOURCE_NORMALIZATION_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class PublisherSourceNormalizationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherSourceNormalizationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PublisherSourceNormalizationEvidenceError(code, message, details);
}
function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function record(value, label = "value") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("PUBLISHER_NORMALIZATION_VECTOR_INVALID", `${label} must be an object.`);
  }
  return value;
}
function at(root, segments) {
  let value = root;
  for (const segment of segments) value = value?.[segment];
  return value;
}
function occurrences(text, needle) {
  return text.split(needle).length - 1;
}
function ordinaryDataObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}
function capturePrerequisiteBytes(value) {
  if (value === undefined) return undefined;
  if (!ordinaryDataObject(value)) {
    fail(
      "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
      "prerequisiteBytes must be an ordinary own-data object.",
    );
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
      "prerequisiteBytes could not be inspected safely.",
    );
  }
  const allowed = new Set(PUBLISHER_SOURCE_NORMALIZATION_PREREQUISITE_PINS.map(({ path }) => path));
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
        "prerequisiteBytes could not be captured safely.",
      );
    }
    if (
      typeof key !== "string" ||
      !allowed.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      !(descriptor.value instanceof Uint8Array)
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
        "prerequisiteBytes contains an unknown, accessor-backed, or non-byte entry.",
      );
    }
    captured[key] = Buffer.from(descriptor.value);
  }
  return Object.freeze(captured);
}
function captureJsonData(value, label, state = { nodes: 0, active: new Set() }, depth = 0) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object" || depth > 64 || state.nodes >= 100_000) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} is not bounded inert JSON.`);
  }
  if (state.active.has(value)) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} contains a cycle.`);
  }
  state.nodes += 1;
  state.active.add(value);
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} could not be inspected safely.`);
  }
  let result;
  if (Array.isArray(value)) {
    if (
      keys.length !== value.length + 1 ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" &&
            (!/^(?:0|[1-9][0-9]*)$/u.test(key) ||
              Number(key) >= value.length ||
              String(Number(key)) !== key)),
      )
    ) {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} contains a sparse array.`);
    }
    result = [];
    for (let index = 0; index < value.length; index += 1) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} could not be captured safely.`);
      }
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail(
          "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
          `${label} contains a non-data array entry.`,
        );
      }
      result.push(captureJsonData(descriptor.value, label, state, depth + 1));
    }
  } else {
    if (!ordinaryDataObject(value)) {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} must contain ordinary objects.`);
    }
    result = Object.create(null);
    for (const key of keys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} could not be captured safely.`);
      }
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        fail(
          "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
          `${label} contains a symbol or non-data property.`,
        );
      }
      result[key] = captureJsonData(descriptor.value, label, state, depth + 1);
    }
  }
  state.active.delete(value);
  return Object.freeze(result);
}
function captureFlatRecord(value, label) {
  if (!ordinaryDataObject(value)) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} must be an ordinary object.`);
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} could not be inspected safely.`);
  }
  const result = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${label} could not be captured safely.`);
    }
    if (
      typeof key !== "string" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_OPTIONS_INVALID",
        `${label} contains a symbol or non-data property.`,
      );
    }
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}
function capture(value) {
  if (value === undefined) return Object.freeze({});
  const allowed = new Set([
    "artifactBytes",
    "artifactPath",
    "beforeAtomicRename",
    "prerequisiteBytes",
    "proofDocument",
    "normalization",
    "normalizationSource",
    "normalizationDistribution",
    "normalizationDeclaration",
    "publicApi",
    "publicDeclaration",
    "publisherPackage",
    "rootPackage",
    "ciSource",
    "traceability",
    "runtimeTest",
    "typeTest",
    "rootTest",
  ]);
  if (!ordinaryDataObject(value)) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "Options must be an own-data object.");
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "Options could not be inspected safely.");
  }
  const result = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "Options could not be captured safely.");
    }
    if (
      typeof key !== "string" ||
      !allowed.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "Unknown or non-data option.");
    if (key === "prerequisiteBytes") {
      result[key] = capturePrerequisiteBytes(descriptor.value);
    } else if (["publisherPackage", "rootPackage", "traceability"].includes(key)) {
      result[key] = captureJsonData(descriptor.value, key);
    } else if (key === "publicApi") {
      result[key] = captureFlatRecord(descriptor.value, key);
    } else {
      result[key] = descriptor.value;
    }
  }
  return Object.freeze(result);
}
function assertOptionTypes(options) {
  for (const key of [
    "proofDocument",
    "normalizationSource",
    "normalizationDistribution",
    "normalizationDeclaration",
    "publicDeclaration",
    "ciSource",
    "runtimeTest",
    "typeTest",
    "rootTest",
  ]) {
    if (options[key] !== undefined && typeof options[key] !== "string") {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${key} must be text.`);
    }
  }
  if (options.normalization !== undefined && typeof options.normalization !== "function") {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "normalization must be a function.");
  }
  for (const key of ["publicApi", "publisherPackage", "rootPackage", "traceability"]) {
    if (options[key] !== undefined && !ordinaryDataObject(options[key])) {
      fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", `${key} must be an ordinary object.`);
    }
  }
  if (options.artifactBytes !== undefined && !(options.artifactBytes instanceof Uint8Array)) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "artifactBytes must be a Uint8Array.");
  }
  if (
    options.artifactPath !== undefined &&
    (typeof options.artifactPath !== "string" || options.artifactPath.length === 0)
  ) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "artifactPath must be a non-empty string.");
  }
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "beforeAtomicRename must be a function.");
  }
}
async function bytes(relative) {
  const absolute = path.join(ROOT, relative);
  let stat;
  try {
    stat = await lstat(absolute);
  } catch (error) {
    fail("PUBLISHER_NORMALIZATION_FILE_MISSING", `Required file is missing: ${relative}`, {
      cause: String(error),
    });
  }
  if (!stat.isFile()) fail("PUBLISHER_NORMALIZATION_FILE_INVALID", `${relative} is not a file.`);
  return readFile(absolute);
}
async function text(relative) {
  return (await bytes(relative)).toString("utf8");
}
async function json(relative) {
  try {
    return JSON.parse(await text(relative));
  } catch {
    fail("PUBLISHER_NORMALIZATION_JSON_INVALID", `Invalid JSON: ${relative}`);
  }
}
function candidate(catalog) {
  return {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
  };
}
function invoke(normalization, source, catalog, limits, raw = false) {
  try {
    return normalization(
      raw ? source : JSON.stringify(source),
      catalog === undefined ? [] : [candidate(catalog)],
      ...(limits === undefined ? [] : [limits]),
    );
  } catch (error) {
    fail("PUBLISHER_NORMALIZATION_PREFLIGHT_THROW", "Normalization proof vector threw.", {
      cause: String(error),
    });
  }
}
function assertRuntimeAuthorityAliases(result, label) {
  try {
    const sourceHasExtensions = Object.hasOwn(result.source, "extensions");
    const preservedHasExtensions = Object.hasOwn(result.preservedDocument, "extensions");
    const packageCatalogIdentity =
      result.packages.length === result.catalogSet.length &&
      result.packages.every(
        (selectedPackage, index) => selectedPackage.catalog === result.catalogSet[index],
      );
    const requirementAlignment =
      result.requirementPackageIndexes.length === result.sourceCatalogRequirements.length &&
      result.requirementPackageIndexes.every(
        (packageIndex) =>
          Number.isSafeInteger(packageIndex) &&
          packageIndex >= 0 &&
          packageIndex < result.packages.length,
      );
    if (
      result.preservedDocument.surfaces !== result.source.surfaces ||
      sourceHasExtensions !== preservedHasExtensions ||
      (sourceHasExtensions && result.preservedDocument.extensions !== result.source.extensions) ||
      result.sourceCatalogRequirements !== result.source.catalogs ||
      !packageCatalogIdentity ||
      !requirementAlignment
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        `${label} lost required internal T06 aliases or alignment.`,
      );
    }
  } catch (error) {
    if (error instanceof PublisherSourceNormalizationEvidenceError) throw error;
    fail(
      "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
      `${label} runtime aliases could not be inspected safely.`,
      { cause: String(error) },
    );
  }
}
function success(result, label) {
  if (Object.getOwnPropertyDescriptor(result, "sourceNormalized")?.value !== true) {
    fail("PUBLISHER_NORMALIZATION_EXPECTED_SUCCESS", `${label} did not succeed.`);
  }
  assertRuntimeAuthorityAliases(result, label);
  return result;
}
function failure(result, code, label) {
  if (result?.ok !== false || !result.diagnostics?.some((item) => item.code === code)) {
    fail("PUBLISHER_NORMALIZATION_EXPECTED_FAILURE", `${label} did not fail as expected.`, {
      expectedCode: code,
    });
  }
  for (const field of PARTIALS) {
    if (Object.hasOwn(result, field)) {
      fail("PUBLISHER_NORMALIZATION_PARTIAL_FAILURE", `${label} exposed ${field}.`);
    }
  }
  if (
    canonicalizeJson(Object.keys(result).sort()) !==
    canonicalizeJson(["diagnostics", "ok", "stage"])
  ) {
    fail("PUBLISHER_NORMALIZATION_FAILURE_SHELL_DRIFT", `${label} changed the closed shell.`);
  }
  return result;
}
function limits(
  maximum,
  sourcePreservation = PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation,
) {
  return Object.freeze({
    sourcePreservation,
    maxNormalizedDocumentCanonicalBytes: maximum,
  });
}
function valueAtPointer(root, pointer) {
  let value = root;
  for (const token of parseJsonPointer(pointer)) {
    value = Array.isArray(value) ? value[Number(token)] : record(value, pointer)[token];
  }
  return value;
}
function reverseMembers(value) {
  if (Array.isArray(value)) return value.map(reverseMembers);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, item]) => [key, reverseMembers(item)]),
  );
}

function isDeepFrozen(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (!Object.isFrozen(value)) return false;
    pending.push(...(Array.isArray(value) ? value : Object.values(value)));
  }
  return true;
}

function authenticateTraceability(traceability) {
  const rows = new Map();
  const pending = [traceability];
  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    if (typeof value.id === "string") {
      const matches = rows.get(value.id) ?? [];
      matches.push(value);
      rows.set(value.id, matches);
    }
    pending.push(...Object.values(value));
  }

  for (const id of OWNED_TRACE_ROWS) {
    const matches = rows.get(id) ?? [];
    if (
      matches.length !== 1 ||
      !Array.isArray(matches[0].owners) ||
      !matches[0].owners.includes("M06-T07")
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_TRACEABILITY_DRIFT",
        `Traceability ownership drifted for ${id}.`,
      );
    }
  }
  const authoringRule = rows.get("R-034")?.[0];
  if (!Array.isArray(authoringRule?.bcp14) || !authoringRule.bcp14.includes("N-018")) {
    fail(
      "PUBLISHER_NORMALIZATION_TRACEABILITY_DRIFT",
      "R-034 no longer carries N-018 authoring ownership.",
    );
  }
  return Object.freeze({ rows: OWNED_TRACE_ROWS, normativeClause: "N-018" });
}
function enriched(source) {
  const result = clone(source);
  result.authoring = { editor: "top-level-only", fake: { kind: "desen.bundle" } };
  result.extensions = JSON.parse(
    '{"dev.desen.proof":{"10":"ten","2":"two","01":"leading","__proto__":{"safe":true},' +
      '"authoring":{"nested":"preserved"},"order":["third","first","second"]}}',
  );
  return result;
}

async function prerequisites(overrides) {
  return Promise.all(
    PUBLISHER_SOURCE_NORMALIZATION_PREREQUISITE_PINS.map(async (pin) => {
      const pinned = overrides?.[pin.path];
      const actual = hash(pinned === undefined ? await bytes(pin.path) : Buffer.from(pinned));
      if (actual !== pin.sha256) {
        fail("PUBLISHER_NORMALIZATION_PREREQUISITE_DRIFT", `${pin.task} prerequisite drifted.`, {
          path: pin.path,
          expected: pin.sha256,
          actual,
        });
      }
      return Object.freeze({ ...pin, verifiedSha256: actual });
    }),
  );
}
function importSpecifier(node) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteralLike(node.argument.literal)
  ) {
    return node.argument.literal.text;
  }
  return undefined;
}

function auditModule(source, relativePath, allowedImports, scriptKind) {
  const ast = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  if (ast.parseDiagnostics.length > 0) {
    fail("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT", `${relativePath} is not valid source text.`);
  }
  const imports = [];
  const platformHits = new Set();
  const loaders = [];
  let authoringReads = 0;
  function visit(node) {
    const specifier = importSpecifier(node);
    if (specifier !== undefined) imports.push(specifier);
    if (ts.isIdentifier(node) && PLATFORM.has(node.text)) platformHits.add(node.text);
    if (ts.isPropertyAccessExpression(node) && node.name.text === "authoring") authoringReads += 1;
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === "authoring"
    ) {
      authoringReads += 1;
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) loaders.push("import()");
      if (ts.isIdentifier(node.expression) && ["eval", "require"].includes(node.expression.text)) {
        loaders.push(`${node.expression.text}()`);
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["Function", "Worker", "SharedWorker"].includes(node.expression.text)
    ) {
      loaders.push(`new ${node.expression.text}()`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const unexpectedImports = imports.filter((item) => !allowedImports.has(item));
  const suppressions =
    source.match(/@ts-(?:check|expect-error|ignore|nocheck)|eslint-disable/gu) ?? [];
  const tripleSlash = source.match(/^\s*\/\/\/\s*<reference\b.*$/gmu) ?? [];
  if (
    unexpectedImports.length > 0 ||
    platformHits.size > 0 ||
    loaders.length > 0 ||
    suppressions.length > 0 ||
    tripleSlash.length > 0
  ) {
    fail("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT", `${relativePath} crossed its boundary.`, {
      unexpectedImports,
      platformHits: [...platformHits].sort(),
      loaders,
      suppressions,
      tripleSlash,
    });
  }
  return Object.freeze({
    ast,
    imports: Object.freeze([...imports].sort()),
    authoringReads,
  });
}

function propertyName(property) {
  if (property.name === undefined) return undefined;
  return ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
    ? property.name.text
    : undefined;
}

function exactPropertyAccess(node, objectName, property) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === objectName &&
    node.name.text === property
  );
}

function exactNormalizationAuthority(ast) {
  const entry = ast.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "preflightPublishSourceNormalization",
  );
  if (!entry || !ts.isFunctionDeclaration(entry) || entry.body === undefined) {
    fail("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT", "Normalization entry point is missing.");
  }

  const calls = new Map([
    ["preflightPublishSourcePreservation", []],
    ["calculateDesenSourceDigest", []],
    ["normalizeDocument", []],
  ]);
  const successReturns = [];
  function inspect(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      calls.has(node.expression.text)
    ) {
      calls.get(node.expression.text).push(node);
    }
    if (ts.isReturnStatement(node) && node.expression !== undefined) {
      const expression =
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === "Object" &&
        node.expression.expression.name.text === "freeze" &&
        node.expression.arguments.length === 1 &&
        ts.isObjectLiteralExpression(node.expression.arguments[0])
          ? node.expression.arguments[0]
          : node.expression;
      if (
        ts.isObjectLiteralExpression(expression) &&
        expression.properties.some((property) => propertyName(property) === "sourceNormalized")
      ) {
        successReturns.push(expression);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(entry.body);

  for (const [name, matches] of calls) {
    if (matches.length !== 1) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        `Normalization must contain exactly one direct ${name} call.`,
        { name, observed: matches.length },
      );
    }
  }

  function declarationFor(call) {
    const declaration = call.parent;
    if (
      !ts.isVariableDeclaration(declaration) ||
      declaration.initializer !== call ||
      !ts.isIdentifier(declaration.name)
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        "Each authority operation must initialize one named local.",
      );
    }
    const statement = declaration.parent?.parent;
    if (!ts.isVariableStatement(statement) || statement.parent !== entry.body) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        "Authority operations must execute directly in the entry-point sequence.",
      );
    }
    return Object.freeze({
      name: declaration.name.text,
      statementIndex: entry.body.statements.indexOf(statement),
    });
  }

  function guardedAssignmentFor(call) {
    const assignment = call.parent;
    if (
      !ts.isBinaryExpression(assignment) ||
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isIdentifier(assignment.left) ||
      !ts.isExpressionStatement(assignment.parent) ||
      !ts.isBlock(assignment.parent.parent) ||
      !ts.isTryStatement(assignment.parent.parent.parent) ||
      assignment.parent.parent.parent.tryBlock !== assignment.parent.parent ||
      assignment.parent.parent.parent.parent !== entry.body
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        "Source digest must be assigned in one direct controlled try boundary.",
      );
    }
    const declaration = entry.body.statements.find(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (candidate) =>
            ts.isIdentifier(candidate.name) &&
            candidate.name.text === assignment.left.text &&
            candidate.initializer === undefined,
        ),
    );
    if (declaration === undefined) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        "Source-digest authority local is missing or preinitialized.",
      );
    }
    return Object.freeze({
      name: assignment.left.text,
      statementIndex: entry.body.statements.indexOf(assignment.parent.parent.parent),
    });
  }

  const preservationCall = calls.get("preflightPublishSourcePreservation")[0];
  const digestCall = calls.get("calculateDesenSourceDigest")[0];
  const normalizationCall = calls.get("normalizeDocument")[0];
  const preservation = declarationFor(preservationCall);
  const digest = guardedAssignmentFor(digestCall);
  const normalized = declarationFor(normalizationCall);
  if (
    preservation.statementIndex < 0 ||
    digest.statementIndex <= preservation.statementIndex ||
    normalized.statementIndex <= digest.statementIndex ||
    preservationCall.arguments.length !== 3 ||
    preservationCall.arguments[0].getText(ast) !== "rawSourceInput" ||
    preservationCall.arguments[1].getText(ast) !== "catalogPackageCandidatesInput" ||
    !exactPropertyAccess(preservationCall.arguments[2], "limits", "sourcePreservation") ||
    digestCall.arguments.length !== 1 ||
    !exactPropertyAccess(digestCall.arguments[0], preservation.name, "source") ||
    normalizationCall.arguments.length !== 2 ||
    !exactPropertyAccess(normalizationCall.arguments[0], preservation.name, "preservedDocument") ||
    !exactPropertyAccess(
      normalizationCall.arguments[1],
      "limits",
      "maxNormalizedDocumentCanonicalBytes",
    )
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
      "Digest/removal/normalization order or exact predecessor inputs drifted.",
    );
  }

  if (successReturns.length !== 1) {
    fail(
      "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
      "Normalization must expose exactly one complete success object.",
    );
  }
  const success = successReturns[0];
  const expectedKeys = [
    ...AUTHORITY_FIELDS,
    "normalizedDocument",
    "sourceDigest",
    "sourceNormalized",
  ].sort();
  const properties = new Map();
  for (const property of success.properties) {
    const name = propertyName(property);
    if (
      name === undefined ||
      (!ts.isPropertyAssignment(property) &&
        !(name === "sourceDigest" && ts.isShorthandPropertyAssignment(property))) ||
      properties.has(name)
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
        "Success authority must use unique explicit data-property assignments.",
      );
    }
    properties.set(name, ts.isPropertyAssignment(property) ? property.initializer : property.name);
  }
  if (canonicalizeJson([...properties.keys()].sort()) !== canonicalizeJson(expectedKeys)) {
    fail("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT", "Success authority field inventory drifted.", {
      observed: [...properties.keys()].sort(),
      expected: expectedKeys,
    });
  }
  for (const field of AUTHORITY_FIELDS) {
    if (!exactPropertyAccess(properties.get(field), preservation.name, field)) {
      fail("PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT", `T06 carry drifted: ${field}`);
    }
  }
  if (
    properties.get("sourceDigest")?.getText(ast) !== digest.name ||
    !exactPropertyAccess(properties.get("normalizedDocument"), normalized.name, "value") ||
    properties.get("sourceNormalized")?.kind !== ts.SyntaxKind.TrueKeyword
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_AUTHORITY_DRIFT",
      "Digest, normalized document, or success discriminator drifted.",
    );
  }
  return Object.freeze({
    oneT06Call: true,
    sourceDigestBeforeNormalization: true,
    exactT06AuthorityCarry: true,
  });
}

function staticBoundary(
  source,
  distribution,
  declaration,
  publicDeclaration,
  publicApi,
  publisherPackage,
) {
  const sourceAudit = auditModule(source, SOURCE, ALLOWED_IMPORTS, ts.ScriptKind.TS);
  const distributionAudit = auditModule(
    distribution,
    DISTRIBUTION,
    ALLOWED_IMPORTS,
    ts.ScriptKind.JS,
  );
  const declarationAudit = auditModule(
    declaration,
    DECLARATION,
    ALLOWED_DECLARATION_IMPORTS,
    ts.ScriptKind.TS,
  );
  if (sourceAudit.authoringReads !== 0 || distributionAudit.authoringReads !== 0) {
    fail(
      "PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT",
      "Normalization must not inspect the authenticated Source authoring member.",
    );
  }
  const sourceAuthority = exactNormalizationAuthority(sourceAudit.ast);
  const distributionAuthority = exactNormalizationAuthority(distributionAudit.ast);
  const privateRuntimeNames = [
    "PUBLISH_SOURCE_NORMALIZATION_LIMITS",
    "SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE",
    "SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE",
    "normalizePublishSourceNormalizationLimits",
    "preflightPublishSourceNormalization",
  ];
  const privateDeclarationFragments = [
    "PUBLISH_SOURCE_NORMALIZATION_LIMITS",
    "PublishNormalizedDocument",
    "PublishSourceNormalizationLimits",
    "PublishSourceNormalizationResult",
    "PublishSourceNormalizationSuccess",
    "SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE",
    "SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE",
    "normalizePublishSourceNormalizationLimits",
    "sourceNormalized",
    "preflightPublishSourceNormalization",
  ];
  const leaked = [
    ...privateRuntimeNames.filter((name) => Object.hasOwn(publicApi, name)),
    ...privateDeclarationFragments.filter((name) => publicDeclaration.includes(name)),
  ];
  const exportKeys = Object.keys(publisherPackage.exports ?? {});
  const rootExport = publisherPackage.exports?.["."];
  const dependencies = Object.keys(publisherPackage.dependencies ?? {}).sort();
  const runtimeExports = Object.keys(publicApi).sort();
  if (
    leaked.length > 0 ||
    (canonicalizeJson(runtimeExports) !== canonicalizeJson(HISTORICAL_ROOT_RUNTIME_EXPORTS) &&
      canonicalizeJson(runtimeExports) !== canonicalizeJson(SUCCESSOR_ROOT_RUNTIME_EXPORTS)) ||
    canonicalizeJson(exportKeys) !== canonicalizeJson(["."]) ||
    !ordinaryDataObject(rootExport) ||
    canonicalizeJson(rootExport) !==
      canonicalizeJson({ types: "./dist/index.d.ts", import: "./dist/index.js" }) ||
    canonicalizeJson(dependencies) !== canonicalizeJson(["@desen/protocol", "@desen/validator"])
  ) {
    fail("PUBLISHER_NORMALIZATION_BOUNDARY_DRIFT", "Package-root privacy drifted.", {
      leaked,
      runtimeExports,
      exportKeys,
      rootExport,
      dependencies,
    });
  }
  for (const fragment of [
    "PublishNormalizedDocument",
    "PublishSourceNormalizationLimits",
    "PublishSourceNormalizationResult",
    "PublishSourceNormalizationSuccess",
    "sourceDigest",
    "sourceNormalized",
    "maxNormalizedDocumentCanonicalBytes",
  ]) {
    if (!declaration.includes(fragment)) {
      fail("PUBLISHER_NORMALIZATION_DECLARATION_DRIFT", `Missing declaration: ${fragment}`);
    }
  }
  return Object.freeze({
    sourceImports: sourceAudit.imports,
    distributionImports: distributionAudit.imports,
    declarationImports: declarationAudit.imports,
    platformNeutral: true,
    ...sourceAuthority,
    builtDistributionAuthority: distributionAuthority,
    noAuthoringPropertyRead: true,
    packagePrivate: true,
    exactRootPackageExport: true,
    exactProductionDependencies: dependencies,
  });
}
function registrations(rootPackage, publisherPackage, ciSource) {
  const prefix =
    "pnpm verify:publisher-source-preservation && pnpm --filter @desen/publisher... build && " +
    "pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher " +
    "test:source-normalization && ";
  const expected = Object.freeze({
    package: "vitest run test/source-normalization.test.ts",
    generate: `${prefix}node scripts/generate-publisher-source-normalization-proof.mjs`,
    verify: `${prefix}node scripts/verify-publisher-source-normalization.mjs`,
    test: `${prefix}node --test ${ROOT_TEST}`,
  });
  const scripts = rootPackage.scripts ?? {};
  const checks = typeof scripts.check === "string" ? scripts.check.split(" && ") : [];
  const tests = typeof scripts.test === "string" ? scripts.test.split(" && ") : [];
  const predecessorCheck = "pnpm verify:publisher-source-preservation";
  const predecessorTest = "pnpm test:publisher-source-preservation";
  const currentCheck = "pnpm verify:publisher-source-normalization";
  const currentTest = "pnpm test:publisher-source-normalization";
  const tuple = [
    "[",
    '      "publisher-source-normalization",',
    '      "scripts/verify-publisher-source-normalization.mjs",',
    `      "${ROOT_TEST}",`,
    "    ],",
  ].join("\n");
  if (
    publisherPackage.scripts?.["test:source-normalization"] !== expected.package ||
    scripts["generate:publisher-source-normalization"] !== expected.generate ||
    scripts["verify:publisher-source-normalization"] !== expected.verify ||
    scripts["test:publisher-source-normalization"] !== expected.test ||
    checks.filter((entry) => entry === predecessorCheck).length !== 1 ||
    checks.filter((entry) => entry === currentCheck).length !== 1 ||
    tests.filter((entry) => entry === predecessorTest).length !== 1 ||
    tests.filter((entry) => entry === currentTest).length !== 1 ||
    checks.indexOf(currentCheck) !== checks.indexOf(predecessorCheck) + 1 ||
    tests.indexOf(currentTest) !== tests.indexOf(predecessorTest) + 1 ||
    occurrences(ciSource, tuple) !== 1
  )
    fail("PUBLISHER_NORMALIZATION_REGISTRATION_DRIFT", "Package/root/CI registration drifted.");
  return Object.freeze({
    ...expected,
    predecessorAndCurrentRegisteredExactlyOnce: true,
    checkAndTestImmediateSuccessor: true,
    ciTupleExact: true,
  });
}
async function inventory() {
  const sorted = [...TRACKED].sort();
  if (new Set(sorted).size !== sorted.length) {
    fail("PUBLISHER_NORMALIZATION_TRACKED_FILE_DRIFT", "Tracked paths contain duplicates.");
  }
  return Promise.all(
    sorted.map(async (relative) => {
      const historical = HISTORICAL_TRACKED_RECEIPTS[relative];
      if (historical !== undefined) {
        return Object.freeze({ path: relative, ...historical });
      }
      return Object.freeze({
        path: relative,
        sha256: hash(await bytes(relative)),
      });
    }),
  );
}

function authenticateRootTestSemantics(rootTest) {
  const ast = ts.createSourceFile(
    ROOT_TEST,
    rootTest,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (ast.parseDiagnostics.length > 0) {
    fail("PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT", "Root mutation tests do not parse.");
  }
  const tests = new Map();
  for (const statement of ast.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      !ts.isIdentifier(statement.expression.expression) ||
      statement.expression.expression.text !== "test" ||
      statement.expression.arguments.length < 2 ||
      !ts.isStringLiteralLike(statement.expression.arguments[0]) ||
      (!ts.isArrowFunction(statement.expression.arguments[1]) &&
        !ts.isFunctionExpression(statement.expression.arguments[1]))
    ) {
      continue;
    }
    const name = statement.expression.arguments[0].text;
    if (tests.has(name)) {
      fail("PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT", `Duplicate root mutation test: ${name}`);
    }
    const callback = statement.expression.arguments[1];
    const assertionMethods = new Set();
    function inspect(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "assert"
      ) {
        assertionMethods.add(node.expression.name.text);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(callback.body);
    tests.set(name, assertionMethods);
  }
  const observed = [...tests.keys()].sort();
  const expected = [...EXPECTED_ROOT_TEST_NAMES].sort();
  if (canonicalizeJson(observed) !== canonicalizeJson(expected)) {
    fail(
      "PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT",
      "Root mutation test-name inventory drifted.",
      { observed, expected },
    );
  }
  for (const [name, assertions] of tests) {
    if (
      assertions.size === 0 ||
      ((name.startsWith("rejects ") || name.includes(" rejects ")) && !assertions.has("rejects"))
    ) {
      fail(
        "PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT",
        `Root mutation test lost its executable assertion: ${name}`,
      );
    }
  }
  return Object.freeze({
    exactNamedCases: tests.size,
    everyCaseContainsAnAssertion: true,
    rejectionCasesContainAssertRejects: true,
  });
}

function testInventory(runtimeTest, typeTest, rootTest) {
  const publisherRuntimeCases = (runtimeTest.match(/^\s*(?:it|test)\s*\(/gmu) ?? []).length;
  const compilerNegativeCases = (typeTest.match(/@ts-expect-error/gu) ?? []).length;
  const rootMutationCases = (rootTest.match(/^\s*test\s*\(/gmu) ?? []).length;
  const reviewedSha256 = Object.freeze({
    runtime: hash(Buffer.from(runtimeTest, "utf8")),
    types: hash(Buffer.from(typeTest, "utf8")),
    root: hash(Buffer.from(rootTest, "utf8")),
  });
  if (publisherRuntimeCases < 17 || compilerNegativeCases < 52 || rootMutationCases < 26) {
    fail(
      "PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT",
      "Source-normalization tests fell below the reviewed minimum breadth.",
      { publisherRuntimeCases, compilerNegativeCases, rootMutationCases },
    );
  }
  if (
    reviewedSha256.runtime !== REVIEWED_TEST_SOURCE_SHA256.runtime ||
    reviewedSha256.types !== REVIEWED_TEST_SOURCE_SHA256.types ||
    reviewedSha256.root !== REVIEWED_TEST_SOURCE_SHA256.root
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_TEST_INVENTORY_DRIFT",
      "Reviewed focused, compiler-negative, or root mutation test semantics drifted.",
      { expected: REVIEWED_TEST_SOURCE_SHA256, observed: reviewedSha256 },
    );
  }
  const rootSemantics = authenticateRootTestSemantics(rootTest);
  return Object.freeze({
    publisherRuntimeCases,
    compilerNegativeCases,
    rootMutationCases,
    reviewedSha256,
    rootSemantics,
  });
}

export async function buildPublisherSourceNormalizationEvidence(rawOptions = undefined) {
  const options = capture(rawOptions);
  assertOptionTypes(options);
  const [
    sourceFixture,
    catalogFixture,
    normalizationSource,
    normalizationDistribution,
    normalizationDeclaration,
    publicDeclaration,
    publisherPackage,
    rootPackage,
    ciSource,
    sourceSchema,
    bundleSchema,
    traceability,
    runtimeTest,
    typeTest,
    rootTest,
  ] = await Promise.all([
    json(FIXTURES.source),
    json(FIXTURES.catalog),
    options.normalizationSource ?? text(SOURCE),
    options.normalizationDistribution ?? text(DISTRIBUTION),
    options.normalizationDeclaration ?? text(DECLARATION),
    options.publicDeclaration ?? text(PUBLIC_DECLARATION),
    options.publisherPackage ?? json(PUBLISHER_PACKAGE),
    options.rootPackage ?? json(ROOT_PACKAGE),
    options.ciSource ?? text(CI_SOURCE),
    json(SOURCE_SCHEMA),
    json(BUNDLE_SCHEMA),
    options.traceability ?? json(TRACEABILITY),
    options.runtimeTest ?? text(RUNTIME_TEST),
    options.typeTest ?? text(TYPE_TEST),
    options.rootTest ?? text(ROOT_TEST),
  ]);
  const normalization = options.normalization ?? preflightPublishSourceNormalization;
  if (typeof normalization !== "function") {
    fail("PUBLISHER_NORMALIZATION_OPTIONS_INVALID", "normalization must be a function.");
  }
  const pins = await prerequisites(options.prerequisiteBytes);
  const boundary = staticBoundary(
    normalizationSource,
    normalizationDistribution,
    normalizationDeclaration,
    publicDeclaration,
    options.publicApi ?? publisherPublicApi,
    publisherPackage,
  );
  const registration = registrations(rootPackage, publisherPackage, ciSource);
  const traceabilityOwnership = authenticateTraceability(traceability);
  const tests = testInventory(runtimeTest, typeTest, rootTest);
  if (
    sourceSchema.properties?.authoring?.type !== "object" ||
    Object.hasOwn(bundleSchema.properties ?? {}, "authoring")
  ) {
    fail("PUBLISHER_NORMALIZATION_SCHEMA_DRIFT", "Frozen authoring scope drifted.");
  }

  const base = success(invoke(normalization, clone(sourceFixture), clone(catalogFixture)), "base");
  const expectedDocument = {
    kind: "desen.bundle",
    desen: base.preservedDocument.desen,
    id: base.preservedDocument.id,
    entry: base.preservedDocument.entry,
    surfaces: base.preservedDocument.surfaces,
    ...(base.preservedDocument.extensions === undefined
      ? {}
      : { extensions: base.preservedDocument.extensions }),
  };
  if (
    canonicalizeJson(base.normalizedDocument) !== canonicalizeJson(expectedDocument) ||
    Object.hasOwn(base.normalizedDocument, "authoring")
  ) {
    fail("PUBLISHER_NORMALIZATION_PROJECTION_DRIFT", "Normalized projection changed.");
  }
  if (
    !isSha256Digest(base.sourceDigest) ||
    base.sourceDigest !== calculateDesenSourceDigest(base.source) ||
    Object.hasOwn(base.normalizedDocument, "sourceDigest")
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_SOURCE_DIGEST_DRIFT",
      "The pre-normalization Source digest authority drifted.",
    );
  }
  for (const trace of base.traceability.sourceNodes) {
    const node = record(valueAtPointer(base.normalizedDocument, trace.sourcePointer));
    if (node.id !== trace.sourceNodeId || node.use !== trace.capabilityId) {
      fail("PUBLISHER_NORMALIZATION_TRACE_DRIFT", "Trace pointer no longer resolves.");
    }
  }
  const firstSource = clone(sourceFixture);
  const secondSource = clone(sourceFixture);
  firstSource.authoring = { editor: "a", large: "a".repeat(4_096) };
  secondSource.authoring = { editor: "b", large: "b".repeat(8_192) };
  const first = success(invoke(normalization, firstSource, clone(catalogFixture)), "authoring A");
  const second = success(invoke(normalization, secondSource, clone(catalogFixture)), "authoring B");
  if (
    canonicalizeJson(first.normalizedDocument) !== canonicalizeJson(second.normalizedDocument) ||
    first.sourceDigest !== second.sourceDigest ||
    first.sourceDigest !== calculateDesenSourceDigest(first.source) ||
    second.sourceDigest !== calculateDesenSourceDigest(second.source)
  ) {
    fail("PUBLISHER_NORMALIZATION_AUTHORING_DRIFT", "Root authoring affected output.");
  }
  const richSource = enriched(sourceFixture);
  const rich = success(invoke(normalization, richSource, clone(catalogFixture)), "rich source");
  const richExtension = rich.normalizedDocument.extensions?.["dev.desen.proof"];
  if (
    typeof richExtension !== "object" ||
    richExtension === null ||
    richExtension.authoring?.nested !== "preserved" ||
    richExtension["01"] !== "leading" ||
    richExtension["10"] !== "ten" ||
    richExtension["2"] !== "two" ||
    richExtension["__proto__"]?.safe !== true ||
    !Array.isArray(richExtension.order) ||
    canonicalizeJson(richExtension.order) !== canonicalizeJson(["third", "first", "second"]) ||
    rich.sourceDigest !== calculateDesenSourceDigest(rich.source) ||
    rich.sourceDigest === base.sourceDigest
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_EXTENSION_DRIFT",
      "Nested authoring, integer keys, or semantic extension-array order changed.",
    );
  }
  if (!isDeepFrozen(base) || !isDeepFrozen(rich)) {
    fail("PUBLISHER_NORMALIZATION_FREEZE_DRIFT", "Success authority is not deeply frozen.");
  }
  const reordered = success(
    invoke(normalization, reverseMembers(richSource), reverseMembers(catalogFixture)),
    "reordered",
  );
  if (
    !byteEqual(
      canonicalizeJsonBytes(rich.normalizedDocument),
      canonicalizeJsonBytes(reordered.normalizedDocument),
    )
  ) {
    fail("PUBLISHER_NORMALIZATION_CANONICAL_DRIFT", "RFC 8785 equivalence changed.");
  }
  const omitted = clone(sourceFixture);
  delete at(omitted, ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0])
    .concurrency;
  const empty = clone(sourceFixture);
  const emptyNode = at(empty, ["surfaces", "home", "root", "slots", "default", 0]);
  Object.assign(emptyNode, {
    slots: {},
    style: {},
    variants: [],
    behaviors: [],
    on: {},
    extensions: {},
  });
  const omittedResult = success(invoke(normalization, omitted, clone(catalogFixture)), "omitted");
  const emptyResult = success(invoke(normalization, empty, clone(catalogFixture)), "empty");
  if (
    Object.hasOwn(
      at(omittedResult.normalizedDocument, [
        "surfaces",
        "sign-in",
        "root",
        "slots",
        "default",
        4,
        "on",
        "press",
        0,
      ]),
      "concurrency",
    ) ||
    ["slots", "style", "variants", "behaviors", "on", "extensions"].some(
      (key) =>
        !Object.hasOwn(
          at(emptyResult.normalizedDocument, ["surfaces", "home", "root", "slots", "default", 0]),
          key,
        ),
    )
  )
    fail("PUBLISHER_NORMALIZATION_MINIMALITY_DRIFT", "Defaults or empty deletion appeared.");
  const observed = canonicalizeJsonBytes(rich.normalizedDocument).length;
  success(
    invoke(normalization, richSource, clone(catalogFixture), limits(observed)),
    "exact bytes",
  );
  failure(
    invoke(normalization, richSource, clone(catalogFixture), limits(observed - 1)),
    SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    "minus one",
  );
  failure(
    invoke(normalization, sourceFixture, clone(catalogFixture), limits(0)),
    SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    "zero",
  );
  const deprecatedCatalog = clone(catalogFixture);
  deprecatedCatalog.components["com.example.ui/Stack"].deprecated = true;
  const warned = success(
    invoke(normalization, sourceFixture, deprecatedCatalog),
    "warning-bearing source",
  );
  if (
    !warned.diagnostics.some(
      ({ code, severity }) =>
        code === "run.desen.publisher/DEPRECATED_CAPABILITY" && severity === "warning",
    )
  ) {
    fail("PUBLISHER_NORMALIZATION_WARNING_DRIFT", "Inherited warning was not retained on success.");
  }
  const warningRejected = failure(
    invoke(normalization, sourceFixture, deprecatedCatalog, limits(0)),
    SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    "warning suppression",
  );
  if (
    warningRejected.diagnostics.some(
      ({ code }) => code === "run.desen.publisher/DEPRECATED_CAPABILITY",
    )
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_WARNING_DRIFT",
      "A later normalization failure retained an inherited warning.",
    );
  }
  const twoMiBSource = clone(sourceFixture);
  twoMiBSource.extensions = { "dev.desen.proof": { unicode: "😀é", padding: "" } };
  const twoMiBBaseline = success(
    invoke(normalization, twoMiBSource, clone(catalogFixture)),
    "2 MiB baseline",
  );
  const gap = 2_097_152 - canonicalizeJsonBytes(twoMiBBaseline.normalizedDocument).length;
  if (
    gap < 1 ||
    PUBLISH_SOURCE_NORMALIZATION_LIMITS.maxNormalizedDocumentCanonicalBytes !== 2_097_152
  ) {
    fail("PUBLISHER_NORMALIZATION_LIMIT_PROFILE_DRIFT", "Default 2 MiB profile drifted.");
  }
  twoMiBSource.extensions["dev.desen.proof"].padding = "x".repeat(gap);
  const exactTwoMiB = success(
    invoke(normalization, twoMiBSource, clone(catalogFixture)),
    "exact 2 MiB",
  );
  if (canonicalizeJsonBytes(exactTwoMiB.normalizedDocument).length !== 2_097_152) {
    fail("PUBLISHER_NORMALIZATION_LIMIT_PROFILE_DRIFT", "Exact 2 MiB vector missed boundary.");
  }
  twoMiBSource.extensions["dev.desen.proof"].padding += "x";
  failure(
    invoke(normalization, twoMiBSource, clone(catalogFixture)),
    SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    "2 MiB plus one",
  );
  const malformed = '{"kind":"desen.source",';
  const inherited = preflightPublishSourcePreservation(malformed, [
    candidate(clone(catalogFixture)),
  ]);
  const inheritedActual = invoke(normalization, malformed, clone(catalogFixture), undefined, true);
  if (canonicalizeJson(inheritedActual) !== canonicalizeJson(inherited)) {
    fail("PUBLISHER_NORMALIZATION_INHERITED_FAILURE_DRIFT", "T06 failure was remapped.");
  }
  failure(inheritedActual, "run.desen.publisher/INVALID_SOURCE_JSON", "inherited malformed JSON");
  if (normalization !== preflightPublishSourceNormalization) {
    fail(
      "PUBLISHER_NORMALIZATION_IMPLEMENTATION_PROVENANCE_DRIFT",
      "A non-production normalization implementation cannot mint official M06-T07 evidence.",
    );
  }
  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.source-normalization-proof.v1",
    task: "M06-T07",
    result: "PASS",
    summary:
      "The exact Source digest is calculated before root authoring removal; production JSON is then minimally normalized into a detached RFC 8785-stable, finite, package-private nonterminal document.",
    prerequisites: pins,
    claims: Object.freeze({
      exactT06AuthorityCarry: AUTHORITY_FIELDS,
      sourceDigestCalculatedBeforeNormalization: true,
      sourceDigestMatchesExactAuthenticatedSourceProjection: true,
      rootAuthoringIndependent: true,
      nestedAuthoringPreserved: true,
      integerLikeExtensionKeysPreserved: true,
      rfc8785EquivalentObjectOrders: true,
      minimalNormalizationWithoutDefaultsOrEmptyDeletion: true,
      tracePointersResolved: base.traceability.sourceNodes.length,
      canonicalUtf8Limits: Object.freeze({
        observedExact: observed,
        observedMinusOneRejected: true,
        zeroRejected: true,
        defaultExactBytes: 2_097_152,
        defaultOverByOneRejected: true,
      }),
      representativeInheritedFailureUnchangedAndPartialFree: true,
      laterFailureSuppressesInheritedWarnings: true,
      completeSuccessDeeplyFrozen: true,
      frozenSchemaAuthoringScope: true,
      officialArtifactUsesExactProductionImplementation: true,
      privatePlatformNeutralBoundary: boundary,
      semanticRegistrations: registration,
      traceabilityOwnership,
    }),
    nonclaims: Object.freeze([
      "No exact Catalog tuple, Bundle revision, terminal Bundle, signature, runtime, host, or adapter authority is produced.",
      "Object member enumeration order is not assigned semantic meaning.",
    ]),
    tests,
    trackedFiles: await inventory(),
    reproduction: Object.freeze([
      "pnpm verify:publisher-source-preservation",
      "pnpm --filter @desen/publisher build",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:source-normalization",
      "node scripts/generate-publisher-source-normalization-proof.mjs",
      "node scripts/verify-publisher-source-normalization.mjs",
      `node --test ${ROOT_TEST}`,
    ]),
  });
  const artifactBytes = Buffer.from(
    await format(JSON.stringify(artifact), {
      parser: "json",
      printWidth: 100,
      tabWidth: 2,
      endOfLine: "lf",
    }),
    "utf8",
  );
  return Object.freeze({ artifact, artifactBytes, artifactSha256: hash(artifactBytes) });
}

function proofPin(document, digest) {
  const expected = `sha256:${digest}`;
  const digestPins =
    typeof document === "string" ? (document.match(/sha256:[0-9a-f]{64}/gu) ?? []) : [];
  const passDecision = "M06-T07 is `PASS` for its bounded claim.";
  const digestDecision =
    "The authenticated Source digest precedes root authoring removal and RFC 8785 normalization.";
  if (
    typeof document !== "string" ||
    document.split(/\r?\n/u, 1)[0] !== "# M06-T07 — Source normalization proof" ||
    occurrences(document, passDecision) !== 1 ||
    occurrences(document, digestDecision) !== 1 ||
    occurrences(document, `\`${ARTIFACT}\``) !== 1 ||
    occurrences(document, `\`${expected}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expected ||
    !document.includes("RFC 8785") ||
    !document.includes("authoring") ||
    /\b(?:BLOCKED|FAIL|FAILED|NOT_PROVEN)\b/u.test(document) ||
    /\b(?:does not pass|not proven|status:\s*fail)\b/iu.test(document) ||
    /\b(?:this|the)\s+(?:bounded\s+)?claim\s+(?:fails?|failed|is\s+(?:false|invalid))\b/iu.test(
      document,
    ) ||
    document.includes("PENDING_M06_T07_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_NORMALIZATION_PROOF_DOCUMENT_DRIFT",
      "Proof document does not uniquely and semantically pin the artifact.",
      {
        expectedArtifactPath: ARTIFACT,
        expectedHash: expected,
      },
    );
  }
}

export async function verifyPublisherSourceNormalizationEvidence(rawOptions = undefined) {
  const options = capture(rawOptions);
  const built = await buildPublisherSourceNormalizationEvidence(options);
  const actual =
    options.artifactBytes === undefined
      ? await bytes(ARTIFACT)
      : Buffer.from(options.artifactBytes);
  if (!byteEqual(actual, built.artifactBytes)) {
    fail(
      "PUBLISHER_NORMALIZATION_ARTIFACT_DRIFT",
      "Tracked normalization artifact differs from a fresh deterministic build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256: hash(actual),
      },
    );
  }
  const document =
    options.proofDocument === undefined ? await text(PROOF_DOCUMENT) : options.proofDocument;
  proofPin(document, built.artifactSha256);
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    tracePointersResolved: built.artifact.claims.tracePointersResolved,
    trackedFiles: built.artifact.trackedFiles.length,
    proofDocumentPinned: true,
  });
}

export async function writePublisherSourceNormalizationEvidence(rawOptions = undefined) {
  const options = capture(rawOptions);
  const built = await buildPublisherSourceNormalizationEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_SOURCE_NORMALIZATION_ARTIFACT_PATH;
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
