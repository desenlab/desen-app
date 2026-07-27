import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
  verifyProtocolInteractionContracts,
} from "./protocol-interaction-contracts-proof.mjs";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T10 evidence artifact. */
export const DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-binding-contracts.json",
);
const HISTORICAL_ARTIFACT_SHA256 =
  "2ffa1b874bae23df8ba3e0e0334b3f0b6739ec4dfd6acc9e2aabf1c87ce9c39c";

/** Absolute path to the reviewed protocol trace ledger used by M02-T10 evidence. */
export const DEFAULT_PROTOCOL_BINDING_CONTRACTS_TRACE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/protocol-0.1.0-traceability.json",
);

/** Absolute path to the BCP 14 ownership ledger used by M02-T10 evidence. */
export const DEFAULT_PROTOCOL_BINDING_CONTRACTS_NORMATIVE_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/NORMATIVE-COVERAGE.md",
);

/** Absolute path to the reviewed PF-014 through PF-019 findings ledger. */
export const DEFAULT_PROTOCOL_BINDING_CONTRACTS_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/plan/PROTOCOL-FINDINGS.md",
);

/** Absolute path to the reviewed binding-contract implementation. */
export const DEFAULT_PROTOCOL_BINDING_CONTRACTS_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/validator/src/binding-contract-validation.ts",
);

const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "INVALID_BINDING_CONTRACT_CODE",
  "validateDesenBindingContracts",
  "validateDesenBundleBindingContracts",
  "validateDesenSourceBindingContracts",
]);
const EXPECTED_BINDING_DIAGNOSTIC = "run.desen.validator/INVALID_BINDING_CONTRACT";
const EXPECTED_OBLIGATION_KINDS = Object.freeze([
  "behavior-prop",
  "behavior-style-part-property",
  "component-prop",
  "style-part-property",
]);
const EXPECTED_SCHEMA_FAMILIES = Object.freeze([
  Object.freeze({ id: "SC-035", expectedConstraints: 12 }),
  Object.freeze({ id: "SC-036", expectedConstraints: 14 }),
  Object.freeze({ id: "SC-037", expectedConstraints: 12 }),
  Object.freeze({ id: "SC-038", expectedConstraints: 28 }),
  Object.freeze({ id: "SC-039", expectedConstraints: 18 }),
  Object.freeze({ id: "SC-040", expectedConstraints: 76 }),
  Object.freeze({ id: "SC-045", expectedConstraints: 22 }),
  Object.freeze({ id: "SC-046", expectedConstraints: 70 }),
  Object.freeze({ id: "SC-047", expectedConstraints: 12 }),
  Object.freeze({ id: "SC-049", expectedConstraints: 36 }),
]);
const EXPECTED_SCHEMA_CONSTRAINTS = 300;
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-026",
  "R-039",
  "R-040",
  "R-044",
  "R-045",
  "R-047",
  "R-049",
  "R-050",
  "R-051",
  "R-052",
  "R-054",
  "R-061",
]);
const EXPECTED_CORE_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-019", code: "STATE_WRITE_INVALID" }),
  Object.freeze({ id: "D-020", code: "REFERENCE_UNRESOLVED" }),
  Object.freeze({ id: "D-021", code: "PREDICATE_TYPE_MISMATCH" }),
  Object.freeze({ id: "D-022", code: "REPEAT_ITEMS_INVALID" }),
  Object.freeze({ id: "D-023", code: "REPEAT_KEY_INVALID" }),
]);
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
  "packages/validator/src/binding-contract-validation.ts",
  "packages/validator/src/interaction-contract-validation.ts",
  "packages/validator/src/schema-instance-validation.ts",
  "packages/validator/src/semantic-diagnostics.ts",
  "packages/validator/test/binding-contracts.test.ts",
  "packages/validator/test/interaction-contract-internals.test.ts",
  "packages/validator/test/schema-path-inspection.test.ts",
  "packages/validator/tsconfig.build.json",
  "packages/validator/tsconfig.json",
  "docs/proof/PROTOCOL-BINDING-CONTRACTS.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "scripts/lib/protocol-binding-contracts-proof.mjs",
  "scripts/generate-protocol-binding-contracts-proof.mjs",
  "scripts/verify-protocol-binding-contracts.mjs",
  "tests/protocol-binding-contracts.test.mjs",
]);

/** Stable failure raised when deterministic M02-T10 evidence cannot be established. */
export class ProtocolBindingContractsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProtocolBindingContractsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ProtocolBindingContractsEvidenceError(code, message, details);
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
      fail("BINDING_ARTIFACT_DRIFT", "Immutable M02-T10 evidence is missing.", {
        cause: String(error),
      });
    }
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(
        "BINDING_ARTIFACT_UNSUPPORTED_ENTRY",
        "Immutable M02-T10 evidence must be a regular non-symlink file.",
      );
    }
    bytes = await readFile(artifactPath);
  } else {
    bytes = Buffer.from(suppliedBytes);
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail("BINDING_ARTIFACT_DRIFT", "Immutable task-time M02-T10 evidence bytes changed.", {
      expectedSha256: HISTORICAL_ARTIFACT_SHA256,
      actualSha256,
    });
  }

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("BINDING_ARTIFACT_DRIFT", "Immutable M02-T10 evidence is not valid JSON.");
  }
  const projectMutationGoldens =
    (artifact.stateContracts?.rejected?.length ?? -1) +
    (artifact.references?.rejected?.length ?? -1) +
    (artifact.predicates?.rejected?.length ?? -1) +
    (artifact.formats?.rejected?.length ?? -1) +
    (artifact.repeats?.rejected?.length ?? -1) +
    (artifact.actionTargets?.rejected?.length ?? -1);
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M02-T10" ||
    artifact.result !== "PASS" ||
    artifact.profile !== "desen-binding-contract-validation-v1" ||
    artifact.protocolVersion !== "0.1.0" ||
    artifact.traceability?.schemaFamilies?.length !== 10 ||
    artifact.traceability?.schemaConstraints !== 300 ||
    artifact.traceability?.proseRules?.length !== 12 ||
    artifact.traceability?.ownedCoreDiagnostics?.length !== 5 ||
    artifact.frozenValidation?.officialT10Invalid?.length !== 0 ||
    artifact.frozenValidation?.validExamples?.length !== 5 ||
    projectMutationGoldens !== 48 ||
    artifact.obligationCarryForward?.kinds?.length !== 4 ||
    artifact.security?.platformAudit?.documentCodeExecution !== false
  ) {
    fail(
      "BINDING_ARTIFACT_DRIFT",
      "Immutable M02-T10 evidence no longer has its reviewed identity, inventory, or semantics.",
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function assertJsonEqual(actual, expected, label, code = "BINDING_GOLDEN_MISMATCH") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} changed.`, { expected, actual });
  }
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
    fail("BINDING_RESULT_MUTABLE", `${label} is not recursively frozen.`);
  }
  try {
    JSON.stringify(value);
  } catch {
    fail("BINDING_RESULT_NOT_JSON", `${label} is not JSON-serializable.`);
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
    result.diagnostics.length !== 0
  ) {
    fail("BINDING_PUBLIC_API_FAILURE", `${label} unexpectedly failed.`, {
      diagnostics: result?.diagnostics,
    });
  }
  assertPortableFrozen(result, label);
  return result;
}

function assertFailure(result, expected, label) {
  if (result?.valid !== false || "value" in result) {
    fail("BINDING_PUBLIC_API_WEAKENED", `${label} unexpectedly passed or exposed a value.`);
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
      fail("BINDING_PUBLIC_EXPORT_DRIFT", `Missing public export ${exportName}.`);
    }
  }
  for (const functionName of EXPECTED_RUNTIME_EXPORTS.filter((name) =>
    name.startsWith("validate"),
  )) {
    if (typeof api[functionName] !== "function") {
      fail("BINDING_PUBLIC_EXPORT_DRIFT", `${functionName} is not a function.`);
    }
  }
  if (api.INVALID_BINDING_CONTRACT_CODE !== EXPECTED_BINDING_DIAGNOSTIC) {
    fail("BINDING_PUBLIC_EXPORT_DRIFT", "The binding implementation diagnostic changed.");
  }
  if ("validateDesenBindingCatalogSet" in api) {
    fail("BINDING_PUBLIC_EXPORT_DRIFT", "T10 must not introduce a parallel catalog-set API.");
  }
  for (const inheritedName of [
    "validateDesenInteractionCatalogSet",
    "validateDesenSourceInteractionContracts",
    "validateDesenBundleInteractionContracts",
  ]) {
    if (typeof api[inheritedName] !== "function") {
      fail("BINDING_PUBLIC_EXPORT_DRIFT", `Missing inherited T09 export ${inheritedName}.`);
    }
  }
  return Object.freeze([...EXPECTED_RUNTIME_EXPORTS]);
}

async function verifyCommandWiring() {
  const root = await readJson(path.join(WORKSPACE_ROOT, "package.json"));
  const validator = await readJson(path.join(WORKSPACE_ROOT, "packages/validator/package.json"));
  const expected = {
    "generate:protocol-binding-contracts":
      "pnpm --filter @desen/validator... build && node scripts/generate-protocol-binding-contracts-proof.mjs",
    "verify:protocol-binding-contracts":
      "pnpm --filter @desen/validator... build && node scripts/verify-protocol-binding-contracts.mjs",
    "test:protocol-binding-contracts":
      "pnpm --filter @desen/validator... build && pnpm --filter @desen/validator test:binding-contracts && node --test tests/protocol-binding-contracts.test.mjs",
  };
  for (const [name, command] of Object.entries(expected)) {
    if (root.scripts?.[name] !== command) {
      fail("BINDING_COMMAND_WIRING_DRIFT", `${name} wiring changed.`, {
        expected: command,
        actual: root.scripts?.[name],
      });
    }
  }
  const packageCommand =
    "vitest run test/schema-instance-validation.test.ts test/schema-path-inspection.test.ts test/component-contracts.test.ts test/interaction-contract-internals.test.ts test/interaction-contracts.test.ts test/binding-contracts.test.ts";
  if (validator.scripts?.["test:binding-contracts"] !== packageCommand) {
    fail("BINDING_COMMAND_WIRING_DRIFT", "Package binding-test wiring changed.", {
      expected: packageCommand,
      actual: validator.scripts?.["test:binding-contracts"],
    });
  }
  for (const [scriptName, required] of [
    ["test", "pnpm test:protocol-binding-contracts"],
    ["check", "pnpm verify:protocol-binding-contracts"],
  ]) {
    if (!root.scripts?.[scriptName]?.includes(required)) {
      fail("BINDING_COMMAND_WIRING_DRIFT", `${scriptName} omits ${required}.`);
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
    .filter(({ semanticOwners }) => semanticOwners?.includes("M02-T10"))
    .map(({ id, expectedConstraints }) => ({ id, expectedConstraints }))
    .sort((left, right) => compareText(left.id, right.id));
  assertJsonEqual(
    families,
    EXPECTED_SCHEMA_FAMILIES,
    "M02-T10 schema ownership",
    "BINDING_TRACE_DRIFT",
  );
  const constraintCount = families.reduce((total, entry) => total + entry.expectedConstraints, 0);
  if (constraintCount !== EXPECTED_SCHEMA_CONSTRAINTS) {
    fail("BINDING_TRACE_DRIFT", "M02-T10 schema constraint total changed.", {
      expected: EXPECTED_SCHEMA_CONSTRAINTS,
      actual: constraintCount,
    });
  }
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T10"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "M02-T10 prose ownership",
    "BINDING_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T10"),
    [],
    "M02-T10 conformance ownership",
    "BINDING_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T10"))
    .map(({ id, anchor }) => ({ id, code: anchor }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_CORE_DIAGNOSTICS,
    "M02-T10 diagnostic ownership",
    "BINDING_TRACE_DRIFT",
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
      status: cells[4] ?? "",
    });
  }
  return rows;
}

async function verifyNormativeCoverage(normativePath) {
  const rows = parseCoverageRows(await readFile(normativePath, "utf8"));
  const owned = rows.filter(({ owners }) => owners.includes("M02-T10")).map(({ id }) => id);
  assertJsonEqual(owned, [], "M02-T10 BCP 14 ownership", "BINDING_NORMATIVE_DRIFT");
  return Object.freeze([]);
}

function findingSection(markdown, id) {
  const start = markdown.indexOf(`## ${id} `);
  if (start < 0) fail("BINDING_FINDING_DRIFT", `${id} is missing.`);
  const end = markdown.indexOf("\n## ", start + 1);
  return markdown.slice(start, end < 0 ? undefined : end).replace(/\s+/gu, " ");
}

