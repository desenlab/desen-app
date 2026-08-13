import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/publisher-0.1.0-official-golden.json";
const PROOF_DOCUMENT = "docs/proof/PUBLISHER-OFFICIAL-GOLDEN.md";
const SOURCE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const BUNDLE_FIXTURE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
const VECTOR_MANIFEST = "packages/protocol/upstream/0.1.0/snapshot/conformance/vectors.json";
const PUBLISHER_DISTRIBUTION_INDEX = "packages/publisher/dist/index.js";
const PUBLISHER_DISTRIBUTION_IMPLEMENTATION = "packages/publisher/dist/bundle-publication.js";
const PROTOCOL_DISTRIBUTION_INDEX = "packages/protocol/dist/index.js";
const PROTOCOL_CANONICALIZATION = "packages/protocol/dist/canonicalization.js";
const RUNTIME_TEST = "packages/publisher/test/official-golden.test.ts";
const ROOT_PACKAGE = "package.json";
const PUBLISHER_PACKAGE = "packages/publisher/package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_CONTRACT_TEST = "scripts/test/ci-quality-gate.test.mjs";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const GENERATOR = "scripts/generate-publisher-official-golden-proof.mjs";
const VERIFIER = "scripts/verify-publisher-official-golden.mjs";
const PROOF_LIBRARY = "scripts/lib/publisher-official-golden-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/publisher-official-golden.test.mjs";

const EXPECTED_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const EXPECTED_SOURCE_DIGEST =
  "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878";
const EXPECTED_CANONICAL_SHA256 =
  "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";
const EXPECTED_CANONICAL_BYTES = 2_173;
const EXPECTED_CANONICAL_BASE64_LENGTH = 2_900;
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

export const PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M06-T09",
    path: "docs/proof/artifacts/publisher-0.1.0-bundle-publication.json",
    sha256: "2942aa84066354ee7c27557263a900eb8fd3a149d085ab55c7f880dcfca998df",
  }),
  Object.freeze({
    task: "M02-T01",
    path: "docs/proof/artifacts/protocol-0.1.0-snapshot.json",
    sha256: "aaf58f79bc95924fbaa0c2b278cc06f3d28b3986e5d168b5468e6432c04cd5a9",
  }),
  Object.freeze({
    task: "M02-T04",
    path: "docs/proof/artifacts/protocol-0.1.0-canonicalization.json",
    sha256: "8da65b96973ee2a592735a6868f45ac1f1d0d059114902769a390fe7de33dcc6",
  }),
  Object.freeze({
    task: "M02-T12",
    path: "docs/proof/artifacts/protocol-0.1.0-official-suite-parity.json",
    sha256: "efa6b4ed014b942d45d621ffc77c47e76d82dd6965deb13cf677c6bebf7a76ae",
  }),
]);

export const PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS = Object.freeze([
  Object.freeze({
    role: "officialSource",
    path: SOURCE_FIXTURE,
    sha256: "c4b81882420d1b861dbf421da30c1447558560401f697fb7e3883fd6aaf0f7e1",
  }),
  Object.freeze({
    role: "officialCatalog",
    path: CATALOG_FIXTURE,
    sha256: "7b9a8bad7b49340dc2a5f818ac008feb403fb43c8c476eecba5e1fcbdf3bf45d",
  }),
  Object.freeze({
    role: "officialBundle",
    path: BUNDLE_FIXTURE,
    sha256: "96be7f18b7b825110d7ba3703c15124ab7a09b9926b01cde43633915eaaf2edf",
  }),
  Object.freeze({
    role: "officialVectors",
    path: VECTOR_MANIFEST,
    sha256: "19cd13718234f8a95b83b6f7725985529e5b134f8fe7b636b9433c16696096e8",
  }),
]);

const TRACKED = Object.freeze([
  ...PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS.map(({ path: inputPath }) => inputPath),
  PUBLISHER_DISTRIBUTION_INDEX,
  PUBLISHER_DISTRIBUTION_IMPLEMENTATION,
  PROTOCOL_DISTRIBUTION_INDEX,
  PROTOCOL_CANONICALIZATION,
  RUNTIME_TEST,
  ROOT_PACKAGE,
  PUBLISHER_PACKAGE,
  CI_SOURCE,
  CI_CONTRACT_TEST,
  CI_WORKFLOW,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
]);

