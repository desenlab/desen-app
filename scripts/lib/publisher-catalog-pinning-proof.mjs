import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { constants as fileConstants } from "node:fs";
import { chmod, lstat, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import {
  calculateDesenSourceDigest,
  canonicalizeJson,
  isSha256Digest,
} from "../../packages/protocol/dist/index.js";
import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import { preflightPublishCatalogPinning } from "../../packages/publisher/dist/catalog-pinning.js";
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

const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 52_201,
    sha256: "46852fb9bc0f4f7a636e3d9b4bc7d26d280416432a0d24d48c44cfb9d081d06a",
  }),
  [PUBLIC_DECLARATION]: Object.freeze({
    bytes: 902,
    sha256: "8286119f1873ad9fcef182b91af323be6cc1cf46f2e33475c140953d7ca67954",
  }),
  [PUBLISHER_PACKAGE]: Object.freeze({
    bytes: 1_375,
    sha256: "7bc7e90e6c435323ca987d1648e100d773b3067ec09ee16a7e148cbee6fa25c7",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 45_050,
    sha256: "e025a54e4eb7d3d7bed45e0ccbab86c9005221e95e8e2332eda1ee5c7b112360",
  }),
  [CI_CONTRACT_TEST]: Object.freeze({
    bytes: 24_068,
    sha256: "b4cc04a78d642da4a42d64657ed04343056d39d47c026a24b9054290bf32f0cf",
  }),
  [CATALOG_RESOLUTION_PROOF_READER]: Object.freeze({
    bytes: 31_808,
    sha256: "4a764e7208aee4aa63471183781930776a11319b22afecef8b9ac783a4c6a0df",
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    bytes: 84_023,
    sha256: "5d0434d3455dbd182f8b1a9a0ac4e8b47920cb67d214f23ff2157585c12c5f7c",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 26_182,
    sha256: "246edeaf99e8af88395a8bd12742bffbd12415914976d5baeb5f90cda9dbc287",
  }),
});

// M06-T08 evidence remains byte-for-byte historical while later root-suite additions are
// accepted only through this exact, reviewed successor receipt. The bridge must be removed
// with the I07-04 historical-reader retirement rather than widened to accept arbitrary roots.
const APPROVED_M07_T11_ROOT_TEST_SUCCESSOR_RECEIPT = Object.freeze({
  bytes: 39_954,
  sha256: "e442dc376f4787d35941f2676e78f34a859d7eee9a0374449260dd35328b5502",
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
const execFileAsync = promisify(execFile);
const HISTORICAL_CI_PROFILE = Object.freeze({
  planSha256: "2addb6556f4e24c921b090102a80eee58f0fa3850b844b5f50197e50b759bbd0",
  stepCount: 122,
});
const SUCCESSOR_CI_PROFILE = Object.freeze({
  planSha256: "3c927667b5b932a523f3bbe347cc554cd16b94e08fe493f5afe1b76361311f0c",
  stepCount: 124,
});
const OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE = Object.freeze({
  planSha256: "ce00f625601b84a74a0b96d061f9ca25a2aa283d45aae4e8991051de70247582",
  stepCount: 126,
});
const INVALID_SOURCE_MATRIX_SUCCESSOR_CI_PROFILE = Object.freeze({
  planSha256: "9523b667ef872826ab706357d7e9c39b4a4ecbd9806b621893577eb972feb2ea",
  stepCount: 128,
});
const CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE = Object.freeze({
  prefixSha256: "28dce22a08998f1a4bb199094ba081afccf074ab21aafecd10182d1c73d97d0e",
  proofEntries: 61,
  planSha256: "448102bdfc5e0ed331f09038a2c554dcb930300ec560d35ac94469fc89d5897f",
  stepCount: 130,
  t11Index: 59,
  m07T01Index: 60,
});
const REQUIRED_T11_SUCCESSOR_ROOT_TEST_NAMES = Object.freeze([
  "rejects removal of the exact T11 CI successor",
  "rejects reordering the exact T10 to T11 CI edge",
  "rejects drift in the exact T11 CI tuple",
  "rejects exact T11 root registration drift",
  "rejects exact T11 package registration drift",
  "rejects removal of the aggregate T11 successor",
  "rejects a non-immediate aggregate T10 to T11 edge",
]);
const REQUIRED_M07_T01_SUCCESSOR_ROOT_TEST_NAMES = Object.freeze([
  "rejects removal of the exact M07-T01 CI successor",
  "rejects reordering the exact T11 to M07-T01 CI edge",
  "rejects drift in the exact M07-T01 CI tuple",
  "rejects exact M07-T01 root registration drift",
  "rejects removal of the aggregate M07-T01 successor",
  "rejects a non-immediate aggregate T11 to M07-T01 edge",
]);
const HISTORICAL_TEST_CLAIMS = Object.freeze({
  publisherRuntimeCases: 13,
  compilerNegativeCases: 52,
  rootMutationCases: 37,
  reviewedSha256: Object.freeze({
    runtime: "c7171da4ca48e70ee88e3db9321dc95f4b629cfbf2c5cef573e1481251a888a9",
    types: "a4eb13e5a0a75d915b9c760537ed3f0e95bd020c5c360b5369af2ae74e79cbd8",
    root: "246edeaf99e8af88395a8bd12742bffbd12415914976d5baeb5f90cda9dbc287",
  }),
});
const HISTORICAL_CI_CLAIMS = Object.freeze({
  builtinOnlyImportBoundary: true,
  sourceTupleExact: true,
  directUnconditionalPlanValidation: true,
  mainUsesNonOverridableDefaultPlan: true,
  candidateSourceSha256: "e025a54e4eb7d3d7bed45e0ccbab86c9005221e95e8e2332eda1ee5c7b112360",
  authenticatedOnDiskSourceExecutedInIsolatedReadOnlyProcess: true,
  exportedInventoryMatchesCandidateSource: true,
  independentlyPinnedPlanSha256: "2addb6556f4e24c921b090102a80eee58f0fa3850b844b5f50197e50b759bbd0",
  executablePlanValidated: true,
  verifierAndRootTestExactOnce: true,
  processLocalReauthenticatedCliObservationCache: true,
  realCliEntrypointExecuted: true,
  realCliExactPinnedCommands: 122,
  realCliTerminalReceiptValidated: true,
  realCliUsesNoOpExecutableWrappers: true,
});
const EXPECTED_CI_IMPORTS = Object.freeze([
  "node:child_process",
  "node:crypto",
  "node:fs/promises",
  "node:path",
  "node:url",
]);
const CI_AUTHORITY_BINDINGS = new Set([
  "PROOF_ENTRIES",
  "QUALITY_GATE_PLAN_SHA256",
  "assertSafeStep",
  "assertTrackedWorkspaceUnchanged",
  "commandStep",
  "createQualityGateSteps",
  "executeDefaultQualityGate",
  "executeQualityGate",
  "main",
  "readInventory",
  "runCommandStep",
  "runStepSequence",
  "snapshotTrackedWorkspace",
  "validateProofInventory",
  "validateQualityGatePlan",
]);
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

function authenticateM07T11RootTestSuccessor(bytes) {
  const actualBytes = bytes.byteLength;
  const actualSha256 = sha256(bytes);
  if (
    actualBytes !== APPROVED_M07_T11_ROOT_TEST_SUCCESSOR_RECEIPT.bytes ||
    actualSha256 !== APPROVED_M07_T11_ROOT_TEST_SUCCESSOR_RECEIPT.sha256
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_COMPATIBILITY_DRIFT",
      "The current Catalog-pinning root suite differs from its exact reviewed successor.",
      {
        relativePath: ROOT_TEST,
        expectedBytes: APPROVED_M07_T11_ROOT_TEST_SUCCESSOR_RECEIPT.bytes,
        expectedSha256: APPROVED_M07_T11_ROOT_TEST_SUCCESSOR_RECEIPT.sha256,
        actualBytes,
        actualSha256,
      },
    );
  }
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

function isExactPlainRecord(value, expectedKeys) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== OBJECT_PROTOTYPE
  ) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => keys.includes(key)) &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key === "string" &&
        descriptor !== undefined &&
        descriptor.enumerable &&
        "value" in descriptor
      );
    })
  );
}