async function verifyFindings(findingsPath) {
  const markdown = await readFile(findingsPath, "utf8");
  const anchors = {
    "PF-014": [
      "immediate ordered action turn",
      "onSuccess` and `onFailure` arrays are new settlement turns",
      "REFERENCE_UNRESOLVED` at its `$ref` member",
    ],
    "PF-015": [
      "surface-local `state`, active repeat `item`, and the immediate-handler `event` scope",
      "JSON `null` is a resolved value",
      "every applicable, locally resolvable schema branch proves the path impossible",
    ],
    "PF-016": [
      "A nested predicate has boolean result type",
      "Ordering is valid only for two numbers or two strings",
      "does not evaluate runtime truth",
    ],
    "PF-017": [
      "single-pass linear parser",
      "must exactly equal the own-property keys of `values`",
      "run.desen.validator/INVALID_BINDING_CONTRACT",
    ],
    "PF-018": [
      "`items` is evaluated in the incoming outer scope before the new alias exists",
      "type-sensitive canonical JSON identity",
      "known direct array longer than an explicit `limit`",
    ],
    "PF-019": [
      "do not perform longest-prefix matching",
      "substring before the first `.` is the complete state-entry name",
      "T10 establishes the declared first segment",
      "T11 rejects a definitely missing nested path",
    ],
  };
  for (const [id, required] of Object.entries(anchors)) {
    const section = findingSection(markdown, id);
    for (const anchor of ["- Status: OPEN", "- Blocks proof: No;", ...required]) {
      if (!section.includes(anchor)) {
        fail("BINDING_FINDING_DRIFT", `${id} no longer records a reviewed decision.`, {
          missing: anchor,
        });
      }
    }
  }
  return Object.freeze({
    eventTurn: "PF-014",
    lexicalReferences: "PF-015",
    predicates: "PF-016",
    formats: "PF-017",
    repeats: "PF-018",
    statePaths: "PF-019",
  });
}

