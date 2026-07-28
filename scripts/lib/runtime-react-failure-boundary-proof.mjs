import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_RELATIVE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const PROTOCOL_FINDINGS_RELATIVE_PATH = "docs/plan/PROTOCOL-FINDINGS.md";
const MAX_INPUT_BYTES = 4_000_000;
const MAX_ARTIFACT_BYTES = 2_000_000;
const MAX_DOCUMENT_BYTES = 2_000_000;

/** Absolute path to the current deterministic M05-T06 failure-boundary artifact. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable M05-T06 proof. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Absolute path to the M05-T06 Proof Matrix projection. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

/** Absolute path to the N-037 normative projection. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_RELATIVE_PATH,
);

/** Absolute path to the PF-055 implementation finding. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  PROTOCOL_FINDINGS_RELATIVE_PATH,
);

/** Files whose exact bytes make up the current M05-T06 implementation claim. */
export const RUNTIME_REACT_FAILURE_BOUNDARY_TRACKED_PATHS = Object.freeze([
  "packages/runtime-react/package.json",
  "packages/runtime-react/src/adapter-error-boundary.tsx",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/interactions.tsx",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/src/root-error-policy.ts",
  "packages/runtime-react/src/surface-boundary.tsx",
  "packages/runtime-react/test/failure-boundary.test.tsx",
  "packages/runtime-react/test/failure-boundary.types.ts",
  "scripts/generate-runtime-react-failure-boundary-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/runtime-react-failure-boundary-proof.mjs",
  "scripts/lib/runtime-react-reconciliation-diagnostics-proof.mjs",
  "scripts/verify-runtime-react-failure-boundary.mjs",
  "tests/runtime-react-failure-boundary.test.mjs",
  "tests/runtime-react-reconciliation-diagnostics.test.mjs",
]);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T05",
    path: "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
    sha256: "sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb",
    profile: "desen-runtime-react-reconciliation-diagnostics-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T02",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json",
    sha256: "sha256:f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    profile: "desen-runtime-react-resolved-props-slots-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T09",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "sha256:7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
    result: "PASS",
  }),
  Object.freeze({
    task: "M02-T05",
    path: "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
    sha256: "sha256:e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b",
    profile: "desen-diagnostics-json-pointer-v1",
  }),
  Object.freeze({
    task: "M02-T02",
    path: "docs/proof/artifacts/protocol-0.1.0-traceability.json",
    sha256: "sha256:749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514",
    protocol: "0.1.0",
    result: "PASS",
  }),
]);

/** Prerequisite paths exported for isolated mutation-test workspaces. */
export const RUNTIME_REACT_FAILURE_BOUNDARY_PREREQUISITE_PATHS = Object.freeze(
  EXPECTED_PREREQUISITES.map((entry) => entry.path),
);

const PUBLIC_RUNTIME_EXPORTS = Object.freeze([
  "RuntimeReactSurfaceBoundary",
  "ignoreRuntimeReactRootCaughtError",
]);

const PUBLIC_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterFailure",
  "RuntimeReactComponentAdapterFailure",
  "RuntimeReactRootCaughtErrorHandler",
  "RuntimeReactSurfaceBoundaryProps",
  "RuntimeReactSurfaceBoundaryResult",
  "RuntimeReactSurfaceFailure",
  "RuntimeReactSurfaceFailureRenderer",
  "RuntimeReactUnattributedAdapterFailure",
]);

const PUBLIC_FAILURE_FIELDS = Object.freeze([
  "adapterKind",
  "behaviorId",
  "capabilityId",
  "code",
  "runtimeNodeId",
  "sourceNodeId",
]);

const NONCLAIMS = Object.freeze([
  "React event-handler exception containment",
  "arbitrary asynchronous exception containment",
  "server-render error-boundary containment",
  "node-local sibling continuation when React cannot expose safe failure provenance",
  "automatic retry after ordinary result, publication, or reconciliation-key changes",
  "raw caught-error suppression for non-DESEN code in a shared React root",
  "host onUncaughtError or onRecoverableError policy",
  "failure-branch cleanup carrier classification during full React root unmount",
  "validation of an arbitrary untrusted object passed as the boundary result",
  "cross-copy private carrier recognition when multiple runtime-react module instances share one tree",
]);

