import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-react/dist/index.js", import.meta.url);
const runtimeReactRequire = createRequire(
  new URL("../../packages/runtime-react/package.json", import.meta.url),
);
const { createElement } = runtimeReactRequire("react");
const { renderToStaticMarkup } = runtimeReactRequire("react-dom/server");

/** Absolute path to the deterministic M05-T01 React adapter-registry artifact. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json",
);

/** Absolute path to the human-readable M05-T01 proof. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md",
);

/** Absolute path to the exact M05-T01 Proof Matrix pin. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/PROOF-MATRIX.md",
);

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json";
const PREREQUISITE = Object.freeze({
  task: "M04-T17",
  gate: "G04",
  path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
  sha256: "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
});
const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryCreateInput",
  "RuntimeReactAdapterRegistryCreateResult",
  "RuntimeReactAdapterRegistryHandle",
  "RuntimeReactAdapterRegistryInvalidReason",
  "RuntimeReactAdapterRegistryLimitProfile",
  "RuntimeReactAdapterRegistryReadResult",
  "RuntimeReactAdapterRegistrySnapshot",
  "RuntimeReactBehaviorAdapterComponent",
  "RuntimeReactBehaviorAdapterProps",
  "RuntimeReactBehaviorAdapterRegistration",
  "RuntimeReactCommandAttachmentHandle",
  "RuntimeReactCommandAttachmentResult",
  "RuntimeReactCommandDetachmentResult",
  "RuntimeReactComponentAdapterComponent",
  "RuntimeReactComponentAdapterProps",
  "RuntimeReactComponentAdapterRegistration",
  "RuntimeReactComponentCommandPort",
  "RuntimeReactDiagnosticIdentity",
  "RuntimeReactEventDispatchResult",
  "RuntimeReactInteractionPort",
  "RuntimeReactNamedSlots",
  "RuntimeReactRenderFailure",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
]);
const EXPECTED_INTERNAL_SOURCE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryAuthority",
  "readRuntimeReactAdapterRegistryAuthority",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_RUNTIME_EXPORTS,
    ...EXPECTED_TYPE_EXPORTS,
    ...EXPECTED_INTERNAL_SOURCE_EXPORTS,
  ].sort(),
);
const EXPECTED_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
  "DUPLICATE_RUNTIME_IDENTITY",
  "INVALID_REGISTRY",
  "JSON_DEPTH_LIMIT_EXCEEDED",
  "JSON_OCCURRENCE_LIMIT_EXCEEDED",
  "MALFORMED_RENDER_PLAN",
  "NODE_LIMIT_EXCEEDED",
  "SLOT_LIMIT_EXCEEDED",
  "STRING_LIMIT_EXCEEDED",
  "UNKNOWN_BEHAVIOR_CAPABILITY",
  "UNKNOWN_COMPONENT_CAPABILITY",
]);
const EXPECTED_REGISTRY_REASONS = Object.freeze([
  "duplicate-capability",
  "identifier-limit",
  "invalid-limits",
  "malformed-registration",
  "registry-limit",
]);
const EXPECTED_REGISTRY_LIMITS = Object.freeze({
  maxComponentAdapters: 4_096,
  maxBehaviorAdapters: 4_096,
  maxIdentifierCodeUnits: 1_048_576,
});
const EXPECTED_RENDER_LIMITS = Object.freeze({
  maxNodes: 5_000,
  maxDepth: 128,
  maxSlotEntries: 20_000,
  maxBehaviors: 20_000,
  maxJsonDepth: 128,
  maxJsonOccurrences: 262_144,
  maxStringCodeUnits: 4_194_304,
});
const EXPECTED_TEST_INVENTORY = Object.freeze({
  packageTests: 10,
  compilerNegativeCases: 4,
  rootMutationTests: 11,
});
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-react/README.md",
  "packages/runtime-react/package.json",
  "packages/runtime-react/tsconfig.json",
  "packages/runtime-react/tsconfig.build.json",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/test/adapter-registry.test.tsx",
  "packages/runtime-react/test/adapter-registry.types.ts",
  "packages/runtime-react/dist/index.js",
  "packages/runtime-react/dist/index.js.map",
  "packages/runtime-react/dist/index.d.ts",
  "packages/runtime-react/dist/index.d.ts.map",
  "packages/runtime-react/dist/registry.js",
  "packages/runtime-react/dist/registry.js.map",
  "packages/runtime-react/dist/registry.d.ts",
  "packages/runtime-react/dist/registry.d.ts.map",
  "packages/runtime-react/dist/render-plan.js",
  "packages/runtime-react/dist/render-plan.js.map",
  "packages/runtime-react/dist/render-plan.d.ts",
  "packages/runtime-react/dist/render-plan.d.ts.map",
  "scripts/lib/runtime-react-adapter-registry-proof.mjs",
  "scripts/generate-runtime-react-adapter-registry-proof.mjs",
  "scripts/verify-runtime-react-adapter-registry.mjs",
  "tests/runtime-react-adapter-registry.test.mjs",
]);
const SOURCE_PATHS = Object.freeze([
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
]);
const ALLOWED_PRODUCTION_MODULES = Object.freeze(["./registry.js", "@desen/runtime-core", "react"]);
const FORBIDDEN_IDENTIFIERS = new Set([
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
]);

/** Stable evidence error used by deterministic hostile root tests. */
export class RuntimeReactAdapterRegistryEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactAdapterRegistryEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactAdapterRegistryEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function sorted(values) {
  return [...values].sort();
}

function sameStrings(actual, expected) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    fail("RUNTIME_REACT_OPTIONS_INVALID", "Evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? Buffer.from(override) : Buffer.from(String(override));
  }
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  const entry = await lstat(absolutePath);
  if (!entry.isFile()) {
    fail(
      "RUNTIME_REACT_TRACKED_FILE_INVALID",
      `Tracked evidence input must be a regular file: ${relativePath}`,
    );
  }
  return readFile(absolutePath);
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function parseSource(relativePath, sourceText) {
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (source.parseDiagnostics.length !== 0) {
    fail("RUNTIME_REACT_SOURCE_PARSE_FAILED", `Cannot parse ${relativePath}.`, {
      diagnostics: source.parseDiagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    });
  }
  return source;
}

function hasExportModifier(statement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function declarationNames(statement) {
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return statement.name === undefined ? [] : [statement.name.text];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => {
      if (!ts.isIdentifier(declaration.name)) {
        fail(
          "RUNTIME_REACT_SOURCE_EXPORT_DRIFT",
          "Exported destructuring declarations are outside the audited API.",
        );
      }
      return declaration.name.text;
    });
  }
  return [];
}

