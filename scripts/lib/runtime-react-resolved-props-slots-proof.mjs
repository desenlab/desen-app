import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RESOLVED-PROPS-SLOTS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const RUNTIME_REACT_API_URL = new URL(
  "../../packages/runtime-react/dist/index.js",
  import.meta.url,
);
const RUNTIME_CORE_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const runtimeReactRequire = createRequire(
  new URL("../../packages/runtime-react/package.json", import.meta.url),
);
const { createElement } = runtimeReactRequire("react");
const { renderToStaticMarkup } = runtimeReactRequire("react-dom/server");

/** Absolute destination of the deterministic M05-T02 evidence artifact. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "executionContracts",
    task: "M02-T11",
    path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
    semantic: Object.freeze({
      result: "PASS",
      profile: "desen-execution-contract-validation-v1",
    }),
  }),
  Object.freeze({
    key: "g04AuditHardening",
    task: "M04-T17",
    gate: "G04",
    path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    sha256: "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
    semantic: Object.freeze({
      result: "PASS",
      profile: "desen-runtime-core-audit-hardening-v1",
    }),
  }),
  Object.freeze({
    key: "adapterRegistry",
    task: "M05-T01",
    path: "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json",
    sha256: "b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42",
    semantic: Object.freeze({
      result: "PASS",
      profile: "desen-runtime-react-adapter-registry-v1",
    }),
  }),
]);

const HISTORICAL_T01_INVENTORY = Object.freeze([
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

const EXPECTED_RUNTIME_REACT_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
]);
const EXPECTED_RUNTIME_REACT_TYPE_EXPORTS = Object.freeze([
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
  "RuntimeReactRenderFailureChannel",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
]);
const EXPECTED_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
  "DUPLICATE_RUNTIME_IDENTITY",
  "INVALID_BEHAVIOR_PROPS",
  "INVALID_BEHAVIOR_SLOTS",
  "INVALID_CATALOG_SET",
  "INVALID_COMPONENT_PROPS",
  "INVALID_COMPONENT_SLOTS",
  "INVALID_REGISTRY",
  "INVALID_SESSION",
  "INVALID_SESSION_SNAPSHOT",
  "JSON_DEPTH_LIMIT_EXCEEDED",
  "JSON_OCCURRENCE_LIMIT_EXCEEDED",
  "MALFORMED_RENDER_PLAN",
  "NODE_LIMIT_EXCEEDED",
  "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
  "SLOT_LIMIT_EXCEEDED",
  "STRING_LIMIT_EXCEEDED",
  "UNKNOWN_BEHAVIOR_CAPABILITY",
  "UNKNOWN_COMPONENT_CAPABILITY",
]);
const EXPECTED_RENDER_IMPORTS = Object.freeze([
  "./registry.js",
  "@desen/runtime-core",
  "@desen/validator",
  "react",
]);
const EXPECTED_PACKAGE_DEPENDENCIES = Object.freeze(["@desen/runtime-core", "@desen/validator"]);
const EXPECTED_PEER_DEPENDENCIES = Object.freeze(["react"]);
const EXPECTED_TEST_INVENTORY = Object.freeze({
  runtimeReactTests: 12,
  validatorTests: 20,
  runtimeCoreFileTests: 35,
  schemaEvaluatorTests: 37,
  compilerNegativeCases: 33,
  rootMutationTests: 14,
});

const RUNTIME_REACT_SOURCE_PATHS = Object.freeze([
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
]);

// These verifiers used to rebuild current validator source when checking immutable M02 receipts.
// M05-T02 changes the validator deliberately, so the successor owns their narrow historical mode:
// each path validates the reviewed task-time bytes and semantics instead of silently rewriting a
// past result from newer source. Keep this list explicit: a new historical migration must be
// consciously added to the successor receipt.
const COMPATIBILITY_PATHS = Object.freeze([
  "scripts/lib/runtime-react-adapter-registry-proof.mjs",
  "tests/runtime-react-adapter-registry.test.mjs",
  "scripts/lib/protocol-structural-validation-proof.mjs",
  "scripts/generate-protocol-structural-validation-proof.mjs",
  "tests/protocol-structural-validation.test.mjs",
  "scripts/lib/protocol-semantic-foundation-proof.mjs",
  "scripts/generate-protocol-semantic-foundation-proof.mjs",
  "tests/protocol-semantic-foundation.test.mjs",
  "scripts/lib/protocol-component-contracts-proof.mjs",
  "scripts/generate-protocol-component-contracts-proof.mjs",
  "tests/protocol-component-contracts.test.mjs",
  "scripts/lib/protocol-interaction-contracts-proof.mjs",
  "scripts/generate-protocol-interaction-contracts-proof.mjs",
  "tests/protocol-interaction-contracts.test.mjs",
  "scripts/lib/protocol-binding-contracts-proof.mjs",
  "scripts/generate-protocol-binding-contracts-proof.mjs",
  "tests/protocol-binding-contracts.test.mjs",
  "scripts/lib/protocol-execution-contracts-proof.mjs",
  "scripts/generate-protocol-execution-contracts-proof.mjs",
  "tests/protocol-execution-contracts.test.mjs",
  "scripts/lib/protocol-official-suite-parity-proof.mjs",
  "scripts/generate-protocol-official-suite-parity-proof.mjs",
  "tests/protocol-official-suite-parity.test.mjs",
  "scripts/lib/protocol-validator-diagnostic-micro-vectors-proof.mjs",
  "scripts/generate-protocol-validator-diagnostic-micro-vectors-proof.mjs",
  "tests/protocol-validator-diagnostic-micro-vectors.test.mjs",
  "scripts/lib/runtime-core-local-state-identity-proof.mjs",
  "scripts/generate-runtime-core-local-state-identity-proof.mjs",
  "tests/runtime-core-local-state-identity.test.mjs",
  "scripts/lib/runtime-core-headless-sign-in-proof.mjs",
  "scripts/generate-runtime-core-headless-sign-in-proof.mjs",
  "tests/runtime-core-headless-sign-in.test.mjs",
  "scripts/lib/runtime-core-audit-hardening-proof.mjs",
  "scripts/generate-runtime-core-audit-hardening-proof.mjs",
  "tests/runtime-core-audit-hardening.test.mjs",
]);

// Final task-owned inventory is intentionally explicit. The artifact, Proof Matrix, proof document,
// and mutable plan/coverage ledgers are excluded because they carry the final artifact pin. The
// proof implementation and its executable entry points carry no such pin and are therefore part of
// the reviewed bytes rather than an unauthenticated self-exemption.
const TRACKED_PATHS = Object.freeze([
  "dependency-cruiser.config.cjs",
  "docs/architecture/ARCHITECTURE.md",
  "package.json",
  "packages/runtime-core/src/headless-session.ts",
  "packages/runtime-core/src/index.ts",
  "packages/runtime-core/test/headless-session.test.ts",
  "packages/runtime-core/test/headless-session.types.ts",
  "packages/runtime-core/dist/headless-session.js",
  "packages/runtime-core/dist/headless-session.js.map",
  "packages/runtime-core/dist/headless-session.d.ts",
  "packages/runtime-core/dist/headless-session.d.ts.map",
  "packages/runtime-core/dist/index.js",
  "packages/runtime-core/dist/index.js.map",
  "packages/runtime-core/dist/index.d.ts",
  "packages/runtime-core/dist/index.d.ts.map",
  "packages/runtime-react/README.md",
  "packages/runtime-react/package.json",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/test/adapter-registry.test.tsx",
  "packages/runtime-react/test/adapter-registry.types.ts",
  "packages/runtime-react/test/resolved-props-slots.test.tsx",
  "packages/runtime-react/test/resolved-props-slots.types.ts",
  "packages/runtime-react/test/session-fixture.ts",
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
  "packages/validator/README.md",
  "packages/validator/package.json",
  "packages/validator/src/execution-contract-validation.ts",
  "packages/validator/src/index.ts",
  "packages/validator/src/schema-instance-validation.ts",
  "packages/validator/src/semantic-diagnostics.ts",
  "packages/validator/test/resolved-adapter-contracts.test.ts",
  "packages/validator/test/resolved-adapter-contracts.types.ts",
  "packages/validator/test/schema-instance-validation.test.ts",
  "packages/validator/dist/execution-contract-validation.js",
  "packages/validator/dist/execution-contract-validation.js.map",
  "packages/validator/dist/execution-contract-validation.d.ts",
  "packages/validator/dist/execution-contract-validation.d.ts.map",
  "packages/validator/dist/index.js",
  "packages/validator/dist/index.js.map",
  "packages/validator/dist/index.d.ts",
  "packages/validator/dist/index.d.ts.map",
  "packages/validator/dist/schema-instance-validation.js",
  "packages/validator/dist/schema-instance-validation.js.map",
  "packages/validator/dist/schema-instance-validation.d.ts",
  "packages/validator/dist/schema-instance-validation.d.ts.map",
  "packages/validator/dist/semantic-diagnostics.js",
  "packages/validator/dist/semantic-diagnostics.js.map",
  "packages/validator/dist/semantic-diagnostics.d.ts",
  "packages/validator/dist/semantic-diagnostics.d.ts.map",
  "pnpm-lock.yaml",
  "scripts/generate-runtime-react-resolved-props-slots-proof.mjs",
  "scripts/lib/runtime-react-resolved-props-slots-proof.mjs",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "scripts/verify-runtime-react-resolved-props-slots.mjs",
  "scripts/verify-boundary-fixtures.mjs",
  "tests/boundaries/fixtures/allowed-runtime-react-validator/packages/runtime-react/src/index.ts",
  "tests/boundaries/fixtures/allowed-runtime-react-validator/packages/validator/src/index.ts",
  "tests/boundaries/fixtures/validator-imports-runtime-react/packages/runtime-react/src/index.ts",
  "tests/boundaries/fixtures/validator-imports-runtime-react/packages/validator/src/index.ts",
  "tests/runtime-react-resolved-props-slots.test.mjs",
  ...COMPATIBILITY_PATHS,
]);

const FORBIDDEN_PRODUCTION_IDENTIFIERS = new Set([
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

/** Controlled deterministic M05-T02 evidence failure. */
export class RuntimeReactResolvedPropsSlotsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactResolvedPropsSlotsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactResolvedPropsSlotsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sorted(values) {
  return [...values].sort();
}

