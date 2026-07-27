import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RESOLVED-STYLES.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";

/** Absolute destination of the deterministic M05-T03 semantic-style evidence artifact. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "componentContracts",
    task: "M02-T08",
    path: "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
    sha256: "71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac",
    profile: "desen-component-contract-validation-v1",
  }),
  Object.freeze({
    key: "variantStyleEvaluation",
    task: "M04-T05",
    path: "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
  }),
  Object.freeze({
    key: "resolvedPropsSlots",
    task: "M05-T02",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json",
    sha256: "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    profile: "desen-runtime-react-resolved-props-slots-v1",
  }),
]);

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
  "RuntimeReactRenderFailureChannel",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
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
  "SLOT_LIMIT_EXCEEDED",
  "STRING_LIMIT_EXCEEDED",
  "UNKNOWN_BEHAVIOR_CAPABILITY",
  "UNKNOWN_COMPONENT_CAPABILITY",
]);

const EXPECTED_STYLE_TEST_TITLES = Object.freeze([
  "contains deeply nested style input before any React adapter executes",
  "delivers complete immutable base and declared-state maps to component and behavior adapters",
  "keeps statically unknown states, parts, and properties outside session ingress",
  "leaves declared-state activation entirely inside the capability adapter",
  "rejects a dynamically resolved behavior style before behavior or owner delivery",
  "rejects a dynamically resolved component style atomically with exact style identity",
  "shares one schema-evaluation budget across props and style validation",
  "shares the style-validation budget across the complete component tree",
]);

const EXPECTED_VALIDATOR_STYLE_TEST_TITLES = Object.freeze([
  "normalizes multi-failure order independently of caller insertion order",
  "rejects unknown states, parts, properties, and invalid resolved property values",
  "validates base and declared visual states through exact semantic style parts",
]);

const EXPECTED_ROOT_TESTS = 18;
const EXPECTED_RUNTIME_REACT_COMPILER_NEGATIVE_CASES = 6;
const EXPECTED_VALIDATOR_COMPILER_NEGATIVE_CASES = 9;
const EXPECTED_COMPILER_NEGATIVE_CASES =
  EXPECTED_RUNTIME_REACT_COMPILER_NEGATIVE_CASES + EXPECTED_VALIDATOR_COMPILER_NEGATIVE_CASES;
const EXPECTED_SOURCE_DECLARATIONS = 38;
const EXPECTED_TSDOC_DECLARATIONS = 38;

const COMPATIBILITY_PATHS = Object.freeze([
  "scripts/lib/runtime-react-resolved-props-slots-proof.mjs",
  "tests/runtime-react-resolved-props-slots.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  "README.md",
  "dependency-cruiser.config.cjs",
  "docs/adr/0010-m05-react-runtime-and-reference-host-boundaries.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/plan/PROTOCOL-FINDINGS.md",
  "docs/plan/TASKS.md",
  "docs/proof/NORMATIVE-COVERAGE.md",
  "docs/proof/PROOF-MATRIX.md",
  "docs/proof/RUNTIME-REACT-RESOLVED-STYLES.md",
  "docs/proof/protocol-0.1.0-traceability.json",
  "package.json",
  "packages/runtime-react/README.md",
  "packages/runtime-react/package.json",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/registry.ts",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/test/session-fixture.ts",
  "packages/runtime-react/test/style-parts-states.test.tsx",
  "packages/runtime-react/test/style-parts-states.types.ts",
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
  "packages/validator/src/execution-contract-validation.ts",
  "packages/validator/src/index.ts",
  "packages/validator/test/resolved-adapter-contracts.test.ts",
  "packages/validator/test/resolved-adapter-contracts.types.ts",
  "packages/validator/dist/execution-contract-validation.js",
  "packages/validator/dist/execution-contract-validation.js.map",
  "packages/validator/dist/execution-contract-validation.d.ts",
  "packages/validator/dist/execution-contract-validation.d.ts.map",
  "packages/validator/dist/index.js",
  "packages/validator/dist/index.js.map",
  "packages/validator/dist/index.d.ts",
  "packages/validator/dist/index.d.ts.map",
  "pnpm-lock.yaml",
  "scripts/generate-runtime-react-resolved-styles-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/runtime-react-resolved-styles-proof.mjs",
  "scripts/run-ci-quality-gate.mjs",
  "scripts/test/ci-quality-gate.test.mjs",
  "scripts/verify-runtime-react-resolved-styles.mjs",
  "scripts/verify-boundary-fixtures.mjs",
  "tests/runtime-react-resolved-styles.test.mjs",
  ...COMPATIBILITY_PATHS,
]);

const SOURCE_PATHS = Object.freeze({
  index: "packages/runtime-react/src/index.ts",
  registry: "packages/runtime-react/src/registry.ts",
  render: "packages/runtime-react/src/render-plan.tsx",
  validator: "packages/validator/src/execution-contract-validation.ts",
  validatorIndex: "packages/validator/src/index.ts",
  validatorDeclarationIndex: "packages/validator/dist/index.d.ts",
  styleTests: "packages/runtime-react/test/style-parts-states.test.tsx",
  styleTypes: "packages/runtime-react/test/style-parts-states.types.ts",
  validatorTests: "packages/validator/test/resolved-adapter-contracts.test.ts",
  validatorTypes: "packages/validator/test/resolved-adapter-contracts.types.ts",
  rootTests: "tests/runtime-react-resolved-styles.test.mjs",
  runtimePackage: "packages/runtime-react/package.json",
  rootPackage: "package.json",
  ciRunner: "scripts/run-ci-quality-gate.mjs",
  ciTests: "scripts/test/ci-quality-gate.test.mjs",
  tasks: "docs/plan/TASKS.md",
  normative: "docs/proof/NORMATIVE-COVERAGE.md",
  findings: "docs/plan/PROTOCOL-FINDINGS.md",
  trace: "docs/proof/protocol-0.1.0-traceability.json",
  declarationIndex: "packages/runtime-react/dist/index.d.ts",
});

const ALLOWED_FILE_OVERRIDE_PATHS = Object.freeze(
  sorted(
    new Set([
      ...TRACKED_PATHS,
      ...Object.values(SOURCE_PATHS),
      ...PREREQUISITES.map(({ path: prerequisitePath }) => prerequisitePath),
      PROOF_DOCUMENT_PATH,
      PROOF_MATRIX_PATH,
    ]),
  ),
);
const ALLOWED_PREREQUISITE_OVERRIDE_KEYS = Object.freeze(
  sorted(PREREQUISITES.map(({ key }) => key)),
);
const SELF_PINNED_DOCUMENTS = Object.freeze({
  [PROOF_DOCUMENT_PATH]: Object.freeze({
    heading: "## Evidence artifact",
    artifactPath: ARTIFACT_RELATIVE_PATH,
  }),
  [PROOF_MATRIX_PATH]: Object.freeze({
    heading: "## M05-T03",
    artifactPath: path.basename(ARTIFACT_RELATIVE_PATH),
  }),
});

const ALLOWED_RENDER_IMPORTS = Object.freeze([
  "./registry.js",
  "@desen/runtime-core",
  "@desen/validator",
  "react",
]);
const ALLOWED_REGISTRY_IMPORTS = Object.freeze([
  "@desen/runtime-core",
  "@desen/validator",
  "react",
]);

/** Controlled deterministic M05-T03 evidence failure. */
export class RuntimeReactResolvedStylesEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactResolvedStylesEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactResolvedStylesEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sorted(values) {
  return [...values].sort();
}

function captureOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} options must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} options could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const output = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} option ${key} is not safely readable.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RESOLVED_STYLES_OPTIONS_INVALID",
        `${label} option ${key} must be enumerable own data.`,
      );
    }
    output[key] = descriptor.value;
  }
  return Object.freeze(output);
}

function captureOverrideMap(value, allowedKeys, label, valueKind) {
  if (value === undefined) return undefined;
  const captured = captureOwnDataOptions(value, allowedKeys, label);
  const output = Object.create(null);
  for (const [key, entry] of Object.entries(captured)) {
    if (typeof entry === "object" && entry !== null && utilTypes.isProxy(entry)) {
      fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label}.${key} cannot be a Proxy.`);
    }
    if (
      (valueKind === "text" && typeof entry !== "string" && !Buffer.isBuffer(entry)) ||
      (valueKind === "bytes" && !Buffer.isBuffer(entry))
    ) {
      fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label}.${key} has an invalid value.`);
    }
    output[key] = Buffer.isBuffer(entry) ? Buffer.from(entry) : entry;
  }
  return Object.freeze(output);
}

function optionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} must be a string.`);
  }
  return value;
}

function optionalBuffer(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} must be a non-Proxy Buffer.`);
  }
  return Buffer.from(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(absolutePath, missingCode, unsafeCode) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail(missingCode, `Required evidence file is missing: ${absolutePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `Evidence input must be a regular non-symlink file: ${absolutePath}.`);
  }
  return readFile(absolutePath);
}

async function workspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? Buffer.from(override) : Buffer.from(override, "utf8");
  }
  return readRegularBytes(
    path.join(WORKSPACE_ROOT, relativePath),
    "RESOLVED_STYLES_TRACKED_FILE_MISSING",
    "RESOLVED_STYLES_TRACKED_FILE_UNSAFE",
  );
}

async function workspaceText(relativePath, fileOverrides) {
  return (await workspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

function parseTypeScript(relativePath, sourceText) {
  const source = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (source.parseDiagnostics.length !== 0) {
    fail("RESOLVED_STYLES_SOURCE_PARSE_DRIFT", `Cannot parse ${relativePath}.`, {
      diagnostics: source.parseDiagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    });
  }
  return source;
}

function rootExports(relativePath, sourceText) {
  const source = parseTypeScript(relativePath, sourceText);
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause)) {
      fail("RESOLVED_STYLES_EXPORT_DRIFT", `${relativePath} cannot use wildcard exports.`);
    }
    for (const element of statement.exportClause.elements) {
      const destination = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
      destination.push(element.name.text);
    }
  }
  return Object.freeze({ runtime: sorted(runtime), types: sorted(types) });
}

function declarationInventory(entries) {
  const declarations = [];
  const undocumented = [];
  for (const [relativePath, sourceText] of entries) {
    const source = parseTypeScript(relativePath, sourceText);
    for (const statement of source.statements) {
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        continue;
      }
      let names = [];
      if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)
      ) {
        if (statement.name !== undefined) names = [statement.name.text];
      } else if (ts.isVariableStatement(statement)) {
        names = statement.declarationList.declarations.flatMap((declaration) =>
          ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
        );
      }
      for (const name of names) {
        declarations.push(`${relativePath}#${name}`);
        if ((statement.jsDoc?.length ?? 0) === 0) {
          undocumented.push(`${relativePath}#${name}`);
        }
      }
    }
  }
  if (
    declarations.length !== EXPECTED_SOURCE_DECLARATIONS ||
    declarations.length - undocumented.length !== EXPECTED_TSDOC_DECLARATIONS ||
    undocumented.length !== 0
  ) {
    fail("RESOLVED_STYLES_TSDOC_DRIFT", "Public declaration or TSDoc inventory changed.", {
      declarations: declarations.length,
      undocumented,
    });
  }
  return Object.freeze({
    sourceDeclarations: declarations.length,
    tsdocDeclarations: declarations.length - undocumented.length,
  });
}

