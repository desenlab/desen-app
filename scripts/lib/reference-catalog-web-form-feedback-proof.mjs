import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH,
  verifyReferenceCatalogWebComponentsEvidence,
} from "./reference-catalog-web-components-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const COMPONENT_CONSUMER_URL = new URL(
  "../../packages/reference-catalog-web/test/form-feedback-components-consumer.mjs",
  import.meta.url,
);
const CATALOG_API_URL = new URL("../../packages/catalog-sdk/dist/index.js", import.meta.url);
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M03-T06 Web component evidence. */
export const DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-catalog-web-form-feedback.json",
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
const DEFAULT_COMPONENT_INDEX_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/index.ts",
);
const DEFAULT_CONTRACTS_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/interactive-contracts.ts",
);
const DEFAULT_TEXT_FIELD_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/text-field.tsx",
);
const DEFAULT_BUTTON_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/button.tsx",
);
const DEFAULT_ALERT_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/src/components/alert.tsx",
);
const DEFAULT_PACKAGE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/interactive-components.test.tsx",
);
const DEFAULT_TYPE_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/test/interactive-components.types.tsx",
);
const DEFAULT_ROOT_TEST_PATH = path.join(
  WORKSPACE_ROOT,
  "tests/reference-catalog-web-form-feedback.test.mjs",
);
const DEFAULT_ROOT_PACKAGE_PATH = path.join(WORKSPACE_ROOT, "package.json");
const DEFAULT_PROOF_DOCUMENT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/REFERENCE-CATALOG-WEB-FORM-FEEDBACK.md",
);
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
  "componentIndexSourcePath",
  "contractsSourcePath",
  "textFieldSourcePath",
  "buttonSourcePath",
  "alertSourcePath",
  "packageTestPath",
  "typeTestPath",
  "rootTestPath",
  "rootPackagePath",
  "proofDocumentPath",
  "componentConsumerPath",
  "prerequisiteArtifactPath",
  "verifyPrerequisite",
]);

const EXPECTED_COMPONENT_IDS = Object.freeze([
  "com.example.ui/Alert",
  "com.example.ui/Button",
  "com.example.ui/Stack",
  "com.example.ui/Text",
  "com.example.ui/TextField",
]);
const EXPECTED_NEW_COMPONENT_IDS = Object.freeze([
  "com.example.ui/Alert",
  "com.example.ui/Button",
  "com.example.ui/TextField",
]);
const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "ALERT_CAPABILITY_ID",
  "Alert",
  "BUTTON_CAPABILITY_ID",
  "Button",
  "STACK_CAPABILITY_ID",
  "Stack",
  "TEXT_CAPABILITY_ID",
  "TEXT_FIELD_CAPABILITY_ID",
  "Text",
  "TextField",
  "alertComponentRegistration",
  "buttonComponentRegistration",
  "stackComponentRegistration",
  "textComponentRegistration",
  "textFieldComponentRegistration",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "AlertCatalogProps",
  "AlertProps",
  "AlertTone",
  "ButtonCatalogProps",
  "ButtonPressPayload",
  "ButtonProps",
  "ButtonVariant",
  "StackAlignment",
  "StackCatalogProps",
  "StackDirection",
  "StackGap",
  "StackProps",
  "TextCatalogProps",
  "TextFieldCatalogProps",
  "TextFieldChangePayload",
  "TextFieldFocusInput",
  "TextFieldHandle",
  "TextFieldProps",
  "TextProps",
  "TextRole",
]);
const REQUIRED_EXPORT_SIGNATURES = Object.freeze(
  [
    ...[
      "STACK_CAPABILITY_ID",
      "TEXT_CAPABILITY_ID",
      "stackComponentRegistration",
      "textComponentRegistration",
    ].map((name) => `runtime:${name}@./contracts.js`),
    ...[
      "ALERT_CAPABILITY_ID",
      "BUTTON_CAPABILITY_ID",
      "TEXT_FIELD_CAPABILITY_ID",
      "alertComponentRegistration",
      "buttonComponentRegistration",
      "textFieldComponentRegistration",
    ].map((name) => `runtime:${name}@./interactive-contracts.js`),
    "runtime:Alert@./alert.js",
    "runtime:Button@./button.js",
    "runtime:Stack@./stack.js",
    "runtime:Text@./text.js",
    "runtime:TextField@./text-field.js",
    ...[
      "StackAlignment",
      "StackCatalogProps",
      "StackDirection",
      "StackGap",
      "TextCatalogProps",
      "TextRole",
    ].map((name) => `type:${name}@./contracts.js`),
    ...[
      "AlertCatalogProps",
      "AlertTone",
      "ButtonCatalogProps",
      "ButtonPressPayload",
      "ButtonVariant",
      "TextFieldCatalogProps",
      "TextFieldChangePayload",
      "TextFieldFocusInput",
    ].map((name) => `type:${name}@./interactive-contracts.js`),
    "type:AlertProps@./alert.js",
    "type:ButtonProps@./button.js",
    "type:StackProps@./stack.js",
    "type:TextProps@./text.js",
    "type:TextFieldHandle@./text-field.js",
    "type:TextFieldProps@./text-field.js",
  ].sort(),
);
const EXPECTED_PACKAGE_TEST_TITLES = Object.freeze([
  "registers the three exact closed interaction contracts as immutable data",
  "associates every visible TextField label with one unique native input",
  "maps TextField invalid and disabled states without inventing error content",
  "emits a fresh frozen exact TextField change payload and no DOM event",
  "suppresses TextField change and focus bridges while disabled",
  "exposes only the narrow frozen TextField focus command handle",
  "emits fresh frozen empty Button press payloads from native activation",
  "suppresses Button press while preserving focus during loading",
  "maps every Button variant without creating toggle or submit semantics",
  "uses polite status roles for ordinary Alert tones and alert only for critical",
  "keeps TextField, Button, and Alert strings inert",
]);
const EXPECTED_TYPE_NEGATIVE_LABELS = Object.freeze(
  Array.from({ length: 22 }, (_, index) => `M03-T06-N${String(index + 1).padStart(2, "0")}`),
);
const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M03-T06 evidence",
  "two independent form-feedback evidence builds are byte-identical",
  "records every explicit build option as injected evidence",
  "rejects inherited accessor-backed and unknown options",
  "rejects stale or one-byte-tampered evidence",
  "rejects a missing or mismatched M03-T05 prerequisite",
  "rejects each new manifest when it differs from the frozen official Catalog",
  "rejects mutable registrations and accessor-backed public APIs",
  "rejects a TextField renderer that loses its visible native label",
  "rejects a Button renderer that replaces native button semantics",
  "rejects trusted interaction bridges that silently drop change press or focus behavior",
  "rejects an Alert renderer that fabricates focusability",
  "rejects hidden component source changes and raw HTML paths",
  "rejects declaration test and type-negative inventory drift",
  "rejects alternate package exports and React runtime duplication",
  "rejects inert quality-gate command wiring",
  "rejects nondefault verification through a symlink alias",
  "rejects forged validation that bypasses closed component props",
]);
const EXPECTED_ROOT_SCRIPTS = Object.freeze({
  generate:
    "pnpm verify:reference-catalog-web-components && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:interactive-components && node scripts/generate-reference-catalog-web-form-feedback-proof.mjs",
  verify:
    "pnpm verify:reference-catalog-web-components && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:interactive-components && node scripts/verify-reference-catalog-web-form-feedback.mjs",
  test: "pnpm verify:reference-catalog-web-components && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/reference-catalog-web typecheck && pnpm --filter @desen/reference-catalog-web test:interactive-components && node --test tests/reference-catalog-web-form-feedback.test.mjs",
});
const EXPECTED_COMPONENT_CONSUMER_SOURCE = `export {
  ALERT_CAPABILITY_ID,
  Alert,
  BUTTON_CAPABILITY_ID,
  Button,
  STACK_CAPABILITY_ID,
  Stack,
  TEXT_CAPABILITY_ID,
  TEXT_FIELD_CAPABILITY_ID,
  Text,
  TextField,
  alertComponentRegistration,
  buttonComponentRegistration,
  stackComponentRegistration,
  textComponentRegistration,
  textFieldComponentRegistration,
} from "@desen/reference-catalog-web/components";`;
const REQUIRED_README_TEXT = Object.freeze([
  "com.example.ui/TextField",
  "com.example.ui/Button",
  "com.example.ui/Alert",
  "`change`",
  "`press`",
  "`focus`",
  'role="alert"',
  'role="status"',
  "M03-T09",
]);
const REQUIRED_PROOF_TEXT = Object.freeze([
  "M03-T06",
  "M03-T05",
  "TextField",
  "Button",
  "Alert",
  "279",
  "reference-catalog-web-form-feedback.json",
]);
const TRACKED_EVIDENCE_PATHS = Object.freeze([
  "packages/reference-catalog-web/src/components/interactive-contracts.ts",
  "packages/reference-catalog-web/src/components/text-field.tsx",
  "packages/reference-catalog-web/src/components/button.tsx",
  "packages/reference-catalog-web/src/components/alert.tsx",
  "packages/reference-catalog-web/test/interactive-components.test.tsx",
  "packages/reference-catalog-web/test/interactive-components.types.tsx",
  "packages/reference-catalog-web/test/form-feedback-components-consumer.mjs",
  "docs/proof/REFERENCE-CATALOG-WEB-FORM-FEEDBACK.md",
  "scripts/lib/reference-catalog-web-form-feedback-proof.mjs",
  "scripts/generate-reference-catalog-web-form-feedback-proof.mjs",
  "scripts/verify-reference-catalog-web-form-feedback.mjs",
  "tests/reference-catalog-web-form-feedback.test.mjs",
]);
const EXPECTED_SOURCE_PROFILES = Object.freeze({
  "interactive-contracts.ts": "d0c1681f0e1d03de445a9d5d5e4551037b4af3eea071ebc67040df07b0d9b7a6",
  "text-field.tsx": "4b68f1d11c1777cd4969006e7ca44ca972befc22123a79403721e98bf2ffed90",
  "button.tsx": "0f577313ba16dc9cf689ca9468b591d26e12d2d3980a8db8e7f4b0685f492048",
  "alert.tsx": "517acce59b0273b7531a23a8a5896721720f68f231210e0a9b8586a8687c06a9",
});

/** Stable failure raised by the M03-T06 evidence builder and verifier. */
export class ReferenceCatalogWebFormFeedbackEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceCatalogWebFormFeedbackEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceCatalogWebFormFeedbackEvidenceError(code, message, details);
}

