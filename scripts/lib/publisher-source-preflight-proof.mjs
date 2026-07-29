import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import * as publisherPublicApi from "../../packages/publisher/dist/index.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  preflightPublishSource,
} from "../../packages/publisher/dist/source-preflight.js";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/publisher-0.1.0-source-preflight.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/PUBLISHER-SOURCE-PREFLIGHT.md";
const SOURCE_RELATIVE_PATH = "examples/sign-in/official-derived.source.desen.json";
const CATALOG_RELATIVE_PATH = "packages/reference-catalog-web/catalog.json";
const PUBLISHER_PACKAGE_RELATIVE_PATH = "packages/publisher/package.json";
const PREFLIGHT_SOURCE_RELATIVE_PATH = "packages/publisher/src/source-preflight.ts";
const PREFLIGHT_DECLARATION_RELATIVE_PATH = "packages/publisher/dist/source-preflight.d.ts";
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
    task: "M02-T06",
    path: "docs/proof/artifacts/protocol-0.1.0-structural-validation.json",
    sha256: "7e7662e6b20e29452f8c5092e37d2fefe1a416e787816693543b0c2c1a2e6536",
    claim: "frozen Source-root and embedded-schema validation",
  }),
  Object.freeze({
    task: "M02-T07",
    path: "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
    sha256: "96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7",
    claim: "Source identity, exact Catalog relationship, and static-reference semantics",
  }),
  Object.freeze({
    task: "M06-T01",
    path: "docs/proof/artifacts/publisher-0.1.0-publish-result.json",
    sha256: "aefed86741562bfa0f4bcbe163af50c8471dd6bf5979b7da36d681728536ff63",
    claim: "strict raw Source ingress and closed no-partial failure shell",
  }),
  Object.freeze({
    task: "M06-T02",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json",
    sha256: "4ee7754e5e658be5b7cda8c5ce6875d6f0a32f20d500bc9079ac79e5ed5142d9",
    claim: "exact Catalog package resolution and immutable trusted namespace",
  }),
]);

const TRACKED_PATHS = Object.freeze([
  SOURCE_RELATIVE_PATH,
  CATALOG_RELATIVE_PATH,
  PUBLISHER_PACKAGE_RELATIVE_PATH,
  "packages/publisher/src/index.ts",
  "packages/publisher/src/publish-result.ts",
  PREFLIGHT_SOURCE_RELATIVE_PATH,
  "packages/publisher/test/source-preflight.test.ts",
  "packages/publisher/test/source-preflight.types.ts",
  "packages/publisher/dist/source-preflight.js",
  PREFLIGHT_DECLARATION_RELATIVE_PATH,
  PUBLIC_DECLARATION_RELATIVE_PATH,
  "packages/validator/src/index.ts",
  "packages/validator/src/semantic-validation.ts",
  "packages/validator/src/structural-validation.ts",
  "packages/validator/test/semantic-foundation.test.ts",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/publisher-source-preflight-proof.mjs",
  "scripts/generate-publisher-source-preflight-proof.mjs",
  "scripts/verify-publisher-source-preflight.mjs",
  "tests/publisher-source-preflight.test.mjs",
]);

const ALLOWED_PREFLIGHT_IMPORTS = Object.freeze([
  "@desen/protocol",
  "@desen/validator",
  "./catalog-resolution.js",
  "./publish-diagnostics.js",
  "./publish-result.js",
  "./source-json.js",
]);

const FORBIDDEN_PARTIAL_FIELDS = Object.freeze([
  "bundle",
  "catalogSet",
  "packages",
  "preflighted",
  "requirementPackageIndexes",
  "resolved",
  "source",
  "value",
]);

