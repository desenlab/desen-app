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
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

/** Absolute path to deterministic M04-T13 action-turn evidence. */
export const DEFAULT_RUNTIME_CORE_ACTION_TURNS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
);

const STATE_NAVIGATION_PREREQUISITE = Object.freeze({
  task: "M04-T10",
  path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
  artifact: "runtime-core-0.1.0-state-navigation-actions.json",
  sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
});
const OPERATION_RESOURCE_PREREQUISITE = Object.freeze({
  task: "M04-T11",
  path: "docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
  artifact: "runtime-core-0.1.0-operation-resource-actions.json",
  sha256: "b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7",
});
const COMMAND_EVENT_PREREQUISITE = Object.freeze({
  task: "M04-T12",
  path: "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
  artifact: "runtime-core-0.1.0-command-event-actions.json",
  sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
});

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_ACTION_TURN_LIMITS",
  "disposeRuntimeActionTurns",
  "executeRuntimeActionTurn",
  "mountRuntimeActionTurns",
  "prepareRuntimeActionProgram",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeActionTurnCompletion",
  "RuntimeActionTurnExecutionResult",
  "RuntimeActionTurnLimitProfile",
  "RuntimeActionTurnProgram",
  "RuntimeActionTurnProgramPreparationResult",
  "RuntimeActionTurnQueued",
  "RuntimeActionTurnRequest",
  "RuntimeActionTurnStarted",
  "RuntimeActionTurnStep",
  "RuntimeActionTurnTerminationReason",
  "RuntimeActionTurnsDisposeResult",
  "RuntimeActionTurnsHandle",
  "RuntimeActionTurnsMountInput",
  "RuntimeActionTurnsMountInvalidReason",
  "RuntimeActionTurnsMountResult",
  "RuntimeActionTurnsSnapshot",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-062",
    owners: Object.freeze(["M02-T09", "M04-T09", "M04-T13", "M04-T14"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-078",
    owners: Object.freeze(["M04-T09", "M04-T11", "M04-T13"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-081",
    owners: Object.freeze(["M04-T13"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-123",
    owners: Object.freeze(["M02-T13", "M04-T07", "M04-T13", "M07-T04"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-029",
    owners: Object.freeze(["M02-T05", "M04-T13"]),
  }),
]);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T13 action-turn evidence",
  "builds byte-identical action-turn evidence twice",
  "rejects stale or tampered action-turn evidence",
  "rejects stale M04-T10 prerequisite bytes",
  "rejects stale M04-T11 prerequisite bytes",
  "rejects stale M04-T12 prerequisite bytes",
  "detects prepared-program brand, inert-copy, and deep-freeze drift",
  "detects private route metadata and coordinator discriminator-read drift",
  "detects duplicate child delegation and cross-family dispatch drift",
  "detects source-order, skipped-continue, and failed-stop drift",
  "detects the exact 64/65 action boundary and core diagnostic drift",
  "detects the exact 16/17 settlement-depth and parent-depth drift",
  "detects repeated synchronous-transition ceiling drift",
  "detects reentrant FIFO and outer-turn completion-order drift",
  "detects shared queue reservation and retained-action/code-unit drift",
  "detects four fresh reads and current resolution-snapshot rebuild drift",
  "detects invalid-snapshot retry and duplicate-effect drift",
  "detects monotonic command-registry snapshot adoption drift",
  "detects navigation terminality and queued old-surface cancellation drift",
  "detects settlement branch, nonblocking, and event-scope fence drift",
  "detects empty-handler and successful-handler finalization drift",
  "detects failure, throw, limit, navigation, and disposal finalization drift",
  "detects staged same-alias promotion and finalization safe-point drift",
  "detects finite turn-generation and pending-settlement reservation drift",
  "detects hostile admission, reporting reentry, and completion-promise drift",
  "detects process initial-resolution and catch containment drift",
  "detects one-shot settlement-finalizer containment drift",
  "detects operation/resource settlement callback containment drift",
  "detects drain emergency-completion containment drift",
  "detects admission-time native completion resolution drift",
  "detects task-owned byte, trace, normative, and proof-document drift",
  "detects public export, TSDoc, internal non-leak, platform, focused-test, and compiler-negative inventory drift",
]);
const EXPECTED_COMPILER_NEGATIVE_CASES = 11;
const EXPECTED_FOCUSED_REGISTRATIONS = 35;
const EXPECTED_FOCUSED_CASES = 43;
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/action-turns.ts",
  "packages/runtime-core/test/action-turns.test.ts",
  "packages/runtime-core/test/action-turns.types.ts",
  "packages/runtime-core/dist/action-turns.js",
  "packages/runtime-core/dist/action-turns.js.map",
  "packages/runtime-core/dist/action-turns.d.ts",
  "packages/runtime-core/dist/action-turns.d.ts.map",
  "scripts/lib/runtime-core-action-turns-proof.mjs",
  "scripts/generate-runtime-core-action-turns-proof.mjs",
  "scripts/verify-runtime-core-action-turns.mjs",
  "tests/runtime-core-action-turns.test.mjs",
]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T13",
  "prepared",
  "WeakMap",
  "exactly one child",
  "64",
  "65",
  "16",
  "17",
  "FIFO",
  "ACTION_LIMIT_EXCEEDED",
  'event = { status: "unavailable" }',
  "never retried",
  "finally",
  "N-014",
  "N-032",
  "N-041",
  "M04-T16",
  "PF-043",
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

/** Stable failure used by deterministic M04-T13 evidence and hostile mutation tests. */
export class RuntimeCoreActionTurnsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreActionTurnsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreActionTurnsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    fail("ACTION_TURN_OPTIONS_INVALID", "M04-T13 evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? override : Buffer.from(String(override));
  }
  return readFile(path.join(WORKSPACE_ROOT, relativePath));
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

async function verifyPrerequisite(definition, injectedBytes) {
  if (typeof definition.sha256 !== "string") {
    fail(
      "ACTION_TURN_PREREQUISITE_PENDING",
      `${definition.task} prerequisite is awaiting its child-authority-read relock.`,
    );
  }
  const bytes =
    injectedBytes === undefined
      ? await readWorkspaceBytes(definition.path)
      : Buffer.from(injectedBytes);
  const actual = sha256(bytes);
  if (actual !== definition.sha256) {
    fail("ACTION_TURN_PREREQUISITE_DRIFT", `${definition.task} prerequisite bytes drifted.`, {
      task: definition.task,
      expected: definition.sha256,
      actual,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("ACTION_TURN_PREREQUISITE_DRIFT", `${definition.task} prerequisite is not JSON.`);
  }
  if (artifact.task !== definition.task || artifact.result !== "PASS") {
    fail("ACTION_TURN_PREREQUISITE_DRIFT", `${definition.task} prerequisite is not PASS.`);
  }
  return Object.freeze({
    task: definition.task,
    result: "PASS",
    artifact: definition.artifact,
    artifactSha256: actual,
  });
}

function exactArray(actual, expected, code, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail(code, `${label} drifted.`, { expected, actual });
  }
}

function hasExportModifier(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function declarationName(node) {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name
  ) {
    return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration) => (ts.isIdentifier(declaration.name) ? declaration.name.text : undefined))
      .filter(Boolean);
  }
  return undefined;
}

function inspectModule(sourceText, fileName) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const runtimeExports = [];
  const typeExports = [];
  let tsdocDeclarations = 0;
  const imports = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    }
    if (!hasExportModifier(statement)) continue;
    const names = declarationName(statement);
    if (names === undefined) continue;
    const list = Array.isArray(names) ? names : [names];
    const typeOnly = ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
    (typeOnly ? typeExports : runtimeExports).push(...list);
    const comments = ts.getLeadingCommentRanges(sourceText, statement.getFullStart()) ?? [];
    if (comments.some(({ pos, end }) => sourceText.slice(pos, end).startsWith("/**"))) {
      tsdocDeclarations += list.length;
    }
  }

  return Object.freeze({
    runtimeExports: Object.freeze(runtimeExports.sort(compareText)),
    typeExports: Object.freeze(typeExports.sort(compareText)),
    tsdocDeclarations,
    imports: Object.freeze([...new Set(imports)].sort(compareText)),
    source,
  });
}

function inspectIndexExports(indexText) {
  const source = ts.createSourceFile("index.ts", indexText, ts.ScriptTarget.Latest, true);
  const runtimeExports = [];
  const typeExports = [];
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "./action-turns.js" ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }
    for (const element of statement.exportClause.elements) {
      (statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports).push(
        element.name.text,
      );
    }
  }
  return Object.freeze({
    runtimeExports: Object.freeze(runtimeExports.sort(compareText)),
    typeExports: Object.freeze(typeExports.sort(compareText)),
  });
}

function verifyNoPlatformIdentifiers(sourceText, fileName) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const forbidden = new Set(FORBIDDEN_RUNTIME_IDENTIFIERS);
  const found = new Set();
  function visit(node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) found.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (found.size > 0) {
    fail("ACTION_TURN_PLATFORM_BOUNDARY_DRIFT", "Action turns acquired a platform dependency.", {
      identifiers: [...found].sort(compareText),
    });
  }
}

function verifyApi(sourceText, indexText, declarationText, builtJavaScript, builtIndexText) {
  const module = inspectModule(sourceText, "action-turns.ts");
  const index = inspectIndexExports(indexText);
  exactArray(
    module.runtimeExports,
    [...EXPECTED_RUNTIME_EXPORTS].sort(compareText),
    "ACTION_TURN_EXPORT_DRIFT",
    "Action-turn module runtime exports",
  );
  exactArray(
    module.typeExports,
    [...EXPECTED_TYPE_EXPORTS].sort(compareText),
    "ACTION_TURN_EXPORT_DRIFT",
    "Action-turn module type exports",
  );
  exactArray(
    index.runtimeExports,
    [...EXPECTED_RUNTIME_EXPORTS].sort(compareText),
    "ACTION_TURN_INDEX_EXPORT_DRIFT",
    "Root runtime exports",
  );
  exactArray(
    index.typeExports,
    [...EXPECTED_TYPE_EXPORTS].sort(compareText),
    "ACTION_TURN_INDEX_EXPORT_DRIFT",
    "Root type exports",
  );
  for (const name of [...EXPECTED_RUNTIME_EXPORTS, ...EXPECTED_TYPE_EXPORTS]) {
    if (!declarationText.includes(name)) {
      fail("ACTION_TURN_DECLARATION_DRIFT", `Built declaration omits ${name}.`);
    }
  }
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    if (!builtJavaScript.includes(name) || !builtIndexText.includes(name)) {
      fail("ACTION_TURN_BUILD_EXPORT_DRIFT", `Built JavaScript omits ${name}.`);
    }
  }
  if (module.tsdocDeclarations !== EXPECTED_RUNTIME_EXPORTS.length + EXPECTED_TYPE_EXPORTS.length) {
    fail("ACTION_TURN_TSDOC_MISSING", "Every public action-turn declaration needs TSDoc.", {
      expected: EXPECTED_RUNTIME_EXPORTS.length + EXPECTED_TYPE_EXPORTS.length,
      actual: module.tsdocDeclarations,
    });
  }
  for (const internalName of [
    "readRuntimeOperationResourceActions",
    "readRuntimeStateNavigationActions",
    "finalizeRuntimeOperationActionSettlement",
  ]) {
    if (new RegExp(String.raw`\b${internalName}\b`, "u").test(indexText)) {
      fail("ACTION_TURN_INTERNAL_EXPORT_LEAK", `${internalName} leaked through the package root.`);
    }
  }
  verifyNoPlatformIdentifiers(sourceText, "action-turns.ts");
  return Object.freeze({
    runtimeExports: Object.freeze([...EXPECTED_RUNTIME_EXPORTS]),
    typeExports: Object.freeze([...EXPECTED_TYPE_EXPORTS]),
    tsdocDeclarations: module.tsdocDeclarations,
    sourceImports: module.imports,
    internalRuntimeExports: Object.freeze([]),
    internalTypeExports: Object.freeze([]),
  });
}

