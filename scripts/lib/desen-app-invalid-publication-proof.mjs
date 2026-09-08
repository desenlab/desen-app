import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { buildCurrentDesenAppPublishedHostUpdateGraphAudit } from "./desen-app-published-host-update-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json";
const REPORT_PATH = "docs/proof/DESEN-APP-INVALID-PUBLICATION.md";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const MAX_AUTHORITY_BYTES = 2 * 1_024 * 1_024;
const MAX_OVERRIDE_BYTES = 12 * 1_024 * 1_024;
const MAX_COMPILED_FILES = 512;
const MAX_COMPILED_BYTES = 12 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const execFileAsync = promisify(execFile);
const COMPILED_PACKAGES = Object.freeze(["editor-core", "protocol", "publisher", "validator"]);

const SOURCE_PATHS = Object.freeze({
  draft: "apps/desen-app/src/authoring-source-draft.ts",
  draftControls: "apps/desen-app/src/source-draft-controls.tsx",
  application: "apps/desen-app/src/application.tsx",
  inspector: "apps/desen-app/src/inspector-panel.tsx",
  diagnostics: "apps/desen-app/src/authoring-diagnostics.ts",
  diagnosticsPanel: "apps/desen-app/src/diagnostics-panel.tsx",
  publication: "apps/desen-app/src/authoring-publication.ts",
  preview: "apps/desen-app/src/authoring-preview.ts",
  profile: "apps/desen-app/src/project-workspace-profile.ts",
  referenceProfile: "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
  parser: "apps/desen-app/src/structured-json.ts",
});
const TEST_PATHS = Object.freeze({
  draft: "apps/desen-app/test/authoring-source-draft.test.ts",
  application: "apps/desen-app/test/source-draft-application.test.tsx",
  diagnostics: "apps/desen-app/test/authoring-diagnostics.test.ts",
  publication: "apps/desen-app/test/authoring-publication.test.ts",
});
const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/invalid-publication.pw.ts",
  config: "apps/desen-app-browser-e2e/invalid-publication-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
});
const ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-invalid-publication-proof.mjs",
  "scripts/verify-desen-app-invalid-publication.mjs",
]);
const BROWSER_TEST_NAME =
  "rejects advanced prop, event, and slot candidates with node links before any publication";
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config invalid-publication-playwright.config.ts";
const FOCUSED_COMMAND =
  "pnpm --filter @desen/app-web exec vitest run test/authoring-source-draft.test.ts test/source-draft-application.test.tsx test/authoring-diagnostics.test.ts test/authoring-publication.test.ts";
const T07_SUCCESSOR_PIN = Object.freeze({
  path: "docs/proof/artifacts/desen-app-0.1.0-last-known-good-recovery.json",
  bytes: 304094,
  sha256: "5e589bc8022de3ccf3add7a9ebab78006ecca6e72628e165f54eef4fd8b90b68",
});
const T07_BROWSER_SUITE_COMMAND =
  "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts";

async function authenticateT07Successor(workspaceRoot, files) {
  const bytes = await readRegularAuthority(
    path.join(workspaceRoot, T07_SUCCESSOR_PIN.path),
    T07_SUCCESSOR_PIN.path,
  );
  if (bytes.byteLength !== T07_SUCCESSOR_PIN.bytes || sha256(bytes) !== T07_SUCCESSOR_PIN.sha256)
    fail("SUCCESSOR_DRIFT", "The exact completed T07 composition authority changed.");
  const successor = parseJson(bytes, T07_SUCCESSOR_PIN.path, "SUCCESSOR_DRIFT");
  if (
    successor.task !== "M10-T07" ||
    successor.proofId !== "desen-app-last-known-good-recovery" ||
    successor.profile !== "desen.app.last-known-good-recovery-proof.v1" ||
    successor.result !== "PASS"
  )
    fail("SUCCESSOR_DRIFT", "The T07 composition authority lost its exact identity.");
  const packagePath = "apps/desen-app-browser-e2e/package.json";
  const receipt = successor.boundary?.trackedReceipts?.find(
    ({ path: name }) => name === packagePath,
  );
  const current = files.get(packagePath);
  if (!receipt || receipt.bytes !== current.byteLength || receipt.sha256 !== sha256(current))
    fail("SUCCESSOR_DRIFT", "Caller package authority is not the exact reviewed T07 successor.");
  return successor;
}

/** Exact frozen product-publication and node-linked-diagnostic prerequisites. */
export const DESEN_APP_INVALID_PUBLICATION_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M10-T05",
    path: "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json",
    bytes: 189_123,
    sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
    proofId: "desen-app-published-host-update",
    profile: "desen.app.published-host-update-proof.v1",
  }),
  Object.freeze({
    task: "M09-T13",
    path: "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
  }),
]);

const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...Object.values(TEST_PATHS),
    ...Object.values(BROWSER_PATHS),
    ...ENTRYPOINT_PATHS,
    ...DESEN_APP_INVALID_PUBLICATION_PARENT_PINS.map(({ path: relativePath }) => relativePath),
    CATALOG_PATH,
    SOURCE_FIXTURE_PATH,
    "apps/desen-app/package.json",
    "apps/desen-app-browser-e2e/package.json",
    "apps/desen-app/src/application.module.css",
    ...COMPILED_PACKAGES.map((name) => `packages/${name}/package.json`),
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

/** Immutable task artifact identity; initialized only when the first evidence is sealed. */
export const DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN = Object.freeze({
  bytes: 193_291,
  sha256: "1eb4260306d20fc87558edc4da4027c96bbb84598b758b242b8530010fe6071a",
});

