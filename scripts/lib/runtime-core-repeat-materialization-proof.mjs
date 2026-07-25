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

/** Absolute path to the deterministic M04-T07 repeat-materialization artifact. */
export const DEFAULT_RUNTIME_CORE_REPEAT_MATERIALIZATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
);

const VALUE_RESOLUTION_PREREQUISITE = Object.freeze({
  task: "M04-T02",
  path: "docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
  artifact: "runtime-core-0.1.0-value-resolution.json",
  sha256: "73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea",
});
const LOCAL_STATE_IDENTITY_PREREQUISITE = Object.freeze({
  task: "M04-T06",
  path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
  artifact: "runtime-core-0.1.0-local-state-identity.json",
  sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
});
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "RUNTIME_REPEAT_LIMITS",
    "createRuntimeRepeatRootScope",
    "createRuntimeRepeatedNodeIdentity",
    "createRuntimeResolutionSnapshotForRepeatScope",
    "materializeRuntimeRepeat",
    "reconcileRuntimeRepeatedNodeIdentity",
  ].sort(),
);
const EXPECTED_TYPE_EXPORTS = Object.freeze(
  [
    "RuntimeRepeatDeferred",
    "RuntimeRepeatInvalid",
    "RuntimeRepeatInvalidCode",
    "RuntimeRepeatInvalidReason",
    "RuntimeRepeatKey",
    "RuntimeRepeatLimitExceeded",
    "RuntimeRepeatMaterialization",
    "RuntimeRepeatMaterialized",
    "RuntimeRepeatMaterializedInstance",
    "RuntimeRepeatScope",
    "RuntimeRepeatSpec",
    "RuntimeRepeatedNodeIdentity",
    "RuntimeRepeatedNodeIdentityCreationResult",
    "RuntimeRepeatedNodeIdentityInvalid",
    "RuntimeRepeatedNodeIdentityInvalidReason",
    "RuntimeRepeatedNodeIdentityReconciliation",
  ].sort(),
);
const EXPECTED_SOURCE_IMPORTS = Object.freeze(
  [
    "./host-ports.js",
    "./node-identity.js",
    "./runtime-json-snapshot.js",
    "./value-resolution.js",
    "@desen/protocol",
  ].sort(),
);
const EXPECTED_FOCUSED_TESTS = 34;
const EXPECTED_COMPILER_NEGATIVE_CASES = 7;
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/repeat-materialization.test.ts";
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-021",
    owners: Object.freeze(["M04-T04", "M04-T05", "M04-T07"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-045",
    owners: Object.freeze(["M02-T10", "M04-T07"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-061",
    owners: Object.freeze(["M02-T10", "M04-T07", "M05-T05"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-104",
    owners: Object.freeze(["M04-T06", "M04-T07", "M05-T05"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-123",
    owners: Object.freeze(["M02-T13", "M04-T07", "M04-T13", "M07-T04"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-022",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T07"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-023",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T07"]),
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-018 — Repeat evaluation order, alias scope, key identity, and limit behavior are underspecified",
  "`items` is evaluated in the incoming outer scope before the new alias",
  "cannot reuse any active alias",
  "type-sensitive canonical JSON identity",
  "`REPEAT_ITEMS_INVALID`",
  "`REPEAT_KEY_INVALID`",
]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T07",
  "incoming scope",
  "active alias",
  "source-array order",
  "type-sensitive",
  "negative zero",
  "never truncates",
  "no partial",
  "array index",
  "ancestor repeat key",
  "PIPE-021",
  "PF-018",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T07 repeat evidence",
  "builds byte-identical repeat evidence twice",
  "rejects stale or tampered repeat evidence",
  "rejects stale M04-T02 prerequisite bytes",
  "rejects stale M04-T06 prerequisite bytes",
  "detects own-alias timing drift",
  "detects active-alias shadowing drift",
  "detects source-order drift",
  "detects key coercion and negative-zero drift",
  "detects repeat-limit truncation drift",
  "detects partial-result drift",
  "detects array-index identity drift",
  "detects ancestor-key identity drift",
  "detects public export, TSDoc, and platform drift",
  "detects focused-test and compiler-negative inventory drift",
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/repeat-materialization.ts",
  "packages/runtime-core/test/repeat-materialization.test.ts",
  "packages/runtime-core/test/repeat-materialization.types.ts",
  "packages/runtime-core/dist/repeat-materialization.js",
  "packages/runtime-core/dist/repeat-materialization.js.map",
  "packages/runtime-core/dist/repeat-materialization.d.ts",
  "packages/runtime-core/dist/repeat-materialization.d.ts.map",
  "scripts/lib/runtime-core-repeat-materialization-proof.mjs",
  "scripts/generate-runtime-core-repeat-materialization-proof.mjs",
  "scripts/verify-runtime-core-repeat-materialization.mjs",
  "tests/runtime-core-repeat-materialization.test.mjs",
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
  "React",
]);

/** Stable error class used by deterministic M04-T07 evidence and mutation tests. */
export class RuntimeCoreRepeatMaterializationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreRepeatMaterializationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreRepeatMaterializationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("REPEAT_EVIDENCE_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
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
      fail("REPEAT_IMPORT_BOUNDARY_DRIFT", "Repeat imports must use literal module names.");
    }
    modules.push(statement.moduleSpecifier.text);
  }
  return [...new Set(modules)].sort();
}

function verifyPlatformBoundary(parsed, code = "REPEAT_PLATFORM_BOUNDARY_DRIFT") {
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
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]))
    ) {
      found.add("dynamic-import");
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (found.size > 0) {
    fail(code, "Repeat materialization crossed its deterministic platform-neutral boundary.", {
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
      statement.moduleSpecifier.text !== "./repeat-materialization.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "REPEAT_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased repeat exports.`,
      );
    }
    for (const element of statement.exportClause.elements) {
      const target = statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports;
      target.push(element.name.text);
    }
  }
  verifyPlatformBoundary(parsed, "REPEAT_INDEX_EXPORT_DRIFT");
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
    "const itemsResolution = resolveRuntimeValue(",
    "if (Object.hasOwn(scope.aliases, alias))",
    "for (let index = 0; index < itemsResolution.value.length; index += 1)",
    "const aliases = createAliasMap(scope.aliases, alias, item);",
    'typeof keyResolution.value !== "string" && typeof keyResolution.value !== "number"',
    "const keyIdentity = canonicalizeJson(key);",
    "if (seenKeys.has(keyIdentity))",
    "if (itemsResolution.value.length > effectiveLimit)",
    "const instances = prepared.map(",
    "const repeatKeys = Object.freeze([...scope.repeatKeys]);",
    "baseIdentity.nodeId, repeatKeys,",
    "if (previousIdentity.key !== freshIdentity.key)",
    'status: "preserve-eligible"',
    'status: "remount-required"',
    'status: "replace-required"',
  ];
  for (const invariant of required) {
    if (!normalized.includes(invariant)) {
      fail(
        "REPEAT_SOURCE_SEMANTIC_DRIFT",
        `Repeat implementation is missing reviewed invariant: ${invariant}`,
      );
    }
  }
  const itemsResolution = normalized.indexOf("const itemsResolution = resolveRuntimeValue(");
  const childAlias = normalized.indexOf(
    "const aliases = createAliasMap(scope.aliases, alias, item);",
  );
  const overflow = normalized.indexOf("if (itemsResolution.value.length > effectiveLimit)");
  const instancePublication = normalized.indexOf("const instances = prepared.map(");
  if (
    itemsResolution < 0 ||
    childAlias <= itemsResolution ||
    overflow <= itemsResolution ||
    childAlias <= overflow ||
    instancePublication <= childAlias
  ) {
    fail(
      "REPEAT_SOURCE_SEMANTIC_DRIFT",
      "Items, bounds, per-item keys, and publication must remain in fail-closed order.",
    );
  }
  if (
    /\.slice\s*\(/u.test(sourceText) ||
    /(?:Date\.now|Math\.random|crypto\.randomUUID)\s*\(/u.test(sourceText)
  ) {
    fail(
      "REPEAT_SOURCE_SEMANTIC_DRIFT",
      "Repeat materialization cannot truncate, depend on time, or depend on randomness.",
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
  const source = exportedDeclarations(sourceText, "repeat-materialization.ts");
  assertDirectExports(source, "REPEAT_SOURCE_EXPORT_DRIFT", "Repeat source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "REPEAT_SOURCE_EXPORT_DRIFT",
    "Repeat source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "REPEAT_SOURCE_EXPORT_DRIFT",
    "Repeat source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("REPEAT_TSDOC_MISSING", "Every exported repeat declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  assertArrayEqual(
    importedModules(source.sourceFile),
    EXPECTED_SOURCE_IMPORTS,
    "REPEAT_IMPORT_BOUNDARY_DRIFT",
    "Repeat source imports",
  );
  verifyPlatformBoundary(source.sourceFile);
  verifySourceInvariants(sourceText);

  const declaration = exportedDeclarations(
    declarationText,
    "repeat-materialization.d.ts",
    ts.ScriptKind.TS,
  );
  assertDirectExports(declaration, "REPEAT_DECLARATION_DRIFT", "Repeat declaration");
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "REPEAT_DECLARATION_DRIFT",
    "Built repeat runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "REPEAT_DECLARATION_DRIFT",
    "Built repeat type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("REPEAT_DECLARATION_DRIFT", "Built repeat declarations lost TSDoc.", {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "REPEAT_DECLARATION_DRIFT");

  const built = exportedDeclarations(
    builtJavaScript,
    "repeat-materialization.js",
    ts.ScriptKind.JS,
  );
  assertDirectExports(built, "REPEAT_DISTRIBUTION_DRIFT", "Built repeat JavaScript");
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "REPEAT_DISTRIBUTION_DRIFT",
    "Built repeat JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "REPEAT_DISTRIBUTION_DRIFT",
    "Built repeat JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "REPEAT_DISTRIBUTION_DRIFT");

  for (const [text, fileName, expectedTypes] of [
    [sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS],
    [builtIndexJavaScript, "dist/index.js", []],
  ]) {
    const exports = moduleIndexExports(text, fileName);
    assertArrayEqual(
      exports.runtimeExports,
      EXPECTED_RUNTIME_EXPORTS,
      "REPEAT_INDEX_EXPORT_DRIFT",
      `${fileName} repeat runtime exports`,
    );
    assertArrayEqual(
      exports.typeExports,
      expectedTypes,
      "REPEAT_INDEX_EXPORT_DRIFT",
      `${fileName} repeat type exports`,
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
  fail("REPEAT_TEST_INVENTORY_DRIFT", `${label} must use a static title.`);
}

function collectFocusedTests(testText) {
  const parsed = sourceFile(testText, "repeat-materialization.test.ts");
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
          fail("REPEAT_TEST_INVENTORY_DRIFT", "it.each must use a static array table.");
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
        fail("REPEAT_TEST_INVENTORY_DRIFT", "Focused repeat tests cannot be skipped or selected.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  const titles = registrations.map(({ title }) => title);
  if (new Set(titles).size !== titles.length) {
    fail("REPEAT_TEST_INVENTORY_DRIFT", "Focused repeat test titles must be unique.");
  }
  const cases = registrations.reduce((total, registration) => total + registration.cases, 0);
  if (cases !== EXPECTED_FOCUSED_TESTS) {
    fail("REPEAT_TEST_INVENTORY_DRIFT", "Focused repeat test case count changed.", {
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
    fail("REPEAT_TYPE_TEST_DRIFT", "Compiler-negative evidence cannot use @ts-ignore.");
  }
  const labels = [...typeTestText.matchAll(/\/\/ @ts-expect-error ([^\r\n]+)/gu)].map(([, label]) =>
    label.trim(),
  );
  if (
    labels.length !== EXPECTED_COMPILER_NEGATIVE_CASES ||
    new Set(labels).size !== labels.length ||
    labels.some((label) => label.length === 0)
  ) {
    fail("REPEAT_TYPE_TEST_DRIFT", "Compiler-negative repeat inventory changed.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: labels,
    });
  }
  return Object.freeze(labels);
}

function rootTestInventory(rootTestText) {
  const parsed = sourceFile(
    rootTestText,
    "runtime-core-repeat-materialization.test.mjs",
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
        fail("REPEAT_ROOT_TEST_DRIFT", "Root repeat tests cannot be skipped or selected.");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assertArrayEqual(
    titles,
    REQUIRED_ROOT_TEST_TITLES,
    "REPEAT_ROOT_TEST_DRIFT",
    "Root repeat mutation titles",
  );
  return Object.freeze(titles);
}

function verifyTestInventory(packageTests, typeTests, rootTests, runtimeManifest) {
  if (runtimeManifest.scripts?.["test:repeat-materialization"] !== EXPECTED_PACKAGE_TEST_SCRIPT) {
    fail(
      "REPEAT_PACKAGE_WIRING_DRIFT",
      "The runtime package repeat test command changed or is absent.",
    );
  }
  const focused = collectFocusedTests(packageTests);
  const compilerNegativeLabels = compilerNegativeInventory(typeTests);
  const rootTitles = rootTestInventory(rootTests);
  return Object.freeze({
    focused,
    compilerNegativeLabels,
    rootTitles,
  });
}

async function verifyPrerequisite(prerequisite, injectedBytes) {
  const bytes =
    injectedBytes === undefined
      ? await readWorkspaceBytes(prerequisite.path)
      : Buffer.from(injectedBytes);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== prerequisite.sha256) {
    fail("REPEAT_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite hash changed.`, {
      task: prerequisite.task,
      expectedSha256: prerequisite.sha256,
      actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("REPEAT_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite is not valid JSON.`);
  }
  if (artifact.task !== prerequisite.task || artifact.result !== "PASS") {
    fail("REPEAT_PREREQUISITE_DRIFT", `${prerequisite.task} prerequisite identity changed.`);
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
        fail("REPEAT_TRACE_DRIFT", `Missing trace owner ${expected.id}.`);
      }
      assertArrayEqual(
        observed.owners,
        expected.owners,
        "REPEAT_TRACE_DRIFT",
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
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!findings.includes(required)) {
      fail("REPEAT_FINDING_DRIFT", `PF-018 is missing reviewed text: ${required}`);
    }
  }
  const start = findings.indexOf(REQUIRED_FINDING_TEXT[0]);
  const next = findings.indexOf("\n## PF-", start + REQUIRED_FINDING_TEXT[0].length);
  const section = findings.slice(start, next < 0 ? findings.length : next);
  if (!section.includes("- Status: OPEN")) {
    fail("REPEAT_FINDING_DRIFT", "PF-018 must remain explicitly OPEN for protocol clarification.");
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!proofDocument.includes(required)) {
      fail("REPEAT_PROOF_DOCUMENT_DRIFT", `M04-T07 proof is missing: ${required}`);
    }
  }
  return Object.freeze({
    finding: "PF-018",
    findingStatus: "OPEN",
    proofDocument: "docs/proof/RUNTIME-CORE-REPEAT-MATERIALIZATION.md",
  });
}

function runtimeSnapshot(api, items) {
  return api.createRuntimeResolutionSnapshot({
    state: {},
    context: { fallbackKey: "fallback" },
    resource: {
      tasks: {
        status: "succeeded",
        pending: false,
        value: items,
      },
    },
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function repeatSpec(
  items = { $ref: "resource.tasks.value" },
  alias = "row",
  key = { $ref: `item.${alias}.id` },
  limit = undefined,
) {
  return {
    items,
    as: alias,
    key,
    ...(limit === undefined ? {} : { limit }),
  };
}

function mustMaterialize(api, scope, spec, label) {
  const result = api.materializeRuntimeRepeat(scope, spec);
  if (result.status !== "materialized") {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", `${label} did not materialize.`, {
      actual: plainData(result),
    });
  }
  return result;
}

function mustCreateRepeatedIdentity(api, descriptor, scope) {
  const result = api.createRuntimeRepeatedNodeIdentity(descriptor, scope);
  if (result.status !== "created") {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Repeated identity creation changed.", {
      actual: plainData(result),
    });
  }
  return result.identity;
}

function probeRuntimeBehavior(api) {
  const descriptor = Object.freeze({
    documentId: "com.desen.proof",
    surfaceId: "proof-surface",
    nodeId: "proof.row",
    use: "com.desen.ui/Text",
  });

  const root = api.createRuntimeRepeatRootScope(
    runtimeSnapshot(api, [
      { id: "b", title: "Beta" },
      { id: "a", title: "Alpha" },
    ]),
  );
  const aliasTiming = api.materializeRuntimeRepeat(root, repeatSpec({ $ref: "item.row.children" }));
  assertDataEqual(
    aliasTiming,
    {
      status: "invalid",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/items/$ref",
      reason: "items-unresolved",
    },
    "Own-alias timing",
  );
  if (Object.hasOwn(aliasTiming, "instances")) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Own-alias failure exposed partial instances.");
  }

  const ordered = mustMaterialize(api, root, repeatSpec(), "Ordered repeat");
  assertDataEqual(
    ordered.instances.map(({ index, key, keyIdentity }) => ({ index, key, keyIdentity })),
    [
      { index: 0, key: "b", keyIdentity: '"b"' },
      { index: 1, key: "a", keyIdentity: '"a"' },
    ],
    "Source-array order",
  );
  assertDeepFrozen(ordered, "Materialized repeat");

  const nestedRoot = api.createRuntimeRepeatRootScope(
    runtimeSnapshot(api, [{ id: "group-a", rows: [{ id: 2 }, { id: 1 }] }]),
  );
  const outer = mustMaterialize(
    api,
    nestedRoot,
    repeatSpec({ $ref: "resource.tasks.value" }, "group", { $ref: "item.group.id" }),
    "Outer repeat",
  );
  const outerScope = outer.instances[0]?.scope;
  if (outerScope === undefined) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Outer repeat lost its first child scope.");
  }
  const shadow = api.materializeRuntimeRepeat(
    outerScope,
    repeatSpec({ $ref: "item.group.rows" }, "group", "shadow"),
  );
  assertDataEqual(
    shadow,
    {
      status: "invalid",
      code: "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      pointer: "/as",
      reason: "active-alias-collision",
    },
    "Active-alias shadowing",
  );
  const inner = mustMaterialize(
    api,
    outerScope,
    repeatSpec({ $ref: "item.group.rows" }, "row", { $ref: "item.row.id" }),
    "Nested repeat",
  );
  assertDataEqual(
    {
      aliasOrder: inner.instances[0]?.scope.aliasOrder,
      repeatKeys: inner.instances[0]?.scope.repeatKeys,
    },
    { aliasOrder: ["group", "row"], repeatKeys: ["group-a", 2] },
    "Nested lexical scope",
  );

  const distinct = mustMaterialize(
    api,
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec([{ id: 1 }, { id: "1" }]),
    "Type-sensitive keys",
  );
  assertDataEqual(
    distinct.instances.map(({ keyIdentity }) => keyIdentity),
    ["1", '"1"'],
    "Type-sensitive key identity",
  );
  const negativeZero = api.materializeRuntimeRepeat(
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec([{ id: -0 }, { id: 0 }]),
  );
  if (
    negativeZero.status !== "invalid" ||
    negativeZero.code !== "REPEAT_KEY_INVALID" ||
    negativeZero.reason !== "duplicate-key" ||
    negativeZero.itemIndex !== 1 ||
    Object.hasOwn(negativeZero, "instances")
  ) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "RFC 8785 negative-zero duplicate handling changed.", {
      actual: plainData(negativeZero),
    });
  }

  const exactLimit = mustMaterialize(
    api,
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec(["a", "b"], "row", { $ref: "item.row" }, 2),
    "Exact repeat limit",
  );
  if (exactLimit.instances.length !== 2 || exactLimit.effectiveLimit !== 2) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "The exact declared repeat limit changed.");
  }
  const overflow = api.materializeRuntimeRepeat(
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec(["a", "b", "c"], "row", { $ref: "item.row" }, 2),
  );
  assertDataEqual(
    overflow,
    {
      status: "limit-exceeded",
      code: "run.desen.runtime/REPEAT_LIMIT_EXCEEDED",
      pointer: "/limit",
      reason: "declared-limit",
      limit: 2,
      observed: 3,
    },
    "Non-truncating overflow",
  );
  if (Object.hasOwn(overflow, "instances")) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Overflow exposed a truncated subtree.");
  }

  const partial = api.materializeRuntimeRepeat(
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec([{ id: "accepted" }, {}]),
  );
  if (
    partial.status !== "invalid" ||
    partial.code !== "REPEAT_KEY_INVALID" ||
    partial.reason !== "key-unresolved" ||
    partial.itemIndex !== 1 ||
    Object.hasOwn(partial, "instances")
  ) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Late key failure is no longer atomic.", {
      actual: plainData(partial),
    });
  }

  const previousSet = mustMaterialize(
    api,
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec([{ id: "a" }, { id: "b" }]),
    "Initial identity order",
  );
  const previousScope = previousSet.instances[0]?.scope;
  if (previousScope === undefined) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Initial identity scope is missing.");
  }
  const previousIdentity = mustCreateRepeatedIdentity(api, descriptor, previousScope);
  const reorderedSet = mustMaterialize(
    api,
    api.createRuntimeRepeatRootScope(runtimeSnapshot(api, [])),
    repeatSpec([{ id: "b" }, { id: "a" }], "renamed", { $ref: "item.renamed.id" }),
    "Reordered identity set",
  );
  const reorderedScope = reorderedSet.instances[1]?.scope;
  if (reorderedScope === undefined) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Reordered identity scope is missing.");
  }
  const preserved = api.reconcileRuntimeRepeatedNodeIdentity(
    previousIdentity,
    descriptor,
    reorderedScope,
  );
  if (preserved.status !== "preserve-eligible" || preserved.identity !== previousIdentity) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Array index or alias leaked into repeated identity.", {
      actual: plainData(preserved),
    });
  }

  function nestedIdentityScope(outerKey) {
    const first = mustMaterialize(
      api,
      api.createRuntimeRepeatRootScope(
        runtimeSnapshot(api, [{ id: outerKey, rows: [{ id: "same-inner" }] }]),
      ),
      repeatSpec({ $ref: "resource.tasks.value" }, "group", { $ref: "item.group.id" }),
      "Identity outer repeat",
    );
    const firstScope = first.instances[0]?.scope;
    if (firstScope === undefined) {
      fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Identity outer scope is missing.");
    }
    const second = mustMaterialize(
      api,
      firstScope,
      repeatSpec({ $ref: "item.group.rows" }, "row", { $ref: "item.row.id" }),
      "Identity inner repeat",
    );
    const secondScope = second.instances[0]?.scope;
    if (secondScope === undefined) {
      fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Identity inner scope is missing.");
    }
    return secondScope;
  }
  const ancestorA = nestedIdentityScope("ancestor-a");
  const ancestorB = nestedIdentityScope("ancestor-b");
  const ancestorIdentity = mustCreateRepeatedIdentity(api, descriptor, ancestorA);
  const ancestorChanged = api.reconcileRuntimeRepeatedNodeIdentity(
    ancestorIdentity,
    descriptor,
    ancestorB,
  );
  if (
    ancestorChanged.status !== "replace-required" ||
    ancestorChanged.reason !== "identity-changed"
  ) {
    fail("REPEAT_RUNTIME_BEHAVIOR_DRIFT", "Ancestor repeat key left stable identity unchanged.", {
      actual: plainData(ancestorChanged),
    });
  }

  return Object.freeze({
    aliasTimingProbes: 1,
    aliasScopeProbes: 2,
    orderingProbes: 1,
    keyIdentityProbes: 2,
    limitProbes: 2,
    atomicityProbes: 3,
    repeatedIdentityProbes: 3,
    platformEffects: 0,
    partialOutputs: false,
    truncation: false,
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
 * Builds deterministic M04-T07 evidence from prerequisites, public distribution, tests,
 * documentation, and independent headless runtime probes.
 */
export async function buildRuntimeCoreRepeatMaterializationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    valueResolution,
    localStateIdentity,
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
    verifyPrerequisite(
      VALUE_RESOLUTION_PREREQUISITE,
      normalized.prerequisiteBytes?.valueResolution,
    ),
    verifyPrerequisite(
      LOCAL_STATE_IDENTITY_PREREQUISITE,
      normalized.prerequisiteBytes?.localStateIdentity,
    ),
    readWorkspaceText("packages/runtime-core/src/repeat-materialization.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/repeat-materialization.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/repeat-materialization.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/repeat-materialization.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/repeat-materialization.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-repeat-materialization.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-REPEAT-MATERIALIZATION.md", fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimeManifestText);
    trace = JSON.parse(traceText);
  } catch {
    fail("REPEAT_METADATA_INVALID", "Runtime package or trace metadata is not valid JSON.");
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
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const runtime = probeRuntimeBehavior(runtimeApi);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T07",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Repeats resolve in lexical scope, materialize atomically in source order, reject overflow without truncation, and reconcile type-sensitive key-path identity deterministically.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze([valueResolution, localStateIdentity]),
    publicApi,
    runtime,
    semantics: Object.freeze({
      itemsEvaluation: "incoming parent scope before own alias",
      aliasExtent: "child key and repeated subtree only",
      activeAliasShadowing: "invalid",
      siblingAliasReuse: "allowed",
      order: "source array",
      keyTypes: Object.freeze(["string", "finite-number"]),
      keyIdentity: "RFC 8785 canonical JSON with JSON type retained",
      negativeZeroIdentity: "0",
      duplicateKeyResult: "REPEAT_KEY_INVALID",
      nonArrayResult: "REPEAT_ITEMS_INVALID",
      defaultLimit: 1_000,
      overflow: "controlled failure without truncation",
      failurePublication: "no partial instances",
      instanceIdentity:
        "document, surface, source node, and complete outer-to-inner repeat-key path",
      excludedFromIdentity: Object.freeze([
        "array index",
        "alias name",
        "item contents",
        "revision",
        "props",
        "styles",
      ]),
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
    }),
    deferred: Object.freeze([
      "conditional repeated-subtree lifecycle and dependency reevaluation (M04-T15)",
      "resource and operation lifecycles inside repeated scopes (M04-T08/M04-T09)",
      "adapter instance preservation and declared prop remount policy (M05-T05)",
      "complete observable sign-in trace (M04-T16)",
      "cross-platform adapter implementations",
      "future protocol clarification of PF-018",
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
    fail("REPEAT_ARTIFACT_MISSING", "M04-T07 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("REPEAT_ARTIFACT_UNSAFE", "M04-T07 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T07 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreRepeatMaterializationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_REPEAT_MATERIALIZATION_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreRepeatMaterializationEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("REPEAT_ARTIFACT_DRIFT", "M04-T07 artifact differs from fresh evidence.", {
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
    aliasTimingProbes: expected.artifact.runtime.aliasTimingProbes,
    aliasScopeProbes: expected.artifact.runtime.aliasScopeProbes,
    orderingProbes: expected.artifact.runtime.orderingProbes,
    keyIdentityProbes: expected.artifact.runtime.keyIdentityProbes,
    limitProbes: expected.artifact.runtime.limitProbes,
    atomicityProbes: expected.artifact.runtime.atomicityProbes,
    repeatedIdentityProbes: expected.artifact.runtime.repeatedIdentityProbes,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T07 evidence after every proof check passes. */
export async function writeRuntimeCoreRepeatMaterializationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_REPEAT_MATERIALIZATION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreRepeatMaterializationEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreRepeatMaterializationEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}
