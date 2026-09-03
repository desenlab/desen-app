import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";

import { format } from "prettier";

import {
  calculateProofReaderCheckpointSha256,
  validateProofReaderCheckpointBytes,
} from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import {
  ARCHIVE_REDACTION_PINS,
  GENERATOR_REDACTION_RECEIPTS,
  getHistoricalArchiveRedactionPin,
  inspectHistoricalArchiveRedaction,
} from "./historical-archive-redaction.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/historical-archive-redaction.json";
const REPORT_PATH = "docs/proof/HISTORICAL-ARCHIVE-REDACTION.md";
const CHECKPOINT_PATH = "scripts/ci/proof-reader-checkpoints.json";
const HISTORY_LENGTH = 70;
const HISTORICAL_ARTIFACT_COUNT = 57;
const HISTORY_HEAD = "52e71083e7c6f08986480434b5a327b1de6a2d29487b8f8a7ecbef1ffdb4d4e6";
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_OVERRIDE_BYTES = 24 * 1024 * 1024;
const FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const ARCHIVE_PATHS = Object.freeze([
  "docs/proof/artifacts/desen-app-0.1.0-t01b-historical-reader-bridge.json.gz",
  "docs/proof/artifacts/desen-app-0.1.0-t01c-historical-reader-bridge.json.gz",
  "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz",
  "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
]);
const GENERATOR_PATHS = Object.freeze([
  "scripts/generate-desen-app-t01b-historical-reader-bridge.mjs",
  "scripts/generate-desen-app-t01c-historical-reader-bridge.mjs",
  "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
  "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
]);
const IMPLEMENTATION_PATHS = Object.freeze([
  "scripts/lib/historical-archive-redaction.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-historical-archive-redaction-proof.mjs",
  "scripts/verify-historical-archive-redaction.mjs",
]);
const DRAFT_HEADING =
  /^#{1,6}[^\n]*(?:public build-log drafts|(?:private )?social(?: media)? drafts|(?:LinkedIn|X) [—–] (?:EN|draft))/imu;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const TYPED_ARRAY_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length").get;
const TYPED_ARRAY_SET = Uint8Array.prototype.set;

/** Exact admitted archive transports; original compressed identities are provenance only. */
export const HISTORICAL_ARCHIVE_REDACTION_PATHS = ARCHIVE_PATHS;

/** Stable independent cases for the privacy amendment, separate from product milestones. */
export const HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] distinguishes sanitized transport from unavailable original archive bytes",
  "[preservation] preserves all 57 frozen artifacts and the 70-checkpoint historical prefix",
  "[privacy] recursively checks sanitized documentation without emitting decoded content",
  "[policy] rejects archive, nested transport, technical-file, generator, and history drift",
  "[inputs] captures mutable inputs before asynchronous reads and rejects hostile options",
  "[freshness] rereads each authority and rejects same-size drift without cached success",
  "[filesystem] rejects non-regular paths, symlinks, hard links, and acquisition races",
  "[artifact] binds exact canonical evidence and an explicitly scoped technical report",
  "[writer] atomically writes detached evidence and rejects unsafe or frozen destinations",
]);

/** Frozen AR-01 evidence identity; proof library and root test are checkpoint-owned. */
export const HISTORICAL_ARCHIVE_REDACTION_ARTIFACT_PIN = Object.freeze({
  bytes: 33_070,
  sha256: "d0e40a1cabfa241a3232bde4c169836c18ebf6c76bebe3e5733ca02771fd5dcc",
});

/** Controlled failure that never embeds archive contents or historical social copy. */
export class HistoricalArchiveRedactionProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HistoricalArchiveRedactionProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new HistoricalArchiveRedactionProofError(code, message, details);
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) freeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function optionsRecord(raw, allowed) {
  if (raw === undefined) return {};
  if (
    raw === null ||
    typeof raw !== "object" ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert own-data record.");
  }
  const result = {};
  for (const key of Reflect.ownKeys(raw)) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!allowed.includes(key) || !descriptor?.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", "Options contain an unknown or executable field.");
    }
    result[key] = descriptor.value;
  }
  return result;
}