function hasTsdoc(sourceText, statement) {
  const ranges = ts.getLeadingCommentRanges(sourceText, statement.getFullStart()) ?? [];
  return ranges.some((range) => sourceText.slice(range.pos, range.end).startsWith("/**"));
}

function inspectSourceDeclarations(sourceEntries) {
  const exportedNames = [];
  const missingTsdoc = [];
  for (const [relativePath, sourceText] of sourceEntries) {
    const source = parseSource(relativePath, sourceText);
    for (const statement of source.statements) {
      if (!hasExportModifier(statement)) continue;
      const names = declarationNames(statement);
      if (names.length === 0) {
        fail(
          "RUNTIME_REACT_SOURCE_EXPORT_DRIFT",
          `Unsupported exported declaration in ${relativePath}.`,
        );
      }
      exportedNames.push(...names);
      if (!hasTsdoc(sourceText, statement)) missingTsdoc.push(...names);
    }
  }
  const actual = sorted(exportedNames);
  if (!sameStrings(actual, EXPECTED_SOURCE_EXPORTS)) {
    fail("RUNTIME_REACT_SOURCE_EXPORT_DRIFT", "React adapter source exports changed.", {
      expected: EXPECTED_SOURCE_EXPORTS,
      actual,
    });
  }
  if (missingTsdoc.length !== 0) {
    fail("RUNTIME_REACT_TSDOC_MISSING", "Every exported source declaration requires TSDoc.", {
      declarations: sorted(missingTsdoc),
    });
  }
  return Object.freeze({ declarations: actual, tsdocDeclarations: actual.length });
}

function inspectCapabilityMatcher(registrySourceText) {
  const relativePath = "packages/runtime-react/src/registry.ts";
  const source = parseSource(relativePath, registrySourceText);
  const expectedPattern = "/^[A-Za-z0-9][A-Za-z0-9.-]*\\/[A-Za-z][A-Za-z0-9._:-]{0,127}$/u";
  let actualPattern;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "CAPABILITY_ID_PATTERN" &&
        declaration.initializer !== undefined
      ) {
        actualPattern = declaration.initializer.getText(source);
      }
    }
  }
  const budgetCheck =
    "capabilityId.value.length > identifierBudget.maximum - identifierBudget.used";
  const matcherCall = "CAPABILITY_ID_PATTERN.test(capabilityId.value)";
  if (
    actualPattern !== expectedPattern ||
    registrySourceText.indexOf(budgetCheck) === -1 ||
    registrySourceText.indexOf(matcherCall) === -1 ||
    registrySourceText.indexOf(budgetCheck) > registrySourceText.indexOf(matcherCall)
  ) {
    fail(
      "RUNTIME_REACT_CAPABILITY_MATCHER_DRIFT",
      "Capability matching must retain the linear core profile and pre-regex identifier budget.",
      { expectedPattern, actualPattern },
    );
  }
  return Object.freeze({
    profile: "DESEN 0.1.0 linear core capability identifier",
    pattern: actualPattern,
    identifierBudgetBeforeMatcher: true,
  });
}

function exportKind(statement, specifier) {
  return statement.isTypeOnly || specifier?.isTypeOnly ? "type" : "runtime";
}

function inspectRootExports(relativePath, sourceText) {
  const source = parseSource(relativePath, sourceText);
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        statement.exportClause === undefined ||
        !ts.isNamedExports(statement.exportClause) ||
        statement.moduleSpecifier === undefined ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        fail(
          "RUNTIME_REACT_INDEX_EXPORT_DRIFT",
          `Only explicit named module exports are allowed in ${relativePath}.`,
        );
      }
      for (const specifier of statement.exportClause.elements) {
        const name = specifier.name.text;
        (exportKind(statement, specifier) === "type" ? types : runtime).push(name);
      }
      continue;
    }
    if (hasExportModifier(statement)) {
      fail(
        "RUNTIME_REACT_INDEX_EXPORT_DRIFT",
        `Root declarations are outside the audited export surface in ${relativePath}.`,
      );
    }
  }
  const actualRuntime = sorted(runtime);
  const actualTypes = sorted(types);
  if (
    !sameStrings(actualRuntime, EXPECTED_RUNTIME_EXPORTS) ||
    !sameStrings(actualTypes, EXPECTED_TYPE_EXPORTS)
  ) {
    fail("RUNTIME_REACT_INDEX_EXPORT_DRIFT", `Public exports changed in ${relativePath}.`, {
      expectedRuntime: EXPECTED_RUNTIME_EXPORTS,
      actualRuntime,
      expectedTypes: EXPECTED_TYPE_EXPORTS,
      actualTypes,
    });
  }
  return Object.freeze({ runtime: actualRuntime, types: actualTypes });
}

function readStringUnion(source, name) {
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== name) continue;
    if (!ts.isUnionTypeNode(statement.type)) {
      fail("RUNTIME_REACT_DECLARATION_DRIFT", `${name} must remain a string-literal union.`);
    }
    const values = statement.type.types.map((node) => {
      if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
        fail("RUNTIME_REACT_DECLARATION_DRIFT", `${name} contains a non-string member.`);
      }
      return node.literal.text;
    });
    return sorted(values);
  }
  fail("RUNTIME_REACT_DECLARATION_DRIFT", `Missing ${name}.`);
}

function inspectProductionBoundary(sourceEntries) {
  const modules = new Set();
  for (const [relativePath, sourceText] of sourceEntries) {
    const source = parseSource(relativePath, sourceText);
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
          fail("RUNTIME_REACT_IMPORT_BOUNDARY_DRIFT", "Computed imports are forbidden.");
        }
        const moduleName = node.moduleSpecifier.text;
        modules.add(moduleName);
        if (!ALLOWED_PRODUCTION_MODULES.includes(moduleName)) {
          fail(
            "RUNTIME_REACT_IMPORT_BOUNDARY_DRIFT",
            `Production source imports forbidden module ${moduleName}.`,
            { relativePath },
          );
        }
        if (moduleName === "@desen/runtime-core" && node.importClause?.isTypeOnly !== true) {
          fail(
            "RUNTIME_REACT_IMPORT_BOUNDARY_DRIFT",
            "runtime-core may cross the React package boundary only as public types.",
          );
        }
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && ["require", "eval"].includes(node.expression.text)))
      ) {
        fail(
          "RUNTIME_REACT_EXECUTABLE_LOADING_DRIFT",
          `Dynamic executable loading is forbidden in ${relativePath}.`,
        );
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Function"
      ) {
        fail(
          "RUNTIME_REACT_EXECUTABLE_LOADING_DRIFT",
          `Dynamic executable construction is forbidden in ${relativePath}.`,
        );
      }
      if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
        fail(
          "RUNTIME_REACT_PLATFORM_BOUNDARY_DRIFT",
          `Platform authority ${node.text} is forbidden in ${relativePath}.`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const actualModules = sorted(modules);
  if (!sameStrings(actualModules, ALLOWED_PRODUCTION_MODULES)) {
    fail("RUNTIME_REACT_IMPORT_BOUNDARY_DRIFT", "Production import inventory changed.", {
      expected: ALLOWED_PRODUCTION_MODULES,
      actual: actualModules,
    });
  }
  return Object.freeze({
    modules: actualModules,
    runtimeCoreImports: "type-only",
    browserOrDomImports: 0,
    dynamicExecutableLoading: 0,
  });
}

