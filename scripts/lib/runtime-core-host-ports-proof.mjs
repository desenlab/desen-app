import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH,
  verifyReferenceCatalogWebCapabilityArtifactEvidence,
} from "./reference-catalog-web-capability-artifact-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const RUNTIME_API_URL = new URL("../../packages/runtime-core/dist/index.js", import.meta.url);

/** Absolute path to the deterministic M04-T01 host-port evidence artifact. */
export const DEFAULT_RUNTIME_CORE_HOST_PORTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/runtime-core-0.1.0-host-ports.json",
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["createRuntimeHostPorts"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeActivationCommitRequest",
  "RuntimeActivationCommitResult",
  "RuntimeActivationReadResult",
  "RuntimeActivationRecord",
  "RuntimeAwaitable",
  "RuntimeBundleStorageEntry",
  "RuntimeBundleStoragePutResult",
  "RuntimeBundleStorageReadResult",
  "RuntimeClockPort",
  "RuntimeContextPort",
  "RuntimeDiagnosticsPort",
  "RuntimeEnvironmentPort",
  "RuntimeHostCallResult",
  "RuntimeHostPorts",
  "RuntimeJsonObject",
  "RuntimeJsonPrimitive",
  "RuntimeJsonValue",
  "RuntimeNavigationPort",
  "RuntimeNavigationRequest",
  "RuntimeNavigationResult",
  "RuntimeOperationEffect",
  "RuntimeOperationPort",
  "RuntimeOperationRequest",
  "RuntimeRequestContext",
  "RuntimeResourcePort",
  "RuntimeResourceRequest",
  "RuntimeStoragePort",
  "RuntimeTokenPort",
  "RuntimeTokenRequest",
  "RuntimeTokenResolution",
]);
const EXPECTED_HOST_PORT_SOURCE_EXPORTS = Object.freeze(
  [...EXPECTED_TYPE_EXPORTS, ...EXPECTED_RUNTIME_EXPORTS].sort(),
);
const EXPECTED_PORTS = Object.freeze([
  Object.freeze({
    name: "navigation",
    callbacks: Object.freeze(["navigate"]),
    settlement: "synchronous succeeded | denied",
  }),
  Object.freeze({
    name: "storage",
    callbacks: Object.freeze(["getBundle", "putBundle", "readActivation", "commitActivation"]),
    settlement: "sync-or-promise immutable bytes and activation CAS",
  }),
  Object.freeze({
    name: "operations",
    callbacks: Object.freeze(["invoke"]),
    settlement: "sync-or-promise succeeded | failed(public code) | denied",
  }),
  Object.freeze({
    name: "resources",
    callbacks: Object.freeze(["load"]),
    settlement: "sync-or-promise succeeded | failed(public code) | denied",
  }),
  Object.freeze({
    name: "tokens",
    callbacks: Object.freeze(["resolve"]),
    settlement: "synchronous resolved | missing",
  }),
  Object.freeze({
    name: "context",
    callbacks: Object.freeze(["getSnapshot", "subscribe"]),
    settlement: "synchronous JSON snapshot plus invalidation",
  }),
  Object.freeze({
    name: "environment",
    callbacks: Object.freeze(["getSnapshot", "subscribe"]),
    settlement: "synchronous JSON snapshot plus invalidation",
  }),
  Object.freeze({
    name: "clock",
    callbacks: Object.freeze(["now"]),
    settlement: "synchronous Unix-epoch milliseconds",
  }),
  Object.freeze({
    name: "diagnostics",
    callbacks: Object.freeze(["report"]),
    settlement: "synchronous safe inert diagnostic observation",
  }),
]);
const RESERVED_ENVIRONMENT_PATHS = Object.freeze([
  "env.viewport.width",
  "env.viewport.height",
  "env.viewport.orientation",
  "env.pointer",
  "env.colorScheme",
  "env.reducedMotion",
  "env.locale",
  "env.platform",
]);
const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-041",
    section: "14.2.2",
    owners: Object.freeze(["M04-T01", "M12-T04"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-046",
    section: "14.2.7",
    owners: Object.freeze(["M04-T01", "M04-T15"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-089",
    section: "22.1",
    owners: Object.freeze(["M03-T02", "M04-T01", "M04-T09"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-105",
    section: "24.5",
    owners: Object.freeze(["M04-T01", "M04-T10", "M05-T07"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-106",
    section: "24.6",
    owners: Object.freeze(["M04-T01", "M04-T09", "M04-T12"]),
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-122",
    section: "27.7",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-026",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M04-T01", "M04-T09"]),
  }),
]);
const REQUIRED_FINDING_TEXT = Object.freeze([
  "## PF-031 — Host-port transport and persistence envelopes are implementation profiles",
  "M04-T01 defines a platform-neutral reference API, not new protocol",
  "one atomic `{activeRevision, previousGoodRevision, generation}` compare-and-swap record",
  "TypeScript is not a trust boundary",
]);
const ROOT_SCRIPTS = Object.freeze({
  "generate:runtime-core-host-ports":
    "pnpm verify:reference-catalog-web-capability-artifact && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:host-ports && node scripts/generate-runtime-core-host-ports-proof.mjs",
  "verify:runtime-core-host-ports":
    "pnpm verify:reference-catalog-web-capability-artifact && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:host-ports && node scripts/verify-runtime-core-host-ports.mjs",
  "test:runtime-core-host-ports":
    "pnpm verify:reference-catalog-web-capability-artifact && pnpm --filter @desen/runtime-core... build && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:host-ports && node --test tests/runtime-core-host-ports.test.mjs",
});
const TRACKED_PATHS = Object.freeze([
  "packages/runtime-core/src/host-ports.ts",
  "packages/runtime-core/test/host-ports.test.ts",
  "packages/runtime-core/test/host-ports.types.ts",
  "packages/runtime-core/dist/host-ports.js",
  "packages/runtime-core/dist/host-ports.js.map",
  "packages/runtime-core/dist/host-ports.d.ts",
  "packages/runtime-core/dist/host-ports.d.ts.map",
  "scripts/lib/runtime-core-host-ports-proof.mjs",
  "scripts/generate-runtime-core-host-ports-proof.mjs",
  "scripts/verify-runtime-core-host-ports.mjs",
  "tests/runtime-core-host-ports.test.mjs",
]);
const EXPECTED_TEST_INVENTORY = Object.freeze({
  packageTests: 10,
  compilerNegativeCases: 9,
  rootMutationTests: 10,
});
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
  "performance",
  "process",
  "Buffer",
  "globalThis",
  "require",
  "Function",
  "eval",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
]);

