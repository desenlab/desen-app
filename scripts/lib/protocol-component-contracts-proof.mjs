import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";
import { verifyProtocolDiagnostics } from "./protocol-diagnostics-proof.mjs";
import { verifyProtocolSemanticFoundation } from "./protocol-semantic-foundation-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T08 evidence artifact. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
);

/** Absolute path to the reviewed protocol trace ledger used by M02-T08 evidence. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the BCP 14 ownership ledger used by M02-T08 evidence. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_NORMATIVE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/NORMATIVE-COVERAGE.md",
);

/** Absolute path to the reviewed PF-010 and PF-011 implementation-finding ledger. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/plan/PROTOCOL-FINDINGS.md",
);

/** Absolute path to the reviewed, non-executed T08 schema-safety source contract. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_SCHEMA_SAFETY_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/validator/src/schema-instance-validation.ts",
);

/** Absolute path to the prerequisite M02-T05 diagnostics artifact. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
);

/** Absolute path to the prerequisite M02-T07 semantic-foundation artifact. */
export const DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_SEMANTIC_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
);

const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

const REQUIRED_RUNTIME_EXPORTS = Object.freeze([
  "INVALID_COMPONENT_CONTRACT_CODE",
  "validateDesenBundleComponentContracts",
  "validateDesenComponentCatalogSet",
  "validateDesenComponentContracts",
  "validateDesenSourceComponentContracts",
]);

const EXPECTED_SCHEMA_FAMILY_COUNTS = Object.freeze([
  Object.freeze({ id: "SC-029", expectedConstraints: 5 }),
  Object.freeze({ id: "SC-042", expectedConstraints: 26 }),
  Object.freeze({ id: "SC-043", expectedConstraints: 26 }),
  Object.freeze({ id: "SC-046", expectedConstraints: 70 }),
  Object.freeze({ id: "SC-052", expectedConstraints: 18 }),
  Object.freeze({ id: "SC-055", expectedConstraints: 7 }),
  Object.freeze({ id: "SC-057", expectedConstraints: 39 }),
]);
const EXPECTED_SCHEMA_CONSTRAINTS = 191;
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-057",
  "R-058",
  "R-060",
  "R-064",
  "R-085",
  "R-120",
  "R-148",
]);
const EXPECTED_MANDATORY_CLAUSES = Object.freeze(["N-026", "N-028", "N-029"]);
const EXPECTED_NORMATIVE_STATUS = "TESTED";
const EXPECTED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-008", code: "UNKNOWN_PROP" }),
  Object.freeze({ id: "D-009", code: "PROP_TYPE_MISMATCH" }),
  Object.freeze({ id: "D-010", code: "UNKNOWN_SLOT" }),
  Object.freeze({ id: "D-011", code: "SLOT_CARDINALITY" }),
  Object.freeze({ id: "D-012", code: "SLOT_CHILD_REJECTED" }),
]);

const FROZEN_EXAMPLES = Object.freeze([
  Object.freeze({ file: "catalog.web.example.json", target: "catalog-set" }),
  Object.freeze({ file: "sign-in.source.desen.json", target: "source" }),
  Object.freeze({ file: "sign-in.bundle.desen.json", target: "bundle" }),
  Object.freeze({ file: "sortable-list.source.desen.json", target: "source" }),
  Object.freeze({ file: "store-map.source.desen.json", target: "source" }),
]);

const LATER_TASK_SCOPE_CASES = Object.freeze([
  Object.freeze({
    id: "official-unknown-event",
    file: "invalid/source-unknown-event.json",
    owner: "M02-T09",
  }),
  Object.freeze({
    id: "behavior-prop-contract",
    file: "examples/sortable-list.source.desen.json",
    owner: "M02-T09",
  }),
  Object.freeze({
    id: "unresolved-component-reference",
    file: "valid/sign-in.source.json",
    owner: "M02-T10",
  }),
  Object.freeze({
    id: "operation-input-contract",
    file: "valid/sign-in.source.json",
    owner: "M02-T11",
  }),
  Object.freeze({
    id: "navigation-target",
    file: "valid/sign-in.source.json",
    owner: "M02-T11",
  }),
  Object.freeze({
    id: "bundle-revision",
    file: "invalid/bundle-revision-mismatch.json",
    owner: "M06-T09/M07-T02",
  }),
  Object.freeze({
    id: "catalog-digest",
    file: "invalid/bundle-catalog-digest-mismatch.json",
    owner: "M07-T03",
  }),
]);

const EXPECTED_STORE_MAP_DYNAMIC_GOLDEN = Object.freeze([
  Object.freeze({
    valueSpec: "$format",
    obligation: Object.freeze({
      kind: "component-prop",
      pointer: "/surfaces/stores/root/slots/default/0/slots/popup/0/props/text",
      context: Object.freeze({
        documentId: "com.example.store-locator",
        surfaceId: "stores",
        subject: Object.freeze({ kind: "node", id: "store-map.popupText" }),
        capabilityId: "com.example.ui/Text",
      }),
    }),
  }),
  Object.freeze({
    valueSpec: "$token",
    obligation: Object.freeze({
      kind: "style-part-property",
      pointer: "/surfaces/stores/root/slots/default/0/style/base/marker/fill",
      context: Object.freeze({
        documentId: "com.example.store-locator",
        surfaceId: "stores",
        subject: Object.freeze({ kind: "node", id: "store-map" }),
        capabilityId: "com.example.maps/Map",
      }),
    }),
  }),
  Object.freeze({
    valueSpec: "$token",
    obligation: Object.freeze({
      kind: "style-part-property",
      pointer: "/surfaces/stores/root/slots/default/0/style/base/selectedMarker/fill",
      context: Object.freeze({
        documentId: "com.example.store-locator",
        surfaceId: "stores",
        subject: Object.freeze({ kind: "node", id: "store-map" }),
        capabilityId: "com.example.maps/Map",
      }),
    }),
  }),
]);

const PROTOCOL_RUNTIME_SOURCE_FILES = Object.freeze([
  "canonicalization.ts",
  "diagnostics.ts",
  "index.ts",
  "json-pointer.ts",
]);
const PROTOCOL_RUNTIME_DISTRIBUTION_FILES = Object.freeze([
  "canonicalization.js",
  "diagnostics.js",
  "index.js",
  "json-pointer.js",
]);

const EXPECTED_SCHEMA_SAFETY_LIMITS = Object.freeze({
  maxSchemaDepth: 128,
  maxSchemaNodes: 4_096,
  maxReferences: 4_096,
  maxPatterns: 64,
  maxPatternCodeUnits: 256,
  maxPatternTokens: 128,
  maxPatternQuantifier: 1_024,
  maxPatternExpandedWidth: 4_096,
  maxUnanchoredFixedPatternWidth: 16,
  maxAggregatePatternCodeUnits: 4_096,
  maxEvaluationSteps: 50_000,
});
const EXPECTED_SCHEMA_SAFETY_ALIASES = Object.freeze({
  maxSchemaNodes: "MAX_SCHEMA_GRAPH_NODES",
  maxReferences: "MAX_SCHEMA_GRAPH_REFERENCES",
  maxPatterns: "MAX_SCHEMA_GRAPH_PATTERNS",
  maxPatternCodeUnits: "MAX_PATTERN_CODE_UNITS",
  maxPatternTokens: "MAX_PATTERN_TOKENS",
  maxPatternQuantifier: "MAX_PATTERN_QUANTIFIER",
  maxPatternExpandedWidth: "MAX_PATTERN_EXPANDED_WIDTH",
  maxUnanchoredFixedPatternWidth: "MAX_UNANCHORED_FIXED_PATTERN_WIDTH",
  maxAggregatePatternCodeUnits: "MAX_SCHEMA_GRAPH_PATTERN_CODE_UNITS",
  maxEvaluationSteps: "MAX_SCHEMA_EVALUATION_STEPS",
});

const FIXED_TRACKED_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "packages/protocol/package.json",
  "packages/validator/package.json",
  "packages/validator/README.md",
  "packages/validator/THIRD_PARTY_NOTICES.md",
  "packages/validator/tsconfig.build.json",
  "packages/validator/tsconfig.json",
  "docs/plan/PROTOCOL-FINDINGS.md",
  "docs/proof/NORMATIVE-COVERAGE.md",
  "docs/proof/PROTOCOL-COMPONENT-CONTRACTS.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/generate-protocol-component-contracts-proof.mjs",
  "scripts/lib/protocol-component-contracts-proof.mjs",
  "scripts/verify-protocol-component-contracts.mjs",
  "tests/protocol-component-contracts.test.mjs",
]);

/** Stable internal failure raised by M02-T08 evidence generation and verification. */
export class ProtocolComponentContractsEvidenceError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolComponentContractsEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolComponentContractsEvidenceError(code, message, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertJsonEqual(actual, expected, label, code = "COMPONENT_GOLDEN_MISMATCH") {
  if (stableJson(actual) !== stableJson(expected)) {
    fail(code, `${label} differs from its reviewed value.`, { expected, actual });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function nestedNotSchema(depth) {
  let schema = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

function reverseObjectMemberOrder(value) {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectMemberOrder(entry));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectMemberOrder(child)]),
  );
}

function isDeeplyFrozen(root) {
  if (root === null || typeof root !== "object") return true;
  const pending = [root];
  const seen = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (seen.has(value)) continue;
    seen.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === "object") pending.push(child);
    }
  }
  return true;
}

function diagnosticIdentity(result) {
  return [...(result.diagnostics ?? [])]
    .map(({ code, pointer }) => ({ code, pointer: pointer ?? null }))
    .sort((left, right) =>
      compareText(
        `${left.pointer ?? ""}\u0000${left.code}`,
        `${right.pointer ?? ""}\u0000${right.code}`,
      ),
    );
}

function assertSuccess(result, label) {
  if (
    result?.valid !== true ||
    result.value === undefined ||
    (result.diagnostics?.length ?? -1) !== 0
  ) {
    fail("COMPONENT_VALID_CASE_REJECTED", `${label} unexpectedly failed component contracts.`, {
      diagnostics: diagnosticIdentity(result ?? {}),
    });
  }
  if (!isDeeplyFrozen(result) || !isDeeplyFrozen(result.value)) {
    fail("COMPONENT_RESULT_MUTABLE", `${label} did not return a deeply frozen success result.`);
  }
  if (result.target === "source" || result.target === "bundle") {
    normalizedObligations(result, `${label} success`);
    if (!isInertJsonValue(result)) {
      fail("COMPONENT_RESULT_NOT_JSON", `${label} is not inert JSON data.`);
    }
  }
  return result;
}

