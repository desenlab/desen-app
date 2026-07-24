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

/** Absolute path to the deterministic M04-T03 token/format evidence artifact. */
export const DEFAULT_RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-token-format-resolution.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["materializeRuntimeValue"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeTokenProviderFailure",
  "RuntimeTokenUnresolved",
  "RuntimeValueMaterialization",
  "RuntimeValueMaterializationContext",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze(
  [...EXPECTED_RUNTIME_EXPORTS, ...EXPECTED_TYPE_EXPORTS].sort(),
);
const ALLOWED_SOURCE_MODULES = Object.freeze([
  "@desen/protocol",
  "./host-ports.js",
  "./value-resolution.js",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-048",
    section: "14.4",
    owners: Object.freeze(["M03-T07", "M04-T03"]),
    status: "RUNTIME_PRIMITIVE_TARGET_VALIDATION_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-049",
    section: "14.5",
    owners: Object.freeze(["M02-T10", "M04-T03", "M12-T03"]),
    status: "RUNTIME_PRIMITIVE_SECURITY_AUDIT_DEFERRED",
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-033 — Token and string-format materialization require a deterministic runtime profile",
  "raw strings are inserted unchanged",
  "all other resolved JSON values use RFC 8785 canonical JSON",
  "one host lookup occurs per unique token name in one top-level materialization",
  "a missing token uses REFERENCE_UNRESOLVED",
  "provider failures use a redacted ADAPTER_FAILURE",
  "consumer-schema validation remains M05",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-token-format-resolution":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:token-format-resolution && node scripts/generate-runtime-core-token-format-resolution-proof.mjs",
  "verify:runtime-core-token-format-resolution":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:token-format-resolution && node scripts/verify-runtime-core-token-format-resolution.mjs",
  "test:runtime-core-token-format-resolution":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:token-format-resolution && node --test tests/runtime-core-token-format-resolution.test.mjs",
});
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/token-format-resolution.test.ts";
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/token-format-resolution.ts",
  "packages/runtime-core/test/token-format-resolution.test.ts",
  "packages/runtime-core/test/token-format-resolution.types.ts",
  "packages/runtime-core/dist/token-format-resolution.js",
  "packages/runtime-core/dist/token-format-resolution.js.map",
  "packages/runtime-core/dist/token-format-resolution.d.ts",
  "packages/runtime-core/dist/token-format-resolution.d.ts.map",
  "scripts/lib/runtime-core-token-format-resolution-proof.mjs",
  "scripts/generate-runtime-core-token-format-resolution-proof.mjs",
  "scripts/verify-runtime-core-token-format-resolution.mjs",
  "tests/runtime-core-token-format-resolution.test.mjs",
]);
const REQUIRED_PACKAGE_TEST_TITLES = Object.freeze([
  "resolves each unique token once with a detached frozen request and a fresh per-call cache",
  "keeps token missing, resolved null, and redacted provider failure distinct",
  "keeps resolved token data inert and rejects hostile or over-budget provider values",
  "formats raw strings and canonical JSON with exact PF-017 placeholder semantics",
  "materializes nested references, tokens, formats, and fallback without a partial value",
  "bounds amplified format output and preserves exact failure pointers",
  "rejects unsafe materialization contexts before invoking the token provider",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T03 token/format evidence",
  "two independent token/format evidence builds are byte-identical",
  "rejects stale or one-byte-tampered token/format evidence",
  "rejects token request, cache, and resolved-null semantic drift",
  "rejects missing-token, provider-redaction, and inert-result semantic drift",
  "rejects PF-017 parsing and canonical JSON formatting drift",
  "rejects partial results or removal of amplified-output bounds",
  "rejects public export, TSDoc, platform-import, and declaration drift",
  "rejects package, root wiring, skipped tests, and conditional test registration drift",
  "rejects direct trace ownership and PF-033 boundary drift",
  "rejects stale injected M04-T02 prerequisite bytes",
  "atomic token/format writer rejects symlink destinations",
  "atomic token/format writer detects temporary-byte tampering before rename",
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
]);

