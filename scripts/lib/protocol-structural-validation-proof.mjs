import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import {
  DEFAULT_STRUCTURAL_VALIDATOR_PATH,
  STRUCTURAL_SCHEMA_SPECS,
  generateStructuralValidators,
  verifyStructuralValidatorArtifact,
} from "../../packages/validator/scripts/lib/structural-validator-codegen.mjs";
import {
  validateDesenBundle,
  validateDesenCatalog,
  validateDesenSource,
  validateDesenStructure,
} from "../../packages/validator/dist/index.js";
import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  verifyProtocolSnapshot,
} from "./protocol-snapshot-integrity.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const TRACE_PATH = path.join(WORKSPACE_ROOT, "docs/proof/protocol-0.1.0-traceability.json");
const CONFORMANCE_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "conformance");
const EXAMPLES_ROOT = path.join(DEFAULT_SNAPSHOT_ROOT, "examples");

/** Absolute path to the deterministic M02-T06 evidence artifact. */
export const DEFAULT_PROTOCOL_STRUCTURAL_VALIDATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/protocol-0.1.0-structural-validation.json",
);

const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "validateDesenBundle",
  "validateDesenCatalog",
  "validateDesenSource",
  "validateDesenStructure",
]);

const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "DesenDocumentForTarget",
  "DesenStructuralDiagnostic",
  "DesenStructuralDiagnosticCode",
  "DesenStructuralTarget",
  "DesenStructuralValidationFailure",
  "DesenStructuralValidationResult",
  "DesenStructuralValidationSuccess",
  "ImmutableJson",
]);

const TRACKED_IMPLEMENTATION_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "THIRD_PARTY_NOTICES.md",
  "packages/protocol/package.json",
  "packages/protocol/src/index.ts",
  "packages/protocol/src/canonicalization.ts",
  "packages/protocol/src/diagnostics.ts",
  "packages/protocol/src/json-pointer.ts",
  "packages/validator/package.json",
  "packages/validator/THIRD_PARTY_NOTICES.md",
  "packages/validator/tsconfig.json",
  "packages/validator/tsconfig.build.json",
  "packages/validator/src/index.ts",
  "packages/validator/src/validation-internals.ts",
  "packages/validator/src/structural-diagnostics.ts",
  "packages/validator/src/embedded-schema-validation.ts",
  "packages/validator/src/standalone-runtime.ts",
  "packages/validator/src/structural-validation.ts",
  "packages/validator/src/uri-reference.ts",
  "packages/validator/src/generated/0.1.0/structural-validators.ts",
  "packages/validator/scripts/lib/structural-validator-codegen.mjs",
  "packages/validator/scripts/clean-dist.mjs",
  "packages/validator/scripts/generate-structural-validators.mjs",
  "packages/validator/scripts/verify-structural-validators.mjs",
  "packages/validator/test/structural-validation.test.ts",
  "packages/validator/README.md",
  "scripts/lib/protocol-structural-validation-proof.mjs",
  "scripts/generate-protocol-structural-validation-proof.mjs",
  "scripts/verify-protocol-structural-validation.mjs",
  "tests/protocol-structural-validation.test.mjs",
]);

const EXPECTED_DIRECT_STRUCTURAL_FAMILIES = Object.freeze([
  "SC-001",
  "SC-002",
  "SC-003",
  "SC-010",
  "SC-011",
  "SC-012",
  "SC-021",
  "SC-022",
  "SC-023",
  "SC-028",
]);
const EXPECTED_PROSE_RULES = Object.freeze([
  "R-001",
  "R-016",
  "R-023",
  "R-025",
  "R-032",
  "R-035",
  "R-038",
  "R-082",
  "R-138",
  "R-142",
]);
const EXPECTED_CONFORMANCE_RULES = Object.freeze(["C-001", "C-016", "C-024"]);
const EXPECTED_DIAGNOSTICS = Object.freeze([
  Object.freeze({ id: "D-001", code: "SCHEMA_INVALID" }),
  Object.freeze({ id: "D-002", code: "UNKNOWN_CORE_FIELD" }),
  Object.freeze({ id: "D-034", code: "UNSUPPORTED_PROTOCOL" }),
]);
const EXPECTED_SCHEMA_CONSTRAINTS = Object.freeze({
  "desen-bundle.schema.json": 360,
  "desen-catalog.schema.json": 277,
  "desen-source.schema.json": 352,
});
const EXPECTED_EMBEDDED_LOCATOR_FAMILIES = Object.freeze([
  "surface-state-schema",
  "components-props",
  "components-event-payload",
  "components-command-input",
  "components-style-properties",
  "behaviors-props",
  "behaviors-event-payload",
  "behaviors-command-input",
  "behaviors-style-properties",
  "operations-input",
  "operations-output",
  "resources-input",
  "resources-output",
]);

