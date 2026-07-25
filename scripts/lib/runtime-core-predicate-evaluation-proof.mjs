import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH,
  verifyRuntimeCoreValueResolutionEvidence,
} from "./runtime-core-value-resolution-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const PREDICATE_MODULE_API_URL = new URL(
  "../../packages/runtime-core/dist/predicate-evaluation.js",
  import.meta.url,
);

/** Absolute path to the deterministic M04-T04 predicate-evaluation evidence artifact. */
export const DEFAULT_RUNTIME_CORE_PREDICATE_EVALUATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-predicate-evaluation.json",
);

const EXPECTED_SOURCE_RUNTIME_EXPORTS = Object.freeze([
  "evaluatePreparedRuntimePredicate",
  "evaluateRuntimeConditionalPresence",
  "evaluateRuntimePredicate",
  "prepareRuntimePredicateEvaluation",
  "resolveRuntimePredicateOperands",
]);
const EXPECTED_PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "evaluateRuntimeConditionalPresence",
  "evaluateRuntimePredicate",
]);
const EXPECTED_INTERNAL_RUNTIME_EXPORTS = Object.freeze([
  "evaluatePreparedRuntimePredicate",
  "prepareRuntimePredicateEvaluation",
  "resolveRuntimePredicateOperands",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeConditionalPresence",
  "RuntimePredicateArgument",
  "RuntimePredicateDeferred",
  "RuntimePredicateEvaluated",
  "RuntimePredicateEvaluation",
  "RuntimePredicateInvalid",
  "RuntimePredicateInvalidReason",
  "RuntimePredicateOperator",
  "RuntimePredicateSpec",
  "RuntimePredicateTypeMismatch",
]);
const EXPECTED_OPERATORS = Object.freeze([
  "all",
  "any",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "exists",
  "truthy",
]);
const ALLOWED_SOURCE_MODULES = Object.freeze([
  "@desen/protocol",
  "./host-ports.js",
  "./value-resolution.js",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-021",
    section: "24.2",
    owners: Object.freeze(["M04-T04", "M04-T05", "M04-T07"]),
    status: "PREDICATE_STAGE_ONLY_VARIANTS_AND_REPEATS_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-050",
    section: "15",
    owners: Object.freeze(["M02-T10", "M04-T04"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-051",
    section: "15.1",
    owners: Object.freeze(["M02-T10", "M04-T04"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-052",
    section: "15.1",
    owners: Object.freeze(["M02-T10", "M04-T04", "M06-T05"]),
    status: "RUNTIME_DYNAMIC_DIAGNOSTIC_PUBLICATION_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-053",
    section: "15.2",
    owners: Object.freeze(["M04-T04", "M04-T15"]),
    status: "SNAPSHOT_PRIMITIVE_REACTIVE_COMPOSITION_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-059",
    section: "17.4",
    owners: Object.freeze(["M04-T04", "M04-T15"]),
    status: "PRESENCE_DECISION_ONLY_SUBTREE_LIFECYCLE_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-073",
    section: "20",
    owners: Object.freeze(["M02-T11", "M04-T04", "M08-T06"]),
    status: "GUARD_DECISION_ONLY_ACTION_EXECUTION_DEFERRED",
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-021",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T04"]),
    status: "RUNTIME_PRIMITIVE",
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-034 — Runtime predicate and conditional-presence evaluation requires a deterministic profile",
  "Evaluation is recursive left-to-right by argument position and does not short-circuit",
  "A direct unresolved operand makes the current predicate false",
  "Ordered strings use exact lexicographic UTF-16 code-unit order",
  "exists accepts one original reference, bypasses and does not evaluate its fallback",
  "at most 64 total predicate nodes (the root plus 63 nested nodes) and 4,096 aggregate argument occurrences",
  "M04-T02 deferred token or format outcomes are not boolean false",
  "Conditional presence returns only a decision",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-predicate-evaluation":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:predicate-evaluation && node scripts/generate-runtime-core-predicate-evaluation-proof.mjs",
  "verify:runtime-core-predicate-evaluation":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:predicate-evaluation && node scripts/verify-runtime-core-predicate-evaluation.mjs",
  "test:runtime-core-predicate-evaluation":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:predicate-evaluation && node --test tests/runtime-core-predicate-evaluation.test.mjs",
});
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/predicate-evaluation.test.ts";
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/predicate-evaluation.ts",
  "packages/runtime-core/test/predicate-evaluation.test.ts",
  "packages/runtime-core/test/predicate-evaluation.types.ts",
  "packages/runtime-core/dist/predicate-evaluation.js",
  "packages/runtime-core/dist/predicate-evaluation.js.map",
  "packages/runtime-core/dist/predicate-evaluation.d.ts",
  "packages/runtime-core/dist/predicate-evaluation.d.ts.map",
  "scripts/lib/runtime-core-predicate-evaluation-proof.mjs",
  "scripts/generate-runtime-core-predicate-evaluation-proof.mjs",
  "scripts/verify-runtime-core-predicate-evaluation.mjs",
  "tests/runtime-core-predicate-evaluation.test.mjs",
]);
const REQUIRED_PACKAGE_TEST_TITLES = Object.freeze([
  "implements the closed all operator",
  "implements the closed any operator",
  "implements the closed not operator",
  "implements the closed eq operator",
  "implements the closed neq operator",
  "implements the closed gt operator",
  "implements the closed gte operator",
  "implements the closed lt operator",
  "implements the closed lte operator",
  "implements the closed in operator",
  "implements the closed contains operator",
  "implements the closed exists operator",
  "implements the closed truthy operator",
  "supports the complete one-to-sixty-four boolean composition range",
  "enforces every operator family's exact arity",
  "applies the explicit truthy set to null",
  "applies the explicit truthy set to false",
  "applies the explicit truthy set to zero",
  "applies the explicit truthy set to empty string",
  "applies the explicit truthy set to empty array",
  "applies the explicit truthy set to empty object",
  "applies the explicit truthy set to true",
  "applies the explicit truthy set to negative number",
  "applies the explicit truthy set to non-empty string",
  "applies the explicit truthy set to non-empty array",
  "applies the explicit truthy set to non-empty object",
  "uses canonical JSON identity for equality and array membership",
  "compares only same-kind numbers or UTF-16 strings and reports both incompatible values",
  "keeps in and contains direction explicit for strings, arrays, and empty substrings",
  "tests reference presence itself, including null, without evaluating fallback",
  "keeps the presence probe aligned across all seven namespaces and lifecycle paths",
  "does not short-circuit and preserves depth-first left-to-right diagnostic order",
  "distinguishes direct unresolved operands from a nested predicate that evaluated false",
  "keeps token and format operands deferred instead of guessing a boolean",
  "treats only an exact valid nested predicate as executable predicate data",
  "fails closed for non-object root",
  "fails closed for missing operator",
  "fails closed for unknown operator",
  "fails closed for extra root member",
  "fails closed for empty all",
  "fails closed for too many all",
  "fails closed for wrong unary arity",
  "fails closed for wrong binary arity",
  "fails closed for malformed reference",
  "fails closed for reserved expression key",
  "rejects hostile language objects without invoking accessors or proxy traps beyond reflection",
  "enforces input depth/string limits and the aggregate resolved-value budget",
  "accepts sixty-four predicate nodes and rejects a sixty-fifth",
  "returns recursively frozen outcomes and ordered diagnostics",
  "rejects forged snapshots even when no reference lookup is otherwise necessary",
  "maps omitted, true, and false conditions to explicit instantiation decisions",
  "keeps evaluated false, invalid, and deferred absence distinguishable",
  "freezes every presence decision and retains the snapshot trust boundary",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T04 predicate evidence",
  "two independent predicate evidence builds are byte-identical",
  "rejects stale or one-byte-tampered predicate evidence",
  "rejects closed-operator and canonical-comparison semantic drift",
  "rejects diagnostic-order and no-short-circuit semantic drift",
  "rejects unresolved, deferred, invalid, and exists semantic drift",
  "rejects conditional-presence fail-closed semantic drift",
  "rejects true conditional-presence semantic drift",
  "rejects source, public export, TSDoc, platform, and distribution drift",
  "rejects package, root wiring, skipped tests, and conditional test registration drift",
  "rejects direct trace ownership and PF-034 boundary drift",
  "rejects stale injected M04-T02 prerequisite bytes",
  "atomic predicate writer rejects symlink destinations",
  "atomic predicate writer detects temporary-byte tampering before rename",
]);
const EXPECTED_COMPILER_NEGATIVE_LABELS = Object.freeze([
  "evaluated predicates do not expose deferred forms",
  "deferred predicates never expose a guessed boolean",
  "invalid predicates never expose partial diagnostics",
  "fail-closed presence outcomes carry no partial diagnostics",
  "the operator vocabulary is closed",
  "root predicates cannot select arbitrary executable operators",
  "functions are not inert predicate arguments",
  "predicate specifications are immutable",
  "predicate argument arrays are immutable",
  "predicate evaluation requires an atomic snapshot",
  "package-internal preparation is not a root public API",
  "package-internal resolution is not a root public API",
  "package-internal evaluation is not a root public API",
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
  "FunctionConstructor",
  "Math",
  "RegExp",
  "WebAssembly",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
]);
const FORBIDDEN_PLATFORM_STATIC_CALLS = Object.freeze({
  Object: Object.freeze(["assign", "defineProperties", "defineProperty", "setPrototypeOf"]),
  Reflect: Object.freeze(["defineProperty", "deleteProperty", "get", "set", "setPrototypeOf"]),
});
const BUILTIN_PROTOTYPE_OWNERS = Object.freeze([
  "AggregateError",
  "Array",
  "ArrayBuffer",
  "BigInt",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "DataView",
  "Error",
  "EvalError",
  "FinalizationRegistry",
  "Float32Array",
  "Float64Array",
  "Function",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Map",
  "Number",
  "Object",
  "Promise",
  "RangeError",
  "ReferenceError",
  "RegExp",
  "Set",
  "SharedArrayBuffer",
  "String",
  "Symbol",
  "SyntaxError",
  "TypeError",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
  "URIError",
  "WeakMap",
  "WeakRef",
  "WeakSet",
]);
const FORBIDDEN_LOCALE_MEMBER_CALLS = Object.freeze([
  "localeCompare",
  "toLocaleLowerCase",
  "toLocaleString",
  "toLocaleUpperCase",
]);

