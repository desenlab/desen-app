import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
  REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS,
  REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS,
  REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS,
  ReferenceHostWebSignInEvidenceError,
  buildReferenceHostWebSignInEvidence,
  inspectReferenceHostWebSignInEvidence,
  verifyReferenceHostWebSignInDocumentation,
  verifyReferenceHostWebSignInEvidence,
  verifyReferenceHostWebSignInProofDocument,
  writeReferenceHostWebSignInEvidence,
} from "../scripts/lib/reference-host-web-sign-in-proof.mjs";

const HISTORICAL_SHA256 = "a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb";
const HISTORICAL_BYTES = 21_847;
const ARTIFACT_FILE_NAME = "reference-host-web-0.1.0-sign-in.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const ARTIFACT_URL = new URL(`../${ARTIFACT_RELATIVE_PATH}`, import.meta.url);
const PROOF_URL = new URL("../docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const STATUS_URL = new URL("../PROJECT-STATUS.md", import.meta.url);
const COMPATIBILITY_LIBRARY_URL = new URL(
  "../scripts/lib/reference-host-web-sign-in-proof.mjs",
  import.meta.url,
);
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceHostWebSignInEvidenceError);
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

test("accepts immutable task-time M05-T08 reference-host sign-in evidence", async () => {
  const result = await verifyReferenceHostWebSignInEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    artifactBytes: HISTORICAL_BYTES,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 46,
    sourceAssertions: 408,
    focusedTests: 18,
    fullAppTests: 40,
    compilerNegativeCases: 13,
    rootMutationTests: 14,
    traceEntries: 13,
    buildFiles: 3,
    buildAggregateSha256: "sha256:0d87b5ccaec442a4e2777c952906046d6b3677ec648bf49120d0fa35290cad69",
    exactDocumentationReferences: 10,
  });
});