function sameStrings(actual, expected) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function normalizeOptions(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("RESOLVED_PROPS_SLOTS_OPTIONS_INVALID", "M05-T02 evidence options must be an object.");
  }
  return value;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? Buffer.from(override) : Buffer.from(String(override));
  }
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACKED_FILE_MISSING",
      `Evidence file is missing: ${relativePath}.`,
      {
        cause: String(error),
      },
    );
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACKED_FILE_UNSAFE",
      `Evidence input must be a regular non-symlink file: ${relativePath}.`,
    );
  }
  return readFile(absolutePath);
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function parseTypeScript(relativePath, sourceText) {
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (source.parseDiagnostics.length !== 0) {
    fail("RESOLVED_PROPS_SLOTS_SOURCE_PARSE_DRIFT", `Cannot parse ${relativePath}.`, {
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
          "RESOLVED_PROPS_SLOTS_EXPORT_DRIFT",
          "Exported destructuring declarations are outside the audited public surface.",
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

function inspectSourceDocumentation(sourceEntries) {
  const declarations = [];
  const missing = [];
  for (const [relativePath, sourceText] of sourceEntries) {
    const source = parseTypeScript(relativePath, sourceText);
    for (const statement of source.statements) {
      if (!hasExportModifier(statement)) continue;
      const names = declarationNames(statement);
      if (names.length === 0) {
        fail(
          "RESOLVED_PROPS_SLOTS_EXPORT_DRIFT",
          `Unsupported exported declaration in ${relativePath}.`,
        );
      }
      declarations.push(...names);
      if (!hasTsdoc(sourceText, statement)) missing.push(...names);
    }
  }
  if (missing.length !== 0) {
    fail(
      "RESOLVED_PROPS_SLOTS_TSDOC_DRIFT",
      "Every task-owned exported runtime-react declaration requires TSDoc.",
      { declarations: sorted(missing) },
    );
  }
  return Object.freeze({
    sourceDeclarations: sorted(declarations),
    tsdocDeclarations: declarations.length,
  });
}

function exportKind(statement, specifier) {
  return statement.isTypeOnly || specifier?.isTypeOnly ? "type" : "runtime";
}

function inspectExplicitRootExports(relativePath, sourceText) {
  const source = parseTypeScript(relativePath, sourceText);
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) {
      if (hasExportModifier(statement)) {
        fail(
          "RESOLVED_PROPS_SLOTS_EXPORT_DRIFT",
          `Root declarations are forbidden in ${relativePath}.`,
        );
      }
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      fail(
        "RESOLVED_PROPS_SLOTS_EXPORT_DRIFT",
        `Only explicit named module exports are allowed in ${relativePath}.`,
      );
    }
    for (const specifier of statement.exportClause.elements) {
      (exportKind(statement, specifier) === "type" ? types : runtime).push(specifier.name.text);
    }
  }
  const result = Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
  if (
    !sameStrings(result.runtime, EXPECTED_RUNTIME_REACT_RUNTIME_EXPORTS) ||
    !sameStrings(result.types, EXPECTED_RUNTIME_REACT_TYPE_EXPORTS)
  ) {
    fail("RESOLVED_PROPS_SLOTS_EXPORT_DRIFT", `${relativePath} public exports changed.`, {
      expectedRuntime: EXPECTED_RUNTIME_REACT_RUNTIME_EXPORTS,
      actualRuntime: result.runtime,
      expectedTypes: EXPECTED_RUNTIME_REACT_TYPE_EXPORTS,
      actualTypes: result.types,
    });
  }
  return result;
}

function readStringUnion(source, name) {
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== name) continue;
    if (!ts.isUnionTypeNode(statement.type)) {
      fail("RESOLVED_PROPS_SLOTS_EXPORT_DRIFT", `${name} must remain a literal union.`);
    }
    return sorted(
      statement.type.types.map((node) => {
        if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) {
          fail("RESOLVED_PROPS_SLOTS_EXPORT_DRIFT", `${name} contains a non-string member.`);
        }
        return node.literal.text;
      }),
    );
  }
  fail("RESOLVED_PROPS_SLOTS_EXPORT_DRIFT", `Missing ${name}.`);
}

function inspectProductionBoundary(sourceEntries) {
  const modules = new Set();
  const forbidden = new Set();
  for (const [relativePath, sourceText] of sourceEntries) {
    const source = parseTypeScript(relativePath, sourceText);
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        if (!ts.isStringLiteral(node.moduleSpecifier)) {
          fail("RESOLVED_PROPS_SLOTS_IMPORT_DRIFT", "Computed imports are forbidden.");
        }
        modules.add(node.moduleSpecifier.text);
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && ["require", "eval"].includes(node.expression.text)))
      ) {
        forbidden.add("dynamic-executable-loading");
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Function"
      ) {
        forbidden.add("Function");
      }
      if (ts.isIdentifier(node) && FORBIDDEN_PRODUCTION_IDENTIFIERS.has(node.text)) {
        forbidden.add(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (
      /(?:React\.(?:Children|cloneElement|isValidElement)|\._owner\b|\.props\.children\b|__react)/u.test(
        sourceText,
      )
    ) {
      forbidden.add(`private-react:${relativePath}`);
    }
  }
  const actualModules = sorted(modules);
  if (!sameStrings(actualModules, EXPECTED_RENDER_IMPORTS) || forbidden.size !== 0) {
    fail(
      forbidden.size === 0
        ? "RESOLVED_PROPS_SLOTS_IMPORT_DRIFT"
        : "RESOLVED_PROPS_SLOTS_PRIVATE_STRUCTURE_DRIFT",
      "Production React receiving boundary or authority inventory changed.",
      {
        expectedModules: EXPECTED_RENDER_IMPORTS,
        actualModules,
        forbidden: sorted(forbidden),
      },
    );
  }
  return Object.freeze({
    modules: actualModules,
    browserDomNativeAuthorities: 0,
    dynamicExecutableLoading: 0,
    privateReactInspection: 0,
  });
}

function requireAnchors(sourceText, anchors, code, label) {
  const missing = anchors.filter((anchor) => !sourceText.includes(anchor));
  if (missing.length !== 0) {
    fail(code, `${label} lost reviewed receiving-boundary anchors.`, { missing });
  }
}

function forbidAnchors(sourceText, anchors, code, label) {
  const found = anchors.filter((anchor) => sourceText.includes(anchor));
  if (found.length !== 0) {
    fail(code, `${label} contains a forbidden bypass or leakage anchor.`, { found });
  }
}

