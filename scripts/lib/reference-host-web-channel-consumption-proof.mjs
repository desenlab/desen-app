import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, opendir, realpath, rm, writeFile } from "node:fs/promises";
import { constants as osConstants, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json";
const PROOF_DOCUMENT = "docs/proof/REFERENCE-HOST-WEB-CHANNEL-CONSUMPTION.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const SERVER_DIRECTORY = "apps/reference-host-web-server";
const CLIENT_DIRECTORY = "apps/reference-host-web";
const SERVER_DIST = `${SERVER_DIRECTORY}/dist`;
const CLIENT_DIST = `${CLIENT_DIRECTORY}/dist`;
const VITEST_CLI = path.join(ROOT, "node_modules/vitest/vitest.mjs");
const GENERATOR = "scripts/generate-reference-host-web-channel-consumption-proof.mjs";
const VERIFIER = "scripts/verify-reference-host-web-channel-consumption.mjs";
const PROOF_LIBRARY = "scripts/lib/reference-host-web-channel-consumption-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/reference-host-web-channel-consumption.test.mjs";

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_DISTRIBUTION_FILE_BYTES = 16 * 1_024 * 1_024;
const MAX_DISTRIBUTION_BYTES = 64 * 1_024 * 1_024;
const MAX_DISTRIBUTION_FILES = 512;
const MAX_DISTRIBUTION_ENTRIES = 1_024;
const MAX_DISTRIBUTION_PATH_BYTES = 4_096;
const MAX_DISTRIBUTION_DEPTH = 32;
const MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES = 8 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const KNOWN_RUNTIME_SUITE_SIGNALS = Object.freeze(
  Object.keys(osConstants.signals)
    .filter((signal) => /^SIG[A-Z0-9]+$/u.test(signal))
    .sort(),
);
const execFileAsync = promisify(execFile);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;

const PROOF_ID = "reference-host-web-channel-consumption";
const PROFILE = "desen.reference-host-web.channel-consumption-proof.v1";
const SUITE_PROFILE = "desen.reference-host-web.channel-consumption-suite.v1";
const LOOPBACK_CHILD_LISTENER_STEP_ID = "verify-reference-host-web-channel-consumption";
const LOOPBACK_CHILD_LISTENER_AUTHORITY_FILE = ".desen-ci-loopback-child-listener-authority.json";
const LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS = Object.freeze({
  authorityPath: "DESEN_CI_LOOPBACK_CHILD_LISTENER_AUTHORITY_PATH",
  grant: "DESEN_CI_LOOPBACK_CHILD_LISTENER_GRANT",
  token: "DESEN_CI_LOOPBACK_CHILD_LISTENER_TOKEN",
});
const LOOPBACK_CHILD_LISTENER_TOKEN_PATTERN = /^[0-9a-f]{64}$/u;
const VITEST_CONFIG_SOURCE =
  "export default { test: { cache: false, fileParallelism: false, maxWorkers: 1 } };\n";

const SERVER_SOURCE_FILES = Object.freeze([
  `${SERVER_DIRECTORY}/src/index.ts`,
  `${SERVER_DIRECTORY}/src/control-plane-client.ts`,
  `${SERVER_DIRECTORY}/src/installed-package-inventory.ts`,
  `${SERVER_DIRECTORY}/src/channel-activation-controller.ts`,
  `${SERVER_DIRECTORY}/src/server.ts`,
]);
const SERVER_TEST_FILES = Object.freeze([
  `${SERVER_DIRECTORY}/test/control-plane-client.test.ts`,
  `${SERVER_DIRECTORY}/test/installed-package-inventory.test.ts`,
  `${SERVER_DIRECTORY}/test/channel-activation-controller.test.ts`,
  `${SERVER_DIRECTORY}/test/server.test.ts`,
]);
const SERVER_TYPE_TEST = `${SERVER_DIRECTORY}/test-d/production-boundary.test-d.ts`;
const CLIENT_SOURCE_FILES = Object.freeze([
  `${CLIENT_DIRECTORY}/src/channel-delivery.ts`,
  `${CLIENT_DIRECTORY}/src/official-sign-in.ts`,
  `${CLIENT_DIRECTORY}/src/main.tsx`,
]);
const CLIENT_TEST_FILES = Object.freeze([
  `${CLIENT_DIRECTORY}/test/channel-delivery.test.tsx`,
  `${CLIENT_DIRECTORY}/test/main-lifecycle.test.tsx`,
  `${CLIENT_DIRECTORY}/test/official-sign-in.test.tsx`,
]);
const CLIENT_TYPE_TEST_FILES = Object.freeze([
  `${CLIENT_DIRECTORY}/test/channel-delivery.types.ts`,
  `${CLIENT_DIRECTORY}/test/official-sign-in.types.ts`,
]);
const RUNTIME_TEST_FILES = Object.freeze([...SERVER_TEST_FILES, ...CLIENT_TEST_FILES]);
const RUNTIME_TEST_TITLES_BY_FILE = Object.freeze({
  [`${SERVER_DIRECTORY}/test/control-plane-client.test.ts`]: Object.freeze([
    "[loopback-bearer-enforced] authenticates both fixed T05 reads",
    "rejects non-loopback origins and malformed trusted inputs before network work",
    "pins the exact official response media type independently for each T05 read route",
    "cancels an unread response body when exact response identity is rejected",
    "cancels an unread response body when its declared length is invalid",
    "rejects a BOM-prefixed channel body instead of normalizing its framing",
  ]),
  [`${SERVER_DIRECTORY}/test/installed-package-inventory.test.ts`]: Object.freeze([
    "loads the exact official Catalog and complete sorted dist inventory",
    "[installed-inventory-symlink-rejected] rejects a linked dist artifact",
    "rejects a hard-linked dist artifact outside the package root",
    "rejects a hard-linked Catalog outside the package root",
    "rejects a finite aggregate package overflow before reading all artifacts",
    "rejects an immediate installed-package directory fan-out at its entry ceiling",
  ]),
  [`${SERVER_DIRECTORY}/test/channel-activation-controller.test.ts`]: Object.freeze([
    "[valid-a-activation-delivery] activates and exposes the first valid candidate",
    "[invalid-b-preserves-a] retains the authenticated A delivery",
    "[valid-c-replaces-a] commits C with A as previous-good",
    "[restart-recovers-before-delivery] withholds C until complete reconstruction",
    "[stale-refresh-fenced] retries once against the newer channel snapshot",
    "[late-refresh-after-close-fenced] prevents publication after disposal",
    "exercises A-B-C preservation and restart recovery without socket authority",
  ]),
  [`${SERVER_DIRECTORY}/test/server.test.ts`]: Object.freeze([
    "activates one exact published channel identity through the server's single controller",
    "rejects malformed or mismatched publication identities without activating a candidate",
    "never reports Active when the host preserves a different last-known-good revision",
    "fails closed before refresh when unavailable and after the server lifetime closes",
    "serves the exact active envelope and keeps server authorities out of the response",
    "rejects cross-origin, body-bearing, query, and wrong-method refresh requests",
    "keeps the application authentication backend outside the reference server",
    "shares concurrent close completion until the listener is stopped",
    "rejects a finite static inventory overflow before opening activation state",
    "rejects too many empty static directories before opening activation state",
    "rejects too many static directory entries before opening activation state",
    "rejects a hard-linked static file before opening activation state",
  ]),
  [`${CLIENT_DIRECTORY}/test/channel-delivery.test.tsx`]: Object.freeze([
    "requests only the fixed bodyless same-origin endpoint and activates the exact Bundle",
    "coalesces concurrent refresh calls into one request and one promise",
    "keeps the current surface for malformed, redirected, encoded, and rejected responses",
    "[browser-mount-preserves-good] preserves A when a higher-generation Bundle fails the real session mount",
    "deduplicates the current durable identity and rejects a regressing generation",
    "replaces the mounted authority only after a newer delivery mounts successfully",
    "times out a fetch that ignores abort and admits a later clean refresh",
    "settles disposal immediately and fences a fetch response that arrives late",
  ]),
  [`${CLIENT_DIRECTORY}/test/main-lifecycle.test.tsx`]: Object.freeze([
    "preserves the production composition across BFCache entry and disposes on final pagehide",
    "keeps the host boot surface instead of falling back to the historical static Bundle",
  ]),
  [`${CLIENT_DIRECTORY}/test/official-sign-in.test.tsx`]: Object.freeze([
    "runs pending, declared failure, edited retry, success, and navigation through real adapters",
    "runs the production HTTP binding through runtime, real adapters, retry, and navigation",
    "denies an empty-password contract input before I/O and keeps service failure generic",
    "contains a pending same-document authority after exact session and host replacement",
    "redacts rejected host failures, permits explicit retry, and ignores late disposal results",
    "cleans host and session authorities when root activation cannot transfer ownership",
    "rejects accessor-backed composition input without invoking it",
    "rejects accessor-backed or extended delivered package policy without replacing A",
    "pins the exact controlled document and revision identities",
  ]),
});
const RUNTIME_TEST_TITLES = Object.freeze(Object.values(RUNTIME_TEST_TITLES_BY_FILE).flat().sort());
const SERVER_PRODUCTION_DEPENDENCIES = Object.freeze(["@desen/control-plane-api"]);
const CLIENT_PRODUCTION_DEPENDENCIES = Object.freeze([
  "@desen/reference-catalog-web",
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
  "react",
  "react-dom",
]);
const CLIENT_ALLOWED_EXTERNAL_IMPORTS = Object.freeze([
  "@desen/reference-catalog-web/catalog.json",
  "@desen/reference-catalog-web/host-operations",
  "@desen/reference-catalog-web/react-adapters",
  "@desen/runtime-core",
  "@desen/runtime-react",
  "@desen/runtime-web",
]);
const SERVER_ALLOWED_NODE_IMPORTS = Object.freeze([
  "node:fs",
  "node:fs/promises",
  "node:http",
  "node:path",
]);
const CLIENT_ALLOWED_EXTERNAL_RELATIVE_IMPORT =
  "../../../examples/sign-in/official-derived.bundle.desen.json";
const TRACKED_TASK_FILES = Object.freeze([
  `${SERVER_DIRECTORY}/package.json`,
  `${SERVER_DIRECTORY}/tsconfig.json`,
  `${SERVER_DIRECTORY}/tsconfig.build.json`,
  ...SERVER_SOURCE_FILES,
  ...SERVER_TEST_FILES,
  SERVER_TYPE_TEST,
  `${CLIENT_DIRECTORY}/package.json`,
  ...CLIENT_SOURCE_FILES,
  ...CLIENT_TEST_FILES,
  ...CLIENT_TYPE_TEST_FILES,
  TRACEABILITY,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
]);
const TRACKED_OVERRIDE_PATHS = Object.freeze(
  TRACKED_TASK_FILES.filter(
    (relativePath) =>
      relativePath !== GENERATOR &&
      relativePath !== VERIFIER &&
      relativePath !== PROOF_LIBRARY &&
      relativePath !== ATOMIC_WRITER,
  ),
);

export const REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS = Object.freeze([
  "valid-a-activation-delivery",
  "invalid-b-preserves-a",
  "valid-c-replaces-a",
  "restart-recovers-before-delivery",
  "stale-refresh-fenced",
  "late-refresh-after-close-fenced",
  "loopback-bearer-enforced",
  "installed-inventory-symlink-rejected",
  "browser-mount-preserves-good",
]);

export const REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact M07-T11 separately built channel-consumption artifact",
  "[determinism] two independent evidence builds are byte-identical",
  "[prerequisites] rejects drift in every immutable M05 and M07 artifact",
  "[runtime] rejects missing, duplicate, failed, and additional case identities",
  "[server-boundary] rejects private imports and weakened static or CSP guards",
  "[client-boundary] rejects control-plane, secret, editor, testkit, and manual-tree authority",
  "[inventory] rejects weakened bounded and symlink-safe package inventory guards",
  "[traceability] accepts only the exact PIPE-009 assignment",
  "[artifact] verifies exact bytes and rejects one changed byte",
  "[writer] atomically writes evidence and preserves the destination on failure",
  "[options] rejects unknown, accessor, proxy, cyclic, and shared-memory inputs",
  "[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority",
  "[immutability] recursively freezes the graph and preserves later-scope nonclaims",
]);