function assertImmediateSingleRootScriptEdge(script, predecessor, current, label) {
  if (typeof script !== "string") {
    fail("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT", `${label} root script is missing.`);
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
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      `${label} must execute Catalog pinning exactly once immediately after Source normalization.`,
      { predecessorIndexes, currentIndexes },
    );
  }
}

const CI_PLAN_PROBE_PREFIX = "DESEN_CANDIDATE_CI_PLAN:";
const CI_PLAN_PROBE_SOURCE = [
  "const candidate = await import(process.argv[2]);",
  "const steps = candidate.createQualityGateSteps();",
  "const validation = candidate.validateQualityGatePlan(steps);",
  "const payload = JSON.stringify({ entries: candidate.PROOF_ENTRIES, steps, validation });",
  `process.stdout.write(${JSON.stringify(CI_PLAN_PROBE_PREFIX)} + Buffer.from(payload, "utf8").toString("base64"));`,
].join("\n");

async function executeCandidateCiPlan(ciSourceBytes) {
  const candidatePath = path.join(ROOT, CI_SOURCE);
  const onDiskBefore = await readRegularAbsoluteBytes(
    candidatePath,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI execution source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  if (!byteEqual(ciSourceBytes, onDiskBefore)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Candidate CI bytes must equal the authenticated regular on-disk runner before execution.",
      {
        candidateSha256: sha256(ciSourceBytes),
        onDiskSha256: sha256(onDiskBefore),
      },
    );
  }
  const canonicalCandidatePath = await realpath(candidatePath);
  if (canonicalCandidatePath !== candidatePath) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI execution source must not resolve through a path alias.",
      { relativePath: CI_SOURCE },
    );
  }

  const candidateUrl = pathToFileURL(canonicalCandidatePath);
  candidateUrl.searchParams.set("desen-proof-sha256", sha256(onDiskBefore));
  let stdout;
  let executionError;
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      [
        "--max-old-space-size=128",
        "--permission",
        `--allow-fs-read=${canonicalCandidatePath}`,
        "--input-type=module",
        "--eval",
        CI_PLAN_PROBE_SOURCE,
        "desen-ci-plan-probe",
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
    executionError = error;
  }

  const onDiskAfter = await readRegularAbsoluteBytes(
    candidatePath,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI execution source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  if (!byteEqual(onDiskBefore, onDiskAfter) || !byteEqual(ciSourceBytes, onDiskAfter)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Authenticated single-pass CI bytes changed while the executable plan was observed.",
      {
        beforeSha256: sha256(onDiskBefore),
        afterSha256: sha256(onDiskAfter),
      },
    );
  }
  if (executionError !== undefined) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The authenticated on-disk CI source could not derive and validate its executable plan.",
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
  if (typeof stdout !== "string" || !stdout.startsWith(CI_PLAN_PROBE_PREFIX)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The authenticated on-disk CI source did not return one isolated executable plan.",
    );
  }
  const encoded = stdout.slice(CI_PLAN_PROBE_PREFIX.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The authenticated on-disk CI source returned a malformed executable-plan receipt.",
    );
  }
  return parseJson(
    Buffer.from(encoded, "base64").toString("utf8"),
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Authenticated on-disk CI executable-plan receipt",
  );
}

async function executeDetachedCandidateCiPlan(ciSourceBytes) {
  const generatedDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-publisher-ci-candidate-"));
  const candidatePath = path.join(generatedDirectory, "run-ci-quality-gate.mjs");
  try {
    await writeFile(candidatePath, ciSourceBytes, { flag: "wx", mode: 0o600 });
    const canonicalCandidatePath = await realpath(candidatePath);
    const authenticatedBytes = await readRegularAbsoluteBytes(
      canonicalCandidatePath,
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Detached single-pass CI candidate",
    );
    if (!byteEqual(ciSourceBytes, authenticatedBytes)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Detached single-pass CI candidate bytes changed before executable observation.",
      );
    }

    const candidateUrl = pathToFileURL(canonicalCandidatePath);
    candidateUrl.searchParams.set("desen-proof-sha256", sha256(authenticatedBytes));
    let stdout;
    try {
      ({ stdout } = await execFileAsync(
        process.execPath,
        [
          "--max-old-space-size=128",
          "--permission",
          `--allow-fs-read=${canonicalCandidatePath}`,
          "--input-type=module",
          "--eval",
          CI_PLAN_PROBE_SOURCE,
          "desen-ci-plan-probe",
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
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
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
      canonicalCandidatePath,
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Detached single-pass CI candidate",
    );
    if (!byteEqual(authenticatedBytes, afterBytes)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Detached single-pass CI candidate bytes changed during executable observation.",
      );
    }
    if (typeof stdout !== "string" || !stdout.startsWith(CI_PLAN_PROBE_PREFIX)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "The detached CI candidate did not return one isolated executable plan.",
      );
    }
    const encoded = stdout.slice(CI_PLAN_PROBE_PREFIX.length);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "The detached CI candidate returned a malformed executable-plan receipt.",
      );
    }
    return parseJson(
      Buffer.from(encoded, "base64").toString("utf8"),
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Detached CI candidate executable-plan receipt",
    );
  } finally {
    await rm(generatedDirectory, { recursive: true, force: true });
  }
}

