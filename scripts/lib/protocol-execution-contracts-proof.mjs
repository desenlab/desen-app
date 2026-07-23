import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolBindingContracts,
} from "./protocol-binding-contracts-proof.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T11 evidence artifact. */
export const DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
);

/** Absolute path to the reviewed protocol trace ledger used by M02-T11 evidence. */
export const DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the BCP 14 ownership ledger used by M02-T11 evidence. */
export const DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_NORMATIVE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/NORMATIVE-COVERAGE.md",
);

/** Absolute path to the reviewed execution-contract findings. */
export const DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/plan/PROTOCOL-FINDINGS.md",
);

/** Absolute path to the reviewed execution-contract implementation. */
export const DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/validator/src/execution-contract-validation.ts",
);

const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const EXPECTED_EXECUTION_DIAGNOSTIC = "run.desen.validator/INVALID_EXECUTION_CONTRACT";
const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "INVALID_EXECUTION_CONTRACT_CODE",
  "validateDesenBundleExecutionContracts",
  "validateDesenExecutionCatalogSet",
  "validateDesenExecutionContracts",
  "validateDesenExecutionValue",
  "validateDesenSourceExecutionContracts",
]);
const EXPECTED_SCHEMA_FAMILIES = Object.freeze([
  Object.freeze({ id: "SC-031", expectedConstraints: 5 }),
  Object.freeze({ id: "SC-032", expectedConstraints: 5 }),
  Object.freeze({ id: "SC-041", expectedConstraints: 178 }),
  Object.freeze({ id: "SC-046", expectedConstraints: 70 }),
  Object.freeze({ id: "SC-048", expectedConstraints: 24 }),
  Object.freeze({ id: "SC-049", expectedConstraints: 36 }),
  Object.freeze({ id: "SC-059", expectedConstraints: 8 }),
  Object.freeze({ id: "SC-060", expectedConstraints: 23 }),
  Object.freeze({ id: "SC-061", expectedConstraints: 34 }),
]);
const EXPECTED_SCHEMA_CONSTRAINTS = 383;
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-042",
  "R-043",
  "R-055",
  "R-073",
  "R-074",
  "R-075",
  "R-076",
  "R-077",
  "R-079",
  "R-080",
  "R-120",
]);
const EXPECTED_INVARIANTS = Object.freeze(["A-005", "A-011"]);
const EXPECTED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-016", code: "COMMAND_INPUT_INVALID" }),
  Object.freeze({ id: "D-024", code: "OPERATION_INPUT_INVALID" }),
  Object.freeze({ id: "D-025", code: "OPERATION_OUTPUT_INVALID" }),
  Object.freeze({ id: "D-027", code: "RESOURCE_INPUT_INVALID" }),
  Object.freeze({ id: "D-028", code: "RESOURCE_OUTPUT_INVALID" }),
]);
const REUSED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-005", code: "ENTRY_NOT_FOUND" }),
  Object.freeze({ id: "D-015", code: "UNKNOWN_COMMAND" }),
  Object.freeze({ id: "D-019", code: "STATE_WRITE_INVALID" }),
  Object.freeze({ id: "D-020", code: "REFERENCE_UNRESOLVED" }),
]);
const INHERITED_OBLIGATION_KINDS = Object.freeze([
  "behavior-prop",
  "behavior-style-part-property",
  "component-prop",
  "style-part-property",
]);
const NEW_EXECUTION_OBLIGATION_KINDS = Object.freeze([
  "component-command-input",
  "operation-input",
  "resource-input",
  "state-write",
]);
const EXPECTED_OBLIGATION_KINDS = Object.freeze(
  [...INHERITED_OBLIGATION_KINDS, ...NEW_EXECUTION_OBLIGATION_KINDS].sort(),
);
const EXPECTED_VALUE_SELECTOR_KINDS = Object.freeze([
  "component-command-input",
  "operation-input",
  "operation-output",
  "resource-input",
  "resource-output",
]);
const EXPECTED_VALUE_SAFETY_LIMITS = Object.freeze({
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

const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const STACK = "com.example.ui/Stack";

const FIXED_TRACKED_PATHS = Object.freeze([
  "packages/validator/src/binding-contract-validation.ts",
  "packages/validator/src/execution-contract-validation.ts",
  "packages/validator/src/index.ts",
  "packages/validator/src/interaction-contract-validation.ts",
  "packages/validator/src/schema-instance-validation.ts",
  "packages/validator/src/semantic-diagnostics.ts",
  "packages/validator/test/execution-contracts.test.ts",
  "docs/proof/PROTOCOL-EXECUTION-CONTRACTS.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/lib/protocol-execution-contracts-proof.mjs",
  "scripts/generate-protocol-execution-contracts-proof.mjs",
  "scripts/verify-protocol-execution-contracts.mjs",
  "tests/protocol-execution-contracts.test.mjs",
]);

/** Stable failure raised when deterministic M02-T11 evidence cannot be established. */
export class ProtocolExecutionContractsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProtocolExecutionContractsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ProtocolExecutionContractsEvidenceError(code, message, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assertJsonEqual(actual, expected, label, code = "EXECUTION_GOLDEN_MISMATCH") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} changed.`, { expected, actual });
  }
}

function writeAt(root, segments, value) {
  const parent = segments.slice(0, -1).reduce((current, segment) => current[segment], root);
  parent[segments.at(-1)] = value;
}

function deleteAt(root, segments) {
  const parent = segments.slice(0, -1).reduce((current, segment) => current[segment], root);
  Reflect.deleteProperty(parent, segments.at(-1));
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
  if (!isDeepFrozen(value)) fail("EXECUTION_RESULT_MUTABLE", `${label} is not recursively frozen.`);
  try {
    JSON.stringify(value);
  } catch {
    fail("EXECUTION_RESULT_NOT_JSON", `${label} is not JSON-serializable.`);
  }
}

function assertSuccess(result, label) {
  if (
    result?.valid !== true ||
    !("value" in result) ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 0
  ) {
    fail("EXECUTION_PUBLIC_API_FAILURE", `${label} unexpectedly failed.`, {
      diagnostics: result?.diagnostics,
    });
  }
  assertPortableFrozen(result, label);
  return result;
}

function assertFailure(result, expected, label) {
  if (result?.valid !== false || "value" in result) {
    fail("EXECUTION_PUBLIC_API_WEAKENED", `${label} unexpectedly passed or exposed a value.`);
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
      fail("EXECUTION_PUBLIC_EXPORT_DRIFT", `Missing public export ${exportName}.`);
    }
  }
  for (const functionName of EXPECTED_RUNTIME_EXPORTS.filter((name) =>
    name.startsWith("validate"),
  )) {
    if (typeof api[functionName] !== "function") {
      fail("EXECUTION_PUBLIC_EXPORT_DRIFT", `${functionName} is not a function.`);
    }
  }
  if (api.INVALID_EXECUTION_CONTRACT_CODE !== EXPECTED_EXECUTION_DIAGNOSTIC) {
    fail("EXECUTION_PUBLIC_EXPORT_DRIFT", "The execution implementation diagnostic changed.");
  }
  return Object.freeze([...EXPECTED_RUNTIME_EXPORTS]);
}

async function verifyCommandWiring() {
  const root = await readJson(path.join(WORKSPACE_ROOT, "package.json"));
  const validator = await readJson(path.join(WORKSPACE_ROOT, "packages/validator/package.json"));
  const expected = {
    "generate:protocol-execution-contracts":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-execution-contracts-proof.mjs",
    "verify:protocol-execution-contracts":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-execution-contracts.mjs",
    "test:protocol-execution-contracts":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:execution-contracts && node --test tests/protocol-execution-contracts.test.mjs",
  };
  for (const [name, command] of Object.entries(expected)) {
    if (root.scripts?.[name] !== command) {
      fail("EXECUTION_COMMAND_WIRING_DRIFT", `${name} wiring changed.`, {
        expected: command,
        actual: root.scripts?.[name],
      });
    }
  }
  const packageCommand =
    "vitest run test/schema-instance-validation.test.ts test/schema-path-inspection.test.ts test/component-contracts.test.ts test/interaction-contract-internals.test.ts test/interaction-contracts.test.ts test/binding-contracts.test.ts test/execution-contracts.test.ts";
  if (validator.scripts?.["test:execution-contracts"] !== packageCommand) {
    fail("EXECUTION_COMMAND_WIRING_DRIFT", "Package execution-test wiring changed.", {
      expected: packageCommand,
      actual: validator.scripts?.["test:execution-contracts"],
    });
  }
  for (const [scriptName, required] of [
    ["test", "pnpm test:protocol-execution-contracts"],
    ["check", "pnpm verify:protocol-execution-contracts"],
  ]) {
    if (!root.scripts?.[scriptName]?.includes(required)) {
      fail("EXECUTION_COMMAND_WIRING_DRIFT", `${scriptName} omits ${required}.`);
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
  const families = trace.schemaFamilies
    .filter(({ semanticOwners }) => semanticOwners?.includes("M02-T11"))
    .map(({ id, expectedConstraints }) => ({ id, expectedConstraints }))
    .sort((left, right) => compareText(left.id, right.id));
  assertJsonEqual(
    families,
    EXPECTED_SCHEMA_FAMILIES,
    "M02-T11 schema ownership",
    "EXECUTION_TRACE_DRIFT",
  );
  const constraintCount = families.reduce((total, entry) => total + entry.expectedConstraints, 0);
  if (constraintCount !== EXPECTED_SCHEMA_CONSTRAINTS) {
    fail("EXECUTION_TRACE_DRIFT", "M02-T11 schema constraint total changed.", {
      expected: EXPECTED_SCHEMA_CONSTRAINTS,
      actual: constraintCount,
    });
  }
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T11"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "M02-T11 prose ownership",
    "EXECUTION_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.invariants, "M02-T11"),
    [...EXPECTED_INVARIANTS].sort(compareText),
    "M02-T11 invariant ownership",
    "EXECUTION_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T11"),
    [],
    "M02-T11 conformance ownership",
    "EXECUTION_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T11"))
    .map(({ id, anchor }) => ({ id, code: anchor }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_CORE_DIAGNOSTICS,
    "M02-T11 diagnostic ownership",
    "EXECUTION_TRACE_DRIFT",
  );
  return Object.freeze({ families: Object.freeze(families), constraintCount });
}

function parseCoverageRows(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\| ((?:N|S)-\d{3}) \|/u);
    if (match === null) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.push({
      id: match[1],
      owners: (cells[3] ?? "")
        .split(",")
        .map((owner) => owner.trim())
        .filter(Boolean),
    });
  }
  return rows;
}

async function verifyNormativeCoverage(normativePath) {
  const rows = parseCoverageRows(await readFile(normativePath, "utf8"));
  const owned = rows.filter(({ owners }) => owners.includes("M02-T11")).map(({ id }) => id);
  assertJsonEqual(owned, [], "M02-T11 BCP 14 ownership", "EXECUTION_NORMATIVE_DRIFT");
  return Object.freeze([]);
}

function findingSection(markdown, id) {
  const start = markdown.indexOf(`## ${id} `);
  if (start < 0) fail("EXECUTION_FINDING_DRIFT", `${id} is missing.`);
  const end = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, end < 0 ? undefined : end).replace(/\s+/gu, " ");
}

