import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactFailureBoundaryEvidenceError,
  buildRuntimeReactFailureBoundaryEvidence,
  verifyRuntimeReactFailureBoundaryEvidence,
  writeRuntimeReactFailureBoundaryEvidence,
} from "../scripts/lib/runtime-react-failure-boundary-proof.mjs";

const HISTORICAL_SHA256 = "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723";
const HISTORICAL_BYTES = 9_534;
const ARTIFACT_FILE_NAME = "runtime-react-0.1.0-failure-boundary.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const ARTIFACT_URL = new URL(`../${ARTIFACT_RELATIVE_PATH}`, import.meta.url);
const PROOF_URL = new URL("../docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const NORMATIVE_URL = new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url);
const FINDINGS_URL = new URL("../docs/plan/PROTOCOL-FINDINGS.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactFailureBoundaryEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function documentationTexts() {
  const [proofDocumentText, proofMatrixText, normativeCoverageText, findingsText] =
    await Promise.all([
      readFile(PROOF_URL, "utf8"),
      readFile(MATRIX_URL, "utf8"),
      readFile(NORMATIVE_URL, "utf8"),
      readFile(FINDINGS_URL, "utf8"),
    ]);
  return { proofDocumentText, proofMatrixText, normativeCoverageText, findingsText };
}

function replaceRow(markdown, id, replace) {
  const lines = markdown.split("\n");
  const indexes = lines.flatMap((line, index) => (line.startsWith(`| ${id} |`) ? [index] : []));
  assert.equal(indexes.length, 1);
  lines[indexes[0]] = replace(lines[indexes[0]]);
  return lines.join("\n");
}

function replaceExactOnce(text, search, replacement) {
  assert.equal(text.split(search).length - 1, 1);
  return text.replace(search, replacement);
}

test("accepts immutable task-time M05-T06 failure-boundary evidence", async () => {
  const result = await verifyRuntimeReactFailureBoundaryEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    artifactBytes: HISTORICAL_BYTES,
    compatibilityMode: "immutable-task-time-artifact",
    prerequisitePins: 5,
    trackedFiles: 16,
    sourceAssertions: 64,
    focusedTests: 22,
    compilerNegativeCases: 9,
    rootMutationTests: 25,
    publicRuntimeExports: 2,
    publicTypeExports: 8,
    nonclaims: 10,
    normativeStatus: "N-037:TESTED",
    proofStatus: "P-17:PARTIAL",
    taskLocalApplicabilityStatus: "D-009:DEFERRED",
    exactDocumentationReferences: 4,
  });
});

