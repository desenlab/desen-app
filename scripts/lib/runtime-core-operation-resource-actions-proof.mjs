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
const RUNTIME_INTERNAL_API_URL = new URL(
  "../../packages/runtime-core/dist/operation-resource-actions.js",
  import.meta.url,
);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

/** Absolute path to deterministic M04-T11 operation/resource action evidence. */
export const DEFAULT_RUNTIME_CORE_OPERATION_RESOURCE_ACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
);

const RESOURCE_LIFECYCLE_PREREQUISITE = Object.freeze({
  task: "M04-T08",
  path: "docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json",
  artifact: "runtime-core-0.1.0-resource-lifecycle.json",
  sha256: "2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82",
});
const OPERATION_LIFECYCLE_PREREQUISITE = Object.freeze({
  task: "M04-T09",
  path: "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
  artifact: "runtime-core-0.1.0-operation-lifecycle.json",
  sha256: "7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
});
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

const EXPECTED_MODULE_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS",
  "disposeRuntimeOperationResourceActions",
  "executeRuntimeOperationResourceAction",
  "finalizeRuntimeOperationActionSettlement",
  "mountRuntimeOperationResourceActions",
  "readRuntimeOperationResourceActions",
]);
const EXPECTED_MODULE_TYPE_EXPORTS = Object.freeze([
  "RuntimeDeferredActionSpec",
  "RuntimeOperationActionQueued",
  "RuntimeOperationActionSettlementDescriptor",
  "RuntimeOperationActionSettlementFinalizationResult",
  "RuntimeOperationActionSettlementTicket",
  "RuntimeOperationActionStaged",
  "RuntimeOperationActionStarted",
  "RuntimeOperationInvokeAction",
  "RuntimeOperationResourceAction",
  "RuntimeOperationResourceActionLimitProfile",
  "RuntimeOperationResourceActionResult",
  "RuntimeOperationResourceActionsDisposeResult",
  "RuntimeOperationResourceActionsHandle",
  "RuntimeOperationResourceActionsMountInput",
  "RuntimeOperationResourceActionsMountInvalidReason",
  "RuntimeOperationResourceActionsMountResult",
  "RuntimeOperationResourceActionsReadResult",
  "RuntimeResourceRefreshAction",
  "RuntimeResourceRefreshActionStarted",
]);
const EXPECTED_ROOT_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_OPERATION_RESOURCE_ACTION_LIMITS",
  "disposeRuntimeOperationResourceActions",
  "executeRuntimeOperationResourceAction",
  "mountRuntimeOperationResourceActions",
]);
const EXPECTED_ROOT_TYPE_EXPORTS = Object.freeze([
  "RuntimeDeferredActionSpec",
  "RuntimeOperationActionQueued",
  "RuntimeOperationActionSettlementDescriptor",
  "RuntimeOperationActionStaged",
  "RuntimeOperationActionStarted",
  "RuntimeOperationInvokeAction",
  "RuntimeOperationResourceAction",
  "RuntimeOperationResourceActionLimitProfile",
  "RuntimeOperationResourceActionResult",
  "RuntimeOperationResourceActionsDisposeResult",
  "RuntimeOperationResourceActionsHandle",
  "RuntimeOperationResourceActionsMountInput",
  "RuntimeOperationResourceActionsMountInvalidReason",
  "RuntimeOperationResourceActionsMountResult",
  "RuntimeResourceRefreshAction",
  "RuntimeResourceRefreshActionStarted",
]);
const EXPECTED_SOURCE_IMPORTS = Object.freeze([
  "./action-evaluation.js",
  "./host-ports.js",
  "./operation-lifecycle.js",
  "./predicate-evaluation.js",
  "./resource-lifecycle.js",
  "./runtime-json-snapshot.js",
  "./state-navigation-actions.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "@desen/protocol",
]);
const EXPECTED_FOCUSED_TESTS = 89;
const EXPECTED_COMPILER_NEGATIVE_CASES = 26;
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/operation-resource-actions.test.ts";
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-078",
    owners: Object.freeze(["M04-T09", "M04-T11", "M04-T13"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-079",
    owners: Object.freeze(["M02-T11", "M04-T08", "M04-T11"]),
  }),
]);
const FINDING_HEADING =
  "## PF-041 — Operation and resource actions require deterministic settlement ownership";
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T11",
  "`operation.invoke`",
  "`resource.refresh`",
  "false guard",
  "action-local",
  "synthetic array",
  "onSuccess",
  "onFailure",
  "opaque",
  "ticket",
  "exclusive",
  "without a receiver",
  "raw",
  "M04-T13",
  "M04-T16",
  "PF-041",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T11 operation/resource evidence",
  "builds byte-identical operation/resource evidence twice",
  "rejects stale or tampered operation/resource evidence",
  "rejects stale M04-T08 prerequisite bytes",
  "rejects stale M04-T09 prerequisite bytes",
  "rejects stale M04-T10 prerequisite bytes",
  "rejects stale M02-T11 prerequisite bytes",
  "detects guard-first hostile payload observation drift",
  "detects false-guard effect and diagnostic drift",
  "detects operation token-session and input drift",
  "detects detached settlement-handler and mapping drift",
  "detects raw host and private lease leakage",
  "detects acknowledgement gate and ticket-finalization drift",
  "detects resource refresh snapshot and nonblocking drift",
  "detects callback-free compositor read drift",
  "detects exclusive ownership and disposal drift",
  "detects task-owned byte drift",
  "detects semantic source ordering drift",
  "detects public export, TSDoc, internal non-leak, and platform drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/operation-resource-actions.ts",
  "packages/runtime-core/test/operation-resource-actions.test.ts",
  "packages/runtime-core/test/operation-resource-actions.types.ts",
  "packages/runtime-core/dist/operation-resource-actions.js",
  "packages/runtime-core/dist/operation-resource-actions.js.map",
  "packages/runtime-core/dist/operation-resource-actions.d.ts",
  "packages/runtime-core/dist/operation-resource-actions.d.ts.map",
  "scripts/lib/runtime-core-operation-resource-actions-proof.mjs",
  "scripts/generate-runtime-core-operation-resource-actions-proof.mjs",
  "scripts/verify-runtime-core-operation-resource-actions.mjs",
  "tests/runtime-core-operation-resource-actions.test.mjs",
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

