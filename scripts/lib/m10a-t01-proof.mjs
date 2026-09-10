import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, readFile, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { createCatalogManifest } from "../../packages/catalog-sdk/dist/index.js";
import {
  WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  createWebReactPackageDigest,
  verifyWebReactPackageDigest,
} from "../../packages/reference-catalog-web/dist/index.js";
import { STARTER_CATALOG_TEMPLATE } from "../../packages/starter-catalog-web/dist/index.js";
import {
  validateDesenCatalog,
  validateDesenCatalogSemantics,
  validateDesenExecutionCatalogSet,
} from "../../packages/validator/dist/index.js";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const STARTER_PACKAGE_PATH = "packages/starter-catalog-web/package.json";
const STARTER_CATALOG_PATH = "packages/starter-catalog-web/catalog.json";
const STARTER_CSS_PATH = "packages/starter-catalog-web/src/neutral.module.css";
const STARTER_DIST_PATH = "packages/starter-catalog-web/dist";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const BASE_UI_LINK_PATH = "packages/starter-catalog-web/node_modules/@base-ui/react";
const BASE_UI_MANIFEST_NAME = "package.json";
const BASE_UI_LICENSE_NAME = "LICENSE";
const BASE_UI_MANIFEST_OVERRIDE_PATH = "metadata/installed-base-ui/package.json";
const BASE_UI_LICENSE_OVERRIDE_PATH = "metadata/installed-base-ui/LICENSE";
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t01.json";
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TREE_FILES = 8_192;
const MAX_TREE_BYTES = 64 * 1024 * 1024;
const BROWSER_TIMEOUT_MS = 120_000;
const BROWSER_TERMINATION_GRACE_MS = 2_000;
const BROWSER_OUTPUT_LIMIT_BYTES = 256 * 1_024;
const BROWSER_ENVIRONMENT_MAX_FIELDS = 4_096;
const BROWSER_ENVIRONMENT_MAX_KEY_BYTES = 1_024;
const BROWSER_ENVIRONMENT_MAX_VALUE_BYTES = 65_536;
const BROWSER_ENVIRONMENT_MAX_TOTAL_BYTES = 262_144;
const LIFECYCLE_PROBE_PORT = 4_187;
const LIFECYCLE_PROBE_TIMEOUT_MS = 5_000;
const LIFECYCLE_PROBE_TERMINATION_GRACE_MS = 250;
const LIFECYCLE_PROBE_READY = "M10A_T01_LIFECYCLE_READY\n";
const LIFECYCLE_PROBE_DESCENDANT_CODE = [
  'const { createServer } = require("node:net");',
  'process.on("SIGTERM", () => undefined);',
  "const server = createServer();",
  'server.once("error", (error) => { process.stderr.write(`${error.code ?? "ERROR"}\\n`); process.exit(1); });',
  `server.listen(${LIFECYCLE_PROBE_PORT}, "127.0.0.1", () => process.stdout.write("DESCENDANT_READY\\n"));`,
].join("");
const LIFECYCLE_PROBE_PARENT_CODE = [
  'const { spawn } = require("node:child_process");',
  'const code = Buffer.from(process.argv[1], "base64").toString("utf8");',
  'const child = spawn(process.execPath, ["-e", code], { detached: false, env: {}, stdio: ["ignore", "pipe", "inherit"] });',
  "let ready = false;",
  'child.stdout.on("data", (chunk) => { if (!ready && chunk.toString("utf8").includes("DESCENDANT_READY\\n")) { ready = true; process.stdout.write("M10A_T01_LIFECYCLE_READY\\n"); } });',
  'child.once("error", (error) => { process.stderr.write(`${error.code ?? "ERROR"}\\n`); process.exit(1); });',
  'child.once("exit", () => { if (!ready) process.exit(1); });',
  "setInterval(() => undefined, 1_000);",
].join("");
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact task-owned browser command executed by the M10A-T01 verifier. */
export const M10A_T01_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:e2e:built"]),
});

/** Full local capture command, which rebuilds both graphs after the Catalog is written. */
export const M10A_T01_BROWSER_CAPTURE_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:e2e"]),
});

/** Exact deterministic Catalog fixture written for both T01 browser graphs. */
export const M10A_T01_CATALOG_PATH = path.join(WORKSPACE_ROOT, STARTER_CATALOG_PATH);

/** Exact deterministic machine-evidence destination for M10A-T01. */
export const M10A_T01_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Stable root mutation-test declarations embedded in the evidence artifact. */
export const M10A_T01_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T01 constructs one valid self-digested starter Catalog",
  "M10A-T01 binds exact Base UI integrity license peers and dependency closure",
  "M10A-T01 binds every emitted starter package byte deterministically",
  "M10A-T01 rejects manifest lock license and emitted-byte drift",
  "M10A-T01 rejects missing failed or widened browser observations",
  "M10A-T01 rejects unsafe options and output destinations",
  "M10A-T01 authenticates its checkpointed artifact without duplicating Chromium",
]);

const EXPECTED_BROWSER_TEST_TITLES = Object.freeze([
  "keeps Select and Dialog interactions inside the approved boundary",
  "preserves protocol identity with session isolation, survives StrictMode remount, and isolates the host graph",
  "publishes three Source surfaces and rejects undeclared capability data",
]);
const EXPECTED_BROWSER_ASSERTIONS = Object.freeze([
  "atomicRequiredSlotInsertion",
  "compatibleLiveRerenderIdentity",
  "compatiblePublicationIdentity",
  "disabledAndLoadingButton",
  "escapeFocusReturn",
  "focusTrap",
  "independentHostGraph",
  "keyboardSelect",
  "nestedPortalContainment",
  "portalContainment",
  "publisherDerivedAuthoring",
  "sameStaticAdapterRegistry",
  "strictModeUnmountRemount",
  "unknownCapabilityRejected",
  "unknownStylePartRejected",
  "wrongEventPayloadRejected",
]);

const EXPECTED_STARTER_PRODUCTION_DEPENDENCIES = Object.freeze({
  "@base-ui/react": "1.8.0",
  "@desen/catalog-sdk": "workspace:*",
  "@desen/protocol": "workspace:*",
  "@desen/runtime-react": "workspace:*",
});
const EXPECTED_STARTER_PEERS = Object.freeze({
  react: ">=19.0.0 <20.0.0",
  "react-dom": ">=19.0.0 <20.0.0",
});
const EXPECTED_BASE_UI_DEPENDENCIES = Object.freeze({
  "@babel/runtime": "^7.29.7",
  "@base-ui/utils": "0.4.0",
  "@floating-ui/react-dom": "^2.1.9",
  "@floating-ui/utils": "^0.2.12",
  "use-sync-external-store": "^1.6.0",
});
const EXPECTED_BASE_UI_PEERS = Object.freeze({
  "@date-fns/tz": "^1.2.0",
  "@types/react": "^17 || ^18 || ^19",
  "date-fns": "^4.0.0",
  react: "^17 || ^18 || ^19",
  "react-dom": "^17 || ^18 || ^19",
});
const EXPECTED_BASE_UI_LICENSE = Object.freeze({
  expression: "MIT",
  bytes: 1_072,
  sha256: "07fc1b39d69d14bc7d40482a628f47226258eb01265db68ae684944b916beb2a",
});

