import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH } from "./runtime-core-value-resolution-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M04-T06 local-state and node-identity artifact. */
export const DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "createRuntimeNodeIdentity",
  "disposeRuntimeSurfaceState",
  "mountRuntimeSurfaceState",
  "readRuntimeSurfaceState",
  "reconcileRuntimeNodeIdentity",
  "writeRuntimeSurfaceState",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeNodeIdentity",
  "RuntimeNodeIdentityCreationResult",
  "RuntimeNodeIdentityDescriptor",
  "RuntimeNodeIdentityInvalid",
  "RuntimeNodeIdentityInvalidReason",
  "RuntimeNodeIdentityReconciliation",
  "RuntimeSurfaceStateDisposeResult",
  "RuntimeSurfaceStateEntrySpec",
  "RuntimeSurfaceStateHandle",
  "RuntimeSurfaceStateIssue",
  "RuntimeSurfaceStateMountInput",
  "RuntimeSurfaceStateMountInvalid",
  "RuntimeSurfaceStateMountInvalidReason",
  "RuntimeSurfaceStateMountResult",
  "RuntimeSurfaceStateReadResult",
  "RuntimeSurfaceStateSnapshot",
  "RuntimeSurfaceStateWriteInput",
  "RuntimeSurfaceStateWriteRejected",
  "RuntimeSurfaceStateWriteRejectedReason",
  "RuntimeSurfaceStateWriteResult",
]);
const EXPECTED_LOCAL_STATE_RUNTIME_EXPORTS = Object.freeze([
  "disposeRuntimeSurfaceState",
  "mountRuntimeSurfaceState",
  "readRuntimeSurfaceState",
  "writeRuntimeSurfaceState",
]);
const EXPECTED_LOCAL_STATE_TYPE_EXPORTS = Object.freeze(
  EXPECTED_TYPE_EXPORTS.filter((name) => name.startsWith("RuntimeSurfaceState")),
);
const EXPECTED_IDENTITY_RUNTIME_EXPORTS = Object.freeze([
  "createRuntimeNodeIdentity",
  "reconcileRuntimeNodeIdentity",
]);
const EXPECTED_IDENTITY_TYPE_EXPORTS = Object.freeze(
  EXPECTED_TYPE_EXPORTS.filter((name) => name.startsWith("RuntimeNodeIdentity")),
);
const EXPECTED_INTERNAL_SNAPSHOT_EXPORTS = Object.freeze([
  "isRuntimeJsonObject",
  "snapshotRuntimeJsonValue",
]);
const EXPECTED_VALIDATOR_FACADE_RUNTIME_EXPORTS = Object.freeze(["validateDraft202012"]);
const EXPECTED_VALIDATOR_FACADE_TYPE_EXPORTS = Object.freeze([
  "Draft202012SyntaxError",
  "Draft202012SyntaxValidator",
]);
const EXPECTED_SOURCE_MODULES = Object.freeze({
  "local-state.ts": Object.freeze([
    "./host-ports.js",
    "./runtime-json-snapshot.js",
    "@desen/protocol",
    "@desen/validator/schema-contract",
    "@desen/validator/schema-contract-syntax",
  ]),
  "node-identity.ts": Object.freeze(["./runtime-json-snapshot.js", "@desen/protocol"]),
  "runtime-json-snapshot.ts": Object.freeze(["./host-ports.js", "./value-resolution.js"]),
});
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-018",
    section: "24.2",
    owners: Object.freeze(["M04-T06"]),
    status: "LOCAL_STATE_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-054",
    section: "16.1",
    owners: Object.freeze(["M02-T10", "M04-T06"]),
    status: "RUNTIME_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-104",
    section: "24.4",
    owners: Object.freeze(["M04-T06", "M04-T07", "M05-T05"]),
    status: "BASE_IDENTITY_PRIMITIVE_REPEAT_AND_ADAPTER_COMPOSITION_DEFERRED",
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-019",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T06"]),
    status: "RUNTIME_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-036 — Runtime local-state lifecycle and base node identity require a deterministic profile",
  "the substring before the first",
  "no longest-prefix",
  "`complete`",
  "`resolved-value`",
  "A canonically identical candidate is",
  "secure erasure",
  "Repeat-key discrimination remains exclusively",
  "explicit `$vocabulary` declaration fails closed",
  "`format-assertion`",
]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M04-T06",
  "mountRuntimeSurfaceState",
  "writeRuntimeSurfaceState",
  "disposeRuntimeSurfaceState",
  "createRuntimeNodeIdentity",
  "reconcileRuntimeNodeIdentity",
  "STATE_WRITE_INVALID",
  "complete",
  "resolved-value",
  "PF-019",
  "repeat keys",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-local-state-identity":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:local-state-identity && node scripts/generate-runtime-core-local-state-identity-proof.mjs",
  "verify:runtime-core-local-state-identity":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:local-state-identity && node scripts/verify-runtime-core-local-state-identity.mjs",
  "test:runtime-core-local-state-identity":
    "pnpm verify:runtime-core-value-resolution && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:local-state-identity && node --test tests/runtime-core-local-state-identity.test.mjs",
});
const EXPECTED_PACKAGE_TEST_SCRIPT = "vitest run test/local-state-identity.test.ts";
const EXPECTED_VALIDATOR_FILES = Object.freeze([
  "THIRD_PARTY_NOTICES.md",
  "dist",
  "schema-contract-syntax.d.ts",
  "schema-contract-syntax.js",
]);
const EXPECTED_VALIDATOR_ROOT_EXPORT = Object.freeze({
  types: "./dist/index.d.ts",
  import: "./dist/index.js",
});
const EXPECTED_VALIDATOR_EXPORT = Object.freeze({
  types: "./dist/schema-instance-validation.d.ts",
  import: "./dist/schema-instance-validation.js",
});
const EXPECTED_VALIDATOR_SYNTAX_EXPORT = Object.freeze({
  types: "./schema-contract-syntax.d.ts",
  import: "./schema-contract-syntax.js",
});
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/package.json",
  "packages/runtime-core/src/local-state.ts",
  "packages/runtime-core/src/node-identity.ts",
  "packages/runtime-core/src/runtime-json-snapshot.ts",
  "packages/runtime-core/test/local-state-identity.test.ts",
  "packages/runtime-core/test/local-state-identity.types.ts",
  "packages/runtime-core/dist/local-state.js",
  "packages/runtime-core/dist/local-state.js.map",
  "packages/runtime-core/dist/local-state.d.ts",
  "packages/runtime-core/dist/local-state.d.ts.map",
  "packages/runtime-core/dist/node-identity.js",
  "packages/runtime-core/dist/node-identity.js.map",
  "packages/runtime-core/dist/node-identity.d.ts",
  "packages/runtime-core/dist/node-identity.d.ts.map",
  "packages/runtime-core/dist/runtime-json-snapshot.js",
  "packages/runtime-core/dist/runtime-json-snapshot.js.map",
  "packages/runtime-core/dist/runtime-json-snapshot.d.ts",
  "packages/runtime-core/dist/runtime-json-snapshot.d.ts.map",
  "packages/validator/package.json",
  "packages/validator/schema-contract-syntax.d.ts",
  "packages/validator/schema-contract-syntax.js",
  "scripts/lib/runtime-core-local-state-identity-proof.mjs",
  "scripts/generate-runtime-core-local-state-identity-proof.mjs",
  "scripts/verify-runtime-core-local-state-identity.mjs",
  "tests/runtime-core-local-state-identity.test.mjs",
]);
const REQUIRED_PACKAGE_TEST_TITLES = Object.freeze([
  "mounts all initials atomically as detached, frozen generation-zero values",
  "feeds its values directly into the existing seven-namespace resolver",
  "creates independent fresh lifetimes and never restores a prior generation",
  "rejects one bad declaration without exposing a partial handle or snapshot",
  "rejects invalid Draft 2020-12 schema syntax: non-string type",
  "rejects invalid Draft 2020-12 schema syntax: non-object properties",
  "rejects invalid Draft 2020-12 schema syntax: non-array required",
  "rejects invalid Draft 2020-12 schema syntax: negative minimum length",
  "rejects invalid Draft 2020-12 schema syntax: different dialect",
  "rejects every schema vocabulary declaration instead of silently weakening assertions",
  "contains hostile mount data without invoking accessors",
  "rejects the frozen-pattern backtracking adversary through a linear capability parser",
  "supports complete replacements, nested writes, and schema-approved final property creation",
  "treats ValueSpec-looking objects and prototype-sensitive names as inert resolved JSON",
  "checks the complete post-write entry and leaves the current snapshot byte-identical on failure",
  "uses the first dot segment without longest-prefix matching",
  "rejects missing intermediate without partial state",
  "rejects array traversal without partial state",
  "rejects unknown root without partial state",
  "rejects empty segment without partial state",
  "rejects trailing segment without partial state",
  "rejects unsafe write requests without invoking accessors or retaining candidates",
  "returns unchanged for canonically identical data and does not advance generation",
  "is terminal and idempotent while a fresh remount restarts from exact initials",
  "rejects forged handles without affecting a real lifetime",
  "uses a structured document/surface/node tuple and excludes revision and capability",
  "preserves the exact identity when the tuple and capability stay compatible",
  "requires a new mount generation when use changes under the same stable identity",
  "requires replacement when the document identity field changes",
  "requires replacement when the surface identity field changes",
  "requires replacement when the node identity field changes",
  "uses exact string identity and rejects forged or expanded descriptors",
  "copies descriptors without invoking hostile accessors",
]);
const EXPECTED_COMPILER_NEGATIVE_LABELS = Object.freeze([
  "snapshots are recursively readonly",
  "state values are JSON, never executable callbacks",
  "opaque handles cannot be constructed by shape",
  "opaque node identities cannot be constructed by shape",
  "node identities are immutable",
  "revision is deliberately absent from base node identity",
  "repeat-key discrimination belongs to M04-T07",
]);
const REQUIRED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T06 local-state and identity evidence",
  "two independent local-state and identity evidence builds are byte-identical",
  "rejects stale or one-byte-tampered local-state and identity evidence",
  "rejects mount, read, write, dispose, no-op, PF-019, and atomicity semantic drift",
  "rejects stable headless node-identity semantic drift",
  "rejects complete resolved-value validation and source invariant drift",
  "rejects public export, TSDoc, platform, and distribution drift",
  "rejects validator subpath and runtime dependency seam drift",
  "rejects package, root wiring, skipped tests, and conditional registration drift",
  "rejects trace, PF-036, N-024, and proof-document drift",
  "rejects stale injected M04-T02 prerequisite bytes",
  "atomic local-state writer rejects symlink destinations",
  "atomic local-state writer detects temporary-byte tampering before rename",
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