function normalizedSource(sourceText) {
  return ts
    .createSourceFile("action-turns.ts", sourceText, ts.ScriptTarget.Latest, true)
    .getFullText()
    .replace(/\s+/gu, " ");
}

function requireSourceText(sourceText, required, label) {
  if (!sourceText.includes(required)) {
    fail("ACTION_TURN_SOURCE_SEMANTIC_DRIFT", `${label} source invariant drifted.`, {
      required,
    });
  }
}

function requireSourceOrder(sourceText, ordered, label) {
  let cursor = -1;
  for (const fragment of ordered) {
    const next = sourceText.indexOf(fragment, cursor + 1);
    if (next < 0 || next <= cursor) {
      fail("ACTION_TURN_SOURCE_SEMANTIC_DRIFT", `${label} source order drifted.`, {
        fragment,
      });
    }
    cursor = next;
  }
}

function sourceNodes(root, predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return matches;
}

function namedFunction(source, name) {
  const matches = source.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body,
  );
  if (matches.length !== 1) {
    fail("ACTION_TURN_SOURCE_SEMANTIC_DRIFT", `${name} function ownership drifted.`, {
      expected: 1,
      actual: matches.length,
    });
  }
  return matches[0];
}

function calledName(node) {
  if (!ts.isCallExpression(node)) return undefined;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return undefined;
}

function namedCalls(root, name) {
  return sourceNodes(root, (node) => ts.isCallExpression(node) && calledName(node) === name);
}

function hasPropertyAccess(root, name) {
  return sourceNodes(root, (node) => ts.isPropertyAccessExpression(node) && node.name.text === name)
    .length;
}

function containsNode(outer, inner) {
  return outer.getStart() <= inner.getStart() && outer.end >= inner.end;
}

function enclosingGuardedTry(node, boundary) {
  for (let current = node.parent; current && current !== boundary; current = current.parent) {
    if (ts.isTryStatement(current) && current.catchClause && containsNode(current.tryBlock, node)) {
      return current;
    }
  }
  return undefined;
}

function hasStrictPropertyComparison(root, objectName, propertyName, literal) {
  return sourceNodes(root, (node) => {
    if (
      !ts.isBinaryExpression(node) ||
      node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken
    ) {
      return false;
    }
    const sides = [
      [node.left, node.right],
      [node.right, node.left],
    ];
    return sides.some(
      ([candidate, value]) =>
        ts.isPropertyAccessExpression(candidate) &&
        ts.isIdentifier(candidate.expression) &&
        candidate.expression.text === objectName &&
        candidate.name.text === propertyName &&
        ts.isStringLiteral(value) &&
        value.text === literal,
    );
  }).length;
}

function requireControlFlow(condition, label, details = undefined) {
  if (!condition) {
    fail("ACTION_TURN_SOURCE_SEMANTIC_DRIFT", `${label} control-flow invariant drifted.`, details);
  }
}

