import { createHash } from "node:crypto";
import { types } from "node:util";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const TASK = "M10A-T13";
const ARTIFACT_PATH = "docs/proof/artifacts/m10a-t13.json";
const ARTIFACT_BYTES = 3992;
const ARTIFACT_SHA256 = "e76f00a135a6625f2c65175d07aafd83e467c4bf193de070444ece99fd0df6f3";
const PROFILE = "desen.m10a-t13.safe-local-assets.v1";

/** Failure to authenticate the immutable historical T13 receipt. */
export class M10AT13ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT13ProofError";
    this.code = `M10A_T13_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT13ProofError(code, message);
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Authenticates exact task-time bytes, never current implementation or fresh test success. */
export function authenticateM10AT13Artifact(bytes) {
  if (
    types.isProxy(bytes) ||
    !Buffer.isBuffer(bytes) ||
    Reflect.ownKeys(bytes).some(
      (key) => typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key),
    ) ||
    bytes.byteLength !== ARTIFACT_BYTES ||
    createHash("sha256").update(bytes).digest("hex") !== ARTIFACT_SHA256
  )
    fail("ARTIFACT_DRIFT", "The immutable task-time artifact bytes drifted.");
  const artifact = JSON.parse(bytes.toString("utf8"));
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== TASK ||
    artifact.proofId !== "m10a-t13" ||
    artifact.profile !== PROFILE ||
    artifact.result !== "PASS"
  )
    fail("ARTIFACT_DRIFT", "The immutable task-time artifact identity drifted.");
  return freeze(artifact);
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function captureM10AT13Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T13 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function writeM10AT13Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T13 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Authenticates the checkpoint-owned receipt without claiming current T13 behavior. */
export async function verifyM10AT13Evidence(options = undefined) {
  if (
    options !== undefined &&
    (options === null ||
      typeof options !== "object" ||
      types.isProxy(options) ||
      Object.getPrototypeOf(options) !== Object.prototype ||
      Reflect.ownKeys(options).length !== 0)
  )
    fail("OPTIONS_INVALID", "Historical verification accepts no authority overrides.");
  const frozen = await readCheckpointedFrozenArtifact(TASK);
  if (
    frozen.path !== ARTIFACT_PATH ||
    frozen.byteLength !== ARTIFACT_BYTES ||
    frozen.sha256 !== ARTIFACT_SHA256
  )
    fail("ARTIFACT_DRIFT", "The checkpoint-owned historical receipt drifted.");
  authenticateM10AT13Artifact(Buffer.from(frozen.bytes));
  return freeze({
    status: "PASS",
    task: TASK,
    profile: PROFILE,
    evidenceScope: "historical-artifact-authentication",
    artifactBytes: ARTIFACT_BYTES,
    artifactSha256: ARTIFACT_SHA256,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
    externalExecution: false,
  });
}