async function verifyBindingSource(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const normalized = source.replace(/\s+/gu, " ");
  const anchors = [
    'ownValue(entry, "initial") as JsonValue, "complete", "resolved-value"',
    "validateSchemaContractGraph(schema)",
    "inspectSchemaContractPath(schema, path)",
    "const settlementScope = withoutEvent(work.scope);",
    'const stateName = path.split(".")[0]',
    "const names = parseFormatTemplate(template);",
    "canonicalizeJson(result.value)",
    "validateDesenInteractionContracts(target, input, catalogSet)",
  ];
  for (const anchor of anchors) {
    if (!normalized.includes(anchor)) {
      fail("BINDING_SOURCE_PROFILE_DRIFT", "A reviewed T10 source boundary changed.", {
        missing: anchor,
      });
    }
  }
  const parserStart = source.indexOf("function parseFormatTemplate");
  const parserEnd = source.indexOf("\n}\n\nfunction inspectFormat", parserStart);
  const parser = source.slice(parserStart, parserEnd);
  if (
    parserStart < 0 ||
    parserEnd <= parserStart ||
    /\b(?:eval|Function|RegExp)\b/u.test(parser) ||
    /\.match(?:All)?\s*\(/u.test(parser)
  ) {
    fail("BINDING_SOURCE_PROFILE_DRIFT", "The format profile is not a closed linear parser.");
  }
  return Object.freeze({
    cumulativeBoundary: "T06→T07→T08→T09→T10",
    initialValueMode: "complete resolved-value inert JSON",
    formatParser: "single-pass ASCII placeholder scanner",
    repeatKeyIdentity: "type-sensitive RFC 8785 canonical JSON",
    eventScope: "immediate handler action turn only",
  });
}

async function verifyInteractionPrerequisite(interactionArtifactPath) {
  let verification;
  try {
    verification = await verifyProtocolInteractionContracts({
      artifactPath: interactionArtifactPath,
    });
  } catch (error) {
    fail("BINDING_PREREQUISITE_DRIFT", "M02-T09 prerequisite verification failed.", {
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  const bytes = await readFile(interactionArtifactPath);
  const artifact = JSON.parse(bytes);
  if (
    artifact.task !== "M02-T09" ||
    artifact.profile !== "desen-interaction-contract-validation-v1" ||
    artifact.result !== "PASS" ||
    artifact.protocolVersion !== "0.1.0"
  ) {
    fail("BINDING_PREREQUISITE_DRIFT", "M02-T09 prerequisite metadata changed.");
  }
  const digest = sha256(bytes);
  if (verification.artifactSha256 !== digest) {
    fail("BINDING_PREREQUISITE_DRIFT", "M02-T09 verifier and prerequisite bytes disagree.");
  }
  return Object.freeze({
    task: artifact.task,
    profile: artifact.profile,
    result: artifact.result,
    verifiedBy: "verifyProtocolInteractionContracts",
    sha256: digest,
    verificationSha256: verification.artifactSha256,
  });
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
  const frozenPaths = [
    ["conformance/valid/web.catalog.json", path.join(CONFORMANCE_ROOT, "valid/web.catalog.json")],
    [
      "conformance/valid/sign-in.source.json",
      path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"),
    ],
    [
      "conformance/valid/sign-in.bundle.json",
      path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json"),
    ],
    ...FROZEN_EXAMPLES.map(({ file }) => [`examples/${file}`, path.join(EXAMPLES_ROOT, file)]),
  ];
  const frozenHashes = [];
  for (const [file, filePath] of frozenPaths) {
    const bytes = await readFile(filePath);
    frozenHashes.push(Object.freeze({ file, bytes: bytes.length, sha256: sha256(bytes) }));
  }
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
    frozenHashes: Object.freeze(frozenHashes),
  });
}

function createCatalogSet(api, catalogs, label) {
  const result = assertSuccess(api.validateDesenInteractionCatalogSet(catalogs), label);
  if (result.target !== "interaction-catalog-set") {
    fail("BINDING_PUBLIC_API_FAILURE", `${label} has the wrong target.`);
  }
  return result.value;
}

function validateSource(api, source, catalogSet) {
  return api.validateDesenSourceBindingContracts(source, catalogSet);
}

function validateBundle(api, bundle, catalogSet) {
  return api.validateDesenBundleBindingContracts(bundle, catalogSet);
}

function sourceMutation(fixtures, mutate) {
  const source = cloneJson(fixtures.validSource);
  mutate(source);
  return source;
}

function bundleMutation(fixtures, mutate) {
  const bundle = cloneJson(fixtures.validBundle);
  mutate(bundle);
  return bundle;
}

function signInSurface(document) {
  return document.surfaces["sign-in"];
}

function signInChildren(document) {
  return signInSurface(document).root.slots.default;
}

function signInEmailAction(document) {
  return signInChildren(document)[1].on.change[0];
}

function signInInvokeAction(document) {
  return signInChildren(document)[4].on.press[0];
}

function storeMapFormat(document) {
  return document.surfaces.stores.root.slots.default[0].slots.popup[0].props.text.$format;
}

function assertDispatcherParity(api, target, input, catalogSet, label) {
  const specialized =
    target === "source"
      ? validateSource(api, input, catalogSet)
      : validateBundle(api, input, catalogSet);
  const dispatched = api.validateDesenBindingContracts(target, input, catalogSet);
  assertJsonEqual(
    dispatched,
    specialized,
    `${label} dispatcher parity`,
    "BINDING_DISPATCHER_DRIFT",
  );
  return specialized;
}

async function verifyFrozenCorpus(api, fixtures, conformanceSet, exampleSet) {
  const sourceResult = assertSuccess(
    assertDispatcherParity(api, "source", fixtures.validSource, conformanceSet, "frozen Source"),
    "frozen valid Source",
  );
  const bundleResult = assertSuccess(
    assertDispatcherParity(api, "bundle", fixtures.validBundle, conformanceSet, "frozen Bundle"),
    "frozen valid Bundle",
  );
  const calls = [
    ["sign-in.source.desen.json", "source", fixtures.exampleSignInSource],
    ["sign-in.bundle.desen.json", "bundle", fixtures.exampleSignInBundle],
    ["sortable-list.source.desen.json", "source", fixtures.sortableSource],
    ["store-map.source.desen.json", "source", fixtures.storeMapSource],
  ];
  const validExamples = [{ file: "catalog.web.example.json", target: "catalog-set", valid: true }];
  for (const [file, target, document] of calls) {
    const result = assertSuccess(
      assertDispatcherParity(api, target, document, exampleSet, `frozen example ${file}`),
      `frozen example ${file}`,
    );
    validExamples.push({
      file,
      target,
      valid: true,
      obligations: obligationIdentity(result).length,
    });
  }
  const predecessor = assertFailure(
    validateSource(api, fixtures.unknownEvent, conformanceSet),
    [{ code: "UNKNOWN_EVENT", pointer: "/surfaces/home/root/slots/default/0/on/teleport" }],
    "inherited T09 unknown-event vector",
  );
  assertSuccess(
    validateBundle(api, fixtures.revisionMismatch, conformanceSet),
    "bundle revision T10 scope fence",
  );
  assertSuccess(
    validateBundle(api, fixtures.digestMismatch, conformanceSet),
    "catalog digest T10 scope fence",
  );
  return Object.freeze({
    validConformance: Object.freeze([
      Object.freeze({ file: "valid/web.catalog.json", target: "catalog-set", valid: true }),
      Object.freeze({
        file: "valid/sign-in.source.json",
        target: "source",
        valid: true,
        obligations: obligationIdentity(sourceResult).length,
      }),
      Object.freeze({
        file: "valid/sign-in.bundle.json",
        target: "bundle",
        valid: true,
        obligations: obligationIdentity(bundleResult).length,
      }),
    ]),
    validExamples: Object.freeze(validExamples.map((entry) => Object.freeze(entry))),
    officialT10Invalid: Object.freeze([]),
    inheritedT09Failure: Object.freeze({
      file: "invalid/source-unknown-event.json",
      diagnostics: Object.freeze(diagnosticIdentity(predecessor)),
    }),
    fixtureHashes: fixtures.frozenHashes,
    laterIntegrityAccepted: Object.freeze([
      Object.freeze({ id: "bundle-revision", owner: "M06-T09/M07-T02", valid: true }),
      Object.freeze({ id: "catalog-digest", owner: "M07-T03", valid: true }),
    ]),
  });
}

function verifyStateGoldens(api, fixtures, catalogSet) {
  const inertInitial = sourceMutation(fixtures, (source) => {
    signInSurface(source).state.email = {
      schema: {
        type: "object",
        required: ["$ref"],
        properties: { $ref: { type: "string" } },
        additionalProperties: false,
      },
      initial: { $ref: "state.missing" },
    };
  });
  assertSuccess(
    validateSource(api, inertInitial, catalogSet),
    "ValueSpec-shaped inert initial JSON",
  );

  const unsafeSchema = sourceMutation(fixtures, (source) => {
    signInSurface(source).state.email.schema = { type: "string", pattern: "^(a+)+$" };
  });
  const unsafeResult = assertFailure(
    validateSource(api, unsafeSchema, catalogSet),
    [
      {
        code: EXPECTED_BINDING_DIAGNOSTIC,
        pointer: "/surfaces/sign-in/state/email/schema/pattern",
      },
    ],
    "unsafe state schema",
  );

  const invalidInitial = sourceMutation(fixtures, (source) => {
    signInSurface(source).state.email.initial = 42;
  });
  const initialResult = assertFailure(
    validateSource(api, invalidInitial, catalogSet),
    [
      {
        code: EXPECTED_BINDING_DIAGNOSTIC,
        pointer: "/surfaces/sign-in/state/email/initial",
      },
    ],
    "invalid state initial value",
  );
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "frozen-valid-initials", mode: "complete resolved-value" }),
      Object.freeze({ id: "valuespec-shaped-initial-is-inert", valid: true }),
    ]),
    rejected: Object.freeze([
      Object.freeze({ id: "unsafe-state-schema", diagnostics: diagnosticIdentity(unsafeResult) }),
      Object.freeze({
        id: "invalid-state-initial",
        diagnostics: diagnosticIdentity(initialResult),
      }),
    ]),
  });
}

function referenceMutation(fixtures, configure) {
  return sourceMutation(fixtures, (source) => {
    configure(source, signInSurface(source), signInChildren(source));
  });
}