/** Absolute destination of the deterministic M06-T03 evidence artifact. */
export const DEFAULT_PUBLISHER_SOURCE_PREFLIGHT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Controlled failure emitted by the M06-T03 evidence builder and verifier. */
export class PublisherSourcePreflightEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "PublisherSourcePreflightEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new PublisherSourcePreflightEvidenceError(code, message, details);
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
    "preflight",
    "preflightDeclaration",
    "preflightSource",
    "proofDocument",
    "publicApi",
    "publisherPackage",
    "source",
    "verifyPrerequisites",
  ]);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("PUBLISHER_PREFLIGHT_OPTIONS_INVALID", "Evidence options must be an own-data object.");
  }
  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    fail("PUBLISHER_PREFLIGHT_OPTIONS_INVALID", "Evidence options could not be inspected safely.");
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail("PUBLISHER_PREFLIGHT_OPTIONS_INVALID", "Evidence options contain an unknown field.");
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "PUBLISHER_PREFLIGHT_OPTIONS_INVALID",
        `Evidence option ${key} could not be inspected safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "PUBLISHER_PREFLIGHT_OPTIONS_INVALID",
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
    fail("PUBLISHER_PREFLIGHT_FILE_MISSING", `Required file is missing: ${relativePath}`, {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail(
      "PUBLISHER_PREFLIGHT_FILE_INVALID",
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
    fail("PUBLISHER_PREFLIGHT_JSON_INVALID", `Required JSON is invalid: ${relativePath}`);
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

function callPreflight(preflight, source, candidates, limits = undefined) {
  try {
    return limits === undefined
      ? preflight(JSON.stringify(source), candidates)
      : preflight(JSON.stringify(source), candidates, limits);
  } catch (error) {
    fail("PUBLISHER_PREFLIGHT_THROW", "Source preflight threw during a proof vector.", {
      cause: String(error),
    });
  }
}

function assertNoPartial(result, label) {
  for (const key of FORBIDDEN_PARTIAL_FIELDS) {
    if (Object.hasOwn(result, key)) {
      fail(
        "PUBLISHER_PREFLIGHT_PARTIAL_FAILURE",
        `${label} exposed forbidden partial field ${key}.`,
      );
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
  if (!isDeepFrozen(result)) {
    fail(expected.failureCode, `${label} did not return recursively immutable failure data.`);
  }
  return Object.freeze({
    stage: result.stage,
    code: diagnostic.code,
    pointer: diagnostic.pointer,
    classification: diagnostic.classification,
    noPartial: true,
    deeplyFrozen: true,
  });
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
      "PUBLISHER_PREFLIGHT_SOURCE_FIXTURE_DRIFT",
      "The official-derived Source no longer carries the expected exact requirement.",
    );
  }
  for (const [key, expected] of Object.entries(EXPECTED_TUPLE)) {
    if (catalog?.[key] !== expected) {
      fail(
        "PUBLISHER_PREFLIGHT_CATALOG_FIXTURE_DRIFT",
        `The current Catalog ${key} no longer matches the pinned M06-T03 fixture.`,
      );
    }
  }
}

function successEvidence(preflight, source, catalog) {
  const sourceInput = cloneJson(source);
  const catalogInput = cloneJson(catalog);
  const candidate = candidateFor(catalogInput);
  const result = callPreflight(preflight, sourceInput, [candidate]);
  if (
    result === null ||
    typeof result !== "object" ||
    result.preflighted !== true ||
    result.source?.id !== EXPECTED_SOURCE_ID ||
    result.catalogSet?.length !== 1 ||
    result.packages?.length !== 1 ||
    result.requirementPackageIndexes?.length !== 1 ||
    result.requirementPackageIndexes[0] !== 0 ||
    result.diagnostics?.length !== 0
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_SUCCESS_VECTOR_FAILED",
      "The official-derived Source did not produce complete nonterminal authority.",
    );
  }
  if (
    result.packages[0].catalog !== result.catalogSet[0] ||
    result.packages[0].catalog === catalogInput ||
    result.source === sourceInput ||
    Object.hasOwn(result, "ok") ||
    Object.hasOwn(result, "bundle") ||
    !isDeepFrozen(result)
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_SUCCESS_VECTOR_FAILED",
      "Prepared Source authority was mutable, caller-owned, terminal, or internally misaligned.",
    );
  }
  const firstJson = JSON.stringify(result);
  const repeated = callPreflight(preflight, cloneJson(source), [candidateFor(cloneJson(catalog))]);
  if (repeated?.preflighted !== true || JSON.stringify(repeated) !== firstJson) {
    fail(
      "PUBLISHER_PREFLIGHT_DETERMINISM_FAILED",
      "Repeated Source preflight did not return byte-identical inert JSON.",
    );
  }

  sourceInput.entry = "caller-mutated";
  catalogInput.description = "caller-mutated";
  candidate.observedPackageDigest = `sha256:${"f".repeat(64)}`;
  if (
    result.source.entry !== source.entry ||
    result.catalogSet[0].description !== catalog.description ||
    result.packages[0].packageDigest !== EXPECTED_TUPLE.packageDigest
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_DETACHMENT_FAILED",
      "Caller mutation changed prepared Source or Catalog authority.",
    );
  }

  return Object.freeze({
    sourceId: result.source.id,
    exactTuple: EXPECTED_TUPLE,
    requirementPackageIndexes: Object.freeze([...result.requirementPackageIndexes]),
    sourceDetached: true,
    catalogAuthorityPreserved: true,
    deeplyFrozen: true,
    repeatedJsonByteIdentical: true,
    terminalOkAbsent: true,
    bundleAbsent: true,
  });
}

function stagedFailureEvidence(preflight, source, catalog) {
  const candidate = candidateFor(cloneJson(catalog));

  const rootInvalid = cloneJson(source);
  rootInvalid.unexpectedT03 = true;
  const root = assertFailure(
    callPreflight(preflight, rootInvalid, [candidate]),
    {
      stage: "source-schema",
      code: "UNKNOWN_CORE_FIELD",
      pointer: "/unexpectedT03",
      failureCode: "PUBLISHER_PREFLIGHT_ROOT_STAGE_FAILED",
    },
    "Source-root stage vector",
  );

  const embeddedInvalid = cloneJson(source);
  embeddedInvalid.surfaces["sign-in"].state.email.schema = { type: "not-a-type" };
  const embedded = assertFailure(
    callPreflight(preflight, embeddedInvalid, [candidate]),
    {
      stage: "embedded-schema",
      code: "SCHEMA_INVALID",
      pointer: "/surfaces/sign-in/state/email/schema/type",
      failureCode: "PUBLISHER_PREFLIGHT_EMBEDDED_STAGE_FAILED",
    },
    "embedded-schema stage vector",
  );

  const identityInvalid = cloneJson(source);
  identityInvalid.entry = "missing";
  const identity = assertFailure(
    callPreflight(preflight, identityInvalid, [candidate]),
    {
      stage: "source-semantics",
      code: "ENTRY_NOT_FOUND",
      pointer: "/entry",
      failureCode: "PUBLISHER_PREFLIGHT_IDENTITY_STAGE_FAILED",
    },
    "intrinsic identity stage vector",
  );

  const invalidRequirementVersion = cloneJson(source);
  invalidRequirementVersion.catalogs[0].version = "1";
  const semver = assertFailure(
    callPreflight(preflight, invalidRequirementVersion, [candidate]),
    {
      stage: "source-semantics",
      code: "run.desen.validator/INVALID_SEMVER",
      pointer: "/catalogs/0/version",
      failureCode: "PUBLISHER_PREFLIGHT_SEMVER_STAGE_FAILED",
    },
    "strict requirement SemVer vector",
  );

  return Object.freeze({ root, embedded, identity, semver });
}

function earlyCandidateNonObservationEvidence(preflight, source) {
  let observations = 0;
  const candidates = new Proxy([], {
    getOwnPropertyDescriptor() {
      observations += 1;
      throw new Error("candidate input must remain unobserved");
    },
    getPrototypeOf() {
      observations += 1;
      throw new Error("candidate input must remain unobserved");
    },
    ownKeys() {
      observations += 1;
      throw new Error("candidate input must remain unobserved");
    },
  });
  const sourceInvalid = cloneJson(source);
  sourceInvalid.catalogs[0].version = "1";
  assertFailure(
    callPreflight(preflight, sourceInvalid, candidates),
    {
      stage: "source-semantics",
      code: "run.desen.validator/INVALID_SEMVER",
      pointer: "/catalogs/0/version",
      failureCode: "PUBLISHER_PREFLIGHT_CANDIDATE_ORDER_FAILED",
    },
    "pre-Catalog Source failure",
  );
  if (observations !== 0) {
    fail(
      "PUBLISHER_PREFLIGHT_CANDIDATE_ORDER_FAILED",
      "Catalog candidates were observed before Source-local preflight completed.",
      { observations },
    );
  }
  return Object.freeze({
    sourceStoppedStage: "source-semantics",
    candidateObservations: 0,
    catalogAuthorityConstructed: false,
  });
}

function catalogAndReferenceEvidence(preflight, source, catalog) {
  const missing = assertFailure(
    callPreflight(preflight, cloneJson(source), []),
    {
      stage: "catalog-resolution",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/catalogs/0",
      failureCode: "PUBLISHER_PREFLIGHT_CATALOG_PASSTHROUGH_FAILED",
    },
    "missing Catalog candidate",
  );

  const tamperedCatalog = cloneJson(catalog);
  const tampered = assertFailure(
    callPreflight(preflight, cloneJson(source), [
      {
        ...candidateFor(tamperedCatalog),
        observedPackageDigest: `sha256:${"2".repeat(64)}`,
      },
    ]),
    {
      stage: "catalog-integrity",
      code: "CATALOG_DIGEST_MISMATCH",
      pointer: "/catalogs/0",
      failureCode: "PUBLISHER_PREFLIGHT_CATALOG_PASSTHROUGH_FAILED",
    },
    "Catalog digest mismatch",
  );

  const unknown = cloneJson(source);
  unknown.surfaces["sign-in"].root.use = "run.desen.unknown/Thing";
  const reference = assertFailure(
    callPreflight(preflight, unknown, [candidateFor(cloneJson(catalog))]),
    {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
      pointer: "/surfaces/sign-in/root/use",
      failureCode: "PUBLISHER_PREFLIGHT_REFERENCE_STAGE_FAILED",
    },
    "unknown static component reference",
  );

  return Object.freeze({
    missingResolution: missing,
    catalogIntegrity: tampered,
    catalogBackedStaticReference: reference,
    invalidCatalogAuthorityPrecedesIndeterminateReference: true,
  });
}

function scopeFenceEvidence(preflight, source, catalog) {
  const contractDeferred = cloneJson(source);
  contractDeferred.surfaces["sign-in"].root.props = {
    ...contractDeferred.surfaces["sign-in"].root.props,
    m06T04UnknownProp: true,
  };
  const contract = callPreflight(preflight, contractDeferred, [candidateFor(cloneJson(catalog))]);
  if (contract?.preflighted !== true) {
    fail(
      "PUBLISHER_PREFLIGHT_SCOPE_FENCE_FAILED",
      "A T04 prop-contract vector was incorrectly absorbed into T03.",
    );
  }

  const runtimeDeferred = cloneJson(source);
  runtimeDeferred.surfaces["sign-in"].state.email.initial = 42;
  const runtime = callPreflight(preflight, runtimeDeferred, [candidateFor(cloneJson(catalog))]);
  if (runtime?.preflighted !== true) {
    fail(
      "PUBLISHER_PREFLIGHT_SCOPE_FENCE_FAILED",
      "A T05 state-compatibility vector was incorrectly absorbed into T03.",
    );
  }
  return Object.freeze({
    unknownPropDeferredTo: "M06-T04",
    incompatibleStateInitialDeferredTo: "M06-T05",
    bothPassM06T03: true,
  });
}

function finiteProfileEvidence(preflight, source, catalog) {
  const invalid = cloneJson(source);
  invalid.entry = "missing";
  const failure = assertFailure(
    callPreflight(preflight, invalid, [candidateFor(cloneJson(catalog))], {
      ...PUBLISH_SOURCE_PREFLIGHT_LIMITS,
      maxDiagnosticPointerCodeUnits: 1,
    }),
    {
      stage: "source-semantics",
      code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
      pointer: "",
      failureCode: "PUBLISHER_PREFLIGHT_LIMIT_VECTOR_FAILED",
    },
    "bounded diagnostic-output profile",
  );

  let candidateObservations = 0;
  const unobservedCandidates = new Proxy([], {
    ownKeys() {
      candidateObservations += 1;
      throw new Error("Catalog candidates must remain unobserved.");
    },
  });
  const longAncestor = "x".repeat(
    PUBLISH_SOURCE_PREFLIGHT_LIMITS.maxDiagnosticPointerCodeUnits + 1,
  );
  let inheritedJsonResult;
  try {
    inheritedJsonResult = preflight(
      `{"${longAncestor}":{"duplicate":1,"duplicate":2}}`,
      unobservedCandidates,
    );
  } catch (error) {
    fail(
      "PUBLISHER_PREFLIGHT_LIMIT_VECTOR_FAILED",
      "Inherited raw-JSON diagnostics escaped the Source-preflight limit boundary.",
      { cause: String(error) },
    );
  }
  const inheritedJson = assertFailure(
    inheritedJsonResult,
    {
      stage: "json-parse",
      code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
      pointer: "",
      failureCode: "PUBLISHER_PREFLIGHT_LIMIT_VECTOR_FAILED",
    },
    "inherited raw-JSON diagnostic profile",
  );
  if (candidateObservations !== 0) {
    fail(
      "PUBLISHER_PREFLIGHT_LIMIT_VECTOR_FAILED",
      "Bounding an inherited JSON diagnostic observed Catalog candidates.",
    );
  }

  const inheritedCatalog = assertFailure(
    callPreflight(preflight, cloneJson(source), [], {
      ...PUBLISH_SOURCE_PREFLIGHT_LIMITS,
      maxAggregateDiagnosticCodeUnits: 1,
    }),
    {
      stage: "catalog-resolution",
      code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
      pointer: "",
      failureCode: "PUBLISHER_PREFLIGHT_LIMIT_VECTOR_FAILED",
    },
    "inherited Catalog-resolution diagnostic profile",
  );

  return Object.freeze({
    defaults: PUBLISH_SOURCE_PREFLIGHT_LIMITS,
    exercisedLimit: "maxDiagnosticPointerCodeUnits",
    exercisedMaximum: 1,
    genericRedactedFailure: failure,
    inheritedJsonFailure: inheritedJson,
    inheritedCatalogFailure: inheritedCatalog,
    inheritedFailureStagesRemainExact: true,
  });
}

function assertPublicPrivacy(publicApi, publisherPackage, declaration) {
  const forbidden = [
    "PUBLISH_SOURCE_PREFLIGHT_LIMITS",
    "SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
    "preflightPublishSource",
    "PublishSourcePreflightResult",
  ];
  const runtimeExports = Object.keys(publicApi).sort();
  if (forbidden.some((name) => runtimeExports.includes(name))) {
    fail(
      "PUBLISHER_PREFLIGHT_PUBLIC_API_EXPOSED",
      "Package-private Source preflight leaked through the root runtime API.",
    );
  }
  if (forbidden.some((name) => declaration.includes(name))) {
    fail(
      "PUBLISHER_PREFLIGHT_PUBLIC_API_EXPOSED",
      "Package-private Source preflight leaked through the root declaration API.",
    );
  }
  if (
    publisherPackage?.exports === null ||
    typeof publisherPackage?.exports !== "object" ||
    Object.keys(publisherPackage.exports).some((key) => key !== ".")
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_PUBLIC_API_EXPOSED",
      "Publisher package exports expose a partial Source-preflight subpath.",
    );
  }
  return Object.freeze({
    rootRuntimeExports: Object.freeze(runtimeExports),
    preflightRuntimeExported: false,
    preflightTypeExported: false,
    preflightSubpathExported: false,
    packagePrivateDistImportUsedByProof: "packages/publisher/dist/source-preflight.js",
  });
}

function moduleImports(source) {
  return [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/gu),
    ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gmu),
  ]
    .map((match) => match[1])
    .filter((value) => value !== undefined)
    .sort();
}

function assertTargetNeutralBoundary(source, publisherPackage) {
  const imports = moduleImports(source);
  if (
    imports.some((specifier) => !ALLOWED_PREFLIGHT_IMPORTS.includes(specifier)) ||
    /\b(?:document|window|navigator|process|Buffer|fetch)\b/u.test(source)
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_TARGET_BOUNDARY_DRIFT",
      "Source preflight acquired a platform, framework, or production-adapter dependency.",
    );
  }
  const dependencies = Object.keys(publisherPackage?.dependencies ?? {}).sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(["@desen/protocol", "@desen/validator"])) {
    fail(
      "PUBLISHER_PREFLIGHT_TARGET_BOUNDARY_DRIFT",
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
        "PUBLISHER_PREFLIGHT_PREREQUISITE_DRIFT",
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
  const [packageTest, typeTest, rootTest, validatorTest] = await Promise.all([
    readRegularBytes("packages/publisher/test/source-preflight.test.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("packages/publisher/test/source-preflight.types.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("tests/publisher-source-preflight.test.mjs").then((bytes) =>
      bytes.toString("utf8"),
    ),
    readRegularBytes("packages/validator/test/semantic-foundation.test.ts").then((bytes) =>
      bytes.toString("utf8"),
    ),
  ]);
  const foundationBlock = validatorTest.match(
    /describe\("phase-aware Source foundation"[\s\S]*?\n\}\);\n\n/u,
  )?.[0];
  return Object.freeze({
    publisherRuntimeCases: (packageTest.match(/^\s*it\("/gmu) ?? []).length,
    compilerNegativeCases: (typeTest.match(/@ts-expect-error/gu) ?? []).length,
    validatorFoundationCases: (foundationBlock?.match(/^\s*it\("/gmu) ?? []).length,
    rootMutationCases: (rootTest.match(/^test\("/gmu) ?? []).length,
  });
}

function countExactOccurrences(text, value) {
  return text.split(value).length - 1;
}

function assertProofDocumentPin(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail(
      "PUBLISHER_PREFLIGHT_PROOF_DOCUMENT_INVALID",
      "The Source-preflight proof document must be text.",
    );
  }
  const expectedHash = `sha256:${artifactSha256}`;
  const digestPins = proofDocument.match(/sha256:[0-9a-f]{64}/gu) ?? [];
  if (
    countExactOccurrences(proofDocument, `\`${ARTIFACT_RELATIVE_PATH}\``) !== 1 ||
    countExactOccurrences(proofDocument, `\`${expectedHash}\``) !== 1 ||
    digestPins.length !== 1 ||
    digestPins[0] !== expectedHash ||
    proofDocument.includes("PENDING_M06_T03_ARTIFACT_SHA256")
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_PROOF_DOCUMENT_DRIFT",
      "The Source-preflight proof document does not uniquely pin the tracked artifact and hash.",
      { expectedArtifactPath: ARTIFACT_RELATIVE_PATH, expectedHash },
    );
  }
}

