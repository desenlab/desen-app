import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants as fileConstants,
  lstatSync,
  realpathSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
} from "node:fs";
import { lstat, open, opendir, realpath, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildCurrentDesenAppPublishedHostUpdateGraphAudit } from "./desen-app-published-host-update-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json";
const REPORT_PATH = "docs/proof/DESEN-APP-LAST-KNOWN-GOOD-RECOVERY.md";
const MAX_AUTHORITY_BYTES = 2 * 1024 * 1024;
const MAX_OVERRIDE_BYTES = 24 * 1024 * 1024;
const MAX_COMPILED_BYTES = 24 * 1024 * 1024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const execFileAsync = promisify(execFile);
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BROWSER_PACKAGE_PATH = "apps/desen-app-browser-e2e/package.json";
const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/restart-recovery.pw.ts",
  config: "apps/desen-app-browser-e2e/restart-recovery-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
});
const BROWSER_TEST_NAME =
  "preserves last-known-good across corrupt revision and Catalog mismatch through full cold restarts";
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config restart-recovery-playwright.config.ts";
const BROWSER_SUITE_COMMAND =
  "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts";
const T08_SUCCESSOR_PIN = Object.freeze({
  path: "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json",
  bytes: 319_719,
  sha256: "d91085d6cdc3533466375a77141b6394f0e76f2a8b29a41e8887b5d64e287f47",
});
const T08_CHANGED_TRACKED_PATHS = Object.freeze([
  BROWSER_PACKAGE_PATH,
  "pnpm-lock.yaml",
  "dependency-cruiser.config.cjs",
  "scripts/verify-boundary-fixtures.mjs",
]);
const T08_CHANGED_COMPILER_INPUTS = Object.freeze([
  "apps/reference-host-web-server/src/channel-activation-controller.ts",
  "apps/reference-host-web-server/src/index.ts",
  "apps/reference-host-web-server/src/server.ts",
]);
const T08_CHANGED_COMPILED_MODULES = Object.freeze([
  "apps/reference-host-web-server/dist/channel-activation-controller.js",
  "apps/reference-host-web-server/dist/server.js",
]);
const COMPILED_ROOTS = Object.freeze([
  "packages/protocol",
  "packages/publisher",
  "packages/validator",
  "packages/runtime-core",
  "apps/control-plane-api",
  "apps/reference-host-web-server",
]);
const EXTERNAL_DEPENDENCIES = Object.freeze({ "better-sqlite3": "13.0.3", fastify: "5.12.2" });
const ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-last-known-good-recovery-proof.mjs",
  "scripts/verify-desen-app-last-known-good-recovery.mjs",
]);

/** Exact completed publication, rejection, service recovery, and independent host parents. */
export const DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M10-T05",
    proofId: "desen-app-published-host-update",
    profile: "desen.app.published-host-update-proof.v1",
    path: "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
    bytes: 189123,
    sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
  }),
  Object.freeze({
    task: "M10-T06",
    proofId: "desen-app-invalid-publication",
    profile: "desen.app.invalid-publication-proof.v1",
    path: "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json",
    bytes: 193291,
    sha256: "1eb4260306d20fc87558edc4da4027c96bbb84598b758b242b8530010fe6071a",
  }),
  Object.freeze({
    task: "M07-T08",
    proofId: "control-plane-runtime-recovery",
    profile: "desen.control-plane.runtime-recovery-proof.v1",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json",
    bytes: 44224,
    sha256: "c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9",
  }),
  Object.freeze({
    task: "M07-T11",
    proofId: "reference-host-web-channel-consumption",
    profile: "desen.reference-host-web.channel-consumption-proof.v1",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json",
    bytes: 39307,
    sha256: "48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0",
  }),
]);

/** Immutable task artifact identity, populated only after the independent task inputs stabilize. */
export const DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PIN = Object.freeze({
  bytes: 304094,
  sha256: "5e589bc8022de3ccf3add7a9ebab78006ecca6e72628e165f54eef4fd8b90b68",
});
/** Write-once tracked destination for reviewed M10-T07 evidence. */
export const DEFAULT_DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);
/** Closed root-contract identities; browser scenarios are executed independently. */
export const DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ROOT_TEST_NAMES = Object.freeze([
  "[parents] preserves the four exact completed parent artifacts",
  "[matrix] freshly rejects revision and Catalog mismatches and reconstructs exact durable roles",
  "[browser] audits a separate real-HTTP cold-process journey without claiming its execution",
  "[graphs] freshly observes complete current App and host graphs without historical projection",
  "[inputs] rejects hostile caller authority before filesystem or execution",
  "[freshness] captures caller bytes and rechecks current filesystem and compiled authorities",
  "[artifact] rejects modified evidence and false report identity",
  "[filesystem] rejects symlink and substituted artifact authorities",
  "[writer] preserves frozen destinations and interrupted temporary writes",
]);

const TRACKED_PATHS = Object.freeze(
  [
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/control-plane-api/dist/index.js",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/desen-app/dev/local-publication-host.mjs",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/apps/reference-host-web-server/dist/index.js",
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-recovery-server-reviewed-roots/packages/protocol/dist/index.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-recovery-server-imports-protocol/apps/desen-app-browser-e2e/proof-application.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-recovery-server-imports-protocol/packages/protocol/dist/index.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-app-source/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-app-source/apps/desen-app/src/application.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-control-plane-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-protocol-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-protocol-private/packages/protocol/dist/private.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-publisher/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-publisher/packages/publisher/src/index.ts",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-reference-host-private/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-reference-host-private/apps/reference-host-web-server/dist/private.js",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/restart-recovery-proof-server.mjs",
    "tests/boundaries/fixtures/desen-app-browser-e2e-recovery-server-imports-unreviewed-dev-module/apps/desen-app/dev/local-publication-private.mjs",
    ...Object.values(BROWSER_PATHS),
    BROWSER_PACKAGE_PATH,
    "pnpm-lock.yaml",
    "dependency-cruiser.config.cjs",
    "scripts/verify-boundary-fixtures.mjs",
    ...COMPILED_ROOTS.map((root) => root + "/package.json"),
    ...ENTRYPOINT_PATHS,
    CATALOG_PATH,
    SOURCE_PATH,
    ...DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS.map(({ path: parentPath }) => parentPath),
  ].sort((a, b) => a.localeCompare(b, "en-US")),
);

/** Stable fail-closed diagnostic from the deterministic M10-T07 proof reader. */
export class DesenAppLastKnownGoodRecoveryProofError extends Error {
  /** Creates an evidence failure without exposing raw child output or private fixture paths. */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppLastKnownGoodRecoveryProofError";
    this.code = code;
    this.details = Object.freeze(details);
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppLastKnownGoodRecoveryProofError(code, message, details);
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
  for (const pin of DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS) {
    const bytes = files.get(pin.path);
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PARENT_DRIFT", "A frozen T07 prerequisite changed.", { path: pin.path });
    }
    const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
    if (
      artifact.task !== pin.task ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.result !== "PASS"
    ) {
      fail("PARENT_DRIFT", "A frozen T07 prerequisite lost its exact identity.");
    }
  }
}