function importInventory(relativePath, sourceText, expected) {
  const source = parseTypeScript(relativePath, sourceText);
  const modules = source.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );
  const actual = sorted(new Set(modules));
  if (!isDeepStrictEqual(actual, sorted(expected))) {
    fail("RESOLVED_STYLES_IMPORT_DRIFT", `${relativePath} import boundary changed.`, {
      expected,
      actual,
    });
  }
  let dynamicLoading = 0;
  function visit(node) {
    if (
      (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            ["eval", "require"].includes(node.expression.text)))) ||
      (ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "Function")
    ) {
      dynamicLoading += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (dynamicLoading !== 0) {
    fail("RESOLVED_STYLES_PRIVATE_AUTHORITY", `${relativePath} adds executable dynamic loading.`);
  }
  return Object.freeze(actual);
}

function stringUnion(relativePath, sourceText, aliasName) {
  const source = parseTypeScript(relativePath, sourceText);
  const statement = source.statements.find(
    (candidate) => ts.isTypeAliasDeclaration(candidate) && candidate.name.text === aliasName,
  );
  if (statement === undefined || !ts.isTypeAliasDeclaration(statement)) {
    fail("RESOLVED_STYLES_FAILURE_MODEL_DRIFT", `${aliasName} is missing.`);
  }
  const members = ts.isUnionTypeNode(statement.type) ? statement.type.types : [statement.type];
  return sorted(
    members.flatMap((member) => {
      if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
        return [member.literal.text];
      }
      if (
        (ts.isLiteralTypeNode(member) && member.literal.kind === ts.SyntaxKind.NullKeyword) ||
        member.kind === ts.SyntaxKind.NullKeyword
      ) {
        return ["null"];
      }
      return [];
    }),
  );
}

function functionText(relativePath, sourceText, functionName) {
  const source = parseTypeScript(relativePath, sourceText);
  const declaration = source.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  if (declaration === undefined) {
    fail("RESOLVED_STYLES_IMPLEMENTATION_DRIFT", `${functionName} is missing.`);
  }
  return declaration.getText(source);
}

function countText(sourceText, pattern) {
  return sourceText.match(pattern)?.length ?? 0;
}

function inspectRenderer(registryText, renderText) {
  const failures = stringUnion(SOURCE_PATHS.render, renderText, "RuntimeReactRenderFailureCode");
  const channels = stringUnion(SOURCE_PATHS.render, renderText, "RuntimeReactRenderFailureChannel");
  if (!isDeepStrictEqual(failures, sorted(EXPECTED_FAILURE_CODES))) {
    fail("RESOLVED_STYLES_FAILURE_MODEL_DRIFT", "Renderer failure codes changed.", {
      failures,
    });
  }
  if (!isDeepStrictEqual(channels, ["null", "props", "slots", "style"])) {
    fail("RESOLVED_STYLES_FAILURE_MODEL_DRIFT", "Renderer receiving channels changed.", {
      channels,
    });
  }
  if (
    countText(renderText, /validateDesenResolvedAdapterStyle\s*\(/gu) !== 2 ||
    countText(renderText, /style:\s*validatedStyle\.value/gu) !== 2 ||
    /style:\s*capturedStyle(?:[,}\n])/u.test(renderText) ||
    !renderText.includes('"INVALID_COMPONENT_STYLE"') ||
    !renderText.includes('"INVALID_BEHAVIOR_STYLE"') ||
    !renderText.includes('{ capabilityKind: "component", capabilityId: identity.capabilityId }') ||
    !renderText.includes('{ capabilityKind: "behavior", capabilityId }')
  ) {
    fail(
      "RESOLVED_STYLES_IMPLEMENTATION_DRIFT",
      "Component and behavior style preflight or validated-value delivery changed.",
    );
  }
  const compactRegistry = registryText.replace(/\s+/gu, "");
  for (const exactType of [
    "exporttypeRuntimeReactStyleProperties=DesenResolvedAdapterStyleProperties;",
    "exporttypeRuntimeReactStyleParts=DesenResolvedAdapterStyleParts;",
    "exporttypeRuntimeReactSemanticStyle=DesenResolvedAdapterStyle;",
  ]) {
    if (!compactRegistry.includes(exactType)) {
      fail(
        "RESOLVED_STYLES_PUBLIC_STYLE_DRIFT",
        "Public state → part → property style hierarchy changed.",
        { missing: exactType },
      );
    }
  }
  if (
    !registryText.includes("The adapter alone decides which declared state is active") ||
    !registryText.includes("The runtime does not merge") ||
    /\b(activeState|styleSelector|querySelector|HTMLElement|CSSStyleSheet)\b/u.test(registryText)
  ) {
    fail(
      "RESOLVED_STYLES_PRIVATE_AUTHORITY",
      "Style activation or platform-private authority crossed the adapter contract.",
    );
  }
  return Object.freeze({ failures, channels });
}