async function verifyFindings(findingsPath) {
  const markdown = await readFile(findingsPath, "utf8");
  const anchors = {
    "PF-011": [
      "M02-T11 extends the identical profile",
      "all operation and resource `inputSchema` and `outputSchema` locations",
      "run.desen.validator/INVALID_EXECUTION_CONTRACT",
    ],
    "PF-020": [
      "same exact operation shares one static lifecycle contract",
      "run.desen.validator/INVALID_EXECUTION_CONTRACT",
      "Aliases in different surfaces remain isolated",
    ],
    "PF-021": [
      "RESOURCE_INPUT_INVALID` at `/policy`",
      "ENTRY_NOT_FOUND` at `/surface`",
      "REFERENCE_UNRESOLVED` at `/resource`",
      "UNKNOWN_COMMAND` at `/target`",
    ],
    "PF-022": [
      "validateDesenExecutionValue` with five exact selector kinds",
      "Diagnostic pointers are relative to the detached value root",
      "The runtime must call the detached boundary",
    ],
    "PF-023": [
      "the second segment after `resource` or `operation` is the complete root identifier",
      "No longest-prefix matching, backtracking, or implicit escaping is invented",
      "Dotted and colon-bearing declarations remain structurally legal but are unaddressable",
    ],
  };
  for (const [id, required] of Object.entries(anchors)) {
    const section = findingSection(markdown, id);
    for (const anchor of ["- Status: OPEN", "- Blocks proof: No;", ...required]) {
      if (!section.includes(anchor)) {
        fail("EXECUTION_FINDING_DRIFT", `${id} no longer records a reviewed decision.`, {
          missing: anchor,
        });
      }
    }
  }
  return Object.freeze({
    executionBoundary: "PF-020+",
    starterDiagnosticMappings: true,
    surfaceScopedAliases: true,
    runtimeLivenessDeferred: true,
  });
}

async function verifyExecutionSource(sourcePath) {
  const source = (await readFile(sourcePath, "utf8")).replace(/\s+/gu, " ");
  const anchors = [
    "validateDesenBindingContracts",
    "validateSchemaContractGraph",
    "applySchemaContract",
    "validateDesenExecutionCatalogSet",
    "validateDesenExecutionContracts",
    "validateDesenExecutionValue",
    "INVALID_EXECUTION_CONTRACT",
  ];
  for (const anchor of anchors) {
    if (!source.includes(anchor)) {
      fail("EXECUTION_SOURCE_PROFILE_DRIFT", "A reviewed T11 source boundary changed.", {
        missing: anchor,
      });
    }
  }
  const bindingBoundaryReferences =
    source.match(/\bvalidateDesenBindingContracts\b/gu)?.length ?? 0;
  if (bindingBoundaryReferences !== 2) {
    fail("EXECUTION_SOURCE_PROFILE_DRIFT", "The reviewed T10-to-T11 boundary changed.", {
      actualReferences: bindingBoundaryReferences,
      expectedReferences: 2,
    });
  }
  return Object.freeze({
    cumulativeBoundary: "T06→T07→T08→T09→T10→T11",
    resolvedValueMode: "complete resolved-value inert JSON",
    catalogSchemas: "operation/resource input and output",
    runtimeExecution: false,
  });
}