/** Default write-once M10-T06 evidence destination. */
export const DEFAULT_DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Independently executed root contracts, not a product or Chromium execution count. */
export const DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES = Object.freeze([
  "[parents] retains the exact completed publication and node-linked diagnostic authorities",
  "[matrix] freshly rejects prop event and slot contracts and publishes all three valid repairs",
  "[sources] preserves the closed candidate and no-side-effect publication boundary",
  "[browser] retains a separate visible negative and repair journey without claiming execution",
  "[graphs] binds the current complete App and independent host without historical projection",
  "[inputs] rejects hostile options and overrides before getters proxies or compilation",
  "[freshness] snapshots caller bytes and re-acquires filesystem authorities on every build",
  "[artifact] rejects changed evidence and false report authority without rewriting the seal",
  "[filesystem] rejects symlinks missing files directories and mutable authority races",
  "[writer] atomically preserves exact bytes and rejects hostile destinations and interrupted writes",
]);

/** Bounded controlled failure from current T06 evidence admission or comparison. */
export class DesenAppInvalidPublicationProofError extends Error {
  /** Creates an evidence failure with a stable code and inert diagnostic details. */
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppInvalidPublicationProofError";
    this.code = code;
    this.details = Object.freeze(details);
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppInvalidPublicationProofError(code, message, details);
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
  for (const pin of DESEN_APP_INVALID_PUBLICATION_PARENT_PINS) {
    const bytes = files.get(pin.path);
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PARENT_DRIFT", "A frozen T06 prerequisite changed.", { path: pin.path });
    }
    const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
    if (
      artifact.task !== pin.task ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.result !== "PASS"
    ) {
      fail("PARENT_DRIFT", "A frozen T06 prerequisite lost its exact identity.");
    }
  }
}

async function compiledSnapshot(workspaceRoot) {
  const files = new Map();
  let totalBytes = 0;
  let directories = 0;
  let entries = 0;
  for (const name of COMPILED_PACKAGES) {
    const packageRoot = path.join(workspaceRoot, "packages", name);
    const manifest = parseJson(
      await readRegularAuthority(
        path.join(packageRoot, "package.json"),
        `packages/${name}/package.json`,
      ),
      `packages/${name}/package.json`,
    );
    if (
      manifest.name !== `@desen/${name}` ||
      manifest.type !== "module" ||
      manifest.exports?.["."]?.import !== "./dist/index.js"
    ) {
      fail("PUBLIC_API_DRIFT", "The matrix must import the emitted public package roots.");
    }
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      const dependencyName = dependency.slice("@desen/".length);
      if (!dependency.startsWith("@desen/") || !COMPILED_PACKAGES.includes(dependencyName)) {
        fail(
          "PUBLIC_API_DRIFT",
          "The pure matrix dependency closure escaped its reviewed packages.",
        );
      }
      let resolved;
      try {
        resolved = await realpath(path.join(packageRoot, "node_modules", dependency));
      } catch {
        fail("PUBLIC_API_DRIFT", "The public package dependency is not installed.");
      }
      if (resolved !== path.join(workspaceRoot, "packages", dependencyName)) {
        fail("PUBLIC_API_DRIFT", "The public package dependency resolves outside this workspace.");
      }
    }
    const pending = [`packages/${name}/dist`];
    while (pending.length > 0) {
      directories += 1;
      if (directories > 128)
        fail("PUBLIC_API_DRIFT", "The public matrix directory budget was exceeded.");
      const relativeDirectory = pending.pop();
      const absoluteDirectory = path.join(workspaceRoot, relativeDirectory);
      let directory;
      try {
        if ((await realpath(absoluteDirectory)) !== absoluteDirectory)
          throw new Error("indirect directory");
        directory = await opendir(absoluteDirectory);
        for await (const entry of directory) {
          entries += 1;
          if (entries > 2_048) throw new Error("distribution entry budget exceeded");
          const relativePath = `${relativeDirectory}/${entry.name}`;
          if (entry.isSymbolicLink()) throw new Error("indirect distribution entry");
          if (entry.isDirectory()) pending.push(relativePath);
          else if (entry.isFile() && entry.name.endsWith(".js")) {
            const bytes = await readRegularAuthority(
              path.join(workspaceRoot, relativePath),
              relativePath,
            );
            totalBytes += bytes.byteLength;
            if (files.size >= MAX_COMPILED_FILES || totalBytes > MAX_COMPILED_BYTES) {
              throw new Error("distribution envelope exceeded");
            }
            files.set(relativePath, bytes);
          }
        }
      } catch {
        fail("PUBLIC_API_DRIFT", "The emitted public matrix closure is incomplete or unsafe.");
      }
    }
    if (!files.has(`packages/${name}/dist/index.js`)) {
      fail("PUBLIC_API_DRIFT", "The emitted public package root is missing.");
    }
  }
  return receipts(
    new Map([...files].sort(([left], [right]) => left.localeCompare(right, "en-US"))),
  );
}