function inspectPackageContract(packageText, tsconfigText, buildTsconfigText) {
  let manifest;
  let tsconfig;
  let buildTsconfig;
  try {
    manifest = JSON.parse(packageText);
    tsconfig = JSON.parse(tsconfigText);
    buildTsconfig = JSON.parse(buildTsconfigText);
  } catch {
    fail("RUNTIME_REACT_PACKAGE_CONTRACT_DRIFT", "Package or TypeScript JSON is invalid.");
  }
  const expectedExports = {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  };
  const expectedDependencies = { "@desen/runtime-core": "workspace:*" };
  const expectedPeerDependencies = { react: ">=19.0.0 <20.0.0" };
  const valid =
    manifest.name === "@desen/runtime-react" &&
    manifest.private === true &&
    manifest.type === "module" &&
    manifest.sideEffects === false &&
    JSON.stringify(manifest.files) === JSON.stringify(["dist"]) &&
    JSON.stringify(manifest.exports) === JSON.stringify(expectedExports) &&
    JSON.stringify(manifest.dependencies) === JSON.stringify(expectedDependencies) &&
    JSON.stringify(manifest.peerDependencies) === JSON.stringify(expectedPeerDependencies) &&
    manifest.scripts?.build === "tsc -p tsconfig.build.json" &&
    manifest.scripts?.typecheck === "tsc -p tsconfig.json --noEmit" &&
    manifest.scripts?.["test:adapter-registry"] === "vitest run test/adapter-registry.test.tsx" &&
    tsconfig.extends === "../../tsconfig.react.json" &&
    JSON.stringify(tsconfig.compilerOptions?.types) === JSON.stringify([]) &&
    Array.isArray(tsconfig.include) &&
    tsconfig.include.includes("test/**/*.tsx") &&
    buildTsconfig.extends === "./tsconfig.json" &&
    buildTsconfig.compilerOptions?.declaration === true &&
    buildTsconfig.compilerOptions?.noEmit === false &&
    buildTsconfig.compilerOptions?.outDir === "dist" &&
    buildTsconfig.compilerOptions?.rootDir === "src" &&
    Array.isArray(buildTsconfig.exclude) &&
    buildTsconfig.exclude.includes("test/**/*");
  if (!valid) {
    fail(
      "RUNTIME_REACT_PACKAGE_CONTRACT_DRIFT",
      "runtime-react package, export, dependency, or compiler boundary changed.",
    );
  }
  return Object.freeze({
    package: manifest.name,
    exports: Object.freeze(["."]),
    productionDependencies: Object.freeze(["@desen/runtime-core"]),
    peerDependencies: Object.freeze(["react"]),
    compilerProfile: "../../tsconfig.react.json",
    browserProfile: false,
  });
}

function directCallName(call) {
  return ts.isIdentifier(call.expression) ? call.expression.text : undefined;
}

function isDirectPackageTest(call) {
  const expressionStatement = call.parent;
  const block = expressionStatement?.parent;
  const callback = block?.parent;
  const describeCall = callback?.parent;
  return (
    ts.isExpressionStatement(expressionStatement) &&
    ts.isBlock(block) &&
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
    ts.isCallExpression(describeCall) &&
    directCallName(describeCall) === "describe" &&
    describeCall.arguments.includes(callback) &&
    ts.isExpressionStatement(describeCall.parent) &&
    ts.isSourceFile(describeCall.parent.parent)
  );
}

function inspectDirectTests(relativePath, sourceText, callName, expectedCount) {
  const source = parseSource(relativePath, sourceText);
  let count = 0;
  let invalid = false;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === callName
      ) {
        invalid = true;
      }
      if (directCallName(node) === callName) {
        const direct =
          callName === "test"
            ? ts.isExpressionStatement(node.parent) && ts.isSourceFile(node.parent.parent)
            : isDirectPackageTest(node);
        if (!direct) invalid = true;
        else count += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (invalid || count !== expectedCount) {
    fail(
      "RUNTIME_REACT_TEST_INVENTORY_DRIFT",
      `Focused test inventory changed in ${relativePath}.`,
      {
        expected: expectedCount,
        actual: count,
        invalidRegistration: invalid,
      },
    );
  }
  return count;
}

function inspectTests(packageTests, compilerCases, rootTests) {
  const packageCount = inspectDirectTests(
    "packages/runtime-react/test/adapter-registry.test.tsx",
    packageTests,
    "it",
    EXPECTED_TEST_INVENTORY.packageTests,
  );
  const rootCount = inspectDirectTests(
    "tests/runtime-react-adapter-registry.test.mjs",
    rootTests,
    "test",
    EXPECTED_TEST_INVENTORY.rootMutationTests,
  );
  const compilerCount = (compilerCases.match(/@ts-expect-error/gu) ?? []).length;
  if (
    compilerCount !== EXPECTED_TEST_INVENTORY.compilerNegativeCases ||
    /@ts-ignore/gu.test(compilerCases)
  ) {
    fail(
      "RUNTIME_REACT_TEST_INVENTORY_DRIFT",
      "Compiler-negative adapter cases changed or use an unchecked ignore.",
      {
        expected: EXPECTED_TEST_INVENTORY.compilerNegativeCases,
        actual: compilerCount,
      },
    );
  }
  return Object.freeze({
    packageTests: packageCount,
    compilerNegativeCases: compilerCount,
    rootMutationTests: rootCount,
  });
}

function assertExactKeys(value, expected, label) {
  assert.ok(value !== null && typeof value === "object", `${label} must be an object`);
  assert.deepEqual(Object.getOwnPropertyNames(value).sort(), sorted(expected), `${label} keys`);
  assert.deepEqual(Object.getOwnPropertySymbols(value), [], `${label} symbols`);
}