async function verifyBindingPrerequisite(bindingArtifactPath) {
  let verification;
  try {
    verification = await verifyProtocolBindingContracts({ artifactPath: bindingArtifactPath });
  } catch (error) {
    fail("EXECUTION_PREREQUISITE_DRIFT", "M02-T10 prerequisite verification failed.", {
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  const bytes = await readFile(bindingArtifactPath);
  const artifact = JSON.parse(bytes);
  if (
    artifact.task !== "M02-T10" ||
    artifact.profile !== "desen-binding-contract-validation-v1" ||
    artifact.result !== "PASS" ||
    artifact.protocolVersion !== "0.1.0"
  ) {
    fail("EXECUTION_PREREQUISITE_DRIFT", "M02-T10 prerequisite metadata changed.");
  }
  const digest = sha256(bytes);
  if (verification.artifactSha256 !== digest) {
    fail("EXECUTION_PREREQUISITE_DRIFT", "M02-T10 verifier and prerequisite bytes disagree.");
  }
  return Object.freeze({
    task: artifact.task,
    profile: artifact.profile,
    result: artifact.result,
    verifiedBy: "verifyProtocolBindingContracts",
    sha256: digest,
    verificationSha256: verification.artifactSha256,
  });
}

async function loadFrozenFixtures() {
  const readConformance = (relativePath) => readJson(path.join(CONFORMANCE_ROOT, relativePath));
  const readExample = (file) => readJson(path.join(EXAMPLES_ROOT, file));
  const [
    validSource,
    validBundle,
    validCatalog,
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
    readConformance("invalid/source-unknown-event.json"),
    readConformance("invalid/bundle-revision-mismatch.json"),
    readConformance("invalid/bundle-catalog-digest-mismatch.json"),
    readExample("catalog.web.example.json"),
    readExample("sign-in.source.desen.json"),
    readExample("sign-in.bundle.desen.json"),
    readExample("sortable-list.source.desen.json"),
    readExample("store-map.source.desen.json"),
  ]);
  return Object.freeze({
    validSource,
    validBundle,
    validCatalog,
    unknownEvent,
    revisionMismatch,
    digestMismatch,
    exampleCatalog,
    exampleSignInSource,
    exampleSignInBundle,
    sortableSource,
    storeMapSource,
  });
}

function createCatalogSet(api, catalogs, label) {
  return assertSuccess(api.validateDesenExecutionCatalogSet(catalogs), label).value;
}

function validateSource(api, input, catalogSet) {
  return api.validateDesenSourceExecutionContracts(input, catalogSet);
}

function validateBundle(api, input, catalogSet) {
  return api.validateDesenBundleExecutionContracts(input, catalogSet);
}

function node(id, use, props = undefined) {
  return { id, use, ...(props === undefined ? {} : { props }) };
}

function minimalSource(fixtures, root, state = {}, resources = {}) {
  const source = cloneJson(fixtures.validSource);
  source.entry = "main";
  source.surfaces = { main: { id: "main", state, resources, root } };
  delete source.authoring;
  return source;
}

function buttonWithActions(actions) {
  return { id: "actor", use: BUTTON, props: { label: "Run" }, on: { press: actions } };
}

function sourceWithActions(fixtures, actions, { state = {}, resources = {}, siblings = [] } = {}) {
  if (siblings.length === 0)
    return minimalSource(fixtures, buttonWithActions(actions), state, resources);
  return minimalSource(
    fixtures,
    {
      id: "layout",
      use: STACK,
      props: { direction: "vertical" },
      slots: { default: [buttonWithActions(actions), ...siblings] },
    },
    state,
    resources,
  );
}

function addOperation(catalog, capabilityId, inputSchema, outputSchema) {
  catalog.operations[capabilityId] = {
    inputSchema,
    outputSchema,
    errors: [],
    effect: "none",
  };
}

function addResource(catalog, capabilityId, inputSchema, outputSchema, policies) {
  catalog.resources[capabilityId] = {
    inputSchema,
    outputSchema,
    errors: [],
    policies,
  };
}

function addCommand(catalog, capabilityId, commandName, inputSchema) {
  const capability = catalog.components[capabilityId];
  capability.commands = { ...(capability.commands ?? {}), [commandName]: { inputSchema } };
}

function signInAction(alias = "request") {
  return {
    type: "operation.invoke",
    operation: SIGN_IN,
    as: alias,
    input: { email: "person@example.com", password: "secret" },
  };
}

function frozenFileHash(relativePath) {
  return readFile(path.join(DEFAULT_SNAPSHOT_ROOT, relativePath)).then((bytes) =>
    Object.freeze({ file: relativePath, bytes: bytes.length, sha256: sha256(bytes) }),
  );
}

async function verifyFrozenCorpus(api, fixtures, conformanceSet, exampleSet) {
  const validConformance = [
    Object.freeze({ file: "valid/web.catalog.json", target: "catalog-set", valid: true }),
    Object.freeze({
      file: "valid/sign-in.source.json",
      target: "source",
      valid: true,
      obligations: assertSuccess(
        validateSource(api, fixtures.validSource, conformanceSet),
        "frozen valid Source",
      ).obligations.length,
    }),
    Object.freeze({
      file: "valid/sign-in.bundle.json",
      target: "bundle",
      valid: true,
      obligations: assertSuccess(
        validateBundle(api, fixtures.validBundle, conformanceSet),
        "frozen valid Bundle",
      ).obligations.length,
    }),
  ];
  const sourceExamples = [
    ["sign-in.source.desen.json", fixtures.exampleSignInSource],
    ["sortable-list.source.desen.json", fixtures.sortableSource],
    ["store-map.source.desen.json", fixtures.storeMapSource],
  ];
  const validExamples = [
    Object.freeze({ file: "catalog.web.example.json", target: "catalog-set", valid: true }),
    ...sourceExamples.map(([file, document]) => {
      const result = assertSuccess(
        validateSource(api, document, exampleSet),
        `frozen example ${file}`,
      );
      return Object.freeze({
        file,
        target: "source",
        valid: true,
        obligations: result.obligations.length,
      });
    }),
    Object.freeze({
      file: "sign-in.bundle.desen.json",
      target: "bundle",
      valid: true,
      obligations: assertSuccess(
        validateBundle(api, fixtures.exampleSignInBundle, exampleSet),
        "frozen example sign-in.bundle.desen.json",
      ).obligations.length,
    }),
  ];
  assertSuccess(api.validateDesenExecutionCatalogSet([fixtures.exampleCatalog]), "example Catalog");
  const inheritedFailure = assertFailure(
    validateSource(api, fixtures.unknownEvent, conformanceSet),
    [
      {
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/home/root/slots/default/0/on/teleport",
      },
    ],
    "inherited T09 unknown-event failure",
  );
  assertSuccess(
    validateBundle(api, fixtures.revisionMismatch, conformanceSet),
    "later revision mismatch",
  );
  assertSuccess(
    validateBundle(api, fixtures.digestMismatch, conformanceSet),
    "later digest mismatch",
  );

  const hashPaths = [
    "conformance/valid/web.catalog.json",
    "conformance/valid/sign-in.source.json",
    "conformance/valid/sign-in.bundle.json",
    ...FROZEN_EXAMPLES.map(({ file }) => `examples/${file}`),
  ];
  return Object.freeze({
    validConformance: Object.freeze(validConformance),
    validExamples: Object.freeze(validExamples),
    officialT11Invalid: Object.freeze([]),
    inheritedT10Failure: Object.freeze({
      file: "invalid/source-unknown-event.json",
      diagnostics: Object.freeze(diagnosticIdentity(inheritedFailure)),
    }),
    fixtureHashes: Object.freeze(await Promise.all(hashPaths.map(frozenFileHash))),
    laterIntegrityAccepted: Object.freeze([
      Object.freeze({ id: "bundle-revision", owner: "M06-T09/M07-T02", valid: true }),
      Object.freeze({ id: "catalog-digest", owner: "M07-T03", valid: true }),
    ]),
  });
}

function verifyCatalogTrustFence(api, fixtures) {
  const lowerStage = assertSuccess(
    api.validateDesenInteractionCatalogSet([fixtures.validCatalog]),
    "genuine T09 catalog set",
  );
  const sourceFailure = assertFailure(
    validateSource(api, fixtures.validSource, lowerStage.value),
    [{ code: EXPECTED_EXECUTION_DIAGNOSTIC, pointer: "/catalogs" }],
    "forged T09 Source catalog brand",
  );
  const bundleFailure = assertFailure(
    validateBundle(api, fixtures.validBundle, lowerStage.value),
    [{ code: EXPECTED_EXECUTION_DIAGNOSTIC, pointer: "/requires/catalogs" }],
    "forged T09 Bundle catalog brand",
  );
  const resolvedValueFailure = assertFailure(
    api.validateDesenExecutionValue(
      {},
      { kind: "operation-output", capabilityId: SIGN_IN },
      lowerStage.value,
    ),
    [{ code: EXPECTED_EXECUTION_DIAGNOSTIC, pointer: "" }],
    "forged T09 resolved-value catalog brand",
  );
  const rejectedEntryPoints = Object.freeze([
    Object.freeze({
      id: "source",
      diagnostics: Object.freeze(diagnosticIdentity(sourceFailure)),
    }),
    Object.freeze({
      id: "bundle",
      diagnostics: Object.freeze(diagnosticIdentity(bundleFailure)),
    }),
    Object.freeze({
      id: "execution-value",
      diagnostics: Object.freeze(diagnosticIdentity(resolvedValueFailure)),
    }),
  ]);
  return Object.freeze({
    lowerStage: "DesenValidatedInteractionCatalogSet",
    requiredStage: "DesenValidatedExecutionCatalogSet",
    rejectedEntryPointCount: rejectedEntryPoints.length,
    rejectedEntryPoints,
  });
}

function nestedNotSchema(depth) {
  let schema = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

function verifySchemaSafety(api, fixtures) {
  const acceptedCatalog = cloneJson(fixtures.validCatalog);
  acceptedCatalog.operations[SIGN_IN].outputSchema = nestedNotSchema(128);
  assertSuccess(
    api.validateDesenExecutionCatalogSet([acceptedCatalog]),
    "maximum execution schema depth",
  );

  const depthCatalog = cloneJson(fixtures.validCatalog);
  depthCatalog.operations[SIGN_IN].outputSchema = nestedNotSchema(129);
  const depthFailure = assertFailure(
    api.validateDesenExecutionCatalogSet([depthCatalog]),
    [
      {
        code: EXPECTED_EXECUTION_DIAGNOSTIC,
        pointer: "/0/operations/com.example.auth~1signIn/outputSchema",
      },
    ],
    "above maximum execution schema depth",
  );
  const cases = [
    {
      id: "operation-input",
      path: ["operations", SIGN_IN, "inputSchema"],
      pointer: "/0/operations/com.example.auth~1signIn/inputSchema/properties/value/pattern",
    },
    {
      id: "operation-output",
      path: ["operations", SIGN_IN, "outputSchema"],
      pointer: "/0/operations/com.example.auth~1signIn/outputSchema/properties/value/pattern",
    },
    {
      id: "resource-input",
      path: ["resources", STORES, "inputSchema"],
      pointer: "/0/resources/com.example.stores~1list/inputSchema/properties/value/pattern",
    },
    {
      id: "resource-output",
      path: ["resources", STORES, "outputSchema"],
      pointer: "/0/resources/com.example.stores~1list/outputSchema/properties/value/pattern",
    },
  ];
  const rejected = cases.map(({ id, path: schemaPath, pointer }) => {
    const catalog = cloneJson(fixtures.validCatalog);
    writeAt(catalog, schemaPath, {
      type: "object",
      properties: { value: { type: "string", pattern: "^(a+)+$" } },
    });
    const result = assertFailure(
      api.validateDesenExecutionCatalogSet([catalog]),
      [{ code: EXPECTED_EXECUTION_DIAGNOSTIC, pointer }],
      `unsafe ${id} schema`,
    );
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });
  return Object.freeze({
    accepted: Object.freeze([{ id: "maximum-schema-depth", boundary: 128, valid: true }]),
    rejected: Object.freeze([
      Object.freeze({
        id: "above-maximum-schema-depth",
        boundary: 129,
        diagnostics: Object.freeze(diagnosticIdentity(depthFailure)),
      }),
      ...rejected,
    ]),
  });
}

function verifyResourceGoldens(api, fixtures, baseCatalogSet) {
  const SEARCH = "com.example.search/results";
  const searchCatalog = () => {
    const catalog = cloneJson(fixtures.validCatalog);
    addResource(
      catalog,
      SEARCH,
      {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          items: { type: "array", items: { type: "string" } },
          count: { type: "integer" },
        },
      },
      ["manual", "mount"],
    );
    return catalog;
  };
  const resource = (input, policy = "manual") => ({ use: SEARCH, input, policy });
  const document = (input, policy = "manual") =>
    minimalSource(
      fixtures,
      node("text", TEXT, { text: "Results" }),
      {},
      {
        search: resource(input, policy),
      },
    );
  const catalogSet = createCatalogSet(api, [searchCatalog()], "search execution Catalog");
  assertSuccess(
    validateSource(api, document({ query: "desen" }), catalogSet),
    "valid resource input",
  );

  const cases = [
    {
      id: "unsupported-policy",
      input: document({ query: "desen" }, "once"),
      expected: [
        {
          code: "RESOURCE_INPUT_INVALID",
          pointer: "/surfaces/main/resources/search/policy",
        },
      ],
    },
    {
      id: "unknown-static-input",
      input: document({ query: "desen", unexpected: true }),
      expected: [
        {
          code: "RESOURCE_INPUT_INVALID",
          pointer: "/surfaces/main/resources/search/input/unexpected",
        },
      ],
    },
    {
      id: "missing-required-input",
      input: document({}),
      expected: [
        {
          code: "RESOURCE_INPUT_INVALID",
          pointer: "/surfaces/main/resources/search/input/query",
        },
      ],
    },
    {
      id: "wrong-type-input",
      input: document({ query: 42 }),
      expected: [
        {
          code: "RESOURCE_INPUT_INVALID",
          pointer: "/surfaces/main/resources/search/input/query",
        },
      ],
    },
    {
      id: "dynamic-peer-does-not-mask-static-input-error",
      input: document({ query: { $ref: "context.query" }, unexpected: true }),
      expected: [
        {
          code: "RESOURCE_INPUT_INVALID",
          pointer: "/surfaces/main/resources/search/input/unexpected",
        },
      ],
      obligation: {
        kind: "resource-input",
        pointer: "/surfaces/main/resources/search/input/query",
      },
    },
  ];
  const rejected = cases.map(({ id, input, expected, obligation }) => {
    const result = assertFailure(validateSource(api, input, catalogSet), expected, id);
    if (
      obligation !== undefined &&
      !result.obligations.some(
        (entry) => entry.kind === obligation.kind && entry.pointer === obligation.pointer,
      )
    ) {
      fail("EXECUTION_OBLIGATION_DRIFT", `${id} lost its independent resource obligation.`);
    }
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const dynamic = document({ query: { $ref: "context.query" } }, "mount");
  const dynamicResult = assertSuccess(
    validateSource(api, dynamic, catalogSet),
    "dynamic resource input",
  );
  if (!dynamicResult.obligations.some(({ kind }) => kind === "resource-input")) {
    fail("EXECUTION_OBLIGATION_DRIFT", "Dynamic resource input did not create an obligation.");
  }

  // The inherited T07 category check remains cumulative and is not counted as a new T11 mutation.
  assertFailure(
    validateSource(
      api,
      minimalSource(
        fixtures,
        node("text", TEXT, { text: "x" }),
        {},
        {
          stores: { use: SIGN_IN, input: {}, policy: "mount" },
        },
      ),
      baseCatalogSet,
    ),
    [
      {
        code: "UNKNOWN_CAPABILITY",
        pointer: "/surfaces/main/resources/stores/use",
      },
    ],
    "resource category confusion",
  );
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "supported-static-input", valid: true }),
      Object.freeze({ id: "dynamic-input-obligation", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
  });
}

function verifyLifecycleReferenceGoldens(api, fixtures, baseCatalogSet) {
  const SEARCH = "com.example.search/results";
  const catalog = cloneJson(fixtures.validCatalog);
  addResource(
    catalog,
    SEARCH,
    { type: "object", additionalProperties: false, properties: {} },
    {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: { items: { type: "array" }, count: { type: "integer" } },
    },
    ["manual"],
  );
  const catalogSet = createCatalogSet(api, [catalog], "lifecycle execution Catalog");
  const resources = { search: { use: SEARCH, input: {}, policy: "manual" } };
  const probe = (reference, fallback = undefined) => ({
    type: "event.emit",
    name: "probe",
    payload: {
      value: {
        $ref: reference,
        ...(fallback === undefined ? {} : { fallback }),
      },
    },
  });
  const resourceDocument = (reference, fallback = undefined) =>
    sourceWithActions(fixtures, [probe(reference, fallback)], { resources });
  const operationDocument = (reference, fallback = undefined) =>
    sourceWithActions(fixtures, [signInAction("request"), probe(reference, fallback)]);

  for (const reference of [
    "resource.search.status",
    "resource.search.pending",
    "resource.search.value",
    "resource.search.value.items",
    "resource.search.error.code",
  ]) {
    assertSuccess(
      validateSource(api, resourceDocument(reference), catalogSet),
      `valid ${reference}`,
    );
  }
  const aliasBeforeDeclaration = sourceWithActions(fixtures, [
    probe("operation.request.status"),
    signInAction("request"),
  ]);
  assertSuccess(
    validateSource(api, aliasBeforeDeclaration, baseCatalogSet),
    "surface-wide alias before declaration",
  );
  assertSuccess(
    validateSource(api, resourceDocument("resource.search.value.missing", []), catalogSet),
    "resource closed path fallback",
  );
  assertSuccess(
    validateSource(api, operationDocument("operation.request.value.missing", {}), baseCatalogSet),
    "operation closed path fallback",
  );

  const cases = [
    ["unknown-resource-alias", resourceDocument("resource.ghost.status"), 0],
    ["unknown-resource-alias-with-fallback", resourceDocument("resource.ghost.status", "idle"), 0],
    ["unknown-resource-field", resourceDocument("resource.search.secret"), 0],
    ["unknown-resource-error-field", resourceDocument("resource.search.error.message"), 0],
    ["closed-resource-output-path", resourceDocument("resource.search.value.missing"), 0],
    ["unknown-operation-alias", operationDocument("operation.ghost.status"), 1],
    [
      "unknown-operation-alias-with-fallback",
      operationDocument("operation.ghost.status", "idle"),
      1,
    ],
    ["unknown-operation-field", operationDocument("operation.request.secret"), 1],
    ["unknown-operation-error-field", operationDocument("operation.request.error.message"), 1],
    ["closed-operation-output-path", operationDocument("operation.request.value.missing"), 1],
  ];
  const rejected = cases.map(([id, input, actionIndex]) => {
    const pointer = `/surfaces/main/root/on/press/${String(actionIndex)}/payload/value/$ref`;
    const result = assertFailure(
      validateSource(
        api,
        input,
        id.startsWith("unknown-resource") || id.includes("resource-") ? catalogSet : baseCatalogSet,
      ),
      [{ code: "REFERENCE_UNRESOLVED", pointer }],
      id,
    );
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const crossSurface = operationDocument("operation.request.status");
  crossSurface.surfaces.other = {
    id: "other",
    state: {},
    resources: {},
    root: buttonWithActions([probe("operation.request.status")]),
  };
  const crossFailure = assertFailure(
    validateSource(api, crossSurface, baseCatalogSet),
    [
      {
        code: "REFERENCE_UNRESOLVED",
        pointer: "/surfaces/other/root/on/press/0/payload/value/$ref",
      },
    ],
    "cross-surface operation alias",
  );
  rejected.splice(
    7,
    0,
    Object.freeze({
      id: "cross-surface-operation-alias",
      diagnostics: Object.freeze(diagnosticIdentity(crossFailure)),
    }),
  );
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "all-declared-lifecycle-fields", valid: true }),
      Object.freeze({ id: "surface-wide-alias-before-declaration", valid: true }),
      Object.freeze({ id: "closed-path-fallback", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
  });
}

function verifyStateActionGoldens(api, fixtures, baseCatalogSet) {
  const state = {
    profile: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["name", "enabled"],
        properties: { name: { type: "string" }, enabled: { type: "boolean" } },
      },
      initial: { name: "Ada", enabled: false },
    },
  };
  const source = (action) => sourceWithActions(fixtures, [action], { state });
  for (const action of [
    { type: "state.set", path: "profile", value: { name: "Grace", enabled: true } },
    { type: "state.set", path: "profile.name", value: "Lin" },
    { type: "state.toggle", path: "profile.enabled" },
  ]) {
    assertSuccess(validateSource(api, source(action), baseCatalogSet), `valid ${action.type}`);
  }
  const cases = [
    {
      id: "root-state-set-type",
      action: { type: "state.set", path: "profile", value: "wrong" },
      pointer: "/surfaces/main/root/on/press/0/value",
    },
    {
      id: "root-state-set-required",
      action: { type: "state.set", path: "profile", value: { enabled: true } },
      pointer: "/surfaces/main/root/on/press/0/value/name",
    },
    {
      id: "missing-nested-state-path",
      action: { type: "state.set", path: "profile.missing", value: "x" },
      pointer: "/surfaces/main/root/on/press/0/path",
    },
    {
      id: "nested-state-set-type",
      action: { type: "state.set", path: "profile.name", value: 42 },
      pointer: "/surfaces/main/root/on/press/0/value",
    },
    {
      id: "non-boolean-state-toggle",
      action: { type: "state.toggle", path: "profile.name" },
      pointer: "/surfaces/main/root/on/press/0/path",
    },
  ];
  return Object.freeze({
    accepted: Object.freeze([{ id: "root-nested-and-toggle", valid: true }]),
    rejected: Object.freeze(
      cases.map(({ id, action, pointer }) => {
        const result = assertFailure(
          validateSource(api, source(action), baseCatalogSet),
          [{ code: "STATE_WRITE_INVALID", pointer }],
          id,
        );
        return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
      }),
    ),
  });
}

