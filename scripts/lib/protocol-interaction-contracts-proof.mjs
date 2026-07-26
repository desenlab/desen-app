import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolComponentContracts,
} from "./protocol-component-contracts-proof.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T09 evidence artifact. */
export const DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json",
);

/** Absolute path to the reviewed protocol trace ledger used by M02-T09 evidence. */
export const DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the BCP 14 ownership ledger used by M02-T09 evidence. */
export const DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_NORMATIVE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/NORMATIVE-COVERAGE.md",
);

/** Absolute path to the reviewed PF-010 through PF-014 findings ledger. */
export const DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/plan/PROTOCOL-FINDINGS.md",
);

/** Absolute path to the reviewed interaction implementation and payload-limit source. */
export const DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/validator/src/interaction-contract-validation.ts",
);

const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "EVENT_PAYLOAD_SAFETY_LIMITS",
  "INVALID_INTERACTION_CONTRACT_CODE",
  "validateDesenBundleInteractionContracts",
  "validateDesenEventPayload",
  "validateDesenInteractionCatalogSet",
  "validateDesenInteractionContracts",
  "validateDesenSourceInteractionContracts",
]);

const EXPECTED_SCHEMA_FAMILIES = Object.freeze([
  Object.freeze({ id: "SC-030", expectedConstraints: 5 }),
  Object.freeze({ id: "SC-044", expectedConstraints: 54 }),
  Object.freeze({ id: "SC-046", expectedConstraints: 70 }),
  Object.freeze({ id: "SC-053", expectedConstraints: 7 }),
  Object.freeze({ id: "SC-054", expectedConstraints: 7 }),
  Object.freeze({ id: "SC-057", expectedConstraints: 39 }),
  Object.freeze({ id: "SC-058", expectedConstraints: 64 }),
]);
const EXPECTED_SCHEMA_CONSTRAINTS = 246;
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-044",
  "R-062",
  "R-069",
  "R-070",
  "R-071",
  "R-080",
  "R-120",
]);
const EXPECTED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-013", code: "UNKNOWN_EVENT" }),
  Object.freeze({ id: "D-014", code: "EVENT_PAYLOAD_INVALID" }),
  Object.freeze({ id: "D-015", code: "UNKNOWN_COMMAND" }),
  Object.freeze({ id: "D-017", code: "BEHAVIOR_ATTACHMENT_INVALID" }),
  Object.freeze({ id: "D-018", code: "BEHAVIOR_CONFLICT" }),
]);
const REUSED_COMPONENT_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-008", code: "UNKNOWN_PROP" }),
  Object.freeze({ id: "D-009", code: "PROP_TYPE_MISMATCH" }),
  Object.freeze({ id: "D-010", code: "UNKNOWN_SLOT" }),
  Object.freeze({ id: "D-011", code: "SLOT_CARDINALITY" }),
  Object.freeze({ id: "D-012", code: "SLOT_CHILD_REJECTED" }),
]);
const EXPECTED_BCP14 = Object.freeze([
  Object.freeze({ id: "N-033", status: "PLANNED" }),
  Object.freeze({ id: "N-034", status: "PLANNED" }),
]);
const NORMATIVE_STATUS_RANK = Object.freeze({
  NOT_STARTED: -1,
  PLANNED: 0,
  TESTED: 1,
});
const HISTORICAL_SELF_RECORD = Object.freeze({
  path: "scripts/lib/protocol-interaction-contracts-proof.mjs",
  bytes: 86_101,
  sha256: "99f3a601ab1ba3d995e41a54f15a0c3bf93c17f60a227600870e5b7b5f188c62",
});
const HISTORICAL_ROOT_TEST_RECORD = Object.freeze({
  path: "tests/protocol-interaction-contracts.test.mjs",
  bytes: 16_137,
  sha256: "594d131322ba2949b80f64378b7151583274a1b3be6dcc2ce83bd5b3d49db59a",
});
const EXPECTED_PAYLOAD_LIMITS = Object.freeze({
  maxDepth: 128,
  maxJsonNodes: 4_096,
  maxStringCodeUnits: 1_048_576,
});

const FROZEN_EXAMPLES = Object.freeze([
  Object.freeze({ file: "catalog.web.example.json", target: "catalog-set" }),
  Object.freeze({ file: "sign-in.source.desen.json", target: "source" }),
  Object.freeze({ file: "sign-in.bundle.desen.json", target: "bundle" }),
  Object.freeze({ file: "sortable-list.source.desen.json", target: "source" }),
  Object.freeze({ file: "store-map.source.desen.json", target: "source" }),
]);

const FIXED_TRACKED_PATHS = Object.freeze([
  "packages/protocol/tsconfig.build.json",
  "packages/protocol/tsconfig.json",
  "packages/validator/scripts/clean-dist.mjs",
  "packages/validator/test/component-contracts.test.ts",
  "packages/validator/test/interaction-contracts.test.ts",
  "packages/validator/test/schema-instance-validation.test.ts",
  "packages/validator/tsconfig.build.json",
  "packages/validator/tsconfig.json",
  "docs/proof/PROTOCOL-INTERACTION-CONTRACTS.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/lib/protocol-interaction-contracts-proof.mjs",
  "scripts/generate-protocol-interaction-contracts-proof.mjs",
  "scripts/verify-protocol-interaction-contracts.mjs",
  "tests/protocol-interaction-contracts.test.mjs",
]);

const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const SORTABLE = "com.example.interactions/Sortable";
const INVALID_INTERACTION_CONTRACT = "run.desen.validator/INVALID_INTERACTION_CONTRACT";

