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

/** Absolute path to deterministic M04-T15 reactive-reevaluation evidence. */
export const DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json",
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    key: "variantStyle",
    task: "M04-T05",
    path: "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
    artifact: "runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
  }),
  Object.freeze({
    key: "localState",
    task: "M04-T06",
    path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
    artifact: "runtime-core-0.1.0-local-state-identity.json",
    sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
  }),
  Object.freeze({
    key: "repeat",
    task: "M04-T07",
    path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
    artifact: "runtime-core-0.1.0-repeat-materialization.json",
    sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
  }),
  Object.freeze({
    key: "resource",
    task: "M04-T08",
    path: "docs/proof/artifacts/runtime-core-0.1.0-resource-lifecycle.json",
    artifact: "runtime-core-0.1.0-resource-lifecycle.json",
    sha256: "2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82",
  }),
  Object.freeze({
    key: "operation",
    task: "M04-T09",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
    artifact: "runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
  }),
  Object.freeze({
    key: "stateNavigation",
    task: "M04-T10",
    path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
    artifact: "runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
  }),
  Object.freeze({
    key: "operationResource",
    task: "M04-T11",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-resource-actions.json",
    artifact: "runtime-core-0.1.0-operation-resource-actions.json",
    sha256: "b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7",
  }),
  Object.freeze({
    key: "commandEvent",
    task: "M04-T12",
    path: "docs/proof/artifacts/runtime-core-0.1.0-command-event-actions.json",
    artifact: "runtime-core-0.1.0-command-event-actions.json",
    sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
  }),
  Object.freeze({
    key: "actionTurns",
    task: "M04-T13",
    path: "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
    artifact: "runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    key: "adapterBridges",
    task: "M04-T14",
    path: "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json",
    artifact: "runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
]);

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  "packages/runtime-core/src/reactive-host-ports.ts":
    "1f12c4418a914c3517470880e64da0b54569d5f0142250b318c422325080d923",
  "packages/runtime-core/src/reactive-reevaluation.ts":
    "863391b677eef1d0641b9f721be3cfe21e116af99a8764b369467d9356e7a751",
});
const EXPECTED_FOCUSED_TEST_SHA256 = Object.freeze({
  "packages/runtime-core/test/reactive-host-ports.test.ts":
    "02da7e3a2a25b8ef7d8c97d5269fddee133ba0a67e3f4e464dc6f5881ad2def8",
  "packages/runtime-core/test/reactive-reevaluation.test.ts":
    "4c8efa04741986dd6e38953e5973ca24c05341fa469f0a09bcb967186a134ba9",
});
const EXPECTED_TYPE_TEST_SHA256 =
  "14d12891db92ef26db7b05baf1d0b36bb55533f6db3d11aa12076abda239f92b";

const MODULE_EXPORTS = Object.freeze({
  "./reactive-host-ports.js": Object.freeze({
    runtime: Object.freeze(["createRuntimeReactiveHostPorts", "isRuntimeReactiveHostPorts"]),
    types: Object.freeze(["RuntimeReactiveHostPorts"]),
  }),
  "./reactive-reevaluation.js": Object.freeze({
    runtime: Object.freeze([
      "RUNTIME_REACTIVE_REEVALUATION_LIMITS",
      "disposeRuntimeReactiveReevaluation",
      "invalidateRuntimeReactiveReevaluation",
      "mountRuntimeReactiveReevaluation",
      "readRuntimeReactiveReevaluation",
    ]),
    types: Object.freeze([
      "RuntimeReactiveEvaluationOutcome",
      "RuntimeReactiveEvaluationRequest",
      "RuntimeReactiveEvaluator",
      "RuntimeReactiveInactiveReason",
      "RuntimeReactiveInvalidationInput",
      "RuntimeReactiveInvalidationReason",
      "RuntimeReactiveInvalidationResult",
      "RuntimeReactiveMaterializationContext",
      "RuntimeReactiveReevaluationDisposeResult",
      "RuntimeReactiveReevaluationHandle",
      "RuntimeReactiveReevaluationLimitProfile",
      "RuntimeReactiveReevaluationMountInput",
      "RuntimeReactiveReevaluationMountInvalidReason",
      "RuntimeReactiveReevaluationMountResult",
      "RuntimeReactiveReevaluationReadResult",
      "RuntimeReactiveReevaluationSnapshot",
    ]),
  }),
});
const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACTIVE_REEVALUATION_LIMITS",
  "createRuntimeReactiveHostPorts",
  "disposeRuntimeReactiveReevaluation",
  "invalidateRuntimeReactiveReevaluation",
  "mountRuntimeReactiveReevaluation",
  "readRuntimeReactiveReevaluation",
]);
const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactiveEvaluationOutcome",
  "RuntimeReactiveEvaluationRequest",
  "RuntimeReactiveEvaluator",
  "RuntimeReactiveHostPorts",
  "RuntimeReactiveInactiveReason",
  "RuntimeReactiveInvalidationInput",
  "RuntimeReactiveInvalidationReason",
  "RuntimeReactiveInvalidationResult",
  "RuntimeReactiveMaterializationContext",
  "RuntimeReactiveReevaluationDisposeResult",
  "RuntimeReactiveReevaluationHandle",
  "RuntimeReactiveReevaluationLimitProfile",
  "RuntimeReactiveReevaluationMountInput",
  "RuntimeReactiveReevaluationMountInvalidReason",
  "RuntimeReactiveReevaluationMountResult",
  "RuntimeReactiveReevaluationReadResult",
  "RuntimeReactiveReevaluationSnapshot",
]);
const INTERNAL_EXPORTS = Object.freeze(["isRuntimeReactiveHostPorts"]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-023",
    owners: Object.freeze(["M04-T14", "M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-046",
    owners: Object.freeze(["M04-T01", "M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-053",
    owners: Object.freeze(["M04-T04", "M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-059",
    owners: Object.freeze(["M04-T04", "M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-103",
    owners: Object.freeze(["M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-129",
    owners: Object.freeze(["M04-T15"]),
  }),
]);

const EXPECTED_ROOT_TEST_TITLES = Object.freeze([
  "accepts tracked deterministic M04-T15 reactive evidence",
  "builds byte-identical reactive evidence twice",
  "rejects stale or tampered reactive evidence",
  "rejects drift in every M04-T05 through M04-T14 prerequisite",
  "detects captured-host and receiver-independent invocation drift",
  "detects exact settlement-envelope and detachment drift",
  "detects revoked settlement-Proxy redaction drift",
  "detects pre-lifecycle stale-settlement fencing drift",
  "detects reactive-host authenticity and package-root containment drift",
  "detects revoked mount and invalidation reflection containment drift",
  "detects exact lower-authority mount drift",
  "detects complete double-sampled snapshot drift",
  "detects seven-namespace whole-surface resolution drift",
  "detects least-authority evaluator request drift",
  "detects pre-reflection and post-reflection stale checks",
  "detects dirty-bit batching and synchronous drain drift",
  "detects byte-equal publication and monotonic generation drift",
  "detects finite lower-only generation limits",
  "detects invalidation reflection, subscription, and failed-mount cleanup drift",
  "detects centralized revocation graph cleanup drift",
  "detects revocation, tombstone, and exact-once disposal drift",
  "detects source module export and TSDoc drift",
  "detects source package-root export parity drift",
  "detects generated module export parity drift",
  "detects generated package-root export parity drift",
  "detects focused runtime and compiler-negative inventory drift",
  "detects exact import allowlists and platform-boundary drift",
  "detects trace-owner drift without rewriting shared ownership",
  "detects normative, finding, and proof-document drift",
  "detects every task-owned byte boundary",
]);
const EXPECTED_FOCUSED_REGISTRATIONS = 39;
const EXPECTED_FOCUSED_CASES = 54;
const EXPECTED_COMPILER_NEGATIVE_CASES = 11;

const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/reactive-host-ports.ts",
  "packages/runtime-core/src/reactive-reevaluation.ts",
  "packages/runtime-core/test/reactive-host-ports.test.ts",
  "packages/runtime-core/test/reactive-reevaluation.test.ts",
  "packages/runtime-core/test/reactive-reevaluation.types.ts",
  "packages/runtime-core/dist/reactive-host-ports.js",
  "packages/runtime-core/dist/reactive-host-ports.js.map",
  "packages/runtime-core/dist/reactive-host-ports.d.ts",
  "packages/runtime-core/dist/reactive-host-ports.d.ts.map",
  "packages/runtime-core/dist/reactive-reevaluation.js",
  "packages/runtime-core/dist/reactive-reevaluation.js.map",
  "packages/runtime-core/dist/reactive-reevaluation.d.ts",
  "packages/runtime-core/dist/reactive-reevaluation.d.ts.map",
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/verify-runtime-core-reactive-reevaluation.mjs",
  "tests/runtime-core-reactive-reevaluation.test.mjs",
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
  "requestAnimationFrame",
  "AbortController",
  "React",
  "ReactNative",
  "SwiftUI",
  "Compose",
]);

/** Stable failure used by deterministic M04-T15 evidence and hostile mutation tests. */
export class RuntimeCoreReactiveReevaluationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreReactiveReevaluationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreReactiveReevaluationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(options) {
  if (options === undefined) return {};
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    fail("REACTIVE_OPTIONS_INVALID", "M04-T15 evidence options must be an object.");
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

async function verifyPrerequisite(definition, injectedBytes) {
  const bytes = injectedBytes ?? (await readWorkspaceBytes(definition.path));
  const actual = sha256(bytes);
  if (actual !== definition.sha256) {
    fail("REACTIVE_PREREQUISITE_DRIFT", `${definition.task} prerequisite bytes drifted.`, {
      task: definition.task,
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

function assertIncludes(text, needle, code, message = undefined) {
  if (!text.includes(needle)) {
    fail(code, message ?? `Required M04-T15 anchor is missing: ${needle}`);
  }
}

function assertOrdered(text, needles, code) {
  let cursor = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, cursor + 1);
    if (next < 0 || next <= cursor) {
      fail(code, `M04-T15 ordered anchor drifted: ${needle}`);
    }
    cursor = next;
  }
}

function functionText(sourceText, fileName, name) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body,
  );
  if (declaration === undefined) {
    fail("REACTIVE_SOURCE_SEMANTIC_DRIFT", `Missing function ${name} in ${fileName}.`);
  }
  return sourceText.slice(declaration.getStart(source), declaration.end);
}

function moduleExportInventory(moduleText, fileName, driftCode) {
  const source = ts.createSourceFile(fileName, moduleText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      fail(driftCode, `Default export entered ${fileName}.`);
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
        fail(driftCode, `Wildcard or namespace export entered ${fileName}.`);
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
      fail(driftCode, `Default export entered ${fileName}.`);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      runtime.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          fail(driftCode, `Exported binding pattern entered ${fileName}.`);
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
      fail(driftCode, `Unsupported export declaration entered ${fileName}.`);
    }
  }
  return Object.freeze({ runtime, types });
}

function taskRootExportInventory(indexText, fileName, driftCode) {
  const source = ts.createSourceFile(fileName, indexText, ts.ScriptTarget.Latest, true);
  const runtime = [];
  const types = [];
  const taskNames = new Set([
    ...PUBLIC_RUNTIME_EXPORTS,
    ...PUBLIC_TYPE_EXPORTS,
    ...INTERNAL_EXPORTS,
  ]);

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement)) {
      const exported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (!exported) continue;
      const names = [];
      if (
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isTypeAliasDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name !== undefined
      ) {
        names.push(statement.name.text);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
        }
      }
      if (names.some((name) => taskNames.has(name))) {
        fail(driftCode, `M04-T15 export was declared from an unowned root binding in ${fileName}.`);
      }
      continue;
    }

    const moduleName =
      statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
    const isTaskModule = moduleName !== undefined && moduleName in MODULE_EXPORTS;
    if (
      isTaskModule &&
      (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause))
    ) {
      fail(driftCode, `M04-T15 root export must be exact named exports in ${fileName}.`);
    }
    if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) {
      continue;
    }
    for (const element of statement.exportClause.elements) {
      const sourceName = element.propertyName?.text ?? element.name.text;
      const exportedName = element.name.text;
      if (taskNames.has(exportedName) || taskNames.has(sourceName)) {
        if (!isTaskModule || sourceName !== exportedName) {
          fail(driftCode, `M04-T15 root export alias or origin drifted in ${fileName}.`);
        }
      }
      if (!isTaskModule) continue;
      if (sourceName !== exportedName) {
        fail(driftCode, `M04-T15 root export alias entered ${fileName}.`);
      }
      const destination = statement.isTypeOnly || element.isTypeOnly ? types : runtime;
      destination.push(exportedName);
    }
  }
  if (
    runtime.some((name) => INTERNAL_EXPORTS.includes(name)) ||
    types.some((name) => INTERNAL_EXPORTS.includes(name))
  ) {
    fail(
      "REACTIVE_INTERNAL_EXPORT_LEAK",
      `Private reactive authenticator leaked from ${fileName}.`,
    );
  }
  return Object.freeze({ runtime, types });
}

