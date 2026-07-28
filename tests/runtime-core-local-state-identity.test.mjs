import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildRuntimeCoreLocalStateIdentityEvidence,
  DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
  RuntimeCoreLocalStateIdentityEvidenceError,
  verifyRuntimeCoreLocalStateIdentityEvidence,
  writeRuntimeCoreLocalStateIdentityEvidence,
} from "../scripts/lib/runtime-core-local-state-identity-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_PATH = path.join(WORKSPACE_ROOT, "docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md");
const MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const ROOT_MANIFEST_PATH = path.join(WORKSPACE_ROOT, "package.json");
const LIBRARY_PATH = path.join(
  WORKSPACE_ROOT,
  "scripts/lib/runtime-core-local-state-identity-proof.mjs",
);
const HISTORICAL_SHA256 = "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13";
const ARTIFACT_NAME = "runtime-core-0.1.0-local-state-identity.json";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreLocalStateIdentityEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function proofTexts() {
  const [proofDocumentText, proofMatrixText] = await Promise.all([
    readFile(PROOF_PATH, "utf8"),
    readFile(MATRIX_PATH, "utf8"),
  ]);
  return { proofDocumentText, proofMatrixText };
}

test("accepts immutable task-time M04-T06 local-state and identity evidence", async () => {
  const result = await verifyRuntimeCoreLocalStateIdentityEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 6,
    typeExports: 20,
    internalExports: 2,
    tsdocDeclarations: 28,
    validatorFacadeRuntimeExports: 1,
    validatorFacadeTypeExports: 2,
    validatorFacadeTsdocDeclarations: 3,
    packageTests: 33,
    compilerNegativeCases: 7,
    rootMutationTests: 13,
    traceRules: 4,
    normativeRules: 1,
    trackedFiles: 23,
    mountProbes: 6,
    readProbes: 3,
    acceptedWriteProbes: 3,
    rejectedWriteProbes: 7,
    completeValidationProbes: 3,
    schemaSyntaxProbes: 1,
    schemaProfileProbes: 2,
    resolvedValueProbes: 1,
    pf019Probes: 2,
    noOpProbes: 1,
    atomicityProbes: 4,
    disposalProbes: 5,
    identityCreationProbes: 2,
    identityPreservationProbes: 1,
    identityRemountProbes: 1,
    identityReplacementProbes: 1,
    identityRejectionProbes: 3,
    capabilitySafetyProbes: 1,
    hostileInputProbes: 1,
    platformEffects: 0,
    sourceWriteBacks: 0,
    partialOutputs: false,
  });
});

test("reads exact historical M04-T06 bytes and frozen semantics twice", async () => {
  const [first, second] = await Promise.all([
    buildRuntimeCoreLocalStateIdentityEvidence(),
    buildRuntimeCoreLocalStateIdentityEvidence(),
  ]);
  assert.equal(first.artifactBytes.length, 15_575);
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(first.artifact.task, "M04-T06");
  assert.equal(first.artifact.stateSemantics.schemaApplication, "complete resolved-value");
  assert.equal(first.artifact.nodeIdentitySemantics.repeatKey, "deferred to M04-T07");
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.evidence), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects one-byte or one-length historical M04-T06 artifact tampering", async () => {
  const historical = await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH);
  const tampered = Buffer.from(historical);
  tampered[tampered.length - 2] ^= 1;
  for (const artifactBytes of [tampered, historical.subarray(0, historical.length - 1)]) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({ artifactBytes }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT"),
    );
  }
});