/** Stable failure raised when deterministic M02-T09 evidence cannot be established. */
export class ProtocolInteractionContractsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProtocolInteractionContractsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ProtocolInteractionContractsEvidenceError(code, message, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertJsonEqual(actual, expected, label, code = "INTERACTION_GOLDEN_MISMATCH") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} changed.`, { expected, actual });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value, label = "value") {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INTERACTION_FIXTURE_INVALID", `${label} must be an object.`);
  }
  return value;
}

function atPath(root, segments) {
  let current = root;
  for (const segment of segments) {
    current = Array.isArray(current)
      ? current[segment]
      : asObject(current, segments.join("/"))[segment];
  }
  return current;
}

function objectAt(root, segments) {
  return asObject(atPath(root, segments), segments.join("/"));
}

function writePath(root, segments, value) {
  const parent = atPath(root, segments.slice(0, -1));
  const key = segments.at(-1);
  if (Array.isArray(parent)) parent[key] = value;
  else asObject(parent)[key] = value;
}

function isDeepFrozen(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    if (!Object.isFrozen(value)) return false;
    pending.push(...Object.values(value));
  }
  return true;
}

function assertPortableFrozen(value, label) {
  if (!isDeepFrozen(value)) {
    fail("INTERACTION_RESULT_MUTABLE", `${label} is not recursively frozen.`);
  }
  try {
    JSON.stringify(value);
  } catch {
    fail("INTERACTION_RESULT_NOT_JSON", `${label} is not JSON-serializable.`);
  }
}

function diagnosticIdentity(result) {
  return result.diagnostics.map(({ code, pointer }) => ({
    code,
    ...(pointer === undefined ? {} : { pointer }),
  }));
}

function obligationIdentity(result) {
  return (result.obligations ?? []).map(({ kind, pointer, context }) => ({
    kind,
    pointer,
    context,
  }));
}

function assertSuccess(result, label) {
  if (
    result?.valid !== true ||
    !("value" in result) ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length > 0
  ) {
    fail("INTERACTION_PUBLIC_API_FAILURE", `${label} unexpectedly failed.`, {
      diagnostics: result?.diagnostics,
    });
  }
  assertPortableFrozen(result, label);
  return result;
}

function assertFailure(result, expected, label) {
  if (result?.valid !== false || "value" in result) {
    fail("INTERACTION_PUBLIC_API_WEAKENED", `${label} unexpectedly passed.`);
  }
  assertJsonEqual(diagnosticIdentity(result), expected, label);
  assertPortableFrozen(result, label);
  return result;
}

async function loadValidatorApi() {
  return import(`${VALIDATOR_API_URL.href}?proof=${String(Date.now())}`);
}

function verifyPublicApi(api) {
  for (const exportName of EXPECTED_RUNTIME_EXPORTS) {
    if (!(exportName in api)) {
      fail("INTERACTION_PUBLIC_EXPORT_DRIFT", `Missing public export ${exportName}.`);
    }
  }
  for (const functionName of EXPECTED_RUNTIME_EXPORTS.filter(
    (name) => name.startsWith("validate") && name !== "validateDesenEventPayload",
  )) {
    if (typeof api[functionName] !== "function") {
      fail("INTERACTION_PUBLIC_EXPORT_DRIFT", `${functionName} is not a function.`);
    }
  }
  if (typeof api.validateDesenEventPayload !== "function") {
    fail("INTERACTION_PUBLIC_EXPORT_DRIFT", "validateDesenEventPayload is not a function.");
  }
  if (api.INVALID_INTERACTION_CONTRACT_CODE !== INVALID_INTERACTION_CONTRACT) {
    fail("INTERACTION_PUBLIC_EXPORT_DRIFT", "The implementation diagnostic identity changed.");
  }
  assertJsonEqual(
    api.EVENT_PAYLOAD_SAFETY_LIMITS,
    EXPECTED_PAYLOAD_LIMITS,
    "EVENT_PAYLOAD_SAFETY_LIMITS",
    "INTERACTION_PAYLOAD_LIMIT_DRIFT",
  );
  if (!Object.isFrozen(api.EVENT_PAYLOAD_SAFETY_LIMITS)) {
    fail("INTERACTION_PAYLOAD_LIMIT_DRIFT", "EVENT_PAYLOAD_SAFETY_LIMITS is mutable.");
  }
  return Object.freeze([...EXPECTED_RUNTIME_EXPORTS]);
}

async function verifyCommandWiring() {
  const root = await readJson(path.join(WORKSPACE_ROOT, "package.json"));
  const validator = await readJson(path.join(WORKSPACE_ROOT, "packages/validator/package.json"));
  const expected = {
    "generate:protocol-interaction-contracts":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-interaction-contracts-proof.mjs",
    "verify:protocol-interaction-contracts":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-interaction-contracts.mjs",
    "test:protocol-interaction-contracts":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:interaction-contracts && node --test tests/protocol-interaction-contracts.test.mjs",
  };
  for (const [name, command] of Object.entries(expected)) {
    if (root.scripts?.[name] !== command) {
      fail("INTERACTION_COMMAND_WIRING_DRIFT", `${name} wiring changed.`, {
        expected: command,
        actual: root.scripts?.[name],
      });
    }
  }
  const packageCommand =
    "vitest run test/schema-instance-validation.test.ts test/component-contracts.test.ts test/interaction-contracts.test.ts";
  if (validator.scripts?.["test:interaction-contracts"] !== packageCommand) {
    fail("INTERACTION_COMMAND_WIRING_DRIFT", "Package interaction-test wiring changed.", {
      expected: packageCommand,
      actual: validator.scripts?.["test:interaction-contracts"],
    });
  }
  for (const [scriptName, required] of [
    ["test", "pnpm test:protocol-interaction-contracts"],
    ["check", "pnpm verify:protocol-interaction-contracts"],
  ]) {
    if (!root.scripts?.[scriptName]?.includes(required)) {
      fail("INTERACTION_COMMAND_WIRING_DRIFT", `${scriptName} omits ${required}.`);
    }
  }
  return Object.freeze({ root: Object.freeze(expected), package: packageCommand });
}

function ownedIds(entries, owner, ownerField = "owners") {
  return entries
    .filter((entry) => entry[ownerField]?.includes(owner))
    .map(({ id }) => id)
    .sort(compareText);
}

async function verifyTraceability(tracePath) {
  const trace = await readJson(tracePath);
  const ownedFamilies = trace.schemaFamilies.filter(({ semanticOwners }) =>
    semanticOwners?.includes("M02-T09"),
  );
  const families = ownedFamilies
    .map(({ id, expectedConstraints }) => ({ id, expectedConstraints }))
    .sort((left, right) => compareText(left.id, right.id));
  assertJsonEqual(
    families,
    EXPECTED_SCHEMA_FAMILIES,
    "M02-T09 schema ownership",
    "INTERACTION_TRACE_DRIFT",
  );
  const constraintCount = families.reduce((total, entry) => total + entry.expectedConstraints, 0);
  if (constraintCount !== EXPECTED_SCHEMA_CONSTRAINTS) {
    fail("INTERACTION_TRACE_DRIFT", "M02-T09 schema constraint total changed.", {
      expected: EXPECTED_SCHEMA_CONSTRAINTS,
      actual: constraintCount,
    });
  }
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T09"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "M02-T09 prose ownership",
    "INTERACTION_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T09"),
    [],
    "M02-T09 conformance ownership",
    "INTERACTION_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T09"))
    .map(({ id, anchor }) => ({ id, code: anchor }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_CORE_DIAGNOSTICS,
    "M02-T09 diagnostic ownership",
    "INTERACTION_TRACE_DRIFT",
  );
  for (const reused of REUSED_COMPONENT_DIAGNOSTICS) {
    const row = trace.diagnostics.find(({ id }) => id === reused.id);
    if (row?.anchor !== reused.code) {
      fail("INTERACTION_TRACE_DRIFT", `${reused.id} reused diagnostic identity changed.`);
    }
  }
  const commandInput = trace.diagnostics.find(({ id }) => id === "D-016");
  if (commandInput?.owners?.includes("M02-T09")) {
    fail("INTERACTION_TRACE_DRIFT", "COMMAND_INPUT_INVALID moved into T09 scope.");
  }
  return Object.freeze({ families: Object.freeze(families), constraintCount });
}

function parseCoverageRows(markdown) {
  const rows = new Map();
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\| ((?:N|S)-\d{3}) \|/u);
    if (match === null) continue;
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

/**
 * Validates current M02-T09 normative ownership while preserving its task-time artifact
 * projection.
 *
 * @remarks Later tasks may monotonically advance a row from `PLANNED` to `TESTED`. The immutable
 * M02-T09 artifact must continue to describe the status observed when that artifact was produced.
 * Current verifier bytes are owned by M04-T16 after this compatibility migration.
 */
export function verifyProtocolInteractionNormativeCompatibility(markdown) {
  const rows = parseCoverageRows(markdown);
  const owned = [...rows]
    .filter(([, row]) => row.owners.includes("M02-T09"))
    .map(([id]) => id)
    .sort(compareText);
  assertJsonEqual(
    owned,
    EXPECTED_BCP14.map(({ id }) => id),
    "M02-T09 BCP 14 ownership",
    "INTERACTION_NORMATIVE_DRIFT",
  );
  const currentStatuses = EXPECTED_BCP14.map(({ id, status: historicalStatus }) => {
    const currentStatus = rows.get(id)?.status;
    const historicalRank = NORMATIVE_STATUS_RANK[historicalStatus];
    const currentRank = NORMATIVE_STATUS_RANK[currentStatus];
    if (currentRank === undefined || currentRank < historicalRank) {
      fail(
        "INTERACTION_NORMATIVE_DRIFT",
        `M02-T09 BCP 14 status regressed or became unknown for ${id}.`,
        { id, historicalStatus, currentStatus },
      );
    }
    return Object.freeze({ id, status: currentStatus });
  });
  return Object.freeze({
    historicalProjection: EXPECTED_BCP14,
    currentStatuses: Object.freeze(currentStatuses),
  });
}

async function verifyNormativeCoverage(normativePath) {
  const compatibility = verifyProtocolInteractionNormativeCompatibility(
    await readFile(normativePath, "utf8"),
  );
  return compatibility.historicalProjection;
}

function findingSection(markdown, id) {
  const start = markdown.indexOf(`## ${id} `);
  if (start < 0) fail("INTERACTION_FINDING_DRIFT", `${id} is missing.`);
  const end = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, end < 0 ? undefined : end).replace(/\s+/gu, " ");
}

async function verifyFindings(findingsPath) {
  const markdown = await readFile(findingsPath, "utf8");
  const anchors = {
    "PF-010": [
      "same profile applies to slots declared by component and behavior capabilities",
      "explicitly empty union rejects every child",
      "run.desen.validator/INVALID_INTERACTION_CONTRACT",
    ],
    "PF-011": [
      "maximum traversal/evaluation depth of 128",
      "4,096 schema nodes",
      "deterministic 50,000-step evaluation budget",
      "component/behavior event payload and command input schemas",
      "Unsafe patterns are never passed to native `RegExp`",
    ],
    "PF-012": [
      "The two routes form an OR union",
      "explicitly present empty union rejects every attachment",
      "each behavior contract lists the other's exact capability ID",
      "later behavior in document order",
    ],
    "PF-013": [
      "detached, immutable, inert JSON snapshot",
      "ordinary JSON members and never produce binding obligations",
      "pointer relative to the payload root",
      "does not claim that mandatory clause complete",
    ],
    "PF-014": [
      "target is already known to be a component node",
      "M02-T11 indexes component nodes per surface",
      "component-command-input` obligations",
      "no `behavior.command` semantics are invented",
      "Command validation alone does not complete the adapter implementation obligation",
    ],
  };
  for (const [id, required] of Object.entries(anchors)) {
    const section = findingSection(markdown, id);
    for (const anchor of ["- Status: OPEN", "- Blocks proof: No;", ...required]) {
      if (!section.includes(anchor)) {
        fail("INTERACTION_FINDING_DRIFT", `${id} no longer records a reviewed decision.`, {
          missing: anchor,
        });
      }
    }
  }
  return Object.freeze({
    slotProfile: "PF-010",
    schemaSafety: "PF-011",
    attachmentAndConflict: "PF-012",
    eventPayload: "PF-013",
    commandBoundary: "PF-014",
  });
}

