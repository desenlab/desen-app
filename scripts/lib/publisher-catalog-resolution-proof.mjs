import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  PUBLISH_CATALOG_RESOLUTION_LIMITS,
  resolvePublishCatalogs,
} from "../../packages/publisher/dist/catalog-resolution.js";
import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-CATALOG-RESOLUTION.md";
const SOURCE_RELATIVE_PATH = "examples/sign-in/official-derived.source.desen.json";
const CATALOG_RELATIVE_PATH = "packages/reference-catalog-web/catalog.json";
const PUBLISHER_PACKAGE_RELATIVE_PATH = "packages/publisher/package.json";
const RESOLVER_SOURCE_RELATIVE_PATH = "packages/publisher/src/catalog-resolution.ts";
const RESOLVER_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/catalog-resolution.d.ts";
const PUBLIC_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/index.d.ts";

const EXPECTED_SOURCE_ID = "com.example.account-app";
const EXPECTED_TUPLE = Object.freeze({
  id: "run.desen.reference.sign-in",
  version: "0.1.0",
  target: "web-react",
  packageDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
});

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M06-T01",
    path: "docs/proof/artifacts/publisher-0.1.0-publish-result.json",
    sha256: "1e3df6b4723f33f54b041445470354dbb1cb0acc5f6d1f8b486fb7bd11862714",
    claim: "closed Publisher result, staged diagnostics, and no-partial-Bundle boundary",
  }),
  Object.freeze({
    task: "M03-T04",
    path: "docs/proof/artifacts/reference-catalog-web-package-digest-v1.json",
    sha256: "e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716",
    claim: "historical deterministic Web-React package-digest profile evidence",
  }),
  Object.freeze({
    task: "M02-T07",
    path: "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
    sha256: "96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7",
    claim: "Catalog-set branding, exact SemVer, and namespace semantics",
  }),
  Object.freeze({
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    claim:
      "current Web-React package observation with exact artifact-entry digests and package tuple",
  }),
]);

const TRACKED_PATHS = Object.freeze([
  SOURCE_RELATIVE_PATH,
  CATALOG_RELATIVE_PATH,
  PUBLISHER_PACKAGE_RELATIVE_PATH,
  "packages/publisher/src/index.ts",
  RESOLVER_SOURCE_RELATIVE_PATH,
  "packages/publisher/test/catalog-resolution.test.ts",
  "packages/publisher/test/catalog-resolution.types.ts",
  "packages/publisher/dist/catalog-resolution.js",
  RESOLVER_DECLARATION_RELATIVE_PATH,
  PUBLIC_DECLARATION_RELATIVE_PATH,
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-catalog-resolution-proof.mjs",
  "scripts/generate-publisher-catalog-resolution-proof.mjs",
  "scripts/verify-publisher-catalog-resolution.mjs",
  "tests/publisher-catalog-resolution.test.mjs",
]);

const ALLOWED_RESOLVER_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./publish-diagnostics.js",
  "./publish-result.js",
]);

const EMPTY_CAPABILITY_MAPS = Object.freeze(["behaviors", "components", "operations", "resources"]);