function verifyReferenceGoldens(api, fixtures, catalogSet, exampleSet) {
  const accepted = [];
  const acceptedCases = [
    ["declared-state", () => cloneJson(fixtures.validSource)],
    [
      "open-state-path",
      () =>
        referenceMutation(fixtures, (source, surface) => {
          surface.state.data = { schema: { type: "object" }, initial: {} };
          surface.root.props.gap = { $ref: "state.data.unknown" };
        }),
    ],
    [
      "ambiguous-state-path",
      () =>
        referenceMutation(fixtures, (source, surface) => {
          surface.state.data = {
            schema: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  properties: { known: { type: "string" } },
                },
                { type: "object" },
              ],
            },
            initial: { known: "x" },
          };
          surface.root.props.gap = { $ref: "state.data.unknown" };
        }),
    ],
    [
      "closed-path-fallback",
      () =>
        referenceMutation(fixtures, (source, surface) => {
          surface.state.data = {
            schema: {
              type: "object",
              additionalProperties: false,
              properties: { known: { type: "string" } },
            },
            initial: { known: "x" },
          };
          surface.root.props.gap = { $ref: "state.data.unknown", fallback: "md" };
        }),
    ],
    [
      "null-remains-resolved",
      () =>
        referenceMutation(fixtures, (source, surface) => {
          surface.state.optional = { schema: { type: ["string", "null"] }, initial: null };
          surface.root.props.gap = { $ref: "state.optional", fallback: "md" };
        }),
    ],
  ];
  for (const [id, create] of acceptedCases) {
    assertSuccess(validateSource(api, create(), catalogSet), `accepted reference ${id}`);
    accepted.push(Object.freeze({ id, valid: true }));
  }
  assertSuccess(
    validateSource(api, fixtures.sortableSource, exampleSet),
    "active repeat item reference",
  );
  accepted.push(Object.freeze({ id: "active-item-alias", valid: true }));

  const rejected = [];
  const rejectedCases = [
    [
      "missing-state",
      (source, surface) => {
        surface.root.props.gap = { $ref: "state.missing" };
      },
      "/surfaces/sign-in/root/props/gap/$ref",
    ],
    [
      "illegal-fallback-does-not-create-state",
      (source, surface) => {
        surface.root.props.gap = { $ref: "state.missing", fallback: "md" };
      },
      "/surfaces/sign-in/root/props/gap/$ref",
    ],
    [
      "closed-state-path",
      (source, surface) => {
        surface.root.props.gap = { $ref: "state.email.length" };
      },
      "/surfaces/sign-in/root/props/gap/$ref",
    ],
    [
      "event-outside-handler",
      (source, surface) => {
        surface.root.props.gap = { $ref: "event.value" };
      },
      "/surfaces/sign-in/root/props/gap/$ref",
    ],
    [
      "unknown-event-payload-path",
      (source) => {
        signInEmailAction(source).value = { $ref: "event.missing" };
      },
      "/surfaces/sign-in/root/slots/default/1/on/change/0/value/$ref",
    ],
    [
      "success-settlement-turn",
      (source) => {
        signInInvokeAction(source).onSuccess[0].params = { bad: { $ref: "event.value" } };
      },
      "/surfaces/sign-in/root/slots/default/4/on/press/0/onSuccess/0/params/bad/$ref",
    ],
    [
      "failure-settlement-turn",
      (source) => {
        signInInvokeAction(source).onFailure = [
          { type: "navigate", surface: "home", params: { bad: { $ref: "event.value" } } },
        ];
      },
      "/surfaces/sign-in/root/slots/default/4/on/press/0/onFailure/0/params/bad/$ref",
    ],
  ];
  for (const [id, configure, pointer] of rejectedCases) {
    const result = assertFailure(
      validateSource(api, referenceMutation(fixtures, configure), catalogSet),
      [{ code: "REFERENCE_UNRESOLVED", pointer }],
      `rejected reference ${id}`,
    );
    rejected.push(Object.freeze({ id, diagnostics: diagnosticIdentity(result) }));
  }
  return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
}

function predicateSource(fixtures, predicate) {
  return sourceMutation(fixtures, (source) => {
    signInSurface(source).root.when = predicate;
  });
}

function verifyPredicateGoldens(api, fixtures, catalogSet) {
  const acceptedCases = [
    ["all-booleans", { op: "all", args: [true, false] }],
    ["any-nested", { op: "any", args: [{ op: "eq", args: [1, 1] }, false] }],
    ["not-boolean", { op: "not", args: [true] }],
    ["eq-canonical-json", { op: "eq", args: [{ id: 1 }, { id: 1 }] }],
    ["neq-any-json", { op: "neq", args: [null, [1]] }],
    ["gt-numbers", { op: "gt", args: [2, 1] }],
    ["gte-strings", { op: "gte", args: ["b", "a"] }],
    ["lt-numbers", { op: "lt", args: [1, 2] }],
    ["lte-strings", { op: "lte", args: ["a", "b"] }],
    ["in-array", { op: "in", args: [1, [1, 2]] }],
    ["contains-array", { op: "contains", args: [[1, 2], 1] }],
    ["contains-string", { op: "contains", args: ["desen", "sen"] }],
    ["exists-reference", { op: "exists", args: [{ $ref: "state.email" }] }],
    ["truthy-explicit", { op: "truthy", args: [{ id: 1 }] }],
  ];
  const accepted = [];
  for (const [id, predicate] of acceptedCases) {
    assertSuccess(
      validateSource(api, predicateSource(fixtures, predicate), catalogSet),
      `accepted predicate ${id}`,
    );
    accepted.push(Object.freeze({ id, valid: true }));
  }

  const typedFallback = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.state.profile = {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" } },
      },
      initial: { name: "Ada" },
    };
    surface.root.when = {
      op: "gt",
      args: [{ $ref: "state.profile.missing", fallback: 0 }, 1],
    };
  });
  assertSuccess(validateSource(api, typedFallback, catalogSet), "typed predicate fallback");
  accepted.push(Object.freeze({ id: "ordered-typed-fallback", valid: true }));

  const rejectedCases = [
    ["ordering-left-boolean", { op: "gt", args: [true, 1] }, 0],
    ["ordering-mixed-types", { op: "lt", args: [1, "2"] }, 1],
    ["in-non-collection", { op: "in", args: [1, true] }, 1],
    ["in-string-non-string-member", { op: "in", args: [1, "123"] }, 0],
    ["contains-non-collection", { op: "contains", args: [true, 1] }, 0],
    ["contains-string-non-string-member", { op: "contains", args: ["x", 1] }, 1],
    ["all-non-boolean", { op: "all", args: [1] }, 0],
    ["any-non-boolean", { op: "any", args: [{}] }, 0],
    ["not-non-boolean", { op: "not", args: ["yes"] }, 0],
    ["exists-non-reference", { op: "exists", args: [1] }, 0],
  ];
  const rejected = [];
  for (const [id, predicate, argumentIndex] of rejectedCases) {
    const pointer = `/surfaces/sign-in/root/when/args/${String(argumentIndex)}`;
    const result = assertFailure(
      validateSource(api, predicateSource(fixtures, predicate), catalogSet),
      [{ code: "PREDICATE_TYPE_MISMATCH", pointer }],
      `rejected predicate ${id}`,
    );
    rejected.push(Object.freeze({ id, diagnostics: diagnosticIdentity(result) }));
  }

  const nullFallback = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.state.nullOnly = { schema: { type: "null" }, initial: null };
    surface.root.when = {
      op: "gt",
      args: [{ $ref: "state.nullOnly", fallback: 0 }, 1],
    };
  });
  const nullFallbackResult = assertFailure(
    validateSource(api, nullFallback, catalogSet),
    [
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/surfaces/sign-in/root/when/args/0",
      },
    ],
    "resolved null predicate operand does not select fallback",
  );
  rejected.push(
    Object.freeze({
      id: "resolved-null-does-not-select-ordered-fallback",
      diagnostics: diagnosticIdentity(nullFallbackResult),
    }),
  );
  const dynamicFallback = sourceMutation(fixtures, (source) => {
    signInSurface(source).root.when = {
      op: "gt",
      args: [{ $ref: "context.rank", fallback: {} }, 1],
    };
  });
  const dynamicFallbackResult = assertFailure(
    validateSource(api, dynamicFallback, catalogSet),
    [
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/surfaces/sign-in/root/when/args/0",
      },
    ],
    "dynamic predicate primary has an independently invalid fallback",
  );
  rejected.push(
    Object.freeze({
      id: "dynamic-primary-does-not-mask-invalid-ordered-fallback",
      diagnostics: diagnosticIdentity(dynamicFallbackResult),
    }),
  );
  const typedStateFallback = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.state.profile = {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { rank: { type: "number" } },
      },
      initial: {},
    };
    surface.root.when = {
      op: "gt",
      args: [{ $ref: "state.profile.rank", fallback: {} }, 1],
    };
  });
  const typedStateFallbackResult = assertFailure(
    validateSource(api, typedStateFallback, catalogSet),
    [
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/surfaces/sign-in/root/when/args/0",
      },
    ],
    "optional typed state path has an independently invalid fallback",
  );
  rejected.push(
    Object.freeze({
      id: "typed-state-primary-does-not-mask-invalid-fallback",
      diagnostics: diagnosticIdentity(typedStateFallbackResult),
    }),
  );

  const validMissingExists = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.state.profile = {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" } },
      },
      initial: {},
    };
    surface.root.when = { op: "exists", args: [{ $ref: "state.profile.missing" }] };
  });
  assertSuccess(
    validateSource(api, validMissingExists, catalogSet),
    "exists accepts a lexically valid missing path",
  );
  accepted.push(Object.freeze({ id: "exists-lexically-valid-missing-path", valid: true }));

  const invalidLexicalExists = sourceMutation(fixtures, (source) => {
    signInSurface(source).root.when = {
      op: "exists",
      args: [{ $ref: "state.ghost", fallback: true }],
    };
  });
  const invalidLexicalExistsResult = assertFailure(
    validateSource(api, invalidLexicalExists, catalogSet),
    [
      {
        code: "REFERENCE_UNRESOLVED",
        pointer: "/surfaces/sign-in/root/when/args/0/$ref",
      },
    ],
    "exists does not legalize an undeclared lexical reference",
  );
  rejected.push(
    Object.freeze({
      id: "exists-lexically-invalid-reference",
      diagnostics: diagnosticIdentity(invalidLexicalExistsResult),
    }),
  );

  const nestedItemFallback = repeatSource(
    fixtures,
    {
      items: [{ rank: { $ref: "context.rank", fallback: false } }],
      as: "row",
      key: "row",
      limit: 1,
    },
    (source) => {
      signInSurface(source).root.when = {
        op: "gt",
        args: [{ $ref: "item.row.rank" }, 1],
      };
    },
  );
  const nestedItemFallbackResult = assertFailure(
    validateSource(api, nestedItemFallback, catalogSet),
    [
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/surfaces/sign-in/root/when/args/0",
      },
    ],
    "nested item fallback is independently invalid for an ordered predicate",
  );
  rejected.push(
    Object.freeze({
      id: "nested-item-invalid-ordered-fallback",
      diagnostics: diagnosticIdentity(nestedItemFallbackResult),
    }),
  );
  return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
}

