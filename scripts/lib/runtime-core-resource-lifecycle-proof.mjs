import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M04-T08 resource-lifecycle artifact. */
export const DEFAULT_RUNTIME_CORE_RESOURCE_LIFECYCLE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json",
);

const REPEAT_MATERIALIZATION_PREREQUISITE = Object.freeze({
  task: "M04-T07",
  path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
  artifact: "runtime-core-0.1.0-repeat-materialization.json",
  sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
});
const TOKEN_FORMAT_PREREQUISITE = Object.freeze({
  task: "M04-T03",
  path: "docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
  artifact: "runtime-core-0.1.0-token-format-resolution.json",
  sha256: "be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f",
});
const EXECUTION_CONTRACT_PREREQUISITE = Object.freeze({
  task: "M02-T11",
  path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  artifact: "protocol-0.1.0-execution-contracts.json",
  sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
});
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "RUNTIME_RESOURCE_LIMITS",
    "disposeRuntimeSurfaceResources",
    "mountRuntimeSurfaceResources",
    "readRuntimeSurfaceResources",
    "refreshRuntimeSurfaceResource",
    "startRuntimeSurfaceResources",
  ].sort(),
);
const EXPECTED_TYPE_EXPORTS = Object.freeze(
  [
    "RuntimeResourceInitialStartEntry",
    "RuntimeResourceInputResolutionRejected",
    "RuntimeResourceInputSchemaRejected",
    "RuntimeResourceLimitProfile",
    "RuntimeResourceLoadStarted",
    "RuntimeResourceManualSkipped",
    "RuntimeResourcePolicy",
    "RuntimeResourceRefreshInput",
    "RuntimeResourceRefreshResult",
    "RuntimeResourceSettlement",
    "RuntimeResourceSnapshotLimitRejected",
    "RuntimeSurfaceResourceSpec",
    "RuntimeSurfaceResourcesDisposeResult",
    "RuntimeSurfaceResourcesHandle",
    "RuntimeSurfaceResourcesMountInput",
    "RuntimeSurfaceResourcesMountInvalid",
    "RuntimeSurfaceResourcesMountInvalidReason",
    "RuntimeSurfaceResourcesMountResult",
    "RuntimeSurfaceResourcesMounted",
    "RuntimeSurfaceResourcesReadResult",
    "RuntimeSurfaceResourcesSnapshot",
    "RuntimeSurfaceResourcesStartResult",
  ].sort(),
);
const EXPECTED_SOURCE_IMPORTS = Object.freeze(
  [
    "./host-ports.js",
    "./runtime-json-snapshot.js",
    "./token-format-resolution.js",
    "./value-resolution.js",
    "@desen/protocol",
    "@desen/validator",
  ].sort(),
);
const EXPECTED_FOCUSED_TESTS = 52;
const EXPECTED_COMPILER_NEGATIVE_CASES = 9;
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/resource-lifecycle.test.ts";
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-019",
    owners: Object.freeze(["M04-T08"]),
  }),
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-024",
    owners: Object.freeze(["M04-T08"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-042",
    owners: Object.freeze(["M02-T11", "M04-T08"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-055",
    owners: Object.freeze(["M02-T11", "M04-T08"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-079",
    owners: Object.freeze(["M02-T11", "M04-T08", "M04-T11"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-090",
    owners: Object.freeze(["M03-T02", "M04-T08", "M12-T03"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-114",
    owners: Object.freeze(["M04-T08", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-122",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-027",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T08"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-028",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T08"]),
  }),
]);
const FINDING_HEADING =
  "## PF-038 — Resource lifecycle start, refresh, technical failures, and stale settlement require a deterministic runtime profile";
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T08",
  "atomic",
  "factory-authenticated M02-T11",
  "`mount` and `once`",
  "`manual`",
  "Promise microtask",
  "M04-T03",
  "single input-wide token cache",
  "candidate request identifier",
  "exact current resource snapshot object",
  "ABA",
  "RESOURCE_INPUT_INVALID",
  "RESOURCE_OUTPUT_INVALID",
  "ADAPTER_FAILURE",
  "superseded",
  "stale",
  "RFC 8785",
  "64",
  "terminal snapshot",
  "without a receiver",
  "terminal and idempotent",
  "PIPE-019",
  "PIPE-024",
  "PF-038",
  "M04-T16",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T08 resource evidence",
  "builds byte-identical resource evidence twice",
  "rejects stale or tampered resource evidence",
  "rejects stale M04-T03 prerequisite bytes",
  "rejects stale M04-T07 prerequisite bytes",
  "rejects stale M02-T11 prerequisite bytes",
  "detects mount atomicity and host-isolation drift",
  "detects policy ordering and pending-publication drift",
  "detects input-validation-before-host drift",
  "detects manager snapshot identity and ABA drift",
  "detects token-format atomicity and candidate-id drift",
  "detects output validation and public-error drift",
  "detects denial and adapter-failure containment drift",
  "detects output-diagnostic redaction and freezing drift",
  "detects refresh supersession and stale-envelope drift",
  "detects deterministic request-identity drift",
  "detects finite limits and terminal-reservation drift",
  "detects active-transport queue and queued-replacement drift",
  "detects receiver-dependent callback drift",
  "detects disposal and late-settlement drift",
  "detects disposal-sentinel source drift",
  "detects public export, TSDoc, and platform drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/resource-lifecycle.ts",
  "packages/runtime-core/test/resource-lifecycle.test.ts",
  "packages/runtime-core/test/resource-lifecycle.types.ts",
  "packages/runtime-core/dist/resource-lifecycle.js",
  "packages/runtime-core/dist/resource-lifecycle.js.map",
  "packages/runtime-core/dist/resource-lifecycle.d.ts",
  "packages/runtime-core/dist/resource-lifecycle.d.ts.map",
  "scripts/lib/runtime-core-resource-lifecycle-proof.mjs",
  "scripts/generate-runtime-core-resource-lifecycle-proof.mjs",
  "scripts/verify-runtime-core-resource-lifecycle.mjs",
  "tests/runtime-core-resource-lifecycle.test.mjs",
]);
const FORBIDDEN_RUNTIME_IDENTIFIERS = Object.freeze([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch",
  "Request",
  "Response",
  "WebSocket",
  "HTMLElement",
  "CSSStyleSheet",
  "Date",
  "Intl",
  "performance",
  "process",
  "Buffer",
  "globalThis",
  "require",
  "eval",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "AbortController",
  "React",
  "ReactNative",
  "SwiftUI",
  "Compose",
]);

/** Stable error class used by deterministic M04-T08 evidence and hostile mutation tests. */
export class RuntimeCoreResourceLifecycleEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreResourceLifecycleEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreResourceLifecycleEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("RESOURCE_EVIDENCE_OPTIONS_INVALID", "Evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? Buffer.from(override) : Buffer.from(String(override));
  }
  return readFile(path.join(WORKSPACE_ROOT, relativePath));
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function assertArrayEqual(actual, expected, code, label) {
  if (
    !Array.isArray(actual) ||
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(code, `${label} changed.`, { expected, actual });
  }
}

function plainData(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDataEqual(actual, expected, label) {
  const normalized = plainData(actual);
  if (!isDeepStrictEqual(normalized, expected)) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
      expected,
      actual: normalized,
    });
  }
}

function assertDeepFrozen(value, label) {
  const pending = [value];
  const visited = new WeakSet();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || visited.has(current)) continue;
    visited.add(current);
    if (!Object.isFrozen(current)) {
      fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
    }
    pending.push(...Object.values(current));
  }
}

function sourceFile(sourceText, fileName, scriptKind = ts.ScriptKind.TS) {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2023, true, scriptKind);
}

function exportedDeclarations(sourceText, fileName, scriptKind = ts.ScriptKind.TS) {
  const parsed = sourceFile(sourceText, fileName, scriptKind);
  const runtimeExports = [];
  const typeExports = [];
  const missingTsdoc = [];
  for (const statement of parsed.statements) {
    if (!statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) continue;
    let names = [];
    if (ts.isVariableStatement(statement)) {
      names = statement.declarationList.declarations
        .map(({ name }) => name)
        .filter(ts.isIdentifier)
        .map(({ text }) => text);
    } else if (statement.name !== undefined && ts.isIdentifier(statement.name)) {
      names = [statement.name.text];
    }
    const target =
      ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        ? typeExports
        : runtimeExports;
    target.push(...names);
    if (names.length > 0 && ts.getJSDocCommentsAndTags(statement).length === 0) {
      missingTsdoc.push(...names);
    }
  }
  return Object.freeze({
    sourceFile: parsed,
    runtimeExports: Object.freeze(runtimeExports.sort()),
    typeExports: Object.freeze(typeExports.sort()),
    missingTsdoc: Object.freeze(missingTsdoc.sort()),
  });
}

function assertDirectExports(inventory, code, label) {
  for (const statement of inventory.sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.length === 0
    ) {
      continue;
    }
    if (
      ts.isExportAssignment(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      fail(code, `${label} permits only direct named declarations.`);
    }
  }
}

function importedModules(parsed) {
  const modules = [];
  for (const statement of parsed.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      fail("RESOURCE_IMPORT_BOUNDARY_DRIFT", "Resource imports must use literal module names.");
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(parsed, code = "RESOURCE_PLATFORM_BOUNDARY_DRIFT") {
  const found = new Set();
  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_RUNTIME_IDENTIFIERS.includes(node.text)) {
      found.add(node.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Math" &&
      node.expression.name.text === "random"
    ) {
      found.add("Math.random");
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      found.add("Function");
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.add("dynamic-import");
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (found.size > 0) {
    fail(code, "Resource lifecycle crossed its deterministic platform-neutral boundary.", {
      found: [...found].sort(),
    });
  }
}

function moduleIndexExports(sourceText, fileName) {
  const parsed = sourceFile(
    sourceText,
    fileName,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtimeExports = [];
  const typeExports = [];
  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "./resource-lifecycle.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "RESOURCE_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased resource exports.`,
      );
    }
    for (const element of statement.exportClause.elements) {
      const target = statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports;
      target.push(element.name.text);
    }
  }
  return Object.freeze({
    runtimeExports: Object.freeze(runtimeExports.sort()),
    typeExports: Object.freeze(typeExports.sort()),
  });
}

function normalizeSource(sourceText) {
  return sourceText.replaceAll(/\s+/gu, " ");
}

function verifySourceInvariants(sourceText) {
  const normalized = normalizeSource(sourceText);
  const required = [
    "validateDesenExecutionCatalogSet(envelope.catalogSet)",
    "catalogValidation.value !== envelope.catalogSet",
    "maxActiveTransports: 64",
    "maxSnapshotGeneration: RUNTIME_RESOURCE_LIMITS.maxSnapshotGeneration",
    "maxAttemptGeneration: RUNTIME_RESOURCE_LIMITS.maxAttemptGeneration",
    "for (const instanceId of Object.keys(envelope.resources).sort(compareText))",
    "if (resourceSnapshot !== authority.snapshot) return false;",
    "canonicalizeJson(snapshot.resource) === canonicalizeJson(authority.snapshot.lifecycles)",
    "const keys = Object.keys(record.input).sort(compareText);",
    "materialization = materializeRuntimeValue(specs, snapshot,",
    "return Reflect.apply(authority.hostPorts.tokens.resolve, undefined, [request]);",
    '{ kind: "resource-input", capabilityId: record.capabilityId }',
    "return `resource:${canonicalizeJson([record.instanceId, generation])}`;",
    "record.nextAttemptGeneration += 1;",
    "authority.reservedSnapshotTransitions += 1;",
    "authority.reservedSnapshotTransitions -= 1;",
    'record.lifecycle = Object.freeze({ status: "pending", pending: true });',
    "authority.launchQueue.push(Object.freeze({ record, attempt }));",
    "authority.outstandingTransports < authority.limits.maxActiveTransports",
    "removeQueuedAttempt(authority, previousAttempt);",
    "void Promise.resolve(result).then(",
    "Reflect.apply(authority.hostPorts.resources.load, undefined, [attempt.request])",
    "Reflect.apply(authority.hostPorts.diagnostics.report, undefined, [diagnostic])",
    'authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed',
    '{ kind: "resource-output", capabilityId: record.capabilityId }',
    '"The resource adapter returned output that does not satisfy its declared contract."',
    "run.desen.runtime/RESOURCE_RETAINED_LIMIT_EXCEEDED",
    "run.desen.runtime/RESOURCE_SNAPSHOT_LIMIT_EXCEEDED",
    'if (record.policy === "manual")',
    "const previousAttempt = record.currentAttempt;",
    "supersedeAttempt(authority, previousAttempt, pendingSnapshot);",
    'authority.status = "disposed";',
    "authority.records.clear();",
    "RESOURCE_AUTHORITIES.set(handle as object, DISPOSED_RESOURCE_AUTHORITY);",
  ];
  for (const invariant of required) {
    if (!normalized.includes(invariant)) {
      fail(
        "RESOURCE_SOURCE_SEMANTIC_DRIFT",
        `Resource implementation is missing reviewed invariant: ${invariant}`,
      );
    }
  }

  const startMarker = normalized.indexOf("authority.started = true;");
  const startReservation = normalized.indexOf("if (!canReserveAttempt(authority))", startMarker);
  const startCandidate = normalized.indexOf(
    "const requestId = nextAttemptRequestId(authority, record);",
    startReservation,
  );
  const startPreparation = normalized.indexOf(
    "const prepared = prepareResourceInput(authority, record, snapshot, requestId);",
    startCandidate,
  );
  const startAllocation = normalized.indexOf(
    "const attempt = createAttempt(authority, record, prepared.value);",
    startPreparation,
  );
  const startPending = normalized.indexOf(
    "const pendingSnapshot = attempts.length > 0 ? publishSnapshot(authority, true)",
    startAllocation,
  );
  const startLaunch = normalized.indexOf(
    "scheduleAttempt(authority, record, attempt);",
    startPending,
  );
  const startDiagnostics = normalized.indexOf("safeReport(authority, diagnostics);", startLaunch);
  if (
    startMarker < 0 ||
    startReservation <= startMarker ||
    startCandidate <= startReservation ||
    startPreparation <= startCandidate ||
    startAllocation <= startPreparation ||
    startPending <= startAllocation ||
    startLaunch <= startPending ||
    startDiagnostics <= startLaunch
  ) {
    fail(
      "RESOURCE_SOURCE_SEMANTIC_DRIFT",
      "Initial start must close reentry, prepare inputs, publish pending, launch, then report.",
    );
  }

  const settlementGuard = normalized.indexOf(
    'authority.status !== "live" || record.currentAttempt !== attempt || attempt.completed',
  );
  const settlementInspection = normalized.indexOf(
    "const result = closedHostResult(rawResult);",
    settlementGuard,
  );
  if (settlementGuard < 0 || settlementInspection <= settlementGuard) {
    fail(
      "RESOURCE_SOURCE_SEMANTIC_DRIFT",
      "Stale settlement authority must be checked before inspecting a host envelope.",
    );
  }

  const refreshStart = normalized.indexOf("export function refreshRuntimeSurfaceResource(");
  const previousAttempt = normalized.indexOf(
    "const previousAttempt = record.currentAttempt;",
    refreshStart,
  );
  const refreshReservation = normalized.indexOf(
    "if (!canReserveAttempt(authority, previousAttempt))",
    previousAttempt,
  );
  const refreshCandidate = normalized.indexOf(
    "const requestId = nextAttemptRequestId(authority, record);",
    refreshReservation,
  );
  const refreshPreparation = normalized.indexOf(
    "const prepared = prepareResourceInput(authority, record, snapshot, requestId);",
    refreshCandidate,
  );
  const refreshAllocation = normalized.indexOf(
    "const attempt = createAttempt(authority, record, prepared.value);",
    refreshPreparation,
  );
  const refreshPending = normalized.indexOf(
    "const pendingSnapshot = publishSnapshot(authority, true);",
    refreshAllocation,
  );
  const refreshSupersede = normalized.indexOf(
    "supersedeAttempt(authority, previousAttempt, pendingSnapshot);",
    refreshPending,
  );
  const refreshLaunch = normalized.indexOf(
    "scheduleAttempt(authority, record, attempt);",
    refreshSupersede,
  );
  if (
    previousAttempt < 0 ||
    refreshReservation <= previousAttempt ||
    refreshCandidate <= refreshReservation ||
    refreshPreparation < 0 ||
    refreshPreparation <= refreshCandidate ||
    refreshAllocation <= refreshPreparation ||
    refreshPending <= refreshAllocation ||
    refreshSupersede <= refreshPending ||
    refreshLaunch <= refreshSupersede
  ) {
    fail(
      "RESOURCE_SOURCE_SEMANTIC_DRIFT",
      "Refresh must validate before supersession and publish pending before host launch.",
    );
  }
}

function verifyPublicApi({
  sourceText,
  declarationText,
  builtJavaScript,
  sourceIndexText,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = exportedDeclarations(sourceText, "resource-lifecycle.ts");
  assertDirectExports(source, "RESOURCE_SOURCE_EXPORT_DRIFT", "Resource source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "RESOURCE_SOURCE_EXPORT_DRIFT",
    "Resource source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "RESOURCE_SOURCE_EXPORT_DRIFT",
    "Resource source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("RESOURCE_TSDOC_MISSING", "Every exported resource declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_SOURCE_IMPORTS,
    "RESOURCE_IMPORT_BOUNDARY_DRIFT",
    "Resource source imports",
  );
  verifyPlatformBoundary(source.sourceFile);
  verifySourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "resource-lifecycle.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(declaration, "RESOURCE_DECLARATION_DRIFT", "Resource declaration");
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "RESOURCE_DECLARATION_DRIFT",
    "Built resource runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "RESOURCE_DECLARATION_DRIFT",
    "Built resource type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("RESOURCE_DECLARATION_DRIFT", "Built resource declarations lost TSDoc.", {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "RESOURCE_DECLARATION_DRIFT");

  const built = exportedDeclarations(builtJavaScript, "resource-lifecycle.js", ts.ScriptKind.JS);
  assertDirectExports(built, "RESOURCE_DISTRIBUTION_DRIFT", "Built resource JavaScript");
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "RESOURCE_DISTRIBUTION_DRIFT",
    "Built resource JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "RESOURCE_DISTRIBUTION_DRIFT",
    "Built resource JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "RESOURCE_DISTRIBUTION_DRIFT");

  for (const [text, fileName, expectedTypes] of [
    [sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexJavaScript, "dist/index.js", []],
  ]) {
    const exports = moduleIndexExports(text, fileName);
    assertArrayEqual(
      exports.runtimeExports,
      EXPECTED_RUNTIME_EXPORTS,
      "RESOURCE_INDEX_EXPORT_DRIFT",
      `${fileName} resource runtime exports`,
    );
    assertArrayEqual(
      exports.typeExports,
      expectedTypes,
      "RESOURCE_INDEX_EXPORT_DRIFT",
      `${fileName} resource type exports`,
    );
  }

  return Object.freeze({
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    tsdocDeclarations: source.runtimeExports.length + source.typeExports.length,
    sourceImports: EXPECTED_SOURCE_IMPORTS,
  });
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function literalTitle(node, label) {
  const unwrapped = unwrapExpression(node);
  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }
  fail("RESOURCE_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "resource-lifecycle.test.ts");
  const registrations = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "it") {
        registrations.push(
          Object.freeze({ title: literalTitle(node.arguments[0], "Focused test"), cases: 1 }),
        );
      } else if (
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === "it" &&
        node.expression.expression.name.text === "each"
      ) {
        const table = unwrapExpression(node.expression.arguments[0]);
        if (!ts.isArrayLiteralExpression(table)) {
          fail("RESOURCE_TEST_INVENTORY_DRIFT", "it.each must use a static array table.");
        }
        registrations.push(
          Object.freeze({
            title: literalTitle(node.arguments[0], "Parameterized focused test"),
            cases: table.elements.length,
          }),
        );
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "it" &&
        ["skip", "only", "todo"].includes(node.expression.name.text)
      ) {
        fail("RESOURCE_TEST_INVENTORY_DRIFT", "Focused resource tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail("RESOURCE_TEST_INVENTORY_DRIFT", "Focused resource test titles must be unique.");
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("RESOURCE_TEST_INVENTORY_DRIFT", "Focused resource test case count changed.", {
      expected: EXPECTED_FOCUSED_TESTS,
      actual: cases,
    });
  }
  return Object.freeze({
    registrations: registrations.length,
    cases,
    titles: Object.freeze(titles),
  });
}

function compilerNegativeInventory(typeTestText) {
  if (typeTestText.includes("@ts-ignore")) {
    fail("RESOURCE_TYPE_TEST_DRIFT", "Compiler-negative evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("RESOURCE_TYPE_TEST_DRIFT", "Compiler-negative resource inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-resource-lifecycle.test.mjs",
    ts.ScriptKind.JS,
  );
  const titles = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "test") {
        titles.push(literalTitle(node.arguments[0], "Root mutation test"));
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "test" &&
        ["skip", "only", "todo"].includes(node.expression.name.text)
      ) {
        fail("RESOURCE_ROOT_TEST_DRIFT", "Root resource tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "RESOURCE_ROOT_TEST_DRIFT",
    "Root resource mutation titles",
  );
  return Object.freeze(titles);
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  if (runtimeManifest.scripts?.["test:resource-lifecycle"] !== EXPECTED_PACKAGE_TEST_SCRIPT) {
    fail(
      "RESOURCE_PACKAGE_WIRING_DRIFT",
      "The runtime package resource test command changed or is absent.",
    );
  }
  return Object.freeze({
    focused: collectFocusedTests(packageTests),
    compilerNegativeLabels: compilerNegativeInventory(typeTests),
    rootTitles: rootTestInventory(rootTests),
  });
}

async function verifyPrerequisite(prerequisite, injectedBytes) {
  const bytes =
    injectedBytes === undefined
      ? await readWorkspaceBytes(prerequisite.path)
      : Buffer.from(injectedBytes);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== prerequisite.sha256) {
    fail("RESOURCE_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite hash changed.`, {
      task: prerequisite.task,
      expectedSha256: prerequisite.sha256,
      actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("RESOURCE_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite is not valid JSON.`);
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== prerequisite.task ||
    artifact.result !== "PASS"
  ) {
    fail("RESOURCE_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite identity changed.`);
  }
  return Object.freeze({
    task: prerequisite.task,
    result: "PASS",
    artifact: prerequisite.artifact,
    artifactSha256: actualSha256,
  });
}

function verifyTrace(trace) {
  return Object.freeze(
    EXPECTED_TRACE_RULES.map((expected) => {
      const observed = trace[expected.collection]?.find(({ id }) => id === expected.id);
      if (observed === undefined) {
        fail("RESOURCE_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "RESOURCE_TRACE_DRIFT",
        `${expected.id} owners`,
      );
      return Object.freeze({
        id: observed.id,
        section: observed.section,
        owners: Object.freeze([...observed.owners]),
      });
    }),
  );
}

function verifyDocumentation(findings, proofDocument) {
  const start = findings.indexOf(FINDING_HEADING);
  if (start < 0) {
    fail("RESOURCE_FINDING_DRIFT", "PF-038 heading is missing.");
  }
  const next = findings.indexOf("\n## PF-", start + FINDING_HEADING.length);
  const section = findings.slice(start, next < 0 ? findings.length : next);
  if (!section.includes("- Status: OPEN") || !section.includes("- Blocks proof: No")) {
    fail("RESOURCE_FINDING_DRIFT", "PF-038 must remain OPEN and non-blocking.");
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("RESOURCE_PROOF_DOCUMENT_DRIFT", `M04-T08 proof is missing: ${required}`);
    }
  }
  return Object.freeze({
    finding: "PF-038",
    findingStatus: "OPEN",
    proofDocument: "docs/proof/RUNTIME-CORE-RESOURCE-LIFECYCLE.md",
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function prepareCatalog(validatorApi, catalogText, mutate = undefined) {
  let catalog;
  try {
    catalog = JSON.parse(catalogText);
  } catch {
    fail("RESOURCE_CATALOG_FIXTURE_DRIFT", "The frozen web Catalog fixture is invalid JSON.");
  }
  mutate?.(catalog);
  const result = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  if (!result.valid) {
    fail("RESOURCE_CATALOG_FIXTURE_DRIFT", "The runtime proof Catalog no longer prepares.", {
      diagnostics: plainData(result.diagnostics),
    });
  }
  return result.value;
}

function createHostPorts(
  api,
  load,
  report = () => undefined,
  resolveToken = () => ({ status: "missing" }),
) {
  return api.createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: {
          activeRevision: `sha256:${"a".repeat(64)}`,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load },
    tokens: { resolve: resolveToken },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report },
  });
}

const DOCUMENT_ID = "com.desen.proof";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "proof-surface";
const STORES = "com.example.stores/list";
const TASKS = "com.example.tasks/list";

function mountInput(catalogSet, hostPorts, resources, limits = undefined) {
  return {
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources,
    catalogSet,
    hostPorts,
    ...(limits === undefined ? {} : { limits }),
  };
}

function mustMount(api, input, label) {
  const result = api.mountRuntimeSurfaceResources(input);
  if (result.status !== "mounted") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", `${label} did not mount.`, {
      actual: plainData(result),
    });
  }
  return result;
}

function resolutionSnapshot(api, snapshot, state = {}, resource = snapshot.lifecycles) {
  return api.createRuntimeResolutionSnapshot({
    state,
    context: {},
    resource,
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: {},
  });
}

function startedEntry(result, instanceId) {
  if (result.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Resource start no longer succeeds.", {
      actual: plainData(result),
    });
  }
  const entry = result.entries.find((candidate) => candidate.instanceId === instanceId);
  if (entry?.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", `${instanceId} did not start.`, {
      actual: plainData(result.entries),
    });
  }
  return entry;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

function successFor(request) {
  return request.capabilityId === TASKS
    ? { status: "succeeded", value: [] }
    : { status: "succeeded", value: { items: [], bounds: {} } };
}

async function settleOne(api, catalogSet, load) {
  const mounted = mustMount(
    api,
    mountInput(catalogSet, createHostPorts(api, load), {
      stores: { use: STORES, input: {}, policy: "mount" },
    }),
    "Settlement fixture",
  );
  const started = api.startRuntimeSurfaceResources(
    mounted.handle,
    resolutionSnapshot(api, mounted.snapshot),
    mounted.snapshot,
  );
  return startedEntry(started, "stores").settlement;
}

async function probeRuntimeBehavior(api, validatorApi, catalogText) {
  const catalogSet = prepareCatalog(validatorApi, catalogText);

  const unrestrictedDocumentId = "https://desen.app/kanıt/资源";
  const unrestrictedMounted = mustMount(
    api,
    {
      ...mountInput(catalogSet, createHostPorts(api, successFor), {}),
      documentId: unrestrictedDocumentId,
    },
    "Unrestricted document identity fixture",
  );
  if (unrestrictedMounted.snapshot.documentId !== unrestrictedDocumentId) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Frozen-schema document identity was narrowed.");
  }
  const invalidLimits = api.mountRuntimeSurfaceResources(
    mountInput(catalogSet, createHostPorts(api, successFor), {}, { maxActiveTransports: 0 }),
  );
  if (invalidLimits.status !== "invalid" || invalidLimits.reason !== "malformed-input") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Invalid lowered resource limits were accepted.");
  }

  const loadCalls = [];
  const observedDuringLoad = [];
  const resourceReceivers = [];
  let policyHandle;
  const policyPorts = createHostPorts(api, function (request) {
    resourceReceivers.push(this);
    loadCalls.push(cloneJson(request));
    const read = api.readRuntimeSurfaceResources(policyHandle);
    observedDuringLoad.push(
      read.status === "read" ? cloneJson(read.snapshot.lifecycles) : { status: read.status },
    );
    return successFor(request);
  });
  const policyMounted = mustMount(
    api,
    mountInput(catalogSet, policyPorts, {
      zOnce: { use: TASKS, input: {}, policy: "once" },
      aMount: { use: STORES, input: {}, policy: "mount" },
      mManual: { use: STORES, input: {}, policy: "manual" },
    }),
    "Policy fixture",
  );
  policyHandle = policyMounted.handle;
  if (loadCalls.length !== 0) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Mount called the resource host.");
  }
  assertDataEqual(
    policyMounted.snapshot,
    {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      lifecycles: {
        aMount: { status: "idle", pending: false },
        mManual: { status: "idle", pending: false },
        zOnce: { status: "idle", pending: false },
      },
    },
    "Atomic idle mount",
  );
  assertDeepFrozen(policyMounted.snapshot, "Mounted resource snapshot");

  const malformed = api.mountRuntimeSurfaceResources(
    mountInput(catalogSet, policyPorts, {
      accepted: { use: STORES, input: {}, policy: "mount" },
      rejected: { use: STORES, input: {}, policy: "network-first" },
    }),
  );
  if (
    malformed.status !== "invalid" ||
    malformed.reason !== "malformed-input" ||
    Object.hasOwn(malformed, "handle")
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Malformed mount is no longer atomic.", {
      actual: plainData(malformed),
    });
  }

  const foreignMounted = mustMount(
    api,
    mountInput(catalogSet, createHostPorts(api, successFor), {}),
    "Foreign manager fixture",
  );
  const foreignStart = api.startRuntimeSurfaceResources(
    policyHandle,
    resolutionSnapshot(api, policyMounted.snapshot),
    foreignMounted.snapshot,
  );
  const abaStart = api.startRuntimeSurfaceResources(
    policyHandle,
    resolutionSnapshot(api, policyMounted.snapshot),
    cloneJson(policyMounted.snapshot),
  );
  if (foreignStart.status !== "invalid-snapshot" || abaStart.status !== "invalid-snapshot") {
    fail(
      "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
      "Foreign or structurally ABA-equal resource snapshots gained manager authority.",
    );
  }

  const started = api.startRuntimeSurfaceResources(
    policyHandle,
    resolutionSnapshot(api, policyMounted.snapshot),
    policyMounted.snapshot,
  );
  if (started.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Policy batch did not start.");
  }
  assertDataEqual(
    started.entries.map(({ instanceId, status, requestId }) => ({
      instanceId,
      status,
      ...(requestId === undefined ? {} : { requestId }),
    })),
    [
      { instanceId: "aMount", status: "started", requestId: 'resource:["aMount",0]' },
      { instanceId: "mManual", status: "manual" },
      { instanceId: "zOnce", status: "started", requestId: 'resource:["zOnce",0]' },
    ],
    "Policy start order and request identity",
  );
  if (resourceReceivers.some((receiver) => receiver !== undefined)) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Resource host callback gained a receiver.");
  }
  assertDataEqual(
    started.snapshot.lifecycles,
    {
      aMount: { status: "pending", pending: true },
      mManual: { status: "idle", pending: false },
      zOnce: { status: "pending", pending: true },
    },
    "Atomic pending publication",
  );
  assertDataEqual(
    loadCalls.map(({ instanceId }) => instanceId),
    ["aMount", "zOnce"],
    "Canonical host call order",
  );
  for (const observed of observedDuringLoad) {
    assertDataEqual(
      observed,
      {
        aMount: { status: "pending", pending: true },
        mManual: { status: "idle", pending: false },
        zOnce: { status: "pending", pending: true },
      },
      "Pending state observed by host callback",
    );
  }
  const immediate = api.readRuntimeSurfaceResources(policyHandle);
  if (immediate.status !== "read" || immediate.snapshot.lifecycles.aMount?.status !== "pending") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Synchronous host return skipped pending.");
  }
  const policySettlements = await Promise.all(
    started.entries
      .filter(({ status }) => status === "started")
      .map(({ settlement }) => settlement),
  );
  if (policySettlements.some(({ status }) => status !== "succeeded")) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Valid automatic resource settlement changed.");
  }
  const startAgain = api.startRuntimeSurfaceResources(
    policyHandle,
    resolutionSnapshot(api, policyMounted.snapshot),
    policyMounted.snapshot,
  );
  if (startAgain.status !== "already-started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Initial resource start is no longer one-shot.");
  }

  let inputHostCalls = 0;
  const inputMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, (request) => {
        inputHostCalls += 1;
        return successFor(request);
      }),
      {
        stores: {
          use: STORES,
          input: { region: { $ref: "state.filters.region" } },
          policy: "mount",
        },
      },
    ),
    "Input-rejection fixture",
  );
  const rejectedInput = api.startRuntimeSurfaceResources(
    inputMounted.handle,
    resolutionSnapshot(api, inputMounted.snapshot),
    inputMounted.snapshot,
  );
  if (
    rejectedInput.status !== "started" ||
    rejectedInput.entries[0]?.status !== "input-rejected" ||
    rejectedInput.entries[0]?.reason !== "resolution" ||
    inputHostCalls !== 0 ||
    rejectedInput.snapshot.generation !== 0
  ) {
    fail(
      "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
      "Unresolved input allocated, published, or called the host.",
      { actual: plainData(rejectedInput), inputHostCalls },
    );
  }

  let reentrantResult;
  let reentrantHandle;
  let reentrantSnapshot;
  let reentrantResourceSnapshot;
  const invalidSchemaCatalog = prepareCatalog(validatorApi, catalogText, (catalog) => {
    catalog.resources[STORES].inputSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["region"],
      properties: { region: { type: "string", minLength: 2 } },
    };
  });
  const reentrantMounted = mustMount(
    api,
    mountInput(
      invalidSchemaCatalog,
      createHostPorts(
        api,
        () => successFor({ capabilityId: STORES }),
        () => {
          reentrantResult = api.startRuntimeSurfaceResources(
            reentrantHandle,
            reentrantSnapshot,
            reentrantResourceSnapshot,
          );
        },
      ),
      {
        stores: { use: STORES, input: { region: "" }, policy: "mount" },
      },
    ),
    "Diagnostic reentry fixture",
  );
  reentrantHandle = reentrantMounted.handle;
  reentrantSnapshot = resolutionSnapshot(api, reentrantMounted.snapshot);
  reentrantResourceSnapshot = reentrantMounted.snapshot;
  const rejectedSchema = api.startRuntimeSurfaceResources(
    reentrantHandle,
    reentrantSnapshot,
    reentrantResourceSnapshot,
  );
  if (
    rejectedSchema.status !== "started" ||
    rejectedSchema.entries[0]?.status !== "input-rejected" ||
    reentrantResult?.status !== "already-started"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Diagnostic reentry reopened initial start.");
  }

  let disposalHandle;
  const reentrantCalls = [];
  const disposalMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, (request) => {
        reentrantCalls.push(request.instanceId);
        api.disposeRuntimeSurfaceResources(disposalHandle);
        return successFor(request);
      }),
      {
        aFirst: { use: STORES, input: {}, policy: "mount" },
        zLater: { use: STORES, input: {}, policy: "mount" },
      },
    ),
    "Host disposal reentry fixture",
  );
  disposalHandle = disposalMounted.handle;
  const disposedStart = api.startRuntimeSurfaceResources(
    disposalHandle,
    resolutionSnapshot(api, disposalMounted.snapshot),
    disposalMounted.snapshot,
  );
  if (disposedStart.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Reentrant disposal fixture did not start.");
  }
  const disposedSettlements = await Promise.all(
    disposedStart.entries.map(({ settlement }) => settlement),
  );
  assertDataEqual(reentrantCalls, ["aFirst"], "Reentrant disposal launch boundary");
  if (disposedSettlements.some(({ status }) => status !== "disposed")) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Reentrant disposal did not revoke queued attempts.");
  }

  const tokenCatalog = prepareCatalog(validatorApi, catalogText, (catalog) => {
    catalog.resources[STORES].inputSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["label", "region"],
      properties: {
        label: { type: "string" },
        region: { type: "string" },
      },
    };
  });
  const tokenCalls = [];
  const tokenReceivers = [];
  const tokenLoads = [];
  let tokenHolder;
  let tokenReentry;
  const tokenMounted = mustMount(
    api,
    mountInput(
      tokenCatalog,
      createHostPorts(
        api,
        (request) => {
          tokenLoads.push(cloneJson(request));
          return successFor(request);
        },
        () => undefined,
        function (request) {
          tokenReceivers.push(this);
          tokenCalls.push(cloneJson(request));
          tokenReentry = api.refreshRuntimeSurfaceResource(tokenHolder.handle, {
            instanceId: "stores",
            resourceSnapshot: tokenHolder.snapshot,
            snapshot: resolutionSnapshot(api, tokenHolder.snapshot),
          }).status;
          return { status: "resolved", value: "eu" };
        },
      ),
      {
        stores: {
          use: STORES,
          input: {
            label: {
              $format: {
                template: "Store {region}",
                values: { region: { $token: "region.default" } },
              },
            },
            region: { $token: "region.default" },
          },
          policy: "mount",
        },
      },
    ),
    "Token-format fixture",
  );
  tokenHolder = tokenMounted;
  const tokenStart = api.startRuntimeSurfaceResources(
    tokenMounted.handle,
    resolutionSnapshot(api, tokenMounted.snapshot),
    tokenMounted.snapshot,
  );
  const tokenEntry = startedEntry(tokenStart, "stores");
  await tokenEntry.settlement;
  if (
    tokenCalls.length !== 1 ||
    tokenCalls[0]?.context?.requestId !== 'resource:["stores",0]' ||
    tokenReceivers.some((receiver) => receiver !== undefined) ||
    tokenReentry !== "busy"
  ) {
    fail(
      "RESOURCE_RUNTIME_BEHAVIOR_DRIFT",
      "Token cache, candidate request identity, receiver, or transition reentry changed.",
      { tokenCalls, tokenReentry },
    );
  }
  assertDataEqual(
    tokenLoads.map(({ input }) => input),
    [{ label: "Store eu", region: "eu" }],
    "Atomic token-format input materialization",
  );

  const candidateCatalog = prepareCatalog(validatorApi, catalogText, (catalog) => {
    catalog.resources[STORES].inputSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["region"],
      properties: { region: { type: "string" } },
    };
  });
  const candidateTokenIds = [];
  let candidateCalls = 0;
  let candidateHostCalls = 0;
  const candidateMounted = mustMount(
    api,
    mountInput(
      candidateCatalog,
      createHostPorts(
        api,
        (request) => {
          candidateHostCalls += 1;
          return successFor(request);
        },
        () => undefined,
        (request) => {
          candidateCalls += 1;
          candidateTokenIds.push(request.context.requestId);
          if (candidateCalls === 1) throw new Error("private token failure");
          return { status: "resolved", value: "eu" };
        },
      ),
      {
        stores: {
          use: STORES,
          input: { region: { $token: "region.default" } },
          policy: "mount",
        },
      },
    ),
    "Candidate identity fixture",
  );
  const candidateStart = api.startRuntimeSurfaceResources(
    candidateMounted.handle,
    resolutionSnapshot(api, candidateMounted.snapshot),
    candidateMounted.snapshot,
  );
  if (
    candidateStart.status !== "started" ||
    candidateStart.entries[0]?.status !== "input-rejected" ||
    candidateStart.entries[0]?.resolution?.status !== "failed" ||
    candidateHostCalls !== 0 ||
    JSON.stringify(candidateStart).includes("private token failure")
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Token failure containment changed.");
  }
  const candidateRefresh = api.refreshRuntimeSurfaceResource(candidateMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: candidateMounted.snapshot,
    snapshot: resolutionSnapshot(api, candidateMounted.snapshot),
  });
  if (
    candidateRefresh.status !== "started" ||
    candidateRefresh.requestId !== 'resource:["stores",0]'
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Rejected candidate consumed request identity.");
  }
  await candidateRefresh.settlement;
  assertDataEqual(
    candidateTokenIds,
    ['resource:["stores",0]', 'resource:["stores",0]'],
    "Non-consuming candidate request identity",
  );

  const mutableOutput = { items: [], bounds: {} };
  const successSettlement = await settleOne(api, catalogSet, () => ({
    status: "succeeded",
    value: mutableOutput,
  }));
  mutableOutput.items.push({ id: "late" });
  if (
    successSettlement.status !== "succeeded" ||
    successSettlement.snapshot.lifecycles.stores?.status !== "succeeded"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Valid resource output did not succeed.");
  }
  assertDataEqual(
    successSettlement.snapshot.lifecycles.stores.value,
    { items: [], bounds: {} },
    "Detached resource output",
  );
  assertDeepFrozen(successSettlement.snapshot, "Successful resource snapshot");

  const declaredFailure = await settleOne(api, catalogSet, () => ({
    status: "failed",
    errorCode: "unavailable",
  }));
  if (
    declaredFailure.status !== "failed" ||
    declaredFailure.errorCode !== "unavailable" ||
    declaredFailure.snapshot.lifecycles.stores?.error?.code !== "unavailable"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Declared public resource error changed.");
  }

  const invalidOutput = await settleOne(api, catalogSet, () => ({
    status: "succeeded",
    value: { "private-server-field": "must-not-leak" },
  }));
  if (
    invalidOutput.status !== "invalid-output" ||
    invalidOutput.diagnostics[0]?.code !== "RESOURCE_OUTPUT_INVALID" ||
    invalidOutput.snapshot.lifecycles.stores?.status !== "idle" ||
    JSON.stringify(invalidOutput).includes("must-not-leak") ||
    JSON.stringify(invalidOutput).includes("private-server-field") ||
    invalidOutput.diagnostics[0]?.pointer !== ""
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Invalid output containment changed.");
  }
  assertDeepFrozen(invalidOutput.diagnostics, "Invalid-output diagnostic array");

  const denied = await settleOne(api, catalogSet, () => ({ status: "denied" }));
  if (
    denied.status !== "denied" ||
    denied.diagnostics[0]?.code !== "run.desen.runtime/RESOURCE_DENIED" ||
    denied.snapshot.lifecycles.stores?.status !== "idle"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Host denial containment changed.");
  }
  assertDeepFrozen(denied.diagnostics, "Denied diagnostic array");

  const diagnosticReceivers = [];
  const receiverMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(
        api,
        () => ({ status: "denied" }),
        function () {
          diagnosticReceivers.push(this);
        },
      ),
      { stores: { use: STORES, input: {}, policy: "mount" } },
    ),
    "Diagnostic receiver fixture",
  );
  const receiverStart = api.startRuntimeSurfaceResources(
    receiverMounted.handle,
    resolutionSnapshot(api, receiverMounted.snapshot),
    receiverMounted.snapshot,
  );
  await startedEntry(receiverStart, "stores").settlement;
  if (
    diagnosticReceivers.length !== 1 ||
    diagnosticReceivers.some((receiver) => receiver !== undefined)
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Diagnostic callback gained a receiver.");
  }

  const undeclared = await settleOne(api, catalogSet, () => ({
    status: "failed",
    errorCode: "private-server-error",
  }));
  if (
    undeclared.status !== "adapter-failed" ||
    undeclared.diagnostics[0]?.code !== "ADAPTER_FAILURE" ||
    JSON.stringify(undeclared).includes("private-server-error")
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Undeclared host error was not redacted.");
  }

  const thrown = await settleOne(api, catalogSet, () => {
    throw new Error("private thrown value");
  });
  if (
    thrown.status !== "adapter-failed" ||
    thrown.diagnostics[0]?.code !== "ADAPTER_FAILURE" ||
    JSON.stringify(thrown).includes("private thrown value")
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Thrown host failure was not contained.");
  }

  const first = deferred();
  const second = deferred();
  const refreshQueue = [first, second];
  const refreshMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => refreshQueue.shift().promise),
      {
        stores: { use: STORES, input: {}, policy: "mount" },
      },
    ),
    "Refresh fixture",
  );
  const initialRefreshStart = api.startRuntimeSurfaceResources(
    refreshMounted.handle,
    resolutionSnapshot(api, refreshMounted.snapshot),
    refreshMounted.snapshot,
  );
  const initialRefreshEntry = startedEntry(initialRefreshStart, "stores");
  const refreshed = api.refreshRuntimeSurfaceResource(refreshMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: initialRefreshStart.snapshot,
    snapshot: resolutionSnapshot(api, initialRefreshStart.snapshot),
  });
  if (
    refreshed.status !== "started" ||
    initialRefreshEntry.requestId !== 'resource:["stores",0]' ||
    refreshed.requestId !== 'resource:["stores",1]'
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Refresh or request identity changed.", {
      actual: plainData(refreshed),
    });
  }
  const superseded = await initialRefreshEntry.settlement;
  if (superseded.status !== "superseded") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Accepted refresh did not supersede prior work.");
  }
  second.resolve({ status: "succeeded", value: { items: [], bounds: {} } });
  const refreshedSettlement = await refreshed.settlement;
  if (refreshedSettlement.status !== "succeeded") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Fresh refresh result did not settle.");
  }
  let staleReads = 0;
  const staleEnvelope = { status: "succeeded" };
  Object.defineProperty(staleEnvelope, "value", {
    enumerable: true,
    get() {
      staleReads += 1;
      return { items: [], bounds: {} };
    },
  });
  first.resolve(staleEnvelope);
  await Promise.resolve();
  await Promise.resolve();
  if (staleReads !== 0) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "A stale hostile envelope was inspected.");
  }

  const statefulCatalog = prepareCatalog(validatorApi, catalogText, (catalog) => {
    catalog.resources[STORES].inputSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["region"],
      properties: { region: { type: "string" } },
    };
  });
  const liveAttempt = deferred();
  const validationMounted = mustMount(
    api,
    mountInput(
      statefulCatalog,
      createHostPorts(api, () => liveAttempt.promise),
      {
        stores: {
          use: STORES,
          input: { region: { $ref: "state.region" } },
          policy: "mount",
        },
      },
    ),
    "Refresh validation fixture",
  );
  const liveStart = api.startRuntimeSurfaceResources(
    validationMounted.handle,
    resolutionSnapshot(api, validationMounted.snapshot, { region: "eu" }),
    validationMounted.snapshot,
  );
  const liveEntry = startedEntry(liveStart, "stores");
  const invalidRefresh = api.refreshRuntimeSurfaceResource(validationMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: liveStart.snapshot,
    snapshot: resolutionSnapshot(api, liveStart.snapshot),
  });
  if (invalidRefresh.status !== "input-rejected" || invalidRefresh.reason !== "resolution") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Invalid refresh input changed.");
  }
  liveAttempt.resolve({ status: "succeeded", value: { items: [], bounds: {} } });
  const retainedLiveSettlement = await liveEntry.settlement;
  if (retainedLiveSettlement.status !== "succeeded") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Invalid refresh superseded an existing live attempt.");
  }

  const refreshInputs = [];
  const latestMounted = mustMount(
    api,
    mountInput(
      statefulCatalog,
      createHostPorts(api, (request) => {
        refreshInputs.push(cloneJson(request.input));
        return successFor(request);
      }),
      {
        stores: {
          use: STORES,
          input: { region: { $ref: "state.region" } },
          policy: "mount",
        },
      },
    ),
    "Latest refresh snapshot fixture",
  );
  const latestStart = api.startRuntimeSurfaceResources(
    latestMounted.handle,
    resolutionSnapshot(api, latestMounted.snapshot, { region: "eu" }),
    latestMounted.snapshot,
  );
  await startedEntry(latestStart, "stores").settlement;
  const latestCurrent = api.readRuntimeSurfaceResources(latestMounted.handle);
  if (latestCurrent.status !== "read") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Latest refresh fixture could not read.");
  }
  const latestRefresh = api.refreshRuntimeSurfaceResource(latestMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: latestCurrent.snapshot,
    snapshot: resolutionSnapshot(api, latestCurrent.snapshot, { region: "us" }),
  });
  if (latestRefresh.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Latest refresh snapshot was rejected.");
  }
  await latestRefresh.settlement;
  assertDataEqual(refreshInputs, [{ region: "eu" }, { region: "us" }], "Latest refresh input");

  const abaMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => ({ status: "denied" })),
      { stores: { use: STORES, input: {}, policy: "mount" } },
    ),
    "ABA lifecycle fixture",
  );
  const originalIdle = abaMounted.snapshot;
  const abaInitial = api.startRuntimeSurfaceResources(
    abaMounted.handle,
    resolutionSnapshot(api, originalIdle),
    originalIdle,
  );
  await startedEntry(abaInitial, "stores").settlement;
  const abaCurrent = api.readRuntimeSurfaceResources(abaMounted.handle);
  if (
    abaCurrent.status !== "read" ||
    !isDeepStrictEqual(
      plainData(abaCurrent.snapshot.lifecycles),
      plainData(originalIdle.lifecycles),
    ) ||
    abaCurrent.snapshot === originalIdle
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "ABA fixture did not return equal fresh data.");
  }
  const abaRefresh = api.refreshRuntimeSurfaceResource(abaMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: originalIdle,
    snapshot: resolutionSnapshot(api, abaCurrent.snapshot),
  });
  if (abaRefresh.status !== "invalid-snapshot") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "ABA-equal stale snapshot gained authority.");
  }

  const terminalLimitMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, successFor),
      { stores: { use: STORES, input: {}, policy: "mount" } },
      { maxSnapshotGeneration: 2 },
    ),
    "Terminal reservation fixture",
  );
  const terminalLimitStart = api.startRuntimeSurfaceResources(
    terminalLimitMounted.handle,
    resolutionSnapshot(api, terminalLimitMounted.snapshot),
    terminalLimitMounted.snapshot,
  );
  const terminalLimitSettlement = await startedEntry(terminalLimitStart, "stores").settlement;
  if (
    terminalLimitSettlement.status !== "succeeded" ||
    terminalLimitSettlement.snapshot.generation !== 2
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Reserved terminal generation changed.");
  }
  const terminalLimitCurrent = api.readRuntimeSurfaceResources(terminalLimitMounted.handle);
  if (terminalLimitCurrent.status !== "read") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Terminal reservation current snapshot is missing.");
  }
  const terminalLimitRefresh = api.refreshRuntimeSurfaceResource(terminalLimitMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: terminalLimitCurrent.snapshot,
    snapshot: resolutionSnapshot(api, terminalLimitCurrent.snapshot),
  });
  if (
    terminalLimitRefresh.status !== "snapshot-limit" ||
    terminalLimitRefresh.diagnostics[0]?.code !==
      "run.desen.runtime/RESOURCE_SNAPSHOT_LIMIT_EXCEEDED"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Terminal snapshot reservation changed.");
  }
  assertDeepFrozen(terminalLimitRefresh.diagnostics, "Snapshot-limit diagnostic array");

  const attemptLimitMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, successFor),
      { stores: { use: STORES, input: {}, policy: "mount" } },
      { maxAttemptGeneration: 0 },
    ),
    "Attempt limit fixture",
  );
  const attemptLimitStart = api.startRuntimeSurfaceResources(
    attemptLimitMounted.handle,
    resolutionSnapshot(api, attemptLimitMounted.snapshot),
    attemptLimitMounted.snapshot,
  );
  await startedEntry(attemptLimitStart, "stores").settlement;
  const attemptLimitCurrent = api.readRuntimeSurfaceResources(attemptLimitMounted.handle);
  if (attemptLimitCurrent.status !== "read") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Attempt limit current snapshot is missing.");
  }
  const attemptLimitRefresh = api.refreshRuntimeSurfaceResource(attemptLimitMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: attemptLimitCurrent.snapshot,
    snapshot: resolutionSnapshot(api, attemptLimitCurrent.snapshot),
  });
  if (
    attemptLimitRefresh.status !== "attempt-limit" ||
    startedEntry(attemptLimitStart, "stores").requestId !== 'resource:["stores",0]'
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Inclusive attempt-generation ceiling changed.");
  }

  const queueFirst = deferred();
  const queueCalls = [];
  const queueMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, (request) => {
        queueCalls.push(request.instanceId);
        return request.instanceId === "first" ? queueFirst.promise : successFor(request);
      }),
      {
        first: { use: STORES, input: {}, policy: "mount" },
        second: { use: STORES, input: {}, policy: "mount" },
      },
      { maxActiveTransports: 1 },
    ),
    "Transport queue fixture",
  );
  const queueStart = api.startRuntimeSurfaceResources(
    queueMounted.handle,
    resolutionSnapshot(api, queueMounted.snapshot),
    queueMounted.snapshot,
  );
  assertDataEqual(queueCalls, ["first"], "Active transport cap");
  queueFirst.resolve({ status: "succeeded", value: { items: [], bounds: {} } });
  await startedEntry(queueStart, "first").settlement;
  assertDataEqual(queueCalls, ["first", "second"], "Canonical queued promotion");
  await startedEntry(queueStart, "second").settlement;

  const replacementTransport = deferred();
  const replacementCalls = [];
  const replacementMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, (request) => {
        replacementCalls.push(request.context.requestId);
        return replacementCalls.length === 1 ? replacementTransport.promise : successFor(request);
      }),
      { stores: { use: STORES, input: {}, policy: "mount" } },
      { maxActiveTransports: 1 },
    ),
    "Queued replacement fixture",
  );
  const replacementStart = api.startRuntimeSurfaceResources(
    replacementMounted.handle,
    resolutionSnapshot(api, replacementMounted.snapshot),
    replacementMounted.snapshot,
  );
  const replacementOne = api.refreshRuntimeSurfaceResource(replacementMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: replacementStart.snapshot,
    snapshot: resolutionSnapshot(api, replacementStart.snapshot),
  });
  if (replacementOne.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "First queued refresh did not start.");
  }
  const replacementTwo = api.refreshRuntimeSurfaceResource(replacementMounted.handle, {
    instanceId: "stores",
    resourceSnapshot: replacementOne.snapshot,
    snapshot: resolutionSnapshot(api, replacementOne.snapshot),
  });
  if (replacementTwo.status !== "started") {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Second queued refresh did not start.");
  }
  const replacedInitial = startedEntry(replacementStart, "stores");
  if (
    (await replacedInitial.settlement).status !== "superseded" ||
    (await replacementOne.settlement).status !== "superseded" ||
    replacementCalls.length !== 1
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Queued refresh replacement changed.");
  }
  replacementTransport.resolve({ status: "succeeded", value: { items: [], bounds: {} } });
  await Promise.resolve();
  await Promise.resolve();
  assertDataEqual(
    replacementCalls,
    ['resource:["stores",0]', 'resource:["stores",2]'],
    "Bounded queued replacement",
  );
  await replacementTwo.settlement;

  const disposalAttempt = deferred();
  const terminalMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => disposalAttempt.promise),
      {
        stores: { use: STORES, input: {}, policy: "mount" },
      },
    ),
    "Terminal disposal fixture",
  );
  const terminalStart = api.startRuntimeSurfaceResources(
    terminalMounted.handle,
    resolutionSnapshot(api, terminalMounted.snapshot),
    terminalMounted.snapshot,
  );
  const terminalEntry = startedEntry(terminalStart, "stores");
  const disposed = api.disposeRuntimeSurfaceResources(terminalMounted.handle);
  const disposedSettlement = await terminalEntry.settlement;
  if (
    disposed.status !== "disposed" ||
    disposed.disposedAttempts !== 1 ||
    disposedSettlement.status !== "disposed" ||
    api.readRuntimeSurfaceResources(terminalMounted.handle).status !== "disposed" ||
    api.disposeRuntimeSurfaceResources(terminalMounted.handle).status !== "already-disposed"
  ) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "Terminal disposal semantics changed.");
  }
  let disposedReads = 0;
  const disposedEnvelope = { status: "succeeded" };
  Object.defineProperty(disposedEnvelope, "value", {
    enumerable: true,
    get() {
      disposedReads += 1;
      return { items: [], bounds: {} };
    },
  });
  disposalAttempt.resolve(disposedEnvelope);
  await Promise.resolve();
  await Promise.resolve();
  if (disposedReads !== 0) {
    fail("RESOURCE_RUNTIME_BEHAVIOR_DRIFT", "A disposed hostile envelope was inspected.");
  }

  return Object.freeze({
    mountProbes: 5,
    snapshotIdentityProbes: 4,
    policyAndOrderingProbes: 6,
    tokenMaterializationProbes: 7,
    inputBoundaryProbes: 5,
    reentrancyProbes: 4,
    settlementContainmentProbes: 8,
    refreshAndSupersessionProbes: 8,
    requestIdentityProbes: 6,
    finiteLimitProbes: 5,
    transportQueueProbes: 5,
    receiverIndependenceProbes: 3,
    disposalProbes: 6,
    hostileEnvelopeReads: staleReads + disposedReads,
    platformEffects: 0,
    rawHostFailuresExposed: false,
    transportCancellationClaimed: false,
  });
}

