import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const MAX_WORKSPACE_FILE_BYTES = 8_000_000;
const MAX_PROOF_DOCUMENT_BYTES = 500_000;
const MAX_LEDGER_BYTES = 2_000_000;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;

/** Absolute destination of the deterministic M05-T05 proof artifact. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute location of the human-readable M05-T05 proof. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute location of the M05-T05 Proof Matrix evidence. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

/** Absolute location of the M05-T05 normative traceability pin. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_PATH,
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "localStateIdentity",
    task: "M04-T06",
    path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
    sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
    target: "platform-neutral",
  }),
  Object.freeze({
    key: "repeatMaterialization",
    task: "M04-T07",
    path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
    sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
    target: "platform-neutral",
  }),
  Object.freeze({
    key: "runtimeReactInteractions",
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    profile: "desen-runtime-react-interactions-v1",
    target: "web-react",
  }),
]);

const SOURCE_PATHS = Object.freeze({
  index: "packages/runtime-react/src/index.ts",
  registry: "packages/runtime-react/src/registry.ts",
  reconciliation: "packages/runtime-react/src/reconciliation.ts",
  renderer: "packages/runtime-react/src/render-plan.tsx",
  interactions: "packages/runtime-react/src/interactions.tsx",
  sessionSurface: "packages/runtime-react/src/session-surface.tsx",
  liveSurface: "packages/runtime-react/src/live-surface.tsx",
  diagnosticIndex: "packages/runtime-react/src/diagnostic-index.ts",
});

const TEST_FILES = Object.freeze([
  Object.freeze({
    path: "packages/runtime-react/test/adapter-registry.test.tsx",
    registrations: 14,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/reconciliation.test.ts",
    registrations: 8,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/reconciliation-render.test.tsx",
    registrations: 7,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/diagnostic-index.test.ts",
    registrations: 8,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/session-surface.test.tsx",
    registrations: 11,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/live-surface.test.tsx",
    registrations: 5,
  }),
]);

const TYPE_TEST_FILES = Object.freeze([
  Object.freeze({
    path: "packages/runtime-react/test/adapter-registry.types.ts",
    negativeCases: 4,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/reconciliation.types.ts",
    negativeCases: 5,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/diagnostic-index.types.ts",
    negativeCases: 6,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/session-surface.types.ts",
    negativeCases: 7,
  }),
  Object.freeze({
    path: "packages/runtime-react/test/live-surface.types.ts",
    negativeCases: 4,
  }),
]);

const ROOT_PACKAGE_PATH = "package.json";
const RUNTIME_PACKAGE_PATH = "packages/runtime-react/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const PROOF_LIBRARY_PATH = "scripts/lib/runtime-react-reconciliation-diagnostics-proof.mjs";
const GENERATE_SCRIPT_PATH = "scripts/generate-runtime-react-reconciliation-diagnostics-proof.mjs";
const VERIFY_SCRIPT_PATH = "scripts/verify-runtime-react-reconciliation-diagnostics.mjs";
const ROOT_TEST_PATH = "tests/runtime-react-reconciliation-diagnostics.test.mjs";

const TRACKED_PATHS = Object.freeze([
  ...Object.values(SOURCE_PATHS),
  ...TEST_FILES.map(({ path: filePath }) => filePath),
  ...TYPE_TEST_FILES.map(({ path: filePath }) => filePath),
  RUNTIME_PACKAGE_PATH,
  ROOT_PACKAGE_PATH,
  LOCKFILE_PATH,
  PROOF_LIBRARY_PATH,
  GENERATE_SCRIPT_PATH,
  VERIFY_SCRIPT_PATH,
  ROOT_TEST_PATH,
  PROOF_DOCUMENT_PATH,
  PROOF_MATRIX_PATH,
  NORMATIVE_COVERAGE_PATH,
]);

const ALLOWED_OVERRIDE_PATHS = new Set(TRACKED_PATHS);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "buildRuntimeReactDiagnosticIndex",
  "createRuntimeReactAdapterRegistry",
  "createRuntimeReactReconciliationKey",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
  "useRuntimeReactSessionSurface",
  "useRuntimeReactSurface",
]);

const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterReconciliationPolicySnapshot",
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
  "RuntimeReactBehaviorDiagnosticIndexBinding",
  "RuntimeReactBehaviorDiagnosticIndexEntry",
  "RuntimeReactCommandAttachmentHandle",
  "RuntimeReactCommandAttachmentResult",
  "RuntimeReactCommandDetachmentResult",
  "RuntimeReactComponentAdapterComponent",
  "RuntimeReactComponentAdapterProps",
  "RuntimeReactComponentAdapterRegistration",
  "RuntimeReactComponentCommandPort",
  "RuntimeReactComponentDiagnosticIndexBinding",
  "RuntimeReactComponentDiagnosticIndexEntry",
  "RuntimeReactDiagnosticIdentity",
  "RuntimeReactDiagnosticIndex",
  "RuntimeReactDiagnosticIndexBinding",
  "RuntimeReactDiagnosticIndexBuildResult",
  "RuntimeReactDiagnosticIndexEntry",
  "RuntimeReactDiagnosticIndexInvalidReason",
  "RuntimeReactDiagnosticIndexLimitProfile",
  "RuntimeReactEventDispatchResult",
  "RuntimeReactInteractionPort",
  "RuntimeReactLiveSurfaceFailure",
  "RuntimeReactLiveSurfaceInput",
  "RuntimeReactLiveSurfaceResult",
  "RuntimeReactNamedSlots",
  "RuntimeReactReconciliationKeyInput",
  "RuntimeReactRenderFailure",
  "RuntimeReactRenderFailureChannel",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
  "RuntimeReactSessionSurfaceFailure",
  "RuntimeReactSessionSurfaceFailureReason",
  "RuntimeReactSessionSurfaceInput",
  "RuntimeReactSessionSurfaceReady",
  "RuntimeReactSessionSurfaceResult",
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_MODULE_ONLY_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryAuthority",
  "RuntimeReactBehaviorAdapterDefinition",
  "RuntimeReactComponentAdapterDefinition",
  "createRuntimeReactBehaviorAdapterElement",
  "createRuntimeReactComponentAdapterElement",
  "readRuntimeReactAdapterRegistryAuthority",
]);

const EXPECTED_RENDER_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
  "DIAGNOSTIC_INDEX_FAILED",
  "DUPLICATE_RUNTIME_IDENTITY",
  "INVALID_BEHAVIOR_PROPS",
  "INVALID_BEHAVIOR_SLOTS",
  "INVALID_BEHAVIOR_STYLE",
  "INVALID_CATALOG_SET",
  "INVALID_COMPONENT_PROPS",
  "INVALID_COMPONENT_SLOTS",
  "INVALID_COMPONENT_STYLE",
  "INVALID_REGISTRY",
  "INVALID_SESSION",
  "INVALID_SESSION_SNAPSHOT",
  "JSON_DEPTH_LIMIT_EXCEEDED",
  "JSON_OCCURRENCE_LIMIT_EXCEEDED",
  "MALFORMED_RENDER_PLAN",
  "NODE_LIMIT_EXCEEDED",
  "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
  "RECONCILIATION_KEY_FAILED",
  "RUNTIME_BINDING_MISMATCH",
  "SLOT_LIMIT_EXCEEDED",
  "STRING_LIMIT_EXCEEDED",
  "UNKNOWN_BEHAVIOR_CAPABILITY",
  "UNKNOWN_COMPONENT_CAPABILITY",
]);

const EXPECTED_DIAGNOSTIC_FAILURE_REASONS = Object.freeze([
  "behavior-owner-mismatch",
  "binding-limit",
  "duplicate-runtime-node",
  "identifier-code-unit-limit",
  "identifier-occurrence-limit",
  "invalid-input",
  "invalid-limits",
  "unknown-behavior-owner",
]);

const EXPECTED_PRODUCTION_IMPORTS = Object.freeze([
  "./diagnostic-index.js",
  "./interactions.js",
  "./reconciliation.js",
  "./registry.js",
  "./render-plan.js",
  "./session-surface.js",
  "@desen/protocol",
  "@desen/runtime-core",
  "@desen/validator",
  "react",
]);

const FOCUSED_TEST_ARGUMENTS =
  "test/adapter-registry.test.tsx test/reconciliation.test.ts " +
  "test/reconciliation-render.test.tsx test/diagnostic-index.test.ts " +
  "test/session-surface.test.tsx test/live-surface.test.tsx";
const ROOT_SCRIPT_PREFIX =
  "pnpm --filter @desen/runtime-react... build && " +
  "pnpm --filter @desen/runtime-react typecheck && " +
  `pnpm --filter @desen/runtime-react exec vitest run ${FOCUSED_TEST_ARGUMENTS} && `;
const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-react-reconciliation-diagnostics": `${ROOT_SCRIPT_PREFIX}node scripts/generate-runtime-react-reconciliation-diagnostics-proof.mjs`,
  "verify:runtime-react-reconciliation-diagnostics": `${ROOT_SCRIPT_PREFIX}node scripts/verify-runtime-react-reconciliation-diagnostics.mjs`,
  "test:runtime-react-reconciliation-diagnostics": `${ROOT_SCRIPT_PREFIX}node --test tests/runtime-react-reconciliation-diagnostics.test.mjs`,
});

const ROOT_MUTATION_CASES = Object.freeze([
  "index-runtime-export",
  "index-type-export",
  "registry-remount-count-limit",
  "registry-remount-code-unit-limit",
  "registry-trusted-policy-capture",
  "reconciliation-profile",
  "reconciliation-runtime-identity",
  "reconciliation-capability-identity",
  "reconciliation-missing-presence",
  "reconciliation-present-presence",
  "reconciliation-rfc8785",
  "renderer-component-reconciliation",
  "renderer-behavior-reconciliation",
  "component-react-key",
  "behavior-react-key",
  "renderer-diagnostic-index",
  "diagnostic-binding-limit",
  "diagnostic-occurrence-limit",
  "diagnostic-code-unit-limit",
  "diagnostic-null-prototype",
  "diagnostic-recursive-immutability",
  "session-external-store",
  "session-core-read",
  "session-core-subscribe",
  "session-core-unsubscribe",
  "live-session-observation",
  "live-render-compilation",
  "session-root-isolation",
  "error-boundary-deferred",
  "package-production-protocol",
  "lock-production-protocol",
  "root-script-contract",
  "focused-test-inventory",
  "compiler-negative-inventory",
  "root-mutation-inventory",
]);

/** Controlled deterministic M05-T05 evidence failure. */
export class RuntimeReactReconciliationDiagnosticsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactReconciliationDiagnosticsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactReconciliationDiagnosticsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prefixedSha256(bytes) {
  return `sha256:${sha256(bytes)}`;
}