function assertFailure(result, code, identity = {}) {
  assertExactKeys(result, ["failure", "status"], `${code} result`);
  assert.equal(result.status, "failed");
  assert.ok(!Object.hasOwn(result, "surface"));
  assert.ok(Object.isFrozen(result));
  assertExactKeys(
    result.failure,
    ["capabilityId", "code", "runtimeNodeId", "sourceNodeId"],
    `${code} failure`,
  );
  assert.equal(result.failure.code, code);
  assert.equal(result.failure.runtimeNodeId, identity.runtimeNodeId ?? null);
  assert.equal(result.failure.sourceNodeId, identity.sourceNodeId ?? null);
  assert.equal(result.failure.capabilityId, identity.capabilityId ?? null);
  assert.ok(Object.isFrozen(result.failure));
  assert.ok(!JSON.stringify(result).includes("function"));
  return result.failure;
}

function proofNode(identity, use, options = {}) {
  return Object.freeze({
    identity,
    sourceNodeId: options.sourceNodeId ?? identity,
    use,
    props: options.props ?? Object.freeze({}),
    style: options.style ?? Object.freeze({}),
    slots: options.slots ?? Object.freeze({}),
    behaviors: options.behaviors ?? Object.freeze([]),
  });
}

function proofPlan(root) {
  return Object.freeze({
    documentId: "run.desen.proof.document",
    surfaceId: "main",
    root: Object.freeze([...root]),
  });
}

function proofBehavior(identity, use) {
  return Object.freeze({
    identity,
    id: "emphasis",
    use,
    props: Object.freeze({}),
    style: Object.freeze({}),
    slots: Object.freeze({}),
  });
}