function verifyModuleTsdoc(sourceText, fileName) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  let declarations = 0;
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
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.push(statement.name.text);
    }
    if (names.length === 0) continue;
    const leading = sourceText.slice(statement.getFullStart(), statement.getStart(source));
    if (!leading.includes("/**")) {
      fail("REACTIVE_TSDOC_MISSING", `Public declaration lacks TSDoc: ${names.join(", ")}.`);
    }
    declarations += names.length;
  }
  return declarations;
}

function verifyPublicApi(inputs) {
  const hostSource = moduleExportInventory(
    inputs.hostSource,
    "reactive-host-ports.ts",
    "REACTIVE_PUBLIC_API_DRIFT",
  );
  const reevaluationSource = moduleExportInventory(
    inputs.reevaluationSource,
    "reactive-reevaluation.ts",
    "REACTIVE_PUBLIC_API_DRIFT",
  );
  if (
    !sameStrings(hostSource.runtime, MODULE_EXPORTS["./reactive-host-ports.js"].runtime) ||
    !sameStrings(hostSource.types, MODULE_EXPORTS["./reactive-host-ports.js"].types) ||
    !sameStrings(
      reevaluationSource.runtime,
      MODULE_EXPORTS["./reactive-reevaluation.js"].runtime,
    ) ||
    !sameStrings(reevaluationSource.types, MODULE_EXPORTS["./reactive-reevaluation.js"].types)
  ) {
    fail("REACTIVE_PUBLIC_API_DRIFT", "M04-T15 source-module export inventory drifted.");
  }

  for (const [moduleName, expected] of Object.entries(MODULE_EXPORTS)) {
    const key = moduleName === "./reactive-host-ports.js" ? "host" : "reevaluation";
    const declaration = moduleExportInventory(
      inputs[`${key}Declaration`],
      `${key}.d.ts`,
      "REACTIVE_DISTRIBUTION_DRIFT",
    );
    const javascript = moduleExportInventory(
      inputs[`${key}JavaScript`],
      `${key}.js`,
      "REACTIVE_DISTRIBUTION_DRIFT",
    );
    if (
      !sameStrings(declaration.runtime, expected.runtime) ||
      !sameStrings(declaration.types, expected.types) ||
      !sameStrings(javascript.runtime, expected.runtime) ||
      javascript.types.length !== 0
    ) {
      fail("REACTIVE_DISTRIBUTION_DRIFT", `Generated ${moduleName} export inventory drifted.`);
    }
  }

  for (const [text, fileName, code] of [
    [inputs.sourceIndex, "src/index.ts", "REACTIVE_INDEX_EXPORT_DRIFT"],
    [inputs.builtIndexDeclaration, "dist/index.d.ts", "REACTIVE_DISTRIBUTION_DRIFT"],
    [inputs.builtIndexJavaScript, "dist/index.js", "REACTIVE_DISTRIBUTION_DRIFT"],
  ]) {
    const root = taskRootExportInventory(text, fileName, code);
    const expectedTypes = fileName === "dist/index.js" ? [] : PUBLIC_TYPE_EXPORTS;
    if (
      !sameStrings(root.runtime, PUBLIC_RUNTIME_EXPORTS) ||
      !sameStrings(root.types, expectedTypes)
    ) {
      fail(code, `Package-root M04-T15 export inventory drifted in ${fileName}.`, {
        expectedRuntime: sorted(PUBLIC_RUNTIME_EXPORTS),
        actualRuntime: sorted(root.runtime),
        expectedTypes: sorted(expectedTypes),
        actualTypes: sorted(root.types),
      });
    }
  }

  const tsdocDeclarations =
    verifyModuleTsdoc(inputs.hostSource, "reactive-host-ports.ts") +
    verifyModuleTsdoc(inputs.reevaluationSource, "reactive-reevaluation.ts");
  if (tsdocDeclarations !== 24) {
    fail("REACTIVE_TSDOC_MISSING", "M04-T15 exported declaration count drifted.", {
      expected: 24,
      actual: tsdocDeclarations,
    });
  }
  return Object.freeze({
    runtimeExports: PUBLIC_RUNTIME_EXPORTS.length,
    typeExports: PUBLIC_TYPE_EXPORTS.length,
    totalExports: PUBLIC_RUNTIME_EXPORTS.length + PUBLIC_TYPE_EXPORTS.length,
    moduleExports: 24,
    tsdocDeclarations,
  });
}