function verifyOperationGoldens(api, fixtures, baseCatalogSet) {
  assertSuccess(
    validateSource(api, sourceWithActions(fixtures, [signInAction()]), baseCatalogSet),
    "valid operation input",
  );
  assertSuccess(
    validateSource(
      api,
      sourceWithActions(fixtures, [signInAction("shared"), signInAction("shared")]),
      baseCatalogSet,
    ),
    "same alias and exact operation",
  );

  const dynamicAction = signInAction();
  dynamicAction.input = {
    email: { $ref: "state.email" },
    password: { $ref: "context.password" },
  };
  const dynamicResult = assertSuccess(
    validateSource(
      api,
      sourceWithActions(fixtures, [dynamicAction], {
        state: { email: { schema: { type: "string" }, initial: "person@example.com" } },
      }),
      baseCatalogSet,
    ),
    "dynamic operation input",
  );
  for (const pointer of [
    "/surfaces/main/root/on/press/0/input/email",
    "/surfaces/main/root/on/press/0/input/password",
  ]) {
    if (
      !dynamicResult.obligations.some(
        ({ kind, pointer: actual }) => kind === "operation-input" && actual === pointer,
      )
    ) {
      fail("EXECUTION_OBLIGATION_DRIFT", `Dynamic operation input lost ${pointer}.`);
    }
  }

  const invalidPassword = signInAction();
  invalidPassword.input.password = "";
  const missingPassword = signInAction();
  delete missingPassword.input.password;
  const extraInput = signInAction();
  extraInput.input.extra = true;
  const dynamicPeer = signInAction();
  dynamicPeer.input = { email: { $ref: "context.email" }, password: "secret", extra: true };

  const conflictCatalog = cloneJson(fixtures.validCatalog);
  const signOut = "com.example.auth/signOut";
  addOperation(
    conflictCatalog,
    signOut,
    { type: "object", additionalProperties: false, properties: {} },
    { type: "object", additionalProperties: false, properties: {} },
  );
  const conflictSet = createCatalogSet(api, [conflictCatalog], "conflicting operation Catalog");
  const conflicting = {
    type: "operation.invoke",
    operation: signOut,
    as: "shared",
    input: {},
  };

  const cases = [
    {
      id: "wrong-static-input",
      input: sourceWithActions(fixtures, [invalidPassword]),
      catalogSet: baseCatalogSet,
      expected: [
        {
          code: "OPERATION_INPUT_INVALID",
          pointer: "/surfaces/main/root/on/press/0/input/password",
        },
      ],
    },
    {
      id: "missing-required-input",
      input: sourceWithActions(fixtures, [missingPassword]),
      catalogSet: baseCatalogSet,
      expected: [
        {
          code: "OPERATION_INPUT_INVALID",
          pointer: "/surfaces/main/root/on/press/0/input/password",
        },
      ],
    },
    {
      id: "unknown-static-input",
      input: sourceWithActions(fixtures, [extraInput]),
      catalogSet: baseCatalogSet,
      expected: [
        {
          code: "OPERATION_INPUT_INVALID",
          pointer: "/surfaces/main/root/on/press/0/input/extra",
        },
      ],
    },
    {
      id: "dynamic-peer-does-not-mask-static-input-error",
      input: sourceWithActions(fixtures, [dynamicPeer]),
      catalogSet: baseCatalogSet,
      expected: [
        {
          code: "OPERATION_INPUT_INVALID",
          pointer: "/surfaces/main/root/on/press/0/input/extra",
        },
      ],
      obligation: {
        kind: "operation-input",
        pointer: "/surfaces/main/root/on/press/0/input/email",
      },
    },
    {
      id: "conflicting-surface-alias",
      input: sourceWithActions(fixtures, [signInAction("shared"), conflicting]),
      catalogSet: conflictSet,
      expected: [
        {
          code: EXPECTED_EXECUTION_DIAGNOSTIC,
          pointer: "/surfaces/main/root/on/press/1/as",
        },
      ],
    },
  ];
  const rejected = cases.map(({ id, input, catalogSet, expected, obligation }) => {
    const result = assertFailure(validateSource(api, input, catalogSet), expected, id);
    if (
      obligation !== undefined &&
      !result.obligations.some(
        (entry) => entry.kind === obligation.kind && entry.pointer === obligation.pointer,
      )
    ) {
      fail("EXECUTION_OBLIGATION_DRIFT", `${id} lost its independent operation obligation.`);
    }
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const invalidBundle = cloneJson(fixtures.validBundle);
  writeAt(
    invalidBundle,
    ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "input", "password"],
    "",
  );
  assertFailure(
    validateBundle(api, invalidBundle, baseCatalogSet),
    [
      {
        code: "OPERATION_INPUT_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/input/password",
      },
    ],
    "Bundle operation input parity",
  );

  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "valid-static-input", valid: true }),
      Object.freeze({ id: "same-alias-same-operation", valid: true }),
      Object.freeze({ id: "dynamic-input-obligations", valid: true }),
      Object.freeze({ id: "Bundle-relative-pointer-parity", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
  });
}