async function inspectRuntimeApi(runtimeApiOption) {
  const runtimeApi = runtimeApiOption ?? (await import(RUNTIME_API_URL.href));
  const actualExports = sorted(Object.keys(runtimeApi));
  if (!sameStrings(actualExports, EXPECTED_RUNTIME_EXPORTS)) {
    fail("RUNTIME_REACT_RUNTIME_EXPORT_DRIFT", "Built runtime-react exports changed.", {
      expected: EXPECTED_RUNTIME_EXPORTS,
      actual: actualExports,
    });
  }
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    const expectedType = name.startsWith("RUNTIME_") ? "object" : "function";
    if (typeof runtimeApi[name] !== expectedType) {
      fail("RUNTIME_REACT_RUNTIME_EXPORT_DRIFT", `Built export ${name} must be a ${expectedType}.`);
    }
  }

  const BOX = "run.desen.proof/Box";
  const TEXT = "run.desen.proof/Text";
  const EMPHASIS = "run.desen.proof/Emphasis";
  const MISSING = "run.desen.proof/Missing";
  const calls = [];
  const interactionStatuses = [];

  function inspectInteractions(interactions) {
    assertExactKeys(
      interactions,
      ["attachCommands", "detachCommands", "dispatchEvent"],
      "interaction port",
    );
    const dispatched = interactions.dispatchEvent("proof", null);
    const attached = interactions.attachCommands({
      invoke: () => Object.freeze({ status: "denied" }),
    });
    const detached = interactions.detachCommands(Object.freeze({}));
    assertExactKeys(dispatched, ["status"], "inert dispatch result");
    assertExactKeys(attached, ["status"], "inert attachment result");
    assertExactKeys(detached, ["status"], "inert detachment result");
    assert.equal(Object.hasOwn(attached, "detach"), false);
    interactionStatuses.push(dispatched.status, attached.status, detached.status);
  }

  function inspectComponentProps(props, expectedIdentity) {
    assertExactKeys(
      props,
      ["behaviors", "identity", "interactions", "props", "slots", "style"],
      "component adapter props",
    );
    assert.equal(props.identity.runtimeNodeId, expectedIdentity);
    assert.equal(Object.hasOwn(props, "element"), false);
    assert.equal(Object.hasOwn(props, "event"), false);
    inspectInteractions(props.interactions);
  }

  function Box(props) {
    inspectComponentProps(props, "layout");
    calls.push(`box:${props.identity.runtimeNodeId}`);
    return createElement(
      "section",
      { "data-runtime-node": props.identity.runtimeNodeId },
      props.slots.default,
      props.slots.status,
    );
  }

  function Text(props) {
    inspectComponentProps(props, props.identity.runtimeNodeId);
    if (props.identity.runtimeNodeId === "first") {
      assert.equal(props.props.status, "ready");
    }
    calls.push(`text:${props.identity.runtimeNodeId}`);
    return createElement(
      "p",
      { "data-source-node": props.identity.sourceNodeId },
      String(props.props.text ?? ""),
    );
  }

  function Emphasis(props) {
    assertExactKeys(
      props,
      ["behaviorId", "children", "identity", "interactions", "props", "slots", "style"],
      "behavior adapter props",
    );
    calls.push(`behavior:${props.behaviorId}`);
    inspectInteractions(props.interactions);
    return createElement("strong", { "data-behavior": props.behaviorId }, props.children);
  }

  try {
    assert.deepEqual(runtimeApi.RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS, EXPECTED_REGISTRY_LIMITS);
    assert.deepEqual(runtimeApi.RUNTIME_REACT_RENDER_LIMITS, EXPECTED_RENDER_LIMITS);
    assert.ok(Object.isFrozen(runtimeApi.RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS));
    assert.ok(Object.isFrozen(runtimeApi.RUNTIME_REACT_RENDER_LIMITS));

    const created = runtimeApi.createRuntimeReactAdapterRegistry({
      components: [
        { capabilityId: TEXT, component: Text },
        { capabilityId: BOX, component: Box },
      ],
      behaviors: [{ capabilityId: EMPHASIS, component: Emphasis }],
    });
    assert.equal(calls.length, 0, "registry construction invoked an adapter");
    assertExactKeys(created, ["handle", "snapshot", "status"], "created registry");
    assert.equal(created.status, "created");
    assert.ok(Object.isFrozen(created));
    assert.ok(Object.isFrozen(created.handle));
    assert.ok(Object.isFrozen(created.snapshot));
    assert.ok(Object.isFrozen(created.snapshot.componentCapabilityIds));
    assert.ok(Object.isFrozen(created.snapshot.behaviorCapabilityIds));
    assert.deepEqual(created.snapshot, {
      componentCapabilityIds: [BOX, TEXT],
      behaviorCapabilityIds: [EMPHASIS],
    });
    assertExactKeys(
      created.snapshot,
      ["behaviorCapabilityIds", "componentCapabilityIds"],
      "registry snapshot",
    );
    const snapshotJson = JSON.stringify(created.snapshot);
    assert.ok(!snapshotJson.includes("function"));
    assert.ok(!snapshotJson.includes('component":'));
    const read = runtimeApi.readRuntimeReactAdapterRegistry(created.handle);
    assert.equal(read.status, "read");
    assert.equal(read.snapshot, created.snapshot);

    const normalPlan = proofPlan([
      proofNode("layout", BOX, {
        slots: Object.freeze({
          default: Object.freeze([
            proofNode("first", TEXT, {
              props: Object.freeze({ status: "ready", text: "First" }),
              behaviors: Object.freeze([proofBehavior("first/emphasis", EMPHASIS)]),
            }),
            proofNode("second", TEXT, {
              props: Object.freeze({ text: "Second" }),
            }),
          ]),
          status: Object.freeze([
            proofNode("status", TEXT, {
              props: Object.freeze({ text: "Ready" }),
            }),
          ]),
        }),
      }),
    ]);
    const rendered = runtimeApi.renderRuntimeReactSurface({
      registry: created.handle,
      plan: normalPlan,
    });
    assert.equal(calls.length, 0, "render preflight invoked an adapter");
    assertExactKeys(rendered, ["status", "surface"], "rendered result");
    assert.equal(rendered.status, "rendered");
    assert.ok(Object.isFrozen(rendered));
    assert.ok(Object.isFrozen(rendered.surface));
    assert.equal(rendered.surface.documentId, "run.desen.proof.document");
    assert.equal(rendered.surface.surfaceId, "main");
    assert.equal(rendered.surface.nodeCount, 4);
    assert.equal(rendered.surface.behaviorCount, 1);
    const html = renderToStaticMarkup(rendered.surface.element);
    assert.equal(
      html,
      '<section data-runtime-node="layout"><strong data-behavior="emphasis"><p data-source-node="first">First</p></strong><p data-source-node="second">Second</p><p data-source-node="status">Ready</p></section>',
    );
    assert.deepEqual(calls, [
      "box:layout",
      "behavior:emphasis",
      "text:first",
      "text:second",
      "text:status",
    ]);
    assert.deepEqual(interactionStatuses, [
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
    ]);

    const detachedCalls = [];
    function DetachedSnapshot(props) {
      detachedCalls.push({
        propsFrozen: Object.isFrozen(props.props),
        styleFrozen: Object.isFrozen(props.style),
        text: props.props.text,
        tone: props.style.tone,
      });
      return createElement("span", null, `${String(props.props.text)}:${String(props.style.tone)}`);
    }
    const detachedCapability = "run.desen.proof/DetachedSnapshot";
    const detachedRegistry = runtimeApi.createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: detachedCapability, component: DetachedSnapshot }],
    });
    assert.equal(detachedRegistry.status, "created");
    const mutableProps = { text: "Before" };
    const mutableStyle = { tone: "quiet" };
    const mutableNode = {
      identity: "detached",
      sourceNodeId: "detached-source",
      use: detachedCapability,
      props: mutableProps,
      style: mutableStyle,
      slots: {},
      behaviors: [],
    };
    const detachedResult = runtimeApi.renderRuntimeReactSurface({
      registry: detachedRegistry.handle,
      plan: {
        documentId: "run.desen.proof.detached",
        surfaceId: "main",
        root: [mutableNode],
      },
    });
    assert.equal(detachedResult.status, "rendered");
    assert.deepEqual(detachedCalls, []);
    mutableProps.text = "After";
    mutableStyle.tone = "loud";
    mutableNode.identity = "mutated";
    mutableNode.sourceNodeId = "mutated-source";
    mutableNode.use = MISSING;
    assert.equal(renderToStaticMarkup(detachedResult.surface.element), "<span>Before:quiet</span>");
    assert.deepEqual(detachedCalls, [
      {
        propsFrozen: true,
        styleFrozen: true,
        text: "Before",
        tone: "quiet",
      },
    ]);

    const preflightCalls = [];
    function Counting(props) {
      preflightCalls.push(props.identity.runtimeNodeId);
      return null;
    }
    const preflightRegistry = runtimeApi.createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: BOX, component: Counting }],
    });
    assert.equal(preflightRegistry.status, "created");
    assert.deepEqual(preflightCalls, []);
    assertFailure(
      runtimeApi.renderRuntimeReactSurface({
        registry: preflightRegistry.handle,
        plan: proofPlan([
          proofNode("known", BOX, {
            slots: Object.freeze({
              default: Object.freeze([proofNode("deep-unknown", MISSING)]),
            }),
          }),
        ]),
      }),
      "UNKNOWN_COMPONENT_CAPABILITY",
      {
        runtimeNodeId: "deep-unknown",
        sourceNodeId: "deep-unknown",
        capabilityId: MISSING,
      },
    );
    assert.deepEqual(preflightCalls, []);

    const failureCalls = calls.length;
    const failures = [];
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([proofNode("unknown-root", MISSING)]),
        }),
        "UNKNOWN_COMPONENT_CAPABILITY",
        {
          runtimeNodeId: "unknown-root",
          sourceNodeId: "unknown-root",
          capabilityId: MISSING,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("json-depth", TEXT, {
              props: Object.freeze({ nested: Object.freeze({ value: null }) }),
            }),
          ]),
          limits: { maxJsonDepth: 0 },
        }),
        "JSON_DEPTH_LIMIT_EXCEEDED",
        {
          runtimeNodeId: "json-depth",
          sourceNodeId: "json-depth",
          capabilityId: TEXT,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("json-occurrences", TEXT, {
              props: Object.freeze({ value: null }),
            }),
          ]),
          limits: { maxJsonOccurrences: 1 },
        }),
        "JSON_OCCURRENCE_LIMIT_EXCEEDED",
        {
          runtimeNodeId: "json-occurrences",
          sourceNodeId: "json-occurrences",
          capabilityId: TEXT,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("string-limit", TEXT, {
              props: Object.freeze({ value: "x" }),
            }),
          ]),
          limits: {
            maxStringCodeUnits:
              "run.desen.proof.document".length +
              "main".length +
              "string-limit".length * 2 +
              TEXT.length +
              "value".length,
          },
        }),
        "STRING_LIMIT_EXCEEDED",
        {
          runtimeNodeId: "string-limit",
          sourceNodeId: "string-limit",
          capabilityId: TEXT,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("unknown-behavior", TEXT, {
              behaviors: Object.freeze([proofBehavior("unknown/behavior", MISSING)]),
            }),
          ]),
        }),
        "UNKNOWN_BEHAVIOR_CAPABILITY",
        {
          runtimeNodeId: "unknown/behavior",
          sourceNodeId: "unknown-behavior",
          capabilityId: MISSING,
        },
      ).code,
    );
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: revoked.proxy,
        }),
        "MALFORMED_RENDER_PLAN",
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([proofNode("same", TEXT), proofNode("same", TEXT)]),
        }),
        "DUPLICATE_RUNTIME_IDENTITY",
        { runtimeNodeId: "same", sourceNodeId: "same", capabilityId: TEXT },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([proofNode("one", TEXT), proofNode("two", TEXT)]),
          limits: { maxNodes: 1 },
        }),
        "NODE_LIMIT_EXCEEDED",
        { runtimeNodeId: "two", sourceNodeId: "two", capabilityId: TEXT },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("depth-root", BOX, {
              slots: Object.freeze({
                default: Object.freeze([proofNode("depth-child", TEXT)]),
              }),
            }),
          ]),
          limits: { maxDepth: 0 },
        }),
        "DEPTH_LIMIT_EXCEEDED",
        {
          runtimeNodeId: "depth-child",
          sourceNodeId: "depth-child",
          capabilityId: TEXT,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("slot-root", BOX, {
              slots: Object.freeze({
                a: Object.freeze([proofNode("slot-a", TEXT)]),
                b: Object.freeze([proofNode("slot-b", TEXT)]),
              }),
            }),
          ]),
          limits: { maxSlotEntries: 1 },
        }),
        "SLOT_LIMIT_EXCEEDED",
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([
            proofNode("behavior-one", TEXT, {
              behaviors: Object.freeze([proofBehavior("behavior-one/a", EMPHASIS)]),
            }),
            proofNode("behavior-two", TEXT, {
              behaviors: Object.freeze([proofBehavior("behavior-two/b", EMPHASIS)]),
            }),
          ]),
          limits: { maxBehaviors: 1 },
        }),
        "BEHAVIOR_LIMIT_EXCEEDED",
        {
          runtimeNodeId: "behavior-two/b",
          sourceNodeId: "behavior-two",
          capabilityId: EMPHASIS,
        },
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: Object.freeze({}),
          plan: proofPlan([]),
        }),
        "INVALID_REGISTRY",
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: proofPlan([]),
          limits: { maxNodes: EXPECTED_RENDER_LIMITS.maxNodes + 1 },
        }),
        "MALFORMED_RENDER_PLAN",
      ).code,
    );

    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [
          { capabilityId: BOX, component: Box },
          { capabilityId: BOX, component: Text },
        ],
      }),
      { status: "invalid", reason: "duplicate-capability" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: BOX, component: Box }],
        behaviors: [{ capabilityId: BOX, component: Emphasis }],
      }),
      { status: "invalid", reason: "duplicate-capability" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: "invalid", component: Box }],
      }),
      { status: "invalid", reason: "malformed-registration" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: "run.desen.proof/Box/Remote", component: Box }],
      }),
      { status: "invalid", reason: "malformed-registration" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [
          { capabilityId: BOX, component: Box },
          { capabilityId: TEXT, component: Text },
        ],
        limits: { maxComponentAdapters: 1 },
      }),
      { status: "invalid", reason: "registry-limit" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: BOX, component: Box }],
        limits: { maxIdentifierCodeUnits: 1 },
      }),
      { status: "invalid", reason: "identifier-limit" },
    );
    const adversarialIdentifier = `${"a.".repeat(25_000)}a/Box`;
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: adversarialIdentifier, component: Box }],
        limits: { maxIdentifierCodeUnits: 1 },
      }),
      { status: "invalid", reason: "identifier-limit" },
    );
    assert.deepEqual(
      runtimeApi.createRuntimeReactAdapterRegistry({
        components: [],
        limits: { maxComponentAdapters: EXPECTED_REGISTRY_LIMITS.maxComponentAdapters + 1 },
      }),
      { status: "invalid", reason: "invalid-limits" },
    );
    assert.deepEqual(runtimeApi.readRuntimeReactAdapterRegistry(Object.freeze({})), {
      status: "invalid-handle",
    });

    let getterCalls = 0;
    const accessorPlan = Object.defineProperty({}, "documentId", {
      get() {
        getterCalls += 1;
        return "forged";
      },
    });
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: accessorPlan,
        }),
        "MALFORMED_RENDER_PLAN",
      ).code,
    );
    failures.push(
      assertFailure(
        runtimeApi.renderRuntimeReactSurface({
          registry: created.handle,
          plan: new Proxy(
            {},
            {
              ownKeys() {
                throw new Error("hostile reflection");
              },
            },
          ),
        }),
        "MALFORMED_RENDER_PLAN",
      ).code,
    );
    assert.equal(getterCalls, 0);
    assert.equal(calls.length, failureCalls);

    return Object.freeze({
      runtimeExports: actualExports,
      registryLimits: EXPECTED_REGISTRY_LIMITS,
      renderLimits: EXPECTED_RENDER_LIMITS,
      snapshot: created.snapshot,
      snapshotJson,
      handleFactoryAuthenticated: true,
      adaptersInvokedDuringRegistration: 0,
      adaptersInvokedDuringPreflight: 0,
      renderedHtml: html,
      renderedNodeCount: rendered.surface.nodeCount,
      renderedBehaviorCount: rendered.surface.behaviorCount,
      adapterExecutionOrder: Object.freeze([...calls]),
      interactionStatuses: Object.freeze([...interactionStatuses]),
      detachedSnapshot: Object.freeze({
        html: "<span>Before:quiet</span>",
        propsFrozen: true,
        styleFrozen: true,
      }),
      statusNamedSlotRendered: true,
      oversizedIdentifierRejectedBeforeMatcher: true,
      failureCodesExercised: sorted(new Set(failures)),
      registryReasonsExercised: EXPECTED_REGISTRY_REASONS,
      getterCalls,
      placeholderElementsOnFailure: 0,
    });
  } catch (error) {
    if (error instanceof RuntimeReactAdapterRegistryEvidenceError) throw error;
    fail("RUNTIME_REACT_RUNTIME_PROBE_FAILED", "Built runtime-react behavior drifted.", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function inspectPrerequisite(options) {
  const bytes =
    options.prerequisiteArtifactBytes === undefined
      ? await readWorkspaceBytes(PREREQUISITE.path, options.fileOverrides)
      : Buffer.from(options.prerequisiteArtifactBytes);
  const actualSha = sha256(bytes);
  if (actualSha !== PREREQUISITE.sha256) {
    fail(
      "RUNTIME_REACT_PREREQUISITE_DRIFT",
      `Prerequisite ${PREREQUISITE.task} artifact bytes changed.`,
      { expected: PREREQUISITE.sha256, actual: actualSha },
    );
  }
  if (options.verifyPrerequisite !== false) {
    let artifact;
    try {
      artifact = JSON.parse(bytes.toString("utf8"));
    } catch {
      fail("RUNTIME_REACT_PREREQUISITE_DRIFT", "Prerequisite artifact is not valid JSON.");
    }
    if (
      artifact.task !== PREREQUISITE.task ||
      artifact.gate !== PREREQUISITE.gate ||
      artifact.result !== "PASS"
    ) {
      fail(
        "RUNTIME_REACT_PREREQUISITE_DRIFT",
        "Prerequisite artifact does not prove completed G04.",
      );
    }
  }
  return PREREQUISITE;
}

async function inspectTrackedFiles(fileOverrides) {
  const entries = [];
  for (const relativePath of TRACKED_PATHS) {
    const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
    entries.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
      }),
    );
  }
  return Object.freeze(entries);
}