async function compiledSnapshot(workspaceRoot) {
  const files = new Map();
  let totalBytes = 0;
  let entries = 0;
  for (const root of COMPILED_ROOTS) {
    const manifest = parseJson(
      await readRegularAuthority(path.join(workspaceRoot, root, "package.json"), root),
      root,
    );
    if (
      manifest.name !== "@desen/" + path.basename(root) ||
      manifest.type !== "module" ||
      manifest.exports?.["."]?.import !== "./dist/index.js"
    )
      fail("PUBLIC_API_DRIFT", "The matrix must use emitted public workspace roots.");
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      const expectedRoot = COMPILED_ROOTS.find(
        (candidate) => name === "@desen/" + path.basename(candidate),
      );
      const resolved = await realpath(path.join(workspaceRoot, root, "node_modules", name));
      if (expectedRoot !== undefined) {
        if (resolved !== path.join(workspaceRoot, expectedRoot))
          fail(
            "PUBLIC_API_DRIFT",
            "A public dependency resolves outside its reviewed workspace root.",
          );
      } else {
        const installed = parseJson(
          await readRegularAuthority(path.join(resolved, "package.json"), name),
          name,
        );
        if (
          EXTERNAL_DEPENDENCIES[name] !== version ||
          installed.name !== name ||
          installed.version !== version
        )
          fail("PUBLIC_API_DRIFT", "An external matrix dependency changed its reviewed identity.");
      }
    }
    const pending = [root + "/dist"];
    while (pending.length > 0) {
      const directoryPath = pending.pop();
      const absolute = path.join(workspaceRoot, directoryPath);
      if ((await realpath(absolute)) !== absolute)
        fail("PUBLIC_API_DRIFT", "An emitted directory is indirect.");
      const directory = await opendir(absolute);
      for await (const entry of directory) {
        if (++entries > 4096)
          fail("PUBLIC_API_DRIFT", "The emitted inventory exceeds its finite entry limit.");
        const relativePath = directoryPath + "/" + entry.name;
        if (entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory()))
          fail("PUBLIC_API_DRIFT", "An emitted entry is not regular.");
        if (entry.isDirectory()) pending.push(relativePath);
        else if (entry.name.endsWith(".js")) {
          const bytes = await readRegularAuthority(
            path.join(workspaceRoot, relativePath),
            relativePath,
          );
          totalBytes += bytes.byteLength;
          if (files.size >= 1024 || totalBytes > MAX_COMPILED_BYTES)
            fail("PUBLIC_API_DRIFT", "The emitted inventory exceeds its finite byte limit.");
          files.set(relativePath, bytes);
        }
      }
    }
    if (!files.has(root + "/dist/index.js"))
      fail("PUBLIC_API_DRIFT", "A public emitted root is missing.");
  }
  return receipts(new Map([...files].sort(([a], [b]) => a.localeCompare(b, "en-US"))));
}

async function authenticateFreshEmission(workspaceRoot, compiled) {
  // The compiler reads a private, bounded snapshot, never writes outputs, and is not a typecheck.
  // NodeNext needs its actual package context; transpileModule alone would choose CommonJS.
  const captured = new Map();
  const aliases = new Map();
  let total = 0;
  const readCompilerFile = (fileName) => {
    let physical;
    try {
      physical = realpathSync(fileName);
    } catch {
      return undefined;
    }
    if (!physical.startsWith(workspaceRoot + path.sep))
      fail("PUBLIC_API_DRIFT", "A compiler input escaped the workspace installation.");
    if (
      !fileName.includes(path.sep + "node_modules" + path.sep) &&
      physical !== path.resolve(fileName)
    )
      fail("PUBLIC_API_DRIFT", "A compiler source or configuration authority is indirect.");
    aliases.set(fileName, physical);
    if (aliases.size > 8192)
      fail("PUBLIC_API_DRIFT", "The compiler resolution inventory exceeds its finite limit.");
    if (captured.has(physical)) return captured.get(physical).toString("utf8");
    let fd;
    try {
      const before = lstatSync(physical);
      if (!before.isFile() || before.size > MAX_AUTHORITY_BYTES)
        throw new Error("unsafe compiler input");
      fd = openSync(physical, READ_FLAGS);
      if (!sameStat(before, fstatSync(fd))) throw new Error("substituted compiler input");
      const bytes = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const count = readSync(fd, bytes, offset, bytes.byteLength - offset, offset);
        if (count === 0) throw new Error("truncated compiler input");
        offset += count;
      }
      if (readSync(fd, Buffer.alloc(1), 0, 1, offset) !== 0)
        throw new Error("grown compiler input");
      if (!sameStat(before, fstatSync(fd)) || !sameStat(before, lstatSync(physical)))
        throw new Error("changed compiler input");
      total += bytes.byteLength;
      if (captured.size >= 4096 || total > MAX_COMPILED_BYTES) throw new Error("compiler envelope");
      const text = decodeUtf8(bytes, physical);
      captured.set(physical, bytes);
      return text;
    } catch (error) {
      if (error instanceof DesenAppLastKnownGoodRecoveryProofError) throw error;
      fail("PUBLIC_API_DRIFT", "A compiler input is not a bounded stable regular file.");
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  };
  const inventory = async () => {
    const names = [];
    let entries = 0;
    for (const root of COMPILED_ROOTS) {
      const pending = [path.join(workspaceRoot, root, "src")];
      while (pending.length) {
        const current = pending.pop();
        if ((await realpath(current)) !== current)
          fail("PUBLIC_API_DRIFT", "A source inventory directory is indirect.");
        for await (const entry of await opendir(current)) {
          if (++entries > 4096)
            fail("PUBLIC_API_DRIFT", "The source entry inventory exceeds its finite limit.");
          const name = path.join(current, entry.name);
          if (entry.isDirectory()) pending.push(name);
          else if (!entry.isFile())
            fail("PUBLIC_API_DRIFT", "A source inventory entry is not regular.");
          else if (/\.tsx?$/.test(entry.name)) names.push(name);
          if (names.length > 1024 || pending.length > 1024)
            fail("PUBLIC_API_DRIFT", "The source inventory exceeds its finite limit.");
        }
      }
    }
    return names.sort();
  };
  const sourceInventory = await inventory();
  for (const name of sourceInventory) readCompilerFile(name);
  const emitted = new Map();
  for (const root of COMPILED_ROOTS) {
    const absoluteRoot = path.join(workspaceRoot, root);
    readCompilerFile(path.join(absoluteRoot, "package.json"));
    const parsed = ts.getParsedCommandLineOfConfigFile(
      path.join(absoluteRoot, "tsconfig.build.json"),
      {},
      {
        useCaseSensitiveFileNames: true,
        getCurrentDirectory: () => workspaceRoot,
        readDirectory: (directory) =>
          sourceInventory.filter((name) => name.startsWith(directory + path.sep)),
        fileExists: ts.sys.fileExists,
        readFile: readCompilerFile,
        onUnRecoverableConfigFileDiagnostic: () =>
          fail("PUBLIC_API_DRIFT", "A build configuration cannot be parsed."),
      },
    );
    if (
      !parsed ||
      parsed.errors.length ||
      parsed.options.isolatedModules !== true ||
      parsed.options.verbatimModuleSyntax !== true ||
      parsed.options.allowJs !== false ||
      parsed.options.noEmit !== false ||
      parsed.options.rootDir !== path.join(absoluteRoot, "src") ||
      parsed.options.outDir !== path.join(absoluteRoot, "dist") ||
      parsed.fileNames.some((name) => !sourceInventory.includes(name))
    )
      fail(
        "PUBLIC_API_DRIFT",
        "The six public build configurations lost their exact isolated emit boundary.",
      );
    const rootSources = sourceInventory.filter((name) =>
      name.startsWith(path.join(absoluteRoot, "src") + path.sep),
    );
    if (!isDeepStrictEqual([...parsed.fileNames].sort(), rootSources))
      fail("PUBLIC_API_DRIFT", "The compiler omitted a current public source.");
    const writeOutput = (fileName, text) => {
      if (!fileName.endsWith(".js")) return;
      if (!fileName.startsWith(path.join(absoluteRoot, "dist") + path.sep))
        fail("PUBLIC_API_DRIFT", "The compiler emitted outside its reviewed public root.");
      const relative = path.relative(workspaceRoot, fileName).split(path.sep).join("/");
      if (emitted.has(relative))
        fail("PUBLIC_API_DRIFT", "The compiler emitted a duplicate module.");
      emitted.set(relative, Buffer.from(text));
    };
    if (parsed.options.module === ts.ModuleKind.NodeNext) {
      const host = ts.createCompilerHost(parsed.options);
      host.readFile = readCompilerFile;
      host.getSourceFile = (fileName, languageVersion) => {
        const text = readCompilerFile(fileName);
        return text === undefined
          ? undefined
          : ts.createSourceFile(fileName, text, languageVersion);
      };
      host.writeFile = writeOutput;
      const program = ts.createProgram(parsed.fileNames, parsed.options, host);
      const result = program.emit(undefined, writeOutput, undefined, false);
      if (
        result.emitSkipped ||
        result.diagnostics.some(({ category }) => category === ts.DiagnosticCategory.Error)
      )
        fail("PUBLIC_API_DRIFT", "The public NodeNext sources could not emit.");
    } else {
      if (parsed.options.module !== ts.ModuleKind.ESNext)
        fail("PUBLIC_API_DRIFT", "An isolated public root changed module emission mode.");
      for (const sourceName of parsed.fileNames) {
        const result = ts.transpileModule(readCompilerFile(sourceName), {
          fileName: sourceName,
          compilerOptions: parsed.options,
          reportDiagnostics: true,
        });
        if (result.diagnostics?.some(({ category }) => category === ts.DiagnosticCategory.Error))
          fail("PUBLIC_API_DRIFT", "An isolated public source could not emit.");
        writeOutput(
          path
            .join(absoluteRoot, "dist", path.relative(parsed.options.rootDir, sourceName))
            .replace(/\.tsx?$/, ".js"),
          result.outputText,
        );
      }
    }
  }
  const actual = receipts(new Map([...emitted].sort(([a], [b]) => a.localeCompare(b, "en-US"))));
  if (!isDeepStrictEqual(actual, compiled))
    fail(
      "PUBLIC_API_DRIFT",
      "Current TypeScript emission does not match the complete compiled public closure.",
    );
  const before = receipts(
    new Map(
      [...captured]
        .map(([name, bytes]) => [
          path.relative(workspaceRoot, name).split(path.sep).join("/"),
          bytes,
        ])
        .sort(([a], [b]) => a.localeCompare(b, "en-US")),
    ),
  );
  const reauthenticate = async () => {
    for (const [name, physical] of aliases)
      if ((await realpath(name)) !== physical)
        fail("PUBLIC_API_DRIFT", "A compiler resolution authority changed during execution.");
    if (!isDeepStrictEqual(sourceInventory, await inventory()))
      fail("PUBLIC_API_DRIFT", "A public source inventory changed during execution.");
    for (const [name, bytes] of captured)
      if (!(await readRegularAuthority(name, "compiler input")).equals(bytes))
        fail("PUBLIC_API_DRIFT", "A captured compiler authority changed during execution.");
  };
  await reauthenticate();
  return {
    authority: {
      profile: "desen.fresh-public-typescript-emission.v1",
      typecheckExecuted: false,
      workspaceWrites: false,
      rootCount: 6,
      moduleCount: compiled.length,
      sourceCount: sourceInventory.length,
      inputReceipts: before,
    },
    reauthenticate,
  };
}