export const REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M05-T07",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
    bytes: 16_213,
    sha256: "cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2",
  }),
  Object.freeze({
    task: "M05-T08",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json",
    bytes: 21_847,
    sha256: "a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb",
  }),
  Object.freeze({
    task: "M05-T09",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json",
    bytes: 59_871,
    sha256: "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  }),
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    bytes: 22_396,
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "M07-T02",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json",
    bytes: 48_642,
    sha256: "db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a",
  }),
  Object.freeze({
    task: "M07-T03",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
    bytes: 62_743,
    sha256: "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    bytes: 34_612,
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T05",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
    bytes: 41_945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
  }),
  Object.freeze({
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    bytes: 47_622,
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
  }),
  Object.freeze({
    task: "M07-T07",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json",
    bytes: 49_892,
    sha256: "3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334",
  }),
  Object.freeze({
    task: "M07-T08",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json",
    bytes: 44_224,
    sha256: "c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9",
  }),
  Object.freeze({
    task: "M07-T09",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json",
    bytes: 64_493,
    sha256: "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
  }),
  Object.freeze({
    task: "M07-T10",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json",
    bytes: 58_059,
    sha256: "f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39",
  }),
]);

export const DEFAULT_REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ARTIFACT_PATH = path.join(
  ROOT,
  ARTIFACT,
);

export class ReferenceHostWebChannelConsumptionEvidenceError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "ReferenceHostWebChannelConsumptionEvidenceError";
    this.code = code;
    this.details = deepFreeze({ ...details });
  }
}