function captureBytes(value) {
  if (
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value) ||
    ![Buffer.prototype, Uint8Array.prototype].includes(Object.getPrototypeOf(value))
  ) {
    fail("OPTIONS_INVALID", "A bounded non-shared byte array is required.");
  }
  try {
    const length = Reflect.apply(TYPED_ARRAY_LENGTH, value, []);
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER, value, []);
    if (length > MAX_FILE_BYTES || utilTypes.isSharedArrayBuffer(buffer))
      fail("OPTIONS_INVALID", "A bounded non-shared byte array is required.");
    const copied = Buffer.alloc(length);
    Reflect.apply(TYPED_ARRAY_SET, copied, [value]);
    return copied;
  } catch (error) {
    if (error instanceof HistoricalArchiveRedactionProofError) throw error;
    fail("OPTIONS_INVALID", "Byte authority could not be captured.");
  }
}

function textPath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    value.includes("\0")
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded path.`);
  }
  return path.resolve(value);
}

function buildOptions(raw) {
  const captured = optionsRecord(raw, ["workspaceRoot", "fileOverrides", "beforeAuthorityOpen"]);
  const workspaceRoot = textPath(captured.workspaceRoot ?? WORKSPACE_ROOT, "workspaceRoot");
  if (
    captured.beforeAuthorityOpen !== undefined &&
    (typeof captured.beforeAuthorityOpen !== "function" ||
      utilTypes.isProxy(captured.beforeAuthorityOpen))
  ) {
    fail("OPTIONS_INVALID", "beforeAuthorityOpen must be one callable test hook.");
  }
  const fileOverrides = new Map();
  if (captured.fileOverrides !== undefined) {
    const input = captured.fileOverrides;
    if (
      utilTypes.isProxy(input) ||
      !(input instanceof Map) ||
      Object.getPrototypeOf(input) !== Map.prototype ||
      Reflect.ownKeys(input).length !== 0 ||
      input.size > 80
    ) {
      fail("OPTIONS_INVALID", "fileOverrides must be one bounded inert Map.");
    }
    let total = 0;
    for (const [relativePath, value] of Map.prototype.entries.call(input)) {
      if (
        typeof relativePath !== "string" ||
        relativePath.includes("\\") ||
        relativePath.startsWith("/") ||
        relativePath.split("/").some((part) => part === "" || part === "." || part === "..")
      ) {
        fail("OPTIONS_INVALID", "fileOverrides contains an unsafe path.");
      }
      const bytes = captureBytes(value);
      total += bytes.byteLength;
      if (total > MAX_OVERRIDE_BYTES)
        fail("OPTIONS_INVALID", "fileOverrides exceeds its aggregate byte bound.");
      fileOverrides.set(relativePath, bytes);
    }
  }
  return { workspaceRoot, fileOverrides, beforeAuthorityOpen: captured.beforeAuthorityOpen };
}

function sameFile(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    left.nlink === 1 &&
    right.nlink === 1 &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

async function readAuthority(absolutePath, label, beforeAuthorityOpen) {
  let handle;
  try {
    const parent = path.dirname(absolutePath);
    if ((await realpath(parent)) !== parent)
      fail("AUTHORITY_UNSAFE", "Authority parent must be canonical.", { path: label });
    const before = await lstat(absolutePath);
    if (!before.isFile() || before.nlink !== 1 || before.size > MAX_FILE_BYTES)
      fail("AUTHORITY_UNSAFE", "Authority must be one bounded unaliased regular file.", {
        path: label,
      });
    await beforeAuthorityOpen?.(Object.freeze({ path: label, absolutePath }));
    handle = await open(absolutePath, FLAGS);
    const opened = await handle.stat();
    if (!sameFile(before, opened))
      fail("AUTHORITY_UNSAFE", "Authority identity changed before open.", { path: label });
    const buffer = Buffer.alloc(opened.size + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.byteLength - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (
      offset !== opened.size ||
      !sameFile(opened, after) ||
      !sameFile(after, await lstat(absolutePath)) ||
      (await realpath(parent)) !== parent
    ) {
      fail("AUTHORITY_UNSAFE", "Authority changed while being read.", { path: label });
    }
    return Buffer.from(buffer.subarray(0, offset));
  } catch (error) {
    if (error instanceof HistoricalArchiveRedactionProofError) throw error;
    fail("AUTHORITY_UNSAFE", "Authority could not be read safely.", { path: label });
  } finally {
    await handle?.close();
  }
}

function receipt(relativePath, bytes) {
  return { path: relativePath, bytes: bytes.byteLength, sha256: digest(bytes) };
}

function assertReceipt(expected, bytes, code = "AUTHORITY_DRIFT") {
  if (bytes.byteLength !== expected.bytes || digest(bytes) !== expected.sha256) {
    fail(code, "Authority bytes differ from their reviewed identity.", { path: expected.path });
  }
}

function assertNoDraftHeadings(files) {
  let documents = 0;
  for (const [relativePath, bytes] of files) {
    if (!relativePath.endsWith(".md")) continue;
    documents += 1;
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      fail("PRIVACY_DRIFT", "Archived documentation is not valid UTF-8.", { path: relativePath });
    }
    if (DRAFT_HEADING.test(text))
      fail("PRIVACY_DRIFT", "An archived social-draft section remains.", { path: relativePath });
  }
  return documents;
}

/** Builds fresh metadata-only privacy evidence without starting product code or old proof readers. */
export async function buildHistoricalArchiveRedactionEvidence(rawOptions) {
  const options = buildOptions(rawOptions);
  const root = await realpath(options.workspaceRoot);
  const used = new Set();
  const read = async (relativePath) => {
    used.add(relativePath);
    const overridden = options.fileOverrides.get(relativePath);
    return overridden === undefined
      ? readAuthority(path.join(root, relativePath), relativePath, options.beforeAuthorityOpen)
      : Buffer.from(overridden);
  };
  let checkpoint;
  try {
    checkpoint = validateProofReaderCheckpointBytes(await read(CHECKPOINT_PATH));
  } catch (error) {
    if (error instanceof HistoricalArchiveRedactionProofError) throw error;
    fail("HISTORY_DRIFT", "The reviewed checkpoint history is not intact.");
  }
  const historicalHead = checkpoint.checkpoints[HISTORY_LENGTH - 1];
  if (
    !historicalHead ||
    calculateProofReaderCheckpointSha256(historicalHead) !== HISTORY_HEAD ||
    historicalHead.artifacts.length !== HISTORICAL_ARTIFACT_COUNT
  ) {
    fail("HISTORY_DRIFT", "The exact 70-checkpoint, 57-artifact historical boundary drifted.");
  }
  const frozenArtifacts = [];
  for (const expected of historicalHead.artifacts) {
    const bytes = await read(expected.path);
    assertReceipt(expected, bytes, "FROZEN_ARTIFACT_DRIFT");
    frozenArtifacts.push({ ...expected });
  }
  const archives = [];
  let documentationFilesChecked = 0;
  if (
    JSON.stringify(ARCHIVE_REDACTION_PINS.map((pin) => pin.path)) !== JSON.stringify(ARCHIVE_PATHS)
  )
    fail("ARCHIVE_DRIFT", "The code-owned archive inventory differs from AR-01.");
  for (const relativePath of ARCHIVE_PATHS) {
    const bytes = await read(relativePath);
    let inspected;
    try {
      inspected = inspectHistoricalArchiveRedaction(relativePath, bytes);
    } catch {
      fail("ARCHIVE_DRIFT", "A sanitized archive or its nested technical authority drifted.", {
        path: relativePath,
      });
    }
    const pin = getHistoricalArchiveRedactionPin(relativePath);
    assertReceipt(pin.current, bytes, "ARCHIVE_DRIFT");
    if (inspected.technicalAuthoritySha256 !== pin.technicalAuthoritySha256)
      fail(
        "ARCHIVE_DRIFT",
        "The preserved technical authority differs from its original reviewed projection.",
      );
    if (!(inspected.decodedFiles instanceof Map))
      fail(
        "ARCHIVE_DRIFT",
        "Archive inspection did not return its private decoded-file authority.",
      );
    documentationFilesChecked += assertNoDraftHeadings(inspected.decodedFiles);
    archives.push({
      path: relativePath,
      historical: { ...inspected.historical },
      current: { ...inspected.current },
      technicalAuthoritySha256: inspected.technicalAuthoritySha256,
      preservedFileCount: pin.preservedFileCount,
      ...(inspected.sanitizedTaskBoard === undefined
        ? {}
        : { sanitizedTaskBoard: { ...inspected.sanitizedTaskBoard } }),
      nestedTransportReceipts: inspected.nestedTransportReceipts.map((entry) => ({ ...entry })),
    });
  }
  const generators = [];
  for (const relativePath of GENERATOR_PATHS) {
    const bytes = await read(relativePath);
    const expected = GENERATOR_REDACTION_RECEIPTS.find(
      (entry) => entry.current.path === relativePath,
    );
    if (!expected)
      fail("GENERATOR_DRIFT", "The safe generator inventory is incomplete.", {
        path: relativePath,
      });
    assertReceipt(expected.current, bytes, "GENERATOR_DRIFT");
    generators.push({
      path: relativePath,
      historical: { ...expected.historical },
      current: { ...expected.current },
    });
  }
  const implementation = [];
  for (const relativePath of IMPLEMENTATION_PATHS)
    implementation.push(receipt(relativePath, await read(relativePath)));
  for (const relativePath of options.fileOverrides.keys()) {
    if (!used.has(relativePath))
      fail("OPTIONS_INVALID", "fileOverrides contains a path outside AR-01 authority.", {
        path: relativePath,
      });
  }
  const artifact = freeze({
    schemaVersion: 1,
    proofId: "historical-archive-redaction",
    profile: "desen.proof.historical-archive-redaction.v1",
    task: "AR-01",
    result: "PASS",
    authority: {
      archives,
      generators,
      implementation,
      preservedHistory: {
        throughSequence: HISTORY_LENGTH,
        headSha256: HISTORY_HEAD,
        frozenArtifactCount: HISTORICAL_ARTIFACT_COUNT,
        frozenArtifacts,
      },
    },
    privacy: {
      currentArchiveCount: archives.length,
      documentationFilesChecked,
      decodedContentsEmitted: false,
      removedContentReconstructed: false,
      historicalArchiveBytesClaimedCurrent: false,
    },
    tests: { rootTestNames: [...HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES] },
    boundary: {
      operationalOnly: true,
      technicalAuthorityPreserved: true,
      productBehaviorChanged: false,
      gitHistoryRewritten: false,
      oldProofReadersInvoked: false,
      browserExecutedByVerifier: false,
      cachedProofSuccessUsed: false,
      implementationTaskCountChanged: false,
      m10T05Started: false,
    },
    nonClaims: [
      "Original compressed archives are historical identities, not current or reconstructed bytes.",
      "Git history, existing clones, and previously published copies are not erased.",
      "This amendment does not prove a new product milestone or execute Chromium.",
      "Hosted completion requires fresh Quality gate success for the exact current PR head.",
    ],
  });
  const artifactBytes = Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
  return Object.freeze({ artifact, artifactBytes, artifactSha256: digest(artifactBytes) });
}

/** Verifies exact fresh amendment evidence and a report that preserves its nonclaims. */
export async function verifyHistoricalArchiveRedactionEvidence(rawOptions) {
  const options = optionsRecord(rawOptions, [
    "artifactBytes",
    "artifactPath",
    "proofDocumentBytes",
    "proofDocumentPath",
    "buildOptions",
  ]);
  if (
    (options.artifactBytes !== undefined && options.artifactPath !== undefined) ||
    (options.proofDocumentBytes !== undefined && options.proofDocumentPath !== undefined)
  )
    fail("OPTIONS_INVALID", "Choose bytes or a path, never both.");
  const suppliedArtifact =
    options.artifactBytes === undefined ? undefined : captureBytes(options.artifactBytes);
  const suppliedReport =
    options.proofDocumentBytes === undefined ? undefined : captureBytes(options.proofDocumentBytes);
  const capturedBuild = buildOptions(options.buildOptions);
  const root = await realpath(capturedBuild.workspaceRoot);
  const artifactPath = textPath(
    options.artifactPath ?? path.join(root, ARTIFACT_PATH),
    "artifactPath",
  );
  const reportPath = textPath(
    options.proofDocumentPath ?? path.join(root, REPORT_PATH),
    "proofDocumentPath",
  );
  const built = await buildHistoricalArchiveRedactionEvidence(capturedBuild);
  const bytes = suppliedArtifact ?? (await readAuthority(artifactPath, ARTIFACT_PATH));
  assertReceipt(
    { path: ARTIFACT_PATH, ...HISTORICAL_ARCHIVE_REDACTION_ARTIFACT_PIN },
    bytes,
    "ARTIFACT_DRIFT",
  );
  if (!built.artifactBytes.equals(bytes))
    fail("ARTIFACT_DRIFT", "Fresh amendment evidence differs from the frozen artifact.");
  const reportBytes = suppliedReport ?? (await readAuthority(reportPath, REPORT_PATH));
  let report;
  try {
    report = new TextDecoder("utf-8", { fatal: true }).decode(reportBytes);
  } catch {
    fail("REPORT_DRIFT", "The technical report must be valid UTF-8.");
  }
  for (const marker of [
    "Task: AR-01",
    "Git history is not rewritten",
    "Original compressed archives are not reconstructed",
    `Final artifact: \`sha256:${built.artifactSha256}\``,
  ]) {
    if (!report.includes(marker))
      fail("REPORT_DRIFT", "The technical report omits a required scope or identity marker.");
  }
  if (DRAFT_HEADING.test(report))
    fail("REPORT_DRIFT", "The public report contains a social-draft section.");
  return freeze({
    task: "AR-01",
    proofId: "historical-archive-redaction",
    result: "PASS",
    artifactBytes: bytes.byteLength,
    artifactSha256: built.artifactSha256,
    sanitizedArchives: ARCHIVE_PATHS.length,
    preservedFrozenArtifacts: HISTORICAL_ARTIFACT_COUNT,
    preservedCheckpoints: HISTORY_LENGTH,
    rootTests: HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES.length,
    decodedContentsEmitted: false,
    gitHistoryRewritten: false,
  });
}

