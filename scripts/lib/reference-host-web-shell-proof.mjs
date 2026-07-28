import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, readFile, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_TRACKED_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 512 * 1024;

/** Stable destination for the deterministic M05-T07 reference-host receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
);

/** Human-readable claim document paired with the M05-T07 receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/REFERENCE-HOST-WEB-SHELL.md",
);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T06",
    path: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
    sha256: "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723",
    profile: "desen-runtime-react-failure-boundary-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T01",
    path: "docs/proof/artifacts/runtime-core-0.1.0-host-ports.json",
    sha256: "5a53cfc9698339a2e9da72c496c1b204e0da138da3d3c1efdc1fe0b5c0e4f190",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T10",
    path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
    result: "PASS",
  }),
  Object.freeze({
    task: "M02-T02",
    path: "docs/proof/artifacts/protocol-0.1.0-traceability.json",
    sha256: "749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514",
    result: "PASS",
  }),
]);

/** Immutable predecessor receipts copied by isolated hostile-input tests. */
export const REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS = Object.freeze(
  PREREQUISITES.map(({ path: relativePath }) => relativePath),
);

const APPLICATION_SOURCE_PATHS = Object.freeze([
  "apps/reference-host-web/src/application.tsx",
  "apps/reference-host-web/src/browser-profile.ts",
  "apps/reference-host-web/src/failure-view.tsx",
  "apps/reference-host-web/src/host-ports.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/managed-surface.tsx",
  "apps/reference-host-web/src/recovery-authority.ts",
  "apps/reference-host-web/src/root-policy.ts",
  "apps/reference-host-web/src/root.tsx",
  "apps/reference-host-web/src/styles.css",
]);

const APPLICATION_TEST_PATHS = Object.freeze([
  "apps/reference-host-web/test/host-ports.test.ts",
  "apps/reference-host-web/test/public-api.types.ts",
  "apps/reference-host-web/test/recovery-authority.test.ts",
  "apps/reference-host-web/test/root-lifecycle.test.tsx",
  "apps/reference-host-web/test/root-policy.test.ts",
  "apps/reference-host-web/test/root-security.test.tsx",
]);

const RUNTIME_WEB_SOURCE_PATHS = Object.freeze([
  "packages/runtime-web/src/browser-platform.ts",
  "packages/runtime-web/src/host-authority.ts",
  "packages/runtime-web/src/index.ts",
]);

const RUNTIME_WEB_TEST_PATHS = Object.freeze([
  "packages/runtime-web/test/host-authority.test.ts",
  "packages/runtime-web/test/host-authority.types.ts",
]);

const RUNTIME_CORE_SECURITY_SOURCE_PATHS = Object.freeze([
  "packages/runtime-core/src/headless-session.ts",
  "packages/runtime-core/src/index.ts",
]);

const RUNTIME_CORE_SECURITY_TEST_PATHS = Object.freeze([
  "packages/runtime-core/test/headless-materialization.test.ts",
  "packages/runtime-core/test/headless-session.test.ts",
  "packages/runtime-core/test/headless-session.types.ts",
]);

/** Task-scoped bytes owned by the current M05-T07 receipt. */
export const REFERENCE_HOST_WEB_SHELL_TRACKED_PATHS = Object.freeze([
  "apps/reference-host-web/index.html",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/README.md",
  "apps/reference-host-web/tsconfig.json",
  ...APPLICATION_SOURCE_PATHS,
  ...APPLICATION_TEST_PATHS,
  "packages/runtime-core/package.json",
  ...RUNTIME_CORE_SECURITY_SOURCE_PATHS,
  ...RUNTIME_CORE_SECURITY_TEST_PATHS,
  "packages/runtime-web/package.json",
  "packages/runtime-web/README.md",
  "packages/runtime-web/tsconfig.json",
  "packages/runtime-web/tsconfig.build.json",
  ...RUNTIME_WEB_SOURCE_PATHS,
  ...RUNTIME_WEB_TEST_PATHS,
  "dependency-cruiser.config.cjs",
  "package.json",
  "scripts/generate-reference-host-web-shell-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/reference-host-web-shell-proof.mjs",
  "scripts/verify-reference-host-web-shell.mjs",
  "tests/reference-host-web-shell.test.mjs",
]);

const SUPPORTING_INSPECTION_PATHS = Object.freeze(["docs/proof/protocol-0.1.0-traceability.json"]);

/** Complete file set required by isolated static/mutation inspection. */
export const REFERENCE_HOST_WEB_SHELL_INSPECTION_PATHS = Object.freeze([
  ...new Set([
    ...REFERENCE_HOST_WEB_SHELL_TRACKED_PATHS,
    ...REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS,
    ...SUPPORTING_INSPECTION_PATHS,
  ]),
]);

const APP_TEST_TITLES = Object.freeze({
  "apps/reference-host-web/test/host-ports.test.ts": Object.freeze([
    "captures nine ports and fourteen callbacks without invoking host or browser code",
    "publishes lazy browser invalidations and removes them terminally",
    "preserves the last valid environment when a temporary browser read becomes hostile",
    "attempts every registered browser cleanup when one listener removal throws",
    "enforces exact document and revision navigation identity",
    "rejects accessor and hostile composition envelopes without invoking hooks",
  ]),
  "apps/reference-host-web/test/root-policy.test.ts": Object.freeze([
    "uses the exact caught-error suppression policy and emits only fixed redacted signals",
    "contains throwing terminal fencing and observability without changing callback behavior",
    "rejects a missing reporter or terminal fence before creating callback policy",
  ]),
  "apps/reference-host-web/test/recovery-authority.test.ts": Object.freeze([
    "preserves ordinary observations and advances only explicit retry or authority replacement",
    "isolates roots and has no Bundle, revision, result, or snapshot input channel",
    "rejects hostile and accessor-backed input without invoking hooks",
    "disposes terminally and does not retain current authority",
  ]),
  "apps/reference-host-web/test/root-lifecycle.test.tsx": Object.freeze([
    "claims one container, renders boot infrastructure, and disposes idempotently",
    "rejects accessor-backed creation input without invoking the reporter getter",
    "routes a controlled invalid session only to the static host failure view",
    "preserves ordinary publications and advances only explicit recovery or authority replacement",
  ]),
  "apps/reference-host-web/test/root-security.test.tsx": Object.freeze([
    "terminally revokes the exact root, session, and host authority without inspecting uncaught values",
    "rejects a session mounted through a host configured for another document authority",
    "rejects a forged executable registry before transferring session or host ownership",
    "rejects reentrant replacement, recovery, and disposal without installing or leaking a third authority",
    "tombstones failed unmounts while releasing only containers with confirmed unmounts",
  ]),
});

const RUNTIME_WEB_TEST_TITLES = Object.freeze([
  "captures exact own-data factories without invoking any of the fourteen host callbacks",
  "authenticates only the exact configured document and revision without exposing authority",
  "captures an exact own-data envelope without accessors, property gets, or inner reflection",
  "short-circuits disposed and forged handles before reflecting over caller input",
  "rechecks the exact authority after request reflection reenters disposal",
  "delegates all trusted ports and detaches browser environment snapshots",
  "asserts the exact configured document and revision before navigation delegation",
  "denies a navigation result when the delegate reentrantly disposes its authority",
  "keeps environment observations inert and returns the last valid snapshot on hostile input",
  "provides a non-decreasing epoch clock without sampling it during construction",
  "fences subscriptions, unsubscribes exactly once, and ignores late notices",
  "redacts hostile subscription and diagnostic failures from public outcomes",
  "terminally fences every callback before reflecting over late caller input",
  "rejects forged, accessor-backed, extra, and reflection-hostile factory inputs",
  "authenticates handles without reflecting over forgeries and returns exact frozen results",
]);