function inspectReceivingImplementation({
  renderSource,
  registrySource,
  validatorSource,
  schemaSource,
  sessionSource,
}) {
  requireAnchors(
    renderSource,
    [
      '["registry", "session", "snapshot", "catalogSet"]',
      "authenticateRuntimeHeadlessSessionAdapterAuthority(",
      "snapshot: captured.snapshot as RuntimeHeadlessSessionSnapshot,",
      "catalogSet: captured.catalogSet as DesenValidatedExecutionCatalogSet,",
      "createDesenResolvedAdapterValidationScope(",
      "const plan = authenticatedPlan(authenticated.snapshot);",
      "validateDesenResolvedAdapterProps(",
      "validateDesenResolvedAdapterSlots(",
      '"INVALID_COMPONENT_PROPS"',
      '"INVALID_BEHAVIOR_PROPS"',
      '"INVALID_COMPONENT_SLOTS"',
      '"INVALID_BEHAVIOR_SLOTS"',
      "channel,\n      diagnostics,",
      "slots: renderSlots(node.slots)",
      "slots: renderSlots(behavior.slots)",
    ],
    "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    "runtime-react renderer",
  );
  forbidAnchors(
    renderSource,
    [
      "readonly plan:",
      "captured.plan",
      "props.behaviors",
      "behaviors: node.behaviors",
      "dangerouslySetInnerHTML",
      "props.children",
      "React.Children",
      "cloneElement",
      "_owner",
      "fallbackComponent",
      "placeholder",
    ],
    "RESOLVED_PROPS_SLOTS_RENDERER_BYPASS",
    "runtime-react renderer",
  );
  requireAnchors(
    registrySource,
    [
      "export interface RuntimeReactComponentAdapterProps",
      "readonly props: RuntimeJsonObject;",
      "readonly slots: RuntimeReactNamedSlots;",
      "readonly style: RuntimeReactSemanticStyle;",
      "readonly interactions: RuntimeReactInteractionPort;",
    ],
    "RESOLVED_PROPS_SLOTS_ADAPTER_LEAK",
    "component adapter contract",
  );
  const componentContract =
    registrySource.match(
      /export interface RuntimeReactComponentAdapterProps\s*\{(?<body>[\s\S]*?)^\}/mu,
    )?.groups?.body ?? "";
  if (
    componentContract.length === 0 ||
    /\bbehaviors\b/u.test(componentContract) ||
    /\bplan\b/u.test(componentContract) ||
    /\belement\b/u.test(componentContract)
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_ADAPTER_LEAK",
      "Component adapters must not observe behavior plans, raw plans, or platform elements.",
    );
  }
  requireAnchors(
    validatorSource,
    [
      "const RESOLVED_ADAPTER_VALIDATION_SCOPES = new WeakMap",
      "schemaBudget: createSchemaContractEvaluationBudget(",
      "applyPreparedSchemaContract(",
      "authority.schemaBudget",
      "authority.remaining[counter] -= 1;",
      "authority.remaining.slotEntries -=",
      "authority.remaining.slotContractEvaluationSteps -=",
      "authority.remaining.slotStringCodeUnits -=",
      "preparedSlotContracts: slotContracts",
      "maxSlotContractEvaluationSteps",
      "export function validateDesenResolvedAdapterProps(",
      "export function validateDesenResolvedAdapterSlots(",
    ],
    "RESOLVED_PROPS_SLOTS_VALIDATOR_BYPASS",
    "resolved-adapter validator",
  );
  forbidAnchors(
    validatorSource,
    ["validateDesenResolvedAdapterPropsLegacy", "catalogSetOrScope", "scope ?? catalog"],
    "RESOLVED_PROPS_SLOTS_VALIDATOR_BYPASS",
    "resolved-adapter validator",
  );
  requireAnchors(
    schemaSource,
    [
      "export function createSchemaContractEvaluationBudget(",
      "export function applyPreparedSchemaContract(",
      "function consumeEvaluationWork(",
      "const aggregateRemaining =",
      "state.aggregateBudget.maxEvaluationSteps - state.aggregateBudget.evaluationSteps;",
      "state.aggregateBudget.evaluationSteps += work;",
      "evaluationBudgetExhausted(state)",
    ],
    "RESOLVED_PROPS_SLOTS_SHARED_BUDGET_DRIFT",
    "shared prepared-schema evaluator",
  );
  requireAnchors(
    sessionSource,
    [
      "export function authenticateRuntimeHeadlessSessionAdapterAuthority(",
      "readonly catalogSet: DesenValidatedExecutionCatalogSet;",
      "catalogSet: catalogs.value,",
      "captured.snapshot !== currentSnapshot",
      "captured.catalogSet !== current.retainedGraph.catalogSet",
      'return Object.freeze({ status: "authenticated", snapshot: currentSnapshot });',
    ],
    "RESOLVED_PROPS_SLOTS_SESSION_AUTHORITY_DRIFT",
    "runtime-core adapter authority",
  );
  return Object.freeze({
    rawPlanInput: false,
    exactSessionSnapshotAuthority: true,
    exactCatalogSetAuthority: true,
    rawMountReturnsExactCatalogSetAuthority: true,
    componentPropsValidated: true,
    behaviorPropsValidated: true,
    namedSlotsValidated: true,
    sharedReceivingScopePerRender: true,
    sharedPreparedSchemaBudget: true,
    actualSchemaWorkBudgeted: true,
    preparedSlotContractsBudgeted: true,
    rawBehaviorPlanVisibleToComponent: false,
    fallbackSlotGuessing: false,
  });
}

function inspectPackageAndArchitecture({
  packageText,
  architectureText,
  dependencyCruiserText,
  boundaryFixtureText,
}) {
  let manifest;
  try {
    manifest = JSON.parse(packageText);
  } catch {
    fail("RESOLVED_PROPS_SLOTS_PACKAGE_DRIFT", "runtime-react package manifest is invalid JSON.");
  }
  const actualDependencies = sorted(Object.keys(manifest.dependencies ?? {}));
  const actualPeerDependencies = sorted(Object.keys(manifest.peerDependencies ?? {}));
  if (
    manifest.name !== "@desen/runtime-react" ||
    manifest.private !== true ||
    manifest.sideEffects !== false ||
    !sameStrings(actualDependencies, EXPECTED_PACKAGE_DEPENDENCIES) ||
    !sameStrings(actualPeerDependencies, EXPECTED_PEER_DEPENDENCIES) ||
    manifest.scripts?.["test:resolved-props-slots"] !==
      "vitest run test/resolved-props-slots.test.tsx"
  ) {
    fail("RESOLVED_PROPS_SLOTS_PACKAGE_DRIFT", "runtime-react package boundary changed.", {
      actualDependencies,
      actualPeerDependencies,
    });
  }
  requireAnchors(
    architectureText,
    [
      "| `runtime-react`         | `protocol`, `validator`, `runtime-core`",
      "| `validator`             | `protocol`",
    ],
    "RESOLVED_PROPS_SLOTS_ARCHITECTURE_DRIFT",
    "architecture document",
  );
  requireAnchors(
    dependencyCruiserText,
    ['"runtime-react": ["protocol", "validator", "runtime-core"]', 'validator: ["protocol"]'],
    "RESOLVED_PROPS_SLOTS_ARCHITECTURE_DRIFT",
    "dependency-cruiser policy",
  );
  requireAnchors(
    boundaryFixtureText,
    [
      '"allowed-runtime-react-validator"',
      '"validator-imports-runtime-react"',
      '"package-validator-allowed-dependencies"',
    ],
    "RESOLVED_PROPS_SLOTS_ARCHITECTURE_DRIFT",
    "boundary-fixture verifier",
  );
  return Object.freeze({
    package: manifest.name,
    productionDependencies: actualDependencies,
    peerDependencies: actualPeerDependencies,
    validatorDependencyExplicitlyAllowed: true,
    reverseValidatorDependencyRejected: true,
  });
}

function directCallName(call) {
  return ts.isIdentifier(call.expression) ? call.expression.text : undefined;
}

function staticTestTitle(call) {
  const first = call.arguments[0];
  return first !== undefined && ts.isStringLiteral(first) ? first.text : undefined;
}