function collectAssignedIdentifierNames(node, names = []) {
  if (ts.isIdentifier(node)) {
    names.push(node.text);
    return names;
  }
  if (ts.isParenthesizedExpression(node)) {
    return collectAssignedIdentifierNames(node.expression, names);
  }
  if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind)) {
    return collectAssignedIdentifierNames(node.left, names);
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (ts.isOmittedExpression(element)) continue;
      collectAssignedIdentifierNames(
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
        collectAssignedIdentifierNames(property.initializer, names);
      } else if (ts.isSpreadAssignment(property)) {
        collectAssignedIdentifierNames(property.expression, names);
      }
    }
  }
  return names;
}

function assertNoCandidateAuthorityRebinding(sourceFile) {
  const writes = [];
  let directEvalCalls = 0;

  function recordTarget(target, kind) {
    for (const name of collectAssignedIdentifierNames(target)) {
      if (CI_AUTHORITY_BINDINGS.has(name)) {
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
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI must not reassign an authoritative execution binding or use direct eval.",
      { writes, directEvalCalls },
    );
  }
}

function assertMainHasNoReturnBypass(mainFunction) {
  const returns = [];
  function visit(node) {
    if (node !== mainFunction && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) {
      returns.push(node.getStart());
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(mainFunction);
  if (returns.length > 0) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "CI main must not contain an early-return path before or around default-plan execution.",
      { returns },
    );
  }
}

function assertDirectCandidatePlanValidation(createStepsFunction) {
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
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Candidate CI plan construction must validate its exact steps unconditionally before returning them.",
    );
  }
}

function assertDefaultGateBinding(defaultGateFunction, mainFunction) {
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
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
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
  function visitMain(node) {
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
    forbiddenPlanReferences !== 0
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "CI main must assign its receipt through one direct awaited non-overridable default-plan call.",
      {
        tryStatements: tryStatements?.length ?? 0,
        directReceiptAssignments: directReceiptAssignments.length,
        defaultReferences,
        forbiddenExecutionReferences,
        forbiddenPlanReferences,
      },
    );
  }
}

function executableCandidatePlanClaims(candidate, sourceEntries, ciSourceBytes, ciProfile) {
  if (
    !isExactPlainRecord(candidate, ["entries", "steps", "validation"]) ||
    !Array.isArray(candidate.entries) ||
    !Array.isArray(candidate.steps) ||
    !isExactPlainRecord(candidate.validation, ["planSha256", "stepCount"])
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact candidate CI executable-plan receipt has an unexpected shape.",
    );
  }
  if (JSON.stringify(candidate.entries) !== JSON.stringify(sourceEntries)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Candidate CI source tuples differ from the inventory exported by those exact bytes.",
    );
  }

  const stepsAreExact = candidate.steps.every(
    (step) =>
      isExactPlainRecord(step, ["args", "command", "id", "label"]) &&
      typeof step.id === "string" &&
      typeof step.label === "string" &&
      typeof step.command === "string" &&
      Array.isArray(step.args) &&
      step.args.every((argument) => typeof argument === "string"),
  );
  if (!stepsAreExact) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact candidate CI source produced a malformed executable step.",
    );
  }

  const actualVerifierSteps = candidate.steps
    .filter(({ id }) => id.startsWith("verify-"))
    .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`);
  const expectedVerifierSteps = sourceEntries.map(
    ({ id, verifierFile }) => `verify-${id}\0node\0${verifierFile}`,
  );
  const actualRootTestSteps = candidate.steps
    .filter(({ id }) => id.startsWith("test-"))
    .map(({ id, command, args }) => `${id}\0${command}\0${args.join("\0")}`);
  const expectedRootTestSteps = sourceEntries.map(
    ({ id, rootTestFile }) => `test-${id}\0node\0--test\0--test-concurrency=1\0${rootTestFile}`,
  );
  if (
    JSON.stringify(actualVerifierSteps) !== JSON.stringify(expectedVerifierSteps) ||
    JSON.stringify(actualRootTestSteps) !== JSON.stringify(expectedRootTestSteps)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact candidate CI source does not execute every exported proof verifier and root test exactly once.",
    );
  }

  const normalizedPlan = candidate.steps.map(({ id, command, args }) => ({
    id,
    command,
    args,
  }));
  const independentlyCalculatedPlanSha256 = sha256(
    Buffer.from(JSON.stringify(normalizedPlan), "utf8"),
  );
  if (
    candidate.steps.length !== ciProfile.stepCount ||
    candidate.validation.stepCount !== candidate.steps.length ||
    candidate.validation.planSha256 !== independentlyCalculatedPlanSha256 ||
    independentlyCalculatedPlanSha256 !== ciProfile.planSha256
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Candidate CI validation receipt does not commit the exact executable plan.",
    );
  }

  for (const prefix of ["verify", "test"]) {
    const ids = candidate.steps.filter(({ id }) => id.startsWith(`${prefix}-`)).map(({ id }) => id);
    const predecessor = `${prefix}-publisher-source-normalization`;
    const current = `${prefix}-publisher-catalog-pinning`;
    const predecessorIndexes = ids.flatMap((id, index) => (id === predecessor ? [index] : []));
    const currentIndexes = ids.flatMap((id, index) => (id === current ? [index] : []));
    if (
      predecessorIndexes.length !== 1 ||
      currentIndexes.length !== 1 ||
      currentIndexes[0] !== predecessorIndexes[0] + 1
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Exact candidate CI execution no longer covers Catalog pinning once after Source normalization.",
        { prefix, predecessorIndexes, currentIndexes },
      );
    }
  }

  return Object.freeze({
    candidateSourceSha256: sha256(ciSourceBytes),
    authenticatedOnDiskSourceExecutedInIsolatedReadOnlyProcess: true,
    exportedInventoryMatchesCandidateSource: true,
    independentlyPinnedPlanSha256: ciProfile.planSha256,
    executablePlanValidated: true,
    verifierAndRootTestExactOnce: true,
  });
}

function createCiEntrypointWrapper(command, logPath, nodePath) {
  return [
    // Node 24 keeps the parent permission model active for spawned Node interpreters. Grant this
    // no-op wrapper write access only to its append-only observation log.
    `#!${nodePath} --allow-fs-write=${logPath}`,
    '"use strict";',
    'const fs = require("node:fs");',
    `const logPath = ${JSON.stringify(logPath)};`,
    `const command = ${JSON.stringify(command)};`,
    'const bytes = Buffer.from(`${JSON.stringify({ command, args: process.argv.slice(2) })}\\n`, "utf8");',
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
    "",
  ].join("\n");
}