/** Stable failure used by deterministic M04-T11 evidence and hostile mutation tests. */
export class RuntimeCoreOperationResourceActionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreOperationResourceActionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreOperationResourceActionsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail(
      "OPERATION_RESOURCE_ACTION_EVIDENCE_OPTIONS_INVALID",
      "Evidence options must be an object.",
    );
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
    fail("OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT", `${label} is not deeply frozen.`);
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
        "OPERATION_RESOURCE_ACTION_IMPORT_BOUNDARY_DRIFT",
        "Action imports must use literal module names.",
      );
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(
  parsed,
  code = "OPERATION_RESOURCE_ACTION_PLATFORM_BOUNDARY_DRIFT",
) {
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
    fail(code, "Operation/resource actions crossed the platform-neutral boundary.", {
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
      statement.moduleSpecifier.text !== "./operation-resource-actions.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased operation/resource action exports.`,
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

function normalizeSource(sourceText) {
  return sourceText.replaceAll(/\s+/gu, " ");
}

function positionOf(normalized, marker, code = "OPERATION_RESOURCE_ACTION_SOURCE_SEMANTIC_DRIFT") {
  const index = normalized.indexOf(marker);
  if (index < 0) {
    fail(code, `Operation/resource implementation is missing reviewed invariant: ${marker}`);
  }
  return index;
}

function assertOrder(
  normalized,
  markers,
  label,
  code = "OPERATION_RESOURCE_ACTION_SOURCE_SEMANTIC_DRIFT",
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

function functionSource(parsed, name, code = "OPERATION_RESOURCE_ACTION_SOURCE_SEMANTIC_DRIFT") {
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
  fail("OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "operation-resource-actions.test.ts");
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
            "OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT",
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
          "OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT",
          "Focused action tests cannot be skipped.",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail("OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT", "Focused action titles must be unique.");
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("OPERATION_RESOURCE_ACTION_TEST_INVENTORY_DRIFT", "Focused case count changed.", {
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
    fail("OPERATION_RESOURCE_ACTION_TYPE_TEST_DRIFT", "Type evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("OPERATION_RESOURCE_ACTION_TYPE_TEST_DRIFT", "Compiler-negative inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-operation-resource-actions.test.mjs",
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
        fail("OPERATION_RESOURCE_ACTION_ROOT_TEST_DRIFT", "Root action tests cannot be skipped.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "OPERATION_RESOURCE_ACTION_ROOT_TEST_DRIFT",
    "Root action mutation titles",
  );
  return Object.freeze(titles);
}

async function verifyPrerequisite(prerequisite, injectedBytes) {
  const bytes =
    injectedBytes === undefined
      ? await readWorkspaceBytes(prerequisite.path)
      : Buffer.from(injectedBytes);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== prerequisite.sha256) {
    fail(
      "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
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
      "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
      `${prerequisite.task} prerequisite is not JSON.`,
    );
  }
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== prerequisite.task ||
    artifact.result !== "PASS"
  ) {
    fail(
      "OPERATION_RESOURCE_ACTION_PREREQUISITE_DRIFT",
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
        fail("OPERATION_RESOURCE_ACTION_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "OPERATION_RESOURCE_ACTION_TRACE_DRIFT",
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
  if (start < 0) fail("OPERATION_RESOURCE_ACTION_FINDING_DRIFT", `${heading} is missing.`);
  const next = findings.indexOf("\n## PF-", start + heading.length);
  return findings.slice(start, next < 0 ? findings.length : next);
}

function verifyDocumentation(findings, proofDocument) {
  const section = findingSection(findings, FINDING_HEADING);
  if (!section.includes("- Status: OPEN") || !section.includes("- Blocks proof: No")) {
    fail("OPERATION_RESOURCE_ACTION_FINDING_DRIFT", "PF-041 must remain OPEN and non-blocking.");
  }
  const relatedOpenFindings = ["PF-014", "PF-020", "PF-022", "PF-031", "PF-039", "PF-040"];
  for (const related of relatedOpenFindings) {
    const relatedSection = findingSection(findings, `## ${related} —`);
    if (!relatedSection.includes("- Status: OPEN")) {
      fail("OPERATION_RESOURCE_ACTION_FINDING_DRIFT", `${related} must remain OPEN.`);
    }
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail(
        "OPERATION_RESOURCE_ACTION_PROOF_DOCUMENT_DRIFT",
        `M04-T11 proof is missing: ${required}`,
      );
    }
  }
  return Object.freeze({
    finding: "PF-041",
    findingStatus: "OPEN",
    relatedOpenFindings: Object.freeze(relatedOpenFindings),
    proofDocument: "docs/proof/RUNTIME-CORE-OPERATION-RESOURCE-ACTIONS.md",
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

function verifySourceInvariants(sourceText) {
  const parsed = sourceFile(sourceText, "operation-resource-actions.ts");
  const normalized = normalizeSource(sourceText);
  positionOf(normalized, "const ACTION_AUTHORITIES = new WeakMap");
  positionOf(normalized, "const SETTLEMENT_TICKETS = new WeakMap");
  positionOf(normalized, "const CLAIMED_RESOURCE_HANDLES = new WeakSet");
  positionOf(normalized, "const CLAIMED_OPERATION_HANDLES = new WeakSet");
  positionOf(normalized, "RuntimeOperationActionSettlementTicket");

  const mount = functionSource(parsed, "mountRuntimeOperationResourceActions");
  assertOrder(
    mount,
    [
      "const envelope = readMountEnvelope(input);",
      "CLAIMED_RESOURCE_HANDLES.has(envelope.resourceHandle)",
      "readRuntimeSurfaceResources(",
      "readRuntimeSurfaceOperations(",
      "captureOperationInventory(",
      "createRuntimeHostPorts(",
      "const recapturedResource = readRuntimeSurfaceResources(",
      "const recapturedOperation = readRuntimeSurfaceOperations(",
      "CLAIMED_RESOURCE_HANDLES.has(envelope.resourceHandle)",
      "CLAIMED_RESOURCE_HANDLES.add(envelope.resourceHandle);",
      "CLAIMED_OPERATION_HANDLES.add(envelope.operationHandle);",
      "ACTION_AUTHORITIES.set(handle, authority);",
    ],
    "Exclusive manager mount",
  );

  const read = functionSource(parsed, "readRuntimeOperationResourceActions");
  assertOrder(
    read,
    [
      'typeof handle !== "object" || handle === null',
      "ACTION_AUTHORITIES.get(handle)",
      'authority.status !== "live"',
      "authority.transitioning || authority.reporting",
      "const current = currentSnapshots(authority);",
      'status: "invalid-authority", boundary: current.boundary',
      'status: "read"',
      "documentId: authority.documentId",
      "resourceSnapshot: current.resourceSnapshot",
      "operationSnapshot: current.operationSnapshot",
    ],
    "Callback-free compositor authority read",
  );

  const execute = functionSource(parsed, "executeRuntimeOperationResourceAction");
  assertOrder(
    execute,
    [
      "const current = currentSnapshots(authority);",
      "current.resourceSnapshot !== resourceSnapshot",
      "!resolutionSnapshotMatches(snapshot, resourceSnapshot, operationSnapshot)",
      "const requestId = nextRequestId(authority);",
      "authority.transitioning = true;",
      "createRuntimeActionEvaluationSession(",
      "captureRuntimeActionWhen(action)",
      "const afterWhen = observationFailure(",
      "evaluateRuntimeActionGuard(",
      "const afterGuard = observationFailure(",
      "if (!evaluated.value)",
      'return Object.freeze({ status: "skipped", diagnostics: guardDiagnostics });',
      "const plainAction = isPlainRecord(action);",
      'const type = ownDataValue(action, "type");',
    ],
    "Guard-first evaluation",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "operation.invoke")',
      'const alias = ownDataValue(action, "as");',
      'const operation = ownDataValue(action, "operation");',
      "const mountedOperation = authority.operations.get(alias.value);",
      "const validShape = exactAllowedKeys(",
      'const input = ownDataValue(action, "input");',
      'const concurrency = ownDataValue(action, "concurrency");',
      "const handlers = captureHandlers(action);",
      "const limit = settlementLimit(authority, handlers);",
      "const reservation = reserveHandlers(authority, handlers);",
      "materializeRuntimeActionNamedValues(session, input.value, snapshot)",
      "const beforeInvoke = observationFailure(",
      "const invoked = invokeRuntimeOperation(",
      'invoked.status === "started"',
      "authority.nextActionGeneration += 1;",
      "mapOperationSettlement(",
      "releaseReservation(authority, reservation);",
      "const afterInvoke = observationFailure(",
    ],
    "Reserved operation invocation and accepted-effect precedence",
  );
  assertOrder(
    execute,
    [
      'if (type.value === "resource.refresh")',
      'const resource = ownDataValue(action, "resource");',
      "if (!authority.resources.has(resource.value))",
      "const validShape = exactAllowedKeys(",
      "const beforeRefresh = observationFailure(",
      "const refreshed = refreshRuntimeSurfaceResource(",
      'if (refreshed.status === "started")',
      "authority.nextActionGeneration += 1;",
      "const afterRefresh = observationFailure(",
    ],
    "Current resource refresh and accepted-effect precedence",
  );

  const mapping = functionSource(parsed, "mapOperationSettlement");
  assertOrder(
    mapping,
    [
      'if (authority.status !== "live")',
      "readRuntimeSurfaceOperations(authority.operationHandle)",
      'if (settlement.status === "superseded")',
      'if (settlement.status === "disposed")',
      'settlement.status === "succeeded" ? handlers.onSuccess : handlers.onFailure',
      "const ticket = createSettlementTicket(",
      'if (settlement.status === "succeeded")',
      'if (settlement.status === "failed")',
    ],
    "Detached settlement mapping",
  );

  const finalize = functionSource(parsed, "finalizeRuntimeOperationActionSettlement");
  assertOrder(
    finalize,
    [
      "const ticketAuthority = SETTLEMENT_TICKETS.get(ticket);",
      'if ("status" in ticketAuthority)',
      'if (owner.status !== "live")',
      "owner.transitioning = true;",
      "acknowledgeRuntimeOperationSettlement(",
      'if (acknowledged.status === "acknowledged")',
      "releaseReservation(owner, ticketAuthority.reservation);",
      'Object.freeze({ status: "finalized", ownerKey: owner.ownerKey })',
    ],
    "Private one-shot settlement finalization",
  );

  const dispose = functionSource(parsed, "disposeRuntimeOperationResourceActions");
  assertOrder(
    dispose,
    [
      'authority.status = "revoked";',
      "releaseAllReservations(authority);",
      "disposeRuntimeSurfaceOperations(authority.operationHandle);",
      "disposeRuntimeSurfaceResources(authority.resourceHandle);",
      'Object.freeze({ status: "disposed", ownerKey: authority.ownerKey })',
    ],
    "Exclusive underlying disposal",
  );
}

function verifyApi({
  sourceText,
  declarationText,
  builtJavaScript,
  sourceIndexText,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = exportedDeclarations(sourceText, "operation-resource-actions.ts");
  assertDirectExports(
    source,
    "OPERATION_RESOURCE_ACTION_SOURCE_EXPORT_DRIFT",
    "Operation/resource action source",
  );
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_MODULE_RUNTIME_EXPORTS,
    "OPERATION_RESOURCE_ACTION_SOURCE_EXPORT_DRIFT",
    "Module runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_MODULE_TYPE_EXPORTS,
    "OPERATION_RESOURCE_ACTION_SOURCE_EXPORT_DRIFT",
    "Module type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail(
      "OPERATION_RESOURCE_ACTION_TSDOC_MISSING",
      "Every exported operation/resource action declaration requires TSDoc.",
      { missing: source.missingTsdoc },
    );
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_SOURCE_IMPORTS,
    "OPERATION_RESOURCE_ACTION_IMPORT_BOUNDARY_DRIFT",
    "Action source imports",
  );
  verifyPlatformBoundary(source.sourceFile);
  verifySourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "operation-resource-actions.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(
    declaration,
    "OPERATION_RESOURCE_ACTION_DECLARATION_DRIFT",
    "Operation/resource action declaration",
  );
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_MODULE_RUNTIME_EXPORTS,
    "OPERATION_RESOURCE_ACTION_DECLARATION_DRIFT",
    "Built module runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_MODULE_TYPE_EXPORTS,
    "OPERATION_RESOURCE_ACTION_DECLARATION_DRIFT",
    "Built module type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail(
      "OPERATION_RESOURCE_ACTION_DECLARATION_DRIFT",
      "Built operation/resource action declarations lost TSDoc.",
      { missing: declaration.missingTsdoc },
    );
  }
  verifyPlatformBoundary(declaration.sourceFile, "OPERATION_RESOURCE_ACTION_DECLARATION_DRIFT");

  const built = exportedDeclarations(
    builtJavaScript,
    "operation-resource-actions.js",
    ts.ScriptKind.JS,
  );
  assertDirectExports(
    built,
    "OPERATION_RESOURCE_ACTION_DISTRIBUTION_DRIFT",
    "Built operation/resource action JavaScript",
  );
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_MODULE_RUNTIME_EXPORTS,
    "OPERATION_RESOURCE_ACTION_DISTRIBUTION_DRIFT",
    "Built module JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "OPERATION_RESOURCE_ACTION_DISTRIBUTION_DRIFT",
    "Built module JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "OPERATION_RESOURCE_ACTION_DISTRIBUTION_DRIFT");

  for (const [text, fileName, expectedTypes] of [
    [sourceIndexText, "src/index.ts", EXPECTED_ROOT_TYPE_EXPORTS],
    [builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_ROOT_TYPE_EXPORTS],
    [builtIndexJavaScript, "dist/index.js", []],
  ]) {
    const exports = moduleIndexExports(text, fileName);
    assertArrayEqual(
      exports.runtimeExports,
      EXPECTED_ROOT_RUNTIME_EXPORTS,
      "OPERATION_RESOURCE_ACTION_INDEX_EXPORT_DRIFT",
      `${fileName} operation/resource runtime exports`,
    );
    assertArrayEqual(
      exports.typeExports,
      expectedTypes,
      "OPERATION_RESOURCE_ACTION_INDEX_EXPORT_DRIFT",
      `${fileName} operation/resource type exports`,
    );
  }

  const internalRuntime = EXPECTED_MODULE_RUNTIME_EXPORTS.filter(
    (name) => !EXPECTED_ROOT_RUNTIME_EXPORTS.includes(name),
  );
  const internalTypes = EXPECTED_MODULE_TYPE_EXPORTS.filter(
    (name) => !EXPECTED_ROOT_TYPE_EXPORTS.includes(name),
  );
  for (const [text, fileName] of [
    [sourceIndexText, "src/index.ts"],
    [builtIndexDeclarationText, "dist/index.d.ts"],
    [builtIndexJavaScript, "dist/index.js"],
  ]) {
    const references = moduleReferences(text, fileName, "./operation-resource-actions.js").join(
      " ",
    );
    for (const internal of [...internalRuntime, ...internalTypes]) {
      if (references.includes(internal)) {
        fail(
          "OPERATION_RESOURCE_ACTION_INTERNAL_LEAK",
          `${fileName} leaked package-internal settlement authority ${internal}.`,
        );
      }
    }
  }

  return Object.freeze({
    moduleRuntimeExports: EXPECTED_MODULE_RUNTIME_EXPORTS,
    moduleTypeExports: EXPECTED_MODULE_TYPE_EXPORTS,
    runtimeExports: EXPECTED_ROOT_RUNTIME_EXPORTS,
    typeExports: EXPECTED_ROOT_TYPE_EXPORTS,
    tsdocDeclarations: source.runtimeExports.length + source.typeExports.length,
    sourceImports: EXPECTED_SOURCE_IMPORTS,
    internalRuntimeExports: Object.freeze(internalRuntime),
    internalTypeExports: Object.freeze(internalTypes),
  });
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  if (
    runtimeManifest.scripts?.["test:operation-resource-actions"] !== EXPECTED_PACKAGE_TEST_SCRIPT
  ) {
    fail(
      "OPERATION_RESOURCE_ACTION_PACKAGE_WIRING_DRIFT",
      "The runtime package operation/resource action command changed or is absent.",
    );
  }
  return Object.freeze({
    focused: collectFocusedTests(packageTests),
    compilerNegativeLabels: compilerNegativeInventory(typeTests),
    rootTitles: rootTestInventory(rootTests),
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function prepareCatalog(validatorApi, catalogText) {
  let catalog;
  try {
    catalog = JSON.parse(catalogText);
  } catch {
    fail(
      "OPERATION_RESOURCE_ACTION_CATALOG_FIXTURE_DRIFT",
      "The frozen web Catalog fixture is invalid JSON.",
    );
  }
  const result = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  if (!result.valid) {
    fail(
      "OPERATION_RESOURCE_ACTION_CATALOG_FIXTURE_DRIFT",
      "The action proof Catalog no longer prepares.",
      { diagnostics: plainData(result.diagnostics) },
    );
  }
  return result.value;
}

const DOCUMENT_ID = "https://desen.app/kanıt/操作-资源";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "proof-surface";
const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";
const VALID_OUTPUT = Object.freeze({ userId: "user-1" });

function createHostPorts(
  api,
  {
    invoke = () => ({ status: "succeeded", value: VALID_OUTPUT }),
    load = () => ({ status: "succeeded", value: { items: [], bounds: {} } }),
    resolveToken = () => ({ status: "missing" }),
    report = () => undefined,
  } = {},
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
          activeRevision: REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: { invoke },
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

function mustMountPrimitive(api, catalogSet, hostPorts, limits = undefined) {
  const resource = api.mountRuntimeSurfaceResources({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources: {
      stores: { use: STORES, input: {}, policy: "manual" },
    },
    catalogSet,
    hostPorts,
  });
  if (resource.status !== "mounted") {
    fail("OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Resource fixture did not mount.", {
      actual: plainData(resource),
    });
  }
  const operation = api.mountRuntimeSurfaceOperations({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: { signIn: { operation: SIGN_IN } },
    catalogSet,
    hostPorts,
  });
  if (operation.status !== "mounted") {
    fail("OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT", "Operation fixture did not mount.", {
      actual: plainData(operation),
    });
  }
  const composed = api.mountRuntimeOperationResourceActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    operations: { signIn: { operation: SIGN_IN } },
    resourceHandle: resource.handle,
    resourceSnapshot: resource.snapshot,
    operationHandle: operation.handle,
    operationSnapshot: operation.snapshot,
    hostPorts,
    ...(limits === undefined ? {} : { limits }),
  });
  if (composed.status !== "mounted") {
    fail(
      "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Operation/resource action fixture did not mount.",
      { actual: plainData(composed) },
    );
  }
  return Object.freeze({ resource, operation, composed });
}

function currentPrimitiveSnapshots(api, fixture) {
  const resource = api.readRuntimeSurfaceResources(fixture.resource.handle);
  const operation = api.readRuntimeSurfaceOperations(fixture.operation.handle);
  if (resource.status !== "read" || operation.status !== "read") {
    fail(
      "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
      "Owned primitive snapshots are no longer readable.",
      { resource: plainData(resource), operation: plainData(operation) },
    );
  }
  return Object.freeze({
    resource: resource.snapshot,
    operation: operation.snapshot,
  });
}

function resolutionSnapshot(api, resourceSnapshot, operationSnapshot, state = {}) {
  return api.createRuntimeResolutionSnapshot({
    state,
    context: {},
    resource: resourceSnapshot.lifecycles,
    operation: operationSnapshot.lifecycles,
    event: { status: "unavailable" },
    item: {},
    env: {},
  });
}

function executeCurrent(api, fixture, action, state = {}) {
  const current = currentPrimitiveSnapshots(api, fixture);
  return api.executeRuntimeOperationResourceAction(
    fixture.composed.handle,
    action,
    resolutionSnapshot(api, current.resource, current.operation, state),
    current.resource,
    current.operation,
  );
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

async function probeRuntimeBehavior(api, internalApi, validatorApi, catalogText) {
  const catalogSet = prepareCatalog(validatorApi, catalogText);
  let mountProbes = 0;
  let guardFirstProbes = 0;
  let tokenSessionProbes = 0;
  let operationProbes = 0;
  let settlementProbes = 0;
  let resourceProbes = 0;
  let snapshotProbes = 0;
  let ownershipProbes = 0;
  let compositorReadProbes = 0;
  let retentionProbes = 0;
  let disposalProbes = 0;
  let receiverIndependenceProbes = 0;
  let hostilePayloadReads = 0;
  let falseGuardEffects = 0;
  let falseGuardDiagnosticCalls = 0;
  let rawHostFailuresExposed;

  {
    const hostCalls = { operation: 0, resource: 0, token: 0, diagnostic: 0 };
    const ports = createHostPorts(api, {
      invoke() {
        hostCalls.operation += 1;
        return { status: "succeeded", value: VALID_OUTPUT };
      },
      load() {
        hostCalls.resource += 1;
        return { status: "succeeded", value: { items: [], bounds: {} } };
      },
      resolveToken() {
        hostCalls.token += 1;
        return { status: "missing" };
      },
      report() {
        hostCalls.diagnostic += 1;
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    mountProbes += 3;
    assertDataEqual(
      fixture.composed.resourceSnapshot,
      fixture.resource.snapshot,
      "Composed resource mount snapshot",
    );
    assertDataEqual(
      fixture.composed.operationSnapshot,
      fixture.operation.snapshot,
      "Composed operation mount snapshot",
    );
    assertDataEqual(
      hostCalls,
      { operation: 0, resource: 0, token: 0, diagnostic: 0 },
      "Mount effects",
    );
    const currentRead = Reflect.apply(
      internalApi.readRuntimeOperationResourceActions,
      Object.freeze({ foreignReceiver: true }),
      [fixture.composed.handle],
    );
    const forgedRead = internalApi.readRuntimeOperationResourceActions(Object.freeze({}));
    if (
      currentRead.status !== "read" ||
      currentRead.documentId !== DOCUMENT_ID ||
      currentRead.revision !== REVISION ||
      currentRead.surfaceId !== SURFACE_ID ||
      currentRead.resourceSnapshot !== fixture.resource.snapshot ||
      currentRead.operationSnapshot !== fixture.operation.snapshot ||
      forgedRead.status !== "invalid-handle"
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Callback-free compositor read lost exact identity or current snapshot authority.",
      );
    }
    compositorReadProbes += 3;
    const second = api.mountRuntimeOperationResourceActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      operations: { signIn: { operation: SIGN_IN } },
      resourceHandle: fixture.resource.handle,
      resourceSnapshot: fixture.resource.snapshot,
      operationHandle: fixture.operation.handle,
      operationSnapshot: fixture.operation.snapshot,
      hostPorts: ports,
    });
    if (second.status !== "invalid" || second.reason !== "already-owned-authority") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "A second compositor claimed already-owned primitive handles.",
        { actual: plainData(second) },
      );
    }
    ownershipProbes += 1;
    assertDeepFrozen(fixture.composed, "Composed mount result");
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
    if (
      internalApi.readRuntimeOperationResourceActions(fixture.composed.handle).status !== "disposed"
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Disposed compositor remained readable as a live authority.",
      );
    }
    compositorReadProbes += 1;
  }

  {
    let payloadReads = 0;
    let operationCalls = 0;
    let resourceCalls = 0;
    let tokenCalls = 0;
    let diagnosticCalls = 0;
    const ports = createHostPorts(api, {
      invoke() {
        operationCalls += 1;
        return { status: "succeeded", value: VALID_OUTPUT };
      },
      load() {
        resourceCalls += 1;
        return { status: "succeeded", value: { items: [], bounds: {} } };
      },
      resolveToken() {
        tokenCalls += 1;
        return { status: "resolved", value: "forbidden" };
      },
      report() {
        diagnosticCalls += 1;
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const action = {};
    Object.defineProperty(action, "when", {
      value: { op: "eq", args: [false, true] },
      enumerable: true,
    });
    for (const key of [
      "type",
      "operation",
      "as",
      "input",
      "concurrency",
      "onSuccess",
      "onFailure",
      "resource",
      "extensions",
    ]) {
      Object.defineProperty(action, key, {
        enumerable: true,
        get() {
          payloadReads += 1;
          return key === "type" ? "operation.invoke" : undefined;
        },
      });
    }
    const skipped = executeCurrent(api, fixture, action);
    assertDataEqual(skipped, { status: "skipped", diagnostics: [] }, "False guarded action");
    hostilePayloadReads += payloadReads;
    falseGuardEffects += operationCalls + resourceCalls + tokenCalls;
    falseGuardDiagnosticCalls += diagnosticCalls;
    if (
      payloadReads !== 0 ||
      operationCalls !== 0 ||
      resourceCalls !== 0 ||
      tokenCalls !== 0 ||
      diagnosticCalls !== 0
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "A false guard observed payload or crossed an effect boundary.",
        { payloadReads, operationCalls, resourceCalls, tokenCalls, diagnosticCalls },
      );
    }
    guardFirstProbes += 9;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const tokenReceivers = [];
    const operationReceivers = [];
    const diagnosticReceivers = [];
    const tokenNames = [];
    const requests = [];
    const firstTransport = deferred();
    let transport = 0;
    const ports = createHostPorts(api, {
      resolveToken(request) {
        tokenReceivers.push(this);
        tokenNames.push(request.token);
        return request.token === "proof.email"
          ? { status: "resolved", value: "person@example.com" }
          : { status: "missing" };
      },
      invoke(request) {
        operationReceivers.push(this);
        requests.push(cloneJson(request));
        transport += 1;
        return transport === 1
          ? firstTransport.promise
          : { status: "succeeded", value: VALID_OUTPUT };
      },
      report() {
        diagnosticReceivers.push(this);
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const onSuccess = [{ type: "navigate", surface: "home" }];
    const onFailure = [{ type: "state.set", path: "error", value: "failed" }];
    const started = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: {
        email: { $token: "proof.email" },
        password: "secret",
      },
      when: {
        op: "eq",
        args: [{ $token: "proof.email" }, "person@example.com"],
      },
      onSuccess,
      onFailure,
    });
    if (started.status !== "operation-started") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "A valid guarded operation did not start.",
        { actual: plainData(started) },
      );
    }
    if (tokenNames.length !== 1 || tokenNames[0] !== "proof.email") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Guard and operation input did not share one token session.",
        { tokenNames },
      );
    }
    tokenSessionProbes += 3;
    operationProbes += 4;
    assertDataEqual(
      requests[0]?.input,
      { email: "person@example.com", password: "secret" },
      "Materialized operation input",
    );
    onSuccess[0].surface = "mutated";
    onFailure[0].value = "mutated";

    const queued = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "queued@example.com", password: "secret" },
      concurrency: "queue",
    });
    if (queued.status !== "operation-queued" || requests.length !== 1) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Queued operation crossed the predecessor settlement gate.",
        { actual: plainData(queued), requests: requests.length },
      );
    }
    settlementProbes += 2;
    firstTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const descriptor = await started.settlement;
    if (
      descriptor.status !== "succeeded" ||
      descriptor.actions[0]?.surface !== "home" ||
      Object.hasOwn(descriptor, "lease") ||
      Object.keys(descriptor.ticket).length !== 0
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Successful settlement mapping, handler detachment, or lease hiding changed.",
        { actual: plainData(descriptor) },
      );
    }
    assertDeepFrozen(descriptor, "Successful operation settlement descriptor");
    if (requests.length !== 1) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Settlement mapping automatically acknowledged the predecessor gate.",
      );
    }
    const finalized = internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      descriptor.ticket,
    );
    if (
      finalized.status !== "finalized" ||
      finalized.promotedRequestId !== queued.requestId ||
      requests.length !== 2
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Opaque ticket finalization did not release exactly one queued operation.",
        { actual: plainData(finalized), requests: requests.length },
      );
    }
    const finalizedAgain = internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      descriptor.ticket,
    );
    if (finalizedAgain.status !== "already-finalized") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Settlement ticket is no longer one-shot.",
        { actual: plainData(finalizedAgain) },
      );
    }
    const queuedDescriptor = await queued.settlement;
    if (queuedDescriptor.status !== "succeeded") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Promoted queued operation did not settle.",
        { actual: plainData(queuedDescriptor) },
      );
    }
    const finalizedQueued = internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      queuedDescriptor.ticket,
    );
    if (finalizedQueued.status !== "finalized") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Promoted settlement could not be finalized.",
        { actual: plainData(finalizedQueued) },
      );
    }
    settlementProbes += 8;
    receiverIndependenceProbes += 3;
    if (
      tokenReceivers.some((receiver) => receiver !== undefined) ||
      operationReceivers.some((receiver) => receiver !== undefined) ||
      diagnosticReceivers.some((receiver) => receiver !== undefined)
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "A token, operation, or diagnostic callback received a receiver.",
      );
    }
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const ports = createHostPorts(api, {
      invoke: () => ({ status: "failed", errorCode: "invalidCredentials" }),
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const failed = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
      onSuccess: [{ type: "navigate", surface: "home" }],
      onFailure: [{ type: "state.set", path: "error", value: "declared" }],
    });
    if (failed.status !== "operation-started") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Declared-failure operation did not start.",
      );
    }
    const descriptor = await failed.settlement;
    if (
      descriptor.status !== "failed" ||
      descriptor.errorCode !== "invalidCredentials" ||
      descriptor.actions[0]?.value !== "declared" ||
      Object.hasOwn(descriptor, "lease")
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Declared failure did not select the detached failure branch.",
        { actual: plainData(descriptor) },
      );
    }
    settlementProbes += 4;
    internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      descriptor.ticket,
    );
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const privateText = "private-secret-stack";
    const ports = createHostPorts(api, {
      invoke() {
        throw new Error(privateText);
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const started = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
      onFailure: [{ type: "state.set", path: "error", value: "technical" }],
    });
    if (started.status !== "operation-started") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Throwing adapter fixture did not return accepted operation work.",
      );
    }
    const descriptor = await started.settlement;
    const publicText = JSON.stringify(plainData(descriptor));
    rawHostFailuresExposed = publicText.includes(privateText);
    if (
      descriptor.status !== "adapter-failed" ||
      descriptor.actions[0]?.value !== "technical" ||
      rawHostFailuresExposed ||
      Object.hasOwn(descriptor, "lease")
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Technical operation failure leaked raw host data or selected the wrong branch.",
        { actual: plainData(descriptor) },
      );
    }
    settlementProbes += 4;
    internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      descriptor.ticket,
    );
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    let loadCalls = 0;
    const loadTransport = deferred();
    const ports = createHostPorts(api, {
      load() {
        loadCalls += 1;
        return loadTransport.promise;
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const started = executeCurrent(api, fixture, {
      type: "resource.refresh",
      resource: "stores",
    });
    if (
      started.status !== "resource-started" ||
      loadCalls !== 1 ||
      started.requestId !== 'resource:["stores",0]'
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Current resource refresh did not return nonblocking accepted work.",
        { actual: plainData(started), loadCalls },
      );
    }
    const raced = await Promise.race([
      started.settlement.then(() => "settled"),
      Promise.resolve("nonblocking"),
    ]);
    if (raced !== "nonblocking") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Resource refresh blocked the originating action turn.",
      );
    }
    loadTransport.resolve({
      status: "succeeded",
      value: { items: [], bounds: {} },
    });
    const settlement = await started.settlement;
    if (settlement.status !== "succeeded") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Accepted resource refresh did not preserve T08 settlement.",
        { actual: plainData(settlement) },
      );
    }
    resourceProbes += 5;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const ports = createHostPorts(api);
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const current = currentPrimitiveSnapshots(api, fixture);
    const forged = cloneJson(current.operation);
    const invalid = api.executeRuntimeOperationResourceAction(
      fixture.composed.handle,
      { type: "resource.refresh", resource: "stores" },
      resolutionSnapshot(api, current.resource, current.operation),
      current.resource,
      forged,
    );
    if (invalid.status !== "invalid-snapshot") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Structurally equal forged operation snapshot gained authority.",
        { actual: plainData(invalid) },
      );
    }
    const mismatch = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: "com.example.tasks/reorder",
      as: "signIn",
      input: {},
    });
    if (
      mismatch.status !== "operation-capability-mismatch" ||
      Reflect.ownKeys(mismatch).some((key) => key === "rawHostFailure" || key === "lease")
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Capability rejection exposed non-public authority.",
        { actual: plainData(mismatch) },
      );
    }
    snapshotProbes += 3;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const transport = deferred();
    const ports = createHostPorts(api, { invoke: () => transport.promise });
    const fixture = mustMountPrimitive(api, catalogSet, ports, {
      maxPendingSettlements: 1,
    });
    const first = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
    });
    const second = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "second@example.com", password: "secret" },
      concurrency: "queue",
    });
    if (
      first.status !== "operation-started" ||
      second.status !== "settlement-limit" ||
      second.reason !== "pending-settlements"
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Finite settlement capacity was not reserved before delegation.",
        { first: plainData(first), second: plainData(second) },
      );
    }
    retentionProbes += 3;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await first.settlement;
  }

  {
    const transport = deferred();
    let operationCalls = 0;
    const ports = createHostPorts(api, {
      invoke() {
        operationCalls += 1;
        return transport.promise;
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports, {
      maxPendingSettlements: 2,
      maxRetainedSettlementActions: 1,
    });
    const first = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
      onSuccess: [{ type: "state.toggle", path: "first" }],
    });
    const blocked = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "blocked@example.com", password: "secret" },
      concurrency: "queue",
      onFailure: [{ type: "state.toggle", path: "second" }],
    });
    if (
      first.status !== "operation-started" ||
      blocked.status !== "settlement-limit" ||
      blocked.reason !== "retained-actions" ||
      operationCalls !== 1
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Cumulative retained settlement actions crossed their aggregate ceiling.",
        { first: plainData(first), blocked: plainData(blocked), operationCalls },
      );
    }
    retentionProbes += 3;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await first.settlement;
  }

  {
    const transport = deferred();
    let operationCalls = 0;
    const ports = createHostPorts(api, {
      invoke() {
        operationCalls += 1;
        return transport.promise;
      },
    });
    const fixture = mustMountPrimitive(api, catalogSet, ports, {
      maxPendingSettlements: 2,
      maxRetainedHandlerCodeUnits: 13,
    });
    const first = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
    });
    const blocked = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "blocked@example.com", password: "secret" },
      concurrency: "queue",
    });
    if (
      first.status !== "operation-started" ||
      blocked.status !== "settlement-limit" ||
      blocked.reason !== "retained-handler-code-units" ||
      operationCalls !== 1
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Cumulative handler code units crossed their aggregate ceiling.",
        { first: plainData(first), blocked: plainData(blocked), operationCalls },
      );
    }
    retentionProbes += 3;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await first.settlement;
  }

  {
    const ports = createHostPorts(api);
    const fixture = mustMountPrimitive(api, catalogSet, ports, {
      maxPendingSettlements: 1,
    });
    const first = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "person@example.com", password: "secret" },
    });
    if (first.status !== "operation-started") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Terminal retention fixture did not start.",
      );
    }
    const firstDescriptor = await first.settlement;
    if (firstDescriptor.status !== "succeeded") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Terminal retention fixture did not expose a ticket.",
        { actual: plainData(firstDescriptor) },
      );
    }
    const blocked = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "blocked@example.com", password: "secret" },
    });
    if (blocked.status !== "settlement-limit" || blocked.reason !== "pending-settlements") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Terminal descriptor released its retained slot before ticket finalization.",
        { actual: plainData(blocked) },
      );
    }
    const finalized = internalApi.finalizeRuntimeOperationActionSettlement(
      fixture.composed.handle,
      firstDescriptor.ticket,
    );
    const accepted = executeCurrent(api, fixture, {
      type: "operation.invoke",
      operation: SIGN_IN,
      as: "signIn",
      input: { email: "accepted@example.com", password: "secret" },
    });
    if (finalized.status !== "finalized" || accepted.status !== "operation-started") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Ticket finalization did not release exactly one retained settlement slot.",
        { finalized: plainData(finalized), accepted: plainData(accepted) },
      );
    }
    const acceptedDescriptor = await accepted.settlement;
    if (acceptedDescriptor.status === "succeeded") {
      internalApi.finalizeRuntimeOperationActionSettlement(
        fixture.composed.handle,
        acceptedDescriptor.ticket,
      );
    }
    retentionProbes += 5;
    api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
  }

  {
    const ports = createHostPorts(api);
    const fixture = mustMountPrimitive(api, catalogSet, ports);
    const disposed = api.disposeRuntimeOperationResourceActions(fixture.composed.handle);
    if (disposed.status !== "disposed") {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Compositor disposal did not succeed.",
        { actual: plainData(disposed) },
      );
    }
    const [resource, operation, repeated] = [
      api.readRuntimeSurfaceResources(fixture.resource.handle),
      api.readRuntimeSurfaceOperations(fixture.operation.handle),
      api.disposeRuntimeOperationResourceActions(fixture.composed.handle),
    ];
    if (
      resource.status !== "disposed" ||
      operation.status !== "disposed" ||
      repeated.status !== "already-disposed"
    ) {
      fail(
        "OPERATION_RESOURCE_ACTION_RUNTIME_BEHAVIOR_DRIFT",
        "Exclusive disposal did not terminally revoke both primitive owners.",
        { resource: plainData(resource), operation: plainData(operation), repeated },
      );
    }
    disposalProbes += 4;
  }

  return Object.freeze({
    mountProbes,
    guardFirstProbes,
    tokenSessionProbes,
    operationProbes,
    settlementProbes,
    resourceProbes,
    snapshotProbes,
    ownershipProbes,
    compositorReadProbes,
    retentionProbes,
    disposalProbes,
    receiverIndependenceProbes,
    hostilePayloadReads,
    falseGuardEffects,
    falseGuardDiagnosticCalls,
    rawHostFailuresExposed,
    platformEffects: 0,
  });
}