function commandCatalog(fixtures) {
  const catalog = cloneJson(fixtures.validCatalog);
  addCommand(catalog, TEXT_FIELD, "focus", {
    type: "object",
    additionalProperties: false,
    required: ["selectAll"],
    properties: { selectAll: { type: "boolean" } },
  });
  return catalog;
}

function commandDocument(fixtures, input, target = "field") {
  return sourceWithActions(
    fixtures,
    [{ type: "component.command", target, command: "focus", input }],
    { siblings: [node("field", TEXT_FIELD, { label: "Name", value: "" })] },
  );
}

function verifyActionTargetGoldens(api, fixtures, baseCatalogSet) {
  const declared = sourceWithActions(
    fixtures,
    [
      { type: "navigate", surface: "home", params: { from: "main" } },
      { type: "resource.refresh", resource: "stores" },
    ],
    { resources: { stores: { use: STORES, input: {}, policy: "manual" } } },
  );
  declared.surfaces.home = {
    id: "home",
    state: {},
    resources: {},
    root: node("home.text", TEXT, { text: "Home" }),
  };
  assertSuccess(validateSource(api, declared, baseCatalogSet), "declared action targets");

  const commands = commandCatalog(fixtures);
  const commandSet = createCatalogSet(api, [commands], "action target command Catalog");
  const crossSurface = sourceWithActions(fixtures, [
    {
      type: "component.command",
      target: "other.field",
      command: "focus",
      input: { selectAll: true },
    },
  ]);
  crossSurface.surfaces.other = {
    id: "other",
    state: {},
    resources: {},
    root: node("other.field", TEXT_FIELD, { label: "Other", value: "" }),
  };

  const cases = [
    {
      id: "missing-navigation-surface",
      input: sourceWithActions(fixtures, [{ type: "navigate", surface: "missing" }]),
      catalogSet: baseCatalogSet,
      expected: [{ code: "ENTRY_NOT_FOUND", pointer: "/surfaces/main/root/on/press/0/surface" }],
    },
    {
      id: "external-looking-navigation-surface",
      input: sourceWithActions(fixtures, [{ type: "navigate", surface: "https:" }]),
      catalogSet: baseCatalogSet,
      expected: [{ code: "ENTRY_NOT_FOUND", pointer: "/surfaces/main/root/on/press/0/surface" }],
    },
    {
      id: "missing-refresh-resource",
      input: sourceWithActions(fixtures, [{ type: "resource.refresh", resource: "missing" }]),
      catalogSet: baseCatalogSet,
      expected: [
        { code: "REFERENCE_UNRESOLVED", pointer: "/surfaces/main/root/on/press/0/resource" },
      ],
    },
    {
      id: "missing-component-target",
      input: commandDocument(fixtures, { selectAll: true }, "missing"),
      catalogSet: commandSet,
      expected: [
        {
          code: "UNKNOWN_COMMAND",
          pointer: "/surfaces/main/root/slots/default/0/on/press/0/target",
        },
      ],
    },
    {
      id: "cross-surface-component-target",
      input: crossSurface,
      catalogSet: commandSet,
      expected: [{ code: "UNKNOWN_COMMAND", pointer: "/surfaces/main/root/on/press/0/target" }],
    },
  ];
  const rejected = cases.map(({ id, input, catalogSet, expected }) => {
    const result = assertFailure(validateSource(api, input, catalogSet), expected, id);
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const behaviorCatalog = commandCatalog(fixtures);
  behaviorCatalog.behaviors["com.example.interactions/Sortable"].commands = {
    focus: {
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["selectAll"],
        properties: { selectAll: { type: "boolean" } },
      },
    },
  };
  const behaviorActor = buttonWithActions([
    {
      type: "component.command",
      target: "sort",
      command: "focus",
      input: { selectAll: true },
    },
  ]);
  const behaviorRoot = node("layout", STACK, { direction: "vertical" });
  behaviorRoot.behaviors = [{ id: "sort", use: "com.example.interactions/Sortable" }];
  behaviorRoot.slots = { default: [behaviorActor] };
  assertFailure(
    validateSource(
      api,
      minimalSource(fixtures, behaviorRoot),
      createCatalogSet(api, [behaviorCatalog], "behavior target Catalog"),
    ),
    [
      {
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/main/root/slots/default/0/on/press/0/target",
      },
    ],
    "behavior target category confusion",
  );

  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "declared-navigation-and-refresh", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
    cumulativeCategoryFence: "component.command never redirects to a behavior command",
  });
}

function verifyCommandGoldens(api, fixtures) {
  const catalog = commandCatalog(fixtures);
  const catalogSet = createCatalogSet(api, [catalog], "component command Catalog");
  assertSuccess(
    validateSource(api, commandDocument(fixtures, { selectAll: true }), catalogSet),
    "valid component command",
  );

  const conditional = node("field", TEXT_FIELD, { label: "Name", value: "" });
  conditional.when = { op: "truthy", args: [{ $ref: "context.showField" }] };
  assertSuccess(
    validateSource(
      api,
      sourceWithActions(
        fixtures,
        [
          {
            type: "component.command",
            target: "field",
            command: "focus",
            input: { selectAll: false },
          },
        ],
        { siblings: [conditional] },
      ),
      catalogSet,
    ),
    "conditionally live component target",
  );

  const omitted = commandDocument(fixtures, { selectAll: true });
  deleteAt(omitted, ["surfaces", "main", "root", "slots", "default", 0, "on", "press", 0, "input"]);
  const cases = [
    {
      id: "wrong-static-input",
      input: commandDocument(fixtures, { selectAll: "yes" }),
      pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    },
    {
      id: "omitted-required-input",
      input: omitted,
      pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    },
    {
      id: "explicit-empty-required-input",
      input: commandDocument(fixtures, {}),
      pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    },
    {
      id: "unknown-static-input",
      input: commandDocument(fixtures, { selectAll: true, extra: true }),
      pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/extra",
    },
    {
      id: "dynamic-peer-does-not-mask-static-input-error",
      input: commandDocument(fixtures, {
        selectAll: { $ref: "context.selectAll" },
        extra: true,
      }),
      pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/extra",
      obligation: {
        kind: "component-command-input",
        pointer: "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
      },
    },
  ];
  const rejected = cases.map(({ id, input, pointer, obligation }) => {
    const result = assertFailure(
      validateSource(api, input, catalogSet),
      [{ code: "COMMAND_INPUT_INVALID", pointer }],
      id,
    );
    if (
      obligation !== undefined &&
      !result.obligations.some(
        (entry) => entry.kind === obligation.kind && entry.pointer === obligation.pointer,
      )
    ) {
      fail("EXECUTION_OBLIGATION_DRIFT", `${id} lost its independent command obligation.`);
    }
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const dynamic = assertSuccess(
    validateSource(
      api,
      commandDocument(fixtures, { selectAll: { $ref: "context.selectAll" } }),
      catalogSet,
    ),
    "dynamic component command input",
  );
  if (!dynamic.obligations.some(({ kind }) => kind === "component-command-input")) {
    fail("EXECUTION_OBLIGATION_DRIFT", "Dynamic command input did not create an obligation.");
  }
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "valid-static-input", valid: true }),
      Object.freeze({ id: "dynamic-input-obligation", valid: true }),
      Object.freeze({ id: "conditional-target-static-existence", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
  });
}

