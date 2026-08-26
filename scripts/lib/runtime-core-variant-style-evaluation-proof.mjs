import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_RUNTIME_CORE_PREDICATE_EVALUATION_ARTIFACT_PATH,
  verifyRuntimeCorePredicateEvaluationEvidence,
} from "./runtime-core-predicate-evaluation-proof.mjs";
import {
  DEFAULT_RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ARTIFACT_PATH,
  verifyRuntimeCoreTokenFormatResolutionEvidence,
} from "./runtime-core-token-format-resolution-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M04-T05 variant/style evidence artifact. */
export const DEFAULT_RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
);

const CURRENT_N014_SUCCESSOR = Object.freeze({
  task: "M08-T03",
  status: "TESTED",
  artifactPath: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
  artifactSha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
});
const TASK_TIME_READER_RECEIPTS = new Map([
  [
    "scripts/lib/runtime-core-variant-style-evaluation-proof.mjs",
    Object.freeze({
      path: "scripts/lib/runtime-core-variant-style-evaluation-proof.mjs",
      bytes: 61_661,
      sha256: "56f14f324219c6eca66a4f377dc03236de454eeef049756a9115c96b3d4d837d",
    }),
  ],
  [
    "tests/runtime-core-variant-style-evaluation.test.mjs",
    Object.freeze({
      path: "tests/runtime-core-variant-style-evaluation.test.mjs",
      bytes: 14_498,
      sha256: "cd80ca9ba7b711f375fb8874ed03f379e14ef5df346db501da459bb35dec844d",
    }),
  ],
]);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["evaluateRuntimeVariantOverrides"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimePropValueSpecs",
  "RuntimeStyleValueSpecs",
  "RuntimeVariantEvaluationInput",
  "RuntimeVariantOverrideInvalidReason",
  "RuntimeVariantOverrideSpec",
  "RuntimeVariantOverridesEvaluated",
  "RuntimeVariantOverridesEvaluation",
  "RuntimeVariantOverridesInvalid",
  "RuntimeVariantValueSources",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze(
  [...EXPECTED_RUNTIME_EXPORTS, ...EXPECTED_TYPE_EXPORTS].sort(),
);
const EXPECTED_IMPORT_MODULES = Object.freeze([
  "./host-ports.js",
  "./predicate-evaluation.js",
  "./token-format-resolution.js",
  "./value-resolution.js",
  "@desen/protocol",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-021",
    section: "24.2",
    owners: Object.freeze(["M04-T04", "M04-T05", "M04-T07"]),
    status: "PREDICATE_AND_VARIANT_STAGES_REPEAT_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-060",
    section: "17.5",
    owners: Object.freeze(["M02-T08", "M04-T05"]),
    status: "RUNTIME_PRIMITIVE_HEADLESS_INTEGRATION_DEFERRED",
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-035 — Ordered variants and style overrides require a deterministic merge profile",
  "one turn-scoped token session",
  "`/props/{name}` is one indivisible override leaf",
  "`/style/{state}/{part}/{property}` is one indivisible override leaf",
  "Literal objects and arrays inside either ValueSpec are replaced as a whole and are never recursively merged.",
  "Variants cannot add or remove children.",
  "The evaluator returns effective raw ValueSpecs, not final materialized props or styles.",
  "N-014 remains `PLANNED`",
  "Consumer-schema validation and adapter delivery remain M05.",
]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T05",
  "evaluateRuntimeVariantOverrides",
  "base-first",
  "document order",
  "effective raw ValueSpecs",
  "one turn-scoped token session",
  "Variants cannot add or remove children",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-variant-style-evaluation":
    "pnpm verify:runtime-core-token-format-resolution && pnpm verify:runtime-core-predicate-evaluation && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:variant-style-evaluation && node scripts/generate-runtime-core-variant-style-evaluation-proof.mjs",
  "verify:runtime-core-variant-style-evaluation":
    "pnpm verify:runtime-core-token-format-resolution && pnpm verify:runtime-core-predicate-evaluation && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:variant-style-evaluation && node scripts/verify-runtime-core-variant-style-evaluation.mjs",
  "test:runtime-core-variant-style-evaluation":
    "pnpm verify:runtime-core-token-format-resolution && pnpm verify:runtime-core-predicate-evaluation && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:variant-style-evaluation && node --test tests/runtime-core-variant-style-evaluation.test.mjs",
});
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/variant-style-evaluation.test.ts";
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/variant-style-evaluation.ts",
  "packages/runtime-core/test/variant-style-evaluation.test.ts",
  "packages/runtime-core/test/variant-style-evaluation.types.ts",
  "packages/runtime-core/dist/variant-style-evaluation.js",
  "packages/runtime-core/dist/variant-style-evaluation.js.map",
  "packages/runtime-core/dist/variant-style-evaluation.d.ts",
  "packages/runtime-core/dist/variant-style-evaluation.d.ts.map",
  "scripts/lib/runtime-core-variant-style-evaluation-proof.mjs",
  "scripts/generate-runtime-core-variant-style-evaluation-proof.mjs",
  "scripts/verify-runtime-core-variant-style-evaluation.mjs",
  "tests/runtime-core-variant-style-evaluation.test.mjs",
]);
const REQUIRED_PACKAGE_TEST_TITLES = Object.freeze([
  "applies base values first and matching variants in exact document order",
  "makes array order observable and lets only later matching paths win",
  "returns empty immutable maps when no base or variant values are declared",
  "detaches, canonicalizes, recursively freezes, and source-maps effective ValueSpecs",
  "materializes token and format predicate operands with exact position pairing",
  "treats missing predicate values as false while keeping resolved null distinct",
  "uses status-only exists semantics and never evaluates a missing reference fallback",
  "prefixes ordered predicate diagnostics without changing valid false evaluation",
  "redacts provider exceptions, malformed envelopes, promises, and hostile results",
  "validates the complete input before making the first provider call",
  "shape-validates raw base references without materializing snapshot values",
  "preserves numeric prop names and complete immutable provenance without key-order semantics",
  "prevalidates every predicate format before invoking an earlier token provider",
  "reports an outer format profile error before nested format value errors",
  "rejects an unknown structural root field with an exact pointer",
  "rejects a non-array variants field with an exact pointer",
  "rejects a variant missing when with an exact pointer",
  "rejects a variant without props or style with an exact pointer",
  "rejects a structural variant field with an exact pointer",
  "rejects a non-object extension bag with an exact pointer",
  "rejects an invalid style state with an exact pointer",
  "rejects an invalid style nesting level with an exact pointer",
  "rejects a reserved literal ValueSpec key with an exact pointer",
  "rejects an invalid predicate arity with an exact pointer",
  "accepts opaque extension JSON but cannot give it structural meaning",
  "rejects hostile language values without executing accessors",
  "enforces depth, node, and string limits at the inert input boundary",
  "enforces one aggregate materialized-value budget across predicate occurrences",
  "stops after the first terminal provider failure and exposes no partial composition",
  "rejects forged snapshots and malformed contexts before input or host inspection",
]);
const EXPECTED_COMPILER_NEGATIVE_LABELS = Object.freeze([
  "a selected ValueSpec can still be a dynamic token or format form",
  "evaluated prop maps are immutable",
  "evaluated style-state maps are immutable",
  "evaluated style-part maps are immutable",
  "evaluated style-property maps are immutable",
  "winning prop source maps are immutable",
  "matching indexes preserve immutable document order",
  "ordered diagnostics are immutable",
  "successful evaluation has no deferred form",
  "invalid outcomes expose no partial effective props",
  "invalid outcomes expose no partial diagnostics",
  "provider failures redact raw errors",
  "provider failures expose no partial effective style",
  "every variant requires a predicate",
  "every variant requires at least props or style",
  "variants cannot mutate structural children or slots",
  "predicate operators are a closed data-only vocabulary",
  "style leaves must be inert ValueSpecs",
  "the evaluator input intentionally excludes structural node fields",
  "the variant array is immutable",
  "base prop maps are immutable",
  "the materialization context is mandatory",
  "variant evaluation cannot omit the factory-created snapshot",
  "token resolution remains synchronous during predicate evaluation",
  "the public result has no unresolved or deferred terminal",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T05 variant/style evidence",
  "two independent variant/style evidence builds are byte-identical",
  "rejects stale or one-byte-tampered variant/style evidence",
  "rejects base-first, document-order, whole-prop, and style-leaf semantic drift",
  "rejects token-session, operand-position, missing, and provider-failure semantic drift",
  "rejects structural widening, mutable output, and fail-closed boundary drift",
  "rejects source ordering, shared-session, and leaf-merge implementation drift",
  "rejects public export, TSDoc, platform, and distribution drift",
  "rejects package, root wiring, skipped tests, and conditional test registration drift",
  "rejects trace, PF-035, N-014, and proof-document boundary drift",
  "rejects stale injected M04-T03 prerequisite bytes",
  "rejects stale injected M04-T04 prerequisite bytes",
  "atomic variant/style writer rejects symlink destinations",
  "atomic variant/style writer detects temporary-byte tampering before rename",
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

/** Stable error class used by deterministic M04-T05 evidence and mutation tests. */
export class RuntimeCoreVariantStyleEvaluationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreVariantStyleEvaluationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreVariantStyleEvaluationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("VARIANT_STYLE_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T05 contract.`, { expected, actual });
  }
}

function plainData(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDataEqual(actual, expected, label) {
  const normalized = plainData(actual);
  if (!isDeepStrictEqual(normalized, expected)) {
    fail("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
    }
    pending.push(...Object.values(current));
  }
}

function exportedDeclarations(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtimeExports = [];
  const typeExports = [];
  const missingTsdoc = [];
  for (const statement of sourceFile.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
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
    sourceFile,
    runtimeExports: Object.freeze(runtimeExports.sort()),
    typeExports: Object.freeze(typeExports.sort()),
    missingTsdoc: Object.freeze(missingTsdoc.sort()),
  });
}

function verifyDirectExports(inventory, code, label) {
  for (const statement of inventory.sourceFile.statements) {
    if (
      ts.isExportAssignment(statement) ||
      ts.isExportDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      fail(code, `${label} permits only direct identifier-named exports.`);
    }
  }
}

function verifyImports(sourceFile) {
  const modules = [];
  for (const statement of sourceFile.statements.filter(ts.isImportDeclaration)) {
    if (
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause === undefined ||
      statement.importClause.name !== undefined ||
      statement.importClause.namedBindings === undefined ||
      !ts.isNamedImports(statement.importClause.namedBindings) ||
      statement.importClause.namedBindings.elements.some(
        (element) => element.propertyName !== undefined,
      )
    ) {
      fail(
        "VARIANT_STYLE_IMPORT_BOUNDARY_DRIFT",
        "Variant/style evaluation permits only explicit non-aliased named imports.",
      );
    }
    const moduleName = statement.moduleSpecifier.text;
    if (!EXPECTED_IMPORT_MODULES.includes(moduleName)) {
      fail("VARIANT_STYLE_IMPORT_BOUNDARY_DRIFT", `Unexpected import ${moduleName}.`);
    }
    modules.push(moduleName);
  }
  assertArrayEqual(
    [...new Set(modules)].sort(),
    EXPECTED_IMPORT_MODULES,
    "VARIANT_STYLE_IMPORT_BOUNDARY_DRIFT",
    "Variant/style source dependency modules",
  );
  return Object.freeze([...new Set(modules)].sort());
}

function verifyPlatformBoundary(sourceFile, code = "VARIANT_STYLE_PLATFORM_BOUNDARY_DRIFT") {
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
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found.size > 0) {
    fail(code, "Variant/style evaluation crossed its framework-neutral boundary.", {
      found: [...found].sort(),
    });
  }
}