function inspectDirectUniqueTests(relativePath, sourceText, callNames) {
  const source = parseTypeScript(relativePath, sourceText);
  const titles = [];
  let invalid = false;
  const visit = (node) => {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      callNames.includes(node.expression.expression.text)
    ) {
      invalid = true;
    }
    const name = directCallName(node);
    if (name !== undefined && callNames.includes(name)) {
      const title = staticTestTitle(node);
      const expression = node.parent;
      const direct =
        ts.isExpressionStatement(expression) &&
        (ts.isSourceFile(expression.parent) ||
          (ts.isBlock(expression.parent) &&
            (ts.isArrowFunction(expression.parent.parent) ||
              ts.isFunctionExpression(expression.parent.parent))));
      if (!direct || title === undefined) invalid = true;
      else titles.push(title);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (invalid || new Set(titles).size !== titles.length) {
    fail(
      "RESOLVED_PROPS_SLOTS_TEST_INVENTORY_DRIFT",
      `Only direct, non-skipped, uniquely named tests count in ${relativePath}.`,
      { titles, invalid },
    );
  }
  return Object.freeze(titles);
}

function compilerMarkerCount(relativePath, sourceText) {
  if (/@ts-ignore/gu.test(sourceText)) {
    fail(
      "RESOLVED_PROPS_SLOTS_TEST_INVENTORY_DRIFT",
      `Unchecked @ts-ignore is forbidden in ${relativePath}.`,
    );
  }
  return (sourceText.match(/@ts-expect-error/gu) ?? []).length;
}

function inspectTestInventory(files) {
  const runtimeReactTests = inspectDirectUniqueTests(
    "packages/runtime-react/test/resolved-props-slots.test.tsx",
    files.runtimeReactTests,
    ["it"],
  );
  const validatorTests = inspectDirectUniqueTests(
    "packages/validator/test/resolved-adapter-contracts.test.ts",
    files.validatorTests,
    ["it"],
  );
  const coreTests = inspectDirectUniqueTests(
    "packages/runtime-core/test/headless-session.test.ts",
    files.coreTests,
    ["it"],
  );
  const schemaTests = inspectDirectUniqueTests(
    "packages/validator/test/schema-instance-validation.test.ts",
    files.schemaTests,
    ["it"],
  );
  const rootTests = inspectDirectUniqueTests(
    "tests/runtime-react-resolved-props-slots.test.mjs",
    files.rootTests,
    ["test"],
  );
  const requiredCoreTitles = [
    "returns the exact retained Catalog authority for raw and prevalidated mount ingress",
    "authenticates only the retained Catalog set and returns no lower authority",
    "rejects stale, reconstructed, and foreign identities with deterministic precedence",
    "rejects hostile envelopes without invoking accessors or leaking reflection failures",
    "short-circuits disposed and forged handles before reflecting over caller input",
    "rechecks authority after Proxy reflection disposes or republishes the session",
  ];
  for (const title of requiredCoreTitles) {
    if (!coreTests.includes(title)) {
      fail(
        "RESOLVED_PROPS_SLOTS_TEST_INVENTORY_DRIFT",
        `Required exact session-authority test is missing: ${title}.`,
      );
    }
  }
  const compilerNegativeCases = [
    compilerMarkerCount(
      "packages/runtime-react/test/adapter-registry.types.ts",
      files.adapterTypes,
    ),
    compilerMarkerCount(
      "packages/runtime-react/test/resolved-props-slots.types.ts",
      files.runtimeReactTypes,
    ),
    compilerMarkerCount(
      "packages/validator/test/resolved-adapter-contracts.types.ts",
      files.validatorTypes,
    ),
    compilerMarkerCount("packages/runtime-core/test/headless-session.types.ts", files.coreTypes),
  ].reduce((total, count) => total + count, 0);
  const actualInventory = {
    runtimeReactTests: runtimeReactTests.length,
    validatorTests: validatorTests.length,
    runtimeCoreFileTests: coreTests.length,
    schemaEvaluatorTests: schemaTests.length,
    compilerNegativeCases,
    rootMutationTests: rootTests.length,
  };
  if (!isDeepStrictEqual(actualInventory, EXPECTED_TEST_INVENTORY)) {
    fail(
      "RESOLVED_PROPS_SLOTS_TEST_INVENTORY_DRIFT",
      "M05-T02 direct focused-test or compiler-negative inventory changed.",
      { expected: EXPECTED_TEST_INVENTORY, actual: actualInventory },
    );
  }
  return Object.freeze({
    runtimeReactTests: actualInventory.runtimeReactTests,
    validatorTests: actualInventory.validatorTests,
    runtimeCoreTests: requiredCoreTitles.length,
    runtimeCoreFileTests: actualInventory.runtimeCoreFileTests,
    schemaEvaluatorTests: actualInventory.schemaEvaluatorTests,
    compilerNegativeCases: actualInventory.compilerNegativeCases,
    rootMutationTests: actualInventory.rootMutationTests,
    directUniqueNonSkipped: true,
  });
}

async function inspectPrerequisite(definition, overrideBytes, fileOverrides) {
  const bytes =
    overrideBytes === undefined
      ? await readWorkspaceBytes(definition.path, fileOverrides)
      : Buffer.from(overrideBytes);
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== definition.sha256) {
    fail(
      "RESOLVED_PROPS_SLOTS_PREREQUISITE_DRIFT",
      `Prerequisite ${definition.task} artifact bytes changed.`,
      { expected: definition.sha256, actual: actualSha256 },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "RESOLVED_PROPS_SLOTS_PREREQUISITE_DRIFT",
      `Prerequisite ${definition.task} is invalid JSON.`,
    );
  }
  if (
    artifact.task !== definition.task ||
    (definition.gate !== undefined && artifact.gate !== definition.gate) ||
    artifact.result !== definition.semantic.result ||
    artifact.profile !== definition.semantic.profile
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_PREREQUISITE_DRIFT",
      `Prerequisite ${definition.task} semantic identity changed.`,
    );
  }
  if (definition.task === "M05-T01") {
    const paths = artifact.evidence?.trackedFiles?.map((entry) => entry.path);
    if (
      !sameStrings(paths ?? [], HISTORICAL_T01_INVENTORY) ||
      artifact.publicApi?.runtimeExports?.length !== 5 ||
      artifact.publicApi?.typeExports?.length !== 28 ||
      artifact.evidence?.packageTests !== 10 ||
      artifact.evidence?.compilerNegativeCases !== 4 ||
      artifact.evidence?.rootMutationTests !== 11 ||
      artifact.renderer?.failureCodes?.length !== 12
    ) {
      fail(
        "RESOLVED_PROPS_SLOTS_HISTORICAL_COMPATIBILITY_DRIFT",
        "Immutable M05-T01 semantics or exact task-time inventory changed.",
      );
    }
  }
  return Object.freeze({
    task: definition.task,
    ...(definition.gate === undefined ? {} : { gate: definition.gate }),
    path: definition.path,
    sha256: definition.sha256,
    profile: definition.semantic.profile,
    result: definition.semantic.result,
  });
}

function historicalOwnerForCompatibilityPath(relativePath) {
  if (relativePath.includes("runtime-react-adapter-registry")) return "M05-T01";
  if (relativePath.includes("structural-validation")) return "M02-T06";
  if (relativePath.includes("semantic-foundation")) return "M02-T07";
  if (relativePath.includes("component-contracts")) return "M02-T08";
  if (relativePath.includes("interaction-contracts")) return "M02-T09";
  if (relativePath.includes("binding-contracts")) return "M02-T10";
  if (relativePath.includes("execution-contracts")) return "M02-T11";
  if (relativePath.includes("official-suite-parity")) return "M02-T12";
  if (relativePath.includes("validator-diagnostic-micro-vectors")) return "M02-T13";
  if (relativePath.includes("runtime-core-local-state-identity")) return "M04-T06";
  if (relativePath.includes("runtime-core-headless-sign-in")) return "M04-T16";
  if (relativePath.includes("runtime-core-audit-hardening")) return "M04-T17";
  fail(
    "RESOLVED_PROPS_SLOTS_HISTORICAL_COMPATIBILITY_DRIFT",
    `Compatibility path does not have one explicit historical owner: ${relativePath}.`,
  );
}