// Executed anew in one bounded child. Service close/reopen here is not the browser's cold-PID proof.
async function publicMatrixProgram(input) {
  const { default: assert } = await import("node:assert/strict");
  const { publishDesenSource } = await import(input.publisherUrl);
  const { canonicalizeJsonBytes, calculateDesenBundleRevision } = await import(input.protocolUrl);
  const {
    openBundleStore,
    verifyBundleStoreEntry,
    preflightBundlePackages,
    preflightBundleReferences,
    stageBundleRuntime,
    openBundleRuntimeActivation,
  } = await import(input.controlPlaneUrl);
  const { loadReferenceHostInstalledPackage } = await import(input.hostUrl);
  const installed = await loadReferenceHostInstalledPackage({
    installedPackageDirectory: input.packageDirectory,
  });
  assert.deepEqual(installed.catalog, input.catalog);
  const catalogs = [
    {
      id: input.catalog.id,
      version: input.catalog.version,
      target: input.catalog.target,
      observedPackageDigest: input.catalog.packageDigest,
      catalog: input.catalog,
    },
  ];
  const sourceBefore = JSON.stringify(input.source);
  const catalogBefore = JSON.stringify(input.catalog);
  const publish = (label) => {
    const source = structuredClone(input.source);
    source.surfaces["sign-in"].root.slots.default[0].props.text = label;
    const first = publishDesenSource(JSON.stringify(source), catalogs);
    const second = publishDesenSource(JSON.stringify(source), catalogs);
    assert.equal(first.ok, true);
    assert.deepEqual(second, first);
    return {
      revision: first.bundle.revision,
      bytes: canonicalizeJsonBytes(first.bundle),
      bundle: first.bundle,
    };
  };
  const a = publish("Verified recovery A");
  const c = publish("Verified recovery C");
  assert.notEqual(a.revision, c.revision);
  const store = await openBundleStore({ rootDirectory: input.rootDirectory });
  assert.deepEqual(await store.putBundle({ revision: a.revision, bytes: a.bytes }), {
    status: "stored",
  });
  assert.deepEqual(await store.putBundle({ revision: c.revision, bytes: c.bytes }), {
    status: "stored",
  });
  const packageAuthority = async (revision) => {
    const read = await store.getBundle(revision);
    assert.equal(read.status, "found");
    const integrity = verifyBundleStoreEntry(read.entry, { status: "not-available" });
    assert.equal(integrity.status, "verified");
    const packages = preflightBundlePackages(integrity.authority, [installed]);
    assert.equal(packages.status, "preflighted");
    return packages.authority;
  };
  const pair = async (revision) => {
    const packages = await packageAuthority(revision);
    const references = preflightBundleReferences(packages);
    const staged = stageBundleRuntime(packages);
    assert.equal(references.status, "preflighted");
    assert.equal(staged.status, "staged");
    return { references: references.authority, staged: staged.authority };
  };
  const record = (authority) => ({
    activeRevision: authority.activeRevision,
    previousGoodRevision: authority.previousGoodRevision,
    generation: authority.generation,
  });
  const aRecord = { activeRevision: a.revision, previousGoodRevision: null, generation: 0 };
  const cRecord = { activeRevision: c.revision, previousGoodRevision: a.revision, generation: 1 };
  let service = await openBundleRuntimeActivation({ rootDirectory: input.rootDirectory });
  let reopenCount = 0;
  const rows = [];
  try {
    assert.deepEqual(service.readState(), { status: "empty" });
    const aPair = await pair(a.revision);
    const activated = await service.activate(aPair.references, aPair.staged, null);
    assert.equal(activated.status, "activated");
    assert.deepEqual(record(activated.authority), aRecord);
    const before = service.readState();
    const mismatchedKey = "sha256:" + "f".repeat(64);
    assert.notEqual(mismatchedKey, c.revision);
    const mismatched = structuredClone(c.bundle);
    mismatched.requires.catalogs[0].digest = "sha256:" + "0".repeat(64);
    mismatched.revision = calculateDesenBundleRevision(mismatched);
    const candidates = [
      {
        id: "corrupt-revision",
        entry: { revision: mismatchedKey, bytes: c.bytes },
        stage: "bundle-revision",
        code: "REVISION_MISMATCH",
        pointer: "/revision",
      },
      {
        id: "catalog-mismatch",
        entry: { revision: mismatched.revision, bytes: canonicalizeJsonBytes(mismatched) },
        stage: "package-digest",
        code: "CATALOG_DIGEST_MISMATCH",
        pointer: "/requires/catalogs/0/digest",
      },
    ];
    for (const candidate of candidates) {
      // The public store treats prior verification as its trusted caller precondition. This is
      // explicit inert fault material, not a claimed successful Publisher publication.
      assert.deepEqual(await store.putBundle(candidate.entry), { status: "stored" });
      const read = await store.getBundle(candidate.entry.revision);
      assert.equal(read.status, "found");
      const integrity = verifyBundleStoreEntry(read.entry, { status: "not-available" });
      const rejected =
        candidate.id === "corrupt-revision"
          ? integrity
          : preflightBundlePackages(integrity.authority, [installed]);
      if (candidate.id === "catalog-mismatch") assert.equal(integrity.status, "verified");
      assert.equal(rejected.status, "rejected");
      assert.equal(rejected.stage, candidate.stage);
      assert.equal(Object.hasOwn(rejected, "authority"), false);
      assert.deepEqual(
        rejected.diagnostics.map(({ code, pointer }) => ({ code, pointer })),
        [{ code: candidate.code, pointer: candidate.pointer }],
      );
      assert.deepEqual(service.readState(), before);
      assert.deepEqual((await store.getBundle(a.revision)).entry.bytes, a.bytes);
      rows.push({
        id: candidate.id,
        stage: rejected.stage,
        diagnostics: rejected.diagnostics.map(({ code, pointer }) => ({ code, pointer })),
        partialAuthority: false,
        activeRecord: aRecord,
        activeBundleBytesUnchanged: true,
      });
    }
    service.close();
    service = await openBundleRuntimeActivation({ rootDirectory: input.rootDirectory });
    reopenCount += 1;
    assert.deepEqual(service.readState(), { status: "recovery-required", record: aRecord });
    const forged = await service.recover(structuredClone(await packageAuthority(a.revision)), null);
    assert.equal(forged.status, "rejected");
    assert.equal(forged.stage, "package-authority");
    assert.equal(forged.role, "active");
    assert.equal(Object.hasOwn(forged, "authority"), false);
    assert.deepEqual(service.readState(), { status: "recovery-required", record: aRecord });
    const recoveredA = await service.recover(await packageAuthority(a.revision), null);
    assert.equal(recoveredA.status, "recovered");
    assert.deepEqual(record(recoveredA.authority), aRecord);
    const cPair = await pair(c.revision);
    const activatedC = await service.activate(cPair.references, cPair.staged, 0);
    assert.equal(activatedC.status, "activated");
    assert.deepEqual(record(activatedC.authority), cRecord);
    service.close();
    service = await openBundleRuntimeActivation({ rootDirectory: input.rootDirectory });
    reopenCount += 1;
    assert.deepEqual(service.readState(), { status: "recovery-required", record: cRecord });
    for (const [active, previous, expectedRole] of [
      [await packageAuthority(c.revision), null, "previous-good"],
      [await packageAuthority(a.revision), await packageAuthority(c.revision), "active"],
    ]) {
      const rejected = await service.recover(active, previous);
      assert.equal(rejected.status, "rejected");
      assert.equal(rejected.stage, "package-authority");
      assert.equal(rejected.role, expectedRole);
      assert.equal(Object.hasOwn(rejected, "authority"), false);
      assert.deepEqual(service.readState(), { status: "recovery-required", record: cRecord });
    }
    const recoveredC = await service.recover(
      await packageAuthority(c.revision),
      await packageAuthority(a.revision),
    );
    assert.equal(recoveredC.status, "recovered");
    assert.deepEqual(record(recoveredC.authority), cRecord);
    assert.deepEqual(record(service.readState().authority), cRecord);
    assert.deepEqual((await store.getBundle(a.revision)).entry.bytes, a.bytes);
    assert.deepEqual((await store.getBundle(c.revision)).entry.bytes, c.bytes);
    assert.equal(JSON.stringify(input.source), sourceBefore);
    assert.equal(JSON.stringify(input.catalog), catalogBefore);
    process.stdout.write(
      JSON.stringify({
        profile: "desen.app.last-known-good-public-api-matrix.v1",
        result: "PASS",
        publicRoots: [
          "@desen/publisher",
          "@desen/protocol",
          "@desen/control-plane-api",
          "@desen/reference-host-web-server",
        ],
        publicPublisherCalls: 4,
        invalidCandidates: rows,
        firstActivation: aRecord,
        recoveredA: record(recoveredA.authority),
        finalActivation: cRecord,
        recoveredC: record(recoveredC.authority),
        recoveryNegatives: [
          "cloned-active-authority",
          "missing-previous-good-authority",
          "swapped-durable-role-authorities",
        ],
        serviceReopenCount: reopenCount,
        freshPublicApiChild: true,
        productProcessRestartExecuted: false,
        browserExecuted: false,
        listenerStarted: false,
        channelTransportExercised: false,
        automaticRollback: false,
        immutableValidBundlesPreserved: true,
        rejectedCandidatesNeverActivated: true,
      }),
    );
  } finally {
    service.close();
  }
}

