import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T07_ADDED_CAPABILITY_IDS,
  M10A_T07_BROWSER_ASSERTION_NAMES,
  M10A_T07_BROWSER_TEST_TITLES,
  M10A_T07_CAPABILITY_IDS,
  M10A_T07_ROOT_TEST_NAMES,
  M10AT07ProofError,
  buildM10AT07Evidence,
  verifyM10AT07Evidence,
  writeM10AT07Evidence,
} from "../scripts/lib/m10a-t07-proof.mjs";

function browserObservation() {
  return {
    profile: "desen.m10a-t07.browser-proof.v1",
    result: "PASS",
    graphReceipts: ["authoring", "host"],
    tests: M10A_T07_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    assertions: Object.fromEntries(M10A_T07_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
  };
}

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT07ProofError);
    assert.equal(error.code, `M10A_T07_${expected}`);
    return true;
  };
}

test("M10A-T07 builds the exact 0.4.0 selection and numeric Catalog deterministically", async () => {
  const first = await buildM10AT07Evidence({ browserObservation: browserObservation() });
  const second = await buildM10AT07Evidence({ browserObservation: browserObservation() });

  assert.equal(first.artifact.profile, "desen.m10a-t07.selection-numeric-controls.v1");
  assert.equal(first.artifact.package.catalog.version, "0.4.0");
  assert.deepEqual(first.artifact.capabilities.ids, M10A_T07_CAPABILITY_IDS);
  assert.deepEqual(first.artifact.capabilities.added, M10A_T07_ADDED_CAPABILITY_IDS);
  assert.equal(
    first.artifact.capabilities.selectCompatibility,
    "id-or-legacy-value-normalized-to-stable-id",
  );
  assert.equal(first.artifactBytes.equals(second.artifactBytes), true);
  assert.equal(first.artifactSha256, second.artifactSha256);
  const reordered = browserObservation();
  reordered.tests.reverse();
  reordered.assertions = Object.fromEntries(Object.entries(reordered.assertions).reverse());
  const canonicalized = await buildM10AT07Evidence({ browserObservation: reordered });
  assert.equal(first.artifactBytes.equals(canonicalized.artifactBytes), true);
  assert.equal(Object.isFrozen(first), true);
});

test("M10A-T07 admits only bounded data, stable identities, ordered public panels, and finite numeric values", async () => {
  const built = await buildM10AT07Evidence({ browserObservation: browserObservation() });
  assert.deepEqual(built.artifact.capabilities.comboboxFilterModes, ["contains", "startsWith"]);
  assert.deepEqual(built.artifact.capabilities.numericBounds, {
    minimum: -100_000,
    maximum: 100_000,
    positiveStepRequired: true,
  });
  assert.equal(built.artifact.browser.assertions.duplicateOptionIdRejected, true);
  assert.equal(built.artifact.browser.assertions.nonFiniteValueRejected, true);
  assert.equal(built.artifact.browser.assertions.functionRendererAndFilterRejected, true);
  assert.equal(built.artifact.browser.assertions.publicOrderedTabPanels, true);
});

test("M10A-T07 authenticates all-positive authoring and independent-host browser observations", async () => {
  const built = await buildM10AT07Evidence({ browserObservation: browserObservation() });
  const verified = await verifyM10AT07Evidence({
    artifactBytes: built.artifactBytes,
    browserObservation: browserObservation(),
  });

  assert.equal(verified.status, "PASS");
  assert.equal(verified.task, "M10A-T07");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.equal(verified.browserExecutedByVerifier, false);
  assert.deepEqual(
    verified.browserTests.map(({ title }) => title).sort(),
    M10A_T07_BROWSER_TEST_TITLES,
  );
});

test("M10A-T07 rejects malformed browser observations, artifact drift, and unsafe evidence options", async () => {
  const malformed = browserObservation();
  malformed.assertions.nonFiniteValueRejected = false;
  await assert.rejects(
    buildM10AT07Evidence({ browserObservation: malformed }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  const sparseTests = browserObservation();
  sparseTests.tests.length = M10A_T07_BROWSER_TEST_TITLES.length;
  delete sparseTests.tests[2];
  await assert.rejects(
    buildM10AT07Evidence({ browserObservation: sparseTests }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  const sparseGraphs = browserObservation();
  sparseGraphs.graphReceipts.length = 2;
  delete sparseGraphs.graphReceipts[1];
  await assert.rejects(
    buildM10AT07Evidence({ browserObservation: sparseGraphs }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  await assert.rejects(
    buildM10AT07Evidence({ browserObservation: browserObservation(), unexpected: true }),
    errorCode("OPTIONS_INVALID"),
  );

  const built = await buildM10AT07Evidence({ browserObservation: browserObservation() });
  const drifted = Buffer.from(built.artifactBytes);
  drifted[drifted.byteLength - 2] ^= 1;
  await assert.rejects(
    verifyM10AT07Evidence({ artifactBytes: drifted, browserObservation: browserObservation() }),
    errorCode("ARTIFACT_DRIFT"),
  );
});

test("M10A-T07 preserves the checkpointed T06 historical receipt while the starter Catalog evolves", async () => {
  const built = await buildM10AT07Evidence({ browserObservation: browserObservation() });
  assert.match(built.artifact.historical.m10aT06ArtifactSha256, /^[0-9a-f]{64}$/u);
  assert.match(built.artifact.historical.m10aT06CatalogSha256, /^[0-9a-f]{64}$/u);
  assert.equal(built.artifact.claims.historicalArtifactsRewritten, false);
  assert.equal(built.artifact.claims.runtimeCoreChanged, false);
});

test("M10A-T07 writer is atomic and leaves the current artifact bytes deterministic", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-m10a-t07-root-test-"));
  const artifactPath = path.join(temporaryRoot, "m10a-t07.json");
  try {
    const first = await writeM10AT07Evidence({
      artifactPath,
      browserObservation: browserObservation(),
    });
    const committed = await readFile(artifactPath);
    const second = await writeM10AT07Evidence({
      artifactPath,
      browserObservation: browserObservation(),
    });
    assert.equal(committed.byteLength, first.artifactBytes);
    assert.equal(first.artifactSha256, second.artifactSha256);
    assert.equal(first.catalogSha256, second.catalogSha256);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("M10A-T07 keeps its scoped root-test declaration inventory", () => {
  assert.equal(M10A_T07_BROWSER_TEST_TITLES.length, 4);
  assert.equal(M10A_T07_BROWSER_ASSERTION_NAMES.length, 16);
  assert.equal(M10A_T07_ROOT_TEST_NAMES.length, 6);
});