async function formatArtifact(artifact) {
  return Buffer.from(
    await format(JSON.stringify(artifact), {
      parser: "json",
      printWidth: 100,
    }),
    "utf8",
  );
}

/**
 * Builds deterministic M05-T01 evidence from source, declarations, tests, and the compiled API.
 */
export async function buildRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  const fileOverrides = options.fileOverrides;
  const sourceEntries = await Promise.all(
    SOURCE_PATHS.map(async (relativePath) => [
      relativePath,
      await readWorkspaceText(relativePath, fileOverrides),
    ]),
  );
  const [
    prerequisite,
    sourceDeclarations,
    capabilityMatcher,
    productionBoundary,
    sourceRootExports,
    declarationRootExports,
    packageContract,
    tests,
    runtime,
    trackedFiles,
  ] = await Promise.all([
    inspectPrerequisite(options),
    Promise.resolve(inspectSourceDeclarations(sourceEntries)),
    Promise.resolve(
      inspectCapabilityMatcher(
        sourceEntries.find(([relativePath]) => relativePath.endsWith("/registry.ts"))[1],
      ),
    ),
    Promise.resolve(inspectProductionBoundary(sourceEntries)),
    readWorkspaceText("packages/runtime-react/src/index.ts", fileOverrides).then((source) =>
      inspectRootExports("packages/runtime-react/src/index.ts", source),
    ),
    readWorkspaceText("packages/runtime-react/dist/index.d.ts", fileOverrides).then((source) =>
      inspectRootExports("packages/runtime-react/dist/index.d.ts", source),
    ),
    Promise.all([
      readWorkspaceText("packages/runtime-react/package.json", fileOverrides),
      readWorkspaceText("packages/runtime-react/tsconfig.json", fileOverrides),
      readWorkspaceText("packages/runtime-react/tsconfig.build.json", fileOverrides),
    ]).then(([packageText, tsconfigText, buildTsconfigText]) =>
      inspectPackageContract(packageText, tsconfigText, buildTsconfigText),
    ),
    Promise.all([
      readWorkspaceText("packages/runtime-react/test/adapter-registry.test.tsx", fileOverrides),
      readWorkspaceText("packages/runtime-react/test/adapter-registry.types.ts", fileOverrides),
      readWorkspaceText("tests/runtime-react-adapter-registry.test.mjs", fileOverrides),
    ]).then(([packageTests, compilerCases, rootTests]) =>
      inspectTests(packageTests, compilerCases, rootTests),
    ),
    inspectRuntimeApi(options.runtimeApi),
    inspectTrackedFiles(fileOverrides),
  ]);

  if (
    !sameStrings(sourceRootExports.runtime, declarationRootExports.runtime) ||
    !sameStrings(sourceRootExports.types, declarationRootExports.types)
  ) {
    fail(
      "RUNTIME_REACT_DECLARATION_DRIFT",
      "Source and built root declarations expose different contracts.",
    );
  }

  const registrySource = parseSource(
    "packages/runtime-react/src/registry.ts",
    sourceEntries.find(([relativePath]) => relativePath.endsWith("/registry.ts"))[1],
  );
  const rendererSource = parseSource(
    "packages/runtime-react/src/render-plan.tsx",
    sourceEntries.find(([relativePath]) => relativePath.endsWith("/render-plan.tsx"))[1],
  );
  const registryReasons = readStringUnion(
    registrySource,
    "RuntimeReactAdapterRegistryInvalidReason",
  );
  const rendererFailureCodes = readStringUnion(rendererSource, "RuntimeReactRenderFailureCode");
  if (
    !sameStrings(registryReasons, EXPECTED_REGISTRY_REASONS) ||
    !sameStrings(rendererFailureCodes, EXPECTED_FAILURE_CODES)
  ) {
    fail(
      "RUNTIME_REACT_DECLARATION_DRIFT",
      "Controlled registry or renderer failure classifications changed.",
    );
  }
  if (!sameStrings(runtime.failureCodesExercised, EXPECTED_FAILURE_CODES)) {
    fail(
      "RUNTIME_REACT_RUNTIME_PROBE_FAILED",
      "The built probe did not exercise every public renderer failure code.",
      { actual: runtime.failureCodesExercised, expected: EXPECTED_FAILURE_CODES },
    );
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M05-T01",
    result: "PASS",
    profile: "desen-runtime-react-adapter-registry-v1",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "web-react",
      summary:
        "A finite factory-authenticated static registry performs exact component and behavior lookup, and the React renderer completes fail-closed plan preflight before any adapter executes.",
      bundleCanSelectModule: false,
      unknownCapabilityFallback: false,
      nativeOrDomAuthorityExposed: false,
    }),
    prerequisite,
    publicApi: Object.freeze({
      runtimeExports: sourceRootExports.runtime,
      typeExports: sourceRootExports.types,
      sourceDeclarations: sourceDeclarations.declarations.length,
      tsdocDeclarations: sourceDeclarations.tsdocDeclarations,
      internalRootLeaks: Object.freeze([]),
    }),
    registry: Object.freeze({
      limits: runtime.registryLimits,
      snapshot: runtime.snapshot,
      snapshotJson: runtime.snapshotJson,
      factoryAuthenticatedHandle: runtime.handleFactoryAuthenticated,
      executableCallbacksInSnapshot: 0,
      adaptersInvokedDuringRegistration: runtime.adaptersInvokedDuringRegistration,
      rejectionReasons: registryReasons,
      capabilityMatcher,
      oversizedIdentifierRejectedBeforeMatcher: runtime.oversizedIdentifierRejectedBeforeMatcher,
    }),
    renderer: Object.freeze({
      limits: runtime.renderLimits,
      completePreflightBeforeAdapterExecution: true,
      adaptersInvokedDuringPreflight: runtime.adaptersInvokedDuringPreflight,
      ordinaryRootUsesRegistryLookup: true,
      renderedHtml: runtime.renderedHtml,
      renderedNodeCount: runtime.renderedNodeCount,
      renderedBehaviorCount: runtime.renderedBehaviorCount,
      adapterExecutionOrder: runtime.adapterExecutionOrder,
      inertInteractionStatuses: runtime.interactionStatuses,
      detachedJsonSnapshot: runtime.detachedSnapshot,
      statusNamedSlotRendered: runtime.statusNamedSlotRendered,
      failureCodes: rendererFailureCodes,
      failureCodesExercised: runtime.failureCodesExercised,
      placeholderElementsOnFailure: runtime.placeholderElementsOnFailure,
      hostileAccessorInvocations: runtime.getterCalls,
    }),
    boundary: Object.freeze({
      ...packageContract,
      ...productionBoundary,
      adapterContract:
        "public semantic JSON, stable diagnostic identity, named React slots, inert interactions",
      opaqueCommandAttachment: true,
      rawDetachCallbackExposed: false,
      forbiddenAuthorities:
        "DOM nodes, selectors, native events, component instances, remote modules, executable loaders",
    }),
    evidence: Object.freeze({
      packageTests: tests.packageTests,
      compilerNegativeCases: tests.compilerNegativeCases,
      rootMutationTests: tests.rootMutationTests,
      trackedFiles,
    }),
    nonclaims: Object.freeze([
      "No resolved receiving-schema validation claim; M05-T02 owns prop validation.",
      "No capability-driven visual-state and style-part claim; M05-T03 owns it.",
      "No live event, command, or behavior lifecycle claim; M05-T04 owns it.",
      "No DOM reconciliation or production error-boundary claim.",
      "No Android, iOS, or non-React renderer claim.",
    ]),
  });
  const artifactBytes = await formatArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function verifyProofPin(proofText, artifactSha256) {
  const lines = proofText.split(/\r?\n/u);
  const heading = "## Evidence artifact";
  const pathLine = `\`${ARTIFACT_RELATIVE_PATH}\``;
  const shaLine = `\`sha256:${artifactSha256}\``;
  const headingIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  const pathOccurrences = lines.filter((line) => line.includes(ARTIFACT_RELATIVE_PATH));
  const shaOccurrences = lines.filter((line) => line.includes(`sha256:${artifactSha256}`));
  if (headingIndexes.length !== 1 || pathOccurrences.length !== 1 || shaOccurrences.length !== 1) {
    fail(
      "RUNTIME_REACT_PROOF_PIN_DRIFT",
      "Proof artifact path and SHA must occur exactly once under the exact evidence heading.",
    );
  }
  const headingIndex = headingIndexes[0];
  if (
    lines[headingIndex + 1] !== "" ||
    lines[headingIndex + 2] !== pathLine ||
    lines[headingIndex + 3] !== shaLine
  ) {
    fail(
      "RUNTIME_REACT_PROOF_PIN_DRIFT",
      "Proof artifact path and SHA moved, changed, or became indented.",
    );
  }
  const semanticShaLines = lines.filter((line) =>
    line.trimStart().replaceAll("`", "").startsWith("sha256:"),
  );
  if (semanticShaLines.length !== 1 || /PENDING/iu.test(proofText)) {
    fail(
      "RUNTIME_REACT_PROOF_PIN_DRIFT",
      "Proof contains a duplicate, pending, or ambiguous SHA pin.",
    );
  }
}