test("two independent historical reads preserve exact bytes and recursively frozen semantics", async () => {
  const first = await buildRuntimeReactFailureBoundaryEvidence();
  const second = await buildRuntimeReactFailureBoundaryEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifactBytes.length, HISTORICAL_BYTES);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(first.artifact.task, "M05-T06");
  assert.equal(first.artifact.claim.exactAttribution, "leaf-component-only");
  assert.equal(first.artifact.claim.behaviorExactAttribution, false);
  assert.equal(first.artifact.boundary.integrationScope.omittedRecoveryKey, "safe-never-retry");
  assert.equal(first.artifact.evidence.tests.rootMutationTests, 25);
  assert.equal(first.artifact.evidence.traceability.proofClaim.remainingOwner, "M07-T04");
  assert.equal(
    first.artifact.evidence.traceability.taskLocalApplicability.remainingOwner,
    "M06-T11",
  );
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.boundary.integrationScope), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects byte, length, and semantic task-time artifact tampering", async () => {
  const original = await readFile(ARTIFACT_URL);
  const tampered = Buffer.from(original);
  tampered[Math.floor(tampered.length / 2)] ^= 1;
  await assert.rejects(
    buildRuntimeReactFailureBoundaryEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactFailureBoundaryEvidence({
      artifactBytes: original.subarray(0, original.length - 1),
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT"),
  );

  const semanticMutation = JSON.parse(original.toString("utf8"));
  semanticMutation.claim.wholeSurfaceFailClosed = false;
  await assert.rejects(
    buildRuntimeReactFailureBoundaryEvidence({
      artifactBytes: Buffer.from(`${JSON.stringify(semanticMutation, null, 2)}\n`),
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT"),
  );
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
      buildRuntimeReactFailureBoundaryEvidence(options),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
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
      buildRuntimeReactFailureBoundaryEvidence(options),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  }

  class Uint8ArraySubclass extends Uint8Array {}
  const detached = new Uint8Array(HISTORICAL_BYTES);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const artifactBytes of [
    "not-bytes",
    new Uint8Array(new SharedArrayBuffer(HISTORICAL_BYTES)),
    new Proxy(Buffer.alloc(HISTORICAL_BYTES), {}),
    new Uint8ArraySubclass(HISTORICAL_BYTES),
    detached,
  ]) {
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ artifactBytes }),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects oversized bytes before backing allocation and ignores poisoned copy prototypes", async () => {
  const OriginalUint8Array = globalThis.Uint8Array;
  const oversized = new OriginalUint8Array(16 * 1024 * 1024);
  let constructorCalls = 0;
  let oversizedError;
  globalThis.Uint8Array = new Proxy(OriginalUint8Array, {
    construct(target, argumentsList, newTarget) {
      constructorCalls += 1;
      return Reflect.construct(target, argumentsList, newTarget);
    },
  });
  try {
    await buildRuntimeReactFailureBoundaryEvidence({ artifactBytes: oversized });
  } catch (error) {
    oversizedError = error;
  } finally {
    globalThis.Uint8Array = OriginalUint8Array;
  }
  assert.ok(oversizedError instanceof RuntimeReactFailureBoundaryEvidenceError);
  assert.equal(oversizedError.code, "FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT");
  assert.equal(constructorCalls, 0);

  const historical = await readFile(ARTIFACT_URL);
  const zeroBytes = new OriginalUint8Array(HISTORICAL_BYTES);
  const originalSet = OriginalUint8Array.prototype.set;
  let poisonedSetCalls = 0;
  let poisonedError;
  OriginalUint8Array.prototype.set = function poisonedSet() {
    poisonedSetCalls += 1;
    return Reflect.apply(originalSet, this, [historical]);
  };
  try {
    await buildRuntimeReactFailureBoundaryEvidence({ artifactBytes: zeroBytes });
  } catch (error) {
    poisonedError = error;
  } finally {
    OriginalUint8Array.prototype.set = originalSet;
  }
  assert.ok(poisonedError instanceof RuntimeReactFailureBoundaryEvidenceError);
  assert.equal(poisonedError.code, "FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT");
  assert.equal(poisonedSetCalls, 0);
});