/** Absolute destination of the deterministic M06-T02 artifact. */
export const DEFAULT_PUBLISHER_CATALOG_RESOLUTION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Controlled failure emitted by the M06-T02 evidence builder and verifier. */
export class PublisherCatalogResolutionEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherCatalogResolutionEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherCatalogResolutionEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function captureOptions(value) {
  if (value === undefined) return Object.freeze({});
  const allowed = new Set([
    "artifactBytes",
    "artifactPath",
    "beforeAtomicRename",
    "catalog",
    "publicApi",
    "publisherPackage",
    "proofDocument",
    "resolver",
    "resolverDeclaration",
    "resolverSource",
    "source",
    "verifyPrerequisites",
  ]);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("PUBLISHER_CATALOG_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_CATALOG_OPTIONS_INVALID", "Evidence options could not be inspected safely.");
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail("PUBLISHER_CATALOG_OPTIONS_INVALID", "Evidence options contain an unknown field.");
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "PUBLISHER_CATALOG_OPTIONS_INVALID",
        `Evidence option ${key} could not be inspected safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_CATALOG_OPTIONS_INVALID",
        `Evidence option ${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function readRegularBytes(relativePath) {
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("PUBLISHER_CATALOG_FILE_MISSING", `Required file is missing: ${relativePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("PUBLISHER_CATALOG_FILE_INVALID", `Required path is not a regular file: ${relativePath}`);
  }
  return readFile(absolutePath);
}

async function readJson(relativePath) {
  const bytes = await readRegularBytes(relativePath);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PUBLISHER_CATALOG_JSON_INVALID", `Required JSON is invalid: ${relativePath}`);
  }
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => isDeepFrozen(child, seen));
}

function assertNoPartial(result, label) {
  for (const key of ["bundle", "catalogSet", "packages", "requirementPackageIndexes", "resolved"]) {
    if (Object.hasOwn(result, key)) {
      fail("PUBLISHER_CATALOG_PARTIAL_FAILURE", `${label} exposed forbidden partial field ${key}.`);
    }
  }
}

function assertFailure(result, expected, label) {
  if (
    result === null ||
    typeof result !== "object" ||
    result.ok !== false ||
    result.stage !== expected.stage ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length === 0
  ) {
    fail(expected.failureCode, `${label} did not return the expected terminal Publisher failure.`);
  }
  const diagnostic = result.diagnostics.find(
    (entry) =>
      entry?.code === expected.code &&
      entry?.stage === expected.stage &&
      entry?.pointer === expected.pointer &&
      entry?.severity === "error",
  );
  if (diagnostic === undefined) {
    fail(expected.failureCode, `${label} did not emit the expected staged diagnostic.`);
  }
  assertNoPartial(result, label);
  if (!Object.isFrozen(result) || !Object.isFrozen(result.diagnostics)) {
    fail(expected.failureCode, `${label} did not return frozen failure data.`);
  }
  return Object.freeze({
    stage: result.stage,
    code: diagnostic.code,
    pointer: diagnostic.pointer,
    classification: diagnostic.classification,
    noPartial: true,
    frozen: true,
  });
}

function candidateFor(catalog, overrides = {}) {
  return {
    id: catalog.id,
    version: catalog.version,
    target: catalog.target,
    observedPackageDigest: catalog.packageDigest,
    catalog,
    ...overrides,
  };
}

function callResolver(resolver, requirements, candidates, documentId, limits) {
  let result;
  try {
    result =
      limits === undefined
        ? resolver(requirements, candidates, documentId)
        : resolver(requirements, candidates, documentId, limits);
  } catch (error) {
    fail("PUBLISHER_CATALOG_RESOLVER_THROW", "Catalog resolver threw during a proof vector.", {
      cause: String(error),
    });
  }
  return result;
}

function assertFixtureIdentity(source, catalog) {
  const requirement = source?.catalogs?.[0];
  if (
    source?.id !== EXPECTED_SOURCE_ID ||
    !Array.isArray(source.catalogs) ||
    source.catalogs.length !== 1 ||
    requirement?.id !== EXPECTED_TUPLE.id ||
    requirement?.version !== EXPECTED_TUPLE.version ||
    requirement?.target !== EXPECTED_TUPLE.target
  ) {
    fail(
      "PUBLISHER_CATALOG_SOURCE_FIXTURE_DRIFT",
      "The official-derived Source no longer carries the expected exact requirement.",
    );
  }
  for (const [key, expected] of Object.entries(EXPECTED_TUPLE)) {
    if (catalog?.[key] !== expected) {
      fail(
        "PUBLISHER_CATALOG_FIXTURE_DRIFT",
        `The current Catalog ${key} no longer matches the pinned M06-T02 fixture.`,
      );
    }
  }
  for (const map of EMPTY_CAPABILITY_MAPS) {
    if (catalog?.[map] === null || typeof catalog?.[map] !== "object") {
      fail(
        "PUBLISHER_CATALOG_FIXTURE_DRIFT",
        `The current Catalog is missing capability map ${map}.`,
      );
    }
  }
}

function exactSuccessEvidence(resolver, source, catalog) {
  const inputCatalog = cloneJson(catalog);
  const inputCandidate = candidateFor(inputCatalog);
  const result = callResolver(resolver, cloneJson(source.catalogs), [inputCandidate], source.id);
  if (
    result === null ||
    typeof result !== "object" ||
    result.resolved !== true ||
    result.diagnostics?.length !== 0 ||
    result.packages?.length !== 1 ||
    result.catalogSet?.length !== 1 ||
    result.requirementPackageIndexes?.length !== 1 ||
    result.requirementPackageIndexes[0] !== 0
  ) {
    fail(
      "PUBLISHER_CATALOG_EXACT_VECTOR_FAILED",
      "The official-derived exact Catalog requirement did not resolve completely.",
    );
  }
  const selected = result.packages[0];
  if (
    selected.id !== EXPECTED_TUPLE.id ||
    selected.version !== EXPECTED_TUPLE.version ||
    selected.target !== EXPECTED_TUPLE.target ||
    selected.packageDigest !== EXPECTED_TUPLE.packageDigest ||
    selected.catalog !== result.catalogSet[0] ||
    selected.catalog === inputCatalog
  ) {
    fail(
      "PUBLISHER_CATALOG_EXACT_VECTOR_FAILED",
      "Resolved package identity, digest, or detached Catalog authority drifted.",
    );
  }
  if (Object.hasOwn(result, "bundle") || !isDeepFrozen(result)) {
    fail(
      "PUBLISHER_CATALOG_EXACT_VECTOR_FAILED",
      "Successful resolution exposed a Bundle or mutable data.",
    );
  }

  const originalDescription = selected.catalog.description;
  inputCatalog.description = "mutated-after-resolution";
  inputCandidate.observedPackageDigest = `sha256:${"f".repeat(64)}`;
  if (
    selected.catalog.description !== originalDescription ||
    selected.packageDigest !== EXPECTED_TUPLE.packageDigest
  ) {
    fail(
      "PUBLISHER_CATALOG_DETACHMENT_FAILED",
      "Caller mutation changed the resolved immutable authority.",
    );
  }

  return Object.freeze({
    documentId: source.id,
    requirement: Object.freeze({
      id: source.catalogs[0].id,
      version: source.catalogs[0].version,
      target: source.catalogs[0].target,
    }),
    resolvedTuple: EXPECTED_TUPLE,
    requirementPackageIndexes: Object.freeze([0]),
    detached: true,
    deeplyFrozen: true,
    noBundle: true,
  });
}

function duplicateAmbiguityEvidence(resolver, source, catalog) {
  const alternativeCatalog = cloneJson(catalog);
  alternativeCatalog.packageDigest = `sha256:${"1".repeat(64)}`;
  const first = candidateFor(cloneJson(catalog));
  const second = candidateFor(alternativeCatalog);
  const expected = {
    stage: "catalog-resolution",
    code: "CATALOG_VERSION_UNAVAILABLE",
    pointer: "/catalogs/0",
    failureCode: "PUBLISHER_CATALOG_DUPLICATE_VECTOR_FAILED",
  };
  const forward = assertFailure(
    callResolver(resolver, cloneJson(source.catalogs), [first, second], source.id),
    expected,
    "forward duplicate-candidate vector",
  );
  const reverse = assertFailure(
    callResolver(
      resolver,
      cloneJson(source.catalogs),
      [candidateFor(cloneJson(alternativeCatalog)), candidateFor(cloneJson(catalog))],
      source.id,
    ),
    expected,
    "reverse duplicate-candidate vector",
  );
  const identical = assertFailure(
    callResolver(
      resolver,
      cloneJson(source.catalogs),
      [candidateFor(cloneJson(catalog)), candidateFor(cloneJson(catalog))],
      source.id,
    ),
    expected,
    "identical duplicate-candidate vector",
  );
  return Object.freeze({
    forward,
    reverse,
    identical,
    candidateOrderWinner: false,
    canonicalIdentityDedupe: false,
  });
}

function locationEvidence(resolver, source, catalog) {
  const locatedRequirement = {
    ...cloneJson(source.catalogs[0]),
    location: "file:///untrusted/discovery-hint/catalog.json",
  };
  const unique = callResolver(
    resolver,
    [locatedRequirement],
    [candidateFor(cloneJson(catalog))],
    source.id,
  );
  if (unique?.resolved !== true) {
    fail(
      "PUBLISHER_CATALOG_LOCATION_VECTOR_FAILED",
      "An inert Source location hint changed unique exact resolution.",
    );
  }
  const duplicate = assertFailure(
    callResolver(
      resolver,
      [locatedRequirement],
      [candidateFor(cloneJson(catalog)), candidateFor(cloneJson(catalog))],
      source.id,
    ),
    {
      stage: "catalog-resolution",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/catalogs/0",
      failureCode: "PUBLISHER_CATALOG_LOCATION_VECTOR_FAILED",
    },
    "location cannot break candidate ambiguity",
  );
  if (JSON.stringify(unique).includes("untrusted/discovery-hint")) {
    fail(
      "PUBLISHER_CATALOG_LOCATION_VECTOR_FAILED",
      "Location data leaked into resolved authority.",
    );
  }
  return Object.freeze({
    uniqueExactResolutionUnaffected: true,
    duplicateStillAmbiguous: duplicate,
    locationCopiedToResult: false,
  });
}

function integrityEvidence(resolver, source, catalog) {
  const digestMismatch = assertFailure(
    callResolver(
      resolver,
      cloneJson(source.catalogs),
      [
        candidateFor(cloneJson(catalog), {
          observedPackageDigest: `sha256:${"2".repeat(64)}`,
        }),
      ],
      source.id,
    ),
    {
      stage: "catalog-integrity",
      code: "CATALOG_DIGEST_MISMATCH",
      pointer: "/catalogs/0",
      failureCode: "PUBLISHER_CATALOG_DIGEST_VECTOR_FAILED",
    },
    "observed/declaration digest mismatch",
  );

  const mismatchedCatalog = cloneJson(catalog);
  mismatchedCatalog.id = "run.desen.reference.other";
  const tupleMismatch = assertFailure(
    callResolver(
      resolver,
      cloneJson(source.catalogs),
      [
        candidateFor(mismatchedCatalog, {
          id: EXPECTED_TUPLE.id,
        }),
      ],
      source.id,
    ),
    {
      stage: "catalog-integrity",
      code: "run.desen.publisher/INVALID_CATALOG_INPUT",
      pointer: "/catalogs/0",
      failureCode: "PUBLISHER_CATALOG_TUPLE_VECTOR_FAILED",
    },
    "candidate/Catalog tuple mismatch",
  );
  return Object.freeze({ digestMismatch, tupleMismatch });
}

function namespaceEvidence(resolver, source, catalog) {
  const second = cloneJson(catalog);
  second.id = "run.desen.reference.second";
  second.packageDigest = `sha256:${"3".repeat(64)}`;
  const requirements = [
    cloneJson(source.catalogs[0]),
    {
      id: second.id,
      version: second.version,
      target: second.target,
    },
  ];
  const failure = assertFailure(
    callResolver(
      resolver,
      requirements,
      [candidateFor(cloneJson(catalog)), candidateFor(second)],
      source.id,
    ),
    {
      stage: "namespace-conflicts",
      code: "AMBIGUOUS_CAPABILITY",
      pointer: "/catalogs/1",
      failureCode: "PUBLISHER_CATALOG_NAMESPACE_VECTOR_FAILED",
    },
    "cross-Catalog namespace collision",
  );
  return Object.freeze({
    ...failure,
    pointerDomain: "Source requirement",
    firstConflictingRequirementIndex: 1,
  });
}

function finiteProfileEvidence(resolver, source, catalog) {
  const limits = Object.freeze({
    ...PUBLISH_CATALOG_RESOLUTION_LIMITS,
    maxCandidates: 1,
  });
  const failure = assertFailure(
    callResolver(
      resolver,
      cloneJson(source.catalogs),
      [candidateFor(cloneJson(catalog)), candidateFor(cloneJson(catalog))],
      source.id,
      limits,
    ),
    {
      stage: "catalog-resolution",
      code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      pointer: "/catalogs",
      failureCode: "PUBLISHER_CATALOG_LIMIT_VECTOR_FAILED",
    },
    "finite candidate profile",
  );
  return Object.freeze({
    defaults: PUBLISH_CATALOG_RESOLUTION_LIMITS,
    exercisedLimit: "maxCandidates",
    exercisedMaximum: 1,
    failure,
  });
}

function assertPublicPrivacy(publicApi, publisherPackage, declaration) {
  const forbidden = ["PUBLISH_CATALOG_RESOLUTION_LIMITS", "resolvePublishCatalogs"];
  const runtimeExports = Object.keys(publicApi).sort();
  if (forbidden.some((name) => runtimeExports.includes(name))) {
    fail(
      "PUBLISHER_CATALOG_PUBLIC_API_EXPOSED",
      "Package-private Catalog resolution leaked through the root runtime API.",
    );
  }
  if (forbidden.some((name) => declaration.includes(name))) {
    fail(
      "PUBLISHER_CATALOG_PUBLIC_API_EXPOSED",
      "Package-private Catalog resolution leaked through the root declaration API.",
    );
  }
  if (
    publisherPackage?.exports === null ||
    typeof publisherPackage?.exports !== "object" ||
    Object.keys(publisherPackage.exports).some((key) => key !== ".")
  ) {
    fail(
      "PUBLISHER_CATALOG_PUBLIC_API_EXPOSED",
      "Publisher package exports expose a partial Catalog-resolution subpath.",
    );
  }
  return Object.freeze({
    rootRuntimeExports: Object.freeze(runtimeExports),
    resolverRuntimeExported: false,
    resolverTypeExported: false,
    resolverSubpathExported: false,
    packagePrivateDistImportUsedByProof: "packages/publisher/dist/catalog-resolution.js",
  });
}

function resolverImports(source) {
  return [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/gu),
    ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gmu),
  ]
    .map((match) => match[1])
    .filter((value) => value !== undefined)
    .sort();
}

function assertTargetNeutralBoundary(source, publisherPackage) {
  const imports = resolverImports(source);
  if (
    imports.some((specifier) => !ALLOWED_RESOLVER_IMPORTS.includes(specifier)) ||
    /\b(?:document|window|navigator|process|Buffer|fetch)\b/u.test(source)
  ) {
    fail(
      "PUBLISHER_CATALOG_TARGET_BOUNDARY_DRIFT",
      "Catalog resolution acquired a platform, framework, or production-adapter dependency.",
    );
  }
  const dependencies = Object.keys(publisherPackage?.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(["@desen/protocol", "@desen/validator"])) {
    fail(
      "PUBLISHER_CATALOG_TARGET_BOUNDARY_DRIFT",
      "Publisher production dependencies are no longer target-neutral.",
    );
  }
  return Object.freeze({
    imports: Object.freeze(imports),
    productionDependencies: Object.freeze(dependencies),
    nodeBuiltins: false,
    browserGlobals: false,
    frameworkDependencies: false,
    productionAdapterDependencies: false,
  });
}

async function verifyPrerequisitePins(enabled) {
  const evidence = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes = await readRegularBytes(prerequisite.path);
    const actual = sha256(bytes);
    if (enabled && actual !== prerequisite.sha256) {
      fail(
        "PUBLISHER_CATALOG_PREREQUISITE_DRIFT",
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

async function fileInventory() {
  const inventory = [];
  for (const relativePath of [...TRACKED_PATHS].sort()) {
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
  const [packageTest, typeTest, rootTest] = await Promise.all([
    readRegularBytes("packages/publisher/test/catalog-resolution.test.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("packages/publisher/test/catalog-resolution.types.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("tests/publisher-catalog-resolution.test.mjs").then((bytes) =>
      bytes.toString("utf8"),
    ),
  ]);
  return Object.freeze({
    packageRuntimeCases: (packageTest.match(/^\s*it\("/gmu) ?? []).length,
    compilerNegativeCases: (typeTest.match(/@ts-expect-error/gu) ?? []).length,
    rootMutationCases: (rootTest.match(/^test\("/gmu) ?? []).length,
  });
}

function countExactOccurrences(text, value) {
  return text.split(value).length - 1;
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_CATALOG_PROOF_DOCUMENT_INVALID",
      "The Catalog-resolution proof document must be text.",
    );
  }
  const expectedHash = `sha256:${artifactSha256}`;
  const digestPins = proofDocument.match(/sha256:[0-9a-f]{64}/gu) ?? [];
  if (
    countExactOccurrences(proofDocument, `\`${ARTIFACT_RELATIVE_PATH}\``) !== 1 ||
    countExactOccurrences(proofDocument, `\`${expectedHash}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expectedHash ||
    proofDocument.includes("PENDING_M06_T02_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_CATALOG_PROOF_DOCUMENT_DRIFT",
      "The Catalog-resolution proof document does not uniquely pin the tracked artifact and hash.",
      { expectedArtifactPath: ARTIFACT_RELATIVE_PATH, expectedHash },
    );
  }
}

/**
 * Builds deterministic evidence from the shipped package-private resolver and real project fixtures.
 */
export async function buildPublisherCatalogResolutionEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const [
    sourceDefault,
    catalogDefault,
    publisherPackageDefault,
    resolverSourceDefault,
    resolverDeclarationDefault,
    publicDeclaration,
  ] = await Promise.all([
    readJson(SOURCE_RELATIVE_PATH),
    readJson(CATALOG_RELATIVE_PATH),
    readJson(PUBLISHER_PACKAGE_RELATIVE_PATH),
    readRegularBytes(RESOLVER_SOURCE_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(RESOLVER_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PUBLIC_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
  ]);

  const resolver = options.resolver ?? resolvePublishCatalogs;
  const source = cloneJson(options.source ?? sourceDefault);
  const catalog = cloneJson(options.catalog ?? catalogDefault);
  const publisherPackage = cloneJson(options.publisherPackage ?? publisherPackageDefault);
  const resolverSource = options.resolverSource ?? resolverSourceDefault;
  const resolverDeclaration = options.resolverDeclaration ?? resolverDeclarationDefault;
  const publicApi = options.publicApi ?? publisherPublicApi;

  if (
    typeof resolver !== "function" ||
    typeof resolverSource !== "string" ||
    typeof resolverDeclaration !== "string"
  ) {
    fail("PUBLISHER_CATALOG_OPTIONS_INVALID", "Evidence overrides have invalid types.");
  }

  assertFixtureIdentity(source, catalog);
  const prerequisites = await verifyPrerequisitePins(options.verifyPrerequisites !== false);
  const exact = exactSuccessEvidence(resolver, source, catalog);
  const ambiguity = duplicateAmbiguityEvidence(resolver, source, catalog);
  const location = locationEvidence(resolver, source, catalog);
  const integrity = integrityEvidence(resolver, source, catalog);
  const namespace = namespaceEvidence(resolver, source, catalog);
  const finiteProfile = finiteProfileEvidence(resolver, source, catalog);
  const apiPrivacy = assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration);
  const targetNeutralBoundary = assertTargetNeutralBoundary(resolverSource, publisherPackage);

  if (
    !resolverDeclaration.includes("PublishCatalogResolutionResult") ||
    !resolverDeclaration.includes("observedPackageDigest")
  ) {
    fail(
      "PUBLISHER_CATALOG_DECLARATION_DRIFT",
      "Built package-private declarations no longer document the resolver result/trust boundary.",
    );
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.catalog-resolution-proof.v1",
    task: "M06-T02",
    result: "PASS",
    summary:
      "The built package-private Publisher resolver selects one exact Catalog tuple, rejects ambiguity without candidate-order fallback, checks declared/observed tuple consistency, and returns only detached branded Catalog authority.",
    prerequisites,
    fixture: Object.freeze({
      sourcePath: SOURCE_RELATIVE_PATH,
      catalogPath: CATALOG_RELATIVE_PATH,
      sourceId: EXPECTED_SOURCE_ID,
      exactTuple: EXPECTED_TUPLE,
    }),
    claims: Object.freeze({
      exactResolution: exact,
      duplicateAmbiguity: ambiguity,
      locationNonAuthority: location,
      tupleAndDigestConsistency: integrity,
      namespaceConflict: namespace,
      finiteProfile,
      immutableDetachedResult: true,
      terminalFailuresExposeNoBundleOrCatalogAuthority: true,
      rootApiPrivacy: apiPrivacy,
      targetNeutralDependencyBoundary: targetNeutralBoundary,
    }),
    trustBoundary: Object.freeze({
      observedPackageDigest:
        "A target-specific package profile must authenticate package bytes before supplying observedPackageDigest.",
      resolverProof:
        "The resolver proves exact equality between the preverified caller observation, candidate tuple, and validated Catalog declaration.",
      packageByteAuthenticationPerformedHere: false,
      canonicalCatalogJsonUsedAsPackageDigest: false,
    }),
    nonclaims: Object.freeze([
      "This resolver does not read, hash, download, install, or authenticate package artifact bytes.",
      "Caller-supplied observedPackageDigest is not trusted merely because it has SHA-256 syntax.",
      "Catalog JSON equality does not authenticate that two observations name the same package artifact.",
      "Source location is an inert discovery hint and never grants resolution authority.",
      "This task does not expose a partial public Publisher API or emit a DESEN Bundle.",
    ]),
    tests: await testInventory(),
    trackedFiles: await fileInventory(),
    reproduction: Object.freeze([
      "pnpm --filter @desen/publisher build",
      "node scripts/generate-publisher-catalog-resolution-proof.mjs",
      "node scripts/verify-publisher-catalog-resolution.mjs",
      "node --test tests/publisher-catalog-resolution.test.mjs",
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
export async function verifyPublisherCatalogResolutionEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherCatalogResolutionEvidence(options);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularBytes(ARTIFACT_RELATIVE_PATH)
      : Buffer.from(options.artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail(
      "PUBLISHER_CATALOG_ARTIFACT_DRIFT",
      "Tracked Catalog-resolution evidence differs from a fresh deterministic build.",
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
    proofVectors: 9,
    trackedFiles: built.artifact.trackedFiles.length,
    tests: built.artifact.tests,
    exactTuple: built.artifact.fixture.exactTuple,
    proofDocumentPinned: true,
  });
}

/** Atomically writes exact deterministic M06-T02 evidence bytes. */
export async function writePublisherCatalogResolutionEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherCatalogResolutionEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_CATALOG_RESOLUTION_ARTIFACT_PATH;
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