function assertFailure(result, label) {
  if (
    result?.valid !== false ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length === 0
  ) {
    fail("COMPONENT_INVALID_CASE_ACCEPTED", `${label} unexpectedly passed component contracts.`);
  }
  if ("value" in result) {
    fail("COMPONENT_FAILURE_VALUE_PRESENT", `${label} exposed a trusted value on failure.`);
  }
  if (!isDeeplyFrozen(result)) {
    fail("COMPONENT_RESULT_MUTABLE", `${label} did not return a deeply frozen failure result.`);
  }
  if (result.target === "source" || result.target === "bundle") {
    normalizedObligations(result, `${label} failure`);
    if (!isInertJsonValue(result)) {
      fail("COMPONENT_RESULT_NOT_JSON", `${label} is not inert JSON data.`);
    }
  } else if ("obligations" in result && !Array.isArray(result.obligations)) {
    fail("COMPONENT_OBLIGATION_MISSING", `${label} has a non-array obligation value.`);
  }
  return result;
}

function requireExactDiagnostics(result, expected, label) {
  assertFailure(result, label);
  assertJsonEqual(diagnosticIdentity(result), expected, `${label} diagnostics`);
  return expected;
}

function requireDiagnostic(result, code, pointer, label) {
  assertFailure(result, label);
  const found = diagnosticIdentity(result).some(
    (diagnostic) => diagnostic.code === code && diagnostic.pointer === pointer,
  );
  if (!found) {
    fail("COMPONENT_DIAGNOSTIC_MISSING", `${label} omitted its reviewed diagnostic.`, {
      expected: { code, pointer },
      actual: diagnosticIdentity(result),
    });
  }
  return { code, pointer };
}

function normalizedObligations(result, label) {
  if (!Array.isArray(result.obligations)) {
    fail(
      "COMPONENT_OBLIGATION_MISSING",
      `${label} did not expose the deterministic dynamic-validation obligation array.`,
    );
  }
  if (!isDeeplyFrozen(result.obligations)) {
    fail("COMPONENT_RESULT_MUTABLE", `${label} obligations are not deeply frozen.`);
  }
  if (!isInertJsonValue(result.obligations)) {
    fail("COMPONENT_OBLIGATION_NOT_JSON", `${label} obligations are not inert JSON data.`);
  }
  try {
    return JSON.parse(stableJson(result.obligations));
  } catch {
    fail("COMPONENT_OBLIGATION_NOT_JSON", `${label} obligations are not inert JSON data.`);
  }
}

function isInertJsonValue(root) {
  const active = new Set();
  function visit(value) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return true;
    }
    if (typeof value !== "object" || active.has(value)) return false;
    active.add(value);
    const isArray = Array.isArray(value);
    if (!isArray && Object.getPrototypeOf(value) !== Object.prototype) return false;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) return false;
    const keys = isArray
      ? Array.from({ length: value.length }, (_, index) => String(index))
      : ownKeys;
    if (isArray && ownKeys.length !== value.length + 1) return false;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        !visit(descriptor.value)
      ) {
        active.delete(value);
        return false;
      }
    }
    active.delete(value);
    return true;
  }
  return visit(root);
}

function requireDynamicObligations(result, label) {
  const obligations = normalizedObligations(result, label);
  if (obligations.length === 0) {
    fail("COMPONENT_OBLIGATION_GOLDEN_MISMATCH", `${label} omitted dynamic obligations.`);
  }
  return obligations;
}

function resolveJsonPointer(document, pointer) {
  let value = document;
  for (const rawToken of pointer.slice(1).split("/")) {
    const token = rawToken.replaceAll("~1", "/").replaceAll("~0", "~");
    value = value?.[token];
  }
  return value;
}

function dynamicValueSpecKind(value, label) {
  const kinds = ["$ref", "$token", "$format"].filter((key) =>
    Object.prototype.hasOwnProperty.call(value ?? {}, key),
  );
  if (kinds.length !== 1) {
    fail("COMPONENT_OBLIGATION_GOLDEN_MISMATCH", `${label} is not one exact dynamic ValueSpec.`, {
      kinds,
    });
  }
  return kinds[0];
}

function assertDocumentTarget(result, target, label) {
  if (result.target !== target) {
    fail("COMPONENT_PUBLIC_API_DRIFT", `${label} returned the wrong target.`, {
      expected: target,
      actual: result.target,
    });
  }
  return result;
}

async function loadValidatorApi() {
  return import(VALIDATOR_API_URL.href);
}

function verifyPublicApi(api) {
  const missing = REQUIRED_RUNTIME_EXPORTS.filter((name) => !(name in api));
  const nonFunctions = REQUIRED_RUNTIME_EXPORTS.filter(
    (name) => name !== "INVALID_COMPONENT_CONTRACT_CODE" && typeof api[name] !== "function",
  );
  if (missing.length > 0 || nonFunctions.length > 0) {
    fail("COMPONENT_PUBLIC_API_DRIFT", "The built validator omits required M02-T08 exports.", {
      missing,
      nonFunctions,
    });
  }
  if (
    typeof api.INVALID_COMPONENT_CONTRACT_CODE !== "string" ||
    !api.INVALID_COMPONENT_CONTRACT_CODE.startsWith("run.desen.validator/")
  ) {
    fail(
      "COMPONENT_PUBLIC_API_DRIFT",
      "INVALID_COMPONENT_CONTRACT_CODE must be one documented namespaced diagnostic code.",
    );
  }
}

function commandSteps(command) {
  return typeof command === "string" ? command.split(/\s+&&\s+/u) : [];
}

async function verifyCommandWiring() {
  const [workspacePackage, validatorPackage, turbo] = await Promise.all(
    ["package.json", "packages/validator/package.json", "turbo.json"].map((relativePath) =>
      readJson(path.join(WORKSPACE_ROOT, relativePath)),
    ),
  );
  const exactRootScripts = {
    "generate:protocol-component-contracts":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-component-contracts-proof.mjs",
    "verify:protocol-component-contracts":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-component-contracts.mjs",
    "test:protocol-component-contracts":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:component-contracts && node --test tests/protocol-component-contracts.test.mjs",
  };
  for (const [name, command] of Object.entries(exactRootScripts)) {
    if (workspacePackage.scripts?.[name] !== command) {
      fail("COMPONENT_COMMAND_WIRING_DRIFT", `Root command ${name} is missing or stale.`);
    }
  }
  for (const [scriptName, requiredStep] of [
    ["test", "pnpm test:protocol-component-contracts"],
    ["check", "pnpm verify:protocol-component-contracts"],
  ]) {
    if (!commandSteps(workspacePackage.scripts?.[scriptName]).includes(requiredStep)) {
      fail("COMPONENT_COMMAND_WIRING_DRIFT", `Root ${scriptName} omits ${requiredStep}.`);
    }
  }
  if (
    validatorPackage.scripts?.["test:component-contracts"] !==
    "vitest run test/schema-instance-validation.test.ts test/component-contracts.test.ts"
  ) {
    fail("COMPONENT_COMMAND_WIRING_DRIFT", "The validator T08 test command is stale.");
  }
  assertJsonEqual(
    validatorPackage.dependencies,
    { "@desen/protocol": "workspace:*" },
    "validator runtime dependencies",
    "COMPONENT_RUNTIME_DEPENDENCY_DRIFT",
  );
  for (const taskName of ["test", "test:coverage"]) {
    const inputs = turbo.tasks?.[taskName]?.inputs ?? [];
    for (const requiredInput of [
      "../../scripts/lib/protocol-component-contracts-proof.mjs",
      "../../tests/protocol-component-contracts.test.mjs",
    ]) {
      if (!inputs.includes(requiredInput)) {
        fail("COMPONENT_COMMAND_WIRING_DRIFT", `Turbo ${taskName} omits ${requiredInput}.`);
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
  assertJsonEqual(
    ownedIds(trace.schemaFamilies, "M02-T08", "semanticOwners"),
    EXPECTED_SCHEMA_FAMILY_COUNTS.map(({ id }) => id).sort(compareText),
    "M02-T08 schema families",
    "COMPONENT_TRACE_DRIFT",
  );
  const ownedFamilies = trace.schemaFamilies.filter(({ semanticOwners }) =>
    semanticOwners?.includes("M02-T08"),
  );
  const familyCounts = ownedFamilies
    .map(({ id, expectedConstraints }) => ({ id, expectedConstraints }))
    .sort((left, right) => compareText(left.id, right.id));
  assertJsonEqual(
    familyCounts,
    EXPECTED_SCHEMA_FAMILY_COUNTS,
    "M02-T08 per-family schema constraint counts",
    "COMPONENT_TRACE_DRIFT",
  );
  const constraintCount = ownedFamilies.reduce(
    (total, { expectedConstraints }) => total + expectedConstraints,
    0,
  );
  if (constraintCount !== EXPECTED_SCHEMA_CONSTRAINTS) {
    fail("COMPONENT_TRACE_DRIFT", "M02-T08 schema constraint ownership changed.", {
      expected: EXPECTED_SCHEMA_CONSTRAINTS,
      actual: constraintCount,
    });
  }
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T08"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "M02-T08 prose rules",
    "COMPONENT_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T08"),
    [],
    "M02-T08 official conformance responsibilities",
    "COMPONENT_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T08"))
    .map(({ id, anchor }) => ({ id, code: anchor }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_CORE_DIAGNOSTICS,
    "M02-T08 diagnostic ownership",
    "COMPONENT_TRACE_DRIFT",
  );
  return Object.freeze({
    families: Object.freeze(familyCounts.map((entry) => Object.freeze(entry))),
    familyCount: ownedFamilies.length,
    constraintCount,
  });
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
      owners: (cells[3] ?? "")
        .split(",")
        .map((owner) => owner.trim())
        .filter(Boolean),
      status: cells[4] ?? "",
    });
  }
  return rows;
}

