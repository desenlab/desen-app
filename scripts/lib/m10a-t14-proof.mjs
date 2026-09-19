import { createHash } from "node:crypto";
import { types } from "node:util";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const TASK = "M10A-T14";
const ARTIFACT_PATH = "docs/proof/artifacts/m10a-t14.json";
const ARTIFACT_BYTES = 3670;
const ARTIFACT_SHA256 = "fe7721562647b4ba4b9ab1275eec3fa554f9fa664d614745e6b5b3d70c75ef54";
const PROFILE = "desen.m10a-t14.history-identity-safe-reuse.v1";

/** Failure to authenticate the immutable historical T14 receipt. */
export class M10AT14ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT14ProofError";
    this.code = `M10A_T14_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT14ProofError(code, message);
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Authenticates exact task-time bytes, never current implementation or fresh test success. */
export function authenticateM10AT14Artifact(bytes) {
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
    artifact.proofId !== "m10a-t14" ||
    artifact.profile !== PROFILE ||
    artifact.result !== "PASS"
  )
    fail("ARTIFACT_DRIFT", "The immutable task-time artifact identity drifted.");
  return freeze(artifact);
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function captureM10AT14Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T14 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function writeM10AT14Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T14 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Authenticates the checkpoint-owned receipt without claiming current T14 behavior. */
export async function verifyM10AT14Evidence(options = undefined) {
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
  authenticateM10AT14Artifact(Buffer.from(frozen.bytes));
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