function parseCiEntrypointReceipt(stdout, expectedSteps, expectedProofCount) {
  const receiptStart = stdout.lastIndexOf('\n{\n  "status":');
  if (receiptStart < 0) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The real CI CLI entrypoint did not print its terminal receipt.",
    );
  }
  const receipt = parseJson(
    stdout.slice(receiptStart + 1),
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Real CI CLI entrypoint receipt",
  );
  const expectedSectionIds = ["frozen-inventory", ...expectedSteps.map(({ id }) => id)];
  const actualSectionIds = Array.isArray(receipt.sections)
    ? receipt.sections.map((section) =>
        isExactPlainRecord(section, ["duration", "id", "status"]) && section.status === "PASS"
          ? section.id
          : undefined,
      )
    : [];
  if (
    !isExactPlainRecord(receipt, [
      "duration",
      "proofs",
      "revision",
      "sections",
      "status",
      "trackedFiles",
    ]) ||
    receipt.status !== "PASS" ||
    receipt.proofs !== expectedProofCount ||
    !Number.isSafeInteger(receipt.trackedFiles) ||
    receipt.trackedFiles < 1 ||
    JSON.stringify(actualSectionIds) !== JSON.stringify(expectedSectionIds)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The real CI CLI entrypoint did not complete the exact frozen plan.",
      {
        status: receipt?.status,
        proofCount: receipt?.proofs,
        sectionIds: actualSectionIds,
      },
    );
  }
}