function sorted(values) {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `${label} contains unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `${label}.${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `${label}.${key} must be an enumerable own-data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `${label} must be non-shared non-Proxy bytes.`,
    );
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError) throw error;
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `${label} must not use shared backing memory.`,
    );
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `${label} backing memory is detached or invalid.`,
    );
  }
}

function captureFileOverrides(value) {
  if (value === undefined) return undefined;
  const keys =
    value !== null && typeof value === "object" && !utilTypes.isProxy(value)
      ? (() => {
          try {
            return Reflect.ownKeys(value);
          } catch {
            return [];
          }
        })()
      : [];
  const captured = captureOptions(
    value,
    keys.filter((key) => typeof key === "string"),
    "fileOverrides",
  );
  const overrides = Object.create(null);
  for (const key of Reflect.ownKeys(captured)) {
    if (typeof key !== "string" || !ALLOWED_OVERRIDE_PATHS.has(key)) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `fileOverrides contains an unconsumed path: ${String(key)}.`,
      );
    }
    const entry = captured[key];
    if (entry === null) {
      overrides[key] = null;
    } else if (typeof entry === "string") {
      overrides[key] = Buffer.from(entry, "utf8");
    } else {
      overrides[key] = captureBytes(entry, `fileOverrides.${key}`);
    }
  }
  return Object.freeze(overrides);
}

function capturePrerequisiteBytes(value) {
  if (value === undefined) return undefined;
  const captured = captureOptions(
    value,
    PREREQUISITES.map(({ key }) => key),
    "prerequisiteBytes",
  );
  const overrides = Object.create(null);
  for (const [key, entry] of Object.entries(captured)) {
    overrides[key] = captureBytes(entry, `prerequisiteBytes.${key}`);
  }
  return Object.freeze(overrides);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalBoolean(value, label) {
  if (value !== undefined && typeof value !== "boolean") {
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} must be a boolean.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(absolutePath, missingCode, unsafeCode, label, maximumBytes) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail(missingCode, `${label} is missing.`, { path: absolutePath, cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > maximumBytes) {
    fail(unsafeCode, `${label} must be a bounded regular non-symlink file.`, {
      path: absolutePath,
    });
  }
  let handle;
  try {
    handle = await open(absolutePath, "r");
    const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      !openedEntry.isFile() ||
      !currentEntry.isFile() ||
      currentEntry.isSymbolicLink() ||
      openedEntry.dev !== currentEntry.dev ||
      openedEntry.ino !== currentEntry.ino
    ) {
      fail(unsafeCode, `${label} changed identity while opening.`, { path: absolutePath });
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes) {
      fail(unsafeCode, `${label} exceeds its bounded byte limit.`, { path: absolutePath });
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError) throw error;
    fail(unsafeCode, `${label} could not be read safely.`, {
      path: absolutePath,
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function workspaceBytes(workspaceRoot, relativePath, overrides) {
  if (overrides !== undefined && Object.hasOwn(overrides, relativePath)) {
    const bytes = overrides[relativePath];
    if (bytes === null) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_SOURCE_MISSING",
        `Tracked M05-T05 input is absent: ${relativePath}.`,
      );
    }
    return Buffer.from(bytes);
  }
  return readRegularBytes(
    path.join(workspaceRoot, relativePath),
    "RECONCILIATION_DIAGNOSTICS_SOURCE_MISSING",
    "RECONCILIATION_DIAGNOSTICS_SOURCE_UNSAFE",
    `Tracked M05-T05 input ${relativePath}`,
    MAX_WORKSPACE_FILE_BYTES,
  );
}

function sourceFile(relativePath, text) {
  const parsed = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if ((parsed.parseDiagnostics ?? []).length !== 0) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      `Tracked TypeScript source no longer parses: ${relativePath}.`,
    );
  }
  return parsed;
}

function hasExportModifier(node) {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
}

function hasTsdoc(node, parsed, text) {
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  return ranges.some((range) => text.slice(range.pos, range.end).startsWith("/**"));
}

function moduleExportDeclarations(relativePath, text) {
  const parsed = sourceFile(relativePath, text);
  const records = [];
  for (const statement of parsed.statements) {
    if (!hasExportModifier(statement)) continue;
    const names = [];
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    } else if (
      "name" in statement &&
      statement.name !== undefined &&
      ts.isIdentifier(statement.name)
    ) {
      names.push(statement.name.text);
    }
    const documented = hasTsdoc(statement, parsed, text);
    for (const name of names) records.push(Object.freeze({ name, documented, path: relativePath }));
  }
  return Object.freeze(records);
}

function rootExportInventory(text) {
  const parsed = sourceFile(SOURCE_PATHS.index, text);
  const runtime = [];
  const types = [];
  for (const statement of parsed.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
        "The runtime-react root may expose only explicit named exports.",
      );
    }
    for (const element of statement.exportClause.elements) {
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    runtimeExports: Object.freeze(sorted(runtime)),
    typeExports: Object.freeze(sorted(types)),
    packageDocumentation: text.includes("@packageDocumentation"),
  });
}

function importAndCallInventory(relativePath, text) {
  const parsed = sourceFile(relativePath, text);
  const imports = [];
  const calls = Object.create(null);
  let dynamicImports = 0;
  for (const statement of parsed.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push(statement.moduleSpecifier.text);
    }
  }
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        dynamicImports += 1;
      } else {
        const name = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : undefined;
        if (name !== undefined) calls[name] = (calls[name] ?? 0) + 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return Object.freeze({
    imports: Object.freeze(sorted(new Set(imports))),
    calls: Object.freeze(calls),
    dynamicImports,
  });
}

function stringUnion(relativePath, text, typeName) {
  const parsed = sourceFile(relativePath, text);
  const declarations = parsed.statements.filter(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === typeName &&
      ts.isUnionTypeNode(statement.type),
  );
  if (declarations.length !== 1) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      `Expected one exact ${typeName} string-union declaration.`,
    );
  }
  const values = declarations[0].type.types.flatMap((member) =>
    ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal) ? [member.literal.text] : [],
  );
  if (values.length !== declarations[0].type.types.length) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      `${typeName} must remain a closed string-literal union.`,
    );
  }
  return Object.freeze(sorted(values));
}

function requireFragments(text, fragments, label) {
  const missing = fragments.filter((fragment) => !text.includes(fragment));
  if (missing.length !== 0) {
    fail("RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT", `${label} lost reviewed M05-T05 invariants.`, {
      missing,
    });
  }
}

function rejectFragments(text, fragments, label) {
  const present = fragments.filter((fragment) => text.includes(fragment));
  if (present.length !== 0) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      `${label} gained deferred or forbidden authority.`,
      { present },
    );
  }
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function inspectPublicApi(files) {
  const root = rootExportInventory(files.get(SOURCE_PATHS.index).toString("utf8"));
  if (
    !root.packageDocumentation ||
    !isDeepStrictEqual(root.runtimeExports, EXPECTED_RUNTIME_EXPORTS) ||
    !isDeepStrictEqual(root.typeExports, EXPECTED_TYPE_EXPORTS)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The exact documented runtime-react root API changed.",
      {
        expectedRuntime: EXPECTED_RUNTIME_EXPORTS,
        actualRuntime: root.runtimeExports,
        expectedTypes: EXPECTED_TYPE_EXPORTS,
        actualTypes: root.typeExports,
      },
    );
  }

  const declarations = Object.values(SOURCE_PATHS)
    .filter((relativePath) => relativePath !== SOURCE_PATHS.index)
    .flatMap((relativePath) =>
      moduleExportDeclarations(relativePath, files.get(relativePath).toString("utf8")),
    );
  const names = declarations.map(({ name }) => name);
  if (new Set(names).size !== names.length || declarations.some(({ documented }) => !documented)) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "Every exported source declaration must remain unique and TSDoc-documented.",
    );
  }
  const rootNames = new Set([...root.runtimeExports, ...root.typeExports]);
  const missing = [...rootNames].filter((name) => !names.includes(name));
  const moduleOnly = sorted(names.filter((name) => !rootNames.has(name)));
  if (missing.length !== 0 || !isDeepStrictEqual(moduleOnly, EXPECTED_MODULE_ONLY_EXPORTS)) {
    fail("RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT", "The root-to-module export mapping changed.", {
      missing,
      expectedModuleOnly: EXPECTED_MODULE_ONLY_EXPORTS,
      actualModuleOnly: moduleOnly,
    });
  }
  return Object.freeze({
    runtimeExports: root.runtimeExports,
    typeExports: root.typeExports,
    publicRootDeclarations: rootNames.size,
    sourceDeclarations: declarations.length,
    tsdocDeclarations: declarations.filter(({ documented }) => documented).length,
    moduleOnlyExports: Object.freeze(moduleOnly),
  });
}

function inspectSources(files) {
  const texts = Object.fromEntries(
    Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
      key,
      files.get(relativePath).toString("utf8"),
    ]),
  );
  const publicApi = inspectPublicApi(files);
  const inventories = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(([key]) => key !== "index")
      .map(([key, relativePath]) => [key, importAndCallInventory(relativePath, texts[key])]),
  );
  const productionImports = sorted(
    new Set(Object.values(inventories).flatMap(({ imports }) => imports)),
  );
  if (
    !isDeepStrictEqual(productionImports, EXPECTED_PRODUCTION_IMPORTS) ||
    Object.values(inventories).some(({ dynamicImports }) => dynamicImports !== 0)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The reviewed static production import boundary changed.",
      { expected: EXPECTED_PRODUCTION_IMPORTS, actual: productionImports },
    );
  }

  requireFragments(
    texts.registry,
    [
      "maxRemountPropsPerAdapter: 256",
      "maxRemountPropCodeUnits: 1_048_576",
      '["remountOnProps"]',
      "captureRemountPolicy(",
      "remountOnProps: registration.remountOnProps",
      "componentReconciliationPolicies",
      "behaviorReconciliationPolicies",
    ],
    "Adapter registry",
  );
  requireFragments(
    texts.reconciliation,
    [
      'const RECONCILIATION_KEY_PROFILE = "desen.runtime-react/reconciliation-key@0.1.0"',
      "runtimeNodeId: runtimeNodeId.value",
      "capabilityId: capabilityId.value",
      'presence: "missing"',
      'presence: "present"',
      "remountProps: projection",
      "canonicalizeJson({",
    ],
    "Reconciliation-key builder",
  );
  requireFragments(
    texts.renderer,
    [
      '"RECONCILIATION_KEY_FAILED"',
      '"DIAGNOSTIC_INDEX_FAILED"',
      "remountOnProps: definition.remountOnProps",
      "buildRuntimeReactDiagnosticIndex(diagnosticBindings(state.bindings)",
      "diagnosticIndex: diagnosticIndex.index",
      "reconciliationKey: node.reconciliationKey",
      "reconciliationKey: behavior.reconciliationKey",
      "const SESSION_REGISTRY_BOUNDARIES = new WeakMap<",
      "const SessionBoundary = sessionRegistryBoundary(",
      "captured.session as object,\n    captured.registry as object,",
      "const element = createElement(SessionBoundary, null, managedTree)",
    ],
    "Render-plan compiler",
  );
  requireFragments(
    texts.interactions,
    ["key: input.reconciliationKey"],
    "Commit-gated adapter element boundary",
  );
  requireFragments(
    texts.sessionSurface,
    [
      "useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)",
      "const beforePostAdmissionRead = current",
      "const afterPostAdmissionRead = observeCurrent()",
      "unsubscribeRuntimeHeadlessSession(subscription)",
    ],
    "Session external-store surface",
  );
  requireFragments(
    texts.liveSurface,
    ["useRuntimeReactSessionSurface(", "renderRuntimeReactSurface({"],
    "Live authenticated surface",
  );
  requireFragments(
    texts.diagnosticIndex,
    [
      "maxBindings: 25_000",
      "maxIdentifierOccurrences: 115_000",
      "maxIdentifierCodeUnits: 4_194_304",
      "const output: Record<string, Value> = Object.create(null)",
      "Object.freeze([...values].sort(CODE_UNIT_COMPARATOR))",
      "byRuntimeNodeId: frozenLookup([...byRuntime.entries()])",
      "runtimeNodeIdsBySourceNodeId: freezeBuckets(sourceRuntimeIds)",
      "runtimeNodeIdsByBehaviorId: freezeBuckets(behaviorRuntimeIds)",
    ],
    "Diagnostic-index builder",
  );
  rejectFragments(
    Object.values(texts).join("\n"),
    ["componentDidCatch", "getDerivedStateFromError"],
    "M05-T05 production source",
  );

  const expectedCalls = [
    [inventories.reconciliation.calls.canonicalizeJson, 2, "RFC 8785 canonicalization"],
    [
      inventories.renderer.calls.createRuntimeReactReconciliationKey,
      2,
      "component/behavior reconciliation",
    ],
    [inventories.renderer.calls.buildRuntimeReactDiagnosticIndex, 1, "diagnostic-index build"],
    [inventories.interactions.calls.useLayoutEffect, 1, "commit-only interaction activation"],
    [inventories.sessionSurface.calls.useSyncExternalStore, 1, "React external store"],
    [inventories.sessionSurface.calls.readRuntimeHeadlessSession, 1, "session read"],
    [inventories.sessionSurface.calls.subscribeRuntimeHeadlessSession, 1, "session subscribe"],
    [inventories.sessionSurface.calls.unsubscribeRuntimeHeadlessSession, 1, "session unsubscribe"],
    [inventories.liveSurface.calls.useRuntimeReactSessionSurface, 1, "live session observation"],
    [inventories.liveSurface.calls.renderRuntimeReactSurface, 1, "live render compilation"],
  ];
  const invalidCall = expectedCalls.find(([actual, expected]) => actual !== expected);
  if (
    invalidCall !== undefined ||
    countMatches(texts.interactions, /key: input\.reconciliationKey/gu) !== 2
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The reviewed reconciliation, live-store, or commit call inventory changed.",
      {
        expectedCalls,
        reconciliationReactKeys: countMatches(
          texts.interactions,
          /key: input\.reconciliationKey/gu,
        ),
      },
    );
  }

  const renderFailureCodes = stringUnion(
    SOURCE_PATHS.renderer,
    texts.renderer,
    "RuntimeReactRenderFailureCode",
  );
  const diagnosticFailureReasons = stringUnion(
    SOURCE_PATHS.diagnosticIndex,
    texts.diagnosticIndex,
    "RuntimeReactDiagnosticIndexInvalidReason",
  );
  if (
    !isDeepStrictEqual(renderFailureCodes, EXPECTED_RENDER_FAILURE_CODES) ||
    !isDeepStrictEqual(diagnosticFailureReasons, EXPECTED_DIAGNOSTIC_FAILURE_REASONS)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The exact fail-closed renderer or diagnostic classification changed.",
    );
  }

  return Object.freeze({
    publicApi,
    productionImports: Object.freeze(productionImports),
    dynamicExecutableImports: 0,
    reconciliationCanonicalizationCalls: inventories.reconciliation.calls.canonicalizeJson,
    reconciliationKeyCallSites: inventories.renderer.calls.createRuntimeReactReconciliationKey,
    diagnosticIndexBuildCallSites: inventories.renderer.calls.buildRuntimeReactDiagnosticIndex,
    reactReconciliationKeyCallSites: 2,
    commitActivationCallSites: inventories.interactions.calls.useLayoutEffect,
    sessionStoreCalls: Object.freeze({
      useSyncExternalStore: inventories.sessionSurface.calls.useSyncExternalStore,
      read: inventories.sessionSurface.calls.readRuntimeHeadlessSession,
      subscribe: inventories.sessionSurface.calls.subscribeRuntimeHeadlessSession,
      unsubscribe: inventories.sessionSurface.calls.unsubscribeRuntimeHeadlessSession,
    }),
    liveSurfaceCalls: Object.freeze({
      observe: inventories.liveSurface.calls.useRuntimeReactSessionSurface,
      compile: inventories.liveSurface.calls.renderRuntimeReactSurface,
    }),
    renderFailureCodes,
    diagnosticFailureReasons,
  });
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT", `${label} is not valid deterministic JSON.`);
  }
}

function inspectPackageBoundary(files) {
  const runtimePackage = parseJson(files.get(RUNTIME_PACKAGE_PATH), RUNTIME_PACKAGE_PATH);
  const rootPackage = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const productionDependencies = sorted(Object.keys(runtimePackage.dependencies ?? {}));
  const peerDependencies = sorted(Object.keys(runtimePackage.peerDependencies ?? {}));
  const expectedProduction = ["@desen/protocol", "@desen/runtime-core", "@desen/validator"];
  if (
    runtimePackage.name !== "@desen/runtime-react" ||
    runtimePackage.private !== true ||
    runtimePackage.sideEffects !== false ||
    !isDeepStrictEqual(runtimePackage.files, ["dist"]) ||
    !isDeepStrictEqual(Object.keys(runtimePackage.exports ?? {}), ["."]) ||
    !isDeepStrictEqual(productionDependencies, expectedProduction) ||
    !isDeepStrictEqual(peerDependencies, ["react"]) ||
    runtimePackage.peerDependencies.react !== ">=19.0.0 <20.0.0" ||
    runtimePackage.dependencies["@desen/protocol"] !== "workspace:*" ||
    runtimePackage.devDependencies?.["@desen/protocol"] !== undefined
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The runtime-react production package boundary changed.",
      { productionDependencies, peerDependencies },
    );
  }
  for (const [name, command] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    if (rootPackage.scripts?.[name] !== command) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
        `Root script ${name} changed or is missing.`,
        { expected: command, actual: rootPackage.scripts?.[name] },
      );
    }
  }

  const lockText = files.get(LOCKFILE_PATH).toString("utf8");
  const lines = lockText.split(/\r?\n/u);
  const start = lines.indexOf("  packages/runtime-react:");
  const end = lines.findIndex((line, index) => index > start && /^ {2}[^ \r\n]/u.test(line));
  if (start < 0 || end < 0) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The runtime-react lockfile importer is missing or ambiguous.",
    );
  }
  const importer = lines.slice(start, end).join("\n");
  if (
    countMatches(importer, /'@desen\/protocol':/gu) !== 1 ||
    !importer.includes(
      "'@desen/protocol':\n        specifier: workspace:*\n        version: link:../protocol",
    ) ||
    importer.indexOf("'@desen/protocol':") > importer.indexOf("    devDependencies:")
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The lockfile no longer places @desen/protocol in runtime-react production dependencies.",
    );
  }
  return Object.freeze({
    package: "@desen/runtime-react",
    productionDependencies: Object.freeze(productionDependencies),
    peerDependencies: Object.freeze(peerDependencies),
    reactPeerRange: runtimePackage.peerDependencies.react,
    sideEffects: runtimePackage.sideEffects,
    publicSubpaths: Object.freeze(Object.keys(runtimePackage.exports)),
    rootScripts: EXPECTED_ROOT_SCRIPTS,
    protocolCanonicalizationDependency: "production",
    lockfileImporterVerified: true,
  });
}

function inspectTests(files) {
  const packageFiles = [];
  for (const specification of TEST_FILES) {
    const text = files.get(specification.path).toString("utf8");
    const registrations = countMatches(text, /^\s*it\(/gmu);
    if (registrations !== specification.registrations) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
        `Focused test inventory changed for ${specification.path}.`,
        { expected: specification.registrations, actual: registrations },
      );
    }
    packageFiles.push(Object.freeze({ path: specification.path, registrations }));
  }
  const typeFiles = [];
  for (const specification of TYPE_TEST_FILES) {
    const text = files.get(specification.path).toString("utf8");
    const negativeCases = countMatches(text, /@ts-expect-error/gu);
    if (negativeCases !== specification.negativeCases) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
        `Compiler-negative inventory changed for ${specification.path}.`,
        { expected: specification.negativeCases, actual: negativeCases },
      );
    }
    typeFiles.push(Object.freeze({ path: specification.path, negativeCases }));
  }
  const rootTest = files.get(ROOT_TEST_PATH).toString("utf8");
  const missingMutations = ROOT_MUTATION_CASES.filter((label) => !rootTest.includes(`"${label}"`));
  if (missingMutations.length !== 0) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_SOURCE_DRIFT",
      "The root mutation matrix no longer covers every reviewed invariant.",
      { missingMutations },
    );
  }
  return Object.freeze({
    packageFiles: Object.freeze(packageFiles),
    packageRegistrations: packageFiles.reduce((total, record) => total + record.registrations, 0),
    compilerFiles: Object.freeze(typeFiles),
    compilerNegativeCases: typeFiles.reduce((total, record) => total + record.negativeCases, 0),
    rootMutationCases: ROOT_MUTATION_CASES.length,
    focusedCommand: `pnpm --filter @desen/runtime-react exec vitest run ${FOCUSED_TEST_ARGUMENTS}`,
    typecheckCommand: "pnpm --filter @desen/runtime-react typecheck",
    rootCommand: `node --test ${ROOT_TEST_PATH}`,
  });
}

async function inspectPrerequisites(workspaceRoot, prerequisiteOverrides) {
  const records = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes =
      prerequisiteOverrides?.[prerequisite.key] ??
      (await readRegularBytes(
        path.join(workspaceRoot, prerequisite.path),
        "RECONCILIATION_DIAGNOSTICS_PREREQUISITE_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PREREQUISITE_UNSAFE",
        `${prerequisite.task} prerequisite`,
        MAX_WORKSPACE_FILE_BYTES,
      ));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== prerequisite.sha256) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite bytes changed.`,
        { expected: prerequisite.sha256, actual: actualSha256 },
      );
    }
    let artifact;
    try {
      artifact = JSON.parse(bytes.toString("utf8"));
    } catch {
      fail(
        "RECONCILIATION_DIAGNOSTICS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite is not valid JSON.`,
      );
    }
    if (
      artifact.schemaVersion !== 1 ||
      artifact.task !== prerequisite.task ||
      artifact.result !== "PASS" ||
      (prerequisite.profile !== undefined && artifact.profile !== prerequisite.profile) ||
      (artifact.target ?? artifact.claim?.target) !== prerequisite.target
    ) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite semantics changed.`,
      );
    }
    records.push(
      Object.freeze({
        task: prerequisite.task,
        path: prerequisite.path,
        sha256: `sha256:${prerequisite.sha256}`,
        ...(prerequisite.profile === undefined ? {} : { profile: prerequisite.profile }),
        target: prerequisite.target,
        result: "PASS",
      }),
    );
  }
  return Object.freeze(records);
}

function exactSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return Object.freeze({
    lines,
    start,
    section: lines.slice(start, end === -1 ? lines.length : end),
  });
}

function markdownRow(markdown, id, expectedCells, label) {
  const lines = markdown.split(/\r?\n/u);
  const rows = lines.filter((line) => line.startsWith(`| ${id} `));
  if (rows.length !== 1) {
    fail("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT", `Expected one exact ${id} row in ${label}.`);
  }
  const cells = rows[0]
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  if (cells.length !== expectedCells || cells[0] !== id) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      `${id} has an unexpected ${label} column shape.`,
    );
  }
  return Object.freeze({ line: rows[0], cells: Object.freeze(cells) });
}

function pinPattern(exactPath) {
  const escapedPath = exactPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedPending = PENDING_ARTIFACT_SHA256.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    "`" + escapedPath + "`[ \\t]+`sha256:([0-9a-f]{64}|" + escapedPending + ")`",
    "gu",
  );
}

function exactInlinePin(fragment, exactPath) {
  const matches = [...fragment.matchAll(pinPattern(exactPath))];
  if (matches.length !== 1) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      `Expected one exact inline ${exactPath} artifact pin.`,
    );
  }
  return Object.freeze({ value: matches[0][1] });
}

function sectionPin(markdown, heading, exactPath, placement) {
  const { section } = exactSection(markdown, heading);
  const pathLine = `\`${exactPath}\``;
  const pathIndexes = section.flatMap((line, index) => (line === pathLine ? [index] : []));
  const shaPattern = /^`sha256:([0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])`\.$/u;
  const shas = section.flatMap((line, index) => {
    const match = line.match(shaPattern);
    return match === null ? [] : [Object.freeze({ index, value: match[1] })];
  });
  const pathIndex = pathIndexes[0];
  const shaIndex = shas[0]?.index;
  const opening =
    placement === "opening" &&
    pathIndex === 2 &&
    shaIndex === 3 &&
    section[1] === "" &&
    section[4] === "";
  const terminal =
    placement === "terminal" &&
    pathIndex === section.length - 3 &&
    shaIndex === section.length - 2 &&
    section.at(-1) === "" &&
    section[pathIndex - 1] === "";
  if (
    pathIndexes.length !== 1 ||
    shas.length !== 1 ||
    shaIndex !== pathIndex + 1 ||
    (!opening && !terminal)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      `${heading} must contain one canonical adjacent ${exactPath} path/SHA pair.`,
    );
  }
  return Object.freeze({ value: shas[0].value });
}