const TRACKED_SET = new Set(TRACKED);
const PREREQUISITE_SET = new Set(
  PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS.map(({ path: prerequisitePath }) => prerequisitePath),
);
const OPTION_KEYS = new Set([
  "artifactBytes",
  "artifactPath",
  "beforeAtomicRename",
  "prerequisiteBytes",
  "proofDocument",
  "proofDocumentPath",
  "runtimeReceipt",
  "trackedFileBytes",
]);
const BUILD_OPTION_KEYS = new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]);
const VERIFY_OPTION_KEYS = new Set([
  ...BUILD_OPTION_KEYS,
  "artifactBytes",
  "artifactPath",
  "proofDocument",
  "proofDocumentPath",
]);
const WRITE_OPTION_KEYS = new Set(["artifactPath", "beforeAtomicRename"]);
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
const BUNDLE_KEYS = Object.freeze([
  "desen",
  "entry",
  "extensions",
  "id",
  "kind",
  "requires",
  "revision",
  "sourceDigest",
  "surfaces",
]);
const RUNTIME_RECEIPT_KEYS = new Set([
  "apiKeys",
  "authoringAbsentBoth",
  "bundleKeysA",
  "bundleKeysB",
  "candidateGraphsFresh",
  "canonicalBase64A",
  "canonicalBase64B",
  "canonicalBase64Official",
  "catalogGraphsFresh",
  "catalogTupleCountA",
  "catalogTupleCountB",
  "diagnosticsEmptyBoth",
  "inputOutputGraphsDisjoint",
  "inputsUnchanged",
  "invocations",
  "officialGraphIndependent",
  "officialPublicationAbsentAfterRemoval",
  "officialRemovedRootKeys",
  "officialRootPublicationOwnData",
  "privateSeamsAbsent",
  "protocolCanonicalizerPublic",
  "publicationAbsentBoth",
  "resultGraphsFresh",
  "resultsDeepFrozen",
  "revisionA",
  "revisionB",
  "revisionOfficial",
  "sourceDigestA",
  "sourceDigestB",
  "sourceDigestOfficial",
  "successKeysA",
  "successKeysB",
]);

export const DEFAULT_PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class PublisherOfficialGoldenEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PublisherOfficialGoldenEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new PublisherOfficialGoldenEvidenceError(code, message, details);
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

function exactOwnDataOptions(rawOptions) {
  if (rawOptions === undefined) return Object.freeze({});
  if (!exactPlainRecord(rawOptions, OPTION_KEYS, new Set())) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "Official-golden evidence options must be one exact inert own-data record.",
    );
  }
  const captured = {};
  for (const key of Reflect.ownKeys(rawOptions)) captured[key] = ownData(rawOptions, key);
  return Object.freeze(captured);
}

function assertOperationOptions(options, allowedKeys, code, message) {
  const unsupportedKeys = Reflect.ownKeys(options).filter(
    (key) => typeof key !== "string" || !allowedKeys.has(key),
  );
  if (unsupportedKeys.length > 0) fail(code, message, { unsupportedKeys });
}

function captureDenseOwnStringArray(value, label) {
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
      lengthDescriptor.value > 64
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
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      `${label} must be one exact ordinary dense own-data string array.`,
    );
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

async function authenticatedFrozenArtifactProjection() {
  const authority = await readCheckpointedFrozenArtifact("M06-T10");
  if (authority.path !== ARTIFACT) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T10 artifact path drifted.",
    );
  }
  const artifact = parseJson(
    decodeUtf8(
      authority.bytes,
      "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
      "Checkpoint-authenticated M06-T10 artifact",
    ),
    "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
    "Checkpoint-authenticated M06-T10 artifact",
  );
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.profile !== "desen.publisher.official-golden-proof.v1" ||
    artifact.task !== "M06-T10" ||
    artifact.result !== "PASS" ||
    !Array.isArray(artifact.trackedFiles) ||
    artifact.trackedFiles.length !== TRACKED.length ||
    artifact.claims?.registrations === null ||
    typeof artifact.claims?.registrations !== "object" ||
    Array.isArray(artifact.claims?.registrations) ||
    artifact.tests === null ||
    typeof artifact.tests !== "object" ||
    Array.isArray(artifact.tests) ||
    !Array.isArray(artifact.tests.publisherRuntimeCaseNames) ||
    artifact.tests.publisherRuntimeCaseNames.length === 0 ||
    !Array.isArray(artifact.tests.requiredRootCaseNames) ||
    artifact.tests.requiredRootCaseNames.length === 0 ||
    !Number.isSafeInteger(artifact.tests.minimumRootMutationCases) ||
    artifact.tests.minimumRootMutationCases <= 0
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M06-T10 artifact identity or inventory drifted.",
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
        "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
        "A checkpoint-authenticated M06-T10 tracked receipt drifted.",
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
    registrations: deepFreeze(artifact.claims.registrations),
    tests: deepFreeze(artifact.tests),
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
    if (error instanceof PublisherOfficialGoldenEvidenceError) throw error;
    fail(code, `${label} could not be opened as one regular non-symbolic file.`, details);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readRegularBytes(relativePath, code = "PUBLISHER_OFFICIAL_GOLDEN_FILE_DRIFT") {
  return readRegularAbsoluteBytes(
    path.join(ROOT, relativePath),
    code,
    "Official-golden evidence input",
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
          "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
          `Official-golden byte override for ${relativePath}`,
        );
  } catch (error) {
    if (error instanceof PublisherOfficialGoldenEvidenceError) throw error;
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "Official-golden byte overrides must be exact inert Buffer or Uint8Array entries.",
      { relativePath },
    );
  }
}