function inspectValidator(validatorText) {
  const styleFunction = functionText(
    SOURCE_PATHS.validator,
    validatorText,
    "validateDesenResolvedAdapterStyle",
  );
  const metadataFunction = functionText(
    SOURCE_PATHS.validator,
    validatorText,
    "buildExecutionMetadata",
  );
  if (
    !validatorText.includes("readonly preparedVisualStates?: ReadonlySet<string>;") ||
    !metadataFunction.includes("preparedVisualStates: visualStates") ||
    !metadataFunction.includes("const visualStates = new Set(") ||
    !styleFunction.includes("prepared.resolution.preparedVisualStates") ||
    !styleFunction.includes("prepared.resolution.preparedStylePartSchemas") ||
    !styleFunction.includes('adapterValidationPreparation("adapter-style"') ||
    !styleFunction.includes("captureResolvedAdapterMap(style, prepared.authority)") ||
    !styleFunction.includes("prepared.authority.schemaBudget") ||
    styleFunction.includes("new Set(") ||
    styleFunction.includes('ownValue(prepared.contract, "visualStates")') ||
    validatorText.includes("createSchemaContractEvaluationBudget()")
  ) {
    fail(
      "RESOLVED_STYLES_VALIDATOR_DRIFT",
      "Prepared Catalog style authority or shared receiving budget changed.",
    );
  }
  return Object.freeze({
    preparedVisualStates: true,
    preparedStylePartSchemas: true,
    sharedSchemaBudget: true,
  });
}

function directTestTitles(relativePath, sourceText) {
  const source = parseTypeScript(relativePath, sourceText);
  const titles = [];
  let forbiddenModifiers = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
        const first = node.arguments[0];
        if (first !== undefined && ts.isStringLiteral(first)) titles.push(first.text);
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ["it", "test"].includes(node.expression.expression.text)
      ) {
        forbiddenModifiers += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (forbiddenModifiers !== 0 || new Set(titles).size !== titles.length) {
    fail(
      "RESOLVED_STYLES_TEST_INVENTORY_DRIFT",
      `${relativePath} contains skipped/indirect or duplicate tests.`,
    );
  }
  return Object.freeze(sorted(titles));
}

function inspectTests({ styleTests, styleTypes, validatorTests, validatorTypes, rootTests }) {
  const focused = directTestTitles(SOURCE_PATHS.styleTests, styleTests);
  if (!isDeepStrictEqual(focused, EXPECTED_STYLE_TEST_TITLES)) {
    fail("RESOLVED_STYLES_TEST_INVENTORY_DRIFT", "Focused style tests changed.", {
      expected: EXPECTED_STYLE_TEST_TITLES,
      actual: focused,
    });
  }
  const validatorTitles = directTestTitles(SOURCE_PATHS.validatorTests, validatorTests);
  for (const title of EXPECTED_VALIDATOR_STYLE_TEST_TITLES) {
    if (!validatorTitles.includes(title)) {
      fail(
        "RESOLVED_STYLES_TEST_INVENTORY_DRIFT",
        `Required validator style test is missing: ${title}.`,
      );
    }
  }
  const rootTitles = directTestTitles(SOURCE_PATHS.rootTests, rootTests);
  if (rootTitles.length !== EXPECTED_ROOT_TESTS) {
    fail("RESOLVED_STYLES_TEST_INVENTORY_DRIFT", "Root mutation test count changed.", {
      expected: EXPECTED_ROOT_TESTS,
      actual: rootTitles.length,
    });
  }
  if (/@ts-ignore/gu.test(styleTypes) || /@ts-ignore/gu.test(validatorTypes)) {
    fail("RESOLVED_STYLES_TEST_INVENTORY_DRIFT", "Unchecked @ts-ignore is forbidden.");
  }
  const runtimeReactCompilerNegativeCases = countText(styleTypes, /@ts-expect-error/gu);
  const validatorCompilerNegativeCases = countText(validatorTypes, /@ts-expect-error/gu);
  const compilerNegativeCases = runtimeReactCompilerNegativeCases + validatorCompilerNegativeCases;
  if (
    runtimeReactCompilerNegativeCases !== EXPECTED_RUNTIME_REACT_COMPILER_NEGATIVE_CASES ||
    validatorCompilerNegativeCases !== EXPECTED_VALIDATOR_COMPILER_NEGATIVE_CASES ||
    compilerNegativeCases !== EXPECTED_COMPILER_NEGATIVE_CASES
  ) {
    fail("RESOLVED_STYLES_TEST_INVENTORY_DRIFT", "Compiler-negative inventory changed.", {
      expected: {
        runtimeReact: EXPECTED_RUNTIME_REACT_COMPILER_NEGATIVE_CASES,
        validator: EXPECTED_VALIDATOR_COMPILER_NEGATIVE_CASES,
        aggregate: EXPECTED_COMPILER_NEGATIVE_CASES,
      },
      actual: {
        runtimeReact: runtimeReactCompilerNegativeCases,
        validator: validatorCompilerNegativeCases,
        aggregate: compilerNegativeCases,
      },
    });
  }
  return Object.freeze({
    runtimeReactTests: focused.length,
    validatorStyleTests: EXPECTED_VALIDATOR_STYLE_TEST_TITLES.length,
    runtimeReactCompilerNegativeCases,
    validatorCompilerNegativeCases,
    compilerNegativeCases,
    rootMutationTests: rootTitles.length,
    directUniqueNonSkipped: true,
  });
}

