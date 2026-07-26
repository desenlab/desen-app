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

/** Absolute path to the deterministic M04-T10 state/navigation action artifact. */
export const DEFAULT_RUNTIME_CORE_STATE_NAVIGATION_ACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
);

const TOKEN_FORMAT_PREREQUISITE = Object.freeze({
  task: "M04-T03",
  path: "docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
  artifact: "runtime-core-0.1.0-token-format-resolution.json",
  sha256: "be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f",
});
const PREDICATE_PREREQUISITE = Object.freeze({
  task: "M04-T04",
  path: "docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json",
  artifact: "runtime-core-0.1.0-predicate-evaluation.json",
  sha256: "14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1",
});
const LOCAL_STATE_PREREQUISITE = Object.freeze({
  task: "M04-T06",
  path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
  artifact: "runtime-core-0.1.0-local-state-identity.json",
  sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
});
const EXECUTION_CONTRACT_PREREQUISITE = Object.freeze({
  task: "M02-T11",
  path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  artifact: "protocol-0.1.0-execution-contracts.json",
  sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
});

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_STATE_NAVIGATION_ACTION_LIMITS",
  "disposeRuntimeStateNavigationActions",
  "executeRuntimeStateNavigationAction",
  "mountRuntimeStateNavigationActions",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeActionGuardRejected",
  "RuntimeActionPayloadRejected",
  "RuntimeActionSkipped",
  "RuntimeNavigateAction",
  "RuntimeNavigationAdapterFailed",
  "RuntimeNavigationDenied",
  "RuntimeNavigationSucceeded",
  "RuntimeStateActionApplied",
  "RuntimeStateActionRejected",
  "RuntimeStateNavigationAction",
  "RuntimeStateNavigationActionResult",
  "RuntimeStateNavigationActionsDisposeResult",
  "RuntimeStateNavigationActionsHandle",
  "RuntimeStateNavigationActionsMountInput",
  "RuntimeStateNavigationActionsMountInvalidReason",
  "RuntimeStateNavigationActionsMountResult",
  "RuntimeStateSetAction",
  "RuntimeStateToggleAction",
]);
const EXPECTED_SOURCE_IMPORTS = Object.freeze([
  "./action-evaluation.js",
  "./host-ports.js",
  "./local-state.js",
  "./predicate-evaluation.js",
  "./runtime-json-snapshot.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "@desen/protocol",
]);
const EXPECTED_ACTION_EVALUATION_RUNTIME_EXPORTS = Object.freeze([
  "captureRuntimeActionWhen",
  "createRuntimeActionEvaluationSession",
  "evaluateRuntimeActionGuard",
  "materializeRuntimeActionNamedValues",
  "materializeRuntimeActionValue",
]);
const EXPECTED_ACTION_EVALUATION_TYPE_EXPORTS = Object.freeze([
  "RuntimeActionEvaluationSession",
  "RuntimeActionEvaluationSessionInput",
  "RuntimeActionGuardEvaluation",
  "RuntimeActionWhenCapture",
]);
const EXPECTED_ACTION_EVALUATION_IMPORTS = Object.freeze([
  "./host-ports.js",
  "./predicate-evaluation.js",
  "./runtime-json-snapshot.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "@desen/protocol",
]);
const EXPECTED_FOCUSED_TESTS = 42;
const EXPECTED_COMPILER_NEGATIVE_CASES = 11;
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/state-navigation-actions.test.ts";
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-074",
    owners: Object.freeze(["M02-T11", "M04-T10"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-075",
    owners: Object.freeze(["M02-T11", "M04-T10"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-076",
    owners: Object.freeze(["M02-T11", "M04-T10", "M12-T03"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-105",
    owners: Object.freeze(["M04-T01", "M04-T10", "M05-T07"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-122",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
]);
const FINDING_HEADING =
  "## PF-040 — State and navigation actions require a deterministic guard, snapshot, and terminal-lifetime profile";
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T10",
  "guard",
  "hostile",
  "action-local",
  "action-evaluation",
  "token",
  "TOCTOU",
  "`state.set`",
  "`state.toggle`",
  "exactly a JSON boolean",
  "same-Bundle",
  "ENTRY_NOT_FOUND",
  "`/surface`",
  "synthetic array",
  "NAVIGATION_DENIED",
  "ADAPTER_FAILURE",
  "without a receiver",
  "same-surface",
  "terminal",
  "tombstone",
  "M04-T13",
  "M04-T16",
  "PF-040",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T10 state/navigation evidence",
  "builds byte-identical state/navigation evidence twice",
  "rejects stale or tampered state/navigation evidence",
  "rejects stale M04-T03 prerequisite bytes",
  "rejects stale M04-T04 prerequisite bytes",
  "rejects stale M04-T06 prerequisite bytes",
  "rejects stale M02-T11 prerequisite bytes",
  "detects guard-first hostile non-observation drift",
  "detects shared token-session and post-token TOCTOU drift",
  "detects state-set schema and exact-snapshot drift",
  "detects exact-boolean toggle drift",
  "detects local-target-before-params drift",
  "detects navigation request and receiver drift",
  "detects denial and adapter-failure containment drift",
  "detects terminal navigation and state-disposal drift",
  "detects explicit disposal and late-effect drift",
  "detects semantic source ordering drift",
  "detects public export, TSDoc, and platform drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/action-evaluation.ts",
  "packages/runtime-core/src/state-navigation-actions.ts",
  "packages/runtime-core/test/state-navigation-actions.test.ts",
  "packages/runtime-core/test/state-navigation-actions.types.ts",
  "packages/runtime-core/dist/action-evaluation.js",
  "packages/runtime-core/dist/action-evaluation.js.map",
  "packages/runtime-core/dist/action-evaluation.d.ts",
  "packages/runtime-core/dist/action-evaluation.d.ts.map",
  "packages/runtime-core/dist/state-navigation-actions.js",
  "packages/runtime-core/dist/state-navigation-actions.js.map",
  "packages/runtime-core/dist/state-navigation-actions.d.ts",
  "packages/runtime-core/dist/state-navigation-actions.d.ts.map",
  "scripts/lib/runtime-core-state-navigation-actions-proof.mjs",
  "scripts/generate-runtime-core-state-navigation-actions-proof.mjs",
  "scripts/verify-runtime-core-state-navigation-actions.mjs",
  "tests/runtime-core-state-navigation-actions.test.mjs",
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

/** Stable failure used by deterministic M04-T10 evidence and hostile mutation tests. */
export class RuntimeCoreStateNavigationActionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreStateNavigationActionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreStateNavigationActionsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("STATE_ACTION_EVIDENCE_OPTIONS_INVALID", "Evidence options must be an object.");
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
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function assertDataEqual(actual, expected, label) {
  const normalized = plainData(actual);
  if (!isDeepStrictEqual(normalized, expected)) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
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
      fail("STATE_ACTION_IMPORT_BOUNDARY_DRIFT", "Action imports must use literal names.");
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(parsed, code = "STATE_ACTION_PLATFORM_BOUNDARY_DRIFT") {
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
    fail(code, "State/navigation actions crossed the platform-neutral boundary.", {
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
      statement.moduleSpecifier.text !== "./state-navigation-actions.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "STATE_ACTION_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased state/navigation exports.`,
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

function moduleReferences(sourceText, fileName, modulePath) {
  const parsed = sourceFile(
    sourceText,
    fileName,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const references = [];
  for (const statement of parsed.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === modulePath
    ) {
      references.push(statement.getText(parsed));
    }
  }
  return Object.freeze(references);
}

function verifyInternalActionEvaluationApi({
  sourceText,
  declarationText,
  builtJavaScript,
  sourceIndexText,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = exportedDeclarations(sourceText, "action-evaluation.ts");
  assertDirectExports(source, "ACTION_EVALUATION_SOURCE_EXPORT_DRIFT", "Action evaluation source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_ACTION_EVALUATION_RUNTIME_EXPORTS,
    "ACTION_EVALUATION_SOURCE_EXPORT_DRIFT",
    "Action evaluation runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_ACTION_EVALUATION_TYPE_EXPORTS,
    "ACTION_EVALUATION_SOURCE_EXPORT_DRIFT",
    "Action evaluation type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail(
      "ACTION_EVALUATION_TSDOC_MISSING",
      "Every exported internal action-evaluation declaration requires TSDoc.",
      { missing: source.missingTsdoc },
    );
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_ACTION_EVALUATION_IMPORTS,
    "ACTION_EVALUATION_IMPORT_BOUNDARY_DRIFT",
    "Action evaluation imports",
  );
  verifyPlatformBoundary(source.sourceFile, "ACTION_EVALUATION_PLATFORM_BOUNDARY_DRIFT");
  verifyActionEvaluationSourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "action-evaluation.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(
    declaration,
    "ACTION_EVALUATION_DECLARATION_DRIFT",
    "Action evaluation declaration",
  );
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_ACTION_EVALUATION_RUNTIME_EXPORTS,
    "ACTION_EVALUATION_DECLARATION_DRIFT",
    "Built action evaluation runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_ACTION_EVALUATION_TYPE_EXPORTS,
    "ACTION_EVALUATION_DECLARATION_DRIFT",
    "Built action evaluation type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail(
      "ACTION_EVALUATION_DECLARATION_DRIFT",
      "Built action-evaluation declarations lost TSDoc.",
      { missing: declaration.missingTsdoc },
    );
  }
  verifyPlatformBoundary(declaration.sourceFile, "ACTION_EVALUATION_DECLARATION_DRIFT");

  const built = exportedDeclarations(builtJavaScript, "action-evaluation.js", ts.ScriptKind.JS);
  assertDirectExports(
    built,
    "ACTION_EVALUATION_DISTRIBUTION_DRIFT",
    "Built action evaluation JavaScript",
  );
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_ACTION_EVALUATION_RUNTIME_EXPORTS,
    "ACTION_EVALUATION_DISTRIBUTION_DRIFT",
    "Built action evaluation JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "ACTION_EVALUATION_DISTRIBUTION_DRIFT",
    "Built action evaluation JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "ACTION_EVALUATION_DISTRIBUTION_DRIFT");

  for (const [text, fileName] of [
    [sourceIndexText, "src/index.ts"],
    [builtIndexDeclarationText, "dist/index.d.ts"],
    [builtIndexJavaScript, "dist/index.js"],
  ]) {
    const references = moduleReferences(text, fileName, "./action-evaluation.js");
    if (references.length > 0) {
      fail(
        "ACTION_EVALUATION_INDEX_LEAK",
        `${fileName} must not expose the package-internal action-evaluation seam.`,
        { references },
      );
    }
  }

  return Object.freeze({
    runtimeExports: EXPECTED_ACTION_EVALUATION_RUNTIME_EXPORTS,
    typeExports: EXPECTED_ACTION_EVALUATION_TYPE_EXPORTS,
    tsdocDeclarations: source.runtimeExports.length + source.typeExports.length,
    sourceImports: EXPECTED_ACTION_EVALUATION_IMPORTS,
    packageInternal: true,
  });
}

function normalizeSource(sourceText) {
  return sourceText.replaceAll(/\s+/gu, " ");
}

function positionOf(normalized, marker, code = "STATE_ACTION_SOURCE_SEMANTIC_DRIFT") {
  const index = normalized.indexOf(marker);
  if (index < 0) {
    fail(code, `State/navigation implementation is missing reviewed invariant: ${marker}`);
  }
  return index;
}

function assertOrder(normalized, markers, label, code = "STATE_ACTION_SOURCE_SEMANTIC_DRIFT") {
  let cursor = 0;
  for (const marker of markers) {
    const index = normalized.indexOf(marker, cursor);
    if (index < 0) {
      fail(code, `${label} ordering changed.`, {
        missingAfter: marker,
      });
    }
    cursor = index + marker.length;
  }
}

function functionSource(parsed, name, code) {
  const declaration = parsed.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name !== undefined &&
      statement.name.text === name,
  );
  if (declaration === undefined || declaration.body === undefined) {
    fail(code, `Reviewed function ${name} is missing.`);
  }
  return normalizeSource(declaration.getText(parsed));
}

function verifyActionEvaluationSourceInvariants(sourceText) {
  const parsed = sourceFile(sourceText, "action-evaluation.ts");
  const retention = functionSource(
    parsed,
    "retentionFits",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    retention,
    [
      "for (const [cachedToken, cachedResult] of cache)",
      'if (cachedResult !== "failed")',
      "retained.push(Object.freeze([token, result]));",
      "retained.sort(",
      "snapshotRuntimeJsonValue(retained)",
    ],
    "Aggregate token-retention",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );

  const tokenPort = functionSource(
    parsed,
    "createTokenPort",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    tokenPort,
    [
      "if (!active(authority))",
      "const cached = authority.cache.get(token);",
      "Reflect.apply(authority.resolveToken, undefined,",
      "if (!active(authority))",
      "captured = captureTokenResolution(raw);",
      "if (!active(authority))",
      "!retentionFits(authority.cache, token,",
      "authority.budgetExceeded = true;",
      'authority.cache.set(token, "failed");',
      "authority.cache.set(token, captured",
    ],
    "Detached action-wide token session",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );

  const captureWhen = functionSource(
    parsed,
    "captureRuntimeActionWhen",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  positionOf(
    captureWhen,
    'const when = ownDataValue(action, "when");',
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  for (const forbidden of [
    '"type"',
    '"path"',
    '"value"',
    '"surface"',
    '"params"',
    '"extensions"',
  ]) {
    if (captureWhen.includes(forbidden)) {
      fail(
        "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
        `Guard capture observed forbidden payload key ${forbidden}.`,
      );
    }
  }

  const guard = functionSource(
    parsed,
    "evaluateRuntimeActionGuard",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    guard,
    [
      "prepareRuntimePredicateEvaluation(",
      "for (const operand of prepared.operands)",
      "materializeRuntimeValue(spec, snapshot, materializationContext(authority))",
      "evaluatePreparedRuntimePredicate(prepared, Object.freeze(outcomes))",
    ],
    "Prepared action guard",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  positionOf(guard, 'result.status === "failed"', "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT");
  positionOf(
    guard,
    'authority.budgetExceeded ? Object.freeze({ status: "invalid"',
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );

  const singleValue = functionSource(
    parsed,
    "materializeRuntimeActionValue",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    singleValue,
    [
      "if (authority.budgetExceeded) return invalidMaterialization();",
      "const result = materializeRuntimeValue(",
      'authority.budgetExceeded && result.status === "failed"',
      "? invalidMaterialization(result.pointer)",
    ],
    "Aggregate-overflow classification",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );

  const namedValues = functionSource(
    parsed,
    "materializeRuntimeActionNamedValues",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    namedValues,
    [
      "const captured = snapshotRuntimeJsonValue(input);",
      "const keys = Object.keys(captured).sort(compareText);",
      "const specs = keys.map(",
      "const result = materializeRuntimeActionValue(session, specs, snapshot);",
      "pointer: remapArrayPointer(keys, result.pointer)",
      "const values: Record<string, RuntimeJsonValue> = Object.create(null);",
      "const detached = snapshotRuntimeJsonValue(values);",
    ],
    "Sorted named-value materialization",
    "ACTION_EVALUATION_SOURCE_SEMANTIC_DRIFT",
  );
}

function verifySourceInvariants(sourceText) {
  const parsed = sourceFile(sourceText, "state-navigation-actions.ts");
  const normalized = normalizeSource(sourceText);
  positionOf(normalized, 'const SURFACE_POINTER = createJsonPointer(["surface"]);');
  positionOf(normalized, "StateNavigationActionAuthority | StateNavigationActionTombstone");

  const mount = functionSource(
    parsed,
    "mountRuntimeStateNavigationActions",
    "STATE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    mount,
    [
      "const state = readRuntimeSurfaceState(envelope.stateHandle);",
      "hostPorts = createRuntimeHostPorts(envelope.hostPorts);",
      "const recapturedState = readRuntimeSurfaceState(envelope.stateHandle);",
      "recapturedState.snapshot !== envelope.stateSnapshot",
      "const authority: StateNavigationActionAuthority = {",
      "EXECUTOR_AUTHORITIES.set(handle, authority);",
    ],
    "Mount capture and state revalidation",
  );

  const execute = functionSource(
    parsed,
    "executeRuntimeStateNavigationAction",
    "STATE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    execute,
    [
      "if (authority.transitioning || authority.reporting)",
      "const current = currentStateSnapshot(authority);",
      "const requestId = nextRequestId(authority);",
      "authority.transitioning = true;",
      "session = createRuntimeActionEvaluationSession(",
      "const capturedWhen = captureRuntimeActionWhen(action);",
      "const afterWhenCapture = observationFailure(authority, stateSnapshot);",
      "const evaluatedGuard = evaluateRuntimeActionGuard(",
      "const afterGuardEvaluation = observationFailure(authority, stateSnapshot);",
      "if (!guard.value)",
      "safeReport(authority, guard.diagnostics);",
      "const afterGuardReport = observationFailure(authority, stateSnapshot);",
      "const plainAction = isPlainRecord(action);",
      "const afterActionPrototype = observationFailure(authority, stateSnapshot);",
      'const type = ownDataValue(action, "type");',
      "const afterTypeCapture = observationFailure(authority, stateSnapshot);",
    ],
    "Guard-first action observation",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "state.set")',
      "const validShape =",
      "const afterShape = observationFailure(authority, stateSnapshot);",
      'const path = ownDataValue(action, "path");',
      'const value = ownDataValue(action, "value");',
      "const afterPayloadCapture = observationFailure(authority, stateSnapshot);",
      "const materialized = materializePayload(",
      "const afterMaterialization = observationFailure(authority, stateSnapshot);",
      "return applyStateWrite(",
    ],
    "State.set authorization",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "state.toggle")',
      "const validShape =",
      "const afterShape = observationFailure(authority, stateSnapshot);",
      'const path = ownDataValue(action, "path");',
      "const afterPathCapture = observationFailure(authority, stateSnapshot);",
      "const currentValue = pathValue(stateSnapshot, path.value);",
      'if (typeof currentValue !== "boolean")',
      "return applyStateWrite(",
    ],
    "Exact boolean toggle",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "navigate")',
      'const surface = ownDataValue(action, "surface");',
      "const afterSurfaceCapture = observationFailure(authority, stateSnapshot);",
      '"ENTRY_NOT_FOUND"',
      "SURFACE_POINTER",
      "return observationFailure(authority, stateSnapshot) ?? rejected;",
      "const validShape =",
      "const afterShape = observationFailure(authority, stateSnapshot);",
      'const params = ownDataValue(action, "params");',
      "const afterParamsCapture = observationFailure(authority, stateSnapshot);",
      "materializeRuntimeActionNamedValues(",
      "const afterParamMaterialization = observationFailure(authority, stateSnapshot);",
      "const beforeNavigation = observationFailure(authority, stateSnapshot);",
      "acceptRequest(authority);",
      "Reflect.apply(authority.hostPorts.navigation.navigate, undefined,",
      "const afterNavigationCallback = observationFailure(authority, stateSnapshot);",
      "const result = closedNavigationResult(rawResult);",
      "const afterResultCapture = observationFailure(authority, stateSnapshot);",
      '"run.desen.runtime/NAVIGATION_DENIED"',
      'authority.status = "revoked";',
      "disposeRuntimeSurfaceState(authority.stateHandle);",
      'EXECUTOR_AUTHORITIES.set(handle, Object.freeze({ status: "navigated" }));',
    ],
    "Local navigation and terminal tombstone",
  );

  const applyWrite = functionSource(
    parsed,
    "applyStateWrite",
    "STATE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    applyWrite,
    [
      "const beforeWrite = observationFailure(authority, expectedState);",
      "const write = writeRuntimeSurfaceState(",
      'if (write.status === "rejected")',
      "return observationFailure(authority, expectedState) ?? rejected;",
      "acceptRequest(authority);",
      "authority.stateSnapshot = write.snapshot;",
    ],
    "Accepted state-write identity",
  );

  const dispose = functionSource(
    parsed,
    "disposeRuntimeStateNavigationActions",
    "STATE_ACTION_SOURCE_SEMANTIC_DRIFT",
  );
  assertOrder(
    dispose,
    [
      'authority.status = "revoked";',
      "disposeRuntimeSurfaceState(authority.stateHandle);",
      'EXECUTOR_AUTHORITIES.set(handle, Object.freeze({ status: "disposed" }));',
    ],
    "Explicit disposal tombstone",
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
  const source = exportedDeclarations(sourceText, "state-navigation-actions.ts");
  assertDirectExports(source, "STATE_ACTION_SOURCE_EXPORT_DRIFT", "Action source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "STATE_ACTION_SOURCE_EXPORT_DRIFT",
    "Action source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "STATE_ACTION_SOURCE_EXPORT_DRIFT",
    "Action source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("STATE_ACTION_TSDOC_MISSING", "Every exported action declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_SOURCE_IMPORTS,
    "STATE_ACTION_IMPORT_BOUNDARY_DRIFT",
    "Action source imports",
  );
  verifyPlatformBoundary(source.sourceFile);
  verifySourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "state-navigation-actions.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(declaration, "STATE_ACTION_DECLARATION_DRIFT", "Action declaration");
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "STATE_ACTION_DECLARATION_DRIFT",
    "Built action runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "STATE_ACTION_DECLARATION_DRIFT",
    "Built action type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("STATE_ACTION_DECLARATION_DRIFT", "Built action declarations lost TSDoc.", {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "STATE_ACTION_DECLARATION_DRIFT");

  const built = exportedDeclarations(
    builtJavaScript,
    "state-navigation-actions.js",
    ts.ScriptKind.JS,
  );
  assertDirectExports(built, "STATE_ACTION_DISTRIBUTION_DRIFT", "Built action JavaScript");
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "STATE_ACTION_DISTRIBUTION_DRIFT",
    "Built action JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "STATE_ACTION_DISTRIBUTION_DRIFT",
    "Built action JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "STATE_ACTION_DISTRIBUTION_DRIFT");

  for (const [text, fileName, expectedTypes] of [
    [sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexJavaScript, "dist/index.js", []],
  ]) {
    const exports = moduleIndexExports(text, fileName);
    assertArrayEqual(
      exports.runtimeExports,
      EXPECTED_RUNTIME_EXPORTS,
      "STATE_ACTION_INDEX_EXPORT_DRIFT",
      `${fileName} state/navigation runtime exports`,
    );
    assertArrayEqual(
      exports.typeExports,
      expectedTypes,
      "STATE_ACTION_INDEX_EXPORT_DRIFT",
      `${fileName} state/navigation type exports`,
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
  fail("STATE_ACTION_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "state-navigation-actions.test.ts");
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
          fail("STATE_ACTION_TEST_INVENTORY_DRIFT", "it.each must use a static array table.");
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
        fail("STATE_ACTION_TEST_INVENTORY_DRIFT", "Focused action tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail("STATE_ACTION_TEST_INVENTORY_DRIFT", "Focused action titles must be unique.");
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("STATE_ACTION_TEST_INVENTORY_DRIFT", "Focused action case count changed.", {
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
    fail("STATE_ACTION_TYPE_TEST_DRIFT", "Compiler-negative evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("STATE_ACTION_TYPE_TEST_DRIFT", "Compiler-negative action inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-state-navigation-actions.test.mjs",
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
        fail("STATE_ACTION_ROOT_TEST_DRIFT", "Root action tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "STATE_ACTION_ROOT_TEST_DRIFT",
    "Root action mutation titles",
  );
  return Object.freeze(titles);
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  if (runtimeManifest.scripts?.["test:state-navigation-actions"] !== EXPECTED_PACKAGE_TEST_SCRIPT) {
    fail(
      "STATE_ACTION_PACKAGE_WIRING_DRIFT",
      "The runtime package state/navigation action command changed or is absent.",
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
    fail("STATE_ACTION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite hash changed.`, {
      task: prerequisite.task,
      expectedSha256: prerequisite.sha256,
      actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("STATE_ACTION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite is not JSON.`);
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== prerequisite.task ||
    artifact.result !== "PASS"
  ) {
    fail("STATE_ACTION_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite identity changed.`);
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
        fail("STATE_ACTION_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "STATE_ACTION_TRACE_DRIFT",
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

function findingSection(findings, heading) {
  const start = findings.indexOf(heading);
  if (start < 0) fail("STATE_ACTION_FINDING_DRIFT", `${heading} is missing.`);
  const next = findings.indexOf("\n## PF-", start + heading.length);
  return findings.slice(start, next < 0 ? findings.length : next);
}

function verifyDocumentation(findings, proofDocument) {
  const section = findingSection(findings, FINDING_HEADING);
  if (!section.includes("- Status: OPEN") || !section.includes("- Blocks proof: No")) {
    fail("STATE_ACTION_FINDING_DRIFT", "PF-040 must remain OPEN and non-blocking.");
  }
  for (const related of ["PF-017", "PF-019", "PF-031", "PF-039"]) {
    const relatedSection = findingSection(findings, `## ${related} —`);
    if (!relatedSection.includes("- Status: OPEN")) {
      fail("STATE_ACTION_FINDING_DRIFT", `${related} must remain an explicit OPEN boundary.`);
    }
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("STATE_ACTION_PROOF_DOCUMENT_DRIFT", `M04-T10 proof is missing: ${required}`);
    }
  }
  return Object.freeze({
    finding: "PF-040",
    findingStatus: "OPEN",
    relatedOpenFindings: Object.freeze(["PF-017", "PF-019", "PF-031", "PF-039"]),
    proofDocument: "docs/proof/RUNTIME-CORE-STATE-NAVIGATION-ACTIONS.md",
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

function mustMountState(api, surfaceId = "main") {
  const mounted = api.mountRuntimeSurfaceState({
    surfaceId,
    state: {
      count: {
        schema: { type: "integer", minimum: 0 },
        initial: 1,
      },
      enabled: {
        schema: { type: "boolean" },
        initial: false,
      },
      label: {
        schema: { type: "string", minLength: 1 },
        initial: "before",
      },
    },
  });
  if (mounted.status !== "mounted") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "State fixture did not mount.", {
      actual: plainData(mounted),
    });
  }
  return mounted;
}

function resolutionSnapshot(api, stateSnapshot) {
  return api.createRuntimeResolutionSnapshot({
    state: stateSnapshot.values,
    context: { route: { source: "proof" } },
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { locale: "tr-TR", platform: "web" },
  });
}

function hostInput({
  navigate = () => ({ status: "denied" }),
  resolveToken = () => ({ status: "missing" }),
  report = () => undefined,
} = {}) {
  return {
    navigation: { navigate },
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
    operations: {
      invoke: () => ({ status: "succeeded", value: null }),
    },
    resources: {
      load: () => ({ status: "succeeded", value: null }),
    },
    tokens: { resolve: resolveToken },
    context: {
      getSnapshot: () => ({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => ({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1_789_000_000_000 },
    diagnostics: { report },
  };
}

function mountFixture(
  api,
  { surfaceId = "main", surfaceIds = ["main", "next"], navigate, resolveToken, report } = {},
) {
  const state = mustMountState(api, surfaceId);
  const ports = api.createRuntimeHostPorts(hostInput({ navigate, resolveToken, report }));
  const mounted = api.mountRuntimeStateNavigationActions({
    documentId: "com.desen.proof",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId,
    surfaceIds,
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    hostPorts: ports,
  });
  if (mounted.status !== "mounted") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Action fixture did not mount.", {
      actual: plainData(mounted),
    });
  }
  return {
    state,
    ports,
    mountResult: mounted,
    handle: mounted.handle,
    stateSnapshot: mounted.stateSnapshot,
    resolutionSnapshot: resolutionSnapshot(api, mounted.stateSnapshot),
  };
}

function readCurrentState(api, fixture) {
  const read = api.readRuntimeSurfaceState(fixture.state.handle);
  if (read.status !== "active") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Expected active proof state.", {
      actual: plainData(read),
    });
  }
  fixture.stateSnapshot = read.snapshot;
  fixture.resolutionSnapshot = resolutionSnapshot(api, read.snapshot);
  return read.snapshot;
}

function executeAction(api, fixture, action) {
  return api.executeRuntimeStateNavigationAction(
    fixture.handle,
    action,
    fixture.resolutionSnapshot,
    fixture.stateSnapshot,
  );
}

function assertFrozenResult(result, label) {
  assertDeepFrozen(result, label);
  if (!Object.isFrozen(result)) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} is mutable.`);
  }
}

function expectDiagnostic(result, code, pointer, label) {
  const diagnostic = result.diagnostics?.[0];
  if (
    diagnostic?.code !== code ||
    (pointer !== undefined && diagnostic.pointer !== pointer) ||
    JSON.stringify(result).includes("private")
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} diagnostic changed.`, {
      actual: plainData(result),
    });
  }
  assertDeepFrozen(result.diagnostics, `${label} diagnostics`);
}

function trueGuardWithMismatch(operand = true) {
  return {
    op: "all",
    args: [
      { op: "truthy", args: [operand] },
      {
        op: "any",
        args: [true, { op: "gt", args: [false, 1] }],
      },
    ],
  };
}

function actionRequestId(generation, surfaceId = "main") {
  return `action:${JSON.stringify([surfaceId, generation])}`;
}

async function probeRuntimeBehavior(api) {
  for (const name of [
    "createRuntimeHostPorts",
    "createRuntimeResolutionSnapshot",
    "disposeRuntimeStateNavigationActions",
    "disposeRuntimeSurfaceState",
    "executeRuntimeStateNavigationAction",
    "mountRuntimeStateNavigationActions",
    "mountRuntimeSurfaceState",
    "readRuntimeSurfaceState",
    "writeRuntimeSurfaceState",
  ]) {
    if (typeof api[name] !== "function") {
      fail("STATE_ACTION_RUNTIME_API_MISSING", `Runtime API is missing ${name}.`);
    }
  }

  const mountCalls = { navigation: 0, token: 0, diagnostic: 0 };
  const mounted = mountFixture(api, {
    navigate() {
      mountCalls.navigation += 1;
      return { status: "denied" };
    },
    resolveToken() {
      mountCalls.token += 1;
      return { status: "missing" };
    },
    report() {
      mountCalls.diagnostic += 1;
    },
  });
  assertFrozenResult(mounted.mountResult, "Mounted executor envelope");
  assertDataEqual(mountCalls, { navigation: 0, token: 0, diagnostic: 0 }, "Mount host isolation");

  const malformedMount = api.mountRuntimeStateNavigationActions({});
  if (malformedMount.status !== "invalid" || malformedMount.reason !== "malformed-input") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Malformed mount result changed.");
  }
  const invalidInventoryState = mustMountState(api);
  const invalidInventory = api.mountRuntimeStateNavigationActions({
    documentId: "com.desen.proof",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId: "main",
    surfaceIds: ["next", "next"],
    stateHandle: invalidInventoryState.handle,
    stateSnapshot: invalidInventoryState.snapshot,
    hostPorts: api.createRuntimeHostPorts(hostInput()),
  });
  if (
    invalidInventory.status !== "invalid" ||
    invalidInventory.reason !== "invalid-surface-inventory"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Surface inventory validation changed.");
  }
  const foreignState = mustMountState(api);
  const foreignSnapshot = mustMountState(api);
  const invalidStateAuthority = api.mountRuntimeStateNavigationActions({
    documentId: "com.desen.proof",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId: "main",
    surfaceIds: ["main"],
    stateHandle: foreignState.handle,
    stateSnapshot: foreignSnapshot.snapshot,
    hostPorts: api.createRuntimeHostPorts(hostInput()),
  });
  if (
    invalidStateAuthority.status !== "invalid" ||
    invalidStateAuthority.reason !== "invalid-state-authority"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Foreign state authority mounted.");
  }

  for (const mode of ["mutate", "dispose"]) {
    const racedState = mustMountState(api);
    const racedCalls = { navigation: 0, token: 0, diagnostic: 0 };
    const capturedPorts = api.createRuntimeHostPorts(
      hostInput({
        navigate() {
          racedCalls.navigation += 1;
          return { status: "succeeded" };
        },
        resolveToken() {
          racedCalls.token += 1;
          return { status: "resolved", value: true };
        },
        report() {
          racedCalls.diagnostic += 1;
        },
      }),
    );
    let descriptorTraps = 0;
    const hostileTokenPort = new Proxy(capturedPorts.tokens, {
      getOwnPropertyDescriptor(target, key) {
        if (key === "resolve" && descriptorTraps === 0) {
          descriptorTraps += 1;
          if (mode === "mutate") {
            api.writeRuntimeSurfaceState(racedState.handle, {
              path: "label",
              value: "host-capture-race",
            });
          } else {
            api.disposeRuntimeSurfaceState(racedState.handle);
          }
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const hostilePorts = {
      ...capturedPorts,
      tokens: hostileTokenPort,
    };
    const racedMount = api.mountRuntimeStateNavigationActions({
      documentId: "com.desen.proof",
      revision: `sha256:${"a".repeat(64)}`,
      surfaceId: "main",
      surfaceIds: ["main", "next"],
      stateHandle: racedState.handle,
      stateSnapshot: racedState.snapshot,
      hostPorts: hostilePorts,
    });
    if (
      racedMount.status !== "invalid" ||
      racedMount.reason !== "invalid-state-authority" ||
      descriptorTraps !== 1 ||
      racedCalls.navigation !== 0 ||
      racedCalls.token !== 0 ||
      racedCalls.diagnostic !== 0
    ) {
      fail(
        "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        `Host-capture ${mode} race did not fail mount closed.`,
      );
    }
  }

  let falsePayloadReads = 0;
  let falseTokenCalls = 0;
  let falseNavigationCalls = 0;
  let falseDiagnosticCalls = 0;
  const falseFixture = mountFixture(api, {
    navigate() {
      falseNavigationCalls += 1;
      return { status: "succeeded" };
    },
    resolveToken() {
      falseTokenCalls += 1;
      return { status: "resolved", value: true };
    },
    report() {
      falseDiagnosticCalls += 1;
    },
  });
  const falseAction = {
    when: {
      op: "all",
      args: [false, "not-a-boolean"],
    },
  };
  for (const key of ["type", "path", "value", "surface", "params", "extensions"]) {
    Object.defineProperty(falseAction, key, {
      enumerable: true,
      get() {
        falsePayloadReads += 1;
        throw new Error("private hostile payload getter");
      },
    });
  }
  const skipped = executeAction(api, falseFixture, falseAction);
  if (
    skipped.status !== "skipped" ||
    skipped.diagnostics.length !== 1 ||
    skipped.diagnostics[0]?.code !== "PREDICATE_TYPE_MISMATCH" ||
    falsePayloadReads !== 0 ||
    falseTokenCalls !== 0 ||
    falseNavigationCalls !== 0 ||
    falseDiagnosticCalls !== 0 ||
    api.readRuntimeSurfaceState(falseFixture.state.handle).snapshot !== falseFixture.stateSnapshot
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Guard-first hostile non-observation changed.", {
      skipped: plainData(skipped),
      falsePayloadReads,
      falseTokenCalls,
      falseNavigationCalls,
      falseDiagnosticCalls,
    });
  }
  assertFrozenResult(skipped, "Skipped action");

  let descriptorReentry;
  let descriptorTrapCount = 0;
  const descriptorFixture = mountFixture(api);
  const descriptorActionTarget = {
    type: "state.set",
    path: "label",
    value: "must-not-write",
    when: { op: "truthy", args: [false] },
  };
  const descriptorAction = new Proxy(descriptorActionTarget, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "when" && descriptorTrapCount === 0) {
        descriptorTrapCount += 1;
        descriptorReentry = executeAction(api, descriptorFixture, {
          type: "state.set",
          path: "label",
          value: "reentrant",
        });
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const descriptorSkipped = executeAction(api, descriptorFixture, descriptorAction);
  if (
    descriptorSkipped.status !== "skipped" ||
    descriptorReentry?.status !== "busy" ||
    descriptorTrapCount !== 1 ||
    api.readRuntimeSurfaceState(descriptorFixture.state.handle).snapshot !==
      descriptorFixture.stateSnapshot
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Action-descriptor reentry was not blocked before first observation.",
      {
        result: plainData(descriptorSkipped),
        reentry: plainData(descriptorReentry),
        descriptorTrapCount,
        stateUnchanged:
          api.readRuntimeSurfaceState(descriptorFixture.state.handle).snapshot ===
          descriptorFixture.stateSnapshot,
      },
    );
  }

  let descriptorDisposeFixture;
  let descriptorDisposeCount = 0;
  const descriptorDisposeTarget = {
    type: "state.toggle",
    path: "enabled",
    when: true,
  };
  const descriptorDisposeAction = new Proxy(descriptorDisposeTarget, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "when" && descriptorDisposeCount === 0) {
        descriptorDisposeCount += 1;
        api.disposeRuntimeStateNavigationActions(descriptorDisposeFixture.handle);
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  descriptorDisposeFixture = mountFixture(api);
  const descriptorDisposed = executeAction(api, descriptorDisposeFixture, descriptorDisposeAction);
  if (
    descriptorDisposed.status !== "disposed" ||
    descriptorDisposeCount !== 1 ||
    api.readRuntimeSurfaceState(descriptorDisposeFixture.state.handle).status !== "disposed"
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Action-descriptor disposal did not stop the outer action.",
    );
  }

  let falseMutationFixture;
  let falseMutationPayloadReads = 0;
  falseMutationFixture = mountFixture(api, {
    resolveToken() {
      api.writeRuntimeSurfaceState(falseMutationFixture.state.handle, {
        path: "label",
        value: "false-guard-token",
      });
      return { status: "resolved", value: false };
    },
  });
  const falseMutationAction = {
    when: { op: "truthy", args: [{ $token: "mutating.false" }] },
  };
  Object.defineProperty(falseMutationAction, "type", {
    enumerable: true,
    get() {
      falseMutationPayloadReads += 1;
      throw new Error("private false-guard payload");
    },
  });
  const falseMutation = executeAction(api, falseMutationFixture, falseMutationAction);
  const falseMutationState = api.readRuntimeSurfaceState(falseMutationFixture.state.handle);
  if (
    falseMutation.status !== "invalid-snapshot" ||
    falseMutationPayloadReads !== 0 ||
    falseMutationState.status !== "active" ||
    falseMutationState.snapshot.values.label !== "false-guard-token"
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "False-guard evaluation retained stale state authority.",
    );
  }

  const afterSkip = executeAction(api, falseFixture, {
    type: "state.set",
    path: "label",
    value: "after-skip",
  });
  if (
    afterSkip.status !== "state-updated" ||
    afterSkip.requestId !== actionRequestId(0) ||
    afterSkip.stateSnapshot.values.label !== "after-skip"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Skipped guard consumed request identity.");
  }

  let sharedTokenCalls = 0;
  const sharedTokenReceivers = [];
  const sharedDiagnosticReceivers = [];
  let sharedReentry;
  const tokenTarget = { status: "resolved", value: true };
  let sharedFixture;
  const sharedEnvelope = new Proxy(tokenTarget, {});
  sharedFixture = mountFixture(api, {
    resolveToken(request) {
      sharedTokenReceivers.push(this);
      sharedTokenCalls += 1;
      if (
        request.token !== "shared.boolean" ||
        request.context.requestId !== actionRequestId(0) ||
        !Object.isFrozen(request) ||
        !Object.isFrozen(request.context)
      ) {
        throw new Error("unexpected token request");
      }
      return sharedEnvelope;
    },
    report(diagnostic) {
      sharedDiagnosticReceivers.push(this);
      if (diagnostic.code === "PREDICATE_TYPE_MISMATCH") {
        sharedReentry = executeAction(api, sharedFixture, {
          type: "state.set",
          path: "label",
          value: "reentrant",
        });
        tokenTarget.value = false;
      }
    },
  });
  const sharedResult = executeAction(api, sharedFixture, {
    type: "state.set",
    path: "enabled",
    value: { $token: "shared.boolean" },
    when: trueGuardWithMismatch({ $token: "shared.boolean" }),
  });
  if (
    sharedResult.status !== "state-updated" ||
    sharedResult.requestId !== actionRequestId(0) ||
    sharedResult.stateSnapshot.values.enabled !== true ||
    sharedTokenCalls !== 1 ||
    sharedTokenReceivers.length !== 1 ||
    sharedTokenReceivers[0] !== undefined ||
    sharedDiagnosticReceivers.length !== 1 ||
    sharedDiagnosticReceivers[0] !== undefined ||
    sharedReentry?.status !== "busy" ||
    sharedResult.diagnostics[0]?.code !== "PREDICATE_TYPE_MISMATCH"
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Action-local detached token session or diagnostic reentry changed.",
      {
        result: plainData(sharedResult),
        sharedTokenCalls,
        reentry: plainData(sharedReentry),
      },
    );
  }
  assertFrozenResult(sharedResult, "Shared-token state result");

  const aggregateParamCount = 20;
  let aggregateTokenCalls = 0;
  let aggregateNavigationCalls = 0;
  const aggregateParams = {};
  for (let index = 0; index < aggregateParamCount; index += 1) {
    const suffix = String(index).padStart(4, "0");
    aggregateParams[`param_${suffix}`] = { $token: `aggregate.${suffix}` };
  }
  const aggregateFixture = mountFixture(api, {
    resolveToken(request) {
      aggregateTokenCalls += 1;
      return {
        status: "resolved",
        value: {
          id: request.token,
          payload: new Array(400).fill(0),
        },
      };
    },
    navigate() {
      aggregateNavigationCalls += 1;
      return { status: "succeeded" };
    },
  });
  const aggregateRejected = executeAction(api, aggregateFixture, {
    type: "navigate",
    surface: "next",
    params: aggregateParams,
  });
  if (
    aggregateRejected.status !== "payload-rejected" ||
    aggregateRejected.reason !== "invalid" ||
    aggregateTokenCalls <= 0 ||
    aggregateTokenCalls >= aggregateParamCount ||
    aggregateNavigationCalls !== 0
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Action-wide aggregate token retention did not fail closed.",
      {
        result: plainData(aggregateRejected),
        aggregateTokenCalls,
        aggregateParamCount,
        aggregateNavigationCalls,
      },
    );
  }
  expectDiagnostic(
    aggregateRejected,
    "run.desen.runtime/ACTION_INPUT_INVALID",
    undefined,
    "Aggregate token retention",
  );

  const aggregateGuardTokens = Array.from({ length: aggregateParamCount }, (_, index) => ({
    $token: `guard.aggregate.${String(index).padStart(4, "0")}`,
  }));
  let aggregateGuardCalls = 0;
  let aggregateGuardPayloadReads = 0;
  const aggregateGuardFixture = mountFixture(api, {
    resolveToken(request) {
      aggregateGuardCalls += 1;
      return {
        status: "resolved",
        value: {
          id: request.token,
          payload: new Array(400).fill(0),
        },
      };
    },
  });
  const aggregateGuardAction = {
    when: { op: "all", args: aggregateGuardTokens },
  };
  Object.defineProperty(aggregateGuardAction, "type", {
    enumerable: true,
    get() {
      aggregateGuardPayloadReads += 1;
      throw new Error("private aggregate guard payload");
    },
  });
  const aggregateGuardRejected = executeAction(api, aggregateGuardFixture, aggregateGuardAction);
  if (
    aggregateGuardRejected.status !== "guard-rejected" ||
    aggregateGuardRejected.reason !== "invalid" ||
    aggregateGuardCalls <= 0 ||
    aggregateGuardCalls >= aggregateParamCount ||
    aggregateGuardPayloadReads !== 0
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Aggregate guard overflow classification changed.");
  }
  expectDiagnostic(
    aggregateGuardRejected,
    "run.desen.runtime/ACTION_GUARD_INVALID",
    undefined,
    "Aggregate guard retention",
  );

  const oversizedValue = new Array(4_096).fill(0);
  const individualPayloadTokens = [];
  let individualNavigationCalls = 0;
  const individualPayloadFixture = mountFixture(api, {
    resolveToken(request) {
      individualPayloadTokens.push(request.token);
      return request.token === "individual.oversized"
        ? { status: "resolved", value: oversizedValue }
        : { status: "resolved", value: "must-not-resolve" };
    },
    navigate() {
      individualNavigationCalls += 1;
      return { status: "succeeded" };
    },
  });
  const individualPayloadRejected = executeAction(api, individualPayloadFixture, {
    type: "navigate",
    surface: "next",
    params: {
      a: { $token: "individual.oversized" },
      z: { $token: "individual.later" },
    },
  });
  if (
    individualPayloadRejected.status !== "payload-rejected" ||
    individualPayloadRejected.reason !== "adapter-failed" ||
    individualPayloadTokens.length !== 1 ||
    individualPayloadTokens[0] !== "individual.oversized" ||
    individualNavigationCalls !== 0
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Individual payload budget failure changed.");
  }
  expectDiagnostic(
    individualPayloadRejected,
    "ADAPTER_FAILURE",
    undefined,
    "Individual payload budget",
  );

  const individualGuardTokens = [];
  let individualGuardPayloadReads = 0;
  const individualGuardFixture = mountFixture(api, {
    resolveToken(request) {
      individualGuardTokens.push(request.token);
      return request.token === "guard.individual.oversized"
        ? { status: "resolved", value: oversizedValue }
        : { status: "resolved", value: true };
    },
  });
  const individualGuardAction = {
    when: {
      op: "all",
      args: [{ $token: "guard.individual.oversized" }, { $token: "guard.individual.later" }],
    },
  };
  Object.defineProperty(individualGuardAction, "type", {
    enumerable: true,
    get() {
      individualGuardPayloadReads += 1;
      throw new Error("private individual guard payload");
    },
  });
  const individualGuardRejected = executeAction(api, individualGuardFixture, individualGuardAction);
  if (
    individualGuardRejected.status !== "guard-rejected" ||
    individualGuardRejected.reason !== "adapter-failed" ||
    individualGuardTokens.length !== 1 ||
    individualGuardTokens[0] !== "guard.individual.oversized" ||
    individualGuardPayloadReads !== 0
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Individual guard budget failure changed.");
  }
  expectDiagnostic(
    individualGuardRejected,
    "ADAPTER_FAILURE",
    undefined,
    "Individual guard budget",
  );

  const malformedTokenFixture = mountFixture(api, {
    resolveToken() {
      return { status: "private-malformed" };
    },
  });
  const malformedToken = executeAction(api, malformedTokenFixture, {
    type: "state.set",
    path: "label",
    value: { $token: "malformed" },
  });
  if (malformedToken.status !== "payload-rejected" || malformedToken.reason !== "adapter-failed") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Malformed token adapter classification changed.");
  }
  expectDiagnostic(malformedToken, "ADAPTER_FAILURE", undefined, "Malformed token provider");

  let tokenMutationCalls = 0;
  let tokenMutationFixture;
  tokenMutationFixture = mountFixture(api, {
    resolveToken() {
      tokenMutationCalls += 1;
      const write = api.writeRuntimeSurfaceState(tokenMutationFixture.state.handle, {
        path: "label",
        value: "token-won",
      });
      if (write.status !== "updated") throw new Error("token mutation failed");
      return { status: "resolved", value: "candidate-lost" };
    },
  });
  const tokenMutation = executeAction(api, tokenMutationFixture, {
    type: "state.set",
    path: "label",
    value: { $token: "mutating" },
  });
  const tokenMutationState = api.readRuntimeSurfaceState(tokenMutationFixture.state.handle);
  if (
    tokenMutation.status !== "invalid-snapshot" ||
    tokenMutationCalls !== 1 ||
    tokenMutationState.status !== "active" ||
    tokenMutationState.snapshot.values.label !== "token-won"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Post-token state TOCTOU protection changed.");
  }

  let tokenDisposalCalls = 0;
  let tokenDisposalFixture;
  tokenDisposalFixture = mountFixture(api, {
    resolveToken() {
      tokenDisposalCalls += 1;
      api.disposeRuntimeSurfaceState(tokenDisposalFixture.state.handle);
      return { status: "resolved", value: "must-not-write" };
    },
  });
  const tokenDisposed = executeAction(api, tokenDisposalFixture, {
    type: "state.set",
    path: "label",
    value: { $token: "disposing" },
  });
  if (
    tokenDisposed.status !== "state-disposed" ||
    tokenDisposalCalls !== 1 ||
    api.readRuntimeSurfaceState(tokenDisposalFixture.state.handle).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Token-callback state disposal changed.");
  }

  let reportMutationFixture;
  let reportMutationReentry;
  let reportMutationCalls = 0;
  reportMutationFixture = mountFixture(api, {
    report(diagnostic) {
      if (diagnostic.code !== "PREDICATE_TYPE_MISMATCH") return;
      reportMutationCalls += 1;
      reportMutationReentry = executeAction(api, reportMutationFixture, {
        type: "state.toggle",
        path: "enabled",
      });
      api.writeRuntimeSurfaceState(reportMutationFixture.state.handle, {
        path: "label",
        value: "reporter-won",
      });
    },
  });
  const reportMutation = executeAction(api, reportMutationFixture, {
    type: "state.set",
    path: "label",
    value: "candidate-lost",
    when: trueGuardWithMismatch(),
  });
  const reportMutationState = api.readRuntimeSurfaceState(reportMutationFixture.state.handle);
  if (
    reportMutation.status !== "invalid-snapshot" ||
    reportMutationReentry?.status !== "busy" ||
    reportMutationCalls !== 1 ||
    reportMutationState.status !== "active" ||
    reportMutationState.snapshot.values.label !== "reporter-won"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Diagnostic-callback state TOCTOU changed.");
  }

  let reportDisposalFixture;
  let reportDisposalReentry;
  reportDisposalFixture = mountFixture(api, {
    report(diagnostic) {
      if (diagnostic.code !== "PREDICATE_TYPE_MISMATCH") return;
      reportDisposalReentry = executeAction(api, reportDisposalFixture, {
        type: "state.set",
        path: "label",
        value: "reentrant",
      });
      api.disposeRuntimeStateNavigationActions(reportDisposalFixture.handle);
    },
  });
  const reportDisposed = executeAction(api, reportDisposalFixture, {
    type: "state.toggle",
    path: "enabled",
    when: trueGuardWithMismatch(),
  });
  if (
    reportDisposed.status !== "disposed" ||
    reportDisposalReentry?.status !== "busy" ||
    api.readRuntimeSurfaceState(reportDisposalFixture.state.handle).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Diagnostic-callback disposal changed.");
  }

  const stateFixture = mountFixture(api);
  const updated = executeAction(api, stateFixture, {
    type: "state.set",
    path: "label",
    value: "after",
  });
  if (
    updated.status !== "state-updated" ||
    updated.requestId !== actionRequestId(0) ||
    updated.stateSnapshot.values.label !== "after"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Schema-safe state.set changed.");
  }
  assertFrozenResult(updated, "Updated state result");
  readCurrentState(api, stateFixture);
  const unchanged = executeAction(api, stateFixture, {
    type: "state.set",
    path: "label",
    value: { $ref: "state.label" },
  });
  if (
    unchanged.status !== "state-unchanged" ||
    unchanged.requestId !== actionRequestId(1) ||
    unchanged.stateSnapshot !== stateFixture.stateSnapshot
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Unchanged state.set changed.");
  }

  const rejectedFixture = mountFixture(api);
  const rejected = executeAction(api, rejectedFixture, {
    type: "state.set",
    path: "count",
    value: -1,
  });
  expectDiagnostic(rejected, "STATE_WRITE_INVALID", "", "Rejected state.set");
  if (
    rejected.status !== "state-rejected" ||
    rejected.action !== "state.set" ||
    rejected.path !== "count" ||
    api.readRuntimeSurfaceState(rejectedFixture.state.handle).snapshot.values.count !== 1
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Rejected complete-schema write changed.");
  }
  const acceptedAfterReject = executeAction(api, rejectedFixture, {
    type: "state.set",
    path: "count",
    value: 2,
  });
  if (
    acceptedAfterReject.status !== "state-updated" ||
    acceptedAfterReject.requestId !== actionRequestId(0)
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Rejected state.set consumed request generation.");
  }

  const toggleFixture = mountFixture(api);
  const toggled = executeAction(api, toggleFixture, {
    type: "state.toggle",
    path: "enabled",
  });
  if (
    toggled.status !== "state-updated" ||
    toggled.action !== "state.toggle" ||
    toggled.stateSnapshot.values.enabled !== true
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Exact boolean toggle changed.");
  }
  readCurrentState(api, toggleFixture);
  const toggleRejected = executeAction(api, toggleFixture, {
    type: "state.toggle",
    path: "label",
  });
  if (
    toggleRejected.status !== "state-rejected" ||
    toggleRejected.reason !== "toggle-target-not-boolean" ||
    toggleRejected.path !== "label"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Non-boolean toggle rejection changed.");
  }
  expectDiagnostic(toggleRejected, "STATE_WRITE_INVALID", "", "Rejected toggle");

  let nestedParamReads = 0;
  let unknownNavigationCalls = 0;
  const unknownFixture = mountFixture(api, {
    navigate() {
      unknownNavigationCalls += 1;
      return { status: "succeeded" };
    },
  });
  const hostileParams = {};
  Object.defineProperty(hostileParams, "nested", {
    enumerable: true,
    get() {
      nestedParamReads += 1;
      throw new Error("private nested param getter");
    },
  });
  const unknownTarget = executeAction(api, unknownFixture, {
    type: "navigate",
    surface: "outside",
    params: hostileParams,
  });
  if (
    unknownTarget.status !== "unknown-surface" ||
    unknownTarget.surface !== "outside" ||
    nestedParamReads !== 0 ||
    unknownNavigationCalls !== 0
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Local target-before-params ordering changed.");
  }
  expectDiagnostic(unknownTarget, "ENTRY_NOT_FOUND", "/surface", "Unknown navigation target");

  let reflectedSurfaceFixture;
  let reflectedSurfaceDisposals = 0;
  const reflectedSurfaceTarget = {
    type: "navigate",
    surface: "outside",
  };
  const reflectedSurfaceAction = new Proxy(reflectedSurfaceTarget, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "surface" && reflectedSurfaceDisposals === 0) {
        reflectedSurfaceDisposals += 1;
        api.disposeRuntimeStateNavigationActions(reflectedSurfaceFixture.handle);
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  reflectedSurfaceFixture = mountFixture(api);
  const reflectedSurface = executeAction(api, reflectedSurfaceFixture, reflectedSurfaceAction);
  if (
    reflectedSurface.status !== "disposed" ||
    reflectedSurfaceDisposals !== 1 ||
    api.readRuntimeSurfaceState(reflectedSurfaceFixture.state.handle).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Surface-reflection disposal was not terminal.");
  }

  let reflectedTypeFixture;
  let reflectedTypeDisposals = 0;
  const reflectedTypeTarget = {
    type: "state.set",
    path: "label",
    value: "must-not-write",
  };
  const reflectedTypeAction = new Proxy(reflectedTypeTarget, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "type" && reflectedTypeDisposals === 0) {
        reflectedTypeDisposals += 1;
        api.disposeRuntimeStateNavigationActions(reflectedTypeFixture.handle);
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  reflectedTypeFixture = mountFixture(api);
  const reflectedType = executeAction(api, reflectedTypeFixture, reflectedTypeAction);
  if (
    reflectedType.status !== "disposed" ||
    reflectedTypeDisposals !== 1 ||
    api.readRuntimeSurfaceState(reflectedTypeFixture.state.handle).status !== "disposed"
  ) {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Action-type reflection disposal was not terminal.",
    );
  }

  let knownHostileParamReads = 0;
  let knownHostileNavigationCalls = 0;
  const knownHostileFixture = mountFixture(api, {
    navigate() {
      knownHostileNavigationCalls += 1;
      return { status: "succeeded" };
    },
  });
  const knownHostileParamTarget = {};
  Object.defineProperty(knownHostileParamTarget, "secret", {
    enumerable: true,
    get() {
      knownHostileParamReads += 1;
      throw new Error("private known-target param getter");
    },
  });
  const knownHostileParams = new Proxy(knownHostileParamTarget, {});
  const knownHostile = executeAction(api, knownHostileFixture, {
    type: "navigate",
    surface: "next",
    params: knownHostileParams,
  });
  if (
    knownHostile.status !== "payload-rejected" ||
    knownHostile.reason !== "invalid" ||
    knownHostileParamReads !== 0 ||
    knownHostileNavigationCalls !== 0
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Known-target hostile parameter capture changed.");
  }
  assertFrozenResult(knownHostile, "Hostile parameter rejection");

  const navigationRequests = [];
  const navigationReceivers = [];
  const navigationTokenReceivers = [];
  let navigationTokenCalls = 0;
  const navigationDiagnosticReceivers = [];
  const navigationFixture = mountFixture(api, {
    navigate(request) {
      navigationReceivers.push(this);
      navigationRequests.push(request);
      return { status: "denied" };
    },
    resolveToken(request) {
      navigationTokenReceivers.push(this);
      navigationTokenCalls += 1;
      return { status: "resolved", value: request.token };
    },
    report() {
      navigationDiagnosticReceivers.push(this);
    },
  });
  const denied = executeAction(api, navigationFixture, {
    type: "navigate",
    surface: "next",
    params: {
      z: { $token: "shared.param" },
      a: { $token: "shared.param" },
    },
  });
  if (
    denied.status !== "navigation-denied" ||
    denied.requestId !== actionRequestId(0) ||
    denied.surface !== "next" ||
    navigationTokenCalls !== 1 ||
    navigationReceivers.length !== 1 ||
    navigationReceivers[0] !== undefined ||
    navigationTokenReceivers[0] !== undefined ||
    navigationDiagnosticReceivers.length !== 1 ||
    navigationDiagnosticReceivers[0] !== undefined ||
    navigationRequests.length !== 1
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Navigation request or receiver changed.");
  }
  expectDiagnostic(denied, "run.desen.runtime/NAVIGATION_DENIED", undefined, "Denied navigation");
  assertDataEqual(
    navigationRequests[0],
    {
      context: {
        documentId: "com.desen.proof",
        revision: `sha256:${"a".repeat(64)}`,
        surfaceId: "main",
        requestId: actionRequestId(0),
      },
      targetSurfaceId: "next",
      params: { a: "shared.param", z: "shared.param" },
    },
    "Detached sorted navigation request",
  );
  assertDeepFrozen(navigationRequests[0], "Navigation request");

  for (const [label, navigate] of [
    [
      "throw",
      () => {
        throw new Error("private thrown navigation error");
      },
    ],
    ["Promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "private-malformed" })],
  ]) {
    const adapterFixture = mountFixture(api, { navigate });
    const adapterFailed = executeAction(api, adapterFixture, {
      type: "navigate",
      surface: "next",
    });
    if (
      adapterFailed.status !== "adapter-failed" ||
      adapterFailed.requestId !== actionRequestId(0) ||
      JSON.stringify(adapterFailed).includes("private") ||
      api.readRuntimeSurfaceState(adapterFixture.state.handle).status !== "active"
    ) {
      fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} adapter containment changed.`);
    }
    expectDiagnostic(adapterFailed, "ADAPTER_FAILURE", undefined, `${label} adapter failure`);
  }

  let resultDisposalFixture;
  let resultDisposalReflections = 0;
  resultDisposalFixture = mountFixture(api, {
    navigate() {
      return new Proxy(
        { status: "succeeded" },
        {
          ownKeys(target) {
            if (resultDisposalReflections === 0) {
              resultDisposalReflections += 1;
              api.disposeRuntimeStateNavigationActions(resultDisposalFixture.handle);
            }
            return Reflect.ownKeys(target);
          },
        },
      );
    },
  });
  const disposedDuringResultCapture = executeAction(api, resultDisposalFixture, {
    type: "navigate",
    surface: "next",
  });
  if (
    disposedDuringResultCapture.status !== "disposed" ||
    resultDisposalReflections !== 1 ||
    api.readRuntimeSurfaceState(resultDisposalFixture.state.handle).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Navigation-result reflection disposal changed.");
  }

  let resultMutationFixture;
  let resultMutationReflections = 0;
  resultMutationFixture = mountFixture(api, {
    navigate() {
      return new Proxy(
        { status: "succeeded" },
        {
          ownKeys(target) {
            if (resultMutationReflections === 0) {
              resultMutationReflections += 1;
              api.writeRuntimeSurfaceState(resultMutationFixture.state.handle, {
                path: "label",
                value: "result-reflection-won",
              });
            }
            return Reflect.ownKeys(target);
          },
        },
      );
    },
  });
  const mutatedDuringResultCapture = executeAction(api, resultMutationFixture, {
    type: "navigate",
    surface: "next",
  });
  const resultMutationState = api.readRuntimeSurfaceState(resultMutationFixture.state.handle);
  if (
    mutatedDuringResultCapture.status !== "invalid-snapshot" ||
    resultMutationReflections !== 1 ||
    resultMutationState.status !== "active" ||
    resultMutationState.snapshot.values.label !== "result-reflection-won"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Navigation-result state revalidation changed.");
  }

  let navToctouCalls = 0;
  let navToctouFixture;
  navToctouFixture = mountFixture(api, {
    navigate() {
      navToctouCalls += 1;
      return { status: "succeeded" };
    },
    resolveToken() {
      api.writeRuntimeSurfaceState(navToctouFixture.state.handle, {
        path: "label",
        value: "token-before-navigation",
      });
      return { status: "resolved", value: "candidate" };
    },
  });
  const navToctou = executeAction(api, navToctouFixture, {
    type: "navigate",
    surface: "next",
    params: { from: { $token: "mutating" } },
  });
  if (
    navToctou.status !== "invalid-snapshot" ||
    navToctouCalls !== 0 ||
    api.readRuntimeSurfaceState(navToctouFixture.state.handle).snapshot.values.label !==
      "token-before-navigation"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Navigation TOCTOU protection changed.");
  }

  let hostReentry;
  let successFixture;
  successFixture = mountFixture(api, {
    navigate() {
      hostReentry = executeAction(api, successFixture, {
        type: "state.set",
        path: "label",
        value: "reentrant",
      });
      return { status: "succeeded" };
    },
  });
  const succeeded = executeAction(api, successFixture, {
    type: "navigate",
    surface: "main",
  });
  if (
    succeeded.status !== "navigated" ||
    succeeded.surface !== "main" ||
    succeeded.requestId !== actionRequestId(0) ||
    hostReentry?.status !== "busy" ||
    api.readRuntimeSurfaceState(successFixture.state.handle).status !== "disposed" ||
    executeAction(api, successFixture, {
      type: "state.set",
      path: "label",
      value: "late",
    }).status !== "disposed" ||
    api.disposeRuntimeStateNavigationActions(successFixture.handle).status !== "already-disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Terminal same-surface navigation changed.");
  }
  assertFrozenResult(succeeded, "Successful navigation");

  let disposingFixture;
  disposingFixture = mountFixture(api, {
    navigate() {
      api.disposeRuntimeStateNavigationActions(disposingFixture.handle);
      return { status: "succeeded" };
    },
  });
  const disposedDuringNavigation = executeAction(api, disposingFixture, {
    type: "navigate",
    surface: "next",
  });
  if (
    disposedDuringNavigation.status !== "disposed" ||
    api.readRuntimeSurfaceState(disposingFixture.state.handle).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Navigation-callback disposal changed.");
  }

  const staleFixture = mountFixture(api);
  const staleStateSnapshot = staleFixture.stateSnapshot;
  const staleResolution = staleFixture.resolutionSnapshot;
  const externalWrite = api.writeRuntimeSurfaceState(staleFixture.state.handle, {
    path: "label",
    value: "external",
  });
  if (externalWrite.status !== "updated") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Stale fixture write failed.");
  }
  const staleResult = api.executeRuntimeStateNavigationAction(
    staleFixture.handle,
    { type: "state.set", path: "label", value: "must-not-write" },
    staleResolution,
    staleStateSnapshot,
  );
  if (
    staleResult.status !== "invalid-snapshot" ||
    staleResult.stateSnapshot !== externalWrite.snapshot
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Stale exact state snapshot gained authority.");
  }
  const equalForgedSnapshot = Object.freeze({
    surfaceId: externalWrite.snapshot.surfaceId,
    generation: externalWrite.snapshot.generation,
    values: externalWrite.snapshot.values,
  });
  const forgedResult = api.executeRuntimeStateNavigationAction(
    staleFixture.handle,
    { type: "state.toggle", path: "enabled" },
    resolutionSnapshot(api, externalWrite.snapshot),
    equalForgedSnapshot,
  );
  if (forgedResult.status !== "invalid-snapshot") {
    fail(
      "STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Structurally equal forged state gained authority.",
    );
  }

  const mismatchFixture = mountFixture(api);
  const mismatchResolution = api.createRuntimeResolutionSnapshot({
    state: { count: 1, enabled: true, label: "before" },
    context: { route: { source: "proof" } },
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { locale: "tr-TR", platform: "web" },
  });
  const mismatch = api.executeRuntimeStateNavigationAction(
    mismatchFixture.handle,
    { type: "state.toggle", path: "enabled" },
    mismatchResolution,
    mismatchFixture.stateSnapshot,
  );
  if (mismatch.status !== "invalid-snapshot") {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Mismatched resolution state gained authority.");
  }

  const explicitFixture = mountFixture(api);
  const explicitDispose = api.disposeRuntimeStateNavigationActions(explicitFixture.handle);
  const repeatedDispose = api.disposeRuntimeStateNavigationActions(explicitFixture.handle);
  const invalidDispose = api.disposeRuntimeStateNavigationActions(Object.freeze({}));
  if (
    explicitDispose.status !== "disposed" ||
    repeatedDispose.status !== "already-disposed" ||
    invalidDispose.status !== "invalid-handle" ||
    api.readRuntimeSurfaceState(explicitFixture.state.handle).status !== "disposed" ||
    executeAction(api, explicitFixture, {
      type: "state.toggle",
      path: "enabled",
    }).status !== "disposed"
  ) {
    fail("STATE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Explicit terminal disposal changed.");
  }
  assertFrozenResult(explicitDispose, "Explicit disposal");
  assertFrozenResult(repeatedDispose, "Repeated disposal");
  assertFrozenResult(invalidDispose, "Invalid disposal");

  return Object.freeze({
    mountProbes: 10,
    guardFirstProbes: 18,
    tokenSessionProbes: 28,
    stateActionProbes: 10,
    navigationProbes: 27,
    toctouProbes: 12,
    reentrancyProbes: 14,
    snapshotIdentityProbes: 5,
    disposalProbes: 8,
    receiverIndependenceProbes: 3,
    hostilePayloadReads:
      falsePayloadReads +
      falseMutationPayloadReads +
      aggregateGuardPayloadReads +
      individualGuardPayloadReads +
      nestedParamReads +
      knownHostileParamReads,
    falseGuardDiagnosticCalls: falseDiagnosticCalls,
    platformEffects: 0,
    rawHostFailuresExposed: false,
  });
}

/**
 * Builds deterministic M04-T10 evidence from exact prerequisites, public distribution,
 * hostile runtime probes, tests, trace ownership, documentation, and task-owned bytes.
 */
export async function buildRuntimeCoreStateNavigationActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    tokenFormat,
    predicateEvaluation,
    localState,
    executionContracts,
    actionEvaluationSourceText,
    actionEvaluationDeclarationText,
    actionEvaluationBuiltJavaScript,
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
    tracked,
  ] = await Promise.all([
    verifyPrerequisite(TOKEN_FORMAT_PREREQUISITE, normalized.prerequisiteBytes?.tokenFormat),
    verifyPrerequisite(PREDICATE_PREREQUISITE, normalized.prerequisiteBytes?.predicateEvaluation),
    verifyPrerequisite(LOCAL_STATE_PREREQUISITE, normalized.prerequisiteBytes?.localState),
    verifyPrerequisite(
      EXECUTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.executionContracts,
    ),
    readWorkspaceText("packages/runtime-core/src/action-evaluation.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-evaluation.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-evaluation.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/state-navigation-actions.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/state-navigation-actions.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/state-navigation-actions.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/state-navigation-actions.test.ts", fileOverrides),
    readWorkspaceText(
      "packages/runtime-core/test/state-navigation-actions.types.ts",
      fileOverrides,
    ),
    readWorkspaceText("tests/runtime-core-state-navigation-actions.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-STATE-NAVIGATION-ACTIONS.md", fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimeManifestText);
    trace = JSON.parse(traceText);
  } catch {
    fail("STATE_ACTION_METADATA_INVALID", "Runtime package or trace metadata is not valid JSON.");
  }

  const publicApi = verifyPublicApi({
    sourceText,
    declarationText,
    builtJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const internalActionEvaluation = verifyInternalActionEvaluationApi({
    sourceText: actionEvaluationSourceText,
    declarationText: actionEvaluationDeclarationText,
    builtJavaScript: actionEvaluationBuiltJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const tests = verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest);
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation(findings, proofDocument);
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const runtime = await probeRuntimeBehavior(runtimeApi);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T10",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Exactly one guarded state or same-Bundle navigation action executes from exact current snapshots, through one detached token session, with post-callback TOCTOU checks and terminal navigation lifetime.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze([
      tokenFormat,
      predicateEvaluation,
      localState,
      executionContracts,
    ]),
    publicApi,
    internalActionEvaluation,
    runtime,
    semantics: Object.freeze({
      actionCardinality: "exactly one state.set, state.toggle, or navigate action",
      guardOrdering:
        "guard preparation and evaluation before discriminator and payload observation",
      falseGuard:
        "zero payload reads, payload-token calls, diagnostic callback reports, state writes, or navigation calls; guard-token drift cannot be returned as skipped",
      tokenSession:
        "one action-local detached cache shared by guard and payload; callbacks receiver-free",
      tokenAggregateOverflow:
        "guard-rejected or payload-rejected invalid runtime-safety outcome depending phase; never reclassified as ADAPTER_FAILURE",
      individualProviderUnsafe:
        "frozen M04-T03 ADAPTER_FAILURE classification for malformed or individually over-budget provider results",
      snapshotAuthority:
        "exact current T06 state snapshot identity plus equal factory-authenticated resolution state",
      callbackToctou:
        "exact state rechecked after token and diagnostic callbacks and immediately before effect",
      stateSet: "complete-schema T06 write with rejected candidates not consuming request identity",
      stateToggle: "only an exact JSON boolean may be inverted",
      navigationTarget: "existing surface in the active same-Bundle inventory before params",
      navigationParams:
        "canonical key order, one synthetic-array materialization, detached JSON reconstruction",
      navigationDenial: "run.desen.runtime/NAVIGATION_DENIED",
      navigationAdapterFailure: "redacted ADAPTER_FAILURE for throw, Promise, or malformed result",
      requestIdentity: "action: + RFC 8785 canonical [originSurfaceId, acceptedGeneration]",
      navigationSuccess:
        "terminal for old executor and T06 state, including same-surface navigation",
      explicitDisposal: "terminal and idempotent for executor and owned T06 state",
      retainedSnapshotProvenance:
        "state authority exact here; complete same-turn cross-manager provenance remains M04-T16",
      actionTurnManager: null,
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
        "docs/proof/RUNTIME-CORE-STATE-NAVIGATION-ACTIONS.md",
      ]),
    }),
    deferred: Object.freeze([
      "resource.refresh, operation.invoke, and later action kinds (M04-T11)",
      "multi-action turn ordering and settlement action dispatch (M04-T13)",
      "node/behavior bridge, reactive, and complete session disposal coordination (M04-T14–T16)",
      "reactive dependency discovery and reevaluation (M04-T15)",
      "complete same-turn cross-manager snapshot provenance and composition (M04-T16)",
      "adapter rendering and platform navigation implementations",
      "deep-link, history, persistence, and cross-Bundle navigation policy",
      "future protocol clarification of PF-040",
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
    fail("STATE_ACTION_ARTIFACT_MISSING", "M04-T10 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("STATE_ACTION_ARTIFACT_UNSAFE", "M04-T10 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T10 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreStateNavigationActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_STATE_NAVIGATION_ACTIONS_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreStateNavigationActionsEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("STATE_ACTION_ARTIFACT_DRIFT", "M04-T10 artifact differs from fresh evidence.", {
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
    ...expected.artifact.runtime,
  });
}

/** Atomically writes deterministic M04-T10 evidence after every proof check passes. */
export async function writeRuntimeCoreStateNavigationActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_STATE_NAVIGATION_ACTIONS_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreStateNavigationActionsEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreStateNavigationActionsEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
