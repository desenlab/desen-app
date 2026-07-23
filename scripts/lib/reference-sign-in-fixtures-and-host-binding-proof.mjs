import { createHash } from "node:crypto";
import { lstat, readFile, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH,
  verifyReferenceTokensAndSyntheticFixturesEvidence,
} from "./reference-tokens-and-synthetic-fixtures-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");

/** Absolute path to the deterministic M03-T08 evidence artifact. */
export const DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json",
);

const DEFAULT_PATHS = Object.freeze({
  operationsConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/operations-consumer.mjs",
  ),
  hostOperationsConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/host-operations-consumer.mjs",
  ),
  testkitConsumerPath: path.join(
    WORKSPACE_ROOT,
    "packages/testkit/test/synthetic-fixtures-consumer.mjs",
  ),
  operationSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/operations/sign-in.ts",
  ),
  operationIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/operations/index.ts",
  ),
  operationDeclarationPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/operations/index.d.ts",
  ),
  operationBuiltSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/operations/sign-in.js",
  ),
  hostBindingSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/host-operations/sign-in.ts",
  ),
  hostIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/host-operations/index.ts",
  ),
  hostDeclarationPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/host-operations/index.d.ts",
  ),
  hostBuiltSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/dist/host-operations/sign-in.js",
  ),
  packageRootIndexSourcePath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/src/index.ts",
  ),
  referencePackagePath: path.join(WORKSPACE_ROOT, "packages/reference-catalog-web/package.json"),
  packageTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/sign-in-operation.test.ts",
  ),
  packageTypeTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/reference-catalog-web/test/sign-in-operation.types.ts",
  ),
  fixturePackageTestPath: path.join(
    WORKSPACE_ROOT,
    "packages/testkit/test/reference-sign-in-fixtures.test.ts",
  ),
  rootTestPath: path.join(
    WORKSPACE_ROOT,
    "tests/reference-sign-in-fixtures-and-host-binding.test.mjs",
  ),
  rootPackagePath: path.join(WORKSPACE_ROOT, "package.json"),
  officialCatalogPath: path.join(
    WORKSPACE_ROOT,
    "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
  ),
  prerequisiteArtifactPath: DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH,
});

const BUILD_OPTION_NAMES = Object.freeze([
  "operationsApi",
  "hostOperationsApi",
  "testkitApi",
  "validatorApi",
  ...Object.keys(DEFAULT_PATHS),
  "verifyPrerequisite",
]);

const SIGN_IN_OPERATION_ID = "com.example.auth/signIn";

const OPERATIONS_RUNTIME_EXPORTS = Object.freeze([
  "SIGN_IN_OPERATION_ID",
  "signInOperationFixtures",
  "signInOperationRegistration",
]);

// Kept separately from runtime exports so the proof rejects declaration-only widening.
const OPERATIONS_TYPE_EXPORTS = Object.freeze([
  "SignInOperationErrorCode",
  "SignInOperationFixtureErrorCode",
  "SignInOperationInput",
  "SignInOperationOutput",
]);

const HOST_RUNTIME_EXPORTS = Object.freeze(["bindReferenceSignInHostOperation"]);
const HOST_TYPE_EXPORTS = Object.freeze([
  "SignInHostOperationBinding",
  "SignInHostOperationHandler",
]);

const PACKAGE_ROOT_RUNTIME_EXPORTS = Object.freeze([
  "WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER",
  "WEB_REACT_PACKAGE_DIGEST_PROFILE",
  "createWebReactPackageDigest",
  "encodeWebReactPackageDigestPreimage",
  "verifyWebReactPackageDigest",
]);

const PACKAGE_ROOT_TYPE_EXPORTS = Object.freeze([
  "WebReactPackageArtifactInput",
  "WebReactPackageDigest",
  "WebReactPackageDigestCalculationInput",
  "WebReactPackageDigestEntry",
  "WebReactPackageDigestVerificationInput",
]);

const TESTKIT_RUNTIME_EXPORTS = Object.freeze([
  "SYNTHETIC_FIXTURE_CONTEXT",
  "createSyntheticFixtureSnapshot",
  "lookupSyntheticOperationError",
  "lookupSyntheticOperationSuccess",
]);

const VALIDATOR_RUNTIME_EXPORTS = Object.freeze([
  "validateDesenExecutionCatalogSet",
  "validateDesenExecutionValue",
]);

const EXPECTED_PACKAGE_TEST_TITLES = Object.freeze([
  "registers the exact inert sign-in contract and controlled authoring fixtures",
  "binds the fixed capability to the exact handler without eager execution or wrapping",
  "rejects non-functions and cannot pass an executable binding through manifest registration",
]);

const EXPECTED_FIXTURE_PACKAGE_TEST_TITLES = Object.freeze([
  "projects the controlled success and invalid-credentials outcomes without host data",
  "rejects the trusted host binding as synthetic operation data",
]);

const EXPECTED_TYPE_NEGATIVE_CASES = Object.freeze(
  Array.from({ length: 10 }, (_, index) => `M03-T08-N${String(index + 1).padStart(2, "0")}`),
);

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T08 evidence",
  "builds byte-identical evidence twice",
  "labels explicit build options as injected evidence",
  "rejects inherited accessor-backed symbolic and unknown options",
  "rejects stale or one-byte-tampered evidence",
  "rejects missing mismatched or skipped M03-T07 prerequisite evidence",
  "rejects official manifest or fixture drift",
  "rejects host binding identity invocation or guardrail drift",
  "rejects public export package and source-boundary drift",
  "rejects package-test compiler-negative and root-test inventory drift",
  "rejects inert or incomplete root command wiring",
  "rejects tracked-artifact verification through a symlink alias",
  "writes and verifies an injected artifact atomically and detects pre-rename tampering",
]);

const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm verify:reference-tokens-and-synthetic-fixtures && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:sign-in-operation && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:reference-sign-in-fixtures && node scripts/generate-reference-sign-in-fixtures-and-host-binding-proof.mjs",
  verify:
    "pnpm verify:reference-tokens-and-synthetic-fixtures && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:sign-in-operation && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:reference-sign-in-fixtures && node scripts/verify-reference-sign-in-fixtures-and-host-binding.mjs",
  test: "pnpm verify:reference-tokens-and-synthetic-fixtures && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:sign-in-operation && pnpm --filter @desen/testkit... build && pnpm --filter @desen/testkit typecheck && pnpm --filter @desen/testkit test:reference-sign-in-fixtures && node --test tests/reference-sign-in-fixtures-and-host-binding.test.mjs",
});

const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "docs/plan/PROTOCOL-FINDINGS.md",
  "docs/proof/REFERENCE-SIGN-IN-FIXTURES-AND-HOST-BINDING.md",
  "packages/reference-catalog-web/README.md",
  "packages/reference-catalog-web/package.json",
  "packages/reference-catalog-web/src/operations/sign-in.ts",
  "packages/reference-catalog-web/src/operations/index.ts",
  "packages/reference-catalog-web/src/host-operations/sign-in.ts",
  "packages/reference-catalog-web/src/host-operations/index.ts",
  "packages/reference-catalog-web/test/sign-in-operation.test.ts",
  "packages/reference-catalog-web/test/sign-in-operation.types.ts",
  "packages/reference-catalog-web/test/operations-consumer.mjs",
  "packages/reference-catalog-web/test/host-operations-consumer.mjs",
  "packages/testkit/README.md",
  "packages/testkit/package.json",
  "packages/testkit/test/reference-sign-in-fixtures.test.ts",
  "scripts/generate-reference-sign-in-fixtures-and-host-binding-proof.mjs",
  "scripts/verify-reference-sign-in-fixtures-and-host-binding.mjs",
  "scripts/lib/reference-sign-in-fixtures-and-host-binding-proof.mjs",
  "tests/reference-sign-in-fixtures-and-host-binding.test.mjs",
  "package.json",
  "pnpm-lock.yaml",
]);