async function verifyInteractionSource(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const normalized = source.replace(/\s+/gu, " ");
  for (const anchor of [
    "export const EVENT_PAYLOAD_SAFETY_LIMITS = Object.freeze({ maxDepth: 128, maxJsonNodes: 4_096, maxStringCodeUnits: 1_048_576, } as const);",
    "let discoveredNodes = 1;",
    "lengthDescriptor.value > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes",
    "ownKeys.length > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes",
    "discoveredNodes += length;",
    "discoveredNodes += keys.length;",
    "depth > EVENT_PAYLOAD_SAFETY_LIMITS.maxDepth",
    "stringCodeUnits > EVENT_PAYLOAD_SAFETY_LIMITS.maxStringCodeUnits",
    '"complete", "resolved-value"',
    "validateDesenComponentCatalogSet(input)",
    "validateDesenComponentContracts(target, input, catalogSet)",
  ]) {
    if (!normalized.includes(anchor)) {
      fail("INTERACTION_SOURCE_PROFILE_DRIFT", "A reviewed T09 source boundary changed.", {
        missing: anchor,
      });
    }
  }
  const snapshotBoundaryStart = source.indexOf("function inertBoundedJsonSnapshot");
  const arrayReservationIndex = source.indexOf(
    "lengthDescriptor.value > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes",
    snapshotBoundaryStart,
  );
  const objectReservationIndex = source.indexOf(
    "ownKeys.length > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes",
    snapshotBoundaryStart,
  );
  const canonicalSnapshotIndex = source.indexOf(
    "canonicalizeJson(root.value)",
    snapshotBoundaryStart,
  );
  const snapshotBoundaryEnd = source.indexOf(
    "\n}\n\nfunction eventReferenceSnapshot",
    snapshotBoundaryStart,
  );
  const snapshotBoundary = source.slice(snapshotBoundaryStart, snapshotBoundaryEnd);
  const canonicalCalls = [...snapshotBoundary.matchAll(/\bcanonicalizeJson\s*\(/gu)];
  if (
    snapshotBoundaryStart < 0 ||
    arrayReservationIndex <= snapshotBoundaryStart ||
    objectReservationIndex <= arrayReservationIndex ||
    canonicalSnapshotIndex <= objectReservationIndex ||
    snapshotBoundaryEnd <= canonicalSnapshotIndex ||
    canonicalCalls.length !== 1 ||
    snapshotBoundaryStart + canonicalCalls[0].index !== canonicalSnapshotIndex
  ) {
    fail(
      "INTERACTION_SOURCE_PROFILE_DRIFT",
      "Resolved payload expansion must be bounded before canonical serialization.",
    );
  }
  return Object.freeze({
    payloadLimits: EXPECTED_PAYLOAD_LIMITS,
    payloadInterpretation: "resolved-value; ValueSpec-shaped members stay inert JSON",
    preCanonicalExpansionBound: true,
    queuedChildReservation: true,
    cumulativeBoundary: "T06→T07→T08→T09",
  });
}

async function verifyComponentPrerequisite(componentArtifactPath) {
  let verification;
  try {
    verification = await verifyProtocolComponentContracts({ artifactPath: componentArtifactPath });
  } catch (error) {
    fail("INTERACTION_PREREQUISITE_DRIFT", "M02-T08 prerequisite verification failed.", {
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  const bytes = await readFile(componentArtifactPath);
  const artifact = JSON.parse(bytes);
  if (
    artifact.task !== "M02-T08" ||
    artifact.profile !== "desen-component-contract-validation-v1" ||
    artifact.result !== "PASS" ||
    artifact.protocolVersion !== "0.1.0"
  ) {
    fail("INTERACTION_PREREQUISITE_DRIFT", "M02-T08 prerequisite metadata changed.");
  }
  return Object.freeze({
    task: artifact.task,
    profile: artifact.profile,
    result: artifact.result,
    verifiedBy: "verifyProtocolComponentContracts",
    sha256: sha256(bytes),
    verificationSha256: verification.artifactSha256,
  });
}

function node(id, use, props = undefined) {
  return { id, use, ...(props === undefined ? {} : { props }) };
}

function behaviorInstance(id, use = SORTABLE) {
  return { id, use };
}

function minimalSource(validSource, root) {
  const source = cloneJson(validSource);
  source.entry = "main";
  source.surfaces = { main: { id: "main", state: {}, resources: {}, root } };
  delete source.authoring;
  return source;
}

function sourceWithBehavior(
  validSource,
  instance,
  owner = node("layout", STACK, { direction: "vertical" }),
) {
  owner.behaviors = [instance];
  return minimalSource(validSource, owner);
}

function behaviorContract(catalog, capabilityId = SORTABLE) {
  return objectAt(catalog, ["behaviors", capabilityId]);
}

function addBehavior(catalog, id, { channels = [], compatibleWith = [], attachTo } = {}) {
  catalog.behaviors[id] = {
    propsSchema: { type: "object", additionalProperties: false },
    attachTo: attachTo ?? { categories: ["layout"] },
    composition: { exclusiveChannels: channels, compatibleWith },
  };
}

function commandSource(validSource, action) {
  const actor = node("actor", BUTTON, { label: "Run" });
  actor.on = { press: [action] };
  const target = node("field", TEXT_FIELD, { label: "Name", value: "" });
  const root = node("layout", STACK, { direction: "vertical" });
  root.slots = { default: [actor, target] };
  return minimalSource(validSource, root);
}

function nestedNotSchema(depth) {
  let schema = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

function nestedPayload(depth) {
  let value = null;
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

function wideObject(propertyCount) {
  return Object.fromEntries(
    Array.from({ length: propertyCount }, (_, index) => [`key${String(index)}`, null]),
  );
}

function reverseObjectMembers(value) {
  if (Array.isArray(value)) return value.map(reverseObjectMembers);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectMembers(child)]),
  );
}

async function loadFrozenFixtures() {
  const readConformance = (relativePath) => readJson(path.join(CONFORMANCE_ROOT, relativePath));
  const readExample = (file) => readJson(path.join(EXAMPLES_ROOT, file));
  const [
    validSource,
    validBundle,
    validCatalog,
    unknownCore,
    duplicateNode,
    unknownCapability,
    unknownEvent,
    revisionMismatch,
    digestMismatch,
    exampleCatalog,
    exampleSignInSource,
    exampleSignInBundle,
    sortableSource,
    storeMapSource,
  ] = await Promise.all([
    readConformance("valid/sign-in.source.json"),
    readConformance("valid/sign-in.bundle.json"),
    readConformance("valid/web.catalog.json"),
    readConformance("invalid/source-unknown-core-field.json"),
    readConformance("invalid/source-duplicate-node-id.json"),
    readConformance("invalid/source-unknown-capability.json"),
    readConformance("invalid/source-unknown-event.json"),
    readConformance("invalid/bundle-revision-mismatch.json"),
    readConformance("invalid/bundle-catalog-digest-mismatch.json"),
    readExample("catalog.web.example.json"),
    readExample("sign-in.source.desen.json"),
    readExample("sign-in.bundle.desen.json"),
    readExample("sortable-list.source.desen.json"),
    readExample("store-map.source.desen.json"),
  ]);
  return {
    validSource,
    validBundle,
    validCatalog,
    unknownCore,
    duplicateNode,
    unknownCapability,
    unknownEvent,
    revisionMismatch,
    digestMismatch,
    exampleCatalog,
    exampleSignInSource,
    exampleSignInBundle,
    sortableSource,
    storeMapSource,
  };
}

function createCatalogSet(api, catalogs, label) {
  const result = assertSuccess(api.validateDesenInteractionCatalogSet(catalogs), label);
  if (result.target !== "interaction-catalog-set") {
    fail("INTERACTION_PUBLIC_API_FAILURE", `${label} has the wrong target.`);
  }
  return result.value;
}

function validateSource(api, source, catalogs, label) {
  return api.validateDesenSourceInteractionContracts(
    source,
    createCatalogSet(api, catalogs, `${label} catalog set`),
  );
}

function validatePayload(api, payload, selector, catalogs, label) {
  return api.validateDesenEventPayload(
    payload,
    selector,
    createCatalogSet(api, catalogs, `${label} catalog set`),
  );
}

function withObjectPrototypeProperty(property, value, run) {
  const priorDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, property);
  Object.defineProperty(Object.prototype, property, { configurable: true, value });
  try {
    return run();
  } finally {
    if (priorDescriptor === undefined) Reflect.deleteProperty(Object.prototype, property);
    else Object.defineProperty(Object.prototype, property, priorDescriptor);
  }
}

async function verifyFrozenCorpus(api, fixtures) {
  const conformanceSet = createCatalogSet(api, [fixtures.validCatalog], "frozen Catalog");
  const exampleSet = createCatalogSet(api, [fixtures.exampleCatalog], "example Catalog");
  const validConformance = [
    { file: "valid/web.catalog.json", target: "catalog-set", valid: true },
    { file: "valid/sign-in.source.json", target: "source", valid: true },
    { file: "valid/sign-in.bundle.json", target: "bundle", valid: true },
  ];
  assertSuccess(
    api.validateDesenSourceInteractionContracts(fixtures.validSource, conformanceSet),
    "frozen valid Source",
  );
  assertSuccess(
    api.validateDesenBundleInteractionContracts(fixtures.validBundle, conformanceSet),
    "frozen valid Bundle",
  );
  const exampleCalls = [
    ["sign-in.source.desen.json", "source", fixtures.exampleSignInSource],
    ["sign-in.bundle.desen.json", "bundle", fixtures.exampleSignInBundle],
    ["sortable-list.source.desen.json", "source", fixtures.sortableSource],
    ["store-map.source.desen.json", "source", fixtures.storeMapSource],
  ];
  for (const [file, target, document] of exampleCalls) {
    const result =
      target === "source"
        ? api.validateDesenSourceInteractionContracts(document, exampleSet)
        : api.validateDesenBundleInteractionContracts(document, exampleSet);
    assertSuccess(result, `frozen example ${file}`);
  }
  const official = assertFailure(
    api.validateDesenSourceInteractionContracts(fixtures.unknownEvent, conformanceSet),
    [{ code: "UNKNOWN_EVENT", pointer: "/surfaces/home/root/slots/default/0/on/teleport" }],
    "official unknown-event vector",
  );
  const predecessorFailures = [
    {
      id: "unknown-core-field",
      source: fixtures.unknownCore,
      diagnostics: [{ code: "UNKNOWN_CORE_FIELD", pointer: "/script" }],
    },
    {
      id: "duplicate-node-id",
      source: fixtures.duplicateNode,
      diagnostics: [
        { code: "DUPLICATE_NODE_ID", pointer: "/surfaces/home/root/slots/default/1/id" },
      ],
    },
    {
      id: "unknown-capability",
      source: fixtures.unknownCapability,
      diagnostics: [
        { code: "UNKNOWN_CAPABILITY", pointer: "/surfaces/home/root/slots/default/0/use" },
      ],
    },
  ];
  for (const entry of predecessorFailures) {
    assertFailure(
      api.validateDesenSourceInteractionContracts(entry.source, conformanceSet),
      entry.diagnostics,
      `predecessor ${entry.id}`,
    );
  }
  assertSuccess(
    api.validateDesenBundleInteractionContracts(fixtures.revisionMismatch, conformanceSet),
    "revision T09 fence",
  );
  assertSuccess(
    api.validateDesenBundleInteractionContracts(fixtures.digestMismatch, conformanceSet),
    "catalog digest T09 fence",
  );
  return Object.freeze({
    validConformance: Object.freeze(validConformance),
    validExamples: Object.freeze(
      FROZEN_EXAMPLES.map((entry) => Object.freeze({ ...entry, valid: true })),
    ),
    officialT09Invalid: Object.freeze([
      Object.freeze({
        file: "invalid/source-unknown-event.json",
        target: "source",
        diagnostics: Object.freeze(diagnosticIdentity(official)),
      }),
    ]),
    predecessorFailures: Object.freeze(
      predecessorFailures.map(({ id, diagnostics }) => Object.freeze({ id, diagnostics })),
    ),
    laterIntegrityAccepted: Object.freeze([
      Object.freeze({ id: "bundle-revision", owner: "M06-T09/M07-T02", valid: true }),
      Object.freeze({ id: "catalog-digest", owner: "M07-T03", valid: true }),
    ]),
  });
}

function verifyBehaviorGoldens(api, fixtures) {
  const catalogs = [fixtures.validCatalog];
  const propUnknown = behaviorInstance("sort");
  propUnknown.props = { axis: "vertical", ghost: true };
  const unknownPropResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, propUnknown),
      catalogs,
      "unknown prop",
    ),
    [{ code: "UNKNOWN_PROP", pointer: "/surfaces/main/root/behaviors/0/props/ghost" }],
    "behavior unknown prop",
  );
  const propMismatch = behaviorInstance("sort");
  propMismatch.props = { axis: 42 };
  const mismatchResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, propMismatch),
      catalogs,
      "prop mismatch",
    ),
    [{ code: "PROP_TYPE_MISMATCH", pointer: "/surfaces/main/root/behaviors/0/props/axis" }],
    "behavior prop mismatch",
  );
  const propDynamic = behaviorInstance("sort");
  propDynamic.props = { axis: { $ref: "state.axis", fallback: "vertical" } };
  const dynamicResult = assertSuccess(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, propDynamic),
      catalogs,
      "dynamic behavior prop",
    ),
    "dynamic behavior prop",
  );
  const dynamicObligations = obligationIdentity(dynamicResult).filter(
    ({ kind }) => kind === "behavior-prop",
  );
  assertJsonEqual(
    dynamicObligations.map(({ kind, pointer }) => ({ kind, pointer })),
    [
      {
        kind: "behavior-prop",
        pointer: "/surfaces/main/root/behaviors/0/props/axis",
      },
    ],
    "behavior prop obligation",
  );

  const styleCatalog = cloneJson(fixtures.validCatalog);
  writePath(
    styleCatalog,
    ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"],
    {
      type: "object",
      additionalProperties: false,
      properties: { color: { type: "string" } },
    },
  );
  const styleMismatch = behaviorInstance("sort");
  styleMismatch.style = { base: { dropIndicator: { color: 42 } } };
  const styleMismatchResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, styleMismatch),
      [styleCatalog],
      "behavior style mismatch",
    ),
    [
      {
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/main/root/behaviors/0/style/base/dropIndicator/color",
      },
    ],
    "behavior style mismatch",
  );
  const styleDynamic = behaviorInstance("sort");
  styleDynamic.style = {
    base: { dropIndicator: { color: { $token: "color.drag.indicator" } } },
  };
  const styleDynamicResult = assertSuccess(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, styleDynamic),
      [styleCatalog],
      "dynamic behavior style",
    ),
    "dynamic behavior style",
  );
  const styleObligations = obligationIdentity(styleDynamicResult).filter(
    ({ kind }) => kind === "behavior-style-part-property",
  );
  assertJsonEqual(
    styleObligations.map(({ kind, pointer }) => ({ kind, pointer })),
    [
      {
        kind: "behavior-style-part-property",
        pointer: "/surfaces/main/root/behaviors/0/style/base/dropIndicator/color",
      },
    ],
    "behavior style obligation",
  );
  const unknownState = behaviorInstance("sort");
  unknownState.style = { ghost: { dropIndicator: { color: "red" } } };
  const unknownStateResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, unknownState),
      [styleCatalog],
      "unknown behavior visual state",
    ),
    [{ code: "UNKNOWN_PROP", pointer: "/surfaces/main/root/behaviors/0/style/ghost" }],
    "unknown behavior visual state",
  );
  const unknownPart = behaviorInstance("sort");
  unknownPart.style = { base: { privatePart: {} } };
  const unknownPartResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, unknownPart),
      [styleCatalog],
      "unknown behavior style part",
    ),
    [
      {
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/main/root/behaviors/0/style/base/privatePart",
      },
    ],
    "unknown behavior style part",
  );
  const inheritedPart = behaviorInstance("sort");
  inheritedPart.style = { base: { toString: {} } };
  const inheritedPartResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, inheritedPart),
      [styleCatalog],
      "inherited behavior style part",
    ),
    [
      {
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/main/root/behaviors/0/style/base/toString",
      },
    ],
    "inherited behavior style part",
  );

  const unknownSlot = behaviorInstance("sort");
  unknownSlot.slots = { ghost: [] };
  const unknownSlotResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, unknownSlot),
      catalogs,
      "unknown behavior slot",
    ),
    [{ code: "UNKNOWN_SLOT", pointer: "/surfaces/main/root/behaviors/0/slots/ghost" }],
    "behavior unknown slot",
  );
  const inheritedSlot = behaviorInstance("sort");
  inheritedSlot.slots = { toString: [] };
  const inheritedSlotResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, inheritedSlot),
      catalogs,
      "inherited behavior slot",
    ),
    [{ code: "UNKNOWN_SLOT", pointer: "/surfaces/main/root/behaviors/0/slots/toString" }],
    "inherited behavior slot",
  );
  const cardinalityCatalog = cloneJson(fixtures.validCatalog);
  const cardinalitySlot = objectAt(cardinalityCatalog, [
    "behaviors",
    SORTABLE,
    "slots",
    "dragPreview",
  ]);
  cardinalitySlot.required = true;
  cardinalitySlot.minItems = 1;
  cardinalitySlot.maxItems = 1;
  const requiredSlotResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, behaviorInstance("sort")),
      [cardinalityCatalog],
      "required behavior slot",
    ),
    [
      {
        code: "SLOT_CARDINALITY",
        pointer: "/surfaces/main/root/behaviors/0/slots/dragPreview",
      },
    ],
    "required behavior slot",
  );
  const minimumSlot = behaviorInstance("sort");
  minimumSlot.slots = { dragPreview: [] };
  const minimumSlotResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, minimumSlot),
      [cardinalityCatalog],
      "minimum behavior slot",
    ),
    [
      {
        code: "SLOT_CARDINALITY",
        pointer: "/surfaces/main/root/behaviors/0/slots/dragPreview",
      },
    ],
    "minimum behavior slot",
  );
  const maximumSlot = behaviorInstance("sort");
  maximumSlot.slots = {
    dragPreview: [
      node("preview-one", TEXT, { text: "One" }),
      node("preview-two", TEXT, { text: "Two" }),
    ],
  };
  const maximumSlotResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, maximumSlot),
      [cardinalityCatalog],
      "maximum behavior slot",
    ),
    [
      {
        code: "SLOT_CARDINALITY",
        pointer: "/surfaces/main/root/behaviors/0/slots/dragPreview",
      },
    ],
    "maximum behavior slot",
  );
  const rejectedChild = behaviorInstance("sort");
  rejectedChild.slots = { dragPreview: [node("preview", BUTTON, { label: "Preview" })] };
  const rejectedChildResult = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, rejectedChild),
      catalogs,
      "behavior slot child",
    ),
    [
      {
        code: "SLOT_CHILD_REJECTED",
        pointer: "/surfaces/main/root/behaviors/0/slots/dragPreview/0/use",
      },
    ],
    "behavior slot child",
  );
  const impossibleCatalog = cloneJson(fixtures.validCatalog);
  const impossibleSlot = objectAt(impossibleCatalog, [
    "behaviors",
    SORTABLE,
    "slots",
    "dragPreview",
  ]);
  impossibleSlot.required = true;
  delete impossibleSlot.minItems;
  impossibleSlot.maxItems = 0;
  const impossibleResult = assertFailure(
    api.validateDesenInteractionCatalogSet([impossibleCatalog]),
    [
      {
        code: INVALID_INTERACTION_CONTRACT,
        pointer: "/0/behaviors/com.example.interactions~1Sortable/slots/dragPreview",
      },
    ],
    "impossible behavior slot contract",
  );
  return Object.freeze({
    props: Object.freeze([
      Object.freeze({ id: "unknown", diagnostics: diagnosticIdentity(unknownPropResult) }),
      Object.freeze({ id: "mismatch", diagnostics: diagnosticIdentity(mismatchResult) }),
      Object.freeze({ id: "dynamic", valid: true, obligations: dynamicObligations }),
    ]),
    styles: Object.freeze([
      Object.freeze({ id: "mismatch", diagnostics: diagnosticIdentity(styleMismatchResult) }),
      Object.freeze({ id: "dynamic", valid: true, obligations: styleObligations }),
      Object.freeze({ id: "unknown-state", diagnostics: diagnosticIdentity(unknownStateResult) }),
      Object.freeze({ id: "unknown-part", diagnostics: diagnosticIdentity(unknownPartResult) }),
      Object.freeze({
        id: "inherited-part",
        diagnostics: diagnosticIdentity(inheritedPartResult),
      }),
    ]),
    slots: Object.freeze([
      Object.freeze({ id: "unknown", diagnostics: diagnosticIdentity(unknownSlotResult) }),
      Object.freeze({ id: "inherited", diagnostics: diagnosticIdentity(inheritedSlotResult) }),
      Object.freeze({ id: "required", diagnostics: diagnosticIdentity(requiredSlotResult) }),
      Object.freeze({ id: "minimum", diagnostics: diagnosticIdentity(minimumSlotResult) }),
      Object.freeze({ id: "maximum", diagnostics: diagnosticIdentity(maximumSlotResult) }),
      Object.freeze({ id: "rejected-child", diagnostics: diagnosticIdentity(rejectedChildResult) }),
      Object.freeze({ id: "impossible-range", diagnostics: diagnosticIdentity(impossibleResult) }),
    ]),
  });
}

