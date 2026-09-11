import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildCurrentDesenAppLastKnownGoodRecoveryObservation } from "./desen-app-last-known-good-recovery-proof.mjs";
import {
  authenticateM10AT01LockfileSuccessor,
  authenticateM10AT02LockfileSuccessor,
  projectM10AT01CurrentGraphAudit,
  projectM10AT01T08Input,
  projectM10AT02T01Input,
} from "./desen-app-published-host-update-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json";
const REPORT_PATH = "docs/proof/DESEN-APP-REPEATABLE-DEMO.md";
const MAX_AUTHORITY_BYTES = 2 * 1024 * 1024;
const MAX_OVERRIDE_BYTES = 24 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const execFileAsync = promisify(execFile);
const BROWSER_PACKAGE_PATH = "apps/desen-app-browser-e2e/package.json";
const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/repeatable-demo.pw.ts",
  authoring: "apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
  config: "apps/desen-app-browser-e2e/repeatable-demo-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
});
const BROWSER_AST_PINS = Object.freeze({
  spec: "fbd0c60782b5c662f8e8a42416bce096f40e1ecadc08e01b9761e5726fe6d7da",
  authoring: "36e1139d897684bc8a79fd66d12fde61b0339e11cc5daa2ea320507ea13ce6f9",
  config: "3c47a198c773b99b0b5b4186a96ce0aa7c1f37a8bfccd0b17b6de70126e04c2a",
  server: "05abc0a9018cbc2e25e59ba107adc36535c0160b516f7bdf9153b48b41327d57",
});
const BROWSER_TEST_NAME =
  "recreates one visible Flow demo with identical canonical publications across two normal resets";
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config repeatable-demo-playwright.config.ts";
const BROWSER_SUITE_COMMAND =
  "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts && playwright test --config repeatable-demo-playwright.config.ts";
const RESET_MODULE_PATHS = Object.freeze([
  "apps/desen-app/dev/local-demo-host.mjs",
  "apps/desen-app/dev/local-dev-host.mjs",
  "apps/desen-app/dev/local-operation-host.mjs",
  "apps/desen-app/dev/local-publication-host.mjs",
]);
const ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-repeatable-demo-proof.mjs",
  "scripts/verify-desen-app-repeatable-demo.mjs",
]);
const M10A_T01_SUCCESSOR_PIN = Object.freeze({
  task: "M10A-T01",
  path: "docs/proof/artifacts/m10a-t01.json",
  bytes: 13_910,
  sha256: "711f74398fb1d250d392dd4ff1145527cdaa7ca8673e811c7f753d211554cc74",
});
const M10A_T01_CHANGED_T08_INPUTS = Object.freeze([
  "pnpm-lock.yaml",
  "dependency-cruiser.config.cjs",
  "scripts/verify-boundary-fixtures.mjs",
  "docs/plan/DEMO-RUNBOOK.md",
]);
const M10A_T01_DEMO_RUNBOOK_SUCCESSOR = Object.freeze({
  path: "docs/plan/DEMO-RUNBOOK.md",
  bytes: 12_186,
  sha256: "63af52a55a8bea5cbccf875f01de9f2a6295332c13204b68497da59c7ba34302",
  predecessor: Object.freeze({
    bytes: 11_894,
    sha256: "10ae68297182eed5c5d6fb63e4b64ef1410c7e00eb064e4fcec95be57f396541",
  }),
  addition:
    "The [M10A plan](M10A-IMPLEMENTATION-PLAN.md) now precedes M11: ready styled components, theme and\ncomponent authoring, separate Connections and a built-in design-system/visual-review workbench.\nThose are planned product capabilities, not features demonstrated by this unchanged M10 runbook.\n\n",
});