function formatMutation(fixtures, configure) {
  const source = cloneJson(fixtures.storeMapSource);
  configure(storeMapFormat(source));
  return source;
}

function verifyFormatGoldens(api, fixtures, exampleSet) {
  const repeated = formatMutation(fixtures, (formatSpec) => {
    formatSpec.template = "Selected store: {id} / {id}";
  });
  assertSuccess(validateSource(api, repeated, exampleSet), "repeated format placeholder");

  const prefix = "/surfaces/stores/root/slots/default/0/slots/popup/0/props/text/$format";
  const rejectedCases = [
    [
      "missing-value",
      (formatSpec) => {
        formatSpec.template = "Selected store: {id} / {name}";
      },
      `${prefix}/template`,
    ],
    [
      "unused-value",
      (formatSpec) => {
        formatSpec.values.extra = "unused";
      },
      `${prefix}/values/extra`,
    ],
    [
      "unmatched-brace",
      (formatSpec) => {
        formatSpec.template = "Selected store: {id";
      },
      `${prefix}/template`,
    ],
    [
      "nested-brace",
      (formatSpec) => {
        formatSpec.template = "Selected store: {{id}}";
      },
      `${prefix}/template`,
    ],
    [
      "expression-like-placeholder",
      (formatSpec) => {
        formatSpec.template = "Selected store: {id.constructor}";
      },
      `${prefix}/template`,
    ],
  ];
  const rejected = [];
  for (const [id, configure, pointer] of rejectedCases) {
    const result = assertFailure(
      validateSource(api, formatMutation(fixtures, configure), exampleSet),
      [{ code: EXPECTED_BINDING_DIAGNOSTIC, pointer }],
      `rejected format ${id}`,
    );
    rejected.push(Object.freeze({ id, diagnostics: diagnosticIdentity(result) }));
  }

  const inherited = formatMutation(fixtures, (formatSpec) => {
    formatSpec.template = "Selected store: {inheritedBindingName}";
    formatSpec.values = {};
  });
  const inheritedResult = withObjectPrototypeProperty("inheritedBindingName", "secret", () =>
    validateSource(api, inherited, exampleSet),
  );
  assertFailure(
    inheritedResult,
    [{ code: EXPECTED_BINDING_DIAGNOSTIC, pointer: `${prefix}/template` }],
    "inherited format value",
  );
  rejected.push(
    Object.freeze({
      id: "inherited-value-is-not-own",
      diagnostics: diagnosticIdentity(inheritedResult),
    }),
  );

  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "frozen-store-map-format", valid: true }),
      Object.freeze({ id: "repeated-placeholder", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
    parser: "single-pass; exact ASCII names; no escape or expression language",
  });
}

function repeatSource(fixtures, repeat, configure = undefined) {
  return sourceMutation(fixtures, (source) => {
    signInSurface(source).root.repeat = repeat;
    if (configure !== undefined) configure(source);
  });
}