/** Stable error class used by deterministic M04-T04 evidence and mutation tests. */
export class RuntimeCorePredicateEvaluationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCorePredicateEvaluationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCorePredicateEvaluationEvidenceError(code, message, details);
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
    fail("PREDICATE_EVALUATION_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T04 contract.`, { expected, actual });
  }
}

function collectExportedDeclarations(sourceText, fileName) {
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
  const unsupportedExportForms = [];
  for (const statement of sourceFile.statements) {
    if (ts.isNamespaceExportDeclaration(statement)) {
      unsupportedExportForms.push("namespace-export");
      continue;
    }
    if (
      ts.isModuleDeclaration(statement) &&
      ((statement.flags & ts.NodeFlags.GlobalAugmentation) !== 0 ||
        ts.isStringLiteral(statement.name) ||
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword))
    ) {
      unsupportedExportForms.push("ambient-module-augmentation");
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      const isDeclarationModuleMarker =
        fileName.endsWith(".d.ts") &&
        statement.moduleSpecifier === undefined &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length === 0;
      if (!isDeclarationModuleMarker) {
        unsupportedExportForms.push("export-declaration");
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      unsupportedExportForms.push(statement.isExportEquals ? "export-equals" : "export-default");
      continue;
    }
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    if (statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
      unsupportedExportForms.push("default-modifier");
      continue;
    }
    let declarationNames = [];
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          unsupportedExportForms.push("non-identifier-export-binding");
          continue;
        }
        declarationNames.push(declaration.name.text);
      }
    } else if (statement.name !== undefined && ts.isIdentifier(statement.name)) {
      declarationNames = [statement.name.text];
    }
    const target =
      ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        ? typeExports
        : runtimeExports;
    target.push(...declarationNames);
    if (declarationNames.length > 0 && ts.getJSDocCommentsAndTags(statement).length === 0) {
      missingTsdoc.push(...declarationNames);
    }
  }
  return Object.freeze({
    sourceFile,
    runtimeExports: Object.freeze(runtimeExports.sort()),
    typeExports: Object.freeze(typeExports.sort()),
    missingTsdoc: Object.freeze(missingTsdoc.sort()),
    unsupportedExportForms: Object.freeze(unsupportedExportForms.sort()),
  });
}

function verifyDirectExportForm(inventory, code, label) {
  if (inventory.unsupportedExportForms.length > 0) {
    fail(
      code,
      `${label} must use only directly exported identifier-named declarations; destructuring, default, named-list, re-export, namespace-export, and ambient-augmentation forms are forbidden.`,
      { unsupportedExportForms: inventory.unsupportedExportForms },
    );
  }
}

function verifySourceImports(sourceFile) {
  const observedModules = [];
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
        "PREDICATE_EVALUATION_IMPORT_BOUNDARY_DRIFT",
        "Predicate evaluation permits only explicit non-aliased named imports.",
      );
    }
    const moduleName = statement.moduleSpecifier.text;
    if (!ALLOWED_SOURCE_MODULES.includes(moduleName)) {
      fail(
        "PREDICATE_EVALUATION_IMPORT_BOUNDARY_DRIFT",
        `Unexpected predicate source dependency ${moduleName}.`,
      );
    }
    observedModules.push(
      Object.freeze({
        module: moduleName,
        typeOnly: statement.importClause.isTypeOnly,
        names: Object.freeze(
          statement.importClause.namedBindings.elements.map((element) => element.name.text).sort(),
        ),
      }),
    );
  }
  if (!observedModules.some(({ module }) => module === "./value-resolution.js")) {
    fail(
      "PREDICATE_EVALUATION_IMPORT_BOUNDARY_DRIFT",
      "M04-T04 must compose the M04-T02 value-resolution primitive.",
    );
  }
  return Object.freeze(observedModules);
}