function verifyProofMatrixPin(matrixText, artifactSha256) {
  const lines = matrixText.split(/\r?\n/u);
  const heading = "## M05-T01";
  const artifactName = "runtime-react-0.1.0-adapter-registry.json";
  const pathLine = `\`${artifactName}\``;
  const shaLine = `\`sha256:${artifactSha256}\`.`;
  const headingIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headingIndexes.length !== 1) {
    fail(
      "RUNTIME_REACT_PROOF_MATRIX_PIN_DRIFT",
      "Proof Matrix must contain one exact M05-T01 section.",
    );
  }
  const headingIndex = headingIndexes[0];
  const nextHeadingOffset = lines
    .slice(headingIndex + 1)
    .findIndex((line) => line.startsWith("## "));
  const sectionEnd = nextHeadingOffset === -1 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  const sectionLines = lines.slice(headingIndex, sectionEnd);
  const pathIndex = sectionLines.indexOf(pathLine);
  const globalPathOccurrences = lines.filter((line) => line.includes(artifactName));
  const globalShaOccurrences = lines.filter((line) => line.includes(`sha256:${artifactSha256}`));
  const semanticShaLines = sectionLines.filter((line) =>
    line.trimStart().replaceAll("`", "").startsWith("sha256:"),
  );
  if (
    pathIndex === -1 ||
    sectionLines[pathIndex + 1] !== shaLine ||
    globalPathOccurrences.length !== 1 ||
    globalShaOccurrences.length !== 1 ||
    semanticShaLines.length !== 1 ||
    /PENDING/iu.test(sectionLines.join("\n"))
  ) {
    fail(
      "RUNTIME_REACT_PROOF_MATRIX_PIN_DRIFT",
      "M05-T01 Proof Matrix path and SHA moved, changed, became ambiguous, or became pending.",
    );
  }
}