function verifyRepeatGoldens(api, fixtures, catalogSet, exampleSet) {
  assertSuccess(
    validateSource(api, fixtures.sortableSource, exampleSet),
    "dynamic sortable repeat and active alias",
  );

  const nested = repeatSource(
    fixtures,
    {
      items: [{ id: "outer", children: [{ id: "inner" }] }],
      as: "row",
      key: { $ref: "item.row.id" },
      limit: 3,
    },
    (source) => {
      const child = signInChildren(source)[0];
      child.repeat = {
        items: { $ref: "item.row.children" },
        as: "child",
        key: { $ref: "item.child.id" },
        limit: 3,
      };
      child.props.text = { $ref: "item.row.id" };
    },
  );
  assertSuccess(validateSource(api, nested, catalogSet), "nested outer and inner repeat aliases");

  const typeSensitive = repeatSource(fixtures, {
    items: [{ key: 1 }, { key: "1" }],
    as: "row",
    key: { $ref: "item.row.key" },
    limit: 2,
  });
  assertSuccess(validateSource(api, typeSensitive, catalogSet), "type-sensitive repeat keys");

  const empty = repeatSource(fixtures, {
    items: [],
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 1,
  });
  assertSuccess(validateSource(api, empty, catalogSet), "empty repeat lexical alias");

  const fallbackItems = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.state.holder = {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { present: { type: "array" } },
      },
      initial: {},
    };
    surface.root.repeat = {
      items: { $ref: "state.holder.missing", fallback: [{ id: "fallback" }] },
      as: "row",
      key: { $ref: "item.row.id" },
      limit: 1,
    };
  });
  assertSuccess(validateSource(api, fallbackItems, catalogSet), "typed repeat fallback");

  const partialDynamic = repeatSource(fixtures, {
    items: [
      { id: "a", label: { $ref: "context.first" } },
      { id: "b", label: { $ref: "context.second" } },
    ],
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 2,
  });
  assertSuccess(
    validateSource(api, partialDynamic, catalogSet),
    "partial-dynamic literal repeat with unique keys",
  );

  const dynamicKey = repeatSource(fixtures, {
    items: [{ id: { $ref: "context.dynamicKey" } }],
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 1,
  });
  assertSuccess(validateSource(api, dynamicKey, catalogSet), "deferred dynamic repeat key");

  const dynamicKeyWithOuterFallback = repeatSource(fixtures, {
    items: [{ id: { $ref: "context.firstKey" } }, { id: { $ref: "context.secondKey" } }],
    as: "row",
    key: { $ref: "item.row.id", fallback: "fallback" },
    limit: 2,
  });
  assertSuccess(
    validateSource(api, dynamicKeyWithOuterFallback, catalogSet),
    "dynamic repeat key defers outer fallback selection",
  );

  const rejectedCases = [
    [
      "non-array-items",
      () => repeatSource(fixtures, { items: "not-an-array", as: "row", key: "key", limit: 1 }),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/sign-in/root/repeat/items",
    ],
    [
      "explicit-limit-overflow",
      () =>
        repeatSource(fixtures, {
          items: [{ id: "a" }, { id: "b" }],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 1,
        }),
      EXPECTED_BINDING_DIAGNOSTIC,
      "/surfaces/sign-in/root/repeat/limit",
    ],
    [
      "self-reference-in-items",
      () =>
        repeatSource(fixtures, {
          items: { $ref: "item.row.children" },
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 3,
        }),
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/repeat/items/$ref",
    ],
    [
      "missing-key",
      () =>
        repeatSource(fixtures, {
          items: [{}],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 1,
        }),
      "REPEAT_KEY_INVALID",
      "/surfaces/sign-in/root/repeat/key",
    ],
    [
      "non-scalar-key",
      () =>
        repeatSource(fixtures, {
          items: [{ id: { nested: true } }],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 1,
        }),
      "REPEAT_KEY_INVALID",
      "/surfaces/sign-in/root/repeat/key",
    ],
    [
      "duplicate-key",
      () =>
        repeatSource(fixtures, {
          items: [{ id: "same" }, { id: "same" }],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 2,
        }),
      "REPEAT_KEY_INVALID",
      "/surfaces/sign-in/root/repeat/key",
    ],
    [
      "nested-alias-shadow",
      () =>
        repeatSource(
          fixtures,
          {
            items: [{ id: "outer" }],
            as: "row",
            key: { $ref: "item.row.id" },
            limit: 1,
          },
          (source) => {
            signInChildren(source)[0].repeat = {
              items: [{ id: "inner" }],
              as: "row",
              key: { $ref: "item.row.id" },
              limit: 1,
            };
          },
        ),
      EXPECTED_BINDING_DIAGNOSTIC,
      "/surfaces/sign-in/root/slots/default/0/repeat/as",
    ],
    [
      "sibling-alias-leak",
      () =>
        sourceMutation(fixtures, (source) => {
          const children = signInChildren(source);
          children[0].repeat = {
            items: [{ id: "first" }],
            as: "row",
            key: { $ref: "item.row.id" },
            limit: 1,
          };
          children[1].props.value = { $ref: "item.row.id" };
        }),
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
    ],
    [
      "resolved-null-items-do-not-select-fallback",
      () =>
        sourceMutation(fixtures, (source) => {
          const surface = signInSurface(source);
          surface.state.nullOnly = { schema: { type: "null" }, initial: null };
          surface.root.repeat = {
            items: { $ref: "state.nullOnly", fallback: [{ id: "fallback" }] },
            as: "row",
            key: { $ref: "item.row.id" },
            limit: 1,
          };
        }),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/sign-in/root/repeat/items",
    ],
    [
      "non-array-repeat-fallback",
      () =>
        sourceMutation(fixtures, (source) => {
          const surface = signInSurface(source);
          surface.state.holder = {
            schema: {
              type: "object",
              additionalProperties: false,
              properties: { present: { type: "array" } },
            },
            initial: {},
          };
          surface.root.repeat = {
            items: { $ref: "state.holder.missing", fallback: "not-an-array" },
            as: "row",
            key: "key",
            limit: 1,
          };
        }),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/sign-in/root/repeat/items",
    ],
    [
      "partial-dynamic-duplicate-key",
      () =>
        repeatSource(fixtures, {
          items: [
            { id: "same", label: { $ref: "context.first" } },
            { id: "same", label: { $ref: "context.second" } },
          ],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 2,
        }),
      "REPEAT_KEY_INVALID",
      "/surfaces/sign-in/root/repeat/key",
    ],
    [
      "partial-dynamic-limit-overflow",
      () =>
        repeatSource(fixtures, {
          items: [
            { id: "a", label: { $ref: "context.first" } },
            { id: "b", label: { $ref: "context.second" } },
          ],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 1,
        }),
      EXPECTED_BINDING_DIAGNOSTIC,
      "/surfaces/sign-in/root/repeat/limit",
    ],
    [
      "dynamic-primary-does-not-mask-non-array-fallback",
      () =>
        repeatSource(fixtures, {
          items: { $ref: "resource.rows.value", fallback: "not-an-array" },
          as: "row",
          key: { $ref: "context.rowKey" },
          limit: 2,
        }),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/sign-in/root/repeat/items",
    ],
    [
      "literal-dynamic-members-still-have-static-length",
      () =>
        repeatSource(fixtures, {
          items: [{ $ref: "context.first" }, { $ref: "context.second" }],
          as: "row",
          key: { $ref: "context.rowKey" },
          limit: 1,
        }),
      EXPECTED_BINDING_DIAGNOSTIC,
      "/surfaces/sign-in/root/repeat/limit",
    ],
    [
      "partially-missing-item-body-path",
      () =>
        sourceMutation(fixtures, (source) => {
          const child = signInChildren(source)[0];
          child.repeat = {
            items: [{ id: "a" }, { id: "b", title: "available" }],
            as: "row",
            key: { $ref: "item.row.id" },
            limit: 2,
          };
          child.props.text = { $ref: "item.row.title" };
        }),
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/0/props/text/$ref",
    ],
    [
      "nested-item-invalid-key-fallback",
      () =>
        repeatSource(fixtures, {
          items: [{ id: { $ref: "context.id", fallback: {} } }],
          as: "row",
          key: { $ref: "item.row.id" },
          limit: 1,
        }),
      "REPEAT_KEY_INVALID",
      "/surfaces/sign-in/root/repeat/key",
    ],
  ];
  const rejected = [];
  for (const [id, create, code, pointer] of rejectedCases) {
    const result = assertFailure(
      validateSource(api, create(), catalogSet),
      [{ code, pointer }],
      `rejected repeat ${id}`,
    );
    rejected.push(Object.freeze({ id, diagnostics: diagnosticIdentity(result) }));
  }
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "frozen-dynamic-sortable", owner: "M04-T07", valid: true }),
      Object.freeze({ id: "nested-outer-inner-alias", valid: true }),
      Object.freeze({ id: "type-sensitive-number-string-keys", valid: true }),
      Object.freeze({ id: "empty-repeat-alias", valid: true }),
      Object.freeze({ id: "typed-fallback-items", valid: true }),
      Object.freeze({ id: "partial-dynamic-static-keys", valid: true }),
      Object.freeze({ id: "dynamic-key-deferred", owner: "M04-T07", valid: true }),
      Object.freeze({ id: "dynamic-key-outer-fallback-deferred", owner: "M04-T07", valid: true }),
    ]),
    rejected: Object.freeze(rejected),
  });
}

function verifyActionTargetGoldens(api, fixtures, catalogSet) {
  const nestedKnown = sourceMutation(fixtures, (source) => {
    signInEmailAction(source).path = "email.nested.path";
  });
  assertSuccess(validateSource(api, nestedKnown, catalogSet), "known first state path segment");

  const numericToggle = sourceMutation(fixtures, (source) => {
    signInSurface(source).state.count = { schema: { type: "number" }, initial: 1 };
    signInChildren(source)[1].on.change[0] = { type: "state.toggle", path: "count" };
  });
  assertSuccess(
    validateSource(api, numericToggle, catalogSet),
    "deferred non-boolean state toggle",
  );

  const unknown = sourceMutation(fixtures, (source) => {
    signInEmailAction(source).path = "missing.deep";
  });
  const unknownResult = assertFailure(
    validateSource(api, unknown, catalogSet),
    [
      {
        code: "STATE_WRITE_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/path",
      },
    ],
    "unknown first state path segment",
  );

  const dottedDeclaration = sourceMutation(fixtures, (source) => {
    signInSurface(source).state["profile.name"] = { schema: { type: "string" }, initial: "x" };
    signInEmailAction(source).path = "profile.name";
  });
  const dottedResult = assertFailure(
    validateSource(api, dottedDeclaration, catalogSet),
    [
      {
        code: "STATE_WRITE_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/path",
      },
    ],
    "unaddressable dotted state declaration",
  );
  return Object.freeze({
    accepted: Object.freeze([
      Object.freeze({ id: "declared-first-segment", valid: true }),
      Object.freeze({
        id: "nested-state-write-deferred",
        owner: "M02-T11/M04-T06",
        valid: true,
      }),
      Object.freeze({ id: "toggle-type-deferred", owner: "M02-T11/M04-T06", valid: true }),
    ]),
    rejected: Object.freeze([
      Object.freeze({
        id: "unknown-first-segment",
        diagnostics: diagnosticIdentity(unknownResult),
      }),
      Object.freeze({
        id: "no-longest-prefix-for-dotted-declaration",
        diagnostics: diagnosticIdentity(dottedResult),
      }),
    ]),
  });
}