async function verifyNormativeCoverage(normativeCoveragePath) {
  const rows = parseCoverageRows(await readFile(normativeCoveragePath, "utf8"));
  const actual = [...rows]
    .filter(([, { owners }]) => owners.includes("M02-T08"))
    .map(([id]) => id)
    .sort(compareText);
  assertJsonEqual(
    actual,
    [...EXPECTED_MANDATORY_CLAUSES].sort(compareText),
    "M02-T08 BCP 14 ownership",
    "COMPONENT_NORMATIVE_COVERAGE_DRIFT",
  );
  for (const id of EXPECTED_MANDATORY_CLAUSES) {
    if (rows.get(id)?.status !== EXPECTED_NORMATIVE_STATUS) {
      fail(
        "COMPONENT_NORMATIVE_COVERAGE_DRIFT",
        `${id} must be ${EXPECTED_NORMATIVE_STATUS} when M02-T08 evidence is generated.`,
        { expected: EXPECTED_NORMATIVE_STATUS, actual: rows.get(id)?.status },
      );
    }
  }
  return EXPECTED_MANDATORY_CLAUSES.map((id) => Object.freeze({ id, status: rows.get(id).status }));
}

function findingSection(findings, id) {
  const start = findings.indexOf(`## ${id} `);
  const end = findings.indexOf("\n## ", start + 1);
  if (start < 0) {
    fail("COMPONENT_FINDING_DRIFT", `${id} is missing from the findings ledger.`);
  }
  return findings.slice(start, end < 0 ? undefined : end);
}

function requireFindingAnchors(
  section,
  id,
  requiredAnchors,
  requiredImplementationDiagnostics = [],
) {
  const normalizedSection = section.replace(/\s+/gu, " ");
  const missing = requiredAnchors.filter((anchor) => !normalizedSection.includes(anchor));
  if (missing.length > 0) {
    fail("COMPONENT_FINDING_DRIFT", `${id} no longer records the reviewed T08 decisions.`, {
      missing,
    });
  }
  const implementationDiagnostics = [...section.matchAll(/`(run\.desen\.validator\/[A-Z_]+)`/gu)]
    .map(([, code]) => code)
    .sort(compareText);
  const missingDiagnostics = requiredImplementationDiagnostics.filter(
    (code) => !implementationDiagnostics.includes(code),
  );
  if (missingDiagnostics.length > 0) {
    fail("COMPONENT_FINDING_DRIFT", `${id} lost a required T08 implementation diagnostic.`, {
      missingDiagnostics,
    });
  }
}

async function verifyImplementationFindings(findingsPath) {
  const findings = await readFile(findingsPath, "utf8");
  const slotSection = findingSection(findings, "PF-010");
  requireFindingAnchors(
    slotSection,
    "PF-010",
    [
      "- Status: OPEN",
      "- Blocks proof: No;",
      "effectiveMin = minItems ?? (required ? 1 : 0)",
      "an explicitly empty union rejects every child",
      "`run.desen.validator/INVALID_COMPONENT_CONTRACT`",
      "Unknown visual states and style parts continue to use the core `UNKNOWN_PROP` code",
    ],
    ["run.desen.validator/INVALID_COMPONENT_CONTRACT"],
  );
  const regexSection = findingSection(findings, "PF-011");
  requireFindingAnchors(
    regexSection,
    "PF-011",
    [
      "- Status: OPEN",
      "- Blocks proof: No;",
      "host-safe component-schema profile",
      "An unanchored fixed-width pattern is limited to 16 expanded atoms.",
      "it must be the final consuming atom; only the terminal `$` may follow.",
      "pathological quantified prefixes followed by fixed suffixes",
      "maximum traversal/evaluation depth of 128",
      "a deterministic 50,000-step evaluation budget",
      "`run.desen.validator/INVALID_COMPONENT_CONTRACT`",
      "Unsafe patterns are never passed to native `RegExp`",
      "T08 applies this profile only to component prop and style-part schemas",
    ],
    ["run.desen.validator/INVALID_COMPONENT_CONTRACT"],
  );
  return Object.freeze({
    slotEdgeSemantics: Object.freeze({
      id: "PF-010",
      status: "OPEN",
      blocksProof: false,
      implementationDiagnostic: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
      decisions: Object.freeze([
        "required slot presence and explicit effective minimum",
        "empty acceptance union rejects every child",
        "impossible slot range fails the catalog-set boundary",
        "unknown visual state and style part use UNKNOWN_PROP",
      ]),
    }),
    regexSafety: Object.freeze({
      id: "PF-011",
      status: "OPEN",
      blocksProof: false,
      profile: "host-safe component-schema profile",
      maximumSchemaDepth: 128,
      maximumUnanchoredFixedPatternWidth: 16,
      evaluationBudget: 50_000,
      variableWidthPlacement: "final consuming atom; only a terminal $ may follow",
      implementationDiagnostic: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
      nativeUnsafePatternExecution: false,
      scope: Object.freeze(["component props", "style-part properties"]),
    }),
  });
}

async function verifySchemaSafetyProfileSource(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const depthMatch = source.match(/export const MAX_SCHEMA_GRAPH_DEPTH = ([0-9_]+);/u);
  const exportedDepth = depthMatch === null ? undefined : Number(depthMatch[1].replaceAll("_", ""));
  if (exportedDepth !== EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth) {
    fail(
      "COMPONENT_SCHEMA_PROFILE_DRIFT",
      "MAX_SCHEMA_GRAPH_DEPTH no longer matches reviewed PF-011.",
      { expected: EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth, actual: exportedDepth },
    );
  }

  const objectStartMarker = "export const SCHEMA_CONTRACT_SAFETY_LIMITS = Object.freeze({";
  const objectStart = source.indexOf(objectStartMarker);
  const objectEnd = source.indexOf("} as const);", objectStart + objectStartMarker.length);
  if (objectStart < 0 || objectEnd < 0) {
    fail(
      "COMPONENT_SCHEMA_PROFILE_DRIFT",
      "The reviewed SCHEMA_CONTRACT_SAFETY_LIMITS object is missing.",
    );
  }
  const objectBody = source.slice(objectStart + objectStartMarker.length, objectEnd);
  const actualLimits = {};
  for (const line of objectBody
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*): ([A-Z][A-Z0-9_]*|[0-9_]+),$/u);
    if (match === null || match[1] in actualLimits) {
      fail("COMPONENT_SCHEMA_PROFILE_DRIFT", "The safety-limit object shape changed.", { line });
    }
    const usesReviewedDepth =
      match[1] === "maxSchemaDepth" && match[2] === "MAX_SCHEMA_GRAPH_DEPTH";
    const usesReviewedLiteral = match[1] !== "maxSchemaDepth" && /^[0-9_]+$/u.test(match[2]);
    const value = usesReviewedDepth
      ? exportedDepth
      : usesReviewedLiteral
        ? Number(match[2].replaceAll("_", ""))
        : undefined;
    if (value === undefined) {
      fail("COMPONENT_SCHEMA_PROFILE_DRIFT", "The safety-limit object uses an unreviewed value.", {
        field: match[1],
        value: match[2],
      });
    }
    actualLimits[match[1]] = value;
  }
  assertJsonEqual(
    actualLimits,
    EXPECTED_SCHEMA_SAFETY_LIMITS,
    "SCHEMA_CONTRACT_SAFETY_LIMITS",
    "COMPONENT_SCHEMA_PROFILE_DRIFT",
  );

  const destructuringStart = source.indexOf("const {", objectEnd);
  const destructuringEndMarker = "} = SCHEMA_CONTRACT_SAFETY_LIMITS;";
  const destructuringEnd = source.indexOf(destructuringEndMarker, destructuringStart);
  if (destructuringStart < 0 || destructuringEnd < 0) {
    fail(
      "COMPONENT_SCHEMA_PROFILE_DRIFT",
      "The reviewed safety-limit destructuring aliases are missing.",
    );
  }
  const destructuringBody = source.slice(destructuringStart + "const {".length, destructuringEnd);
  const actualAliases = {};
  for (const line of destructuringBody
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*): ([A-Z][A-Z0-9_]*),$/u);
    if (match === null || match[1] in actualAliases) {
      fail("COMPONENT_SCHEMA_PROFILE_DRIFT", "The safety-limit alias shape changed.", { line });
    }
    actualAliases[match[1]] = match[2];
  }
  assertJsonEqual(
    actualAliases,
    EXPECTED_SCHEMA_SAFETY_ALIASES,
    "SCHEMA_CONTRACT_SAFETY_LIMITS aliases",
    "COMPONENT_SCHEMA_PROFILE_DRIFT",
  );

  const normalizedSource = source.replace(/\s+/gu, " ");
  for (const anchor of [
    "function isHostSafePattern(pattern: string): boolean",
    'if (variableQuantifiers > 0 && character !== "$") return false;',
    "return startsAnchored || expandedWidth <= MAX_UNANCHORED_FIXED_PATTERN_WIDTH;",
    "return variableQuantifiers === 1 && startsAnchored && endsAnchored;",
    "function safePattern(pattern: string): RegExp | undefined",
    "if (!isHostSafePattern(pattern)) return undefined;",
    'return new RegExp(pattern, "u");',
  ]) {
    if (!normalizedSource.includes(anchor)) {
      fail("COMPONENT_SCHEMA_PROFILE_DRIFT", "The reviewed PF-011 safe-pattern gate changed.", {
        missing: anchor,
      });
    }
  }
  const graphDepthChecks = [...source.matchAll(/> MAX_SCHEMA_GRAPH_DEPTH/gu)].length;
  if (graphDepthChecks < 2) {
    fail(
      "COMPONENT_SCHEMA_PROFILE_DRIFT",
      "PF-011 depth is not enforced at both graph preparation and evaluation boundaries.",
      { expectedMinimum: 2, actual: graphDepthChecks },
    );
  }
  return Object.freeze({
    finding: "PF-011",
    profile: "host-safe component-schema profile",
    maximumSchemaDepth: actualLimits.maxSchemaDepth,
    maximumPatternCodeUnits: actualLimits.maxPatternCodeUnits,
    maximumPatternTokens: actualLimits.maxPatternTokens,
    maximumQuantifier: actualLimits.maxPatternQuantifier,
    maximumExpandedFixedWidth: actualLimits.maxPatternExpandedWidth,
    maximumUnanchoredFixedPatternWidth: actualLimits.maxUnanchoredFixedPatternWidth,
    maximumSchemaNodes: actualLimits.maxSchemaNodes,
    maximumLocalReferenceEdges: actualLimits.maxReferences,
    maximumPatterns: actualLimits.maxPatterns,
    maximumAggregatePatternCodeUnits: actualLimits.maxAggregatePatternCodeUnits,
    evaluationBudget: actualLimits.maxEvaluationSteps,
    variableWidthPlacement: "final consuming atom; only a terminal $ may follow",
    unsafeNativeRegExpExecution: false,
    scope: Object.freeze(["component props", "style-part properties"]),
  });
}

