import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import {
  calculateDesenSourceDigest,
  canonicalizeJson,
  isSha256Digest,
} from "../../packages/protocol/dist/index.js";
import { preflightPublishCatalogPinning } from "../../packages/publisher/dist/catalog-pinning.js";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json";
const PROOF_DOCUMENT = "docs/proof/PUBLISHER-CATALOG-PINNING.md";
const SOURCE = "packages/publisher/src/catalog-pinning.ts";
const DISTRIBUTION = "packages/publisher/dist/catalog-pinning.js";
const DECLARATION = "packages/publisher/dist/catalog-pinning.d.ts";
const PUBLIC_DECLARATION = "packages/publisher/dist/index.d.ts";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const RUNTIME_TEST = "packages/publisher/test/catalog-pinning.test.ts";
const TYPE_TEST = "packages/publisher/test/catalog-pinning.types.ts";
const ROOT_TEST = "tests/publisher-catalog-pinning.test.mjs";
const CI_CONTRACT_TEST = "scripts/test/ci-quality-gate.test.mjs";
const CATALOG_RESOLUTION_PROOF_READER = "scripts/lib/publisher-catalog-resolution-proof.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const SOURCE_SCHEMA = "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-source.schema.json";
const BUNDLE_SCHEMA = "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";
const FIXTURES = Object.freeze({
  source: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
  catalog: "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
});

export const PUBLISHER_CATALOG_PINNING_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M06-T02",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json",
    sha256: "02c5c567c8603470f0f45515dfd1713e528147bcc15ed72daa580807388015f6",
  }),
  Object.freeze({
    task: "M06-T07",
    path: "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
    sha256: "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e",
  }),
]);

const TRACKED = Object.freeze([
  TRACEABILITY,
  FIXTURES.source,
  FIXTURES.catalog,
  SOURCE_SCHEMA,
  BUNDLE_SCHEMA,
  DISTRIBUTION,
  DECLARATION,
  PUBLIC_DECLARATION,
  SOURCE,
  RUNTIME_TEST,
  TYPE_TEST,
  ROOT_PACKAGE,
  PUBLISHER_PACKAGE,
  CI_SOURCE,
  CI_CONTRACT_TEST,
  CATALOG_RESOLUTION_PROOF_READER,
  "scripts/generate-publisher-catalog-pinning-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-catalog-pinning-proof.mjs",
  "scripts/verify-publisher-catalog-pinning.mjs",
  ROOT_TEST,
]);

const EXPECTED_TRACE_ROWS = Object.freeze([
  Object.freeze({ collection: "conformanceRules", id: "C-013", owner: "M06-T08" }),
  Object.freeze({ collection: "conformanceRules", id: "C-014", owner: "M06-T08" }),
  Object.freeze({ collection: "pipelineSteps", id: "PIPE-035", owner: "M06-T08" }),
  Object.freeze({ collection: "pipelineSteps", id: "PIPE-038", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-018", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-028", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-033", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-034", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-136", owner: "M06-T08" }),
  Object.freeze({ collection: "proseRules", id: "R-139", owner: "M06-T08" }),
  Object.freeze({ collection: "invariants", id: "A-004", owner: "M06-T08" }),
  Object.freeze({ collection: "diagnostics", id: "D-031", owner: "M06-T08" }),
]);

const SUCCESS_KEYS = Object.freeze(
  [
    "catalogsPinned",
    "catalogSet",
    "diagnostics",
    "normalizedDocument",
    "obligations",
    "packages",
    "pinnedDocument",
    "preservedDocument",
    "requirementPackageIndexes",
    "source",
    "sourceCatalogRequirements",
    "sourceDigest",
    "traceability",
  ].sort(),
);
const CARRIED_KEYS = Object.freeze(
  [
    "sourceDigest",
    "source",
    "catalogSet",
    "packages",
    "requirementPackageIndexes",
    "diagnostics",
    "obligations",
    "preservedDocument",
    "sourceCatalogRequirements",
    "traceability",
    "normalizedDocument",
  ].sort(),
);
const PINNED_REQUIRED_KEYS = Object.freeze([
  "desen",
  "entry",
  "id",
  "kind",
  "requires",
  "sourceDigest",
  "surfaces",
]);
const EXACT_TUPLE_KEYS = Object.freeze(["digest", "id", "target", "version"]);
const FORBIDDEN_SUCCESS_KEYS = Object.freeze([
  "bundle",
  "ok",
  "publication",
  "revision",
  "signature",
]);
const FORBIDDEN_IMPORT_PATTERN =
  /^(?:node:|react(?:\/|$)|react-dom(?:\/|$)|@desen\/runtime|@desen\/reference|@desen\/app)/u;
const OBJECT_PROTOTYPE = Object.prototype;
const OPTION_KEYS = new Set([
  "artifactBytes",
  "artifactPath",
  "beforeAtomicRename",
  "catalogText",
  "pinning",
  "prerequisiteBytes",
  "proofDocument",
  "proofDocumentPath",
  "sourceText",
  "traceabilityText",
  "trackedFileBytes",
]);

export const DEFAULT_PUBLISHER_CATALOG_PINNING_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class PublisherCatalogPinningEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublisherCatalogPinningEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new PublisherCatalogPinningEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function exactOwnDataOptions(rawOptions) {
  if (rawOptions === undefined) return Object.freeze({});
  try {
    if (
      typeof rawOptions !== "object" ||
      rawOptions === null ||
      Array.isArray(rawOptions) ||
      Object.getPrototypeOf(rawOptions) !== OBJECT_PROTOTYPE
    ) {
      throw new TypeError();
    }
    const captured = {};
    for (const key of Reflect.ownKeys(rawOptions)) {
      if (typeof key !== "string" || !OPTION_KEYS.has(key)) throw new TypeError();
      const descriptor = Object.getOwnPropertyDescriptor(rawOptions, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning evidence options must be an exact inert own-data record.",
    );
  }
}

function ownData(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function assertSuccess(result, label) {
  if (
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result) ||
    ownData(result, "catalogsPinned") !== true
  ) {
    fail("PUBLISHER_CATALOG_PINNING_EXPECTED_SUCCESS", `${label} did not pin Catalogs.`);
  }
  return result;
}

function assertFailure(result, expectedStage, label) {
  if (
    typeof result !== "object" ||
    result === null ||
    ownData(result, "ok") !== false ||
    ownData(result, "stage") !== expectedStage
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_EXPECTED_FAILURE",
      `${label} did not fail at ${expectedStage}.`,
    );
  }
  const keys = Reflect.ownKeys(result).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["diagnostics", "ok", "stage"])) {
    fail(
      "PUBLISHER_CATALOG_PINNING_PARTIAL_LEAK",
      `${label} exposed authority outside the closed failure shell.`,
      { keys },
    );
  }
  return result;
}

