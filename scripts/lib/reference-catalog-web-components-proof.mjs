import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { verifyWebReactPackageDigestEvidence } from "./web-react-package-digest-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const COMPONENT_CONSUMER_URL = new URL(
  "../../packages/reference-catalog-web/test/components-consumer.mjs",
  import.meta.url,
);
const CATALOG_API_URL = new URL("../../packages/catalog-sdk/dist/index.js", import.meta.url);
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the deterministic cumulative Web component evidence. */
export const DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-components.json",
);

const DEFAULT_OFFICIAL_CATALOG_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json",
);
const DEFAULT_PACKAGE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/package.json",
);
const DEFAULT_PACKAGE_README_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/README.md",
);
const DEFAULT_COMPONENT_INDEX_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/dist/components/index.d.ts",
);
const DEFAULT_STACK_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/stack.tsx",
);
const DEFAULT_TEXT_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/text.tsx",
);
const DEFAULT_PACKAGE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/foundation-components.test.tsx",
);
const DEFAULT_TYPE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/foundation-components.types.tsx",
);
const DEFAULT_ROOT_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "tests/reference-catalog-web-components.test.mjs",
);
const DEFAULT_ROOT_PACKAGE_PATH = path.join(WORKSPACE_ROOT, "package.json");
const PACKAGE_REQUIRE = createRequire(pathToFileURL(DEFAULT_PACKAGE_PATH));
const BUILD_OPTION_NAMES = Object.freeze([
  "componentApi",
  "catalogApi",
  "protocolApi",
  "validatorApi",
  "officialCatalogPath",
  "packagePath",
  "packageReadmePath",
  "componentIndexPath",
  "stackSourcePath",
  "textSourcePath",
  "packageTestPath",
  "typeTestPath",
  "rootTestPath",
  "rootPackagePath",
  "componentConsumerPath",
  "verifyPrerequisite",
]);

const EXPECTED_COMPONENT_IDS = Object.freeze(["com.example.ui/Stack", "com.example.ui/Text"]);
const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "STACK_CAPABILITY_ID",
  "Stack",
  "TEXT_CAPABILITY_ID",
  "Text",
  "stackComponentRegistration",
  "textComponentRegistration",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "StackAlignment",
  "StackCatalogProps",
  "StackDirection",
  "StackGap",
  "StackProps",
  "TextCatalogProps",
  "TextProps",
  "TextRole",
]);
const EXPECTED_COMPONENT_CONSUMER_SOURCE = `export {
  STACK_CAPABILITY_ID,
  Stack,
  TEXT_CAPABILITY_ID,
  Text,
  stackComponentRegistration,
  textComponentRegistration,
} from "@desen/reference-catalog-web/components";`;
const EXPECTED_PACKAGE_TEST_TITLES = Object.freeze([
  "registers exact closed public contracts as detached immutable data",
  "renders Stack as a neutral flex container while preserving child order",
  "keeps Stack defaults deterministic and does not invent spacing",
  "maps Text roles to native non-interactive semantics",
  "renders hostile markup-like text as inert escaped content",
]);
const EXPECTED_TYPE_NEGATIVE_LABELS = Object.freeze([
  "M03-T05-N01",
  "M03-T05-N02",
  "M03-T05-N03",
  "M03-T05-N04",
  "M03-T05-N05",
  "M03-T05-N06",
  "M03-T05-N07",
]);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T05 evidence",
  "two independent reference component evidence builds are byte-identical",
  "records every explicit build option as injected evidence",
  "rejects inherited, accessor-backed, or unknown build options",
  "rejects stale or one-byte-tampered evidence",
  "rejects a component manifest that differs from the frozen official Catalog",
  "rejects mutable component registration data",
  "rejects a getter-backed component public API",
  "rejects a Text renderer that discards the declared native semantics",
  "rejects a conditional Text renderer outside the original examples",
  "rejects a Stack renderer that fabricates focusability for one schema value",
  "rejects a raw HTML execution path in the reviewed Text source",
  "rejects conditional Stack source behavior outside sampled numbers",
  "rejects missing foundational declaration exports and modified test calls",
  "rejects alternate web export conditions and React runtime duplication",
  "rejects inert quality-gate command wiring",
  "rejects nondefault verification through a symlink alias to the tracked artifact",
  "rejects forged validation that fails to enforce closed public props",
]);
const EXPECTED_PACKAGE_TESTS = EXPECTED_PACKAGE_TEST_TITLES.length;
const EXPECTED_TYPE_NEGATIVE_CASES = EXPECTED_TYPE_NEGATIVE_LABELS.length;
const EXPECTED_ROOT_TESTS = EXPECTED_ROOT_TEST_TITLES.length;
const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm verify:web-react-package-digest && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:components && node scripts/generate-reference-catalog-web-components-proof.mjs",
  verify:
    "pnpm verify:web-react-package-digest && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:components && node scripts/verify-reference-catalog-web-components.mjs",
  test: "pnpm verify:web-react-package-digest && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:components && node --test tests/reference-catalog-web-components.test.mjs",
});
const REQUIRED_README_TEXT = Object.freeze([
  "@desen/reference-catalog-web/components",
  "com.example.ui/Stack",
  "com.example.ui/Text",
  "default` slot",
  "`body` → `<p>`",
  "`heading` → `<h2>`",
  "`caption` → `<small>`",
  "dangerouslySetInnerHTML",
  "M03-T09",
]);
const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "packages/reference-catalog-web/src/components/contracts.ts",
  "packages/reference-catalog-web/src/components/stack.tsx",
  "packages/reference-catalog-web/src/components/text.tsx",
  "packages/reference-catalog-web/test/foundation-components.test.tsx",
  "packages/reference-catalog-web/test/foundation-components.types.tsx",
  "packages/reference-catalog-web/test/components-consumer.mjs",
  "packages/reference-catalog-web/tsconfig.json",
  "packages/reference-catalog-web/tsconfig.build.json",
  "docs/proof/REFERENCE-CATALOG-WEB-COMPONENTS.md",
  "scripts/lib/reference-catalog-web-components-proof.mjs",
  "scripts/generate-reference-catalog-web-components-proof.mjs",
  "scripts/verify-reference-catalog-web-components.mjs",
  "tests/reference-catalog-web-components.test.mjs",
]);

/** Stable failure raised by the M03-T05 evidence builder and verifier. */
export class ReferenceCatalogWebComponentsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceCatalogWebComponentsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceCatalogWebComponentsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function assertArrayEqual(actual, expected, code, message) {
  assertCondition(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    code,
    message,
    { actual, expected },
  );
}

function assertArrayContains(actual, expected, code, message) {
  const actualSet = new Set(actual);
  assertCondition(
    expected.every((value) => actualSet.has(value)),
    code,
    message,
    { actual, expected },
  );
}