/** Stable evidence error for deterministic root mutation tests. */
export class RuntimeCoreHostPortsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreHostPortsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreHostPortsEvidenceError(code, message, details);
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
    fail("HOST_PORTS_OPTIONS_INVALID", "Evidence options must be an object.");
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
    fail(code, `${label} differs from the M04-T01 contract.`, { expected, actual });
  }
}

function verifyTrace(trace) {
  const evidence = [];
  for (const expected of EXPECTED_TRACE_RULES) {
    const item = trace[expected.collection]?.find((candidate) => candidate.id === expected.id);
    if (
      item === undefined ||
      item.section !== expected.section ||
      JSON.stringify(item.owners) !== JSON.stringify(expected.owners)
    ) {
      fail("HOST_PORTS_TRACE_DRIFT", `Trace rule ${expected.id} differs from M04-T01 ownership.`);
    }
    evidence.push(
      Object.freeze({
        collection: expected.collection,
        id: expected.id,
        section: expected.section,
        owners: Object.freeze([...expected.owners]),
        status: "CONTRACT_ONLY",
      }),
    );
  }
  return Object.freeze(evidence);
}

function verifyFinding(findings) {
  for (const required of REQUIRED_FINDING_TEXT) {
    if (!findings.includes(required)) {
      fail("HOST_PORTS_FINDING_DRIFT", "PF-031 no longer records the required profile boundary.", {
        required,
      });
    }
  }
}

