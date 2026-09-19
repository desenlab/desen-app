import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  M10AT13ProofError,
  authenticateM10AT13Artifact,
  captureM10AT13Evidence,
  writeM10AT13Evidence,
  verifyM10AT13Evidence,
} from "../scripts/lib/m10a-t13-proof.mjs";
import { M10A_T15_WORKLOADS } from "../scripts/lib/m10a-t15-workloads.mjs";

const artifactPath = new URL("../docs/proof/artifacts/m10a-t13.json", import.meta.url);

test("M10A-T13 authenticates its immutable historical receipt without claiming current behavior", async () => {
  const before = await readFile(artifactPath);
  const artifact = authenticateM10AT13Artifact(before);
  assert.equal(artifact.task, "M10A-T13");
  assert.equal(artifact.result, "PASS");
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.source));
  const result = await verifyM10AT13Evidence();
  assert.equal(result.evidenceScope, "historical-artifact-authentication");
  assert.equal(result.externalExecution, false);
  assert.equal(result.artifactBytes, 3992);
  assert.equal(
    result.artifactSha256,
    "e76f00a135a6625f2c65175d07aafd83e467c4bf193de070444ece99fd0df6f3",
  );
  assert.match(result.checkpointHeadSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(await readFile(artifactPath), before);
});

test("M10A-T13 rejects mutated historical values, bytes and verifier overrides", async () => {
  const bytes = await readFile(artifactPath);
  const invalid = (error) =>
    error instanceof M10AT13ProofError && error.code === "M10A_T13_ARTIFACT_DRIFT";
  for (const change of [
    (value) => {
      value.result = "FAIL";
    },
    (value) => {
      value.source = [];
    },
    (value) => {
      value.task = "M10A-T15";
    },
    (value) => {
      value.claims = {};
    },
  ]) {
    const artifact = JSON.parse(bytes);
    change(artifact);
    assert.throws(
      () => authenticateM10AT13Artifact(Buffer.from(JSON.stringify(artifact))),
      invalid,
    );
  }
  assert.throws(
    () => authenticateM10AT13Artifact(Buffer.concat([bytes, Buffer.from("\n")])),
    invalid,
  );
  assert.throws(() => authenticateM10AT13Artifact(new Proxy(bytes, {})), invalid);
  let touched = false;
  const hostile = Object.defineProperty({}, "workspaceRoot", {
    get() {
      touched = true;
      throw new Error("must not read");
    },
  });
  for (const option of [
    hostile,
    null,
    new Proxy({}, {}),
    { browserObservation: { result: "PASS" } },
    {
      runChild() {
        throw new Error("Historical verification must not execute a child.");
      },
    },
  ])
    await assert.rejects(
      verifyM10AT13Evidence(option),
      (error) => error instanceof M10AT13ProofError && error.code === "M10A_T13_OPTIONS_INVALID",
    );
  assert.equal(touched, false);
});

test("M10A-T13 cannot regenerate history and retains a fresh successor execution owner", async () => {
  const before = await readFile(artifactPath);
  for (const capture of [captureM10AT13Evidence, writeM10AT13Evidence])
    await assert.rejects(
      capture(),
      (error) =>
        error instanceof M10AT13ProofError && error.code === "M10A_T13_HISTORICAL_CAPTURE_RETIRED",
    );
  assert.deepEqual(await readFile(artifactPath), before);
  const ids = M10A_T15_WORKLOADS.map(({ id }) => id);
  for (const id of ["asset-behavior", "app-behavior", "build-app-closure"])
    assert.ok(ids.includes(id), id);
});
