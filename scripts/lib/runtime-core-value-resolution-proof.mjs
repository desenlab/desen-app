import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_RUNTIME_CORE_HOST_PORTS_ARTIFACT_PATH,
  verifyRuntimeCoreHostPortsEvidence,
} from "./runtime-core-host-ports-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M04-T02 value-resolution evidence artifact. */
export const DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-value-resolution.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_VALUE_SAFETY_LIMITS",
  "createRuntimeResolutionSnapshot",
  "resolveRuntimeValue",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeEventReferenceSnapshot",
  "RuntimeFormatPayload",
  "RuntimeFormatValue",
  "RuntimeLifecycleReferenceSnapshot",
  "RuntimeLiteralValue",
  "RuntimeReferenceFailureReason",
  "RuntimeReferenceValue",
  "RuntimeResolutionSnapshot",
  "RuntimeResolutionSnapshotInput",
  "RuntimeTokenValue",
  "RuntimeValueDeferred",
  "RuntimeValueInvalid",
  "RuntimeValueInvalidReason",
  "RuntimeValueResolution",
  "RuntimeValueResolved",
  "RuntimeValueSpec",
  "RuntimeValueUnresolved",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze(
  [...EXPECTED_RUNTIME_EXPORTS, ...EXPECTED_TYPE_EXPORTS].sort(),
);
const EXPECTED_SOURCE_IMPORTS = Object.freeze([
  Object.freeze({
    module: "@desen/protocol",
    typeOnly: false,
    names: Object.freeze(["appendJsonPointer", "canonicalizeJson", "createJsonPointer"]),
  }),
  Object.freeze({
    module: "@desen/protocol",
    typeOnly: true,
    names: Object.freeze(["JsonPointer"]),
  }),
  Object.freeze({
    module: "./host-ports.js",
    typeOnly: true,
    names: Object.freeze(["RuntimeJsonObject", "RuntimeJsonPrimitive", "RuntimeJsonValue"]),
  }),
]);
const EXPECTED_LIMITS = Object.freeze({
  maxDepth: 128,
  maxJsonNodes: 4_096,
  maxStringCodeUnits: 1_048_576,
});
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-026",
    section: "10.4",
    owners: Object.freeze(["M02-T10", "M04-T02"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-039",
    section: "14.2",
    owners: Object.freeze(["M02-T10", "M04-T02"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-040",
    section: "14.2.1",
    owners: Object.freeze(["M02-T10", "M04-T02"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-047",
    section: "14.3",
    owners: Object.freeze(["M02-T10", "M04-T02"]),
    status: "PARTIAL_TARGET_VALIDATION_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-112",
    section: "26.3",
    owners: Object.freeze(["M04-T02", "M05-T02", "M05-T06"]),
    status: "CONTRACT_ONLY_ADAPTER_COMPOSITION_DEFERRED",
  }),
  Object.freeze({
    collection: "invariants",
    id: "A-006",
    section: "Appendix A",
    owners: Object.freeze(["M04-T02", "M04-T09"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-020",
    section: "24.2",
    owners: Object.freeze(["M04-T02"]),
    status: "RUNTIME_PRIMITIVE",
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-009",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T08", "M04-T02"]),
    status: "CONTRACT_ONLY_ADAPTER_COMPOSITION_DEFERRED",
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-020",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T02"]),
    status: "RUNTIME_PRIMITIVE",
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-032 — Runtime value resolution uses a bounded atomic snapshot profile",
  "JSON null remains resolved and never selects fallback",
  "unknown roots and inactive scopes cannot be legalized by fallback",
  "token and format materialization remains deferred to M04-T03",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-value-resolution":
    "pnpm verify:runtime-core-host-ports && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:value-resolution && node scripts/generate-runtime-core-value-resolution-proof.mjs",
  "verify:runtime-core-value-resolution":
    "pnpm verify:runtime-core-host-ports && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:value-resolution && node scripts/verify-runtime-core-value-resolution.mjs",
  "test:runtime-core-value-resolution":
    "pnpm verify:runtime-core-host-ports && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:value-resolution && node --test tests/runtime-core-value-resolution.test.mjs",
});
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/value-resolution.ts",
  "packages/runtime-core/test/value-resolution.test.ts",
  "packages/runtime-core/test/value-resolution.types.ts",
  "packages/runtime-core/dist/value-resolution.js",
  "packages/runtime-core/dist/value-resolution.js.map",
  "packages/runtime-core/dist/value-resolution.d.ts",
  "packages/runtime-core/dist/value-resolution.d.ts.map",
  "scripts/lib/runtime-core-value-resolution-proof.mjs",
  "scripts/generate-runtime-core-value-resolution-proof.mjs",
  "scripts/verify-runtime-core-value-resolution.mjs",
  "tests/runtime-core-value-resolution.test.mjs",
]);
const EXPECTED_TEST_INVENTORY = Object.freeze({
  packageTests: 34,
  compilerNegativeCases: 10,
  rootMutationTests: 13,
});
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
  "performance",
  "process",
  "Buffer",
  "globalThis",
  "require",
  "eval",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
]);