function assertCondition(condition, code, message, details = undefined) {
  if (!condition) fail(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
    "FORM_FEEDBACK_OPTIONS_INVALID",
    `${label} options must be a plain record.`,
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch (error) {
    fail("FORM_FEEDBACK_OPTIONS_INVALID", `${label} options could not be inspected safely.`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  assertCondition(
    prototype === Object.prototype || prototype === null,
    "FORM_FEEDBACK_OPTIONS_INVALID",
    `${label} options may not inherit configuration.`,
  );
  const allowed = new Set(allowedNames);
  const normalized = Object.create(null);
  for (const key of keys) {
    assertCondition(
      typeof key === "string" && allowed.has(key),
      "FORM_FEEDBACK_OPTIONS_INVALID",
      `${label} options contain an unknown or symbolic key.`,
    );
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    assertCondition(
      descriptor !== undefined &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.enumerable === true,
      "FORM_FEEDBACK_OPTIONS_INVALID",
      `${label} option ${String(key)} must be an enumerable own data property.`,
    );
    normalized[key] = descriptor.value;
  }
  return Object.freeze(normalized);
}

function validateBuildOptionValues(options) {
  for (const name of BUILD_OPTION_NAMES.filter((candidate) => candidate.endsWith("Path"))) {
    if (Object.hasOwn(options, name)) {
      assertCondition(
        typeof options[name] === "string" && options[name].length > 0,
        "FORM_FEEDBACK_OPTIONS_INVALID",
        `Build option ${name} must be a non-empty path string.`,
      );
    }
  }
  if (Object.hasOwn(options, "verifyPrerequisite")) {
    assertCondition(
      typeof options.verifyPrerequisite === "boolean",
      "FORM_FEEDBACK_OPTIONS_INVALID",
      "Build option verifyPrerequisite must be boolean.",
    );
  }
  for (const name of ["componentApi", "catalogApi", "protocolApi", "validatorApi"]) {
    if (Object.hasOwn(options, name) && options[name] !== undefined) {
      assertCondition(
        options[name] !== null &&
          (typeof options[name] === "object" || typeof options[name] === "function"),
        "FORM_FEEDBACK_OPTIONS_INVALID",
        `Build option ${name} must be an object-like API.`,
      );
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
  assertCondition(
    sourceFile.parseDiagnostics.length === 0,
    "FORM_FEEDBACK_SOURCE_PARSE_FAILED",
    `TypeScript could not parse ${relativePath}.`,
    {
      diagnostics: sourceFile.parseDiagnostics.map(({ code, messageText }) => ({
        code,
        message: ts.flattenDiagnosticMessageText(messageText, "\n"),
      })),
    },
  );
  return sourceFile;
}

function declarationExports(declarationText) {
  const sourceFile = parseSourceFile(
    declarationText,
    "packages/reference-catalog-web/dist/components/index.d.ts",
  );
  const runtime = new Set();
  const types = new Set();
  const signature = [];
  for (const statement of sourceFile.statements) {
    assertCondition(
      ts.isExportDeclaration(statement) &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length > 0 &&
        statement.moduleSpecifier !== undefined &&
        ts.isStringLiteral(statement.moduleSpecifier),
      "FORM_FEEDBACK_PUBLIC_API_DRIFT",
      "The component barrel may contain only non-empty named re-exports from explicit modules.",
      { syntaxKind: ts.SyntaxKind[statement.kind] },
    );
    const moduleSpecifier = statement.moduleSpecifier.text;
    assertCondition(
      /^\.\/[a-z][a-z0-9-]*\.js$/u.test(moduleSpecifier),
      "FORM_FEEDBACK_PUBLIC_API_DRIFT",
      "A component declaration re-export uses an unreviewed module specifier.",
      { moduleSpecifier },
    );
    for (const element of statement.exportClause.elements) {
      assertCondition(
        element.propertyName === undefined,
        "FORM_FEEDBACK_PUBLIC_API_DRIFT",
        "Aliased component declaration exports are forbidden.",
      );
      const target = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
      const kind = target === types ? "type" : "runtime";
      assertCondition(
        !target.has(element.name.text),
        "FORM_FEEDBACK_PUBLIC_API_DRIFT",
        `Duplicate ${kind} export ${element.name.text} is forbidden.`,
      );
      target.add(element.name.text);
      signature.push(`${kind}:${element.name.text}@${moduleSpecifier}`);
    }
  }
  return Object.freeze({
    runtime: [...runtime].sort(),
    types: [...types].sort(),
    signature: Object.freeze(signature),
  });
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
  const moduleName = functionName === "it" ? "vitest" : "node:test";
  const imports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === moduleName,
  );
  const clause = imports.length === 1 ? imports[0].importClause : undefined;
  if (functionName === "it") {
    const bindings =
      clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)
        ? clause.namedBindings.elements
        : [];
    assertCondition(
      imports.length === 1 &&
        clause !== undefined &&
        clause.name === undefined &&
        bindings.every((binding) => binding.propertyName === undefined) &&
        bindings
          .map(({ name }) => name.text)
          .sort()
          .join(",") === "afterEach,describe,expect,it",
      "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
      `${relativePath} must bind the reviewed Vitest API directly.`,
    );
  } else {
    assertCondition(
      imports.length === 1 && clause?.name?.text === "test" && clause.namedBindings === undefined,
      "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
      "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
      "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
      `Test ${JSON.stringify(title)} is conditionally wrapped.`,
    );
    if (functionName === "test") {
      assertCondition(
        ts.isSourceFile(statement.parent),
        "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
      "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
            ts.isStringLiteral(title) &&
            callback !== undefined &&
            (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
            ts.isExpressionStatement(node.parent),
          "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
          "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
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
    "packages/reference-catalog-web/test/interactive-components.types.tsx",
  );
  return (sourceFile.commentDirectives ?? [])
    .filter(({ type }) => type === ts.CommentDirectiveType.ExpectError)
    .map(({ range }) => {
      const directive = typeTestText.slice(range.pos, range.end);
      const match = /@ts-expect-error\s+(M03-T06-N[0-9]{2})\b/u.exec(directive);
      assertCondition(
        match !== null,
        "FORM_FEEDBACK_TYPE_INVENTORY_DRIFT",
        "Every compiler-recognized expect-error needs a stable M03-T06 case id.",
      );
      return match[1];
    });
}

function normalizedSourceSha256(sourceText, relativePath) {
  const sourceFile = parseSourceFile(sourceText, relativePath);
  const printed = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true })
    .printFile(sourceFile);
  return sha256(Buffer.from(printed));
}

function verifySourceAudit(sources) {
  const combined = Object.values(sources).join("\n");
  assertCondition(
    !/(?:\bdangerouslySetInnerHTML\s*=|["']dangerouslySetInnerHTML["']\s*:)/u.test(combined),
    "FORM_FEEDBACK_UNSAFE_HTML_PATH",
    "The reviewed component sources contain a raw HTML execution path.",
  );
  assertCondition(
    !/<[A-Za-z][^>]*\{\.\.\./u.test(combined),
    "FORM_FEEDBACK_DOM_PROP_PASSTHROUGH",
    "The reviewed components spread undeclared properties into DOM elements.",
  );
  assertCondition(
    !/\b(?:autoFocus|contentEditable|onKeyDown|onKeyPress|onKeyUp|tabIndex)\b/u.test(combined),
    "FORM_FEEDBACK_ACCESSIBILITY_SOURCE_DRIFT",
    "The component sources contain an unreviewed focus or keyboard surface.",
  );
  assertCondition(
    !/\baria-live\b/u.test(sources["alert.tsx"]),
    "FORM_FEEDBACK_ACCESSIBILITY_SOURCE_DRIFT",
    "Alert must rely on the reviewed live-region roles rather than redundant aria-live behavior.",
  );

  const profiles = {};
  for (const [name, source] of Object.entries(sources)) {
    const actual = normalizedSourceSha256(source, name);
    const expected = EXPECTED_SOURCE_PROFILES[name];
    assertCondition(
      actual === expected,
      "FORM_FEEDBACK_SOURCE_SHAPE_DRIFT",
      `${name} differs from its exact reviewed syntax profile.`,
      { actual, expected },
    );
    profiles[name] = actual;
  }
  return Object.freeze(profiles);
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
      "FORM_FEEDBACK_REGISTRATION_MUTABLE",
      `${label} contains mutable or non-data objects.`,
    );
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      assertCondition(
        typeof key === "string" && descriptor !== undefined && Object.hasOwn(descriptor, "value"),
        "FORM_FEEDBACK_REGISTRATION_MUTABLE",
        `${label} contains symbolic or accessor-backed data.`,
      );
      pending.push(descriptor.value);
    }
  }
}

function captureStableComponentApi(componentApi) {
  assertCondition(
    componentApi !== null &&
      (typeof componentApi === "object" || typeof componentApi === "function"),
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component public API must be an inspectable module record.",
  );
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(componentApi);
    keys = Reflect.ownKeys(componentApi);
  } catch (error) {
    fail("FORM_FEEDBACK_PUBLIC_API_DRIFT", "The component API could not be inspected safely.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  const stringKeys = keys.filter((key) => typeof key === "string").sort();
  const symbolKeys = keys.filter((key) => typeof key === "symbol");
  assertArrayEqual(
    stringKeys,
    EXPECTED_RUNTIME_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component public runtime exports changed.",
  );
  assertCondition(
    symbolKeys.length === 0 || (symbolKeys.length === 1 && symbolKeys[0] === Symbol.toStringTag),
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component public API contains an unreviewed symbolic export.",
  );

  const descriptors = new Map();
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(componentApi, key);
    assertCondition(
      descriptor !== undefined && Object.hasOwn(descriptor, "value"),
      "FORM_FEEDBACK_PUBLIC_API_DRIFT",
      "The component public API may not expose accessor-backed bindings.",
    );
    if (typeof key === "string") {
      assertCondition(
        descriptor.enumerable === true,
        "FORM_FEEDBACK_PUBLIC_API_DRIFT",
        `Component export ${key} must be enumerable.`,
      );
      captured[key] = descriptor.value;
    } else {
      assertCondition(
        descriptor.enumerable === false && descriptor.value === "Module",
        "FORM_FEEDBACK_PUBLIC_API_DRIFT",
        "Only the standard ESM module tag is permitted.",
      );
    }
    descriptors.set(key, Object.freeze({ ...descriptor }));
  }
  assertCondition(
    captured.ALERT_CAPABILITY_ID === "com.example.ui/Alert" &&
      captured.BUTTON_CAPABILITY_ID === "com.example.ui/Button" &&
      captured.STACK_CAPABILITY_ID === "com.example.ui/Stack" &&
      captured.TEXT_CAPABILITY_ID === "com.example.ui/Text" &&
      captured.TEXT_FIELD_CAPABILITY_ID === "com.example.ui/TextField" &&
      ["Alert", "Button", "Stack", "Text", "TextField"].every(
        (name) => typeof captured[name] === "function" || typeof captured[name] === "object",
      ) &&
      [
        "alertComponentRegistration",
        "buttonComponentRegistration",
        "stackComponentRegistration",
        "textComponentRegistration",
        "textFieldComponentRegistration",
      ].every((name) => captured[name] !== null && typeof captured[name] === "object"),
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component public API bindings do not have the reviewed identities and kinds.",
  );

  function assertStable() {
    let currentKeys;
    try {
      currentKeys = Reflect.ownKeys(componentApi);
    } catch (error) {
      fail("FORM_FEEDBACK_PUBLIC_API_MUTATED", "The component API became uninspectable.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    assertCondition(
      currentKeys.length === keys.length && currentKeys.every((key, index) => key === keys[index]),
      "FORM_FEEDBACK_PUBLIC_API_MUTATED",
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
        "FORM_FEEDBACK_PUBLIC_API_MUTATED",
        "A component public API binding changed during evidence generation.",
      );
    }
    assertCondition(
      Object.getPrototypeOf(componentApi) === prototype,
      "FORM_FEEDBACK_PUBLIC_API_MUTATED",
      "The component public API prototype changed during evidence generation.",
    );
  }
  return Object.freeze({ api: Object.freeze(captured), assertStable });
}

async function verifyFoundationPrerequisite(artifactPath) {
  let verification;
  try {
    verification = await verifyReferenceCatalogWebComponentsEvidence({ artifactPath });
  } catch (error) {
    fail("FORM_FEEDBACK_PREREQUISITE_DRIFT", "M03-T05 prerequisite verification failed.", {
      predecessorCode: typeof error?.code === "string" ? error.code : "UNEXPECTED_ERROR",
    });
  }
  const bytes = await readFile(artifactPath);
  let artifact;
  try {
    artifact = JSON.parse(bytes);
  } catch {
    fail("FORM_FEEDBACK_PREREQUISITE_DRIFT", "M03-T05 prerequisite is not valid JSON.");
  }
  assertCondition(
    artifact.schemaVersion === 1 &&
      artifact.task === "M03-T05" &&
      artifact.result === "PASS" &&
      artifact.claim?.protocol === "0.1.0" &&
      artifact.claim?.target === "web-react" &&
      artifact.evidence?.provenance?.mode === "tracked-defaults",
    "FORM_FEEDBACK_PREREQUISITE_DRIFT",
    "M03-T05 prerequisite identity or production provenance changed.",
  );
  const digest = sha256(bytes);
  assertCondition(
    verification.artifactSha256 === digest,
    "FORM_FEEDBACK_PREREQUISITE_DRIFT",
    "M03-T05 verifier and prerequisite artifact bytes disagree.",
  );
  return Object.freeze({
    task: "M03-T05",
    result: "PASS",
    verifiedBy: "verifyReferenceCatalogWebComponentsEvidence",
    artifactSha256: digest,
  });
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
      componentExport.types === "./dist/components/index.d.ts" &&
      componentExport.import === "./dist/components/index.js" &&
      packageJson.scripts?.["test:interactive-components"] ===
        "vitest run test/interactive-components.test.tsx" &&
      componentConsumerText.trim() === EXPECTED_COMPONENT_CONSUMER_SOURCE,
    "FORM_FEEDBACK_PACKAGE_BOUNDARY_DRIFT",
    "The reviewed component subpath, React peer, test, or consumer boundary changed.",
  );
}

function verifyRootWiring(rootPackage) {
  for (const [kind, expected] of Object.entries(EXPECTED_ROOT_SCRIPTS)) {
    const name = `${kind}:reference-catalog-web-form-feedback`;
    assertCondition(
      rootPackage.scripts?.[name] === expected,
      "FORM_FEEDBACK_COMMAND_WIRING_DRIFT",
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
    checkSegments.includes("pnpm verify:reference-catalog-web-form-feedback") &&
      testSegments.includes("pnpm test:reference-catalog-web-form-feedback"),
    "FORM_FEEDBACK_COMMAND_WIRING_DRIFT",
    "The complete quality gate does not execute M03-T06 verification and tests.",
  );
}

function createReferenceCatalog(catalogApi, componentApi) {
  return catalogApi.createCatalogManifest({
    id: "com.example.web-catalog",
    version: "1.0.0",
    target: "web-react",
    packageDigest: `sha256:${"0".repeat(64)}`,
    components: [
      componentApi.stackComponentRegistration,
      componentApi.textComponentRegistration,
      componentApi.textFieldComponentRegistration,
      componentApi.buttonComponentRegistration,
      componentApi.alertComponentRegistration,
    ],
  });
}

function createReferenceSource(componentApi, catalog) {
  return {
    kind: "desen.source",
    desen: "0.1.0",
    id: "com.example.form-feedback-proof",
    catalogs: [{ id: catalog.id, version: catalog.version, target: catalog.target }],
    entry: "main",
    surfaces: {
      main: {
        id: "main",
        state: {
          fieldValue: {
            schema: { type: "string" },
            initial: "",
          },
        },
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
                props: { text: "Form proof", role: "heading" },
              },
              {
                id: "main.field",
                use: componentApi.TEXT_FIELD_CAPABILITY_ID,
                props: {
                  label: "Email",
                  value: "",
                  placeholder: "name@example.test",
                  secure: false,
                  disabled: false,
                  invalid: false,
                },
                on: {
                  change: [
                    {
                      type: "state.set",
                      path: "fieldValue",
                      value: { $ref: "event.value" },
                    },
                  ],
                },
              },
              {
                id: "main.button",
                use: componentApi.BUTTON_CAPABILITY_ID,
                props: { label: "Continue", variant: "primary", loading: false, disabled: false },
                on: {
                  press: [
                    {
                      type: "component.command",
                      target: "main.field",
                      command: "focus",
                      input: {},
                    },
                  ],
                },
              },
              {
                id: "main.alert",
                use: componentApi.ALERT_CAPABILITY_ID,
                props: { tone: "critical", text: "Try again." },
              },
            ],
          },
        },
      },
    },
  };
}

