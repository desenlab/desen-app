import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { constants as fileConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json";
const PROOF_DOCUMENT = "docs/proof/PUBLISHER-BUNDLE-PUBLICATION.md";
const SOURCE = "packages/publisher/src/bundle-publication.ts";
const DISTRIBUTION = "packages/publisher/dist/bundle-publication.js";
const DECLARATION = "packages/publisher/dist/bundle-publication.d.ts";
const SOURCE_INDEX = "packages/publisher/src/index.ts";
const DISTRIBUTION_INDEX = "packages/publisher/dist/index.js";
const PUBLIC_DECLARATION = "packages/publisher/dist/index.d.ts";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_CONTRACT_TEST = "scripts/test/ci-quality-gate.test.mjs";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const RUNTIME_TEST = "packages/publisher/test/bundle-publication.test.ts";
const TYPE_TEST = "packages/publisher/test/bundle-publication.types.ts";
const ROOT_TEST = "tests/publisher-bundle-publication.test.mjs";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const BUNDLE_SCHEMA = "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-bundle.schema.json";
const PROTOCOL_DISTRIBUTION_INDEX = "packages/protocol/dist/index.js";
const PROTOCOL_CANONICALIZATION_DISTRIBUTION = "packages/protocol/dist/canonicalization.js";
const VALIDATOR_DISTRIBUTION_INDEX = "packages/validator/dist/index.js";
const VALIDATOR_EXECUTION_DISTRIBUTION = "packages/validator/dist/execution-contract-validation.js";

const GENERATOR = "scripts/generate-publisher-bundle-publication-proof.mjs";
const VERIFIER = "scripts/verify-publisher-bundle-publication.mjs";
const PROOF_LIBRARY = "scripts/lib/publisher-bundle-publication-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";

export const PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M06-T08",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
    sha256: "de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f",
  }),
  Object.freeze({
    task: "M02-T04",
    path: "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    sha256: "8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6",
  }),
  Object.freeze({
    task: "M02-T11",
    path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  }),
]);

export const PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS = Object.freeze([
  "scripts/lib/publisher-catalog-resolution-proof.mjs",
  "scripts/lib/publisher-source-preflight-proof.mjs",
  "scripts/lib/publisher-capability-preflight-proof.mjs",
  "scripts/lib/publisher-execution-preflight-proof.mjs",
  "scripts/lib/publisher-source-preservation-proof.mjs",
  "scripts/lib/publisher-source-normalization-proof.mjs",
  "scripts/lib/publisher-catalog-pinning-proof.mjs",
]);

export const PUBLISHER_BUNDLE_PUBLICATION_RESULT_AUTHORITY_FILES = Object.freeze([
  "packages/publisher/src/publish-result.ts",
  "packages/publisher/dist/publish-result.js",
  "packages/publisher/dist/publish-result.d.ts",
]);

const TRACKED = Object.freeze([
  TRACEABILITY,
  SOURCE_FIXTURE,
  CATALOG_FIXTURE,
  BUNDLE_SCHEMA,
  PROTOCOL_DISTRIBUTION_INDEX,
  PROTOCOL_CANONICALIZATION_DISTRIBUTION,
  VALIDATOR_DISTRIBUTION_INDEX,
  VALIDATOR_EXECUTION_DISTRIBUTION,
  ...PUBLISHER_BUNDLE_PUBLICATION_RESULT_AUTHORITY_FILES,
  SOURCE,
  DISTRIBUTION,
  DECLARATION,
  SOURCE_INDEX,
  DISTRIBUTION_INDEX,
  PUBLIC_DECLARATION,
  RUNTIME_TEST,
  TYPE_TEST,
  PUBLISHER_PACKAGE,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_CONTRACT_TEST,
  CI_WORKFLOW,
  ...PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
]);

// M06-T09 remains immutable evidence while later Publisher tasks extend only coordination
// surfaces. Current bytes are still parsed and executed below; these receipts preserve the exact
// task-time artifact projection after an approved successor is authenticated.
const HISTORICAL_TRACKED_RECEIPTS = Object.freeze({
  [PUBLISHER_PACKAGE]: Object.freeze({
    bytes: 1_452,
    sha256: "5fb7838832724a25af2c1de8c2c3dfd134f11c5c92f06f7f20fa67adf4ab853c",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 53_330,
    sha256: "ed0def5f79eaa6cb9f58334a4bced0ea3b6e2cba83baee7d2f211a69647f38df",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 45_349,
    sha256: "08c509ab0735de604b6e241513fc6f93177ec8323082a066851deef1eceb33c9",
  }),
  [CI_CONTRACT_TEST]: Object.freeze({
    bytes: 24_068,
    sha256: "7358443014ef4161b9c2e18117d40a5c7f5b3103a31dc9048ac396c2bcd37ac9",
  }),
  "scripts/lib/publisher-catalog-pinning-proof.mjs": Object.freeze({
    bytes: 88_341,
    sha256: "d3ec245fd3adc5f594b7da1bb79e486cc4b6d7238f7a42319cfc840783acac3e",
  }),
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 77_674,
    sha256: "4742e70f9b21ee2aee581f490915fe97d0cf95491d9c21b5f909c63980351079",
  }),
});

const HISTORICAL_CI_RECEIPT = Object.freeze({
  planSha256: "3c927667b5b932a523f3bbe347cc554cd16b94e08fe493f5afe1b76361311f0c",
  proofEntries: 58,
  stepCount: 124,
  t09Index: 57,
  t09VerifierSteps: 1,
  t09RootTestSteps: 1,
});

const OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE = Object.freeze({
  planSha256: "ce00f625601b84a74a0b96d061f9ca25a2aa283d45aae4e8991051de70247582",
  proofEntries: 59,
  stepCount: 126,
  t09Index: 57,
  t10Index: 58,
});

const HISTORICAL_REGISTRATION_CLAIMS = Object.freeze({
  package: "vitest run test/bundle-publication.test.ts",
  generate:
    "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node scripts/generate-publisher-bundle-publication-proof.mjs",
  verify:
    "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node scripts/verify-publisher-bundle-publication.mjs",
  test: "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node --test tests/publisher-bundle-publication.test.mjs",
  aggregateImmediatePredecessor: "publisher-catalog-pinning",
  ci: Object.freeze({
    planSha256: "3c927667b5b932a523f3bbe347cc554cd16b94e08fe493f5afe1b76361311f0c",
    proofEntries: 58,
    sourceTupleExact: true,
    t09Index: 57,
  }),
  hostedWorkflowSinglePass: true,
  executableSinglePassCi: HISTORICAL_CI_RECEIPT,
});