const RUNTIME_CORE_SECURITY_TEST_TITLES = Object.freeze([
  "authenticates only the exact mounted aggregate without exposing port authority",
  "never reflects into exact or mismatched host-port aggregates",
  "rejects accessor-backed, inherited, extra, symbolic, and hostile request envelopes",
  "short-circuits disposed and forged handles before reflecting over a request",
  "rechecks session authority after request reflection reenters disposal",
]);

const RUNTIME_WEB_RUNTIME_EXPORTS = Object.freeze([
  "authenticateRuntimeWebHostDocumentAuthority",
  "createRuntimeWebBrowserPlatform",
  "createRuntimeWebHostAuthority",
  "disposeRuntimeWebHostAuthority",
  "readRuntimeWebHostAuthority",
]);

const RUNTIME_WEB_TYPE_EXPORTS = Object.freeze([
  "RuntimeWebBrowserPlatformCreateInput",
  "RuntimeWebBrowserPlatformCreateResult",
  "RuntimeWebBrowserPlatformHandle",
  "RuntimeWebHostAuthorityCreateInput",
  "RuntimeWebHostAuthorityCreateResult",
  "RuntimeWebHostAuthorityDisposeResult",
  "RuntimeWebHostAuthorityHandle",
  "RuntimeWebHostAuthorityReadResult",
  "RuntimeWebHostDocumentAuthorityInput",
  "RuntimeWebHostDocumentAuthorityResult",
]);

const TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "proseRules",
    id: "R-019",
    section: "9.1",
    owners: Object.freeze(["M05-T07", "M05-T09"]),
    tests: Object.freeze(["M05-T09", "M10-T05"]),
    disposition: "partial-host-wrapper-evidence",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-105",
    section: "24.5",
    owners: Object.freeze(["M04-T01", "M04-T10", "M05-T07"]),
    tests: Object.freeze(["M04-T16", "M10-T04"]),
    disposition: "explicit-host-navigation-port-wired",
  }),
  Object.freeze({
    collection: "invariants",
    id: "A-013",
    section: "Appendix A",
    owners: Object.freeze(["M03-T09", "M05-T07"]),
    tests: Object.freeze(["M03-T09", "M12-T08"]),
    disposition: "host-owned-integration-profile",
  }),
]);

const ROOT_SCRIPT_PREFIX =
  "pnpm verify:runtime-react-failure-boundary && pnpm --filter @desen/runtime-core typecheck && pnpm --filter @desen/runtime-core test:headless-sign-in && pnpm --filter @desen/runtime-web... build && pnpm --filter @desen/runtime-web typecheck && pnpm --filter @desen/runtime-web test:host-authority && pnpm --filter @desen/reference-host-web... build && pnpm --filter @desen/reference-host-web typecheck && pnpm --filter @desen/reference-host-web test:shell";

const ROOT_SCRIPTS = Object.freeze({
  "generate:reference-host-web-shell": `${ROOT_SCRIPT_PREFIX} && node scripts/generate-reference-host-web-shell-proof.mjs`,
  "verify:reference-host-web-shell": `${ROOT_SCRIPT_PREFIX} && node scripts/verify-reference-host-web-shell.mjs`,
  "test:reference-host-web-shell": `${ROOT_SCRIPT_PREFIX} && node --test tests/reference-host-web-shell.test.mjs`,
});

const APP_REQUIRED_DEPENDENCIES = Object.freeze([
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
  "react",
  "react-dom",
]);

const APP_FORBIDDEN_DEPENDENCIES = Object.freeze([
  "@desen/app-web",
  "@desen/editor-core",
  "@desen/editor-web",
  "@desen/publisher",
  "@desen/testkit",
  "desen",
]);

const FORBIDDEN_PRODUCTION_IMPORTS = Object.freeze([
  "@desen/app-web",
  "@desen/editor-core",
  "@desen/editor-web",
  "@desen/publisher",
  "@desen/testkit",
  "desen",
]);

/** Stable error exposed to hostile-input and mutation tests. */
export class ReferenceHostWebShellEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceHostWebShellEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceHostWebShellEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertEqual(actual, expected, message, counter) {
  counter.value += 1;
  if (actual !== expected) {
    fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", message, { expected, actual });
  }
}

function assertIncludes(text, expected, label, counter) {
  counter.value += 1;
  if (!text.includes(expected)) {
    fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", `${label} lost a reviewed invariant.`, {
      expected,
    });
  }
}

function assertExcludes(text, forbidden, label, counter) {
  counter.value += 1;
  if (text.includes(forbidden)) {
    fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", `${label} contains a forbidden surface.`, {
      forbidden,
    });
  }
}

function isPlainDataObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function captureOptions(rawOptions, allowed, operation) {
  if (rawOptions === undefined) return Object.freeze({});
  if (!isPlainDataObject(rawOptions)) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `M05-T07 ${operation} options must be a plain own-data object.`,
    );
  }
  let keys;
  try {
    keys = Reflect.ownKeys(rawOptions);
  } catch {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `M05-T07 ${operation} options could not be inspected safely.`,
    );
  }
  if (
    keys.some((key) => typeof key !== "string" || !allowed.includes(key)) ||
    keys.length > allowed.length
  ) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `M05-T07 ${operation} options contain an unknown field.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(rawOptions, key);
    } catch {
      fail(
        "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
        `M05-T07 ${operation} option ${String(key)} is unsafe.`,
      );
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
        `M05-T07 ${operation} options must use enumerable own data properties.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("REFERENCE_HOST_SHELL_OPTIONS_INVALID", `${label} must be a non-empty safe string.`);
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    utilTypes.isProxy(value) ||
    (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) ||
    value.byteLength > MAX_ARTIFACT_BYTES
  ) {
    fail("REFERENCE_HOST_SHELL_OPTIONS_INVALID", `${label} must be bounded non-Proxy bytes.`);
  }
  return Buffer.from(value);
}

function optionalText(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_DOCUMENT_BYTES) {
    fail("REFERENCE_HOST_SHELL_OPTIONS_INVALID", `${label} must be bounded UTF-8 text.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "function" || utilTypes.isProxy(value)) {
    fail("REFERENCE_HOST_SHELL_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function resolveWorkspaceRoot(candidate) {
  const resolved = path.resolve(candidate ?? WORKSPACE_ROOT);
  let entry;
  try {
    entry = await lstat(resolved);
  } catch {
    fail("REFERENCE_HOST_SHELL_INPUT_UNSAFE", "Workspace root does not exist.");
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail("REFERENCE_HOST_SHELL_INPUT_UNSAFE", "Workspace root must be a real directory.");
  }
  try {
    return await realpath(resolved);
  } catch {
    fail("REFERENCE_HOST_SHELL_INPUT_UNSAFE", "Workspace root could not be resolved safely.");
  }
}

function sameFileState(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function readRegularFile(
  filePath,
  missingCode,
  unsafeCode,
  maximumBytes = MAX_TRACKED_FILE_BYTES,
) {
  let entry;
  try {
    entry = await lstat(filePath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") fail(missingCode, `Required file is missing: ${filePath}`);
    fail(unsafeCode, `Required file could not be inspected safely: ${filePath}`);
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > BigInt(maximumBytes)) {
    fail(unsafeCode, `Required file is not a bounded regular file: ${filePath}`);
  }
  let handle;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(entry, before)) {
      fail(unsafeCode, `Required file changed before its safe read: ${filePath}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.length !== Number(before.size) ||
      after.size > BigInt(maximumBytes) ||
      !sameFileState(before, after)
    ) {
      fail(unsafeCode, `Required file changed during its safe read: ${filePath}`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebShellEvidenceError) throw error;
    fail(unsafeCode, `Required file could not be read safely: ${filePath}`);
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // A controlled primary read failure remains authoritative.
      }
    }
  }
}