const LOCK_NODES = Object.freeze([
  Object.freeze({
    key: "@base-ui/react@1.8.0",
    integrity:
      "sha512-P0/1sxo6SBVZOklKMIedvTWqw2s2IQzi9x5bIVsXu980cuSOD4NeuRSs+/L7LZQfDkZP/uRZyGPyfFl/B1oH+Q==",
  }),
  Object.freeze({
    key: "@babel/runtime@7.29.7",
    integrity:
      "sha512-Nq8OhGWiZIZGV6hLHoyAKLLcJihP/xFeBMGJoUrxTX2psI8dCifzLhZISFb+VWS3wFMRDmCGw5R+dOySCqPLhw==",
  }),
  Object.freeze({
    key: "@base-ui/utils@0.4.0",
    integrity:
      "sha512-bO9fz25kKtPf+aZVyfQrC0PDmJdmVni31W2hCS5/Owb+inwdIL3XU26pCPRPlt4LSxZrBgLwubXQXQlKaFEZzw==",
  }),
  Object.freeze({
    key: "@floating-ui/core@1.8.0",
    integrity:
      "sha512-0CIZ5itps/8x7BG8dEIhs53BvCUH2PCoogtakwRTut+Arm58sJooJ0AuZhLw2HJYIR5cMLNPBSS728sPho2khQ==",
  }),
  Object.freeze({
    key: "@floating-ui/dom@1.8.0",
    integrity:
      "sha512-yXSrzeHZBTZadLOlfyhCkJHNeLJnHRnRInwdZ40L7ZiaAtrBwoYlsDrX3v5zB1Utk7CLfzcOVnVVWoXEky7Ceg==",
  }),
  Object.freeze({
    key: "@floating-ui/react-dom@2.1.9",
    integrity:
      "sha512-JDjEFGCpImxDCA7JJKviA0M9+RtmJdj0m/NVU5IMgBK+AmZouAQQ7/+2GLH0GXXY0YMw9oXPB8hKdbPYg5QLYg==",
  }),
  Object.freeze({
    key: "@floating-ui/utils@0.2.12",
    integrity:
      "sha512-HpCo8tmWzLVad5s2d19EhAz5zqrrQ6s69qd6moPMQvkOuSwDT1YgRfWSVuc4ennqrgv3OHppiOGMQ7oC13yIww==",
  }),
  Object.freeze({
    key: "reselect@5.3.0",
    integrity:
      "sha512-XGoLeRAVzUTcJ1qkxPQhDJyIZ5d6zzZD9nT7AEZOaaU9UbWclhycElmhO+VD5bFeLuzhPBaOV2oXC8uG35ZSpg==",
  }),
  Object.freeze({
    key: "use-sync-external-store@1.6.0",
    integrity:
      "sha512-Pp6GSwGP/NrPIrxVFAIkOQeyw8lFenOHijQWkUTrDvrF4ALqylP2C/KCkeS9dpUM3KvYRQhna5vt7IL95+ZQ9w==",
  }),
]);

const EXPECTED_BASE_UI_SNAPSHOT_KEY =
  "@base-ui/react@1.8.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)";
const EXPECTED_BASE_UI_SNAPSHOT_DEPENDENCIES = Object.freeze({
  "@babel/runtime": "7.29.7",
  "@base-ui/utils": "0.4.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
  "@floating-ui/react-dom": "2.1.9(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
  "@floating-ui/utils": "0.2.12",
  react: "19.2.8",
  "react-dom": "19.2.8(react@19.2.8)",
  "use-sync-external-store": "1.6.0(react@19.2.8)",
});
const EXPECTED_BASE_UI_SNAPSHOT_CLOSURE = Object.freeze([
  Object.freeze({
    key: EXPECTED_BASE_UI_SNAPSHOT_KEY,
    dependencies: EXPECTED_BASE_UI_SNAPSHOT_DEPENDENCIES,
    optionalDependencies: Object.freeze({ "@types/react": "19.2.17" }),
  }),
  Object.freeze({
    key: "@babel/runtime@7.29.7",
    dependencies: Object.freeze({}),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "@base-ui/utils@0.4.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
    dependencies: Object.freeze({
      "@babel/runtime": "7.29.7",
      "@floating-ui/utils": "0.2.12",
      react: "19.2.8",
      "react-dom": "19.2.8(react@19.2.8)",
      reselect: "5.3.0",
      "use-sync-external-store": "1.6.0(react@19.2.8)",
    }),
    optionalDependencies: Object.freeze({ "@types/react": "19.2.17" }),
  }),
  Object.freeze({
    key: "@floating-ui/core@1.8.0",
    dependencies: Object.freeze({ "@floating-ui/utils": "0.2.12" }),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "@floating-ui/dom@1.8.0",
    dependencies: Object.freeze({
      "@floating-ui/core": "1.8.0",
      "@floating-ui/utils": "0.2.12",
    }),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "@floating-ui/react-dom@2.1.9(react-dom@19.2.8(react@19.2.8))(react@19.2.8)",
    dependencies: Object.freeze({
      "@floating-ui/dom": "1.8.0",
      react: "19.2.8",
      "react-dom": "19.2.8(react@19.2.8)",
    }),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "@floating-ui/utils@0.2.12",
    dependencies: Object.freeze({}),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "reselect@5.3.0",
    dependencies: Object.freeze({}),
    optionalDependencies: Object.freeze({}),
  }),
  Object.freeze({
    key: "use-sync-external-store@1.6.0(react@19.2.8)",
    dependencies: Object.freeze({ react: "19.2.8" }),
    optionalDependencies: Object.freeze({}),
  }),
]);

/** Stable redacted failure raised by the M10A-T01 proof boundary. */
export class M10AT01ProofError extends Error {
  /** Creates one code-bearing error with an optional bounded, path-redacted browser diagnostic. */
  constructor(code, message, diagnostic = undefined) {
    super(message);
    this.name = "M10AT01ProofError";
    this.code = `M10A_T01_${code}`;
    if (diagnostic !== undefined) this.diagnostic = diagnostic;
  }
}