// This program runs in a new process on every build. It accepts only private captured JSON,
// never callbacks, publication ports, test fixtures with executable hooks, or cached results.
async function publicMatrixProgram(input) {
  const { default: assert } = await import("node:assert/strict");
  const { publishDesenSource } = await import(input.publisherUrl);
  const { createDesenEditorDocument, createDesenEditorContinuousValidator } = await import(
    input.editorUrl
  );
  const { canonicalizeJson, canonicalizeJsonBytes } = await import(input.protocolUrl);
  const { catalog, source } = input;
  const packages = [
    {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      observedPackageDigest: catalog.packageDigest,
      catalog,
    },
  ];
  const catalogBefore = JSON.stringify(catalog);
  const sourceBefore = JSON.stringify(source);
  const validator = createDesenEditorContinuousValidator([catalog]);
  assert.equal(validator.ok, true);
  const baseline = publishDesenSource(JSON.stringify(source), packages);
  assert.equal(baseline.ok, true);
  const rows = [];
  const cases = [
    {
      kind: "prop",
      code: "PROP_TYPE_MISMATCH",
      nodeId: "sign-in.title",
      pointer: "/surfaces/sign-in/root/slots/default/0/props/text",
      occurrence: "/surfaces/sign-in/root/slots/default/0",
    },
    {
      kind: "event",
      code: "UNKNOWN_EVENT",
      nodeId: "sign-in.title",
      pointer: "/surfaces/sign-in/root/slots/default/0/on/teleport",
      occurrence: "/surfaces/sign-in/root/slots/default/0",
    },
    {
      kind: "slot",
      code: "UNKNOWN_SLOT",
      nodeId: "sign-in.layout",
      pointer: "/surfaces/sign-in/root/slots/ghost",
      occurrence: "/surfaces/sign-in/root",
    },
  ];
  for (const expected of cases) {
    const candidate = structuredClone(source);
    if (expected.kind === "prop")
      candidate.surfaces["sign-in"].root.slots.default[0].props.text = 42;
    if (expected.kind === "event")
      candidate.surfaces["sign-in"].root.slots.default[0].on = { teleport: [] };
    if (expected.kind === "slot") candidate.surfaces["sign-in"].root.slots.ghost = [];
    const candidateBefore = JSON.stringify(candidate);
    const admitted = createDesenEditorDocument(candidate);
    assert.equal(admitted.ok, true);
    const report = validator.validator.validate(admitted.document);
    assert.equal(report.valid, false);
    assert.equal(report.diagnostics.length, 1);
    assert.deepEqual(report.unmappedDiagnosticIndexes, []);
    assert.deepEqual(report.invalidSubjects, [
      {
        surfaceId: "sign-in",
        subject: { kind: "node", id: expected.nodeId },
        diagnosticIndexes: [0],
        occurrencePointers: [expected.occurrence],
      },
    ]);
    const rejected = publishDesenSource(JSON.stringify(candidate), packages);
    assert.deepEqual(Object.keys(rejected).sort(), ["diagnostics", "ok", "stage"]);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.stage, "capability-contracts");
    assert.equal(rejected.diagnostics.length, 1);
    const diagnostic = rejected.diagnostics[0];
    assert.equal(diagnostic.code, expected.code);
    assert.equal(diagnostic.pointer, expected.pointer);
    assert.equal(diagnostic.severity, "error");
    assert.equal(diagnostic.stage, "capability-contracts");
    assert.deepEqual(diagnostic.context.subject, { kind: "node", id: expected.nodeId });
    assert.equal(diagnostic.context.surfaceId, "sign-in");
    assert.equal(report.diagnostics[0].code, diagnostic.code);
    assert.equal(report.diagnostics[0].pointer, diagnostic.pointer);
    assert.deepEqual(report.diagnostics[0].context, diagnostic.context);
    assert.equal(Object.isFrozen(rejected), true);
    assert.equal(Object.isFrozen(rejected.diagnostics), true);
    assert.equal(Object.isFrozen(report.invalidSubjects[0]), true);
    assert.equal(JSON.stringify(candidate), candidateBefore);
    assert.equal(JSON.stringify(source), sourceBefore);
    assert.equal(JSON.stringify(catalog), catalogBefore);

    const repair = structuredClone(candidate);
    if (expected.kind === "prop")
      repair.surfaces["sign-in"].root.slots.default[0].props.text = "Repaired prop";
    if (expected.kind === "event") delete repair.surfaces["sign-in"].root.slots.default[0].on;
    if (expected.kind === "slot") delete repair.surfaces["sign-in"].root.slots.ghost;
    if (expected.kind !== "prop")
      repair.surfaces["sign-in"].root.slots.default[0].props.text = `Repaired ${expected.kind}`;
    const repairedDocument = createDesenEditorDocument(repair);
    assert.equal(repairedDocument.ok, true);
    const repairedReport = validator.validator.validate(repairedDocument.document);
    assert.equal(repairedReport.valid, true);
    assert.deepEqual(repairedReport.diagnostics, []);
    assert.deepEqual(repairedReport.invalidSubjects, []);
    const repairedA = publishDesenSource(JSON.stringify(repair), packages);
    const repairedB = publishDesenSource(JSON.stringify(repair), packages);
    assert.equal(repairedA.ok, true);
    assert.equal(repairedB.ok, true);
    assert.deepEqual(
      canonicalizeJsonBytes(repairedA.bundle),
      canonicalizeJsonBytes(repairedB.bundle),
    );
    assert.notEqual(repairedA.bundle.revision, baseline.bundle.revision);
    rows.push({
      kind: expected.kind,
      stage: rejected.stage,
      diagnostic,
      invalidSubjects: report.invalidSubjects,
      structurallyAdmitted: true,
      rejectedResultKeys: Object.keys(rejected).sort(),
      candidateFingerprint: report.documentFingerprint,
      sourceAndCatalogUnchanged: true,
      repaired: {
        valid: repairedReport.valid,
        diagnostics: repairedReport.diagnostics.length,
        revision: repairedA.bundle.revision,
        deterministicPublications: 2,
        canonicalBundleBytes: canonicalizeJsonBytes(repairedA.bundle).byteLength,
        sourceFingerprint: repairedReport.documentFingerprint,
        distinctFromBaseline: true,
      },
    });
  }
  assert.equal(new Set(rows.map((row) => row.repaired.revision)).size, 3);
  process.stdout.write(
    canonicalizeJson({
      publicRoots: ["@desen/publisher", "@desen/editor-core", "@desen/protocol"],
      baselineRevision: baseline.bundle.revision,
      catalogSetFingerprint: validator.validator.catalogSetFingerprint,
      cases: rows,
      invalidCases: 3,
      repairedCases: 3,
      publicPublisherCalls: 10,
      listenerStarted: false,
      publicationPortsSupplied: false,
      browserExecuted: false,
    }),
  );
}

