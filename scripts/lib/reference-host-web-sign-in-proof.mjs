import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const PROTOCOL_API_URL = new URL("../../packages/protocol/dist/index.js", import.meta.url);
const VALIDATOR_API_URL = new URL("../../packages/validator/dist/index.js", import.meta.url);
const MAX_TRACKED_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 512 * 1024;
const MAX_BUILD_FILE_BYTES = 4 * 1024 * 1024;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;

const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const PROJECT_STATUS_RELATIVE_PATH = "PROJECT-STATUS.md";

/** Stable destination for the deterministic M05-T08 reference-host sign-in receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Human-readable claim document paired with the M05-T08 receipt. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Proof Matrix location that must contain one exact M05-T08 artifact pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

/** Project Status location that must contain one exact M05-T08 evidence pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROJECT_STATUS_PATH = path.join(
  WORKSPACE_ROOT,
  PROJECT_STATUS_RELATIVE_PATH,
);

const CRITICAL_PRODUCTION_FILES = Object.freeze([
  Object.freeze({
    path: "apps/reference-host-web/src/main.tsx",
    bytes: 1_263,
    sha256: "127e5390d86d9c14220aca28557f76ccc5c9198dbc8bbf6defb448b653721f0f",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/official-sign-in.ts",
    bytes: 14_181,
    sha256: "5a9893b8b031a1e4fa3c4f5bdcfcc1e420c3cfffe1493d5b57befb22fedd7ec3",
  }),
  Object.freeze({
    path: "apps/reference-host-web/src/sign-in-http-handler.ts",
    bytes: 13_595,
    sha256: "22b49c404efd2b39b84c2585dcff79574b8329eca11b9c459fe2d424c50645e9",
  }),
]);

const PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    profile: "desen-runtime-react-interactions-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T07",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
    sha256: "cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2",
    profile: "desen-reference-host-web-shell-v1",
    result: "PASS",
  }),
]);

/** Exact direct predecessor artifacts admitted by the M05-T08 proof. */
export const REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS = Object.freeze(
  PREREQUISITES.map(({ path: relativePath }) => relativePath),
);

const APPLICATION_SOURCE_PATHS = Object.freeze([
  "apps/reference-host-web/src/application.tsx",
  "apps/reference-host-web/src/browser-profile.ts",
  "apps/reference-host-web/src/failure-view.tsx",
  "apps/reference-host-web/src/host-ports.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/managed-surface.tsx",
  "apps/reference-host-web/src/official-sign-in.ts",
  "apps/reference-host-web/src/recovery-authority.ts",
  "apps/reference-host-web/src/root-policy.ts",
  "apps/reference-host-web/src/root.tsx",
  "apps/reference-host-web/src/sign-in-http-handler.ts",
  "apps/reference-host-web/src/styles.css",
]);

const APPLICATION_TEST_PATHS = Object.freeze([
  "apps/reference-host-web/test/host-ports.test.ts",
  "apps/reference-host-web/test/main-lifecycle.test.tsx",
  "apps/reference-host-web/test/official-sign-in.test.tsx",
  "apps/reference-host-web/test/official-sign-in.types.ts",
  "apps/reference-host-web/test/public-api.types.ts",
  "apps/reference-host-web/test/recovery-authority.test.ts",
  "apps/reference-host-web/test/root-lifecycle.test.tsx",
  "apps/reference-host-web/test/root-policy.test.ts",
  "apps/reference-host-web/test/root-security.test.tsx",
  "apps/reference-host-web/test/sign-in-http-handler.test.ts",
]);

const DERIVED_FIXTURE_PATHS = Object.freeze([
  "examples/sign-in/official-derived.source.desen.json",
  "examples/sign-in/official-derived.bundle.desen.json",
]);

const UPSTREAM_FIXTURE_PATHS = Object.freeze([
  "packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json",
  "packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json",
]);

const REFERENCE_CAPABILITY_PATHS = Object.freeze([
  "packages/reference-catalog-web/catalog.json",
  "packages/reference-catalog-web/package.json",
  "packages/reference-catalog-web/src/host-operations/sign-in.ts",
  "packages/reference-catalog-web/src/operations/sign-in.ts",
  "packages/reference-catalog-web/src/react-adapters/index.tsx",
]);

const MIGRATED_T07_PATHS = Object.freeze([
  "scripts/generate-reference-host-web-shell-proof.mjs",
  "scripts/lib/reference-host-web-shell-proof.mjs",
  "scripts/verify-reference-host-web-shell.mjs",
  "tests/reference-host-web-shell.test.mjs",
]);

const T08_PROOF_CODE_PATHS = Object.freeze([
  "scripts/generate-reference-host-web-sign-in-proof.mjs",
  "scripts/lib/reference-host-web-sign-in-proof.mjs",
  "scripts/verify-reference-host-web-sign-in.mjs",
  "tests/reference-host-web-sign-in.test.mjs",
]);

/** Current source, tests, fixtures, wiring, and T07 compatibility paths byte-owned by M05-T08. */
export const REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS = Object.freeze([
  "apps/reference-host-web/index.html",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/README.md",
  "apps/reference-host-web/tsconfig.json",
  ...APPLICATION_SOURCE_PATHS,
  ...APPLICATION_TEST_PATHS,
  ...DERIVED_FIXTURE_PATHS,
  ...UPSTREAM_FIXTURE_PATHS,
  ...REFERENCE_CAPABILITY_PATHS,
  "dependency-cruiser.config.cjs",
  "package.json",
  "scripts/lib/atomic-proof-artifact.mjs",
  ...MIGRATED_T07_PATHS,
  ...T08_PROOF_CODE_PATHS,
]);

const SUPPORTING_INSPECTION_PATHS = Object.freeze(["docs/proof/protocol-0.1.0-traceability.json"]);

/** Complete file set required by isolated static and hostile mutation inspection. */
export const REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS = Object.freeze([
  ...new Set([
    ...REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS,
    ...REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS,
    ...SUPPORTING_INSPECTION_PATHS,
  ]),
]);

const ROOT_SCRIPT_PREFIX =
  "pnpm verify:reference-host-web-shell && pnpm --filter @desen/reference-host-web... build && pnpm --filter @desen/reference-host-web typecheck && pnpm --filter @desen/reference-host-web test:sign-in";
const ROOT_SCRIPTS = Object.freeze({
  "generate:reference-host-web-sign-in": `${ROOT_SCRIPT_PREFIX} && node scripts/generate-reference-host-web-sign-in-proof.mjs`,
  "verify:reference-host-web-sign-in": `${ROOT_SCRIPT_PREFIX} && node scripts/verify-reference-host-web-sign-in.mjs`,
  "test:reference-host-web-sign-in": `${ROOT_SCRIPT_PREFIX} && node --test tests/reference-host-web-sign-in.test.mjs`,
});

const REQUIRED_APP_DEPENDENCIES = Object.freeze([
  "@desen/reference-catalog-web",
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
  "react",
  "react-dom",
]);
const FORBIDDEN_APP_DEPENDENCIES = Object.freeze([
  "@desen/app-web",
  "@desen/editor-core",
  "@desen/editor-web",
  "@desen/publisher",
  "@desen/testkit",
  "desen",
]);
const ALLOWED_PRODUCTION_IMPORTS = Object.freeze([
  "@desen/reference-catalog-web/catalog.json",
  "@desen/reference-catalog-web/host-operations",
  "@desen/reference-catalog-web/react-adapters",
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
  "react",
  "react-dom/client",
]);
const FORBIDDEN_PRODUCTION_TOKENS = Object.freeze([
  "@desen/app-web",
  "@desen/editor-core",
  "@desen/editor-web",
  "@desen/publisher",
  "@desen/testkit",
  "@desen/reference-catalog-web/components",
  "@desen/reference-catalog-web/src",
  "official-derived.source.desen.json",
  "sign-in.source.desen.json",
]);

const SIGN_IN_TEST_TITLES = Object.freeze([
  "runs pending, declared failure, edited retry, success, and navigation through real adapters",
  "runs the production HTTP binding through runtime, real adapters, retry, and navigation",
  "denies an empty-password contract input before I/O and keeps service failure generic",
  "contains a pending same-document authority after exact session and host replacement",
  "redacts rejected host failures, permits explicit retry, and ignores late disposal results",
  "cleans host and session authorities when root activation cannot transfer ownership",
  "rejects accessor-backed composition input without invoking it",
  "pins the exact controlled document and revision identities",
]);

const HTTP_TEST_TITLES = Object.freeze([
  "captures one fixed same-origin request and leaves successful schema validation to core",
  "maps only 401 to invalidCredentials and every other HTTP failure to unavailable",
  "contains network, response, and parse failures without logging raw values or retrying",
  "passes any bounded parsed JSON to core but classifies non-JSON output as unavailable",
  "bounds successful response bytes and cancels an oversized stream without parsing it",
  "accepts exact byte and chunk ceilings and rejects excessive stream fragmentation",
  "rejects spoofed DataView and shared-memory chunks through captured intrinsic brands",
  "snapshots exact own-data credentials before awaiting and rejects hostile input without I/O",
  "rejects a non-callable dependency before creating executable authority",
]);

const MAIN_LIFECYCLE_TEST_TITLES = Object.freeze([
  "preserves the production composition across BFCache entry and disposes on final pagehide",
]);

