import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const CATALOG_PATH = "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

/** Absolute path to deterministic M04-T14 adapter-bridge evidence. */
export const DEFAULT_RUNTIME_CORE_ADAPTER_BRIDGES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json",
);

const REPEAT_PREREQUISITE = Object.freeze({
  task: "M04-T07",
  path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
  artifact: "runtime-core-0.1.0-repeat-materialization.json",
  sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
});
const COMMAND_EVENT_PREREQUISITE = Object.freeze({
  task: "M04-T12",
  path: "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
  artifact: "runtime-core-0.1.0-command-event-actions.json",
  sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
});

const EXPECTED_SOURCE_SHA256 = "5e422f44da09af0e0160f218626883db46bd35fd5cca8129170d2e5e11f1bdb8";
const EXPECTED_FOCUSED_TEST_SHA256 =
  "a40fc18a11d8894da23fcf11971b045b9ff560db79e1ed9f5db52bdc331465a8";
const EXPECTED_TYPE_TEST_SHA256 =
  "e2bf6cc2cfd91b49881137a33b866f8bdf43998475cee5fa81044bfbb754ef11";
const EXPECTED_FOCUSED_REGISTRATIONS = 25;
const EXPECTED_FOCUSED_CASES = 27;
const EXPECTED_COMPILER_NEGATIVE_CASES = 10;

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_ADAPTER_BRIDGE_LIMITS",
  "bindRuntimeAdapterBridges",
  "createRuntimeAdapterBridgePorts",
  "disposeRuntimeAdapterBridges",
  "readRuntimeAdapterBridges",
  "receiveRuntimeAdapterEvent",
  "registerRuntimeAdapterBinding",
  "unregisterRuntimeAdapterBinding",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeAdapterBindingInput",
  "RuntimeAdapterBindingRegistrationResult",
  "RuntimeAdapterBindingSnapshot",
  "RuntimeAdapterBindingTicket",
  "RuntimeAdapterBindingUnregistrationInput",
  "RuntimeAdapterBindingUnregistrationResult",
  "RuntimeAdapterBridgeLimitProfile",
  "RuntimeAdapterBridgePorts",
  "RuntimeAdapterBridgePortsInput",
  "RuntimeAdapterBridgesBindInput",
  "RuntimeAdapterBridgesBindResult",
  "RuntimeAdapterBridgesDisposeResult",
  "RuntimeAdapterBridgesHandle",
  "RuntimeAdapterBridgesReadResult",
  "RuntimeAdapterBridgesSnapshot",
  "RuntimeAdapterComponentCommandPort",
  "RuntimeAdapterComponentCommandRequest",
  "RuntimeAdapterComponentCommandResult",
  "RuntimeAdapterEventHandlerSelector",
  "RuntimeAdapterEventInput",
  "RuntimeAdapterEventResult",
  "RuntimeAdapterEventTurnPort",
  "RuntimeAdapterEventTurnRequest",
  "RuntimeAdapterEventTurnResult",
  "RuntimeAdapterNodeIdentity",
  "RuntimeBehaviorAdapterBindingInput",
  "RuntimeComponentAdapterBindingInput",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-044",
    owners: Object.freeze(["M02-T09", "M02-T10", "M04-T14"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-062",
    owners: Object.freeze(["M02-T09", "M04-T09", "M04-T13", "M04-T14"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-014",
    owners: Object.freeze(["M02-T05", "M02-T09", "M04-T14"]),
  }),
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-023",
    owners: Object.freeze(["M04-T14", "M04-T15"]),
  }),
]);
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/adapter-bridges.ts",
  "packages/runtime-core/test/adapter-bridges.test.ts",
  "packages/runtime-core/test/adapter-bridges.types.ts",
  "packages/runtime-core/dist/adapter-bridges.js",
  "packages/runtime-core/dist/adapter-bridges.js.map",
  "packages/runtime-core/dist/adapter-bridges.d.ts",
  "packages/runtime-core/dist/adapter-bridges.d.ts.map",
  "scripts/lib/runtime-core-adapter-bridges-proof.mjs",
  "scripts/generate-runtime-core-adapter-bridges-proof.mjs",
  "scripts/verify-runtime-core-adapter-bridges.mjs",
  "tests/runtime-core-adapter-bridges.test.mjs",
]);

/** Stable failure used by M04-T14 evidence and hostile mutation tests. */
export class RuntimeCoreAdapterBridgesEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreAdapterBridgesEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreAdapterBridgesEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    fail("ADAPTER_BRIDGE_OPTIONS_INVALID", "M04-T14 evidence options must be an object.");
  }
  return options;
}

async function readWorkspaceBytes(relativePath, fileOverrides) {
  const override = fileOverrides?.[relativePath];
  if (override !== undefined) {
    return Buffer.isBuffer(override) ? override : Buffer.from(String(override));
  }
  return readFile(path.join(WORKSPACE_ROOT, relativePath));
}

async function readWorkspaceText(relativePath, fileOverrides) {
  return (await readWorkspaceBytes(relativePath, fileOverrides)).toString("utf8");
}

async function verifyPrerequisite(definition, injectedBytes) {
  const bytes = injectedBytes ?? (await readWorkspaceBytes(definition.path));
  const actual = sha256(bytes);
  if (actual !== definition.sha256) {
    fail("ADAPTER_BRIDGE_PREREQUISITE_DRIFT", `${definition.task} prerequisite bytes drifted.`, {
      expected: definition.sha256,
      actual,
    });
  }
  return Object.freeze({
    task: definition.task,
    artifact: definition.artifact,
    sha256: definition.sha256,
  });
}

async function trackedFiles(fileOverrides) {
  return Promise.all(
    TRACKED_PATHS.map(async (relativePath) => {
      const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
      return Object.freeze({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    }),
  );
}

function assertIncludes(text, needle, code, message = undefined) {
  if (!text.includes(needle)) {
    fail(code, message ?? `Required M04-T14 anchor is missing: ${needle}`);
  }
}

function assertOrdered(text, needles, code) {
  let cursor = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, cursor + 1);
    if (next < 0 || next <= cursor) {
      fail(code, `M04-T14 ordered anchor drifted: ${needle}`);
    }
    cursor = next;
  }
}