function fail(code, message, diagnostic = undefined) {
  throw new M10AT01ProofError(code, message, diagnostic);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function prettyBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function deepFreeze(value) {
  if (
    value !== null &&
    typeof value === "object" &&
    !ArrayBuffer.isView(value) &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail("OPTIONS_INVALID", `${label} fields drifted.`);
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${key} must be inert own data.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return {};
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain record.`);
  }
  const captured = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(value, key) : undefined;
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} contains an unknown or executable field.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function assertExactStringMap(actual, expected, label) {
  if (
    actual === null ||
    typeof actual !== "object" ||
    Array.isArray(actual) ||
    Object.getPrototypeOf(actual) !== Object.prototype
  ) {
    fail("DEPENDENCY_ADMISSION_INVALID", `${label} is not one plain dependency map.`);
  }
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (
    actualEntries.length !== expectedEntries.length ||
    actualEntries.some(
      ([name, version], index) =>
        name !== expectedEntries[index][0] || version !== expectedEntries[index][1],
    )
  ) {
    fail("DEPENDENCY_ADMISSION_INVALID", `${label} drifted from the reviewed dependency map.`);
  }
}

async function canonicalWorkspaceRoot(rawRoot = WORKSPACE_ROOT) {
  if (
    typeof rawRoot !== "string" ||
    rawRoot.length === 0 ||
    rawRoot.length > 4_096 ||
    !path.isAbsolute(rawRoot) ||
    path.resolve(rawRoot) !== rawRoot ||
    rawRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  const entry = await lstat(rawRoot).catch(() => undefined);
  if (!entry?.isDirectory() || entry.isSymbolicLink() || (await realpath(rawRoot)) !== rawRoot) {
    fail("AUTHORITY_UNSAFE", "The workspace root is not one canonical directory.");
  }
  return rawRoot;
}

function captureOverrides(rawOverrides) {
  if (rawOverrides === undefined) return new Map();
  if (!(rawOverrides instanceof Map) || utilTypes.isProxy(rawOverrides)) {
    fail("OPTIONS_INVALID", "fileOverrides must be one non-Proxy Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of rawOverrides) {
    const allowedPath =
      typeof relativePath === "string" &&
      ([
        STARTER_PACKAGE_PATH,
        STARTER_CATALOG_PATH,
        STARTER_CSS_PATH,
        LOCKFILE_PATH,
        ARTIFACT_RELATIVE_PATH,
        BASE_UI_MANIFEST_OVERRIDE_PATH,
        BASE_UI_LICENSE_OVERRIDE_PATH,
      ].includes(relativePath) ||
        relativePath.startsWith(`${STARTER_DIST_PATH}/`));
    if (!allowedPath || !Buffer.isBuffer(bytes)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unreviewed path or byte value.");
    }
    captured.set(relativePath, Buffer.from(bytes));
  }
  return captured;
}

async function readStableRegularFile(filePath, label, maximumBytes = MAX_FILE_BYTES) {
  let handle;
  try {
    const before = await lstat(filePath, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size < 1n ||
      before.size > BigInt(maximumBytes) ||
      (await realpath(filePath)) !== filePath
    ) {
      throw new Error("unsafe authority");
    }
    handle = await open(filePath, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      throw new Error("identity changed");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      bytes.byteLength !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      throw new Error("authority changed");
    }
    return bytes;
  } catch {
    fail("AUTHORITY_UNSAFE", `${label} is unavailable or unsafe.`);
  } finally {
    await handle?.close();
  }
}

async function readWorkspaceFile(workspaceRoot, relativePath, overrides, label = relativePath) {
  const override = overrides.get(relativePath);
  return override ?? readStableRegularFile(path.join(workspaceRoot, relativePath), label);
}

async function listStableTree(root, relativeRoot, overrides) {
  const files = [];
  let totalBytes = 0;
  async function visit(directory, relativeDirectory) {
    const directoryEntry = await lstat(directory);
    if (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink()) {
      fail("AUTHORITY_UNSAFE", "Starter dist contains a non-directory traversal root.");
    }
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (!/^[a-z0-9][a-z0-9._-]*$/u.test(entry.name)) {
        fail("PACKAGE_INVENTORY_INVALID", "Starter dist contains an unsafe artifact name.");
      }
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile() && !entry.isSymbolicLink()) {
        const bytes = await readWorkspaceFile(root, relativePath, overrides);
        totalBytes += bytes.byteLength;
        if (files.length >= MAX_TREE_FILES || totalBytes > MAX_TREE_BYTES) {
          fail("PACKAGE_INVENTORY_INVALID", "Starter dist exceeds its reviewed proof budget.");
        }
        files.push(Object.freeze({ path: relativePath, bytes: Buffer.from(bytes) }));
      } else {
        fail("AUTHORITY_UNSAFE", "Starter dist contains a symbolic or special entry.");
      }
    }
  }
  await visit(path.join(root, relativeRoot), relativeRoot);
  if (files.length === 0) fail("PACKAGE_INVENTORY_INVALID", "Starter dist is empty.");
  return Object.freeze(files);
}

function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("AUTHORITY_INVALID", `${label} is not valid UTF-8 JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("AUTHORITY_INVALID", `${label} must be one JSON object.`);
  }
  return value;
}

function validateStarterManifest(manifest) {
  if (
    manifest.name !== "@desen/starter-catalog-web" ||
    manifest.version !== "0.0.0" ||
    manifest.private !== true ||
    manifest.license !== "Apache-2.0" ||
    manifest.type !== "module" ||
    JSON.stringify(manifest.files) !==
      JSON.stringify(["catalog.json", "dist", "src/neutral.module.css"]) ||
    manifest.exports?.["./catalog.json"] !== "./catalog.json" ||
    manifest.exports?.["."]?.types !== "./dist/index.d.ts" ||
    manifest.exports?.["."]?.import !== "./dist/index.js" ||
    manifest.exports?.["./react-adapters"]?.types !== "./dist/react-adapters.d.ts" ||
    manifest.exports?.["./react-adapters"]?.import !== "./dist/react-adapters.js"
  ) {
    fail("PACKAGE_MANIFEST_INVALID", "Starter package publication identity drifted.");
  }
  assertExactStringMap(
    manifest.dependencies,
    EXPECTED_STARTER_PRODUCTION_DEPENDENCIES,
    "Starter production dependencies",
  );
  assertExactStringMap(manifest.peerDependencies, EXPECTED_STARTER_PEERS, "Starter React peers");
}

function sectionText(lockText, name) {
  const startMarker = `${name}:\n`;
  const start = lockText.indexOf(startMarker);
  if (start < 0 || lockText.indexOf(startMarker, start + startMarker.length) >= 0) {
    fail("LOCKFILE_INVALID", `Lockfile ${name} section is missing or duplicated.`);
  }
  const next = /\n[a-z][a-zA-Z-]*:\n/gu;
  next.lastIndex = start + startMarker.length;
  const match = next.exec(lockText);
  return lockText.slice(start + startMarker.length, match?.index ?? lockText.length);
}

function entryText(section, key) {
  const quotedHeader = `  '${key}':`;
  const plainHeader = `  ${key}:`;
  const lines = section.split("\n");
  const indexes = lines.flatMap((line, index) =>
    line === quotedHeader || line === plainHeader ? [index] : [],
  );
  if (indexes.length !== 1) fail("LOCKFILE_INVALID", `Lockfile entry ${key} drifted.`);
  const start = indexes[0];
  let end = start + 1;
  while (end < lines.length && !/^[ ]{2}\S.*:$/u.test(lines[end])) end += 1;
  return lines.slice(start, end).join("\n");
}

function snapshotEntryText(section, key) {
  const quotedHeader = `  '${key}':`;
  const plainHeader = `  ${key}:`;
  const lines = section.split("\n");
  const indexes = lines.flatMap((line, index) =>
    line === quotedHeader ||
    line === `${quotedHeader} {}` ||
    line === plainHeader ||
    line === `${plainHeader} {}`
      ? [index]
      : [],
  );
  if (indexes.length !== 1) fail("LOCKFILE_INVALID", `Lockfile snapshot ${key} drifted.`);
  const start = indexes[0];
  let end = start + 1;
  while (end < lines.length && !/^[ ]{2}\S.*:.*$/u.test(lines[end])) end += 1;
  while (end > start + 1 && lines[end - 1] === "") end -= 1;
  return lines.slice(start, end);
}

function snapshotRelations(section, expected) {
  const lines = snapshotEntryText(section, expected.key);
  const header = lines[0];
  const expectedEmpty =
    Object.keys(expected.dependencies).length === 0 &&
    Object.keys(expected.optionalDependencies).length === 0;
  if (header.endsWith(" {}")) {
    if (!expectedEmpty || lines.length !== 1) {
      fail("LOCKFILE_INVALID", `Lockfile snapshot ${expected.key} relationship map drifted.`);
    }
    return deepFreeze({
      key: expected.key,
      dependencies: {},
      optionalDependencies: {},
    });
  }

  const relations = { dependencies: {}, optionalDependencies: {} };
  const seenMaps = new Set();
  let activeMap;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = /^[ ]{4}(dependencies|optionalDependencies):$/u.exec(line)?.[1];
    if (heading !== undefined) {
      if (seenMaps.has(heading)) {
        fail("LOCKFILE_INVALID", `Lockfile snapshot ${expected.key} duplicated ${heading}.`);
      }
      seenMaps.add(heading);
      activeMap = heading;
      continue;
    }
    const relationship = /^[ ]{6}(?:'([^']+)'|([^':][^:]*)): (\S+)$/u.exec(line);
    const name = relationship?.[1] ?? relationship?.[2];
    const version = relationship?.[3];
    if (activeMap === undefined || name === undefined || version === undefined) {
      fail("LOCKFILE_INVALID", `Lockfile snapshot ${expected.key} contains an unknown field.`);
    }
    if (Object.hasOwn(relations[activeMap], name)) {
      fail("LOCKFILE_INVALID", `Lockfile snapshot ${expected.key} duplicated ${name}.`);
    }
    relations[activeMap][name] = version;
  }

  for (const mapName of ["dependencies", "optionalDependencies"]) {
    const expectedPresent = Object.keys(expected[mapName]).length > 0;
    if (seenMaps.has(mapName) !== expectedPresent) {
      fail("LOCKFILE_INVALID", `Lockfile snapshot ${expected.key} ${mapName} presence drifted.`);
    }
  }

  assertExactStringMap(
    relations.dependencies,
    expected.dependencies,
    `Lockfile snapshot ${expected.key} dependencies`,
  );
  assertExactStringMap(
    relations.optionalDependencies,
    expected.optionalDependencies,
    `Lockfile snapshot ${expected.key} optional dependencies`,
  );
  return deepFreeze({ key: expected.key, ...relations });
}