async function runPublicMatrix(workspaceRoot, files) {
  const before = await compiledSnapshot(workspaceRoot);
  const input = {
    publisherUrl: pathToFileURL(path.join(workspaceRoot, "packages/publisher/dist/index.js")).href,
    editorUrl: pathToFileURL(path.join(workspaceRoot, "packages/editor-core/dist/index.js")).href,
    protocolUrl: pathToFileURL(path.join(workspaceRoot, "packages/protocol/dist/index.js")).href,
    catalog: parseJson(files.get(CATALOG_PATH), CATALOG_PATH),
    source: parseJson(files.get(SOURCE_FIXTURE_PATH), SOURCE_FIXTURE_PATH),
  };
  const program = `await (${publicMatrixProgram.toString()})(${JSON.stringify(input)});`;
  let observed;
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--input-type=module", "-e", program],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1_024,
        timeout: 20_000,
        killSignal: "SIGKILL",
        windowsHide: true,
      },
    );
    if (stderr !== "") throw new Error("unexpected matrix stderr");
    observed = JSON.parse(stdout);
  } catch {
    fail("PUBLIC_MATRIX_FAILED", "A fresh isolated public-API rejection/repair assertion failed.");
  }
  const after = await compiledSnapshot(workspaceRoot);
  if (!isDeepStrictEqual(before, after)) {
    fail("PUBLIC_API_DRIFT", "The public matrix implementation changed across its execution.");
  }
  return deepFreeze({
    ...observed,
    execution: "fresh bounded isolated Node process; public emitted package roots only",
    processTimeoutMilliseconds: 20_000,
    compiledFiles: before.length,
    compiledReceipts: before,
    compiledSnapshotSha256: `sha256:${sha256(Buffer.from(JSON.stringify(before)))}`,
  });
}

function parseCode(source, relativePath, code) {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, "A current executable authority does not parse.", { path: relativePath });
  }
  return sourceFile;
}

const CODE_PRINTER = ts.createPrinter({ removeComments: true });

function printed(node, sourceFile) {
  return CODE_PRINTER.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function compact(value) {
  return value.replace(/\s+/gu, "");
}

function requireMarkers(source, markers, label, code) {
  for (const marker of markers) {
    if (!compact(source).includes(compact(marker))) {
      fail(code, "A reviewed executable invariant is missing.", { path: label, marker });
    }
  }
}

function findFunction(sourceFile, name, code) {
  const found = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body !== undefined) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found.length !== 1)
    fail(code, "An exact current function authority is missing or duplicated.", { name });
  return found[0];
}