const FROZEN_VALID_VECTORS = Object.freeze([
  Object.freeze({ file: "valid/sign-in.source.json", target: "source" }),
  Object.freeze({ file: "valid/sign-in.bundle.json", target: "bundle" }),
  Object.freeze({ file: "valid/web.catalog.json", target: "catalog" }),
]);
const FROZEN_SEMANTIC_FENCE_VECTORS = Object.freeze([
  Object.freeze({ file: "invalid/source-duplicate-node-id.json", target: "source" }),
  Object.freeze({ file: "invalid/source-unknown-capability.json", target: "source" }),
  Object.freeze({ file: "invalid/source-unknown-event.json", target: "source" }),
  Object.freeze({ file: "invalid/bundle-revision-mismatch.json", target: "bundle" }),
  Object.freeze({ file: "invalid/bundle-catalog-digest-mismatch.json", target: "bundle" }),
]);
const FROZEN_EXAMPLES = Object.freeze([
  Object.freeze({ file: "sign-in.source.desen.json", target: "source" }),
  Object.freeze({ file: "sign-in.bundle.desen.json", target: "bundle" }),
  Object.freeze({ file: "catalog.web.example.json", target: "catalog" }),
  Object.freeze({ file: "sortable-list.source.desen.json", target: "source" }),
  Object.freeze({ file: "store-map.source.desen.json", target: "source" }),
]);
const EMBEDDED_LOCATOR_MUTATIONS = Object.freeze([
  Object.freeze({
    id: "source-state",
    target: "source",
    path: ["surfaces", "sign-in", "state", "email", "schema"],
    pointer: "/surfaces/sign-in/state/email/schema/type",
  }),
  Object.freeze({
    id: "bundle-state",
    target: "bundle",
    path: ["surfaces", "sign-in", "state", "email", "schema"],
    pointer: "/surfaces/sign-in/state/email/schema/type",
  }),
  Object.freeze({
    id: "component-props",
    target: "catalog",
    path: ["components", "com.example.ui/TextField", "propsSchema"],
    pointer: "/components/com.example.ui~1TextField/propsSchema/type",
  }),
  Object.freeze({
    id: "component-event",
    target: "catalog",
    path: ["components", "com.example.ui/TextField", "events", "change", "payloadSchema"],
    pointer: "/components/com.example.ui~1TextField/events/change/payloadSchema/type",
  }),
  Object.freeze({
    id: "component-command",
    target: "catalog",
    path: ["components", "com.example.ui/TextField", "commands", "focus", "inputSchema"],
    pointer: "/components/com.example.ui~1TextField/commands/focus/inputSchema/type",
  }),
  Object.freeze({
    id: "component-style",
    target: "catalog",
    path: ["components", "com.example.ui/TextField", "styleParts", "root", "propertiesSchema"],
    pointer: "/components/com.example.ui~1TextField/styleParts/root/propertiesSchema/type",
  }),
  Object.freeze({
    id: "behavior-props",
    target: "catalog",
    path: ["behaviors", "com.example.interactions/Sortable", "propsSchema"],
    pointer: "/behaviors/com.example.interactions~1Sortable/propsSchema/type",
  }),
  Object.freeze({
    id: "behavior-event",
    target: "catalog",
    path: ["behaviors", "com.example.interactions/Sortable", "events", "reorder", "payloadSchema"],
    pointer: "/behaviors/com.example.interactions~1Sortable/events/reorder/payloadSchema/type",
  }),
  Object.freeze({
    id: "behavior-command",
    target: "catalog",
    path: ["behaviors", "com.example.interactions/Sortable", "commands", "probe", "inputSchema"],
    pointer: "/behaviors/com.example.interactions~1Sortable/commands/probe/inputSchema/type",
  }),
  Object.freeze({
    id: "behavior-style",
    target: "catalog",
    path: [
      "behaviors",
      "com.example.interactions/Sortable",
      "styleParts",
      "dropIndicator",
      "propertiesSchema",
    ],
    pointer:
      "/behaviors/com.example.interactions~1Sortable/styleParts/dropIndicator/propertiesSchema/type",
  }),
  Object.freeze({
    id: "operation-input",
    target: "catalog",
    path: ["operations", "com.example.auth/signIn", "inputSchema"],
    pointer: "/operations/com.example.auth~1signIn/inputSchema/type",
  }),
  Object.freeze({
    id: "operation-output",
    target: "catalog",
    path: ["operations", "com.example.auth/signIn", "outputSchema"],
    pointer: "/operations/com.example.auth~1signIn/outputSchema/type",
  }),
  Object.freeze({
    id: "resource-input",
    target: "catalog",
    path: ["resources", "com.example.stores/list", "inputSchema"],
    pointer: "/resources/com.example.stores~1list/inputSchema/type",
  }),
  Object.freeze({
    id: "resource-output",
    target: "catalog",
    path: ["resources", "com.example.stores/list", "outputSchema"],
    pointer: "/resources/com.example.stores~1list/outputSchema/type",
  }),
]);
const EXPECTED_DISTRIBUTION_MODULES = Object.freeze([
  "component-contract-validation",
  "embedded-schema-validation",
  "generated/0.1.0/structural-validators",
  "index",
  "interaction-contract-validation",
  "schema-instance-validation",
  "semantic-diagnostics",
  "semantic-validation",
  "standalone-runtime",
  "structural-diagnostics",
  "structural-validation",
  "uri-reference",
  "validation-internals",
]);