function verifyPlatformBoundary(sourceFile, code = "PREDICATE_EVALUATION_PLATFORM_BOUNDARY_DRIFT") {
  const forbidden = new Set();

  function unwrapExpression(node) {
    let current = node;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  }

  function staticMember(expression) {
    const unwrapped = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
      return { owner: unwrapped.expression.text, member: unwrapped.name.text };
    }
    if (
      ts.isElementAccessExpression(unwrapped) &&
      ts.isIdentifier(unwrapped.expression) &&
      unwrapped.argumentExpression !== undefined &&
      ts.isStringLiteral(unwrapExpression(unwrapped.argumentExpression))
    ) {
      return {
        owner: unwrapped.expression.text,
        member: unwrapExpression(unwrapped.argumentExpression).text,
      };
    }
    return undefined;
  }

  function memberName(expression) {
    const unwrapped = unwrapExpression(expression);
    if (ts.isPropertyAccessExpression(unwrapped)) return unwrapped.name.text;
    if (
      ts.isElementAccessExpression(unwrapped) &&
      unwrapped.argumentExpression !== undefined &&
      ts.isStringLiteral(unwrapExpression(unwrapped.argumentExpression))
    ) {
      return unwrapExpression(unwrapped.argumentExpression).text;
    }
    return undefined;
  }

  function isBuiltInPrototypeRoot(expression) {
    const member = staticMember(expression);
    return member?.member === "prototype" && BUILTIN_PROTOTYPE_OWNERS.includes(member.owner);
  }

  function targetsBuiltInPrototype(expression) {
    let current = unwrapExpression(expression);
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      if (isBuiltInPrototypeRoot(current)) return true;
      current = unwrapExpression(current.expression);
    }
    return isBuiltInPrototypeRoot(current);
  }

  function isAllowedFunctionToStringCapture(node) {
    const prototypeAccess = node.parent;
    const toStringAccess = prototypeAccess?.parent;
    const declaration = toStringAccess?.parent;
    return (
      ts.isIdentifier(node) &&
      node.text === "Function" &&
      ts.isPropertyAccessExpression(prototypeAccess) &&
      prototypeAccess.expression === node &&
      prototypeAccess.name.text === "prototype" &&
      ts.isPropertyAccessExpression(toStringAccess) &&
      toStringAccess.expression === prototypeAccess &&
      toStringAccess.name.text === "toString" &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer === toStringAccess &&
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "FUNCTION_TO_STRING"
    );
  }

  function isAllowedFunctionPrototypeToStringCapture(node) {
    const toStringAccess = node.parent;
    const declaration = toStringAccess?.parent;
    return (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function" &&
      node.name.text === "prototype" &&
      ts.isPropertyAccessExpression(toStringAccess) &&
      toStringAccess.expression === node &&
      toStringAccess.name.text === "toString" &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer === toStringAccess &&
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "FUNCTION_TO_STRING"
    );
  }

  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_RUNTIME_IDENTIFIERS.includes(node.text)) {
      forbidden.add(node.text);
    }
    if (
      ts.isIdentifier(node) &&
      node.text === "Function" &&
      !isAllowedFunctionToStringCapture(node)
    ) {
      forbidden.add(node.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      forbidden.add("dynamic import");
    }
    const accessedMember =
      ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
        ? staticMember(node)
        : undefined;
    const accessedMemberName =
      ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
        ? memberName(node)
        : undefined;
    if (FORBIDDEN_LOCALE_MEMBER_CALLS.includes(accessedMemberName)) {
      forbidden.add(`locale-sensitive ${accessedMemberName}`);
    }
    if (
      accessedMember !== undefined &&
      Object.hasOwn(FORBIDDEN_PLATFORM_STATIC_CALLS, accessedMember.owner) &&
      FORBIDDEN_PLATFORM_STATIC_CALLS[accessedMember.owner].includes(accessedMember.member)
    ) {
      forbidden.add(`${accessedMember.owner}.${accessedMember.member}`);
    }
    if (isBuiltInPrototypeRoot(node) && !isAllowedFunctionPrototypeToStringCapture(node)) {
      forbidden.add("built-in prototype access");
    }
    const calledMember = ts.isCallExpression(node) ? staticMember(node.expression) : undefined;
    const calledMemberName = ts.isCallExpression(node) ? memberName(node.expression) : undefined;
    if (calledMember?.owner === "Math" && calledMember.member === "random") {
      forbidden.add("Math.random");
    }
    if (FORBIDDEN_LOCALE_MEMBER_CALLS.includes(calledMemberName)) {
      forbidden.add(`locale-sensitive ${calledMemberName}`);
    }
    if (
      calledMember !== undefined &&
      Object.hasOwn(FORBIDDEN_PLATFORM_STATIC_CALLS, calledMember.owner) &&
      FORBIDDEN_PLATFORM_STATIC_CALLS[calledMember.owner].includes(calledMember.member)
    ) {
      forbidden.add(`${calledMember.owner}.${calledMember.member}`);
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(unwrapExpression(node.expression)) &&
      unwrapExpression(node.expression).text === "RegExp"
    ) {
      forbidden.add("dynamic RegExp");
    }
    if (
      (ts.isPropertyAccessExpression(node) && node.name.text === "constructor") ||
      (ts.isElementAccessExpression(node) &&
        node.argumentExpression !== undefined &&
        ts.isStringLiteral(unwrapExpression(node.argumentExpression)) &&
        unwrapExpression(node.argumentExpression).text === "constructor")
    ) {
      forbidden.add("derived Function constructor");
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      targetsBuiltInPrototype(node.left)
    ) {
      forbidden.add("built-in prototype assignment");
    }
    if (
      ((ts.isPrefixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken)) ||
        ts.isPostfixUnaryExpression(node)) &&
      targetsBuiltInPrototype(node.operand)
    ) {
      forbidden.add("built-in prototype update");
    }
    if (ts.isDeleteExpression(node) && targetsBuiltInPrototype(node.expression)) {
      forbidden.add("built-in prototype delete");
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (forbidden.size > 0) {
    fail(code, "Executable evaluation or a platform/global dependency entered M04-T04.", {
      forbidden: [...forbidden].sort(),
    });
  }
}