function requireRejectingGuard(sourceFile, owner, condition, forbidden, code) {
  const guards = [];
  function visit(node) {
    if (
      ts.isIfStatement(node) &&
      compact(printed(node.expression, sourceFile)) === compact(condition)
    ) {
      guards.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(owner.body);
  if (guards.length !== 1) fail(code, "The exact rejection guard changed.", { condition });
  const body = printed(guards[0].thenStatement, sourceFile);
  if (
    !/\breturn\b/u.test(body) ||
    forbidden.some((marker) => compact(body).includes(compact(marker)))
  ) {
    fail(code, "A rejected candidate can acquire partial or executable authority.");
  }
  return guards[0];
}

function capturePolicyInput(rawInput, paths, label) {
  const input = exactOptions(rawInput, Object.keys(paths), label);
  const captured = Object.create(null);
  for (const [name, relativePath] of Object.entries(paths)) {
    captured[name] = decodeUtf8(captureBytes(input[name], `${label}.${name}`), relativePath);
  }
  return Object.freeze(captured);
}

/** Audits the executable rejection and diagnostic boundary without executing App callbacks. */
export function verifyDesenAppInvalidPublicationSourcePolicy(rawInput) {
  const input = capturePolicyInput(rawInput, SOURCE_PATHS, "source policy");
  const code = "SOURCE_POLICY_VIOLATION";
  const trees = Object.fromEntries(
    Object.entries(input).map(([key, source]) => [key, parseCode(source, SOURCE_PATHS[key], code)]),
  );
  const sources = Object.fromEntries(
    Object.entries(trees).map(([key, tree]) => [key, CODE_PRINTER.printFile(tree)]),
  );
  const imports = trees.draft.statements
    .filter(ts.isImportDeclaration)
    .map((node) => node.moduleSpecifier.text);
  const expectedImports = [
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "./project-workspace-profile.js",
    "./structured-json.js",
    "@desen/editor-core",
    "@desen/publisher",
    "./authoring-preview.js",
    "./project-workspace-profile.js",
  ];
  if (!isDeepStrictEqual(imports, expectedImports))
    fail(code, "The draft reviewer gained an unreviewed import.");
  const review = findFunction(trees.draft, "reviewAuthoringSourceDraft", code);
  const reviewCode = printed(review.body, trees.draft);
  requireMarkers(
    reviewCode,
    [
      "readProjectWorkspaceProfileAuthority(profile)",
      "admitProjectWorkspaceDocument(profile, currentDocument)",
      "digestCanonicalJson(current.document) !== baselineFingerprint",
      "parseInertJsonText(rawText)",
      "publishDesenSource(rawText, authority.profile.catalogPackages)",
      "createDesenEditorDocument(parsed.value)",
      "createDesenEditorContinuousValidator(authority.profile.catalogs)",
      "validator.validator.validate(candidate.document)",
      "admitProjectWorkspaceDocument(profile, candidate.document)",
      "document: admitted.document",
      "bundle: publication.bundle",
    ],
    SOURCE_PATHS.draft,
    code,
  );
  requireRejectingGuard(
    trees.draft,
    review,
    "!publication.ok || !candidate.ok || report?.valid !== true",
    ["document:", "preview:", "bundle:"],
    code,
  );
  for (const forbidden of [
    "fetch",
    "eval",
    "Function",
    "XMLHttpRequest",
    "WebSocket",
    "publishBundleToChannel",
    "activatePublishedRevision",
    "saveSource",
  ]) {
    let invoked = false;
    function visit(node) {
      if (
        (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
        (ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : "") === forbidden
      )
        invoked = true;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
        invoked = true;
      ts.forEachChild(node, visit);
    }
    visit(trees.draft);
    if (invoked) fail(code, "Draft review acquired an executable side effect.", { forbidden });
  }
  const apply = findFunction(trees.application, "applySourceDraft", code);
  const rejected = requireRejectingGuard(
    trees.application,
    apply,
    "!result.ok",
    ["commitAuthoringSession", "saveSource", "publish", "activate", "setAuthoringSession"],
    code,
  );
  const applyCode = printed(apply.body, trees.application);
  requireMarkers(
    applyCode,
    [
      "reviewAuthoringSourceDraft(current.text, workspaceProfile, document, route, current.baselineFingerprint)",
      "captureEditDiagnostics(result)",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: result.preview }))",
    ],
    SOURCE_PATHS.application,
    code,
  );
  if (
    applyCode.indexOf("commitAuthoringSession") <
    applyCode.indexOf(printed(rejected, trees.application))
  ) {
    fail(code, "The session commit moved before the candidate rejection guard.");
  }
  requireMarkers(
    sources.application,
    [
      "if (!allowSourceDraft && sourceDraftRef.current !== null) return false",
      'sourceDraftRef.current !== null || persistenceState?.pending === "opening" || publicationPending',
      'interactive={mode === "design" && !publicationPending && sourceDraft === null}',
      "baselineFingerprint: committedDocumentFingerprint",
      "onApply={applySourceDraft}",
      "onDiscard={discardSourceDraft}",
    ],
    SOURCE_PATHS.application,
    code,
  );
  requireMarkers(
    sources.diagnostics,
    [
      "report.invalidSubjects",
      "Array.isArray(report.invalidSubjects)",
      "for (const mapping of report.invalidSubjects)",
      "mapping.subject.id",
      "mapping.occurrencePointers.map",
      "report.documentFingerprint !== snapshot.documentFingerprint",
      "report.catalogSetFingerprint !== snapshot.catalogSetFingerprint",
      'linkStatus: "unmapped"',
    ],
    SOURCE_PATHS.diagnostics,
    code,
  );
  requireMarkers(
    sources.diagnosticsPanel,
    [
      'aria-label="Validation diagnostics"',
      "targetLabel(occurrence)",
      "onSelect(occurrence.selectionKey)",
    ],
    SOURCE_PATHS.diagnosticsPanel,
    code,
  );
  requireMarkers(
    sources.draftControls,
    [
      'aria-label="Advanced Source draft"',
      'text === null ? "closed" : failure === null ? "editing" : "rejected"',
      "Validate and apply Source",
      "Discard Source draft",
      "failure.publicationFailure.stage",
    ],
    SOURCE_PATHS.draftControls,
    code,
  );
  requireMarkers(
    sources.parser,
    ["PUBLISH_SOURCE_JSON_LIMITS", '"duplicate-member"', '"invalid-unicode"', '"limit-exceeded"'],
    SOURCE_PATHS.parser,
    code,
  );
  requireMarkers(
    sources.publication,
    [
      "prepareAuthoringPreviewBundle",
      "canonicalSavedDocument",
      "sourceGeneration",
      '"publisher-rejected"',
      "publishBundleToChannel",
      "activatePublishedRevision",
    ],
    SOURCE_PATHS.publication,
    code,
  );
  requireMarkers(
    sources.preview,
    ["publishDesenSource", "published.bundle"],
    SOURCE_PATHS.preview,
    code,
  );
  requireMarkers(
    sources.referenceProfile,
    ['channelName: "preview"', 'hostId: "reference-host-web"'],
    SOURCE_PATHS.referenceProfile,
    code,
  );
  return deepFreeze({
    compiler: `typescript@${ts.version}`,
    authority:
      "current executable AST, closed imports, rejection guards, and exact captured file receipts",
    publicPublisherRevalidatesRawText: true,
    invalidSubjectsOwnNodeLinks: true,
    rejectedCandidateExposesNoDocumentOrBundle: true,
    rejectedCandidateCannotCommitSession: true,
    staleBaselineRejected: true,
    structuredJsonIsBoundedAndDuplicateAware: true,
    persistencePublicationAndRunPausedWhileDraftOpen: true,
    validRepairStillRequiresOrdinarySaveAndPublish: true,
    draftReviewerHasNoPublicationOrPersistencePort: true,
    productCallbacksExecutedByPolicy: false,
  });
}

function testDeclarations(source, relativePath, code) {
  const tree = parseCode(source, relativePath, code);
  const declarations = [];
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const direct = ts.isIdentifier(expression) && ["it", "test"].includes(expression.text);
      const parameterized =
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        expression.expression.name.text === "each" &&
        ts.isIdentifier(expression.expression.expression) &&
        ["it", "test"].includes(expression.expression.expression.text);
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        ["it", "test", "describe"].includes(expression.expression.text) &&
        ["only", "skip", "todo", "fails", "skipIf", "runIf"].includes(expression.name.text)
      ) {
        fail(code, "A proof-owned test acquired a skipped or alternate-result mode.", {
          path: relativePath,
        });
      }
      if (direct || parameterized) {
        const name = node.arguments[0];
        if (name === undefined || !ts.isStringLiteral(name))
          fail(code, "Test names must remain literal reviewed declarations.");
        declarations.push(name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (declarations.length === 0 || new Set(declarations).size !== declarations.length)
    fail(code, "Test declarations are missing or duplicated.");
  return declarations;
}

function verifyFocusedTests(files) {
  const names = {
    draft: [
      "rejects invalid %s through the real Publisher with exact node-linked diagnostics and no partial authority",
      "applies a fully validated detached correction without changing its authored bindings or baseline",
      "rejects malformed or over-budget text with no candidate or report",
      "keeps structural Publisher diagnostics readable without guessing a Source node",
      "rejects a stale authoring baseline even when the draft is publishable",
      "rejects forged profile handles and valid foreign Source identities",
    ],
    application: [
      "rejects an invalid %s draft, links its exact node, and leaves persistence and publication untouched",
      "repairs rejected text, applies atomically and still requires the ordinary Save then Publish boundary",
      "protects a detached draft across route and page exit and refuses visual edits while it is pending",
      "keeps malformed text visible and unpublishable until explicit discard",
    ],
    diagnostics: [
      "creates links only from invalidSubjects and leaves code/message/pointer guesses visible but inert",
    ],
    publication: ["captures only the exact route, snapshot, and two-method trusted-host port"],
  };
  const inspected = [];
  for (const [key, relativePath] of Object.entries(TEST_PATHS)) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const declarations = testDeclarations(source, relativePath, "TEST_AUTHORITY_DRIFT");
    if (names[key].some((name) => !declarations.includes(name))) {
      fail(
        "TEST_AUTHORITY_DRIFT",
        "A required focused negative or recovery-positive test is missing.",
        { path: relativePath },
      );
    }
    inspected.push({
      path: relativePath,
      declarationSites: declarations.length,
      names: declarations,
    });
  }
  return deepFreeze({
    command: FOCUSED_COMMAND,
    files: inspected,
    totalDeclarationSites: inspected.reduce((total, entry) => total + entry.declarationSites, 0),
    executedByVerifier: false,
    declarationSitesAreNotExecutionCount: true,
  });
}