function fail(code, message, details = {}, options = {}) {
  throw new ReferenceHostWebChannelConsumptionEvidenceError(code, message, details, options);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function exactOwnDataRecord(value, allowedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("INVALID_OPTIONS", `${label} must be one inert ordinary record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key)) ||
    keys.length > allowedKeys.length
  ) {
    fail("INVALID_OPTIONS", `${label} contains an unsupported field.`, {
      actualKeys: keys.map(String),
      allowedKeys,
    });
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("INVALID_OPTIONS", `${label}.${String(key)} must be inert own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureByteView(value, label) {
  if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
    fail("INVALID_OPTIONS", `${label} must be one non-shared byte view.`);
  }
  let buffer;
  let byteLength;
  let byteOffset;
  try {
    buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch {
    fail("INVALID_OPTIONS", `${label} byte authority could not be captured.`);
  }
  if (
    (typeof SharedArrayBuffer === "function" && buffer instanceof SharedArrayBuffer) ||
    byteLength > MAX_AUTHORITY_BYTES
  ) {
    fail("INVALID_OPTIONS", `${label} exceeds its byte authority.`);
  }
  return Buffer.from(
    Uint8Array.prototype.slice.call(new Uint8Array(buffer, byteOffset, byteLength)),
  );
}

function captureByteMap(value, allowedPaths, label) {
  if (value === undefined) return new Map();
  const record = exactOwnDataRecord(value, allowedPaths, label);
  const captured = new Map();
  for (const [relativePath, bytes] of Object.entries(record)) {
    captured.set(relativePath, captureByteView(bytes, `${label}.${relativePath}`));
  }
  return captured;
}

function captureSuiteReceipt(value) {
  const record = exactOwnDataRecord(
    value,
    [
      "schemaVersion",
      "profile",
      "status",
      "caseCount",
      "caseIds",
      "testCount",
      "testTitles",
      "suiteFiles",
    ],
    "runtimeSuiteReceipt",
  );
  if (
    record.schemaVersion !== 1 ||
    record.profile !== SUITE_PROFILE ||
    record.status !== "PASS" ||
    record.caseCount !== REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.length ||
    record.testCount !== RUNTIME_TEST_TITLES.length
  ) {
    fail("INVALID_OPTIONS", "runtimeSuiteReceipt metadata is invalid.");
  }
  const captureStringArray = (candidate, expected, label) => {
    if (!Array.isArray(candidate) || utilTypes.isProxy(candidate)) {
      fail("RUNTIME_SUITE_MISMATCH", `${label} differs from the closed suite authority.`, {
        expected,
      });
    }
    const keys = Reflect.ownKeys(candidate);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(candidate, "length");
    const captured = [];
    if (
      keys.length !== expected.length + 1 ||
      keys.some(
        (key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
      ) ||
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.value !== expected.length
    ) {
      fail("RUNTIME_SUITE_MISMATCH", `${label} differs from the closed suite authority.`, {
        expected,
      });
    }
    for (let index = 0; index < expected.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(candidate, String(index));
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        descriptor.value !== expected[index]
      ) {
        fail("RUNTIME_SUITE_MISMATCH", `${label} differs from the closed suite authority.`, {
          expected,
        });
      }
      captured.push(descriptor.value);
    }
    return captured;
  };
  return deepFreeze({
    schemaVersion: 1,
    profile: SUITE_PROFILE,
    status: "PASS",
    caseCount: record.caseCount,
    caseIds: captureStringArray(
      record.caseIds,
      REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS,
      "runtimeSuiteReceipt.caseIds",
    ),
    testCount: record.testCount,
    testTitles: captureStringArray(
      record.testTitles,
      RUNTIME_TEST_TITLES,
      "runtimeSuiteReceipt.testTitles",
    ),
    suiteFiles: captureStringArray(
      record.suiteFiles,
      RUNTIME_TEST_FILES,
      "runtimeSuiteReceipt.suiteFiles",
    ),
  });
}

export const REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_EXPECTED_SUITE_RECEIPT = deepFreeze({
  schemaVersion: 1,
  profile: SUITE_PROFILE,
  status: "PASS",
  caseCount: REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.length,
  caseIds: [...REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS],
  testCount: RUNTIME_TEST_TITLES.length,
  testTitles: [...RUNTIME_TEST_TITLES],
  suiteFiles: [...RUNTIME_TEST_FILES],
});

function captureOptions(rawOptions, mode) {
  const allowed =
    mode === "write"
      ? ["artifactPath", "beforeAtomicRename", "runtimeSuiteReceipt"]
      : ["prerequisiteBytes", "trackedFileBytes", "runtimeSuiteReceipt"];
  if (mode === "verify") {
    allowed.push("artifactBytes", "artifactPath", "proofDocument", "proofDocumentPath");
  }
  const options =
    rawOptions === undefined ? {} : exactOwnDataRecord(rawOptions, allowed, "options");
  const captured = {
    prerequisiteBytes: captureByteMap(
      options.prerequisiteBytes,
      REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS.map(
        ({ path: itemPath }) => itemPath,
      ),
      "prerequisiteBytes",
    ),
    trackedFileBytes: captureByteMap(
      options.trackedFileBytes,
      TRACKED_OVERRIDE_PATHS,
      "trackedFileBytes",
    ),
    runtimeSuiteReceipt:
      options.runtimeSuiteReceipt === undefined
        ? undefined
        : captureSuiteReceipt(options.runtimeSuiteReceipt),
  };
  if (mode === "verify") {
    captured.artifactBytes =
      options.artifactBytes === undefined
        ? undefined
        : captureByteView(options.artifactBytes, "artifactBytes");
    captured.artifactPath = options.artifactPath;
    captured.proofDocument = options.proofDocument;
    captured.proofDocumentPath = options.proofDocumentPath;
  }
  if (mode === "write") {
    captured.artifactPath = options.artifactPath;
    captured.beforeAtomicRename = options.beforeAtomicRename;
  }
  for (const key of ["artifactPath", "proofDocumentPath"]) {
    if (
      captured[key] !== undefined &&
      (typeof captured[key] !== "string" ||
        captured[key].length === 0 ||
        captured[key].length > 4096)
    ) {
      fail("INVALID_OPTIONS", `${key} must be one bounded nonempty path.`);
    }
  }
  if (
    captured.proofDocument !== undefined &&
    (typeof captured.proofDocument !== "string" ||
      captured.proofDocument.length > 2 * 1_024 * 1_024)
  ) {
    fail("INVALID_OPTIONS", "proofDocument must be one bounded string.");
  }
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  return captured;
}

async function canonicalWorkspaceRoot() {
  try {
    return await realpath(ROOT);
  } catch (error) {
    fail(
      "UNSAFE_AUTHORITY",
      "The workspace root could not be authenticated.",
      {},
      { cause: error },
    );
  }
}

async function readRegularAuthority(relativePath, maximumBytes = MAX_AUTHORITY_BYTES) {
  const workspaceRoot = await canonicalWorkspaceRoot();
  const absolutePath = path.join(workspaceRoot, relativePath);
  const parent = path.dirname(absolutePath);
  let handle;
  try {
    if ((await realpath(parent)) !== parent) {
      fail("UNSAFE_AUTHORITY", "An authority parent is not canonical.", { relativePath });
    }
    const before = await lstat(absolutePath);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > maximumBytes
    ) {
      fail("UNSAFE_AUTHORITY", "An authority is not one bounded singly linked regular file.", {
        relativePath,
      });
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !opened.isFile() ||
      !after.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.mtimeMs !== before.mtimeMs ||
      opened.ctimeMs !== before.ctimeMs ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      opened.size !== bytes.byteLength ||
      after.size !== bytes.byteLength ||
      bytes.byteLength > maximumBytes
    ) {
      fail("UNSAFE_AUTHORITY", "An authority changed identity or size while it was read.", {
        relativePath,
      });
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebChannelConsumptionEvidenceError) throw error;
    fail(
      "UNSAFE_AUTHORITY",
      "An authority could not be opened safely.",
      { relativePath },
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readTrackedFiles(overrides) {
  const result = new Map();
  for (const relativePath of TRACKED_TASK_FILES) {
    result.set(
      relativePath,
      overrides.get(relativePath) ?? (await readRegularAuthority(relativePath)),
    );
  }
  return result;
}

async function scanDistribution(relativeRoot, profile) {
  const workspaceRoot = await canonicalWorkspaceRoot();
  const absoluteRoot = path.join(workspaceRoot, relativeRoot);
  let rootStat;
  try {
    rootStat = await lstat(absoluteRoot);
  } catch (error) {
    fail(
      "DISTRIBUTION_UNSAFE",
      "A required built distribution is absent.",
      { relativeRoot },
      { cause: error },
    );
  }
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    (await realpath(absoluteRoot)) !== absoluteRoot
  ) {
    fail("DISTRIBUTION_UNSAFE", "A built distribution root is not one canonical directory.", {
      relativeRoot,
    });
  }
  const pending = [""];
  const files = [];
  let totalBytes = 0;
  let entryCount = 0;
  while (pending.length > 0) {
    const directoryRelative = pending.shift();
    const directory = path.join(absoluteRoot, directoryRelative);
    const directoryStat = await lstat(directory);
    if (
      directoryStat.isSymbolicLink() ||
      !directoryStat.isDirectory() ||
      (await realpath(directory)) !== directory
    ) {
      fail("DISTRIBUTION_UNSAFE", "A built distribution directory is not canonical.", {
        relativePath: directoryRelative,
      });
    }
    /** @type {import("node:fs").Dirent[]} */
    const entries = [];
    const directoryHandle = await opendir(directory, { bufferSize: 32 });
    for await (const entry of directoryHandle) {
      entryCount += 1;
      if (entryCount > MAX_DISTRIBUTION_ENTRIES) {
        fail("DISTRIBUTION_LIMIT_EXCEEDED", "A built distribution path profile is not finite.", {
          relativePath: directoryRelative,
        });
      }
      entries.push(entry);
    }
    entries.sort((left, right) => codeUnitOrder(left.name, right.name));
    for (const entry of entries) {
      const childRelative = path.posix.join(
        directoryRelative.split(path.sep).join("/"),
        entry.name,
      );
      if (
        Buffer.byteLength(childRelative, "utf8") > MAX_DISTRIBUTION_PATH_BYTES ||
        childRelative.split("/").length > MAX_DISTRIBUTION_DEPTH
      ) {
        fail("DISTRIBUTION_LIMIT_EXCEEDED", "A built distribution path profile is not finite.", {
          relativePath: childRelative,
        });
      }
      const childAbsolute = path.join(absoluteRoot, childRelative);
      const childStat = await lstat(childAbsolute);
      if (entry.isSymbolicLink() || childStat.isSymbolicLink()) {
        fail("DISTRIBUTION_UNSAFE", "A built distribution contains a symbolic link.", {
          relativePath: childRelative,
        });
      }
      if (entry.isDirectory() && childStat.isDirectory()) {
        pending.push(childRelative);
        continue;
      }
      if (!entry.isFile() || !childStat.isFile() || childStat.nlink !== 1) {
        fail("DISTRIBUTION_UNSAFE", "A built distribution contains a non-regular entry.", {
          relativePath: childRelative,
        });
      }
      if (files.length >= MAX_DISTRIBUTION_FILES || childStat.size > MAX_DISTRIBUTION_FILE_BYTES) {
        fail("DISTRIBUTION_LIMIT_EXCEEDED", "A built distribution exceeds its finite profile.", {
          relativePath: childRelative,
        });
      }
      let handle;
      try {
        handle = await open(childAbsolute, READ_FLAGS);
        const opened = await handle.stat();
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (
          !opened.isFile() ||
          !after.isFile() ||
          opened.dev !== childStat.dev ||
          opened.ino !== childStat.ino ||
          opened.mtimeMs !== childStat.mtimeMs ||
          opened.ctimeMs !== childStat.ctimeMs ||
          after.dev !== opened.dev ||
          after.ino !== opened.ino ||
          after.mtimeMs !== opened.mtimeMs ||
          after.ctimeMs !== opened.ctimeMs ||
          opened.size !== bytes.byteLength ||
          after.size !== bytes.byteLength
        ) {
          fail("DISTRIBUTION_UNSAFE", "A built file changed while it was read.", {
            relativePath: childRelative,
          });
        }
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_DISTRIBUTION_BYTES) {
          fail("DISTRIBUTION_LIMIT_EXCEEDED", "A built distribution exceeds its byte ceiling.");
        }
        files.push(
          deepFreeze({
            path: childRelative,
            bytes: bytes.byteLength,
            sha256: sha256(bytes),
            content: bytes,
          }),
        );
      } finally {
        await handle?.close().catch(() => undefined);
      }
    }
  }
  files.sort((left, right) => codeUnitOrder(left.path, right.path));
  const publicFiles = files.map(({ path: itemPath, bytes, sha256: itemSha256 }) => ({
    path: itemPath,
    bytes,
    sha256: itemSha256,
  }));
  return deepFreeze({
    profile,
    root: relativeRoot,
    entryCount,
    fileCount: files.length,
    totalBytes,
    inventorySha256: sha256(Buffer.from(JSON.stringify(publicFiles))),
    files,
    publicFiles,
  });
}

function parseJson(bytes, relativePath) {
  let decoded;
  let value;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(decoded);
  } catch (error) {
    fail(
      "SOURCE_DRIFT",
      `${relativePath} is not canonical UTF-8 JSON authority.`,
      {},
      { cause: error },
    );
  }
  return value;
}

function collectModuleReferences(source, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    fatalText(source, relativePath),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  const unsafeExpressions = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        specifiers.push(node.arguments[0].text);
      } else {
        unsafeExpressions.push("non-literal import()");
      }
    } else if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) &&
        ["require", "createRequire"].includes(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "require"))
    ) {
      unsafeExpressions.push("CommonJS module loading");
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (expression !== undefined && ts.isStringLiteral(expression)) {
        specifiers.push(expression.text);
      } else {
        unsafeExpressions.push("non-literal import equals");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { specifiers, unsafeExpressions };
}

function relativeImportStaysWithin(relativePath, specifier, allowedRoot) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return false;
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(relativePath), specifier),
  );
  return resolved.startsWith(`${allowedRoot}/`);
}