function nodeContains(node, predicate) {
  let found = false;
  function visit(current) {
    if (found) return;
    if (predicate(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function isIdentifierCall(node, name) {
  return (
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
  );
}

function verifyEarlyAggregateCutoff(sourceFile) {
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "resolveRuntimePredicateOperands",
  );
  if (!ts.isFunctionDeclaration(declaration) || declaration.body === undefined) {
    fail(
      "PREDICATE_EVALUATION_AGGREGATE_CUTOFF_DRIFT",
      "The sequential predicate operand resolver is missing.",
    );
  }
  const statements = [...declaration.body.statements];
  const budgetIndex = statements.findIndex(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (item) => ts.isIdentifier(item.name) && item.name.text === "budget",
      ),
  );
  const loopIndex = statements.findIndex(
    (statement) =>
      ts.isForOfStatement(statement) &&
      ts.isPropertyAccessExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === "prepared" &&
      statement.expression.name.text === "operands",
  );
  const loop = statements[loopIndex];
  if (
    budgetIndex < 0 ||
    loopIndex <= budgetIndex ||
    !ts.isForOfStatement(loop) ||
    !ts.isBlock(loop.statement)
  ) {
    fail(
      "PREDICATE_EVALUATION_AGGREGATE_CUTOFF_DRIFT",
      "Operand resolution must use one budget created before one ordered operand loop.",
    );
  }
  const loopStatements = [...loop.statement.statements];
  const cutoffIndex = loopStatements.findIndex(
    (statement) =>
      ts.isIfStatement(statement) &&
      nodeContains(
        statement.expression,
        (node) =>
          isIdentifierCall(node, "chargeResolvedValue") &&
          node.arguments.length === 2 &&
          ts.isIdentifier(node.arguments[1]) &&
          node.arguments[1].text === "budget",
      ) &&
      nodeContains(
        statement.thenStatement,
        (node) =>
          ts.isReturnStatement(node) &&
          node.expression !== undefined &&
          isIdentifierCall(node.expression, "invalidPredicate"),
      ),
  );
  const retainIndex = loopStatements.findIndex((statement) =>
    nodeContains(
      statement,
      (node) =>
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "outcomes" &&
        node.expression.name.text === "push",
    ),
  );
  const resolvesInsideLoop =
    nodeContains(loop.statement, (node) => isIdentifierCall(node, "resolveRuntimeValue")) &&
    nodeContains(loop.statement, (node) => isIdentifierCall(node, "probeRuntimeReferencePresence"));
  const mapsOperands = nodeContains(
    declaration.body,
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map",
  );
  if (!resolvesInsideLoop || cutoffIndex < 0 || retainIndex <= cutoffIndex || mapsOperands) {
    fail(
      "PREDICATE_EVALUATION_AGGREGATE_CUTOFF_DRIFT",
      "Each operand must resolve, charge, and fail before its retained outcome or the next operand.",
    );
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
      statement.moduleSpecifier.text !== "./predicate-evaluation.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "PREDICATE_EVALUATION_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased predicate exports.`,
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

function verifyIndexContract(sourceText, fileName, expectedTypeExports) {
  const inventory = indexExports(sourceText, fileName);
  assertArrayEqual(
    inventory.runtimeExports,
    EXPECTED_PUBLIC_RUNTIME_EXPORTS,
    "PREDICATE_EVALUATION_INDEX_EXPORT_DRIFT",
    `${fileName} public runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    expectedTypeExports,
    "PREDICATE_EVALUATION_INDEX_EXPORT_DRIFT",
    `${fileName} public type exports`,
  );
  for (const internalExport of EXPECTED_INTERNAL_RUNTIME_EXPORTS) {
    if (inventory.runtimeExports.includes(internalExport)) {
      fail(
        "PREDICATE_EVALUATION_INTERNAL_EXPORT_LEAK",
        `${internalExport} must remain outside the package root.`,
      );
    }
  }
  verifyPlatformBoundary(inventory.sourceFile, "PREDICATE_EVALUATION_INDEX_EXPORT_DRIFT");
}

function verifySourceAndDistribution({
  sourceText,
  sourceIndexText,
  declarationText,
  builtJavaScript,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = collectExportedDeclarations(sourceText, "predicate-evaluation.ts");
  verifyEarlyAggregateCutoff(source.sourceFile);
  verifyDirectExportForm(
    source,
    "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    "Predicate source exports",
  );
  assertArrayEqual(
    source.runtimeExports,
    EXPECTED_SOURCE_RUNTIME_EXPORTS,
    "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    "Predicate source runtime exports",
  );
  assertArrayEqual(
    source.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "PREDICATE_EVALUATION_SOURCE_EXPORT_DRIFT",
    "Predicate source type exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail(
      "PREDICATE_EVALUATION_TSDOC_MISSING",
      "Every exported M04-T04 source declaration requires TSDoc.",
      { missing: source.missingTsdoc },
    );
  }
  const sourceImports = verifySourceImports(source.sourceFile);
  verifyPlatformBoundary(source.sourceFile);
  verifyIndexContract(sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS);

  const declaration = collectExportedDeclarations(
    declarationText,
    "dist/predicate-evaluation.d.ts",
  );
  verifyDirectExportForm(
    declaration,
    "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    "Built predicate declarations",
  );
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_SOURCE_RUNTIME_EXPORTS,
    "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    "Built predicate runtime declarations",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_TYPE_EXPORTS,
    "PREDICATE_EVALUATION_DECLARATION_DRIFT",
    "Built predicate type declarations",
  );
  verifyPlatformBoundary(declaration.sourceFile, "PREDICATE_EVALUATION_DECLARATION_DRIFT");

  const built = collectExportedDeclarations(builtJavaScript, "dist/predicate-evaluation.js");
  verifyDirectExportForm(
    built,
    "PREDICATE_EVALUATION_DISTRIBUTION_DRIFT",
    "Built predicate exports",
  );
  assertArrayEqual(
    built.runtimeExports,
    EXPECTED_SOURCE_RUNTIME_EXPORTS,
    "PREDICATE_EVALUATION_DISTRIBUTION_DRIFT",
    "Built predicate runtime exports",
  );
  verifyPlatformBoundary(built.sourceFile, "PREDICATE_EVALUATION_DISTRIBUTION_BOUNDARY_DRIFT");
  verifyIndexContract(builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS);
  verifyIndexContract(builtIndexJavaScript, "dist/index.js", []);

  return Object.freeze({
    sourceRuntimeExports: EXPECTED_SOURCE_RUNTIME_EXPORTS,
    runtimeExports: EXPECTED_PUBLIC_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    internalRuntimeExports: EXPECTED_INTERNAL_RUNTIME_EXPORTS,
    sourceImports,
    sequentialAggregateCutoff: true,
    rootLeaksInternalHelpers: false,
    tsdocDeclarations: EXPECTED_SOURCE_RUNTIME_EXPORTS.length + EXPECTED_TYPE_EXPORTS.length,
  });
}

function assertPackageTestLocation(expressionStatement, fileName, title) {
  const block = expressionStatement.parent;
  const callbackOwner = block?.parent;
  const describeCall = callbackOwner?.parent;
  if (
    !ts.isBlock(block) ||
    (!ts.isArrowFunction(callbackOwner) && !ts.isFunctionExpression(callbackOwner)) ||
    !ts.isCallExpression(describeCall) ||
    !ts.isIdentifier(describeCall.expression) ||
    describeCall.expression.text !== "describe" ||
    describeCall.arguments.length !== 2 ||
    !ts.isStringLiteral(describeCall.arguments[0]) ||
    describeCall.arguments[1] !== callbackOwner ||
    !ts.isExpressionStatement(describeCall.parent) ||
    !ts.isSourceFile(describeCall.parent.parent)
  ) {
    fail(
      "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
      `${fileName} package test ${title} is not directly inside one top-level describe.`,
    );
  }
}

function unwrapTypeExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function collectBindingIdentifiers(name, identifiers = []) {
  if (ts.isIdentifier(name)) {
    identifiers.push(name);
    return identifiers;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      collectBindingIdentifiers(element.name, identifiers);
    }
  }
  return identifiers;
}