/** Audits the independent Chromium journey and forbids hidden authoring or mocked transport. */
export function verifyDesenAppInvalidPublicationBrowserPolicy(rawInput) {
  const input = capturePolicyInput(rawInput, BROWSER_PATHS, "browser policy");
  const code = "BROWSER_POLICY_VIOLATION";
  const specTree = parseCode(input.spec, BROWSER_PATHS.spec, code);
  const spec = CODE_PRINTER.printFile(specTree);
  const config = CODE_PRINTER.printFile(parseCode(input.config, BROWSER_PATHS.config, code));
  const server = CODE_PRINTER.printFile(parseCode(input.server, BROWSER_PATHS.server, code));
  if (
    !isDeepStrictEqual(testDeclarations(input.spec, BROWSER_PATHS.spec, code), [BROWSER_TEST_NAME])
  ) {
    fail(code, "The Chromium journey must remain one exact independent scenario.");
  }
  let forbidden = false;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : ts.isIdentifier(expression)
          ? expression.text
          : "";
      if (
        [
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
          "eval",
        ].includes(name)
      )
        forbidden = true;
      if (
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === "request" &&
        name !== "get"
      )
        forbidden = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(specTree);
  if (forbidden)
    fail(code, "The visible journey gained hidden Source injection or transport replacement.");
  requireMarkers(
    spec,
    [
      'name: "New project"',
      'name: "Advanced Source"',
      'name: "Source JSON draft"',
      'name: "Validate and apply Source"',
      'name: "Discard Source draft"',
      'code: "PROP_TYPE_MISMATCH"',
      'code: "UNKNOWN_EVENT"',
      'code: "UNKNOWN_SLOT"',
      "for (const [index, negative] of NEGATIVE_CASES.entries())",
      "negative.mutate(candidate)",
      'toHaveAttribute("data-source-draft-state", "rejected")',
      "diagnostics.getByText(negative.code",
      "diagnostics.getByText(negative.pointer",
      "name: negative.target, exact: true",
      "expect(writes).toEqual(writesBefore)",
      "expect(await reloadHost(host, activeLabel)).toEqual(activeIdentity)",
      "expect(nextRevision).not.toBe(activeRevision)",
      "await save(page, index + 3)",
      "await publish(page, index + 2)",
      "expect(await hostBuildFingerprint(request)).toBe(buildIdentity)",
      'name: "Run", exact: true })).toBeDisabled()',
      'page.on("request"',
      '"/v1/activate-published-revision"',
      'name: "Save source", exact: true',
      'name: "Publish", exact: true',
    ],
    BROWSER_PATHS.spec,
    code,
  );
  if (compact(spec).split(compact("expect(writes).toEqual(writesBefore)")).length !== 3) {
    fail(code, "The rejection and local-only repair must each preserve the exact write ledger.");
  }
  requireMarkers(
    config,
    [
      'testMatch: "invalid-publication.pw.ts"',
      "fullyParallel: false",
      "retries: 0",
      "workers: 1",
      "forbidOnly: Boolean(process.env.CI)",
      '...devices["Desktop Chrome"]',
      'name: "invalid-publication-chromium"',
      "reuseExistingServer: false",
      'command: "exec node apps/desen-app-browser-e2e/published-host-proof-server.mjs"',
    ],
    BROWSER_PATHS.config,
    code,
  );
  requireMarkers(
    server,
    ["openLocalControlPlane", "openDesenAppLocalPublicationHost", "openReferenceHostWebServer"],
    BROWSER_PATHS.server,
    code,
  );
  return deepFreeze({
    command: BROWSER_COMMAND,
    spec: BROWSER_PATHS.spec,
    configuration: BROWSER_PATHS.config,
    server: BROWSER_PATHS.server,
    testName: BROWSER_TEST_NAME,
    chromiumScenarios: 1,
    negativeFixtureClasses: ["prop", "event", "slot"],
    normalVisibleAdvancedSourceInput: true,
    advancedInputIsNotVisualAuthoringProof: true,
    assertsNoSourceBundleChannelOrActivationWriteDuringRejection: true,
    assertsSameActiveHostAndStaticBuildIdentity: true,
    validRepairsUseOrdinarySavePublishActivate: true,
    browserExecutedByVerifier: false,
  });
}

function policyInput(files, paths) {
  return Object.fromEntries(
    Object.entries(paths).map(([key, relativePath]) => [key, files.get(relativePath)]),
  );
}