async function executeCandidateCiEntrypointUncached(
  ciSourceBytes,
  expectedSteps,
  expectedProofCount,
) {
  if (process.platform === "win32") {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact CI CLI entrypoint probe requires POSIX executable wrappers.",
    );
  }
  const inheritedPath = process.env.PATH;
  if (typeof inheritedPath !== "string" || inheritedPath.length === 0) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact CI CLI entrypoint probe requires the reviewed host executable path.",
    );
  }
  const nodePath = await realpath(process.execPath);
  if (/\s/u.test(nodePath)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact CI CLI entrypoint probe requires one whitespace-free absolute Node executable path.",
      { nodePath },
    );
  }

  const candidatePath = path.join(ROOT, CI_SOURCE);
  const onDiskBefore = await readRegularAbsoluteBytes(
    candidatePath,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI CLI entrypoint source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  if (!byteEqual(ciSourceBytes, onDiskBefore)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Real CI CLI entrypoint bytes must equal the authenticated regular on-disk runner.",
      {
        candidateSha256: sha256(ciSourceBytes),
        onDiskSha256: sha256(onDiskBefore),
      },
    );
  }
  const canonicalCandidatePath = await realpath(candidatePath);
  if (canonicalCandidatePath !== candidatePath) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Real CI CLI entrypoint source must not resolve through a path alias.",
      { relativePath: CI_SOURCE },
    );
  }

  const generatedTemporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "desen-publisher-ci-entrypoint-"),
  );
  const temporaryDirectory = await realpath(generatedTemporaryDirectory);
  if (temporaryDirectory === ROOT || temporaryDirectory.startsWith(`${ROOT}${path.sep}`)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact CI CLI entrypoint probe directory must remain outside the workspace.",
    );
  }
  const logPath = path.join(temporaryDirectory, "commands.log");
  if (/\s/u.test(logPath)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The exact CI CLI entrypoint probe requires one whitespace-free observation-log path.",
      { logPath },
    );
  }
  let stdout;
  let stderr;
  let executionError;
  let logBytes;
  const wrapperBytesByPath = new Map();
  try {
    await writeFile(logPath, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
    for (const command of ["node", "pnpm"]) {
      const wrapperPath = path.join(temporaryDirectory, command);
      const wrapperBytes = Buffer.from(
        createCiEntrypointWrapper(command, logPath, nodePath),
        "utf8",
      );
      await writeFile(wrapperPath, wrapperBytes, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o700,
      });
      await chmod(wrapperPath, 0o700);
      const wrapperStats = await lstat(wrapperPath);
      if (
        !wrapperStats.isFile() ||
        wrapperStats.isSymbolicLink() ||
        (wrapperStats.mode & 0o111) === 0
      ) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The exact CI CLI entrypoint probe wrapper is not one executable regular file.",
          { command },
        );
      }
      if (wrapperStats.nlink !== 1) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The exact CI CLI entrypoint probe wrapper must not be hard-linked.",
          { command, links: wrapperStats.nlink },
        );
      }
      const authenticatedWrapper = await readRegularAbsoluteBytes(
        wrapperPath,
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Real CI CLI entrypoint executable wrapper",
      );
      if (!byteEqual(wrapperBytes, authenticatedWrapper)) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The exact CI CLI entrypoint probe wrapper bytes drifted before execution.",
          { command },
        );
      }
      wrapperBytesByPath.set(wrapperPath, wrapperBytes);
    }

    try {
      const childEnvironment = {
        ...process.env,
        GITHUB_ACTIONS: "false",
        NODE_NO_WARNINGS: "1",
        NODE_OPTIONS: "",
        NO_COLOR: "1",
        PATH: `${temporaryDirectory}${path.delimiter}${inheritedPath}`,
      };
      delete childEnvironment.GITHUB_STEP_SUMMARY;
      delete childEnvironment.NODE_PATH;
      ({ stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          "--max-old-space-size=128",
          "--no-warnings",
          "--permission",
          `--allow-fs-read=${ROOT}`,
          `--allow-fs-read=${temporaryDirectory}`,
          "--allow-child-process",
          canonicalCandidatePath,
        ],
        {
          cwd: ROOT,
          detached: false,
          encoding: "utf8",
          env: childEnvironment,
          killSignal: "SIGKILL",
          maxBuffer: 2_097_152,
          timeout: 30_000,
        },
      ));
    } catch (error) {
      executionError = error;
    }
    for (const [wrapperPath, expectedBytes] of wrapperBytesByPath) {
      const afterBytes = await readRegularAbsoluteBytes(
        wrapperPath,
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Real CI CLI entrypoint executable wrapper",
      );
      if (!byteEqual(expectedBytes, afterBytes)) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The exact CI CLI entrypoint probe wrapper bytes changed during execution.",
          { wrapperPath },
        );
      }
    }
    logBytes = await readRegularAbsoluteBytes(
      logPath,
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Real CI CLI entrypoint command log",
    );
  } finally {
    await rm(generatedTemporaryDirectory, { recursive: true, force: true });
  }

  const onDiskAfter = await readRegularAbsoluteBytes(
    candidatePath,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI CLI entrypoint source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  if (!byteEqual(onDiskBefore, onDiskAfter) || !byteEqual(ciSourceBytes, onDiskAfter)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Authenticated single-pass CI bytes changed while its real CLI entrypoint was observed.",
      {
        beforeSha256: sha256(onDiskBefore),
        afterSha256: sha256(onDiskAfter),
      },
    );
  }
  if (executionError !== undefined) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The authenticated CI source could not execute its real CLI entrypoint.",
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
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The real CI CLI entrypoint emitted an unexpected process stream.",
    );
  }

  const logText = decodeUtf8(
    logBytes,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Real CI CLI entrypoint command log",
  );
  const lines = logText.endsWith("\n") ? logText.slice(0, -1).split("\n") : [];
  const actualCommands = lines.map((line) =>
    parseJson(
      line,
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Real CI CLI entrypoint command record",
    ),
  );
  const expectedCommands = expectedSteps.map(({ command, args }) => ({
    command,
    args: [...args],
  }));
  const recordsAreExact = actualCommands.every(
    (record) =>
      isExactPlainRecord(record, ["args", "command"]) &&
      ["node", "pnpm"].includes(record.command) &&
      Array.isArray(record.args) &&
      record.args.every((argument) => typeof argument === "string"),
  );
  if (
    lines.some((line) => line.length === 0) ||
    !recordsAreExact ||
    JSON.stringify(actualCommands) !== JSON.stringify(expectedCommands)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "The real CI CLI entrypoint did not spawn every independently pinned step exactly once.",
      {
        expectedCount: expectedCommands.length,
        actualCount: actualCommands.length,
      },
    );
  }
  parseCiEntrypointReceipt(stdout, expectedSteps, expectedProofCount);
  return Object.freeze({
    processLocalReauthenticatedCliObservationCache: true,
    realCliEntrypointExecuted: true,
    realCliExactPinnedCommands: expectedCommands.length,
    realCliTerminalReceiptValidated: true,
    realCliUsesNoOpExecutableWrappers: true,
  });
}

let cachedCiEntrypointObservation;

async function executeCandidateCiEntrypoint(ciSourceBytes, expectedSteps, expectedProofCount) {
  const candidatePath = path.join(ROOT, CI_SOURCE);
  const currentBytes = await readRegularAbsoluteBytes(
    candidatePath,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI CLI entrypoint source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  if (
    !byteEqual(ciSourceBytes, currentBytes) ||
    (await realpath(candidatePath)) !== candidatePath
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Cached real CI CLI observation requires the exact authenticated non-aliased on-disk source.",
      {
        candidateSha256: sha256(ciSourceBytes),
        onDiskSha256: sha256(currentBytes),
      },
    );
  }
  const normalizedExpectation = expectedSteps.map(({ id, command, args }) => ({
    id,
    command,
    args,
  }));
  const cacheKey = sha256(
    Buffer.from(
      JSON.stringify({
        sourceSha256: sha256(currentBytes),
        expectedProofCount,
        normalizedExpectation,
      }),
      "utf8",
    ),
  );
  if (cachedCiEntrypointObservation?.key === cacheKey) {
    return cachedCiEntrypointObservation.promise;
  }

  const promise = executeCandidateCiEntrypointUncached(
    ciSourceBytes,
    expectedSteps,
    expectedProofCount,
  );
  cachedCiEntrypointObservation = Object.freeze({ key: cacheKey, promise });
  try {
    return await promise;
  } catch (error) {
    if (cachedCiEntrypointObservation?.promise === promise) {
      cachedCiEntrypointObservation = undefined;
    }
    throw error;
  }
}