async function inspectHistoricalCompatibility(fileOverrides) {
  const transferredOwnership = [];
  for (const relativePath of COMPATIBILITY_PATHS) {
    const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
    transferredOwnership.push(
      Object.freeze({
        historicalOwnerTask: historicalOwnerForCompatibilityPath(relativePath),
        currentOwnerTask: "M05-T02",
        path: relativePath,
        sha256: sha256(bytes),
      }),
    );
  }
  const t01 = JSON.parse(
    (
      await readWorkspaceBytes(
        "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json",
        fileOverrides,
      )
    ).toString("utf8"),
  );
  const taskTime = new Map(t01.evidence.trackedFiles.map((entry) => [entry.path, entry.sha256]));
  const overlappingChangedPaths = [];
  for (const relativePath of HISTORICAL_T01_INVENTORY) {
    if (
      relativePath.startsWith("scripts/") ||
      relativePath.startsWith("tests/runtime-react-adapter-registry")
    ) {
      continue;
    }
    const current = await readWorkspaceBytes(relativePath, fileOverrides);
    const currentSha256 = sha256(current);
    if (currentSha256 !== taskTime.get(relativePath)) {
      overlappingChangedPaths.push(
        Object.freeze({
          historicalOwnerTask: "M05-T01",
          currentOwnerTask: "M05-T02",
          path: relativePath,
          taskTimeSha256: taskTime.get(relativePath),
          currentSha256,
        }),
      );
    }
  }
  return Object.freeze({
    immutableTaskTimeArtifact: "b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42",
    historicalInventoryFiles: HISTORICAL_T01_INVENTORY.length,
    compatibilityMode: "immutable-task-time-artifact",
    migratedHistoricalTasks: Object.freeze([
      "M02-T06",
      "M02-T07",
      "M02-T08",
      "M02-T09",
      "M02-T10",
      "M02-T11",
      "M02-T12",
      "M02-T13",
      "M04-T06",
      "M04-T16",
      "M04-T17",
      "M05-T01",
    ]),
    transferredOwnership: Object.freeze(transferredOwnership),
    overlappingChangedPaths: Object.freeze(overlappingChangedPaths),
  });
}

async function trackedFiles(fileOverrides) {
  if (new Set(TRACKED_PATHS).size !== TRACKED_PATHS.length) {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACKED_FILE_DUPLICATE",
      "M05-T02 tracked evidence paths must be unique.",
    );
  }
  return Object.freeze(
    await Promise.all(
      TRACKED_PATHS.map(async (relativePath) => {
        const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
        return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
      }),
    ),
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertExactKeys(value, expected, label) {
  assert.ok(value !== null && typeof value === "object", `${label} must be an object`);
  assert.deepEqual(Object.getOwnPropertyNames(value).sort(), sorted(expected), `${label} keys`);
  assert.deepEqual(Object.getOwnPropertySymbols(value), [], `${label} symbols`);
}

async function loadFixtureJson(relativePath) {
  return JSON.parse(await readWorkspaceText(relativePath));
}

function inertHostPorts(runtimeCore, context, environment) {
  return runtimeCore.createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: (request) => ({
        status: "committed",
        record: {
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        },
      }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze(context),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze(environment),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}

async function createFixture(apis, options = {}) {
  const catalog = cloneJson(
    await loadFixtureJson(
      "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
    ),
  );
  const bundle = cloneJson(
    await loadFixtureJson(
      "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json",
    ),
  );
  options.mutateCatalog?.(catalog);
  options.mutateBundle?.(bundle);
  bundle.revision = apis.protocol.calculateDesenBundleRevision(bundle);
  const catalogs = apis.validator.validateDesenExecutionCatalogSet([catalog]);
  assert.equal(catalogs.valid, true, `Catalog fixture failed: ${JSON.stringify(catalogs)}`);
  const mounted = apis.runtimeCore.mountRuntimeHeadlessSession({
    bundle,
    catalogs: catalogs.value,
    hostPorts: inertHostPorts(
      apis.runtimeCore,
      options.context ?? {},
      options.environment ?? { platform: "web" },
    ),
  });
  assert.equal(mounted.status, "mounted", `Session fixture failed: ${JSON.stringify(mounted)}`);
  return Object.freeze({
    session: mounted.handle,
    snapshot: mounted.snapshot,
    catalogSet: catalogs.value,
  });
}

async function inspectRuntimeApi(runtimeApisOption) {
  const apis =
    runtimeApisOption ??
    Object.freeze({
      runtimeReact: await import(RUNTIME_REACT_API_URL.href),
      runtimeCore: await import(RUNTIME_CORE_API_URL.href),
      validator: await import(VALIDATOR_API_URL.href),
      protocol: await import(PROTOCOL_API_URL.href),
    });
  const actualRuntimeExports = sorted(Object.keys(apis.runtimeReact));
  if (!sameStrings(actualRuntimeExports, EXPECTED_RUNTIME_REACT_RUNTIME_EXPORTS)) {
    fail(
      "RESOLVED_PROPS_SLOTS_RUNTIME_EXPORT_DRIFT",
      "Built runtime-react export surface changed.",
      { expected: EXPECTED_RUNTIME_REACT_RUNTIME_EXPORTS, actual: actualRuntimeExports },
    );
  }

  const calls = [];
  const observations = [];
  function component(name, tag) {
    return (props) => {
      assertExactKeys(
        props,
        ["identity", "interactions", "props", "slots", "style"],
        `${name} component props`,
      );
      assert.equal(Object.hasOwn(props, "behaviors"), false);
      assert.ok(Object.isFrozen(props.props));
      assert.ok(Object.isFrozen(props.slots));
      for (const children of Object.values(props.slots)) assert.ok(Object.isFrozen(children));
      calls.push(`${name}:${props.identity.sourceNodeId}`);
      observations.push({
        name,
        sourceNodeId: props.identity.sourceNodeId,
        slotNames: Object.keys(props.slots),
        props: props.props,
      });
      return createElement(
        tag,
        { "data-source-node": props.identity.sourceNodeId },
        ...(props.slots.default ?? []),
        ...(props.slots.status ?? []),
        String(props.props.text ?? props.props.label ?? ""),
      );
    };
  }
  function Behavior(props) {
    assertExactKeys(
      props,
      ["behaviorId", "children", "identity", "interactions", "props", "slots", "style"],
      "behavior adapter props",
    );
    assert.ok(Object.isFrozen(props.props));
    assert.ok(Object.isFrozen(props.slots));
    assert.deepEqual(Object.keys(props.slots), ["dragPreview"]);
    assert.ok(Object.isFrozen(props.slots.dragPreview));
    calls.push(`behavior:${props.behaviorId}`);
    observations.push({
      name: "behavior",
      sourceNodeId: props.identity.sourceNodeId,
      slotNames: Object.keys(props.slots),
      props: props.props,
    });
    return createElement("strong", null, props.children, props.slots.dragPreview);
  }
  const created = apis.runtimeReact.createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: "com.example.ui/Stack", component: component("stack", "section") },
      { capabilityId: "com.example.ui/Text", component: component("text", "p") },
      { capabilityId: "com.example.ui/TextField", component: component("field", "label") },
      { capabilityId: "com.example.ui/Button", component: component("button", "button") },
    ],
    behaviors: [{ capabilityId: "com.example.interactions/Sortable", component: Behavior }],
  });
  assert.equal(created.status, "created");

  const fixture = await createFixture(apis, {
    mutateCatalog: (catalog) => {
      const stack = catalog.components["com.example.ui/Stack"];
      stack.slots.status = {
        required: false,
        minItems: 1,
        maxItems: 1,
        accepts: ["com.example.ui/Text"],
      };
    },
    mutateBundle: (bundle) => {
      const root = bundle.surfaces["sign-in"].root;
      root.slots.status = [
        {
          id: "sign-in.status",
          use: "com.example.ui/Text",
          when: { op: "eq", args: [{ $ref: "context.showStatus" }, true] },
          props: { text: "Ready", role: "caption" },
        },
      ];
      root.behaviors = [
        {
          id: "sortable",
          use: "com.example.interactions/Sortable",
          props: { axis: "vertical", handle: "item" },
          slots: {
            dragPreview: [
              {
                id: "sign-in.preview",
                use: "com.example.ui/Text",
                props: { text: "Preview", role: "caption" },
              },
            ],
          },
        },
      ];
    },
    context: { showStatus: true },
  });
  const rendered = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
  });
  assert.equal(rendered.status, "rendered");
  assert.equal(calls.length, 0, "adapter executed before React rendering");
  const html = renderToStaticMarkup(rendered.surface.element);
  assert.ok(html.includes(">Ready</p>"));
  assert.ok(html.includes(">Preview</p>"));
  assert.ok(calls.includes("behavior:sortable"));
  const stackObservation = observations.find((entry) => entry.name === "stack");
  assert.deepEqual(stackObservation.slotNames, ["default", "status"]);

  const rawPlanFailure = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
    plan: fixture.snapshot.plan,
  });
  assert.equal(rawPlanFailure.status, "failed");
  assert.equal(rawPlanFailure.failure.code, "MALFORMED_RENDER_PLAN");

  const foreignCatalog = await createFixture(apis);
  const catalogFailure = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: foreignCatalog.catalogSet,
  });
  assert.equal(catalogFailure.status, "failed");
  assert.equal(catalogFailure.failure.code, "INVALID_CATALOG_SET");

  const snapshotFailure = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: fixture.session,
    snapshot: cloneJson(fixture.snapshot),
    catalogSet: fixture.catalogSet,
  });
  assert.equal(snapshotFailure.status, "failed");
  assert.equal(snapshotFailure.failure.code, "INVALID_SESSION_SNAPSHOT");

  const budgetFailure = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
    limits: { maxPropValidations: 1 },
  });
  assert.equal(budgetFailure.status, "failed");
  assert.equal(budgetFailure.failure.code, "RECEIVING_VALIDATION_LIMIT_EXCEEDED");

  const propsFixture = await createFixture(apis, {
    mutateBundle: (bundle) => {
      bundle.surfaces["sign-in"].root.slots.default[0].props.text = {
        $ref: "context.invalidText",
      };
    },
    context: { invalidText: 42 },
  });
  const invalidProps = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: propsFixture.session,
    snapshot: propsFixture.snapshot,
    catalogSet: propsFixture.catalogSet,
  });
  assert.equal(invalidProps.status, "failed");
  assert.equal(invalidProps.failure.code, "INVALID_COMPONENT_PROPS");
  assert.equal(invalidProps.failure.channel, "props");
  assert.equal(invalidProps.failure.sourceNodeId, "sign-in.title");
  assert.ok(invalidProps.failure.diagnostics.length > 0);
  assert.ok(Object.isFrozen(invalidProps.failure.diagnostics));
  assert.ok(invalidProps.failure.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic)));

  const slotFixture = await createFixture(apis, {
    mutateCatalog: (catalog) => {
      catalog.components["com.example.ui/Stack"].slots.status = {
        required: false,
        minItems: 1,
        maxItems: 1,
        accepts: ["com.example.ui/Text"],
      };
    },
    mutateBundle: (bundle) => {
      bundle.surfaces["sign-in"].root.slots.status = [
        {
          id: "sign-in.status",
          use: "com.example.ui/Text",
          when: { op: "eq", args: [{ $ref: "context.showStatus" }, true] },
          props: { text: "Ready", role: "caption" },
        },
      ];
    },
    context: { showStatus: false },
  });
  const invalidSlots = apis.runtimeReact.renderRuntimeReactSurface({
    registry: created.handle,
    session: slotFixture.session,
    snapshot: slotFixture.snapshot,
    catalogSet: slotFixture.catalogSet,
  });
  assert.equal(invalidSlots.status, "failed");
  assert.equal(invalidSlots.failure.code, "INVALID_COMPONENT_SLOTS");
  assert.equal(invalidSlots.failure.channel, "slots");
  assert.equal(invalidSlots.failure.sourceNodeId, "sign-in.layout");
  assert.ok(invalidSlots.failure.diagnostics.length > 0);

  return Object.freeze({
    runtimeExports: actualRuntimeExports,
    renderedHtml: html,
    renderedNodeCount: rendered.surface.nodeCount,
    renderedBehaviorCount: rendered.surface.behaviorCount,
    componentAdapterKeys: Object.freeze(["identity", "interactions", "props", "slots", "style"]),
    behaviorAdapterKeys: Object.freeze([
      "behaviorId",
      "children",
      "identity",
      "interactions",
      "props",
      "slots",
      "style",
    ]),
    rootNamedSlots: Object.freeze(["default", "status"]),
    behaviorNamedSlots: Object.freeze(["dragPreview"]),
    adapterExecutionOrder: Object.freeze([...calls]),
    rawPlanFailure: rawPlanFailure.failure.code,
    foreignCatalogFailure: catalogFailure.failure.code,
    reconstructedSnapshotFailure: snapshotFailure.failure.code,
    sharedBudgetFailure: budgetFailure.failure.code,
    componentPropsFailure: Object.freeze({
      code: invalidProps.failure.code,
      channel: invalidProps.failure.channel,
      sourceNodeId: invalidProps.failure.sourceNodeId,
      diagnosticPointers: Object.freeze(
        invalidProps.failure.diagnostics.map((diagnostic) => diagnostic.pointer),
      ),
    }),
    namedSlotFailure: Object.freeze({
      code: invalidSlots.failure.code,
      channel: invalidSlots.failure.channel,
      sourceNodeId: invalidSlots.failure.sourceNodeId,
      diagnosticPointers: Object.freeze(
        invalidSlots.failure.diagnostics.map((diagnostic) => diagnostic.pointer),
      ),
    }),
    privateReactInspection: 0,
    componentBehaviorPlanLeak: false,
    fallbackSlots: 0,
  });
}