/** Writes a detached amendment artifact atomically; tracked evidence is never silently replaced. */
export async function writeHistoricalArchiveRedactionEvidence(rawOptions) {
  const options = optionsRecord(rawOptions, ["artifactPath", "buildOptions", "beforeAtomicRename"]);
  const artifactPath = textPath(
    options.artifactPath ?? path.join(WORKSPACE_ROOT, ARTIFACT_PATH),
    "artifactPath",
  );
  const capturedBuild = buildOptions(options.buildOptions);
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  )
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one callable test hook.");
  try {
    const assertDestination = async () => {
      const parent = await realpath(path.dirname(artifactPath));
      if (parent !== path.dirname(artifactPath))
        fail("ARTIFACT_WRITE_UNSAFE", "Artifact parent must be canonical.");
      let existing;
      try {
        existing = await lstat(artifactPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (existing && (!existing.isFile() || existing.nlink !== 1))
        fail("ARTIFACT_WRITE_UNSAFE", "Artifact destination must be one unaliased regular file.");
      if (existing && artifactPath.startsWith(`${WORKSPACE_ROOT}${path.sep}`))
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to replace an existing workspace authority.");
    };
    await assertDestination();
    const built = await buildHistoricalArchiveRedactionEvidence(capturedBuild);
    await assertDestination();
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: async (context) => {
        await options.beforeAtomicRename?.(context);
        await assertDestination();
      },
    });
    return freeze({
      artifactPath,
      artifactBytes: built.artifactBytes.byteLength,
      artifactSha256: built.artifactSha256,
    });
  } catch (error) {
    if (error instanceof HistoricalArchiveRedactionProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "The amendment artifact could not be written safely.");
  }
}