async function ciRegistrationClaims(ciSource, ciSourceBytes) {
  const sourceFile = ts.createSourceFile(
    CI_SOURCE,
    ciSource,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT", "Single-pass CI source no longer parses.");
  }
  assertNoCandidateAuthorityRebinding(sourceFile);
  const imports = sourceFile.statements
    .filter((statement) => ts.isImportDeclaration(statement))
    .map((statement) =>
      ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : "",
    );
  if (JSON.stringify(imports) !== JSON.stringify(EXPECTED_CI_IMPORTS)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI executable observation permits only its reviewed built-in imports.",
      { imports },
    );
  }

  let proofEntriesInitializer;
  let planShaInitializer;
  let createStepsFunction;
  let defaultGateFunction;
  let mainFunction;
  function visitTop(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "PROOF_ENTRIES") {
        if (proofEntriesInitializer !== undefined) {
          fail(
            "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
            "Single-pass CI defines PROOF_ENTRIES more than once.",
          );
        }
        proofEntriesInitializer = node.initializer;
      }
      if (node.name.text === "QUALITY_GATE_PLAN_SHA256") {
        if (planShaInitializer !== undefined) {
          fail(
            "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
            "Single-pass CI defines QUALITY_GATE_PLAN_SHA256 more than once.",
          );
        }
        planShaInitializer = node.initializer;
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "createQualityGateSteps") {
      if (createStepsFunction !== undefined) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "Single-pass CI defines createQualityGateSteps more than once.",
        );
      }
      createStepsFunction = node;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "executeDefaultQualityGate") {
      if (defaultGateFunction !== undefined) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "Single-pass CI defines executeDefaultQualityGate more than once.",
        );
      }
      defaultGateFunction = node;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "main") {
      if (mainFunction !== undefined) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "Single-pass CI defines main more than once.",
        );
      }
      mainFunction = node;
    }
    ts.forEachChild(node, visitTop);
  }
  visitTop(sourceFile);

  if (!ts.isStringLiteral(planShaInitializer)) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI reviewed plan digest is not one literal.",
    );
  }

  if (
    proofEntriesInitializer === undefined ||
    !ts.isCallExpression(proofEntriesInitializer) ||
    !ts.isPropertyAccessExpression(proofEntriesInitializer.expression) ||
    !ts.isIdentifier(proofEntriesInitializer.expression.expression) ||
    proofEntriesInitializer.expression.expression.text !== "Object" ||
    proofEntriesInitializer.expression.name.text !== "freeze" ||
    proofEntriesInitializer.arguments.length !== 1
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI PROOF_ENTRIES is not one frozen mapped inventory.",
    );
  }
  const mappedInventory = proofEntriesInitializer.arguments[0];
  if (
    !ts.isCallExpression(mappedInventory) ||
    !ts.isPropertyAccessExpression(mappedInventory.expression) ||
    mappedInventory.expression.name.text !== "map" ||
    !ts.isArrayLiteralExpression(mappedInventory.expression.expression)
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI PROOF_ENTRIES readable tuple inventory drifted.",
    );
  }
  const entries = mappedInventory.expression.expression.elements.map((element) => {
    if (
      !ts.isArrayLiteralExpression(element) ||
      element.elements.length !== 3 ||
      !element.elements.every((field) => ts.isStringLiteral(field))
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "Single-pass CI contains a nonliteral proof tuple.",
      );
    }
    return Object.freeze({
      id: element.elements[0].text,
      verifierFile: element.elements[1].text,
      rootTestFile: element.elements[2].text,
    });
  });
  const predecessorIndex = entries.findIndex(({ id }) => id === "publisher-source-normalization");
  const currentIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-catalog-pinning" ? [index] : [],
  );
  const currentEntry = currentIndexes.length === 1 ? entries[currentIndexes[0]] : undefined;
  if (
    predecessorIndex < 0 ||
    currentIndexes.length !== 1 ||
    currentIndexes[0] !== predecessorIndex + 1 ||
    currentEntry.verifierFile !== "scripts/verify-publisher-catalog-pinning.mjs" ||
    currentEntry.rootTestFile !== "tests/publisher-catalog-pinning.test.mjs"
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI source no longer contains the exact active Catalog-pinning tuple after Source normalization.",
    );
  }
  const successorIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-bundle-publication" ? [index] : [],
  );
  const officialGoldenIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-official-golden" ? [index] : [],
  );
  const invalidSourceMatrixIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-invalid-source-matrix" ? [index] : [],
  );
  const bundleStoreIndexes = entries.flatMap(({ id }, index) =>
    id === "control-plane-bundle-store" ? [index] : [],
  );
  let ciProfile;
  if (successorIndexes.length === 0) {
    if (officialGoldenIndexes.length > 0 || invalidSourceMatrixIndexes.length > 0) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "A later Publisher CI successor exists without the approved Bundle-publication edge.",
        { officialGoldenIndexes, invalidSourceMatrixIndexes },
      );
    }
    ciProfile = HISTORICAL_CI_PROFILE;
  } else {
    const successorEntry = successorIndexes.length === 1 ? entries[successorIndexes[0]] : undefined;
    if (
      successorIndexes.length !== 1 ||
      successorIndexes[0] !== currentIndexes[0] + 1 ||
      successorEntry.verifierFile !== "scripts/verify-publisher-bundle-publication.mjs" ||
      successorEntry.rootTestFile !== "tests/publisher-bundle-publication.test.mjs"
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "The approved Bundle-publication successor is not one exact tuple immediately after Catalog pinning.",
        { successorIndexes },
      );
    }
    if (officialGoldenIndexes.length === 0) {
      if (invalidSourceMatrixIndexes.length > 0) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The invalid-source matrix cannot bypass the approved official-golden successor.",
          { invalidSourceMatrixIndexes },
        );
      }
      ciProfile = SUCCESSOR_CI_PROFILE;
    } else {
      const officialGoldenEntry =
        officialGoldenIndexes.length === 1 ? entries[officialGoldenIndexes[0]] : undefined;
      if (
        officialGoldenIndexes.length !== 1 ||
        officialGoldenIndexes[0] !== successorIndexes[0] + 1 ||
        officialGoldenEntry.verifierFile !== "scripts/verify-publisher-official-golden.mjs" ||
        officialGoldenEntry.rootTestFile !== "tests/publisher-official-golden.test.mjs"
      ) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The approved official-golden successor is not one exact tuple immediately after Bundle publication.",
          { officialGoldenIndexes },
        );
      }
      if (invalidSourceMatrixIndexes.length === 0) {
        ciProfile = OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE;
      } else {
        const invalidSourceMatrixEntry =
          invalidSourceMatrixIndexes.length === 1
            ? entries[invalidSourceMatrixIndexes[0]]
            : undefined;
        if (
          invalidSourceMatrixIndexes.length !== 1 ||
          invalidSourceMatrixIndexes[0] !== officialGoldenIndexes[0] + 1 ||
          invalidSourceMatrixEntry.verifierFile !==
            "scripts/verify-publisher-invalid-source-matrix.mjs" ||
          invalidSourceMatrixEntry.rootTestFile !== "tests/publisher-invalid-source-matrix.test.mjs"
        ) {
          fail(
            "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
            "The approved invalid-source successor is not one exact tuple immediately after the official golden.",
            { invalidSourceMatrixIndexes },
          );
        }
        ciProfile = INVALID_SOURCE_MATRIX_SUCCESSOR_CI_PROFILE;
      }
    }
  }
  if (bundleStoreIndexes.length > 0) {
    const bundleStoreEntry =
      bundleStoreIndexes.length === 1 ? entries[bundleStoreIndexes[0]] : undefined;
    const prefixSha256 = sha256(
      Buffer.from(
        JSON.stringify(
          entries.slice(0, CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.proofEntries),
        ),
        "utf8",
      ),
    );
    if (
      invalidSourceMatrixIndexes.length !== 1 ||
      bundleStoreIndexes.length !== 1 ||
      bundleStoreIndexes[0] !== invalidSourceMatrixIndexes[0] + 1 ||
      bundleStoreEntry?.verifierFile !== "scripts/verify-control-plane-bundle-store.mjs" ||
      bundleStoreEntry?.rootTestFile !== "tests/control-plane-bundle-store.test.mjs" ||
      entries.length < CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.proofEntries ||
      invalidSourceMatrixIndexes[0] !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.t11Index ||
      bundleStoreIndexes[0] !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.m07T01Index ||
      prefixSha256 !== CONTROL_PLANE_BUNDLE_STORE_SUCCESSOR_CI_PROFILE.prefixSha256
    ) {
      fail(
        "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
        "The approved M07-T01 successor is not the exact frozen prefix edge immediately after the invalid-source matrix.",
        { invalidSourceMatrixIndexes, bundleStoreIndexes, prefixSha256 },
      );
    }
    for (const field of ["id", "verifierFile", "rootTestFile"]) {
      const values = entries.map((entry) => entry[field]);
      if (new Set(values).size !== values.length) {
        fail(
          "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
          "The append-only CI suffix contains duplicate proof authority.",
          { field },
        );
      }
    }
    ciProfile = Object.freeze({
      planSha256: planShaInitializer.text,
      stepCount: 8 + entries.length * 2,
    });
  }
  if (planShaInitializer.text !== ciProfile.planSha256) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI reviewed plan digest differs from the independently selected compatibility profile.",
      {
        expected: ciProfile.planSha256,
        actual: planShaInitializer.text,
        steps: ciProfile.stepCount,
      },
    );
  }

  if (!createStepsFunction) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI no longer defines the executable quality-gate plan.",
    );
  }
  if (!defaultGateFunction || !mainFunction) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Single-pass CI default execution path is missing.",
    );
  }
  assertDirectCandidatePlanValidation(createStepsFunction);
  assertMainHasNoReturnBypass(mainFunction);
  assertDefaultGateBinding(defaultGateFunction, mainFunction);
  const trackedCiBytes = await readRegularAbsoluteBytes(
    path.join(ROOT, CI_SOURCE),
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Tracked single-pass CI source",
    Object.freeze({ relativePath: CI_SOURCE }),
  );
  const candidateIsTracked = byteEqual(ciSourceBytes, trackedCiBytes);
  const candidate = candidateIsTracked
    ? await executeCandidateCiPlan(ciSourceBytes)
    : await executeDetachedCandidateCiPlan(ciSourceBytes);
  const executablePlan = executableCandidatePlanClaims(
    candidate,
    entries,
    ciSourceBytes,
    ciProfile,
  );
  const realCliEntrypoint = candidateIsTracked
    ? await executeCandidateCiEntrypoint(ciSourceBytes, candidate.steps, entries.length)
    : Object.freeze({
        detachedCandidatePlanValidated: true,
      });
  return Object.freeze({
    builtinOnlyImportBoundary: true,
    sourceTupleExact: true,
    directUnconditionalPlanValidation: true,
    mainUsesNonOverridableDefaultPlan: true,
    ...executablePlan,
    ...realCliEntrypoint,
  });
}