/**
 * Builds deterministic M04-T11 evidence from exact prerequisites, distribution, hostile runtime
 * probes, tests, exact trace ownership, documentation, and task-owned bytes.
 */
export async function buildRuntimeCoreOperationResourceActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    resourceLifecycle,
    operationLifecycle,
    stateNavigation,
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
      RESOURCE_LIFECYCLE_PREREQUISITE,
      normalized.prerequisiteBytes?.resourceLifecycle,
    ),
    verifyPrerequisite(
      OPERATION_LIFECYCLE_PREREQUISITE,
      normalized.prerequisiteBytes?.operationLifecycle,
    ),
    verifyPrerequisite(
      STATE_NAVIGATION_PREREQUISITE,
      normalized.prerequisiteBytes?.stateNavigation,
    ),
    verifyPrerequisite(
      EXECUTION_CONTRACT_PREREQUISITE,
      normalized.prerequisiteBytes?.executionContracts,
    ),
    readWorkspaceText("packages/runtime-core/src/operation-resource-actions.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/operation-resource-actions.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/operation-resource-actions.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText(
      "packages/runtime-core/test/operation-resource-actions.test.ts",
      fileOverrides,
    ),
    readWorkspaceText(
      "packages/runtime-core/test/operation-resource-actions.types.ts",
      fileOverrides,
    ),
    readWorkspaceText("tests/runtime-core-operation-resource-actions.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-OPERATION-RESOURCE-ACTIONS.md", fileOverrides),
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
      "OPERATION_RESOURCE_ACTION_METADATA_INVALID",
      "Runtime package or trace metadata is not valid JSON.",
    );
  }

  const publicApi = verifyApi({
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
  const [runtimeApi, runtimeInternalApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.runtimeInternalApi ?? import(RUNTIME_INTERNAL_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const runtime = await probeRuntimeBehavior(
    runtimeApi,
    runtimeInternalApi,
    validatorApi,
    catalogText,
  );

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T11",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Guarded operation invocation captures bounded settlement branches behind private acknowledgement authority, while guarded resource refresh delegates exact current lifecycle snapshots.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze([
      resourceLifecycle,
      operationLifecycle,
      stateNavigation,
      executionContracts,
    ]),
    publicApi,
    runtime,
    semantics: Object.freeze({
      actionCardinality: "exactly one operation.invoke or resource.refresh action",
      guardOrdering: "guard before discriminator and every payload observation",
      falseGuard:
        "zero payload reads, payload-token calls, delegated effects, and diagnostic reports",
      operationTokenSession:
        "true guard and named operation input share one detached action-local M04-T10 cache",
      resourceTokenSession:
        "resource declaration input remains independently owned and materialized by M04-T08",
      operationInput:
        "canonical named synthetic array materialization before exact M04-T09 schema validation",
      handlerCapture: "both branches detached, bounded, and frozen before accepted invocation",
      settlementMapping:
        "succeeded selects onSuccess; public/technical failure selects onFailure; superseded/disposed selects none",
      acknowledgement:
        "raw lease hidden behind package-internal opaque one-shot authority; no auto-acknowledgement",
      resourceRefresh:
        "exact current M04-T08 snapshot plus factory resolution snapshot, returned nonblocking",
      exclusiveOwnership:
        "one live T11 compositor claim; trusted caller profile surrenders direct primitive use",
      disposal:
        "terminally disposes exclusively claimed T08/T09 managers and invalidates private tickets",
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
        "docs/proof/RUNTIME-CORE-OPERATION-RESOURCE-ACTIONS.md",
      ]),
    }),
    deferred: Object.freeze([
      "component.command and allowlisted event.emit actions (M04-T12)",
      "ordered handler arrays, 64-action turn limit, settlement depth, runner and finally (M04-T13)",
      "generic component and behavior bridges plus event payload provenance (M04-T14)",
      "reactive dependency discovery and stale asynchronous-result protection (M04-T15)",
      "full seven-namespace provenance, composed disposal, sign-in session and trace (M04-T16)",
      "physical cancellation, retry, timeout, cache, persistence, and offline policy",
      "adapter rendering and platform lifecycle behavior",
      "future protocol clarification of PF-041",
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
    fail("OPERATION_RESOURCE_ACTION_ARTIFACT_MISSING", "M04-T11 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("OPERATION_RESOURCE_ACTION_ARTIFACT_UNSAFE", "M04-T11 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T11 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreOperationResourceActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_OPERATION_RESOURCE_ACTIONS_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreOperationResourceActionsEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail(
      "OPERATION_RESOURCE_ACTION_ARTIFACT_DRIFT",
      "M04-T11 artifact differs from fresh evidence.",
      {
        expectedSha256: expected.artifactSha256,
        actualSha256: sha256(actualBytes),
      },
    );
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
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    ...expected.artifact.runtime,
  });
}

/** Atomically writes deterministic M04-T11 evidence after every proof check passes. */
export async function writeRuntimeCoreOperationResourceActionsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_OPERATION_RESOURCE_ACTIONS_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreOperationResourceActionsEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreOperationResourceActionsEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