function verifyCatalogAndContracts({ catalogApi, componentApi, validatorApi }) {
  const catalog = createReferenceCatalog(catalogApi, componentApi);
  const structural = validatorApi.validateDesenCatalog(catalog);
  const semantic = validatorApi.validateDesenCatalogSemantics(catalog);
  const catalogSet = validatorApi.validateDesenCatalogSet([catalog]);
  const componentSet = validatorApi.validateDesenComponentCatalogSet([catalog]);
  const interactionSet = validatorApi.validateDesenInteractionCatalogSet([catalog]);
  const executionSet = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  assertCondition(
    structural.valid &&
      semantic.valid &&
      catalogSet.valid &&
      componentSet.valid &&
      interactionSet.valid &&
      executionSet.valid,
    "FORM_FEEDBACK_CATALOG_INVALID",
    "The cumulative five-component Catalog did not pass the built validator.",
    {
      structural: structural.diagnostics,
      semantic: semantic.diagnostics,
      catalogSet: catalogSet.diagnostics,
      componentSet: componentSet.diagnostics,
      interactionSet: interactionSet.diagnostics,
      executionSet: executionSet.diagnostics,
    },
  );

  const source = createReferenceSource(componentApi, catalog);
  const sourceStructural = validatorApi.validateDesenSource(source);
  const sourceSemantic = validatorApi.validateDesenSourceSemantics(source, catalogSet.value);
  const sourceComponents = validatorApi.validateDesenSourceComponentContracts(
    source,
    componentSet.value,
  );
  const sourceInteractions = validatorApi.validateDesenSourceInteractionContracts(
    source,
    interactionSet.value,
  );
  const sourceBindings = validatorApi.validateDesenSourceBindingContracts(
    source,
    interactionSet.value,
  );
  const sourceExecution = validatorApi.validateDesenSourceExecutionContracts(
    source,
    executionSet.value,
  );
  const [stateWriteObligation] = sourceExecution.obligations;
  assertCondition(
    sourceStructural.valid &&
      sourceSemantic.valid &&
      sourceComponents.valid &&
      sourceComponents.obligations.length === 0 &&
      sourceInteractions.valid &&
      sourceInteractions.obligations.length === 0 &&
      sourceBindings.valid &&
      sourceBindings.obligations.length === 0 &&
      sourceExecution.valid &&
      sourceExecution.obligations.length === 1 &&
      stateWriteObligation?.kind === "state-write" &&
      stateWriteObligation.pointer === "/surfaces/main/root/slots/default/1/on/change/0/value" &&
      stateWriteObligation.context.documentId === "com.example.form-feedback-proof" &&
      stateWriteObligation.context.surfaceId === "main" &&
      stateWriteObligation.context.subject.kind === "node" &&
      stateWriteObligation.context.subject.id === "main.field" &&
      stateWriteObligation.context.capabilityId === componentApi.TEXT_FIELD_CAPABILITY_ID,
    "FORM_FEEDBACK_SOURCE_INVALID",
    "The controlled cumulative Source did not satisfy its structural through execution contracts.",
    {
      structural: sourceStructural.diagnostics,
      semantic: sourceSemantic.diagnostics,
      components: sourceComponents.diagnostics,
      interactions: sourceInteractions.diagnostics,
      bindings: sourceBindings.diagnostics,
      execution: sourceExecution.diagnostics,
      obligations: {
        components: sourceComponents.obligations,
        interactions: sourceInteractions.obligations,
        bindings: sourceBindings.obligations,
        execution: sourceExecution.obligations,
      },
    },
  );

  const positions = Object.freeze({
    [componentApi.TEXT_FIELD_CAPABILITY_ID]: 1,
    [componentApi.BUTTON_CAPABILITY_ID]: 2,
    [componentApi.ALERT_CAPABILITY_ID]: 3,
  });
  const closedSchemaDiagnostics = [];
  for (const id of EXPECTED_NEW_COMPONENT_IDS) {
    const mutated = structuredClone(source);
    const index = positions[id];
    mutated.surfaces.main.root.slots.default[index].props.unknown = true;
    const result = validatorApi.validateDesenSourceComponentContracts(mutated, componentSet.value);
    const diagnostic = result.diagnostics[0];
    const expectedPointer = `/surfaces/main/root/slots/default/${index}/props/unknown`;
    assertCondition(
      !result.valid &&
        result.diagnostics.length === 1 &&
        diagnostic?.code === "UNKNOWN_PROP" &&
        diagnostic.pointer === expectedPointer,
      "FORM_FEEDBACK_CLOSED_SCHEMA_UNPROVEN",
      `${id} did not reject one exact unknown property.`,
      { diagnostics: result.diagnostics, expectedPointer },
    );
    closedSchemaDiagnostics.push(
      Object.freeze({ id, code: diagnostic.code, pointer: diagnostic.pointer }),
    );
  }

  const requiredCases = [
    Object.freeze({
      id: componentApi.TEXT_FIELD_CAPABILITY_ID,
      index: 1,
      property: "label",
    }),
    Object.freeze({
      id: componentApi.TEXT_FIELD_CAPABILITY_ID,
      index: 1,
      property: "value",
    }),
    Object.freeze({
      id: componentApi.BUTTON_CAPABILITY_ID,
      index: 2,
      property: "label",
    }),
    Object.freeze({
      id: componentApi.ALERT_CAPABILITY_ID,
      index: 3,
      property: "tone",
    }),
    Object.freeze({
      id: componentApi.ALERT_CAPABILITY_ID,
      index: 3,
      property: "text",
    }),
  ];
  const requiredDiagnostics = [];
  for (const entry of requiredCases) {
    const mutated = structuredClone(source);
    Reflect.deleteProperty(
      mutated.surfaces.main.root.slots.default[entry.index].props,
      entry.property,
    );
    const result = validatorApi.validateDesenSourceComponentContracts(mutated, componentSet.value);
    const diagnostic = result.diagnostics[0];
    const expectedPointer = `/surfaces/main/root/slots/default/${entry.index}/props/${entry.property}`;
    assertCondition(
      !result.valid &&
        result.diagnostics.length === 1 &&
        diagnostic?.code === "PROP_TYPE_MISMATCH" &&
        diagnostic.pointer === expectedPointer,
      "FORM_FEEDBACK_REQUIRED_PROP_UNPROVEN",
      `${entry.id} did not enforce required property ${entry.property}.`,
      { diagnostics: result.diagnostics, expectedPointer },
    );
    requiredDiagnostics.push(
      Object.freeze({
        id: entry.id,
        property: entry.property,
        code: diagnostic.code,
        pointer: diagnostic.pointer,
      }),
    );
  }

  const dangerAlert = structuredClone(source);
  dangerAlert.surfaces.main.root.slots.default[3].props.tone = "danger";
  const dangerResult = validatorApi.validateDesenSourceComponentContracts(
    dangerAlert,
    componentSet.value,
  );
  const dangerDiagnostic = dangerResult.diagnostics[0];
  assertCondition(
    !dangerResult.valid &&
      dangerResult.diagnostics.length === 1 &&
      dangerDiagnostic?.code === "PROP_TYPE_MISMATCH" &&
      dangerDiagnostic.pointer === "/surfaces/main/root/slots/default/3/props/tone",
    "FORM_FEEDBACK_ALERT_TONE_UNPROVEN",
    "Alert admitted the conflicting prose-only danger spelling.",
  );

  const changePayload = validatorApi.validateDesenEventPayload(
    { value: "proof@example.test" },
    {
      capabilityKind: "component",
      capabilityId: componentApi.TEXT_FIELD_CAPABILITY_ID,
      eventName: "change",
    },
    interactionSet.value,
  );
  const invalidChangePayload = validatorApi.validateDesenEventPayload(
    { value: "proof@example.test", nativeEvent: true },
    {
      capabilityKind: "component",
      capabilityId: componentApi.TEXT_FIELD_CAPABILITY_ID,
      eventName: "change",
    },
    interactionSet.value,
  );
  const pressPayload = validatorApi.validateDesenEventPayload(
    {},
    {
      capabilityKind: "component",
      capabilityId: componentApi.BUTTON_CAPABILITY_ID,
      eventName: "press",
    },
    interactionSet.value,
  );
  const invalidPressPayload = validatorApi.validateDesenEventPayload(
    { target: "dom" },
    {
      capabilityKind: "component",
      capabilityId: componentApi.BUTTON_CAPABILITY_ID,
      eventName: "press",
    },
    interactionSet.value,
  );
  assertCondition(
    changePayload.valid &&
      !invalidChangePayload.valid &&
      invalidChangePayload.diagnostics[0]?.code === "EVENT_PAYLOAD_INVALID" &&
      pressPayload.valid &&
      !invalidPressPayload.valid &&
      invalidPressPayload.diagnostics[0]?.code === "EVENT_PAYLOAD_INVALID",
    "FORM_FEEDBACK_EVENT_PAYLOAD_UNPROVEN",
    "The declared change or press event payload boundary changed.",
  );

  const focusSelector = {
    kind: "component-command-input",
    capabilityId: componentApi.TEXT_FIELD_CAPABILITY_ID,
    commandName: "focus",
  };
  const focusInput = validatorApi.validateDesenExecutionValue(
    {},
    focusSelector,
    executionSet.value,
  );
  const invalidFocusInput = validatorApi.validateDesenExecutionValue(
    { unexpected: true },
    focusSelector,
    executionSet.value,
  );
  assertCondition(
    focusInput.valid &&
      !invalidFocusInput.valid &&
      invalidFocusInput.diagnostics.length === 1 &&
      invalidFocusInput.diagnostics[0]?.code === "COMMAND_INPUT_INVALID" &&
      invalidFocusInput.diagnostics[0].pointer === "/unexpected",
    "FORM_FEEDBACK_COMMAND_INPUT_UNPROVEN",
    "The declared TextField focus command input boundary changed.",
    { diagnostics: invalidFocusInput.diagnostics },
  );

  return Object.freeze({
    catalog,
    source,
    sourceValidation: Object.freeze({
      structural: "PASS",
      semantic: "PASS",
      componentContracts: "PASS",
      interactionContracts: "PASS",
      bindingContracts: "PASS",
      executionContracts: "PASS",
      staticObligations: 0,
      runtimeObligations: Object.freeze([
        Object.freeze({
          kind: stateWriteObligation.kind,
          pointer: stateWriteObligation.pointer,
          reason: "event-derived state writes require runtime value validation",
        }),
      ]),
      changeBinding: "state.set(fieldValue <- event.value)",
      pressBinding: "component.command(main.field.focus, {})",
    }),
    closedSchemaDiagnostics: Object.freeze(closedSchemaDiagnostics),
    requiredDiagnostics: Object.freeze(requiredDiagnostics),
    dangerDiagnostic: Object.freeze({
      code: dangerDiagnostic.code,
      pointer: dangerDiagnostic.pointer,
    }),
    eventPayloads: Object.freeze({
      changeAccepted: true,
      changeExtraPropertyRejected: true,
      pressAccepted: true,
      pressExtraPropertyRejected: true,
    }),
    commandInputs: Object.freeze({
      focusEmptyObjectAccepted: true,
      focusExtraPropertyRejected: true,
      rejection: Object.freeze({
        code: invalidFocusInput.diagnostics[0].code,
        pointer: invalidFocusInput.diagnostics[0].pointer,
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

const TEXT_FIELD_ROOT_STYLE = "display:grid;gap:var(--desen-space-xs, 0.25rem)";
const TEXT_FIELD_LABEL_STYLE = "color:var(--desen-color-text, #111827);font-weight:600";
const TEXT_FIELD_BASE_CONTROL_STYLE = Object.freeze([
  "background:var(--desen-color-surface, #ffffff)",
  "border:1px solid var(--desen-color-border, #6b7280)",
  "border-radius:var(--desen-radius-control, 0.375rem)",
  "color:var(--desen-color-text, #111827)",
  "font:inherit",
  "min-width:0",
  "padding:var(--desen-space-sm, 0.5rem)",
]);
const BUTTON_ROOT_STYLE = Object.freeze([
  "align-items:center",
  "border-style:solid",
  "border-width:1px",
  "border-radius:var(--desen-radius-control, 0.375rem)",
  "display:inline-flex",
  "font:inherit",
  "font-weight:600",
  "justify-content:center",
  "min-height:2.5rem",
  "padding:var(--desen-space-sm, 0.5rem) var(--desen-space-md, 1rem)",
]);
const BUTTON_VARIANT_STYLES = Object.freeze({
  primary: Object.freeze([
    "background:var(--desen-color-action-primary, #1d4ed8)",
    "border-color:var(--desen-color-action-primary, #1d4ed8)",
    "color:var(--desen-color-on-action, #ffffff)",
  ]),
  secondary: Object.freeze([
    "background:var(--desen-color-surface, #ffffff)",
    "border-color:var(--desen-color-border-strong, #374151)",
    "color:var(--desen-color-text, #111827)",
  ]),
  danger: Object.freeze([
    "background:var(--desen-color-critical, #b91c1c)",
    "border-color:var(--desen-color-critical, #b91c1c)",
    "color:var(--desen-color-on-critical, #ffffff)",
  ]),
});
const ALERT_ROOT_STYLE = Object.freeze([
  "border-inline-start-style:solid",
  "border-inline-start-width:4px",
  "border-radius:var(--desen-radius-control, 0.375rem)",
  "padding:var(--desen-space-sm, 0.5rem) var(--desen-space-md, 1rem)",
]);
const ALERT_TONE_STYLES = Object.freeze({
  info: Object.freeze([
    "background:var(--desen-color-info-surface, #eff6ff)",
    "border-color:var(--desen-color-info, #1d4ed8)",
    "color:var(--desen-color-info-text, #1e3a8a)",
  ]),
  success: Object.freeze([
    "background:var(--desen-color-success-surface, #f0fdf4)",
    "border-color:var(--desen-color-success, #15803d)",
    "color:var(--desen-color-success-text, #14532d)",
  ]),
  warning: Object.freeze([
    "background:var(--desen-color-warning-surface, #fffbeb)",
    "border-color:var(--desen-color-warning, #a16207)",
    "color:var(--desen-color-warning-text, #713f12)",
  ]),
  critical: Object.freeze([
    "background:var(--desen-color-critical-surface, #fef2f2)",
    "border-color:var(--desen-color-critical, #b91c1c)",
    "color:var(--desen-color-critical-text, #7f1d1d)",
  ]),
});
const PROOF_TEXT_SAMPLES = Object.freeze([
  "",
  "Body",
  "Heading",
  "Caption",
  "Email",
  "Password",
  "Continue",
  "Try again.",
  "conditional-sentinel",
  '<img src=x onerror="bad()"><script>bad()</script>',
  `&<>"'`,
  "İstanbul · DESEN 👩‍💻",
  "Line one\nLine two",
  "null undefined false",
]);
let interactionEnvironmentTail = Promise.resolve();

function expectedTextFieldHtml({
  label,
  value,
  placeholder,
  secure = false,
  disabled = false,
  invalid = false,
}) {
  const style = [...TEXT_FIELD_BASE_CONTROL_STYLE];
  if (disabled) {
    style[0] = "background:var(--desen-color-surface-disabled, #f3f4f6)";
  }
  if (invalid) style.push("border-color:var(--desen-color-critical, #b91c1c)");
  if (disabled) style.push("cursor:not-allowed", "opacity:0.7");
  const attributes = [];
  if (invalid) attributes.push('aria-invalid="true"');
  if (disabled) attributes.push('disabled=""');
  attributes.push('id="_R_0_"');
  if (placeholder !== undefined) {
    attributes.push(`placeholder="${escapeHtmlText(placeholder)}"`);
  }
  attributes.push(`style="${style.join(";")}"`);
  attributes.push(`type="${secure ? "password" : "text"}"`);
  attributes.push(`value="${escapeHtmlText(value)}"`);
  return (
    `<div style="${TEXT_FIELD_ROOT_STYLE}">` +
    `<label for="_R_0_" style="${TEXT_FIELD_LABEL_STYLE}">${escapeHtmlText(label)}</label>` +
    `<input ${attributes.join(" ")}/></div>`
  );
}

function expectedButtonHtml({ label, variant = "primary", loading = false, disabled = false }) {
  const inactive = disabled || loading;
  const style = [...BUTTON_ROOT_STYLE, ...BUTTON_VARIANT_STYLES[variant]];
  style.push(`cursor:${loading && !disabled ? "wait" : inactive ? "not-allowed" : "pointer"}`);
  if (inactive) style.push("opacity:0.7");
  const attributes = [];
  if (loading) {
    attributes.push('aria-busy="true"', 'aria-disabled="true"', 'data-loading="true"');
  }
  attributes.push(`data-variant="${variant}"`);
  if (disabled) attributes.push('disabled=""');
  attributes.push(`style="${style.join(";")}"`, 'type="button"');
  return `<button ${attributes.join(" ")}>${escapeHtmlText(label)}</button>`;
}

function expectedAlertHtml({ text, tone }) {
  const role = tone === "critical" ? "alert" : "status";
  const style = [...ALERT_ROOT_STYLE, ...ALERT_TONE_STYLES[tone]];
  return (
    `<div data-tone="${tone}" role="${role}" style="${style.join(";")}">` +
    `${escapeHtmlText(text)}</div>`
  );
}

function withExclusiveInteractionEnvironment(task) {
  const execution = interactionEnvironmentTail.then(task, task);
  interactionEnvironmentTail = execution.then(
    () => undefined,
    () => undefined,
  );
  return execution;
}

function installDomGlobals(dom) {
  const window = dom.window;
  const values = {
    window,
    self: window,
    document: window.document,
    navigator: window.navigator,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLButtonElement: window.HTMLButtonElement,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    MutationObserver: window.MutationObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: false,
      value,
      writable: true,
    });
  }
  return () => {
    for (const [name, descriptor] of [...previous.entries()].reverse()) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
      else Object.defineProperty(globalThis, name, descriptor);
    }
  };
}

async function verifyInteractions(componentApi, React) {
  return withExclusiveInteractionEnvironment(async () => {
    const { JSDOM } = PACKAGE_REQUIRE("jsdom");
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
      url: "https://proof.invalid/",
    });
    const restoreGlobals = installDomGlobals(dom);
    try {
      const { createRoot } = PACKAGE_REQUIRE("react-dom/client");
      assertCondition(
        typeof React.act === "function" && typeof createRoot === "function",
        "FORM_FEEDBACK_REACT_RUNTIME_DRIFT",
        "The reviewed React DOM interaction runtime is unavailable.",
      );

      async function withMounted(element, inspect) {
        const container = dom.window.document.createElement("div");
        dom.window.document.body.append(container);
        const root = createRoot(container);
        try {
          await React.act(async () => {
            root.render(element);
          });
          return await inspect(container);
        } finally {
          await React.act(async () => {
            root.unmount();
          });
          container.remove();
        }
      }

      const changeCalls = [];
      const changeVectors = await withMounted(
        React.createElement(componentApi.TextField, {
          label: "Interaction proof",
          onChange(...args) {
            changeCalls.push(Object.freeze([...args]));
          },
          value: "__desen_interaction_initial__",
        }),
        async (container) => {
          const input = container.querySelector("input");
          const valueSetter = Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          )?.set;
          assertCondition(
            input !== null && typeof valueSetter === "function",
            "FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT",
            "TextField did not expose one native input interaction target.",
          );

          const vectors = [];
          for (const [index, sample] of PROOF_TEXT_SAMPLES.entries()) {
            let nativeValue;
            await React.act(async () => {
              valueSetter.call(input, sample);
              nativeValue = input.value;
              input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
            });
            const args = changeCalls[index];
            const payload = args?.[0];
            const descriptor =
              payload === null || typeof payload !== "object"
                ? undefined
                : Object.getOwnPropertyDescriptor(payload, "value");
            assertCondition(
              changeCalls.length === index + 1 &&
                args.length === 1 &&
                payload !== null &&
                typeof payload === "object" &&
                Object.getPrototypeOf(payload) === Object.prototype &&
                Reflect.ownKeys(payload).length === 1 &&
                Reflect.ownKeys(payload)[0] === "value" &&
                descriptor !== undefined &&
                Object.hasOwn(descriptor, "value") &&
                descriptor.value === nativeValue &&
                descriptor.enumerable === true &&
                descriptor.configurable === false &&
                descriptor.writable === false &&
                Object.isFrozen(payload),
              "FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT",
              "TextField did not emit one fresh frozen exact inert change payload.",
              { index, sampleSha256: sha256(Buffer.from(sample)) },
            );
            vectors.push(
              Object.freeze({
                inputSha256: sha256(Buffer.from(sample)),
                nativeValueSha256: sha256(Buffer.from(nativeValue)),
                payloadSha256: sha256(Buffer.from(JSON.stringify(payload))),
                frozen: true,
              }),
            );
          }
          assertCondition(
            new Set(changeCalls.map(([payload]) => payload)).size === PROOF_TEXT_SAMPLES.length,
            "FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT",
            "TextField reused a change payload object.",
          );
          return Object.freeze(vectors);
        },
      );

      const disabledChangeCalls = [];
      await withMounted(
        React.createElement(componentApi.TextField, {
          disabled: true,
          label: "Disabled change proof",
          onChange(...args) {
            disabledChangeCalls.push(Object.freeze([...args]));
          },
          value: "",
        }),
        async (container) => {
          const input = container.querySelector("input");
          const valueSetter = Object.getOwnPropertyDescriptor(
            dom.window.HTMLInputElement.prototype,
            "value",
          )?.set;
          assertCondition(
            input !== null && typeof valueSetter === "function",
            "FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT",
            "Disabled TextField did not expose its native interaction target.",
          );
          await React.act(async () => {
            valueSetter.call(input, "must-not-cross");
            input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
          });
          assertCondition(
            disabledChangeCalls.length === 0,
            "FORM_FEEDBACK_TEXT_FIELD_INTERACTION_DRIFT",
            "Disabled TextField emitted a change callback.",
          );
        },
      );

      function assertNarrowFocusHandle(handle, disabled) {
        const focusDescriptor =
          handle === null || typeof handle !== "object"
            ? undefined
            : Object.getOwnPropertyDescriptor(handle, "focus");
        assertCondition(
          handle !== null &&
            typeof handle === "object" &&
            Object.getPrototypeOf(handle) === Object.prototype &&
            Reflect.ownKeys(handle).length === 1 &&
            Reflect.ownKeys(handle)[0] === "focus" &&
            focusDescriptor !== undefined &&
            Object.hasOwn(focusDescriptor, "value") &&
            typeof focusDescriptor.value === "function" &&
            focusDescriptor.enumerable === true &&
            focusDescriptor.configurable === false &&
            focusDescriptor.writable === false &&
            Object.isFrozen(handle) &&
            !(handle instanceof dom.window.HTMLElement) &&
            !Object.hasOwn(handle, "current"),
          "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
          "TextField did not expose the reviewed narrow frozen focus command handle.",
          { disabled },
        );
        return focusDescriptor.value;
      }

      const focusScenarios = [];
      const enabledRef = React.createRef();
      await withMounted(
        React.createElement(componentApi.TextField, {
          label: "Enabled focus proof",
          ref: enabledRef,
          value: "",
        }),
        async (container) => {
          const input = container.querySelector("input");
          assertCondition(
            input !== null,
            "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
            "Enabled TextField focus proof lost its native input.",
          );
          const focus = assertNarrowFocusHandle(enabledRef.current, false);
          let focusResult;
          await React.act(async () => {
            focusResult = focus();
          });
          assertCondition(
            focusResult === undefined && dom.window.document.activeElement === input,
            "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
            "The enabled TextField focus handle leaked a result or missed its native input.",
          );
          focusScenarios.push(
            Object.freeze({
              disabled: false,
              focused: true,
              frozen: true,
              keys: Object.freeze(["focus"]),
            }),
          );
        },
      );

      const disabledRef = React.createRef();
      await withMounted(
        React.createElement(componentApi.TextField, {
          disabled: true,
          label: "Disabled focus proof",
          ref: disabledRef,
          value: "",
        }),
        async (container) => {
          const input = container.querySelector("input");
          assertCondition(
            input !== null,
            "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
            "Disabled TextField focus proof lost its native input.",
          );
          const focus = assertNarrowFocusHandle(disabledRef.current, true);
          const sentinel = dom.window.document.createElement("button");
          sentinel.type = "button";
          dom.window.document.body.append(sentinel);
          try {
            sentinel.focus();
            assertCondition(
              dom.window.document.activeElement === sentinel,
              "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
              "The disabled TextField focus sentinel could not establish its baseline.",
            );
            let focusResult;
            await React.act(async () => {
              focusResult = focus();
            });
            assertCondition(
              focusResult === undefined && dom.window.document.activeElement === sentinel,
              "FORM_FEEDBACK_TEXT_FIELD_FOCUS_DRIFT",
              "The disabled TextField focus handle leaked a result or changed the active element.",
            );
          } finally {
            sentinel.remove();
          }
          focusScenarios.push(
            Object.freeze({
              disabled: true,
              focused: false,
              frozen: true,
              keys: Object.freeze(["focus"]),
            }),
          );
        },
      );

      const booleanStates = Object.freeze([
        Object.freeze({ input: undefined, label: "omitted" }),
        Object.freeze({ input: false, label: "false" }),
        Object.freeze({ input: true, label: "true" }),
      ]);
      const pressCalls = [];
      const pressVectors = [];
      for (const loading of booleanStates) {
        for (const disabled of booleanStates) {
          const props = {
            label: "Interaction proof",
            onPress(...args) {
              pressCalls.push(Object.freeze([...args]));
            },
          };
          if (loading.input !== undefined) props.loading = loading.input;
          if (disabled.input !== undefined) props.disabled = disabled.input;
          const before = pressCalls.length;
          const loadingFocusPreserved = await withMounted(
            React.createElement(componentApi.Button, props),
            async (container) => {
              const button = container.querySelector("button");
              assertCondition(
                button !== null && button.type === "button",
                "FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT",
                "Button did not expose one native non-submit interaction target.",
              );
              const mustPreserveFocus = (loading.input ?? false) && !(disabled.input ?? false);
              if (mustPreserveFocus) {
                button.focus();
                assertCondition(
                  dom.window.document.activeElement === button,
                  "FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT",
                  "Loading Button did not retain its native focus target before activation.",
                );
              }
              await React.act(async () => {
                button.click();
              });
              assertCondition(
                !mustPreserveFocus || dom.window.document.activeElement === button,
                "FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT",
                "Loading Button moved focus during suppressed activation.",
              );
              return mustPreserveFocus ? true : null;
            },
          );
          const shouldEmit = !(loading.input ?? false) && !(disabled.input ?? false);
          const emitted = pressCalls.length - before;
          const args = shouldEmit ? pressCalls[before] : undefined;
          const payload = args?.[0];
          assertCondition(
            emitted === (shouldEmit ? 1 : 0) &&
              (!shouldEmit ||
                (args.length === 1 &&
                  payload !== null &&
                  typeof payload === "object" &&
                  Object.getPrototypeOf(payload) === Object.prototype &&
                  Reflect.ownKeys(payload).length === 0 &&
                  Object.isFrozen(payload))),
            "FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT",
            "Button press emission differs from the reviewed disabled and loading boundary.",
            { disabled: disabled.label, emitted, loading: loading.label, shouldEmit },
          );
          pressVectors.push(
            Object.freeze({
              disabled: disabled.label,
              loading: loading.label,
              loadingFocusPreserved,
              emitted,
              payloadSha256:
                payload === undefined ? null : sha256(Buffer.from(JSON.stringify(payload))),
            }),
          );
        }
      }
      assertCondition(
        pressCalls.length === 4 &&
          new Set(pressCalls.map(([payload]) => payload)).size === pressCalls.length,
        "FORM_FEEDBACK_BUTTON_INTERACTION_DRIFT",
        "Button did not emit one fresh payload for every active state vector.",
      );
      assertCondition(
        changeVectors.length === 14 && pressVectors.length === 9,
        "FORM_FEEDBACK_INTERACTION_MATRIX_DRIFT",
        "The executed interaction matrix changed.",
      );
      return Object.freeze({
        textFieldChangePayload: Object.freeze({
          vectors: changeVectors.length,
          sha256: sha256(Buffer.from(JSON.stringify(changeVectors))),
          callbackArguments: 1,
          domEventExposed: false,
          disabledSuppressesChange: true,
        }),
        textFieldFocusHandle: Object.freeze({
          scenarios: focusScenarios.length,
          sha256: sha256(Buffer.from(JSON.stringify(focusScenarios))),
          exposesDom: false,
          returnsValue: false,
          disabledSuppressesFocus: true,
        }),
        buttonPress: Object.freeze({
          vectors: pressVectors.length,
          sha256: sha256(Buffer.from(JSON.stringify(pressVectors))),
          callbackArguments: 1,
          domEventExposed: false,
          loadingPreservesFocus: true,
          inactiveSuppressesPress: true,
        }),
        totalVectors: changeVectors.length + pressVectors.length,
      });
    } finally {
      restoreGlobals();
      dom.window.close();
    }
  });
}

function verifyRendering(componentApi, React, renderToStaticMarkup) {
  const textSamples = PROOF_TEXT_SAMPLES;
  const states = Object.freeze([
    Object.freeze({ input: undefined, label: "omitted" }),
    Object.freeze({ input: false, label: "false" }),
    Object.freeze({ input: true, label: "true" }),
  ]);
  const placeholders = Object.freeze([
    Object.freeze({ input: undefined, label: "omitted" }),
    Object.freeze({ input: "", label: "empty" }),
    Object.freeze({ input: "name@example.test", label: "ordinary" }),
    Object.freeze({ input: textSamples[9], label: "hostile" }),
  ]);
  const variants = Object.freeze([
    Object.freeze({ input: undefined, label: "omitted", effective: "primary" }),
    Object.freeze({ input: "primary", label: "primary", effective: "primary" }),
    Object.freeze({ input: "secondary", label: "secondary", effective: "secondary" }),
    Object.freeze({ input: "danger", label: "danger", effective: "danger" }),
  ]);
  const tones = Object.freeze(["info", "success", "warning", "critical"]);

  function renderExact(component, props, expected, code, details) {
    const first = renderToStaticMarkup(React.createElement(component, props));
    const second = renderToStaticMarkup(React.createElement(component, props));
    assertCondition(
      first === second,
      "FORM_FEEDBACK_RENDERING_NONDETERMINISTIC",
      "A component produced different HTML for the same inert input.",
      details,
    );
    assertCondition(
      first === expected,
      code,
      "A component differs from its independent HTML oracle.",
      {
        ...details,
        actual: first,
        expected,
      },
    );
    return first;
  }

  const textFieldStateVectors = [];
  for (const secure of states) {
    for (const disabled of states) {
      for (const invalid of states) {
        for (const placeholder of placeholders) {
          const props = { label: "Email", value: "proof@example.test" };
          if (secure.input !== undefined) props.secure = secure.input;
          if (disabled.input !== undefined) props.disabled = disabled.input;
          if (invalid.input !== undefined) props.invalid = invalid.input;
          if (placeholder.input !== undefined) props.placeholder = placeholder.input;
          const oracle = {
            label: props.label,
            value: props.value,
            ...(placeholder.input === undefined ? {} : { placeholder: placeholder.input }),
            secure: secure.input ?? false,
            disabled: disabled.input ?? false,
            invalid: invalid.input ?? false,
          };
          const html = renderExact(
            componentApi.TextField,
            props,
            expectedTextFieldHtml(oracle),
            "FORM_FEEDBACK_TEXT_FIELD_RENDERING_DRIFT",
            {
              secure: secure.label,
              disabled: disabled.label,
              invalid: invalid.label,
              placeholder: placeholder.label,
            },
          );
          textFieldStateVectors.push(
            Object.freeze({
              secure: secure.label,
              disabled: disabled.label,
              invalid: invalid.label,
              placeholder: placeholder.label,
              htmlSha256: sha256(Buffer.from(html)),
            }),
          );
        }
      }
    }
  }

  const textFieldStringVectors = [];
  for (const field of ["label", "value", "placeholder"]) {
    for (const sample of textSamples) {
      const props = { label: "Label", value: "Value", placeholder: "Placeholder" };
      props[field] = sample;
      const html = renderExact(
        componentApi.TextField,
        props,
        expectedTextFieldHtml(props),
        "FORM_FEEDBACK_TEXT_FIELD_RENDERING_DRIFT",
        { field, sampleSha256: sha256(Buffer.from(sample)) },
      );
      textFieldStringVectors.push(
        Object.freeze({
          field,
          sampleSha256: sha256(Buffer.from(sample)),
          htmlSha256: sha256(Buffer.from(html)),
        }),
      );
    }
  }

  const buttonStateVectors = [];
  for (const variant of variants) {
    for (const loading of states) {
      for (const disabled of states) {
        const props = { label: "Continue" };
        if (variant.input !== undefined) props.variant = variant.input;
        if (loading.input !== undefined) props.loading = loading.input;
        if (disabled.input !== undefined) props.disabled = disabled.input;
        const html = renderExact(
          componentApi.Button,
          props,
          expectedButtonHtml({
            label: props.label,
            variant: variant.effective,
            loading: loading.input ?? false,
            disabled: disabled.input ?? false,
          }),
          "FORM_FEEDBACK_BUTTON_RENDERING_DRIFT",
          {
            variant: variant.label,
            loading: loading.label,
            disabled: disabled.label,
          },
        );
        buttonStateVectors.push(
          Object.freeze({
            variant: variant.label,
            loading: loading.label,
            disabled: disabled.label,
            htmlSha256: sha256(Buffer.from(html)),
          }),
        );
      }
    }
  }

  const buttonStringVectors = textSamples.map((label) => {
    const html = renderExact(
      componentApi.Button,
      { label },
      expectedButtonHtml({ label }),
      "FORM_FEEDBACK_BUTTON_RENDERING_DRIFT",
      { labelSha256: sha256(Buffer.from(label)) },
    );
    return Object.freeze({
      labelSha256: sha256(Buffer.from(label)),
      htmlSha256: sha256(Buffer.from(html)),
    });
  });

  const alertVectors = [];
  for (const tone of tones) {
    for (const text of textSamples) {
      const html = renderExact(
        componentApi.Alert,
        { text, tone },
        expectedAlertHtml({ text, tone }),
        "FORM_FEEDBACK_ALERT_RENDERING_DRIFT",
        { tone, textSha256: sha256(Buffer.from(text)) },
      );
      assertCondition(
        !/\s(?:aria-live|autofocus|tabindex)=/iu.test(html.slice(0, html.indexOf(">") + 1)),
        "FORM_FEEDBACK_ALERT_RENDERING_DRIFT",
        "Alert fabricated an explicit live, focus, or tab-stop surface.",
      );
      alertVectors.push(
        Object.freeze({
          tone,
          textSha256: sha256(Buffer.from(text)),
          htmlSha256: sha256(Buffer.from(html)),
        }),
      );
    }
  }

  const pairedFields = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(componentApi.TextField, { label: "First", value: "" }),
      React.createElement(componentApi.TextField, { label: "Second", value: "" }),
    ),
  );
  const labels = [...pairedFields.matchAll(/<label for="([^"]+)"/gu)].map((match) => match[1]);
  const controls = [...pairedFields.matchAll(/<input[^>]* id="([^"]+)"/gu)].map(
    (match) => match[1],
  );
  assertCondition(
    labels.length === 2 &&
      controls.length === 2 &&
      labels.every((value, index) => value === controls[index]) &&
      new Set(controls).size === 2,
    "FORM_FEEDBACK_TEXT_FIELD_LABEL_DRIFT",
    "Two TextFields do not retain unique visible label-to-control relationships.",
    { labels, controls },
  );

  const serverRenderedVectors =
    textFieldStateVectors.length +
    textFieldStringVectors.length +
    buttonStateVectors.length +
    buttonStringVectors.length +
    alertVectors.length;
  assertCondition(
    textFieldStateVectors.length === 108 &&
      textFieldStringVectors.length === 42 &&
      buttonStateVectors.length === 36 &&
      buttonStringVectors.length === 14 &&
      alertVectors.length === 56 &&
      serverRenderedVectors === 256,
    "FORM_FEEDBACK_RENDER_MATRIX_DRIFT",
    "The fixed M03-T06 rendering matrix changed.",
  );

  const hostile = textSamples[9];
  return Object.freeze({
    representative: Object.freeze({
      textField: expectedTextFieldHtml({
        label: "Email",
        value: "proof@example.test",
        placeholder: "name@example.test",
      }),
      button: expectedButtonHtml({ label: "Continue" }),
      alert: expectedAlertHtml({ text: "Try again.", tone: "critical" }),
      hostileInput: hostile,
      escapedAlert: expectedAlertHtml({ text: hostile, tone: "critical" }),
    }),
    labelAssociation: Object.freeze({ visible: true, unique: true, deterministic: true }),
    matrices: Object.freeze({
      textFieldState: Object.freeze({
        vectors: textFieldStateVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(textFieldStateVectors))),
      }),
      textFieldStrings: Object.freeze({
        vectors: textFieldStringVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(textFieldStringVectors))),
      }),
      buttonState: Object.freeze({
        vectors: buttonStateVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(buttonStateVectors))),
      }),
      buttonStrings: Object.freeze({
        vectors: buttonStringVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(buttonStringVectors))),
      }),
      alert: Object.freeze({
        vectors: alertVectors.length,
        sha256: sha256(Buffer.from(JSON.stringify(alertVectors))),
      }),
      serverRenderedVectors,
    }),
  });
}