/** Exact completed visible-behavior, evergreen, runtime, publication and recovery prerequisites. */
export const DESEN_APP_REPEATABLE_DEMO_PARENT_PINS = Object.freeze(
  [
    {
      task: "M10-T01B",
      proofId: "desen-app-visual-behavior-authoring",
      profile: "desen.app.visual-behavior-authoring-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
      bytes: 10962,
      sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
    },
    {
      task: "M10-T01C",
      proofId: "desen-app-evergreen-product-composition",
      profile: "desen.app.evergreen-product-composition-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-evergreen-product-composition.json",
      bytes: 19299,
      sha256: "779434ca834b8d770c726d905408f0a3d0a7145abbc6eaf2b81f1e77466b46ac",
    },
    {
      task: "M10-T02",
      proofId: "desen-app-input-pending-fixture",
      profile: "desen.app.input-pending-fixture-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json",
      bytes: 14261,
      sha256: "161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d",
    },
    {
      task: "M10-T03",
      proofId: "desen-app-failure-fixture",
      profile: "desen.app.failure-fixture-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json",
      bytes: 16868,
      sha256: "bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20",
    },
    {
      task: "M10-T04",
      proofId: "desen-app-success-host-operation",
      profile: "desen.app.success-host-operation-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json",
      bytes: 22456,
      sha256: "d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423",
    },
    {
      task: "M10-T05",
      proofId: "desen-app-published-host-update",
      profile: "desen.app.published-host-update-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
      bytes: 189123,
      sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
    },
    {
      task: "M10-T06",
      proofId: "desen-app-invalid-publication",
      profile: "desen.app.invalid-publication-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json",
      bytes: 193291,
      sha256: "1eb4260306d20fc87558edc4da4027c96bbb84598b758b242b8530010fe6071a",
    },
    {
      task: "M10-T07",
      proofId: "desen-app-last-known-good-recovery",
      profile: "desen.app.last-known-good-recovery-proof.v1",
      path: "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json",
      bytes: 304094,
      sha256: "5e589bc8022de3ccf3add7a9ebab78006ecca6e72628e165f54eef4fd8b90b68",
    },
  ].map(Object.freeze),
);
/** Write-once artifact identity; assigned only after all independent T08 inputs freeze. */
export const DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PIN = Object.freeze({
  bytes: 319719,
  sha256: "048041735b406dab4eefa6b0d02e2c039d3b3c3629d4dfc0cd7489a3c9f286f5",
});
/** Reviewed write-once T08 artifact destination. */
export const DEFAULT_DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);
/** Closed independently executed proof-reader contracts; these are not browser execution claims. */
export const DESEN_APP_REPEATABLE_DEMO_ROOT_TEST_NAMES = Object.freeze([
  "[parents] preserves all eight exact completed M10 prerequisites",
  "[reset] freshly exercises the normal owned reset API without listeners",
  "[browser] authenticates one visible two-cycle demo without claiming Chromium execution",
  "[graphs] freshly carries unprojected public API and complete App/host observations",
  "[inputs] rejects hostile authority before filesystem or child execution",
  "[freshness] captures caller bytes and reauthenticates real reset modules and graph inputs",
  "[artifact] rejects modified evidence and false report identity",
  "[filesystem] rejects symlink and substituted artifact authorities",
  "[writer] atomically writes only reviewed temporary or unchanged frozen evidence",
  "[wiring] preserves all nine independent browser commands and the normal human reset path",
]);
const TRACKED_PATHS = Object.freeze(
  [
    ...[
      "apps/desen-app-browser-e2e/README.md",
      "apps/desen-app/README.md",
      "apps/desen-app/dev/local-demo-host.mjs",
      "apps/desen-app/dev/local-demo-host.test.mjs",
      "apps/desen-app/dev/local-demo.mjs",
      "apps/desen-app/dev/local-dev-host.mjs",
      "apps/desen-app/dev/local-dev-host.test.mjs",
      "apps/desen-app/dev/local-operation-host.mjs",
      "apps/desen-app/dev/local-operation-host.test.mjs",
      "apps/desen-app/dev/local-publication-host.mjs",
      "apps/desen-app/src/main.tsx",
      "apps/desen-app/test/main-lifecycle.test.tsx",
      "apps/desen-app/tsconfig.local-dev.json",
      "apps/desen-app/package.json",
      "apps/reference-host-web/package.json",
      "apps/reference-host-web/src/channel-delivery.ts",
      "apps/reference-host-web/src/main.tsx",
      "apps/reference-host-web/src/official-sign-in.ts",
      "apps/reference-host-web/test/official-sign-in.test.tsx",
      "apps/reference-host-web-server/package.json",
      "apps/reference-host-web-server/src/channel-activation-controller.ts",
      "apps/reference-host-web-server/src/index.ts",
      "apps/reference-host-web-server/src/server.ts",
      "apps/reference-host-web-server/test/server.test.ts",
      "apps/reference-host-web-server/test/channel-activation-controller.test.ts",
      "apps/control-plane-api/package.json",
      "packages/protocol/package.json",
      "packages/publisher/package.json",
      "packages/validator/package.json",
      "packages/runtime-core/package.json",
      "pnpm-lock.yaml",
      "package.json",
      "dependency-cruiser.config.cjs",
      "scripts/verify-boundary-fixtures.mjs",
      "docs/plan/DEMO-RUNBOOK.md",
      "docs/adr/0022-repeatable-local-demo-composition.md",
      "packages/reference-catalog-web/catalog.json",
      "examples/sign-in/official-derived.source.desen.json",
    ],
    ...[
      "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-repeatable-demo-normal-launcher/apps/desen-app/dev/local-demo-host.mjs",
      "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-repeatable-demo-normal-launcher/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
      "tests/boundaries/fixtures/allowed-desen-app-browser-repeatable-authoring-protocol-root/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
      "tests/boundaries/fixtures/allowed-desen-app-browser-repeatable-authoring-protocol-root/packages/protocol/dist/index.js",
      "tests/boundaries/fixtures/allowed-reference-host-sign-in-test-protocol-root/apps/reference-host-web/test/official-sign-in.test.tsx",
      "tests/boundaries/fixtures/allowed-reference-host-sign-in-test-protocol-root/packages/protocol/dist/index.js",
      "tests/boundaries/fixtures/desen-app-browser-e2e-non-repeatable-demo-imports-normal-launcher/apps/desen-app/dev/local-demo-host.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-non-repeatable-demo-imports-normal-launcher/apps/desen-app-browser-e2e/ordinary-proof.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-app-source/apps/desen-app/src/application.js",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-app-source/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-control-plane-root/apps/control-plane-api/dist/index.js",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-control-plane-root/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-editor-core/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-editor-core/packages/editor-core/src/index.js",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-unreviewed-dev-module/apps/desen-app/dev/local-dev-host.mjs",
      "tests/boundaries/fixtures/desen-app-browser-e2e-repeatable-demo-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/repeatable-demo-proof-server.mjs",
      "tests/boundaries/fixtures/desen-app-browser-non-repeatable-authoring-imports-protocol/apps/desen-app-browser-e2e/another-authoring.ts",
      "tests/boundaries/fixtures/desen-app-browser-non-repeatable-authoring-imports-protocol/packages/protocol/dist/index.js",
      "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-editor-core/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
      "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-editor-core/packages/editor-core/src/index.js",
      "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-protocol-private/apps/desen-app-browser-e2e/repeatable-demo-authoring.ts",
      "tests/boundaries/fixtures/desen-app-browser-repeatable-authoring-imports-protocol-private/packages/protocol/dist/private.js",
      "tests/boundaries/fixtures/reference-host-other-test-imports-protocol/apps/reference-host-web/test/another.test.tsx",
      "tests/boundaries/fixtures/reference-host-other-test-imports-protocol/packages/protocol/dist/index.js",
      "tests/boundaries/fixtures/reference-host-sign-in-test-imports-protocol-private/apps/reference-host-web/test/official-sign-in.test.tsx",
      "tests/boundaries/fixtures/reference-host-sign-in-test-imports-protocol-private/packages/protocol/dist/private.js",
      "tests/boundaries/fixtures/reference-host-sign-in-test-imports-publisher/apps/reference-host-web/test/official-sign-in.test.tsx",
      "tests/boundaries/fixtures/reference-host-sign-in-test-imports-publisher/packages/publisher/src/index.js",
    ],
    ...Object.values(BROWSER_PATHS),
    BROWSER_PACKAGE_PATH,
    ...ENTRYPOINT_PATHS,
    ...DESEN_APP_REPEATABLE_DEMO_PARENT_PINS.map(({ path: parentPath }) => parentPath),
  ].sort((a, b) => a.localeCompare(b, "en-US")),
);
/** Stable fail-closed diagnostic from the deterministic M10-T08 proof reader. */
export class DesenAppRepeatableDemoProofError extends Error {
  /** Creates an evidence failure without exposing raw child output or private fixture paths. */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppRepeatableDemoProofError";
    this.code = code;
    this.details = Object.freeze(details);
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppRepeatableDemoProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !ArrayBuffer.isView(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze(Object.create(null));
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(value))
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert own-data record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label} contains an accessor or hidden field.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function capturePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4_096 ||
    value.includes("\0") ||
    !path.isAbsolute(value) ||
    path.normalize(value) !== value
  ) {
    fail("OPTIONS_INVALID", `${label} must be one normalized absolute path.`);
  }
  return value;
}

