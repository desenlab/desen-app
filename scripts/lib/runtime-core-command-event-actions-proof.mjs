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
const RUNTIME_PORT_INTERNAL_API_URL = new URL(
  "../../packages/runtime-core/dist/command-event-ports.js",
  import.meta.url,
);
const RUNTIME_ACTION_INTERNAL_API_URL = new URL(
  "../../packages/runtime-core/dist/command-event-actions.js",
  import.meta.url,
);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

/** Absolute path to deterministic M04-T12 command/event action evidence. */
export const DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
);

const STATE_NAVIGATION_PREREQUISITE = Object.freeze({
  task: "M04-T10",
  path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
  artifact: "runtime-core-0.1.0-state-navigation-actions.json",
  sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
});
const EXECUTION_CONTRACT_PREREQUISITE = Object.freeze({
  task: "M02-T11",
  path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
  artifact: "protocol-0.1.0-execution-contracts.json",
  sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
});
const INTERACTION_CONTRACT_PREREQUISITE = Object.freeze({
  task: "M02-T09",
  path: "docs/proof/artifacts/protocol-0.1.0-interaction-contracts.json",
  artifact: "protocol-0.1.0-interaction-contracts.json",
  sha256: "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208",
});

const EXPECTED_PORT_MODULE_RUNTIME_EXPORTS = Object.freeze([
  "consumeRuntimeComponentCommandHostRequestForAdapterBridge",
  "createRuntimeCommandEventHostPorts",
  "emitRuntimeHostEventHostPort",
  "invokeRuntimeComponentCommandHostPort",
  "isRuntimeCommandEventHostPorts",
  "isRuntimeCommandEventHostPortsForComponentCommandPort",
  "validateRuntimeHostEventHostPort",
]);
const EXPECTED_PORT_MODULE_TYPE_EXPORTS = Object.freeze([
  "RuntimeCommandEventHostPorts",
  "RuntimeCommandEventHostPortsInput",
  "RuntimeComponentCommandHostPort",
  "RuntimeComponentCommandHostRequest",
  "RuntimeComponentCommandHostResult",
  "RuntimeComponentCommandPortCallResult",
  "RuntimeHostEventEmissionCallResult",
  "RuntimeHostEventEmissionResult",
  "RuntimeHostEventPort",
  "RuntimeHostEventRequest",
  "RuntimeHostEventValidationCallResult",
  "RuntimeHostEventValidationResult",
]);
const EXPECTED_PORT_ROOT_RUNTIME_EXPORTS = Object.freeze(["createRuntimeCommandEventHostPorts"]);
const EXPECTED_PORT_ROOT_TYPE_EXPORTS = Object.freeze([
  "RuntimeCommandEventHostPorts",
  "RuntimeCommandEventHostPortsInput",
  "RuntimeComponentCommandHostPort",
  "RuntimeComponentCommandHostRequest",
  "RuntimeComponentCommandHostResult",
  "RuntimeHostEventEmissionResult",
  "RuntimeHostEventPort",
  "RuntimeHostEventRequest",
  "RuntimeHostEventValidationResult",
]);
const PORT_INTERNAL_RUNTIME_EXPORTS = Object.freeze([
  "consumeRuntimeComponentCommandHostRequestForAdapterBridge",
  "emitRuntimeHostEventHostPort",
  "invokeRuntimeComponentCommandHostPort",
  "isRuntimeCommandEventHostPorts",
  "isRuntimeCommandEventHostPortsForComponentCommandPort",
  "validateRuntimeHostEventHostPort",
]);
const PORT_INTERNAL_TYPE_EXPORTS = Object.freeze([
  "RuntimeComponentCommandPortCallResult",
  "RuntimeHostEventEmissionCallResult",
  "RuntimeHostEventValidationCallResult",
]);
const EXPECTED_ACTION_MODULE_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_COMMAND_EVENT_ACTION_LIMITS",
  "disposeRuntimeCommandEventActions",
  "executeRuntimeCommandEventAction",
  "mountRuntimeCommandEventActions",
  "readRuntimeCommandEventActions",
  "readRuntimeCommandEventActionsForAdapterBridge",
  "registerRuntimeComponentCommandTarget",
  "unregisterRuntimeComponentCommandTarget",
]);
const EXPECTED_ACTION_MODULE_TYPE_EXPORTS = Object.freeze([
  "RuntimeCommandEventAction",
  "RuntimeCommandEventActionLimitProfile",
  "RuntimeCommandEventActionResult",
  "RuntimeCommandEventActionsDisposeResult",
  "RuntimeCommandEventActionsHandle",
  "RuntimeCommandEventActionsMountInput",
  "RuntimeCommandEventActionsMountResult",
  "RuntimeCommandEventActionsReadResult",
  "RuntimeCommandEventActionsSnapshot",
  "RuntimeComponentCommandAction",
  "RuntimeComponentCommandRegistrationTicket",
  "RuntimeComponentCommandTargetRegistrationInput",
  "RuntimeComponentCommandTargetRegistrationResult",
  "RuntimeComponentCommandTargetUnregistrationInput",
  "RuntimeComponentCommandTargetUnregistrationResult",
  "RuntimeHostEventEmitAction",
  "RuntimeRegisteredComponentCommandTargetSnapshot",
]);
const EXPECTED_ACTION_ROOT_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_COMMAND_EVENT_ACTION_LIMITS",
  "disposeRuntimeCommandEventActions",
  "executeRuntimeCommandEventAction",
  "mountRuntimeCommandEventActions",
  "readRuntimeCommandEventActions",
  "registerRuntimeComponentCommandTarget",
  "unregisterRuntimeComponentCommandTarget",
]);
const EXPECTED_ACTION_ROOT_TYPE_EXPORTS = EXPECTED_ACTION_MODULE_TYPE_EXPORTS;
const ACTION_INTERNAL_RUNTIME_EXPORTS = Object.freeze([
  "readRuntimeCommandEventActionsForAdapterBridge",
]);
const ACTION_INTERNAL_TYPE_EXPORTS = Object.freeze([]);
const EXPECTED_PORT_SOURCE_IMPORTS = Object.freeze([
  "./host-ports.js",
  "./runtime-json-snapshot.js",
  "./value-resolution.js",
]);
const EXPECTED_ACTION_SOURCE_IMPORTS = Object.freeze([
  "./action-evaluation.js",
  "./command-event-ports.js",
  "./host-ports.js",
  "./predicate-evaluation.js",
  "./runtime-json-snapshot.js",
  "./state-navigation-actions.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "@desen/protocol",
  "@desen/validator",
]);
const EXPECTED_FOCUSED_TESTS = 58;
const EXPECTED_COMPILER_NEGATIVE_CASES = 27;

