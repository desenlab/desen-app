import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ReferenceHostWebShellEvidenceError,
  buildReferenceHostWebShellEvidence,
  verifyReferenceHostWebShellEvidence,
  writeReferenceHostWebShellEvidence,
} from "../scripts/lib/reference-host-web-shell-proof.mjs";

const HISTORICAL_SHA256 = "cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2";
const HISTORICAL_BYTES = 16_213;
const ARTIFACT_FILE_NAME = "reference-host-web-0.1.0-shell.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const ARTIFACT_URL = new URL(`../${ARTIFACT_RELATIVE_PATH}`, import.meta.url);
const PROOF_URL = new URL("../docs/proof/REFERENCE-HOST-WEB-SHELL.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const STATUS_URL = new URL("../PROJECT-STATUS.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebShellEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function proofTexts() {
  const [proofDocumentText, proofMatrixText, projectStatusText] = await Promise.all([
    readFile(PROOF_URL, "utf8"),
    readFile(MATRIX_URL, "utf8"),
    readFile(STATUS_URL, "utf8"),
  ]);
  return { proofDocumentText, proofMatrixText, projectStatusText };
}

test("accepts immutable task-time M05-T07 reference-host shell evidence", async () => {
  const result = await verifyReferenceHostWebShellEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    artifactBytes: HISTORICAL_BYTES,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 42,
    sourceAssertions: 902,
    focusedTests: 92,
    compilerNegativeCases: 53,
    rootMutationTests: 33,
    buildFiles: 3,
    buildAggregateSha256: "sha256:e8c6a400c4507763f96172109d8aa8931f7707f5885d9ae5ec9ec0b90276a2c8",
    exactDocumentationReferences: 6,
  });
});

test("two reads preserve exact bytes and recursively frozen reviewed semantics", async () => {
  const first = await buildReferenceHostWebShellEvidence();
  const second = await buildReferenceHostWebShellEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifactBytes.length, HISTORICAL_BYTES);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T07");
  assert.equal(first.artifact.claim.officialSignInExecuted, false);
  assert.equal(first.artifact.claim.handwrittenManagedTreeFullyAudited, false);
  assert.equal(first.artifact.hostShell.build.deterministic, true);
  assert.equal(first.artifact.hostShell.recovery.activationCommitAfterAllAuthenticators, true);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects one-byte, semantic-only, and byte-length artifact tampering", async () => {
  const original = await readFile(ARTIFACT_URL);
  const oneByte = Buffer.from(original);
  oneByte[Math.floor(oneByte.length / 2)] ^= 1;
  const semantic = Buffer.from(
    original
      .toString("utf8")
      .replace('"officialSignInExecuted": false', '"officialSignInExecuted": true '),
  );
  assert.equal(semantic.length, original.length);

  for (const artifactBytes of [oneByte, semantic, original.subarray(0, original.length - 1)]) {
    await assert.rejects(
      buildReferenceHostWebShellEvidence({ artifactBytes }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_HISTORICAL_ARTIFACT_DRIFT"),
    );
  }
});

