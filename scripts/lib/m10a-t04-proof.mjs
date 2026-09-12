import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { format } from "prettier";

import * as releasePackage from "../../packages/design-system-release/dist/index.js";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t04.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/M10A-T04.md";
const ARTIFACT_LIMIT = 16 * 1_024 * 1_024;
const PROOF_DOCUMENT_LIMIT = 256 * 1_024;
const PENDING_PROOF_STATUS =
  "**Status:** implementation evidence passes locally; exact-head hosted closure is pending. This\nreport does not start M10A-T05, add runtime activation, or advance G10A.";
const CLOSED_PROOF_STATUS =
  "**Status:** DONE. Exact-head hosted Quality gate and fresh-main closure are recorded below.";
const PENDING_HOSTED_RECEIPT =
  "- Exact-head hosted Quality gate and fresh-main evidence: pending; no hosted receipt is claimed.";
const CLOSED_HOSTED_RECEIPT =
  /^- Exact-head hosted Quality gate and fresh-main evidence: \[PR #\d+\]\(https:\/\/github\.com\/desenlab\/desen-app\/pull\/\d+\) exact head `[0-9a-f]{40}` passed \[Quality gate\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/\d+\/job\/\d+\); squash-merged as \[`[0-9a-f]{40}`\]\(https:\/\/github\.com\/desenlab\/desen-app\/commit\/[0-9a-f]{40}\), and \[fresh-`main`\]\(https:\/\/github\.com\/desenlab\/desen-app\/actions\/runs\/\d+\) passed\.$/mu;

export const M10A_T04_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T04 builds a deterministic detached release through the built public package",
  "M10A-T04 captures immutable token asset and recipe snapshots",
  "M10A-T04 changes release identity when a production dependency changes",
  "M10A-T04 rejects missing tampered and invalid dependencies",
  "M10A-T04 resolves only an exact host-profile release reference",
  "M10A-T04 recovers an interrupted atomic store write without latest fallback",
  "M10A-T04 rejects reordered, incomplete, and metadata-bearing snapshots",
  "M10A-T04 admits only bounded inert recipe data and detached store snapshots",
  "M10A-T04 verifier rejects artifact and visible-report drift",
  "M10A-T04 writer is atomic and rejects unsafe destinations",
  "M10A-T04 authenticates its checkpointed artifact without external execution",
]);