function indexExports(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtimeExports = [];
  const typeExports = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "./variant-style-evaluation.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "VARIANT_STYLE_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased variant/style exports.`,
      );
    }
    for (const element of statement.exportClause.elements) {
      const target = statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports;
      target.push(element.name.text);
    }
  }
  return Object.freeze({
    sourceFile,
    runtimeExports: Object.freeze(runtimeExports.sort()),
    typeExports: Object.freeze(typeExports.sort()),
  });
}

function verifyIndex(sourceText, fileName, expectedTypes) {
  const inventory = indexExports(sourceText, fileName);
  assertArrayEqual(
    inventory.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "VARIANT_STYLE_INDEX_EXPORT_DRIFT",
    `${fileName} runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    expectedTypes,
    "VARIANT_STYLE_INDEX_EXPORT_DRIFT",
    `${fileName} type exports`,
  );
  verifyPlatformBoundary(inventory.sourceFile, "VARIANT_STYLE_INDEX_EXPORT_DRIFT");
}

function verifySourceOrdering(sourceText) {
  const required = [
    "const session = createTokenSession(capturedContext);",
    "applyProps(selectedProps, preparation.prepared.props",
    "applyStyle(selectedStyle, preparation.prepared.style",
    "for (let index = 0; index < preparation.prepared.variants.length; index += 1)",
    "materializeRuntimeValue(operand.spec, snapshot, session.context)",
    "matchingVariantIndices.push(index)",
    "selected.set(",
    "selectedProperties.set(",
    "function validateValueSpecShape(",
    "function validateFormatProfiles(",
    "return validateValueSpecShape(value, pointer) ?? validateFormatProfiles(value, pointer);",
  ];
  for (const text of required) {
    if (!sourceText.includes(text)) {
      fail(
        "VARIANT_STYLE_SOURCE_ORDER_DRIFT",
        `Variant/style implementation is missing reviewed invariant: ${text}`,
      );
    }
  }
  const session = sourceText.indexOf(required[0]);
  const baseProps = sourceText.lastIndexOf(required[1]);
  const baseStyle = sourceText.lastIndexOf(required[2]);
  const loop = sourceText.indexOf(required[3]);
  if (session < 0 || baseProps <= session || baseStyle <= session || loop <= baseStyle) {
    fail(
      "VARIANT_STYLE_SOURCE_ORDER_DRIFT",
      "One session and both base maps must be established before the ordered variant loop.",
    );
  }
  if (
    /\.variants\.(?:sort|reverse|toSorted|toReversed)\s*\(/u.test(sourceText) ||
    /forEach\s*\(\s*async/u.test(sourceText)
  ) {
    fail(
      "VARIANT_STYLE_SOURCE_ORDER_DRIFT",
      "Variant order cannot be sorted, reversed, or evaluated asynchronously.",
    );
  }
}

function verifySourceAndDistribution({
  sourceText,
  sourceIndexText,
  declarationText,
  builtJavaScript,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = exportedDeclarations(sourceText, "variant-style-evaluation.ts");
  verifyDirectExports(source, "VARIANT_STYLE_SOURCE_EXPORT_DRIFT", "Variant/style source");
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "VARIANT_STYLE_SOURCE_EXPORT_DRIFT",
    "Variant/style source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "VARIANT_STYLE_SOURCE_EXPORT_DRIFT",
    "Variant/style source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("VARIANT_STYLE_TSDOC_MISSING", "Every exported M04-T05 declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  const sourceImports = verifyImports(source.sourceFile);
  verifyPlatformBoundary(source.sourceFile);
  verifySourceOrdering(sourceText);
  verifyIndex(sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS);

  const declaration = exportedDeclarations(declarationText, "dist/variant-style-evaluation.d.ts");
  verifyDirectExports(
    declaration,
    "VARIANT_STYLE_DECLARATION_DRIFT",
    "Built variant/style declarations",
  );
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "VARIANT_STYLE_DECLARATION_DRIFT",
    "Built variant/style runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "VARIANT_STYLE_DECLARATION_DRIFT",
    "Built variant/style type declarations",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("VARIANT_STYLE_DECLARATION_DRIFT", "Built variant/style declarations lost TSDoc.", {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "VARIANT_STYLE_DECLARATION_DRIFT");

  const built = exportedDeclarations(builtJavaScript, "dist/variant-style-evaluation.js");
  verifyDirectExports(built, "VARIANT_STYLE_DISTRIBUTION_DRIFT", "Built variant/style JavaScript");
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "VARIANT_STYLE_DISTRIBUTION_DRIFT",
    "Built variant/style JavaScript exports",
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "VARIANT_STYLE_DISTRIBUTION_DRIFT",
    "Built variant/style JavaScript type exports",
  );
  verifyPlatformBoundary(built.sourceFile, "VARIANT_STYLE_DISTRIBUTION_DRIFT");
  verifyIndex(builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS);
  verifyIndex(builtIndexJavaScript, "dist/index.js", []);

  return Object.freeze({
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    sourceExports: EXPECTED_SOURCE_EXPORTS,
    sourceImports,
    tsdocDeclarations: EXPECTED_SOURCE_EXPORTS.length,
  });
}

function verifyNamedImport(sourceFile, moduleName, expectedBindings, fileName) {
  const imports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleName,
  );
  if (imports.length !== 1) {
    fail(
      "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
      `${fileName} must import its canonical harness exactly once from ${moduleName}.`,
    );
  }
  const clause = imports[0].importClause;
  const observed = [];
  if (clause?.name !== undefined) observed.push(clause.name.text);
  if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
    if (clause.namedBindings.elements.some((element) => element.propertyName !== undefined)) {
      fail(
        "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
        `${fileName} cannot alias canonical harness bindings.`,
      );
    }
    observed.push(...clause.namedBindings.elements.map(({ name }) => name.text));
  }
  assertArrayEqual(
    observed.sort(),
    [...expectedBindings].sort(),
    "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
    `${fileName} harness imports`,
  );
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

function isDirectPackageRegistration(call) {
  const statement = call.parent;
  const block = statement?.parent;
  const callback = block?.parent;
  const describeCall = callback?.parent;
  return (
    ts.isExpressionStatement(statement) &&
    ts.isBlock(block) &&
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
    ts.isCallExpression(describeCall) &&
    ts.isIdentifier(describeCall.expression) &&
    describeCall.expression.text === "describe" &&
    describeCall.arguments[1] === callback &&
    ts.isExpressionStatement(describeCall.parent) &&
    ts.isSourceFile(describeCall.parent.parent)
  );
}

function collectDirectTests(sourceText, fileName, kind, expectedTitles) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    kind === "package" ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  if (kind === "package") {
    verifyNamedImport(sourceFile, "vitest", ["describe", "expect", "it", "vi"], fileName);
  } else {
    verifyNamedImport(sourceFile, "node:assert/strict", ["assert"], fileName);
    verifyNamedImport(sourceFile, "node:test", ["test"], fileName);
  }
  const binding = kind === "package" ? "it" : "test";
  const titles = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (
        kind === "package" &&
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === "it" &&
        node.expression.expression.name.text === "each"
      ) {
        const table = unwrapExpression(node.expression.arguments[0]);
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (
          !ts.isArrayLiteralExpression(table) ||
          !ts.isStringLiteral(title) ||
          !title.text.includes("%s") ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
          !isDirectPackageRegistration(node)
        ) {
          fail(
            "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
            `${fileName} uses an unreviewed it.each registration shape.`,
          );
        }
        for (const rowNode of table.elements) {
          const row = unwrapExpression(rowNode);
          const label =
            ts.isArrayLiteralExpression(row) && row.elements.length > 0
              ? unwrapExpression(row.elements[0])
              : undefined;
          if (label === undefined || !ts.isStringLiteral(label)) {
            fail(
              "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
              `${fileName} it.each rows require literal string evidence labels.`,
            );
          }
          titles.push(title.text.replace("%s", label.text));
        }
        return;
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === binding
      ) {
        fail(
          "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
          `${fileName} contains modified ${binding}.${node.expression.name.text} registration.`,
        );
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === binding) {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        const direct =
          kind === "package"
            ? isDirectPackageRegistration(node)
            : ts.isExpressionStatement(node.parent) && ts.isSourceFile(node.parent.parent);
        if (
          !ts.isStringLiteral(title) ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
          !direct
        ) {
          fail(
            "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
            `${fileName} uses a conditional, indirect, or non-literal test registration.`,
          );
        }
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (titles.length !== new Set(titles).size) {
    fail("VARIANT_STYLE_TEST_INVENTORY_DRIFT", `${fileName} has duplicate test titles.`);
  }
  assertArrayEqual(
    [...titles].sort(),
    [...expectedTitles].sort(),
    "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
    `${fileName} direct test inventory`,
  );
  return Object.freeze(titles.sort());
}

function compilerNegativeLabels(sourceText) {
  return [...sourceText.matchAll(/@ts-expect-error[ \t]+([^\r\n]+)/gu)].map((match) =>
    match[1].trim(),
  );
}

function verifyTestInventory({ packageTests, typeTests, workspaceTypeTests, rootTests }) {
  const packageTitles = collectDirectTests(
    packageTests,
    "variant-style-evaluation.test.ts",
    "package",
    REQUIRED_PACKAGE_TEST_TITLES,
  );
  const rootTitles = collectDirectTests(
    rootTests,
    "runtime-core-variant-style-evaluation.test.mjs",
    "root",
    REQUIRED_ROOT_TEST_TITLES,
  );
  const labels = compilerNegativeLabels(typeTests);
  const workspaceLabels = compilerNegativeLabels(workspaceTypeTests);
  assertArrayEqual(
    labels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
    "M04-T05 compiler-negative descriptions",
  );
  assertArrayEqual(
    workspaceLabels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "VARIANT_STYLE_TEST_INVENTORY_DRIFT",
    "Tracked M04-T05 compiler-negative descriptions",
  );
  return Object.freeze({
    packageTests: packageTitles.length,
    packageTestTitles: packageTitles,
    compilerNegativeCases: labels.length,
    compilerNegativeLabels: Object.freeze(labels),
    rootMutationTests: rootTitles.length,
    rootTestTitles: rootTitles,
  });
}

function verifyPackageAndRootWiring(packageManifest, rootManifest) {
  if (
    packageManifest.name !== "@desen/runtime-core" ||
    packageManifest.scripts?.["test:variant-style-evaluation"] !== EXPECTED_PACKAGE_TEST_SCRIPT
  ) {
    fail(
      "VARIANT_STYLE_PACKAGE_CONTRACT_DRIFT",
      "The runtime-core focused M04-T05 test command changed.",
    );
  }
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootManifest.scripts?.[name] !== command) {
      fail("VARIANT_STYLE_ROOT_SCRIPT_DRIFT", `Root command ${name} changed.`, {
        expected: command,
        actual: rootManifest.scripts?.[name],
      });
    }
  }
  const verifyToken = "pnpm verify:runtime-core-variant-style-evaluation";
  const testToken = "pnpm test:runtime-core-variant-style-evaluation";
  const check = String(rootManifest.scripts?.check ?? "").split(" && ");
  const tests = String(rootManifest.scripts?.test ?? "").split(" && ");
  if (
    check.filter((segment) => segment === verifyToken).length !== 1 ||
    tests.filter((segment) => segment === testToken).length !== 1 ||
    check.indexOf(verifyToken) <= check.indexOf("pnpm verify:runtime-core-predicate-evaluation") ||
    tests.indexOf(testToken) <= tests.indexOf("pnpm test:runtime-core-predicate-evaluation")
  ) {
    fail(
      "VARIANT_STYLE_ROOT_SCRIPT_DRIFT",
      "Aggregate check/test commands must include M04-T05 exactly once after M04-T04.",
    );
  }
}