function documentationPinInventory(proofText, matrixText, normativeText) {
  const proof = sectionPin(proofText, "## Evidence artifact", ARTIFACT_RELATIVE_PATH, "opening");
  const matrixSection = exactSection(matrixText, "## M05-T05");
  const matrix = sectionPin(matrixText, "## M05-T05", ARTIFACT_FILE_NAME, "terminal");
  const p16 = markdownRow(matrixText, "P-16", 8, "Proof Matrix");
  const n021 = markdownRow(normativeText, "N-021", 6, "Normative Coverage");
  const p16Pin = exactInlinePin(p16.cells[6], ARTIFACT_FILE_NAME);
  const n021Pin = exactInlinePin(n021.cells[5], ARTIFACT_RELATIVE_PATH);
  const sectionText = matrixSection.section.join("\n");
  if (
    p16.cells[3] !== "PARTIAL" ||
    !p16.cells[2].includes("M05-T05") ||
    n021.cells[4] !== "PLANNED" ||
    !n021.cells[3].includes("M05-T05") ||
    !/P-16 advances to `PARTIAL`/u.test(sectionText) ||
    !/N-021\s+remains `PLANNED`/u.test(sectionText)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      "The exact P-16/N-021 M05-T05 task-time status or owner drifted.",
    );
  }
  const values = Object.freeze([proof.value, matrix.value, p16Pin.value, n021Pin.value]);
  const combined = `${proofText}\n${matrixText}\n${normativeText}`;
  if (
    new Set(values).size !== 1 ||
    countMatches(combined, new RegExp(ARTIFACT_FILE_NAME.replaceAll(".", "\\."), "gu")) !== 4
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      "The M05-T05 artifact must have exactly four matching documentation references.",
      { values },
    );
  }
  return Object.freeze({ values, value: values[0] });
}