function verifyResolvedValueGoldens(api, fixtures, baseCatalogSet) {
  const commandCatalogSet = createCatalogSet(
    api,
    [commandCatalog(fixtures)],
    "resolved command Catalog",
  );
  const selectors = {
    operationInput: { kind: "operation-input", capabilityId: SIGN_IN },
    operationOutput: { kind: "operation-output", capabilityId: SIGN_IN },
    resourceInput: { kind: "resource-input", capabilityId: STORES },
    resourceOutput: { kind: "resource-output", capabilityId: STORES },
    commandInput: {
      kind: "component-command-input",
      capabilityId: TEXT_FIELD,
      commandName: "focus",
    },
  };
  for (const [id, value, selector, catalogSet] of [
    [
      "operation-input",
      { email: "person@example.com", password: "secret" },
      selectors.operationInput,
      baseCatalogSet,
    ],
    ["operation-output", { userId: "user-1" }, selectors.operationOutput, baseCatalogSet],
    ["resource-input", {}, selectors.resourceInput, baseCatalogSet],
    ["resource-output", { items: [], bounds: {} }, selectors.resourceOutput, baseCatalogSet],
    ["component-command-input", { selectAll: true }, selectors.commandInput, commandCatalogSet],
  ]) {
    assertSuccess(api.validateDesenExecutionValue(value, selector, catalogSet), `resolved ${id}`);
  }

  const inertCatalog = cloneJson(fixtures.validCatalog);
  inertCatalog.operations[SIGN_IN].outputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["$ref"],
    properties: { $ref: { type: "number" } },
  };
  const inertSet = createCatalogSet(api, [inertCatalog], "resolved inert-value Catalog");
  const cases = [
    [
      "operation-input-invalid",
      { email: "person@example.com", password: "" },
      selectors.operationInput,
      baseCatalogSet,
      "OPERATION_INPUT_INVALID",
      "/password",
    ],
    [
      "operation-output-invalid",
      { userId: 1 },
      selectors.operationOutput,
      baseCatalogSet,
      "OPERATION_OUTPUT_INVALID",
      "/userId",
    ],
    [
      "resource-input-invalid",
      { extra: true },
      selectors.resourceInput,
      baseCatalogSet,
      "RESOURCE_INPUT_INVALID",
      "/extra",
    ],
    [
      "resource-output-invalid",
      { items: [] },
      selectors.resourceOutput,
      baseCatalogSet,
      "RESOURCE_OUTPUT_INVALID",
      "/bounds",
    ],
    [
      "component-command-input-invalid",
      { selectAll: "yes" },
      selectors.commandInput,
      commandCatalogSet,
      "COMMAND_INPUT_INVALID",
      "/selectAll",
    ],
    [
      "ValueSpec-shaped-resolved-member-is-inert",
      { $ref: "state.not-a-binding" },
      selectors.operationOutput,
      inertSet,
      "OPERATION_OUTPUT_INVALID",
      "/$ref",
    ],
  ];
  const rejected = cases.map(([id, value, selector, catalogSet, code, pointer]) => {
    const result = assertFailure(
      api.validateDesenExecutionValue(value, selector, catalogSet),
      [{ code, pointer }],
      id,
    );
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  const callerOwned = { userId: "before" };
  const detached = assertSuccess(
    api.validateDesenExecutionValue(callerOwned, selectors.operationOutput, baseCatalogSet),
    "detached resolved execution value",
  );
  callerOwned.userId = "after";
  if (detached.value.userId !== "before" || detached.value === callerOwned) {
    fail("EXECUTION_RESULT_RETAINED_INPUT", "Resolved execution success retained caller data.");
  }

  assertFailure(
    api.validateDesenExecutionValue(
      {},
      { kind: "operation-output", capabilityId: "com.example.missing/operation" },
      baseCatalogSet,
    ),
    [{ code: "UNKNOWN_CAPABILITY", pointer: "" }],
    "unknown resolved operation",
  );
  assertFailure(
    api.validateDesenExecutionValue(
      {},
      {
        kind: "component-command-input",
        capabilityId: TEXT_FIELD,
        commandName: "missing",
      },
      commandCatalogSet,
    ),
    [{ code: "UNKNOWN_COMMAND", pointer: "" }],
    "unknown resolved command",
  );

  return Object.freeze({
    selectorKinds: EXPECTED_VALUE_SELECTOR_KINDS,
    accepted: Object.freeze([
      ...EXPECTED_VALUE_SELECTOR_KINDS.map((id) => Object.freeze({ id, valid: true })),
      Object.freeze({ id: "detached-deep-frozen-copy", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
    lookupFences: Object.freeze(["UNKNOWN_CAPABILITY", "UNKNOWN_COMMAND"]),
  });
}

function nestedResolvedValue(depth) {
  let value = null;
  for (let index = 0; index < depth; index += 1) value = { value };
  return value;
}

function wideResolvedObject(propertyCount) {
  return Object.fromEntries(
    Array.from({ length: propertyCount }, (_, index) => [`key${String(index)}`, null]),
  );
}

function verifyResolvedValueSafety(api, fixtures) {
  const catalog = cloneJson(fixtures.validCatalog);
  catalog.operations[SIGN_IN].outputSchema = {};
  const catalogSet = createCatalogSet(api, [catalog], "resolved-value safety Catalog");
  const selector = { kind: "operation-output", capabilityId: SIGN_IN };
  const accepted = [
    ["maximum-depth", nestedResolvedValue(EXPECTED_VALUE_SAFETY_LIMITS.maxDepth)],
    [
      "maximum-json-nodes",
      Array.from({ length: EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes - 1 }, () => null),
    ],
    ["maximum-string-code-units", "a".repeat(EXPECTED_VALUE_SAFETY_LIMITS.maxStringCodeUnits)],
    [
      "maximum-json-object-nodes",
      wideResolvedObject(EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes - 1),
    ],
  ];
  const rejected = [
    ["above-maximum-depth", nestedResolvedValue(EXPECTED_VALUE_SAFETY_LIMITS.maxDepth + 1)],
    [
      "above-maximum-json-nodes",
      Array.from({ length: EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes }, () => null),
    ],
    [
      "above-maximum-string-code-units",
      "a".repeat(EXPECTED_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1),
    ],
    [
      "above-maximum-json-object-nodes",
      wideResolvedObject(EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes),
    ],
  ];
  const acceptedEvidence = accepted.map(([id, value]) => {
    assertSuccess(api.validateDesenExecutionValue(value, selector, catalogSet), id);
    return Object.freeze({ id, valid: true });
  });
  const rejectedEvidence = rejected.map(([id, value]) => {
    const result = assertFailure(
      api.validateDesenExecutionValue(value, selector, catalogSet),
      [{ code: "OPERATION_OUTPUT_INVALID", pointer: "" }],
      id,
    );
    return Object.freeze({ id, diagnostics: Object.freeze(diagnosticIdentity(result)) });
  });

  let sharedContainerDag = null;
  let ownKeyInspections = 0;
  for (let level = 0; level < 30; level += 1) {
    const shared = [sharedContainerDag, sharedContainerDag];
    sharedContainerDag = new Proxy(shared, {
      ownKeys(target) {
        ownKeyInspections += 1;
        if (ownKeyInspections >= EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes) {
          throw new Error("Shared-container traversal exceeded its proof bound.");
        }
        return Reflect.ownKeys(target);
      },
    });
  }
  const sharedResult = assertFailure(
    api.validateDesenExecutionValue(sharedContainerDag, selector, catalogSet),
    [{ code: "OPERATION_OUTPUT_INVALID", pointer: "" }],
    "shared-container DAG",
  );
  if (ownKeyInspections >= EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes) {
    fail(
      "EXECUTION_VALUE_BOUNDARY_WEAKENED",
      "Shared-container expansion was not bounded before canonical serialization.",
      { ownKeyInspections },
    );
  }
  rejectedEvidence.push(
    Object.freeze({
      id: "shared-container-dag-before-canonicalization",
      diagnostics: Object.freeze(diagnosticIdentity(sharedResult)),
      ownKeyInspections,
      traversalBound: EXPECTED_VALUE_SAFETY_LIMITS.maxJsonNodes,
    }),
  );

  let nestedWideValue = null;
  let descriptorInspections = 0;
  for (let level = 0; level < EXPECTED_VALUE_SAFETY_LIMITS.maxDepth; level += 1) {
    const values = Array.from({ length: 1_000 }, () => null);
    values[0] = nestedWideValue;
    nestedWideValue = new Proxy(values, {
      getOwnPropertyDescriptor(target, property) {
        descriptorInspections += 1;
        if (descriptorInspections >= 10_000) {
          throw new Error("Queued resolved-value work exceeded its proof bound.");
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
  }
  const nestedWideResult = assertFailure(
    api.validateDesenExecutionValue(nestedWideValue, selector, catalogSet),
    [{ code: "OPERATION_OUTPUT_INVALID", pointer: "" }],
    "nested-wide resolved-value frontier",
  );
  if (descriptorInspections >= 5_000) {
    fail(
      "EXECUTION_VALUE_BOUNDARY_WEAKENED",
      "Nested-wide resolved-value work was not reserved inside the public node budget.",
      { descriptorInspections },
    );
  }
  rejectedEvidence.push(
    Object.freeze({
      id: "nested-wide-frontier-reservation",
      diagnostics: Object.freeze(diagnosticIdentity(nestedWideResult)),
      descriptorInspections,
      inspectionBound: 5_000,
    }),
  );
  return Object.freeze({
    limits: EXPECTED_VALUE_SAFETY_LIMITS,
    accepted: Object.freeze(acceptedEvidence),
    rejected: Object.freeze(rejectedEvidence),
  });
}

function verifyResolvedValueHostileBoundary(api, baseCatalogSet) {
  const selector = { kind: "operation-output", capabilityId: SIGN_IN };
  let accessorInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "userId", {
    enumerable: true,
    get() {
      accessorInvoked = true;
      return "secret";
    },
  });
  const cycle = { userId: "user-1" };
  cycle.self = cycle;
  const customPrototype = Object.assign(Object.create({ inherited: true }), {
    userId: "user-1",
  });
  const cases = [
    ["accessor-without-invocation", accessor],
    ["cyclic-value", cycle],
    ["custom-prototype", customPrototype],
    ["non-finite-number", { userId: Number.NaN }],
  ];
  const rejected = cases.map(([id, value]) => {
    const result = assertFailure(
      api.validateDesenExecutionValue(value, selector, baseCatalogSet),
      [{ code: "OPERATION_OUTPUT_INVALID", pointer: "" }],
      `hostile resolved value ${id}`,
    );
    return Object.freeze({
      id,
      rejected: true,
      diagnostics: Object.freeze(diagnosticIdentity(result)),
    });
  });
  if (accessorInvoked) {
    fail(
      "EXECUTION_VALUE_BOUNDARY_WEAKENED",
      "Resolved-value containment invoked a caller-owned accessor.",
    );
  }
  return Object.freeze({
    rejectedCount: rejected.length,
    rejected: Object.freeze(rejected),
    accessorInvoked,
  });
}

function verifyObligationKinds(api, fixtures, baseCatalogSet, exampleSet) {
  const sortable = cloneJson(fixtures.sortableSource);
  const behavior = sortable.surfaces.tasks.root.behaviors[0];
  behavior.props.axis = { $ref: "context.sortAxis" };
  behavior.style = {
    base: { dropIndicator: { color: { $token: "color.drag.indicator" } } },
  };
  const inheritedResults = [
    assertSuccess(validateSource(api, sortable, exampleSet), "sortable inherited obligations"),
    assertSuccess(
      validateSource(api, fixtures.storeMapSource, exampleSet),
      "store-map inherited obligations",
    ),
  ];

  const operation = signInAction();
  operation.input = {
    email: { $ref: "context.email" },
    password: { $ref: "context.password" },
  };
  const operationResult = assertSuccess(
    validateSource(api, sourceWithActions(fixtures, [operation]), baseCatalogSet),
    "operation obligations",
  );

  const search = "com.example.search/obligations";
  const resourceCatalog = cloneJson(fixtures.validCatalog);
  addResource(
    resourceCatalog,
    search,
    {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string" } },
    },
    {},
    ["mount"],
  );
  const resourceResult = assertSuccess(
    validateSource(
      api,
      minimalSource(
        fixtures,
        node("text", TEXT, { text: "Results" }),
        {},
        {
          search: {
            use: search,
            input: { query: { $ref: "context.query" } },
            policy: "mount",
          },
        },
      ),
      createCatalogSet(api, [resourceCatalog], "resource obligation Catalog"),
    ),
    "resource obligations",
  );

  const commandResult = assertSuccess(
    validateSource(
      api,
      commandDocument(fixtures, { selectAll: { $ref: "context.selectAll" } }),
      createCatalogSet(api, [commandCatalog(fixtures)], "command obligation Catalog"),
    ),
    "command obligations",
  );

  const stateResult = assertSuccess(
    validateSource(
      api,
      sourceWithActions(
        fixtures,
        [{ type: "state.set", path: "profile.name", value: { $ref: "context.name" } }],
        {
          state: {
            profile: {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["name"],
                properties: { name: { type: "string" } },
              },
              initial: { name: "Ada" },
            },
          },
        },
      ),
      baseCatalogSet,
    ),
    "state-write obligations",
  );

  const all = [
    ...inheritedResults,
    operationResult,
    resourceResult,
    commandResult,
    stateResult,
  ].flatMap((result) => obligationIdentity(result));
  const kinds = [...new Set(all.map(({ kind }) => kind))].sort(compareText);
  assertJsonEqual(
    kinds,
    EXPECTED_OBLIGATION_KINDS,
    "T11 obligation kinds",
    "EXECUTION_OBLIGATION_DRIFT",
  );
  return Object.freeze({
    kinds: Object.freeze(kinds),
    inheritedKinds: INHERITED_OBLIGATION_KINDS,
    newExecutionKinds: NEW_EXECUTION_OBLIGATION_KINDS,
    samples: Object.freeze(
      kinds.map((kind) => Object.freeze(all.find((entry) => entry.kind === kind))),
    ),
  });
}

function reverseObjectMembers(value) {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectMembers(entry));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectMembers(child)]),
  );
}

function assertDispatcherParity(api, target, input, catalogSet, label) {
  const specialized =
    target === "source"
      ? validateSource(api, input, catalogSet)
      : validateBundle(api, input, catalogSet);
  const dispatched = api.validateDesenExecutionContracts(target, input, catalogSet);
  assertJsonEqual(dispatched, specialized, `${label} dispatcher`, "EXECUTION_DISPATCHER_DRIFT");
}

function verifyDeterminism(api, fixtures, baseCatalogSet) {
  const search = "com.example.search/determinism";
  const catalog = cloneJson(fixtures.validCatalog);
  addResource(
    catalog,
    search,
    {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string" } },
    },
    {},
    ["mount"],
  );
  const source = sourceWithActions(
    fixtures,
    [
      { type: "navigate", surface: "missing" },
      signInAction("request"),
      { type: "resource.refresh", resource: "ghost" },
    ],
    {
      resources: {
        search: {
          use: search,
          input: { query: { $ref: "context.query" } },
          policy: "mount",
        },
      },
    },
  );
  const forwardSet = createCatalogSet(api, [catalog], "determinism Catalog");
  const reversedSet = createCatalogSet(api, [reverseObjectMembers(catalog)], "reversed Catalog");
  const forward = validateSource(api, source, forwardSet);
  const reversed = validateSource(api, reverseObjectMembers(source), reversedSet);
  if (forward.valid || reversed.valid) {
    fail("EXECUTION_DETERMINISM_DRIFT", "Determinism mutation unexpectedly passed.");
  }
  assertJsonEqual(
    diagnosticIdentity(reversed),
    diagnosticIdentity(forward),
    "execution diagnostic permutation",
    "EXECUTION_DETERMINISM_DRIFT",
  );
  assertJsonEqual(
    obligationIdentity(reversed),
    obligationIdentity(forward),
    "execution obligation permutation",
    "EXECUTION_DETERMINISM_DRIFT",
  );
  assertDispatcherParity(api, "source", source, forwardSet, "failing Source");
  assertDispatcherParity(api, "bundle", fixtures.validBundle, baseCatalogSet, "valid Bundle");
  return Object.freeze({
    objectPermutation: "all object members recursively reversed; array order preserved",
    diagnostics: Object.freeze(diagnosticIdentity(forward)),
    obligations: Object.freeze(obligationIdentity(forward)),
    dispatcherTargets: Object.freeze(["source", "bundle"]),
  });
}

function verifyScopeFences(api, fixtures, baseCatalogSet) {
  const actions = [
    signInAction("shared"),
    { ...signInAction("shared"), concurrency: "replace" },
    { ...signInAction("shared"), concurrency: "queue" },
  ];
  for (let index = 0; index < 65; index += 1) {
    actions.push({ type: "event.emit", name: `host-event-${String(index)}`, payload: { index } });
  }
  assertSuccess(
    validateSource(api, sourceWithActions(fixtures, actions), baseCatalogSet),
    "runtime policy scope fence",
  );
  return Object.freeze([
    Object.freeze({ id: "event-allowlist", owner: "M04/runtime", accepted: true }),
    Object.freeze({ id: "operation-concurrency", owner: "M04/runtime", accepted: true }),
    Object.freeze({ id: "action-turn-limit", owner: "M04/runtime", accepted: true }),
    Object.freeze({ id: "adapter-execution", owner: "M04/M05", executed: false }),
  ]);
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
        fail("EXECUTION_DISTRIBUTION_DRIFT", `Symlink found in production inventory: ${filePath}`);
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
    if (pattern.test(source)) fail("EXECUTION_PLATFORM_AUDIT_FAILED", `${label} contains ${name}.`);
  }
  for (const specifier of importSpecifiers(source)) {
    if (specifier.startsWith(".") || allowedBare.includes(specifier)) continue;
    fail("EXECUTION_PLATFORM_AUDIT_FAILED", `${label} imports unapproved ${specifier}.`);
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
        fail("EXECUTION_DISTRIBUTION_DRIFT", `${packageName} is missing ${expected}.`);
      }
    }
  }
  assertJsonEqual(
    [...distributionNames].sort(compareText),
    [...expectedDistributionNames].sort(compareText),
    `${packageName} source/distribution inventory`,
    "EXECUTION_DISTRIBUTION_DRIFT",
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
    adapterExecution: false,
    remoteSchemaResolution: false,
    platform: "ECMAScript 2023; no Node, React, DOM, CSS, or browser API in production source",
  });
}