function markdownCells(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function exactTableRow(markdown, id, code) {
  const rows = markdown
    .split(/\r?\n/u)
    .map((line) => markdownCells(line))
    .filter((cells) => cells[0] === id);
  if (rows.length !== 1) {
    fail(code, `Expected one exact ${id} ledger row.`, { occurrences: rows.length });
  }
  return rows[0];
}

function inspectTraceabilityDocuments({ tasksText, normativeText, findingsText, traceText }) {
  const task = exactTableRow(tasksText, "M05-T02", "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT");
  if (
    task[1] !== "DONE" ||
    task[2] !== "M05-T01" ||
    !task[3]?.includes("Resolved props and named slots")
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
      "M05-T02 task row must be DONE with its exact prerequisite and deliverable.",
      { actual: task },
    );
  }
  const expectedNormative = new Map([
    ["N-026", "TESTED"],
    ["N-027", "PLANNED"],
    ["N-029", "PLANNED"],
    ["N-034", "PLANNED"],
    ["N-042", "PLANNED"],
  ]);
  const normative = [];
  for (const [id, status] of expectedNormative) {
    const row = exactTableRow(normativeText, id, "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT");
    if (row[4] !== status) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        `${id} must retain its reviewed M05-T02 status.`,
        { expected: status, actual: row[4] },
      );
    }
    if (id === "N-026" && !row[3]?.includes("M05-T02")) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        "N-026 must retain M05-T02 receiving-boundary ownership.",
      );
    }
    if (id === "N-034" && !row[3]?.includes("M05-T04")) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        "N-034 must retain its concrete M05-T04 parity owner.",
      );
    }
    normative.push(Object.freeze({ id, status, owners: row[3] }));
  }
  for (const heading of [
    "## PF-050 — React adapter selection requires a static registry and bounded all-or-nothing preflight",
    "## PF-051 — Resolved adapter receiving requires exact Catalog authority and one shared finite scope",
  ]) {
    if (findingsText.split(/\r?\n/u).filter((line) => line === heading).length !== 1) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        `Expected one exact finding heading: ${heading}.`,
      );
    }
  }
  for (const anchor of [
    "`N-026`, `N-027`, `N-042`",
    "`C-019`, `R-006`, `R-112`",
    "M06-T05 still owns publisher-side recording",
    "M09-T04 still owns editor overlay/private-structure isolation",
  ]) {
    if (!findingsText.includes(anchor)) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        `PF-051 traceability anchor is missing: ${anchor}.`,
      );
    }
  }
  let trace;
  try {
    trace = JSON.parse(traceText);
  } catch {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
      "Canonical protocol traceability JSON is invalid.",
    );
  }
  // The frozen protocol ledger groups rules by kind instead of publishing one broad `entries`
  // array. Read the reviewed groups explicitly so a future accidental shape change cannot turn
  // a missing ownership assertion into an empty, silently accepted lookup.
  const entries = [
    ...(Array.isArray(trace.conformanceRules) ? trace.conformanceRules : []),
    ...(Array.isArray(trace.pipelineSteps) ? trace.pipelineSteps : []),
    ...(Array.isArray(trace.proseRules) ? trace.proseRules : []),
    ...(Array.isArray(trace.invariants) ? trace.invariants : []),
    ...(Array.isArray(trace.diagnostics) ? trace.diagnostics : []),
  ];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const id of ["C-019", "R-006", "R-112"]) {
    const entry = byId.get(id);
    if (entry === undefined || !entry.owners?.includes("M05-T02")) {
      fail(
        "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
        `${id} must retain canonical M05-T02 ownership.`,
      );
    }
  }
  const related = byId.get("R-048");
  if (related === undefined || !isDeepStrictEqual(related.owners, ["M03-T07", "M04-T03"])) {
    fail(
      "RESOLVED_PROPS_SLOTS_TRACEABILITY_DRIFT",
      "Related R-048 canonical ownership must remain unchanged.",
    );
  }
  return Object.freeze({
    task: Object.freeze({ id: task[0], status: task[1], prerequisite: task[2] }),
    normative: Object.freeze(normative),
    canonicalTrace: Object.freeze(["C-019", "R-006", "R-112"]),
    findings: Object.freeze(["PF-050", "PF-051"]),
    relatedCorrectiveTrace: Object.freeze({
      id: "R-048",
      canonicalOwners: Object.freeze([...related.owners]),
      relation: "PF-049/PF-050 receiving-schema correction",
    }),
  });
}