function tableRow(markdown, id, code) {
  const rows = markdown
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(`| ${id} `))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  if (rows.length !== 1) fail(code, `Expected one exact ${id} table row.`);
  return rows[0];
}

function traceRecord(trace, id) {
  const collections = [
    trace.conformanceRules,
    trace.proseRules,
    trace.pipelineRules,
    trace.securityRules,
    trace.diagnosticRules,
  ].filter(Array.isArray);
  const matches = collections.flat().filter((entry) => entry?.id === id);
  if (matches.length !== 1) {
    fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", `Expected one canonical ${id} trace record.`);
  }
  return matches[0];
}

function inspectTraceability({ tasksText, normativeText, findingsText, traceText }) {
  const task = tableRow(tasksText, "M05-T03", "RESOLVED_STYLES_TRACEABILITY_DRIFT");
  if (
    task[1] !== "DONE" ||
    task[2] !== "M05-T01–M05-T02" ||
    !task[3]?.includes("Style parts and visual states")
  ) {
    fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", "M05-T03 task row changed.", { task });
  }
  const normative = [
    ["N-028", "TESTED"],
    ["N-029", "TESTED"],
    ["N-030", "PLANNED"],
  ].map(([id, expectedStatus]) => {
    const row = tableRow(normativeText, id, "RESOLVED_STYLES_TRACEABILITY_DRIFT");
    if (row[4] !== expectedStatus || (id !== "N-030" && !row[3]?.includes("M05-T03"))) {
      fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", `${id} status or ownership changed.`, {
        row,
      });
    }
    return Object.freeze({ id, status: row[4], owners: row[3] });
  });
  const findingHeadings = findingsText
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("## PF-052 "));
  if (
    findingHeadings.length !== 1 ||
    !findingsText.includes(
      "## PF-052 — Semantic React style delivery preserves capability-owned state activation",
    ) ||
    !findingsText.includes("validateDesenResolvedAdapterStyle") ||
    !findingsText.includes("M05-T02 artifact remains byte-identical")
  ) {
    fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", "PF-052 decision record changed.");
  }
  let trace;
  try {
    trace = JSON.parse(traceText);
  } catch {
    fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", "Canonical trace ledger is invalid JSON.");
  }
  const canonicalTrace = ["C-019", "R-006", "R-064", "R-065", "R-066", "R-148"];
  for (const id of canonicalTrace) {
    const record = traceRecord(trace, id);
    if (!record.owners?.includes("M05-T03")) {
      fail("RESOLVED_STYLES_TRACEABILITY_DRIFT", `${id} lost M05-T03 ownership.`);
    }
  }
  return Object.freeze({
    task: Object.freeze({ id: task[0], status: task[1], prerequisite: task[2] }),
    normative: Object.freeze(normative),
    canonicalTrace: Object.freeze(canonicalTrace),
    finding: "PF-052",
  });
}

function inspectCompatibility(t02ProofText, t02RootText) {
  for (const required of [
    "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    "immutable-task-time-artifact",
    "captureOptions",
    "utilTypes.isProxy",
  ]) {
    if (!t02ProofText.includes(required)) {
      fail(
        "RESOLVED_STYLES_COMPATIBILITY_DRIFT",
        `T02 strict compatibility reader lost ${required}.`,
      );
    }
  }
  if (
    !t02RootText.includes(
      "rejects accessor, inherited, symbol, and Proxy options without invoking hooks",
    ) ||
    t02ProofText.includes("packages/runtime-react/src/render-plan.tsx")
  ) {
    fail(
      "RESOLVED_STYLES_COMPATIBILITY_DRIFT",
      "T02 compatibility migration can rebuild successor source or lost hostile-option coverage.",
    );
  }
  return Object.freeze({
    immutableArtifactSha256: "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    compatibilityMode: "immutable-task-time-artifact",
    transferredOwnership: COMPATIBILITY_PATHS,
  });
}