/**
 * Rebuilds the proof, rejects byte drift, and validates both unique exact documentation pins.
 */
export async function verifyRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  const built = await buildRuntimeReactAdapterRegistryEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readFile(options.artifactPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH)
      : Buffer.from(options.artifactBytes);
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail(
      "RUNTIME_REACT_ARTIFACT_DRIFT",
      "Tracked M05-T01 artifact differs from the deterministic rebuild.",
      {
        expected: built.artifactSha256,
        actual: sha256(artifactBytes),
      },
    );
  }
  const proofText =
    options.proofDocumentText ??
    (await readFile(
      options.proofPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_PATH,
      "utf8",
    ));
  verifyProofPin(proofText, built.artifactSha256);
  const proofMatrixText =
    options.proofMatrixText ??
    (await readFile(
      options.proofMatrixPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_MATRIX_PATH,
      "utf8",
    ));
  verifyProofMatrixPin(proofMatrixText, built.artifactSha256);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    sourceDeclarations: built.artifact.publicApi.sourceDeclarations,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    packageTests: built.artifact.evidence.packageTests,
    compilerNegativeCases: built.artifact.evidence.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.rootMutationTests,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    failureCodes: built.artifact.renderer.failureCodes.length,
  });
}

/**
 * Atomically writes exact deterministic M05-T01 artifact bytes.
 */
export async function writeRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  const built = await buildRuntimeReactAdapterRegistryEvidence(options.buildOptions);
  const artifactPath = options.artifactPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH;
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  return Object.freeze({
    artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
    artifactSha256: built.artifactSha256,
    result: built.artifact.result,
  });
}