async function trackedFileHashes() {
  const workspaceRealpath = await realpath(WORKSPACE_ROOT);
  return Promise.all(
    TRACKED_EVIDENCE_PATHS.map(async (relativePath) => {
      const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
      const [entry, resolved] = await Promise.all([lstat(absolutePath), realpath(absolutePath)]);
      assertCondition(
        entry.isFile() &&
          !entry.isSymbolicLink() &&
          resolved.startsWith(`${workspaceRealpath}${path.sep}`),
        "FORM_FEEDBACK_TRACKED_FILE_UNSAFE",
        `Tracked evidence path ${relativePath} must be a regular in-workspace file.`,
      );
      const bytes = await readFile(resolved);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
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
    canonicalArtifactTarget(DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH),
  ]);
  return actual === expected;
}

/**
 * Builds deterministic M03-T06 evidence from the built public component package.
 */
export async function buildReferenceCatalogWebFormFeedbackEvidence(options = undefined) {
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
    componentIndexSourcePath = DEFAULT_COMPONENT_INDEX_SOURCE_PATH,
    contractsSourcePath = DEFAULT_CONTRACTS_SOURCE_PATH,
    textFieldSourcePath = DEFAULT_TEXT_FIELD_SOURCE_PATH,
    buttonSourcePath = DEFAULT_BUTTON_SOURCE_PATH,
    alertSourcePath = DEFAULT_ALERT_SOURCE_PATH,
    packageTestPath = DEFAULT_PACKAGE_TEST_PATH,
    typeTestPath = DEFAULT_TYPE_TEST_PATH,
    rootTestPath = DEFAULT_ROOT_TEST_PATH,
    rootPackagePath = DEFAULT_ROOT_PACKAGE_PATH,
    proofDocumentPath = DEFAULT_PROOF_DOCUMENT_PATH,
    componentConsumerPath = fileURLToPath(COMPONENT_CONSUMER_URL),
    prerequisiteArtifactPath = DEFAULT_REFERENCE_CATALOG_WEB_COMPONENTS_ARTIFACT_PATH,
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
    ? await verifyFoundationPrerequisite(prerequisiteArtifactPath)
    : Object.freeze({
        task: "M03-T05",
        result: "SKIPPED",
        verifiedBy: null,
        artifactSha256: null,
      });
  assertCondition(
    overrides.length > 0 || prerequisite.result === "PASS",
    "FORM_FEEDBACK_PREREQUISITE_UNPROVEN",
    "Tracked-default M03-T06 evidence requires a passing M03-T05 prerequisite.",
  );

  const [
    officialCatalogBytes,
    packageBytes,
    packageReadmeBytes,
    componentIndexBytes,
    componentIndexSourceBytes,
    contractsSourceBytes,
    textFieldSourceBytes,
    buttonSourceBytes,
    alertSourceBytes,
    packageTestBytes,
    typeTestBytes,
    rootTestBytes,
    rootPackageBytes,
    proofDocumentBytes,
    componentConsumerBytes,
  ] = await Promise.all([
    readFile(officialCatalogPath),
    readFile(packagePath),
    readFile(packageReadmePath),
    readFile(componentIndexPath),
    readFile(componentIndexSourcePath),
    readFile(contractsSourcePath),
    readFile(textFieldSourcePath),
    readFile(buttonSourcePath),
    readFile(alertSourcePath),
    readFile(packageTestPath),
    readFile(typeTestPath),
    readFile(rootTestPath),
    readFile(rootPackagePath),
    readFile(proofDocumentPath),
    readFile(componentConsumerPath),
  ]);

  const officialCatalog = JSON.parse(officialCatalogBytes.toString("utf8"));
  const registrations = [
    componentApi.alertComponentRegistration,
    componentApi.buttonComponentRegistration,
    componentApi.stackComponentRegistration,
    componentApi.textComponentRegistration,
    componentApi.textFieldComponentRegistration,
  ].sort((left, right) => left.id.localeCompare(right.id, "en"));
  assertArrayEqual(
    registrations.map(({ id }) => id),
    EXPECTED_COMPONENT_IDS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The cumulative component capability identifiers changed.",
  );
  assertArrayEqual(
    Object.keys(componentApi).sort(),
    EXPECTED_RUNTIME_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component public runtime exports changed.",
  );

  for (const registration of registrations) {
    const officialManifest = officialCatalog.components?.[registration.id];
    assertCondition(
      officialManifest !== undefined,
      "FORM_FEEDBACK_OFFICIAL_ID_MISSING",
      `Official Catalog does not contain ${registration.id}.`,
    );
    assertCondition(
      JSON.stringify(protocolApi.canonicalizeJson(registration.manifest)) ===
        JSON.stringify(protocolApi.canonicalizeJson(officialManifest)),
      "FORM_FEEDBACK_MANIFEST_DRIFT",
      `${registration.id} differs from the frozen official Catalog manifest.`,
    );
    assertCondition(
      registration.manifest.propsSchema?.additionalProperties === false,
      "FORM_FEEDBACK_PUBLIC_SCHEMA_OPEN",
      `${registration.id} does not close its public prop object.`,
    );
    assertDeeplyFrozen(registration, registration.id);
  }

  const declarationSurface = declarationExports(componentIndexBytes.toString("utf8"));
  assertArrayContains(
    declarationSurface.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component declarations omit a required M03-T06 runtime export.",
  );
  assertArrayContains(
    declarationSurface.types,
    EXPECTED_TYPE_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component declarations omit a required M03-T06 type export.",
  );
  const indexSourceSurface = declarationExports(componentIndexSourceBytes.toString("utf8"));
  assertArrayContains(
    indexSourceSurface.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component source barrel omits a required M03-T06 runtime export.",
  );
  assertArrayContains(
    indexSourceSurface.types,
    EXPECTED_TYPE_EXPORTS,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component source barrel omits a required M03-T06 type export.",
  );
  assertArrayContains(
    declarationSurface.signature,
    REQUIRED_EXPORT_SIGNATURES,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component declarations remap a required M03-T06 export.",
  );
  assertArrayContains(
    indexSourceSurface.signature,
    REQUIRED_EXPORT_SIGNATURES,
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The component source barrel remaps a required M03-T06 export.",
  );
  assertArrayEqual(
    [...declarationSurface.signature].sort(),
    [...indexSourceSurface.signature].sort(),
    "FORM_FEEDBACK_PUBLIC_API_DRIFT",
    "The built declaration and source-barrel named export maps differ.",
  );

  const sourceProfiles = verifySourceAudit({
    "interactive-contracts.ts": contractsSourceBytes.toString("utf8"),
    "text-field.tsx": textFieldSourceBytes.toString("utf8"),
    "button.tsx": buttonSourceBytes.toString("utf8"),
    "alert.tsx": alertSourceBytes.toString("utf8"),
  });
  verifyPackageBoundary(
    JSON.parse(packageBytes.toString("utf8")),
    componentConsumerBytes.toString("utf8"),
  );
  verifyRootWiring(JSON.parse(rootPackageBytes.toString("utf8")));
  const packageReadme = packageReadmeBytes.toString("utf8");
  const proofDocument = proofDocumentBytes.toString("utf8");
  for (const required of REQUIRED_README_TEXT) {
    assertCondition(
      packageReadme.includes(required),
      "FORM_FEEDBACK_DOCUMENTATION_DRIFT",
      `Package README is missing ${JSON.stringify(required)}.`,
    );
  }
  for (const required of REQUIRED_PROOF_TEXT) {
    assertCondition(
      proofDocument.includes(required),
      "FORM_FEEDBACK_DOCUMENTATION_DRIFT",
      `M03-T06 proof document is missing ${JSON.stringify(required)}.`,
    );
  }

  const packageTests = testTitles(
    packageTestBytes.toString("utf8"),
    "packages/reference-catalog-web/test/interactive-components.test.tsx",
    "it",
  );
  const rootTests = testTitles(
    rootTestBytes.toString("utf8"),
    "tests/reference-catalog-web-form-feedback.test.mjs",
    "test",
  );
  const negativeCases = typeNegativeCases(typeTestBytes.toString("utf8"));
  assertArrayEqual(
    packageTests,
    EXPECTED_PACKAGE_TEST_TITLES,
    "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
    "The focused M03-T06 package test titles changed.",
  );
  assertArrayEqual(
    rootTests,
    EXPECTED_ROOT_TEST_TITLES,
    "FORM_FEEDBACK_TEST_INVENTORY_DRIFT",
    "The M03-T06 root evidence test titles changed.",
  );
  assertArrayEqual(
    negativeCases,
    EXPECTED_TYPE_NEGATIVE_LABELS,
    "FORM_FEEDBACK_TYPE_INVENTORY_DRIFT",
    "The M03-T06 compiler-negative case ids changed.",
  );

  const contractEvidence = verifyCatalogAndContracts({ catalogApi, componentApi, validatorApi });
  const React = PACKAGE_REQUIRE("react");
  const { renderToStaticMarkup } = PACKAGE_REQUIRE("react-dom/server");
  assertCondition(
    React.version === "19.2.8" && typeof renderToStaticMarkup === "function",
    "FORM_FEEDBACK_REACT_RUNTIME_DRIFT",
    "The evidence did not resolve the reviewed React runtime.",
  );
  const rendering = verifyRendering(componentApi, React, renderToStaticMarkup);
  const interactions = await verifyInteractions(componentApi, React);
  const totalVectors = rendering.matrices.serverRenderedVectors + interactions.totalVectors;
  assertCondition(
    interactions.totalVectors === 23 && totalVectors === 279,
    "FORM_FEEDBACK_INTERACTION_MATRIX_DRIFT",
    "The combined rendering and executed interaction matrix changed.",
  );
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
    task: "M03-T06",
    result: "PASS",
    claim: {
      summary:
        "The frozen TextField, Button, and Alert contracts resolve alongside Stack and Text to accessible Web-React components.",
      protocol: "0.1.0",
      target: "web-react",
      normativeCoverage: {
        partial: ["S-004"],
        note: "All five public component prop schemas are closed; final adapter and style-part parity remains M03-T09.",
      },
      proofMatrixStatusChanges: [],
    },
    prerequisite,
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
        interactionSet: "PASS",
        executionSet: "PASS",
      },
      source: {
        id: contractEvidence.source.id,
        ...contractEvidence.sourceValidation,
        closedSchemaDiagnostics: contractEvidence.closedSchemaDiagnostics,
        requiredDiagnostics: contractEvidence.requiredDiagnostics,
        proseOnlyDangerTone: contractEvidence.dangerDiagnostic,
      },
      eventPayloads: contractEvidence.eventPayloads,
      commandInputs: contractEvidence.commandInputs,
    },
    accessibility: {
      textField: {
        nativeControl: "input",
        visibleLabel: true,
        labelAssociation: rendering.labelAssociation,
        secureType: "password",
        nativeDisabled: true,
        ariaInvalid: true,
        domEventExposed: interactions.textFieldChangePayload.domEventExposed,
        disabledSuppressesChange: interactions.textFieldChangePayload.disabledSuppressesChange,
        focusHandleExposesDom: interactions.textFieldFocusHandle.exposesDom,
        focusHandle: interactions.textFieldFocusHandle,
        representativeHtml: rendering.representative.textField,
        stateMatrix: rendering.matrices.textFieldState,
        stringMatrix: rendering.matrices.textFieldStrings,
        changePayloadMatrix: interactions.textFieldChangePayload,
      },
      button: {
        nativeControl: "button",
        type: "button",
        loadingPreservesFocus: interactions.buttonPress.loadingPreservesFocus,
        loadingSuppressesPress: interactions.buttonPress.inactiveSuppressesPress,
        domEventExposed: interactions.buttonPress.domEventExposed,
        representativeHtml: rendering.representative.button,
        stateMatrix: rendering.matrices.buttonState,
        stringMatrix: rendering.matrices.buttonStrings,
        pressMatrix: interactions.buttonPress,
      },
      alert: {
        ordinaryRole: "status",
        criticalRole: "alert",
        focusable: false,
        explicitAriaLive: false,
        representativeHtml: rendering.representative.alert,
        hostileInput: rendering.representative.hostileInput,
        escapedHostileHtml: rendering.representative.escapedAlert,
        matrix: rendering.matrices.alert,
      },
      matrixTotals: {
        vectors: totalVectors,
        serverRendered: rendering.matrices.serverRenderedVectors,
        interactions: interactions.totalVectors,
      },
    },
    evidence: {
      provenance: {
        mode: overrides.length === 0 ? "tracked-defaults" : "injected-test",
        overrides,
      },
      sourceProfiles,
      packageTests,
      rootTests,
      typeNegativeCases: negativeCases,
      trackedFiles,
      commands: Object.keys(EXPECTED_ROOT_SCRIPTS).map(
        (kind) => `${kind}:reference-catalog-web-form-feedback`,
      ),
    },
    boundaries: [
      "Catalog props and event or command schemas remain inert manifest-derived JSON.",
      "Trusted React callbacks and the narrow TextField focus handle never enter a DESEN document.",
      "No native DOM event or input element crosses the trusted component boundary.",
      "TextField invents no error message or autocomplete policy.",
      "Button remains a native non-submit control and adds no custom keyboard activation.",
      "Alert never moves focus and relies on the implicit semantics of status and alert roles.",
      "React and DOM types remain outside the framework-neutral Catalog SDK.",
    ],
    deferred: [
      "M03-T07 token provider and controlled fixture infrastructure",
      "M03-T08 sign-in success and failure fixtures with separate host operation binding",
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

/** Verifies the tracked artifact against a fresh deterministic M03-T06 evidence build. */
export async function verifyReferenceCatalogWebFormFeedbackEvidence(options = undefined) {
  const normalizedOptions = normalizeOptions(
    options,
    ["artifactPath", "artifactBytes", ...BUILD_OPTION_NAMES],
    "Verify",
  );
  const artifactPath =
    normalizedOptions.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH;
  const artifactBytes = normalizedOptions.artifactBytes;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "FORM_FEEDBACK_OPTIONS_INVALID",
    "Verify option artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalizedOptions, "artifactBytes")) {
    assertCondition(
      artifactBytes instanceof Uint8Array &&
        !(
          typeof SharedArrayBuffer === "function" &&
          artifactBytes.buffer instanceof SharedArrayBuffer
        ),
      "FORM_FEEDBACK_OPTIONS_INVALID",
      "Verify option artifactBytes must be a non-shared byte array.",
    );
  }
  const buildOptions = Object.create(null);
  for (const name of BUILD_OPTION_NAMES) {
    if (Object.hasOwn(normalizedOptions, name)) buildOptions[name] = normalizedOptions[name];
  }
  const trackedRead = artifactBytes === undefined && (await targetsTrackedArtifact(artifactPath));
  if (trackedRead && Object.keys(buildOptions).length > 0) {
    fail(
      "FORM_FEEDBACK_NONDEFAULT_TRACKED_VERIFY",
      "The tracked M03-T06 artifact can only be verified from fixed production defaults.",
    );
  }
  const expected = await buildReferenceCatalogWebFormFeedbackEvidence(buildOptions);
  if (
    trackedRead &&
    (expected.artifact.evidence.provenance.mode !== "tracked-defaults" ||
      expected.artifact.prerequisite.result !== "PASS")
  ) {
    fail(
      "FORM_FEEDBACK_NONDEFAULT_TRACKED_VERIFY",
      "Tracked M03-T06 verification lost fixed provenance or its M03-T05 prerequisite.",
    );
  }
  const actualBytes = Buffer.from(artifactBytes ?? (await readFile(artifactPath)));
  if (!actualBytes.equals(expected.artifactBytes)) {
    fail(
      "FORM_FEEDBACK_ARTIFACT_DRIFT",
      "The tracked M03-T06 artifact differs from a fresh evidence build.",
      { expectedSha256: expected.artifactSha256, actualSha256: sha256(actualBytes) },
    );
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    prerequisiteSha256: expected.artifact.prerequisite.artifactSha256,
    provenanceMode: expected.artifact.evidence.provenance.mode,
    components: expected.artifact.components.length,
    vectors: expected.artifact.accessibility.matrixTotals.vectors,
    packageTests: expected.artifact.evidence.packageTests.length,
    rootTests: expected.artifact.evidence.rootTests.length,
    typeNegativeCases: expected.artifact.evidence.typeNegativeCases.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Writes deterministic M03-T06 evidence through the shared safe atomic writer. */
export async function writeReferenceCatalogWebFormFeedbackEvidence(options = undefined) {
  const normalizedOptions = normalizeOptions(
    options,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    normalizedOptions.artifactPath ?? DEFAULT_REFERENCE_CATALOG_WEB_FORM_FEEDBACK_ARTIFACT_PATH;
  const beforeAtomicRename = normalizedOptions.beforeAtomicRename;
  const buildOptions = normalizedOptions.buildOptions;
  assertCondition(
    typeof artifactPath === "string" && artifactPath.length > 0,
    "FORM_FEEDBACK_OPTIONS_INVALID",
    "Write option artifactPath must be a non-empty path string.",
  );
  if (Object.hasOwn(normalizedOptions, "beforeAtomicRename")) {
    assertCondition(
      typeof beforeAtomicRename === "function",
      "FORM_FEEDBACK_OPTIONS_INVALID",
      "Write option beforeAtomicRename must be a function.",
    );
  }
  if (Object.hasOwn(normalizedOptions, "buildOptions")) {
    assertCondition(
      buildOptions !== null && typeof buildOptions === "object" && !Array.isArray(buildOptions),
      "FORM_FEEDBACK_OPTIONS_INVALID",
      "Write option buildOptions must be a build-option record.",
    );
  }
  const trackedWrite = await targetsTrackedArtifact(artifactPath);
  if (
    trackedWrite &&
    (Object.hasOwn(normalizedOptions, "beforeAtomicRename") ||
      Object.hasOwn(normalizedOptions, "buildOptions"))
  ) {
    fail(
      "FORM_FEEDBACK_NONDEFAULT_TRACKED_WRITE",
      "The tracked M03-T06 artifact can only be generated from fixed production defaults.",
    );
  }
  const result = await buildReferenceCatalogWebFormFeedbackEvidence(buildOptions);
  if (
    trackedWrite &&
    (result.artifact.evidence.provenance.mode !== "tracked-defaults" ||
      result.artifact.prerequisite.result !== "PASS")
  ) {
    fail(
      "FORM_FEEDBACK_NONDEFAULT_TRACKED_WRITE",
      "Tracked M03-T06 generation lost fixed provenance or its M03-T05 prerequisite.",
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
      "FORM_FEEDBACK_ARTIFACT_WRITE_FAILED",
      "The M03-T06 evidence artifact could not be committed safely.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return result;
}