function mutationRootIdentifier(expression) {
  let current = unwrapTypeExpression(expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapTypeExpression(current.expression);
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function verifyHarnessBindings(sourceFile, fileName, canonicalImports) {
  const protectedBindings = new Set(canonicalImports.flatMap(({ bindings }) => bindings));
  const allowedBindingNodes = new Set();

  for (const { module, kind, bindings } of canonicalImports) {
    const imports = sourceFile.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === module,
    );
    if (imports.length !== 1) {
      fail(
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} requires exactly one canonical ${module} harness import.`,
      );
    }
    const [statement] = imports;
    const clause = statement.importClause;
    if (kind === "default") {
      if (
        clause === undefined ||
        clause.isTypeOnly ||
        clause.name === undefined ||
        clause.name.text !== bindings[0] ||
        clause.namedBindings !== undefined
      ) {
        fail(
          "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
          `${fileName} requires the exact default ${bindings[0]} import from ${module}.`,
        );
      }
      allowedBindingNodes.add(clause.name);
    } else {
      if (
        clause === undefined ||
        clause.isTypeOnly ||
        clause.name !== undefined ||
        clause.namedBindings === undefined ||
        !ts.isNamedImports(clause.namedBindings) ||
        clause.namedBindings.elements.some(
          (element) => element.isTypeOnly || element.propertyName !== undefined,
        )
      ) {
        fail(
          "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
          `${fileName} requires non-aliased named harness imports from ${module}.`,
        );
      }
      const actual = clause.namedBindings.elements.map((element) => element.name.text).sort();
      assertArrayEqual(
        actual,
        [...bindings].sort(),
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} ${module} harness bindings`,
      );
      for (const element of clause.namedBindings.elements) {
        allowedBindingNodes.add(element.name);
      }
    }
  }

  function verifyBinding(identifier) {
    if (protectedBindings.has(identifier.text) && !allowedBindingNodes.has(identifier)) {
      fail(
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} shadows or replaces canonical harness binding ${identifier.text}.`,
      );
    }
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      for (const identifier of collectBindingIdentifiers(node.name)) verifyBinding(identifier);
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name)
    ) {
      verifyBinding(node.name);
    } else if (ts.isImportClause(node) && node.name !== undefined) {
      verifyBinding(node.name);
    } else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
      verifyBinding(node.name);
    } else if (ts.isImportEqualsDeclaration(node)) {
      verifyBinding(node.name);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      protectedBindings.has(mutationRootIdentifier(node.left))
    ) {
      fail(
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} mutates a canonical test-harness binding.`,
      );
    }
    if (
      ((ts.isPrefixUnaryExpression(node) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken)) ||
        ts.isPostfixUnaryExpression(node)) &&
      protectedBindings.has(mutationRootIdentifier(node.operand))
    ) {
      fail(
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} updates a canonical test-harness binding.`,
      );
    }
    if (
      ts.isDeleteExpression(node) &&
      protectedBindings.has(mutationRootIdentifier(node.expression))
    ) {
      fail(
        "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
        `${fileName} deletes from a canonical test-harness binding.`,
      );
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = unwrapTypeExpression(node.expression);
      let owner;
      let member;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
        owner = callee.expression.text;
        member = callee.name.text;
      } else if (
        ts.isElementAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.argumentExpression !== undefined &&
        ts.isStringLiteral(unwrapTypeExpression(callee.argumentExpression))
      ) {
        owner = callee.expression.text;
        member = unwrapTypeExpression(callee.argumentExpression).text;
      }
      const mutatesTarget =
        (owner === "Object" &&
          [
            "assign",
            "defineProperties",
            "defineProperty",
            "freeze",
            "preventExtensions",
            "seal",
            "setPrototypeOf",
          ].includes(member)) ||
        (owner === "Reflect" &&
          ["defineProperty", "deleteProperty", "set", "setPrototypeOf"].includes(member));
      if (mutatesTarget && protectedBindings.has(mutationRootIdentifier(node.arguments[0]))) {
        fail(
          "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
          `${fileName} mutates a canonical harness object through ${owner}.${member}.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function collectPackageTests(sourceText, fileName, expectedTitles) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
  verifyHarnessBindings(sourceFile, fileName, [
    {
      module: "vitest",
      kind: "named",
      bindings: ["describe", "expect", "it", "vi"],
    },
  ]);
  const titles = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        ts.isIdentifier(expression.expression.expression) &&
        expression.expression.expression.text === "it" &&
        expression.expression.name.text === "each"
      ) {
        const tableArgument = expression.arguments[0];
        const table = tableArgument === undefined ? undefined : unwrapTypeExpression(tableArgument);
        const title = node.arguments[0];
        const callback = node.arguments[1];
        const expressionStatement = node.parent;
        if (
          !ts.isArrayLiteralExpression(table) ||
          !ts.isStringLiteral(title) ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
          !ts.isExpressionStatement(expressionStatement) ||
          !title.text.includes("%s")
        ) {
          fail(
            "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
            `${fileName} uses an unreviewed it.each registration shape.`,
          );
        }
        assertPackageTestLocation(expressionStatement, fileName, title.text);
        for (const row of table.elements) {
          const label =
            ts.isArrayLiteralExpression(row) && row.elements.length > 0
              ? row.elements[0]
              : undefined;
          if (label === undefined || !ts.isStringLiteral(label)) {
            fail(
              "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
              `${fileName} it.each rows require a literal string evidence label.`,
            );
          }
          titles.push(title.text.replace("%s", label.text));
        }
        return;
      }
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "it"
      ) {
        fail(
          "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
          `${fileName} contains a modified it.${expression.name.text} registration.`,
        );
      }
      if (ts.isIdentifier(expression) && expression.text === "it") {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (
          !ts.isStringLiteral(title) ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
        ) {
          fail(
            "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
            `${fileName} uses a non-literal or non-function test registration.`,
          );
        }
        const expressionStatement = node.parent;
        if (!ts.isExpressionStatement(expressionStatement)) {
          fail(
            "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
            `${fileName} test ${title.text} is conditionally or indirectly registered.`,
          );
        }
        assertPackageTestLocation(expressionStatement, fileName, title.text);
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (new Set(titles).size !== titles.length) {
    fail("PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT", `${fileName} has duplicate test titles.`);
  }
  assertArrayEqual(
    [...titles].sort(),
    [...expectedTitles].sort(),
    "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
    `${fileName} direct test inventory`,
  );
  return Object.freeze(titles.sort());
}

function collectRootTests(sourceText, fileName, expectedTitles) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  verifyHarnessBindings(sourceFile, fileName, [
    { module: "node:assert/strict", kind: "default", bindings: ["assert"] },
    { module: "node:test", kind: "default", bindings: ["test"] },
  ]);
  const titles = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "test"
      ) {
        fail(
          "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
          `${fileName} contains a modified test.${expression.name.text} registration.`,
        );
      }
      if (ts.isIdentifier(expression) && expression.text === "test") {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        if (
          !ts.isStringLiteral(title) ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
          !ts.isExpressionStatement(node.parent) ||
          !ts.isSourceFile(node.parent.parent)
        ) {
          fail(
            "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
            `${fileName} uses a conditional or indirect root test registration.`,
          );
        }
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (new Set(titles).size !== titles.length) {
    fail("PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT", `${fileName} has duplicate test titles.`);
  }
  assertArrayEqual(
    [...titles].sort(),
    [...expectedTitles].sort(),
    "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
    `${fileName} direct test inventory`,
  );
  return Object.freeze(titles.sort());
}

function compilerNegativeLabels(sourceText) {
  const labels = [...sourceText.matchAll(/@ts-expect-error[ \t]+([^\r\n]+)/gu)].map((match) =>
    match[1].trim(),
  );
  if (labels.length === 0) {
    fail(
      "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
      "M04-T04 requires compile-time negative contracts.",
    );
  }
  return labels;
}

function verifyTestInventory({ packageTests, typeTests, workspaceTypeTests, rootTests }) {
  const packageTitles = collectPackageTests(
    packageTests,
    "predicate-evaluation.test.ts",
    REQUIRED_PACKAGE_TEST_TITLES,
  );
  const rootTitles = collectRootTests(
    rootTests,
    "runtime-core-predicate-evaluation.test.mjs",
    REQUIRED_ROOT_TEST_TITLES,
  );
  const observedCompilerNegativeLabels = compilerNegativeLabels(typeTests);
  const workspaceCompilerNegativeLabels = compilerNegativeLabels(workspaceTypeTests);
  assertArrayEqual(
    observedCompilerNegativeLabels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
    "M04-T04 compiler-negative descriptions",
  );
  assertArrayEqual(
    workspaceCompilerNegativeLabels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "PREDICATE_EVALUATION_TEST_INVENTORY_DRIFT",
    "Tracked M04-T04 compiler-negative descriptions",
  );
  return Object.freeze({
    packageTests: packageTitles.length,
    compilerNegativeCases: observedCompilerNegativeLabels.length,
    compilerNegativeLabels: Object.freeze(observedCompilerNegativeLabels),
    rootMutationTests: rootTitles.length,
    packageTestTitles: packageTitles,
    rootTestTitles: rootTitles,
  });
}

function verifyPackageAndRootWiring(packageManifest, rootManifest) {
  if (
    packageManifest.name !== "@desen/runtime-core" ||
    packageManifest.scripts?.["test:predicate-evaluation"] !== EXPECTED_PACKAGE_TEST_SCRIPT
  ) {
    fail(
      "PREDICATE_EVALUATION_PACKAGE_CONTRACT_DRIFT",
      "The runtime-core focused M04-T04 test command changed.",
    );
  }
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootManifest.scripts?.[name] !== command) {
      fail("PREDICATE_EVALUATION_ROOT_SCRIPT_DRIFT", `Root command ${name} changed.`, {
        expected: command,
        actual: rootManifest.scripts?.[name],
      });
    }
  }
  const verifyToken = "pnpm verify:runtime-core-predicate-evaluation";
  const testToken = "pnpm test:runtime-core-predicate-evaluation";
  const checkSegments = String(rootManifest.scripts?.check ?? "").split(" && ");
  const testSegments = String(rootManifest.scripts?.test ?? "").split(" && ");
  if (
    checkSegments.filter((segment) => segment === verifyToken).length !== 1 ||
    testSegments.filter((segment) => segment === testToken).length !== 1 ||
    checkSegments.indexOf(verifyToken) <=
      checkSegments.indexOf("pnpm verify:runtime-core-token-format-resolution") ||
    testSegments.indexOf(testToken) <=
      testSegments.indexOf("pnpm test:runtime-core-token-format-resolution")
  ) {
    fail(
      "PREDICATE_EVALUATION_ROOT_SCRIPT_DRIFT",
      "Aggregate check/test commands must include M04-T04 once after M04-T03.",
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
      fail("PREDICATE_EVALUATION_TRACE_DRIFT", `Trace ownership for ${expected.id} changed.`);
    }
    observed.push(expected);
  }
  const unexpected = [];
  for (const [collection, values] of Object.entries(trace)) {
    if (!Array.isArray(values)) continue;
    for (const item of values) {
      if (
        item !== null &&
        typeof item === "object" &&
        Array.isArray(item.owners) &&
        item.owners.includes("M04-T04") &&
        !EXPECTED_TRACE_RULES.some(
          (expected) => expected.collection === collection && expected.id === item.id,
        )
      ) {
        unexpected.push(`${collection}:${item.id}`);
      }
    }
  }
  if (unexpected.length > 0) {
    fail("PREDICATE_EVALUATION_TRACE_DRIFT", "Unreviewed M04-T04 trace ownership entered.", {
      unexpected,
    });
  }
  return Object.freeze(observed);
}

