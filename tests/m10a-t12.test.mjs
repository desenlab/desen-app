import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  M10AT12ProofError,
  authenticateM10AT12Artifact,
  buildM10AT12Evidence,
  writeM10AT12Evidence,
  verifyM10AT12Evidence,
} from "../scripts/lib/m10a-t12-proof.mjs";
import { M10A_T15_WORKLOADS } from "../scripts/lib/m10a-t15-workloads.mjs";

const artifactPath = new URL("../docs/proof/artifacts/m10a-t12.json", import.meta.url);

test("M10A-T12 authenticates its immutable historical receipt without claiming current behavior", async () => {
  const before = await readFile(artifactPath);
  const artifact = authenticateM10AT12Artifact(before);
  assert.equal(artifact.task, "M10A-T12");
  assert.equal(artifact.result, "PASS");
  assert.ok(Object.isFrozen(artifact));
  assert.ok(Object.isFrozen(artifact.source));
  const result = await verifyM10AT12Evidence();
  assert.equal(result.evidenceScope, "historical-artifact-authentication");
  assert.equal(result.externalExecution, false);
  assert.equal(result.artifactBytes, 11804);
  assert.equal(
    result.artifactSha256,
    "31f48f192ea6ed4160576e898bc2a422483eaff3a0877f5d015b396630d6389b",
  );
  assert.match(result.checkpointHeadSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(await readFile(artifactPath), before);
});

test("M10A-T12 rejects mutated historical values, bytes and verifier overrides", async () => {
  const bytes = await readFile(artifactPath);
  const invalid = (error) =>
    error instanceof M10AT12ProofError && error.code === "M10A_T12_ARTIFACT_DRIFT";
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
      () => authenticateM10AT12Artifact(Buffer.from(JSON.stringify(artifact))),
      invalid,
    );
  }
  assert.throws(
    () => authenticateM10AT12Artifact(Buffer.concat([bytes, Buffer.from("\n")])),
    invalid,
  );
  assert.throws(() => authenticateM10AT12Artifact(new Proxy(bytes, {})), invalid);
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
      verifyM10AT12Evidence(option),
      (error) => error instanceof M10AT12ProofError && error.code === "M10A_T12_OPTIONS_INVALID",
    );
  assert.equal(touched, false);
});

test("M10A-T12 cannot regenerate history and retains a fresh successor execution owner", async () => {
  const before = await readFile(artifactPath);
  for (const capture of [buildM10AT12Evidence, writeM10AT12Evidence])
    await assert.rejects(
      capture(),
      (error) =>
        error instanceof M10AT12ProofError && error.code === "M10A_T12_HISTORICAL_CAPTURE_RETIRED",
    );
  assert.deepEqual(await readFile(artifactPath), before);
  const ids = M10A_T15_WORKLOADS.map(({ id }) => id);
  for (const id of ["starter-public-contract", "starter-behavior", "app-behavior", "style-browser"])
    assert.ok(ids.includes(id), id);
});