function verifyTrace(trace) {
  const observed = [];
  for (const expected of EXPECTED_TRACE_RULES) {
    const item = trace[expected.collection]?.find((candidate) => candidate.id === expected.id);
    if (
      item === undefined ||
      item.section !== expected.section ||
      !isDeepStrictEqual(item.owners, expected.owners)
    ) {
      fail("VARIANT_STYLE_TRACE_DRIFT", `${expected.id} ownership changed.`, {
        expected,
        actual: item,
      });
    }
    observed.push(expected);
  }
  return Object.freeze(observed);
}

function verifyDocumentation({ findings, normativeCoverage, proofDocument }) {
  const normalizeMarkdownClaim = (value) => value.replaceAll("`", "").replaceAll(/\s+/gu, " ");
  const normalizedFindings = normalizeMarkdownClaim(findings);
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!normalizedFindings.includes(normalizeMarkdownClaim(required))) {
      fail("VARIANT_STYLE_FINDING_DRIFT", `PF-035 is missing: ${required}`);
    }
  }
  const normativeLines = normativeCoverage
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("| N-014 |"));
  const normativeLine = normativeLines[0];
  const cells = normativeLine?.split("|").map((cell) => cell.trim());
  const owners = String(cells?.[4] ?? "")
    .split(",")
    .map((owner) => owner.trim());
  const status = cells?.[5];
  const evidence = String(cells?.[6] ?? "");
  const retainsTaskTimeSlice =
    owners.includes("M04-T05") && evidence.includes("M04-T05") && /variant/iu.test(evidence);
  const successorPin =
    `\`${CURRENT_N014_SUCCESSOR.artifactPath}\` ` +
    `\`sha256:${CURRENT_N014_SUCCESSOR.artifactSha256}\``;
  const currentSuccessor =
    normativeLines.length === 1 &&
    status === CURRENT_N014_SUCCESSOR.status &&
    retainsTaskTimeSlice &&
    owners.includes(CURRENT_N014_SUCCESSOR.task) &&
    evidence.includes(CURRENT_N014_SUCCESSOR.task) &&
    evidence.split(CURRENT_N014_SUCCESSOR.artifactPath).length === 2 &&
    evidence.split(CURRENT_N014_SUCCESSOR.artifactSha256).length === 2 &&
    evidence.split(successorPin).length === 2;
  if (!currentSuccessor) {
    fail(
      "VARIANT_STYLE_NORMATIVE_DRIFT",
      "N-014 must retain the M04-T05 task-time slice and the exact M08-T03 tested successor.",
      { line: normativeLine },
    );
  }
  const normalizedProofDocument = normalizeMarkdownClaim(proofDocument);
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!normalizedProofDocument.includes(normalizeMarkdownClaim(required))) {
      fail("VARIANT_STYLE_DOCUMENTATION_DRIFT", `Proof document is missing: ${required}`);
    }
  }
  return Object.freeze({
    normativeClause: "N-014",
    normativeStatus: "PLANNED",
    finding: "PF-035",
  });
}