function auditPackageManifests(tracked) {
  const serverPath = `${SERVER_DIRECTORY}/package.json`;
  const clientPath = `${CLIENT_DIRECTORY}/package.json`;
  const server = parseJson(tracked.get(serverPath), serverPath);
  const client = parseJson(tracked.get(clientPath), clientPath);
  const serverDependencies = Object.keys(server.dependencies ?? {}).sort();
  const clientDependencies = Object.keys(client.dependencies ?? {}).sort();
  if (
    server.name !== "@desen/reference-host-web-server" ||
    server.private !== true ||
    server.type !== "module"
  ) {
    fail(
      "SERVER_BOUNDARY_DRIFT",
      "The server package manifest no longer owns the reviewed composition root.",
    );
  }
  const forbiddenDependency =
    /(?:^|\/)(?:desen-app|desen-run|editor-core|editor-web|publisher|testkit|desen)$/u;
  if (
    serverDependencies.some((name) => forbiddenDependency.test(name)) ||
    clientDependencies.includes("@desen/control-plane-api") ||
    clientDependencies.some((name) => forbiddenDependency.test(name))
  ) {
    fail(
      "DEPENDENCY_BOUNDARY_DRIFT",
      "A host package depends on a forbidden application or authoring surface.",
    );
  }
  if (
    serverDependencies.length !== SERVER_PRODUCTION_DEPENDENCIES.length ||
    serverDependencies.some((name, index) => name !== SERVER_PRODUCTION_DEPENDENCIES[index])
  ) {
    fail(
      "SERVER_BOUNDARY_DRIFT",
      "The server package must expose exactly the public control-plane root as production dependency.",
      { expected: SERVER_PRODUCTION_DEPENDENCIES, actual: serverDependencies },
    );
  }
  if (
    clientDependencies.length !== CLIENT_PRODUCTION_DEPENDENCIES.length ||
    clientDependencies.some((name, index) => name !== CLIENT_PRODUCTION_DEPENDENCIES[index])
  ) {
    fail(
      "DEPENDENCY_BOUNDARY_DRIFT",
      "The browser package production dependency inventory is not exact and closed.",
      { expected: CLIENT_PRODUCTION_DEPENDENCIES, actual: clientDependencies },
    );
  }
  return deepFreeze({ serverDependencies, clientDependencies });
}

function auditServerSources(tracked) {
  const imports = [];
  for (const relativePath of SERVER_SOURCE_FILES) {
    const source = tracked.get(relativePath);
    const references = collectModuleReferences(source, relativePath);
    if (references.unsafeExpressions.length > 0) {
      fail(
        "SERVER_BOUNDARY_DRIFT",
        "The server production graph contains an unbounded module-loading expression.",
        { relativePath, expressions: references.unsafeExpressions },
      );
    }
    for (const specifier of references.specifiers) {
      imports.push({ relativePath, specifier });
      const ownRelative = relativeImportStaysWithin(
        relativePath,
        specifier,
        `${SERVER_DIRECTORY}/src`,
      );
      if (
        specifier !== "@desen/control-plane-api" &&
        !SERVER_ALLOWED_NODE_IMPORTS.includes(specifier) &&
        !ownRelative
      ) {
        fail(
          "SERVER_BOUNDARY_DRIFT",
          "The server imports outside Node, its own relative modules, or the public control-plane root.",
          {
            relativePath,
            specifier,
          },
        );
      }
    }
  }
  if (!imports.some(({ specifier }) => specifier === "@desen/control-plane-api")) {
    fail(
      "SERVER_BOUNDARY_DRIFT",
      "The server no longer composes the public control-plane package root.",
    );
  }
  const inventorySource = tracked
    .get(`${SERVER_DIRECTORY}/src/installed-package-inventory.ts`)
    .toString("utf8");
  const requiredInventorySignals = [
    /O_NOFOLLOW/u,
    /realpath/u,
    /opendir\(directory, \{ bufferSize: 32 \}\)/u,
    /nlink\s*!==\s*1/u,
    /entryStatus\.isFile\(\)\s*&&\s*entryStatus\.nlink\s*===\s*1/u,
    /MAX_PACKAGE_ENTRIES/u,
    /entryCount \+= 1;/u,
    /entryCount > MAX_PACKAGE_ENTRIES/u,
    /maxArtifactEntryBytes/u,
    /maxPackagePreimageBytes/u,
    /maxArtifactsPerPackage/u,
    /catalog\.json/u,
    /dist/u,
  ];
  if (requiredInventorySignals.some((pattern) => !pattern.test(inventorySource))) {
    fail(
      "INVENTORY_GUARD_DRIFT",
      "The installed-package loader lost a bounded or symlink-safe guard.",
    );
  }
  const controller = tracked
    .get(`${SERVER_DIRECTORY}/src/channel-activation-controller.ts`)
    .toString("utf8");
  for (const signal of ["activate", "recover", "generation", "previousGood", "channel"]) {
    if (!controller.includes(signal)) {
      fail(
        "SERVER_BOUNDARY_DRIFT",
        "The channel controller lost an activation/recovery invariant.",
        {
          signal,
        },
      );
    }
  }
  const serverSource = tracked.get(`${SERVER_DIRECTORY}/src/server.ts`).toString("utf8");
  const requiredServerSignals = [
    /const MAX_STATIC_DIRECTORIES = 256;/u,
    /const MAX_STATIC_ENTRIES = 384;/u,
    /opendir\(directory, \{ bufferSize: 32 \}\)/u,
    /directoryCount \+= 1;/u,
    /directoryCount > MAX_STATIC_DIRECTORIES/u,
    /entryCount \+= 1;/u,
    /entryCount > MAX_STATIC_ENTRIES/u,
    /^\s*"script-src 'self'",$/mu,
    /^\s*"style-src-elem 'self'",$/mu,
    /^\s*"style-src-attr 'unsafe-inline'",$/mu,
  ];
  if (
    !serverSource.includes("/__desen/runtime/refresh") ||
    (!serverSource.includes("etag") && !serverSource.includes("ETag")) ||
    requiredServerSignals.some((pattern) => !pattern.test(serverSource))
  ) {
    fail(
      "SERVER_BOUNDARY_DRIFT",
      "The same-origin refresh, bounded static inventory, or exact CSP boundary drifted.",
    );
  }
  return deepFreeze({ imports });
}