async function verifyPrerequisite(filePath, expected, verifier) {
  let bytes;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    fail("COMPONENT_PREREQUISITE_DRIFT", `${expected.task} prerequisite could not be read.`, {
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes);
  } catch {
    fail("COMPONENT_PREREQUISITE_DRIFT", `${expected.task} prerequisite is not valid JSON.`);
  }
  if (
    artifact.task !== expected.task ||
    artifact.profile !== expected.profile ||
    artifact.protocolVersion !== "0.1.0" ||
    (expected.result !== undefined && artifact.result !== expected.result)
  ) {
    fail("COMPONENT_PREREQUISITE_DRIFT", `${expected.task} prerequisite metadata changed.`, {
      expected,
      actual: {
        task: artifact.task,
        profile: artifact.profile,
        protocolVersion: artifact.protocolVersion,
        result: artifact.result,
      },
    });
  }
  let verification;
  try {
    verification = await verifier({ artifactPath: filePath });
  } catch (error) {
    fail(
      "COMPONENT_PREREQUISITE_DRIFT",
      `${expected.task} prerequisite failed its own complete verifier.`,
      {
        predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
        predecessorMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }
  if (verification.result !== "PASS" || verification.artifactSha256 !== sha256(bytes)) {
    fail(
      "COMPONENT_PREREQUISITE_DRIFT",
      `${expected.task} prerequisite verifier returned inconsistent byte evidence.`,
      { verification, actualSha256: sha256(bytes) },
    );
  }
  if (expected.task === "M02-T05") {
    const codes = artifact.registry?.entries?.map(({ code }) => code) ?? [];
    for (const { code } of EXPECTED_CORE_DIAGNOSTICS) {
      if (!codes.includes(code)) {
        fail("COMPONENT_PREREQUISITE_DRIFT", `M02-T05 omits required diagnostic ${code}.`);
      }
    }
  }
  return Object.freeze({
    path: path.relative(WORKSPACE_ROOT, filePath),
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    task: artifact.task,
    profile: artifact.profile,
    verifiedBy: expected.verifierName,
    verifierResult: verification.result,
  });
}

async function createComponentCatalogSet(api, catalogs, label) {
  const result = api.validateDesenComponentCatalogSet(catalogs);
  assertSuccess(result, label);
  if (result.target !== "component-catalog-set") {
    fail("COMPONENT_PUBLIC_API_DRIFT", `${label} returned the wrong target.`, {
      expected: "component-catalog-set",
      actual: result.target,
    });
  }
  return result;
}

async function verifySchemaSafetyGoldens(api, catalog) {
  const componentId = "com.example.ui/Button";
  const schemaPointer = "/0/components/com.example.ui~1Button/propsSchema";
  const accepted = [];
  const rejected = [];

  const catalogWithSchema = (schema) => {
    const mutation = cloneJson(catalog);
    mutation.components[componentId].propsSchema = schema;
    return mutation;
  };
  const accept = async (id, schema, boundary) => {
    await createComponentCatalogSet(
      api,
      [catalogWithSchema(schema)],
      `schema-safety accepted golden ${id}`,
    );
    accepted.push(Object.freeze({ id, boundary, valid: true }));
  };
  const reject = (id, schema, pointer, boundary) => {
    const diagnostics = requireExactDiagnostics(
      api.validateDesenComponentCatalogSet([catalogWithSchema(schema)]),
      [{ code: api.INVALID_COMPONENT_CONTRACT_CODE, pointer }],
      `schema-safety rejected golden ${id}`,
    );
    rejected.push(Object.freeze({ id, boundary, valid: false, diagnostics }));
  };

  await accept(
    "maximum-schema-depth",
    nestedNotSchema(EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth),
    EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth,
  );
  reject(
    "above-maximum-schema-depth",
    nestedNotSchema(EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth + 1),
    schemaPointer,
    EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth + 1,
  );
  await accept(
    "maximum-unanchored-fixed-width",
    { patternProperties: { abcdefghijklmnop: true } },
    EXPECTED_SCHEMA_SAFETY_LIMITS.maxUnanchoredFixedPatternWidth,
  );
  reject(
    "above-maximum-unanchored-fixed-width",
    { patternProperties: { abcdefghijklmnopq: true } },
    `${schemaPointer}/patternProperties/abcdefghijklmnopq`,
    EXPECTED_SCHEMA_SAFETY_LIMITS.maxUnanchoredFixedPatternWidth + 1,
  );
  await accept("final-variable-width-atom", { pattern: "^a+$" }, "^a+$");
  reject(
    "fixed-suffix-after-variable-width",
    { pattern: "^a+b$" },
    `${schemaPointer}/pattern`,
    "^a+b$",
  );
  reject(
    "pathological-quantified-prefix-suffix",
    { pattern: "^.*a{1024}a{1024}a{1024}$" },
    `${schemaPointer}/pattern`,
    "^.*a{1024}a{1024}a{1024}$",
  );

  return Object.freeze({
    publicBoundary: "validateDesenComponentCatalogSet",
    profile: "host-safe component-schema profile",
    maximumSchemaDepth: EXPECTED_SCHEMA_SAFETY_LIMITS.maxSchemaDepth,
    maximumUnanchoredFixedPatternWidth:
      EXPECTED_SCHEMA_SAFETY_LIMITS.maxUnanchoredFixedPatternWidth,
    variableWidthPlacement: "final consuming atom; only a terminal $ may follow",
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
  });
}

function validateDocument(api, target, document, catalogSet) {
  const result =
    target === "source"
      ? api.validateDesenSourceComponentContracts(document, catalogSet)
      : api.validateDesenBundleComponentContracts(document, catalogSet);
  if (result.target !== target) {
    fail(
      "COMPONENT_PUBLIC_API_DRIFT",
      `Component validation returned the wrong ${target} target.`,
      {
        expected: target,
        actual: result.target,
      },
    );
  }
  return result;
}

function submitNode(document) {
  return document.surfaces["sign-in"].root.slots.default[4];
}

function mapNode(document) {
  return document.surfaces.stores.root.slots.default[0];
}

async function verifyFrozenDocuments(api, catalogSet) {
  const validCatalog = await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json"));
  const validSource = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const validBundle = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json"));
  const sourceResult = assertDocumentTarget(
    assertSuccess(
      api.validateDesenSourceComponentContracts(validSource, catalogSet),
      "frozen valid Source",
    ),
    "source",
    "frozen valid Source",
  );
  const bundleResult = assertDocumentTarget(
    assertSuccess(
      api.validateDesenBundleComponentContracts(validBundle, catalogSet),
      "frozen valid Bundle",
    ),
    "bundle",
    "frozen valid Bundle",
  );
  requireDynamicObligations(sourceResult, "frozen valid Source");
  requireDynamicObligations(bundleResult, "frozen valid Bundle");
  const expectedSignInObligations = [
    {
      kind: "component-prop",
      pointer: "/surfaces/sign-in/root/slots/default/1/props/value",
      context: {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        subject: { kind: "node", id: "sign-in.email" },
        capabilityId: "com.example.ui/TextField",
      },
    },
    {
      kind: "component-prop",
      pointer: "/surfaces/sign-in/root/slots/default/2/props/value",
      context: {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        subject: { kind: "node", id: "sign-in.password" },
        capabilityId: "com.example.ui/TextField",
      },
    },
    {
      kind: "component-prop",
      pointer: "/surfaces/sign-in/root/slots/default/4/props/loading",
      context: {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        subject: { kind: "node", id: "sign-in.submit" },
        capabilityId: "com.example.ui/Button",
      },
    },
  ];
  assertJsonEqual(
    normalizedObligations(sourceResult, "frozen valid Source"),
    expectedSignInObligations,
    "frozen Source dynamic obligations",
    "COMPONENT_OBLIGATION_GOLDEN_MISMATCH",
  );
  assertJsonEqual(
    normalizedObligations(bundleResult, "frozen valid Bundle"),
    expectedSignInObligations,
    "frozen Bundle dynamic obligations",
    "COMPONENT_OBLIGATION_GOLDEN_MISMATCH",
  );
  const genericSourceResult = assertDocumentTarget(
    assertSuccess(
      api.validateDesenComponentContracts("source", validSource, catalogSet),
      "generic Source dispatcher",
    ),
    "source",
    "generic Source dispatcher",
  );
  const genericBundleResult = assertDocumentTarget(
    assertSuccess(
      api.validateDesenComponentContracts("bundle", validBundle, catalogSet),
      "generic Bundle dispatcher",
    ),
    "bundle",
    "generic Bundle dispatcher",
  );
  assertJsonEqual(
    genericSourceResult,
    sourceResult,
    "generic Source dispatcher exact result",
    "COMPONENT_DISPATCHER_MISMATCH",
  );
  assertJsonEqual(
    genericBundleResult,
    bundleResult,
    "generic Bundle dispatcher exact result",
    "COMPONENT_DISPATCHER_MISMATCH",
  );

  const invalidSource = cloneJson(validSource);
  submitNode(invalidSource).props.ghost = true;
  const sourceFailure = assertDocumentTarget(
    assertFailure(
      api.validateDesenSourceComponentContracts(invalidSource, catalogSet),
      "frozen Source failure contract",
    ),
    "source",
    "frozen Source failure contract",
  );
  const invalidBundle = cloneJson(validBundle);
  submitNode(invalidBundle).props.ghost = true;
  const bundleFailure = assertDocumentTarget(
    assertFailure(
      api.validateDesenBundleComponentContracts(invalidBundle, catalogSet),
      "frozen Bundle failure contract",
    ),
    "bundle",
    "frozen Bundle failure contract",
  );
  assertJsonEqual(
    normalizedObligations(sourceFailure, "frozen Source failure contract"),
    expectedSignInObligations,
    "Source failure obligations",
    "COMPONENT_OBLIGATION_GOLDEN_MISMATCH",
  );
  assertJsonEqual(
    normalizedObligations(bundleFailure, "frozen Bundle failure contract"),
    expectedSignInObligations,
    "Bundle failure obligations",
    "COMPONENT_OBLIGATION_GOLDEN_MISMATCH",
  );
  const genericSourceFailure = assertDocumentTarget(
    assertFailure(
      api.validateDesenComponentContracts("source", invalidSource, catalogSet),
      "generic Source failure dispatcher",
    ),
    "source",
    "generic Source failure dispatcher",
  );
  const genericBundleFailure = assertDocumentTarget(
    assertFailure(
      api.validateDesenComponentContracts("bundle", invalidBundle, catalogSet),
      "generic Bundle failure dispatcher",
    ),
    "bundle",
    "generic Bundle failure dispatcher",
  );
  assertJsonEqual(
    genericSourceFailure,
    sourceFailure,
    "generic Source failure dispatcher exact result",
    "COMPONENT_DISPATCHER_MISMATCH",
  );
  assertJsonEqual(
    genericBundleFailure,
    bundleFailure,
    "generic Bundle failure dispatcher exact result",
    "COMPONENT_DISPATCHER_MISMATCH",
  );

  const exampleCatalog = await readJson(path.join(EXAMPLES_ROOT, "catalog.web.example.json"));
  assertSuccess(api.validateDesenComponentCatalogSet([exampleCatalog]), "frozen example Catalog");
  const exampleResults = [{ file: FROZEN_EXAMPLES[0].file, target: "catalog-set", valid: true }];
  let storeMapDynamicGolden;
  for (const vector of FROZEN_EXAMPLES.slice(1)) {
    const document = await readJson(path.join(EXAMPLES_ROOT, vector.file));
    const result = assertSuccess(
      validateDocument(api, vector.target, document, catalogSet),
      `frozen example ${vector.file}`,
    );
    const obligations = normalizedObligations(result, `frozen example ${vector.file}`);
    if (vector.file === "store-map.source.desen.json") {
      const recorded = obligations.map((obligation) => ({
        valueSpec: dynamicValueSpecKind(
          resolveJsonPointer(document, obligation.pointer),
          `store-map ${obligation.pointer}`,
        ),
        obligation,
      }));
      assertJsonEqual(
        recorded,
        EXPECTED_STORE_MAP_DYNAMIC_GOLDEN,
        "store-map exact dynamic-obligation golden",
        "COMPONENT_OBLIGATION_GOLDEN_MISMATCH",
      );
      storeMapDynamicGolden = recorded;
    }
    exampleResults.push({ file: vector.file, target: vector.target, valid: true });
  }
  if (storeMapDynamicGolden === undefined) {
    fail("COMPONENT_OBLIGATION_GOLDEN_MISMATCH", "The store-map obligation golden was not run.");
  }

  const predecessorCases = [
    {
      file: "invalid/source-unknown-core-field.json",
      code: "UNKNOWN_CORE_FIELD",
      pointer: "/script",
    },
    {
      file: "invalid/source-duplicate-node-id.json",
      code: "DUPLICATE_NODE_ID",
      pointer: "/surfaces/home/root/slots/default/1/id",
    },
    {
      file: "invalid/source-unknown-capability.json",
      code: "UNKNOWN_CAPABILITY",
      pointer: "/surfaces/home/root/slots/default/0/use",
    },
  ];
  const predecessorFailures = [];
  for (const vector of predecessorCases) {
    const document = await readJson(path.join(CONFORMANCE_ROOT, vector.file));
    requireDiagnostic(
      api.validateDesenSourceComponentContracts(document, catalogSet),
      vector.code,
      vector.pointer,
      `predecessor ${vector.file}`,
    );
    predecessorFailures.push({
      ...vector,
      owner: vector.code === "UNKNOWN_CORE_FIELD" ? "M02-T06" : "M02-T07",
    });
  }

  return Object.freeze({
    validConformance: Object.freeze([
      Object.freeze({ file: "valid/web.catalog.json", target: "catalog-set", valid: true }),
      Object.freeze({ file: "valid/sign-in.source.json", target: "source", valid: true }),
      Object.freeze({ file: "valid/sign-in.bundle.json", target: "bundle", valid: true }),
    ]),
    validExamples: Object.freeze(exampleResults.map((entry) => Object.freeze(entry))),
    predecessorFailures: Object.freeze(predecessorFailures.map((entry) => Object.freeze(entry))),
    officialT08Invalid: Object.freeze([]),
    duplicateFrozenBytes: Object.freeze([
      Object.freeze({
        left: "conformance/valid/web.catalog.json",
        right: "examples/catalog.web.example.json",
      }),
      Object.freeze({
        left: "conformance/valid/sign-in.source.json",
        right: "examples/sign-in.source.desen.json",
      }),
      Object.freeze({
        left: "conformance/valid/sign-in.bundle.json",
        right: "examples/sign-in.bundle.desen.json",
      }),
    ]),
    dynamicObligations: Object.freeze({
      source: normalizedObligations(sourceResult, "frozen valid Source"),
      bundle: normalizedObligations(bundleResult, "frozen valid Bundle"),
      storeMap: Object.freeze(storeMapDynamicGolden.map((entry) => Object.freeze(entry))),
      failures: Object.freeze({
        source: normalizedObligations(sourceFailure, "frozen Source failure contract"),
        bundle: normalizedObligations(bundleFailure, "frozen Bundle failure contract"),
      }),
    }),
    catalog: validCatalog,
  });
}

async function verifyPropGoldens(api, catalogSet) {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const cases = [];

  const unknown = cloneJson(source);
  submitNode(unknown).props.ghost = "value";
  cases.push({
    id: "base-unknown-property",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(unknown, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/slots/default/4/props/ghost",
        },
      ],
      "unknown component property",
    ),
  });

  const mismatch = cloneJson(source);
  submitNode(mismatch).props.variant = "tertiary";
  cases.push({
    id: "base-literal-schema-mismatch",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(mismatch, catalogSet),
      [
        {
          code: "PROP_TYPE_MISMATCH",
          pointer: "/surfaces/sign-in/root/slots/default/4/props/variant",
        },
      ],
      "literal component property mismatch",
    ),
  });

  const missing = cloneJson(source);
  delete submitNode(missing).props.label;
  cases.push({
    id: "base-required-property-missing",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(missing, catalogSet),
      [
        {
          code: "PROP_TYPE_MISMATCH",
          pointer: "/surfaces/sign-in/root/slots/default/4/props/label",
        },
      ],
      "missing required component property",
    ),
  });

  const nested = await readJson(path.join(EXAMPLES_ROOT, "store-map.source.desen.json"));
  mapNode(nested).props.center.latitude = 91;
  cases.push({
    id: "nested-literal-schema-mismatch",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(nested, catalogSet),
      [
        {
          code: "PROP_TYPE_MISMATCH",
          pointer: "/surfaces/stores/root/slots/default/0/props/center/latitude",
        },
      ],
      "nested literal component property mismatch",
    ),
  });

  const variantUnknown = cloneJson(source);
  submitNode(variantUnknown).variants = [
    { when: { op: "eq", args: [true, true] }, props: { ghost: true } },
  ];
  cases.push({
    id: "variant-unknown-property",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(variantUnknown, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/slots/default/4/variants/0/props/ghost",
        },
      ],
      "unknown variant property",
    ),
  });

  const variantMismatch = cloneJson(source);
  submitNode(variantMismatch).variants = [
    { when: { op: "eq", args: [true, true] }, props: { loading: "yes" } },
  ];
  cases.push({
    id: "variant-literal-schema-mismatch",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(variantMismatch, catalogSet),
      [
        {
          code: "PROP_TYPE_MISMATCH",
          pointer: "/surfaces/sign-in/root/slots/default/4/variants/0/props/loading",
        },
      ],
      "variant property mismatch",
    ),
  });

  const validPartialVariant = cloneJson(source);
  submitNode(validPartialVariant).variants = [
    { when: { op: "eq", args: [true, true] }, props: { loading: true } },
  ];
  assertSuccess(
    api.validateDesenSourceComponentContracts(validPartialVariant, catalogSet),
    "partial variant override",
  );

  const dynamic = cloneJson(source);
  submitNode(dynamic).props.label = { $ref: "state.missing" };
  const dynamicResult = assertSuccess(
    api.validateDesenSourceComponentContracts(dynamic, catalogSet),
    "dynamic component property",
  );
  const obligations = requireDynamicObligations(dynamicResult, "dynamic component property");

  return Object.freeze({
    projectMutationGoldens: Object.freeze(cases.map((entry) => Object.freeze(entry))),
    validPartialVariant: true,
    dynamicValueKinds: Object.freeze(["$format", "$ref", "$token"]),
    dynamicObligations: obligations,
  });
}