/** Stable error class used by deterministic M04-T03 evidence and mutation tests. */
export class RuntimeCoreTokenFormatResolutionEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreTokenFormatResolutionEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreTokenFormatResolutionEvidenceError(code, message, details);
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
    fail("TOKEN_FORMAT_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T03 contract.`, { expected, actual });
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
  const names = [];
  const missingTsdoc = [];
  for (const statement of sourceFile.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
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

function verifySourceImports(sourceFile) {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const observedModules = [];
  for (const statement of imports) {
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
        "TOKEN_FORMAT_IMPORT_BOUNDARY_DRIFT",
        "Token/format resolution permits only explicit non-aliased named imports.",
      );
    }
    const moduleName = statement.moduleSpecifier.text;
    if (!ALLOWED_SOURCE_MODULES.includes(moduleName)) {
      fail(
        "TOKEN_FORMAT_IMPORT_BOUNDARY_DRIFT",
        `Unexpected token/format source dependency ${moduleName}.`,
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
      "TOKEN_FORMAT_IMPORT_BOUNDARY_DRIFT",
      "M04-T03 must compose the M04-T02 value-resolution primitive.",
    );
  }
  if (!observedModules.some(({ module }) => module === "./host-ports.js")) {
    fail(
      "TOKEN_FORMAT_IMPORT_BOUNDARY_DRIFT",
      "M04-T03 must consume the explicit M04-T01 token host contract.",
    );
  }
  return Object.freeze(observedModules);
}

function verifyPlatformBoundary(sourceFile, code = "TOKEN_FORMAT_PLATFORM_BOUNDARY_DRIFT") {
  const forbidden = new Set();

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
    fail(code, "Executable evaluation or a platform/global dependency entered M04-T03.", {
      forbidden: [...forbidden].sort(),
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
      statement.moduleSpecifier.text !== "./token-format-resolution.js"
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "TOKEN_FORMAT_INDEX_EXPORT_DRIFT",
        `${fileName} must expose M04-T03 through explicit non-aliased named exports.`,
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
    EXPECTED_RUNTIME_EXPORTS,
    "TOKEN_FORMAT_INDEX_EXPORT_DRIFT",
    `${fileName} runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    expectedTypeExports,
    "TOKEN_FORMAT_INDEX_EXPORT_DRIFT",
    `${fileName} type exports`,
  );
  verifyPlatformBoundary(inventory.sourceFile, "TOKEN_FORMAT_INDEX_EXPORT_DRIFT");
}

function verifySourceAndDistribution({
  sourceText,
  sourceIndexText,
  declarationText,
  builtJavaScript,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const source = collectExportedDeclarations(sourceText, "token-format-resolution.ts");
  assertArrayEqual(
    source.names,
    EXPECTED_SOURCE_EXPORTS,
    "TOKEN_FORMAT_SOURCE_EXPORT_DRIFT",
    "Token/format source exports",
  );
  if (source.missingTsdoc.length > 0) {
    fail("TOKEN_FORMAT_TSDOC_MISSING", "Every public M04-T03 declaration requires TSDoc.", {
      missing: source.missingTsdoc,
    });
  }
  const allowedSourceImports = verifySourceImports(source.sourceFile);
  verifyPlatformBoundary(source.sourceFile);
  verifyIndexContract(sourceIndexText, "src/index.ts", EXPECTED_TYPE_EXPORTS);

  const declarations = collectExportedDeclarations(
    declarationText,
    "dist/token-format-resolution.d.ts",
  );
  assertArrayEqual(
    declarations.names,
    EXPECTED_SOURCE_EXPORTS,
    "TOKEN_FORMAT_DECLARATION_DRIFT",
    "Built token/format declarations",
  );
  if (declarations.missingTsdoc.length > 0) {
    fail("TOKEN_FORMAT_DECLARATION_DRIFT", "Built M04-T03 declarations lost public TSDoc.", {
      missing: declarations.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declarations.sourceFile, "TOKEN_FORMAT_DISTRIBUTION_BOUNDARY_DRIFT");
  const builtSource = ts.createSourceFile(
    "dist/token-format-resolution.js",
    builtJavaScript,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  verifyPlatformBoundary(builtSource, "TOKEN_FORMAT_DISTRIBUTION_BOUNDARY_DRIFT");
  verifyIndexContract(builtIndexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS);
  verifyIndexContract(builtIndexJavaScript, "dist/index.js", []);

  return Object.freeze({
    publicDeclarations: source.names.length,
    tsdocDeclarations: source.names.length,
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    allowedSourceImports,
  });
}

function callKind(expression) {
  if (ts.isIdentifier(expression) && (expression.text === "it" || expression.text === "test")) {
    return expression.text;
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    (expression.expression.text === "it" || expression.expression.text === "test")
  ) {
    return `${expression.expression.text}.${expression.name.text}`;
  }
  return undefined;
}

function collectDirectTests(sourceText, fileName, expectedTitles) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const titles = [];
  const rootFile = fileName.endsWith(".mjs");
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const kind = callKind(node.expression);
      if (kind !== undefined) {
        if (kind !== "it" && kind !== "test") {
          fail("TOKEN_FORMAT_TEST_INVENTORY_DRIFT", `${fileName} contains ${kind}.`);
        }
        const title = node.arguments[0];
        if (title === undefined || !ts.isStringLiteral(title)) {
          fail(
            "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
            `${fileName} test titles must be direct string literals.`,
          );
        }
        const expressionStatement = node.parent;
        if (!ts.isExpressionStatement(expressionStatement)) {
          fail(
            "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
            `${fileName} test ${title.text} is conditionally wrapped.`,
          );
        }
        if (rootFile) {
          if (!ts.isSourceFile(expressionStatement.parent)) {
            fail(
              "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
              `${fileName} root test ${title.text} is not top-level.`,
            );
          }
        } else {
          const block = expressionStatement.parent;
          const callback = block?.parent;
          const describeCall = callback?.parent;
          if (
            !ts.isBlock(block) ||
            (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
            !ts.isCallExpression(describeCall) ||
            !ts.isIdentifier(describeCall.expression) ||
            describeCall.expression.text !== "describe" ||
            !ts.isExpressionStatement(describeCall.parent) ||
            !ts.isSourceFile(describeCall.parent.parent)
          ) {
            fail(
              "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
              `${fileName} package test ${title.text} is not directly inside one top-level describe.`,
            );
          }
        }
        titles.push(title.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (new Set(titles).size !== titles.length) {
    fail("TOKEN_FORMAT_TEST_INVENTORY_DRIFT", `${fileName} contains duplicate test titles.`);
  }
  for (const expected of expectedTitles) {
    if (!titles.includes(expected)) {
      fail(
        "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
        `${fileName} is missing required test ${expected}.`,
      );
    }
  }
  return Object.freeze(titles.sort());
}

function compilerNegativeCases(sourceText) {
  const count = sourceText.match(/@ts-expect-error\b/gu)?.length ?? 0;
  if (count === 0) {
    fail("TOKEN_FORMAT_TEST_INVENTORY_DRIFT", "M04-T03 requires compile-time negative contracts.");
  }
  return count;
}

function verifyTestInventory({ packageTests, typeTests, rootTests, workspaceTypeTests }) {
  const packageTitles = collectDirectTests(
    packageTests,
    "token-format-resolution.test.ts",
    REQUIRED_PACKAGE_TEST_TITLES,
  );
  const rootTitles = collectDirectTests(
    rootTests,
    "runtime-core-token-format-resolution.test.mjs",
    REQUIRED_ROOT_TEST_TITLES,
  );
  const observedCompilerNegativeCases = compilerNegativeCases(typeTests);
  const expectedCompilerNegativeCases = compilerNegativeCases(workspaceTypeTests);
  if (observedCompilerNegativeCases !== expectedCompilerNegativeCases) {
    fail(
      "TOKEN_FORMAT_TEST_INVENTORY_DRIFT",
      "M04-T03 compiler-negative case inventory changed under evidence injection.",
      {
        expected: expectedCompilerNegativeCases,
        actual: observedCompilerNegativeCases,
      },
    );
  }
  return Object.freeze({
    packageTests: packageTitles.length,
    compilerNegativeCases: observedCompilerNegativeCases,
    rootMutationTests: rootTitles.length,
    packageTestTitles: packageTitles,
    rootTestTitles: rootTitles,
  });
}

function verifyPackageAndRootWiring(packageManifest, rootManifest) {
  if (
    packageManifest.name !== "@desen/runtime-core" ||
    packageManifest.scripts?.["test:token-format-resolution"] !== EXPECTED_PACKAGE_TEST_SCRIPT
  ) {
    fail(
      "TOKEN_FORMAT_PACKAGE_CONTRACT_DRIFT",
      "The runtime-core focused M04-T03 test command changed.",
    );
  }
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootManifest.scripts?.[name] !== command) {
      fail("TOKEN_FORMAT_ROOT_SCRIPT_DRIFT", `Root command ${name} changed.`, {
        expected: command,
        actual: rootManifest.scripts?.[name],
      });
    }
  }
  const verifyToken = "pnpm verify:runtime-core-token-format-resolution";
  const testToken = "pnpm test:runtime-core-token-format-resolution";
  const checkSegments = String(rootManifest.scripts?.check ?? "").split(" && ");
  const testSegments = String(rootManifest.scripts?.test ?? "").split(" && ");
  if (
    checkSegments.filter((segment) => segment === verifyToken).length !== 1 ||
    testSegments.filter((segment) => segment === testToken).length !== 1 ||
    checkSegments.indexOf(verifyToken) <=
      checkSegments.indexOf("pnpm verify:runtime-core-value-resolution") ||
    testSegments.indexOf(testToken) <=
      testSegments.indexOf("pnpm test:runtime-core-value-resolution")
  ) {
    fail(
      "TOKEN_FORMAT_ROOT_SCRIPT_DRIFT",
      "Aggregate check/test commands must include M04-T03 exactly once after M04-T02.",
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
      fail("TOKEN_FORMAT_TRACE_DRIFT", `Trace ownership for ${expected.id} changed.`);
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
        item.owners.includes("M04-T03") &&
        !EXPECTED_TRACE_RULES.some(
          (expected) => expected.collection === collection && expected.id === item.id,
        )
      ) {
        unexpected.push(`${collection}:${item.id}`);
      }
    }
  }
  if (unexpected.length > 0) {
    fail("TOKEN_FORMAT_TRACE_DRIFT", "Unreviewed trace ownership entered M04-T03.", {
      unexpected,
    });
  }
  return Object.freeze(observed);
}

function verifyFinding(findings) {
  const normalizedFindings = findings.replaceAll("`", "").replaceAll(/\s+/gu, " ");
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!normalizedFindings.includes(required.replaceAll(/\s+/gu, " "))) {
      fail("TOKEN_FORMAT_FINDING_DRIFT", `PF-033 is missing required text: ${required}`);
    }
  }
}

function assertDeepEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", `${label} differs.`, { expected, actual });
  }
}