async function prerequisiteClaims(options) {
  const claims = [];
  for (const pin of PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_PINS) {
    const bytes =
      readOverrideMap(options.prerequisiteBytes, pin.path, PREREQUISITE_SET) ??
      (await readRegularBytes(pin.path, "PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT"));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== pin.sha256) {
      fail(
        "PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT",
        "An immutable T10 prerequisite artifact changed.",
        { task: pin.task, path: pin.path, expectedSha256: pin.sha256, actualSha256 },
      );
    }
    const artifact = parseJson(
      decodeUtf8(
        bytes,
        "PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT",
        "Official-golden prerequisite artifact",
        { path: pin.path },
      ),
      "PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT",
      "Official-golden prerequisite artifact",
    );
    if (ownData(artifact, "task") !== pin.task) {
      fail(
        "PUBLISHER_OFFICIAL_GOLDEN_PREREQUISITE_DRIFT",
        "A prerequisite artifact does not identify its pinned task.",
        { task: pin.task, path: pin.path },
      );
    }
    claims.push(Object.freeze({ ...pin, verifiedSha256: actualSha256 }));
  }
  return Object.freeze(claims);
}

function assertFrozenInputs(bytesByPath) {
  const claims = [];
  for (const input of PUBLISHER_OFFICIAL_GOLDEN_FROZEN_INPUTS) {
    const bytes = bytesByPath.get(input.path);
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== input.sha256) {
      fail(
        "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
        "A frozen official 0.1.0 fixture or vector manifest changed.",
        { role: input.role, path: input.path, expectedSha256: input.sha256, actualSha256 },
      );
    }
    claims.push(
      Object.freeze({
        role: input.role,
        path: input.path,
        bytes: bytes.byteLength,
        sha256: actualSha256,
      }),
    );
  }

  const text = (relativePath) =>
    decodeUtf8(
      bytesByPath.get(relativePath),
      "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
      "Frozen official input",
      { relativePath },
    );
  const source = parseJson(
    text(SOURCE_FIXTURE),
    "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
    "Official Source",
  );
  const catalog = parseJson(
    text(CATALOG_FIXTURE),
    "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
    "Official Catalog",
  );
  const bundle = parseJson(
    text(BUNDLE_FIXTURE),
    "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
    "Official Bundle",
  );
  const vectors = parseJson(
    text(VECTOR_MANIFEST),
    "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
    "Official vector manifest",
  );
  const vectorRows = ownData(vectors, "vectors");
  const expectedValidRows = [
    ["valid/sign-in.source.json", "source"],
    ["valid/sign-in.bundle.json", "bundle"],
    ["valid/web.catalog.json", "catalog"],
  ];
  if (
    ownData(source, "kind") !== "desen.source" ||
    ownData(source, "id") !== "com.example.account-app" ||
    ownData(catalog, "kind") !== "desen.catalog" ||
    ownData(catalog, "id") !== "com.example.web-catalog" ||
    ownData(catalog, "version") !== "1.0.0" ||
    ownData(catalog, "target") !== "web-react" ||
    ownData(bundle, "kind") !== "desen.bundle" ||
    ownData(bundle, "revision") !== EXPECTED_REVISION ||
    ownData(bundle, "sourceDigest") !== EXPECTED_SOURCE_DIGEST ||
    !Object.hasOwn(bundle, "publication") ||
    ownData(vectors, "version") !== "0.1.0" ||
    ownData(vectors, "catalog") !== "valid/web.catalog.json" ||
    !Array.isArray(vectorRows) ||
    vectorRows.length !== 9 ||
    expectedValidRows.some(
      ([file, target]) =>
        vectorRows.filter(
          (row) =>
            ownData(row, "file") === file &&
            ownData(row, "target") === target &&
            ownData(row, "expect") === "valid",
        ).length !== 1,
    )
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_FIXTURE_DRIFT",
      "Frozen official Source, Catalog, Bundle, and vector semantics no longer identify one golden.",
    );
  }
  return Object.freeze({
    claims: Object.freeze(claims),
    sourceText: text(SOURCE_FIXTURE),
    catalogText: text(CATALOG_FIXTURE),
    bundleText: text(BUNDLE_FIXTURE),
    vectorManifest: Object.freeze({
      version: "0.1.0",
      catalog: "valid/web.catalog.json",
      cases: 9,
      officialValidRows: 3,
    }),
  });
}

function sameStrings(left, right) {
  return JSON.stringify([...left]) === JSON.stringify([...right]);
}

function decodeExactBase64(value, label) {
  if (
    typeof value !== "string" ||
    value.length !== EXPECTED_CANONICAL_BASE64_LENGTH ||
    value.length % 4 !== 0
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      `${label} must be nonempty canonical base64 text.`,
    );
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      `${label} must be exact canonical base64 text.`,
    );
  }
  return new Uint8Array(bytes);
}