async function readPathMap(workspaceRoot, relativePaths) {
  const entries = [];
  for (const relativePath of relativePaths) {
    const bytes = await readRegularFile(
      path.join(workspaceRoot, relativePath),
      "REFERENCE_HOST_SHELL_INPUT_MISSING",
      "REFERENCE_HOST_SHELL_INPUT_UNSAFE",
    );
    entries.push(
      Object.freeze({
        relativePath,
        bytes,
        text: bytes.toString("utf8"),
      }),
    );
  }
  return new Map(entries.map((entry) => [entry.relativePath, entry]));
}

function parseJson(bytes, label, code = "REFERENCE_HOST_SHELL_SOURCE_DRIFT") {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

function exactArray(actual, expected, label, counter) {
  counter.value += 1;
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", `${label} drifted.`, { expected, actual });
  }
}

function collectTestTitles(text, relativePath) {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : relativePath.endsWith(".mjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
  const titles = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "it" || node.expression.text === "test")
    ) {
      const title = node.arguments[0];
      if (!title || !ts.isStringLiteralLike(title)) {
        fail(
          "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
          `${relativePath} contains a non-literal test registration.`,
        );
      }
      titles.push(title.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      (node.expression.expression.text === "it" || node.expression.expression.text === "test")
    ) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        `${relativePath} contains a skipped, conditional, or modified test registration.`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return titles;
}

function countCompilerNegativeCases(text) {
  return text.match(/@ts-expect-error/gu)?.length ?? 0;
}

function collectImportsAndDynamicCalls(text, relativePath) {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];
  let dynamicExecutableCalls = 0;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          ["eval", "require", "Function"].includes(node.expression.text))
      ) {
        dynamicExecutableCalls += 1;
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      dynamicExecutableCalls += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, dynamicExecutableCalls };
}

function collectIndexExports(text, relativePath = "packages/runtime-web/src/index.ts") {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const runtime = [];
  const types = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;
    const destination = statement.isTypeOnly ? types : runtime;
    for (const element of statement.exportClause.elements) destination.push(element.name.text);
  }
  return {
    runtime: runtime.sort(),
    types: types.sort(),
  };
}

function collectFunctionText(text, relativePath, functionName) {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const functions = source.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  if (functions.length !== 1) {
    fail(
      "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
      `${relativePath} must contain exactly one ${functionName} declaration.`,
      { actual: functions.length },
    );
  }
  return functions[0].getText(source);
}

function assertManifestSemantics(files, counter) {
  const app = parseJson(
    files.get("apps/reference-host-web/package.json").bytes,
    "reference-host package manifest",
  );
  assertEqual(
    app.name,
    "@desen/reference-host-web",
    "Reference-host package name drifted.",
    counter,
  );
  assertEqual(app.private, true, "Reference-host application must remain private.", counter);
  assertEqual(app.scripts?.build, "vite build", "Reference-host build command drifted.", counter);
  assertEqual(
    app.scripts?.test,
    "vitest run",
    "Reference-host exhaustive test command drifted.",
    counter,
  );
  assertEqual(
    app.scripts?.["test:shell"],
    "vitest run test/host-ports.test.ts test/root-policy.test.ts test/recovery-authority.test.ts test/root-lifecycle.test.tsx test/root-security.test.tsx",
    "Reference-host focused shell test command drifted.",
    counter,
  );
  for (const dependency of APP_REQUIRED_DEPENDENCIES) {
    counter.value += 1;
    if (!Object.hasOwn(app.dependencies ?? {}, dependency)) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        `Reference-host dependency ${dependency} is missing.`,
      );
    }
  }
  for (const dependency of APP_FORBIDDEN_DEPENDENCIES) {
    counter.value += 1;
    if (
      Object.hasOwn(app.dependencies ?? {}, dependency) ||
      Object.hasOwn(app.devDependencies ?? {}, dependency)
    ) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        `Reference-host dependency ${dependency} is forbidden.`,
      );
    }
  }

  const runtimeWeb = parseJson(
    files.get("packages/runtime-web/package.json").bytes,
    "runtime-web package manifest",
  );
  assertEqual(runtimeWeb.name, "@desen/runtime-web", "runtime-web package name drifted.", counter);
  assertEqual(
    runtimeWeb.scripts?.test,
    "vitest run",
    "runtime-web exhaustive test command drifted.",
    counter,
  );
  assertEqual(
    runtimeWeb.scripts?.["test:host-authority"],
    "vitest run test/host-authority.test.ts",
    "runtime-web focused test command drifted.",
    counter,
  );
  exactArray(
    Object.keys(runtimeWeb.dependencies ?? {}).sort(),
    ["@desen/runtime-core"],
    "runtime-web production dependencies",
    counter,
  );

  const runtimeCore = parseJson(
    files.get("packages/runtime-core/package.json").bytes,
    "runtime-core package manifest",
  );
  assertEqual(
    runtimeCore.scripts?.["test:headless-sign-in"],
    "vitest run test/headless-materialization.test.ts test/headless-session.test.ts",
    "runtime-core focused headless-session test command drifted.",
    counter,
  );

  const root = parseJson(files.get("package.json").bytes, "root package manifest");
  for (const [name, expected] of Object.entries(ROOT_SCRIPTS)) {
    assertEqual(root.scripts?.[name], expected, `Root ${name} command drifted.`, counter);
  }
  const testCommands = (root.scripts?.test ?? "").split(" && ");
  const checkCommands = (root.scripts?.check ?? "").split(" && ");
  counter.value += 2;
  if (
    testCommands.at(-2) !== "pnpm test:reference-host-web-shell" ||
    testCommands.at(-1) !== "turbo run test" ||
    !checkCommands.includes("pnpm verify:reference-host-web-shell") ||
    checkCommands.indexOf("pnpm verify:reference-host-web-shell") !==
      checkCommands.indexOf("pnpm verify:runtime-react-failure-boundary") + 1
  ) {
    fail(
      "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
      "Root test/check ordering no longer places M05-T07 after M05-T06.",
    );
  }
}