function verifyAttachmentGoldens(api, fixtures) {
  const cases = [];
  for (const [id, attachTo] of [
    ["exact-capability", { capabilities: [STACK] }],
    ["exact-category", { categories: ["layout"] }],
    ["or-union", { capabilities: [BUTTON], categories: ["layout"] }],
  ]) {
    const catalog = cloneJson(fixtures.validCatalog);
    behaviorContract(catalog).attachTo = attachTo;
    assertSuccess(
      validateSource(
        api,
        sourceWithBehavior(fixtures.validSource, behaviorInstance("sort")),
        [catalog],
        `attachment ${id}`,
      ),
      `attachment ${id}`,
    );
    cases.push(Object.freeze({ id, valid: true }));
  }
  for (const [id, attachTo] of [
    ["wrong-category", { categories: ["action"] }],
    ["case-mismatched-capability", { capabilities: ["com.example.ui/stack"] }],
    ["present-empty-union", { capabilities: [] }],
  ]) {
    const catalog = cloneJson(fixtures.validCatalog);
    behaviorContract(catalog).attachTo = attachTo;
    const result = assertFailure(
      validateSource(
        api,
        sourceWithBehavior(fixtures.validSource, behaviorInstance("sort")),
        [catalog],
        `attachment ${id}`,
      ),
      [{ code: "BEHAVIOR_ATTACHMENT_INVALID", pointer: "/surfaces/main/root/behaviors/0/use" }],
      `attachment ${id}`,
    );
    cases.push(Object.freeze({ id, diagnostics: diagnosticIdentity(result) }));
  }
  return Object.freeze(cases);
}

function verifyBehaviorIdentityGolden(api, fixtures) {
  const result = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, behaviorInstance("layout")),
      [fixtures.validCatalog],
      "node and behavior identity collision",
    ),
    [{ code: "DUPLICATE_NODE_ID", pointer: "/surfaces/main/root/behaviors/0/id" }],
    "node and behavior identity collision",
  );
  return Object.freeze({
    id: "node-behavior-id-collision",
    proseRule: "R-069",
    diagnostics: Object.freeze(diagnosticIdentity(result)),
  });
}

function conflictSource(validSource, ...ids) {
  const root = node("layout", STACK, { direction: "vertical" });
  root.behaviors = ids.map((use, index) => behaviorInstance(`behavior-${String(index + 1)}`, use));
  return minimalSource(validSource, root);
}