export class M10AT04ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT04ProofError";
    this.code = `M10A_T04_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT04ProofError(code, message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function fixtureInput(assetBytes = Uint8Array.from([1, 2, 3, 4])) {
  return {
    tokenSources: [
      {
        id: "neutral.base",
        document: {
          color: {
            $type: "color",
            action: { $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] } },
          },
        },
      },
    ],
    assets: [
      {
        id: "font.inter",
        kind: "font",
        mediaType: "font/woff2",
        bytes: assetBytes,
      },
    ],
    recipes: [{ id: "button.primary", document: { capability: "button", variant: "primary" } }],
  };
}

function expectFailure(code, action) {
  try {
    action();
  } catch (error) {
    if (error instanceof releasePackage.DesignSystemReleaseError && error.code === code) return;
    throw error;
  }
  fail("NEGATIVE_CASE_MISSED", `Expected release error ${code}.`);
}

async function expectAsyncFailure(code, action) {
  try {
    await action();
  } catch (error) {
    if (error instanceof releasePackage.DesignSystemReleaseError && error.code === code) return;
    throw error;
  }
  fail("NEGATIVE_CASE_MISSED", `Expected release error ${code}.`);
}

function captureOptions(rawOptions) {
  const value = rawOptions === undefined ? {} : rawOptions;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", "Options must be one inert object.");
  }
  const allowed = new Set([
    "workspaceRoot",
    "artifactBytes",
    "proofDocumentBytes",
    "artifactPath",
    "beforeAtomicRename",
  ]);
  const captured = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key))
      fail("OPTIONS_INVALID", "Unknown proof option.");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", "Options must contain inert own data.");
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

async function canonicalWorkspaceRoot(candidate = WORKSPACE_ROOT) {
  if (
    typeof candidate !== "string" ||
    !path.isAbsolute(candidate) ||
    path.resolve(candidate) !== candidate ||
    candidate.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one canonical absolute path.");
  }
  try {
    const entry = await lstat(candidate);
    if (
      !entry.isDirectory() ||
      entry.isSymbolicLink() ||
      (await realpath(candidate)) !== candidate
    ) {
      fail("AUTHORITY_UNSAFE", "Workspace root must be one canonical directory.");
    }
  } catch (error) {
    if (error instanceof M10AT04ProofError) throw error;
    fail("AUTHORITY_UNSAFE", "Workspace root is not readable.");
  }
  return candidate;
}

function captureBuffer(value, label, limit) {
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value) || value.byteLength > limit) {
    fail("OPTIONS_INVALID", `${label} must be one bounded non-Proxy Buffer.`);
  }
  return Buffer.from(value);
}

function sameEntry(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function readRegularAuthority(workspaceRoot, relativePath, limit) {
  const target = path.join(workspaceRoot, relativePath);
  let handle;
  try {
    const before = await lstat(target, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.size > BigInt(limit)
    ) {
      throw new Error("unsafe authority");
    }
    handle = await open(target, "r");
    const [linked, handleEntry, bytes] = await Promise.all([
      lstat(target, { bigint: true }),
      handle.stat({ bigint: true }),
      handle.readFile(),
    ]);
    const [after, pathAfter] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(target, { bigint: true }),
    ]);
    if (
      !linked.isFile() ||
      linked.isSymbolicLink() ||
      linked.nlink !== 1n ||
      !sameEntry(before, linked) ||
      !sameEntry(before, handleEntry) ||
      !sameEntry(handleEntry, after) ||
      !sameEntry(after, pathAfter) ||
      bytes.byteLength > limit ||
      BigInt(bytes.byteLength) !== after.size
    ) {
      throw new Error("authority changed while read");
    }
    return bytes;
  } catch (error) {
    if (error instanceof M10AT04ProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Required authority is unavailable: ${relativePath}`);
  } finally {
    await handle?.close();
  }
}

async function serializeArtifact(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }), "utf8");
}