function validateRuntimeReceipt(receipt) {
  if (!exactPlainRecord(receipt, RUNTIME_RECEIPT_KEYS)) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      "The isolated public-runtime probe returned a malformed authority receipt.",
    );
  }
  const apiKeys = captureDenseOwnStringArray(ownData(receipt, "apiKeys"), "Public API keys");
  const successKeysA = captureDenseOwnStringArray(
    ownData(receipt, "successKeysA"),
    "First publication success keys",
  );
  const successKeysB = captureDenseOwnStringArray(
    ownData(receipt, "successKeysB"),
    "Second publication success keys",
  );
  const bundleKeysA = captureDenseOwnStringArray(
    ownData(receipt, "bundleKeysA"),
    "First publication Bundle keys",
  );
  const bundleKeysB = captureDenseOwnStringArray(
    ownData(receipt, "bundleKeysB"),
    "Second publication Bundle keys",
  );
  const officialRemovedRootKeys = captureDenseOwnStringArray(
    ownData(receipt, "officialRemovedRootKeys"),
    "Official golden removed root keys",
  );
  const canonicalBytesA = decodeExactBase64(
    ownData(receipt, "canonicalBase64A"),
    "First publication canonical bytes",
  );
  const canonicalBytesB = decodeExactBase64(
    ownData(receipt, "canonicalBase64B"),
    "Second publication canonical bytes",
  );
  const canonicalBytesOfficial = decodeExactBase64(
    ownData(receipt, "canonicalBase64Official"),
    "Official golden canonical bytes",
  );
  const requiredTrue = [
    "authoringAbsentBoth",
    "candidateGraphsFresh",
    "catalogGraphsFresh",
    "diagnosticsEmptyBoth",
    "inputOutputGraphsDisjoint",
    "inputsUnchanged",
    "officialGraphIndependent",
    "officialPublicationAbsentAfterRemoval",
    "officialRootPublicationOwnData",
    "privateSeamsAbsent",
    "protocolCanonicalizerPublic",
    "publicationAbsentBoth",
    "resultGraphsFresh",
    "resultsDeepFrozen",
  ];
  const revisions = [
    ownData(receipt, "revisionA"),
    ownData(receipt, "revisionB"),
    ownData(receipt, "revisionOfficial"),
  ];
  const sourceDigests = [
    ownData(receipt, "sourceDigestA"),
    ownData(receipt, "sourceDigestB"),
    ownData(receipt, "sourceDigestOfficial"),
  ];
  if (
    !sameStrings(apiKeys, EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    !sameStrings(successKeysA, SUCCESS_KEYS) ||
    !sameStrings(successKeysB, SUCCESS_KEYS) ||
    !sameStrings(bundleKeysA, BUNDLE_KEYS) ||
    !sameStrings(bundleKeysB, BUNDLE_KEYS) ||
    !sameStrings(officialRemovedRootKeys, ["publication"]) ||
    requiredTrue.some((key) => ownData(receipt, key) !== true) ||
    ownData(receipt, "invocations") !== 2 ||
    ownData(receipt, "catalogTupleCountA") !== 1 ||
    ownData(receipt, "catalogTupleCountB") !== 1 ||
    revisions.some((revision) => revision !== EXPECTED_REVISION) ||
    sourceDigests.some((sourceDigest) => sourceDigest !== EXPECTED_SOURCE_DIGEST) ||
    canonicalBytesA.byteLength !== EXPECTED_CANONICAL_BYTES ||
    canonicalBytesB.byteLength !== EXPECTED_CANONICAL_BYTES ||
    canonicalBytesOfficial.byteLength !== EXPECTED_CANONICAL_BYTES ||
    sha256(canonicalBytesA) !== EXPECTED_CANONICAL_SHA256 ||
    sha256(canonicalBytesB) !== EXPECTED_CANONICAL_SHA256 ||
    sha256(canonicalBytesOfficial) !== EXPECTED_CANONICAL_SHA256 ||
    !byteEqual(canonicalBytesA, canonicalBytesB) ||
    !byteEqual(canonicalBytesA, canonicalBytesOfficial) ||
    !byteEqual(canonicalBytesB, canonicalBytesOfficial)
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      "Two fresh public Publisher calls did not reproduce the exact frozen official Bundle.",
    );
  }
  return Object.freeze({
    raw: deepFreeze({
      ...receipt,
      apiKeys,
      successKeysA,
      successKeysB,
      bundleKeysA,
      bundleKeysB,
      officialRemovedRootKeys,
    }),
    claim: deepFreeze({
      publicPackageRoot: PUBLISHER_DISTRIBUTION_INDEX,
      publicOperation: "publishDesenSource",
      isolatedProcesses: 1,
      freshPublicationInvocations: 2,
      freshCatalogGraphs: 2,
      freshCandidateGraphs: 2,
      freshResultGraphs: 2,
      canonicalization: "RFC 8785 canonical UTF-8 through the built Protocol package root",
      firstPublication: {
        canonicalBytes: canonicalBytesA.byteLength,
        canonicalSha256: sha256(canonicalBytesA),
        revision: EXPECTED_REVISION,
        sourceDigest: EXPECTED_SOURCE_DIGEST,
      },
      secondPublication: {
        canonicalBytes: canonicalBytesB.byteLength,
        canonicalSha256: sha256(canonicalBytesB),
        revision: EXPECTED_REVISION,
        sourceDigest: EXPECTED_SOURCE_DIGEST,
      },
      officialBundleWithoutRootPublication: {
        removedRootKeys: ["publication"],
        canonicalBytes: canonicalBytesOfficial.byteLength,
        canonicalSha256: sha256(canonicalBytesOfficial),
        revision: EXPECTED_REVISION,
        sourceDigest: EXPECTED_SOURCE_DIGEST,
      },
      comparisons: {
        firstEqualsSecondCanonicalBytes: true,
        firstEqualsOfficialCanonicalBytes: true,
        secondEqualsOfficialCanonicalBytes: true,
        revisionsExactAcrossAllThree: true,
        sourceDigestsExactAcrossAllThree: true,
      },
      immutableIndependentResults: true,
      inputOutputGraphsDisjoint: true,
      inputsUnchanged: true,
      publicationMetadataAbsentFromBothOutputs: true,
      authoringAbsentFromBothOutputs: true,
      privatePublisherSeamsAbsent: true,
    }),
  });
}