async function trackedFiles(fileOverrides) {
  return Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
      return Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }),
  );
}

/**
 * Builds deterministic M04-T08 evidence from exact prerequisites, public distribution,
 * hostile runtime probes, tests, trace ownership, documentation, and task-owned bytes.
 */
export async function buildRuntimeCoreResourceLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    tokenFormat,
    repeatMaterialization,
    executionContracts,
    sourceText,
    declarationText,
    builtJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
    packageTests,
    typeTests,
    rootTests,
    runtimeManifestText,
    traceText,
    findings,
    proofDocument,
    catalogText,
    tracked,
  ] = await Promise.all([
    verifyPrerequisite(TOKEN_FORMAT_PREREQUISITE, normalized.prerequisiteBytes?.tokenFormat),
    verifyPrerequisite(
      REPEAT_MATERIALIZATION_PREREQUISITE,
      normalized.prerequisiteBytes?.repeatMaterialization,
    ),
    verifyPrerequisite(
      EXECUTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.executionContracts,
    ),
    readWorkspaceText("packages/runtime-core/src/resource-lifecycle.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/resource-lifecycle.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/resource-lifecycle.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/resource-lifecycle.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/resource-lifecycle.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-resource-lifecycle.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-RESOURCE-LIFECYCLE.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimeManifestText);
    trace = JSON.parse(traceText);
  } catch {
    fail("RESOURCE_METADATA_INVALID", "Runtime package or trace metadata is not valid JSON.");
  }

  const publicApi = verifyPublicApi({
    sourceText,
    declarationText,
    builtJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const tests = verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest);
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation(findings, proofDocument);
  const [runtimeApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const runtime = await probeRuntimeBehavior(runtimeApi, validatorApi, catalogText);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T08",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Surface resources mount atomically, start and refresh from exact snapshots, validate Catalog inputs and outputs, contain technical failures, ignore stale settlements, and dispose terminally.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze([tokenFormat, repeatMaterialization, executionContracts]),
    publicApi,
    runtime,
    semantics: Object.freeze({
      mountPublication: "atomic frozen idle generation without host calls",
      contractAuthority: "factory-authenticated M02-T11 execution Catalog set",
      initialPolicies: Object.freeze({
        manual: "idle until explicit refresh",
        mount: "automatic initial start",
        once: "automatic initial start",
      }),
      resourceSnapshotAuthority:
        "exact current manager-issued object identity; stale, foreign, and ABA-equal views rejected",
      resolutionSnapshotAuthority:
        "factory-authenticated snapshot whose resource namespace equals the manager snapshot",
      compositorPrecondition:
        "same-turn provenance for state, context, operation, event, item, and env is trusted until M04-T16",
      initialBatch: "canonical instance order from one exact current manager snapshot",
      pendingPublication: "before host and diagnostic callbacks",
      synchronousSettlement: "later Promise microtask",
      inputBoundary:
        "one M04-T03 synthetic-array materialization and token cache, reconstruction, then exact resource-input schema validation",
      candidateIdentity:
        "visible to token lookup but consumed only after complete accepted input preparation",
      outputBoundary:
        "exact resource-output schema validation, redacted frozen diagnostics, then detached bounded lifecycle publication",
      publicFailure: "exact declared Catalog error code only",
      technicalFailure: "idle lifecycle plus controlled diagnostic",
      refreshValidation: "before supersession",
      staleSettlement: "authority rejected before envelope inspection",
      requestIdentity: "resource: + RFC 8785 canonical [instanceId, attemptGeneration]",
      finiteLimits: Object.freeze({
        maxActiveTransports: 64,
        hostProfile: "may lower but never raise finite ceilings",
        snapshotCapacity: "terminal transition reserved before request acceptance",
        queue: "canonical promotion with queued same-instance replacement",
      }),
      hostCallbacks: "resource, token, and diagnostic callbacks invoked without a receiver",
      disposal:
        "terminal, idempotent, clears retained records and queue, replaces handle authority with sentinel",
      retry: null,
      timeout: null,
      cache: null,
      transportCancellation: null,
    }),
    portability: Object.freeze({
      framework: null,
      platformGlobals: Object.freeze([]),
      dynamicEvaluation: false,
      nondeterministicCalls: Object.freeze([]),
      a2uiDependencies: Object.freeze([]),
    }),
    documentation,
    evidence: Object.freeze({
      focusedTestRegistrations: tests.focused.registrations,
      focusedTests: tests.focused.cases,
      focusedTestTitles: tests.focused.titles,
      compilerNegativeCases: tests.compilerNegativeLabels.length,
      compilerNegativeLabels: tests.compilerNegativeLabels,
      rootMutationTests: tests.rootTitles.length,
      rootMutationTestTitles: tests.rootTitles,
      traceRules,
      trackedFiles: tracked,
      semanticOnlySharedInputs: Object.freeze([
        "packages/runtime-core/package.json",
        "packages/runtime-core/src/index.ts",
        "packages/runtime-core/dist/index.js",
        "packages/runtime-core/dist/index.d.ts",
        "docs/proof/protocol-0.1.0-traceability.json",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/proof/RUNTIME-CORE-RESOURCE-LIFECYCLE.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "operation lifecycle and settlement behavior (M04-T09)",
      "resource.refresh action dispatch integration (M04-T11)",
      "reactive dependency discovery and reevaluation (M04-T15)",
      "same-turn provenance for non-resource snapshot namespaces and complete composition (M04-T16)",
      "adapter rendering and platform lifecycle implementations",
      "transport cancellation, retry, timeout, cache, persistence, and offline policy",
      "future protocol clarification of PF-038",
    ]),
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("RESOURCE_ARTIFACT_MISSING", "M04-T08 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("RESOURCE_ARTIFACT_UNSAFE", "M04-T08 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T08 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreResourceLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_RESOURCE_LIFECYCLE_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreResourceLifecycleEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("RESOURCE_ARTIFACT_DRIFT", "M04-T08 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    tsdocDeclarations: expected.artifact.publicApi.tsdocDeclarations,
    focusedTests: expected.artifact.evidence.focusedTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    mountProbes: expected.artifact.runtime.mountProbes,
    snapshotIdentityProbes: expected.artifact.runtime.snapshotIdentityProbes,
    policyAndOrderingProbes: expected.artifact.runtime.policyAndOrderingProbes,
    tokenMaterializationProbes: expected.artifact.runtime.tokenMaterializationProbes,
    inputBoundaryProbes: expected.artifact.runtime.inputBoundaryProbes,
    reentrancyProbes: expected.artifact.runtime.reentrancyProbes,
    settlementContainmentProbes: expected.artifact.runtime.settlementContainmentProbes,
    refreshAndSupersessionProbes: expected.artifact.runtime.refreshAndSupersessionProbes,
    requestIdentityProbes: expected.artifact.runtime.requestIdentityProbes,
    finiteLimitProbes: expected.artifact.runtime.finiteLimitProbes,
    transportQueueProbes: expected.artifact.runtime.transportQueueProbes,
    receiverIndependenceProbes: expected.artifact.runtime.receiverIndependenceProbes,
    disposalProbes: expected.artifact.runtime.disposalProbes,
    hostileEnvelopeReads: expected.artifact.runtime.hostileEnvelopeReads,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T08 evidence after every proof check passes. */
export async function writeRuntimeCoreResourceLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_RESOURCE_LIFECYCLE_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreResourceLifecycleEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreResourceLifecycleEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