const EXPECTED_TRACE_ROWS = Object.freeze([
  Object.freeze({ collection: "schemaFamilies", id: "SC-019", ownerField: "semanticOwners" }),
  Object.freeze({ collection: "conformanceRules", id: "C-012", ownerField: "owners" }),
  Object.freeze({ collection: "conformanceRules", id: "C-014", ownerField: "owners" }),
  Object.freeze({ collection: "pipelineSteps", id: "PIPE-005", ownerField: "owners" }),
  Object.freeze({ collection: "pipelineSteps", id: "PIPE-039", ownerField: "owners" }),
  Object.freeze({ collection: "pipelineSteps", id: "PIPE-040", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-007", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-012", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-029", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-031", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-035", ownerField: "owners" }),
  Object.freeze({ collection: "proseRules", id: "R-036", ownerField: "owners" }),
]);

const EXPECTED_PUBLIC_RUNTIME_KEYS = Object.freeze([
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
const SUCCESS_KEYS = Object.freeze(["bundle", "diagnostics", "ok"]);
const FAILURE_KEYS = Object.freeze(["diagnostics", "ok", "stage"]);
const BUNDLE_REQUIRED_KEYS = Object.freeze([
  "desen",
  "entry",
  "id",
  "kind",
  "requires",
  "revision",
  "sourceDigest",
  "surfaces",
]);
const BUNDLE_OPTIONAL_KEYS = Object.freeze(["extensions"]);
const EXPECTED_OFFICIAL_BUNDLE_KEYS = Object.freeze(
  [...BUNDLE_REQUIRED_KEYS, ...BUNDLE_OPTIONAL_KEYS].sort(),
);
const TWO_MIB = 2_097_152;
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
const execFileAsync = promisify(execFile);

const OPTION_KEYS = new Set([
  "artifactBytes",
  "artifactPath",
  "beforeAtomicRename",
  "ciReceipt",
  "prerequisiteBytes",
  "proofDocument",
  "proofDocumentPath",
  "runtimeReceipt",
  "trackedFileBytes",
]);

export const DEFAULT_PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class PublisherBundlePublicationEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublisherBundlePublicationEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new PublisherBundlePublicationEvidenceError(code, message, details);
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

function exactOwnDataOptions(rawOptions) {
  if (rawOptions === undefined) return Object.freeze({});
  try {
    if (
      typeof rawOptions !== "object" ||
      rawOptions === null ||
      utilTypes.isProxy(rawOptions) ||
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
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "Bundle-publication evidence options must be an exact inert own-data record.",
    );
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

function captureDenseOwnStringArray(value, code, label) {
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
      lengthDescriptor.value < 0
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
        typeof descriptor.value !== "string"
      ) {
        throw new TypeError();
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    fail(code, `${label} must be one exact ordinary dense own-data string array.`);
  }
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
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      throw new TypeError();
    }
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

function decodeUtf8(bytes, code, label, details = {}) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${label} is not valid UTF-8.`, details);
  }
}

function parseJson(text, code, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

async function readRegularAbsoluteBytes(absolutePath, code, label, details = Object.freeze({})) {
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
    if (error instanceof PublisherBundlePublicationEvidenceError) throw error;
    fail(code, `${label} could not be opened as one regular non-symbolic file.`, details);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readRegularBytes(relativePath, code = "PUBLISHER_BUNDLE_PUBLICATION_FILE_DRIFT") {
  return readRegularAbsoluteBytes(
    path.join(ROOT, relativePath),
    code,
    "Bundle-publication evidence input",
    Object.freeze({ relativePath }),
  );
}

function readOverrideMap(map, relativePath, allowedPaths) {
  if (map === undefined) return undefined;
  try {
    if (
      typeof map !== "object" ||
      map === null ||
      utilTypes.isProxy(map) ||
      Array.isArray(map) ||
      Object.getPrototypeOf(map) !== OBJECT_PROTOTYPE
    ) {
      throw new TypeError();
    }
    for (const key of Reflect.ownKeys(map)) {
      if (typeof key !== "string" || !allowedPaths.has(key)) throw new TypeError();
      const descriptor = Object.getOwnPropertyDescriptor(map, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
    }
    const descriptor = Object.getOwnPropertyDescriptor(map, relativePath);
    return descriptor === undefined
      ? undefined
      : captureInertBytes(
          descriptor.value,
          "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
          `Bundle-publication byte override for ${relativePath}`,
        );
  } catch (error) {
    if (error instanceof PublisherBundlePublicationEvidenceError) throw error;
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "Bundle-publication byte overrides must be exact inert Buffer or Uint8Array entries.",
      { relativePath },
    );
  }
}

const TRACKED_SET = new Set(TRACKED);
const PREREQUISITE_SET = new Set(
  PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS.map(
    ({ path: prerequisitePath }) => prerequisitePath,
  ),
);

async function trackedInput(options, relativePath) {
  const override = readOverrideMap(options.trackedFileBytes, relativePath, TRACKED_SET);
  return Object.freeze({
    bytes: override ?? (await readRegularBytes(relativePath)),
    overridden: override !== undefined,
  });
}

async function prerequisiteClaims(options) {
  const claims = [];
  for (const pin of PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_PINS) {
    const bytes =
      readOverrideMap(options.prerequisiteBytes, pin.path, PREREQUISITE_SET) ??
      (await readRegularBytes(pin.path, "PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_DRIFT"));
    const actual = sha256(bytes);
    if (actual !== pin.sha256) {
      fail(
        "PUBLISHER_BUNDLE_PUBLICATION_PREREQUISITE_DRIFT",
        `Exact prerequisite ${pin.task} does not match its reviewed bytes.`,
        { path: pin.path, expected: pin.sha256, actual },
      );
    }
    claims.push(Object.freeze({ ...pin, verifiedSha256: actual }));
  }
  return Object.freeze(claims);
}

function compactSyntax(text) {
  return text.replace(/\s+/gu, "");
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node, sourceFile) {
  if (
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    const name = node.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    return name.getText(sourceFile);
  }
  return undefined;
}

function propertyChain(node) {
  const current = unwrapExpression(node);
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current)) {
    const left = propertyChain(current.expression);
    return left === undefined ? undefined : `${left}.${current.name.text}`;
  }
  return undefined;
}

function calleeName(expression) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) return current.text;
  if (ts.isPropertyAccessExpression(current)) return current.name.text;
  return undefined;
}

function findNamedFunction(sourceFile, name, code) {
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (matches.length !== 1 || matches[0].body === undefined) {
    fail(code, `Expected exactly one concrete ${name} function.`, { count: matches.length });
  }
  return matches[0];
}

function collectCalls(root) {
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      calls.push(
        Object.freeze({
          node,
          name: calleeName(node.expression),
          position: node.getStart(),
        }),
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  return calls;
}

function callArgumentsAre(call, expectedChains) {
  return (
    call.node.arguments.length === expectedChains.length &&
    call.node.arguments.every(
      (argument, index) => propertyChain(argument) === expectedChains[index],
    )
  );
}

function objectAssignments(node, sourceFile) {
  const assignments = new Map();
  for (const property of node.properties) {
    const name = propertyName(property, sourceFile);
    if (name === undefined) {
      assignments.set("<unsupported>", property.getText(sourceFile));
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      assignments.set(
        name,
        propertyChain(property.initializer) ??
          compactSyntax(property.initializer.getText(sourceFile)),
      );
    } else if (ts.isShorthandPropertyAssignment(property)) {
      assignments.set(name, property.name.text);
    } else {
      assignments.set(name, "<unsupported>");
    }
  }
  return assignments;
}

function sortedMapKeys(map) {
  return [...map.keys()].sort();
}

function sameStrings(left, right) {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

function parseTypeScript(text, fileName, scriptKind, code) {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true, scriptKind);
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(code, `${fileName} no longer parses through the TypeScript AST.`, {
      diagnostics: sourceFile.parseDiagnostics.map(({ messageText }) => String(messageText)),
    });
  }
  return sourceFile;
}

function auditCandidateProjection(sourceFile, code) {
  const candidateFunction = findNamedFunction(sourceFile, "createCandidate", code);
  const candidateObjects = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const assignments = objectAssignments(node, sourceFile);
      if (assignments.has("revision") && assignments.get("kind") === "pinned.kind") {
        candidateObjects.push(assignments);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(candidateFunction.body);

  const withoutExtensions = [
    "desen",
    "entry",
    "id",
    "kind",
    "requires",
    "revision",
    "sourceDigest",
    "surfaces",
  ];
  const withExtensions = [...withoutExtensions, "extensions"].sort();
  const shapes = candidateObjects.map((assignments) => sortedMapKeys(assignments));
  const exactShapes =
    candidateObjects.length === 2 &&
    shapes.some((keys) => sameStrings(keys, withoutExtensions)) &&
    shapes.some((keys) => sameStrings(keys, withExtensions));
  const exactAuthority = candidateObjects.every(
    (assignments) =>
      assignments.get("kind") === "pinned.kind" &&
      assignments.get("desen") === "pinned.desen" &&
      assignments.get("id") === "pinned.id" &&
      assignments.get("revision") === "revision" &&
      assignments.get("sourceDigest") === "pinned.sourceDigest" &&
      assignments.get("requires") === "pinned.requires" &&
      assignments.get("entry") === "pinned.entry" &&
      assignments.get("surfaces") === "pinned.surfaces" &&
      !assignments.has("publication"),
  );
  if (!exactShapes || !exactAuthority) {
    fail(code, "The terminal candidate is no longer the exact revision-only T08 projection.", {
      shapes,
      exactAuthority,
    });
  }
  return Object.freeze({
    candidateObjectBranches: candidateObjects.length,
    revisionOnly: true,
    publicationAbsent: true,
    optionalExtensionsOnly: true,
  });
}

function auditLimitConstant(sourceFile, code) {
  const matches = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "PUBLISH_BUNDLE_PUBLICATION_LIMITS"
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (matches.length !== 1 || matches[0].initializer === undefined) {
    fail(code, "The fixed terminal Bundle limit profile is missing or duplicated.");
  }
  const initializer = unwrapExpression(matches[0].initializer);
  if (
    !ts.isCallExpression(initializer) ||
    calleeName(initializer.expression) !== "freeze" ||
    initializer.arguments.length !== 1
  ) {
    fail(code, "The fixed terminal Bundle limit profile is no longer frozen.");
  }
  const profile = unwrapExpression(initializer.arguments[0]);
  if (!ts.isObjectLiteralExpression(profile)) {
    fail(code, "The fixed terminal Bundle limit profile is no longer a literal.");
  }
  const assignments = objectAssignments(profile, sourceFile);
  const rawLimit = profile.properties.find(
    (property) => propertyName(property, sourceFile) === "maxBundleCanonicalBytes",
  );
  const limitInitializer =
    rawLimit !== undefined && ts.isPropertyAssignment(rawLimit)
      ? unwrapExpression(rawLimit.initializer)
      : undefined;
  if (
    !sameStrings(sortedMapKeys(assignments), ["catalogPinning", "maxBundleCanonicalBytes"]) ||
    assignments.get("catalogPinning") !== "PUBLISH_SOURCE_NORMALIZATION_LIMITS" ||
    !ts.isNumericLiteral(limitInitializer) ||
    Number(limitInitializer.text.replaceAll("_", "")) !== TWO_MIB
  ) {
    fail(code, "The fixed terminal Bundle limit is no longer exactly 2 MiB.", {
      keys: sortedMapKeys(assignments),
      limit: limitInitializer?.getText(sourceFile),
    });
  }
  return TWO_MIB;
}

function implementationAudit(text, fileName, scriptKind) {
  const code =
    fileName === SOURCE
      ? "PUBLISHER_BUNDLE_PUBLICATION_SOURCE_DRIFT"
      : "PUBLISHER_BUNDLE_PUBLICATION_DISTRIBUTION_DRIFT";
  const sourceFile = parseTypeScript(text, fileName, scriptKind, code);
  const imports = sourceFile.statements
    .filter((statement) => ts.isImportDeclaration(statement))
    .map((statement) =>
      ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : "",
    );
  const forbiddenImports = imports.filter((specifier) =>
    /^(?:node:|react(?:\/|$)|react-dom(?:\/|$)|@desen\/runtime|@desen\/reference|@desen\/app)/u.test(
      specifier,
    ),
  );
  if (
    forbiddenImports.length > 0 ||
    !imports.includes("@desen/protocol") ||
    !imports.includes("@desen/validator") ||
    !imports.includes("./catalog-pinning.js")
  ) {
    fail(code, "The terminal Publisher implementation import boundary drifted.", {
      imports,
      forbiddenImports,
    });
  }

  const publication = findNamedFunction(sourceFile, "publishDesenSourceWithLimits", code);
  const calls = collectCalls(publication.body);
  const callsNamed = (name) => calls.filter((call) => call.name === name);
  const exactCounts = Object.freeze({
    catalogPinning: callsNamed("preflightPublishCatalogPinning").length,
    canonicalBytes: callsNamed("canonicalizeJsonBytes").length,
    revision: callsNamed("calculateDesenBundleRevision").length,
    validator: callsNamed("validateDesenBundleExecutionContracts").length,
  });
  if (
    exactCounts.catalogPinning !== 1 ||
    exactCounts.canonicalBytes !== 2 ||
    exactCounts.revision !== 2 ||
    exactCounts.validator !== 1
  ) {
    fail(code, "The terminal publication call cardinalities drifted.", exactCounts);
  }

  const pinningCall = callsNamed("preflightPublishCatalogPinning")[0];
  const revisionCalls = callsNamed("calculateDesenBundleRevision");
  const canonicalCalls = callsNamed("canonicalizeJsonBytes");
  const validatorCall = callsNamed("validateDesenBundleExecutionContracts")[0];
  const graphCalls = callsNamed("jsonGraphsAreDisjoint");
  const byteEqualityCalls = callsNamed("byteEqual");
  if (
    !callArgumentsAre(pinningCall, [
      "rawSourceInput",
      "catalogPackageCandidatesInput",
      "limits.catalogPinning",
    ]) ||
    !callArgumentsAre(revisionCalls[0], ["pinning.pinnedDocument"]) ||
    !callArgumentsAre(revisionCalls[1], ["bundle"]) ||
    !callArgumentsAre(canonicalCalls[0], ["candidate"]) ||
    !callArgumentsAre(canonicalCalls[1], ["bundle"]) ||
    !callArgumentsAre(validatorCall, ["candidate", "pinning.catalogSet"]) ||
    graphCalls.length !== 1 ||
    !callArgumentsAre(graphCalls[0], ["candidate", "bundle"]) ||
    byteEqualityCalls.length !== 1 ||
    !callArgumentsAre(byteEqualityCalls[0], ["candidateBytes", "validatedBytes"])
  ) {
    fail(
      code,
      "The terminal publication authority arguments no longer match the reviewed T08/Validator choreography.",
    );
  }

  const choreography = [
    pinningCall,
    revisionCalls[0],
    canonicalCalls[0],
    validatorCall,
    graphCalls[0],
    canonicalCalls[1],
    byteEqualityCalls[0],
    revisionCalls[1],
  ].map(({ position }) => position);
  if (choreography.some((position, index) => index > 0 && position <= choreography[index - 1])) {
    fail(code, "The terminal publication call order drifted.", { choreography });
  }

  const limitChecks = [];
  function collectLimitChecks(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.GreaterThanToken &&
      propertyChain(node.right) === "limits.maxBundleCanonicalBytes"
    ) {
      limitChecks.push(propertyChain(node.left));
    }
    ts.forEachChild(node, collectLimitChecks);
  }
  collectLimitChecks(publication.body);
  if (!sameStrings(limitChecks, ["candidateBytes.byteLength", "validatedBytes.byteLength"])) {
    fail(code, "The complete Bundle is no longer measured exactly before and after Validator.", {
      limitChecks,
    });
  }

  const compactBody = compactSyntax(publication.body.getText(sourceFile));
  if (
    !compactBody.includes("bundle===candidate") ||
    !compactBody.includes("provisionalRevision!==validatedRevision") ||
    !compactBody.includes("closedRevision!==validatedRevision") ||
    !compactBody.includes("!isSha256Digest(closedRevision)") ||
    !compactBody.includes("!isSha256Digest(validatedRevision)")
  ) {
    fail(code, "The Validator independence or revision-closure guards drifted.");
  }

  const successObjects = [];
  function collectSuccessObjects(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const assignments = objectAssignments(node, sourceFile);
      if (assignments.has("ok")) successObjects.push({ node, assignments });
    }
    ts.forEachChild(node, collectSuccessObjects);
  }
  collectSuccessObjects(publication.body);
  const success = successObjects.find(({ assignments }) => assignments.get("ok") === "true");
  if (
    successObjects.length !== 1 ||
    success === undefined ||
    !sameStrings(sortedMapKeys(success.assignments), SUCCESS_KEYS) ||
    success.assignments.get("bundle") !== "bundle" ||
    success.assignments.get("diagnostics") !== "pinning.diagnostics" ||
    !ts.isCallExpression(success.node.parent) ||
    calleeName(success.node.parent.expression) !== "OBJECT_FREEZE"
  ) {
    fail(code, "The exact immutable terminal success shell drifted.", {
      successObjectCount: successObjects.length,
      keys: success === undefined ? [] : sortedMapKeys(success.assignments),
    });
  }

  const publicWrapper = findNamedFunction(sourceFile, "publishDesenSource", code);
  const wrapperCalls = collectCalls(publicWrapper.body).filter(
    ({ name }) => name === "publishDesenSourceWithLimits",
  );
  if (
    wrapperCalls.length !== 1 ||
    !callArgumentsAre(wrapperCalls[0], [
      "rawSource",
      "catalogPackages",
      "PUBLISH_BUNDLE_PUBLICATION_LIMITS",
    ])
  ) {
    fail(code, "The public two-argument Publisher wrapper drifted.");
  }

  const candidate = auditCandidateProjection(sourceFile, code);
  const maximumCanonicalBytes = auditLimitConstant(sourceFile, code);
  return Object.freeze({
    imports: Object.freeze(imports),
    callCounts: exactCounts,
    callOrder: Object.freeze([
      "preflightPublishCatalogPinning",
      "calculateDesenBundleRevision",
      "canonicalizeJsonBytes",
      "validateDesenBundleExecutionContracts",
      "jsonGraphsAreDisjoint",
      "canonicalizeJsonBytes",
      "byteEqual",
      "calculateDesenBundleRevision",
    ]),
    validatorReceivesExactCatalogSet: true,
    validatorSnapshotMustBeIndependent: true,
    validatorSnapshotCanonicalBytesMustEqualCandidate: true,
    completeBundleLimitChecks: Object.freeze(limitChecks),
    maximumCanonicalBytes,
    revisionClosure: Object.freeze(["provisionalRevision", "validatedRevision", "closedRevision"]),
    exactFrozenSuccessKeys: SUCCESS_KEYS,
    exactAtomicFailureKeys: FAILURE_KEYS,
    candidate,
    publicWrapperArguments: 2,
  });
}

function namedExportsFrom(sourceFile, moduleSpecifier) {
  const names = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleSpecifier ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }
    for (const element of statement.exportClause.elements) names.push(element.name.text);
  }
  return names.sort();
}

function exactNamedTypeReExport(sourceFile, moduleSpecifier, expectedNames) {
  const declarations = sourceFile.statements.filter(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleSpecifier,
  );
  const declaration = declarations[0];
  const names =
    declaration !== undefined &&
    declaration.exportClause !== undefined &&
    ts.isNamedExports(declaration.exportClause)
      ? declaration.exportClause.elements.map((element) => element.name.text).sort()
      : [];
  return Object.freeze({
    exact:
      declarations.length === 1 &&
      declaration.isTypeOnly === true &&
      declaration.exportClause !== undefined &&
      ts.isNamedExports(declaration.exportClause) &&
      declaration.exportClause.elements.every(
        (element) => element.propertyName === undefined && element.isTypeOnly === false,
      ) &&
      sameStrings(names, expectedNames),
    names: Object.freeze(names),
  });
}

function exportDeclarationCountFrom(sourceFile, moduleSpecifier) {
  return sourceFile.statements.filter(
    (statement) =>
      ts.isExportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleSpecifier,
  ).length;
}

function findFunctionDeclaration(sourceFile, name) {
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return matches;
}

function publicApiAudit(
  sourceIndexText,
  distributionIndexText,
  publicDeclarationText,
  internalDeclarationText,
  publisherPackageText,
) {
  const sourceIndex = parseTypeScript(
    sourceIndexText,
    SOURCE_INDEX,
    ts.ScriptKind.TS,
    "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
  );
  const distributionIndex = parseTypeScript(
    distributionIndexText,
    DISTRIBUTION_INDEX,
    ts.ScriptKind.JS,
    "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
  );
  const publicDeclaration = parseTypeScript(
    publicDeclarationText,
    PUBLIC_DECLARATION,
    ts.ScriptKind.TS,
    "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
  );
  const internalDeclaration = parseTypeScript(
    internalDeclarationText,
    DECLARATION,
    ts.ScriptKind.TS,
    "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
  );

  const sourceExports = namedExportsFrom(sourceIndex, "./bundle-publication.js");
  const distributionExports = namedExportsFrom(distributionIndex, "./bundle-publication.js");
  const declarationExports = namedExportsFrom(publicDeclaration, "./bundle-publication.js");
  if (
    !sameStrings(sourceExports, ["publishDesenSource"]) ||
    !sameStrings(distributionExports, ["publishDesenSource"]) ||
    !sameStrings(declarationExports, ["publishDesenSource"])
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "The package root must expose exactly the terminal publishDesenSource value from T09.",
      { sourceExports, distributionExports, declarationExports },
    );
  }

  const expectedCandidateTypeExports = ["PublishCatalogPackageCandidate"];
  const sourceCandidateTypeExports = exactNamedTypeReExport(
    sourceIndex,
    "./catalog-resolution.js",
    expectedCandidateTypeExports,
  );
  const declarationCandidateTypeExports = exactNamedTypeReExport(
    publicDeclaration,
    "./catalog-resolution.js",
    expectedCandidateTypeExports,
  );
  const distributionCatalogExportDeclarations = exportDeclarationCountFrom(
    distributionIndex,
    "./catalog-resolution.js",
  );
  if (
    !sourceCandidateTypeExports.exact ||
    !declarationCandidateTypeExports.exact ||
    distributionCatalogExportDeclarations !== 0
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "The package root must expose exactly the catalog candidate input type without a runtime catalog-resolution export.",
      {
        sourceTypeExports: sourceCandidateTypeExports.names,
        declarationTypeExports: declarationCandidateTypeExports.names,
        distributionCatalogExportDeclarations,
      },
    );
  }

  const forbiddenPublicNames = [
    "PUBLISH_BUNDLE_PUBLICATION_LIMITS",
    "PublishBundlePublicationLimits",
    "normalizePublishBundlePublicationLimits",
    "publishDesenSourceWithLimits",
    "preflightPublishCatalogPinning",
  ];
  const publicTexts = `${sourceIndexText}\n${distributionIndexText}\n${publicDeclarationText}`;
  const leakedNames = forbiddenPublicNames.filter((name) =>
    new RegExp(`\\b${name}\\b`, "u").test(publicTexts),
  );
  if (leakedNames.length > 0) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "A package-private limit or predecessor seam leaked through the public root.",
      { leakedNames },
    );
  }

  const publicFunctions = findFunctionDeclaration(internalDeclaration, "publishDesenSource");
  if (publicFunctions.length !== 1) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "The built public Publisher signature is missing or duplicated.",
    );
  }
  const signature = publicFunctions[0];
  const parameterTypes = signature.parameters.map((parameter) =>
    compactSyntax(parameter.type?.getText(internalDeclaration) ?? ""),
  );
  const returnType = compactSyntax(signature.type?.getText(internalDeclaration) ?? "");
  if (
    !sameStrings(parameterTypes, ["string", "readonlyPublishCatalogPackageCandidate[]"]) ||
    returnType !== "PublishResult"
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "publishDesenSource is no longer the exact two-argument typed terminal API.",
      { parameterTypes, returnType },
    );
  }

  const publisherPackage = parseJson(
    publisherPackageText,
    "PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT",
    "Publisher package manifest",
  );
  const exportsRecord = publisherPackage.exports;
  const rootExport = ownData(exportsRecord ?? {}, ".");
  if (
    !exactPlainRecord(exportsRecord, new Set(["."])) ||
    !exactPlainRecord(rootExport, new Set(["import", "types"])) ||
    ownData(rootExport, "import") !== "./dist/index.js" ||
    ownData(rootExport, "types") !== "./dist/index.d.ts"
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_PUBLIC_API_DRIFT",
      "The Publisher package must retain one exact public root export.",
    );
  }
  return Object.freeze({
    sourceExports: Object.freeze(sourceExports),
    distributionExports: Object.freeze(distributionExports),
    declarationExports: Object.freeze(declarationExports),
    catalogCandidateTypeExport: Object.freeze({
      sourceExports: sourceCandidateTypeExports.names,
      declarationExports: declarationCandidateTypeExports.names,
      runtimeValueExportAbsent: true,
    }),
    signature:
      "publishDesenSource(string, readonly PublishCatalogPackageCandidate[]): PublishResult",
    privateLimitSeamsHidden: true,
    exactRootPackageExport: true,
  });
}

function countNamedTests(text) {
  return [...text.matchAll(/\b(?:it|test)\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function countCompilerNegativeCases(text) {
  return (text.match(/@ts-expect-error\b/gu) ?? []).length;
}

function testInventoryClaims(runtimeTestText, typeTestText, rootTestText) {
  const runtimeNames = countNamedTests(runtimeTestText);
  const rootNames = countNamedTests(rootTestText);
  const compilerNegativeCases = countCompilerNegativeCases(typeTestText);
  const requiredRuntimeFragments = [
    "returns only the exact Validator snapshot",
    "executes T08, revision bootstrap",
    "exact complete canonical-byte ceiling",
    "one byte above the complete canonical-byte ceiling",
    "non-byte canonicalization authority at both",
    "relays exact Validator diagnostics",
    "mutable Validator snapshot",
    "canonical drift",
    "aliases candidate authority",
    "closure helper",
    "every intermediate authority absent",
    "hostile limit profiles",
    "publishes through the package root",
  ];
  const missingRuntimeCases = requiredRuntimeFragments.filter(
    (fragment) => !runtimeNames.some((name) => name.includes(fragment)),
  );
  const rootCategories = [
    "api",
    "ast",
    "authority",
    "ci",
    "compatibility",
    "limit",
    "options",
    "symlink",
    "writer",
  ];
  const missingRootCategories = rootCategories.filter(
    (category) => !rootNames.some((name) => name.toLowerCase().includes(`[${category}]`)),
  );
  if (
    runtimeNames.length < 30 ||
    new Set(runtimeNames).size !== runtimeNames.length ||
    compilerNegativeCases < 40 ||
    rootNames.length < 30 ||
    new Set(rootNames).size !== rootNames.length ||
    missingRuntimeCases.length > 0 ||
    missingRootCategories.length > 0
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_TEST_INVENTORY_DRIFT",
      "The terminal Publisher test inventory no longer covers the reviewed boundary.",
      {
        runtimeCases: runtimeNames.length,
        compilerNegativeCases,
        rootMutationCases: rootNames.length,
        missingRuntimeCases,
        missingRootCategories,
      },
    );
  }
  if (/\bvalidBundle\b|frozen official Bundle|double[- ]publish/iu.test(runtimeTestText)) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_T10_SCOPE_DRIFT",
      "M06-T09 package tests must not claim T10's official golden or double-publication proof.",
    );
  }
  return Object.freeze({
    publisherRuntimeCases: runtimeNames.length,
    compilerNegativeCases,
    rootMutationCases: rootNames.length,
    rootMutationCategories: Object.freeze(rootCategories),
    sha256: Object.freeze({
      runtime: sha256(Buffer.from(runtimeTestText, "utf8")),
      types: sha256(Buffer.from(typeTestText, "utf8")),
      root: sha256(Buffer.from(rootTestText, "utf8")),
    }),
  });
}

function traceabilityClaims(traceabilityText) {
  const traceability = parseJson(
    traceabilityText,
    "PUBLISHER_BUNDLE_PUBLICATION_TRACEABILITY_DRIFT",
    "Protocol traceability inventory",
  );
  const rows = [];
  for (const expected of EXPECTED_TRACE_ROWS) {
    const collection = traceability[expected.collection];
    const matches = Array.isArray(collection)
      ? collection.filter((row) => ownData(row, "id") === expected.id)
      : [];
    const owners = matches.length === 1 ? ownData(matches[0], expected.ownerField) : undefined;
    if (matches.length !== 1 || !Array.isArray(owners) || !owners.includes("M06-T09")) {
      fail(
        "PUBLISHER_BUNDLE_PUBLICATION_TRACEABILITY_DRIFT",
        `Traceability ownership for ${expected.collection}/${expected.id} drifted.`,
      );
    }
    rows.push(
      Object.freeze({
        collection: expected.collection,
        id: expected.id,
        ownerField: expected.ownerField,
      }),
    );
  }
  return Object.freeze({
    task: "M06-T09",
    rows: Object.freeze(rows),
  });
}

function assertImmediateSingleRootScriptEdge(script, predecessor, current, label) {
  if (typeof script !== "string") {
    fail("PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT", `${label} script is missing.`);
  }
  const steps = script.split("&&").map((step) => step.trim());
  const predecessorIndexes = steps.flatMap((step, index) => (step === predecessor ? [index] : []));
  const currentIndexes = steps.flatMap((step, index) => (step === current ? [index] : []));
  if (
    predecessorIndexes.length !== 1 ||
    currentIndexes.length !== 1 ||
    currentIndexes[0] !== predecessorIndexes[0] + 1
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT",
      `${label} must contain one immediate T08 → T09 edge.`,
      { predecessorIndexes, currentIndexes },
    );
  }
}

function extractCiInventory(ciSourceText) {
  const sourceFile = parseTypeScript(
    ciSourceText,
    CI_SOURCE,
    ts.ScriptKind.JS,
    "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
  );
  let proofInitializer;
  let planHash;
  let createStepsFunction;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "PROOF_ENTRIES") {
        if (proofInitializer !== undefined) {
          fail("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT", "CI defines PROOF_ENTRIES more than once.");
        }
        proofInitializer = node.initializer;
      }
      if (node.name.text === "QUALITY_GATE_PLAN_SHA256" && ts.isStringLiteral(node.initializer)) {
        if (planHash !== undefined) {
          fail(
            "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
            "CI defines QUALITY_GATE_PLAN_SHA256 more than once.",
          );
        }
        planHash = node.initializer.text;
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === "createQualityGateSteps") {
      createStepsFunction = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  const frozenCall =
    proofInitializer === undefined ? undefined : unwrapExpression(proofInitializer);
  const mapped =
    frozenCall !== undefined &&
    ts.isCallExpression(frozenCall) &&
    calleeName(frozenCall.expression) === "freeze" &&
    frozenCall.arguments.length === 1
      ? unwrapExpression(frozenCall.arguments[0])
      : undefined;
  const tupleArray =
    mapped !== undefined &&
    ts.isCallExpression(mapped) &&
    ts.isPropertyAccessExpression(mapped.expression) &&
    mapped.expression.name.text === "map"
      ? unwrapExpression(mapped.expression.expression)
      : undefined;
  if (!ts.isArrayLiteralExpression(tupleArray)) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "CI PROOF_ENTRIES is no longer one frozen mapped literal inventory.",
    );
  }
  const entries = tupleArray.elements.map((element) => {
    if (
      !ts.isArrayLiteralExpression(element) ||
      element.elements.length !== 3 ||
      !element.elements.every((field) => ts.isStringLiteral(field))
    ) {
      fail("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT", "CI contains a nonliteral proof tuple.");
    }
    return Object.freeze({
      id: element.elements[0].text,
      verifierFile: element.elements[1].text,
      rootTestFile: element.elements[2].text,
    });
  });
  const predecessorIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-catalog-pinning" ? [index] : [],
  );
  const currentIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-bundle-publication" ? [index] : [],
  );
  const current = currentIndexes.length === 1 ? entries[currentIndexes[0]] : undefined;
  if (
    predecessorIndexes.length !== 1 ||
    currentIndexes.length !== 1 ||
    currentIndexes[0] !== predecessorIndexes[0] + 1 ||
    current?.verifierFile !== VERIFIER ||
    current?.rootTestFile !== ROOT_TEST
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "CI must register the exact T09 verifier/root-test tuple immediately after T08.",
      { predecessorIndexes, currentIndexes, current },
    );
  }
  const successorIndexes = entries.flatMap(({ id }, index) =>
    id === "publisher-official-golden" ? [index] : [],
  );
  const successor = successorIndexes.length === 1 ? entries[successorIndexes[0]] : undefined;
  if (
    successorIndexes.length !== 1 ||
    successorIndexes[0] !== currentIndexes[0] + 1 ||
    successor?.verifierFile !== "scripts/verify-publisher-official-golden.mjs" ||
    successor?.rootTestFile !== "tests/publisher-official-golden.test.mjs"
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "CI must register the exact T10 verifier/root-test tuple immediately after T09.",
      { currentIndexes, successorIndexes, successor },
    );
  }
  if (
    typeof planHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(planHash) ||
    createStepsFunction?.body === undefined
  ) {
    fail("PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT", "CI reviewed plan authority is missing.");
  }
  if (
    planHash !== OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE.planSha256 ||
    entries.length !== OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE.proofEntries ||
    currentIndexes[0] !== OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE.t09Index ||
    successorIndexes[0] !== OFFICIAL_GOLDEN_SUCCESSOR_CI_PROFILE.t10Index
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT",
      "The reviewed live T10 successor profile differs from its exact single-pass plan authority.",
      {
        planHash,
        proofEntries: entries.length,
        t09Index: currentIndexes[0],
        t10Index: successorIndexes[0],
      },
    );
  }
  const stepCalls = collectCalls(createStepsFunction.body);
  const proofEntryReferences = (
    createStepsFunction.body.getText(sourceFile).match(/\bPROOF_ENTRIES\b/gu) ?? []
  ).length;
  if (
    proofEntryReferences !== 2 ||
    stepCalls.filter(({ name }) => name === "validateQualityGatePlan").length !== 1
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "CI no longer maps both proof phases and validates the complete plan once.",
      { proofEntryReferences },
    );
  }
  return Object.freeze({
    entries: Object.freeze(entries),
    planHash,
    t09Index: currentIndexes[0],
    t10Index: successorIndexes[0],
  });
}

function registrationClaims(rootPackageText, publisherPackageText, workflowText, ci) {
  const rootPackage = parseJson(
    rootPackageText,
    "PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT",
    "Root package manifest",
  );
  const publisherPackage = parseJson(
    publisherPackageText,
    "PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT",
    "Publisher package manifest",
  );
  const expected = Object.freeze({
    package: "vitest run test/bundle-publication.test.ts",
    generate:
      "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node scripts/generate-publisher-bundle-publication-proof.mjs",
    verify:
      "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node scripts/verify-publisher-bundle-publication.mjs",
    test: "pnpm verify:publisher-catalog-pinning && pnpm --filter @desen/publisher... build && pnpm --filter @desen/validator test:execution-contracts && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:bundle-publication && node --test tests/publisher-bundle-publication.test.mjs",
  });
  const expectedSuccessor = Object.freeze({
    package: "vitest run test/official-golden.test.ts",
    generate:
      "pnpm verify:publisher-bundle-publication && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:official-golden && node scripts/generate-publisher-official-golden-proof.mjs",
    verify:
      "pnpm verify:publisher-bundle-publication && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:official-golden && node scripts/verify-publisher-official-golden.mjs",
    test: "pnpm verify:publisher-bundle-publication && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:official-golden && node --test tests/publisher-official-golden.test.mjs",
  });
  if (
    publisherPackage.scripts?.["test:bundle-publication"] !== expected.package ||
    rootPackage.scripts?.["generate:publisher-bundle-publication"] !== expected.generate ||
    rootPackage.scripts?.["verify:publisher-bundle-publication"] !== expected.verify ||
    rootPackage.scripts?.["test:publisher-bundle-publication"] !== expected.test ||
    publisherPackage.scripts?.["test:official-golden"] !== expectedSuccessor.package ||
    rootPackage.scripts?.["generate:publisher-official-golden"] !== expectedSuccessor.generate ||
    rootPackage.scripts?.["verify:publisher-official-golden"] !== expectedSuccessor.verify ||
    rootPackage.scripts?.["test:publisher-official-golden"] !== expectedSuccessor.test
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_REGISTRATION_DRIFT",
      "T09 or its approved T10 package/root generate/verify/test registrations drifted.",
    );
  }
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-catalog-pinning",
    "pnpm test:publisher-bundle-publication",
    "Aggregate test",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-catalog-pinning",
    "pnpm verify:publisher-bundle-publication",
    "Aggregate check",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.test,
    "pnpm test:publisher-bundle-publication",
    "pnpm test:publisher-official-golden",
    "Aggregate test successor",
  );
  assertImmediateSingleRootScriptEdge(
    rootPackage.scripts?.check,
    "pnpm verify:publisher-bundle-publication",
    "pnpm verify:publisher-official-golden",
    "Aggregate check successor",
  );
  const workflowInvocations =
    workflowText.match(/run:\s*node scripts\/run-ci-quality-gate\.mjs\s*$/gmu) ?? [];
  if (workflowInvocations.length !== 1) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "The hosted workflow must invoke the reviewed single-pass CI entrypoint exactly once.",
      { count: workflowInvocations.length },
    );
  }
  if (ci.t10Index !== ci.t09Index + 1) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_DRIFT",
      "The authenticated T10 CI successor is not immediately after T09.",
    );
  }
  return HISTORICAL_REGISTRATION_CLAIMS;
}

const RUNTIME_RECEIPT_KEYS = new Set([
  "apiKeys",
  "authoringAbsent",
  "bundleDetachedFromCandidate",
  "bundleKeys",
  "catalogTupleCount",
  "failureAtomic",
  "failureDiagnosticsNonEmpty",
  "failureDeepFrozen",
  "failureFirstDiagnosticError",
  "failureFirstDiagnosticStageMatchesResult",
  "failureKeys",
  "failureStage",
  "independentCloneByteEqual",
  "independentCloneGraph",
  "inputUnchanged",
  "privateSeamsAbsent",
  "publicationAbsent",
  "revisionClosed",
  "revisionFormat",
  "sourceDigestFormat",
  "successDeepFrozen",
  "successInvocations",
  "successKeys",
  "terminalByteEnvelope",
  "controlledFailureInvocations",
]);

function validateRuntimeReceipt(receipt) {
  if (!exactPlainRecord(receipt, RUNTIME_RECEIPT_KEYS)) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
      "The isolated public-runtime probe returned a malformed authority receipt.",
    );
  }
  const apiKeys = captureDenseOwnStringArray(
    ownData(receipt, "apiKeys"),
    "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
    "Public-runtime API keys",
  );
  const successKeys = captureDenseOwnStringArray(
    ownData(receipt, "successKeys"),
    "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
    "Public-runtime success keys",
  );
  const failureKeys = captureDenseOwnStringArray(
    ownData(receipt, "failureKeys"),
    "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
    "Public-runtime failure keys",
  );
  const bundleKeys = captureDenseOwnStringArray(
    ownData(receipt, "bundleKeys"),
    "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
    "Public-runtime Bundle keys",
  );
  const requiredTrue = [
    "authoringAbsent",
    "bundleDetachedFromCandidate",
    "failureAtomic",
    "failureDiagnosticsNonEmpty",
    "failureDeepFrozen",
    "failureFirstDiagnosticError",
    "failureFirstDiagnosticStageMatchesResult",
    "independentCloneByteEqual",
    "independentCloneGraph",
    "inputUnchanged",
    "privateSeamsAbsent",
    "publicationAbsent",
    "revisionClosed",
    "revisionFormat",
    "sourceDigestFormat",
    "successDeepFrozen",
    "terminalByteEnvelope",
  ];
  if (
    !sameStrings(apiKeys, EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    !sameStrings(successKeys, SUCCESS_KEYS) ||
    !sameStrings(failureKeys, FAILURE_KEYS) ||
    !sameStrings(bundleKeys, EXPECTED_OFFICIAL_BUNDLE_KEYS) ||
    requiredTrue.some((key) => ownData(receipt, key) !== true) ||
    ownData(receipt, "successInvocations") !== 1 ||
    ownData(receipt, "controlledFailureInvocations") !== 1 ||
    ownData(receipt, "catalogTupleCount") !== 1 ||
    ownData(receipt, "failureStage") !== "source-schema"
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_AUTHORITY_INVALID",
      "The actual public Publisher runtime did not preserve the terminal T09 boundary.",
    );
  }
  return Object.freeze({
    apiKeys,
    successKeys,
    failureKeys,
    bundleKeys,
    successInvocations: 1,
    controlledFailureInvocations: 1,
    catalogTupleCount: 1,
    failureStage: "source-schema",
    revisionFormat: true,
    sourceDigestFormat: true,
    revisionClosed: true,
    terminalByteEnvelope: true,
    successDeepFrozen: true,
    failureDeepFrozen: true,
    failureAtomic: true,
    failureDiagnosticsNonEmpty: true,
    failureFirstDiagnosticError: true,
    failureFirstDiagnosticStageMatchesResult: true,
    publicationAbsent: true,
    authoringAbsent: true,
    inputUnchanged: true,
    bundleDetachedFromCandidate: true,
    independentCloneGraph: true,
    independentCloneByteEqual: true,
    privateSeamsAbsent: true,
  });
}

function runtimeProbeSource(sourceText, catalogText) {
  const publisherUrl = pathToFileURL(path.join(ROOT, DISTRIBUTION_INDEX)).href;
  const protocolUrl = pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href;
  return `
const publisher = await import(${JSON.stringify(publisherUrl)});
const protocol = await import(${JSON.stringify(protocolUrl)});
const sourceText = ${JSON.stringify(sourceText)};
const sourceBefore = sourceText;
const catalog = JSON.parse(${JSON.stringify(catalogText)});
const candidate = {
  id: catalog.id,
  version: catalog.version,
  target: catalog.target,
  observedPackageDigest: catalog.packageDigest,
  catalog,
};
const candidateBefore = JSON.stringify(candidate);
function ownValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}
function deeplyFrozen(root) {
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return false;
      }
      pending.push(descriptor.value);
    }
  }
  return true;
}
function graphsDisjoint(left, right) {
  const leftObjects = new Set();
  const pendingLeft = [left];
  const pendingRight = [right];
  while (pendingLeft.length > 0) {
    const value = pendingLeft.pop();
    if (typeof value !== "object" || value === null || leftObjects.has(value)) continue;
    leftObjects.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      pendingLeft.push(ownValue(value, key));
    }
  }
  const seen = new Set();
  while (pendingRight.length > 0) {
    const value = pendingRight.pop();
    if (typeof value !== "object" || value === null || seen.has(value)) continue;
    if (leftObjects.has(value)) return false;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === "length") continue;
      pendingRight.push(ownValue(value, key));
    }
  }
  return true;
}
function bytesEqual(left, right) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
const success = publisher.publishDesenSource(sourceText, [candidate]);
if (ownValue(success, "ok") !== true) throw new TypeError("Expected official-input publication.");
const bundle = ownValue(success, "bundle");
const bundleBytes = protocol.canonicalizeJsonBytes(bundle);
const independentClone = structuredClone(bundle);
const independentBytes = protocol.canonicalizeJsonBytes(independentClone);
const failure = publisher.publishDesenSource("{}", [candidate]);
const forbiddenFailureKeys = [
  "bundle", "value", "source", "catalogSet", "packages", "obligations",
  "pinnedDocument", "sourceDigest", "revision", "publication"
];
const failureDiagnostics = ownValue(failure, "diagnostics");
const failureDiagnosticsLengthDescriptor = Array.isArray(failureDiagnostics)
  ? Object.getOwnPropertyDescriptor(failureDiagnostics, "length")
  : undefined;