function auditClientSources(tracked, clientDistribution) {
  const imports = [];
  const forbiddenSpecifier =
    /(?:control-plane-api|better-sqlite3|desen-app|desen-run|editor-core|editor-web|publisher|testkit)/u;
  for (const relativePath of CLIENT_SOURCE_FILES) {
    const source = tracked.get(relativePath);
    const references = collectModuleReferences(source, relativePath);
    if (references.unsafeExpressions.length > 0) {
      fail(
        "CLIENT_GRAPH_DRIFT",
        "The browser production graph contains an unbounded module-loading expression.",
        { relativePath, expressions: references.unsafeExpressions },
      );
    }
    for (const specifier of references.specifiers) {
      imports.push({ relativePath, specifier });
      const allowedExternal = CLIENT_PRODUCTION_DEPENDENCIES.some(
        (dependency) => specifier === dependency || specifier.startsWith(`${dependency}/`),
      );
      const ownRelative = relativeImportStaysWithin(
        relativePath,
        specifier,
        `${CLIENT_DIRECTORY}/src`,
      );
      const reviewedFixtureRelative =
        relativePath === `${CLIENT_DIRECTORY}/src/official-sign-in.ts` &&
        specifier === CLIENT_ALLOWED_EXTERNAL_RELATIVE_IMPORT;
      if (
        (!ownRelative &&
          !reviewedFixtureRelative &&
          (!allowedExternal || !CLIENT_ALLOWED_EXTERNAL_IMPORTS.includes(specifier))) ||
        specifier.startsWith("node:") ||
        forbiddenSpecifier.test(specifier)
      ) {
        fail(
          "CLIENT_GRAPH_DRIFT",
          "The browser graph imports a server, native, or authoring surface.",
          {
            relativePath,
            specifier,
          },
        );
      }
    }
  }
  const deliveryPath = `${CLIENT_DIRECTORY}/src/channel-delivery.ts`;
  const delivery = tracked.get(deliveryPath).toString("utf8");
  const deliveryAst = ts.createSourceFile(
    deliveryPath,
    delivery,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let containsJsxAuthority = false;
  const visitDelivery = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      containsJsxAuthority = true;
    }
    ts.forEachChild(node, visitDelivery);
  };
  visitDelivery(deliveryAst);
  if (
    !delivery.includes("/__desen/runtime/refresh") ||
    !delivery.includes("activateReferenceHostDeliveredSignIn") ||
    containsJsxAuthority ||
    /(?:React\.)?createElement\s*\(|\bjsx(?:s)?\s*\(/u.test(delivery)
  ) {
    fail("CLIENT_GRAPH_DRIFT", "Browser delivery no longer delegates to the fixed host activator.");
  }
  const mainSource = tracked.get(`${CLIENT_DIRECTORY}/src/main.tsx`).toString("utf8");
  for (const signal of [
    "createReferenceHostChannelDelivery",
    "refreshReferenceHostChannel(channelDelivery)",
    'addEventListener("pageshow", refreshAfterPageShow)',
    'addEventListener("pagehide", disposeOnFinalPageHide)',
    "disposeReferenceHostChannelDelivery(channelDelivery)",
    "disposeReferenceHostRoot(referenceHostRoot)",
  ]) {
    if (!mainSource.includes(signal)) {
      fail(
        "CLIENT_GRAPH_DRIFT",
        "The production entry lost its reviewed channel lifecycle wiring.",
        {
          signal,
        },
      );
    }
  }
  const activatorSource = tracked
    .get(`${CLIENT_DIRECTORY}/src/official-sign-in.ts`)
    .toString("utf8");
  for (const signal of [
    "activateReferenceHostDeliveredSignIn",
    "captureBundlePolicy",
    "mountRuntimeHeadlessSession",
    "renderRuntimeReactSurface",
    "activateReferenceHostSurface",
  ]) {
    if (!activatorSource.includes(signal)) {
      fail("CLIENT_GRAPH_DRIFT", "The delivered Bundle activator lost a reviewed authority seam.", {
        signal,
      });
    }
  }
  const clientText = Buffer.concat(clientDistribution.files.map(({ content }) => content)).toString(
    "utf8",
  );
  for (const forbidden of [
    "@desen/control-plane-api",
    "better-sqlite3",
    "Authorization: Bearer",
    "apps/reference-host-web-server",
    "runtime-activation-sqlite-internal",
  ]) {
    if (clientText.includes(forbidden)) {
      fail(
        "CLIENT_DISTRIBUTION_DRIFT",
        "The browser distribution contains a forbidden server authority.",
        {
          forbidden,
        },
      );
    }
  }
  return deepFreeze({ imports });
}

function assertServerDistribution(distribution) {
  const expected = SERVER_SOURCE_FILES.flatMap((relativePath) => {
    const base = path.posix.basename(relativePath, ".ts");
    return [`${base}.d.ts`, `${base}.d.ts.map`, `${base}.js`, `${base}.js.map`];
  }).sort();
  const actual = distribution.publicFiles.map(({ path: itemPath }) => itemPath);
  if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
    fail("SERVER_DISTRIBUTION_DRIFT", "The built server distribution inventory drifted.", {
      expected,
      actual,
    });
  }
}

function assertClientDistribution(distribution) {
  const paths = distribution.publicFiles.map(({ path: itemPath }) => itemPath);
  if (
    paths.length !== 3 ||
    !paths.includes("index.html") ||
    paths.filter((item) => /^assets\/index-[A-Za-z0-9_-]+\.js$/u.test(item)).length !== 1 ||
    paths.filter((item) => /^assets\/index-[A-Za-z0-9_-]+\.css$/u.test(item)).length !== 1
  ) {
    fail("CLIENT_DISTRIBUTION_DRIFT", "The independently built browser inventory drifted.", {
      paths,
    });
  }
}

function codeUnitOrder(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function safeReadAbsolute(requestedPath, maximumBytes = MAX_AUTHORITY_BYTES) {
  const absolutePath = path.resolve(requestedPath);
  const parent = path.dirname(absolutePath);
  let handle;
  try {
    if ((await realpath(parent)) !== parent) {
      fail("UNSAFE_AUTHORITY", "An external authority parent is not canonical.");
    }
    const before = await lstat(absolutePath);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > maximumBytes
    ) {
      fail(
        "UNSAFE_AUTHORITY",
        "An external authority is not one bounded singly linked regular file.",
      );
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !opened.isFile() ||
      !after.isFile() ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.mtimeMs !== before.mtimeMs ||
      opened.ctimeMs !== before.ctimeMs ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs ||
      opened.size !== bytes.byteLength ||
      after.size !== bytes.byteLength ||
      bytes.byteLength > maximumBytes
    ) {
      fail("UNSAFE_AUTHORITY", "An external authority changed while it was read.");
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebChannelConsumptionEvidenceError) throw error;
    fail(
      "UNSAFE_AUTHORITY",
      "An external authority could not be opened safely.",
      {},
      { cause: error },
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function fatalText(bytes, relativePath, code = "SOURCE_DRIFT") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail(code, `${relativePath} is not valid UTF-8 authority.`, {}, { cause: error });
  }
}

async function prerequisiteProjection(overrides) {
  const receipts = [];
  for (const pin of REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_PREREQUISITE_PINS) {
    const bytes = overrides.get(pin.path) ?? (await readRegularAuthority(pin.path));
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite drifted.`, {
        task: pin.task,
        path: pin.path,
      });
    }
    const authority = parseJson(bytes, pin.path);
    if (authority?.task !== pin.task || authority?.result !== "PASS") {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite is not a PASS authority.`);
    }
    receipts.push({ ...pin });
  }
  return deepFreeze(receipts);
}