const HISTORICAL_T07_TEST_TITLES = Object.freeze([
  "accepts immutable task-time M05-T07 reference-host shell evidence",
  "two reads preserve exact bytes and recursively frozen reviewed semantics",
  "rejects one-byte, semantic-only, and byte-length artifact tampering",
  "rejects successor source, runtime, build, prerequisite, and pending-pin injection",
  "rejects accessor, inherited, symbol, non-enumerable, Proxy, and hostile byte inputs",
  "rejects a wrong byte length before allocating a local artifact copy",
  "rejects ambiguous sources and unbounded documentation",
  "rejects moved, duplicated, pending, or mismatched proof pins",
  "rejects decoy digests that are not associated with the M05-T07 artifact",
  "rejects symlink artifact and documentation inputs",
  "default writer is a no-op and alternate destination is an exact atomic copy",
  "temporary-byte tampering fails atomically without replacing the destination",
]);

const ROOT_TEST_TITLES = Object.freeze([
  "accepts the tracked deterministic M05-T08 sign-in evidence",
  "builds byte-identical evidence across independent proof runs",
  "inspects the exact official-derived fixture and current production boundary",
  "rejects inherited accessor-backed symbolic Proxy and unknown options",
  "rejects stale semantic and one-byte artifact tampering",
  "rejects missing changed or substituted direct prerequisite evidence",
  "rejects official-derived fixture surface digest revision and authoring drift",
  "rejects production sign-in composition and authority-boundary drift",
  "rejects HTTP request redaction and single-attempt policy drift",
  "rejects manifest root-script import and executable-loading drift",
  "rejects focused test compiler-negative and T07 compatibility inventory drift",
  "rejects symlink workspace artifact proof and tracked-source inputs",
  "requires one unique final proof-document artifact and SHA pin",
  "writes exact evidence atomically and rejects temporary-byte substitution",
]);

const TRACE_RULES = Object.freeze(
  [
    ["conformanceRules", "C-015", "7.3", ["M06-T07"], ["M05-T08", "M06-T10"]],
    ["pipelineSteps", "PIPE-008", "6.3", ["M04-T16", "M05-T08"], ["M05-T08"]],
    ["pipelineSteps", "PIPE-022", "24.2", ["M05-T01", "M05-T04"], ["M05-T08"]],
    ["proseRules", "R-007", "5.5", ["M06-T09", "M07-T02"], ["M05-T08", "M07-T10"]],
    ["proseRules", "R-056", "16.3", ["M05-T01"], ["M05-T08"]],
    ["proseRules", "R-064", "18.1", ["M02-T08", "M05-T03"], ["M02-T13", "M05-T08"]],
    ["proseRules", "R-091", "22.3", ["M03-T07", "M05-T08", "M12-T04"], ["M10-T02", "M12-T04"]],
    ["proseRules", "R-112", "26.3", ["M04-T02", "M05-T02", "M05-T06"], ["M04-T16", "M05-T08"]],
    ["proseRules", "R-113", "26.4", ["M05-T06", "M09-T13"], ["M05-T08", "M09-T13"]],
    ["proseRules", "R-115", "26.7", ["M05-T06", "M04-T09"], ["M05-T08"]],
    ["proseRules", "R-146", "16", ["M04-T16", "M05-T08"], ["M04-T16", "M05-T08"]],
    ["proseRules", "R-147", "17", ["M02-T07", "M05-T01"], ["M02-T13", "M05-T08"]],
    ["diagnostics", "D-036", "Appendix B", ["M02-T05", "M05-T06"], ["M05-T08"]],
  ].map(([collection, id, section, owners, tests]) =>
    Object.freeze({
      collection,
      id,
      section,
      owners: Object.freeze(owners),
      tests: Object.freeze(tests),
    }),
  ),
);

const EXPECTED_SOURCE_DIFFERENCES = Object.freeze([
  Object.freeze({
    path: "/catalogs/0/id",
    upstream: "com.example.web-catalog",
    derived: "run.desen.reference.sign-in",
  }),
  Object.freeze({
    path: "/catalogs/0/version",
    upstream: "1.0.0",
    derived: "0.1.0",
  }),
]);

const EXPECTED_BUNDLE_DIFFERENCES = Object.freeze([
  Object.freeze({
    path: "/requires/catalogs/0/digest",
    upstream: "sha256:c8e15513005c9f54d2fc35b60c01f9f7d187dabd3c5efba71cd4dc6db2542a1f",
    derived: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  }),
  Object.freeze({
    path: "/requires/catalogs/0/id",
    upstream: "com.example.web-catalog",
    derived: "run.desen.reference.sign-in",
  }),
  Object.freeze({
    path: "/requires/catalogs/0/version",
    upstream: "1.0.0",
    derived: "0.1.0",
  }),
  Object.freeze({
    path: "/revision",
    upstream: "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601",
    derived: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
  }),
  Object.freeze({
    path: "/sourceDigest",
    upstream: "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878",
    derived: "sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635",
  }),
]);

/** Stable controlled failure exposed to hostile-input and mutation tests. */
export class ReferenceHostWebSignInEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceHostWebSignInEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceHostWebSignInEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function captureOptions(value, allowedKeys, operation) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${operation} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${operation} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${operation} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `M05-T08 ${operation} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `M05-T08 ${operation} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (
    value !== undefined &&
    (typeof value !== "string" || value.length === 0 || value.includes("\0"))
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} must be a non-empty safe string.`,
    );
  }
  return value;
}

function optionalText(value, label) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} must be bounded non-shared non-Proxy bytes.`,
    );
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `M05-T08 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof ReferenceHostWebSignInEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer) || byteLength > MAX_ARTIFACT_BYTES) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} must use bounded non-shared backing memory.`,
    );
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `M05-T08 ${label} backing memory is detached or invalid.`,
    );
  }
}