function validateLockfile(lockBytes) {
  const lockText = new TextDecoder("utf-8", { fatal: true }).decode(lockBytes);
  const packages = sectionText(lockText, "packages");
  const snapshots = sectionText(lockText, "snapshots");
  const importers = sectionText(lockText, "importers");
  const importer = entryText(importers, "packages/starter-catalog-web");
  if (
    !/\n[ ]{6}'@base-ui\/react':\n[ ]{8}specifier: 1\.8\.0\n[ ]{8}version: 1\.8\.0\(@types\/react@19\.2\.17\)\(react-dom@19\.2\.8\(react@19\.2\.8\)\)\(react@19\.2\.8\)/u.test(
      importer,
    )
  ) {
    fail("LOCKFILE_INVALID", "Starter importer does not resolve the reviewed Base UI tuple.");
  }

  const nodes = LOCK_NODES.map(({ key, integrity }) => {
    const entry = entryText(packages, key);
    const matches = [...entry.matchAll(/resolution: \{integrity: ([^}]+)\}/gu)];
    if (matches.length !== 1 || matches[0][1] !== integrity) {
      fail("LOCKFILE_INVALID", `Lockfile integrity drifted for ${key}.`);
    }
    return Object.freeze({ key, integrity });
  });

  const snapshotClosure = EXPECTED_BASE_UI_SNAPSHOT_CLOSURE.map((expected) =>
    snapshotRelations(snapshots, expected),
  );
  if (snapshotClosure.length !== LOCK_NODES.length) {
    fail("LOCKFILE_INVALID", "Base UI snapshot closure inventory drifted.");
  }

  return deepFreeze({
    lockfileVersion: /^lockfileVersion: '([^']+)'$/mu.exec(lockText)?.[1],
    importer: {
      specifier: "1.8.0",
      resolution: EXPECTED_BASE_UI_SNAPSHOT_KEY.slice("@base-ui/react@".length),
    },
    nodes,
    transitiveNodeCount: nodes.length - 1,
    baseUiSnapshotDependencies: EXPECTED_BASE_UI_SNAPSHOT_DEPENDENCIES,
    snapshotClosure,
  });
}

async function readBaseUiAdmission(workspaceRoot, overrides) {
  const linkPath = path.join(workspaceRoot, BASE_UI_LINK_PATH);
  const entry = await lstat(linkPath).catch(() => undefined);
  if (!entry?.isSymbolicLink()) {
    fail("DEPENDENCY_ADMISSION_INVALID", "Base UI must resolve through the reviewed pnpm link.");
  }
  const packageRoot = await realpath(linkPath);
  const storePrefix = path.join(workspaceRoot, "node_modules/.pnpm/");
  if (
    !packageRoot.startsWith(storePrefix) ||
    !packageRoot.endsWith("/node_modules/@base-ui/react")
  ) {
    fail("DEPENDENCY_ADMISSION_INVALID", "Base UI resolved outside the workspace pnpm store.");
  }
  const [manifestBytes, licenseBytes] = await Promise.all([
    overrides.get(BASE_UI_MANIFEST_OVERRIDE_PATH) ??
      readStableRegularFile(
        path.join(packageRoot, BASE_UI_MANIFEST_NAME),
        "Base UI manifest",
        128_000,
      ),
    overrides.get(BASE_UI_LICENSE_OVERRIDE_PATH) ??
      readStableRegularFile(
        path.join(packageRoot, BASE_UI_LICENSE_NAME),
        "Base UI license",
        16_384,
      ),
  ]);
  const manifest = parseJson(manifestBytes, "Base UI manifest");
  if (
    manifest.name !== "@base-ui/react" ||
    manifest.version !== "1.8.0" ||
    manifest.license !== EXPECTED_BASE_UI_LICENSE.expression
  ) {
    fail("DEPENDENCY_ADMISSION_INVALID", "Installed Base UI identity drifted.");
  }
  assertExactStringMap(
    manifest.dependencies,
    EXPECTED_BASE_UI_DEPENDENCIES,
    "Installed Base UI dependencies",
  );
  assertExactStringMap(
    manifest.peerDependencies,
    EXPECTED_BASE_UI_PEERS,
    "Installed Base UI peers",
  );
  if (
    licenseBytes.byteLength !== EXPECTED_BASE_UI_LICENSE.bytes ||
    sha256(licenseBytes) !== EXPECTED_BASE_UI_LICENSE.sha256
  ) {
    fail("DEPENDENCY_ADMISSION_INVALID", "Installed Base UI MIT license bytes drifted.");
  }
  return deepFreeze({ manifest, manifestBytes, licenseBytes });
}