test("rejects successor source, runtime, build, prerequisite, and pending-pin injection", async () => {
  for (const options of [
    { workspaceRoot: "." },
    { fileOverrides: {} },
    { prerequisiteBytes: {} },
    { runtimeApi: {} },
    { runtimeApis: {} },
    { preparedEvidence: {} },
    { build: () => undefined },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildReferenceHostWebShellEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor, inherited, symbol, non-enumerable, Proxy, and hostile byte inputs", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const inherited = Object.create({ artifactPath: "ignored" });
  const symbol = { [Symbol("artifactPath")]: "ignored" };
  const nonEnumerable = Object.defineProperty({}, "artifactPath", {
    enumerable: false,
    value: "ignored",
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();

  for (const options of [accessor, inherited, symbol, nonEnumerable, proxy, revoked.proxy]) {
    await assert.rejects(
      buildReferenceHostWebShellEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
    );
  }

  class Uint8ArraySubclass extends Uint8Array {}
  for (const artifactBytes of [
    "not-bytes",
    new Uint8Array(new SharedArrayBuffer(HISTORICAL_BYTES)),
    new Proxy(Buffer.alloc(HISTORICAL_BYTES), {}),
    new Uint8ArraySubclass(HISTORICAL_BYTES),
  ]) {
    await assert.rejects(
      buildReferenceHostWebShellEvidence({ artifactBytes }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects a wrong byte length before allocating a local artifact copy", async () => {
  const OriginalUint8Array = globalThis.Uint8Array;
  const wrongLengthBytes = new OriginalUint8Array(HISTORICAL_BYTES + 1);
  let localAllocations = 0;
  function ObservedUint8Array(...arguments_) {
    localAllocations += 1;
    return Reflect.construct(OriginalUint8Array, arguments_);
  }
  Object.defineProperty(ObservedUint8Array, "prototype", {
    value: OriginalUint8Array.prototype,
  });

  globalThis.Uint8Array = ObservedUint8Array;
  try {
    await assert.rejects(
      buildReferenceHostWebShellEvidence({ artifactBytes: wrongLengthBytes }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_HISTORICAL_ARTIFACT_DRIFT"),
    );
    assert.equal(localAllocations, 0);
  } finally {
    globalThis.Uint8Array = OriginalUint8Array;
  }
});

test("rejects ambiguous sources and unbounded documentation", async () => {
  const bytes = await readFile(ARTIFACT_URL);
  await assert.rejects(
    buildReferenceHostWebShellEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeReferenceHostWebShellEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyReferenceHostWebShellEvidence({
      proofDocumentText: "x".repeat(2_000_001),
    }),
    hasEvidenceCode("REFERENCE_HOST_SHELL_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched proof pins", async () => {
  const texts = await proofTexts();
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved artifact"),
    `${texts.proofDocumentText}\n\`${ARTIFACT_RELATIVE_PATH}\`\n\`sha256:${HISTORICAL_SHA256}\`\n`,
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebShellEvidence({ ...texts, proofDocumentText }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT"),
    );
  }
  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T07", "## Moved M05-T07"),
    texts.proofMatrixText.replace(
      `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\``,
      `\`evil/${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\``,
    ),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "f".repeat(64)),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebShellEvidence({ ...texts, proofMatrixText }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT"),
    );
  }
  for (const projectStatusText of [
    texts.projectStatusText.replace("M05-T07 evidence:", "M05-T07 moved:"),
    texts.projectStatusText.replace(HISTORICAL_SHA256, "a".repeat(64)),
    texts.projectStatusText.replace(
      `\`${ARTIFACT_RELATIVE_PATH}\``,
      `\`evil/${ARTIFACT_FILE_NAME}\``,
    ),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebShellEvidence({ ...texts, projectStatusText }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects decoy digests that are not associated with the M05-T07 artifact", async () => {
  const texts = await proofTexts();
  const wrongSha256 = "0".repeat(64);
  const proofDocumentText = texts.proofDocumentText.replace(
    `\`sha256:${HISTORICAL_SHA256}\``,
    `\`sha256:${wrongSha256}\`\n\nHistorical digest decoy: \`sha256:${HISTORICAL_SHA256}\``,
  );
  const proofMatrixText = texts.proofMatrixText.replace(
    `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
    `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${wrongSha256}\`.\n\nHistorical digest decoy: \`sha256:${HISTORICAL_SHA256}\`.`,
  );
  const projectStatusText = texts.projectStatusText.replace(
    `  \`${HISTORICAL_SHA256}\``,
    `  \`${wrongSha256}\`\n- historical digest decoy: \`${HISTORICAL_SHA256}\``,
  );

  for (const override of [{ proofDocumentText }, { proofMatrixText }, { projectStatusText }]) {
    await assert.rejects(
      verifyReferenceHostWebShellEvidence({ ...texts, ...override }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects symlink artifact and documentation inputs", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t07-symlink-"));
  try {
    const artifactLink = path.join(temporary, ARTIFACT_FILE_NAME);
    const proofLink = path.join(temporary, "proof.md");
    await symlink(ARTIFACT_URL.pathname, artifactLink);
    await symlink(PROOF_URL.pathname, proofLink);
    await assert.rejects(
      buildReferenceHostWebShellEvidence({ artifactPath: artifactLink }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      verifyReferenceHostWebShellEvidence({ proofPath: proofLink }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_PROOF_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("default writer is a no-op and alternate destination is an exact atomic copy", async () => {
  const before = await stat(ARTIFACT_URL);
  const result = await writeReferenceHostWebShellEvidence();
  const after = await stat(ARTIFACT_URL);
  assert.equal(result.preserved, true);
  assert.equal(before.ino, after.ino);
  assert.equal(before.mtimeMs, after.mtimeMs);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t07-copy-"));
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const copied = await writeReferenceHostWebShellEvidence({ artifactPath: destination });
    assert.equal(copied.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
    assert.equal((await lstat(destination)).isFile(), true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("temporary-byte tampering fails atomically without replacing the destination", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t07-atomic-"));
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const originalDestination = Buffer.from("preserve-me");
    await writeFile(destination, originalDestination);
    await assert.rejects(
      writeReferenceHostWebShellEvidence({
        artifactPath: destination,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered");
        },
      }),
      hasEvidenceCode("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(destination), originalDestination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