/**
 * Builds deterministic M06-T03 evidence from the shipped package-private Source preflight.
 */
export async function buildPublisherSourcePreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const [
    sourceDefault,
    catalogDefault,
    publisherPackageDefault,
    preflightSourceDefault,
    preflightDeclarationDefault,
    publicDeclaration,
  ] = await Promise.all([
    readJson(SOURCE_RELATIVE_PATH),
    readJson(CATALOG_RELATIVE_PATH),
    readJson(PUBLISHER_PACKAGE_RELATIVE_PATH),
    readRegularBytes(PREFLIGHT_SOURCE_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PREFLIGHT_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
    readRegularBytes(PUBLIC_DECLARATION_RELATIVE_PATH).then((bytes) => bytes.toString("utf8")),
  ]);

  const preflight = options.preflight ?? preflightPublishSource;
  const source = cloneJson(options.source ?? sourceDefault);
  const catalog = cloneJson(options.catalog ?? catalogDefault);
  const publisherPackage = cloneJson(options.publisherPackage ?? publisherPackageDefault);
  const preflightSource = options.preflightSource ?? preflightSourceDefault;
  const preflightDeclaration = options.preflightDeclaration ?? preflightDeclarationDefault;
  const publicApi = options.publicApi ?? publisherPublicApi;

  if (
    typeof preflight !== "function" ||
    typeof preflightSource !== "string" ||
    typeof preflightDeclaration !== "string"
  ) {
    fail("PUBLISHER_PREFLIGHT_OPTIONS_INVALID", "Evidence overrides have invalid types.");
  }

  assertFixtureIdentity(source, catalog);
  const prerequisites = await verifyPrerequisitePins(options.verifyPrerequisites !== false);
  const success = successEvidence(preflight, source, catalog);
  const stagedFailures = stagedFailureEvidence(preflight, source, catalog);
  const candidateNonObservation = earlyCandidateNonObservationEvidence(preflight, source);
  const catalogsAndReferences = catalogAndReferenceEvidence(preflight, source, catalog);
  const scopeFences = scopeFenceEvidence(preflight, source, catalog);
  const finiteProfile = finiteProfileEvidence(preflight, source, catalog);
  const apiPrivacy = assertPublicPrivacy(publicApi, publisherPackage, publicDeclaration);
  const targetNeutralBoundary = assertTargetNeutralBoundary(preflightSource, publisherPackage);

  if (
    !preflightDeclaration.includes("PublishSourcePreflightResult") ||
    !preflightDeclaration.includes("DesenPreparedSourceFoundation") ||
    !preflightDeclaration.includes("PublishSourcePreflightLimits")
  ) {
    fail(
      "PUBLISHER_PREFLIGHT_DECLARATION_DRIFT",
      "Built package-private declarations no longer document prepared authority and finite limits.",
    );
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.publisher.source-preflight-proof.v1",
    task: "M06-T03",
    result: "PASS",
    summary:
      "The built package-private Publisher preflight composes strict raw JSON, phased Source and embedded-schema validation, intrinsic identity checks, exact Catalog authority, and category-aware static references without emitting a Bundle.",
    prerequisites,
    fixture: Object.freeze({
      sourcePath: SOURCE_RELATIVE_PATH,
      catalogPath: CATALOG_RELATIVE_PATH,
      sourceId: EXPECTED_SOURCE_ID,
      exactTuple: EXPECTED_TUPLE,
    }),
    claims: Object.freeze({
      completeNonterminalAuthority: success,
      exactStoppedStages: stagedFailures,
      earlyCandidateNonObservation: candidateNonObservation,
      catalogAndStaticReferenceOrdering: catalogsAndReferences,
      laterStageScopeFences: scopeFences,
      finiteDiagnosticProfile: finiteProfile,
      terminalFailuresExposeNoPartialAuthorityOrBundle: true,
      rootApiPrivacy: apiPrivacy,
      targetNeutralDependencyBoundary: targetNeutralBoundary,
    }),
    orderingDecision: Object.freeze({
      intrinsicSourceChecksBeforeCatalogCandidates: true,
      catalogAuthorityBeforeCatalogBackedReferenceExistence: true,
      invalidCatalogPrecedesIndeterminateReference: true,
      staticReferenceDiagnosticStage: "source-semantics",
      rationale:
        "An invalid Catalog cannot safely establish whether a Source capability reference exists or has the expected category.",
    }),
    nonclaims: Object.freeze([
      "M06-T03 returns package-private nonterminal authority and does not expose a public publish function.",
      "This task does not validate prop, slot, style, event, command, or behavior contracts assigned to M06-T04.",
      "This task does not discharge dynamic binding, state, predicate, repeat, action, or runtime obligations assigned to M06-T05.",
      "This task does not normalize Source data, calculate digests, pin Bundle tuples, validate a Bundle, calculate a revision, or emit a Bundle.",
      "This task performs no network discovery, package download, activation, rendering, signing, npm publication, or deployment.",
    ]),
    tests: await testInventory(),
    trackedFiles: await fileInventory(),
    reproduction: Object.freeze([
      "pnpm --filter @desen/validator build",
      "pnpm --filter @desen/publisher build",
      "node scripts/generate-publisher-source-preflight-proof.mjs",
      "node scripts/verify-publisher-source-preflight.mjs",
      "node --test tests/publisher-source-preflight.test.mjs",
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
export async function verifyPublisherSourcePreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherSourcePreflightEvidence(options);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularBytes(ARTIFACT_RELATIVE_PATH)
      : Buffer.from(options.artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail(
      "PUBLISHER_PREFLIGHT_ARTIFACT_DRIFT",
      "Tracked Source-preflight evidence differs from a fresh deterministic build.",
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
    sourceId: built.artifact.fixture.sourceId,
    proofDocumentPinned: true,
  });
}

/** Atomically writes exact deterministic M06-T03 evidence bytes. */
export async function writePublisherSourcePreflightEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const built = await buildPublisherSourcePreflightEvidence(options);
  const artifactPath = options.artifactPath ?? DEFAULT_PUBLISHER_SOURCE_PREFLIGHT_ARTIFACT_PATH;
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