const FORBIDDEN_PLATFORM_IMPORTS = Object.freeze([
  "react",
  "react-dom",
  "react-native",
  "@desen/testkit",
]);

const FORBIDDEN_PLATFORM_IDENTIFIERS = new Set([
  "document",
  "window",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
]);

const FORBIDDEN_DOCUMENT_BINDING_KEYS = new Set([
  "authorization",
  "binding",
  "credential",
  "database",
  "endpoint",
  "execute",
  "handler",
  "implementation",
  "invoke",
  "read",
  "sdk",
  "service",
  "url",
]);

/** Stable proof failure with a machine-readable code and optional inert details. */
export class ReferenceSignInFixturesAndHostBindingEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceSignInFixturesAndHostBindingEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceSignInFixturesAndHostBindingEvidenceError(code, message, details);
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted(values) {
  return [...values].sort(compareText);
}

function assertArrayEqual(actual, expected, code, message) {
  assertCondition(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    code,
    message,
    { actual, expected },
  );
}

function normalizeOptions(options, allowedNames, label) {
  if (options === undefined) return Object.freeze(Object.create(null));
  assertCondition(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "SIGN_IN_BINDING_OPTIONS_INVALID",
    `${label} options must be a plain record.`,
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch (error) {
    fail("SIGN_IN_BINDING_OPTIONS_INVALID", `${label} options could not be inspected safely.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertCondition(
    prototype === Object.prototype || prototype === null,
    "SIGN_IN_BINDING_OPTIONS_INVALID",
    `${label} options may not inherit configuration.`,
  );
  const allowed = new Set(allowedNames);
  const normalized = Object.create(null);
  for (const key of keys) {
    assertCondition(
      typeof key === "string" && allowed.has(key),
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      `${label} options contain an unknown or symbolic key.`,
    );
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    assertCondition(
      descriptor !== undefined &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.enumerable === true,
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      `${label} option ${String(key)} must be an enumerable own data property.`,
    );
    normalized[key] = descriptor.value;
  }
  return Object.freeze(normalized);
}

function validateBuildOptions(options) {
  for (const name of Object.keys(DEFAULT_PATHS)) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        typeof options[name] === "string" && options[name].length > 0,
        "SIGN_IN_BINDING_OPTIONS_INVALID",
        `Build option ${name} must be a non-empty path string.`,
      );
    }
  }
  for (const name of ["operationsApi", "hostOperationsApi", "testkitApi", "validatorApi"]) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        options[name] !== null &&
          (typeof options[name] === "object" || typeof options[name] === "function"),
        "SIGN_IN_BINDING_OPTIONS_INVALID",
        `Build option ${name} must be object-like.`,
      );
    }
  }
  if (Object.hasOwn(options, "verifyPrerequisite")) {
    assertCondition(
      typeof options.verifyPrerequisite === "boolean",
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      "Build option verifyPrerequisite must be boolean.",
    );
  }
}

function captureApi(module, names, label, options = {}) {
  if (options.exact === true) {
    const ownKeys = Reflect.ownKeys(module);
    const stringKeys = sorted(ownKeys.filter((key) => typeof key === "string"));
    const symbolKeys = ownKeys.filter((key) => typeof key === "symbol");
    assertArrayEqual(
      stringKeys,
      sorted(names),
      "SIGN_IN_BINDING_PUBLIC_API_DRIFT",
      `${label} must expose exactly its declared runtime exports.`,
    );
    assertCondition(
      symbolKeys.every((key) => key === Symbol.toStringTag),
      "SIGN_IN_BINDING_PUBLIC_API_DRIFT",
      `${label} acquired a symbolic export.`,
    );
  }
  const captured = Object.create(null);
  const descriptors = new Map();
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(module, name);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "SIGN_IN_BINDING_PUBLIC_API_DRIFT",
      `${label} export ${name} must be an own data property.`,
    );
    captured[name] = descriptor.value;
    descriptors.set(name, descriptor.value);
  }
  return Object.freeze({
    api: Object.freeze(captured),
    assertStable() {
      for (const [name, value] of descriptors) {
        const descriptor = Object.getOwnPropertyDescriptor(module, name);
        assertCondition(
          descriptor !== undefined &&
            Object.hasOwn(descriptor, "value") &&
            descriptor.value === value,
          "SIGN_IN_BINDING_PUBLIC_API_DRIFT",
          `${label} export ${name} changed during evidence construction.`,
        );
      }
    },
  });
}

function assertDeeplyFrozen(value, label, active = new Set()) {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    active.has(value)
  ) {
    return;
  }
  active.add(value);
  assertCondition(
    Object.isFrozen(value),
    "SIGN_IN_BINDING_MUTABILITY_DRIFT",
    `${label} must be recursively frozen.`,
  );
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "SIGN_IN_BINDING_ACCESSOR_DRIFT",
      `${label}.${String(key)} must be a data property.`,
    );
    assertDeeplyFrozen(descriptor.value, `${label}.${String(key)}`, active);
  }
}

function inspectPlainJson(value, label) {
  const active = new Set();
  function visit(current, pathLabel) {
    if (current === null || typeof current === "string" || typeof current === "boolean") return;
    if (typeof current === "number") {
      assertCondition(
        Number.isFinite(current),
        "SIGN_IN_BINDING_JSON_DRIFT",
        `${pathLabel} contains a non-finite number.`,
      );
      return;
    }
    assertCondition(
      typeof current === "object" && current !== null,
      "SIGN_IN_BINDING_EXECUTABLE_LEAK",
      `${pathLabel} contains an executable or non-JSON value.`,
    );
    assertCondition(
      !active.has(current),
      "SIGN_IN_BINDING_JSON_DRIFT",
      `${pathLabel} contains a cycle.`,
    );
    active.add(current);
    const prototype = Object.getPrototypeOf(current);
    assertCondition(
      Array.isArray(current)
        ? prototype === Array.prototype
        : prototype === Object.prototype || prototype === null,
      "SIGN_IN_BINDING_JSON_DRIFT",
      `${pathLabel} contains an unsupported object prototype.`,
    );
    const keys = Reflect.ownKeys(current);
    if (Array.isArray(current)) {
      const expectedKeys = [
        ...Array.from({ length: current.length }, (_, index) => String(index)),
        "length",
      ];
      assertCondition(
        keys.length === expectedKeys.length &&
          keys.every((key, index) => key === expectedKeys[index]),
        "SIGN_IN_BINDING_JSON_DRIFT",
        `${pathLabel} must be a dense JSON array without extra or symbolic properties.`,
      );
    }
    for (const key of keys) {
      assertCondition(
        typeof key === "string",
        "SIGN_IN_BINDING_JSON_DRIFT",
        `${pathLabel} contains a symbol property.`,
      );
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (Array.isArray(current) && key === "length") {
        assertCondition(
          descriptor !== undefined &&
            Object.hasOwn(descriptor, "value") &&
            descriptor.enumerable === false,
          "SIGN_IN_BINDING_ACCESSOR_DRIFT",
          `${pathLabel}.length must be the standard array data property.`,
        );
        continue;
      }
      assertCondition(
        descriptor !== undefined &&
          descriptor.enumerable === true &&
          Object.hasOwn(descriptor, "value"),
        "SIGN_IN_BINDING_ACCESSOR_DRIFT",
        `${pathLabel}.${key} must be an enumerable data property.`,
      );
      assertCondition(
        !FORBIDDEN_DOCUMENT_BINDING_KEYS.has(key.toLowerCase()),
        "SIGN_IN_BINDING_EXECUTABLE_LEAK",
        `${pathLabel}.${key} places a host binding or service selector in inert data.`,
      );
      visit(descriptor.value, `${pathLabel}.${key}`);
    }
    active.delete(current);
  }
  visit(value, label);
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assertCondition(
      Number.isFinite(value),
      "SIGN_IN_BINDING_JSON_DRIFT",
      "Canonical comparison received a non-finite number.",
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  assertCondition(
    typeof value === "object" && value !== null,
    "SIGN_IN_BINDING_JSON_DRIFT",
    "Canonical comparison received non-JSON data.",
  );
  return `{${Object.keys(value)
    .sort(compareText)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function assertJsonEqual(actual, expected, code, message) {
  const actualCanonical = canonicalJson(actual);
  const expectedCanonical = canonicalJson(expected);
  assertCondition(actualCanonical === expectedCanonical, code, message, {
    actual,
    expected,
  });
}

function parseSource(source, relativePath) {
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    scriptKind,
  );
  assertCondition(
    sourceFile.parseDiagnostics.length === 0,
    "SIGN_IN_BINDING_SOURCE_DRIFT",
    `${relativePath} no longer parses as TypeScript/JavaScript.`,
    {
      diagnostics: sourceFile.parseDiagnostics.map(({ messageText }) => String(messageText)),
    },
  );
  return sourceFile;
}

function auditSource(source, relativePath, allowedInternalImports, options = {}) {
  const sourceFile = parseSource(source, relativePath);
  const imports = [];
  const importBindings = [];
  const moduleReExports = [];
  const forbiddenIdentifiers = [];
  const serviceLiterals = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
      assertCondition(
        node.importClause !== undefined,
        "SIGN_IN_BINDING_IMPORT_BOUNDARY_DRIFT",
        `${relativePath} contains a side-effect-only import.`,
      );
      assertCondition(
        node.importClause.name === undefined &&
          node.importClause.namedBindings !== undefined &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.length > 0 &&
          node.attributes === undefined &&
          node.assertClause === undefined,
        "SIGN_IN_BINDING_IMPORT_BOUNDARY_DRIFT",
        `${relativePath} imports must use non-empty named bindings without defaults, namespaces, or attributes.`,
      );
      for (const element of node.importClause.namedBindings.elements) {
        const imported = element.propertyName?.text ?? element.name.text;
        assertCondition(
          imported === element.name.text,
          "SIGN_IN_BINDING_IMPORT_BOUNDARY_DRIFT",
          `${relativePath} may not alias import ${imported}.`,
        );
        importBindings.push(
          `${node.importClause.isTypeOnly || element.isTypeOnly ? "type" : "runtime"}:${node.moduleSpecifier.text}:${imported}`,
        );
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      moduleReExports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      fail("SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT", `${relativePath} contains a dynamic import.`);
    }
    if (
      (ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require") ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportTypeNode(node)
    ) {
      fail(
        "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT",
        `${relativePath} contains an unchecked module-loading form.`,
      );
    }
    if (ts.isIdentifier(node) && FORBIDDEN_PLATFORM_IDENTIFIERS.has(node.text)) {
      forbiddenIdentifiers.push(node.text);
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text !== "https://json-schema.org/draft/2020-12/schema" &&
      /(?:https?:\/\/|postgres(?:ql)?:\/\/|mongodb(?:\+srv)?:\/\/)/iu.test(node.text)
    ) {
      serviceLiterals.push(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  for (const specifier of imports) {
    const allowed =
      allowedInternalImports.some(
        (entry) => specifier === entry || (entry.endsWith("/") && specifier.startsWith(entry)),
      ) ||
      (specifier.startsWith("./") && options.allowRelative === true) ||
      (specifier.startsWith("../") && options.allowParentRelative === true);
    assertCondition(
      allowed && !FORBIDDEN_PLATFORM_IMPORTS.includes(specifier) && !specifier.startsWith("node:"),
      "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT",
      `${relativePath} imports forbidden dependency ${specifier}.`,
    );
  }
  assertCondition(
    moduleReExports.length === 0,
    "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT",
    `${relativePath} may not add a transitive module through a re-export.`,
    { moduleReExports: sorted(moduleReExports) },
  );
  if (options.expectedImports !== undefined) {
    assertArrayEqual(
      sorted(importBindings),
      sorted(options.expectedImports),
      "SIGN_IN_BINDING_IMPORT_BOUNDARY_DRIFT",
      `${relativePath} import bindings changed.`,
    );
  }
  assertCondition(
    forbiddenIdentifiers.length === 0 && serviceLiterals.length === 0,
    "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT",
    `${relativePath} acquired a platform global or service selector.`,
    { forbiddenIdentifiers, serviceLiterals },
  );
  return Object.freeze({
    path: relativePath,
    imports: Object.freeze(sorted(imports)),
    platformGlobals: Object.freeze([]),
    serviceSelectors: Object.freeze([]),
  });
}

function inspectExactReExportSurface(
  source,
  relativePath,
  moduleSpecifier,
  runtimeExpected,
  typeExpected,
  code = "SIGN_IN_BINDING_EXPORT_DRIFT",
) {
  const sourceFile = parseSource(source, relativePath);
  const runtime = [];
  const types = [];
  for (const statement of sourceFile.statements) {
    assertCondition(
      ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === moduleSpecifier &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.attributes === undefined &&
        statement.assertClause === undefined,
      code,
      `${relativePath} must contain only explicit named re-exports from ${moduleSpecifier}.`,
    );
    for (const element of statement.exportClause.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      assertCondition(
        imported === element.name.text,
        code,
        `${relativePath} may not alias re-export ${imported}.`,
      );
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  assertCondition(
    new Set(runtime).size === runtime.length && new Set(types).size === types.length,
    code,
    `${relativePath} contains duplicate re-exports.`,
  );
  assertArrayEqual(
    sorted(runtime),
    sorted(runtimeExpected),
    code,
    `${relativePath} runtime exports changed.`,
  );
  assertArrayEqual(
    sorted(types),
    sorted(typeExpected),
    code,
    `${relativePath} type exports changed.`,
  );
  return Object.freeze({
    moduleSpecifier,
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
  });
}

function inspectHostTypeContract(source) {
  const relativePath = "packages/reference-catalog-web/src/host-operations/sign-in.ts";
  const sourceFile = parseSource(source, relativePath);
  const handlerAlias = sourceFile.statements.find(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === "SignInHostOperationHandler",
  );
  assertCondition(
    handlerAlias !== undefined &&
      ts.isFunctionTypeNode(handlerAlias.type) &&
      handlerAlias.type.parameters.length === 1 &&
      handlerAlias.type.parameters[0].name.getText(sourceFile) === "input" &&
      handlerAlias.type.parameters[0].type?.getText(sourceFile) === "SignInOperationInput" &&
      handlerAlias.type.type.kind === ts.SyntaxKind.UnknownKeyword,
    "SIGN_IN_BINDING_HOST_TYPE_DRIFT",
    "The trusted sign-in handler must accept the exact input and leave its return value unknown.",
  );

  const bindingInterface = sourceFile.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === "SignInHostOperationBinding",
  );
  const prematureResultDeclarations = sourceFile.statements.filter(
    (statement) =>
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      /(?:Result|Outcome|Settlement)$/u.test(statement.name.text),
  );
  const bindingMembers =
    bindingInterface === undefined ? [] : bindingInterface.members.filter(ts.isPropertySignature);
  assertCondition(
    bindingInterface !== undefined &&
      bindingMembers.length === 2 &&
      bindingMembers.every((member) =>
        member.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ReadonlyKeyword),
      ) &&
      bindingMembers.some(
        (member) =>
          member.name.getText(sourceFile) === "operationId" &&
          member.type?.getText(sourceFile) === "typeof SIGN_IN_OPERATION_ID",
      ) &&
      bindingMembers.some(
        (member) =>
          member.name.getText(sourceFile) === "invoke" &&
          member.type?.getText(sourceFile) === "SignInHostOperationHandler",
      ) &&
      prematureResultDeclarations.length === 0,
    "SIGN_IN_BINDING_HOST_TYPE_DRIFT",
    "The trusted sign-in binding must expose only readonly operationId and invoke members without defining a result envelope.",
  );

  return Object.freeze({
    handlerInput: "SignInOperationInput",
    handlerReturn: "unknown",
    bindingMembers: Object.freeze(["invoke", "operationId"]),
    bindingMembersReadonly: true,
    resultEnvelopeDefined: false,
  });
}

function assertExactPackageExport(referencePackage, subpath, expected) {
  const actual = referencePackage.exports?.[subpath];
  assertCondition(
    actual !== null &&
      typeof actual === "object" &&
      !Array.isArray(actual) &&
      sorted(Object.keys(actual)).join(",") === "import,types" &&
      actual.types === expected.types &&
      actual.import === expected.import,
    "SIGN_IN_BINDING_PACKAGE_EXPORT_DRIFT",
    `The package export ${subpath} changed or acquired an alternate condition.`,
    { actual, expected },
  );
}

function inspectPublicSurfaces({
  operationIndexSource,
  operationDeclaration,
  hostIndexSource,
  hostDeclaration,
  hostBindingSource,
  packageRootIndexSource,
  operationsConsumer,
  hostOperationsConsumer,
  referencePackage,
}) {
  for (const [source, relativePath, moduleSpecifier, runtimeExpected, typeExpected, code] of [
    [
      operationIndexSource,
      "packages/reference-catalog-web/src/operations/index.ts",
      "./sign-in.js",
      OPERATIONS_RUNTIME_EXPORTS,
      OPERATIONS_TYPE_EXPORTS,
    ],
    [
      operationDeclaration,
      "packages/reference-catalog-web/dist/operations/index.d.ts",
      "./sign-in.js",
      OPERATIONS_RUNTIME_EXPORTS,
      OPERATIONS_TYPE_EXPORTS,
    ],
    [
      hostIndexSource,
      "packages/reference-catalog-web/src/host-operations/index.ts",
      "./sign-in.js",
      HOST_RUNTIME_EXPORTS,
      HOST_TYPE_EXPORTS,
    ],
    [
      hostDeclaration,
      "packages/reference-catalog-web/dist/host-operations/index.d.ts",
      "./sign-in.js",
      HOST_RUNTIME_EXPORTS,
      HOST_TYPE_EXPORTS,
    ],
    [
      packageRootIndexSource,
      "packages/reference-catalog-web/src/index.ts",
      "./package-digest-profile.js",
      PACKAGE_ROOT_RUNTIME_EXPORTS,
      PACKAGE_ROOT_TYPE_EXPORTS,
      "SIGN_IN_BINDING_PACKAGE_ROOT_LEAK",
    ],
  ]) {
    inspectExactReExportSurface(
      source,
      relativePath,
      moduleSpecifier,
      runtimeExpected,
      typeExpected,
      code,
    );
  }

  inspectExactReExportSurface(
    operationsConsumer,
    "packages/reference-catalog-web/test/operations-consumer.mjs",
    "@desen/reference-catalog-web/operations",
    OPERATIONS_RUNTIME_EXPORTS,
    [],
    "SIGN_IN_BINDING_PACKAGE_CONSUMER_DRIFT",
  );
  inspectExactReExportSurface(
    hostOperationsConsumer,
    "packages/reference-catalog-web/test/host-operations-consumer.mjs",
    "@desen/reference-catalog-web/host-operations",
    HOST_RUNTIME_EXPORTS,
    [],
    "SIGN_IN_BINDING_PACKAGE_CONSUMER_DRIFT",
  );

  assertExactPackageExport(referencePackage, ".", {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  });
  assertExactPackageExport(referencePackage, "./operations", {
    types: "./dist/operations/index.d.ts",
    import: "./dist/operations/index.js",
  });
  assertExactPackageExport(referencePackage, "./host-operations", {
    types: "./dist/host-operations/index.d.ts",
    import: "./dist/host-operations/index.js",
  });
  assertCondition(
    !Object.hasOwn(referencePackage.dependencies ?? {}, "@desen/testkit") &&
      !Object.hasOwn(referencePackage.dependencies ?? {}, "react") &&
      !Object.hasOwn(referencePackage.dependencies ?? {}, "react-dom"),
    "SIGN_IN_BINDING_PLATFORM_BOUNDARY_DRIFT",
    "The reference production package acquired testkit or React as a runtime dependency.",
  );
  assertCondition(
    OPERATIONS_RUNTIME_EXPORTS.every((name) => !HOST_RUNTIME_EXPORTS.includes(name)) &&
      OPERATIONS_TYPE_EXPORTS.every((name) => !HOST_TYPE_EXPORTS.includes(name)),
    "SIGN_IN_BINDING_EXPORT_DRIFT",
    "Inert operation and executable host-binding exports overlap.",
  );

  return Object.freeze({
    operationPackage: "@desen/reference-catalog-web/operations",
    hostOperationPackage: "@desen/reference-catalog-web/host-operations",
    operationRuntimeExports: OPERATIONS_RUNTIME_EXPORTS,
    operationTypeExports: OPERATIONS_TYPE_EXPORTS,
    hostRuntimeExports: HOST_RUNTIME_EXPORTS,
    hostTypeExports: HOST_TYPE_EXPORTS,
    packageRootRuntimeExports: PACKAGE_ROOT_RUNTIME_EXPORTS,
    packageRootTypeExports: PACKAGE_ROOT_TYPE_EXPORTS,
    operationModuleGraph: Object.freeze({
      entry: "packages/reference-catalog-web/src/operations/index.ts",
      modules: Object.freeze([
        "packages/reference-catalog-web/src/operations/index.ts",
        "packages/reference-catalog-web/src/operations/sign-in.ts",
      ]),
      localEdges: Object.freeze([
        "packages/reference-catalog-web/src/operations/index.ts -> ./sign-in.js",
      ]),
      closed: true,
    }),
    hostTypeContract: inspectHostTypeContract(hostBindingSource),
  });
}

function inspectOperationAndFixtures(operationsApi, testkitApi, validatorApi, officialCatalog) {
  const officialManifest = officialCatalog.operations?.[SIGN_IN_OPERATION_ID];
  assertCondition(
    officialManifest !== undefined,
    "SIGN_IN_BINDING_OFFICIAL_INPUT_DRIFT",
    "The frozen official Catalog lost the sign-in operation.",
  );
  const officialFixtures = officialManifest.authoring?.fixtures;
  assertCondition(
    officialFixtures !== undefined,
    "SIGN_IN_BINDING_OFFICIAL_INPUT_DRIFT",
    "The frozen official sign-in operation lost its fixtures.",
  );

  assertCondition(
    operationsApi.SIGN_IN_OPERATION_ID === SIGN_IN_OPERATION_ID,
    "SIGN_IN_BINDING_MANIFEST_DRIFT",
    "The public sign-in operation id changed.",
  );
  assertCondition(
    operationsApi.signInOperationFixtures ===
      operationsApi.signInOperationRegistration.manifest.authoring.fixtures,
    "SIGN_IN_BINDING_FIXTURE_IDENTITY_DRIFT",
    "The public fixture export must be the exact manifest-owned fixture object.",
  );
  assertDeeplyFrozen(operationsApi.signInOperationRegistration, "signInOperationRegistration");
  assertDeeplyFrozen(operationsApi.signInOperationFixtures, "signInOperationFixtures");
  inspectPlainJson(operationsApi.signInOperationRegistration, "signInOperationRegistration");
  inspectPlainJson(operationsApi.signInOperationFixtures, "signInOperationFixtures");
  assertJsonEqual(
    operationsApi.signInOperationRegistration,
    { id: SIGN_IN_OPERATION_ID, manifest: officialManifest },
    "SIGN_IN_BINDING_MANIFEST_DRIFT",
    "The public sign-in registration differs from the frozen official Catalog.",
  );
  assertJsonEqual(
    operationsApi.signInOperationFixtures,
    officialFixtures,
    "SIGN_IN_BINDING_FIXTURE_DRIFT",
    "The public sign-in fixtures differ from the frozen official Catalog.",
  );

  const snapshot = testkitApi.createSyntheticFixtureSnapshot({
    context: testkitApi.SYNTHETIC_FIXTURE_CONTEXT,
    operations: [operationsApi.signInOperationRegistration],
    resources: [],
  });
  assertDeeplyFrozen(snapshot, "sign-in fixture snapshot");
  inspectPlainJson(snapshot, "sign-in fixture snapshot");
  const expectedSnapshot = {
    context: {
      kind: "synthetic-authoring-fixture",
      source: "manifest.authoring.fixtures",
    },
    operations: {
      [SIGN_IN_OPERATION_ID]: {
        errors: { invalidCredentials: {} },
        success: { userId: "user-1" },
      },
    },
    resources: {},
  };
  assertJsonEqual(
    snapshot,
    expectedSnapshot,
    "SIGN_IN_BINDING_FIXTURE_DRIFT",
    "The projected sign-in fixture snapshot changed.",
  );
  const registeredFixtures = operationsApi.signInOperationRegistration.manifest.authoring.fixtures;
  const projectedFixtures = snapshot.operations[SIGN_IN_OPERATION_ID];
  assertCondition(
    projectedFixtures.success !== registeredFixtures.success &&
      projectedFixtures.errors !== registeredFixtures.errors &&
      projectedFixtures.errors.invalidCredentials !== registeredFixtures.errors.invalidCredentials,
    "SIGN_IN_BINDING_FIXTURE_ALIAS_DRIFT",
    "The synthetic snapshot must detach success and error fixture values from the manifest.",
  );

  const success = testkitApi.lookupSyntheticOperationSuccess(snapshot, SIGN_IN_OPERATION_ID);
  const invalidCredentials = testkitApi.lookupSyntheticOperationError(
    snapshot,
    SIGN_IN_OPERATION_ID,
    "invalidCredentials",
  );
  const unavailable = testkitApi.lookupSyntheticOperationError(
    snapshot,
    SIGN_IN_OPERATION_ID,
    "unavailable",
  );
  for (const [label, result] of [
    ["success", success],
    ["invalidCredentials", invalidCredentials],
    ["unavailable", unavailable],
  ]) {
    assertDeeplyFrozen(result, `${label} fixture lookup`);
    inspectPlainJson(result, `${label} fixture lookup`);
  }
  assertCondition(
    success.status === "found" &&
      canonicalJson(success.value) === canonicalJson({ userId: "user-1" }) &&
      invalidCredentials.status === "found" &&
      canonicalJson(invalidCredentials.value) === canonicalJson({}) &&
      unavailable.status === "missing",
    "SIGN_IN_BINDING_FIXTURE_DRIFT",
    "Sign-in fixture found/missing semantics changed.",
    { success, invalidCredentials, unavailable },
  );

  const catalogSet = validatorApi.validateDesenExecutionCatalogSet([officialCatalog]);
  assertCondition(
    catalogSet.valid === true,
    "SIGN_IN_BINDING_SCHEMA_VALIDATION_DRIFT",
    "The frozen official Catalog no longer prepares for execution-value validation.",
    { diagnostics: catalogSet.diagnostics },
  );
  const validatedSuccess = validatorApi.validateDesenExecutionValue(
    success.value,
    { kind: "operation-output", capabilityId: SIGN_IN_OPERATION_ID },
    catalogSet.value,
  );
  assertCondition(
    validatedSuccess.valid === true &&
      canonicalJson(validatedSuccess.value) === canonicalJson({ userId: "user-1" }),
    "SIGN_IN_BINDING_SCHEMA_VALIDATION_DRIFT",
    "The sign-in success fixture no longer satisfies its declared output schema.",
    { diagnostics: validatedSuccess.diagnostics },
  );

  return Object.freeze({
    operationId: SIGN_IN_OPERATION_ID,
    registration: operationsApi.signInOperationRegistration,
    fixtures: operationsApi.signInOperationFixtures,
    snapshot,
    lookups: Object.freeze({
      success,
      invalidCredentials,
      unavailable,
    }),
    successOutputSchemaValid: true,
    successSelector: Object.freeze({
      kind: "operation-output",
      capabilityId: SIGN_IN_OPERATION_ID,
    }),
    pendingFixtureClaimed: false,
  });
}

async function inspectHostBinding(hostOperationsApi) {
  let calls = 0;
  let received;
  const opaqueResult = Symbol("host-owned-opaque-result");
  const handler = async (input) => {
    calls += 1;
    received = input;
    return opaqueResult;
  };
  const binding = hostOperationsApi.bindReferenceSignInHostOperation(handler);
  assertCondition(
    calls === 0,
    "SIGN_IN_BINDING_HANDLER_DRIFT",
    "Binding the trusted sign-in handler invoked it eagerly.",
  );
  const bindingKeys = Reflect.ownKeys(binding);
  assertCondition(
    binding !== null &&
      typeof binding === "object" &&
      Object.isFrozen(binding) &&
      bindingKeys.every((key) => typeof key === "string") &&
      sorted(bindingKeys).join(",") === "invoke,operationId" &&
      binding.operationId === SIGN_IN_OPERATION_ID &&
      binding.invoke === handler,
    "SIGN_IN_BINDING_HANDLER_DRIFT",
    "The host binding changed identity, shape, operation id, or handler reference.",
  );
  const input = Object.freeze({
    email: "synthetic-author@example.invalid",
    password: "synthetic-passphrase",
  });
  const returned = await binding.invoke(input);
  assertCondition(
    calls === 1 && received === input && returned === opaqueResult,
    "SIGN_IN_BINDING_HANDLER_DRIFT",
    "The bound handler did not preserve the exact host-owned input and opaque return identities.",
  );

  for (const invalid of [undefined, null, false, 0, "", {}, []]) {
    let rejection;
    try {
      hostOperationsApi.bindReferenceSignInHostOperation(invalid);
    } catch (error) {
      rejection = error;
    }
    assertCondition(
      rejection instanceof TypeError,
      "SIGN_IN_BINDING_HANDLER_GUARD_DRIFT",
      "A non-function host handler was not rejected with TypeError.",
      { invalidType: invalid === null ? "null" : typeof invalid },
    );
  }

  return Object.freeze({
    operationId: binding.operationId,
    wrapperFrozen: true,
    exactWrapperKeys: Object.freeze(["invoke", "operationId"]),
    handlerIdentityPreserved: true,
    handlerInvokedDuringBinding: false,
    invocationForwardsExactInput: true,
    invocationPreservesOpaqueResultIdentity: true,
    returnValueContractClaimed: false,
    nonFunctionHandlersRejected: true,
    executableStoredInCatalogOrFixtures: false,
  });
}

function extractTestTitles(source, relativePath) {
  parseSource(source, relativePath);
  return [...source.matchAll(/\bit\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function extractRootTestTitles(source) {
  parseSource(source, "tests/reference-sign-in-fixtures-and-host-binding.test.mjs");
  return [...source.matchAll(/\btest\(\s*["'`]([^"'`]+)["'`]/gu)].map((match) => match[1]);
}

function extractNegativeCases(source) {
  return [...source.matchAll(/@ts-expect-error\s+(M03-T08-N[0-9]{2})\b/gu)].map(
    (match) => match[1],
  );
}

function inspectInventories(packageTest, fixturePackageTest, packageTypeTest, rootTest) {
  const packageTests = extractTestTitles(
    packageTest,
    "packages/reference-catalog-web/test/sign-in-operation.test.ts",
  );
  const fixturePackageTests = extractTestTitles(
    fixturePackageTest,
    "packages/testkit/test/reference-sign-in-fixtures.test.ts",
  );
  const typeNegativeCases = extractNegativeCases(packageTypeTest);
  const rootTests = extractRootTestTitles(rootTest);
  assertArrayEqual(
    packageTests,
    EXPECTED_PACKAGE_TEST_TITLES,
    "SIGN_IN_BINDING_TEST_INVENTORY_DRIFT",
    "The M03-T08 package test inventory changed.",
  );
  assertArrayEqual(
    fixturePackageTests,
    EXPECTED_FIXTURE_PACKAGE_TEST_TITLES,
    "SIGN_IN_BINDING_TEST_INVENTORY_DRIFT",
    "The M03-T08 testkit fixture test inventory changed.",
  );
  assertArrayEqual(
    typeNegativeCases,
    EXPECTED_TYPE_NEGATIVE_CASES,
    "SIGN_IN_BINDING_TYPE_INVENTORY_DRIFT",
    "The M03-T08 compiler-negative inventory changed.",
  );
  assertArrayEqual(
    rootTests,
    EXPECTED_ROOT_TEST_TITLES,
    "SIGN_IN_BINDING_TEST_INVENTORY_DRIFT",
    "The M03-T08 root proof test inventory changed.",
  );
  return Object.freeze({
    packageTests: Object.freeze(packageTests),
    fixturePackageTests: Object.freeze(fixturePackageTests),
    typeNegativeCases: Object.freeze(typeNegativeCases),
    rootTests: Object.freeze(rootTests),
  });
}

function inspectRootWiring(rootPackage) {
  for (const [kind, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const name = `${kind}:reference-sign-in-fixtures-and-host-binding`;
    assertCondition(
      rootPackage.scripts?.[name] === expected,
      "SIGN_IN_BINDING_ROOT_WIRING_DRIFT",
      `Root script ${name} changed or became incomplete.`,
      { actual: rootPackage.scripts?.[name], expected },
    );
  }
  for (const [aggregate, command] of [
    ["test", "test:reference-sign-in-fixtures-and-host-binding"],
    ["check", "verify:reference-sign-in-fixtures-and-host-binding"],
  ]) {
    const script = rootPackage.scripts?.[aggregate];
    assertCondition(
      typeof script === "string" &&
        script.includes(command) &&
        script.indexOf(command) >
          script.indexOf(
            aggregate === "test"
              ? "test:reference-tokens-and-synthetic-fixtures"
              : "verify:reference-tokens-and-synthetic-fixtures",
          ),
      "SIGN_IN_BINDING_ROOT_WIRING_DRIFT",
      `Root ${aggregate} no longer runs M03-T08 after its M03-T07 prerequisite.`,
    );
  }
}

async function verifyPrerequisite(artifactPath) {
  let verification;
  try {
    verification = await verifyReferenceTokensAndSyntheticFixturesEvidence({ artifactPath });
  } catch (error) {
    fail("SIGN_IN_BINDING_PREREQUISITE_DRIFT", "M03-T07 prerequisite verification failed.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  let bytes;
  try {
    bytes = await readFile(artifactPath);
  } catch (error) {
    fail("SIGN_IN_BINDING_PREREQUISITE_DRIFT", "M03-T07 prerequisite could not be read.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes);
  } catch {
    fail("SIGN_IN_BINDING_PREREQUISITE_DRIFT", "M03-T07 prerequisite is not valid JSON.");
  }
  assertCondition(
    artifact.schemaVersion === 1 &&
      artifact.task === "M03-T07" &&
      artifact.result === "PASS" &&
      artifact.claim?.protocol === "0.1.0" &&
      artifact.claim?.target === "web-react" &&
      artifact.evidence?.provenance?.mode === "tracked-defaults",
    "SIGN_IN_BINDING_PREREQUISITE_DRIFT",
    "M03-T07 prerequisite identity or provenance changed.",
  );
  const digest = sha256(bytes);
  assertCondition(
    verification.artifactSha256 === digest,
    "SIGN_IN_BINDING_PREREQUISITE_DRIFT",
    "M03-T07 verifier and prerequisite bytes disagree.",
  );
  return Object.freeze({
    task: "M03-T07",
    result: "PASS",
    verifiedBy: "verifyReferenceTokensAndSyntheticFixturesEvidence",
    artifactSha256: digest,
  });
}

async function readInputs(paths) {
  const names = Object.keys(DEFAULT_PATHS).filter((name) => name !== "prerequisiteArtifactPath");
  const entries = await Promise.all(names.map(async (name) => [name, await readFile(paths[name])]));
  return Object.fromEntries(entries);
}

async function trackedFileHashes() {
  const workspace = await realpath(WORKSPACE_ROOT);
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
      const [entry, resolved] = await Promise.all([lstat(absolutePath), realpath(absolutePath)]);
      assertCondition(
        entry.isFile() && !entry.isSymbolicLink() && resolved.startsWith(`${workspace}${path.sep}`),
        "SIGN_IN_BINDING_TRACKED_FILE_UNSAFE",
        `${relativePath} must be a regular in-workspace file.`,
      );
      const bytes = await readFile(resolved);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

async function canonicalArtifactTarget(artifactPath) {
  const absolute = path.resolve(artifactPath);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (
      error === null ||
      typeof error !== "object" ||
      !Object.hasOwn(error, "code") ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    try {
      const entry = await lstat(absolute);
      if (entry.isSymbolicLink()) {
        const linkTarget = await readlink(absolute);
        return canonicalArtifactTarget(path.resolve(path.dirname(absolute), linkTarget));
      }
    } catch (linkError) {
      if (
        linkError === null ||
        typeof linkError !== "object" ||
        !Object.hasOwn(linkError, "code") ||
        linkError.code !== "ENOENT"
      ) {
        throw linkError;
      }
    }
    return path.join(await realpath(path.dirname(absolute)), path.basename(absolute));
  }
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

function assertCanonicalTrackedSpelling(artifactPath) {
  assertCondition(
    path.resolve(artifactPath) ===
      path.resolve(DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH),
    "SIGN_IN_BINDING_TRACKED_ALIAS_REJECTED",
    "The tracked M03-T08 artifact may not be accessed through an alternate or symlink path.",
  );
}

/**
 * Builds deterministic M03-T08 evidence from the built public operation, host-binding, testkit,
 * and validator APIs.
 */
export async function buildReferenceSignInFixturesAndHostBindingEvidence(options = undefined) {
  const normalized = normalizeOptions(options, BUILD_OPTION_NAMES, "Build");
  validateBuildOptions(normalized);
  const overrides = Object.freeze(sorted(Object.keys(normalized)));
  const paths = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_PATHS).map(([name, defaultPath]) => [
        name,
        normalized[name] ?? defaultPath,
      ]),
    ),
  );

  const [loadedOperationsApi, loadedHostOperationsApi, loadedTestkitApi, loadedValidatorApi] =
    await Promise.all([
      normalized.operationsApi ??
        import(`${pathToFileURL(paths.operationsConsumerPath).href}?proof=${Date.now()}`),
      normalized.hostOperationsApi ??
        import(`${pathToFileURL(paths.hostOperationsConsumerPath).href}?proof=${Date.now()}`),
      normalized.testkitApi ??
        import(`${pathToFileURL(paths.testkitConsumerPath).href}?proof=${Date.now()}`),
      normalized.validatorApi ??
        import(
          `${pathToFileURL(path.join(WORKSPACE_ROOT, "packages/validator/dist/index.js")).href}`
        ),
    ]);
  const operationsCapture = captureApi(
    loadedOperationsApi,
    OPERATIONS_RUNTIME_EXPORTS,
    "operation API",
    { exact: true },
  );
  const hostCapture = captureApi(
    loadedHostOperationsApi,
    HOST_RUNTIME_EXPORTS,
    "host-operation API",
    { exact: true },
  );
  const testkitCapture = captureApi(loadedTestkitApi, TESTKIT_RUNTIME_EXPORTS, "testkit API");
  const validatorCapture = captureApi(
    loadedValidatorApi,
    VALIDATOR_RUNTIME_EXPORTS,
    "validator API",
  );

  const prerequisite =
    normalized.verifyPrerequisite === false
      ? Object.freeze({
          task: "M03-T07",
          result: "SKIPPED",
          verifiedBy: null,
          artifactSha256: null,
        })
      : await verifyPrerequisite(paths.prerequisiteArtifactPath);
  assertCondition(
    overrides.length > 0 || prerequisite.result === "PASS",
    "SIGN_IN_BINDING_PREREQUISITE_UNPROVEN",
    "Tracked-default M03-T08 evidence requires a passing M03-T07 prerequisite.",
  );

  const inputs = await readInputs(paths);
  const text = Object.fromEntries(
    Object.entries(inputs).map(([name, bytes]) => [name, bytes.toString("utf8")]),
  );
  let officialCatalog;
  try {
    officialCatalog = JSON.parse(text.officialCatalogPath);
  } catch {
    fail("SIGN_IN_BINDING_OFFICIAL_INPUT_DRIFT", "The frozen official Catalog is not valid JSON.");
  }

  const operationEvidence = inspectOperationAndFixtures(
    operationsCapture.api,
    testkitCapture.api,
    validatorCapture.api,
    officialCatalog,
  );
  const hostBindingEvidence = await inspectHostBinding(hostCapture.api);
  const publicApi = inspectPublicSurfaces({
    operationIndexSource: text.operationIndexSourcePath,
    operationDeclaration: text.operationDeclarationPath,
    hostIndexSource: text.hostIndexSourcePath,
    hostDeclaration: text.hostDeclarationPath,
    hostBindingSource: text.hostBindingSourcePath,
    packageRootIndexSource: text.packageRootIndexSourcePath,
    operationsConsumer: text.operationsConsumerPath,
    hostOperationsConsumer: text.hostOperationsConsumerPath,
    referencePackage: JSON.parse(text.referencePackagePath),
  });
  const sourceAudit = Object.freeze([
    auditSource(
      text.operationSourcePath,
      "packages/reference-catalog-web/src/operations/sign-in.ts",
      ["@desen/catalog-sdk"],
      {
        expectedImports: [
          "runtime:@desen/catalog-sdk:registerOperation",
          "type:@desen/catalog-sdk:JsonSchemaValue",
        ],
      },
    ),
    auditSource(
      text.operationBuiltSourcePath,
      "packages/reference-catalog-web/dist/operations/sign-in.js",
      ["@desen/catalog-sdk"],
      {
        expectedImports: ["runtime:@desen/catalog-sdk:registerOperation"],
      },
    ),
    auditSource(
      text.hostBindingSourcePath,
      "packages/reference-catalog-web/src/host-operations/sign-in.ts",
      [],
      {
        allowParentRelative: true,
        expectedImports: [
          "runtime:../operations/sign-in.js:SIGN_IN_OPERATION_ID",
          "type:../operations/sign-in.js:SignInOperationInput",
        ],
      },
    ),
    auditSource(
      text.hostBuiltSourcePath,
      "packages/reference-catalog-web/dist/host-operations/sign-in.js",
      [],
      {
        allowParentRelative: true,
        expectedImports: ["runtime:../operations/sign-in.js:SIGN_IN_OPERATION_ID"],
      },
    ),
  ]);
  assertCondition(
    !text.operationSourcePath.includes("host-operations") &&
      !text.operationBuiltSourcePath.includes("host-operations") &&
      !text.operationDeclarationPath.includes("bindReferenceSignInHostOperation") &&
      !text.hostDeclarationPath.includes("signInOperationFixtures") &&
      !text.hostDeclarationPath.includes("signInOperationRegistration"),
    "SIGN_IN_BINDING_SEPARATION_DRIFT",
    "The inert operation and executable host-operation subpaths became entangled.",
  );
  const inventories = inspectInventories(
    text.packageTestPath,
    text.fixturePackageTestPath,
    text.packageTypeTestPath,
    text.rootTestPath,
  );
  inspectRootWiring(JSON.parse(text.rootPackagePath));

  const trackedFiles = await trackedFileHashes();
  operationsCapture.assertStable();
  hostCapture.assertStable();
  testkitCapture.assertStable();
  validatorCapture.assertStable();

  const artifact = {
    schemaVersion: 1,
    task: "M03-T08",
    result: "PASS",
    claim: {
      summary:
        "The exact official sign-in fixtures remain inert authoring data, while one separately exported frozen host binding preserves a trusted handler by identity.",
      protocol: "0.1.0",
      target: "web-react",
      proofMatrixStatusChanges: [
        {
          id: "P-10",
          from: "NOT_PROVEN",
          to: "PARTIAL",
          note: "Local fixture-versus-code separation is proven; real reference-host execution remains M10-T04.",
        },
      ],
      traceCoverage: {
        partial: ["C-018", "R-092", "R-100"],
        tested: [],
        note: "The single reference sign-in binding is local evidence only; package-wide parity, production host execution, authorization, context UI, and repository audits remain assigned to later owners.",
      },
      normativeStatusUnchanged: ["N-036", "N-040"],
    },
    prerequisite,
    operation: operationEvidence,
    hostBinding: hostBindingEvidence,
    publicApi,
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      officialInput: {
        path: "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
        bytes: inputs.officialCatalogPath.length,
        sha256: sha256(inputs.officialCatalogPath),
      },
      sourceAudit,
      packageTests: {
        referenceCatalogWeb: inventories.packageTests,
        testkit: inventories.fixturePackageTests,
      },
      rootTests: inventories.rootTests,
      typeNegativeCases: inventories.typeNegativeCases,
      trackedFiles,
      commands: [
        "generate:reference-sign-in-fixtures-and-host-binding",
        "verify:reference-sign-in-fixtures-and-host-binding",
        "test:reference-sign-in-fixtures-and-host-binding",
      ],
    },
    boundaries: [
      "Catalog and fixture data contain no handler, endpoint, SDK, database, credential, authorization policy, or executable value.",
      "The operations subpath is inert; the host-operations subpath is executable and explicit.",
      "Binding does not invoke or wrap the host-owned handler and preserves its exact identity.",
      "The handler return value remains opaque; no result envelope or settlement semantics are claimed before M04.",
      "The synthetic success fixture satisfies the declared operation output schema.",
      "No pending fixture is claimed; pending is an M04 operation-lifecycle state.",
      "The proof uses no real authentication backend, credential, personal record, or network call.",
    ],
    deferred: [
      "M03-T09 complete package-wide catalog-to-implementation and binding parity",
      "M03-T10 final immutable package inventory and exact tuple",
      "M04 operation ports, authorization handoff, schema enforcement, concurrency, and lifecycle",
      "M09-T11 explicit integration-preview authorization and visible context labels",
      "M10-T04 real reference-host operation execution",
      "M12-T03 and M12-T04 repository-wide prohibited-content, secret, and personal-data audits",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  operationsCapture.assertStable();
  hostCapture.assertStable();
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Verifies an artifact against a fresh deterministic M03-T08 evidence build. */
export async function verifyReferenceSignInFixturesAndHostBindingEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "SIGN_IN_BINDING_OPTIONS_INVALID",
    "Verify artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "artifactBytes")) {
    assertCondition(
      normalized.artifactBytes instanceof Uint8Array &&
        !(
          typeof SharedArrayBuffer === "function" &&
          normalized.artifactBytes.buffer instanceof SharedArrayBuffer
        ),
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      "Verify artifactBytes must be a non-shared byte array.",
    );
  }
  const buildOptions = Object.create(null);
  for (const name of BUILD_OPTION_NAMES) {
    if (Object.hasOwn(normalized, name)) buildOptions[name] = normalized[name];
  }
  const tracked =
    normalized.artifactBytes === undefined && (await targetsTrackedArtifact(artifactPath));
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      Object.keys(buildOptions).length === 0,
      "SIGN_IN_BINDING_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T08 artifact can only be verified from fixed defaults.",
    );
  }
  const expected = await buildReferenceSignInFixturesAndHostBindingEvidence(buildOptions);
  if (tracked) {
    assertCondition(
      expected.artifact.evidence.provenance.mode === "tracked-defaults" &&
        expected.artifact.prerequisite.result === "PASS",
      "SIGN_IN_BINDING_NONDEFAULT_TRACKED_VERIFY",
      "Tracked verification lost fixed provenance or its M03-T07 prerequisite.",
    );
  }
  const actualBytes = Buffer.from(normalized.artifactBytes ?? (await readFile(artifactPath)));
  assertCondition(
    actualBytes.equals(expected.artifactBytes),
    "SIGN_IN_BINDING_ARTIFACT_DRIFT",
    "The M03-T08 artifact differs from a fresh deterministic build.",
    { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
  );
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    prerequisiteSha256: expected.artifact.prerequisite.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    operationId: expected.artifact.operation.operationId,
    packageTests:
      expected.artifact.evidence.packageTests.referenceCatalogWeb.length +
      expected.artifact.evidence.packageTests.testkit.length,
    rootTests: expected.artifact.evidence.rootTests.length,
    typeNegativeCases: expected.artifact.evidence.typeNegativeCases.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    proofMatrixStatus: "P-10 PARTIAL",
  });
}

/** Writes deterministic M03-T08 evidence through the shared atomic proof writer. */
export async function writeReferenceSignInFixturesAndHostBindingEvidence(options = undefined) {
  const normalized = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ARTIFACT_PATH;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "SIGN_IN_BINDING_OPTIONS_INVALID",
    "Write artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalized, "beforeAtomicRename")) {
    assertCondition(
      typeof normalized.beforeAtomicRename === "function",
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      "Write beforeAtomicRename must be a function.",
    );
  }
  if (Object.hasOwn(normalized, "buildOptions")) {
    assertCondition(
      normalized.buildOptions !== null &&
        typeof normalized.buildOptions === "object" &&
        !Array.isArray(normalized.buildOptions),
      "SIGN_IN_BINDING_OPTIONS_INVALID",
      "Write buildOptions must be a record.",
    );
  }
  const tracked = await targetsTrackedArtifact(artifactPath);
  if (tracked) {
    assertCanonicalTrackedSpelling(artifactPath);
    assertCondition(
      !Object.hasOwn(normalized, "beforeAtomicRename") &&
        !Object.hasOwn(normalized, "buildOptions"),
      "SIGN_IN_BINDING_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T08 artifact can only be generated from fixed defaults.",
    );
  }
  const result = await buildReferenceSignInFixturesAndHostBindingEvidence(normalized.buildOptions);
  if (tracked) {
    assertCondition(
      result.artifact.evidence.provenance.mode === "tracked-defaults" &&
        result.artifact.prerequisite.result === "PASS",
      "SIGN_IN_BINDING_NONDEFAULT_TRACKED_WRITE",
      "Tracked generation lost fixed provenance or its M03-T07 prerequisite.",
    );
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename: normalized.beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "SIGN_IN_BINDING_ARTIFACT_WRITE_FAILED",
      "The M03-T08 artifact could not be written safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}

/** Exact root script strings required by the M03-T08 proof wiring audit. */
export const REFERENCE_SIGN_IN_FIXTURES_AND_HOST_BINDING_ROOT_SCRIPTS = EXPECTED_ROOT_SCRIPTS;