async function verifyPrerequisite({
  task,
  artifactName,
  trackedPath,
  injectedBytes,
  verifyFresh,
  verifyFunction,
}) {
  const trackedBytes = await readFile(trackedPath);
  if (injectedBytes !== undefined && !byteEqual(injectedBytes, trackedBytes)) {
    fail(
      "VARIANT_STYLE_PREREQUISITE_DRIFT",
      `Injected ${task} prerequisite bytes differ from the tracked artifact.`,
    );
  }
  const bytes = injectedBytes ?? trackedBytes;
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("VARIANT_STYLE_PREREQUISITE_DRIFT", `${task} prerequisite is not valid JSON.`);
  }
  if (parsed.task !== task || parsed.result !== "PASS") {
    fail("VARIANT_STYLE_PREREQUISITE_DRIFT", `${task} prerequisite identity/result changed.`);
  }
  if (verifyFresh) {
    try {
      await verifyFunction({ artifactPath: trackedPath, artifactBytes: bytes });
    } catch (error) {
      fail("VARIANT_STYLE_PREREQUISITE_DRIFT", `${task} prerequisite verification failed.`, {
        cause: String(error),
      });
    }
  }
  return Object.freeze({
    task,
    result: "PASS",
    artifact: artifactName,
    artifactSha256: sha256(bytes),
  });
}