/** Stable evidence error for deterministic root mutation tests. */
export class RuntimeCoreValueResolutionEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreValueResolutionEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreValueResolutionEvidenceError(code, message, details);
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
    fail("VALUE_RESOLUTION_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T02 contract.`, { expected, actual });
  }
}

function collectExportedDeclarations(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
  const names = [];
  const missingTsdoc = [];
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    let declarationNames = [];
    if (ts.isVariableStatement(statement)) {
      declarationNames = statement.declarationList.declarations
        .map((declaration) => declaration.name)
        .filter(ts.isIdentifier)
        .map((identifier) => identifier.text);
    } else if (statement.name !== undefined && ts.isIdentifier(statement.name)) {
      declarationNames = [statement.name.text];
    }
    names.push(...declarationNames);
    if (declarationNames.length > 0 && ts.getJSDocCommentsAndTags(statement).length === 0) {
      missingTsdoc.push(...declarationNames);
    }
  }
  return Object.freeze({
    sourceFile,
    names: Object.freeze(names.sort()),
    missingTsdoc: Object.freeze(missingTsdoc.sort()),
  });
}

function namedImports(statement) {
  const bindings = statement.importClause?.namedBindings;
  if (bindings === undefined || !ts.isNamedImports(bindings)) return undefined;
  if (
    statement.importClause?.name !== undefined ||
    bindings.elements.some((element) => element.propertyName !== undefined)
  ) {
    return undefined;
  }
  return bindings.elements.map((element) => element.name.text).sort();
}

function verifyImports(sourceFile) {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (imports.length !== EXPECTED_SOURCE_IMPORTS.length) {
    fail(
      "VALUE_RESOLUTION_IMPORT_BOUNDARY_DRIFT",
      "Value resolution must keep its three explicit protocol/internal imports.",
    );
  }
  for (let index = 0; index < EXPECTED_SOURCE_IMPORTS.length; index += 1) {
    const statement = imports[index];
    const expected = EXPECTED_SOURCE_IMPORTS[index];
    const names = namedImports(statement);
    if (
      statement === undefined ||
      expected === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== expected.module ||
      statement.importClause?.isTypeOnly !== expected.typeOnly ||
      names === undefined
    ) {
      fail(
        "VALUE_RESOLUTION_IMPORT_BOUNDARY_DRIFT",
        "Value resolution imports changed module, kind, order, or binding shape.",
      );
    }
    assertArrayEqual(
      names,
      expected.names,
      "VALUE_RESOLUTION_IMPORT_BOUNDARY_DRIFT",
      `Imports from ${expected.module}`,
    );
  }
}

function verifyPlatformBoundary(sourceFile, code = "VALUE_RESOLUTION_PLATFORM_BOUNDARY_DRIFT") {
  const forbidden = new Set();
  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_RUNTIME_IDENTIFIERS.includes(node.text)) {
      forbidden.add(node.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      forbidden.add("dynamic import");
    }
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "eval" || node.expression.text === "Function")
    ) {
      forbidden.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (forbidden.size > 0) {
    fail(code, "Executable evaluation or a platform/global dependency entered value resolution.", {
      forbidden: [...forbidden].sort(),
    });
  }
}