async function runPublicMatrix(workspaceRoot, source, catalog) {
  const before = await compiledSnapshot(workspaceRoot);
  const emission = await authenticateFreshEmission(workspaceRoot, before);
  const rootDirectory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-t07-public-api-")),
  );
  let output;
  try {
    const input = {
      publisherUrl: pathToFileURL(path.join(workspaceRoot, "packages/publisher/dist/index.js"))
        .href,
      protocolUrl: pathToFileURL(path.join(workspaceRoot, "packages/protocol/dist/index.js")).href,
      controlPlaneUrl: pathToFileURL(
        path.join(workspaceRoot, "apps/control-plane-api/dist/index.js"),
      ).href,
      hostUrl: pathToFileURL(
        path.join(workspaceRoot, "apps/reference-host-web-server/dist/index.js"),
      ).href,
      packageDirectory: path.join(workspaceRoot, "packages/reference-catalog-web"),
      rootDirectory,
      source,
      catalog,
    };
    const program =
      "await (" + publicMatrixProgram.toString() + ")(" + JSON.stringify(input) + ");";
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--input-type=module", "-e", program],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        maxBuffer: 128 * 1024,
        timeout: 20000,
        killSignal: "SIGKILL",
        windowsHide: true,
      },
    );
    if (stderr.trim() !== "")
      fail("PUBLIC_MATRIX_FAILED", "The bounded public API child emitted unexpected diagnostics.");
    output = parseJson(Buffer.from(stdout), "public API matrix", "PUBLIC_MATRIX_FAILED");
  } catch (error) {
    if (error instanceof DesenAppLastKnownGoodRecoveryProofError) throw error;
    fail("PUBLIC_MATRIX_FAILED", "The bounded fresh public API matrix failed.");
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
  const after = await compiledSnapshot(workspaceRoot);
  await emission.reauthenticate();
  if (!isDeepStrictEqual(before, after))
    fail("PUBLIC_API_DRIFT", "The emitted public API closure changed during execution.");
  if (
    output?.result !== "PASS" ||
    output.invalidCandidates?.length !== 2 ||
    output.serviceReopenCount !== 2 ||
    output.productProcessRestartExecuted !== false ||
    output.listenerStarted !== false
  )
    fail("PUBLIC_MATRIX_FAILED", "The public API matrix lost its exact bounded result.");
  return {
    result: deepFreeze({
      ...output,
      freshEmission: emission.authority,
      compiledModuleReceipts: before,
      compiledModuleCount: before.length,
    }),
    reauthenticate: async () => {
      await emission.reauthenticate();
      if (!isDeepStrictEqual(before, await compiledSnapshot(workspaceRoot)))
        fail(
          "PUBLIC_API_DRIFT",
          "The compiled public authority changed before the complete proof closed.",
        );
    },
  };
}

