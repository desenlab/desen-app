import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T06_BROWSER_ASSERTION_NAMES,
  M10A_T06_BROWSER_COMMAND,
  M10A_T06_BROWSER_TEST_TITLES,
  M10A_T06_CAPABILITY_IDS,
  M10A_T06_FORM_CAPABILITY_IDS,
  M10A_T06_ROOT_TEST_NAMES,
  M10AT06ProofError,
  buildM10AT06Evidence,
  verifyM10AT06Evidence,
  writeM10AT06Evidence,
} from "../scripts/lib/m10a-t06-proof.mjs";

const temporaryDirectories = [];
const CATALOG_PATH = new URL("../packages/starter-catalog-web/catalog.json", import.meta.url);
const HISTORICAL_T05_ARTIFACT_SHA256 =
  "3c78a9a6b61081a57e9c48b44dc74aa2d12e457679f383ffbd85224372d92ab7";

function browserObservation() {
  return {
    profile: "desen.m10a-t06.browser-proof.v1",
    result: "PASS",
    tests: M10A_T06_BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
    graphReceipts: ["authoring", "host"],
    assertions: Object.fromEntries(M10A_T06_BROWSER_ASSERTION_NAMES.map((name) => [name, true])),
  };
}

function errorCode(code) {
  return (error) => {
    assert.ok(error instanceof M10AT06ProofError);
    assert.equal(error.code, "M10A_T06_" + code);
    return true;
  };
}

let built;

test.before(async () => {
  built = await buildM10AT06Evidence({ browserObservation: browserObservation() });
});

test.after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(M10A_T06_ROOT_TEST_NAMES[0], async () => {
  const second = await buildM10AT06Evidence({ browserObservation: browserObservation() });
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(built.artifact.task, "M10A-T06");
  assert.equal(built.artifact.proofId, "m10a-t06");
  assert.equal(built.artifact.package.catalog.id, "run.desen.starter.web");
  assert.equal(built.artifact.package.catalog.version, "0.3.0");
  assert.equal(built.artifact.package.catalog.target, "web-react");
  assert.deepEqual(built.artifact.capabilities.ids, M10A_T06_CAPABILITY_IDS);
  assert.deepEqual(built.artifact.capabilities.formControls, M10A_T06_FORM_CAPABILITY_IDS);
  assert.equal(built.artifact.historical.m10aT05ArtifactSha256, HISTORICAL_T05_ARTIFACT_SHA256);
  assert.match(built.artifact.package.packageDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(built.artifact), true);
});

test(M10A_T06_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(built.artifact.capabilities.controlledEventPayloads, [
    "TextField.change:{value:string}",
    "TextArea.change:{value:string}",
    "Checkbox.change:{checked:boolean}",
    "RadioGroup.change:{value:string}",
    "Switch.change:{checked:boolean}",
  ]);
  assert.deepEqual(built.artifact.capabilities.accessibleParts, ["label", "help", "error"]);
  assert.equal(built.artifact.claims.boundedFormCapabilities, true);
  assert.equal(built.artifact.claims.controlledEventPayloadsOnly, true);
  assert.equal(built.artifact.claims.nativeLabelHelpErrorComposition, true);
  assert.equal(built.artifact.claims.styleProjectionRetainsSemantics, true);
  assert.equal(built.artifact.claims.buttonDisabledLoadingRetained, true);
  assert.equal(built.artifact.claims.runtimeCoreChanged, false);
});

test(M10A_T06_ROOT_TEST_NAMES[2], () => {
  assert.equal(built.artifact.browser.result, "PASS");
  assert.deepEqual(
    built.artifact.browser.tests.map(({ title }) => title).sort(),
    M10A_T06_BROWSER_TEST_TITLES,
  );
  assert.deepEqual(built.artifact.browser.graphReceipts, ["authoring", "host"]);
  assert.equal(
    Object.values(built.artifact.browser.assertions).every((value) => value === true),
    true,
  );
  assert.deepEqual(M10A_T06_BROWSER_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t06"],
  });
});

test(M10A_T06_ROOT_TEST_NAMES[3], async () => {
  for (const mutate of [
    (value) => (value.assertions.nativeLabelAssociation = false),
    (value) => value.tests.pop(),
    (value) => (value.tests[0].result = "FAIL"),
    (value) => (value.assertions.unreviewed = true),
    (value) => (value.graphReceipts = ["authoring"]),
  ]) {
    const altered = browserObservation();
    mutate(altered);
    await assert.rejects(
      buildM10AT06Evidence({ browserObservation: altered }),
      errorCode("BROWSER_OBSERVATION_INVALID"),
    );
  }

  await assert.rejects(
    buildM10AT06Evidence({
      browserObservation: new Proxy(browserObservation(), {}),
    }),
    errorCode("BROWSER_OBSERVATION_INVALID"),
  );
  await assert.rejects(
    buildM10AT06Evidence({
      browserObservation: browserObservation(),
      unreviewed: true,
    }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyM10AT06Evidence({
      artifactBytes: Uint8Array.from([1, 2, 3]),
      browserObservation: browserObservation(),
    }),
    errorCode("OPTIONS_INVALID"),
  );
});

test(M10A_T06_ROOT_TEST_NAMES[4], async () => {
  const alteredArtifact = Buffer.from(built.artifactBytes);
  alteredArtifact[alteredArtifact.length - 2] ^= 1;
  await assert.rejects(
    verifyM10AT06Evidence({
      artifactBytes: alteredArtifact,
      browserObservation: browserObservation(),
    }),
    errorCode("ARTIFACT_DRIFT"),
  );

  const verified = await verifyM10AT06Evidence({
    artifactBytes: built.artifactBytes,
    browserObservation: browserObservation(),
  });
  assert.equal(verified.status, "PASS");
  assert.equal(verified.task, "M10A-T06");
  assert.equal(verified.checkpointHeadSha256, "TEST_OVERRIDE");
  assert.equal(verified.browserExecutedByVerifier, false);
});

test(M10A_T06_ROOT_TEST_NAMES[5], async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t06-proof-"));
  temporaryDirectories.push(directory);
  const destination = path.join(directory, "artifact.json");
  const prior = Buffer.from("prior authority\n", "utf8");
  const catalogBefore = await readFile(CATALOG_PATH);
  await writeFile(destination, prior);

  await assert.rejects(
    writeM10AT06Evidence({
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

  const written = await writeM10AT06Evidence({
    artifactPath: destination,
    browserObservation: browserObservation(),
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);
  assert.deepEqual(await readFile(CATALOG_PATH), catalogBefore);

  const link = path.join(directory, "linked-artifact.json");
  await symlink(destination, link);
  await assert.rejects(
    writeM10AT06Evidence({ artifactPath: link, browserObservation: browserObservation() }),
    errorCode("ARTIFACT_WRITE_UNSAFE"),
  );
  await assert.rejects(
    writeM10AT06Evidence({
      artifactPath: "relative.json",
      browserObservation: browserObservation(),
    }),
    errorCode("OPTIONS_INVALID"),
  );
});