function exportedDeclarations(sourceText) {
  const sourceFile = ts.createSourceFile(
    "host-ports.ts",
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.TS,
  );
  const names = [];
  const missingTsdoc = [];
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported || statement.name === undefined || !ts.isIdentifier(statement.name)) continue;
    names.push(statement.name.text);
    if (ts.getJSDocCommentsAndTags(statement).length === 0) {
      missingTsdoc.push(statement.name.text);
    }
  }
  return Object.freeze({
    sourceFile,
    names: Object.freeze(names.sort()),
    missingTsdoc: Object.freeze(missingTsdoc.sort()),
  });
}

function indexExportInventory(sourceText, fileName) {
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
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail(
        "HOST_PORTS_INDEX_EXPORT_DRIFT",
        `${fileName} may contain only explicit named re-exports.`,
      );
    }
    const hostPortDeclaration = statement.moduleSpecifier.text === "./host-ports.js";
    for (const element of statement.exportClause.elements) {
      const publicName = element.name.text;
      if (
        element.propertyName !== undefined ||
        (!hostPortDeclaration && EXPECTED_HOST_PORT_SOURCE_EXPORTS.includes(publicName))
      ) {
        fail(
          "HOST_PORTS_INDEX_EXPORT_DRIFT",
          `${fileName} must not alias or duplicate M04-T01 public exports.`,
        );
      }
      if (!hostPortDeclaration) continue;
      const target = statement.isTypeOnly || element.isTypeOnly ? typeExports : runtimeExports;
      target.push(publicName);
    }
  }

  runtimeExports.sort();
  typeExports.sort();
  return Object.freeze({
    sourceFile,
    runtimeExports: Object.freeze(runtimeExports),
    typeExports: Object.freeze(typeExports),
  });
}