function normalizedDocumentation(relativePath, text) {
  if (
    relativePath !== PROOF_DOCUMENT_PATH &&
    relativePath !== PROOF_MATRIX_PATH &&
    relativePath !== NORMATIVE_COVERAGE_PATH
  ) {
    return Buffer.from(text, "utf8");
  }
  const separatePath =
    relativePath === PROOF_DOCUMENT_PATH
      ? `\`${ARTIFACT_RELATIVE_PATH}\``
      : relativePath === PROOF_MATRIX_PATH
        ? `\`${ARTIFACT_FILE_NAME}\``
        : undefined;
  const sourceLines = text.split(/\r?\n/u);
  const lines = sourceLines.map((line, index) => {
    const followsSeparatePath =
      separatePath !== undefined && index > 0 && sourceLines[index - 1] === separatePath;
    if (!line.includes(ARTIFACT_FILE_NAME) && !followsSeparatePath) return line;
    return line.replace(
      /sha256:(?:[0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])/gu,
      `sha256:${PENDING_ARTIFACT_SHA256}`,
    );
  });
  return Buffer.from(lines.join("\n"), "utf8");
}

function verifyDocumentation(proofText, matrixText, normativeText, artifactSha256, allowPending) {
  const inventory = documentationPinInventory(proofText, matrixText, normativeText);
  if (
    inventory.values.some(
      (value) => value !== artifactSha256 && !(allowPending && value === PENDING_ARTIFACT_SHA256),
    )
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      "Every exact M05-T05 documentation reference must pin the deterministic artifact SHA.",
      { expected: artifactSha256, actual: inventory.values },
    );
  }
  return inventory;
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const entries = await Promise.all(
    TRACKED_PATHS.map(async (relativePath) => [
      relativePath,
      await workspaceBytes(workspaceRoot, relativePath, overrides),
    ]),
  );
  return new Map(entries);
}