async function resolveWorkspaceRoot(candidate) {
  const resolved = path.resolve(candidate ?? WORKSPACE_ROOT);
  let entry;
  try {
    entry = await lstat(resolved);
  } catch {
    fail("REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE", "M05-T08 workspace root is missing.");
  }
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail("REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE", "M05-T08 workspace root must be a real directory.");
  }
  try {
    return await realpath(resolved);
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE",
      "M05-T08 workspace root could not be resolved safely.",
    );
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
    if (error?.code === "ENOENT")
      fail(missingCode, `Required M05-T08 file is missing: ${filePath}`);
    fail(unsafeCode, `Required M05-T08 file could not be inspected safely: ${filePath}`);
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > BigInt(maximumBytes)) {
    fail(unsafeCode, `Required M05-T08 file is not a bounded regular file: ${filePath}`);
  }
  let handle;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(entry, before)) {
      fail(unsafeCode, `Required M05-T08 file changed before its safe read: ${filePath}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.length !== Number(before.size) ||
      after.size > BigInt(maximumBytes) ||
      !sameFileState(before, after)
    ) {
      fail(unsafeCode, `Required M05-T08 file changed during its safe read: ${filePath}`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebSignInEvidenceError) throw error;
    fail(unsafeCode, `Required M05-T08 file could not be read safely: ${filePath}`, {
      cause: String(error),
    });
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // The read result or controlled primary failure remains authoritative.
      }
    }
  }
}

async function readWorkspaceRegularFile(
  workspaceRoot,
  relativePath,
  missingCode,
  unsafeCode,
  maximumBytes = MAX_TRACKED_FILE_BYTES,
) {
  const components = relativePath.split("/");
  if (
    components.length === 0 ||
    components.some(
      (component) =>
        component.length === 0 ||
        component === "." ||
        component === ".." ||
        component.includes("\0"),
    )
  ) {
    fail(unsafeCode, `Required M05-T08 workspace path is unsafe: ${relativePath}`);
  }

  const directoryStates = [];
  let current = workspaceRoot;
  for (const component of components.slice(0, -1)) {
    current = path.join(current, component);
    let entry;
    try {
      entry = await lstat(current, { bigint: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        fail(missingCode, `Required M05-T08 workspace path is missing: ${relativePath}`);
      }
      fail(unsafeCode, `Required M05-T08 workspace path could not be inspected: ${relativePath}`);
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail(
        unsafeCode,
        `Required M05-T08 workspace path crosses an unsafe ancestor: ${relativePath}`,
      );
    }
    directoryStates.push(Object.freeze({ path: current, state: entry }));
  }

  const absolutePath = path.join(workspaceRoot, ...components);
  let canonicalBefore;
  try {
    canonicalBefore = await realpath(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(missingCode, `Required M05-T08 workspace file is missing: ${relativePath}`);
    }
    fail(unsafeCode, `Required M05-T08 workspace file could not be resolved: ${relativePath}`);
  }
  if (canonicalBefore !== absolutePath || !absolutePath.startsWith(`${workspaceRoot}${path.sep}`)) {
    fail(unsafeCode, `Required M05-T08 workspace file escapes through a symlink: ${relativePath}`);
  }

  const bytes = await readRegularFile(absolutePath, missingCode, unsafeCode, maximumBytes);
  let canonicalAfter;
  try {
    canonicalAfter = await realpath(absolutePath);
  } catch {
    fail(
      unsafeCode,
      `Required M05-T08 workspace file changed after its safe read: ${relativePath}`,
    );
  }
  if (canonicalAfter !== canonicalBefore) {
    fail(unsafeCode, `Required M05-T08 workspace file changed identity: ${relativePath}`);
  }
  for (const captured of directoryStates) {
    let after;
    try {
      after = await lstat(captured.path, { bigint: true });
    } catch {
      fail(
        unsafeCode,
        `Required M05-T08 workspace ancestor changed after its safe read: ${relativePath}`,
      );
    }
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFileState(captured.state, after)) {
      fail(
        unsafeCode,
        `Required M05-T08 workspace ancestor changed during its safe read: ${relativePath}`,
      );
    }
  }
  return bytes;
}

async function readPathMap(workspaceRoot, relativePaths) {
  const entries = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const bytes = await readWorkspaceRegularFile(
        workspaceRoot,
        relativePath,
        "REFERENCE_HOST_SIGN_IN_INPUT_MISSING",
        "REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE",
      );
      return Object.freeze({
        relativePath,
        bytes,
        text: bytes.toString("utf8"),
      });
    }),
  );
  return new Map(entries.map((entry) => [entry.relativePath, entry]));
}

function parseJson(bytes, label, code = "REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT") {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(code, `${label} is not valid JSON.`);
  }
}

function assertEqual(actual, expected, message, counter) {
  counter.value += 1;
  if (!isDeepStrictEqual(actual, expected)) {
    fail("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT", message, { expected, actual });
  }
}

function assertCondition(condition, message, counter, details = undefined) {
  counter.value += 1;
  if (!condition) fail("REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT", message, details);
}

function assertIncludes(text, expected, label, counter) {
  assertCondition(text.includes(expected), `${label} lost a reviewed invariant.`, counter, {
    expected,
  });
}

function assertExcludes(text, forbidden, label, counter) {
  assertCondition(!text.includes(forbidden), `${label} contains a forbidden surface.`, counter, {
    forbidden,
  });
}

function exactArray(actual, expected, label, counter) {
  assertEqual(actual, expected, `${label} drifted.`, counter);
}

function scriptKind(relativePath) {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parseSource(text, relativePath) {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(relativePath),
  );
  if (source.parseDiagnostics.length > 0) {
    fail(
      "REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT",
      `${relativePath} no longer parses as reviewed source.`,
    );
  }
  return source;
}

function collectTestTitles(text, relativePath) {
  const source = parseSource(text, relativePath);
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
          "REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT",
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
        "REFERENCE_HOST_SIGN_IN_SOURCE_DRIFT",
        `${relativePath} contains a skipped, conditional, or modified test registration.`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return titles;
}

function collectImportsAndDynamicCalls(text, relativePath) {
  const source = parseSource(text, relativePath);
  const imports = [];
  let dynamicExecutableCalls = 0;
  let jsxElements = 0;
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) jsxElements += 1;
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
  return Object.freeze({
    imports: Object.freeze(imports),
    dynamicExecutableCalls,
    jsxElements,
  });
}

function jsonDifferences(upstream, derived, pointer = "") {
  if (isDeepStrictEqual(upstream, derived)) return [];
  if (
    upstream === null ||
    derived === null ||
    typeof upstream !== "object" ||
    typeof derived !== "object" ||
    Array.isArray(upstream) !== Array.isArray(derived)
  ) {
    return [{ path: pointer, upstream, derived }];
  }
  const keys = [...new Set([...Object.keys(upstream), ...Object.keys(derived)])].sort();
  return keys.flatMap((key) => {
    const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
    if (!Object.hasOwn(upstream, key) || !Object.hasOwn(derived, key)) {
      return [{ path: childPointer, upstream: upstream[key], derived: derived[key] }];
    }
    return jsonDifferences(upstream[key], derived[key], childPointer);
  });
}

async function assertPrerequisites(workspaceRoot) {
  const entries = [];
  for (const prerequisite of PREREQUISITES) {
    const bytes = await readWorkspaceRegularFile(
      workspaceRoot,
      prerequisite.path,
      "REFERENCE_HOST_SIGN_IN_PREREQUISITE_MISSING",
      "REFERENCE_HOST_SIGN_IN_PREREQUISITE_UNSAFE",
      MAX_ARTIFACT_BYTES,
    );
    const digest = sha256(bytes);
    if (digest !== prerequisite.sha256) {
      fail(
        "REFERENCE_HOST_SIGN_IN_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite bytes changed.`,
        { expected: prerequisite.sha256, actual: digest },
      );
    }
    const artifact = parseJson(
      bytes,
      `${prerequisite.task} prerequisite`,
      "REFERENCE_HOST_SIGN_IN_PREREQUISITE_DRIFT",
    );
    if (
      artifact.task !== prerequisite.task ||
      artifact.result !== prerequisite.result ||
      artifact.profile !== prerequisite.profile
    ) {
      fail(
        "REFERENCE_HOST_SIGN_IN_PREREQUISITE_DRIFT",
        `${prerequisite.task} prerequisite semantics changed.`,
      );
    }
    if (
      prerequisite.task === "M05-T07" &&
      (artifact.claim?.officialSignInExecuted !== false ||
        artifact.claim?.handwrittenManagedTreeFullyAudited !== false)
    ) {
      fail(
        "REFERENCE_HOST_SIGN_IN_PREREQUISITE_DRIFT",
        "M05-T07 prerequisite lost its exact task-time nonclaims.",
      );
    }
    entries.push(
      Object.freeze({
        task: prerequisite.task,
        path: prerequisite.path,
        sha256: `sha256:${prerequisite.sha256}`,
        profile: prerequisite.profile,
        result: prerequisite.result,
      }),
    );
  }
  return Object.freeze(entries);
}

async function loadValidationApis() {
  let protocolApi;
  let validatorApi;
  try {
    [protocolApi, validatorApi] = await Promise.all([
      import(PROTOCOL_API_URL.href),
      import(VALIDATOR_API_URL.href),
    ]);
  } catch (error) {
    fail(
      "REFERENCE_HOST_SIGN_IN_RUNTIME_API_MISSING",
      "Built protocol or validator API is unavailable for M05-T08 fixture validation.",
      { cause: String(error) },
    );
  }
  for (const name of [
    "calculateDesenBundleRevision",
    "calculateDesenSourceDigest",
    "canonicalizeJson",
    "canonicalizeJsonBytes",
  ]) {
    if (typeof protocolApi[name] !== "function" || utilTypes.isProxy(protocolApi[name])) {
      fail(
        "REFERENCE_HOST_SIGN_IN_RUNTIME_API_DRIFT",
        `Built protocol API ${name} is unavailable or unsafe.`,
      );
    }
  }
  for (const name of [
    "validateDesenBundle",
    "validateDesenBundleExecutionContracts",
    "validateDesenCatalog",
    "validateDesenCatalogSemantics",
    "validateDesenExecutionCatalogSet",
    "validateDesenSource",
    "validateDesenSourceExecutionContracts",
  ]) {
    if (typeof validatorApi[name] !== "function" || utilTypes.isProxy(validatorApi[name])) {
      fail(
        "REFERENCE_HOST_SIGN_IN_RUNTIME_API_DRIFT",
        `Built validator API ${name} is unavailable or unsafe.`,
      );
    }
  }
  return Object.freeze({ protocolApi, validatorApi });
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
    app.scripts?.typecheck,
    "tsc -p tsconfig.json --noEmit",
    "Reference-host typecheck command drifted.",
    counter,
  );
  assertEqual(
    app.scripts?.test,
    "vitest run",
    "Reference-host exhaustive test command drifted.",
    counter,
  );
  assertEqual(
    app.scripts?.["test:sign-in"],
    "vitest run test/sign-in-http-handler.test.ts test/official-sign-in.test.tsx test/main-lifecycle.test.tsx",
    "Reference-host focused sign-in test command drifted.",
    counter,
  );
  exactArray(
    Object.keys(app.dependencies ?? {}).sort(),
    [...REQUIRED_APP_DEPENDENCIES].sort(),
    "Reference-host production dependency inventory",
    counter,
  );
  for (const dependency of FORBIDDEN_APP_DEPENDENCIES) {
    assertCondition(
      !Object.hasOwn(app.dependencies ?? {}, dependency) &&
        !Object.hasOwn(app.devDependencies ?? {}, dependency),
      `Reference-host dependency ${dependency} is forbidden.`,
      counter,
    );
  }

  const root = parseJson(files.get("package.json").bytes, "root package manifest");
  for (const [name, expected] of Object.entries(ROOT_SCRIPTS)) {
    assertEqual(root.scripts?.[name], expected, `Root ${name} command drifted.`, counter);
  }
  const testCommands = (root.scripts?.test ?? "").split(" && ");
  const checkCommands = (root.scripts?.check ?? "").split(" && ");
  assertCondition(
    testCommands.at(-2) === "pnpm test:reference-host-web-sign-in" &&
      testCommands.at(-1) === "turbo run test",
    "Root test order no longer closes with M05-T08 then complete workspace tests.",
    counter,
  );
  assertCondition(
    checkCommands.indexOf("pnpm verify:reference-host-web-sign-in") ===
      checkCommands.indexOf("pnpm verify:reference-host-web-shell") + 1,
    "Root check order no longer places M05-T08 immediately after M05-T07.",
    counter,
  );

  const referenceCatalog = parseJson(
    files.get("packages/reference-catalog-web/package.json").bytes,
    "reference-catalog package manifest",
  );
  assertEqual(
    referenceCatalog.name,
    "@desen/reference-catalog-web",
    "Reference Catalog package name drifted.",
    counter,
  );
  for (const subpath of ["./catalog.json", "./host-operations", "./react-adapters"]) {
    assertCondition(
      Object.hasOwn(referenceCatalog.exports ?? {}, subpath),
      `Reference Catalog required subpath ${subpath} disappeared.`,
      counter,
    );
  }
}

