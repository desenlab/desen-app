import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T09_ADDED_CAPABILITY_IDS,
  M10A_T09_BROWSER_ASSERTION_NAMES,
  M10A_T09_BROWSER_TEST_TITLES,
  M10A_T09_CAPABILITY_IDS,
  M10A_T09_ROOT_TEST_NAMES,
  M10AT09ProofError,
  buildM10AT09Evidence,
  verifyM10AT09Evidence,
  writeM10AT09Evidence,
} from "../scripts/lib/m10a-t09-proof.mjs";

function browserObservation() {
  return {
    profile: "desen.m10a-t09.browser-proof.v1",
    result: "PASS",
    graphReceipts: ["authoring", "host"],
    tests: M10A_T09_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    assertions: Object.fromEntries(M10A_T09_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
  };
}

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT09ProofError);
    assert.equal(error.code, `M10A_T09_${expected}`);
    return true;
  };
}

test("M10A-T09 builds the exact 0.6.0 data-display and feedback Catalog deterministically", async () => {
  const first = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  const second = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  assert.equal(first.artifact.profile, "desen.m10a-t09.data-display-feedback.v1");
  assert.equal(first.artifact.package.catalog.version, "0.6.0");
  assert.deepEqual(first.artifact.capabilities.ids, M10A_T09_CAPABILITY_IDS);
  assert.deepEqual(first.artifact.capabilities.added, M10A_T09_ADDED_CAPABILITY_IDS);
  assert.equal(first.artifactBytes.equals(second.artifactBytes), true);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("M10A-T09 admits bounded sample data, explicit item slots, and stable table row identities", async () => {
  const built = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  assert.deepEqual(built.artifact.capabilities.requiredSlots, ["Card.content", "List.items"]);
  assert.equal(built.artifact.capabilities.tableRowIdentity, "stable-id");
  assert.equal(built.artifact.capabilities.repeatLimit, 100);
  assert.equal(built.artifact.claims.boundedSampleData, true);
  assert.equal(built.artifact.claims.enterpriseGridNotAdmitted, true);
});

test("M10A-T09 authenticates authoring and independent-host browser observations", async () => {
  const built = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  const verified = await verifyM10AT09Evidence({
    artifactBytes: built.artifactBytes,
    browserObservation: browserObservation(),
  });
  assert.equal(verified.status, "PASS");
  assert.equal(verified.task, "M10A-T09");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.equal(verified.browserExecutedByVerifier, false);
});

test("M10A-T09 rejects malformed browser observations, artifact drift, and unsafe evidence options", async () => {
  const malformed = browserObservation();
  malformed.assertions.tableSemantics = false;
  await assert.rejects(
    buildM10AT09Evidence({ browserObservation: malformed }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  await assert.rejects(
    buildM10AT09Evidence({ browserObservation: browserObservation(), unexpected: true }),
    errorCode("OPTIONS_INVALID"),
  );
  const built = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  const drifted = Buffer.from(built.artifactBytes);
  drifted[drifted.byteLength - 2] ^= 1;
  await assert.rejects(
    verifyM10AT09Evidence({ artifactBytes: drifted, browserObservation: browserObservation() }),
    errorCode("ARTIFACT_DRIFT"),
  );
});

test("M10A-T09 preserves the checkpointed T08 historical receipt while the starter Catalog evolves", async () => {
  const built = await buildM10AT09Evidence({ browserObservation: browserObservation() });
  assert.match(built.artifact.historical.m10aT08ArtifactSha256, /^[0-9a-f]{64}$/u);
  assert.match(built.artifact.historical.m10aT08CatalogSha256, /^[0-9a-f]{64}$/u);
  assert.equal(built.artifact.claims.historicalArtifactsRewritten, false);
});

test("M10A-T09 writer is atomic and leaves current artifact bytes deterministic", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t09-root-test-"));
  try {
    const artifactPath = path.join(temporaryRoot, "m10a-t09.json");
    const first = await writeM10AT09Evidence({
      artifactPath: path.resolve(artifactPath),
      browserObservation: browserObservation(),
    });
    assert.equal(first.artifactPath, path.resolve(artifactPath));
    assert.equal((await readFile(artifactPath)).length, first.artifactBytes);
    const built = await buildM10AT09Evidence({ browserObservation: browserObservation() });
    const result = await writeM10AT09Evidence({
      artifactPath: path.resolve(artifactPath),
      browserObservation: browserObservation(),
    });
    assert.equal(result.artifactSha256, built.artifactSha256);
    assert.equal((await readFile(artifactPath)).length, result.artifactBytes);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("M10A-T09 keeps its scoped root-test declaration inventory", () => {
  assert.equal(M10A_T09_BROWSER_TEST_TITLES.length, 4);
  assert.equal(M10A_T09_BROWSER_ASSERTION_NAMES.length, 15);
  assert.equal(M10A_T09_ROOT_TEST_NAMES.length, 6);
});