/** Executes the sockets-free public API matrix in one new bounded child and owned temporary root. */
export async function runDesenAppLastKnownGoodRecoveryPublicMatrix(rawOptions = undefined) {
  const options = exactOptions(rawOptions, ["workspaceRoot"], "matrix options");
  const workspaceRoot = capturePath(options.workspaceRoot ?? WORKSPACE_ROOT, "workspaceRoot");
  const sourceBytes = await readRegularAuthority(
    path.join(workspaceRoot, SOURCE_PATH),
    SOURCE_PATH,
  );
  const catalogBytes = await readRegularAuthority(
    path.join(workspaceRoot, CATALOG_PATH),
    CATALOG_PATH,
  );
  const result = await runPublicMatrix(
    workspaceRoot,
    parseJson(sourceBytes, SOURCE_PATH),
    parseJson(catalogBytes, CATALOG_PATH),
  );
  if (
    !(await readRegularAuthority(path.join(workspaceRoot, SOURCE_PATH), SOURCE_PATH)).equals(
      sourceBytes,
    ) ||
    !(await readRegularAuthority(path.join(workspaceRoot, CATALOG_PATH), CATALOG_PATH)).equals(
      catalogBytes,
    )
  )
    fail("SOURCE_SNAPSHOT_DRIFT", "The standalone public matrix input changed across execution.");
  await result.reauthenticate();
  return result.result;
}

const CODE_PRINTER = ts.createPrinter({ removeComments: true });
function parseCode(source, relativePath) {
  const tree = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (tree.parseDiagnostics.length)
    fail("BROWSER_POLICY_VIOLATION", "A browser authority does not parse.");
  return tree;
}
function requireMarkers(source, markers, label) {
  const compact = (value) => value.replace(/\s+/gu, "");
  for (const marker of markers)
    if (!compact(source).includes(compact(marker)))
      fail("BROWSER_POLICY_VIOLATION", "A reviewed browser declaration is missing.", {
        path: label,
        marker,
      });
}