function verifyIndexContract(sourceText, fileName, expectedTypeExports) {
  const inventory = indexExportInventory(sourceText, fileName);
  assertArrayEqual(
    inventory.runtimeExports,
    EXPECTED_RUNTIME_EXPORTS,
    "HOST_PORTS_INDEX_EXPORT_DRIFT",
    `${fileName} runtime exports`,
  );
  assertArrayEqual(
    inventory.typeExports,
    expectedTypeExports,
    "HOST_PORTS_INDEX_EXPORT_DRIFT",
    `${fileName} type exports`,
  );

  const forbidden = new Set();
  function visit(node) {
    if (
      ts.isIdentifier(node) &&
      (FORBIDDEN_RUNTIME_IDENTIFIERS.includes(node.text) || node.text === "globalThis")
    ) {
      forbidden.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(inventory.sourceFile);
  if (forbidden.size > 0) {
    fail("HOST_PORTS_INDEX_EXPORT_DRIFT", `${fileName} exposes a platform/global dependency.`, {
      forbidden: [...forbidden].sort(),
    });
  }
}

function verifySourceContract(hostSource, indexSource) {
  const declarations = exportedDeclarations(hostSource);
  assertArrayEqual(
    declarations.names,
    EXPECTED_HOST_PORT_SOURCE_EXPORTS,
    "HOST_PORTS_SOURCE_EXPORT_DRIFT",
    "Host-port source exports",
  );
  if (declarations.missingTsdoc.length > 0) {
    fail("HOST_PORTS_TSDOC_MISSING", "Every public M04-T01 declaration requires TSDoc.", {
      missing: declarations.missingTsdoc,
    });
  }

  const imports = declarations.sourceFile.statements.filter(ts.isImportDeclaration);
  if (
    imports.length !== 1 ||
    imports[0].moduleSpecifier.text !== "@desen/protocol" ||
    imports[0].importClause?.isTypeOnly !== true
  ) {
    fail(
      "HOST_PORTS_IMPORT_BOUNDARY_DRIFT",
      "Host-port source may import only protocol diagnostics as a type-only dependency.",
    );
  }

  const forbidden = new Set();
  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_RUNTIME_IDENTIFIERS.includes(node.text)) {
      forbidden.add(node.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      forbidden.add("dynamic import");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "eval" || node.expression.text === "Function")
    ) {
      forbidden.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(declarations.sourceFile);
  if (forbidden.size > 0) {
    fail(
      "HOST_PORTS_PLATFORM_BOUNDARY_DRIFT",
      "Platform globals or executable evaluation entered runtime-core host ports.",
      { forbidden: [...forbidden].sort() },
    );
  }

  verifyIndexContract(indexSource, "src/index.ts", EXPECTED_TYPE_EXPORTS);
  return Object.freeze({
    publicDeclarations: declarations.names.length,
    tsdocDeclarations: declarations.names.length,
    runtimeExports: Object.freeze([...EXPECTED_RUNTIME_EXPORTS]),
    typeExports: Object.freeze([...EXPECTED_TYPE_EXPORTS]),
    allowedSourceImports: Object.freeze(["type-only @desen/protocol"]),
  });
}

function verifyDeclarations(
  declarationText,
  builtJavaScript,
  indexDeclarationText,
  indexBuiltJavaScript,
) {
  const declarations = exportedDeclarations(declarationText);
  assertArrayEqual(
    declarations.names,
    EXPECTED_HOST_PORT_SOURCE_EXPORTS,
    "HOST_PORTS_DECLARATION_DRIFT",
    "Built host-port declarations",
  );
  if (declarations.missingTsdoc.length > 0) {
    fail("HOST_PORTS_DECLARATION_DRIFT", "Built host-port declarations lost public TSDoc.", {
      missing: declarations.missingTsdoc,
    });
  }
  for (const forbidden of [
    "react",
    "react-dom",
    "react-native",
    "HTMLElement",
    "CSSStyleSheet",
    "AbortSignal",
    "node:",
  ]) {
    if (declarationText.includes(forbidden) || builtJavaScript.includes(forbidden)) {
      fail(
        "HOST_PORTS_DISTRIBUTION_BOUNDARY_DRIFT",
        `Built host-port distribution contains forbidden platform surface ${forbidden}.`,
      );
    }
  }
  if (builtJavaScript.includes("@desen/protocol")) {
    fail(
      "HOST_PORTS_DISTRIBUTION_BOUNDARY_DRIFT",
      "The diagnostic dependency must erase completely from built host-port JavaScript.",
    );
  }
  verifyIndexContract(indexDeclarationText, "dist/index.d.ts", EXPECTED_TYPE_EXPORTS);
  verifyIndexContract(indexBuiltJavaScript, "dist/index.js", []);
}

function testRegistrationCount(call, directName) {
  if (ts.isIdentifier(call.expression) && call.expression.text === directName) return 1;
  if (
    ts.isCallExpression(call.expression) &&
    ts.isPropertyAccessExpression(call.expression.expression) &&
    ts.isIdentifier(call.expression.expression.expression) &&
    call.expression.expression.expression.text === directName &&
    call.expression.expression.name.text === "each"
  ) {
    const cases = call.expression.arguments[0];
    if (!ts.isArrayLiteralExpression(cases)) {
      fail("HOST_PORTS_TEST_INVENTORY_DRIFT", `${directName}.each must use a literal case table.`);
    }
    return cases.elements.length;
  }
  return 0;
}

function directRegistrationStatements(sourceFile, directName) {
  if (directName === "test") return sourceFile.statements;
  const describeStatements = sourceFile.statements.filter(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === "describe",
  );
  if (describeStatements.length !== 1) {
    fail(
      "HOST_PORTS_TEST_INVENTORY_DRIFT",
      "The package suite must have one direct describe registration.",
    );
  }
  const describeCall = describeStatements[0].expression;
  const callback = describeCall.arguments[1];
  if (
    callback === undefined ||
    (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
    !ts.isBlock(callback.body)
  ) {
    fail(
      "HOST_PORTS_TEST_INVENTORY_DRIFT",
      "The package describe registration requires one direct block callback.",
    );
  }
  return callback.body.statements;
}

function countDeclaredTests(sourceText, fileName, directName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  );
  let observedCalls = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      observedCalls += testRegistrationCount(node, directName);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  let directRegistrations = 0;
  for (const statement of directRegistrationStatements(sourceFile, directName)) {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      continue;
    }
    directRegistrations += testRegistrationCount(statement.expression, directName);
  }
  if (observedCalls !== directRegistrations) {
    fail(
      "HOST_PORTS_TEST_INVENTORY_DRIFT",
      `${fileName} contains a conditional or nested ${directName} registration.`,
      { observedCalls, directRegistrations },
    );
  }
  return directRegistrations;
}

function verifyTestInventory(packageTests, compilerCases, rootTests) {
  const inventory = Object.freeze({
    packageTests: countDeclaredTests(packageTests, "host-ports.test.ts", "it"),
    compilerNegativeCases: [...compilerCases.matchAll(/\/\/\s*@ts-expect-error\b/gu)].length,
    rootMutationTests: countDeclaredTests(rootTests, "runtime-core-host-ports.test.mjs", "test"),
  });
  for (const [name, expected] of Object.entries(EXPECTED_TEST_INVENTORY)) {
    if (inventory[name] !== expected) {
      fail("HOST_PORTS_TEST_INVENTORY_DRIFT", `${name} differs from the M04-T01 evidence suite.`, {
        expected,
        actual: inventory[name],
      });
    }
  }
  return inventory;
}

function createPortProbe() {
  let calls = 0;
  const noOperation = () => undefined;
  const callback = (result) => () => {
    calls += 1;
    return result;
  };
  const callbacks = {
    navigation: { navigate: callback({ status: "succeeded" }) },
    storage: {
      getBundle: callback({ status: "missing" }),
      putBundle: callback({ status: "stored" }),
      readActivation: callback({ status: "missing" }),
      commitActivation: callback({
        status: "committed",
        record: { activeRevision: "r1", previousGoodRevision: null, generation: 0 },
      }),
    },
    operations: { invoke: callback({ status: "succeeded", value: null }) },
    resources: { load: callback({ status: "failed", errorCode: "public" }) },
    tokens: { resolve: callback({ status: "missing" }) },
    context: { getSnapshot: callback({}), subscribe: callback(noOperation) },
    environment: { getSnapshot: callback({}), subscribe: callback(noOperation) },
    clock: { now: callback(0) },
    diagnostics: { report: callback(undefined) },
  };
  return Object.freeze({ callbacks, callCount: () => calls });
}

function verifyFactory(runtimeApi) {
  if (
    runtimeApi === null ||
    typeof runtimeApi !== "object" ||
    typeof runtimeApi.createRuntimeHostPorts !== "function"
  ) {
    fail(
      "HOST_PORTS_RUNTIME_EXPORT_MISSING",
      "Built runtime-core does not expose createRuntimeHostPorts.",
    );
  }
  const probe = createPortProbe();
  const ports = runtimeApi.createRuntimeHostPorts(probe.callbacks);
  if (probe.callCount() !== 0 || !Object.isFrozen(ports)) {
    fail(
      "HOST_PORTS_FACTORY_EAGER_OR_MUTABLE",
      "The host-port factory invoked a callback or returned a mutable aggregate.",
    );
  }
  for (const port of EXPECTED_PORTS) {
    if (!Object.isFrozen(ports[port.name])) {
      fail("HOST_PORTS_FACTORY_EAGER_OR_MUTABLE", `Captured ${port.name} port is mutable.`);
    }
    for (const callback of port.callbacks) {
      if (ports[port.name][callback] !== probe.callbacks[port.name][callback]) {
        fail(
          "HOST_PORTS_CALLBACK_IDENTITY_DRIFT",
          `Captured ${port.name}.${callback} callback identity changed.`,
        );
      }
    }
  }

  const invalidInputs = [
    null,
    [],
    Object.fromEntries(
      Object.entries(probe.callbacks).filter(([portName]) => portName !== "diagnostics"),
    ),
    { ...probe.callbacks, scheduler: { schedule: () => undefined } },
    { ...probe.callbacks, clock: { now: 0 } },
  ];
  for (const invalid of invalidInputs) {
    let rejected = false;
    try {
      runtimeApi.createRuntimeHostPorts(invalid);
    } catch (error) {
      rejected = error instanceof TypeError;
    }
    if (!rejected) {
      fail(
        "HOST_PORTS_FACTORY_REJECTION_MISSING",
        "Factory accepted an incomplete, extra, or non-callable host boundary.",
      );
    }
  }

  const getter = { ...probe.callbacks };
  let getterCalls = 0;
  Object.defineProperty(getter, "navigation", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return probe.callbacks.navigation;
    },
  });
  try {
    runtimeApi.createRuntimeHostPorts(getter);
  } catch (error) {
    if (!(error instanceof TypeError) || getterCalls !== 0) {
      fail(
        "HOST_PORTS_ACCESSOR_REJECTION_DRIFT",
        "Accessor rejection executed caller code or used an unstable error.",
      );
    }
    return Object.freeze({
      ports: EXPECTED_PORTS.length,
      callbacks: EXPECTED_PORTS.reduce((total, port) => total + port.callbacks.length, 0),
      rejectedShapes: invalidInputs.length + 1,
      eagerCalls: 0,
      callbackIdentityPreserved: true,
      callerObjectsFrozen: false,
    });
  }
  fail("HOST_PORTS_ACCESSOR_REJECTION_DRIFT", "Factory accepted an accessor-backed port.");
}