function assertCatalogValid(catalog) {
  for (const [label, result] of [
    ["structural", validateDesenCatalog(catalog)],
    ["semantic", validateDesenCatalogSemantics(catalog)],
    ["execution", validateDesenExecutionCatalogSet([catalog])],
  ]) {
    if (result.valid !== true) {
      fail("CATALOG_INVALID", `The generated starter Catalog failed ${label} validation.`);
    }
  }
}

function packageArtifacts({
  distFiles,
  manifestBytes,
  cssBytes,
  lockAdmission,
  dependencyManifestBytes,
  licenseBytes,
}) {
  const artifacts = [
    ...distFiles.map(({ path: artifactPath, bytes }) => ({ path: artifactPath, bytes })),
    { path: "package.json", bytes: manifestBytes },
    { path: "src/neutral.module.css", bytes: cssBytes },
    {
      path: "metadata/base-ui-lock-admission.json",
      bytes: canonicalBytes(lockAdmission),
    },
    { path: "third-party/base-ui-react-package.json", bytes: dependencyManifestBytes },
    { path: "third-party/base-ui-react-license.txt", bytes: licenseBytes },
  ];
  return Object.freeze(
    artifacts.map(({ path: artifactPath, bytes }) =>
      Object.freeze({ path: artifactPath, bytes: Buffer.from(bytes) }),
    ),
  );
}

/**
 * Builds the exact M10A-T01 Catalog and package identity from current compiled public outputs.
 *
 * @remarks This function performs no write and launches no browser. It admits the exact package,
 * lock, installed Base UI manifest/license, compiled dist, and published CSS before constructing
 * the self-digested Catalog used by both browser graphs.
 */
export async function buildM10AT01PackageIdentity(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["fileOverrides", "workspaceRoot"],
    "Package identity options",
  );
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const overrides = captureOverrides(options.fileOverrides);
  const [manifestBytes, lockBytes, cssBytes, distFiles, baseUi] = await Promise.all([
    readWorkspaceFile(workspaceRoot, STARTER_PACKAGE_PATH, overrides),
    readWorkspaceFile(workspaceRoot, LOCKFILE_PATH, overrides),
    readWorkspaceFile(workspaceRoot, STARTER_CSS_PATH, overrides),
    listStableTree(workspaceRoot, STARTER_DIST_PATH, overrides),
    readBaseUiAdmission(workspaceRoot, overrides),
  ]);
  const manifest = parseJson(manifestBytes, "Starter package manifest");
  validateStarterManifest(manifest);
  const lockAdmission = validateLockfile(lockBytes);
  const artifacts = packageArtifacts({
    distFiles,
    manifestBytes,
    cssBytes,
    lockAdmission,
    dependencyManifestBytes: baseUi.manifestBytes,
    licenseBytes: baseUi.licenseBytes,
  });
  const placeholderCatalog = createCatalogManifest({
    ...STARTER_CATALOG_TEMPLATE,
    packageDigest: WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  });
  assertCatalogValid(placeholderCatalog);
  const identity = createWebReactPackageDigest({ catalog: placeholderCatalog, artifacts });
  const catalog = createCatalogManifest({
    ...STARTER_CATALOG_TEMPLATE,
    packageDigest: identity.packageDigest,
  });
  assertCatalogValid(catalog);
  const verifiedIdentity = verifyWebReactPackageDigest({ catalog, artifacts });
  if (verifiedIdentity.packageDigest !== identity.packageDigest) {
    fail("PACKAGE_IDENTITY_INVALID", "Starter package digest did not verify against its Catalog.");
  }
  const catalogBytes = prettyBytes(catalog);
  return deepFreeze({
    catalog,
    catalogBytes,
    packageIdentity: verifiedIdentity,
    admission: {
      baseUi: {
        version: baseUi.manifest.version,
        integrity: LOCK_NODES[0].integrity,
        license: EXPECTED_BASE_UI_LICENSE.expression,
        licenseBytes: baseUi.licenseBytes.byteLength,
        licenseSha256: sha256(baseUi.licenseBytes),
        peerDependencies: EXPECTED_BASE_UI_PEERS,
        directDependencies: EXPECTED_BASE_UI_DEPENDENCIES,
      },
      lock: lockAdmission,
    },
    inventory: {
      distFiles: distFiles.length,
      distBytes: distFiles.reduce((total, file) => total + file.bytes.byteLength, 0),
      digestEntries: verifiedIdentity.entries.length,
      entries: verifiedIdentity.entries,
    },
  });
}

/** Writes only the new exact starter Catalog fixture through the repository's atomic writer. */
export async function writeM10AT01Catalog(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["catalogPath", "fileOverrides", "workspaceRoot"],
    "Catalog writer options",
  );
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const catalogPath = options.catalogPath ?? path.join(workspaceRoot, STARTER_CATALOG_PATH);
  if (catalogPath !== path.join(workspaceRoot, STARTER_CATALOG_PATH)) {
    fail("OPTIONS_INVALID", "Catalog output must remain at its exact task-owned path.");
  }
  const built = await buildM10AT01PackageIdentity({
    workspaceRoot,
    ...(options.fileOverrides === undefined ? {} : { fileOverrides: options.fileOverrides }),
  });
  await writeAtomicProofArtifact({ artifactPath: catalogPath, artifactBytes: built.catalogBytes });
  return deepFreeze({
    catalogPath,
    catalogBytes: built.catalogBytes.byteLength,
    catalogSha256: sha256(built.catalogBytes),
    packageDigest: built.packageIdentity.packageDigest,
  });
}