const failureDiagnosticsLength =
  failureDiagnosticsLengthDescriptor !== undefined &&
  "value" in failureDiagnosticsLengthDescriptor
    ? failureDiagnosticsLengthDescriptor.value
    : -1;
const firstFailureDiagnostic =
  Number.isSafeInteger(failureDiagnosticsLength) && failureDiagnosticsLength > 0
    ? ownValue(failureDiagnostics, "0")
    : undefined;
const receipt = {
  apiKeys: Object.keys(publisher).sort(),
  authoringAbsent: !Object.hasOwn(bundle, "authoring"),
  bundleDetachedFromCandidate: graphsDisjoint(bundle, candidate),
  bundleKeys: Object.keys(bundle).sort(),
  catalogTupleCount: bundle.requires.catalogs.length,
  failureAtomic:
    ownValue(failure, "ok") === false &&
    Object.keys(failure).sort().join("\\0") === ${JSON.stringify(FAILURE_KEYS.join("\0"))} &&
    forbiddenFailureKeys.every((key) => !Object.hasOwn(failure, key)),
  failureDiagnosticsNonEmpty:
    Array.isArray(failureDiagnostics) &&
    Number.isSafeInteger(failureDiagnosticsLength) &&
    failureDiagnosticsLength > 0,
  failureDeepFrozen: deeplyFrozen(failure),
  failureFirstDiagnosticError:
    typeof firstFailureDiagnostic === "object" &&
    firstFailureDiagnostic !== null &&
    ownValue(firstFailureDiagnostic, "severity") === "error",
  failureFirstDiagnosticStageMatchesResult:
    typeof firstFailureDiagnostic === "object" &&
    firstFailureDiagnostic !== null &&
    ownValue(firstFailureDiagnostic, "stage") === ownValue(failure, "stage"),
  failureKeys: Object.keys(failure).sort(),
  failureStage: ownValue(failure, "stage"),
  independentCloneByteEqual: bytesEqual(bundleBytes, independentBytes),
  independentCloneGraph: graphsDisjoint(bundle, independentClone),
  inputUnchanged: sourceText === sourceBefore && JSON.stringify(candidate) === candidateBefore,
  privateSeamsAbsent:
    !Object.hasOwn(publisher, "publishDesenSourceWithLimits") &&
    !Object.hasOwn(publisher, "PUBLISH_BUNDLE_PUBLICATION_LIMITS") &&
    !Object.hasOwn(publisher, "preflightPublishCatalogPinning"),
  publicationAbsent: !Object.hasOwn(bundle, "publication"),
  revisionClosed: protocol.calculateDesenBundleRevision(bundle) === bundle.revision,
  revisionFormat: /^sha256:[0-9a-f]{64}$/u.test(bundle.revision),
  sourceDigestFormat: /^sha256:[0-9a-f]{64}$/u.test(bundle.sourceDigest),
  successDeepFrozen: deeplyFrozen(success),
  successInvocations: 1,
  successKeys: Object.keys(success).sort(),
  terminalByteEnvelope: bundleBytes.byteLength > 0 && bundleBytes.byteLength <= ${TWO_MIB},
  controlledFailureInvocations: 1,
};
process.stdout.write(JSON.stringify(receipt));
`;
}

let cachedRuntimeReceiptPromise;

async function executeOfficialPublicRuntimeProbe(sourceText, catalogText) {
  if (cachedRuntimeReceiptPromise === undefined) {
    cachedRuntimeReceiptPromise = (async () => {
      try {
        const { stdout, stderr } = await execFileAsync(
          process.execPath,
          ["--input-type=module", "--eval", runtimeProbeSource(sourceText, catalogText)],
          {
            cwd: ROOT,
            timeout: 20_000,
            maxBuffer: 2 * 1024 * 1024,
          },
        );
        if (stderr.trim().length > 0) {
          fail(
            "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_PROBE_FAILED",
            "The isolated public-runtime probe wrote unexpected stderr.",
            { stderr },
          );
        }
        return parseJson(
          stdout,
          "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_PROBE_FAILED",
          "Isolated public-runtime receipt",
        );
      } catch (error) {
        if (error instanceof PublisherBundlePublicationEvidenceError) throw error;
        fail(
          "PUBLISHER_BUNDLE_PUBLICATION_RUNTIME_PROBE_FAILED",
          "The actual packages/publisher/dist/index.js probe failed.",
          {
            message: error instanceof Error ? error.message : String(error),
            stderr: typeof error?.stderr === "string" ? error.stderr : undefined,
          },
        );
      }
    })();
  }
  return cachedRuntimeReceiptPromise;
}

const CI_RECEIPT_KEYS = new Set([
  "planSha256",
  "proofEntries",
  "stepCount",
  "t09Index",
  "t09RootTestSteps",
  "t09VerifierSteps",
]);

function validateCiReceipt(receipt, ciInventory) {
  const exactShape = exactPlainRecord(receipt, CI_RECEIPT_KEYS);
  const historical =
    exactShape &&
    ownData(receipt, "planSha256") === HISTORICAL_CI_RECEIPT.planSha256 &&
    ownData(receipt, "proofEntries") === HISTORICAL_CI_RECEIPT.proofEntries &&
    ownData(receipt, "stepCount") === HISTORICAL_CI_RECEIPT.stepCount &&
    ownData(receipt, "t09Index") === HISTORICAL_CI_RECEIPT.t09Index &&
    ownData(receipt, "t09VerifierSteps") === HISTORICAL_CI_RECEIPT.t09VerifierSteps &&
    ownData(receipt, "t09RootTestSteps") === HISTORICAL_CI_RECEIPT.t09RootTestSteps;
  const current =
    exactShape &&
    ownData(receipt, "planSha256") === ciInventory.planHash &&
    ownData(receipt, "proofEntries") === ciInventory.entries.length &&
    ownData(receipt, "stepCount") === 8 + ciInventory.entries.length * 2 &&
    ownData(receipt, "t09Index") === ciInventory.t09Index &&
    ownData(receipt, "t09VerifierSteps") === 1 &&
    ownData(receipt, "t09RootTestSteps") === 1;
  if (!historical && !current) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT",
      "The single-pass CI receipt matches neither frozen T09 evidence nor its authenticated live successor inventory.",
    );
  }
  if (historical) return HISTORICAL_CI_RECEIPT;
  return Object.freeze({
    planSha256: ownData(receipt, "planSha256"),
    proofEntries: ownData(receipt, "proofEntries"),
    stepCount: ownData(receipt, "stepCount"),
    t09Index: ownData(receipt, "t09Index"),
    t09VerifierSteps: 1,
    t09RootTestSteps: 1,
  });
}

let cachedCiReceiptPromise;

async function executeLiveCiProbe() {
  if (cachedCiReceiptPromise === undefined) {
    cachedCiReceiptPromise = (async () => {
      const ciUrl = pathToFileURL(path.join(ROOT, CI_SOURCE)).href;
      const probe = `