function captureBytes(value, label) {
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    if (bytes.byteLength > MAX_AUTHORITY_BYTES || bytes.toString("utf8") !== value) {
      fail("OPTIONS_INVALID", `${label} must be bounded round-tripping UTF-8.`);
    }
    return bytes;
  }
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !(Buffer.isBuffer(value) || Object.getPrototypeOf(value) === Uint8Array.prototype)
  ) {
    fail("OPTIONS_INVALID", `${label} must be bounded string, Buffer, or Uint8Array bytes.`);
  }
  let length;
  let backing;
  try {
    length = Reflect.apply(BYTE_LENGTH_GETTER, value, []);
    backing = Reflect.apply(BUFFER_GETTER, value, []);
  } catch {
    fail("OPTIONS_INVALID", `${label} contains detached or non-byte storage.`);
  }
  if (
    !Number.isSafeInteger(length) ||
    length > MAX_AUTHORITY_BYTES ||
    utilTypes.isSharedArrayBuffer(backing)
  ) {
    fail("OPTIONS_INVALID", `${label} exceeds its finite private byte envelope.`);
  }
  try {
    const copy = Buffer.alloc(length);
    Uint8Array.prototype.set.call(copy, value);
    return copy;
  } catch {
    fail("OPTIONS_INVALID", `${label} contains detached byte storage.`);
  }
}

function captureOverrides(value) {
  if (value === undefined) return new Map();
  if (
    utilTypes.isProxy(value) ||
    !(value instanceof Map) ||
    Object.getPrototypeOf(value) !== Map.prototype ||
    Reflect.ownKeys(value).length !== 0 ||
    value.size > TRACKED_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one inert bounded Map.");
  }
  const overrides = new Map();
  let total = 0;
  for (const [relativePath, valueBytes] of Map.prototype.entries.call(value)) {
    if (!TRACKED_PATHS.includes(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unreviewed path.");
    }
    const bytes = captureBytes(valueBytes, `fileOverrides[${relativePath}]`);
    total += bytes.byteLength;
    if (total > MAX_OVERRIDE_BYTES) fail("OPTIONS_INVALID", "fileOverrides exceeds its budget.");
    overrides.set(relativePath, bytes);
  }
  return overrides;
}

function captureBuildOptions(rawOptions) {
  const options = exactOptions(rawOptions, ["workspaceRoot", "fileOverrides"], "build options");
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot ?? WORKSPACE_ROOT, "workspaceRoot"),
    fileOverrides: captureOverrides(options.fileOverrides),
  });
}

function sameStat(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function readRegularAuthority(absolutePath, label) {
  let handle;
  try {
    const before = await lstat(absolutePath);
    if (!before.isFile() || before.size > MAX_AUTHORITY_BYTES) throw new Error("unsafe type/size");
    if ((await realpath(absolutePath)) !== absolutePath) throw new Error("indirect authority path");
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!sameStat(before, opened)) throw new Error("authority replaced before open");
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (result.bytesRead === 0) throw new Error("authority truncated during read");
      offset += result.bytesRead;
    }
    const extra = await handle.read(Buffer.alloc(1), 0, 1, offset);
    const [after, named] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (extra.bytesRead !== 0 || !sameStat(opened, after) || !sameStat(after, named)) {
      throw new Error("authority changed during read");
    }
    return bytes;
  } catch {
    fail("AUTHORITY_UNSAFE", "The current authority is not one stable bounded regular file.", {
      path: label,
    });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      overrides.has(relativePath)
        ? Buffer.from(overrides.get(relativePath))
        : await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath),
    );
  }
  return files;
}

function receipts(files) {
  return [...files].map(([relativePath, bytes]) => ({
    path: relativePath,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  }));
}