function assertProductionSemantics(files, counter) {
  const html = files.get("apps/reference-host-web/index.html").text;
  assertIncludes(html, 'id="desen-reference-host-root"', "Reference-host HTML", counter);
  assertIncludes(html, 'src="/src/main.tsx"', "Reference-host HTML", counter);
  assertExcludes(html, "sign-in-form", "Reference-host HTML", counter);

  const application = files.get("apps/reference-host-web/src/application.tsx").text;
  assertIncludes(
    application,
    'readonly status: "booting"',
    "Reference-host application state",
    counter,
  );
  assertIncludes(
    application,
    'readonly status: "surface"',
    "Reference-host application state",
    counter,
  );
  assertIncludes(
    application,
    'readonly status: "unavailable"',
    "Reference-host application state",
    counter,
  );
  assertExcludes(application, "children?:", "Reference-host application state", counter);
  assertExcludes(application, "ReactNode", "Reference-host application state", counter);

  const managed = files.get("apps/reference-host-web/src/managed-surface.tsx").text;
  assertIncludes(managed, "useRuntimeReactSurface(input)", "Generic managed-surface seam", counter);
  assertIncludes(managed, "<RuntimeReactSurfaceBoundary", "Generic managed-surface seam", counter);
  assertIncludes(managed, "recoveryKey={recoveryKey}", "Generic managed-surface seam", counter);
  assertExcludes(managed, "ReactNode", "Generic managed-surface seam", counter);

  const rootPolicy = files.get("apps/reference-host-web/src/root-policy.ts").text;
  assertIncludes(
    rootPolicy,
    "onCaughtError: ignoreRuntimeReactRootCaughtError",
    "Dedicated root policy",
    counter,
  );
  assertIncludes(rootPolicy, "void error;", "Dedicated root policy", counter);
  assertIncludes(rootPolicy, "void errorInfo;", "Dedicated root policy", counter);
  for (const forbidden of [
    "String(error)",
    "error.stack",
    "error.cause",
    "console.",
    "componentStack",
  ]) {
    assertExcludes(rootPolicy, forbidden, "Dedicated root policy", counter);
  }

  const root = files.get("apps/reference-host-web/src/root.tsx").text;
  for (const required of [
    "createRoot(",
    "createReferenceHostRootOptions(captured.reportDiagnostic, () => {",
    "observeReferenceHostRecoveryAuthority",
    "authorizeReferenceHostRecovery",
    "authenticateRuntimeHeadlessSessionHostAuthority",
    "authenticateRuntimeHeadlessSessionAdapterAuthority",
    "authenticateRuntimeWebHostDocumentAuthority",
    "{ hostPorts: hostRead.hostPorts }",
    "snapshot: captured.surface.serverSnapshot",
    "catalogSet: captured.surface.catalogSet",
    "documentId: surfaceAuthentication.snapshot.documentId",
    "revision: surfaceAuthentication.snapshot.revision",
    'state.lifecycle = "transitioning"',
    "terminallyFenceRoot(handle, state, true)",
    "disposeRuntimeWebHostAuthority",
    "disposeRuntimeHeadlessSession",
    "state.root.unmount()",
  ]) {
    assertIncludes(root, required, "Reference-host root lifetime", counter);
  }
  assertExcludes(root, "ReactNode", "Reference-host root lifetime", counter);
  assertExcludes(root, "children:", "Reference-host root lifetime", counter);
  const terminalFence = collectFunctionText(
    root,
    "apps/reference-host-web/src/root.tsx",
    "terminallyFenceRoot",
  );
  let terminalFenceOffset = 0;
  for (const required of [
    'if (state.lifecycle === "closing") return;',
    'state.lifecycle = "closing";',
    "const current = state.current;",
    "state.current = undefined;",
    "state.owner.current = undefined;",
    "ROOTS.set(handle, DISPOSED_ROOT);",
    "disposeRuntimeWebHostAuthority(current.hostAuthority);",
    "safelyDisposeSession(current.surface);",
    "state.root.unmount();",
    "disposeReferenceHostRecoveryAuthority(state.recoveryAuthority);",
    "if (unmountConfirmed) CLAIMED_CONTAINERS.delete(state.container);",
  ]) {
    counter.value += 1;
    const position = terminalFence.indexOf(required, terminalFenceOffset);
    if (position === -1) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        "Reference-host terminal fence lost its reviewed authority-first ordering.",
        { expected: required },
      );
    }
    terminalFenceOffset = position + required.length;
  }
  const activation = collectFunctionText(
    root,
    "apps/reference-host-web/src/root.tsx",
    "activateReferenceHostSurface",
  );
  assertEqual(
    activation.split('if (state.lifecycle !== "transitioning")').length - 1,
    7,
    "Reference-host activation lost a reentrant transition fence.",
    counter,
  );
  let activationOffset = 0;
  for (const required of [
    'if (state.lifecycle === "transitioning")',
    'state.lifecycle = "transitioning";',
    "const captured = captureActivationInput(input);",
    "const hostRead = readRuntimeWebHostAuthority(captured.hostAuthority);",
    "const hostAuthentication = authenticateRuntimeHeadlessSessionHostAuthority(",
    "{ hostPorts: hostRead.hostPorts }",
    "const surfaceAuthentication = authenticateRuntimeHeadlessSessionAdapterAuthority(",
    "snapshot: captured.surface.serverSnapshot",
    "catalogSet: captured.surface.catalogSet",
    "const documentAuthentication = authenticateRuntimeWebHostDocumentAuthority(",
    "documentId: surfaceAuthentication.snapshot.documentId",
    "revision: surfaceAuthentication.snapshot.revision",
    "const registryRead = readRuntimeReactAdapterRegistry(captured.surface.registry);",
    'if (registryRead.status !== "read")',
    "const previous = state.current;",
    "const observed = observeReferenceHostRecoveryAuthority(",
    "if (previous !== undefined && sessionChanged)",
    "state.current = Object.freeze({",
    "renderCurrent(handle, state);",
    'state.lifecycle = "active";',
  ]) {
    counter.value += 1;
    const position = activation.indexOf(required, activationOffset);
    if (position === -1) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        "Reference-host activation lost its reviewed authentication or commit ordering.",
        { expected: required },
      );
    }
    activationOffset = position + required.length;
  }
  const rootPolicyFunction = collectFunctionText(
    rootPolicy,
    "apps/reference-host-web/src/root-policy.ts",
    "createReferenceHostRootOptions",
  );
  for (const required of [
    'typeof onTerminalFailure !== "function"',
    "Reflect.apply(onTerminalFailure, undefined, []);",
    "reportReferenceHostRootDiagnostic(reporter, ROOT_DIAGNOSTICS.uncaught);",
  ]) {
    assertIncludes(rootPolicyFunction, required, "Dedicated root terminal policy", counter);
  }
  const uncaughtStart = rootPolicyFunction.indexOf("onUncaughtError");
  const terminalCall = rootPolicyFunction.indexOf(
    "Reflect.apply(onTerminalFailure, undefined, []);",
    uncaughtStart,
  );
  const uncaughtReport = rootPolicyFunction.indexOf(
    "reportReferenceHostRootDiagnostic(reporter, ROOT_DIAGNOSTICS.uncaught);",
    uncaughtStart,
  );
  counter.value += 1;
  if (
    uncaughtStart === -1 ||
    terminalCall === -1 ||
    uncaughtReport === -1 ||
    terminalCall >= uncaughtReport
  ) {
    fail(
      "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
      "Dedicated root uncaught-error policy must terminally fence before observability.",
    );
  }

  const recovery = files.get("apps/reference-host-web/src/recovery-authority.ts").text;
  for (const required of [
    'const expected = ["session", "registry", "catalogSet", "hostAuthority"]',
    "state.current.session === captured.session",
    "state.current.registry === captured.registry",
    "state.current.catalogSet === captured.catalogSet",
    "state.current.hostAuthority === captured.hostAuthority",
    "state.retryEpoch += 1n",
  ]) {
    assertIncludes(recovery, required, "Recovery authority", counter);
  }

  const hostPorts = files.get("apps/reference-host-web/src/host-ports.ts").text;
  assertIncludes(
    hostPorts,
    "createRuntimeWebHostAuthority({",
    "Reference-host port composition",
    counter,
  );
  assertIncludes(
    hostPorts,
    "createReferenceHostBrowserPlatform(captured.browser)",
    "Reference-host port composition",
    counter,
  );

  const runtimeAuthority = files.get("packages/runtime-web/src/host-authority.ts").text;
  assertIncludes(
    runtimeAuthority,
    "createRuntimeHostPorts(rawPorts)",
    "runtime-web host authority",
    counter,
  );
  assertIncludes(
    runtimeAuthority,
    "All nine ports and fourteen callbacks",
    "runtime-web host authority",
    counter,
  );
  assertIncludes(
    runtimeAuthority,
    "exact configured document and revision",
    "runtime-web host authority",
    counter,
  );
  assertIncludes(
    runtimeAuthority,
    'entry.status = "disposed"',
    "runtime-web host authority",
    counter,
  );
  for (const required of [
    "readonly documentId: string;",
    "readonly revision: string;",
    "documentId: documentIdValue.value,",
    "revision: revisionValue.value,",
  ]) {
    assertIncludes(runtimeAuthority, required, "runtime-web document authority retention", counter);
  }
  const captureDocumentAuthority = collectFunctionText(
    runtimeAuthority,
    "packages/runtime-web/src/host-authority.ts",
    "captureHostDocumentAuthorityInput",
  );
  for (const required of [
    "const prototype = Reflect.getPrototypeOf(input);",
    "const keys = Reflect.ownKeys(input);",
    "keys.length !== 2",
    '!keys.includes("documentId")',
    '!keys.includes("revision")',
    'Reflect.getOwnPropertyDescriptor(input, "documentId")',
    'Reflect.getOwnPropertyDescriptor(input, "revision")',
    "!documentId.enumerable",
    '!("value" in documentId)',
    "!validDocumentId(documentId.value)",
    "!revision.enumerable",
    '!("value" in revision)',
    "!validRevision(revision.value)",
  ]) {
    assertIncludes(
      captureDocumentAuthority,
      required,
      "runtime-web document-authority request capture",
      counter,
    );
  }
  for (const forbidden of [
    "input.documentId",
    "input.revision",
    "String(",
    "Reflect.get(input",
    "Reflect.ownKeys(documentId.value",
    "Reflect.ownKeys(revision.value",
  ]) {
    assertExcludes(
      captureDocumentAuthority,
      forbidden,
      "runtime-web document-authority request capture",
      counter,
    );
  }
  const authenticateDocumentAuthority = collectFunctionText(
    runtimeAuthority,
    "packages/runtime-web/src/host-authority.ts",
    "authenticateRuntimeWebHostDocumentAuthority",
  );
  let documentSequenceOffset = 0;
  for (const required of [
    'typeof handle !== "object" || handle === null',
    "const authority = HOST_AUTHORITIES.get(handle);",
    'authority.status !== "active"',
    "const captured = captureHostDocumentAuthorityInput(input);",
    "const current = HOST_AUTHORITIES.get(handle);",
    'current !== authority || current.status !== "active"',
    "if (captured === undefined)",
    "captured.documentId !== current.documentId",
    "captured.revision !== current.revision",
    'return Object.freeze({ status: "authenticated" });',
  ]) {
    counter.value += 1;
    const position = authenticateDocumentAuthority.indexOf(required, documentSequenceOffset);
    if (position === -1) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        "runtime-web document authentication lost its reviewed fail-closed ordering.",
        { expected: required },
      );
    }
    documentSequenceOffset = position + required.length;
  }
  assertEqual(
    authenticateDocumentAuthority.split("captureHostDocumentAuthorityInput(input)").length - 1,
    1,
    "runtime-web document authentication must capture its request exactly once.",
    counter,
  );
  for (const forbidden of [
    "hostPorts:",
    "delegates:",
    "platform:",
    ".hostPorts",
    ".delegates",
    ".platform",
    "String(",
    "JSON.stringify(",
    "Object.keys(",
    "Reflect.",
  ]) {
    assertExcludes(
      authenticateDocumentAuthority,
      forbidden,
      "runtime-web document authentication",
      counter,
    );
  }

  const runtimeCoreSession = files.get("packages/runtime-core/src/headless-session.ts").text;
  for (const required of [
    "readonly hostAuthority: RuntimeHostPorts;",
    "hostAuthority: captured.hostPorts,",
    "authority.retainedGraph = undefined;",
  ]) {
    assertIncludes(
      runtimeCoreSession,
      required,
      "runtime-core exact host authority retention",
      counter,
    );
  }
  const captureHostAuthority = collectFunctionText(
    runtimeCoreSession,
    "packages/runtime-core/src/headless-session.ts",
    "captureHostAuthorityInput",
  );
  for (const required of [
    "const prototype = Reflect.getPrototypeOf(input);",
    "const keys = Reflect.ownKeys(input);",
    'keys.length !== 1 || keys[0] !== "hostPorts"',
    'Reflect.getOwnPropertyDescriptor(input, "hostPorts")',
    "!hostPorts.enumerable",
    '!("value" in hostPorts)',
    "return Object.freeze({ hostPorts: hostPorts.value });",
  ]) {
    assertIncludes(
      captureHostAuthority,
      required,
      "runtime-core host-authority request capture",
      counter,
    );
  }
  for (const forbidden of [
    "Reflect.ownKeys(hostPorts.value",
    "Reflect.get(hostPorts.value",
    "hostPorts.value.",
  ]) {
    assertExcludes(
      captureHostAuthority,
      forbidden,
      "runtime-core host-authority request capture",
      counter,
    );
  }
  const authenticateHostAuthority = collectFunctionText(
    runtimeCoreSession,
    "packages/runtime-core/src/headless-session.ts",
    "authenticateRuntimeHeadlessSessionHostAuthority",
  );
  assertEqual(
    authenticateHostAuthority.split("captureHostAuthorityInput(input)").length - 1,
    1,
    "runtime-core host authentication must capture its request exactly once.",
    counter,
  );
  assertEqual(
    authenticateHostAuthority.split("captured.hostPorts !== current.retainedGraph.hostAuthority")
      .length - 1,
    1,
    "runtime-core host authentication must perform one exact identity comparison.",
    counter,
  );
  let sequenceOffset = 0;
  for (const required of [
    'typeof handle !== "object" || handle === null',
    "const authority = SESSION_AUTHORITIES.get(handle);",
    'authority.status !== "live" || authority.retainedGraph === undefined',
    "const captured = captureHostAuthorityInput(input);",
    "const current = SESSION_AUTHORITIES.get(handle);",
    "current !== authority",
    "if (captured === undefined)",
    "captured.hostPorts !== current.retainedGraph.hostAuthority",
    'return Object.freeze({ status: "authenticated" });',
  ]) {
    counter.value += 1;
    const position = authenticateHostAuthority.indexOf(required, sequenceOffset);
    if (position === -1) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        "runtime-core host authentication lost its reviewed fail-closed ordering.",
        { expected: required },
      );
    }
    sequenceOffset = position + required.length;
  }
  for (const forbidden of [
    "hostPorts:",
    "Object.keys(captured.hostPorts",
    "Reflect.ownKeys(captured.hostPorts",
    "JSON.stringify(",
    "isDeepStrictEqual(",
    "deepEqual(",
    "captured.hostPorts.",
    "current.retainedGraph.hostAuthority.",
  ]) {
    assertExcludes(
      authenticateHostAuthority,
      forbidden,
      "runtime-core host authentication",
      counter,
    );
  }
  const runtimeCoreExports = collectIndexExports(
    files.get("packages/runtime-core/src/index.ts").text,
    "packages/runtime-core/src/index.ts",
  );
  for (const expected of ["authenticateRuntimeHeadlessSessionHostAuthority"]) {
    counter.value += 1;
    if (!runtimeCoreExports.runtime.includes(expected)) {
      fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", `runtime-core lost the ${expected} root export.`);
    }
  }
  for (const expected of [
    "RuntimeHeadlessSessionHostAuthorityInput",
    "RuntimeHeadlessSessionHostAuthorityResult",
  ]) {
    counter.value += 1;
    if (!runtimeCoreExports.types.includes(expected)) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        `runtime-core lost the ${expected} root type export.`,
      );
    }
  }

  let dynamicExecutableCalls = 0;
  const imports = [];
  for (const relativePath of [
    ...APPLICATION_SOURCE_PATHS,
    ...RUNTIME_WEB_SOURCE_PATHS,
    ...RUNTIME_CORE_SECURITY_SOURCE_PATHS,
  ]) {
    if (relativePath.endsWith(".css")) continue;
    const inspected = collectImportsAndDynamicCalls(files.get(relativePath).text, relativePath);
    dynamicExecutableCalls += inspected.dynamicExecutableCalls;
    imports.push(...inspected.imports.map((specifier) => ({ relativePath, specifier })));
  }
  assertEqual(
    dynamicExecutableCalls,
    0,
    "Production host/runtime-web source gained dynamic executable loading.",
    counter,
  );
  for (const { relativePath, specifier } of imports) {
    for (const forbidden of FORBIDDEN_PRODUCTION_IMPORTS) {
      counter.value += 1;
      if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) {
        fail(
          "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
          `${relativePath} imports forbidden production authority ${specifier}.`,
        );
      }
    }
  }

  const exports = collectIndexExports(files.get("packages/runtime-web/src/index.ts").text);
  exactArray(
    exports.runtime,
    [...RUNTIME_WEB_RUNTIME_EXPORTS].sort(),
    "runtime-web runtime exports",
    counter,
  );
  exactArray(
    exports.types,
    [...RUNTIME_WEB_TYPE_EXPORTS].sort(),
    "runtime-web type exports",
    counter,
  );
  return {
    dynamicExecutableCalls,
    productionImports: imports.length,
    runtimeExports: exports.runtime,
    typeExports: exports.types,
  };
}