function verifyPackageWiring(files) {
  const app = parseJson(files.get("apps/desen-app/package.json"), "App package");
  const browser = parseJson(
    files.get("apps/desen-app-browser-e2e/package.json"),
    "Browser package",
  );
  if (
    app.name !== "@desen/app-web" ||
    app.scripts.test !== "vitest run" ||
    browser.name !== "@desen/app-browser-e2e" ||
    browser.scripts?.["test:e2e"] !== T07_BROWSER_SUITE_COMMAND ||
    browser.devDependencies?.["@desen/protocol"] !== "workspace:*"
  )
    fail(
      "TEST_AUTHORITY_DRIFT",
      "The fresh workspace or browser test wiring lost T06 or its predecessor.",
    );
  return {
    focusedTestsDiscoveredByWorkspacePackageTests: true,
    browserAppendsDistinctConfiguration: true,
  };
}

/** Executes fresh pure public APIs and current graph audits; starts no browser or listener. */
export async function buildDesenAppInvalidPublicationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  let workspaceRoot;
  try {
    workspaceRoot = await realpath(options.workspaceRoot);
  } catch {
    fail("AUTHORITY_UNSAFE", "The proof workspace root is unavailable.");
  }
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  authenticateParents(files);
  const sourcePolicy = verifyDesenAppInvalidPublicationSourcePolicy(
    policyInput(files, SOURCE_PATHS),
  );
  const focusedTests = verifyFocusedTests(files);
  const browser = verifyDesenAppInvalidPublicationBrowserPolicy(policyInput(files, BROWSER_PATHS));
  const packageWiring = verifyPackageWiring(files);
  const successor = await authenticateT07Successor(workspaceRoot, files);
  const publicApiMatrix = await runPublicMatrix(workspaceRoot, files);
  let currentGraphAudit;
  try {
    currentGraphAudit = await buildCurrentDesenAppPublishedHostUpdateGraphAudit({ workspaceRoot });
  } catch (error) {
    fail(
      "CURRENT_GRAPH_AUDIT_FAILED",
      "The current complete App and independent-host audit failed.",
      { code: error?.code ?? "UNKNOWN" },
    );
  }
  if (
    currentGraphAudit.runtimeResolution?.write !== false ||
    currentGraphAudit.runtimeResolution.independentBuildsPerApplication !== 2 ||
    currentGraphAudit.runtimeResolution.noHandwrittenHostManagedTreePreservedByFreshHostAudit !==
      true ||
    !currentGraphAudit.appSourceAudit?.inventory.includes(SOURCE_PATHS.draft) ||
    !currentGraphAudit.appSourceAudit.inventory.includes(SOURCE_PATHS.draftControls)
  )
    fail(
      "CURRENT_GRAPH_AUDIT_FAILED",
      "The current graph audit lost its unprojected complete-source authority.",
    );
  const after = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  if (!isDeepStrictEqual(receipts(files), receipts(after))) {
    fail("SOURCE_SNAPSHOT_DRIFT", "A tracked T06 authority changed across fresh execution.");
  }
  // Overrides are hostile-test inputs, not a way to claim that a different App was compiled.
  for (const receipt of currentGraphAudit.appSourceAudit.sourceReceipts) {
    const captured = files.get(receipt.path);
    if (
      captured !== undefined &&
      (captured.byteLength !== receipt.bytes || `sha256:${sha256(captured)}` !== receipt.sha256)
    ) {
      fail("SOURCE_SNAPSHOT_DRIFT", "Current App compilation and captured T06 source disagree.", {
        path: receipt.path,
      });
    }
  }
  const currentArtifact = deepFreeze({
    schemaVersion: 1,
    task: "M10-T06",
    gate: null,
    proofId: "desen-app-invalid-publication",
    profile: "desen.app.invalid-publication-proof.v1",
    result: "PASS",
    prerequisites: DESEN_APP_INVALID_PUBLICATION_PARENT_PINS,
    claim: {
      invalidPropEventAndSlotPublicationRejected: true,
      validatorOwnedSourceNodeLinks: true,
      validRepairsPublishDeterministically: true,
      currentAppAndHostGraphAudited: true,
      productAndBrowserExecutionIsIndependent: true,
      lastKnownGoodCorruptionRecovery: false,
      m10T07Closed: false,
      g10Closed: false,
    },
    authority: {
      sourcePolicy,
      publicApiMatrix,
      currentGraphAudit,
      focusedTests,
      browser,
      packageWiring,
    },
    tests: {
      focusedCommand: FOCUSED_COMMAND,
      browserCommand: BROWSER_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-invalid-publication.mjs",
      proofReaderCommand: "node --test tests/desen-app-invalid-publication.test.mjs",
      rootTestNames: DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES,
      publicApiMatrixExecutedByVerifier: true,
      focusedTestsExecutedByVerifier: false,
      browserExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
      viteBuildsExecutedByVerifier: true,
      viteBuildOutputWritten: false,
    },
    boundary: {
      trackedFiles: files.size,
      trackedReceipts: receipts(files),
      immutableInputs: true,
      parentArtifacts: DESEN_APP_INVALID_PUBLICATION_PARENT_PINS.length,
      currentGraphHasNoHistoricalProjection: true,
      sourceSymlinksRejected: true,
      publicMatrixUsesFreshProcess: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-invalid-publication-proof.mjs",
        "tests/desen-app-invalid-publication.test.mjs",
      ],
      graphReaderCheckpointOwnedPath: "scripts/lib/desen-app-published-host-update-proof.mjs",
      artifactTrackedEntrypoints: ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "The fresh deterministic matrix executes only emitted public Publisher, Editor Core, and Protocol roots; it supplies no persistence, channel, activation, or browser capability.",
      "The independent product tests and Chromium journey establish no-write and visible Source-node selection behavior; source inspection and their declaration receipts are not execution receipts.",
      "The normal optional Advanced Source input deliberately admits invalid text for review. This is not evidence that visual Inspector controls emit invalid Source or that a rejected candidate replaced the current valid canvas.",
      "Every current App and independent host graph is freshly observed without historical projections, while completed prerequisite artifacts remain unchanged.",
      "No remote deployment, production credentials, multi-user persistence, corrupt revision or Catalog-mismatch last-known-good recovery, M10-T07, M10-T08, M10-T09, N-036, P-12, or G10 closure is claimed.",
      "Local deterministic evidence does not authorize hosted completion until the exact current head passes the independent required checks.",
    ],
  });
  const recheckedSuccessor = await authenticateT07Successor(workspaceRoot, after);
  if (
    !isDeepStrictEqual(successor, recheckedSuccessor) ||
    !isDeepStrictEqual(currentGraphAudit, successor.authority.currentGraphAudit)
  )
    fail(
      "SUCCESSOR_DRIFT",
      "The live T07 graph or composition authority changed across execution.",
    );
  const historical = authenticateArtifact(
    await readRegularAuthority(path.join(workspaceRoot, ARTIFACT_PATH), ARTIFACT_PATH),
  );
  const packagePath = "apps/desen-app-browser-e2e/package.json";
  const artifact = structuredClone(currentArtifact);
  const index = artifact.boundary.trackedReceipts.findIndex(
    ({ path: name }) => name === packagePath,
  );
  const previous = historical.boundary.trackedReceipts.find(
    ({ path: name }) => name === packagePath,
  );
  if (index < 0 || !previous)
    fail("SUCCESSOR_DRIFT", "The exact historical package receipt is missing.");
  artifact.boundary.trackedReceipts[index] = structuredClone(previous);
  if (!isDeepStrictEqual(artifact, historical))
    fail("SUCCESSOR_DRIFT", "T07 may project only its one authenticated browser package receipt.");
  const artifactBytes = Buffer.from(
    await format(JSON.stringify(artifact), { parser: "json", printWidth: 100, endOfLine: "lf" }),
  );
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    liveSuccessorAuthority: {
      task: "M10-T07",
      path: T07_SUCCESSOR_PIN.path,
      bytes: T07_SUCCESSOR_PIN.bytes,
      sha256: T07_SUCCESSOR_PIN.sha256,
      currentGraphAudit,
      currentBrowserPackageReceipt: currentArtifact.boundary.trackedReceipts[index],
      historicalProjectionPaths: [packagePath],
      parentArtifactUnchanged: true,
    },
  });
}