async function formatArtifact(artifact) {
  return Buffer.from(
    await format(JSON.stringify(artifact), {
      parser: "json",
      endOfLine: "lf",
      printWidth: 100,
      tabWidth: 2,
    }),
    "utf8",
  );
}

/**
 * Builds deterministic M05-T02 evidence from exact prerequisites, source, declarations, focused
 * tests, boundary fixtures, and the compiled public APIs.
 */
export async function buildRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  const fileOverrides = options.fileOverrides;
  const sourceEntries = await Promise.all(
    RUNTIME_REACT_SOURCE_PATHS.map(async (relativePath) => [
      relativePath,
      await readWorkspaceText(relativePath, fileOverrides),
    ]),
  );
  const renderSource =
    sourceEntries.find(([relativePath]) => relativePath.endsWith("/render-plan.tsx"))?.[1] ?? "";
  const registrySource =
    sourceEntries.find(([relativePath]) => relativePath.endsWith("/registry.ts"))?.[1] ?? "";
  const [
    prerequisites,
    historicalCompatibility,
    publicIndex,
    declarationIndex,
    sourceDocumentation,
    productionBoundary,
    receivingImplementation,
    traceability,
    packageArchitecture,
    tests,
    runtime,
    tracked,
  ] = await Promise.all([
    Promise.all(
      PREREQUISITES.map((definition) =>
        inspectPrerequisite(definition, options.prerequisiteBytes?.[definition.key], fileOverrides),
      ),
    ),
    inspectHistoricalCompatibility(fileOverrides),
    readWorkspaceText("packages/runtime-react/src/index.ts", fileOverrides).then((source) =>
      inspectExplicitRootExports("packages/runtime-react/src/index.ts", source),
    ),
    readWorkspaceText("packages/runtime-react/dist/index.d.ts", fileOverrides).then((source) =>
      inspectExplicitRootExports("packages/runtime-react/dist/index.d.ts", source),
    ),
    Promise.resolve(inspectSourceDocumentation(sourceEntries)),
    Promise.resolve(inspectProductionBoundary(sourceEntries)),
    Promise.all([
      readWorkspaceText("packages/validator/src/execution-contract-validation.ts", fileOverrides),
      readWorkspaceText("packages/validator/src/schema-instance-validation.ts", fileOverrides),
      readWorkspaceText("packages/runtime-core/src/headless-session.ts", fileOverrides),
    ]).then(([validatorSource, schemaSource, sessionSource]) =>
      inspectReceivingImplementation({
        renderSource,
        registrySource,
        validatorSource,
        schemaSource,
        sessionSource,
      }),
    ),
    Promise.all([
      readWorkspaceText("docs/plan/TASKS.md", fileOverrides),
      readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
      readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
      readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    ]).then(([tasksText, normativeText, findingsText, traceText]) =>
      inspectTraceabilityDocuments({ tasksText, normativeText, findingsText, traceText }),
    ),
    Promise.all([
      readWorkspaceText("packages/runtime-react/package.json", fileOverrides),
      readWorkspaceText("docs/architecture/ARCHITECTURE.md", fileOverrides),
      readWorkspaceText("dependency-cruiser.config.cjs", fileOverrides),
      readWorkspaceText("scripts/verify-boundary-fixtures.mjs", fileOverrides),
    ]).then(([packageText, architectureText, dependencyCruiserText, boundaryFixtureText]) =>
      inspectPackageAndArchitecture({
        packageText,
        architectureText,
        dependencyCruiserText,
        boundaryFixtureText,
      }),
    ),
    Promise.all([
      readWorkspaceText("packages/runtime-react/test/resolved-props-slots.test.tsx", fileOverrides),
      readWorkspaceText(
        "packages/validator/test/resolved-adapter-contracts.test.ts",
        fileOverrides,
      ),
      readWorkspaceText("packages/runtime-core/test/headless-session.test.ts", fileOverrides),
      readWorkspaceText(
        "packages/validator/test/schema-instance-validation.test.ts",
        fileOverrides,
      ),
      readWorkspaceText("tests/runtime-react-resolved-props-slots.test.mjs", fileOverrides),
      readWorkspaceText("packages/runtime-react/test/adapter-registry.types.ts", fileOverrides),
      readWorkspaceText("packages/runtime-react/test/resolved-props-slots.types.ts", fileOverrides),
      readWorkspaceText(
        "packages/validator/test/resolved-adapter-contracts.types.ts",
        fileOverrides,
      ),
      readWorkspaceText("packages/runtime-core/test/headless-session.types.ts", fileOverrides),
    ]).then(
      ([
        runtimeReactTests,
        validatorTests,
        coreTests,
        schemaTests,
        rootTests,
        adapterTypes,
        runtimeReactTypes,
        validatorTypes,
        coreTypes,
      ]) =>
        inspectTestInventory({
          runtimeReactTests,
          validatorTests,
          coreTests,
          schemaTests,
          rootTests,
          adapterTypes,
          runtimeReactTypes,
          validatorTypes,
          coreTypes,
        }),
    ),
    inspectRuntimeApi(options.runtimeApis),
    trackedFiles(fileOverrides),
  ]);

  if (
    !isDeepStrictEqual(publicIndex.runtime, declarationIndex.runtime) ||
    !isDeepStrictEqual(publicIndex.types, declarationIndex.types)
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_DECLARATION_DRIFT",
      "Source and built root declarations expose different contracts.",
    );
  }
  const renderAst = parseTypeScript("packages/runtime-react/src/render-plan.tsx", renderSource);
  const failureCodes = readStringUnion(renderAst, "RuntimeReactRenderFailureCode");
  if (!sameStrings(failureCodes, EXPECTED_FAILURE_CODES)) {
    fail("RESOLVED_PROPS_SLOTS_FAILURE_MODEL_DRIFT", "Renderer failure classifications changed.", {
      expected: EXPECTED_FAILURE_CODES,
      actual: failureCodes,
    });
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M05-T02",
    result: "PASS",
    profile: "desen-runtime-react-resolved-props-slots-v1",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "web-react",
      summary:
        "The React renderer authenticates one exact live session/Catalog generation, validates final component and behavior props plus named slots through one bounded receiving scope, and exposes no raw plan or private implementation structure.",
      resolvedPropsReceivingBoundary: true,
      authenticatedNamedSlots: true,
      rawPlanAuthority: false,
      privateStructureInspection: false,
    }),
    prerequisites: Object.freeze(prerequisites),
    historicalCompatibility,
    publicApi: Object.freeze({
      runtimeExports: publicIndex.runtime,
      typeExports: publicIndex.types,
      sourceDeclarations: sourceDocumentation.sourceDeclarations.length,
      tsdocDeclarations: sourceDocumentation.tsdocDeclarations,
    }),
    catalogAuthority: Object.freeze({
      exactExecutionCatalogSetIdentity: receivingImplementation.exactCatalogSetAuthority,
      rawMountReturnsExactRetainedCatalogSet:
        receivingImplementation.rawMountReturnsExactCatalogSetAuthority,
      lowerStageCatalogAccepted: false,
      structurallyEqualCatalogAccepted: false,
      schemaMetadataExposedToAdapter: false,
      foreignCatalogFailure: runtime.foreignCatalogFailure,
    }),
    sessionAuthority: Object.freeze({
      exactLiveSnapshotIdentity: receivingImplementation.exactSessionSnapshotAuthority,
      rawPlanInput: receivingImplementation.rawPlanInput,
      rawPlanFailure: runtime.rawPlanFailure,
      reconstructedSnapshotFailure: runtime.reconstructedSnapshotFailure,
      planSource: "authenticated current RuntimeHeadlessSessionSnapshot",
    }),
    receivingBudget: Object.freeze({
      oneFactoryAuthenticatedScopePerRender: receivingImplementation.sharedReceivingScopePerRender,
      nonResettingPreparedSchemaBudget: receivingImplementation.sharedPreparedSchemaBudget,
      actualSchemaInterpreterWorkBudgeted: receivingImplementation.actualSchemaWorkBudgeted,
      preparedSlotContractsBudgeted: receivingImplementation.preparedSlotContractsBudgeted,
      aggregatePropsSlotsAndJsonCounters: true,
      controlledLimitFailure: runtime.sharedBudgetFailure,
    }),
    props: Object.freeze({
      componentValidationMode: "complete/resolved-value",
      behaviorValidationMode: "complete/resolved-value",
      detachedAndRecursivelyFrozenSuccess: true,
      optionalOmissionPreserved: true,
      referenceShapedResolvedDataIsInert: true,
      componentFailure: runtime.componentPropsFailure,
      invalidValueDeliveredToAdapter: false,
    }),
    namedSlots: Object.freeze({
      source: "authenticated final materialized plan",
      componentSlots: runtime.rootNamedSlots,
      behaviorSlots: runtime.behaviorNamedSlots,
      exactNamesAndOrderPreserved: true,
      frozenMapAndArrays: true,
      conditionAndRepeatAwareCardinality: true,
      failure: runtime.namedSlotFailure,
      fallbackGuessing: runtime.fallbackSlots,
    }),
    adapterIsolation: Object.freeze({
      componentKeys: runtime.componentAdapterKeys,
      behaviorKeys: runtime.behaviorAdapterKeys,
      componentBehaviorPlanLeak: runtime.componentBehaviorPlanLeak,
      rawPlanLeak: false,
      catalogMetadataLeak: false,
      domOrNativeAuthorityLeak: false,
      privateReactInspection: productionBoundary.privateReactInspection,
    }),
    failureModel: Object.freeze({
      codes: failureCodes,
      diagnosticsPreserved: true,
      stableRuntimeSourceCapabilityIdentity: true,
      frozenCallbackFreeFailures: true,
      allOrNothingPreflight: true,
    }),
    architecture: Object.freeze({
      ...packageArchitecture,
      ...productionBoundary,
      frameworkNeutralAuthoritySeams: Object.freeze(["@desen/runtime-core", "@desen/validator"]),
    }),
    traceability,
    evidence: Object.freeze({
      tests,
      renderedHtml: runtime.renderedHtml,
      renderedNodeCount: runtime.renderedNodeCount,
      renderedBehaviorCount: runtime.renderedBehaviorCount,
      adapterExecutionOrder: runtime.adapterExecutionOrder,
      trackedFiles: tracked,
    }),
    nonclaims: Object.freeze([
      "No post-resolution style-part or visual-state validation claim; M05-T03 owns it.",
      "No live event, command, or behavior lifecycle claim; M05-T04 owns it.",
      "No React instance-preservation or production error-boundary claim.",
      "No separate reference-host or managed-screen source-audit claim.",
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

function parseArtifactReference(markdown, heading, allowPending, matrix = false) {
  const lines = markdown.split(/\r?\n/u);
  const headings = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headings.length !== 1) {
    fail(
      "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
      `${heading} must occur exactly once without indentation.`,
    );
  }
  const start = headings[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next === -1 ? lines.length : next;
  const expectedPath = matrix ? ARTIFACT_FILE_NAME : ARTIFACT_RELATIVE_PATH;
  const suffix = matrix ? "." : ".";
  const pathLine = `\`${expectedPath}\``;
  const pathOccurrences = lines.flatMap((line, index) =>
    line === pathLine ? [{ line, index }] : [],
  );
  const sectionPaths = pathOccurrences.filter(({ index }) => index > start && index < end);
  const shaPattern = /^`sha256:([0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])`\.$/u;
  const shaOccurrences = lines.flatMap((line, index) => {
    const match = line.match(shaPattern);
    return match === null ? [] : [{ index, value: match[1] }];
  });
  const sectionShas = shaOccurrences.filter(({ index }) => index > start && index < end);
  if (
    sectionPaths.length !== 1 ||
    pathOccurrences.length !== 1 ||
    sectionShas.length !== 1 ||
    shaOccurrences.filter(({ value }) => value === sectionShas[0]?.value).length !== 1 ||
    sectionShas[0]?.index !== sectionPaths[0]?.index + 1 ||
    lines[sectionPaths[0]?.index] !== pathLine ||
    suffix !== "."
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
      `${heading} must contain one unique adjacent exact path/SHA pair.`,
    );
  }
  const value = sectionShas[0].value;
  if (!allowPending && value === PENDING_ARTIFACT_SHA256) {
    fail(
      "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
      "Production verification rejects pending artifact references.",
    );
  }
  return value;
}

async function verifyFinalPins(artifactSha256, options, allowPending) {
  const [proofText, matrixText] = await Promise.all([
    options.proofDocumentText ?? readWorkspaceText(PROOF_DOCUMENT_PATH, options.fileOverrides),
    options.proofMatrixText ?? readWorkspaceText(PROOF_MATRIX_PATH, options.fileOverrides),
  ]);
  const proofSha = parseArtifactReference(proofText, "## Evidence artifact", allowPending, false);
  const matrixSha = parseArtifactReference(matrixText, "## M05-T02", allowPending, true);
  if (!allowPending && (proofSha !== artifactSha256 || matrixSha !== artifactSha256)) {
    fail(
      "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
      "Proof and Proof Matrix must pin the exact tracked M05-T02 artifact SHA-256.",
    );
  }
}

function rejectProductionInjection(options) {
  const buildOptions = normalizeOptions(options.buildOptions);
  if (
    Object.hasOwn(buildOptions, "runtimeApis") ||
    Object.hasOwn(buildOptions, "prerequisiteBytes") ||
    options.allowPendingArtifactReference === true
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      "Production verification rejects injected runtime/prerequisite state and pending pins.",
    );
  }
}