function assertTraceability(files, counter) {
  const ledger = parseJson(
    files.get("docs/proof/protocol-0.1.0-traceability.json").bytes,
    "protocol traceability ledger",
  );
  const projection = [];
  for (const expected of TRACE_RULES) {
    const matches = (ledger[expected.collection] ?? []).filter(({ id }) => id === expected.id);
    assertEqual(
      matches.length,
      1,
      `${expected.collection}/${expected.id} trace ownership became ambiguous.`,
      counter,
    );
    const entry = matches[0];
    assertEqual(entry.section, expected.section, `${expected.id} trace section drifted.`, counter);
    exactArray(entry.owners ?? [], expected.owners, `${expected.id} trace owners`, counter);
    exactArray(entry.tests ?? [], expected.tests, `${expected.id} trace tests`, counter);
    projection.push(
      Object.freeze({
        collection: expected.collection,
        id: expected.id,
        section: expected.section,
        owners: expected.owners,
        tests: expected.tests,
      }),
    );
  }
  return Object.freeze(projection);
}

function countManagedInventory(surfaces) {
  const componentCapabilities = new Map();
  let nodes = 0;
  let stateEntries = 0;
  let resources = 0;
  const actions = new Map();

  const visitActions = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visitActions(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (typeof value.type === "string") {
      actions.set(value.type, (actions.get(value.type) ?? 0) + 1);
    }
    for (const child of Object.values(value)) visitActions(child);
  };

  const visitNode = (node) => {
    if (node === null || typeof node !== "object" || typeof node.use !== "string") return;
    nodes += 1;
    const capabilityName = node.use.split("/").at(-1);
    componentCapabilities.set(capabilityName, (componentCapabilities.get(capabilityName) ?? 0) + 1);
    visitActions(node.on);
    for (const children of Object.values(node.slots ?? {})) {
      if (Array.isArray(children)) {
        for (const child of children) visitNode(child);
      }
    }
  };

  for (const surface of Object.values(surfaces ?? {})) {
    if (surface === null || typeof surface !== "object") continue;
    stateEntries += Object.keys(surface.state ?? {}).length;
    resources += Object.keys(surface.resources ?? {}).length;
    visitNode(surface.root);
  }
  return Object.freeze({
    surfaces: Object.keys(surfaces ?? {}).length,
    nodes,
    componentCapabilities: Object.freeze(
      Object.fromEntries(
        [...componentCapabilities].sort(([left], [right]) => left.localeCompare(right)),
      ),
    ),
    stateEntries,
    resources,
    actions: Object.freeze(
      Object.fromEntries([...actions].sort(([left], [right]) => left.localeCompare(right))),
    ),
  });
}

function assertValidationSuccess(result, label, counter) {
  assertCondition(
    result !== null &&
      typeof result === "object" &&
      result.valid === true &&
      Array.isArray(result.diagnostics) &&
      result.diagnostics.length === 0,
    `${label} no longer passes cumulative validation.`,
    counter,
  );
}

function assertFixtureSemantics(files, protocolApi, validatorApi, counter) {
  const sourceEntry = files.get("examples/sign-in/official-derived.source.desen.json");
  const bundleEntry = files.get("examples/sign-in/official-derived.bundle.desen.json");
  const upstreamSource = parseJson(
    files.get("packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json").bytes,
    "frozen upstream sign-in Source",
  );
  const upstreamBundle = parseJson(
    files.get("packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json").bytes,
    "frozen upstream sign-in Bundle",
  );
  const source = parseJson(sourceEntry.bytes, "official-derived sign-in Source");
  const bundle = parseJson(bundleEntry.bytes, "official-derived sign-in Bundle");
  const catalog = parseJson(
    files.get("packages/reference-catalog-web/catalog.json").bytes,
    "reference sign-in Catalog",
  );

  assertEqual(sourceEntry.bytes.length, 4_724, "Derived Source byte length drifted.", counter);
  assertEqual(
    sha256(sourceEntry.bytes),
    "a679ad21c0648414544e78efa231c2f058745a97331603ceeb78722231a71b4c",
    "Derived Source raw SHA-256 drifted.",
    counter,
  );
  assertEqual(bundleEntry.bytes.length, 4_899, "Derived Bundle byte length drifted.", counter);
  assertEqual(
    sha256(bundleEntry.bytes),
    "334450fa1864bf280a30342090a46ba1d2f2dc96552b9430afdde5fcada902b0",
    "Derived Bundle raw SHA-256 drifted.",
    counter,
  );

  exactArray(
    jsonDifferences(upstreamSource, source),
    EXPECTED_SOURCE_DIFFERENCES,
    "Allowed official-derived Source differences",
    counter,
  );
  exactArray(
    jsonDifferences(upstreamBundle, bundle),
    EXPECTED_BUNDLE_DIFFERENCES,
    "Allowed official-derived Bundle differences",
    counter,
  );

  let sourceDigest;
  let bundleRevision;
  let canonicalSurfaces;
  let sourceCanonical;
  let bundleCanonical;
  try {
    sourceDigest = protocolApi.calculateDesenSourceDigest(source);
    bundleRevision = protocolApi.calculateDesenBundleRevision(bundle);
    canonicalSurfaces = Buffer.from(protocolApi.canonicalizeJsonBytes(source.surfaces));
    sourceCanonical = Buffer.from(protocolApi.canonicalizeJsonBytes(source));
    bundleCanonical = Buffer.from(protocolApi.canonicalizeJsonBytes(bundle));
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_FIXTURE_DRIFT",
      "Official-derived fixture canonicalization failed safely.",
    );
  }
  assertEqual(
    sourceDigest,
    "sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635",
    "Official-derived Source digest drifted.",
    counter,
  );
  assertEqual(bundle.sourceDigest, sourceDigest, "Bundle Source digest pin drifted.", counter);
  assertEqual(
    bundleRevision,
    "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    "Official-derived Bundle revision drifted.",
    counter,
  );
  assertEqual(bundle.revision, bundleRevision, "Stored Bundle revision pin drifted.", counter);
  assertEqual(canonicalSurfaces.length, 1_702, "Canonical managed-surface bytes drifted.", counter);
  assertEqual(
    sha256(canonicalSurfaces),
    "44e37075d3bad3c4e749255a65651458a3c36dec8a4090816b647dac65dd0165",
    "Canonical managed-surface SHA-256 drifted.",
    counter,
  );
  for (const [label, surfaces] of [
    ["upstream Source", upstreamSource.surfaces],
    ["upstream Bundle", upstreamBundle.surfaces],
    ["derived Bundle", bundle.surfaces],
  ]) {
    let candidate;
    try {
      candidate = protocolApi.canonicalizeJson(surfaces);
    } catch {
      fail("REFERENCE_HOST_SIGN_IN_FIXTURE_DRIFT", `${label} surfaces could not be canonicalized.`);
    }
    assertEqual(
      candidate,
      canonicalSurfaces.toString("utf8"),
      `${label} managed surfaces differ from the official-derived Source.`,
      counter,
    );
  }

  assertEqual(source.kind, "desen.source", "Derived Source kind drifted.", counter);
  assertEqual(bundle.kind, "desen.bundle", "Derived Bundle kind drifted.", counter);
  assertEqual(source.id, "com.example.account-app", "Derived Source id drifted.", counter);
  assertEqual(bundle.id, source.id, "Derived Bundle id drifted.", counter);
  assertEqual(source.entry, "sign-in", "Derived Source entry surface drifted.", counter);
  assertEqual(bundle.entry, source.entry, "Derived Bundle entry surface drifted.", counter);
  assertCondition(
    Object.hasOwn(source, "authoring"),
    "Controlled derived Source lost its authoring-only fixture state.",
    counter,
  );
  assertCondition(
    !Object.hasOwn(bundle, "authoring"),
    "Production Bundle regained top-level authoring state.",
    counter,
  );
  assertEqual(
    source.catalogs,
    [{ id: catalog.id, version: catalog.version, target: catalog.target }],
    "Derived Source Catalog requirement drifted.",
    counter,
  );
  assertEqual(
    bundle.requires?.catalogs,
    [
      {
        id: catalog.id,
        version: catalog.version,
        target: catalog.target,
        digest: catalog.packageDigest,
      },
    ],
    "Derived Bundle Catalog requirement drifted.",
    counter,
  );
  assertEqual(
    {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      digest: catalog.packageDigest,
    },
    {
      id: "run.desen.reference.sign-in",
      version: "0.1.0",
      target: "web-react",
      digest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
    },
    "Reference sign-in Catalog tuple drifted.",
    counter,
  );

  const sourceStructural = validatorApi.validateDesenSource(source);
  const bundleStructural = validatorApi.validateDesenBundle(bundle);
  const catalogStructural = validatorApi.validateDesenCatalog(catalog);
  const catalogSemantic = validatorApi.validateDesenCatalogSemantics(catalog);
  const catalogSet = validatorApi.validateDesenExecutionCatalogSet([catalog]);
  for (const [label, result] of [
    ["Derived Source structural validation", sourceStructural],
    ["Derived Bundle structural validation", bundleStructural],
    ["Reference Catalog structural validation", catalogStructural],
    ["Reference Catalog semantic validation", catalogSemantic],
    ["Reference Catalog cumulative execution validation", catalogSet],
  ]) {
    assertValidationSuccess(result, label, counter);
  }
  const sourceExecution = validatorApi.validateDesenSourceExecutionContracts(
    source,
    catalogSet.value,
  );
  const bundleExecution = validatorApi.validateDesenBundleExecutionContracts(
    bundle,
    catalogSet.value,
  );
  assertValidationSuccess(sourceExecution, "Derived Source execution validation", counter);
  assertValidationSuccess(bundleExecution, "Derived Bundle execution validation", counter);

  const invalidSource = structuredClone(source);
  invalidSource.surfaces["sign-in"].root.use = "com.example.ui/Unknown";
  assertCondition(
    validatorApi.validateDesenSourceExecutionContracts(invalidSource, catalogSet.value).valid ===
      false,
    "Cumulative validation admitted an unknown fixture capability.",
    counter,
  );
  const invalidBundle = structuredClone(bundle);
  invalidBundle.requires.catalogs[0].digest = `sha256:${"0".repeat(64)}`;
  assertCondition(
    !isDeepStrictEqual(invalidBundle.requires?.catalogs, [
      {
        id: catalog.id,
        version: catalog.version,
        target: catalog.target,
        digest: catalog.packageDigest,
      },
    ]),
    "Exact fixture-to-Catalog comparison admitted a mismatched Catalog digest.",
    counter,
  );

  const managedInventory = countManagedInventory(source.surfaces);
  assertEqual(
    managedInventory,
    {
      surfaces: 2,
      nodes: 8,
      componentCapabilities: {
        Alert: 1,
        Button: 1,
        Stack: 2,
        Text: 2,
        TextField: 2,
      },
      stateEntries: 2,
      resources: 0,
      actions: {
        navigate: 1,
        "operation.invoke": 1,
        "state.set": 2,
      },
    },
    "Managed official sign-in fixture inventory drifted.",
    counter,
  );

  return deepFreeze({
    source: {
      path: DERIVED_FIXTURE_PATHS[0],
      bytes: sourceEntry.bytes.length,
      sha256: `sha256:${sha256(sourceEntry.bytes)}`,
      canonicalBytes: sourceCanonical.length,
      digest: sourceDigest,
      allowedDifferences: EXPECTED_SOURCE_DIFFERENCES,
      containsAuthoring: true,
    },
    bundle: {
      path: DERIVED_FIXTURE_PATHS[1],
      bytes: bundleEntry.bytes.length,
      sha256: `sha256:${sha256(bundleEntry.bytes)}`,
      canonicalBytes: bundleCanonical.length,
      revision: bundleRevision,
      allowedDifferences: EXPECTED_BUNDLE_DIFFERENCES,
      containsAuthoring: false,
    },
    managedSurfaces: {
      canonicalBytes: canonicalSurfaces.length,
      sha256: `sha256:${sha256(canonicalSurfaces)}`,
      upstreamAndDerivedCanonicalIdentity: true,
      inventory: managedInventory,
    },
    catalog: {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      digest: catalog.packageDigest,
    },
    validation: {
      sourceStructural: "PASS",
      bundleStructural: "PASS",
      catalogStructural: "PASS",
      catalogSemantic: "PASS",
      catalogExecutionSet: "PASS",
      sourceCumulativeExecution: "PASS",
      bundleCumulativeExecution: "PASS",
      invalidCapabilityProbeRejected: true,
      mismatchedCatalogDigestFixtureProbeRejected: true,
    },
  });
}