async function verifySlotGoldens(api, catalog, catalogSet) {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const mapSource = await readJson(path.join(EXAMPLES_ROOT, "store-map.source.desen.json"));
  const cases = [];

  const unknown = cloneJson(source);
  submitNode(unknown).slots = {
    content: [{ id: "sign-in.submit.child", use: "com.example.ui/Text", props: { text: "Child" } }],
  };
  cases.push({
    id: "undeclared-leaf-slot",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(unknown, catalogSet),
      [
        {
          code: "UNKNOWN_SLOT",
          pointer: "/surfaces/sign-in/root/slots/default/4/slots/content",
        },
      ],
      "undeclared leaf slot",
    ),
  });

  const tooMany = cloneJson(mapSource);
  const popup = mapNode(tooMany).slots.popup;
  const duplicate = cloneJson(popup[0]);
  duplicate.id = "store-map.popupText.second";
  popup.push(duplicate);
  cases.push({
    id: "maximum-cardinality",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(tooMany, catalogSet),
      [{ code: "SLOT_CARDINALITY", pointer: "/surfaces/stores/root/slots/default/0/slots/popup" }],
      "slot maximum cardinality",
    ),
  });

  const rejected = cloneJson(mapSource);
  mapNode(rejected).slots.popup[0] = {
    id: "store-map.popupAction",
    use: "com.example.ui/Button",
    props: { label: "Action" },
  };
  cases.push({
    id: "category-rejected-child",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(rejected, catalogSet),
      [
        {
          code: "SLOT_CHILD_REJECTED",
          pointer: "/surfaces/stores/root/slots/default/0/slots/popup/0/use",
        },
      ],
      "slot category rejection",
    ),
  });

  const requiredCatalog = cloneJson(catalog);
  requiredCatalog.components["com.example.ui/Stack"].slots.header = { required: true };
  const requiredSet = await createComponentCatalogSet(
    api,
    [requiredCatalog],
    "required-slot catalog set",
  );
  cases.push({
    id: "required-slot-absent",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(source, requiredSet.value),
      [
        { code: "SLOT_CARDINALITY", pointer: "/surfaces/home/root/slots/header" },
        { code: "SLOT_CARDINALITY", pointer: "/surfaces/sign-in/root/slots/header" },
      ],
      "required slot absence",
    ),
  });

  const orCatalog = cloneJson(catalog);
  orCatalog.components["com.example.maps/Map"].slots.popup = {
    minItems: 0,
    maxItems: 1,
    accepts: ["com.example.ui/Text"],
    acceptsCategories: ["feedback"],
  };
  const orSet = await createComponentCatalogSet(api, [orCatalog], "slot OR catalog set");
  assertSuccess(
    api.validateDesenSourceComponentContracts(mapSource, orSet.value),
    "slot exact-ID OR branch",
  );
  const categoryAccepted = cloneJson(mapSource);
  mapNode(categoryAccepted).slots.popup[0] = {
    id: "store-map.popupAlert",
    use: "com.example.ui/Alert",
    props: { tone: "info", text: "Accepted by category" },
  };
  assertSuccess(
    api.validateDesenSourceComponentContracts(categoryAccepted, orSet.value),
    "slot category OR branch",
  );
  const neitherAccepted = cloneJson(mapSource);
  mapNode(neitherAccepted).slots.popup[0] = {
    id: "store-map.popupButton",
    use: "com.example.ui/Button",
    props: { label: "Rejected" },
  };
  const orRejection = requireExactDiagnostics(
    api.validateDesenSourceComponentContracts(neitherAccepted, orSet.value),
    [
      {
        code: "SLOT_CHILD_REJECTED",
        pointer: "/surfaces/stores/root/slots/default/0/slots/popup/0/use",
      },
    ],
    "slot OR rejection",
  );

  const contradictoryCatalog = cloneJson(catalog);
  contradictoryCatalog.components["com.example.ui/Stack"].slots.default.minItems = 2;
  contradictoryCatalog.components["com.example.ui/Stack"].slots.default.maxItems = 1;
  const contradictoryResult = api.validateDesenComponentCatalogSet([contradictoryCatalog]);
  requireDiagnostic(
    contradictoryResult,
    api.INVALID_COMPONENT_CONTRACT_CODE,
    "/0/components/com.example.ui~1Stack/slots/default",
    "contradictory slot contract",
  );

  return Object.freeze({
    projectMutationGoldens: Object.freeze(cases.map((entry) => Object.freeze(entry))),
    acceptanceOr: Object.freeze({
      exactCapability: true,
      category: true,
      neither: orRejection,
    }),
    contradictoryCatalog: Object.freeze({
      code: api.INVALID_COMPONENT_CONTRACT_CODE,
      pointer: "/0/components/com.example.ui~1Stack/slots/default",
    }),
  });
}