function verifyFinding(findings) {
  const normalized = findings.replaceAll("`", "").replaceAll(/\s+/gu, " ");
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!normalized.includes(required.replaceAll(/\s+/gu, " "))) {
      fail("PREDICATE_EVALUATION_FINDING_DRIFT", `PF-034 is missing: ${required}`);
    }
  }
}

function assertDeepEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT", `${label} differs.`, {
      expected,
      actual,
    });
  }
}

function assertRecursivelyFrozen(value, label) {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;
    if (!Object.isFrozen(current)) {
      fail("PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT", `${label} is not frozen.`);
    }
    pending.push(...(Array.isArray(current) ? current : Object.values(current)));
  }
}

function snapshotInput() {
  return {
    state: {
      presentNull: null,
      missingOwner: {},
      falseValue: false,
      objectA: { z: [true, null], a: 1 },
      objectB: { a: 1, z: [true, null] },
      collection: [{ id: 1 }, { id: 2 }],
      text: "alphabet",
      orderLow: "\ud83d\ude00",
      orderHigh: "\ue000",
      largeExistence: new Array(2_100).fill(null),
      aggregateString: "x".repeat(524_289),
    },
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: {},
  };
}

function evaluated(value, diagnostics = []) {
  return {
    status: "evaluated",
    value,
    diagnostics,
  };
}