function assertProductionSemantics(files, counter) {
  for (const expected of CRITICAL_PRODUCTION_FILES) {
    const actual = files.get(expected.path).bytes;
    assertEqual(
      actual.length,
      expected.bytes,
      `${expected.path} byte length drifted from the reviewed executable boundary.`,
      counter,
    );
    assertEqual(
      sha256(actual),
      expected.sha256,
      `${expected.path} bytes drifted from the reviewed executable boundary.`,
      counter,
    );
  }

  const html = files.get("apps/reference-host-web/index.html").text;
  assertIncludes(html, 'id="desen-reference-host-root"', "Reference-host HTML", counter);
  assertIncludes(html, 'src="/src/main.tsx"', "Reference-host HTML", counter);
  for (const forbidden of ["<form", "<input", "<button", "sign-in-form"]) {
    assertExcludes(html, forbidden, "Reference-host static HTML", counter);
  }

  const main = files.get("apps/reference-host-web/src/main.tsx").text;
  for (const required of [
    'import { activateReferenceHostOfficialSignIn } from "./official-sign-in.js";',
    'import { createReferenceHostSignInHttpBinding } from "./sign-in-http-handler.js";',
    "const referenceHostRoot = createReferenceHostRoot({",
    "const signIn = createReferenceHostSignInHttpBinding((resource, init) =>",
    "window.fetch(resource, init)",
    "const activation = activateReferenceHostOfficialSignIn(referenceHostRoot, {",
    "browser: window",
    "signIn,",
    "reportDiagnostic: () => undefined",
    'if (activation.status !== "activated")',
    "disposeReferenceHostRoot(referenceHostRoot)",
    '"pagehide"',
    "function disposeOnFinalPageHide(event: PageTransitionEvent)",
    "if (event.persisted) return;",
    'window.removeEventListener("pagehide", disposeOnFinalPageHide)',
  ]) {
    assertIncludes(main, required, "Reference-host production entry", counter);
  }
  for (const forbidden of [
    "official-derived.source",
    "bindReferenceSignInHostOperation",
    "com.example.ui/",
    "console.",
  ]) {
    assertExcludes(main, forbidden, "Reference-host production entry", counter);
  }

  const composition = files.get("apps/reference-host-web/src/official-sign-in.ts").text;
  for (const required of [
    'import referenceCatalog from "@desen/reference-catalog-web/catalog.json";',
    'from "@desen/reference-catalog-web/host-operations";',
    'from "@desen/reference-catalog-web/react-adapters";',
    'from "../../../examples/sign-in/official-derived.bundle.desen.json";',
    'export const REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID = "com.example.account-app";',
    '"sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";',
    'const SIGN_IN_SURFACE_ID = "sign-in";',
    'const HOME_SURFACE_ID = "home";',
    'const SIGN_IN_INVOCATION_ALIAS = "signIn";',
    'const SIGN_IN_EFFECT = "network";',
    'const HOME_PATH = "/home";',
    'ownDataRecord(input, ["browser", "signIn", "reportDiagnostic"])',
    'ownDataRecord(captured.signIn, ["operationId", "invoke"])',
    'binding.operationId !== "com.example.auth/signIn"',
    'ownDataRecord(value, ["documentId", "revision", "surfaceId", "requestId"])',
    "request.capabilityId !== operationId",
    "request.invocationAlias !== SIGN_IN_INVOCATION_ALIAS",
    "request.effect !== SIGN_IN_EFFECT",
    "Reflect.apply(binding.invoke, undefined",
    'ownDataRecord(request, ["context", "targetSurfaceId", "params"])',
    "captured.targetSurfaceId !== HOME_SURFACE_ID",
    'browser.history.pushState(null, "", HOME_PATH)',
    "const redacted = Object.freeze({ code: safeDiagnosticCode(diagnostic) });",
    "Reflect.apply(reportDiagnostic, undefined, [redacted])",
    'getBundle: () => Object.freeze({ status: "missing" })',
    'putBundle: () => Object.freeze({ status: "conflict" })',
    'readActivation: () => Object.freeze({ status: "missing" })',
    'commitActivation: () => Object.freeze({ status: "conflict", generation: null })',
    "return Object.freeze({ load: () => DENIED_HOST_CALL });",
    'return Object.freeze({ resolve: () => Object.freeze({ status: "missing" }) });',
    "createRuntimeReactAdapterRegistry(REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT)",
    "createReferenceHostWebPorts({",
    "readRuntimeWebHostAuthority(host.handle)",
    "mountRuntimeHeadlessSession({",
    "bundle: officialDerivedSignInBundle",
    "catalogs: [referenceCatalog]",
    "hostPorts: hostRead.hostPorts",
    "activateReferenceHostSurface(root, {",
    "safelyDisposeCreatedAuthorities(host.handle, mounted.handle)",
  ]) {
    assertIncludes(composition, required, "Official sign-in composition", counter);
  }
  for (const forbidden of [
    "official-derived.source",
    "sign-in.source.desen",
    "@desen/testkit",
    "console.",
    "localStorage",
    "sessionStorage",
    "document.",
    "<TextField",
    "<Button",
    "<Stack",
    "<Alert",
    "<Text",
  ]) {
    assertExcludes(composition, forbidden, "Official sign-in composition", counter);
  }

  const http = files.get("apps/reference-host-web/src/sign-in-http-handler.ts").text;
  for (const required of [
    'const SIGN_IN_ENDPOINT = "/api/sign-in";',
    "const MAX_SIGN_IN_RESPONSE_BYTES = 64 * 1024;",
    "const MAX_SIGN_IN_RESPONSE_CHUNKS = 1_024;",
    "const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(",
    "const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(",
    'accept: "application/json"',
    '"content-type": "application/json"',
    'method: "POST"',
    "headers: JSON_HEADERS",
    "body,",
    'cache: "no-store"',
    'credentials: "same-origin"',
    'mode: "same-origin"',
    'redirect: "error"',
    'referrerPolicy: "no-referrer"',
    "rawResponse = await Reflect.apply(fetchLike, undefined",
    "if (response.status === 401) {",
    "if (response.status < 200 || response.status >= 300) {",
    "cancelUnusedResponseBody(response.response);",
    "let chunkCount = 0;",
    "for (;;) {",
    "chunkCount >= MAX_SIGN_IN_RESPONSE_CHUNKS",
    "function captureResponseChunk(value: unknown, maximumBytes: number)",
    "byteLength > maximumBytes",
    "if (chunkCount >= MAX_SIGN_IN_RESPONSE_CHUNKS) {",
    "const chunk = captureResponseChunk(result.value, MAX_SIGN_IN_RESPONSE_BYTES - totalBytes);",
    'Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) !== "Uint8Array"',
    "Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, [])",
    "chunkCount += 1;",
    "await cancelBodyReader(reader);",
    'JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))',
    "return snapshotRuntimeJsonValue(parsed);",
    "const value = await readBoundedJsonResponse(response.response);",
    "return bindReferenceSignInHostOperation(handler);",
  ]) {
    assertIncludes(http, required, "Reference-host HTTP binding", counter);
  }
  assertEqual(
    http.split("Reflect.apply(fetchLike").length - 1,
    1,
    "Reference-host HTTP binding lost its exact single transport call site.",
    counter,
  );
  for (const forbidden of [
    "console.",
    "setTimeout",
    "setInterval",
    "AbortController",
    "authorization",
    "localStorage",
    "sessionStorage",
    "document.cookie",
  ]) {
    assertExcludes(http, forbidden, "Reference-host HTTP binding", counter);
  }

  const productionImports = [];
  let dynamicExecutableCalls = 0;
  let officialCompositionJsx = 0;
  for (const relativePath of APPLICATION_SOURCE_PATHS.filter(
    (candidate) => candidate.endsWith(".ts") || candidate.endsWith(".tsx"),
  )) {
    const analysis = collectImportsAndDynamicCalls(files.get(relativePath).text, relativePath);
    dynamicExecutableCalls += analysis.dynamicExecutableCalls;
    productionImports.push(
      ...analysis.imports.map((specifier) => Object.freeze({ importer: relativePath, specifier })),
    );
    if (
      relativePath === "apps/reference-host-web/src/official-sign-in.ts" ||
      relativePath === "apps/reference-host-web/src/sign-in-http-handler.ts" ||
      relativePath === "apps/reference-host-web/src/main.tsx"
    ) {
      officialCompositionJsx += analysis.jsxElements;
    }
    for (const specifier of analysis.imports) {
      const allowed =
        specifier.startsWith("./") ||
        specifier.startsWith("../") ||
        ALLOWED_PRODUCTION_IMPORTS.includes(specifier);
      assertCondition(
        allowed,
        `Production import ${specifier} from ${relativePath} is outside the reviewed allowlist.`,
        counter,
      );
    }
    for (const forbidden of FORBIDDEN_PRODUCTION_TOKENS) {
      assertExcludes(files.get(relativePath).text, forbidden, relativePath, counter);
    }
  }
  assertEqual(
    productionImports.length,
    52,
    "Reference-host production import declaration inventory drifted.",
    counter,
  );
  assertEqual(
    dynamicExecutableCalls,
    0,
    "Reference-host production source gained executable loading.",
    counter,
  );
  assertEqual(
    officialCompositionJsx,
    0,
    "Official sign-in composition gained a handwritten JSX tree.",
    counter,
  );

  const t07Library = files.get("scripts/lib/reference-host-web-shell-proof.mjs").text;
  for (const required of [
    'const COMPATIBILITY_MODE = "immutable-task-time-artifact";',
    '"cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2";',
    "Reads exact immutable M05-T07 evidence without consulting current successor source or tests.",
    "Immutable task-time M05-T07 artifact bytes changed.",
  ]) {
    assertIncludes(t07Library, required, "Migrated M05-T07 compatibility reader", counter);
  }
  for (const forbidden of [
    'from "prettier"',
    'from "typescript"',
    'from "node:child_process"',
    "buildIndependentViteInventory",
  ]) {
    assertExcludes(t07Library, forbidden, "Migrated M05-T07 compatibility reader", counter);
  }
  assertIncludes(
    files.get("scripts/generate-reference-host-web-shell-proof.mjs").text,
    "Preserved immutable task-time M05-T07",
    "Migrated M05-T07 generator",
    counter,
  );
  assertIncludes(
    files.get("scripts/verify-reference-host-web-shell.mjs").text,
    "Verified immutable task-time M05-T07",
    "Migrated M05-T07 verifier",
    counter,
  );

  return deepFreeze({
    documentId: "com.example.account-app",
    revision: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    entrySurface: "sign-in",
    successSurface: "home",
    operation: {
      capabilityId: "com.example.auth/signIn",
      invocationAlias: "signIn",
      effect: "network",
      input: ["email", "password"],
      concurrency: "replace",
    },
    navigation: {
      from: "sign-in",
      to: "home",
      browserPath: "/home",
      exactEmptyParams: true,
    },
    httpBinding: {
      endpoint: "/api/sign-in",
      method: "POST",
      credentials: "same-origin",
      mode: "same-origin",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      maximumResponseBytes: 65_536,
      maximumResponseChunks: 1_024,
      acceptedAttemptsPerInvocation: 1,
      automaticRetries: 0,
      invalidCredentialsStatus: 401,
      otherFailures: "unavailable",
      outputSchemaOwner: "runtime-core",
      rawErrorsReported: false,
      credentialsReported: false,
    },
    productionImports: Object.freeze(productionImports),
    dynamicExecutableCalls,
    officialCompositionJsx,
    t07Compatibility: {
      mode: "immutable-task-time-artifact",
      artifactRewritten: false,
      ownedPaths: MIGRATED_T07_PATHS,
    },
  });
}