function trackedEvidence(files) {
  const records = [];
  for (const relativePath of sorted(new Set(TRACKED_PATHS))) {
    const original = files.get(relativePath);
    const selfPinned =
      relativePath === PROOF_DOCUMENT_PATH ||
      relativePath === PROOF_MATRIX_PATH ||
      relativePath === NORMATIVE_COVERAGE_PATH;
    const bytes = selfPinned
      ? normalizedDocumentation(relativePath, original.toString("utf8"))
      : original;
    records.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: prefixedSha256(bytes),
        ...(selfPinned ? { selfPinNormalizedTo: `sha256:${PENDING_ARTIFACT_SHA256}` } : {}),
      }),
    );
  }
  return Object.freeze(records);
}

async function artifactBytes(artifact) {
  const text = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  return Buffer.from(text, "utf8");
}

/**
 * Builds deterministic M05-T05 evidence from reviewed source, API, test, package, lock, docs, and
 * exact immutable prerequisite bytes.
 */
export async function buildRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "fileOverrides", "prerequisiteBytes"],
    "build options",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot") ?? WORKSPACE_ROOT;
  const fileOverrides = captureFileOverrides(options.fileOverrides);
  const prerequisiteBytes = capturePrerequisiteBytes(options.prerequisiteBytes);
  const [files, prerequisites] = await Promise.all([
    readTrackedFiles(workspaceRoot, fileOverrides),
    inspectPrerequisites(workspaceRoot, prerequisiteBytes),
  ]);
  const proofText = files.get(PROOF_DOCUMENT_PATH).toString("utf8");
  const matrixText = files.get(PROOF_MATRIX_PATH).toString("utf8");
  const normativeText = files.get(NORMATIVE_COVERAGE_PATH).toString("utf8");
  documentationPinInventory(proofText, matrixText, normativeText);

  const sources = inspectSources(files);
  const boundary = inspectPackageBoundary(files);
  const tests = inspectTests(files);
  const trackedFiles = trackedEvidence(files);
  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M05-T05",
    result: "PASS",
    profile: "desen-runtime-react-reconciliation-diagnostics-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites,
    claim: Object.freeze({
      liveSessionSubscriptionCommitOnly: true,
      stableSnapshotAndCompatibleAdapterReferences: true,
      reconciliationIdentityIncludesRuntimeNodeAndCapability: true,
      trustedRemountPolicyPresenceAware: true,
      rfc8785CanonicalRemountProjection: true,
      realComponentBehaviorAndRepeatReconciliation: true,
      boundedCallbackFreeImmutableDiagnosticIndex: true,
      staleManagedSurfaceRetainedOnFailure: false,
      unknownCapabilityOrRenderFallback: false,
      committedAdapterErrorBoundaryImplemented: false,
    }),
    reconciliation: Object.freeze({
      profile: "desen.runtime-react/reconciliation-key@0.1.0",
      identityFields: Object.freeze(["runtimeNodeId", "capabilityId"]),
      remountPolicyOwner: "trusted-static-adapter-registry",
      remountProjection: "selected-property-presence-and-rfc8785-value",
      missingAndPresentNullAreDistinct: true,
      ordinaryPropStyleAndSlotChangesPreserveInstance: true,
      capabilityChangeRemounts: true,
      behaviorPolicyParity: true,
      repeatReorderPreservesMaterializedRuntimeIdentity: true,
      sessionSwitchRemountsManagedRoot: true,
      canonicalizationCalls: sources.reconciliationCanonicalizationCalls,
      rendererKeyCallSites: sources.reconciliationKeyCallSites,
      reactKeyCallSites: sources.reactReconciliationKeyCallSites,
    }),
    liveSurface: Object.freeze({
      observation: "React.useSyncExternalStore",
      subscriptionAdmission: "commit-only",
      preCommitAuthority: false,
      serverRenderSubscriptionAuthority: false,
      abandonedSuspenseSubscriptionAuthority: false,
      exactSnapshotObjectPreserved: true,
      equalSnapshotWrapperReferencePreserved: true,
      postAdmissionReadClosesMissedUpdateRace: true,
      exactSubscriptionCleanup: true,
      oldSessionNoticeCanPublishAfterSwitch: false,
      previousSurfaceRetainedOnTerminalOrRenderFailure: false,
      sessionAndRegistryRootIsolation: "nested-weakly-keyed-stable-boundary-component",
      sourceCalls: sources.sessionStoreCalls,
      liveCalls: sources.liveSurfaceCalls,
    }),
    diagnostics: Object.freeze({
      limits: Object.freeze({
        maxBindings: 25_000,
        maxIdentifierOccurrences: 115_000,
        maxIdentifierCodeUnits: 4_194_304,
      }),
      forwardLookup: "runtimeNodeId-to-minimal-identity",
      inverseLookups: Object.freeze([
        "sourceNodeId-to-sorted-runtimeNodeIds",
        "behaviorId-to-sorted-runtimeNodeIds",
      ]),
      repeatedSourceIdentityOneToMany: true,
      nullPrototypeRecords: true,
      recursivelyImmutable: true,
      callbackFields: 0,
      propsStyleSlotsReactSessionCatalogRegistryFields: 0,
      partialIndexOnFailure: false,
      buildCallSites: sources.diagnosticIndexBuildCallSites,
      failureReasons: sources.diagnosticFailureReasons,
    }),
    publicApi: sources.publicApi,
    failureBoundary: Object.freeze({
      renderFailureCodes: sources.renderFailureCodes,
      unknownCapabilityPlaceholderGuessing: false,
      previousSurfaceFallback: false,
      committedAdapterExceptionContainment: false,
      committedAdapterExceptionContainmentOwner: "M05-T06",
    }),
    boundary,
    evidence: Object.freeze({
      tests,
      sourceImports: sources.productionImports,
      dynamicExecutableImports: sources.dynamicExecutableImports,
      trackedFiles,
      proofPinNormalization: Object.freeze({
        token: PENDING_ARTIFACT_SHA256,
        allowlistedDocuments: Object.freeze([
          PROOF_DOCUMENT_PATH,
          PROOF_MATRIX_PATH,
          NORMATIVE_COVERAGE_PATH,
        ]),
        exactReferenceCount: 4,
        productionVerifierAcceptsPending: false,
      }),
      traceability: Object.freeze({
        proofClaim: Object.freeze({
          id: "P-16",
          historicalStatus: "NOT_PROVEN",
          currentStatus: "PARTIAL",
        }),
        normative: Object.freeze({
          id: "N-021",
          historicalStatus: "PLANNED",
          currentStatus: "PLANNED",
          remainingOwner: "M06-T06",
        }),
        requirement: "R-104",
        selection: "stable-runtime-and-capability-key-with-trusted-remount-policy",
      }),
      verifierExecutionProfile: "static-source-api-package-and-focused-test-inventory",
    }),
    nonclaims: Object.freeze([
      "No committed React adapter exception boundary; M05-T06 owns containment.",
      "No fallback component, placeholder guessing, or unknown-capability substitution.",
      "No claim that N-021 is complete before publisher-side M06-T06 evidence.",
      "No independently built reference host or complete sign-in execution claim.",
      "No CSS, accessibility-preservation, iOS, Android, SwiftUI, or Compose renderer claim.",
    ]),
  });
  const bytes = await artifactBytes(artifact);
  return Object.freeze({
    artifact,
    artifactBytes: bytes,
    artifactSha256: sha256(bytes),
  });
}