function verifyUnexpectedCompletionContainment(sourceText) {
  const source = ts.createSourceFile("action-turns.ts", sourceText, ts.ScriptTarget.Latest, true);
  const process = namedFunction(source, "processWorkItem");
  const processBody = process.body;
  const processCandidates = sourceNodes(
    processBody,
    (node) =>
      ts.isTryStatement(node) && namedCalls(node.tryBlock, "composeResolutionSnapshot").length > 0,
  );
  requireControlFlow(processCandidates.length === 1, "One processWorkItem resolution fence", {
    actual: processCandidates.length,
  });
  const processFence = processCandidates[0];
  requireControlFlow(
    processFence.catchClause !== undefined && processFence.finallyBlock !== undefined,
    "processWorkItem catch/finally containment",
  );

  const statementsBeforeFence = processBody.statements.filter(
    (statement) => statement.end <= processFence.getStart(),
  );
  requireControlFlow(
    statementsBeforeFence.every(
      (statement) => namedCalls(statement, "composeResolutionSnapshot").length === 0,
    ),
    "Initial resolution stays inside processWorkItem try",
  );
  const initialResolution = sourceNodes(
    processFence.tryBlock,
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "initialResolution" &&
      node.initializer !== undefined &&
      namedCalls(node.initializer, "composeResolutionSnapshot").length === 1,
  );
  requireControlFlow(initialResolution.length === 1, "Initial resolution assignment is try-owned", {
    actual: initialResolution.length,
  });

  requireControlFlow(
    namedCalls(processFence.catchClause, "disposeRuntimeActionTurns").length >= 1 &&
      hasStrictPropertyComparison(processFence.catchClause, "authority", "status", "live") >= 1,
    "processWorkItem unexpected-failure terminal containment",
  );

  const finalizerCalls = namedCalls(processFence.finallyBlock, "finalizeSettlementItem");
  requireControlFlow(
    finalizerCalls.length === 1,
    "Settlement finalizer remains singly finally-owned",
    { actual: finalizerCalls.length },
  );
  const finalizerCall = finalizerCalls[0];
  const settlementOwner = sourceNodes(
    processFence.finallyBlock,
    (node) =>
      ts.isIfStatement(node) &&
      hasStrictPropertyComparison(node.expression, "item", "origin", "settlement") === 1 &&
      containsNode(node.thenStatement, finalizerCall),
  );
  requireControlFlow(settlementOwner.length === 1, "Settlement-origin finalizer ownership", {
    actual: settlementOwner.length,
  });

  const finalResolutionCalls = namedCalls(processFence.finallyBlock, "composeResolutionSnapshot");
  requireControlFlow(
    finalResolutionCalls.length === 1 &&
      finalResolutionCalls[0].getStart() > finalizerCall.getStart(),
    "Settlement finalization precedes final-resolution refresh",
  );
  const finalDisposeCalls = namedCalls(processFence.finallyBlock, "disposeRuntimeActionTurns");
  requireControlFlow(
    finalDisposeCalls.length >= 2 &&
      finalDisposeCalls.some((call) => call.getStart() < finalizerCall.getStart()) &&
      finalDisposeCalls.every(
        (call) => enclosingGuardedTry(call, processFence.finallyBlock) !== undefined,
      ),
    "Finally-owned disposal is isolated from settlement finalization",
    { actual: finalDisposeCalls.length },
  );

  const attemptedFinalizations = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "ATTEMPTED_SETTLEMENT_FINALIZATION_TICKETS",
    );
  requireControlFlow(
    attemptedFinalizations.length === 1 &&
      attemptedFinalizations[0].initializer !== undefined &&
      ts.isNewExpression(attemptedFinalizations[0].initializer) &&
      ts.isIdentifier(attemptedFinalizations[0].initializer.expression) &&
      attemptedFinalizations[0].initializer.expression.text === "WeakSet",
    "Settlement finalization attempt authority",
  );

  const finalizationAttempt = namedFunction(source, "attemptSettlementTicketFinalization");
  const hasCalls = namedCalls(finalizationAttempt.body, "has");
  const addCalls = namedCalls(finalizationAttempt.body, "add");
  const lowerFinalizerCalls = namedCalls(
    finalizationAttempt.body,
    "finalizeRuntimeOperationActionSettlement",
  );
  requireControlFlow(
    hasCalls.length === 1 &&
      addCalls.length === 1 &&
      lowerFinalizerCalls.length === 1 &&
      hasCalls[0].getStart() < addCalls[0].getStart() &&
      addCalls[0].getStart() < lowerFinalizerCalls[0].getStart(),
    "One-shot settlement finalization guard order",
  );
  requireControlFlow(
    enclosingGuardedTry(lowerFinalizerCalls[0], finalizationAttempt.body) !== undefined,
    "Lower settlement finalizer throw containment",
  );
  requireControlFlow(
    namedCalls(source, "finalizeRuntimeOperationActionSettlement").length === 1,
    "Single lower settlement-finalizer authority",
  );

  const finalizer = namedFunction(source, "finalizeSettlementItem");
  requireControlFlow(
    namedCalls(finalizer.body, "attemptSettlementTicketFinalization").length === 1,
    "Queued settlement uses the one-shot ticket authority",
  );
  requireControlFlow(
    hasStrictPropertyComparison(finalizer.body, "finalized", "status", "finalized") === 1,
    "Successful settlement finalization snapshot adoption",
  );
  const detachedFinalizer = namedFunction(source, "finalizeDetachedSettlementDescriptor");
  requireControlFlow(
    namedCalls(detachedFinalizer.body, "attemptSettlementTicketFinalization").length === 1 &&
      namedCalls(detachedFinalizer.body, "finalizeRuntimeOperationActionSettlement").length === 0,
    "Early settlement finalization uses the one-shot ticket authority",
  );

  const operationFailure = namedFunction(source, "containOperationSettlementCallbackFailure");
  const operationFailureRelease = namedCalls(operationFailure.body, "releaseSettlementReservation");
  const operationFailureFinalize = namedCalls(
    operationFailure.body,
    "finalizeDetachedSettlementDescriptor",
  );
  const operationFailureContain = namedCalls(operationFailure.body, "containCoordinatorFailure");
  requireControlFlow(
    operationFailureRelease.length === 1 &&
      operationFailureFinalize.length === 1 &&
      operationFailureContain.length === 1 &&
      operationFailureRelease[0].getStart() < operationFailureFinalize[0].getStart() &&
      operationFailureFinalize[0].getStart() < operationFailureContain[0].getStart() &&
      hasPropertyAccess(operationFailure.body, "active") >= 1,
    "Operation settlement callback failure releases, finalizes, and contains in order",
  );

  function verifySettlementAttachment(functionName, observedCallName, containmentCallName, label) {
    const attachment = namedFunction(source, functionName);
    const thenCalls = namedCalls(attachment.body, "then");
    const chainedCatchCalls = namedCalls(attachment.body, "catch");
    requireControlFlow(
      thenCalls.length === 1 && chainedCatchCalls.length === 1,
      `${label} fulfillment/rejection Promise fence`,
      { thenCalls: thenCalls.length, catchCalls: chainedCatchCalls.length },
    );
    const thenCall = thenCalls[0];
    const chainedCatch = chainedCatchCalls[0];
    requireControlFlow(
      ts.isPropertyAccessExpression(chainedCatch.expression) &&
        containsNode(chainedCatch.expression.expression, thenCall),
      `${label} returned callback Promise is observed`,
    );
    requireControlFlow(
      thenCall.arguments.length === 2 &&
        (ts.isArrowFunction(thenCall.arguments[0]) ||
          ts.isFunctionExpression(thenCall.arguments[0])) &&
        (ts.isArrowFunction(thenCall.arguments[1]) ||
          ts.isFunctionExpression(thenCall.arguments[1])),
      `${label} has explicit fulfillment and rejection callbacks`,
    );
    const fulfillment = thenCall.arguments[0];
    const rejection = thenCall.arguments[1];
    const observedCalls = namedCalls(fulfillment, observedCallName);
    requireControlFlow(observedCalls.length === 1, `${label} fulfillment owns one observation`, {
      actual: observedCalls.length,
    });
    const fulfillmentFence = enclosingGuardedTry(observedCalls[0], fulfillment);
    requireControlFlow(
      fulfillmentFence !== undefined &&
        namedCalls(fulfillmentFence.catchClause, containmentCallName).length === 1,
      `${label} fulfillment callback throw containment`,
    );
    requireControlFlow(
      namedCalls(rejection, containmentCallName).length === 1,
      `${label} rejection callback throw containment`,
    );
    requireControlFlow(
      chainedCatch.arguments.length === 1 &&
        namedCalls(chainedCatch.arguments[0], containmentCallName).length === 1,
      `${label} callback-return Promise rejection containment`,
    );
    const outerFence = enclosingGuardedTry(thenCall, attachment.body);
    requireControlFlow(
      outerFence !== undefined &&
        namedCalls(outerFence.catchClause, containmentCallName).length === 1,
      `${label} thenable attachment throw containment`,
    );
    return Object.freeze({
      fulfillment: 1,
      rejection: 1,
      chainedRejection: 1,
      attachment: 1,
    });
  }

  const operationCallbackFences = verifySettlementAttachment(
    "attachOperationSettlement",
    "enqueueSettlementDescriptor",
    "containOperationSettlementCallbackFailure",
    "Operation settlement",
  );
  const resourceCallbackFences = verifySettlementAttachment(
    "attachResourceSettlement",
    "observeResourceSettlement",
    "containCoordinatorFailure",
    "Resource settlement",
  );

  const drain = namedFunction(source, "drainQueue");
  const processCalls = namedCalls(drain.body, "processWorkItem");
  requireControlFlow(processCalls.length === 1, "Single drain child processing", {
    actual: processCalls.length,
  });
  const drainFence = enclosingGuardedTry(processCalls[0], drain.body);
  requireControlFlow(
    drainFence !== undefined && drainFence.finallyBlock !== undefined,
    "drainQueue process catch/finally containment",
  );
  requireControlFlow(
    namedCalls(drainFence.catchClause, "finalizeSettlementItem").length === 1 &&
      namedCalls(drainFence.catchClause, "disposeRuntimeActionTurns").length === 1 &&
      hasPropertyAccess(drainFence.catchClause, "emergencyCompletion") >= 1,
    "drainQueue emergency catch",
  );
  requireControlFlow(
    namedCalls(drainFence.finallyBlock, "releaseQueuedItem").length === 1,
    "drainQueue active-item retention release",
  );
  const drainResolutions = namedCalls(drain.body, "resolve").filter(
    (call) => hasPropertyAccess(call, "emergencyCompletion") >= 1,
  );
  requireControlFlow(drainResolutions.length === 2, "drainQueue emergency completion resolution", {
    actual: drainResolutions.length,
  });
  const outerDrainFence = enclosingGuardedTry(drainFence, drain.body);
  requireControlFlow(
    outerDrainFence !== undefined &&
      outerDrainFence.finallyBlock !== undefined &&
      namedCalls(outerDrainFence.catchClause, "settleAbandonedQueue").length === 1 &&
      namedCalls(outerDrainFence.finallyBlock, "resolve").some(
        (call) => hasPropertyAccess(call, "emergencyCompletion") >= 1,
      ),
    "drainQueue outer queue-reclamation fence",
  );

  const emergency = namedFunction(source, "makeEmergencyEventCompletion");
  const emergencyReturns = sourceNodes(
    emergency.body,
    (node) =>
      ts.isReturnStatement(node) &&
      node.expression !== undefined &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === "Object" &&
      node.expression.expression.name.text === "freeze",
  );
  requireControlFlow(
    emergencyReturns.length === 1,
    "Admission-time emergency completion immutability",
    { actual: emergencyReturns.length },
  );

  const execute = namedFunction(source, "executeRuntimeActionTurn");
  const nativePromises = sourceNodes(
    execute.body,
    (node) =>
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Promise",
  );
  const emergencyCalls = namedCalls(execute.body, "makeEmergencyEventCompletion");
  const queueCalls = namedCalls(execute.body, "push").filter((call) => {
    const expression = call.expression;
    return (
      ts.isPropertyAccessExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      ts.isIdentifier(expression.expression.expression) &&
      expression.expression.expression.text === "authority" &&
      expression.expression.name.text === "queue"
    );
  });
  const drainCalls = namedCalls(execute.body, "drainQueue");
  requireControlFlow(
    nativePromises.length === 1 &&
      emergencyCalls.length === 1 &&
      queueCalls.length === 1 &&
      drainCalls.length === 1 &&
      nativePromises[0].getStart() < emergencyCalls[0].getStart() &&
      emergencyCalls[0].getStart() < queueCalls[0].getStart() &&
      queueCalls[0].getStart() < drainCalls[0].getStart(),
    "Native completion and emergency value are reserved before admission",
  );
  const admittedItems = sourceNodes(
    execute.body,
    (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === "item" &&
      ts.isCallExpression(node.right) &&
      ts.isPropertyAccessExpression(node.right.expression) &&
      ts.isIdentifier(node.right.expression.expression) &&
      node.right.expression.expression.text === "Object" &&
      node.right.expression.name.text === "freeze" &&
      node.right.arguments.some(
        (argument) =>
          ts.isObjectLiteralExpression(argument) &&
          ["completion", "emergencyCompletion", "resolve"].every((name) =>
            argument.properties.some(
              (property) =>
                (ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)) &&
                ((ts.isIdentifier(property.name) && property.name.text === name) ||
                  (ts.isStringLiteral(property.name) && property.name.text === name)),
            ),
          ),
      ),
  );
  requireControlFlow(
    admittedItems.length === 1,
    "Accepted event retains native and emergency completion authority",
    { actual: admittedItems.length },
  );

  const completionPaths = [
    drain,
    namedFunction(source, "resolveDisposedEventItem"),
    namedFunction(source, "terminateTransitionOverflow"),
    namedFunction(source, "settleAbandonedQueue"),
    namedFunction(source, "flushDeferredDisposedEvents"),
  ];
  requireControlFlow(
    completionPaths.every((owner) => namedCalls(owner.body, "resolve").length >= 1),
    "Every accepted-event terminal path resolves its native Promise",
  );

  return Object.freeze({
    unexpectedProcessContainment: "try/catch/finally",
    settlementFinalizationAttempt: "private WeakSet",
    settlementFinalizationOwner: "process finally",
    operationSettlementCallbackFences: Object.values(operationCallbackFences).length,
    resourceSettlementCallbackFences: Object.values(resourceCallbackFences).length,
    drainContainment: "catch plus admission emergency",
    acceptedCompletionResolutionPaths: completionPaths.length,
  });
}

function verifySourceInvariants(sourceText) {
  const normalized = normalizedSource(sourceText);
  for (const [fragment, label] of [
    ["const PROGRAM_AUTHORITIES = new WeakMap", "Private prepared-program authority"],
    ["const TURN_AUTHORITIES = new WeakMap", "Private coordinator authority"],
    ["const CLAIMED_STATE_ACTIONS = new WeakSet", "Exclusive T10 ownership"],
    ["const CLAIMED_OPERATION_RESOURCE_ACTIONS = new WeakSet", "Exclusive T11 ownership"],
    ["const CLAIMED_COMMAND_EVENT_ACTIONS = new WeakSet", "Exclusive T12 ownership"],
    ["readRuntimeStateNavigationActions", "Package-internal T10 authority read"],
    ["readRuntimeOperationResourceActions", "Package-internal T11 authority read"],
    ["readRuntimeCommandEventActions", "Public T12 authority read"],
    ["event: UNAVAILABLE_EVENT", "Settlement event-scope fence"],
    ["maxActionsPerTurn: 64", "Action ceiling"],
    ["maxSettlementDepth: 16", "Settlement-depth ceiling"],
    ["maxQueuedTurns: 64", "Shared FIFO ceiling"],
    ["maxSynchronousTurnTransitions: 64", "Synchronous transition ceiling"],
    ["maxTurnGeneration: Number.MAX_SAFE_INTEGER", "Finite turn-generation ceiling"],
    ["maxRetainedQueuedActions: 4_096", "Retained-action ceiling"],
    [
      "maxRetainedQueuedCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits",
      "Retained-code-unit ceiling",
    ],
  ]) {
    requireSourceText(normalized, fragment, label);
  }
  requireSourceOrder(
    normalized,
    [
      "const capturedCount = Math.min(length.value, RUNTIME_ACTION_TURN_LIMITS.maxActionsPerTurn);",
      "for (let index = 0; index < capturedCount; index += 1)",
      "const entry = ownDataValue(actions, String(index));",
      "const copied = snapshotRuntimeJsonValue(entry.value);",
      'const type = ownDataValue(copied, "type");',
      "route: routeForType(type.value)",
      "const program = Object.freeze({})",
      "PROGRAM_AUTHORITIES.set(program, authority);",
    ],
    "Bounded inert program preparation",
  );
  requireSourceOrder(
    normalized,
    [
      "const state = readRuntimeSurfaceState(captured.stateHandle);",
      "const stateActions = readRuntimeStateNavigationActions(captured.stateActionsHandle);",
      "const resource = readRuntimeSurfaceResources(captured.resourceHandle);",
      "const operation = readRuntimeSurfaceOperations(captured.operationHandle);",
      "const operationResourceActions = readRuntimeOperationResourceActions(",
      "const commandEvent = readRuntimeCommandEventActions(captured.commandEventActionsHandle);",
      "const recapturedState = readRuntimeSurfaceState(captured.stateHandle);",
      "const recapturedStateActions = readRuntimeStateNavigationActions(",
      "const recapturedResource = readRuntimeSurfaceResources(captured.resourceHandle);",
      "const recapturedOperation = readRuntimeSurfaceOperations(captured.operationHandle);",
      "const recapturedOperationResourceActions = readRuntimeOperationResourceActions(",
      "const recapturedCommandEvent = readRuntimeCommandEventActions(",
      "CLAIMED_STATE_ACTIONS.add(captured.stateActionsHandle);",
      "CLAIMED_OPERATION_RESOURCE_ACTIONS.add(captured.operationResourceActionsHandle);",
      "CLAIMED_COMMAND_EVENT_ACTIONS.add(captured.commandEventActionsHandle);",
      "TURN_AUTHORITIES.set(handle, authority);",
    ],
    "Atomic exact-child mount authentication",
  );
  requireSourceOrder(
    normalized,
    [
      "readRuntimeStateNavigationActions(authority.stateActionsHandle)",
      "const operationResourceActions = readRuntimeOperationResourceActions(",
      "readRuntimeCommandEventActions(authority.commandEventActionsHandle)",
      "readRuntimeSurfaceState(authority.stateHandle)",
      "readRuntimeSurfaceResources(authority.resourceHandle)",
      "readRuntimeSurfaceOperations(authority.operationHandle)",
    ],
    "Fresh four-manager and exact-child reads",
  );
  const unexpectedContainment = verifyUnexpectedCompletionContainment(sourceText);
  return Object.freeze({
    preparedProgramAuthority: "private WeakMap",
    coordinatorAuthority: "private WeakMap",
    childOwnership: "three private WeakSets",
    observedActionIndices: "0..63 only",
    routeAuthority: "detached private metadata",
    managerReads: 4,
    childAuthorityReads: 3,
    invalidSnapshotRetry: false,
    settlementFinalization: "finally",
    ...unexpectedContainment,
  });
}