function inspectPackageAndCi({ runtimePackageText, rootPackageText, ciRunnerText, ciTestsText }) {
  let runtimePackage;
  let rootPackage;
  try {
    runtimePackage = JSON.parse(runtimePackageText);
    rootPackage = JSON.parse(rootPackageText);
  } catch {
    fail("RESOLVED_STYLES_PACKAGE_DRIFT", "Package metadata is invalid JSON.");
  }
  if (
    runtimePackage.name !== "@desen/runtime-react" ||
    runtimePackage.scripts?.["test:style-parts-states"] !==
      "vitest run test/style-parts-states.test.tsx" ||
    !isDeepStrictEqual(sorted(Object.keys(runtimePackage.dependencies ?? {})), [
      "@desen/runtime-core",
      "@desen/validator",
    ]) ||
    !isDeepStrictEqual(sorted(Object.keys(runtimePackage.peerDependencies ?? {})), ["react"])
  ) {
    fail("RESOLVED_STYLES_PACKAGE_DRIFT", "runtime-react package contract changed.");
  }
  const expectedScripts = [
    "generate:runtime-react-resolved-styles",
    "verify:runtime-react-resolved-styles",
    "test:runtime-react-resolved-styles",
  ];
  for (const name of expectedScripts) {
    if (typeof rootPackage.scripts?.[name] !== "string") {
      fail("RESOLVED_STYLES_CI_DRIFT", `Root package script ${name} is missing.`);
    }
  }
  if (
    !rootPackage.scripts.test?.includes("test:runtime-react-resolved-styles") ||
    !rootPackage.scripts.check?.includes("verify:runtime-react-resolved-styles") ||
    !ciRunnerText.includes('"runtime-react-resolved-styles"') ||
    !ciRunnerText.includes('"scripts/verify-runtime-react-resolved-styles.mjs"') ||
    !ciRunnerText.includes('"tests/runtime-react-resolved-styles.test.mjs"') ||
    !ciTestsText.includes("proofCount: 43") ||
    !ciTestsText.includes("verifierCount: 43") ||
    !ciTestsText.includes("rootTestCount: 43")
  ) {
    fail("RESOLVED_STYLES_CI_DRIFT", "Root proof/CI quality-gate wiring changed.");
  }
  return Object.freeze({
    package: runtimePackage.name,
    productionDependencies: Object.freeze(sorted(Object.keys(runtimePackage.dependencies))),
    peerDependencies: Object.freeze(sorted(Object.keys(runtimePackage.peerDependencies))),
    focusedScript: "test:style-parts-states",
  });
}

async function inspectPrerequisite(definition, injectedBytes, fileOverrides) {
  const bytes = injectedBytes ?? (await workspaceBytes(definition.path, fileOverrides));
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== definition.sha256) {
    fail("RESOLVED_STYLES_PREREQUISITE_DRIFT", `${definition.task} prerequisite bytes changed.`, {
      expected: definition.sha256,
      actual: actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("RESOLVED_STYLES_PREREQUISITE_DRIFT", `${definition.task} artifact is invalid JSON.`);
  }
  if (
    artifact.task !== definition.task ||
    artifact.result !== "PASS" ||
    (definition.profile !== undefined && artifact.profile !== definition.profile)
  ) {
    fail(
      "RESOLVED_STYLES_PREREQUISITE_DRIFT",
      `${definition.task} prerequisite semantics changed.`,
    );
  }
  return Object.freeze({
    task: definition.task,
    path: definition.path,
    sha256: definition.sha256,
    ...(definition.profile === undefined ? {} : { profile: definition.profile }),
    result: artifact.result,
  });
}

async function trackedFiles(fileOverrides) {
  if (new Set(TRACKED_PATHS).size !== TRACKED_PATHS.length) {
    fail("RESOLVED_STYLES_TRACKED_FILE_DRIFT", "Tracked evidence paths must be unique.");
  }
  return Promise.all(
    sorted(TRACKED_PATHS).map(async (relativePath) => {
      const sourceBytes = await workspaceBytes(relativePath, fileOverrides);
      const selfPinnedDocument = SELF_PINNED_DOCUMENTS[relativePath];
      let bytes = sourceBytes;
      let normalization;
      if (selfPinnedDocument !== undefined) {
        const sourceText = sourceBytes.toString("utf8");
        const currentPin = parseArtifactReference(
          sourceText,
          selfPinnedDocument.heading,
          selfPinnedDocument.artifactPath,
          true,
        );
        const currentLine = `\`sha256:${currentPin}\`.`;
        const canonicalLine = `\`sha256:${PENDING_ARTIFACT_SHA256}\`.`;
        const matches = sourceText.split(/\r?\n/u).filter((line) => line === currentLine).length;
        if (matches !== 1) {
          fail(
            "RESOLVED_STYLES_PROOF_PIN_DRIFT",
            `${relativePath} must contain one canonical self-artifact pin line.`,
          );
        }
        bytes = Buffer.from(sourceText.replace(currentLine, canonicalLine), "utf8");
        normalization = "self-artifact-pin-canonical-pending";
      }
      return Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
        ...(normalization === undefined ? {} : { normalization }),
      });
    }),
  );
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
 * Builds deterministic M05-T03 evidence through static source, declaration, test, traceability,
 * prerequisite, compatibility, package, and CI inspection.
 *
 * @remarks The builder never imports or executes runtime-react, validator, React, DOM, adapter, or
 * Catalog implementation code. Focused package tests execute in the surrounding quality command;
 * this evidence layer authenticates their exact direct inventory and reviewed source boundary.
 */