function runtimeProbeSource(sourceText, catalogText, bundleText) {
  const publisherUrl = pathToFileURL(path.join(ROOT, PUBLISHER_DISTRIBUTION_INDEX)).href;
  const protocolUrl = pathToFileURL(path.join(ROOT, PROTOCOL_DISTRIBUTION_INDEX)).href;
  return `
const publisher = await import(${JSON.stringify(publisherUrl)});
const protocol = await import(${JSON.stringify(protocolUrl)});
const sourceText = ${JSON.stringify(sourceText)};
const catalogText = ${JSON.stringify(catalogText)};
const bundleText = ${JSON.stringify(bundleText)};
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
function makeInput() {
  const catalog = JSON.parse(catalogText);
  const candidate = {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
  };
  return { catalog, candidate, candidates: [candidate] };
}
const inputA = makeInput();
const inputB = makeInput();
const beforeA = JSON.stringify(inputA);
const beforeB = JSON.stringify(inputB);
const resultA = publisher.publishDesenSource(sourceText, inputA.candidates);
const resultB = publisher.publishDesenSource(sourceText, inputB.candidates);
if (ownValue(resultA, "ok") !== true || ownValue(resultB, "ok") !== true) {
  throw new TypeError("Expected two official public publication successes.");
}
const bundleA = ownValue(resultA, "bundle");
const bundleB = ownValue(resultB, "bundle");
const official = JSON.parse(bundleText);
const officialPublicationDescriptor = Object.getOwnPropertyDescriptor(official, "publication");
const officialKeysBefore = Object.keys(official);
const officialRootPublicationOwnData =
  officialPublicationDescriptor !== undefined &&
  officialPublicationDescriptor.enumerable &&
  "value" in officialPublicationDescriptor;
const publicationDeleted = delete official.publication;
const officialKeysAfter = Object.keys(official);
const officialRemovedRootKeys = officialKeysBefore
  .filter((key) => !officialKeysAfter.includes(key))
  .sort();
const canonicalA = protocol.canonicalizeJsonBytes(bundleA);
const canonicalB = protocol.canonicalizeJsonBytes(bundleB);
const canonicalOfficial = protocol.canonicalizeJsonBytes(official);
const receipt = {
  apiKeys: Object.keys(publisher).sort(),
  authoringAbsentBoth: !Object.hasOwn(bundleA, "authoring") && !Object.hasOwn(bundleB, "authoring"),
  bundleKeysA: Object.keys(bundleA).sort(),
  bundleKeysB: Object.keys(bundleB).sort(),
  candidateGraphsFresh:
    inputA.candidates !== inputB.candidates &&
    inputA.candidate !== inputB.candidate &&
    graphsDisjoint(inputA.candidates, inputB.candidates),
  canonicalBase64A: Buffer.from(canonicalA).toString("base64"),
  canonicalBase64B: Buffer.from(canonicalB).toString("base64"),
  canonicalBase64Official: Buffer.from(canonicalOfficial).toString("base64"),
  catalogGraphsFresh:
    inputA.catalog !== inputB.catalog && graphsDisjoint(inputA.catalog, inputB.catalog),
  catalogTupleCountA: bundleA.requires.catalogs.length,
  catalogTupleCountB: bundleB.requires.catalogs.length,
  diagnosticsEmptyBoth:
    ownValue(resultA, "diagnostics").length === 0 &&
    ownValue(resultB, "diagnostics").length === 0,
  inputOutputGraphsDisjoint:
    graphsDisjoint(inputA, resultA) &&
    graphsDisjoint(inputB, resultB) &&
    graphsDisjoint(inputA, resultB) &&
    graphsDisjoint(inputB, resultA),
  inputsUnchanged:
    sourceText === ${JSON.stringify(sourceText)} &&
    JSON.stringify(inputA) === beforeA &&
    JSON.stringify(inputB) === beforeB,
  invocations: 2,
  officialGraphIndependent:
    graphsDisjoint(bundleA, official) &&
    graphsDisjoint(bundleB, official) &&
    graphsDisjoint(bundleA, bundleB),
  officialPublicationAbsentAfterRemoval:
    publicationDeleted && !Object.hasOwn(official, "publication"),
  officialRemovedRootKeys,
  officialRootPublicationOwnData,
  privateSeamsAbsent:
    !Object.hasOwn(publisher, "publishDesenSourceWithLimits") &&
    !Object.hasOwn(publisher, "PUBLISH_BUNDLE_PUBLICATION_LIMITS") &&
    !Object.hasOwn(publisher, "preflightPublishCatalogPinning"),
  protocolCanonicalizerPublic: typeof protocol.canonicalizeJsonBytes === "function",
  publicationAbsentBoth:
    !Object.hasOwn(bundleA, "publication") && !Object.hasOwn(bundleB, "publication"),
  resultGraphsFresh:
    resultA !== resultB &&
    bundleA !== bundleB &&
    graphsDisjoint(resultA, resultB),
  resultsDeepFrozen: deeplyFrozen(resultA) && deeplyFrozen(resultB),
  revisionA: bundleA.revision,
  revisionB: bundleB.revision,
  revisionOfficial: official.revision,
  sourceDigestA: bundleA.sourceDigest,
  sourceDigestB: bundleB.sourceDigest,
  sourceDigestOfficial: official.sourceDigest,
  successKeysA: Object.keys(resultA).sort(),
  successKeysB: Object.keys(resultB).sort(),
};
process.stdout.write(JSON.stringify(receipt));
`;
}

