import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH,
  ReferenceTokensAndSyntheticFixturesEvidenceError,
  buildReferenceTokensAndSyntheticFixturesEvidence,
  verifyReferenceTokensAndSyntheticFixturesEvidence,
  writeReferenceTokensAndSyntheticFixturesEvidence,
} from "../scripts/lib/reference-tokens-and-synthetic-fixtures-proof.mjs";

const HISTORICAL_SHA256 = "5510336a4098af065e8e39ffc54b257cc3b0e024aef5967de056f9221025fe0f";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ReferenceTokensAndSyntheticFixturesEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts the immutable task-time M03-T07 token and fixture evidence", async () => {
  const result = await verifyReferenceTokensAndSyntheticFixturesEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    prerequisiteSha256: "553a48cb95aa2a9e6c2ee4e860aea7aedea92499c977b093c1c515c0ad9d75f2",
    provenanceMode: "tracked-defaults",
    compatibilityMode: "immutable-task-time-artifact",
    tokens: 26,
    componentCssProperties: 26,
    packageTests: 19,
    rootTests: 16,
    typeNegativeCases: 20,
    trackedFiles: 25,
  });
});

test("two strict compatibility reads preserve exact historical bytes", async () => {
  const [first, second] = await Promise.all([
    buildReferenceTokensAndSyntheticFixturesEvidence(),
    buildReferenceTokensAndSyntheticFixturesEvidence(),
  ]);
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M03-T07");
  assert.equal(first.artifact.tokens.count, 26);
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
});

test("rejects one-byte historical artifact tampering", async () => {
  const tampered = Buffer.from(
    await readFile(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
  );
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildReferenceTokensAndSyntheticFixturesEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("TOKEN_FIXTURE_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects every successor-source or rebuild injection", async () => {
  for (const options of [
    { tokenApi: {} },
    { testkitApi: {} },
    { catalogApi: {} },
    { verifyPrerequisite: false },
    { referencePackagePath: "ignored" },
    { fileOverrides: {} },
  ]) {
    await assert.rejects(
      buildReferenceTokensAndSyntheticFixturesEvidence(options),
      hasEvidenceCode("TOKEN_FIXTURE_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor inherited symbol and Proxy options without invoking hooks", async () => {
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
  for (const options of [accessor, inherited, symbol, proxy]) {
    await assert.rejects(
      buildReferenceTokensAndSyntheticFixturesEvidence(options),
      hasEvidenceCode("TOKEN_FIXTURE_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects moved duplicated or mismatched Proof Matrix pins", async () => {
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofMatrixText of [
    matrix.replace("`reference-tokens-and-synthetic-fixtures.json`", "`moved.json`"),
    `${matrix}\n\`reference-tokens-and-synthetic-fixtures.json\`\n`,
    matrix.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyReferenceTokensAndSyntheticFixturesEvidence({ proofMatrixText }),
      hasEvidenceCode("TOKEN_FIXTURE_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink historical artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(
      target,
      await readFile(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
    );
    await symlink(target, source);
    await assert.rejects(
      buildReferenceTokensAndSyntheticFixturesEvidence({ artifactPath: source }),
      hasEvidenceCode("TOKEN_FIXTURE_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects a symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeReferenceTokensAndSyntheticFixturesEvidence({ artifactPath: destination }),
      hasEvidenceCode("TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer detects temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeReferenceTokensAndSyntheticFixturesEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compatibility writer treats a symlink-parent tracked alias as the same no-op target", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-alias-"));
  const aliasParent = path.join(directory, "artifacts");
  const aliasPath = path.join(
    aliasParent,
    path.basename(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
  );
  try {
    await symlink(
      path.dirname(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
      aliasParent,
      "dir",
    );
    const before = await lstat(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH, {
      bigint: true,
    });
    const preserved = await writeReferenceTokensAndSyntheticFixturesEvidence({
      artifactPath: aliasPath,
    });
    const after = await lstat(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH, {
      bigint: true,
    });
    assert.equal(preserved.preserved, true);
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeNs, before.mtimeNs);

    let hookCalls = 0;
    await assert.rejects(
      writeReferenceTokensAndSyntheticFixturesEvidence({
        artifactPath: aliasPath,
        beforeAtomicRename() {
          hookCalls += 1;
        },
      }),
      hasEvidenceCode("TOKEN_FIXTURE_NONDEFAULT_TRACKED_WRITE"),
    );
    assert.equal(hookCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compatibility writer preserves the tracked file and copies exact bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m03-t07-copy-"));
  const destination = path.join(directory, "artifact.json");
  try {
    let defaultHookCalled = false;
    const preserved = await writeReferenceTokensAndSyntheticFixturesEvidence();
    assert.equal(preserved.preserved, true);
    assert.equal(defaultHookCalled, false);

    const copied = await writeReferenceTokensAndSyntheticFixturesEvidence({
      artifactPath: destination,
    });
    const verified = await verifyReferenceTokensAndSyntheticFixturesEvidence({
      artifactPath: destination,
    });
    assert.equal(copied.artifactSha256, HISTORICAL_SHA256);
    assert.equal(verified.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(
      await readFile(destination),
      await readFile(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