function assertTraceability(files, counter) {
  const trace = parseJson(
    files.get("docs/proof/protocol-0.1.0-traceability.json").bytes,
    "canonical traceability ledger",
  );
  for (const expected of TRACE_RULES) {
    const rule = trace[expected.collection]?.find(({ id }) => id === expected.id);
    counter.value += 1;
    if (!rule) {
      fail(
        "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
        `Trace rule ${expected.id} is missing from ${expected.collection}.`,
      );
    }
    assertEqual(rule.section, expected.section, `${expected.id} section drifted.`, counter);
    exactArray(rule.owners ?? [], expected.owners, `${expected.id} owners`, counter);
    exactArray(rule.tests ?? [], expected.tests, `${expected.id} tests`, counter);
  }
}

function assertDependencyBoundary(files, counter) {
  const configuration = files.get("dependency-cruiser.config.cjs").text;
  const allowlistMatch = /"reference-host-web": \[([^\]]+)\]/u.exec(configuration);
  counter.value += 1;
  if (allowlistMatch === null) {
    fail("REFERENCE_HOST_SHELL_SOURCE_DRIFT", "Reference-host dependency allowlist is missing.");
  }
  const allowlist = [...allowlistMatch[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  exactArray(
    allowlist,
    ["runtime-core", "runtime-react", "runtime-web", "reference-catalog-web"],
    "Reference-host dependency allowlist",
    counter,
  );
  for (const forbiddenRule of [
    "reference-host-has-no-authoring-or-publisher",
    "reference-host-has-no-test-support-or-facade",
    "reference-host-has-no-application-dependencies",
  ]) {
    assertIncludes(configuration, forbiddenRule, "Dependency boundary", counter);
  }
}

function assertTestInventory(files, counter) {
  let appFocusedCases = 0;
  for (const [relativePath, expected] of Object.entries(APP_TEST_TITLES)) {
    const actual = collectTestTitles(files.get(relativePath).text, relativePath);
    exactArray(actual, expected, `${relativePath} registrations`, counter);
    appFocusedCases += actual.length;
  }
  const runtimeActual = collectTestTitles(
    files.get("packages/runtime-web/test/host-authority.test.ts").text,
    "packages/runtime-web/test/host-authority.test.ts",
  );
  exactArray(runtimeActual, RUNTIME_WEB_TEST_TITLES, "runtime-web focused registrations", counter);
  const runtimeCoreSessionTitles = collectTestTitles(
    files.get("packages/runtime-core/test/headless-session.test.ts").text,
    "packages/runtime-core/test/headless-session.test.ts",
  );
  exactArray(
    runtimeCoreSessionTitles.slice(0, RUNTIME_CORE_SECURITY_TEST_TITLES.length),
    RUNTIME_CORE_SECURITY_TEST_TITLES,
    "runtime-core M05-T07 host-authority registrations",
    counter,
  );
  const runtimeCoreMaterializationTitles = collectTestTitles(
    files.get("packages/runtime-core/test/headless-materialization.test.ts").text,
    "packages/runtime-core/test/headless-materialization.test.ts",
  );
  const runtimeCoreFocusedCases =
    runtimeCoreSessionTitles.length + runtimeCoreMaterializationTitles.length;
  assertEqual(
    runtimeCoreFocusedCases,
    55,
    "runtime-core focused headless-session inventory drifted.",
    counter,
  );
  const appCompilerNegativeCases = countCompilerNegativeCases(
    files.get("apps/reference-host-web/test/public-api.types.ts").text,
  );
  const runtimeCompilerNegativeCases = countCompilerNegativeCases(
    files.get("packages/runtime-web/test/host-authority.types.ts").text,
  );
  const runtimeCoreCompilerNegativeCases = countCompilerNegativeCases(
    files.get("packages/runtime-core/test/headless-session.types.ts").text,
  );
  assertEqual(appCompilerNegativeCases, 6, "App compiler-negative inventory drifted.", counter);
  assertEqual(
    runtimeCompilerNegativeCases,
    14,
    "runtime-web compiler-negative inventory drifted.",
    counter,
  );
  assertEqual(
    runtimeCoreCompilerNegativeCases,
    33,
    "runtime-core compiler-negative inventory drifted.",
    counter,
  );
  const rootMutationTests = collectTestTitles(
    files.get("tests/reference-host-web-shell.test.mjs").text,
    "tests/reference-host-web-shell.test.mjs",
  ).length;
  counter.value += 1;
  if (rootMutationTests < 18) {
    fail(
      "REFERENCE_HOST_SHELL_SOURCE_DRIFT",
      "M05-T07 root hostile/mutation inventory fell below the reviewed minimum.",
      { rootMutationTests },
    );
  }
  return {
    appFocusedCases,
    runtimeFocusedCases: runtimeActual.length,
    runtimeCoreFocusedCases,
    runtimeCoreSecurityCases: RUNTIME_CORE_SECURITY_TEST_TITLES.length,
    focusedCases: appFocusedCases + runtimeActual.length + runtimeCoreFocusedCases,
    appCompilerNegativeCases,
    runtimeCompilerNegativeCases,
    runtimeCoreCompilerNegativeCases,
    compilerNegativeCases:
      appCompilerNegativeCases + runtimeCompilerNegativeCases + runtimeCoreCompilerNegativeCases,
    rootMutationTests,
  };
}

async function assertPrerequisites(workspaceRoot) {
  const entries = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes = await readRegularFile(
      path.join(workspaceRoot, prerequisite.path),
      "REFERENCE_HOST_SHELL_PREREQUISITE_MISSING",
      "REFERENCE_HOST_SHELL_PREREQUISITE_UNSAFE",
      MAX_ARTIFACT_BYTES,
    );
    const digest = sha256(bytes);
    if (digest !== prerequisite.sha256) {
      fail(
        "REFERENCE_HOST_SHELL_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite bytes changed.`,
        { expected: prerequisite.sha256, actual: digest },
      );
    }
    const artifact = parseJson(
      bytes,
      `${prerequisite.task} prerequisite`,
      "REFERENCE_HOST_SHELL_PREREQUISITE_DRIFT",
    );
    if (prerequisite.result !== undefined && artifact.result !== prerequisite.result) {
      fail(
        "REFERENCE_HOST_SHELL_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite result changed.`,
      );
    }
    if (prerequisite.profile !== undefined && artifact.profile !== prerequisite.profile) {
      fail(
        "REFERENCE_HOST_SHELL_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite profile changed.`,
      );
    }
    entries.push(
      Object.freeze({
        task: prerequisite.task,
        path: prerequisite.path,
        sha256: `sha256:${prerequisite.sha256}`,
        ...(prerequisite.profile === undefined ? {} : { profile: prerequisite.profile }),
        result: prerequisite.result,
      }),
    );
  }
  return Object.freeze(entries);
}