async function executeOfficialRuntimeProbe(sourceText, catalogText, bundleText) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--input-type=module", "--eval", runtimeProbeSource(sourceText, catalogText, bundleText)],
      { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
    );
    if (stderr !== "") {
      fail(
        "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
        "The isolated public-runtime probe wrote unexpected stderr.",
      );
    }
    return parseJson(
      stdout,
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      "Isolated public-runtime receipt",
    );
  } catch (error) {
    if (error instanceof PublisherOfficialGoldenEvidenceError) throw error;
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_RUNTIME_AUTHORITY_INVALID",
      "The isolated built public Publisher probe failed.",
      { cause: String(error) },
    );
  }
}

function countNamedTests(text) {
  return [...text.matchAll(/^[\t ]*(?:it|test)\(\s*["'`]([^"'`]+)["'`]/gmu)].map(
    (match) => match[1],
  );
}

function assertImmediateSingleRootScriptEdge(script, predecessor, successor, label) {
  if (typeof script !== "string") {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT",
      `${label} is missing its reviewed T10 aggregate edge.`,
    );
  }
  const commands = script.split(" && ");
  if (
    commands.filter((command) => command === predecessor).length !== 1 ||
    commands.filter((command) => command === successor).length !== 1 ||
    commands.indexOf(successor) !== commands.indexOf(predecessor) + 1
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT",
      `${label} must retain one immediate T09 to T10 edge.`,
      { predecessor, successor },
    );
  }
}

function registrationClaims(
  rootPackageText,
  publisherPackageText,
  ciSourceText,
  workflowText,
  frozenClaims,
) {
  const rootPackage = parseJson(
    rootPackageText,
    "PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT",
    "Root package manifest",
  );
  const publisherPackage = parseJson(
    publisherPackageText,
    "PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT",
    "Publisher package manifest",
  );
  const focusedPrerequisites =
    "pnpm verify:publisher-bundle-publication && pnpm --filter @desen/publisher... build && pnpm --filter @desen/publisher typecheck && pnpm --filter @desen/publisher test:official-golden && ";
  const expected = Object.freeze({
    package: "vitest run test/official-golden.test.ts",
    generate: `${focusedPrerequisites}node scripts/generate-publisher-official-golden-proof.mjs`,
    verify: `${focusedPrerequisites}node scripts/verify-publisher-official-golden.mjs`,
    test: `${focusedPrerequisites}node --test tests/publisher-official-golden.test.mjs`,
  });
  const rootScripts = ownData(rootPackage, "scripts");
  const publisherScripts = ownData(publisherPackage, "scripts");
  if (
    ownData(publisherScripts, "test:official-golden") !== expected.package ||
    ownData(rootScripts, "generate:publisher-official-golden") !== expected.generate ||
    ownData(rootScripts, "verify:publisher-official-golden") !== expected.verify ||
    ownData(rootScripts, "test:publisher-official-golden") !== expected.test
  ) {
    fail("PUBLISHER_OFFICIAL_GOLDEN_REGISTRATION_DRIFT", "The focused T10 commands changed.");
  }
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "test"),
    "pnpm test:publisher-bundle-publication",
    "pnpm test:publisher-official-golden",
    "Aggregate test",
  );
  assertImmediateSingleRootScriptEdge(
    ownData(rootScripts, "check"),
    "pnpm verify:publisher-bundle-publication",
    "pnpm verify:publisher-official-golden",
    "Aggregate check",
  );
  const t10TuplePattern =
    /\[\s*"publisher-official-golden",\s*"scripts\/verify-publisher-official-golden\.mjs",\s*"tests\/publisher-official-golden\.test\.mjs",?\s*\]/gu;
  const t10TupleMatches = [...ciSourceText.matchAll(t10TuplePattern)];
  if (t10TupleMatches.length !== 1) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_CI_DRIFT",
      "The reviewed single-pass CI inventory must contain one exact T10 tuple.",
      { t10Count: t10TupleMatches.length },
    );
  }
  const workflowInvocations =
    workflowText.match(/run:\s*node scripts\/run-ci-quality-gate\.mjs\s*$/gmu) ?? [];
  if (workflowInvocations.length !== 1) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_CI_DRIFT",
      "The hosted workflow must retain one reviewed single-pass CI entrypoint.",
      { count: workflowInvocations.length },
    );
  }
  return frozenClaims;
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

async function buildFromOptions(options) {
  const frozenArtifact = await authenticatedFrozenArtifactProjection();
  const prerequisites = await prerequisiteClaims(options);
  const trackedPairs = await Promise.all(
    TRACKED.map(async (relativePath) => {
      const override = readOverrideMap(options.trackedFileBytes, relativePath, TRACKED_SET);
      const bytes = override ?? (await readRegularBytes(relativePath));
      return Object.freeze({ relativePath, bytes });
    }),
  );
  const bytesByPath = new Map(trackedPairs.map(({ relativePath, bytes }) => [relativePath, bytes]));
  const frozenInputs = assertFrozenInputs(bytesByPath);
  const trackedText = (relativePath, label) =>
    decodeUtf8(bytesByPath.get(relativePath), "PUBLISHER_OFFICIAL_GOLDEN_UTF8_INVALID", label, {
      relativePath,
    });
  const registrations = registrationClaims(
    trackedText(ROOT_PACKAGE, "Root package manifest"),
    trackedText(PUBLISHER_PACKAGE, "Publisher package manifest"),
    trackedText(CI_SOURCE, "Single-pass CI source"),
    trackedText(CI_WORKFLOW, "Hosted CI workflow"),
    frozenArtifact.registrations,
  );
  const runtime = validateRuntimeReceipt(
    options.runtimeReceipt ??
      (await executeOfficialRuntimeProbe(
        frozenInputs.sourceText,
        frozenInputs.catalogText,
        frozenInputs.bundleText,
      )),
  );
  const rootTestText = decodeUtf8(
    bytesByPath.get(ROOT_TEST),
    "PUBLISHER_OFFICIAL_GOLDEN_UTF8_INVALID",
    "Official-golden root test",
    { relativePath: ROOT_TEST },
  );
  const rootTestNames = countNamedTests(rootTestText);
  const publisherRuntimeTestNames = countNamedTests(
    decodeUtf8(
      bytesByPath.get(RUNTIME_TEST),
      "PUBLISHER_OFFICIAL_GOLDEN_UTF8_INVALID",
      "Official-golden Publisher runtime test",
      { relativePath: RUNTIME_TEST },
    ),
  );
  const missingRequiredRootTests = frozenArtifact.tests.requiredRootCaseNames.filter(
    (name) => !rootTestNames.includes(name),
  );
  if (
    rootTestNames.length < frozenArtifact.tests.minimumRootMutationCases ||
    missingRequiredRootTests.length > 0
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_TEST_INVENTORY_DRIFT",
      "The independent T10 root suite must retain its checkpoint-authenticated task-time cases.",
      {
        rootMutationCases: rootTestNames.length,
        missingRequiredRootTests,
      },
    );
  }
  if (!sameStrings(publisherRuntimeTestNames, frozenArtifact.tests.publisherRuntimeCaseNames)) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_TEST_INVENTORY_DRIFT",
      "The focused Publisher T10 suite must retain its exact named official-golden cases.",
      { publisherRuntimeTestNames },
    );
  }
  const trackedFiles = frozenArtifact.trackedFiles;
  const artifact = deepFreeze({
    schemaVersion: 1,
    profile: "desen.publisher.official-golden-proof.v1",
    task: "M06-T10",
    result: "PASS",
    summary:
      "Two fresh identities passed through only the built public Publisher package root and produced byte-identical RFC 8785 Bundles whose revision and sourceDigest exactly match the frozen official sign-in Bundle after removing only its root publication member.",
    prerequisites,
    claims: {
      frozenOfficialInputs: frozenInputs.claims,
      vectorManifest: frozenInputs.vectorManifest,
      publicDoublePublication: runtime.claim,
      registrations,
      scope: {
        officialBundleNormalizationRemovesExactlyRootPublication: true,
        historicalArtifactsReadOnly: true,
      },
    },
    trackedFiles,
    tests: frozenArtifact.tests,
    nonclaims: [
      "M06-T10 proves only the frozen official valid Source/Catalog/Bundle golden and two fresh successful publications; M06-T11 owns the complete invalid-source no-Bundle matrix.",
      "The proof does not add publication metadata and does not prove signing, storage, activation, deployment, runtime, host, adapter, editor, or control-plane behavior.",
      "Byte equality is scoped to the frozen DESEN 0.1.0 fixtures, the pinned RFC 8785 canonicalization authority, and the current built public Publisher package root.",
    ],
    reproduction: [
      "pnpm --filter @desen/publisher... build",
      "node scripts/generate-publisher-official-golden-proof.mjs",
      "node scripts/verify-publisher-official-golden.mjs",
      "node --test tests/publisher-official-golden.test.mjs",
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

export async function buildPublisherOfficialGoldenEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  assertOperationOptions(
    options,
    BUILD_OPTION_KEYS,
    "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
    "The evidence builder rejects verifier and writer authority.",
  );
  return buildFromOptions(options);
}

export async function verifyPublisherOfficialGoldenEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  assertOperationOptions(
    options,
    VERIFY_OPTION_KEYS,
    "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
    "The evidence verifier rejects writer-only authority.",
  );
  if (options.artifactBytes !== undefined && options.artifactPath !== undefined) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "Verification accepts artifact bytes or an artifact path, never both.",
    );
  }
  const built = await buildFromOptions(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "The official-golden artifact path must be text.",
    );
  }
  const artifactInput =
    options.artifactBytes ??
    (await readRegularAbsoluteBytes(
      path.resolve(artifactPath),
      "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
      "Tracked official-golden artifact",
      { artifactPath: path.resolve(artifactPath) },
    ));
  const artifactBytes = captureInertBytes(
    artifactInput,
    options.artifactBytes === undefined
      ? "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT"
      : "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
    options.artifactBytes === undefined
      ? "Tracked official-golden artifact"
      : "Official-golden artifact byte override",
  );
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_DRIFT",
      "Tracked M06-T10 evidence differs from a fresh public-runtime build.",
      {
        expectedSha256: built.artifactSha256,
        actualSha256: sha256(artifactBytes),
      },
    );
  }
  if (options.proofDocument !== undefined && options.proofDocumentPath !== undefined) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "Verification accepts proof text or a proof-document path, never both.",
    );
  }
  const proofDocumentPath = options.proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT);
  if (typeof proofDocumentPath !== "string") {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "The official-golden proof-document path must be text.",
    );
  }
  const proofDocument =
    options.proofDocument ??
    decodeUtf8(
      await readRegularAbsoluteBytes(
        path.resolve(proofDocumentPath),
        "PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT",
        "Official-golden proof document",
        { proofDocumentPath: path.resolve(proofDocumentPath) },
      ),
      "PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT",
      "Official-golden proof document",
      { proofDocumentPath: path.resolve(proofDocumentPath) },
    );
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "The official-golden proof-document override must be text.",
    );
  }
  const artifactPathCount = proofDocument.split(`\`${ARTIFACT}\``).length - 1;
  const artifactHashCount = proofDocument.split(`\`sha256:${built.artifactSha256}\``).length - 1;
  if (artifactPathCount !== 1 || artifactHashCount !== 1 || /\bPENDING\b/u.test(proofDocument)) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_PROOF_DOCUMENT_DRIFT",
      "The T10 proof document must contain one exact artifact path and final SHA-256 pin.",
      { artifactPathCount, artifactHashCount },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisitePins: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.trackedFiles.length,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    canonicalBytes: built.artifact.claims.publicDoublePublication.firstPublication.canonicalBytes,
    publicationInvocations:
      built.artifact.claims.publicDoublePublication.freshPublicationInvocations,
  });
}

export async function writePublisherOfficialGoldenEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions);
  assertOperationOptions(
    options,
    WRITE_OPTION_KEYS,
    "PUBLISHER_OFFICIAL_GOLDEN_OFFICIAL_WRITE_OVERRIDE",
    "The official T10 writer rejects semantic evidence overrides.",
  );
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_OFFICIAL_GOLDEN_ARTIFACT_PATH;
  if (typeof artifactPath !== "string") {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
      "The official-golden artifact path must be text.",
    );
  }
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "PUBLISHER_OFFICIAL_GOLDEN_OPTIONS_INVALID",
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