function verifyConflictGoldens(api, fixtures) {
  const first = "com.example.interactions/First";
  const second = "com.example.interactions/Second";
  const third = "com.example.interactions/Third";
  const disjointCatalog = cloneJson(fixtures.validCatalog);
  addBehavior(disjointCatalog, first, { channels: ["pointer-drag"] });
  addBehavior(disjointCatalog, second, { channels: ["keyboard-focus"] });
  assertSuccess(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, second),
      [disjointCatalog],
      "disjoint behavior channels",
    ),
    "disjoint behavior channels",
  );

  const sharedCatalog = cloneJson(fixtures.validCatalog);
  addBehavior(sharedCatalog, first, { channels: ["pointer-drag"] });
  addBehavior(sharedCatalog, second, { channels: ["pointer-drag"] });
  const shared = assertFailure(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, second),
      [sharedCatalog],
      "shared behavior channel",
    ),
    [{ code: "BEHAVIOR_CONFLICT", pointer: "/surfaces/main/root/behaviors/1/use" }],
    "shared behavior channel",
  );

  const unilateralCatalog = cloneJson(sharedCatalog);
  writePath(unilateralCatalog, ["behaviors", first, "composition", "compatibleWith"], [second]);
  const unilateral = assertFailure(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, second),
      [unilateralCatalog],
      "unilateral compatibility",
    ),
    [{ code: "BEHAVIOR_CONFLICT", pointer: "/surfaces/main/root/behaviors/1/use" }],
    "unilateral compatibility",
  );

  const mutualCatalog = cloneJson(unilateralCatalog);
  writePath(mutualCatalog, ["behaviors", second, "composition", "compatibleWith"], [first]);
  assertSuccess(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, second),
      [mutualCatalog],
      "mutual compatibility",
    ),
    "mutual compatibility",
  );

  const selfCatalog = cloneJson(fixtures.validCatalog);
  addBehavior(selfCatalog, first, { channels: ["pointer-drag"] });
  const selfUnlisted = assertFailure(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, first),
      [selfCatalog],
      "unlisted self compatibility",
    ),
    [{ code: "BEHAVIOR_CONFLICT", pointer: "/surfaces/main/root/behaviors/1/use" }],
    "unlisted self compatibility",
  );
  writePath(selfCatalog, ["behaviors", first, "composition", "compatibleWith"], [first]);
  assertSuccess(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, first),
      [selfCatalog],
      "explicit self compatibility",
    ),
    "explicit self compatibility",
  );

  const graphCatalog = cloneJson(fixtures.validCatalog);
  addBehavior(graphCatalog, first, {
    channels: ["pointer-drag"],
    compatibleWith: [second],
  });
  addBehavior(graphCatalog, second, {
    channels: ["pointer-drag"],
    compatibleWith: [first, third],
  });
  addBehavior(graphCatalog, third, {
    channels: ["pointer-drag"],
    compatibleWith: [second],
  });
  const graph = assertFailure(
    validateSource(
      api,
      conflictSource(fixtures.validSource, first, second, third),
      [graphCatalog],
      "three behavior graph",
    ),
    [{ code: "BEHAVIOR_CONFLICT", pointer: "/surfaces/main/root/behaviors/2/use" }],
    "three behavior graph",
  );
  return Object.freeze([
    Object.freeze({ id: "disjoint", valid: true }),
    Object.freeze({ id: "shared", diagnostics: diagnosticIdentity(shared) }),
    Object.freeze({ id: "unilateral", diagnostics: diagnosticIdentity(unilateral) }),
    Object.freeze({ id: "mutual", valid: true }),
    Object.freeze({ id: "self-unlisted", diagnostics: diagnosticIdentity(selfUnlisted) }),
    Object.freeze({ id: "self-listed", valid: true }),
    Object.freeze({ id: "three-node-missing-edge", diagnostics: diagnosticIdentity(graph) }),
  ]);
}

function verifyEventAndCommandGoldens(api, fixtures) {
  const component = node("field", TEXT_FIELD, { label: "Name", value: "" });
  component.on = { Change: [] };
  const unknownComponentEvent = assertFailure(
    validateSource(
      api,
      minimalSource(fixtures.validSource, component),
      [fixtures.validCatalog],
      "component event case",
    ),
    [{ code: "UNKNOWN_EVENT", pointer: "/surfaces/main/root/on/Change" }],
    "component event case",
  );
  const inheritedComponent = node("field", TEXT_FIELD, { label: "Name", value: "" });
  inheritedComponent.on = { toString: [] };
  const inheritedComponentEvent = assertFailure(
    validateSource(
      api,
      minimalSource(fixtures.validSource, inheritedComponent),
      [fixtures.validCatalog],
      "inherited component event",
    ),
    [{ code: "UNKNOWN_EVENT", pointer: "/surfaces/main/root/on/toString" }],
    "inherited component event",
  );
  const behavior = behaviorInstance("sort");
  behavior.on = { teleport: [] };
  const unknownBehaviorEvent = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, behavior),
      [fixtures.validCatalog],
      "unknown behavior event",
    ),
    [
      {
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/main/root/behaviors/0/on/teleport",
      },
    ],
    "unknown behavior event",
  );
  const inheritedBehavior = behaviorInstance("sort");
  inheritedBehavior.on = { toString: [] };
  const inheritedBehaviorEvent = assertFailure(
    validateSource(
      api,
      sourceWithBehavior(fixtures.validSource, inheritedBehavior),
      [fixtures.validCatalog],
      "inherited behavior event",
    ),
    [
      {
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/main/root/behaviors/0/on/toString",
      },
    ],
    "inherited behavior event",
  );
  const inheritedEventMap = withObjectPrototypeProperty(
    "events",
    { ghost: { payloadSchema: {} } },
    () => {
      const owner = node("layout", STACK, { direction: "vertical" });
      owner.on = { ghost: [] };
      const documentResult = assertFailure(
        validateSource(
          api,
          minimalSource(fixtures.validSource, owner),
          [fixtures.validCatalog],
          "inherited capability event map document",
        ),
        [{ code: "UNKNOWN_EVENT", pointer: "/surfaces/main/root/on/ghost" }],
        "inherited capability event map document",
      );
      const payloadResult = assertFailure(
        validatePayload(
          api,
          {},
          { capabilityKind: "component", capabilityId: STACK, eventName: "ghost" },
          [fixtures.validCatalog],
          "inherited capability event map payload",
        ),
        [{ code: "UNKNOWN_EVENT", pointer: "" }],
        "inherited capability event map payload",
      );
      return Object.freeze({ documentResult, payloadResult });
    },
  );
  const knownCommand = commandSource(fixtures.validSource, {
    type: "component.command",
    target: "field",
    command: "focus",
    input: {},
  });
  assertSuccess(
    validateSource(api, knownCommand, [fixtures.validCatalog], "known command"),
    "known command",
  );
  const unknownCommand = commandSource(fixtures.validSource, {
    type: "component.command",
    target: "field",
    command: "teleport",
    input: {},
  });
  const unknownCommandResult = assertFailure(
    validateSource(api, unknownCommand, [fixtures.validCatalog], "unknown known-target command"),
    [
      {
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/main/root/slots/default/0/on/press/0/command",
      },
    ],
    "unknown known-target command",
  );
  const inheritedCommand = commandSource(fixtures.validSource, {
    type: "component.command",
    target: "field",
    command: "toString",
    input: {},
  });
  const inheritedCommandResult = assertFailure(
    validateSource(
      api,
      inheritedCommand,
      [fixtures.validCatalog],
      "inherited known-target command",
    ),
    [
      {
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/main/root/slots/default/0/on/press/0/command",
      },
    ],
    "inherited known-target command",
  );
  const inheritedCommandMapResult = withObjectPrototypeProperty(
    "commands",
    { ghost: { inputSchema: {} } },
    () =>
      assertFailure(
        validateSource(
          api,
          commandSource(fixtures.validSource, {
            type: "component.command",
            target: "layout",
            command: "ghost",
            input: {},
          }),
          [fixtures.validCatalog],
          "inherited capability command map",
        ),
        [
          {
            code: "UNKNOWN_COMMAND",
            pointer: "/surfaces/main/root/slots/default/0/on/press/0/command",
          },
        ],
        "inherited capability command map",
      ),
  );
  return Object.freeze({
    events: Object.freeze([
      Object.freeze({
        id: "component-case-sensitive",
        diagnostics: diagnosticIdentity(unknownComponentEvent),
      }),
      Object.freeze({
        id: "component-inherited-name",
        diagnostics: diagnosticIdentity(inheritedComponentEvent),
      }),
      Object.freeze({
        id: "behavior-unknown",
        diagnostics: diagnosticIdentity(unknownBehaviorEvent),
      }),
      Object.freeze({
        id: "behavior-inherited-name",
        diagnostics: diagnosticIdentity(inheritedBehaviorEvent),
      }),
      Object.freeze({
        id: "component-inherited-map-document",
        diagnostics: diagnosticIdentity(inheritedEventMap.documentResult),
      }),
      Object.freeze({
        id: "component-inherited-map-payload",
        diagnostics: diagnosticIdentity(inheritedEventMap.payloadResult),
      }),
    ]),
    commands: Object.freeze([
      Object.freeze({ id: "known-target-declared", valid: true }),
      Object.freeze({
        id: "known-target-unknown",
        diagnostics: diagnosticIdentity(unknownCommandResult),
      }),
      Object.freeze({
        id: "known-target-inherited-name",
        diagnostics: diagnosticIdentity(inheritedCommandResult),
      }),
      Object.freeze({
        id: "known-target-inherited-map",
        diagnostics: diagnosticIdentity(inheritedCommandMapResult),
      }),
    ]),
  });
}