/** Controlled deterministic-evidence failure for M05-T06. */
export class RuntimeReactFailureBoundaryEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactFailureBoundaryEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactFailureBoundaryEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const member of value) freezeJson(member);
    return Object.freeze(value);
  }
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `M05-T06 ${label} options must be a non-Proxy plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `M05-T06 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `M05-T06 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "FAILURE_BOUNDARY_OPTIONS_INVALID",
        `M05-T06 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "FAILURE_BOUNDARY_OPTIONS_INVALID",
        `M05-T06 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("FAILURE_BOUNDARY_OPTIONS_INVALID", `M05-T06 ${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBuffer(value, label) {
  if (value === undefined) return undefined;
  if (utilTypes.isProxy(value) || !Buffer.isBuffer(value) || value.length > MAX_ARTIFACT_BYTES) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `M05-T06 ${label} must be a bounded non-Proxy Buffer.`,
    );
  }
  return Buffer.from(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("FAILURE_BOUNDARY_OPTIONS_INVALID", `M05-T06 ${label} must be a non-Proxy function.`);
  }
  return value;
}

function optionalText(value, label) {
  if (
    value !== undefined &&
    (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_DOCUMENT_BYTES)
  ) {
    fail("FAILURE_BOUNDARY_OPTIONS_INVALID", `M05-T06 ${label} must be bounded UTF-8 text.`);
  }
  return value;
}