function verifyObligationCarryForward(api, fixtures, conformanceSet, exampleSet) {
  const sortable = cloneJson(fixtures.sortableSource);
  const behavior = sortable.surfaces.tasks.root.behaviors[0];
  behavior.props.axis = { $ref: "context.sortAxis" };
  behavior.style = {
    base: { dropIndicator: { color: { $token: "color.drag.indicator" } } },
  };
  const sortableInteraction = assertSuccess(
    api.validateDesenSourceInteractionContracts(sortable, exampleSet),
    "sortable interaction obligations",
  );
  const sortableBinding = assertSuccess(
    validateSource(api, sortable, exampleSet),
    "sortable binding obligations",
  );
  assertJsonEqual(
    obligationIdentity(sortableBinding),
    obligationIdentity(sortableInteraction),
    "sortable obligation carry-forward",
    "BINDING_OBLIGATION_DRIFT",
  );

  const storeInteraction = assertSuccess(
    api.validateDesenSourceInteractionContracts(fixtures.storeMapSource, exampleSet),
    "store-map interaction obligations",
  );
  const storeBinding = assertSuccess(
    validateSource(api, fixtures.storeMapSource, exampleSet),
    "store-map binding obligations",
  );
  assertJsonEqual(
    obligationIdentity(storeBinding),
    obligationIdentity(storeInteraction),
    "store-map obligation carry-forward",
    "BINDING_OBLIGATION_DRIFT",
  );
  const kinds = [
    ...new Set(
      [...obligationIdentity(sortableBinding), ...obligationIdentity(storeBinding)].map(
        ({ kind }) => kind,
      ),
    ),
  ].sort(compareText);
  assertJsonEqual(
    kinds,
    EXPECTED_OBLIGATION_KINDS,
    "T09 obligation kinds",
    "BINDING_OBLIGATION_DRIFT",
  );

  const failingSource = sourceMutation(fixtures, (source) => {
    signInEmailAction(source).path = "missing";
  });
  const sourceInteraction = assertSuccess(
    api.validateDesenSourceInteractionContracts(failingSource, conformanceSet),
    "source predecessor before binding failure",
  );
  const sourceBinding = assertFailure(
    validateSource(api, failingSource, conformanceSet),
    [
      {
        code: "STATE_WRITE_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/path",
      },
    ],
    "source binding failure with inherited obligations",
  );
  assertJsonEqual(
    obligationIdentity(sourceBinding),
    obligationIdentity(sourceInteraction),
    "Source failure obligation carry-forward",
    "BINDING_OBLIGATION_DRIFT",
  );

  const failingBundle = bundleMutation(fixtures, (bundle) => {
    signInEmailAction(bundle).path = "missing";
  });
  const bundleInteraction = assertSuccess(
    api.validateDesenBundleInteractionContracts(failingBundle, conformanceSet),
    "Bundle predecessor before binding failure",
  );
  const bundleBinding = assertFailure(
    validateBundle(api, failingBundle, conformanceSet),
    [
      {
        code: "STATE_WRITE_INVALID",
        pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/path",
      },
    ],
    "Bundle binding failure with inherited obligations",
  );
  assertJsonEqual(
    obligationIdentity(bundleBinding),
    obligationIdentity(bundleInteraction),
    "Bundle failure obligation carry-forward",
    "BINDING_OBLIGATION_DRIFT",
  );

  return Object.freeze({
    kinds: Object.freeze(kinds),
    sortableOrder: Object.freeze(obligationIdentity(sortableBinding)),
    storeMapOrder: Object.freeze(obligationIdentity(storeBinding)),
    sourceFailure: Object.freeze({
      diagnostics: Object.freeze(diagnosticIdentity(sourceBinding)),
      obligations: Object.freeze(obligationIdentity(sourceBinding)),
    }),
    bundleFailure: Object.freeze({
      diagnostics: Object.freeze(diagnosticIdentity(bundleBinding)),
      obligations: Object.freeze(obligationIdentity(bundleBinding)),
    }),
  });
}

function verifyLaterTaskFences(api, fixtures, catalogSet, exampleSet) {
  const cases = [
    {
      id: "resource-reference",
      owner: "M02-T11/M04-T08",
      document: referenceMutation(fixtures, (source, surface) => {
        surface.root.props.gap = { $ref: "resource.remote.value" };
      }),
      catalogSet,
    },
    {
      id: "operation-reference",
      owner: "M02-T11/M04-T09",
      document: referenceMutation(fixtures, (source, surface) => {
        surface.root.props.gap = { $ref: "operation.pending.status" };
      }),
      catalogSet,
    },
    {
      id: "context-reference",
      owner: "M04-T01/M04-T02",
      document: referenceMutation(fixtures, (source, surface) => {
        surface.root.props.gap = { $ref: "context.spacing" };
      }),
      catalogSet,
    },
    {
      id: "environment-reference",
      owner: "M04-T01/M04-T02",
      document: referenceMutation(fixtures, (source, surface) => {
        surface.root.props.gap = { $ref: "env.spacing" };
      }),
      catalogSet,
    },
    {
      id: "dynamic-repeat-materialization",
      owner: "M04-T07/M05-T05",
      document: fixtures.sortableSource,
      catalogSet: exampleSet,
    },
  ];
  for (const entry of cases) {
    assertSuccess(validateSource(api, entry.document, entry.catalogSet), `scope fence ${entry.id}`);
  }
  return Object.freeze(cases.map(({ id, owner }) => Object.freeze({ id, owner, valid: true })));
}

function verifyDeterminism(api, fixtures, catalogSet) {
  const mutation = sourceMutation(fixtures, (source) => {
    const surface = signInSurface(source);
    surface.root.when = { op: "gt", args: [true, 1] };
    surface.root.props.gap = { $ref: "state.missing" };
    surface.root.repeat = { items: "not-array", as: "row", key: "key", limit: 1 };
    signInEmailAction(source).path = "missing";
  });
  const forward = validateSource(api, mutation, catalogSet);
  const reversedCatalogSet = createCatalogSet(
    api,
    [reverseObjectMembers(fixtures.validCatalog)],
    "reversed Catalog",
  );
  const reversed = validateSource(api, reverseObjectMembers(mutation), reversedCatalogSet);
  if (forward.valid || reversed.valid) {
    fail("BINDING_DETERMINISM_DRIFT", "Determinism mutation unexpectedly passed.");
  }
  assertJsonEqual(
    diagnosticIdentity(reversed),
    diagnosticIdentity(forward),
    "binding diagnostic permutation",
    "BINDING_DETERMINISM_DRIFT",
  );
  assertJsonEqual(
    obligationIdentity(reversed),
    obligationIdentity(forward),
    "binding obligation permutation",
    "BINDING_DETERMINISM_DRIFT",
  );
  assertDispatcherParity(api, "source", mutation, catalogSet, "failing Source");
  assertDispatcherParity(api, "bundle", fixtures.validBundle, catalogSet, "valid Bundle");
  return Object.freeze({
    objectPermutation: "all object members recursively reversed; array order preserved",
    diagnostics: Object.freeze(diagnosticIdentity(forward)),
    obligationsEqual: true,
    dispatcherTargets: Object.freeze(["source", "bundle"]),
  });
}

function verifyHostileBoundary(api, fixtures, catalogSet) {
  const callerOwned = cloneJson(fixtures.validSource);
  const result = assertSuccess(
    validateSource(api, callerOwned, catalogSet),
    "detached Source result",
  );
  const originalId = result.value.id;
  callerOwned.id = "mutated.after.validation";
  callerOwned.surfaces["sign-in"].state.email.initial = "changed";
  if (
    result.value.id !== originalId ||
    result.value.surfaces["sign-in"].state.email.initial !== ""
  ) {
    fail("BINDING_RESULT_RETAINED_INPUT", "A successful result retained caller-owned data.");
  }

  const cycle = cloneJson(fixtures.validSource);
  cycle.extensions.cycle = cycle;
  const cycleResult = validateSource(api, cycle, catalogSet);
  if (cycleResult.valid || "value" in cycleResult) {
    fail("BINDING_PUBLIC_API_WEAKENED", "A cyclic raw document crossed the trust boundary.");
  }
  assertPortableFrozen(cycleResult, "cyclic document failure");

  const customPrototype = cloneJson(fixtures.validSource);
  Object.setPrototypeOf(customPrototype.surfaces, {
    inheritedSurface: signInSurface(customPrototype),
  });
  const prototypeResult = validateSource(api, customPrototype, catalogSet);
  if (prototypeResult.valid || "value" in prototypeResult) {
    fail(
      "BINDING_PUBLIC_API_WEAKENED",
      "A custom-prototype raw document crossed the trust boundary.",
    );
  }
  assertPortableFrozen(prototypeResult, "custom-prototype document failure");

  const inheritedRepeatResult = withObjectPrototypeProperty(
    "repeat",
    { items: "not-an-array", as: "inherited", key: "key", limit: 1 },
    () => validateSource(api, cloneJson(fixtures.validSource), catalogSet),
  );
  assertSuccess(inheritedRepeatResult, "prototype-inherited optional repeat field is ignored");
  return Object.freeze({
    detachedSnapshot: true,
    deepFrozen: true,
    cycleRejected: true,
    customPrototypeRejected: true,
    formatOwnPropertiesOnly: true,
    inheritedOptionalFieldsIgnored: true,
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
        fail("BINDING_DISTRIBUTION_DRIFT", `Symlink found in production inventory: ${filePath}`);
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
      fail("BINDING_PLATFORM_AUDIT_FAILED", `${label} contains ${name}.`);
    }
  }
  for (const specifier of importSpecifiers(source)) {
    if (specifier.startsWith(".") || allowedBare.includes(specifier)) continue;
    fail("BINDING_PLATFORM_AUDIT_FAILED", `${label} imports unapproved ${specifier}.`);
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
        fail("BINDING_DISTRIBUTION_DRIFT", `${packageName} is missing ${expected}.`);
      }
    }
  }
  assertJsonEqual(
    [...distributionNames].sort(compareText),
    [...expectedDistributionNames].sort(compareText),
    `${packageName} source/distribution inventory`,
    "BINDING_DISTRIBUTION_DRIFT",
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
    formatExpressionEvaluation: false,
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
        "BINDING_ARTIFACT_UNSUPPORTED_ENTRY",
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
      "BINDING_ARTIFACT_UNSUPPORTED_ENTRY",
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
  fail("BINDING_ARTIFACT_TEMPORARY_CREATE_FAILED", "Could not reserve a temporary file.");
}