function testTitles(sourceText, callName) {
  const pattern = new RegExp(
    String.raw`(?:^|\n)\s*${callName}\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')`,
    "gu",
  );
  return [...sourceText.matchAll(pattern)].map((match) => match[1] ?? match[2]);
}

function focusedTestInventory(sourceText) {
  const source = ts.createSourceFile(
    "action-turns.test.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const titles = [];
  let cases = 0;
  function visit(node) {
    if (!ts.isCallExpression(node) || node.arguments.length === 0) {
      ts.forEachChild(node, visit);
      return;
    }
    const title = node.arguments[0];
    if (!ts.isStringLiteral(title) && !ts.isNoSubstitutionTemplateLiteral(title)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "it" || node.expression.text === "test")
    ) {
      titles.push(title.text);
      cases += 1;
    } else if (
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "each" &&
      ts.isIdentifier(node.expression.expression.expression) &&
      (node.expression.expression.expression.text === "it" ||
        node.expression.expression.expression.text === "test")
    ) {
      const rows = node.expression.arguments[0];
      if (!ts.isArrayLiteralExpression(rows)) {
        fail("ACTION_TURN_TEST_INVENTORY_DRIFT", "Focused it.each rows must be a literal array.");
      }
      titles.push(title.text);
      cases += rows.elements.length;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (titles.length !== EXPECTED_FOCUSED_REGISTRATIONS || cases !== EXPECTED_FOCUSED_CASES) {
    fail("ACTION_TURN_TEST_INVENTORY_DRIFT", "Focused action-turn case inventory drifted.", {
      expectedRegistrations: EXPECTED_FOCUSED_REGISTRATIONS,
      actualRegistrations: titles.length,
      expectedCases: EXPECTED_FOCUSED_CASES,
      actualCases: cases,
    });
  }
  return Object.freeze({
    titles: Object.freeze(titles),
    registrations: titles.length,
    cases,
  });
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifestText) {
  let manifest;
  try {
    manifest = JSON.parse(runtimeManifestText);
  } catch {
    fail("ACTION_TURN_TEST_INVENTORY_DRIFT", "Runtime package manifest is not valid JSON.");
  }
  if (manifest.scripts?.["test:action-turns"] !== "vitest run test/action-turns.test.ts") {
    fail("ACTION_TURN_TEST_INVENTORY_DRIFT", "Focused package test script drifted.");
  }
  if (/\bit\.skip\s*\(|\btest\.skip\s*\(|\.skip\(/u.test(packageTests)) {
    fail("ACTION_TURN_TEST_INVENTORY_DRIFT", "Focused action-turn tests contain a skipped case.");
  }
  const focused = focusedTestInventory(packageTests);
  const rootTitles = testTitles(rootTests, "test");
  exactArray(
    rootTitles,
    EXPECTED_ROOT_TEST_TITLES,
    "ACTION_TURN_ROOT_TEST_INVENTORY_DRIFT",
    "Root mutation-test titles",
  );
  const compilerNegativeCases = (typeTests.match(/@ts-expect-error/gu) ?? []).length;
  if (
    compilerNegativeCases !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    typeTests.includes("@ts-ignore")
  ) {
    fail("ACTION_TURN_TYPE_TEST_DRIFT", "Compiler-negative inventory is absent or weakened.");
  }
  return Object.freeze({
    focusedTitles: focused.titles,
    focusedRegistrations: focused.registrations,
    focusedCases: focused.cases,
    compilerNegativeCases,
    rootTitles: Object.freeze(rootTitles),
  });
}

function verifyTrace(trace) {
  const results = [];
  for (const expected of EXPECTED_TRACE_RULES) {
    const entry = trace[expected.collection]?.find(({ id }) => id === expected.id);
    if (!entry || !isDeepStrictEqual(entry.owners, expected.owners)) {
      fail("ACTION_TURN_TRACE_DRIFT", `${expected.id} trace ownership drifted.`);
    }
    results.push(
      Object.freeze({
        id: entry.id,
        section: entry.section,
        owners: Object.freeze([...entry.owners]),
      }),
    );
  }
  return Object.freeze(results);
}

function verifyNormativeCoverage(normativeText) {
  const rows = Object.fromEntries(
    normativeText
      .split("\n")
      .filter((line) => /^\| N-(?:014|032|041) \|/u.test(line))
      .map((line) => {
        const cells = line.split("|").map((cell) => cell.trim());
        return [cells[1], { status: cells[5], text: line }];
      }),
  );
  if (
    rows["N-014"]?.status !== "PLANNED" ||
    rows["N-032"]?.status !== "TESTED" ||
    rows["N-041"]?.status !== "PLANNED"
  ) {
    fail("ACTION_TURN_NORMATIVE_DRIFT", "M04-T13 normative status boundaries drifted.", {
      rows,
    });
  }
  for (const id of ["N-014", "N-032", "N-041"]) {
    if (!rows[id]?.text.includes("M04-T13")) {
      fail("ACTION_TURN_NORMATIVE_DRIFT", `${id} omits M04-T13 evidence.`);
    }
  }
  return Object.freeze({
    tested: Object.freeze(["N-032"]),
    planned: Object.freeze(["N-014", "N-041"]),
  });
}

function verifyDocumentation(findings, proofDocument) {
  const heading =
    "## PF-043 — Action turns require deterministic admission, queueing, depth, and finalization ownership";
  if (!findings.includes(heading)) {
    fail("ACTION_TURN_DOCUMENTATION_DRIFT", "PF-043 finding is missing.");
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("ACTION_TURN_DOCUMENTATION_DRIFT", `Proof document omits ${required}.`);
    }
  }
  return Object.freeze({
    finding: "PF-043",
    findingStatus: "OPEN",
    relatedOpenFindings: Object.freeze([
      "PF-014",
      "PF-031",
      "PF-039",
      "PF-040",
      "PF-041",
      "PF-042",
    ]),
    proofDocument: "docs/proof/RUNTIME-CORE-ACTION-TURNS.md",
  });
}

async function trackedFiles(fileOverrides) {
  return Object.freeze(
    await Promise.all(
      TRACKED_PATHS.map(async (relativePath) => {
        const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
        return Object.freeze({
          path: relativePath,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }),
    ),
  );
}

function assertProbe(condition, message, details = undefined) {
  if (!condition) fail("ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT", message, details);
}

function assertProbeEqual(actual, expected, message) {
  assertProbe(isDeepStrictEqual(actual, expected), message, { expected, actual });
}

function assertDeepFrozen(value, label, seen = new WeakSet()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  if (value instanceof Promise) return;
  seen.add(value);
  assertProbe(Object.isFrozen(value), `${label} is not recursively frozen.`);
  for (const child of Object.values(value)) assertDeepFrozen(child, label, seen);
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

function prepareCatalog(validatorApi, catalogText) {
  let catalog;
  try {
    catalog = JSON.parse(catalogText);
  } catch {
    fail("ACTION_TURN_CATALOG_FIXTURE_DRIFT", "The frozen web Catalog fixture is invalid JSON.");
  }
  const validated = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  if (!validated.valid) {
    fail("ACTION_TURN_CATALOG_FIXTURE_DRIFT", "The frozen web Catalog no longer validates.");
  }
  return validated.value;
}

const PROBE_DOCUMENT_ID = "https://desen.app/proof/action-turns";
const PROBE_REVISION = `sha256:${"d".repeat(64)}`;
const PROBE_SURFACE_ID = "proof-surface";
const PROBE_NEXT_SURFACE_ID = "next-surface";
const PROBE_OPERATION_ID = "com.example.auth/signIn";
const PROBE_RESOURCE_ID = "com.example.stores/list";
const PROBE_COMPONENT_ID = "com.example.ui/TextField";
const PROBE_COMPONENT_NODE = "email-field";
const PROBE_HOST_EVENT = "proof.saved";
const PROBE_HOST_EVENT_CONTRACT = "proof.saved.v1";
const PROBE_OPERATION_INPUT = Object.freeze({
  email: "proof@example.com",
  password: "proof-password",
});

function proofOperationAction(overrides = {}) {
  return {
    type: "operation.invoke",
    operation: PROBE_OPERATION_ID,
    as: "signIn",
    input: PROBE_OPERATION_INPUT,
    ...overrides,
  };
}

function createProbeHostPorts(api, hooks = {}) {
  return api.createRuntimeHostPorts({
    navigation: {
      navigate: hooks.navigate ?? (() => ({ status: "succeeded" })),
    },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: {
          activeRevision: PROBE_REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: {
      invoke:
        hooks.invokeOperation ?? (() => ({ status: "succeeded", value: { userId: "proof-user" } })),
    },
    resources: {
      load:
        hooks.loadResource ?? (() => ({ status: "succeeded", value: { items: [], bounds: {} } })),
    },
    tokens: {
      resolve: hooks.resolveToken ?? (() => ({ status: "missing" })),
    },
    context: {
      getSnapshot: () => Object.freeze({ proof: true }),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: {
      report: hooks.report ?? (() => undefined),
    },
  });
}

function mountProbeChildren(api, catalogSet, hooks = {}, coordinatorLimits = undefined) {
  const hostPorts = createProbeHostPorts(api, hooks);
  const state = api.mountRuntimeSurfaceState({
    surfaceId: PROBE_SURFACE_ID,
    state: {
      count: {
        schema: { type: "integer", minimum: 0 },
        initial: 0,
      },
      enabled: {
        schema: { type: "boolean" },
        initial: false,
      },
      label: {
        schema: { type: "string", minLength: 1 },
        initial: "ready",
      },
    },
  });
  assertProbe(state.status === "mounted", "The state proof fixture did not mount.", state);
  const stateActions = api.mountRuntimeStateNavigationActions({
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    surfaceIds: [PROBE_SURFACE_ID, PROBE_NEXT_SURFACE_ID],
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    hostPorts,
  });
  assertProbe(
    stateActions.status === "mounted",
    "The state/navigation proof fixture did not mount.",
    stateActions,
  );
  const resources = api.mountRuntimeSurfaceResources({
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    resources: {
      stores: { use: PROBE_RESOURCE_ID, input: {}, policy: "manual" },
    },
    catalogSet,
    hostPorts,
  });
  assertProbe(
    resources.status === "mounted",
    "The resource proof fixture did not mount.",
    resources,
  );
  const operations = api.mountRuntimeSurfaceOperations({
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    aliases: { signIn: { operation: PROBE_OPERATION_ID } },
    catalogSet,
    hostPorts,
  });
  assertProbe(
    operations.status === "mounted",
    "The operation proof fixture did not mount.",
    operations,
  );
  const operationResourceActions = api.mountRuntimeOperationResourceActions({
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    operations: { signIn: { operation: PROBE_OPERATION_ID } },
    resourceHandle: resources.handle,
    resourceSnapshot: resources.snapshot,
    operationHandle: operations.handle,
    operationSnapshot: operations.snapshot,
    hostPorts,
  });
  assertProbe(
    operationResourceActions.status === "mounted",
    "The operation/resource action proof fixture did not mount.",
    operationResourceActions,
  );
  const commandEventPorts = api.createRuntimeCommandEventHostPorts({
    commands: {
      invoke: hooks.invokeCommand ?? (() => ({ status: "succeeded" })),
    },
    events: {
      validate: hooks.validateEvent ?? (() => ({ status: "valid" })),
      emit: hooks.emitEvent ?? (() => ({ status: "succeeded" })),
    },
  });
  const commandEventActions = api.mountRuntimeCommandEventActions({
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    staticComponents: { [PROBE_COMPONENT_NODE]: PROBE_COMPONENT_ID },
    hostEvents: { [PROBE_HOST_EVENT]: PROBE_HOST_EVENT_CONTRACT },
    catalogSet,
    hostPorts,
    commandEventPorts,
  });
  assertProbe(
    commandEventActions.status === "mounted",
    "The command/event action proof fixture did not mount.",
    commandEventActions,
  );
  return {
    hostPorts,
    state,
    stateActions,
    resources,
    operations,
    operationResourceActions,
    commandEventActions,
    commandEventSnapshot: commandEventActions.snapshot,
    coordinatorLimits,
  };
}

function coordinatorMountInput(fixture, overrides = {}) {
  return {
    documentId: PROBE_DOCUMENT_ID,
    revision: PROBE_REVISION,
    surfaceId: PROBE_SURFACE_ID,
    stateHandle: fixture.state.handle,
    stateSnapshot: fixture.state.snapshot,
    resourceHandle: fixture.resources.handle,
    resourceSnapshot: fixture.resources.snapshot,
    operationHandle: fixture.operations.handle,
    operationSnapshot: fixture.operations.snapshot,
    stateActionsHandle: fixture.stateActions.handle,
    operationResourceActionsHandle: fixture.operationResourceActions.handle,
    commandEventActionsHandle: fixture.commandEventActions.handle,
    commandEventSnapshot: fixture.commandEventSnapshot,
    hostPorts: fixture.hostPorts,
    ...(fixture.coordinatorLimits === undefined ? {} : { limits: fixture.coordinatorLimits }),
    ...overrides,
  };
}

function mustMountCoordinator(api, fixture, overrides = {}) {
  const mounted = api.mountRuntimeActionTurns(coordinatorMountInput(fixture, overrides));
  assertProbe(
    mounted.status === "mounted",
    "The action-turn coordinator proof fixture did not mount.",
    mounted,
  );
  return mounted;
}

function currentProbeResolution(api, fixture, event = { status: "available", value: null }) {
  const state = api.readRuntimeSurfaceState(fixture.state.handle);
  const resource = api.readRuntimeSurfaceResources(fixture.resources.handle);
  const operation = api.readRuntimeSurfaceOperations(fixture.operations.handle);
  assertProbe(
    state.status === "active" && resource.status === "read" && operation.status === "read",
    "The proof fixture lost a current manager snapshot.",
    { state, resource, operation },
  );
  return api.createRuntimeResolutionSnapshot({
    state: state.snapshot.values,
    context: { source: "M04-T13-proof" },
    resource: resource.snapshot.lifecycles,
    operation: operation.snapshot.lifecycles,
    event,
    item: {},
    env: { platform: "web" },
  });
}

function mustPrepare(api, actions) {
  const prepared = api.prepareRuntimeActionProgram(actions);
  assertProbe(prepared.status === "prepared", "A valid proof action program did not prepare.", {
    prepared,
  });
  return prepared;
}

async function runPrepared(api, mounted, prepared, snapshot) {
  const admitted = api.executeRuntimeActionTurn(mounted.handle, {
    program: prepared.program,
    snapshot,
  });
  assertProbe(
    admitted.status === "started" || admitted.status === "queued",
    "A valid proof action turn was not admitted.",
    admitted,
  );
  let completion;
  try {
    completion = await admitted.completion;
  } catch (error) {
    fail("ACTION_TURN_RUNTIME_BEHAVIOR_DRIFT", "An accepted completion Promise rejected.", {
      cause: String(error),
    });
  }
  assertProbe(
    completion.turnId === admitted.turnId &&
      completion.origin === "event" &&
      completion.settlementDepth === 0,
    "An accepted public event completion lost its turn identity, origin, or depth.",
    { admitted, completion },
  );
  assertDeepFrozen(completion, "Action-turn completion");
  return Object.freeze({ admitted, completion });
}

async function flushMicrotasks(rounds = 40) {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

async function probeRuntimeBehavior(runtimeApi, validatorApi, catalogText) {
  assertProbe(
    typeof runtimeApi.prepareRuntimeActionProgram === "function" &&
      typeof runtimeApi.mountRuntimeActionTurns === "function" &&
      typeof runtimeApi.executeRuntimeActionTurn === "function" &&
      typeof runtimeApi.disposeRuntimeActionTurns === "function",
    "The public action-turn runtime API is incomplete.",
  );
  const catalogSet = prepareCatalog(validatorApi, catalogText);
  let preparedProgramProbes = 0;
  let mountProbes = 0;
  let dispatchProbes = 0;
  let orderProbes = 0;
  let snapshotProbes = 0;
  let queueProbes = 0;
  let settlementProbes = 0;
  let finalizationProbes = 0;
  let limitProbes = 0;
  let disposalProbes = 0;
  let delegateCalls = 0;
  let duplicateEffects = 0;

  {
    let suffixReads = 0;
    const actions = Array.from({ length: 65 }, () => ({
      type: "state.toggle",
      path: "enabled",
    }));
    Object.defineProperty(actions, "64", {
      enumerable: true,
      configurable: true,
      get() {
        suffixReads += 1;
        throw new Error("index 64 must remain unobserved");
      },
    });
    const prepared = mustPrepare(runtimeApi, actions);
    assertProbeEqual(
      {
        status: prepared.status,
        actionCount: prepared.actionCount,
        overflow: prepared.overflow,
        suffixReads,
        programKeys: Reflect.ownKeys(prepared.program),
      },
      {
        status: "prepared",
        actionCount: 65,
        overflow: true,
        suffixReads: 0,
        programKeys: [],
      },
      "The exact 64/65 preparation boundary drifted.",
    );
    assertDeepFrozen(prepared, "Prepared-program result");
    assertProbe(
      runtimeApi.prepareRuntimeActionProgram(Object.freeze({})).status === "invalid",
      "A non-array program input was accepted.",
    );
    preparedProgramProbes += 5;
  }

  {
    const left = mountProbeChildren(runtimeApi, catalogSet);
    const right = mountProbeChildren(runtimeApi, catalogSet);
    const forgedState = runtimeApi.mountRuntimeActionTurns(
      coordinatorMountInput(left, { stateActionsHandle: Object.freeze({}) }),
    );
    const foreignState = runtimeApi.mountRuntimeActionTurns(
      coordinatorMountInput(left, { stateActionsHandle: right.stateActions.handle }),
    );
    const forgedOperation = runtimeApi.mountRuntimeActionTurns(
      coordinatorMountInput(left, {
        operationResourceActionsHandle: Object.freeze({}),
      }),
    );
    const foreignOperation = runtimeApi.mountRuntimeActionTurns(
      coordinatorMountInput(left, {
        operationResourceActionsHandle: right.operationResourceActions.handle,
      }),
    );
    assertProbe(
      forgedState.status === "invalid" &&
        forgedState.reason === "invalid-state-authority" &&
        foreignState.status === "invalid" &&
        foreignState.reason === "invalid-state-authority" &&
        forgedOperation.status === "invalid" &&
        forgedOperation.reason === "invalid-operation-authority" &&
        foreignOperation.status === "invalid" &&
        foreignOperation.reason === "invalid-operation-authority",
      "Forged or foreign T10/T11 child authority passed atomic mount authentication.",
      { forgedState, foreignState, forgedOperation, foreignOperation },
    );
    const mounted = mustMountCoordinator(runtimeApi, left);
    assertProbe(
      runtimeApi.mountRuntimeActionTurns(coordinatorMountInput(left)).status === "invalid",
      "Already surrendered child authorities were claimed twice.",
    );
    assertDeepFrozen(mounted, "Coordinator mount result");
    mountProbes += 7;
  }

  {
    const counters = { command: 0, event: 0, navigation: 0 };
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeCommand() {
        counters.command += 1;
        return { status: "succeeded" };
      },
      emitEvent() {
        counters.event += 1;
        return { status: "succeeded" };
      },
      navigate() {
        counters.navigation += 1;
        return { status: "succeeded" };
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const originalAction = { type: "state.toggle", path: "enabled" };
    const detached = mustPrepare(runtimeApi, [originalAction]);
    Object.defineProperty(originalAction, "type", {
      configurable: true,
      get() {
        throw new Error("the coordinator must never re-read the caller action");
      },
    });
    const detachedRun = await runPrepared(
      runtimeApi,
      mounted,
      detached,
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      detachedRun.completion.status === "completed" &&
        detachedRun.completion.steps.length === 1 &&
        detachedRun.completion.steps[0].route === "state-navigation" &&
        detachedRun.completion.steps[0].result.status === "state-updated",
      "Detached private routing or single-child state dispatch drifted.",
      detachedRun.completion,
    );
    const mixed = mustPrepare(runtimeApi, [
      {
        type: "state.toggle",
        path: "enabled",
        when: { op: "eq", args: [false, true] },
      },
      { type: "state.toggle", path: "enabled" },
      { type: "event.emit", name: PROBE_HOST_EVENT },
      { type: "proof.unknown" },
      { type: "event.emit", name: PROBE_HOST_EVENT },
    ]);
    const mixedRun = await runPrepared(
      runtimeApi,
      mounted,
      mixed,
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      mixedRun.completion.status === "terminated" &&
        mixedRun.completion.reason === "action-failed" &&
        mixedRun.completion.steps.length === 4 &&
        mixedRun.completion.steps[0].result.status === "skipped" &&
        mixedRun.completion.steps[1].result.status === "state-updated" &&
        mixedRun.completion.steps[2].result.status === "event-emitted" &&
        mixedRun.completion.steps[3].route === "unknown" &&
        counters.event === 1 &&
        counters.command === 0 &&
        counters.navigation === 0,
      "Source order, skipped continuation, failed stop, or exact route dispatch drifted.",
      { completion: mixedRun.completion, counters },
    );
    delegateCalls += detachedRun.completion.steps.length + mixedRun.completion.steps.length;
    dispatchProbes += 7;
    orderProbes += 5;
  }

  {
    let commandCalls = 0;
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeCommand() {
        commandCalls += 1;
        return { status: "succeeded" };
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const command = mustPrepare(runtimeApi, [
      { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
    ]);
    const requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    const missing = await runPrepared(runtimeApi, mounted, command, requestSnapshot);
    assertProbe(
      missing.completion.status === "terminated" &&
        missing.completion.reason === "action-failed" &&
        missing.completion.steps[0]?.result.status === "command-target-unavailable" &&
        commandCalls === 0,
      "The unregistered command admission did not fail closed exactly once.",
      missing.completion,
    );
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "proof-field-1",
        snapshot: missing.completion.snapshot.commandEventSnapshot,
      },
    );
    assertProbe(
      registration.status === "registered",
      "The proof command target did not register between admissions.",
      registration,
    );
    const visible = await runPrepared(runtimeApi, mounted, command, requestSnapshot);
    assertProbe(
      visible.completion.status === "completed" &&
        visible.completion.steps[0]?.result.status === "command-succeeded" &&
        visible.completion.steps[0]?.result.runtimeInstanceId === "proof-field-1" &&
        visible.completion.snapshot.commandEventSnapshot === registration.snapshot &&
        commandCalls === 1,
      "The first command in the next admission did not adopt the new registry snapshot.",
      { completion: visible.completion, registration, commandCalls },
    );
    const staleRequest = requestSnapshot;
    const stateProgram = mustPrepare(runtimeApi, [
      { type: "state.toggle", path: "enabled" },
      { type: "state.toggle", path: "enabled" },
    ]);
    const rebuilt = await runPrepared(runtimeApi, mounted, stateProgram, staleRequest);
    assertProbe(
      rebuilt.completion.status === "completed" &&
        rebuilt.completion.steps.every(
          (step) =>
            step.result.status === "state-updated" || step.result.status === "state-unchanged",
        ),
      "Current four-manager state was not rebuilt for each action slot.",
      rebuilt.completion,
    );
    snapshotProbes += 8;
    dispatchProbes += 2;
    delegateCalls += missing.completion.steps.length + visible.completion.steps.length + 2;
  }

  {
    const diagnostics = [];
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      report(value) {
        diagnostics.push(value);
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const actions = Array.from({ length: 65 }, () => ({
      type: "state.toggle",
      path: "enabled",
    }));
    const limited = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, actions),
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      limited.completion.status === "terminated" &&
        limited.completion.reason === "action-limit" &&
        limited.completion.steps.length === 64 &&
        limited.completion.diagnostics.some((item) => item.code === "ACTION_LIMIT_EXCEEDED") &&
        diagnostics.some((item) => item.code === "ACTION_LIMIT_EXCEEDED"),
      "The 65-entry turn did not execute exactly 64 entries before the core diagnostic.",
      { completion: limited.completion, diagnostics },
    );
    limitProbes += 4;
    delegateCalls += 64;
  }

  {
    let fixture;
    let tokenCalls = 0;
    let eventCalls = 0;
    fixture = mountProbeChildren(runtimeApi, catalogSet, {
      resolveToken() {
        tokenCalls += 1;
        const written = runtimeApi.writeRuntimeSurfaceState(fixture.state.handle, {
          path: "count",
          value: 7,
        });
        assertProbe(
          written.status === "updated",
          "The invalid-snapshot probe could not advance lower state.",
          written,
        );
        return { status: "resolved", value: "must-not-commit" };
      },
      emitEvent() {
        eventCalls += 1;
        return { status: "succeeded" };
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const raced = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "state.set", path: "label", value: { $token: "racing-token" } },
        { type: "event.emit", name: PROBE_HOST_EVENT },
      ]),
      currentProbeResolution(runtimeApi, fixture),
    );
    const current = runtimeApi.readRuntimeSurfaceState(fixture.state.handle);
    assertProbe(
      raced.completion.status === "terminated" &&
        raced.completion.reason === "invalid-snapshot" &&
        raced.completion.steps.length === 1 &&
        raced.completion.steps[0].result.status === "invalid-snapshot" &&
        current.status === "active" &&
        current.snapshot.values.count === 7 &&
        current.snapshot.values.label === "ready" &&
        raced.completion.snapshot.stateSnapshot === current.snapshot &&
        tokenCalls === 1 &&
        eventCalls === 0,
      "An invalid child snapshot was retried, duplicated, or failed to adopt the newest snapshot.",
      { completion: raced.completion, current, tokenCalls, eventCalls },
    );
    snapshotProbes += 7;
    delegateCalls += 1;
    duplicateEffects += Math.max(0, tokenCalls - 1) + eventCalls;
  }

  {
    let mounted;
    let queuedProgram;
    let requestSnapshot;
    let insideCommand = false;
    const queuedAdmissions = [];
    const eventOrder = [];
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeCommand() {
        insideCommand = true;
        for (let index = 0; index < 3; index += 1) {
          const admission = runtimeApi.executeRuntimeActionTurn(mounted.handle, {
            program: queuedProgram.program,
            snapshot: requestSnapshot,
          });
          queuedAdmissions.push(admission);
        }
        insideCommand = false;
        return { status: "succeeded" };
      },
      emitEvent(request) {
        assertProbe(!insideCommand, "A queued turn executed recursively inside the command host.");
        eventOrder.push(request.context.requestId);
        return { status: "succeeded" };
      },
    });
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "fifo-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The FIFO target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    queuedProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    const outerProgram = mustPrepare(runtimeApi, [
      { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
    ]);
    const outer = await runPrepared(runtimeApi, mounted, outerProgram, requestSnapshot);
    const queuedCompletions = await Promise.all(
      queuedAdmissions.map((admission) => admission.completion),
    );
    assertProbe(
      outer.admitted.status === "started" &&
        outer.completion.status === "completed" &&
        queuedAdmissions.length === 3 &&
        queuedAdmissions.every(
          (admission, index) => admission.status === "queued" && admission.position === index + 1,
        ) &&
        queuedCompletions.every((completion) => completion.status === "completed") &&
        eventOrder.length === 3 &&
        queuedCompletions.every(
          (completion, index) =>
            completion.steps[0]?.result.status === "event-emitted" &&
            eventOrder[index] === completion.steps[0].result.requestId,
        ),
      "Reentrant event turns lost shared FIFO order or outer-turn completion semantics.",
      { outer, queuedAdmissions, queuedCompletions, eventOrder },
    );
    queueProbes += 10;
    orderProbes += 4;
    delegateCalls += 4;
  }

  {
    let mounted;
    let queuedProgram;
    let requestSnapshot;
    const admissions = [];
    const fixture = mountProbeChildren(
      runtimeApi,
      catalogSet,
      {
        invokeCommand() {
          for (let index = 0; index < 3; index += 1) {
            admissions.push(
              runtimeApi.executeRuntimeActionTurn(mounted.handle, {
                program: queuedProgram.program,
                snapshot: requestSnapshot,
              }),
            );
          }
          return { status: "succeeded" };
        },
      },
      { maxQueuedTurns: 2 },
    );
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "bounded-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The queue-limit target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    queuedProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
      ]),
      requestSnapshot,
    );
    assertProbe(
      admissions.length === 3 &&
        admissions[0].status === "queued" &&
        admissions[1].status === "queued" &&
        admissions[2].status === "rejected" &&
        admissions[2].reason === "queue-limit",
      "The exact shared FIFO queue boundary drifted.",
      admissions,
    );
    await Promise.all(
      admissions
        .filter((admission) => admission.status === "queued")
        .map((admission) => admission.completion),
    );
    queueProbes += 4;
    limitProbes += 2;
  }

  {
    let mounted;
    let queuedProgram;
    let requestSnapshot;
    const admissions = [];
    const fixture = mountProbeChildren(
      runtimeApi,
      catalogSet,
      {
        invokeCommand() {
          for (let index = 0; index < 2; index += 1) {
            admissions.push(
              runtimeApi.executeRuntimeActionTurn(mounted.handle, {
                program: queuedProgram.program,
                snapshot: requestSnapshot,
              }),
            );
          }
          return { status: "succeeded" };
        },
      },
      { maxRetainedQueuedActions: 1 },
    );
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "retained-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The retention target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    queuedProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
      ]),
      requestSnapshot,
    );
    assertProbe(
      admissions[0]?.status === "rejected" &&
        admissions[0]?.reason === "retained-limit" &&
        admissions[1]?.status === "rejected" &&
        admissions[1]?.reason === "retained-limit",
      "Reentrant admission borrowed the one-action budget still retained by active work.",
      admissions,
    );
    queueProbes += 2;
    limitProbes += 1;
  }

  {
    let mounted;
    let queuedProgram;
    let requestSnapshot;
    const admissions = [];
    const fixture = mountProbeChildren(
      runtimeApi,
      catalogSet,
      {
        invokeCommand() {
          for (let index = 0; index < 3; index += 1) {
            admissions.push(
              runtimeApi.executeRuntimeActionTurn(mounted.handle, {
                program: queuedProgram.program,
                snapshot: requestSnapshot,
              }),
            );
          }
          return { status: "succeeded" };
        },
      },
      { maxQueuedTurns: 4, maxSynchronousTurnTransitions: 2 },
    );
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "transition-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The transition target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    queuedProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    const outer = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
      ]),
      requestSnapshot,
    );
    const completions = await Promise.all(admissions.map((admission) => admission.completion));
    assertProbe(
      outer.completion.status === "completed" &&
        admissions.every((admission) => admission.status === "queued") &&
        completions[0].status === "completed" &&
        completions[1].status === "terminated" &&
        completions[1].reason === "transition-limit" &&
        completions[2].status === "terminated" &&
        completions[2].reason === "transition-limit",
      "The repeated synchronous-transition ceiling did not terminate the FIFO suffix.",
      { outer, admissions, completions },
    );
    queueProbes += 4;
    limitProbes += 3;
  }

  {
    let mounted;
    let oversizedProgram;
    let requestSnapshot;
    let retainedAdmission;
    const fixture = mountProbeChildren(
      runtimeApi,
      catalogSet,
      {
        invokeCommand() {
          retainedAdmission = runtimeApi.executeRuntimeActionTurn(mounted.handle, {
            program: oversizedProgram.program,
            snapshot: requestSnapshot,
          });
          return { status: "succeeded" };
        },
      },
      { maxRetainedQueuedCodeUnits: 83 },
    );
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "code-unit-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The code-unit target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    oversizedProgram = mustPrepare(runtimeApi, [
      { type: "event.emit", name: PROBE_HOST_EVENT },
      { type: "event.emit", name: PROBE_HOST_EVENT },
    ]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
      ]),
      requestSnapshot,
    );
    assertProbe(
      retainedAdmission?.status === "rejected" && retainedAdmission.reason === "retained-limit",
      "The exact retained canonical-code-unit budget did not reject before FIFO retention.",
      retainedAdmission,
    );
    queueProbes += 1;
    limitProbes += 1;
  }

  {
    const settlement = deferred();
    let operationCalls = 0;
    const fixture = mountProbeChildren(
      runtimeApi,
      catalogSet,
      {
        invokeOperation() {
          operationCalls += 1;
          return settlement.promise;
        },
      },
      { maxQueuedTurns: 1 },
    );
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const capacity = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        proofOperationAction({ onSuccess: [] }),
        proofOperationAction({ onSuccess: [] }),
      ]),
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      capacity.completion.status === "terminated" &&
        capacity.completion.reason === "action-limit" &&
        capacity.completion.steps.length === 1 &&
        capacity.completion.steps[0].result.status === "operation-started" &&
        operationCalls === 1,
      "A second operation effect crossed before non-droppable settlement capacity was reserved.",
      { completion: capacity.completion, operationCalls },
    );
    const disposed = runtimeApi.disposeRuntimeActionTurns(mounted.handle);
    settlement.resolve({
      status: "succeeded",
      value: { userId: "late-capacity-user" },
    });
    await flushMicrotasks();
    assertProbe(
      disposed.status === "disposed" && disposed.disposedInvocations === 1,
      "Reserved-capacity disposal did not contain the pending operation.",
      disposed,
    );
    settlementProbes += 3;
    finalizationProbes += 1;
    limitProbes += 2;
    disposalProbes += 1;
    queueProbes += 1;
    delegateCalls += 1;
  }

  {
    const settlements = [deferred(), deferred()];
    let operationCalls = 0;
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation() {
        const settlement = settlements[operationCalls];
        operationCalls += 1;
        return settlement.promise;
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    const emptyHandler = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [proofOperationAction({ onSuccess: [] })]),
      currentProbeResolution(runtimeApi, fixture),
    );
    let currentState = runtimeApi.readRuntimeSurfaceState(fixture.state.handle);
    assertProbe(
      emptyHandler.completion.status === "completed" &&
        emptyHandler.completion.steps[0]?.result.status === "operation-started" &&
        operationCalls === 1 &&
        currentState.status === "active" &&
        currentState.snapshot.values.enabled === false,
      "The originating operation turn blocked on its settlement or ran an empty handler.",
      { completion: emptyHandler.completion, operationCalls, currentState },
    );
    settlements[0].resolve({
      status: "succeeded",
      value: { userId: "proof-user" },
    });
    await flushMicrotasks();
    const successfulHandler = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        proofOperationAction({
          onSuccess: [{ type: "state.toggle", path: "enabled" }],
        }),
      ]),
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      successfulHandler.completion.steps[0]?.result.status === "operation-started" &&
        operationCalls === 2,
      "Empty-handler finalization did not release the exact alias safe point.",
      { completion: successfulHandler.completion, operationCalls },
    );
    settlements[1].resolve({
      status: "succeeded",
      value: { userId: "proof-user" },
    });
    await flushMicrotasks();
    currentState = runtimeApi.readRuntimeSurfaceState(fixture.state.handle);
    assertProbe(
      currentState.status === "active" && currentState.snapshot.values.enabled === true,
      "The successful settlement branch did not execute and finalize exactly once.",
      currentState,
    );
    settlementProbes += 5;
    finalizationProbes += 2;
    delegateCalls += 3;
  }

  {
    const settlement = deferred();
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation: () => settlement.promise,
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        proofOperationAction({
          onFailure: [{ type: "state.toggle", path: "enabled" }],
        }),
      ]),
      currentProbeResolution(runtimeApi, fixture),
    );
    settlement.resolve({ status: "failed", errorCode: "invalidCredentials" });
    await flushMicrotasks();
    const current = runtimeApi.readRuntimeSurfaceState(fixture.state.handle);
    assertProbe(
      current.status === "active" && current.snapshot.values.enabled === true,
      "The failure settlement branch did not execute or finalize.",
      current,
    );
    settlementProbes += 2;
    finalizationProbes += 1;
    delegateCalls += 2;
  }

  {
    const settlement = deferred();
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation: () => settlement.promise,
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        proofOperationAction({
          onSuccess: [
            {
              type: "state.set",
              path: "enabled",
              value: { $ref: "event.secret" },
            },
          ],
        }),
      ]),
      currentProbeResolution(runtimeApi, fixture, {
        status: "available",
        value: { secret: true },
      }),
    );
    settlement.resolve({
      status: "succeeded",
      value: { userId: "proof-user" },
    });
    await flushMicrotasks();
    const current = runtimeApi.readRuntimeSurfaceState(fixture.state.handle);
    assertProbe(
      current.status === "active" && current.snapshot.values.enabled === false,
      "Settlement work inherited the parent event payload instead of an unavailable event scope.",
      current,
    );
    settlementProbes += 2;
    finalizationProbes += 1;
    delegateCalls += 2;
  }

  {
    let operationCalls = 0;
    const diagnostics = [];
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation() {
        operationCalls += 1;
        return Promise.resolve({
          status: "succeeded",
          value: { userId: `proof-user-${operationCalls}` },
        });
      },
      report(value) {
        diagnostics.push(value);
      },
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    let nested = proofOperationAction({ onSuccess: [] });
    for (let index = 1; index < 17; index += 1) {
      nested = proofOperationAction({ onSuccess: [nested] });
    }
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [nested]),
      currentProbeResolution(runtimeApi, fixture),
    );
    await flushMicrotasks(300);
    assertProbe(
      operationCalls === 16 && diagnostics.some((item) => item.code === "ACTION_LIMIT_EXCEEDED"),
      "The exact 16/17 settlement-depth boundary accepted the seventeenth effect.",
      { operationCalls, diagnostics },
    );
    const afterDepth = await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [proofOperationAction({ onSuccess: [] })]),
      currentProbeResolution(runtimeApi, fixture),
    );
    assertProbe(
      afterDepth.completion.steps[0]?.result.status === "operation-started" &&
        operationCalls === 17,
      "Depth-limit settlement finalization did not release the alias for the next event turn.",
      { completion: afterDepth.completion, operationCalls },
    );
    await flushMicrotasks();
    settlementProbes += 18;
    finalizationProbes += 17;
    limitProbes += 2;
    delegateCalls += 17;
  }

  {
    let mounted;
    let navigationProgram;
    let oldSurfaceProgram;
    let requestSnapshot;
    let navigationAdmission;
    let oldSurfaceAdmission;
    const completionOrder = [];
    let emitted = 0;
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeCommand() {
        navigationAdmission = runtimeApi.executeRuntimeActionTurn(mounted.handle, {
          program: navigationProgram.program,
          snapshot: requestSnapshot,
        });
        if (navigationAdmission.status === "queued") {
          void navigationAdmission.completion.then(() => {
            completionOrder.push("active-navigation");
          });
        }
        return { status: "succeeded" };
      },
      navigate() {
        oldSurfaceAdmission = runtimeApi.executeRuntimeActionTurn(mounted.handle, {
          program: oldSurfaceProgram.program,
          snapshot: requestSnapshot,
        });
        if (oldSurfaceAdmission.status === "queued") {
          void oldSurfaceAdmission.completion.then(() => {
            completionOrder.push("queued-disposed");
          });
        }
        return { status: "succeeded" };
      },
      emitEvent() {
        emitted += 1;
        return { status: "succeeded" };
      },
    });
    const registration = runtimeApi.registerRuntimeComponentCommandTarget(
      fixture.commandEventActions.handle,
      {
        sourceNodeId: PROBE_COMPONENT_NODE,
        capabilityId: PROBE_COMPONENT_ID,
        runtimeInstanceId: "navigation-field",
        snapshot: fixture.commandEventSnapshot,
      },
    );
    assertProbe(registration.status === "registered", "The navigation target did not register.");
    fixture.commandEventSnapshot = registration.snapshot;
    mounted = mustMountCoordinator(runtimeApi, fixture);
    navigationProgram = mustPrepare(runtimeApi, [
      { type: "navigate", surface: PROBE_NEXT_SURFACE_ID },
    ]);
    oldSurfaceProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    requestSnapshot = currentProbeResolution(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        { type: "component.command", target: PROBE_COMPONENT_NODE, command: "focus" },
      ]),
      requestSnapshot,
    );
    await flushMicrotasks();
    assertProbe(
      navigationAdmission?.status === "queued" && oldSurfaceAdmission?.status === "queued",
      "The navigation ordering probe did not admit both FIFO work items.",
      { navigationAdmission, oldSurfaceAdmission },
    );
    const [navigationCompletion, oldSurfaceCompletion] = await Promise.all([
      navigationAdmission.completion,
      oldSurfaceAdmission.completion,
    ]);
    assertProbe(
      navigationCompletion.status === "navigated" &&
        oldSurfaceCompletion.status === "disposed" &&
        isDeepStrictEqual(completionOrder, ["active-navigation", "queued-disposed"]) &&
        emitted === 0 &&
        runtimeApi.disposeRuntimeActionTurns(mounted.handle).status === "already-disposed",
      "Active navigation completion was not observed before queued disposed completion.",
      { navigationCompletion, oldSurfaceCompletion, completionOrder, emitted },
    );
    orderProbes += 2;
    queueProbes += 3;
    disposalProbes += 4;
    delegateCalls += 2;
  }

  {
    let mounted;
    let queuedAdmission;
    let queuedProgram;
    let queuedSnapshot;
    let emitted = 0;
    const settlement = deferred();
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation: () => settlement.promise,
      navigate() {
        queuedAdmission = runtimeApi.executeRuntimeActionTurn(mounted.handle, {
          program: queuedProgram.program,
          snapshot: queuedSnapshot,
        });
        return { status: "succeeded" };
      },
      emitEvent() {
        emitted += 1;
        return { status: "succeeded" };
      },
    });
    mounted = mustMountCoordinator(runtimeApi, fixture);
    queuedProgram = mustPrepare(runtimeApi, [{ type: "event.emit", name: PROBE_HOST_EVENT }]);
    queuedSnapshot = currentProbeResolution(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [
        proofOperationAction({
          onSuccess: [{ type: "navigate", surface: PROBE_NEXT_SURFACE_ID }],
        }),
      ]),
      queuedSnapshot,
    );
    settlement.resolve({
      status: "succeeded",
      value: { userId: "proof-user" },
    });
    await flushMicrotasks();
    assertProbe(
      queuedAdmission?.status === "queued",
      "Navigation did not retain the reentrant old-surface turn before terminal disposal.",
      queuedAdmission,
    );
    const discarded = await queuedAdmission.completion;
    const disposed = runtimeApi.disposeRuntimeActionTurns(mounted.handle);
    assertProbe(
      discarded.status === "disposed" &&
        emitted === 0 &&
        disposed.status === "already-disposed" &&
        runtimeApi.readRuntimeSurfaceState(fixture.state.handle).status === "disposed" &&
        runtimeApi.readRuntimeCommandEventActions(fixture.commandEventActions.handle).status ===
          "disposed",
      "Settlement navigation promoted queued old-surface work or failed composed disposal.",
      { discarded, emitted, disposed },
    );
    settlementProbes += 2;
    finalizationProbes += 1;
    disposalProbes += 5;
    queueProbes += 2;
    delegateCalls += 2;
  }

  {
    const settlement = deferred();
    const fixture = mountProbeChildren(runtimeApi, catalogSet, {
      invokeOperation: () => settlement.promise,
    });
    const mounted = mustMountCoordinator(runtimeApi, fixture);
    await runPrepared(
      runtimeApi,
      mounted,
      mustPrepare(runtimeApi, [proofOperationAction({ onSuccess: [] })]),
      currentProbeResolution(runtimeApi, fixture),
    );
    const disposed = runtimeApi.disposeRuntimeActionTurns(mounted.handle);
    settlement.resolve({
      status: "succeeded",
      value: { userId: "late-proof-user" },
    });
    await flushMicrotasks();
    assertProbe(
      disposed.status === "disposed" &&
        disposed.disposedInvocations === 1 &&
        runtimeApi.executeRuntimeActionTurn(mounted.handle, {
          program: mustPrepare(runtimeApi, []).program,
          snapshot: Object.freeze({}),
        }).status === "disposed",
      "Late settlement disposal did not invalidate its reservation and ticket lifetime.",
      disposed,
    );
    finalizationProbes += 1;
    disposalProbes += 2;
  }

  return Object.freeze({
    preparedProgramProbes,
    mountProbes,
    dispatchProbes,
    orderProbes,
    snapshotProbes,
    queueProbes,
    settlementProbes,
    finalizationProbes,
    limitProbes,
    disposalProbes,
    delegateCalls,
    duplicateEffects,
    platformEffects: 0,
  });
}

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("ACTION_TURN_ARTIFACT_MISSING", "M04-T13 artifact is missing.", {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("ACTION_TURN_ARTIFACT_UNSAFE", "M04-T13 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/**
 * Builds deterministic M04-T13 evidence from the tracked implementation, live probes, and frozen
 * prerequisite bytes without writing the artifact.
 */
export async function buildRuntimeCoreActionTurnsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    stateNavigation,
    operationResource,
    commandEvent,
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
    normativeText,
    findings,
    proofDocument,
    catalogText,
    tracked,
  ] = await Promise.all([
    verifyPrerequisite(
      STATE_NAVIGATION_PREREQUISITE,
      normalized.prerequisiteBytes?.stateNavigation,
    ),
    verifyPrerequisite(
      OPERATION_RESOURCE_PREREQUISITE,
      normalized.prerequisiteBytes?.operationResource,
    ),
    verifyPrerequisite(COMMAND_EVENT_PREREQUISITE, normalized.prerequisiteBytes?.commandEvent),
    readWorkspaceText("packages/runtime-core/src/action-turns.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-turns.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/action-turns.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/action-turns.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/action-turns.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-action-turns.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-ACTION-TURNS.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let trace;
  try {
    trace = JSON.parse(traceText);
  } catch {
    fail("ACTION_TURN_METADATA_INVALID", "M04-T13 trace metadata is not valid JSON.");
  }

  const sourceInvariants = verifySourceInvariants(sourceText);
  const publicApi = verifyApi(
    sourceText,
    sourceIndexText,
    declarationText,
    builtJavaScript,
    builtIndexJavaScript,
  );
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    if (!builtIndexDeclarationText.includes(name)) {
      fail("ACTION_TURN_DECLARATION_DRIFT", `Root declaration omits ${name}.`);
    }
  }
  for (const name of EXPECTED_TYPE_EXPORTS) {
    if (!builtIndexDeclarationText.includes(name)) {
      fail("ACTION_TURN_DECLARATION_DRIFT", `Root declaration omits ${name}.`);
    }
  }
  const tests = verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifestText);
  const traceRules = verifyTrace(trace);
  const normative = verifyNormativeCoverage(normativeText);
  const documentation = verifyDocumentation(findings, proofDocument);
  const [runtimeApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const runtime = await probeRuntimeBehavior(runtimeApi, validatorApi, catalogText);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T13",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Prepared hostile action arrays execute through one bounded FIFO coordinator with exact child dispatch, current manager snapshots, nested operation settlements, navigation terminality, and exactly-once finalization.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([
        Object.freeze({ id: "N-032", from: "PLANNED", to: "TESTED" }),
      ]),
    }),
    prerequisites: Object.freeze([stateNavigation, operationResource, commandEvent]),
    publicApi,
    sourceInvariants,
    runtime,
    limits: Object.freeze({
      maxActionsPerTurn: 64,
      maxSettlementDepth: 16,
      maxQueuedTurns: 64,
      maxSynchronousTurnTransitions: 64,
      maxTurnGeneration: Number.MAX_SAFE_INTEGER,
      maxRetainedQueuedActions: 4_096,
      maxRetainedQueuedCodeUnits: 1_048_576,
    }),
    semantics: Object.freeze({
      preparation:
        "only own descriptors 0..63 are detached, recursively frozen, and privately routed; index 64 and later suffixes remain unobserved",
      overflow:
        "a 65-entry program retains overflow, executes the first 64 entries in source order, then terminates with ACTION_LIMIT_EXCEEDED",
      dispatch:
        "the coordinator never re-reads raw type and delegates each known entry exactly once to its one owning child executor",
      continuation:
        "skipped and successful child outcomes continue; controlled child failure and unknown route stop",
      snapshots:
        "four current manager snapshots and all exact child authorities are read before admission and every action slot; invalid-snapshot is recorded once and never retried",
      queue:
        "reentrant events and reserved settlement turns share one bounded FIFO and one retained action/code-unit budget",
      settlement:
        "capacity is reserved before operation effect; parent acceptance depth is retained; settlement event scope is unavailable",
      finalization:
        "every observed operation ticket is finalized exactly once from finally on all completion, failure, limit, navigation, and disposal exits",
      navigation:
        "successful navigation terminally disposes the surrendered old-surface stack before completing and never promotes queued old-surface work",
      provenance: "full joint seven-namespace provenance remains deferred to M04-T16",
    }),
    portability: Object.freeze({
      framework: null,
      platformGlobals: Object.freeze([]),
      dynamicEvaluation: false,
      nondeterministicCalls: Object.freeze([]),
      a2uiDependencies: Object.freeze([]),
    }),
    documentation,
    normative,
    evidence: Object.freeze({
      focusedTestRegistrations: tests.focusedRegistrations,
      focusedTests: tests.focusedCases,
      focusedTestTitles: tests.focusedTitles,
      compilerNegativeCases: tests.compilerNegativeCases,
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
        "docs/proof/NORMATIVE-COVERAGE.md",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/proof/RUNTIME-CORE-ACTION-TURNS.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "generic component and behavior bridges plus incoming event payload provenance (M04-T14)",
      "reactive dependency discovery and stale asynchronous-result protection (M04-T15)",
      "full seven-namespace joint provenance, sign-in session, composed disposal, and trace (M04-T16)",
      "production adapter parity, physical cancellation, retry, timeout, persistence, and offline policy",
      "Android and iOS adapter lifecycle behavior",
      "future protocol clarification of N-014, N-041, and PF-043",
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

/** Verifies tracked or injected M04-T13 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreActionTurnsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath = normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_ACTION_TURNS_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreActionTurnsEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("ACTION_TURN_ARTIFACT_DRIFT", "M04-T13 artifact differs from fresh evidence.", {
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
    normativeTested: expected.artifact.normative.tested.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    ...expected.artifact.runtime,
  });
}

/** Atomically writes deterministic M04-T13 evidence after every proof check passes. */
export async function writeRuntimeCoreActionTurnsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath = normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_ACTION_TURNS_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreActionTurnsEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreActionTurnsEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