/** Stable error class used by deterministic M04-T06 evidence and mutation tests. */
export class RuntimeCoreLocalStateIdentityEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreLocalStateIdentityEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreLocalStateIdentityEvidenceError(code, message, details);
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
    fail("LOCAL_STATE_IDENTITY_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T06 contract.`, { expected, actual });
  }
}

function plainData(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDataEqual(actual, expected, label) {
  const normalized = plainData(actual);
  if (!isDeepStrictEqual(normalized, expected)) {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", `${label} changed.`, {
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
      fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", `${label} is not recursively frozen.`);
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
      fail(code, `${label} permits only direct identifier-named exports.`);
    }
  }
}

function importModules(sourceFile, fileName) {
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
        "LOCAL_STATE_IDENTITY_IMPORT_BOUNDARY_DRIFT",
        `${fileName} permits only explicit non-aliased named imports.`,
      );
    }
    modules.push(statement.moduleSpecifier.text);
  }
  const observed = [...new Set(modules)].sort();
  assertArrayEqual(
    observed,
    EXPECTED_SOURCE_MODULES[fileName],
    "LOCAL_STATE_IDENTITY_IMPORT_BOUNDARY_DRIFT",
    `${fileName} dependency modules`,
  );
  return Object.freeze(observed);
}

function verifyPlatformBoundary(sourceFile, code = "LOCAL_STATE_IDENTITY_PLATFORM_BOUNDARY_DRIFT") {
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
  visit(sourceFile);
  if (found.size > 0) {
    fail(code, "M04-T06 crossed its framework-neutral deterministic boundary.", {
      found: [...found].sort(),
    });
  }
}