function captureBrowserObservation(rawObservation) {
  const observation = exactRecord(
    rawObservation,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Browser observation",
  );
  if (
    observation.profile !== "desen.m10a-t01.browser-proof.v1" ||
    observation.result !== "PASS" ||
    !Array.isArray(observation.tests) ||
    !Array.isArray(observation.graphReceipts) ||
    JSON.stringify(observation.graphReceipts) !== JSON.stringify(["authoring", "host"]) ||
    observation.assertions === null ||
    typeof observation.assertions !== "object" ||
    Array.isArray(observation.assertions)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser proof did not return its exact passing profile.");
  }
  const tests = observation.tests.map((candidate, index) => {
    const item = exactRecord(candidate, ["result", "title"], `Browser test ${index}`);
    if (item.result !== "PASS" || typeof item.title !== "string") {
      fail("BROWSER_OBSERVATION_INVALID", "Browser test inventory contains a failing case.");
    }
    return item;
  });
  const titles = tests.map(({ title }) => title).sort();
  if (
    titles.length !== EXPECTED_BROWSER_TEST_TITLES.length ||
    titles.some((title, index) => title !== EXPECTED_BROWSER_TEST_TITLES[index])
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser test inventory is missing or widened.");
  }
  const keys = Object.keys(observation.assertions).sort();
  if (
    keys.length !== EXPECTED_BROWSER_ASSERTIONS.length ||
    keys.some((key, index) => key !== EXPECTED_BROWSER_ASSERTIONS[index]) ||
    keys.some((key) => observation.assertions[key] !== true)
  ) {
    fail("BROWSER_OBSERVATION_INVALID", "Browser assertions are missing, widened, or failing.");
  }
  return deepFreeze(structuredClone(observation));
}

function runChild(command, args, options, control = undefined) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeoutMs = control?.timeoutMs ?? BROWSER_TIMEOUT_MS;
    const terminationGraceMs = control?.terminationGraceMs ?? BROWSER_TERMINATION_GRACE_MS;
    const outputLimitBytes = control?.outputLimitBytes ?? BROWSER_OUTPUT_LIMIT_BYTES;
    const trigger = control?.trigger;
    const ownsProcessGroup = process.platform !== "win32";
    const child = spawn(command, args, { ...options, detached: ownsProcessGroup });
    let settled = false;
    let timedOut = false;
    let outputExceeded = false;
    let parentSignal = null;
    let terminating = false;
    let outputBytes = 0;
    const stdout = [];
    const stderr = [];
    let closeResult;
    let triggerObserved = false;
    let unexpectedSurvivors = false;
    let escalationTimer;
    let terminalTimer;
    let releasePoll;
    const processGroupAlive = () => {
      if (!ownsProcessGroup || !Number.isSafeInteger(child.pid)) {
        return child.exitCode === null && child.signalCode === null;
      }
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch (error) {
        if (error?.code === "ESRCH") return false;
        if (error?.code === "EPERM") return true;
        throw error;
      }
    };
    const signal = (name) => {
      try {
        if (ownsProcessGroup && Number.isSafeInteger(child.pid)) process.kill(-child.pid, name);
        else child.kill(name);
      } catch (error) {
        if (error?.code !== "ESRCH") return error;
      }
      return undefined;
    };
    const result = (processGroupReleased) => ({
      code: closeResult?.code ?? null,
      signal:
        closeResult === undefined ? (processGroupReleased ? "SIGKILL" : null) : closeResult.signal,
      timedOut,
      outputExceeded,
      parentSignal,
      processGroupReleased,
      unexpectedSurvivors,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    });
    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    const terminate = () => {
      if (terminating) return;
      terminating = true;
      const terminationError = signal("SIGTERM");
      if (terminationError) {
        finish(() => rejectPromise(terminationError));
        return;
      }
      escalationTimer = setTimeout(() => {
        const escalationError = signal("SIGKILL");
        if (escalationError) {
          finish(() => rejectPromise(escalationError));
          return;
        }
        releasePoll = setInterval(() => {
          try {
            if (!processGroupAlive()) finish(() => resolvePromise(result(true)));
          } catch (error) {
            finish(() => rejectPromise(error));
          }
        }, 20);
      }, terminationGraceMs);
      terminalTimer = setTimeout(() => {
        const finalError = signal("SIGKILL");
        if (finalError) {
          finish(() => rejectPromise(finalError));
          return;
        }
        try {
          const processGroupReleased = !processGroupAlive();
          finish(() => resolvePromise(result(processGroupReleased)));
        } catch (error) {
          finish(() => rejectPromise(error));
        }
      }, terminationGraceMs * 3);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(escalationTimer);
      clearTimeout(terminalTimer);
      clearInterval(releasePoll);
      process.off("SIGINT", onParentSigint);
      process.off("SIGTERM", onParentSigterm);
      callback();
    };
    const onParentSigint = () => {
      parentSignal = "SIGINT";
      terminate();
    };
    const onParentSigterm = () => {
      parentSignal = "SIGTERM";
      terminate();
    };
    process.once("SIGINT", onParentSigint);
    process.once("SIGTERM", onParentSigterm);
    child.once("error", (error) => finish(() => rejectPromise(error)));
    const capture = (target, chunk) => {
      const bytes = Buffer.from(chunk);
      if (outputExceeded) return;
      if (outputBytes + bytes.byteLength > outputLimitBytes) {
        outputExceeded = true;
        terminate();
        return;
      }
      outputBytes += bytes.byteLength;
      target.push(bytes);
      if (
        target === stdout &&
        trigger !== undefined &&
        !triggerObserved &&
        Buffer.concat(stdout).includes(trigger.marker)
      ) {
        triggerObserved = true;
        process.kill(process.pid, trigger.signal);
      }
    };
    child.stdout?.on("data", (chunk) => capture(stdout, chunk));
    child.stderr?.on("data", (chunk) => capture(stderr, chunk));
    child.once("close", (code, signal) => {
      closeResult = { code, signal };
      if (!terminating) {
        try {
          if (processGroupAlive()) {
            unexpectedSurvivors = true;
            terminate();
          } else {
            finish(() => resolvePromise(result(true)));
          }
        } catch (error) {
          finish(() => rejectPromise(error));
        }
        return;
      }
      try {
        if (!processGroupAlive()) finish(() => resolvePromise(result(true)));
      } catch (error) {
        finish(() => rejectPromise(error));
      }
    });
  });
}

async function rebindLifecycleProbePort() {
  await new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close(() => rejectPromise(new Error("Lifecycle probe rebind timed out.")));
    }, LIFECYCLE_PROBE_TIMEOUT_MS);
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    server.once("error", (error) => finish(() => rejectPromise(error)));
    server.listen(LIFECYCLE_PROBE_PORT, "127.0.0.1", () => {
      server.close((error) =>
        finish(() => (error ? rejectPromise(error) : resolvePromise(undefined))),
      );
    });
  });
}