async function verifyPrerequisites(options) {
  return Object.freeze([
    await verifyPrerequisite({
      task: "M04-T03",
      artifactName: "runtime-core-0.1.0-token-format-resolution.json",
      trackedPath: DEFAULT_RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ARTIFACT_PATH,
      injectedBytes: options.tokenFormatPrerequisiteArtifactBytes,
      verifyFresh: options.verifyPrerequisites !== false,
      verifyFunction: verifyRuntimeCoreTokenFormatResolutionEvidence,
    }),
    await verifyPrerequisite({
      task: "M04-T04",
      artifactName: "runtime-core-0.1.0-predicate-evaluation.json",
      trackedPath: DEFAULT_RUNTIME_CORE_PREDICATE_EVALUATION_ARTIFACT_PATH,
      injectedBytes: options.predicatePrerequisiteArtifactBytes,
      verifyFresh: options.verifyPrerequisites !== false,
      verifyFunction: verifyRuntimeCorePredicateEvaluationEvidence,
    }),
  ]);
}

function runtimeSnapshot(api, state = {}) {
  return api.createRuntimeResolutionSnapshot({
    state,
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web", viewport: { width: 1024 } },
  });
}

function runtimeContext(resolve) {
  return {
    requestContext: {
      documentId: "proof-document",
      revision: "sha256:proof-revision",
      surfaceId: "proof-surface",
      requestId: "proof-turn",
    },
    tokens: { resolve },
  };
}

function proofInput() {
  return {
    props: {
      config: { baseOnly: true, shared: "base" },
      label: "Base",
      preserved: 0,
    },
    style: {
      base: {
        root: {
          color: "base-color",
          padding: 8,
        },
      },
      hover: {
        root: {
          opacity: 0.5,
        },
      },
    },
    variants: [
      {
        when: { op: "eq", args: [{ $token: "mode" }, "compact"] },
        props: {
          config: { firstOnly: true, shared: "first" },
          label: "First",
        },
        style: {
          base: {
            root: {
              color: "first-color",
            },
          },
        },
      },
      {
        when: {
          op: "all",
          args: [
            { op: "truthy", args: [{ $ref: "state.enabled" }] },
            { op: "eq", args: [{ $token: "mode" }, "compact"] },
          ],
        },
        props: { label: "Second", nullable: null },
        style: {
          base: {
            root: {
              color: "second-color",
            },
          },
        },
      },
      {
        when: { op: "gt", args: ["wrong-kind", 2] },
        props: { ignoredMismatch: true },
      },
      {
        when: { op: "truthy", args: [{ $ref: "state.afterMismatch" }] },
        style: {
          focus: {
            root: {
              outline: "kept-after-mismatch",
            },
          },
        },
      },
      {
        when: { op: "truthy", args: [false] },
        props: { ignoredFalse: true },
      },
    ],
  };
}