function compilerNegativeIds(text, prefix) {
  return [...text.matchAll(new RegExp(`${prefix}-N\\d{2}`, "gu"))].map(([id]) => id);
}

function assertTestInventory(files, counter) {
  assertIncludes(
    files.get("apps/reference-host-web/test/main-lifecycle.test.tsx").text,
    "const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;",
    "Production-entry lifecycle test load budget",
    counter,
  );
  exactArray(
    collectTestTitles(
      files.get("apps/reference-host-web/test/official-sign-in.test.tsx").text,
      "apps/reference-host-web/test/official-sign-in.test.tsx",
    ),
    SIGN_IN_TEST_TITLES,
    "Official sign-in integration tests",
    counter,
  );
  exactArray(
    collectTestTitles(
      files.get("apps/reference-host-web/test/sign-in-http-handler.test.ts").text,
      "apps/reference-host-web/test/sign-in-http-handler.test.ts",
    ),
    HTTP_TEST_TITLES,
    "Sign-in HTTP binding tests",
    counter,
  );
  exactArray(
    collectTestTitles(
      files.get("apps/reference-host-web/test/main-lifecycle.test.tsx").text,
      "apps/reference-host-web/test/main-lifecycle.test.tsx",
    ),
    MAIN_LIFECYCLE_TEST_TITLES,
    "Production composition lifecycle tests",
    counter,
  );
  exactArray(
    collectTestTitles(
      files.get("tests/reference-host-web-shell.test.mjs").text,
      "tests/reference-host-web-shell.test.mjs",
    ),
    HISTORICAL_T07_TEST_TITLES,
    "Migrated M05-T07 compatibility tests",
    counter,
  );
  exactArray(
    collectTestTitles(
      files.get("tests/reference-host-web-sign-in.test.mjs").text,
      "tests/reference-host-web-sign-in.test.mjs",
    ),
    ROOT_TEST_TITLES,
    "M05-T08 root hostile and mutation tests",
    counter,
  );

  let fullAppCases = 0;
  for (const relativePath of APPLICATION_TEST_PATHS.filter(
    (candidate) => candidate.endsWith(".test.ts") || candidate.endsWith(".test.tsx"),
  )) {
    fullAppCases += collectTestTitles(files.get(relativePath).text, relativePath).length;
  }
  assertEqual(fullAppCases, 40, "Reference-host exhaustive app test inventory drifted.", counter);

  const signInNegativeIds = compilerNegativeIds(
    files.get("apps/reference-host-web/test/official-sign-in.types.ts").text,
    "M05-T08",
  );
  exactArray(
    signInNegativeIds,
    Array.from({ length: 7 }, (_, index) => `M05-T08-N${String(index + 1).padStart(2, "0")}`),
    "M05-T08 compiler-negative cases",
    counter,
  );
  const shellCompilerNegativeCases =
    files.get("apps/reference-host-web/test/public-api.types.ts").text.match(/@ts-expect-error/gu)
      ?.length ?? 0;
  assertEqual(
    shellCompilerNegativeCases,
    6,
    "Reference-host shell compiler-negative inventory drifted.",
    counter,
  );

  return deepFreeze({
    fullAppCases,
    focusedSignInCases: SIGN_IN_TEST_TITLES.length,
    focusedHttpCases: HTTP_TEST_TITLES.length,
    focusedLifecycleCases: MAIN_LIFECYCLE_TEST_TITLES.length,
    focusedCases:
      SIGN_IN_TEST_TITLES.length + HTTP_TEST_TITLES.length + MAIN_LIFECYCLE_TEST_TITLES.length,
    signInCompilerNegativeCases: signInNegativeIds.length,
    shellCompilerNegativeCases,
    compilerNegativeCases: signInNegativeIds.length + shellCompilerNegativeCases,
    historicalT07CompatibilityCases: HISTORICAL_T07_TEST_TITLES.length,
    rootMutationTests: ROOT_TEST_TITLES.length,
  });
}