async function resolveWorkspaceRoot(value) {
  const candidate = path.resolve(value ?? WORKSPACE_ROOT);
  try {
    const entry = await lstat(candidate, { bigint: true });
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail(
        "FAILURE_BOUNDARY_INPUT_UNSAFE",
        `M05-T06 workspace root must be a real directory: ${candidate}.`,
      );
    }
    return await realpath(candidate);
  } catch (error) {
    if (error instanceof RuntimeReactFailureBoundaryEvidenceError) throw error;
    fail("FAILURE_BOUNDARY_INPUT_MISSING", `M05-T06 workspace root is unavailable: ${candidate}.`, {
      cause: String(error),
    });
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

async function readRegularFile(filePath, missingCode, unsafeCode, maximumBytes = MAX_INPUT_BYTES) {
  let pathEntry;
  try {
    pathEntry = await lstat(filePath, { bigint: true });
  } catch (error) {
    fail(missingCode, `M05-T06 evidence input is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
    fail(unsafeCode, `M05-T06 evidence input must be a regular non-symlink file: ${filePath}.`);
  }
  if (pathEntry.size > BigInt(maximumBytes)) {
    fail(unsafeCode, `M05-T06 evidence input exceeds its byte limit: ${filePath}.`);
  }

  let handle;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(pathEntry, before)) {
      fail(unsafeCode, `M05-T06 evidence input changed before its safe read: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.length !== Number(before.size) ||
      !sameFileState(before, after) ||
      after.size > BigInt(maximumBytes)
    ) {
      fail(unsafeCode, `M05-T06 evidence input changed during its safe read: ${filePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeReactFailureBoundaryEvidenceError) throw error;
    fail(unsafeCode, `M05-T06 evidence input could not be read safely: ${filePath}.`, {
      cause: String(error),
    });
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // A primary controlled read error remains authoritative.
      }
    }
  }
}

function parseJson(bytes, label, code = "FAILURE_BOUNDARY_INPUT_INVALID") {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code, `M05-T06 ${label} is not valid JSON.`);
  }
}

function countMatches(text, expression) {
  return [...text.matchAll(expression)].length;
}

function requireNeedle(text, needle, label, counter) {
  counter.value += 1;
  if (!text.includes(needle)) {
    fail("FAILURE_BOUNDARY_SOURCE_DRIFT", `M05-T06 ${label} lost required reviewed semantics.`, {
      needle,
    });
  }
}

function forbidNeedle(text, needle, label, counter) {
  counter.value += 1;
  if (text.includes(needle)) {
    fail(
      "FAILURE_BOUNDARY_SOURCE_DRIFT",
      `M05-T06 ${label} gained forbidden or overclaimed semantics.`,
      { needle },
    );
  }
}

function assertImplementationSemantics(files) {
  const adapter = files.get("packages/runtime-react/src/adapter-error-boundary.tsx");
  const surface = files.get("packages/runtime-react/src/surface-boundary.tsx");
  const rootPolicy = files.get("packages/runtime-react/src/root-error-policy.ts");
  const interactions = files.get("packages/runtime-react/src/interactions.tsx");
  const renderPlan = files.get("packages/runtime-react/src/render-plan.tsx");
  const index = files.get("packages/runtime-react/src/index.ts");
  const focusedTests = files.get("packages/runtime-react/test/failure-boundary.test.tsx");
  const typeTests = files.get("packages/runtime-react/test/failure-boundary.types.ts");
  const packageJsonText = files.get("packages/runtime-react/package.json");
  const counter = { value: 0 };

  requireNeedle(
    adapter,
    "export interface RuntimeReactComponentAdapterFailure",
    "adapter failure contract",
    counter,
  );
  requireNeedle(
    adapter,
    "export interface RuntimeReactUnattributedAdapterFailure",
    "unattributed failure contract",
    counter,
  );
  requireNeedle(
    adapter,
    "RuntimeReactComponentAdapterFailure | RuntimeReactUnattributedAdapterFailure",
    "closed public failure union",
    counter,
  );
  forbidNeedle(
    adapter,
    "RuntimeReactBehaviorAdapterFailure",
    "closed public failure union",
    counter,
  );
  requireNeedle(
    adapter,
    "const CLASSIFIED_ADAPTER_THROWS = new WeakSet",
    "carrier branding",
    counter,
  );
  requireNeedle(adapter, "const FAILURE_RENDERER_THROWS = new WeakSet", "host branding", counter);
  requireNeedle(
    adapter,
    "const UNATTRIBUTED_MANAGED_TREE_THROWS = new WeakSet",
    "unattributed branding",
    counter,
  );
  requireNeedle(
    adapter,
    'this.props.canAttributeRawError && this.props.adapterKind === "component"',
    "leaf-only exact attribution",
    counter,
  );
  requireNeedle(
    adapter,
    "RUNTIME_REACT_UNATTRIBUTED_ADAPTER_FAILURE",
    "frozen null identity",
    counter,
  );
  forbidNeedle(adapter, "instanceof RuntimeReact", "hostile thrown-value handling", counter);

  requireNeedle(
    surface,
    "class RuntimeReactManagedBranchBoundary",
    "persistent managed branch",
    counter,
  );
  requireNeedle(surface, "class RuntimeReactHostBranchBoundary", "persistent host branch", counter);
  requireNeedle(
    surface,
    "class RuntimeReactSurfaceCoordinator",
    "whole-surface coordinator",
    counter,
  );
  requireNeedle(
    surface,
    "whole-surface profile refuses to blame",
    "honest whole-surface policy",
    counter,
  );
  requireNeedle(surface, "readonly recoveryKey?: string;", "explicit recovery authority", counter);
  requireNeedle(
    surface,
    "state.observedRecoveryKey === props.recoveryKey",
    "sticky recovery comparison",
    counter,
  );
  requireNeedle(
    surface,
    "readRuntimeReactClassifiedAdapterFailure(error) ??",
    "exact-or-null classification",
    counter,
  );
  requireNeedle(
    surface,
    "createRuntimeReactFailureRendererThrow(error)",
    "host cleanup provenance",
    counter,
  );
  requireNeedle(
    surface,
    "No generic component or placeholder is ever guessed.",
    "no placeholder policy",
    counter,
  );
  requireNeedle(
    surface,
    "Event-handler exceptions, arbitrary asynchronous work, and server rendering remain outside",
    "React boundary nonclaims",
    counter,
  );
  requireNeedle(
    surface,
    "redacting `onCaughtError` handler",
    "root integration limitation",
    counter,
  );
  requireNeedle(
    surface,
    "containing boundary remains mounted",
    "host cleanup carrier scope",
    counter,
  );

  requireNeedle(
    rootPolicy,
    "export type RuntimeReactRootCaughtErrorHandler",
    "root callback type",
    counter,
  );
  requireNeedle(
    rootPolicy,
    "export const ignoreRuntimeReactRootCaughtError",
    "root callback implementation",
    counter,
  );
  requireNeedle(rootPolicy, "void error;", "raw error non-inspection", counter);
  requireNeedle(rootPolicy, "void errorInfo;", "component stack non-inspection", counter);
  requireNeedle(rootPolicy, "dedicated DESEN-managed root", "root scope", counter);
  requireNeedle(
    rootPolicy,
    "Do not use this policy on a shared root",
    "shared-root nonclaim",
    counter,
  );

  requireNeedle(
    interactions,
    "canAttributeRawError: !input.hasManagedDescendants",
    "leaf-component classifier gate",
    counter,
  );
  requireNeedle(interactions, 'adapterKind: "behavior"', "behavior boundary presence", counter);
  requireNeedle(
    interactions,
    "canAttributeRawError: false",
    "behavior attribution refusal",
    counter,
  );
  requireNeedle(
    renderPlan,
    "hasManagedDescendants: Object.values(node.slots).some",
    "managed-descendant classification",
    counter,
  );

  for (const name of PUBLIC_RUNTIME_EXPORTS) {
    requireNeedle(index, name, `public runtime export ${name}`, counter);
  }
  for (const name of PUBLIC_TYPE_EXPORTS) {
    requireNeedle(index, name, `public type export ${name}`, counter);
  }
  forbidNeedle(index, "RuntimeReactBehaviorAdapterFailure", "public root type exports", counter);

  for (const title of [
    "offers a dedicated-root caught-error policy that never inspects raw React payloads",
    "keeps unknown component capability as an explicit all-or-nothing preflight failure",
    "keeps unknown behavior capability outside adapters and outside ADAPTER_FAILURE",
    "contains an exact leaf-component exception at the whole surface with frozen redacted data",
    "does not guess behavior identity when a wrapper and its managed child share one boundary",
    "does not blame a live parent when a conditional child throws during removal",
    "preserves host provenance when failure UI throws while being removed",
    "classifies a hostile thrown Proxy without invoking its prototype trap",
    "keeps a failure sticky until the host explicitly authorizes recovery",
    "does not turn a reconciliation-key change into an implicit crash retry",
    "does not classify Suspense thenables as adapter failures",
    "propagates a host failure-renderer exception without blaming an ancestor adapter",
    "does not wrap a nested host-failure carrier again inside outer failure UI",
    "documents the React SSR boundary by propagating adapter errors to the server host",
  ]) {
    requireNeedle(focusedTests, `it("${title}"`, `focused case ${title}`, counter);
  }
  requireNeedle(
    focusedTests,
    "Reflect.ownKeys(failures[0].failure).sort()",
    "closed redacted payload",
    counter,
  );
  requireNeedle(
    focusedTests,
    "not.toMatch(/error|stack|cause|componentStack/u)",
    "raw payload exclusion",
    counter,
  );
  requireNeedle(
    focusedTests,
    "expect((propagated as { readonly cause?: unknown }).cause).toBe(hostError);",
    "host cause preservation",
    counter,
  );
  requireNeedle(typeTests, 'const kind: "component" | null', "public type narrowing", counter);
  forbidNeedle(typeTests, "RuntimeReactBehaviorAdapterFailure", "public type narrowing", counter);

  let packageJson;
  try {
    packageJson = JSON.parse(packageJsonText);
  } catch {
    fail("FAILURE_BOUNDARY_SOURCE_DRIFT", "M05-T06 runtime-react package metadata is invalid.");
  }
  counter.value += 1;
  if (
    packageJson?.name !== "@desen/runtime-react" ||
    packageJson?.scripts?.["test:failure-boundary"] !== "vitest run test/failure-boundary.test.tsx"
  ) {
    fail(
      "FAILURE_BOUNDARY_SOURCE_DRIFT",
      "M05-T06 focused package script moved, changed, or became ambiguous.",
    );
  }

  const productionFiles = [adapter, surface, rootPolicy, interactions, renderPlan, index];
  const dynamicExecutableImports = productionFiles.reduce(
    (total, text) => total + countMatches(text, /\bimport\s*\(/gu),
    0,
  );
  counter.value += 1;
  if (dynamicExecutableImports !== 0) {
    fail(
      "FAILURE_BOUNDARY_SOURCE_DRIFT",
      "M05-T06 production failure path gained dynamic executable loading.",
      { dynamicExecutableImports },
    );
  }

  const focusedTestCases = countMatches(focusedTests, /\bit\("/gu);
  const compilerNegativeCases = countMatches(typeTests, /@ts-expect-error/gu);
  const rootMutationTests = countMatches(
    files.get("tests/runtime-react-failure-boundary.test.mjs"),
    /\btest\("/gu,
  );
  if (focusedTestCases < 20 || compilerNegativeCases < 9 || rootMutationTests < 15) {
    fail(
      "FAILURE_BOUNDARY_SOURCE_DRIFT",
      "M05-T06 focused, compiler-negative, or root mutation inventory regressed.",
      { focusedTestCases, compilerNegativeCases, rootMutationTests },
    );
  }

  return Object.freeze({
    sourceAssertions: counter.value,
    dynamicExecutableImports,
    focusedTestCases,
    compilerNegativeCases,
    rootMutationTests,
  });
}

function assertPrerequisiteSemantics(prerequisite, artifact) {
  const valid =
    prerequisite.task === "M05-T05"
      ? artifact?.task === "M05-T05" &&
        artifact?.result === "PASS" &&
        artifact?.profile === "desen-runtime-react-reconciliation-diagnostics-v1"
      : prerequisite.task === "M05-T02"
        ? artifact?.task === "M05-T02" &&
          artifact?.result === "PASS" &&
          artifact?.profile === "desen-runtime-react-resolved-props-slots-v1"
        : prerequisite.task === "M04-T09"
          ? artifact?.task === "M04-T09" && artifact?.result === "PASS"
          : prerequisite.task === "M02-T05"
            ? artifact?.task === "M02-T05" &&
              artifact?.profile === "desen-diagnostics-json-pointer-v1"
            : artifact?.result === "PASS" && artifact?.protocol === "0.1.0";
  if (!valid) {
    fail(
      "FAILURE_BOUNDARY_PREREQUISITE_DRIFT",
      `M05-T06 prerequisite ${prerequisite.task} lost its reviewed semantics.`,
    );
  }
}

async function readPrerequisites(workspaceRoot) {
  for (const prerequisite of EXPECTED_PREREQUISITES) {
    const bytes = await readRegularFile(
      path.join(workspaceRoot, prerequisite.path),
      "FAILURE_BOUNDARY_PREREQUISITE_MISSING",
      "FAILURE_BOUNDARY_PREREQUISITE_UNSAFE",
      MAX_ARTIFACT_BYTES,
    );
    const actualSha256 = `sha256:${sha256(bytes)}`;
    if (actualSha256 !== prerequisite.sha256) {
      fail(
        "FAILURE_BOUNDARY_PREREQUISITE_DRIFT",
        `M05-T06 prerequisite ${prerequisite.task} bytes changed.`,
        { expected: prerequisite.sha256, actual: actualSha256 },
      );
    }
    assertPrerequisiteSemantics(
      prerequisite,
      parseJson(bytes, `prerequisite ${prerequisite.task}`),
    );
  }
}

async function readTrackedFiles(workspaceRoot) {
  const entries = await Promise.all(
    RUNTIME_REACT_FAILURE_BOUNDARY_TRACKED_PATHS.map(async (relativePath) => {
      const bytes = await readRegularFile(
        path.join(workspaceRoot, relativePath),
        "FAILURE_BOUNDARY_INPUT_MISSING",
        "FAILURE_BOUNDARY_INPUT_UNSAFE",
      );
      return Object.freeze({
        relativePath,
        bytes,
        text: bytes.toString("utf8"),
      });
    }),
  );
  return entries;
}

async function artifactBytes(artifact) {
  const formatted = await format(JSON.stringify(artifact), {
    endOfLine: "lf",
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
  });
  return Buffer.from(formatted, "utf8");
}

function sectionLines(markdown, heading, code) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail(code, `M05-T06 expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start, end === -1 ? lines.length : end);
}

function exactRow(markdown, id, code) {
  const rows = markdown.split(/\r?\n/u).filter((line) => line.startsWith(`| ${id} |`));
  if (rows.length !== 1) fail(code, `M05-T06 expected one exact ${id} row.`);
  return rows[0];
}

function assertExactArtifactPin(lines, artifactPath, artifactSha256, label) {
  const section = lines.join("\n");
  const pathToken = `\`${artifactPath}\``;
  const shaToken = `\`sha256:${artifactSha256}\``;
  if (
    section.split(pathToken).length - 1 !== 1 ||
    section.split(shaToken).length - 1 !== 1 ||
    section.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      `M05-T06 ${label} artifact path or SHA moved, changed, or became ambiguous.`,
    );
  }
}

function assertSectionNeedles(lines, needles, label) {
  const section = lines.join("\n");
  for (const needle of needles) {
    if (!section.includes(needle)) {
      fail(
        "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
        `M05-T06 ${label} lost required reviewed semantics.`,
        { needle },
      );
    }
  }
}

function verifyDocumentation({
  proofDocumentText,
  proofMatrixText,
  normativeCoverageText,
  findingsText,
  artifactSha256,
}) {
  const proofArtifactSection = sectionLines(
    proofDocumentText,
    "## Evidence artifact",
    "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
  );
  assertExactArtifactPin(
    proofArtifactSection,
    ARTIFACT_RELATIVE_PATH,
    artifactSha256,
    "human-readable proof",
  );
  assertSectionNeedles(
    proofDocumentText.split(/\r?\n/u),
    [
      "whole-surface fail-closed",
      "leaf component",
      "null identity",
      "two always-mounted sibling",
      "`recoveryKey`",
      "no placeholder",
      "`ignoreRuntimeReactRootCaughtError`",
      "full React-root unmount",
    ],
    "human-readable proof",
  );

  const matrixSection = sectionLines(
    proofMatrixText,
    "## M05-T06",
    "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
  );
  assertExactArtifactPin(
    matrixSection,
    path.basename(ARTIFACT_RELATIVE_PATH),
    artifactSha256,
    "Proof Matrix section",
  );

  const p17 = exactRow(proofMatrixText, "P-17", "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT");
  const p17Cells = p17.split("|").map((cell) => cell.trim());
  if (
    p17Cells[3] !== "M02-T13, M04-T13–M04-T17, M05-T06, M07-T04" ||
    p17Cells[4] !== "PARTIAL" ||
    !p17Cells[6]?.includes("M07-T04") ||
    p17Cells[6]?.includes("M05-T06") ||
    !p17.includes(path.basename(ARTIFACT_RELATIVE_PATH)) ||
    !p17.includes(`sha256:${artifactSha256}`)
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      "M05-T06 P-17 lost its exact PARTIAL status, remaining owner, artifact, or SHA.",
    );
  }

  const n037 = exactRow(normativeCoverageText, "N-037", "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT");
  const n037Cells = n037.split("|").map((cell) => cell.trim());
  if (
    n037Cells[4] !== "M05-T06" ||
    n037Cells[5] !== "TESTED" ||
    !n037.includes(ARTIFACT_RELATIVE_PATH) ||
    !n037.includes(`sha256:${artifactSha256}`)
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      "M05-T06 N-037 lost its exact TESTED owner, artifact, or SHA.",
    );
  }

  const findingSection = sectionLines(
    findingsText,
    "## PF-055 — React failure containment is whole-surface when exact origin is unavailable",
    "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
  );
  assertSectionNeedles(
    findingSection,
    [
      "- Status: OPEN",
      "Containment is whole-surface.",
      "every identity field",
      "trusted runtime results",
      "one deduplicated",
      "omitted `recoveryKey` deliberately means never retry",
      "cleanup during complete React-root",
      "M07-T04",
    ],
    "PF-055",
  );
}

function createArtifact(entries, inventory) {
  const files = entries.map((entry) =>
    Object.freeze({
      path: entry.relativePath,
      bytes: entry.bytes.length,
      sha256: `sha256:${sha256(entry.bytes)}`,
    }),
  );
  return freezeJson({
    schemaVersion: 1,
    task: "M05-T06",
    result: "PASS",
    profile: "desen-runtime-react-failure-boundary-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: EXPECTED_PREREQUISITES,
    claim: {
      wholeSurfaceFailClosed: true,
      safeNodeLocalSiblingContinuationClaimed: false,
      exactAttribution: "leaf-component-only",
      behaviorExactAttribution: false,
      nonLeafExactAttribution: false,
      cleanupExactAttribution: false,
      honestNullAttributionWhenOriginUnavailable: true,
      explicitUnknownCapabilityFailure: true,
      productionPlaceholderGuessing: false,
      rawAdapterPayloadExposed: false,
    },
    boundary: {
      package: "@desen/runtime-react",
      failureCode: "ADAPTER_FAILURE",
      containment: "whole-surface",
      publicVariants: ["component", "unattributed"],
      publicFailureFields: PUBLIC_FAILURE_FIELDS,
      rawPublicFields: [],
      identityPolicy: {
        exact: "leaf component with no managed DESEN descendants",
        unattributed:
          "behavior, non-leaf, descendant, removal, or other origin React cannot expose safely",
        unattributedIdentityValue: null,
      },
      provenanceBranches: {
        structure: "two-always-mounted-sibling-boundaries",
        managed: "RuntimeReactManagedBranchBoundary",
        host: "RuntimeReactHostBranchBoundary",
      },
      hostFailureRenderer: {
        selectedBy: "trusted-static-host-code",
        bundleOrCatalogAuthority: false,
        privateFreshCarrier: true,
        cause: "exact-host-thrown-value",
        classifiedAsAdapterFailure: false,
      },
      recovery: {
        mode: "sticky-after-adapter-failure",
        authority: "explicit-host-recoveryKey",
        implicitResultRetry: false,
        implicitPublicationRetry: false,
        implicitReconciliationKeyRetry: false,
      },
      unknownCapability: {
        phase: "all-or-nothing-preflight",
        adapterExecutionBeforeFailure: false,
        placeholder: false,
        hostFailureSurfaceRequired: true,
      },
      rootCaughtError: {
        handler: "ignoreRuntimeReactRootCaughtError",
        handlerType: "RuntimeReactRootCaughtErrorHandler",
        scope: "dedicated-DESEN-root-only",
        rawPayloadInspection: false,
        rawPayloadForwarding: false,
        sharedRootPolicyClaimed: false,
        referenceHostWiringOwner: "M05-T07",
      },
      integrationScope: {
        resultAuthority: "host-trusted-runtime-result",
        arbitraryUntrustedResultParser: false,
        moduleInstanceRequirement: "one-deduplicated-@desen/runtime-react-instance-per-React-tree",
        omittedRecoveryKey: "safe-never-retry",
        hostCleanupCarrier:
          "managed-to-failure-and-failure-to-managed-transitions-while-branch-boundary-mounted",
        fullRootUnmountCleanupOwner: "M05-T07-host-onUncaughtError-policy",
      },
    },
    publicApi: {
      runtimeExports: PUBLIC_RUNTIME_EXPORTS,
      typeExports: PUBLIC_TYPE_EXPORTS,
    },
    evidence: {
      focusedScript: "pnpm --filter @desen/runtime-react test:failure-boundary",
      tests: {
        focusedCases: inventory.focusedTestCases,
        compilerNegativeCases: inventory.compilerNegativeCases,
        rootMutationTests: inventory.rootMutationTests,
      },
      sourceAssertions: inventory.sourceAssertions,
      dynamicExecutableImports: inventory.dynamicExecutableImports,
      trackedFiles: files,
      verifierExecutionProfile: "static-source-package-prerequisite-and-focused-test-inventory",
      historicalArtifactsRewritten: false,
      traceability: {
        canonicalTrace: ["R-112", "R-113", "R-115", "A-012", "D-036"],
        normative: {
          id: "N-037",
          status: "TESTED",
          owners: "M05-T06",
        },
        proofClaim: {
          id: "P-17",
          status: "PARTIAL",
          remainingOwner: "M07-T04",
        },
        taskLocalApplicability: {
          id: "D-009",
          status: "DEFERRED",
          remainingOwner: "M06-T11",
        },
      },
    },
    nonclaims: NONCLAIMS,
  });
}

/**
 * Builds current M05-T06 evidence from exact source, test, package, and prerequisite bytes.
 *
 * @remarks The builder performs no dynamic import and executes no production adapter or test
 * callback. Focused tests are a separate quality-gate step; this artifact owns their exact source
 * and registration inventory.
 */
export async function buildRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "build");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const entries = await readTrackedFiles(workspaceRoot);
  const files = new Map(entries.map((entry) => [entry.relativePath, entry.text]));
  const inventory = assertImplementationSemantics(files);
  await readPrerequisites(workspaceRoot);
  const artifact = createArtifact(entries, inventory);
  const bytes = await artifactBytes(artifact);
  return Object.freeze({
    artifact,
    artifactBytes: bytes,
    artifactSha256: sha256(bytes),
  });
}