async function readTrackedFiles(workspaceRoot) {
  const files = await readPathMap(workspaceRoot, REFERENCE_HOST_WEB_SHELL_TRACKED_PATHS);
  return Object.freeze(
    REFERENCE_HOST_WEB_SHELL_TRACKED_PATHS.map((relativePath) => {
      const entry = files.get(relativePath);
      return Object.freeze({
        path: relativePath,
        bytes: entry.bytes.length,
        sha256: `sha256:${sha256(entry.bytes)}`,
      });
    }),
  );
}

async function listBuildFiles(root, current = root) {
  const directoryEntries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of directoryEntries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  )) {
    const absolutePath = path.join(current, entry.name);
    const status = await lstat(absolutePath);
    if (status.isSymbolicLink()) {
      fail("REFERENCE_HOST_SHELL_BUILD_UNSAFE", "Vite output contains a symlink.");
    }
    if (status.isDirectory()) {
      files.push(...(await listBuildFiles(root, absolutePath)));
      continue;
    }
    if (!status.isFile()) {
      fail("REFERENCE_HOST_SHELL_BUILD_UNSAFE", "Vite output contains a non-file entry.");
    }
    const bytes = await readFile(absolutePath);
    files.push(
      Object.freeze({
        path: path.relative(root, absolutePath).split(path.sep).join("/"),
        bytes: bytes.length,
        sha256: `sha256:${sha256(bytes)}`,
        content: bytes,
      }),
    );
  }
  return files;
}