function verifyPayloadGoldens(api, fixtures) {
  const componentSelector = {
    capabilityKind: "component",
    capabilityId: TEXT_FIELD,
    eventName: "change",
  };
  const behaviorSelector = {
    capabilityKind: "behavior",
    capabilityId: SORTABLE,
    eventName: "reorder",
  };
  const componentPayload = { value: "Selman" };
  const componentValid = assertSuccess(
    validatePayload(
      api,
      componentPayload,
      componentSelector,
      [fixtures.validCatalog],
      "component payload",
    ),
    "component payload",
  );
  if (componentValid.value === componentPayload) {
    fail("INTERACTION_PAYLOAD_BOUNDARY_WEAKENED", "Validated payload aliases caller data.");
  }
  componentPayload.value = "changed-after-validation";
  assertJsonEqual(
    componentValid.value,
    { value: "Selman" },
    "detached event payload snapshot",
    "INTERACTION_PAYLOAD_BOUNDARY_WEAKENED",
  );
  const componentInvalid = assertFailure(
    validatePayload(
      api,
      { value: 42 },
      componentSelector,
      [fixtures.validCatalog],
      "component payload mismatch",
    ),
    [{ code: "EVENT_PAYLOAD_INVALID", pointer: "/value" }],
    "component payload mismatch",
  );
  const behaviorValid = assertSuccess(
    validatePayload(
      api,
      { fromIndex: 0, toIndex: 1, itemKey: "task-1" },
      behaviorSelector,
      [fixtures.validCatalog],
      "behavior payload",
    ),
    "behavior payload",
  );
  const behaviorInvalid = assertFailure(
    validatePayload(
      api,
      { fromIndex: 0, toIndex: -1, itemKey: "task-1" },
      behaviorSelector,
      [fixtures.validCatalog],
      "behavior payload mismatch",
    ),
    [{ code: "EVENT_PAYLOAD_INVALID", pointer: "/toIndex" }],
    "behavior payload mismatch",
  );

  const refCatalog = cloneJson(fixtures.validCatalog);
  writePath(refCatalog, ["components", TEXT_FIELD, "events", "change", "payloadSchema"], {
    type: "object",
    additionalProperties: false,
    required: ["$ref"],
    properties: { $ref: { type: "number" } },
  });
  const refLiteral = assertFailure(
    validatePayload(
      api,
      { $ref: "must-remain-data" },
      componentSelector,
      [refCatalog],
      "payload $ref literal",
    ),
    [{ code: "EVENT_PAYLOAD_INVALID", pointer: "/$ref" }],
    "payload $ref literal",
  );
  const unknown = assertFailure(
    validatePayload(
      api,
      {},
      { ...componentSelector, eventName: "missing" },
      [fixtures.validCatalog],
      "unknown payload event",
    ),
    [{ code: "UNKNOWN_EVENT", pointer: "" }],
    "unknown payload event",
  );
  return Object.freeze({
    component: Object.freeze({
      valid: componentValid.valid,
      invalid: Object.freeze(diagnosticIdentity(componentInvalid)),
    }),
    behavior: Object.freeze({
      valid: behaviorValid.valid,
      invalid: Object.freeze(diagnosticIdentity(behaviorInvalid)),
    }),
    valueSpecShapedRefIsLiteral: Object.freeze(diagnosticIdentity(refLiteral)),
    unknownEvent: Object.freeze(diagnosticIdentity(unknown)),
  });
}

function verifyPayloadSafetyGoldens(api, fixtures) {
  const catalog = cloneJson(fixtures.validCatalog);
  writePath(catalog, ["components", TEXT_FIELD, "events", "change", "payloadSchema"], {});
  const selector = {
    capabilityKind: "component",
    capabilityId: TEXT_FIELD,
    eventName: "change",
  };
  const accepted = [
    ["maximum-depth", nestedPayload(EXPECTED_PAYLOAD_LIMITS.maxDepth)],
    [
      "maximum-json-nodes",
      Array.from({ length: EXPECTED_PAYLOAD_LIMITS.maxJsonNodes - 1 }, () => null),
    ],
    ["maximum-string-code-units", "a".repeat(EXPECTED_PAYLOAD_LIMITS.maxStringCodeUnits)],
    ["maximum-json-object-nodes", wideObject(EXPECTED_PAYLOAD_LIMITS.maxJsonNodes - 1)],
  ];
  const rejected = [
    ["above-maximum-depth", nestedPayload(EXPECTED_PAYLOAD_LIMITS.maxDepth + 1)],
    [
      "above-maximum-json-nodes",
      Array.from({ length: EXPECTED_PAYLOAD_LIMITS.maxJsonNodes }, () => null),
    ],
    ["above-maximum-string-code-units", "a".repeat(EXPECTED_PAYLOAD_LIMITS.maxStringCodeUnits + 1)],
    ["above-maximum-json-object-nodes", wideObject(EXPECTED_PAYLOAD_LIMITS.maxJsonNodes)],
  ];
  const acceptedEvidence = accepted.map(([id, payload]) => {
    assertSuccess(
      validatePayload(api, payload, selector, [catalog], `payload safety ${id}`),
      `payload safety ${id}`,
    );
    return Object.freeze({ id, valid: true });
  });
  const rejectedEvidence = rejected.map(([id, payload]) => {
    const result = assertFailure(
      validatePayload(api, payload, selector, [catalog], `payload safety ${id}`),
      [{ code: "EVENT_PAYLOAD_INVALID", pointer: "" }],
      `payload safety ${id}`,
    );
    return Object.freeze({ id, diagnostics: diagnosticIdentity(result) });
  });
  let sharedContainerDag = null;
  let ownKeyInspections = 0;
  for (let level = 0; level < 30; level += 1) {
    const shared = [sharedContainerDag, sharedContainerDag];
    sharedContainerDag = new Proxy(shared, {
      ownKeys(target) {
        ownKeyInspections += 1;
        if (ownKeyInspections >= EXPECTED_PAYLOAD_LIMITS.maxJsonNodes) {
          throw new Error("Shared-container traversal exceeded its proof bound.");
        }
        return Reflect.ownKeys(target);
      },
    });
  }
  const sharedContainerResult = assertFailure(
    validatePayload(
      api,
      sharedContainerDag,
      selector,
      [catalog],
      "payload safety shared-container DAG",
    ),
    [{ code: "EVENT_PAYLOAD_INVALID", pointer: "" }],
    "payload safety shared-container DAG",
  );
  if (ownKeyInspections >= EXPECTED_PAYLOAD_LIMITS.maxJsonNodes) {
    fail(
      "INTERACTION_PAYLOAD_BOUNDARY_WEAKENED",
      "Shared-container expansion was not bounded before canonical serialization.",
      { ownKeyInspections },
    );
  }
  rejectedEvidence.push(
    Object.freeze({
      id: "shared-container-dag-before-canonicalization",
      diagnostics: diagnosticIdentity(sharedContainerResult),
      ownKeyInspections,
      traversalBound: EXPECTED_PAYLOAD_LIMITS.maxJsonNodes,
    }),
  );
  let nestedWidePayload = null;
  let descriptorInspections = 0;
  for (let level = 0; level < EXPECTED_PAYLOAD_LIMITS.maxDepth; level += 1) {
    const values = Array.from({ length: 1_000 }, () => null);
    values[0] = nestedWidePayload;
    nestedWidePayload = new Proxy(values, {
      getOwnPropertyDescriptor(target, property) {
        descriptorInspections += 1;
        if (descriptorInspections >= 10_000) {
          throw new Error("Queued payload work exceeded its proof bound.");
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
  }
  const nestedWideResult = assertFailure(
    validatePayload(
      api,
      nestedWidePayload,
      selector,
      [catalog],
      "payload safety nested-wide frontier",
    ),
    [{ code: "EVENT_PAYLOAD_INVALID", pointer: "" }],
    "payload safety nested-wide frontier",
  );
  if (descriptorInspections >= 5_000) {
    fail(
      "INTERACTION_PAYLOAD_BOUNDARY_WEAKENED",
      "Nested-wide payload work was not reserved inside the public node budget.",
      { descriptorInspections },
    );
  }
  rejectedEvidence.push(
    Object.freeze({
      id: "nested-wide-frontier-reservation",
      diagnostics: diagnosticIdentity(nestedWideResult),
      descriptorInspections,
      inspectionBound: 5_000,
    }),
  );
  return Object.freeze({
    limits: EXPECTED_PAYLOAD_LIMITS,
    accepted: Object.freeze(acceptedEvidence),
    rejected: Object.freeze(rejectedEvidence),
  });
}

function verifySchemaSafetyGoldens(api, fixtures) {
  const acceptedDepthCatalog = cloneJson(fixtures.validCatalog);
  behaviorContract(acceptedDepthCatalog).propsSchema = nestedNotSchema(128);
  assertSuccess(
    api.validateDesenInteractionCatalogSet([acceptedDepthCatalog]),
    "maximum interaction schema depth",
  );
  const rejectedDepthCatalog = cloneJson(fixtures.validCatalog);
  behaviorContract(rejectedDepthCatalog).propsSchema = nestedNotSchema(129);
  const rejectedDepth = assertFailure(
    api.validateDesenInteractionCatalogSet([rejectedDepthCatalog]),
    [
      {
        code: INVALID_INTERACTION_CONTRACT,
        pointer: "/0/behaviors/com.example.interactions~1Sortable/propsSchema",
      },
    ],
    "above maximum interaction schema depth",
  );

  const unsafeCases = [
    {
      id: "component-event",
      path: ["components", TEXT_FIELD, "events", "change", "payloadSchema"],
      pointer:
        "/0/components/com.example.ui~1TextField/events/change/payloadSchema/properties/value/pattern",
    },
    {
      id: "component-command",
      path: ["components", TEXT_FIELD, "commands", "focus", "inputSchema"],
      pointer:
        "/0/components/com.example.ui~1TextField/commands/focus/inputSchema/properties/value/pattern",
    },
    {
      id: "behavior-props",
      path: ["behaviors", SORTABLE, "propsSchema"],
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/propsSchema/properties/value/pattern",
    },
    {
      id: "behavior-event",
      path: ["behaviors", SORTABLE, "events", "reorder", "payloadSchema"],
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/events/reorder/payloadSchema/properties/value/pattern",
    },
    {
      id: "behavior-command",
      path: ["behaviors", SORTABLE, "commands", "probe", "inputSchema"],
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/commands/probe/inputSchema/properties/value/pattern",
    },
    {
      id: "behavior-style",
      path: ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"],
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/styleParts/dropIndicator/propertiesSchema/properties/value/pattern",
    },
  ];
  const rejected = unsafeCases.map(({ id, path: schemaPath, pointer }) => {
    const catalog = cloneJson(fixtures.validCatalog);
    if (id === "behavior-command")
      behaviorContract(catalog).commands = { probe: { inputSchema: {} } };
    writePath(catalog, schemaPath, {
      type: "object",
      properties: { value: { type: "string", pattern: "^(a+)+$" } },
    });
    const result = assertFailure(
      api.validateDesenInteractionCatalogSet([catalog]),
      [{ code: INVALID_INTERACTION_CONTRACT, pointer }],
      `unsafe ${id} schema`,
    );
    return Object.freeze({ id, diagnostics: diagnosticIdentity(result) });
  });
  return Object.freeze({
    accepted: Object.freeze([{ id: "maximum-schema-depth", boundary: 128, valid: true }]),
    rejected: Object.freeze([
      Object.freeze({
        id: "above-maximum-schema-depth",
        boundary: 129,
        diagnostics: diagnosticIdentity(rejectedDepth),
      }),
      ...rejected,
    ]),
  });
}

function verifyLaterTaskFences(api, fixtures) {
  const eventReference = cloneJson(fixtures.validSource);
  writePath(
    eventReference,
    ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change", 0, "value", "$ref"],
    "event.missing",
  );
  assertSuccess(
    validateSource(api, eventReference, [fixtures.validCatalog], "event reference T10 fence"),
    "event reference T10 fence",
  );
  const missingTarget = commandSource(fixtures.validSource, {
    type: "component.command",
    target: "missing",
    command: "teleport",
    input: { arbitrary: true },
  });
  assertSuccess(
    validateSource(api, missingTarget, [fixtures.validCatalog], "command target T11 fence"),
    "command target T11 fence",
  );
  const invalidInput = commandSource(fixtures.validSource, {
    type: "component.command",
    target: "field",
    command: "focus",
    input: { unexpected: true },
  });
  assertSuccess(
    validateSource(api, invalidInput, [fixtures.validCatalog], "command input T11 fence"),
    "command input T11 fence",
  );
  const navigation = cloneJson(fixtures.validSource);
  writePath(
    navigation,
    [
      "surfaces",
      "sign-in",
      "root",
      "slots",
      "default",
      4,
      "on",
      "press",
      0,
      "onSuccess",
      0,
      "surface",
    ],
    "missing-surface",
  );
  assertSuccess(
    validateSource(api, navigation, [fixtures.validCatalog], "navigation T11 fence"),
    "navigation T11 fence",
  );
  return Object.freeze([
    Object.freeze({ id: "event-reference-path", owner: "M02-T10", valid: true }),
    Object.freeze({ id: "component-command-target", owner: "M02-T11", valid: true }),
    Object.freeze({ id: "component-command-input", owner: "M02-T11", valid: true }),
    Object.freeze({ id: "navigation-target", owner: "M02-T11", valid: true }),
  ]);
}

function verifyDeterminism(api, fixtures) {
  const source = sourceWithBehavior(fixtures.validSource, {
    id: "sort",
    use: SORTABLE,
    props: { ghost: true, axis: { $ref: "state.axis", fallback: "vertical" }, handle: 42 },
    on: { teleport: [] },
  });
  const first = validateSource(api, source, [fixtures.validCatalog], "determinism first");
  const second = validateSource(
    api,
    reverseObjectMembers(source),
    [reverseObjectMembers(fixtures.validCatalog)],
    "determinism permuted",
  );
  assertJsonEqual(first.diagnostics, second.diagnostics, "object-order diagnostics");
  assertJsonEqual(first.obligations, second.obligations, "object-order obligations");
  const set = createCatalogSet(api, [fixtures.validCatalog], "dispatcher parity");
  const sourceGeneric = api.validateDesenInteractionContracts("source", fixtures.validSource, set);
  const sourceSpecialized = api.validateDesenSourceInteractionContracts(fixtures.validSource, set);
  assertJsonEqual(
    sourceGeneric,
    sourceSpecialized,
    "Source dispatcher parity",
    "INTERACTION_DISPATCHER_DRIFT",
  );
  const bundleGeneric = api.validateDesenInteractionContracts("bundle", fixtures.validBundle, set);
  const bundleSpecialized = api.validateDesenBundleInteractionContracts(fixtures.validBundle, set);
  assertJsonEqual(
    bundleGeneric,
    bundleSpecialized,
    "Bundle dispatcher parity",
    "INTERACTION_DISPATCHER_DRIFT",
  );
  return Object.freeze({
    objectPermutation: "all object members recursively reversed; array order preserved",
    diagnosticsEqual: true,
    obligationsEqual: true,
    dispatcherTargets: Object.freeze(["source", "bundle"]),
  });
}

function verifyHostilePayloadBoundary(api, fixtures) {
  const selector = {
    capabilityKind: "component",
    capabilityId: TEXT_FIELD,
    eventName: "change",
  };
  let getterInvocations = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "secret";
    },
  });
  const cyclic = { value: "x" };
  cyclic.self = cyclic;
  const customPrototype = Object.create({ inherited: true });
  customPrototype.value = "x";
  for (const [id, payload] of [
    ["accessor", accessor],
    ["cycle", cyclic],
    ["custom-prototype", customPrototype],
    ["non-finite", { value: Number.NaN }],
  ]) {
    const result = validatePayload(
      api,
      payload,
      selector,
      [fixtures.validCatalog],
      `hostile ${id}`,
    );
    if (result.valid || !result.diagnostics.some(({ code }) => code === "EVENT_PAYLOAD_INVALID")) {
      fail("INTERACTION_PAYLOAD_BOUNDARY_WEAKENED", `Hostile payload ${id} was not contained.`);
    }
    assertPortableFrozen(result, `hostile payload ${id}`);
  }
  if (getterInvocations !== 0) {
    fail("INTERACTION_PAYLOAD_BOUNDARY_WEAKENED", "Payload accessor was invoked.", {
      getterInvocations,
    });
  }
  return Object.freeze({
    detachedSnapshot: true,
    deepFrozen: true,
    getterInvocations,
    cycleRejected: true,
    customPrototypeRejected: true,
    nonFiniteRejected: true,
  });
}

async function walkFiles(root) {
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        fail(
          "INTERACTION_DISTRIBUTION_DRIFT",
          `Symlink found in production inventory: ${filePath}`,
        );
      }
      if (entry.isDirectory()) pending.push(filePath);
      else if (entry.isFile()) files.push(filePath);
    }
  }
  return files.sort(compareText);
}