async function readTrackedFiles(workspaceRoot) {
  const files = await readPathMap(workspaceRoot, REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS);
  return Object.freeze(
    REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS.map((relativePath) => {
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
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(current, entry.name);
    const status = await lstat(absolutePath);
    if (status.isSymbolicLink()) {
      fail("REFERENCE_HOST_SIGN_IN_BUILD_UNSAFE", "Vite output contains a symlink.");
    }
    if (status.isDirectory()) {
      files.push(...(await listBuildFiles(root, absolutePath)));
      continue;
    }
    if (!status.isFile() || status.size > MAX_BUILD_FILE_BYTES) {
      fail(
        "REFERENCE_HOST_SIGN_IN_BUILD_UNSAFE",
        "Vite output contains a non-file or oversized entry.",
      );
    }
    const bytes = await readRegularFile(
      absolutePath,
      "REFERENCE_HOST_SIGN_IN_BUILD_FAILED",
      "REFERENCE_HOST_SIGN_IN_BUILD_UNSAFE",
      MAX_BUILD_FILE_BYTES,
    );
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
  let stdoutBytes = 0;
  let stderrBytes = 0;
  child.stdout.on("data", (chunk) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= 64 * 1024) stdout.push(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderrBytes += chunk.length;
    if (stderrBytes <= 64 * 1024) stderr.push(chunk);
  });
  const outcome = await Promise.race([
    once(child, "close").then(([code, signal]) => ({ code, signal })),
    once(child, "error").then(([error]) => ({ error })),
  ]);
  if (
    Object.hasOwn(outcome, "error") ||
    outcome.code !== 0 ||
    outcome.signal !== null ||
    stdoutBytes > 64 * 1024 ||
    stderrBytes > 64 * 1024
  ) {
    fail("REFERENCE_HOST_SIGN_IN_BUILD_FAILED", "Independent M05-T08 Vite build failed safely.", {
      code: outcome.code,
      signal: outcome.signal,
      cause: Object.hasOwn(outcome, "error") ? String(outcome.error) : undefined,
      stdout: Buffer.concat(stdout).toString("utf8").slice(-2_000),
      stderr: Buffer.concat(stderr).toString("utf8").slice(-2_000),
    });
  }
  const files = await listBuildFiles(outputDirectory);
  const publicFiles = files.map(({ content: _content, ...entry }) => Object.freeze(entry));
  const index = files.find(({ path: relativePath }) => relativePath === "index.html");
  const scripts = files.filter(({ path: relativePath }) => relativePath.endsWith(".js"));
  if (index === undefined || scripts.length !== 1) {
    fail(
      "REFERENCE_HOST_SIGN_IN_BUILD_DRIFT",
      "Independent M05-T08 Vite build lost its exact HTML or application script inventory.",
    );
  }
  const indexText = index.content.toString("utf8");
  if (
    !indexText.includes('id="desen-reference-host-root"') ||
    indexText.includes("/src/main.tsx") ||
    publicFiles.some(({ path: relativePath }) => relativePath.endsWith(".map"))
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_BUILD_DRIFT",
      "Independent Vite output no longer exposes only the compiled dedicated host entry.",
    );
  }
  const applicationJavaScript = scripts[0].content.toString("utf8");
  for (const expected of [
    "/api/sign-in",
    "com.example.account-app",
    "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    "Sign in",
    "Welcome",
  ]) {
    if (!applicationJavaScript.includes(expected)) {
      fail(
        "REFERENCE_HOST_SIGN_IN_BUILD_DRIFT",
        "Built application lost an exact official sign-in integration identity.",
        { expected },
      );
    }
  }
  for (const forbidden of [
    "official-derived.source.desen.json",
    "@desen/testkit",
    "@desen/editor-core",
    "@desen/app-web",
  ]) {
    if (applicationJavaScript.includes(forbidden)) {
      fail(
        "REFERENCE_HOST_SIGN_IN_BUILD_DRIFT",
        "Built application contains a forbidden authoring or application dependency.",
        { forbidden },
      );
    }
  }
  const aggregateSha256 = sha256(Buffer.from(JSON.stringify(publicFiles)));
  return Object.freeze({
    files: Object.freeze(publicFiles),
    aggregateSha256,
  });
}

async function buildIndependentViteInventory(workspaceRoot) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "desen-reference-host-t08-"));
  try {
    const first = await runViteBuild(workspaceRoot, path.join(temporaryRoot, "first"));
    const second = await runViteBuild(workspaceRoot, path.join(temporaryRoot, "second"));
    if (
      first.aggregateSha256 !== second.aggregateSha256 ||
      !isDeepStrictEqual(first.files, second.files)
    ) {
      fail(
        "REFERENCE_HOST_SIGN_IN_BUILD_NONDETERMINISTIC",
        "Two independent M05-T08 Vite builds produced different output inventories.",
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

async function serializeArtifact(artifact) {
  const formatted = await format(JSON.stringify(artifact), { parser: "json" });
  return Buffer.from(formatted, "utf8");
}

function createArtifact({
  prerequisites,
  trackedFiles,
  fixtures,
  production,
  tests,
  traceability,
  sourceAssertions,
  build,
}) {
  return deepFreeze({
    schemaVersion: 1,
    task: "M05-T08",
    result: "PASS",
    profile: "desen-reference-host-web-sign-in-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites,
    claim: {
      controlledOfficialDerivedFixture: true,
      canonicalManagedSurfacesPreserved: true,
      officialSignInExecuted: true,
      realFiveAdapterRegistryExecuted: true,
      realHeadlessSessionMounted: true,
      realRuntimeWebHostAuthorityUsed: true,
      fixedApplicationOwnedOperationBinding: true,
      pendingFailureEditedRetrySuccessNavigationExecuted: true,
      staleAuthoritySettlementContained: true,
      sameSurfacePendingPressSuppressed: true,
      persistedPageHideCompositionPreserved: true,
      finalPageHideCompositionDisposed: true,
      protocolBundleContainsTopLevelAuthoringState: false,
      publisherProducedFixture: false,
      realAuthenticationBackend: false,
      transportCancellationClaimed: false,
      handwrittenManagedTreeFullyAudited: false,
      browserE2eClaimed: false,
      nativeRuntimeClaimed: false,
      g05Closed: false,
    },
    fixture: fixtures,
    integration: {
      documentId: production.documentId,
      revision: production.revision,
      entrySurface: production.entrySurface,
      successSurface: production.successSurface,
      operation: production.operation,
      navigation: production.navigation,
      httpBinding: production.httpBinding,
      hostAuthority: {
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
        bundleChoice: "module-owned-official-derived-bundle",
        catalogChoice: "module-owned-reference-catalog",
        adapterRegistryChoice: "module-owned-reference-react-adapters",
        arbitraryReactChildren: false,
        callerSelectedCapabilityId: false,
        callerSelectedRecoveryKey: false,
        rejectedActivationDisposesCreatedAuthorities: true,
        diagnostics: "bounded-redacted-code-only",
      },
      exercisedFlow: [
        "edit",
        "pending",
        "declared-failure",
        "edited-retry",
        "success",
        "navigation",
        "stale-replacement-containment",
        "late-disposal-containment",
      ],
    },
    independentBuild: build,
    compatibility: production.t07Compatibility,
    evidence: {
      focusedScripts: [
        "pnpm verify:reference-host-web-shell",
        "pnpm --filter @desen/reference-host-web... build",
        "pnpm --filter @desen/reference-host-web typecheck",
        "pnpm --filter @desen/reference-host-web test:sign-in",
      ],
      tests,
      sourceAssertions,
      productionImports: production.productionImports.length,
      dynamicExecutableImports: production.dynamicExecutableCalls,
      officialCompositionJsx: production.officialCompositionJsx,
      trackedFiles,
      traceability: {
        canonicalTrace: traceability,
        normativeStatusChanges: [],
        proofClaimStatusChanges: [],
        normativeStatus: {
          "N-036": "PLANNED",
        },
        proofClaims: {
          "P-06": "PARTIAL",
          "P-07": "NOT_PROVEN",
          "P-10": "PARTIAL",
          "P-17": "PARTIAL",
        },
        productionRuntimeConformance: "PLANNED",
        gate: "G05_OPEN_PENDING_M05_T09",
      },
      historicalArtifactsRewritten: false,
    },
    nonclaims: [
      "M06 Publisher output or reproducible publication",
      "real authentication backend, credential store, or production authorization policy",
      "request timeout, transport cancellation, automatic retry, or authentication-session policy",
      "channel fetching, exact package installation, or arbitrary remote capability loading",
      "IndexedDB activation, atomic commit, restart recovery, or last-known-good behavior",
      "final AST and resolved-import proof of no handwritten managed-screen composition",
      "G05 closure",
      "real-browser end-to-end conformance",
      "Desen App authoring, preview, publishing, or host parity",
      "native, iOS, Android, SwiftUI, or Compose runtime support",
    ],
  });
}

/** Performs complete static, fixture, prerequisite, trace, and hostile-inventory inspection. */
export async function inspectReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "inspect");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const prerequisitePaths = new Set(REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS);
  const [files, prerequisites, apis] = await Promise.all([
    readPathMap(
      workspaceRoot,
      REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS.filter(
        (relativePath) => !prerequisitePaths.has(relativePath),
      ),
    ),
    assertPrerequisites(workspaceRoot),
    loadValidationApis(),
  ]);
  const counter = { value: 0 };
  assertManifestSemantics(files, counter);
  const traceability = assertTraceability(files, counter);
  const fixtures = assertFixtureSemantics(files, apis.protocolApi, apis.validatorApi, counter);
  const production = assertProductionSemantics(files, counter);
  const tests = assertTestInventory(files, counter);
  return deepFreeze({
    prerequisites,
    fixtures,
    production,
    tests,
    traceability,
    sourceAssertions: counter.value,
  });
}

/** Builds complete deterministic M05-T08 evidence, including two isolated Vite outputs. */
export async function buildReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "build");
  const workspaceRoot = await resolveWorkspaceRoot(
    optionalString(options.workspaceRoot, "workspaceRoot"),
  );
  const [inventory, trackedFiles, build] = await Promise.all([
    inspectReferenceHostWebSignInEvidence({ workspaceRoot }),
    readTrackedFiles(workspaceRoot),
    buildIndependentViteInventory(workspaceRoot),
  ]);
  const artifact = createArtifact({
    prerequisites: inventory.prerequisites,
    trackedFiles,
    fixtures: inventory.fixtures,
    production: inventory.production,
    tests: inventory.tests,
    traceability: inventory.traceability,
    sourceAssertions: inventory.sourceAssertions,
    build,
  });
  const artifactBytes = await serializeArtifact(artifact);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function uniqueSection(text, startPredicate, nextSectionPredicate, label) {
  const lines = text.split(/\r?\n/u);
  const starts = lines.flatMap((line, index) => (startPredicate(line) ? [index] : []));
  if (starts.length !== 1) {
    fail(
      "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT",
      `M05-T08 ${label} section is missing or ambiguous.`,
    );
  }
  const start = starts[0];
  const end = lines.findIndex((line, index) => index > start && nextSectionPredicate(line));
  return lines.slice(start, end === -1 ? lines.length : end).join("\n");
}