function decodeUtf8(bytes, label) {
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} is not exact UTF-8.`);
  }
  return source;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch {
    fail(code, `${label} is not one valid JSON authority.`);
  }
}

function authenticateParents(files) {
  for (const pin of DESEN_APP_REPEATABLE_DEMO_PARENT_PINS) {
    const bytes = files.get(pin.path);
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PARENT_DRIFT", "A frozen T08 prerequisite changed.", { path: pin.path });
    }
    const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
    if (
      artifact.task !== pin.task ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.result !== "PASS"
    ) {
      fail("PARENT_DRIFT", "A frozen T08 prerequisite lost its exact identity.");
    }
  }
}

const RESET_LISTENER_GUARD = String.raw`
const listenerDescriptor = Object.getOwnPropertyDescriptor(Server.prototype, "listen");
assert.ok(listenerDescriptor && typeof listenerDescriptor.value === "function");
if (listenerDescriptor.writable === false) {
  // The runner owns this immutable boundary. Never replace it or discard its preload.
  assert.equal(listenerDescriptor.configurable, false);
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(globalThis, Symbol.for("desen.ci.no-proof-listener.v2")),
    {value:true,writable:false,enumerable:false,configurable:false},
  );
  // No Server instance, receiver or port is supplied. Native/permissive implementations do
  // not satisfy the exact synchronous CI denial; this cannot bind a real listener.
  assert.throws(() => Reflect.apply(listenerDescriptor.value, undefined, []), error =>
    error instanceof Error &&
    Object.getOwnPropertyDescriptor(error, "code")?.value === "DESEN_CI_LISTENER_FORBIDDEN" &&
    Object.getOwnPropertyDescriptor(error, "message")?.value === "Proof workloads may not bind network listeners.");
} else {
  assert.equal(listenerDescriptor.writable, true);
  Object.defineProperty(Server.prototype, "listen", {
    ...listenerDescriptor,
    value() { throw new Error("The reset matrix cannot start a listener."); },
    writable:false,
    configurable:false,
  });
  assert.throws(() => Reflect.apply(Server.prototype.listen, undefined, []),
    {message:"The reset matrix cannot start a listener."});
}
const guardedListenerDescriptor = Object.getOwnPropertyDescriptor(Server.prototype, "listen");
assert.equal(guardedListenerDescriptor.writable, false);
assert.equal(guardedListenerDescriptor.configurable, false);
`;

const RESET_PROGRAM = String.raw`
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile, readdir, realpath, symlink, unlink, writeFile } from "node:fs/promises";
import { Server } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [workspaceRoot, ownedWorkspace] = process.argv.slice(1);
const modules = ["local-demo-host.mjs","local-dev-host.mjs","local-operation-host.mjs","local-publication-host.mjs"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function snapshot() {
  const receipts = [];
  for (const name of modules) {
    const relative = "apps/desen-app/dev/" + name;
    const absolute = join(workspaceRoot, relative);
    assert.equal(await realpath(absolute), absolute);
    const before = await lstat(absolute);
    assert.equal(before.isFile(), true);
    assert.ok(before.size <= 2 * 1024 * 1024);
    const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = await file.readFile();
      const after = await file.stat();
      const named = await lstat(absolute);
      for (const current of [after, named]) {
        assert.equal(current.ino, before.ino);
        assert.equal(current.dev, before.dev);
        assert.equal(current.size, before.size);
        assert.equal(current.mtimeMs, before.mtimeMs);
        assert.equal(current.ctimeMs, before.ctimeMs);
        assert.equal(current.isFile(), true);
      }
      assert.equal(bytes.length, before.size);
      receipts.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});
    } finally { await file.close(); }
  }
  return receipts;
}
${RESET_LISTENER_GUARD}
const before = await snapshot();
const { acquireDesenAppDemoState } = await import(pathToFileURL(join(workspaceRoot, before[0].path)).href);
const options = {workspaceDirectory: ownedWorkspace};
const root = join(ownedWorkspace, ".desen/m10-demo");
const sibling = join(ownedWorkspace, "unrelated-sentinel");
await writeFile(sibling, "unrelated-owned-fixture\n", {mode:0o600,flag:"wx"});
let lease;
try {
  lease = await acquireDesenAppDemoState(options);
  assert.equal(lease.stateDirectory, join(root, "current"));
  assert.deepEqual(await readdir(lease.stateDirectory), []);
  assert.equal((await lstat(root)).mode & 0o777, 0o700);
  await writeFile(join(lease.stateDirectory,"marker"),"generation-A\n",{mode:0o600,flag:"wx"});
  await assert.rejects(acquireDesenAppDemoState({...options,reset:true}),{code:"DEMO_IN_USE"});
  assert.equal(await readFile(join(lease.stateDirectory,"marker"),"utf8"),"generation-A\n");
  await lease.release(); lease = undefined;
  lease = await acquireDesenAppDemoState(options);
  assert.equal(await readFile(join(lease.stateDirectory,"marker"),"utf8"),"generation-A\n");
  await lease.release(); lease = undefined;
  lease = await acquireDesenAppDemoState({...options,reset:true});
  assert.deepEqual(await readdir(lease.stateDirectory),[]);
  assert.equal(await readFile(join(root,"previous/marker"),"utf8"),"generation-A\n");
  await writeFile(join(lease.stateDirectory,"marker"),"generation-B\n",{mode:0o600,flag:"wx"});
  await lease.release(); lease = undefined;
  lease = await acquireDesenAppDemoState({...options,reset:true});
  assert.deepEqual(await readdir(lease.stateDirectory),[]);
  assert.equal(await readFile(join(root,"previous/marker"),"utf8"),"generation-B\n");
  assert.deepEqual(await readdir(join(root,"previous")),["marker"]);
  await lease.release(); lease = undefined;

  // Only fixture-owned files are created; malformed ownership never authorizes a reset.
  const owner = await readFile(join(root,"owner"));
  await writeFile(join(root,"owner"),"unowned\n",{mode:0o600});
  await assert.rejects(acquireDesenAppDemoState({...options,reset:true}),{code:"UNSAFE_DEMO_STATE"});
  assert.equal(await readFile(join(root,"previous/marker"),"utf8"),"generation-B\n");
  await writeFile(join(root,"owner"),owner,{mode:0o600});
  const link = join(root,"current/foreign-link");
  await symlink(sibling,link);
  await assert.rejects(acquireDesenAppDemoState({...options,reset:true}),{code:"UNSAFE_DEMO_STATE"});
  assert.equal(await readFile(sibling,"utf8"),"unrelated-owned-fixture\n");
  await unlink(link);
  lease = await acquireDesenAppDemoState(options);
  await lease.release(); lease = undefined;
  assert.equal(await readFile(sibling,"utf8"),"unrelated-owned-fixture\n");
  assert.deepEqual((await readdir(root)).sort(),["current","owner","previous"]);
  const after = await snapshot();
  assert.deepEqual(after,before);
  assert.equal(process.getActiveResourcesInfo().some(name=>name==="TCPServerWrap"),false);
  process.stdout.write(JSON.stringify({
    profile:"desen.app.normal-demo-reset-matrix.v1",
    api:"acquireDesenAppDemoState",
    initialEmpty:true,exclusiveLease:true,reopenPreserves:true,
    resets:2,previousGenerationRetained:true,olderBackupPruned:true,
    unownedMarkerRejected:true,symlinkRejected:true,siblingPreserved:true,
    noSourceSeed:true,noListener:true,leaseReleased:true,
    moduleReceipts:before
  }));
} finally { await lease?.release(); }
`;

async function executeNormalResetMatrix(workspaceRoot, files) {
  const captured = RESET_MODULE_PATHS.map((name) => {
    const bytes = files.get(name);
    return { path: name, bytes: bytes.byteLength, sha256: sha256(bytes) };
  });
  for (const name of RESET_MODULE_PATHS) {
    const actual = await readRegularAuthority(path.join(workspaceRoot, name), name);
    if (!actual.equals(files.get(name)))
      fail(
        "SOURCE_SNAPSHOT_DRIFT",
        "An executed normal reset module differs from captured authority.",
      );
  }
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-app-repeatable-reset-")),
  );
  try {
    let output;
    try {
      ({ stdout: output } = await execFileAsync(
        process.execPath,
        ["--input-type=module", "--eval", RESET_PROGRAM, workspaceRoot, temporaryRoot],
        { cwd: workspaceRoot, timeout: 20_000, maxBuffer: 256 * 1024, encoding: "utf8" },
      ));
    } catch {
      fail("RESET_MATRIX_FAILED", "The fresh normal reset API matrix did not complete safely.");
    }
    const result = parseJson(Buffer.from(output), "normal reset matrix", "RESET_MATRIX_FAILED");
    const expected = {
      profile: "desen.app.normal-demo-reset-matrix.v1",
      api: "acquireDesenAppDemoState",
      initialEmpty: true,
      exclusiveLease: true,
      reopenPreserves: true,
      resets: 2,
      previousGenerationRetained: true,
      olderBackupPruned: true,
      unownedMarkerRejected: true,
      symlinkRejected: true,
      siblingPreserved: true,
      noSourceSeed: true,
      noListener: true,
      leaseReleased: true,
      moduleReceipts: captured,
    };
    if (!isDeepStrictEqual(result, expected))
      fail(
        "RESET_MATRIX_FAILED",
        "The normal reset observations or executed module receipts drifted.",
      );
    return deepFreeze({
      ...result,
      freshProcess: true,
      ownedOsTemporaryWorkspace: true,
      noProductionHostStarted: true,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const CODE_PRINTER = ts.createPrinter({ removeComments: true });
/** Audits the exact executable browser declaration; no browser or demo server is started here. */
export function verifyDesenAppRepeatableDemoBrowserPolicy(rawInput) {
  const input = exactOptions(rawInput, Object.keys(BROWSER_PATHS), "browser policy");
  const names = [];
  const allowed = {
    spec: ["node:child_process", "node:path", "@playwright/test", "./repeatable-demo-authoring.js"],
    authoring: ["node:crypto", "@desen/protocol", "@playwright/test"],
    config: ["node:path", "@playwright/test"],
    server: ["node:path", "node:process", "../desen-app/dev/local-demo-host.mjs"],
  };
  for (const [key, name] of Object.entries(BROWSER_PATHS)) {
    const source = decodeUtf8(captureBytes(input[key], name), name);
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    if (tree.parseDiagnostics.length)
      fail("BROWSER_POLICY_VIOLATION", "A browser authority does not parse.");
    const imports = [];
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const called = ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : ts.isIdentifier(expression)
            ? expression.text
            : "";
        if (
          [
            "eval",
            "evaluate",
            "evaluateHandle",
            "addInitScript",
            "route",
            "routeFromHAR",
            "setContent",
            "dispatchEvent",
            "addScriptTag",
            "addCookies",
            "unroute",
          ].includes(called) ||
          expression.kind === ts.SyntaxKind.ImportKeyword
        )
          fail(
            "BROWSER_POLICY_VIOLATION",
            "Hidden injection, replacement transport or executable import is forbidden.",
          );
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          ["test", "base", "describe"].includes(expression.expression.text) &&
          ["skip", "only", "fixme", "fail", "slow"].includes(called)
        )
          fail("BROWSER_POLICY_VIOLATION", "The browser gained an alternate successful result.");
        if (key === "spec" && ts.isIdentifier(expression) && expression.text === "test") {
          if (!ts.isStringLiteral(node.arguments[0]))
            fail("BROWSER_POLICY_VIOLATION", "The test name must remain literal.");
          names.push(node.arguments[0].text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    if (!isDeepStrictEqual([...new Set(imports)].sort(), allowed[key].sort()))
      fail("BROWSER_POLICY_VIOLATION", "A browser import left its exact reviewed boundary.");
    // The comment-free AST identity includes every helper, assertion, cleanup and exact byte
    // comparison. A dead marker, normalized comparison, early return or alias cannot retain it.
    if (sha256(CODE_PRINTER.printFile(tree)) !== BROWSER_AST_PINS[key])
      fail("BROWSER_POLICY_VIOLATION", "The reviewed executable browser declaration changed.", {
        path: name,
      });
  }
  if (!isDeepStrictEqual(names, [BROWSER_TEST_NAME]))
    fail("BROWSER_POLICY_VIOLATION", "The exact two-cycle scenario is missing or duplicated.");
  return deepFreeze({
    command: BROWSER_COMMAND,
    spec: BROWSER_PATHS.spec,
    authoring: BROWSER_PATHS.authoring,
    configuration: BROWSER_PATHS.config,
    server: BROWSER_PATHS.server,
    testName: BROWSER_TEST_NAME,
    chromiumScenarios: 1,
    declaredCycles: 2,
    normalPort: 5173,
    seed: "empty durable inventory; normal visible New project",
    reset: "same normal owned demo lifecycle, fresh child PID and browser context",
    declaredNativeGestures: ["component-insertion", "layer-reordering"],
    operationAlias: "submitCredentials",
    declaredRuntime: [
      "synthetic-pending",
      "synthetic-failure",
      "synthetic-success",
      "integration-401",
      "integration-200",
    ],
    declaredDelivery: [
      "save",
      "publish",
      "activate",
      "independent-host-401",
      "independent-host-200",
      "label-layout-republish",
    ],
    declaredEquality: [
      "canonical-source-A",
      "canonical-source-B",
      "canonical-bundle-A",
      "canonical-bundle-B",
    ],
    equalityNormalizesInputs: false,
    hostBuildIdentityWithinEachCycle: true,
    executableAstSha256: BROWSER_AST_PINS,
    declarationOnly: true,
    browserExecutedByVerifier: false,
    traceNetworkSnapshots: false,
    traceSources: false,
    traceAttachments: false,
    traceScreenshots: true,
    traceConfigurationIsNotSecretsAudit: true,
  });
}
/**
 * Authenticates only T08-owned root commands and their live test/check membership. The complete
 * file is captured and re-read by the builder, but later unrelated task scripts are not frozen.
 */
export function verifyDesenAppRepeatableDemoRootWiring(rawPackageBytes) {
  const root = parseJson(captureBytes(rawPackageBytes, "root package"), "root package");
  const selectedScripts = {
    demo: "node apps/desen-app/dev/local-demo.mjs",
    "demo:reset": "node apps/desen-app/dev/local-demo.mjs --reset",
    "generate:desen-app-repeatable-demo":
      "node scripts/generate-desen-app-repeatable-demo-proof.mjs",
    "verify:desen-app-repeatable-demo": "node scripts/verify-desen-app-repeatable-demo.mjs",
    "test:desen-app-repeatable-demo": "node --test tests/desen-app-repeatable-demo.test.mjs",
  };
  for (const [name, command] of Object.entries(selectedScripts))
    if (root?.scripts?.[name] !== command)
      fail("TEST_AUTHORITY_DRIFT", "A T08-owned root command changed its exact lifecycle.");
  for (const [name, command] of [
    ["test", "pnpm test:desen-app-repeatable-demo"],
    ["check", "pnpm verify:desen-app-repeatable-demo"],
  ]) {
    const script = root?.scripts?.[name];
    const parts = typeof script === "string" ? script.split(" && ") : [];
    if (
      parts.length === 0 ||
      parts.filter((part) => part === command).length !== 1 ||
      parts.some((part) => !/^(?:pnpm [a-z0-9:-]+|turbo run test)$/u.test(part))
    )
      fail("TEST_AUTHORITY_DRIFT", "The normal AND-chain lost exact T08 workload membership.");
  }
  return deepFreeze({
    path: "package.json",
    selectedScripts,
    requiredTestMembership: "pnpm test:desen-app-repeatable-demo",
    requiredCheckMembership: "pnpm verify:desen-app-repeatable-demo",
    exactMembershipCount: 1,
    fullBytesReauthenticatedWithinInvocation: true,
    unrelatedTaskScriptBytesFrozen: false,
  });
}

function verifyPackageWiring(files) {
  const browser = parseJson(files.get(BROWSER_PACKAGE_PATH), BROWSER_PACKAGE_PATH);
  if (
    browser?.name !== "@desen/app-browser-e2e" ||
    browser.scripts?.["test:e2e"] !== BROWSER_SUITE_COMMAND ||
    browser.devDependencies?.["@desen/protocol"] !== "workspace:*"
  )
    fail(
      "TEST_AUTHORITY_DRIFT",
      "The exact ninth browser command or public Protocol dependency changed.",
    );
  const cli = decodeUtf8(files.get("apps/desen-app/dev/local-demo.mjs"), "normal demo CLI");
  const rootCommands = verifyDesenAppRepeatableDemoRootWiring(files.get("package.json"));
  const demo = decodeUtf8(
    files.get("apps/desen-app/dev/local-demo-host.mjs"),
    "normal demo lifecycle",
  );
  if (
    !cli.includes("startDesenAppLocalDemo(") ||
    !cli.includes('"--reset"') ||
    !demo.includes("await acquireDesenAppDemoState(options)") ||
    !demo.includes("options.startHost ?? startDesenAppLocalDev")
  )
    fail(
      "TEST_AUTHORITY_DRIFT",
      "The human and browser demo must retain the same normal state and host lifecycle.",
    );
  return {
    browserCommands: 9,
    publicProtocolDevDependency: true,
    normalDemoCommand: "pnpm demo",
    normalResetCommand: "pnpm demo:reset",
    normalCli: "apps/desen-app/dev/local-demo.mjs",
    normalLifecycle: "apps/desen-app/dev/local-demo-host.mjs",
    runbook: "docs/plan/DEMO-RUNBOOK.md",
    rootCommands,
    browserExecutedByVerifier: false,
  };
}

function projectM10AT01Input(relativePath, bytes) {
  try {
    if (relativePath === M10A_T01_DEMO_RUNBOOK_SUCCESSOR.path) {
      const successor = M10A_T01_DEMO_RUNBOOK_SUCCESSOR;
      if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
        throw new Error("runbook successor receipt");
      }
      const source = decodeUtf8(bytes, relativePath);
      if (source.split(successor.addition).length !== 2) {
        throw new Error("runbook successor addition");
      }
      const predecessor = Buffer.from(source.replace(successor.addition, ""));
      if (
        predecessor.byteLength !== successor.predecessor.bytes ||
        sha256(predecessor) !== successor.predecessor.sha256
      ) {
        throw new Error("runbook predecessor receipt");
      }
      return predecessor;
    }
    return relativePath === "pnpm-lock.yaml"
      ? authenticateM10AT01LockfileSuccessor(
          authenticateM10AT02LockfileSuccessor(bytes).predecessorBytes,
        ).predecessorBytes
      : projectM10AT01T08Input(relativePath, projectM10AT02T01Input(relativePath, bytes));
  } catch {
    fail("SUCCESSOR_DRIFT", "A live M10A-T01 input is not the exact reviewed T08 successor.", {
      path: relativePath,
    });
  }
}

function projectM10AT01Graph(currentGraphAudit, t08GraphAudit) {
  try {
    return projectM10AT01CurrentGraphAudit(currentGraphAudit, t08GraphAudit);
  } catch {
    fail(
      "SUCCESSOR_DRIFT",
      "The live App/host graph is not the exact reviewed M10A-T01 successor of T08.",
    );
  }
}

async function authenticateM10AT01Successor(workspaceRoot) {
  const pin = M10A_T01_SUCCESSOR_PIN;
  const bytes = await readRegularAuthority(path.join(workspaceRoot, pin.path), pin.path);
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("SUCCESSOR_DRIFT", "The exact reviewed M10A-T01 successor artifact changed.");
  }
  const successor = parseJson(bytes, pin.path, "SUCCESSOR_DRIFT");
  if (
    successor.schemaVersion !== 1 ||
    successor.task !== pin.task ||
    successor.profile !== "desen.m10a-t01.base-ui-adapter-boundary.v1" ||
    successor.result !== "PASS" ||
    successor.package?.name !== "@desen/starter-catalog-web" ||
    successor.claims?.runtimeCoreChanged !== false
  ) {
    fail("SUCCESSOR_DRIFT", "The M10A-T01 successor lost its reviewed identity.");
  }
  return successor;
}

/** Builds fresh normal reset observations and unprojected current public API/App/host evidence. */
export async function buildDesenAppRepeatableDemoEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot).catch(() =>
    fail("AUTHORITY_UNSAFE", "The proof workspace is unavailable."),
  );
  if (workspaceRoot !== options.workspaceRoot)
    fail("AUTHORITY_UNSAFE", "The proof workspace must be canonical.");
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const historicalBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    ARTIFACT_PATH,
  );
  const historical = authenticateArtifact(historicalBytes);
  const m10aT01Successor = await authenticateM10AT01Successor(workspaceRoot);
  authenticateParents(files);
  const t08Files = new Map(files);
  for (const name of M10A_T01_CHANGED_T08_INPUTS) {
    t08Files.set(name, projectM10AT01Input(name, files.get(name)));
  }
  const browser = verifyDesenAppRepeatableDemoBrowserPolicy(
    Object.fromEntries(Object.entries(BROWSER_PATHS).map(([key, name]) => [key, files.get(name)])),
  );
  const packageWiring = verifyPackageWiring(files);
  const normalResetMatrix = await executeNormalResetMatrix(workspaceRoot, files);
  const { publicApiMatrix, currentGraphAudit } =
    await buildCurrentDesenAppLastKnownGoodRecoveryObservation({ workspaceRoot }).catch(() =>
      fail(
        "CURRENT_OBSERVATION_FAILED",
        "The fresh public API or App/host graph observation failed.",
      ),
    );
  if (!isDeepStrictEqual(publicApiMatrix, historical.authority.publicApiMatrix)) {
    fail("SUCCESSOR_DRIFT", "The live recovery matrix differs from its exact T08 authority.");
  }
  const t08GraphAudit = projectM10AT01Graph(
    currentGraphAudit,
    historical.authority.currentGraphAudit,
  );
  // Overrides may test declaration policy, but can never replace the bytes executed by the
  // normal reset child or current compiler. Re-read real bytes after both fresh observations.
  const after = await readTrackedFiles(workspaceRoot, new Map());
  if (!isDeepStrictEqual(receipts(files), receipts(after)))
    fail("SOURCE_SNAPSHOT_DRIFT", "A captured T08 authority differs after fresh execution.");
  for (const { path: name, bytes, sha256: digest } of publicApiMatrix.freshEmission.inputReceipts) {
    const captured = files.get(name);
    if (captured !== undefined && (captured.byteLength !== bytes || sha256(captured) !== digest))
      fail(
        "SOURCE_SNAPSHOT_DRIFT",
        "The fresh compiler and captured T08 input authority disagree.",
      );
  }
  const artifact = deepFreeze({
    schemaVersion: 1,
    task: "M10-T08",
    gate: null,
    proofId: "desen-app-repeatable-demo",
    profile: "desen.app.repeatable-demo-proof.v1",
    result: "PASS",
    prerequisites: DESEN_APP_REPEATABLE_DEMO_PARENT_PINS,
    claim: {
      normalOwnedResetFreshlyExecuted: true,
      currentAppAndHostGraphAudited: true,
      independentVisibleTwoCycleDemoRequired: true,
      exactCanonicalPublicationEqualityRequiresChromium: true,
      productionAuthentication: false,
      g10Closed: false,
    },
    authority: {
      publicApiMatrix,
      currentGraphAudit: t08GraphAudit,
      normalResetMatrix,
      browser,
      packageWiring,
    },
    tests: {
      browserCommand: BROWSER_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-repeatable-demo.mjs",
      proofReaderCommand: "node --test tests/desen-app-repeatable-demo.test.mjs",
      rootTestNames: DESEN_APP_REPEATABLE_DEMO_ROOT_TEST_NAMES,
      normalResetMatrixExecutedByVerifier: true,
      publicApiMatrixExecutedByVerifier: true,
      browserExecutedByVerifier: false,
      productHostStartedByVerifier: false,
      deterministicReaderStartsListener: false,
      freshTypeScriptEmissionCompared: true,
      typecheckExecutedByVerifier: false,
      viteBuildsExecutedByVerifier: true,
      viteBuildOutputWritten: false,
    },
    boundary: {
      trackedFiles: files.size - 1,
      trackedReceipts: receipts(t08Files).filter((receipt) => receipt.path !== "package.json"),
      semanticAuthorityPaths: ["package.json"],
      immutableInputs: true,
      parentArtifacts: 8,
      currentGraphHasNoHistoricalProjection: true,
      sourceSymlinksRejected: true,
      publicMatrixUsesFreshProcess: true,
      normalResetUsesFreshProcess: true,
      ownedTemporaryServiceDataOnly: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-repeatable-demo-proof.mjs",
        "tests/desen-app-repeatable-demo.test.mjs",
      ],
      prerequisiteReaderCheckpointOwnedPaths: [
        "scripts/lib/desen-app-last-known-good-recovery-proof.mjs",
        "scripts/lib/desen-app-published-host-update-proof.mjs",
      ],
      artifactTrackedEntrypoints: ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "The sockets-free reset matrix executes the same public normal lifecycle API with owned temporary marker files, not a Source seed or a second application implementation.",
      "Exact Source/Bundle equality, visible authoring, real HTTP operations, separate host interaction and new product PIDs are assertions of the independently executed Chromium journey, never static-reader execution claims.",
      "The original eight browser journeys remain independent required workloads; this consolidated ninth journey does not replace their negative or lifetime coverage.",
      "The raw recovery matrix and complete current App/host graph observations are freshly rebuilt without projecting current business outcomes to a historical artifact.",
      "Trace settings are explicit declaration evidence, not a comprehensive secrets audit. Raw Source, Bundle, headers and generated configuration are not proof attachments.",
      "Local test-account Integration is not production authentication, remote deployment, multi-user durability, M10-T09, N-036 or G10 closure.",
      "A local PASS is not hosted completion; exact current-head required checks remain mandatory.",
    ],
  });
  const artifactBytes = Buffer.from(
    await format(JSON.stringify(artifact), { parser: "json", printWidth: 100, endOfLine: "lf" }),
  );
  if (
    !(await readRegularAuthority(path.join(workspaceRoot, ARTIFACT_PATH), ARTIFACT_PATH)).equals(
      historicalBytes,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen T08 authority changed across fresh execution.");
  }
  const recheckedM10AT01Successor = await authenticateM10AT01Successor(workspaceRoot);
  if (!isDeepStrictEqual(m10aT01Successor, recheckedM10AT01Successor)) {
    fail("SUCCESSOR_DRIFT", "The M10A-T01 successor changed across fresh execution.");
  }
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    liveSuccessorAuthority: {
      task: "M10A-T01",
      predecessorTask: "M10-T08",
      artifact: M10A_T01_SUCCESSOR_PIN,
      currentGraphAudit,
      currentTrackedReceipts: receipts(files).filter((receipt) => receipt.path !== "package.json"),
      currentObservationsAreNotHistoricalResults: true,
    },
  });
}
function authenticateArtifact(bytes) {
  const pin = DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PIN;
  if (pin.bytes <= 0 || bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("ARTIFACT_DRIFT", "The immutable committed T08 evidence bytes drifted.");
  }
  const artifact = parseJson(bytes, ARTIFACT_PATH, "ARTIFACT_DRIFT");
  if (
    artifact.task !== "M10-T08" ||
    artifact.result !== "PASS" ||
    artifact.proofId !== "desen-app-repeatable-demo"
  ) {
    fail("ARTIFACT_DRIFT", "The immutable T08 evidence identity drifted.");
  }
  return artifact;
}

function verifyReport(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, REPORT_PATH);
  const header = [
    "# Desen App repeatable demo",
    "",
    "Task: M10-T08",
    "",
    "Status: DONE",
    "",
    ...DESEN_APP_REPEATABLE_DEMO_PARENT_PINS.flatMap((pin) => [
      pin.task +
        " parent: " +
        String.fromCharCode(96) +
        "sha256:" +
        pin.sha256 +
        String.fromCharCode(96),
      "",
    ]),
    "Final artifact: " +
      String.fromCharCode(96) +
      "sha256:" +
      artifactSha256 +
      String.fromCharCode(96),
  ].join("\n");
  if (
    !source.startsWith(header) ||
    source.split("Final artifact:").length !== 2 ||
    source.split("Status: DONE").length !== 2 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The T08 proof report lost its exact bounded authority header.");
  }
}

/** Compares the pinned T08 artifact with fresh source, public APIs, and current App/host graphs. */
export async function verifyDesenAppRepeatableDemoEvidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const suppliedArtifact =
    options.artifactBytes === undefined
      ? undefined
      : captureBytes(options.artifactBytes, "artifactBytes");
  const suppliedReport =
    options.proofDocument === undefined
      ? undefined
      : captureBytes(options.proofDocument, "proofDocument");
  const artifactPath = capturePath(
    options.artifactPath ?? DEFAULT_DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PATH,
    "artifactPath",
  );
  const reportPath = capturePath(
    options.proofDocumentPath ?? path.join(WORKSPACE_ROOT, REPORT_PATH),
    "proofDocumentPath",
  );
  const buildOptions = captureBuildOptions(options.buildOptions);
  if (suppliedArtifact !== undefined) authenticateArtifact(suppliedArtifact);
  else authenticateArtifact(await readRegularAuthority(artifactPath, ARTIFACT_PATH));
  if (suppliedReport !== undefined)
    verifyReport(suppliedReport, DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PIN.sha256);
  else
    verifyReport(
      await readRegularAuthority(reportPath, REPORT_PATH),
      DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PIN.sha256,
    );
  const built = await buildDesenAppRepeatableDemoEvidence(buildOptions);
  const artifactBytes =
    suppliedArtifact ?? (await readRegularAuthority(artifactPath, ARTIFACT_PATH));
  const artifact = authenticateArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes))
    fail(
      "ARTIFACT_DRIFT",
      "The pinned T08 artifact no longer reproduces from current authorities.",
    );
  verifyReport(
    suppliedReport ?? (await readRegularAuthority(reportPath, REPORT_PATH)),
    built.artifactSha256,
  );
  return deepFreeze({
    task: "M10-T08",
    result: "PASS",
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    normalResets: 2,
    normalResetMatrixExecutedByVerifier: true,
    freshTypeScriptEmissionCompared: true,
    typecheckExecutedByVerifier: false,
    productProcessRestartExecutedByVerifier: false,
    publicApiMatrixExecutedByVerifier: true,
    browserExecutedByVerifier: false,
    deterministicReaderStartsListener: false,
    appGraphModules: artifact.authority.currentGraphAudit.runtimeResolution.app.moduleCount,
    hostGraphModules: artifact.authority.currentGraphAudit.runtimeResolution.host.moduleCount,
  });
}

async function canonicalDestination(artifactPath) {
  try {
    const parent = await realpath(path.dirname(artifactPath));
    const destination = path.join(parent, path.basename(artifactPath));
    const metadata = await lstat(destination).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (metadata !== undefined && !metadata.isFile()) throw new Error("unsafe destination");
    return { destination, exists: metadata !== undefined };
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "The T08 artifact destination is not one regular-file location.");
  }
}

/** Atomically creates T08 evidence; never replaces different bytes at its frozen tracked path. */
export async function writeDesenAppRepeatableDemoEvidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  const artifactPath = capturePath(
    options.artifactPath ?? DEFAULT_DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PATH,
    "artifactPath",
  );
  const buildOptions = captureBuildOptions(options.buildOptions);
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy test callback.");
  }
  await canonicalDestination(artifactPath);
  const built = await buildDesenAppRepeatableDemoEvidence(buildOptions);
  const { destination, exists } = await canonicalDestination(artifactPath);
  const frozen = await canonicalDestination(DEFAULT_DESEN_APP_REPEATABLE_DEMO_ARTIFACT_PATH);
  if (destination === frozen.destination && exists) {
    const existing = await readRegularAuthority(destination, ARTIFACT_PATH);
    if (!existing.equals(built.artifactBytes))
      fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked T08 artifact.");
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "The atomic T08 artifact write failed.");
  }
  return deepFreeze({
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: DESEN_APP_REPEATABLE_DEMO_ROOT_TEST_NAMES.length,
  });
}