async function verifyStyleGoldens(api, catalogSet) {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const cases = [];

  const unknownState = cloneJson(source);
  submitNode(unknownState).style = { levitating: { root: {} } };
  cases.push({
    id: "undeclared-visual-state",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(unknownState, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/slots/default/4/style/levitating",
        },
      ],
      "undeclared visual state",
    ),
  });

  const unknownPart = cloneJson(source);
  submitNode(unknownPart).style = { base: { privatePart: {} } };
  cases.push({
    id: "undeclared-style-part",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(unknownPart, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/slots/default/4/style/base/privatePart",
        },
      ],
      "undeclared style part",
    ),
  });

  const unknownProperty = cloneJson(source);
  unknownProperty.surfaces["sign-in"].root.style = { base: { root: { color: "red" } } };
  cases.push({
    id: "undeclared-style-property",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(unknownProperty, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/style/base/root/color",
        },
      ],
      "undeclared style property",
    ),
  });

  const mismatch = cloneJson(source);
  mismatch.surfaces["sign-in"].root.style = { base: { root: { background: 42 } } };
  cases.push({
    id: "style-property-schema-mismatch",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(mismatch, catalogSet),
      [
        {
          code: "PROP_TYPE_MISMATCH",
          pointer: "/surfaces/sign-in/root/style/base/root/background",
        },
      ],
      "style property mismatch",
    ),
  });

  const validState = cloneJson(source);
  submitNode(validState).style = { hover: { root: {} } };
  assertSuccess(
    api.validateDesenSourceComponentContracts(validState, catalogSet),
    "declared visual state and style part",
  );

  const variantStyle = cloneJson(source);
  submitNode(variantStyle).variants = [
    {
      when: { op: "eq", args: [true, true] },
      style: { hover: { privatePart: {} } },
    },
  ];
  cases.push({
    id: "variant-undeclared-style-part",
    diagnostics: requireExactDiagnostics(
      api.validateDesenSourceComponentContracts(variantStyle, catalogSet),
      [
        {
          code: "UNKNOWN_PROP",
          pointer: "/surfaces/sign-in/root/slots/default/4/variants/0/style/hover/privatePart",
        },
      ],
      "variant undeclared style part",
    ),
  });

  return Object.freeze({
    projectMutationGoldens: Object.freeze(cases.map((entry) => Object.freeze(entry))),
    baseAlwaysAvailable: true,
    declaredStateAndPart: true,
    unknownStateAndPartDiagnostic: "UNKNOWN_PROP",
  });
}

async function verifyLaterTaskFence(api, catalogSet) {
  const evidence = [];
  const unknownEvent = await readJson(
    path.join(CONFORMANCE_ROOT, "invalid/source-unknown-event.json"),
  );
  assertSuccess(
    api.validateDesenSourceComponentContracts(unknownEvent, catalogSet),
    "T09 official unknown event fence",
  );
  evidence.push({ ...LATER_TASK_SCOPE_CASES[0], valid: true });

  const sortable = await readJson(path.join(EXAMPLES_ROOT, "sortable-list.source.desen.json"));
  sortable.surfaces.tasks.root.behaviors[0].props.axis = "diagonal";
  assertSuccess(
    api.validateDesenSourceComponentContracts(sortable, catalogSet),
    "T09 behavior prop fence",
  );
  evidence.push({ ...LATER_TASK_SCOPE_CASES[1], valid: true });

  const unresolvedReference = await readJson(
    path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"),
  );
  unresolvedReference.surfaces["sign-in"].root.slots.default[1].props.value = {
    $ref: "state.missing",
  };
  const unresolvedResult = assertSuccess(
    api.validateDesenSourceComponentContracts(unresolvedReference, catalogSet),
    "T10 unresolved-reference fence",
  );
  requireDynamicObligations(unresolvedResult, "T10 unresolved-reference fence");
  evidence.push({ ...LATER_TASK_SCOPE_CASES[2], valid: true });

  const operationInput = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  submitNode(operationInput).on.press[0].input = { email: 42, password: "" };
  assertSuccess(
    api.validateDesenSourceComponentContracts(operationInput, catalogSet),
    "T11 operation-input fence",
  );
  evidence.push({ ...LATER_TASK_SCOPE_CASES[3], valid: true });

  const navigation = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  submitNode(navigation).on.press[0].onSuccess[0].surface = "missing";
  assertSuccess(
    api.validateDesenSourceComponentContracts(navigation, catalogSet),
    "T11 navigation fence",
  );
  evidence.push({ ...LATER_TASK_SCOPE_CASES[4], valid: true });

  for (const [vector, index] of [
    ["invalid/bundle-revision-mismatch.json", 5],
    ["invalid/bundle-catalog-digest-mismatch.json", 6],
  ]) {
    const bundle = await readJson(path.join(CONFORMANCE_ROOT, vector));
    assertSuccess(
      api.validateDesenBundleComponentContracts(bundle, catalogSet),
      `later Bundle fence ${vector}`,
    );
    evidence.push({ ...LATER_TASK_SCOPE_CASES[index], valid: true });
  }
  return Object.freeze(evidence.map((entry) => Object.freeze(entry)));
}

async function verifyDeterminism(api, catalogSet) {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  submitNode(source).props.ghost = "value";
  const normal = api.validateDesenSourceComponentContracts(source, catalogSet);
  const reversed = api.validateDesenSourceComponentContracts(
    reverseObjectMemberOrder(source),
    catalogSet,
  );
  assertJsonEqual(
    diagnosticIdentity(normal),
    diagnosticIdentity(reversed),
    "object-member permutation diagnostics",
  );

  const dynamicSource = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const first = assertSuccess(
    api.validateDesenSourceComponentContracts(dynamicSource, catalogSet),
    "first deterministic dynamic validation",
  );
  const second = assertSuccess(
    api.validateDesenSourceComponentContracts(reverseObjectMemberOrder(dynamicSource), catalogSet),
    "permuted deterministic dynamic validation",
  );
  assertJsonEqual(
    normalizedObligations(first, "first deterministic dynamic validation"),
    normalizedObligations(second, "permuted deterministic dynamic validation"),
    "object-member permutation obligations",
  );
  return Object.freeze({
    objectPermutation: "all object members recursively reversed; array order preserved",
    diagnosticsStable: true,
    obligationsStable: true,
  });
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
      fail("COMPONENT_UNSUPPORTED_ENTRY", "A reviewed directory contains a symbolic link.", {
        relativePath,
      });
    }
    if (entry.isDirectory()) files.push(...(await inventoryRegularFiles(root, relativePath)));
    else if (entry.isFile()) files.push(relativePath);
    else {
      fail("COMPONENT_UNSUPPORTED_ENTRY", "A reviewed directory contains a special entry.", {
        relativePath,
      });
    }
  }
  return files;
}