test("snapshots only the supplied byte range before caller mutation", async () => {
  const historical = await readFile(ARTIFACT_URL);
  const backing = Buffer.alloc(HISTORICAL_BYTES + 2, 0xff);
  historical.copy(backing, 1);
  const exactSubview = backing.subarray(1, backing.length - 1);
  const builtPromise = buildRuntimeReactFailureBoundaryEvidence({
    artifactBytes: exactSubview,
  });
  exactSubview.fill(0);
  const built = await builtPromise;
  assert.equal(built.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(built.artifactBytes, historical);
});

test("rejects ambiguous sources, unsafe writer options, and unbounded documentation", async () => {
  const artifactBytes = await readFile(ARTIFACT_URL);
  const texts = await documentationTexts();
  await assert.rejects(
    buildRuntimeReactFailureBoundaryEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes,
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactFailureBoundaryEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes,
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes,
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactFailureBoundaryEvidence({
      proofDocumentText: "x".repeat(2_000_001),
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  for (const options of [
    { ...texts, proofPath: PROOF_URL.pathname },
    { ...texts, proofMatrixPath: MATRIX_URL.pathname },
    { ...texts, normativeCoveragePath: NORMATIVE_URL.pathname },
    { ...texts, findingsPath: FINDINGS_URL.pathname },
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence(options),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ artifactPath: "" }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ beforeAtomicRename: () => undefined }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ artifactPath: undefined }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched proof and M05-T06 matrix pins", async () => {
  const texts = await documentationTexts();
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved evidence artifact"),
    `${texts.proofDocumentText}\n\`${ARTIFACT_RELATIVE_PATH}\`\n\`sha256:${HISTORICAL_SHA256}\`\n`,
    `${texts.proofDocumentText}\nM05-T06 does not prove whole-surface containment.\n`,
    `${texts.proofDocumentText}\nFinal proof decision: FAIL.\n`,
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...texts,
        proofDocumentText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T06", "## Moved M05-T06"),
    texts.proofMatrixText.replace(
      `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
      `\`evil/${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
    ),
    replaceRow(texts.proofMatrixText, "P-17", (row) =>
      row.replace(HISTORICAL_SHA256, "f".repeat(64)),
    ),
    `${texts.proofMatrixText}\n\`${ARTIFACT_FILE_NAME}\` \`sha256:${HISTORICAL_SHA256}\`\n`,
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...texts,
        proofMatrixText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects N-037, P-17, and PF-055 current-closure drift", async () => {
  const texts = await documentationTexts();
  for (const normativeCoverageText of [
    replaceRow(texts.normativeCoverageText, "N-037", (row) =>
      replaceExactOnce(row, "| TESTED      |", "| PLANNED     |"),
    ),
    replaceRow(texts.normativeCoverageText, "N-037", (row) => row.replace("M05-T06", "M05-T99")),
    replaceRow(texts.normativeCoverageText, "N-037", (row) =>
      replaceExactOnce(row, HISTORICAL_SHA256, "a".repeat(64)),
    ),
    replaceRow(texts.normativeCoverageText, "N-037", (row) =>
      replaceExactOnce(row, ARTIFACT_RELATIVE_PATH, `moved/${ARTIFACT_RELATIVE_PATH}`),
    ),
    replaceRow(texts.normativeCoverageText, "N-037", (row) =>
      row.replace(
        "M05-T06 resolves every exact component",
        "This requirement is not actually tested. M05-T06 resolves every exact component",
      ),
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...texts,
        normativeCoverageText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }

  for (const proofMatrixText of [
    replaceRow(texts.proofMatrixText, "P-17", (row) =>
      replaceExactOnce(row, "| PARTIAL        |", "| PROVEN         |"),
    ),
    replaceRow(texts.proofMatrixText, "P-17", (row) => row.replaceAll("M07-T04", "M05-T06")),
    replaceRow(texts.proofMatrixText, "P-17", (row) =>
      replaceExactOnce(row, ARTIFACT_FILE_NAME, "missing.json"),
    ),
    replaceRow(texts.proofMatrixText, "P-17", (row) =>
      row.replace("M05-T06 proves finite", "M05-T06 proves nothing. M05-T06 proves finite"),
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...texts,
        proofMatrixText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }

  for (const findingsText of [
    texts.findingsText.replace("Containment is whole-surface.", "Containment is node-local."),
    texts.findingsText.replace("trusted runtime results", "attacker-constructed results"),
    texts.findingsText.replace("one deduplicated", "multiple independent copies of"),
    texts.findingsText.replace("M05-T07 now wires", "M05-T07 may someday wire"),
    texts.findingsText.replace("M05-T08 now exercises", "M05-T08 may someday exercise"),
    texts.findingsText.replace("M05-T09 now proves", "M05-T09 may someday prove"),
    texts.findingsText.replace("M06-T11 still owns", "M05-T06 owns"),
    texts.findingsText.replace("M07-T04 owns", "M05-T06 owns"),
    texts.findingsText.replace(
      "Containment is whole-surface.",
      "Containment is whole-surface. It is false that Containment is whole-surface.",
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({
        ...texts,
        findingsText,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects symlink artifact and documentation inputs", async () => {
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-symlink-")),
  );
  try {
    const artifactLink = path.join(temporary, ARTIFACT_FILE_NAME);
    const proofLink = path.join(temporary, "proof.md");
    await symlink(ARTIFACT_URL.pathname, artifactLink);
    await symlink(PROOF_URL.pathname, proofLink);
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ artifactPath: artifactLink }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      verifyRuntimeReactFailureBoundaryEvidence({ proofPath: proofLink }),
      hasEvidenceCode("FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects parent symlinks, wrong-size files, and dot-segment output aliases", async () => {
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-parent-")),
  );
  try {
    const actualParent = path.join(temporary, "actual");
    const aliasParent = path.join(temporary, "alias");
    await mkdir(actualParent);
    const historical = await readFile(ARTIFACT_URL);
    const historicalCopy = path.join(actualParent, ARTIFACT_FILE_NAME);
    const wrongSize = path.join(actualParent, "wrong-size.json");
    await writeFile(historicalCopy, historical);
    await writeFile(wrongSize, "too-short");
    await symlink(actualParent, aliasParent, "dir");

    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({
        artifactPath: path.join(aliasParent, ARTIFACT_FILE_NAME),
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      buildRuntimeReactFailureBoundaryEvidence({ artifactPath: wrongSize }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );

    let callbackCalls = 0;
    const aliasedDestination = path.join(aliasParent, "copy.json");
    await assert.rejects(
      writeRuntimeReactFailureBoundaryEvidence({
        artifactPath: aliasedDestination,
        beforeAtomicRename: () => {
          callbackCalls += 1;
        },
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
    assert.equal(callbackCalls, 0);
    assert.equal(
      await lstat(path.join(actualParent, "copy.json")).catch((error) =>
        error?.code === "ENOENT" ? undefined : Promise.reject(error),
      ),
      undefined,
    );

    const dotSegmentDestination = `${actualParent}${path.sep}..${path.sep}escaped.json`;
    await assert.rejects(
      writeRuntimeReactFailureBoundaryEvidence({
        artifactPath: dotSegmentDestination,
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("default writer is a true no-op and alternate destination is an exact atomic copy", async () => {
  const before = await stat(ARTIFACT_URL);
  const result = await writeRuntimeReactFailureBoundaryEvidence();
  const after = await stat(ARTIFACT_URL);
  assert.equal(result.preserved, true);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
  assert.equal(before.ino, after.ino);
  assert.equal(before.mtimeMs, after.mtimeMs);

  const historical = await readFile(ARTIFACT_URL);
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({ artifactBytes: historical }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_OPTIONS_INVALID"),
  );
  const afterRejectedOverride = await stat(ARTIFACT_URL);
  assert.equal(before.ino, afterRejectedOverride.ino);
  assert.equal(before.size, afterRejectedOverride.size);
  assert.equal(before.mtimeMs, afterRejectedOverride.mtimeMs);

  let explicitDefaultCallbackCalls = 0;
  await assert.rejects(
    writeRuntimeReactFailureBoundaryEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      beforeAtomicRename: () => {
        explicitDefaultCallbackCalls += 1;
      },
    }),
    hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
  );
  const afterExplicitDefault = await stat(ARTIFACT_URL);
  assert.equal(explicitDefaultCallbackCalls, 0);
  assert.equal(before.ino, afterExplicitDefault.ino);
  assert.equal(before.mtimeMs, afterExplicitDefault.mtimeMs);

  const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-copy-")));
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const copied = await writeRuntimeReactFailureBoundaryEvidence({
      artifactPath: destination,
    });
    assert.equal(copied.artifactSha256, HISTORICAL_SHA256);
    assert.equal(copied.artifactBytes, HISTORICAL_BYTES);
    assert.equal(copied.artifactPath, destination);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
    assert.equal((await lstat(destination)).isFile(), true);

    const sourceCopy = path.join(temporary, "source.json");
    const destinationFromSource = path.join(temporary, "from-source.json");
    const destinationFromBytes = path.join(temporary, "from-bytes.json");
    await writeFile(sourceCopy, historical);
    await writeRuntimeReactFailureBoundaryEvidence({
      sourceArtifactPath: sourceCopy,
      artifactPath: destinationFromSource,
    });
    await writeRuntimeReactFailureBoundaryEvidence({
      artifactBytes: historical,
      artifactPath: destinationFromBytes,
    });
    assert.deepEqual(await readFile(destinationFromSource), historical);
    assert.deepEqual(await readFile(destinationFromBytes), historical);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("temporary-byte tampering fails atomically without replacing the destination", async () => {
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-react-t06-atomic-")),
  );
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const originalDestination = Buffer.from("preserve-me");
    await writeFile(destination, originalDestination);
    await assert.rejects(
      writeRuntimeReactFailureBoundaryEvidence({
        artifactPath: destination,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered");
        },
      }),
      hasEvidenceCode("FAILURE_BOUNDARY_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(destination), originalDestination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