async function trackedImplementationFiles(platformAudit) {
  const dynamic = [];
  for (const [packageName, inventory] of Object.entries(platformAudit.packages)) {
    for (const relative of inventory.sourceFiles)
      dynamic.push(`packages/${packageName}/src/${relative}`);
    for (const relative of inventory.distributionFiles)
      dynamic.push(`packages/${packageName}/dist/${relative}`);
  }
  const paths = [...new Set([...FIXED_TRACKED_PATHS, ...dynamic])].sort(compareText);
  const tracked = [];
  for (const relativePath of paths) {
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
        "EXECUTION_ARTIFACT_UNSUPPORTED_ENTRY",
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
      "EXECUTION_ARTIFACT_UNSUPPORTED_ENTRY",
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
      `.${basename}.${String(process.pid)}.${randomBytes(8).toString("hex")}.tmp`,
    );
    try {
      const handle = await open(temporaryPath, "wx", 0o600);
      return { handle, temporaryPath };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  fail("EXECUTION_ARTIFACT_TEMPORARY_CREATE_FAILED", "Could not reserve a temporary file.");
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T11 execution-contract evidence entirely in memory. */
export async function buildProtocolExecutionContractsEvidence({
  tracePath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_TRACE_PATH,
  normativeCoveragePath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_NORMATIVE_PATH,
  findingsPath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_FINDINGS_PATH,
  executionSourcePath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_SOURCE_PATH,
  bindingArtifactPath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
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
  const sourceProfile = await verifyExecutionSource(executionSourcePath);
  const prerequisite = await verifyBindingPrerequisite(bindingArtifactPath);
  const fixtures = await loadFrozenFixtures();
  const catalogTrustFence = verifyCatalogTrustFence(api, fixtures);
  const conformanceSet = createCatalogSet(api, [fixtures.validCatalog], "frozen execution Catalog");
  const exampleSet = createCatalogSet(api, [fixtures.exampleCatalog], "example execution Catalog");
  const frozenValidation = await verifyFrozenCorpus(api, fixtures, conformanceSet, exampleSet);
  const schemaSafety = verifySchemaSafety(api, fixtures);
  const resources = verifyResourceGoldens(api, fixtures, conformanceSet);
  const lifecycleReferences = verifyLifecycleReferenceGoldens(api, fixtures, conformanceSet);
  const operations = verifyOperationGoldens(api, fixtures, conformanceSet);
  const actionTargets = verifyActionTargetGoldens(api, fixtures, conformanceSet);
  const commands = verifyCommandGoldens(api, fixtures);
  const stateActions = verifyStateActionGoldens(api, fixtures, conformanceSet);
  const resolvedValues = verifyResolvedValueGoldens(api, fixtures, conformanceSet);
  const resolvedValueSafety = verifyResolvedValueSafety(api, fixtures);
  const resolvedValueHostileBoundary = verifyResolvedValueHostileBoundary(api, conformanceSet);
  const obligations = verifyObligationKinds(api, fixtures, conformanceSet, exampleSet);
  const determinism = verifyDeterminism(api, fixtures, conformanceSet);
  const laterTaskScopeAccepted = verifyScopeFences(api, fixtures, conformanceSet);
  const platformAudit = await verifyPlatformAndDistributionAudit();
  const trackedFiles = await trackedImplementationFiles(platformAudit);
  const projectMutationGoldens =
    resources.rejected.length +
    lifecycleReferences.rejected.length +
    operations.rejected.length +
    actionTargets.rejected.length +
    commands.rejected.length +
    stateActions.rejected.length +
    resolvedValues.rejected.length;
  if (projectMutationGoldens !== 42) {
    fail("EXECUTION_GOLDEN_COUNT_DRIFT", "The reviewed T11 mutation count changed.", {
      expected: 42,
      actual: projectMutationGoldens,
    });
  }

  const artifact = {
    schemaVersion: 1,
    task: "M02-T11",
    profile: "desen-execution-contract-validation-v1",
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
    prerequisite: { bindingContracts: prerequisite },
    traceability: {
      schemaFamilies: trace.families,
      schemaFamilyCount: trace.families.length,
      schemaConstraints: trace.constraintCount,
      conformanceResponsibilities: [],
      proseRules: EXPECTED_PROSE_RULES,
      invariants: EXPECTED_INVARIANTS,
      mandatoryClauses,
      ownedCoreDiagnostics: EXPECTED_CORE_DIAGNOSTICS,
      reusedCoreDiagnostics: REUSED_CORE_DIAGNOSTICS,
      implementationDiagnostic: EXPECTED_EXECUTION_DIAGNOSTIC,
      implementationFindings: findings,
    },
    publicApi: {
      exports: publicExports,
      cumulativeBoundary: sourceProfile.cumulativeBoundary,
      trustedCatalogSet: catalogTrustFence.requiredStage,
      successValue: "independent recursively frozen JSON snapshot",
      failureValue: "no trusted document or resolved value",
      obligationKinds: EXPECTED_OBLIGATION_KINDS,
      inheritedObligationKinds: INHERITED_OBLIGATION_KINDS,
      newExecutionObligationKinds: NEW_EXECUTION_OBLIGATION_KINDS,
      resolvedValueSelectorKinds: EXPECTED_VALUE_SELECTOR_KINDS,
      resolvedValueMode: sourceProfile.resolvedValueMode,
    },
    frozenValidation,
    schemaSafety,
    resources,
    lifecycleReferences,
    operations,
    actionTargets,
    commands,
    stateActions,
    resolvedValues,
    obligations,
    laterTaskScopeAccepted,
    determinism,
    security: {
      rawDocuments: "re-enter the cumulative T06→T10 immutable trust boundary",
      catalogTrustFence,
      catalogSchemas: sourceProfile.catalogSchemas,
      resolvedValues: {
        mode: "complete resolved inert JSON; ValueSpec-shaped members are ordinary data",
        safety: resolvedValueSafety,
        hostileBoundary: resolvedValueHostileBoundary,
      },
      schemaProfile: {
        inheritedFromVerifiedT10Artifact: prerequisite.sha256,
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
        "pnpm generate:protocol-execution-contracts",
        "pnpm verify:protocol-execution-contracts",
        "pnpm test:protocol-execution-contracts",
        "pnpm check",
      ],
      commandWiring,
      projectMutationGoldens,
      forgedLowerStageCatalogEntryPoints: catalogTrustFence.rejectedEntryPointCount,
      resolvedValueHostileRejected: resolvedValueHostileBoundary.rejectedCount,
      artifactWriter: {
        parentResolution: "realpath",
        temporaryFile: "same-directory exclusive create",
        durabilityBeforeCommit: "file sync",
        commit: "atomic rename",
        failureCleanup: "temporary file removed",
        rejectedDestinations: ["symlink", "directory", "special file", "symlink parent"],
      },
      independentAnchors: [
        "complete M02-T10 verifier PASS plus exact prerequisite bytes",
        "reviewed exact 9-family / 383-constraint T11 trace ownership",
        "exact 11 prose rules, two invariants, five owned core diagnostics, zero conformance rules, and zero BCP 14 clauses",
        "five frozen examples and zero official T11 invalid vectors",
        "project-owned exact-code and exact-pointer execution mutation goldens",
        "four inherited plus four new execution obligation kinds",
        "five detached resolved-value selector channels with complete inert JSON validation",
        "bounded schema preparation, resolved-value graph traversal, and four hostile-value rejections",
        "forged lower-stage catalog brands rejected at Source, Bundle, and resolved-value entry points",
        "validator and transitive protocol source/distribution inventory and platform audit",
        "same-directory exclusive temporary write followed by atomic rename",
      ],
    },
    limitations: [
      "No operation, resource, command, navigation, state action, event, adapter, or host policy is executed by this evidence boundary.",
      "Conditional or repeated component-target existence is checked statically; mounted runtime liveness remains M04/M05 work.",
      "Dynamic document values remain obligations until their resolved execution-value or post-write boundary.",
      "Operation/resource output production, transport, cancellation, caching, retries, concurrency, and reactive lifecycle remain M04 work.",
      "Publication-time obligation discharge and full catalog-lock integrity remain M06/M07 work.",
      "Official-suite parity and exhaustive diagnostic micro-vectors remain M02-T12 and M02-T13.",
      "Document-wide and runtime finite-limit proof remains M02-T13/M04/M12.",
      "This artifact does not claim adapter execution, publication, activation, G02, a Validator conformance target, or any new Proof Matrix P-* result.",
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

/** Writes deterministic M02-T11 evidence to its single tracked regular-file destination. */
export async function writeProtocolExecutionContractsEvidence({
  artifactPath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolExecutionContractsEvidence();
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
        "EXECUTION_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
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

/** Rebuilds and byte-compares tracked M02-T11 evidence without modifying it. */
export async function verifyProtocolExecutionContracts({
  artifactPath = DEFAULT_PROTOCOL_EXECUTION_CONTRACTS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolExecutionContractsEvidence();
  const actual = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actual).equals(result.artifactBytes)) {
    fail("EXECUTION_ARTIFACT_DRIFT", "Tracked M02-T11 evidence is stale or modified.", {
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(actual),
    });
  }
  return Object.freeze({
    result: "PASS",
    schemaFamilies: EXPECTED_SCHEMA_FAMILIES.length,
    schemaConstraints: EXPECTED_SCHEMA_CONSTRAINTS,
    proseRules: EXPECTED_PROSE_RULES.length,
    invariants: EXPECTED_INVARIANTS.length,
    ownedCoreDiagnostics: EXPECTED_CORE_DIAGNOSTICS.length,
    conformanceResponsibilities: 0,
    mandatoryClauses: 0,
    officialT11Invalid: result.artifact.frozenValidation.officialT11Invalid.length,
    projectMutationGoldens: result.artifact.verification.projectMutationGoldens,
    schemaSafetyAccepted: result.artifact.schemaSafety.accepted.length,
    schemaSafetyRejected: result.artifact.schemaSafety.rejected.length,
    resolvedValueSafetyAccepted: result.artifact.security.resolvedValues.safety.accepted.length,
    resolvedValueSafetyRejected: result.artifact.security.resolvedValues.safety.rejected.length,
    resolvedValueHostileRejected:
      result.artifact.security.resolvedValues.hostileBoundary.rejectedCount,
    forgedLowerStageCatalogEntryPoints:
      result.artifact.security.catalogTrustFence.rejectedEntryPointCount,
    inheritedObligationKinds: INHERITED_OBLIGATION_KINDS.length,
    newExecutionObligationKinds: NEW_EXECUTION_OBLIGATION_KINDS.length,
    obligationKinds: EXPECTED_OBLIGATION_KINDS.length,
    resolvedValueSelectorKinds: EXPECTED_VALUE_SELECTOR_KINDS.length,
    examples: FROZEN_EXAMPLES.length,
    artifactSha256: result.artifactSha256,
  });
}