async function runViteBuild(workspaceRoot, outputDirectory) {
  const viteExecutable = path.join(workspaceRoot, "node_modules/.bin/vite");
  const applicationRoot = path.join(workspaceRoot, "apps/reference-host-web");
  const child = spawn(
    viteExecutable,
    ["build", "--outDir", outputDirectory, "--emptyOutDir", "--logLevel", "error"],
    {
      cwd: applicationRoot,
      env: { ...process.env, NO_COLOR: "1" },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const [code, signal] = await once(child, "close");
  if (code !== 0 || signal !== null) {
    fail("REFERENCE_HOST_SHELL_BUILD_FAILED", "Independent Vite build failed.", {
      code,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8").slice(-2_000),
      stderr: Buffer.concat(stderr).toString("utf8").slice(-2_000),
    });
  }
  const files = await listBuildFiles(outputDirectory);
  const publicFiles = files.map(({ content: _content, ...entry }) => Object.freeze(entry));
  const index = files.find(({ path: relativePath }) => relativePath === "index.html");
  if (index === undefined) {
    fail("REFERENCE_HOST_SHELL_BUILD_DRIFT", "Independent Vite build lost index.html.");
  }
  const indexText = index.content.toString("utf8");
  if (
    !indexText.includes('id="desen-reference-host-root"') ||
    indexText.includes("/src/main.tsx")
  ) {
    fail(
      "REFERENCE_HOST_SHELL_BUILD_DRIFT",
      "Built HTML no longer exposes only the compiled dedicated host entry.",
    );
  }
  if (
    publicFiles.some(({ path: relativePath }) => relativePath.endsWith(".map")) ||
    !publicFiles.some(({ path: relativePath }) => relativePath.endsWith(".js"))
  ) {
    fail(
      "REFERENCE_HOST_SHELL_BUILD_DRIFT",
      "Independent Vite output contains source maps or no executable application asset.",
    );
  }
  const aggregateSha256 = sha256(Buffer.from(JSON.stringify(publicFiles)));
  return Object.freeze({
    files: Object.freeze(publicFiles),
    aggregateSha256,
  });
}

async function buildIndependentViteInventory(workspaceRoot) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t07-"));
  try {
    const first = await runViteBuild(workspaceRoot, path.join(temporaryRoot, "first"));
    const second = await runViteBuild(workspaceRoot, path.join(temporaryRoot, "second"));
    if (
      first.aggregateSha256 !== second.aggregateSha256 ||
      JSON.stringify(first.files) !== JSON.stringify(second.files)
    ) {
      fail(
        "REFERENCE_HOST_SHELL_BUILD_NONDETERMINISTIC",
        "Two independent Vite builds produced different output inventories.",
      );
    }
    return Object.freeze({
      tool: "vite@8.1.5",
      command: "vite build --outDir <isolated-directory> --emptyOutDir --logLevel error",
      independentBuilds: 2,
      deterministic: true,
      fileCount: first.files.length,
      aggregateSha256: `sha256:${first.aggregateSha256}`,
      files: first.files,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function artifactBytes(artifact) {
  const formatted = await format(JSON.stringify(artifact), { parser: "json" });
  return Buffer.from(formatted, "utf8");
}

function createArtifact({ prerequisites, trackedFiles, inventory, build }) {
  return deepFreeze({
    schemaVersion: 1,
    task: "M05-T07",
    result: "PASS",
    profile: "desen-reference-host-web-shell-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites,
    claim: {
      independentlyBuiltApplication: true,
      dedicatedDesenReactRoot: true,
      explicitNinePortHostBoundary: true,
      staticHostFailureSurface: true,
      rawRootErrorTelemetry: false,
      arbitraryManagedReactTreeInput: false,
      handwrittenManagedTreeFullyAudited: false,
      officialSignInExecuted: false,
    },
    hostShell: {
      package: "@desen/reference-host-web",
      build: {
        tool: build.tool,
        independentBuilds: build.independentBuilds,
        deterministic: build.deterministic,
        fileCount: build.fileCount,
        aggregateSha256: build.aggregateSha256,
        files: build.files,
      },
      composition: {
        applicationStates: ["booting", "surface", "unavailable"],
        managedInput: "RuntimeReactLiveSurfaceInput",
        liveRenderer: "useRuntimeReactSurface",
        productionBoundary: "RuntimeReactSurfaceBoundary",
        arbitraryReactChildren: false,
        capabilitySpecificComposition: false,
        finalSourceImportAuditOwner: "M05-T09",
      },
      rootPolicy: {
        dedicatedClientRoot: true,
        onCaughtError: "ignoreRuntimeReactRootCaughtError",
        onUncaughtError: "fixed-redacted-host-diagnostic",
        onRecoverableError: "fixed-redacted-host-diagnostic",
        rawErrorInspected: false,
        rawErrorForwarded: false,
        uncaughtFailureTerminallyRevokesAuthorities: true,
        terminalFencePrecedesObservability: true,
        fullRootUnmountFailure: "fixed-redacted-host-diagnostic",
        failedUnmountRetainsContainerClaim: true,
        idempotentDisposal: true,
      },
      recovery: {
        authorityInputs: ["session", "registry", "catalogSet", "hostAuthority"],
        hostAuthorityAuthentication:
          "exact-session-handle-and-original-host-port-aggregate-identity",
        hostAuthorityAuthenticationReturnsPorts: false,
        hostAuthorityAuthenticationReflectsIntoPorts: false,
        adapterAuthorityAuthentication: "exact-current-snapshot-and-catalog-set",
        documentAuthorityAuthentication:
          "exact-active-runtime-web-authority-and-session-document-revision",
        registryAuthorityAuthentication: "factory-authenticated-runtime-react-registry-handle",
        activationCommitAfterAllAuthenticators: true,
        replacementReentryFence: true,
        ordinaryPublicationChangesKey: false,
        explicitRetryChangesKey: true,
        authorityReplacementChangesKey: true,
        bundleOrRevisionInputChannel: false,
        rootLocalIsolation: true,
      },
    },
    browserHostAuthority: {
      package: "@desen/runtime-web",
      ports: [
        "navigation",
        "storage",
        "operations",
        "resources",
        "tokens",
        "context",
        "environment",
        "clock",
        "diagnostics",
      ],
      callbackCount: 14,
      capturedBy: "createRuntimeHostPorts",
      constructionInvokesCallbacks: false,
      navigationIdentity: "exact-document-and-revision",
      documentAuthorityAuthentication: "exact-active-authority-document-and-revision-pair",
      documentAuthorityAuthenticationReturnsExecutableAuthority: false,
      environmentBoundary: "bounded-detached-frozen-json",
      clockBoundary: "nondecreasing-finite-epoch-milliseconds",
      terminalCallbackFence: true,
      channelFetchingClaimed: false,
      indexedDbActivationClaimed: false,
      lastKnownGoodClaimed: false,
    },
    publicApi: {
      runtimeExports: inventory.runtimeExports,
      typeExports: inventory.typeExports,
    },
    evidence: {
      focusedScripts: [
        "pnpm --filter @desen/runtime-core typecheck",
        "pnpm --filter @desen/runtime-core test:headless-sign-in",
        "pnpm --filter @desen/runtime-web test:host-authority",
        "pnpm --filter @desen/reference-host-web test:shell",
      ],
      tests: inventory.tests,
      sourceAssertions: inventory.sourceAssertions,
      productionImports: inventory.productionImports,
      dynamicExecutableImports: inventory.dynamicExecutableCalls,
      trackedFiles,
      traceability: {
        canonicalTrace: TRACE_RULES.map(({ collection, id, section, disposition }) => ({
          collection,
          id,
          section,
          disposition,
        })),
        normativeStatusChanges: [],
        proofClaimStatusChanges: [],
        productionRuntimeConformance: "PLANNED",
        proofClaims: {
          "P-06": "PARTIAL",
          "P-07": "NOT_PROVEN",
          "P-17": "PARTIAL",
        },
      },
      historicalArtifactsRewritten: false,
    },
    nonclaims: [
      "official-derived sign-in Bundle execution",
      "reference React adapter registry execution",
      "real sign-in operation, pending, failure, retry, success, or navigation flow",
      "final AST and resolved-import proof of no handwritten managed-screen composition",
      "G05 closure",
      "channel fetching or exact package installation",
      "IndexedDB activation, atomic commit, restart recovery, or last-known-good behavior",
      "Desen App parity",
      "browser end-to-end conformance",
      "native, iOS, Android, SwiftUI, or Compose runtime support",
    ],
  });
}

/**
 * Performs static, prerequisite, traceability, and focused-inventory inspection without building.
 *
 * This entry point exists for isolated hostile mutation workspaces. Production generate/verify
 * always call the complete builder, which additionally runs two clean independent Vite builds.
 */
export async function inspectReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "inspect");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const prerequisitePaths = new Set(REFERENCE_HOST_WEB_SHELL_PREREQUISITE_PATHS);
  const files = await readPathMap(
    workspaceRoot,
    REFERENCE_HOST_WEB_SHELL_INSPECTION_PATHS.filter(
      (relativePath) => !prerequisitePaths.has(relativePath),
    ),
  );
  await assertPrerequisites(workspaceRoot);
  const counter = { value: 0 };
  assertManifestSemantics(files, counter);
  const production = assertProductionSemantics(files, counter);
  assertTraceability(files, counter);
  assertDependencyBoundary(files, counter);
  const tests = assertTestInventory(files, counter);
  return deepFreeze({
    sourceAssertions: counter.value,
    tests,
    ...production,
  });
}

/** Builds complete deterministic M05-T07 evidence, including two isolated Vite outputs. */
export async function buildReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "build");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const [inventory, prerequisites, trackedFiles, build] = await Promise.all([
    inspectReferenceHostWebShellEvidence({ workspaceRoot }),
    assertPrerequisites(workspaceRoot),
    readTrackedFiles(workspaceRoot),
    buildIndependentViteInventory(workspaceRoot),
  ]);
  const artifact = createArtifact({ prerequisites, trackedFiles, inventory, build });
  const bytes = await artifactBytes(artifact);
  return Object.freeze({
    artifact,
    artifactBytes: bytes,
    artifactSha256: sha256(bytes),
  });
}

function verifyProofDocument(text, artifactSha256) {
  const artifactReference = "`docs/proof/artifacts/reference-host-web-0.1.0-shell.json`";
  const shaReference = `sha256:${artifactSha256}`;
  const pathCount = text.split(artifactReference).length - 1;
  const shaCount = text.split(shaReference).length - 1;
  if (
    !text.includes("## Evidence artifact") ||
    pathCount !== 1 ||
    shaCount !== 1 ||
    text.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "REFERENCE_HOST_SHELL_DOCUMENTATION_DRIFT",
      "M05-T07 proof document lost its unique exact artifact/SHA location.",
      { pathCount, shaCount },
    );
  }
}