const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-080",
    owners: Object.freeze(["M02-T09", "M02-T11", "M04-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-106",
    owners: Object.freeze(["M04-T01", "M04-T09", "M04-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-120",
    owners: Object.freeze(["M02-T08", "M02-T09", "M02-T11", "M04-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-122",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-015",
    owners: Object.freeze(["M02-T05", "M02-T09", "M04-T12"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-016",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T12"]),
  }),
]);

const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/command-event-actions.test.ts";
const FINDING_HEADING =
  "## PF-042 — Command target liveness and outbound host-event contracts require a deterministic bridge profile";
const RELATED_OPEN_FINDINGS = Object.freeze(["PF-015", "PF-017", "PF-031", "PF-040", "PF-041"]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T12",
  "`component.command`",
  "`event.emit`",
  "false guard",
  "action-local",
  "component-command-input",
  "allowlist",
  "validate",
  "receiver",
  "factory-authenticated marker",
  "foreign port aggregate",
  "opaque",
  "ABA",
  "exactly one",
  "tombstone",
  "N-031",
  "N-034",
  "PLANNED",
  "M04-T14",
  "M04-T16",
  "PF-042",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T12 command/event evidence",
  "builds byte-identical command/event evidence twice",
  "rejects stale or tampered command/event evidence",
  "rejects stale M04-T10 prerequisite bytes",
  "rejects stale M02-T09 prerequisite bytes",
  "rejects stale M02-T11 prerequisite bytes",
  "detects guard-first hostile observation drift",
  "detects shared token-session and command input drift",
  "detects Catalog authorization-before-materialization drift",
  "detects outbound allowlist and validation-before-emission drift",
  "detects synchronous receiver-independent port drift",
  "detects target-ticket generation, ambiguity, and ABA drift",
  "detects callback-free current registry read drift",
  "detects command/event TOCTOU and reentry drift",
  "detects diagnostics and adapter-redaction drift",
  "detects finite registration and request bounds drift",
  "detects terminal disposal and late-callback drift",
  "detects task-owned byte drift",
  "detects public export, TSDoc, internal non-leak, and platform drift",
  "detects adapter-bridge Catalog, port, and package-root authority drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/command-event-ports.ts",
  "packages/runtime-core/src/command-event-actions.ts",
  "packages/runtime-core/test/command-event-actions.test.ts",
  "packages/runtime-core/test/command-event-actions.types.ts",
  "packages/runtime-core/dist/command-event-ports.js",
  "packages/runtime-core/dist/command-event-ports.js.map",
  "packages/runtime-core/dist/command-event-ports.d.ts",
  "packages/runtime-core/dist/command-event-ports.d.ts.map",
  "packages/runtime-core/dist/command-event-actions.js",
  "packages/runtime-core/dist/command-event-actions.js.map",
  "packages/runtime-core/dist/command-event-actions.d.ts",
  "packages/runtime-core/dist/command-event-actions.d.ts.map",
  "scripts/lib/runtime-core-command-event-actions-proof.mjs",
  "scripts/generate-runtime-core-command-event-actions-proof.mjs",
  "scripts/verify-runtime-core-command-event-actions.mjs",
  "tests/runtime-core-command-event-actions.test.mjs",
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

/** Stable failure used by deterministic M04-T12 evidence and hostile mutation tests. */
export class RuntimeCoreCommandEventActionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreCommandEventActionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreCommandEventActionsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("COMMAND_EVENT_ACTION_EVIDENCE_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} is not deeply frozen.`);
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
      fail(
        "COMMAND_EVENT_ACTION_IMPORT_BOUNDARY_DRIFT",
        "Command/event imports must use literal module names.",
      );
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(parsed, code = "COMMAND_EVENT_ACTION_PLATFORM_BOUNDARY_DRIFT") {
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
    fail(code, "Command/event actions crossed the platform-neutral boundary.", {
      found: [...found].sort(),
    });
  }
}

function normalizeSource(sourceText) {
  return sourceText.replaceAll(/\s+/gu, " ");
}

function positionOf(normalized, marker, code = "COMMAND_EVENT_ACTION_SOURCE_SEMANTIC_DRIFT") {
  const index = normalized.indexOf(marker);
  if (index < 0) {
    fail(code, `Command/event implementation is missing reviewed invariant: ${marker}`);
  }
  return index;
}

function assertOrder(
  normalized,
  markers,
  label,
  code = "COMMAND_EVENT_ACTION_SOURCE_SEMANTIC_DRIFT",
) {
  let cursor = 0;
  for (const marker of markers) {
    const index = normalized.indexOf(marker, cursor);
    if (index < 0) {
      fail(code, `${label} ordering changed.`, { missingAfter: marker });
    }
    cursor = index + marker.length;
  }
}

function functionSource(parsed, name, code = "COMMAND_EVENT_ACTION_SOURCE_SEMANTIC_DRIFT") {
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
  fail("COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function moduleIndexExports(sourceText, fileName, modulePaths) {
  const parsed = sourceFile(
    sourceText,
    fileName,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const byModule = new Map(
    modulePaths.map((modulePath) => [
      modulePath,
      { runtimeExports: [], typeExports: [], declarations: 0 },
    ]),
  );
  for (const statement of parsed.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !byModule.has(statement.moduleSpecifier.text)
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased command/event exports.`,
      );
    }
    const inventory = byModule.get(statement.moduleSpecifier.text);
    inventory.declarations += 1;
    for (const element of statement.exportClause.elements) {
      const target =
        statement.isTypeOnly || element.isTypeOnly
          ? inventory.typeExports
          : inventory.runtimeExports;
      target.push(element.name.text);
    }
  }
  return Object.freeze(
    Object.fromEntries(
      [...byModule].map(([modulePath, inventory]) => [
        modulePath,
        Object.freeze({
          runtimeExports: Object.freeze(inventory.runtimeExports.sort()),
          typeExports: Object.freeze(inventory.typeExports.sort()),
          declarations: inventory.declarations,
        }),
      ]),
    ),
  );
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

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "command-event-actions.test.ts");
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
          fail(
            "COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT",
            "it.each must use a static array table.",
          );
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
        fail(
          "COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT",
          "Focused command/event tests cannot be skipped.",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail(
      "COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT",
      "Focused command/event titles must be unique.",
    );
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("COMMAND_EVENT_ACTION_TEST_INVENTORY_DRIFT", "Focused case count changed.", {
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
    fail("COMMAND_EVENT_ACTION_TYPE_TEST_DRIFT", "Type evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("COMMAND_EVENT_ACTION_TYPE_TEST_DRIFT", "Compiler-negative inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-command-event-actions.test.mjs",
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
        fail("COMMAND_EVENT_ACTION_ROOT_TEST_DRIFT", "Root command/event tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "COMMAND_EVENT_ACTION_ROOT_TEST_DRIFT",
    "Root command/event mutation titles",
  );
  return Object.freeze(titles);
}

function findingSection(findings, heading) {
  const start = findings.indexOf(heading);
  if (start < 0) fail("COMMAND_EVENT_ACTION_FINDING_DRIFT", `${heading} is missing.`);
  const next = findings.indexOf("\n## PF-", start + heading.length);
  return findings.slice(start, next < 0 ? findings.length : next);
}

function verifyDocumentation(findings, proofDocument) {
  const section = findingSection(findings, FINDING_HEADING);
  if (!section.includes("- Status: OPEN") || !section.includes("- Blocks proof: No")) {
    fail("COMMAND_EVENT_ACTION_FINDING_DRIFT", "PF-042 must remain OPEN and non-blocking.");
  }
  for (const related of RELATED_OPEN_FINDINGS) {
    const relatedSection = findingSection(findings, `## ${related} —`);
    if (!relatedSection.includes("- Status: OPEN")) {
      fail("COMMAND_EVENT_ACTION_FINDING_DRIFT", `${related} must remain OPEN.`);
    }
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("COMMAND_EVENT_ACTION_PROOF_DOCUMENT_DRIFT", `M04-T12 proof is missing: ${required}`);
    }
  }
  return Object.freeze({
    finding: "PF-042",
    findingStatus: "OPEN",
    relatedOpenFindings: RELATED_OPEN_FINDINGS,
    proofDocument: "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md",
  });
}

function verifyNormativeCoverage(normativeText) {
  const rows = normativeText
    .split(/\r?\n/gu)
    .filter((line) => line.startsWith("| N-031 ") || line.startsWith("| N-034 "));
  if (rows.length !== 2) {
    fail(
      "COMMAND_EVENT_ACTION_NORMATIVE_DRIFT",
      "N-031 and N-034 normative rows must remain uniquely identifiable.",
    );
  }
  const n031 = rows.find((line) => line.startsWith("| N-031 "));
  const n034 = rows.find((line) => line.startsWith("| N-034 "));
  if (
    !n031.includes("| M04-T12") ||
    !n031.includes("| TESTED") ||
    !n031.includes("command-event-actions.json")
  ) {
    fail(
      "COMMAND_EVENT_ACTION_NORMATIVE_DRIFT",
      "N-031 must be TESTED by exact M04-T12 outbound allowlist evidence.",
    );
  }
  if (!n034.includes("M04-T12") || !n034.includes("| PLANNED")) {
    fail(
      "COMMAND_EVENT_ACTION_NORMATIVE_DRIFT",
      "N-034 must remain PLANNED for concrete production adapters.",
    );
  }
  return Object.freeze({
    tested: Object.freeze(["N-031"]),
    planned: Object.freeze(["N-034"]),
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

function verifyPortsSourceInvariants(sourceText) {
  const parsed = sourceFile(sourceText, "command-event-ports.ts");
  const normalized = normalizeSource(sourceText);
  positionOf(normalized, "const PORT_AUTHORITIES = new WeakMap");
  positionOf(normalized, "const NORMALIZED_COMPONENT_COMMAND_REQUESTS = new WeakMap");
  positionOf(normalized, "Object.getOwnPropertyDescriptor");
  positionOf(normalized, "Reflect.ownKeys");
  positionOf(normalized, "snapshotRuntimeJsonValue");
  positionOf(normalized, "function captureExactDataRecord(");
  positionOf(normalized, "Reflect.apply");
  positionOf(normalized, "Object.freeze({ status:");

  const contextCapture = functionSource(
    parsed,
    "capturedRequestContext",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  assertOrder(
    contextCapture,
    [
      "captureExactDataRecord(input",
      '"documentId"',
      '"requestId"',
      '"revision"',
      '"surfaceId"',
      "capturedJsonString(captured.documentId)",
      "capturedJsonString(captured.requestId)",
      "capturedJsonString(captured.revision)",
      "capturedJsonString(captured.surfaceId)",
      "Object.freeze({",
    ],
    "Exact detached request-context capture",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  const commandCapture = functionSource(
    parsed,
    "capturedCommandRequest",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  if (commandCapture.includes("snapshotRuntimeJsonValue(input)")) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
      "Command port must not copy the whole request through the JSON-node budget.",
    );
  }
  assertOrder(
    commandCapture,
    [
      "captureExactDataRecord(input",
      '"capabilityId"',
      '"command"',
      '"context"',
      '"input"',
      '"runtimeInstanceId"',
      '"sourceNodeId"',
      "capturedRequestContext(captured.context)",
      "capturedJsonString(captured.sourceNodeId)",
      "capturedJsonString(captured.runtimeInstanceId)",
      "capturedJsonString(captured.capabilityId)",
      "capturedJsonString(captured.command)",
      "snapshotRuntimeJsonValue(captured.input)",
      "Object.freeze({",
    ],
    "Standalone command input capture",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  const eventCapture = functionSource(
    parsed,
    "capturedEventRequest",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  if (eventCapture.includes("snapshotRuntimeJsonValue(input)")) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
      "Event port must not copy the whole request through the JSON-node budget.",
    );
  }
  assertOrder(
    eventCapture,
    [
      "captureExactDataRecord(input",
      '"context"',
      '"contractId"',
      '"name"',
      '"payload"',
      "capturedRequestContext(captured.context)",
      "capturedJsonString(captured.name)",
      "capturedJsonString(captured.contractId)",
      "snapshotRuntimeJsonValue(captured.payload)",
      "Object.freeze({",
    ],
    "Standalone event payload capture",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  const create = functionSource(parsed, "createRuntimeCommandEventHostPorts");
  assertOrder(
    create,
    [
      'exactKeys(input, ["commands", "events"])',
      'const commands = ownDataValue(input, "commands");',
      'const events = ownDataValue(input, "events");',
      'const invokeCommand = captureCallback(commands, "invoke");',
      'exactKeys(events, ["emit", "validate"])',
      'const validateEvent = ownDataValue(events, "validate");',
      'const emitEvent = ownDataValue(events, "emit");',
      "const handle = Object.freeze({})",
      "PORT_AUTHORITIES.set(handle",
    ],
    "Command/event host-port capture",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  const consumeNormalizedCommand = functionSource(
    parsed,
    "consumeRuntimeComponentCommandHostRequestForAdapterBridge",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  assertOrder(
    consumeNormalizedCommand,
    [
      "NORMALIZED_COMPONENT_COMMAND_REQUESTS.get(request) === expectedPorts",
      "if (normalized) NORMALIZED_COMPONENT_COMMAND_REQUESTS.delete(request);",
      "return normalized;",
    ],
    "One-shot normalized command-request consumption",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  const componentCommandPortAuthority = functionSource(
    parsed,
    "isRuntimeCommandEventHostPortsForComponentCommandPort",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  assertOrder(
    componentCommandPortAuthority,
    [
      "PORT_AUTHORITIES.get(ports)",
      'captureCallback(commands, "invoke")',
      "authority !== undefined",
      "invokeCommand !== undefined",
      "authority.invokeCommand === invokeCommand",
    ],
    "Exact captured component-command port authority",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  for (const [name, callback, statuses] of [
    [
      "invokeRuntimeComponentCommandHostPort",
      "authority.invokeCommand",
      'closedStatus(raw, ["succeeded", "denied"])',
    ],
    [
      "validateRuntimeHostEventHostPort",
      "authority.validateEvent",
      'closedStatus(raw, ["valid", "invalid"])',
    ],
    [
      "emitRuntimeHostEventHostPort",
      "authority.emitEvent",
      'closedStatus(raw, ["succeeded", "denied"])',
    ],
  ]) {
    const source = functionSource(parsed, name, "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT");
    assertOrder(
      source,
      [
        "PORT_AUTHORITIES.get(ports)",
        'return Object.freeze({ status: "invalid-ports" });',
        "const captured = captured",
        'return Object.freeze({ status: "adapter-failed" });',
        `Reflect.apply(${callback}, undefined, [captured])`,
        'return Object.freeze({ status: "adapter-failed" });',
        statuses,
        'Object.freeze({ status: "adapter-failed" })',
        "Object.freeze({ status })",
      ],
      `${name} receiver-independent normalization`,
      "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
    );
  }
  const commandInvoke = functionSource(
    parsed,
    "invokeRuntimeComponentCommandHostPort",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );
  assertOrder(
    commandInvoke,
    [
      "const captured = capturedCommandRequest(request);",
      "NORMALIZED_COMPONENT_COMMAND_REQUESTS.set(captured, ports);",
      "Reflect.apply(authority.invokeCommand, undefined, [captured])",
      "} finally {",
      "NORMALIZED_COMPONENT_COMMAND_REQUESTS.delete(captured);",
      'closedStatus(raw, ["succeeded", "denied"])',
    ],
    "Normalized command-request factory authority",
    "COMMAND_EVENT_ACTION_PORT_SOURCE_DRIFT",
  );

  return Object.freeze({
    authorityStore: "private WeakMap",
    normalizedCommandRequestAuthority: "private owner-bound one-shot WeakMap",
    componentCommandPortAuthority: "exact captured callback identity",
    receiver: null,
    inputCapture: "exact own enumerable data properties",
    requestCapture: "metadata/context and runtime-bounded input or payload detached independently",
    jsonNodeBudget:
      "one M04-T02 nine-node scope envelope; no second command/event request-envelope tax",
    resultGrammar: "closed synchronous envelopes",
  });
}

function verifyActionsSourceInvariants(sourceText) {
  const parsed = sourceFile(sourceText, "command-event-actions.ts");
  const normalized = normalizeSource(sourceText);
  positionOf(normalized, "const ACTION_AUTHORITIES = new WeakMap");
  positionOf(normalized, "const REGISTRATION_TICKETS = new WeakMap");
  positionOf(normalized, "liveTargets: Map<string, Map<string, LiveTarget>>");
  positionOf(normalized, "validateDesenExecutionCatalogSet");
  positionOf(normalized, "validateDesenExecutionValue");
  positionOf(normalized, "createRuntimeActionEvaluationSession");
  positionOf(normalized, "materializeRuntimeActionNamedValues");
  positionOf(normalized, "Reflect.apply(authority.hostPorts.diagnostics.report, undefined");
  const limits = functionSource(parsed, "captureLimits");
  if (limits.includes("?? RUNTIME_COMMAND_EVENT_ACTION_LIMITS")) {
    fail(
      "COMMAND_EVENT_ACTION_SOURCE_SEMANTIC_DRIFT",
      "Present null limits must not be defaulted as though absent.",
    );
  }
  const capturedLimit = functionSource(parsed, "capturedLimit");
  positionOf(capturedLimit, "Object.hasOwn(input, key)");
  for (const limit of [
    "maxActionGeneration",
    "maxRegistrationGeneration",
    "maxSnapshotGeneration",
    "maxLiveTargets",
    "maxStaticComponents",
    "maxHostEvents",
    "maxRetainedIdentifierCodeUnits",
    "maxRuntimeInstanceIdCodeUnits",
  ]) {
    positionOf(limits, `"${limit}"`);
  }

  const mount = functionSource(parsed, "mountRuntimeCommandEventActions");
  assertOrder(
    mount,
    [
      "const limits = captureLimits(",
      "const staticCapture = captureStringMap(",
      "limits.maxStaticComponents",
      "limits.maxRetainedIdentifierCodeUnits",
      "const hostCapture = captureStringMap(",
      "limits.maxHostEvents",
      "const staticComponents = staticCapture.value;",
      "const hostEvents = hostCapture.value;",
      "const validated = validateDesenExecutionCatalogSet(catalogSet);",
      "validated.value !== catalogSet",
      "const componentCommands = catalogCommands(catalogSet);",
      "isRuntimeCommandEventHostPorts(commandEventPorts)",
      "hostPorts = createRuntimeHostPorts(",
      "liveTargets: new Map()",
      "authority.snapshot = makeSnapshot(authority, 0);",
      "ACTION_AUTHORITIES.set(handle, authority);",
    ],
    "Command/event mount authority",
  );

  const read = functionSource(parsed, "readRuntimeCommandEventActions");
  assertOrder(
    read,
    [
      'typeof handle !== "object" || handle === null',
      "ACTION_AUTHORITIES.get(handle)",
      'authority.status === "live"',
      'status: "read", snapshot: authority.snapshot',
      'status: "disposed"',
    ],
    "Callback-free current command/event registry read",
  );

  const adapterBridgeRead = functionSource(
    parsed,
    "readRuntimeCommandEventActionsForAdapterBridge",
  );
  assertOrder(
    adapterBridgeRead,
    [
      'typeof handle !== "object" || handle === null',
      "ACTION_AUTHORITIES.get(handle)",
      'authority.status === "live"',
      'status: "read"',
      "catalogSet: authority.catalogSet",
      "commandEventPorts: authority.commandEventPorts",
      "snapshot: authority.snapshot",
      'status: "disposed"',
    ],
    "Callback-free exact Catalog, command-port, and registry adapter-bridge read",
  );

  const register = functionSource(parsed, "registerRuntimeComponentCommandTarget");
  assertOrder(
    register,
    [
      "authority.transitioning || authority.reporting",
      "authority.transitioning = true;",
      "!isPlainRecord(input)",
      'ownDataValue(input, "sourceNodeId")',
      "snapshotRuntimeJsonValue(runtimeInstanceId.value) !== runtimeInstanceId.value",
      "snapshot.value !== authority.snapshot",
      "authority.staticComponents.get(sourceNodeId.value)",
      "targets?.has(runtimeInstanceId.value)",
      "authority.liveTargetCount >= authority.limits.maxLiveTargets",
      "const generation = authority.nextRegistrationGeneration;",
      "generation > authority.limits.maxRegistrationGeneration",
      "!canRegisterWithSnapshotReservation(authority)",
      "const ticket = Object.freeze({})",
      "const updatedTargets = new Map(targets);",
      "updatedTargets.set(runtimeInstanceId.value, target);",
      "authority.nextRegistrationGeneration += 1;",
      "authority.liveTargetCount += 1;",
      "authority.liveTargets.set(sourceNodeId.value, updatedTargets);",
      "REGISTRATION_TICKETS.set(ticket",
      "publishSnapshot(authority)",
      "authority.transitioning = false;",
    ],
    "Atomic component-target registration",
  );

  const unregister = functionSource(parsed, "unregisterRuntimeComponentCommandTarget");
  assertOrder(
    unregister,
    [
      "authority.transitioning || authority.reporting",
      "authority.transitioning = true;",
      "!isPlainRecord(input)",
      'ownDataValue(input, "ticket")',
      "snapshot.value !== authority.snapshot",
      "REGISTRATION_TICKETS.get(ticket)",
      "ticketAuthority.ownerKey !== authority.ownerKey",
      '"status" in ticketAuthority',
      "targets?.get(ticketAuthority.runtimeInstanceId)",
      "target.ticket !== ticket",
      "!canPublishSnapshot(authority)",
      "const updatedTargets = new Map(targets);",
      "updatedTargets.delete(target.runtimeInstanceId);",
      "authority.liveTargetCount -= 1;",
      "REGISTRATION_TICKETS.set(",
      "publishSnapshot(authority)",
      "authority.transitioning = false;",
    ],
    "Atomic exact-ticket unregistration",
  );

  const execute = functionSource(parsed, "executeRuntimeCommandEventAction");
  verifyExecuteSourceInvariants(execute);
  const dispose = functionSource(parsed, "disposeRuntimeCommandEventActions");
  assertOrder(
    dispose,
    [
      'authority.status = "revoked";',
      "REGISTRATION_TICKETS.set(",
      "authority.liveTargets.clear();",
      "authority.liveTargetCount = 0;",
      "ACTION_AUTHORITIES.set(",
      'status: "disposed"',
    ],
    "Terminal command/event disposal",
  );
  return Object.freeze({
    staticAuthority: "exact prepared Catalog component command inventory",
    targetAuthority: "opaque per-instance ticket and monotonic generation",
    targetCardinality: "dispatch iff exactly one instance is live",
    adapterBridgeRead:
      "package-internal callback-free exact Catalog, command-port, and current registry authorities",
    transitionLock: "before hostile request observation",
    mutationPreflight: "finite generations before tickets, counters, registries, or snapshots",
  });
}

function verifyExecuteSourceInvariants(execute) {
  assertOrder(
    execute,
    [
      "authority.transitioning || authority.reporting",
      "registrySnapshot !== authority.snapshot",
      "const requestId = nextRequestId(authority);",
      "authority.transitioning = true;",
      "validResolutionSnapshot(resolutionSnapshot)",
      "createRuntimeActionEvaluationSession(",
      "captureRuntimeActionWhen(action)",
      "observationFailure(authority, registrySnapshot)",
      "evaluateRuntimeActionGuard(",
      "observationFailure(authority, registrySnapshot)",
      "if (!evaluated.value)",
      'status: "skipped"',
      "const plainAction = isPlainRecord(action);",
      'const type = ownDataValue(action, "type");',
    ],
    "Guard-first command/event execution",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "component.command")',
      'const target = ownDataValue(action, "target");',
      "authority.staticComponents.get(target.value)",
      'const command = ownDataValue(action, "command");',
      'kind: "component-command-input"',
      "validateDesenExecutionValue(",
      "authority.componentCommands.get(capabilityId)?.has(command.value)",
      "declarationProbe.diagnostics.length > 0",
      "authority.liveTargets.get(target.value)",
      "targets.size !== 1",
      'const input = ownDataValue(action, "input");',
      "materializeRuntimeActionNamedValues(",
      "validateDesenExecutionValue(",
      "observationFailure(authority, registrySnapshot)",
      "acceptRequest(authority);",
      "invokeRuntimeComponentCommandHostPort(",
      "observationFailure(authority, registrySnapshot)",
    ],
    "Catalog-authorized command execution",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "event.emit")',
      'const name = ownDataValue(action, "name");',
      "!isCanonicalJsonString(name.value)",
      "authority.hostEvents.get(name.value)",
      'const payload = ownDataValue(action, "payload");',
      "materializeRuntimeActionNamedValues(",
      "acceptRequest(authority);",
      "validateRuntimeHostEventHostPort(",
      "observationFailure(authority, registrySnapshot)",
      "emitRuntimeHostEventHostPort(",
      "observationFailure(authority, registrySnapshot)",
    ],
    "Allowlisted validate-before-emit execution",
  );
}

function verifyApi({
  portsSourceText,
  actionsSourceText,
  portsDeclarationText,
  actionsDeclarationText,
  portsBuiltJavaScript,
  actionsBuiltJavaScript,
  sourceIndexText,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const modules = [
    {
      name: "ports",
      sourceText: portsSourceText,
      declarationText: portsDeclarationText,
      builtJavaScript: portsBuiltJavaScript,
      sourceName: "command-event-ports.ts",
      declarationName: "command-event-ports.d.ts",
      builtName: "command-event-ports.js",
      expectedRuntime: EXPECTED_PORT_MODULE_RUNTIME_EXPORTS,
      expectedTypes: EXPECTED_PORT_MODULE_TYPE_EXPORTS,
      expectedImports: EXPECTED_PORT_SOURCE_IMPORTS,
    },
    {
      name: "actions",
      sourceText: actionsSourceText,
      declarationText: actionsDeclarationText,
      builtJavaScript: actionsBuiltJavaScript,
      sourceName: "command-event-actions.ts",
      declarationName: "command-event-actions.d.ts",
      builtName: "command-event-actions.js",
      expectedRuntime: EXPECTED_ACTION_MODULE_RUNTIME_EXPORTS,
      expectedTypes: EXPECTED_ACTION_MODULE_TYPE_EXPORTS,
      expectedImports: EXPECTED_ACTION_SOURCE_IMPORTS,
    },
  ];
  const result = {};
  let tsdocDeclarations = 0;
  for (const module of modules) {
    const sourceInventory = exportedDeclarations(module.sourceText, module.sourceName);
    const declarationInventory = exportedDeclarations(
      module.declarationText,
      module.declarationName,
    );
    const builtInventory = exportedDeclarations(
      module.builtJavaScript,
      module.builtName,
      ts.ScriptKind.JS,
    );
    assertDirectExports(
      sourceInventory,
      "COMMAND_EVENT_ACTION_SOURCE_EXPORT_DRIFT",
      module.sourceName,
    );
    assertArrayEqual(
      sourceInventory.runtimeExports,
      module.expectedRuntime,
      "COMMAND_EVENT_ACTION_SOURCE_EXPORT_DRIFT",
      `${module.name} source runtime exports`,
    );
    assertArrayEqual(
      sourceInventory.typeExports,
      module.expectedTypes,
      "COMMAND_EVENT_ACTION_SOURCE_EXPORT_DRIFT",
      `${module.name} source type exports`,
    );
    assertArrayEqual(
      sourceInventory.missingTsdoc,
      [],
      "COMMAND_EVENT_ACTION_TSDOC_DRIFT",
      `${module.name} source TSDoc gaps`,
    );
    assertArrayEqual(
      declarationInventory.runtimeExports,
      module.expectedRuntime,
      "COMMAND_EVENT_ACTION_DECLARATION_EXPORT_DRIFT",
      `${module.name} declaration runtime exports`,
    );
    assertArrayEqual(
      declarationInventory.typeExports,
      module.expectedTypes,
      "COMMAND_EVENT_ACTION_DECLARATION_EXPORT_DRIFT",
      `${module.name} declaration type exports`,
    );
    assertArrayEqual(
      builtInventory.runtimeExports,
      module.expectedRuntime,
      "COMMAND_EVENT_ACTION_DISTRIBUTION_EXPORT_DRIFT",
      `${module.name} JavaScript exports`,
    );
    assertArrayEqual(
      builtInventory.typeExports,
      [],
      "COMMAND_EVENT_ACTION_DISTRIBUTION_EXPORT_DRIFT",
      `${module.name} JavaScript type exports`,
    );
    assertArrayEqual(
      importedModules(sourceInventory.sourceFile),
      module.expectedImports,
      "COMMAND_EVENT_ACTION_IMPORT_BOUNDARY_DRIFT",
      `${module.name} source imports`,
    );
    verifyPlatformBoundary(sourceInventory.sourceFile);
    verifyPlatformBoundary(builtInventory.sourceFile);
    tsdocDeclarations += sourceInventory.runtimeExports.length + sourceInventory.typeExports.length;
    result[module.name] = Object.freeze({
      module: `packages/runtime-core/src/command-event-${module.name}.ts`,
      runtimeExports: sourceInventory.runtimeExports,
      typeExports: sourceInventory.typeExports,
      imports: Object.freeze(importedModules(sourceInventory.sourceFile)),
    });
  }

  const modulePaths = ["./command-event-actions.js", "./command-event-ports.js"];
  const sourceIndex = moduleIndexExports(sourceIndexText, "src/index.ts", modulePaths);
  const declarationIndex = moduleIndexExports(
    builtIndexDeclarationText,
    "dist/index.d.ts",
    modulePaths,
  );
  const builtIndex = moduleIndexExports(builtIndexJavaScript, "dist/index.js", modulePaths);
  for (const [modulePath, expectedRuntime, expectedTypes] of [
    [
      "./command-event-actions.js",
      EXPECTED_ACTION_ROOT_RUNTIME_EXPORTS,
      EXPECTED_ACTION_ROOT_TYPE_EXPORTS,
    ],
    [
      "./command-event-ports.js",
      EXPECTED_PORT_ROOT_RUNTIME_EXPORTS,
      EXPECTED_PORT_ROOT_TYPE_EXPORTS,
    ],
  ]) {
    assertArrayEqual(
      sourceIndex[modulePath].runtimeExports,
      expectedRuntime,
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} source-index runtime exports`,
    );
    assertArrayEqual(
      sourceIndex[modulePath].typeExports,
      expectedTypes,
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} source-index type exports`,
    );
    assertArrayEqual(
      declarationIndex[modulePath].runtimeExports,
      expectedRuntime,
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} declaration-index runtime exports`,
    );
    assertArrayEqual(
      declarationIndex[modulePath].typeExports,
      expectedTypes,
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} declaration-index type exports`,
    );
    assertArrayEqual(
      builtIndex[modulePath].runtimeExports,
      expectedRuntime,
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} built-index runtime exports`,
    );
    assertArrayEqual(
      builtIndex[modulePath].typeExports,
      [],
      "COMMAND_EVENT_ACTION_INDEX_EXPORT_DRIFT",
      `${modulePath} built-index type exports`,
    );
  }
  if (
    moduleReferences(actionsSourceText, "command-event-actions.ts", "./command-event-ports.js")
      .length !== 2
  ) {
    fail(
      "COMMAND_EVENT_ACTION_IMPORT_BOUNDARY_DRIFT",
      "Action source must use exactly one value and one type import from the private port module.",
    );
  }
  const leakedInternals = [
    ...PORT_INTERNAL_RUNTIME_EXPORTS,
    ...PORT_INTERNAL_TYPE_EXPORTS,
    ...ACTION_INTERNAL_RUNTIME_EXPORTS,
    ...ACTION_INTERNAL_TYPE_EXPORTS,
  ].filter(
    (name) =>
      sourceIndex["./command-event-actions.js"].runtimeExports.includes(name) ||
      sourceIndex["./command-event-actions.js"].typeExports.includes(name) ||
      sourceIndex["./command-event-ports.js"].runtimeExports.includes(name) ||
      sourceIndex["./command-event-ports.js"].typeExports.includes(name),
  );
  assertArrayEqual(
    leakedInternals,
    [],
    "COMMAND_EVENT_ACTION_INTERNAL_EXPORT_DRIFT",
    "Package-internal authority exports",
  );
  return Object.freeze({
    runtimeExports: Object.freeze([
      ...EXPECTED_PORT_ROOT_RUNTIME_EXPORTS,
      ...EXPECTED_ACTION_ROOT_RUNTIME_EXPORTS,
    ]),
    typeExports: Object.freeze([
      ...EXPECTED_PORT_ROOT_TYPE_EXPORTS,
      ...EXPECTED_ACTION_ROOT_TYPE_EXPORTS,
    ]),
    internalRuntimeExports: Object.freeze([
      ...PORT_INTERNAL_RUNTIME_EXPORTS,
      ...ACTION_INTERNAL_RUNTIME_EXPORTS,
    ]),
    internalTypeExports: Object.freeze([
      ...PORT_INTERNAL_TYPE_EXPORTS,
      ...ACTION_INTERNAL_TYPE_EXPORTS,
    ]),
    tsdocDeclarations,
    modules: Object.freeze(result),
  });
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  const focused = collectFocusedTests(packageTests);
  const compilerNegativeLabels = compilerNegativeInventory(typeTests);
  const rootTitles = rootTestInventory(rootTests);
  if (runtimeManifest.scripts?.["test:command-event-actions"] !== EXPECTED_PACKAGE_TEST_SCRIPT) {
    fail(
      "COMMAND_EVENT_ACTION_TEST_SCRIPT_DRIFT",
      "Focused command/event package test script changed.",
    );
  }
  return Object.freeze({ focused, compilerNegativeLabels, rootTitles });
}

function prepareCatalog(validatorApi, catalogText) {
  let catalog;
  try {
    catalog = JSON.parse(catalogText);
  } catch {
    fail(
      "COMMAND_EVENT_ACTION_CATALOG_FIXTURE_DRIFT",
      "The frozen web Catalog fixture is invalid JSON.",
    );
  }
  const textField = catalog.components?.["com.example.ui/TextField"];
  const map = catalog.components?.["com.example.maps/Map"];
  const focus = textField?.commands?.focus?.inputSchema;
  const fitBounds = map?.commands?.fitBounds?.inputSchema;
  if (
    !isDeepStrictEqual(Object.keys(textField?.commands ?? {}).sort(), ["focus"]) ||
    focus?.type !== "object" ||
    focus?.additionalProperties !== false ||
    Object.hasOwn(focus ?? {}, "required") ||
    !isDeepStrictEqual(Object.keys(map?.commands ?? {}).sort(), ["fitBounds"]) ||
    fitBounds?.type !== "object" ||
    fitBounds?.additionalProperties !== false ||
    !isDeepStrictEqual(fitBounds?.required, ["bounds"]) ||
    fitBounds?.properties?.bounds?.type !== "object"
  ) {
    fail(
      "COMMAND_EVENT_ACTION_CATALOG_FIXTURE_DRIFT",
      "Reviewed component command metadata changed.",
    );
  }
  const result = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  if (!result.valid) {
    fail(
      "COMMAND_EVENT_ACTION_CATALOG_FIXTURE_DRIFT",
      "The command/event proof Catalog no longer prepares.",
      { diagnostics: plainData(result.diagnostics) },
    );
  }
  return Object.freeze({
    catalogSet: result.value,
    parity: Object.freeze({
      textField: Object.freeze({
        capabilityId: "com.example.ui/TextField",
        commands: Object.freeze(["focus"]),
        focusInput: "closed empty object",
      }),
      map: Object.freeze({
        capabilityId: "com.example.maps/Map",
        commands: Object.freeze(["fitBounds"]),
        fitBoundsInput: "closed object requiring bounds",
      }),
    }),
  });
}

const DOCUMENT_ID = "https://desen.app/kanıt/command-event";
const REVISION = `sha256:${"c".repeat(64)}`;
const SURFACE_ID = "proof-surface";
const MAP_CAPABILITY = "com.example.maps/Map";
const TEXT_FIELD_CAPABILITY = "com.example.ui/TextField";

function createHostPorts(api, { resolveToken, report } = {}) {
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
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: resolveToken ?? (() => ({ status: "missing" })) },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: report ?? (() => undefined) },
  });
}

function requestContext(requestId) {
  return Object.freeze({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    requestId,
  });
}

function probePortBehavior(api, portApi) {
  const calls = [];
  const receivers = [];
  const componentCommandPort = Object.freeze({
    invoke(request) {
      receivers.push(this);
      calls.push(["command", request]);
      return { status: "succeeded" };
    },
  });
  const ports = api.createRuntimeCommandEventHostPorts({
    commands: componentCommandPort,
    events: {
      validate(request) {
        receivers.push(this);
        calls.push(["validate", request]);
        return { status: "valid" };
      },
      emit(request) {
        receivers.push(this);
        calls.push(["emit", request]);
        return { status: "denied" };
      },
    },
  });
  const commandRequest = {
    context: requestContext('command:["map","fitBounds",0]'),
    sourceNodeId: "map",
    runtimeInstanceId: "map-instance-1",
    capabilityId: MAP_CAPABILITY,
    command: "fitBounds",
    input: { bounds: { north: 1 } },
  };
  const eventRequest = {
    context: requestContext('event:["saved",1]'),
    name: "saved",
    contractId: "app.saved.v1",
    payload: { itemId: "item-1" },
  };
  const command = portApi.invokeRuntimeComponentCommandHostPort(ports, commandRequest);
  const validation = portApi.validateRuntimeHostEventHostPort(ports, eventRequest);
  const emission = portApi.emitRuntimeHostEventHostPort(ports, eventRequest);
  assertDataEqual(command, { status: "succeeded" }, "Command port success");
  assertDataEqual(validation, { status: "valid" }, "Event validation success");
  assertDataEqual(emission, { status: "denied" }, "Event emission denial");
  if (
    calls.length !== 3 ||
    receivers.some((receiver) => receiver !== undefined) ||
    calls[0][1] === commandRequest ||
    calls[1][1] === eventRequest ||
    !isDeepStrictEqual(plainData(calls[0][1]), commandRequest) ||
    !isDeepStrictEqual(plainData(calls[1][1]), eventRequest)
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Command/event callbacks lost receiver independence or detached request capture.",
    );
  }
  for (const [, request] of calls) assertDeepFrozen(request, "Captured command/event request");

  const standaloneJsonObject = (propertyDelta) =>
    Object.freeze(
      Object.fromEntries(
        Array.from(
          {
            length: api.RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes - 10 + propertyDelta,
          },
          (_, index) => [`node${index}`, null],
        ),
      ),
    );
  const exactStandaloneInput = standaloneJsonObject(0);
  const exactStandalonePayload = standaloneJsonObject(0);
  const boundaryResults = [
    portApi.invokeRuntimeComponentCommandHostPort(ports, {
      ...commandRequest,
      input: exactStandaloneInput,
    }),
    portApi.validateRuntimeHostEventHostPort(ports, {
      ...eventRequest,
      payload: exactStandalonePayload,
    }),
    portApi.emitRuntimeHostEventHostPort(ports, {
      ...eventRequest,
      payload: exactStandalonePayload,
    }),
  ];
  assertDataEqual(boundaryResults[0], { status: "succeeded" }, "Boundary command input");
  assertDataEqual(boundaryResults[1], { status: "valid" }, "Boundary event validation");
  assertDataEqual(boundaryResults[2], { status: "denied" }, "Boundary event emission");
  if (
    calls.length !== 6 ||
    receivers.length !== 6 ||
    calls[3][1].input === exactStandaloneInput ||
    calls[4][1].payload === exactStandalonePayload
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Exact 4,096-node aggregate input/payload lost independent detached capture.",
    );
  }
  for (const [, request] of calls.slice(3)) {
    assertDeepFrozen(request, "Boundary command/event request");
  }

  const overStandaloneBoundary = standaloneJsonObject(1);
  const callsBeforeOversize = calls.length;
  for (const result of [
    portApi.invokeRuntimeComponentCommandHostPort(ports, {
      ...commandRequest,
      input: overStandaloneBoundary,
    }),
    portApi.validateRuntimeHostEventHostPort(ports, {
      ...eventRequest,
      payload: overStandaloneBoundary,
    }),
    portApi.emitRuntimeHostEventHostPort(ports, {
      ...eventRequest,
      payload: overStandaloneBoundary,
    }),
  ]) {
    assertDataEqual(result, { status: "adapter-failed" }, "Oversized standalone JSON");
  }
  if (calls.length !== callsBeforeOversize) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "A 4,097-node aggregate crossed the command/event bridge.",
    );
  }

  const beforeInvalidContext = calls.length;
  const invalidContext = portApi.invokeRuntimeComponentCommandHostPort(ports, {
    ...commandRequest,
    context: { ...commandRequest.context, privateSecret: "must-not-cross" },
  });
  assertDataEqual(invalidContext, { status: "adapter-failed" }, "Exact request context");
  if (calls.length !== beforeInvalidContext) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Malformed request context crossed the command callback boundary.",
    );
  }

  let statusGetterReads = 0;
  const malformedPorts = api.createRuntimeCommandEventHostPorts({
    commands: { invoke: () => Promise.resolve({ status: "succeeded" }) },
    events: {
      validate: () =>
        Object.defineProperty({}, "status", {
          enumerable: true,
          get() {
            statusGetterReads += 1;
            return "valid";
          },
        }),
      emit: () => {
        throw new Error("private-secret-stack");
      },
    },
  });
  for (const result of [
    portApi.invokeRuntimeComponentCommandHostPort(malformedPorts, commandRequest),
    portApi.validateRuntimeHostEventHostPort(malformedPorts, eventRequest),
    portApi.emitRuntimeHostEventHostPort(malformedPorts, eventRequest),
  ]) {
    assertDataEqual(result, { status: "adapter-failed" }, "Redacted malformed port result");
    if (JSON.stringify(plainData(result)).includes("private-secret")) {
      fail(
        "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
        "Raw adapter failure crossed the port boundary.",
      );
    }
  }
  if (statusGetterReads !== 0) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Accessor-bearing result was observed while normalizing a closed envelope.",
    );
  }

  let factoryGetterReads = 0;
  const accessorInput = Object.defineProperty(
    {
      events: {
        validate: () => ({ status: "valid" }),
        emit: () => ({ status: "succeeded" }),
      },
    },
    "commands",
    {
      enumerable: true,
      get() {
        factoryGetterReads += 1;
        return { invoke: () => ({ status: "succeeded" }) };
      },
    },
  );
  try {
    api.createRuntimeCommandEventHostPorts(accessorInput);
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Accessor-bearing port factory input was accepted.",
    );
  } catch (error) {
    if (
      error instanceof RuntimeCoreCommandEventActionsEvidenceError ||
      !(error instanceof TypeError)
    ) {
      throw error;
    }
  }
  if (factoryGetterReads !== 0) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Port factory invoked a caller-owned accessor.",
    );
  }
  if (
    portApi.isRuntimeCommandEventHostPorts?.(ports) !== true ||
    portApi.isRuntimeCommandEventHostPorts?.(Object.freeze({})) !== false
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Factory-authenticated port authority changed.",
    );
  }
  let componentPortGetterReads = 0;
  const accessorComponentPort = Object.defineProperty({}, "invoke", {
    enumerable: true,
    get() {
      componentPortGetterReads += 1;
      return componentCommandPort.invoke;
    },
  });
  const exactComponentPort = portApi.isRuntimeCommandEventHostPortsForComponentCommandPort(
    ports,
    componentCommandPort,
  );
  const foreignComponentPort = portApi.isRuntimeCommandEventHostPortsForComponentCommandPort(
    ports,
    Object.freeze({ invoke: () => ({ status: "succeeded" }) }),
  );
  const accessorComponentPortResult = portApi.isRuntimeCommandEventHostPortsForComponentCommandPort(
    ports,
    accessorComponentPort,
  );
  if (
    exactComponentPort !== true ||
    foreignComponentPort !== false ||
    accessorComponentPortResult !== false ||
    componentPortGetterReads !== 0
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Aggregate host-port authority no longer authenticates its exact component-command callback.",
      {
        exactComponentPort,
        foreignComponentPort,
        accessorComponentPortResult,
        componentPortGetterReads,
      },
    );
  }

  const normalizedConsumption = [];
  let normalizedPorts;
  const sharedNormalizedCommandPort = Object.freeze({
    invoke(request) {
      normalizedConsumption.push(
        portApi.consumeRuntimeComponentCommandHostRequestForAdapterBridge(request, normalizedPorts),
        portApi.consumeRuntimeComponentCommandHostRequestForAdapterBridge(request, normalizedPorts),
      );
      return { status: "succeeded" };
    },
  });
  normalizedPorts = api.createRuntimeCommandEventHostPorts({
    commands: sharedNormalizedCommandPort,
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const foreignNormalizedPorts = api.createRuntimeCommandEventHostPorts({
    commands: sharedNormalizedCommandPort,
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const callerConsumption = portApi.consumeRuntimeComponentCommandHostRequestForAdapterBridge(
    commandRequest,
    normalizedPorts,
  );
  const normalizedResult = portApi.invokeRuntimeComponentCommandHostPort(
    normalizedPorts,
    commandRequest,
  );
  const foreignNormalizedResult = portApi.invokeRuntimeComponentCommandHostPort(
    foreignNormalizedPorts,
    commandRequest,
  );
  if (
    callerConsumption !== false ||
    !isDeepStrictEqual(normalizedConsumption, [true, false, false, false]) ||
    !isDeepStrictEqual(plainData(normalizedResult), { status: "succeeded" }) ||
    !isDeepStrictEqual(plainData(foreignNormalizedResult), { status: "succeeded" })
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Normalized command request did not carry one exact-owner factory authentication.",
      {
        callerConsumption,
        normalizedConsumption,
        normalizedResult: plainData(normalizedResult),
        foreignNormalizedResult: plainData(foreignNormalizedResult),
      },
    );
  }

  let unconsumedNormalizedRequest;
  const unconsumedPorts = api.createRuntimeCommandEventHostPorts({
    commands: {
      invoke(request) {
        unconsumedNormalizedRequest = request;
        return { status: "succeeded" };
      },
    },
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const unconsumedResult = portApi.invokeRuntimeComponentCommandHostPort(
    unconsumedPorts,
    commandRequest,
  );
  const afterSuccessfulCallback = portApi.consumeRuntimeComponentCommandHostRequestForAdapterBridge(
    unconsumedNormalizedRequest,
    unconsumedPorts,
  );

  let thrownNormalizedRequest;
  const throwingPorts = api.createRuntimeCommandEventHostPorts({
    commands: {
      invoke(request) {
        thrownNormalizedRequest = request;
        throw new Error("normalized-request-lifetime");
      },
    },
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const thrownResult = portApi.invokeRuntimeComponentCommandHostPort(throwingPorts, commandRequest);
  const afterThrowingCallback = portApi.consumeRuntimeComponentCommandHostRequestForAdapterBridge(
    thrownNormalizedRequest,
    throwingPorts,
  );
  if (
    !isDeepStrictEqual(plainData(unconsumedResult), { status: "succeeded" }) ||
    afterSuccessfulCallback !== false ||
    !isDeepStrictEqual(plainData(thrownResult), { status: "adapter-failed" }) ||
    afterThrowingCallback !== false
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PORT_BEHAVIOR_DRIFT",
      "Normalized command authority escaped its synchronous callback lifetime.",
      {
        unconsumedResult: plainData(unconsumedResult),
        afterSuccessfulCallback,
        thrownResult: plainData(thrownResult),
        afterThrowingCallback,
      },
    );
  }
  return Object.freeze({
    probes: 39,
    callbackCalls: calls.length,
    receiverIndependenceProbes: receivers.length,
    componentCommandPortAuthorityProbes: 4,
    normalizedCommandAuthorityProbes: 11,
    malformedResultProbes: 3,
    exactContextProbes: 1,
    standaloneJsonBoundaryProbes: 6,
    standaloneJsonAggregateNodes: Object.freeze({
      accepted: api.RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes,
      rejected: api.RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes + 1,
      scopeEnvelopeNodes: 9,
    }),
    rawAdapterFailuresExposed: false,
  });
}

function createResolutionSnapshot(api, state = {}) {
  return api.createRuntimeResolutionSnapshot({
    state,
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: {},
  });
}

function mustMountCommandEventFixture(
  api,
  catalogSet,
  {
    invoke = () => ({ status: "succeeded" }),
    validate = () => ({ status: "valid" }),
    emit = () => ({ status: "succeeded" }),
    resolveToken,
    report,
    limits,
    staticComponents = {
      map: MAP_CAPABILITY,
      field: TEXT_FIELD_CAPABILITY,
    },
    hostEvents = {
      saved: "app.saved.v1",
      audited: "app.audit.v1",
    },
  } = {},
) {
  const hostPorts = createHostPorts(api, { resolveToken, report });
  const commandEventPorts = api.createRuntimeCommandEventHostPorts({
    commands: { invoke },
    events: { validate, emit },
  });
  const mounted = api.mountRuntimeCommandEventActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    staticComponents,
    hostEvents,
    catalogSet,
    hostPorts,
    commandEventPorts,
    ...(limits === undefined ? {} : { limits }),
  });
  if (mounted.status !== "mounted") {
    fail(
      "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Command/event proof fixture did not mount.",
      { actual: plainData(mounted) },
    );
  }
  assertDeepFrozen(mounted.snapshot, "Mounted command/event snapshot");
  return {
    handle: mounted.handle,
    snapshot: mounted.snapshot,
    resolutionSnapshot: createResolutionSnapshot(api),
    commandEventPorts,
  };
}

function registerTarget(api, fixture, sourceNodeId, capabilityId, runtimeInstanceId) {
  const result = api.registerRuntimeComponentCommandTarget(fixture.handle, {
    sourceNodeId,
    capabilityId,
    runtimeInstanceId,
    snapshot: fixture.snapshot,
  });
  if (result.status === "registered") fixture.snapshot = result.snapshot;
  return result;
}

function unregisterTarget(api, fixture, ticket) {
  const result = api.unregisterRuntimeComponentCommandTarget(fixture.handle, {
    ticket,
    snapshot: fixture.snapshot,
  });
  if (result.status === "unregistered") fixture.snapshot = result.snapshot;
  return result;
}

function executeAction(api, fixture, action) {
  return api.executeRuntimeCommandEventAction(
    fixture.handle,
    action,
    fixture.resolutionSnapshot,
    fixture.snapshot,
  );
}

function probeRuntimeBehavior(api, actionInternalApi, validatorApi, catalogText) {
  const prepared = prepareCatalog(validatorApi, catalogText);
  let guardFirstProbes = 0;
  let tokenSessionProbes = 0;
  let commandAuthorizationProbes = 0;
  let eventPolicyProbes = 0;
  let targetAuthorityProbes = 0;
  let registryReadProbes = 0;
  let adapterBridgeReadProbes = 0;
  let reentryProbes = 0;
  let finiteBoundProbes = 0;
  let disposalProbes = 0;
  let hostilePayloadReads = 0;
  let falseGuardEffects = 0;
  let falseGuardDiagnosticCalls = 0;

  {
    const hostPorts = createHostPorts(api);
    const commandEventPorts = api.createRuntimeCommandEventHostPorts({
      commands: { invoke: () => ({ status: "succeeded" }) },
      events: {
        validate: () => ({ status: "valid" }),
        emit: () => ({ status: "succeeded" }),
      },
    });
    for (const limit of [
      "maxActionGeneration",
      "maxRegistrationGeneration",
      "maxSnapshotGeneration",
      "maxLiveTargets",
      "maxStaticComponents",
      "maxHostEvents",
      "maxRetainedIdentifierCodeUnits",
      "maxRuntimeInstanceIdCodeUnits",
    ]) {
      const mounted = api.mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents: { map: MAP_CAPABILITY },
        hostEvents: { saved: "app.saved.v1" },
        catalogSet: prepared.catalogSet,
        hostPorts,
        commandEventPorts,
        limits: { [limit]: null },
      });
      if (mounted.status !== "invalid" || mounted.reason !== "malformed-input") {
        fail(
          "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
          "Present null lower-only limit was defaulted as absent.",
          { limit, actual: plainData(mounted) },
        );
      }
      finiteBoundProbes += 1;
    }
  }

  {
    const hostPorts = createHostPorts(api);
    const commandEventPorts = api.createRuntimeCommandEventHostPorts({
      commands: { invoke: () => ({ status: "succeeded" }) },
      events: {
        validate: () => ({ status: "valid" }),
        emit: () => ({ status: "succeeded" }),
      },
    });
    const staticComponents = Object.fromEntries(
      Array.from({ length: 5_000 }, (_, index) => [
        `node${String(index).padStart(4, "0")}`,
        MAP_CAPABILITY,
      ]),
    );
    const atLimit = api.mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents,
      hostEvents: {},
      catalogSet: prepared.catalogSet,
      hostPorts,
      commandEventPorts,
    });
    const overLimit = api.mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: {
        ...staticComponents,
        node5000: MAP_CAPABILITY,
      },
      hostEvents: {},
      catalogSet: prepared.catalogSet,
      hostPorts,
      commandEventPorts,
    });
    let accessorReads = 0;
    const hostileMap = Object.defineProperty({}, "map", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("lowered registry limit must not observe values");
      },
    });
    const lowered = api.mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: hostileMap,
      hostEvents: {},
      catalogSet: prepared.catalogSet,
      hostPorts,
      commandEventPorts,
      limits: { maxStaticComponents: 0 },
    });
    if (
      atLimit.status !== "mounted" ||
      overLimit.status !== "invalid" ||
      overLimit.reason !== "registry-limit" ||
      lowered.status !== "invalid" ||
      lowered.reason !== "registry-limit" ||
      accessorReads !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Static component registry boundary became unreachable or observed rejected values.",
        {
          atLimit: plainData(atLimit),
          overLimit: plainData(overLimit),
          lowered: plainData(lowered),
          accessorReads,
        },
      );
    }
    api.disposeRuntimeCommandEventActions(atLimit.handle);
    finiteBoundProbes += 4;
  }

  {
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet);
    const initialSnapshot = fixture.snapshot;
    const initialRead = Reflect.apply(
      api.readRuntimeCommandEventActions,
      Object.freeze({ foreignReceiver: true }),
      [fixture.handle],
    );
    const initialBridgeRead = Reflect.apply(
      actionInternalApi.readRuntimeCommandEventActionsForAdapterBridge,
      Object.freeze({ foreignReceiver: true }),
      [fixture.handle],
    );
    const forgedRead = api.readRuntimeCommandEventActions(Object.freeze({}));
    const forgedBridgeRead = actionInternalApi.readRuntimeCommandEventActionsForAdapterBridge(
      Object.freeze({}),
    );
    if (
      initialRead.status !== "read" ||
      initialRead.snapshot !== initialSnapshot ||
      initialRead.snapshot.generation !== 0 ||
      forgedRead.status !== "invalid-handle" ||
      initialBridgeRead.status !== "read" ||
      initialBridgeRead.catalogSet !== prepared.catalogSet ||
      initialBridgeRead.commandEventPorts !== fixture.commandEventPorts ||
      initialBridgeRead.snapshot !== initialSnapshot ||
      !Object.isFrozen(initialBridgeRead) ||
      forgedBridgeRead.status !== "invalid-handle"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Callback-free registry or adapter-bridge read did not preserve exact initial authority.",
      );
    }
    adapterBridgeReadProbes += 5;
    const invalidIdentity = registerTarget(api, fixture, "map", MAP_CAPABILITY, "\ud800");
    if (
      invalidIdentity.status !== "malformed-request" ||
      fixture.snapshot !== initialSnapshot ||
      Object.keys(fixture.snapshot.liveTargets).length !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Non-canonical runtime instance identity crossed retention.",
      );
    }
    let nestedStatus = "";
    let trapped = false;
    const registration = new Proxy(
      {
        sourceNodeId: "map",
        capabilityId: MAP_CAPABILITY,
        runtimeInstanceId: "map-1",
        snapshot: fixture.snapshot,
      },
      {
        getOwnPropertyDescriptor(target, key) {
          if (key === "sourceNodeId" && !trapped) {
            trapped = true;
            nestedStatus = registerTarget(
              api,
              fixture,
              "field",
              TEXT_FIELD_CAPABILITY,
              "nested-field",
            ).status;
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      },
    );
    const first = api.registerRuntimeComponentCommandTarget(fixture.handle, registration);
    if (first.status !== "registered" || nestedStatus !== "busy") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Registration did not lock before hostile request observation.",
        { first: plainData(first), nestedStatus },
      );
    }
    fixture.snapshot = first.snapshot;
    const registeredRead = api.readRuntimeCommandEventActions(fixture.handle);
    const registeredBridgeRead = actionInternalApi.readRuntimeCommandEventActionsForAdapterBridge(
      fixture.handle,
    );
    if (
      registeredRead.status !== "read" ||
      registeredRead.snapshot !== first.snapshot ||
      registeredRead.snapshot.generation !== 1 ||
      registeredBridgeRead.status !== "read" ||
      registeredBridgeRead.catalogSet !== prepared.catalogSet ||
      registeredBridgeRead.commandEventPorts !== fixture.commandEventPorts ||
      registeredBridgeRead.snapshot !== first.snapshot
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Registry or adapter-bridge read did not publish the exact current registration snapshot.",
      );
    }
    adapterBridgeReadProbes += 2;
    const second = registerTarget(api, fixture, "map", MAP_CAPABILITY, "map-2");
    if (
      second.status !== "registered" ||
      second.registrationGeneration <= first.registrationGeneration
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Second live target did not receive a monotonic opaque generation.",
        { first: plainData(first), second: plainData(second) },
      );
    }
    let ambiguousInputReads = 0;
    const ambiguousAction = Object.defineProperty(
      { type: "component.command", target: "map", command: "fitBounds" },
      "input",
      {
        enumerable: true,
        get() {
          ambiguousInputReads += 1;
          throw new Error("ambiguous input must not be observed");
        },
      },
    );
    const ambiguous = executeAction(api, fixture, ambiguousAction);
    if (
      ambiguous.status !== "command-target-unavailable" ||
      ambiguous.reason !== "ambiguous" ||
      ambiguousInputReads !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Multiple live instances were guessed or observed command input.",
        { actual: plainData(ambiguous), ambiguousInputReads },
      );
    }
    const restored = unregisterTarget(api, fixture, second.ticket);
    if (
      restored.status !== "unregistered" ||
      fixture.snapshot.liveTargets.map?.instances.length !== 1 ||
      fixture.snapshot.liveTargets.map.instances[0]?.runtimeInstanceId !== "map-1"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Exact second-ticket removal did not restore the first unique target.",
      );
    }
    const foreignFixture = mustMountCommandEventFixture(api, prepared.catalogSet);
    const foreign = registerTarget(
      api,
      foreignFixture,
      "field",
      TEXT_FIELD_CAPABILITY,
      "field-foreign",
    );
    if (foreign.status !== "registered") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Foreign-ticket fixture did not register.",
      );
    }
    const foreignAttempt = api.unregisterRuntimeComponentCommandTarget(fixture.handle, {
      ticket: foreign.ticket,
      snapshot: fixture.snapshot,
    });
    const forgedAttempt = api.unregisterRuntimeComponentCommandTarget(fixture.handle, {
      ticket: Object.freeze({}),
      snapshot: fixture.snapshot,
    });
    if (foreignAttempt.status !== "invalid-ticket" || forgedAttempt.status !== "invalid-ticket") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Foreign or forged ticket gained unregister authority.",
      );
    }
    const removed = unregisterTarget(api, fixture, first.ticket);
    if (removed.status !== "unregistered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "First ticket did not unregister.");
    }
    const replacement = registerTarget(api, fixture, "map", MAP_CAPABILITY, "map-1");
    if (
      replacement.status !== "registered" ||
      replacement.registrationGeneration <= first.registrationGeneration
    ) {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "ABA replacement lost generation.");
    }
    const stale = api.unregisterRuntimeComponentCommandTarget(fixture.handle, {
      ticket: first.ticket,
      snapshot: fixture.snapshot,
    });
    if (
      stale.status !== "stale-ticket" ||
      fixture.snapshot.liveTargets.map?.instances[0]?.registrationGeneration !==
        replacement.registrationGeneration
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Stale ABA ticket affected the current replacement.",
      );
    }
    targetAuthorityProbes += 13;
    registryReadProbes += 4;
    reentryProbes += 1;
    api.disposeRuntimeCommandEventActions(fixture.handle);
    if (
      api.readRuntimeCommandEventActions(fixture.handle).status !== "disposed" ||
      actionInternalApi.readRuntimeCommandEventActionsForAdapterBridge(fixture.handle).status !==
        "disposed"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Disposed registry or adapter-bridge authority remained readable as live.",
      );
    }
    registryReadProbes += 1;
    adapterBridgeReadProbes += 1;
    api.disposeRuntimeCommandEventActions(foreignFixture.handle);
  }

  {
    let tokenCalls = 0;
    let commandCalls = 0;
    let reportCalls = 0;
    const commandRequests = [];
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      resolveToken(request) {
        tokenCalls += 1;
        return request.token === "shared"
          ? { status: "resolved", value: { north: 1 } }
          : { status: "missing" };
      },
      report() {
        reportCalls += 1;
      },
      invoke(request) {
        commandCalls += 1;
        commandRequests.push(request);
        return { status: "succeeded" };
      },
    });
    const registered = registerTarget(api, fixture, "map", MAP_CAPABILITY, "map-primary");
    if (registered.status !== "registered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Command fixture did not register.");
    }

    const hostileReads = {};
    const falseTarget = { when: { op: "truthy", args: [false] } };
    for (const key of ["type", "target", "command", "input", "name", "payload"]) {
      hostileReads[key] = 0;
      Object.defineProperty(falseTarget, key, {
        enumerable: true,
        get() {
          hostileReads[key] += 1;
          throw new Error(`false guard observed ${key}`);
        },
      });
    }
    const beforeFalse = { tokenCalls, commandCalls, reportCalls };
    const skipped = executeAction(api, fixture, falseTarget);
    hostilePayloadReads += Object.values(hostileReads).reduce((total, count) => total + count, 0);
    falseGuardEffects += commandCalls - beforeFalse.commandCalls;
    falseGuardDiagnosticCalls += reportCalls - beforeFalse.reportCalls;
    if (
      skipped.status !== "skipped" ||
      hostilePayloadReads !== 0 ||
      tokenCalls !== beforeFalse.tokenCalls ||
      falseGuardEffects !== 0 ||
      falseGuardDiagnosticCalls !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "False guard observed action-specific data or host authority.",
      );
    }
    guardFirstProbes += 7;

    const succeeded = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: { $token: "shared" } },
      when: { op: "truthy", args: [{ $token: "shared" }] },
    });
    if (
      succeeded.status !== "command-succeeded" ||
      tokenCalls !== 1 ||
      commandCalls !== 1 ||
      commandRequests[0]?.capabilityId !== MAP_CAPABILITY ||
      commandRequests[0]?.runtimeInstanceId !== "map-primary" ||
      commandRequests[0]?.command !== "fitBounds" ||
      !isDeepStrictEqual(plainData(commandRequests[0]?.input), {
        bounds: { north: 1 },
      })
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Command did not share one token session or delegate exact validated identity.",
        { succeeded: plainData(succeeded), tokenCalls, commandCalls },
      );
    }
    tokenSessionProbes += 3;
    commandAuthorizationProbes += 5;

    const invalid = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: "invalid" },
    });
    if (
      invalid.status !== "command-input-rejected" ||
      invalid.diagnostics.some(({ code }) => code !== "COMMAND_INPUT_INVALID") ||
      commandCalls !== 1
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Invalid command input crossed the command effect boundary.",
        { actual: plainData(invalid), commandCalls },
      );
    }
    let undeclaredInputReads = 0;
    const undeclaredAction = Object.defineProperty(
      { type: "component.command", target: "map", command: "teleport" },
      "input",
      {
        enumerable: true,
        get() {
          undeclaredInputReads += 1;
          throw new Error("undeclared input must not be read");
        },
      },
    );
    const undeclared = executeAction(api, fixture, undeclaredAction);
    if (
      undeclared.status !== "unknown-command" ||
      undeclared.diagnostics[0]?.code !== "UNKNOWN_COMMAND" ||
      undeclaredInputReads !== 0 ||
      commandCalls !== 1
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Undeclared command observed input or delegated.",
      );
    }
    let unknownCommandReads = 0;
    const unknownTarget = Object.defineProperty(
      { type: "component.command", target: "missing" },
      "command",
      {
        enumerable: true,
        get() {
          unknownCommandReads += 1;
          throw new Error("unknown target command must not be read");
        },
      },
    );
    const unknown = executeAction(api, fixture, unknownTarget);
    if (
      unknown.status !== "unknown-command-target" ||
      unknown.diagnostics[0]?.code !== "UNKNOWN_COMMAND" ||
      Object.hasOwn(unknown, "command") ||
      unknownCommandReads !== 0 ||
      commandCalls !== 1
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Unknown static target observed command data or delegated.",
      );
    }
    commandAuthorizationProbes += 8;

    const ticket = registered.ticket;
    const unregistered = unregisterTarget(api, fixture, ticket);
    if (unregistered.status !== "unregistered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Command target did not unregister.");
    }
    let unmountedInputReads = 0;
    const unmountedAction = Object.defineProperty(
      { type: "component.command", target: "map", command: "fitBounds" },
      "input",
      {
        enumerable: true,
        get() {
          unmountedInputReads += 1;
          throw new Error("unmounted input must not be read");
        },
      },
    );
    const unmounted = executeAction(api, fixture, unmountedAction);
    if (
      unmounted.status !== "command-target-unavailable" ||
      unmounted.reason !== "unmounted" ||
      unmountedInputReads !== 0 ||
      commandCalls !== 1
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Unmounted command target observed input or delegated.",
      );
    }
    commandAuthorizationProbes += 4;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    const sequence = [];
    const requests = [];
    let tokenCalls = 0;
    let mode = "valid";
    let nestedValidationStatus = "";
    let fixture;
    fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      resolveToken(request) {
        tokenCalls += 1;
        return request.token === "event-shared"
          ? { status: "resolved", value: { itemId: "item-1" } }
          : { status: "missing" };
      },
      validate(request) {
        sequence.push("validate");
        requests.push(request);
        nestedValidationStatus = executeAction(api, fixture, {
          type: "event.emit",
          name: "saved",
        }).status;
        if (mode === "throw") throw new Error("private-event-validator");
        return mode === "invalid" ? { status: "invalid" } : { status: "valid" };
      },
      emit(request) {
        sequence.push("emit");
        requests.push(request);
        return mode === "deny" ? { status: "denied" } : { status: "succeeded" };
      },
    });
    for (const name of ["\ud800", "\udc00"]) {
      const malformedName = executeAction(api, fixture, {
        type: "event.emit",
        name,
      });
      const publicText = JSON.stringify(plainData(malformedName));
      if (
        malformedName.status !== "invalid-action" ||
        publicText.includes("\\ud800") ||
        publicText.includes("\\udc00") ||
        sequence.length !== 0
      ) {
        fail(
          "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
          "Non-canonical event name crossed allowlist lookup or public diagnostics.",
        );
      }
      eventPolicyProbes += 1;
    }
    let unknownPayloadReads = 0;
    const unknownEvent = Object.defineProperty(
      { type: "event.emit", name: "not-allowlisted" },
      "payload",
      {
        enumerable: true,
        get() {
          unknownPayloadReads += 1;
          throw new Error("unknown event payload must not be read");
        },
      },
    );
    const unknown = executeAction(api, fixture, unknownEvent);
    if (
      unknown.status !== "host-event-not-allowlisted" ||
      unknownPayloadReads !== 0 ||
      sequence.length !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Unknown host event observed payload or crossed a callback.",
      );
    }
    eventPolicyProbes += 3;

    const emitted = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
      payload: { detail: { $token: "event-shared" } },
      when: { op: "truthy", args: [{ $token: "event-shared" }] },
    });
    if (
      emitted.status !== "event-emitted" ||
      tokenCalls !== 1 ||
      !isDeepStrictEqual(sequence, ["validate", "emit"]) ||
      nestedValidationStatus !== "busy" ||
      requests[0]?.contractId !== "app.saved.v1" ||
      requests[0]?.name !== "saved" ||
      !isDeepStrictEqual(plainData(requests[0]?.payload), {
        detail: { itemId: "item-1" },
      })
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Allowlisted event lost shared token session, exact contract, or validation order.",
        { actual: plainData(emitted), sequence, tokenCalls, nestedValidationStatus },
      );
    }
    tokenSessionProbes += 2;
    eventPolicyProbes += 6;
    reentryProbes += 1;

    sequence.length = 0;
    mode = "invalid";
    const invalid = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
      payload: { itemId: "bad" },
    });
    if (
      invalid.status !== "host-event-payload-invalid" ||
      typeof invalid.requestId !== "string" ||
      !isDeepStrictEqual(sequence, ["validate"])
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Invalid host event payload crossed emission.",
      );
    }
    sequence.length = 0;
    mode = "deny";
    const denied = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    if (denied.status !== "event-denied" || !isDeepStrictEqual(sequence, ["validate", "emit"])) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Host event denial was fabricated as success.",
      );
    }
    sequence.length = 0;
    mode = "throw";
    const failed = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    if (
      failed.status !== "adapter-failed" ||
      sequence[0] !== "validate" ||
      sequence.includes("emit") ||
      JSON.stringify(plainData(failed)).includes("private-event-validator")
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Event validator failure was not redacted or prevented emission.",
      );
    }
    eventPolicyProbes += 7;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    let commandCalls = 0;
    let nestedCommandStatus = "";
    let fixture;
    fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      invoke() {
        commandCalls += 1;
        nestedCommandStatus = executeAction(api, fixture, {
          type: "event.emit",
          name: "saved",
        }).status;
        api.disposeRuntimeCommandEventActions(fixture.handle);
        return { status: "succeeded" };
      },
    });
    const registered = registerTarget(api, fixture, "map", MAP_CAPABILITY, "reentry-map");
    if (registered.status !== "registered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Reentry fixture did not register.");
    }
    const outer = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: {} },
    });
    if (
      outer.status !== "disposed" ||
      nestedCommandStatus !== "busy" ||
      commandCalls !== 1 ||
      executeAction(api, fixture, {
        type: "event.emit",
        name: "saved",
      }).status !== "disposed"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Post-command reentry duplicated an effect or let success override disposal.",
      );
    }
    reentryProbes += 3;
    disposalProbes += 1;
  }

  for (const outcome of ["succeeded", "denied", "malformed"]) {
    let fixture;
    fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      invoke() {
        api.disposeRuntimeCommandEventActions(fixture.handle);
        return outcome === "malformed" ? { status: "unexpected" } : { status: outcome };
      },
    });
    const registered = registerTarget(
      api,
      fixture,
      "map",
      MAP_CAPABILITY,
      `post-command-${outcome}`,
    );
    if (registered.status !== "registered") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Post-command lifetime fixture did not register.",
      );
    }
    const result = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: {} },
    });
    if (result.status !== "disposed") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Command callback result overrode callback-driven disposal.",
        { outcome, actual: plainData(result) },
      );
    }
    reentryProbes += 1;
    disposalProbes += 1;
  }

  for (const outcome of ["valid", "invalid", "malformed"]) {
    let emissions = 0;
    let fixture;
    fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      validate() {
        api.disposeRuntimeCommandEventActions(fixture.handle);
        return outcome === "malformed" ? { status: "unexpected" } : { status: outcome };
      },
      emit() {
        emissions += 1;
        return { status: "succeeded" };
      },
    });
    const result = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    if (result.status !== "disposed" || emissions !== 0) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Event validation result overrode disposal or crossed emission.",
        { outcome, actual: plainData(result), emissions },
      );
    }
    reentryProbes += 1;
    disposalProbes += 1;
  }

  for (const outcome of ["succeeded", "denied", "malformed"]) {
    let fixture;
    fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      emit() {
        api.disposeRuntimeCommandEventActions(fixture.handle);
        return outcome === "malformed" ? { status: "unexpected" } : { status: outcome };
      },
    });
    const result = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    if (result.status !== "disposed") {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Event emission result overrode callback-driven disposal.",
        { outcome, actual: plainData(result) },
      );
    }
    reentryProbes += 1;
    disposalProbes += 1;
  }

  {
    let commandCalls = 0;
    const privateText = "private-command-adapter-stack";
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      invoke() {
        commandCalls += 1;
        throw new Error(privateText);
      },
    });
    const registered = registerTarget(api, fixture, "map", MAP_CAPABILITY, "throwing-map");
    if (registered.status !== "registered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Throwing fixture did not register.");
    }
    const failed = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: {} },
    });
    if (
      failed.status !== "adapter-failed" ||
      commandCalls !== 1 ||
      JSON.stringify(plainData(failed)).includes(privateText)
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Raw command adapter failure crossed the runtime boundary.",
      );
    }
    commandAuthorizationProbes += 2;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      limits: {
        maxSnapshotGeneration: 1,
        maxRegistrationGeneration: 0,
        maxLiveTargets: 1,
      },
    });
    const blocked = registerTarget(api, fixture, "map", MAP_CAPABILITY, "blocked-map");
    const after = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: {} },
    });
    if (
      blocked.status !== "snapshot-limit" ||
      fixture.snapshot.generation !== 0 ||
      Object.keys(fixture.snapshot.liveTargets).length !== 0 ||
      after.status !== "command-target-unavailable" ||
      after.reason !== "unmounted"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Snapshot preflight created partial registration state.",
      );
    }
    finiteBoundProbes += 5;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      limits: {
        maxSnapshotGeneration: 2,
        maxRegistrationGeneration: 1,
        maxLiveTargets: 2,
      },
    });
    const first = registerTarget(api, fixture, "map", MAP_CAPABILITY, "reserved-map-1");
    const second = registerTarget(api, fixture, "map", MAP_CAPABILITY, "reserved-map-2");
    const stillUnique = executeAction(api, fixture, {
      type: "component.command",
      target: "map",
      command: "fitBounds",
      input: { bounds: {} },
    });
    const removed =
      first.status === "registered" ? unregisterTarget(api, fixture, first.ticket) : first;
    if (
      first.status !== "registered" ||
      second.status !== "snapshot-limit" ||
      fixture.snapshot.generation !== 2 ||
      stillUnique.status !== "command-succeeded" ||
      stillUnique.runtimeInstanceId !== "reserved-map-1" ||
      removed.status !== "unregistered" ||
      Object.keys(fixture.snapshot.liveTargets).length !== 0
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Registration failed to reserve one unregister transition per live ticket.",
        {
          first: plainData(first),
          second: plainData(second),
          stillUnique: plainData(stillUnique),
          removed: plainData(removed),
        },
      );
    }
    finiteBoundProbes += 7;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet, {
      limits: {
        maxActionGeneration: 0,
        maxLiveTargets: 1,
        maxRegistrationGeneration: 0,
        maxSnapshotGeneration: 2,
      },
    });
    const first = registerTarget(api, fixture, "map", MAP_CAPABILITY, "bounded-map");
    const liveLimit = registerTarget(api, fixture, "field", TEXT_FIELD_CAPABILITY, "bounded-field");
    const skipped = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
      when: { op: "truthy", args: [false] },
    });
    const accepted = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    const actionLimit = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    const removed =
      first.status === "registered" ? unregisterTarget(api, fixture, first.ticket) : first;
    const registrationLimit = registerTarget(
      api,
      fixture,
      "map",
      MAP_CAPABILITY,
      "bounded-map-next",
    );
    if (
      first.status !== "registered" ||
      liveLimit.status !== "registry-limit" ||
      skipped.status !== "skipped" ||
      accepted.status !== "event-emitted" ||
      actionLimit.status !== "action-limit" ||
      removed.status !== "unregistered" ||
      registrationLimit.status !== "registration-limit"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Lowered finite registration or request ceilings changed.",
        {
          first: plainData(first),
          liveLimit: plainData(liveLimit),
          skipped: plainData(skipped),
          accepted: plainData(accepted),
          actionLimit: plainData(actionLimit),
          removed: plainData(removed),
          registrationLimit: plainData(registrationLimit),
        },
      );
    }
    finiteBoundProbes += 7;
    api.disposeRuntimeCommandEventActions(fixture.handle);
  }

  {
    const fixture = mustMountCommandEventFixture(api, prepared.catalogSet);
    const first = registerTarget(api, fixture, "map", MAP_CAPABILITY, "dispose-map");
    const second = registerTarget(api, fixture, "field", TEXT_FIELD_CAPABILITY, "dispose-field");
    if (first.status !== "registered" || second.status !== "registered") {
      fail("COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Disposal fixture did not register.");
    }
    const disposed = api.disposeRuntimeCommandEventActions(fixture.handle);
    const repeated = api.disposeRuntimeCommandEventActions(fixture.handle);
    const lateUnregister = api.unregisterRuntimeComponentCommandTarget(fixture.handle, {
      ticket: first.ticket,
      snapshot: fixture.snapshot,
    });
    const lateRegister = registerTarget(api, fixture, "map", MAP_CAPABILITY, "late-map");
    const lateExecute = executeAction(api, fixture, {
      type: "event.emit",
      name: "saved",
    });
    if (
      disposed.status !== "disposed" ||
      disposed.disposedTargets !== 2 ||
      repeated.status !== "already-disposed" ||
      lateUnregister.status !== "disposed" ||
      lateRegister.status !== "disposed" ||
      lateExecute.status !== "disposed"
    ) {
      fail(
        "COMMAND_EVENT_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Terminal disposal retained revivable target authority.",
      );
    }
    disposalProbes += 6;
  }

  return Object.freeze({
    catalogParity: prepared.parity,
    guardFirstProbes,
    tokenSessionProbes,
    commandAuthorizationProbes,
    eventPolicyProbes,
    targetAuthorityProbes,
    registryReadProbes,
    adapterBridgeReadProbes,
    reentryProbes,
    finiteBoundProbes,
    disposalProbes,
    hostilePayloadReads,
    falseGuardEffects,
    falseGuardDiagnosticCalls,
    rawHostFailuresExposed: false,
    platformEffects: 0,
  });
}

async function verifyPrerequisite(prerequisite, injectedBytes) {
  const bytes =
    injectedBytes === undefined
      ? await readWorkspaceBytes(prerequisite.path)
      : Buffer.from(injectedBytes);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== prerequisite.sha256) {
    fail(
      "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
      `${prerequisite.task} prerequisite hash changed.`,
      {
        task: prerequisite.task,
        expectedSha256: prerequisite.sha256,
        actualSha256,
      },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
      `${prerequisite.task} prerequisite is not JSON.`,
    );
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== prerequisite.task ||
    artifact.result !== "PASS"
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PREREQUISITE_DRIFT",
      `${prerequisite.task} prerequisite identity changed.`,
    );
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
        fail("COMMAND_EVENT_ACTION_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "COMMAND_EVENT_ACTION_TRACE_DRIFT",
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

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_MISSING", "M04-T12 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE", "M04-T12 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/**
 * Builds deterministic M04-T12 evidence from exact prerequisites, distribution, hostile runtime
 * probes, static Catalog authority, tests, trace/normative ownership, documentation, and bytes.
 */
export async function buildRuntimeCoreCommandEventActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    stateNavigation,
    interactionContracts,
    executionContracts,
    portsSourceText,
    actionsSourceText,
    portsDeclarationText,
    actionsDeclarationText,
    portsBuiltJavaScript,
    actionsBuiltJavaScript,
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
      INTERACTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.interactionContracts,
    ),
    verifyPrerequisite(
      EXECUTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.executionContracts,
    ),
    readWorkspaceText("packages/runtime-core/src/command-event-ports.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/command-event-actions.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/command-event-ports.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/command-event-actions.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/command-event-ports.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/command-event-actions.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/command-event-actions.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/command-event-actions.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-command-event-actions.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimeManifestText);
    trace = JSON.parse(traceText);
  } catch {
    fail(
      "COMMAND_EVENT_ACTION_METADATA_INVALID",
      "Runtime package or trace metadata is not valid JSON.",
    );
  }

  const sourceInvariants = Object.freeze({
    ports: verifyPortsSourceInvariants(portsSourceText),
    actions: verifyActionsSourceInvariants(actionsSourceText),
  });
  const publicApi = verifyApi({
    portsSourceText,
    actionsSourceText,
    portsDeclarationText,
    actionsDeclarationText,
    portsBuiltJavaScript,
    actionsBuiltJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const tests = verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest);
  const traceRules = verifyTrace(trace);
  const normative = verifyNormativeCoverage(normativeText);
  const documentation = verifyDocumentation(findings, proofDocument);
  const [runtimeApi, runtimePortApi, runtimeActionInternalApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.runtimePortApi ?? import(RUNTIME_PORT_INTERNAL_API_URL.href),
    normalized.runtimeActionInternalApi ?? import(RUNTIME_ACTION_INTERNAL_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const ports = probePortBehavior(runtimeApi, runtimePortApi);
  const runtime = probeRuntimeBehavior(
    runtimeApi,
    runtimeActionInternalApi,
    validatorApi,
    catalogText,
  );

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T12",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Guarded component commands dispatch only to one exact live Catalog-authorized target with schema-valid input, while outbound host events cross distinct allowlist, validation, and emission stages.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([
        Object.freeze({ id: "N-031", from: "PLANNED", to: "TESTED" }),
      ]),
    }),
    prerequisites: Object.freeze([stateNavigation, interactionContracts, executionContracts]),
    publicApi,
    sourceInvariants,
    ports,
    runtime,
    semantics: Object.freeze({
      actionCardinality: "exactly one component.command or event.emit action",
      guardOrdering: "guard before discriminator and every action-specific observation",
      falseGuard:
        "zero target/payload reads, token lookups, bridge effects, and diagnostic reports",
      tokenSession:
        "true guard and named command input or event payload share one detached action-local cache",
      commandAuthority:
        "exact static node capability plus non-vacuous Catalog command declaration probe",
      targetLiveness:
        "zero or multiple instances unavailable; exactly one current generation dispatchable",
      registration:
        "opaque factory ticket, monotonic generation, foreign/stale/ABA rejection, atomic lock",
      commandInput: "canonical named materialization then exact component-command-input validation",
      hostEvents: "exact name-to-contract allowlist, detached payload validation, then emission",
      portGrammar:
        "receiver-independent own-data callbacks and closed synchronous redacted envelopes",
      bridgeJsonNodeBudget:
        "independent metadata/context/value capture; 4,086 null properties plus object and nine-node M04-T02 scope equals accepted 4,096, while one more is rejected",
      callbackLifetime:
        "current manager/snapshot rechecked after command, validation, emission, and diagnostics",
      finiteBounds:
        "lower-only action, registration, snapshot, registry, allowlist, and identifier ceilings",
      snapshotReservation:
        "each accepted live ticket reserves one later exact unregister transition",
      disposal: "terminal minimal manager and ticket tombstones",
      productionAdapterCommandParity: null,
      incomingAdapterEvents: null,
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
        "docs/proof/NORMATIVE-COVERAGE.md",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "production-adapter implementation of every declared command and N-034 closure (M05)",
      "incoming component and behavior events, adapter payload N-033, and D-014 (M04-T14)",
      "repeated-instance selector semantics beyond fail-closed ambiguity (M04-T14/M04-T16)",
      "ordered arrays, 64-action turn limit, settlement depth, and runner (M04-T13)",
      "reactive target lifecycle and stale asynchronous-result protection (M04-T15)",
      "full seven-namespace provenance, coordinated disposal, and trace (M04-T16)",
      "asynchronous command/event ports, retry, timeout, persistence, telemetry, and offline policy",
      "adapter rendering and platform lifecycle behavior",
      "future protocol clarification of PF-042",
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

/** Verifies tracked or injected M04-T12 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreCommandEventActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreCommandEventActionsEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_DRIFT", "M04-T12 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    internalRuntimeExports: expected.artifact.publicApi.internalRuntimeExports.length,
    internalTypeExports: expected.artifact.publicApi.internalTypeExports.length,
    tsdocDeclarations: expected.artifact.publicApi.tsdocDeclarations,
    focusedTests: expected.artifact.evidence.focusedTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    normativeTested: expected.artifact.normative.tested.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    portProbes: expected.artifact.ports.probes,
    ...expected.artifact.runtime,
  });
}

/** Atomically writes deterministic M04-T12 evidence after every proof check passes. */
export async function writeRuntimeCoreCommandEventActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreCommandEventActionsEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreCommandEventActionsEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
