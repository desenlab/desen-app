import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  M10AT14ProofError,
  authenticateM10AT14Artifact,
  captureM10AT14Evidence,
  writeM10AT14Evidence,
  verifyM10AT14Evidence,
} from "../scripts/lib/m10a-t14-proof.mjs";
import { M10A_T15_WORKLOADS } from "../scripts/lib/m10a-t15-workloads.mjs";

const artifactPath = new URL("../docs/proof/artifacts/m10a-t14.json", import.meta.url);

test("M10A-T14 authenticates its immutable historical receipt without claiming current behavior", async () => {
  const before = await readFile(artifactPath);
  const artifact = authenticateM10AT14Artifact(before);
  assert.equal(artifact.task, "M10A-T14");
  assert.equal(artifact.result, "PASS");
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.source));
  const result = await verifyM10AT14Evidence();
  assert.equal(result.evidenceScope, "historical-artifact-authentication");
  assert.equal(result.externalExecution, false);
  assert.equal(result.artifactBytes, 3670);
  assert.equal(
    result.artifactSha256,
    "fe7721562647b4ba4b9ab1275eec3fa554f9fa664d614745e6b5b3d70c75ef54",
  );
  assert.match(result.checkpointHeadSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(await readFile(artifactPath), before);
});

test("M10A-T14 rejects mutated historical values, bytes and verifier overrides", async () => {
  const bytes = await readFile(artifactPath);
  const invalid = (error) =>
    error instanceof M10AT14ProofError && error.code === "M10A_T14_ARTIFACT_DRIFT";
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
      () => authenticateM10AT14Artifact(Buffer.from(JSON.stringify(artifact))),
      invalid,
    );
  }
  assert.throws(
    () => authenticateM10AT14Artifact(Buffer.concat([bytes, Buffer.from("\n")])),
    invalid,
  );
  assert.throws(() => authenticateM10AT14Artifact(new Proxy(bytes, {})), invalid);
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
      verifyM10AT14Evidence(option),
      (error) => error instanceof M10AT14ProofError && error.code === "M10A_T14_OPTIONS_INVALID",
    );
  assert.equal(touched, false);
});

test("M10A-T14 cannot regenerate history and retains a fresh successor execution owner", async () => {
  const before = await readFile(artifactPath);
  for (const capture of [captureM10AT14Evidence, writeM10AT14Evidence])
    await assert.rejects(
      capture(),
      (error) =>
        error instanceof M10AT14ProofError && error.code === "M10A_T14_HISTORICAL_CAPTURE_RETIRED",
    );
  assert.deepEqual(await readFile(artifactPath), before);
  const ids = M10A_T15_WORKLOADS.map(({ id }) => id);
  for (const id of ["source-history", "app-behavior"]) assert.ok(ids.includes(id), id);
});