async function verifyBrowserProcessLifecycle() {
  if (process.platform === "win32") {
    fail("BROWSER_LIFECYCLE_UNSUPPORTED", "The browser lifecycle proof requires POSIX groups.");
  }
  try {
    await rebindLifecycleProbePort();
  } catch (error) {
    fail(
      "BROWSER_LIFECYCLE_INVALID",
      "The fixed browser port was unavailable before the cancellation probe.",
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  const result = await runChild(
    process.execPath,
    [
      "-e",
      LIFECYCLE_PROBE_PARENT_CODE,
      Buffer.from(LIFECYCLE_PROBE_DESCENDANT_CODE).toString("base64"),
    ],
    { cwd: WORKSPACE_ROOT, env: {}, stdio: ["ignore", "pipe", "pipe"] },
    {
      timeoutMs: LIFECYCLE_PROBE_TIMEOUT_MS,
      terminationGraceMs: LIFECYCLE_PROBE_TERMINATION_GRACE_MS,
      outputLimitBytes: 16_384,
      trigger: { marker: Buffer.from(LIFECYCLE_PROBE_READY), signal: "SIGTERM" },
    },
  );
  if (
    result.code !== null ||
    result.signal !== "SIGTERM" ||
    result.parentSignal !== "SIGTERM" ||
    result.timedOut !== false ||
    result.outputExceeded !== false ||
    result.processGroupReleased !== true ||
    result.unexpectedSurvivors !== false ||
    !result.stdout.includes(Buffer.from(LIFECYCLE_PROBE_READY))
  ) {
    fail(
      "BROWSER_LIFECYCLE_INVALID",
      "The browser process-group cancellation probe did not close its full descendant tree.",
      boundedBrowserDiagnostic(result, WORKSPACE_ROOT, tmpdir()),
    );
  }
  try {
    await rebindLifecycleProbePort();
  } catch (error) {
    fail(
      "BROWSER_LIFECYCLE_INVALID",
      "The browser process-group cancellation probe did not release its fixed port.",
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  return deepFreeze({
    parentSignal: "SIGTERM",
    processGroupReleased: true,
    portAvailableBefore: true,
    portReleasedAfter: true,
  });
}

function boundedBrowserDiagnostic(result, workspaceRoot, tempRoot) {
  if (result?.outputExceeded === true) return "Browser output exceeded the 256 KiB proof budget.";
  const bytes =
    Buffer.isBuffer(result?.stderr) && result.stderr.length > 0 ? result.stderr : result?.stdout;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return undefined;
  const redacted = bytes
    .toString("utf8")
    .replaceAll(workspaceRoot, "<workspace>")
    .replaceAll(tempRoot, "<temp>");
  return [...redacted]
    .map((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127 ? "?" : character;
    })
    .join("")
    .slice(-8_192);
}

function captureEnvironment(rawEnvironment) {
  if (
    rawEnvironment === null ||
    typeof rawEnvironment !== "object" ||
    Array.isArray(rawEnvironment) ||
    utilTypes.isProxy(rawEnvironment)
  ) {
    fail("OPTIONS_INVALID", "Browser execution environment must be one inert string map.");
  }
  const keys = Reflect.ownKeys(rawEnvironment);
  if (keys.length > BROWSER_ENVIRONMENT_MAX_FIELDS || keys.some((key) => typeof key !== "string")) {
    fail("OPTIONS_INVALID", "Browser execution environment fields are unbounded.");
  }
  const captured = Object.create(null);
  let totalBytes = 0;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(rawEnvironment, key);
    if (!descriptor || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", "Browser execution environment must not contain accessors.");
    }
    const keyBytes = Buffer.byteLength(key, "utf8");
    if (keyBytes > BROWSER_ENVIRONMENT_MAX_KEY_BYTES || key.includes("\0") || key.includes("=")) {
      fail(
        "OPTIONS_INVALID",
        "Browser execution environment contains an invalid or oversized key.",
      );
    }
    totalBytes += keyBytes;
    if (typeof descriptor.value === "string") {
      const valueBytes = Buffer.byteLength(descriptor.value, "utf8");
      if (valueBytes > BROWSER_ENVIRONMENT_MAX_VALUE_BYTES || descriptor.value.includes("\0")) {
        fail(
          "OPTIONS_INVALID",
          "Browser execution environment contains an invalid or oversized value.",
        );
      }
      totalBytes += valueBytes;
      captured[key] = descriptor.value;
    } else if (descriptor.value !== undefined) {
      fail("OPTIONS_INVALID", "Browser execution environment values must be strings.");
    }
    if (totalBytes > BROWSER_ENVIRONMENT_MAX_TOTAL_BYTES) {
      fail("OPTIONS_INVALID", "Browser execution environment exceeds its aggregate byte budget.");
    }
  }
  return captured;
}

/** Executes the real built two-graph Chromium proof and returns its bounded deterministic report. */
export async function executeM10AT01BrowserProof(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["command", "environment", "runChild", "workspaceRoot"],
    "Browser execution options",
  );
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const environment = captureEnvironment(options.environment ?? process.env);
  const runner = options.runChild ?? runChild;
  if (typeof runner !== "function" || utilTypes.isProxy(runner)) {
    fail("OPTIONS_INVALID", "runChild must be one non-Proxy function.");
  }
  const selectedCommand =
    options.command === undefined || options.command === "built"
      ? M10A_T01_BROWSER_COMMAND
      : options.command === "capture"
        ? M10A_T01_BROWSER_CAPTURE_COMMAND
        : undefined;
  if (selectedCommand === undefined) {
    fail("OPTIONS_INVALID", "Browser execution command is not reviewed.");
  }
  const providedTempRoot = environment.DESEN_M10A_T01_PROOF_TEMP;
  const ownsTempRoot = providedTempRoot === undefined;
  const tempRoot = ownsTempRoot
    ? await realpath(await mkdtemp(path.join(tmpdir(), "desen-m10a-t01-browser-")))
    : providedTempRoot;
  if (
    typeof tempRoot !== "string" ||
    !path.isAbsolute(tempRoot) ||
    path.resolve(tempRoot) !== tempRoot
  ) {
    fail("BROWSER_ENVIRONMENT_INVALID", "Browser proof requires an absolute runner temp root.");
  }
  try {
    const tempEntry = await lstat(tempRoot).catch(() => undefined);
    if (
      !tempEntry?.isDirectory() ||
      tempEntry.isSymbolicLink() ||
      (await realpath(tempRoot)) !== tempRoot
    ) {
      fail("BROWSER_ENVIRONMENT_INVALID", "Browser proof temp authority is unsafe.");
    }
    const reportPath = path.join(tempRoot, "browser-proof.json");
    if ((await lstat(reportPath).catch(() => undefined)) !== undefined) {
      fail("BROWSER_OBSERVATION_STALE", "Browser proof refuses a pre-existing custom receipt.");
    }
    const result = await runner(selectedCommand.command, selectedCommand.args, {
      cwd: workspaceRoot,
      env: {
        ...environment,
        DESEN_M10A_T01_PROOF_TEMP: tempRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (
      result?.code !== 0 ||
      result.signal !== null ||
      result.timedOut === true ||
      result.outputExceeded === true ||
      result.parentSignal !== null ||
      result.processGroupReleased !== true ||
      result.unexpectedSurvivors !== false
    ) {
      fail(
        "BROWSER_EXECUTION_FAILED",
        "The real Chromium proof did not close successfully.",
        boundedBrowserDiagnostic(result, workspaceRoot, tempRoot),
      );
    }
    const reportBytes = await readStableRegularFile(reportPath, "Browser proof report", 256_000);
    return captureBrowserObservation(parseJson(reportBytes, "Browser proof report"));
  } finally {
    if (ownsTempRoot) await rm(tempRoot, { recursive: true, force: false });
  }
}

function buildEvidenceArtifact(identity, browserObservation) {
  return deepFreeze({
    schemaVersion: 1,
    profile: "desen.m10a-t01.base-ui-adapter-boundary.v1",
    task: "M10A-T01",
    result: "PASS",
    package: {
      name: "@desen/starter-catalog-web",
      catalog: {
        id: identity.catalog.id,
        version: identity.catalog.version,
        target: identity.catalog.target,
        sha256: sha256(identity.catalogBytes),
        bytes: identity.catalogBytes.byteLength,
      },
      packageDigest: identity.packageIdentity.packageDigest,
      digestProfile: identity.packageIdentity.profile,
      digestEntries: identity.inventory.entries,
      distFiles: identity.inventory.distFiles,
      distBytes: identity.inventory.distBytes,
    },
    dependencyAdmission: identity.admission,
    browser: browserObservation,
    security: {
      productionAudit: {
        command: "pnpm audit --prod --json",
        result: "PASS",
        vulnerabilities: 0,
        observation: "separate-local-admission-2026-09-10",
        rerunByVerifier: false,
      },
      allDependencyAuditClaimedClean: false,
      knownDevelopmentOnlyFinding: {
        packages: Object.freeze(["@vitest/mocker", "vitest"]),
        vulnerabilities: 2,
        severity: "moderate",
        advisory: "GHSA-82fw-gwwq-j7x9",
      },
    },
    claims: {
      boundedCapabilities: Object.freeze(["Button", "Select", "Dialog"]),
      catalogExecutionValidated: true,
      sameStaticAdaptersInCanvasAndHost: true,
      browserExecutedByVerifier: true,
      historicalArtifactsRewritten: false,
      runtimeCoreChanged: false,
    },
    tests: {
      packageCommand: "pnpm --filter @desen/starter-catalog-web test",
      browserCommand: `${M10A_T01_BROWSER_COMMAND.command} ${M10A_T01_BROWSER_COMMAND.args.join(" ")}`,
      rootTestNames: M10A_T01_ROOT_TEST_NAMES,
    },
  });
}

/** Builds deterministic M10A-T01 evidence from a freshly executed browser observation. */
export async function buildM10AT01Evidence(rawOptions) {
  const options = captureOptions(
    rawOptions,
    ["browserObservation", "fileOverrides", "workspaceRoot"],
    "M10A-T01 evidence options",
  );
  if (options.browserObservation === undefined) {
    fail("OPTIONS_INVALID", "M10A-T01 evidence requires a browser observation.");
  }
  const identity = await buildM10AT01PackageIdentity({
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
    ...(options.fileOverrides === undefined ? {} : { fileOverrides: options.fileOverrides }),
  });
  const browserObservation = captureBrowserObservation(options.browserObservation);
  const artifact = buildEvidenceArtifact(identity, browserObservation);
  return deepFreeze({ artifact, artifactBytes: prettyBytes(artifact), identity });
}

/** Executes Chromium and builds current deterministic task evidence without writing it. */
export async function executeM10AT01Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["browserOptions"], "M10A-T01 execution options");
  const browserObservation = await executeM10AT01BrowserProof(options.browserOptions);
  return buildM10AT01Evidence({ browserObservation });
}

/** Writes only the new M10A-T01 Catalog and proof artifact after executing the real browser. */
export async function writeM10AT01Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T01 writer options");
  }
  const identity = await buildM10AT01PackageIdentity();
  await writeAtomicProofArtifact({
    artifactPath: M10A_T01_CATALOG_PATH,
    artifactBytes: identity.catalogBytes,
  });
  const browserObservation = await executeM10AT01BrowserProof({ command: "capture" });
  const artifact = buildEvidenceArtifact(identity, browserObservation);
  const artifactBytes = prettyBytes(artifact);
  await writeAtomicProofArtifact({
    artifactPath: M10A_T01_ARTIFACT_PATH,
    artifactBytes,
  });
  return deepFreeze({
    artifactPath: M10A_T01_ARTIFACT_PATH,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: sha256(artifactBytes),
    catalogPath: M10A_T01_CATALOG_PATH,
    catalogSha256: sha256(identity.catalogBytes),
    packageDigest: identity.packageIdentity.packageDigest,
  });
}

/** Re-executes package and browser claims and authenticates exact checkpointed task evidence. */
export async function verifyM10AT01Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T01 verifier options");
  }
  const current = await executeM10AT01Evidence();
  const lifecycle = await verifyBrowserProcessLifecycle();
  const catalogBytes = await readFile(M10A_T01_CATALOG_PATH);
  if (!catalogBytes.equals(current.identity.catalogBytes)) {
    fail("CATALOG_DRIFT", "The tracked starter Catalog differs from the current package identity.");
  }
  const frozen = await readCheckpointedFrozenArtifact("M10A-T01");
  if (!Buffer.from(frozen.bytes).equals(current.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T01 evidence differs from fresh execution.");
  }
  return deepFreeze({
    status: "PASS",
    task: "M10A-T01",
    packageDigest: current.identity.packageIdentity.packageDigest,
    catalogSha256: sha256(current.identity.catalogBytes),
    artifactSha256: sha256(current.artifactBytes),
    browserExecutedByVerifier: true,
    browserProcessLifecycle: lifecycle,
    browserTests: current.artifact.browser.tests,
  });
}