function probeRuntimeBehavior(runtimeApi, predicateModuleApi) {
  if (
    typeof runtimeApi?.createRuntimeResolutionSnapshot !== "function" ||
    typeof runtimeApi?.evaluateRuntimePredicate !== "function" ||
    typeof runtimeApi?.evaluateRuntimeConditionalPresence !== "function"
  ) {
    fail("PREDICATE_EVALUATION_RUNTIME_API_DRIFT", "Built runtime API does not expose M04-T04.");
  }
  if (
    typeof predicateModuleApi?.prepareRuntimePredicateEvaluation !== "function" ||
    typeof predicateModuleApi?.resolveRuntimePredicateOperands !== "function"
  ) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_API_DRIFT",
      "Built predicate module does not expose the reviewed internal composition seam.",
    );
  }
  for (const internalExport of EXPECTED_INTERNAL_RUNTIME_EXPORTS) {
    if (Object.hasOwn(runtimeApi, internalExport)) {
      fail(
        "PREDICATE_EVALUATION_INTERNAL_EXPORT_LEAK",
        `${internalExport} leaked from the package root.`,
      );
    }
  }

  const snapshot = runtimeApi.createRuntimeResolutionSnapshot(snapshotInput());
  let validArityProbes = 0;
  for (let length = 1; length <= 64; length += 1) {
    assertDeepEqual(
      runtimeApi.evaluateRuntimePredicate(
        { op: "all", args: new Array(length).fill(true) },
        snapshot,
      ),
      evaluated(true),
      `All valid arity ${length}`,
    );
    validArityProbes += 1;
    assertDeepEqual(
      runtimeApi.evaluateRuntimePredicate(
        { op: "any", args: new Array(length).fill(false) },
        snapshot,
      ),
      evaluated(false),
      `Any valid arity ${length}`,
    );
    validArityProbes += 1;
  }
  const invalidArityFamilies = [
    { operators: ["all", "any"], lengths: [0, 65], operand: true },
    { operators: ["not", "truthy"], lengths: [0, 2], operand: true },
    {
      operators: ["exists"],
      lengths: [0, 2],
      operand: { $ref: "state.presentNull" },
    },
    {
      operators: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"],
      lengths: [0, 1, 3],
      operand: true,
    },
  ];
  let invalidArityProbes = 0;
  for (const family of invalidArityFamilies) {
    for (const operator of family.operators) {
      for (const length of family.lengths) {
        const outcome = runtimeApi.evaluateRuntimePredicate(
          { op: operator, args: new Array(length).fill(family.operand) },
          snapshot,
        );
        if (
          outcome.status !== "invalid" ||
          outcome.pointer !== "/args" ||
          outcome.reason !== "malformed-predicate"
        ) {
          fail(
            "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
            `Operator ${operator} accepted or misclassified invalid arity ${length}.`,
          );
        }
        invalidArityProbes += 1;
      }
    }
  }
  const operatorVectors = [
    [{ op: "all", args: [true, { op: "not", args: [false] }] }, true],
    [{ op: "any", args: [false, true] }, true],
    [{ op: "not", args: [false] }, true],
    [
      {
        op: "eq",
        args: [{ $ref: "state.objectA" }, { $ref: "state.objectB" }],
      },
      true,
    ],
    [{ op: "neq", args: [1, 2] }, true],
    [{ op: "gt", args: [2, 1] }, true],
    [{ op: "gte", args: [2, 2] }, true],
    [{ op: "lt", args: [{ $ref: "state.orderLow" }, { $ref: "state.orderHigh" }] }, true],
    [{ op: "lte", args: ["a", "a"] }, true],
    [{ op: "in", args: [{ id: 2 }, { $ref: "state.collection" }] }, true],
    [{ op: "contains", args: [{ $ref: "state.collection" }, { id: 1 }] }, true],
    [{ op: "exists", args: [{ $ref: "state.presentNull", fallback: { $token: "never" } }] }, true],
    [{ op: "truthy", args: [[1]] }, true],
  ];
  for (const [predicate, expected] of operatorVectors) {
    assertDeepEqual(
      runtimeApi.evaluateRuntimePredicate(predicate, snapshot),
      evaluated(expected),
      `Operator ${predicate.op}`,
    );
  }
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      { op: "contains", args: [{ $ref: "state.text" }, "pha"] },
      snapshot,
    ),
    evaluated(true),
    "UTF-16 contiguous substring membership",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate({ op: "contains", args: ["e\u0301", "\u00e9"] }, snapshot),
    evaluated(false),
    "Canonical-equivalent strings remain code-unit distinct for contains",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate({ op: "in", args: ["\u00e9", "e\u0301"] }, snapshot),
    evaluated(false),
    "Canonical-equivalent strings remain code-unit distinct for in",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate({ op: "contains", args: ["DESEN", "desen"] }, snapshot),
    evaluated(false),
    "UTF-16 substring membership remains case-sensitive",
  );

  const falseyValues = [null, false, 0, "", [], {}];
  for (const value of falseyValues) {
    assertDeepEqual(
      runtimeApi.evaluateRuntimePredicate({ op: "truthy", args: [value] }, snapshot),
      evaluated(false),
      `Truthy false value ${JSON.stringify(value)}`,
    );
  }

  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      { op: "exists", args: [{ $ref: "state.missingOwner.value", fallback: true }] },
      snapshot,
    ),
    evaluated(false),
    "Exists bypasses fallback",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      {
        op: "all",
        args: [
          { op: "exists", args: [{ $ref: "state.largeExistence" }] },
          { op: "exists", args: [{ $ref: "state.largeExistence" }] },
        ],
      },
      snapshot,
    ),
    evaluated(true),
    "Exists does not retain or charge resolved value payloads",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      {
        op: "all",
        args: [
          { op: "exists", args: [{ $ref: "state.aggregateString" }] },
          { op: "exists", args: [{ $ref: "state.aggregateString" }] },
        ],
      },
      snapshot,
    ),
    evaluated(true),
    "Exists charges reference status rather than aggregate string payloads",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      { op: "truthy", args: [{ $ref: "state.missingOwner.value" }] },
      snapshot,
    ),
    evaluated(false),
    "Unresolved operand",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      { op: "not", args: [{ op: "truthy", args: [false] }] },
      snapshot,
    ),
    evaluated(true),
    "Nested false remains boolean",
  );

  const diagnosticOrder = runtimeApi.evaluateRuntimePredicate(
    {
      op: "all",
      args: [false, { op: "gt", args: [{ bad: 1 }, 1] }, { op: "contains", args: ["later", 1] }],
    },
    snapshot,
  );
  assertDeepEqual(
    diagnosticOrder,
    evaluated(false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/1/args/0" },
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/2/args/1" },
    ]),
    "No-short-circuit diagnostic order",
  );

  const deferred = runtimeApi.evaluateRuntimePredicate(
    { op: "truthy", args: [{ $token: "color.action" }] },
    snapshot,
  );
  assertDeepEqual(
    deferred,
    { status: "deferred", form: "token", pointer: "/args/0/$token" },
    "Deferred token stays distinct",
  );
  const formatDeferred = runtimeApi.evaluateRuntimePredicate(
    { op: "truthy", args: [{ $format: { template: "{x}", values: { x: true } } }] },
    snapshot,
  );
  assertDeepEqual(
    formatDeferred,
    { status: "deferred", form: "format", pointer: "/args/0/$format" },
    "Deferred format stays distinct",
  );
  const invalid = runtimeApi.evaluateRuntimePredicate({ op: "unknown", args: [true] }, snapshot);
  if (invalid.status !== "invalid" || invalid.pointer !== "/op") {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "Malformed predicate did not fail closed at the root.",
    );
  }

  assertDeepEqual(
    runtimeApi.evaluateRuntimeConditionalPresence(undefined, snapshot),
    { status: "evaluated", present: true, diagnostics: [] },
    "Omitted condition is present",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimeConditionalPresence({ op: "truthy", args: [true] }, snapshot),
    { status: "evaluated", present: true, diagnostics: [] },
    "True condition is present",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimeConditionalPresence(
      { op: "truthy", args: [{ $ref: "state.falseValue" }] },
      snapshot,
    ),
    { status: "evaluated", present: false, diagnostics: [] },
    "False condition is absent",
  );
  assertDeepEqual(
    runtimeApi.evaluateRuntimeConditionalPresence(
      { op: "truthy", args: [{ $format: { template: "{x}", values: { x: true } } }] },
      snapshot,
    ),
    { status: "deferred", present: false, form: "format", pointer: "/args/0/$format" },
    "Deferred condition prevents instantiation",
  );
  const invalidPresence = runtimeApi.evaluateRuntimeConditionalPresence(
    { op: "all", args: [] },
    snapshot,
  );
  if (
    invalidPresence.status !== "invalid" ||
    invalidPresence.present !== false ||
    invalidPresence.pointer !== "/args"
  ) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "Invalid presence did not remain explicit and fail closed.",
    );
  }

  const overBudget = runtimeApi.evaluateRuntimePredicate(
    { op: "all", args: new Array(65).fill(true) },
    snapshot,
  );
  if (overBudget.status !== "invalid") {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "Predicate arity limits were not enforced.",
    );
  }
  const aggregateStringBudget = runtimeApi.evaluateRuntimePredicate(
    {
      op: "eq",
      args: [{ $ref: "state.aggregateString" }, { $ref: "state.aggregateString" }],
    },
    snapshot,
  );
  if (
    aggregateStringBudget.status !== "invalid" ||
    aggregateStringBudget.reason !== "unsafe-or-unbounded-json"
  ) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "Aggregate string-code-unit accounting reset between predicate operands.",
    );
  }
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(
      {
        op: "all",
        args: [
          { $token: "color.action" },
          {
            op: "eq",
            args: [{ $ref: "state.aggregateString" }, { $ref: "state.aggregateString" }],
          },
        ],
      },
      snapshot,
    ),
    { status: "deferred", form: "token", pointer: "/args/0/$token" },
    "First deferred terminal wins before later aggregate overflow",
  );
  const overflowBeforeDeferred = runtimeApi.evaluateRuntimePredicate(
    {
      op: "all",
      args: [
        {
          op: "eq",
          args: [{ $ref: "state.aggregateString" }, { $ref: "state.aggregateString" }],
        },
        { $token: "color.action" },
      ],
    },
    snapshot,
  );
  if (
    overflowBeforeDeferred.status !== "invalid" ||
    overflowBeforeDeferred.reason !== "unsafe-or-unbounded-json"
  ) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "A later deferred operand displaced an earlier aggregate-overflow terminal.",
    );
  }
  const aggregatePrepared = predicateModuleApi.prepareRuntimePredicateEvaluation({
    op: "eq",
    args: [{ $ref: "state.aggregateString" }, { $ref: "state.aggregateString" }],
  });
  if ("status" in aggregatePrepared) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "A valid aggregate-cutoff probe failed during predicate preparation.",
    );
  }
  const earlyCutoff = predicateModuleApi.resolveRuntimePredicateOperands(
    aggregatePrepared,
    snapshot,
  );
  if (
    Array.isArray(earlyCutoff) ||
    earlyCutoff.status !== "invalid" ||
    earlyCutoff.reason !== "unsafe-or-unbounded-json"
  ) {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "The internal resolver retained outcomes after the shared aggregate budget was exhausted.",
    );
  }
  assertRecursivelyFrozen(earlyCutoff, "early aggregate-cutoff outcome");
  let maximumPredicateNodes = { op: "truthy", args: [true] };
  for (let index = 1; index < 64; index += 1) {
    maximumPredicateNodes = { op: "not", args: [maximumPredicateNodes] };
  }
  assertDeepEqual(
    runtimeApi.evaluateRuntimePredicate(maximumPredicateNodes, snapshot),
    evaluated(false),
    "Sixty-four predicate nodes",
  );
  const tooManyPredicateNodes = {
    op: "not",
    args: [maximumPredicateNodes],
  };
  if (runtimeApi.evaluateRuntimePredicate(tooManyPredicateNodes, snapshot).status !== "invalid") {
    fail(
      "PREDICATE_EVALUATION_RUNTIME_BEHAVIOR_DRIFT",
      "The sixty-fifth predicate node did not fail closed.",
    );
  }

  for (const [label, value] of [
    ["operator outcome", runtimeApi.evaluateRuntimePredicate({ op: "eq", args: [1, 1] }, snapshot)],
    ["diagnostic outcome", diagnosticOrder],
    ["invalid outcome", invalid],
    ["token deferred outcome", deferred],
    ["format deferred outcome", formatDeferred],
    ["presence outcome", invalidPresence],
  ]) {
    assertRecursivelyFrozen(value, label);
  }

  return Object.freeze({
    operators: EXPECTED_OPERATORS.length,
    operatorProbes: operatorVectors.length,
    validArityProbes,
    invalidArityProbes,
    arityProbes: validArityProbes + invalidArityProbes,
    truthyFalseProbes: falseyValues.length,
    existenceProbes: 4,
    canonicalEqualityProbes: 3,
    utf16Probes: 5,
    unresolvedProbes: 2,
    deferredProbes: 2,
    invalidProbes: 2,
    mismatchDiagnostics: 2,
    noShortCircuit: true,
    presenceProbes: 5,
    limitProbes: 4,
    earlyCutoffProbes: 1,
    terminalPrecedenceProbes: 2,
    platformEffects: 0,
  });
}