function verifyPackageManifest(packageManifest) {
  if (
    packageManifest.private !== true ||
    packageManifest.type !== "module" ||
    packageManifest.sideEffects !== false ||
    JSON.stringify(packageManifest.files) !== JSON.stringify(["dist"]) ||
    JSON.stringify(packageManifest.exports) !==
      JSON.stringify({
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
      }) ||
    packageManifest.dependencies?.["@desen/protocol"] !== "workspace:*" ||
    packageManifest.devDependencies?.vitest !== "4.1.10" ||
    packageManifest.scripts?.["test:host-ports"] !== "vitest run test/host-ports.test.ts" ||
    packageManifest.scripts?.test !== "vitest run" ||
    packageManifest.scripts?.lint !== "eslint src test --max-warnings=0"
  ) {
    fail(
      "HOST_PORTS_PACKAGE_CONTRACT_DRIFT",
      "runtime-core package dependencies or focused quality scripts differ.",
    );
  }
}

function verifyRootScripts(rootPackage) {
  for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
    if (rootPackage.scripts?.[name] !== command) {
      fail("HOST_PORTS_ROOT_SCRIPT_DRIFT", `Root script ${name} differs from M04-T01 evidence.`);
    }
  }
  for (const [owner, required] of [
    ["test", "pnpm test:runtime-core-host-ports"],
    ["check", "pnpm verify:runtime-core-host-ports"],
  ]) {
    if (!rootPackage.scripts?.[owner]?.includes(required)) {
      fail("HOST_PORTS_ROOT_SCRIPT_DRIFT", `Root ${owner} omits ${required}.`);
    }
  }
}