function sortedOwnKeys(value) {
  return Reflect.ownKeys(value).map(String).sort();
}

function assertExactKeys(value, expected, code, label) {
  const actual = sortedOwnKeys(value);
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(code, `${label} has an unexpected field set.`, { expected: [...expected].sort(), actual });
  }
}

function isDeeplyFrozen(root) {
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor)) return false;
      pending.push(descriptor.value);
    }
  }
  return true;
}

function candidateFromCatalog(catalog) {
  return {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
  };
}

function clone(value) {
  return structuredClone(value);
}

function canonical(value) {
  return canonicalizeJson(value);
}

function countNamedTests(text) {
  return [...text.matchAll(/\b(?:it|test)\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function countCompilerNegativeCases(text) {
  return (text.match(/@ts-expect-error\b/gu) ?? []).length;
}

function parseJson(text, code, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

function decodeUtf8(bytes, code, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${label} is not valid UTF-8.`);
  }
}

function freezeJson(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeJson(value[key], seen);
  return Object.freeze(value);
}

async function authenticatedFrozenArtifactProjection() {
  const authority = await readCheckpointedFrozenArtifact("M06-T08");
  if (authority.path !== ARTIFACT) {
    fail(
      "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T08 artifact path drifted.",
    );
  }
  const artifact = parseJson(
    decodeUtf8(
      authority.bytes,
      "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
      "Checkpoint-authenticated M06-T08 artifact",
    ),
    "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
    "Checkpoint-authenticated M06-T08 artifact",
  );
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.profile !== "desen.publisher.catalog-pinning-proof.v1" ||
    artifact.task !== "M06-T08" ||
    artifact.result !== "PASS" ||
    !Array.isArray(artifact.trackedFiles) ||
    artifact.trackedFiles.length !== TRACKED.length ||
    artifact.claims?.registrations === null ||
    typeof artifact.claims?.registrations !== "object" ||
    Array.isArray(artifact.claims?.registrations) ||
    artifact.tests === null ||
    typeof artifact.tests !== "object" ||
    Array.isArray(artifact.tests)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T08 artifact identity or inventory drifted.",
    );
  }
  const trackedFiles = artifact.trackedFiles.map((receipt, index) => {
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      Array.isArray(receipt) ||
      receipt.path !== TRACKED[index] ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes <= 0 ||
      typeof receipt.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256)
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
        "A checkpoint-authenticated M06-T08 tracked receipt drifted.",
        { index },
      );
    }
    return Object.freeze({
      path: receipt.path,
      bytes: receipt.bytes,
      sha256: receipt.sha256,
    });
  });
  return Object.freeze({
    trackedFiles: Object.freeze(trackedFiles),
    registrations: freezeJson(artifact.claims.registrations),
    tests: freezeJson(artifact.tests),
  });
}

function assertPrivateCatalogPinningBoundary(publicDeclaration, publisherPackageJsonText) {
  const publisherPackage = parseJson(
    publisherPackageJsonText,
    "PUBLISHER_CATALOG_PINNING_PUBLIC_API_DRIFT",
    "Publisher package manifest",
  );
  const packageExports = publisherPackage.exports;
  const rootExport =
    packageExports !== null &&
    typeof packageExports === "object" &&
    !Array.isArray(packageExports) &&
    Object.keys(packageExports).length === 1 &&
    Object.hasOwn(packageExports, ".")
      ? packageExports["."]
      : undefined;
  if (
    /\b(?:PublishCatalogPinning|preflightPublishCatalogPinning|CATALOG_PINNING_)\b/u.test(
      publicDeclaration,
    ) ||
    rootExport === null ||
    typeof rootExport !== "object" ||
    Array.isArray(rootExport) ||
    JSON.stringify(Object.keys(rootExport).sort()) !== JSON.stringify(["import", "types"]) ||
    rootExport.import !== "./dist/index.js" ||
    rootExport.types !== "./dist/index.d.ts"
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_PUBLIC_API_DRIFT",
      "The package-private Catalog-pinning boundary leaked through the package root or subpath.",
    );
  }
}

async function readRegularAbsoluteBytes(absolutePath, code, label, details = Object.freeze({})) {
  let stats;
  try {
    stats = await lstat(absolutePath);
  } catch {
    fail(code, `${label} is missing or unreadable.`, details);
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    fail(code, `${label} must be one regular non-symbolic file.`, details);
  }

  let handle;
  try {
    handle = await open(absolutePath, fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0));
    const openedStats = await handle.stat();
    if (!openedStats.isFile()) {
      fail(code, `${label} must remain one regular file while it is read.`, details);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof PublisherCatalogPinningEvidenceError) throw error;
    fail(code, `${label} could not be opened as one regular non-symbolic file.`, details);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readRegularBytes(relativePath, code = "PUBLISHER_CATALOG_PINNING_FILE_DRIFT") {
  return readRegularAbsoluteBytes(
    path.join(ROOT, relativePath),
    code,
    "Catalog-pinning evidence input",
    Object.freeze({ relativePath }),
  );
}

async function defaultText(relativePath) {
  return readRegularBytes(relativePath).then((bytes) => bytes.toString("utf8"));
}

function readOverrideMap(map, relativePath) {
  if (map === undefined) return undefined;
  try {
    if (typeof map !== "object" || map === null || Array.isArray(map)) throw new TypeError();
    const descriptor = Object.getOwnPropertyDescriptor(map, relativePath);
    if (descriptor === undefined) return undefined;
    if (!descriptor.enumerable || !("value" in descriptor)) throw new TypeError();
    const value = descriptor.value;
    if (!(value instanceof Uint8Array)) throw new TypeError();
    return Buffer.from(value);
  } catch {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning evidence byte overrides must be inert Uint8Array entries.",
      { relativePath },
    );
  }
}

async function trackedBytes(options, relativePath) {
  const override = readOverrideMap(options.trackedFileBytes, relativePath);
  return override ?? readRegularBytes(relativePath);
}

async function prerequisiteClaims(options) {
  const claims = [];
  for (const pin of PUBLISHER_CATALOG_PINNING_PREREQUISITE_PINS) {
    const override = readOverrideMap(options.prerequisiteBytes, pin.path);
    const bytes =
      override ??
      (await readRegularBytes(pin.path, "PUBLISHER_CATALOG_PINNING_PREREQUISITE_DRIFT"));
    const actual = sha256(bytes);
    if (actual !== pin.sha256) {
      fail(
        "PUBLISHER_CATALOG_PINNING_PREREQUISITE_DRIFT",
        `Exact prerequisite ${pin.task} does not match its reviewed bytes.`,
        { path: pin.path, expected: pin.sha256, actual },
      );
    }
    claims.push(Object.freeze({ ...pin, verifiedSha256: actual }));
  }
  return Object.freeze(claims);
}

function implementationAudit(sourceText, distributionText) {
  const sourceFile = ts.createSourceFile(
    SOURCE,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("PUBLISHER_CATALOG_PINNING_SOURCE_DRIFT", "Catalog-pinning source no longer parses.");
  }

  const imports = [];
  const calls = [];
  const objectPropertySets = [];
  let locationPropertyRead = false;
  let exactSuccessAuthorityProjection = false;
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        calls.push(
          Object.freeze({ name: node.expression.text, position: node.getStart(sourceFile) }),
        );
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        calls.push(
          Object.freeze({ name: node.expression.name.text, position: node.getStart(sourceFile) }),
        );
      }
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "location") {
      locationPropertyRead = true;
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "location"
    ) {
      locationPropertyRead = true;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const assignments = new Map();
      const names = node.properties
        .map((property) => {
          if (ts.isPropertyAssignment(property)) {
            const name = property.name.getText(sourceFile).replace(/^["']|["']$/gu, "");
            assignments.set(name, property.initializer.getText(sourceFile));
            return name;
          }
          if (ts.isShorthandPropertyAssignment(property)) {
            const name = property.name.getText(sourceFile);
            assignments.set(name, name);
            return name;
          }
          return undefined;
        })
        .filter((value) => value !== undefined)
        .sort();
      objectPropertySets.push(names);
      if (
        assignments.get("catalogsPinned") === "true" &&
        CARRIED_KEYS.every((key) => assignments.get(key) === `normalization.${key}`) &&
        assignments.get("pinnedDocument") === "pinned.document"
      ) {
        exactSuccessAuthorityProjection = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const normalizationCalls = calls.filter(
    ({ name }) => name === "preflightPublishSourceNormalization",
  );
  const digestCalls = calls.filter(({ name }) => name === "calculateDesenSourceDigest");
  const forbiddenDirectCalls = calls.filter(({ name }) =>
    [
      "resolvePublishCatalogs",
      "preflightPublishSourcePreservation",
      "validateDesenStructure",
      "calculateDesenBundleRevision",
    ].includes(name),
  );
  const tupleShape = objectPropertySets.some((names) =>
    EXACT_TUPLE_KEYS.every((key) => names.includes(key)),
  );
  const successShape = objectPropertySets.some((names) =>
    ["catalogsPinned", ...CARRIED_KEYS, "pinnedDocument"].every((key) => names.includes(key)),
  );
  const sourceImports = imports.sort();
  const platformNeutral = sourceImports.every(
    (specifier) => !FORBIDDEN_IMPORT_PATTERN.test(specifier),
  );
  const distributionNormalizationCalls = (
    distributionText.match(/\bpreflightPublishSourceNormalization\s*\(/gu) ?? []
  ).length;
  const distributionDigestCalls = (
    distributionText.match(/\bcalculateDesenSourceDigest\s*\(/gu) ?? []
  ).length;

  if (
    normalizationCalls.length !== 1 ||
    digestCalls.length !== 1 ||
    normalizationCalls[0].position >= digestCalls[0].position ||
    forbiddenDirectCalls.length !== 0 ||
    !tupleShape ||
    !successShape ||
    !exactSuccessAuthorityProjection ||
    locationPropertyRead ||
    !platformNeutral ||
    distributionNormalizationCalls !== 1 ||
    distributionDigestCalls !== 1
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_SOURCE_DRIFT",
      "Catalog-pinning implementation order, tuple projection, or authority boundary drifted.",
      {
        normalizationCalls: normalizationCalls.length,
        digestCalls: digestCalls.length,
        forbiddenDirectCalls: forbiddenDirectCalls.map(({ name }) => name),
        tupleShape,
        successShape,
        exactSuccessAuthorityProjection,
        locationPropertyRead,
        platformNeutral,
        distributionNormalizationCalls,
        distributionDigestCalls,
      },
    );
  }

  return Object.freeze({
    sourceImports,
    platformNeutral,
    oneT07Call: true,
    oneIndependentDigestRecheck: true,
    digestRecheckAfterT07: true,
    exactTupleProjection: true,
    exactSuccessAuthorityProjection: true,
    noLocationPropertyRead: true,
    noDirectPredecessorBypass: true,
    builtDistributionOneT07Call: true,
    builtDistributionOneDigestRecheck: true,
  });
}

function traceabilityClaims(traceabilityText) {
  const traceability = parseJson(
    traceabilityText,
    "PUBLISHER_CATALOG_PINNING_TRACEABILITY_DRIFT",
    "Protocol traceability",
  );
  const rows = [];
  for (const expected of EXPECTED_TRACE_ROWS) {
    const collection = traceability[expected.collection];
    if (!Array.isArray(collection)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_TRACEABILITY_DRIFT",
        `Traceability collection ${expected.collection} is missing.`,
      );
    }
    const matches = collection.filter((entry) => entry?.id === expected.id);
    if (
      matches.length !== 1 ||
      !Array.isArray(matches[0].owners) ||
      !matches[0].owners.includes(expected.owner)
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_TRACEABILITY_DRIFT",
        `Traceability ownership for ${expected.id} drifted.`,
      );
    }
    rows.push(expected.id);
  }
  return Object.freeze(rows);
}

function authorityIdentityClaims(result) {
  if (
    !Array.isArray(result.source.catalogs) ||
    result.sourceCatalogRequirements !== result.source.catalogs ||
    !Array.isArray(result.packages) ||
    !Array.isArray(result.catalogSet) ||
    result.packages.length !== result.catalogSet.length ||
    result.packages.some(
      (selectedPackage, index) => selectedPackage.catalog !== result.catalogSet[index],
    ) ||
    !Array.isArray(result.requirementPackageIndexes) ||
    result.requirementPackageIndexes.length !== result.sourceCatalogRequirements.length
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_AUTHORITY_DRIFT",
      "Catalog-pinning success reconstructed or detached a carried T07 authority.",
    );
  }
  return Object.freeze({
    sourceRequirementsShareAuthenticatedSourceIdentity: true,
    packageCatalogsShareCatalogSetIdentity: true,
    requirementAlignmentSharesAuthenticatedSourceCardinality: true,
  });
}

function officialClaims(pinning, source, catalog) {
  const candidate = candidateFromCatalog(catalog);
  const result = assertSuccess(
    pinning(JSON.stringify(source), [candidate]),
    "Official Source/Catalog fixture",
  );

  assertExactKeys(
    result,
    SUCCESS_KEYS,
    "PUBLISHER_CATALOG_PINNING_AUTHORITY_DRIFT",
    "Catalog-pinning success",
  );
  for (const forbidden of FORBIDDEN_SUCCESS_KEYS) {
    if (Object.hasOwn(result, forbidden)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_TERMINAL_LEAK",
        `Nonterminal Catalog pinning exposed ${forbidden}.`,
      );
    }
  }
  const expectedDigest = calculateDesenSourceDigest(result.source);
  if (
    !isSha256Digest(result.sourceDigest) ||
    result.sourceDigest !== expectedDigest ||
    result.pinnedDocument.sourceDigest !== expectedDigest
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_SOURCE_DIGEST_DRIFT",
      "Pinned Source digest does not match the exact authenticated Source.",
    );
  }
  const pinnedKeys = sortedOwnKeys(result.pinnedDocument);
  const expectedPinnedKeys = [...PINNED_REQUIRED_KEYS, "extensions"].sort();
  if (JSON.stringify(pinnedKeys) !== JSON.stringify(expectedPinnedKeys)) {
    fail("PUBLISHER_CATALOG_PINNING_DOCUMENT_DRIFT", "Pinned document root fields drifted.", {
      pinnedKeys,
    });
  }
  assertExactKeys(
    result.pinnedDocument.requires,
    ["catalogs"],
    "PUBLISHER_CATALOG_PINNING_DOCUMENT_DRIFT",
    "Pinned requires",
  );
  if (
    !Array.isArray(result.pinnedDocument.requires.catalogs) ||
    result.pinnedDocument.requires.catalogs.length !== 1
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_TUPLE_DRIFT",
      "Official pinned document does not contain one exact Catalog tuple.",
    );
  }
  const tuple = result.pinnedDocument.requires.catalogs[0];
  assertExactKeys(
    tuple,
    EXACT_TUPLE_KEYS,
    "PUBLISHER_CATALOG_PINNING_TUPLE_DRIFT",
    "Official exact tuple",
  );
  if (
    tuple.id !== catalog.id ||
    tuple.version !== catalog.version ||
    tuple.target !== catalog.target ||
    tuple.digest !== catalog.packageDigest ||
    Object.hasOwn(tuple, "location") ||
    Object.hasOwn(tuple, "packageDigest")
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_TUPLE_DRIFT",
      "Official exact Catalog tuple differs from selected package authority.",
    );
  }
  if (!isDeeplyFrozen(result)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_IMMUTABILITY_DRIFT",
      "Catalog-pinning success is not recursively immutable.",
    );
  }
  const authorityIdentity = authorityIdentityClaims(result);
  for (const key of CARRIED_KEYS) {
    if (key === "sourceDigest") continue;
    if (result[key] === undefined) {
      fail("PUBLISHER_CATALOG_PINNING_AUTHORITY_DRIFT", `Catalog-pinning success dropped ${key}.`);
    }
  }

  return Object.freeze({
    result,
    expectedDigest,
    authorityIdentity,
    tuple: Object.freeze(clone(tuple)),
    canonicalPinnedDocument: canonical(result.pinnedDocument),
  });
}

function variantClaims(pinning, source, catalog, official) {
  const candidate = candidateFromCatalog(catalog);

  const omittedTargetSource = clone(source);
  delete omittedTargetSource.catalogs[0].target;
  const omittedTarget = assertSuccess(
    pinning(JSON.stringify(omittedTargetSource), [candidate]),
    "Target-omitted Source",
  );
  const omittedTuple = omittedTarget.pinnedDocument.requires.catalogs[0];
  if (
    omittedTuple.target !== catalog.target ||
    canonical(omittedTuple) !== canonical(official.tuple) ||
    omittedTarget.sourceDigest === official.expectedDigest
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_TARGET_DRIFT",
      "Omitted target was not filled only from the exact selected package.",
    );
  }

  const locationA = clone(source);
  const locationB = clone(source);
  locationA.catalogs[0].location = "https://registry-a.invalid/catalog";
  locationB.catalogs[0].location = "file:///private/catalog";
  const locationResultA = assertSuccess(
    pinning(JSON.stringify(locationA), [candidate]),
    "Location variant A",
  );
  const locationResultB = assertSuccess(
    pinning(JSON.stringify(locationB), [candidate]),
    "Location variant B",
  );
  if (
    canonical(locationResultA.pinnedDocument.requires) !==
      canonical(locationResultB.pinnedDocument.requires) ||
    locationResultA.sourceDigest === locationResultB.sourceDigest ||
    locationResultA.pinnedDocument.requires.catalogs.some((entry) =>
      Object.hasOwn(entry, "location"),
    )
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_LOCATION_DRIFT",
      "Discovery location gained exact tuple authority or left Source digest semantics.",
    );
  }

  const extensionSource = clone(source);
  extensionSource.catalogs[0].extensions = {
    "dev.desen.proof": {
      authoring: { location: "opaque", digest: "opaque" },
      order: [3, 1, 2],
      constructor: "data",
      prototype: "data",
    },
  };
  const extensionResult = assertSuccess(
    pinning(JSON.stringify(extensionSource), [candidate]),
    "Opaque requirement-extension Source",
  );
  const extensionTuple = extensionResult.pinnedDocument.requires.catalogs[0];
  if (
    extensionTuple.extensions !== extensionResult.sourceCatalogRequirements[0].extensions ||
    canonical(extensionTuple.extensions) !== canonical(extensionSource.catalogs[0].extensions)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_EXTENSION_DRIFT",
      "Requirement extensions were not preserved as exact opaque authority.",
    );
  }

  const secondCatalog = clone(catalog);
  secondCatalog.id = "com.example.aux-catalog";
  secondCatalog.version = "2.0.0";
  secondCatalog.packageDigest = `sha256:${"b".repeat(64)}`;
  secondCatalog.components = {};
  secondCatalog.behaviors = {};
  secondCatalog.operations = {};
  secondCatalog.resources = {};
  delete secondCatalog.authoring;
  const orderedSource = clone(source);
  orderedSource.catalogs = [
    { ...clone(source.catalogs[0]), extensions: { marker: "a-first" } },
    {
      id: secondCatalog.id,
      version: secondCatalog.version,
      target: secondCatalog.target,
      extensions: { marker: "b" },
    },
    { ...clone(source.catalogs[0]), extensions: { marker: "a-last" } },
  ];
  const candidates = [candidateFromCatalog(secondCatalog), candidate];
  const orderedResult = assertSuccess(
    pinning(JSON.stringify(orderedSource), candidates),
    "A/B/A positional Source",
  );
  const orderedTuples = orderedResult.pinnedDocument.requires.catalogs;
  if (
    JSON.stringify(orderedResult.requirementPackageIndexes) !== JSON.stringify([0, 1, 0]) ||
    orderedTuples.length !== 3 ||
    orderedTuples[0].id !== catalog.id ||
    orderedTuples[1].id !== secondCatalog.id ||
    orderedTuples[2].id !== catalog.id ||
    orderedTuples[0].extensions.marker !== "a-first" ||
    orderedTuples[2].extensions.marker !== "a-last"
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_POSITION_DRIFT",
      "Catalog requirements were sorted, deduplicated, or mapped without positional indexes.",
    );
  }
  const reverseCandidates = assertSuccess(
    pinning(JSON.stringify(orderedSource), [...candidates].reverse()),
    "Reversed candidate allocation",
  );
  if (canonical(reverseCandidates.pinnedDocument) !== canonical(orderedResult.pinnedDocument)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_POSITION_DRIFT",
      "Candidate allocation order changed exact pinned output.",
    );
  }

  const patchedCatalog = clone(catalog);
  patchedCatalog.packageDigest = `sha256:${"c".repeat(64)}`;
  const patched = assertSuccess(
    pinning(JSON.stringify(source), [candidateFromCatalog(patchedCatalog)]),
    "Explicit package digest adoption",
  );
  if (
    patched.sourceDigest !== official.expectedDigest ||
    patched.pinnedDocument.requires.catalogs[0].digest !== patchedCatalog.packageDigest ||
    canonical(patched.pinnedDocument) === official.canonicalPinnedDocument
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_PACKAGE_DIGEST_DRIFT",
      "A package digest change was not adopted explicitly in the exact tuple.",
    );
  }

  const authoringA = clone(source);
  const authoringB = clone(source);
  authoringA.authoring = { editor: "alpha" };
  authoringB.authoring = { editor: "beta", selection: [1, 2] };
  const authoringResultA = assertSuccess(
    pinning(JSON.stringify(authoringA), [candidate]),
    "Authoring variant A",
  );
  const authoringResultB = assertSuccess(
    pinning(JSON.stringify(authoringB), [candidate]),
    "Authoring variant B",
  );
  if (
    authoringResultA.sourceDigest !== authoringResultB.sourceDigest ||
    canonical(authoringResultA.pinnedDocument) !== canonical(authoringResultB.pinnedDocument)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_AUTHORING_DRIFT",
      "Root authoring changed the carried digest or pinned document.",
    );
  }

  const invalid = pinning("{", [candidate]);
  assertFailure(invalid, "json-parse", "Inherited invalid JSON");

  return Object.freeze({
    omittedTargetFilledFromSelectedPackage: true,
    omittedTargetDigestRemainsSourceSpecific: true,
    locationExcludedFromTupleButIncludedInSourceDigest: true,
    opaqueRequirementExtensionsPreserved: true,
    positionalIndexes: Object.freeze([0, 1, 0]),
    duplicatePositionsPreserved: true,
    candidateOrderIndependent: true,
    packageDigestChangeRequiresExplicitTupleAdoption: true,
    rootAuthoringIndependent: true,
    inheritedFailurePartialFree: true,
  });
}

export async function buildPublisherCatalogPinningEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const frozenArtifact = await authenticatedFrozenArtifactProjection();
  const pinning = options.pinning ?? preflightPublishCatalogPinning;
  if (typeof pinning !== "function") {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Injected Catalog-pinning implementation must be callable.",
    );
  }

  const [
    sourceText,
    catalogText,
    traceabilityText,
    sourceImplementation,
    distributionImplementation,
    runtimeTestText,
    typeTestText,
    publisherPackageJsonText,
    publicDeclaration,
    prerequisites,
  ] = await Promise.all([
    options.sourceText ?? defaultText(FIXTURES.source),
    options.catalogText ?? defaultText(FIXTURES.catalog),
    options.traceabilityText ?? defaultText(TRACEABILITY),
    trackedBytes(options, SOURCE).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, DISTRIBUTION).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, RUNTIME_TEST).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, TYPE_TEST).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, PUBLISHER_PACKAGE).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, PUBLIC_DECLARATION).then((bytes) => bytes.toString("utf8")),
    prerequisiteClaims(options),
  ]);

  const source = parseJson(
    sourceText,
    "PUBLISHER_CATALOG_PINNING_FIXTURE_DRIFT",
    "Official Source fixture",
  );
  const catalog = parseJson(
    catalogText,
    "PUBLISHER_CATALOG_PINNING_FIXTURE_DRIFT",
    "Official Catalog fixture",
  );
  const official = officialClaims(pinning, source, catalog);
  const variants = variantClaims(pinning, source, catalog, official);
  const implementation = implementationAudit(sourceImplementation, distributionImplementation);
  assertPrivateCatalogPinningBoundary(publicDeclaration, publisherPackageJsonText);
  const traceRows = traceabilityClaims(traceabilityText);
  const runtimeNames = countNamedTests(runtimeTestText);
  const compilerNegativeCases = countCompilerNegativeCases(typeTestText);
  if (
    runtimeNames.length < 12 ||
    new Set(runtimeNames).size !== runtimeNames.length ||
    compilerNegativeCases < 12
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_TEST_INVENTORY_DRIFT",
      "Catalog-pinning executable or compiler-negative inventory is incomplete.",
      {
        runtimeCases: runtimeNames.length,
        compilerNegativeCases,
      },
    );
  }

  const trackedFiles = frozenArtifact.trackedFiles;

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.catalog-pinning-proof.v1",
    task: "M06-T08",
    result: "PASS",
    summary:
      "The Publisher independently authenticates the exact pre-normalization Source digest and positionally replaces loose Catalog hints with immutable exact package tuples without emitting a terminal Bundle.",
    prerequisites,
    claims: Object.freeze({
      exactT07AuthorityCarry: CARRIED_KEYS,
      sourceDigestReauthenticatedFromExactSource: true,
      sourceDigestNeverSilentlyReplaced: true,
      authorityIdentity: official.authorityIdentity,
      exactPackageTuple: official.tuple,
      canonicalPinnedDocumentSha256: sha256(Buffer.from(official.canonicalPinnedDocument, "utf8")),
      variants,
      completeSuccessDeeplyFrozen: true,
      terminalFieldsAbsent: FORBIDDEN_SUCCESS_KEYS,
      implementation,
      registrations: frozenArtifact.registrations,
      historicalCompatibilityReaderAnchored: CATALOG_RESOLUTION_PROOF_READER,
      traceabilityOwnership: Object.freeze({
        rows: traceRows,
        normativeClause: "N-016",
      }),
    }),
    nonclaims: Object.freeze([
      "No Bundle revision, terminal Bundle validation, signing, publication metadata, runtime, host, adapter, activation, or deployment authority is produced.",
      "Source discovery location remains authenticated Source data but never becomes an exact package tuple field or selection authority.",
      "Package bytes are authenticated by the target-specific observation supplied to M06-T02, not by this data-only projection.",
    ]),
    tests: frozenArtifact.tests,
    trackedFiles: Object.freeze(trackedFiles),
    reproduction: Object.freeze([
      "pnpm verify:publisher-source-normalization",
      "pnpm --filter @desen/publisher build",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:catalog-pinning",
      "node scripts/generate-publisher-catalog-pinning-proof.mjs",
      "node scripts/verify-publisher-catalog-pinning.mjs",
      "node --test tests/publisher-catalog-pinning.test.mjs",
    ]),
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
  });
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  const pathCount = proofDocument.split(`\`${ARTIFACT}\``).length - 1;
  const hashCount = proofDocument.split(`\`sha256:${artifactSha256}\``).length - 1;
  if (pathCount !== 1 || hashCount !== 1 || /\bPENDING\b/u.test(proofDocument)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_PROOF_DOCUMENT_DRIFT",
      "Catalog-pinning proof document does not contain one exact artifact path and SHA-256 pin.",
      { pathCount, hashCount },
    );
  }
}

export async function verifyPublisherCatalogPinningEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const built = await buildPublisherCatalogPinningEvidence(options);
  if (options.artifactBytes !== undefined && options.artifactPath !== undefined) {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning verification accepts artifact bytes or an artifact path, never both.",
    );
  }
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_CATALOG_PINNING_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning verification artifact path must be text.",
    );
  }
  const artifactBytes =
    options.artifactBytes ??
    (await readRegularAbsoluteBytes(
      path.resolve(artifactPath),
      "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
      "Tracked Catalog-pinning artifact",
      Object.freeze({ artifactPath: path.resolve(artifactPath) }),
    ));
  if (!(artifactBytes instanceof Uint8Array) || !byteEqual(artifactBytes, built.artifactBytes)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_ARTIFACT_DRIFT",
      "Tracked Catalog-pinning evidence differs from a fresh production build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256:
          artifactBytes instanceof Uint8Array ? sha256(artifactBytes) : "not-byte-input",
      },
    );
  }
  if (options.proofDocument !== undefined && options.proofDocumentPath !== undefined) {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning verification accepts proof text or a proof-document path, never both.",
    );
  }
  const proofDocumentPath = options.proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT);
  if (typeof proofDocumentPath !== "string") {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning verification proof-document path must be text.",
    );
  }
  const proofDocument =
    options.proofDocument ??
    (
      await readRegularAbsoluteBytes(
        path.resolve(proofDocumentPath),
        "PUBLISHER_CATALOG_PINNING_PROOF_DOCUMENT_DRIFT",
        "Catalog-pinning proof document",
        Object.freeze({ proofDocumentPath: path.resolve(proofDocumentPath) }),
      )
    ).toString("utf8");
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning proof document override must be text.",
    );
  }
  assertProofDocumentPin(proofDocument, built.artifactSha256);
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.trackedFiles.length,
    traceRows: built.artifact.claims.traceabilityOwnership.rows.length,
    proofDocumentPinned: true,
  });
}

export async function writePublisherCatalogPinningEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const semanticOverrideKeys = Reflect.ownKeys(options).filter(
    (key) => !["artifactPath", "beforeAtomicRename"].includes(key),
  );
  if (semanticOverrideKeys.length > 0) {
    fail(
      "PUBLISHER_CATALOG_PINNING_OFFICIAL_WRITE_OVERRIDE",
      "Official Catalog-pinning evidence may only use tracked production inputs.",
      { semanticOverrideKeys },
    );
  }
  const built = await buildPublisherCatalogPinningEvidence();
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_CATALOG_PINNING_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning artifact destination must be a path string.",
    );
  }
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_OPTIONS_INVALID",
      "Catalog-pinning atomic hook must be callable.",
    );
  }
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
  });
}