function normalizeOptions(options, allowedNames, label) {
  if (options === undefined) return Object.freeze(Object.create(null));
  assertCondition(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "REFERENCE_COMPONENT_OPTIONS_INVALID",
    `${label} options must be a plain record.`,
  );

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch (error) {
    fail("REFERENCE_COMPONENT_OPTIONS_INVALID", `${label} options could not be inspected safely.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertCondition(
    prototype === Object.prototype || prototype === null,
    "REFERENCE_COMPONENT_OPTIONS_INVALID",
    `${label} options may not inherit configuration.`,
  );

  const allowed = new Set(allowedNames);
  const normalized = Object.create(null);
  for (const key of keys) {
    assertCondition(
      typeof key === "string" && allowed.has(key),
      "REFERENCE_COMPONENT_OPTIONS_INVALID",
      `${label} options contain an unknown or symbolic key.`,
      { key: typeof key === "symbol" ? key.toString() : key },
    );
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    assertCondition(
      descriptor !== undefined &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.enumerable === true,
      "REFERENCE_COMPONENT_OPTIONS_INVALID",
      `${label} option ${key} must be an enumerable own data property.`,
    );
    normalized[key] = descriptor.value;
  }
  return Object.freeze(normalized);
}

function assertDeeplyFrozen(value, label) {
  const pending = [value];
  const visited = new WeakSet();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const prototype = Object.getPrototypeOf(current);
    assertCondition(
      Object.isFrozen(current) &&
        (prototype === Object.prototype ||
          prototype === null ||
          (Array.isArray(current) && prototype === Array.prototype)),
      "REFERENCE_COMPONENT_REGISTRATION_MUTABLE",
      `${label} contains mutable or non-data objects.`,
    );
    for (const key of Reflect.ownKeys(current)) {
      assertCondition(
        typeof key === "string",
        "REFERENCE_COMPONENT_REGISTRATION_MUTABLE",
        `${label} contains symbolic registration data.`,
      );
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      assertCondition(
        descriptor !== undefined && Object.hasOwn(descriptor, "value"),
        "REFERENCE_COMPONENT_REGISTRATION_MUTABLE",
        `${label} contains accessor-backed registration data.`,
      );
      pending.push(descriptor.value);
    }
  }
}

function parseSourceFile(text, relativePath) {
  const scriptKind = relativePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : relativePath.endsWith(".mjs")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.ESNext,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("REFERENCE_COMPONENT_SOURCE_PARSE_FAILED", `TypeScript could not parse ${relativePath}.`, {
      diagnostics: sourceFile.parseDiagnostics.map(({ code, messageText }) => ({
        code,
        message: ts.flattenDiagnosticMessageText(messageText, "\n"),
      })),
    });
  }
  return sourceFile;
}

function hasExportModifier(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)
  );
}

function declarationExports(declarationText) {
  const sourceFile = parseSourceFile(
    declarationText,
    "packages/reference-catalog-web/dist/components/index.d.ts",
  );
  const runtime = new Set();
  const types = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
    if (ts.isExportDeclaration(statement)) {
      assertCondition(
        statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause),
        "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
        "Wildcard or unrecognized component declaration exports are forbidden.",
      );
      for (const element of statement.exportClause.elements) {
        const target = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
        target.add(element.name.text);
      }
      continue;
    }
    if (!hasExportModifier(statement)) continue;
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      types.add(statement.name.text);
    } else if (ts.isFunctionDeclaration(statement)) {
      runtime.add(statement.name?.text ?? "default");
    } else if (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
      const name = statement.name?.text ?? "default";
      runtime.add(name);
      types.add(name);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        assertCondition(
          ts.isIdentifier(declaration.name),
          "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
          "Public component declarations may not export a binding pattern.",
        );
        runtime.add(declaration.name.text);
      }
    } else if (ts.isExportAssignment(statement)) {
      runtime.add("default");
    } else {
      fail(
        "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
        "An unrecognized declaration crossed the component public API audit.",
        { syntaxKind: ts.SyntaxKind[statement.kind] },
      );
    }
  }
  return Object.freeze({ runtime: [...runtime].sort(), types: [...types].sort() });
}

function bindingNames(name, names = []) {
  if (ts.isIdentifier(name)) names.push(name.text);
  else {
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) bindingNames(element.name, names);
    }
  }
  return names;
}

function verifyTestFrameworkBinding(sourceFile, relativePath, functionName) {
  if (functionName === "it") {
    const imports = sourceFile.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "vitest",
    );
    const clause = imports.length === 1 ? imports[0].importClause : undefined;
    const bindings =
      clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements
        : [];
    const names = bindings.map(({ name }) => name.text).sort();
    assertCondition(
      imports.length === 1 &&
        clause !== undefined &&
        clause.name === undefined &&
        bindings.every(
          (binding) =>
            binding.propertyName === undefined || binding.propertyName.text === binding.name.text,
        ) &&
        names.join(",") === "afterEach,describe,expect,it",
      "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
      `${relativePath} must bind afterEach, describe, expect, and it directly from vitest.`,
    );
  } else {
    const imports = sourceFile.statements.filter(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "node:test",
    );
    const clause = imports.length === 1 ? imports[0].importClause : undefined;
    assertCondition(
      imports.length === 1 &&
        clause !== undefined &&
        clause.name?.text === "test" &&
        clause.namedBindings === undefined,
      "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
      `${relativePath} must bind test directly from node:test.`,
    );
  }

  const protectedNames = new Set(functionName === "it" ? ["describe", "expect", "it"] : ["test"]);
  function visit(node) {
    let declaredNames = [];
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      declaredNames = bindingNames(node.name);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name !== undefined
    ) {
      declaredNames = [node.name.text];
    } else if (ts.isCatchClause(node) && node.variableDeclaration !== undefined) {
      declaredNames = bindingNames(node.variableDeclaration.name);
    }
    assertCondition(
      !declaredNames.some((name) => protectedNames.has(name)),
      "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
      `${relativePath} shadows a test-framework binding.`,
    );
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function testTitles(testText, relativePath, functionName) {
  const sourceFile = parseSourceFile(testText, relativePath);
  verifyTestFrameworkBinding(sourceFile, relativePath, functionName);
  const titles = [];

  function assertPlacement(node, title) {
    const statement = node.parent;
    assertCondition(
      ts.isExpressionStatement(statement),
      "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
      `Test ${JSON.stringify(title)} is conditionally wrapped.`,
    );
    if (functionName === "test") {
      assertCondition(
        ts.isSourceFile(statement.parent),
        "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
        `Root test ${JSON.stringify(title)} is not top-level.`,
      );
      return;
    }

    const block = statement.parent;
    const suiteCallback = ts.isBlock(block) ? block.parent : undefined;
    const describeCall =
      suiteCallback !== undefined &&
      (ts.isArrowFunction(suiteCallback) || ts.isFunctionExpression(suiteCallback))
        ? suiteCallback.parent
        : undefined;
    const describeStatement =
      describeCall !== undefined && ts.isCallExpression(describeCall)
        ? describeCall.parent
        : undefined;
    assertCondition(
      ts.isBlock(block) &&
        suiteCallback !== undefined &&
        (ts.isArrowFunction(suiteCallback) || ts.isFunctionExpression(suiteCallback)) &&
        ts.isCallExpression(describeCall) &&
        ts.isIdentifier(describeCall.expression) &&
        describeCall.expression.text === "describe" &&
        describeCall.arguments.length === 2 &&
        ts.isStringLiteral(describeCall.arguments[0]) &&
        describeCall.arguments[1] === suiteCallback &&
        ts.isExpressionStatement(describeStatement) &&
        ts.isSourceFile(describeStatement.parent),
      "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
      `Package test ${JSON.stringify(title)} is not directly inside one top-level describe.`,
    );
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === functionName) {
        const title = node.arguments[0];
        const callback = node.arguments[1];
        assertCondition(
          node.arguments.length === 2 &&
            title !== undefined &&
            ts.isStringLiteral(title) &&
            callback !== undefined &&
            (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)),
          "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
          `A ${functionName} call is not a static executable test.`,
        );
        assertPlacement(node, title.text);
        titles.push(title.text);
      } else {
        const modifiedBase =
          ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)
            ? node.expression.expression
            : undefined;
        assertCondition(
          !(
            modifiedBase !== undefined &&
            ts.isIdentifier(modifiedBase) &&
            ["describe", "it", "suite", "test"].includes(modifiedBase.text)
          ),
          "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
          "Modified or skipped test-framework calls are forbidden.",
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return titles;
}

function typeNegativeCases(typeTestText) {
  const sourceFile = parseSourceFile(
    typeTestText,
    "packages/reference-catalog-web/test/foundation-components.types.tsx",
  );
  return (sourceFile.commentDirectives ?? [])
    .filter(({ type }) => type === ts.CommentDirectiveType.ExpectError)
    .map(({ range }) => {
      const directive = typeTestText.slice(range.pos, range.end);
      const match = /@ts-expect-error\s+(M03-T05-N[0-9]{2})\b/u.exec(directive);
      assertCondition(
        match !== null,
        "REFERENCE_COMPONENT_TYPE_INVENTORY_DRIFT",
        "Every compiler-recognized expect-error needs a stable M03-T05 case id.",
      );
      return match[1];
    });
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

function frozenStringMap(sourceFile, variableName) {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(({ declarationList }) => [...declarationList.declarations])
    .find(({ name }) => ts.isIdentifier(name) && name.text === variableName);
  const freezeCall =
    declaration?.initializer === undefined ? undefined : unwrapExpression(declaration.initializer);
  const mapArgument =
    freezeCall !== undefined &&
    ts.isCallExpression(freezeCall) &&
    ts.isPropertyAccessExpression(freezeCall.expression) &&
    ts.isIdentifier(freezeCall.expression.expression) &&
    freezeCall.expression.expression.text === "Object" &&
    freezeCall.expression.name.text === "freeze" &&
    freezeCall.arguments.length === 1
      ? unwrapExpression(freezeCall.arguments[0])
      : undefined;
  if (mapArgument === undefined || !ts.isObjectLiteralExpression(mapArgument)) return [];
  return mapArgument.properties.map((property) => {
    if (
      !ts.isPropertyAssignment(property) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) ||
      !ts.isStringLiteral(property.initializer)
    ) {
      return null;
    }
    return [property.name.text, property.initializer.text];
  });
}

function topLevelBindingNames(sourceFile) {
  const names = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name !== undefined) names.push(clause.name.text);
      if (clause?.namedBindings !== undefined) {
        if (ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name.text);
        else names.push(...clause.namedBindings.elements.map(({ name }) => name.text));
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        names.push(...bindingNames(declaration.name));
      }
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.push(statement.name.text);
    }
  }
  return names;
}

function topLevelStatementInventory(sourceFile) {
  return sourceFile.statements.map((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const moduleName = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : "";
      const bindings =
        clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements
          : [];
      if (
        clause === undefined ||
        clause.isTypeOnly !== true ||
        clause.name !== undefined ||
        bindings.length === 0 ||
        bindings.some(
          (binding) =>
            binding.propertyName !== undefined && binding.propertyName.text !== binding.name.text,
        ) ||
        statement.attributes !== undefined
      ) {
        return `unreviewed-import:${moduleName}`;
      }
      return `import-type:${moduleName}:${bindings.map(({ name }) => name.text).join(",")}`;
    }
    if (
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
      statement.declarationList.declarations.length === 1 &&
      !hasExportModifier(statement)
    ) {
      const declaration = statement.declarationList.declarations[0];
      return ts.isIdentifier(declaration.name)
        ? `const:${declaration.name.text}`
        : "unreviewed-const";
    }
    if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
      const modifiers = (ts.getModifiers(statement) ?? []).map(({ kind }) => kind);
      return modifiers.length === 1 && modifiers[0] === ts.SyntaxKind.ExportKeyword
        ? `export-type:${statement.name.text}`
        : `unreviewed-type:${statement.name.text}`;
    }
    if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement)) {
      const modifiers = (ts.getModifiers(statement) ?? []).map(({ kind }) => kind);
      const name = statement.name?.text ?? "default";
      return modifiers.length === 1 && modifiers[0] === ts.SyntaxKind.ExportKeyword
        ? `export-function:${name}`
        : `unreviewed-function:${name}`;
    }
    return `unreviewed:${ts.SyntaxKind[statement.kind]}`;
  });
}

function collectJsxElements(node) {
  const elements = [];
  function visit(current) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) elements.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return elements;
}

function verifyTextSourceShape(sourceFile) {
  const elementMapDeclaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap(({ declarationList }) => [...declarationList.declarations])
    .find(({ name }) => ts.isIdentifier(name) && name.text === "TEXT_ELEMENTS");
  const freezeCall =
    elementMapDeclaration?.initializer !== undefined
      ? unwrapExpression(elementMapDeclaration.initializer)
      : undefined;
  const mapArgument =
    freezeCall !== undefined &&
    ts.isCallExpression(freezeCall) &&
    ts.isPropertyAccessExpression(freezeCall.expression) &&
    ts.isIdentifier(freezeCall.expression.expression) &&
    freezeCall.expression.expression.text === "Object" &&
    freezeCall.expression.name.text === "freeze" &&
    freezeCall.arguments.length === 1
      ? unwrapExpression(freezeCall.arguments[0])
      : undefined;
  const mapping =
    mapArgument !== undefined && ts.isObjectLiteralExpression(mapArgument)
      ? mapArgument.properties.map((property) => {
          if (
            !ts.isPropertyAssignment(property) ||
            (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) ||
            !ts.isStringLiteral(property.initializer)
          ) {
            return null;
          }
          return [property.name.text, property.initializer.text];
        })
      : [];
  assertCondition(
    JSON.stringify(mapping) ===
      JSON.stringify([
        ["body", "p"],
        ["heading", "h2"],
        ["caption", "small"],
      ]),
    "REFERENCE_TEXT_SOURCE_SHAPE_DRIFT",
    "Text must retain one exact native-element mapping.",
  );

  const textFunctions = sourceFile.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "Text" &&
      hasExportModifier(statement),
  );
  const textFunction = textFunctions[0];
  const parameter = textFunction?.parameters[0];
  const bindings =
    parameter !== undefined && ts.isObjectBindingPattern(parameter.name)
      ? parameter.name.elements
      : [];
  assertCondition(
    textFunctions.length === 1 &&
      textFunction.parameters.length === 1 &&
      bindings.length === 2 &&
      ts.isIdentifier(bindings[0].name) &&
      bindings[0].name.text === "role" &&
      bindings[0].dotDotDotToken === undefined &&
      bindings[0].initializer !== undefined &&
      ts.isStringLiteral(bindings[0].initializer) &&
      bindings[0].initializer.text === "body" &&
      ts.isIdentifier(bindings[1].name) &&
      bindings[1].name.text === "text" &&
      bindings[1].dotDotDotToken === undefined &&
      bindings[1].initializer === undefined &&
      textFunction.body !== undefined &&
      textFunction.body.statements.length === 2,
    "REFERENCE_TEXT_SOURCE_SHAPE_DRIFT",
    "Text must use the exact reviewed role/text function boundary.",
  );

  const [elementStatement, returnStatement] = textFunction.body.statements;
  const elementDeclaration =
    ts.isVariableStatement(elementStatement) &&
    elementStatement.declarationList.declarations.length === 1
      ? elementStatement.declarationList.declarations[0]
      : undefined;
  const elementInitializer = elementDeclaration?.initializer;
  assertCondition(
    elementDeclaration !== undefined &&
      ts.isIdentifier(elementDeclaration.name) &&
      elementDeclaration.name.text === "Element" &&
      elementInitializer !== undefined &&
      ts.isElementAccessExpression(elementInitializer) &&
      ts.isIdentifier(elementInitializer.expression) &&
      elementInitializer.expression.text === "TEXT_ELEMENTS" &&
      elementInitializer.argumentExpression !== undefined &&
      ts.isIdentifier(elementInitializer.argumentExpression) &&
      elementInitializer.argumentExpression.text === "role" &&
      ts.isReturnStatement(returnStatement) &&
      returnStatement.expression !== undefined,
    "REFERENCE_TEXT_SOURCE_SHAPE_DRIFT",
    "Text must select its native element directly from the reviewed mapping.",
  );

  let forbiddenControlFlow = false;
  function inspectTextBody(node) {
    if (
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCallExpression(node)
    ) {
      forbiddenControlFlow = true;
    }
    ts.forEachChild(node, inspectTextBody);
  }
  inspectTextBody(textFunction.body);
  const jsxElements = collectJsxElements(textFunction.body);
  const jsx = jsxElements[0];
  const opening = jsx !== undefined && ts.isJsxElement(jsx) ? jsx.openingElement : undefined;
  const meaningfulChildren =
    jsx !== undefined && ts.isJsxElement(jsx)
      ? jsx.children.filter((child) => !ts.isJsxText(child) || child.text.trim().length > 0)
      : [];
  assertCondition(
    !forbiddenControlFlow &&
      jsxElements.length === 1 &&
      opening !== undefined &&
      ts.isIdentifier(opening.tagName) &&
      opening.tagName.text === "Element" &&
      opening.attributes.properties.length === 0 &&
      ts.isIdentifier(jsx.closingElement.tagName) &&
      jsx.closingElement.tagName.text === "Element" &&
      meaningfulChildren.length === 1 &&
      ts.isJsxExpression(meaningfulChildren[0]) &&
      meaningfulChildren[0].expression !== undefined &&
      ts.isIdentifier(meaningfulChildren[0].expression) &&
      meaningfulChildren[0].expression.text === "text",
    "REFERENCE_TEXT_SOURCE_SHAPE_DRIFT",
    "Text must have one unconditional attribute-free JSX return containing only inert text.",
  );
}

function verifyStackSourceShape(sourceFile) {
  assertCondition(
    JSON.stringify(frozenStringMap(sourceFile, "GAP_VALUES")) ===
      JSON.stringify([
        ["none", "0"],
        ["xs", "var(--desen-space-xs, 0.25rem)"],
        ["sm", "var(--desen-space-sm, 0.5rem)"],
        ["md", "var(--desen-space-md, 1rem)"],
        ["lg", "var(--desen-space-lg, 1.5rem)"],
        ["xl", "var(--desen-space-xl, 2rem)"],
      ]) &&
      JSON.stringify(frozenStringMap(sourceFile, "ALIGNMENT_VALUES")) ===
        JSON.stringify([
          ["start", "flex-start"],
          ["center", "center"],
          ["end", "flex-end"],
          ["stretch", "stretch"],
        ]),
    "REFERENCE_STACK_SOURCE_SHAPE_DRIFT",
    "Stack must retain exact frozen gap and alignment maps.",
  );
  const stackFunctions = sourceFile.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "Stack" &&
      hasExportModifier(statement),
  );
  const stackFunction = stackFunctions[0];
  const parameter = stackFunction?.parameters[0];
  const bodyStatements = stackFunction?.body?.statements ?? [];
  const styleStatement = bodyStatements[0];
  const styleDeclaration =
    styleStatement !== undefined &&
    ts.isVariableStatement(styleStatement) &&
    (styleStatement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
    styleStatement.declarationList.declarations.length === 1
      ? styleStatement.declarationList.declarations[0]
      : undefined;
  const styleInitializer = styleDeclaration?.initializer;
  const normalizedParameter =
    parameter === undefined ? "" : parameter.getText(sourceFile).replace(/\s+/gu, "");
  const normalizedStyle =
    styleInitializer === undefined ? "" : styleInitializer.getText(sourceFile).replace(/\s+/gu, "");
  assertCondition(
    stackFunctions.length === 1 &&
      stackFunction.parameters.length === 1 &&
      normalizedParameter === '{align,children,direction="vertical",gap,maxWidth}:StackProps' &&
      stackFunction.body !== undefined &&
      bodyStatements.length === 2 &&
      styleDeclaration !== undefined &&
      ts.isIdentifier(styleDeclaration.name) &&
      styleDeclaration.name.text === "style" &&
      styleDeclaration.type !== undefined &&
      styleDeclaration.type.getText(sourceFile) === "CSSProperties" &&
      normalizedStyle ===
        '{display:"flex",flexDirection:direction==="horizontal"?"row":"column",...(gap===undefined?{}:{gap:GAP_VALUES[gap]}),...(maxWidth===undefined?{}:{maxWidth}),...(align===undefined?{}:{alignItems:ALIGNMENT_VALUES[align]}),}',
    "REFERENCE_STACK_SOURCE_SHAPE_DRIFT",
    "Stack must retain the exact reviewed prop destructuring and style calculation.",
  );
  const jsxElements =
    stackFunction?.body === undefined ? [] : collectJsxElements(stackFunction.body);
  const jsx = jsxElements[0];
  const opening = jsx !== undefined && ts.isJsxElement(jsx) ? jsx.openingElement : undefined;
  const attributes = opening?.attributes.properties ?? [];
  const meaningfulChildren =
    jsx !== undefined && ts.isJsxElement(jsx)
      ? jsx.children.filter((child) => !ts.isJsxText(child) || child.text.trim().length > 0)
      : [];
  const styleAttribute = attributes[0];
  assertCondition(
    stackFunctions.length === 1 &&
      jsxElements.length === 1 &&
      opening !== undefined &&
      ts.isIdentifier(opening.tagName) &&
      opening.tagName.text === "div" &&
      attributes.length === 1 &&
      ts.isJsxAttribute(styleAttribute) &&
      ts.isIdentifier(styleAttribute.name) &&
      styleAttribute.name.text === "style" &&
      styleAttribute.initializer !== undefined &&
      ts.isJsxExpression(styleAttribute.initializer) &&
      styleAttribute.initializer.expression !== undefined &&
      ts.isIdentifier(styleAttribute.initializer.expression) &&
      styleAttribute.initializer.expression.text === "style" &&
      ts.isIdentifier(jsx.closingElement.tagName) &&
      jsx.closingElement.tagName.text === "div" &&
      meaningfulChildren.length === 1 &&
      ts.isJsxExpression(meaningfulChildren[0]) &&
      meaningfulChildren[0].expression !== undefined &&
      ts.isIdentifier(meaningfulChildren[0].expression) &&
      meaningfulChildren[0].expression.text === "children",
    "REFERENCE_STACK_SOURCE_SHAPE_DRIFT",
    "Stack must return one neutral div with only reviewed style and ordered children.",
  );
}

function verifySourceAudit(stackSource, textSource) {
  const combined = `${stackSource}\n${textSource}`;
  assertCondition(
    !/(?:\bdangerouslySetInnerHTML\s*=|["']dangerouslySetInnerHTML["']\s*:)/u.test(combined),
    "REFERENCE_COMPONENT_UNSAFE_HTML_PATH",
    "The component sources contain a raw HTML execution path.",
  );
  assertCondition(
    !/<[A-Za-z][^>]*\{\.\.\./u.test(combined),
    "REFERENCE_COMPONENT_DOM_PROP_PASSTHROUGH",
    "The component sources spread undeclared properties into DOM elements.",
  );
  assertCondition(
    !/(?:\brow-reverse\b|\bcolumn-reverse\b|\border\s*:)/u.test(stackSource),
    "REFERENCE_STACK_READING_ORDER_DRIFT",
    "Stack contains a visual-order primitive that can diverge from document reading order.",
  );
  const textSourceFile = parseSourceFile(
    textSource,
    "packages/reference-catalog-web/src/components/text.tsx",
  );
  const stackSourceFile = parseSourceFile(
    stackSource,
    "packages/reference-catalog-web/src/components/stack.tsx",
  );
  assertArrayEqual(
    topLevelStatementInventory(textSourceFile),
    [
      "import-type:./contracts.js:TextCatalogProps,TextRole",
      "const:TEXT_ELEMENTS",
      "export-type:TextProps",
      "export-function:Text",
    ],
    "REFERENCE_TEXT_SOURCE_SHAPE_DRIFT",
    "Text contains an unreviewed top-level declaration or executable statement.",
  );
  assertArrayEqual(
    topLevelStatementInventory(stackSourceFile),
    [
      "import-type:react:CSSProperties,ReactNode",
      "import-type:./contracts.js:StackAlignment,StackCatalogProps,StackGap",
      "const:GAP_VALUES",
      "const:ALIGNMENT_VALUES",
      "export-type:StackProps",
      "export-function:Stack",
    ],
    "REFERENCE_STACK_SOURCE_SHAPE_DRIFT",
    "Stack contains an unreviewed top-level declaration or executable statement.",
  );
  assertCondition(
    !topLevelBindingNames(textSourceFile).includes("Object") &&
      !topLevelBindingNames(stackSourceFile).includes("Object"),
    "REFERENCE_COMPONENT_SOURCE_SHAPE_DRIFT",
    "Component sources may not shadow the intrinsic Object binding used for frozen maps.",
  );
  verifyTextSourceShape(textSourceFile);
  verifyStackSourceShape(stackSourceFile);
}

function verifyPackageBoundary(packageJson, componentConsumerText) {
  const componentExport = packageJson.exports?.["./components"];
  assertCondition(
    packageJson.dependencies?.["@desen/catalog-sdk"] === "workspace:*" &&
      packageJson.dependencies?.["@desen/protocol"] === "workspace:*" &&
      !Object.hasOwn(packageJson.dependencies ?? {}, "react") &&
      packageJson.peerDependencies?.react === ">=19.0.0 <20.0.0" &&
      !Object.hasOwn(packageJson.peerDependenciesMeta ?? {}, "react") &&
      packageJson.devDependencies?.react === "19.2.8" &&
      packageJson.devDependencies?.["react-dom"] === "19.2.8" &&
      packageJson.devDependencies?.["@types/react"] === "19.2.17" &&
      packageJson.devDependencies?.["@types/react-dom"] === "19.2.3" &&
      packageJson.devDependencies?.["@testing-library/react"] === "16.3.2" &&
      packageJson.devDependencies?.jsdom === "29.1.1" &&
      !Object.hasOwn(packageJson, "browser") &&
      !Object.hasOwn(packageJson, "react-native") &&
      componentExport !== null &&
      typeof componentExport === "object" &&
      Object.keys(componentExport).sort().join(",") === "import,types" &&
      componentExport?.types === "./dist/components/index.d.ts" &&
      componentExport?.import === "./dist/components/index.js" &&
      packageJson.scripts?.["test:components"] ===
        "vitest run test/foundation-components.test.tsx" &&
      componentConsumerText.trim() === EXPECTED_COMPONENT_CONSUMER_SOURCE,
    "REFERENCE_COMPONENT_PACKAGE_BOUNDARY_DRIFT",
    "The reviewed component subpath, dependency, peer, or test boundary changed.",
  );
}

function verifyRootWiring(rootPackage) {
  for (const [kind, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const name = `${kind}:reference-catalog-web-components`;
    assertCondition(
      rootPackage.scripts?.[name] === expected,
      "REFERENCE_COMPONENT_COMMAND_WIRING_DRIFT",
      `Root command ${name} changed.`,
    );
  }
  const checkSegments =
    typeof rootPackage.scripts?.check === "string"
      ? rootPackage.scripts.check.split(/\s*&&\s*/u).map((segment) => segment.trim())
      : [];
  const testSegments =
    typeof rootPackage.scripts?.test === "string"
      ? rootPackage.scripts.test.split(/\s*&&\s*/u).map((segment) => segment.trim())
      : [];
  assertCondition(
    checkSegments.includes("pnpm verify:reference-catalog-web-components") &&
      testSegments.includes("pnpm test:reference-catalog-web-components"),
    "REFERENCE_COMPONENT_COMMAND_WIRING_DRIFT",
    "The complete quality gate does not execute M03-T05 verification and tests.",
  );
}

function createReferenceCatalog(catalogApi, componentApi) {
  return catalogApi.createCatalogManifest({
    id: "com.example.web-catalog",
    version: "1.0.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    components: [componentApi.stackComponentRegistration, componentApi.textComponentRegistration],
  });
}

function createReferenceSource(componentApi, catalog) {
  return {
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.foundation-proof",
    catalogs: [{ id: catalog.id, version: catalog.version, target: catalog.target }],
    entry: "main",
    surfaces: {
      main: {
        id: "main",
        state: {},
        resources: {},
        root: {
          id: "main.stack",
          use: componentApi.STACK_CAPABILITY_ID,
          props: { direction: "vertical", gap: "md" },
          slots: {
            default: [
              {
                id: "main.text",
                use: componentApi.TEXT_CAPABILITY_ID,
                props: { text: "Proof", role: "heading" },
              },
            ],
          },
        },
      },
    },
  };
}

function captureStableComponentApi(componentApi) {
  assertCondition(
    componentApi !== null &&
      (typeof componentApi === "object" || typeof componentApi === "function"),
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component public API must be an inspectable module record.",
  );

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(componentApi);
    keys = Reflect.ownKeys(componentApi);
  } catch (error) {
    fail(
      "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
      "The component public API could not be inspected safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  const stringKeys = keys.filter((key) => typeof key === "string").sort();
  const symbolKeys = keys.filter((key) => typeof key === "symbol");
  assertArrayEqual(
    stringKeys,
    EXPECTED_RUNTIME_EXPORTS,
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component public runtime exports changed.",
  );
  assertCondition(
    symbolKeys.length === 0 || (symbolKeys.length === 1 && symbolKeys[0] === Symbol.toStringTag),
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component public API contains an unreviewed symbolic export.",
  );

  const descriptors = new Map();
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(componentApi, key);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
      "The component public API may not expose accessor-backed bindings.",
      { key: typeof key === "symbol" ? key.toString() : key },
    );
    if (typeof key === "string") {
      assertCondition(
        descriptor.enumerable === true,
        "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
        `Component export ${key} must be enumerable.`,
      );
      captured[key] = descriptor.value;
    } else {
      assertCondition(
        descriptor.enumerable === false && descriptor.value === "Module",
        "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
        "Only the standard ESM module tag is permitted.",
      );
    }
    descriptors.set(key, Object.freeze({ ...descriptor }));
  }
  assertCondition(
    captured.STACK_CAPABILITY_ID === "com.example.ui/Stack" &&
      captured.TEXT_CAPABILITY_ID === "com.example.ui/Text" &&
      typeof captured.Stack === "function" &&
      typeof captured.Text === "function" &&
      captured.stackComponentRegistration !== null &&
      typeof captured.stackComponentRegistration === "object" &&
      captured.textComponentRegistration !== null &&
      typeof captured.textComponentRegistration === "object",
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component public API bindings do not have the reviewed kinds.",
  );

  function assertStable() {
    let currentKeys;
    try {
      currentKeys = Reflect.ownKeys(componentApi);
    } catch (error) {
      fail(
        "REFERENCE_COMPONENT_PUBLIC_API_MUTATED",
        "The component public API became uninspectable during evidence generation.",
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    assertCondition(
      currentKeys.length === keys.length && currentKeys.every((key, index) => key === keys[index]),
      "REFERENCE_COMPONENT_PUBLIC_API_MUTATED",
      "The component public API key inventory changed during evidence generation.",
    );
    for (const key of keys) {
      const before = descriptors.get(key);
      const after = Object.getOwnPropertyDescriptor(componentApi, key);
      assertCondition(
        before !== undefined &&
          after !== undefined &&
          Object.hasOwn(after, "value") &&
          Object.is(after.value, before.value) &&
          after.enumerable === before.enumerable &&
          after.configurable === before.configurable &&
          after.writable === before.writable,
        "REFERENCE_COMPONENT_PUBLIC_API_MUTATED",
        "A component public API binding changed during evidence generation.",
        { key: typeof key === "symbol" ? key.toString() : key },
      );
    }
    assertCondition(
      Object.getPrototypeOf(componentApi) === prototype,
      "REFERENCE_COMPONENT_PUBLIC_API_MUTATED",
      "The component public API prototype changed during evidence generation.",
    );
  }

  return Object.freeze({ api: Object.freeze(captured), assertStable });
}

function verifyCatalogAndContracts({ catalogApi, componentApi, validatorApi }) {
  const catalog = createReferenceCatalog(catalogApi, componentApi);
  const structural = validatorApi.validateDesenCatalog(catalog);
  const semantic = validatorApi.validateDesenCatalogSemantics(catalog);
  const catalogSet = validatorApi.validateDesenComponentCatalogSet([catalog]);
  assertCondition(
    structural.valid && semantic.valid && catalogSet.valid,
    "REFERENCE_COMPONENT_CATALOG_INVALID",
    "The two-component reference Catalog did not pass the built validator.",
    {
      structural: structural.diagnostics,
      semantic: semantic.diagnostics,
      catalogSet: catalogSet.diagnostics,
    },
  );

  const source = createReferenceSource(componentApi, catalog);
  const validResult = validatorApi.validateDesenSourceComponentContracts(source, catalogSet.value);
  assertCondition(
    validResult.valid && validResult.obligations.length === 0,
    "REFERENCE_COMPONENT_SOURCE_INVALID",
    "The controlled Stack/Text Source did not satisfy its exact Catalog contracts.",
    { diagnostics: validResult.diagnostics, obligations: validResult.obligations },
  );

  const unknownPropSource = structuredClone(source);
  unknownPropSource.surfaces.main.root.props.unknown = true;
  const unknownPropResult = validatorApi.validateDesenSourceComponentContracts(
    unknownPropSource,
    catalogSet.value,
  );
  const unknownProp = unknownPropResult.diagnostics[0];
  assertCondition(
    !unknownPropResult.valid &&
      unknownPropResult.diagnostics.length === 1 &&
      unknownProp?.code === "UNKNOWN_PROP" &&
      unknownProp.pointer === "/surfaces/main/root/props/unknown",
    "REFERENCE_COMPONENT_CLOSED_SCHEMA_UNPROVEN",
    "Stack's public prop schema did not reject one exact unknown property.",
  );

  const missingTextSource = structuredClone(source);
  delete missingTextSource.surfaces.main.root.slots.default[0].props.text;
  const missingTextResult = validatorApi.validateDesenSourceComponentContracts(
    missingTextSource,
    catalogSet.value,
  );
  const missingText = missingTextResult.diagnostics[0];
  assertCondition(
    !missingTextResult.valid &&
      missingTextResult.diagnostics.length === 1 &&
      missingText?.code === "PROP_TYPE_MISMATCH" &&
      missingText.pointer === "/surfaces/main/root/slots/default/0/props/text",
    "REFERENCE_TEXT_REQUIRED_PROP_UNPROVEN",
    "Text's required inert string property was not enforced.",
  );

  return Object.freeze({
    catalog,
    source,
    diagnostics: Object.freeze({
      unknownProp: Object.freeze({
        code: unknownProp.code,
        pointer: unknownProp.pointer,
      }),
      missingText: Object.freeze({
        code: missingText.code,
        pointer: missingText.pointer,
      }),
    }),
  });
}

function escapeHtmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

function assertExactObject(actual, expected, code, message) {
  const actualKeys =
    actual !== null && typeof actual === "object" ? Object.keys(actual).sort() : [];
  const expectedKeys = Object.keys(expected).sort();
  assertCondition(
    actual !== null &&
      typeof actual === "object" &&
      actualKeys.length === expectedKeys.length &&
      actualKeys.every((key, index) => key === expectedKeys[index]) &&
      expectedKeys.every((key) => Object.is(actual[key], expected[key])),
    code,
    message,
    { actual, expected },
  );
}

function verifyRendering(componentApi, React, renderToStaticMarkup) {
  const hostileInput = '<img src=x onerror="bad()"><script>bad()</script>';
  const textSamples = Object.freeze([
    "",
    "Body",
    "Heading",
    "Caption",
    "First",
    "Second",
    "Proof",
    "Sign in",
    "Welcome",
    "conditional-sentinel",
    hostileInput,
    `&<>"'`,
    "İstanbul · DESEN 👩‍💻",
    "Line one\nLine two",
  ]);
  const textRoles = Object.freeze([
    Object.freeze({ input: undefined, label: "default", tag: "p" }),
    Object.freeze({ input: "body", label: "body", tag: "p" }),
    Object.freeze({ input: "heading", label: "heading", tag: "h2" }),
    Object.freeze({ input: "caption", label: "caption", tag: "small" }),
  ]);
  const forbiddenAttributes = /\s(?:aria-[^=\s]+|contenteditable|on[a-z-]+|role|tabindex)=/iu;
  const textVectors = [];
  for (const role of textRoles) {
    for (const text of textSamples) {
      const props = role.input === undefined ? { text } : { text, role: role.input };
      const element = componentApi.Text(props);
      assertCondition(
        React.isValidElement(element) &&
          element.type === role.tag &&
          Object.keys(element.props).join(",") === "children" &&
          element.props.children === text,
        "REFERENCE_TEXT_RENDERING_DRIFT",
        "Text returned an unreviewed element, property, or content shape.",
        { role: role.label, textSha256: sha256(Buffer.from(text)) },
      );
      const firstHtml = renderToStaticMarkup(element);
      const secondHtml = renderToStaticMarkup(componentApi.Text(props));
      const expectedHtml = `<${role.tag}>${escapeHtmlText(text)}</${role.tag}>`;
      assertCondition(
        firstHtml === secondHtml,
        "REFERENCE_COMPONENT_RENDERING_NONDETERMINISTIC",
        "Text produced different HTML for the same frozen input.",
        { role: role.label, textSha256: sha256(Buffer.from(text)) },
      );
      assertCondition(
        firstHtml === expectedHtml &&
          !forbiddenAttributes.test(firstHtml.slice(0, firstHtml.indexOf(">") + 1)),
        text === hostileInput ? "REFERENCE_TEXT_ESCAPING_DRIFT" : "REFERENCE_TEXT_RENDERING_DRIFT",
        "Text no longer produces exact inert native HTML.",
        {
          role: role.label,
          textSha256: sha256(Buffer.from(text)),
          actual: firstHtml,
          expected: expectedHtml,
        },
      );
      textVectors.push(
        Object.freeze({
          role: role.label,
          textSha256: sha256(Buffer.from(text)),
          htmlSha256: sha256(Buffer.from(firstHtml)),
        }),
      );
    }
  }

  const gapValues = Object.freeze({
    none: "0",
    xs: "var(--desen-space-xs, 0.25rem)",
    sm: "var(--desen-space-sm, 0.5rem)",
    md: "var(--desen-space-md, 1rem)",
    lg: "var(--desen-space-lg, 1.5rem)",
    xl: "var(--desen-space-xl, 2rem)",
  });
  const alignmentValues = Object.freeze({
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
  });
  const directions = Object.freeze([undefined, "vertical", "horizontal"]);
  const gaps = Object.freeze([undefined, "none", "xs", "sm", "md", "lg", "xl"]);
  const alignments = Object.freeze([undefined, "start", "center", "end", "stretch"]);
  const maxWidths = Object.freeze([undefined, 1, 420, 640]);
  const stackVectors = [];
  let representativeStack = "";
  for (const direction of directions) {
    for (const gap of gaps) {
      for (const align of alignments) {
        for (const maxWidth of maxWidths) {
          const firstChild = React.createElement(componentApi.Text, {
            key: "first",
            text: "First",
          });
          const secondChild = React.createElement(componentApi.Text, {
            key: "second",
            text: "Second",
            role: "caption",
          });
          const children = [firstChild, secondChild];
          const props = { children };
          if (direction !== undefined) props.direction = direction;
          if (gap !== undefined) props.gap = gap;
          if (align !== undefined) props.align = align;
          if (maxWidth !== undefined) props.maxWidth = maxWidth;

          const expectedStyle = {
            display: "flex",
            flexDirection: direction === "horizontal" ? "row" : "column",
          };
          if (gap !== undefined) expectedStyle.gap = gapValues[gap];
          if (maxWidth !== undefined) expectedStyle.maxWidth = maxWidth;
          if (align !== undefined) expectedStyle.alignItems = alignmentValues[align];

          const element = componentApi.Stack(props);
          assertCondition(
            React.isValidElement(element) &&
              element.type === "div" &&
              Object.keys(element.props).sort().join(",") === "children,style" &&
              element.props.children === children,
            "REFERENCE_STACK_RENDERING_DRIFT",
            "Stack returned an unreviewed root, DOM property, or child materialization.",
            { direction, gap, align, maxWidth },
          );
          assertExactObject(
            element.props.style,
            expectedStyle,
            "REFERENCE_STACK_RENDERING_DRIFT",
            "Stack's CSS mapping differs from the frozen schema-domain oracle.",
          );

          const styleParts = ["display:flex", `flex-direction:${expectedStyle.flexDirection}`];
          if (gap !== undefined) styleParts.push(`gap:${gapValues[gap]}`);
          if (maxWidth !== undefined) styleParts.push(`max-width:${maxWidth}px`);
          if (align !== undefined) styleParts.push(`align-items:${alignmentValues[align]}`);
          const expectedHtml = `<div style="${styleParts.join(
            ";",
          )}"><p>First</p><small>Second</small></div>`;
          const firstHtml = renderToStaticMarkup(element);
          const secondHtml = renderToStaticMarkup(componentApi.Stack(props));
          assertCondition(
            firstHtml === secondHtml,
            "REFERENCE_COMPONENT_RENDERING_NONDETERMINISTIC",
            "Stack produced different HTML for the same frozen input.",
            { direction, gap, align, maxWidth },
          );
          assertCondition(
            firstHtml === expectedHtml &&
              !forbiddenAttributes.test(firstHtml.slice(0, firstHtml.indexOf(">") + 1)) &&
              firstHtml.indexOf("First") < firstHtml.indexOf("Second"),
            "REFERENCE_STACK_RENDERING_DRIFT",
            "Stack changed layout mapping, fabricated semantics, or reordered children.",
            { direction, gap, align, maxWidth, actual: firstHtml, expected: expectedHtml },
          );
          if (
            direction === "horizontal" &&
            gap === "md" &&
            align === "center" &&
            maxWidth === 420
          ) {
            representativeStack = firstHtml;
          }
          stackVectors.push(
            Object.freeze({
              direction: direction ?? "default",
              gap: gap ?? "omitted",
              align: align ?? "omitted",
              maxWidth: maxWidth ?? "omitted",
              htmlSha256: sha256(Buffer.from(firstHtml)),
            }),
          );
        }
      }
    }
  }

  const findTextHtml = (role, text) => {
    const tag = textRoles.find(({ label }) => label === role)?.tag;
    return `<${tag}>${escapeHtmlText(text)}</${tag}>`;
  };
  const body = findTextHtml("default", "Body");
  const heading = findTextHtml("heading", "Heading");
  const caption = findTextHtml("caption", "Caption");
  const hostile = findTextHtml("default", hostileInput);
  assertCondition(
    representativeStack.length > 0 &&
      textVectors.length === textRoles.length * textSamples.length &&
      stackVectors.length ===
        directions.length * gaps.length * alignments.length * maxWidths.length,
    "REFERENCE_COMPONENT_RENDER_MATRIX_DRIFT",
    "The fixed M03-T05 rendering matrix changed.",
  );
  return Object.freeze({
    body,
    heading,
    caption,
    hostileInput,
    hostile,
    stack: representativeStack,
    matrices: Object.freeze({
      text: Object.freeze({
        vectors: textVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(textVectors))),
      }),
      stack: Object.freeze({
        vectors: stackVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(stackVectors))),
      }),
    }),
  });
}