function expectedProofResult() {
  return {
    status: "evaluated",
    effectiveProps: {
      config: { firstOnly: true, shared: "first" },
      label: "Second",
      nullable: null,
      preserved: 0,
    },
    effectiveStyle: {
      base: {
        root: {
          color: "second-color",
          padding: 8,
        },
      },
      focus: {
        root: {
          outline: "kept-after-mismatch",
        },
      },
      hover: {
        root: {
          opacity: 0.5,
        },
      },
    },
    sources: {
      props: {
        config: "/variants/0/props/config",
        label: "/variants/1/props/label",
        nullable: "/variants/1/props/nullable",
        preserved: "/props/preserved",
      },
      style: {
        base: {
          root: {
            color: "/variants/1/style/base/root/color",
            padding: "/style/base/root/padding",
          },
        },
        focus: {
          root: {
            outline: "/variants/3/style/focus/root/outline",
          },
        },
        hover: {
          root: {
            opacity: "/style/hover/root/opacity",
          },
        },
      },
    },
    matchingVariantIndices: [0, 1, 3],
    diagnostics: [{ code: "PREDICATE_TYPE_MISMATCH", pointer: "/variants/2/when/args/1" }],
  };
}

function probeRuntimeBehavior(api, protocolApi) {
  if (
    typeof api.createRuntimeResolutionSnapshot !== "function" ||
    typeof api.evaluateRuntimeVariantOverrides !== "function" ||
    typeof protocolApi.canonicalizeJson !== "function"
  ) {
    fail("VARIANT_STYLE_RUNTIME_API_DRIFT", "The built M04-T05 runtime API is incomplete.");
  }
  const snapshot = runtimeSnapshot(api, { enabled: true, afterMismatch: true });
  const tokenRequests = [];
  const context = runtimeContext((request) => {
    tokenRequests.push(plainData(request));
    return request.token === "mode"
      ? { status: "resolved", value: "compact" }
      : { status: "missing" };
  });
  const input = proofInput();
  const result = api.evaluateRuntimeVariantOverrides(input, snapshot, context);
  assertDataEqual(result, expectedProofResult(), "Base-first ordered variant composition");
  assertDataEqual(
    tokenRequests,
    [
      {
        token: "mode",
        context: {
          documentId: "proof-document",
          requestId: "proof-turn",
          revision: "sha256:proof-revision",
          surfaceId: "proof-surface",
        },
      },
    ],
    "Turn-scoped token cache",
  );
  assertDeepFrozen(result, "Variant/style result");
  input.props.label = "caller-mutated";
  input.variants[0].props.config.shared = "caller-mutated";
  if (result.effectiveProps.label !== "Second" || result.effectiveProps.config.shared !== "first") {
    fail("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT", "The result retained caller-owned mutable input.");
  }

  const validationTokenRequests = [];
  const rawValueSpecResult = api.evaluateRuntimeVariantOverrides(
    {
      props: {
        label: {
          $format: {
            template: "{value}{value}",
            values: { value: { $ref: "state.large" } },
          },
        },
        rawReference: { $ref: "state.large" },
      },
      variants: [
        {
          when: { op: "eq", args: [true, true] },
          props: { label: "winner" },
        },
      ],
    },
    runtimeSnapshot(api, { large: "x".repeat(600_000) }),
    runtimeContext((request) => {
      validationTokenRequests.push(plainData(request));
      return { status: "resolved", value: "must-not-run" };
    }),
  );
  assertDataEqual(
    rawValueSpecResult,
    {
      status: "evaluated",
      effectiveProps: {
        label: "winner",
        rawReference: { $ref: "state.large" },
      },
      effectiveStyle: {},
      sources: {
        props: {
          label: "/variants/0/props/label",
          rawReference: "/props/rawReference",
        },
        style: {},
      },
      matchingVariantIndices: [0],
      diagnostics: [],
    },
    "Raw ValueSpec validation without snapshot materialization",
  );
  assertDataEqual(validationTokenRequests, [], "Raw ValueSpec validation token-provider isolation");

  const numericNamesResult = api.evaluateRuntimeVariantOverrides(
    {
      props: {
        10: "base-ten",
        2: "two",
        a: "letter",
      },
      variants: [
        {
          when: { op: "eq", args: [true, true] },
          props: { 10: "variant-ten" },
        },
      ],
    },
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  if (
    numericNamesResult.status !== "evaluated" ||
    Reflect.ownKeys(numericNamesResult.effectiveProps).length !== 3 ||
    !Object.hasOwn(numericNamesResult.effectiveProps, "2") ||
    !Object.hasOwn(numericNamesResult.effectiveProps, "10") ||
    !Object.hasOwn(numericNamesResult.effectiveProps, "a") ||
    numericNamesResult.effectiveProps["2"] !== "two" ||
    numericNamesResult.effectiveProps["10"] !== "variant-ten" ||
    numericNamesResult.effectiveProps.a !== "letter" ||
    numericNamesResult.sources.props["2"] !== "/props/2" ||
    numericNamesResult.sources.props["10"] !== "/variants/0/props/10" ||
    numericNamesResult.sources.props.a !== "/props/a"
  ) {
    fail(
      "VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT",
      "Numeric prop-name completeness or provenance changed.",
    );
  }
  assertDeepFrozen(numericNamesResult, "Numeric prop-name result");
  assertDataEqual(
    [
      protocolApi.canonicalizeJson(numericNamesResult.effectiveProps),
      protocolApi.canonicalizeJson(numericNamesResult.sources.props),
    ],
    [
      '{"10":"variant-ten","2":"two","a":"letter"}',
      '{"10":"/variants/0/props/10","2":"/props/2","a":"/props/a"}',
    ],
    "Explicit canonical serialization of numeric prop maps",
  );

  const prevalidationTokenRequests = [];
  const predicatePrevalidationResult = api.evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: { op: "eq", args: [{ $token: "must-not-run" }, true] },
          props: { partial: "must-not-escape" },
        },
        {
          when: {
            op: "truthy",
            args: [{ $format: { template: "{missing}", values: {} } }],
          },
          props: { unreachable: true },
        },
      ],
    },
    snapshot,
    runtimeContext((request) => {
      prevalidationTokenRequests.push(plainData(request));
      return { status: "resolved", value: true };
    }),
  );
  assertDataEqual(
    predicatePrevalidationResult,
    {
      status: "invalid",
      pointer: "/variants/1/when/args/0/$format/template",
      reason: "malformed-format",
    },
    "Whole-input predicate-format prevalidation",
  );
  assertDataEqual(
    prevalidationTokenRequests,
    [],
    "Predicate-format prevalidation provider isolation",
  );

  const nestedFormatTokenRequests = [];
  const nestedFormatResult = api.evaluateRuntimeVariantOverrides(
    {
      props: {
        label: {
          $format: {
            template: "{outerMissing}",
            values: {
              nested: {
                $format: {
                  template: "{innerMissing}",
                  values: {},
                },
              },
            },
          },
        },
      },
    },
    snapshot,
    runtimeContext((request) => {
      nestedFormatTokenRequests.push(plainData(request));
      return { status: "resolved", value: "must-not-run" };
    }),
  );
  assertDataEqual(
    nestedFormatResult,
    {
      status: "invalid",
      pointer: "/props/label/$format/template",
      reason: "malformed-format",
    },
    "Outer-before-nested format-profile error precedence",
  );
  assertDataEqual(
    nestedFormatTokenRequests,
    [],
    "Nested format-profile validation provider isolation",
  );

  const reverseInput = {
    variants: [
      { when: { op: "truthy", args: [true] }, props: { label: "later-before-reverse" } },
      { when: { op: "truthy", args: [true] }, props: { label: "document-last" } },
    ],
  };
  const ordered = api.evaluateRuntimeVariantOverrides(
    reverseInput,
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  reverseInput.variants.reverse();
  const reversed = api.evaluateRuntimeVariantOverrides(
    reverseInput,
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  if (
    ordered.status !== "evaluated" ||
    reversed.status !== "evaluated" ||
    ordered.effectiveProps.label !== "document-last" ||
    reversed.effectiveProps.label !== "later-before-reverse"
  ) {
    fail(
      "VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT",
      "Variant array order no longer changes overlapping precedence.",
    );
  }

  const pairedRequests = [];
  const paired = api.evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: { op: "eq", args: [{ $token: "left" }, "L"] },
          props: { left: true },
        },
        {
          when: { op: "eq", args: [{ $token: "right" }, "R"] },
          props: { right: true },
        },
      ],
    },
    snapshot,
    runtimeContext((request) => {
      pairedRequests.push(request.token);
      return { status: "resolved", value: request.token === "left" ? "L" : "R" };
    }),
  );
  if (
    paired.status !== "evaluated" ||
    paired.matchingVariantIndices.join(",") !== "0,1" ||
    paired.effectiveProps.left !== true ||
    paired.effectiveProps.right !== true ||
    pairedRequests.join(",") !== "left,right"
  ) {
    fail(
      "VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT",
      "Materialized outcomes no longer pair with their prepared operand positions.",
    );
  }

  const missing = api.evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: { op: "truthy", args: [{ $token: "missing" }] },
          props: { shouldStayAbsent: true },
        },
        {
          when: { op: "truthy", args: [{ $ref: "state.missing" }] },
          props: { alsoAbsent: true },
        },
      ],
    },
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  if (
    missing.status !== "evaluated" ||
    missing.matchingVariantIndices.length !== 0 ||
    Object.keys(missing.effectiveProps).length !== 0
  ) {
    fail(
      "VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT",
      "Missing predicate operands no longer remain ordinary false conditions.",
    );
  }

  const providerFailure = api.evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: { op: "truthy", args: [{ $token: "failure" }] },
          props: { unreachable: true },
        },
      ],
    },
    snapshot,
    runtimeContext(() => {
      throw new Error("secret provider detail");
    }),
  );
  assertDataEqual(
    providerFailure,
    {
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/variants/0/when/args/0/$token",
      adapter: "token-provider",
    },
    "Redacted token-provider failure",
  );
  if (JSON.stringify(providerFailure).includes("secret provider detail")) {
    fail("VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT", "Provider failure leaked raw error data.");
  }

  const structural = api.evaluateRuntimeVariantOverrides(
    { slots: { default: [] } },
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  assertDataEqual(
    structural,
    { status: "invalid", pointer: "/slots", reason: "malformed-variant-overrides" },
    "Structural root widening rejection",
  );
  const variantStructural = api.evaluateRuntimeVariantOverrides(
    {
      variants: [
        {
          when: { op: "truthy", args: [true] },
          props: { label: "safe" },
          slots: { default: [] },
        },
      ],
    },
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  assertDataEqual(
    variantStructural,
    {
      status: "invalid",
      pointer: "/variants/0/slots",
      reason: "malformed-variant-overrides",
    },
    "Structural variant widening rejection",
  );

  let getterCalls = 0;
  const hostile = {};
  Object.defineProperty(hostile, "props", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return {};
    },
  });
  const hostileResult = api.evaluateRuntimeVariantOverrides(
    hostile,
    snapshot,
    runtimeContext(() => ({ status: "missing" })),
  );
  if (
    hostileResult.status !== "invalid" ||
    hostileResult.reason !== "unsafe-or-unbounded-json" ||
    getterCalls !== 0
  ) {
    fail(
      "VARIANT_STYLE_RUNTIME_BEHAVIOR_DRIFT",
      "Hostile accessors no longer fail closed without execution.",
    );
  }

  const repeated = api.evaluateRuntimeVariantOverrides(
    proofInput(),
    runtimeSnapshot(api, { enabled: true, afterMismatch: true }),
    runtimeContext(() => ({ status: "resolved", value: "compact" })),
  );
  assertDataEqual(repeated, expectedProofResult(), "Repeated deterministic evaluation");

  return Object.freeze({
    orderProbes: 2,
    mergeProbes: 8,
    tokenSessionProbes: 3,
    positionPairingProbes: 2,
    missingOperandProbes: 2,
    providerFailureProbes: 1,
    structuralRejectionProbes: 2,
    hostileInputProbes: 1,
    diagnosticProbes: 2,
    matchingVariantProbes: 3,
    rawValueSpecValidationProbes: 1,
    numericPropNameProbes: 1,
    canonicalSerializationProbes: 2,
    predicatePrevalidationProbes: 1,
    nestedFormatPrecedenceProbes: 1,
    tokenRequests: tokenRequests.length,
    platformEffects: 0,
    partialOutputs: false,
  });
}