const VALIDATORS = Object.freeze({
  source: validateDesenSource,
  bundle: validateDesenBundle,
  catalog: validateDesenCatalog,
});

/** Stable internal failure raised by M02-T06 evidence generation and verification. */
export class ProtocolStructuralValidationEvidenceError extends Error {
  /**
   * @param {string} code stable internal failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] structured failure context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ProtocolStructuralValidationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProtocolStructuralValidationEvidenceError(code, message, details);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertJsonEqual(actual, expected, label, code = "STRUCTURAL_GOLDEN_MISMATCH") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} differs from its reviewed value.`, { expected, actual });
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function trackedFileEvidence() {
  const evidence = [];
  for (const relativePath of TRACKED_IMPLEMENTATION_PATHS) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, ...relativePath.split("/")));
    evidence.push({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  return evidence;
}

function namedExports(indexSource, pattern) {
  return [...indexSource.matchAll(pattern)].flatMap(([, names]) =>
    names
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type ")),
  );
}

async function verifyPublicExports() {
  const source = await readFile(
    path.join(WORKSPACE_ROOT, "packages/validator/src/index.ts"),
    "utf8",
  );
  if (/export\s+\*/u.test(source)) {
    fail("STRUCTURAL_PUBLIC_EXPORT_DRIFT", "The validator root may not use wildcard exports.");
  }
  const runtime = namedExports(source, /export\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu).sort(
    compareText,
  );
  const types = namedExports(source, /export\s+type\s*\{([\s\S]*?)\}\s*from\s*"[^"]+";/gu).sort(
    compareText,
  );
  const missingRuntime = PUBLIC_RUNTIME_EXPORTS.filter((name) => !runtime.includes(name));
  const missingTypes = PUBLIC_TYPE_EXPORTS.filter((name) => !types.includes(name));
  if (missingRuntime.length > 0 || missingTypes.length > 0) {
    fail("STRUCTURAL_PUBLIC_EXPORT_DRIFT", "The required structural API exports changed.", {
      missingRuntime,
      missingTypes,
    });
  }
}