/** Verifies exact current M05-T06 artifact bytes against a fresh deterministic build. */
export async function verifyRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "workspaceRoot",
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "normativeCoveragePath",
      "normativeCoverageText",
      "findingsPath",
      "findingsText",
    ],
    "verify",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const injectedArtifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedArtifactBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  const normativeCoveragePath = optionalString(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  const normativeCoverageText = optionalText(
    options.normativeCoverageText,
    "normativeCoverageText",
  );
  const findingsPath = optionalString(options.findingsPath, "findingsPath");
  const findingsText = optionalText(options.findingsText, "findingsText");
  if (injectedArtifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      "M05-T06 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildRuntimeReactFailureBoundaryEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  const currentArtifactBytes =
    injectedArtifactBytes ??
    (await readRegularFile(
      injectedArtifactPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
      "FAILURE_BOUNDARY_ARTIFACT_MISSING",
      "FAILURE_BOUNDARY_ARTIFACT_UNSAFE",
      MAX_ARTIFACT_BYTES,
    ));
  const currentArtifact = parseJson(
    currentArtifactBytes,
    "artifact",
    "FAILURE_BOUNDARY_ARTIFACT_DRIFT",
  );
  if (
    !currentArtifactBytes.equals(built.artifactBytes) ||
    !isDeepStrictEqual(currentArtifact, built.artifact)
  ) {
    fail(
      "FAILURE_BOUNDARY_ARTIFACT_DRIFT",
      "M05-T06 artifact bytes or semantics do not match the current deterministic build.",
      {
        expected: built.artifactSha256,
        actual: sha256(currentArtifactBytes),
      },
    );
  }
  const [proofText, matrixText, normativeText, findingText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_MATRIX_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    normativeCoverageText ??
      readRegularFile(
        normativeCoveragePath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_NORMATIVE_COVERAGE_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    findingsText ??
      readRegularFile(
        findingsPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_FINDINGS_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation({
    proofDocumentText: proofText,
    proofMatrixText: matrixText,
    normativeCoverageText: normativeText,
    findingsText: findingText,
    artifactSha256: built.artifactSha256,
  });
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    sourceAssertions: built.artifact.evidence.sourceAssertions,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    publicRuntimeExports: built.artifact.publicApi.runtimeExports.length,
    publicTypeExports: built.artifact.publicApi.typeExports.length,
    normativeStatus: "N-037:TESTED",
    proofStatus: "P-17:PARTIAL",
    exactDocumentationReferences: 4,
  });
}

/** Atomically writes the exact current deterministic M05-T06 artifact. */
export async function writeRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const destinationPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactFailureBoundaryEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  try {
    await writeAtomicProofArtifact({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("FAILURE_BOUNDARY_ARTIFACT_UNSAFE", "Atomic M05-T06 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(destinationPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
  });
}