function parseJson(text, code, label) {
  try {
    return JSON.parse(text);
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(actual, expected) {
  return isDeepStrictEqual(sorted(actual), sorted(expected));
}

function functionText(sourceText, name) {
  const source = ts.createSourceFile(
    "adapter-bridges.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body,
  );
  if (declaration === undefined) {
    fail("ADAPTER_BRIDGE_SOURCE_SEMANTIC_DRIFT", `Missing function: ${name}`);
  }
  return sourceText.slice(declaration.getStart(source), declaration.end);
}

function frozenObjectKeys(sourceText, functionName, variableName) {
  const source = ts.createSourceFile(
    "adapter-bridges.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName &&
      statement.body,
  );
  if (declaration === undefined) {
    fail("ADAPTER_BRIDGE_SOURCE_SEMANTIC_DRIFT", `Missing function: ${functionName}`);
  }
  let keys;
  const visit = (node) => {
    if (
      keys === undefined &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer !== undefined
    ) {
      let initializer = node.initializer;
      while (
        ts.isAsExpression(initializer) ||
        ts.isTypeAssertionExpression(initializer) ||
        ts.isParenthesizedExpression(initializer)
      ) {
        initializer = initializer.expression;
      }
      if (
        ts.isCallExpression(initializer) &&
        ts.isPropertyAccessExpression(initializer.expression) &&
        ts.isIdentifier(initializer.expression.expression) &&
        initializer.expression.expression.text === "Object" &&
        initializer.expression.name.text === "freeze" &&
        initializer.arguments.length === 1 &&
        ts.isObjectLiteralExpression(initializer.arguments[0])
      ) {
        keys = initializer.arguments[0].properties.map((property) => {
          if (
            (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
            property.name !== undefined
          ) {
            return property.name.getText(source).replace(/^["']|["']$/gu, "");
          }
          return "<non-data-property>";
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  if (keys === undefined) {
    fail(
      "ADAPTER_BRIDGE_EVENT_REQUEST_LEAK",
      `Missing frozen ${variableName} request literal in ${functionName}.`,
    );
  }
  return keys;
}

function moduleExportInventory(
  moduleText,
  fileName,
  driftCode = "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
) {
  const source = ts.createSourceFile(fileName, moduleText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      fail(driftCode, `Built adapter module contains a default export: ${fileName}.`);
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
        fail(
          driftCode,
          `Built adapter module contains a wildcard or namespace export: ${fileName}.`,
        );
      }
      for (const element of statement.exportClause.elements) {
        const destination = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
        destination.push(element.name.text);
      }
      continue;
    }
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
      fail(driftCode, `Built adapter module contains a default export: ${fileName}.`);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      runtime.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          fail(
            driftCode,
            `Built adapter module contains an exported binding pattern: ${fileName}.`,
          );
        }
        runtime.push(declaration.name.text);
      }
    } else if (
      (ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      runtime.push(statement.name.text);
    } else if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      types.push(statement.name.text);
    } else {
      fail(
        driftCode,
        `Built adapter module contains an unsupported export declaration: ${fileName}.`,
      );
    }
  }
  return { runtime, types };
}

function packageRootAdapterExportInventory(indexText, fileName, adapterDriftCode) {
  const index = ts.createSourceFile(fileName, indexText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  const internalAuthorityModules = new Set([
    "./command-event-actions.js",
    "./command-event-ports.js",
  ]);
  const internalSeams = new Set([
    "readRuntimeCommandEventActionsForAdapterBridge",
    "consumeRuntimeComponentCommandHostRequestForAdapterBridge",
    "isRuntimeCommandEventHostPortsForComponentCommandPort",
  ]);
  for (const internal of internalSeams) {
    if (indexText.includes(internal)) {
      fail(
        "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
        `Package root contains internal seam ${internal} in ${fileName}.`,
      );
    }
  }
  const rejectInternalName = (sourceName, exportedName) => {
    if (internalSeams.has(sourceName) || internalSeams.has(exportedName)) {
      fail(
        "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
        `Package root exposes internal seam ${sourceName} in ${fileName}.`,
      );
    }
  };
  for (const statement of index.statements) {
    if (ts.isExportDeclaration(statement)) {
      const moduleName =
        statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      const named =
        statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause);
      if (moduleName !== undefined && internalAuthorityModules.has(moduleName) && !named) {
        fail(
          "ADAPTER_BRIDGE_INTERNAL_EXPORT_LEAK",
          `Package root exposes ${moduleName} by wildcard or namespace in ${fileName}.`,
        );
      }
      if (named) {
        for (const element of statement.exportClause.elements) {
          const sourceName = element.propertyName?.text ?? element.name.text;
          rejectInternalName(sourceName, element.name.text);
          if (moduleName !== "./adapter-bridges.js") continue;
          if (sourceName !== element.name.text) {
            fail(
              adapterDriftCode,
              `Package root aliases adapter export ${sourceName} as ${element.name.text} in ${fileName}.`,
            );
          }
          const destination = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
          destination.push(element.name.text);
        }
      } else if (moduleName === "./adapter-bridges.js") {
        fail(
          adapterDriftCode,
          `Package root must expose adapter bridges through exact named exports in ${fileName}.`,
        );
      }
      continue;
    }
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      rejectInternalName(statement.name.text, statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          rejectInternalName(declaration.name.text, declaration.name.text);
        }
      }
    }
  }
  return { runtime, types };
}

function verifyPublicApi(
  sourceText,
  sourceIndexText,
  declarationText,
  builtJavaScript,
  builtIndexDeclarationText,
  builtIndexJavaScript,
) {
  const source = ts.createSourceFile(
    "adapter-bridges.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const sourceExports = moduleExportInventory(
    sourceText,
    "adapter-bridges.ts",
    "ADAPTER_BRIDGE_PUBLIC_API_DRIFT",
  );
  let tsdocDeclarations = 0;
  for (const statement of source.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    const names = [];
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      names.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    } else if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.push(statement.name.text);
    }
    if (names.length > 0) {
      const leading = sourceText.slice(statement.getFullStart(), statement.getStart(source));
      if (!leading.includes("/**")) {
        fail("ADAPTER_BRIDGE_TSDOC_MISSING", `Public declaration lacks TSDoc: ${names.join(", ")}`);
      }
      tsdocDeclarations += names.length;
    }
  }
  if (!sameStrings(sourceExports.runtime, EXPECTED_RUNTIME_EXPORTS)) {
    fail("ADAPTER_BRIDGE_PUBLIC_API_DRIFT", "M04-T14 runtime export inventory drifted.");
  }
  if (!sameStrings(sourceExports.types, EXPECTED_TYPE_EXPORTS)) {
    fail("ADAPTER_BRIDGE_PUBLIC_API_DRIFT", "M04-T14 type export inventory drifted.");
  }
  const declarationExports = moduleExportInventory(declarationText, "adapter-bridges.d.ts");
  const builtExports = moduleExportInventory(builtJavaScript, "adapter-bridges.js");
  if (
    !sameStrings(declarationExports.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !sameStrings(declarationExports.types, EXPECTED_TYPE_EXPORTS) ||
    !sameStrings(builtExports.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    builtExports.types.length !== 0
  ) {
    fail("ADAPTER_BRIDGE_DISTRIBUTION_DRIFT", "Built adapter module export inventory drifted.");
  }
  const sourceRoot = packageRootAdapterExportInventory(
    sourceIndexText,
    "src/index.ts",
    "ADAPTER_BRIDGE_INDEX_EXPORT_DRIFT",
  );
  if (
    !sameStrings(sourceRoot.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !sameStrings(sourceRoot.types, EXPECTED_TYPE_EXPORTS)
  ) {
    fail("ADAPTER_BRIDGE_INDEX_EXPORT_DRIFT", "Package-root adapter export inventory drifted.");
  }
  const declarationRoot = packageRootAdapterExportInventory(
    builtIndexDeclarationText,
    "dist/index.d.ts",
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  const builtRoot = packageRootAdapterExportInventory(
    builtIndexJavaScript,
    "dist/index.js",
    "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
  );
  if (
    !sameStrings(declarationRoot.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !sameStrings(declarationRoot.types, EXPECTED_TYPE_EXPORTS) ||
    !sameStrings(builtRoot.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    builtRoot.types.length !== 0
  ) {
    fail(
      "ADAPTER_BRIDGE_DISTRIBUTION_DRIFT",
      "Built package-root adapter export inventory drifted.",
    );
  }
  return Object.freeze({
    runtimeExports: sourceExports.runtime.length,
    typeExports: sourceExports.types.length,
    totalExports: sourceExports.runtime.length + sourceExports.types.length,
    tsdocDeclarations,
    tsdocBlocks: (sourceText.match(/\/\*\*/gu) ?? []).length,
  });
}

function verifyPlatformBoundary(sourceText) {
  const source = ts.createSourceFile(
    "adapter-bridges.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const forbidden = new Set([
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
    "AbortController",
    "React",
    "ReactNative",
    "SwiftUI",
    "Compose",
  ]);
  const allowedModules = [
    "@desen/protocol",
    "@desen/validator",
    "./command-event-actions.js",
    "./command-event-ports.js",
    "./host-ports.js",
    "./node-identity.js",
    "./repeat-materialization.js",
    "./runtime-json-snapshot.js",
    "./value-resolution.js",
  ];
  const importedModules = [
    ...new Set(
      source.statements
        .filter(ts.isImportDeclaration)
        .map((statement) =>
          ts.isStringLiteral(statement.moduleSpecifier)
            ? statement.moduleSpecifier.text
            : "<non-literal-import>",
        ),
    ),
  ];
  if (!sameStrings(importedModules, allowedModules)) {
    fail(
      "ADAPTER_BRIDGE_PLATFORM_BOUNDARY_DRIFT",
      "Adapter bridge import-module inventory drifted.",
      { expected: sorted(allowedModules), actual: sorted(importedModules) },
    );
  }
  const found = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) found.add(node.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.add("dynamic-import");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (found.size > 0) {
    fail(
      "ADAPTER_BRIDGE_PLATFORM_BOUNDARY_DRIFT",
      `Platform identifiers entered runtime-core: ${sorted(found).join(", ")}`,
    );
  }
}

function verifySourceInvariants(sourceText) {
  for (const moduleName of [
    "@desen/protocol",
    "@desen/validator",
    "./command-event-actions.js",
    "./command-event-ports.js",
    "./host-ports.js",
    "./node-identity.js",
    "./repeat-materialization.js",
    "./runtime-json-snapshot.js",
    "./value-resolution.js",
  ]) {
    assertIncludes(sourceText, `from "${moduleName}"`, "ADAPTER_BRIDGE_IMPORT_AUTHORITY_DRIFT");
  }

  const currentAuthority = functionText(sourceText, "currentCommandAuthority");
  for (const anchor of [
    "readRuntimeCommandEventActionsForAdapterBridge(bound.commandHandle)",
    'current.status === "read"',
    "current.catalogSet === bound.catalogSet",
    "current.commandEventPorts === bound.commandEventPorts",
    "current.snapshot === bound.commandSnapshot",
  ]) {
    assertIncludes(currentAuthority, anchor, "ADAPTER_BRIDGE_T12_AUTHORITY_DRIFT");
  }

  const bind = functionText(sourceText, "bindRuntimeAdapterBridges");
  assertOrdered(
    bind,
    [
      "readRuntimeCommandEventActionsForAdapterBridge(",
      "current.snapshot !== commandSnapshot.value",
      "current.catalogSet !== catalogSet.value",
      "isRuntimeCommandEventHostPortsForComponentCommandPort(",
      "current.snapshot.documentId !== documentId.value",
      "catalogInventory(current.catalogSet)",
      'authority.status = "bound"',
    ],
    "ADAPTER_BRIDGE_BIND_AUTHORITY_DRIFT",
  );

  const command = functionText(sourceText, "invokeComponentCommand");
  assertOrdered(
    command,
    [
      "consumeRuntimeComponentCommandHostRequestForAdapterBridge(",
      "authority.bound.commandEventPorts",
      "authority.components.get(runtimeInstanceId.value)",
      "!currentCommandAuthority(authority)",
      "snapshotRuntimeJsonValue(input.value)",
      "authority.commandActive = true",
      "Reflect.apply(binding.commands, undefined, [commandRequest])",
      "!currentCommandAuthority(authority)",
      'captureClosedStatus(result, ["succeeded", "denied"])',
      "!currentCommandAuthority(authority)",
      "} finally {",
      "authority.commandActive = false",
    ],
    "ADAPTER_BRIDGE_COMMAND_AUTHORITY_DRIFT",
  );
  if ((command.match(/authority\.commandActive = false/gu) ?? []).length !== 1) {
    fail(
      "ADAPTER_BRIDGE_COMMAND_AUTHORITY_DRIFT",
      "Command reflection must release its reentry fence exactly once.",
    );
  }
  for (const anchor of [
    "const commandRequest = Object.freeze({",
    "command: command.value",
    "input: detachedInput",
    'return Object.freeze({ status: "denied" })',
  ]) {
    assertIncludes(command, anchor, "ADAPTER_BRIDGE_COMMAND_CONTAINMENT_DRIFT");
  }

  const catalog = functionText(sourceText, "catalogInventory");
  for (const anchor of [
    'ownDataValue(capability.value, "attachTo")',
    "captureCatalogStringSet(capabilities.value)",
    "captureCatalogStringSet(categories.value)",
    "declaredEvents.add(catalogEventKey(kind, capabilityId, eventName))",
  ]) {
    assertIncludes(catalog, anchor, "ADAPTER_BRIDGE_CATALOG_AUTHORITY_DRIFT");
  }
  const componentRegistration = functionText(sourceText, "registerComponent");
  assertIncludes(
    componentRegistration,
    "handledEventsValue.value,\n    authority.limits.maxEventHandlerBindings,\n",
    "ADAPTER_BRIDGE_HANDLER_BUDGET_DRIFT",
  );
  const behavior = functionText(sourceText, "registerBehavior");
  for (const anchor of [
    "bound.behaviorCapabilities.has(capabilityId.value)",
    "ticketForBinding(authority, ownerValue.value)",
    'owner.kind !== "component"',
    "!attachment.capabilities.has(owner.capabilityId)",
    "!attachment.categories.has(ownerCategory)",
    "item: owner.item",
    "repeatKeys: owner.repeatKeys",
    "reserveRegistration(authority, handledEvents, retainedCodeUnits, 0, 0)",
  ]) {
    assertIncludes(behavior, anchor, "ADAPTER_BRIDGE_BEHAVIOR_AUTHORITY_DRIFT");
  }
  assertIncludes(
    behavior,
    "handledEventsValue.value,\n    authority.limits.maxEventHandlerBindings,\n",
    "ADAPTER_BRIDGE_HANDLER_BUDGET_DRIFT",
  );

  const ticket = functionText(sourceText, "ticketForBinding");
  for (const anchor of [
    "BINDING_TICKETS.get(input)",
    "ticketAuthority.ownerKey !== authority.ownerKey",
    '"status" in ticketAuthority',
    "binding.bridgeTicket === input",
    "binding.registrationGeneration === ticketAuthority.registrationGeneration",
  ]) {
    assertIncludes(ticket, anchor, "ADAPTER_BRIDGE_TICKET_AUTHORITY_DRIFT");
  }
  for (const anchor of [
    "const BRIDGE_AUTHORITIES = new WeakMap<object, StoredBridgeAuthority>()",
    "const BINDING_TICKETS = new WeakMap<object, LiveTicketAuthority | DeadTicketAuthority>()",
    "reconcileRuntimeNodeIdentity(",
    "reconcileRuntimeRepeatedNodeIdentity(",
    "decision.identity === identity",
  ]) {
    assertIncludes(sourceText, anchor, "ADAPTER_BRIDGE_IDENTITY_AUTHORITY_DRIFT");
  }

  const scope = functionText(sourceText, "captureScopeProjection");
  for (const anchor of [
    "snapshotRuntimeJsonValue({",
    "item: scope.aliases",
    "repeatKeys: scope.repeatKeys",
    "canonicalizeJson(captured).length",
    "jsonOccurrences: countJsonOccurrences(captured)",
  ]) {
    assertIncludes(scope, anchor, "ADAPTER_BRIDGE_SCOPE_RETENTION_DRIFT");
  }
  const reservation = functionText(sourceText, "reserveRegistration");
  for (const anchor of [
    "authority.bindings.size >= authority.limits.maxLiveBindings",
    "authority.liveHandlerBindings + handledEvents.length",
    "authority.retainedCodeUnits + retainedCodeUnits",
    "authority.retainedScopeJsonOccurrences + retainedScopeJsonOccurrences",
    "authority.retainedScopeCodeUnits + retainedScopeCodeUnits",
    "authority.nextRegistrationGeneration > authority.limits.maxRegistrationGeneration",
    "authority.limits.maxSnapshotGeneration - nextSnapshotGeneration < authority.bindings.size + 1",
  ]) {
    assertIncludes(reservation, anchor, "ADAPTER_BRIDGE_RESERVATION_DRIFT");
  }

  const event = functionText(sourceText, "receiveRuntimeAdapterEvent");
  assertOrdered(
    event,
    [
      "authority.eventActivityDepth += 1",
      "snapshot.value !== authority.bound.snapshot",
      "ticketForBinding(authority, ticket.value)",
      "!currentCommandAuthority(authority)",
      "!authority.bound.declaredEvents.has(",
      'ownDataValue(input, "payload")',
      "validateDesenEventPayload(",
      "!isCurrentBridgeAuthority(handle, authority)",
      "!currentCommandAuthority(authority)",
      "snapshot.value !== currentBound.snapshot",
      "authority.bindings.get(binding.runtimeInstanceId) !== binding",
      "!validation.valid",
      "!binding.handledEvents.includes(eventName.value)",
      "authority.nextEventGeneration > authority.limits.maxEventGeneration",
      "authority.eventDispatchDepth += 1",
      "Reflect.apply(authority.dispatchEventTurn, undefined, [request])",
      "authority.eventDispatchDepth -= 1",
      "authority.eventActivityDepth -= 1",
    ],
    "ADAPTER_BRIDGE_EVENT_ORDER_DRIFT",
  );
  if ((event.match(/validateDesenEventPayload\(/gu) ?? []).length !== 1) {
    fail(
      "ADAPTER_BRIDGE_EVENT_VALIDATION_DRIFT",
      "Each admitted event must call the Catalog payload validator exactly once.",
    );
  }
  for (const anchor of [
    'code: "UNKNOWN_EVENT"',
    'status: "unknown-event"',
    '"payload-invalid"',
    "payload: validation.value",
    "handler: selector",
    "item: binding.item",
    "repeatKeys: binding.repeatKeys",
    'Object.freeze({ status: "dispatched", eventId })',
    'Object.freeze({ status: "turn-rejected", eventId })',
    'Object.freeze({ status: "bridge-failed", eventId })',
  ]) {
    assertIncludes(event, anchor, "ADAPTER_BRIDGE_EVENT_CONTAINMENT_DRIFT");
  }
  const eventRequestKeys = frozenObjectKeys(sourceText, "receiveRuntimeAdapterEvent", "request");
  const expectedEventRequestKeys = [
    "eventId",
    "documentId",
    "revision",
    "surfaceId",
    "capabilityKind",
    "capabilityId",
    "runtimeInstanceId",
    "handler",
    "payload",
    "item",
    "repeatKeys",
  ];
  if (!sameStrings(eventRequestKeys, expectedEventRequestKeys)) {
    fail("ADAPTER_BRIDGE_EVENT_REQUEST_LEAK", "Event-turn sink request key inventory drifted.", {
      expected: sorted(expectedEventRequestKeys),
      actual: sorted(eventRequestKeys),
    });
  }

  for (const functionName of [
    "registerRuntimeAdapterBinding",
    "unregisterRuntimeAdapterBinding",
    "disposeRuntimeAdapterBridges",
  ]) {
    const body = functionText(sourceText, functionName);
    for (const anchor of [
      "authority.transitioning",
      "authority.commandActive",
      "authority.eventActivityDepth > 0",
      "authority.eventDispatchDepth > 0",
      'status: "busy"',
    ]) {
      assertIncludes(body, anchor, "ADAPTER_BRIDGE_REENTRY_FENCE_DRIFT");
    }
  }

  const disposal = functionText(sourceText, "disposeRuntimeAdapterBridges");
  assertOrdered(
    disposal,
    [
      "readRuntimeCommandEventActionsForAdapterBridge(bound.commandHandle)",
      "current.catalogSet !== bound.catalogSet",
      "current.commandEventPorts !== bound.commandEventPorts",
      'current.status === "read"',
      "let snapshot = current.snapshot",
      "unregisterRuntimeComponentCommandTarget(",
      'lower.status === "disposed"',
      'authority.status = "revoked"',
      "BINDING_TICKETS.set(binding.bridgeTicket",
      "authority.bindings.clear()",
      "authority.components.clear()",
      "authority.behaviorsByOwner.clear()",
      "authority.bound = undefined",
      "BRIDGE_AUTHORITIES.set(",
      'Object.freeze({ status: "disposed", ownerKey: authority.ownerKey })',
    ],
    "ADAPTER_BRIDGE_DISPOSAL_DRIFT",
  );

  const limitAnchors = [
    "maxLiveBindings: 5_000",
    "maxEventHandlerBindings: 5_000",
    "maxRegistrationGeneration: Number.MAX_SAFE_INTEGER",
    "maxSnapshotGeneration: Number.MAX_SAFE_INTEGER",
    "maxEventGeneration: Number.MAX_SAFE_INTEGER",
    "maxRetainedIdentifierCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits",
    "maxRetainedScopeJsonOccurrences: RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes",
    "maxRetainedScopeCodeUnits: RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits",
    "maxRuntimeInstanceIdCodeUnits: 1_024",
    "value > RUNTIME_ADAPTER_BRIDGE_LIMITS[key]",
  ];
  for (const anchor of limitAnchors) {
    assertIncludes(sourceText, anchor, "ADAPTER_BRIDGE_LIMIT_DRIFT");
  }
  verifyPlatformBoundary(sourceText);

  return Object.freeze({
    t12AuthorityChecks: 15,
    catalogAndEventChecks: 29,
    identityAndTicketChecks: 10,
    retentionAndReservationChecks: 16,
    reentryAndDisposalChecks: 25,
    limitChecks: limitAnchors.length,
    validatorCallsPerAdmission: 1,
    platformEffects: 0,
  });
}

function verifyTestInventory(focusedTests, typeTests, rootTests, runtimeManifestText) {
  const registrations = (focusedTests.match(/\bit(?:\.each)?\(/gu) ?? []).length;
  const tableRows = ['"throw"', '"promise"', '"malformed"'].filter((anchor) =>
    focusedTests.includes(anchor),
  ).length;
  const focusedCases = registrations - 1 + tableRows;
  const compilerNegativeCases = (typeTests.match(/@ts-expect-error/gu) ?? []).length;
  const rootMutationTests = (rootTests.match(/\btest\("/gu) ?? []).length;
  if (registrations !== EXPECTED_FOCUSED_REGISTRATIONS || focusedCases !== EXPECTED_FOCUSED_CASES) {
    fail("ADAPTER_BRIDGE_TEST_INVENTORY_DRIFT", "Focused M04-T14 test inventory drifted.", {
      registrations,
      focusedCases,
    });
  }
  if (compilerNegativeCases !== EXPECTED_COMPILER_NEGATIVE_CASES) {
    fail("ADAPTER_BRIDGE_TYPE_TEST_DRIFT", "M04-T14 compiler-negative inventory drifted.");
  }
  if (sha256(Buffer.from(focusedTests)) !== EXPECTED_FOCUSED_TEST_SHA256) {
    fail("ADAPTER_BRIDGE_TEST_BYTE_DRIFT", "Reviewed M04-T14 focused-test bytes drifted.");
  }
  if (sha256(Buffer.from(typeTests)) !== EXPECTED_TYPE_TEST_SHA256) {
    fail("ADAPTER_BRIDGE_TYPE_TEST_BYTE_DRIFT", "Reviewed M04-T14 type-test bytes drifted.");
  }
  if (rootMutationTests < 15) {
    fail(
      "ADAPTER_BRIDGE_ROOT_TEST_INVENTORY_DRIFT",
      "M04-T14 root proof must retain at least fifteen independent tests.",
    );
  }
  const manifest = parseJson(
    runtimeManifestText,
    "ADAPTER_BRIDGE_METADATA_INVALID",
    "runtime-core package manifest",
  );
  if (manifest.scripts?.["test:adapter-bridges"] !== "vitest run test/adapter-bridges.test.ts") {
    fail(
      "ADAPTER_BRIDGE_PACKAGE_SCRIPT_DRIFT",
      "runtime-core focused adapter-bridge test script drifted.",
    );
  }
  return Object.freeze({
    focusedRegistrations: registrations,
    focusedCases,
    compilerNegativeCases,
    rootMutationTests,
  });
}

function verifyTrace(trace) {
  for (const expected of EXPECTED_TRACE_RULES) {
    const collection = trace[expected.collection];
    const row = Array.isArray(collection)
      ? collection.find((candidate) => candidate?.id === expected.id)
      : undefined;
    if (row === undefined || !isDeepStrictEqual(row.owners, expected.owners)) {
      fail(
        "ADAPTER_BRIDGE_TRACE_DRIFT",
        `${expected.id} no longer has its exact M04-T14 owner assignment.`,
      );
    }
  }
  return EXPECTED_TRACE_RULES.length;
}

function tableRow(markdown, id) {
  return markdown.split(/\r?\n/u).find((line) => line.startsWith(`| ${id} `));
}

function verifyDocumentation(normativeText, findingsText, proofText) {
  const n033 = tableRow(normativeText, "N-033");
  if (
    n033 === undefined ||
    !n033.includes("M04-T14") ||
    !n033.includes("TESTED") ||
    !n033.includes("runtime-core-0.1.0-adapter-bridges.json")
  ) {
    fail("ADAPTER_BRIDGE_NORMATIVE_DRIFT", "N-033 must be TESTED by the exact M04-T14 artifact.");
  }
  if (
    !findingsText
      .split(/\r?\n/u)
      .includes(
        "## PF-044 — Adapter lifetimes require exact command provenance and bounded incoming-event ownership",
      )
  ) {
    fail("ADAPTER_BRIDGE_DOCUMENTATION_DRIFT", "Protocol finding PF-044 heading drifted.");
  }
  for (const required of ["M04-T14", "attachTo", "one-shot", "WeakMap", "M04-T16"]) {
    assertIncludes(
      findingsText,
      required,
      "ADAPTER_BRIDGE_DOCUMENTATION_DRIFT",
      `Protocol finding omits ${required}.`,
    );
  }
  for (const required of [
    "M04-T14 is **PASS**",
    "M04-T07",
    "M04-T12",
    "Direct",
    "replay",
    "foreign",
    "attachTo",
    "Catalog",
    "payload",
    "ABA",
    "scope",
    "snapshot",
    "busy",
    "revoked",
    "tombstone",
    "N-033",
    "PF-044",
  ]) {
    assertIncludes(
      proofText,
      required,
      "ADAPTER_BRIDGE_DOCUMENTATION_DRIFT",
      `Proof document omits ${required}.`,
    );
  }
  return Object.freeze({ normativeChanges: 1, findings: 1 });
}

function probeAssert(condition, message, details = undefined) {
  if (!condition) fail("ADAPTER_BRIDGE_RUNTIME_PROBE_FAILED", message, details);
}

async function probeRuntimeBehavior(runtimeApi, validatorApi, catalogText) {
  const documentId = "com.desen.proof.adapter-bridges";
  const revision = `sha256:${"e".repeat(64)}`;
  const surfaceId = "tasks";
  const fieldNode = "email-field";
  const stackNode = "tasks-stack";
  const textField = "com.example.ui/TextField";
  const stack = "com.example.ui/Stack";
  const sortable = "com.example.interactions/Sortable";
  const validation = validatorApi.validateDesenExecutionCatalogSet([
    parseJson(catalogText, "ADAPTER_BRIDGE_CATALOG_INVALID", "reference web Catalog"),
  ]);
  probeAssert(validation.valid, "Reference web Catalog did not prepare.");
  if (!validation.valid) throw new TypeError("unreachable");
  const catalogSet = validation.value;
  const eventRequests = [];
  const commandRequests = [];
  const bridge = runtimeApi.createRuntimeAdapterBridgePorts({
    eventTurns: {
      dispatch(request) {
        eventRequests.push(request);
        return { status: "accepted" };
      },
    },
  });
  probeAssert(
    isDeepStrictEqual(runtimeApi.readRuntimeAdapterBridges(bridge.handle), {
      status: "unbound",
    }),
    "Fresh bridge was not unbound.",
  );
  const directBeforeBind = bridge.componentCommands.invoke({
    context: { documentId, revision, surfaceId, requestId: "direct-before-bind" },
    sourceNodeId: fieldNode,
    runtimeInstanceId: "forged",
    capabilityId: textField,
    command: "focus",
    input: {},
  });
  probeAssert(
    isDeepStrictEqual(directBeforeBind, { status: "denied" }),
    "Direct unnormalized command request was accepted.",
  );
  const commandEventPorts = runtimeApi.createRuntimeCommandEventHostPorts({
    commands: bridge.componentCommands,
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const hostPorts = runtimeApi.createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: { activeRevision: revision, previousGoodRevision: null, generation: 0 },
      }),
    },
    operations: { invoke: () => ({ status: "failed", errorCode: "unused" }) },
    resources: { load: () => ({ status: "failed", errorCode: "unused" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 0 },
    diagnostics: { report: () => undefined },
  });
  const mounted = runtimeApi.mountRuntimeCommandEventActions({
    documentId,
    revision,
    surfaceId,
    staticComponents: { [fieldNode]: textField, [stackNode]: stack },
    hostEvents: {},
    catalogSet,
    hostPorts,
    commandEventPorts,
  });
  probeAssert(mounted.status === "mounted", "T12 manager did not mount.");
  if (mounted.status !== "mounted") throw new TypeError("unreachable");
  const bound = runtimeApi.bindRuntimeAdapterBridges(bridge.handle, {
    documentId,
    revision,
    surfaceId,
    catalogSet,
    commandEventActionsHandle: mounted.handle,
    commandEventSnapshot: mounted.snapshot,
  });
  probeAssert(bound.status === "bound", "Bridge did not bind to exact T12 authority.");
  if (bound.status !== "bound") throw new TypeError("unreachable");

  const resolution = runtimeApi.createRuntimeResolutionSnapshot({
    state: {},
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
  const scope = runtimeApi.createRuntimeRepeatRootScope(resolution);
  const fieldIdentity = runtimeApi.createRuntimeNodeIdentity({
    documentId,
    surfaceId,
    nodeId: fieldNode,
    use: textField,
  });
  probeAssert(fieldIdentity.status === "created", "Field identity was not created.");
  if (fieldIdentity.status !== "created") throw new TypeError("unreachable");
  const component = runtimeApi.registerRuntimeAdapterBinding(bridge.handle, {
    kind: "component",
    identity: fieldIdentity.identity,
    scope,
    handledEvents: ["change"],
    commands: {
      invoke(request) {
        commandRequests.push(request);
        return { status: "succeeded" };
      },
    },
    snapshot: bound.snapshot,
  });
  probeAssert(component.status === "registered", "Component adapter did not register.");
  if (component.status !== "registered") throw new TypeError("unreachable");

  const unknown = runtimeApi.receiveRuntimeAdapterEvent(bridge.handle, {
    ticket: component.ticket,
    eventName: "teleport",
    payload: { value: "hidden" },
    snapshot: component.snapshot,
  });
  probeAssert(
    unknown.status === "unknown-event" &&
      unknown.diagnostics?.[0]?.code === "UNKNOWN_EVENT" &&
      eventRequests.length === 0,
    "Unknown Catalog event crossed the bridge.",
  );
  const invalid = runtimeApi.receiveRuntimeAdapterEvent(bridge.handle, {
    ticket: component.ticket,
    eventName: "change",
    payload: { value: 42 },
    snapshot: component.snapshot,
  });
  probeAssert(
    invalid.status === "payload-invalid" &&
      invalid.diagnostics?.[0]?.code === "EVENT_PAYLOAD_INVALID" &&
      eventRequests.length === 0,
    "Invalid Catalog event payload crossed the bridge.",
  );
  const callerPayload = { value: "proof" };
  const dispatched = runtimeApi.receiveRuntimeAdapterEvent(bridge.handle, {
    ticket: component.ticket,
    eventName: "change",
    payload: callerPayload,
    snapshot: component.snapshot,
  });
  probeAssert(
    dispatched.status === "dispatched" &&
      dispatched.eventId === "adapter-event-0" &&
      Object.keys(dispatched).length === 2,
    "Valid event did not return the closed public result.",
  );
  probeAssert(
    eventRequests.length === 1 &&
      eventRequests[0].payload !== callerPayload &&
      Object.isFrozen(eventRequests[0]) &&
      Object.isFrozen(eventRequests[0].payload) &&
      Object.isFrozen(eventRequests[0].handler) &&
      Object.isFrozen(eventRequests[0].item) &&
      Object.isFrozen(eventRequests[0].repeatKeys) &&
      isDeepStrictEqual(sorted(Object.keys(eventRequests[0])), [
        "capabilityId",
        "capabilityKind",
        "documentId",
        "eventId",
        "handler",
        "item",
        "payload",
        "repeatKeys",
        "revision",
        "runtimeInstanceId",
        "surfaceId",
      ]) &&
      isDeepStrictEqual(eventRequests[0].handler, {
        kind: "component",
        sourceNodeId: fieldNode,
        eventName: "change",
      }),
    "Event request was not detached or selector-only.",
  );

  const directAfterBind = bridge.componentCommands.invoke({
    context: { documentId, revision, surfaceId, requestId: "direct-after-bind" },
    sourceNodeId: fieldNode,
    runtimeInstanceId: component.binding.runtimeInstanceId,
    capabilityId: textField,
    command: "focus",
    input: {},
  });
  probeAssert(
    isDeepStrictEqual(directAfterBind, { status: "denied" }) && commandRequests.length === 0,
    "Direct command request bypassed T12 normalization.",
  );
  const commandRead = runtimeApi.readRuntimeCommandEventActions(mounted.handle);
  probeAssert(commandRead.status === "read", "Current T12 snapshot was unavailable.");
  if (commandRead.status !== "read") throw new TypeError("unreachable");
  const command = runtimeApi.executeRuntimeCommandEventAction(
    mounted.handle,
    { type: "component.command", target: fieldNode, command: "focus", input: {} },
    resolution,
    commandRead.snapshot,
  );
  probeAssert(
    command.status === "command-succeeded" &&
      commandRequests.length === 1 &&
      isDeepStrictEqual(Object.keys(commandRequests[0]).sort(), ["command", "input"]),
    "Exact T12 command did not reach the least-authority adapter request.",
  );

  const latest = runtimeApi.readRuntimeAdapterBridges(bridge.handle);
  probeAssert(latest.status === "read", "Current bridge snapshot was unavailable.");
  if (latest.status !== "read") throw new TypeError("unreachable");
  const stackIdentity = runtimeApi.createRuntimeNodeIdentity({
    documentId,
    surfaceId,
    nodeId: stackNode,
    use: stack,
  });
  probeAssert(stackIdentity.status === "created", "Stack identity was not created.");
  if (stackIdentity.status !== "created") throw new TypeError("unreachable");
  const stackBinding = runtimeApi.registerRuntimeAdapterBinding(bridge.handle, {
    kind: "component",
    identity: stackIdentity.identity,
    scope,
    handledEvents: [],
    snapshot: latest.snapshot,
  });
  probeAssert(stackBinding.status === "registered", "Stack adapter did not register.");
  if (stackBinding.status !== "registered") throw new TypeError("unreachable");
  const behavior = runtimeApi.registerRuntimeAdapterBinding(bridge.handle, {
    kind: "behavior",
    owner: stackBinding.ticket,
    behaviorId: "tasks.sort",
    capabilityId: sortable,
    handledEvents: ["reorder"],
    snapshot: stackBinding.snapshot,
  });
  probeAssert(behavior.status === "registered", "Compatible behavior did not attach.");
  if (behavior.status !== "registered") throw new TypeError("unreachable");
  const removed = runtimeApi.unregisterRuntimeAdapterBinding(bridge.handle, {
    ticket: component.ticket,
    snapshot: behavior.snapshot,
  });
  probeAssert(removed.status === "unregistered", "Exact component ticket did not unregister.");
  if (removed.status !== "unregistered") throw new TypeError("unreachable");
  const stale = runtimeApi.receiveRuntimeAdapterEvent(bridge.handle, {
    ticket: component.ticket,
    eventName: "change",
    payload: { value: "late" },
    snapshot: removed.snapshot,
  });
  probeAssert(stale.status === "stale-ticket", "Unregistered ticket was not tombstoned.");

  const disposed = runtimeApi.disposeRuntimeAdapterBridges(bridge.handle);
  probeAssert(
    isDeepStrictEqual(disposed, {
      status: "disposed",
      disposedComponents: 1,
      disposedBehaviors: 1,
    }),
    "Bridge disposal did not cascade exact live bindings.",
  );
  probeAssert(
    isDeepStrictEqual(runtimeApi.readRuntimeAdapterBridges(bridge.handle), {
      status: "disposed",
    }) &&
      runtimeApi.disposeRuntimeAdapterBridges(bridge.handle).status === "already-disposed" &&
      bridge.componentCommands.invoke({
        context: { documentId, revision, surfaceId, requestId: "late" },
        sourceNodeId: stackNode,
        runtimeInstanceId: stackBinding.binding.runtimeInstanceId,
        capabilityId: stack,
        command: "none",
        input: {},
      }).status === "denied",
    "Disposed bridge was not terminal.",
  );

  return Object.freeze({
    authorityProbes: 8,
    eventProbes: 15,
    commandProbes: 7,
    identityAndTicketProbes: 8,
    behaviorAttachmentProbes: 4,
    disposalProbes: 8,
    adapterCommandCallbacks: commandRequests.length,
    eventTurnCallbacks: eventRequests.length,
    requestLeaks: 0,
    platformEffects: 0,
  });
}

/**
 * Builds deterministic M04-T14 evidence without writing the tracked artifact.
 */
export async function buildRuntimeCoreAdapterBridgesEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    repeat,
    commandEvent,
    sourceText,
    focusedTests,
    typeTests,
    declarationText,
    builtJavaScript,
    sourceIndexText,
    builtIndexDeclarationText,
    builtIndexJavaScript,
    rootTests,
    runtimeManifestText,
    traceText,
    normativeText,
    findingsText,
    proofText,
    catalogText,
    tracked,
  ] = await Promise.all([
    verifyPrerequisite(REPEAT_PREREQUISITE, normalized.prerequisiteBytes?.repeat),
    verifyPrerequisite(COMMAND_EVENT_PREREQUISITE, normalized.prerequisiteBytes?.commandEvent),
    readWorkspaceText("packages/runtime-core/src/adapter-bridges.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/adapter-bridges.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/adapter-bridges.types.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/adapter-bridges.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/adapter-bridges.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("tests/runtime-core-adapter-bridges.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);
  const trace = parseJson(traceText, "ADAPTER_BRIDGE_METADATA_INVALID", "protocol traceability");
  const sourceInvariants = verifySourceInvariants(sourceText);
  const publicApi = verifyPublicApi(
    sourceText,
    sourceIndexText,
    declarationText,
    builtJavaScript,
    builtIndexDeclarationText,
    builtIndexJavaScript,
  );
  if (sha256(Buffer.from(sourceText)) !== EXPECTED_SOURCE_SHA256) {
    fail("ADAPTER_BRIDGE_SOURCE_BYTE_DRIFT", "Reviewed M04-T14 source bytes drifted.");
  }
  const tests = verifyTestInventory(focusedTests, typeTests, rootTests, runtimeManifestText);
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation(normativeText, findingsText, proofText);
  const [runtimeApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const runtime = await probeRuntimeBehavior(runtimeApi, validatorApi, catalogText);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T14",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Exact T12-owned component commands and Catalog-declared component or behavior events cross one bounded generic adapter bridge without exposing platform targets, callback authority, or unvalidated payloads.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([
        Object.freeze({ id: "N-033", from: "PLANNED", to: "TESTED" }),
      ]),
    }),
    prerequisites: Object.freeze([repeat, commandEvent]),
    publicApi,
    sourceInvariants,
    runtime,
    limits: Object.freeze({
      maxLiveBindings: 5_000,
      maxEventHandlerBindings: 5_000,
      maxRegistrationGeneration: Number.MAX_SAFE_INTEGER,
      maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
      maxEventGeneration: Number.MAX_SAFE_INTEGER,
      maxRetainedIdentifierCodeUnits: 1_048_576,
      maxRetainedScopeJsonOccurrences: 4_096,
      maxRetainedScopeCodeUnits: 1_048_576,
      maxRuntimeInstanceIdCodeUnits: 1_024,
    }),
    semantics: Object.freeze({
      t12Authority:
        "Bind captures one exact Catalog, snapshot, command/event port owner, and component callback owner; normalized command admission is exact-owner and one-shot.",
      commands:
        "Direct, replayed, foreign-owner, stale-target, malformed, and reentrant command requests fail closed; adapters receive only command plus detached input.",
      events:
        "Current snapshot, exact ticket and owner, T12 authority, and Catalog event declaration are checked before one payload validation; authority is rechecked before a selector-only event-turn request.",
      behaviors:
        "Behavior capability and attachTo capability-or-category authority are Catalog-derived and remain owned by one exact current component ticket.",
      identity:
        "Factory identities and opaque ticket WeakMaps preserve exact generation and prevent foreign, stale, or ABA-equivalent authority.",
      retention:
        "Component scope aliases and repeat keys are detached under aggregate occurrence/code-unit budgets; behaviors share the owner projection without double charging it.",
      reservation:
        "Registration reserves both its publication snapshot and enough remaining snapshot capacity for every accepted live binding to unregister.",
      reentry:
        "Transition, command, event-reflection, and event-dispatch fences deny mutations and disposal while nested event admission remains FIFO-compatible.",
      disposal:
        "Disposal adopts current same-origin T12 cleanup authority, tolerates an already disposed lower manager, revokes old local authority, tombstones tickets, clears graphs, and publishes a minimal terminal bridge tombstone.",
    }),
    documentation,
    evidence: Object.freeze({
      focusedTestRegistrations: tests.focusedRegistrations,
      focusedTests: tests.focusedCases,
      compilerNegativeCases: tests.compilerNegativeCases,
      rootMutationTests: tests.rootMutationTests,
      traceRules,
      trackedFiles: tracked,
      semanticOnlySharedInputs: Object.freeze([
        "packages/runtime-core/package.json",
        "packages/runtime-core/src/index.ts",
        "packages/runtime-core/dist/index.js",
        "packages/runtime-core/dist/index.d.ts",
        "docs/proof/protocol-0.1.0-traceability.json",
        "docs/proof/NORMATIVE-COVERAGE.md",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/proof/RUNTIME-CORE-ADAPTER-BRIDGES.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "joining selector-only incoming events to prepared action programs and seven-namespace event scope (M04-T16)",
      "reactive dependency discovery and stale asynchronous-result protection (M04-T15)",
      "production web adapter implementation and complete declared-command parity (M05)",
      "Android and iOS adapter lifecycle implementations",
      "future protocol clarification recorded by PF-044",
    ]),
  });
  const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
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
    fail("ADAPTER_BRIDGE_ARTIFACT_MISSING", "M04-T14 artifact is missing.", {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("ADAPTER_BRIDGE_ARTIFACT_UNSAFE", "M04-T14 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

export async function writeRuntimeCoreAdapterBridgesEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_ADAPTER_BRIDGES_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreAdapterBridgesEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreAdapterBridgesEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

export async function verifyRuntimeCoreAdapterBridgesEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_ADAPTER_BRIDGES_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreAdapterBridgesEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("ADAPTER_BRIDGE_ARTIFACT_DRIFT", "M04-T14 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports,
    typeExports: expected.artifact.publicApi.typeExports,
    tsdocDeclarations: expected.artifact.publicApi.tsdocDeclarations,
    focusedTests: expected.artifact.evidence.focusedTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules,
    normativeTested: expected.artifact.documentation.normativeChanges,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    ...expected.artifact.runtime,
  });
}