async function verifyCommandWiring() {
  const rootPackage = await readJson(path.join(WORKSPACE_ROOT, "package.json"));
  const validatorPackage = await readJson(
    path.join(WORKSPACE_ROOT, "packages/validator/package.json"),
  );
  const expectedRootFragments = {
    "generate:protocol-structural-validation": "generate-protocol-structural-validation-proof.mjs",
    "verify:protocol-structural-validation": "verify-protocol-structural-validation.mjs",
    "test:protocol-structural-validation": "protocol-structural-validation.test.mjs",
  };
  for (const [command, fragment] of Object.entries(expectedRootFragments)) {
    if (!rootPackage.scripts?.[command]?.includes(fragment)) {
      fail("STRUCTURAL_COMMAND_WIRING_DRIFT", `Root command ${command} is missing or stale.`);
    }
  }
  if (!rootPackage.scripts?.check?.includes("verify:protocol-structural-validation")) {
    fail("STRUCTURAL_COMMAND_WIRING_DRIFT", "The root quality gate omits M02-T06 verification.");
  }
  for (const command of [
    "generate:structural-validation",
    "verify:structural-validation",
    "test:structural-validation",
  ]) {
    if (typeof validatorPackage.scripts?.[command] !== "string") {
      fail("STRUCTURAL_COMMAND_WIRING_DRIFT", `Validator command ${command} is missing.`);
    }
  }
  if (validatorPackage.devDependencies?.ajv !== "8.20.0") {
    fail("STRUCTURAL_DEPENDENCY_DRIFT", "The reviewed Ajv build-time version must remain exact.");
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
  if (
    trace.schemaFamilies?.length !== 61 ||
    trace.expectedSchemaInventory?.totalConstraints !== 989
  ) {
    fail("STRUCTURAL_TRACE_DRIFT", "The reviewed schema-route totals changed.");
  }
  assertJsonEqual(
    trace.expectedSchemaInventory.byFile,
    EXPECTED_SCHEMA_CONSTRAINTS,
    "schema constraints by file",
    "STRUCTURAL_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.schemaFamilies, "M02-T06", "semanticOwners"),
    [...EXPECTED_DIRECT_STRUCTURAL_FAMILIES].sort(compareText),
    "direct structural families",
    "STRUCTURAL_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.proseRules, "M02-T06"),
    [...EXPECTED_PROSE_RULES].sort(compareText),
    "structural prose rules",
    "STRUCTURAL_TRACE_DRIFT",
  );
  assertJsonEqual(
    ownedIds(trace.conformanceRules, "M02-T06"),
    [...EXPECTED_CONFORMANCE_RULES].sort(compareText),
    "structural conformance rules",
    "STRUCTURAL_TRACE_DRIFT",
  );
  const diagnostics = trace.diagnostics
    .filter(({ owners }) => owners?.includes("M02-T06"))
    .map(({ id, anchor: code }) => ({ id, code }));
  assertJsonEqual(
    diagnostics,
    EXPECTED_DIAGNOSTICS,
    "structural diagnostics",
    "STRUCTURAL_TRACE_DRIFT",
  );
  const schemaNodes = trace.schemaNonConstraintDecisions
    .filter(({ owners }) => owners?.includes("M02-T06"))
    .map(({ id }) => id);
  assertJsonEqual(
    schemaNodes,
    ["SN-001", "SN-002"],
    "schema identity nodes",
    "STRUCTURAL_TRACE_DRIFT",
  );
}

function diagnosticIdentity(result) {
  return result.diagnostics.map(({ code, pointer }) => ({ code, pointer }));
}

async function validateFrozenCase(root, vector, expectedValid) {
  const document = await readJson(path.join(root, ...vector.file.split("/")));
  const result = VALIDATORS[vector.target](document);
  if (result.valid !== expectedValid) {
    fail("STRUCTURAL_FROZEN_VECTOR_MISMATCH", `Frozen ${vector.file} has an unexpected result.`, {
      target: vector.target,
      expectedValid,
      diagnostics: diagnosticIdentity(result),
    });
  }
  return { file: vector.file, target: vector.target, valid: result.valid };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function writeObjectPath(root, segments, value) {
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    if (!isObject(current[segment])) current[segment] = {};
    current = current[segment];
  }
  current[segments.at(-1)] = value;
}

async function verifyEmbeddedLocatorMutations() {
  const fixtures = {
    source: await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json")),
    bundle: await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.bundle.json")),
    catalog: await readJson(path.join(CONFORMANCE_ROOT, "valid/web.catalog.json")),
  };
  const results = [];
  for (const mutation of EMBEDDED_LOCATOR_MUTATIONS) {
    const document = structuredClone(fixtures[mutation.target]);
    writeObjectPath(document, mutation.path, { type: "not-a-type" });
    const result = validateDesenStructure(mutation.target, document);
    const identity = diagnosticIdentity(result);
    assertJsonEqual(
      identity,
      [{ code: "SCHEMA_INVALID", pointer: mutation.pointer }],
      `embedded locator mutation ${mutation.id}`,
      "STRUCTURAL_EMBEDDED_LOCATOR_DRIFT",
    );
    results.push({
      id: mutation.id,
      target: mutation.target,
      pointer: mutation.pointer,
      diagnostic: identity[0],
    });
  }
  return results;
}

function pushSchema(locations, family, value) {
  if (isObject(value) || typeof value === "boolean") locations.push({ family, schema: value });
}

function collectEmbeddedSchemas(target, document) {
  const locations = [];
  if (target !== "catalog") {
    for (const surface of Object.values(document.surfaces ?? {})) {
      for (const state of Object.values(surface.state ?? {})) {
        pushSchema(locations, "surface-state-schema", state.schema);
      }
    }
    return locations;
  }

  for (const groupName of ["components", "behaviors"]) {
    for (const capability of Object.values(document[groupName] ?? {})) {
      pushSchema(locations, `${groupName}-props`, capability.propsSchema);
      for (const event of Object.values(capability.events ?? {})) {
        pushSchema(locations, `${groupName}-event-payload`, event.payloadSchema);
      }
      for (const command of Object.values(capability.commands ?? {})) {
        pushSchema(locations, `${groupName}-command-input`, command.inputSchema);
      }
      for (const stylePart of Object.values(capability.styleParts ?? {})) {
        pushSchema(locations, `${groupName}-style-properties`, stylePart.propertiesSchema);
      }
    }
  }
  for (const groupName of ["operations", "resources"]) {
    for (const capability of Object.values(document[groupName] ?? {})) {
      pushSchema(locations, `${groupName}-input`, capability.inputSchema);
      pushSchema(locations, `${groupName}-output`, capability.outputSchema);
    }
  }
  return locations;
}

async function verifyFrozenDocuments() {
  const valid = [];
  for (const vector of FROZEN_VALID_VECTORS) {
    valid.push(await validateFrozenCase(CONFORMANCE_ROOT, vector, true));
  }

  const structuralInvalid = {
    file: "invalid/source-unknown-core-field.json",
    target: "source",
  };
  const invalidDocument = await readJson(path.join(CONFORMANCE_ROOT, structuralInvalid.file));
  const invalidResult = validateDesenSource(invalidDocument);
  assertJsonEqual(
    diagnosticIdentity(invalidResult),
    [{ code: "UNKNOWN_CORE_FIELD", pointer: "/script" }],
    "unknown core field diagnostic",
    "STRUCTURAL_FROZEN_VECTOR_MISMATCH",
  );

  const semanticFence = [];
  for (const vector of FROZEN_SEMANTIC_FENCE_VECTORS) {
    semanticFence.push(await validateFrozenCase(CONFORMANCE_ROOT, vector, true));
  }
  const examples = [];
  for (const vector of FROZEN_EXAMPLES) {
    examples.push(await validateFrozenCase(EXAMPLES_ROOT, vector, true));
  }

  const unsupported = structuredClone(
    await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json")),
  );
  unsupported.desen = "0.2.0";
  const unsupportedResult = validateDesenSource(unsupported);
  assertJsonEqual(
    diagnosticIdentity(unsupportedResult),
    [{ code: "UNSUPPORTED_PROTOCOL", pointer: "/desen" }],
    "unsupported protocol diagnostic",
  );

  const embeddedCounts = {
    source: 0,
    bundle: 0,
    catalog: 0,
    explicitDialect: 0,
    implicitDialect: 0,
  };
  const locatorFamilies = new Set();
  for (const vector of FROZEN_VALID_VECTORS) {
    const document = await readJson(path.join(CONFORMANCE_ROOT, vector.file));
    const locations = collectEmbeddedSchemas(vector.target, document);
    embeddedCounts[vector.target] += locations.length;
    for (const location of locations) {
      locatorFamilies.add(location.family);
      if (isObject(location.schema) && Object.hasOwn(location.schema, "$schema")) {
        embeddedCounts.explicitDialect += 1;
      } else {
        embeddedCounts.implicitDialect += 1;
      }
    }
  }
  const total = embeddedCounts.source + embeddedCounts.bundle + embeddedCounts.catalog;
  assertJsonEqual(
    { ...embeddedCounts, total, frozenObservedLocatorFamilies: locatorFamilies.size },
    {
      source: 2,
      bundle: 2,
      catalog: 40,
      explicitDialect: 23,
      implicitDialect: 21,
      total: 44,
      frozenObservedLocatorFamilies: 12,
    },
    "embedded schema inventory",
  );
  assertJsonEqual(
    [...locatorFamilies].sort(compareText),
    EXPECTED_EMBEDDED_LOCATOR_FAMILIES.filter(
      (family) => family !== "behaviors-command-input",
    ).sort(compareText),
    "frozen embedded locator families",
  );
  const locatorMutations = await verifyEmbeddedLocatorMutations();

  return {
    validConformance: valid,
    structurallyInvalidConformance: [
      { ...structuralInvalid, valid: false, diagnostics: diagnosticIdentity(invalidResult) },
    ],
    semanticFenceAccepted: semanticFence,
    validExamples: examples,
    unsupportedProtocol: diagnosticIdentity(unsupportedResult),
    embedded: {
      ...embeddedCounts,
      total,
      frozenObservedLocatorFamilies: [...locatorFamilies].sort(compareText),
      locatorFamilies: EXPECTED_EMBEDDED_LOCATOR_FAMILIES,
      locatorMutations,
    },
  };
}

function collectSchemaKeywordFacts(value, facts) {
  if (typeof value === "boolean" || !isObject(value)) return;
  if (isObject(value.$defs)) facts.definitions += Object.keys(value.$defs).length;
  for (const keyword of ["$ref", "oneOf", "anyOf", "allOf", "if", "then", "not"]) {
    if (!Object.hasOwn(value, keyword)) continue;
    facts[keyword] += 1;
    if (Array.isArray(value[keyword])) facts[`${keyword}Branches`] += value[keyword].length;
  }

  for (const keyword of [
    "additionalProperties",
    "contains",
    "contentSchema",
    "else",
    "if",
    "items",
    "not",
    "propertyNames",
    "then",
    "unevaluatedItems",
    "unevaluatedProperties",
  ]) {
    collectSchemaKeywordFacts(value[keyword], facts);
  }
  for (const keyword of ["allOf", "anyOf", "oneOf", "prefixItems"]) {
    if (Array.isArray(value[keyword])) {
      for (const child of value[keyword]) collectSchemaKeywordFacts(child, facts);
    }
  }
  for (const keyword of ["$defs", "dependentSchemas", "patternProperties", "properties"]) {
    if (isObject(value[keyword])) {
      for (const child of Object.values(value[keyword])) collectSchemaKeywordFacts(child, facts);
    }
  }
}

async function schemaFacts(generated) {
  const facts = {
    definitions: 0,
    $ref: 0,
    oneOf: 0,
    oneOfBranches: 0,
    anyOf: 0,
    anyOfBranches: 0,
    allOf: 0,
    allOfBranches: 0,
    if: 0,
    then: 0,
    not: 0,
  };
  for (const spec of STRUCTURAL_SCHEMA_SPECS) {
    collectSchemaKeywordFacts(
      await readJson(path.join(DEFAULT_SNAPSHOT_ROOT, "schemas", spec.schemaFile)),
      facts,
    );
  }
  assertJsonEqual(
    facts,
    {
      definitions: 44,
      $ref: 112,
      oneOf: 8,
      oneOfBranches: 34,
      anyOf: 5,
      anyOfBranches: 10,
      allOf: 2,
      allOfBranches: 6,
      if: 6,
      then: 6,
      not: 2,
    },
    "canonical schema keyword facts",
  );
  return {
    roots: generated.schemas,
    constraints: { families: 61, total: 989, byFile: EXPECTED_SCHEMA_CONSTRAINTS },
    keywords: facts,
  };
}

async function verifyProductionSourceAudit() {
  const sourcePaths = [
    "packages/validator/src/index.ts",
    "packages/validator/src/validation-internals.ts",
    "packages/validator/src/structural-diagnostics.ts",
    "packages/validator/src/embedded-schema-validation.ts",
    "packages/validator/src/standalone-runtime.ts",
    "packages/validator/src/structural-validation.ts",
    "packages/validator/src/uri-reference.ts",
    "packages/validator/src/generated/0.1.0/structural-validators.ts",
  ];
  const source = (
    await Promise.all(
      sourcePaths.map((relativePath) => readFile(path.join(WORKSPACE_ROOT, relativePath), "utf8")),
    )
  ).join("\n");
  const forbidden = [
    ["runtime require", /\brequire\s*\(/u],
    ["eval", /\beval\s*\(/u],
    ["Function constructor", /\bnew\s+Function\b/u],
    ["dynamic import", /\bimport\s*\(/u],
    ["network fetch", /\bfetch\s*\(/u],
    ["Node built-in import", /from\s+["']node:/u],
    ["workspace absolute path", /\/Users\//u],
    ["frozen upstream runtime import", /from\s+["'][^"']*upstream\//u],
    ["TypeScript runtime import", /from\s+["'][^"']*\.ts["']/u],
  ];
  const violations = forbidden
    .filter(([, pattern]) => pattern.test(source))
    .map(([label]) => label);
  if (violations.length > 0) {
    fail(
      "STRUCTURAL_SOURCE_AUDIT_FAILED",
      "Production validation source violates its inert boundary.",
      {
        violations,
      },
    );
  }
  return { files: sourcePaths, forbiddenConstructs: forbidden.map(([label]) => label) };
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
      fail("STRUCTURAL_DIST_AUDIT_FAILED", "The built validator contains a symlink.", {
        relativePath,
      });
    }
    if (entry.isDirectory()) files.push(...(await inventoryRegularFiles(root, relativePath)));
    else if (entry.isFile()) files.push(relativePath);
    else {
      fail("STRUCTURAL_DIST_AUDIT_FAILED", "The built validator contains a special entry.", {
        relativePath,
      });
    }
  }
  return files;
}

async function verifyBuiltDistributionAudit() {
  const distRoot = path.join(WORKSPACE_ROOT, "packages/validator/dist");
  const actualFiles = (await inventoryRegularFiles(distRoot)).sort(compareText);
  const expectedFiles = EXPECTED_DISTRIBUTION_MODULES.flatMap((module) =>
    [".d.ts", ".d.ts.map", ".js", ".js.map"].map((suffix) => `${module}${suffix}`),
  ).sort(compareText);
  assertJsonEqual(
    actualFiles,
    expectedFiles,
    "built distribution inventory",
    "STRUCTURAL_DIST_AUDIT_FAILED",
  );

  const runtimeFiles = actualFiles.filter((file) => file.endsWith(".js"));
  const runtimeSource = (
    await Promise.all(
      runtimeFiles.map((file) => readFile(path.join(distRoot, ...file.split("/")), "utf8")),
    )
  ).join("\n");
  const forbidden = [
    ["runtime require", /\brequire\s*\(/u],
    ["eval", /\beval\s*\(/u],
    ["Function constructor", /\bnew\s+Function\b/u],
    ["dynamic import", /\bimport\s*\(/u],
    ["network fetch", /\bfetch\s*\(/u],
    ["Node built-in import", /from\s+["']node:/u],
    ["framework import", /from\s+["'](?:react|react-dom|next)(?:["'/])/u],
    ["workspace absolute path", /\/Users\//u],
    ["frozen upstream runtime import", /packages\/protocol\/upstream/u],
    ["TypeScript runtime import", /from\s+["'][^"']*\.ts["']/u],
  ];
  const violations = forbidden
    .filter(([, pattern]) => pattern.test(runtimeSource))
    .map(([label]) => label);
  if (violations.length > 0) {
    fail("STRUCTURAL_DIST_AUDIT_FAILED", "Built validator runtime violates its boundary.", {
      violations,
    });
  }
  return {
    files: actualFiles,
    runtimeFiles,
    forbiddenConstructs: forbidden.map(([label]) => label),
  };
}

function isDeeplyFrozen(value) {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeeplyFrozen);
}

function collectObjectIdentities(value, identities = new WeakSet()) {
  if (value === null || typeof value !== "object" || identities.has(value)) return identities;
  identities.add(value);
  for (const child of Object.values(value)) collectObjectIdentities(child, identities);
  return identities;
}

function sharesObjectIdentity(value, identities, visited = new WeakSet()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return false;
  if (identities.has(value)) return true;
  visited.add(value);
  return Object.values(value).some((child) => sharesObjectIdentity(child, identities, visited));
}

function containsFrozenObject(value, visited = new WeakSet()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return false;
  if (Object.isFrozen(value)) return true;
  visited.add(value);
  return Object.values(value).some((child) => containsFrozenObject(child, visited));
}

async function verifyInertInputBoundary() {
  const source = await readJson(path.join(CONFORMANCE_ROOT, "valid/sign-in.source.json"));
  const before = JSON.stringify(source);
  const callerIdentities = collectObjectIdentities(source);
  const originalId = source.id;
  const originalSchemaType = source.surfaces["sign-in"].state.email.schema.type;
  const originalCatalogTarget = source.catalogs[0].target;
  const result = validateDesenSource(source);
  if (!result.valid) {
    fail("STRUCTURAL_INERT_BOUNDARY_FAILED", "A frozen valid Source failed the inert boundary.", {
      diagnostics: diagnosticIdentity(result),
    });
  }
  if (
    JSON.stringify(source) !== before ||
    sharesObjectIdentity(result.value, callerIdentities) ||
    containsFrozenObject(source) ||
    !isDeeplyFrozen(result.value)
  ) {
    fail(
      "STRUCTURAL_INERT_BOUNDARY_FAILED",
      "Validation mutated or froze caller data, retained nested identity, or failed to deeply freeze the Source snapshot.",
    );
  }
  source.id = "caller-mutated-after-validation";
  source.surfaces["sign-in"].state.email.schema.type = "boolean";
  source.catalogs[0].target = "caller-mutated-target";
  if (
    result.value.id !== originalId ||
    result.value.surfaces["sign-in"].state.email.schema.type !== originalSchemaType ||
    result.value.catalogs[0].target !== originalCatalogTarget
  ) {
    fail(
      "STRUCTURAL_INERT_BOUNDARY_FAILED",
      "The validated snapshot retained nested caller state.",
    );
  }

  let getterInvocations = 0;
  const hostile = Object.defineProperty({}, "desen", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return "0.1.0";
    },
  });
  const hostileResult = validateDesenSource(hostile);
  assertJsonEqual(
    diagnosticIdentity(hostileResult),
    [{ code: "SCHEMA_INVALID", pointer: "" }],
    "hostile accessor rejection",
    "STRUCTURAL_INERT_BOUNDARY_FAILED",
  );
  if (getterInvocations !== 0) {
    fail("STRUCTURAL_INERT_BOUNDARY_FAILED", "Validation invoked a caller-owned accessor.");
  }

  const cyclic = {};
  cyclic.self = cyclic;
  assertJsonEqual(
    diagnosticIdentity(validateDesenSource(cyclic)),
    [{ code: "SCHEMA_INVALID", pointer: "" }],
    "cyclic input rejection",
    "STRUCTURAL_INERT_BOUNDARY_FAILED",
  );

  return {
    callerInputRetained: false,
    callerInputMutated: false,
    callerTreeFrozen: false,
    nestedMutationIsolated: true,
    hostileGetterInvocations: getterInvocations,
    successSnapshotDeepFrozen: true,
    cyclicInputRejected: true,
  };
}

/** Builds the deterministic M02-T06 evidence entirely from frozen inputs and tracked code. */
export async function buildProtocolStructuralValidationEvidence({
  tracePath = TRACE_PATH,
  verifySnapshot = true,
} = {}) {
  const snapshot = verifySnapshot ? await verifyProtocolSnapshot() : EXPECTED_PROTOCOL_SNAPSHOT;
  await verifyTraceability(tracePath);
  await verifyPublicExports();
  await verifyCommandWiring();
  const generatedVerification = await verifyStructuralValidatorArtifact();
  const generated = await generateStructuralValidators();
  const frozen = await verifyFrozenDocuments();
  const sourceAudit = await verifyProductionSourceAudit();
  const distributionAudit = await verifyBuiltDistributionAudit();
  const inertBoundary = await verifyInertInputBoundary();

  const artifact = {
    schemaVersion: 1,
    task: "M02-T06",
    result: "PASS",
    protocolVersion: "0.1.0",
    profile: "desen-structural-validation-v1",
    frozenInput: {
      sourceCommit: snapshot.sourceCommit,
      sourceTree: snapshot.sourceTree,
      aggregateSha256: snapshot.aggregateSha256,
      schemas: await schemaFacts(generated),
    },
    traceability: {
      schemaNodes: ["SN-001", "SN-002"],
      directStructuralFamilies: EXPECTED_DIRECT_STRUCTURAL_FAMILIES,
      proseRules: EXPECTED_PROSE_RULES,
      conformanceResponsibilities: EXPECTED_CONFORMANCE_RULES,
      diagnostics: EXPECTED_DIAGNOSTICS,
      bcp14: ["N-002", "N-013", "N-022", "N-039"],
    },
    engine: {
      name: "Ajv",
      version: "8.20.0",
      dialect: "https://json-schema.org/draft/2020-12/schema",
      delivery: "deterministic standalone ESM generated only from checksum-pinned schemas",
      generatedModule: {
        path: path.relative(WORKSPACE_ROOT, DEFAULT_STRUCTURAL_VALIDATOR_PATH),
        bytes: generatedVerification.outputBytes,
        sha256: generatedVerification.outputSha256,
        exports: generatedVerification.exports,
        runtimeImports: generatedVerification.runtimeImports,
        localHelpers: generatedVerification.localHelpers,
      },
      options: {
        allErrors: true,
        ownProperties: true,
        strictSchema: true,
        strictNumbers: true,
        strictTypes: false,
        strictTuples: false,
        strictRequired: false,
        validateFormats: false,
        removeAdditional: false,
        useDefaults: false,
        coerceTypes: false,
      },
      runtimeSchemaCompilation: false,
      networkResolution: "disabled",
      formats: "Draft 2020-12 annotations only",
    },
    publicApi: {
      package: "@desen/validator",
      targets: ["source", "bundle", "catalog"],
      runtimeExports: PUBLIC_RUNTIME_EXPORTS,
      typeExports: PUBLIC_TYPE_EXPORTS,
      stableDiagnosticFields: ["code", "pointer"],
      successValue: "independent recursively frozen JSON snapshot",
    },
    canonicalDocumentValidation: {
      validConformance: frozen.validConformance,
      structurallyInvalidConformance: frozen.structurallyInvalidConformance,
      semanticFenceAccepted: frozen.semanticFenceAccepted,
      validExamples: frozen.validExamples,
      unsupportedProtocol: frozen.unsupportedProtocol,
    },
    embeddedSchemaValidation: {
      located: {
        source: frozen.embedded.source,
        bundle: frozen.embedded.bundle,
        catalog: frozen.embedded.catalog,
        total: frozen.embedded.total,
      },
      explicitDialect: frozen.embedded.explicitDialect,
      implicitDialect: frozen.embedded.implicitDialect,
      locatorFamilies: frozen.embedded.locatorFamilies,
      locatorMutations: frozen.embedded.locatorMutations,
      externalReferencePolicy: "reject non-local $ref and $dynamicRef without network access",
      valueApplication: "not performed; owned by M02-T08 through M02-T11",
    },
    security: {
      validationInput: "canonicalized inert JSON snapshot",
      inertBoundary,
      runtimeDynamicCompilation: false,
      sourceAudit,
      distributionAudit,
    },
    implementation: {
      platform: "ECMAScript 2023; no Node, DOM, React, or browser API in production source",
      runtimeDependencies: [
        { name: "@desen/protocol", version: "workspace:*", license: "Apache-2.0" },
      ],
      buildDependencies: [{ name: "ajv", version: "8.20.0", license: "MIT" }],
      evidenceFormatter: { name: "prettier", version: "3.9.6" },
      trackedFiles: await trackedFileEvidence(),
    },
    verification: {
      commands: [
        "pnpm generate:protocol-structural-validation",
        "pnpm verify:protocol-structural-validation",
        "pnpm test:protocol-structural-validation",
        "pnpm check",
      ],
      independentAnchors: [
        "byte-verified frozen snapshot manifest",
        "three canonical schema identities and checksums",
        "reviewed 61-family / 989-constraint trace ledger",
        "byte-identical standalone regeneration",
        "frozen conformance vectors and examples",
      ],
    },
    limitations: [
      "Identity, entry, full SemVer, catalog namespace, extension, and reference semantics remain M02-T07.",
      "Embedded schemas are validated as schemas but are not applied to state, props, style, event, command, operation, or resource values in this task.",
      "Official full-suite TypeScript parity and per-constraint branch micro-vectors remain M02-T12 and M02-T13.",
      "Resource limits and the complete executable-content security proof remain later tasks.",
      "P-04 is not PROVEN by structural validation alone.",
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

/** Writes deterministic M02-T06 evidence to its single tracked regular-file destination. */
export async function writeProtocolStructuralValidationEvidence({
  artifactPath = DEFAULT_PROTOCOL_STRUCTURAL_VALIDATION_ARTIFACT_PATH,
} = {}) {
  try {
    const stats = await lstat(artifactPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      fail("STRUCTURAL_ARTIFACT_UNSUPPORTED_ENTRY", "Evidence destination must be a regular file.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const result = await buildProtocolStructuralValidationEvidence();
  await writeFile(artifactPath, result.artifactBytes);
  return result;
}

/** Rebuilds and byte-compares the tracked M02-T06 evidence without modifying it. */
export async function verifyProtocolStructuralValidation({
  artifactPath = DEFAULT_PROTOCOL_STRUCTURAL_VALIDATION_ARTIFACT_PATH,
  artifactBytes,
} = {}) {
  const result = await buildProtocolStructuralValidationEvidence();
  const actual = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actual).equals(result.artifactBytes)) {
    fail("STRUCTURAL_ARTIFACT_DRIFT", "Tracked M02-T06 evidence is stale or modified.", {
      expectedSha256: result.artifactSha256,
      actualSha256: sha256(actual),
    });
  }
  return Object.freeze({
    result: "PASS",
    schemaRoots: 3,
    schemaFamilies: 61,
    schemaConstraints: 989,
    embeddedSchemas: 44,
    locatorFamilies: 13,
    artifactSha256: result.artifactSha256,
  });
}
