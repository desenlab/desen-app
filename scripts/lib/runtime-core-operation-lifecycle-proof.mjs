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

/** Absolute path to the deterministic M04-T09 operation-lifecycle artifact. */
export const DEFAULT_RUNTIME_CORE_OPERATION_LIFECYCLE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
);

const VALUE_RESOLUTION_PREREQUISITE = Object.freeze({
  task: "M04-T02",
  key: "valueResolution",
  path: "docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
  artifact: "runtime-core-0.1.0-value-resolution.json",
  sha256: "73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea",
});
const EXECUTION_CONTRACT_PREREQUISITE = Object.freeze({
  task: "M02-T11",
  key: "executionContracts",
  path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  artifact: "protocol-0.1.0-execution-contracts.json",
  sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
});
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "RUNTIME_OPERATION_LIMITS",
    "acknowledgeRuntimeOperationSettlement",
    "disposeRuntimeSurfaceOperations",
    "invokeRuntimeOperation",
    "mountRuntimeSurfaceOperations",
    "readRuntimeSurfaceOperations",
  ].sort(),
);
const EXPECTED_TYPE_EXPORTS = Object.freeze(
  [
    "RuntimeOperationConcurrency",
    "RuntimeOperationInputSchemaRejected",
    "RuntimeOperationInvocationQueued",
    "RuntimeOperationInvocationStaged",
    "RuntimeOperationInvocationStarted",
    "RuntimeOperationInvokeInput",
    "RuntimeOperationInvokeResult",
    "RuntimeOperationLimitProfile",
    "RuntimeOperationSettlement",
    "RuntimeOperationSettlementAcknowledgement",
    "RuntimeOperationSettlementLease",
    "RuntimeOperationTerminalSettlement",
    "RuntimeSurfaceOperationAliasSpec",
    "RuntimeSurfaceOperationsDisposeResult",
    "RuntimeSurfaceOperationsHandle",
    "RuntimeSurfaceOperationsMountInput",
    "RuntimeSurfaceOperationsMounted",
    "RuntimeSurfaceOperationsMountInvalid",
    "RuntimeSurfaceOperationsMountInvalidReason",
    "RuntimeSurfaceOperationsMountResult",
    "RuntimeSurfaceOperationsReadResult",
    "RuntimeSurfaceOperationsSnapshot",
  ].sort(),
);
const EXPECTED_SOURCE_IMPORTS = Object.freeze(
  [
    "./host-ports.js",
    "./runtime-json-snapshot.js",
    "./value-resolution.js",
    "@desen/protocol",
    "@desen/validator",
  ].sort(),
);
const EXPECTED_FOCUSED_TESTS = 36;
const EXPECTED_COMPILER_NEGATIVE_CASES = 10;
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/operation-lifecycle.test.ts";
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "schemaNonConstraintDecisions",
    id: "SN-005",
    owners: Object.freeze(["M02-T08", "M04-T09", "M06-T07"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-043",
    owners: Object.freeze(["M02-T11", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-062",
    owners: Object.freeze(["M02-T09", "M04-T09", "M04-T13", "M04-T14"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-077",
    owners: Object.freeze(["M02-T11", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-078",
    owners: Object.freeze(["M04-T09", "M04-T11", "M04-T13"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-089",
    owners: Object.freeze(["M03-T02", "M04-T01", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-106",
    owners: Object.freeze(["M04-T01", "M04-T09", "M04-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-114",
    owners: Object.freeze(["M04-T08", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-115",
    owners: Object.freeze(["M05-T06", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-122",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
  Object.freeze({
    collection: "invariants",
    id: "A-006",
    owners: Object.freeze(["M04-T02", "M04-T09"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-024",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T09"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-025",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T09"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-026",
    owners: Object.freeze(["M02-T05", "M04-T01", "M04-T09"]),
  }),
]);
const FINDING_HEADING =
  "## PF-039 — Operation concurrency and settlement acknowledgement require a deterministic runtime profile";
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T09",
  "atomic",
  "factory-authenticated",
  "resolved inert input",
  "defaults to `reject`",
  "RFC 8785",
  "`queue`",
  "`replace`",
  "terminal settlement",
  "acknowledgement lease",
  "M04-T11",
  "M04-T13",
  "OPERATION_INPUT_INVALID",
  "OPERATION_OUTPUT_INVALID",
  "OPERATION_DENIED",
  "ADAPTER_FAILURE",
  "stale",
  "64",
  "without a receiver",
  "terminal and idempotent",
  "PF-020",
  "PF-022",
  "PF-031",
  "PF-039",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T09 operation evidence",
  "builds byte-identical operation evidence twice",
  "rejects stale or tampered operation evidence",
  "rejects stale M04-T02 prerequisite bytes",
  "rejects stale M02-T11 prerequisite bytes",
  "detects atomic alias mount drift",
  "detects default-reject and accepted-only identity drift",
  "detects exact snapshot and alias authority drift",
  "detects Catalog input, effect, and request-boundary drift",
  "detects output and public-error containment drift",
  "detects denial and adapter-failure containment drift",
  "detects replace supersession and stale-envelope drift",
  "detects queue ordering and acknowledgement-seam drift",
  "detects finite queue, snapshot, and transport-limit drift",
  "detects receiver and reentry drift",
  "detects disposal and late-settlement drift",
  "detects settlement-lease source ordering drift",
  "detects public export, TSDoc, and platform drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/operation-lifecycle.ts",
  "packages/runtime-core/test/operation-lifecycle.test.ts",
  "packages/runtime-core/test/operation-lifecycle.types.ts",
  "packages/runtime-core/dist/operation-lifecycle.js",
  "packages/runtime-core/dist/operation-lifecycle.js.map",
  "packages/runtime-core/dist/operation-lifecycle.d.ts",
  "packages/runtime-core/dist/operation-lifecycle.d.ts.map",
  "scripts/lib/runtime-core-operation-lifecycle-proof.mjs",
  "scripts/generate-runtime-core-operation-lifecycle-proof.mjs",
  "scripts/verify-runtime-core-operation-lifecycle.mjs",
  "tests/runtime-core-operation-lifecycle.test.mjs",
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

/** Stable error class used by deterministic M04-T09 evidence and hostile mutation tests. */
export class RuntimeCoreOperationLifecycleEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreOperationLifecycleEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreOperationLifecycleEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("OPERATION_EVIDENCE_OPTIONS_INVALID", "Evidence options must be an object.");
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

function plainData(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDataEqual(actual, expected, label) {
  const normalized = plainData(actual);
  if (!isDeepStrictEqual(normalized, expected)) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
      expected,
      actual: normalized,
    });
  }
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

function assertDeepFrozen(value, label) {
  const pending = [value];
  const visited = new WeakSet();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || visited.has(current)) continue;
    visited.add(current);
    if (!Object.isFrozen(current)) {
      fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
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
      fail("OPERATION_IMPORT_BOUNDARY_DRIFT", "Operation imports must be literal.");
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(parsed, code = "OPERATION_PLATFORM_BOUNDARY_DRIFT") {
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
    fail(code, "Operation lifecycle crossed its deterministic platform-neutral boundary.", {
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
      statement.moduleSpecifier.text !== "./operation-lifecycle.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "OPERATION_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased operation exports.`,
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

function positionOf(normalized, marker, after = 0) {
  const index = normalized.indexOf(marker, after);
  if (index < 0) {
    fail(
      "OPERATION_SOURCE_SEMANTIC_DRIFT",
      `Operation implementation is missing reviewed invariant: ${marker}`,
    );
  }
  return index;
}

function assertOrder(normalized, markers, label) {
  let cursor = 0;
  for (const marker of markers) {
    cursor = positionOf(normalized, marker, cursor) + marker.length;
  }
  if (cursor === 0) {
    fail("OPERATION_SOURCE_SEMANTIC_DRIFT", `${label} ordering changed.`);
  }
}

function verifySourceInvariants(sourceText) {
  const normalized = normalizeSource(sourceText);
  const required = [
    "validateDesenExecutionCatalogSet(envelope.catalogSet)",
    "catalogValidation.value !== envelope.catalogSet",
    "maxQueuedInvocations: 64",
    "maxActiveTransports: 64",
    "for (const alias of Object.keys(envelope.aliases).sort(compareText))",
    'lifecycle: Object.freeze({ status: "idle", pending: false })',
    "OPERATION_AUTHORITIES.set(handle, authority)",
    "const usesDefault = exactOwnStringKeys(input, baseKeys)",
    ': Object.freeze({ valid: true as const, value: "reject" })',
    "envelope.operationSnapshot !== authority.snapshot",
    "const gate = existing.settlementGate",
    "if (envelope.operation !== existing.capabilityId)",
    "run.desen.runtime/OPERATION_CAPABILITY_MISMATCH",
    'existing.active?.phase === "pending" || existing.active?.phase === "staged"',
    'envelope.concurrency === "reject"',
    '{ kind: "operation-input", capabilityId: record.capabilityId }',
    "return `operation:${canonicalizeJson([alias, generation])}`",
    "record.nextAttemptGeneration += 1",
    "effect: record.effect",
    "reserveTransitions(authority, attempt, 2)",
    "authority.queuedInvocations += 1",
    "supersedeAttempt(authority, replaced, pendingSnapshot)",
    'record.lifecycle = Object.freeze({ status: "pending", pending: true })',
    "Reflect.apply(authority.hostPorts.operations.invoke, undefined, [attempt.request])",
    "Reflect.apply(authority.hostPorts.diagnostics.report, undefined, [diagnostic])",
    "authority.outstandingTransports < authority.limits.maxActiveTransports",
    "void Promise.resolve(result).then(",
    "record.active !== attempt",
    "const result = closedHostResult(rawResult)",
    '{ kind: "operation-output", capabilityId: record.capabilityId }',
    "record.publicErrors.has(result.errorCode)",
    "OPERATION_DENIED",
    "ADAPTER_FAILURE",
    "OPERATION_OUTPUT_INVALID",
    "const lease = makeLease(authority, record, attempt)",
    "record.settlementGate = attempt",
    'attempt.phase = "awaiting-ack"',
    "SETTLEMENT_LEASES.set(lease, Object.freeze({ authority, record, attempt }))",
    'SETTLEMENT_LEASES.set(lease as object, Object.freeze({ status: "acknowledged", authority }))',
    "const promoted = record.queue.shift()",
    "scheduleTransport(authority, record, promoted)",
    'authority.status = "disposed"',
    "authority.records.clear()",
    "OPERATION_AUTHORITIES.set(handle as object, DISPOSED_OPERATION_AUTHORITY)",
  ];
  for (const invariant of required) positionOf(normalized, invariant);

  assertOrder(
    normalized,
    [
      "if (envelope.operationSnapshot !== authority.snapshot)",
      "const existing = authority.records.get(envelope.alias)",
      "if (envelope.operation !== existing.capabilityId)",
      "const gate = existing.settlementGate",
      'envelope.concurrency === "reject"',
      "const nextGeneration = existing.nextAttemptGeneration",
      "const prepared = prepareOperationInput(authority, envelope, existing)",
      "const attempt = createAttempt(authority, record, prepared.value)",
    ],
    "Invocation validation and accepted-only identity",
  );
  assertOrder(
    normalized,
    [
      'record.lifecycle = Object.freeze({ status: "pending", pending: true })',
      "pendingSnapshot = publishSnapshot(authority, true)",
      "scheduleTransport(authority, record, attempt)",
    ],
    "Pending publication before host launch",
  );
  assertOrder(
    normalized,
    ["record.active !== attempt", "const result = closedHostResult(rawResult)"],
    "Stale authority before hostile envelope inspection",
  );
  assertOrder(
    normalized,
    [
      'record.lifecycle = Object.freeze({ status: "succeeded", pending: false, value: validation.value',
      "const snapshot = publishSnapshot(authority, true)",
      "const lease = makeLease(authority, record, attempt)",
      "completeAttempt(attempt",
    ],
    "Terminal lifecycle before settlement lease delivery",
  );
  assertOrder(
    normalized,
    [
      'SETTLEMENT_LEASES.set(lease as object, Object.freeze({ status: "acknowledged", authority }))',
      'attempt.phase = "completed"',
      "record.settlementGate = undefined",
      "const promoted = record.queue.shift()",
      'promoted.phase = "pending"',
      "const snapshot = publishSnapshot(authority, true)",
      "scheduleTransport(authority, record, promoted)",
    ],
    "Acknowledgement before queue promotion",
  );
}

function verifyPublicApi({
  sourceText,
  declarationText,
  builtJavaScript,
  sourceIndexText,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = exportedDeclarations(sourceText, "operation-lifecycle.ts");
  assertDirectExports(source, "OPERATION_SOURCE_EXPORT_DRIFT", "Operation source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "OPERATION_SOURCE_EXPORT_DRIFT",
    "Operation source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "OPERATION_SOURCE_EXPORT_DRIFT",
    "Operation source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("OPERATION_TSDOC_MISSING", "Every exported operation declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_SOURCE_IMPORTS,
    "OPERATION_IMPORT_BOUNDARY_DRIFT",
    "Operation source imports",
  );
  verifyPlatformBoundary(source.sourceFile);
  verifySourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "operation-lifecycle.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(declaration, "OPERATION_DECLARATION_DRIFT", "Operation declaration");
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "OPERATION_DECLARATION_DRIFT",
    "Built operation runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "OPERATION_DECLARATION_DRIFT",
    "Built operation type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("OPERATION_DECLARATION_DRIFT", "Built operation declarations lost TSDoc.", {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "OPERATION_DECLARATION_DRIFT");

  const built = exportedDeclarations(builtJavaScript, "operation-lifecycle.js", ts.ScriptKind.JS);
  assertDirectExports(built, "OPERATION_DISTRIBUTION_DRIFT", "Built operation JavaScript");
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "OPERATION_DISTRIBUTION_DRIFT",
    "Built operation JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "OPERATION_DISTRIBUTION_DRIFT",
    "Built operation JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "OPERATION_DISTRIBUTION_DRIFT");

  for (const [text, fileName, expectedTypes] of [
    [sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexJavaScript, "dist/index.js", []],
  ]) {
    const exports = moduleIndexExports(text, fileName);
    assertArrayEqual(
      exports.runtimeExports,
      EXPECTED_RUNTIME_EXPORTS,
      "OPERATION_INDEX_EXPORT_DRIFT",
      `${fileName} operation runtime exports`,
    );
    assertArrayEqual(
      exports.typeExports,
      expectedTypes,
      "OPERATION_INDEX_EXPORT_DRIFT",
      `${fileName} operation type exports`,
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
  fail("OPERATION_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "operation-lifecycle.test.ts");
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
          fail("OPERATION_TEST_INVENTORY_DRIFT", "it.each must use a static array table.");
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
        fail("OPERATION_TEST_INVENTORY_DRIFT", "Focused operation tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail("OPERATION_TEST_INVENTORY_DRIFT", "Focused operation titles must be unique.");
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("OPERATION_TEST_INVENTORY_DRIFT", "Focused operation case count changed.", {
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
    fail("OPERATION_TYPE_TEST_DRIFT", "Compiler-negative evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("OPERATION_TYPE_TEST_DRIFT", "Compiler-negative operation inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-operation-lifecycle.test.mjs",
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
        fail("OPERATION_ROOT_TEST_DRIFT", "Root operation tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "OPERATION_ROOT_TEST_DRIFT",
    "Root operation mutation titles",
  );
  return Object.freeze(titles);
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  if (runtimeManifest.scripts?.["test:operation-lifecycle"] !== EXPECTED_PACKAGE_TEST_SCRIPT) {
    fail(
      "OPERATION_PACKAGE_WIRING_DRIFT",
      "The runtime package operation test command changed or is absent.",
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
    fail("OPERATION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite hash changed.`, {
      task: prerequisite.task,
      expectedSha256: prerequisite.sha256,
      actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("OPERATION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite is not valid JSON.`);
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== prerequisite.task ||
    artifact.result !== "PASS"
  ) {
    fail("OPERATION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite identity changed.`);
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
        fail("OPERATION_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "OPERATION_TRACE_DRIFT",
        `${expected.id} owners`,
      );
      return Object.freeze({
        id: observed.id,
        section: observed.section ?? null,
        owners: Object.freeze([...observed.owners]),
      });
    }),
  );
}

function findingSection(findings, heading) {
  const start = findings.indexOf(heading);
  if (start < 0) fail("OPERATION_FINDING_DRIFT", `${heading} is missing.`);
  const next = findings.indexOf("\n## PF-", start + heading.length);
  return findings.slice(start, next < 0 ? findings.length : next);
}

function verifyDocumentation(findings, proofDocument) {
  const section = findingSection(findings, FINDING_HEADING);
  if (!section.includes("- Status: OPEN") || !section.includes("- Blocks proof: No")) {
    fail("OPERATION_FINDING_DRIFT", "PF-039 must remain OPEN and non-blocking.");
  }
  for (const related of ["PF-020", "PF-022", "PF-031"]) {
    const relatedSection = findingSection(findings, `## ${related} —`);
    if (!relatedSection.includes("- Status: OPEN")) {
      fail("OPERATION_FINDING_DRIFT", `${related} must remain an explicit OPEN boundary.`);
    }
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("OPERATION_PROOF_DOCUMENT_DRIFT", `M04-T09 proof is missing: ${required}`);
    }
  }
  return Object.freeze({
    finding: "PF-039",
    findingStatus: "OPEN",
    relatedOpenFindings: Object.freeze(["PF-020", "PF-022", "PF-031"]),
    proofDocument: "docs/proof/RUNTIME-CORE-OPERATION-LIFECYCLE.md",
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
    fail("OPERATION_CATALOG_FIXTURE_DRIFT", "The frozen web Catalog fixture is invalid JSON.");
  }
  mutate?.(catalog);
  const result = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  if (!result.valid) {
    fail("OPERATION_CATALOG_FIXTURE_DRIFT", "The operation proof Catalog no longer prepares.", {
      diagnostics: plainData(result.diagnostics),
    });
  }
  return result.value;
}

const DOCUMENT_ID = "https://desen.app/kanıt/操作";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "proof-surface";
const SIGN_IN = "com.example.auth/signIn";
const REORDER = "com.example.tasks/reorder";
const VALID_INPUT = Object.freeze({ email: "person@example.com", password: "secret" });
const VALID_OUTPUT = Object.freeze({ userId: "user-1" });

function createHostPorts(api, invoke, report = () => undefined) {
  return api.createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: {
          activeRevision: REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: { invoke },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
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

function mountInput(catalogSet, hostPorts, aliases = undefined, limits = undefined) {
  return {
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: aliases ?? { signIn: { operation: SIGN_IN } },
    catalogSet,
    hostPorts,
    ...(limits === undefined ? {} : { limits }),
  };
}

function mustMount(api, input, label) {
  const result = api.mountRuntimeSurfaceOperations(input);
  if (result.status !== "mounted") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", `${label} did not mount.`, {
      actual: plainData(result),
    });
  }
  return result;
}

function readCurrent(api, mounted, label = "Operation manager") {
  const result = api.readRuntimeSurfaceOperations(mounted.handle);
  if (result.status !== "read") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", `${label} is no longer readable.`, {
      actual: plainData(result),
    });
  }
  return result.snapshot;
}

function invokeInput(snapshot, overrides = undefined) {
  return {
    alias: "signIn",
    operation: SIGN_IN,
    input: VALID_INPUT,
    operationSnapshot: snapshot,
    ...overrides,
  };
}

function mustStart(api, mounted, overrides = undefined) {
  const result = api.invokeRuntimeOperation(
    mounted.handle,
    invokeInput(readCurrent(api, mounted), overrides),
  );
  if (result.status !== "started") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Operation invocation no longer starts.", {
      actual: plainData(result),
    });
  }
  return result;
}

function mustQueue(api, mounted, overrides = undefined) {
  const result = api.invokeRuntimeOperation(
    mounted.handle,
    invokeInput(readCurrent(api, mounted), { concurrency: "queue", ...overrides }),
  );
  if (result.status !== "queued") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Operation invocation no longer queues.", {
      actual: plainData(result),
    });
  }
  return result;
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

function terminal(settlement, label) {
  if (
    !["succeeded", "failed", "denied", "invalid-output", "adapter-failed"].includes(
      settlement.status,
    )
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", `${label} did not reach a leased terminal state.`, {
      actual: plainData(settlement),
    });
  }
  return settlement;
}

async function probeRuntimeBehavior(api, validatorApi, catalogText) {
  const catalogSet = prepareCatalog(validatorApi, catalogText);

  const invalidLimits = api.mountRuntimeSurfaceOperations(
    mountInput(
      catalogSet,
      createHostPorts(api, () => ({ status: "succeeded", value: VALID_OUTPUT })),
      undefined,
      { maxActiveTransports: 0 },
    ),
  );
  if (invalidLimits.status !== "invalid" || invalidLimits.reason !== "malformed-input") {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Invalid upward or zero transport limits were accepted.",
    );
  }

  const mountCalls = [];
  const atomicPorts = createHostPorts(api, function (request) {
    mountCalls.push(cloneJson(request));
    return { status: "succeeded", value: VALID_OUTPUT };
  });
  const atomicMounted = mustMount(
    api,
    mountInput(catalogSet, atomicPorts, {
      zSignIn: { operation: SIGN_IN },
      aReorder: { operation: REORDER },
    }),
    "Atomic alias fixture",
  );
  assertDataEqual(
    atomicMounted.snapshot,
    {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      lifecycles: {
        aReorder: { status: "idle", pending: false },
        zSignIn: { status: "idle", pending: false },
      },
    },
    "Atomic idle alias mount",
  );
  assertDeepFrozen(atomicMounted.snapshot, "Atomic operation snapshot");
  if (mountCalls.length !== 0) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Operation mount called the host.");
  }

  for (const [aliases, reason] of [
    [
      { good: { operation: SIGN_IN }, bad: { operation: "com.example.unknown/missing" } },
      "unknown-capability",
    ],
    [{ "9bad": { operation: SIGN_IN } }, "malformed-input"],
  ]) {
    const result = api.mountRuntimeSurfaceOperations(mountInput(catalogSet, atomicPorts, aliases));
    if (
      result.status !== "invalid" ||
      result.reason !== reason ||
      Object.hasOwn(result, "handle")
    ) {
      fail(
        "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
        "Invalid alias inventory exposed partial authority.",
        {
          actual: plainData(result),
        },
      );
    }
  }
  const forgedCatalog = api.mountRuntimeSurfaceOperations(
    mountInput([JSON.parse(catalogText)], atomicPorts, {}),
  );
  if (forgedCatalog.status !== "invalid" || forgedCatalog.reason !== "catalog-set-invalid") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "A shaped Catalog gained execution authority.");
  }

  const requests = [];
  const requestReceivers = [];
  const reports = [];
  const reportReceivers = [];
  const requestPendingObserved = [];
  let requestMounted;
  const requestPorts = createHostPorts(
    api,
    function (request) {
      requestReceivers.push(this);
      requests.push(cloneJson(request));
      requestPendingObserved.push(
        cloneJson(readCurrent(api, requestMounted, "Host-observed request manager").lifecycles),
      );
      return { status: "succeeded", value: VALID_OUTPUT };
    },
    function (diagnostic) {
      reportReceivers.push(this);
      reports.push(cloneJson(diagnostic));
    },
  );
  requestMounted = mustMount(api, mountInput(catalogSet, requestPorts), "Request boundary fixture");
  const callerInput = { email: "person@example.com", password: "secret" };
  const started = api.invokeRuntimeOperation(
    requestMounted.handle,
    invokeInput(requestMounted.snapshot, { input: callerInput }),
  );
  if (started.status !== "started") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Valid operation invocation no longer starts.");
  }
  callerInput.email = "mutated@example.com";
  if (started.requestId !== 'operation:["signIn",0]') {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Accepted operation identity changed.", {
      actual: started.requestId,
    });
  }
  assertDataEqual(
    started.snapshot.lifecycles,
    { signIn: { status: "pending", pending: true } },
    "Synchronous pending publication",
  );
  assertDataEqual(
    requests,
    [
      {
        context: {
          documentId: DOCUMENT_ID,
          revision: REVISION,
          surfaceId: SURFACE_ID,
          requestId: 'operation:["signIn",0]',
        },
        capabilityId: SIGN_IN,
        invocationAlias: "signIn",
        input: VALID_INPUT,
        effect: "network",
      },
    ],
    "Catalog-owned operation request",
  );
  if (requestReceivers.some((receiver) => receiver !== undefined)) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Operation host callback gained a receiver.");
  }
  if (requestPendingObserved.some((snapshot) => snapshot.signIn?.status !== "pending")) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Host observed an operation before pending publication.",
    );
  }
  let synchronousSettlement = false;
  void started.settlement.then(() => {
    synchronousSettlement = true;
  });
  if (synchronousSettlement) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Synchronous host output settled in the action turn.");
  }
  const succeeded = terminal(await started.settlement, "Successful request");
  if (succeeded.status !== "succeeded") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Valid output no longer succeeds.");
  }
  assertDataEqual(
    succeeded.snapshot.lifecycles,
    {
      signIn: {
        status: "succeeded",
        pending: false,
        value: VALID_OUTPUT,
      },
    },
    "Successful terminal lifecycle",
  );
  assertDeepFrozen(succeeded.snapshot, "Successful operation snapshot");
  const acknowledged = api.acknowledgeRuntimeOperationSettlement(
    requestMounted.handle,
    succeeded.lease,
  );
  if (acknowledged.status !== "acknowledged" || Object.hasOwn(acknowledged, "promotedRequestId")) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "One-shot terminal lease acknowledgement changed.");
  }
  if (
    api.acknowledgeRuntimeOperationSettlement(requestMounted.handle, succeeded.lease).status !==
    "already-acknowledged"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Acknowledged lease became reusable.");
  }

  let validationHostCalls = 0;
  const firstTransport = deferred();
  const secondTransport = deferred();
  const validationTransports = [firstTransport, secondTransport];
  const validationMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => {
        const transport = validationTransports[validationHostCalls];
        validationHostCalls += 1;
        return transport?.promise;
      }),
    ),
    "Validation and queue fixture",
  );
  const invalidInput = api.invokeRuntimeOperation(
    validationMounted.handle,
    invokeInput(validationMounted.snapshot, {
      input: { email: "not-email", password: "" },
    }),
  );
  if (
    invalidInput.status !== "input-rejected" ||
    validationHostCalls !== 0 ||
    readCurrent(api, validationMounted).generation !== 0
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Invalid resolved input consumed authority or host effects.",
    );
  }
  const first = mustStart(api, validationMounted);
  const rejected = api.invokeRuntimeOperation(
    validationMounted.handle,
    invokeInput(readCurrent(api, validationMounted)),
  );
  if (
    rejected.status !== "rejected" ||
    rejected.reason !== "pending" ||
    validationHostCalls !== 1
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Omitted concurrency no longer defaults to reject.");
  }
  const second = mustQueue(api, validationMounted);
  if (second.requestId !== 'operation:["signIn",1]' || second.position !== 1) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Queued accepted identity or position changed.");
  }
  firstTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
  const firstTerminal = terminal(await first.settlement, "First queued predecessor");
  if (
    validationHostCalls !== 1 ||
    readCurrent(api, validationMounted).lifecycles.signIn?.status !== "succeeded"
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Queued invocation promoted before settlement acknowledgement.",
    );
  }
  const promoted = api.acknowledgeRuntimeOperationSettlement(
    validationMounted.handle,
    firstTerminal.lease,
  );
  if (
    promoted.status !== "acknowledged" ||
    promoted.promotedRequestId !== second.requestId ||
    validationHostCalls !== 2 ||
    promoted.snapshot.lifecycles.signIn?.status !== "pending"
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Lease acknowledgement did not promote exactly one item.",
    );
  }
  secondTransport.resolve({ status: "succeeded", value: { userId: "user-2" } });
  const secondTerminal = terminal(await second.settlement, "Promoted queued request");
  api.acknowledgeRuntimeOperationSettlement(validationMounted.handle, secondTerminal.lease);

  const stagedTransports = [deferred(), deferred()];
  let stagedCalls = 0;
  const stagedMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => stagedTransports[stagedCalls++]?.promise),
    ),
    "Settlement-handler staging fixture",
  );
  const stagedPredecessor = mustStart(api, stagedMounted);
  stagedTransports[0].resolve({ status: "succeeded", value: VALID_OUTPUT });
  const stagedGate = terminal(await stagedPredecessor.settlement, "Settlement-handler predecessor");
  const stagedInvocation = api.invokeRuntimeOperation(
    stagedMounted.handle,
    invokeInput(readCurrent(api, stagedMounted)),
  );
  if (
    stagedInvocation.status !== "staged" ||
    stagedInvocation.snapshot.lifecycles.signIn?.status !== "pending" ||
    stagedCalls !== 1
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Settlement-handler invocation was not synchronously staged behind its lease.",
    );
  }
  const foreignLeaseMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => ({ status: "succeeded", value: VALID_OUTPUT })),
    ),
    "Foreign lease manager",
  );
  if (
    api.acknowledgeRuntimeOperationSettlement(foreignLeaseMounted.handle, stagedGate.lease)
      .status !== "invalid-lease"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "A cross-manager settlement lease gained authority.");
  }
  const stagedAcknowledgement = api.acknowledgeRuntimeOperationSettlement(
    stagedMounted.handle,
    stagedGate.lease,
  );
  if (
    stagedAcknowledgement.status !== "acknowledged" ||
    stagedAcknowledgement.promotedRequestId !== stagedInvocation.requestId ||
    stagedCalls !== 2
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Acknowledgement did not launch the staged request.");
  }
  stagedTransports[1].resolve({ status: "succeeded", value: { userId: "nested" } });
  const stagedTerminal = terminal(
    await stagedInvocation.settlement,
    "Staged settlement-handler invocation",
  );
  api.acknowledgeRuntimeOperationSettlement(stagedMounted.handle, stagedTerminal.lease);

  const foreignMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => new Promise(() => undefined)),
    ),
    "Foreign manager fixture",
  );
  const foreignInitial = foreignMounted.snapshot;
  mustStart(api, foreignMounted);
  const currentForeign = readCurrent(api, foreignMounted);
  const managerTwo = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => new Promise(() => undefined)),
    ),
    "Second manager fixture",
  );
  for (const snapshot of [foreignInitial, managerTwo.snapshot, cloneJson(currentForeign)]) {
    const result = api.invokeRuntimeOperation(foreignMounted.handle, invokeInput(snapshot));
    if (result.status !== "invalid-snapshot") {
      fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Stale, foreign, or ABA snapshot gained authority.");
    }
  }
  const missing = api.invokeRuntimeOperation(
    foreignMounted.handle,
    invokeInput(currentForeign, { alias: "missing" }),
  );
  if (missing.status !== "unknown-alias") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Invocation created an undeclared alias.");
  }

  let assertionHostCalls = 0;
  const assertionMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => {
        assertionHostCalls += 1;
        return { status: "succeeded", value: VALID_OUTPUT };
      }),
    ),
    "Capability assertion fixture",
  );
  const missingAssertion = api.invokeRuntimeOperation(assertionMounted.handle, {
    alias: "signIn",
    input: VALID_INPUT,
    operationSnapshot: assertionMounted.snapshot,
  });
  if (
    missingAssertion.status !== "malformed-request" ||
    assertionHostCalls !== 0 ||
    readCurrent(api, assertionMounted).generation !== 0
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Missing required capability assertion consumed identity, lifecycle, or host effects.",
    );
  }
  const mismatch = api.invokeRuntimeOperation(
    assertionMounted.handle,
    invokeInput(assertionMounted.snapshot, { operation: REORDER }),
  );
  if (
    mismatch.status !== "capability-mismatch" ||
    mismatch.diagnostics[0]?.code !== "run.desen.runtime/OPERATION_CAPABILITY_MISMATCH" ||
    mismatch.diagnostics[0]?.context?.capabilityId !== SIGN_IN ||
    assertionHostCalls !== 0 ||
    readCurrent(api, assertionMounted).generation !== 0
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Capability assertion mismatch consumed mounted authority, identity, lifecycle, or host effects.",
    );
  }
  const afterMismatch = mustStart(api, assertionMounted);
  if (afterMismatch.requestId !== 'operation:["signIn",0]' || assertionHostCalls !== 1) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Capability mismatch consumed attempt identity.");
  }
  const afterMismatchSettlement = terminal(
    await afterMismatch.settlement,
    "Post-mismatch valid invocation",
  );
  api.acknowledgeRuntimeOperationSettlement(assertionMounted.handle, afterMismatchSettlement.lease);

  const staleTransport = deferred();
  const replacementTransport = deferred();
  let replaceCalls = 0;
  const replaceMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => {
        replaceCalls += 1;
        return replaceCalls === 1 ? staleTransport.promise : replacementTransport.promise;
      }),
    ),
    "Replace fixture",
  );
  const replacedFirst = mustStart(api, replaceMounted);
  const replacedQueued = mustQueue(api, replaceMounted);
  const invalidReplacement = api.invokeRuntimeOperation(
    replaceMounted.handle,
    invokeInput(readCurrent(api, replaceMounted), {
      concurrency: "replace",
      input: { email: "invalid", password: "" },
    }),
  );
  if (
    invalidReplacement.status !== "input-rejected" ||
    readCurrent(api, replaceMounted).lifecycles.signIn?.status !== "pending"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Invalid replacement superseded accepted work.");
  }
  const replacement = api.invokeRuntimeOperation(
    replaceMounted.handle,
    invokeInput(readCurrent(api, replaceMounted), { concurrency: "replace" }),
  );
  if (replacement.status !== "started" || replacement.requestId !== 'operation:["signIn",2]') {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Valid replacement identity or acceptance changed.");
  }
  const [supersededActive, supersededQueued] = await Promise.all([
    replacedFirst.settlement,
    replacedQueued.settlement,
  ]);
  if (
    supersededActive.status !== "superseded" ||
    supersededQueued.status !== "superseded" ||
    Object.hasOwn(supersededActive, "lease") ||
    Object.hasOwn(supersededQueued, "lease")
  ) {
    fail(
      "OPERATION_RUNTIME_BEHAVIOR_DRIFT",
      "Replacement retained stale work or invented a lease.",
    );
  }
  let staleReads = 0;
  staleTransport.resolve(
    Object.defineProperty({}, "status", {
      get() {
        staleReads += 1;
        throw new Error("stale operation envelope must remain opaque");
      },
    }),
  );
  await Promise.resolve();
  await Promise.resolve();
  if (staleReads !== 0) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Stale operation envelope was inspected.");
  }
  replacementTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
  const replacementTerminal = terminal(await replacement.settlement, "Replacement");
  if (replacementTerminal.status !== "succeeded") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Replacement no longer settles successfully.");
  }

  async function settleCase(hostResult) {
    const mounted = mustMount(
      api,
      mountInput(catalogSet, createHostPorts(api, hostResult)),
      "Settlement case",
    );
    const settlement = terminal(await mustStart(api, mounted).settlement, "Settlement case");
    return Object.freeze({ mounted, settlement });
  }

  const declaredFailure = await settleCase(() => ({
    status: "failed",
    errorCode: "invalidCredentials",
  }));
  if (
    declaredFailure.settlement.status !== "failed" ||
    declaredFailure.settlement.errorCode !== "invalidCredentials" ||
    declaredFailure.settlement.snapshot.lifecycles.signIn?.error?.code !== "invalidCredentials"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Declared public failure exposure changed.");
  }

  const denied = await settleCase(() => ({ status: "denied" }));
  if (
    denied.settlement.status !== "denied" ||
    denied.settlement.diagnostics[0]?.code !== "OPERATION_DENIED" ||
    denied.settlement.snapshot.lifecycles.signIn?.status !== "idle"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Policy denial fabricated a public failure.");
  }
  assertDeepFrozen(denied.settlement.diagnostics, "Denied operation diagnostics");

  const invalidOutput = await settleCase(() => ({
    status: "succeeded",
    value: { secretAdminToken: "do-not-leak" },
  }));
  if (
    invalidOutput.settlement.status !== "invalid-output" ||
    invalidOutput.settlement.diagnostics[0]?.code !== "OPERATION_OUTPUT_INVALID" ||
    /secretAdminToken|do-not-leak/u.test(JSON.stringify(invalidOutput.settlement.diagnostics))
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Invalid output escaped or leaked attacker data.");
  }

  const technicalCases = [
    () => ({ status: "failed", errorCode: "private-database-error" }),
    () => {
      throw new Error("private stack");
    },
    () => Promise.reject(new Error("private rejection")),
    () => ({ status: "succeeded", value: VALID_OUTPUT, extra: "private" }),
  ];
  for (const implementation of technicalCases) {
    const technical = await settleCase(implementation);
    if (
      technical.settlement.status !== "adapter-failed" ||
      technical.settlement.diagnostics[0]?.code !== "ADAPTER_FAILURE" ||
      /private|database|stack|rejection|extra/u.test(
        JSON.stringify(technical.settlement.diagnostics),
      )
    ) {
      fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Adapter failure was not fully contained.");
    }
  }

  let hostileReads = 0;
  const hostileEnvelope = Object.defineProperty({}, "status", {
    get() {
      hostileReads += 1;
      return "succeeded";
    },
  });
  const hostile = await settleCase(() => hostileEnvelope);
  if (hostile.settlement.status !== "adapter-failed" || hostileReads !== 0) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Hostile settlement accessor was invoked.");
  }

  const mutableOutput = { userId: "original" };
  const detached = await settleCase(() => ({ status: "succeeded", value: mutableOutput }));
  mutableOutput.userId = "mutated";
  if (
    detached.settlement.status !== "succeeded" ||
    detached.settlement.snapshot.lifecycles.signIn?.value?.userId !== "original"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Successful output was not detached.");
  }
  assertDeepFrozen(detached.settlement.snapshot, "Detached operation output snapshot");

  const queueLimitMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => new Promise(() => undefined)),
      {
        first: { operation: SIGN_IN },
        second: { operation: SIGN_IN },
      },
      { maxQueuedInvocations: 1 },
    ),
    "Aggregate queue limit fixture",
  );
  mustStart(api, queueLimitMounted, { alias: "first" });
  mustQueue(api, queueLimitMounted, { alias: "first" });
  mustStart(api, queueLimitMounted, { alias: "second" });
  const aggregateQueueLimit = api.invokeRuntimeOperation(
    queueLimitMounted.handle,
    invokeInput(readCurrent(api, queueLimitMounted), {
      alias: "second",
      concurrency: "queue",
    }),
  );
  if (aggregateQueueLimit.status !== "queue-limit") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Queue bound multiplied by alias count.");
  }

  const snapshotTransport = deferred();
  const snapshotLimitMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => snapshotTransport.promise),
      undefined,
      { maxQueuedInvocations: 8, maxSnapshotGeneration: 4 },
    ),
    "Snapshot reservation fixture",
  );
  mustStart(api, snapshotLimitMounted);
  mustQueue(api, snapshotLimitMounted);
  const snapshotLimit = api.invokeRuntimeOperation(
    snapshotLimitMounted.handle,
    invokeInput(readCurrent(api, snapshotLimitMounted), { concurrency: "queue" }),
  );
  if (snapshotLimit.status !== "snapshot-limit") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Terminal snapshot capacity was not reserved.");
  }

  const attemptTransport = deferred();
  const attemptLimitMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => attemptTransport.promise),
      undefined,
      { maxAttemptGeneration: 1 },
    ),
    "Attempt limit fixture",
  );
  mustStart(api, attemptLimitMounted);
  mustQueue(api, attemptLimitMounted);
  const attemptLimit = api.invokeRuntimeOperation(
    attemptLimitMounted.handle,
    invokeInput(readCurrent(api, attemptLimitMounted), { concurrency: "queue" }),
  );
  if (attemptLimit.status !== "attempt-limit") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Accepted attempt ceiling changed.");
  }

  const transportDeferred = [deferred(), deferred()];
  let transportCalls = 0;
  const transportMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => transportDeferred[transportCalls++]?.promise),
      {
        first: { operation: SIGN_IN },
        second: { operation: SIGN_IN },
      },
      { maxActiveTransports: 1 },
    ),
    "Transport cap fixture",
  );
  const transportFirst = mustStart(api, transportMounted, { alias: "first" });
  const transportSecond = mustStart(api, transportMounted, { alias: "second" });
  if (
    transportCalls !== 1 ||
    readCurrent(api, transportMounted).lifecycles.second?.status !== "pending"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Active transport ceiling was bypassed.");
  }
  transportDeferred[0].resolve({ status: "succeeded", value: VALID_OUTPUT });
  await transportFirst.settlement;
  if (transportCalls !== 2) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Freed transport slot did not promote source order.");
  }
  transportDeferred[1].resolve({ status: "succeeded", value: VALID_OUTPUT });
  await transportSecond.settlement;

  let hostReentry;
  let hostReentryMounted;
  const reentryMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => {
        hostReentry = api.invokeRuntimeOperation(hostReentryMounted.handle, {});
        return { status: "succeeded", value: VALID_OUTPUT };
      }),
    ),
    "Host reentry fixture",
  );
  hostReentryMounted = reentryMounted;
  await mustStart(api, reentryMounted).settlement;
  if (hostReentry?.status !== "busy") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Host launch reentry escaped transition guard.");
  }

  const diagnosticReceivers = [];
  let diagnosticReentry;
  let diagnosticMounted;
  diagnosticMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(
        api,
        () => ({ status: "succeeded", value: VALID_OUTPUT }),
        function () {
          diagnosticReceivers.push(this);
          diagnosticReentry = api.invokeRuntimeOperation(diagnosticMounted.handle, {});
        },
      ),
    ),
    "Diagnostic reentry fixture",
  );
  const diagnosticRejected = api.invokeRuntimeOperation(
    diagnosticMounted.handle,
    invokeInput(diagnosticMounted.snapshot, {
      input: { email: "bad", password: "" },
    }),
  );
  if (
    diagnosticRejected.status !== "input-rejected" ||
    diagnosticReentry?.status !== "busy" ||
    diagnosticReceivers.some((receiver) => receiver !== undefined)
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Diagnostic receiver or reentry boundary changed.");
  }

  const disposalTransport = deferred();
  let disposalMounted;
  const reentrantDisposalMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => {
        api.disposeRuntimeSurfaceOperations(disposalMounted.handle);
        return disposalTransport.promise;
      }),
    ),
    "Reentrant disposal fixture",
  );
  disposalMounted = reentrantDisposalMounted;
  const disposedInvocation = mustStart(api, reentrantDisposalMounted);
  if ((await disposedInvocation.settlement).status !== "disposed") {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Reentrant disposal did not revoke accepted work.");
  }
  let disposedEnvelopeReads = 0;
  disposalTransport.resolve(
    Object.defineProperty({}, "status", {
      get() {
        disposedEnvelopeReads += 1;
        return "succeeded";
      },
    }),
  );
  await Promise.resolve();
  await Promise.resolve();
  if (disposedEnvelopeReads !== 0) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Disposed settlement envelope was inspected.");
  }

  const disposeTransport = deferred();
  const disposeMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => disposeTransport.promise),
    ),
    "Terminal disposal fixture",
  );
  const disposeActive = mustStart(api, disposeMounted);
  const disposeQueued = mustQueue(api, disposeMounted);
  const disposal = api.disposeRuntimeSurfaceOperations(disposeMounted.handle);
  if (
    disposal.status !== "disposed" ||
    disposal.disposedInvocations !== 2 ||
    (await disposeActive.settlement).status !== "disposed" ||
    (await disposeQueued.settlement).status !== "disposed" ||
    api.readRuntimeSurfaceOperations(disposeMounted.handle).status !== "disposed" ||
    api.disposeRuntimeSurfaceOperations(disposeMounted.handle).status !== "already-disposed"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Terminal idempotent disposal changed.");
  }

  const leaseMounted = mustMount(
    api,
    mountInput(
      catalogSet,
      createHostPorts(api, () => ({ status: "succeeded", value: VALID_OUTPUT })),
    ),
    "Lease disposal fixture",
  );
  const leaseSettlement = terminal(await mustStart(api, leaseMounted).settlement, "Lease disposal");
  const leaseDisposal = api.disposeRuntimeSurfaceOperations(leaseMounted.handle);
  if (
    leaseDisposal.status !== "disposed" ||
    leaseDisposal.invalidatedLeases !== 1 ||
    api.acknowledgeRuntimeOperationSettlement(leaseMounted.handle, leaseSettlement.lease).status !==
      "disposed"
  ) {
    fail("OPERATION_RUNTIME_BEHAVIOR_DRIFT", "Disposal failed to invalidate settlement lease.");
  }

  return Object.freeze({
    mountAndAuthorityProbes: 9,
    inputAndIdentityProbes: 10,
    concurrencyProbes: 12,
    settlementContainmentProbes: 12,
    leaseAndTurnBoundaryProbes: 8,
    finiteLimitProbes: 8,
    receiverAndReentryProbes: 5,
    disposalProbes: 8,
    hostileEnvelopeReads: staleReads + hostileReads + disposedEnvelopeReads,
    platformEffects: 0,
    rawHostFailuresExposed: false,
    physicalCancellationClaimed: false,
    actionMaterializationClaimed: false,
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
 * Builds deterministic M04-T09 evidence from exact prerequisites, public distribution,
 * hostile runtime probes, trace ownership, documentation, and task-owned bytes.
 */
export async function buildRuntimeCoreOperationLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    valueResolution,
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
    verifyPrerequisite(
      VALUE_RESOLUTION_PREREQUISITE,
      normalized.prerequisiteBytes?.valueResolution,
    ),
    verifyPrerequisite(
      EXECUTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.executionContracts,
    ),
    readWorkspaceText("packages/runtime-core/src/operation-lifecycle.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/operation-lifecycle.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/operation-lifecycle.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/operation-lifecycle.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/operation-lifecycle.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-operation-lifecycle.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-OPERATION-LIFECYCLE.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimeManifestText);
    trace = JSON.parse(traceText);
  } catch {
    fail("OPERATION_METADATA_INVALID", "Runtime package or trace metadata is not valid JSON.");
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
    task: "M04-T09",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Surface operation aliases mount atomically, invoke through exact Catalog contracts, obey bounded reject/replace/queue semantics, publish contained terminal lifecycles, and defer queue promotion until an opaque settlement lease is acknowledged.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze([valueResolution, executionContracts]),
    publicApi,
    runtime,
    semantics: Object.freeze({
      mountPublication: "atomic frozen idle generation without host calls",
      aliasAuthority:
        "predeclared surface-local alias fixed to one exact operation capability for its lifetime; the required invocation assertion verifies but never selects that authority",
      contractAuthority:
        "factory-authenticated M02-T11 Catalog set supplies input/output schemas, public errors, and effect",
      operationSnapshotAuthority:
        "exact current manager-issued object identity; stale, foreign, and ABA-equal views rejected",
      inputBoundary:
        "already resolved inert object is detached and validated against exact operation-input schema before acceptance",
      actionMaterialization:
        "ValueSpec, token, and format composition is deliberately deferred to M04-T11",
      defaultConcurrency: "omitted concurrency is reject",
      acceptedIdentity:
        "operation: + RFC 8785 canonical [alias, zeroBasedAttemptGeneration]; invalid and rejected attempts consume no generation",
      capabilityAssertion:
        "missing assertion is malformed and mismatch is controlled before input validation, identity allocation, lifecycle publication, or host effects",
      reject: "pending alias refuses a new invocation without host effects",
      replace:
        "replacement validates first, then supersedes active and queued alias work without settlement leases",
      queue:
        "accepted FIFO identity is retained immediately; a settlement-handler turn may stage the FIFO head as pending, but no staged host call starts before predecessor lease acknowledgement",
      pendingPublication: "before operation host callback",
      synchronousSettlement: "later Promise microtask",
      outputBoundary:
        "exact operation-output validation before detached frozen successful lifecycle exposure",
      publicFailure: "exact Catalog-declared code only",
      technicalFailure:
        "denial, invalid output, malformed/undeclared/throw/reject adapter outcomes return lifecycle to idle with redacted diagnostics",
      staleSettlement: "attempt authority rejected before settlement envelope inspection",
      settlementLease:
        "opaque manager-bound one-shot acknowledgement; terminal lifecycle is public before delivery",
      turnBoundary:
        "M04-T11/M04-T13 settlement action turn must finish before acknowledgement promotes queued work",
      finiteLimits: Object.freeze({
        maxQueuedInvocations: 64,
        maxActiveTransports: 64,
        hostProfile: "may lower but never raise finite ceilings",
        snapshotCapacity:
          "pending and terminal transitions reserved before every started or queued acceptance",
        queueScope: "aggregate manager bound, not multiplied by alias count",
      }),
      hostCallbacks: "operation and diagnostic callbacks invoked without a receiver",
      disposal:
        "terminal, idempotent, resolves unfinished work, invalidates leases, and replaces handle authority with sentinel",
      retry: null,
      timeout: null,
      cache: null,
      physicalCancellation: null,
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
        "docs/proof/RUNTIME-CORE-OPERATION-LIFECYCLE.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "ValueSpec, token, and format action input materialization (M04-T11)",
      "settlement handler dispatch and acknowledgement ownership (M04-T11)",
      "bounded action-program turn execution and reentrant safe points (M04-T13)",
      "component-command and outbound-event runtime channels (M04-T12 and M04-T14)",
      "complete same-turn session provenance and sign-in flow (M04-T16)",
      "adapter rendering and platform lifecycle implementations",
      "physical transport cancellation, retry, timeout, persistence, and offline policy",
      "future protocol clarification of PF-020, PF-022, PF-031, and PF-039",
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
    fail("OPERATION_ARTIFACT_MISSING", "M04-T09 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("OPERATION_ARTIFACT_UNSAFE", "M04-T09 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T09 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreOperationLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_OPERATION_LIFECYCLE_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreOperationLifecycleEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("OPERATION_ARTIFACT_DRIFT", "M04-T09 artifact differs from fresh evidence.", {
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
    mountAndAuthorityProbes: expected.artifact.runtime.mountAndAuthorityProbes,
    inputAndIdentityProbes: expected.artifact.runtime.inputAndIdentityProbes,
    concurrencyProbes: expected.artifact.runtime.concurrencyProbes,
    settlementContainmentProbes: expected.artifact.runtime.settlementContainmentProbes,
    leaseAndTurnBoundaryProbes: expected.artifact.runtime.leaseAndTurnBoundaryProbes,
    finiteLimitProbes: expected.artifact.runtime.finiteLimitProbes,
    receiverAndReentryProbes: expected.artifact.runtime.receiverAndReentryProbes,
    disposalProbes: expected.artifact.runtime.disposalProbes,
    hostileEnvelopeReads: expected.artifact.runtime.hostileEnvelopeReads,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T09 evidence after every proof check passes. */
export async function writeRuntimeCoreOperationLifecycleEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_OPERATION_LIFECYCLE_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreOperationLifecycleEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreOperationLifecycleEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