export async function buildRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    ["fileOverrides", "prerequisiteBytes"],
    "build",
  );
  const fileOverrides = captureOverrideMap(
    options.fileOverrides,
    ALLOWED_FILE_OVERRIDE_PATHS,
    "fileOverrides",
    "text",
  );
  const prerequisiteBytes = captureOverrideMap(
    options.prerequisiteBytes,
    ALLOWED_PREREQUISITE_OVERRIDE_KEYS,
    "prerequisiteBytes",
    "bytes",
  );
  const entries = await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
      key,
      await workspaceText(relativePath, fileOverrides),
    ]),
  );
  const files = Object.fromEntries(entries);
  const sourceEntries = [
    [SOURCE_PATHS.registry, files.registry],
    [SOURCE_PATHS.render, files.render],
  ];
  const prerequisites = await Promise.all(
    PREREQUISITES.map((definition) =>
      inspectPrerequisite(definition, prerequisiteBytes?.[definition.key], fileOverrides),
    ),
  );
  const [compatibilityProofText, compatibilityRootText, tracked] = await Promise.all([
    workspaceText(COMPATIBILITY_PATHS[0], fileOverrides),
    workspaceText(COMPATIBILITY_PATHS[1], fileOverrides),
    trackedFiles(fileOverrides),
  ]);
  const declarations = declarationInventory(sourceEntries);
  const publicIndex = rootExports(SOURCE_PATHS.index, files.index);
  const declarationIndex = rootExports(SOURCE_PATHS.declarationIndex, files.declarationIndex);
  const validatorIndex = rootExports(SOURCE_PATHS.validatorIndex, files.validatorIndex);
  const validatorDeclarationIndex = rootExports(
    SOURCE_PATHS.validatorDeclarationIndex,
    files.validatorDeclarationIndex,
  );
  const renderImports = importInventory(SOURCE_PATHS.render, files.render, ALLOWED_RENDER_IMPORTS);
  const registryImports = importInventory(
    SOURCE_PATHS.registry,
    files.registry,
    ALLOWED_REGISTRY_IMPORTS,
  );
  const renderer = inspectRenderer(files.registry, files.render);
  const validator = inspectValidator(files.validator);
  const tests = inspectTests({
    styleTests: files.styleTests,
    styleTypes: files.styleTypes,
    validatorTests: files.validatorTests,
    validatorTypes: files.validatorTypes,
    rootTests: files.rootTests,
  });
  const traceability = inspectTraceability({
    tasksText: files.tasks,
    normativeText: files.normative,
    findingsText: files.findings,
    traceText: files.trace,
  });
  const compatibility = inspectCompatibility(compatibilityProofText, compatibilityRootText);
  const architecture = inspectPackageAndCi({
    runtimePackageText: files.runtimePackage,
    rootPackageText: files.rootPackage,
    ciRunnerText: files.ciRunner,
    ciTestsText: files.ciTests,
  });

  if (
    !isDeepStrictEqual(publicIndex, declarationIndex) ||
    !isDeepStrictEqual(publicIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !isDeepStrictEqual(publicIndex.types, EXPECTED_TYPE_EXPORTS)
  ) {
    fail("RESOLVED_STYLES_EXPORT_DRIFT", "Source and built public exports changed.", {
      expected: { runtime: EXPECTED_RUNTIME_EXPORTS, types: EXPECTED_TYPE_EXPORTS },
      publicIndex,
      declarationIndex,
    });
  }
  const requiredValidatorStyleTypes = [
    "DesenResolvedAdapterStyle",
    "DesenResolvedAdapterStyleParts",
    "DesenResolvedAdapterStyleProperties",
    "DesenResolvedAdapterStyleValidationResult",
  ];
  if (
    !isDeepStrictEqual(validatorIndex, validatorDeclarationIndex) ||
    requiredValidatorStyleTypes.some((name) => !validatorIndex.types.includes(name))
  ) {
    fail("RESOLVED_STYLES_EXPORT_DRIFT", "Validator source and built style-type exports changed.", {
      requiredValidatorStyleTypes,
      validatorIndex,
      validatorDeclarationIndex,
    });
  }

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M05-T03",
    result: "PASS",
    profile: "desen-runtime-react-resolved-styles-v1",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "web-react",
      summary:
        "The React renderer validates every final component and behavior style through the exact Catalog receiving scope, preserves the semantic state-part-property hierarchy, and leaves state activation to the capability adapter.",
      resolvedStyleReceivingBoundary: true,
      stateActivationOwner: "capability-adapter",
      rendererStateSelection: false,
      rendererStateMerge: false,
      privatePlatformStructure: false,
    }),
    prerequisites: Object.freeze(prerequisites),
    historicalCompatibility: compatibility,
    publicApi: Object.freeze({
      runtimeExports: publicIndex.runtime,
      typeExports: publicIndex.types,
      validatorStyleTypeExports: Object.freeze(requiredValidatorStyleTypes),
      ...declarations,
    }),
    semanticStyle: Object.freeze({
      hierarchy: "visual-state/style-part/property/resolved-json",
      componentValidation: "exact prepared Catalog propertiesSchema",
      behaviorValidation: "exact prepared Catalog propertiesSchema",
      validatedValueDelivered: true,
      detachedAndRecursivelyImmutable: true,
      declaredStatesOnly: true,
      declaredPartsOnly: true,
      componentFailure: Object.freeze({
        code: "INVALID_COMPONENT_STYLE",
        channel: "style",
      }),
      behaviorFailure: Object.freeze({
        code: "INVALID_BEHAVIOR_STYLE",
        channel: "style",
      }),
      invalidStyleDeliveredToAdapter: false,
    }),
    receivingBudget: Object.freeze({
      preparedVisualStates: validator.preparedVisualStates,
      preparedStylePartSchemas: validator.preparedStylePartSchemas,
      oneSharedSchemaBudget: validator.sharedSchemaBudget,
      styleValidationCounter: "maxStyleValidations",
      controlledLimitFailure: "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
    }),
    failureModel: Object.freeze({
      codes: renderer.failures,
      channels: renderer.channels,
      allOrNothingBeforeReactElementCreation: true,
      exactValidatorDiagnosticsPreserved: true,
    }),
    architecture: Object.freeze({
      ...architecture,
      modules: Object.freeze(sorted(new Set([...renderImports, ...registryImports]))),
      dynamicExecutableLoading: 0,
      selectorClassDomRefAuthority: 0,
      stateActivationAuthorityExposedByRenderer: false,
    }),
    traceability,
    evidence: Object.freeze({
      tests,
      trackedFiles: Object.freeze(tracked),
      verifierExecutionProfile: "static-evidence-only",
    }),
    nonclaims: Object.freeze([
      "No CSS, DOM, selector, class-name, or platform style translation claim.",
      "No host-enforced accessibility-preservation claim; N-030 remains PLANNED.",
      "No live event, command, behavior-lifecycle, or React reconciliation claim.",
      "No reference-host, Desen App, native, iOS, Android, SwiftUI, or Compose claim.",
    ]),
  });
  const artifactBytes = await formatArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function parseArtifactReference(markdown, heading, artifactPath, allowPending) {
  const lines = markdown.split(/\r?\n/u);
  const headings = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headings.length !== 1) {
    fail("RESOLVED_STYLES_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = headings[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next === -1 ? lines.length : next;
  const section = lines.slice(start, end);
  const pathLine = `\`${artifactPath}\``;
  const pathIndexes = section.flatMap((line, index) => (line === pathLine ? [index] : []));
  const shaPattern = /^`sha256:([0-9a-f]{64}|\[PENDING_FINAL_ARTIFACT_SHA256\])`\.$/u;
  const shas = section.flatMap((line, index) => {
    const match = line.match(shaPattern);
    return match === null ? [] : [{ index, value: match[1] }];
  });
  if (
    pathIndexes.length !== 1 ||
    shas.length !== 1 ||
    shas[0].index !== pathIndexes[0] + 1 ||
    lines.filter((line) => line.includes(artifactPath)).length !== 1
  ) {
    fail(
      "RESOLVED_STYLES_PROOF_PIN_DRIFT",
      `${heading} must contain one unique adjacent exact path/SHA pair.`,
    );
  }
  const value = shas[0].value;
  if (!allowPending && value === PENDING_ARTIFACT_SHA256) {
    fail("RESOLVED_STYLES_PROOF_PIN_DRIFT", "Production verification rejects pending pins.");
  }
  return value;
}

async function verifyFinalPins(artifactSha256, options) {
  const proofText =
    options.proofDocumentText ?? (await workspaceText(PROOF_DOCUMENT_PATH, options.fileOverrides));
  const matrixText =
    options.proofMatrixText ?? (await workspaceText(PROOF_MATRIX_PATH, options.fileOverrides));
  const proofSha = parseArtifactReference(
    proofText,
    "## Evidence artifact",
    ARTIFACT_RELATIVE_PATH,
    false,
  );
  const matrixSha = parseArtifactReference(
    matrixText,
    "## M05-T03",
    path.basename(ARTIFACT_RELATIVE_PATH),
    false,
  );
  if (proofSha !== artifactSha256 || matrixSha !== artifactSha256) {
    fail(
      "RESOLVED_STYLES_PROOF_PIN_DRIFT",
      "Proof and Proof Matrix must pin the exact deterministic M05-T03 artifact SHA-256.",
    );
  }
}

/** Atomically writes deterministic M05-T03 bytes after complete static evidence inspection. */
export async function writeRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    ["artifactPath", "buildOptions", "beforeAtomicRename"],
    "write",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH;
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOwnDataOptions(
          options.buildOptions,
          ["fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactResolvedStylesEvidence(buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("RESOLVED_STYLES_ARTIFACT_UNSAFE", "Atomic M05-T03 artifact write failed safely.", {
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

/** Rebuilds, byte-compares, and verifies exact final M05-T03 documentation pins. */
export async function verifyRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
  const options = captureOwnDataOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofDocumentText",
      "proofMatrixText",
      "fileOverrides",
      "buildOptions",
    ],
    "verify",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH;
  const injectedArtifactBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  const proofDocumentText = optionalString(options.proofDocumentText, "proofDocumentText");
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const fileOverrides = captureOverrideMap(
    options.fileOverrides,
    ALLOWED_FILE_OVERRIDE_PATHS,
    "fileOverrides",
    "text",
  );
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOwnDataOptions(
          options.buildOptions,
          ["fileOverrides", "prerequisiteBytes"],
          "buildOptions",
        );
  const built = await buildRuntimeReactResolvedStylesEvidence(buildOptions);
  await verifyFinalPins(built.artifactSha256, {
    proofDocumentText,
    proofMatrixText,
    fileOverrides,
  });
  const actualBytes =
    injectedArtifactBytes ??
    (await readRegularBytes(
      artifactPath,
      "RESOLVED_STYLES_ARTIFACT_MISSING",
      "RESOLVED_STYLES_ARTIFACT_UNSAFE",
    ));
  if (!actualBytes.equals(built.artifactBytes)) {
    fail("RESOLVED_STYLES_ARTIFACT_DRIFT", "Tracked M05-T03 artifact differs from rebuild.", {
      expected: built.artifactSha256,
      actual: sha256(actualBytes),
    });
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
    runtimeReactTests: built.artifact.evidence.tests.runtimeReactTests,
    validatorStyleTests: built.artifact.evidence.tests.validatorStyleTests,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
  });
}