function verifyPlatformBoundary(sourceText, fileName, allowedModules) {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
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
    fail("REACTIVE_PLATFORM_BOUNDARY_DRIFT", `${fileName} import allowlist drifted.`, {
      expected: sorted(allowedModules),
      actual: sorted(importedModules),
    });
  }

  const forbidden = new Set(FORBIDDEN_RUNTIME_IDENTIFIERS);
  const localTypeParameters = new Set();
  const collectTypeParameters = (node) => {
    if (ts.isTypeParameterDeclaration(node)) localTypeParameters.add(node.name.text);
    ts.forEachChild(node, collectTypeParameters);
  };
  collectTypeParameters(source);
  const found = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && forbidden.has(node.text) && !localTypeParameters.has(node.text)) {
      found.add(node.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.add("dynamic-import");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (found.size > 0) {
    fail(
      "REACTIVE_PLATFORM_BOUNDARY_DRIFT",
      `Platform identifiers entered ${fileName}: ${sorted(found).join(", ")}.`,
    );
  }
  return Object.freeze({ imports: importedModules.length, platformEffects: 0 });
}

function verifyHostSourceInvariants(sourceText) {
  const captured = functionText(
    sourceText,
    "reactive-host-ports.ts",
    "createRuntimeReactiveHostPorts",
  );
  assertOrdered(
    captured,
    [
      "createRuntimeHostPorts(input)",
      "const invoke = captured.operations.invoke",
      "const load = captured.resources.load",
      "sanitizedSettlement(invoke, request)",
      "sanitizedSettlement(load, request)",
      "navigation: captured.navigation",
      "storage: captured.storage",
      "tokens: captured.tokens",
      "context: captured.context",
      "environment: captured.environment",
      "clock: captured.clock",
      "diagnostics: captured.diagnostics",
      "REACTIVE_HOST_PORTS.add(reactive)",
    ],
    "REACTIVE_HOST_CAPTURE_DRIFT",
  );

  const settlement = functionText(sourceText, "reactive-host-ports.ts", "sanitizedSettlement");
  assertOrdered(
    settlement,
    [
      "Reflect.apply(callback, undefined, [request])",
      "return Promise.resolve(candidate).then(",
      "(settlement) => {",
      "try {",
      "sanitizeSettlement(settlement)",
      "} catch {",
      "Promise.reject()",
    ],
    "REACTIVE_HOST_SETTLEMENT_FENCE_DRIFT",
  );
  const hostRecord = functionText(sourceText, "reactive-host-ports.ts", "isPlainRecord");
  assertOrdered(
    hostRecord,
    [
      'typeof value !== "object"',
      "try {",
      "Array.isArray(value)",
      "Object.getPrototypeOf(value)",
      "} catch {",
      "return false",
    ],
    "REACTIVE_HOST_REFLECTION_CONTAINMENT_DRIFT",
  );
  const sanitize = functionText(sourceText, "reactive-host-ports.ts", "sanitizeSettlement");
  for (const anchor of [
    "isPlainRecord(candidate)",
    'ownDataValue(candidate, "status")',
    'status.value === "denied"',
    'hasExactOwnKeys(candidate, ["status"])',
    'status.value === "failed"',
    'hasExactOwnKeys(candidate, ["status", "errorCode"])',
    "snapshotRuntimeJsonValue(errorCode.value)",
    'status.value === "succeeded"',
    'hasExactOwnKeys(candidate, ["status", "value"])',
    "snapshotRuntimeJsonValue(value.value)",
  ]) {
    assertIncludes(sanitize, anchor, "REACTIVE_HOST_ENVELOPE_DRIFT");
  }
  for (const anchor of [
    "const REACTIVE_HOST_PORTS = new WeakSet<object>()",
    "REACTIVE_HOST_PORTS.has(input)",
    "createRuntimeHostPorts",
    "snapshotRuntimeJsonValue",
  ]) {
    assertIncludes(sourceText, anchor, "REACTIVE_HOST_AUTHORITY_DRIFT");
  }
  const platform = verifyPlatformBoundary(sourceText, "reactive-host-ports.ts", [
    "./host-ports.js",
    "./runtime-json-snapshot.js",
  ]);
  return Object.freeze({
    captureChecks: 13,
    settlementFenceChecks: 7,
    revokedReflectionChecks: 6,
    envelopeChecks: 10,
    authorityChecks: 4,
    ...platform,
  });
}

function verifyReevaluationSourceInvariants(sourceText) {
  const inputRecord = functionText(sourceText, "reactive-reevaluation.ts", "isPlainRecord");
  assertOrdered(
    inputRecord,
    [
      'typeof value !== "object"',
      "try {",
      "Array.isArray(value)",
      "Object.getPrototypeOf(value)",
      "} catch {",
      "return false",
    ],
    "REACTIVE_REFLECTION_CONTAINMENT_DRIFT",
  );
  const mountCapture = functionText(sourceText, "reactive-reevaluation.ts", "captureMountInput");
  for (const anchor of [
    '"stateHandle"',
    '"stateSnapshot"',
    '"resourceHandle"',
    '"resourceSnapshot"',
    '"operationHandle"',
    '"operationSnapshot"',
    "isRuntimeReactiveHostPorts(values.hostPorts)",
    "captureLimits(values.limits)",
  ]) {
    assertIncludes(mountCapture, anchor, "REACTIVE_MOUNT_AUTHORITY_DRIFT");
  }
  const initial = functionText(
    sourceText,
    "reactive-reevaluation.ts",
    "initialAuthoritiesAreCurrent",
  );
  for (const anchor of [
    "readRuntimeSurfaceState(input.stateHandle)",
    "readRuntimeSurfaceResources(input.resourceHandle)",
    "readRuntimeSurfaceOperations(input.operationHandle)",
    "state.snapshot === input.stateSnapshot",
    "resources.snapshot === input.resourceSnapshot",
    "operations.snapshot === input.operationSnapshot",
    "resources.snapshot.documentId === input.documentId",
    "operations.snapshot.revision === input.revision",
  ]) {
    assertIncludes(initial, anchor, "REACTIVE_MOUNT_AUTHORITY_DRIFT");
  }

  const resolution = functionText(sourceText, "reactive-reevaluation.ts", "captureResolution");
  assertOrdered(
    resolution,
    [
      "currentLowerSnapshots(authority)",
      "readHostObject(hostPorts.context.getSnapshot)",
      "readHostObject(hostPorts.environment.getSnapshot)",
      "createRuntimeResolutionSnapshot({",
      "state: lower.state.values",
      "context: context.value",
      "resource: lower.resources.lifecycles",
      "operation: lower.operations.lifecycles",
      "event: UNAVAILABLE_EVENT",
      "item: EMPTY_OBJECT",
      "env: environment.value",
      "currentLowerSnapshots(authority)",
      "readHostObject(hostPorts.context.getSnapshot)",
      "readHostObject(hostPorts.environment.getSnapshot)",
      "confirmedLower.state !== lower.state",
      "confirmedContext?.canonical !== context.canonical",
      "confirmedEnvironment?.canonical !== environment.canonical",
    ],
    "REACTIVE_CONSISTENT_SNAPSHOT_DRIFT",
  );
  const lower = functionText(sourceText, "reactive-reevaluation.ts", "currentLowerSnapshots");
  for (const anchor of [
    "monotonicSnapshot(previousState, state.snapshot)",
    "monotonicSnapshot(previousResources, resources.snapshot)",
    "monotonicSnapshot(previousOperations, operations.snapshot)",
    "resources.snapshot.documentId !== authority.documentId",
    "operations.snapshot.surfaceId !== authority.surfaceId",
  ]) {
    assertIncludes(lower, anchor, "REACTIVE_LOWER_GENERATION_DRIFT");
  }

  const evaluate = functionText(sourceText, "reactive-reevaluation.ts", "evaluateCurrent");
  assertOrdered(
    evaluate,
    [
      "nextEvaluation(authority)",
      "const capturedEpoch = authority.invalidationGeneration",
      "captureResolution(authority)",
      "authority.invalidationGeneration !== capturedEpoch",
      "const materializationContext = Object.freeze({",
      "requestContext",
      "tokens: hostPorts.tokens",
      "const request = Object.freeze({",
      "resolutionSnapshot: captured.resolutionSnapshot",
      "Reflect.apply(evaluator, undefined, [request])",
      "!resolutionRemainsCurrent(authority, captured, capturedEpoch)",
      "snapshotRuntimeJsonValue(raw)",
      "!resolutionRemainsCurrent(authority, captured, capturedEpoch)",
      "publishOutcome(authority, id, outcome)",
    ],
    "REACTIVE_STALE_CANDIDATE_DRIFT",
  );
  if (
    (evaluate.match(/!resolutionRemainsCurrent\(authority, captured, capturedEpoch\)/gu) ?? [])
      .length !== 2
  ) {
    fail(
      "REACTIVE_STALE_CANDIDATE_DRIFT",
      "Evaluator candidates require exactly two complete current-resolution checks.",
    );
  }
  const remainsCurrent = functionText(
    sourceText,
    "reactive-reevaluation.ts",
    "resolutionRemainsCurrent",
  );
  assertOrdered(
    remainsCurrent,
    [
      'authority.status !== "live"',
      "authority.dirty",
      "authority.invalidationGeneration !== invalidationGeneration",
      "authenticateResolution(authority, captured)",
      'authority.status === "live"',
      "!authority.dirty",
      "authority.invalidationGeneration === invalidationGeneration",
    ],
    "REACTIVE_POST_AUTHORITY_RECHECK_DRIFT",
  );
  assertIncludes(remainsCurrent, "authenticated &&", "REACTIVE_POST_AUTHORITY_RECHECK_DRIFT");
  for (const forbiddenRequestAnchor of [
    "stateHandle:",
    "resourceHandle:",
    "operationHandle:",
    "hostPorts:",
    "contextUnsubscribe:",
    "environmentUnsubscribe:",
  ]) {
    const requestStart = evaluate.indexOf("const request = Object.freeze({");
    const requestEnd = evaluate.indexOf("});", requestStart);
    const requestText = evaluate.slice(requestStart, requestEnd);
    if (requestText.includes(forbiddenRequestAnchor)) {
      fail(
        "REACTIVE_EVALUATOR_AUTHORITY_LEAK",
        `Evaluator request leaks ${forbiddenRequestAnchor}.`,
      );
    }
  }

  const drain = functionText(sourceText, "reactive-reevaluation.ts", "drain");
  assertOrdered(
    drain,
    [
      "if (authority.draining) return",
      "authority.draining = true",
      "while (authority.status ===",
      "transitions >= authority.limits.maxSynchronousTransitions",
      'inactiveOutcome("transition-limit")',
      "evaluateCurrent(authority)",
      "authority.draining = false",
    ],
    "REACTIVE_BATCHING_DRIFT",
  );
  const markDirty = functionText(sourceText, "reactive-reevaluation.ts", "markDirty");
  for (const anchor of [
    "authority.invalidationGeneration += 1",
    "authority.dirty = true",
    "!authority.draining",
    "drain(authority)",
  ]) {
    assertIncludes(markDirty, anchor, "REACTIVE_BATCHING_DRIFT");
  }
  const publish = functionText(sourceText, "reactive-reevaluation.ts", "publishOutcome");
  assertOrdered(
    publish,
    [
      "const key = outcomeKey(outcome)",
      "authority.outcomeKey === key",
      "authority.snapshot === undefined && authority.limits.maxSnapshotGeneration === 0",
      'inactiveOutcome("snapshot-limit")',
      "authority.snapshot.generation + 1",
      "generation >= authority.limits.maxSnapshotGeneration",
      "generation: authority.limits.maxSnapshotGeneration",
      "authority.outcomeKey = key",
    ],
    "REACTIVE_PUBLICATION_DRIFT",
  );

  const mount = functionText(
    sourceText,
    "reactive-reevaluation.ts",
    "mountRuntimeReactiveReevaluation",
  );
  assertOrdered(
    mount,
    [
      "captureMountInput(input)",
      "initialAuthoritiesAreCurrent(captured)",
      'status: "mounting"',
      "REACTIVE_AUTHORITIES.set(handle, authority)",
      "authority.contextUnsubscribe = subscribe(",
      "authority.contextUnsubscribe === undefined",
      "revokeAuthority(authority)",
      "REACTIVE_AUTHORITIES.delete(handle)",
      "authority.environmentUnsubscribe = subscribe(",
      "authority.environmentUnsubscribe === undefined",
      "const subscriptions = revokeAuthority(authority)",
      "REACTIVE_AUTHORITIES.delete(handle)",
      "callUnsubscribe(subscriptions.context)",
      'authority.status = "live"',
      "drain(authority)",
    ],
    "REACTIVE_SUBSCRIPTION_DRIFT",
  );
  if ((mount.match(/revokeAuthority\(authority\)/gu) ?? []).length !== 2) {
    fail(
      "REACTIVE_SUBSCRIPTION_DRIFT",
      "Failed mount paths must cross exactly two centralized revocation call sites.",
    );
  }
  const invalidation = functionText(
    sourceText,
    "reactive-reevaluation.ts",
    "invalidateRuntimeReactiveReevaluation",
  );
  assertOrdered(
    invalidation,
    [
      "const admissionSnapshot = entry.snapshot",
      '!hasExactKeys(input, ["reason", "snapshot"])',
      'ownDataValue(input, "snapshot")',
      'ownDataValue(input, "reason")',
      'typeof reason.value !== "string"',
      ".includes(reason.value)",
      "const currentEntry = REACTIVE_AUTHORITIES.get(handle)",
      "currentEntry !== entry",
      'entry.status === "faulted"',
      "admissionSnapshot === undefined",
      "entry.snapshot !== admissionSnapshot",
      "requestedSnapshot.value !== admissionSnapshot",
      "const before = admissionSnapshot",
      "markDirty(entry)",
      "REACTIVE_AUTHORITIES.get(handle) !== entry",
      "entry.snapshot === undefined",
      "const after = entry.snapshot",
    ],
    "REACTIVE_INVALIDATION_AUTHORITY_DRIFT",
  );
  const revocation = functionText(sourceText, "reactive-reevaluation.ts", "revokeAuthority");
  assertOrdered(
    revocation,
    [
      'authority.status = "revoked"',
      "authority.dirty = false",
      "context: authority.contextUnsubscribe",
      "environment: authority.environmentUnsubscribe",
      "authority.contextUnsubscribe = undefined",
      "authority.environmentUnsubscribe = undefined",
      "authority.evaluator = undefined",
      "authority.hostPorts = undefined",
      "authority.stateHandle = undefined",
      "authority.stateSnapshot = undefined",
      "authority.resourceHandle = undefined",
      "authority.resourceSnapshot = undefined",
      "authority.operationHandle = undefined",
      "authority.operationSnapshot = undefined",
      "authority.snapshot = undefined",
      "authority.outcomeKey = undefined",
      "return subscriptions",
    ],
    "REACTIVE_REVOCATION_DRIFT",
  );
  const dispose = functionText(
    sourceText,
    "reactive-reevaluation.ts",
    "disposeRuntimeReactiveReevaluation",
  );
  assertOrdered(
    dispose,
    [
      "const subscriptions = revokeAuthority(entry)",
      'REACTIVE_AUTHORITIES.set(handle, Object.freeze({ status: "disposed" }))',
      "callUnsubscribe(subscriptions.context)",
      "callUnsubscribe(subscriptions.environment)",
    ],
    "REACTIVE_DISPOSAL_DRIFT",
  );
  if ((dispose.match(/callUnsubscribe\(/gu) ?? []).length !== 2) {
    fail(
      "REACTIVE_DISPOSAL_DRIFT",
      "Terminal disposal must invoke exactly two captured unsubscribe callbacks.",
    );
  }

  for (const anchor of [
    "maxSynchronousTransitions: 64",
    "maxEvaluationGeneration: Number.MAX_SAFE_INTEGER",
    "maxSnapshotGeneration: Number.MAX_SAFE_INTEGER",
    "value <= ceiling",
    "defaults[key]",
  ]) {
    assertIncludes(sourceText, anchor, "REACTIVE_LIMIT_DRIFT");
  }
  for (const anchor of [
    "The coordinator intentionally performs whole-surface reevaluation.",
    "observable behavior and finite limits match a dependency-indexed",
    "const REACTIVE_AUTHORITIES = new WeakMap<object, ReactiveEntry>()",
    "canonicalizeJson(outcome.value)",
  ]) {
    assertIncludes(sourceText, anchor, "REACTIVE_PROFILE_DRIFT");
  }

  const platform = verifyPlatformBoundary(sourceText, "reactive-reevaluation.ts", [
    "@desen/protocol",
    "./host-ports.js",
    "./local-state.js",
    "./operation-lifecycle.js",
    "./reactive-host-ports.js",
    "./resource-lifecycle.js",
    "./runtime-json-snapshot.js",
    "./value-resolution.js",
  ]);
  return Object.freeze({
    revokedInputReflectionChecks: 6,
    mountAuthorityChecks: 16,
    consistentSnapshotChecks: 21,
    staleCandidateChecks: 22,
    evaluatorRequestLeaks: 0,
    batchingChecks: 11,
    publicationChecks: 6,
    subscriptionChecks: 13,
    invalidationAuthorityChecks: 17,
    revocationGraphChecks: 17,
    disposalChecks: 4,
    limitChecks: 5,
    wholeSurfaceProfileChecks: 4,
    ...platform,
  });
}

function rootTestTitles(rootTests) {
  return [...rootTests.matchAll(/\btest\("([^"]+)"/gu)].map((match) => match[1]);
}

function verifyTestInventory(hostTests, reevaluationTests, typeTests, rootTests, manifestText) {
  const focusedText = `${hostTests}\n${reevaluationTests}`;
  const directRegistrations = (focusedText.match(/\bit\(/gu) ?? []).length;
  const tableRegistrations = (focusedText.match(/\bit\.each/gu) ?? []).length;
  const registrations = directRegistrations + tableRegistrations;
  const hostTableRows =
    [
      '"unknown status"',
      '"extra success field"',
      '"missing success value"',
      '"non-string error code"',
      '"extra denial field"',
      '"array envelope"',
      '"class envelope"',
      '"accessor status"',
      '"symbol field"',
      '"cyclic success"',
    ].filter((anchor) => hostTests.includes(anchor)).length + 2;
  const limitTableRows = [
    '"negative"',
    '"fractional"',
    '"above default"',
    '"unsafe integer"',
    '"extra key"',
    '"array"',
  ].filter((anchor) => reevaluationTests.includes(anchor)).length;
  const cases = registrations - tableRegistrations + hostTableRows + limitTableRows;
  const compilerNegativeCases = (typeTests.match(/@ts-expect-error/gu) ?? []).length;
  const titles = rootTestTitles(rootTests);
  if (registrations !== EXPECTED_FOCUSED_REGISTRATIONS || cases !== EXPECTED_FOCUSED_CASES) {
    fail("REACTIVE_TEST_INVENTORY_DRIFT", "Focused M04-T15 test inventory drifted.", {
      registrations,
      cases,
    });
  }
  if (compilerNegativeCases !== EXPECTED_COMPILER_NEGATIVE_CASES) {
    fail("REACTIVE_TYPE_TEST_DRIFT", "M04-T15 compiler-negative inventory drifted.", {
      expected: EXPECTED_COMPILER_NEGATIVE_CASES,
      actual: compilerNegativeCases,
    });
  }
  for (const [relativePath, expected] of Object.entries(EXPECTED_FOCUSED_TEST_SHA256)) {
    const text = relativePath.includes("reactive-host-ports") ? hostTests : reevaluationTests;
    if (sha256(Buffer.from(text)) !== expected) {
      fail("REACTIVE_TEST_BYTE_DRIFT", `Reviewed focused-test bytes drifted: ${relativePath}.`);
    }
  }
  if (sha256(Buffer.from(typeTests)) !== EXPECTED_TYPE_TEST_SHA256) {
    fail("REACTIVE_TYPE_TEST_BYTE_DRIFT", "Reviewed M04-T15 type-test bytes drifted.");
  }
  if (!isDeepStrictEqual(titles, EXPECTED_ROOT_TEST_TITLES)) {
    fail("REACTIVE_ROOT_TEST_INVENTORY_DRIFT", "Root hostile-mutation inventory drifted.", {
      expected: EXPECTED_ROOT_TEST_TITLES,
      actual: titles,
    });
  }
  const manifest = parseJson(
    manifestText,
    "REACTIVE_METADATA_INVALID",
    "runtime-core package manifest",
  );
  if (
    manifest.scripts?.["test:reactive-reevaluation"] !==
    "vitest run test/reactive-host-ports.test.ts test/reactive-reevaluation.test.ts"
  ) {
    fail("REACTIVE_PACKAGE_SCRIPT_DRIFT", "Focused M04-T15 package script drifted.");
  }
  return Object.freeze({
    focusedRegistrations: registrations,
    focusedCases: cases,
    compilerNegativeCases,
    rootMutationTests: titles.length,
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
        "REACTIVE_TRACE_DRIFT",
        `${expected.id} no longer has its exact M04-T15 owner assignment.`,
      );
    }
  }
  return EXPECTED_TRACE_RULES.length;
}

function tableRow(markdown, id) {
  return markdown.split(/\r?\n/u).find((line) => line.startsWith(`| ${id} `));
}

function tableStatus(markdown, id) {
  return tableRow(markdown, id)?.split("|")[5]?.trim();
}

function verifyDocumentation(normativeText, proofMatrixText, findingsText, proofText) {
  const determinismStatus = tableStatus(normativeText, "N-003");
  if (determinismStatus !== "PLANNED" && determinismStatus !== "TESTED") {
    fail(
      "REACTIVE_NORMATIVE_DRIFT",
      "N-003 must retain its task-time PLANNED status or advance monotonically to TESTED.",
    );
  }
  for (const id of ["N-034", "N-041"]) {
    if (tableStatus(normativeText, id) !== "PLANNED") {
      fail("REACTIVE_NORMATIVE_DRIFT", `${id} must remain PLANNED at M04-T15.`);
    }
  }
  for (const id of ["P-17", "P-18"]) {
    const row = tableRow(proofMatrixText, id);
    if (row === undefined || !row.includes("PARTIAL")) {
      fail("REACTIVE_PROOF_MATRIX_DRIFT", `${id} must remain PARTIAL at M04-T15.`);
    }
  }
  const findingHeading =
    "## PF-045 — Reactive invalidation requires explicit snapshot, generation, batching, and scheduler ownership";
  if (!findingsText.split(/\r?\n/u).includes(findingHeading)) {
    fail("REACTIVE_DOCUMENTATION_DRIFT", "Protocol finding PF-045 heading drifted.");
  }
  for (const required of [
    "M04-T15",
    "whole-surface",
    "consistent snapshot",
    "stale",
    "batch",
    "scheduler",
    "M04-T16",
    "M05",
  ]) {
    assertIncludes(
      findingsText,
      required,
      "REACTIVE_DOCUMENTATION_DRIFT",
      `PF-045 omits ${required}.`,
    );
  }
  for (const required of [
    "M04-T15 is **PASS**",
    "M04-T05 through M04-T14",
    "whole-surface",
    "stale-safe",
    "Proxy",
    "undefined reason",
    "one consistent",
    "dirty bit",
    "byte-equal",
    "exactly once",
    "tombstone",
    "retained by the failed second subscription",
    "PIPE-023",
    "R-103",
    "R-129",
    "N-003",
    "N-034",
    "N-041",
    "P-17",
    "P-18",
    "PF-045",
    "M04-T16",
    "M05",
  ]) {
    assertIncludes(
      proofText,
      required,
      "REACTIVE_DOCUMENTATION_DRIFT",
      `M04-T15 proof document omits ${required}.`,
    );
  }
  return Object.freeze({
    normativeStatusChanges: 0,
    proofMatrixStatusChanges: 0,
    findings: 1,
  });
}

function probeAssert(condition, message, details = undefined) {
  if (!condition) fail("REACTIVE_RUNTIME_PROBE_FAILED", message, details);
}

async function probeRuntimeBehavior(runtimeApi, validatorApi, catalogText) {
  const documentId = "com.desen.proof.reactive";
  const revision = `sha256:${"f".repeat(64)}`;
  const surfaceId = "sign-in";
  const validation = validatorApi.validateDesenExecutionCatalogSet([
    parseJson(catalogText, "REACTIVE_CATALOG_INVALID", "reference web Catalog"),
  ]);
  probeAssert(validation.valid, "Reference web Catalog did not prepare.");
  if (!validation.valid) throw new TypeError("unreachable");

  let context = Object.freeze({ tenant: "alpha" });
  let environment = Object.freeze({ locale: "en", platform: "web" });
  const contextNotices = new Set();
  const environmentNotices = new Set();
  let contextSubscriptions = 0;
  let environmentSubscriptions = 0;
  let contextUnsubscriptions = 0;
  let environmentUnsubscriptions = 0;
  let operationReceiverWasUndefined = false;
  const hostValue = { nested: { userId: "user-1" } };
  const navigation = Object.freeze({ navigate: () => ({ status: "succeeded" }) });
  const storage = Object.freeze({
    getBundle: () => ({ status: "missing" }),
    putBundle: () => ({ status: "stored" }),
    readActivation: () => ({ status: "missing" }),
    commitActivation: () => ({
      status: "committed",
      record: {
        activeRevision: revision,
        previousGoodRevision: null,
        generation: 0,
      },
    }),
  });
  const tokens = Object.freeze({ resolve: () => ({ status: "missing" }) });
  const contextPort = Object.freeze({
    getSnapshot: () => context,
    subscribe(notice) {
      contextSubscriptions += 1;
      contextNotices.add(notice);
      return () => {
        contextUnsubscriptions += 1;
        notice();
        contextNotices.delete(notice);
      };
    },
  });
  const environmentPort = Object.freeze({
    getSnapshot: () => environment,
    subscribe(notice) {
      environmentSubscriptions += 1;
      environmentNotices.add(notice);
      return () => {
        environmentUnsubscriptions += 1;
        notice();
        environmentNotices.delete(notice);
      };
    },
  });
  const clock = Object.freeze({ now: () => 1 });
  const diagnostics = Object.freeze({ report: () => undefined });
  const rawHostPorts = {
    navigation,
    storage,
    operations: {
      invoke(request) {
        operationReceiverWasUndefined = this === undefined;
        void request;
        return { status: "succeeded", value: hostValue };
      },
    },
    resources: { load: () => ({ status: "denied" }) },
    tokens,
    context: contextPort,
    environment: environmentPort,
    clock,
    diagnostics,
  };
  const hostPorts = runtimeApi.createRuntimeReactiveHostPorts(rawHostPorts);
  probeAssert(
    hostPorts.navigation.navigate === navigation.navigate &&
      hostPorts.storage.getBundle === storage.getBundle &&
      hostPorts.storage.putBundle === storage.putBundle &&
      hostPorts.storage.readActivation === storage.readActivation &&
      hostPorts.storage.commitActivation === storage.commitActivation &&
      hostPorts.tokens.resolve === tokens.resolve &&
      hostPorts.context.getSnapshot === contextPort.getSnapshot &&
      hostPorts.context.subscribe === contextPort.subscribe &&
      hostPorts.environment.getSnapshot === environmentPort.getSnapshot &&
      hostPorts.environment.subscribe === environmentPort.subscribe &&
      hostPorts.clock.now === clock.now &&
      hostPorts.diagnostics.report === diagnostics.report,
    "Reactive host wrapper replaced a non-settlement callback.",
  );

  const operationRequest = Object.freeze({
    context: { documentId, revision, surfaceId, requestId: "host-probe" },
    capabilityId: "com.example.auth/signIn",
    invocationAlias: "signIn",
    input: {},
    effect: "network",
  });
  const settled = await hostPorts.operations.invoke(operationRequest);
  hostValue.nested.userId = "mutated";
  probeAssert(
    operationReceiverWasUndefined &&
      settled.status === "succeeded" &&
      settled.value?.nested?.userId === "user-1" &&
      Object.isFrozen(settled) &&
      Object.isFrozen(settled.value) &&
      Object.isFrozen(settled.value.nested),
    "Host settlement was not receiver-independent, detached, and recursively frozen.",
  );

  const failedHostPorts = runtimeApi.createRuntimeReactiveHostPorts({
    ...rawHostPorts,
    operations: {
      invoke: () => ({ status: "failed", errorCode: "invalidCredentials" }),
    },
  });
  const failedSettlement = await failedHostPorts.operations.invoke(operationRequest);
  probeAssert(
    isDeepStrictEqual(failedSettlement, {
      status: "failed",
      errorCode: "invalidCredentials",
    }) && Object.isFrozen(failedSettlement),
    "Declared failed settlement did not cross one exact immutable envelope.",
  );

  const revokedCandidate = Proxy.revocable({ status: "denied" }, {});
  const revokedHostPorts = runtimeApi.createRuntimeReactiveHostPorts({
    ...rawHostPorts,
    operations: {
      invoke: () => Promise.resolve(revokedCandidate.proxy),
    },
  });
  const revokedSettlement = revokedHostPorts.operations.invoke(operationRequest);
  revokedCandidate.revoke();
  let revokedSettlementReason;
  try {
    await revokedSettlement;
    revokedSettlementReason = "resolved";
  } catch (error) {
    revokedSettlementReason = error;
  }
  probeAssert(
    revokedSettlementReason === undefined,
    "Revoked settlement Proxy exposed a reflection failure reason.",
  );

  const state = runtimeApi.mountRuntimeSurfaceState({
    surfaceId,
    state: {
      count: { schema: { type: "number" }, initial: 0 },
      label: { schema: { type: "string" }, initial: "initial" },
    },
  });
  probeAssert(state.status === "mounted", "Proof state manager did not mount.");
  if (state.status !== "mounted") throw new TypeError("unreachable");
  const resources = runtimeApi.mountRuntimeSurfaceResources({
    documentId,
    revision,
    surfaceId,
    resources: {},
    catalogSet: validation.value,
    hostPorts,
  });
  probeAssert(resources.status === "mounted", "Proof resource manager did not mount.");
  if (resources.status !== "mounted") throw new TypeError("unreachable");
  const operations = runtimeApi.mountRuntimeSurfaceOperations({
    documentId,
    revision,
    surfaceId,
    aliases: {},
    catalogSet: validation.value,
    hostPorts,
  });
  probeAssert(operations.status === "mounted", "Proof operation manager did not mount.");
  if (operations.status !== "mounted") throw new TypeError("unreachable");

  let evaluatorCalls = 0;
  let armStaleReentry = false;
  let staleReentryTriggered = false;
  let evaluatorAuthorityLeaks = 0;
  const evaluator = (request) => {
    evaluatorCalls += 1;
    const keys = sorted(Object.keys(request));
    if (
      !isDeepStrictEqual(keys, [
        "documentId",
        "evaluationId",
        "materializationContext",
        "resolutionSnapshot",
        "revision",
        "surfaceId",
      ]) ||
      !isDeepStrictEqual(sorted(Object.keys(request.materializationContext)), [
        "requestContext",
        "tokens",
      ])
    ) {
      evaluatorAuthorityLeaks += 1;
    }
    if (armStaleReentry && !staleReentryTriggered) {
      staleReentryTriggered = true;
      context = Object.freeze({ tenant: "gamma" });
      for (const notice of [...contextNotices]) notice();
    }
    return {
      state: request.resolutionSnapshot.state,
      context: request.resolutionSnapshot.context,
      environment: request.resolutionSnapshot.env,
    };
  };
  const mounted = runtimeApi.mountRuntimeReactiveReevaluation({
    documentId,
    revision,
    surfaceId,
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    resourceHandle: resources.handle,
    resourceSnapshot: resources.snapshot,
    operationHandle: operations.handle,
    operationSnapshot: operations.snapshot,
    hostPorts,
    evaluator,
  });
  probeAssert(
    mounted.status === "mounted" &&
      mounted.snapshot.generation === 0 &&
      mounted.snapshot.outcome.status === "active" &&
      mounted.snapshot.outcome.value.state.count === 0 &&
      contextSubscriptions === 1 &&
      environmentSubscriptions === 1 &&
      evaluatorAuthorityLeaks === 0,
    "Reactive coordinator did not mount one least-authority consistent result.",
  );
  if (mounted.status !== "mounted") throw new TypeError("unreachable");

  const revokedMount = Proxy.revocable({}, {});
  revokedMount.revoke();
  const revokedMountResult = runtimeApi.mountRuntimeReactiveReevaluation(revokedMount.proxy);
  const revokedInvalidation = Proxy.revocable({ snapshot: mounted.snapshot, reason: "state" }, {});
  revokedInvalidation.revoke();
  const revokedInvalidationResult = runtimeApi.invalidateRuntimeReactiveReevaluation(
    mounted.handle,
    revokedInvalidation.proxy,
  );
  probeAssert(
    isDeepStrictEqual(revokedMountResult, {
      status: "invalid",
      reason: "malformed-input",
    }) &&
      isDeepStrictEqual(revokedInvalidationResult, {
        status: "rejected",
        reason: "invalid-request",
      }),
    "Revoked mount or invalidation Proxy escaped the controlled reflection boundary.",
  );

  const firstWrite = runtimeApi.writeRuntimeSurfaceState(state.handle, {
    path: "count",
    value: 1,
  });
  const secondWrite = runtimeApi.writeRuntimeSurfaceState(state.handle, {
    path: "label",
    value: "complete",
  });
  probeAssert(
    firstWrite.status === "updated" && secondWrite.status === "updated",
    "Proof state writes were not accepted.",
  );
  const batched = runtimeApi.invalidateRuntimeReactiveReevaluation(mounted.handle, {
    snapshot: mounted.snapshot,
    reason: "action-turn",
  });
  probeAssert(
    batched.status === "reevaluated" &&
      batched.snapshot.generation === 1 &&
      batched.snapshot.outcome.status === "active" &&
      batched.snapshot.outcome.value.state.count === 1 &&
      batched.snapshot.outcome.value.state.label === "complete" &&
      evaluatorCalls === 2,
    "Two writes did not cross one explicit action-turn reevaluation.",
  );
  if (batched.status !== "reevaluated") throw new TypeError("unreachable");

  context = Object.freeze({ tenant: "beta" });
  environment = Object.freeze({ locale: "tr", platform: "web" });
  for (const notice of [...contextNotices]) notice();
  const hostChanged = runtimeApi.readRuntimeReactiveReevaluation(mounted.handle);
  probeAssert(
    hostChanged.status === "read" &&
      hostChanged.snapshot.generation === 2 &&
      hostChanged.snapshot.outcome.status === "active" &&
      hostChanged.snapshot.outcome.value.context.tenant === "beta" &&
      hostChanged.snapshot.outcome.value.environment.locale === "tr",
    "One host notice did not reread complete context and environment snapshots.",
  );
  if (hostChanged.status !== "read") throw new TypeError("unreachable");

  armStaleReentry = true;
  const reentered = runtimeApi.invalidateRuntimeReactiveReevaluation(mounted.handle, {
    snapshot: hostChanged.snapshot,
    reason: "state",
  });
  probeAssert(
    reentered.status === "reevaluated" &&
      staleReentryTriggered &&
      reentered.snapshot.generation === 3 &&
      reentered.snapshot.outcome.status === "active" &&
      reentered.snapshot.outcome.value.context.tenant === "gamma" &&
      evaluatorCalls === 5,
    "Reentrant stale candidate was not discarded before newer publication.",
  );
  if (reentered.status !== "reevaluated") throw new TypeError("unreachable");

  const beforeUnchanged = reentered.snapshot;
  const unchanged = runtimeApi.invalidateRuntimeReactiveReevaluation(mounted.handle, {
    snapshot: beforeUnchanged,
    reason: "resource",
  });
  probeAssert(
    unchanged.status === "unchanged" &&
      unchanged.snapshot === beforeUnchanged &&
      unchanged.snapshot.generation === 3,
    "Byte-equal reevaluation did not retain exact observable snapshot identity.",
  );

  const failedContextNotices = new Set();
  let failedContextUnsubscriptions = 0;
  let retainedFailedEnvironmentNotice;
  let failedEvaluatorCalls = 0;
  const failedSubscriptionPorts = runtimeApi.createRuntimeReactiveHostPorts({
    ...rawHostPorts,
    context: {
      getSnapshot: () => Object.freeze({ tenant: "failed-mount" }),
      subscribe(notice) {
        failedContextNotices.add(notice);
        return () => {
          failedContextUnsubscriptions += 1;
          notice();
          failedContextNotices.delete(notice);
        };
      },
    },
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe(notice) {
        retainedFailedEnvironmentNotice = notice;
        throw new Error("subscription unavailable");
      },
    },
  });
  const failedState = runtimeApi.mountRuntimeSurfaceState({
    surfaceId,
    state: {},
  });
  probeAssert(failedState.status === "mounted", "Failed-mount proof state did not mount.");
  if (failedState.status !== "mounted") throw new TypeError("unreachable");
  const failedResources = runtimeApi.mountRuntimeSurfaceResources({
    documentId,
    revision,
    surfaceId,
    resources: {},
    catalogSet: validation.value,
    hostPorts: failedSubscriptionPorts,
  });
  const failedOperations = runtimeApi.mountRuntimeSurfaceOperations({
    documentId,
    revision,
    surfaceId,
    aliases: {},
    catalogSet: validation.value,
    hostPorts: failedSubscriptionPorts,
  });
  probeAssert(
    failedResources.status === "mounted" && failedOperations.status === "mounted",
    "Failed-subscription proof lower managers did not mount.",
  );
  if (failedResources.status !== "mounted" || failedOperations.status !== "mounted") {
    throw new TypeError("unreachable");
  }
  const failedMount = runtimeApi.mountRuntimeReactiveReevaluation({
    documentId,
    revision,
    surfaceId,
    stateHandle: failedState.handle,
    stateSnapshot: failedState.snapshot,
    resourceHandle: failedResources.handle,
    resourceSnapshot: failedResources.snapshot,
    operationHandle: failedOperations.handle,
    operationSnapshot: failedOperations.snapshot,
    hostPorts: failedSubscriptionPorts,
    evaluator: () => {
      failedEvaluatorCalls += 1;
      return {};
    },
  });
  probeAssert(
    isDeepStrictEqual(failedMount, {
      status: "invalid",
      reason: "host-subscription-failed",
    }) &&
      failedContextUnsubscriptions === 1 &&
      failedContextNotices.size === 0 &&
      typeof retainedFailedEnvironmentNotice === "function" &&
      failedEvaluatorCalls === 0,
    "Failed second subscription retained live coordinator authority.",
  );
  retainedFailedEnvironmentNotice();
  probeAssert(
    failedEvaluatorCalls === 0 && failedContextNotices.size === 0,
    "Notice retained by a failed host subscription reactivated revoked authority.",
  );

  const disposed = runtimeApi.disposeRuntimeReactiveReevaluation(mounted.handle);
  probeAssert(
    isDeepStrictEqual(disposed, { status: "disposed", unsubscribed: 2 }) &&
      contextUnsubscriptions === 1 &&
      environmentUnsubscriptions === 1 &&
      contextNotices.size === 0 &&
      environmentNotices.size === 0 &&
      isDeepStrictEqual(runtimeApi.readRuntimeReactiveReevaluation(mounted.handle), {
        status: "disposed",
      }) &&
      isDeepStrictEqual(runtimeApi.disposeRuntimeReactiveReevaluation(mounted.handle), {
        status: "already-disposed",
        unsubscribed: 0,
      }),
    "Reactive disposal was not exact-once and terminal.",
  );

  return Object.freeze({
    hostCaptureProbes: 12,
    settlementProbes: 9,
    revokedProxyRedactions: 1,
    authorityProbes: 11,
    revokedInputProbes: 2,
    batchingProbes: 7,
    hostSnapshotProbes: 5,
    staleCandidateProbes: 5,
    unchangedPublicationProbes: 3,
    failedSubscriptionCleanupProbes: 7,
    disposalProbes: 8,
    evaluatorCalls,
    evaluatorAuthorityLeaks,
    requestLeaks: 0,
    platformEffects: 0,
  });
}

/**
 * Builds deterministic M04-T15 evidence without writing the tracked artifact.
 */
export async function buildRuntimeCoreReactiveReevaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const prerequisiteBytes = normalized.prerequisiteBytes ?? {};
  const prerequisitesPromise = Promise.all(
    PREREQUISITES.map((definition) =>
      verifyPrerequisite(definition, prerequisiteBytes[definition.key]),
    ),
  );
  const [
    prerequisites,
    hostSource,
    reevaluationSource,
    hostTests,
    reevaluationTests,
    typeTests,
    hostDeclaration,
    hostJavaScript,
    reevaluationDeclaration,
    reevaluationJavaScript,
    sourceIndex,
    builtIndexDeclaration,
    builtIndexJavaScript,
    rootTests,
    manifestText,
    traceText,
    normativeText,
    proofMatrixText,
    findingsText,
    proofText,
    catalogText,
    tracked,
  ] = await Promise.all([
    prerequisitesPromise,
    readWorkspaceText("packages/runtime-core/src/reactive-host-ports.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/reactive-reevaluation.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/reactive-host-ports.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/reactive-reevaluation.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/reactive-reevaluation.types.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/reactive-host-ports.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/reactive-host-ports.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/reactive-reevaluation.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/reactive-reevaluation.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("tests/runtime-core-reactive-reevaluation.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/proof/NORMATIVE-COVERAGE.md", fileOverrides),
    readWorkspaceText("docs/proof/PROOF-MATRIX.md", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    readWorkspaceText("docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md", fileOverrides),
    readWorkspaceText(CATALOG_PATH, fileOverrides),
    trackedFiles(fileOverrides),
  ]);

  const hostSourceInvariants = verifyHostSourceInvariants(hostSource);
  const reevaluationSourceInvariants = verifyReevaluationSourceInvariants(reevaluationSource);
  const publicApi = verifyPublicApi({
    hostSource,
    reevaluationSource,
    hostDeclaration,
    hostJavaScript,
    reevaluationDeclaration,
    reevaluationJavaScript,
    sourceIndex,
    builtIndexDeclaration,
    builtIndexJavaScript,
  });
  for (const [relativePath, expected] of Object.entries(EXPECTED_SOURCE_SHA256)) {
    const sourceText = relativePath.includes("reactive-host-ports")
      ? hostSource
      : reevaluationSource;
    if (sha256(Buffer.from(sourceText)) !== expected) {
      fail("REACTIVE_SOURCE_BYTE_DRIFT", `Reviewed M04-T15 source bytes drifted: ${relativePath}.`);
    }
  }
  const tests = verifyTestInventory(
    hostTests,
    reevaluationTests,
    typeTests,
    rootTests,
    manifestText,
  );
  const trace = parseJson(traceText, "REACTIVE_METADATA_INVALID", "protocol traceability");
  const traceRules = verifyTrace(trace);
  const documentation = verifyDocumentation(
    normativeText,
    proofMatrixText,
    findingsText,
    proofText,
  );
  const [runtimeApi, validatorApi] = await Promise.all([
    normalized.runtimeApi ?? import(RUNTIME_API_URL.href),
    normalized.validatorApi ?? import(VALIDATOR_API_URL.href),
  ]);
  const runtime = await probeRuntimeBehavior(runtimeApi, validatorApi, catalogText);

  const artifact = Object.freeze({
    schemaVersion: 1,
    task: "M04-T15",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Exact current state, resource, and operation generations plus complete context and environment snapshots produce one bounded whole-surface result while detached pre-lifecycle host settlements and post-evaluator epoch checks prevent stale asynchronous or reentrant results from overwriting newer state.",
      protocolStatusChanges: Object.freeze([]),
      proofMatrixStatusChanges: Object.freeze([]),
      normativeStatusChanges: Object.freeze([]),
    }),
    prerequisites: Object.freeze(prerequisites),
    publicApi,
    sourceInvariants: Object.freeze({
      reactiveHostPorts: hostSourceInvariants,
      reactiveReevaluation: reevaluationSourceInvariants,
    }),
    runtime,
    limits: Object.freeze({
      maxSynchronousTransitions: 64,
      maxEvaluationGeneration: Number.MAX_SAFE_INTEGER,
      maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
    }),
    semantics: Object.freeze({
      settlementFence:
        "Resource and operation results cross a native-Promise, exact-envelope, detached JSON boundary before lifecycle managers inspect them; reentrant reflection completes before the lower current-attempt check, while revoked-Proxy reflection failures are rejected without their reason.",
      authority:
        "Mount requires one factory-authenticated host aggregate and exact current state, resource, and operation handle/snapshot identities for the same document lifetime.",
      consistentSnapshot:
        "Every evaluator attempt double-samples complete lower-manager identities plus detached context and environment bytes around construction of one seven-namespace resolution snapshot.",
      leastAuthority:
        "The synchronous evaluator receives only frozen identity metadata, the resolution snapshot, and token materialization authority.",
      batching:
        "Explicit action-turn invalidation and context/environment notices set one coalescing dirty bit drained synchronously under a finite transition ceiling without platform scheduling.",
      staleCandidates:
        "Invalidation epoch and all sampled authorities are authenticated before evaluator entry, after evaluator return, and after hostile result detachment; stale candidates never publish.",
      publication:
        "Canonical byte-equal output preserves the exact previous snapshot and generation; changed active or inactive output advances monotonically without wraparound.",
      strategy:
        "This reference slice deliberately uses permitted whole-surface reevaluation; M04-T16 owns its observable oracle against indexed evaluation, while dependency-index performance work remains M12-T05.",
      failedMount:
        "Central revocation clears the complete evaluator, host, manager, snapshot, and subscription graph before failed-mount cleanup; a notice retained by the failed subscription remains inert.",
      disposal:
        "Disposal crosses the same complete revocation boundary, installs a minimal private tombstone, then unsubscribes context and environment exactly once; late and reentrant notices remain inert.",
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
        "docs/proof/PROOF-MATRIX.md",
        "docs/plan/PROTOCOL-FINDINGS.md",
        "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md",
        CATALOG_PATH,
      ]),
    }),
    deferred: Object.freeze([
      "complete validated surface traversal, conditional/repeat materialization, and descendant semantic inactivity (M04-T16)",
      "M04-T14 selector to M04-T13 prepared-program composition and seven-namespace event/item provenance (M04-T16)",
      "joint action-turn/reactive session coordinator, deterministic sign-in JSON trace, and complete session disposal (M04-T16)",
      "whole-surface versus dependency-indexed observable oracle (M04-T16)",
      "dependency-index optimization and cross-strategy performance comparison (M12-T05 when needed)",
      "standalone token invalidation because the frozen 0.1.0 token port has no subscription",
      "React reconciliation, concrete instance preservation/remount, DOM/CSS/accessibility/focus, and production adapter parity (M05)",
      "Android and iOS adapter implementations",
      "future protocol clarification recorded by PF-045",
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
    fail("REACTIVE_ARTIFACT_MISSING", "M04-T15 artifact is missing.", {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("REACTIVE_ARTIFACT_UNSAFE", "M04-T15 artifact must be a regular file.");
  }
  return readFile(artifactPath);
}

/** Writes and immediately re-verifies the deterministic M04-T15 artifact atomically. */
export async function writeRuntimeCoreReactiveReevaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreReactiveReevaluationEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreReactiveReevaluationEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Verifies the tracked M04-T15 artifact against a fresh deterministic build. */
export async function verifyRuntimeCoreReactiveReevaluationEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath =
    normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreReactiveReevaluationEvidence(normalized.buildOptions);
  const actualBytes = normalized.artifactBytes ?? (await readArtifactBytes(artifactPath));
  if (!Buffer.from(actualBytes).equals(expected.artifactBytes)) {
    fail("REACTIVE_ARTIFACT_DRIFT", "M04-T15 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(actualBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    runtimeExports: expected.artifact.publicApi.runtimeExports,
    typeExports: expected.artifact.publicApi.typeExports,
    moduleExports: expected.artifact.publicApi.moduleExports,
    tsdocDeclarations: expected.artifact.publicApi.tsdocDeclarations,
    focusedTests: expected.artifact.evidence.focusedTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules,
    normativeStatusChanges: expected.artifact.documentation.normativeStatusChanges,
    proofMatrixStatusChanges: expected.artifact.documentation.proofMatrixStatusChanges,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
    ...expected.artifact.runtime,
  });
}