async function registrationClaims(
  packageJsonText,
  publisherPackageJsonText,
  ciSource,
  ciSourceBytes,
  publicDeclaration,
) {
  const rootPackage = parseJson(
    packageJsonText,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Root package manifest",
  );
  const publisherPackage = parseJson(
    publisherPackageJsonText,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Publisher package manifest",
  );
  const expected = Object.freeze({
    package: "vitest run test/catalog-pinning.test.ts",
    generate:
      "pnpm verify:publisher-source-normalization && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:catalog-pinning && node scripts/generate-publisher-catalog-pinning-proof.mjs",
    verify:
      "pnpm verify:publisher-source-normalization && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:catalog-pinning && node scripts/verify-publisher-catalog-pinning.mjs",
    test: "pnpm verify:publisher-source-normalization && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:catalog-pinning && node --test tests/publisher-catalog-pinning.test.mjs",
  });
  const expectedT11Successor = Object.freeze({
    package: "vitest run test/invalid-source-matrix.test.ts",
    generate:
      "pnpm verify:publisher-official-golden && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:invalid-source-matrix && node scripts/generate-publisher-invalid-source-matrix-proof.mjs",
    verify:
      "pnpm verify:publisher-official-golden && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:invalid-source-matrix && node scripts/verify-publisher-invalid-source-matrix.mjs",
    test: "pnpm verify:publisher-official-golden && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:invalid-source-matrix && node --test tests/publisher-invalid-source-matrix.test.mjs",
  });
  const expectedM07T01Successor = Object.freeze({
    generate:
      "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/generate-control-plane-bundle-store-proof.mjs",
    verify:
      "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node scripts/verify-control-plane-bundle-store.mjs",
    test: "pnpm verify:publisher-invalid-source-matrix && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:bundle-store && node --test tests/control-plane-bundle-store.test.mjs",
  });
  if (
    publisherPackage.scripts?.["test:catalog-pinning"] !== expected.package ||
    rootPackage.scripts?.["generate:publisher-catalog-pinning"] !== expected.generate ||
    rootPackage.scripts?.["verify:publisher-catalog-pinning"] !== expected.verify ||
    rootPackage.scripts?.["test:publisher-catalog-pinning"] !== expected.test ||
    publisherPackage.scripts?.["test:invalid-source-matrix"] !== expectedT11Successor.package ||
    rootPackage.scripts?.["generate:publisher-invalid-source-matrix"] !==
      expectedT11Successor.generate ||
    rootPackage.scripts?.["verify:publisher-invalid-source-matrix"] !==
      expectedT11Successor.verify ||
    rootPackage.scripts?.["test:publisher-invalid-source-matrix"] !== expectedT11Successor.test ||
    rootPackage.scripts?.["generate:control-plane-bundle-store"] !==
      expectedM07T01Successor.generate ||
    rootPackage.scripts?.["verify:control-plane-bundle-store"] !== expectedM07T01Successor.verify ||
    rootPackage.scripts?.["test:control-plane-bundle-store"] !== expectedM07T01Successor.test
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
      "Catalog-pinning or its approved T11 successor package/root registrations drifted.",
    );
  }
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-source-normalization",
    "pnpm test:publisher-catalog-pinning",
    "Aggregate test",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-source-normalization",
    "pnpm verify:publisher-catalog-pinning",
    "Aggregate check",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-official-golden",
    "pnpm test:publisher-invalid-source-matrix",
    "Aggregate test T11 successor",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-official-golden",
    "pnpm verify:publisher-invalid-source-matrix",
    "Aggregate check T11 successor",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-invalid-source-matrix",
    "pnpm test:control-plane-bundle-store",
    "Aggregate test M07-T01 successor",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-invalid-source-matrix",
    "pnpm verify:control-plane-bundle-store",
    "Aggregate check M07-T01 successor",
  );
  await ciRegistrationClaims(ciSource, ciSourceBytes);

  const runtimeExports = Object.keys(publisherPublicApi).sort();
  const rootRuntimeProfileApproved =
    JSON.stringify(runtimeExports) === JSON.stringify(HISTORICAL_ROOT_RUNTIME_EXPORTS) ||
    JSON.stringify(runtimeExports) === JSON.stringify(SUCCESSOR_ROOT_RUNTIME_EXPORTS);
  const runtimeExported = Object.hasOwn(publisherPublicApi, "preflightPublishCatalogPinning");
  const declarationExported =
    /\b(?:PublishCatalogPinning|preflightPublishCatalogPinning|CATALOG_PINNING_)\b/u.test(
      publicDeclaration,
    );
  const packageExports = publisherPackage.exports;
  const rootExport =
    isExactPlainRecord(packageExports, ["."]) && Object.hasOwn(packageExports, ".")
      ? packageExports["."]
      : undefined;
  if (
    !rootRuntimeProfileApproved ||
    runtimeExported ||
    declarationExported ||
    !isExactPlainRecord(packageExports, ["."]) ||
    !isExactPlainRecord(rootExport, ["import", "types"]) ||
    rootExport.import !== "./dist/index.js" ||
    rootExport.types !== "./dist/index.d.ts"
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_PUBLIC_API_DRIFT",
      "The package-private Catalog-pinning boundary leaked through the package root or subpath.",
    );
  }

  return Object.freeze({
    ...expected,
    legacyImmediatePredecessor: true,
    ci: HISTORICAL_CI_CLAIMS,
    packagePrivate: true,
    exactRootPackageExport: true,
  });
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
    rootTestBytes,
    packageJsonText,
    publisherPackageJsonText,
    ciSourceBytes,
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
    trackedBytes(options, ROOT_TEST),
    trackedBytes(options, ROOT_PACKAGE).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, PUBLISHER_PACKAGE).then((bytes) => bytes.toString("utf8")),
    trackedBytes(options, CI_SOURCE),
    trackedBytes(options, PUBLIC_DECLARATION).then((bytes) => bytes.toString("utf8")),
    prerequisiteClaims(options),
  ]);
  const ciSource = decodeUtf8(
    ciSourceBytes,
    "PUBLISHER_CATALOG_PINNING_REGISTRATION_DRIFT",
    "Single-pass CI source",
  );
  authenticateM07T11RootTestSuccessor(rootTestBytes);
  const rootTestText = decodeUtf8(
    rootTestBytes,
    "PUBLISHER_CATALOG_PINNING_COMPATIBILITY_DRIFT",
    "Catalog-pinning root suite",
  );

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
  const traceRows = traceabilityClaims(traceabilityText);
  const registrations = await registrationClaims(
    packageJsonText,
    publisherPackageJsonText,
    ciSource,
    ciSourceBytes,
    publicDeclaration,
  );
  const runtimeNames = countNamedTests(runtimeTestText);
  const compilerNegativeCases = countCompilerNegativeCases(typeTestText);
  const rootNames = countNamedTests(rootTestText);
  const missingT11SuccessorRootTests = REQUIRED_T11_SUCCESSOR_ROOT_TEST_NAMES.filter(
    (name) => !rootNames.includes(name),
  );
  const missingM07T01SuccessorRootTests = REQUIRED_M07_T01_SUCCESSOR_ROOT_TEST_NAMES.filter(
    (name) => !rootNames.includes(name),
  );
  if (
    runtimeNames.length < 12 ||
    new Set(runtimeNames).size !== runtimeNames.length ||
    compilerNegativeCases < 12 ||
    rootNames.length < 12 ||
    new Set(rootNames).size !== rootNames.length ||
    missingT11SuccessorRootTests.length > 0 ||
    missingM07T01SuccessorRootTests.length > 0
  ) {
    fail(
      "PUBLISHER_CATALOG_PINNING_TEST_INVENTORY_DRIFT",
      "Catalog-pinning executable or compiler-negative inventory is incomplete.",
      {
        runtimeCases: runtimeNames.length,
        compilerNegativeCases,
        rootMutationCases: rootNames.length,
        missingT11SuccessorRootTests,
        missingM07T01SuccessorRootTests,
      },
    );
  }

  const trackedFiles = [];
  for (const relativePath of TRACKED) {
    const override = readOverrideMap(options.trackedFileBytes, relativePath);
    const bytes = override ?? (await readRegularBytes(relativePath));
    const historical =
      override === undefined || [CI_SOURCE, ROOT_PACKAGE].includes(relativePath)
        ? HISTORICAL_TRACKED_RECEIPTS[relativePath]
        : undefined;
    trackedFiles.push(
      historical === undefined
        ? Object.freeze({
            path: relativePath,
            bytes: bytes.byteLength,
            sha256: sha256(bytes),
          })
        : Object.freeze({ path: relativePath, ...historical }),
    );
  }

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
      registrations,
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
    tests: HISTORICAL_TEST_CLAIMS,
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