function callTestTitles(source, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.JS,
  );
  const titles = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      ((ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ["it", "test"].includes(node.expression.name.text)))
    ) {
      titles.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return titles;
}

function testAuthorityProjection(tracked) {
  const runtimeTestsByFile = Object.fromEntries(
    RUNTIME_TEST_FILES.map((relativePath) => {
      const actual = callTestTitles(
        fatalText(tracked.get(relativePath), relativePath),
        relativePath,
      );
      const expected = RUNTIME_TEST_TITLES_BY_FILE[relativePath];
      if (
        expected === undefined ||
        actual.length !== expected.length ||
        actual.some((title, index) => title !== expected[index])
      ) {
        fail("TEST_AUTHORITY_DRIFT", "A focused runtime test inventory is not exact and closed.", {
          relativePath,
          expected,
          actual,
        });
      }
      return [relativePath, actual];
    }),
  );
  const runtimeTitles = Object.values(runtimeTestsByFile).flat();
  const observedIds = runtimeTitles
    .map((title) => /^\[([^\]]+)\]/u.exec(title)?.[1])
    .filter((value) => value !== undefined);
  if (
    observedIds.length !== REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.length ||
    observedIds.some(
      (caseId) => !REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.includes(caseId),
    ) ||
    REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.some(
      (expected) => observedIds.filter((caseId) => caseId === expected).length !== 1,
    )
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The focused runtime case inventory is not exact and closed.", {
      expected: REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS,
      actual: observedIds,
    });
  }
  const rootTitles = callTestTitles(fatalText(tracked.get(ROOT_TEST), ROOT_TEST), ROOT_TEST);
  if (
    rootTitles.length !== REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ROOT_TEST_NAMES.length ||
    rootTitles.some(
      (title, index) => title !== REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ROOT_TEST_NAMES[index],
    )
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The root mutation-test inventory is not exact and closed.");
  }
  const sourceReceipts = Object.fromEntries(
    [
      ...SERVER_SOURCE_FILES,
      ...SERVER_TEST_FILES,
      SERVER_TYPE_TEST,
      ...CLIENT_SOURCE_FILES,
      ...CLIENT_TEST_FILES,
      ...CLIENT_TYPE_TEST_FILES,
      ROOT_TEST,
    ]
      .map((relativePath) => {
        const bytes = tracked.get(relativePath);
        return [relativePath, { bytes: bytes.byteLength, sha256: sha256(bytes) }];
      })
      .sort(([left], [right]) => codeUnitOrder(left, right)),
  );
  return deepFreeze({
    runtimeCaseCount: observedIds.length,
    runtimeCaseIds: [...REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS],
    runtimeTestCount: runtimeTitles.length,
    runtimeTestsByFile,
    rootMutationCaseCount: rootTitles.length,
    rootMutationCaseNames: rootTitles,
    sourceReceipts,
  });
}

function findM07T11TraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) findM07T11TraceRows(child, found);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  if (
    typeof value.id === "string" &&
    ((Array.isArray(value.owners) && value.owners.includes("M07-T11")) ||
      (Array.isArray(value.tests) && value.tests.includes("M07-T11")))
  ) {
    found.push(value);
  }
  for (const child of Object.values(value)) findM07T11TraceRows(child, found);
  return found;
}

function traceProjection(tracked) {
  const authority = parseJson(tracked.get(TRACEABILITY), TRACEABILITY);
  const rows = findM07T11TraceRows(authority);
  const expected = {
    id: "PIPE-009",
    section: "24.1",
    line: 1304,
    anchor: "fetch or receive the immutable bundle",
    summary: "Activation step 1: receive immutable bundle",
    owners: ["M07-T01", "M07-T11"],
    tests: ["M07-T09"],
    evidence: "Fetch failure preserves the durable active record",
  };
  if (rows.length !== 1 || JSON.stringify(rows[0]) !== JSON.stringify(expected)) {
    fail("TRACE_DRIFT", "Only the exact PIPE-009 M07-T11 trace assignment is allowed.");
  }
  return deepFreeze([structuredClone(expected)]);
}

function runtimeSuiteErrorData(error, key) {
  if (error === null || typeof error !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function boundedRuntimeOutput(value) {
  if (typeof value !== "string") {
    return Object.freeze({ bytes: 0, sha256: sha256(Buffer.alloc(0)), text: "" });
  }
  const bytes = Buffer.byteLength(value, "utf8");
  return Object.freeze({
    bytes,
    sha256: bytes <= MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES ? sha256(Buffer.from(value)) : null,
    text: bytes <= MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES ? value : "",
  });
}

function failureReport(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return Object.freeze({ failedCaseIds: [], failedSuiteCount: null, failedTestCount: null });
  }
  const failedCaseIds = [];
  if (
    Array.isArray(report?.testResults) &&
    report.testResults.length <= RUNTIME_TEST_FILES.length
  ) {
    for (const result of report.testResults) {
      if (!Array.isArray(result?.assertionResults) || result.assertionResults.length > 128)
        continue;
      for (const assertion of result.assertionResults) {
        if (assertion?.status !== "failed" || typeof assertion.title !== "string") continue;
        const caseId = /^\[([^\]]+)\]/u.exec(assertion.title)?.[1];
        if (
          caseId !== undefined &&
          REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.includes(caseId) &&
          !failedCaseIds.includes(caseId)
        ) {
          failedCaseIds.push(caseId);
        }
      }
    }
  }
  return Object.freeze({
    failedCaseIds,
    failedSuiteCount: Number.isSafeInteger(report?.numFailedTestSuites)
      ? report.numFailedTestSuites
      : null,
    failedTestCount: Number.isSafeInteger(report?.numFailedTests) ? report.numFailedTests : null,
  });
}

/** Reduces a nested Vitest failure to bounded, path-free, code-owned diagnostics. */
export function summarizeReferenceHostWebChannelConsumptionSuiteFailure(error) {
  const stdout = boundedRuntimeOutput(runtimeSuiteErrorData(error, "stdout"));
  const stderr = boundedRuntimeOutput(runtimeSuiteErrorData(error, "stderr"));
  const report = failureReport(stdout.text);
  const code = runtimeSuiteErrorData(error, "code");
  const killed = runtimeSuiteErrorData(error, "killed");
  const diagnostic = `${stdout.text}\n${stderr.text}`;
  let category = "CHILD_PROCESS_FAILED";
  if (killed === true || code === "ETIMEDOUT") category = "TIMEOUT_OR_TERMINATION";
  else if (
    code === "ERR_ACCESS_DENIED" ||
    code === "EACCES" ||
    code === "EPERM" ||
    /ERR_ACCESS_DENIED|Access to this API has been restricted|permission denied|\bEACCES\b|\bEPERM\b/iu.test(
      diagnostic,
    )
  ) {
    category = "ACCESS_DENIED";
  } else if ((report.failedTestCount ?? 0) > 0) category = "TEST_ASSERTION_FAILED";
  else if ((report.failedSuiteCount ?? 0) > 0) category = "TEST_SUITE_FAILED";
  const signal = runtimeSuiteErrorData(error, "signal");
  return deepFreeze({
    category,
    exitCode: Number.isSafeInteger(code) ? code : null,
    failedCaseIds: report.failedCaseIds,
    failedSuiteCount: report.failedSuiteCount,
    failedTestCount: report.failedTestCount,
    signal:
      typeof signal === "string" && KNOWN_RUNTIME_SUITE_SIGNALS.includes(signal) ? signal : null,
    stderrBytes: stderr.bytes,
    stderrSha256: stderr.sha256,
    stdoutBytes: stdout.bytes,
    stdoutSha256: stdout.sha256,
  });
}