async function removeTemporary(temporaryPath) {
  try {
    await unlink(temporaryPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Builds deterministic M02-T10 binding-contract evidence entirely in memory. */
export async function buildProtocolBindingContractsEvidence({
  tracePath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_TRACE_PATH,
  normativeCoveragePath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_NORMATIVE_PATH,
  findingsPath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_FINDINGS_PATH,
  bindingSourcePath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_SOURCE_PATH,
  interactionArtifactPath = DEFAULT_PROTOCOL_INTERACTION_CONTRACTS_ARTIFACT_PATH,
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
  const sourceProfile = await verifyBindingSource(bindingSourcePath);
  const prerequisite = await verifyInteractionPrerequisite(interactionArtifactPath);
  const fixtures = await loadFrozenFixtures();
  const conformanceSet = createCatalogSet(api, [fixtures.validCatalog], "frozen Catalog");
  const exampleSet = createCatalogSet(api, [fixtures.exampleCatalog], "example Catalog");
  const frozenValidation = await verifyFrozenCorpus(api, fixtures, conformanceSet, exampleSet);
  const stateContracts = verifyStateGoldens(api, fixtures, conformanceSet);
  const references = verifyReferenceGoldens(api, fixtures, conformanceSet, exampleSet);
  const predicates = verifyPredicateGoldens(api, fixtures, conformanceSet);
  const formats = verifyFormatGoldens(api, fixtures, exampleSet);
  const repeats = verifyRepeatGoldens(api, fixtures, conformanceSet, exampleSet);
  const actionTargets = verifyActionTargetGoldens(api, fixtures, conformanceSet);
  const obligationCarryForward = verifyObligationCarryForward(
    api,
    fixtures,
    conformanceSet,
    exampleSet,
  );
  const laterTaskScopeAccepted = verifyLaterTaskFences(api, fixtures, conformanceSet, exampleSet);
  const determinism = verifyDeterminism(api, fixtures, conformanceSet);
  const rawDocumentBoundary = verifyHostileBoundary(api, fixtures, conformanceSet);
  const platformAudit = await verifyPlatformAndDistributionAudit();
  const trackedFiles = await trackedImplementationFiles(platformAudit);

  const artifact = {
    schemaVersion: 1,
    task: "M02-T10",
    profile: "desen-binding-contract-validation-v1",
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
    prerequisite: { interactionContracts: prerequisite },
    traceability: {
      schemaFamilies: trace.families,
      schemaFamilyCount: trace.families.length,
      schemaConstraints: trace.constraintCount,
      conformanceResponsibilities: [],
      proseRules: EXPECTED_PROSE_RULES,
      mandatoryClauses,
      ownedCoreDiagnostics: EXPECTED_CORE_DIAGNOSTICS,
      implementationDiagnostic: EXPECTED_BINDING_DIAGNOSTIC,
      implementationFindings: findings,
    },
    publicApi: {
      exports: publicExports,
      cumulativeBoundary: sourceProfile.cumulativeBoundary,
      trustedCatalogSet: "DesenValidatedInteractionCatalogSet",
      parallelCatalogSetApi: false,
      successValue: "independent recursively frozen JSON snapshot",
      failureValue: "no trusted document value",
      obligationKinds: EXPECTED_OBLIGATION_KINDS,
      newBindingObligationKinds: [],
    },
    frozenValidation,
    stateContracts,
    references,
    predicates,
    formats,
    repeats,
    actionTargets,
    obligationCarryForward,
    laterTaskScopeAccepted,
    determinism,
    security: {
      rawDocuments: "re-enter the cumulative T06→T09 immutable trust boundary",
      rawDocumentBoundary,
      initialValueMode: sourceProfile.initialValueMode,
      formatParser: sourceProfile.formatParser,
      repeatKeyIdentity: sourceProfile.repeatKeyIdentity,
      eventScope: sourceProfile.eventScope,
      schemaProfile: {
        finding: "PF-011",
        inheritedFromVerifiedT09Artifact: prerequisite.sha256,
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
        "pnpm generate:protocol-binding-contracts",
        "pnpm verify:protocol-binding-contracts",
        "pnpm test:protocol-binding-contracts",
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
        "complete M02-T09 verifier PASS plus exact prerequisite bytes",
        "reviewed exact 10-family / 300-constraint T10 trace ownership",
        "exact 12 prose rules, five core diagnostics, zero conformance rules, and zero BCP 14 clauses",
        "PF-014 through PF-019 implementation decisions",
        "zero official T10 invalid vectors and project-owned exact-pointer mutation goldens",
        "inert state initial, lexical reference/event, predicate, format, repeat, and narrow state-target goldens",
        "all four T09 obligation kinds carried forward without a new T10 obligation kind",
        "validator and transitive protocol source/distribution inventory and platform audit",
        "same-directory exclusive temporary write followed by atomic rename",
      ],
    },
    limitations: [
      "Resource and operation declaration contracts, lifecycle references, policies, inputs, outputs, and aliases are enforced by cumulative T11; execution remains M04 work.",
      "T10 adds no predicate/reference obligation kind; uncertain dynamic decisions remain deferred to their later consumer boundary.",
      "T11 enforces statically decidable nested state paths, values, and toggle types; complete post-write mutation and action execution remain M04 responsibilities.",
      "Context, environment, token, resource, operation, and other host-value resolution remains M04 work.",
      "Runtime predicate truth, repeat materialization, dynamic keys, instance identity, event/item lifetime, and reactive reevaluation remain M04/M05 work.",
      "Publication-time obligation discharge and full static binding compatibility remain M06 work.",
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

/** Writes current evidence only outside the immutable tracked M02-T10 artifact path. */
export async function writeProtocolBindingContractsEvidence({
  artifactPath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
  beforeAtomicRename,
} = {}) {
  if (
    path.resolve(artifactPath) === path.resolve(DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH)
  ) {
    return authenticateHistoricalArtifact(artifactPath);
  }
  const { resolvedArtifactPath, resolvedParent } = await resolveWritableArtifactPath(artifactPath);
  const result = await buildProtocolBindingContractsEvidence();
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
        "BINDING_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
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

/** Authenticates immutable task-time M02-T10 evidence without rebuilding successor source. */
export async function verifyProtocolBindingContracts({
  artifactPath = DEFAULT_PROTOCOL_BINDING_CONTRACTS_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await authenticateHistoricalArtifact(artifactPath, artifactBytes);
  const projectMutationGoldens =
    result.artifact.stateContracts.rejected.length +
    result.artifact.references.rejected.length +
    result.artifact.predicates.rejected.length +
    result.artifact.formats.rejected.length +
    result.artifact.repeats.rejected.length +
    result.artifact.actionTargets.rejected.length;
  return Object.freeze({
    result: "PASS",
    compatibilityMode: "immutable-task-time-artifact",
    schemaFamilies: result.artifact.traceability.schemaFamilies.length,
    schemaConstraints: result.artifact.traceability.schemaConstraints,
    proseRules: result.artifact.traceability.proseRules.length,
    ownedCoreDiagnostics: result.artifact.traceability.ownedCoreDiagnostics.length,
    conformanceResponsibilities: 0,
    mandatoryClauses: 0,
    officialT10Invalid: result.artifact.frozenValidation.officialT10Invalid.length,
    projectMutationGoldens,
    obligationKinds: result.artifact.obligationCarryForward.kinds.length,
    examples: result.artifact.frozenValidation.validExamples.length,
    artifactSha256: result.artifactSha256,
  });
}