/** Audits declaration-only cold-process evidence; this never executes or attests Chromium. */
export function verifyDesenAppLastKnownGoodRecoveryBrowserPolicy(rawInput) {
  const input = exactOptions(rawInput, Object.keys(BROWSER_PATHS), "browser policy");
  const sources = Object.fromEntries(
    Object.entries(BROWSER_PATHS).map(([key, name]) => [
      key,
      decodeUtf8(captureBytes(input[key], name), name),
    ]),
  );
  const trees = Object.fromEntries(
    Object.entries(BROWSER_PATHS).map(([key, name]) => [key, parseCode(sources[key], name)]),
  );
  const printed = Object.fromEntries(
    Object.entries(trees).map(([key, tree]) => [key, CODE_PRINTER.printFile(tree)]),
  );
  const names = [];
  const imports = { spec: [], config: [], server: [] };
  for (const [key, tree] of Object.entries(trees)) {
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) imports[key].push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const name = ts.isPropertyAccessExpression(expression)
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
          ].includes(name)
        )
          fail(
            "BROWSER_POLICY_VIOLATION",
            "The journey gained hidden injection or replacement transport.",
          );
        if (expression.kind === ts.SyntaxKind.ImportKeyword)
          fail(
            "BROWSER_POLICY_VIOLATION",
            "The browser composition gained an unreviewed dynamic import.",
          );
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          ["test", "base", "describe"].includes(expression.expression.text) &&
          ["skip", "only", "fixme", "fail", "slow"].includes(name)
        )
          fail("BROWSER_POLICY_VIOLATION", "The journey gained a skip or alternate-result mode.");
        if (key === "spec" && ts.isIdentifier(expression) && expression.text === "test") {
          if (!ts.isStringLiteral(node.arguments[0]))
            fail("BROWSER_POLICY_VIOLATION", "The scenario title must stay literal.");
          names.push(node.arguments[0].text);
          const callback = node.arguments[1];
          if (
            !callback ||
            !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) ||
            !ts.isBlock(callback.body)
          )
            fail(
              "BROWSER_POLICY_VIOLATION",
              "The scenario must own one literal executable callback.",
            );
          const visitBody = (statement) => {
            if (ts.isFunctionLike(statement)) return;
            if (ts.isReturnStatement(statement))
              fail("BROWSER_POLICY_VIOLATION", "The scenario acquired an early successful exit.");
            ts.forEachChild(statement, visitBody);
          };
          visitBody(callback.body);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  if (!isDeepStrictEqual(names, [BROWSER_TEST_NAME]))
    fail("BROWSER_POLICY_VIOLATION", "The exact cold-process scenario is missing or duplicated.");
  const allowedImports = {
    spec: [
      "node:child_process",
      "node:crypto",
      "node:fs/promises",
      "node:os",
      "node:path",
      "@playwright/test",
    ],
    config: ["node:path", "@playwright/test"],
    server: [
      "node:buffer",
      "node:crypto",
      "node:fs/promises",
      "node:path",
      "node:process",
      "node:url",
      "@desen/control-plane-api",
      "@desen/protocol",
      "@desen/reference-host-web-server",
      "vite",
      "../desen-app/dev/local-publication-host.mjs",
    ],
  };
  for (const key of Object.keys(trees))
    if (!isDeepStrictEqual([...new Set(imports[key])].sort(), [...allowedImports[key]].sort()))
      fail("BROWSER_POLICY_VIOLATION", "The browser composition public-root boundary changed.");
  requireMarkers(
    printed.spec,
    [
      'profile: "desen.app.last-known-good-recovery-browser.v1"',
      'positiveInput: "normal-product-visible-authoring"',
      'negativeInput: "isolated-ipc-authenticated-bundle-put-and-channel-cas"',
      'restart: "full-composition-new-pid-and-fresh-browser-context"',
      'cases: ["corrupt-revision", "catalog-mismatch"]',
      "child = fork(CHILD_PATH, [],",
      'await command("shutdown")',
      "await waitForExit(5000)",
      "restart: async () => { await stop(); return boot(true); }",
      'name: "New project"',
      'name: "Save source", exact: true',
      'name: "Publish", exact: true',
      '(["corrupt-revision", "catalog-mismatch"] as const).entries()',
      "expect(rejected.bundlePutStatus).toBe(201)",
      "expect(rejected.channelPutStatus).toBe(200)",
      "expect(rejected.activeRecord).toEqual(baseline.activeRecord)",
      "expect(rejected.source).toEqual(baseline.source)",
      "await context.close()",
      "const restarted = await composition.restart()",
      "context = await createContext()",
      "expect(restarted.pid).not.toBe(beforeRestart.pid)",
      "expect(afterRestart.channel).toEqual(rejected.channel)",
      "expect(afterRestart.activeRecord).toEqual(baseline.activeRecord)",
      "expect(afterRestart.source).toEqual(baseline.source)",
      "expect(afterRestart.candidate).toEqual(rejected.candidate)",
      "expect(recovered.identity).toEqual(current.identity)",
      "expect(afterRestart.builds.host).toBe(baseline.builds.host)",
      "expect(afterRestart.appSource).toBe(baseline.appSource)",
      "const revisionD = await saveAndPublish(page, 4)",
      "expect(revisionD).not.toBe(revisionC)",
      "expect(finalHost.identity).toEqual({ generation: 2, revision: revisionD })",
      'expect(final.channel).toEqual({ channelName: "preview", generation: 5, revision: revisionD })',
      "expect(final.activeRecord).toEqual({ activeRevision: revisionD, previousGoodRevision: revisionC, generation: 2, })",
      'expect(final.candidate).toEqual({ status: "verified" })',
      "expect(final.builds).toEqual(currentBuilds)",
      "expect(final.builds.host).toBe(baseline.builds.host)",
      "expect(final.appSource).toBe(baseline.appSource)",
      "expect(errors).toEqual([])",
    ],
    BROWSER_PATHS.spec,
  );
  requireMarkers(
    printed.config,
    [
      'testMatch: "restart-recovery.pw.ts"',
      "fullyParallel: false",
      "forbidOnly: Boolean(process.env.CI)",
      "retries: 0",
      "workers: 1",
      '...devices["Desktop Chrome"]',
      'name: "restart-recovery-chromium"',
    ],
    BROWSER_PATHS.config,
  );
  if (/\bwebServer\s*:/u.test(printed.config))
    fail(
      "BROWSER_POLICY_VIOLATION",
      "The cold-process owner cannot use an independently retained webServer.",
    );
  requireMarkers(
    printed.server,
    [
      'Object.freeze(["boot", "observe", "install-negative", "shutdown"])',
      'Object.freeze(["corrupt-revision", "catalog-mismatch"])',
      "openLocalControlPlane(",
      "openReferenceHostWebServer(",
      "openDesenAppLocalPublicationHost(",
      "openBundleRuntimeActivation(",
      "verifyBundleStoreEntry(",
      "preflightBundlePackages(",
      "calculateDesenBundleRevision(bundle)",
      '"REVISION_MISMATCH"',
      '"CATALOG_DIGEST_MISMATCH"',
      'controlPlaneRequest(`/v1/bundles/${bundle.revision}`, "PUT", bytes)',
      "JSON.stringify(after.activeRecord) === JSON.stringify(before.activeRecord)",
      "COMMANDS.includes(message.command)",
      "message.id === lastRequestId + 1",
      'process.on("message"',
    ],
    BROWSER_PATHS.server,
  );
  return deepFreeze({
    command: BROWSER_COMMAND,
    spec: BROWSER_PATHS.spec,
    configuration: BROWSER_PATHS.config,
    server: BROWSER_PATHS.server,
    testName: BROWSER_TEST_NAME,
    chromiumScenarios: 1,
    negativeClasses: ["corrupt-revision", "catalog-mismatch"],
    declarationOnly: true,
    browserExecutedByVerifier: false,
    productProcessRestartExecutedByVerifier: false,
    declaredColdRestart: "full composition new PID and fresh BrowserContext",
    declaredPreservation: [
      "active revision",
      "previous-good revision",
      "activation generation",
      "saved Source",
      "invalid selected channel",
      "host build",
      "App source",
    ],
    appConfigurationLifetime:
      "normal App rebuild in the same owned output root for each new ephemeral activation origin",
    traceConfigurationIsNotSecretsAudit: true,
  });
}

function verifyPackageWiring(files) {
  const browser = parseJson(files.get(BROWSER_PACKAGE_PATH), BROWSER_PACKAGE_PATH);
  if (
    browser.name !== "@desen/app-browser-e2e" ||
    browser.scripts?.["test:e2e"] !==
      `${BROWSER_SUITE_COMMAND} && playwright test --config repeatable-demo-playwright.config.ts` ||
    browser.devDependencies?.["@desen/protocol"] !== "workspace:*"
  )
    fail(
      "TEST_AUTHORITY_DRIFT",
      "The exact ninth browser command or public Protocol dependency changed.",
    );
  return {
    browserCommands: 9,
    exactPublicProtocolDevDependency: true,
    browserExecutedByVerifier: false,
  };
}

async function readT08Successor(workspaceRoot) {
  const bytes = await readRegularAuthority(
    path.join(workspaceRoot, T08_SUCCESSOR_PIN.path),
    T08_SUCCESSOR_PIN.path,
  );
  if (
    T08_SUCCESSOR_PIN.bytes <= 0 ||
    bytes.byteLength !== T08_SUCCESSOR_PIN.bytes ||
    sha256(bytes) !== T08_SUCCESSOR_PIN.sha256
  )
    fail("SUCCESSOR_DRIFT", "The exact reviewed T08 successor artifact changed.");
  const successor = parseJson(bytes, T08_SUCCESSOR_PIN.path, "SUCCESSOR_DRIFT");
  if (
    successor.task !== "M10-T08" ||
    successor.proofId !== "desen-app-repeatable-demo" ||
    successor.profile !== "desen.app.repeatable-demo-proof.v1" ||
    successor.result !== "PASS"
  )
    fail("SUCCESSOR_DRIFT", "The reviewed T08 successor identity changed.");
  return successor;
}

function assertSuccessorReceipt(receipt, candidates) {
  const matches = candidates?.filter((candidate) => candidate.path === receipt.path);
  if (matches?.length !== 1 || !isDeepStrictEqual(receipt, matches[0]))
    fail("SUCCESSOR_DRIFT", "A current input differs from its exact reviewed T08 receipt.", {
      path: receipt.path,
    });
}

function assertReviewedReceiptChanges(current, historical, successor, changedPaths) {
  if (
    !isDeepStrictEqual(
      current.map(({ path: name }) => name),
      historical.map(({ path: name }) => name),
    )
  )
    fail("SUCCESSOR_DRIFT", "An unreviewed current receipt inventory change cannot be projected.");
  for (let index = 0; index < current.length; index += 1) {
    if (changedPaths.includes(current[index].path))
      assertSuccessorReceipt(current[index], successor);
    else if (!isDeepStrictEqual(current[index], historical[index]))
      fail("SUCCESSOR_DRIFT", "A current receipt changed outside the exact T08 successor scope.", {
        path: current[index].path,
      });
  }
}