const ci = await import(${JSON.stringify(ciUrl)});
const steps = ci.createQualityGateSteps();
const validation = ci.validateQualityGatePlan(steps);
const t09Index = ci.PROOF_ENTRIES.findIndex(({ id }) => id === "publisher-bundle-publication");
const receipt = {
  planSha256: validation.planSha256,
  proofEntries: ci.PROOF_ENTRIES.length,
  stepCount: validation.stepCount,
  t09Index,
  t09RootTestSteps: steps.filter(({ id }) => id === "test-publisher-bundle-publication").length,
  t09VerifierSteps: steps.filter(({ id }) => id === "verify-publisher-bundle-publication").length,
};
process.stdout.write(JSON.stringify(receipt));
`;
      try {
        const { stdout, stderr } = await execFileAsync(
          process.execPath,
          ["--input-type=module", "--eval", probe],
          {
            cwd: ROOT,
            timeout: 20_000,
            maxBuffer: 1024 * 1024,
          },
        );
        if (stderr.trim().length > 0) {
          fail(
            "PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT",
            "The live CI plan probe wrote unexpected stderr.",
            { stderr },
          );
        }
        return parseJson(
          stdout,
          "PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT",
          "Live CI plan receipt",
        );
      } catch (error) {
        if (error instanceof PublisherBundlePublicationEvidenceError) throw error;
        fail(
          "PUBLISHER_BUNDLE_PUBLICATION_CI_RUNTIME_DRIFT",
          "The live single-pass CI plan could not authenticate T09.",
          {
            message: error instanceof Error ? error.message : String(error),
            stderr: typeof error?.stderr === "string" ? error.stderr : undefined,
          },
        );
      }
    })();
  }
  return cachedCiReceiptPromise;
}

function assertImplementationParity(sourceAudit, distributionAudit) {
  const parityProjection = (audit) => ({
    callCounts: audit.callCounts,
    callOrder: audit.callOrder,
    validatorReceivesExactCatalogSet: audit.validatorReceivesExactCatalogSet,
    validatorSnapshotMustBeIndependent: audit.validatorSnapshotMustBeIndependent,
    validatorSnapshotCanonicalBytesMustEqualCandidate:
      audit.validatorSnapshotCanonicalBytesMustEqualCandidate,
    completeBundleLimitChecks: audit.completeBundleLimitChecks,
    maximumCanonicalBytes: audit.maximumCanonicalBytes,
    revisionClosure: audit.revisionClosure,
    exactFrozenSuccessKeys: audit.exactFrozenSuccessKeys,
    exactAtomicFailureKeys: audit.exactAtomicFailureKeys,
    candidate: audit.candidate,
    publicWrapperArguments: audit.publicWrapperArguments,
  });
  if (
    JSON.stringify(parityProjection(sourceAudit)) !==
    JSON.stringify(parityProjection(distributionAudit))
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_DISTRIBUTION_DRIFT",
      "Source and built terminal Publisher AST claims no longer agree.",
    );
  }
  return Object.freeze({
    sourceAndDistributionAgree: true,
    ...parityProjection(sourceAudit),
  });
}

export async function buildPublisherBundlePublicationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const prerequisites = await prerequisiteClaims(options);
  const trackedPairs = await Promise.all(
    TRACKED.map(async (relativePath) => {
      const input = await trackedInput(options, relativePath);
      return Object.freeze({ relativePath, ...input });
    }),
  );
  const bytesByPath = new Map(trackedPairs.map(({ relativePath, bytes }) => [relativePath, bytes]));
  const text = (relativePath) => {
    const bytes = bytesByPath.get(relativePath);
    if (bytes === undefined) {
      fail("PUBLISHER_BUNDLE_PUBLICATION_FILE_DRIFT", "An audited tracked file was not captured.", {
        relativePath,
      });
    }
    return decodeUtf8(
      bytes,
      "PUBLISHER_BUNDLE_PUBLICATION_UTF8_INVALID",
      "Tracked Bundle-publication text",
      { relativePath },
    );
  };

  const sourceAudit = implementationAudit(text(SOURCE), SOURCE, ts.ScriptKind.TS);
  const distributionAudit = implementationAudit(text(DISTRIBUTION), DISTRIBUTION, ts.ScriptKind.JS);
  const implementation = assertImplementationParity(sourceAudit, distributionAudit);
  const publicApi = publicApiAudit(
    text(SOURCE_INDEX),
    text(DISTRIBUTION_INDEX),
    text(PUBLIC_DECLARATION),
    text(DECLARATION),
    text(PUBLISHER_PACKAGE),
  );
  const ciInventory = extractCiInventory(text(CI_SOURCE));
  const registrations = registrationClaims(
    text(ROOT_PACKAGE),
    text(PUBLISHER_PACKAGE),
    text(CI_WORKFLOW),
    ciInventory,
  );
  validateCiReceipt(options.ciReceipt ?? (await executeLiveCiProbe()), ciInventory);
  const runtimeReceipt = validateRuntimeReceipt(
    options.runtimeReceipt ??
      (await executeOfficialPublicRuntimeProbe(text(SOURCE_FIXTURE), text(CATALOG_FIXTURE))),
  );
  const tests = testInventoryClaims(text(RUNTIME_TEST), text(TYPE_TEST), text(ROOT_TEST));
  const traceabilityOwnership = traceabilityClaims(text(TRACEABILITY));
  const trackedFiles = Object.freeze(
    trackedPairs.map(({ relativePath, bytes, overridden }) => {
      const historical = overridden ? undefined : HISTORICAL_TRACKED_RECEIPTS[relativePath];
      return historical === undefined
        ? Object.freeze({
            path: relativePath,
            bytes: bytes.byteLength,
            sha256: sha256(bytes),
          })
        : Object.freeze({ path: relativePath, ...historical });
    }),
  );
  const compatibilityReaders = Object.freeze(
    PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_READERS.map((readerPath) => {
      const tracked = trackedFiles.find(({ path: trackedPath }) => trackedPath === readerPath);
      if (tracked === undefined) {
        fail(
          "PUBLISHER_BUNDLE_PUBLICATION_COMPATIBILITY_DRIFT",
          "A T02–T08 compatibility reader is not externally tracked.",
          { readerPath },
        );
      }
      return Object.freeze({ path: readerPath, sha256: tracked.sha256 });
    }),
  );

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.bundle-publication-proof.v1",
    task: "M06-T09",
    result: "PASS",
    summary:
      "The built public Publisher composes T08 exactly once, validates one revision-only complete Bundle through the exact Catalog set and twice-enforced 2 MiB canonical-byte envelope, and returns only a revision-closed immutable Validator snapshot or an atomic failure shell.",
    prerequisites,
    claims: Object.freeze({
      implementation,
      publicApi,
      singleOfficialInputPublicRuntimeProbe: runtimeReceipt,
      registrations,
      traceabilityOwnership,
      compatibilityReaders,
      terminalBoundary: Object.freeze({
        predecessorInvocations: 1,
        provisionalRevisionInvocations: 1,
        closureRevisionInvocations: 1,
        completeCanonicalByteMeasurements: 2,
        validatorInvocations: 1,
        maximumCompleteBundleCanonicalUtf8Bytes: TWO_MIB,
        candidateContainsOnlyRevisionAsTerminalAddition: true,
        publicationMetadataAbsent: true,
        validatorReceivesExactCatalogSet: true,
        validatorSnapshotGraphIndependenceRequired: true,
        validatorSnapshotCanonicalByteEqualityRequired: true,
        revisionClosureRequired: true,
        exactImmutableSuccess: Object.freeze({ keys: SUCCESS_KEYS }),
        exactAtomicFailure: Object.freeze({ keys: FAILURE_KEYS, partialBundleAbsent: true }),
      }),
    }),
    trackedFiles,
    tests,
    nonclaims: Object.freeze([
      "M06-T09 does not compare against an official frozen Bundle golden and does not prove repeated-publication byte equality; M06-T10 owns both claims.",
      "M06-T09 exercises one controlled failure shell but does not prove the invalid-source matrix or the no-emission gate; M06-T11 owns that matrix.",
      "No publication metadata, signing, storage, activation, deployment, runtime, host, or adapter authority is produced.",
    ]),
    reproduction: Object.freeze([
      "pnpm verify:publisher-catalog-pinning",
      "pnpm --filter @desen/publisher... build",
      "pnpm --filter @desen/validator test:execution-contracts",
      "pnpm --filter @desen/publisher typecheck",
      "pnpm --filter @desen/publisher test:bundle-publication",
      "node scripts/generate-publisher-bundle-publication-proof.mjs",
      "node scripts/verify-publisher-bundle-publication.mjs",
      "node --test tests/publisher-bundle-publication.test.mjs",
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
      "PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT",
      "The T09 proof document must contain one exact artifact path and final SHA-256 pin.",
      { pathCount, hashCount },
    );
  }
}

export async function verifyPublisherBundlePublicationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const built = await buildPublisherBundlePublicationEvidence(options);
  if (options.artifactBytes !== undefined && options.artifactPath !== undefined) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "Verification accepts artifact bytes or an artifact path, never both.",
    );
  }
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "The verification artifact path must be text.",
    );
  }
  const artifactByteInput =
    options.artifactBytes ??
    (await readRegularAbsoluteBytes(
      path.resolve(artifactPath),
      "PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT",
      "Tracked Bundle-publication artifact",
      Object.freeze({ artifactPath: path.resolve(artifactPath) }),
    ));
  const artifactBytes = captureInertBytes(
    artifactByteInput,
    options.artifactBytes === undefined
      ? "PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT"
      : "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
    options.artifactBytes === undefined
      ? "Tracked Bundle-publication artifact"
      : "Bundle-publication artifact byte override",
  );
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_DRIFT",
      "Tracked T09 evidence differs from a fresh production build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256: sha256(artifactBytes),
      },
    );
  }

  if (options.proofDocument !== undefined && options.proofDocumentPath !== undefined) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "Verification accepts proof text or a proof-document path, never both.",
    );
  }
  const proofDocumentPath = options.proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT);
  if (typeof proofDocumentPath !== "string") {
    fail("PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID", "The proof-document path must be text.");
  }
  const proofDocument =
    options.proofDocument ??
    decodeUtf8(
      await readRegularAbsoluteBytes(
        path.resolve(proofDocumentPath),
        "PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT",
        "Bundle-publication proof document",
        Object.freeze({ proofDocumentPath: path.resolve(proofDocumentPath) }),
      ),
      "PUBLISHER_BUNDLE_PUBLICATION_PROOF_DOCUMENT_DRIFT",
      "Bundle-publication proof document",
      { proofDocumentPath: path.resolve(proofDocumentPath) },
    );
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "The proof-document override must be text.",
    );
  }
  assertProofDocumentPin(proofDocument, built.artifactSha256);
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.trackedFiles.length,
    compatibilityReaders: built.artifact.claims.compatibilityReaders.length,
    traceRows: built.artifact.claims.traceabilityOwnership.rows.length,
    proofDocumentPinned: true,
  });
}

export async function writePublisherBundlePublicationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  const semanticOverrideKeys = Reflect.ownKeys(options).filter(
    (key) => !["artifactPath", "beforeAtomicRename"].includes(key),
  );
  if (semanticOverrideKeys.length > 0) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OFFICIAL_WRITE_OVERRIDE",
      "Official T09 evidence may only use tracked production inputs.",
      { semanticOverrideKeys },
    );
  }
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_BUNDLE_PUBLICATION_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "The T09 artifact destination must be a path string.",
    );
  }
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "PUBLISHER_BUNDLE_PUBLICATION_OPTIONS_INVALID",
      "The atomic writer hook must be callable.",
    );
  }
  const built = await buildPublisherBundlePublicationEvidence();
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