function uniqueTableRow(text, claimId) {
  const prefix = `| ${claimId} |`;
  const rows = text.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
  if (rows.length !== 1) {
    fail(
      "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT",
      `M05-T08 Proof Matrix ${claimId} row is missing or ambiguous.`,
    );
  }
  return rows[0];
}

function verifyUniquePin(section, pathReference, shaReference, associationReference, label) {
  const pathCount = section.split(pathReference).length - 1;
  const shaCount = section.split(shaReference).length - 1;
  const associationCount = section.split(associationReference).length - 1;
  if (
    pathCount !== 1 ||
    shaCount !== 1 ||
    associationCount !== 1 ||
    section.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT",
      `M05-T08 ${label} lost its unique exact artifact and SHA pin.`,
      { label, pathCount, shaCount, associationCount },
    );
  }
}

function verifyProofDocument(text, artifactSha256) {
  verifyUniquePin(
    uniqueSection(
      text,
      (line) => line === "## Evidence artifact",
      (line) => line.startsWith("## "),
      "proof-document Evidence artifact",
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`sha256:${artifactSha256}\``,
    `- path: \`${ARTIFACT_RELATIVE_PATH}\`\n- SHA-256: \`sha256:${artifactSha256}\``,
    "proof document",
  );
}

function verifyDocumentation(proofText, matrixText, projectStatusText, artifactSha256) {
  verifyProofDocument(proofText, artifactSha256);
  const matrixArtifactReference = `\`${path.basename(ARTIFACT_RELATIVE_PATH)}\``;
  const matrixShaReference = `\`sha256:${artifactSha256}\``;
  for (const claimId of ["P-06", "P-10"]) {
    verifyUniquePin(
      uniqueTableRow(matrixText, claimId),
      matrixArtifactReference,
      matrixShaReference,
      `${matrixArtifactReference} ${matrixShaReference}`,
      `Proof Matrix ${claimId} row`,
    );
  }
  verifyUniquePin(
    uniqueSection(
      matrixText,
      (line) => line === "## M05-T08",
      (line) => line.startsWith("## "),
      "Proof Matrix",
    ),
    matrixArtifactReference,
    matrixShaReference,
    `${matrixArtifactReference}\n${matrixShaReference}`,
    "Proof Matrix",
  );
  verifyUniquePin(
    uniqueSection(
      projectStatusText,
      (line) => line === "M05-T08 evidence:",
      (line) => /^M\d{2}-T\d{2} evidence:$/u.test(line) || line.startsWith("## "),
      "Project Status",
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`${artifactSha256}\``,
    `- \`${ARTIFACT_RELATIVE_PATH}\`\n- artifact SHA-256:\n  \`${artifactSha256}\``,
    "Project Status",
  );
}

/** Verifies one unique human-readable M05-T08 artifact and digest location. */
export function verifyReferenceHostWebSignInProofDocument(text, artifactSha256) {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES ||
    typeof artifactSha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(artifactSha256)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "M05-T08 proof-document verification requires bounded text and one lowercase SHA-256.",
    );
  }
  verifyProofDocument(text, artifactSha256);
  return Object.freeze({ result: "PASS", exactReferences: 2 });
}

/** Verifies ten exact M05-T08 artifact references across all three status documents. */
export function verifyReferenceHostWebSignInDocumentation(
  proofText,
  matrixText,
  projectStatusText,
  artifactSha256,
) {
  for (const [text, label] of [
    [proofText, "proofDocumentText"],
    [matrixText, "proofMatrixText"],
    [projectStatusText, "projectStatusText"],
  ]) {
    optionalText(text, label);
    if (typeof text !== "string") {
      fail("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID", `M05-T08 ${label} must be bounded text.`);
    }
  }
  if (typeof artifactSha256 !== "string" || !/^[0-9a-f]{64}$/u.test(artifactSha256)) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "M05-T08 documentation verification requires one lowercase SHA-256.",
    );
  }
  verifyDocumentation(proofText, matrixText, projectStatusText, artifactSha256);
  return Object.freeze({ result: "PASS", exactReferences: 10 });
}

/** Verifies stored M05-T08 bytes against a fresh deterministic build and exact proof pin. */
export async function verifyReferenceHostWebSignInEvidence(rawOptions = undefined) {
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
      "projectStatusPath",
      "projectStatusText",
    ],
    "verify",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedArtifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  const projectStatusPath = optionalString(options.projectStatusPath, "projectStatusPath");
  const projectStatusText = optionalText(options.projectStatusText, "projectStatusText");
  if (artifactPath !== undefined && injectedArtifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "M05-T08 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildReferenceHostWebSignInEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  const stored =
    injectedArtifactBytes ??
    (await readRegularFile(
      artifactPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_MISSING",
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE",
      MAX_ARTIFACT_BYTES,
    ));
  if (!stored.equals(built.artifactBytes)) {
    fail(
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_DRIFT",
      "M05-T08 artifact bytes differ from the current deterministic build.",
      { expected: built.artifactSha256, actual: sha256(stored) },
    );
  }
  const storedArtifact = parseJson(
    stored,
    "M05-T08 artifact",
    "REFERENCE_HOST_SIGN_IN_ARTIFACT_DRIFT",
  );
  if (!isDeepStrictEqual(storedArtifact, built.artifact)) {
    fail(
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_DRIFT",
      "M05-T08 artifact semantics differ from the current deterministic build.",
    );
  }
  const [proofText, matrixText, statusText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_MATRIX_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    projectStatusText ??
      readRegularFile(
        projectStatusPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROJECT_STATUS_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation(proofText, matrixText, statusText, built.artifactSha256);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    sourceAssertions: built.artifact.evidence.sourceAssertions,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    fullAppTests: built.artifact.evidence.tests.fullAppCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    traceEntries: built.artifact.evidence.traceability.canonicalTrace.length,
    buildFiles: built.artifact.independentBuild.fileCount,
    buildAggregateSha256: built.artifact.independentBuild.aggregateSha256,
    exactDocumentationReferences: 10,
  });
}

/** Atomically writes exact freshly rebuilt deterministic M05-T08 evidence. */
export async function writeReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const workspaceRoot = optionalString(options.workspaceRoot, "workspaceRoot");
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildReferenceHostWebSignInEvidence({
    ...(workspaceRoot === undefined ? {} : { workspaceRoot }),
  });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE", "Atomic M05-T08 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    sourceAssertions: built.artifact.evidence.sourceAssertions,
    focusedTests: built.artifact.evidence.tests.focusedCases,
    fullAppTests: built.artifact.evidence.tests.fullAppCases,
    compilerNegativeCases: built.artifact.evidence.tests.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.tests.rootMutationTests,
    traceEntries: built.artifact.evidence.traceability.canonicalTrace.length,
    buildFiles: built.artifact.independentBuild.fileCount,
    buildAggregateSha256: built.artifact.independentBuild.aggregateSha256,
  });
}