function assertFrozenJson(value, label) {
  const pending = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;
    if (!Object.isFrozen(current)) {
      fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
    }
    pending.push(...(Array.isArray(current) ? current : Object.values(current)));
  }
}

function snapshotInput() {
  return {
    state: {
      profile: { name: "Ada", missing: null },
      selected: null,
    },
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { locale: "tr-TR" },
  };
}

function requestContext() {
  return {
    documentId: "run.desen.proof",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId: "main",
    requestId: "m04-t03-proof-1",
  };
}

function probeRuntimeBehavior(runtimeApi) {
  if (
    typeof runtimeApi?.materializeRuntimeValue !== "function" ||
    typeof runtimeApi?.createRuntimeResolutionSnapshot !== "function"
  ) {
    fail("TOKEN_FORMAT_RUNTIME_API_DRIFT", "Built runtime API does not expose M04-T03.");
  }
  const snapshot = runtimeApi.createRuntimeResolutionSnapshot(snapshotInput());
  const calls = [];
  let accessorCalls = 0;
  const tokenValues = new Map([
    ["color.action.primary", { status: "resolved", value: "#5b48e8" }],
    ["value.null", { status: "resolved", value: null }],
    [
      "value.inert",
      {
        status: "resolved",
        value: { $ref: "state.profile.name", nested: { $token: "must-not-run" } },
      },
    ],
    ["value.object", { status: "resolved", value: { z: 2, a: [true, null] } }],
    ["value.missing", { status: "missing" }],
  ]);
  const tokens = {
    resolve(request) {
      calls.push({
        request,
        requestFrozen: Object.isFrozen(request),
        contextFrozen: Object.isFrozen(request.context),
      });
      if (request.token === "value.throw") {
        throw new Error("secret provider detail");
      }
      if (request.token === "value.hostile") {
        const result = { status: "resolved" };
        Object.defineProperty(result, "value", {
          enumerable: true,
          get() {
            accessorCalls += 1;
            return "must-not-be-read";
          },
        });
        return result;
      }
      return tokenValues.get(request.token) ?? { status: "missing" };
    },
  };
  const context = { requestContext: requestContext(), tokens };

  const cached = runtimeApi.materializeRuntimeValue(
    [{ $token: "color.action.primary" }, { $token: "color.action.primary" }],
    snapshot,
    context,
  );
  assertDeepEqual(
    cached,
    {
      status: "resolved",
      value: ["#5b48e8", "#5b48e8"],
      usedFallback: false,
    },
    "Per-call token cache result",
  );
  assertFrozenJson(cached, "Per-call token cache result");
  if (calls.length !== 1 || !calls[0].requestFrozen || !calls[0].contextFrozen) {
    fail(
      "TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT",
      "A unique token must receive one detached frozen host request per top-level call.",
      { calls },
    );
  }
  assertDeepEqual(
    calls[0].request,
    { context: requestContext(), token: "color.action.primary" },
    "Host token request",
  );
  runtimeApi.materializeRuntimeValue({ $token: "color.action.primary" }, snapshot, context);
  if (calls.length !== 2) {
    fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", "Token caches must not cross top-level calls.");
  }

  const resolvedNull = runtimeApi.materializeRuntimeValue(
    { $token: "value.null" },
    snapshot,
    context,
  );
  assertDeepEqual(
    resolvedNull,
    { status: "resolved", value: null, usedFallback: false },
    "Resolved token null",
  );
  const missing = runtimeApi.materializeRuntimeValue(
    { $token: "value.missing" },
    snapshot,
    context,
  );
  assertDeepEqual(
    missing,
    {
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/$token",
      token: "value.missing",
      reason: "missing-token",
    },
    "Missing token",
  );
  const providerFailure = runtimeApi.materializeRuntimeValue(
    { wrapper: { $token: "value.throw" } },
    snapshot,
    context,
  );
  assertDeepEqual(
    providerFailure,
    {
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/wrapper/$token",
      adapter: "token-provider",
    },
    "Redacted provider failure",
  );
  if (
    JSON.stringify(providerFailure).includes("secret") ||
    Object.hasOwn(providerFailure, "token")
  ) {
    fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", "Provider failure leaked host or token detail.");
  }

  const inert = runtimeApi.materializeRuntimeValue({ $token: "value.inert" }, snapshot, context);
  assertDeepEqual(
    inert,
    {
      status: "resolved",
      value: { $ref: "state.profile.name", nested: { $token: "must-not-run" } },
      usedFallback: false,
    },
    "Inert token result",
  );
  if (calls.some(({ request }) => request.token === "must-not-run")) {
    fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", "Resolved token data was evaluated a second time.");
  }
  assertFrozenJson(inert, "Inert token result");

  const hostile = runtimeApi.materializeRuntimeValue(
    { $token: "value.hostile" },
    snapshot,
    context,
  );
  assertDeepEqual(
    hostile,
    {
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/$token",
      adapter: "token-provider",
    },
    "Accessor-backed token output",
  );
  if (accessorCalls !== 0 || Object.hasOwn(hostile, "value")) {
    fail(
      "TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT",
      "Accessor-backed token output must fail closed without partial data.",
      { hostile, accessorCalls },
    );
  }

  const formatted = runtimeApi.materializeRuntimeValue(
    {
      $format: {
        template: "{raw}|{count}|{flag}|{none}|{data}|{raw}",
        values: {
          raw: "Ada",
          count: 2,
          flag: true,
          none: null,
          data: { z: 2, a: [true, null] },
        },
      },
    },
    snapshot,
    context,
  );
  assertDeepEqual(
    formatted,
    {
      status: "resolved",
      value: 'Ada|2|true|null|{"a":[true,null],"z":2}|Ada',
      usedFallback: false,
    },
    "Deterministic formatted output",
  );

  const nested = runtimeApi.materializeRuntimeValue(
    {
      $format: {
        template: "{greeting} / {color} / {fallback}",
        values: {
          greeting: {
            $format: {
              template: "Hello {name}",
              values: { name: { $ref: "state.profile.name" } },
            },
          },
          color: { $token: "color.action.primary" },
          fallback: { $ref: "state.profile.absent", fallback: "none" },
        },
      },
    },
    snapshot,
    context,
  );
  assertDeepEqual(
    nested,
    {
      status: "resolved",
      value: "Hello Ada / #5b48e8 / none",
      usedFallback: true,
    },
    "Nested materialization",
  );

  const malformedCases = [
    {
      spec: { $format: { template: "{missing}", values: {} } },
      pointer: "/$format/template",
    },
    {
      spec: { $format: { template: "plain", values: { unused: "x" } } },
      pointer: "/$format/values/unused",
    },
    {
      spec: { $format: { template: "{{name}}", values: { name: "Ada" } } },
      pointer: "/$format/template",
    },
    {
      spec: { $format: { template: "{name.path}", values: { name: "Ada" } } },
      pointer: "/$format/template",
    },
  ];
  for (const { spec, pointer } of malformedCases) {
    const result = runtimeApi.materializeRuntimeValue(spec, snapshot, context);
    if (
      result.status !== "invalid" ||
      result.reason !== "malformed-format" ||
      result.pointer !== pointer ||
      Object.hasOwn(result, "value")
    ) {
      fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", "PF-017 malformed format drifted.", {
        spec,
        result,
      });
    }
  }

  const noPartial = runtimeApi.materializeRuntimeValue(
    ["visible-before-failure", { nested: { $token: "value.missing" } }, "visible-after-failure"],
    snapshot,
    context,
  );
  if (
    noPartial.status !== "unresolved" ||
    noPartial.pointer !== "/1/nested/$token" ||
    Object.hasOwn(noPartial, "value")
  ) {
    fail("TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT", "A failed member exposed a partial composite.");
  }

  const amplified = runtimeApi.materializeRuntimeValue(
    {
      $format: {
        template: "{x}".repeat(220_000),
        values: { x: "12345" },
      },
    },
    snapshot,
    context,
  );
  if (
    amplified.status !== "invalid" ||
    amplified.reason !== "unsafe-or-unbounded-json" ||
    Object.hasOwn(amplified, "value")
  ) {
    fail(
      "TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT",
      "Amplified format output escaped the string budget.",
    );
  }

  let invalidContextCalls = 0;
  const invalidTokens = {
    resolve() {
      invalidContextCalls += 1;
      return { status: "resolved", value: "unsafe" };
    },
  };
  let invalidContextRejected = false;
  try {
    runtimeApi.materializeRuntimeValue({ $token: "x" }, snapshot, {
      requestContext: { ...requestContext(), extra: "not-allowed" },
      tokens: invalidTokens,
    });
  } catch (error) {
    invalidContextRejected = error instanceof TypeError;
  }
  if (!invalidContextRejected || invalidContextCalls !== 0) {
    fail(
      "TOKEN_FORMAT_RUNTIME_BEHAVIOR_DRIFT",
      "Unsafe materialization context reached the token provider.",
    );
  }

  return Object.freeze({
    tokenProbes: 7,
    formatProbes: 8,
    safetyProbes: 4,
    uniqueTokenLookupsInCacheProbe: 1,
    topLevelCacheIsolation: true,
    missingDistinctFromNull: true,
    providerFailureRedacted: true,
    resolvedTokenDataInert: true,
    rawStringsUnchanged: true,
    nonStringsUseCanonicalJson: true,
    nestedMaterialization: true,
    partialValues: false,
    amplifiedOutputRejected: true,
    invalidContextCallbacks: 0,
  });
}

