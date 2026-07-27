import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T07 evidence artifact. */
export const DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
);
const HISTORICAL_ARTIFACT_SHA256 =
  "96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7";

/** Absolute path to the reviewed protocol trace ledger used by M02-T07 evidence. */
export const DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the BCP 14 ownership ledger used by M02-T07 evidence. */
export const DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_NORMATIVE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/NORMATIVE-COVERAGE.md",
);

/** Absolute path to the implementation-findings ledger used by M02-T07 evidence. */
export const DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/plan/PROTOCOL-FINDINGS.md",
);

/** Absolute path to the prerequisite M02-T06 structural-validation artifact. */
export const DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_STRUCTURAL_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-structural-validation.json",
);

const REQUIRED_RUNTIME_EXPORTS = Object.freeze([
  "isExactSemanticVersion",
  "validateDesenBundleSemantics",
  "validateDesenCatalogSemantics",
  "validateDesenCatalogSet",
  "validateDesenSemanticFoundation",
  "validateDesenSourceSemantics",
]);

const EXPECTED_SCHEMA_FAMILIES = Object.freeze([
  "SC-004",
  "SC-005",
  "SC-006",
  "SC-007",
  "SC-009",
  "SC-013",
  "SC-016",
  "SC-017",
  "SC-018",
  "SC-020",
  "SC-024",
  "SC-025",
  "SC-026",
  "SC-027",
  "SC-034",
  "SC-046",
  "SC-049",
  "SC-050",
  "SC-051",
]);
const EXPECTED_SCHEMA_CONSTRAINTS = 201;
const EXPECTED_CONFORMANCE_RULES = Object.freeze(["C-003"]);
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-014",
  "R-015",
  "R-016",
  "R-017",
  "R-023",
  "R-024",
  "R-033",
  "R-069",
  "R-083",
  "R-147",
]);
const EXPECTED_MANDATORY_CLAUSES = Object.freeze([
  "N-006",
  "N-007",
  "N-008",
  "N-009",
  "N-012",
  "N-017",
  "N-022",
  "N-025",
]);
const EXPECTED_RECOMMENDED_CLAUSES = Object.freeze(["S-003"]);
const EXPECTED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-003", code: "DUPLICATE_SURFACE_ID" }),
  Object.freeze({ id: "D-004", code: "DUPLICATE_NODE_ID" }),
  Object.freeze({ id: "D-005", code: "ENTRY_NOT_FOUND" }),
  Object.freeze({ id: "D-006", code: "UNKNOWN_CAPABILITY" }),
  Object.freeze({ id: "D-007", code: "AMBIGUOUS_CAPABILITY" }),
]);
const IMPLEMENTATION_DIAGNOSTICS = Object.freeze([
  "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
  "run.desen.validator/INVALID_SEMVER",
]);

const SEMVER_GOLDENS = Object.freeze({
  accepted: Object.freeze([
    "0.0.0",
    "1.2.3",
    "1.0.0-0",
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-0.3.7",
    "1.0.0-x.7.z.92",
    "1.0.0+20130313144700",
    "1.0.0+001",
    "1.0.0-beta+exp.sha.5114f85",
    "999999999999999999999999999999.0.0",
  ]),
  rejected: Object.freeze([
    "1",
    "1.2",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "v1.2.3",
    "=1.2.3",
    "^1.2.3",
    "1.2.x",
    "1.2.3-",
    "1.2.3+",
    "1.2.3-01",
    "1.2.3-alpha..1",
    "1.2.3+build..1",
    " 1.2.3",
    "1.2.3 ",
    "1.2.3-α",
  ]),
});

const OFFICIAL_SEMANTIC_CASES = Object.freeze([
  Object.freeze({
    file: "invalid/source-duplicate-node-id.json",
    code: "DUPLICATE_NODE_ID",
    pointer: "/surfaces/home/root/slots/default/1/id",
  }),
  Object.freeze({
    file: "invalid/source-unknown-capability.json",
    code: "UNKNOWN_CAPABILITY",
    pointer: "/surfaces/home/root/slots/default/0/use",
  }),
]);
const T07_SCOPE_FENCE_CASES = Object.freeze([
  Object.freeze({ file: "invalid/source-unknown-event.json", target: "source" }),
  Object.freeze({ file: "invalid/bundle-revision-mismatch.json", target: "bundle" }),
  Object.freeze({ file: "invalid/bundle-catalog-digest-mismatch.json", target: "bundle" }),
]);
const FROZEN_EXAMPLES = Object.freeze([
  Object.freeze({ file: "catalog.web.example.json", target: "catalog" }),
  Object.freeze({ file: "sign-in.source.desen.json", target: "source" }),
  Object.freeze({ file: "sign-in.bundle.desen.json", target: "bundle" }),
  Object.freeze({ file: "sortable-list.source.desen.json", target: "source" }),
  Object.freeze({ file: "store-map.source.desen.json", target: "source" }),
]);

const FIXED_TRACKED_PATHS = Object.freeze([
  "docs/proof/protocol-0.1.0-traceability.json",
  "packages/protocol/src/canonicalization.ts",
  "packages/protocol/src/diagnostics.ts",
  "packages/protocol/src/index.ts",
  "packages/protocol/src/json-pointer.ts",
  "packages/validator/tsconfig.json",
  "packages/validator/tsconfig.build.json",
  "scripts/lib/protocol-semantic-foundation-proof.mjs",
  "scripts/generate-protocol-semantic-foundation-proof.mjs",
  "scripts/verify-protocol-semantic-foundation.mjs",
  "tests/protocol-semantic-foundation.test.mjs",
]);