test("rejects every current source build prerequisite runtime or probe injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { buildOptions: {} },
    { prerequisiteBytes: {} },
    { valueResolutionPrerequisiteArtifactBytes: Buffer.alloc(0) },
    { verifyPrerequisite: false },
    { runtimeApi: {} },
    { validatorApi: {} },
    { preparedEvidence: {} },
  ]) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence(options),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
    );
  }
  for (const options of [{ fileOverrides: {} }, { runtimeApi: {} }, { buildOptions: {} }]) {
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence(options),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
    );
  }
  for (const options of [{ fileOverrides: {} }, { buildOptions: {} }, { preparedEvidence: {} }]) {
    await assert.rejects(
      writeRuntimeCoreLocalStateIdentityEvidence(options),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor inherited hidden symbol and Proxy options without invoking traps", async () => {
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
  const hidden = Object.defineProperty({}, "artifactPath", {
    enumerable: false,
    value: "ignored",
  });
  const symbolic = { [Symbol("artifactPath")]: "ignored" };
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const options of [
    accessor,
    inherited,
    hidden,
    symbolic,
    proxy,
    revoked.proxy,
    { unknown: true },
  ]) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence(options),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("captures exact bytes and rejects subclass Proxy shared or accessor-backed byte views", async () => {
  const historical = await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH);
  assert.equal(
    (
      await buildRuntimeCoreLocalStateIdentityEvidence({
        artifactBytes: new Uint8Array(historical),
      })
    ).artifactSha256,
    HISTORICAL_SHA256,
  );

  let accessorCalls = 0;
  class HostileBytes extends Uint8Array {
    get buffer() {
      accessorCalls += 1;
      throw new Error("hostile buffer");
    }

    get byteLength() {
      accessorCalls += 1;
      throw new Error("hostile byteLength");
    }

    get byteOffset() {
      accessorCalls += 1;
      throw new Error("hostile byteOffset");
    }
  }
  const hostileInputs = [
    "not-bytes",
    new HostileBytes(historical),
    new Proxy(new Uint8Array(historical), {}),
  ];
  if (typeof SharedArrayBuffer === "function") {
    hostileInputs.push(new Uint8Array(new SharedArrayBuffer(historical.length)));
  }
  for (const artifactBytes of hostileInputs) {
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({ artifactBytes }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
    );
  }
  assert.equal(accessorCalls, 0);
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      artifactBytes: new Uint8Array(15_576),
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects ambiguous byte and path options plus over-budget proof inputs", async () => {
  const historical = await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH);
  await assert.rejects(
    buildRuntimeCoreLocalStateIdentityEvidence({
      artifactPath: DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
      artifactBytes: historical,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeCoreLocalStateIdentityEvidence({
      sourceArtifactPath: DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
      artifactBytes: historical,
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeCoreLocalStateIdentityEvidence({
      proofDocumentText: "x".repeat(500_001),
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeCoreLocalStateIdentityEvidence({
      proofMatrixText: "x".repeat(2_000_001),
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeCoreLocalStateIdentityEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("LOCAL_STATE_IDENTITY_OPTIONS_INVALID"),
  );
});

test("rejects moved duplicated or mismatched M04-T06 Proof Matrix pins", async () => {
  const texts = await proofTexts();
  const exactPair = `\`${ARTIFACT_NAME}\`\n` + `\`sha256:${HISTORICAL_SHA256}\`.`;
  for (const proofMatrixText of [
    texts.proofMatrixText.replace(
      "M04-T06 defines and proves a bounded, fail-closed surface-local state lifecycle",
      "Moved M04-T06 state boundary",
    ),
    `${texts.proofMatrixText}\n${exactPair}\n`,
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofMatrixText.replace(
      `${exactPair}\n\nM04-T07 defines`,
      `M04-T07 defines\n\n${exactPair}`,
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText,
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved duplicated or missing M04-T06 proof-document pins", async () => {
  const texts = await proofTexts();
  const documentPath = `docs/proof/artifacts/${ARTIFACT_NAME}`;
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("Tracked receipt:", "Moved tracked receipt:"),
    `${texts.proofDocumentText}\n${documentPath}\n`,
    texts.proofDocumentText.replace(documentPath, "docs/proof/artifacts/wrong.json"),
    texts.proofDocumentText.replace("## Explicit non-claims", "## Moved non-claims"),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({
        proofDocumentText,
        proofMatrixText: texts.proofMatrixText,
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects symlink or over-budget immutable artifact sources", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-artifact-"));
  const target = path.join(directory, "target.json");
  const symlinkPath = path.join(directory, "artifact.json");
  const oversized = path.join(directory, "oversized.json");
  try {
    await writeFile(
      target,
      await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
    );
    await symlink(target, symlinkPath);
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({ artifactPath: symlinkPath }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
    await writeFile(oversized, Buffer.alloc(15_576));
    await assert.rejects(
      buildRuntimeCoreLocalStateIdentityEvidence({ artifactPath: oversized }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects symlink or over-budget M04-T06 proof-document sources", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-proof-"));
  const target = path.join(directory, "proof.md");
  const symlinkPath = path.join(directory, "proof-link.md");
  const oversized = path.join(directory, "oversized.md");
  try {
    await writeFile(target, await readFile(PROOF_PATH));
    await symlink(target, symlinkPath);
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({ proofPath: symlinkPath }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
    await writeFile(oversized, "x".repeat(500_001));
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({ proofPath: oversized }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects symlink or over-budget Proof Matrix sources", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-matrix-"));
  const target = path.join(directory, "matrix.md");
  const symlinkPath = path.join(directory, "matrix-link.md");
  const oversized = path.join(directory, "oversized.md");
  try {
    await writeFile(target, await readFile(MATRIX_PATH));
    await symlink(target, symlinkPath);
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({ proofMatrixPath: symlinkPath }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
    await writeFile(oversized, "x".repeat(2_000_001));
    await assert.rejects(
      verifyRuntimeCoreLocalStateIdentityEvidence({ proofMatrixPath: oversized }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pins open-handle TOCTOU checks and current-source independence in the reader", async () => {
  const source = await readFile(LIBRARY_PATH, "utf8");
  for (const required of [
    'handle = await open(filePath, "r");',
    "const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(filePath)]);",
    "openedEntry.dev !== currentEntry.dev",
    "openedEntry.ino !== currentEntry.ino",
    "async function readBoundedHandle(handle, maximumBytes)",
    "const captured = Buffer.allocUnsafe(maximumBytes + 1);",
    "maximumBytes + 1 - offset",
    "const bytes = await readBoundedHandle(handle, maximumBytes);",
    "if (byteLength !== exactBytes)",
    "const authenticatedTracked = await buildRuntimeCoreLocalStateIdentityEvidence({",
    "artifactPath: trackedArtifactPath,",
    "const HISTORICAL_ARTIFACT_BYTES = 15_575;",
    "const MAX_PROOF_DOCUMENT_BYTES = 500_000;",
    "const MAX_PROOF_MATRIX_BYTES = 2_000_000;",
    "without consulting current source, documentation,",
  ]) {
    assert.ok(source.includes(required), `missing hardened reader fragment: ${required}`);
  }
  assert.ok(
    source.indexOf("if (byteLength !== exactBytes)") <
      source.indexOf("const captured = new Uint8Array(byteLength)"),
    "injected byte length must be rejected before allocation and copying",
  );
  for (const forbidden of [
    'from "prettier"',
    'from "typescript"',
    "packages/runtime-core/dist/index.js",
    "buildCurrentEvidence",
    "probeRuntimeBehavior",
    "handle.readFile()",
  ]) {
    assert.equal(source.includes(forbidden), false, `current input returned: ${forbidden}`);
  }
});

test("atomic M04-T06 compatibility writer rejects symlink destinations", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeCoreLocalStateIdentityEvidence({ artifactPath: destination }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic M04-T06 compatibility writer rejects temporary-byte substitution", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeCoreLocalStateIdentityEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic M04-T06 compatibility writer copies only exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    const written = await writeRuntimeCoreLocalStateIdentityEvidence({
      artifactPath: destination,
    });
    const rebuilt = await buildRuntimeCoreLocalStateIdentityEvidence({
      artifactPath: destination,
    });
    assert.equal(written.preserved, false);
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(
      await readFile(destination),
      await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("default M04-T06 generation preserves exact bytes inode and mtime", async () => {
  const before = await lstat(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH, {
    bigint: true,
  });
  const beforeBytes = await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH);
  let renameAttempted = false;
  const result = await writeRuntimeCoreLocalStateIdentityEvidence({
    async beforeAtomicRename() {
      renameAttempted = true;
    },
  });
  const after = await lstat(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH, {
    bigint: true,
  });
  assert.equal(result.preserved, true);
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
  assert.equal(renameAttempted, false);
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.deepEqual(
    await readFile(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
    beforeBytes,
  );
});

test("symlink-parent aliases to the tracked M04-T06 artifact remain true no-ops", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t06-alias-"));
  const alias = path.join(directory, "artifact-parent");
  try {
    await symlink(
      path.dirname(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
      alias,
      "dir",
    );
    const aliasPath = path.join(
      alias,
      path.basename(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
    );
    const before = await lstat(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH, {
      bigint: true,
    });
    let renameAttempted = false;
    const result = await writeRuntimeCoreLocalStateIdentityEvidence({
      artifactPath: aliasPath,
      async beforeAtomicRename() {
        renameAttempted = true;
      },
    });
    const after = await lstat(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH, {
      bigint: true,
    });
    assert.equal(result.preserved, true);
    assert.equal(renameAttempted, false);
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeNs, before.mtimeNs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pins exact task-time prerequisites trace ownership and tracked-file ledger", async () => {
  const { artifact } = await buildRuntimeCoreLocalStateIdentityEvidence();
  assert.deepEqual(
    artifact.prerequisites.map((entry) =>
      "task" in entry
        ? { task: entry.task, artifactSha256: entry.artifactSha256 }
        : { package: entry.package, manifestSha256: entry.manifestSha256 },
    ),
    [
      {
        task: "M04-T02",
        artifactSha256: "73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea",
      },
      {
        package: "@desen/validator",
        manifestSha256: "0e38ffa1671f30beb536445fb74996dc2a2820e72cb575f86c45048e2396d8be",
      },
    ],
  );
  assert.deepEqual(
    artifact.evidence.traceRules.map(({ id }) => id),
    ["PIPE-018", "R-054", "R-104", "D-019"],
  );
  assert.equal(artifact.evidence.trackedFiles.length, 23);
  assert.deepEqual(artifact.evidence.trackedFiles.at(-1), {
    path: "tests/runtime-core-local-state-identity.test.mjs",
    bytes: 20_887,
    sha256: "bea1b4d68a1d5abf0f56e08ae4775caf7444f34a781d302ce5f882d51e18ede8",
  });
});

test("keeps root M04-T06 scripts independent of current source and builds", async () => {
  const manifest = JSON.parse(await readFile(ROOT_MANIFEST_PATH, "utf8"));
  assert.equal(
    manifest.scripts["generate:runtime-core-local-state-identity"],
    "node scripts/generate-runtime-core-local-state-identity-proof.mjs",
  );
  assert.equal(
    manifest.scripts["verify:runtime-core-local-state-identity"],
    "node scripts/verify-runtime-core-local-state-identity.mjs",
  );
  assert.equal(
    manifest.scripts["test:runtime-core-local-state-identity"],
    "node --test tests/runtime-core-local-state-identity.test.mjs",
  );
});

assert.equal(path.basename(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH), ARTIFACT_NAME);