async function verifyPrerequisite({ prerequisiteArtifactBytes, verifyPrerequisiteEvidence }) {
  const trackedBytes = await readFile(DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH);
  if (
    prerequisiteArtifactBytes !== undefined &&
    !byteEqual(prerequisiteArtifactBytes, trackedBytes)
  ) {
    fail(
      "TOKEN_FORMAT_PREREQUISITE_DRIFT",
      "Injected M04-T02 prerequisite bytes differ from the tracked artifact.",
    );
  }
  const bytes = prerequisiteArtifactBytes ?? trackedBytes;
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("TOKEN_FORMAT_PREREQUISITE_DRIFT", "M04-T02 prerequisite is not valid JSON.");
  }
  if (parsed.task !== "M04-T02" || parsed.result !== "PASS") {
    fail("TOKEN_FORMAT_PREREQUISITE_DRIFT", "M04-T02 prerequisite identity/result changed.");
  }
  if (verifyPrerequisiteEvidence) {
    try {
      await verifyRuntimeCoreValueResolutionEvidence({
        artifactPath: DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH,
        artifactBytes: bytes,
      });
    } catch (error) {
      fail("TOKEN_FORMAT_PREREQUISITE_DRIFT", "M04-T02 prerequisite verification failed.", {
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

/** Builds fresh deterministic M04-T03 evidence without writing the tracked artifact. */
export async function buildRuntimeCoreTokenFormatResolutionEvidence(options = undefined) {
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
    packageReadme,
    proofDocument,
    tracked,
  ] = await Promise.all([
    verifyPrerequisite({
      prerequisiteArtifactBytes: normalized.prerequisiteArtifactBytes,
      verifyPrerequisiteEvidence: normalized.verifyPrerequisite !== false,
    }),
    readWorkspaceText("packages/runtime-core/src/token-format-resolution.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/token-format-resolution.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/token-format-resolution.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/token-format-resolution.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/token-format-resolution.types.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/token-format-resolution.types.ts"),
    readWorkspaceText("tests/runtime-core-token-format-resolution.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("packages/runtime-core/README.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-TOKEN-FORMAT-RESOLUTION.md", fileOverrides),
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
    fail("TOKEN_FORMAT_METADATA_INVALID", "Package or trace metadata is not valid JSON.");
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
    rootTests,
    workspaceTypeTests,
  });
  verifyPackageAndRootWiring(packageManifest, rootManifest);
  const traceRules = verifyTrace(trace);
  verifyFinding(findings);
  for (const [label, text, required] of [
    ["package README", packageReadme, "M04-T03"],
    ["package README", packageReadme, "materializeRuntimeValue"],
    ["proof document", proofDocument, "M04-T03"],
    ["proof document", proofDocument, "consumer-schema"],
  ]) {
    if (!text.includes(required)) {
      fail("TOKEN_FORMAT_DOCUMENTATION_DRIFT", `${label} is missing ${required}.`);
    }
  }

  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const runtime = probeRuntimeBehavior(runtimeApi);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T03",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Host-provided target tokens and closed deterministic string formats materialize as bounded complete outcomes without expression evaluation or partial values.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisite,
    publicApi,
    runtime,
    tokenSemantics: Object.freeze({
      storageOwnedByDesen: false,
      providerPort: "RuntimeTokenPort",
      requestContext: Object.freeze(["documentId", "revision", "surfaceId", "requestId"]),
      cacheScope: "one top-level materialization",
      missingCode: "REFERENCE_UNRESOLVED",
      resolvedNullIsSuccess: true,
      providerFailureCode: "ADAPTER_FAILURE",
      providerFailureRedacted: true,
      resolvedDataSecondPassEvaluation: false,
      receivingSchemaValidation: "M05",
    }),
    formatSemantics: Object.freeze({
      parser: "single-pass ASCII placeholder scanner",
      placeholderPattern: "[A-Za-z_][A-Za-z0-9_]*",
      repeatedPlaceholders: true,
      exactOwnValueKeySet: true,
      escaping: false,
      expressions: false,
      localeInference: false,
      rawStringPolicy: "insert unchanged",
      otherJsonPolicy: "RFC 8785 canonical JSON",
      output: "string",
    }),
    portability: Object.freeze({
      framework: null,
      platformGlobals: Object.freeze([]),
      dynamicEvaluation: false,
      a2uiDependencies: Object.freeze([]),
    }),
    evidence: Object.freeze({
      packageTests: testInventory.packageTests,
      compilerNegativeCases: testInventory.compilerNegativeCases,
      rootMutationTests: testInventory.rootMutationTests,
      traceRules,
      trackedFiles: tracked,
      rootScripts: Object.freeze(Object.keys(ROOT_SCRIPTS)),
    }),
    deferred: Object.freeze([
      "consumer prop/style schema validation and PROP_TYPE_MISMATCH composition (M05)",
      "reactive token invalidation and stale-result protection (M04-T15)",
      "complete headless runtime composition and observable trace (M04-T16)",
      "general DTCG import, export, theme, and mode resolution",
      "React, browser, iOS, and Android adapters",
    ]),
  });
  const artifactText = await format(JSON.stringify(artifact), { parser: "json" });
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
    fail("TOKEN_FORMAT_ARTIFACT_MISSING", "M04-T03 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("TOKEN_FORMAT_ARTIFACT_UNSAFE", "M04-T03 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T03 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreTokenFormatResolutionEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreTokenFormatResolutionEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!byteEqual(actualBytes, expected.artifactBytes)) {
    fail("TOKEN_FORMAT_ARTIFACT_DRIFT", "M04-T03 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    tokenProbes: expected.artifact.runtime.tokenProbes,
    formatProbes: expected.artifact.runtime.formatProbes,
    safetyProbes: expected.artifact.runtime.safetyProbes,
  });
}

/** Atomically writes deterministic M04-T03 evidence after every proof check passes. */
export async function writeRuntimeCoreTokenFormatResolutionEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreTokenFormatResolutionEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreTokenFormatResolutionEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T03 evidence boundary. */
export const RUNTIME_CORE_TOKEN_FORMAT_RESOLUTION_ROOT_SCRIPTS = Object.freeze(
  Object.keys(ROOT_SCRIPTS),
);