async function readArtifactBytes(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("RESOLVED_PROPS_SLOTS_ARTIFACT_MISSING", "M05-T02 artifact is missing.", {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      "RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE",
      "M05-T02 artifact must be a regular non-symlink file.",
    );
  }
  return readFile(artifactPath);
}

/** Atomically writes deterministic M05-T02 bytes while documentation pins may still be pending. */
export async function writeRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  const artifactPath =
    options.artifactPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH;
  const built =
    options.preparedEvidence ??
    (await buildRuntimeReactResolvedPropsSlotsEvidence(options.buildOptions));
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE", "Atomic M05-T02 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
  });
}

/** Rebuilds, byte-compares, and verifies exact final M05-T02 documentation pins. */
export async function verifyRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  rejectProductionInjection(options);
  const built = await buildRuntimeReactResolvedPropsSlotsEvidence(options.buildOptions);
  await verifyFinalPins(built.artifactSha256, options, false);
  const artifactPath =
    options.artifactPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH;
  const actual =
    options.artifactBytes === undefined
      ? await readArtifactBytes(artifactPath)
      : Buffer.from(options.artifactBytes);
  if (!Buffer.from(actual).equals(built.artifactBytes)) {
    fail(
      "RESOLVED_PROPS_SLOTS_ARTIFACT_DRIFT",
      "Tracked M05-T02 artifact differs from a deterministic rebuild.",
      { expected: built.artifactSha256, actual: sha256(actual) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    sourceDeclarations: built.artifact.publicApi.sourceDeclarations,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    failureCodes: built.artifact.failureModel.codes.length,
    packageTests:
      built.artifact.evidence.tests.runtimeReactTests +
      built.artifact.evidence.tests.validatorTests +
      built.artifact.evidence.tests.runtimeCoreTests,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
  });
}