function indexExportInventory(sourceText, fileName) {
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
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail(
        "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
        `${fileName} may contain only explicit named re-exports.`,
      );
    }
    const ownedDeclaration = statement.moduleSpecifier.text === "./value-resolution.js";
    for (const element of statement.exportClause.elements) {
      const publicName = element.name.text;
      if (
        element.propertyName !== undefined ||
        (!ownedDeclaration && EXPECTED_SOURCE_EXPORTS.includes(publicName))
      ) {
        fail(
          "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
          `${fileName} must not alias or duplicate M04-T02 public exports.`,
        );
      }
      if (!ownedDeclaration) continue;
      const target = statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports;
      target.push(publicName);
    }
  }
  runtimeExports.sort();
  typeExports.sort();
  return Object.freeze({
    sourceFile,
    runtimeExports: Object.freeze(runtimeExports),
    typeExports: Object.freeze(typeExports),
  });
}

function verifyIndexContract(sourceText, fileName, expectedTypeExports) {
  const inventory = indexExportInventory(sourceText, fileName);
  assertArrayEqual(
    inventory.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
    `${fileName} runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    expectedTypeExports,
    "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT",
    `${fileName} type exports`,
  );
  verifyPlatformBoundary(inventory.sourceFile, "VALUE_RESOLUTION_INDEX_EXPORT_DRIFT");
}

function verifySourceContract(sourceText, indexSource) {
  const declarations = collectExportedDeclarations(sourceText, "value-resolution.ts");
  assertArrayEqual(
    declarations.names,
    EXPECTED_SOURCE_EXPORTS,
    "VALUE_RESOLUTION_SOURCE_EXPORT_DRIFT",
    "Value-resolution source exports",
  );
  if (declarations.missingTsdoc.length > 0) {
    fail("VALUE_RESOLUTION_TSDOC_MISSING", "Every public M04-T02 declaration requires TSDoc.", {
      missing: declarations.missingTsdoc,
    });
  }
  verifyImports(declarations.sourceFile);
  verifyPlatformBoundary(declarations.sourceFile);
  verifyIndexContract(indexSource, "src/index.ts", EXPECTED_TYPE_EXPORTS);
  return Object.freeze({
    publicDeclarations: declarations.names.length,
    tsdocDeclarations: declarations.names.length,
    runtimeExports: Object.freeze([...EXPECTED_RUNTIME_EXPORTS]),
    typeExports: Object.freeze([...EXPECTED_TYPE_EXPORTS]),
    allowedSourceImports: EXPECTED_SOURCE_IMPORTS,
  });
}

function verifyDeclarations(
  declarationText,
  builtJavaScript,
  indexDeclarationText,
  indexBuiltJavaScript,
) {
  const declarations = collectExportedDeclarations(declarationText, "dist/value-resolution.d.ts");
  assertArrayEqual(
    declarations.names,
    EXPECTED_SOURCE_EXPORTS,
    "VALUE_RESOLUTION_DECLARATION_DRIFT",
    "Built value-resolution declarations",
  );
  if (declarations.missingTsdoc.length > 0) {
    fail(
      "VALUE_RESOLUTION_DECLARATION_DRIFT",
      "Built value-resolution declarations lost public TSDoc.",
      { missing: declarations.missingTsdoc },
    );
  }
  for (const forbidden of [
    "react",
    "react-dom",
    "react-native",
    "HTMLElement",
    "CSSStyleSheet",
    "AbortSignal",
    "node:",
    "window",
    "document",
  ]) {
    if (declarationText.includes(forbidden) || builtJavaScript.includes(forbidden)) {
      fail(
        "VALUE_RESOLUTION_DISTRIBUTION_BOUNDARY_DRIFT",
        `Built value-resolution distribution contains forbidden platform surface ${forbidden}.`,
      );
    }
  }
  verifyIndexContract(indexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS);
  verifyIndexContract(indexBuiltJavaScript, "dist/index.js", []);
}

function unwrapExpression(expression) {
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

function testRegistrationCount(call, directName) {
  if (ts.isIdentifier(call.expression) && call.expression.text === directName) return 1;
  if (
    ts.isCallExpression(call.expression) &&
    ts.isPropertyAccessExpression(call.expression.expression) &&
    ts.isIdentifier(call.expression.expression.expression) &&
    call.expression.expression.expression.text === directName &&
    call.expression.expression.name.text === "each"
  ) {
    const cases = unwrapExpression(call.expression.arguments[0]);
    if (!ts.isArrayLiteralExpression(cases)) {
      fail(
        "VALUE_RESOLUTION_TEST_INVENTORY_DRIFT",
        `${directName}.each must use a literal case table.`,
      );
    }
    return cases.elements.length;
  }
  return 0;
}

function directRegistrationStatements(sourceFile, directName) {
  if (directName === "test") return sourceFile.statements;
  const directStatements = [];
  const describeStatements = sourceFile.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === "describe",
  );
  if (describeStatements.length !== 2) {
    fail(
      "VALUE_RESOLUTION_TEST_INVENTORY_DRIFT",
      "The package suite must have two direct describe registrations.",
    );
  }
  for (const statement of describeStatements) {
    const callback = statement.expression.arguments[1];
    if (
      callback === undefined ||
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
      !ts.isBlock(callback.body)
    ) {
      fail(
        "VALUE_RESOLUTION_TEST_INVENTORY_DRIFT",
        "Every package describe registration requires one direct block callback.",
      );
    }
    directStatements.push(...callback.body.statements);
  }
  return directStatements;
}

function countDeclaredTests(sourceText, fileName, directName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  let observedCalls = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      observedCalls += testRegistrationCount(node, directName);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  let directRegistrations = 0;
  for (const statement of directRegistrationStatements(sourceFile, directName)) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      continue;
    }
    directRegistrations += testRegistrationCount(statement.expression, directName);
  }
  if (observedCalls !== directRegistrations) {
    fail(
      "VALUE_RESOLUTION_TEST_INVENTORY_DRIFT",
      `${fileName} contains a skipped, conditional, or nested ${directName} registration.`,
      { observedCalls, directRegistrations },
    );
  }
  return directRegistrations;
}

function verifyTestInventory(packageTests, compilerCases, rootTests) {
  const inventory = Object.freeze({
    packageTests: countDeclaredTests(packageTests, "value-resolution.test.ts", "it"),
    compilerNegativeCases: [...compilerCases.matchAll(/\/\/\s*@ts-expect-error\b/gu)].length,
    rootMutationTests: countDeclaredTests(
      rootTests,
      "runtime-core-value-resolution.test.mjs",
      "test",
    ),
  });
  for (const [name, expected] of Object.entries(EXPECTED_TEST_INVENTORY)) {
    if (inventory[name] !== expected) {
      fail(
        "VALUE_RESOLUTION_TEST_INVENTORY_DRIFT",
        `${name} differs from the M04-T02 evidence suite.`,
        { expected, actual: inventory[name] },
      );
    }
  }
  return inventory;
}

function plainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertRuntimeOutcome(actual, expected, label) {
  if (!isDeepStrictEqual(plainJson(actual), expected)) {
    fail("VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT", `Runtime probe failed: ${label}.`, {
      expected,
      actual: plainJson(actual),
    });
  }
}

function createProbeInput() {
  return {
    state: {
      profile: { name: "Selman", nullable: null },
      enabled: false,
      list: [{ id: "one" }, { id: "two" }],
      indirect: { $ref: "context.private" },
    },
    context: { route: { tenant: "desenlab" } },
    resource: {
      stores: {
        status: "succeeded",
        pending: false,
        value: { items: [{ id: "store-1" }] },
      },
      drafts: { status: "idle", pending: false },
    },
    operation: {
      save: { status: "pending", pending: true },
      signIn: {
        status: "failed",
        pending: false,
        error: { code: "invalidCredentials" },
      },
    },
    event: { status: "available", value: { field: { id: "email" } } },
    item: { task: { title: "Protokolü kanıtla" } },
    env: { viewport: { width: 1280 }, platform: "web" },
  };
}

function nestedArray(depth, terminal = null) {
  let value = terminal;
  for (let index = 0; index < depth; index += 1) value = [value];
  return value;
}

function createAmplificationInput() {
  const input = createProbeInput();
  input.state.largeArray = new Array(1_000).fill(null);
  input.state.largeText = "x".repeat(400_000);
  input.state.deep = nestedArray(80);
  return input;
}

function assertFrozenSnapshot(snapshot) {
  if (
    !Object.isFrozen(snapshot) ||
    !Object.isFrozen(snapshot.state) ||
    !Object.isFrozen(snapshot.state.profile) ||
    !Object.isFrozen(snapshot.resource.stores) ||
    !Object.isFrozen(snapshot.event)
  ) {
    fail(
      "VALUE_RESOLUTION_SNAPSHOT_BOUNDARY_DRIFT",
      "The factory returned a mutable snapshot aggregate.",
    );
  }
}

function verifyRuntimeBehavior(runtimeApi) {
  try {
    if (
      runtimeApi === null ||
      typeof runtimeApi !== "object" ||
      typeof runtimeApi.createRuntimeResolutionSnapshot !== "function" ||
      typeof runtimeApi.resolveRuntimeValue !== "function"
    ) {
      fail(
        "VALUE_RESOLUTION_RUNTIME_EXPORT_MISSING",
        "Built runtime-core does not expose both M04-T02 runtime functions.",
      );
    }
    if (
      !Object.isFrozen(runtimeApi.RUNTIME_VALUE_SAFETY_LIMITS) ||
      !isDeepStrictEqual(plainJson(runtimeApi.RUNTIME_VALUE_SAFETY_LIMITS), EXPECTED_LIMITS)
    ) {
      fail(
        "VALUE_RESOLUTION_SAFETY_LIMIT_DRIFT",
        "Runtime value safety limits differ from the bounded M04-T02 profile.",
      );
    }

    const input = createProbeInput();
    const snapshot = runtimeApi.createRuntimeResolutionSnapshot(input);
    assertFrozenSnapshot(snapshot);
    input.state.profile.name = "mutated";
    input.resource.stores = { status: "idle", pending: false };
    if (
      snapshot.state.profile.name !== "Selman" ||
      snapshot.resource.stores.status !== "succeeded"
    ) {
      fail(
        "VALUE_RESOLUTION_SNAPSHOT_BOUNDARY_DRIFT",
        "Caller mutation changed the detached runtime snapshot.",
      );
    }

    let forgedRejected = false;
    try {
      runtimeApi.resolveRuntimeValue("literal", createProbeInput());
    } catch (error) {
      forgedRejected = error instanceof TypeError;
    }
    if (!forgedRejected) {
      fail(
        "VALUE_RESOLUTION_SNAPSHOT_BOUNDARY_DRIFT",
        "The resolver accepted a snapshot that did not come from its factory.",
      );
    }

    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(
        {
          name: { $ref: "state.profile.name" },
          tenant: { $ref: "context.route.tenant" },
          resource: { $ref: "resource.stores.value.items" },
          operation: { $ref: "operation.save.pending" },
          error: { $ref: "operation.signIn.error.code" },
          event: { $ref: "event.field.id" },
          item: { $ref: "item.task.title" },
          env: { $ref: "env.viewport.width" },
        },
        snapshot,
      ),
      {
        status: "resolved",
        value: {
          env: 1280,
          error: "invalidCredentials",
          event: "email",
          item: "Protokolü kanıtla",
          name: "Selman",
          operation: true,
          resource: [{ id: "store-1" }],
          tenant: "desenlab",
        },
        usedFallback: false,
      },
      "all seven namespaces resolve without effects",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(
        { $ref: "state.profile.nullable", fallback: "wrong" },
        snapshot,
      ),
      { status: "resolved", value: null, usedFallback: false },
      "JSON null remains resolved",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(
        { $ref: "state.profile.nickname", fallback: "anonymous" },
        snapshot,
      ),
      { status: "resolved", value: "anonymous", usedFallback: true },
      "missing valid path selects fallback",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue({ $ref: "state.unknown", fallback: "guessed" }, snapshot),
      {
        status: "unresolved",
        code: "REFERENCE_UNRESOLVED",
        pointer: "/$ref",
        reference: "state.unknown",
        reason: "unknown-root",
      },
      "unknown root ignores fallback",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue({ $ref: "state.list.length", fallback: "missing" }, snapshot),
      { status: "resolved", value: "missing", usedFallback: true },
      "arrays are never path-traversed",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue({ $ref: "state.indirect" }, snapshot),
      {
        status: "resolved",
        value: { $ref: "context.private" },
        usedFallback: false,
      },
      "reference-shaped scope data remains inert",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(
        {
          cards: [
            { title: "valid" },
            { title: { $ref: "state.profile.missing" } },
            { title: "must not escape" },
          ],
        },
        snapshot,
      ),
      {
        status: "unresolved",
        code: "REFERENCE_UNRESOLVED",
        pointer: "/cards/1/title/$ref",
        reference: "state.profile.missing",
        reason: "missing-path",
      },
      "failed composites expose no partial value",
    );
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue({ $token: "color.action.primary" }, snapshot),
      {
        status: "deferred",
        form: "token",
        pointer: "/$token",
      },
      "token materialization remains fenced",
    );

    const unavailable = runtimeApi.createRuntimeResolutionSnapshot({
      ...createProbeInput(),
      event: { status: "unavailable" },
    });
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue({ $ref: "event.field", fallback: "guessed" }, unavailable),
      {
        status: "unresolved",
        code: "REFERENCE_UNRESOLVED",
        pointer: "/$ref",
        reference: "event.field",
        reason: "inactive-scope",
      },
      "inactive event scope ignores fallback",
    );

    let accessorCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "unsafe";
      },
    });
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(accessor, snapshot),
      {
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      },
      "accessor-backed values fail closed",
    );
    if (accessorCalls !== 0) {
      fail("VALUE_RESOLUTION_SNAPSHOT_BOUNDARY_DRIFT", "Accessor rejection invoked caller code.");
    }
    const tooLarge = new Array(EXPECTED_LIMITS.maxJsonNodes).fill(null);
    assertRuntimeOutcome(
      runtimeApi.resolveRuntimeValue(tooLarge, snapshot),
      {
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      },
      "node budget rejects the complete value",
    );

    const amplificationSnapshot = runtimeApi.createRuntimeResolutionSnapshot(
      createAmplificationInput(),
    );
    for (const [spec, label] of [
      [
        new Array(5).fill(null).map(() => ({ $ref: "state.largeArray" })),
        "repeated references cannot amplify the output node budget",
      ],
      [
        new Array(3).fill(null).map(() => ({ $ref: "state.largeText" })),
        "repeated references cannot amplify the output string budget",
      ],
      [
        nestedArray(80, { $ref: "state.deep" }),
        "composed references cannot amplify the output depth budget",
      ],
    ]) {
      assertRuntimeOutcome(
        runtimeApi.resolveRuntimeValue(spec, amplificationSnapshot),
        {
          status: "invalid",
          pointer: "",
          reason: "unsafe-or-unbounded-json",
        },
        label,
      );
    }

    return Object.freeze({
      namespaces: 7,
      resolutionProbes: 10,
      safetyProbes: 8,
      fallbackOnlyOnMissing: true,
      nullIsResolved: true,
      arraysTraversed: false,
      secondPassEvaluation: false,
      partialCompositeValues: false,
      composedOutputBudgeted: true,
      hostCallbacksInvoked: 0,
      accessorCalls: 0,
      factoryBrandRequired: true,
      callerMutationIsolated: true,
    });
  } catch (error) {
    if (error instanceof RuntimeCoreValueResolutionEvidenceError) throw error;
    fail(
      "VALUE_RESOLUTION_RUNTIME_BEHAVIOR_DRIFT",
      "The built runtime threw unexpectedly during deterministic M04-T02 probes.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function verifyPackageManifest(packageManifest) {
  if (
    packageManifest.private !== true ||
    packageManifest.type !== "module" ||
    packageManifest.sideEffects !== false ||
    JSON.stringify(packageManifest.files) !== JSON.stringify(["dist"]) ||
    JSON.stringify(packageManifest.exports) !==
      JSON.stringify({
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
      }) ||
    packageManifest.dependencies?.["@desen/protocol"] !== "workspace:*" ||
    packageManifest.devDependencies?.vitest !== "4.1.10" ||
    packageManifest.scripts?.["test:value-resolution"] !==
      "vitest run test/value-resolution.test.ts" ||
    packageManifest.scripts?.test !== "vitest run" ||
    packageManifest.scripts?.lint !== "eslint src test --max-warnings=0"
  ) {
    fail(
      "VALUE_RESOLUTION_PACKAGE_CONTRACT_DRIFT",
      "runtime-core package dependencies or focused value-resolution quality scripts differ.",
    );
  }
}

function verifyRootScripts(rootPackage) {
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootPackage.scripts?.[name] !== command) {
      fail(
        "VALUE_RESOLUTION_ROOT_SCRIPT_DRIFT",
        `Root script ${name} differs from M04-T02 evidence.`,
      );
    }
  }
  for (const [owner, required] of [
    ["test", "pnpm test:runtime-core-value-resolution"],
    ["check", "pnpm verify:runtime-core-value-resolution"],
  ]) {
    if (!rootPackage.scripts?.[owner]?.includes(required)) {
      fail("VALUE_RESOLUTION_ROOT_SCRIPT_DRIFT", `Root ${owner} omits ${required}.`);
    }
  }
}

function verifyTrace(trace) {
  const evidence = [];
  for (const expected of EXPECTED_TRACE_RULES) {
    const item = trace[expected.collection]?.find((candidate) => candidate.id === expected.id);
    if (
      item === undefined ||
      item.section !== expected.section ||
      JSON.stringify(item.owners) !== JSON.stringify(expected.owners)
    ) {
      fail(
        "VALUE_RESOLUTION_TRACE_DRIFT",
        `Trace rule ${expected.id} differs from M04-T02 ownership.`,
      );
    }
    evidence.push(
      Object.freeze({
        collection: expected.collection,
        id: expected.id,
        section: expected.section,
        owners: Object.freeze([...expected.owners]),
        status: expected.status,
      }),
    );
  }
  return Object.freeze(evidence);
}

function verifyFinding(findings) {
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!findings.includes(required)) {
      fail(
        "VALUE_RESOLUTION_FINDING_DRIFT",
        "PF-032 no longer records the required runtime-resolution profile boundary.",
        { required },
      );
    }
  }
}

async function prerequisiteEvidence(verifyPrerequisite, injectedBytes) {
  const trackedBytes = await readFile(DEFAULT_RUNTIME_CORE_HOST_PORTS_ARTIFACT_PATH);
  if (injectedBytes !== undefined && !byteEqual(injectedBytes, trackedBytes)) {
    fail(
      "VALUE_RESOLUTION_PREREQUISITE_DRIFT",
      "Injected M04-T01 prerequisite bytes differ from the tracked artifact.",
    );
  }
  const bytes = injectedBytes ?? trackedBytes;
  const artifactSha256 = sha256(bytes);
  if (verifyPrerequisite) {
    const result = await verifyRuntimeCoreHostPortsEvidence();
    const verifiedSha256 = String(result.artifactSha256).replace(/^sha256:/u, "");
    if (verifiedSha256 !== artifactSha256) {
      fail(
        "VALUE_RESOLUTION_PREREQUISITE_DRIFT",
        "M04-T01 verification hash differs from its tracked artifact bytes.",
        { artifactSha256, verifiedSha256 },
      );
    }
  }
  return Object.freeze({
    task: "M04-T01",
    result: "PASS",
    artifact: "runtime-core-0.1.0-host-ports.json",
    artifactSha256,
  });
}

async function trackedFiles(fileOverrides) {
  const records = [];
  for (const relativePath of TRACKED_PATHS) {
    const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
    records.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
      }),
    );
  }
  return Object.freeze(records);
}

/**
 * Builds deterministic M04-T02 evidence from runtime behavior, distribution, and tracked contracts.
 */
export async function buildRuntimeCoreValueResolutionEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    sourceText,
    indexSource,
    declarationText,
    builtJavaScript,
    indexDeclarationText,
    indexBuiltJavaScript,
    packageTestSource,
    compilerCaseSource,
    rootTestSource,
    packageText,
    rootPackageText,
    traceText,
    findings,
    prerequisite,
  ] = await Promise.all([
    readWorkspaceText("packages/runtime-core/src/value-resolution.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/value-resolution.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/value-resolution.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/value-resolution.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/value-resolution.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-value-resolution.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    prerequisiteEvidence(
      normalized.verifyPrerequisite !== false,
      normalized.prerequisiteArtifactBytes,
    ),
  ]);
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const publicApi = verifySourceContract(sourceText, indexSource);
  verifyDeclarations(declarationText, builtJavaScript, indexDeclarationText, indexBuiltJavaScript);
  const runtime = verifyRuntimeBehavior(runtimeApi);
  const testInventory = verifyTestInventory(packageTestSource, compilerCaseSource, rootTestSource);
  verifyPackageManifest(JSON.parse(packageText));
  verifyRootScripts(JSON.parse(rootPackageText));
  const traceRules = verifyTrace(JSON.parse(traceText));
  verifyFinding(findings);
  const files = await trackedFiles(fileOverrides);

  const artifact = {
    schemaVersion: 1,
    task: "M04-T02",
    result: "PASS",
    claim: {
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Literal and read-only reference values resolve deterministically against one bounded atomic snapshot; fallback distinguishes missing from JSON null and cannot legalize invalid scopes.",
      protocolStatusChanges: [],
      proofMatrixStatusChanges: [],
      normativeStatusChanges: [],
    },
    prerequisite,
    publicApi,
    safetyProfile: {
      ...EXPECTED_LIMITS,
      aggregateSnapshot: "all seven namespaces copied before exposure",
      callerMutationIsolation: true,
      recursiveFreeze: true,
      accessorsInvoked: false,
      promisesAwaited: false,
      reflectionFailuresContained: true,
      arbitraryProxyCodeExecutionPrevented: false,
      acceptedRecordPrototype:
        "null or Object-constructor-compatible; categorical spoof detection is not claimed",
      inheritedDataObservable: false,
    },
    runtime,
    referenceSemantics: {
      namespaces: ["state", "context", "resource", "operation", "event", "item", "env"],
      rootSelection: "exact second segment; no longest-prefix matching or escaping",
      arrayPolicy: "whole values may resolve; reference paths never traverse arrays",
      fallbackPolicy:
        "only a missing path under a legal active root; JSON null and invalid scope never select fallback",
      lifecycleSurface: ["status", "pending", "value", "value.*", "error.code"],
      eventLifetime: "explicitly available only for the immediate handler snapshot",
      secondPassEvaluation: false,
      returnedValues: "complete recursively frozen JSON or a no-value failure/deferred union",
    },
    diagnosticBoundary: {
      unresolvedCode: "REFERENCE_UNRESOLVED",
      unresolvedPointer: "exact relative RFC 6901 pointer to $ref",
      propTypeMismatchProducedHere: false,
      optionalPropOmissionProducedHere: false,
    },
    portability: {
      sourceRuntimeDependencies: ["@desen/protocol"],
      typeOnlyDependencies: ["@desen/protocol", "./host-ports.js"],
      forbiddenPlatformsFound: [],
      hostCallbacksInvoked: 0,
      a2uiDependencies: [],
    },
    evidence: {
      ...testInventory,
      traceRules,
      trackedFiles: files,
      rootScripts: Object.keys(ROOT_SCRIPTS),
    },
    deferred: [
      "target-token resolution and deterministic formatting (M04-T03)",
      "consumer prop/style schema validation and PROP_TYPE_MISMATCH composition (M05)",
      "optional unresolved prop omission versus required node failure (M05)",
      "resource and operation lifecycle transitions, concurrency, and settlement (M04-T08/M04-T09)",
      "full runtime integration and conformance vectors (M04-T16)",
      "context secret classification and host-profile schema standardization",
      "React, browser, iOS, and Android adapters",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact: Object.freeze(artifact),
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

async function assertRegularArtifact(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("VALUE_RESOLUTION_ARTIFACT_UNREADABLE", "M04-T02 artifact could not be inspected.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!entry.isFile()) {
    fail("VALUE_RESOLUTION_ARTIFACT_UNSAFE", "M04-T02 artifact must be a regular file.");
  }
}

/** Verifies tracked or injected M04-T02 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreValueResolutionEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreValueResolutionEvidence(normalized.buildOptions);
  let artifactBytes = normalized.artifactBytes;
  if (artifactBytes === undefined) {
    await assertRegularArtifact(artifactPath);
    artifactBytes = await readFile(artifactPath);
  }
  if (!byteEqual(artifactBytes, expected.artifactBytes)) {
    fail("VALUE_RESOLUTION_ARTIFACT_DRIFT", "M04-T02 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(artifactBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    namespaces: expected.artifact.runtime.namespaces,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Atomically writes the deterministic M04-T02 artifact after all evidence checks pass. */
export async function writeRuntimeCoreValueResolutionEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreValueResolutionEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreValueResolutionEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T02 evidence boundary. */
export const RUNTIME_CORE_VALUE_RESOLUTION_ROOT_SCRIPTS = Object.freeze(Object.keys(ROOT_SCRIPTS));
