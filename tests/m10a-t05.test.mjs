import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T05_BROWSER_ASSERTION_NAMES,
  M10A_T05_BROWSER_TEST_TITLES,
  M10A_T05_CAPABILITY_IDS,
  M10A_T05_ROOT_TEST_NAMES,
  M10AT05ProofError,
  buildM10AT05Evidence,
  verifyM10AT05Evidence,
  writeM10AT05Evidence,
} from "../scripts/lib/m10a-t05-proof.mjs";

const temporaryDirectories = [];
const CATALOG_PATH = new URL("../packages/starter-catalog-web/catalog.json", import.meta.url);

function browserObservation() {
  return {
    profile: "desen.m10a-t05.browser-proof.v1",
    result: "PASS",
    tests: M10A_T05_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    graphReceipts: ["authoring", "host"],
    assertions: Object.fromEntries(M10A_T05_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
  };
}

function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof M10AT05ProofError);
    assert.equal(error.code, `M10A_T05_${code}`);
    return true;
  };
}

let built;

test.before(async () => {
  built = await buildM10AT05Evidence({ browserObservation: browserObservation() });
});

test.after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(M10A_T05_ROOT_TEST_NAMES[0], async () => {
  const second = await buildM10AT05Evidence({ browserObservation: browserObservation() });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(built.artifact.task, "M10A-T05");
  assert.equal(built.artifact.proofId, "m10a-t05");
  assert.deepEqual(built.artifact.capabilities.ids, M10A_T05_CAPABILITY_IDS);
  assert.match(built.artifact.package.packageDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(built.artifact), true);
});

test(M10A_T05_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(built.artifact.capabilities.layout, ["Box", "Stack", "Grid"]);
  assert.deepEqual(built.artifact.capabilities.content, [
    "Text",
    "Heading",
    "Image",
    "Icon",
    "Separator",
  ]);
  assert.deepEqual(built.artifact.capabilities.trustedImageSources, [
    "neutral-horizon",
    "neutral-grid",
  ]);
  assert.deepEqual(built.artifact.capabilities.logicalProperties, [
    "paddingInline",
    "marginInline",
    "textAlign",
    "fill",
    "hug",
  ]);
  assert.equal(built.artifact.claims.unsupportedImageColorRejected, true);
  assert.equal(built.artifact.claims.visibleVerticalSeparator, true);
});

test(M10A_T05_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.browser.result, "PASS");
  assert.deepEqual(
    built.artifact.browser.tests.map(({ title }) => title).sort(),
    M10A_T05_BROWSER_TEST_TITLES,
  );
  assert.deepEqual(built.artifact.browser.graphReceipts, ["authoring", "host"]);
  assert.equal(
    Object.values(built.artifact.browser.assertions).every((value) => value === true),
    true,
  );
});

test(M10A_T05_ROOT_TEST_NAMES[3], async () => {
  for (const mutate of [
    (value) => (value.assertions.privateSelectorsRejected = false),
    (value) => value.tests.pop(),
    (value) => (value.tests[0].result = "FAIL"),
    (value) => (value.assertions.unreviewed = true),
    (value) => (value.graphReceipts = ["authoring"]),
  ]) {
    const altered = browserObservation();
    mutate(altered);
    await assert.rejects(
      buildM10AT05Evidence({ browserObservation: altered }),
      errorCode("BROWSER_OBSERVATION_INVALID"),
    );
  }
});

test(M10A_T05_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.historical.m10aT01ArtifactSha256.length, 64);
  assert.match(built.artifact.historical.m10aT01CatalogSha256, /^[0-9a-f]{64}$/u);
  assert.equal(built.artifact.claims.historicalArtifactsRewritten, false);
  assert.equal(built.artifact.claims.runtimeCoreChanged, false);
});

test(M10A_T05_ROOT_TEST_NAMES[5], async () => {
  const alteredArtifact = Buffer.from(built.artifactBytes);
  alteredArtifact[alteredArtifact.length - 2] ^= 1;
  await assert.rejects(
    verifyM10AT05Evidence({
      artifactBytes: alteredArtifact,
      browserObservation: browserObservation(),
    }),
    errorCode("ARTIFACT_DRIFT"),
  );
  const alteredBrowser = browserObservation();
  alteredBrowser.assertions.logicalRtlAlignment = false;
  await assert.rejects(
    verifyM10AT05Evidence({
      artifactBytes: built.artifactBytes,
      browserObservation: alteredBrowser,
    }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
});

test(M10A_T05_ROOT_TEST_NAMES[6], async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t05-proof-"));
  temporaryDirectories.push(directory);
  const destination = path.join(directory, "artifact.json");
  const prior = Buffer.from("prior authority\n", "utf8");
  const catalogBefore = await readFile(CATALOG_PATH);
  await writeFile(destination, prior);
  await assert.rejects(
    writeM10AT05Evidence({
      artifactPath: destination,
      browserObservation: browserObservation(),
      beforeAtomicRename() {
        throw new Error("simulated interruption");
      },
    }),
    errorCode("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), prior);
  assert.deepEqual(await readFile(CATALOG_PATH), catalogBefore);

  const written = await writeM10AT05Evidence({
    artifactPath: destination,
    browserObservation: browserObservation(),
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);
  assert.deepEqual(await readFile(CATALOG_PATH), catalogBefore);

  const link = path.join(directory, "linked-artifact.json");
  await symlink(destination, link);
  await assert.rejects(
    writeM10AT05Evidence({ artifactPath: link, browserObservation: browserObservation() }),
    errorCode("ARTIFACT_WRITE_UNSAFE"),
  );
});