/**
 * Delegates the runner-authenticated listener token only to the focused Vitest process tree.
 * The verifier parent never receives the grant marker, while Vitest fork workers inherit the
 * unchanged guarded `NODE_OPTIONS` and the same bounded child-runtime authority.
 */
export function createReferenceHostWebChannelConsumptionRuntimeEnvironment(
  baseEnvironment = process.env,
) {
  if (
    baseEnvironment === null ||
    typeof baseEnvironment !== "object" ||
    Array.isArray(baseEnvironment) ||
    utilTypes.isProxy(baseEnvironment)
  ) {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T11 runtime environment is invalid.");
  }
  const environment = {};
  for (const key of Object.keys(baseEnvironment)) {
    const descriptor = Object.getOwnPropertyDescriptor(baseEnvironment, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      continue;
    }
    environment[key] = descriptor.value;
  }
  environment.CI = "1";
  Reflect.deleteProperty(environment, "NODE_PATH");
  Reflect.deleteProperty(environment, LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.grant);

  const authorityPath = environment[LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.authorityPath];
  const token = environment[LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.token];
  const tempRoot = environment.TMPDIR;
  const delegated =
    environment.DESEN_CI_STEP_ID === LOOPBACK_CHILD_LISTENER_STEP_ID &&
    typeof authorityPath === "string" &&
    typeof token === "string" &&
    typeof tempRoot === "string" &&
    LOOPBACK_CHILD_LISTENER_TOKEN_PATTERN.test(token) &&
    path.isAbsolute(authorityPath) &&
    path.isAbsolute(tempRoot) &&
    path.resolve(authorityPath) === authorityPath &&
    path.resolve(tempRoot) === tempRoot &&
    path.dirname(authorityPath) === tempRoot &&
    path.basename(authorityPath) === LOOPBACK_CHILD_LISTENER_AUTHORITY_FILE;
  if (delegated) {
    environment[LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.grant] = token;
  } else {
    Reflect.deleteProperty(environment, LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.authorityPath);
    Reflect.deleteProperty(environment, LOOPBACK_CHILD_LISTENER_ENVIRONMENT_KEYS.token);
  }
  return Object.freeze(environment);
}

async function executeRuntimeSuite() {
  let configDirectory;
  let processError;
  let result;
  const environment = createReferenceHostWebChannelConsumptionRuntimeEnvironment(process.env);
  try {
    configDirectory = await realpath(
      await mkdtemp(path.join(tmpdir(), "desen-m07-t11-vitest-config-")),
    );
    const configPath = path.join(configDirectory, "vitest.config.mjs");
    await writeFile(configPath, VITEST_CONFIG_SOURCE, { flag: "wx", mode: 0o600 });
    result = await execFileAsync(
      process.execPath,
      [
        VITEST_CLI,
        "run",
        ...RUNTIME_TEST_FILES,
        "--reporter=json",
        "--config",
        configPath,
        "--configLoader=native",
        "--no-cache",
        "--no-file-parallelism",
        "--maxWorkers=1",
        "--pool=forks",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: environment,
        maxBuffer: MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES,
        timeout: 240_000,
      },
    );
  } catch (error) {
    processError = error;
  } finally {
    if (configDirectory !== undefined) {
      try {
        await rm(configDirectory, { force: false, recursive: true });
      } catch (error) {
        processError ??= error;
      }
    }
  }
  if (processError !== undefined) throw processError;
  return result;
}

/** Runs the closed M07-T11 focused suite in an isolated bounded child process. */
export async function runReferenceHostWebChannelConsumptionSuite() {
  let stdout;
  try {
    ({ stdout } = await executeRuntimeSuite());
  } catch (error) {
    fail(
      "RUNTIME_SUITE_FAILED",
      "The focused M07-T11 Vitest process did not pass.",
      summarizeReferenceHostWebChannelConsumptionSuiteFailure(error),
    );
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T11 Vitest receipt was not valid JSON.");
  }
  if (
    report?.success !== true ||
    !Number.isSafeInteger(report.numTotalTests) ||
    report.numTotalTests !== RUNTIME_TEST_TITLES.length ||
    report.numPassedTests !== report.numTotalTests ||
    !Array.isArray(report.testResults)
  ) {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T11 Vitest receipt was incomplete.");
  }
  const observed = [];
  const observedTitles = [];
  for (const result of report.testResults) {
    if (!Array.isArray(result?.assertionResults)) {
      fail("RUNTIME_SUITE_FAILED", "The focused M07-T11 test inventory was malformed.");
    }
    for (const assertion of result.assertionResults) {
      if (assertion?.status !== "passed" || typeof assertion.title !== "string") continue;
      observedTitles.push(assertion.title);
      const caseId = /^\[([^\]]+)\]/u.exec(assertion.title)?.[1];
      if (caseId !== undefined) observed.push(caseId);
    }
  }
  if (
    observed.length !== REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.length ||
    observed.some((caseId) => !REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.includes(caseId)) ||
    REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.some(
      (expected) => observed.filter((caseId) => caseId === expected).length !== 1,
    )
  ) {
    fail("RUNTIME_SUITE_MISMATCH", "The focused M07-T11 runtime identity inventory drifted.", {
      observed,
    });
  }
  observedTitles.sort();
  if (
    observedTitles.length !== RUNTIME_TEST_TITLES.length ||
    observedTitles.some((title, index) => title !== RUNTIME_TEST_TITLES[index])
  ) {
    fail("RUNTIME_SUITE_MISMATCH", "The focused M07-T11 runtime test inventory drifted.", {
      observed: observedTitles,
    });
  }
  return captureSuiteReceipt({
    schemaVersion: 1,
    profile: SUITE_PROFILE,
    status: "PASS",
    caseCount: REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS.length,
    caseIds: [...REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_CASE_IDS],
    testCount: RUNTIME_TEST_TITLES.length,
    testTitles: [...RUNTIME_TEST_TITLES],
    suiteFiles: [...RUNTIME_TEST_FILES],
  });
}

function trackedReceipts(tracked) {
  return [...tracked]
    .map(([relativePath, bytes]) => ({
      path: relativePath,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }))
    .sort((left, right) => codeUnitOrder(left.path, right.path));
}

function publicDistribution(distribution) {
  return {
    profile: distribution.profile,
    root: distribution.root,
    entryCount: distribution.entryCount,
    fileCount: distribution.fileCount,
    totalBytes: distribution.totalBytes,
    inventorySha256: distribution.inventorySha256,
    files: distribution.publicFiles,
  };
}