async function verifyPrerequisite({ prerequisiteArtifactBytes, verifyPrerequisiteEvidence }) {
  const trackedBytes = await readFile(DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH);
  if (
    prerequisiteArtifactBytes !== undefined &&
    !byteEqual(prerequisiteArtifactBytes, trackedBytes)
  ) {
    fail(
      "PREDICATE_EVALUATION_PREREQUISITE_DRIFT",
      "Injected M04-T02 prerequisite bytes differ from the tracked artifact.",
    );
  }
  const bytes = prerequisiteArtifactBytes ?? trackedBytes;
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("PREDICATE_EVALUATION_PREREQUISITE_DRIFT", "M04-T02 prerequisite is not valid JSON.");
  }
  if (parsed.task !== "M04-T02" || parsed.result !== "PASS") {
    fail(
      "PREDICATE_EVALUATION_PREREQUISITE_DRIFT",
      "M04-T02 prerequisite identity/result changed.",
    );
  }
  if (verifyPrerequisiteEvidence) {
    try {
      await verifyRuntimeCoreValueResolutionEvidence({
        artifactPath: DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH,
        artifactBytes: bytes,
      });
    } catch (error) {
      fail("PREDICATE_EVALUATION_PREREQUISITE_DRIFT", "M04-T02 prerequisite verification failed.", {
        cause: String(error),
      });
    }
  }
  return Object.freeze({
    task: "M04-T02",
    result: "PASS",
    artifact: "runtime-core-0.1.0-value-resolution.json",
    artifactSha256: sha256(bytes),
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

/** Builds fresh deterministic M04-T04 evidence without writing the tracked artifact. */
export async function buildRuntimeCorePredicateEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    prerequisite,
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
    proofDocument,
    tracked,
  ] = await Promise.all([
    verifyPrerequisite({
      prerequisiteArtifactBytes: normalized.prerequisiteArtifactBytes,
      verifyPrerequisiteEvidence: normalized.verifyPrerequisite !== false,
    }),
    readWorkspaceText("packages/runtime-core/src/predicate-evaluation.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/predicate-evaluation.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/predicate-evaluation.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/predicate-evaluation.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/predicate-evaluation.types.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/predicate-evaluation.types.ts"),
    readWorkspaceText("tests/runtime-core-predicate-evaluation.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-PREDICATE-EVALUATION.md", fileOverrides),
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
    fail("PREDICATE_EVALUATION_METADATA_INVALID", "Package or trace metadata is not valid JSON.");
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
  verifyFinding(findings);
  for (const required of [
    "M04-T04",
    "evaluateRuntimePredicate",
    "evaluateRuntimeConditionalPresence",
    "presence decision",
  ]) {
    if (!proofDocument.includes(required)) {
      fail("PREDICATE_EVALUATION_DOCUMENTATION_DRIFT", `Proof document is missing ${required}.`);
    }
  }

  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const predicateModuleApi =
    normalized.predicateModuleApi ?? (await import(PREDICATE_MODULE_API_URL.href));
  const runtime = probeRuntimeBehavior(runtimeApi, predicateModuleApi);
  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T04",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "The closed predicate language evaluates deterministically over one immutable snapshot and yields explicit fail-closed conditional-presence decisions.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisite,
    publicApi,
    runtime,
    predicateSemantics: Object.freeze({
      operators: EXPECTED_OPERATORS,
      evaluationOrder: "depth-first left-to-right",
      shortCircuit: false,
      directUnresolved: false,
      nestedFalse: "resolved boolean",
      truthyFalse: Object.freeze([
        "null",
        "false",
        "zero",
        "empty-string",
        "empty-array",
        "empty-object",
      ]),
      equality: "RFC 8785 canonical JSON",
      arrayMembership: "RFC 8785 canonical JSON equality",
      stringOrder: "lexicographic UTF-16 code-unit order",
      stringMembership: "contiguous UTF-16 code-unit substring",
      localeInference: false,
      unicodeNormalization: false,
      caseFolding: false,
      exists: "original reference presence including JSON null; fallback bypassed",
      dynamicMismatch: Object.freeze({
        result: false,
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "exact incompatible argument",
      }),
      terminalPrecedence: "first depth-first terminal or aggregate overflow",
    }),
    presenceSemantics: Object.freeze({
      omitted: "present",
      true: "present",
      false: "absent",
      invalid: "prevent-instantiation-with-explicit-invalid",
      deferred: "prevent-instantiation-with-explicit-deferred",
      lifecycleComposition: "M04-T15/M04-T16",
    }),
    limits: Object.freeze({
      maxArgumentsPerOperator: 64,
      maxAggregateArguments: 4_096,
      maxPredicateNodes: 64,
      maxValueDepth: 128,
      maxJsonNodes: 4_096,
      maxStringCodeUnits: 1_048_576,
    }),
    portability: Object.freeze({
      framework: null,
      platformGlobals: Object.freeze([]),
      dynamicEvaluation: false,
      nondeterministicCalls: Object.freeze([]),
      dynamicRegularExpressions: false,
      staticRegularExpressionLiterals: true,
      globalMutationCalls: Object.freeze([]),
      builtInPrototypeMutation: false,
      a2uiDependencies: Object.freeze([]),
    }),
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
      "token and format operand composition (M04-T05/M04-T16)",
      "ordered variants and style overrides (M04-T05)",
      "conditional subtree lifecycle and reactive reevaluation (M04-T15)",
      "action execution and action-turn limits (M04-T10–M04-T13)",
      "consumer schema validation and framework adapters (M05)",
      "complete headless sign-in observable trace (M04-T16)",
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
    fail("PREDICATE_EVALUATION_ARTIFACT_MISSING", "M04-T04 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("PREDICATE_EVALUATION_ARTIFACT_UNSAFE", "M04-T04 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T04 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCorePredicateEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_PREDICATE_EVALUATION_ARTIFACT_PATH;
  const expected = await buildRuntimeCorePredicateEvaluationEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!byteEqual(actualBytes, expected.artifactBytes)) {
    fail("PREDICATE_EVALUATION_ARTIFACT_DRIFT", "M04-T04 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    sourceRuntimeExports: expected.artifact.publicApi.sourceRuntimeExports.length,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    internalRuntimeExports: expected.artifact.publicApi.internalRuntimeExports.length,
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    operatorProbes: expected.artifact.runtime.operatorProbes,
    arityProbes: expected.artifact.runtime.arityProbes,
    truthyFalseProbes: expected.artifact.runtime.truthyFalseProbes,
    utf16Probes: expected.artifact.runtime.utf16Probes,
    presenceProbes: expected.artifact.runtime.presenceProbes,
    mismatchDiagnostics: expected.artifact.runtime.mismatchDiagnostics,
    existenceProbes: expected.artifact.runtime.existenceProbes,
    limitProbes: expected.artifact.runtime.limitProbes,
    earlyCutoffProbes: expected.artifact.runtime.earlyCutoffProbes,
    terminalPrecedenceProbes: expected.artifact.runtime.terminalPrecedenceProbes,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T04 evidence after every proof check passes. */
export async function writeRuntimeCorePredicateEvaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_PREDICATE_EVALUATION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCorePredicateEvaluationEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCorePredicateEvaluationEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T04 evidence boundary. */
export const RUNTIME_CORE_PREDICATE_EVALUATION_ROOT_SCRIPTS = Object.freeze(
  Object.keys(ROOT_SCRIPTS),
);