/** Authenticates recorded task evidence without duplicating the verifier's browser execution. */
export async function verifyM10AT01RecordedEvidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T01 recorded-evidence options");
  }
  const identity = await buildM10AT01PackageIdentity();
  const catalogBytes = await readFile(M10A_T01_CATALOG_PATH);
  if (!catalogBytes.equals(identity.catalogBytes)) {
    fail("CATALOG_DRIFT", "The tracked starter Catalog differs from the current package identity.");
  }
  const frozen = await readCheckpointedFrozenArtifact("M10A-T01");
  const artifact = parseJson(Buffer.from(frozen.bytes), "Checkpointed M10A-T01 evidence");
  const browserObservation = captureBrowserObservation(artifact.browser);
  const expectedBytes = prettyBytes(buildEvidenceArtifact(identity, browserObservation));
  if (!Buffer.from(frozen.bytes).equals(expectedBytes)) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T01 evidence differs from current authorities.");
  }
  return deepFreeze({
    status: "PASS",
    task: "M10A-T01",
    packageDigest: identity.packageIdentity.packageDigest,
    catalogSha256: sha256(identity.catalogBytes),
    artifactSha256: sha256(expectedBytes),
    browserExecutedByVerifier: false,
    browserTests: browserObservation.tests,
  });
}