async function prerequisiteEvidence(verifyPrerequisite, injectedBytes) {
  const trackedBytes = await readFile(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH);
  if (injectedBytes !== undefined && !byteEqual(injectedBytes, trackedBytes)) {
    fail(
      "HOST_PORTS_PREREQUISITE_DRIFT",
      "Injected M03-T10 prerequisite bytes differ from the tracked artifact.",
    );
  }
  const bytes = injectedBytes ?? trackedBytes;
  const artifactSha256 = sha256(bytes);
  if (verifyPrerequisite) {
    const result = await verifyReferenceCatalogWebCapabilityArtifactEvidence();
    const verifiedSha256 = String(result.artifactSha256).replace(/^sha256:/u, "");
    if (verifiedSha256 !== artifactSha256) {
      fail(
        "HOST_PORTS_PREREQUISITE_DRIFT",
        "M03-T10 verification hash differs from its tracked artifact bytes.",
        { artifactSha256, verifiedSha256 },
      );
    }
  }
  return Object.freeze({
    task: "M03-T10",
    result: "PASS",
    artifact: "reference-catalog-web-capability-artifact.json",
    artifactSha256,
  });
}

async function trackedFiles(fileOverrides) {
  const records = [];
  for (const relativePath of TRACKED_PATHS) {
    const bytes = await readWorkspaceBytes(relativePath, fileOverrides);
    records.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
      }),
    );
  }
  return Object.freeze(records);
}