async function projectT08Successor(workspaceRoot, current, successor) {
  const historicalBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    ARTIFACT_PATH,
  );
  const historical = authenticateArtifact(historicalBytes);
  if (
    !isDeepStrictEqual(
      current.authority.currentGraphAudit,
      successor.authority?.currentGraphAudit,
    ) ||
    !isDeepStrictEqual(current.authority.publicApiMatrix, successor.authority?.publicApiMatrix)
  )
    fail(
      "SUCCESSOR_DRIFT",
      "Fresh current graph or recovery execution differs from reviewed T08 authority.",
    );
  const matrix = current.authority.publicApiMatrix;
  const previousMatrix = historical.authority.publicApiMatrix;
  assertReviewedReceiptChanges(
    current.boundary.trackedReceipts,
    historical.boundary.trackedReceipts,
    successor.boundary.trackedReceipts,
    T08_CHANGED_TRACKED_PATHS,
  );
  assertReviewedReceiptChanges(
    matrix.freshEmission.inputReceipts,
    previousMatrix.freshEmission.inputReceipts,
    successor.authority.publicApiMatrix.freshEmission.inputReceipts,
    T08_CHANGED_COMPILER_INPUTS,
  );
  assertReviewedReceiptChanges(
    matrix.compiledModuleReceipts,
    previousMatrix.compiledModuleReceipts,
    successor.authority.publicApiMatrix.compiledModuleReceipts,
    T08_CHANGED_COMPILED_MODULES,
  );
  const artifact = {
    ...current,
    authority: {
      ...current.authority,
      currentGraphAudit: historical.authority.currentGraphAudit,
      publicApiMatrix: {
        ...matrix,
        freshEmission: {
          ...matrix.freshEmission,
          inputReceipts: previousMatrix.freshEmission.inputReceipts,
        },
        compiledModuleReceipts: previousMatrix.compiledModuleReceipts,
      },
      packageWiring: { ...current.authority.packageWiring, browserCommands: 8 },
    },
    boundary: { ...current.boundary, trackedReceipts: historical.boundary.trackedReceipts },
  };
  // Outcomes, all counts, browser declarations and every other field remain exact task history.
  // In particular, receipt projection cannot turn a changed recovery result into historical PASS.
  if (!isDeepStrictEqual(artifact, historical))
    fail(
      "SUCCESSOR_DRIFT",
      "A non-metadata recovery outcome or unreviewed historical field changed.",
    );
  return deepFreeze({
    artifact,
    liveSuccessorAuthority: {
      task: "M10-T08",
      artifact: T08_SUCCESSOR_PIN,
      publicApiMatrix: matrix,
      currentGraphAudit: current.authority.currentGraphAudit,
      currentTrackedReceipts: current.boundary.trackedReceipts,
      projectedHistoricalFields: [
        "authority.currentGraphAudit",
        "authority.publicApiMatrix.freshEmission.inputReceipts",
        "authority.publicApiMatrix.compiledModuleReceipts",
        "authority.packageWiring.browserCommands",
        "boundary.trackedReceipts",
      ],
      currentObservationsAreNotHistoricalResults: true,
    },
  });
}

async function buildCurrentRecoveryObservation(workspaceRoot, files) {
  const { result: publicApiMatrix, reauthenticate: reauthenticateMatrix } = await runPublicMatrix(
    workspaceRoot,
    parseJson(files.get(SOURCE_PATH), SOURCE_PATH),
    parseJson(files.get(CATALOG_PATH), CATALOG_PATH),
  );
  let currentGraphAudit;
  try {
    currentGraphAudit = await buildCurrentDesenAppPublishedHostUpdateGraphAudit({ workspaceRoot });
  } catch (error) {
    fail("CURRENT_GRAPH_AUDIT_FAILED", "The complete current App and host graph audit failed.", {
      code: error?.code ?? "UNKNOWN",
    });
  }
  if (
    currentGraphAudit.runtimeResolution?.write !== false ||
    currentGraphAudit.runtimeResolution.independentBuildsPerApplication !== 2 ||
    currentGraphAudit.runtimeResolution.noHandwrittenHostManagedTreePreservedByFreshHostAudit !==
      true
  )
    fail(
      "CURRENT_GRAPH_AUDIT_FAILED",
      "The current graph authority lost its independent unprojected builds.",
    );
  return Object.freeze({
    observation: deepFreeze({ publicApiMatrix, currentGraphAudit }),
    reauthenticate: reauthenticateMatrix,
  });
}

/**
 * Freshly executes the sockets-free recovery matrix and complete live App/host graph audit.
 *
 * @remarks This acyclic observation accepts only a workspace root: no artifact, PASS receipt,
 * browser declaration, caller projection, or source override can supply current authority.
 * All compiler inputs and outputs are reauthenticated after the graph work, and both inert
 * matrix inputs are freshly re-read before return. It neither runs Chromium nor claims a
 * product-process restart.
 */
export async function buildCurrentDesenAppLastKnownGoodRecoveryObservation(rawOptions = undefined) {
  const options = exactOptions(rawOptions, ["workspaceRoot"], "current observation options");
  const requestedRoot = capturePath(options.workspaceRoot ?? WORKSPACE_ROOT, "workspaceRoot");
  const workspaceRoot = await realpath(requestedRoot).catch(() =>
    fail("AUTHORITY_UNSAFE", "The proof workspace is unavailable."),
  );
  const files = new Map();
  for (const name of [SOURCE_PATH, CATALOG_PATH]) {
    files.set(name, await readRegularAuthority(path.join(workspaceRoot, name), name));
  }
  const { observation, reauthenticate } = await buildCurrentRecoveryObservation(
    workspaceRoot,
    files,
  );
  for (const [name, before] of files) {
    const after = await readRegularAuthority(path.join(workspaceRoot, name), name);
    if (!Buffer.from(before).equals(after))
      fail(
        "SOURCE_SNAPSHOT_DRIFT",
        "A current recovery matrix input changed across graph execution.",
      );
  }
  await reauthenticate();
  return observation;
}