function indexExports(sourceText, fileName, moduleName) {
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
      statement.moduleSpecifier.text !== moduleName
    ) {
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.exportClause.elements.some((element) => element.propertyName !== undefined)
    ) {
      fail(
        "LOCAL_STATE_IDENTITY_INDEX_EXPORT_DRIFT",
        `${fileName} must use explicit non-aliased exports from ${moduleName}.`,
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

function verifyIndexModule(sourceText, fileName, moduleName, runtimeExports, typeExports) {
  const inventory = indexExports(sourceText, fileName, moduleName);
  assertArrayEqual(
    inventory.runtimeExports,
    runtimeExports,
    "LOCAL_STATE_IDENTITY_INDEX_EXPORT_DRIFT",
    `${fileName} ${moduleName} runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    typeExports,
    "LOCAL_STATE_IDENTITY_INDEX_EXPORT_DRIFT",
    `${fileName} ${moduleName} type exports`,
  );
  verifyPlatformBoundary(inventory.sourceFile, "LOCAL_STATE_IDENTITY_INDEX_EXPORT_DRIFT");
}

function normalizeSource(sourceText) {
  return sourceText.replaceAll(/\s+/gu, " ");
}

function verifySourceInvariants(localStateText, identityText, snapshotText) {
  const local = normalizeSource(localStateText);
  const identity = normalizeSource(identityText);
  const snapshot = normalizeSource(snapshotText);
  const requiredLocal = [
    'import { validateDraft202012 } from "@desen/validator/schema-contract-syntax";',
    "const SCHEMA_SYNTAX_VALIDATOR: Draft202012SyntaxValidator = validateDraft202012;",
    "valid = SCHEMA_SYNTAX_VALIDATOR(schema);",
    'Object.hasOwn(current.schema, "$vocabulary")',
    "const syntaxFailures = syntaxIssues(schema);",
    "const schemaFailures = validateSchemaContractGraph(schema);",
    'applySchemaContract(schema, entry.initial, "complete", "resolved-value")',
    'applySchemaContract( authority.schemas[entryName], candidateEntry, "complete", "resolved-value", )',
    'const segments = path.split(".");',
    "const entryName = segments[0] as string;",
    "canonicalizeJson(nextEntry) === canonicalizeJson(currentEntry)",
    "authority.snapshot = snapshot;",
    'STATE_AUTHORITIES.set(handle, { status: "disposed", surfaceId });',
    'code: "STATE_WRITE_INVALID"',
  ];
  const requiredIdentity = [
    "function isCapabilityId(value: string): boolean",
    "for (let index = 1; index < namespace.length; index += 1)",
    "canonicalizeJson([descriptor.documentId, descriptor.surfaceId, descriptor.nodeId])",
    "previousIdentity.use === descriptor.use",
    'status: "preserve-eligible"',
    'status: "remount-required"',
    'status: "replace-required"',
  ];
  const requiredSnapshot = [
    "createRuntimeResolutionSnapshot({",
    "state: { captured: input as RuntimeJsonValue }",
  ];
  for (const text of requiredLocal) {
    if (!local.includes(text)) {
      fail(
        "LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT",
        `Local-state implementation is missing reviewed invariant: ${text}`,
      );
    }
  }
  for (const text of requiredIdentity) {
    if (!identity.includes(text)) {
      fail(
        "LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT",
        `Node-identity implementation is missing reviewed invariant: ${text}`,
      );
    }
  }
  for (const text of requiredSnapshot) {
    if (!snapshot.includes(text)) {
      fail(
        "LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT",
        `Bounded snapshot seam is missing reviewed invariant: ${text}`,
      );
    }
  }
  if (
    /(?:Date\.now|Math\.random|crypto\.randomUUID)\s*\(/u.test(
      `${localStateText}\n${identityText}\n${snapshotText}`,
    ) ||
    /\.sort\s*\(\s*\(\s*\)\s*=>\s*Math\.random/u.test(localStateText) ||
    identityText.includes("CAPABILITY_ID_PATTERN")
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT",
      "State or identity cannot depend on time, randomness, or the hostile frozen capability regex.",
    );
  }
  const syntax = local.indexOf("const syntaxFailures = syntaxIssues(schema);");
  const graph = local.indexOf("const schemaFailures = validateSchemaContractGraph(schema);");
  const initial = local.indexOf(
    'applySchemaContract(schema, entry.initial, "complete", "resolved-value")',
  );
  if (syntax < 0 || graph <= syntax || initial <= graph) {
    fail(
      "LOCAL_STATE_IDENTITY_SOURCE_SEMANTIC_DRIFT",
      "Schema syntax, graph, and complete initial validation must remain in fail-closed order.",
    );
  }
}

function verifyOneModule({
  sourceText,
  declarationText,
  builtJavaScript,
  fileName,
  runtimeExports,
  typeExports,
  publicModule,
}) {
  const source = exportedDeclarations(sourceText, fileName);
  verifyDirectExports(source, "LOCAL_STATE_IDENTITY_SOURCE_EXPORT_DRIFT", `${fileName} source`);
  assertArrayEqual(
    source.runtimeExports,
    runtimeExports,
    "LOCAL_STATE_IDENTITY_SOURCE_EXPORT_DRIFT",
    `${fileName} runtime exports`,
  );
  assertArrayEqual(
    source.typeExports,
    typeExports,
    "LOCAL_STATE_IDENTITY_SOURCE_EXPORT_DRIFT",
    `${fileName} type exports`,
  );
  if (source.missingTsdoc.length > 0) {
    fail("LOCAL_STATE_IDENTITY_TSDOC_MISSING", "Every exported declaration requires TSDoc.", {
      fileName,
      missing: source.missingTsdoc,
    });
  }
  const modules = importModules(source.sourceFile, fileName);
  verifyPlatformBoundary(source.sourceFile);

  const declaration = exportedDeclarations(
    declarationText,
    `dist/${fileName.replace(".ts", ".d.ts")}`,
  );
  verifyDirectExports(
    declaration,
    "LOCAL_STATE_IDENTITY_DECLARATION_DRIFT",
    `${fileName} declaration`,
  );
  assertArrayEqual(
    declaration.runtimeExports,
    runtimeExports,
    "LOCAL_STATE_IDENTITY_DECLARATION_DRIFT",
    `${fileName} built runtime declarations`,
  );
  assertArrayEqual(
    declaration.typeExports,
    typeExports,
    "LOCAL_STATE_IDENTITY_DECLARATION_DRIFT",
    `${fileName} built type declarations`,
  );
  if (declaration.missingTsdoc.length > 0) {
    fail("LOCAL_STATE_IDENTITY_DECLARATION_DRIFT", `${fileName} built declarations lost TSDoc.`, {
      missing: declaration.missingTsdoc,
    });
  }
  verifyPlatformBoundary(declaration.sourceFile, "LOCAL_STATE_IDENTITY_DECLARATION_DRIFT");

  const built = exportedDeclarations(builtJavaScript, `dist/${fileName.replace(".ts", ".js")}`);
  verifyDirectExports(built, "LOCAL_STATE_IDENTITY_DISTRIBUTION_DRIFT", `${fileName} distribution`);
  assertArrayEqual(
    built.runtimeExports,
    runtimeExports,
    "LOCAL_STATE_IDENTITY_DISTRIBUTION_DRIFT",
    `${fileName} built JavaScript exports`,
  );
  assertArrayEqual(
    built.typeExports,
    [],
    "LOCAL_STATE_IDENTITY_DISTRIBUTION_DRIFT",
    `${fileName} built JavaScript type exports`,
  );
  verifyPlatformBoundary(built.sourceFile, "LOCAL_STATE_IDENTITY_DISTRIBUTION_DRIFT");

  return Object.freeze({
    fileName,
    publicModule,
    runtimeExports: Object.freeze(runtimeExports),
    typeExports: Object.freeze(typeExports),
    sourceImports: modules,
    tsdocDeclarations: source.runtimeExports.length + source.typeExports.length,
  });
}

function verifyValidatorFacade(wrapperJavaScript, wrapperDeclaration) {
  const sourceFile = ts.createSourceFile(
    "schema-contract-syntax.js",
    wrapperJavaScript,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  const statement = sourceFile.statements[0];
  if (
    sourceFile.statements.length !== 1 ||
    !ts.isExportDeclaration(statement) ||
    statement.isTypeOnly ||
    statement.moduleSpecifier === undefined ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    statement.moduleSpecifier.text !== "./dist/generated/0.1.0/structural-validators.js" ||
    statement.exportClause === undefined ||
    !ts.isNamedExports(statement.exportClause) ||
    statement.exportClause.elements.length !== 1 ||
    statement.exportClause.elements[0]?.isTypeOnly ||
    statement.exportClause.elements[0]?.propertyName !== undefined ||
    statement.exportClause.elements[0]?.name.text !== "validateDraft202012"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
      "The validator syntax wrapper must re-export only validateDraft202012 from the generated module.",
    );
  }
  verifyPlatformBoundary(sourceFile, "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT");

  const declaration = exportedDeclarations(wrapperDeclaration, "schema-contract-syntax.d.ts");
  verifyDirectExports(
    declaration,
    "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
    "Validator syntax wrapper declaration",
  );
  assertArrayEqual(
    declaration.runtimeExports,
    EXPECTED_VALIDATOR_FACADE_RUNTIME_EXPORTS,
    "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
    "Validator syntax wrapper runtime exports",
  );
  assertArrayEqual(
    declaration.typeExports,
    EXPECTED_VALIDATOR_FACADE_TYPE_EXPORTS,
    "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
    "Validator syntax wrapper type exports",
  );
  if (declaration.missingTsdoc.length > 0) {
    fail(
      "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
      "Every validator syntax wrapper declaration requires TSDoc.",
      { missing: declaration.missingTsdoc },
    );
  }
  verifyPlatformBoundary(declaration.sourceFile, "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT");
  return Object.freeze({
    runtimeExports: EXPECTED_VALIDATOR_FACADE_RUNTIME_EXPORTS,
    typeExports: EXPECTED_VALIDATOR_FACADE_TYPE_EXPORTS,
    tsdocDeclarations:
      EXPECTED_VALIDATOR_FACADE_RUNTIME_EXPORTS.length +
      EXPECTED_VALIDATOR_FACADE_TYPE_EXPORTS.length,
    implementation: "./dist/generated/0.1.0/structural-validators.js#validateDraft202012",
  });
}

function verifySourceAndDistribution({
  localStateText,
  identityText,
  snapshotText,
  sourceIndexText,
  localStateDeclarationText,
  identityDeclarationText,
  snapshotDeclarationText,
  localStateBuiltJavaScript,
  identityBuiltJavaScript,
  snapshotBuiltJavaScript,
  builtIndexDeclarationText,
  builtIndexJavaScript,
}) {
  const modules = [
    verifyOneModule({
      sourceText: localStateText,
      declarationText: localStateDeclarationText,
      builtJavaScript: localStateBuiltJavaScript,
      fileName: "local-state.ts",
      runtimeExports: EXPECTED_LOCAL_STATE_RUNTIME_EXPORTS,
      typeExports: EXPECTED_LOCAL_STATE_TYPE_EXPORTS,
      publicModule: true,
    }),
    verifyOneModule({
      sourceText: identityText,
      declarationText: identityDeclarationText,
      builtJavaScript: identityBuiltJavaScript,
      fileName: "node-identity.ts",
      runtimeExports: EXPECTED_IDENTITY_RUNTIME_EXPORTS,
      typeExports: EXPECTED_IDENTITY_TYPE_EXPORTS,
      publicModule: true,
    }),
    verifyOneModule({
      sourceText: snapshotText,
      declarationText: snapshotDeclarationText,
      builtJavaScript: snapshotBuiltJavaScript,
      fileName: "runtime-json-snapshot.ts",
      runtimeExports: EXPECTED_INTERNAL_SNAPSHOT_EXPORTS,
      typeExports: [],
      publicModule: false,
    }),
  ];
  verifySourceInvariants(localStateText, identityText, snapshotText);

  verifyIndexModule(
    sourceIndexText,
    "src/index.ts",
    "./local-state.js",
    EXPECTED_LOCAL_STATE_RUNTIME_EXPORTS,
    EXPECTED_LOCAL_STATE_TYPE_EXPORTS,
  );
  verifyIndexModule(
    sourceIndexText,
    "src/index.ts",
    "./node-identity.js",
    EXPECTED_IDENTITY_RUNTIME_EXPORTS,
    EXPECTED_IDENTITY_TYPE_EXPORTS,
  );
  verifyIndexModule(sourceIndexText, "src/index.ts", "./runtime-json-snapshot.js", [], []);
  verifyIndexModule(
    builtIndexDeclarationText,
    "dist/index.d.ts",
    "./local-state.js",
    EXPECTED_LOCAL_STATE_RUNTIME_EXPORTS,
    EXPECTED_LOCAL_STATE_TYPE_EXPORTS,
  );
  verifyIndexModule(
    builtIndexDeclarationText,
    "dist/index.d.ts",
    "./node-identity.js",
    EXPECTED_IDENTITY_RUNTIME_EXPORTS,
    EXPECTED_IDENTITY_TYPE_EXPORTS,
  );
  verifyIndexModule(
    builtIndexDeclarationText,
    "dist/index.d.ts",
    "./runtime-json-snapshot.js",
    [],
    [],
  );
  verifyIndexModule(
    builtIndexJavaScript,
    "dist/index.js",
    "./local-state.js",
    EXPECTED_LOCAL_STATE_RUNTIME_EXPORTS,
    [],
  );
  verifyIndexModule(
    builtIndexJavaScript,
    "dist/index.js",
    "./node-identity.js",
    EXPECTED_IDENTITY_RUNTIME_EXPORTS,
    [],
  );
  verifyIndexModule(builtIndexJavaScript, "dist/index.js", "./runtime-json-snapshot.js", [], []);

  return Object.freeze({
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    sourceExports: Object.freeze([...EXPECTED_RUNTIME_EXPORTS, ...EXPECTED_TYPE_EXPORTS].sort()),
    internalExports: EXPECTED_INTERNAL_SNAPSHOT_EXPORTS,
    modules: Object.freeze(modules),
    tsdocDeclarations: modules.reduce((total, module) => total + module.tsdocDeclarations, 0),
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
      "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
      `${fileName} must import its canonical harness exactly once from ${moduleName}.`,
    );
  }
  const clause = imports[0].importClause;
  const observed = [];
  if (clause?.name !== undefined) observed.push(clause.name.text);
  if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
    if (clause.namedBindings.elements.some((element) => element.propertyName !== undefined)) {
      fail(
        "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
        `${fileName} cannot alias canonical harness bindings.`,
      );
    }
    observed.push(...clause.namedBindings.elements.map(({ name }) => name.text));
  }
  assertArrayEqual(
    observed.sort(),
    [...expectedBindings].sort(),
    "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
            "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
              "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
          "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
            "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
    fail("LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT", `${fileName} has duplicate test titles.`);
  }
  assertArrayEqual(
    [...titles].sort(),
    [...expectedTitles].sort(),
    "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
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
    "local-state-identity.test.ts",
    "package",
    REQUIRED_PACKAGE_TEST_TITLES,
  );
  const rootTitles = collectDirectTests(
    rootTests,
    "runtime-core-local-state-identity.test.mjs",
    "root",
    REQUIRED_ROOT_TEST_TITLES,
  );
  const labels = compilerNegativeLabels(typeTests);
  const workspaceLabels = compilerNegativeLabels(workspaceTypeTests);
  assertArrayEqual(
    labels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
    "M04-T06 compiler-negative descriptions",
  );
  assertArrayEqual(
    workspaceLabels,
    EXPECTED_COMPILER_NEGATIVE_LABELS,
    "LOCAL_STATE_IDENTITY_TEST_INVENTORY_DRIFT",
    "Tracked M04-T06 compiler-negative descriptions",
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

function verifyPackageAndRootWiring(runtimeManifest, validatorManifest, rootManifest) {
  if (
    runtimeManifest.name !== "@desen/runtime-core" ||
    runtimeManifest.scripts?.["test:local-state-identity"] !== EXPECTED_PACKAGE_TEST_SCRIPT ||
    runtimeManifest.dependencies?.["@desen/validator"] !== "workspace:*"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_PACKAGE_CONTRACT_DRIFT",
      "The runtime-core M04-T06 test/dependency contract changed.",
    );
  }
  assertArrayEqual(
    Array.isArray(validatorManifest.files) ? [...validatorManifest.files].sort() : undefined,
    EXPECTED_VALIDATOR_FILES,
    "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
    "Validator package file inventory",
  );
  if (
    validatorManifest.name !== "@desen/validator" ||
    !isDeepStrictEqual(validatorManifest.exports?.["."], EXPECTED_VALIDATOR_ROOT_EXPORT) ||
    !isDeepStrictEqual(
      validatorManifest.exports?.["./schema-contract"],
      EXPECTED_VALIDATOR_EXPORT,
    ) ||
    !isDeepStrictEqual(
      validatorManifest.exports?.["./schema-contract-syntax"],
      EXPECTED_VALIDATOR_SYNTAX_EXPORT,
    )
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_VALIDATOR_SEAM_DRIFT",
      "The code-free validator schema-contract subpath changed.",
      {
        expected: {
          root: EXPECTED_VALIDATOR_ROOT_EXPORT,
          schemaContract: EXPECTED_VALIDATOR_EXPORT,
          schemaContractSyntax: EXPECTED_VALIDATOR_SYNTAX_EXPORT,
        },
        actual: {
          root: validatorManifest.exports?.["."],
          schemaContract: validatorManifest.exports?.["./schema-contract"],
          schemaContractSyntax: validatorManifest.exports?.["./schema-contract-syntax"],
        },
      },
    );
  }
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootManifest.scripts?.[name] !== command) {
      fail("LOCAL_STATE_IDENTITY_ROOT_SCRIPT_DRIFT", `Root command ${name} changed.`, {
        expected: command,
        actual: rootManifest.scripts?.[name],
      });
    }
  }
  const verifyToken = "pnpm verify:runtime-core-local-state-identity";
  const testToken = "pnpm test:runtime-core-local-state-identity";
  const check = String(rootManifest.scripts?.check ?? "").split(" && ");
  const tests = String(rootManifest.scripts?.test ?? "").split(" && ");
  if (
    check.filter((segment) => segment === verifyToken).length !== 1 ||
    tests.filter((segment) => segment === testToken).length !== 1 ||
    check.indexOf(verifyToken) <=
      check.indexOf("pnpm verify:runtime-core-variant-style-evaluation") ||
    tests.indexOf(testToken) <= tests.indexOf("pnpm test:runtime-core-variant-style-evaluation")
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_ROOT_SCRIPT_DRIFT",
      "Aggregate check/test commands must include M04-T06 exactly once after M04-T05.",
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
      fail("LOCAL_STATE_IDENTITY_TRACE_DRIFT", `${expected.id} ownership changed.`, {
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
      fail("LOCAL_STATE_IDENTITY_FINDING_DRIFT", `PF-036 is missing: ${required}`);
    }
  }
  const normativeLine = normativeCoverage
    .split(/\r?\n/u)
    .find((line) => line.startsWith("| N-024 |"));
  const cells = normativeLine?.split("|").map((cell) => cell.trim());
  if (
    cells?.[5] !== "TESTED" ||
    !String(cells?.[6] ?? "").includes("M04-T06") ||
    !/complete/iu.test(String(cells?.[6] ?? "")) ||
    !/resolved-value/iu.test(String(cells?.[6] ?? ""))
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_NORMATIVE_DRIFT",
      "N-024 must be TESTED by M04-T06 complete resolved-value validation evidence.",
      { line: normativeLine },
    );
  }
  const normalizedProof = normalizeMarkdownClaim(proofDocument);
  for (const required of REQUIRED_PROOF_TEXT) {
    if (!normalizedProof.includes(normalizeMarkdownClaim(required))) {
      fail("LOCAL_STATE_IDENTITY_DOCUMENTATION_DRIFT", `Proof document is missing: ${required}`);
    }
  }
  return Object.freeze({
    normativeClause: "N-024",
    normativeStatus: "TESTED",
    finding: "PF-036",
  });
}

async function verifyValueResolutionPrerequisite(options) {
  const trackedBytes = await readFile(DEFAULT_RUNTIME_CORE_VALUE_RESOLUTION_ARTIFACT_PATH);
  if (
    options.valueResolutionPrerequisiteArtifactBytes !== undefined &&
    !byteEqual(options.valueResolutionPrerequisiteArtifactBytes, trackedBytes)
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_PREREQUISITE_DRIFT",
      "Injected M04-T02 prerequisite bytes differ from the tracked artifact.",
    );
  }
  const bytes = options.valueResolutionPrerequisiteArtifactBytes ?? trackedBytes;
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("LOCAL_STATE_IDENTITY_PREREQUISITE_DRIFT", "M04-T02 prerequisite is not valid JSON.");
  }
  if (parsed.task !== "M04-T02" || parsed.result !== "PASS") {
    fail("LOCAL_STATE_IDENTITY_PREREQUISITE_DRIFT", "M04-T02 prerequisite identity changed.");
  }
  return Object.freeze({
    task: "M04-T02",
    result: "PASS",
    artifact: "runtime-core-0.1.0-value-resolution.json",
    artifactSha256: sha256(bytes),
  });
}

function proofStateInput() {
  return {
    surfaceId: "proof-surface",
    state: {
      bag: {
        schema: { type: "object" },
        initial: { a: 1, z: 2 },
      },
      count: {
        schema: { type: "integer", minimum: 0 },
        initial: 0,
      },
      list: {
        schema: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
        initial: [{ name: "first" }],
      },
      marker: {
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["$ref"],
          properties: { $ref: { type: "string" } },
        },
        initial: { $ref: "state.is-inert-json" },
      },
      profile: {
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["enabled", "mode", "name"],
          properties: {
            enabled: { type: "boolean" },
            mode: { enum: ["basic", "advanced"] },
            name: { type: "string", minLength: 1 },
            details: {
              type: "object",
              additionalProperties: false,
              required: ["level"],
              properties: { level: { type: "integer", minimum: 1 } },
            },
          },
          if: {
            properties: { mode: { const: "advanced" } },
            required: ["mode"],
          },
          then: { required: ["details"] },
        },
        initial: { enabled: false, mode: "basic", name: "Ada" },
      },
      "profile.name": {
        schema: { type: "string" },
        initial: "dotted-declaration",
      },
    },
  };
}

function mustMount(api, input = proofStateInput()) {
  const result = api.mountRuntimeSurfaceState(input);
  if (result.status !== "mounted") {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", "Proof state failed to mount.", {
      result: plainData(result),
    });
  }
  return result;
}

function mustCreateIdentity(api, descriptor) {
  const result = api.createRuntimeNodeIdentity(descriptor);
  if (result.status !== "created") {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", "Proof identity failed to create.", {
      result: plainData(result),
    });
  }
  return result.identity;
}

function probeRuntimeBehavior(api) {
  for (const name of EXPECTED_RUNTIME_EXPORTS) {
    if (typeof api[name] !== "function") {
      fail("LOCAL_STATE_IDENTITY_RUNTIME_API_DRIFT", `Missing runtime export ${name}.`);
    }
  }

  const input = proofStateInput();
  const mounted = mustMount(api, input);
  assertDataEqual(
    mounted.snapshot,
    {
      surfaceId: "proof-surface",
      generation: 0,
      values: {
        bag: { a: 1, z: 2 },
        count: 0,
        list: [{ name: "first" }],
        marker: { $ref: "state.is-inert-json" },
        profile: { enabled: false, mode: "basic", name: "Ada" },
        "profile.name": "dotted-declaration",
      },
    },
    "Atomic generation-zero mount",
  );
  if (mounted.handle.surfaceId !== "proof-surface") {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", "State handle surface changed.");
  }
  assertDeepFrozen(mounted, "Mounted state outcome");
  assertDataEqual(
    api.readRuntimeSurfaceState(mounted.handle),
    { status: "active", snapshot: plainData(mounted.snapshot) },
    "Active state read",
  );

  input.state.profile.initial.name = "caller-mutated";
  input.state.list.initial[0].name = "caller-mutated";
  if (
    mounted.snapshot.values.profile.name !== "Ada" ||
    mounted.snapshot.values.list[0].name !== "first"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Mounted state retained caller-owned mutable input.",
    );
  }

  const pf019 = api.writeRuntimeSurfaceState(mounted.handle, {
    path: "profile.name",
    value: "Grace",
  });
  if (
    pf019.status !== "updated" ||
    pf019.snapshot.generation !== 1 ||
    pf019.snapshot.values.profile.name !== "Grace" ||
    pf019.snapshot.values["profile.name"] !== "dotted-declaration" ||
    mounted.snapshot.values.profile.name !== "Ada"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "PF-019 first-segment state addressing or snapshot isolation changed.",
    );
  }
  assertDeepFrozen(pf019, "Successful nested state write");

  const beforeRejectedWrite = api.readRuntimeSurfaceState(mounted.handle);
  const rejected = api.writeRuntimeSurfaceState(mounted.handle, {
    path: "profile.mode",
    value: "advanced",
  });
  assertDataEqual(
    rejected,
    {
      status: "rejected",
      code: "STATE_WRITE_INVALID",
      reason: "schema-mismatch",
      path: "profile.mode",
      issues: [{ kind: "mismatch", pointer: "/details", keyword: "required" }],
    },
    "Complete-entry schema rejection",
  );
  const afterRejectedWrite = api.readRuntimeSurfaceState(mounted.handle);
  if (
    beforeRejectedWrite.status !== "active" ||
    afterRejectedWrite.status !== "active" ||
    beforeRejectedWrite.snapshot !== afterRejectedWrite.snapshot ||
    afterRejectedWrite.snapshot.generation !== 1
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Rejected state write changed the current snapshot or generation.",
    );
  }

  const noOp = api.writeRuntimeSurfaceState(mounted.handle, {
    path: "bag",
    value: { z: 2, a: 1 },
  });
  if (
    noOp.status !== "unchanged" ||
    noOp.snapshot !== afterRejectedWrite.snapshot ||
    noOp.snapshot.generation !== 1
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Canonical no-op changed snapshot identity or generation.",
    );
  }

  const completeReplacement = api.writeRuntimeSurfaceState(mounted.handle, {
    path: "profile",
    value: {
      details: { level: 2 },
      enabled: true,
      mode: "advanced",
      name: "Lin",
    },
  });
  if (completeReplacement.status !== "updated" || completeReplacement.snapshot.generation !== 2) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Schema-valid complete replacement changed.",
    );
  }

  const inertReference = api.writeRuntimeSurfaceState(mounted.handle, {
    path: "marker",
    value: { $ref: "context.stays-inert" },
  });
  if (
    inertReference.status !== "updated" ||
    inertReference.snapshot.values.marker.$ref !== "context.stays-inert"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Resolved-value mode started interpreting reference-shaped state data.",
    );
  }

  const pathFailures = [
    ["profile.name", "dotted-only", "unknown-state"],
    ["bag.missing.child", mounted, "missing-parent"],
    ["list.0.name", mounted, "non-object-parent"],
    ["unknown.value", mounted, "unknown-state"],
    ["bag..value", mounted, "malformed-path"],
  ];
  for (const [writePath, target, reason] of pathFailures) {
    const state =
      target === "dotted-only"
        ? mustMount(api, {
            surfaceId: "proof-surface",
            state: {
              "profile.name": { schema: { type: "string" }, initial: "dotted-only" },
            },
          })
        : target;
    const result = api.writeRuntimeSurfaceState(state.handle, {
      path: writePath,
      value: "x",
    });
    if (
      result.status !== "rejected" ||
      result.code !== "STATE_WRITE_INVALID" ||
      result.reason !== reason
    ) {
      fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", `Path rejection ${writePath} changed.`, {
        result: plainData(result),
      });
    }
  }

  const invalidInitial = api.mountRuntimeSurfaceState({
    surfaceId: "proof-surface",
    state: {
      acceptedFirst: { schema: { type: "string" }, initial: "valid" },
      rejectedSecond: { schema: { type: "integer" }, initial: "wrong" },
    },
  });
  if (
    invalidInitial.status !== "invalid" ||
    invalidInitial.reason !== "invalid-initial-value" ||
    Object.hasOwn(invalidInitial, "handle") ||
    Object.hasOwn(invalidInitial, "snapshot")
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "All-or-nothing initial validation changed.",
    );
  }
  const invalidSchema = api.mountRuntimeSurfaceState({
    surfaceId: "proof-surface",
    state: {
      broken: {
        schema: { $ref: "https://remote.invalid/schema" },
        initial: null,
      },
    },
  });
  if (
    invalidSchema.status !== "invalid" ||
    invalidSchema.reason !== "invalid-state-schema" ||
    invalidSchema.issues.length === 0
  ) {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", "State schema-graph validation changed.");
  }
  const invalidSchemaSyntax = api.mountRuntimeSurfaceState({
    surfaceId: "proof-surface",
    state: {
      broken: {
        schema: { type: 42 },
        initial: null,
      },
    },
  });
  if (
    invalidSchemaSyntax.status !== "invalid" ||
    invalidSchemaSyntax.reason !== "invalid-state-schema" ||
    invalidSchemaSyntax.entryName !== "broken" ||
    invalidSchemaSyntax.issues.length === 0 ||
    invalidSchemaSyntax.issues[0].kind !== "syntax"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Draft 2020-12 schema-syntax validation changed.",
    );
  }
  const vocabularySchemas = [
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-assertion": true,
      },
      type: "string",
      format: "email",
    },
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: { "not an absolute vocabulary URI": true },
      type: "string",
    },
  ];
  for (const schema of vocabularySchemas) {
    const result = api.mountRuntimeSurfaceState({
      surfaceId: "proof-surface",
      state: { guarded: { schema, initial: "not-an-email" } },
    });
    if (
      result.status !== "invalid" ||
      result.reason !== "invalid-state-schema" ||
      result.entryName !== "guarded" ||
      Object.hasOwn(result, "handle") ||
      Object.hasOwn(result, "snapshot")
    ) {
      fail(
        "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
        "Vocabulary-dependent schema assertions no longer fail closed before mount.",
      );
    }
    assertDataEqual(
      result.issues,
      [{ kind: "profile", pointer: "/$vocabulary", keyword: "$vocabulary" }],
      "Vocabulary profile rejection",
    );
  }

  let mountGetterCalls = 0;
  const hostileEntry = { initial: "safe" };
  Object.defineProperty(hostileEntry, "schema", {
    enumerable: true,
    get() {
      mountGetterCalls += 1;
      return { type: "string" };
    },
  });
  const hostileMount = api.mountRuntimeSurfaceState({
    surfaceId: "proof-surface",
    state: { hostile: hostileEntry },
  });
  if (
    hostileMount.status !== "invalid" ||
    hostileMount.reason !== "unsafe-or-unbounded-input" ||
    mountGetterCalls !== 0
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Hostile mount data no longer fails closed without getter execution.",
    );
  }

  const historical = inertReference.snapshot;
  assertDataEqual(
    api.disposeRuntimeSurfaceState(mounted.handle),
    { status: "disposed", surfaceId: "proof-surface" },
    "State disposal",
  );
  assertDataEqual(
    api.readRuntimeSurfaceState(mounted.handle),
    { status: "disposed", surfaceId: "proof-surface" },
    "Disposed state read",
  );
  assertDataEqual(
    api.writeRuntimeSurfaceState(mounted.handle, { path: "count", value: 1 }),
    { status: "disposed", surfaceId: "proof-surface" },
    "Disposed state write",
  );
  assertDataEqual(
    api.disposeRuntimeSurfaceState(mounted.handle),
    { status: "already-disposed", surfaceId: "proof-surface" },
    "Idempotent state disposal",
  );
  if (historical.values.marker.$ref !== "context.stays-inert") {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Historical immutable observation changed after disposal.",
    );
  }
  const remounted = mustMount(api);
  if (
    remounted.handle === mounted.handle ||
    remounted.snapshot.generation !== 0 ||
    remounted.snapshot.values.profile.name !== "Ada"
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Fresh mount restored a disposed lifetime.",
    );
  }

  const descriptor = {
    documentId: "com.desen.proof",
    surfaceId: "proof-surface",
    nodeId: "proof.submit",
    use: "com.desen.ui/Button",
  };
  const identity = mustCreateIdentity(api, descriptor);
  if (
    identity.key !== '["com.desen.proof","proof-surface","proof.submit"]' ||
    identity.mountGeneration !== 0
  ) {
    fail("LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT", "Structured stable node key changed.");
  }
  assertDeepFrozen(identity, "Created node identity");

  const preserved = api.reconcileRuntimeNodeIdentity(identity, { ...descriptor });
  if (preserved.status !== "preserve-eligible" || preserved.identity !== identity) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Compatible node identity is no longer preserved by exact reference.",
    );
  }
  const remount = api.reconcileRuntimeNodeIdentity(identity, {
    ...descriptor,
    use: "com.desen.ui/Link",
  });
  if (
    remount.status !== "remount-required" ||
    remount.reason !== "capability-changed" ||
    remount.identity.key !== identity.key ||
    remount.identity.mountGeneration !== 1 ||
    remount.identity === identity
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Capability-change remount decision changed.",
    );
  }
  const replacement = api.reconcileRuntimeNodeIdentity(identity, {
    ...descriptor,
    surfaceId: "other-surface",
  });
  if (
    replacement.status !== "replace-required" ||
    replacement.reason !== "identity-changed" ||
    replacement.previousIdentity !== identity ||
    replacement.nextIdentity.key === identity.key ||
    replacement.nextIdentity.mountGeneration !== 0
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Base node identity replacement decision changed.",
    );
  }
  const forged = api.reconcileRuntimeNodeIdentity({ ...identity }, descriptor);
  assertDataEqual(
    forged,
    { status: "invalid", reason: "forged-identity", pointer: "" },
    "Forged node identity rejection",
  );
  const widened = api.createRuntimeNodeIdentity({
    ...descriptor,
    revision: `sha256:${"a".repeat(64)}`,
  });
  assertDataEqual(
    widened,
    { status: "invalid", reason: "malformed-descriptor", pointer: "" },
    "Revision exclusion from base identity",
  );
  const capabilityAdversary = api.createRuntimeNodeIdentity({
    ...descriptor,
    use: `${"a.".repeat(80)}/`,
  });
  assertDataEqual(
    capabilityAdversary,
    { status: "invalid", reason: "malformed-capability-id", pointer: "/use" },
    "Linear capability-id adversary rejection",
  );
  const repeatedIdentity = mustCreateIdentity(api, descriptor);
  if (repeatedIdentity.key !== identity.key) {
    fail(
      "LOCAL_STATE_IDENTITY_RUNTIME_BEHAVIOR_DRIFT",
      "Repeated identity construction is not deterministic.",
    );
  }

  return Object.freeze({
    mountProbes: 6,
    readProbes: 3,
    acceptedWriteProbes: 3,
    rejectedWriteProbes: 7,
    completeValidationProbes: 3,
    schemaSyntaxProbes: 1,
    schemaProfileProbes: 2,
    resolvedValueProbes: 1,
    pf019Probes: 2,
    noOpProbes: 1,
    atomicityProbes: 4,
    disposalProbes: 5,
    identityCreationProbes: 2,
    identityPreservationProbes: 1,
    identityRemountProbes: 1,
    identityReplacementProbes: 1,
    identityRejectionProbes: 3,
    capabilitySafetyProbes: 1,
    hostileInputProbes: 1,
    platformEffects: 0,
    sourceWriteBacks: 0,
    partialOutputs: false,
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
 * Builds deterministic M04-T06 evidence from source, distribution, tests, documentation, and
 * headless runtime probes.
 */
export async function buildRuntimeCoreLocalStateIdentityEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    valueResolutionPrerequisite,
    localStateText,
    identityText,
    snapshotText,
    sourceIndexText,
    localStateDeclarationText,
    identityDeclarationText,
    snapshotDeclarationText,
    localStateBuiltJavaScript,
    identityBuiltJavaScript,
    snapshotBuiltJavaScript,
    validatorWrapperJavaScript,
    validatorWrapperDeclaration,
    builtIndexDeclarationText,
    builtIndexJavaScript,
    packageTests,
    typeTests,
    workspaceTypeTests,
    rootTests,
    runtimePackageText,
    validatorPackageText,
    rootPackageText,
    traceText,
    findings,
    normativeCoverage,
    proofDocument,
    tracked,
  ] = await Promise.all([
    verifyValueResolutionPrerequisite(normalized),
    readWorkspaceText("packages/runtime-core/src/local-state.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/node-identity.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/runtime-json-snapshot.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/local-state.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/node-identity.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/runtime-json-snapshot.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/local-state.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/node-identity.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/runtime-json-snapshot.js", fileOverrides),
    readWorkspaceText("packages/validator/schema-contract-syntax.js", fileOverrides),
    readWorkspaceText("packages/validator/schema-contract-syntax.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/local-state-identity.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/local-state-identity.types.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/local-state-identity.types.ts"),
    readWorkspaceText("tests/runtime-core-local-state-identity.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("packages/validator/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md", fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  let runtimeManifest;
  let validatorManifest;
  let rootManifest;
  let trace;
  try {
    runtimeManifest = JSON.parse(runtimePackageText);
    validatorManifest = JSON.parse(validatorPackageText);
    rootManifest = JSON.parse(rootPackageText);
    trace = JSON.parse(traceText);
  } catch {
    fail(
      "LOCAL_STATE_IDENTITY_METADATA_INVALID",
      "Runtime, validator, root, or trace metadata is not valid JSON.",
    );
  }

  const publicApi = verifySourceAndDistribution({
    localStateText,
    identityText,
    snapshotText,
    sourceIndexText,
    localStateDeclarationText,
    identityDeclarationText,
    snapshotDeclarationText,
    localStateBuiltJavaScript,
    identityBuiltJavaScript,
    snapshotBuiltJavaScript,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  });
  const testInventory = verifyTestInventory({
    packageTests,
    typeTests,
    workspaceTypeTests,
    rootTests,
  });
  const validatorFacade = verifyValidatorFacade(
    validatorWrapperJavaScript,
    validatorWrapperDeclaration,
  );
  verifyPackageAndRootWiring(runtimeManifest, validatorManifest, rootManifest);
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation({ findings, normativeCoverage, proofDocument });
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const runtime = probeRuntimeBehavior(runtimeApi);
  const validatorSeam = Object.freeze({
    package: "@desen/validator",
    subpaths: Object.freeze({
      "./schema-contract": EXPECTED_VALIDATOR_EXPORT,
      "./schema-contract-syntax": EXPECTED_VALIDATOR_SYNTAX_EXPORT,
    }),
    runtimeDependency: "workspace:*",
    manifestSha256: sha256(Buffer.from(validatorPackageText)),
    facade: validatorFacade,
  });

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T06",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Fresh surface-local state mounts, reads, complete schema-safe writes, disposal, and non-repeated base node identity reconcile deterministically without framework or host effects.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([
        Object.freeze({ id: "N-024", from: "PLANNED", to: "TESTED" }),
      ]),
    }),
    prerequisites: Object.freeze([valueResolutionPrerequisite, validatorSeam]),
    publicApi,
    validatorFacade,
    runtime,
    stateSemantics: Object.freeze({
      initialization: "all declarations and initials or no handle",
      locality: "one surface lifetime",
      persistence: false,
      sourceWriteBack: false,
      writeInput: "already-resolved inert JSON",
      schemaApplication: "complete resolved-value",
      schemaVocabularyDeclarations:
        "fail closed before mount because vocabulary-dependent assertions are unsupported",
      writeAddressing: "substring before first dot is the complete entry name",
      longestPrefixMatching: false,
      nestedParents: "existing objects only",
      arrayTraversal: false,
      finalPropertyCreation: "allowed only when complete candidate validates",
      diagnostic: "STATE_WRITE_INVALID",
      commit: "atomic immutable generation",
      noOp: "RFC 8785 canonical equality preserves generation and snapshot identity",
      disposal: "runtime authority revoked; retained historical snapshots are not securely erased",
    }),
    nodeIdentitySemantics: Object.freeze({
      scope: "non-repeated base source node",
      keyTuple: Object.freeze(["documentId", "surfaceId", "nodeId"]),
      revisionInKey: false,
      capabilityInKey: false,
      compatibleResult: "preserve-eligible with exact prior identity",
      capabilityChangeResult: "remount-required with incremented generation",
      tupleChangeResult: "replace-required with fresh generation zero",
      repeatKey: "deferred to M04-T07",
      adapterRemountPolicy: "deferred to M05-T05",
      capabilityIdParser: "linear scan equivalent to the frozen accepted language",
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
      normativeRules: Object.freeze([
        Object.freeze({
          id: "N-024",
          status: "TESTED",
          evidence: "complete resolved-value post-write schema validation",
        }),
      ]),
      trackedFiles: tracked,
      rootScripts: Object.freeze(Object.keys(ROOT_SCRIPTS)),
    }),
    deferred: Object.freeze([
      "state.toggle and complete action-turn execution (M04-T10)",
      "repeat expansion, repeat keys, and repeated instance identity (M04-T07)",
      "resource and operation lifecycle transitions (M04-T08/M04-T09)",
      "reactive reevaluation and conditional subtree lifecycle (M04-T15)",
      "complete headless sign-in observable trace (M04-T16)",
      "adapter compatibility and declared remount-required prop policy (M05-T05)",
      "cross-surface persistence profiles and secure memory erasure",
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
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_MISSING", "M04-T06 artifact cannot be read.", {
      cause: String(error),
    });
  }
  if (!entry.isFile()) {
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE", "M04-T06 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Verifies tracked or injected M04-T06 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreLocalStateIdentityEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreLocalStateIdentityEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!byteEqual(actualBytes, expected.artifactBytes)) {
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_DRIFT", "M04-T06 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    internalExports: expected.artifact.publicApi.internalExports.length,
    tsdocDeclarations: expected.artifact.publicApi.tsdocDeclarations,
    validatorFacadeRuntimeExports: expected.artifact.validatorFacade.runtimeExports.length,
    validatorFacadeTypeExports: expected.artifact.validatorFacade.typeExports.length,
    validatorFacadeTsdocDeclarations: expected.artifact.validatorFacade.tsdocDeclarations,
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    normativeRules: expected.artifact.evidence.normativeRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    mountProbes: expected.artifact.runtime.mountProbes,
    readProbes: expected.artifact.runtime.readProbes,
    acceptedWriteProbes: expected.artifact.runtime.acceptedWriteProbes,
    rejectedWriteProbes: expected.artifact.runtime.rejectedWriteProbes,
    completeValidationProbes: expected.artifact.runtime.completeValidationProbes,
    schemaSyntaxProbes: expected.artifact.runtime.schemaSyntaxProbes,
    schemaProfileProbes: expected.artifact.runtime.schemaProfileProbes,
    resolvedValueProbes: expected.artifact.runtime.resolvedValueProbes,
    pf019Probes: expected.artifact.runtime.pf019Probes,
    noOpProbes: expected.artifact.runtime.noOpProbes,
    atomicityProbes: expected.artifact.runtime.atomicityProbes,
    disposalProbes: expected.artifact.runtime.disposalProbes,
    identityCreationProbes: expected.artifact.runtime.identityCreationProbes,
    identityPreservationProbes: expected.artifact.runtime.identityPreservationProbes,
    identityRemountProbes: expected.artifact.runtime.identityRemountProbes,
    identityReplacementProbes: expected.artifact.runtime.identityReplacementProbes,
    identityRejectionProbes: expected.artifact.runtime.identityRejectionProbes,
    capabilitySafetyProbes: expected.artifact.runtime.capabilitySafetyProbes,
    hostileInputProbes: expected.artifact.runtime.hostileInputProbes,
    platformEffects: expected.artifact.runtime.platformEffects,
  });
}

/** Atomically writes deterministic M04-T06 evidence after every proof check passes. */
export async function writeRuntimeCoreLocalStateIdentityEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreLocalStateIdentityEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreLocalStateIdentityEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T06 evidence boundary. */
export const RUNTIME_CORE_LOCAL_STATE_IDENTITY_ROOT_SCRIPTS = Object.freeze(
  Object.keys(ROOT_SCRIPTS),
);