/**
 * Builds deterministic M04-T01 host-port evidence from built runtime-core and tracked contracts.
 */
export async function buildRuntimeCoreHostPortsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const fileOverrides = normalized.fileOverrides;
  const [
    hostSource,
    indexSource,
    declarationText,
    builtJavaScript,
    indexDeclarationText,
    indexBuiltJavaScript,
    packageTestSource,
    compilerCaseSource,
    rootTestSource,
    packageText,
    rootPackageText,
    traceText,
    findings,
    prerequisite,
  ] = await Promise.all([
    readWorkspaceText("packages/runtime-core/src/host-ports.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/src/index.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/host-ports.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/host-ports.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.d.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/dist/index.js", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/host-ports.test.ts", fileOverrides),
    readWorkspaceText("packages/runtime-core/test/host-ports.types.ts", fileOverrides),
    readWorkspaceText("tests/runtime-core-host-ports.test.mjs", fileOverrides),
    readWorkspaceText("packages/runtime-core/package.json", fileOverrides),
    readWorkspaceText("package.json", fileOverrides),
    readWorkspaceText("docs/proof/protocol-0.1.0-traceability.json", fileOverrides),
    readWorkspaceText("docs/plan/PROTOCOL-FINDINGS.md", fileOverrides),
    prerequisiteEvidence(
      normalized.verifyPrerequisite !== false,
      normalized.prerequisiteArtifactBytes,
    ),
  ]);
  const runtimeApi = normalized.runtimeApi ?? (await import(RUNTIME_API_URL.href));
  const publicApi = verifySourceContract(hostSource, indexSource);
  verifyDeclarations(declarationText, builtJavaScript, indexDeclarationText, indexBuiltJavaScript);
  const factory = verifyFactory(runtimeApi);
  const testInventory = verifyTestInventory(packageTestSource, compilerCaseSource, rootTestSource);
  const packageManifest = JSON.parse(packageText);
  const rootPackage = JSON.parse(rootPackageText);
  verifyPackageManifest(packageManifest);
  verifyRootScripts(rootPackage);
  const traceRules = verifyTrace(JSON.parse(traceText));
  verifyFinding(findings);
  const files = await trackedFiles(fileOverrides);

  const artifact = {
    schemaVersion: 1,
    task: "M04-T01",
    result: "PASS",
    claim: {
      protocol: "0.1.0",
      target: "platform-neutral",
      summary:
        "Trusted navigation, storage, operation, resource, token, context, environment, clock, and diagnostic callbacks cross one explicit framework-neutral host boundary.",
      protocolStatusChanges: [],
      proofMatrixStatusChanges: [],
      normativeStatusChanges: [],
    },
    prerequisite,
    publicApi,
    factory,
    ports: EXPECTED_PORTS,
    environment: {
      reservedPaths: RESERVED_ENVIRONMENT_PATHS,
      valueTypes: "profile-defined; no protocol enums invented",
    },
    policyBoundary: {
      operationAndResourceOutcomes: ["succeeded", "failed(public error code)", "denied"],
      navigationOutcomes: ["succeeded", "denied"],
      tokenOutcomes: ["resolved", "missing"],
      hostDenialCanBecomeSuccess: false,
      rawErrorsCrossBoundary: false,
      successfulValuesRequireLaterRuntimeValidation: true,
    },
    persistenceBoundary: {
      bundleBytes: "content-addressed and never overwritten under one revision",
      activationRecord: ["activeRevision", "previousGoodRevision", "generation"],
      activationCommit: "single-record compare-and-swap",
      userInputPersistence: false,
      designSelectedKeys: false,
    },
    portability: {
      sourceRuntimeDependencies: [],
      typeOnlyDependencies: ["@desen/protocol"],
      forbiddenPlatformsFound: [],
      jsonObservableData: true,
      byteStorageIsTransportOnly: true,
      a2uiDependencies: [],
    },
    evidence: {
      ...testInventory,
      traceRules,
      trackedFiles: files,
      rootScripts: Object.keys(ROOT_SCRIPTS),
    },
    deferred: [
      "reference, fallback, and value resolution (M04-T02)",
      "token value validation and formatting (M04-T03)",
      "resource lifecycle and refresh (M04-T08)",
      "operation lifecycle, concurrency, and settlement (M04-T09/M04-T11)",
      "navigation execution and denial diagnostics (M04-T10/M04-T16)",
      "allowlisted event, command, and generic adapter bridges (M04-T12/M04-T14)",
      "diagnostic sink exception containment in runtime transitions (later M04 execution tasks)",
      "storage implementations, activation, fault injection, and restart recovery (M07)",
      "React, browser, iOS, and Android adapters",
    ],
  };
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText);
  return Object.freeze({
    artifact: Object.freeze(artifact),
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

async function assertRegularArtifact(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    fail("HOST_PORTS_ARTIFACT_UNREADABLE", "M04-T01 artifact could not be inspected.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!entry.isFile()) {
    fail("HOST_PORTS_ARTIFACT_UNSAFE", "M04-T01 artifact must be a regular file.");
  }
}

/** Verifies tracked or injected M04-T01 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeCoreHostPortsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath = normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_HOST_PORTS_ARTIFACT_PATH;
  const expected = await buildRuntimeCoreHostPortsEvidence(normalized.buildOptions);
  let artifactBytes = normalized.artifactBytes;
  if (artifactBytes === undefined) {
    await assertRegularArtifact(artifactPath);
    artifactBytes = await readFile(artifactPath);
  }
  if (!byteEqual(artifactBytes, expected.artifactBytes)) {
    fail("HOST_PORTS_ARTIFACT_DRIFT", "M04-T01 artifact differs from fresh evidence.", {
      expectedSha256: expected.artifactSha256,
      actualSha256: sha256(artifactBytes),
    });
  }
  return Object.freeze({
    result: "PASS",
    artifactSha256: expected.artifactSha256,
    ports: expected.artifact.ports.length,
    callbacks: expected.artifact.factory.callbacks,
    runtimeExports: expected.artifact.publicApi.runtimeExports.length,
    typeExports: expected.artifact.publicApi.typeExports.length,
    packageTests: expected.artifact.evidence.packageTests,
    compilerNegativeCases: expected.artifact.evidence.compilerNegativeCases,
    rootMutationTests: expected.artifact.evidence.rootMutationTests,
    traceRules: expected.artifact.evidence.traceRules.length,
    trackedFiles: expected.artifact.evidence.trackedFiles.length,
  });
}

/** Atomically writes the deterministic M04-T01 artifact after all evidence checks pass. */
export async function writeRuntimeCoreHostPortsEvidence(options = undefined) {
  const normalized = normalizeOptions(options);
  const artifactPath = normalized.artifactPath ?? DEFAULT_RUNTIME_CORE_HOST_PORTS_ARTIFACT_PATH;
  const evidence =
    normalized.preparedEvidence ??
    (await buildRuntimeCoreHostPortsEvidence(normalized.buildOptions));
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    beforeAtomicRename: normalized.beforeAtomicRename,
  });
  const verified = await verifyRuntimeCoreHostPortsEvidence({
    artifactPath,
    artifactBytes: evidence.artifactBytes,
    buildOptions: normalized.buildOptions,
  });
  return Object.freeze({ ...verified, artifactPath });
}

/** Exact root command names owned by the M04-T01 evidence boundary. */
export const RUNTIME_CORE_HOST_PORTS_ROOT_SCRIPTS = Object.freeze(Object.keys(ROOT_SCRIPTS));