export async function buildM10AT04Evidence() {
  const first = releasePackage.createDesignSystemRelease(fixtureInput());
  const second = releasePackage.createDesignSystemRelease(fixtureInput());
  if (!first.ok || !second.ok || first.release.digest !== second.release.digest) {
    fail("DETERMINISM_FAILED", "Equal production inputs did not produce one release identity.");
  }
  const changed = releasePackage.createDesignSystemRelease(
    fixtureInput(Uint8Array.from([1, 2, 3, 9])),
  );
  if (!changed.ok || changed.release.digest === first.release.digest) {
    fail("IDENTITY_FAILED", "A changed production dependency did not change release identity.");
  }

  const store = releasePackage.createDesignSystemReleaseStore();
  const stored = await store.putRelease({ release: first.release });
  const unchanged = await store.putRelease({ release: first.release });
  const reference = releasePackage.createHostProfileReleaseReference({
    hostProfileId: "web-react",
    releaseDigest: first.release.digest,
  });
  const resolved = await releasePackage.readDesignSystemRelease(store, reference);
  if (
    stored.status !== "stored" ||
    unchanged.status !== "unchanged" ||
    resolved.digest !== first.release.digest
  ) {
    fail("STORE_FAILED", "Exact release-store lifecycle did not complete.");
  }

  let interrupted = true;
  const durable = releasePackage.createDesignSystemReleaseStore();
  const recoveringStore = {
    async getRelease(digest) {
      return durable.getRelease(digest);
    },
    async putRelease(entry) {
      const result = await durable.putRelease(entry);
      if (interrupted) {
        interrupted = false;
        throw new Error("simulated interruption");
      }
      return result;
    },
  };
  let interruptionObserved = false;
  try {
    await recoveringStore.putRelease({ release: first.release });
  } catch {
    interruptionObserved = true;
  }
  const recovered = await recoveringStore.putRelease({ release: first.release });
  const recoveredRelease = await releasePackage.readDesignSystemRelease(recoveringStore, reference);
  if (
    !interruptionObserved ||
    recovered.status !== "unchanged" ||
    recoveredRelease.digest !== first.release.digest
  ) {
    fail("RECOVERY_FAILED", "Interrupted write did not recover.");
  }

  expectFailure("LIMIT_EXCEEDED", () =>
    releasePackage.createDesignSystemRelease({ ...fixtureInput(), tokenSources: [] }),
  );
  expectFailure("DIGEST_MISMATCH", () =>
    releasePackage.createDesignSystemRelease({
      ...fixtureInput(),
      assets: [{ ...fixtureInput().assets[0], digest: `sha256:${"0".repeat(64)}` }],
    }),
  );
  const tampered = {
    ...first.release,
    assets: [{ ...first.release.assets[0], bytes: [9, 9, 9, 9] }, ...first.release.assets.slice(1)],
  };
  expectFailure("DIGEST_MISMATCH", () => releasePackage.verifyDesignSystemRelease(tampered));
  const ordered = releasePackage.createDesignSystemRelease({
    ...fixtureInput(),
    tokenSources: [
      ...fixtureInput().tokenSources,
      {
        id: "neutral.override",
        document: {
          color: {
            $type: "color",
            action: { $value: { colorSpace: "srgb", components: [0.4, 0.5, 0.6] } },
          },
        },
      },
    ],
    assets: [
      ...fixtureInput().assets,
      {
        id: "icon.logo",
        kind: "icon",
        mediaType: "image/svg+xml",
        bytes: Uint8Array.from([5, 6, 7, 8]),
      },
    ],
  });
  if (!ordered.ok || ordered.release.assets[0] === undefined) {
    fail("SNAPSHOT_HARDENING_FAILED", "Ordered release fixture could not be created.");
  }
  expectFailure("DIGEST_MISMATCH", () =>
    releasePackage.verifyDesignSystemRelease({
      ...ordered.release,
      tokenSources: [...ordered.release.tokenSources].reverse(),
    }),
  );
  expectFailure("DUPLICATE_DEPENDENCY_ID", () =>
    releasePackage.verifyDesignSystemRelease({
      ...ordered.release,
      assets: [ordered.release.assets[0], ordered.release.assets[0]],
    }),
  );
  expectFailure("INVALID_INPUT", () =>
    releasePackage.verifyDesignSystemRelease({
      ...first.release,
      dependencyManifest: first.release.dependencyManifest.map((dependency, index) =>
        index === 0 ? { ...dependency, unused: "hidden" } : dependency,
      ),
    }),
  );
  expectFailure("INVALID_RECIPE", () =>
    releasePackage.createDesignSystemRelease({
      ...fixtureInput(),
      recipes: [
        {
          id: "unsafe.recipe",
          document: {
            loaderPath: "/tmp/plugin.mjs",
            networkDestination: "https://example.invalid",
          },
        },
      ],
    }),
  );
  for (const key of ["access_token", "API-KEY", "loader_path", "network.destination"]) {
    expectFailure("INVALID_RECIPE", () =>
      releasePackage.createDesignSystemRelease({
        ...fixtureInput(),
        recipes: [{ id: "normalized.unsafe.recipe", document: { [key]: "forbidden" } }],
      }),
    );
  }
  for (const key of ["access_token", "API-KEY", "loader_path", "network.destination"]) {
    expectFailure("INVALID_TOKEN_SOURCE", () =>
      releasePackage.createDesignSystemRelease({
        ...fixtureInput(),
        tokenSources: [
          {
            id: "unsafe.token",
            document: {
              color: {
                $type: "color",
                $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] },
                $extensions: { [key]: "forbidden" },
              },
            },
          },
        ],
      }),
    );
  }
  expectFailure("INVALID_ASSET", () =>
    releasePackage.createDesignSystemRelease({
      ...fixtureInput(),
      assets: [
        {
          ...fixtureInput().assets[0],
          mediaType: `image/${"a".repeat(513)}`,
        },
      ],
    }),
  );
  expectFailure("INVALID_ASSET", () =>
    releasePackage.createDesignSystemRelease({
      ...fixtureInput(),
      assets: [
        {
          ...fixtureInput().assets[0],
          mediaType: "application/x-executable",
        },
      ],
    }),
  );
  const detachedStore = releasePackage.createDesignSystemReleaseStore();
  const mutableRelease = JSON.parse(JSON.stringify(first.release));
  await detachedStore.putRelease({ release: mutableRelease });
  mutableRelease.assets[0].bytes[0] = 9;
  const detachedRelease = await releasePackage.readDesignSystemRelease(detachedStore, reference);
  if (
    detachedRelease.assets[0]?.bytes[0] !== 1 ||
    !Object.isFrozen(detachedRelease) ||
    !Object.isFrozen(detachedRelease.assets[0]?.bytes)
  ) {
    fail("SNAPSHOT_HARDENING_FAILED", "Release store retained mutable caller-owned state.");
  }
  await expectAsyncFailure("RELEASE_NOT_FOUND", () =>
    releasePackage.readDesignSystemRelease(
      store,
      releasePackage.createHostProfileReleaseReference({
        hostProfileId: "web-react",
        releaseDigest: `sha256:${"f".repeat(64)}`,
      }),
    ),
  );

  const artifact = deepFreeze({
    schemaVersion: 1,
    task: "M10A-T04",
    proofId: "m10a-t04",
    profile: "desen.design-system-release.proof.v1",
    result: "PASS",
    claim: {
      detachedImmutableSnapshot: true,
      contentAddressedDigest: true,
      exactSnapshotProjection: true,
      hiddenMetadataRejected: true,
      boundedInertRecipes: true,
      exactHostProfileReference: true,
      atomicStorePort: true,
      storeDetachedSnapshots: true,
      noMutableLatestFallback: true,
      runtimeActivationDeferredToT22: true,
    },
    release: {
      digest: first.release.digest,
      changedDependencyDigest: changed.release.digest,
      dependencyCount: first.release.dependencyManifest.length,
      dependencyBytes: first.release.dependencyManifest.reduce(
        (total, item) => total + item.bytes,
        0,
      ),
      tokenSourceCount: first.release.tokenSources.length,
      assetCount: first.release.assets.length,
      recipeCount: first.release.recipes.length,
      immutable: Object.isFrozen(first.release) && Object.isFrozen(first.release.assets[0].bytes),
      exactReferenceHostProfileId: reference.hostProfileId,
      storeStatuses: [stored.status, unchanged.status, recovered.status],
      interruptedWriteRecovered:
        interruptionObserved &&
        recovered.status === "unchanged" &&
        recoveredRelease.digest === first.release.digest,
    },
    tests: {
      rootTestNames: M10A_T04_ROOT_TEST_NAMES,
      packageBehaviorRunsSeparately: true,
      verifierWritesWorkspace: false,
      verifierUsesNetwork: false,
      verifierSpawnsChildren: false,
      hostedExactHeadRequired: true,
    },
    nonClaims: [
      "T04 does not activate releases in Runtime Core or the normal App; T22 owns runtime activation.",
      "T04 does not publish packages or replace a draft library/version workflow.",
      "The local in-memory store is a port test double, not a durable production database.",
      "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
  });
  const artifactBytes = await serializeArtifact(artifact);
  return Object.freeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function authenticateProofDocument(document, artifactSha256) {
  if (!document.endsWith("\n") || document.endsWith("\n\n"))
    fail("REPORT_DRIFT", "Visible T04 proof is not canonically terminated.");
  for (const heading of [
    "# M10A-T04 — Immutable design-system release identity",
    "## Delivered boundary",
    "## Executed evidence",
    "## Verification",
    "## Non-claims",
  ]) {
    if (document.split(heading).length - 1 !== 1)
      fail("REPORT_DRIFT", "Visible T04 proof heading inventory drifted.");
  }
  const marker = `Final artifact: \`sha256:${artifactSha256}\``;
  if (document.split(marker).length - 1 !== 1)
    fail("REPORT_DRIFT", "Visible T04 artifact marker drifted.");
  if (document.split("T04 provides no runtime activation").length - 1 !== 2)
    fail("REPORT_DRIFT", "Visible T04 non-claim drifted.");
  const statusCount = document.split("**Status:**").length - 1;
  if (statusCount !== 1) fail("REPORT_DRIFT", "Visible T04 proof status drifted.");
  if (document.includes(PENDING_PROOF_STATUS)) {
    if (
      document.split(PENDING_HOSTED_RECEIPT).length - 1 !== 1 ||
      document.includes(CLOSED_PROOF_STATUS) ||
      CLOSED_HOSTED_RECEIPT.test(document)
    ) {
      fail("REPORT_DRIFT", "Visible T04 pending closure receipt drifted.");
    }
    return;
  }
  if (!document.includes(CLOSED_PROOF_STATUS) || document.includes(PENDING_HOSTED_RECEIPT)) {
    fail("REPORT_DRIFT", "Visible T04 closure state drifted.");
  }
  const closedReceipts = document.match(CLOSED_HOSTED_RECEIPT) ?? [];
  if (closedReceipts.length !== 1)
    fail("REPORT_DRIFT", "Visible T04 hosted closure receipt drifted.");
}

async function readVisibleProof(workspaceRoot, override) {
  if (override !== undefined)
    return captureBuffer(override, "proofDocumentBytes", PROOF_DOCUMENT_LIMIT);
  return readRegularAuthority(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH, PROOF_DOCUMENT_LIMIT);
}

export async function verifyM10AT04Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  let artifactBytes;
  let checkpointHeadSha256 = "TEST_OVERRIDE";
  if (options.artifactBytes === undefined) {
    const frozen = await readCheckpointedFrozenArtifact("M10A-T04", { workspaceRoot });
    if (frozen.path !== ARTIFACT_RELATIVE_PATH)
      fail("ARTIFACT_DRIFT", "Checkpointed T04 artifact path drifted.");
    artifactBytes = Buffer.from(frozen.bytes);
    checkpointHeadSha256 = frozen.checkpointHeadSha256;
  } else {
    artifactBytes = captureBuffer(options.artifactBytes, "artifactBytes", ARTIFACT_LIMIT);
  }
  if (artifactBytes.byteLength > ARTIFACT_LIMIT)
    fail("ARTIFACT_LIMIT", "T04 artifact exceeds the bounded proof limit.");
  const built = await buildM10AT04Evidence();
  if (!artifactBytes.equals(built.artifactBytes))
    fail("ARTIFACT_DRIFT", "Stored T04 artifact differs from fresh evidence.");
  const proofBytes = await readVisibleProof(workspaceRoot, options.proofDocumentBytes);
  let proofDocument;
  try {
    proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(proofBytes);
  } catch {
    fail("REPORT_DRIFT", "Visible T04 proof is not valid UTF-8.");
  }
  authenticateProofDocument(proofDocument, built.artifactSha256);
  return Object.freeze({
    status: "PASS",
    task: "M10A-T04",
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    checkpointHeadSha256,
    releaseDigest: built.artifact.release.digest,
    dependencyCount: built.artifact.release.dependencyCount,
    externalExecution: false,
  });
}

export async function writeM10AT04Evidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
  const workspaceRoot = await canonicalWorkspaceRoot(options.workspaceRoot);
  const artifactPath = options.artifactPath ?? path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH);
  if (
    typeof artifactPath !== "string" ||
    !path.isAbsolute(artifactPath) ||
    path.resolve(artifactPath) !== artifactPath ||
    artifactPath.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "artifactPath must be one canonical absolute path.");
  }
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const built = await buildM10AT04Evidence();
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof M10AT04ProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic T04 evidence write failed.");
  }
  return Object.freeze({
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