async function trackedFileHashes() {
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      const bytes = await readFile(path.join(WORKSPACE_ROOT, relativePath));
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

function validateBuildOptionValues(options) {
  for (const name of BUILD_OPTION_NAMES.filter((candidate) => candidate.endsWith("Path"))) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        typeof options[name] === "string" && options[name].length > 0,
        "REFERENCE_COMPONENT_OPTIONS_INVALID",
        `Build option ${name} must be a non-empty path string.`,
      );
    }
  }
  if (Object.hasOwn(options, "verifyPrerequisite")) {
    assertCondition(
      typeof options.verifyPrerequisite === "boolean",
      "REFERENCE_COMPONENT_OPTIONS_INVALID",
      "Build option verifyPrerequisite must be boolean.",
    );
  }
  for (const name of ["componentApi", "catalogApi", "protocolApi", "validatorApi"]) {
    if (Object.hasOwn(options, name) && options[name] !== undefined) {
      assertCondition(
        options[name] !== null &&
          (typeof options[name] === "object" || typeof options[name] === "function"),
        "REFERENCE_COMPONENT_OPTIONS_INVALID",
        `Build option ${name} must be an object-like API.`,
      );
    }
  }
}

async function canonicalArtifactTarget(artifactPath) {
  const absolutePath = path.resolve(artifactPath);
  try {
    return await realpath(absolutePath);
  } catch (error) {
    if (
      error === null ||
      typeof error !== "object" ||
      !Object.hasOwn(error, "code") ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
    const parent = await realpath(path.dirname(absolutePath));
    return path.join(parent, path.basename(absolutePath));
  }
}

async function targetsTrackedArtifact(artifactPath) {
  const [actual, expected] = await Promise.all([
    canonicalArtifactTarget(artifactPath),
    canonicalArtifactTarget(DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

/**
 * Builds deterministic M03-T05 evidence from the built public package and frozen official Catalog.
 */
export async function buildReferenceCatalogWebComponentsEvidence(options = undefined) {
  const normalizedOptions = normalizeOptions(options, BUILD_OPTION_NAMES, "Build");
  validateBuildOptionValues(normalizedOptions);
  const overrides = Object.freeze(Object.keys(normalizedOptions).sort());
  const {
    componentApi: providedComponentApi,
    catalogApi: providedCatalogApi,
    protocolApi: providedProtocolApi,
    validatorApi: providedValidatorApi,
    officialCatalogPath = DEFAULT_OFFICIAL_CATALOG_PATH,
    packagePath = DEFAULT_PACKAGE_PATH,
    packageReadmePath = DEFAULT_PACKAGE_README_PATH,
    componentIndexPath = DEFAULT_COMPONENT_INDEX_PATH,
    stackSourcePath = DEFAULT_STACK_SOURCE_PATH,
    textSourcePath = DEFAULT_TEXT_SOURCE_PATH,
    packageTestPath = DEFAULT_PACKAGE_TEST_PATH,
    typeTestPath = DEFAULT_TYPE_TEST_PATH,
    rootTestPath = DEFAULT_ROOT_TEST_PATH,
    rootPackagePath = DEFAULT_ROOT_PACKAGE_PATH,
    componentConsumerPath = fileURLToPath(COMPONENT_CONSUMER_URL),
    verifyPrerequisite = true,
  } = normalizedOptions;

  const [loadedComponentApi, catalogApi, protocolApi, validatorApi] = await Promise.all([
    providedComponentApi ?? import(pathToFileURL(componentConsumerPath).href),
    providedCatalogApi ?? import(CATALOG_API_URL.href),
    providedProtocolApi ?? import(PROTOCOL_API_URL.href),
    providedValidatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const stableComponentApi = captureStableComponentApi(loadedComponentApi);
  const componentApi = stableComponentApi.api;

  const prerequisite = verifyPrerequisite
    ? await verifyWebReactPackageDigestEvidence()
    : Object.freeze({ result: "SKIPPED", artifactSha256: null });
  assertCondition(
    overrides.length > 0 || prerequisite.result === "PASS",
    "REFERENCE_COMPONENT_PREREQUISITE_UNPROVEN",
    "Tracked-default evidence requires a passing M03-T04 prerequisite.",
  );
  const [
    officialCatalogBytes,
    packageBytes,
    packageReadmeBytes,
    componentIndexBytes,
    stackSourceBytes,
    textSourceBytes,
    packageTestBytes,
    typeTestBytes,
    rootTestBytes,
    rootPackageBytes,
    componentConsumerBytes,
  ] = await Promise.all([
    readFile(officialCatalogPath),
    readFile(packagePath),
    readFile(packageReadmePath),
    readFile(componentIndexPath),
    readFile(stackSourcePath),
    readFile(textSourcePath),
    readFile(packageTestPath),
    readFile(typeTestPath),
    readFile(rootTestPath),
    readFile(rootPackagePath),
    readFile(componentConsumerPath),
  ]);

  const officialCatalog = JSON.parse(officialCatalogBytes.toString("utf8"));
  const registrations = [
    componentApi.stackComponentRegistration,
    componentApi.textComponentRegistration,
  ];
  const actualIds = registrations.map(({ id }) => id).sort();
  assertArrayEqual(
    actualIds,
    EXPECTED_COMPONENT_IDS,
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component capability identifiers changed.",
  );
  assertArrayEqual(
    Object.keys(componentApi).sort(),
    EXPECTED_RUNTIME_EXPORTS,
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component public runtime exports changed.",
  );
  for (const registration of registrations) {
    assertCondition(
      officialCatalog.components?.[registration.id] !== undefined,
      "REFERENCE_COMPONENT_OFFICIAL_ID_MISSING",
      `Official Catalog does not contain ${registration.id}.`,
    );
    assertCondition(
      JSON.stringify(protocolApi.canonicalizeJson(registration.manifest)) ===
        JSON.stringify(protocolApi.canonicalizeJson(officialCatalog.components[registration.id])),
      "REFERENCE_COMPONENT_MANIFEST_DRIFT",
      `${registration.id} differs from the frozen official Catalog manifest.`,
    );
    assertCondition(
      registration.manifest.propsSchema?.additionalProperties === false,
      "REFERENCE_COMPONENT_PUBLIC_SCHEMA_OPEN",
      `${registration.id} does not close its public prop object.`,
    );
    assertDeeplyFrozen(registration, registration.id);
  }

  const declarationSurface = declarationExports(componentIndexBytes.toString("utf8"));
  assertArrayContains(
    declarationSurface.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component declarations lost a foundational runtime export.",
  );
  assertArrayContains(
    declarationSurface.types,
    EXPECTED_TYPE_EXPORTS,
    "REFERENCE_COMPONENT_PUBLIC_API_DRIFT",
    "The component declarations lost a foundational type export.",
  );
  verifySourceAudit(stackSourceBytes.toString("utf8"), textSourceBytes.toString("utf8"));
  verifyPackageBoundary(
    JSON.parse(packageBytes.toString("utf8")),
    componentConsumerBytes.toString("utf8"),
  );
  verifyRootWiring(JSON.parse(rootPackageBytes.toString("utf8")));
  for (const required of REQUIRED_README_TEXT) {
    assertCondition(
      packageReadmeBytes.toString("utf8").includes(required),
      "REFERENCE_COMPONENT_DOCUMENTATION_DRIFT",
      `Package README is missing ${JSON.stringify(required)}.`,
    );
  }

  const packageTests = testTitles(
    packageTestBytes.toString("utf8"),
    "packages/reference-catalog-web/test/foundation-components.test.tsx",
    "it",
  );
  const rootTests = testTitles(
    rootTestBytes.toString("utf8"),
    "tests/reference-catalog-web-components.test.mjs",
    "test",
  );
  const negativeCases = typeNegativeCases(typeTestBytes.toString("utf8"));
  assertArrayEqual(
    packageTests,
    EXPECTED_PACKAGE_TEST_TITLES,
    "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
    "The focused M03-T05 package test titles changed.",
  );
  assertArrayEqual(
    rootTests,
    EXPECTED_ROOT_TEST_TITLES,
    "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
    "The M03-T05 root evidence test titles changed.",
  );
  assertArrayEqual(
    negativeCases,
    EXPECTED_TYPE_NEGATIVE_LABELS,
    "REFERENCE_COMPONENT_TYPE_INVENTORY_DRIFT",
    "The M03-T05 compiler-negative case ids changed.",
  );
  assertCondition(
    packageTests.length === EXPECTED_PACKAGE_TESTS &&
      rootTests.length === EXPECTED_ROOT_TESTS &&
      negativeCases.length === EXPECTED_TYPE_NEGATIVE_CASES,
    "REFERENCE_COMPONENT_TEST_INVENTORY_DRIFT",
    "The fixed M03-T05 test inventory count changed.",
  );

  const contractEvidence = verifyCatalogAndContracts({ catalogApi, componentApi, validatorApi });
  const React = PACKAGE_REQUIRE("react");
  const { renderToStaticMarkup } = PACKAGE_REQUIRE("react-dom/server");
  assertCondition(
    React.version === "19.2.8" && typeof renderToStaticMarkup === "function",
    "REFERENCE_COMPONENT_REACT_RUNTIME_DRIFT",
    "The evidence did not resolve the reviewed React runtime.",
  );
  const rendering = verifyRendering(componentApi, React, renderToStaticMarkup);
  const componentEntries = registrations.map((registration) =>
    Object.freeze({
      id: registration.id,
      category: registration.manifest.category,
      manifestSha256: sha256(
        Buffer.from(protocolApi.canonicalizeJson(registration.manifest), "utf8"),
      ),
      officialFixtureExact: true,
      publicPropsClosed: true,
      slots: Object.keys(registration.manifest.slots ?? {}).sort(),
      styleParts: Object.keys(registration.manifest.styleParts ?? {}).sort(),
      events: Object.keys(registration.manifest.events ?? {}).sort(),
      commands: Object.keys(registration.manifest.commands ?? {}).sort(),
    }),
  );
  const trackedFiles = await trackedFileHashes();
  stableComponentApi.assertStable();
  const artifact = {
    schemaVersion: 1,
    task: "M03-T05",
    result: "PASS",
    claim: {
      summary:
        "The frozen Stack and Text contracts resolve to real accessible Web-React components.",
      protocol: "0.1.0",
      target: "web-react",
      normativeCoverage: {
        partial: ["S-004"],
        note: "Stack and Text props are closed; M03-T06 and M03-T09 remain.",
      },
      proofMatrixStatusChanges: [],
    },
    prerequisite: {
      task: "M03-T04",
      result: prerequisite.result,
      artifactSha256: prerequisite.artifactSha256,
    },
    publicApi: {
      package: "@desen/reference-catalog-web/components",
      runtimeExports: EXPECTED_RUNTIME_EXPORTS,
      typeExports: EXPECTED_TYPE_EXPORTS,
      reactVersion: React.version,
      componentIds: EXPECTED_COMPONENT_IDS,
    },
    components: componentEntries,
    contracts: {
      catalog: {
        id: contractEvidence.catalog.id,
        version: contractEvidence.catalog.version,
        target: contractEvidence.catalog.target,
        structural: "PASS",
        semantic: "PASS",
        componentSet: "PASS",
      },
      source: {
        id: contractEvidence.source.id,
        valid: true,
        obligations: 0,
        negativeDiagnostics: contractEvidence.diagnostics,
      },
    },
    accessibility: {
      stack: {
        neutralContainer: true,
        fabricatedRole: false,
        focusable: false,
        childOrderPreserved: true,
        html: rendering.stack,
        matrix: rendering.matrices.stack,
      },
      text: {
        semanticElements: {
          body: rendering.body,
          heading: rendering.heading,
          caption: rendering.caption,
        },
        rawHtmlSurface: false,
        hostileInput: rendering.hostileInput,
        escapedHtml: rendering.hostile,
        matrix: rendering.matrices.text,
      },
    },
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      packageTests,
      rootTests,
      typeNegativeCases: negativeCases,
      trackedFiles,
      commands: Object.keys(EXPECTED_ROOT_SCRIPTS).map(
        (kind) => `${kind}:reference-catalog-web-components`,
      ),
    },
    boundaries: [
      "Catalog props remain inert JSON derived from propsSchema.",
      "React children represent the materialized Stack default slot and are not Catalog props.",
      "Text has no children, raw HTML, event, command, or DOM prop passthrough.",
      "Stack does not reverse visual order or fabricate ARIA semantics.",
      "React and DOM types do not cross into the framework-neutral Catalog SDK.",
    ],
    deferred: [
      "M03-T06 TextField, Button, and Alert capabilities",
      "M03-T07 token provider and controlled fixture infrastructure",
      "M03-T09 complete manifest-to-implementation parity and accessibility contract tests",
      "M03-T10 final immutable package inventory and exact tuple",
      "M05 React adapter registration and runtime materialization",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    endOfLine: "lf",
    printWidth: 100,
    tabWidth: 2,
  });
  const artifactBytes = Buffer.from(artifactText);
  stableComponentApi.assertStable();
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Verifies the tracked artifact against a fresh deterministic M03-T05 evidence build. */
export async function verifyReferenceCatalogWebComponentsEvidence(options = undefined) {
  const normalizedOptions = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath =
    normalizedOptions.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH;
  const artifactBytes = normalizedOptions.artifactBytes;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "REFERENCE_COMPONENT_OPTIONS_INVALID",
    "Verify option artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalizedOptions, "artifactBytes")) {
    assertCondition(
      artifactBytes instanceof Uint8Array,
      "REFERENCE_COMPONENT_OPTIONS_INVALID",
      "Verify option artifactBytes must be a byte array.",
    );
  }
  const buildOptions = Object.create(null);
  for (const name of BUILD_OPTION_NAMES) {
    if (Object.hasOwn(normalizedOptions, name)) buildOptions[name] = normalizedOptions[name];
  }
  const trackedRead = artifactBytes === undefined && (await targetsTrackedArtifact(artifactPath));
  if (trackedRead && Object.keys(buildOptions).length > 0) {
    fail(
      "REFERENCE_COMPONENT_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T05 artifact can only be verified from fixed production defaults.",
    );
  }
  const expected = await buildReferenceCatalogWebComponentsEvidence(buildOptions);
  if (
    trackedRead &&
    (expected.artifact.evidence.provenance.mode !== "tracked-defaults" ||
      expected.artifact.prerequisite.result !== "PASS")
  ) {
    fail(
      "REFERENCE_COMPONENT_NONDEFAULT_TRACKED_VERIFY",
      "Tracked M03-T05 verification lost its fixed provenance or prerequisite.",
    );
  }
  const actualBytes = artifactBytes ?? (await readFile(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail(
      "REFERENCE_COMPONENT_ARTIFACT_DRIFT",
      "The tracked M03-T05 artifact differs from a fresh evidence build.",
      { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    components: expected.artifact.components.length,
    packageTests: expected.artifact.evidence.packageTests.length,
    rootTests: expected.artifact.evidence.rootTests.length,
    typeNegativeCases: expected.artifact.evidence.typeNegativeCases.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes deterministic M03-T05 evidence through the shared safe atomic writer. */
export async function writeReferenceCatalogWebComponentsEvidence(options = undefined) {
  const normalizedOptions = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    normalizedOptions.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH;
  const beforeAtomicRename = normalizedOptions.beforeAtomicRename;
  const buildOptions = normalizedOptions.buildOptions;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "REFERENCE_COMPONENT_OPTIONS_INVALID",
    "Write option artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalizedOptions, "beforeAtomicRename")) {
    assertCondition(
      typeof beforeAtomicRename === "function",
      "REFERENCE_COMPONENT_OPTIONS_INVALID",
      "Write option beforeAtomicRename must be a function.",
    );
  }
  const trackedWrite = await targetsTrackedArtifact(artifactPath);
  if (
    trackedWrite &&
    (Object.hasOwn(normalizedOptions, "beforeAtomicRename") ||
      Object.hasOwn(normalizedOptions, "buildOptions"))
  ) {
    fail(
      "REFERENCE_COMPONENT_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T05 artifact can only be generated from fixed production defaults.",
    );
  }
  const result = await buildReferenceCatalogWebComponentsEvidence(buildOptions);
  if (
    trackedWrite &&
    (result.artifact.evidence.provenance.mode !== "tracked-defaults" ||
      result.artifact.prerequisite.result !== "PASS")
  ) {
    fail(
      "REFERENCE_COMPONENT_NONDEFAULT_TRACKED_WRITE",
      "Tracked M03-T05 generation lost its fixed provenance or prerequisite.",
    );
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: result.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "REFERENCE_COMPONENT_ARTIFACT_WRITE_FAILED",
      "The M03-T05 evidence artifact could not be committed safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}
