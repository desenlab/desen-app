import { createHash } from "node:crypto";
import { types } from "node:util";
import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const TASK = "M10A-T12";
const ARTIFACT_PATH = "docs/proof/artifacts/m10a-t12.json";
const ARTIFACT_BYTES = 11804;
const ARTIFACT_SHA256 = "31f48f192ea6ed4160576e898bc2a422483eaff3a0877f5d015b396630d6389b";
const PROFILE = "desen.m10a-t12.rich-styling-responsive.v1";

/** Failure to authenticate the immutable historical T12 receipt. */
export class M10AT12ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT12ProofError";
    this.code = `M10A_T12_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT12ProofError(code, message);
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Authenticates exact task-time bytes, never current implementation or fresh test success. */
export function authenticateM10AT12Artifact(bytes) {
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
    artifact.proofId !== "m10a-t12" ||
    artifact.profile !== PROFILE ||
    artifact.result !== "PASS"
  )
    fail("ARTIFACT_DRIFT", "The immutable task-time artifact identity drifted.");
  return freeze(artifact);
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function buildM10AT12Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T12 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Retired capture: T15 owns current authoring; historical bytes cannot be regenerated. */
export async function writeM10AT12Evidence() {
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "T12 is historical. T15 owns fresh successor coverage; do not regenerate this artifact.",
  );
}

/** Authenticates the checkpoint-owned receipt without claiming current T12 behavior. */
export async function verifyM10AT12Evidence(options = undefined) {
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
  authenticateM10AT12Artifact(Buffer.from(frozen.bytes));
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