function relativeUnix(base, filePath) {
  return path.relative(base, filePath).split(path.sep).join("/");
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s*)["']([^"']+)["']/gu)].map(
    (match) => match[1],
  );
}

function auditRuntimeSource(source, label, allowedBare) {
  const forbidden = [
    ["runtime require", /\brequire\s*\(/u],
    ["eval", /\beval\s*\(/u],
    ["Function constructor", /\bFunction\s*\(/u],
    ["dynamic import", /\bimport\s*\(/u],
    ["network fetch", /\bfetch\s*\(/u],
    ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
    ["WebSocket", /\bWebSocket\b/u],
    ["frozen upstream access", /(?:^|["'`])[^\n"'`]*upstream\//u],
    [
      "workspace absolute path",
      new RegExp(WORKSPACE_ROOT.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    ],
  ];
  for (const [name, pattern] of forbidden) {
    if (pattern.test(source)) {
      fail("INTERACTION_PLATFORM_AUDIT_FAILED", `${label} contains ${name}.`);
    }
  }
  for (const specifier of importSpecifiers(source)) {
    if (specifier.startsWith(".") || allowedBare.includes(specifier)) continue;
    fail("INTERACTION_PLATFORM_AUDIT_FAILED", `${label} imports unapproved ${specifier}.`);
  }
}

async function packageInventory(packageName, allowedBare) {
  const packageRoot = path.join(WORKSPACE_ROOT, "packages", packageName);
  const sourceRoot = path.join(packageRoot, "src");
  const distributionRoot = path.join(packageRoot, "dist");
  const sourceFiles = (await walkFiles(sourceRoot)).filter((file) => file.endsWith(".ts"));
  const distributionFiles = await walkFiles(distributionRoot);
  const distributionNames = new Set(
    distributionFiles.map((file) => relativeUnix(distributionRoot, file)),
  );
  const expectedDistributionNames = new Set();
  for (const sourceFile of sourceFiles) {
    const stem = relativeUnix(sourceRoot, sourceFile).replace(/\.ts$/u, "");
    for (const expected of [`${stem}.js`, `${stem}.js.map`, `${stem}.d.ts`, `${stem}.d.ts.map`]) {
      expectedDistributionNames.add(expected);
      if (!distributionNames.has(expected)) {
        fail("INTERACTION_DISTRIBUTION_DRIFT", `${packageName} is missing ${expected}.`);
      }
    }
  }
  assertJsonEqual(
    [...distributionNames].sort(compareText),
    [...expectedDistributionNames].sort(compareText),
    `${packageName} source/distribution inventory`,
    "INTERACTION_DISTRIBUTION_DRIFT",
  );
  const audited = [
    ...sourceFiles,
    ...distributionFiles.filter((file) => file.endsWith(".js") || file.endsWith(".d.ts")),
  ];
  for (const file of audited) {
    auditRuntimeSource(
      await readFile(file, "utf8"),
      relativeUnix(WORKSPACE_ROOT, file),
      allowedBare,
    );
  }
  return Object.freeze({
    sourceFiles: Object.freeze(sourceFiles.map((file) => relativeUnix(sourceRoot, file))),
    distributionFiles: Object.freeze(
      distributionFiles.map((file) => relativeUnix(distributionRoot, file)),
    ),
    auditedFiles: audited.length,
    allowedImports: Object.freeze(["relative", ...allowedBare]),
  });
}

async function verifyPlatformAndDistributionAudit() {
  const validator = await packageInventory("validator", ["@desen/protocol"]);
  const protocol = await packageInventory("protocol", []);
  return Object.freeze({
    packages: Object.freeze({ validator, protocol }),
    runtimeSchemaCompilation: false,
    documentCodeExecution: false,
    remoteSchemaResolution: false,
    platform: "ECMAScript 2023; no Node, React, DOM, CSS, or browser API in production source",
  });
}

async function trackedImplementationFiles(platformAudit) {
  const dynamic = [];
  for (const [packageName, inventory] of Object.entries(platformAudit.packages)) {
    for (const relative of inventory.sourceFiles) {
      dynamic.push(`packages/${packageName}/src/${relative}`);
    }
    for (const relative of inventory.distributionFiles) {
      dynamic.push(`packages/${packageName}/dist/${relative}`);
    }
  }
  const paths = [...new Set([...FIXED_TRACKED_PATHS, ...dynamic])].sort(compareText);
  const tracked = [];
  for (const relativePath of paths) {
    if (relativePath === HISTORICAL_SELF_RECORD.path) {
      tracked.push(HISTORICAL_SELF_RECORD);
      continue;
    }
    if (relativePath === HISTORICAL_ROOT_TEST_RECORD.path) {
      tracked.push(HISTORICAL_ROOT_TEST_RECORD);
      continue;
    }
    const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
    tracked.push(Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) }));
  }
  return Object.freeze(tracked);
}

async function assertArtifactDestinationEntry(artifactPath) {
  try {
    const entry = await lstat(artifactPath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      fail(
        "INTERACTION_ARTIFACT_UNSUPPORTED_ENTRY",
        "The evidence destination must be absent or a regular file.",
      );
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function resolveWritableArtifactPath(artifactPath) {
  const absolute = path.resolve(artifactPath);
  const parent = path.dirname(absolute);
  const parentEntry = await lstat(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    fail(
      "INTERACTION_ARTIFACT_UNSUPPORTED_ENTRY",
      "The evidence destination parent must be a real directory, not a symlink.",
    );
  }
  const resolvedParent = await realpath(parent);
  const resolvedArtifactPath = path.join(resolvedParent, path.basename(absolute));
  await assertArtifactDestinationEntry(resolvedArtifactPath);
  return Object.freeze({ resolvedArtifactPath, resolvedParent });
}

async function openExclusiveTemporary(parent, basename) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const temporaryPath = path.join(
      parent,
      `.${basename}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      const handle = await open(temporaryPath, "wx", 0o600);
      return { handle, temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail("INTERACTION_ARTIFACT_TEMPORARY_CREATE_FAILED", "Could not reserve a temporary file.");
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T09 interaction-contract evidence entirely in memory. */
export async function buildProtocolInteractionContractsEvidence({
  tracePath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_TRACE_PATH,
  normativeCoveragePath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_NORMATIVE_PATH,
  findingsPath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_FINDINGS_PATH,
  interactionSourcePath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_SOURCE_PATH,
  componentArtifactPath = DEFAULT_PROTOCOL_COMPONENT_CONTRACTS_ARTIFACT_PATH,
  validatorApi,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot ? await verifyProtocolSnapshot() : EXPECTED_PROTOCOL_SNAPSHOT;
  const api = validatorApi ?? (await loadValidatorApi());
  const publicExports = verifyPublicApi(api);
  const commandWiring = await verifyCommandWiring();
  const trace = await verifyTraceability(tracePath);
  const mandatoryClauses = await verifyNormativeCoverage(normativeCoveragePath);
  const findings = await verifyFindings(findingsPath);
  const sourceProfile = await verifyInteractionSource(interactionSourcePath);
  const prerequisite = await verifyComponentPrerequisite(componentArtifactPath);
  const fixtures = await loadFrozenFixtures();
  const frozenValidation = await verifyFrozenCorpus(api, fixtures);
  const behaviorContracts = verifyBehaviorGoldens(api, fixtures);
  const behaviorIdentity = verifyBehaviorIdentityGolden(api, fixtures);
  const attachments = verifyAttachmentGoldens(api, fixtures);
  const conflicts = verifyConflictGoldens(api, fixtures);
  const interactionNames = verifyEventAndCommandGoldens(api, fixtures);
  const payloadValidation = verifyPayloadGoldens(api, fixtures);
  const payloadSafety = verifyPayloadSafetyGoldens(api, fixtures);
  const schemaSafetyGoldens = verifySchemaSafetyGoldens(api, fixtures);
  const laterTaskScopeAccepted = verifyLaterTaskFences(api, fixtures);
  const determinism = verifyDeterminism(api, fixtures);
  const payloadBoundary = verifyHostilePayloadBoundary(api, fixtures);
  const platformAudit = await verifyPlatformAndDistributionAudit();
  const trackedFiles = await trackedImplementationFiles(platformAudit);

  const artifact = {
    schemaVersion: 1,
    task: "M02-T09",
    profile: "desen-interaction-contract-validation-v1",
    protocolVersion: "0.1.0",
    result: "PASS",
    frozenInput: {
      sourceCommit: snapshot.sourceCommit,
      sourceTree: snapshot.sourceTree,
      aggregateSha256: snapshot.aggregateSha256,
      catalogTuple: {
        id: fixtures.validCatalog.id,
        version: fixtures.validCatalog.version,
        target: fixtures.validCatalog.target,
        packageDigest: fixtures.validCatalog.packageDigest,
      },
    },
    prerequisite: { componentContracts: prerequisite },
    traceability: {
      schemaFamilies: trace.families,
      schemaFamilyCount: trace.families.length,
      schemaConstraints: trace.constraintCount,
      conformanceResponsibilities: [],
      proseRules: EXPECTED_PROSE_RULES,
      mandatoryClauses,
      ownedCoreDiagnostics: EXPECTED_CORE_DIAGNOSTICS,
      reusedComponentSurfaceDiagnostics: REUSED_COMPONENT_DIAGNOSTICS,
      excludedCommandInputDiagnostic: {
        id: "D-016",
        code: "COMMAND_INPUT_INVALID",
        owner: "M02-T11",
      },
      implementationDiagnostic: INVALID_INTERACTION_CONTRACT,
      implementationFindings: findings,
    },
    publicApi: {
      exports: publicExports,
      cumulativeBoundary: sourceProfile.cumulativeBoundary,
      successValue: "independent recursively frozen JSON snapshot",
      failureValue: "no trusted document or payload value",
      dynamicObligations: "deeply frozen deterministic inert JSON array",
    },
    frozenValidation,
    behaviorContracts,
    behaviorIdentity,
    attachments,
    conflicts,
    events: interactionNames.events,
    commands: interactionNames.commands,
    payloadValidation,
    payloadSafety,
    schemaSafetyGoldens,
    laterTaskScopeAccepted,
    determinism,
    security: {
      rawDocuments: "re-enter the cumulative T06→T08 immutable trust boundary",
      resolvedPayloadBoundary: payloadBoundary,
      payloadInterpretation: sourceProfile.payloadInterpretation,
      payloadLimits: sourceProfile.payloadLimits,
      preCanonicalExpansionBound: sourceProfile.preCanonicalExpansionBound,
      queuedChildReservation: sourceProfile.queuedChildReservation,
      schemaProfile: {
        finding: "PF-011",
        inheritedFromVerifiedT08Artifact: prerequisite.sha256,
        evaluationBudget: 50_000,
        unsafeNativePatternExecution: false,
      },
      platformAudit,
    },
    implementation: {
      package: "@desen/validator",
      platform: platformAudit.platform,
      runtimeDependencies: [
        { name: "@desen/protocol", version: "workspace:*", license: "Apache-2.0" },
      ],
      transitiveRuntimeDependencies: [],
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      trackedFiles,
    },
    verification: {
      commands: [
        "pnpm generate:protocol-interaction-contracts",
        "pnpm verify:protocol-interaction-contracts",
        "pnpm test:protocol-interaction-contracts",
        "pnpm check",
      ],
      commandWiring,
      artifactWriter: {
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        commit: "atomic rename",
        failureCleanup: "temporary file removed",
        rejectedDestinations: ["symlink", "directory", "special file", "symlink parent"],
      },
      independentAnchors: [
        "complete M02-T08 verifier PASS plus exact prerequisite bytes",
        "reviewed exact 7-family / 246-constraint T09 trace ownership",
        "N-033 and N-034 remain PLANNED without an adapter-completion claim",
        "PF-010 through PF-014 implementation decisions",
        "one official unknown-event vector at its exact frozen pointer",
        "project-owned behavior, attachment, mutual-conflict, event, known-target command, and payload goldens",
        "resolved payload ValueSpec-shaped member regression, array/object payload limits, and pre-canonical shared-container/frontier bounds",
        "six interaction schema-locator safety mutations",
        "validator and transitive protocol source/distribution inventory and platform audit",
        "same-directory exclusive temporary write followed by atomic rename",
      ],
    },
    limitations: [
      "N-033 and N-034 remain PLANNED: this validator primitive does not prove adapter payload enforcement or command implementation parity.",
      "Static event-reference paths are enforced by cumulative T10; asynchronous event lifetime remains M04-T14 work.",
      "Command targets and inputs, resources, operations, navigation, and static action contracts are enforced by cumulative T11; execution and liveness remain M04 work.",
      "Behavior command schemas are prepared, but DESEN 0.1.0 defines no behavior.command action and this implementation invents none.",
      "Official-suite parity and exhaustive diagnostic micro-vectors remain M02-T12 and M02-T13.",
      "Document-wide finite ingress limits remain M02-T13; T09 records only schema evaluation and resolved event-payload boundaries.",
      "This artifact does not claim publication, runtime adapter wiring, activation, G02, or any new Proof Matrix P-* result.",
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

/** Writes deterministic M02-T09 evidence to its single tracked regular-file destination. */
export async function writeProtocolInteractionContractsEvidence({
  artifactPath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolInteractionContractsEvidence();
  const { handle, temporaryPath } = await openExclusiveTemporary(
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
        Object.freeze({ artifactPath: resolvedArtifactPath, temporaryPath }),
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
        // Preserve the primary failure; cleanup below remains explicit.
      }
    }
    try {
      await removeTemporary(temporaryPath);
    } catch (cleanupError) {
      fail(
        "INTERACTION_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
        "Evidence generation failed and its temporary file could not be removed.",
        {
          writerError: error instanceof Error ? error.message : String(error),
          cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        },
      );
    }
    throw error;
  }
}

/** Rebuilds and byte-compares tracked M02-T09 evidence without modifying it. */
export async function verifyProtocolInteractionContracts({
  artifactPath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolInteractionContractsEvidence();
  const actual = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actual).equals(result.artifactBytes)) {
    fail("INTERACTION_ARTIFACT_DRIFT", "Tracked M02-T09 evidence is stale or modified.", {
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(actual),
    });
  }
  return Object.freeze({
    result: "PASS",
    schemaFamilies: EXPECTED_SCHEMA_FAMILIES.length,
    schemaConstraints: EXPECTED_SCHEMA_CONSTRAINTS,
    ownedCoreDiagnostics: EXPECTED_CORE_DIAGNOSTICS.length,
    reusedCoreDiagnostics: REUSED_COMPONENT_DIAGNOSTICS.length,
    officialT09Invalid: result.artifact.frozenValidation.officialT09Invalid.length,
    behaviorGoldens:
      result.artifact.behaviorContracts.props.length +
      result.artifact.behaviorContracts.styles.length +
      result.artifact.behaviorContracts.slots.length,
    attachmentGoldens: result.artifact.attachments.length,
    conflictGoldens: result.artifact.conflicts.length,
    schemaSafetyGoldens:
      result.artifact.schemaSafetyGoldens.accepted.length +
      result.artifact.schemaSafetyGoldens.rejected.length,
    payloadSafetyGoldens:
      result.artifact.payloadSafety.accepted.length + result.artifact.payloadSafety.rejected.length,
    scopeFenceAccepted: result.artifact.laterTaskScopeAccepted.length,
    examples: FROZEN_EXAMPLES.length,
    artifactSha256: result.artifactSha256,
  });
}