const FORBIDDEN_PLATFORM_CONSTRUCTS = Object.freeze([
  Object.freeze(["runtime require", /\brequire\s*\(/u]),
  Object.freeze(["eval", /\beval\s*\(/u]),
  Object.freeze(["Function constructor", /\b(?:new\s+)?Function\s*\(/u]),
  Object.freeze(["dynamic import", /\bimport\s*\(/u]),
  Object.freeze(["network fetch", /\bfetch\s*\(/u]),
  Object.freeze(["XMLHttpRequest", /\bXMLHttpRequest\b/u]),
  Object.freeze(["WebSocket", /\bWebSocket\b/u]),
  Object.freeze(["workspace absolute path", /\/Users\//u]),
  Object.freeze(["frozen upstream runtime access", /(?:^|["'`])[^\n"'`]*upstream\//u]),
]);

function staticImportSpecifiers(source) {
  return [
    ...[...source.matchAll(/\bfrom\s*["']([^"']+)["']/gu)].map((match) => match[1]),
    ...[...source.matchAll(/^\s*import\s*["']([^"']+)["']/gmu)].map((match) => match[1]),
  ];
}

function isRelativeImportSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

async function auditModuleFiles({ packageName, root, files, allowedBareImport }) {
  const violations = [];
  for (const file of files) {
    const source = await readFile(path.join(root, ...file.split("/")), "utf8");
    violations.push(
      ...platformViolationsForSource({
        packageName,
        file,
        source,
        allowedBareImport,
      }),
    );
  }
  return violations;
}

function platformViolationsForSource({ packageName, file, source, allowedBareImport }) {
  const violations = [];
  for (const [construct, pattern] of FORBIDDEN_PLATFORM_CONSTRUCTS) {
    if (pattern.test(source)) violations.push({ package: packageName, file, construct });
  }
  for (const specifier of staticImportSpecifiers(source)) {
    if (!isRelativeImportSpecifier(specifier) && specifier !== allowedBareImport) {
      violations.push({
        package: packageName,
        file,
        construct: specifier.startsWith("node:")
          ? "Node built-in import"
          : "unapproved bare import",
        specifier,
      });
    }
    if (file.endsWith(".js") && specifier.endsWith(".ts")) {
      violations.push({
        package: packageName,
        file,
        construct: "TypeScript distribution import",
        specifier,
      });
    }
  }
  return violations;
}

function verifyPlatformAuditGuardGoldens() {
  const probes = [
    {
      id: "validator-node-prefix",
      packageName: "@desen/validator source",
      file: "probe.ts",
      source: 'import value from "node:fs";',
      allowedBareImport: "@desen/protocol",
      expected: ["Node built-in import"],
    },
    {
      id: "validator-bare-node-builtin",
      packageName: "@desen/validator source",
      file: "probe.ts",
      source: 'import value from "fs";',
      allowedBareImport: "@desen/protocol",
      expected: ["unapproved bare import"],
    },
    {
      id: "validator-other-bare-dependency",
      packageName: "@desen/validator distribution",
      file: "probe.js",
      source: 'export { value } from "left-pad";',
      allowedBareImport: "@desen/protocol",
      expected: ["unapproved bare import"],
    },
    {
      id: "validator-protocol-subpath",
      packageName: "@desen/validator source",
      file: "probe.ts",
      source: 'import value from "@desen/protocol/private";',
      allowedBareImport: "@desen/protocol",
      expected: ["unapproved bare import"],
    },
    {
      id: "protocol-bare-dependency",
      packageName: "@desen/protocol source",
      file: "probe.ts",
      source: 'import value from "@desen/protocol";',
      allowedBareImport: undefined,
      expected: ["unapproved bare import"],
    },
    {
      id: "dynamic-code-execution",
      packageName: "@desen/validator distribution",
      file: "probe.js",
      source:
        'require("fs"); eval("1"); Function("return 1")(); import("left-pad"); fetch("https://example.invalid");',
      allowedBareImport: "@desen/protocol",
      expected: [
        "Function constructor",
        "dynamic import",
        "eval",
        "network fetch",
        "runtime require",
      ],
    },
  ];
  return Object.freeze(
    probes.map((probe) => {
      const actual = platformViolationsForSource(probe)
        .map(({ construct }) => construct)
        .sort(compareText);
      assertJsonEqual(
        actual,
        [...probe.expected].sort(compareText),
        `platform audit guard ${probe.id}`,
        "COMPONENT_PLATFORM_AUDIT_GUARD_DRIFT",
      );
      return Object.freeze({ id: probe.id, rejectedConstructs: Object.freeze(actual) });
    }),
  );
}

function expectedDistributionFiles(sourceFiles) {
  return sourceFiles
    .flatMap((file) => {
      const module = file.slice(0, -3);
      return [".d.ts", ".d.ts.map", ".js", ".js.map"].map((suffix) => `${module}${suffix}`);
    })
    .sort(compareText);
}

async function verifyPlatformAndDistributionAudit() {
  const guardGoldens = verifyPlatformAuditGuardGoldens();
  const validatorSourceRoot = path.join(WORKSPACE_ROOT, "packages/validator/src");
  const validatorSourceFiles = (await inventoryRegularFiles(validatorSourceRoot))
    .filter((file) => file.endsWith(".ts"))
    .sort(compareText);
  const validatorDistributionRoot = path.join(WORKSPACE_ROOT, "packages/validator/dist");
  const validatorDistributionFiles = (await inventoryRegularFiles(validatorDistributionRoot)).sort(
    compareText,
  );
  assertJsonEqual(
    validatorDistributionFiles,
    expectedDistributionFiles(validatorSourceFiles),
    "validator built distribution inventory",
    "COMPONENT_DIST_AUDIT_FAILED",
  );

  const protocolSourceRoot = path.join(WORKSPACE_ROOT, "packages/protocol/src");
  const protocolSourceFiles = (await inventoryRegularFiles(protocolSourceRoot))
    .filter((file) => file.endsWith(".ts"))
    .sort(compareText);
  const protocolDistributionRoot = path.join(WORKSPACE_ROOT, "packages/protocol/dist");
  const protocolDistributionFiles = (await inventoryRegularFiles(protocolDistributionRoot)).sort(
    compareText,
  );
  assertJsonEqual(
    protocolDistributionFiles,
    expectedDistributionFiles(protocolSourceFiles),
    "protocol built distribution inventory",
    "COMPONENT_DIST_AUDIT_FAILED",
  );

  const validatorAuditedDistributionFiles = validatorDistributionFiles.filter(
    (file) => file.endsWith(".js") || file.endsWith(".d.ts"),
  );
  const protocolAuditedDistributionFiles = protocolDistributionFiles.filter(
    (file) => file.endsWith(".js") || file.endsWith(".d.ts"),
  );
  const violations = [
    ...(await auditModuleFiles({
      packageName: "@desen/validator source",
      root: validatorSourceRoot,
      files: validatorSourceFiles,
      allowedBareImport: "@desen/protocol",
    })),
    ...(await auditModuleFiles({
      packageName: "@desen/validator distribution",
      root: validatorDistributionRoot,
      files: validatorAuditedDistributionFiles,
      allowedBareImport: "@desen/protocol",
    })),
    ...(await auditModuleFiles({
      packageName: "@desen/protocol source",
      root: protocolSourceRoot,
      files: protocolSourceFiles,
      allowedBareImport: undefined,
    })),
    ...(await auditModuleFiles({
      packageName: "@desen/protocol distribution",
      root: protocolDistributionRoot,
      files: protocolAuditedDistributionFiles,
      allowedBareImport: undefined,
    })),
  ];
  if (violations.length > 0) {
    fail(
      "COMPONENT_PLATFORM_AUDIT_FAILED",
      "Validator or transitive protocol code violates the T08 platform boundary.",
      { violations },
    );
  }

  const protocolPackage = await readJson(
    path.join(WORKSPACE_ROOT, "packages/protocol/package.json"),
  );
  if (
    protocolPackage.exports?.["."]?.import !== "./dist/index.js" ||
    Object.keys(protocolPackage.dependencies ?? {}).length !== 0
  ) {
    fail(
      "COMPONENT_RUNTIME_DEPENDENCY_DRIFT",
      "The transitive @desen/protocol runtime entry or dependency set changed.",
      { exports: protocolPackage.exports, dependencies: protocolPackage.dependencies ?? {} },
    );
  }
  const protocolEntrySpecifiers = staticImportSpecifiers(
    await readFile(path.join(protocolDistributionRoot, "index.js"), "utf8"),
  )
    .map((specifier) => path.posix.basename(specifier))
    .sort(compareText);
  assertJsonEqual(
    protocolEntrySpecifiers,
    ["canonicalization.js", "diagnostics.js", "json-pointer.js"],
    "transitive protocol runtime closure",
    "COMPONENT_DIST_AUDIT_FAILED",
  );

  return Object.freeze({
    packages: Object.freeze({
      validator: Object.freeze({
        sourceFiles: Object.freeze(validatorSourceFiles),
        distributionFiles: Object.freeze(validatorDistributionFiles),
        auditedDistributionFiles: Object.freeze(validatorAuditedDistributionFiles),
        allowedImports: Object.freeze(["relative", "@desen/protocol"]),
      }),
      protocol: Object.freeze({
        sourceFiles: Object.freeze(protocolSourceFiles),
        distributionFiles: Object.freeze(protocolDistributionFiles),
        auditedDistributionFiles: Object.freeze(protocolAuditedDistributionFiles),
        allowedImports: Object.freeze(["relative"]),
        runtimeSourceFiles: PROTOCOL_RUNTIME_SOURCE_FILES,
        runtimeDistributionFiles: PROTOCOL_RUNTIME_DISTRIBUTION_FILES,
      }),
    }),
    runtimeSchemaEngine: "code-free in-package Draft 2020-12 interpreter",
    runtimeSchemaCompilation: false,
    dynamicExecution: false,
    networkResolution: "none; T06 rejects non-local schema references",
    guardGoldens,
    forbiddenConstructs: Object.freeze([
      ...FORBIDDEN_PLATFORM_CONSTRUCTS.map(([label]) => label),
      "Node built-in import",
      "unapproved bare import",
      "TypeScript distribution import",
    ]),
  });
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
  for (const file of PROTOCOL_RUNTIME_SOURCE_FILES) paths.add(`packages/protocol/src/${file}`);
  for (const file of PROTOCOL_RUNTIME_DISTRIBUTION_FILES) {
    paths.add(`packages/protocol/dist/${file}`);
  }
  return [...paths].sort(compareText);
}

async function trackedFileEvidence() {
  const evidence = [];
  for (const relativePath of await trackedImplementationPaths()) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, ...relativePath.split("/")));
    evidence.push(
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
  }
  return Object.freeze(evidence);
}

async function assertArtifactDestinationEntry(artifactPath) {
  try {
    const stats = await lstat(artifactPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("COMPONENT_ARTIFACT_UNSUPPORTED_ENTRY", "Evidence destination must be a regular file.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function resolveWritableArtifactPath(artifactPath) {
  const absoluteArtifactPath = path.resolve(artifactPath);
  const requestedParent = path.dirname(absoluteArtifactPath);
  const parentStats = await lstat(requestedParent);
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
    fail(
      "COMPONENT_ARTIFACT_UNSUPPORTED_ENTRY",
      "Evidence destination parent must be a real directory.",
    );
  }
  const resolvedParent = await realpath(requestedParent);
  const resolvedArtifactPath = path.join(resolvedParent, path.basename(absoluteArtifactPath));
  await assertArtifactDestinationEntry(resolvedArtifactPath);
  return Object.freeze({ resolvedArtifactPath, resolvedParent });
}

async function openExclusiveArtifactTemporary(resolvedParent, artifactName) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(12).toString("hex");
    const temporaryPath = path.join(
      resolvedParent,
      `.${artifactName}.${process.pid}.${suffix}.tmp`,
    );
    try {
      const handle = await open(temporaryPath, "wx", 0o644);
      return { handle, temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail(
    "COMPONENT_ARTIFACT_TEMPORARY_COLLISION",
    "Could not reserve an exclusive same-directory evidence temporary file.",
  );
}

async function removeTemporaryArtifact(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T08 component-contract evidence entirely in memory. */
export async function buildProtocolComponentContractsEvidence({
  tracePath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_TRACE_PATH,
  normativeCoveragePath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_NORMATIVE_PATH,
  findingsPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_FINDINGS_PATH,
  schemaSafetySourcePath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_SCHEMA_SAFETY_SOURCE_PATH,
  diagnosticsArtifactPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_DIAGNOSTICS_ARTIFACT_PATH,
  semanticArtifactPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_SEMANTIC_ARTIFACT_PATH,
  validatorApi,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot ? await verifyProtocolSnapshot() : EXPECTED_PROTOCOL_SNAPSHOT;
  const api = validatorApi ?? (await loadValidatorApi());
  const trace = await verifyTraceability(tracePath);
  const normative = await verifyNormativeCoverage(normativeCoveragePath);
  const implementationFindings = await verifyImplementationFindings(findingsPath);
  const schemaSafetyProfile = await verifySchemaSafetyProfileSource(schemaSafetySourcePath);
  const diagnosticsDependency = await verifyPrerequisite(
    diagnosticsArtifactPath,
    {
      task: "M02-T05",
      profile: "desen-diagnostics-json-pointer-v1",
      verifierName: "verifyProtocolDiagnostics",
    },
    verifyProtocolDiagnostics,
  );
  const semanticDependency = await verifyPrerequisite(
    semanticArtifactPath,
    {
      task: "M02-T07",
      profile: "desen-semantic-foundation-v1",
      result: "PASS",
      verifierName: "verifyProtocolSemanticFoundation",
    },
    verifyProtocolSemanticFoundation,
  );
  verifyPublicApi(api);
  await verifyCommandWiring();

  const catalog = await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json"));
  const catalogSetResult = await createComponentCatalogSet(
    api,
    [catalog],
    "frozen component catalog set",
  );
  const schemaSafetyGoldens = await verifySchemaSafetyGoldens(api, catalog);
  const frozen = await verifyFrozenDocuments(api, catalogSetResult.value);
  const props = await verifyPropGoldens(api, catalogSetResult.value);
  const slots = await verifySlotGoldens(api, catalog, catalogSetResult.value);
  const styles = await verifyStyleGoldens(api, catalogSetResult.value);
  const scopeFence = await verifyLaterTaskFence(api, catalogSetResult.value);
  const determinism = await verifyDeterminism(api, catalogSetResult.value);
  const platformAudit = await verifyPlatformAndDistributionAudit();

  const artifact = {
    schemaVersion: 1,
    task: "M02-T08",
    result: "PASS",
    protocolVersion: "0.1.0",
    profile: "desen-component-contract-validation-v1",
    prerequisites: {
      diagnostics: diagnosticsDependency,
      semanticFoundation: semanticDependency,
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
      schemaFamilies: trace.families,
      schemaFamilyCount: trace.familyCount,
      schemaConstraints: trace.constraintCount,
      conformanceResponsibilities: [],
      proseRules: EXPECTED_PROSE_RULES,
      mandatoryClauses: normative,
      coreDiagnostics: EXPECTED_CORE_DIAGNOSTICS,
      implementationDiagnostic: api.INVALID_COMPONENT_CONTRACT_CODE,
      implementationFindings,
    },
    publicApi: {
      package: "@desen/validator",
      runtimeExports: REQUIRED_RUNTIME_EXPORTS,
      catalogSetBoundary:
        "validateDesenComponentCatalogSet returns the trusted component-contract catalog set",
      failureValue: "absent",
      successValue: "independent recursively frozen JSON snapshot",
      dynamicObligations: "deeply frozen deterministic inert JSON array",
      failureObligations: "required for Source and Bundle; deeply frozen inert JSON array",
      dispatcherParity:
        "generic Source and Bundle success/failure results exactly match specialized API data",
    },
    frozenValidation: {
      validConformance: frozen.validConformance,
      validExamples: frozen.validExamples,
      predecessorFailures: frozen.predecessorFailures,
      officialT08Invalid: frozen.officialT08Invalid,
      duplicateFrozenBytes: frozen.duplicateFrozenBytes,
    },
    componentProps: props,
    slots,
    styles,
    schemaSafetyGoldens,
    dynamicObligations: frozen.dynamicObligations,
    laterTaskScopeAccepted: scopeFence,
    determinism,
    security: {
      rawInputs: "re-enter T06 structural and T07 semantic trust boundaries",
      documentCodeExecution: false,
      remoteSchemaResolution: false,
      platformAudit,
    },
    implementation: {
      platform: "ECMAScript 2023; no Node, DOM, React, browser, eval, or network API",
      runtimeDependencies: [
        { name: "@desen/protocol", version: "workspace:*", license: "Apache-2.0" },
      ],
      transitiveRuntimeDependencies: [],
      schemaEngine: {
        delivery: "code-free in-package interpreter",
        dialect: "https://json-schema.org/draft/2020-12/schema",
        runtimeCompilation: false,
        typeCoercion: false,
        defaults: false,
        removeAdditional: false,
        externalReferences: false,
        regexSafetyProfile: schemaSafetyProfile,
      },
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      trackedFiles: await trackedFileEvidence(),
    },
    verification: {
      commands: [
        "pnpm generate:protocol-component-contracts",
        "pnpm verify:protocol-component-contracts",
        "pnpm test:protocol-component-contracts",
        "pnpm check",
      ],
      artifactWriter: {
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        commit: "atomic rename",
        failureCleanup: "temporary file removed",
        rejectedDestinations: ["symlink", "directory", "special file", "symlink parent"],
      },
      independentAnchors: [
        "complete predecessor-verifier PASS plus exact bytes for M02-T05 diagnostics and M02-T07 semantic foundation",
        "reviewed exact per-family T08 counts totalling 7 families / 191 constraints",
        "BCP 14 N-026/N-028/N-029 TESTED ownership rows",
        "reviewed PF-010 slot decisions plus PF-011 host-safe schema/regex budget decisions and implementation diagnostic",
        "five core diagnostic identities D-008 through D-012",
        "frozen valid documents and explicit absence of official T08 invalid vectors",
        "project-owned prop, slot, style, variant, exact sign-in/store-map/failure obligation, dispatcher, and scope-fence goldens",
        "public catalog-set depth and host-safe regex boundary goldens",
        "validator and transitive @desen/protocol source/distribution import and code-execution audits",
        "same-directory exclusive temporary write followed by atomic rename",
      ],
    },
    limitations: [
      "The frozen suite contains no official M02-T08 invalid vector; all T08 negative contract cases are explicitly project-owned mutations.",
      "Dynamic ValueSpec values produce deterministic obligations; reference resolution and runtime value validation remain M02-T10, M04, M05, and M06 responsibilities.",
      "Behavior props, slots, style, attachment, conflicts, event, command, and payload contracts remain M02-T09.",
      "Resource, operation, action, navigation, refresh, and command-target contracts remain M02-T11.",
      "Official-suite parity and exhaustive diagnostic micro-vectors remain M02-T12 and M02-T13.",
      "PF-011 remains OPEN: DESEN 0.1.0 does not standardize a portable regex engine or schema-complexity bound, so T08 fails closed under a documented project-owned host-safe profile and 50,000-step budget.",
      "This task does not claim publication, runtime execution, activation, G02, or any new Proof Matrix P-* result.",
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

/** Writes deterministic M02-T08 evidence to its single tracked regular-file destination. */
export async function writeProtocolComponentContractsEvidence({
  artifactPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolComponentContractsEvidence();
  const { handle, temporaryPath } = await openExclusiveArtifactTemporary(
    resolvedParent,
    path.basename(resolvedArtifactPath),
  );
  let openHandle = handle;
  try {
    await openHandle.writeFile(result.artifactBytes);
    await openHandle.sync();
    await openHandle.close();
    openHandle = undefined;
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(
        Object.freeze({
          artifactPath: resolvedArtifactPath,
          temporaryPath,
        }),
      );
    }
    await assertArtifactDestinationEntry(resolvedArtifactPath);
    await rename(temporaryPath, resolvedArtifactPath);
    return result;
  } catch (error) {
    if (openHandle !== undefined) {
      try {
        await openHandle.close();
      } catch {
        // Preserve the primary writer failure; cleanup below remains best-effort but explicit.
      }
    }
    try {
      await removeTemporaryArtifact(temporaryPath);
    } catch (cleanupError) {
      fail(
        "COMPONENT_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
        "Evidence generation failed and its exclusive temporary file could not be removed.",
        {
          temporaryPath,
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}

/** Rebuilds and byte-compares the tracked M02-T08 evidence without modifying it. */
export async function verifyProtocolComponentContracts({
  artifactPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolComponentContractsEvidence();
  const actual = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actual).equals(result.artifactBytes)) {
    fail("COMPONENT_ARTIFACT_DRIFT", "Tracked M02-T08 evidence is stale or modified.", {
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(actual),
    });
  }
  return Object.freeze({
    result: "PASS",
    schemaFamilies: EXPECTED_SCHEMA_FAMILY_COUNTS.length,
    schemaConstraints: EXPECTED_SCHEMA_CONSTRAINTS,
    coreDiagnostics: EXPECTED_CORE_DIAGNOSTICS.length,
    officialT08Invalid: 0,
    projectMutationGoldens:
      result.artifact.componentProps.projectMutationGoldens.length +
      result.artifact.slots.projectMutationGoldens.length +
      result.artifact.styles.projectMutationGoldens.length,
    schemaSafetyGoldens:
      result.artifact.schemaSafetyGoldens.accepted.length +
      result.artifact.schemaSafetyGoldens.rejected.length,
    scopeFenceAccepted: LATER_TASK_SCOPE_CASES.length,
    examples: FROZEN_EXAMPLES.length,
    artifactSha256: result.artifactSha256,
  });
}