/** Builds deterministic M07-T11 evidence without mutating the workspace. */
export async function buildReferenceHostWebChannelConsumptionEvidence(options) {
  const captured = captureOptions(options, "build");
  const frozen = await readCheckpointedFrozenArtifact("M07-T11");
  if (frozen.path !== ARTIFACT) {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T11 artifact path drifted.");
  }
  const frozenArtifact = parseJson(Buffer.from(frozen.bytes), ARTIFACT);
  if (
    frozenArtifact?.schemaVersion !== 1 ||
    frozenArtifact.proofId !== PROOF_ID ||
    frozenArtifact.profile !== PROFILE ||
    frozenArtifact.task !== "M07-T11" ||
    frozenArtifact.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T11 artifact identity drifted.");
  }
  const prerequisites = await prerequisiteProjection(captured.prerequisiteBytes);
  const tracked = await readTrackedFiles(captured.trackedFileBytes);
  const packageBoundaries = auditPackageManifests(tracked);
  const serverBoundary = auditServerSources(tracked);
  const serverDistribution = await scanDistribution(
    SERVER_DIST,
    "desen.reference-host-web-server.dist.v1",
  );
  const clientDistribution = await scanDistribution(
    CLIENT_DIST,
    "desen.reference-host-web.browser-dist.v1",
  );
  assertServerDistribution(serverDistribution);
  assertClientDistribution(clientDistribution);
  const clientBoundary = auditClientSources(tracked, clientDistribution);
  const tests = testAuthorityProjection(tracked);
  const traceRows = traceProjection(tracked);
  const runtimeSuiteReceipt =
    captured.runtimeSuiteReceipt ?? (await runReferenceHostWebChannelConsumptionSuite());
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: PROOF_ID,
    profile: PROFILE,
    task: "M07-T11",
    result: "PASS",
    prerequisites,
    claims: {
      compositionBoundary: {
        serverAndBrowserBuiltSeparately: true,
        serverImportsOnlyPublicControlPlaneRoot: true,
        browserImportsNoControlPlaneOrSecretAuthority: true,
        packageBoundaries,
        serverImports: serverBoundary.imports,
        browserImports: clientBoundary.imports,
      },
      channelConsumption: {
        fixedHostOwnedChannel: true,
        realLoopbackBearerHttp: true,
        channelSnapshotIsDiscoveryOnly: true,
        completePublicVerificationPreflightStagingActivationRecoveryChain: true,
        exactBundleBytesEmbeddedWithoutReencoding: true,
        exactControlPlaneAndHostMediaTypesRequired: true,
        responseEnvelope: "{activation:{generation,revision},bundle}",
        strongEtagBindsGenerationAndRevision: true,
      },
      sequence: {
        order: ["valid A", "invalid B", "valid C"],
        invalidBNeverBecomesAuthority: true,
        invalidBPreservesExactAResponseAndEtag: true,
        validCAtomicallyReplacesA: true,
      },
      lifecycle: {
        durableGenerationPersists: true,
        restartRecoversBeforeDelivery: true,
        staleRefreshCannotPublish: true,
        lateRefreshAfterCloseCannotPublish: true,
      },
      browser: {
        existingMountDelegatesToFixedActivator: true,
        productionEntryRefreshAndLifecycleWiringTested: true,
        homeDeepLinkServesTheBuiltEntry: true,
        failedOrUnavailableRefreshPreservesLastKnownGoodSurface: true,
        noManualComponentTreeAuthority: true,
      },
      installedPackageInventory: {
        pathComesOnlyFromHostConfiguration: true,
        bounded: true,
        canonicalRootRequired: true,
        symbolicLinksAndSpecialFilesRejected: true,
        hardLinksRejected: true,
      },
      traceRows,
      coverageTruth: {
        normativeN038: "TESTED",
        normativeN041: "PLANNED",
        proofMatrixP12: "NOT_PROVEN",
        gateG07: "OPEN_PENDING_I07_04",
      },
    },
    runtimeSuiteReceipt,
    tests,
    trackedFiles: trackedReceipts(tracked),
    distributions: {
      server: publicDistribution(serverDistribution),
      browser: publicDistribution(clientDistribution),
    },
    nonclaims: [
      "This proof does not standardize channel transport, notification cadence, or deployment topology for other DESEN hosts.",
      "This proof does not establish remote, multi-tenant, TLS, bearer-credential lifecycle, or Internet-facing service security.",
      "This proof does not establish Bundle signing, hostile-administrator tamper resistance, independently anchored anti-rollback, or automatic rollback.",
      "This proof admits one fixed application-installed Web–React package; it does not prove arbitrary package discovery, installation, or execution.",
      "This reference server does not implement or proxy the application POST /api/sign-in backend; deployment authentication remains outside M07-T11 and fails closed as unavailable.",
      "The browser case runs through the DOM test host; it is not a real-browser interoperability or performance claim.",
      "P-12 remains NOT_PROVEN until M10-T07 proves product-level restart preservation in Desen App.",
      "N-041 remains PLANNED until M12-T05 closes the measured whole-system finite-limit profile.",
      "G07 remains open until the separately tracked I07-04 historical-reader cleanup is complete.",
      "No Android, iOS, or other native-host conformance is claimed by this Web reference-host proof.",
    ],
    reproduction: [
      "pnpm --filter @desen/reference-host-web-server build",
      "pnpm --filter @desen/reference-host-web build",
      "pnpm --filter @desen/reference-host-web-server typecheck",
      "pnpm --filter @desen/reference-host-web typecheck",
      "pnpm --filter @desen/reference-host-web-server test:channel",
      "node scripts/generate-reference-host-web-channel-consumption-proof.mjs",
      "node scripts/verify-reference-host-web-channel-consumption.mjs",
      "node --test tests/reference-host-web-channel-consumption.test.mjs",
    ],
  });
  const currentCompatibilityText = await format(JSON.stringify(currentCompatibility), {
    parser: "json",
    printWidth: 100,
  });
  const currentCompatibilityBytes = Buffer.from(currentCompatibilityText, "utf8");
  return deepFreeze({
    artifact: deepFreeze(frozenArtifact),
    artifactBytes: Buffer.from(frozen.bytes),
    artifactSha256: frozen.sha256,
    currentCompatibility,
    currentCompatibilitySha256: sha256(currentCompatibilityBytes),
    runtimeSuiteReceipt,
  });
}

function absoluteOptionPath(value, fallback, label) {
  if (value === undefined) return fallback;
  if (value.includes("\0")) fail("INVALID_OPTIONS", `${label} contains a NUL byte.`);
  return path.resolve(value);
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactLine = `Artifact: \`${ARTIFACT}\``;
  const receiptLine = `Final receipt: \`sha256:${artifactSha256}\``;
  return (
    document.split(artifactLine).length - 1 === 1 &&
    document.split(receiptLine).length - 1 === 1 &&
    document.match(/Final receipt: `sha256:[0-9a-f]{64}`/gu)?.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

/** Rebuilds the proof and compares exact artifact bytes plus the human-document digest pin. */
export async function verifyReferenceHostWebChannelConsumptionEvidence(options) {
  const captured = captureOptions(options, "verify");
  const built = await buildReferenceHostWebChannelConsumptionEvidence({
    ...(captured.prerequisiteBytes.size === 0
      ? {}
      : { prerequisiteBytes: Object.fromEntries(captured.prerequisiteBytes) }),
    ...(captured.trackedFileBytes.size === 0
      ? {}
      : { trackedFileBytes: Object.fromEntries(captured.trackedFileBytes) }),
    ...(captured.runtimeSuiteReceipt === undefined
      ? {}
      : { runtimeSuiteReceipt: captured.runtimeSuiteReceipt }),
  });
  const artifactBytes =
    captured.artifactBytes ??
    (await safeReadAbsolute(
      absoluteOptionPath(
        captured.artifactPath,
        DEFAULT_REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ARTIFACT_PATH,
        "artifactPath",
      ),
    ));
  if (!Buffer.from(artifactBytes).equals(Buffer.from(built.artifactBytes))) {
    fail("ARTIFACT_DRIFT", "The committed M07-T11 artifact is not exactly reproducible.");
  }
  const proofDocument =
    captured.proofDocument ??
    fatalText(
      await safeReadAbsolute(
        absoluteOptionPath(
          captured.proofDocumentPath,
          path.join(ROOT, PROOF_DOCUMENT),
          "proofDocumentPath",
        ),
      ),
      PROOF_DOCUMENT,
      "PROOF_PIN_DRIFT",
    );
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T11 artifact pin.");
  }
  return deepFreeze({
    task: "M07-T11",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    currentCompatibilitySha256: built.currentCompatibilitySha256,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    runtimeCases: built.artifact.tests.runtimeCaseCount,
    rootMutationCases: built.artifact.tests.rootMutationCaseCount,
    serverDistributionFiles: built.artifact.distributions.server.fileCount,
    browserDistributionFiles: built.artifact.distributions.browser.fileCount,
  });
}

/** Atomically commits deterministic M07-T11 evidence after a complete successful build. */
export async function writeReferenceHostWebChannelConsumptionEvidence(options) {
  const captured = captureOptions(options, "write");
  const artifactPath = absoluteOptionPath(
    captured.artifactPath,
    DEFAULT_REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_ARTIFACT_PATH,
    "artifactPath",
  );
  const built = await buildReferenceHostWebChannelConsumptionEvidence({
    ...(captured.runtimeSuiteReceipt === undefined
      ? {}
      : { runtimeSuiteReceipt: captured.runtimeSuiteReceipt }),
  });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T11 artifact could not be committed atomically.");
  }
  return deepFreeze({ artifactPath, artifactSha256: built.artifactSha256 });
}