function trackedDocumentRecord(built, relativePath) {
  return built.artifact.evidence.trackedFiles.find((record) => record.path === relativePath);
}

async function documentationTexts(options) {
  return Promise.all([
    options.proofDocumentText ??
      readRegularBytes(
        options.proofPath ?? DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        "M05-T05 proof document",
        MAX_PROOF_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    options.proofMatrixText ??
      readRegularBytes(
        options.proofMatrixPath ??
          DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_MATRIX_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        "M05-T05 Proof Matrix",
        MAX_LEDGER_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    options.normativeCoverageText ??
      readRegularBytes(
        options.normativeCoveragePath ??
          DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_NORMATIVE_COVERAGE_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        "M05-T05 Normative Coverage",
        MAX_LEDGER_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
}

function verifyTrackedDocumentation(built, texts) {
  for (const [relativePath, text] of [
    [PROOF_DOCUMENT_PATH, texts[0]],
    [PROOF_MATRIX_PATH, texts[1]],
    [NORMATIVE_COVERAGE_PATH, texts[2]],
  ]) {
    const record = trackedDocumentRecord(built, relativePath);
    const normalized = normalizedDocumentation(relativePath, text);
    if (
      record === undefined ||
      record.bytes !== normalized.length ||
      record.sha256 !== prefixedSha256(normalized)
    ) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
        `Verified ${relativePath} differs from the normalized tracked documentation bytes.`,
      );
    }
  }
}

/**
 * Rebuilds, byte-compares, and verifies every exact final M05-T05 proof, matrix, and normative pin.
 */
export async function verifyRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "normativeCoveragePath",
      "normativeCoverageText",
      "allowPendingArtifactReference",
      "buildOptions",
    ],
    "verify options",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH;
  const injectedArtifactBytes = captureBytes(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(
    options.proofDocumentText,
    "proofDocumentText",
    MAX_PROOF_DOCUMENT_BYTES,
  );
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(
    options.proofMatrixText,
    "proofMatrixText",
    MAX_LEDGER_BYTES,
  );
  const normativeCoveragePath = optionalString(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  const normativeCoverageText = optionalText(
    options.normativeCoverageText,
    "normativeCoverageText",
    MAX_LEDGER_BYTES,
  );
  const allowPending =
    optionalBoolean(options.allowPendingArtifactReference, "allowPendingArtifactReference") ??
    false;
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOptions(
          options.buildOptions,
          ["workspaceRoot", "fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence(buildOptions);
  const texts = await documentationTexts({
    proofPath,
    proofDocumentText,
    proofMatrixPath,
    proofMatrixText,
    normativeCoveragePath,
    normativeCoverageText,
  });
  verifyDocumentation(texts[0], texts[1], texts[2], built.artifactSha256, allowPending);
  verifyTrackedDocumentation(built, texts);

  const actualBytes =
    injectedArtifactBytes ??
    (await readRegularBytes(
      artifactPath,
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_MISSING",
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE",
      "M05-T05 artifact",
      MAX_WORKSPACE_FILE_BYTES,
    ));
  if (!actualBytes.equals(built.artifactBytes)) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_DRIFT",
      "Tracked M05-T05 artifact differs from its deterministic rebuild.",
      { expected: built.artifactSha256, actual: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    sourceDeclarations: built.artifact.publicApi.sourceDeclarations,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    packageTests: built.artifact.evidence.tests.packageRegistrations,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationCases: built.artifact.evidence.tests.rootMutationCases,
    p16Status: built.artifact.evidence.traceability.proofClaim.currentStatus,
    n021Status: built.artifact.evidence.traceability.normative.currentStatus,
    documentationPin: allowPending ? "pending-allowed-for-test" : "final",
  });
}

/** Atomically writes deterministic M05-T05 evidence after complete inspection. */
export async function writeRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "buildOptions", "beforeAtomicRename"],
    "write options",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH;
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOptions(
          options.buildOptions,
          ["workspaceRoot", "fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence(buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE",
      "Atomic M05-T05 artifact write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    packageTests: built.artifact.evidence.tests.packageRegistrations,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationCases: built.artifact.evidence.tests.rootMutationCases,
  });
}