async function trackedFiles(fileOverrides) {
  return Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const taskTimeReaderReceipt = TASK_TIME_READER_RECEIPTS.get(relativePath);
      if (
        taskTimeReaderReceipt !== undefined &&
        !Object.hasOwn(fileOverrides ?? {}, relativePath)
      ) {
        return taskTimeReaderReceipt;
      }
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
 * Builds deterministic M04-T05 evidence from fresh source, distribution, tests, and runtime probes.
 */
export async function buildRuntimeCoreVariantStyleEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    prerequisites,
    sourceText,
    sourceIndexText,
    declarationText,
    builtJavaScript,
    builtIndexDeclarationText,
    builtIndexJavaScript,
    packageTests,
    typeTests,
    workspaceTypeTests,
    rootTests,
    packageText,
    rootPackageText,
    traceText,
    findings,
    normativeCoverage,
    proofDocument,
    tracked,
  ] = await Promise.all([
    verifyPrerequisites(normalized),
    readWorkspaceText("packages/runtime-core/src/variant-style-evaluation.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/variant-style-evaluation.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/variant-style-evaluation.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/variant-style-evaluation.test.ts", fileOverrides),
    readWorkspaceText(
      "packages/runtime-core/test/variant-style-evaluation.types.ts",
      fileOverrides,
    ),
    readWorkspaceText("packages/runtime-core/test/variant-style-evaluation.types.ts"),
    readWorkspaceText("tests/runtime-core-variant-style-evaluation.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-VARIANT-STYLE-EVALUATION.md", fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let packageManifest;
  let rootManifest;
  let trace;
  try {
    packageManifest = JSON.parse(packageText);
    rootManifest = JSON.parse(rootPackageText);
    trace = JSON.parse(traceText);
  } catch {
    fail("VARIANT_STYLE_METADATA_INVALID", "Package or trace metadata is not valid JSON.");
  }

  const publicApi = verifySourceAndDistribution({
    sourceText,
    sourceIndexText,
    declarationText,
    builtJavaScript,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const testInventory = verifyTestInventory({
    packageTests,
    typeTests,
    workspaceTypeTests,
    rootTests,
  });
  verifyPackageAndRootWiring(packageManifest, rootManifest);
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation({ findings, normativeCoverage, proofDocument });
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const protocolApi = normalized.protocolApi ?? (await import(PROTOCOL_API_URL.href));
  const runtime = probeRuntimeBehavior(runtimeApi, protocolApi);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T05",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Base prop/style ValueSpecs and every matching variant compose deterministically in document order through one immutable snapshot and one turn-scoped token session.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites,
    publicApi,
    runtime,
    variantSemantics: Object.freeze({
      baseAppliedFirst: true,
      matchingVariantOrder: "document order",
      laterMatchingPathWins: true,
      propReplacementPath: "/props/{name}",
      propNestedMerge: false,
      styleReplacementPath: "/style/{state}/{part}/{property}",
      styleNestedMerge: false,
      nullDeletesPath: false,
      visualStateCascade: false,
      structuralMutation: false,
      extensionSemantics: false,
      output: "detached frozen effective raw ValueSpecs and exact winning source pointers",
      tokenSession: "one turn-scoped cache across every variant predicate",
      operandPairing: "exact prepared position",
    }),
    limits: Object.freeze({
      maxValueDepth: 128,
      maxJsonNodes: 4_096,
      maxStringCodeUnits: 1_048_576,
      partialResults: false,
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
      packageTests: testInventory.packageTests,
      compilerNegativeCases: testInventory.compilerNegativeCases,
      compilerNegativeLabels: testInventory.compilerNegativeLabels,
      rootMutationTests: testInventory.rootMutationTests,
      traceRules,
      trackedFiles: tracked,
      rootScripts: Object.freeze(Object.keys(ROOT_SCRIPTS)),
    }),
    deferred: Object.freeze([
      "effective prop and style ValueSpec materialization (M05-T02/M05-T03)",
      "consumer capability-schema validation and adapter delivery (M05-T02/M05-T03)",
      "active visual-state selection and framework styling (M05-T03)",
      "repeat scopes and runtime instance identity (M04-T07)",
      "reactive reevaluation and stale-result protection (M04-T15)",
      "complete headless sign-in observable trace (M04-T16)",
      "React, browser, iOS, Android, SwiftUI, and Compose adapters",
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
    fail("VARIANT_STYLE_ARTIFACT_MISSING", "M04-T05 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("VARIANT_STYLE_ARTIFACT_UNSAFE", "M04-T05 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T05 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreVariantStyleEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreVariantStyleEvaluationEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!byteEqual(actualBytes, expected.artifactBytes)) {
    fail("VARIANT_STYLE_ARTIFACT_DRIFT", "M04-T05 artifact differs from fresh evidence.", {
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
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    orderProbes: expected.artifact.runtime.orderProbes,
    mergeProbes: expected.artifact.runtime.mergeProbes,
    tokenSessionProbes: expected.artifact.runtime.tokenSessionProbes,
    positionPairingProbes: expected.artifact.runtime.positionPairingProbes,
    missingOperandProbes: expected.artifact.runtime.missingOperandProbes,
    providerFailureProbes: expected.artifact.runtime.providerFailureProbes,
    structuralRejectionProbes: expected.artifact.runtime.structuralRejectionProbes,
    hostileInputProbes: expected.artifact.runtime.hostileInputProbes,
    diagnosticProbes: expected.artifact.runtime.diagnosticProbes,
    matchingVariantProbes: expected.artifact.runtime.matchingVariantProbes,
    rawValueSpecValidationProbes: expected.artifact.runtime.rawValueSpecValidationProbes,
    numericPropNameProbes: expected.artifact.runtime.numericPropNameProbes,
    canonicalSerializationProbes: expected.artifact.runtime.canonicalSerializationProbes,
    predicatePrevalidationProbes: expected.artifact.runtime.predicatePrevalidationProbes,
    nestedFormatPrecedenceProbes: expected.artifact.runtime.nestedFormatPrecedenceProbes,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T05 evidence after every proof check passes. */
export async function writeRuntimeCoreVariantStyleEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreVariantStyleEvaluationEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreVariantStyleEvaluationEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T05 evidence boundary. */
export const RUNTIME_CORE_VARIANT_STYLE_EVALUATION_ROOT_SCRIPTS = Object.freeze(
  Object.keys(ROOT_SCRIPTS),
);