/** Verifies the unique human-readable M05-T07 artifact and digest location. */
export function verifyReferenceHostWebShellProofDocument(text, artifactSha256) {
  if (
    typeof text !== "string" ||
    typeof artifactSha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(artifactSha256)
  ) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      "M05-T07 proof-document verification requires text and one lowercase SHA-256.",
    );
  }
  verifyProofDocument(text, artifactSha256);
  return Object.freeze({ result: "PASS", exactReferences: 1 });
}

/** Verifies stored M05-T07 bytes, semantics, independent builds, and human-readable pin. */
export async function verifyReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "artifactBytes", "proofPath", "proofDocumentText"],
    "verify",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedArtifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  if (artifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      "M05-T07 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildReferenceHostWebShellEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  const stored =
    injectedArtifactBytes ??
    (await readRegularFile(
      artifactPath ?? DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH,
      "REFERENCE_HOST_SHELL_ARTIFACT_MISSING",
      "REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE",
      MAX_ARTIFACT_BYTES,
    ));
  if (!stored.equals(built.artifactBytes)) {
    fail(
      "REFERENCE_HOST_SHELL_ARTIFACT_DRIFT",
      "M05-T07 artifact bytes differ from the current deterministic build.",
      { expected: built.artifactSha256, actual: sha256(stored) },
    );
  }
  const storedArtifact = parseJson(
    stored,
    "M05-T07 artifact",
    "REFERENCE_HOST_SHELL_ARTIFACT_DRIFT",
  );
  if (JSON.stringify(storedArtifact) !== JSON.stringify(built.artifact)) {
    fail(
      "REFERENCE_HOST_SHELL_ARTIFACT_DRIFT",
      "M05-T07 artifact semantics differ from the current deterministic build.",
    );
  }
  const proofText =
    proofDocumentText ??
    (
      await readRegularFile(
        proofPath ?? DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH,
        "REFERENCE_HOST_SHELL_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SHELL_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      )
    ).toString("utf8");
  verifyProofDocument(proofText, built.artifactSha256);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    sourceAssertions: built.artifact.evidence.sourceAssertions,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    buildFiles: built.artifact.hostShell.build.fileCount,
    buildAggregateSha256: built.artifact.hostShell.build.aggregateSha256,
    exactDocumentationReferences: 1,
  });
}

/** Atomically writes the exact current deterministic M05-T07 receipt. */
export async function writeReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildReferenceHostWebShellEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch {
    fail("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE", "Atomic M05-T07 artifact write failed safely.");
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    buildFiles: built.artifact.hostShell.build.fileCount,
  });
}
