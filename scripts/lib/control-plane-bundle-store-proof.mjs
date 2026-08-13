import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_PROOF_DOCUMENT_BYTES = 1_000_000;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;
const TYPED_ARRAY_BYTE_OFFSET = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

/**
 * Creates a reader for one immutable, reviewed control-plane proof artifact.
 *
 * Historical proof readers deliberately authenticate the central reader checkpoint and the
 * committed artifact itself. They never reconstruct old receipts from the current worktree.
 */
export function createImmutableControlPlaneProofReader(descriptor) {
  const defaultArtifactPath = path.join(ROOT, descriptor.artifactRelativePath);
  const defaultProofPath = path.join(ROOT, descriptor.proofDocumentRelativePath);

  function fail(code, message, details = {}) {
    throw new descriptor.ErrorType(code, message, details);
  }

  function captureOptions(value, allowedKeys, label) {
    if (value === undefined) return Object.freeze({});
    if (
      value === null ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      fail("INVALID_OPTIONS", `${label} must be one ordinary own-data record.`);
    }
    const captured = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        !allowedKeys.includes(key) ||
        property === undefined ||
        !property.enumerable ||
        !("value" in property)
      ) {
        fail("INVALID_OPTIONS", `${label} contains an unsupported or active field.`);
      }
      captured[key] = property.value;
    }
    return Object.freeze(captured);
  }

  function capturePath(value, label) {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
      fail("INVALID_OPTIONS", `${label} must be a nonempty primitive path string.`);
    }
    return value;
  }

  function captureBytes(value, label) {
    if (value === undefined) return undefined;
    if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
      fail("INVALID_OPTIONS", `${label} must be an independently owned Uint8Array.`);
    }
    try {
      const buffer = Reflect.apply(TYPED_ARRAY_BUFFER, value, []);
      const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET, value, []);
      const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH, value, []);
      if (utilTypes.isSharedArrayBuffer(buffer)) {
        fail("INVALID_OPTIONS", `${label} must not use shared memory.`);
      }
      const captured = new Uint8Array(byteLength);
      captured.set(new Uint8Array(buffer, byteOffset, byteLength));
      return captured;
    } catch (error) {
      if (error instanceof descriptor.ErrorType) throw error;
      fail("INVALID_OPTIONS", `${label} must be an attached Uint8Array.`);
    }
  }

  function sameDirectoryIdentity(left, right) {
    return (
      left.dev === right.dev &&
      left.ino === right.ino &&
      left.mode === right.mode &&
      left.nlink === right.nlink &&
      left.size === right.size
    );
  }

  async function openCanonicalDirectory(directoryPath, code, label) {
    let before;
    let canonical;
    let handle;
    try {
      before = await lstat(directoryPath);
      canonical = await realpath(directoryPath);
      if (!before.isDirectory() || before.isSymbolicLink() || canonical !== directoryPath) {
        fail(code, `${label} must be one canonical non-symbolic directory.`);
      }
      handle = await open(directoryPath, DIRECTORY_READ_FLAGS);
      const opened = await handle.stat();
      if (!opened.isDirectory() || !sameDirectoryIdentity(before, opened)) {
        fail(code, `${label} changed identity while opening.`);
      }
      return { path: directoryPath, handle, opened, label };
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if (error instanceof descriptor.ErrorType) throw error;
      fail(code, `${label} could not be opened safely.`);
    }
  }

  async function assertCanonicalDirectoryUnchanged(capture, code) {
    let handleAfter;
    let namedAfter;
    let canonicalAfter;
    try {
      [handleAfter, namedAfter, canonicalAfter] = await Promise.all([
        capture.handle.stat(),
        lstat(capture.path),
        realpath(capture.path),
      ]);
    } catch {
      fail(code, `${capture.label} became unavailable during the authority read.`);
    }
    if (
      !handleAfter.isDirectory() ||
      !sameDirectoryIdentity(capture.opened, handleAfter) ||
      !namedAfter.isDirectory() ||
      namedAfter.isSymbolicLink() ||
      !sameDirectoryIdentity(capture.opened, namedAfter) ||
      canonicalAfter !== capture.path
    ) {
      fail(code, `${capture.label} changed identity or canonicality during the authority read.`);
    }
  }

  async function readRegularFile(filePath, maximumBytes, code) {
    const absolute = path.resolve(filePath);
    const defaultRelative = path.relative(ROOT, absolute);
    const defaultIsInsideRoot =
      defaultRelative !== "" &&
      defaultRelative !== ".." &&
      !defaultRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(defaultRelative);
    if (
      descriptor.authorityRoot !== undefined &&
      (typeof descriptor.authorityRoot !== "string" ||
        descriptor.authorityRoot.length === 0 ||
        descriptor.authorityRoot.includes("\0"))
    ) {
      fail(code, "The immutable evidence root must be a primitive nonempty path string.");
    }
    const authorityRoot = path.resolve(
      descriptor.authorityRoot ?? (defaultIsInsideRoot ? ROOT : path.dirname(absolute)),
    );
    const authorityRelative = path.relative(authorityRoot, absolute);
    if (
      authorityRelative === "" ||
      authorityRelative === ".." ||
      authorityRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(authorityRelative)
    ) {
      fail(code, "The immutable evidence path escaped its authority root.");
    }
    let rootCapture;
    let parentCapture;
    let before;
    let handle;
    try {
      rootCapture = await openCanonicalDirectory(authorityRoot, code, "Immutable evidence root");
      parentCapture = await openCanonicalDirectory(
        path.dirname(absolute),
        code,
        "Immutable evidence parent",
      );
      before = await lstat(absolute);
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.nlink !== 1 ||
        before.size > maximumBytes
      ) {
        fail(code, "Immutable evidence must be one bounded regular non-symbolic file.");
      }
      // Construction-time hostile-filesystem tests can replace the name at this exact boundary;
      // the code-owned readers never provide this hook and every replacement must still fail the
      // descriptor/handle identity checks below.
      await descriptor.beforeAuthorityOpen?.({ filePath: absolute, code });
      handle = await open(absolute, READ_FLAGS);
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.nlink !== 1 ||
        opened.size !== before.size ||
        opened.mode !== before.mode
      ) {
        fail(code, "Immutable evidence changed identity while opening.");
      }
      const capacity = Math.min(opened.size, maximumBytes) + 1;
      const bounded = Buffer.alloc(capacity);
      let offset = 0;
      while (offset < capacity) {
        const { bytesRead } = await handle.read(bounded, offset, capacity - offset, null);
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset > maximumBytes) {
        fail(code, "Immutable evidence exceeded its byte budget while reading.");
      }
      const bytes = bounded.subarray(0, offset);
      const handleAfter = await handle.stat();
      const namedAfter = await lstat(absolute);
      if (
        !handleAfter.isFile() ||
        handleAfter.dev !== opened.dev ||
        handleAfter.ino !== opened.ino ||
        handleAfter.nlink !== 1 ||
        handleAfter.size !== opened.size ||
        handleAfter.mode !== opened.mode ||
        handleAfter.size !== bytes.byteLength ||
        !namedAfter.isFile() ||
        namedAfter.isSymbolicLink() ||
        namedAfter.dev !== opened.dev ||
        namedAfter.ino !== opened.ino ||
        namedAfter.nlink !== 1 ||
        namedAfter.size !== opened.size ||
        namedAfter.mode !== opened.mode
      ) {
        fail(code, "Immutable evidence changed identity or size while reading.");
      }
      await assertCanonicalDirectoryUnchanged(parentCapture, code);
      await assertCanonicalDirectoryUnchanged(rootCapture, code);
      return Uint8Array.from(bytes);
    } catch (error) {
      if (error instanceof descriptor.ErrorType) throw error;
      fail(code, "Immutable evidence could not be read safely.");
    } finally {
      await handle?.close().catch(() => undefined);
      await parentCapture?.handle.close().catch(() => undefined);
      await rootCapture?.handle.close().catch(() => undefined);
    }
  }

  function exactEvidenceRows(rows, expectedLength) {
    return (
      Array.isArray(rows) &&
      rows.length === expectedLength &&
      new Set(rows.map((row) => row?.path)).size === rows.length &&
      rows.every(
        (row) =>
          row !== null &&
          typeof row === "object" &&
          isDeepStrictEqual(Object.keys(row), ["path", "bytes", "sha256"]) &&
          typeof row.path === "string" &&
          row.path.length > 0 &&
          Number.isSafeInteger(row.bytes) &&
          row.bytes >= 0 &&
          typeof row.sha256 === "string" &&
          /^[0-9a-f]{64}$/u.test(row.sha256),
      )
    );
  }

  function inspectArtifact(bytes, authority) {
    const actualSha256 = digest(bytes);
    if (bytes.byteLength !== authority.byteLength || actualSha256 !== authority.sha256) {
      fail("ARTIFACT_DRIFT", `Immutable ${descriptor.task} task-time artifact bytes changed.`, {
        expectedBytes: authority.byteLength,
        actualBytes: bytes.byteLength,
        expectedSha256: authority.sha256,
        actualSha256,
      });
    }
    let artifact;
    try {
      artifact = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      fail(
        "ARTIFACT_SEMANTIC_DRIFT",
        `Immutable ${descriptor.task} artifact is not valid UTF-8 JSON.`,
      );
    }
    const testsMatch = Object.entries(descriptor.testCounts).every(
      ([name, count]) => artifact.tests?.[name] === count,
    );
    const namedCountsMatch = [
      ["packageRuntimeCases", "packageRuntimeCaseNames"],
      ["packageGuardCases", "packageGuardCaseNames"],
      ["compileTimeNegativeCases", "compileTimeNegativeClaims"],
      ["rootMutationCases", "rootMutationCaseNames"],
    ].every(
      ([countName, namesName]) =>
        artifact.tests?.[countName] === undefined ||
        artifact.tests?.[namesName] === undefined ||
        (Array.isArray(artifact.tests[namesName]) &&
          artifact.tests[namesName].length === artifact.tests[countName]),
    );
    if (
      !isDeepStrictEqual(Object.keys(artifact), descriptor.rootKeys) ||
      artifact.schemaVersion !== 1 ||
      artifact.task !== descriptor.task ||
      artifact.result !== "PASS" ||
      artifact.profile !== descriptor.profile ||
      (descriptor.proofId !== undefined && artifact.proofId !== descriptor.proofId) ||
      !isDeepStrictEqual(Object.keys(artifact.claims ?? {}), descriptor.claimKeys) ||
      !exactEvidenceRows(artifact.trackedFiles, descriptor.trackedFiles) ||
      !exactEvidenceRows(artifact.distribution, descriptor.distributionFiles) ||
      !Array.isArray(artifact.prerequisites) ||
      artifact.prerequisites.length !== descriptor.prerequisites ||
      artifact.prerequisites.some(
        (entry) =>
          typeof entry?.sha256 !== "string" ||
          !/^[0-9a-f]{64}$/u.test(entry.sha256) ||
          entry.sha256 !== entry.verifiedSha256,
      ) ||
      (descriptor.fixtures !== undefined &&
        (!Array.isArray(artifact.fixtures) || artifact.fixtures.length !== descriptor.fixtures)) ||
      !testsMatch ||
      !namedCountsMatch ||
      !Array.isArray(artifact.nonclaims) ||
      artifact.nonclaims.length !== descriptor.nonclaims ||
      !Array.isArray(artifact.reproduction) ||
      artifact.reproduction.length !== descriptor.reproduction
    ) {
      fail(
        "ARTIFACT_SEMANTIC_DRIFT",
        `Immutable ${descriptor.task} artifact lost reviewed semantics.`,
      );
    }
    return freezeJson(artifact);
  }

  function proofHasExactPin(proofDocument, artifactSha256) {
    const artifactMentions = proofDocument.split(descriptor.artifactRelativePath).length - 1;
    const hashMentions = proofDocument.split(`sha256:${artifactSha256}`).length - 1;
    return artifactMentions === 1 && hashMentions === 1;
  }

  async function build(rawOptions = undefined) {
    const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build options");
    const artifactPath = capturePath(options.artifactPath, "artifactPath");
    const injectedBytes = captureBytes(options.artifactBytes, "artifactBytes");
    if (artifactPath !== undefined && injectedBytes !== undefined) {
      fail("INVALID_OPTIONS", "Specify artifactPath or artifactBytes, not both.");
    }
    const authority = await readCheckpointedFrozenArtifact(descriptor.task);
    if (authority.path !== descriptor.artifactRelativePath) {
      fail("ARTIFACT_IDENTITY_DRIFT", `Checkpoint artifact path changed for ${descriptor.task}.`);
    }
    const artifactBytes =
      injectedBytes ??
      (artifactPath === undefined
        ? authority.bytes
        : await readRegularFile(artifactPath, authority.byteLength, "ARTIFACT_UNSAFE"));
    const artifact = inspectArtifact(artifactBytes, authority);
    return Object.freeze({
      artifact,
      artifactBytes: Buffer.from(artifactBytes),
      artifactSha256: authority.sha256,
      checkpointHeadSha256: authority.checkpointHeadSha256,
    });
  }

  async function verify(rawOptions = undefined) {
    const options = captureOptions(
      rawOptions,
      ["artifactPath", "artifactBytes", "proofDocument", "proofPath"],
      "verify options",
    );
    const proofPath = capturePath(options.proofPath, "proofPath");
    if (options.proofDocument !== undefined && typeof options.proofDocument !== "string") {
      fail("INVALID_OPTIONS", "proofDocument must be a primitive string.");
    }
    if (options.proofDocument !== undefined && proofPath !== undefined) {
      fail("INVALID_OPTIONS", "Specify proofDocument or proofPath, not both.");
    }
    const built = await build({
      ...(options.artifactPath === undefined ? {} : { artifactPath: options.artifactPath }),
      ...(options.artifactBytes === undefined ? {} : { artifactBytes: options.artifactBytes }),
    });
    let proofDocument = options.proofDocument;
    if (proofDocument === undefined) {
      try {
        proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(
          await readRegularFile(
            proofPath ?? defaultProofPath,
            MAX_PROOF_DOCUMENT_BYTES,
            "PROOF_DOCUMENT_UNSAFE",
          ),
        );
      } catch (error) {
        if (error instanceof descriptor.ErrorType) throw error;
        fail("PROOF_DOCUMENT_UNSAFE", "The proof document is not valid UTF-8 text.");
      }
    }
    if (!proofHasExactPin(proofDocument, built.artifactSha256)) {
      fail(
        "PROOF_DOCUMENT_DRIFT",
        `The ${descriptor.task} proof must contain one exact immutable artifact pin.`,
      );
    }
    return Object.freeze({
      result: "PASS",
      task: descriptor.task,
      artifactSha256: built.artifactSha256,
      artifactBytes: built.artifactBytes.byteLength,
      compatibilityMode: "immutable-task-time-artifact",
      trackedFiles: built.artifact.trackedFiles.length,
      distributionFiles: built.artifact.distribution.length,
      rootMutationCases: built.artifact.tests.rootMutationCases,
    });
  }

  async function write(rawOptions = undefined) {
    const options = captureOptions(
      rawOptions,
      ["artifactPath", "artifactBytes", "destinationPath", "beforeAtomicRename"],
      "write options",
    );
    const destinationPath = capturePath(options.destinationPath, "destinationPath");
    if (
      options.beforeAtomicRename !== undefined &&
      (typeof options.beforeAtomicRename !== "function" ||
        utilTypes.isProxy(options.beforeAtomicRename))
    ) {
      fail("INVALID_OPTIONS", "beforeAtomicRename must be a non-Proxy function.");
    }
    const built = await build({
      ...(options.artifactPath === undefined ? {} : { artifactPath: options.artifactPath }),
      ...(options.artifactBytes === undefined ? {} : { artifactBytes: options.artifactBytes }),
    });
    const resolvedDestination = path.resolve(destinationPath ?? defaultArtifactPath);
    if (resolvedDestination !== path.resolve(defaultArtifactPath)) {
      try {
        await writeAtomicProofArtifact({
          artifactPath: resolvedDestination,
          artifactBytes: built.artifactBytes,
          beforeAtomicRename: options.beforeAtomicRename,
        });
      } catch (error) {
        fail("ARTIFACT_WRITE_FAILURE", `Immutable ${descriptor.task} artifact copy failed.`, {
          cause: String(error),
        });
      }
    }
    return Object.freeze({
      artifactPath: resolvedDestination,
      artifactSha256: built.artifactSha256,
      artifactBytes: built.artifactBytes.byteLength,
    });
  }

  return Object.freeze({ defaultArtifactPath, build, verify, write });
}

export class ControlPlaneBundleStoreEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneBundleStoreEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const READER = createImmutableControlPlaneProofReader({
  ErrorType: ControlPlaneBundleStoreEvidenceError,
  artifactRelativePath: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
  proofDocumentRelativePath: "docs/proof/CONTROL-PLANE-BUNDLE-STORE.md",
  task: "M07-T01",
  profile: "desen.control-plane.bundle-store-proof.v1",
  rootKeys: [
    "schemaVersion",
    "profile",
    "task",
    "result",
    "summary",
    "prerequisites",
    "claims",
    "trackedFiles",
    "distribution",
    "tests",
    "nonclaims",
    "reproduction",
  ],
  claimKeys: [
    "officialBundle",
    "address",
    "publicBoundary",
    "immutableWrite",
    "publicationProjectionBoundary",
    "concurrency",
    "readIsolation",
    "historicalCompatibility",
    "registrations",
    "traceRows",
  ],
  trackedFiles: 24,
  distributionFiles: 16,
  prerequisites: 4,
  testCounts: {
    packageRuntimeCases: 18,
    compileTimeNegativeCases: 4,
    rootMutationCases: 16,
  },
  nonclaims: 7,
  reproduction: 7,
});

export const DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH = READER.defaultArtifactPath;

export const buildControlPlaneBundleStoreEvidence = READER.build;
export const verifyControlPlaneBundleStoreEvidence = READER.verify;
export const writeControlPlaneBundleStoreEvidence = READER.write;