/** Builds current graphs and a fresh sockets-free API matrix without rehydrating any parent PASS. */
export async function buildDesenAppLastKnownGoodRecoveryEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot).catch(() =>
    fail("AUTHORITY_UNSAFE", "The proof workspace is unavailable."),
  );
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  authenticateParents(files);
  const browser = verifyDesenAppLastKnownGoodRecoveryBrowserPolicy(
    Object.fromEntries(Object.entries(BROWSER_PATHS).map(([key, name]) => [key, files.get(name)])),
  );
  const packageWiring = verifyPackageWiring(files);
  const successor = await readT08Successor(workspaceRoot);
  for (const name of T08_CHANGED_TRACKED_PATHS)
    assertSuccessorReceipt(
      { path: name, bytes: files.get(name).byteLength, sha256: sha256(files.get(name)) },
      successor.boundary.trackedReceipts,
    );
  const { observation, reauthenticate } = await buildCurrentRecoveryObservation(
    workspaceRoot,
    files,
  );
  const { publicApiMatrix, currentGraphAudit } = observation;
  const after = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  await reauthenticate();
  if (!isDeepStrictEqual(receipts(files), receipts(after)))
    fail("SOURCE_SNAPSHOT_DRIFT", "A tracked T07 authority changed across fresh execution.");
  for (const { path: name, bytes, sha256: digest } of publicApiMatrix.freshEmission.inputReceipts) {
    const captured = files.get(name);
    if (captured !== undefined && (captured.byteLength !== bytes || sha256(captured) !== digest))
      fail("SOURCE_SNAPSHOT_DRIFT", "The compiler and captured input authority disagree.");
  }
  const currentArtifact = deepFreeze({
    schemaVersion: 1,
    task: "M10-T07",
    gate: null,
    proofId: "desen-app-last-known-good-recovery",
    profile: "desen.app.last-known-good-recovery-proof.v1",
    result: "PASS",
    prerequisites: DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS,
    claim: {
      invalidRevisionAndCatalogRejected: true,
      durableActiveAndPreviousGoodRolesReconstructed: true,
      currentAppAndHostGraphAudited: true,
      independentColdProcessBrowserRequired: true,
      automaticRollback: false,
      g10Closed: false,
    },
    authority: { publicApiMatrix, currentGraphAudit, browser, packageWiring },
    tests: {
      browserCommand: BROWSER_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-last-known-good-recovery.mjs",
      proofReaderCommand: "node --test tests/desen-app-last-known-good-recovery.test.mjs",
      rootTestNames: DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ROOT_TEST_NAMES,
      publicApiMatrixExecutedByVerifier: true,
      browserExecutedByVerifier: false,
      productProcessRestartExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
      freshTypeScriptEmissionCompared: true,
      typecheckExecutedByVerifier: false,
      viteBuildsExecutedByVerifier: true,
      viteBuildOutputWritten: false,
    },
    boundary: {
      trackedFiles: files.size,
      trackedReceipts: receipts(files),
      immutableInputs: true,
      parentArtifacts: 4,
      currentGraphHasNoHistoricalProjection: true,
      sourceSymlinksRejected: true,
      publicMatrixUsesFreshProcess: true,
      ownedTemporaryServiceDataOnly: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-last-known-good-recovery-proof.mjs",
        "tests/desen-app-last-known-good-recovery.test.mjs",
      ],
      graphReaderCheckpointOwnedPath: "scripts/lib/desen-app-published-host-update-proof.mjs",
      artifactTrackedEntrypoints: ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "The executed sockets-free matrix reopens public SQLite activation services in a new bounded child; service reopen is not the independent browser's full product-process restart.",
      "Corrupt transport candidates are explicit fault fixtures admitted through the public store's trusted-caller precondition, not claimed successful Publisher output.",
      "Chromium declaration and file receipts do not execute the browser, establish a cold PID change, or audit trace secrets. The independent hosted browser workload supplies that separate execution evidence.",
      "Fresh emission comparison authenticates the current six public compiled roots, not TypeScript typechecking. The separate required typecheck remains mandatory.",
      "Every current App and independent host graph is freshly observed without historical projection; completed parent artifacts remain byte-identical.",
      "No automatic rollback, remote deployment, production credential assurance, multi-user durability, power-loss recovery, M10-T08, M10-T09, or G10 closure is claimed.",
      "Local evidence does not authorize hosted completion until the exact current head passes the independent required checks.",
    ],
  });
  await readT08Successor(workspaceRoot);
  for (const name of T08_CHANGED_TRACKED_PATHS) {
    const bytes = await readRegularAuthority(path.join(workspaceRoot, name), name);
    assertSuccessorReceipt(
      { path: name, bytes: bytes.byteLength, sha256: sha256(bytes) },
      successor.boundary.trackedReceipts,
    );
  }
  const { artifact, liveSuccessorAuthority } = await projectT08Successor(
    workspaceRoot,
    currentArtifact,
    successor,
  );
  const artifactBytes = Buffer.from(
    await format(JSON.stringify(artifact), { parser: "json", printWidth: 100, endOfLine: "lf" }),
  );
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    liveSuccessorAuthority,
  });
}

function authenticateArtifact(bytes) {
  const pin = DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PIN;
  if (pin.bytes <= 0 || bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("ARTIFACT_DRIFT", "The immutable committed T07 evidence bytes drifted.");
  }
  const artifact = parseJson(bytes, ARTIFACT_PATH, "ARTIFACT_DRIFT");
  if (
    artifact.task !== "M10-T07" ||
    artifact.result !== "PASS" ||
    artifact.proofId !== "desen-app-last-known-good-recovery"
  ) {
    fail("ARTIFACT_DRIFT", "The immutable T07 evidence identity drifted.");
  }
  return artifact;
}

function verifyReport(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, REPORT_PATH);
  const header = [
    "# Desen App last-known-good recovery",
    "",
    "Task: M10-T07",
    "",
    "Status: DONE",
    "",
    `M10-T05 parent: \`sha256:${DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS[0].sha256}\``,
    "",
    `M10-T06 parent: \`sha256:${DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS[1].sha256}\``,
    "",
    `M07-T08 parent: \`sha256:${DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS[2].sha256}\``,
    "",
    `M07-T11 parent: \`sha256:${DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_PARENT_PINS[3].sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(header) ||
    source.split("Final artifact:").length !== 2 ||
    source.split("Status: DONE").length !== 2 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The T07 proof report lost its exact bounded authority header.");
  }
}

/** Compares the pinned T07 artifact with fresh source, public APIs, and current App/host graphs. */
export async function verifyDesenAppLastKnownGoodRecoveryEvidence(rawOptions = undefined) {
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
    options.artifactPath ?? DEFAULT_DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PATH,
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
    verifyReport(suppliedReport, DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PIN.sha256);
  else
    verifyReport(
      await readRegularAuthority(reportPath, REPORT_PATH),
      DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PIN.sha256,
    );
  const built = await buildDesenAppLastKnownGoodRecoveryEvidence(buildOptions);
  const artifactBytes =
    suppliedArtifact ?? (await readRegularAuthority(artifactPath, ARTIFACT_PATH));
  const artifact = authenticateArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes))
    fail(
      "ARTIFACT_DRIFT",
      "The pinned T07 artifact no longer reproduces from current authorities.",
    );
  verifyReport(
    suppliedReport ?? (await readRegularAuthority(reportPath, REPORT_PATH)),
    built.artifactSha256,
  );
  return deepFreeze({
    task: "M10-T07",
    result: "PASS",
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    invalidCases: 2,
    serviceReopens: 2,
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
    fail("ARTIFACT_WRITE_UNSAFE", "The T07 artifact destination is not one regular-file location.");
  }
}

/** Atomically creates T07 evidence; never replaces different bytes at its frozen tracked path. */
export async function writeDesenAppLastKnownGoodRecoveryEvidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  const artifactPath = capturePath(
    options.artifactPath ?? DEFAULT_DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PATH,
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
  const built = await buildDesenAppLastKnownGoodRecoveryEvidence(buildOptions);
  const { destination, exists } = await canonicalDestination(artifactPath);
  const frozen = await canonicalDestination(
    DEFAULT_DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ARTIFACT_PATH,
  );
  if (destination === frozen.destination && exists) {
    const existing = await readRegularAuthority(destination, ARTIFACT_PATH);
    if (!existing.equals(built.artifactBytes))
      fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked T07 artifact.");
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "The atomic T07 artifact write failed.");
  }
  return deepFreeze({
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: DESEN_APP_LAST_KNOWN_GOOD_RECOVERY_ROOT_TEST_NAMES.length,
  });
}