test("two reads preserve exact bytes and recursively frozen reviewed semantics", async () => {
  const first = await buildReferenceHostWebSignInEvidence();
  const second = await buildReferenceHostWebSignInEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifactBytes.length, HISTORICAL_BYTES);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T08");
  assert.equal(first.artifact.claim.officialSignInExecuted, true);
  assert.equal(first.artifact.claim.g05Closed, false);
  assert.equal(first.artifact.integration.httpBinding.maximumResponseBytes, 65_536);
  assert.equal(first.artifact.integration.httpBinding.maximumResponseChunks, 1_024);
  assert.equal(first.artifact.independentBuild.deterministic, true);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("retains the deprecated named inventory and inspection API without reading successor source", async () => {
  assert.equal(REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS.length, 2);
  assert.equal(REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS.length, 46);
  assert.equal(REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS.length, 49);
  assert.equal(Object.isFrozen(REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS), true);
  assert.equal(Object.isFrozen(REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS), true);
  assert.equal(Object.isFrozen(REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS), true);

  const inventory = await inspectReferenceHostWebSignInEvidence({
    workspaceRoot: WORKSPACE_ROOT,
  });
  assert.equal(inventory.prerequisites.length, 2);
  assert.equal(
    inventory.fixtures.source.digest,
    "sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635",
  );
  assert.equal(inventory.production.httpBinding.maximumResponseBytes, 65_536);
  assert.equal(inventory.production.productionImports.length, 52);
  assert.equal(inventory.production.dynamicExecutableCalls, 0);
  assert.equal(inventory.tests.focusedCases, 18);
  assert.equal(inventory.traceability.length, 13);
  assert.equal(inventory.sourceAssertions, 408);
  assert.equal(Object.isFrozen(inventory), true);
  assert.equal(Object.isFrozen(inventory.production.productionImports), true);
  assert.equal(Object.isFrozen(inventory.production.productionImports[0]), true);

  await buildReferenceHostWebSignInEvidence({ workspaceRoot: WORKSPACE_ROOT });
  await verifyReferenceHostWebSignInEvidence({ workspaceRoot: WORKSPACE_ROOT });
  await writeReferenceHostWebSignInEvidence({ workspaceRoot: WORKSPACE_ROOT });
  for (const operation of [
    () => inspectReferenceHostWebSignInEvidence({ workspaceRoot: path.dirname(WORKSPACE_ROOT) }),
    () => buildReferenceHostWebSignInEvidence({ workspaceRoot: path.dirname(WORKSPACE_ROOT) }),
    () => verifyReferenceHostWebSignInEvidence({ workspaceRoot: path.dirname(WORKSPACE_ROOT) }),
    () => writeReferenceHostWebSignInEvidence({ workspaceRoot: path.dirname(WORKSPACE_ROOT) }),
  ]) {
    await assert.rejects(operation(), hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"));
  }
});

test("accepts only the historical digest when checking compatibility documentation", async () => {
  const texts = await proofTexts();
  assert.deepEqual(
    verifyReferenceHostWebSignInProofDocument(texts.proofDocumentText, HISTORICAL_SHA256),
    { result: "PASS", exactReferences: 2 },
  );
  assert.deepEqual(
    verifyReferenceHostWebSignInDocumentation(
      texts.proofDocumentText,
      texts.proofMatrixText,
      texts.projectStatusText,
      HISTORICAL_SHA256,
    ),
    { result: "PASS", exactReferences: 10 },
  );
  assert.throws(
    () => verifyReferenceHostWebSignInProofDocument(texts.proofDocumentText, "0".repeat(64)),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
});

test("rejects one-byte semantic-only and byte-length artifact tampering", async () => {
  const original = await readFile(ARTIFACT_URL);
  const oneByte = Buffer.from(original);
  oneByte[Math.floor(oneByte.length / 2)] ^= 1;
  const semantic = Buffer.from(
    original.toString("utf8").replace('"g05Closed": false', '"g05Closed": true '),
  );
  assert.equal(semantic.length, original.length);

  for (const artifactBytes of [oneByte, semantic, original.subarray(0, original.length - 1)]) {
    await assert.rejects(
      buildReferenceHostWebSignInEvidence({ artifactBytes }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_HISTORICAL_ARTIFACT_DRIFT"),
    );
  }
});

test("rejects successor source runtime build prerequisite and pending-pin injection", async () => {
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
      buildReferenceHostWebSignInEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor inherited symbol non-enumerable Proxy and hostile byte inputs", async () => {
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
      buildReferenceHostWebSignInEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
    );
  }

  class Uint8ArraySubclass extends Uint8Array {}
  const hostileBytes = [
    "not-bytes",
    new Proxy(Buffer.alloc(HISTORICAL_BYTES), {}),
    new Uint8ArraySubclass(HISTORICAL_BYTES),
    new DataView(new ArrayBuffer(HISTORICAL_BYTES)),
  ];
  if (typeof SharedArrayBuffer !== "undefined") {
    hostileBytes.push(new Uint8Array(new SharedArrayBuffer(HISTORICAL_BYTES)));
  }
  for (const artifactBytes of hostileBytes) {
    await assert.rejects(
      buildReferenceHostWebSignInEvidence({ artifactBytes }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
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
      buildReferenceHostWebSignInEvidence({ artifactBytes: wrongLengthBytes }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_HISTORICAL_ARTIFACT_DRIFT"),
    );
    assert.equal(localAllocations, 0);
  } finally {
    globalThis.Uint8Array = OriginalUint8Array;
  }
});

test("rejects ambiguous sources and unbounded documentation before proof inspection", async () => {
  const bytes = await readFile(ARTIFACT_URL);
  const texts = await proofTexts();
  await assert.rejects(
    buildReferenceHostWebSignInEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeReferenceHostWebSignInEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyReferenceHostWebSignInEvidence({
      proofDocumentText: "x".repeat(2_000_001),
    }),
    hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
  );
  for (const options of [
    {
      proofPath: PROOF_URL.pathname,
      proofDocumentText: texts.proofDocumentText,
    },
    {
      proofMatrixPath: MATRIX_URL.pathname,
      proofMatrixText: texts.proofMatrixText,
    },
    {
      projectStatusPath: STATUS_URL.pathname,
      projectStatusText: texts.projectStatusText,
    },
  ]) {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence(options),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
    );
  }
});

test("opens evidence with nonblocking no-follow flags before post-open identity checks", async () => {
  const libraryText = await readFile(COMPATIBILITY_LIBRARY_URL, "utf8");
  assert.match(
    libraryText,
    /constants\.O_RDONLY\s*\|\s*\(constants\.O_NOFOLLOW \?\? 0\)\s*\|\s*\(constants\.O_NONBLOCK \?\? 0\)/u,
  );
});

test("rejects moved duplicated pending or mismatched contextual proof pins", async () => {
  const texts = await proofTexts();
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved artifact"),
    texts.proofDocumentText.replace(
      "## Evidence artifact",
      "## Evidence artifact\n\n## Evidence artifact",
    ),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({ ...texts, proofDocumentText }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT"),
    );
  }

  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T08", "## Moved M05-T08"),
    texts.proofMatrixText.replace("| P-10 |", "| P-01 |"),
    texts.proofMatrixText.replace(
      `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\``,
      `\`evil/${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\``,
    ),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "f".repeat(64)),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({ ...texts, proofMatrixText }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT"),
    );
  }

  for (const projectStatusText of [
    texts.projectStatusText.replace("M05-T08 evidence:", "M05-T08 moved:"),
    texts.projectStatusText.replace(HISTORICAL_SHA256, "a".repeat(64)),
    texts.projectStatusText.replace(
      `\`${ARTIFACT_RELATIVE_PATH}\``,
      `\`evil/${ARTIFACT_FILE_NAME}\``,
    ),
  ]) {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({ ...texts, projectStatusText }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects decoy digests not associated with every reviewed M05-T08 location", async () => {
  const texts = await proofTexts();
  const wrongSha256 = "0".repeat(64);
  const proofDocumentText = texts.proofDocumentText.replace(
    `- SHA-256: \`sha256:${HISTORICAL_SHA256}\``,
    `- SHA-256: \`sha256:${wrongSha256}\`\n- historical digest decoy: \`sha256:${HISTORICAL_SHA256}\``,
  );
  const proofMatrixP06Text = texts.proofMatrixText.replace(
    `\`${ARTIFACT_FILE_NAME}\` \`sha256:${HISTORICAL_SHA256}\``,
    `\`${ARTIFACT_FILE_NAME}\` \`sha256:${wrongSha256}\` historical-decoy \`sha256:${HISTORICAL_SHA256}\``,
  );
  const p10Row = texts.proofMatrixText.split(/\r?\n/u).find((line) => line.startsWith("| P-10 |"));
  assert.notEqual(p10Row, undefined);
  const proofMatrixP10Text = texts.proofMatrixText.replace(
    p10Row,
    p10Row.replace(
      `\`${ARTIFACT_FILE_NAME}\` \`sha256:${HISTORICAL_SHA256}\``,
      `\`${ARTIFACT_FILE_NAME}\` \`sha256:${wrongSha256}\` historical-decoy \`sha256:${HISTORICAL_SHA256}\``,
    ),
  );
  const proofMatrixSectionText = texts.proofMatrixText.replace(
    `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
    `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${wrongSha256}\`.\n\nHistorical digest decoy: \`sha256:${HISTORICAL_SHA256}\`.`,
  );
  const projectStatusText = texts.projectStatusText.replace(
    `  \`${HISTORICAL_SHA256}\``,
    `  \`${wrongSha256}\`\n- historical digest decoy: \`${HISTORICAL_SHA256}\``,
  );

  for (const override of [
    { proofDocumentText },
    { proofMatrixText: proofMatrixP06Text },
    { proofMatrixText: proofMatrixP10Text },
    { proofMatrixText: proofMatrixSectionText },
    { projectStatusText },
  ]) {
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({ ...texts, ...override }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT"),
    );
  }
});

test("rejects symlink file and parent inputs for artifacts and documentation", async () => {
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-t08-compat-symlink-")),
  );
  try {
    const artifactLink = path.join(temporary, ARTIFACT_FILE_NAME);
    const proofLink = path.join(temporary, "proof.md");
    await symlink(ARTIFACT_URL.pathname, artifactLink);
    await symlink(PROOF_URL.pathname, proofLink);
    await assert.rejects(
      buildReferenceHostWebSignInEvidence({ artifactPath: artifactLink }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({ proofPath: proofLink }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE"),
    );

    const realDirectory = path.join(temporary, "real");
    const linkedDirectory = path.join(temporary, "linked");
    await mkdir(realDirectory);
    await writeFile(path.join(realDirectory, ARTIFACT_FILE_NAME), await readFile(ARTIFACT_URL));
    await writeFile(path.join(realDirectory, "proof.md"), await readFile(PROOF_URL));
    await symlink(realDirectory, linkedDirectory);
    await assert.rejects(
      buildReferenceHostWebSignInEvidence({
        artifactPath: path.join(linkedDirectory, ARTIFACT_FILE_NAME),
      }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      verifyReferenceHostWebSignInEvidence({
        proofPath: path.join(linkedDirectory, "proof.md"),
      }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("rejects wrong-sized on-disk input before reading it as historical evidence", async () => {
  const temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t08-compat-size-")));
  try {
    const artifactPath = path.join(temporary, ARTIFACT_FILE_NAME);
    await writeFile(artifactPath, Buffer.alloc(HISTORICAL_BYTES + 1));
    await assert.rejects(
      buildReferenceHostWebSignInEvidence({ artifactPath }),
      hasEvidenceCode("REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("compatibility writer authenticates exact inputs but performs zero filesystem mutation", async () => {
  const canonicalBytes = await readFile(ARTIFACT_URL);
  const canonicalBefore = await stat(ARTIFACT_URL);
  const canonicalDirectory = path.dirname(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH);
  const temporaryNamesBefore = (await readdir(canonicalDirectory)).filter((name) =>
    name.startsWith(`.${ARTIFACT_FILE_NAME}.`),
  );
  const temporary = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-t08-compat-read-only-")),
  );
  try {
    const exactSource = path.join(temporary, "exact-source.json");
    const existingAlternate = path.join(temporary, "existing.json");
    const missingAlternate = path.join(temporary, "missing.json");
    await writeFile(exactSource, canonicalBytes);
    await writeFile(existingAlternate, "preserve-me");
    const sourceBefore = await stat(exactSource);
    const alternateBefore = await stat(existingAlternate);
    let callbackCalls = 0;

    for (const result of [
      await writeReferenceHostWebSignInEvidence(),
      await writeReferenceHostWebSignInEvidence({
        artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
      }),
      await writeReferenceHostWebSignInEvidence({
        artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
        sourceArtifactPath: exactSource,
      }),
      await writeReferenceHostWebSignInEvidence({
        artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
        artifactBytes: canonicalBytes,
      }),
    ]) {
      assert.equal(result.preserved, true);
      assert.equal(result.artifactPath, DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH);
      assert.equal(result.artifactSha256, HISTORICAL_SHA256);
    }

    for (const options of [
      { artifactPath: missingAlternate },
      { artifactPath: existingAlternate },
      {
        artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
        beforeAtomicRename: async () => {
          callbackCalls += 1;
        },
      },
      {
        artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
        beforeAtomicRename: undefined,
      },
    ]) {
      await assert.rejects(
        writeReferenceHostWebSignInEvidence(options),
        hasEvidenceCode("REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID"),
      );
    }
    assert.equal(callbackCalls, 0);
    await assert.rejects(readFile(missingAlternate), { code: "ENOENT" });
    assert.equal(await readFile(existingAlternate, "utf8"), "preserve-me");

    const sourceAfter = await stat(exactSource);
    const alternateAfter = await stat(existingAlternate);
    assert.equal(sourceAfter.ino, sourceBefore.ino);
    assert.equal(sourceAfter.mtimeMs, sourceBefore.mtimeMs);
    assert.equal(alternateAfter.ino, alternateBefore.ino);
    assert.equal(alternateAfter.mtimeMs, alternateBefore.mtimeMs);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

  const canonicalAfter = await stat(ARTIFACT_URL);
  assert.deepEqual(await readFile(ARTIFACT_URL), canonicalBytes);
  assert.equal(canonicalAfter.ino, canonicalBefore.ino);
  assert.equal(canonicalAfter.mtimeMs, canonicalBefore.mtimeMs);
  assert.deepEqual(
    (await readdir(canonicalDirectory)).filter((name) =>
      name.startsWith(`.${ARTIFACT_FILE_NAME}.`),
    ),
    temporaryNamesBefore,
  );
});