function authenticateArtifact(bytes) {
  const pin = DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN;
  if (pin.bytes <= 0 || bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("ARTIFACT_DRIFT", "The immutable committed T06 evidence bytes drifted.");
  }
  const artifact = parseJson(bytes, ARTIFACT_PATH, "ARTIFACT_DRIFT");
  if (
    artifact.task !== "M10-T06" ||
    artifact.result !== "PASS" ||
    artifact.proofId !== "desen-app-invalid-publication"
  ) {
    fail("ARTIFACT_DRIFT", "The immutable T06 evidence identity drifted.");
  }
  return artifact;
}

function verifyReport(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, REPORT_PATH);
  const header = [
    "# Desen App invalid publication",
    "",
    "Task: M10-T06",
    "",
    "Status: DONE",
    "",
    `M10-T05 parent: \`sha256:${DESEN_APP_INVALID_PUBLICATION_PARENT_PINS[0].sha256}\``,
    "",
    `M09-T13 parent: \`sha256:${DESEN_APP_INVALID_PUBLICATION_PARENT_PINS[1].sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(header) ||
    source.split("Final artifact:").length !== 2 ||
    source.split("Status: DONE").length !== 2 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The T06 proof report lost its exact bounded authority header.");
  }
}

/** Compares the pinned T06 artifact with fresh source, public APIs, and current App/host graphs. */
export async function verifyDesenAppInvalidPublicationEvidence(rawOptions = undefined) {
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
    options.artifactPath ?? DEFAULT_DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PATH,
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
    verifyReport(suppliedReport, DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN.sha256);
  else
    verifyReport(
      await readRegularAuthority(reportPath, REPORT_PATH),
      DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PIN.sha256,
    );
  const built = await buildDesenAppInvalidPublicationEvidence(buildOptions);
  const artifactBytes =
    suppliedArtifact ?? (await readRegularAuthority(artifactPath, ARTIFACT_PATH));
  const artifact = authenticateArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes))
    fail(
      "ARTIFACT_DRIFT",
      "The pinned T06 artifact no longer reproduces from current authorities.",
    );
  verifyReport(
    suppliedReport ?? (await readRegularAuthority(reportPath, REPORT_PATH)),
    built.artifactSha256,
  );
  return deepFreeze({
    task: "M10-T06",
    result: "PASS",
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    invalidCases: 3,
    repairedCases: 3,
    publicApiMatrixExecutedByVerifier: true,
    browserExecutedByVerifier: false,
    focusedTestsExecutedByVerifier: false,
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
    fail("ARTIFACT_WRITE_UNSAFE", "The T06 artifact destination is not one regular-file location.");
  }
}

/** Atomically creates T06 evidence; never replaces different bytes at its frozen tracked path. */
export async function writeDesenAppInvalidPublicationEvidence(rawOptions = undefined) {
  const options = exactOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  const artifactPath = capturePath(
    options.artifactPath ?? DEFAULT_DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PATH,
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
  const built = await buildDesenAppInvalidPublicationEvidence(buildOptions);
  const { destination, exists } = await canonicalDestination(artifactPath);
  const frozen = await canonicalDestination(DEFAULT_DESEN_APP_INVALID_PUBLICATION_ARTIFACT_PATH);
  if (destination === frozen.destination && exists) {
    const existing = await readRegularAuthority(destination, ARTIFACT_PATH);
    if (!existing.equals(built.artifactBytes))
      fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked T06 artifact.");
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_UNSAFE", "The atomic T06 artifact write failed.");
  }
  return deepFreeze({
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: DESEN_APP_INVALID_PUBLICATION_ROOT_TEST_NAMES.length,
  });
}