const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Stable internal failure raised by M02-T07 evidence generation and verification. */
export class ProtocolSemanticFoundationEvidenceError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolSemanticFoundationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolSemanticFoundationEvidenceError(code, message, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function authenticateHistoricalArtifact(artifactPath, suppliedBytes) {
  let bytes;
  if (suppliedBytes === undefined) {
    let entry;
    try {
      entry = await lstat(artifactPath);
    } catch (error) {
      fail("SEMANTIC_ARTIFACT_DRIFT", "Immutable M02-T07 evidence is missing.", {
        cause: String(error),
      });
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "SEMANTIC_ARTIFACT_UNSUPPORTED_ENTRY",
        "Immutable M02-T07 evidence must be a regular non-symlink file.",
      );
    }
    bytes = await readFile(artifactPath);
  } else {
    bytes = Buffer.from(suppliedBytes);
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail("SEMANTIC_ARTIFACT_DRIFT", "Immutable task-time M02-T07 evidence bytes changed.", {
      expectedSha256: HISTORICAL_ARTIFACT_SHA256,
      actualSha256,
    });
  }

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("SEMANTIC_ARTIFACT_DRIFT", "Immutable M02-T07 evidence is not valid JSON.");
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M02-T07" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-semantic-foundation-v1" ||
    artifact.protocolVersion !== "0.1.0" ||
    artifact.traceability?.schemaFamilyCount !== 19 ||
    artifact.traceability?.schemaConstraints !== 201 ||
    artifact.traceability?.coreDiagnostics?.length !== 5 ||
    artifact.semanticVersioning?.goldens?.length !== 28 ||
    artifact.frozenValidation?.officialSemanticInvalid?.length !== 2 ||
    artifact.frozenValidation?.laterTaskScopeAccepted?.length !== 3 ||
    artifact.frozenValidation?.validExamples?.length !== 5 ||
    artifact.publicApi?.runtimeExports?.length !== 6 ||
    artifact.security?.dynamicExecution !== false
  ) {
    fail(
      "SEMANTIC_ARTIFACT_DRIFT",
      "Immutable M02-T07 evidence no longer has its reviewed identity, inventory, or semantics.",
    );
  }
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(bytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertJsonEqual(actual, expected, label, code = "SEMANTIC_GOLDEN_MISMATCH") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} differs from its reviewed value.`, { expected, actual });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function reverseObjectMemberOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectMemberOrder);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([key, child]) => [key, reverseObjectMemberOrder(child)]),
    );
  }
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function diagnosticIdentity(result) {
  return (result?.diagnostics ?? []).map(({ code, pointer }) => ({ code, pointer }));
}

function assertSuccess(result, label) {
  if (result?.valid !== true || !Array.isArray(result.diagnostics) || result.diagnostics.length) {
    fail("SEMANTIC_VALID_CASE_FAILED", `${label} did not pass semantic validation.`, {
      diagnostics: diagnosticIdentity(result),
    });
  }
  return result;
}

function assertFailure(result, label) {
  if (result?.valid !== false || !Array.isArray(result.diagnostics)) {
    fail("SEMANTIC_INVALID_CASE_ACCEPTED", `${label} unexpectedly passed semantic validation.`);
  }
  return result;
}

function requireDiagnostic(result, code, pointer, label) {
  assertFailure(result, label);
  const identities = diagnosticIdentity(result);
  if (
    !identities.some((diagnostic) => diagnostic.code === code && diagnostic.pointer === pointer)
  ) {
    fail("SEMANTIC_DIAGNOSTIC_MISMATCH", `${label} omitted its exact diagnostic.`, {
      expected: { code, pointer },
      actual: identities,
    });
  }
  return identities;
}

function requireImplementationDiagnostic(result, code, pointer, label) {
  const identities = requireDiagnostic(result, code, pointer, label);
  const diagnostic = result.diagnostics.find(
    (candidate) => candidate.code === code && candidate.pointer === pointer,
  );
  if (diagnostic === undefined || Object.hasOwn(diagnostic, "classification")) {
    fail(
      "SEMANTIC_DIAGNOSTIC_MISMATCH",
      `${label} did not preserve the PF-009 namespaced diagnostic contract.`,
    );
  }
  return identities;
}

function isDeeplyFrozen(root) {
  const pending = [root];
  const visited = new WeakSet();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (!Object.isFrozen(value)) return false;
    pending.push(...Object.values(value));
  }
  return true;
}

function namedExports(indexSource, pattern) {
  return new Set(
    [...indexSource.matchAll(pattern)].flatMap(([, names]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "" && !name.startsWith("type ")),
    ),
  );
}

async function loadValidatorApi() {
  return import(VALIDATOR_API_URL.href);
}

async function verifyPublicApi(api) {
  const indexSource = await readFile(
    path.join(WORKSPACE_ROOT, "packages/validator/src/index.ts"),
    "utf8",
  );
  if (/export\s+\*/u.test(indexSource)) {
    fail("SEMANTIC_PUBLIC_EXPORT_DRIFT", "The validator root may not use wildcard exports.");
  }
  const sourceExports = namedExports(indexSource, /export\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu);
  for (const exportName of REQUIRED_RUNTIME_EXPORTS) {
    if (!sourceExports.has(exportName) || typeof api[exportName] !== "function") {
      fail("SEMANTIC_PUBLIC_EXPORT_DRIFT", `The validator no longer exposes ${exportName}.`, {
        exportName,
      });
    }
  }
}

function commandSteps(command) {
  return typeof command === "string" ? command.split(/\s+&&\s+/u) : [];
}

async function verifyCommandWiring() {
  const [workspacePackage, protocolPackage, validatorPackage, turbo] = await Promise.all(
    [
      "package.json",
      "packages/protocol/package.json",
      "packages/validator/package.json",
      "turbo.json",
    ].map((relativePath) => readJson(path.join(WORKSPACE_ROOT, relativePath))),
  );
  const exactRootScripts = {
    "generate:protocol-semantic-foundation":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-semantic-foundation-proof.mjs",
    "verify:protocol-semantic-foundation":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-semantic-foundation.mjs",
    "test:protocol-semantic-foundation":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:semantic-foundation && node --test tests/protocol-semantic-foundation.test.mjs",
  };
  for (const [name, command] of Object.entries(exactRootScripts)) {
    if (workspacePackage.scripts?.[name] !== command) {
      fail("SEMANTIC_COMMAND_WIRING_DRIFT", `Root command ${name} is missing or stale.`);
    }
  }
  for (const [scriptName, requiredStep] of [
    ["test", "pnpm test:protocol-semantic-foundation"],
    ["check", "pnpm verify:protocol-semantic-foundation"],
  ]) {
    if (!commandSteps(workspacePackage.scripts?.[scriptName]).includes(requiredStep)) {
      fail("SEMANTIC_COMMAND_WIRING_DRIFT", `Root ${scriptName} omits ${requiredStep}.`);
    }
  }
  if (
    validatorPackage.scripts?.["test:semantic-foundation"] !==
    "vitest run test/semantic-foundation.test.ts"
  ) {
    fail("SEMANTIC_COMMAND_WIRING_DRIFT", "The validator semantic test command is stale.");
  }
  assertJsonEqual(
    validatorPackage.dependencies,
    { "@desen/protocol": "workspace:*" },
    "validator runtime dependencies",
    "SEMANTIC_RUNTIME_DEPENDENCY_DRIFT",
  );
  if (
    validatorPackage.license !== "Apache-2.0" ||
    protocolPackage.license !== "Apache-2.0" ||
    workspacePackage.devDependencies?.prettier !== "3.9.6"
  ) {
    fail(
      "SEMANTIC_RUNTIME_DEPENDENCY_DRIFT",
      "The recorded runtime license or evidence formatter version changed.",
    );
  }
  for (const taskName of ["test", "test:coverage"]) {
    const inputs = turbo.tasks?.[taskName]?.inputs ?? [];
    for (const requiredInput of [
      "../../scripts/lib/protocol-semantic-foundation-proof.mjs",
      "../../tests/protocol-semantic-foundation.test.mjs",
    ]) {
      if (!inputs.includes(requiredInput)) {
        fail("SEMANTIC_COMMAND_WIRING_DRIFT", `Turbo ${taskName} does not track ${requiredInput}.`);
      }
    }
  }
}

function ownedIds(entries, owner, ownerField = "owners") {
  return entries
    .filter((entry) => entry[ownerField]?.includes(owner))
    .map(({ id }) => id)
    .sort(compareText);
}

async function verifyTraceability(tracePath) {
  const trace = await readJson(tracePath);
  const families = trace.schemaFamilies.filter(({ semanticOwners }) =>
    semanticOwners?.includes("M02-T07"),
  );
  assertJsonEqual(
    families.map(({ id }) => id).sort(compareText),
    [...EXPECTED_SCHEMA_FAMILIES].sort(compareText),
    "M02-T07 schema families",
    "SEMANTIC_TRACE_DRIFT",
  );
  const constraintCount = families.reduce(
    (total, { expectedConstraints }) => total + expectedConstraints,
    0,
  );
  if (constraintCount !== EXPECTED_SCHEMA_CONSTRAINTS) {
    fail("SEMANTIC_TRACE_DRIFT", "M02-T07 schema constraint ownership changed.", {
      expected: EXPECTED_SCHEMA_CONSTRAINTS,
      actual: constraintCount,
    });
  }
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T07"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "M02-T07 prose rules",
    "SEMANTIC_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T07"),
    [...EXPECTED_CONFORMANCE_RULES],
    "M02-T07 conformance rules",
    "SEMANTIC_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T07"))
    .map(({ id, anchor: code }) => ({ id, code }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_CORE_DIAGNOSTICS,
    "M02-T07 core diagnostics",
    "SEMANTIC_TRACE_DRIFT",
  );
  return { familyCount: families.length, constraintCount };
}

function parseCoverageRows(markdown) {
  const rows = new Map();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\| ((?:N|S)-\d{3}) \|/u);
    if (!match) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.set(match[1], {
      id: match[1],
      owners: cells[3] ?? "",
      status: cells[4] ?? "",
    });
  }
  return rows;
}

async function verifyNormativeCoverage(normativeCoveragePath) {
  const rows = parseCoverageRows(await readFile(normativeCoveragePath, "utf8"));
  const owned = [...rows.values()]
    .filter(({ owners }) => owners.includes("M02-T07"))
    .map(({ id }) => id)
    .sort(compareText);
  assertJsonEqual(
    owned,
    [...EXPECTED_MANDATORY_CLAUSES, ...EXPECTED_RECOMMENDED_CLAUSES].sort(compareText),
    "M02-T07 BCP 14 ownership",
    "SEMANTIC_NORMATIVE_COVERAGE_DRIFT",
  );
  for (const id of [...EXPECTED_MANDATORY_CLAUSES, ...EXPECTED_RECOMMENDED_CLAUSES]) {
    if (!rows.get(id)?.owners.includes("M02-T07")) {
      fail("SEMANTIC_NORMATIVE_COVERAGE_DRIFT", `${id} lost M02-T07 ownership.`);
    }
  }
  return {
    mandatory: EXPECTED_MANDATORY_CLAUSES.map((id) => ({ id, status: rows.get(id).status })),
    recommended: EXPECTED_RECOMMENDED_CLAUSES.map((id) => ({
      id,
      status: rows.get(id).status,
    })),
  };
}

async function verifyImplementationFinding(findingsPath) {
  const findings = await readFile(findingsPath, "utf8");
  const start = findings.indexOf("## PF-009 ");
  const end = findings.indexOf("\n## ", start + 1);
  if (start < 0) {
    fail("SEMANTIC_FINDING_DRIFT", "PF-009 is missing from the findings ledger.");
  }
  const section = findings.slice(start, end < 0 ? undefined : end);
  const codes = [...section.matchAll(/`(run\.desen\.validator\/[A-Z_]+)`/gu)]
    .map(([, code]) => code)
    .sort(compareText);
  assertJsonEqual(
    codes,
    [...IMPLEMENTATION_DIAGNOSTICS].sort(compareText),
    "PF-009 implementation diagnostics",
    "SEMANTIC_FINDING_DRIFT",
  );
  return codes;
}

async function verifyStructuralDependency(structuralArtifactPath) {
  const bytes = await readFile(structuralArtifactPath);
  let artifact;
  try {
    artifact = JSON.parse(bytes);
  } catch {
    fail("SEMANTIC_STRUCTURAL_DEPENDENCY_DRIFT", "The M02-T06 artifact is not valid JSON.");
  }
  if (
    artifact.task !== "M02-T06" ||
    artifact.result !== "PASS" ||
    artifact.protocolVersion !== "0.1.0"
  ) {
    fail(
      "SEMANTIC_STRUCTURAL_DEPENDENCY_DRIFT",
      "The prerequisite M02-T06 artifact does not record a passing DESEN 0.1.0 result.",
      { task: artifact.task, result: artifact.result, protocolVersion: artifact.protocolVersion },
    );
  }
  return {
    path: path.relative(WORKSPACE_ROOT, structuralArtifactPath),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    task: artifact.task,
    profile: artifact.profile,
  };
}

async function createCatalogSet(api, catalogs, label) {
  const result = assertSuccess(api.validateDesenCatalogSet(catalogs), label);
  if (result.value === null || typeof result.value !== "object" || !Object.isFrozen(result.value)) {
    fail(
      "SEMANTIC_CATALOG_SET_BOUNDARY_FAILED",
      `${label} did not return a frozen branded catalog set.`,
    );
  }
  return { result, value: result.value };
}

async function verifySemverGoldens(api, catalog, catalogSet) {
  const results = [];
  for (const version of SEMVER_GOLDENS.accepted) {
    const actual = api.isExactSemanticVersion(version);
    if (actual !== true) {
      fail("SEMANTIC_SEMVER_GOLDEN_MISMATCH", `Valid SemVer ${version} was rejected.`);
    }
    results.push({ version, valid: true });
  }
  for (const version of SEMVER_GOLDENS.rejected) {
    const actual = api.isExactSemanticVersion(version);
    if (actual !== false) {
      fail("SEMANTIC_SEMVER_GOLDEN_MISMATCH", `Invalid SemVer ${version} was accepted.`);
    }
    results.push({ version, valid: false });
  }

  const invalidCatalog = cloneJson(catalog);
  invalidCatalog.version = "1.0.0-01";
  const catalogDiagnostics = requireImplementationDiagnostic(
    api.validateDesenCatalogSemantics(invalidCatalog),
    "run.desen.validator/INVALID_SEMVER",
    "/version",
    "catalog invalid SemVer",
  );

  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  source.catalogs[0].version = "^1.0.0";
  const sourceDiagnostics = requireImplementationDiagnostic(
    api.validateDesenSourceSemantics(source, catalogSet),
    "run.desen.validator/INVALID_SEMVER",
    "/catalogs/0/version",
    "source invalid SemVer",
  );

  const bundle = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json"));
  bundle.requires.catalogs[0].version = "1.0.0-01";
  const bundleDiagnostics = requireImplementationDiagnostic(
    api.validateDesenBundleSemantics(bundle, catalogSet),
    "run.desen.validator/INVALID_SEMVER",
    "/requires/catalogs/0/version",
    "bundle invalid SemVer",
  );

  return {
    standard: "Semantic Versioning 2.0.0 exact syntax",
    normalization: "none",
    precedenceComparison: "not used for package identity",
    goldens: results,
    integration: {
      catalog: catalogDiagnostics,
      source: sourceDiagnostics,
      bundle: bundleDiagnostics,
    },
  };
}

async function verifyRequirementExactness(api, catalogSet, catalog) {
  const mismatchValues = {
    id: "com.example.web-catalog-x",
    version: "1.0.1",
    target: "Web-React",
  };
  const sourceMismatches = {};
  const bundleMismatches = {};
  for (const [field, mismatch] of Object.entries(mismatchValues)) {
    const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
    source.catalogs[0][field] = mismatch;
    sourceMismatches[field] = requireImplementationDiagnostic(
      api.validateDesenSourceSemantics(source, catalogSet),
      "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
      "/catalogs/0",
      `source exact ${field} mismatch`,
    );

    const bundle = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json"));
    bundle.requires.catalogs[0][field] = mismatch;
    bundleMismatches[field] = requireImplementationDiagnostic(
      api.validateDesenBundleSemantics(bundle, catalogSet),
      "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
      "/requires/catalogs/0",
      `bundle exact ${field} mismatch`,
    );
  }

  const pristineSource = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const forgedCatalog = await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json"));
  const forgedResult = api.validateDesenSourceSemantics(
    pristineSource,
    Object.freeze([forgedCatalog]),
  );
  assertFailure(forgedResult, "forged catalog set");
  if (
    !diagnosticIdentity(forgedResult).some(
      ({ code }) => code === "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
    )
  ) {
    fail(
      "SEMANTIC_CATALOG_SET_BOUNDARY_FAILED",
      "A forged catalog set did not fail with CATALOG_REQUIREMENT_MISMATCH.",
      { diagnostics: diagnosticIdentity(forgedResult) },
    );
  }
  const forgedDiagnostic = forgedResult.diagnostics.find(
    ({ code }) => code === "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
  );
  if (forgedDiagnostic === undefined || Object.hasOwn(forgedDiagnostic, "classification")) {
    fail(
      "SEMANTIC_CATALOG_SET_BOUNDARY_FAILED",
      "A forged catalog set did not preserve the PF-009 namespaced diagnostic contract.",
    );
  }

  const extraCatalog = cloneJson(catalog);
  extraCatalog.id = "com.example.secondary-catalog";
  extraCatalog.packageDigest = `sha256:${"1".repeat(64)}`;
  extraCatalog.components = {};
  extraCatalog.behaviors = {};
  extraCatalog.resources = {};
  extraCatalog.operations = {
    "com.example.secondary/ping": cloneJson(catalog.operations["com.example.auth/signIn"]),
  };
  const catalogPool = await createCatalogSet(
    api,
    [catalog, extraCatalog],
    "catalog pool with one undeclared extra package",
  );
  assertSuccess(
    api.validateDesenSourceSemantics(pristineSource, catalogPool.value),
    "Source with an unused undeclared catalog in the trusted pool",
  );
  const unauthorizedSource = cloneJson(pristineSource);
  unauthorizedSource.surfaces["sign-in"].root.slots.default[4].on.press[0].operation =
    "com.example.secondary/ping";
  const unauthorizedPointer = "/surfaces/sign-in/root/slots/default/4/on/press/0/operation";
  const unauthorizedDiagnostics = requireDiagnostic(
    api.validateDesenSourceSemantics(unauthorizedSource, catalogPool.value),
    "UNKNOWN_CAPABILITY",
    unauthorizedPointer,
    "capability from an undeclared extra catalog",
  );

  return {
    comparison: "literal id/version/target equality without trim, case-fold, or substitution",
    mismatchValues,
    sourceMismatches,
    bundleMismatches,
    forgedCatalogSet: diagnosticIdentity(forgedResult),
    undeclaredExtraCatalog: {
      acceptedInTrustedPool: true,
      ignoredWhenUnused: true,
      capabilityNotAuthorized: unauthorizedDiagnostics,
    },
  };
}

async function verifyCatalogNamespace(api, catalog) {
  const validSet = await createCatalogSet(api, [catalog], "frozen catalog set");
  const duplicateCatalog = cloneJson(catalog);
  duplicateCatalog.id = "com.example.duplicate-catalog";
  duplicateCatalog.packageDigest = `sha256:${"0".repeat(64)}`;
  duplicateCatalog.components = {
    "com.example.ui/Button": cloneJson(catalog.components["com.example.ui/Button"]),
  };
  duplicateCatalog.behaviors = {};
  duplicateCatalog.operations = {};
  duplicateCatalog.resources = {};

  const firstDuplicateResult = api.validateDesenCatalogSet([catalog, duplicateCatalog]);
  const secondDuplicateResult = api.validateDesenCatalogSet([catalog, duplicateCatalog]);
  const expectedDuplicate = [
    {
      code: "AMBIGUOUS_CAPABILITY",
      pointer: "/1/components/com.example.ui~1Button",
    },
  ];
  assertJsonEqual(
    diagnosticIdentity(assertFailure(firstDuplicateResult, "duplicate catalog namespace")),
    expectedDuplicate,
    "duplicate catalog namespace diagnostic",
    "SEMANTIC_NAMESPACE_GOLDEN_MISMATCH",
  );
  assertJsonEqual(
    diagnosticIdentity(secondDuplicateResult),
    expectedDuplicate,
    "repeated duplicate catalog namespace diagnostic",
    "SEMANTIC_DETERMINISM_FAILED",
  );
  return {
    value: validSet.value,
    evidence: {
      validCatalogCount: 1,
      duplicateCapability: "com.example.ui/Button",
      duplicateDiagnostics: expectedDuplicate,
      winnerSelection: "none",
      lookupStructure: "one namespace with explicit ambiguous outcomes",
    },
  };
}

async function verifyFrozenDocuments(api, conformanceCatalogSet, exampleCatalogSet) {
  const conformanceCatalog = await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json"));
  const validSource = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const validBundle = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json"));

  assertSuccess(api.validateDesenCatalogSemantics(conformanceCatalog), "frozen valid catalog");
  assertSuccess(
    api.validateDesenSourceSemantics(validSource, conformanceCatalogSet),
    "frozen valid source",
  );
  assertSuccess(
    api.validateDesenBundleSemantics(validBundle, conformanceCatalogSet),
    "frozen valid bundle",
  );
  assertSuccess(
    api.validateDesenSemanticFoundation("catalog", conformanceCatalog),
    "generic catalog validation",
  );
  assertSuccess(
    api.validateDesenSemanticFoundation("source", validSource, conformanceCatalogSet),
    "generic source validation",
  );
  assertSuccess(
    api.validateDesenSemanticFoundation("bundle", validBundle, conformanceCatalogSet),
    "generic bundle validation",
  );

  const officialInvalid = [];
  for (const vector of OFFICIAL_SEMANTIC_CASES) {
    const document = await readJson(path.join(CONFORMANCE_ROOT, vector.file));
    const result = api.validateDesenSourceSemantics(document, conformanceCatalogSet);
    const expected = [{ code: vector.code, pointer: vector.pointer }];
    assertJsonEqual(
      diagnosticIdentity(assertFailure(result, vector.file)),
      expected,
      vector.file,
      "SEMANTIC_OFFICIAL_VECTOR_MISMATCH",
    );
    officialInvalid.push({ file: vector.file, target: "source", diagnostics: expected });
  }

  const scopeFence = [];
  for (const vector of T07_SCOPE_FENCE_CASES) {
    const document = await readJson(path.join(CONFORMANCE_ROOT, vector.file));
    const result =
      vector.target === "source"
        ? api.validateDesenSourceSemantics(document, conformanceCatalogSet)
        : api.validateDesenBundleSemantics(document, conformanceCatalogSet);
    assertSuccess(result, `T07 scope fence ${vector.file}`);
    scopeFence.push({ ...vector, valid: true });
  }

  const examples = [];
  for (const vector of FROZEN_EXAMPLES) {
    const document = await readJson(path.join(EXAMPLES_ROOT, vector.file));
    const result =
      vector.target === "catalog"
        ? api.validateDesenCatalogSemantics(document)
        : vector.target === "source"
          ? api.validateDesenSourceSemantics(document, exampleCatalogSet)
          : api.validateDesenBundleSemantics(document, exampleCatalogSet);
    assertSuccess(result, `frozen example ${vector.file}`);
    examples.push({ ...vector, valid: true });
  }

  return {
    validConformance: [
      { file: "valid/web.catalog.json", target: "catalog", valid: true },
      { file: "valid/sign-in.source.json", target: "source", valid: true },
      { file: "valid/sign-in.bundle.json", target: "bundle", valid: true },
    ],
    genericDispatcherTargets: ["catalog", "source", "bundle"],
    officialSemanticInvalid: officialInvalid,
    laterTaskScopeAccepted: scopeFence,
    validExamples: examples,
  };
}

async function verifyExtensionOpacity(api, catalogSet) {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const extension = JSON.parse(
    '{"plain":{"use":"com.attacker/Fake","$ref":"state.missing","version":"^9"},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"com.example.safe":{"ordered":[3,2,1]}}',
  );
  source.extensions = extension;
  source.surfaces["sign-in"].root.extensions = cloneJson(extension);
  const expectedTopLevel = stableJson(extension);
  const result = assertSuccess(
    api.validateDesenSourceSemantics(source, catalogSet),
    "opaque extension source",
  );
  if (
    stableJson(result.value.extensions) !== expectedTopLevel ||
    stableJson(result.value.surfaces["sign-in"].root.extensions) !== expectedTopLevel ||
    !Object.hasOwn(result.value.extensions, "__proto__") ||
    !isDeeplyFrozen(result.value) ||
    Object.prototype.polluted !== undefined
  ) {
    fail(
      "SEMANTIC_EXTENSION_OPACITY_FAILED",
      "Unknown extensions were interpreted, dropped, polluted a prototype, or escaped freezing.",
    );
  }
  extension.plain.use = "caller-mutated";
  if (result.value.extensions.plain.use !== "com.attacker/Fake") {
    fail(
      "SEMANTIC_EXTENSION_OPACITY_FAILED",
      "The semantic success value retained caller-owned extension state.",
    );
  }
  return {
    nonNamespacedKeyAccepted: true,
    dangerousOwnKeysPreserved: ["__proto__", "constructor"],
    apparentCoreFieldsIgnored: ["use", "$ref", "version"],
    arrayOrderPreserved: [3, 2, 1],
    callerMutationIsolated: true,
    resultDeeplyFrozen: true,
    prototypePolluted: false,
  };
}

async function verifyDeterminism(api, catalogSet) {
  const duplicate = await readJson(
    path.join(CONFORMANCE_ROOT, "invalid/source-duplicate-node-id.json"),
  );
  const first = diagnosticIdentity(api.validateDesenSourceSemantics(duplicate, catalogSet));
  const second = diagnosticIdentity(api.validateDesenSourceSemantics(duplicate, catalogSet));
  const permuted = reverseObjectMemberOrder(duplicate);
  const third = diagnosticIdentity(api.validateDesenSourceSemantics(permuted, catalogSet));
  assertJsonEqual(first, second, "repeated semantic diagnostics", "SEMANTIC_DETERMINISM_FAILED");
  assertJsonEqual(
    first,
    third,
    "object insertion-order semantic diagnostics",
    "SEMANTIC_DETERMINISM_FAILED",
  );
  return {
    repeatedBuildInputsEqual: true,
    objectInsertionOrderIndependent: true,
    objectPermutation: "all object members recursively reversed; array order preserved",
    comparison: "locale-independent ECMAScript code-unit order",
    arrays: "protocol-semantic order preserved",
    diagnosticIdentity: first,
  };
}

async function inventoryRegularFiles(root, relativeDirectory = "") {
  const directory = path.join(root, ...relativeDirectory.split("/").filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, ...relativePath.split("/"));
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      fail("SEMANTIC_UNSUPPORTED_ENTRY", "A reviewed directory contains a symlink.", {
        relativePath,
      });
    }
    if (entry.isDirectory()) files.push(...(await inventoryRegularFiles(root, relativePath)));
    else if (entry.isFile()) files.push(relativePath);
    else {
      fail("SEMANTIC_UNSUPPORTED_ENTRY", "A reviewed directory contains a special entry.", {
        relativePath,
      });
    }
  }
  return files;
}

async function verifyPlatformAndDistributionAudit() {
  const sourceRoot = path.join(WORKSPACE_ROOT, "packages/validator/src");
  const sourceFiles = (await inventoryRegularFiles(sourceRoot))
    .filter((file) => file.endsWith(".ts"))
    .sort(compareText);
  const sourceText = (
    await Promise.all(
      sourceFiles.map((file) => readFile(path.join(sourceRoot, ...file.split("/")), "utf8")),
    )
  ).join("\n");
  const sourceForbidden = [
    ["runtime require", /\brequire\s*\(/u],
    ["eval", /\beval\s*\(/u],
    ["Function constructor", /\bnew\s+Function\b/u],
    ["dynamic import", /\bimport\s*\(/u],
    ["network fetch", /\bfetch\s*\(/u],
    ["Node built-in import", /from\s+["']node:/u],
    ["framework import", /from\s+["'](?:react|react-dom|next)(?:["'/])/u],
    ["workspace absolute path", /\/Users\//u],
    ["frozen upstream runtime import", /from\s+["'][^"']*upstream\//u],
    ["TypeScript runtime import", /from\s+["'][^"']*\.ts["']/u],
  ];
  const sourceViolations = sourceForbidden
    .filter(([, pattern]) => pattern.test(sourceText))
    .map(([label]) => label);
  if (sourceViolations.length > 0) {
    fail("SEMANTIC_PLATFORM_AUDIT_FAILED", "Validator source violates platform boundaries.", {
      violations: sourceViolations,
    });
  }

  const distRoot = path.join(WORKSPACE_ROOT, "packages/validator/dist");
  const actualDistFiles = (await inventoryRegularFiles(distRoot)).sort(compareText);
  const expectedDistFiles = sourceFiles
    .flatMap((file) => {
      const module = file.slice(0, -3);
      return [".d.ts", ".d.ts.map", ".js", ".js.map"].map((suffix) => `${module}${suffix}`);
    })
    .sort(compareText);
  assertJsonEqual(
    actualDistFiles,
    expectedDistFiles,
    "validator built distribution inventory",
    "SEMANTIC_DIST_AUDIT_FAILED",
  );
  const runtimeFiles = actualDistFiles.filter((file) => file.endsWith(".js"));
  const runtimeText = (
    await Promise.all(
      runtimeFiles.map((file) => readFile(path.join(distRoot, ...file.split("/")), "utf8")),
    )
  ).join("\n");
  const runtimeForbidden = [
    ...sourceForbidden,
    ["frozen upstream path", /packages\/protocol\/upstream/u],
  ];
  const runtimeViolations = runtimeForbidden
    .filter(([, pattern]) => pattern.test(runtimeText))
    .map(([label]) => label);
  if (runtimeViolations.length > 0) {
    fail("SEMANTIC_DIST_AUDIT_FAILED", "Built validator violates platform boundaries.", {
      violations: runtimeViolations,
    });
  }
  return {
    sourceFiles,
    distributionFiles: actualDistFiles,
    runtimeFiles,
    forbiddenConstructs: sourceForbidden.map(([label]) => label),
  };
}

async function trackedImplementationPaths() {
  const paths = new Set(FIXED_TRACKED_PATHS);
  for (const directory of [
    "packages/validator/src",
    "packages/validator/scripts",
    "packages/validator/test",
  ]) {
    const files = await inventoryRegularFiles(path.join(WORKSPACE_ROOT, directory));
    for (const file of files) paths.add(`${directory}/${file}`);
  }
  return [...paths].sort(compareText);
}

async function trackedFileEvidence() {
  const evidence = [];
  for (const relativePath of await trackedImplementationPaths()) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, ...relativePath.split("/")));
    evidence.push({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  return evidence;
}

async function assertWritableArtifactPath(artifactPath) {
  try {
    const stats = await lstat(artifactPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("SEMANTIC_ARTIFACT_UNSUPPORTED_ENTRY", "Evidence destination must be a regular file.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const parentStats = await lstat(path.dirname(artifactPath));
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
    fail(
      "SEMANTIC_ARTIFACT_UNSUPPORTED_ENTRY",
      "Evidence destination parent must be a real directory.",
    );
  }
}

/** Builds deterministic M02-T07 semantic-foundation evidence entirely in memory. */
export async function buildProtocolSemanticFoundationEvidence({
  tracePath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_TRACE_PATH,
  normativeCoveragePath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_NORMATIVE_PATH,
  findingsPath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_FINDINGS_PATH,
  structuralArtifactPath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_STRUCTURAL_ARTIFACT_PATH,
  validatorApi,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot ? await verifyProtocolSnapshot() : EXPECTED_PROTOCOL_SNAPSHOT;
  const api = validatorApi ?? (await loadValidatorApi());
  const trace = await verifyTraceability(tracePath);
  const normative = await verifyNormativeCoverage(normativeCoveragePath);
  const implementationDiagnostics = await verifyImplementationFinding(findingsPath);
  const structuralDependency = await verifyStructuralDependency(structuralArtifactPath);
  await verifyPublicApi(api);
  await verifyCommandWiring();

  const catalog = await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json"));
  const exampleCatalog = await readJson(path.join(EXAMPLES_ROOT, "catalog.web.example.json"));
  const namespace = await verifyCatalogNamespace(api, catalog);
  const exampleCatalogSet = await createCatalogSet(api, [exampleCatalog], "example catalog set");
  const frozen = await verifyFrozenDocuments(api, namespace.value, exampleCatalogSet.value);
  const semver = await verifySemverGoldens(api, catalog, namespace.value);
  const requirements = await verifyRequirementExactness(api, namespace.value, catalog);
  const extensions = await verifyExtensionOpacity(api, namespace.value);
  const determinism = await verifyDeterminism(api, namespace.value);
  const platformAudit = await verifyPlatformAndDistributionAudit();

  const artifact = {
    schemaVersion: 1,
    task: "M02-T07",
    result: "PASS",
    protocolVersion: "0.1.0",
    profile: "desen-semantic-foundation-v1",
    prerequisite: {
      structuralValidation: structuralDependency,
    },
    frozenInput: {
      sourceCommit: snapshot.sourceCommit,
      sourceTree: snapshot.sourceTree,
      aggregateSha256: snapshot.aggregateSha256,
      catalogTuple: {
        id: catalog.id,
        version: catalog.version,
        target: catalog.target,
        packageDigest: catalog.packageDigest,
      },
    },
    traceability: {
      schemaFamilies: EXPECTED_SCHEMA_FAMILIES,
      schemaFamilyCount: trace.familyCount,
      schemaConstraints: trace.constraintCount,
      conformanceResponsibilities: EXPECTED_CONFORMANCE_RULES,
      proseRules: EXPECTED_PROSE_RULES,
      mandatoryClauses: normative.mandatory,
      recommendedClauses: normative.recommended,
      coreDiagnostics: EXPECTED_CORE_DIAGNOSTICS,
      implementationDiagnostics,
      implementationFinding: "PF-009",
    },
    publicApi: {
      package: "@desen/validator",
      runtimeExports: REQUIRED_RUNTIME_EXPORTS,
      catalogSetBoundary:
        "validateDesenCatalogSet returns the only branded immutable value accepted by Source and Bundle semantics",
      failureValue: "absent",
      successValue: "independent recursively frozen JSON snapshot",
    },
    semanticVersioning: semver,
    catalogRequirements: requirements,
    catalogNamespace: namespace.evidence,
    frozenValidation: frozen,
    extensionOpacity: extensions,
    determinism,
    security: {
      rawInputs: "re-enter the M02-T06 immutable structural boundary before semantic inspection",
      untrustedCatalogSet: "fails closed without accepting a forged TypeScript cast",
      catalogLocationIo: "none; Source location remains an inert discovery hint",
      dynamicExecution: false,
      platformAudit,
    },
    implementation: {
      platform: "ECMAScript 2023; no Node, DOM, React, or browser API in production source",
      runtimeDependencies: [
        { name: "@desen/protocol", version: "workspace:*", license: "Apache-2.0" },
      ],
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      trackedFiles: await trackedFileEvidence(),
    },
    verification: {
      commands: [
        "pnpm generate:protocol-semantic-foundation",
        "pnpm verify:protocol-semantic-foundation",
        "pnpm test:protocol-semantic-foundation",
        "pnpm check",
      ],
      independentAnchors: [
        "byte-verified M02-T06 structural-validation artifact dependency",
        "reviewed 19-family / 201-constraint trace ownership",
        "BCP 14 N-006/N-007/N-008/N-009/N-012/N-017/N-022/N-025 and S-003 ledger rows",
        "frozen valid, duplicate, unknown, later-task fence, and example documents",
        "strict Semantic Versioning 2.0.0 positive and negative goldens",
        "source and built-distribution platform audits",
      ],
    },
    limitations: [
      "M02-T07 validates semantic identity and exact capability existence, not component props, slots, style parts, or visual-state contracts owned by M02-T08.",
      "Event, command, behavior attachment, conflict, and payload contracts remain M02-T09.",
      "State, predicate, repeat, alias, and ValueSpec binding semantics remain M02-T10.",
      "Resource input/policy, operation input, actions, navigation, and command-target semantics remain M02-T11.",
      "Catalog acquisition, trust, digest integrity, publication, activation, and package availability remain M06 and M07 responsibilities; Source location is never fetched here.",
      "Unknown extension keys remain opaque; reverse-domain naming is a recommendation and therefore not a validation failure.",
      "Raw duplicate JSON member names require a future I-JSON text-ingestion boundary, and finite resource-limit policy remains a later task.",
      "This foundation does not claim complete official-suite parity, G02, or any Proof Matrix P-* result.",
    ],
  };

  const artifactText = await format(JSON.stringify(artifact), {
    endOfLine: "lf",
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Writes current evidence only outside the immutable tracked M02-T07 artifact path. */
export async function writeProtocolSemanticFoundationEvidence({
  artifactPath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_ARTIFACT_PATH,
} = {}) {
  if (
    path.resolve(artifactPath) === path.resolve(DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_ARTIFACT_PATH)
  ) {
    return authenticateHistoricalArtifact(artifactPath);
  }
  await assertWritableArtifactPath(artifactPath);
  const result = await buildProtocolSemanticFoundationEvidence();
  await writeFile(artifactPath, result.artifactBytes);
  return result;
}

/** Authenticates immutable task-time M02-T07 evidence without rebuilding successor source. */
export async function verifyProtocolSemanticFoundation({
  artifactPath = DEFAULT_PROTOCOL_SEMANTIC_FOUNDATION_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await authenticateHistoricalArtifact(artifactPath, artifactBytes);
  return Object.freeze({
    result: "PASS",
    compatibilityMode: "immutable-task-time-artifact",
    schemaFamilies: result.artifact.traceability.schemaFamilyCount,
    schemaConstraints: result.artifact.traceability.schemaConstraints,
    semverGoldens: result.artifact.semanticVersioning.goldens.length,
    officialSemanticInvalid: result.artifact.frozenValidation.officialSemanticInvalid.length,
    scopeFenceAccepted: result.artifact.frozenValidation.laterTaskScopeAccepted.length,
    examples: result.artifact.frozenValidation.validExamples.length,
    artifactSha256: result.artifactSha256,
  });
}
